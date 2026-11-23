window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Focus mode: one day of the week view as a floating card in front of the blurred app (docs/ui/Views.md#focus-mode).
// The entries are the usual tiles with location and note lines, inside a list with the day's data-day, so that checking
// off, opening, copying and adding work through the usual handlers.
(function (app) {
  const root = /** @type {HTMLElement} */ (document.getElementById("focus"));
  const card = /** @type {HTMLElement} */ (root.querySelector(".focus__card"));
  /** @type {{calendar: MDCCalendar, key: string, today: string} | null} */
  let shown = null;

  function draw() {
    if (!shown) return;
    const { calendar, key, today } = shown;
    const { html, shown: visible } = app.tiles.dayTiles(calendar, key, today, { details: true });
    const bars = app.calendar.segments(calendar, key, 1).segments.map(segment => app.tiles.bar(segment, today, true)).join("");
    card.dataset.day = key;
    card.classList.toggle("is-today", key === today);
    card.setAttribute("aria-label", app.calendar.formatDay(key, "dddd, D MMMM YYYY"));
    card.innerHTML = `<header class="focus__head">` +
      `<div class="focus__heading"><span class="focus__dow">${app.calendar.formatDay(key, "dddd")}</span>` +
      `<span class="focus__date"><span class="focus__num">${app.calendar.formatDay(key, "D")}</span>` +
      `<span class="focus__meta"><span class="focus__month">${app.calendar.formatDay(key, "MMMM YYYY")}</span>${key === today ? `<span class="focus__today">Today</span>` : ""}</span></span></div>` +
      // Holidays, birthdays and anniversaries sit at the top right; arrows, Esc and the background navigate and close.
      `<div class="focus__badges">${app.tiles.badges(key, 5)}</div></header>` +
      (bars ? `<div class="focus__bars">${bars}</div>` : "") +
      `<div class="focus__list day__list" data-day="${key}">${html}${visible ? "" : `<p class="focus__empty">No entries</p>`}</div>`;
    // The entries can be reordered inside the card (docs/ui/Views.md#focus-mode).
    app.interactions.bindFocusList(/** @type {HTMLElement} */ (card.querySelector(".focus__list")));
  }

  /** Opens the focus card for the day `key`. @param {MDCCalendar} calendar @param {string} key @param {string} today */
  function open(calendar, key, today) {
    shown = { calendar, key, today };
    draw();
    root.hidden = false;
    card.focus({ preventScroll: true });
  }

  function close() {
    if (!shown) return;
    shown = null;
    app.interactions.bindFocusList(null);
    root.hidden = true;
    card.replaceChildren();
  }

  /** Draws the card again after a change, if it is open. @param {MDCCalendar} calendar @param {string} today */
  function refresh(calendar, today) {
    if (!shown) return;
    shown.calendar = calendar;
    shown.today = today;
    const scroll = card.querySelector(".focus__list")?.scrollTop || 0;
    draw();
    const list = card.querySelector(".focus__list");
    if (list) list.scrollTop = scroll;
  }

  /** Shows the previous or next day; the card content glides in from that side. @param {number} direction */
  function step(direction) {
    if (!shown) return;
    shown.key = app.calendar.addDays(shown.key, direction);
    draw();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    for (const part of card.children) part.animate([{ transform: `translateX(${direction * 16}px)` }, { transform: "none" }], { duration: 200, easing: "cubic-bezier(.2,.8,.2,1)" });
  }

  // A click on the blurred background closes the card, but only when the press began there too (as the entry dialog).
  let pressOnBackground = false;
  root.addEventListener("pointerdown", event => { pressOnBackground = event.target === root; });
  root.addEventListener("click", event => {
    if (event.target === root && pressOnBackground) close();
  });

  document.addEventListener("keydown", event => {
    // The entry dialog handles its own Escape first; it is still open while this runs.
    if (event.key === "Escape" && shown && !app.dialog.isOpen()) close();
  });

  app.focus = { open, close, refresh, step, isOpen: () => Boolean(shown), day: () => shown?.key || "" };
})(window.MDCalendar);
