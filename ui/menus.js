window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Options menu, context menu and the shortcut overview (docs/ui/Shell.md#options-menu, docs/ui/Interaction.md).
(function (app) {
  const optionsButton = /** @type {HTMLButtonElement} */ (document.getElementById("optionsButton"));
  const options = /** @type {HTMLElement} */ (document.getElementById("optionsMenu"));
  const context = /** @type {HTMLElement} */ (document.getElementById("contextMenu"));
  const help = /** @type {HTMLDialogElement} */ (document.getElementById("helpDialog"));
  const helpKeys = /** @type {HTMLElement} */ (document.getElementById("helpKeys"));
  const icsInput = /** @type {HTMLInputElement} */ (document.getElementById("icsImport"));
  /** @type {Array<{run(): void}>} */
  let contextItems = [];
  /** @type {((text: string, name: string) => void) | null} */
  let importHandler = null;

  /** Shortcut overview; the same list as docs/ui/Interaction.md#keyboard-shortcuts. */
  const shortcuts = [
    ["Ansicht", [["W", "Woche"], ["M", "Monat"], ["K", "Kontakte"], ["B", "Backlog ein- oder ausblenden"], ["T", "Zu heute springen"], ["← →", "Vorherige oder nächste Woche bzw. Monat"], ["Mausrad", "Eine Woche bzw. einen Monat weiter"]]],
    ["Einträge", [["N", "Neuer Eintrag am Tag unter dem Mauszeiger (in Kontakte: neuer Kontakt)"], ["Doppelklick", "Neuer Eintrag an diesem Tag"], ["F", "Suchen"], ["Rechtsklick", "Erledigt, Kopieren, Löschen, Einfügen"]]],
    ["Auswahl", [["Ziehen auf freier Fläche", "Einträge markieren"], ["Strg + Klick", "Eintrag zur Auswahl hinzufügen oder entfernen"], ["Strg A", "Alle Einträge der Ansicht markieren"], ["Leertaste", "Markierte erledigt oder offen"], ["Strg C · Strg V", "Kopieren · am Tag unter dem Mauszeiger einfügen"], ["Entf", "Markierte löschen"], ["Esc", "Auswahl aufheben, Dialog oder Panel schließen"]]],
    ["Bearbeiten", [["Strg S", "Speichern"], ["Strg Z", "Rückgängig"], ["Strg Y · Strg ⇧ Z", "Wiederholen"], ["Enter", "Dialog bestätigen, Feld abschließen"], ["?", "Diese Übersicht"]]]
  ];
  helpKeys.innerHTML = shortcuts.map(([group, rows]) => `<div class="keys__group"><h3 class="hp__title">${group}</h3>` +
    /** @type {string[][]} */ (rows).map(([key, text]) => `<div class="keys__row"><dt>${key.split(" · ").map(part => `<kbd>${part}</kbd>`).join(" ")}</dt><dd>${text}</dd></div>`).join("") + `</div>`).join("");

  /** Places a floating element at a point or below an anchor, kept inside the window. @param {HTMLElement} element @param {number} x @param {number} y */
  function placeAt(element, x, y) {
    element.hidden = false;
    const box = element.getBoundingClientRect();
    element.style.left = `${Math.round(Math.max(8, Math.min(x, window.innerWidth - box.width - 8)))}px`;
    element.style.top = `${Math.round(Math.max(8, Math.min(y, window.innerHeight - box.height - 8)))}px`;
  }

  /** @param {boolean} open */
  function setOptions(open) {
    optionsButton.setAttribute("aria-expanded", String(open));
    if (!open) {
      options.hidden = true;
      return;
    }
    const bounds = optionsButton.getBoundingClientRect();
    options.hidden = false;
    options.style.top = `${Math.round(bounds.bottom + 10)}px`;
    options.style.left = `${Math.round(bounds.right - options.offsetWidth)}px`;
    /** @type {HTMLElement | null} */ (options.querySelector(".menu__item"))?.focus();
  }

  function toggleOptions() {
    setOptions(options.hidden);
  }

  /** @param {MDCMenuItem[]} items @param {number} x @param {number} y */
  function showContext(items, x, y) {
    contextItems = items;
    context.innerHTML = items.map((item, index) => `<button class="menu__item${item.danger ? " menu__item--danger" : ""}" type="button" role="menuitem" data-item="${index}">` +
      `${app.tiles.icon(item.icon)}<span>${app.tiles.escape(item.label)}</span>${item.key ? `<kbd>${item.key}</kbd>` : ""}</button>`).join("");
    placeAt(context, x, y);
    /** @type {HTMLElement | null} */ (context.querySelector(".menu__item"))?.focus();
  }

  function hideContext() {
    context.hidden = true;
    contextItems = [];
  }

  function showHelp() {
    setOptions(false);
    if (!help.open) help.showModal();
  }

  context.addEventListener("click", event => {
    const button = event.target instanceof Element ? /** @type {HTMLElement | null} */ (event.target.closest("[data-item]")) : null;
    if (!button) return;
    const item = contextItems[Number(button.dataset.item)];
    hideContext();
    item?.run();
  });
  // The options menu stays open for the sound toggle, so that its state change is visible.
  options.addEventListener("click", event => {
    if (event.target instanceof Element && event.target.closest("#helpButton")) setOptions(false);
  });
  icsInput.addEventListener("change", () => {
    const file = icsInput.files?.[0];
    icsInput.value = "";
    setOptions(false);
    if (file && importHandler) {
      const handler = importHandler;
      void file.text().then(text => handler(text, file.name));
    }
  });
  help.addEventListener("click", event => {
    if (event.target === help || (event.target instanceof Element && event.target.closest("[data-close]"))) help.close();
  });
  document.addEventListener("pointerdown", event => {
    if (!(event.target instanceof Node)) return;
    if (!context.hidden && !context.contains(event.target)) hideContext();
    if (!options.hidden && !options.contains(event.target) && !optionsButton.contains(event.target)) setOptions(false);
  });
  document.addEventListener("keydown", event => {
    const open = !context.hidden ? context : !options.hidden ? options : null;
    if (!open) return;
    const items = /** @type {HTMLElement[]} */ (Array.from(open.querySelectorAll(".menu__item")));
    const index = items.indexOf(/** @type {HTMLElement} */ (document.activeElement));
    if (event.key === "Escape") {
      if (open === options) {
        setOptions(false);
        optionsButton.focus();
      } else hideContext();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      items[(index + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
    } else return;
    event.preventDefault();
    event.stopPropagation();
  }, true);
  window.addEventListener("resize", () => {
    hideContext();
    setOptions(false);
  });

  /** @param {(text: string, name: string) => void} handler */
  function onImport(handler) {
    importHandler = handler;
  }

  app.menus = {
    toggleOptions, showContext, hideContext, showHelp, onImport,
    isModalOpen: () => help.open || !context.hidden || !options.hidden
  };
})(window.MDCalendar);
