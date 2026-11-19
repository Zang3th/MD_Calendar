import Sortable from "sortablejs/Sortable.min.js";
import { keymap, sortable } from "@zang3th/md-libs/ui";

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
    return /** @type {HTMLElement[]} */ (Array.from(document.querySelectorAll(":is(.day__list, .bl__list) .ev:not(.drag-preview *)")));
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

  /** @param {Element} element */
  function dayOf(element) {
    const cell = /** @type {HTMLElement | null} */ (element.closest(".day[data-day], .mcell[data-day], .focus__card[data-day]"));
    return cell?.dataset.day || "";
  }

  /**
   * The backlog place at `element` and the point `x`, `y`: the list of the group under it, or of the group nearest to the
   * point on free space between groups (the ungrouped entries sit at the title), and the position among its tiles, before
   * the first tile whose middle lies below `y`; null outside the backlog panel.
   * @param {Element} element @param {number} x @param {number} y
   * @returns {MDCEntryRef | null}
   */
  function backlogPlace(element, x, y) {
    const panel = element.closest("#backlog");
    if (!panel) return null;
    const list = element.closest(".bl__list") || element.closest(".bl__group")?.querySelector(".bl__list") || nearestGroup(panel, x, y)?.querySelector(".bl__list");
    if (!(list instanceof HTMLElement)) return null;
    const index = Array.from(list.children).filter(tile => {
      if (!tile.classList.contains("ev")) return false;
      const bounds = tile.getBoundingClientRect();
      return bounds.top + bounds.height / 2 < y;
    }).length;
    return { key: "", group: Number(list.dataset.group), index };
  }

  /** The group section nearest to a point, by the distance to its box; the empty ungrouped list counts at the title. @param {Element} panel @param {number} x @param {number} y */
  function nearestGroup(panel, x, y) {
    let best = null;
    let distance = Infinity;
    for (const section of panel.querySelectorAll(".bl__group")) {
      const box = (section.classList.contains("bl__group--ungrouped") && section.querySelector(".bl__list:empty")) ? /** @type {Element} */ (panel.querySelector(".backlog__title")).getBoundingClientRect() : section.getBoundingClientRect();
      const away = Math.hypot(Math.max(0, box.left - x, x - box.right), Math.max(0, box.top - y, y - box.bottom));
      if (away < distance) {
        distance = away;
        best = section;
      }
    }
    return best;
  }

  /** The backlog place under the pointer, for keys that act there (docs/ui/Interaction.md#keyboard-shortcuts). */
  function hoveredBacklogPlace() {
    const element = pointer && document.elementFromPoint(pointer.x, pointer.y);
    return element && pointer ? backlogPlace(element, pointer.x, pointer.y) : null;
  }

  /** Where Ctrl+V pastes: the backlog place or the day under the pointer, else the preselected day. @returns {MDCEntryRef | null} */
  function pasteTarget() {
    return hoveredBacklogPlace() || (hoveredDay ? { key: hoveredDay, index: 0 } : null);
  }

  /** The day whose body (below its header, outside tiles and bars) contains `element`. @param {Element} element */
  function bodyDay(element) {
    return element.closest(".day__head, .mcell__head, .focus__head, .ev, .bar, button, a, input") ? "" : dayOf(element);
  }

  /** Set when the current click began with a selection or an open menu or panel; that click only clears or closes it. */
  let clickClears = false;
  const floating = ["contextMenu", "optionsMenu", "helpPanel", "holidaysPanel", "occasionsPanel", "searchPanel"].map(id => /** @type {HTMLElement} */ (document.getElementById(id)));
  // Capture phase: runs before the menus and panels close on this pointerdown.
  /** Where the last press began, so that a drag preview keeps the grabbed point under the pointer. */
  let press = { x: 0, y: 0 };
  document.addEventListener("pointerdown", event => {
    clickClears = selection.size > 0 || floating.some(element => !element.hidden);
    press = { x: event.clientX, y: event.clientY };
  }, true);

  /** @type {Record<string, (current: MDCInteractionHandlers) => void>} */
  const buttons = {
    pick: current => current.pickFolder(),
    create: current => current.createCalendar(),
    logo: current => current.showStart(),
    title: current => current.today(),
    viewWeek: current => current.showView("week"),
    viewMonth: current => current.showView("month"),
    viewContacts: current => current.showView("contacts"),
    new: current => current.showNewMenu(),
    undo: current => current.undo(),
    redo: current => current.redo(),
    save: current => current.save(),
    sound: current => current.toggleSound(),
    backlogToggle: current => current.toggleBacklog(),
    holidaysButton: current => current.toggleHolidays(),
    helpButton: current => current.showHelp(),
    optionsButton: current => current.showOptions()
  };

  // The calendar import reads the chosen .ics file (docs/ui/Shell.md#header).
  const icsInput = /** @type {HTMLInputElement} */ (document.getElementById("icsImport"));
  icsInput.addEventListener("change", () => {
    const file = icsInput.files?.[0];
    icsInput.value = "";
    const current = handlers;
    if (!file || !current) return;
    void file.text().then(text => current.importCalendar(text, file.name));
  });

  /** Set while a bar is dragged, so that the click ending the drag does not open the dialog. */
  let suppressClick = false;

  document.addEventListener("click", event => {
    const current = handlers;
    if (!current || !(event.target instanceof Element)) return;
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    // A click elsewhere in the month shrinks the enlarged cell back (docs/ui/Views.md#month).
    const shrinks = Boolean(event.target.closest(".month") && !event.target.closest(".mcell.is-expanded") && document.querySelector(".mcell.is-expanded"));
    if (shrinks) app.month.collapse();
    const button = event.target.closest("button");
    if (!button) {
      const quiet = shrinks || clickClears || event.ctrlKey || event.metaKey;
      // A click on free space of the backlog creates an entry in the group there (docs/ui/Shell.md#backlog-panel).
      const place = quiet || event.target.closest(".ev") ? null : backlogPlace(event.target, event.clientX, event.clientY);
      if (place) {
        current.newBacklogEntry(/** @type {number} */ (place.group));
        return;
      }
      // A click on the body of a day creates an entry there, unless it only clears the selection, closes a menu or
      // panel or shrinks the enlarged cell (docs/ui/Interaction.md#pointer).
      const key = quiet ? "" : bodyDay(event.target);
      if (key) current.newEntry(key);
      return;
    }
    if (button.disabled) return;
    if (button.dataset.recent) {
      current.openRecent(button.dataset.recent);
      return;
    }
    if (button.dataset.forget) {
      current.forgetRecent(button.dataset.forget);
      return;
    }
    const action = buttons[button.id];
    const tile = /** @type {HTMLElement | null} */ (button.closest(".ev"));
    if (tile && (event.ctrlKey || event.metaKey)) {
      // Ctrl+click adds a tile to the selection or removes it (docs/ui/Interaction.md#selection-copy-and-paste).
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
    else if (button.dataset.more) app.month.toggle(button.dataset.more);
    else if (button.dataset.multi) current.openMultiDay(Number(button.dataset.multi));
    else if (button.dataset.occasions) {
      const bounds = button.getBoundingClientRect();
      current.showOccasions(button.dataset.occasions, /** @type {MDCBadgeKind} */ (button.dataset.kind), bounds.left, bounds.right, bounds.bottom + 6);
    }
  });

  // A right-click copies the entry under it, or the whole selection when the entry belongs to it; on free space of a day it pastes
  // when something is copied. Elsewhere it does nothing and the browser menu stays closed, except in text fields
  // (docs/ui/Interaction.md#pointer).
  document.addEventListener("contextmenu", event => {
    if (!(event.target instanceof Element) || keymap.isEditable(event.target)) return;
    event.preventDefault();
    const current = handlers;
    if (!current || app.dialog.isOpen()) return;
    const tile = /** @type {HTMLElement | null} */ (event.target.closest(".day__list .ev, .bl__list .ev"));
    if (tile) {
      current.copy(targets(tile));
      return;
    }
    if (!current.hasClipboard() || event.target.closest(".ev, .bar, a")) return;
    // On free space of a backlog group it pastes at the pointer's place there (docs/ui/Interaction.md#pointer).
    const place = backlogPlace(event.target, event.clientX, event.clientY);
    if (place) {
      current.paste(place);
      return;
    }
    const key = event.target.closest("button") ? "" : dayOf(event.target);
    if (key) current.paste({ key, index: 0 });
  });

  /** Last pointer position in the window, for the entry under the pointer. @type {{x: number, y: number} | null} */
  let pointer = null;
  document.addEventListener("pointermove", event => {
    pointer = { x: event.clientX, y: event.clientY };
    if (event.target instanceof Element) hoveredDay = dayOf(event.target) || hoveredDay;
  }, { passive: true });
  main.addEventListener("pointerleave", () => { hoveredDay = ""; });
  document.documentElement.addEventListener("pointerleave", () => { pointer = null; });

  /**
   * The picks a keyboard action applies to: the selection, otherwise the entry under the pointer
   * (docs/ui/Interaction.md#keyboard-shortcuts). The tile is looked up at the key press, so that it is right
   * after a re-render or a change of week without a pointer move.
   */
  function keyTargets() {
    if (selection.size) return targets(null);
    const element = pointer && document.elementFromPoint(pointer.x, pointer.y);
    const tile = /** @type {HTMLElement | null} */ (element?.closest(".day__list .ev, .bl__list .ev") ?? null);
    return tile ? [pickOf(tile)] : [];
  }

  // Keyboard shortcuts (docs/ui/Interaction.md#keyboard-shortcuts) with MD_Libs ui/keymap.
  const shortcuts = keymap.create({
    target: document,
    guard: () => Boolean(handlers) && document.body.dataset.startupState !== "blocked"
  });
  const current = () => /** @type {MDCInteractionHandlers} */ (handlers);
  /** Shortcuts other than saving act only while no dialog or modal menu is open. */
  const free = () => !app.dialog.isOpen() && !app.menus.isModalOpen();
  const inCalendar = () => free() && !current().isContactsView();
  shortcuts.bind("mod+shift?+s", () => current().save(), { inEditable: true });
  shortcuts.bind(["mod+shift?+y", "mod+shift+z"], () => current().redo(), { when: free });
  shortcuts.bind("mod+z", () => current().undo(), { when: free });
  shortcuts.bind("mod+shift?+c", () => current().copy(keyTargets()), { when: () => free() && keyTargets().length > 0 });
  shortcuts.bind("mod+shift?+x", () => {
    const picks = keyTargets();
    clearSelection();
    current().cut(picks);
  }, { when: () => inCalendar() && keyTargets().length > 0 });
  shortcuts.bind("mod+shift?+v", () => current().paste(pasteTarget()), { when: free });
  // Ctrl+A selects every entry of the day under the pointer, also those hidden behind “+N” in the month, or of the
  // backlog group under it.
  shortcuts.bind("mod+shift?+a", () => {
    const place = hoveredBacklogPlace();
    if (place) {
      for (const tile of document.querySelectorAll(`#backlog .bl__list[data-group="${place.group}"] > .ev`)) selection.add(idOf(pickOf(/** @type {HTMLElement} */ (tile))));
    } else for (const pick of current().dayPicks(hoveredDay)) selection.add(idOf(pick));
    refreshSelection();
  }, { when: () => inCalendar() && (Boolean(hoveredDay) || Boolean(hoveredBacklogPlace())) });
  /** Keys that change the view do nothing while the focus card is open (docs/ui/Interaction.md#keyboard-shortcuts). */
  const viewFree = () => free() && !current().isFocusOpen();
  /** @type {Array<[string, () => void, (() => boolean)?]>} */
  const plainKeys = [
    ["t", () => current().today(), viewFree],
    ["a", () => {
      // Over the backlog a new entry goes into the group under the pointer.
      const place = current().isContactsView() ? null : hoveredBacklogPlace();
      if (place) current().newBacklogEntry(/** @type {number} */ (place.group));
      else current().newEntry(current().isContactsView() ? undefined : hoveredDay || undefined);
    }],
    ["w", () => current().showView("week"), viewFree],
    ["m", () => current().showView("month"), viewFree],
    ["c", () => current().showView("contacts"), viewFree],
    ["b", () => current().toggleBacklog(), viewFree],
    ["f", () => current().toggleSearch(), viewFree],
    ["?", () => current().showHelp()],
    ["space", () => {
      const picks = keyTargets();
      if (picks.length) current().toggleMany(picks);
    }, inCalendar],
    ["delete", () => {
      const picks = keyTargets();
      if (!picks.length) return;
      clearSelection();
      current().removeMany(picks);
    }, inCalendar],
    ["escape", () => {
      clearSelection();
      app.month.collapse();
    }]
  ];
  for (const [key, run, when = free] of plainKeys) shortcuts.bind(`shift?+${key}`, run, { when, repeat: false });
  shortcuts.bind("shift?+arrowleft", () => current().previous(), { when: inCalendar });
  shortcuts.bind("shift?+arrowright", () => current().next(), { when: inCalendar });

  /** Position among the normal entries of a list; occurrences and other moved tiles above it do not count. @param {HTMLElement} item @param {Set<HTMLElement>} skip */
  function entryPosition(item, skip) {
    return sortable.position(item, sibling => sibling.classList.contains("ev") && !sibling.classList.contains("ev--series") && !skip.has(/** @type {HTMLElement} */ (sibling)));
  }

  /** The other selected tiles that move along with a dragged selected tile; occurrences stay. @param {HTMLElement} item */
  function movingAlong(item) {
    if (!selection.has(idOf(pickOf(item)))) return [];
    return tiles().filter(tile => tile !== item && selection.has(idOf(pickOf(tile))) && !tile.classList.contains("ev--series"));
  }

  /** Most tiles a drag preview shows; the rest is summed up as “+N”. */
  const previewTiles = 5;

  /**
   * Drag image of a selection: copies of all moving tiles in file order, stacked like a day list (docs/ui/Interaction.md#selection-copy-and-paste).
   * The copies sit in a bare copy of the dragged tile's day, so that they keep the look of their view.
   * @param {DataTransfer} transfer @param {HTMLElement} item @param {HTMLElement[]} others
   */
  function setPreview(transfer, item, others) {
    const list = /** @type {HTMLElement} */ (item.parentElement);
    const cell = /** @type {HTMLElement} */ (list.parentElement);
    const moving = [item, ...others].sort((left, right) => left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
    // Selected entries hidden behind “+N” in the month have no tile but move as well.
    const total = Array.from(selection).filter(id => !id.startsWith("s:")).length;
    const shown = Math.min(moving.length, previewTiles);
    // Only the base class of the day: today, past and enlarged states belong to the day, not to the moving entries.
    const frame = document.createElement(cell.tagName);
    frame.className = `${cell.classList[0]} drag-preview`;
    frame.style.width = `${cell.offsetWidth}px`;
    const copyList = /** @type {HTMLElement} */ (list.cloneNode(false));
    let grabbed = /** @type {HTMLElement | null} */ (null);
    for (const tile of moving.slice(0, shown)) {
      const copy = /** @type {HTMLElement} */ (tile.cloneNode(true));
      copy.classList.remove("ev--along");
      if (tile === item) grabbed = copy;
      copyList.append(copy);
    }
    if (total > shown) {
      const more = document.createElement("span");
      more.className = "more";
      more.textContent = `+${total - shown}`;
      copyList.append(more);
    }
    frame.append(copyList);
    document.body.append(frame);
    // The grabbed point of the tile stays under the pointer; a tile beyond the shown ones is held at the first copy.
    const anchor = (grabbed || /** @type {HTMLElement} */ (copyList.firstElementChild)).getBoundingClientRect();
    const origin = frame.getBoundingClientRect();
    const bounds = item.getBoundingClientRect();
    transfer.setDragImage(frame, Math.round(anchor.left - origin.left + press.x - bounds.left), Math.round(anchor.top - origin.top + press.y - bounds.top));
    window.setTimeout(() => frame.remove(), 0);
  }

  /** Makes the day lists sortable within and between days; occurrences stay in place. @param {HTMLElement[]} lists */
  function bindLists(lists) {
    sortables.forEach(sortable => sortable.destroy());
    sortables = lists.map(list => sortable.create({ Sortable, window, element: list, options: {
      group: "day-lists",
      delay: 180,
      delayOnTouchOnly: true,
      fallbackTolerance: 3,
      filter: ".ev__check, .ev--series",
      ghostClass: "ev--ghost",
      dragClass: "ev--drag",
      // While an entry is dragged, the backlog title shows where ungrouped entries can be dropped.
      /** @param {DataTransfer} transfer @param {HTMLElement} item */
      setData(transfer, item) {
        transfer.setData("Text", item.textContent || "");
        const others = movingAlong(item);
        if (others.length) setPreview(transfer, item, others);
      },
      /** @param {{item: HTMLElement}} event */
      onStart(event) {
        document.body.classList.add("is-sorting");
        // The other moving tiles fade like the dragged one's placeholder until the drop (docs/ui/Interaction.md#selection-copy-and-paste).
        for (const tile of movingAlong(event.item)) tile.classList.add("ev--along");
      },
      /** @param {{from: HTMLElement, to: HTMLElement, item: HTMLElement, oldIndex: number}} event */
      onEnd(event) {
        document.body.classList.remove("is-sorting");
        for (const tile of document.querySelectorAll(".ev--along")) tile.classList.remove("ev--along");
        const from = place(event.from, Number(event.item.dataset.index));
        const id = idOf({ ref: from, key: from.key });
        const others = selection.has(id) ? tiles().filter(tile => tile !== event.item && selection.has(idOf(pickOf(tile))) && !tile.classList.contains("ev--series")) : [];
        if (!others.length) {
          handlers?.move(from, place(event.to, entryPosition(event.item, new Set())));
          return;
        }
        // A selected tile drags the whole selection along (docs/ui/Interaction.md#selection-copy-and-paste).
        const picks = Array.from(selection, pickFromId).filter(pick => pick.ref);
        const sameList = new Set(others.filter(tile => tile.parentElement === event.to));
        const target = place(event.to, entryPosition(event.item, sameList));
        selection.clear();
        handlers?.moveMany(picks.map(pick => /** @type {MDCEntryRef} */ (pick.ref)), from, target);
      }
    } }));
  }

  /** Drag and drop inside the focus card: its entries are reordered within the day only. @type {{destroy(): void} | null} */
  let focusSortable = null;

  /** Binds the list of the focus card after it was drawn, or releases it (null). @param {HTMLElement | null} list */
  function bindFocusList(list) {
    focusSortable?.destroy();
    focusSortable = list ? sortable.create({ Sortable, window, element: list, options: {
      group: "focus",
      draggable: ".ev",
      delay: 180,
      delayOnTouchOnly: true,
      fallbackTolerance: 3,
      filter: ".ev__check, .ev--series",
      ghostClass: "ev--ghost",
      dragClass: "ev--drag",
      onStart() { document.body.classList.add("is-sorting"); },
      /** @param {{from: HTMLElement, to: HTMLElement, item: HTMLElement}} event */
      onEnd(event) {
        document.body.classList.remove("is-sorting");
        handlers?.move(place(event.from, Number(event.item.dataset.index)), place(event.to, entryPosition(event.item, new Set())));
      }
    } }) : null;
  }

  // Backlog groups are reordered by dragging their head (docs/ui/Interaction.md#drag-and-drop). The container stays for
  // the whole session, so this sortable is created once; ungrouped entries are not a group and stay first.
  sortable.create({ Sortable, window, element: /** @type {HTMLElement} */ (document.getElementById("backlogGroups")), options: {
    group: "backlog-groups",
    handle: ".bl__head",
    draggable: ".bl__group:not(.bl__group--ungrouped)",
    delay: 180,
    delayOnTouchOnly: true,
    fallbackTolerance: 3,
    ghostClass: "bl__group--ghost",
    onStart() { document.body.classList.add("is-sorting-groups"); },
    /** @param {{oldDraggableIndex: number, newDraggableIndex: number}} event */
    onEnd(event) {
      document.body.classList.remove("is-sorting-groups");
      if (event.oldDraggableIndex !== event.newDraggableIndex) handlers?.moveGroup(event.oldDraggableIndex, event.newDraggableIndex);
    }
  } });

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
    handlers?.notice("Recurring entries can’t be moved", "Edit the series instead.");
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
    // After the days were dragged, the first gesture only returns to the mostly shown week.
    if (current.snapToWeek()) return;
    if (wheelSum > 0) current.next();
    else current.previous();
  }, { passive: false });

  // ---------- Double-click on a day header: focus mode (docs/ui/Interaction.md#pointer) ----------

  document.addEventListener("dblclick", event => {
    if (!handlers || !(event.target instanceof Element) || event.target.closest("button")) return;
    const day = /** @type {HTMLElement | null} */ (event.target.closest(".wk .day__head"))?.closest(".day");
    if (day instanceof HTMLElement && day.dataset.day) handlers.openFocus(day.dataset.day);
  });

  // ---------- Middle button held on the week: drag the days, snap to days on release ----------

  /** @type {{pointer: number, x: number, y: number, dx: number, dy: number, frame: number} | null} */
  let pan = null;
  // The browser's autoscroll starts on the middle button's mousedown; on the week the button drags the days instead.
  main.addEventListener("mousedown", event => {
    if (event.button === 1 && event.target instanceof Element && event.target.closest(".wk")) event.preventDefault();
  });
  main.addEventListener("pointerdown", event => {
    if (event.button !== 1 || pan || !handlers || !(event.target instanceof Element)) return;
    const board = event.target.closest(".wk");
    if (!(board instanceof HTMLElement)) return;
    event.preventDefault();
    if (!handlers.panStart()) return;
    board.setPointerCapture(event.pointerId);
    pan = { pointer: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, dy: 0, frame: 0 };
  });
  main.addEventListener("pointermove", event => {
    if (!pan || event.pointerId !== pan.pointer || !handlers) return;
    pan.dx = event.clientX - pan.x;
    pan.dy = event.clientY - pan.y;
    // At most one update per frame (AGENTS.md#performance).
    if (pan.frame) return;
    const current = handlers;
    pan.frame = requestAnimationFrame(() => {
      if (!pan) return;
      pan.frame = 0;
      current.panMove(pan.dx, pan.dy);
    });
  });
  /** @param {PointerEvent} event */
  function endPan(event) {
    if (!pan || event.pointerId !== pan.pointer || !handlers) return;
    cancelAnimationFrame(pan.frame);
    handlers.panMove(pan.dx, pan.dy);
    pan = null;
    handlers.panEnd();
  }
  main.addEventListener("pointerup", endPan);
  main.addEventListener("pointercancel", endPan);
  main.addEventListener("lostpointercapture", endPan);
  main.addEventListener("auxclick", event => {
    if (event.button === 1 && event.target instanceof Element && event.target.closest(".wk")) event.preventDefault();
  });

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
    /** Opens the file dialog of the calendar import (“+” menu). */
    chooseCalendarFile: () => icsInput.click(),
    selected: () => Array.from(selection, pickFromId), bindFocusList };
})(window.MDCalendar);
