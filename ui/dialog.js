window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Entry dialog (docs/ui/Shell.md#entry-dialog): the title and one strip of tokens for date, time, repeat, tag, location
// and note, with Apply at its end. Each token opens a popover of one width with ready choices; only what is set shows
// its value. Tab moves from token to token and keeps what the open popover holds; Enter applies from everywhere.
(function (app) {
  const element = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));
  const dialog = /** @type {HTMLDialogElement} */ (element("dialog"));
  const form = /** @type {HTMLFormElement} */ (dialog.querySelector("form"));
  const title = /** @type {HTMLInputElement} */ (element("dialogTitle"));
  const tokens = element("dialogTokens");
  const pop = element("dialogPop");
  const actions = element("dialogActions");
  const apply = /** @type {HTMLButtonElement} */ (element("dialogApply"));
  /** Notifications and tooltip, each with the node it is put back before when the dialog closes. */
  const overlays = /** @type {Array<[HTMLElement, ChildNode | null]>} */ (["notifications", "appTooltip"].map(id => [element(id), element(id).nextSibling]));
  const icon = (/** @type {string} */ name) => app.tiles.icon(name);
  const esc = (/** @type {string} */ text) => app.tiles.escape(text);
  const weekdayNames = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  const longNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const ordinals = ["1st", "2nd", "3rd", "4th"];
  const units = { DAILY: ["day", "days"], WEEKLY: ["week", "weeks"], MONTHLY: ["month", "months"], YEARLY: ["year", "years"] };
  /** Height of one row of the time wheels in px; a wheel shows five rows with the chosen one in the middle. */
  const wheelRow = 36;
  const pad2 = (/** @type {number} */ value) => String(value).padStart(2, "0");
  /** The time wheels: start hour and minute, end hour (led by “–” for no end) and end minute; minutes in steps of five. */
  const wheelValues = /** @type {Record<string, string[]>} */ ({
    sh: Array.from({ length: 24 }, (_, hour) => pad2(hour)),
    sm: Array.from({ length: 12 }, (_, step) => pad2(step * 5)),
    eh: ["", ...Array.from({ length: 24 }, (_, hour) => pad2(hour))],
    em: Array.from({ length: 12 }, (_, step) => pad2(step * 5))
  });
  const wheelLabels = /** @type {Record<string, string>} */ ({ sh: "Start hour", sm: "Start minute", eh: "End hour", em: "End minute" });
  /** The start the wheels show while no time is set. */
  const shownStart = () => state.startTime || "09:00";
  const minutesOf = (/** @type {string} */ time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const timeOf = (/** @type {number} */ minutes) => `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;

  /** @type {MDCDialogHandlers | null} */
  let handlers = null;
  /** @type {MDCDialogRequest | null} */
  let request = null;
  /**
   * The values the dialog edits. `start` is "" for the backlog; `end` differs from `start` for several days. Time and
   * repeat stay in the state while a range is chosen and return when it becomes one day again.
   */
  let state = {
    start: "", end: "", startTime: "", endTime: "",
    /** @type {"" | "DAILY" | "WEEKLY" | "MONTHLY_DAY" | "MONTHLY_POS" | "MONTHLY_LAST" | "YEARLY"} */
    repeat: "", interval: 1, weekdays: /** @type {string[]} */ ([]), repeatTouched: false,
    tag: "", location: "", note: "",
    /** Open popover: "", "date", "time", "repeat", "tag", "location" or "note". */
    open: "",
    /** First day of the month the calendar shows. */
    month: "",
    /** Set after a day was clicked in the open calendar: the next click on another day makes a range. */
    pending: false
  };

  const today = () => app.calendar.todayKey(new Date());
  const isRange = () => Boolean(state.start) && state.end !== state.start;
  /** The day the repeat options follow. */
  const reference = () => state.start || today();
  const timeText = () => state.startTime ? `${state.startTime}${state.endTime ? ` – ${state.endTime}` : ""}` : "";
  /** The date as its popover's field shows it: `DD.MM.YYYY`, a range of two, or empty for the backlog. */
  const dateField = () => !state.start ? "" : isRange()
    ? `${app.calendar.formatDate(state.start)} – ${app.calendar.formatDate(state.end)}` : app.calendar.formatDate(state.start);

  /**
   * Selects the next (`step` 1) or previous (-1) group of digits in the date field, so that Tab walks day, month and
   * year. Returns false when there is none in that direction.
   * @param {HTMLInputElement} input @param {number} step
   */
  function stepSegment(input, step) {
    const parts = [...input.value.matchAll(/\d+/g)];
    const at = input.selectionStart ?? 0;
    const current = parts.findIndex(part => at >= (part.index ?? 0) && at <= (part.index ?? 0) + part[0].length);
    const next = parts[(current < 0 ? (step > 0 ? -1 : parts.length) : current) + step];
    if (!next) return false;
    input.setSelectionRange(next.index ?? 0, (next.index ?? 0) + next[0].length);
    return true;
  }

  // ---------- Text of the tokens ----------

  /** @param {string} key */
  function dayText(key) {
    if (key === today()) return "Today";
    if (key === app.calendar.addDays(today(), 1)) return "Tomorrow";
    return app.calendar.formatDay(key, key.slice(0, 4) === today().slice(0, 4) ? "dd, D MMM" : "dd, D MMM YYYY");
  }

  function dateText() {
    if (!state.start) return "Backlog";
    if (!isRange()) return dayText(state.start);
    const sameYear = state.start.slice(0, 4) === state.end.slice(0, 4);
    const from = app.calendar.formatDay(state.start, state.start.slice(0, 7) === state.end.slice(0, 7) ? "D" : sameYear ? "D MMM" : "D MMM YYYY");
    return `${from} – ${app.calendar.formatDay(state.end, state.end.slice(0, 4) === today().slice(0, 4) && sameYear ? "D MMM" : "D MMM YYYY")}`;
  }

  function repeatText() {
    if (!state.repeat) return "";
    const every = state.interval > 1;
    const weekday = longNames[app.recurrence.weekday(reference())];
    if (state.repeat === "DAILY") return every ? `Every ${state.interval} days` : "Daily";
    if (state.repeat === "WEEKLY") return every ? `Every ${state.interval} weeks` : "Weekly";
    if (state.repeat === "YEARLY") return every ? `Every ${state.interval} years` : "Yearly";
    const monthly = state.repeat === "MONTHLY_DAY" ? `on day ${Number(reference().slice(8, 10))}` : state.repeat === "MONTHLY_LAST" ? `last ${weekday.slice(0, 3)}` : `${ordinals[Math.ceil(Number(reference().slice(8, 10)) / 7) - 1]} ${weekday.slice(0, 3)}`;
    return `${every ? `Every ${state.interval} months` : "Monthly"} ${monthly}`;
  }

  // ---------- Rendering ----------

  /**
   * @param {string} name popover the token opens @param {string} symbol @param {string} value shown value, "" for an
   * unset token (icon only) @param {string} label accessible name @param {string} [style] @param {string} [blocked] why
   * the token cannot be chosen with the current choices; it stays visible and dimmed, and its accessible name says why
   */
  function token(name, symbol, value, label, style = "", blocked = "") {
    const id = { date: "dialogDate", time: "dialogTime", repeat: "dialogRepeat", tag: "dialogTag", location: "dialogLocation", note: "dialogNoteToken" }[name];
    const shown = blocked ? "" : value;
    return `<button type="button" class="dlg__tok${shown ? "" : " is-off"}${style ? " has-tag" : ""}" id="${id}" data-pop="${name}" aria-expanded="${state.open === name}"` +
      (blocked ? ` aria-disabled="true" aria-label="${esc(`${label}: ${blocked}`)}"` : ` aria-label="${esc(label)}"`) +
      `${style}>${symbol}${shown ? `<span>${esc(shown)}</span>` : ""}</button>`;
  }

  function renderTokens() {
    const tag = request?.tags.find(item => item.name === state.tag);
    const tagStyle = tag ? ` style="--h:${app.configFormat.hue(tag.color)}"` : "";
    const time = state.startTime ? `${state.startTime}${state.endTime ? `–${state.endTime}` : ""}` : "";
    const range = isRange();
    const noteLine = (state.note.split(/\r?\n/).find(line => line.trim()) || "").trim().replace(/^-\s*/, "");
    // Several days have neither time nor repeat (docs/Domain.md#multi-day-entry), the backlog neither; both stay visible.
    const blocked = range ? "Not for several days" : state.start ? "" : "Not in the backlog";
    tokens.innerHTML =
      token("date", icon(state.start ? "calendar" : "inbox"), dateText(), `Date: ${state.start ? dateText() : "Backlog"}`).replace("<button ", `<button data-date="${state.start}" `) +
      token("time", icon("clock"), time, time ? `Time: ${time}` : "Time", "", blocked) +
      token("repeat", icon("repeat"), repeatText(), state.repeat ? `Repeat: ${repeatText()}` : "Repeat", "", blocked) +
      token("tag", tag ? app.tiles.tagIcon(tag.name, "dlg__tagicon") || icon("tag") : icon("tag"), state.tag, state.tag ? `Tag: ${state.tag}` : "Tag", tagStyle) +
      token("location", icon("pin"), state.location, state.location ? `Location: ${state.location}` : "Location") +
      token("note", icon("note"), noteLine, noteLine ? `Note: ${noteLine}` : "Note");
    // A title is enough; a series cannot go to the backlog.
    apply.disabled = !title.value.trim();
  }

  /** The month calendar of the date popover. */
  function calendarMarkup() {
    const first = app.calendar.weekStart(state.month);
    const cells = Array.from({ length: 42 }, (_, index) => app.calendar.addDays(first, index));
    const shown = cells.slice(35).some(key => key.slice(0, 7) === state.month.slice(0, 7)) ? cells : cells.slice(0, 35);
    return `<div class="dlg__cal"><div class="dlg__calhead"><button class="iconbtn" type="button" data-month="-1" aria-label="Previous month">${icon("chevron-left")}</button>` +
      `<b>${app.calendar.formatDay(state.month, "MMMM YYYY")}</b><button class="iconbtn" type="button" data-month="1" aria-label="Next month">${icon("chevron-right")}</button></div>` +
      `<div class="dlg__calgrid">${weekdayNames.map(name => `<span class="dlg__dow">${name}</span>`).join("")}` +
      shown.map(key => {
        const inRange = isRange() && key >= state.start && key <= state.end;
        const classes = ["dlg__calday", key.slice(0, 7) !== state.month.slice(0, 7) && "is-other", key === today() && "is-today",
          key === state.start && "is-start", key === state.end && "is-end", inRange && "in-range"].filter(Boolean).join(" ");
        return `<button type="button" class="${classes}" data-calday="${key}" aria-pressed="${inRange || key === state.start}" aria-label="${app.calendar.formatDay(key, "dddd, D MMMM YYYY")}">${Number(key.slice(8))}</button>`;
      }).join("") + `</div></div>`;
  }

  /**
   * The time wheels below the field: start hour and minute, a dash, end hour and minute. Above them “No time” clears both
   * and “No end” the end.
   */
  function wheelsMarkup() {
    const wheel = (/** @type {string} */ key) => `<div class="dlg__wheel" data-wheel="${key}" tabindex="-1" role="listbox" aria-label="${wheelLabels[key]}">` +
      `<div class="dlg__wheelpad"></div>${wheelValues[key].map((value, index) => `<span data-row="${index}" role="option"><b>${value || "–"}</b></span>`).join("")}<div class="dlg__wheelpad"></div></div>`;
    return `<div class="dlg__pills" role="group" aria-label="Clear"><button type="button" class="dlg__pill" data-time="">No time</button>` +
      `<button type="button" class="dlg__pill" data-time="end">No end</button></div>` +
      `<div class="dlg__wheels">${wheel("sh")}${wheel("sm")}<span class="dlg__wheeldash">–</span>${wheel("eh")}${wheel("em")}</div>`;
  }

  function repeatMarkup() {
    const key = reference();
    const day = Number(key.slice(8, 10));
    const weekday = longNames[app.recurrence.weekday(key)];
    const daysInMonth = new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0)).getUTCDate();
    const frequency = state.repeat.startsWith("MONTHLY") ? "MONTHLY" : state.repeat;
    const kinds = [["", "Never"], ["DAILY", "Daily"], ["WEEKLY", "Weekly"], ["MONTHLY", "Monthly"], ["YEARLY", "Yearly"]];
    let html = `<div class="dlg__seg" role="group" aria-label="Repeat">${kinds.map(([value, label]) => `<button type="button" data-repeat="${value}" aria-pressed="${frequency === value}">${label}</button>`).join("")}</div>`;
    if (frequency === "WEEKLY") {
      html += `<div class="dlg__weekdays" role="group" aria-label="Weekdays">${weekdayNames.map((name, index) =>
        `<button type="button" class="dlg__weekday" data-weekday="${index}" aria-pressed="${state.weekdays.includes(app.recurrence.weekdays[index])}" aria-label="${longNames[index]}">${name}</button>`).join("")}</div>`;
    }
    if (frequency === "MONTHLY") {
      /** @type {Array<[string, string]>} */
      const options = [["MONTHLY_DAY", `On day ${day}`]];
      if (Math.ceil(day / 7) <= 4) options.push(["MONTHLY_POS", `${ordinals[Math.ceil(day / 7) - 1]} ${weekday}`]);
      if (day + 7 > daysInMonth) options.push(["MONTHLY_LAST", `Last ${weekday}`]);
      html += `<div class="dlg__seg" role="group" aria-label="Monthly">${options.map(([value, label]) => `<button type="button" data-monthly="${value}" aria-pressed="${state.repeat === value}">${label}</button>`).join("")}</div>`;
    }
    if (frequency === "YEARLY") html += `<span class="dlg__hint">On ${app.calendar.formatDay(key, "D MMMM")}</span>`;
    if (frequency) {
      const unit = units[/** @type {keyof typeof units} */ (frequency)][state.interval === 1 ? 0 : 1];
      html += `<label class="dlg__every">every <input class="dlg__num" id="dialogInterval" value="${state.interval}" inputmode="numeric" autocomplete="off" aria-label="Interval"> ${unit}</label>`;
      if (request?.rule?.until && !state.repeatTouched) html += `<span class="dlg__hint">Ends after ${app.calendar.formatDate(request.rule.until)}</span>`;
    }
    return html;
  }

  function tagMarkup() {
    const configured = [...(request?.tags || [])].sort((left, right) => left.name.localeCompare(right.name, "en"));
    // A tag the item has but Config.md lacks is offered too, so that it is not lost.
    const names = configured.map(tag => tag.name);
    const extra = state.tag && !names.includes(state.tag) ? [state.tag] : [];
    return `<div class="dlg__tags" role="radiogroup" aria-label="Tag"><button type="button" role="radio" class="dlg__tagchip" data-tag="" aria-checked="${!state.tag}">No tag</button>` +
      configured.map(tag => `<button type="button" role="radio" class="dlg__tagchip has-tag" style="--h:${app.configFormat.hue(tag.color)}" data-tag="${esc(tag.name)}" aria-checked="${state.tag === tag.name}">${app.tiles.tagIcon(tag.name, "dlg__tagicon")}${esc(tag.name)}</button>`).join("") +
      extra.map(name => `<button type="button" role="radio" class="dlg__tagchip" data-tag="${esc(name)}" aria-checked="true">${esc(name)}</button>`).join("") + `</div>`;
  }

  /** @param {string} filter */
  function locationList(filter) {
    const query = filter.trim().toLowerCase();
    const matches = (request?.locations || []).filter(place => !query || place.toLowerCase().includes(query)).slice(0, 8);
    return matches.map(place => `<button type="button" class="dlg__opt" data-place="${esc(place)}">${icon("pin")}<span>${esc(place)}</span></button>`).join("");
  }

  /**
   * Renders the open popover. When it opens, the focus moves to its field or its chosen option; when it renders again,
   * the focus stays on the same choice. @param {boolean} [opening]
   */
  function renderPop(opening = false) {
    const name = state.open;
    pop.hidden = !name;
    if (!name) {
      pop.replaceChildren();
      return;
    }
    const active = document.activeElement instanceof HTMLElement && pop.contains(document.activeElement) ? document.activeElement : null;
    const kept = active ? Object.entries(active.dataset)[0] : undefined;
    if (name === "date") {
      // Only a plain entry can wait in the backlog; otherwise its pill stays visible but cannot be chosen.
      const noBacklog = state.repeat ? "Not for a series" : request?.kind === "multiDay" ? "Not for several days" : request?.kind === "series" ? "Not for a series" : "";
      const picks = [["today", "Today", today(), ""], ["tomorrow", "Tomorrow", app.calendar.addDays(today(), 1), ""], ["backlog", "Backlog", "", noBacklog]];
      pop.innerHTML = `<label class="dlg__search">${icon("calendar")}<input id="dialogDateInput" value="${dateField()}" placeholder="DD.MM.YYYY" autocomplete="off" inputmode="numeric" aria-label="Date"></label>` +
        `<div class="dlg__pills" role="group" aria-label="Quick dates">${picks.map(([value, label, key, blocked]) =>
          `<button type="button" class="dlg__pill" data-pick="${value}" aria-pressed="${!isRange() && state.start === key}"` +
          `${blocked ? ` aria-disabled="true" aria-label="${label}: ${blocked}"` : ""}>${label}</button>`).join("")}</div>` +
        calendarMarkup();
    } else if (name === "time") {
      pop.innerHTML = `<label class="dlg__search">${icon("clock")}<input id="dialogTimeInput" value="${timeText()}" placeholder="09:30 – 10:30" autocomplete="off" aria-label="Time"></label>${wheelsMarkup()}`;
    } else if (name === "repeat") pop.innerHTML = repeatMarkup();
    else if (name === "tag") pop.innerHTML = tagMarkup();
    else if (name === "location") {
      pop.innerHTML = `<label class="dlg__search">${icon("pin")}<input id="dialogLocationInput" value="${esc(state.location)}" placeholder="Location" autocomplete="off" aria-label="Location"></label>` +
        `<div class="dlg__list" id="dialogPlaces">${locationList("")}</div>`;
    } else if (name === "note") {
      pop.innerHTML = `<textarea class="dlg__note" id="dialogNote" placeholder="Note" aria-label="Note" rows="5">${esc(state.note)}</textarea>`;
    }
    pop.className = `dlg__pop dlg__pop--${name}`;
    // Below the strip of tokens, centered under the title. Layout offsets, not the boxes on screen, so that the rise of
    // the opening dialog does not shift it: one layout read, then writes.
    const anchor = /** @type {HTMLElement | null} */ (tokens.querySelector(`[data-pop="${name}"]`));
    const top = anchor ? anchor.offsetTop + anchor.offsetHeight : tokens.offsetTop + tokens.offsetHeight;
    const left = title.offsetLeft + (title.offsetWidth - pop.offsetWidth) / 2;
    pop.style.top = `${top + 8}px`;
    pop.style.left = `${Math.round(left)}px`;
    const field = /** @type {HTMLInputElement | HTMLTextAreaElement | null} */ (pop.querySelector("input:not(.dlg__num), textarea"));
    if (opening) {
      const choice = /** @type {HTMLElement | null} */ (pop.querySelector('[aria-pressed="true"], [aria-checked="true"]') || pop.querySelector("button"));
      (field || choice)?.focus();
      // The date field starts on its day, so that Tab can walk on to month and year.
      if (field instanceof HTMLInputElement) {
        field.select();
        const day = field.id === "dialogDateInput" ? /\d+/.exec(field.value) : null;
        if (day) field.setSelectionRange(day.index, day.index + day[0].length);
      }
    } else if (active) {
      const attribute = kept ? `data-${kept[0].replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}` : "";
      const same = kept ? /** @type {HTMLElement | null} */ (pop.querySelector(`[${attribute}="${CSS.escape(kept[1] || "")}"]:not(:disabled)`)) : null;
      (same || field || pop).focus();
    }
    if (name === "time") placeWheels(false);
    if (name === "time" && field instanceof HTMLInputElement && opening) selectTimePart(field, "sh");
  }

  function render() {
    renderTokens();
    renderPop();
  }

  /** Opens the popover of a token; `focus` moves the focus into it. @param {string} name @param {boolean} [focus] */
  function showPop(name, focus = true) {
    state.open = name;
    if (name === "date") {
      state.month = `${(state.start || today()).slice(0, 7)}-01`;
      state.pending = false;
    }
    renderTokens();
    renderPop(focus);
  }

  /** A click on a token opens its popover and a second one closes it; what the open popover holds is kept. @param {string} name */
  function togglePop(name) {
    if (state.open === name) closePop(true);
    else {
      if (state.open) commitPop();
      showPop(name);
    }
  }

  /**
   * Closes the popover and returns the focus to its token. `keep` takes what is typed in it first; Escape drops it.
   * @param {boolean} [keep]
   */
  function closePop(keep = false) {
    if (!state.open) return;
    if (keep) commitPop();
    const name = state.open;
    state.open = "";
    render();
    /** @type {HTMLElement | null} */ (tokens.querySelector(`[data-pop="${name}"]`))?.focus();
  }

  // ---------- Changing the values ----------

  /** @param {[string, MDCNotificationBody]} message */
  function reject([heading, body]) {
    app.notifications.show("warning", heading, body);
  }

  /**
   * Takes what is typed in the open popover's field. An invalid date, time or interval is rejected with a notification,
   * the previous value stays and the result is false.
   */
  function commitPop() {
    const field = /** @type {HTMLInputElement | null} */ (pop.querySelector("input"));
    if (!field) return true;
    if (field.id === "dialogDateInput") return !field.value.trim() || field.value.trim() === dateField() || typedDate(field.value);
    if (field.id === "dialogTimeInput") return field.value.trim() === timeText() || typedTime(field.value);
    if (field.id === "dialogInterval") return field.value.trim() === String(state.interval) || typedInterval(field);
    return true;
  }

  /** Keeps a monthly choice that the new date no longer offers on a valid one. */
  function fitRepeat() {
    const day = Number(reference().slice(8, 10));
    const daysInMonth = new Date(Date.UTC(Number(reference().slice(0, 4)), Number(reference().slice(5, 7)), 0)).getUTCDate();
    if (state.repeat === "MONTHLY_POS" && Math.ceil(day / 7) > 4) state.repeat = "MONTHLY_DAY";
    if (state.repeat === "MONTHLY_LAST" && day + 7 <= daysInMonth) state.repeat = "MONTHLY_DAY";
  }

  /**
   * A click on a day of the open calendar (docs/ui/Shell.md#entry-dialog). The first click sets the day; a click on
   * another day then makes the range between both. On a range, a click on its end or start goes back to the start as
   * one day; any other day starts over with that day.
   * @param {string} key
   */
  function clickDay(key) {
    if (state.pending) {
      if (key !== state.start) [state.start, state.end] = key < state.start ? [key, state.start] : [state.start, key];
      state.pending = false;
    } else if (isRange() && (key === state.end || key === state.start)) {
      state.end = state.start;
      state.pending = true;
    } else {
      state.start = state.end = key;
      state.pending = true;
    }
    state.repeatTouched = state.repeatTouched || Boolean(state.repeat);
    fitRepeat();
    render();
  }

  /** @param {string} key @param {string} [end] */
  function setDate(key, end = key) {
    state.start = key;
    state.end = end;
    if (key) state.month = `${key.slice(0, 7)}-01`;
    fitRepeat();
  }

  /** A typed date: D.M.YYYY or D.M. (this year), also a range of two, “12.11. – 14.11.”. @param {string} text */
  function typedDate(text) {
    const year = (state.start || today()).slice(0, 4);
    const keys = text.split(/\s*[–-]\s*/).filter(Boolean).map(part => {
      const match = /^(\d{1,2})\.(\d{1,2})\.?(\d{4})?$/.exec(part.trim());
      return match ? app.calendar.parseDate(`${match[1].padStart(2, "0")}.${match[2].padStart(2, "0")}.${match[3] || year}`) : "";
    });
    if (!keys.length || keys.length > 2 || keys.some(key => !key)) {
      reject(["Invalid date", app.notifications.text`Use ${"DD.MM.YYYY"}.`]);
      return false;
    }
    const [from, to = from] = keys.sort();
    setDate(from, to);
    return true;
  }

  /**
   * Reads a typed time: HH:MM, also without the colon (1100, 930) or as a bare hour (9), or a range of two; empty is no
   * time. @param {string} text @returns {[string, string] | "invalid" | "order"}
   */
  function readTime(text) {
    if (!text.trim()) return ["", ""];
    const parts = text.split(/\s*[–-]\s*/).map(part => app.calendar.parseTime(part.trim().replace(/^(\d{1,2})$/, "$1:00").replace(/^(\d{1,2})(\d{2})$/, "$1:$2")));
    if (parts.length > 2 || parts.some(part => !part)) return "invalid";
    if (parts[1] && parts[1] < parts[0]) return "order";
    return [parts[0], parts[1] || ""];
  }

  /** Takes a typed time; an invalid one is rejected with a notification. @param {string} text */
  function typedTime(text) {
    const result = readTime(text);
    if (result === "invalid") reject(["Invalid time", app.notifications.text`Use ${"HH:MM"}.`]);
    if (result === "order") reject(["End time before start", ""]);
    if (typeof result === "string") return false;
    [state.startTime, state.endTime] = result;
    return true;
  }

  /** A typed interval of 1 to 999. @param {HTMLInputElement} input */
  function typedInterval(input) {
    if (!/^[1-9]\d{0,2}$/.test(input.value.trim())) {
      reject(["Invalid interval", "Use 1 to 999."]);
      input.value = String(state.interval);
      return false;
    }
    state.repeatTouched = true;
    state.interval = Number(input.value);
    return true;
  }

  /**
   * Puts the cursor of the time field on the part a wheel changed, or behind the start while there is no end.
   * @param {HTMLInputElement} input @param {string} part wheel key: sh, sm, eh or em
   */
  function selectTimePart(input, part) {
    const end = part.startsWith("e");
    const time = end ? state.endTime : state.startTime;
    const from = !time ? input.value.length : (end ? input.value.length - 5 : 0) + (part.endsWith("m") ? 3 : 0);
    input.setSelectionRange(from, time ? from + 2 : from);
  }

  /** The row a wheel shows for the current time: its hour, its minute to the nearest five, “–” for no end. @param {string} key */
  function wheelIndex(key) {
    const time = key.startsWith("e") ? state.endTime : shownStart();
    if (key === "eh") return time ? Number(time.slice(0, 2)) + 1 : 0;
    const shown = time || shownStart();
    return key.endsWith("h") ? Number(shown.slice(0, 2)) : Math.round(Number(shown.slice(3)) / 5) % 12;
  }

  /**
   * Draws the wheel as a drum: rows turn away and fade with their distance from the middle, the middle row is lit.
   * One read of the scroll position, then writes. @param {HTMLElement} wheel
   */
  function paintWheel(wheel) {
    const middle = wheel.scrollTop / wheelRow;
    wheel.querySelectorAll("span").forEach((row, index) => {
      const distance = index - middle;
      const away = Math.abs(distance);
      const face = /** @type {HTMLElement} */ (row.firstElementChild);
      face.style.transform = `rotateX(${Math.max(-80, Math.min(80, -distance * 22))}deg) translateZ(${-away * 6}px)`;
      face.style.opacity = String(Math.max(0.15, 1 - away * 0.28));
      row.classList.toggle("is-chosen", away < 0.5);
    });
  }

  /** Turns a wheel to a row, gliding unless `glide` is false or motion is reduced. @param {HTMLElement} wheel @param {number} row @param {boolean} glide */
  function turnWheel(wheel, row, glide) {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    wheel.dataset.row = String(row);
    wheel.scrollTo({ top: row * wheelRow, behavior: glide && !reduced ? "smooth" : "auto" });
    paintWheel(wheel);
  }

  /** The row a wheel is turning to or stands on, so that quick steps count from there, not from midway. @param {HTMLElement} wheel */
  const wheelAt = wheel => Number(wheel.dataset.row ?? Math.round(wheel.scrollTop / wheelRow));

  /**
   * Turns every wheel to the current time, except one the user is turning, and marks what is unset: without a time the
   * wheels are dimmed, without an end its minute wheel and “No end” are. @param {boolean} glide
   */
  function placeWheels(glide) {
    for (const wheel of /** @type {NodeListOf<HTMLElement>} */ (pop.querySelectorAll(".dlg__wheel"))) {
      if (!wheel.dataset.touched) turnWheel(wheel, wheelIndex(wheel.dataset.wheel || ""), glide);
    }
    pop.querySelector(".dlg__wheels")?.classList.toggle("is-unset", !state.startTime);
    pop.querySelector(".dlg__wheels")?.classList.toggle("has-no-end", !state.endTime);
    const noEnd = pop.querySelector('[data-time="end"]');
    if (state.endTime) noEnd?.removeAttribute("aria-disabled");
    else noEnd?.setAttribute("aria-disabled", "true");
  }

  /**
   * Takes the row a wheel stopped on. A new start keeps the duration, as far as the day allows; an end before the start
   * becomes the start; turning the end without a start sets the start the wheels show. The field, the token and the
   * other wheels follow, and the field selects the changed part. @param {string} key @param {number} row
   * @param {boolean} [toField] moves the focus to the field (not while the arrow keys turn a wheel)
   */
  function pickWheel(key, row, toField = true) {
    const value = wheelValues[key][row];
    const before = state.startTime;
    const start = shownStart();
    if (key === "sh") state.startTime = `${value}:${start.slice(3)}`;
    else if (key === "sm") state.startTime = `${start.slice(0, 2)}:${value}`;
    else if (key === "eh") state.endTime = value ? `${value}:${(state.endTime || start).slice(3)}` : "";
    else if (state.endTime) state.endTime = `${state.endTime.slice(0, 2)}:${value}`;
    else return;
    if (!state.startTime) state.startTime = start;
    if (key.startsWith("s") && before && state.endTime) {
      const end = minutesOf(state.endTime) + minutesOf(state.startTime) - minutesOf(before);
      state.endTime = timeOf(Math.min(end, 23 * 60 + 55));
    }
    if (state.endTime && state.endTime < state.startTime) state.endTime = state.startTime;
    syncTime(key, toField);
  }

  /** Shows the time in the field, the token and the wheels. @param {string} part @param {boolean} toField */
  function syncTime(part, toField) {
    const field = /** @type {HTMLInputElement | null} */ (pop.querySelector("#dialogTimeInput"));
    if (field) field.value = timeText();
    renderTokens();
    placeWheels(true);
    if (field && toField) {
      field.focus();
      selectTimePart(field, part);
    }
  }

  /** @param {string} value */
  function setRepeat(value) {
    state.repeatTouched = true;
    if (value === "MONTHLY") value = state.repeat.startsWith("MONTHLY") ? state.repeat : "MONTHLY_DAY";
    state.repeat = /** @type {typeof state.repeat} */ (value);
    if (value === "WEEKLY" && !state.weekdays.length) state.weekdays = [app.recurrence.weekdays[app.recurrence.weekday(reference())]];
    fitRepeat();
  }

  /** The rule the repeat choices describe; the stored rule is kept as it is while untouched. @returns {MDCRule | null} */
  function rule() {
    if (!state.repeat || isRange() || !state.start) return null;
    if (!state.repeatTouched && request?.rule) return request.rule;
    const key = reference();
    const weekday = app.recurrence.weekdays[app.recurrence.weekday(key)];
    /** @type {MDCRule} */
    const result = { freq: "DAILY", interval: state.interval, byDay: [], byMonthDay: 0, until: request?.rule?.until || "" };
    if (state.repeat === "WEEKLY") {
      result.freq = "WEEKLY";
      result.byDay = state.weekdays.length ? app.recurrence.weekdays.filter(day => state.weekdays.includes(day)) : [weekday];
    } else if (state.repeat.startsWith("MONTHLY")) {
      result.freq = "MONTHLY";
      if (state.repeat === "MONTHLY_DAY") result.byMonthDay = Number(key.slice(8, 10));
      else result.byDay = [`${state.repeat === "MONTHLY_LAST" ? -1 : Math.ceil(Number(key.slice(8, 10)) / 7)}${weekday}`];
    } else result.freq = /** @type {MDCRule["freq"]} */ (state.repeat);
    if (result.until && result.until < key) result.until = "";
    return result;
  }

  /** @param {MDCRule | null} stored */
  function showRule(stored) {
    state.interval = stored?.interval || 1;
    state.weekdays = stored?.freq === "WEEKLY" ? [...stored.byDay] : [];
    if (!stored) state.repeat = "";
    else if (stored.freq === "MONTHLY") state.repeat = stored.byDay[0]?.startsWith("-") ? "MONTHLY_LAST" : stored.byDay.length ? "MONTHLY_POS" : "MONTHLY_DAY";
    else state.repeat = stored.freq;
  }

  // ---------- Open, close, apply ----------

  /** @param {MDCDialogRequest} next @param {MDCDialogHandlers} nextHandlers */
  function open(next, nextHandlers) {
    request = next;
    handlers = nextHandlers;
    state = {
      start: next.date, end: next.kind === "multiDay" ? next.end : next.date, startTime: next.startTime, endTime: next.endTime,
      repeat: "", interval: 1, weekdays: /** @type {string[]} */ ([]), repeatTouched: false,
      tag: next.tag, location: next.location, note: next.note.join("\n"), open: "", month: "", pending: false
    };
    showRule(next.rule);
    title.value = next.title;
    renderActions();
    render();
    dialog.showModal();
    liftNotices();
    title.focus();
    title.setSelectionRange(title.value.length, title.value.length);
    // A new item starts with its day choice open; the title keeps the focus.
    if (next.isNew) showPop("date", false);
  }

  /** Delete for entries and multi-day entries; the choices of a series behind one “Delete…”. */
  function renderActions() {
    actions.hidden = !request || request.isNew;
    if (!request || request.isNew) {
      actions.innerHTML = "";
      return;
    }
    actions.innerHTML = request.kind === "series" && request.occurrence
      ? `<button class="btn btn--danger" id="dialogDelete" type="button" data-menu aria-expanded="false">Delete…</button>`
      : `<button class="btn btn--danger" id="dialogDelete" type="button" data-action="remove">Delete</button>`;
  }

  function close() {
    if (dialog.open) dialog.close();
  }

  /**
   * While the dialog is open the notifications and the tooltip move into it and show as popovers: inside the dialog they
   * stay usable instead of inert, and in the top layer above it they are not blurred by its backdrop. Their own `hidden`
   * still hides them. Closing puts them back where they were.
   */
  function liftNotices() {
    for (const [overlay] of overlays) {
      dialog.append(overlay);
      overlay.setAttribute("popover", "manual");
      overlay.showPopover();
    }
  }

  function dropNotices() {
    for (const [overlay, next] of overlays) {
      if (overlay.parentNode !== dialog) continue;
      overlay.hidePopover();
      overlay.removeAttribute("popover");
      document.body.insertBefore(overlay, next);
    }
  }

  /** @returns {MDCDialogResult | null} */
  function collect() {
    if (!title.value.trim()) {
      title.focus();
      return null;
    }
    const range = isRange();
    const repeated = rule();
    return {
      kind: range ? "multiDay" : repeated ? "series" : "entry",
      title: title.value.trim(),
      location: state.location.trim(),
      note: state.note.split(/\r?\n/).map(line => line.trimEnd()).filter(Boolean),
      date: state.start,
      end: range ? state.end : "",
      // Several days and the backlog have no time; a time chosen before stays in the state and returns with one day.
      startTime: range || !state.start ? "" : state.startTime,
      endTime: range || !state.start || !state.startTime ? "" : state.endTime,
      rule: repeated,
      tag: state.tag
    };
  }

  // ---------- Events ----------

  title.addEventListener("input", () => { apply.disabled = !title.value.trim(); });

  tokens.addEventListener("click", event => {
    const button = event.target instanceof Element ? /** @type {HTMLElement | null} */ (event.target.closest("[data-pop]")) : null;
    if (button?.dataset.pop && button.getAttribute("aria-disabled") !== "true") togglePop(button.dataset.pop);
  });

  pop.addEventListener("click", event => {
    // A click on a row of a wheel turns the wheel to it, unless the wheel was dragged.
    const row = event.target instanceof Element ? /** @type {HTMLElement | null} */ (event.target.closest(".dlg__wheel span")) : null;
    const wheel = /** @type {HTMLElement | null} */ (row?.parentElement || null);
    if (row && wheel && !wheel.dataset.dragged) {
      delete wheel.dataset.touched;
      pickWheel(wheel.dataset.wheel || "", Number(row.dataset.row));
      return;
    }
    const button = event.target instanceof Element ? /** @type {HTMLElement | null} */ (event.target.closest("button")) : null;
    if (!button || button.getAttribute("aria-disabled") === "true") return;
    const data = button.dataset;
    if (data.month) {
      state.month = app.calendar.addMonths(state.month, Number(data.month));
      renderPop();
    } else if (data.calday) clickDay(data.calday);
    else if (data.pick) {
      if (data.pick === "backlog") setDate("");
      else setDate(data.pick === "today" ? today() : app.calendar.addDays(today(), 1));
      closePop();
    } else if (data.time === "end") {
      state.endTime = "";
      syncTime("eh", true);
    } else if (data.time !== undefined) {
      state.startTime = state.endTime = "";
      closePop();
    } else if (data.repeat !== undefined) {
      setRepeat(data.repeat);
      render();
    } else if (data.monthly) {
      setRepeat(data.monthly);
      render();
    } else if (data.weekday) {
      const day = app.recurrence.weekdays[Number(data.weekday)];
      state.repeatTouched = true;
      state.weekdays = state.weekdays.includes(day) ? state.weekdays.filter(item => item !== day) : [...state.weekdays, day];
      render();
    } else if (data.tag !== undefined) {
      state.tag = data.tag;
      closePop();
    } else if (data.place) {
      state.location = data.place;
      closePop();
    }
  });

  pop.addEventListener("input", event => {
    const input = event.target;
    if (input instanceof HTMLTextAreaElement) {
      state.note = input.value;
      renderTokens();
    } else if (input instanceof HTMLInputElement && input.id === "dialogTimeInput") {
      // A digit typed right after a complete start begins the end: “09:30” and “1” become “09:30 – 1”.
      const typed = /^(\d{1,2}:\d{2})\s*(\d)$/.exec(input.value);
      if (typed && input.selectionStart === input.value.length) input.value = `${typed[1]} – ${typed[2]}`;
      const result = readTime(input.value);
      if (input.value.trim() && typeof result !== "string") {
        [state.startTime, state.endTime] = result;
        renderTokens();
        placeWheels(true);
      }
    } else if (input instanceof HTMLInputElement && input.id === "dialogLocationInput") {
      state.location = input.value;
      /** @type {HTMLElement} */ (pop.querySelector("#dialogPlaces")).innerHTML = locationList(input.value);
      renderTokens();
    }
  });

  pop.addEventListener("change", event => {
    const input = event.target;
    if (input instanceof HTMLInputElement && input.id === "dialogInterval" && typedInterval(input)) render();
  });

  // The wheels: scrolling, the mouse wheel, touch and dragging turn them; where a turn by the user stops, its row is taken.
  // Scroll events do not bubble, so they are caught on the way down.
  /** @type {Set<HTMLElement>} */
  const paintPending = new Set();
  pop.addEventListener("scroll", event => {
    const wheel = event.target;
    if (!(wheel instanceof HTMLElement) || !wheel.classList.contains("dlg__wheel")) return;
    if (!paintPending.size) requestAnimationFrame(() => { paintPending.forEach(paintWheel); paintPending.clear(); });
    paintPending.add(wheel);
  }, true);
  pop.addEventListener("scrollend", event => {
    const wheel = event.target;
    if (!(wheel instanceof HTMLElement) || !wheel.dataset.touched || wheel.dataset.dragging) return;
    delete wheel.dataset.touched;
    wheel.dataset.row = String(Math.round(wheel.scrollTop / wheelRow));
    pickWheel(wheel.dataset.wheel || "", Number(wheel.dataset.row));
  }, true);
  /** @param {Event} event */
  const touch = event => {
    const wheel = event.target instanceof Element ? /** @type {HTMLElement | null} */ (event.target.closest(".dlg__wheel")) : null;
    if (wheel) wheel.dataset.touched = "1";
  };
  pop.addEventListener("touchstart", touch, { passive: true });
  // The mouse wheel turns a wheel by one row per notch; a trackpad's small steps add up to rows.
  let wheelSum = 0;
  pop.addEventListener("wheel", event => {
    const wheel = event.target instanceof Element ? /** @type {HTMLElement | null} */ (event.target.closest(".dlg__wheel")) : null;
    if (!wheel) return;
    event.preventDefault();
    wheelSum += event.deltaMode || Math.abs(event.deltaY) >= 50 ? Math.sign(event.deltaY) * wheelRow : event.deltaY;
    const steps = Math.trunc(wheelSum / wheelRow);
    if (!steps) return;
    wheelSum -= steps * wheelRow;
    const key = wheel.dataset.wheel || "";
    const row = Math.max(0, Math.min(wheelValues[key].length - 1, wheelAt(wheel) + steps));
    delete wheel.dataset.touched;
    turnWheel(wheel, row, true);
    pickWheel(key, row);
  }, { passive: false });
  // A mouse drags a wheel like a finger: free while held, then it glides to the nearest row.
  /** @type {{wheel: HTMLElement, y: number, top: number} | null} */
  let wheelDrag = null;
  pop.addEventListener("pointerdown", event => {
    const wheel = event.target instanceof Element ? /** @type {HTMLElement | null} */ (event.target.closest(".dlg__wheel")) : null;
    if (!wheel || event.pointerType !== "mouse" || event.button !== 0) return;
    wheelDrag = { wheel, y: event.clientY, top: wheel.scrollTop };
    delete wheel.dataset.dragged;
  });
  pop.addEventListener("pointermove", event => {
    if (!wheelDrag) return;
    // Released elsewhere before the drag began: the press is over.
    if (!(event.buttons & 1)) {
      wheelDrag = null;
      return;
    }
    const { wheel } = wheelDrag;
    if (!wheel.dataset.dragging && Math.abs(event.clientY - wheelDrag.y) < 4) return;
    if (!wheel.dataset.dragging) {
      wheel.dataset.dragging = wheel.dataset.dragged = wheel.dataset.touched = "1";
      wheel.style.scrollSnapType = "none";
      wheel.setPointerCapture(event.pointerId);
    }
    wheel.scrollTop = wheelDrag.top - (event.clientY - wheelDrag.y);
  });
  pop.addEventListener("pointerup", () => {
    if (!wheelDrag) return;
    const { wheel } = wheelDrag;
    wheelDrag = null;
    if (!wheel.dataset.dragging) return;
    delete wheel.dataset.dragging;
    wheel.style.scrollSnapType = "";
    const row = Math.round(wheel.scrollTop / wheelRow);
    // Already on a row there is no scroll to end, so the row is taken at once.
    if (Math.abs(wheel.scrollTop - row * wheelRow) < 1) {
      delete wheel.dataset.touched;
      pickWheel(wheel.dataset.wheel || "", row);
    } else turnWheel(wheel, row, true);
  });
  // The arrow keys turn a focused wheel by one row.
  pop.addEventListener("keydown", event => {
    const wheel = event.target;
    if (!(wheel instanceof HTMLElement) || !wheel.classList.contains("dlg__wheel") || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
    event.preventDefault();
    const key = wheel.dataset.wheel || "";
    const row = Math.max(0, Math.min(wheelValues[key].length - 1, wheelAt(wheel) + (event.key === "ArrowDown" ? 1 : -1)));
    delete wheel.dataset.touched;
    turnWheel(wheel, row, true);
    pickWheel(key, row, false);
  });

  /**
   * Tab and Shift+Tab step through title, tokens and Apply. A token opens its popover; what the popover being left holds
   * is kept, and an invalid typed value keeps the focus where it is. Past Apply the focus moves on as usual.
   * @param {KeyboardEvent} event
   */
  function tab(event) {
    // In the date field Tab first walks day, month and year.
    if (event.target instanceof HTMLInputElement && event.target.id === "dialogDateInput" && stepSegment(event.target, event.shiftKey ? -1 : 1)) {
      event.preventDefault();
      return;
    }
    const stops = /** @type {HTMLElement[]} */ ([title, ...tokens.querySelectorAll('[data-pop]:not([aria-disabled="true"])'), apply]);
    const target = /** @type {HTMLElement} */ (event.target);
    const index = state.open && pop.contains(target) ? stops.findIndex(stop => stop.dataset.pop === state.open) : stops.indexOf(target);
    const next = stops[index + (event.shiftKey ? -1 : 1)];
    if (index < 0 || !next || (target === apply && !event.shiftKey)) return;
    event.preventDefault();
    if (!commitPop()) return;
    if (next.dataset.pop) {
      showPop(next.dataset.pop);
      return;
    }
    state.open = "";
    render();
    (next === apply && apply.disabled ? title : next).focus();
  }

  /** Arrow keys move between the choices of a popover; up and down move by weeks in its calendar. @param {KeyboardEvent} event */
  function arrow(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !pop.contains(target) || target.classList.contains("dlg__wheel")) return;
    // From a field only down leads into the choices; the other arrows move the caret.
    if (!(target instanceof HTMLButtonElement) && (event.key !== "ArrowDown" || target instanceof HTMLTextAreaElement)) return;
    const choices = /** @type {HTMLElement[]} */ ([...pop.querySelectorAll("button:not(:disabled)")]);
    const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
    const step = target.dataset.calday && (event.key === "ArrowUp" || event.key === "ArrowDown") ? 7 : 1;
    const next = target instanceof HTMLButtonElement ? choices[choices.indexOf(target) + (forward ? step : -step)] : choices[0];
    if (!next) return;
    event.preventDefault();
    next.focus();
  }

  /**
   * Shift+Enter on a note line that starts with “-” continues the list with “- ” on the next line; on a line that is only
   * the dash it removes the dash and ends the list. Returns false for any other line, which simply breaks.
   * @param {HTMLTextAreaElement} area
   */
  function continueList(area) {
    const at = area.selectionStart;
    const lineStart = area.value.lastIndexOf("\n", at - 1) + 1;
    const line = area.value.slice(lineStart, at);
    const dash = /^(\s*)-\s*/.exec(line);
    if (!dash) return false;
    if (dash[0] === line) area.setRangeText("", lineStart, area.selectionEnd, "end");
    else area.setRangeText(`\n${dash[1]}- `, at, area.selectionEnd, "end");
    area.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }

  // Enter applies from everywhere, also from a popover, and takes what it holds first. Shift+Enter starts a new line of
  // the note; in the footer Enter presses its button.
  dialog.addEventListener("keydown", event => {
    if (event.key === "Tab") tab(event);
    else if (event.key.startsWith("Arrow")) arrow(event);
    else if (event.key === "Enter" && event.shiftKey && event.target instanceof HTMLTextAreaElement) {
      if (continueList(event.target)) event.preventDefault();
    } else if (event.key === "Enter" && !event.isComposing && !(event.target instanceof Node && actions.contains(event.target))) {
      event.preventDefault();
      if (commitPop()) form.requestSubmit();
    }
  });

  // A press outside the popover and its token closes the popover and keeps what it holds.
  form.addEventListener("pointerdown", event => {
    if (!state.open || !(event.target instanceof Node) || pop.contains(event.target)) return;
    const owner = event.target instanceof Element ? event.target.closest("[data-pop]") : null;
    if (!owner) closePop(true);
  });

  actions.addEventListener("click", event => {
    const button = event.target instanceof Element ? /** @type {HTMLElement | null} */ (event.target.closest("button")) : null;
    const current = handlers;
    if (!button || !current) return;
    if (button.hasAttribute("data-menu")) {
      // The three choices of a series, once asked for.
      actions.innerHTML = `<button class="btn btn--danger" type="button" data-action="deleteOccurrence">This occurrence</button>` +
        `<button class="btn btn--danger" type="button" data-action="remove">Whole series</button>` +
        `<button class="btn btn--ghost" type="button" data-action="endSeries">End series here</button>`;
      /** @type {HTMLElement} */ (actions.firstElementChild).focus();
      return;
    }
    const action = /** @type {"remove" | "deleteOccurrence" | "endSeries" | undefined} */ (button.dataset.action);
    if (!action) return;
    close();
    current[action]();
  });

  form.addEventListener("submit", event => {
    event.preventDefault();
    const current = handlers;
    const result = current ? collect() : null;
    if (!current || !result) return;
    close();
    current.apply(result);
  });

  dialog.addEventListener("click", event => {
    // The dialog has no padding, so a click on the dialog element itself is a click on the backdrop.
    if (event.target === dialog) close();
  });
  // Escape closes an open popover first, then the dialog. It is handled on the key itself: Chrome lets a page cancel the
  // dialog's close request only now and then, so a third Escape would close the whole dialog.
  dialog.addEventListener("keydown", event => {
    if (event.key !== "Escape" || !state.open) return;
    event.preventDefault();
    event.stopPropagation();
    closePop();
  }, true);
  dialog.addEventListener("cancel", event => {
    if (!state.open) return;
    event.preventDefault();
    closePop();
  });
  dialog.addEventListener("close", () => {
    dropNotices();
    state.open = "";
    pop.hidden = true;
    handlers = null;
    request = null;
  });

  app.dialog = { open, close, isOpen: () => dialog.open };
})(window.MDCalendar);
