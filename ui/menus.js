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
   * Every shortcut and pointer gesture by task (docs/ui/Shell.md#help). "+" joins the keys of one combination, "|"
   * separates alternatives, which stack, a space sets keys side by side; "left" and "right" are the arrow keys.
   * In groups with pointer gestures every row is laid out on one grid: keys, a join ("or", or "+" when the gesture is
   * written "+name" and goes with the keys), and an end cell with the gesture icon or the last key of a combination,
   * so that every "+" and "or" lines up. A single key ends at the right edge; the gesture "-" keeps a combination in
   * line with the keys around it instead.
   * @type {Array<Array<[string, Array<[string, string, string?]>]>>}
   */
  const columns = [
    [["Views", [["Week", "W"], ["Month", "M"], ["Contacts", "C"], ["Backlog", "B"], ["Focus day", "", "double"]]],
      ["Navigate", [["Previous / Next", "left right", "wheel"], ["Drag days", "", "middle"], ["Today", "T"], ["Search", "F"]]],
      ["Select", [["Area", "", "drag"], ["Add / Remove", "Ctrl", "+click"], ["Whole day", "Ctrl+A"]]]],
    [["Edit", [["New entry", "A", "click"], ["Done / Undone", "Space"], ["Delete", "Del"], ["Copy", "Ctrl+C", "right"], ["Paste", "Ctrl+V", "right"], ["Cut", "Ctrl+X", "-"]]],
      ["History", [["Save", "Ctrl+S"], ["Undo", "Ctrl+Z"], ["Redo", "Ctrl+Y|Ctrl+Shift+Z"]]]]
  ];
  /** Keys that apply everywhere, in one line below the columns. */
  const general = [["Help", "?"], ["Close / Clear", "Esc"], ["Confirm", "Enter"]];
  /** @type {Record<string, [string, string]>} */
  const gestures = {
    click: ["mouse-click", "Click"], right: ["mouse-right-click", "Right-click"], wheel: ["mouse-wheel", "Mouse wheel"], drag: ["lasso", "Drag"],
    double: ["mouse-double-click", "Double-click on the day header"], middle: ["mouse-middle-drag", "Drag with the middle button"]
  };
  /** @type {Record<string, string>} */
  const arrows = { left: app.tiles.icon("chevron-left"), right: app.tiles.icon("chevron-right") };
  /** @param {string} key */
  const cap = key => key in arrows ? `<kbd class="keys__arrow" aria-label="${key === "left" ? "Left arrow" : "Right arrow"}">${arrows[key]}</kbd>` : `<kbd>${key}</kbd>`;
  /** @param {string} keys */
  const caps = keys => keys.split("|").map(combination => combination.split("+").map(part => part.split(" ").filter(Boolean).map(cap).join("")).join("<span>+</span>")).map(combination => `<span class="keys__combo">${combination}</span>`).join("");
  /** @param {string} name */
  const mouse = name => `<span role="img" aria-label="${gestures[name][1]}">${app.tiles.icon(gestures[name][0])}</span>`;
  /** @param {string} keys @param {string} join @param {string} end */
  const grid = (keys, join, end) => `<dd class="keys__caps">${keys}</dd><dd class="keys__join">${join}</dd><dd class="keys__end">${end}</dd>`;
  /**
   * The cells after the action. Without a grid (no gestures in the group, or a single key) the keys alone run to the
   * right edge. @param {string} keys @param {string | undefined} gesture @param {boolean} withPointer
   */
  function cells(keys, gesture, withPointer) {
    const split = keys.includes("|") ? -1 : keys.lastIndexOf("+");
    if (!withPointer || (!gesture && split < 0)) return `<dd class="keys__caps">${caps(keys)}</dd>`;
    if (gesture === "-") return grid(caps(keys), "", "");
    if (!gesture) return grid(caps(keys.slice(0, split)), "+", cap(keys.slice(split + 1)));
    const name = gesture.replace(/^\+/, "");
    return grid(caps(keys), keys ? (gesture.startsWith("+") ? "+" : "or") : "", mouse(name));
  }
  // Groups sit in two columns side by side, so that the panel never scrolls; the general keys span both.
  helpContent.innerHTML = columns.map(groups => `<div class="help__column">` + groups.map(([group, rows]) => {
    const withPointer = rows.some(row => row[2] && row[2] !== "-");
    return `<section class="help__group"><h3 class="hp__title">${group}</h3><dl class="keys${withPointer ? " keys--pointer" : ""}">` +
      rows.map(([action, keys, gesture]) => `<div class="keys__row"><dt>${action}</dt>${cells(keys, gesture, withPointer)}</div>`).join("") +
      `</dl></section>`;
  }).join("") + `</div>`).join("") +
    `<p class="help__general">` + general.map(([action, keys]) => `<span class="help__hint">${caps(keys)}<span>${action}</span></span>`).join("") + `</p>`;

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
    hideContext, showHelp, showNewMenu, showOptions,
    isModalOpen: () => !context.hidden
  };
})(window.MDCalendar);
