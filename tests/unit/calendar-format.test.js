const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const load = require("./load-classic");

const { calendarFormat } = load("domain/calendar.js", "domain/recurrence.js", "io/calendar-format.js");
const golden = fs.readFileSync(path.join(__dirname, "../../data/parsing/Calendar.md"), "utf8");

/** Copies values out of the script context so that strict deep equality works across realms. @param {unknown} value */
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("the golden file round-trips byte for byte", () => {
  const { calendar } = calendarFormat.parse(golden);
  assert.equal(calendarFormat.serialize(calendar), golden);
});

test("golden entries carry done state, time, title, tag, location and note", () => {
  const { calendar } = calendarFormat.parse(golden);
  assert.deepEqual(Array.from(calendar.days.keys()), ["2026-01-01", "2026-11-12", "2026-11-20", "2026-12-28", "2027-01-04"]);
  assert.deepEqual(plain(calendar.days.get("2026-11-12").entries), [
    { done: false, start: "", end: "", title: "Sort tax documents", tag: "", location: "", note: [], extra: [] },
    { done: false, start: "09:30", end: "10:15", title: "Dentist", tag: "Private", location: "Dr. Example's practice", note: ["- Bring the bonus booklet"], extra: [], sync: "k3v9q2ab" },
    { done: true, start: "14:00", end: "", title: "Hairdresser", tag: "", location: "", note: [], extra: [] },
    { done: false, start: "", end: "", title: "Gift for Clara: book \"Momo\" & card", tag: "Private", location: "", note: ["- First note line", "", "- Second note line"], extra: [] }
  ]);
  assert.deepEqual(plain(calendar.multiDay.map((/** @type {any} */ item) => [item.title, item.tag, item.start, item.end, item.location, item.note])), [
    ["Vacation", "Private", "2026-11-20", "2026-11-24", "", []],
    ["Trade fair", "Work", "2026-11-20", "2026-11-21", "Koelnmesse", ["Booth B12."]],
    ["Training", "", "2026-11-30", "2026-12-02", "", []],
    ["Ski trip", "Private", "2026-12-28", "2027-01-03", "", []]
  ]);
  const review = plain(calendar.series[5]);
  assert.deepEqual(review, {
    id: "", title: "Sprint review", tag: "Work", start: "2026-11-16", startTime: "14:00", endTime: "15:00",
    rule: { freq: "WEEKLY", interval: 2, byDay: ["MO"], byMonthDay: 0, until: "" },
    except: ["2026-12-28"], done: ["2026-11-16", "2026-11-30"], location: "Meeting room 2",
    note: ["Demo the new calendar.", "Collect feedback."], extra: []
  });
  assert.equal(calendar.series[1].rule.until, "2026-12-31");
  assert.deepEqual([calendar.multiDay[1].sync, calendar.series[4].sync, calendar.series[4].id], ["t7m2p4qd", "4c8n1kre", "gym"]);
});

test("a sync ID is read only at the end of an entry line, after the tag", () => {
  const day = (/** @type {string[]} */ ...lines) => calendarFormat.parse(["# Calendar", "", "## November 2026", "", "### 30.11.2026", ...lines, ""].join("\n"));
  const { calendar, warnings } = day(
    "- [ ] 10:00 Call {sync=ab12}",
    "- [ ] Read {sync=ab12} later #Work",
    "- [ ] Bad id #Work {sync=xyz}",
    "- [ ] Glued{sync=cd34}"
  );
  assert.deepEqual(plain(calendar.days.get("2026-11-30").entries.map((/** @type {any} */ entry) => [entry.title, entry.tag, entry.sync ?? ""])), [
    ["Call", "", "ab12"], ["Read {sync=ab12} later", "Work", ""], ["Bad id #Work {sync=xyz}", "", ""], ["Glued{sync=cd34}", "", ""]
  ]);
  assert.deepEqual(plain(warnings), []);
  assert.equal(calendarFormat.serialize(calendar).split("\n")[5], "- [ ] 10:00 Call {sync=ab12}");
});

test("a sync ID used twice is reported and kept; an invalid #Sync makes the item unreadable", () => {
  const source = [
    "# Calendar", "", "## November 2026", "", "### 30.11.2026", "- [ ] 10:00 A {sync=ab12}", "- [ ] 11:00 B {sync=ab12}", "",
    "## Multi-day", "", "### Broken", "#Sync", "- not valid", "#Start", "- 01.12.2026", "#End", "- 02.12.2026", "",
    "### Trip", "#Sync", "- ab12", "#Start", "- 01.12.2026", "#End", "- 02.12.2026", ""
  ].join("\n");
  const { calendar, warnings } = calendarFormat.parse(source);
  assert.deepEqual(plain(warnings).map((/** @type {any} */ warning) => [warning.lineNumber, warning.kind]), [[7, "duplicate-sync"], [11, "invalid-item"], [19, "duplicate-sync"]]);
  // The unreadable item follows the readable ones.
  const lines = source.split("\n");
  assert.equal(calendarFormat.serialize(calendar), [...lines.slice(0, 10), ...lines.slice(18, 26), ...lines.slice(10, 18)].join("\n"));
});

