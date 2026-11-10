const assert = require("node:assert/strict");
const test = require("node:test");
const load = require("./load-classic");

const { calendar: domain } = load("vendor/dayjs/dayjs.min.js", "vendor/dayjs/plugin/isoWeek.js", "domain/calendar.js", "domain/recurrence.js");

/** @param {unknown} value */
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

/** @param {Record<string, string[]>} days @returns {any} */
function calendarWith(days) {
  const map = new Map(Object.entries(days).map(([key, titles]) => [key, {
    key, extra: [], entries: titles.map(title => ({ done: false, start: "", end: "", title, tag: "", location: "", note: [], extra: [] }))
  }]));
  return { newline: "\n", head: [], days: map, multiDay: [], series: [], multiDayHead: [], seriesHead: [], seriesRevision: 0 };
}

/** @param {any} calendar */
function titles(calendar) {
  return Object.fromEntries(Array.from(calendar.days.values(), (/** @type {any} */ day) => [day.key, day.entries.map((/** @type {any} */ entry) => entry.title)])
    .filter(([, list]) => list.length));
}

/** Applies an action, then checks that undo restores and redo reapplies the state. @param {any} calendar @param {any} action */
function roundTrip(calendar, action) {
  const before = plain(titles(calendar));
  action.redo();
  const after = plain(titles(calendar));
  action.undo();
  assert.deepEqual(plain(titles(calendar)), before, `${action.label}: undo restores`);
  action.redo();
  assert.deepEqual(plain(titles(calendar)), after, `${action.label}: redo reapplies`);
  return after;
}

