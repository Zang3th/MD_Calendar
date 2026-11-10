window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Backlog panel: landscape on the right, portrait as a bottom drawer (docs/ui/Shell.md#backlog-panel).
(function (app) {
  const panel = /** @type {HTMLElement} */ (document.getElementById("backlog"));
  const groupsElement = /** @type {HTMLElement} */ (document.getElementById("backlogGroups"));
  /** @type {string} */
  let shownGroups = "";

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
      groupsElement.innerHTML = backlog.groups.map((group, index) =>
        `<section class="bl__group" aria-label="${app.tiles.escape(group.name)}">` +
        `<header class="bl__head"><span class="bl__name">${group.name === app.backlogFormat.inbox ? app.tiles.icon("inbox") : ""}${app.tiles.escape(group.name)}</span>` +
        `<span class="bl__count"></span></header>` +
        `<div class="bl__list" data-group="${index}"></div></section>`).join("");
    }
    const sections = groupsElement.querySelectorAll(".bl__group");
    backlog.groups.forEach((group, index) => {
      const section = sections[index];
      /** @type {HTMLElement} */ (section.querySelector(".bl__count")).textContent = String(group.entries.length);
      /** @type {HTMLElement} */ (section.querySelector(".bl__list")).innerHTML = app.tiles.backlogTiles(group.entries);
    });
    return rebuilt;
  }

  function lists() {
    return /** @type {HTMLElement[]} */ (Array.from(groupsElement.querySelectorAll(".bl__list")));
  }

  app.backlogPanel = { render, lists };
})(window.MDCalendar);