test("a day off with a time is reported and written without it", () => {
  const source = "# Calendar\n\n## November 2026\n\n### 30.11.2026\n- [ ] 08:00 - 12:00 Overtime #DayOff\n";
  const { calendar, warnings } = calendarFormat.parse(source);
  assert.deepEqual(plain(warnings).map((/** @type {any} */ warning) => [warning.lineNumber, warning.kind]), [[6, "day-off-time"]]);
  assert.equal(calendarFormat.serialize(calendar), "# Calendar\n\n## November 2026\n\n### 30.11.2026\n- [ ] Overtime #DayOff\n");
});

test("a blank line inside a note is an empty note line; blank lines around the note are not part of it", () => {
  const text = "# Calendar\n\n## November 2026\n\n### 12.11.2026\n- [ ] A\n  - Location: X\n\n  one\n\n\n  two\n\n- [ ] B\n";
  const { calendar } = calendarFormat.parse(text);
  const [a, b] = calendar.days.get("2026-11-12").entries;
  assert.deepEqual([a.location, plain(a.note), plain(b.note)], ["X", ["one", "", "", "two"], []]);
  assert.equal(calendarFormat.serialize(calendar), "# Calendar\n\n## November 2026\n\n### 12.11.2026\n- [ ] A\n  - Location: X\n  one\n\n\n  two\n- [ ] B\n");
});

test("an unknown line is reported and written back at its place", () => {
  const { calendar, warnings } = calendarFormat.parse(golden);
  const lineNumber = golden.split("\n").indexOf("This line is not understood by the parser and is preserved") + 1;
  assert.deepEqual(plain(warnings), [{ lineNumber, kind: "unknown-line", text: "This line is not understood by the parser and is preserved" }]);
  assert.deepEqual(plain(calendar.days.get("2026-12-28").entries[0].extra), ["This line is not understood by the parser and is preserved"]);
});

test("days are written chronologically under their correct month", () => {
  const source = [
    "# Calendar", "",
    "## November 2026", "",
    "### 03.12.2026", "- [ ] Late", "",
    "### 02.11.2026", "- [ ] Second", "",
    "## January 2026", "",
    "### 02.11.2026", "- [ ] Merged", ""
  ].join("\n");
  const { warnings, calendar } = calendarFormat.parse(source);
  assert.deepEqual(plain(warnings), []);
  assert.equal(calendarFormat.serialize(calendar), [
    "# Calendar", "",
    "## November 2026", "",
    "### 02.11.2026", "- [ ] Second", "- [ ] Merged", "",
    "## December 2026", "",
    "### 03.12.2026", "- [ ] Late", ""
  ].join("\n"));
});

test("invalid dates and lines outside a day are reported and preserved", () => {
  const source = [
    "# Calendar", "loose text", "",
    "## February 2026", "",
    "### 31.02.2026", "- [ ] Lost day", "",
    "### 01.02.2026", "- [ ] Kept", ""
  ].join("\n");
  const { warnings, calendar } = calendarFormat.parse(source);
  assert.deepEqual(plain(warnings).map((/** @type {any} */ warning) => [warning.lineNumber, warning.kind]), [
    [2, "outside-day"], [6, "invalid-date"], [7, "outside-day"]
  ]);
  const output = calendarFormat.serialize(calendar);
  for (const line of ["loose text", "### 31.02.2026", "- [ ] Lost day", "- [ ] Kept"]) assert.ok(output.includes(line), line);
  assert.deepEqual(plain(calendarFormat.parse(output).warnings).length, 3);
});

test("CRLF line endings are kept", () => {
  const source = golden.replaceAll("\n", "\r\n");
  assert.equal(calendarFormat.serialize(calendarFormat.parse(source).calendar), source);
});

test("multi-day and recurring items that cannot be understood stay verbatim", () => {
  const source = [
    "# Calendar", "",
    "## Recurring", "",
    "### Broken rule", "#Start", "- 01.01.2026", "#Repeat", "- FREQ=HOURLY", "",
    "### Fine", "#Start", "- 01.01.2026", "#Repeat", "- FREQ=DAILY", "#Unknown", "- kept", "",
    "## Multi-day", "",
    "### Backwards", "#Start", "- 05.01.2026", "#End", "- 01.01.2026", ""
  ].join("\n");
  const { calendar, warnings } = calendarFormat.parse(source);
  assert.deepEqual(plain(warnings).map((/** @type {any} */ warning) => [warning.lineNumber, warning.kind]), [
    [5, "invalid-item"], [16, "unknown-line"], [17, "unknown-line"], [21, "invalid-item"]
  ]);
  assert.equal(calendarFormat.serialize(calendar), [
    "# Calendar", "",
    "## Multi-day", "",
    "### Backwards", "#Start", "- 05.01.2026", "#End", "- 01.01.2026", "",
    "## Recurring", "",
    "### Broken rule", "#Start", "- 01.01.2026", "#Repeat", "- FREQ=HOURLY", "",
    "### Fine", "#Start", "- 01.01.2026", "#Repeat", "- FREQ=DAILY", "#Unknown", "- kept", ""
  ].join("\n"));
});
