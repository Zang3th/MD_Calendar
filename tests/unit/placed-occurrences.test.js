const assert = require("node:assert/strict");
const test = require("node:test");
const load = require("./load-classic");

const app = load("domain/calendar.js", "domain/recurrence.js", "domain/backlog.js", "io/calendar-format.js");

const header = "# Calendar\n\n## November 2026\n\n";
// Thursday 12 and Friday 13 November 2026; Lorem ipsum is on Tuesdays and Thursdays, Vitamins daily.
const series = "## Recurring\n\n### Lorem ipsum\n#Id\n- lorem-ipsum\n#Start\n- 05.11.2026 18:30 - 20:00\n#Repeat\n- FREQ=WEEKLY;BYDAY=TU,TH\n\n" +
  "### Vitamins\n#Start\n- 01.11.2026 08:00\n#Repeat\n- FREQ=DAILY\n";

/** @param {string} days the day sections */
function parse(days) {
  return app.calendarFormat.parse(`${header}${days}\n${series}`);
}

/** Titles of a day in display order. @param {any} calendar @param {string} key */
function order(calendar, key) {
  return plain(app.recurrence.dayOrder(app.recurrence.occurrences(calendar, key), app.calendar.entries(calendar, key), app.calendar.placedAt(calendar, key))
    .map((/** @type {any} */ item) => "entry" in item ? item.entry.title : item.occurrence.series.title));
}

/** @param {any} value */
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

/** Runs an action, checks that undo restores the file exactly and redo repeats it. @param {any} calendar @param {any} action */
function step(calendar, action) {
  const before = app.calendarFormat.serialize(calendar);
  action.redo();
  const after = app.calendarFormat.serialize(calendar);
  action.undo();
  assert.equal(app.calendarFormat.serialize(calendar), before);
  action.redo();
  assert.equal(app.calendarFormat.serialize(calendar), after);
}

test("a reference places an occurrence among the entries and round-trips", () => {
  const text = `${header}### 12.11.2026\n- [ ] Groceries\n- @lorem-ipsum\n- [ ] Laundry\n\n${series}`;
  const { calendar, warnings } = app.calendarFormat.parse(text);
  assert.deepEqual(plain(warnings), []);
  assert.deepEqual(plain(app.calendar.pins(calendar, "2026-11-12")), [{ id: "lorem-ipsum", at: 1 }]);
  assert.deepEqual(order(calendar, "2026-11-12"), ["Vitamins", "Groceries", "Lorem ipsum", "Laundry"]);
  assert.equal(app.calendarFormat.serialize(calendar), text);
  // A day that holds only a reference is written too.
  const only = `${header}### 12.11.2026\n- @lorem-ipsum\n\n${series}`;
  assert.equal(app.calendarFormat.serialize(app.calendarFormat.parse(only).calendar), only);
});

test("unknown, orphaned and repeated references and a repeated ID are reported and kept verbatim", () => {
  const text = `${header}### 12.11.2026\n- [ ] Groceries\n- @nobody\n- @lorem-ipsum\n- @lorem-ipsum\n\n### 13.11.2026\n- @lorem-ipsum\n\n${series}\n` +
    "### Lorem ipsum again\n#Id\n- lorem-ipsum\n#Start\n- 01.11.2026\n#Repeat\n- FREQ=DAILY\n";
  const { calendar, warnings } = app.calendarFormat.parse(text);
  assert.deepEqual(plain(warnings).map((/** @type {any} */ warning) => warning.text), ["- @nobody", "- @lorem-ipsum", "- @lorem-ipsum", "#Id lorem-ipsum"]);
  assert.deepEqual(plain(app.calendar.pins(calendar, "2026-11-12")), [{ id: "lorem-ipsum", at: 1 }]);
  assert.deepEqual(plain(app.calendar.pins(calendar, "2026-11-13")), []);
  assert.equal(app.calendarFormat.serialize(calendar), text);
});

test("the day order puts placed occurrences at their place, first in a gap, and the others in their time slot", () => {
  const { calendar } = parse("### 12.11.2026\n- [ ] Groceries\n- [ ] 09:00 Dentist\n- [ ] Laundry\n");
  assert.deepEqual(order(calendar, "2026-11-12"), ["Groceries", "Vitamins", "Dentist", "Lorem ipsum", "Laundry"]);
  calendar.days.get("2026-11-12").pins = [{ id: "lorem-ipsum", at: 1 }];
  assert.deepEqual(order(calendar, "2026-11-12"), ["Groceries", "Lorem ipsum", "Vitamins", "Dentist", "Laundry"]);
  calendar.days.get("2026-11-12").pins = [{ id: "lorem-ipsum", at: 9 }];
  assert.deepEqual(order(calendar, "2026-11-12"), ["Groceries", "Vitamins", "Dentist", "Laundry", "Lorem ipsum"]);
});

