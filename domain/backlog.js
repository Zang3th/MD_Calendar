window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Backlog operations and moves between days and backlog groups (docs/Domain.md#backlog).
// An entry place is a day ({key, index}) or a backlog group ({group, index}). Every group is a tag and the ungrouped
// entries are the untagged ones: the tag decides the group of an entry that arrives from outside the backlog, and a
// move inside the backlog gives the entry the tag of its new group.
(function (app) {
  const calendarFile = "Calendar.md";
  /** Group number that addresses the ungrouped entries in an entry place. */
  const ungrouped = -1;
  const backlogFile = "Backlog.md";

  /** @param {MDCEntryRef} ref */
  function isBacklog(ref) {
    return ref.group !== undefined;
  }

  /** The mutable list of a place. @param {MDCCalendar} calendar @param {MDCBacklog} backlog @param {MDCEntryRef} ref */
  function list(calendar, backlog, ref) {
    if (!isBacklog(ref)) return app.calendar.dayList(calendar, ref.key);
    if (ref.group === ungrouped) return backlog.ungrouped;
    const group = backlog.groups[/** @type {number} */ (ref.group)];
    if (!group) throw new Error(`No backlog group #${ref.group}.`);
    return group.entries;
  }

  /** @param {MDCCalendar} calendar @param {MDCBacklog} backlog @param {MDCEntryRef} ref */
  function entryAt(calendar, backlog, ref) {
    const entry = list(calendar, backlog, ref)[ref.index];
    if (!entry) throw new Error(`No entry at ${isBacklog(ref) ? `group #${ref.group}` : ref.key} #${ref.index}.`);
    return entry;
  }

  /** @param {MDCEntry} entry */
  function sizeOf(entry) {
    return 2 * (entry.title.length + entry.location.length + entry.note.join("\n").length + entry.extra.join("\n").length + 64);
  }

  /**
   * Removes `from` (if set) and inserts `to` (if set), across days and backlog groups.
   * @param {MDCCalendar} calendar @param {MDCBacklog} backlog @param {string} label
   * @param {{ref: MDCEntryRef, entry: MDCEntry} | null} from @param {{ref: MDCEntryRef, entry: MDCEntry} | null} to
   * @param {{key: string, pins: MDCPin[]} | null} [placed] the pins of one day as dropped
   * @param {MDCSlotted[]} [slotted] entries that went into their time slot
   * @returns {MDCDayAction}
   */
  function action(calendar, backlog, label, from, to, placed = null, slotted = []) {
    /** @param {{ref: MDCEntryRef, entry: MDCEntry} | null} removed @param {{ref: MDCEntryRef, entry: MDCEntry} | null} inserted */
    function apply(removed, inserted) {
      if (removed) list(calendar, backlog, removed.ref).splice(removed.ref.index, 1);
      if (inserted) list(calendar, backlog, inserted.ref).splice(inserted.ref.index, 0, inserted.entry);
    }
    const refs = [from?.ref, to?.ref].filter(ref => ref !== undefined);
    const crossing = from && to && isBacklog(from.ref) !== isBacklog(to.ref);
    const days = [...new Set(refs.filter(ref => !isBacklog(ref)).map(ref => ref.key))];
    // Placed occurrences keep their place among the entries (docs/Domain.md#day-list-order).
    const options = { ...app.calendar.pinOptions(from, to), placed, slotted };
    /** @type {Array<{key: string, pins: readonly MDCPin[]}>} */
    let saved = [];
    return {
      label,
      days,
      backlog: refs.some(isBacklog),
      // Saving writes the target of a move between the files first (docs/DataFormat.md#rules-for-the-calendar-file).
      target: crossing && to ? (isBacklog(to.ref) ? backlogFile : calendarFile) : undefined,
      size: (from ? sizeOf(from.entry) : 0) + (to ? sizeOf(to.entry) : 0),
      redo() { saved = app.calendar.keepPins(calendar, days, () => apply(from, to), options); },
      undo() {
        apply(to, from);
        app.calendar.restorePins(calendar, saved);
      }
    };
  }

  // ---------- Groups are tags (docs/Domain.md#backlog) ----------

  /** A copy of the backlog's lists and groups; entries are immutable and shared. @param {MDCBacklog} backlog */
  function copyBacklog(backlog) {
    return { ungrouped: [...backlog.ungrouped], groups: backlog.groups.map(group => ({ ...group, entries: [...group.entries] })) };
  }

  /** @param {MDCBacklog} backlog @param {ReturnType<typeof copyBacklog>} copy */
  function restoreBacklog(backlog, copy) {
    backlog.ungrouped.splice(0, Infinity, ...copy.ungrouped);
    backlog.groups.splice(0, Infinity, ...copy.groups.map(group => ({ ...group, entries: [...group.entries] })));
  }

  /**
   * One undo step over the whole backlog and some days: `mutate` may add groups as well as change lists.
   * @param {MDCCalendar} calendar @param {MDCBacklog} backlog @param {string} label @param {string[]} keys days that change
   * @param {() => void} mutate @param {string | undefined} target @param {number} size
   * @returns {MDCDayAction}
   */
  function backlogStep(calendar, backlog, label, keys, mutate, target, size) {
    const days = [...new Set(keys)];
    const pins = days.map(key => app.calendar.pins(calendar, key));
    const before = { backlog: copyBacklog(backlog), days: days.map(key => [...app.calendar.dayList(calendar, key)]), pins };
    mutate();
    const afterDays = days.map(key => [...app.calendar.dayList(calendar, key)]);
    // Entries only leave the days here; the pins keep their place among the others.
    const after = { backlog: copyBacklog(backlog), days: afterDays, pins: days.map((_, index) => app.calendar.repin(before.days[index], afterDays[index], pins[index])) };
    /** @param {typeof before} state */
    const set = state => {
      restoreBacklog(backlog, state.backlog);
      days.forEach((key, index) => app.calendar.dayList(calendar, key).splice(0, Infinity, ...state.days[index]));
      app.calendar.restorePins(calendar, days.map((key, index) => ({ key, pins: state.pins[index] })));
    };
    set(before);
    return { label, days, backlog: true, target, size, redo() { set(after); }, undo() { set(before); } };
  }

  /**
   * Puts `entry` into the backlog and returns where it went. From outside the backlog a tagged entry goes into the group of
   * its tag, created at the end when missing, at `at` only when that is in this group, otherwise at its end. Otherwise
   * the entry goes to `at` (or the end of the ungrouped entries) and takes the tag of that group, where the ungrouped
   * entries are untagged; moved within its own group it keeps its tag, so that reordering never changes data.
   * @param {MDCBacklog} backlog @param {MDCEntry} incoming @param {{group: number, index: number} | null} at
   * @param {number | null} source the backlog group the entry comes from, or null from outside the backlog
   * @returns {{group: number, index: number}}
   */
  function place(backlog, incoming, at, source) {
    const entry = timeless(incoming);
    if (source === null && entry.tag) {
      let group = backlog.groups.findIndex(candidate => candidate.name === entry.tag);
      if (group < 0) group = backlog.groups.push({ name: entry.tag, entries: [], extra: [] }) - 1;
      const entries = backlog.groups[group].entries;
      const index = at && at.group === group ? Math.min(at.index, entries.length) : entries.length;
      entries.splice(index, 0, entry);
      return { group, index };
    }
    const group = at ? at.group : ungrouped;
    const tag = group === ungrouped ? "" : backlog.groups[group].name;
    const entries = group === ungrouped ? backlog.ungrouped : backlog.groups[group].entries;
    const index = at ? Math.min(at.index, entries.length) : entries.length;
    entries.splice(index, 0, entry.tag === tag || source === group ? entry : { ...entry, tag });
    return { group, index };
  }

  /** The backlog has no times (docs/Domain.md#backlog): an entry arriving there loses its time. @param {MDCEntry} entry */
  function timeless(entry) {
    return entry.start || entry.end ? { ...entry, start: "", end: "" } : entry;
  }

  /**
   * Creates a backlog entry; its tag decides the group (docs/Domain.md#backlog).
   * @param {MDCCalendar} calendar @param {MDCBacklog} backlog @param {MDCEntryFields & Partial<Pick<MDCEntry, "tag" | "extra">>} fields
   */
  function create(calendar, backlog, fields) {
    /** @type {MDCEntry} */
    const entry = { done: false, tag: "", extra: [], ...fields };
    return backlogStep(calendar, backlog, entry.title, [], () => { place(backlog, entry, null, null); }, undefined, sizeOf(entry));
  }

  /**
   * Changes an entry and puts it at `target`: a day (its own place, or its time slot when the day or the start time
   * changes, docs/Domain.md#day-list-order) or the backlog (any `group`), where its tag decides the group.
   * @param {MDCCalendar} calendar @param {MDCBacklog} backlog @param {MDCEntryRef} ref
   * @param {{key: string, group?: number}} target @param {Partial<MDCEntry>} fields
   * @returns {MDCDayAction | null}
   */
  function update(calendar, backlog, ref, target, fields) {
    const entry = entryAt(calendar, backlog, ref);
    const updated = { ...entry, ...fields };
    // Into the backlog the tag decides the group; an entry that keeps its tag keeps its place (docs/Domain.md#backlog).
    if (target.group !== undefined) {
      if (isBacklog(ref) && updated.tag === entry.tag && JSON.stringify(updated) === JSON.stringify(entry)) return null;
      return backlogStep(calendar, backlog, updated.title, isBacklog(ref) ? [] : [ref.key], () => {
        list(calendar, backlog, ref).splice(ref.index, 1);
        if (isBacklog(ref) && updated.tag === entry.tag) list(calendar, backlog, ref).splice(ref.index, 0, timeless(updated));
        else place(backlog, updated, null, null);
      }, isBacklog(ref) ? undefined : backlogFile, sizeOf(entry) + sizeOf(updated));
    }
    const samePlace = !isBacklog(ref) && target.key === ref.key;
    if (samePlace && JSON.stringify(updated) === JSON.stringify(entry)) return null;
    // The target day exists before the step, so that undoing it leaves the days as they were.
    app.calendar.dayList(calendar, target.key);
    const { index, stay } = samePlace && updated.start === entry.start ? { index: ref.index, stay: new Set() }
      : app.calendar.timeSlot(calendar, target.key, updated.start, samePlace ? ref.index : -1);
    return action(calendar, backlog, updated.title, { ref, entry }, { ref: { ...target, index }, entry: updated }, null, [{ entry: updated, stay }]);
  }

  /** @param {MDCCalendar} calendar @param {MDCBacklog} backlog @param {MDCEntryRef} ref */
  function remove(calendar, backlog, ref) {
    const entry = entryAt(calendar, backlog, ref);
    return action(calendar, backlog, entry.title, { ref, entry }, null);
  }

  /** @param {MDCCalendar} calendar @param {MDCBacklog} backlog @param {MDCEntryRef} ref */
  function toggle(calendar, backlog, ref) {
    const entry = entryAt(calendar, backlog, ref);
    return action(calendar, backlog, entry.title, { ref, entry }, { ref, entry: { ...entry, done: !entry.done } });
  }

  /**
   * Whether an entry dropped within its day passes an occurrence that is not placed: with only the placed ones kept as
   * dropped, some other shown occurrence would not stay where it was dropped (docs/Domain.md#day-list-order).
   * @param {MDCCalendar} calendar @param {MDCEntryRef} from @param {MDCEntryRef} to @param {MDCPlacement[]} shown
   */
  function passesFree(calendar, from, to, shown) {
    const placedAt = app.calendar.placedAt(calendar, from.key);
    const entries = [...app.calendar.entries(calendar, from.key)];
    entries.splice(to.index, 0, ...entries.splice(from.index, 1));
    const kept = new Map(shown.filter(item => placedAt.has(item.series)).map(item => [item.series, item.at]));
    /** @type {Map<number, number>} */
    const at = new Map();
    let before = 0;
    for (const item of app.recurrence.dayOrder(app.recurrence.occurrences(calendar, from.key), entries, kept)) {
      if ("entry" in item) before += 1;
      else at.set(item.occurrence.index, before);
    }
    return shown.some(item => !placedAt.has(item.series) && at.get(item.series) !== item.at);
  }

  /**
   * Moves an entry between any two places; `to.index` is the position after the entry was removed. A timed entry that
   * arrives on a day from elsewhere goes into its time slot instead (docs/Domain.md#day-list-order). Within a day
   * `shown` gives its occurrences as dropped, so that an entry can pass them; passing one that is not placed places
   * every occurrence of the day as dropped.
   * @param {MDCCalendar} calendar @param {MDCBacklog} backlog @param {MDCEntryRef} from @param {MDCEntryRef} to
   * @param {MDCPlacement[] | null} [shown]
   * @returns {MDCDayAction | null}
   */
  function move(calendar, backlog, from, to, shown = null) {
    const sameList = from.group === to.group && (isBacklog(from) || from.key === to.key);
    const withinDay = sameList && !isBacklog(from) ? shown : null;
    if (withinDay && passesFree(calendar, from, to, withinDay)) {
      const entry = entryAt(calendar, backlog, from);
      const placing = app.calendar.placeOccurrences(calendar, from.key, withinDay, entry.title);
      if (placing) return app.calendar.combine(entry.title, [action(calendar, backlog, entry.title, { ref: from, entry }, { ref: to, entry }), placing]);
    }
    const placedAt = withinDay ? app.calendar.placedAt(calendar, from.key) : new Map();
    const placed = withinDay ? withinDay.filter(item => placedAt.has(item.series)) : null;
    const pinned = placed ? { key: from.key, pins: app.calendar.toPins(calendar, from.key, placed) } : null;
    const pinsChange = pinned && JSON.stringify(pinned.pins) !== JSON.stringify(app.calendar.pins(calendar, from.key));
    if (sameList && from.index === to.index && !pinsChange) return null;
    const entry = entryAt(calendar, backlog, from);
    const length = list(calendar, backlog, to).length - (sameList ? 1 : 0);
    if (to.index < 0 || to.index > length) throw new Error("Invalid target position.");
    if (isBacklog(to)) {
      // Into or inside the backlog: the tag decides the group, or the new group gives the tag (docs/Domain.md#backlog).
      return backlogStep(calendar, backlog, entry.title, isBacklog(from) ? [] : [from.key], () => {
        list(calendar, backlog, from).splice(from.index, 1);
        place(backlog, entry, { group: /** @type {number} */ (to.group), index: to.index }, isBacklog(from) ? /** @type {number} */ (from.group) : null);
      }, isBacklog(from) ? undefined : backlogFile, 2 * sizeOf(entry));
    }
    if (!sameList && entry.start) {
      const { index, stay } = app.calendar.timeSlot(calendar, to.key, entry.start);
      return action(calendar, backlog, entry.title, { ref: from, entry }, { ref: { ...to, index }, entry }, null, [{ entry, stay }]);
    }
    return action(calendar, backlog, entry.title, { ref: from, entry }, { ref: to, entry }, pinned);
  }

  /**
   * Moves the group at `from` to position `to` among the groups, as one undoable action.
   * @param {MDCBacklog} backlog @param {number} from @param {number} to
   * @returns {MDCDayAction | null}
   */
  function moveGroup(backlog, from, to) {
    const group = backlog.groups[from];
    if (!group || to < 0 || to >= backlog.groups.length) throw new Error("Invalid group position.");
    if (from === to) return null;
    /** @param {number} source @param {number} target */
    const apply = (source, target) => backlog.groups.splice(target, 0, ...backlog.groups.splice(source, 1));
    return {
      label: group.name, days: [], backlog: true, size: 64,
      redo() { apply(from, to); },
      undo() { apply(to, from); }
    };
  }

  // ---------- Several entries at once: selection, paste ----------

  /** @param {MDCEntryRef} ref */
  function placeId(ref) {
    return isBacklog(ref) ? `g${ref.group}` : `d${ref.key}`;
  }

  /**
   * One undo step over several lists: `mutate` changes the lists, the action restores or reapplies their contents.
   * @param {MDCCalendar} calendar @param {MDCBacklog} backlog @param {string} label @param {MDCEntryRef[]} places
   * @param {() => void} mutate @param {string | undefined} target
   * @param {{moved?: Set<MDCEntry>, replaced?: Map<MDCEntry, MDCEntry>, placed?: {key: string, pins: MDCPin[]} | null}} [pinning]
   * how placed occurrences follow the change (docs/Domain.md#day-list-order)
   * @returns {MDCDayAction}
   */
  function snapshot(calendar, backlog, label, places, mutate, target, pinning = {}) {
    const unique = [...new Map(places.map(ref => [placeId(ref), ref])).values()];
    const before = unique.map(ref => [...list(calendar, backlog, ref)]);
    const pinsBefore = unique.map(ref => isBacklog(ref) ? [] : app.calendar.pins(calendar, ref.key));
    mutate();
    const after = unique.map(ref => [...list(calendar, backlog, ref)]);
    const pinsAfter = unique.map((ref, index) => {
      if (isBacklog(ref)) return [];
      if (pinning.placed && pinning.placed.key === ref.key) return pinning.placed.pins;
      return pinsBefore[index].length ? app.calendar.repin(before[index], after[index], pinsBefore[index], pinning.moved, pinning.replaced) : pinsBefore[index];
    });
    /** @param {MDCEntry[][]} contents @param {ReadonlyArray<readonly MDCPin[]>} placed */
    const set = (contents, placed) => unique.forEach((ref, index) => {
      list(calendar, backlog, ref).splice(0, Infinity, ...contents[index]);
      if (!isBacklog(ref)) app.calendar.restorePins(calendar, [{ key: ref.key, pins: placed[index] }]);
    });
    set(before, pinsBefore);
    return {
      label,
      days: [...new Set(unique.filter(ref => !isBacklog(ref)).map(ref => ref.key))],
      backlog: unique.some(isBacklog),
      target,
      size: after.flat().reduce((total, entry) => total + sizeOf(entry), 0),
      redo() { set(after, pinsAfter); },
      undo() { set(before, pinsBefore); }
    };
  }

  /** Refs ordered by place and descending index, so that removing them one by one keeps the others valid. @param {MDCEntryRef[]} refs */
  function descending(refs) {
    return [...refs].sort((left, right) => placeId(left).localeCompare(placeId(right)) || right.index - left.index);
  }

  /** @param {MDCCalendar} calendar @param {MDCBacklog} backlog @param {MDCEntryRef[]} refs @param {string} label */
  function removeEntries(calendar, backlog, refs, label) {
    return snapshot(calendar, backlog, label, refs, () => {
      for (const ref of descending(refs)) list(calendar, backlog, ref).splice(ref.index, 1);
    }, undefined);
  }

  /** Marks all entries done, or all open when they are all done already. @param {MDCCalendar} calendar @param {MDCBacklog} backlog @param {MDCEntryRef[]} refs */
  function toggleEntries(calendar, backlog, refs) {
    const done = !refs.every(ref => entryAt(calendar, backlog, ref).done);
    /** @type {Map<MDCEntry, MDCEntry>} */
    const replaced = new Map();
    return snapshot(calendar, backlog, `${refs.length} entries`, refs, () => {
      for (const ref of refs) {
        const entries = list(calendar, backlog, ref);
        const changed = { ...entries[ref.index], done };
        replaced.set(entries[ref.index], changed);
        entries[ref.index] = changed;
      }
    }, undefined, { replaced });
  }

  /**
   * Moves several entries to one place, in their order, starting at `target.index` of the target list
   * after they were removed. `dragged` is the entry the pointer moved; it keeps its place among them. Timed entries that
   * arrive on a day from elsewhere go into their time slots instead (docs/Domain.md#day-list-order). Placed occurrences
   * keep their place among the entries that stay.
   * @param {MDCCalendar} calendar @param {MDCBacklog} backlog @param {MDCEntryRef[]} refs @param {MDCEntryRef} target
   * @returns {MDCDayAction}
   */
  function moveEntries(calendar, backlog, refs, target) {
    const ordered = [...refs].sort((left, right) => placeId(left).localeCompare(placeId(right)) || left.index - right.index);
    const moving = ordered.map(ref => entryAt(calendar, backlog, ref));
    const crossing = refs.some(ref => isBacklog(ref) !== isBacklog(target));
    if (isBacklog(target)) {
      const keys = refs.filter(ref => !isBacklog(ref)).map(ref => ref.key);
      return backlogStep(calendar, backlog, `${refs.length} entries`, keys, () => {
        for (const ref of descending(refs)) list(calendar, backlog, ref).splice(ref.index, 1);
        // Entries that stay in the target group follow each other from the target position.
        let next = target.index;
        moving.forEach((entry, index) => {
          const source = ordered[index];
          const placed = place(backlog, entry, { group: /** @type {number} */ (target.group), index: next }, isBacklog(source) ? /** @type {number} */ (source.group) : null);
          if (placed.group === target.group) next = placed.index + 1;
        });
      }, crossing ? backlogFile : undefined, moving.reduce((total, entry) => total + 2 * sizeOf(entry), 0));
    }
    /** @type {{moved: Set<MDCEntry>, placed?: {key: string, pins: MDCPin[]}}} */
    const pinning = { moved: new Set(moving) };
    return snapshot(calendar, backlog, `${refs.length} entries`, [...refs, target], () => {
      const original = [...list(calendar, backlog, target)];
      for (const ref of descending(refs)) list(calendar, backlog, ref).splice(ref.index, 1);
      const destination = list(calendar, backlog, target);
      const slotted = moving.map((entry, index) => Boolean(entry.start) && !isBacklog(target) && placeId(ordered[index]) !== placeId(target));
      destination.splice(Math.min(target.index, destination.length), 0, ...moving.filter((_, index) => !slotted[index]));
      const timed = moving.filter((_, index) => slotted[index]);
      if (timed.length) pinning.placed = { key: target.key, pins: insertAll(calendar, target.key, original, destination, timed, pinning.moved) };
    }, crossing ? (isBacklog(target) ? backlogFile : calendarFile) : undefined, pinning);
  }

  /**
   * Inserts open copies into a day (timed ones into their time slots, the others in their order at `target.index`, at
   * most the end) or into the backlog at `target`, where they arrive from outside: the tag decides the group
   * (docs/Domain.md#backlog).
   * @param {MDCCalendar} calendar @param {MDCBacklog} backlog @param {MDCEntry[]} entries @param {MDCEntryRef} target
   */
  function pasteEntries(calendar, backlog, entries, target) {
    const label = entries.length === 1 ? entries[0].title : `${entries.length} entries`;
    const copies = entries.map(entry => ({ ...entry, done: false, note: [...entry.note], extra: [...entry.extra] }));
    if (isBacklog(target)) {
      return backlogStep(calendar, backlog, label, [], () => {
        let next = target.index;
        for (const copy of copies) {
          const placed = place(backlog, copy, { group: /** @type {number} */ (target.group), index: next }, null);
          if (placed.group === target.group) next = placed.index + 1;
        }
      }, undefined, copies.reduce((total, entry) => total + sizeOf(entry), 0));
    }
    /** @type {{placed?: {key: string, pins: MDCPin[]}}} */
    const pinning = {};
    return snapshot(calendar, backlog, label, [target], () => {
      const day = list(calendar, backlog, target);
      const original = [...day];
      day.splice(Math.min(target.index, day.length), 0, ...copies.filter(copy => !copy.start));
      const timed = copies.filter(copy => copy.start);
      if (timed.length) pinning.placed = { key: target.key, pins: insertAll(calendar, target.key, original, day, timed, new Set()) };
    }, undefined, pinning);
  }

  /**
   * Inserts timed entries one by one into their time slots of `day`, which was `original` before other changes; returns
   * the pins of the day after (docs/Domain.md#day-list-order).
   * @param {MDCCalendar} calendar @param {string} key @param {readonly MDCEntry[]} original @param {MDCEntry[]} day
   * @param {MDCEntry[]} timed @param {Set<MDCEntry>} moved
   * @returns {MDCPin[]}
   */
  function insertAll(calendar, key, original, day, timed, moved) {
    const pins = app.calendar.pins(calendar, key);
    /** @type {readonly MDCPin[]} */
    let placed = pins.length ? app.calendar.repin(original, day, pins, moved) : [];
    for (const entry of timed) placed = app.calendar.insertTimed(calendar, key, day, placed, entry);
    return [...placed];
  }

  app.backlog = { ungrouped, entryAt, create, update, remove, toggle, move, moveGroup, isBacklog, removeEntries, toggleEntries, moveEntries, pasteEntries };
})(window.MDCalendar);
