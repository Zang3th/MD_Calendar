import { device as platformDevice, handles, startup, storage } from "@zang3th/md-libs/platform";

window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Opens the calendar folder as an MD_Libs storage adapter, remembers the five most recently opened folders and keeps the device ID
// (see docs/Architecture.md#storage-adapter). The only module with file and IndexedDB access.
(function (app) {
  const calendarFiles = ["Calendar.md", "Backlog.md", "Contacts.md", "Holidays.md", "Config.md"];
  const stateFile = "MD_Calendar.json";
  /** @type {import("@zang3th/md-libs/platform").handles.MDLHandleStore<{ info?: MDCFolderInfo }> | null} */
  let folders = null;
  /** The remembered record of each opened folder. @type {WeakMap<MDCStorageAdapter, string>} */
  const recordIds = new WeakMap();

  function rememberedFolders() {
    folders ||= handles.create({ indexedDB, database: "MD_Calendar", store: "folders", version: 2, limit: 5 });
    return folders;
  }

  /** @param {any} directory */
  function adapter(directory) {
    return storage.folder(directory, { files: [...calendarFiles, stateFile] });
  }

  /** The remembered folders, most recently opened first. @returns {Promise<MDCRecentFolder[]>} */
  async function recentFolders() {
    return (await rememberedFolders().list()).map(({ id, name, openedAt, info }) => ({ id, name, openedAt, info }));
  }

  /**
   * Opens a folder that holds MD_Calendar.json. A remembered folder that was deleted, moved or renamed since
   * stays remembered, so that it opens again once it is back.
   * @param {any} handle @param {{prompt?: boolean}} [options]
   * @returns {Promise<MDCOpenResult>}
   */
  async function open(handle, options) {
    const access = await storage.probe(handle, "readwrite", { ...options, window });
    if (access !== "granted") return access;
    const opened = adapter(handle);
    if (await opened.stat(stateFile) === null) return "uninitialized";
    const record = await rememberedFolders().remember(handle, keepInfo);
    recordIds.set(opened, record.id);
    return opened;
  }

  /** Lets the user choose a folder and opens it. @returns {Promise<MDCOpenAttempt>} */
  async function pickFolder() {
    const directory = await window.showDirectoryPicker({ id: "md-calendar-folder", mode: "readwrite" });
    return { name: directory.name, result: await open(directory) };
  }

  /**
   * Lets the user choose a folder, lets `setUp` write MD_Calendar.json into it and opens it.
   * Markdown files already in the folder are kept.
   * @param {(folder: MDCStorageAdapter) => Promise<unknown>} setUp
   */
  async function createCalendar(setUp) {
    const directory = await window.showDirectoryPicker({ id: "md-calendar-folder", mode: "readwrite" });
    const created = adapter(directory);
    await setUp(created);
    const record = await rememberedFolders().remember(/** @type {any} */ (directory), keepInfo);
    recordIds.set(created, record.id);
    return created;
  }

  /** Keeps the cached folder info when a folder is remembered again. @param {{ info?: MDCFolderInfo } | undefined} existing */
  function keepInfo(existing) {
    return existing?.info ? { info: existing.info } : {};
  }

  /** Caches what the start card shows of an opened folder. @param {MDCStorageAdapter} folder @param {MDCFolderInfo} info */
  async function rememberInfo(folder, info) {
    const id = recordIds.get(folder);
    if (id) await rememberedFolders().update(id, () => ({ info }));
  }

  /**
   * MD_Calendar.json of a remembered folder, read without asking for permission; `null` when the permission is
   * not granted, the folder is gone or the file is missing. Updates the cached info with `summarize`.
   * @param {string} id @param {(text: string) => MDCFolderInfo | null} summarize
   */
  async function refreshInfo(id, summarize) {
    const record = (await rememberedFolders().list()).find(entry => entry.id === id);
    if (!record || await storage.probe(/** @type {any} */ (record.handle), "read", { window, prompt: false }) !== "granted") return null;
    const stored = await adapter(record.handle).read(stateFile);
    const info = stored ? summarize(stored.text) : null;
    if (info) await rememberedFolders().update(id, () => ({ info }));
    return info;
  }

  /** Opens the remembered folder `id`, asking for its permission if needed. @param {string} id @returns {Promise<MDCOpenAttempt>} */
  async function openRecent(id) {
    const record = (await rememberedFolders().list()).find(entry => entry.id === id);
    return record ? { name: record.name, result: await open(record.handle) } : { name: "", result: "missing" };
  }

  /** Opens the most recently opened folder without asking for permission; `null` when no folder is remembered. @returns {Promise<MDCOpenAttempt | null>} */
  async function openLast() {
    const [record] = await rememberedFolders().list();
    return record ? { name: record.name, result: await open(record.handle, { prompt: false }) } : null;
  }

  /** @type {MDCDevice | null} */
  let thisDevice = null;

  /** This browser in MD_Calendar.json: an ID kept in localStorage and the platform as a readable name. */
  function device() {
    if (thisDevice) return thisDevice;
    /** @type {Storage | null} */
    let local = null;
    try { local = localStorage; } catch { /* Blocked storage: the ID lasts for this page. */ }
    const name = /** @type {any} */ (navigator).userAgentData?.platform || navigator.platform || "Unknown device";
    thisDevice = { id: platformDevice.id({ storage: local, key: "md-calendar-device", randomUUID: () => crypto.randomUUID() }), name };
    return thisDevice;
  }

  /** SHA-256 of a saved text for MD_Calendar.json. @param {string} text */
  function fingerprint(text) {
    return storage.fingerprint(text, { subtle: crypto.subtle });
  }

  /** `sessionStorage`, or `null` when the browser blocks it. */
  function sessionStore() {
    try { return sessionStorage; } catch { return null; }
  }

  // A return to the start card reloads the page; this flag keeps the next startup from opening the last folder again.
  const skipAutoOpen = startup.reloadFlag({ storage: sessionStore(), key: "md-calendar-skip-auto-open", window });

  /** @param {string} id */
  function forgetFolder(id) {
    return rememberedFolders().forget(id);
  }

  function missingApis() {
    return startup.missingApis({ window, apis: ["showDirectoryPicker()", "indexedDB"] });
  }

  app.storage = { pickFolder, createCalendar, device, fingerprint, recentFolders, rememberInfo, refreshInfo, openRecent, openLast, forgetFolder, skipNextAutoOpen: skipAutoOpen.set, takeSkipAutoOpen: skipAutoOpen.take, missingApis };
})(window.MDCalendar);
