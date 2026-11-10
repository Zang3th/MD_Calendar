window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Date and time pickers of the entry dialog (docs/ui/Shell.md#entry-dialog). Inputs with data-picker="date" or "time"
// show a small calendar or a list of times below them; typing keeps working. A choice is applied like a typed value.
(function (app) {
  const picker = /** @type {HTMLElement} */ (document.getElementById("picker"));
  const form = /** @type {HTMLElement} */ (picker.parentElement);
  const weekdayNames = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  /** @type {HTMLInputElement | null} */
  let input = null;
  /** First day of the month the date picker shows. */
  let month = "";

  /** @param {string} value */
  function apply(value) {
    if (!input) return;
    input.value = value;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    hide();
  }

  function renderDate() {
    if (!input) return;
    const selected = app.calendar.parseDate(input.value);
    const today = app.calendar.todayKey(new Date());
    const start = app.calendar.weekStart(month);
    const cells = Array.from({ length: 42 }, (_, index) => app.calendar.addDays(start, index));
    picker.innerHTML = `<div class="picker__head"><button class="iconbtn" type="button" data-month="-1" aria-label="Vorheriger Monat">${app.tiles.icon("chevron-left")}</button>` +
      `<b>${dayjs(month).format("MMMM YYYY")}</b><button class="iconbtn" type="button" data-month="1" aria-label="Nächster Monat">${app.tiles.icon("chevron-right")}</button></div>` +
      `<div class="picker__grid" role="grid">${weekdayNames.map(name => `<span class="picker__dow">${name}</span>`).join("")}` +
      cells.map(key => `<button type="button" class="picker__day${key.slice(0, 7) !== month.slice(0, 7) ? " is-other" : ""}${key === today ? " is-today" : ""}" ` +
        `data-date="${key}" aria-pressed="${key === selected}" aria-label="${dayjs(key).format("dddd, D. MMMM YYYY")}">${Number(key.slice(8))}</button>`).join("") + `</div>`;
  }

  function renderTime() {
    if (!input) return;
    const current = app.calendar.parseTime(input.value);
    const start = /** @type {HTMLInputElement | null} */ (document.getElementById("dialogStart"));
    const anchor = current || (input.id === "dialogEnd" && start && app.calendar.parseTime(start.value)) || "08:00";
    const times = Array.from({ length: 96 }, (_, index) => `${String(Math.floor(index / 4)).padStart(2, "0")}:${String(index % 4 * 15).padStart(2, "0")}`);
    picker.innerHTML = `<div class="picker__times" role="listbox" aria-label="Uhrzeit">${times.map(time =>
      `<button type="button" class="picker__time" role="option" data-time="${time}" aria-selected="${time === current}">${time}</button>`).join("")}</div>`;
    const target = times.find(time => time >= anchor) || times[times.length - 1];
    const list = /** @type {HTMLElement} */ (picker.firstElementChild);
    const item = /** @type {HTMLElement} */ (list.querySelector(`[data-time="${target}"]`));
    list.scrollTop = item.offsetTop - list.clientHeight / 2 + item.offsetHeight / 2;
  }

  /** @param {HTMLInputElement} next */
  function show(next) {
    input = next;
    const kind = next.dataset.picker;
    picker.className = `picker picker--${kind}`;
    picker.hidden = false;
    // Layout reads first, then writes.
    const field = next.getBoundingClientRect();
    const host = form.getBoundingClientRect();
    picker.style.left = `${Math.round(Math.min(field.left - host.left, host.width - (kind === "date" ? 264 : 120) - 12))}px`;
    picker.style.top = `${Math.round(field.bottom - host.top + 8)}px`;
    if (kind === "date") {
      month = `${(app.calendar.parseDate(next.value) || app.calendar.todayKey(new Date())).slice(0, 7)}-01`;
      renderDate();
    } else renderTime();
  }

  function hide() {
    picker.hidden = true;
    picker.replaceChildren();
    input = null;
  }

  form.addEventListener("focusin", event => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.dataset.picker) {
      if (target !== input) show(target);
    } else if (!(target instanceof Node && picker.contains(target))) hide();
  });
  form.addEventListener("click", event => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.dataset.picker && picker.hidden) show(target);
  });
  form.addEventListener("input", event => {
    if (event.target === input && input?.dataset.picker === "time" && app.calendar.parseTime(input.value)) renderTime();
  });
  form.addEventListener("keydown", event => {
    if (event.target !== input || !input) return;
    if (event.key === "Escape" && !picker.hidden) {
      event.preventDefault();
      event.stopPropagation();
      hide();
    } else if (event.key === "Tab" || event.key === "Enter") hide();
  });
  // Keeps the focus in the input while the picker is used.
  picker.addEventListener("pointerdown", event => event.preventDefault());
  picker.addEventListener("click", event => {
    const button = event.target instanceof Element ? /** @type {HTMLElement | null} */ (event.target.closest("button")) : null;
    if (!button) return;
    if (button.dataset.month) {
      month = app.calendar.addMonths(month, Number(button.dataset.month));
      renderDate();
    } else if (button.dataset.date) apply(app.calendar.formatDate(button.dataset.date));
    else if (button.dataset.time) apply(button.dataset.time);
  });
  document.addEventListener("pointerdown", event => {
    if (!picker.hidden && event.target instanceof Node && !picker.contains(event.target) && event.target !== input) hide();
  });

  app.pickers = { hide, isOpen: () => !picker.hidden };
})(window.MDCalendar);
