import { handles, startup, storage } from "@zang3th/md-libs/platform";

window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Opens the calendar folder as an MD_Libs storage adapter and remembers it (see docs/Architecture.md#storage-adapter).
// The only module with file and IndexedDB access.
(function (app) {
  const calendarFiles = ["Calendar.md", "Backlog.md", "Contacts.md", "Holidays.md", "Config.md"];
  /** @type {import("@zang3th/md-libs/platform").handles.MDLHandleStore | null} */
  let folders = null;

  function rememberedFolders() {
    folders ||= handles.create({ indexedDB, database: "MD_Calendar", store: "folders", version: 2, limit: 1 });
    return folders;
  }

  /** @param {any} directory */
  function adapter(directory) {
    return storage.folder(directory, { files: calendarFiles });
  }

  async function pickFolder() {
    const directory = await window.showDirectoryPicker({ id: "md-calendar-folder", mode: "readwrite" });
    await rememberedFolders().remember(/** @type {any} */ (directory));
    return adapter(directory);
  }

  async function rememberedFolder() {
    const [record] = await rememberedFolders().list();
    if (!record) return null;
    return { name: record.name, granted: await storage.ensurePermission(/** @type {any} */ (record.handle), "readwrite", { prompt: false }) };
  }

  async function reopenFolder() {
    const [record] = await rememberedFolders().list();
    if (!record) return null;
    return await storage.ensurePermission(/** @type {any} */ (record.handle), "readwrite") ? adapter(record.handle) : null;
  }

  function missingApis() {
    return startup.missingApis({ window, apis: ["showDirectoryPicker()", "indexedDB"] });
  }

  app.storage = { pickFolder, rememberedFolder, reopenFolder, missingApis };
})(window.MDCalendar);
