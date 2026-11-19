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
import "./ui/dialog.js";
import "./ui/menus.js";
import "./ui/search-panel.js";
import "./ui/focus.js";
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

  const calendarFile = "Calendar.md";
  const backlogFile = "Backlog.md";
  const contactsFile = "Contacts.md";

  /**
   * The undo history keeps to real changes (docs/Architecture.md#undo-history): a change and its reversal leave no steps,
   * and repeated edits of one field are one step. Its fingerprint is that of the writable files' texts.
   * @param {() => string[]} texts
   * @returns {MDCHistory}
   */
  function createHistory(texts) {
    return undoHistory.create({ fingerprint: () => undoHistory.fingerprint(texts()) });
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
    /** Serialized texts of the writable files, for the history's fingerprint. */
    const writableTexts = () => writableFiles.map(name => serialized(name));
    let history = createHistory(writableTexts);
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
    /**
     * First shown day when the days of the week view were dragged off Monday, otherwise "" (docs/ui/Views.md#week-landscape).
     * The anchor then stays one of the shown days.
     */
    let freeStart = "";
    /** Default view per orientation (docs/ui/Views.md#default-view). @type {MDCView} */
    let view = portrait.matches ? "month" : "week";
    let backlogOpen = false;
    let midnightTimer = 0;
    /** Shortest time the saving state shows, in milliseconds. */
    const savingMinimum = 600;

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
        start: weekStart(),
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
        rebuiltView = renderView();
      }
      const rebuiltBacklog = app.backlogPanel.render(backlog, backlogOpen);
      if (rebuiltView || rebuiltBacklog) bindLists();
      // The focus card belongs to the week view (docs/ui/Views.md#focus-mode).
      if (view === "week") app.focus.refresh(calendar, today);
      else app.focus.close();
      app.interactions.refreshSelection();
      updateHeader();
    }

    /** The first day the week view shows: Monday of the anchor's week, or the day the days were dragged to. */
    function weekStart() {
      return freeStart || app.calendar.weekStart(anchor);
    }

    /** Renders the week or month of the anchor; returns true when its day lists were rebuilt. */
    function renderView() {
      if (!calendar) return false;
      return view === "week" ? app.week.render(calendar, weekStart(), today) : app.month.render(calendar, anchor, today);
    }

    /** Whether the current view shows the day `key`. @param {string} key */
    function shows(key) {
      if (view === "week" && freeStart) return key >= freeStart && key <= app.calendar.addDays(freeStart, 6);
      return samePeriod(key, anchor);
    }

    /**
     * Shows the seven days from `start` in the week view; a Monday returns to whole weeks. Days that stay partly in
     * view glide into place, a farther change slides in like a new week.
     * @param {string} start @param {number} [rest] pixels the days stand off their place after a drag
     */
    function showWeekFrom(start, rest) {
      const from = weekStart();
      const days = dates.dayNumber(start) - dates.dayNumber(from);
      freeStart = app.calendar.weekStart(start) === start ? "" : start;
      // The anchor stays one of the shown days: today when shown, else the previous anchor when shown, else the first day.
      const last = app.calendar.addDays(start, 6);
      const inside = (/** @type {string} */ key) => key >= start && key <= last;
      anchor = inside(today) ? today : inside(anchor) ? anchor : start;
      render();
      if (rest !== undefined) app.week.settle(rest);
      else if (Math.abs(days) < 7) app.week.settle(days * app.week.daySize());
      else app.tiles.slide("week", days < 0 ? -1 : 1);
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
      app.notifications.show("warning", "Unreadable lines", note`${name}, ${warnings.length === 1 ? "line" : "lines"} ${shown}\nKept as is.`);
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
          app.notifications.show("error", "Unknown tag icons", note`${"Config.md"}\n${unknown.map(tag => `${tag.name}: ${tag.icon || "no icon"}`).join(", ")}\nShown without icon.`, {
            code: "MDC-301",
            details: `Known icon IDs: ${app.tiles.tagIconIds().join(", ")}.`
          });
        }
      }
      if (writableFiles.includes(name)) history = createHistory(writableTexts);
      if (text === null) return;
      reportWarnings(name, warnings);
      const invalid = markdown.invalidCharacter(text);
      if (invalid) app.notifications.show("warning", "Unreadable character", note`${name}, line ${invalid.line}\nSave it as UTF-8.`);
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
        app.notifications.show("info", "File reloaded", note`${file} changed outside the app.`);
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
        file = app.folderState.file(folder, () => app.notifications.show("warning", "File recreated", note`${app.folderState.fileName} was unreadable.`));
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
        app.notifications.show("error", "File not updated", note`${app.folderState.fileName}\nThe calendar is not affected.`, { details: error instanceof Error ? error.message : String(error), code: "MDC-203" });
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
      app.notifications.show("info", "Folder opened", note`${opened.name}`);
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
      if (result === "missing") app.notifications.show("warning", automatic ? "Last folder not found" : "Folder not found", [...folder, ...note` was moved or deleted.`]);
      else if (result === "uninitialized") app.notifications.show("warning", "Not a calendar folder", [...folder, ...note` has no ${"MD_Calendar.json"}.\nSet it up with ${feature("New calendar")}.`]);
      else if (!automatic) app.notifications.show("warning", "No access to the folder", "Allow access when asked.");
      return false;
    }

    /** @param {unknown} error @param {string} code @param {string} [title] */
    function reportOpenError(error, code, title = "Folder not opened") {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const details = error instanceof Error ? error.message : String(error);
      app.notifications.show("error", title, "", { details, code });
    }

    /** Updates what an action changed. @param {MDCUndoAction} action */
    function showChange(action) {
      if (!calendar || !backlog) return;
      if (action.contacts) {
        app.tiles.setContacts(contacts);
        if (view === "contacts") renderContacts();
        else renderView();
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
      app.focus.refresh(calendar, today);
      app.interactions.refreshSelection();
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
      // Every change of the data, also through undo and redo, starts a new data version, so that the cached texts the
      // history's fingerprint reads are never stale.
      history.execute({
        ...action,
        redo() { dataVersion += 1; return action.redo(); },
        undo() { dataVersion += 1; action.undo(); },
        beforeViewState: action.contacts ? { ...before, view: "contacts" } : before, afterViewState: after
      });
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
      if (target.view !== view || !shows(target.anchor)) {
        view = target.view;
        anchor = target.anchor;
        freeStart = "";
        render();
      } else showChange(entry);
    }

    function showConflict() {
      if (conflictNotice?.isOpen() || !fileSession) return;
      const changed = fileSession.conflicts;
      const deleted = changed.filter(conflict => conflict.text === null);
      const files = changed.map(conflict => conflict.file).join(", ");
      const title = deleted.length === changed.length ? "Deleted externally" : deleted.length ? "Changed or deleted" : "Changed externally";
      // The buttons say what they do; the body only names the files (docs/ui/Shell.md#notifications).
      conflictNotice = app.notifications.show("warning", title, note`${files}`, {
        persistent: true,
        actions: [
          { label: "Overwrite", run: () => { void save(true); }, tone: "warning" },
          { label: "Reload", run: reloadWritable, tone: "success" }
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
      // The saving state stays at least a moment, so that a quick save does not flicker (docs/ui/Shell.md#save-control).
      const shown = force || fileSession.unsaved > 0;
      if (shown) app.header.saving(true);
      try {
        await Promise.all([fileSession.save(force), shown ? new Promise(resolve => window.setTimeout(resolve, savingMinimum)) : null]);
      } catch (error) {
        app.notifications.show("error", "Save failed", "Your changes are kept.", {
          details: error instanceof Error ? error.message : String(error),
          code: "MDC-201"
        });
      } finally {
        if (shown) app.header.saving(false);
      }
    }

    /** One week or month back or forward; dragged days keep their offset. @param {number} direction */
    function step(direction) {
      // In focus mode the arrows go through the days of the focus card.
      if (app.focus.isOpen()) app.focus.step(direction);
      else if (view === "week" && freeStart) showWeekFrom(app.calendar.addDays(freeStart, 7 * direction));
      else showDay(view === "week" ? app.calendar.addDays(anchor, 7 * direction) : app.calendar.addMonths(anchor, direction));
    }

    /** @param {string} key */
    function showDay(key) {
      const direction = view === "contacts" || shows(key) ? 0 : key < anchor ? -1 : 1;
      // A day outside the dragged days returns to whole weeks.
      if (direction) freeStart = "";
      anchor = key;
      render();
      if (direction && view !== "contacts") app.tiles.slide(view === "week" ? "week" : "month", direction);
    }

    /** The first visible day of the shown period, or today when it is visible. */
    function visibleDay() {
      if (shows(today)) return today;
      return view === "week" ? weekStart() : dates.periodStart(anchor, viewPeriod());
    }

    /** Copied entries; pasting inserts open copies (docs/ui/Interaction.md#selection-copy-and-paste). @type {MDCEntry[]} */
    let clipboard = [];

    /**
     * Confirms an action: the title names it, the body says what exactly, one entry per line (docs/ui/Shell.md#notifications).
     * At most `shownTitles` names are listed, the rest as “and N more”.
     * @param {string} title @param {string[]} names @param {string} [detail] A further line, such as the date.
     */
    function confirm(title, names, detail) {
      const lines = names.slice(0, shownTitles).map(name => note`${name}`);
      if (names.length > shownTitles) lines.push(note`and ${names.length - shownTitles} more`);
      if (detail) lines.push(note`${detail}`);
      app.notifications.show("info", title, lines.flatMap((line, index) => index ? [{ lineBreak: /** @type {const} */ (true) }, ...line] : line));
    }
    const shownTitles = 3;

    /**
     * The title of a confirmation for entries: “Entry copied” for one, “3 entries copied” for several.
     * @param {number} count @param {string} done the past participle, such as “copied”
     */
    const entriesTitle = (count, done) => count === 1 ? `Entry ${done}` : `${count} entries ${done}`;

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
      if (!result.date) return app.backlog.create(target, /** @type {MDCBacklog} */ (backlog), { ...base, start: result.startTime, end: result.endTime, extra });
      return app.calendar.createEntry(target, result.date, { ...base, start: result.startTime, end: result.endTime, extra });
    }

    /** @param {MDCDialogResult} result */
    function entryFields(result) {
      return { title: result.title, start: result.startTime, end: result.endTime, location: result.location, note: result.note, tag: result.tag };
    }

    /** @param {MDCDialogResult} result */
    function showResult(result) {
      if (result.date && !shows(result.date) && (!result.end || !shows(result.end))) showDay(result.date);
    }

    /**
     * Where a dialog result will be created, read before it is: a day entry goes into its time slot, a series or
     * multi-day entry to the end of its list, a backlog entry to the end of its tag's group (docs/Domain.md#backlog).
     * @param {MDCDialogResult} result @returns {() => Element | null} finds its tile once created and rendered
     */
    function createdTile(result) {
      const target = /** @type {MDCCalendar} */ (calendar);
      if (result.kind === "series") {
        const index = target.series.length;
        return () => renderer().cell(result.date)?.querySelector(`.ev[data-series="${index}"]`) || document.querySelector(`.ev[data-series="${index}"]`);
      }
      if (result.kind === "multiDay") {
        const index = target.multiDay.length;
        return () => document.querySelector(`.bar[data-multi="${index}"]`);
      }
      if (!result.date) {
        return () => {
          const store = /** @type {MDCBacklog} */ (backlog);
          const group = result.tag ? store.groups.findIndex(candidate => candidate.name === result.tag) : app.backlog.ungrouped;
          const list = group === app.backlog.ungrouped ? store.ungrouped : store.groups[group]?.entries || [];
          return document.querySelector(`.bl__list[data-group="${group}"] .ev[data-index="${list.length - 1}"]`);
        };
      }
      const index = app.calendar.timeSlot(app.calendar.entries(target, result.date), result.startTime);
      return () => renderer().cell(result.date)?.querySelector(`.ev[data-index="${index}"]`) || null;
    }

    /**
     * Creates what the dialog describes, confirms it, shows it and highlights it once, like a search hit. The confirmation
     * names where it went: its day, its days or the backlog. @param {MDCDialogResult} result
     */
    function createAndShow(result) {
      const find = createdTile(result);
      execute(createFrom(result, null));
      const where = !result.date ? "Backlog" : result.end ? `${app.calendar.formatDate(result.date)} – ${app.calendar.formatDate(result.end)}` : app.calendar.formatDate(result.date);
      confirm(result.kind === "series" ? "Series created" : "Entry created", [result.title], where);
      showResult(result);
      const tile = find();
      if (tile instanceof HTMLElement) app.tiles.highlight(tile);
    }

    /** Locations used before, most recent first, for the location popover; computed once per data version. */
    let recentLocations = { version: -1, /** @type {string[]} */ list: /** @type {string[]} */ ([]) };

    function locations() {
      if (recentLocations.version === dataVersion || !calendar || !backlog) return recentLocations.list;
      /** @type {Array<[string, string]>} */
      const used = [];
      for (const day of calendar.days.values()) for (const entry of day.entries) if (entry.location) used.push([day.key, entry.location]);
      for (const item of [...calendar.multiDay, ...calendar.series]) if (!("raw" in item) && item.location) used.push([item.start, item.location]);
      for (const entry of [...backlog.ungrouped, ...backlog.groups.flatMap(group => group.entries)]) if (entry.location) used.push(["", entry.location]);
      used.sort((left, right) => right[0].localeCompare(left[0]));
      recentLocations = { version: dataVersion, list: [...new Set(used.map(([, place]) => place.trim()).filter(Boolean))] };
      return recentLocations.list;
    }

    /** @param {Omit<MDCDialogRequest, "tags" | "locations">} request @param {MDCDialogHandlers} handlers */
    function openDialog(request, handlers) {
      app.dialog.open({ ...request, tags: config.tags, locations: locations() }, handlers);
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
        apply: createAndShow,
        remove: noAction, deleteOccurrence: noAction, endSeries: noAction
      });
    }

    /** A new entry for the backlog, with the tag of `group` preset (none for the ungrouped entries). @param {number} group */
    function newBacklogEntry(group) {
      if (!calendar || !backlog) return;
      const tag = backlog.groups[group]?.name || "";
      openDialog({ kind: "entry", isNew: true, inBacklog: true, title: "", location: "", note: [], tag, date: "", end: "", startTime: "", endTime: "", rule: null, occurrence: "" }, {
        apply: createAndShow,
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
          // Without a date the entry goes to (or stays in) the backlog, where its tag decides the group (docs/Domain.md#backlog).
          const target = result.date ? { key: result.date } : { key: "", group: inBacklog ? ref.group : app.backlog.ungrouped };
          execute(app.backlog.update(calendar, backlog, ref, target, entryFields(result)));
          if (inBacklog) showResult(result);
        },
        remove: () => {
          if (!calendar || !backlog) return;
          execute(app.backlog.remove(calendar, backlog, ref));
          confirm("Entry deleted", [entry.title]);
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
        remove: () => {
          if (!calendar) return;
          execute(app.calendar.deleteSeries(calendar, index));
          confirm("Series deleted", [series.title], "All occurrences");
        },
        deleteOccurrence: () => {
          if (!calendar) return;
          execute(app.calendar.deleteOccurrence(calendar, index, key));
          confirm("Occurrence deleted", [series.title], app.calendar.formatDate(key));
        },
        endSeries: () => {
          if (!calendar) return;
          execute(app.calendar.endSeries(calendar, index, key));
          confirm("Series ended", [series.title], `Last on ${app.calendar.formatDate(key)}`);
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
        remove: () => {
          if (!calendar) return;
          execute(app.calendar.deleteMultiDay(calendar, index));
          confirm("Entry deleted", [item.title]);
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
      app.notifications.show("info", "Contact created", "");
      app.contactsView.focusField("name");
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

    /** @param {MDCPick[]} picks @param {boolean} [cut] the entries were copied before (Ctrl+X) */
    function removeMany(picks, cut = false) {
      if (!calendar || !backlog || !picks.length) return;
      const refs = refsOf(picks);
      const label = picks.length === 1 ? pickTitle(picks[0]) : `${picks.length} entries`;
      const names = picks.map(pickTitle);
      const actions = [
        ...(refs.length ? [app.backlog.removeEntries(calendar, backlog, refs, label)] : []),
        ...app.calendar.changeOccurrences(calendar, occurrencesOf(picks), "delete")
      ];
      if (!actions.length) return;
      app.interactions.clearSelection();
      execute(actions.length === 1 ? actions[0] : app.calendar.combine(label, actions));
      confirm(entriesTitle(picks.length, cut ? "cut" : "deleted"), names);
    }

    /** Copies the picked entries; an occurrence is copied as a plain entry with the fields of its series. @param {MDCPick[]} picks */
    function copy(picks) {
      if (!fillClipboard(picks)) return;
      confirm(entriesTitle(clipboard.length, "copied"), clipboard.map(entry => entry.title));
    }

    /** Copies the picked entries and deletes them as one undoable action; an occurrence is deleted as that occurrence only. @param {MDCPick[]} picks */
    function cut(picks) {
      if (fillClipboard(picks)) removeMany(picks, true);
    }

    /** Puts the picked entries into the clipboard; returns whether anything was copied. @param {MDCPick[]} picks */
    function fillClipboard(picks) {
      if (!calendar || !backlog || !picks.length) return false;
      const currentCalendar = calendar;
      const currentBacklog = backlog;
      clipboard = picks.flatMap(pick => {
        if (pick.ref) return [{ ...app.backlog.entryAt(currentCalendar, currentBacklog, pick.ref) }];
        const series = currentCalendar.series[/** @type {number} */ (pick.series)];
        return series && !("raw" in series)
          ? [{ done: false, start: series.startTime, end: series.endTime, title: series.title, tag: series.tag, location: series.location, note: [...series.note], extra: [] }]
          : [];
      });
      return clipboard.length > 0;
    }

    /**
     * Inserts open copies of the clipboard into a day, or into the backlog at a place (docs/ui/Interaction.md#selection-copy-and-paste).
     * @param {MDCEntryRef | null} target without one, the preselected day
     */
    function paste(target) {
      if (!calendar || !backlog || view === "contacts") return;
      if (!clipboard.length) {
        app.notifications.show("info", "Nothing to paste", "");
        return;
      }
      execute(app.backlog.pasteEntries(calendar, backlog, clipboard, target || { key: visibleDay(), index: 0 }));
      confirm(entriesTitle(clipboard.length, "pasted"), clipboard.map(entry => entry.title));
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
        if (tile instanceof HTMLElement) app.tiles.highlight(tile);
        return;
      }
      const series = item.kind === "series" ? calendar.series[/** @type {number} */ (item.series)] : null;
      const key = series && !("raw" in series) ? app.search.nextOccurrence(series, today) : item.key;
      if (view === "contacts") view = portrait.matches ? "month" : "week";
      showDay(key);
      const find = () => item.kind === "entry" ? renderer().cell(key)?.querySelector(`.ev[data-index="${item.ref?.index}"]`)
        : item.kind === "series" ? renderer().cell(key)?.querySelector(`.ev[data-series="${item.series}"]`)
          : document.querySelector(`.bar[data-multi="${item.multi}"]`);
      let tile = find();
      // A hit hidden behind "+N" in the month: the cell enlarges, so that the entry itself shows.
      if (!tile && item.kind !== "multiDay" && view === "month") {
        app.month.toggle(key);
        tile = find();
      }
      const target = tile instanceof HTMLElement ? tile : renderer().cell(key);
      if (target) app.tiles.highlight(target);
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
      const lines = [note`${imported} ${imported === 1 ? "event" : "events"} from ${name}`, result.duplicates + skipped ? note`${result.duplicates + skipped} skipped` : [],
        result.simplified ? note`${result.simplified} series as single events` : []].filter(line => line.length);
      app.notifications.show("info", "Events imported",
        lines.flatMap((line, index) => index ? [{ lineBreak: /** @type {const} */ (true) }, ...line] : line));
    }

    app.contactsView.init({
      select(index) {
        selectedContact = index;
        renderContacts();
      },
      update(index, updated, field) {
        const action = contacts ? app.contacts.update(contacts, index, updated) : null;
        // Repeated edits of one field of one contact are one undo step (docs/Architecture.md#undo-history).
        if (action) execute(field ? { ...action, coalesce: `contact:${index}:${field}` } : action);
      },
      remove(index) {
        if (!contacts || !contacts.contacts[index]) return;
        const name = app.contacts.name(contacts.contacts[index]);
        execute(app.contacts.remove(contacts, index));
        confirm("Contact deleted", [name || "Unnamed contact"]);
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
        app.notifications.show("info", "Contacts imported", note`${result.added} new, ${result.merged} merged from ${name}`);
      },
      exportOne(index) {
        const contact = contacts?.contacts[index];
        if (contact) download(`${app.contacts.name(contact) || "Contact"}.vcf`, app.vcard.serialize([contact]));
      },
      exportAll() {
        if (contacts?.contacts.length) download("Contacts.vcf", app.vcard.serialize(contacts.contacts));
        else app.notifications.show("info", "Nothing to export", "");
      },
      copy(text) {
        void navigator.clipboard.writeText(text).then(
          () => app.notifications.show("info", "Copied to clipboard", note`${text}`),
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
        // Today returns to whole weeks (docs/ui/Interaction.md#keyboard-shortcuts).
        if (view === "week" && freeStart) showWeekFrom(app.calendar.weekStart(today));
        else showDay(today);
        const cell = renderer().cell(today);
        if (cell) app.tiles.highlight(cell);
      },
      previous() { if (calendar) step(-1); },
      next() { if (calendar) step(1); },
      snapToWeek() {
        // After a drag the first wheel gesture returns to the week that is mostly shown (docs/ui/Interaction.md#pointer).
        if (!calendar || view !== "week" || !freeStart) return false;
        showWeekFrom(app.calendar.weekStart(app.calendar.addDays(freeStart, 3)));
        return true;
      },
      panStart() {
        if (!calendar || view !== "week" || app.focus.isOpen()) return false;
        app.interactions.clearSelection();
        return app.week.panBegin(calendar, weekStart(), today);
      },
      panMove(x, y) { app.week.panMove(x, y); },
      openFocus(key) {
        if (!calendar || view !== "week") return;
        app.interactions.clearSelection();
        app.focus.open(calendar, key, today);
      },
      isFocusOpen() { return app.focus.isOpen(); },
      panEnd() {
        const result = app.week.panEnd();
        if (result) showWeekFrom(result.start, result.rest);
      },
      showView(next) {
        if (!calendar || next === view) return;
        view = next;
        freeStart = "";
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
      toggleMany: picks => toggleMany(picks),
      removeMany: picks => removeMany(picks),
      copy: picks => copy(picks),
      cut: picks => cut(picks),
      paste: target => paste(target),
      newBacklogEntry,
      hasClipboard: () => clipboard.length > 0,
      dayPicks(key) {
        if (!calendar || view === "contacts") return [];
        return [
          ...app.recurrence.occurrences(calendar, key).map(({ index }) => ({ series: index, key })),
          ...app.calendar.entries(calendar, key).map((_, index) => ({ ref: { key, index }, key }))
        ];
      },
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
