import { notifications } from "@zang3th/md-libs/ui";

window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Notifications of MD_Libs ui/notifications with German texts and MDC codes (see docs/Architecture.md#notifications).
(function (app) {
  /** @param {unknown} value */
  function errorMessage(value) {
    if (value instanceof Error) return value.stack || value.message;
    return typeof value === "string" ? value : "Unbekannter Fehler.";
  }

  const stack = notifications.create({
    window,
    container: /** @type {HTMLElement} */ (document.getElementById("notifications")),
    maxTextLength: 220,
    defaultCode: "MDC-000",
    strings: {
      tag: (severity, code) => severity === "error" ? code : "",
      close: "Schließen",
      copy: "Fehler kopieren",
      copied: "Kopiert",
      copiedTooltip: "Kopiert",
      copyFailed: "Kopieren fehlgeschlagen",
      copyNote: "",
      copyText: (code, title, details) => `Fehler ${code}: ${title}\nDetails: ${details}`
    },
    block() {
      document.body.classList.add("startup-blocked");
      document.body.dataset.startupState = "blocked";
      document.querySelectorAll(".app, .dlg").forEach(element => {
        if (element instanceof HTMLElement) element.inert = true;
      });
    },
    globalErrors: {
      title: "Unerwarteter Fehler",
      body: "In der Anwendung ist ein unerwarteter Fehler aufgetreten.",
      codes: { error: "MDC-900", rejection: "MDC-901" },
      details: (_kind, value) => errorMessage(value)
    }
  });

  /** Blocks the application and reports why. @param {string} title @param {string} body @param {string} details @param {string} code */
  function fatal(title, body, details, code) {
    stack.fatal(title, body, { details, code });
  }

  app.notifications = { show: stack.show, fatal };
})(window.MDCalendar);
