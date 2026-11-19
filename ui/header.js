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
  const saveText = /** @type {HTMLElement} */ (save.querySelector(".save__text"));
  const saveCount = /** @type {HTMLElement} */ (save.querySelector(".save__count"));
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
  /** Saves in flight; while above 0 the control shows “Saving”. A “Saved” that arrives meanwhile waits for the end. */
  let savingCount = 0;
  let flashPending = false;
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
    save.classList.toggle("is-saving", busy);
    // “Unsaved” stays until the files are written; while saving, the saving look lies over it.
    save.classList.toggle("is-dirty", dirty);
    // “Saved” is the resting state and always shows (docs/ui/Shell.md#save-control).
    saveText.textContent = busy ? "Saving" : dirty ? "Save" : "Saved";
    saveCount.textContent = dirty && !busy ? String(shown.save.count) : "";
    label(save, busy ? "Saving…" : shown.save.label);

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
   * Starts or ends the saving state (docs/ui/Shell.md#save-control): an accent pill “Saving” with a spinner. Calls nest;
   * the state ends with the last one and then shows a “Saved” that arrived meanwhile.
   * @param {boolean} active
   */
  function saving(active) {
    savingCount = Math.max(0, savingCount + (active ? 1 : -1));
    if (lastState) update(lastState);
    if (savingCount === 0 && flashPending) {
      flashPending = false;
      flashSaved();
    }
  }

  app.header = { update, flashSaved, saving, setVersion };
})(window.MDCalendar);
