const assert = require("node:assert/strict");
const test = require("node:test");
const load = require("./load-classic");

// The comparison of the synchronization (docs/Domain.md#synchronization-with-google), with placeholder data only.
const app = load("domain/calendar.js", "domain/recurrence.js", "domain/sync.js", "io/calendar-format.js", "io/backlog-format.js");
const { sync } = app;
const zone = "Europe/Berlin";
const tags = [{ name: "Private", color: "#458588", icon: "home" }, { name: "Work", color: "#d79921", icon: "briefcase" }, { name: "Car", color: "#689d6a", icon: "car" }];

/** @param {unknown} value */
const plain = value => JSON.parse(JSON.stringify(value));

/** A calendar and backlog from their Markdown. @param {string[]} calendarLines @param {string[]} [backlogLines] */
function folder(calendarLines, backlogLines = []) {
  return {
    calendar: app.calendarFormat.parse(["# Calendar", "", ...calendarLines, ""].join("\n")).calendar,
    backlog: app.backlogFormat.parse(["# Backlog", "", ...backlogLines, ""].join("\n")).backlog
  };
}

/** A timed Google event as the API returns it. @param {string} id @param {string} start @param {string} end @param {object} [extra] */
const timed = (id, start, end, extra = {}) => ({ id, etag: `"${id}-2"`, status: "confirmed", summary: "Placeholder", start: { dateTime: start }, end: { dateTime: end }, ...extra });

/** The recorded state of a local item as the last synchronization left it. @param {any} local @param {string} id */
function recorded(local, id) {
  const item = local.items.get(id);
  return { kind: item.kind, etag: `"${id}-1"`, calendar: sync.fingerprints(item.fields) };
}

/** Compares and returns each difference as [id, case, preselected]. @param {object} input */
function cases(input) {
  const result = sync.compare({ full: false, timeZone: zone, tags, events: [], base: {}, ...input });
  return { result, rows: plain(result.differences.map((/** @type {any} */ difference) => [difference.id, difference.case, difference.preselected])) };
}

test("tags travel as the closest Google color and a private property; the color alone names a tag only when it is unique", () => {
  const ids = tags.map(tag => sync.colorId(tag.color));
  assert.ok(ids.every(id => /^(?:[1-9]|1[01])$/.test(id)));
  assert.equal(sync.eventTag({ colorId: ids[0], extendedProperties: { private: { mdcTag: "Work" } } }, tags), "Work");
  assert.equal(sync.eventTag({ colorId: sync.colorId("#d79921") }, tags), "Work");
  const twins = [...tags, { name: "Garden", color: "#d79922", icon: "home" }];
  assert.equal(sync.eventTag({ colorId: sync.colorId("#d79921") }, twins), "");
  assert.equal(sync.eventTag({}, tags), "");
});

test("Google events map into the calendar's time zone; an end equal to the start means no end time", () => {
  const read = (/** @type {any} */ event) => plain(sync.fromEvent(event, zone, tags));
  assert.deepEqual(read(timed("a", "2026-11-27T09:30:00+01:00", "2026-11-27T10:15:00+01:00", { location: "Room 1", description: "Line one<br>Line &amp; two" })),
    { state: "entry", fields: { date: "2026-11-27", time: "09:30-10:15", title: "Placeholder", location: "Room 1", note: "Line one\nLine & two", tag: "" } });
  assert.equal(read(timed("b", "2026-11-27T09:00:00-05:00", "2026-11-27T09:00:00-05:00")).fields.time, "15:00");
  assert.equal(read(timed("c", "2027-07-01T09:00:00+02:00", "2027-07-01T09:00:00+02:00")).fields.time, "09:00");
  assert.equal(read(timed("d", "2026-11-27T22:00:00+01:00", "2026-11-28T02:00:00+01:00")).state, "several-days");
  assert.equal(read(timed("e", "2026-11-20T09:00:00+01:00", "2026-11-20T10:00:00+01:00")).state, "before-cutover");
  assert.deepEqual(read({ id: "f", summary: "Trip", start: { date: "2026-12-01" }, end: { date: "2026-12-04" } }).fields, { start: "2026-12-01", end: "2026-12-03", title: "Trip", location: "", note: "", tag: "" });
  assert.deepEqual(read({ id: "g", status: "cancelled" }), { state: "deleted" });
  assert.deepEqual(read({ id: "h_20261201", recurringEventId: "h" }), { state: "instance", master: "h" });
  assert.equal(read({ id: "i", recurrence: ["RRULE:FREQ=DAILY"], start: { dateTime: "2026-12-01T09:00:00+01:00" } }).state, "series");
});

