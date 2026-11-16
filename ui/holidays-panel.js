
import { popover, segmented } from "@zang3th/md-libs/ui";

window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Holiday overview: a floating panel below its header button with three tabs for one year: own vacations,
// holidays and school vacations (docs/ui/Views.md#holiday-overview).
(function (app) {
  const button = /** @type {HTMLButtonElement} */ (document.getElementById("holidaysButton"));
  const panel = /** @type {HTMLElement} */ (document.getElementById("holidaysPanel"));
  const yearLabel = /** @type {HTMLElement} */ (document.getElementById("holidaysYear"));
  const content = /** @type {HTMLElement} */ (document.getElementById("holidaysContent"));
  const thumb = /** @type {HTMLElement} */ (document.getElementById("holidaysThumb"));
  const tabs = /** @type {HTMLButtonElement[]} */ (Array.from(panel.querySelectorAll("[role=tab]")));
  /** The open tab; it stays selected when the panel opens again. @type {"vacation" | "holidays" | "school"} */
  let tab = "vacation";
  const floating = popover.create({
    window, element: panel, button, dismiss: "pointerdown",
    onClose: reason => { if (reason === "escape") button.focus(); }
  });
  /** @type {MDCHolidays} */
  let data = { holidays: [], vacations: [] };
  let today = "";
  let year = 0;
  /** Own vacations of a year: entries and multi-day entries with the tag “Vacation”. @type {(year: number) => MDCPeriod[]} */
  let personal = () => [];

  /** @param {string} key */
  function short(key) {
    return app.calendar.formatDay(key, "DD.MM.");
  }

  /** @param {string} key */
  const pastClass = key => key < today ? " is-past" : "";

  /** @param {string} start @param {string} end */
  const range = (start, end) => start === end ? short(start) : `${short(start)} – ${short(end)}`;

  /** @param {string} text */
  const empty = text => `<li class="hp__empty">${text}</li>`;

  function rows() {
    const prefix = String(year);
    const escape = app.tiles.escape;
    if (tab === "holidays") {
      const holidays = data.holidays.filter(holiday => holiday.date.startsWith(prefix));
      return holidays.map(holiday =>
        `<li class="hp__row${pastClass(holiday.date)}"><span class="hp__date">${short(holiday.date)}</span>` +
        `<span class="hp__day">${app.calendar.formatDay(holiday.date, "dd")}</span><span class="hp__name">${escape(holiday.name)}</span></li>`).join("")
        || empty(data.holidays.length ? `No holidays in ${year}.` : "No Holidays.md in the folder.");
    }
    if (tab === "school") {
      const vacations = data.vacations.filter(vacation => vacation.start.startsWith(prefix) || vacation.end.startsWith(prefix));
      return vacations.map(vacation =>
        `<li class="hp__row${pastClass(vacation.end)}"><span class="hp__date hp__date--range">${range(vacation.start, vacation.end)}</span>` +
        `<span class="hp__name">${escape(vacation.name)}</span></li>`).join("")
        || empty(data.vacations.length ? `No school vacations in ${year}.` : "No Holidays.md in the folder.");
    }
    return personal(year).map(item =>
      `<li class="hp__row${pastClass(item.end)}"><span class="hp__date hp__date--range">${range(item.start, item.end)}</span>` +
      `<span class="hp__name">${escape(item.title)}</span></li>`).join("")
      || empty(`No vacation in ${year}.`);
  }

  function fill() {
    yearLabel.textContent = String(year);
    const selected = tabs.findIndex(button => button.dataset.tab === tab);
    segmented.select({ buttons: tabs, selected, thumb, attribute: "aria-selected" });
    content.setAttribute("aria-labelledby", tabs[selected].id);
    content.innerHTML = `<ul class="hp__list">${rows()}</ul>`;
    content.scrollTop = 0;
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
    const target = event.target instanceof Element ? event.target.closest("[data-year], [data-tab]") : null;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.tab) tab = /** @type {typeof tab} */ (target.dataset.tab);
    else year += Number(target.dataset.year);
    fill();
  });
  window.addEventListener("resize", () => setOpen(false));

  app.holidaysPanel = { update, toggle, isOpen: () => !panel.hidden };
})(window.MDCalendar);
