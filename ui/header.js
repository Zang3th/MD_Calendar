import { history as undoHistory } from "@zang3th/md-libs/core";
import { segmented } from "@zang3th/md-libs/ui";

window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Header pill: logo, title, version, “+”, undo, redo, save control, view switcher, import, help, sound, holidays, backlog (docs/ui/Shell.md#header).
(function (app) {
  /** Length of the check mark's pop after a save, in milliseconds. */
  const flashDuration = 400;
  const element = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));
  const title = /** @type {HTMLButtonElement} */ (element("title"));
  const titleText = element("titleText");
  const titleSizer = element("titleSizer");
  const save = element("save");
  const syncButton = element("syncButton");
  const sound = element("sound");
  const undo = /** @type {HTMLButtonElement} */ (element("undo"));
  const redo = /** @type {HTMLButtonElement} */ (element("redo"));
  const newButton = element("new");
  const views = /** @type {Array<[HTMLButtonElement, MDCView]>} */ ([[element("viewWeek"), "week"], [element("viewMonth"), "month"], [element("viewContacts"), "contacts"]]);
  const thumb = /** @type {HTMLElement} */ (document.querySelector(".seg__thumb"));
  const backlogToggle = element("backlogToggle");
  const openOnly = /** @type {HTMLElement[]} */ (Array.from(document.querySelectorAll("[data-open-only]")));
  // Version label and watermark belong to the start page, as in MD_Manager.
  const startOnly = [element("appVersion"), element("watermark")];
  let flashTimer = 0;
  let sized = false;
  /** Saves in flight; while above 0 the control shows the spinner. A “Saved” that arrives meanwhile waits for the end. */
  let savingCount = 0;
  let flashPending = false;
  /**
   * A failed save (docs/ui/Shell.md#save-control): its error message and the save state it failed in. It shows until the
   * next save starts or the unsaved changes change.
   * @type {{ message: string, status: string, count: number } | null}
   */
  let failure = null;
  /** @type {{ status: string, count: number }} */
  let lastSave = { status: "saved", count: 0 };
  /** @type {MDCHeaderState | null} */
  let lastState = null;

  /** The title keeps the width of its longest text so that the arrows next to it never move. */
  function sizeTitle() {
    const names = Array.from({ length: 12 }, (_, month) => app.calendar.formatDay(`2026-${String(month + 1).padStart(2, "0")}-01`, "MMMM 0000"));
    titleSizer.innerHTML = [...names, "Contacts"].map(name => `<span>${name}</span>`).join("");
    sized = true;
  }

  /** @type {import("@zang3th/md-libs/core").history.MDLControlStrings} */
  const strings = {
    undo: name => name ? `Undo “${name}” (Ctrl+Z)` : "Undo",
    redo: name => name ? `Redo “${name}” (Ctrl+Y)` : "Redo",
    save: (status, count) => status === "conflict" ? "File changed outside: reload or overwrite"
      : status === "unsaved" ? `Save ${count} unsaved change${count === 1 ? "" : "s"} (Ctrl+S)` : "All saved"
  };

  /** @param {HTMLElement} button @param {string} text */
  function label(button, text) {
    button.setAttribute("aria-label", text);
  }

  /** @param {MDCHeaderState} state */
  function update(state) {
    lastState = state;
    if (!sized && state.open) sizeTitle();
    for (const part of openOnly) part.hidden = !state.open;
    for (const part of startOnly) part.hidden = state.open;
    title.disabled = !state.open;
    const week = state.view === "week";
    const contacts = state.view === "contacts";
    if (state.open) titleText.textContent = contacts ? "Contacts" : app.calendar.formatDay(week ? state.start : state.anchor, "MMMM YYYY");
    else titleText.textContent = "MD_Calendar";
    label(newButton, contacts ? "Add contact or import" : "Add entry or import");
    segmented.select({ buttons: views.map(([button]) => button), selected: views.findIndex(([, view]) => view === state.view), thumb });
    backlogToggle.setAttribute("aria-pressed", String(state.backlogOpen));

    const shown = undoHistory.controls({ history: state.history, unsaved: state.unsaved, conflict: state.conflict, strings });
    undo.disabled = shown.undo.disabled;
    redo.disabled = shown.redo.disabled;
    label(undo, shown.undo.label);
    label(redo, shown.redo.label);

    const dirty = shown.save.status !== "saved";
    const busy = savingCount > 0;
    lastSave = { status: shown.save.status, count: shown.save.count };
    if (failure && (failure.status !== lastSave.status || failure.count !== lastSave.count)) failure = null;
    const failed = Boolean(failure) && !busy;
    save.classList.toggle("is-saving", busy);
    // “Unsaved” stays until the files are written; while saving, the saving look lies over it, after a failed save the
    // error look.
    save.classList.toggle("is-dirty", dirty);
    save.classList.toggle("is-failed", failed);
    // An icon button: the state shows in the icon, the label and the number of changes in the accessible name; a failed
    // save names its error in the tooltip (docs/ui/Shell.md#save-control).
    label(save, busy ? "Saving…" : failed ? "Save failed" : shown.save.label);
    if (failed) save.dataset.tooltip = /** @type {{ message: string }} */ (failure).message;
    else delete save.dataset.tooltip;

    sound.setAttribute("aria-pressed", String(state.muted));
    label(sound, state.muted ? "Unmute" : "Mute");
  }

  /** Lets the check mark pop once after a successful save; during the saving state it waits for its end. */
  function flashSaved() {
    if (savingCount > 0) {
      flashPending = true;
      return;
    }
    window.clearTimeout(flashTimer);
    save.classList.add("is-flash");
    flashTimer = window.setTimeout(() => save.classList.remove("is-flash"), flashDuration);
  }

  /** Writes the version into the label and the watermark. @param {string} version */
  function setVersion(version) {
    element("appVersion").textContent = `v${version}`;
    element("watermarkVersion").textContent = `v${version}`;
  }

  /**
   * Starts or ends the saving state (docs/ui/Shell.md#save-control): an accent button with a spinner. Calls nest;
   * the state ends with the last one and then shows a “Saved” that arrived meanwhile.
   * @param {boolean} active
   */
  function saving(active) {
    if (active) failure = null;
    savingCount = Math.max(0, savingCount + (active ? 1 : -1));
    if (lastState) update(lastState);
    if (savingCount === 0 && flashPending) {
      flashPending = false;
      flashSaved();
    }
  }

  /**
   * Shows a failed save (docs/ui/Shell.md#save-control): a red cross whose tooltip names the error, until the next save
   * starts or the unsaved changes change.
   * @param {string} message
   */
  function failed(message) {
    failure = { message, ...lastSave };
    if (lastState) update(lastState);
  }

  /**
   * Shows the state of the synchronization on the sync control (docs/ui/Shell.md#sync-control): a dot for local changes
   * since the last synchronization, a warning for an interrupted one, turning arrows while the dialog checks or applies.
   * @param {{changed: boolean, interrupted: boolean, busy: boolean}} state
   */
  function syncState({ changed, interrupted, busy }) {
    syncButton.classList.toggle("is-changed", changed && !interrupted);
    syncButton.classList.toggle("is-interrupted", interrupted);
    syncButton.classList.toggle("is-busy", busy);
    label(syncButton, interrupted ? "Sync with Google (interrupted, needs completing)"
      : changed ? "Sync with Google (local changes since last sync)" : "Sync with Google");
  }

  app.header = { update, flashSaved, saving, failed, setVersion, syncState };
})(window.MDCalendar);
