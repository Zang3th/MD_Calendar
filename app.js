/* global MDC_VERSION -- inserted by the build from package.json (tools/build.js) */
// Entry point of the bundle (docs/Architecture.md#runtime): the imports replace the former script tags
// and keep their order: libraries, domain, io, ui, then this file.
import "sortablejs/Sortable.min.js";
import { dates, history as undoHistory, markdown } from "@zang3th/md-libs/core";
import { audio, session, startup } from "@zang3th/md-libs/platform";
import "./domain/calendar.js";
import "./domain/recurrence.js";
import "./domain/backlog.js";
import "./domain/contacts.js";
import "./domain/search.js";
import "./io/calendar-format.js";
import "./io/backlog-format.js";
import "./io/holidays-format.js";
import "./io/config-format.js";
import "./io/contacts-format.js";
import "./io/vcard.js";
import "./io/ics.js";
import "./io/folder-state.js";
import "./io/storage.js";
import "./ui/notifications.js";
import "./ui/tooltips.js";
import "./ui/header.js";
import "./ui/start.js";
import "./ui/tiles.js";
import "./ui/render-week.js";
import "./ui/render-month.js";
import "./ui/render-contacts.js";
import "./ui/backlog-panel.js";
import "./ui/holidays-panel.js";
import "./ui/occasions-panel.js";
import "./ui/pickers.js";
import "./ui/dialog.js";
import "./ui/menus.js";
import "./ui/search-panel.js";
import "./ui/interactions.js";