test("series IDs are readable slugs that never collide", () => {
  assert.equal(app.calendar.slug("Lörem Üpsum", new Set()), "loerem-uepsum");
  assert.equal(app.calendar.slug("Dolor + Sit", new Set()), "dolor-sit");
  assert.equal(app.calendar.slug("Café Straße", new Set()), "cafe-strasse");
  assert.equal(app.calendar.slug("!!!", new Set()), "series");
  assert.equal(app.calendar.slug("Amet", new Set(["amet", "amet-2"])), "amet-3");
});

test("dropping an occurrence places every occurrence of its day and gives a series without an ID one", () => {
  const { calendar } = parse("### 12.11.2026\n- [ ] Groceries\n- [ ] Laundry\n");
  // Vitamins (series 1) between the entries, Lorem ipsum (series 0) at the end.
  const action = app.calendar.placeOccurrences(calendar, "2026-11-12", [{ series: 1, at: 1 }, { series: 0, at: 2 }], "Vitamins");
  step(calendar, action);
  assert.deepEqual(order(calendar, "2026-11-12"), ["Groceries", "Vitamins", "Laundry", "Lorem ipsum"]);
  const file = app.calendarFormat.serialize(calendar);
  assert.match(file, /### 12\.11\.2026\n- \[ \] Groceries\n- @vitamins\n- \[ \] Laundry\n- @lorem-ipsum\n/);
  assert.match(file, /### Vitamins\n#Id\n- vitamins\n#Start/);
  assert.equal(app.calendar.placeOccurrences(calendar, "2026-11-12", [{ series: 1, at: 1 }, { series: 0, at: 2 }], "Vitamins"), null);

  // An occurrence the drop did not show (behind “+N”) is placed where it is shown, after the dropped ones of its gap.
  const hidden = parse("### 12.11.2026\n- [ ] Groceries\n- [ ] Laundry\n").calendar;
  step(hidden, app.calendar.placeOccurrences(hidden, "2026-11-12", [{ series: 0, at: 0 }], "Lorem ipsum"));
  assert.deepEqual(plain(app.calendar.pins(hidden, "2026-11-12")), [{ id: "lorem-ipsum", at: 0 }, { id: "vitamins", at: 0 }]);
  assert.deepEqual(order(hidden, "2026-11-12"), ["Lorem ipsum", "Vitamins", "Groceries", "Laundry"]);
});

test("placed occurrences keep their place when entries are added, edited, checked off, moved and deleted", () => {
  const { calendar } = parse("### 12.11.2026\n- [ ] A\n- @lorem-ipsum\n- [ ] B\n\n### 13.11.2026\n- [ ] C\n");
  const backlog = { newline: "\n", head: [], ungrouped: [], groups: [] };
  const key = "2026-11-12";
  const check = (/** @type {any} */ action, /** @type {string[]} */ expected) => {
    step(calendar, action);
    assert.deepEqual(order(calendar, key).filter((/** @type {string} */ title) => title !== "Vitamins"), expected);
  };
  check(app.calendar.toggleDone(calendar, { key, index: 1 }), ["A", "Lorem ipsum", "B"]);
  check(app.calendar.updateEntry(calendar, { key, index: 0 }, key, { title: "A2", start: "", end: "", location: "", note: [] }), ["A2", "Lorem ipsum", "B"]);
  check(app.calendar.createEntry(calendar, key, { title: "D", start: "", end: "", location: "", note: [] }), ["A2", "Lorem ipsum", "B", "D"]);
  check(app.calendar.deleteEntry(calendar, { key, index: 1 }), ["A2", "Lorem ipsum", "D"]);
  // A drop within the day passes the placed occurrence: it stays where it was dropped around.
  check(app.backlog.move(calendar, backlog, { key, index: 0 }, { key, index: 0 }, [{ series: 0, at: 0 }]), ["Lorem ipsum", "A2", "D"]);
  check(app.backlog.move(calendar, backlog, { key, index: 1 }, { key, index: 0 }, [{ series: 0, at: 2 }]), ["D", "A2", "Lorem ipsum"]);
  // An entry that leaves the day, alone or with others, leaves the occurrence in its place.
  check(app.backlog.move(calendar, backlog, { key, index: 0 }, { key: "2026-11-13", index: 0 }), ["A2", "Lorem ipsum"]);
  check(app.backlog.moveEntries(calendar, backlog, [{ key, index: 0 }], { key: "2026-11-13", index: 0 }), ["Lorem ipsum"]);
  check(app.backlog.toggleEntries(calendar, backlog, [{ key: "2026-11-13", index: 0 }]), ["Lorem ipsum"]);
});

test("a timed entry that lands on a day takes its time slot among the placed occurrences too", () => {
  const { calendar } = parse("### 12.11.2026\n- [ ] 08:00 Early\n- @lorem-ipsum\n- [ ] 21:00 Late\n\n### 13.11.2026\n- [ ] 19:00 Moved\n");
  const backlog = { newline: "\n", head: [], ungrouped: [], groups: [] };
  const key = "2026-11-12";
  const fields = (/** @type {string} */ title, /** @type {string} */ start) => ({ title, start, end: "", location: "", note: [] });
  const check = (/** @type {any} */ action, /** @type {string[]} */ expected) => {
    step(calendar, action);
    assert.deepEqual(order(calendar, key).filter((/** @type {string} */ title) => title !== "Vitamins"), expected);
    action.undo();
  };
  // Lorem ipsum starts 18:30: a later entry comes after it, an earlier one before it, wherever the paste pointed.
  check(app.backlog.pasteEntries(calendar, backlog, [{ ...fields("Pasted", "19:00"), done: false, tag: "", extra: [] }], { key, index: 0 }), ["Early", "Lorem ipsum", "Pasted", "Late"]);
  check(app.calendar.createEntry(calendar, key, fields("Created", "19:00")), ["Early", "Lorem ipsum", "Created", "Late"]);
  check(app.calendar.createEntry(calendar, key, fields("Created", "12:00")), ["Early", "Created", "Lorem ipsum", "Late"]);
  check(app.calendar.updateEntry(calendar, { key, index: 0 }, key, fields("Early", "19:00")), ["Lorem ipsum", "Early", "Late"]);
  check(app.backlog.move(calendar, backlog, { key: "2026-11-13", index: 0 }, { key, index: 0 }), ["Early", "Lorem ipsum", "Moved", "Late"]);
  check(app.backlog.moveEntries(calendar, backlog, [{ key: "2026-11-13", index: 0 }], { key, index: 0 }), ["Early", "Lorem ipsum", "Moved", "Late"]);
});

test("an entry dragged past an occurrence that is not placed places every occurrence of its day as dropped", () => {
  const backlog = { newline: "\n", head: [], ungrouped: [], groups: [] };
  const key = "2026-11-12";
  // The only entry has no time, so the occurrences come first; dropping it on top passes both.
  const { calendar } = parse("### 12.11.2026\n- [ ] Microphone\n");
  assert.deepEqual(order(calendar, key), ["Vitamins", "Lorem ipsum", "Microphone"]);
  step(calendar, app.backlog.move(calendar, backlog, { key, index: 0 }, { key, index: 0 }, [{ series: 1, at: 1 }, { series: 0, at: 1 }]));
  assert.deepEqual(order(calendar, key), ["Microphone", "Vitamins", "Lorem ipsum"]);
  assert.deepEqual(plain(app.calendar.pins(calendar, key)), [{ id: "vitamins", at: 1 }, { id: "lorem-ipsum", at: 1 }]);
  // A drop that passes no occurrence that is not placed places nothing.
  const timed = parse("### 12.11.2026\n- [ ] A\n- [ ] 09:00 Dentist\n- [ ] B\n").calendar;
  step(timed, app.backlog.move(timed, backlog, { key, index: 2 }, { key, index: 0 }, [{ series: 1, at: 2 }, { series: 0, at: 3 }]));
  assert.deepEqual(order(timed, key), ["B", "A", "Vitamins", "Dentist", "Lorem ipsum"]);
  assert.deepEqual(plain(app.calendar.pins(timed, key)), []);
});

test("a series change drops the references it removes and keeps the others, in the same undo step", () => {
  const text = "### 10.11.2026\n- [ ] A\n- @lorem-ipsum\n\n### 12.11.2026\n- [ ] B\n- @lorem-ipsum\n\n### 19.11.2026\n- [ ] C\n- @lorem-ipsum\n";
  const index = 0;
  const pinned = (/** @type {any} */ calendar) => ["2026-11-10", "2026-11-12", "2026-11-19"].filter(key => app.calendar.pins(calendar, key).length);
  let calendar = parse(text).calendar;
  step(calendar, app.calendar.deleteOccurrence(calendar, index, "2026-11-12"));
  assert.deepEqual(pinned(calendar), ["2026-11-10", "2026-11-19"]);
  calendar = parse(text).calendar;
  step(calendar, app.calendar.endSeries(calendar, index, "2026-11-12"));
  assert.deepEqual(pinned(calendar), ["2026-11-10", "2026-11-12"]);
  calendar = parse(text).calendar;
  step(calendar, app.calendar.deleteSeries(calendar, index));
  assert.deepEqual(pinned(calendar), []);
  calendar = parse(text).calendar;
  const current = calendar.series[index];
  step(calendar, app.calendar.updateSeries(calendar, index, { ...current, rule: { ...current.rule, byDay: ["TH"] } }));
  assert.deepEqual(pinned(calendar), ["2026-11-12", "2026-11-19"]);
  calendar = parse(text).calendar;
  step(calendar, app.calendar.updateSeries(calendar, index, { ...current, start: "2026-11-11" }));
  assert.deepEqual(pinned(calendar), ["2026-11-12", "2026-11-19"]);
  // A new start time or a new title keeps every placement.
  calendar = parse(text).calendar;
  step(calendar, app.calendar.updateSeries(calendar, index, { ...current, title: "Martial arts", startTime: "07:00" }));
  assert.deepEqual(pinned(calendar), ["2026-11-10", "2026-11-12", "2026-11-19"]);
});
