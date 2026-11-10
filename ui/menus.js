window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Context menu and the help panel (docs/ui/Interaction.md, docs/ui/Shell.md#help).
(function (app) {
  const context = /** @type {HTMLElement} */ (document.getElementById("contextMenu"));
  const help = /** @type {HTMLElement} */ (document.getElementById("helpPanel"));
  const helpContent = /** @type {HTMLElement} */ (document.getElementById("helpContent"));
  const helpButton = /** @type {HTMLButtonElement} */ (document.getElementById("helpButton"));
  /** @type {Array<{run(): void}>} */
  let contextItems = [];

  /**
   * The main shortcuts by task, laid out like the quick reference of MD_Manager: action left, keys right as key caps.
   * "+" joins the keys of one combination.
   * The full list is in docs/ui/Interaction.md.
   */
  const columns = [
    [["Navigation", [["Woche", "W"], ["Monat", "M"], ["Kontakte", "K"], ["Heute", "H"], ["Backlog", "B"], ["Suchen", "F"]]]],
    [["Einträge", [["Neu", "N"], ["Erledigt", "Leertaste"], ["Kopieren", "Strg+C"], ["Einfügen", "Strg+V"], ["Löschen", "Entf"]]]],
    [["Bearbeiten", [["Speichern", "Strg+S"], ["Rückgängig", "Strg+Z"], ["Wiederholen", "Strg+Y"]]]]
  ];
  /** @param {string} keys */
  const caps = keys => keys.split("+").map(key => `<kbd>${key}</kbd>`).join("<span>+</span>");
  // Groups sit in three columns side by side, so that the panel never scrolls.
  helpContent.innerHTML = columns.map(groups => `<div class="help__column">` + groups.map(([group, rows]) => `<h3 class="hp__title">${group}</h3><dl class="keys">` +
    /** @type {string[][]} */ (rows).map(([action, keys]) => `<div class="keys__row"><dt>${action}</dt><dd>${caps(keys)}</dd></div>`).join("") + `</dl>`).join("") + `</div>`).join("");

  /** Places a floating element at a point or below an anchor, kept inside the window. @param {HTMLElement} element @param {number} x @param {number} y */
  function placeAt(element, x, y) {
    element.hidden = false;
    const box = element.getBoundingClientRect();
    element.style.left = `${Math.round(Math.max(8, Math.min(x, window.innerWidth - box.width - 8)))}px`;
    element.style.top = `${Math.round(Math.max(8, Math.min(y, window.innerHeight - box.height - 8)))}px`;
  }

  /** @param {MDCMenuItem[]} items @param {number} x @param {number} y */
  function showContext(items, x, y) {
    contextItems = items;
    context.innerHTML = items.map((item, index) => `<button class="menu__item${item.danger ? " menu__item--danger" : ""}" type="button" role="menuitem" data-item="${index}">` +
      `${app.tiles.icon(item.icon)}<span>${app.tiles.escape(item.label)}</span></button>`).join("");
    placeAt(context, x, y);
    /** @type {HTMLElement | null} */ (context.querySelector(".menu__item"))?.focus();
  }

  function hideContext() {
    context.hidden = true;
    contextItems = [];
  }

  /** Opens the help below its button, like the holiday overview; a second call closes it. @param {boolean} [open] */
  function showHelp(open = help.hidden) {
    help.hidden = !open;
    helpButton.setAttribute("aria-expanded", String(open));
    if (!open) return;
    // One layout read to place the panel below its button, then writes only.
    const bounds = helpButton.getBoundingClientRect();
    help.style.top = `${Math.round(bounds.bottom + 10)}px`;
    help.style.right = `${Math.round(window.innerWidth - bounds.right)}px`;
  }

  context.addEventListener("click", event => {
    const button = event.target instanceof Element ? /** @type {HTMLElement | null} */ (event.target.closest("[data-item]")) : null;
    if (!button) return;
    const item = contextItems[Number(button.dataset.item)];
    hideContext();
    item?.run();
  });
  document.addEventListener("pointerdown", event => {
    if (!(event.target instanceof Node)) return;
    if (!context.hidden && !context.contains(event.target)) hideContext();
    if (!help.hidden && !help.contains(event.target) && !helpButton.contains(event.target)) showHelp(false);
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !help.hidden) {
      showHelp(false);
      helpButton.focus();
    }
  });
  document.addEventListener("keydown", event => {
    if (context.hidden) return;
    const items = /** @type {HTMLElement[]} */ (Array.from(context.querySelectorAll(".menu__item")));
    const index = items.indexOf(/** @type {HTMLElement} */ (document.activeElement));
    if (event.key === "Escape") hideContext();
    else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      items[(index + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
    } else return;
    event.preventDefault();
    event.stopPropagation();
  }, true);
  window.addEventListener("resize", () => {
    hideContext();
    showHelp(false);
  });

  app.menus = {
    showContext, hideContext, showHelp,
    isModalOpen: () => !context.hidden
  };
})(window.MDCalendar);
