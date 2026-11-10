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

  app.backlog = { entryAt, create, update, remove, toggle, move, isBacklog };
})(window.MDCalendar);
