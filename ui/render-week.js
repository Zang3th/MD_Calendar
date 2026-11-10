window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Week view, landscape and portrait (docs/ui/Views.md). The layout per orientation lives in styles.css.
(function (app) {
  const board = /** @type {HTMLElement} */ (document.getElementById("week"));
  const portrait = matchMedia("(orientation: portrait)");
  const bars = document.createElement("div");
  bars.className = "wk__bars";
  /** @type {string[]} */
  let shownDays = [];
  /** @type {Map<string, HTMLElement>} */
  const sections = new Map();

  /** @param {HTMLElement} section @param {MDCCalendar} calendar @param {string} key @param {string} today */
  function fill(section, calendar, key, today) {
    section.classList.toggle("is-today", key === today);
    section.classList.toggle("is-past", key < today);
    /** @type {HTMLElement} */ (section.querySelector(".day__list")).innerHTML = app.tiles.dayTiles(calendar, key, today).html;
    // Badge maximum: 3 in the landscape week, 5 in the portrait week (docs/ui/Views.md#day-header).
    /** @type {HTMLElement} */ (section.querySelector(".day__badges")).innerHTML = app.tiles.badges(key, portrait.matches ? 5 : 3);
  }

  /** @param {string} key */
  function section(key) {
    const day = dayjs(key);
    const element = document.createElement("section");
    element.className = "day";
    element.dataset.day = key;
    element.setAttribute("aria-label", day.format("dddd, D. MMMM YYYY"));
    element.innerHTML = `<header class="day__head"><span class="day__dow">${day.format("dddd")}</span><span class="day__num">${day.format("D")}</span><span class="day__badges"></span></header>` +
      `<div class="day__spacer"></div><div class="day__list" data-day="${key}"></div>` +
      `<button class="day__add" type="button" data-add="${key}" aria-label="Neuer Eintrag am ${day.format("D. MMMM")}" data-tooltip="Neuer Eintrag am ${day.format("D. MMMM")}">` +
      `${app.tiles.icon("plus")}<span>Eintrag</span></button>`;
    return element;
  }

  /**
   * Shows the week of `anchor`. Returns true when the day lists were rebuilt.
   * @param {MDCCalendar} calendar @param {string} anchor @param {string} today
   */
  function render(calendar, anchor, today) {
    const days = app.calendar.weekDays(anchor);
    const rebuilt = days[0] !== shownDays[0] || !board.contains(bars);
    if (rebuilt) {
      shownDays = days;
      sections.clear();
      const fragment = document.createDocumentFragment();
      fragment.append(bars);
      for (const key of days) {
        const element = section(key);
        sections.set(key, element);
        fragment.append(element);
      }
      board.replaceChildren(fragment);
    }
    const layout = app.calendar.segments(calendar, days[0], 7);
    board.style.setProperty("--lanes", String(layout.lanes));
    bars.innerHTML = layout.segments.map(segment => app.tiles.bar(segment, today, true)).join("");
    for (const key of days) fill(/** @type {HTMLElement} */ (sections.get(key)), calendar, key, today);
    board.hidden = false;
    return rebuilt;
  }

  /** Updates only the given days, if they are visible. @param {MDCCalendar} calendar @param {string[]} keys @param {string} today */
  function renderDays(calendar, keys, today) {
    for (const key of keys) {
      const element = sections.get(key);
      if (element) fill(element, calendar, key, today);
    }
  }

  function lists() {
    return /** @type {HTMLElement[]} */ (Array.from(board.querySelectorAll(".day__list")));
  }

  /** @param {string} key */
  function cell(key) {
    return sections.get(key) || null;
  }

  function hide() {
    shownDays = [];
    sections.clear();
    board.replaceChildren();
    board.hidden = true;
  }

  app.week = { render, renderDays, lists, cell, hide };
})(window.MDCalendar);
