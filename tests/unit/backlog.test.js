const assert = require("node:assert/strict");
const test = require("node:test");
const load = require("./load-classic");

const app = load("domain/calendar.js", "domain/recurrence.js", "domain/backlog.js");

/** @param {string} title */
function entry(title) {
  return { done: false, start: "", end: "", title, tag: "", location: "", note: [], extra: [] };
}

function fixture() {
  const calendar = {
    newline: "\n", head: [], multiDay: [], series: [], multiDayHead: [], seriesHead: [], seriesRevision: 0,
    days: new Map([["2026-11-12", { key: "2026-11-12", extra: [], pins: [], entries: [entry("Day A")] }]])
  };
  const backlog = { newline: "\n", head: [], ungrouped: [entry("Loose A")], groups: [{ name: "Home", extra: [], entries: [entry("Home A")] }, { name: "Later", extra: [], entries: [entry("Later A"), entry("Later B")] }] };
  return { calendar, backlog };
}

/** @param {any} state */
function snapshot({ calendar, backlog }) {
  return JSON.stringify({
    days: Array.from(calendar.days.values(), (/** @type {any} */ day) => [day.key, day.entries.map((/** @type {any} */ item) => item.title)]),
    groups: backlog.groups.map((/** @type {any} */ group) => group.entries.map((/** @type {any} */ item) => `${item.title}${item.done ? " ✓" : ""}`))
  });
}

/** Applies, undoes and redoes an action and returns the state after it. @param {any} state @param {any} action */
function roundTrip(state, action) {
  const before = snapshot(state);
  action.redo();
  const after = snapshot(state);
  action.undo();
  assert.equal(snapshot(state), before, `${action.label}: undo restores`);
  action.redo();
  assert.equal(snapshot(state), after, `${action.label}: redo reapplies`);
  return JSON.parse(after);
}

test("moves between backlog groups and days are single undoable actions", () => {
  const state = fixture();
  const { calendar, backlog } = state;

  const scheduled = app.backlog.move(calendar, backlog, { key: "", group: 1, index: 1 }, { key: "2026-11-12", index: 0 });
  assert.equal(scheduled.target, "Calendar.md");
  assert.deepEqual(roundTrip(state, scheduled), { days: [["2026-11-12", ["Later B", "Day A"]]], groups: [["Home A"], ["Later A"]] });

  const parked = app.backlog.move(calendar, backlog, { key: "2026-11-12", index: 1 }, { key: "", group: 0, index: 1 });
  assert.equal(parked.target, "Backlog.md");
  assert.deepEqual(roundTrip(state, parked), { days: [["2026-11-12", ["Later B"]]], groups: [["Home A", "Day A"], ["Later A"]] });

  const between = app.backlog.move(calendar, backlog, { key: "", group: 0, index: 0 }, { key: "", group: 1, index: 0 });
  assert.equal(between.target, undefined);
  assert.deepEqual(roundTrip(state, between), { days: [["2026-11-12", ["Later B"]]], groups: [["Day A"], ["Home A", "Later A"]] });
});

test("the backlog has no times: an entry moved or pasted there loses its time, and undo brings it back", () => {
  const { calendar, backlog } = fixture();
  const day = /** @type {any} */ (calendar.days.get("2026-11-12"));
  day.entries[0] = { ...day.entries[0], start: "09:30", end: "10:00" };
  const parked = app.backlog.move(calendar, backlog, { key: "2026-11-12", index: 0 }, { key: "", group: 0, index: 0 });
  parked.redo();
  assert.deepEqual([backlog.groups[0].entries[0].title, backlog.groups[0].entries[0].start, backlog.groups[0].entries[0].end], ["Day A", "", ""]);
  parked.undo();
  assert.deepEqual([day.entries[0].start, day.entries[0].end], ["09:30", "10:00"]);
  const pasted = app.backlog.pasteEntries(calendar, backlog, [{ ...entry("Copy"), start: "12:00" }], { key: "", group: 1, index: 0 });
  pasted.redo();
  assert.equal(backlog.groups[1].entries[0].start, "");
});

test("an entry keeps its sync ID when it moves into the backlog; a pasted copy never takes it", () => {
  const { calendar, backlog } = fixture();
  const day = /** @type {any} */ (calendar.days.get("2026-11-12"));
  day.entries[0] = { ...day.entries[0], start: "09:30", sync: "ab12cd34" };
  app.backlog.move(calendar, backlog, { key: "2026-11-12", index: 0 }, { key: "", group: -1, index: 0 }).redo();
  assert.equal(/** @type {any} */ (backlog.ungrouped[0]).sync, "ab12cd34");
  app.backlog.pasteEntries(calendar, backlog, [backlog.ungrouped[0]], { key: "2026-11-12", index: 0 }).redo();
  assert.equal("sync" in day.entries[0], false);
});

