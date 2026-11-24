const assert = require("node:assert/strict");
const test = require("node:test");
const load = require("./load-classic");

const app = load("domain/calendar.js", "domain/recurrence.js", "domain/backlog.js", "io/calendar-format.js");

const header = "# Calendar\n\n## November 2026\n\n";
// Thursday 12 and Friday 13 November 2026; Kyokushin is on Tuesdays and Thursdays, Vitamins daily.
const series = "## Recurring\n\n### Kyokushin #Karate\n#Id\n- kyokushin\n#Start\n- 05.11.2026 18:30 - 20:00\n#Repeat\n- FREQ=WEEKLY;BYDAY=TU,TH\n\n" +
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
  const text = `${header}### 12.11.2026\n- [ ] Groceries\n- @kyokushin\n- [ ] Laundry\n\n${series}`;
  const { calendar, warnings } = app.calendarFormat.parse(text);
  assert.deepEqual(plain(warnings), []);
  assert.deepEqual(plain(app.calendar.pins(calendar, "2026-11-12")), [{ id: "kyokushin", at: 1 }]);
  assert.deepEqual(order(calendar, "2026-11-12"), ["Vitamins", "Groceries", "Kyokushin", "Laundry"]);
  assert.equal(app.calendarFormat.serialize(calendar), text);
  // A day that holds only a reference is written too.
  const only = `${header}### 12.11.2026\n- @kyokushin\n\n${series}`;
  assert.equal(app.calendarFormat.serialize(app.calendarFormat.parse(only).calendar), only);
});

test("unknown, orphaned and repeated references and a repeated ID are reported and kept verbatim", () => {
  const text = `${header}### 12.11.2026\n- [ ] Groceries\n- @nobody\n- @kyokushin\n- @kyokushin\n\n### 13.11.2026\n- @kyokushin\n\n${series}\n` +
    "### Kyokushin again\n#Id\n- kyokushin\n#Start\n- 01.11.2026\n#Repeat\n- FREQ=DAILY\n";
  const { calendar, warnings } = app.calendarFormat.parse(text);
  assert.deepEqual(plain(warnings).map((/** @type {any} */ warning) => warning.text), ["- @nobody", "- @kyokushin", "- @kyokushin", "#Id kyokushin"]);
  assert.deepEqual(plain(app.calendar.pins(calendar, "2026-11-12")), [{ id: "kyokushin", at: 1 }]);
  assert.deepEqual(plain(app.calendar.pins(calendar, "2026-11-13")), []);
  assert.equal(app.calendarFormat.serialize(calendar), text);
});

test("the day order puts placed occurrences at their place, first in a gap, and the others in their time slot", () => {
  const { calendar } = parse("### 12.11.2026\n- [ ] Groceries\n- [ ] 09:00 Dentist\n- [ ] Laundry\n");
  assert.deepEqual(order(calendar, "2026-11-12"), ["Groceries", "Vitamins", "Dentist", "Kyokushin", "Laundry"]);
  calendar.days.get("2026-11-12").pins = [{ id: "kyokushin", at: 1 }];
  assert.deepEqual(order(calendar, "2026-11-12"), ["Groceries", "Kyokushin", "Vitamins", "Dentist", "Laundry"]);
  calendar.days.get("2026-11-12").pins = [{ id: "kyokushin", at: 9 }];
  assert.deepEqual(order(calendar, "2026-11-12"), ["Groceries", "Vitamins", "Dentist", "Laundry", "Kyokushin"]);
});

test("series IDs are readable slugs that never collide", () => {
  assert.equal(app.calendar.slug("Hüftbeuger Stretch", new Set()), "hueftbeuger-stretch");
  assert.equal(app.calendar.slug("Grip + Kicks", new Set()), "grip-kicks");
  assert.equal(app.calendar.slug("Café Straße", new Set()), "cafe-strasse");
  assert.equal(app.calendar.slug("!!!", new Set()), "series");
  assert.equal(app.calendar.slug("Wiegen", new Set(["wiegen", "wiegen-2"])), "wiegen-3");
});

