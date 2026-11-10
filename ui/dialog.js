window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Entry dialog (docs/ui/Shell.md#entry-dialog): title, date or range, time, recurrence, location, note.
(function (app) {
  const element = (/** @type {string} */ id) => /** @type {HTMLInputElement} */ (document.getElementById(id));
  const dialog = /** @type {HTMLDialogElement} */ (document.getElementById("dialog"));
  const form = /** @type {HTMLFormElement} */ (dialog.querySelector("form"));
  const kind = element("dialogKind");
  const title = element("dialogTitle");
  const multi = element("dialogMulti");
  const dateLabel = element("dialogDateLabel");
  const date = element("dialogDate");
  const endDate = element("dialogEndDate");
  const start = element("dialogStart");
  const end = element("dialogEnd");
  const repeat = /** @type {HTMLSelectElement} */ (/** @type {unknown} */ (element("dialogRepeat")));
  const intervalField = element("dialogIntervalField");
  const interval = element("dialogInterval");
  const intervalUnit = element("dialogIntervalUnit");
  const weekdays = element("dialogWeekdays");
  const until = element("dialogUntil");
  const place = element("dialogLocation");
  const note = /** @type {HTMLTextAreaElement} */ (document.getElementById("dialogNote"));
  const remove = element("dialogDelete");
  const removeOccurrence = element("dialogDeleteOccurrence");
  const endSeries = element("dialogEndSeries");
  const apply = element("dialogApply");
  const toBacklog = element("dialogBacklog");
  const tagSelect = /** @type {HTMLSelectElement} */ (/** @type {unknown} */ (element("dialogTag")));
  const dateHint = element("dialogDateHint");
  const weekdayNames = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const longNames = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
  const units = { DAILY: ["Tag", "Tage"], WEEKLY: ["Woche", "Wochen"], MONTHLY: ["Monat", "Monate"], YEARLY: ["Jahr", "Jahre"] };

  /** @type {MDCDialogHandlers | null} */
  let handlers = null;
  /** @type {MDCDialogRequest | null} */
  let request = null;
  /** Whether the recurrence was changed in the dialog; otherwise the stored rule is kept as it is. */
  let repeatTouched = false;
  /** Last accepted value per validated field, restored when an input is rejected. */
  const accepted = new Map();

  weekdays.innerHTML = weekdayNames.map((name, index) =>
    `<button class="dlg__day" type="button" aria-pressed="false" data-weekday="${index}" aria-label="${longNames[index]}">${name}</button>`).join("");
  const dayButtons = /** @type {HTMLButtonElement[]} */ (Array.from(weekdays.querySelectorAll("button")));

  /** @param {string} message */
  function reject(message) {
    app.notifications.show("warning", "Ungültige Eingabe", message);
  }

  /** The start date as a day key, the last accepted one, or "" without a date (backlog). */
  function dateKey() {
    return app.calendar.parseDate(date.value) || app.calendar.parseDate(accepted.get(date) || "") || "";
  }

  /** Date the recurrence options are derived from. */
  function referenceDay() {
    return dateKey() || app.calendar.todayKey(new Date());
  }

  /**
   * Tag dropdown: „Kein Tag“, the configured tags in alphabetical order with color and icon,
   * and an unconfigured tag the item already has, so that it is not lost.
   * @param {string} selected
   */
  function renderTags(selected) {
    const options = [...(request?.tags || [])].sort((left, right) => left.name.localeCompare(right.name, "de"));
    const names = options.map(tag => tag.name);
    /** @param {string} value @param {string} text @param {MDCTag | null} tag */
    const option = (value, text, tag) => {
      const item = document.createElement("option");
      item.value = value;
      if (tag) {
        item.style.setProperty("--h", String(app.configFormat.hue(tag.color)));
        item.className = "has-tag";
        const swatch = document.createElement("span");
        swatch.className = "opt__swatch";
        swatch.setAttribute("aria-hidden", "true");
        swatch.innerHTML = app.tiles.tagIcon(tag.name, "opt__icon");
        item.append(swatch);
      }
      const label = document.createElement("span");
      label.textContent = text;
      item.append(label);
      return item;
    };
    // The options are replaced; the button that shows the chosen option (customizable select) stays.
    for (const old of Array.from(tagSelect.options)) old.remove();
    tagSelect.append(option("", "Kein Tag", null), ...options.map(tag => option(tag.name, tag.name, tag)),
      ...(selected && !names.includes(selected) ? [option(selected, selected, null)] : []));
    tagSelect.value = selected;
  }

  /** Spells out the chosen date, so that the preselected day is unmistakable. */
  function updateDateHint() {
    const startKey = dateKey();
    const endKey = multi.getAttribute("aria-pressed") === "true" ? app.calendar.parseDate(endDate.value) : "";
    const spelled = (/** @type {string} */ key) => dayjs(key).format("dddd, D. MMMM YYYY");
    dateHint.textContent = !startKey ? "" : endKey && endKey !== startKey ? `${spelled(startKey)} bis ${spelled(endKey)}` : spelled(startKey);
  }

  /** Rebuilds the recurrence options for the current date, keeping the selection where possible. */
  function updateRepeatOptions() {
    const key = referenceDay();
    const day = Number(key.slice(8, 10));
    const weekday = app.recurrence.weekday(key);
    const daysInMonth = new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0)).getUTCDate();
    const position = Math.ceil(day / 7);
    const selected = repeat.value;
    /** @type {Array<[string, string]>} */
    const options = [["", "Keine"], ["DAILY", "Täglich"], ["WEEKLY", "Wöchentlich"], ["MONTHLY_DAY", `Monatlich am ${day}.`]];
    if (position <= 4) options.push(["MONTHLY_POS", `Monatlich am ${position}. ${longNames[weekday]}`]);
    if (day + 7 > daysInMonth) options.push(["MONTHLY_LAST", `Monatlich am letzten ${longNames[weekday]}`]);
    options.push(["YEARLY", `Jährlich am ${dayjs(key).format("D. MMMM")}`]);
    repeat.innerHTML = options.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
    repeat.value = options.some(([value]) => value === selected) ? selected : "";
  }

  function updateRepeatControls() {
    const value = repeat.value;
    const frequency = /** @type {keyof typeof units | ""} */ (value.startsWith("MONTHLY") ? "MONTHLY" : value);
    intervalField.hidden = !frequency;
    weekdays.hidden = frequency !== "WEEKLY";
    if (frequency) intervalUnit.textContent = units[frequency][Number(interval.value) === 1 ? 0 : 1];
    if (multi.getAttribute("aria-pressed") !== "true") dateLabel.textContent = frequency ? "Beginn" : "Datum";
    until.hidden = !frequency || !request?.rule?.until;
    until.textContent = request?.rule?.until ? `Endet nach dem ${app.calendar.formatDate(request.rule.until)}` : "";
  }

  /** @param {boolean} on */
  function setMulti(on) {
    multi.setAttribute("aria-pressed", String(on));
    form.classList.toggle("is-multi", on);
    dateLabel.textContent = on ? "Zeitraum" : repeat.value ? "Beginn" : "Datum";
    if (on && !endDate.value) {
      endDate.value = date.value;
      accepted.set(endDate, endDate.value);
    }
  }

  /** @param {MDCRule | null} rule */
  function showRule(rule) {
    dayButtons.forEach(button => button.setAttribute("aria-pressed", "false"));
    interval.value = String(rule?.interval || 1);
    accepted.set(interval, interval.value);
    if (!rule) repeat.value = "";
    else if (rule.freq === "MONTHLY") repeat.value = rule.byDay[0]?.startsWith("-") ? "MONTHLY_LAST" : rule.byDay.length ? "MONTHLY_POS" : "MONTHLY_DAY";
    else repeat.value = rule.freq;
    const selectedDays = rule?.freq === "WEEKLY" && rule.byDay.length ? rule.byDay : [app.recurrence.weekdays[app.recurrence.weekday(referenceDay())]];
    selectedDays.forEach(day => dayButtons[app.recurrence.weekdays.indexOf(day)]?.setAttribute("aria-pressed", "true"));
  }

  /** Builds the rule from the controls; null for „Keine“. @returns {MDCRule | null} */
  function ruleFromControls() {
    const value = repeat.value;
    if (!value) return null;
    if (!repeatTouched && request?.rule) return request.rule;
    const key = referenceDay();
    const weekday = app.recurrence.weekdays[app.recurrence.weekday(key)];
    /** @type {MDCRule} */
    const rule = { freq: "DAILY", interval: Number(interval.value) || 1, byDay: [], byMonthDay: 0, until: request?.rule?.until || "" };
    if (value === "WEEKLY") {
      rule.freq = "WEEKLY";
      rule.byDay = dayButtons.filter(button => button.getAttribute("aria-pressed") === "true").map(button => app.recurrence.weekdays[Number(button.dataset.weekday)]);
      if (!rule.byDay.length) rule.byDay = [weekday];
    } else if (value.startsWith("MONTHLY")) {
      rule.freq = "MONTHLY";
      if (value === "MONTHLY_DAY") rule.byMonthDay = Number(key.slice(8, 10));
      else rule.byDay = [`${value === "MONTHLY_LAST" ? -1 : Math.ceil(Number(key.slice(8, 10)) / 7)}${weekday}`];
    } else rule.freq = /** @type {MDCRule["freq"]} */ (value);
    if (rule.until && rule.until < key) rule.until = "";
    return rule;
  }

  /** Validates a field; a rejected value returns to the previous one. @param {HTMLInputElement} input @returns {boolean} */
  function validate(input) {
    const value = input.value.trim();
    let normalized = value;
    let message = "";
    if (input === date && !value && request?.inBacklog && repeat.value === "" && multi.getAttribute("aria-pressed") !== "true") {
      normalized = "";
    } else if (input === date || input === endDate) {
      const key = app.calendar.parseDate(value);
      if (!key) message = `„${value}“ ist kein gültiges Datum (TT.MM.JJJJ).`;
      else if (input === endDate && key < dateKey()) message = "Das Ende liegt vor dem Beginn.";
      else normalized = app.calendar.formatDate(key);
    } else if (input === interval) {
      if (!/^[1-9]\d{0,2}$/.test(value)) message = `„${value}“ ist kein gültiges Intervall (1 bis 999).`;
    } else if (value) {
      normalized = app.calendar.parseTime(value);
      if (!normalized) message = `„${value}“ ist keine gültige Uhrzeit (HH:MM).`;
      else if (input === end && !start.value.trim()) message = "Eine Endzeit braucht eine Beginnzeit.";
      else if (input === end && normalized < start.value.trim()) message = "Die Endzeit liegt vor der Beginnzeit.";
    }
    if (message) {
      reject(message);
      input.value = accepted.get(input) || "";
      return false;
    }
    input.value = normalized;
    accepted.set(input, normalized);
    return true;
  }

  function updateApply() {
    apply.disabled = !title.value.trim();
  }

  /** @param {MDCDialogRequest} next @param {MDCDialogHandlers} nextHandlers */
  function open(next, nextHandlers) {
    request = next;
    handlers = nextHandlers;
    repeatTouched = false;
    kind.textContent = next.isNew ? "Neuer Eintrag" : { entry: "Eintrag", series: "Serie", multiDay: "Mehrtägig" }[next.kind];
    title.value = next.title;
    date.value = next.date ? app.calendar.formatDate(next.date) : "";
    date.placeholder = next.inBacklog ? "Kein Datum (Backlog)" : "TT.MM.JJJJ";
    renderTags(next.tag);
    endDate.value = next.kind === "multiDay" ? app.calendar.formatDate(next.end) : "";
    start.value = next.startTime;
    end.value = next.endTime;
    place.value = next.location;
    note.value = next.note.join("\n");
    for (const input of [date, endDate, start, end]) accepted.set(input, input.value);
    updateRepeatOptions();
    showRule(next.rule);
    setMulti(next.kind === "multiDay");
    updateRepeatControls();
    updateDateHint();
    remove.hidden = next.isNew;
    toBacklog.hidden = next.kind !== "entry" || next.inBacklog;
    remove.textContent = next.kind === "series" ? "Serie löschen" : "Löschen";
    removeOccurrence.hidden = endSeries.hidden = next.kind !== "series" || !next.occurrence;
    updateApply();
    dialog.showModal();
    title.focus();
    title.setSelectionRange(title.value.length, title.value.length);
  }

  function close() {
    app.pickers.hide();
    if (dialog.open) dialog.close();
    handlers = null;
    request = null;
  }

  for (const input of [date, endDate, start, end, interval]) input.addEventListener("change", () => {
    if (!validate(input)) return;
    updateDateHint();
    if (input === date || input === interval) {
      repeatTouched = repeatTouched || input === date;
      updateRepeatOptions();
      updateRepeatControls();
    }
  });
  title.addEventListener("input", updateApply);
  repeat.addEventListener("change", () => {
    repeatTouched = true;
    updateRepeatControls();
  });
  interval.addEventListener("input", () => { repeatTouched = true; });
  weekdays.addEventListener("click", event => {
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    if (!button) return;
    repeatTouched = true;
    button.setAttribute("aria-pressed", String(button.getAttribute("aria-pressed") !== "true"));
  });
  multi.addEventListener("click", () => {
    setMulti(multi.getAttribute("aria-pressed") !== "true");
    updateDateHint();
  });

  /** Validates the fields and builds the result; null when an input was rejected. @param {boolean} backlogTarget @returns {MDCDialogResult | null} */
  function collect(backlogTarget) {
    if (!title.value.trim()) {
      title.focus();
      return null;
    }
    const isMulti = !backlogTarget && multi.getAttribute("aria-pressed") === "true";
    const fields = backlogTarget ? [start, end] : isMulti ? [date, endDate] : [date, start, end, ...(repeat.value ? [interval] : [])];
    if (!fields.every(validate)) return null;
    const rule = isMulti || backlogTarget ? null : ruleFromControls();
    return {
      kind: isMulti ? "multiDay" : rule ? "series" : "entry",
      title: title.value.trim(),
      location: place.value.trim(),
      note: note.value.split(/\r?\n/).map(line => line.trimEnd()).filter(Boolean),
      date: dateKey(),
      end: isMulti ? app.calendar.parseDate(endDate.value) : "",
      startTime: isMulti ? "" : start.value,
      endTime: isMulti || !start.value ? "" : end.value,
      rule,
      tag: tagSelect.value
    };
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    const current = handlers;
    const result = current ? collect(false) : null;
    if (!current || !result) return;
    close();
    current.apply(result);
  });

  toBacklog.addEventListener("click", () => {
    const current = handlers;
    const result = current ? collect(true) : null;
    if (!current || !result) return;
    close();
    current.toBacklog({ ...result, date: "" });
  });

  for (const [button, action] of /** @type {Array<[HTMLElement, keyof MDCDialogHandlers]>} */ ([[remove, "remove"], [removeOccurrence, "deleteOccurrence"], [endSeries, "endSeries"]])) {
    button.addEventListener("click", () => {
      const current = handlers;
      close();
      if (current) /** @type {() => void} */ (current[action])();
    });
  }

  dialog.addEventListener("click", event => {
    // The dialog has no padding, so a click on the dialog element itself is a click on the backdrop.
    if (event.target === dialog || (event.target instanceof Element && event.target.closest("[data-close]"))) close();
  });
  dialog.addEventListener("cancel", event => {
    if (!app.pickers.isOpen()) return;
    event.preventDefault();
    app.pickers.hide();
  });
  dialog.addEventListener("close", () => {
    app.pickers.hide();
    handlers = null;
    request = null;
  });

  app.dialog = { open, close, isOpen: () => dialog.open };
})(window.MDCalendar);
