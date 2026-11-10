window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Wires the layers together; owns startup, saving and external change handling (docs/Architecture.md).
(function (app) {
  const calendarFile = "Calendar.md";
  const backlogFile = "Backlog.md";
  const contactsFile = "Contacts.md";
  const externalCheckInterval = 2000;

  /** @type {Array<[string, () => boolean]>} */
  const requiredComponents = [
    ["vendor/dayjs", () => typeof dayjs === "function" && typeof dayjs_plugin_isoWeek === "function"],
    ["vendor/sortable/Sortable.min.js", () => Boolean(app.interactions?.sortableReady())],
    ["domain/calendar.js", () => Boolean(app.calendar)],
    ["domain/history.js", () => Boolean(app.history)],
    ["domain/backlog.js", () => Boolean(app.backlog)],
    ["domain/contacts.js", () => Boolean(app.contacts)],
    ["domain/search.js", () => Boolean(app.search)],
    ["io/calendar-format.js", () => Boolean(app.calendarFormat)],
    ["io/backlog-format.js", () => Boolean(app.backlogFormat)],
    ["io/holidays-format.js", () => Boolean(app.holidaysFormat)],
    ["io/config-format.js", () => Boolean(app.configFormat)],
    ["io/contacts-format.js", () => Boolean(app.contactsFormat)],
    ["io/vcard.js", () => Boolean(app.vcard)],
    ["io/ics.js", () => Boolean(app.ics)],
    ["io/storage.js", () => Boolean(app.storage)],
    ["ui/notifications.js", () => Boolean(app.notifications)],
    ["ui/tooltips.js", () => Boolean(app.tooltips)],
    ["ui/sounds.js", () => Boolean(app.sounds)],
    ["ui/header.js", () => Boolean(app.header)],
    ["ui/start.js", () => Boolean(app.start)],
    ["domain/recurrence.js", () => Boolean(app.recurrence)],
    ["ui/tiles.js", () => Boolean(app.tiles)],
    ["ui/render-week.js", () => Boolean(app.week)],
    ["ui/render-month.js", () => Boolean(app.month)],
    ["ui/render-contacts.js", () => Boolean(app.contactsView)],
    ["ui/pickers.js", () => Boolean(app.pickers)],
    ["ui/menus.js", () => Boolean(app.menus)],
    ["ui/search-panel.js", () => Boolean(app.searchPanel)],
    ["ui/backlog-panel.js", () => Boolean(app.backlogPanel)],
    ["ui/holidays-panel.js", () => Boolean(app.holidaysPanel)],
    ["ui/dialog.js", () => Boolean(app.dialog)],
    ["ui/interactions.js", () => Boolean(app.interactions)]
  ];

  /** @param {string} title @param {string} body @param {string} details @param {string} code */
  function blockStartup(title, body, details, code) {
    if (app.notifications) app.notifications.fatal(title, body, details, code);
    else {
      document.body.dataset.startupState = "blocked";
      document.body.classList.add("startup-blocked");
      document.body.append(`${title}: ${body} (${code})`);
    }
  }

  /** @param {HTMLImageElement | null} image */
  function imageLoaded(image) {
    if (!image) return Promise.resolve(false);
    if (image.complete) return Promise.resolve(image.naturalWidth > 0);
    return new Promise(resolve => {
      image.addEventListener("load", () => resolve(true), { once: true });
      image.addEventListener("error", () => resolve(false), { once: true });
    });
  }

  async function fontLoaded() {
    try {
      return (await document.fonts.load('600 16px "Plus Jakarta Sans"', "Äb")).length > 0;
    } catch {
      return false;
    }
  }

  async function initialize() {
    const missingComponents = requiredComponents.filter(([, available]) => !available()).map(([file]) => file);
    if (missingComponents.length) {
      blockStartup("Anwendungsdateien fehlen", "Stelle den vollständigen Anwendungsordner wieder her und lade die Seite neu.", `Fehlende Komponenten: ${missingComponents.join(", ")}.`, "MDC-001");
      return;
    }
    dayjs.extend(dayjs_plugin_isoWeek);
    dayjs.locale("de");

    const missingApis = app.storage.missingApis();
    if (missingApis.length) {
      blockStartup("Browser nicht unterstützt", "MD_Calendar braucht Chrome oder Edge.", `Der Browser bietet die benötigten Funktionen nicht: ${missingApis.join(", ")}.`, "MDC-002");
      return;
    }

    const missingResources = [];
    if (!getComputedStyle(document.documentElement).getPropertyValue("--base").trim()) missingResources.push("styles.css");
    if (!(await fontLoaded())) missingResources.push("vendor/fonts/PlusJakartaSans-latin.woff2");
    if (!(await imageLoaded(document.querySelector(".logo")))) missingResources.push("res/logo/mark.svg");
    if (missingResources.length) {
      blockStartup("Anwendungsressourcen fehlen", "Stelle den vollständigen Anwendungsordner wieder her und lade die Seite neu.", `Nicht geladen: ${missingResources.join(", ")}.`, "MDC-003");
      return;
    }
    await startApplication();
  }

  async function startApplication() {
    /** @type {MDCStorageAdapter | null} */
    let folder = null;
    /** @type {MDCCalendar | null} */
    let calendar = null;
    /** @type {MDCBacklog | null} */
    let backlog = null;
    /** @type {MDCContacts | null} */
    let contacts = null;
    /** Index of the contact shown in the contacts view, or -1. */
    let selectedContact = 0;
    /** @type {MDCHolidays} */
    let holidays = { holidays: [], vacations: [] };
    /** @type {MDCConfig} */
    let config = { tags: [] };
    let history = app.history.create();
    /**
     * Per file: the text and stamp as last read or written (null while the file does not exist),
     * the text an unchanged model serializes to, and a differing version on disk while local changes exist.
     * @type {Record<MDCFileName, MDCFileState>}
     */
    const files = {
      "Calendar.md": { disk: null, baseline: "", external: null, writable: true },
      "Backlog.md": { disk: null, baseline: "", external: null, writable: true },
      "Contacts.md": { disk: null, baseline: "", external: null, writable: true },
      "Holidays.md": { disk: null, baseline: "", external: null, writable: false },
      "Config.md": { disk: null, baseline: "", external: null, writable: false }
    };
    const writableFiles = /** @type {MDCFileName[]} */ (["Calendar.md", "Backlog.md", "Contacts.md"]);
    /** The file that received the latest move between Calendar.md and Backlog.md; it is written first. */
    /** @type {MDCFileName} */
    let firstFile = "Calendar.md";
    /** @type {{dismiss(): void, isOpen(): boolean} | null} */
    let conflictNotice = null;
    const portrait = matchMedia("(orientation: portrait)");
    let today = app.calendar.todayKey(new Date());
    let anchor = today;
    /** Default view per orientation (docs/ui/Views.md#default-view). @type {MDCView} */
    let view = portrait.matches ? "month" : "week";
    let backlogOpen = false;
    let session = 0;
    /** @type {Promise<void> | null} */
    let saving = null;
    let checking = false;
    let midnightTimer = 0;

    function hasConflict() {
      return writableFiles.some(name => files[name].external);
    }

    function updateHeader() {
      app.header.update({
        open: Boolean(calendar),
        view,
        anchor,
        backlogOpen,
        unsaved: app.history.unsaved(history),
        canUndo: app.history.canUndo(history),
        canRedo: app.history.canRedo(history),
        undoLabel: app.history.undoLabel(history),
        redoLabel: app.history.redoLabel(history),
        muted: app.sounds.isMuted(),
        conflict: hasConflict()
      });
    }

    function renderer() {
      return view === "month" ? app.month : app.week;
    }

    function bindLists() {
      app.interactions.bindLists([...(view === "contacts" ? [] : renderer().lists()), ...app.backlogPanel.lists()]);
    }

    function renderContacts() {
      if (!contacts) return;
      selectedContact = Math.min(selectedContact, contacts.contacts.length - 1);
      app.contactsView.render(contacts, selectedContact, today);
    }

    function render() {
      if (!calendar || !backlog || !contacts) return;
      app.tiles.setContacts(contacts);
      let rebuiltView = false;
      if (view === "contacts") {
        app.week.hide();
        app.month.hide();
        renderContacts();
        rebuiltView = true;
      } else {
        app.contactsView.hide();
        (view === "week" ? app.month : app.week).hide();
        rebuiltView = renderer().render(calendar, anchor, today);
      }
      const rebuiltBacklog = app.backlogPanel.render(backlog, backlogOpen);
      if (rebuiltView || rebuiltBacklog) bindLists();
      app.interactions.refreshSelection();
      updateHeader();
    }

    /** Whether two anchors show the same period in the current view. @param {string} left @param {string} right */
    function samePeriod(left, right) {
      if (view === "contacts") return true;
      return view === "week" ? app.calendar.weekStart(left) === app.calendar.weekStart(right) : left.slice(0, 7) === right.slice(0, 7);
    }

    function scheduleMidnight() {
      window.clearTimeout(midnightTimer);
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
      midnightTimer = window.setTimeout(() => {
        today = app.calendar.todayKey(new Date());
        render();
        scheduleMidnight();
      }, midnight.getTime() - now.getTime());
    }

    /** @param {MDCFileName} name @param {MDCFormatWarning[]} warnings */
    function reportWarnings(name, warnings) {
      if (!warnings.length) return;
      const lines = warnings.map(warning => warning.lineNumber);
      const shown = lines.slice(0, 8).join(", ") + (lines.length > 8 ? " …" : "");
      const kept = files[name].writable ? "nicht verstanden und unverändert erhalten" : "nicht verstanden und übersprungen";
      app.notifications.show("warning", "Nicht verstandene Zeilen", [
        { value: name },
        `: ${warnings.length === 1 ? "Zeile" : `${warnings.length} Zeilen`} ${shown} ${warnings.length === 1 ? "wird" : "werden"} ${kept}.`
      ]);
    }

    /** Parses one file into the model; writable files start a new history. @param {MDCFileName} name @param {MDCFileText} file */
    function useFile(name, file) {
      const state = files[name];
      dataVersion += 1;
      state.disk = file;
      state.external = null;
      /** @type {MDCFormatWarning[]} */
      let warnings = [];
      if (name === "Calendar.md") {
        const parsed = app.calendarFormat.parse(file?.text ?? "# Calendar\n");
        calendar = parsed.calendar;
        state.baseline = app.calendarFormat.serialize(calendar);
        warnings = parsed.warnings;
      } else if (name === "Backlog.md") {
        const parsed = app.backlogFormat.parse(file?.text ?? "# Backlog\n");
        backlog = parsed.backlog;
        state.baseline = app.backlogFormat.serialize(backlog);
        warnings = parsed.warnings;
      } else if (name === "Contacts.md") {
        const parsed = app.contactsFormat.parse(file?.text ?? "# Contacts\n");
        contacts = parsed.contacts;
        state.baseline = app.contactsFormat.serialize(contacts);
        warnings = parsed.warnings;
      } else if (name === "Holidays.md") {
        const parsed = app.holidaysFormat.parse(file?.text ?? "");
        holidays = parsed.holidays;
        app.tiles.setHolidays(holidays);
        app.holidaysPanel.update(holidays, today);
        warnings = parsed.warnings;
      } else {
        const parsed = app.configFormat.parse(file?.text ?? "");
        config = parsed.config;
        warnings = parsed.warnings;
        const unknown = app.tiles.setTags(config.tags);
        if (unknown.length) {
          app.notifications.show("error", "Unbekannte Tag-Icons", [{ value: name }, `: ${unknown.map(tag => tag.icon ? `„${tag.name}“ nutzt das unbekannte Icon „${tag.icon}“` : `„${tag.name}“ hat kein Icon`).join(", ")}. Diese Tags erscheinen ohne Icon.`], {
            code: "MDC-301",
            details: `Bekannte Icon-IDs: ${app.tiles.tagIconIds().join(", ")}.`
          });
        }
      }
      if (state.writable) history = app.history.create();
      if (file) reportWarnings(name, warnings);
    }

    function clearConflict() {
      conflictNotice?.dismiss();
      conflictNotice = null;
    }

    /** @param {MDCStorageAdapter} opened */
    async function openFolder(opened) {
      const names = /** @type {MDCFileName[]} */ (Object.keys(files));
      const texts = await Promise.all(names.map(name => opened.read(name)));
      session += 1;
      folder = opened;
      app.start.hide();
      clearConflict();
      names.forEach((name, index) => useFile(name, texts[index]));
      render();
      app.notifications.show("info", "Ordner geöffnet", [{ value: opened.name }, files["Calendar.md"].disk ? " ist bereit." : ` enthält noch keine ${calendarFile}; sie entsteht mit dem ersten Eintrag.`]);
    }

    /** @param {unknown} error @param {string} code */
    function reportOpenError(error, code) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const details = error instanceof Error ? error.message : String(error);
      app.notifications.show("error", "Ordner nicht geöffnet", "Der Ordner konnte nicht geöffnet werden.", { details, code });
    }

    /** Updates what an action changed. @param {MDCUndoAction} action */
    function showChange(action) {
      if (!calendar || !backlog) return;
      if (action.contacts) {
        app.tiles.setContacts(contacts);
        if (view === "contacts") renderContacts();
        else renderer().render(calendar, anchor, today);
        updateHeader();
        return;
      }
      if (action.layout) {
        render();
        return;
      }
      if (view !== "contacts") renderer().renderDays(calendar, action.days || [], today);
      if (action.backlog) app.backlogPanel.render(backlog, backlogOpen);
      updateHeader();
    }

    /** Executes an action as one undo step and updates what it changed. @param {MDCUndoAction | null} action */
    function execute(action) {
      if (!action || !calendar) return false;
      const before = { view, anchor, contact: selectedContact };
      let after = before;
      if (action.contacts) {
        const selectAfter = action.selectAfter ?? selectedContact;
        after = { view: /** @type {MDCView} */ ("contacts"), anchor, contact: selectAfter };
        selectedContact = selectAfter;
      }
      dataVersion += 1;
      app.history.execute(history, { ...action, beforeViewState: action.contacts ? { ...before, view: "contacts" } : before, afterViewState: after });
      if (action.target) firstFile = /** @type {MDCFileName} */ (action.target);
      if (action.contacts && view !== "contacts") {
        view = "contacts";
        render();
      } else showChange(action);
      return true;
    }

    /** Returns to the view of an undone or redone action. @param {MDCUndoEntry | null} entry @param {boolean} undone */
    function showUndone(entry, undone) {
      if (!entry || !calendar) return;
      dataVersion += 1;
      app.interactions.clearSelection();
      if (entry.target) firstFile = /** @type {MDCFileName} */ (undone ? (entry.target === calendarFile ? backlogFile : calendarFile) : entry.target);
      const target = (undone ? entry.beforeViewState : entry.afterViewState) || { view, anchor };
      if (target.contact !== undefined && target.contact >= 0) selectedContact = target.contact;
      if (target.view !== view || !samePeriod(target.anchor, anchor)) {
        view = target.view;
        anchor = target.anchor;
        render();
      } else showChange(entry);
    }

    function showConflict() {
      if (conflictNotice?.isOpen()) return;
      const changed = writableFiles.filter(name => files[name].external);
      const deleted = changed.filter(name => files[name].external?.text === null);
      conflictNotice = app.notifications.show("warning", deleted.length ? "Datei gelöscht" : "Datei außerhalb geändert", [
        { value: changed.join(", ") },
        deleted.length
          ? `${deleted.length === changed.length ? "" : " wurde geändert oder"} wurde gelöscht. Deine Änderungen sind noch offen.`
          : " wurde außerhalb von MD_Calendar geändert. Deine Änderungen sind noch nicht gespeichert."
      ], {
        persistent: true,
        actions: [
          { label: "Neu laden", run: () => { void reloadWritable(); }, primary: false },
          { label: "Überschreiben", run: () => { void save(true); }, primary: true }
        ]
      });
      updateHeader();
    }

    /** Discards local changes and reads Calendar.md and Backlog.md again. */
    async function reloadWritable() {
      if (!folder) return;
      const current = session;
      const texts = await Promise.all(writableFiles.map(name => /** @type {MDCStorageAdapter} */ (folder).read(name)));
      if (current !== session) return;
      clearConflict();
      writableFiles.forEach((name, index) => useFile(name, texts[index]));
      render();
      app.notifications.show("info", "Neu geladen", "Kalender, Backlog und Kontakte wurden neu geladen.");
    }

    /** @param {MDCFileName} name */
    function serialized(name) {
      if (name === "Contacts.md") return app.contactsFormat.serialize(/** @type {MDCContacts} */ (contacts));
      return name === "Calendar.md" ? app.calendarFormat.serialize(/** @type {MDCCalendar} */ (calendar)) : app.backlogFormat.serialize(/** @type {MDCBacklog} */ (backlog));
    }

    /**
     * Writes one file with the version check. Returns false when it ended in a conflict.
     * @param {MDCFileName} name @param {string} text @param {boolean} force @param {boolean} [retried]
     * @returns {Promise<boolean>}
     */
    async function writeFile(name, text, force, retried = false) {
      const state = files[name];
      const expected = force && state.external ? state.external.stamp : state.disk?.stamp ?? null;
      try {
        state.disk = { text, stamp: await /** @type {MDCStorageAdapter} */ (folder).write(name, text, expected) };
        state.external = null;
        return true;
      } catch (error) {
        const conflict = /** @type {MDCStorageConflictError} */ (error);
        if (conflict.name !== "StorageConflictError") throw error;
        if (!force && !retried && conflict.text !== null && conflict.stamp !== null && conflict.text === state.disk?.text) {
          // Only the stamp changed (for example a sync client touched the file); the content is ours.
          state.disk = { text: conflict.text, stamp: conflict.stamp };
          return writeFile(name, text, force, true);
        }
        state.external = { text: conflict.text, stamp: conflict.stamp };
        return false;
      }
    }

    /** Writes every changed file, the target of the latest move between the files first. @param {boolean} force */
    async function writeAll(force) {
      if (!folder || !calendar || !backlog) return;
      const current = session;
      const position = history.position;
      const order = /** @type {MDCFileName[]} */ (firstFile === calendarFile ? [calendarFile, backlogFile, contactsFile] : [backlogFile, calendarFile, contactsFile]);
      let written = false;
      let complete = true;
      for (const name of order) {
        const state = files[name];
        const text = serialized(name);
        if (!(force && state.external) && text === (state.disk ? state.disk.text : state.baseline)) continue;
        const ok = await writeFile(name, text, force);
        if (current !== session) return;
        written = written || ok;
        complete = complete && ok;
      }
      if (!complete) {
        showConflict();
        return;
      }
      clearConflict();
      app.history.markSaved(history, position);
      updateHeader();
      if (written) app.header.flashSaved();
    }

    /** @param {boolean} [force] */
    async function save(force = false) {
      if (!folder || !calendar) return;
      if (hasConflict() && !force) {
        showConflict();
        return;
      }
      if (saving) await saving;
      saving = writeAll(force).catch(error => {
        app.notifications.show("error", "Speichern fehlgeschlagen", "Die Änderungen konnten nicht gespeichert werden.", {
          details: error instanceof Error ? error.message : String(error),
          code: "MDC-201"
        });
      }).finally(() => { saving = null; });
      await saving;
    }

    async function checkExternal() {
      // While the dialog is open it refers to an entry by position; a reload would make that reference stale.
      if (!folder || !calendar || checking || saving || document.hidden || app.dialog.isOpen()) return;
      checking = true;
      const current = session;
      const opened = folder;
      try {
        for (const name of /** @type {MDCFileName[]} */ (Object.keys(files))) {
          const state = files[name];
          const stamp = await opened.stat(name);
          if (current !== session || saving) return;
          if (stamp === (state.disk?.stamp ?? null) || (state.external && stamp === state.external.stamp)) continue;
          const file = await opened.read(name);
          if (current !== session || saving) return;
          if (file && state.disk && file.text === state.disk.text) {
            state.disk = file;
            continue;
          }
          if (!file && !state.disk) continue;
          if (!state.writable) {
            useFile(name, file);
            render();
            app.notifications.show("info", "Neu geladen", [{ value: name }, " wurde außerhalb geändert und neu geladen."]);
          } else if (file && app.history.unsaved(history) === 0 && !hasConflict()) {
            useFile(name, file);
            render();
            app.notifications.show("info", "Neu geladen", [{ value: name }, " wurde außerhalb geändert und neu geladen."]);
          } else {
            state.external = { text: file?.text ?? null, stamp: file?.stamp ?? null };
            clearConflict();
            showConflict();
          }
        }
      } catch (error) {
        if (current === session) {
          app.notifications.show("error", "Dateiprüfung fehlgeschlagen", "Externe Änderungen konnten nicht geprüft werden.", {
            details: error instanceof Error ? error.message : String(error),
            code: "MDC-202"
          });
        }
      } finally {
        checking = false;
      }
    }

    /** @param {string} key */
    function showDay(key) {
      const direction = view === "contacts" || samePeriod(key, anchor) ? 0 : key < anchor ? -1 : 1;
      anchor = key;
      render();
      if (direction && view !== "contacts") app.tiles.slide(view === "week" ? "week" : "month", direction);
    }

    /** The first visible day of the shown period, or today when it is visible. */
    function visibleDay() {
      if (samePeriod(today, anchor)) return today;
      return view === "week" ? app.calendar.weekStart(anchor) : `${anchor.slice(0, 7)}-01`;
    }

    /** Data version for the search index; changes with every action and every reload. */
    let dataVersion = 0;
    /** Copied entries; pasting inserts open copies (docs/ui/Interaction.md#copy-and-paste). @type {MDCEntry[]} */
    let clipboard = [];

    /** @param {string} title */
    function confirmDeleted(title) {
      app.notifications.show("info", "Gelöscht", [{ value: title }, " wurde gelöscht. Strg Z macht es rückgängig."]);
    }

    function inboxIndex() {
      return Math.max(0, /** @type {MDCBacklog} */ (backlog).groups.findIndex(group => group.name === app.backlogFormat.inbox));
    }

    /** Creates the item a dialog result describes. @param {MDCDialogResult} result @param {{extra: string[]} | null} kept */
    function createFrom(result, kept) {
      const target = /** @type {MDCCalendar} */ (calendar);
      const extra = kept?.extra || [];
      const base = { title: result.title, location: result.location, note: result.note, tag: result.tag };
      if (result.kind === "series") {
        return app.calendar.createSeries(target, {
          ...base, extra, start: result.date, startTime: result.startTime, endTime: result.endTime,
          rule: /** @type {MDCRule} */ (result.rule), except: [], done: []
        });
      }
      if (result.kind === "multiDay") return app.calendar.createMultiDay(target, { ...base, extra, start: result.date, end: result.end });
      if (!result.date) return app.backlog.create(target, /** @type {MDCBacklog} */ (backlog), inboxIndex(), { ...base, start: result.startTime, end: result.endTime, extra });
      return app.calendar.createEntry(target, result.date, { ...base, start: result.startTime, end: result.endTime, extra });
    }

    /** @param {MDCDialogResult} result */
    function entryFields(result) {
      return { title: result.title, start: result.startTime, end: result.endTime, location: result.location, note: result.note, tag: result.tag };
    }

    /** @param {MDCDialogResult} result */
    function showResult(result) {
      if (result.date && !samePeriod(result.date, anchor) && (!result.end || !samePeriod(result.end, anchor))) showDay(result.date);
    }

    /** @param {Omit<MDCDialogRequest, "tags">} request @param {MDCDialogHandlers} handlers */
    function openDialog(request, handlers) {
      app.dialog.open({ ...request, tags: config.tags }, handlers);
    }

    const noAction = () => {};

    /** @param {string} [key] */
    function newEntry(key) {
      if (!calendar) return;
      if (view === "contacts" && !key) {
        newContact();
        return;
      }
      openDialog({ kind: "entry", isNew: true, inBacklog: false, title: "", location: "", note: [], tag: "", date: key || visibleDay(), end: "", startTime: "", endTime: "", rule: null, occurrence: "" }, {
        apply: result => {
          execute(createFrom(result, null));
          showResult(result);
        },
        toBacklog: result => { execute(createFrom({ ...result, kind: "entry", date: "" }, null)); },
        remove: noAction, deleteOccurrence: noAction, endSeries: noAction
      });
    }

    /** @param {MDCEntryRef} ref */
    function openEntry(ref) {
      if (!calendar || !backlog) return;
      const inBacklog = app.backlog.isBacklog(ref);
      const entry = app.backlog.entryAt(calendar, backlog, ref);
      openDialog({
        kind: "entry", isNew: false, inBacklog, title: entry.title, location: entry.location, note: entry.note, tag: entry.tag,
        date: inBacklog ? "" : ref.key, end: "", startTime: entry.start, endTime: entry.end, rule: null, occurrence: ""
      }, {
        apply: result => {
          if (!calendar || !backlog) return;
          if (result.kind !== "entry") {
            execute(app.calendar.combine(result.title, [app.backlog.remove(calendar, backlog, ref), createFrom(result, entry)]));
            showResult(result);
            return;
          }
          const target = result.date ? { key: result.date } : { key: "", group: ref.group };
          execute(app.backlog.update(calendar, backlog, ref, target, entryFields(result)));
          if (inBacklog) showResult(result);
        },
        toBacklog: result => {
          if (calendar && backlog) execute(app.backlog.update(calendar, backlog, ref, { key: "", group: inboxIndex() }, entryFields(result)));
        },
        remove: () => {
          if (!calendar || !backlog) return;
          execute(app.backlog.remove(calendar, backlog, ref));
          confirmDeleted(entry.title);
        },
        deleteOccurrence: noAction, endSeries: noAction
      });
    }

    /** @param {number} index @param {string} key */
    function openOccurrence(index, key) {
      const series = calendar?.series[index];
      if (!calendar || !series || "raw" in series) return;
      openDialog({
        kind: "series", isNew: false, inBacklog: false, title: series.title, location: series.location, note: series.note, tag: series.tag,
        date: series.start, end: "", startTime: series.startTime, endTime: series.endTime, rule: series.rule, occurrence: key
      }, {
        apply: result => {
          if (!calendar) return;
          execute(result.kind === "series"
            ? app.calendar.updateSeries(calendar, index, {
              ...series, title: result.title, location: result.location, note: result.note, tag: result.tag, start: result.date,
              startTime: result.startTime, endTime: result.endTime, rule: /** @type {MDCRule} */ (result.rule)
            })
            : app.calendar.combine(result.title, [app.calendar.deleteSeries(calendar, index), createFrom(result, series)]));
        },
        toBacklog: noAction,
        remove: () => {
          if (!calendar) return;
          execute(app.calendar.deleteSeries(calendar, index));
          confirmDeleted(series.title);
        },
        deleteOccurrence: () => {
          if (!calendar) return;
          execute(app.calendar.deleteOccurrence(calendar, index, key));
          confirmDeleted(`${series.title} am ${app.calendar.formatDate(key)}`);
        },
        endSeries: () => {
          if (!calendar) return;
          execute(app.calendar.endSeries(calendar, index, key));
          app.notifications.show("info", "Serie beendet", [{ value: series.title }, ` endet mit dem ${app.calendar.formatDate(key)}. Strg Z macht es rückgängig.`]);
        }
      });
    }

    /** @param {number} index */
    function openMultiDay(index) {
      const item = calendar?.multiDay[index];
      if (!calendar || !item || "raw" in item) return;
      openDialog({
        kind: "multiDay", isNew: false, inBacklog: false, title: item.title, location: item.location, note: item.note, tag: item.tag,
        date: item.start, end: item.end, startTime: "", endTime: "", rule: null, occurrence: ""
      }, {
        apply: result => {
          if (!calendar) return;
          execute(result.kind === "multiDay"
            ? app.calendar.updateMultiDay(calendar, index, { ...item, title: result.title, location: result.location, note: result.note, tag: result.tag, start: result.date, end: result.end })
            : app.calendar.combine(result.title, [app.calendar.deleteMultiDay(calendar, index), createFrom(result, item)]));
        },
        toBacklog: noAction,
        remove: () => {
          if (!calendar) return;
          execute(app.calendar.deleteMultiDay(calendar, index));
          confirmDeleted(item.title);
        },
        deleteOccurrence: noAction, endSeries: noAction
      });
    }

    /** Offers a text as a file download. @param {string} name @param {string} text */
    function download(name, text) {
      app.contactsView.download(name.replace(/[\\/:*?"<>|]/g, "_"), text, "text/vcard");
    }

    function newContact() {
      if (!contacts) return;
      execute(app.contacts.create(contacts, app.contactsFormat.emptyContact()));
      app.contactsView.focusField("firstName");
    }

    /** @param {number} index */
    function openContact(index) {
      if (!contacts || !contacts.contacts[index]) return;
      selectedContact = index;
      view = "contacts";
      render();
    }

    /** Entries and multi-day entries with this tag are the vacations of the holiday overview (docs/ui/Views.md#holiday-overview). */
    const vacationTag = "Urlaub";

    /** @param {MDCEntryRef} left @param {MDCEntryRef} right */
    function sameRef(left, right) {
      return left.key === right.key && left.group === right.group && left.index === right.index;
    }

    /** @param {MDCPick} pick */
    function pickDone(pick) {
      if (!calendar || !backlog) return false;
      if (pick.ref) return app.backlog.entryAt(calendar, backlog, pick.ref).done;
      const series = calendar.series[/** @type {number} */ (pick.series)];
      return Boolean(series && !("raw" in series) && series.done.includes(pick.key));
    }

    /** @param {MDCPick[]} picks */
    function occurrencesOf(picks) {
      return picks.filter(pick => pick.series !== undefined).map(pick => ({ index: /** @type {number} */ (pick.series), key: pick.key }));
    }

    /** @param {MDCPick[]} picks */
    function refsOf(picks) {
      return picks.flatMap(pick => pick.ref ? [pick.ref] : []);
    }

    /** @param {MDCPick} pick */
    function pickTitle(pick) {
      if (!calendar || !backlog) return "";
      if (pick.ref) return app.backlog.entryAt(calendar, backlog, pick.ref).title;
      const series = calendar.series[/** @type {number} */ (pick.series)];
      return series && !("raw" in series) ? series.title : "";
    }

    /** Marks all picked entries done, or all open when they are all done; plays the sound when something got done. @param {MDCPick[]} picks */
    function toggleMany(picks) {
      if (!calendar || !backlog || !picks.length) return;
      const currentBacklog = backlog;
      const done = picks.some(pick => !pickDone(pick));
      const refs = refsOf(picks).filter(ref => app.backlog.entryAt(/** @type {MDCCalendar} */ (calendar), currentBacklog, ref).done !== done);
      const actions = [
        ...(refs.length ? [app.backlog.toggleEntries(calendar, backlog, refs)] : []),
        ...app.calendar.changeOccurrences(calendar, occurrencesOf(picks), done ? "done" : "open")
      ];
      if (!actions.length) return;
      execute(actions.length === 1 ? actions[0] : app.calendar.combine(`${picks.length} Einträge`, actions));
      app.interactions.refreshSelection();
      if (done) void app.sounds.play();
    }

    /** @param {MDCPick[]} picks */
    function removeMany(picks) {
      if (!calendar || !backlog || !picks.length) return;
      const refs = refsOf(picks);
      const label = picks.length === 1 ? pickTitle(picks[0]) : `${picks.length} Einträge`;
      const actions = [
        ...(refs.length ? [app.backlog.removeEntries(calendar, backlog, refs, label)] : []),
        ...app.calendar.changeOccurrences(calendar, occurrencesOf(picks), "delete")
      ];
      if (!actions.length) return;
      app.interactions.clearSelection();
      execute(actions.length === 1 ? actions[0] : app.calendar.combine(label, actions));
      confirmDeleted(label);
    }

    /** Copies the picked entries; an occurrence is copied as a plain entry with the fields of its series. @param {MDCPick[]} picks */
    function copy(picks) {
      if (!calendar || !backlog || !picks.length) return;
      const currentCalendar = calendar;
      const currentBacklog = backlog;
      clipboard = picks.flatMap(pick => {
        if (pick.ref) return [{ ...app.backlog.entryAt(currentCalendar, currentBacklog, pick.ref) }];
        const series = currentCalendar.series[/** @type {number} */ (pick.series)];
        return series && !("raw" in series)
          ? [{ done: false, start: series.startTime, end: series.endTime, title: series.title, tag: series.tag, location: series.location, note: [...series.note], extra: [] }]
          : [];
      });
      if (!clipboard.length) return;
      app.notifications.show("info", "Kopiert", clipboard.length === 1
        ? [{ value: clipboard[0].title }, " ist kopiert. Rechtsklick auf einen Tag oder Strg V fügt ein."]
        : `${clipboard.length} Einträge sind kopiert. Rechtsklick auf einen Tag oder Strg V fügt ein.`);
    }

    /** Inserts open copies of the clipboard at the end of a day. @param {string} key */
    function paste(key) {
      if (!calendar || !backlog || view === "contacts") return;
      if (!clipboard.length) {
        app.notifications.show("info", "Nichts kopiert", "Kopiere zuerst Einträge mit Rechtsklick oder Strg C.");
        return;
      }
      execute(app.backlog.pasteEntries(calendar, backlog, clipboard, key || visibleDay()));
    }

    /** Jumps to a search hit and highlights it. @param {MDCSearchItem} item */
    function jumpTo(item) {
      if (!calendar || !backlog) return;
      if (item.kind === "backlog") {
        if (!backlogOpen) {
          backlogOpen = true;
          render();
        }
        const ref = /** @type {MDCEntryRef} */ (item.ref);
        const tile = document.querySelector(`.bl__list[data-group="${ref.group}"] .ev[data-index="${ref.index}"]`);
        if (tile instanceof HTMLElement) app.tiles.pulse(tile);
        return;
      }
      const series = item.kind === "series" ? calendar.series[/** @type {number} */ (item.series)] : null;
      const key = series && !("raw" in series) ? app.search.nextOccurrence(series, today) : item.key;
      if (view === "contacts") view = portrait.matches ? "month" : "week";
      showDay(key);
      const cell = renderer().cell(key);
      const tile = item.kind === "entry" ? cell?.querySelector(`.ev[data-index="${item.ref?.index}"]`)
        : item.kind === "series" ? cell?.querySelector(`.ev[data-series="${item.series}"]`)
          : document.querySelector(`.bar[data-multi="${item.multi}"]`);
      const target = tile instanceof HTMLElement ? tile : cell;
      if (target) app.tiles.pulse(target);
    }

    app.searchPanel.init(query => calendar && backlog ? app.search.search(calendar, backlog, dataVersion, query, today, 30) : [], jumpTo);

    app.menus.onImport((text, name) => {
      if (!calendar) return;
      const { events, skipped } = app.ics.parse(text);
      if (!events.length) {
        app.notifications.show("warning", "Keine Termine gefunden", [{ value: name }, " enthält keine lesbaren Termine."]);
        return;
      }
      const result = app.calendar.importEvents(calendar, events, today);
      if (!result.action) {
        app.notifications.show("info", "Nichts Neues", [{ value: name }, `: alle ${result.duplicates} Termine sind schon im Kalender.`]);
        return;
      }
      if (view === "contacts") view = portrait.matches ? "month" : "week";
      execute(result.action);
      if (events.length === 1) showDay(events[0].start);
      const parts = [`${result.entries} Einträge`, result.series ? `${result.series} Serien` : "", result.multiDay ? `${result.multiDay} mehrtägige` : "",
        result.duplicates ? `${result.duplicates} schon vorhanden` : "", skipped ? `${skipped} übersprungen` : "",
        result.simplified ? `${result.simplified} mit nicht unterstützter Wiederholung als Einzeltermin` : ""].filter(Boolean);
      app.notifications.show("info", "Kalender importiert", [{ value: name }, `: ${parts.join(", ")}. Strg Z macht es rückgängig.`]);
    });

    app.contactsView.init({
      select(index) {
        selectedContact = index;
        renderContacts();
      },
      update(index, updated, groups) {
        if (contacts) execute(app.contacts.update(contacts, index, updated, groups));
      },
      addGroup(index, group) {
        if (contacts) execute(app.contacts.addGroup(contacts, index, group));
      },
      remove(index) {
        if (!contacts || !contacts.contacts[index]) return;
        const name = app.contacts.name(contacts.contacts[index]) || "Kontakt";
        execute(app.contacts.remove(contacts, index));
        confirmDeleted(name);
      },
      importText(text, name) {
        if (!contacts) return;
        const found = app.vcard.parse(text);
        const result = app.contacts.importContacts(contacts, found);
        if (!found.length) {
          app.notifications.show("warning", "Keine Kontakte gefunden", [{ value: name }, " enthält keine lesbare vCard."]);
          return;
        }
        execute(result.action);
        const unchanged = found.length - result.added - result.merged;
        app.notifications.show("info", "vCard importiert", `${result.added} neu, ${result.merged} zusammengeführt${unchanged ? `, ${unchanged} unverändert` : ""}. Strg Z macht es rückgängig.`);
      },
      exportOne(index) {
        const contact = contacts?.contacts[index];
        if (contact) download(`${app.contacts.name(contact) || "Kontakt"}.vcf`, app.vcard.serialize([contact]));
      },
      exportAll() {
        if (contacts?.contacts.length) download("Contacts.vcf", app.vcard.serialize(contacts.contacts));
        else app.notifications.show("info", "Nichts zu exportieren", "Es gibt noch keine Kontakte.");
      },
      copy(text) {
        void navigator.clipboard.writeText(text).then(
          () => app.notifications.show("info", "Kopiert", "Die Adresse ist in der Zwischenablage."),
          () => app.notifications.show("warning", "Nicht kopiert", "Die Zwischenablage ist nicht verfügbar."));
      },
      reject(message) {
        app.notifications.show("warning", "Ungültige Eingabe", message);
        renderContacts();
      }
    });

    app.interactions.init({
      async pickFolder() {
        try { await openFolder(await app.storage.pickFolder()); }
        catch (error) { reportOpenError(error, "MDC-101"); }
      },
      async reopenFolder() {
        try {
          const opened = await app.storage.reopenFolder();
          if (opened) await openFolder(opened);
          else app.notifications.show("warning", "Kein Zugriff", "Ohne Erlaubnis kann der Ordner nicht geöffnet werden.");
        } catch (error) {
          reportOpenError(error, "MDC-102");
        }
      },
      today() {
        if (!calendar) return;
        if (view === "contacts") view = portrait.matches ? "month" : "week";
        showDay(today);
        const cell = renderer().cell(today);
        if (cell) app.tiles.pulse(cell);
      },
      previous() { if (calendar) showDay(view === "week" ? app.calendar.addDays(anchor, -7) : app.calendar.addMonths(anchor, -1)); },
      next() { if (calendar) showDay(view === "week" ? app.calendar.addDays(anchor, 7) : app.calendar.addMonths(anchor, 1)); },
      showView(next) {
        if (!calendar || next === view) return;
        view = next;
        render();
      },
      openContact,
      openWeek(key) {
        if (view === "contacts") return;
        view = "week";
        showDay(key);
      },
      toggleBacklog() {
        if (!calendar) return;
        backlogOpen = !backlogOpen;
        render();
      },
      toggleHolidays() {
        if (calendar) app.holidaysPanel.toggle(holidays, today, year => calendar ? app.calendar.taggedPeriods(calendar, vacationTag, year) : []);
      },
      toggleSearch() {
        if (calendar) app.searchPanel.toggle();
      },
      showHelp() { app.menus.showHelp(); },
      isContactsView: () => view === "contacts",
      notice(title, body) { app.notifications.show("info", title, body); },
      contextMenu(picks, x, y, key) {
        if (!calendar || !backlog) return;
        /** @type {MDCMenuItem[]} */
        const items = [];
        if (picks.length) {
          const open = picks.some(pick => !pickDone(pick));
          items.push({ label: open ? "Erledigt" : "Nicht erledigt", icon: "check", key: "Leertaste", run: () => toggleMany(picks) });
          items.push({ label: picks.length > 1 ? `${picks.length} Einträge kopieren` : "Kopieren", icon: "copy", key: "Strg C", run: () => copy(picks) });
          items.push({ label: picks.length > 1 ? `${picks.length} Einträge löschen` : "Löschen", icon: "trash", key: "Entf", danger: true, run: () => removeMany(picks) });
        } else {
          items.push({ label: "Neuer Eintrag", icon: "plus", key: "N", run: () => newEntry(key) });
          if (clipboard.length) items.push({ label: clipboard.length > 1 ? `${clipboard.length} Einträge einfügen` : "Einfügen", icon: "clipboard", key: "Strg V", run: () => paste(key) });
        }
        app.menus.showContext(items, x, y);
      },
      toggleMany: picks => toggleMany(picks),
      removeMany: picks => removeMany(picks),
      copy: picks => copy(picks),
      paste: key => paste(key),
      moveMany(refs, dragged, target) {
        if (!calendar || !backlog) return;
        const ordered = refs.some(ref => sameRef(ref, dragged)) ? refs : [...refs, dragged];
        execute(app.backlog.moveEntries(calendar, backlog, ordered, target));
      },
      newEntry,
      openEntry,
      openOccurrence,
      openMultiDay,
      toggleOccurrence(index, key) {
        if (!calendar) return;
        execute(app.calendar.toggleOccurrence(calendar, index, key));
        const series = calendar.series[index];
        if (series && !("raw" in series) && series.done.includes(key)) void app.sounds.play();
      },
      toggle(ref) {
        if (!calendar || !backlog) return;
        execute(app.backlog.toggle(calendar, backlog, ref));
        if (app.backlog.entryAt(calendar, backlog, ref).done) void app.sounds.play();
      },
      move(from, to) {
        if (!calendar || !backlog) return;
        if (!execute(app.backlog.move(calendar, backlog, from, to))) {
          renderer().renderDays(calendar, [from.key, to.key], today);
          app.backlogPanel.render(backlog, backlogOpen);
        }
      },
      moveMultiDay(index, start, end) {
        const item = calendar?.multiDay[index];
        if (!calendar || !item || "raw" in item) return;
        execute(app.calendar.updateMultiDay(calendar, index, { ...item, start, end }));
      },
      undo() { showUndone(app.history.undo(history), true); },
      redo() { showUndone(app.history.redo(history), false); },
      save() { void save(); },
      toggleSound() {
        app.sounds.setMuted(!app.sounds.isMuted());
        updateHeader();
      }
    });

    window.addEventListener("beforeunload", event => {
      if (!calendar || (app.history.unsaved(history) === 0 && !hasConflict())) return;
      event.preventDefault();
      event.returnValue = "";
    });
    window.setInterval(() => { void checkExternal(); }, externalCheckInterval);
    window.addEventListener("focus", () => { void checkExternal(); });
    document.addEventListener("visibilitychange", () => { void checkExternal(); });
    scheduleMidnight();
    portrait.addEventListener("change", () => {
      // Rotating the screen switches to the default view of the new orientation.
      view = portrait.matches ? "month" : "week";
      render();
    });
    updateHeader();

    let remembered = null;
    try {
      remembered = await app.storage.rememberedFolder();
    } catch (error) {
      blockStartup("Browserspeicher nicht verfügbar", "Erlaube den Browserspeicher für diese Seite und lade sie neu.", error instanceof Error ? error.message : String(error), "MDC-004");
      return;
    }
    if (remembered?.granted) {
      try {
        const opened = await app.storage.reopenFolder();
        if (opened) {
          await openFolder(opened);
          document.body.dataset.startupState = "ready";
          return;
        }
      } catch (error) {
        reportOpenError(error, "MDC-102");
      }
    }
    app.start.show(remembered?.name || null);
    document.body.dataset.startupState = "ready";
  }

  void initialize().catch(error => {
    blockStartup("Start fehlgeschlagen", "MD_Calendar konnte nicht starten. Lade die Seite neu.", error instanceof Error ? error.stack || error.message : String(error), "MDC-005");
  });
})(window.MDCalendar);
