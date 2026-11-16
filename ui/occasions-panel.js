import { popover } from "@zang3th/md-libs/ui";

window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// The list behind a day badge: anniversaries, birthdays or holidays of one day, in their color (docs/ui/Views.md#day-header).
(function (app) {
  const panel = /** @type {HTMLElement} */ (document.getElementById("occasionsPanel"));
  /** @type {Array<() => void>} */
  let actions = [];
  const floating = popover.create({ window, element: panel, dismiss: "pointerdown", onClose: () => { actions = []; } });
  const icons = { anniversary: "heart", birthday: "gift", holiday: "holiday" };

  /**
   * Shows the list below an anchor whose right edge is `right`.
   * @param {MDCOccasionList} list @param {number} right @param {number} top
   */
  function show(list, right, top) {
    actions = list.items.map(item => item.open || (() => {}));
    panel.className = `occ popover glass occ--${list.kind}`;
    panel.setAttribute("aria-label", `${list.title}, ${list.date}`);
    panel.innerHTML = `<header class="occ__head"><span class="occ__icon">${app.tiles.icon(icons[list.kind])}</span>` +
      `<span class="occ__heading"><span class="occ__title">${app.tiles.escape(list.title)}</span><span class="occ__date">${app.tiles.escape(list.date)}</span></span></header>` +
      `<ul class="occ__list">${list.items.map((item, index) => {
        const content = `<span class="occ__name">${app.tiles.escape(item.name)}</span>` +
          (item.detail ? `<span class="occ__detail">${app.tiles.escape(item.detail)}</span>` : "") +
          (item.badge ? `<span class="occ__badge">${app.tiles.escape(item.badge)}</span>` : "");
        return item.open
          ? `<li><button class="occ__row" type="button" data-row="${index}" aria-label="${app.tiles.escape([item.name, item.detail, item.badge].filter(Boolean).join(", "))}, open contact">${content}${app.tiles.icon("chevron-right")}</button></li>`
          : `<li class="occ__row occ__row--static">${content}</li>`;
      }).join("")}</ul>`;
    floating.open();
    // One read for the width, then writes only: right-aligned to the badge, kept inside the window.
    const width = panel.getBoundingClientRect().width;
    panel.style.left = `${Math.round(Math.max(8, Math.min(right - width, window.innerWidth - width - 8)))}px`;
    panel.style.top = `${Math.round(top)}px`;
    /** @type {HTMLElement | null} */ (panel.querySelector("button.occ__row"))?.focus();
  }

  panel.addEventListener("click", event => {
    const row = event.target instanceof Element ? /** @type {HTMLElement | null} */ (event.target.closest("[data-row]")) : null;
    if (!row) return;
    const run = actions[Number(row.dataset.row)];
    floating.close();
    run?.();
  });
  window.addEventListener("resize", () => floating.close());

  app.occasionsPanel = { show, isOpen: () => !panel.hidden };
})(window.MDCalendar);
