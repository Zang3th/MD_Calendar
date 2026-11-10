window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Recurrence rules and occurrence expansion (docs/Domain.md#recurring-entry).
// The rule subset is stored as RFC 5545 RRULE; dates are ISO day keys.
(function (app) {
  const weekdays = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
  const frequencies = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"];
  const msPerDay = 86400000;
  const cacheLimit = 1000;

  /** @param {string} key */
  function parts(key) {
    return { year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)), day: Number(key.slice(8, 10)) };
  }

  /** Days since 1970-01-01 for a day key. @param {string} key */
  function dayNumber(key) {
    const { year, month, day } = parts(key);
    return Date.UTC(year, month - 1, day) / msPerDay;
  }

  /** Weekday 0 = Monday … 6 = Sunday. @param {string} key */
  function weekday(key) {
    return (dayNumber(key) + 3) % 7;
  }

  /** @param {number} year @param {number} month */
  function daysInMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }

  /**
   * Parses an RRULE within the allowed subset; returns null for anything else.
   * @param {string} text
   * @returns {MDCRule | null}
   */
  function parseRule(text) {
    /** @type {MDCRule} */
    const rule = { freq: "DAILY", interval: 1, byDay: [], byMonthDay: 0, until: "" };
    const seen = new Set();
    for (const part of text.trim().split(";")) {
      const [name, value, ...rest] = part.split("=");
      if (!name || value === undefined || rest.length || seen.has(name)) return null;
      seen.add(name);
      if (name === "FREQ") {
        if (!frequencies.includes(value)) return null;
        rule.freq = /** @type {MDCRule["freq"]} */ (value);
      } else if (name === "INTERVAL") {
        if (!/^[1-9]\d{0,2}$/.test(value)) return null;
        rule.interval = Number(value);
      } else if (name === "BYDAY") {
        rule.byDay = value.split(",");
        if (!rule.byDay.every(day => /^(-?[1-5])?(MO|TU|WE|TH|FR|SA|SU)$/.test(day))) return null;
      } else if (name === "BYMONTHDAY") {
        if (!/^([1-9]|[12]\d|3[01])$/.test(value)) return null;
        rule.byMonthDay = Number(value);
      } else if (name === "UNTIL") {
        const match = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
        const key = match ? app.calendar.parseDate(`${match[3]}.${match[2]}.${match[1]}`) : "";
        if (!key) return null;
        rule.until = key;
      } else return null;
    }
    if (!seen.has("FREQ")) return null;
    const positional = rule.byDay.some(day => /^-?\d/.test(day));
    // Allowed: weekly on plain weekdays; monthly on a day of the month or on one positional weekday.
    if (rule.freq === "WEEKLY" && (positional || rule.byMonthDay)) return null;
    if (rule.freq === "MONTHLY" && (rule.byDay.length && (!positional || rule.byDay.length > 1 || rule.byMonthDay))) return null;
    if ((rule.freq === "DAILY" || rule.freq === "YEARLY") && (rule.byDay.length || rule.byMonthDay)) return null;
    return rule;
  }

  /** @param {MDCRule} rule */
  function serializeRule(rule) {
    const values = [`FREQ=${rule.freq}`];
    if (rule.interval > 1) values.push(`INTERVAL=${rule.interval}`);
    if (rule.byDay.length) values.push(`BYDAY=${rule.byDay.join(",")}`);
    if (rule.byMonthDay) values.push(`BYMONTHDAY=${rule.byMonthDay}`);
    if (rule.until) values.push(`UNTIL=${rule.until.replaceAll("-", "")}`);
    return values.join(";");
  }

  /** Whether the rule, starting on `start`, has an occurrence on `key` (exceptions not applied). @param {MDCRule} rule @param {string} start @param {string} key */
  function occursOn(rule, start, key) {
    if (key < start || (rule.until && key > rule.until)) return false;
    const from = parts(start);
    const at = parts(key);
    switch (rule.freq) {
      case "DAILY":
        return (dayNumber(key) - dayNumber(start)) % rule.interval === 0;
      case "WEEKLY": {
        const days = rule.byDay.length ? rule.byDay : [weekdays[weekday(start)]];
        if (!days.includes(weekdays[weekday(key)])) return false;
        const weeks = Math.round((dayNumber(key) - weekday(key) - (dayNumber(start) - weekday(start))) / 7);
        return weeks % rule.interval === 0;
      }
      case "MONTHLY": {
        const months = (at.year - from.year) * 12 + at.month - from.month;
        if (months % rule.interval !== 0) return false;
        if (rule.byMonthDay) return at.day === rule.byMonthDay;
        if (!rule.byDay.length) return at.day === from.day;
        const match = /^(-?\d)(\w\w)$/.exec(rule.byDay[0]);
        if (!match || weekdays[weekday(key)] !== match[2]) return false;
        const position = Number(match[1]);
        return position > 0
          ? Math.ceil(at.day / 7) === position
          : Math.ceil((daysInMonth(at.year, at.month) - at.day + 1) / 7) === -position;
      }
      case "YEARLY":
        return at.month === from.month && at.day === from.day && (at.year - from.year) % rule.interval === 0;
    }
    return false;
  }

  /** @type {WeakMap<MDCCalendar, {revision: number, days: Map<string, MDCOccurrence[]>}>} */
  const caches = new WeakMap();

  /**
   * Occurrences of all series on one day, ordered by time, then title. Cached per calendar revision.
   * @param {MDCCalendar} calendar @param {string} key
   * @returns {readonly MDCOccurrence[]}
   */
  function occurrences(calendar, key) {
    let cache = caches.get(calendar);
    if (!cache || cache.revision !== calendar.seriesRevision || cache.days.size > cacheLimit) {
      cache = { revision: calendar.seriesRevision, days: new Map() };
      caches.set(calendar, cache);
    }
    let result = cache.days.get(key);
    if (!result) {
      result = [];
      calendar.series.forEach((series, index) => {
        if ("raw" in series || !occursOn(series.rule, series.start, key) || series.except.includes(key)) return;
        result?.push({ series, index, key, done: series.done.includes(key) });
      });
      result.sort((left, right) => (left.series.startTime || "99").localeCompare(right.series.startTime || "99") ||
        left.series.title.localeCompare(right.series.title));
      cache.days.set(key, result);
    }
    return result;
  }

  /** Describes a rule in German for the UI. @param {MDCRule} rule @param {string} start */
  function describe(rule, start) {
    const names = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
    const short = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
    const every = (/** @type {string} */ one, /** @type {string} */ many) => rule.interval > 1 ? `Alle ${rule.interval} ${many}` : one;
    let text = "";
    if (rule.freq === "DAILY") text = every("Täglich", "Tage");
    else if (rule.freq === "WEEKLY") {
      const days = (rule.byDay.length ? rule.byDay : [weekdays[weekday(start)]]).map(day => short[weekdays.indexOf(day)]);
      text = `${every("Wöchentlich", "Wochen")}: ${days.join(", ")}`;
    } else if (rule.freq === "MONTHLY") {
      const match = /^(-?\d)(\w\w)$/.exec(rule.byDay[0] || "");
      const on = rule.byMonthDay ? `am ${rule.byMonthDay}.` : match
        ? `am ${match[1] === "-1" ? "letzten" : `${match[1]}.`} ${names[weekdays.indexOf(match[2])]}`
        : `am ${parts(start).day}.`;
      text = `${every("Monatlich", "Monate")} ${on}`;
    } else text = every("Jährlich", "Jahre");
    return rule.until ? `${text} bis ${app.calendar.formatDate(rule.until)}` : text;
  }

  app.recurrence = { parseRule, serializeRule, occursOn, occurrences, describe, weekday, weekdays };
})(window.MDCalendar);