test("a timed entry dragged in from elsewhere goes into its time slot; within its day it lands where dropped", () => {
  const state = fixture();
  const { calendar, backlog } = state;
  /** @param {string} title @param {string} start */
  const timed = (title, start) => ({ ...entry(title), start });
  calendar.days.set("2026-11-12", { key: "2026-11-12", extra: [], pins: [], entries: [entry("Todo"), timed("Eight", "08:00"), timed("Ten", "10:00")] });
  calendar.days.set("2026-11-13", { key: "2026-11-13", extra: [], pins: [], entries: [timed("Nine", "09:00"), entry("Loose"), timed("Eleven", "11:00")] });
  /** @param {string} key */
  const titles = key => /** @type {any} */ (calendar.days.get(key)).entries.map((/** @type {any} */ item) => item.title);

  // Dropped at the top, but 09:00 belongs between 08:00 and 10:00.
  roundTrip(state, app.backlog.move(calendar, backlog, { key: "2026-11-13", index: 0 }, { key: "2026-11-12", index: 0 }));
  assert.deepEqual(titles("2026-11-12"), ["Todo", "Eight", "Nine", "Ten"]);
  // Within the day the drop position wins.
  roundTrip(state, app.backlog.move(calendar, backlog, { key: "2026-11-12", index: 2 }, { key: "2026-11-12", index: 0 }));
  assert.deepEqual(titles("2026-11-12"), ["Nine", "Todo", "Eight", "Ten"]);
  // A selection: the untimed entry lands where dropped, the timed one in its slot.
  roundTrip(state, app.backlog.moveEntries(calendar, backlog, [{ key: "2026-11-13", index: 0 }, { key: "2026-11-13", index: 1 }], { key: "2026-11-12", index: 0 }));
  assert.deepEqual(titles("2026-11-12"), ["Loose", "Nine", "Todo", "Eight", "Ten", "Eleven"]);
});

test("ungrouped backlog entries move to and from days and groups like a group", () => {
  const state = fixture();
  const { calendar, backlog } = state;
  /** Titles of the ungrouped entries after an action, checked for undo and redo like the rest of the state. @param {any} action */
  const ungrouped = action => {
    const before = JSON.stringify(backlog.ungrouped.map((/** @type {any} */ item) => item.title));
    action.redo();
    const after = backlog.ungrouped.map((/** @type {any} */ item) => item.title);
    action.undo();
    assert.equal(JSON.stringify(backlog.ungrouped.map((/** @type {any} */ item) => item.title)), before, `${action.label}: undo restores`);
    action.redo();
    return JSON.parse(JSON.stringify(after));
  };
  const toGroup = app.backlog.move(calendar, backlog, { key: "", group: app.backlog.ungrouped, index: 0 }, { key: "", group: 1, index: 0 });
  assert.deepEqual(ungrouped(toGroup), []);
  assert.deepEqual(JSON.parse(JSON.stringify(backlog.groups[1].entries.map((/** @type {any} */ item) => item.title))), ["Loose A", "Later A", "Later B"]);
  const fromDay = app.backlog.move(calendar, backlog, { key: "2026-11-12", index: 0 }, { key: "", group: app.backlog.ungrouped, index: 0 });
  assert.equal(fromDay.target, "Backlog.md");
  assert.deepEqual(ungrouped(fromDay), ["Day A"]);
});

test("backlog groups are reordered as one undoable action", () => {
  const state = fixture();
  const names = () => state.backlog.groups.map((/** @type {any} */ group) => group.name).join(",");
  assert.deepEqual(roundTrip(state, app.backlog.moveGroup(state.backlog, 1, 0)).groups, [["Later A", "Later B"], ["Home A"]]);
  assert.equal(names(), "Later,Home");
  assert.equal(app.backlog.moveGroup(state.backlog, 0, 0), null);
  assert.throws(() => app.backlog.moveGroup(state.backlog, 0, 2));
});

test("backlog entries are created, edited, checked off, scheduled and deleted", () => {
  const state = fixture();
  const { calendar, backlog } = state;
  const fields = { title: "New", start: "", end: "", location: "", note: [] };
  assert.deepEqual(roundTrip(state, app.backlog.create(calendar, backlog, { ...fields, tag: "Home" })).groups, [["Home A", "New"], ["Later A", "Later B"]]);
  assert.deepEqual(roundTrip(state, app.backlog.toggle(calendar, backlog, { key: "", group: 0, index: 1 })).groups, [["Home A", "New ✓"], ["Later A", "Later B"]]);
  assert.deepEqual(roundTrip(state, app.backlog.update(calendar, backlog, { key: "", group: 0, index: 0 }, { key: "2026-11-13" }, { title: "Home A2" })),
    { days: [["2026-11-12", ["Day A"]], ["2026-11-13", ["Home A2"]]], groups: [["New ✓"], ["Later A", "Later B"]] });
  assert.equal(app.backlog.update(calendar, backlog, { key: "", group: 1, index: 0 }, { key: "", group: 1 }, { title: "Later A" }), null);
  assert.deepEqual(roundTrip(state, app.backlog.remove(calendar, backlog, { key: "", group: 1, index: 1 })).groups, [["New ✓"], ["Later A"]]);
});

