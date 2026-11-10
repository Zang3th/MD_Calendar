window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Storage adapter for a local folder (see docs/Architecture.md#storage-adapter).
// The only module with file and IndexedDB access.
(function (app) {
  const calendarFiles = ["Calendar.md", "Backlog.md", "Contacts.md", "Holidays.md", "Config.md"];
  const databaseName = "MD_Calendar";
  const storeName = "folder";
  const folderKey = "last";
  /** @type {Promise<unknown>} */
  let writeQueue = Promise.resolve();

  /** @param {File} file */
  function fileStamp(file) {
    return `${file.lastModified}:${file.size}`;
  }

  /** @param {unknown} error */
  function isNotFound(error) {
    return error instanceof DOMException && (error.name === "NotFoundError" || error.name === "TypeMismatchError");
  }

  /** @returns {Promise<IDBDatabase>} */
  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(storeName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * @template T
   * @param {IDBTransactionMode} mode
   * @param {(store: IDBObjectStore) => IDBRequest<T>} operation
   * @returns {Promise<T>}
   */
  async function withStore(mode, operation) {
    const database = await openDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, mode);
        const request = operation(transaction.objectStore(storeName));
        transaction.oncomplete = () => resolve(request.result);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      database.close();
    }
  }

  /** @returns {Promise<FileSystemDirectoryHandle | null>} */
  async function rememberedHandle() {
    const handle = await withStore("readonly", store => store.get(folderKey));
    return handle instanceof FileSystemDirectoryHandle ? handle : null;
  }

  /** @param {FileSystemDirectoryHandle} directory @returns {MDCStorageAdapter} */
  function localFolder(directory) {
    /** @param {string} name */
    async function file(name) {
      try {
        return await (await directory.getFileHandle(name)).getFile();
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    }

    /** @param {string} name */
    async function stat(name) {
      const current = await file(name);
      return current ? fileStamp(current) : null;
    }

    /** @param {string} name */
    async function read(name) {
      const current = await file(name);
      return current ? { text: await current.text(), stamp: fileStamp(current) } : null;
    }

    async function listFiles() {
      /** @type {string[]} */
      const names = [];
      for await (const [name, handle] of directory.entries()) {
        if (handle.kind === "file" && calendarFiles.includes(name)) names.push(name);
      }
      return names.sort();
    }

    /** @param {string} name @param {string} text @param {string | null} expected @returns {Promise<string>} */
    function write(name, text, expected) {
      const operation = writeQueue.catch(() => {}).then(async () => {
        if (await stat(name) !== expected) {
          const current = await read(name);
          throw Object.assign(new Error(`${name} changed before it could be saved.`), {
            name: "StorageConflictError",
            file: name,
            text: current?.text ?? null,
            stamp: current?.stamp ?? null
          });
        }
        const handle = await directory.getFileHandle(name, { create: expected === null });
        const writable = await handle.createWritable();
        await writable.write(text);
        await writable.close();
        return fileStamp(await handle.getFile());
      });
      writeQueue = operation.catch(() => {});
      return operation;
    }

    return { name: directory.name, listFiles, read, stat, write };
  }

  async function pickFolder() {
    const directory = await window.showDirectoryPicker({ id: "md-calendar-folder", mode: "readwrite" });
    await withStore("readwrite", store => store.put(directory, folderKey));
    return localFolder(directory);
  }

  async function rememberedFolder() {
    const handle = await rememberedHandle();
    if (!handle) return null;
    return { name: handle.name, granted: await handle.queryPermission({ mode: "readwrite" }) === "granted" };
  }

  async function reopenFolder() {
    const handle = await rememberedHandle();
    if (!handle) return null;
    if (await handle.queryPermission({ mode: "readwrite" }) === "granted") return localFolder(handle);
    return await handle.requestPermission({ mode: "readwrite" }) === "granted" ? localFolder(handle) : null;
  }

  async function forgetFolder() {
    await withStore("readwrite", store => store.delete(folderKey));
  }

  function missingApis() {
    const missing = [];
    if (typeof window.showDirectoryPicker !== "function") missing.push("window.showDirectoryPicker()");
    if (typeof indexedDB === "undefined") missing.push("indexedDB");
    return missing;
  }

  app.storage = { pickFolder, rememberedFolder, reopenFolder, forgetFolder, missingApis };
})(window.MDCalendar);
