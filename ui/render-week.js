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
    /** @type {HTMLElement} */ (section.querySelector(".day__badges")).innerHTML = app.tiles.badges(key, portrait.matches ? 5 : 2);
  }

  /** @param {string} key */
  function section(key) {
    const element = document.createElement("section");
    element.className = "day";
    element.dataset.day = key;
    element.setAttribute("aria-label", app.calendar.formatDay(key, "dddd, D MMMM YYYY"));
    element.innerHTML = `<header class="day__head"><span class="day__dow">${app.calendar.formatDay(key, "dddd")}</span><span class="day__num">${app.calendar.formatDay(key, "D")}</span><span class="day__badges"></span></header>` +
      `<div class="day__spacer"></div><div class="day__list" data-day="${key}"></div>`;
    return element;
  }

  /**
   * Shows `count` days from `start` (seven, or the wider strip while the days are dragged). Returns true when the day
   * lists were rebuilt.
   * @param {MDCCalendar} calendar @param {string} start @param {string} today @param {number} [count]
   */
  function render(calendar, start, today, count = 7) {
    const days = Array.from({ length: count }, (_, index) => app.calendar.addDays(start, index));
    const rebuilt = days[0] !== shownDays[0] || days.length !== shownDays.length || !board.contains(bars);
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
    board.style.setProperty("--days", String(count));
    const layout = app.calendar.segments(calendar, days[0], count);
    board.style.setProperty("--lanes", String(layout.lanes));
    days.forEach((key, index) => /** @type {HTMLElement} */ (sections.get(key)).style.setProperty("--lanes", String(layout.dayLanes[index])));
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

  // ---------- Dragging the days (docs/ui/Interaction.md#pointer) ----------
  // While dragging, the board shows a strip of three weeks: the shown seven days with one week on each side. The strip
  // follows the pointer along the days' axis (sideways in landscape, where days are columns; up and down in portrait,
  // where they are rows) by a translate of its children; the board clips it along that axis only, so that nothing
  // changes the glass of the bars (no opacity, filter or clip-path). Beyond a week the strip moves on by seven days.

  /**
   * `start` is the first shown day without offset, `offset` the pixels the days stand after it along the axis (right or
   * down), `shift` the pointer pixels already turned into whole weeks of `start`, `column` the size of one day.
   * @type {{calendar: MDCCalendar, today: string, start: string, column: number, offset: number, shift: number} | null}
   */
  let pan = null;

  /** Whether the days are rows (portrait), so that dragging and gliding run vertically. */
  function vertical() {
    return portrait.matches;
  }

  /** @param {number} offset pixels the days moved along the axis since the drag began, relative to `pan.start` */
  function place(offset) {
    if (!pan) return;
    pan.offset = offset;
    board.style.setProperty("--pan", `${Math.round(offset - 7 * pan.column)}px`);
  }

  /** @param {MDCCalendar} calendar @param {string} start first shown day @param {string} today */
  function panBegin(calendar, start, today) {
    const column = daySize();
    if (!column) return false;
    pan = { calendar, today, start, column, offset: 0, shift: 0 };
    board.classList.add("is-panning");
    render(calendar, app.calendar.addDays(start, -7), today, 21);
    place(0);
    return true;
  }

  /**
   * @param {number} x pixels the pointer moved to the right since the drag began
   * @param {number} y pixels it moved down; only the days' axis counts
   */
  function panMove(x, y) {
    if (!pan) return;
    const offset = vertical() ? y : x;
    let relative = offset - pan.shift;
    // Past six days in either direction the strip moves on by a week, so that the drag has no end.
    if (Math.abs(relative) > 6 * pan.column) {
      const weeks = relative > 0 ? -1 : 1;
      pan.start = app.calendar.addDays(pan.start, 7 * weeks);
      pan.shift += -weeks * 7 * pan.column;
      relative = offset - pan.shift;
      render(pan.calendar, app.calendar.addDays(pan.start, -7), pan.today, 21);
    }
    place(relative);
  }

  /**
   * Ends the drag. Returns the first day to show, snapped to the nearest day, and the pixels the days still stand off
   * that place, for `settle`.
   */
  function panEnd() {
    if (!pan) return null;
    const days = Math.round(-pan.offset / pan.column);
    const result = { start: app.calendar.addDays(pan.start, days), rest: pan.offset + days * pan.column };
    pan = null;
    board.classList.remove("is-panning");
    board.style.removeProperty("--pan");
    return result;
  }

  /** Lets the shown days glide the last pixels into place after a drag or a snap. @param {number} rest */
  function settle(rest) {
    if (!rest || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const move = vertical() ? `translateY(${Math.round(rest)}px)` : `translateX(${Math.round(rest)}px)`;
    board.animate([{ transform: move }, { transform: "none" }], { duration: 240, easing: "cubic-bezier(.2,.8,.2,1)" });
  }

  /** The size of one day along the days' axis in pixels: a column's width, or a row's height in portrait. */
  function daySize() {
    const bounds = board.getBoundingClientRect();
    return (vertical() ? bounds.height : bounds.width) / 7;
  }

  app.week = { render, renderDays, lists, cell, hide, panBegin, panMove, panEnd, settle, daySize };
})(window.MDCalendar);
