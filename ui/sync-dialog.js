import { modal } from "@zang3th/md-libs/ui";

window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// The sync dialog (docs/ui/Shell.md#sync-dialog, look in docs/ui/DesignSystem.md#sync-dialog): setup, overview, check,
// the two-column merge view, applying and the result. It renders what app.js hands over and reports the user's choices;
// it reads and writes no data itself.
(function (app) {
  const dialog = /** @type {HTMLDialogElement} */ (document.getElementById("syncDialog"));
  const body = /** @type {HTMLElement} */ (document.getElementById("syncBody"));
  const foot = /** @type {HTMLElement} */ (document.getElementById("syncFoot"));
  const status = /** @type {HTMLElement} */ (document.getElementById("syncStatus"));
  const keyInput = /** @type {HTMLInputElement} */ (document.getElementById("syncKeyInput"));
  const esc = (/** @type {string} */ text) => app.tiles.escape(text);
  /** @param {string} name @param {string} [extra] */
  const icon = (name, extra = "") => `<svg class="ui-icon${extra ? ` ${extra}` : ""}" aria-hidden="true" viewBox="0 0 32 32"><use href="#icon-${name}"></use></svg>`;

  /** @type {MDCSyncDialogHandlers | null} */
  let handlers = null;
  /** @type {MDCSyncView | null} */
  let view = null;
  /** The choice per difference in the merge view, by key. @type {Map<string, MDCSyncChoice | null>} */
  let choices = new Map();
  /** The key file picked in the setup step. */
  let key = { name: "", text: "" };

  const choiceLook = /** @type {Record<MDCSyncChoice, {icon: string, label: string, tone: string}>} */ ({
    "to-google": { icon: "arrow-right", label: "Copy to Google", tone: "right" },
    "to-calendar": { icon: "arrow-left", label: "Copy to the calendar", tone: "left" },
    combine: { icon: "merge", label: "Combine", tone: "right" },
    keep: { icon: "arrow-right", label: "Keep calendar", tone: "right" },
    ignore: { icon: "dash", label: "Ignore", tone: "right" },
    "delete-google": { icon: "trash", label: "Remove from Google", tone: "danger" },
    "delete-calendar": { icon: "trash", label: "Delete in the calendar", tone: "danger" }
  });
  /** Labels of the choices of a conflict, which compare the two sides. */
  const conflictLabels = /** @type {Partial<Record<MDCSyncChoice, string>>} */ ({ "to-calendar": "Take Google", "to-google": "Keep calendar" });
  const reasons = /** @type {Record<string, string>} */ ({
    backlog: "in the backlog", "no-time": "no time", "before-cutover": `before ${app.calendar.formatDay(app.sync.cutover, "DD.MM.YYYY")}`, "all-day": "an all-day event",
    "several-days": "spans several days", series: "a series created in Google", deleted: "deleted", changed: "changed in Google"
  });

  /** @param {MDCSyncDialogHandlers} next */
  function open(next) {
    handlers = next;
    choices = new Map();
    key = { name: "", text: "" };
    if (!dialog.open) dialog.showModal();
    // The dialog itself takes the focus, so that Enter runs the primary action instead of the close button.
    dialog.focus();
  }

  function close() {
    if (dialog.open) dialog.close();
    view = null;
    handlers = null;
  }

  // ---------- Phases ----------

  /** Renders a phase. @param {MDCSyncView} next */
  function render(next) {
    if (next.phase === "review" && view?.phase !== "review") {
      choices = new Map(next.differences.map(difference => [difference.key, difference.preselected]));
    }
    view = next;
    dialog.dataset.phase = next.phase;
    if (next.phase === "setup") renderSetup(next);
    else if (next.phase === "overview") renderOverview(next);
    else if (next.phase === "checking") renderChecking(next);
    else if (next.phase === "review" || next.phase === "applying") renderMerge(next);
    else if (next.phase === "done") renderDone(next);
    else renderError(next);
  }

  /** @param {string} label @param {string} [extra] @param {string} [attributes] */
  const button = (label, extra = "", attributes = "") => `<button class="btn ${extra}" type="button" ${attributes}>${label}</button>`;

  /** @param {Extract<MDCSyncView, {phase: "setup"}>} next */
  function renderSetup(next) {
    const steps = next.steps ? `<ol class="sd__steps">${next.steps.map(step).join("")}</ol>` : "";
    body.innerHTML = `<div class="sd__center">
      <p class="sd__lead">Connect the dedicated Google calendar through its service account.</p>
      <button class="sd__drop" type="button" data-action="pick-key">${icon("upload")}<span>${key.name ? esc(key.name) : "Drop the key file here or choose it"}</span></button>
      <label class="sd__field"><span>Calendar ID</span><input id="syncCalendarId" autocomplete="off" spellcheck="false" placeholder="…@group.calendar.google.com" value="${esc(next.calendarId)}"></label>
      <a class="sd__link" href="https://github.com/Zang3th/MD_Calendar/blob/master/docs/Architecture.md#one-time-setup-in-google-cloud" target="_blank" rel="noopener noreferrer">How to set up Google</a>
      ${steps}
    </div>`;
    const running = Boolean(next.steps?.some(item => item.state === "running"));
    foot.innerHTML = `<span class="sd__sum"></span>${next.cancellable ? button("Cancel", "", 'data-action="overview"') : ""}` +
      button("Connect", "btn--primary", `data-action="connect"${running ? " disabled" : ""}`);
    allowConnect();
  }

  /** @param {{label: string, state: string, count?: string, detail?: string}} item */
  function step(item) {
    return `<li class="sd__step is-${item.state}">${circle(item.state)}<span class="sd__steplabel">${esc(item.label)}</span>` +
      `${item.count ? `<span class="sd__count">${esc(item.count)}</span>` : ""}${item.detail ? `<span class="sd__detail">${esc(item.detail)}</span>` : ""}</li>`;
  }

  /** A 20px state circle. @param {string} state */
  function circle(state) {
    const inner = state === "done" ? icon("check", "sd__draw") : state === "failed" ? icon("close") : state === "open" ? icon("clock")
      : state === "skipped" ? icon("dash") : state === "running" ? '<i class="sd__spin"></i>' : "";
    return `<span class="sd__circle is-${state}" aria-hidden="true">${inner}</span>`;
  }

  function allowConnect() {
    const field = /** @type {HTMLInputElement | null} */ (body.querySelector("#syncCalendarId"));
    const connect = /** @type {HTMLButtonElement | null} */ (foot.querySelector('[data-action="connect"]'));
    if (connect && field && !(view?.phase === "setup" && view.steps?.some(item => item.state === "running"))) connect.disabled = !key.text || !field.value.trim();
  }

  /** @param {Extract<MDCSyncView, {phase: "overview"}>} next */
  function renderOverview(next) {
    const warning = next.interrupted ? `<div class="sd__warning">${icon("info")}<span>The last sync was interrupted after ${next.interrupted.done} of ${next.interrupted.total} changes.</span></div>` : "";
    const unsaved = next.unsaved && !next.interrupted ? `<p class="sd__unsaved">You have ${next.unsaved} unsaved ${next.unsaved === 1 ? "change" : "changes"}.</p>` : "";
    const groups = next.groups.map(group => `<section class="sd__group" aria-label="${esc(group.title)}">` +
      `<dl class="sd__facts">${group.facts.map(([label, value, detail, tone]) => `<dt>${esc(label)}</dt><dd>${esc(value)}${detail ? `<span class="sd__sub${tone ? ` is-${tone}` : ""}">${esc(detail)}</span>` : ""}</dd>`).join("")}</dl></section>`).join("");
    body.innerHTML = `<div class="sd__center sd__overview">${warning}<div class="sd__card">${groups}</div>${unsaved}</div>`;
    const primary = next.interrupted ? button("Complete sync", "btn--primary", 'data-action="complete"')
      : next.unsaved ? button("Save and continue", "btn--primary", 'data-action="save-check"') : button("Check status", "btn--primary", 'data-action="check"');
    foot.innerHTML = `${button("Change setup", "btn--warn", 'data-action="setup"')}<span class="sd__sum"></span>${primary}`;
  }

  /** @param {Extract<MDCSyncView, {phase: "checking"}>} next */
  function renderChecking(next) {
    const steps = `<ol class="sd__steps sd__steps--check">${next.steps.map(step).join("")}</ol>`;
    const notice = next.notice ? `<p class="sd__notice">${esc(next.notice)}</p>` : "";
    if (body.querySelector(".sd__steps--check")) {
      /** @type {HTMLElement} */ (body.querySelector(".sd__steps--check")).outerHTML = steps;
      const old = body.querySelector(".sd__notice");
      if (old) old.outerHTML = notice;
      else if (notice) body.querySelector(".sd__steps--check")?.insertAdjacentHTML("afterend", notice);
      return;
    }
    const skeleton = Array.from({ length: 5 }, () => '<div class="sd__ghost"><i></i><i></i><i></i></div>').join("");
    body.innerHTML = `<div class="sd__center sd__center--check">${steps}${notice}</div><div class="sd__skeleton" aria-hidden="true">${skeleton}</div>`;
    foot.innerHTML = `<span class="sd__sum"></span>${button("Cancel", "", 'data-action="close"')}`;
  }

  /** @param {Extract<MDCSyncView, {phase: "done"}>} next */
  function renderDone(next) {
    const { counts } = next;
    const parts = [`${counts.toGoogle + counts.toCalendar} synchronized`, `${counts.skipped} skipped`, ...(counts.failed ? [`${counts.failed} failed`] : [])];
    const failures = next.failures.length ? `<ul class="sd__failures">${next.failures.map(item => `<li><b>${esc(item.title)}</b><span>${esc(item.reason)}</span></li>`).join("")}</ul>` : "";
    body.innerHTML = `<div class="sd__center sd__result"><span class="sd__big${next.cancelled ? " is-paused" : ""}">${icon(next.cancelled ? "pause" : "check", "sd__draw")}</span>` +
      `<h3>${next.cancelled ? "Sync cancelled" : counts.failed ? "Sync finished with errors" : "Sync complete"}</h3><p>${parts.join(" · ")}</p>${failures}</div>`;
    foot.innerHTML = `<span class="sd__sum"></span>${counts.failed ? button("Retry", "", 'data-action="check"') : ""}${button("Done", "btn--primary", 'data-action="close"')}`;
  }

  /** @param {Extract<MDCSyncView, {phase: "error"}>} next */
  function renderError(next) {
    body.innerHTML = `<div class="sd__center sd__result"><span class="sd__big is-failed">${icon("close")}</span><h3>${esc(next.title)}</h3>` +
      `<p>${esc(next.message)}</p>${next.detail ? `<p class="sd__code">${esc(next.code)} · ${esc(next.detail)}</p>` : `<p class="sd__code">${esc(next.code)}</p>`}</div>`;
    foot.innerHTML = `<span class="sd__sum"></span>${next.retry ? button("Try again", "btn--primary", `data-action="${next.retry}"`) : ""}`;
  }

  // ---------- Merge view ----------

  /** The day group of a difference. @param {MDCSyncDifference} difference */
  function group(difference) {
    if (difference.case === "note") return "Not imported";
    if (difference.kind === "series") return "Series";
    const fields = difference.calendar || difference.google;
    const day = fields?.date || fields?.start || "";
    return day ? app.calendar.formatDay(day.slice(0, 10), "dd DD.MM.") : "Other";
  }

  /** @param {Extract<MDCSyncView, {phase: "review" | "applying"}>} next */
  function renderMerge(next) {
    if (next.phase === "applying" && body.querySelector(".sd__merge")) {
      // The merge view stays; its controls turn into row states and the footer into the progress bar.
      dialog.classList.add("is-applying");
      for (const row of body.querySelectorAll(".sd__row")) setRow(/** @type {HTMLElement} */ (row), next.states[/** @type {HTMLElement} */ (row).dataset.key || ""] || "waiting");
      if (!foot.querySelector(".sd__progress")) foot.innerHTML = progressFoot();
      progress(next.progress);
      return;
    }
    dialog.classList.toggle("is-applying", next.phase === "applying");
    if (!next.differences.length) {
      body.innerHTML = `<div class="sd__center sd__result"><span class="sd__big">${icon("check", "sd__draw")}</span><h3>Everything is in sync</h3></div>`;
      foot.innerHTML = `<span class="sd__sum"></span>${button("Done", "btn--primary", 'data-action="close"')}`;
      return;
    }
    let last = "";
    const rows = next.differences.map(difference => {
      const label = group(difference);
      const head = label !== last ? `<div class="sd__day">${esc(label)}</div>` : "";
      last = label;
      return head + rowHtml(difference, next);
    }).join("");
    body.innerHTML = `<div class="sd__merge"><div class="sd__cols" aria-hidden="true"><span>Calendar</span><span></span><span>Google</span></div>${rows}</div>`;
    if (next.phase === "applying") {
      for (const row of body.querySelectorAll(".sd__row")) setRow(/** @type {HTMLElement} */ (row), next.states[/** @type {HTMLElement} */ (row).dataset.key || ""] || "waiting");
      foot.innerHTML = progressFoot();
      progress(next.progress);
    } else {
      foot.innerHTML = `<span class="sd__sum"></span>${button("Cancel", "", 'data-action="close"')}${button("Apply", "btn--primary", 'data-action="apply"')}`;
      summarize();
    }
  }

  /** The footer while applying: the running operation, “4 / 9” and a determinate bar. */
  function progressFoot() {
    return `<div class="sd__progress"><div class="sd__progresstext"><span class="sd__current"></span><span class="sd__fraction"></span></div><div class="sd__bar"><i></i></div></div>${button("Cancel", "", 'data-action="cancel"')}`;
  }

  /** @param {MDCSyncDifference} difference @param {Extract<MDCSyncView, {phase: "review" | "applying"}>} next */
  function rowHtml(difference, next) {
    const choice = choices.get(difference.key) ?? null;
    const sides = marks(difference, choice);
    const location = difference.calendar && difference.google && difference.calendar.location !== difference.google.location;
    const skipped = difference.case !== "note" && !choice;
    return `<div class="sd__row${skipped ? " is-skipped" : ""}" data-key="${esc(difference.key)}">` +
      `${side(difference, "calendar", sides.calendar, Boolean(location), next.tags)}<div class="sd__ctl">${control(difference, choice)}</div>${side(difference, "google", sides.google, Boolean(location), next.tags)}</div>`;
  }

  /**
   * Which fields each side highlights: the winning side's changed values in the success color, the other side's in the
   * warning color. @param {MDCSyncDifference} difference @param {MDCSyncChoice | null} choice
   */
  function marks(difference, choice) {
    const { calendar, google } = difference;
    const shown = ["time", "date", "start", "end", "title", "location"];
    const differing = calendar && google ? shown.filter(name => (calendar[name] || "") !== (google[name] || ""))
      : (difference.changed?.calendar || []).filter(name => shown.includes(name));
    /** @type {{calendar: Record<string, string>, google: Record<string, string>}} */
    const result = { calendar: {}, google: {} };
    for (const name of differing) {
      const fromGoogle = choice === "to-calendar" || choice === "delete-calendar" || (choice === "combine" && (difference.changed?.google || []).includes(name));
      const winner = !choice ? "" : fromGoogle ? "google" : "calendar";
      result.calendar[name] = winner === "calendar" ? "is-win" : "is-chg";
      result.google[name] = winner === "google" ? "is-win" : "is-chg";
    }
    return result;
  }

  /** The text of a missing side. @param {MDCSyncDifference} difference @param {"calendar" | "google"} which */
  function missing(difference, which) {
    const why = reasons[difference.reason || ""] || "";
    if (difference.case === "note") return which === "calendar" ? `not imported: ${why}` : "";
    if (which === "calendar") {
      if (difference.case === "new-google") return "not in the calendar";
      if (difference.case === "left-local") return why;
      return "deleted";
    }
    if (difference.case === "new-local") return "not in Google";
    if (difference.case === "left-google" || difference.case === "export-changed") return why;
    return "deleted";
  }

  /**
   * One side of a row: time and title, the location only where it differs.
   * @param {MDCSyncDifference} difference @param {"calendar" | "google"} which @param {Record<string, string>} mark
   * @param {boolean} location @param {MDCTag[]} tags
   */
  function side(difference, which, mark, location, tags) {
    const fields = difference[which];
    if (!fields) return `<div class="sd__side sd__side--${which} is-missing">— ${esc(missing(difference, which))}</div>`;
    /** @param {string} name @param {string} text */
    const value = (name, text) => mark[name] ? `<span class="sd__val ${mark[name]}">${text}</span>` : text;
    const time = fields.time !== undefined ? value("time", esc(fields.time.replace("-", "–")))
      : fields.end !== undefined ? value("start", esc(range(fields.start, fields.end)))
        : value("start", esc((fields.start || "").split(" ")[1]?.replace("-", "–") || ""));
    const tag = tags.find(item => item.name === fields.tag);
    const dot = tag ? `<i class="sd__dot" style="--h:${app.configFormat.hue(tag.color)}"></i>` : "";
    const place = location ? `<span class="sd__place">${value("location", esc(fields.location || "no location"))}</span>` : "";
    return `<div class="sd__side sd__side--${which}"><span class="sd__line"><span class="sd__time">${time}</span><b class="sd__title">${dot}${value("title", esc(fields.title || "(no title)"))}</b></span>${place}</div>`;
  }

  /** @param {string} start @param {string} end */
  function range(start, end) {
    const short = (/** @type {string} */ day) => app.calendar.formatDay(day, "DD.MM.");
    return start === end ? short(start) : `${short(start)}–${short(end)}`;
  }

  /** The direction control between the columns. @param {MDCSyncDifference} difference @param {MDCSyncChoice | null} choice */
  function control(difference, choice) {
    if (difference.case === "note") return `<span class="sd__note" role="img" aria-label="${esc(`Not imported: ${reasons[difference.reason || ""] || ""}`)}">${icon("info")}</span>`;
    if (difference.choices.length === 1) {
      const only = difference.choices[0];
      const look = choiceLook[only];
      return `<button class="sd__dir is-${look.tone}" type="button" data-choice="${only}" aria-pressed="${choice === only}" aria-label="${esc(look.label)}">${icon(look.icon)}</button>`;
    }
    const conflict = difference.case === "conflict";
    return `<div class="sd__well${choice ? "" : " is-open"}" role="group" aria-label="Choose">${difference.choices.map(option => {
      const look = choiceLook[option];
      const label = (conflict && conflictLabels[option]) || look.label;
      return `<button class="sd__opt is-${look.tone}" type="button" data-choice="${option}" aria-pressed="${choice === option}" aria-label="${esc(label)}">${icon(look.icon)}</button>`;
    }).join("")}</div>`;
  }

  /** Updates the footer count: selected changes and those still to decide. */
  function summarize() {
    if (view?.phase !== "review") return;
    let selected = 0;
    let open = 0;
    for (const difference of view.differences) {
      if (difference.case === "note") continue;
      if (choices.get(difference.key)) selected += 1;
      else if (difference.preselected === null) open += 1;
    }
    const sum = foot.querySelector(".sd__sum");
    if (sum) {
      sum.innerHTML = `<b>${selected}</b> ${selected === 1 ? "change" : "changes"} selected${open ? ` · <span class="sd__open">${open} to decide</span>` : ""}`;
    }
    const apply = /** @type {HTMLButtonElement | null} */ (foot.querySelector('[data-action="apply"]'));
    if (apply) {
      apply.disabled = selected === 0;
      apply.textContent = `Apply ${selected} ${selected === 1 ? "change" : "changes"}`;
    }
  }

  /** Changes the choice of a row and renders only that row. @param {HTMLElement} row @param {MDCSyncChoice} picked */
  function choose(row, picked) {
    if (view?.phase !== "review") return;
    const keyOf = row.dataset.key || "";
    const difference = view.differences.find(item => item.key === keyOf);
    if (!difference) return;
    choices.set(keyOf, choices.get(keyOf) === picked ? null : picked);
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.choice : "";
    const template = document.createElement("template");
    template.innerHTML = rowHtml(difference, view);
    const replacement = /** @type {HTMLElement} */ (template.content.firstElementChild);
    row.replaceWith(replacement);
    /** @type {HTMLElement | null} */ (replacement.querySelector(`[data-choice="${focused}"]`))?.focus();
    summarize();
  }

  /** The state of a row while applying. @param {HTMLElement} row @param {string} state */
  function setRow(row, state) {
    const ctl = row.querySelector(".sd__ctl");
    if (!ctl || ctl.getAttribute("data-state") === state) return;
    ctl.setAttribute("data-state", state);
    ctl.innerHTML = circle(state);
    ctl.setAttribute("aria-label", state);
  }

  /** Updates the state of one row while applying. @param {string} rowKey @param {string} state */
  function rowState(rowKey, state) {
    const row = /** @type {HTMLElement | null} */ (body.querySelector(`.sd__row[data-key="${CSS.escape(rowKey)}"]`));
    if (row) setRow(row, state);
  }

  /** @param {{done: number, total: number, label: string}} value */
  function progress(value) {
    const bar = /** @type {HTMLElement | null} */ (foot.querySelector(".sd__bar i"));
    if (bar) bar.style.transform = `scaleX(${value.total ? value.done / value.total : 0})`;
    const current = foot.querySelector(".sd__current");
    if (current) current.textContent = value.label;
    const fraction = foot.querySelector(".sd__fraction");
    if (fraction) fraction.textContent = `${value.done} / ${value.total}`;
  }

  /** Shows a wait Google asked for next to the title; an empty text hides it. @param {string} text */
  function notice(text) {
    status.textContent = text;
  }

  // ---------- Events ----------

  dialog.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !handlers) return;
    if (target.closest("#syncClose")) {
      if (view?.phase !== "applying") handlers.close();
      return;
    }
    const choiceButton = /** @type {HTMLElement | null} */ (target.closest("[data-choice]"));
    if (choiceButton) {
      choose(/** @type {HTMLElement} */ (choiceButton.closest(".sd__row")), /** @type {MDCSyncChoice} */ (choiceButton.dataset.choice));
      return;
    }
    const action = /** @type {HTMLElement | null} */ (target.closest("[data-action]"))?.dataset.action;
    if (!action) return;
    const field = /** @type {HTMLInputElement | null} */ (body.querySelector("#syncCalendarId"));
    if (action === "pick-key") keyInput.click();
    else if (action === "connect") handlers.connect(key.text, field?.value.trim() || "");
    else if (action === "close") handlers.close();
    else if (action === "overview") handlers.overview();
    else if (action === "setup") handlers.setup();
    else if (action === "check") handlers.check();
    else if (action === "save-check") handlers.saveAndCheck();
    else if (action === "complete") handlers.complete();
    else if (action === "cancel") {
      handlers.cancel();
      const cancel = /** @type {HTMLButtonElement | null} */ (foot.querySelector('[data-action="cancel"]'));
      if (cancel) cancel.disabled = true;
      const current = foot.querySelector(".sd__current");
      if (current) current.textContent = "Cancelling after the current change…";
    } else if (action === "apply") handlers.apply(Object.fromEntries(choices));
  });

  body.addEventListener("input", allowConnect);

  /** @param {File | undefined} file */
  async function takeKey(file) {
    if (!file) return;
    key = { name: file.name, text: await file.text() };
    const label = body.querySelector(".sd__drop span");
    if (label) label.textContent = file.name;
    allowConnect();
  }

  keyInput.addEventListener("change", () => {
    const file = keyInput.files?.[0];
    keyInput.value = "";
    void takeKey(file);
  });
  body.addEventListener("dragover", event => {
    if (view?.phase !== "setup") return;
    event.preventDefault();
    body.querySelector(".sd__drop")?.classList.add("is-over");
  });
  body.addEventListener("dragleave", () => body.querySelector(".sd__drop")?.classList.remove("is-over"));
  body.addEventListener("drop", event => {
    if (view?.phase !== "setup") return;
    event.preventDefault();
    body.querySelector(".sd__drop")?.classList.remove("is-over");
    void takeKey(event.dataTransfer?.files[0]);
  });

  // A press on the backdrop closes like the close button while nothing runs: not while connecting, checking or applying.
  const busy = () => view?.phase === "checking" || view?.phase === "applying" ||
    (view?.phase === "setup" && Boolean(view.steps) && !view.steps?.some(item => item.state === "failed"));
  modal.closeOnBackdrop({ dialog, close: () => handlers?.close(), when: () => !busy() });

  // Escape closes like the close button, except while applying, which only Cancel ends (docs/ui/Shell.md#sync-dialog).
  dialog.addEventListener("cancel", event => {
    event.preventDefault();
    if (view?.phase !== "applying") handlers?.close();
  });

  // Enter runs the primary action of the footer, unless it lands on a button or link, which act on their own. It is
  // heard on the document: a phase replaces the content, and the focus then falls back to the page.
  document.addEventListener("keydown", event => {
    if (!dialog.open || event.key !== "Enter" || event.isComposing || !handlers) return;
    if (event.target instanceof Element && event.target.closest("button, a")) return;
    const primary = /** @type {HTMLButtonElement | null} */ (foot.querySelector(".btn--primary:not(:disabled)"));
    if (!primary) return;
    event.preventDefault();
    primary.click();
  });

  // Arrow keys move between the rows of the merge view; Space toggles the focused control.
  body.addEventListener("keydown", event => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const rows = Array.from(body.querySelectorAll(".sd__row")).filter(row => row.querySelector("button"));
    const current = rows.findIndex(row => row.contains(document.activeElement));
    const next = rows[current < 0 ? 0 : Math.max(0, Math.min(rows.length - 1, current + (event.key === "ArrowDown" ? 1 : -1)))];
    if (!next) return;
    event.preventDefault();
    /** @type {HTMLElement | null} */ (next.querySelector('button[aria-pressed="true"], button'))?.focus();
  });

  app.syncDialog = { open, close, render, rowState, progress, notice, isOpen: () => dialog.open };
})(window.MDCalendar);
