import { dates, history } from "@zang3th/md-libs/core";

window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// The comparison of the synchronization with Google: which local items take part, how Google events map to them and
// back, and how each difference is classified and preselected (docs/Domain.md#synchronization-with-google).
(function (app) {
  /** Items from this day on are synchronized (docs/Domain.md#what-is-synchronized). */
  const cutover = "2026-11-23";
  /** Google's fixed event colors by color ID. */
  const googleColors = /** @type {Record<string, string>} */ ({
    1: "#7986cb", 2: "#33b679", 3: "#8e24aa", 4: "#e67c73", 5: "#f6bf26", 6: "#f4511e",
    7: "#039be5", 8: "#616161", 9: "#3f51b5", 10: "#0b8043", 11: "#d50000"
  });
  /** The fields compared per kind, in the order of MD_Calendar.json. */
  const fieldsOf = /** @type {Record<MDCSyncKind, string[]>} */ ({
    entry: ["date", "time", "title", "location", "note", "tag"],
    "day-off": ["start", "end", "title", "location", "note"],
    "multi-day": ["start", "end", "title", "location", "note", "tag"],
    series: ["start", "rule", "except", "title", "location", "note", "tag"]
  });
  /** One-way kinds: the calendar is the source (docs/Decisions.md D65). */
  const exported = ["day-off", "multi-day", "series"];

  // ---------- Colors ----------

  /** sRGB hex to OKLab, for perceptual color distances. @param {string} hex */
  function oklab(hex) {
    const channel = (/** @type {number} */ at) => {
      const value = parseInt(hex.slice(at, at + 2), 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    const [r, g, b] = [channel(1), channel(3), channel(5)];
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  }

  /** The Google color ID closest to a tag color. @param {string} hex */
  function colorId(hex) {
    const target = oklab(hex);
    let best = "";
    let distance = Infinity;
    for (const [id, color] of Object.entries(googleColors)) {
      const candidate = oklab(color).reduce((sum, value, index) => sum + (value - target[index]) ** 2, 0);
      if (candidate < distance) [best, distance] = [id, candidate];
    }
    return best;
  }

  /** @param {string} tag @param {MDCTag[]} tags */
  function tagColor(tag, tags) {
    const found = tags.find(candidate => candidate.name === tag);
    return found ? colorId(found.color) : "";
  }

  /**
   * The tag of a Google event: its private property, else the one tag whose Google color it has.
   * @param {any} event @param {MDCTag[]} tags
   */
  function eventTag(event, tags) {
    const stored = event.extendedProperties?.private?.mdcTag;
    if (typeof stored === "string") return stored;
    if (!event.colorId) return "";
    const matching = tags.filter(tag => colorId(tag.color) === String(event.colorId));
    return matching.length === 1 ? matching[0].name : "";
  }

  // ---------- Time zones ----------

  /** @type {Map<string, Intl.DateTimeFormat>} */
  const formatters = new Map();

  /** The local date and time of an instant in a time zone. @param {number} instant @param {string} timeZone */
  function zoned(instant, timeZone) {
    let formatter = formatters.get(timeZone);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
      formatters.set(timeZone, formatter);
    }
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(part => [part.type, part.value]));
    return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
  }

  /** The instant of a local date and time in a time zone. @param {string} date @param {string} time @param {string} timeZone */
  function instantOf(date, time, timeZone) {
    const wall = Date.parse(`${date}T${time}:00Z`);
    let guess = wall;
    for (let round = 0; round < 2; round += 1) {
      const local = zoned(guess, timeZone);
      guess += wall - Date.parse(`${local.date}T${local.time}:00Z`);
    }
    return guess;
  }

  /** @param {number} instant */
  const utcStamp = instant => new Date(instant).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

  // ---------- Fields ----------

  /** A note as one text: lines joined, blank lines around it dropped. @param {string[]} lines */
  function noteText(lines) {
    const text = lines.join("\n");
    return text.replace(/^(?:[ \t]*\n)+/, "").replace(/\s+$/, "");
  }

  /** A Google description as plain text; the web app may store simple HTML. @param {unknown} value */
  function descriptionText(value) {
    let text = typeof value === "string" ? value.replace(/\r\n?/g, "\n") : "";
    if (/<(?:br|p|div|span|b|i|u|a|ul|ol|li)\b[^>]*>/i.test(text)) {
      text = text.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(?:p|div|li)>/gi, "\n").replace(/<li\b[^>]*>/gi, "- ").replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/&amp;/g, "&");
    }
    return noteText(text.split("\n"));
  }

  /** @param {string} start @param {string} end */
  const timeText = (start, end) => end ? `${start}-${end}` : start;

  /**
   * The compared fields of a local item. @param {MDCSyncKind} kind @param {any} item @param {string} [key] the day of an entry
   * @returns {Record<string, string>}
   */
  function localFields(kind, item, key = "") {
    const common = { title: item.title, location: item.location, note: noteText(item.note) };
    if (kind === "entry") return { date: key, time: timeText(item.start, item.end), ...common, tag: item.tag };
    if (kind === "day-off") return { start: key || item.start, end: key || item.end, ...common };
    if (kind === "multi-day") return { start: item.start, end: item.end, ...common, tag: item.tag };
    return {
      start: `${item.start} ${timeText(item.startTime, item.endTime)}`, rule: app.recurrence.serializeRule(item.rule),
      except: item.except.join(","), ...common, tag: item.tag
    };
  }

  /** Fingerprints of fields, by field name. @param {Record<string, string>} fields @returns {MDCSyncFields} */
  function fingerprints(fields) {
    return Object.fromEntries(Object.entries(fields).map(([name, value]) => [name, history.fingerprint([value])]));
  }

  /** Names of the fields whose fingerprint differs. @param {MDCSyncFields} left @param {MDCSyncFields} right */
  const changedFields = (left, right) => Object.keys({ ...left, ...right }).filter(name => left[name] !== right[name]);

  // ---------- Local items ----------

  /**
   * The local items of the synchronization: those in range by sync ID, new ones without, and items with a sync ID that
   * left the range (docs/Domain.md#comparison). The first item with an ID keeps it; later ones count as new.
   * @param {MDCCalendar} calendar @param {MDCBacklog} backlog @returns {MDCSyncLocal}
   */
  function collect(calendar, backlog) {
    /** @type {Map<string, MDCSyncLocalItem>} */
    const items = new Map();
    /** @type {MDCSyncLocalItem[]} */
    const fresh = [];
    /** @type {Map<string, MDCSyncAway>} */
    const away = new Map();
    /** @type {string[]} */
    const duplicates = [];
    /** @param {MDCSyncLocalItem} item */
    const add = item => {
      if (item.id && (items.has(item.id) || away.has(item.id))) {
        duplicates.push(item.id);
        fresh.push({ ...item, id: "" });
      } else if (item.id) items.set(item.id, item);
      else fresh.push(item);
    };
    /** @param {string | undefined} id @param {MDCSyncAway} reason */
    const leave = (id, reason) => {
      if (!id) return;
      if (items.has(id) || away.has(id)) duplicates.push(id);
      else away.set(id, reason);
    };

    for (const key of Array.from(calendar.days.keys()).sort()) {
      /** @type {MDCDay} */ (calendar.days.get(key)).entries.forEach((entry, index) => {
        const ref = { key, index };
        const dayOff = entry.tag === app.calendar.dayOffTag;
        if (key < cutover) leave(entry.sync, { reason: "before-cutover", ref });
        else if (dayOff) add({ id: entry.sync || "", kind: "day-off", fields: localFields("day-off", entry, key), ref });
        else if (entry.start) add({ id: entry.sync || "", kind: "entry", fields: localFields("entry", entry, key), ref });
        else leave(entry.sync, { reason: "no-time", ref });
      });
    }
    calendar.multiDay.forEach((item, index) => {
      if ("raw" in item) return;
      const ref = { multiDay: index };
      if (item.end < cutover) leave(item.sync, { reason: "before-cutover", ref });
      else {
        const kind = item.tag === app.calendar.dayOffTag ? "day-off" : "multi-day";
        add({ id: item.sync || "", kind, fields: localFields(kind, item), ref });
      }
    });
    calendar.series.forEach((item, index) => {
      if ("raw" in item) return;
      const ref = { series: index };
      if (item.rule.until && item.rule.until < cutover) leave(item.sync, { reason: "before-cutover", ref });
      else if (item.startTime) add({ id: item.sync || "", kind: "series", fields: localFields("series", item), ref });
      else leave(item.sync, { reason: "no-time", ref });
    });
    const groups = [backlog.ungrouped, ...backlog.groups.map(group => group.entries)];
    groups.forEach((entries, group) => entries.forEach((entry, index) => leave(entry.sync, { reason: "backlog", ref: { key: "", group: group - 1, index } })));
    return { items, fresh, away, duplicates };
  }

  // ---------- Google events ----------

  /**
   * What a Google event is for the calendar (docs/Domain.md#what-is-synchronized).
   * @param {any} event @param {string} timeZone @param {MDCTag[]} tags @returns {MDCSyncRemote}
   */
  function fromEvent(event, timeZone, tags) {
    if (event.recurringEventId) return { state: "instance", master: String(event.recurringEventId) };
    if (event.status === "cancelled") return { state: "deleted" };
    const common = { title: String(event.summary || ""), location: String(event.location || ""), note: descriptionText(event.description) };
    if (event.recurrence) return { state: "series", fields: { ...common, tag: eventTag(event, tags) } };
    if (event.start?.date) {
      const start = String(event.start.date);
      const end = dates.addDays(String(event.end?.date || start), -1);
      return { state: "all-day", fields: { start, end: end < start ? start : end, ...common, tag: eventTag(event, tags) } };
    }
    const begin = zoned(Date.parse(event.start?.dateTime), timeZone);
    const finish = zoned(Date.parse(event.end?.dateTime || event.start?.dateTime), timeZone);
    const fields = { date: begin.date, time: timeText(begin.time, finish.time === begin.time && finish.date === begin.date ? "" : finish.time), ...common, tag: eventTag(event, tags) };
    if (finish.date !== begin.date) return { state: "several-days", fields };
    if (begin.date < cutover) return { state: "before-cutover", fields };
    return { state: "entry", fields };
  }

  /**
   * The Google event of a local item: the fields of docs/Domain.md#field-mapping, nothing else.
   * @param {MDCSyncKind} kind @param {Record<string, string>} fields @param {string} timeZone @param {MDCTag[]} tags @param {string} [tag]
   * @returns {Record<string, unknown>}
   */
  function toEvent(kind, fields, timeZone, tags, tag = kind === "day-off" ? app.calendar.dayOffTag : fields.tag || "") {
    const color = tagColor(tag, tags);
    const body = {
      summary: fields.title, location: fields.location, description: fields.note,
      colorId: color || null, extendedProperties: { private: { mdcTag: tag } }
    };
    if (kind === "entry") {
      const [start, end] = fields.time.split("-");
      return { ...body, start: { dateTime: `${fields.date}T${start}:00`, timeZone }, end: { dateTime: `${fields.date}T${end || start}:00`, timeZone } };
    }
    if (kind === "day-off" || kind === "multi-day") {
      return { ...body, start: { date: fields.start }, end: { date: dates.addDays(fields.end, 1) } };
    }
    const [date, times] = fields.start.split(" ");
    const [start, end] = times.split("-");
    const rule = fields.rule.replace(/;UNTIL=(\d{4})(\d{2})(\d{2})/, (_match, year, month, day) => `;UNTIL=${utcStamp(instantOf(`${year}-${month}-${day}`, "23:59", timeZone))}`);
    const except = fields.except ? fields.except.split(",").map(day => `EXDATE;TZID=${timeZone}:${day.replace(/-/g, "")}T${start.replace(":", "")}00`) : [];
    return {
      ...body,
      start: { dateTime: `${date}T${start}:00`, timeZone }, end: { dateTime: `${date}T${end || start}:00`, timeZone },
      recurrence: [`RRULE:${rule}`, ...except]
    };
  }

  // ---------- Comparison ----------

  /**
   * Classifies every difference between the calendar, Google and the state of the last synchronization
   * (docs/Domain.md#comparison). `events` are the events Google returned; with `full` they are all events of the calendar,
   * otherwise only those changed since the last query.
   * @param {{local: MDCSyncLocal, base: Record<string, MDCSyncItem>, events: any[], full: boolean, timeZone: string, tags: MDCTag[]}} input
   * @returns {MDCSyncComparison}
   */
  function compare({ local, base, events, full, timeZone, tags }) {
    /** @type {MDCSyncDifference[]} */
    const differences = [];
    /** @type {MDCSyncSame[]} */
    const same = [];
    /** IDs gone on both sides, whose recorded state is dropped. @type {string[]} */
    const forgotten = [];
    /** @type {Map<string, any>} */
    const remote = new Map();
    /** Series changed through one of their occurrences in Google. */
    const touched = new Set();
    for (const event of events) {
      if (event.recurringEventId) touched.add(String(event.recurringEventId));
      else remote.set(String(event.id), event);
    }

    let fresh = 0;
    /** @param {Omit<MDCSyncDifference, "preselected" | "key"> & {preselected?: MDCSyncChoice | null}} difference */
    const differ = difference => differences.push({ key: difference.id || `new:${fresh++}`, preselected: null, ...difference });

    const ids = new Set([...local.items.keys(), ...Object.keys(base), ...remote.keys(), ...touched]);
    for (const id of ids) {
      const mine = local.items.get(id);
      const known = base[id];
      const event = remote.get(id);
      const left = local.away.get(id);
      const kind = mine?.kind || known?.kind;
      const theirs = event ? fromEvent(event, timeZone, tags) : null;
      const gone = theirs?.state === "deleted" || (full && !event && Boolean(known));
      const etag = event?.etag ? String(event.etag) : known?.etag || "";
      const view = theirs && "fields" in theirs ? theirs.fields : null;
      const display = { calendar: mine?.fields || null, google: view, etag, ref: mine?.ref || left?.ref || null };

      if (!kind) {
        // Not ours: an event created in Google, or an occurrence of a series created there.
        if (!theirs || theirs.state === "deleted" || theirs.state === "before-cutover" || theirs.state === "instance") continue;
        if (theirs.state === "entry") differ({ id, kind: "entry", case: "new-google", choices: ["to-calendar"], preselected: "to-calendar", ...display });
        else differ({ id, kind: "entry", case: "note", reason: theirs.state, choices: [], ...display });
        continue;
      }

      if (exported.includes(kind)) {
        const changedThere = gone || touched.has(id) || Boolean(event && known && etag !== known.etag);
        if (!mine) {
          if (!known) continue;
          if (gone) {
            forgotten.push(id);
            continue;
          }
          if (left) differ({ id, kind, case: "left-local", reason: left.reason, choices: ["delete-google"], preselected: "delete-google", ...display });
          else if (!gone) differ({ id, kind, case: "deleted-local", choices: ["delete-google"], ...display });
          continue;
        }
        if (known && changedThere) differ({ id, kind, case: "export-changed", reason: gone ? "deleted" : "changed", choices: ["keep", "ignore"], ...display });
        else if (!known || changedFields(fingerprints(mine.fields), known.calendar).length) {
          differ({ id, kind, case: known ? "changed-local" : "new-local", choices: ["to-google"], preselected: "to-google", ...display });
        }
        continue;
      }

      // Entries with a time, in both directions.
      const theirState = !theirs ? (full ? "missing" : "unchanged") : theirs.state;
      if (!mine) {
        if (!known) continue;
        if (theirState === "deleted" || theirState === "missing") {
          forgotten.push(id);
          continue;
        }
        if (left) differ({ id, kind, case: "left-local", reason: left.reason, choices: ["delete-google"], preselected: "delete-google", ...display });
        else differ({ id, kind, case: "deleted-local", choices: ["delete-google"], ...display });
        continue;
      }
      const ours = fingerprints(mine.fields);
      if (theirState === "deleted" || theirState === "missing") {
        if (known) differ({ id, kind, case: "deleted-google", choices: ["delete-calendar", "to-google"], ...display });
        else differ({ id, kind, case: "new-local", choices: ["to-google"], preselected: "to-google", ...display });
        continue;
      }
      if (theirState !== "unchanged" && theirState !== "entry") {
        differ({ id, kind, case: "left-google", reason: theirState, choices: ["delete-calendar", "to-google"], ...display });
        continue;
      }
      const seen = known ? known.google || known.calendar : null;
      const mineChanged = seen ? changedFields(ours, /** @type {MDCSyncItem} */ (known).calendar) : [];
      if (theirState === "unchanged" || !view) {
        if (mineChanged.length) differ({ id, kind, case: "changed-local", changed: { calendar: mineChanged, google: [] }, choices: ["to-google"], preselected: "to-google", ...display });
        continue;
      }
      const there = fingerprints(view);
      const apart = changedFields(ours, there);
      if (!apart.length) {
        // Both sides agree, also when both changed the same way or nothing was recorded.
        if (!seen || mineChanged.length || changedFields(there, seen).length || known?.google) same.push({ id, kind, calendar: ours, etag });
        continue;
      }
      if (!seen) {
        differ({ id, kind, case: "conflict", changed: { calendar: apart, google: apart }, choices: ["to-calendar", "to-google"], ...display });
        continue;
      }
      const theirChanged = changedFields(there, seen);
      if (!theirChanged.length) differ({ id, kind, case: "changed-local", changed: { calendar: mineChanged, google: [] }, choices: ["to-google"], preselected: "to-google", ...display });
      else if (!mineChanged.length) differ({ id, kind, case: "changed-google", changed: { calendar: [], google: theirChanged }, choices: ["to-calendar"], preselected: "to-calendar", ...display });
      else {
        const both = mineChanged.filter(name => theirChanged.includes(name) && apart.includes(name));
        differ({
          id, kind, case: "conflict", changed: { calendar: mineChanged, google: theirChanged },
          choices: both.length ? ["to-calendar", "to-google"] : ["to-calendar", "combine", "to-google"], ...display
        });
      }
    }
    for (const item of local.fresh) {
      differ({ id: "", kind: item.kind, case: "new-local", choices: ["to-google"], preselected: "to-google", calendar: item.fields, google: null, etag: "", ref: item.ref });
    }
    differences.sort((left, right) => sortKey(left).localeCompare(sortKey(right)));
    return { differences, same, forgotten, duplicates: local.duplicates };
  }

  /** Day entries by date first, then series, then notes. @param {MDCSyncDifference} difference */
  function sortKey(difference) {
    const fields = difference.calendar || difference.google || {};
    const rank = difference.case === "note" ? "2" : difference.kind === "series" ? "1" : "0";
    return `${rank}${fields.date || fields.start || ""} ${fields.time || ""}`;
  }

  /**
   * The fields of a combined conflict: each field from the side that changed it (docs/Domain.md#comparison).
   * @param {MDCSyncDifference} difference
   */
  function combined(difference) {
    const calendar = /** @type {Record<string, string>} */ (difference.calendar);
    const google = /** @type {Record<string, string>} */ (difference.google);
    const fromGoogle = difference.changed?.google || [];
    return Object.fromEntries(Object.keys(calendar).map(name => [name, fromGoogle.includes(name) ? google[name] : calendar[name]]));
  }

  app.sync = { cutover, fieldsOf, colorId, eventTag, zoned, instantOf, localFields, fingerprints, collect, fromEvent, toEvent, compare, combined };
})(window.MDCalendar);