test("dropping an occurrence places every occurrence of its day and gives a series without an ID one", () => {
  const { calendar } = parse("### 12.11.2026\n- [ ] Groceries\n- [ ] Laundry\n");
  // Vitamins (series 1) between the entries, Kyokushin (series 0) at the end.
  const action = app.calendar.placeOccurrences(calendar, "2026-11-12", [{ series: 1, at: 1 }, { series: 0, at: 2 }], "Vitamins");
  step(calendar, action);
  assert.deepEqual(order(calendar, "2026-11-12"), ["Groceries", "Vitamins", "Laundry", "Kyokushin"]);
  const file = app.calendarFormat.serialize(calendar);
  assert.match(file, /### 12\.11\.2026\n- \[ \] Groceries\n- @vitamins\n- \[ \] Laundry\n- @kyokushin\n/);
  assert.match(file, /### Vitamins\n#Id\n- vitamins\n#Start/);
  assert.equal(app.calendar.placeOccurrences(calendar, "2026-11-12", [{ series: 1, at: 1 }, { series: 0, at: 2 }], "Vitamins"), null);

  // An occurrence the drop did not show (behind “+N”) is placed where it is shown, after the dropped ones of its gap.
  const hidden = parse("### 12.11.2026\n- [ ] Groceries\n- [ ] Laundry\n").calendar;
  step(hidden, app.calendar.placeOccurrences(hidden, "2026-11-12", [{ series: 0, at: 0 }], "Kyokushin"));
  assert.deepEqual(plain(app.calendar.pins(hidden, "2026-11-12")), [{ id: "kyokushin", at: 0 }, { id: "vitamins", at: 0 }]);
  assert.deepEqual(order(hidden, "2026-11-12"), ["Kyokushin", "Vitamins", "Groceries", "Laundry"]);
});

test("placed occurrences keep their place when entries are added, edited, checked off, moved and deleted", () => {
  const { calendar } = parse("### 12.11.2026\n- [ ] A\n- @kyokushin\n- [ ] B\n\n### 13.11.2026\n- [ ] C\n");
  const backlog = { newline: "\n", head: [], ungrouped: [], groups: [] };
  const key = "2026-11-12";
  const check = (/** @type {any} */ action, /** @type {string[]} */ expected) => {
    step(calendar, action);
    assert.deepEqual(order(calendar, key).filter((/** @type {string} */ title) => title !== "Vitamins"), expected);
  };
  check(app.calendar.toggleDone(calendar, { key, index: 1 }), ["A", "Kyokushin", "B"]);
  check(app.calendar.updateEntry(calendar, { key, index: 0 }, key, { title: "A2", start: "", end: "", location: "", note: [] }), ["A2", "Kyokushin", "B"]);
  check(app.calendar.createEntry(calendar, key, { title: "D", start: "", end: "", location: "", note: [] }), ["A2", "Kyokushin", "B", "D"]);
  check(app.calendar.deleteEntry(calendar, { key, index: 1 }), ["A2", "Kyokushin", "D"]);
  // A drop within the day passes the placed occurrence: it stays where it was dropped around.
  check(app.backlog.move(calendar, backlog, { key, index: 0 }, { key, index: 0 }, [{ series: 0, at: 0 }]), ["Kyokushin", "A2", "D"]);
  check(app.backlog.move(calendar, backlog, { key, index: 1 }, { key, index: 0 }, [{ series: 0, at: 2 }]), ["D", "A2", "Kyokushin"]);
  // An entry that leaves the day, alone or with others, leaves the occurrence in its place.
  check(app.backlog.move(calendar, backlog, { key, index: 0 }, { key: "2026-11-13", index: 0 }), ["A2", "Kyokushin"]);
  check(app.backlog.moveEntries(calendar, backlog, [{ key, index: 0 }], { key: "2026-11-13", index: 0 }), ["Kyokushin"]);
  check(app.backlog.toggleEntries(calendar, backlog, [{ key: "2026-11-13", index: 0 }]), ["Kyokushin"]);
});

test("an entry dragged past an occurrence that is not placed places every occurrence of its day as dropped", () => {
  const backlog = { newline: "\n", head: [], ungrouped: [], groups: [] };
  const key = "2026-11-12";
  // The only entry has no time, so the occurrences come first; dropping it on top passes both.
  const { calendar } = parse("### 12.11.2026\n- [ ] Microphone\n");
  assert.deepEqual(order(calendar, key), ["Vitamins", "Kyokushin", "Microphone"]);
  step(calendar, app.backlog.move(calendar, backlog, { key, index: 0 }, { key, index: 0 }, [{ series: 1, at: 1 }, { series: 0, at: 1 }]));
  assert.deepEqual(order(calendar, key), ["Microphone", "Vitamins", "Kyokushin"]);
  assert.deepEqual(plain(app.calendar.pins(calendar, key)), [{ id: "vitamins", at: 1 }, { id: "kyokushin", at: 1 }]);
  // A drop that passes no occurrence that is not placed places nothing.
  const timed = parse("### 12.11.2026\n- [ ] A\n- [ ] 09:00 Dentist\n- [ ] B\n").calendar;
  step(timed, app.backlog.move(timed, backlog, { key, index: 2 }, { key, index: 0 }, [{ series: 1, at: 2 }, { series: 0, at: 3 }]));
  assert.deepEqual(order(timed, key), ["B", "A", "Vitamins", "Dentist", "Kyokushin"]);
  assert.deepEqual(plain(app.calendar.pins(timed, key)), []);
});

test("a series change drops the references it removes and keeps the others, in the same undo step", () => {
  const text = "### 10.11.2026\n- [ ] A\n- @kyokushin\n\n### 12.11.2026\n- [ ] B\n- @kyokushin\n\n### 19.11.2026\n- [ ] C\n- @kyokushin\n";
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
  step(calendar, app.calendar.updateSeries(calendar, index, { ...current, title: "Karate", startTime: "07:00" }));
  assert.deepEqual(pinned(calendar), ["2026-11-10", "2026-11-12", "2026-11-19"]);
});
