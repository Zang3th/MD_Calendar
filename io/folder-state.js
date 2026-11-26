import { json } from "@zang3th/md-libs/core";
import { jsonFile } from "@zang3th/md-libs/platform";

window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// MD_Calendar.json: technical data of the calendar folder that does not belong in Markdown
// (see docs/DataFormat.md#md_calendarjson). Reading, writing and the layout rules are MD_Libs core/json and platform/jsonFile.
(function (app) {
  const fileName = "MD_Calendar.json";
  const format = 1;
  const sorted = /** @type {"sorted"} */ ("sorted");
  const syncFields = ["date", "time", "title", "location", "note", "tag", "start", "end", "rule", "except"];
  const order = {
    "": ["format", "devices", "files", "sync"],
    devices: sorted,
    "devices.*": ["name", "path", "lastOpened", "lastSaved", "lastSynced"],
    files: sorted,
    "files.*": ["hash", "savedAt", "savedBy"],
    sync: ["calendarId", "syncToken", "last", "items", "open", "journal"],
    "sync.last": ["at", "by", "calendarHash", "toGoogle", "toCalendar", "skipped", "failed"],
    "sync.items": sorted,
    "sync.items.*": ["kind", "etag", "calendar", "google"],
    "sync.items.*.calendar": syncFields,
    "sync.items.*.google": syncFields,
    "sync.journal": ["startedAt", "by", "syncToken", "skipped", "open", "forgotten", "same", "operations"],
    // The items of an array share the array's path.
    "sync.journal.operations": ["key", "id", "kind", "choice", "title", "state", "reason", "error", "google", "local", "record"]
  };

  /** @returns {MDCFolderState} */
  function create() {
    return { format, devices: {}, files: {} };
  }

  const isObject = (/** @type {unknown} */ value) => typeof value === "object" && value !== null && !Array.isArray(value);

  /** @param {Record<string, any>} state @returns {MDCFolderState} */
  function normalized(state) {
    return /** @type {MDCFolderState} */ ({ ...state, devices: isObject(state.devices) ? state.devices : {}, files: isObject(state.files) ? state.files : {} });
  }

  /**
   * The sync section, `null` while the synchronization is not set up. Missing parts are filled in; unknown fields are kept.
   * @param {Record<string, any>} state @returns {MDCSyncState | null}
   */
  function sync(state) {
    const section = state.sync;
    if (!isObject(section) || typeof section.calendarId !== "string" || !section.calendarId) return null;
    return { ...section, items: isObject(section.items) ? section.items : {}, journal: isObject(section.journal) ? section.journal : null };
  }

  /** @param {Record<string, any>} state @param {Partial<MDCSyncState>} changes */
  function withSync(state, changes) {
    const current = /** @type {MDCSyncState} */ (sync(state));
    return { ...normalized(state), sync: { ...current, ...changes } };
  }

  /**
   * Records the calendar set up in the sync dialog. Another calendar than before starts over: its token, its items and
   * the last synchronization belong to the old calendar (docs/DataFormat.md#md_calendarjson).
   * @param {Record<string, any>} state @param {string} calendarId
   */
  function connected(state, calendarId) {
    const current = sync(state);
    if (current?.calendarId === calendarId) return normalized(state);
    return { ...normalized(state), sync: { calendarId, items: {}, journal: null } };
  }

  /** Stores or removes the journal of a synchronization being applied. @param {Record<string, any>} state @param {MDCSyncJournal | null} journal */
  function journal(state, journal) {
    return withSync(state, { journal });
  }

  /**
   * Records a completed synchronization: the new sync token and item states, the last run and its device; the journal is
   * removed. @param {Record<string, any>} state @param {MDCDevice} device @param {MDCSyncResult} result @param {Date} now
   */
  function synced(state, device, result, now) {
    const at = stamp(now);
    const { toGoogle, toCalendar, skipped, failed } = result.counts;
    const next = withSync(state, {
      syncToken: result.syncToken,
      last: { at, by: device.id, calendarHash: result.calendarHash, toGoogle, toCalendar, skipped, failed },
      items: result.items,
      // Written only while differences are open.
      open: result.open.length ? result.open : undefined,
      journal: null
    });
    return withDevice(next, device, { lastSynced: at });
  }

  /** UTC time without milliseconds, for example 2026-11-16T09:30:00Z. @param {Date} now */
  function stamp(now) {
    return now.toISOString().replace(/\.\d{3}Z$/, "Z");
  }

  /** @param {MDCFolderState} state @param {MDCDevice} device @param {Record<string, string>} changes */
  function withDevice(state, device, changes) {
    return { ...state, devices: { ...state.devices, [device.id]: { name: device.name, ...state.devices[device.id], ...changes } } };
  }

  /** Records that `device` opened the folder. @param {Record<string, any>} state @param {MDCDevice} device @param {Date} now */
  function opened(state, device, now) {
    return withDevice(normalized(state), device, { lastOpened: stamp(now) });
  }

  /**
   * Records the files `device` saved, with the fingerprint of the content written.
   * @param {Record<string, any>} state @param {MDCDevice} device @param {Record<string, string>} hashes @param {Date} now
   */
  function saved(state, device, hashes, now) {
    const at = stamp(now);
    const next = withDevice(normalized(state), device, { lastSaved: at });
    const files = { ...next.files };
    for (const [name, hash] of Object.entries(hashes)) files[name] = { ...files[name], hash, savedAt: at, savedBy: device.id };
    return { ...next, files };
  }

  /** The stored text as a state; `null` when unreadable. @param {string} text */
  function read(text) {
    const { value } = json.read(text, { format });
    return value ? normalized(value) : null;
  }

  /**
   * What the start card shows of a folder: the path entered for this device, the number of devices
   * and the device that saved last.
   * @param {Record<string, any>} state @param {string} deviceId @returns {MDCFolderInfo}
   */
  function summary(state, deviceId) {
    const { devices } = normalized(state);
    const [lastId, last] = Object.entries(devices)
      .filter(([, entry]) => typeof entry?.lastSaved === "string")
      .sort(([, left], [, right]) => String(right.lastSaved).localeCompare(String(left.lastSaved)))[0] || [];
    return {
      path: typeof devices[deviceId]?.path === "string" ? devices[deviceId].path : "",
      devices: Object.keys(devices).length,
      savedBy: lastId ? (lastId === deviceId ? "this device" : String(last?.name || "another device")) : ""
    };
  }

  /** MD_Calendar.json of an opened folder. @param {MDCStorageAdapter} folder @param {() => void} unreadable */
  function file(folder, unreadable) {
    return jsonFile.create({ adapter: folder, name: fileName, format, initial: create, order, unreadable });
  }

  /**
   * What the sync control shows (docs/ui/Shell.md#sync-control): whether the synchronization is set up, whether
   * `Calendar.md` was saved since the last synchronization, and whether one was interrupted.
   * @param {Record<string, any>} state
   */
  function syncStatus(state) {
    const section = sync(state);
    if (!section) return { connected: false, changed: false, interrupted: false };
    const saved = normalized(state).files["Calendar.md"]?.hash;
    return { connected: true, changed: Boolean(saved) && saved !== section.last?.calendarHash, interrupted: Boolean(section.journal) };
  }

  app.folderState = { fileName, create, opened, saved, file, read, summary, sync, connected, journal, synced, stamp, syncStatus };
})(window.MDCalendar);
