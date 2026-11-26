const assert = require("node:assert/strict");
const test = require("node:test");
const load = require("./load-classic");

// Applying a synchronization against an in-memory Google (docs/Architecture.md#journal), with placeholder data only.
const app = load("domain/calendar.js", "domain/recurrence.js", "domain/backlog.js", "domain/sync.js", "domain/sync-plan.js", "io/calendar-format.js", "io/backlog-format.js");
const { sync, syncPlan } = app;
const zone = "Europe/Berlin";
const context = { timeZone: zone, tags: [], by: "d1", startedAt: "2026-11-26T10:00:00Z", syncToken: "next" };

/** @param {unknown} value */
const plain = value => JSON.parse(JSON.stringify(value));

/** @param {string[]} calendarLines @param {string[]} [backlogLines] */
function folder(calendarLines, backlogLines = []) {
  return {
    calendar: app.calendarFormat.parse(["# Calendar", "", ...calendarLines, ""].join("\n")).calendar,
    backlog: app.backlogFormat.parse(["# Backlog", "", ...backlogLines, ""].join("\n")).backlog
  };
}

/** @param {string} id @param {string} time @param {string} summary @param {string} [etag] */
const event = (id, time, summary, etag = `"${id}-1"`) => ({ id, etag, status: "confirmed", summary, start: { dateTime: `2026-11-24T${time}:00+01:00` }, end: { dateTime: `2026-11-24T${time}:00+01:00` } });

/** An in-memory Google calendar behind the client interface. @param {any[]} initial @param {{fail?: string}} [options] */
function fakeGoogle(initial, { fail = "" } = {}) {
  const events = new Map(initial.map(item => [item.id, { ...item }]));
  const calls = /** @type {string[]} */ ([]);
  let version = 100;
  /** @param {string} action @param {string} id */
  const check = (action, id) => {
    calls.push(`${action} ${id}`);
    if (fail === id) throw Object.assign(new Error("Bad Request"), { code: "MDC-406", detail: "HTTP 400 Invalid value" });
    if (fail === "offline") throw Object.assign(new Error("No connection to Google"), { code: "MDC-405", detail: "" });
  };
  const client = {
    async insert(/** @type {any} */ body) {
      check("insert", body.id);
      if (events.has(body.id)) return { status: "exists" };
      const created = { ...body, etag: `"${version++}"`, status: "confirmed" };
      events.set(body.id, created);
      return { status: "created", event: created };
    },
    async patch(/** @type {string} */ id, /** @type {any} */ fields, /** @type {string} */ etag) {
      check("patch", id);
      const current = events.get(id);
      if (!current || (current.status === "cancelled" && fields.status !== "confirmed")) return { status: "gone" };
      if (etag && current.etag !== etag) return { status: "changed" };
      const updated = { ...current, ...fields, etag: `"${version++}"` };
      events.set(id, updated);
      return { status: "updated", event: updated };
    },
    async remove(/** @type {string} */ id) {
      check("remove", id);
      events.delete(id);
      return { status: "deleted" };
    },
    async get(/** @type {string} */ id) { return events.get(id) || { id, status: "cancelled" }; }
  };
  return { events, calls, client: /** @type {any} */ (client) };
}

/** The recorded state of every local item with an ID, as if it had just been synchronized. @param {any} local */
function recordedAll(local) {
  return Object.fromEntries([...local.items].map(([id, item]) => [id, { kind: item.kind, etag: `"${id}-1"`, calendar: sync.fingerprints(item.fields) }]));
}

/** A calendar with one difference of each applied kind, its Google side and the recorded state. */
function scenario() {
  const before = folder(["## November 2026", "", "### 24.11.2026",
    "- [ ] 09:00 Mine {sync=mine0001}", "- [ ] 10:00 Theirs {sync=them0001}", "- [ ] 11:00 Original {sync=comb0001}",
    "- [ ] 12:00 Parked {sync=park0001}", "- [ ] 13:00 Removed there {sync=rmgo0001}", "- [ ] 14:00 Clash {sync=clsh0001}"]);
  const base = recordedAll(sync.collect(before.calendar, before.backlog));
  const now = folder(["## November 2026", "", "### 24.11.2026",
    "- [ ] 09:00 Mine edited {sync=mine0001}", "- [ ] 10:00 Theirs {sync=them0001}", "- [ ] 11:00 Renamed here {sync=comb0001}",
    "- [ ] 13:00 Removed there {sync=rmgo0001}", "- [ ] 14:00 Clash here {sync=clsh0001}", "- [ ] 15:00 Fresh"], ["- [ ] Parked {sync=park0001}"]);
  const google = fakeGoogle([
    event("mine0001", "09:00", "Mine"), event("them0001", "10:00", "Theirs changed", "\"them0001-2\""),
    event("comb0001", "11:30", "Original", "\"comb0001-2\""), event("park0001", "12:00", "Parked"),
    { id: "rmgo0001", status: "cancelled", etag: "\"rmgo0001-2\"" }, event("clsh0001", "14:00", "Clash there", "\"clsh0001-2\""),
    event("phon0001", "08:00", "From the phone")
  ]);
  const changed = ["them0001", "comb0001", "rmgo0001", "clsh0001", "phon0001"].map(id => google.events.get(id));
  const comparison = sync.compare({ local: sync.collect(now.calendar, now.backlog), base, events: changed, full: false, timeZone: zone, tags: [] });
  return { ...now, base, google, comparison };
}

