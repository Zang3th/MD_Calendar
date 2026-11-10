window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Tooltips for elements with data-tooltip, adopted from MD_Manager ui/tooltips.js.
(function (app) {
  const tooltip = /** @type {HTMLElement} */ (document.getElementById("appTooltip"));
  const showDelay = 350;
  let showTimer = 0;
  let positionFrame = 0;
  /** @type {HTMLElement | null} */
  let target = null;

  function hide() {
    window.clearTimeout(showTimer);
    if (positionFrame) cancelAnimationFrame(positionFrame);
    showTimer = 0;
    positionFrame = 0;
    if (target?.getAttribute("aria-describedby") === "appTooltip") target.removeAttribute("aria-describedby");
    target = null;
    tooltip.hidden = true;
  }

  function position() {
    positionFrame = 0;
    if (!target || tooltip.hidden) return;
    const targetBounds = target.getBoundingClientRect();
    const tooltipBounds = tooltip.getBoundingClientRect();
    const margin = 8;
    const preferredLeft = targetBounds.left + (targetBounds.width - tooltipBounds.width) / 2;
    const left = Math.max(margin, Math.min(window.innerWidth - tooltipBounds.width - margin, preferredLeft));
    const below = targetBounds.bottom + margin;
    const top = below + tooltipBounds.height <= window.innerHeight - margin ? below : targetBounds.top - tooltipBounds.height - margin;
    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(Math.max(margin, top))}px`;
  }

  /** @param {HTMLElement} next @param {boolean} immediate */
  function schedule(next, immediate) {
    hide();
    target = next;
    target.setAttribute("aria-describedby", "appTooltip");
    showTimer = window.setTimeout(() => {
      if (!target || !target.dataset.tooltip) return;
      tooltip.textContent = target.dataset.tooltip;
      tooltip.hidden = false;
      positionFrame = requestAnimationFrame(position);
    }, immediate ? 0 : showDelay);
  }

  /** @param {EventTarget | null} eventTarget */
  function tooltipTarget(eventTarget) {
    return eventTarget instanceof Element ? /** @type {HTMLElement | null} */ (eventTarget.closest("[data-tooltip]")) : null;
  }

  document.addEventListener("pointerover", event => {
    if (event.pointerType === "touch") return;
    const next = tooltipTarget(event.target);
    if (next && next !== target) schedule(next, false);
  });
  document.addEventListener("pointerout", event => {
    if (target && !target.contains(/** @type {Node | null} */ (event.relatedTarget))) hide();
  });
  document.addEventListener("focusin", event => {
    const next = tooltipTarget(event.target);
    if (next && next.matches(":focus-visible")) schedule(next, true);
  });
  document.addEventListener("focusout", hide);
  document.addEventListener("pointerdown", hide);
  window.addEventListener("resize", hide);
  window.addEventListener("scroll", hide, true);

  app.tooltips = { hide };
})(window.MDCalendar);
