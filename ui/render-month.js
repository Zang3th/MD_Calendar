window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Month view (docs/ui/Views.md#month): week rows with ISO week numbers, compact day lists, „+N“ and multi-day bars.
(function (app) {
  const board = /** @type {HTMLElement} */ (document.getElementById("month"));
  const portrait = matchMedia("(orientation: portrait)");
  // Heights from styles.css (.month): cell header, bar lane, entry tile, gap, „+N“ chip, cell bottom padding.
  const sizes = { head: 32, lane: 22, entry: 22, gap: 4, more: 24, padding: 6 };
  /** @type {{calendar: MDCCalendar, today: string} | null} */
  let shown = null;
  let cellHeight = 0;
  let resizeFrame = 0;
  /** @type {string} */
  let shownMonth = "";
  /** @type {Map<string, HTMLElement>} */
  const cells = new Map();
  let shownLimit = 0;

  function limit() {
    return portrait.matches ? 4 : 3;
  }

  /**
   * Entries that fit into a cell next to its bar lanes, at most 3 (landscape) or 4 (portrait).
   * Returns the number to show when all fit, and the number to show next to „+N“ otherwise.
   * @param {number} lanes
   */
  function capacity(lanes) {
    const room = cellHeight - sizes.head - sizes.padding - lanes * sizes.lane;
    const fit = Math.max(0, Math.floor((room + sizes.gap) / (sizes.entry + sizes.gap)));
    const all = Math.min(shownLimit, fit);
    const withMore = Math.max(0, Math.min(shownLimit, Math.floor((room - sizes.more + sizes.gap) / (sizes.entry + sizes.gap))));
    return { all, withMore };
  }

  /** @param {HTMLElement} cell @param {MDCCalendar} calendar @param {string} key @param {string} today */
  function fill(cell, calendar, key, today) {
    cell.classList.toggle("is-today", key === today);
    cell.classList.toggle("is-past", key < today);
    const room = capacity(Number(cell.parentElement?.style.getPropertyValue("--lanes")) || 0);
    const total = app.recurrence.occurrences(calendar, key).length + app.calendar.entries(calendar, key).length;
    const { html, hidden } = app.tiles.dayTiles(calendar, key, today, { limit: total <= room.all ? room.all : room.withMore, compact: true });
    /** @type {HTMLElement} */ (cell.querySelector(".mcell__list")).innerHTML = html;
    /** @type {HTMLElement} */ (cell.querySelector(".mcell__badges")).innerHTML = app.tiles.badges(key, 1);
    const more = /** @type {HTMLButtonElement} */ (cell.querySelector(".more"));
    more.hidden = !hidden;
    more.textContent = `+${hidden}`;
    more.setAttribute("aria-label", `${hidden} weitere Einträge, Woche öffnen`);
  }

  /** @param {string} key @param {string} month */
  function cellMarkup(key, month) {
    const day = dayjs(key);
    const other = key.slice(0, 7) !== month;
    const number = key.endsWith("-01") ? day.format("D. MMM") : day.format("D");
    return `<div class="mcell${other ? " is-other" : ""}" data-day="${key}" aria-label="${day.format("dddd, D. MMMM YYYY")}">` +
      `<div class="mcell__head"><span class="mcell__num">${number}</span><span class="mcell__badges"></span></div><div class="mcell__spacer"></div>` +
      `<div class="mcell__list day__list" data-day="${key}"></div>` +
      `<button class="more" type="button" data-more="${key}" hidden></button></div>`;
  }

  /**
   * Shows the month of `anchor`. Returns true when the day lists were rebuilt.
   * @param {MDCCalendar} calendar @param {string} anchor @param {string} today
   */
  function render(calendar, anchor, today) {
    const month = anchor.slice(0, 7);
    const first = `${month}-01`;
    /** @type {string[]} */
    const weeks = [];
    for (let start = app.calendar.weekStart(first); start.slice(0, 7) <= month || start < first; start = app.calendar.addDays(start, 7)) weeks.push(start);
    const rebuilt = month !== shownMonth || shownLimit !== limit();
    shownLimit = limit();
    const currentWeek = app.calendar.weekStart(today);
    const rows = weeks.map(start => {
      const layout = app.calendar.segments(calendar, start, 7);
      const days = app.calendar.weekDays(start);
      return `<div class="mweek${start === currentWeek ? " is-current" : ""}">` +
        `<span class="mweek__kw" data-tooltip="Kalenderwoche ${app.calendar.isoWeek(start)}">${app.calendar.isoWeek(start)}</span>` +
        `<div class="mrow" style="--lanes:${layout.lanes}"><div class="wk__bars">${layout.segments.map(segment => app.tiles.bar(segment, today, false)).join("")}</div>` +
        `${days.map(key => cellMarkup(key, month)).join("")}</div></div>`;
    }).join("");
    if (rebuilt) {
      shownMonth = month;
      const names = app.calendar.weekDays(first).map(key => `<span>${dayjs(key).format("dddd")}</span>`).join("");
      board.innerHTML = `<div class="mweek mweek--head"><span></span><div class="mhead">${names}</div></div><div class="mbody" style="--rows:${weeks.length}">${rows}</div>`;
    } else {
      // Same month: rows are rebuilt for the bars, the day lists are refilled below.
      const body = /** @type {HTMLElement} */ (board.querySelector(".mbody"));
      const lists = new Map(Array.from(board.querySelectorAll(".mcell"), cell => [/** @type {HTMLElement} */ (cell).dataset.day, cell.querySelector(".mcell__list")]));
      body.innerHTML = rows;
      for (const cell of body.querySelectorAll(".mcell")) {
        const list = lists.get(/** @type {HTMLElement} */ (cell).dataset.day);
        if (list) cell.querySelector(".mcell__list")?.replaceWith(list);
      }
    }
    cells.clear();
    for (const cell of board.querySelectorAll(".mcell")) cells.set(/** @type {HTMLElement} */ (cell).dataset.day || "", /** @type {HTMLElement} */ (cell));
    board.hidden = false;
    shown = { calendar, today };
    // One layout read for all cells, then only writes.
    cellHeight = /** @type {HTMLElement} */ (board.querySelector(".mcell")).clientHeight;
    for (const [key, cell] of cells) fill(cell, calendar, key, today);
    return rebuilt;
  }

  /** @param {MDCCalendar} calendar @param {string[]} keys @param {string} today */
  function renderDays(calendar, keys, today) {
    for (const key of keys) {
      const cell = cells.get(key);
      if (cell) fill(cell, calendar, key, today);
    }
  }

  function lists() {
    return /** @type {HTMLElement[]} */ (Array.from(board.querySelectorAll(".mcell__list")));
  }

  /** @param {string} key */
  function cell(key) {
    return cells.get(key) || null;
  }

  window.addEventListener("resize", () => {
    if (resizeFrame || !shown) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      if (!shown || board.hidden) return;
      const height = /** @type {HTMLElement | null} */ (board.querySelector(".mcell"))?.clientHeight || 0;
      if (height === cellHeight && shownLimit === limit()) return;
      cellHeight = height;
      shownLimit = limit();
      for (const [key, cell] of cells) fill(cell, shown.calendar, key, shown.today);
    });
  });

  function hide() {
    shown = null;
    shownMonth = "";
    cells.clear();
    board.replaceChildren();
    board.hidden = true;
  }

  app.month = { render, renderDays, lists, cell, hide };
})(window.MDCalendar);