test("a plan applies every chosen difference on both sides; the local changes are one undo action", async () => {
  const { calendar, backlog, base, google, comparison } = scenario();
  const ids = ["fresh001"];
  const journal = syncPlan.plan(comparison, { comb0001: "combine", rmgo0001: "delete-calendar" }, { ...context, base, newId: () => /** @type {string} */ (ids.shift()) });
  assert.deepEqual(plain(journal.operations.map((/** @type {any} */ operation) => [operation.id, operation.choice, operation.google?.action || "", operation.local?.action || ""])), [
    ["park0001", "delete-google", "delete", "unlink"], ["phon0001", "to-calendar", "", "import"], ["mine0001", "to-google", "patch", ""],
    ["them0001", "to-calendar", "", "change"], ["comb0001", "combine", "patch", "change"], ["rmgo0001", "delete-calendar", "", "remove"],
    ["fresh001", "to-google", "insert", "link"]
  ]);
  assert.deepEqual(plain([journal.open, journal.skipped]), [["clsh0001"], 1]);
  const before = app.calendarFormat.serialize(calendar);
  await syncPlan.run({ journal, client: google.client });
  assert.ok(journal.operations.every((/** @type {any} */ operation) => operation.state === "done"));
  assert.equal(google.events.get("comb0001").summary, "Renamed here");
  assert.equal(google.events.get("comb0001").start.dateTime, "2026-11-24T11:30:00");
  assert.equal(google.events.get("fresh001").summary, "Fresh");
  assert.equal(google.events.has("park0001"), false);

  const action = syncPlan.applyLocal(calendar, backlog, journal);
  assert.equal(action?.label, "Sync with Google (6 changes)");
  assert.equal(app.calendarFormat.serialize(calendar), before, "nothing changes until the action is executed");
  action?.redo();
  assert.equal(app.calendarFormat.serialize(calendar), [
    "# Calendar", "", "## November 2026", "", "### 24.11.2026",
    "- [ ] 08:00 From the phone {sync=phon0001}", "- [ ] 09:00 Mine edited {sync=mine0001}", "- [ ] 10:00 Theirs changed {sync=them0001}",
    "- [ ] 11:30 Renamed here {sync=comb0001}", "- [ ] 14:00 Clash here {sync=clsh0001}", "- [ ] 15:00 Fresh {sync=fresh001}", ""
  ].join("\n"));
  assert.equal(app.backlogFormat.serialize(backlog), "# Backlog\n\n- [ ] Parked\n");
  action?.undo();
  assert.equal(app.calendarFormat.serialize(calendar), before);

  const { items, open, counts } = syncPlan.record(base, journal);
  assert.deepEqual(plain(Object.keys(items).sort()), ["clsh0001", "comb0001", "fresh001", "mine0001", "phon0001", "them0001"]);
  assert.equal(items.fresh001.etag, google.events.get("fresh001").etag);
  assert.deepEqual(plain([open, counts]), [["clsh0001"], { toGoogle: 4, toCalendar: 4, skipped: 1, failed: 0 }]);
});

test("cancelling stops after the running operation; running the journal again finishes it without duplicates", async () => {
  const { base, google, comparison } = scenario();
  const journal = syncPlan.plan(comparison, {}, { ...context, base, newId: () => "fresh001" });
  /** @type {number[]} */
  const persisted = [];
  let started = 0;
  await syncPlan.run({
    journal, client: google.client, cancelled: () => started >= 2,
    progress: (/** @type {any} */ operation) => { if (operation.state === "pending") started += 1; },
    persist: async (/** @type {any} */ stored) => { persisted.push(stored.operations.filter((/** @type {any} */ operation) => operation.state === "done").length); }
  });
  assert.deepEqual(plain(journal.operations.map((/** @type {any} */ operation) => operation.state)), ["done", "done", "pending", "pending", "pending"]);
  assert.deepEqual(persisted, [2]);
  // An interrupted run created the new event already: completing the journal finds it and does not create it twice.
  const fresh = /** @type {any} */ (journal.operations.find((/** @type {any} */ operation) => operation.id === "fresh001"));
  assert.equal(fresh.state, "pending");
  google.events.set("fresh001", { id: "fresh001", etag: "\"7\"", status: "confirmed", summary: "Fresh" });
  await syncPlan.run({ journal, client: google.client });
  assert.ok(journal.operations.every((/** @type {any} */ operation) => operation.state === "done"));
  assert.deepEqual(google.calls.filter(call => call.endsWith("fresh001")), ["insert fresh001", "patch fresh001"]);
});

