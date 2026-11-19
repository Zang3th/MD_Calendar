const assert = require("node:assert/strict");
const test = require("node:test");
const load = require("./load-classic");

const app = load("domain/calendar.js", "domain/recurrence.js", "domain/backlog.js", "domain/search.js",
  "io/calendar-format.js", "io/backlog-format.js", "io/ics.js");

/** @param {unknown} value */
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

const calendarText = "# Calendar\n\n## November 2026\n\n### 02.11.2026\n- [ ] Dentist Müller\n\n### 20.11.2026\n- [ ] Dentist appointment\n  - Location: Practice\n\n" +
  "## Recurring\n\n### Physio #Physio\n#Start\n- 05.11.2026\n#Repeat\n- FREQ=WEEKLY;BYDAY=TH\n";

// Matching and ranking are tested in MD_Libs core/search; these tests cover the calendar index and its options.
test("search covers title, location and tag of every kind, ignores diacritics and needs every word", () => {
  const { calendar } = app.calendarFormat.parse(calendarText);
  const { backlog } = app.backlogFormat.parse("# Backlog\n\n## Health\n- [ ] Call the doctor #Health\n");
  const titles = (/** @type {string} */ query) => plain(app.search.search(calendar, backlog, 1, query, "2026-11-12", 10)).map((/** @type {any} */ hit) => hit.title);
  assert.deepEqual(titles("dentist"), ["Dentist Müller", "Dentist appointment"]);
  assert.deepEqual(titles("muller"), ["Dentist Müller"]);
  assert.deepEqual(titles("dntst"), ["Dentist Müller", "Dentist appointment"]);
  assert.deepEqual(titles("practice"), ["Dentist appointment"]);
  assert.deepEqual(titles("call doctor"), ["Call the doctor"]);
  assert.deepEqual(titles("physio"), ["Physio"]);
  assert.equal(app.search.nextOccurrence(calendar.series[0], "2026-11-13"), "2026-11-19");
});

test("equally good hits closer to today come first; a title hit outranks a hit elsewhere", () => {
  const { calendar } = app.calendarFormat.parse("# Calendar\n\n## November 2026\n\n### 01.11.2026\n- [ ] Yoga\n\n### 03.11.2026\n- [ ] Run\n  - Location: Yoga studio\n\n### 13.11.2026\n- [ ] Yoga\n");
  const { backlog } = app.backlogFormat.parse("# Backlog\n");
  const hits = plain(app.search.search(calendar, backlog, 2, "yoga", "2026-11-12", 10)).map((/** @type {any} */ hit) => [hit.title, hit.key]);
  assert.deepEqual(hits, [["Yoga", "2026-11-13"], ["Yoga", "2026-11-01"], ["Run", "2026-11-03"]]);
});

test("ICS events become entries, multi-day entries and series; past ones are done; duplicates are skipped", () => {
  const ics = [
    "BEGIN:VCALENDAR", "BEGIN:VEVENT", "UID:a", "DTSTART;VALUE=DATE:20261102", "DTEND;VALUE=DATE:20261103", "SUMMARY:Holiday\\, off", "END:VEVENT",
    "BEGIN:VEVENT", "UID:b", "DTSTART;TZID=Europe/Berlin:20261120T093000", "DTEND;TZID=Europe/Berlin:20261120T103000", "SUMMARY:Meeting", "LOCATION:Office", "DESCRIPTION:Line 1\\nLine 2", "END:VEVENT",
    "BEGIN:VEVENT", "UID:c", "DTSTART;VALUE=DATE:20261214", "DTEND;VALUE=DATE:20261219", "SUMMARY:Vacation", "END:VEVENT",
    "BEGIN:VEVENT", "UID:d", "DTSTART;TZID=Europe/Berlin:20261105T180000", "DTEND;TZID=Europe/Berlin:20261105T190000",
    "RRULE:FREQ=WEEKLY;WKST=MO;COUNT=3;BYDAY=TH", "SUMMARY:Karate", "END:VEVENT",
    "BEGIN:VEVENT", "UID:d", "RECURRENCE-ID;TZID=Europe/Berlin:20261112T180000", "DTSTART;TZID=Europe/Berlin:20261113T180000", "SUMMARY:Karate (moved)", "END:VEVENT",
    "BEGIN:VEVENT", "UID:e", "DTSTART;VALUE=DATE:20261101", "SUMMARY:Cancelled", "STATUS:CANCELLED", "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
  const { events, skipped } = app.ics.parse(ics);
  assert.equal(skipped, 1);
  const { calendar } = app.calendarFormat.parse("# Calendar\n\n## November 2026\n\n### 13.11.2026\n- [ ] Karate (moved)\n");
  const result = app.calendar.importEvents(calendar, events, "2026-11-12");
  assert.deepEqual([result.entries, result.series, result.multiDay, result.duplicates], [2, 1, 1, 1]);
  result.action.redo();
  assert.equal(app.calendarFormat.serialize(calendar),
    "# Calendar\n\n## November 2026\n\n### 02.11.2026\n- [x] Holiday, off\n\n### 13.11.2026\n- [ ] Karate (moved)\n\n### 20.11.2026\n- [ ] 09:30 - 10:30 Meeting\n  - Location: Office\n  - Line 1\n  - Line 2\n\n" +
    "## Multi-day\n\n### Vacation\n#Start\n- 14.12.2026\n#End\n- 18.12.2026\n\n" +
    "## Recurring\n\n### Karate\n#Start\n- 05.11.2026 18:00 - 19:00\n#Repeat\n- FREQ=WEEKLY;BYDAY=TH;UNTIL=20261119\n#Except\n- 12.11.2026\n");
  result.action.undo();
  assert.equal(app.calendarFormat.serialize(calendar), "# Calendar\n\n## November 2026\n\n### 13.11.2026\n- [ ] Karate (moved)\n");
});

test("several selected entries move together into one place as one action", () => {
  const { calendar } = app.calendarFormat.parse("# Calendar\n\n## November 2026\n\n### 12.11.2026\n- [ ] A\n- [ ] B\n- [ ] C\n\n### 13.11.2026\n- [ ] D\n");
  const { backlog } = app.backlogFormat.parse("# Backlog\n\n## Home\n- [ ] E #Home\n");
  const action = app.backlog.moveEntries(calendar, backlog, [{ key: "2026-11-12", index: 2 }, { key: "2026-11-12", index: 0 }, { key: "", group: 0, index: 0 }], { key: "2026-11-13", index: 0 });
  assert.equal(action.target, "Calendar.md");
  action.redo();
  const titles = (/** @type {string} */ key) => plain(app.calendar.entries(calendar, key)).map((/** @type {any} */ entry) => entry.title);
  assert.deepEqual([titles("2026-11-12"), titles("2026-11-13"), backlog.groups[0].entries.length], [["B"], ["A", "C", "E", "D"], 0]);
  action.undo();
  assert.deepEqual([titles("2026-11-12"), titles("2026-11-13"), backlog.groups[0].entries.length], [["A", "B", "C"], ["D"], 1]);
});