test("weeks start on Monday and follow ISO 8601 numbering across the year boundary", () => {
  assert.deepEqual(plain(domain.weekDays("2026-11-12")), ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"]);
  assert.equal(domain.weekStart("2026-11-15"), "2026-11-09");
  assert.equal(domain.isoWeek("2026-11-12"), 46);
  assert.equal(domain.weekStart("2027-01-01"), "2026-12-28");
  assert.equal(domain.isoWeek("2027-01-01"), 53);
  assert.equal(domain.isoWeek("2027-01-04"), 1);
  assert.equal(domain.addDays("2026-10-25", 1), "2026-10-26");
});

test("dates and times are validated", () => {
  assert.equal(domain.parseDate("29.02.2028"), "2028-02-29");
  assert.equal(domain.parseDate("29.02.2026"), "");
  assert.equal(domain.parseDate("2026-11-12"), "");
  assert.equal(domain.formatDate("2026-11-12"), "12.11.2026");
  assert.equal(domain.parseTime("9:05"), "09:05");
  assert.equal(domain.parseTime("24:00"), "");
  assert.equal(domain.parseTime("12:60"), "");
});

test("day list operations apply, undo and redo exactly", () => {
  const calendar = calendarWith({ "2026-11-12": ["A", "B", "C"], "2026-11-13": ["D"] });
  const fields = { title: "New", start: "09:00", end: "", location: "", note: [] };

  assert.deepEqual(roundTrip(calendar, domain.createEntry(calendar, "2026-11-14", fields)),
    { "2026-11-12": ["A", "B", "C"], "2026-11-13": ["D"], "2026-11-14": ["New"] });
  assert.deepEqual(roundTrip(calendar, domain.moveEntry(calendar, { key: "2026-11-12", index: 0 }, { key: "2026-11-12", index: 2 })),
    { "2026-11-12": ["B", "C", "A"], "2026-11-13": ["D"], "2026-11-14": ["New"] });
  assert.deepEqual(roundTrip(calendar, domain.moveEntry(calendar, { key: "2026-11-12", index: 1 }, { key: "2026-11-13", index: 0 })),
    { "2026-11-12": ["B", "A"], "2026-11-13": ["C", "D"], "2026-11-14": ["New"] });
  assert.deepEqual(roundTrip(calendar, domain.deleteEntry(calendar, { key: "2026-11-14", index: 0 })),
    { "2026-11-12": ["B", "A"], "2026-11-13": ["C", "D"] });

  const moved = domain.updateEntry(calendar, { key: "2026-11-12", index: 0 }, "2026-11-13", { ...fields, title: "B2" });
  assert.deepEqual(roundTrip(calendar, moved), { "2026-11-12": ["A"], "2026-11-13": ["C", "D", "B2"] });
  assert.deepEqual(plain(moved.days), ["2026-11-12", "2026-11-13"]);

  const toggle = domain.toggleDone(calendar, { key: "2026-11-12", index: 0 });
  toggle.redo();
  assert.equal(domain.entries(calendar, "2026-11-12")[0].done, true);
  toggle.undo();
  assert.equal(domain.entries(calendar, "2026-11-12")[0].done, false);
});

test("an edit keeps tag and preserved lines, and an unchanged edit is no action", () => {
  const calendar = calendarWith({ "2026-11-12": ["A"] });
  Object.assign(calendar.days.get("2026-11-12").entries[0], { tag: "Private", extra: ["kept line"] });
  const fields = { title: "A", start: "", end: "", location: "", note: [] };
  assert.equal(domain.updateEntry(calendar, { key: "2026-11-12", index: 0 }, "2026-11-12", fields), null);
  domain.updateEntry(calendar, { key: "2026-11-12", index: 0 }, "2026-11-12", { ...fields, note: ["n"] }).redo();
  assert.deepEqual(plain(calendar.days.get("2026-11-12").entries[0]),
    { done: false, start: "", end: "", title: "A", tag: "Private", location: "", note: ["n"], extra: ["kept line"] });
});

test("open entries on past days are overdue", () => {
  assert.equal(domain.isOverdue({ done: false }, "2026-11-11", "2026-11-12"), true);
  assert.equal(domain.isOverdue({ done: false }, "2026-11-12", "2026-11-12"), false);
  assert.equal(domain.isOverdue({ done: true }, "2026-11-11", "2026-11-12"), false);
});

/** @param {string} title @param {string} start @param {string} end */
function multiDay(title, start, end) {
  return { title, tag: "", start, end, location: "", note: [], extra: [] };
}

test("series actions check off, delete and end occurrences, and undo exactly", () => {
  const calendar = calendarWith({});
  const series = { title: "Gym", tag: "", start: "2026-11-03", startTime: "", endTime: "", rule: { freq: "WEEKLY", interval: 1, byDay: ["TU"], byMonthDay: 0, until: "" },
    except: [], done: ["2026-11-10"], location: "", note: [], extra: [] };
  domain.createSeries(calendar, series).redo();
  const before = plain(calendar.series);

  const removal = domain.deleteOccurrence(calendar, 0, "2026-11-10");
  removal.redo();
  assert.deepEqual(plain(calendar.series[0].except), ["2026-11-10"]);
  assert.deepEqual(plain(calendar.series[0].done), []);
  removal.undo();
  assert.deepEqual(plain(calendar.series), before);

  const end = domain.endSeries(calendar, 0, "2026-11-17");
  end.redo();
  assert.equal(calendar.series[0].rule.until, "2026-11-17", "the chosen occurrence stays the last one");
  end.undo();
  assert.deepEqual(plain(calendar.series), before);
});

test("converting an entry into a multi-day entry is one undo step", () => {
  const calendar = calendarWith({ "2026-11-12": ["Trip"] });
  const action = domain.combine("Trip", [
    domain.deleteEntry(calendar, { key: "2026-11-12", index: 0 }),
    domain.createMultiDay(calendar, multiDay("Trip", "2026-11-12", "2026-11-14"))
  ]);
  action.redo();
  assert.deepEqual(plain(titles(calendar)), {});
  assert.deepEqual(plain(calendar.multiDay.map((/** @type {any} */ item) => item.title)), ["Trip"]);
  assert.deepEqual(plain(action.days), ["2026-11-12", "2026-11-13", "2026-11-14"]);
  action.undo();
  assert.deepEqual(plain(titles(calendar)), { "2026-11-12": ["Trip"] });
  assert.equal(calendar.multiDay.length, 0);
});

test("multi-day bars stack by start date, then the longer bar, then file order", () => {
  const calendar = calendarWith({});
  calendar.multiDay.push(
    multiDay("Short", "2026-11-10", "2026-11-11"),
    multiDay("Long", "2026-11-10", "2026-11-14"),
    multiDay("Before", "2026-11-01", "2026-11-09"),
    multiDay("Same", "2026-11-10", "2026-11-11"),
    multiDay("Later", "2026-11-12", "2026-11-20")
  );
  const { segments, lanes } = domain.segments(calendar, "2026-11-09", 7);
  assert.deepEqual(plain(segments.map((/** @type {any} */ segment) => [segment.item.title, segment.column, segment.span, segment.lane, segment.continuesBefore, segment.continuesAfter])), [
    ["Before", 0, 1, 0, true, false],
    ["Long", 1, 5, 0, false, false],
    ["Short", 1, 2, 1, false, false],
    ["Same", 1, 2, 2, false, false],
    ["Later", 3, 4, 1, false, true]
  ]);
  assert.equal(lanes, 3);
});
