window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Pointer, touch and keyboard input (docs/ui/Interaction.md). Turns DOM events into handler calls.
(function (app) {
  /** @type {MDCInteractionHandlers | null} */
  let handlers = null;
  /** @type {Array<{destroy(): void}>} */
  let sortables = [];

  /** A list's place: a day or a backlog group. @param {HTMLElement} list @param {number} index @returns {MDCEntryRef} */
  function place(list, index) {
    return list.dataset.group === undefined ? { key: list.dataset.day || "", index } : { key: "", group: Number(list.dataset.group), index };
  }

  /** @param {Element} element @returns {MDCEntryRef} */
  function entryRef(element) {
    const tile = /** @type {HTMLElement} */ (element.closest(".ev"));
    return place(/** @type {HTMLElement} */ (element.closest(".day__list, .bl__list")), Number(tile.dataset.index));
  }

  /** @param {EventTarget | null} target */
  function isTextField(target) {
    return target instanceof HTMLElement && (target.isContentEditable || target.matches("input, textarea, select"));
  }

  /** @type {Record<string, (current: MDCInteractionHandlers) => void>} */
  const buttons = {
    pick: current => current.pickFolder(),
    reopen: current => current.reopenFolder(),
    title: current => current.today(),
    prev: current => current.previous(),
    next: current => current.next(),
    viewWeek: current => current.showView("week"),
    viewMonth: current => current.showView("month"),
    new: current => current.newEntry(),
    undo: current => current.undo(),
    redo: current => current.redo(),
    save: current => current.save(),
    sound: current => current.toggleSound(),
    backlogToggle: current => current.toggleBacklog(),
    holidaysButton: current => current.toggleHolidays()
  };

  /** Set while a bar is dragged, so that the click ending the drag does not open the dialog. */
  let suppressClick = false;

  document.addEventListener("click", event => {
    const current = handlers;
    if (!current || !(event.target instanceof Element)) return;
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    const button = event.target.closest("button");
    if (!button || button.disabled) return;
    const action = buttons[button.id];
    const tile = /** @type {HTMLElement | null} */ (button.closest(".ev"));
    if (action) action(current);
    else if (tile?.classList.contains("ev--series")) {
      const index = Number(tile.dataset.series);
      const key = tile.dataset.key || "";
      if (button.classList.contains("ev__check")) current.toggleOccurrence(index, key);
      else current.openOccurrence(index, key);
    } else if (button.classList.contains("ev__check")) current.toggle(entryRef(button));
    else if (button.classList.contains("ev__open")) current.openEntry(entryRef(button));
    else if (button.dataset.add) current.newEntry(button.dataset.add);
    else if (button.dataset.more) current.openWeek(button.dataset.more);
    else if (button.dataset.multi) current.openMultiDay(Number(button.dataset.multi));
  });

  document.addEventListener("keydown", event => {
    const current = handlers;
    if (!current || document.body.dataset.startupState === "blocked") return;
    const key = event.key.toLowerCase();
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && !event.altKey && key === "s") {
      event.preventDefault();
      current.save();
      return;
    }
    if (app.dialog.isOpen() || isTextField(event.target)) return;
    if (modifier && !event.altKey) {
      if (key === "y" || (key === "z" && event.shiftKey)) { event.preventDefault(); current.redo(); }
      else if (key === "z") { event.preventDefault(); current.undo(); }
      return;
    }
    if (event.altKey || (event.repeat && key !== "arrowleft" && key !== "arrowright")) return;
    if (key === "t") current.today();
    else if (key === "n") current.newEntry();
    else if (key === "w") current.showView("week");
    else if (key === "m") current.showView("month");
    else if (key === "b") current.toggleBacklog();
    else if (key === "arrowleft") current.previous();
    else if (key === "arrowright") current.next();
    else return;
    event.preventDefault();
  });

  /** Position among the normal entries of a list; occurrences above them do not count. @param {HTMLElement} item */
  function entryPosition(item) {
    let position = 0;
    for (let sibling = item.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
      if (sibling.classList.contains("ev") && !sibling.classList.contains("ev--series")) position += 1;
    }
    return position;
  }

  /** Makes the day lists sortable within and between days; occurrences stay in place. @param {HTMLElement[]} lists */
  function bindLists(lists) {
    sortables.forEach(sortable => sortable.destroy());
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    sortables = lists.map(list => Sortable.create(list, {
      group: "day-lists",
      animation: reduced ? 0 : 150,
      delay: 180,
      delayOnTouchOnly: true,
      fallbackTolerance: 3,
      filter: ".ev__check, .ev--series",
      preventOnFilter: false,
      ghostClass: "ev--ghost",
      dragClass: "ev--drag",
      /** @param {{from: HTMLElement, to: HTMLElement, item: HTMLElement}} event */
      onEnd(event) {
        handlers?.move(place(event.from, Number(event.item.dataset.index)), place(event.to, entryPosition(event.item)));
      }
    }));
  }

  // ---------- Dragging multi-day bars: move, or change start or end at the bar's ends ----------

  const edgeSize = 10;
  /** @type {{bar: HTMLElement, pointer: number, x: number, y: number, mode: "move" | "start" | "end", from: string, start: string, end: string, next: {start: string, end: string}, moved: boolean} | null} */
  let drag = null;

  /** Day key under a viewport point, from the day card or month cell there. @param {number} x @param {number} y */
  function dayAt(x, y) {
    for (const element of document.elementsFromPoint(x, y)) {
      const cell = element.closest(".day[data-day], .mcell[data-day]");
      if (cell instanceof HTMLElement) return cell.dataset.day || "";
    }
    return "";
  }

  /** Which part of a bar a point is on; ends that continue into another week cannot be dragged. @param {HTMLElement} bar @param {number} x @param {number} y */
  function partAt(bar, x, y) {
    const bounds = bar.getBoundingClientRect();
    const vertical = bounds.height > bounds.width;
    const offset = vertical ? y - bounds.top : x - bounds.left;
    const length = vertical ? bounds.height : bounds.width;
    if (offset < edgeSize && !bar.classList.contains("cont-l")) return { mode: /** @type {const} */ ("start"), vertical };
    if (offset > length - edgeSize && !bar.classList.contains("cont-r")) return { mode: /** @type {const} */ ("end"), vertical };
    return { mode: /** @type {const} */ ("move"), vertical };
  }

  /** @param {string} key @param {number} days */
  function shift(key, days) {
    return app.calendar.addDays(key, days);
  }

  /** @param {string} from @param {string} to */
  function distance(from, to) {
    return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);
  }

  /** Marks the days the dragged bar would cover. @param {{start: string, end: string} | null} range */
  function markTargets(range) {
    document.querySelectorAll(".is-drop-target").forEach(element => element.classList.remove("is-drop-target"));
    if (!range) return;
    for (const element of document.querySelectorAll(".day[data-day], .mcell[data-day]")) {
      const key = /** @type {HTMLElement} */ (element).dataset.day || "";
      if (key >= range.start && key <= range.end) element.classList.add("is-drop-target");
    }
  }

  document.addEventListener("pointermove", event => {
    if (drag) return;
    const bar = event.target instanceof Element ? /** @type {HTMLElement | null} */ (event.target.closest(".bar")) : null;
    if (!bar) return;
    const part = partAt(bar, event.clientX, event.clientY);
    bar.style.cursor = part.mode === "move" ? "grab" : part.vertical ? "ns-resize" : "ew-resize";
  });

  document.addEventListener("pointerdown", event => {
    const bar = event.target instanceof Element ? /** @type {HTMLElement | null} */ (event.target.closest(".bar")) : null;
    if (!bar || !handlers || event.button !== 0) return;
    const from = dayAt(event.clientX, event.clientY);
    if (!from) return;
    const start = bar.dataset.start || "";
    const end = bar.dataset.end || "";
    drag = { bar, pointer: event.pointerId, x: event.clientX, y: event.clientY, mode: partAt(bar, event.clientX, event.clientY).mode, from, start, end, next: { start, end }, moved: false };
    bar.setPointerCapture(event.pointerId);
  });

  document.addEventListener("pointermove", event => {
    if (!drag || event.pointerId !== drag.pointer) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 4) return;
    drag.moved = true;
    drag.bar.classList.add("is-dragging");
    const key = dayAt(event.clientX, event.clientY);
    if (!key) return;
    const days = distance(drag.from, key);
    if (drag.mode === "move") drag.next = { start: shift(drag.start, days), end: shift(drag.end, days) };
    else if (drag.mode === "start") drag.next = { start: key < drag.end ? key : drag.end, end: drag.end };
    else drag.next = { start: drag.start, end: key > drag.start ? key : drag.start };
    markTargets(drag.next);
  });

  /** @param {PointerEvent} event */
  function endDrag(event) {
    if (!drag || event.pointerId !== drag.pointer) return;
    const finished = drag;
    drag = null;
    finished.bar.classList.remove("is-dragging");
    markTargets(null);
    if (!finished.moved) return;
    suppressClick = event.type === "pointerup";
    window.setTimeout(() => { suppressClick = false; }, 0);
    if (event.type === "pointerup" && (finished.next.start !== finished.start || finished.next.end !== finished.end)) {
      handlers?.moveMultiDay(Number(finished.bar.dataset.multi), finished.next.start, finished.next.end);
    }
  }
  document.addEventListener("pointerup", endDrag);
  document.addEventListener("pointercancel", endDrag);

  /** @param {MDCInteractionHandlers} next */
  function init(next) {
    handlers = next;
  }

  app.interactions = { init, bindLists, sortableReady: () => typeof Sortable === "function" };
})(window.MDCalendar);
