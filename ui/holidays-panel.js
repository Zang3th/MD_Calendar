
import { popover } from "@zang3th/md-libs/ui";

window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Holiday overview: a floating panel below its header button with the holidays and school vacations of one year
// (docs/ui/Views.md#holiday-overview).
(function (app) {
  const button = /** @type {HTMLButtonElement} */ (document.getElementById("holidaysButton"));
  const panel = /** @type {HTMLElement} */ (document.getElementById("holidaysPanel"));
  const yearLabel = /** @type {HTMLElement} */ (document.getElementById("holidaysYear"));
  const content = /** @type {HTMLElement} */ (document.getElementById("holidaysContent"));
  const floating = popover.create({
    window, element: panel, button, dismiss: "pointerdown",
    onClose: reason => { if (reason === "escape") button.focus(); }
  });
  /** @type {MDCHolidays} */
  let data = { holidays: [], vacations: [] };
  let today = "";
  let year = 0;
  /** Own vacations of a year: entries and multi-day entries with the tag „Urlaub“. @type {(year: number) => MDCPeriod[]} */
  let personal = () => [];

  /** @param {string} key */
  function short(key) {
    return app.calendar.formatDay(key, "DD.MM.");
  }

  function fill() {
    yearLabel.textContent = String(year);
    const prefix = String(year);
    const holidays = data.holidays.filter(holiday => holiday.date.startsWith(prefix));
    const vacations = data.vacations.filter(vacation => vacation.start.startsWith(prefix) || vacation.end.startsWith(prefix));
    const escape = app.tiles.escape;
    const holidayRows = holidays.map(holiday =>
      `<li class="hp__row${holiday.date < today ? " is-past" : ""}"><span class="hp__date">${short(holiday.date)}</span>` +
      `<span class="hp__day">${app.calendar.formatDay(holiday.date, "dd")}</span><span class="hp__name">${escape(holiday.name)}</span></li>`).join("");
    const vacationRows = vacations.map(vacation =>
      `<li class="hp__row${vacation.end < today ? " is-past" : ""}"><span class="hp__date hp__date--range">${short(vacation.start)} – ${short(vacation.end)}</span>` +
      `<span class="hp__name">${escape(vacation.name)}</span></li>`).join("");
    const empty = (/** @type {string} */ text) => `<li class="hp__empty">${text}</li>`;
    const own = personal(year);
    const ownRows = own.map(item =>
      `<li class="hp__row${item.end < today ? " is-past" : ""}"><span class="hp__date hp__date--range">${item.start === item.end ? short(item.start) : `${short(item.start)} – ${short(item.end)}`}</span>` +
      `<span class="hp__name">${escape(item.title)}</span></li>`).join("");
    content.innerHTML =
      `<h3 class="hp__title">Feiertage</h3><ul class="hp__list">${holidayRows || empty(data.holidays.length ? `Keine Feiertage für ${year}.` : "Keine Holidays.md im Ordner.")}</ul>` +
      (own.length ? `<h3 class="hp__title">Urlaub</h3><ul class="hp__list hp__list--own">${ownRows}</ul>` : "") +
      `<h3 class="hp__title">Schulferien</h3><ul class="hp__list">${vacationRows || empty(`Keine Schulferien für ${year}.`)}</ul>`;
  }

  /** @param {boolean} open */
  function setOpen(open) {
    if (!open) {
      floating.close();
      return;
    }
    floating.open();
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

  /** @param {MDCHolidays} holidays @param {string} currentDay @param {(year: number) => MDCPeriod[]} vacations */
  function toggle(holidays, currentDay, vacations) {
    personal = vacations;
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
  window.addEventListener("resize", () => setOpen(false));

  app.holidaysPanel = { update, toggle, isOpen: () => !panel.hidden };
})(window.MDCalendar);
