import { popover } from "@zang3th/md-libs/ui";

window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Context menu and the help panel (docs/ui/Interaction.md, docs/ui/Shell.md#help).
(function (app) {
  const context = /** @type {HTMLElement} */ (document.getElementById("contextMenu"));
  const help = /** @type {HTMLElement} */ (document.getElementById("helpPanel"));
  const helpContent = /** @type {HTMLElement} */ (document.getElementById("helpContent"));
  const helpButton = /** @type {HTMLButtonElement} */ (document.getElementById("helpButton"));
  const options = /** @type {HTMLElement} */ (document.getElementById("optionsMenu"));
  const optionsButton = /** @type {HTMLButtonElement} */ (document.getElementById("optionsButton"));
  const hideIcons = /** @type {HTMLButtonElement} */ (document.getElementById("hideIcons"));
  const newButton = /** @type {HTMLButtonElement} */ (document.getElementById("new"));
  const hideIconsKey = "md-calendar-hide-icons";
  /** @type {Array<{run(): void}>} */
  let contextItems = [];
  // The context menu handles Escape with its arrow keys below.
  const contextMenu = popover.create({ window, element: context, dismiss: "pointerdown", escape: false, onClose: () => {
    contextItems = [];
    newButton.setAttribute("aria-expanded", "false");
  } });
  const optionsMenu = popover.create({
    window, element: options, button: optionsButton, dismiss: "pointerdown",
    onClose: reason => { if (reason === "escape") optionsButton.focus(); }
  });

  /** Hides the tag and series icons of entries and bars; a per-device preference. @param {boolean} hidden */
  function setIconsHidden(hidden) {
    document.body.classList.toggle("hide-icons", hidden);
    hideIcons.setAttribute("aria-checked", String(hidden));
  }
  try { setIconsHidden(localStorage.getItem(hideIconsKey) === "1"); } catch { /* Without storage icons stay visible. */ }
  hideIcons.addEventListener("click", () => {
    const hidden = hideIcons.getAttribute("aria-checked") !== "true";
    setIconsHidden(hidden);
    try { localStorage.setItem(hideIconsKey, hidden ? "1" : "0"); } catch { /* The choice lasts for this page. */ }
  });
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

  /**
   * Menu label text; a part in braces is a file type and shows as code: “Import {.ics} event”. The spaces around it
   * are replaced by the chip's own margin, so that both sides get the same, fixed distance.
   * @param {string} text
   */
  function label(text) {
    return app.tiles.escape(text).replace(/\s*\{([^}]+)\}\s*/g, '<code class="menu__code">$1</code>');
  }

  /** @param {MDCMenuItem[]} items @param {number} x @param {number} y */
  function showContext(items, x, y) {
    contextItems = items;
    context.innerHTML = items.map((item, index) => `<button class="menu__item${item.danger ? " menu__item--danger" : ""}" type="button" role="menuitem" data-item="${index}"${item.label.includes("{") ? ` aria-label="${app.tiles.escape(item.label.replace(/[{}]/g, ""))}"` : ""}>` +
      `${app.tiles.icon(item.icon)}<span>${label(item.label)}</span></button>`).join("");
    placeAt(context, x, y);
    /** @type {HTMLElement | null} */ (context.querySelector(".menu__item"))?.focus();
  }

  function hideContext() {
    contextMenu.close();
  }

  /** The menu of “+”: the ways to add, placed below the button; a second click closes it. @param {MDCMenuItem[]} items */
  function showNewMenu(items) {
    if (!context.hidden && newButton.getAttribute("aria-expanded") === "true") {
      hideContext();
      return;
    }
    const bounds = newButton.getBoundingClientRect();
    showContext(items, bounds.left, bounds.bottom + 8);
    newButton.setAttribute("aria-expanded", "true");
  }

  /** Opens the options below their button, aligned to its right edge; a second call closes them. */
  function showOptions() {
    if (!options.hidden) {
      optionsMenu.close();
      return;
    }
    optionsMenu.open();
    const bounds = optionsButton.getBoundingClientRect();
    options.style.top = `${Math.round(bounds.bottom + 10)}px`;
    options.style.left = "auto";
    options.style.right = `${Math.round(window.innerWidth - bounds.right)}px`;
    hideIcons.focus();
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
    optionsMenu.close();
  });

  app.menus = {
    showContext, hideContext, showHelp, showNewMenu, showOptions,
    isModalOpen: () => !context.hidden
  };
})(window.MDCalendar);
