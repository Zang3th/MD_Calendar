
import { popover, segmented } from "@zang3th/md-libs/ui";

window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Holiday overview: a floating panel below its header button with three tabs for one year: own vacations and days off,
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
  /**
   * Own vacations and days off of a year: entries and multi-day entries with the tag “Vacation” or “DayOff”, the days off
   * marked. @type {(year: number) => MDCPeriod[]}
   */
  let personal = () => [];

  /** DD.MM.YY @param {string} key */
  function short(key) {
    return app.calendar.formatDay(key, "DD.MM.") + key.slice(2, 4);
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
        `<li class="hp__row${pastClass(holiday.date)}" data-from="${holiday.date}" data-to="${holiday.date}"><span class="hp__date">${short(holiday.date)}</span>` +
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
    // A period within another one is listed below it, indented. A mark before the date tells them apart: a day off shows
    // the clock in the day-off color, a vacation the icon and color of its tag from Config.md (docs/ui/Views.md#holiday-overview).
    const vacation = app.tiles.tint(app.calendar.vacationTag);
    const vacationIcon = app.tiles.tagIcon(app.calendar.vacationTag, "") || `<svg class="ui-icon" aria-hidden="true" viewBox="0 0 32 32"><use href="#tag-vacation"></use></svg>`;
    return app.calendar.nestPeriods(personal(year)).map(({ period: item, depth }) => {
      // A vacation within another one needs no mark of its own: the guide line joins it to its vacation.
      const bare = depth > 0 && !item.dayOff;
      const kind = item.dayOff
        ? `<span class="hp__kind" role="img" aria-label="Day off">${app.tiles.icon("clock")}</span>`
        : bare ? "" : `<span class="hp__kind" role="img" aria-label="Vacation">${vacationIcon}</span>`;
      const classes = `hp__row hp__row--${item.dayOff ? "dayoff" : `vacation${vacation.className}`}${depth ? " hp__row--sub" : ""}${bare ? " hp__row--bare" : ""}${pastClass(item.end)}`;
      const style = [depth ? `--depth:${depth}` : "", !item.dayOff && vacation.hue !== null ? `--h:${vacation.hue}` : ""].filter(Boolean).join(";");
      const span = item.dayOff ? ` data-from="${item.start}" data-to="${item.end}"` : "";
      return `<li class="${classes}"${span}${style ? ` style="${style}"` : ""}>${kind}` +
        // A single day shows its weekday behind the date, within the width of a range.
        `<span class="hp__date hp__date--range">${range(item.start, item.end)}${item.start === item.end ? `<span class="hp__weekday">${app.calendar.formatDay(item.start, "dd")}</span>` : ""}</span>` +
        `<span class="hp__name">${escape(item.title)}</span></li>`;
    }).join("") || empty(`No vacation in ${year}.`);
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

  /** @param {MDCHolidays} holidays @param {string} currentDay @param {typeof personal} periods */
  function toggle(holidays, currentDay, periods) {
    personal = periods;
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

  /**
   * Opens the overview on a tab, from a holiday or day-off badge, and lights up the rows of that day: its holidays or its
   * day off (docs/ui/Views.md#day-header).
   * @param {MDCHolidays} holidays @param {string} currentDay @param {typeof personal} periods @param {"vacation" | "holidays"} shownTab @param {string} day
   */
  function show(holidays, currentDay, periods, shownTab, day) {
    personal = periods;
    data = holidays;
    today = currentDay;
    year = Number(day.slice(0, 4));
    tab = shownTab;
    fill();
    setOpen(true);
    for (const row of /** @type {NodeListOf<HTMLElement>} */ (content.querySelectorAll("[data-from]"))) {
      if ((row.dataset.from || "") <= day && day <= (row.dataset.to || "")) app.tiles.highlight(row);
    }
  }

  panel.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target.closest("[data-year], [data-tab]") : null;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.tab) tab = /** @type {typeof tab} */ (target.dataset.tab);
    else year += Number(target.dataset.year);
    fill();
  });
  window.addEventListener("resize", () => setOpen(false));

  app.holidaysPanel = { update, toggle, show, isOpen: () => !panel.hidden };
})(window.MDCalendar);
