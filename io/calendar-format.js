import { markdown } from "@zang3th/md-libs/core";

window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Parser and serializer for Calendar.md (see docs/DataFormat.md#calendar).
(function (app) {
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const multiDayHeading = "## Multi-day";
  const seriesHeading = "## Recurring";
  const entryPattern = /^- \[([ xX])\] (.*)$/;
  /** The position of an occurrence placed by hand in a day (docs/DataFormat.md#calendar). */
  const pinPattern = /^- @(\S+)$/;
  const idPattern = /^\S+$/;
  /** An indented line below an entry: up to two spaces or one tab of indentation are cut off, the rest is kept as written. */
  const subLinePattern = /^(?: {1,2}|\t)(.*\S.*)$/;
  const timePattern = /^([01]\d|2[0-3]):([0-5]\d)(?: - ([01]\d|2[0-3]):([0-5]\d))? (.+)$/;
  const seriesStartPattern = /^(\d{2}\.\d{2}\.\d{4})(?: ([01]\d|2[0-3]):([0-5]\d)(?: - ([01]\d|2[0-3]):([0-5]\d))?)?$/;
  const locationPrefix = "Location: ";
  const blockKeys = {
    multiDay: ["Start", "End", "Location", "Note"],
    series: ["Id", "Start", "Repeat", "Except", "Done", "Location", "Note"]
  };

  const { parseDate: dayKey, formatDate: displayDate } = app.calendar;

  /** @param {string} value */
  function titleAndTag(value) {
    const { text: title, tag } = markdown.trailingTag(value);
    return { title, tag };
  }

  /** @param {string} value @returns {Omit<MDCEntry, "done" | "location" | "note" | "extra">} */
  function entryText(value) {
    let start = "";
    let end = "";
    let rest = value;
    const time = timePattern.exec(rest);
    if (time) {
      start = `${time[1]}:${time[2]}`;
      end = time[3] ? `${time[3]}:${time[4]}` : "";
      rest = time[5];
    }
    return { start, end, ...titleAndTag(rest) };
  }

  /** @param {string[]} lines */
  function trimTrailingBlanks(lines) {
    while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
    return lines;
  }

  /**
   * Parses one ### item of ## Multi-day or ## Recurring. Returns null when it cannot be understood.
   * @param {"multiDay" | "series"} kind @param {string[]} lines @param {number} firstLine @param {MDCFormatWarning[]} warnings
   * @returns {MDCMultiDay | MDCSeries | null}
   */
  function parseItem(kind, lines, firstLine, warnings) {
    const { title, tag } = titleAndTag(lines[0].slice(4).trim());
    if (!title) return null;
    /** @type {Record<string, string[]>} */
    const values = {};
    /** @type {string[]} */
    const note = [];
    /** @type {string[]} */
    const extra = [];
    /** @type {MDCFormatWarning[]} */
    const itemWarnings = [];
    for (const line of markdown.keyBlocks(lines.slice(1), { keys: blockKeys[kind], prose: ["Note"] })) {
      if (line.type === "key") values[line.key] = [];
      else if (line.type === "item") values[line.key].push(line.value);
      else if (line.type === "prose") note.push(line.text);
      else {
        extra.push(line.text);
        itemWarnings.push({ lineNumber: firstLine + line.index + 2, kind: "unknown-line", text: line.text });
      }
    }
    trimTrailingBlanks(note);
    const single = (/** @type {string} */ name) => values[name]?.length === 1 ? values[name][0] : null;
    const location = values.Location ? single("Location") : "";
    if (location === null) return null;

    if (kind === "multiDay") {
      const start = dayKey(single("Start") || "");
      const end = dayKey(single("End") || "");
      if (!start || !end || end < start) return null;
      warnings.push(...itemWarnings);
      return { title, tag, start, end, location, note, extra };
    }

    const id = values.Id ? single("Id") : "";
    if (id === null || (id && !idPattern.test(id))) return null;
    const startMatch = seriesStartPattern.exec(single("Start") || "");
    const start = startMatch ? dayKey(startMatch[1]) : "";
    const rule = app.recurrence.parseRule(single("Repeat") || "");
    const except = (values.Except || []).map(dayKey);
    const done = (values.Done || []).map(dayKey);
    if (!startMatch || !start || !rule || except.includes("") || done.includes("")) return null;
    warnings.push(...itemWarnings);
    return {
      id, title, tag, start,
      startTime: startMatch[2] ? `${startMatch[2]}:${startMatch[3]}` : "",
      endTime: startMatch[4] ? `${startMatch[4]}:${startMatch[5]}` : "",
      rule, except, done, location, note, extra
    };
  }

  /**
   * Parses the lines of a ## Multi-day or ## Recurring section into the calendar.
   * @param {MDCCalendar} calendar @param {"multiDay" | "series"} kind
   * @param {Array<{line: string, index: number}>} section @param {MDCFormatWarning[]} warnings
   * @param {Map<object, number>} headings line index of each parsed item's heading
   */
  function parseSection(calendar, kind, section, warnings, headings) {
    const list = /** @type {Array<MDCMultiDay | MDCSeries | MDCRawBlock>} */ (kind === "multiDay" ? calendar.multiDay : calendar.series);
    const head = kind === "multiDay" ? calendar.multiDayHead : calendar.seriesHead;
    /** @type {Array<{line: string, index: number}> | null} */
    let item = null;
    const flush = () => {
      if (!item) return;
      const lines = trimTrailingBlanks(item.map(entry => entry.line));
      const parsed = parseItem(kind, lines, item[0].index, warnings);
      if (parsed) {
        list.push(parsed);
        headings.set(parsed, item[0].index);
      } else {
        list.push({ raw: lines });
        warnings.push({ lineNumber: item[0].index + 1, kind: "invalid-item", text: lines[0] });
      }
    };
    for (const entry of section) {
      if (entry.line.startsWith("### ")) {
        flush();
        item = [entry];
      } else if (item) item.push(entry);
      else if (entry.line.trim() !== "") {
        head.push(entry.line);
        warnings.push({ lineNumber: entry.index + 1, kind: "unknown-line", text: entry.line });
      }
    }
    flush();
  }

  /**
   * @param {string} source
   * @returns {{calendar: MDCCalendar, warnings: MDCFormatWarning[]}}
   */
  function parse(source) {
    const { lines, newline } = markdown.split(source);

    /** @type {MDCCalendar} */
    const calendar = { newline, head: [], days: new Map(), multiDay: [], series: [], multiDayHead: [], seriesHead: [], seriesRevision: 0 };
    /** @type {MDCFormatWarning[]} */
    const warnings = [];
    let hasHeader = false;
    /** @type {MDCDay | null} */
    let day = null;
    /** @type {MDCEntry | null} */
    let entry = null;
    /** @type {{kind: "multiDay" | "series", lines: Array<{line: string, index: number}>} | null} */
    let section = null;
    /** @type {string[]} */
    let extraTarget = calendar.head;

    /** @param {number} index @param {MDCFormatWarningKind} kind @param {string} line */
    function preserve(index, kind, line) {
      warnings.push({ lineNumber: index + 1, kind, text: line });
      extraTarget.push(line);
    }

    /** @type {Map<object, number>} */
    const headings = new Map();
    /** References to placed occurrences, resolved once the series are known. @type {Array<{day: MDCDay, id: string, at: number, target: string[], position: number, line: string, index: number}>} */
    const references = [];

    function closeSection() {
      if (section) parseSection(calendar, section.kind, section.lines, warnings, headings);
      section = null;
    }

    lines.forEach((line, index) => {
      if (line.startsWith("## ")) {
        closeSection();
        day = null;
        entry = null;
        const name = line.trim();
        if (name === multiDayHeading || name === seriesHeading) {
          section = { kind: name === multiDayHeading ? "multiDay" : "series", lines: [] };
          return;
        }
        const month = /^## (\w+) (\d{4})$/.exec(name);
        if (!month || !months.includes(month[1])) preserve(index, "unknown-heading", line);
        return;
      }
      if (section) {
        section.lines.push({ line, index });
        return;
      }
      if (line.trim() === "") {
        if (entry) subLine(entry, line);
        return;
      }
      if (line === "# Calendar" && !hasHeader && !calendar.days.size) {
        hasHeader = true;
        return;
      }
      if (line.startsWith("### ")) {
        entry = null;
        const key = dayKey(line.slice(4).trim());
        if (!key) {
          day = null;
          preserve(index, "invalid-date", line);
          return;
        }
        day = calendar.days.get(key) || null;
        if (!day) {
          day = { key, entries: [], pins: [], extra: [] };
          calendar.days.set(key, day);
        }
        extraTarget = day.extra;
        return;
      }
      const reference = day ? pinPattern.exec(line) : null;
      if (reference && day) {
        // Kept like an unknown line until it is resolved below.
        references.push({ day, id: reference[1], at: day.entries.length, target: extraTarget, position: extraTarget.length, line, index });
        extraTarget.push(line);
        return;
      }
      const item = entryPattern.exec(line);
      if (item && day && item[2].trim()) {
        entry = { done: item[1] !== " ", ...entryText(item[2]), location: "", note: [], extra: [] };
        day.entries.push(entry);
        extraTarget = entry.extra;
        return;
      }
      if (entry && subLine(entry, line)) return;
      preserve(index, day ? "unknown-line" : "outside-day", line);
    });
    closeSection();
    resolveReferences(calendar, references, headings, warnings);

    if (!hasHeader) warnings.unshift({ lineNumber: 1, kind: "missing-header", text: lines[0] || "" });
    warnings.sort((left, right) => left.lineNumber - right.lineNumber);
    return { calendar, warnings };
  }

  /**
   * Turns the references of the days into pins (docs/DataFormat.md#calendar). A reference to an ID of no series, to a day
   * without an occurrence of that series, or repeated in one day is reported and stays as an unknown line. A series that
   * repeats the ID of an earlier one is reported; references resolve to the first.
   * @param {MDCCalendar} calendar @param {Array<{day: MDCDay, id: string, at: number, target: string[], position: number, line: string, index: number}>} references
   * @param {Map<object, number>} headings @param {MDCFormatWarning[]} warnings
   */
  function resolveReferences(calendar, references, headings, warnings) {
    /** @type {Map<string, MDCSeries>} */
    const ids = new Map();
    for (const series of calendar.series) {
      if ("raw" in series || !series.id) continue;
      if (ids.has(series.id)) warnings.push({ lineNumber: (headings.get(series) ?? 0) + 1, kind: "unknown-line", text: `#Id ${series.id}` });
      else ids.set(series.id, series);
    }
    /** @type {Map<string[], number[]>} */
    const resolved = new Map();
    for (const reference of references) {
      const series = ids.get(reference.id);
      const holds = series && !series.except.includes(reference.day.key) && app.recurrence.occursOn(series.rule, series.start, reference.day.key);
      if (!holds || reference.day.pins.some(pin => pin.id === reference.id)) {
        warnings.push({ lineNumber: reference.index + 1, kind: "unknown-line", text: reference.line });
        continue;
      }
      reference.day.pins.push({ id: reference.id, at: reference.at });
      resolved.set(reference.target, [...(resolved.get(reference.target) || []), reference.position]);
    }
    for (const [target, positions] of resolved) {
      // The kept lines leave their lists from the back, so that the positions stay valid.
      for (const position of positions.sort((left, right) => right - left)) target.splice(position, 1);
    }
  }

  /** Blank lines read after a note line, by entry; they become note lines only when another note line follows. */
  const pendingBlanks = new WeakMap();

  /**
   * Takes an indented line below an entry: “- Location: …” as the first one is the location, every other one is a note
   * line exactly as written. A blank line inside the note is an empty note line; blank lines before or after the note
   * are not part of it. Returns false for a line that is not indented or follows an unknown line.
   * @param {MDCEntry} entry @param {string} line
   */
  function subLine(entry, line) {
    if (entry.extra.length) return false;
    if (line.trim() === "") {
      if (entry.note.length) pendingBlanks.set(entry, (pendingBlanks.get(entry) || 0) + 1);
      return true;
    }
    const match = subLinePattern.exec(line);
    if (!match) return false;
    if (match[1].startsWith(`- ${locationPrefix}`) && !entry.location && !entry.note.length) entry.location = match[1].slice(locationPrefix.length + 2);
    else {
      entry.note.push(...Array.from({ length: pendingBlanks.get(entry) || 0 }, () => ""), match[1]);
      pendingBlanks.delete(entry);
    }
    return true;
  }

  /** @param {MDCEntry} entry */
  function entryLines(entry) {
    const time = entry.start ? `${entry.start}${entry.end ? ` - ${entry.end}` : ""} ` : "";
    const tag = entry.tag ? ` #${entry.tag}` : "";
    const lines = [`- [${entry.done ? "x" : " "}] ${time}${entry.title}${tag}`];
    if (entry.location) lines.push(`  - ${locationPrefix}${entry.location}`);
    for (const note of entry.note) lines.push(note ? `  ${note}` : "");
    return lines.concat(entry.extra);
  }

  /** @param {MDCMultiDay | MDCSeries} item @param {Array<[string, string[]]>} blocks */
  function itemLines(item, blocks) {
    const lines = [`### ${item.title}${item.tag ? ` #${item.tag}` : ""}`];
    if ("id" in item && item.id) lines.push("#Id", `- ${item.id}`);
    for (const [name, values] of blocks) {
      if (values.length) lines.push(`#${name}`, ...values.map(value => `- ${value}`));
    }
    if (item.location) lines.push("#Location", `- ${item.location}`);
    if (item.note.length) lines.push("#Note", ...item.note);
    return lines.concat(item.extra);
  }

  /** @param {MDCMultiDay | MDCRawBlock} item */
  function multiDayLines(item) {
    if ("raw" in item) return item.raw;
    return itemLines(item, [["Start", [displayDate(item.start)]], ["End", [displayDate(item.end)]]]);
  }

  /** @param {MDCSeries | MDCRawBlock} item */
  function seriesLines(item) {
    if ("raw" in item) return item.raw;
    const time = item.startTime ? ` ${item.startTime}${item.endTime ? ` - ${item.endTime}` : ""}` : "";
    return itemLines(item, [
      ["Start", [`${displayDate(item.start)}${time}`]],
      ["Repeat", [app.recurrence.serializeRule(item.rule)]],
      ["Except", item.except.map(displayDate)],
      ["Done", item.done.map(displayDate)]
    ]);
  }

  /** @param {MDCCalendar} calendar */
  function serialize(calendar) {
    const lines = ["# Calendar", ...calendar.head];
    let month = "";
    const keys = Array.from(calendar.days.keys()).sort();
    for (const key of keys) {
      const day = /** @type {MDCDay} */ (calendar.days.get(key));
      if (!day.entries.length && !day.extra.length && !day.pins.length) continue;
      const dayMonth = key.slice(0, 7);
      if (dayMonth !== month) {
        month = dayMonth;
        lines.push("", `## ${months[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`);
      }
      lines.push("", `### ${displayDate(key)}`, ...day.extra);
      // Placed occurrences stand before the entry at their position (docs/DataFormat.md#calendar).
      let pin = 0;
      const pinsUpTo = (/** @type {number} */ at) => {
        for (; pin < day.pins.length && day.pins[pin].at <= at; pin += 1) lines.push(`- @${day.pins[pin].id}`);
      };
      day.entries.forEach((entry, index) => {
        pinsUpTo(index);
        lines.push(...entryLines(entry));
      });
      pinsUpTo(Infinity);
    }
    if (calendar.multiDay.length || calendar.multiDayHead.length) {
      // Ordered by start date; equal start dates keep their stored order. Unreadable items follow.
      const ordered = [...calendar.multiDay].sort((left, right) =>
        ("raw" in left ? "~" : left.start).localeCompare("raw" in right ? "~" : right.start));
      lines.push("", multiDayHeading, ...calendar.multiDayHead);
      for (const item of ordered) lines.push("", ...multiDayLines(item));
    }
    if (calendar.series.length || calendar.seriesHead.length) {
      lines.push("", seriesHeading, ...calendar.seriesHead);
      for (const item of calendar.series) lines.push("", ...seriesLines(item));
    }
    return lines.join(calendar.newline) + calendar.newline;
  }

  // Entry lines are shared with Backlog.md (see docs/DataFormat.md#backlog).
  const entry = { pattern: entryPattern, text: entryText, subLine, lines: entryLines };

  app.calendarFormat = { parse, serialize, entry };
})(window.MDCalendar);
