window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Start card shown while no folder is open (docs/ui/Shell.md#start-card).
(function (app) {
  const start = /** @type {HTMLElement} */ (document.getElementById("start"));
  const reopen = /** @type {HTMLButtonElement} */ (document.getElementById("reopen"));
  const pick = /** @type {HTMLButtonElement} */ (document.getElementById("pick"));
  const icsInput = /** @type {HTMLInputElement} */ (document.getElementById("icsImport"));
  const note = /** @type {HTMLElement} */ (document.getElementById("startImport"));
  /** @type {((text: string, name: string) => void) | null} */
  let importHandler = null;

  // The import runs into the folder that is opened next (docs/ui/Shell.md#start-card).
  icsInput.addEventListener("change", () => {
    const file = icsInput.files?.[0];
    icsInput.value = "";
    if (!file || !importHandler) return;
    const handler = importHandler;
    void file.text().then(text => {
      handler(text, file.name);
      note.textContent = `„${file.name}“ wird nach dem Öffnen des Ordners importiert.`;
      note.hidden = false;
    });
  });

  /** @param {string | null} remembered Name of the remembered folder. */
  function show(remembered) {
    reopen.hidden = !remembered;
    reopen.textContent = remembered ? `„${remembered}“ öffnen` : "";
    pick.textContent = remembered ? "Anderen Ordner wählen" : "Ordner öffnen";
    pick.className = remembered ? "btn btn--ghost" : "primary";
    start.hidden = false;
  }

  function hide() {
    start.hidden = true;
    note.hidden = true;
  }

  /** @param {(text: string, name: string) => void} handler */
  function onImport(handler) {
    importHandler = handler;
  }

  app.start = { show, hide, onImport };
})(window.MDCalendar);
