
window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Month view (docs/ui/Views.md#month): week rows with ISO week numbers, compact day lists, “+N” with the enlarged cell
// and multi-day bars.
(function (app) {
  const board = /** @type {HTMLElement} */ (document.getElementById("month"));
  // Heights from styles.css (.month): cell header, bar lane, entry tile, gap, “+N” chip, cell bottom padding.
  const sizes = { head: 32, lane: 22, entry: 22, gap: 4, more: 24, padding: 6 };
  /** @type {{calendar: MDCCalendar, today: string} | null} */
  let shown = null;
  let cellHeight = 0;
  let resizeFrame = 0;
  /** @type {string} */
  let shownMonth = "";
  /** @type {Map<string, HTMLElement>} */
  const cells = new Map();
  /** Room for entries each cell was last filled for, as "all/withMore". @type {Map<string, string>} */
  const rooms = new Map();
  /** Day whose cell is enlarged to show all its entries, or "". */
  let expanded = "";

  /**
   * Entries that fit into a cell next to its bar lanes.
   * Returns the number to show when all fit, and the number to show next to “+N” otherwise.
   * @param {number} lanes
   */
  function capacity(lanes) {
    const room = cellHeight - sizes.head - sizes.padding - lanes * sizes.lane;
    const all = Math.max(0, Math.floor((room + sizes.gap) / (sizes.entry + sizes.gap)));
    const withMore = Math.max(0, Math.floor((room - sizes.more + sizes.gap) / (sizes.entry + sizes.gap)));
    return { all, withMore };
  }

  /** @param {HTMLElement} cell @param {MDCCalendar} calendar @param {string} key @param {string} today */
  function fill(cell, calendar, key, today) {
    cell.classList.toggle("is-today", key === today);
    cell.classList.toggle("is-past", key < today);
    const room = capacity(Number(cell.style.getPropertyValue("--lanes")) || 0);
    rooms.set(key, `${room.all}/${room.withMore}`);
    const total = app.recurrence.occurrences(calendar, key).length + app.calendar.entries(calendar, key).length;
    // An enlarged cell whose entries fit again (after a move or an edit) closes by itself.
    if (key === expanded && total <= room.all) expanded = "";
    const open = key === expanded;
    const { html, hidden } = app.tiles.dayTiles(calendar, key, today, { limit: open || total <= room.all ? total : room.withMore, compact: true });
    /** @type {HTMLElement} */ (cell.querySelector(".mcell__list")).innerHTML = html;
    /** @type {HTMLElement} */ (cell.querySelector(".mcell__badges")).innerHTML = app.tiles.badges(key, 3, true);
    const more = /** @type {HTMLButtonElement} */ (cell.querySelector(".more"));
    more.hidden = !open && !hidden;
    more.textContent = open ? "" : `+${hidden}`;
    more.classList.toggle("more--less", open);
    more.setAttribute("aria-expanded", String(open));
    more.setAttribute("aria-label", open ? "Show fewer entries" : `${hidden} more entries, show all`);
    cell.classList.toggle("is-expanded", open);
    if (!open) {
      cell.classList.remove("is-up");
      cell.style.removeProperty("top");
      cell.style.removeProperty("bottom");
      cell.style.removeProperty("max-height");
    }
  }

  /**
   * Places the enlarged cell over the cells below it or, when they lack the room, aligned to the bottom of the board
   * and growing upwards; a cell taller than the board scrolls. One layout read, then only writes.
   * @param {HTMLElement} cell
   */
  function place(cell) {
    cell.style.top = "0px";
    cell.style.bottom = "auto";
    cell.style.removeProperty("max-height");
    cell.classList.remove("is-up");
    const body = /** @type {HTMLElement} */ (board.querySelector(".mbody")).getBoundingClientRect();
    const row = /** @type {HTMLElement} */ (cell.parentElement).getBoundingClientRect();
    const height = cell.offsetHeight;
    const up = height > body.bottom - row.top;
    cell.classList.toggle("is-up", up);
    cell.style.top = up ? "auto" : "0px";
    cell.style.bottom = up ? `${row.bottom - body.bottom}px` : "auto";
    cell.style.maxHeight = `${up ? body.height : body.bottom - row.top}px`;
  }

  function placeExpanded() {
    const open = expanded && cells.get(expanded);
    if (open) place(open);
  }

  /** Enlarges the cell of `key` until all its entries show, or shrinks it back when it is the enlarged one. @param {string} key */
  function toggle(key) {
    if (!shown) return;
    const previous = expanded;
    expanded = previous === key ? "" : key;
    for (const day of [previous, expanded]) {
      const target = day && cells.get(day);
      if (target) fill(target, shown.calendar, day, shown.today);
    }
    placeExpanded();
  }

  /** Shrinks the enlarged cell back, if there is one. */
  function collapse() {
    if (expanded) toggle(expanded);
  }

  /**
   * Every cell names its column, so that the enlarged cell, taken out of the flow, keeps its place and its neighbors theirs.
   * @param {string} key @param {string} month @param {number} lanes @param {number} column
   */
  function cellMarkup(key, month, lanes, column) {
    const other = key.slice(0, 7) !== month;
    const number = key.endsWith("-01") ? app.calendar.formatDay(key, "D MMM") : app.calendar.formatDay(key, "D");
    return `<div class="mcell${other ? " is-other" : ""}" data-day="${key}" style="--lanes:${lanes}; grid-column:${column} / span 1" aria-label="${app.calendar.formatDay(key, "dddd, D MMMM YYYY")}">` +
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
    const rebuilt = month !== shownMonth;
    if (rebuilt) expanded = "";
    const currentWeek = app.calendar.weekStart(today);
    const rows = weeks.map(start => {
      const layout = app.calendar.segments(calendar, start, 7);
      const days = app.calendar.weekDays(start);
      return `<div class="mweek${start === currentWeek ? " is-current" : ""}">` +
        `<span class="mweek__kw" aria-label="Week ${app.calendar.isoWeek(start)}">${app.calendar.isoWeek(start)}</span>` +
        `<div class="mrow" style="--lanes:${layout.lanes}"><div class="wk__bars">${layout.segments.map(segment => app.tiles.bar(segment, today, false)).join("")}</div>` +
        `${days.map((key, index) => cellMarkup(key, month, layout.dayLanes[index], index + 1)).join("")}</div></div>`;
    }).join("");
    if (rebuilt) {
      shownMonth = month;
      const names = app.calendar.weekDays(first).map(key => `<span>${app.calendar.formatDay(key, "dddd")}</span>`).join("");
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
    rooms.clear();
    for (const cell of board.querySelectorAll(".mcell")) cells.set(/** @type {HTMLElement} */ (cell).dataset.day || "", /** @type {HTMLElement} */ (cell));
    board.hidden = false;
    shown = { calendar, today };
    // One layout read for all cells, then only writes; the enlarged cell is placed last.
    cellHeight = /** @type {HTMLElement} */ (board.querySelector(".mcell:not(.is-expanded)")).clientHeight;
    for (const [key, cell] of cells) fill(cell, calendar, key, today);
    placeExpanded();
    return rebuilt;
  }

  /** @param {MDCCalendar} calendar @param {string[]} keys @param {string} today */
  function renderDays(calendar, keys, today) {
    for (const key of keys) {
      const cell = cells.get(key);
      if (cell) fill(cell, calendar, key, today);
    }
    if (keys.includes(expanded)) placeExpanded();
  }

  function lists() {
    return /** @type {HTMLElement[]} */ (Array.from(board.querySelectorAll(".mcell__list")));
  }

  /** @param {string} key */
  function cell(key) {
    return cells.get(key) || null;
  }

  // The board changes size with the window and with the backlog panel, whose drawer animates the height in portrait.
  // At most one pass per frame; only cells whose room for entries changed are refilled.
  new ResizeObserver(() => {
    if (resizeFrame || !shown) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      if (!shown || board.hidden) return;
      const height = /** @type {HTMLElement | null} */ (board.querySelector(".mcell:not(.is-expanded)"))?.clientHeight || 0;
      if (height !== cellHeight) {
        cellHeight = height;
        for (const [key, cell] of cells) {
          const room = capacity(Number(cell.style.getPropertyValue("--lanes")) || 0);
          if (rooms.get(key) !== `${room.all}/${room.withMore}`) fill(cell, shown.calendar, key, shown.today);
        }
      }
      placeExpanded();
    });
  }).observe(board);

  function hide() {
    shown = null;
    shownMonth = "";
    expanded = "";
    cells.clear();
    rooms.clear();
    board.replaceChildren();
    board.hidden = true;
  }

  app.month = { render, renderDays, lists, cell, hide, toggle, collapse };
})(window.MDCalendar);
