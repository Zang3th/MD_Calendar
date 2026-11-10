const assert = require("node:assert/strict");
const test = require("node:test");
const load = require("./load-classic");

const { recurrence, calendar: domain } = load("vendor/dayjs/dayjs.min.js", "vendor/dayjs/plugin/isoWeek.js", "domain/calendar.js", "domain/recurrence.js");

/** @param {unknown} value */
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

/** All days from `from` to `to` on which the rule occurs. @param {string} text @param {string} start @param {string} from @param {string} to */
function dates(text, start, from, to) {
  const rule = recurrence.parseRule(text);
  assert.ok(rule, text);
  const result = [];
  for (let key = from; key <= to; key = domain.addDays(key, 1)) if (recurrence.occursOn(rule, start, key)) result.push(key);
  return result;
}

test("only the allowed rule subset is accepted and written back canonically", () => {
  for (const text of ["FREQ=DAILY", "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO", "FREQ=WEEKLY;BYDAY=TU,TH", "FREQ=MONTHLY;BYMONTHDAY=15",
    "FREQ=MONTHLY;BYDAY=-1FR;UNTIL=20261231", "FREQ=MONTHLY;BYDAY=2TU", "FREQ=YEARLY;INTERVAL=2"]) {
    assert.equal(recurrence.serializeRule(recurrence.parseRule(text)), text);
  }
  for (const text of ["FREQ=HOURLY", "FREQ=DAILY;COUNT=3", "FREQ=WEEKLY;BYDAY=2MO", "FREQ=MONTHLY;BYDAY=MO", "FREQ=MONTHLY;BYDAY=1MO,2TU",
    "FREQ=YEARLY;BYMONTHDAY=3", "INTERVAL=2", "FREQ=DAILY;UNTIL=20260231", "FREQ=DAILY;FREQ=WEEKLY"]) {
    assert.equal(recurrence.parseRule(text), null, text);
  }
});

test("daily and weekly rules respect interval, weekdays and UNTIL", () => {
  assert.deepEqual(dates("FREQ=DAILY;INTERVAL=3", "2026-11-01", "2026-11-01", "2026-11-10"), ["2026-11-01", "2026-11-04", "2026-11-07", "2026-11-10"]);
  assert.deepEqual(dates("FREQ=WEEKLY;BYDAY=TU,TH", "2026-11-03", "2026-11-01", "2026-11-12"), ["2026-11-03", "2026-11-05", "2026-11-10", "2026-11-12"]);
  assert.deepEqual(dates("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO", "2026-11-16", "2026-11-01", "2026-12-31"), ["2026-11-16", "2026-11-30", "2026-12-14", "2026-12-28"]);
  assert.deepEqual(dates("FREQ=WEEKLY", "2026-11-12", "2026-11-01", "2026-11-30"), ["2026-11-12", "2026-11-19", "2026-11-26"]);
  assert.deepEqual(dates("FREQ=DAILY;UNTIL=20261103", "2026-11-01", "2026-11-01", "2026-11-10"), ["2026-11-01", "2026-11-02", "2026-11-03"]);
});

test("monthly rules on a day of the month and on a position, yearly rules", () => {
  assert.deepEqual(dates("FREQ=MONTHLY;BYMONTHDAY=31", "2026-01-31", "2026-01-01", "2026-05-31"), ["2026-01-31", "2026-03-31", "2026-05-31"]);
  assert.deepEqual(dates("FREQ=MONTHLY;BYDAY=-1FR", "2026-01-30", "2026-01-01", "2026-04-30"), ["2026-01-30", "2026-02-27", "2026-03-27", "2026-04-24"]);
  assert.deepEqual(dates("FREQ=MONTHLY;BYDAY=2TU;INTERVAL=2", "2026-01-13", "2026-01-01", "2026-05-31"), ["2026-01-13", "2026-03-10", "2026-05-12"]);
  assert.deepEqual(dates("FREQ=MONTHLY", "2026-01-15", "2026-01-01", "2026-03-31"), ["2026-01-15", "2026-02-15", "2026-03-15"]);
  assert.deepEqual(dates("FREQ=YEARLY;INTERVAL=2", "2026-03-10", "2026-01-01", "2030-12-31"), ["2026-03-10", "2028-03-10", "2030-03-10"]);
  assert.deepEqual(dates("FREQ=YEARLY", "2024-02-29", "2024-01-01", "2028-12-31"), ["2024-02-29", "2028-02-29"]);
});

test("occurrences skip exceptions, carry done state and are ordered by time, then title", () => {
  /** @param {string} title @param {string} startTime @param {Partial<MDCSeriesLike>} [extra] */
  const series = (title, startTime, extra = {}) => ({
    title, tag: "", start: "2026-11-01", startTime, endTime: "", rule: recurrence.parseRule("FREQ=DAILY"),
    except: [], done: [], location: "", note: [], extra: [], ...extra
  });
  const calendar = {
    newline: "\n", head: [], days: new Map(), multiDay: [], multiDayHead: [], seriesHead: [], seriesRevision: 0,
    series: [series("Zebra", ""), series("Vitamins", "08:00", { done: ["2026-11-12"] }), series("Apple", ""), series("Gone", "07:00", { except: ["2026-11-12"] })]
  };
  const day = recurrence.occurrences(calendar, "2026-11-12");
  assert.deepEqual(plain(day.map((/** @type {any} */ item) => [item.series.title, item.done])), [["Vitamins", true], ["Apple", false], ["Zebra", false]]);
  assert.equal(recurrence.occurrences(calendar, "2026-11-12"), day, "cached while the series revision is unchanged");
  domain.toggleOccurrence(calendar, 0, "2026-11-12").redo();
  assert.deepEqual(plain(recurrence.occurrences(calendar, "2026-11-12").map((/** @type {any} */ item) => item.done)), [true, false, true]);
});

/** @typedef {Record<string, unknown>} MDCSeriesLike */
