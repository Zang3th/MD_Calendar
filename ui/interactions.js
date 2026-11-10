window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Pointer, touch and keyboard input (docs/ui/Interaction.md). Turns DOM events into handler calls.
(function (app) {
  /** @type {MDCInteractionHandlers | null} */
  let handlers = null;
  /** @type {Array<{destroy(): void}>} */
  let sortables = [];
  /** Selected tiles by their identity ("d:key:index", "g:group:index", "s:series:key"). @type {Set<string>} */
  const selection = new Set();
  /** Day under the pointer, for N and Ctrl+V. */
  let hoveredDay = "";
  const main = /** @type {HTMLElement} */ (document.querySelector(".main"));
  const lasso = /** @type {HTMLElement} */ (document.getElementById("lasso"));

  /** A list's place: a day or a backlog group. @param {HTMLElement} list @param {number} index @returns {MDCEntryRef} */
  function place(list, index) {
    return list.dataset.group === undefined ? { key: list.dataset.day || "", index } : { key: "", group: Number(list.dataset.group), index };
  }

  /** @param {Element} element @returns {MDCEntryRef} */
  function entryRef(element) {
    const tile = /** @type {HTMLElement} */ (element.closest(".ev"));
    return place(/** @type {HTMLElement} */ (tile.closest(".day__list, .bl__list")), Number(tile.dataset.index));
  }

  /** @param {HTMLElement} tile @returns {MDCPick} */
  function pickOf(tile) {
    if (tile.classList.contains("ev--series")) return { series: Number(tile.dataset.series), key: tile.dataset.key || "" };
    const ref = entryRef(tile);
    return { ref, key: ref.key };
  }

  /** @param {MDCPick} pick */
  function idOf(pick) {
    if (pick.series !== undefined) return `s:${pick.series}:${pick.key}`;
    const ref = /** @type {MDCEntryRef} */ (pick.ref);
    return ref.group === undefined ? `d:${ref.key}:${ref.index}` : `g:${ref.group}:${ref.index}`;
  }

  /** @param {string} id @returns {MDCPick} */
  function pickFromId(id) {
    const [kind, first, second] = id.split(":");
    if (kind === "s") return { series: Number(first), key: second };
    return kind === "d" ? { ref: { key: first, index: Number(second) }, key: first } : { ref: { key: "", group: Number(first), index: Number(second) }, key: "" };
  }

  function tiles() {
    return /** @type {HTMLElement[]} */ (Array.from(document.querySelectorAll(".day__list .ev, .bl__list .ev")));
  }

  /** Marks the selected tiles again after a render. */
  function refreshSelection() {
    for (const tile of tiles()) tile.classList.toggle("is-selected", selection.has(idOf(pickOf(tile))));
  }

  function clearSelection() {
    if (!selection.size) return;
    selection.clear();
    refreshSelection();
  }

  /** The picks an action applies to: the selection when `tile` belongs to it, otherwise `tile` alone. @param {HTMLElement | null} tile */
  function targets(tile) {
    if (tile && !selection.has(idOf(pickOf(tile)))) return [pickOf(tile)];
    return Array.from(selection, pickFromId);
  }

  /** @param {EventTarget | null} target */
  function isTextField(target) {
    return target instanceof HTMLElement && (target.isContentEditable || target.matches("input, textarea, select"));
  }

  /** @param {Element} element */
  function dayOf(element) {
    const cell = /** @type {HTMLElement | null} */ (element.closest(".day[data-day], .mcell[data-day]"));
    return cell?.dataset.day || "";
  }

  /** @type {Record<string, (current: MDCInteractionHandlers) => void>} */
  const buttons = {
    pick: current => current.pickFolder(),
    reopen: current => current.reopenFolder(),
    title: current => current.today(),
    viewWeek: current => current.showView("week"),
    viewMonth: current => current.showView("month"),
    viewContacts: current => current.showView("contacts"),
    new: current => current.newEntry(),
    undo: current => current.undo(),
    redo: current => current.redo(),
    save: current => current.save(),
    sound: current => current.toggleSound(),
    backlogToggle: current => current.toggleBacklog(),
    holidaysButton: current => current.toggleHolidays(),
    helpButton: current => current.showHelp()
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
    if (tile && (event.ctrlKey || event.metaKey)) {
      // Ctrl+click adds a tile to the selection or removes it (docs/ui/Interaction.md#selection).
      const id = idOf(pickOf(tile));
      if (selection.has(id)) selection.delete(id);
      else selection.add(id);
      refreshSelection();
      return;
    }
    if (action) action(current);
    else if (tile?.classList.contains("ev--series")) {
      const index = Number(tile.dataset.series);
      const key = tile.dataset.key || "";
      if (button.classList.contains("ev__check")) current.toggleOccurrence(index, key);
      else current.openOccurrence(index, key);
    } else if (button.classList.contains("ev__check") && tile) current.toggle(entryRef(button));
    else if (button.classList.contains("ev__open") && tile) current.openEntry(entryRef(button));
    else if (button.dataset.more) current.openWeek(button.dataset.more);
    else if (button.dataset.multi) current.openMultiDay(Number(button.dataset.multi));
    else if (button.dataset.contact && button.classList.contains("badge")) current.openContact(Number(button.dataset.contact));
  });

  // Double-clicking free space of a day creates an entry on that day (docs/ui/Interaction.md#creating).
  document.addEventListener("dblclick", event => {
    if (!handlers || !(event.target instanceof Element) || event.target.closest(".ev, .bar, button, a, input")) return;
    const key = dayOf(event.target);
    if (key) handlers.newEntry(key);
  });

  document.addEventListener("contextmenu", event => {
    const current = handlers;
    if (!current || !(event.target instanceof Element) || isTextField(event.target)) return;
    const tile = /** @type {HTMLElement | null} */ (event.target.closest(".day__list .ev, .bl__list .ev"));
    const key = dayOf(event.target);
    if (!tile && !key) return;
    event.preventDefault();
    if (tile) current.contextMenu(targets(tile), event.clientX, event.clientY, "");
    else current.contextMenu([], event.clientX, event.clientY, key);
  });

  document.addEventListener("pointermove", event => {
    if (event.target instanceof Element) hoveredDay = dayOf(event.target) || hoveredDay;
  }, { passive: true });
  main.addEventListener("pointerleave", () => { hoveredDay = ""; });

  /** Shortcut keys without modifiers (docs/ui/Interaction.md#keyboard-shortcuts). @type {Record<string, (current: MDCInteractionHandlers) => void>} */
  const keys = {
    h: current => current.today(),
    n: current => current.newEntry(current.isContactsView() ? undefined : hoveredDay || undefined),
    w: current => current.showView("week"),
    m: current => current.showView("month"),
    k: current => current.showView("contacts"),
    b: current => current.toggleBacklog(),
    f: current => current.toggleSearch(),
    "?": current => current.showHelp(),
    arrowleft: current => current.previous(),
    arrowright: current => current.next(),
    " ": current => { if (selection.size) current.toggleMany(targets(null)); },
    delete: current => {
      if (!selection.size) return;
      const picks = targets(null);
      clearSelection();
      current.removeMany(picks);
    },
    escape: () => clearSelection()
  };

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
    if (app.dialog.isOpen() || app.menus.isModalOpen() || isTextField(event.target)) return;
    if (modifier && !event.altKey) {
      if (key === "y" || (key === "z" && event.shiftKey)) current.redo();
      else if (key === "z") current.undo();
      else if (key === "c" && selection.size) current.copy(targets(null));
      else if (key === "v") current.paste(hoveredDay);
      else if (key === "a" && !current.isContactsView()) {
        for (const tile of tiles()) if (tile.closest(".main")) selection.add(idOf(pickOf(tile)));
        refreshSelection();
      } else return;
      event.preventDefault();
      return;
    }
    if (event.altKey || (event.repeat && key !== "arrowleft" && key !== "arrowright")) return;
    const action = keys[key === "?" || event.key === "?" ? "?" : key];
    if (!action || (current.isContactsView() && ["arrowleft", "arrowright", " ", "delete"].includes(key))) return;
    action(current);
    event.preventDefault();
  });

  /** Position among the normal entries of a list; occurrences and other moved tiles above it do not count. @param {HTMLElement} item @param {Set<HTMLElement>} skip */
  function entryPosition(item, skip) {
    let position = 0;
    for (let sibling = item.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
      if (sibling.classList.contains("ev") && !sibling.classList.contains("ev--series") && !skip.has(/** @type {HTMLElement} */ (sibling))) position += 1;
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
      /** @param {{from: HTMLElement, to: HTMLElement, item: HTMLElement, oldIndex: number}} event */
      onEnd(event) {
        const from = place(event.from, Number(event.item.dataset.index));
        const id = idOf({ ref: from, key: from.key });
        const others = selection.has(id) ? tiles().filter(tile => tile !== event.item && selection.has(idOf(pickOf(tile))) && !tile.classList.contains("ev--series")) : [];
        if (!others.length) {
          handlers?.move(from, place(event.to, entryPosition(event.item, new Set())));
          return;
        }
        // A selected tile drags the whole selection along (docs/ui/Interaction.md#selection).
        const picks = Array.from(selection, pickFromId).filter(pick => pick.ref);
        const sameList = new Set(others.filter(tile => tile.parentElement === event.to));
        const target = place(event.to, entryPosition(event.item, sameList));
        selection.clear();
        handlers?.moveMany(picks.map(pick => /** @type {MDCEntryRef} */ (pick.ref)), from, target);
      }
    }));
  }

  // ---------- Lasso: dragging on free space selects the tiles it touches ----------

  /** @type {{x: number, y: number, pointer: number, additive: boolean, base: Set<string>} | null} */
  let lassoStart = null;
  let lassoFrame = 0;
  /** @type {PointerEvent | null} */
  let lassoEvent = null;

  /** One frame per pointer move: read the tile boxes, then write the classes. */
  function updateLasso() {
    lassoFrame = 0;
    if (!lassoStart || !lassoEvent) return;
    const left = Math.min(lassoStart.x, lassoEvent.clientX);
    const top = Math.min(lassoStart.y, lassoEvent.clientY);
    const right = Math.max(lassoStart.x, lassoEvent.clientX);
    const bottom = Math.max(lassoStart.y, lassoEvent.clientY);
    const hits = tiles().filter(tile => {
      const box = tile.getBoundingClientRect();
      return box.right > left && box.left < right && box.bottom > top && box.top < bottom;
    });
    lasso.hidden = false;
    lasso.style.transform = `translate(${left}px, ${top}px)`;
    lasso.style.width = `${right - left}px`;
    lasso.style.height = `${bottom - top}px`;
    selection.clear();
    for (const id of lassoStart.base) selection.add(id);
    for (const tile of hits) selection.add(idOf(pickOf(tile)));
    refreshSelection();
  }

  document.addEventListener("pointerdown", event => {
    if (event.button !== 0 || event.pointerType === "touch" || !(event.target instanceof Element) || !handlers) return;
    const free = event.target.closest(".day, .mcell, .wk, .month, .bl") && !event.target.closest(".ev, .bar, button, a, input, .more");
    if (!free) {
      if (!event.target.closest(".ev, .menu") && !(event.ctrlKey || event.metaKey)) clearSelection();
      return;
    }
    const additive = event.ctrlKey || event.metaKey;
    if (!additive) clearSelection();
    lassoStart = { x: event.clientX, y: event.clientY, pointer: event.pointerId, additive, base: new Set(selection) };
  });
  document.addEventListener("pointermove", event => {
    if (!lassoStart || event.pointerId !== lassoStart.pointer) return;
    if (lasso.hidden && Math.hypot(event.clientX - lassoStart.x, event.clientY - lassoStart.y) < 6) return;
    lassoEvent = event;
    if (!lassoFrame) lassoFrame = requestAnimationFrame(updateLasso);
  });
  /** @param {PointerEvent} event */
  function endLasso(event) {
    if (!lassoStart || event.pointerId !== lassoStart.pointer) return;
    // A fast drag may end before its frame ran; apply the last position first.
    if (lassoFrame) {
      cancelAnimationFrame(lassoFrame);
      updateLasso();
    }
    if (!lasso.hidden) {
      suppressClick = true;
      window.setTimeout(() => { suppressClick = false; }, 0);
    }
    lassoStart = null;
    lassoEvent = null;
    lasso.hidden = true;
  }
  document.addEventListener("pointerup", endLasso);
  document.addEventListener("pointercancel", endLasso);

  // ---------- Occurrences cannot be moved: dragging one explains why ----------

  /** @type {{x: number, y: number, shown: boolean} | null} */
  let seriesDrag = null;
  document.addEventListener("pointerdown", event => {
    const tile = event.target instanceof Element ? event.target.closest(".ev--series") : null;
    seriesDrag = tile && event.button === 0 && !(event.target instanceof Element && event.target.closest(".ev__check")) ? { x: event.clientX, y: event.clientY, shown: false } : null;
  });
  document.addEventListener("pointermove", event => {
    if (!seriesDrag || seriesDrag.shown || Math.hypot(event.clientX - seriesDrag.x, event.clientY - seriesDrag.y) < 12) return;
    seriesDrag.shown = true;
    suppressClick = true;
    window.setTimeout(() => { suppressClick = false; }, 0);
    handlers?.notice("Serientermine sind nicht verschiebbar");
  });
  document.addEventListener("pointerup", () => { seriesDrag = null; });

  // ---------- Mouse wheel: one week or month per gesture ----------

  let wheelLocked = false;
  let wheelTimer = 0;
  let wheelSum = 0;

  /** Whether an element between the target and the board can still scroll in that direction. @param {Element} target @param {number} delta */
  function canScroll(target, delta) {
    for (let element = /** @type {Element | null} */ (target); element && element !== main; element = element.parentElement) {
      if (element.scrollHeight > element.clientHeight + 1 && getComputedStyle(element).overflowY !== "visible") {
        if (delta > 0 ? element.scrollTop + element.clientHeight < element.scrollHeight - 1 : element.scrollTop > 0) return true;
      }
    }
    return false;
  }

  main.addEventListener("wheel", event => {
    const current = handlers;
    if (!current || current.isContactsView() || event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    if (!(event.target instanceof Element) || !event.target.closest(".wk, .month") || canScroll(event.target, event.deltaY)) return;
    event.preventDefault();
    window.clearTimeout(wheelTimer);
    // The gesture ends when the wheel rests; until then further events do not navigate again.
    wheelTimer = window.setTimeout(() => {
      wheelLocked = false;
      wheelSum = 0;
    }, 220);
    if (wheelLocked) return;
    wheelSum += event.deltaY;
    if (Math.abs(wheelSum) < 30) return;
    wheelLocked = true;
    if (wheelSum > 0) current.next();
    else current.previous();
  }, { passive: false });

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
    if (drag.mode === "move") drag.next = { start: app.calendar.addDays(drag.start, days), end: app.calendar.addDays(drag.end, days) };
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

  app.interactions = {
    init, bindLists, refreshSelection, clearSelection,
    selected: () => Array.from(selection, pickFromId),
    sortableReady: () => typeof Sortable === "function"
  };
})(window.MDCalendar);
