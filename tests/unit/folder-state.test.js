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
