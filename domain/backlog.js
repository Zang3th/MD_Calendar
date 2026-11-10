window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Backlog operations and moves between days and backlog groups (docs/Domain.md#backlog).
// An entry place is a day ({key, index}) or a backlog group ({group, index}).
(function (app) {
  const calendarFile = "Calendar.md";
  const backlogFile = "Backlog.md";

  /** @param {MDCEntryRef} ref */
  function isBacklog(ref) {
    return ref.group !== undefined;
  }

  /** The mutable list of a place. @param {MDCCalendar} calendar @param {MDCBacklog} backlog @param {MDCEntryRef} ref */
  function list(calendar, backlog, ref) {
    if (!isBacklog(ref)) return app.calendar.dayList(calendar, ref.key);
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
   * @returns {MDCDayAction}
   */
  function action(calendar, backlog, label, from, to) {
    /** @param {{ref: MDCEntryRef, entry: MDCEntry} | null} removed @param {{ref: MDCEntryRef, entry: MDCEntry} | null} inserted */
    function apply(removed, inserted) {
      if (removed) list(calendar, backlog, removed.ref).splice(removed.ref.index, 1);
      if (inserted) list(calendar, backlog, inserted.ref).splice(inserted.ref.index, 0, inserted.entry);
    }
    const refs = [from?.ref, to?.ref].filter(ref => ref !== undefined);
    const crossing = from && to && isBacklog(from.ref) !== isBacklog(to.ref);
    return {
      label,
      days: [...new Set(refs.filter(ref => !isBacklog(ref)).map(ref => ref.key))],
      backlog: refs.some(isBacklog),
      // Saving writes the target of a move between the files first (docs/DataFormat.md#rules-for-the-calendar-file).
      target: crossing && to ? (isBacklog(to.ref) ? backlogFile : calendarFile) : undefined,
      size: (from ? sizeOf(from.entry) : 0) + (to ? sizeOf(to.entry) : 0),
      redo() { apply(from, to); },
      undo() { apply(to, from); }
    };
  }

  /** @param {MDCCalendar} calendar @param {MDCBacklog} backlog @param {number} group @param {MDCEntryFields & Partial<Pick<MDCEntry, "tag" | "extra">>} fields */
  function create(calendar, backlog, group, fields) {
    /** @type {MDCEntry} */
    const entry = { done: false, tag: "", extra: [], ...fields };
    const ref = { key: "", group, index: list(calendar, backlog, { key: "", group, index: 0 }).length };
    return action(calendar, backlog, entry.title, null, { ref, entry });
  }

  /**
   * Changes an entry and puts it at `target`: its own place, the end of a day or the end of a backlog group.
   * @param {MDCCalendar} calendar @param {MDCBacklog} backlog @param {MDCEntryRef} ref
   * @param {{key: string, group?: number}} target @param {Partial<MDCEntry>} fields
   * @returns {MDCDayAction | null}
   */
  function update(calendar, backlog, ref, target, fields) {
    const entry = entryAt(calendar, backlog, ref);
    const updated = { ...entry, ...fields };
    const samePlace = target.group === ref.group && (isBacklog(ref) || target.key === ref.key);
    if (samePlace && JSON.stringify(updated) === JSON.stringify(entry)) return null;
    const index = samePlace ? ref.index : list(calendar, backlog, { ...target, index: 0 }).length;
    return action(calendar, backlog, updated.title, { ref, entry }, { ref: { ...target, index }, entry: updated });
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
   * Moves an entry between any two places; `to.index` is the position after the entry was removed.
   * @param {MDCCalendar} calendar @param {MDCBacklog} backlog @param {MDCEntryRef} from @param {MDCEntryRef} to
   * @returns {MDCDayAction | null}
   */
  function move(calendar, backlog, from, to) {
    const sameList = from.group === to.group && (isBacklog(from) || from.key === to.key);
    if (sameList && from.index === to.index) return null;
    const entry = entryAt(calendar, backlog, from);
    const length = list(calendar, backlog, to).length - (sameList ? 1 : 0);
    if (to.index < 0 || to.index > length) throw new Error("Invalid target position.");
    return action(calendar, backlog, entry.title, { ref: from, entry }, { ref: to, entry });
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
   * @returns {MDCDayAction}
   */
  function snapshot(calendar, backlog, label, places, mutate, target) {
    const unique = [...new Map(places.map(ref => [placeId(ref), ref])).values()];
    const before = unique.map(ref => [...list(calendar, backlog, ref)]);
    mutate();
    const after = unique.map(ref => [...list(calendar, backlog, ref)]);
    /** @param {MDCEntry[][]} contents */
    const set = contents => unique.forEach((ref, index) => list(calendar, backlog, ref).splice(0, Infinity, ...contents[index]));
    set(before);
    return {
      label,
      days: [...new Set(unique.filter(ref => !isBacklog(ref)).map(ref => ref.key))],
      backlog: unique.some(isBacklog),
      target,
      size: after.flat().reduce((total, entry) => total + sizeOf(entry), 0),
      redo() { set(after); },
      undo() { set(before); }
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
    return snapshot(calendar, backlog, `${refs.length} Einträge`, refs, () => {
      for (const ref of refs) {
        const entries = list(calendar, backlog, ref);
        entries[ref.index] = { ...entries[ref.index], done };
      }
    }, undefined);
  }

  /**
   * Moves several entries to one place, in their order, starting at `target.index` of the target list
   * after they were removed. `dragged` is the entry the pointer moved; it keeps its place among them.
   * @param {MDCCalendar} calendar @param {MDCBacklog} backlog @param {MDCEntryRef[]} refs @param {MDCEntryRef} target
   * @returns {MDCDayAction}
   */
  function moveEntries(calendar, backlog, refs, target) {
    const ordered = [...refs].sort((left, right) => placeId(left).localeCompare(placeId(right)) || left.index - right.index);
    const moving = ordered.map(ref => entryAt(calendar, backlog, ref));
    const crossing = refs.some(ref => isBacklog(ref) !== isBacklog(target));
    return snapshot(calendar, backlog, `${refs.length} Einträge`, [...refs, target], () => {
      for (const ref of descending(refs)) list(calendar, backlog, ref).splice(ref.index, 1);
      const destination = list(calendar, backlog, target);
      destination.splice(Math.min(target.index, destination.length), 0, ...moving);
    }, crossing ? (isBacklog(target) ? backlogFile : calendarFile) : undefined);
  }

  /** Inserts copies at the end of a day; copies are open. @param {MDCCalendar} calendar @param {MDCBacklog} backlog @param {MDCEntry[]} entries @param {string} key */
  function pasteEntries(calendar, backlog, entries, key) {
    const ref = { key, index: 0 };
    return snapshot(calendar, backlog, entries.length === 1 ? entries[0].title : `${entries.length} Einträge`, [ref], () => {
      list(calendar, backlog, ref).push(...entries.map(entry => ({ ...entry, done: false, note: [...entry.note], extra: [...entry.extra] })));
    }, undefined);
  }

  app.backlog = { entryAt, create, update, remove, toggle, move, isBacklog, removeEntries, toggleEntries, moveEntries, pasteEntries };
})(window.MDCalendar);
