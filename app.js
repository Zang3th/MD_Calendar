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
import "./domain/sync.js";
import "./domain/sync-plan.js";
import "./io/calendar-format.js";
import "./io/backlog-format.js";
import "./io/holidays-format.js";
import "./io/config-format.js";
import "./io/contacts-format.js";
import "./io/vcard.js";
import "./io/ics.js";
import "./io/folder-state.js";
import "./io/google.js";
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
import "./ui/dialog.js";
import "./ui/menus.js";
import "./ui/search-panel.js";
import "./ui/focus.js";
import "./ui/interactions.js";
import "./ui/sync-dialog.js";

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
    /** The open folder; the synchronization reads its key and MD_Calendar.json through it. @type {MDCStorageAdapter | null} */
    let openFolderAdapter = null;
    /** @type {MDCCalendar | null} */
    let calendar = null;
    /** @type {MDCBacklog | null} */
    let backlog = null;
    /** @type {MDCContacts | null} */
    let contacts = null;
    /** Index of the contact shown in the contacts view, or -1. */
    let selectedContact = 0;
    /** Set once a contact was opened; until then the contacts view shows the contact whose birthday comes next. */
    let contactChosen = false;
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
      if (!contactChosen) selectedContact = Math.max(0, app.contacts.nextBirthdayIndex(contacts, today));
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
      /** @param {MDCFormatWarning[]} found @param {string} title @param {string} hint */
      const report = (found, title, hint) => {
        if (!found.length) return;
        const lines = found.map(warning => warning.lineNumber);
        const shown = lines.slice(0, 8).join(", ") + (lines.length > 8 ? " …" : "");
        app.notifications.show("warning", title, note`${name}, ${found.length === 1 ? "line" : "lines"} ${shown}\n${hint}`);
      };
      // Days off have no time (docs/Domain.md#tags); a sync ID belongs to one item (docs/DataFormat.md#sync-ids).
      const special = ["day-off-time", "duplicate-sync"];
      report(warnings.filter(warning => warning.kind === "day-off-time"), "Day off with a time", "The time is dropped on the next save.");
      report(warnings.filter(warning => warning.kind === "duplicate-sync"), "Sync ID used twice", "Only the first item is synchronized.");
      report(warnings.filter(warning => !special.includes(warning.kind)), "Unreadable lines", "Kept as is.");
    }

    /** Parses one file (`null`: missing) into the model; writable files start a new history. @param {MDCFileName} name @param {string | null} text */
    function useFile(name, text) {
      dataVersion += 1;
      /** @type {MDCFormatWarning[]} */
      let warnings = [];
      if (name === "Calendar.md") {
        const parsed = app.calendarFormat.parse(text ?? "# Calendar\n");
        calendar = parsed.calendar;
        app.tiles.setCalendar(calendar);
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
      openFolderAdapter = opened;
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
        // The sync dialog refers to entries by position as well, and applies changes of its own.
        shouldCheck: () => !app.dialog.isOpen() && !app.syncDialog.isOpen(),
        confirmLeave: true
      });
      started.on("change", updateHeader);
      started.on("conflict", () => {
        clearConflict();
        showConflict();
      });
      started.on("blocked", showConflict);
      started.on("saved", ({ files, texts }) => {
        clearConflict();
        updateHeader();
        if (!files.length) return;
        app.header.flashSaved();
        updateFolderState(opened, async (state, device, now) => app.folderState.saved(state, device, await hashes(texts), now));
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

    // ---------- Synchronization with Google (docs/Architecture.md#synchronization-with-google) ----------

    const keyFile = "MD_Calendar.key.json";
    /** Shortest time a step of the sync dialog shows, so that no state only flashes (docs/ui/Shell.md#sync-dialog). */
    const stepMinimum = 600;
    /**
     * The running synchronization: the client, the calendar's time zone, the comparison under review, a controller that
     * aborts the check and the cancel request of “Apply”.
     */
    const syncRun = {
      /** @type {MDCGoogleClient | null} */ client: null,
      timeZone: "",
      syncToken: "",
      /** @type {MDCSyncComparison | null} */ comparison: null,
      /** @type {Record<string, MDCSyncItem>} */ base: {},
      /** @type {AbortController | null} */ abort: null,
      cancelled: false
    };

    /** Waits for `work` and at least `ms`. @template T @param {Promise<T>} work @param {number} [ms] @returns {Promise<T>} */
    async function atLeast(work, ms = stepMinimum) {
      const [result] = await Promise.all([work, new Promise(resolve => window.setTimeout(resolve, ms))]);
      return result;
    }

    /** The stored MD_Calendar.json, or null. */
    async function readFolderState() {
      if (!openFolderAdapter) return null;
      const stored = await openFolderAdapter.read(app.folderState.fileName);
      return stored ? app.folderState.read(stored.text) : null;
    }

    /** The stored key; null when there is none. Throws MDC-401 for a file that is no key. */
    async function readStoredKey() {
      const stored = openFolderAdapter ? await openFolderAdapter.read(keyFile) : null;
      return stored ? app.google.readKey(stored.text) : null;
    }

    /** @param {boolean} busy */
    function syncBusy(busy) {
      syncShown = { ...syncShown, busy };
      app.header.syncState(syncShown);
    }

    /** @param {MDCGoogleKey} key @param {string} calendarId */
    function syncClient(key, calendarId) {
      return app.google.client({
        key, calendarId,
        onWait: seconds => {
          // A countdown while Google asks to wait (docs/ui/Shell.md#sync-dialog).
          for (let left = seconds; left > 0; left -= 1) window.setTimeout(() => app.syncDialog.notice(`Google asks to wait – retrying in ${left} s`), (seconds - left) * 1000);
          window.setTimeout(() => app.syncDialog.notice(""), seconds * 1000);
        }
      });
    }

    /** @type {MDCSyncDialogHandlers} */
    const syncHandlers = {
      close() {
        syncRun.abort?.abort();
        syncBusy(false);
        app.syncDialog.close();
      },
      overview() { void showSyncOverview(); },
      setup() { void showSyncSetup(true); },
      connect(text, name, calendarId) { void connectSync(text, calendarId); },
      check() { void checkSync(); },
      saveAndCheck() {
        void save().then(() => {
          if (fileSession && !fileSession.unsaved && !hasConflict()) void checkSync();
          else void showSyncOverview();
        });
      },
      complete() { void completeSync(); },
      cancel() { syncRun.cancelled = true; },
      apply(choices) { void applySync(choices); }
    };

    async function openSync() {
      if (!calendar || !openFolderAdapter) return;
      app.syncDialog.open(syncHandlers);
      await showSyncOverview();
    }

    /** @param {boolean} [cancellable] */
    async function showSyncSetup(cancellable = false) {
      const state = await readFolderState();
      app.syncDialog.render({ phase: "setup", status: "Setup", calendarId: state ? app.folderState.sync(state)?.calendarId || "" : "", steps: null, cancellable });
    }

    /** The overview, or the setup while the key or the calendar is missing (docs/ui/Shell.md#sync-dialog). */
    async function showSyncOverview() {
      const state = await readFolderState();
      const section = state ? app.folderState.sync(state) : null;
      /** @type {MDCGoogleKey | null} */
      let key = null;
      try { key = await readStoredKey(); } catch { key = null; }
      if (!state || !section || !key) {
        await showSyncSetup(false);
        return;
      }
      const { changed } = app.folderState.syncStatus(state);
      const last = section.last;
      const device = last ? state.devices[last.by]?.name || "another device" : "";
      const at = last ? new Date(last.at) : null;
      const when = at ? `${app.calendar.formatDay(app.calendar.todayKey(at), "dd DD.MM.YYYY")} ${at.toTimeString().slice(0, 5)}` : "";
      const journal = section.journal;
      app.syncDialog.render({
        phase: "overview",
        status: journal ? "Interrupted" : !last ? "Not synced yet" : changed ? "Local changes since last sync" : "Up to date",
        facts: [
          ["Last sync", last ? `${when} · ${device} · ${last.toGoogle} ↑ · ${last.toCalendar} ↓` : "Never"],
          ["Local changes", changed ? "Yes, saved since the last sync" : "None"],
          ["Calendar", section.calendarId]
        ],
        unsaved: fileSession ? fileSession.unsaved : 0,
        interrupted: journal ? { done: journal.operations.filter(operation => operation.state !== "pending").length, total: journal.operations.length } : null
      });
    }

    /** Shows an error of the synchronization with its way out. @param {unknown} error @param {MDCSyncRetry} retry */
    function showSyncError(error, retry) {
      syncBusy(false);
      const code = /** @type {any} */ (error)?.code || "MDC-406";
      if (/** @type {any} */ (error)?.name === "AbortError") return;
      const ways = /** @type {Record<string, string>} */ ({
        "MDC-401": "Choose the JSON key of the service account again.",
        "MDC-402": "The key was deleted or disabled in Google Cloud. Create a new key and change the setup.",
        "MDC-403": "Share the calendar with the service account, or check the calendar ID.",
        "MDC-404": "Share the calendar with “Make changes to events”.",
        "MDC-405": "Check the connection and try again.",
        "MDC-407": "MD_Calendar.json could not be written. Nothing was lost; try again."
      });
      const title = /** @type {Error} */ (error)?.message || "Sync failed";
      app.syncDialog.render({ phase: "error", status: "", title, message: ways[code] || "Try again.", code, detail: /** @type {any} */ (error)?.detail || "", retry });
    }

    /**
     * Checks the key and the calendar step by step and stores both (docs/ui/Shell.md#sync-dialog).
     * @param {string} text @param {string} calendarId
     */
    async function connectSync(text, calendarId) {
      const labels = ["Reading key", "Getting access", "Reaching calendar", "Checking write access"];
      /** @type {Array<{label: string, state: string, detail?: string}>} */
      const steps = labels.map(label => ({ label, state: "waiting" }));
      const show = () => app.syncDialog.render({ phase: "setup", status: "Connecting", calendarId, steps: steps.map(step => ({ ...step })), cancellable: true });
      /** @param {number} index @param {() => Promise<unknown>} work */
      const run = async (index, work) => {
        steps[index].state = "running";
        show();
        await atLeast(work());
        steps[index].state = "done";
      };
      let at = 0;
      try {
        /** @type {MDCGoogleKey | null} */
        let key = null;
        await run(at, async () => { key = app.google.readKey(text); });
        const client = syncClient(/** @type {MDCGoogleKey} */ (/** @type {unknown} */ (key)), calendarId);
        at = 1;
        await run(at, () => client.authorize());
        at = 2;
        /** @type {{accessRole: string} | null} */
        let probed = null;
        await run(at, async () => {
          try { probed = await client.probe(); } catch (error) {
            // Missing write access shows at its own step.
            if (/** @type {any} */ (error)?.code !== "MDC-404") throw error;
            probed = { accessRole: "" };
          }
        });
        at = 3;
        await run(at, async () => { if (!probed?.accessRole) throw new app.google.GoogleError("MDC-404", "No write access to the calendar"); });
        show();
        const folder = /** @type {MDCStorageAdapter} */ (openFolderAdapter);
        const existing = await folder.read(keyFile);
        await folder.write(keyFile, text, existing ? existing.text : null);
        await folderStateOf(folder).update(document => app.folderState.connected(document, calendarId));
        const written = await readFolderState();
        if (written) showSyncState(written);
        await showSyncOverview();
      } catch (error) {
        steps[at].state = "failed";
        steps[at].detail = `${/** @type {Error} */ (error)?.message || "Failed"}. ${/** @type {any} */ (error)?.code === "MDC-403" ? "Share the calendar with the service account." : ""}`.trim();
        show();
      }
    }

    /** Reads Google, compares and shows the merge view (docs/ui/Shell.md#sync-dialog). */
    async function checkSync() {
      if (!calendar || !backlog || !openFolderAdapter) return;
      const labels = ["Connecting to Google", "Reading changes", "Comparing"];
      /** @type {Array<{label: string, state: string, count?: string}>} */
      const steps = labels.map(label => ({ label, state: "waiting" }));
      let notice = "";
      const show = () => app.syncDialog.render({ phase: "checking", status: "Checking", steps: steps.map(step => ({ ...step })), notice });
      syncRun.abort = new AbortController();
      const signal = syncRun.abort.signal;
      syncBusy(true);
      try {
        const state = await readFolderState();
        const section = state ? app.folderState.sync(state) : null;
        const key = await readStoredKey();
        if (!section || !key) {
          syncBusy(false);
          await showSyncSetup(false);
          return;
        }
        const client = syncClient(key, section.calendarId);
        syncRun.client = client;
        steps[0].state = "running";
        show();
        const { timeZone } = await atLeast(client.probe(signal));
        steps[0].state = "done";
        steps[1].state = "running";
        show();
        /** @param {number} count */
        const counted = count => {
          steps[1].count = `${count} ${count === 1 ? "event" : "events"} read`;
          show();
        };
        let full = !section.syncToken;
        let read = await atLeast(client.changes({ syncToken: section.syncToken, signal, onPage: counted }));
        if (read.expired) {
          notice = "Google asked for a full comparison";
          full = true;
          read = await client.changes({ signal, onPage: counted });
        }
        if (read.expired) throw new app.google.GoogleError("MDC-406", "Google rejected the query");
        const events = [...read.events];
        // Differences left open last time are read again; the sync token no longer returns them.
        for (const id of section.open || []) if (!events.some(event => event.id === id)) events.push(await client.get(id, signal));
        steps[1].state = "done";
        steps[2].state = "running";
        show();
        const comparison = app.sync.compare({ local: app.sync.collect(calendar, backlog), base: section.items, events, full, timeZone, tags: config.tags });
        // Rows that changed only in the calendar show Google's side as it is now.
        for (const difference of comparison.differences) {
          if (difference.google || !difference.id || difference.case === "new-local") continue;
          const event = await client.get(difference.id, signal);
          const mapped = app.sync.fromEvent(event, timeZone, config.tags);
          if ("fields" in mapped) difference.google = mapped.fields;
          if (event?.etag && !difference.etag) difference.etag = String(event.etag);
        }
        app.sync.order(comparison.differences);
        await atLeast(Promise.resolve());
        // Closed meanwhile: nothing more to show.
        if (signal.aborted) return;
        if (comparison.duplicates.length) {
          app.notifications.show("warning", "Sync ID used twice", note`${comparison.duplicates.join(", ")}\nOnly the first item is synchronized.`);
        }
        Object.assign(syncRun, { timeZone, syncToken: read.syncToken, comparison, base: section.items });
        syncBusy(false);
        app.syncDialog.render({ phase: "review", status: comparison.differences.length ? `${comparison.differences.length} differences` : "Up to date", differences: comparison.differences, tags: config.tags });
      } catch (error) {
        if (signal.aborted) return;
        showSyncError(error, "check");
      } finally {
        syncRun.abort = null;
      }
    }

    /** Applies the chosen differences (docs/Architecture.md#journal). @param {Record<string, MDCSyncChoice | null>} choices */
    async function applySync(choices) {
      const { comparison } = syncRun;
      if (!comparison || !openFolderAdapter) return;
      const device = app.storage.device();
      const journal = app.syncPlan.plan(comparison, choices, {
        base: syncRun.base, timeZone: syncRun.timeZone, tags: config.tags, newId: () => app.google.newId(),
        by: device.id, startedAt: app.folderState.stamp(new Date()), syncToken: syncRun.syncToken
      });
      try {
        // The plan is on disk before the first request, so that an interruption can be completed (docs/Architecture.md#journal).
        await folderStateOf(openFolderAdapter).update(document => app.folderState.journal(document, journal));
      } catch (error) {
        showSyncError(new app.google.GoogleError("MDC-407", "Sync state not written", error instanceof Error ? error.message : String(error)), "check");
        return;
      }
      await runSyncJournal(journal, comparison.differences);
    }

    /** Completes an interrupted synchronization from its journal. */
    async function completeSync() {
      const state = await readFolderState();
      const section = state ? app.folderState.sync(state) : null;
      if (!section?.journal || !openFolderAdapter) return;
      try {
        const key = await readStoredKey();
        if (!key) throw new app.google.GoogleError("MDC-401", "The key is missing");
        syncRun.client = syncClient(key, section.calendarId);
      } catch (error) {
        showSyncError(error, "overview");
        return;
      }
      syncRun.base = section.items;
      const rows = section.journal.operations.map(operation => /** @type {MDCSyncDifference} */ ({
        key: operation.key, id: operation.id, kind: operation.kind, case: "changed-local", choices: [operation.choice], preselected: operation.choice,
        calendar: { title: operation.title }, google: null, etag: "", ref: null
      }));
      await runSyncJournal(section.journal, rows);
    }

    /**
     * Runs a journal against Google, applies its local changes as one undo action, saves and records the result.
     * @param {MDCSyncJournal} journal @param {MDCSyncDifference[]} rows
     */
    async function runSyncJournal(journal, rows) {
      const folder = /** @type {MDCStorageAdapter} */ (openFolderAdapter);
      const client = /** @type {MDCGoogleClient} */ (syncRun.client);
      const total = journal.operations.length;
      const finished = () => journal.operations.filter(operation => operation.state !== "pending").length;
      /** @type {Record<string, string>} */
      const states = Object.fromEntries(journal.operations.map(operation => [operation.key, operation.state === "pending" ? "waiting" : operation.state]));
      for (const row of rows) if (!(row.key in states)) states[row.key] = "skipped";
      syncRun.cancelled = false;
      syncBusy(true);
      app.syncDialog.render({ phase: "applying", status: "Applying", differences: rows, tags: config.tags, states, progress: { done: finished(), total, label: "" } });
      try {
        await app.syncPlan.run({
          journal, client,
          cancelled: () => syncRun.cancelled,
          progress: operation => {
            const shown = operation.state === "pending" ? "running" : operation.state;
            app.syncDialog.rowState(operation.key, shown);
            app.syncDialog.progress({ done: finished(), total, label: syncRun.cancelled ? "Cancelling after the current change…" : operation.title });
          },
          persist: async stored => { await folderStateOf(folder).update(document => app.folderState.journal(document, stored)); }
        });
      } catch (error) {
        showSyncState((await readFolderState()) || {});
        showSyncError(error, "overview");
        return;
      }
      app.syncDialog.progress({ done: finished(), total, label: "Saving calendar" });
      const action = calendar && backlog ? app.syncPlan.applyLocal(calendar, backlog, journal) : null;
      if (action) execute(action);
      await atLeast(save());
      if (!fileSession || fileSession.unsaved > 0 || hasConflict()) {
        showSyncState((await readFolderState()) || {});
        showSyncError(new app.google.GoogleError("MDC-407", "Calendar not saved", "The changes stay unsaved; the sync completes after saving."), "overview");
        return;
      }
      const { items, open, counts } = app.syncPlan.record(syncRun.base, journal);
      const calendarHash = await app.storage.fingerprint(serialized("Calendar.md"));
      try {
        await folderStateOf(folder).update(document => app.folderState.synced(document, app.storage.device(), { syncToken: journal.syncToken, items, open, calendarHash, counts }, new Date()));
      } catch (error) {
        showSyncError(new app.google.GoogleError("MDC-407", "Sync state not written", error instanceof Error ? error.message : String(error)), "overview");
        return;
      }
      showSyncState((await readFolderState()) || {});
      syncBusy(false);
      syncRun.comparison = null;
      const failures = journal.operations.filter(operation => operation.state === "failed" || operation.state === "open")
        .map(operation => ({ title: operation.title, reason: operation.error || ({ "changed-meanwhile": "Changed in Google meanwhile", "deleted-meanwhile": "Deleted in Google meanwhile", "missing-locally": "Changed in the calendar meanwhile" })[operation.reason || ""] || "Left open" }));
      app.syncDialog.render({ phase: "done", status: "", counts, cancelled: journal.operations.some(operation => operation.state === "pending"), failures });
    }

    /** The synchronization state the sync control shows; `busy` while the sync dialog checks or applies. */
    let syncShown = { changed: false, interrupted: false, busy: false };

    /** Shows on the sync control what MD_Calendar.json says about the synchronization. @param {Record<string, any>} state */
    function showSyncState(state) {
      const { changed, interrupted } = app.folderState.syncStatus(state);
      syncShown = { ...syncShown, changed, interrupted };
      app.header.syncState(syncShown);
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
        if (written) showSyncState(written);
        // The start card shows this summary without opening the folder again; it is only a cache.
        if (updated && written) return app.storage.rememberInfo(folder, app.folderState.summary(written, device.id)).catch(() => {});
      }).catch(error => {
        app.notifications.show("error", "File not updated", note`${app.folderState.fileName}\nThe calendar is not affected.`, { details: error instanceof Error ? error.message : String(error), code: "MDC-203" });
      });
    }

    /**
     * Fingerprint of each file as the save wrote it; the session hands the texts over, so that the folder, often on a
     * network drive, is not read once more. @param {Record<string, string>} texts
     */
    async function hashes(texts) {
      /** @type {Record<string, string>} */
      const result = {};
      for (const [file, text] of Object.entries(texts)) result[file] = await app.storage.fingerprint(text);
      return result;
    }

    /** @param {MDCStorageAdapter} opened */
    async function openFolder(opened) {
      // The contact opened last belongs to the folder it was opened in.
      contactChosen = false;
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
      app.notifications.show("error", title, "Choose the folder again.", { details, code });
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
        contactChosen = true;
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
      if (target.contact !== undefined && target.contact >= 0) {
        selectedContact = target.contact;
        contactChosen = true;
      }
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
      let failure = "";
      try {
        await Promise.all([fileSession.save(force), shown ? new Promise(resolve => window.setTimeout(resolve, savingMinimum)) : null]);
      } catch (error) {
        failure = (error instanceof Error ? error.message : String(error)) || "Unknown error";
        app.notifications.show("error", "Save failed", "Your changes are kept.", { details: failure, code: "MDC-201" });
      } finally {
        if (shown) app.header.saving(false);
      }
      // After the saving state ends, the control shows the failure until the next save or change.
      if (failure) app.header.failed(failure);
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

    /**
     * Creates the item a dialog result describes. An item converted from another kind keeps its unknown lines and its
     * sync ID (docs/Domain.md#comparison). @param {MDCDialogResult} result @param {{extra: string[], sync?: string} | null} kept
     */
    function createFrom(result, kept) {
      const target = /** @type {MDCCalendar} */ (calendar);
      const extra = kept?.extra || [];
      const base = { title: result.title, location: result.location, note: result.note, tag: result.tag, ...(kept?.sync ? { sync: kept.sync } : {}) };
      if (result.kind === "series") {
        return app.calendar.createSeries(target, {
          ...base, id: "", extra, start: result.date, startTime: result.startTime, endTime: result.endTime,
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
      const { index } = app.calendar.timeSlot(target, result.date, result.startTime);
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
        apply: createAndShow, create: createAndShow,
        remove: noAction, deleteOccurrence: noAction, endSeries: noAction
      });
    }

    /** A new entry for the backlog, with the tag of `group` preset (none for the ungrouped entries). @param {number} group */
    function newBacklogEntry(group) {
      if (!calendar || !backlog) return;
      const tag = backlog.groups[group]?.name || "";
      openDialog({ kind: "entry", isNew: true, inBacklog: true, title: "", location: "", note: [], tag, date: "", end: "", startTime: "", endTime: "", rule: null, occurrence: "" }, {
        apply: createAndShow, create: createAndShow,
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
        create: createAndShow,
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
        create: createAndShow,
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
        create: createAndShow,
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
      contactChosen = true;
      view = "contacts";
      render();
    }

    /** Vacations and days off of a year for the holiday overview, the days off marked. @param {number} year @returns {MDCPeriod[]} */
    function personalPeriods(year) {
      if (!calendar) return [];
      return [
        ...app.calendar.taggedPeriods(calendar, app.calendar.vacationTag, year),
        ...app.calendar.taggedPeriods(calendar, app.calendar.dayOffTag, year).map(period => ({ ...period, dayOff: true }))
      ];
    }

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
      // Backlog entries cannot be done (docs/Domain.md#backlog).
      picks = picks.filter(pick => !pick.ref || !app.backlog.isBacklog(pick.ref));
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
      execute(app.backlog.pasteEntries(calendar, backlog, clipboard, target || { key: visibleDay(), index: Infinity }));
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
        contactChosen = true;
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
        if (calendar) app.holidaysPanel.toggle(holidays, today, personalPeriods);
      },
      showOverview(tab, key) {
        if (calendar) app.holidaysPanel.show(holidays, today, personalPeriods, tab, key);
      },
      toggleSearch() {
        if (calendar) app.searchPanel.toggle();
      },
      showHelp() { app.menus.showHelp(); },
      showContacts(key, kind) {
        // A birthday or anniversary badge opens the contact view on the first of its people and lights up what was
        // asked for: the rows of all its people and the date in the opened contact (docs/ui/Views.md#day-header).
        const items = app.tiles.dayOccasions(key)[kind];
        if (!contacts || !items.length || kind === "holiday") return;
        const first = items[0];
        openContact(first.index);
        const contact = contacts.contacts[first.index];
        const anniversary = contact.anniversaries.findIndex(item => item.label === first.label &&
          (item.date.slice(5) === key.slice(5) || (item.date.slice(5) === "02-29" && key.slice(5) === "02-28")));
        const field = document.querySelector(`#contacts [data-key="${kind === "birthday" ? "birthday" : `anniversaryDate:${anniversary}`}"]`)?.closest(".cx-field");
        const targets = [...new Set(items.map(item => item.index))].map(index => document.querySelector(`#contacts .cx-row[data-contact="${index}"]`));
        // The list scrolls at once, so that its smooth scroll does not compete with the one of the contact.
        if (targets[0] instanceof HTMLElement) targets[0].scrollIntoView({ block: "center" });
        for (const target of [...targets, field]) if (target instanceof HTMLElement) app.tiles.highlight(target);
      },
      showOptions() { app.menus.showOptions(); },
      showSync() { void openSync(); },
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
          // Days off show no tile and are never selected (docs/ui/Views.md#day-header).
          ...app.calendar.entries(calendar, key).flatMap((entry, index) => entry.tag === app.calendar.dayOffTag ? [] : [{ ref: { key, index }, key }])
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
      move(from, to, placed) {
        if (!calendar || !backlog) return;
        if (!execute(app.backlog.move(calendar, backlog, from, to, placed))) {
          renderer().renderDays(calendar, [from.key, to.key], today);
          app.backlogPanel.render(backlog, backlogOpen);
        }
      },
      placeOccurrences(key, placed, dragged) {
        if (!calendar) return;
        const series = calendar.series[dragged];
        const label = series && !("raw" in series) ? series.title : "Occurrence";
        if (!execute(app.calendar.placeOccurrences(calendar, key, placed, label))) renderer().renderDays(calendar, [key], today);
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
