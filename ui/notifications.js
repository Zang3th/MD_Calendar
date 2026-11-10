window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Notifications, adopted from MD_Manager ui/notifications.js (see docs/Architecture.md#notifications).
(function (app) {
  const duration = 4000;
  const maxTextLength = 220;
  const container = /** @type {HTMLElement} */ (document.getElementById("notifications"));
  /** @type {WeakMap<HTMLElement, number>} */
  const timers = new WeakMap();
  let resizeFrame = 0;

  /** @param {HTMLElement} notification */
  function remove(notification) {
    window.clearTimeout(timers.get(notification));
    timers.delete(notification);
    notification.remove();
  }

  /** @param {HTMLElement} notification */
  function dismiss(notification) {
    if (!notification.isConnected || notification.classList.contains("notification-leaving")) return;
    window.clearTimeout(timers.get(notification));
    notification.classList.add("notification-leaving");
    notification.addEventListener("animationend", () => remove(notification), { once: true });
  }

  /** Drops the oldest dismissible notifications when the stack outgrows the window. */
  function trim() {
    const notifications = /** @type {HTMLElement[]} */ ([...container.children]);
    const gap = Number.parseFloat(getComputedStyle(container).rowGap) || 0;
    let used = notifications.reduce((height, notification) => height + notification.offsetHeight + gap, -gap);
    while (used > container.clientHeight) {
      const index = notifications.findIndex(notification => !notification.dataset.persistent);
      if (index < 0) break;
      used -= notifications[index].offsetHeight + gap;
      remove(notifications[index]);
      notifications.splice(index, 1);
    }
  }

  /** @param {string} value */
  function readable(value) {
    const compact = value.replace(/\s+/g, " ");
    return compact.length <= maxTextLength ? compact : `${compact.slice(0, maxTextLength - 1).trimEnd()}…`;
  }

  /** @param {MDCNotificationBody} body */
  function plainText(body) {
    return typeof body === "string" ? body : body.map(part => typeof part === "string" ? part : part.value).join("");
  }

  /** @param {string} icon @param {string} label */
  function iconButton(icon, label) {
    const button = document.createElement("button");
    button.className = "notification-icon";
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.dataset.tooltip = label;
    button.innerHTML = `<svg class="ui-icon" aria-hidden="true" viewBox="0 0 32 32"><use href="#icon-${icon}"></use></svg>`;
    return button;
  }

  /**
   * @param {MDCSeverity} severity
   * @param {string} title
   * @param {MDCNotificationBody} body
   * @param {MDCNotificationOptions} [options]
   */
  function show(severity, title, body, options = {}) {
    const notification = document.createElement("article");
    notification.className = `notification notification-${severity}`;
    notification.setAttribute("role", severity === "error" ? "alert" : "status");
    const persistent = severity === "error" || Boolean(options.persistent);
    if (persistent) notification.dataset.persistent = "true";

    const header = document.createElement("header");
    header.className = "notification-header";
    const heading = document.createElement("span");
    heading.className = "notification-title";
    heading.textContent = title;
    header.append(heading);
    if (severity === "error") {
      const code = document.createElement("span");
      code.className = "notification-code";
      code.textContent = options.code || "MDC-000";
      const copy = iconButton("clipboard", "Fehler kopieren");
      copy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(`Fehler ${options.code || "MDC-000"}: ${title}\nDetails: ${plainText(options.details || body)}`);
          copy.dataset.tooltip = "Kopiert";
        } catch {
          copy.dataset.tooltip = "Kopieren fehlgeschlagen";
        }
      });
      header.append(code, copy);
    }
    if (persistent) {
      const close = iconButton("close", "Schließen");
      close.addEventListener("click", () => dismiss(notification));
      header.append(close);
    }

    const text = document.createElement("div");
    text.className = "notification-body";
    for (const part of typeof body === "string" ? [body] : body) {
      if (typeof part === "string") text.append(readable(part));
      else {
        const value = document.createElement("span");
        value.className = "notification-value";
        value.textContent = readable(part.value);
        text.append(value);
      }
    }
    notification.append(header, text);

    if (options.actions?.length) {
      const actions = document.createElement("div");
      actions.className = "notification-actions";
      for (const action of options.actions) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `btn ${action.primary ? "btn--primary" : "btn--ghost"}`;
        button.textContent = action.label;
        button.addEventListener("click", () => {
          dismiss(notification);
          action.run();
        });
        actions.append(button);
      }
      notification.append(actions);
    }

    container.append(notification);
    trim();
    if (!persistent) timers.set(notification, window.setTimeout(() => dismiss(notification), duration));
    return { dismiss: () => dismiss(notification), isOpen: () => notification.isConnected && !notification.classList.contains("notification-leaving") };
  }

  /** Blocks the application and reports why. @param {string} title @param {string} body @param {string} details @param {string} code */
  function fatal(title, body, details, code) {
    document.body.classList.add("startup-blocked");
    document.body.dataset.startupState = "blocked";
    document.querySelectorAll(".app, .dlg").forEach(element => {
      if (element instanceof HTMLElement) element.inert = true;
    });
    show("error", title, body, { details, code });
  }

  /** @param {unknown} value */
  function errorMessage(value) {
    if (value instanceof Error) return value.stack || value.message;
    return typeof value === "string" ? value : "Unbekannter Fehler.";
  }

  window.addEventListener("error", event => {
    show("error", "Unerwarteter Fehler", "In der Anwendung ist ein unerwarteter Fehler aufgetreten.", { details: errorMessage(event.error || event.message), code: "MDC-900" });
  });
  window.addEventListener("unhandledrejection", event => {
    show("error", "Unerwarteter Fehler", "In der Anwendung ist ein unerwarteter Fehler aufgetreten.", { details: errorMessage(event.reason), code: "MDC-901" });
  });
  window.addEventListener("resize", () => {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      trim();
    });
  });

  app.notifications = { show, fatal };
})(window.MDCalendar);
