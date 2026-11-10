window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Start card shown while no folder is open (docs/ui/Shell.md#start-card).
(function (app) {
  const start = /** @type {HTMLElement} */ (document.getElementById("start"));
  const reopen = /** @type {HTMLButtonElement} */ (document.getElementById("reopen"));
  const pick = /** @type {HTMLButtonElement} */ (document.getElementById("pick"));

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
  }

  app.start = { show, hide };
})(window.MDCalendar);