test("local items become Google events with only the mapped fields", () => {
  const entry = sync.toEvent("entry", { date: "2026-11-27", time: "09:30", title: "Dentist", location: "", note: "Bring it", tag: "Private" }, zone, tags);
  assert.deepEqual(plain(entry), {
    summary: "Dentist", location: "", description: "Bring it", colorId: sync.colorId("#458588"), extendedProperties: { private: { mdcTag: "Private" } },
    start: { dateTime: "2026-11-27T09:30:00", timeZone: zone }, end: { dateTime: "2026-11-27T09:30:00", timeZone: zone }
  });
  const dayOff = plain(sync.toEvent("day-off", { start: "2026-12-04", end: "2026-12-04", title: "Overtime", location: "", note: "" }, zone, tags));
  assert.deepEqual([dayOff.start, dayOff.end, dayOff.extendedProperties.private.mdcTag, dayOff.colorId], [{ date: "2026-12-04" }, { date: "2026-12-05" }, "DayOff", null]);
  const series = plain(sync.toEvent("series", { start: "2026-11-24 18:30-20:00", rule: "FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20261231", except: "2026-12-01", title: "Gym", location: "", note: "", tag: "" }, zone, tags));
  assert.deepEqual(series.recurrence, ["RRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20261231T225900Z", "EXDATE;TZID=Europe/Berlin:20261201T183000"]);
  assert.deepEqual([series.start, series.end], [{ dateTime: "2026-11-24T18:30:00", timeZone: zone }, { dateTime: "2026-11-24T20:00:00", timeZone: zone }]);
});

test("only timed entries, days off, multi-day entries and timed series from the cutover on take part; IDs out of range are remembered", () => {
  const { calendar, backlog } = folder([
    "## November 2026", "",
    "### 20.11.2026", "- [ ] 09:00 Old {sync=old00001}", "",
    "### 24.11.2026", "- [ ] 09:00 Call {sync=call0001}", "- [ ] Loose task", "- [ ] Untimed {sync=gone0001}", "- [ ] 10:00 New one", "- [ ] 11:00 Twin {sync=call0001}", "- [x] Overtime #DayOff", "",
    "## Multi-day", "", "### Trip", "#Start", "- 01.12.2026", "#End", "- 03.12.2026", "",
    "## Recurring", "", "### Gym", "#Sync", "- gm000001", "#Start", "- 24.11.2026 18:30", "#Repeat", "- FREQ=WEEKLY;BYDAY=TU", "",
    "### Plants", "#Start", "- 24.11.2026", "#Repeat", "- FREQ=DAILY"
  ], ["- [ ] Later {sync=park0001}"]);
  const local = sync.collect(calendar, backlog);
  assert.deepEqual(plain([...local.items.keys()]), ["call0001", "gm000001"]);
  assert.deepEqual(plain(local.fresh.map((/** @type {any} */ item) => [item.kind, item.fields.title || item.fields.start])), [["entry", "New one"], ["entry", "Twin"], ["day-off", "Overtime"], ["multi-day", "Trip"]]);
  assert.deepEqual(plain([...local.away].map(([id, away]) => [id, away.reason])), [["old00001", "before-cutover"], ["gone0001", "no-time"], ["park0001", "backlog"]]);
  assert.deepEqual(plain(local.duplicates), ["call0001"]);
  assert.deepEqual(plain(local.items.get("gm000001").fields), { start: "2026-11-24 18:30", rule: "FREQ=WEEKLY;BYDAY=TU", except: "", title: "Gym", location: "", note: "", tag: "" });
});