test("the tag decides the group of an entry from outside; inside the backlog a move gives the new group's tag", () => {
  const state = fixture();
  const { calendar, backlog } = state;
  /** @param {string} title @param {string} tag */
  const tagged = (title, tag) => ({ ...entry(title), tag });
  calendar.days.set("2026-11-13", { key: "2026-11-13", extra: [], pins: [], entries: [tagged("Late", "Later"), tagged("Job", "Work"), entry("Plain")] });
  /** Group names with their entries as "title #tag". */
  const shape = () => JSON.parse(JSON.stringify(backlog.groups.map((/** @type {any} */ group) => [group.name, group.entries.map((/** @type {any} */ item) => `${item.title} #${item.tag}`)])));
  const loose = () => JSON.parse(JSON.stringify(backlog.ungrouped.map((/** @type {any} */ item) => `${item.title} #${item.tag}`)));

  // Dropped into another group, a tagged entry still goes to the end of its own group.
  roundTrip(state, app.backlog.move(calendar, backlog, { key: "2026-11-13", index: 0 }, { key: "", group: 0, index: 0 }));
  assert.deepEqual(shape(), [["Home", ["Home A #"]], ["Later", ["Later A #", "Later B #", "Late #Later"]]]);

  // Without a group for its tag one is created at the end; undo removes it again.
  const created = app.backlog.move(calendar, backlog, { key: "2026-11-13", index: 0 }, { key: "", group: app.backlog.ungrouped, index: 0 });
  created.redo();
  assert.deepEqual(shape().map((/** @type {any} */ group) => group[0]), ["Home", "Later", "Work"]);
  created.undo();
  assert.deepEqual(shape().map((/** @type {any} */ group) => group[0]), ["Home", "Later"]);
  created.redo();

  // An untagged entry lands where it is dropped and takes that group's tag.
  roundTrip(state, app.backlog.move(calendar, backlog, { key: "2026-11-13", index: 0 }, { key: "", group: 1, index: 1 }));
  assert.deepEqual(shape()[1], ["Later", ["Later A #", "Plain #Later", "Later B #", "Late #Later"]]);

  // Inside the backlog a move to another group re-tags, to the ungrouped entries it untags.
  roundTrip(state, app.backlog.move(calendar, backlog, { key: "", group: 2, index: 0 }, { key: "", group: 0, index: 0 }));
  assert.deepEqual(shape()[0], ["Home", ["Job #Home", "Home A #"]]);
  roundTrip(state, app.backlog.move(calendar, backlog, { key: "", group: 0, index: 0 }, { key: "", group: app.backlog.ungrouped, index: 1 }));
  assert.deepEqual(loose(), ["Loose A #", "Job #"]);

  // Reordering inside a group never changes a tag, also one that differs from the group (a hand-edited file).
  backlog.groups[1].entries.unshift(tagged("Foreign", "Car"));
  roundTrip(state, app.backlog.move(calendar, backlog, { key: "", group: 1, index: 0 }, { key: "", group: 1, index: 2 }));
  assert.deepEqual(shape()[1][1].slice(0, 3), ["Later A #", "Plain #Later", "Foreign #Car"]);
});

test("pasting into the backlog and editing a backlog entry's tag follow the tag", () => {
  const state = fixture();
  const { calendar, backlog } = state;
  const copies = [{ ...entry("Car copy"), tag: "Later", done: true }, entry("Plain copy")];
  // The tagged copy goes to its own group, the untagged one to the pointer's place and takes that group's tag.
  roundTrip(state, app.backlog.pasteEntries(calendar, backlog, copies, { key: "", group: 0, index: 0 }));
  assert.deepEqual(JSON.parse(JSON.stringify(backlog.groups.map((/** @type {any} */ group) => group.entries.map((/** @type {any} */ item) => `${item.title} #${item.tag}${item.done ? " ✓" : ""}`)))),
    [["Plain copy #Home", "Home A #"], ["Later A #", "Later B #", "Car copy #Later"]]);
  // A changed tag moves the entry to the end of that group; an edit that keeps the tag keeps the place.
  roundTrip(state, app.backlog.update(calendar, backlog, { key: "", group: 0, index: 0 }, { key: "", group: 0 }, { tag: "Later" }));
  assert.deepEqual(JSON.parse(JSON.stringify(backlog.groups[1].entries.map((/** @type {any} */ item) => item.title))), ["Later A", "Later B", "Car copy", "Plain copy"]);
  roundTrip(state, app.backlog.update(calendar, backlog, { key: "", group: 1, index: 0 }, { key: "", group: 1 }, { title: "Later A2" }));
  assert.equal(backlog.groups[1].entries[0].title, "Later A2");
});
