import { popover } from "@zang3th/md-libs/ui";

window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Context menu and the help panel (docs/ui/Interaction.md, docs/ui/Shell.md#help).
(function (app) {
  const context = /** @type {HTMLElement} */ (document.getElementById("contextMenu"));
  const help = /** @type {HTMLElement} */ (document.getElementById("helpPanel"));
  const helpContent = /** @type {HTMLElement} */ (document.getElementById("helpContent"));
  const helpButton = /** @type {HTMLButtonElement} */ (document.getElementById("helpButton"));
  /** @type {Array<{run(): void}>} */
  let contextItems = [];
  // The context menu handles Escape with its arrow keys below.
  const contextMenu = popover.create({ window, element: context, dismiss: "pointerdown", escape: false, onClose: () => { contextItems = []; } });
  const helpMenu = popover.create({
    window, element: help, button: helpButton, dismiss: "pointerdown",
    onClose: reason => { if (reason === "escape") helpButton.focus(); }
  });

  /**
   * The main shortcuts by task, laid out like the quick reference of MD_Manager: action left, keys right as key caps.
   * "+" joins the keys of one combination.
   * The full list is in docs/ui/Interaction.md.
   */
  const columns = [
    [["Navigation", [["Week", "W"], ["Month", "M"], ["Contacts", "C"], ["Today", "T"], ["Backlog", "B"], ["Search", "F"]]]],
    [["Entries", [["New", "N"], ["Done", "Space"], ["Copy", "Ctrl+C"], ["Paste", "Ctrl+V"], ["Delete", "Del"]]]],
    [["Edit", [["Save", "Ctrl+S"], ["Undo", "Ctrl+Z"], ["Redo", "Ctrl+Y"]]]]
  ];
  /** @param {string} keys */
  const caps = keys => keys.split("+").map(key => `<kbd>${key}</kbd>`).join("<span>+</span>");
  // Groups sit in three columns side by side, so that the panel never scrolls.
  helpContent.innerHTML = columns.map(groups => `<div class="help__column">` + groups.map(([group, rows]) => `<h3 class="hp__title">${group}</h3><dl class="keys">` +
    /** @type {string[][]} */ (rows).map(([action, keys]) => `<div class="keys__row"><dt>${action}</dt><dd>${caps(keys)}</dd></div>`).join("") + `</dl>`).join("") + `</div>`).join("");

  /** Places a floating element at a point or below an anchor, kept inside the window. @param {HTMLElement} element @param {number} x @param {number} y */
  function placeAt(element, x, y) {
    element.hidden = false;
    const position = popover.place(popover.point(x, y), element.getBoundingClientRect(), popover.viewport(window), { margin: 8 });
    element.style.left = `${Math.round(position.left)}px`;
    element.style.top = `${Math.round(position.top)}px`;
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
    contextMenu.close();
  }

  /** Opens the help below its button, like the holiday overview; a second call closes it. @param {boolean} [open] */
  function showHelp(open = help.hidden) {
    if (!open) {
      helpMenu.close();
      return;
    }
    helpMenu.open();
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