test("one-sided changes are copied, conflicts and deletions wait for a decision, leaving the range locally removes from Google", () => {
  const { calendar, backlog } = folder([
    "## November 2026", "",
    "### 24.11.2026",
    "- [ ] 09:00 Same {sync=same0001}", "- [ ] 09:30 Edited here {sync=mine0001}", "- [ ] 10:00 Theirs {sync=them0001}",
    "- [ ] 11:00 Both {sync=both0001}", "- [ ] 12:00 Clash {sync=clsh0001}", "- [ ] 13:00 Removed there {sync=rmgo0001}", "- [ ] 14:00 Made all-day {sync=lfgo0001}",
    "- [ ] 18:00 Fresh"
  ], ["- [ ] Parked {sync=park0001}"]);
  const before = folder([
    "## November 2026", "",
    "### 24.11.2026",
    "- [ ] 09:00 Same {sync=same0001}", "- [ ] 09:30 Mine {sync=mine0001}", "- [ ] 10:00 Theirs {sync=them0001}",
    "- [ ] 11:00 Both {sync=both0001}", "- [ ] 12:00 Clash {sync=clsh0001}", "- [ ] 13:00 Removed there {sync=rmgo0001}", "- [ ] 14:00 Made all-day {sync=lfgo0001}",
    "- [ ] 15:00 Parked {sync=park0001}", "- [ ] 16:00 Deleted here {sync=dele0001}", "- [ ] 17:00 Gone both {sync=bgon0001}"
  ]);
  const earlier = sync.collect(before.calendar, before.backlog);
  const base = Object.fromEntries([...earlier.items.keys()].map(id => [id, recorded(earlier, id)]));
  const local = sync.collect(calendar, backlog);
  local.items.get("both0001").fields.time = "11:30";
  local.items.get("clsh0001").fields.title = "Clash here";
  const events = [
    timed("them0001", "2026-11-24T10:00:00+01:00", "2026-11-24T10:00:00+01:00", { summary: "Theirs changed" }),
    timed("both0001", "2026-11-24T11:30:00+01:00", "2026-11-24T11:30:00+01:00", { summary: "Both" }),
    timed("clsh0001", "2026-11-24T12:00:00+01:00", "2026-11-24T12:00:00+01:00", { summary: "Clash there" }),
    { id: "rmgo0001", status: "cancelled" }, { id: "bgon0001", status: "cancelled" },
    { id: "lfgo0001", etag: "\"x\"", summary: "Made all-day", start: { date: "2026-11-24" }, end: { date: "2026-11-25" } },
    timed("phon0001", "2026-11-25T08:00:00+01:00", "2026-11-25T08:30:00+01:00", { summary: "From the phone" }),
    timed("long0001", "2026-11-25T22:00:00+01:00", "2026-11-26T02:00:00+01:00"),
    { id: "gser0001", recurrence: ["RRULE:FREQ=DAILY"], start: { dateTime: "2026-11-25T07:00:00+01:00" }, end: { dateTime: "2026-11-25T07:30:00+01:00" } }
  ];
  const { result, rows } = cases({ local, base, events });
  assert.deepEqual([...rows].sort(), [
    ["mine0001", "changed-local", "to-google"],
    ["them0001", "changed-google", "to-calendar"],
    ["clsh0001", "conflict", null],
    ["rmgo0001", "deleted-google", null],
    ["lfgo0001", "left-google", null],
    ["", "new-local", "to-google"],
    ["park0001", "left-local", "delete-google"],
    ["dele0001", "deleted-local", null],
    ["phon0001", "new-google", "to-calendar"],
    ["long0001", "note", null],
    ["gser0001", "note", null]
  ].sort());
  assert.equal(rows.length, 11);
  assert.deepEqual(plain(result.same.map((/** @type {any} */ item) => item.id)), ["both0001"]);
  assert.deepEqual(plain(result.forgotten), ["bgon0001"]);
  const clash = result.differences.find((/** @type {any} */ difference) => difference.id === "clsh0001");
  assert.deepEqual(plain(clash.choices), ["to-calendar", "to-google"]);
  assert.equal(result.differences.find((/** @type {any} */ difference) => difference.id === "phon0001").google.title, "From the phone");
});

