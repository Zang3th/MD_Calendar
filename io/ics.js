window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// ICS reading for the import of the Google history and of single invitations (docs/Domain.md#imports-and-exports).
// Turns VEVENTs into plain events in local time; the domain decides what they become.
(function (app) {
  /** @param {string} value */
  function unescape(value) {
    return value.replace(/\\([nN,;\\])/g, (_, character) => character === "n" || character === "N" ? "\n" : character);
  }

  /** @param {number} value */
  const two = value => String(value).padStart(2, "0");

  /**
   * A DATE or DATE-TIME value as a local day key and time. UTC values are converted to local time;
   * values with a TZID are taken as local wall time (everything is local time, docs/Domain.md#time).
   * @param {string} value @param {string[]} parameters
   * @returns {{key: string, time: string} | null}
   */
  function moment(value, parameters) {
    const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim());
    if (!match) return null;
    if (!match[4] || parameters.includes("VALUE=DATE")) return { key: app.calendar.parseDate(`${match[3]}.${match[2]}.${match[1]}`), time: "" };
    if (match[7]) {
      const local = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5])));
      return { key: `${local.getFullYear()}-${two(local.getMonth() + 1)}-${two(local.getDate())}`, time: `${two(local.getHours())}:${two(local.getMinutes())}` };
    }
    return { key: `${match[1]}-${match[2]}-${match[3]}`, time: `${match[4]}:${match[5]}` };
  }

  /** Adds an ICS duration (P1D, PT1H30M, P1W) to a start. @param {{key: string, time: string}} start @param {string} duration */
  function addDuration(start, duration) {
    const match = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:\d+S)?)?$/.exec(duration.trim());
    if (!match) return start;
    const minutes = (Number(start.time.slice(0, 2)) * 60 + Number(start.time.slice(3, 5) || 0)) + Number(match[3] || 0) * 60 + Number(match[4] || 0);
    const days = Number(match[1] || 0) * 7 + Number(match[2] || 0) + Math.floor(minutes / 1440);
    const rest = minutes % 1440;
    return { key: app.calendar.addDays(start.key, days), time: start.time ? `${two(Math.floor(rest / 60))}:${two(rest % 60)}` : "" };
  }

  /**
   * Converts an RRULE into the allowed subset; null when it cannot be represented (docs/Domain.md#recurring-entry).
   * @param {string} text @param {string} start
   */
  function rule(text, start) {
    let count = 0;
    const parts = [];
    for (const part of text.split(";")) {
      const [name, value = ""] = part.split("=");
      if (name === "WKST") continue;
      if (name === "COUNT") count = Number(value);
      else if (name === "UNTIL") {
        const end = moment(value, []);
        if (!end) return null;
        parts.push(`UNTIL=${end.key.replace(/-/g, "")}`);
      } else if (name === "BYMONTH" && value === start.slice(5, 7) && text.includes("FREQ=YEARLY")) continue;
      else if (name === "BYMONTHDAY" && Number(value) === Number(start.slice(8)) && text.includes("FREQ=YEARLY")) continue;
      else parts.push(part);
    }
    const parsed = app.recurrence.parseRule(parts.join(";"));
    if (!parsed) return null;
    if (count > 0) {
      // COUNT has no place in the subset: it becomes the date of the last occurrence.
      let found = 0;
      for (let key = start, step = 0; step < 20000; key = app.calendar.addDays(key, 1), step += 1) {
        if (parsed.until && key > parsed.until) break;
        if (app.recurrence.occursOn(parsed, start, key) && (found += 1) === count) {
          parsed.until = key;
          break;
        }
      }
    }
    return parsed;
  }

  /**
   * Reads all events of an ICS file.
   * @param {string} text @returns {{events: MDCIcsEvent[], skipped: number}}
   */
  function parse(text) {
    const lines = text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
    /** @type {Array<Record<string, {value: string, parameters: string[]}[]>>} */
    const blocks = [];
    /** @type {Record<string, {value: string, parameters: string[]}[]> | null} */
    let block = null;
    let depth = 0;
    for (const line of lines) {
      if (line === "BEGIN:VEVENT") {
        block = {};
        depth = 0;
        continue;
      }
      if (!block) continue;
      if (line.startsWith("BEGIN:")) depth += 1;
      else if (line.startsWith("END:") && depth) depth -= 1;
      else if (line === "END:VEVENT") {
        blocks.push(block);
        block = null;
      } else if (!depth) {
        const colon = line.indexOf(":");
        if (colon < 0) continue;
        const [name, ...parameters] = line.slice(0, colon).split(";");
        const key = name.toUpperCase();
        (block[key] ||= []).push({ value: line.slice(colon + 1), parameters: parameters.map(parameter => parameter.toUpperCase()) });
      }
    }

    /** @type {MDCIcsEvent[]} */
    const events = [];
    let skipped = 0;
    /** Dates of moved or cancelled instances per UID; they become exceptions of the series. @type {Map<string, string[]>} */
    const overridden = new Map();
    for (const item of blocks) {
      const first = (/** @type {string} */ name) => item[name]?.[0];
      const startValue = first("DTSTART");
      const start = startValue ? moment(startValue.value, startValue.parameters) : null;
      const uid = first("UID")?.value || "";
      const recurrenceId = first("RECURRENCE-ID");
      if (recurrenceId && uid) {
        const original = moment(recurrenceId.value, recurrenceId.parameters);
        if (original) overridden.set(uid, [...(overridden.get(uid) || []), original.key]);
      }
      if (!start?.key || first("STATUS")?.value.toUpperCase() === "CANCELLED") {
        skipped += 1;
        continue;
      }
      const endValue = first("DTEND");
      const duration = first("DURATION");
      let end = endValue ? moment(endValue.value, endValue.parameters) : duration ? addDuration(start, duration.value) : null;
      // An event ending at midnight ends on its start day.
      if (end && start.time && end.time === "00:00" && end.key === app.calendar.addDays(start.key, 1)) end = { key: start.key, time: "" };
      // An all-day DTEND is exclusive.
      if (end && !start.time && !end.time) end = { key: app.calendar.addDays(end.key, -1), time: "" };
      if (!end || end.key < start.key) end = { key: start.key, time: "" };
      const ruleText = first("RRULE")?.value || "";
      const parsedRule = ruleText && !recurrenceId ? rule(ruleText, start.key) : null;
      const except = (item.EXDATE || []).flatMap(value => value.value.split(",").map(part => moment(part, value.parameters)?.key || "")).filter(Boolean);
      events.push({
        uid, title: unescape(first("SUMMARY")?.value || "").trim() || "(ohne Titel)",
        location: unescape(first("LOCATION")?.value || "").replace(/\n/g, ", ").trim(),
        note: unescape(first("DESCRIPTION")?.value || "").split("\n").map(line => line.trimEnd()).filter(Boolean),
        start: start.key, end: end.key, startTime: start.time, endTime: end.key === start.key ? end.time : "",
        rule: parsedRule, unsupportedRule: Boolean(ruleText && !recurrenceId && !parsedRule), except
      });
    }
    for (const event of events) {
      if (event.rule) event.except = [...new Set([...event.except, ...(overridden.get(event.uid) || [])])].sort();
    }
    return { events, skipped };
  }

  app.ics = { parse };
})(window.MDCalendar);
