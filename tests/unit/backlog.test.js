const assert = require("node:assert/strict");
const test = require("node:test");
const load = require("./load-classic");

const app = load("vendor/dayjs/dayjs.min.js", "vendor/dayjs/plugin/isoWeek.js", "domain/calendar.js", "domain/backlog.js");

/** @param {string} title */
function entry(title) {
  return { done: false, start: "", end: "", title, tag: "", location: "", note: [], extra: [] };
}

function fixture() {
  const calendar = {
    newline: "\n", head: [], multiDay: [], series: [], multiDayHead: [], seriesHead: [], seriesRevision: 0,
    days: new Map([["2026-11-12", { key: "2026-11-12", extra: [], entries: [entry("Day A")] }]])
  };
  const backlog = { newline: "\n", head: [], groups: [{ name: "Inbox", extra: [], entries: [entry("Inbox A")] }, { name: "Later", extra: [], entries: [entry("Later A"), entry("Later B")] }] };
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
  assert.deepEqual(roundTrip(state, scheduled), { days: [["2026-11-12", ["Later B", "Day A"]]], groups: [["Inbox A"], ["Later A"]] });

  const parked = app.backlog.move(calendar, backlog, { key: "2026-11-12", index: 1 }, { key: "", group: 0, index: 1 });
  assert.equal(parked.target, "Backlog.md");
  assert.deepEqual(roundTrip(state, parked), { days: [["2026-11-12", ["Later B"]]], groups: [["Inbox A", "Day A"], ["Later A"]] });

  const between = app.backlog.move(calendar, backlog, { key: "", group: 0, index: 0 }, { key: "", group: 1, index: 0 });
  assert.equal(between.target, undefined);
  assert.deepEqual(roundTrip(state, between), { days: [["2026-11-12", ["Later B"]]], groups: [["Day A"], ["Inbox A", "Later A"]] });
});

test("backlog entries are created, edited, checked off, scheduled and deleted", () => {
  const state = fixture();
  const { calendar, backlog } = state;
  const fields = { title: "New", start: "", end: "", location: "", note: [] };
  assert.deepEqual(roundTrip(state, app.backlog.create(calendar, backlog, 0, fields)).groups, [["Inbox A", "New"], ["Later A", "Later B"]]);
  assert.deepEqual(roundTrip(state, app.backlog.toggle(calendar, backlog, { key: "", group: 0, index: 1 })).groups, [["Inbox A", "New ✓"], ["Later A", "Later B"]]);
  assert.deepEqual(roundTrip(state, app.backlog.update(calendar, backlog, { key: "", group: 0, index: 0 }, { key: "2026-11-13" }, { title: "Inbox A2" })),
    { days: [["2026-11-12", ["Day A"]], ["2026-11-13", ["Inbox A2"]]], groups: [["New ✓"], ["Later A", "Later B"]] });
  assert.equal(app.backlog.update(calendar, backlog, { key: "", group: 1, index: 0 }, { key: "", group: 1 }, { title: "Later A" }), null);
  assert.deepEqual(roundTrip(state, app.backlog.remove(calendar, backlog, { key: "", group: 1, index: 1 })).groups, [["New ✓"], ["Later A"]]);
});
