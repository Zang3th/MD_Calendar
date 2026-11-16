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

  const calendarFile = "Calendar.md";
  const backlogFile = "Backlog.md";
  const contactsFile = "Contacts.md";

  /** @returns {MDCHistory} */
  function createHistory() {
    return undoHistory.create();
  }

  /** @param {string} title @param {string} body @param {string} details @param {string} code */
  function blockStartup(title, body, details, code) {
    app.notifications.fatal(title, body, details, code);
  }

  async function initialize() {
    const missingApis = app.storage.missingApis();
    if (missingApis.length) {
      blockStartup("Browser nicht unterstützt", "Chrome oder Edge nötig.", `Der Browser bietet die benötigten Funktionen nicht: ${missingApis.join(", ")}.`, "MDC-002");
      return;
    }

    const missingResources = await startup.missingResources({
      document,
      styles: { token: "--base", file: "styles.css" },
      fonts: [{ font: '600 16px "Plus Jakarta Sans"', text: "Äb", file: "vendor/fonts/PlusJakartaSans-latin.woff2" }],
      images: [{ image: document.querySelector(".logo"), file: "res/logo/mark.svg" }]
    });
    if (missingResources.length) {
      blockStartup("Anwendungsressourcen fehlen", "Anwendungsordner wiederherstellen, dann neu laden.", `Nicht geladen: ${missingResources.join(", ")}.`, "MDC-003");
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
      app.notifications.show("warning", `${name}: ${warnings.length === 1 ? "Zeile" : "Zeilen"} ${shown} unverständlich`, "");
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
          app.notifications.show("error", "Unbekannte Tag-Icons", unknown.map(tag => `${tag.name}: ${tag.icon || "kein Icon"}`).join(", "), {
            code: "MDC-301",
            details: `Bekannte Icon-IDs: ${app.tiles.tagIconIds().join(", ")}.`
          });
        }
      }
      if (writableFiles.includes(name)) history = createHistory();
      if (text === null) return;
      reportWarnings(name, warnings);
      const invalid = markdown.invalidCharacter(text);
      if (invalid) app.notifications.show("warning", `${name}: Zeile ${invalid.line} enthält ein unlesbares Zeichen`, "");
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
        if (files.length) app.header.flashSaved();
      });
      started.on("reloaded", ({ file }) => {
        render();
        app.notifications.show("info", `${file} neu geladen`, "");
      });
      started.on("checkError", ({ error }) => {
        app.notifications.show("error", "Dateiprüfung fehlgeschlagen", "", {
          details: error instanceof Error ? error.message : String(error),
          code: "MDC-202"
        });
      });
      fileSession = started;
    }

    /** @param {MDCStorageAdapter} opened */
    async function openFolder(opened) {
      await startSession(opened);
      app.start.hide();
      clearConflict();
      render();
      if (pendingImport) {
        const { text, name } = pendingImport;
        pendingImport = null;
        importCalendar(text, name);
      }
      app.notifications.show("info", `Ordner „${opened.name}“ geöffnet`, "");
    }

    /** @param {unknown} error @param {string} code */
    function reportOpenError(error, code) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const details = error instanceof Error ? error.message : String(error);
      app.notifications.show("error", "Ordner nicht geöffnet", "", { details, code });
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
      conflictNotice = app.notifications.show("warning", `${changed.map(conflict => conflict.file).join(", ")} ${deleted.length === changed.length ? "gelöscht" : deleted.length ? "geändert oder gelöscht" : "außerhalb geändert"}`, "", {
        persistent: true,
        actions: [
          { label: "Neu laden", run: reloadWritable, primary: false },
          { label: "Überschreiben", run: () => { void save(true); }, primary: true }
        ]
      });
      updateHeader();
    }

    /** Discards local changes in Calendar.md, Backlog.md and Contacts.md and applies the versions on disk. */
    function reloadWritable() {
      if (!fileSession?.reload()) return;
      clearConflict();
      render();
      app.notifications.show("info", "Neu geladen", "");
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
        app.notifications.show("error", "Speichern fehlgeschlagen", "", {
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

    /** @param {string} title */
    function confirmDeleted(title) {
      app.notifications.show("info", `„${title}“ gelöscht`, "");
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
          app.notifications.show("info", `„${series.title}“ endet am ${app.calendar.formatDate(key)}`, "");
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
      app.notifications.show("info", clipboard.length === 1 ? `„${clipboard[0].title}“ kopiert` : `${clipboard.length} Einträge kopiert`, "");
    }

    /** Inserts open copies of the clipboard at the end of a day. @param {string} key */
    function paste(key) {
      if (!calendar || !backlog || view === "contacts") return;
      if (!clipboard.length) {
        app.notifications.show("info", "Nichts zum Einfügen", "");
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

    /** An ICS file chosen on the start card; it is imported once the folder is open. @type {{text: string, name: string} | null} */
    let pendingImport = null;

    app.start.onImport((text, name) => { pendingImport = { text, name }; });

    /** @param {string} text @param {string} name */
    function importCalendar(text, name) {
      if (!calendar) return;
      const { events, skipped } = app.ics.parse(text);
      if (!events.length) {
        app.notifications.show("warning", `Keine Termine in „${name}“`, "");
        return;
      }
      const result = app.calendar.importEvents(calendar, events, today);
      if (!result.action) {
        app.notifications.show("info", "Alle Termine schon vorhanden", "");
        return;
      }
      if (view === "contacts") view = portrait.matches ? "month" : "week";
      execute(result.action);
      if (events.length === 1) showDay(events[0].start);
      const imported = result.entries + result.series + result.multiDay;
      const notes = [result.duplicates + skipped ? `${result.duplicates + skipped} übersprungen` : "",
        result.simplified ? `${result.simplified} Serien als Einzeltermin` : ""].filter(Boolean);
      app.notifications.show("info", `${imported} ${imported === 1 ? "Termin" : "Termine"} importiert`, notes.join(", "));
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
        const name = app.contacts.name(contacts.contacts[index]) || "Kontakt";
        execute(app.contacts.remove(contacts, index));
        confirmDeleted(name);
      },
      importText(text, name) {
        if (!contacts) return;
        const found = app.vcard.parse(text);
        const result = app.contacts.importContacts(contacts, found);
        if (!found.length) {
          app.notifications.show("warning", `Keine Kontakte in „${name}“`, "");
          return;
        }
        execute(result.action);
        app.notifications.show("info", `${result.added} neu, ${result.merged} zusammengeführt`, "");
      },
      exportOne(index) {
        const contact = contacts?.contacts[index];
        if (contact) download(`${app.contacts.name(contact) || "Kontakt"}.vcf`, app.vcard.serialize([contact]));
      },
      exportAll() {
        if (contacts?.contacts.length) download("Contacts.vcf", app.vcard.serialize(contacts.contacts));
        else app.notifications.show("info", "Keine Kontakte", "");
      },
      copy(text) {
        void navigator.clipboard.writeText(text).then(
          () => app.notifications.show("info", "Adresse kopiert", ""),
          () => app.notifications.show("warning", "Kopieren nicht möglich", ""));
      },
      reject(message) {
        app.notifications.show("warning", message, "");
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
          else app.notifications.show("warning", "Kein Zugriff auf den Ordner", "");
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
      notice(title) { app.notifications.show("info", title, ""); },
      contextMenu(picks, x, y, key) {
        if (!calendar || !backlog) return;
        /** @type {MDCMenuItem[]} */
        const items = [];
        if (picks.length) {
          const open = picks.some(pick => !pickDone(pick));
          items.push({ label: open ? "Erledigt" : "Nicht erledigt", icon: "check", run: () => toggleMany(picks) });
          items.push({ label: picks.length > 1 ? `${picks.length} Einträge kopieren` : "Kopieren", icon: "copy", run: () => copy(picks) });
          items.push({ label: picks.length > 1 ? `${picks.length} Einträge löschen` : "Löschen", icon: "trash", danger: true, run: () => removeMany(picks) });
        } else {
          items.push({ label: "Neuer Eintrag", icon: "plus", run: () => newEntry(key) });
          if (clipboard.length) items.push({ label: clipboard.length > 1 ? `${clipboard.length} Einträge einfügen` : "Einfügen", icon: "clipboard", run: () => paste(key) });
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

    let remembered = null;
    try {
      remembered = await app.storage.rememberedFolder();
    } catch (error) {
      blockStartup("Browserspeicher gesperrt", "Browserspeicher erlauben, dann neu laden.", error instanceof Error ? error.message : String(error), "MDC-004");
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
    blockStartup("Start fehlgeschlagen", "Seite neu laden.", error instanceof Error ? error.stack || error.message : String(error), "MDC-005");
  });
})(window.MDCalendar);