test("an event changed in Google since the check stays open; a refused operation fails alone; a lost connection stops the run", async () => {
  const first = scenario();
  first.google.events.set("mine0001", { ...first.google.events.get("mine0001"), etag: "\"later\"" });
  const journal = syncPlan.plan(first.comparison, {}, { ...context, base: first.base, newId: () => "fresh001" });
  await syncPlan.run({ journal, client: first.google.client });
  const mine = journal.operations.find((/** @type {any} */ operation) => operation.id === "mine0001");
  assert.deepEqual(plain([mine?.state, mine?.reason]), ["open", "changed-meanwhile"]);
  const recorded = syncPlan.record(first.base, journal);
  assert.ok(recorded.open.includes("mine0001"));
  assert.equal(recorded.items.mine0001.etag, "\"mine0001-1\"", "the open item keeps its recorded state");

  const second = scenario();
  const refused = fakeGoogle([...second.google.events.values()], { fail: "mine0001" });
  const again = syncPlan.plan(second.comparison, {}, { ...context, base: second.base, newId: () => "fresh001" });
  await syncPlan.run({ journal: again, client: refused.client });
  assert.deepEqual(plain(again.operations.map((/** @type {any} */ operation) => operation.state)), ["done", "done", "failed", "done", "done"]);
  assert.equal(syncPlan.record(second.base, again).counts.failed, 1);

  const third = scenario();
  const offline = fakeGoogle([], { fail: "offline" });
  const stopped = syncPlan.plan(third.comparison, {}, { ...context, base: third.base, newId: () => "fresh001" });
  let saved = 0;
  await assert.rejects(syncPlan.run({ journal: stopped, client: offline.client, persist: async () => { saved += 1; } }), (/** @type {any} */ error) => error.code === "MDC-405");
  assert.equal(saved, 1, "the journal is stored before the run stops");
});

test("an unselected change in Google is read again next time; a new item that changed before linking is not linked", () => {
  const { calendar, backlog, base, comparison } = scenario();
  const journal = syncPlan.plan(comparison, { clsh0001: "to-calendar", them0001: null }, { ...context, base, newId: () => "fresh001" });
  assert.ok(journal.open.includes("them0001"));
  const fresh = journal.operations.find((/** @type {any} */ operation) => operation.id === "fresh001");
  for (const operation of journal.operations) operation.state = "done";
  /** @type {any} */ (calendar.days.get("2026-11-24")).entries[5].title = "Fresh, edited meanwhile";
  syncPlan.applyLocal(calendar, backlog, journal)?.redo();
  assert.deepEqual(plain([fresh?.state, fresh?.reason]), ["open", "missing-locally"]);
  assert.equal(syncPlan.record(base, journal).items.fresh001, undefined);
});

test("an export changed in Google is set back with keep, or recorded as seen with ignore", async () => {
  const { calendar, backlog } = folder(["## Multi-day", "", "### Trip", "#Sync", "- trip0001", "#Start", "- 01.12.2026", "#End", "- 03.12.2026", "",
    "### Fair", "#Sync", "- fair0001", "#Start", "- 05.12.2026", "#End", "- 06.12.2026"]);
  const local = sync.collect(calendar, backlog);
  const base = recordedAll(local);
  const google = fakeGoogle([
    { id: "trip0001", etag: "\"trip0001-2\"", status: "confirmed", summary: "Trip moved", start: { date: "2026-12-02" }, end: { date: "2026-12-05" } },
    { id: "fair0001", etag: "\"fair0001-2\"", status: "confirmed", summary: "Fair renamed", start: { date: "2026-12-05" }, end: { date: "2026-12-07" } }
  ]);
  const comparison = sync.compare({ local, base, events: [...google.events.values()], full: false, timeZone: zone, tags: [] });
  const journal = syncPlan.plan(comparison, { trip0001: "keep", fair0001: "ignore" }, { ...context, base, newId: () => "unused00" });
  await syncPlan.run({ journal, client: google.client });
  assert.deepEqual(plain([google.events.get("trip0001").summary, google.events.get("trip0001").start.date, google.events.get("fair0001").summary]), ["Trip", "2026-12-01", "Fair renamed"]);
  const { items } = syncPlan.record(base, journal);
  assert.equal(items.fair0001.etag, "\"fair0001-2\"");
  assert.equal(items.trip0001.etag, google.events.get("trip0001").etag);
  assert.equal(sync.compare({ local, base: items, events: [google.events.get("fair0001")], full: false, timeZone: zone, tags: [] }).differences.length, 0);
});

test("completing a journal again after its local changes were saved changes nothing twice", async () => {
  const { calendar, backlog, base, google, comparison } = scenario();
  const journal = syncPlan.plan(comparison, { comb0001: "combine", rmgo0001: "delete-calendar" }, { ...context, base, newId: () => "fresh001" });
  await syncPlan.run({ journal, client: google.client });
  syncPlan.applyLocal(calendar, backlog, journal)?.redo();
  const once = [app.calendarFormat.serialize(calendar), app.backlogFormat.serialize(backlog)];
  // An interruption after saving: the journal is completed again on the saved files.
  assert.equal(syncPlan.applyLocal(calendar, backlog, journal), null);
  assert.deepEqual([app.calendarFormat.serialize(calendar), app.backlogFormat.serialize(backlog)], once);
  assert.ok(journal.operations.every((/** @type {any} */ operation) => operation.state === "done"));
});
