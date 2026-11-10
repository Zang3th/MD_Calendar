window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Header pill: title, KW badge, navigation, view switcher, tools, undo, redo, save control, „+“ and options (docs/ui/Shell.md#header).
(function (app) {
  const flashDuration = 1500;
  const element = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));
  const title = /** @type {HTMLButtonElement} */ (element("title"));
  const titleText = element("titleText");
  const titleSizer = element("titleSizer");
  const kw = element("kw");
  const save = element("save");
  const saveText = /** @type {HTMLElement} */ (save.querySelector(".save__text"));
  const saveCount = /** @type {HTMLElement} */ (save.querySelector(".save__count"));
  const sound = element("sound");
  const soundLabel = element("soundLabel");
  const undo = /** @type {HTMLButtonElement} */ (element("undo"));
  const redo = /** @type {HTMLButtonElement} */ (element("redo"));
  const prev = element("prev");
  const next = element("next");
  const newButton = element("new");
  const datenav = /** @type {HTMLElement} */ (document.querySelector(".datenav"));
  const views = /** @type {Array<[HTMLButtonElement, MDCView]>} */ ([[element("viewWeek"), "week"], [element("viewMonth"), "month"], [element("viewContacts"), "contacts"]]);
  const thumb = /** @type {HTMLElement} */ (document.querySelector(".seg__thumb"));
  const backlogToggle = element("backlogToggle");
  const openOnly = /** @type {HTMLElement[]} */ (Array.from(document.querySelectorAll("[data-open-only]")));
  let flashTimer = 0;
  let sized = false;

  /** The title keeps the width of its longest text so that the arrows next to it never move. */
  function sizeTitle() {
    const names = Array.from({ length: 12 }, (_, month) => dayjs(`2026-${String(month + 1).padStart(2, "0")}-01`).format("MMMM 0000"));
    titleSizer.innerHTML = [...names, "Kontakte"].map(name => `<span>${name}</span>`).join("");
    sized = true;
  }

  /** @param {HTMLElement} button @param {string} text */
  function label(button, text) {
    button.setAttribute("aria-label", text);
  }

  /** @param {MDCHeaderState} state */
  function update(state) {
    if (!sized && state.open) sizeTitle();
    for (const part of openOnly) part.hidden = !state.open;
    title.disabled = !state.open;
    const week = state.view === "week";
    const contacts = state.view === "contacts";
    kw.hidden = !state.open || !week;
    datenav.hidden = !state.open || contacts;
    if (state.open) {
      const days = app.calendar.weekDays(state.anchor);
      titleText.textContent = contacts ? "Kontakte" : dayjs(week ? days[0] : state.anchor).format("MMMM YYYY");
      kw.textContent = `KW ${app.calendar.isoWeek(days[0])}`;
      kw.setAttribute("aria-label", `Kalenderwoche ${app.calendar.isoWeek(days[0])}`);
    } else titleText.textContent = "MD_Calendar";
    label(prev, week ? "Vorherige Woche (←)" : "Vorheriger Monat (←)");
    label(next, week ? "Nächste Woche (→)" : "Nächster Monat (→)");
    label(newButton, contacts ? "Neuer Kontakt (N)" : "Neuer Eintrag (N)");
    views.forEach(([button, view], index) => {
      button.setAttribute("aria-pressed", String(state.view === view));
      if (state.view === view) thumb.style.transform = `translateX(${index * 100}%)`;
    });
    backlogToggle.setAttribute("aria-pressed", String(state.backlogOpen));

    undo.disabled = !state.canUndo;
    redo.disabled = !state.canRedo;
    label(undo, state.canUndo ? `Rückgängig: „${state.undoLabel}“ (Strg Z)` : "Rückgängig");
    label(redo, state.canRedo ? `Wiederholen: „${state.redoLabel}“ (Strg Y)` : "Wiederholen");

    const dirty = state.unsaved > 0 || state.conflict;
    save.classList.toggle("is-dirty", dirty);
    if (dirty) window.clearTimeout(flashTimer);
    save.classList.toggle("is-flash", !dirty && save.classList.contains("is-flash"));
    saveText.textContent = dirty ? "Speichern" : save.classList.contains("is-flash") ? "Gespeichert" : "";
    saveCount.textContent = dirty ? String(state.unsaved) : "";
    if (state.conflict) label(save, "Die Datei wurde außerhalb geändert: neu laden oder überschreiben");
    else label(save, dirty ? `${state.unsaved} ungespeicherte Änderung${state.unsaved === 1 ? "" : "en"} speichern (Strg S)` : "Alles gespeichert");

    sound.dataset.muted = String(state.muted);
    soundLabel.textContent = state.muted ? "Ton an" : "Ton aus";
  }

  /** Shows „Gespeichert“ for a moment after a successful save. */
  function flashSaved() {
    window.clearTimeout(flashTimer);
    save.classList.add("is-flash");
    saveText.textContent = "Gespeichert";
    flashTimer = window.setTimeout(() => {
      save.classList.remove("is-flash");
      if (!save.classList.contains("is-dirty")) saveText.textContent = "";
    }, flashDuration);
  }

  app.header = { update, flashSaved };
})(window.MDCalendar);