window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Wires the layers together; owns startup, saving and external change handling (docs/Architecture.md).
(function (app) {
  // Completion sound, played with MD_Libs platform/audio: the Arpeggio (docs/ui/DesignSystem.md#completion-sound-arpeggio).
  /** @type {import("@zang3th/md-libs/platform").audio.MDLSound} */
  const completionSound = {
    gain: .09,
    dry: .7,
    wet: .3,
    voices: [
      { start: 0, points: [{ time: 0, frequency: 1046.50 }], attack: .004, hold: .020, release: .320, gain: .70 },
      { start: .055, points: [{ time: 0, frequency: 1318.51 }], attack: .004, hold: .020, release: .320, gain: .70 },
      { start: .110, points: [{ time: 0, frequency: 1567.98 }], attack: .004, hold: .040, release: .550, gain: .75 }
    ]
  };
  const synth = audio.create({ window, AudioContext });
  app.sounds = { play: () => synth.play(completionSound), setMuted: synth.setMuted, isMuted: synth.isMuted };

  /** Notification text: interpolated names are highlighted, `\n` starts a new line (MD_Libs ui/notifications). */
  const note = app.notifications.text;
  /** A button or function of MD_Calendar in a notification text. */
  const feature = app.notifications.control;
  /** A shortcut in a notification text, shown as keys. */
  const shortcut = app.notifications.key;

  const calendarFile = "Calendar.md";
  const backlogFile = "Backlog.md";
  const contactsFile = "Contacts.md";

  /** @returns {MDCHistory} */
  function createHistory() {
    return undoHistory.create();
  }

  /** @param {string} title @param {MDCNotificationBody} body @param {string} details @param {string} code */
  function blockStartup(title, body, details, code) {
    app.notifications.fatal(title, body, details, code);
  }

  async function initialize() {
    // The build replaces MDC_VERSION with the version from package.json (tools/build.js).
    app.header.setVersion(MDC_VERSION);
    const missingApis = app.storage.missingApis();
    if (missingApis.length) {
      blockStartup("Browser not supported", "Use Chrome or Edge.", `The browser lacks required features: ${missingApis.join(", ")}.`, "MDC-002");
      return;
    }

    const missingResources = await startup.missingResources({
      document,
      styles: { token: "--base", file: "styles.css" },
      fonts: [{ font: '600 16px "Plus Jakarta Sans"', text: "Äb", file: "vendor/fonts/PlusJakartaSans-latin.woff2" }],
      images: [{ image: document.querySelector(".logo img"), file: "res/logo/mark.svg" }]
    });
    if (missingResources.length) {
      blockStartup("Application files missing", "Restore the app folder, then reload.", `Not loaded: ${missingResources.join(", ")}.`, "MDC-003");
      return;
    }
    await startApplication();
  }

  async function startApplication() {
    /** Saving and external-change handling of the open folder (MD_Libs platform/session). @type {MDCSession | null} */
    let fileSession = null;
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
    let history = createHistory();
    const fileNames = /** @type {MDCFileName[]} */ (["Calendar.md", "Backlog.md", "Contacts.md", "Holidays.md", "Config.md"]);
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
    let midnightTimer = 0;

    function hasConflict() {
      return Boolean(fileSession?.hasConflict);
    }

    /** Data version for the search index; changes with every action and every reload. */
    let dataVersion = 0;
    /** Serialized writable files of the current data version. @type {{version: number, texts: Partial<Record<MDCFileName, string>>}} */
    let serializedTexts = { version: -1, texts: {} };

    function updateHeader() {
      app.header.update({
        open: Boolean(calendar),
        view,
        anchor,
        backlogOpen,
        unsaved: fileSession ? fileSession.unsaved : 0,
        history,
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

    /** The period one page of the current calendar view shows. */
    function viewPeriod() {
      return view === "week" ? "week" : "month";
    }

    /** Whether two anchors show the same period in the current view. @param {string} left @param {string} right */
    function samePeriod(left, right) {
      if (view === "contacts") return true;
      return dates.periodStart(left, viewPeriod()) === dates.periodStart(right, viewPeriod());
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
      app.notifications.show("warning", note`Unreadable lines in ${name}`, `${warnings.length === 1 ? "Line" : "Lines"} ${shown}, kept as is.`);
    }

    /** Parses one file (`null`: missing) into the model; writable files start a new history. @param {MDCFileName} name @param {string | null} text */
    function useFile(name, text) {
      dataVersion += 1;
      /** @type {MDCFormatWarning[]} */
      let warnings = [];
      if (name === "Calendar.md") {
        const parsed = app.calendarFormat.parse(text ?? "# Calendar\n");
        calendar = parsed.calendar;
        warnings = parsed.warnings;
      } else if (name === "Backlog.md") {
        const parsed = app.backlogFormat.parse(text ?? "# Backlog\n");
        backlog = parsed.backlog;
        warnings = parsed.warnings;
      } else if (name === "Contacts.md") {
        const parsed = app.contactsFormat.parse(text ?? "# Contacts\n");
        contacts = parsed.contacts;
        warnings = parsed.warnings;
      } else if (name === "Holidays.md") {
        const parsed = app.holidaysFormat.parse(text ?? "");
        holidays = parsed.holidays;
        app.tiles.setHolidays(holidays);
        app.holidaysPanel.update(holidays, today);
        warnings = parsed.warnings;
      } else {
        const parsed = app.configFormat.parse(text ?? "");
        config = parsed.config;
        warnings = parsed.warnings;
        const unknown = app.tiles.setTags(config.tags);
        if (unknown.length) {
          app.notifications.show("error", note`Unknown tag icons in ${"Config.md"}`, note`${unknown.map(tag => `${tag.name}: ${tag.icon || "no icon"}`).join(", ")}\nShown without icon.`, {
            code: "MDC-301",
            details: `Known icon IDs: ${app.tiles.tagIconIds().join(", ")}.`
          });
        }
      }
      if (writableFiles.includes(name)) history = createHistory();
      if (text === null) return;
      reportWarnings(name, warnings);
      const invalid = markdown.invalidCharacter(text);
      if (invalid) app.notifications.show("warning", note`Unreadable character in ${name}`, `Line ${invalid.line}. Save as UTF-8.`);
    }

    function clearConflict() {
      conflictNotice?.dismiss();
      conflictNotice = null;
    }

    /**
     * Reads every file of the folder into the model and starts its session: it checks for external changes
     * while the page is visible and no dialog is open, and asks before the page is left with unsaved changes.
     * @param {MDCStorageAdapter} opened
     */
    async function startSession(opened) {
      let previous = fileSession;
      const started = await session.open({
        adapter: opened,
        files: Object.fromEntries(fileNames.map(name => [name, {
          writable: writableFiles.includes(name),
          serialize: () => serialized(name),
          load: (/** @type {string | null} */ text) => {
            // Once the new files load, a check of the previous folder still in flight must not apply anything.
            previous?.destroy();
            previous = null;
            useFile(name, text);
          }
        }])),
        history: () => history,
        order: () => firstFile === calendarFile ? [calendarFile, backlogFile, contactsFile] : [backlogFile, calendarFile, contactsFile],
        reloadWhenClean: true,
        window,
        // While the dialog is open it refers to an entry by position; a reload would make that reference stale.
        shouldCheck: () => !app.dialog.isOpen(),
        confirmLeave: true
      });
      started.on("change", updateHeader);
      started.on("conflict", () => {
        clearConflict();
        showConflict();
      });
      started.on("blocked", showConflict);
      started.on("saved", ({ files }) => {
        clearConflict();
        updateHeader();
        if (!files.length) return;
        app.header.flashSaved();
        updateFolderState(opened, async (state, device, now) => app.folderState.saved(state, device, await hashes(opened, files), now));
      });
      started.on("reloaded", ({ file }) => {
        render();
        app.notifications.show("info", note`${file} reloaded`, "Changed outside the app.");
      });
      started.on("checkError", ({ error }) => {
        app.notifications.show("error", "File check failed", "Retrying automatically.", {
          details: error instanceof Error ? error.message : String(error),
          code: "MDC-202"
        });
      });
      fileSession = started;
    }

    /** MD_Calendar.json per opened folder; its updates run one after another. @type {WeakMap<MDCStorageAdapter, ReturnType<MDCalendarNamespace["folderState"]["file"]>>} */
    const folderStates = new WeakMap();

    /** @param {MDCStorageAdapter} folder */
    function folderStateOf(folder) {
      let file = folderStates.get(folder);
      if (!file) {
        file = app.folderState.file(folder, () => app.notifications.show("warning", note`${app.folderState.fileName} recreated`, "The file was unreadable."));
        folderStates.set(folder, file);
      }
      return file;
    }

    /**
     * Applies `change` to MD_Calendar.json. The calendar never depends on the file: a failure only warns.
     * @param {MDCStorageAdapter} folder
     * @param {(document: Record<string, any>, device: MDCDevice, now: Date) => MDCFolderState | Promise<MDCFolderState>} change
     */
    function updateFolderState(folder, change) {
      const device = app.storage.device();
      /** @type {MDCFolderState | null} */
      let written = null;
      folderStateOf(folder).update(async document => {
        written = await change(document, device, new Date());
        return written;
      }).then(updated => {
        // The start card shows this summary without opening the folder again; it is only a cache.
        if (updated && written) return app.storage.rememberInfo(folder, app.folderState.summary(written, device.id)).catch(() => {});
      }).catch(error => {
        app.notifications.show("error", note`${app.folderState.fileName} not updated`, "The calendar is not affected.", { details: error instanceof Error ? error.message : String(error), code: "MDC-203" });
      });
    }

    /** Fingerprint of each file as it is stored now. @param {MDCStorageAdapter} folder @param {string[]} files */
    async function hashes(folder, files) {
      /** @type {Record<string, string>} */
      const result = {};
      for (const file of files) {
        const stored = await folder.read(file);
        if (stored) result[file] = await app.storage.fingerprint(stored.text);
      }
      return result;
    }

    /** @param {MDCStorageAdapter} opened */
    async function openFolder(opened) {
      await startSession(opened);
      updateFolderState(opened, app.folderState.opened);
      app.start.hide();
      clearConflict();
      render();
      app.notifications.show("info", note`${opened.name} opened`, "");
    }

    /**
     * Shows the start card with the cached folder infos, then reads MD_Calendar.json of every folder the browser
     * still grants access to and shows what changed.
     * @param {MDCRecentFolder[]} folders
     */
    function showStart(folders) {
      app.start.show(folders);
      const deviceId = app.storage.device().id;
      const summarize = (/** @type {string} */ text) => {
        const state = app.folderState.read(text);
        return state ? app.folderState.summary(state, deviceId) : null;
      };
      void Promise.all(folders.map(folder => app.storage.refreshInfo(folder.id, summarize).catch(() => null))).then(infos => {
        if (calendar || !infos.some((info, index) => info && JSON.stringify(info) !== JSON.stringify(folders[index].info))) return;
        app.start.show(folders.map((folder, index) => ({ ...folder, info: infos[index] || folder.info })));
      });
    }

    /**
     * Opens an attempted folder or says why it did not open. A failed automatic opening of the last folder
     * stays silent unless the folder is gone or not a calendar folder.
     * @param {MDCOpenAttempt} attempt @param {boolean} [automatic]
     */
    async function openAttempt({ name, result }, automatic = false) {
      if (typeof result === "object") {
        await openFolder(result);
        return true;
      }
      const folder = name ? note`${name}` : ["The folder"];
      if (result === "missing") app.notifications.show("warning", automatic ? "Last folder not found" : "Folder not found", [...folder, ...note` was moved or deleted.\nReopen it with ${feature("Open folder")}.`]);
      else if (result === "uninitialized") app.notifications.show("warning", "Not a calendar folder", [...folder, ...note` has no ${"MD_Calendar.json"}.\nSet it up with ${feature("New calendar")}.`]);
      else if (!automatic) app.notifications.show("warning", "No access to the folder", "Allow access when asked.");
      return false;
    }

    /** @param {unknown} error @param {string} code @param {string} [title] */
    function reportOpenError(error, code, title = "Folder not opened") {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const details = error instanceof Error ? error.message : String(error);
      app.notifications.show("error", title, "Try again or choose another folder.", { details, code });
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
      // A changed group order rebuilds the backlog lists, which then need their drag and drop again.
      if (action.backlog && app.backlogPanel.render(backlog, backlogOpen)) bindLists();
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
      history.execute({ ...action, beforeViewState: action.contacts ? { ...before, view: "contacts" } : before, afterViewState: after });
      if (action.target) firstFile = /** @type {MDCFileName} */ (action.target);
      if (action.contacts && view !== "contacts") {
        view = "contacts";
        render();
      } else showChange(action);
      return true;
    }

    /** Returns to the view of an undone or redone action. @param {MDCUndoAction | null} entry @param {boolean} undone */
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
      if (conflictNotice?.isOpen() || !fileSession) return;
      const changed = fileSession.conflicts;
      const deleted = changed.filter(conflict => conflict.text === null);
      const files = changed.map(conflict => conflict.file).join(", ");
      const title = deleted.length === changed.length ? "Deleted externally" : deleted.length ? "Changed or deleted" : "Changed externally";
      conflictNotice = app.notifications.show("warning", title, note`${files}\n${feature("Reload")} discards your changes.\n${feature("Overwrite")} keeps them.`, {
        persistent: true,
        actions: [
          { label: "Reload", run: reloadWritable, primary: false },
          { label: "Overwrite", run: () => { void save(true); }, primary: true }
        ]
      });
      updateHeader();
    }

    /** Discards local changes in Calendar.md, Backlog.md and Contacts.md and applies the versions on disk. */
    function reloadWritable() {
      if (!fileSession?.reload()) return;
      clearConflict();
      render();
      app.notifications.show("info", "Files reloaded", "Unsaved changes discarded.");
    }

    /** @param {MDCFileName} name */
    function serialized(name) {
      if (serializedTexts.version !== dataVersion) serializedTexts = { version: dataVersion, texts: {} };
      const cached = serializedTexts.texts[name];
      if (cached !== undefined) return cached;
      const text = name === "Contacts.md" ? app.contactsFormat.serialize(/** @type {MDCContacts} */ (contacts))
        : name === "Calendar.md" ? app.calendarFormat.serialize(/** @type {MDCCalendar} */ (calendar)) : app.backlogFormat.serialize(/** @type {MDCBacklog} */ (backlog));
      serializedTexts.texts[name] = text;
      return text;
    }

    /** @param {boolean} [force] */
    async function save(force = false) {
      if (!fileSession || !calendar) return;
      try {
        await fileSession.save(force);
      } catch (error) {
        app.notifications.show("error", "Save failed", note`Changes kept. Retry with ${shortcut("Ctrl+S")}.`, {
          details: error instanceof Error ? error.message : String(error),
          code: "MDC-201"
        });
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
      return dates.periodStart(anchor, viewPeriod());
    }

    /** Copied entries; pasting inserts open copies (docs/ui/Interaction.md#copy-and-paste). @type {MDCEntry[]} */
    let clipboard = [];

    /** @param {MDCNotificationBody} title @param {MDCNotificationBody} [detail] A line before the undo hint. */
    function confirmDeleted(title, detail) {
      const undo = note`Undo with ${shortcut("Ctrl+Z")}.`;
      app.notifications.show("info", title, detail ? [...(typeof detail === "string" ? [detail] : detail), { lineBreak: true }, ...undo] : undo);
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
          confirmDeleted(note`${entry.title} deleted`);
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
          confirmDeleted(note`${series.title} deleted`, "All occurrences.");
        },
        deleteOccurrence: () => {
          if (!calendar) return;
          execute(app.calendar.deleteOccurrence(calendar, index, key));
          confirmDeleted(note`${series.title} deleted`, `Only ${app.calendar.formatDate(key)}.`);
        },
        endSeries: () => {
          if (!calendar) return;
          execute(app.calendar.endSeries(calendar, index, key));
          app.notifications.show("info", "Series ended", note`${series.title} ends ${app.calendar.formatDate(key)}.\nUndo with ${shortcut("Ctrl+Z")}.`);
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
          confirmDeleted(note`${item.title} deleted`);
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
    const vacationTag = "Vacation";

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
      execute(actions.length === 1 ? actions[0] : app.calendar.combine(`${picks.length} entries`, actions));
      app.interactions.refreshSelection();
      if (done) void app.sounds.play();
    }

    /** @param {MDCPick[]} picks */
    function removeMany(picks) {
      if (!calendar || !backlog || !picks.length) return;
      const refs = refsOf(picks);
      const label = picks.length === 1 ? pickTitle(picks[0]) : `${picks.length} entries`;
      const actions = [
        ...(refs.length ? [app.backlog.removeEntries(calendar, backlog, refs, label)] : []),
        ...app.calendar.changeOccurrences(calendar, occurrencesOf(picks), "delete")
      ];
      if (!actions.length) return;
      app.interactions.clearSelection();
      execute(actions.length === 1 ? actions[0] : app.calendar.combine(label, actions));
      confirmDeleted(picks.length === 1 ? note`${label} deleted` : note`${picks.length} entries deleted`);
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
      app.notifications.show("info", clipboard.length === 1 ? note`${clipboard[0].title} copied` : note`${clipboard.length} entries copied`, note`Paste with ${shortcut("Ctrl+V")}.`);
    }

    /** Inserts open copies of the clipboard at the end of a day. @param {string} key */
    function paste(key) {
      if (!calendar || !backlog || view === "contacts") return;
      if (!clipboard.length) {
        app.notifications.show("info", "Nothing to paste", note`Copy with ${shortcut("Ctrl+C")} first.`);
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

    /** @param {string} text @param {string} name */
    function importCalendar(text, name) {
      if (!calendar) return;
      const { events, skipped } = app.ics.parse(text);
      if (!events.length) {
        app.notifications.show("warning", "No events found", note`${name} has no events.`);
        return;
      }
      const result = app.calendar.importEvents(calendar, events, today);
      if (!result.action) {
        app.notifications.show("info", "Nothing imported", "All events exist already.");
        return;
      }
      if (view === "contacts") view = portrait.matches ? "month" : "week";
      execute(result.action);
      if (events.length === 1) showDay(events[0].start);
      const imported = result.entries + result.series + result.multiDay;
      const lines = [result.duplicates + skipped ? note`${result.duplicates + skipped} skipped.` : [],
        result.simplified ? note`${result.simplified} series as single events.` : [], note`Undo with ${shortcut("Ctrl+Z")}.`].filter(line => line.length);
      app.notifications.show("info", `${imported} ${imported === 1 ? "event" : "events"} imported`,
        lines.flatMap((line, index) => index ? [{ lineBreak: /** @type {const} */ (true) }, ...line] : line));
    }

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
        const name = app.contacts.name(contacts.contacts[index]);
        execute(app.contacts.remove(contacts, index));
        confirmDeleted(name ? note`${name} deleted` : "Contact deleted");
      },
      importText(text, name) {
        if (!contacts) return;
        const found = app.vcard.parse(text);
        const result = app.contacts.importContacts(contacts, found);
        if (!found.length) {
          app.notifications.show("warning", "No contacts found", note`${name} has no vCards.`);
          return;
        }
        execute(result.action);
        app.notifications.show("info", "Contacts imported", note`${result.added} new, ${result.merged} merged.\nUndo with ${shortcut("Ctrl+Z")}.`);
      },
      exportOne(index) {
        const contact = contacts?.contacts[index];
        if (contact) download(`${app.contacts.name(contact) || "Contact"}.vcf`, app.vcard.serialize([contact]));
      },
      exportAll() {
        if (contacts?.contacts.length) download("Contacts.vcf", app.vcard.serialize(contacts.contacts));
        else app.notifications.show("info", "Nothing to export", "No contacts yet.");
      },
      copy(text) {
        void navigator.clipboard.writeText(text).then(
          () => app.notifications.show("info", "Address copied", ""),
          () => app.notifications.show("warning", "Copy failed", "Clipboard blocked."));
      },
      reject(title, body) {
        app.notifications.show("warning", title, body);
        renderContacts();
      }
    });

    app.interactions.init({
      async pickFolder() {
        try { await openAttempt(await app.storage.pickFolder()); }
        catch (error) { reportOpenError(error, "MDC-101"); }
      },
      async createCalendar() {
        try { await openFolder(await app.storage.createCalendar(folder => folderStateOf(folder).update(document => document))); }
        catch (error) { reportOpenError(error, "MDC-104", "Calendar not created"); }
      },
      async openRecent(id) {
        try {
          await openAttempt(await app.storage.openRecent(id));
        } catch (error) {
          reportOpenError(error, "MDC-102");
        }
      },
      async forgetRecent(id) {
        try {
          await app.storage.forgetFolder(id);
          showStart(await app.storage.recentFolders());
        } catch (error) {
          app.notifications.show("error", "Recent folders not updated", "The list may be outdated.", { details: error instanceof Error ? error.message : String(error), code: "MDC-103" });
        }
      },
      showStart() {
        if (!calendar) return;
        // Reloading keeps the unsaved-changes prompt of the browser; the next startup shows the start card.
        app.storage.skipNextAutoOpen();
        location.reload();
      },
      importCalendar,
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
      showOccasions(key, kind, left, right, top) {
        const items = app.tiles.dayOccasions(key)[kind];
        const words = { anniversary: ["Anniversary", "anniversaries"], birthday: ["Birthday", "birthdays"], holiday: ["Holiday", "holidays"] }[kind];
        app.occasionsPanel.show({
          kind,
          title: items.length === 1 ? words[0] : `${items.length} ${words[1]}`,
          date: app.calendar.formatDay(key, "dddd, D MMMM"),
          // People open their contact; holidays are only listed.
          items: items.map(item => ({
            name: item.name,
            detail: kind === "anniversary" ? item.label : "",
            badge: item.age === null ? "" : kind === "birthday" ? `turns ${item.age}` : `${item.age} ${item.age === 1 ? "year" : "years"}`,
            open: item.index >= 0 ? () => openContact(item.index) : null
          }))
        }, left, right, top);
      },
      showOptions() { app.menus.showOptions(); },
      showNewMenu() {
        if (!calendar) return;
        app.menus.showNewMenu([
          view === "contacts" ? { label: "Create new contact", icon: "plus", run: newContact } : { label: "Create new entry", icon: "plus", run: () => newEntry() },
          { label: "Import {.ics} event", icon: "import", run: () => app.interactions.chooseCalendarFile() }
        ]);
      },
      isContactsView: () => view === "contacts",
      notice(title, body) { app.notifications.show("info", title, body); },
      contextMenu(picks, x, y, key) {
        if (!calendar || !backlog) return;
        /** @type {MDCMenuItem[]} */
        const items = [];
        if (picks.length) {
          const open = picks.some(pick => !pickDone(pick));
          items.push({ label: open ? "Done" : "Not done", icon: "check", run: () => toggleMany(picks) });
          items.push({ label: picks.length > 1 ? `Copy ${picks.length} entries` : "Copy", icon: "copy", run: () => copy(picks) });
          items.push({ label: picks.length > 1 ? `Delete ${picks.length} entries` : "Delete", icon: "trash", danger: true, run: () => removeMany(picks) });
        } else {
          items.push({ label: "New entry", icon: "plus", run: () => newEntry(key) });
          if (clipboard.length) items.push({ label: clipboard.length > 1 ? `Paste ${clipboard.length} entries` : "Paste", icon: "clipboard", run: () => paste(key) });
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
      moveGroup(from, to) {
        if (backlog) execute(app.backlog.moveGroup(backlog, from, to));
      },
      moveMultiDay(index, start, end) {
        const item = calendar?.multiDay[index];
        if (!calendar || !item || "raw" in item) return;
        execute(app.calendar.updateMultiDay(calendar, index, { ...item, start, end }));
      },
      undo() { showUndone(history.undo()?.action ?? null, true); },
      redo() { showUndone(history.redo()?.action ?? null, false); },
      save() { void save(); },
      toggleSound() {
        app.sounds.setMuted(!app.sounds.isMuted());
        updateHeader();
      }
    });

    scheduleMidnight();
    portrait.addEventListener("change", () => {
      // Rotating the screen switches to the default view of the new orientation.
      view = portrait.matches ? "month" : "week";
      render();
    });
    updateHeader();

    /** @type {MDCRecentFolder[]} */
    let recent = [];
    try {
      recent = await app.storage.recentFolders();
    } catch (error) {
      blockStartup("Browser storage blocked", "Allow site data, then reload.", error instanceof Error ? error.message : String(error), "MDC-004");
      return;
    }
    // The last folder opens directly while the browser still grants access, unless the logo led back to the start card.
    const skipAutoOpen = app.storage.takeSkipAutoOpen();
    if (recent.length && !skipAutoOpen) {
      try {
        // A folder that is gone or not a calendar folder leaves the start card open instead of an empty calendar.
        const last = await app.storage.openLast();
        if (last && await openAttempt(last, true)) {
          document.body.dataset.startupState = "ready";
          return;
        }
      } catch (error) {
        reportOpenError(error, "MDC-102");
      }
    }
    showStart(recent);
    document.body.dataset.startupState = "ready";
  }

  void initialize().catch(error => {
    blockStartup("Startup failed", "Reload the page.", error instanceof Error ? error.stack || error.message : String(error), "MDC-005");
  });
})(window.MDCalendar);
