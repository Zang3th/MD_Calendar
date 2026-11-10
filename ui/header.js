window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Header pill: title, KW badge, navigation, sound toggle, undo, redo, save control, „+ Neu“ (docs/ui/Shell.md#header).
(function (app) {
  const flashDuration = 1500;
  const element = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));
  const title = element("title");
  const kw = element("kw");
  const save = element("save");
  const saveText = /** @type {HTMLElement} */ (save.querySelector(".save__text"));
  const saveCount = /** @type {HTMLElement} */ (save.querySelector(".save__count"));
  const sound = element("sound");
  const undo = /** @type {HTMLButtonElement} */ (element("undo"));
  const redo = /** @type {HTMLButtonElement} */ (element("redo"));
  const prev = element("prev");
  const next = element("next");
  const viewWeek = /** @type {HTMLButtonElement} */ (element("viewWeek"));
  const viewMonth = /** @type {HTMLButtonElement} */ (element("viewMonth"));
  const thumb = /** @type {HTMLElement} */ (document.querySelector(".seg__thumb"));
  const backlogToggle = /** @type {HTMLButtonElement} */ (element("backlogToggle"));
  const holidaysButton = /** @type {HTMLButtonElement} */ (element("holidaysButton"));
  const navigation =/** @type {HTMLButtonElement[]} */ ([element("title"), element("prev"), element("next"), element("new"), element("save")]);
  let flashTimer = 0;

  /** @param {string} start @param {string} end */
  function weekRange(start, end) {
    const from = dayjs(start);
    const to = dayjs(end);
    if (from.format("MM") === to.format("MM")) return `${from.format("D.")}–${to.format("D. MMMM YYYY")}`;
    if (from.format("YYYY") === to.format("YYYY")) return `${from.format("D. MMMM")} – ${to.format("D. MMMM YYYY")}`;
    return `${from.format("D. MMMM YYYY")} – ${to.format("D. MMMM YYYY")}`;
  }

  /** @param {HTMLElement} button @param {string} text */
  function label(button, text) {
    button.setAttribute("aria-label", text);
    button.dataset.tooltip = text;
  }

  /** @param {MDCHeaderState} state */
  function update(state) {
    for (const button of navigation) /** @type {HTMLButtonElement} */ (button).disabled = !state.open;
    const week = state.view === "week";
    kw.hidden = !state.open || !week;
    if (state.open) {
      const days = app.calendar.weekDays(state.anchor);
      title.textContent = dayjs(week ? days[0] : state.anchor).format("MMMM YYYY");
      kw.textContent = `KW ${app.calendar.isoWeek(days[0])}`;
      kw.dataset.tooltip = weekRange(days[0], days[6]);
    } else {
      title.textContent = "MD_Calendar";
    }
    label(prev, week ? "Vorherige Woche (←)" : "Vorheriger Monat (←)");
    label(next, week ? "Nächste Woche (→)" : "Nächster Monat (→)");
    for (const [button, view] of /** @type {Array<[HTMLButtonElement, MDCView]>} */ ([[viewWeek, "week"], [viewMonth, "month"]])) {
      button.disabled = !state.open;
      button.setAttribute("aria-pressed", String(state.view === view));
    }
    thumb.style.transform = `translateX(${week ? 0 : 100}%)`;
    backlogToggle.disabled = holidaysButton.disabled = !state.open;
    backlogToggle.setAttribute("aria-pressed", String(state.backlogOpen));

    undo.disabled = !state.canUndo;
    redo.disabled = !state.canRedo;
    if (state.canUndo) label(undo, `Rückgängig: „${state.undoLabel}“ (Strg Z)`);
    else { undo.setAttribute("aria-label", "Rückgängig"); delete undo.dataset.tooltip; }
    if (state.canRedo) label(redo, `Wiederholen: „${state.redoLabel}“ (Strg Y)`);
    else { redo.setAttribute("aria-label", "Wiederholen"); delete redo.dataset.tooltip; }

    const dirty = state.unsaved > 0 || state.conflict;
    save.classList.toggle("is-dirty", dirty);
    if (dirty) window.clearTimeout(flashTimer);
    save.classList.toggle("is-flash", !dirty && save.classList.contains("is-flash"));
    saveText.textContent = dirty ? "Speichern" : save.classList.contains("is-flash") ? "Gespeichert" : "";
    saveCount.textContent = dirty ? String(state.unsaved) : "";
    if (state.conflict) label(save, "Die Datei wurde außerhalb geändert: neu laden oder überschreiben");
    else label(save, dirty ? `${state.unsaved} ungespeicherte Änderung${state.unsaved === 1 ? "" : "en"} speichern (Strg S)` : "Alles gespeichert");

    sound.setAttribute("aria-pressed", String(state.muted));
    label(sound, state.muted ? "Ton an" : "Ton aus");
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
