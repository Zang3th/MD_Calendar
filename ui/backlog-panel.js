window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Backlog panel: landscape on the right, portrait as a bottom drawer (docs/ui/Shell.md#backlog-panel).
(function (app) {
  const panel = /** @type {HTMLElement} */ (document.getElementById("backlog"));
  const groupsElement = /** @type {HTMLElement} */ (document.getElementById("backlogGroups"));
  /** @type {string} */
  let shownGroups = "";
  /** Names of the collapsed groups; kept while the app is open, not stored. @type {Set<string>} */
  const collapsed = new Set();

  /** Shows a group collapsed or expanded. @param {Element} section @param {boolean} closed */
  function applyCollapsed(section, closed) {
    section.classList.toggle("is-collapsed", closed);
    const button = /** @type {HTMLElement} */ (section.querySelector(".bl__head"));
    const name = section.getAttribute("aria-label") || "";
    button.setAttribute("aria-expanded", String(!closed));
    button.setAttribute("aria-label", `${closed ? "Expand" : "Collapse"} ${name}`);
  }

  /**
   * Shows or hides the panel and fills its groups. Returns true when the lists were rebuilt.
   * @param {MDCBacklog} backlog @param {boolean} open
   */
  function render(backlog, open) {
    document.body.classList.toggle("backlog-open", open);
    panel.inert = !open;
    panel.setAttribute("aria-hidden", String(!open));
    const names = JSON.stringify(backlog.groups.map(group => group.name));
    const rebuilt = names !== shownGroups;
    if (rebuilt) {
      shownGroups = names;
      // Ungrouped entries come first, without a head; the list takes no room while it is empty (docs/ui/Shell.md#backlog-panel).
      groupsElement.innerHTML = `<section class="bl__group bl__group--ungrouped" aria-label="Ungrouped"><div class="bl__list" data-group="${app.backlog.ungrouped}"></div></section>` +
        backlog.groups.map((group, index) =>
        `<section class="bl__group" aria-label="${app.tiles.escape(group.name)}">` +
        `<button class="bl__head" type="button" aria-controls="backlogGroup${index}"><span class="bl__name">${group.name === app.backlogFormat.inbox ? app.tiles.icon("inbox") : ""}${app.tiles.escape(group.name)}</span>` +
        `<span class="bl__count"></span><span class="bl__chevron">${app.tiles.icon("chevron-right")}</span></button>` +
        `<div class="bl__list" id="backlogGroup${index}" data-group="${index}"></div></section>`).join("");
      groupsElement.querySelectorAll(".bl__group:not(.bl__group--ungrouped)").forEach((section, index) => applyCollapsed(section, collapsed.has(backlog.groups[index].name)));
    }
    const ungroupedList = /** @type {HTMLElement} */ (groupsElement.querySelector(".bl__group--ungrouped .bl__list"));
    ungroupedList.innerHTML = app.tiles.backlogTiles(backlog.ungrouped);
    const sections = groupsElement.querySelectorAll(".bl__group:not(.bl__group--ungrouped)");
    backlog.groups.forEach((group, index) => {
      const section = sections[index];
      /** @type {HTMLElement} */ (section.querySelector(".bl__count")).textContent = String(group.entries.length);
      /** @type {HTMLElement} */ (section.querySelector(".bl__list")).innerHTML = app.tiles.backlogTiles(group.entries);
    });
    return rebuilt;
  }

  groupsElement.addEventListener("click", event => {
    const button = event.target instanceof Element ? event.target.closest(".bl__head") : null;
    const section = button?.closest(".bl__group");
    if (!section) return;
    const name = section.getAttribute("aria-label") || "";
    if (collapsed.has(name)) collapsed.delete(name);
    else collapsed.add(name);
    applyCollapsed(section, collapsed.has(name));
  });

  function lists() {
    return /** @type {HTMLElement[]} */ (Array.from(groupsElement.querySelectorAll(".bl__list")));
  }

  app.backlogPanel = { render, lists };
})(window.MDCalendar);
