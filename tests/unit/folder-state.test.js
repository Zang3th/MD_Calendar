const assert = require("node:assert/strict");
const test = require("node:test");
const { fileSystem } = require("@zang3th/md-libs/harness/testing");
const load = require("./load-classic");

// Reading, unknown fields, newer formats and the update queue are tested in MD_Libs core/json and platform/jsonFile;
// these tests cover the schema and layout of MD_Calendar.json.
const { folderState } = load("io/folder-state.js");
const device = { id: "d1", name: "Windows" };
const now = new Date("2026-11-16T09:30:00.123Z");

/** A folder adapter over an in-memory file system, as MD_Calendar opens it. @param {Record<string, string>} [files] */
async function folder(files = {}) {
  const disk = fileSystem(files);
  const { storage } = await import("@zang3th/md-libs/platform");
  return { disk, adapter: storage.folder(/** @type {any} */ (disk.directory), { files: ["MD_Calendar.json"] }) };
}

test("opening and saving record the device and the fingerprint of each saved file in a stable layout", async () => {
  const { disk, adapter } = await folder();
  const file = folderState.file(adapter, () => {});
  await file.update((/** @type {any} */ document) => folderState.opened(document, device, now));
  await file.update((/** @type {any} */ document) => folderState.saved(document, device, { "Calendar.md": "sha256-ab" }, now));
  assert.equal(disk.text("MD_Calendar.json"), `{
  "format": 1,
  "devices": {
    "d1": {
      "name": "Windows",
      "lastOpened": "2026-11-16T09:30:00Z",
      "lastSaved": "2026-11-16T09:30:00Z"
    }
  },
  "files": {
    "Calendar.md": {
      "hash": "sha256-ab",
      "savedAt": "2026-11-16T09:30:00Z",
      "savedBy": "d1"
    }
  }
}
`);
});

test("a hand-written path and device name survive; missing sections are added", async () => {
  const { disk, adapter } = await folder({ "MD_Calendar.json": JSON.stringify({ format: 1, devices: { d1: { path: "N:\\Calendar", name: "Desktop" } } }) });
  await folderState.file(adapter, () => {}).update((/** @type {any} */ document) => folderState.opened(document, device, now));
  const stored = JSON.parse(disk.text("MD_Calendar.json") || "");
  assert.deepEqual(stored.devices.d1, { name: "Desktop", path: "N:\\Calendar", lastOpened: "2026-11-16T09:30:00Z" });
  assert.deepEqual(stored.files, {});
});

test("the start card summary names this device's path, the device count and who saved last", () => {
  const state = {
    format: 1,
    devices: { d1: { name: "Windows", path: "N:\\Calendar", lastSaved: "2026-11-16T09:00:00Z" }, d2: { name: "Laptop", lastSaved: "2026-11-16T10:00:00Z" } },
    files: {}
  };
  assert.deepEqual(JSON.parse(JSON.stringify(folderState.summary(state, "d1"))), { path: "N:\\Calendar", devices: 2, savedBy: "Laptop" });
  assert.deepEqual(JSON.parse(JSON.stringify(folderState.summary(state, "d2"))), { path: "", devices: 2, savedBy: "this device" });
  assert.deepEqual(JSON.parse(JSON.stringify(folderState.summary({ format: 1 }, "d1"))), { path: "", devices: 0, savedBy: "" });
  assert.equal(folderState.read("{ broken"), null);
  assert.deepEqual(JSON.parse(JSON.stringify(folderState.read('{"format": 1}'))), { format: 1, devices: {}, files: {} });
});

test("the sync section is set up, records a completed synchronization in a stable layout and starts over for another calendar", async () => {
  const { disk, adapter } = await folder({ "MD_Calendar.json": JSON.stringify({ format: 1, devices: {}, files: {}, extra: true }) });
  const file = folderState.file(adapter, () => {});
  assert.equal(folderState.sync({ format: 1 }), null);
  await file.update((/** @type {any} */ document) => folderState.connected(document, "c1@group.calendar.google.com"));
  const operations = [{ record: null, state: "pending", title: "Placeholder", google: { action: "delete" }, choice: "delete-google", kind: "entry", id: "ab12cd34", key: "ab12cd34" }];
  await file.update((/** @type {any} */ document) => folderState.journal(document, { operations, same: [], forgotten: [], open: [], skipped: 0, syncToken: "t", by: "d1", startedAt: "2026-11-16T09:29:00Z" }));
  assert.deepEqual(Object.keys(JSON.parse(disk.text("MD_Calendar.json") || "").sync.journal.operations[0]), ["key", "id", "kind", "choice", "title", "state", "google", "record"]);
  const items = { zz99: { calendar: { tag: "t", title: "a" }, etag: "\"2\"", kind: /** @type {const} */ ("day-off") }, ab12cd34: { kind: /** @type {const} */ ("entry"), etag: "\"1\"", calendar: { title: "b", date: "c" } } };
  const result = { syncToken: "token", items, open: [], counts: { failed: 0, skipped: 1, toCalendar: 2, toGoogle: 3 } };
  await file.update((/** @type {any} */ document) => folderState.synced(document, device, result, now));
  assert.equal(disk.text("MD_Calendar.json"), `{
  "format": 1,
  "devices": {
    "d1": {
      "name": "Windows",
      "lastSynced": "2026-11-16T09:30:00Z"
    }
  },
  "files": {},
  "sync": {
    "calendarId": "c1@group.calendar.google.com",
    "syncToken": "token",
    "last": {
      "at": "2026-11-16T09:30:00Z",
      "by": "d1",
      "toGoogle": 3,
      "toCalendar": 2,
      "skipped": 1,
      "failed": 0
    },
    "items": {
      "ab12cd34": {
        "kind": "entry",
        "etag": "\\"1\\"",
        "calendar": {
          "date": "c",
          "title": "b"
        }
      },
      "zz99": {
        "kind": "day-off",
        "etag": "\\"2\\"",
        "calendar": {
          "title": "a",
          "tag": "t"
        }
      }
    },
    "journal": null
  },
  "extra": true
}
`);
  const same = folderState.connected(JSON.parse(disk.text("MD_Calendar.json") || ""), "c1@group.calendar.google.com");
  assert.equal(same.sync?.syncToken, "token");
  const other = folderState.connected(same, "c2@group.calendar.google.com");
  assert.deepEqual(JSON.parse(JSON.stringify(other.sync)), { calendarId: "c2@group.calendar.google.com", items: {}, journal: null });
});

test("a check is recorded apart from the last synchronization; only one without differences stores the new state", () => {
  const last = { at: "2026-11-10T08:00:00Z", by: "d1", toGoogle: 1, toCalendar: 0, skipped: 0, failed: 0 };
  const start = { format: 1, devices: {}, files: {}, sync: { calendarId: "c1", syncToken: "old", last, items: {}, journal: null } };
  const items = { ab12cd34: { kind: /** @type {const} */ ("entry"), etag: "\"1\"", calendar: { title: "b" } } };
  const found = JSON.parse(JSON.stringify(folderState.checked(start, device, { differences: 2 }, now).sync));
  assert.deepEqual(found, { ...start.sync, checked: { at: "2026-11-16T09:30:00Z", by: "d1", differences: 2 } });
  const inSync = JSON.parse(JSON.stringify(folderState.checked(start, device, { differences: 0, inSync: { syncToken: "new", items, open: [] } }, now)));
  assert.deepEqual([inSync.sync.syncToken, inSync.sync.items, inSync.sync.last, inSync.sync.checked.differences, inSync.devices], ["new", items, last, 0, {}]);
});
