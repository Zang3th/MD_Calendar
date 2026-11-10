window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Holiday overview: a floating panel below its header button with the holidays and school vacations of one year
// (docs/ui/Views.md#holiday-overview).
(function (app) {
  const button = /** @type {HTMLButtonElement} */ (document.getElementById("holidaysButton"));
  const panel = /** @type {HTMLElement} */ (document.getElementById("holidaysPanel"));
  const yearLabel = /** @type {HTMLElement} */ (document.getElementById("holidaysYear"));
  const content = /** @type {HTMLElement} */ (document.getElementById("holidaysContent"));
  /** @type {MDCHolidays} */
  let data = { holidays: [], vacations: [] };
  let today = "";
  let year = 0;

  /** @param {string} key */
  function short(key) {
    return dayjs(key).format("DD.MM.");
  }

  function fill() {
    yearLabel.textContent = String(year);
    const prefix = String(year);
    const holidays = data.holidays.filter(holiday => holiday.date.startsWith(prefix));
    const vacations = data.vacations.filter(vacation => vacation.start.startsWith(prefix) || vacation.end.startsWith(prefix));
    const escape = app.tiles.escape;
    const holidayRows = holidays.map(holiday =>
      `<li class="hp__row${holiday.date < today ? " is-past" : ""}"><span class="hp__date">${short(holiday.date)}</span>` +
      `<span class="hp__day">${dayjs(holiday.date).format("dd")}</span><span class="hp__name">${escape(holiday.name)}</span></li>`).join("");
    const vacationRows = vacations.map(vacation =>
      `<li class="hp__row${vacation.end < today ? " is-past" : ""}"><span class="hp__date hp__date--range">${short(vacation.start)} – ${short(vacation.end)}</span>` +
      `<span class="hp__name">${escape(vacation.name)}</span></li>`).join("");
    const empty = (/** @type {string} */ text) => `<li class="hp__empty">${text}</li>`;
    content.innerHTML =
      `<h3 class="hp__title">Feiertage</h3><ul class="hp__list">${holidayRows || empty(data.holidays.length ? `Keine Feiertage für ${year}.` : "Keine Holidays.md im Ordner.")}</ul>` +
      `<h3 class="hp__title">Schulferien</h3><ul class="hp__list">${vacationRows || empty(`Keine Schulferien für ${year}.`)}</ul>`;
  }

  /** @param {boolean} open */
  function setOpen(open) {
    panel.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    if (!open) return;
    // One layout read to place the panel below its button, then writes only.
    const bounds = button.getBoundingClientRect();
    panel.style.top = `${Math.round(bounds.bottom + 10)}px`;
    panel.style.right = `${Math.round(window.innerWidth - bounds.right)}px`;
  }

  /** @param {MDCHolidays} holidays @param {string} currentDay */
  function update(holidays, currentDay) {
    data = holidays;
    today = currentDay;
    if (!panel.hidden) fill();
  }

  /** @param {MDCHolidays} holidays @param {string} currentDay */
  function toggle(holidays, currentDay) {
    if (!panel.hidden) {
      setOpen(false);
      return;
    }
    data = holidays;
    today = currentDay;
    year = Number(currentDay.slice(0, 4));
    fill();
    setOpen(true);
  }

  panel.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target.closest("[data-year]") : null;
    if (!(target instanceof HTMLElement)) return;
    year += Number(target.dataset.year);
    fill();
  });
  document.addEventListener("pointerdown", event => {
    if (panel.hidden || !(event.target instanceof Node) || panel.contains(event.target) || button.contains(event.target)) return;
    setOpen(false);
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !panel.hidden) {
      setOpen(false);
      button.focus();
    }
  });
  window.addEventListener("resize", () => setOpen(false));

  app.holidaysPanel = { update, toggle, isOpen: () => !panel.hidden };
})(window.MDCalendar);
