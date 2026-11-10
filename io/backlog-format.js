window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Parser and serializer for Backlog.md (see docs/DataFormat.md#backlog).
(function (app) {
  const byteOrderMark = String.fromCharCode(0xFEFF);
  const inbox = "Inbox";

  /**
   * @param {string} text
   * @returns {{backlog: MDCBacklog, warnings: MDCFormatWarning[]}}
   */
  function parse(text) {
    const { entry: format } = app.calendarFormat;
    const source = text.startsWith(byteOrderMark) ? text.slice(1) : text;
    const newline = source.includes("\r\n") ? "\r\n" : "\n";
    const lines = source.split(/\r?\n/);
    if (lines.at(-1) === "") lines.pop();

    /** @type {MDCBacklog} */
    const backlog = { newline, head: [], groups: [] };
    /** @type {MDCFormatWarning[]} */
    const warnings = [];
    let hasHeader = false;
    /** @type {MDCBacklogGroup | null} */
    let group = null;
    /** @type {MDCEntry | null} */
    let entry = null;
    /** @type {string[]} */
    let extraTarget = backlog.head;

    lines.forEach((line, index) => {
      if (line.trim() === "") return;
      if (line === "# Backlog" && !hasHeader && !backlog.groups.length) {
        hasHeader = true;
        return;
      }
      if (line.startsWith("## ")) {
        group = { name: line.slice(3).trim(), entries: [], extra: [] };
        backlog.groups.push(group);
        entry = null;
        extraTarget = group.extra;
        return;
      }
      const item = format.pattern.exec(line);
      if (item && group && item[2].trim()) {
        entry = { done: item[1] !== " ", ...format.text(item[2]), location: "", note: [], extra: [] };
        group.entries.push(entry);
        extraTarget = entry.extra;
        return;
      }
      const subItem = format.subItemPattern.exec(line);
      if (subItem && entry && !entry.extra.length) {
        if (subItem[1].startsWith(format.locationPrefix) && !entry.location && !entry.note.length) entry.location = subItem[1].slice(format.locationPrefix.length);
        else entry.note.push(subItem[1]);
        return;
      }
      warnings.push({ lineNumber: index + 1, kind: group ? "unknown-line" : "outside-day", text: line });
      extraTarget.push(line);
    });

    if (!hasHeader) warnings.unshift({ lineNumber: 1, kind: "missing-header", text: lines[0] || "" });
    // The Inbox group always exists (docs/Domain.md#backlog).
    if (!backlog.groups.some(candidate => candidate.name === inbox)) backlog.groups.unshift({ name: inbox, entries: [], extra: [] });
    return { backlog, warnings };
  }

  /** @param {MDCBacklog} backlog */
  function serialize(backlog) {
    const lines = ["# Backlog", ...backlog.head];
    for (const group of backlog.groups) {
      lines.push("", `## ${group.name}`, ...group.extra);
      for (const entry of group.entries) lines.push(...app.calendarFormat.entry.lines(entry));
    }
    return lines.join(backlog.newline) + backlog.newline;
  }

  app.backlogFormat = { parse, serialize, inbox };
})(window.MDCalendar);
