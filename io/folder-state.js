import { json } from "@zang3th/md-libs/core";
import { jsonFile } from "@zang3th/md-libs/platform";

window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// MD_Calendar.json: technical data of the calendar folder that does not belong in Markdown
// (see docs/DataFormat.md#md_calendarjson). Reading, writing and the layout rules are MD_Libs core/json and platform/jsonFile.
(function (app) {
  const fileName = "MD_Calendar.json";
  const format = 1;
  const order = {
    "": ["format", "devices", "files"],
    devices: /** @type {"sorted"} */ ("sorted"),
    "devices.*": ["name", "path", "lastOpened", "lastSaved"],
    files: /** @type {"sorted"} */ ("sorted"),
    "files.*": ["hash", "savedAt", "savedBy"]
  };

  /** @returns {MDCFolderState} */
  function create() {
    return { format, devices: {}, files: {} };
  }

  /** @param {Record<string, any>} state @returns {MDCFolderState} */
  function normalized(state) {
    const isObject = (/** @type {unknown} */ value) => typeof value === "object" && value !== null && !Array.isArray(value);
    return /** @type {MDCFolderState} */ ({ ...state, devices: isObject(state.devices) ? state.devices : {}, files: isObject(state.files) ? state.files : {} });
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

  app.folderState = { fileName, create, opened, saved, file, read, summary };
})(window.MDCalendar);