test("a conflict in different fields can be combined field by field", () => {
  const { calendar, backlog } = folder(["## November 2026", "", "### 24.11.2026", "- [ ] 09:00 Renamed here {sync=comb0001}"]);
  const before = folder(["## November 2026", "", "### 24.11.2026", "- [ ] 09:00 Original {sync=comb0001}"]);
  const earlier = sync.collect(before.calendar, before.backlog);
  const event = timed("comb0001", "2026-11-24T10:00:00+01:00", "2026-11-24T10:00:00+01:00", { summary: "Original" });
  const { result } = cases({ local: sync.collect(calendar, backlog), base: { comb0001: recorded(earlier, "comb0001") }, events: [event] });
  const [conflict] = result.differences;
  assert.deepEqual(plain([conflict.case, conflict.choices, conflict.changed]), ["conflict", ["to-calendar", "combine", "to-google"], { calendar: ["title"], google: ["time"] }]);
  assert.deepEqual(plain(sync.combined(conflict)), { date: "2026-11-24", time: "10:00", title: "Renamed here", location: "", note: "", tag: "" });
});

test("exports offer keep or ignore when Google changed them, also through one occurrence; ignored states stay quiet", () => {
  const { calendar, backlog } = folder([
    "## Multi-day", "", "### Trip", "#Sync", "- trip0001", "#Start", "- 01.12.2026", "#End", "- 03.12.2026", "",
    "## Recurring", "", "### Gym", "#Sync", "- gm000001", "#Start", "- 24.11.2026 18:30", "#Repeat", "- FREQ=WEEKLY;BYDAY=TU"
  ]);
  const local = sync.collect(calendar, backlog);
  const base = { trip0001: recorded(local, "trip0001"), gm000001: recorded(local, "gm000001") };
  const own = { id: "trip0001", etag: "\"trip0001-1\"", start: { date: "2026-12-01" }, end: { date: "2026-12-04" } };
  assert.deepEqual(cases({ local, base, events: [own] }).rows, []);
  const { rows } = cases({ local, base, events: [{ ...own, etag: "\"trip0001-2\"" }, { id: "gm000001_20261201T173000Z", recurringEventId: "gm000001" }] });
  assert.deepEqual(rows.map((/** @type {any} */ row) => [row[0], row[1], row[2]]), [["trip0001", "export-changed", null], ["gm000001", "export-changed", null]]);
  const ignored = { ...base.trip0001, etag: "\"trip0001-2\"" };
  assert.deepEqual(cases({ local, base: { ...base, trip0001: ignored }, events: [{ ...own, etag: "\"trip0001-2\"" }] }).rows, []);
});

test("a full comparison treats missing events as deleted in Google, and items without a recorded state as new or compared directly", () => {
  const { calendar, backlog } = folder(["## November 2026", "", "### 24.11.2026", "- [ ] 09:00 Kept {sync=kept0001}", "- [ ] 10:00 Lost {sync=lost0001}", "- [ ] 11:00 Unknown {sync=unkn0001}", "- [ ] 12:00 Equal {sync=eqal0001}"]);
  const local = sync.collect(calendar, backlog);
  const base = { kept0001: recorded(local, "kept0001"), lost0001: recorded(local, "lost0001") };
  const events = [
    timed("kept0001", "2026-11-24T09:00:00+01:00", "2026-11-24T09:00:00+01:00", { summary: "Kept" }),
    timed("eqal0001", "2026-11-24T12:00:00+01:00", "2026-11-24T12:00:00+01:00", { summary: "Equal" })
  ];
  const { result, rows } = cases({ local, base, events, full: true });
  assert.deepEqual(rows, [["lost0001", "deleted-google", null], ["unkn0001", "new-local", "to-google"]]);
  assert.deepEqual(plain(result.same.map((/** @type {any} */ item) => item.id)), ["eqal0001"]);
});
