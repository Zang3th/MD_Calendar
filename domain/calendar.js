import { dates } from "@zang3th/md-libs/core";

window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Dates and day list operations (see docs/Domain.md).
// Days are addressed by ISO keys (YYYY-MM-DD); entries by their day and position.
(function (app) {
  /**
   * Converts DD.MM.YYYY into an ISO day key, or "" when the date does not exist.
   * @param {string} value
   */
  function parseDate(value) {
    return /^\d{2}\.\d{2}\.\d{4}$/.test(value.trim()) ? dates.parse(value)?.key ?? "" : "";
  }

  /** English names for displayed dates. @type {import("@zang3th/md-libs/core").dates.MDLDateNames} */
  const names = {
    days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    daysShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    monthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  };

  /** A day for display, e.g. `formatDay(key, "dddd, D MMMM YYYY")` (tokens: MD_Libs dates.formatPattern). @param {string} key @param {string} pattern */
  function formatDay(key, pattern) {
    return dates.formatPattern(key, pattern, names);
  }

  /**
   * Normalizes H:MM or HH:MM; returns "" for an invalid time.
   * @param {string} value
   */
  function parseTime(value) {
    const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
    return match ? `${match[1].padStart(2, "0")}:${match[2]}` : "";
  }

  /** @param {string} key */
  function weekDays(key) {
    const start = dates.weekStart(key);
    return Array.from({ length: 7 }, (_, index) => dates.addDays(start, index));
  }

  /** @param {MDCCalendar} calendar @param {string} key @returns {readonly MDCEntry[]} */
  function entries(calendar, key) {
    return calendar.days.get(key)?.entries || [];
  }

  /** @param {MDCCalendar} calendar @param {string} key */
  function day(calendar, key) {
    let found = calendar.days.get(key);
    if (!found) {
      found = { key, entries: [], pins: [], extra: [] };
      calendar.days.set(key, found);
    }
    return found;
  }

  /** @param {MDCCalendar} calendar @param {string} key */
  function dayList(calendar, key) {
    return day(calendar, key).entries;
  }

  // ---------- Placed occurrences (docs/Domain.md#day-list-order) ----------
  // A pin places an occurrence of a series in a day: `at` normal entries come before it. Pin lists are replaced, never
  // changed in place, so that an undo can keep the list it saw.

  /** @param {MDCCalendar} calendar @param {string} key @returns {readonly MDCPin[]} */
  function pins(calendar, key) {
    return calendar.days.get(key)?.pins || [];
  }

  /** @type {WeakMap<MDCCalendar, {revision: number, ids: Map<string, number>}>} */
  const idCaches = new WeakMap();

  /** Series index by ID; on a duplicate ID the first series wins. @param {MDCCalendar} calendar */
  function seriesIds(calendar) {
    let cache = idCaches.get(calendar);
    if (!cache || cache.revision !== calendar.seriesRevision) {
      /** @type {Map<string, number>} */
      const ids = new Map();
      calendar.series.forEach((series, index) => {
        if (!("raw" in series) && series.id && !ids.has(series.id)) ids.set(series.id, index);
      });
      cache = { revision: calendar.seriesRevision, ids };
      idCaches.set(calendar, cache);
    }
    return cache.ids;
  }

  /** Whether a pin still places an occurrence on its day. @param {MDCCalendar} calendar @param {string} key @param {string} id */
  function pinHolds(calendar, key, id) {
    const index = seriesIds(calendar).get(id);
    const series = index === undefined ? null : calendar.series[index];
    return Boolean(series && !("raw" in series) && !series.except.includes(key) && app.recurrence.occursOn(series.rule, series.start, key));
  }

  /** The placed occurrences of a day in display order: series index → number of normal entries before it. @param {MDCCalendar} calendar @param {string} key */
  function placedAt(calendar, key) {
    const ids = seriesIds(calendar);
    /** @type {Map<number, number>} */
    const placed = new Map();
    for (const pin of pins(calendar, key)) {
      const index = ids.get(pin.id);
      if (index !== undefined) placed.set(index, pin.at);
    }
    return placed;
  }

  /**
   * The pins of a day after its entries changed from `before` to `after`: each pin stays directly before the entry that
   * followed it, or the next one that is still there and did not move; without one at the end. `replaced` maps entries
   * that changed in place to their new version.
   * @param {readonly MDCEntry[]} before @param {readonly MDCEntry[]} after @param {readonly MDCPin[]} list
   * @param {Set<MDCEntry>} [moved] @param {Map<MDCEntry, MDCEntry>} [replaced]
   * @returns {MDCPin[]}
   */
  function repin(before, after, list, moved = new Set(), replaced = new Map()) {
    const next = list.map(pin => {
      for (let index = pin.at; index < before.length; index += 1) {
        const entry = replaced.get(before[index]) || before[index];
        if (moved.has(before[index]) || moved.has(entry)) continue;
        const at = after.indexOf(entry);
        if (at >= 0) return { id: pin.id, at };
      }
      return { id: pin.id, at: after.length };
    });
    // Stable: pins in one gap keep their order.
    return next.map((pin, order) => ({ pin, order })).sort((left, right) => left.pin.at - right.pin.at || left.order - right.order).map(item => item.pin);
  }

  /**
   * Runs `change` on the days of `keys` and keeps their pins in place; `placed` sets the pins of one day as dropped.
   * Returns the pins before, for `restorePins`.
   * @param {MDCCalendar} calendar @param {string[]} keys @param {() => void} change
   * @param {{moved?: Set<MDCEntry>, replaced?: Map<MDCEntry, MDCEntry>, placed?: {key: string, pins: MDCPin[]} | null}} [options]
   * @returns {Array<{key: string, pins: readonly MDCPin[]}>}
   */
  function keepPins(calendar, keys, change, options = {}) {
    const states = keys.map(key => ({ key, entries: [...entries(calendar, key)], pins: pins(calendar, key) }));
    change();
    for (const state of states) {
      const target = day(calendar, state.key);
      if (options.placed && options.placed.key === state.key) target.pins = options.placed.pins;
      else if (state.pins.length) target.pins = repin(state.entries, target.entries, state.pins, options.moved, options.replaced);
    }
    return states;
  }

  /** @param {MDCCalendar} calendar @param {Array<{key: string, pins: readonly MDCPin[]}>} states */
  function restorePins(calendar, states) {
    for (const state of states) day(calendar, state.key).pins = [...state.pins];
  }

  /**
   * A readable series ID from a title (docs/DataFormat.md#calendar): lowercase ASCII, umlauts transliterated, other
   * characters as hyphens; a number is appended while the ID is taken.
   * @param {string} title @param {ReadonlySet<string>} taken
   */
  function slug(title, taken) {
    const base = title.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "series";
    let id = base;
    for (let number = 2; taken.has(id); number += 1) id = `${base}-${number}`;
    return id;
  }

  /**
   * The pins of a day from placements of series that already have an ID. Pins of occurrences the drop did not show
   * (hidden behind “+N” in the month) are kept.
   * @param {MDCCalendar} calendar @param {string} key @param {MDCPlacement[]} placed @returns {MDCPin[]}
   */
  function toPins(calendar, key, placed) {
    return withHidden(calendar, key, placed.map(({ series, at }) => ({ id: seriesAt(calendar, series).id, at })));
  }

  /** `given` pins plus the day's other pins, ordered by position; in one gap the given ones first. @param {MDCCalendar} calendar @param {string} key @param {MDCPin[]} given */
  function withHidden(calendar, key, given) {
    const ids = new Set(given.map(pin => pin.id));
    const all = [...given, ...pins(calendar, key).filter(pin => !ids.has(pin.id))];
    return all.map((pin, order) => ({ pin, order })).sort((left, right) => left.pin.at - right.pin.at || left.order - right.order).map(item => item.pin);
  }

  /**
   * Sets the pins of a day as one action.
   * @param {MDCCalendar} calendar @param {string} key @param {string} label @param {MDCPin[]} next @returns {MDCDayAction}
   */
  function pinAction(calendar, key, label, next) {
    /** @type {readonly MDCPin[]} */
    let previous = [];
    return {
      label, days: [key], size: 64,
      redo() { previous = pins(calendar, key); day(calendar, key).pins = next; },
      undo() { day(calendar, key).pins = [...previous]; }
    };
  }

  /**
   * Places the occurrences of a day as dropped (docs/Domain.md#day-list-order): every occurrence of the day gets a pin,
   * a series without an ID gets one. `placed` lists the dropped series in display order with the number of normal entries
   * before each; occurrences the drop did not show (hidden behind “+N” in the month) are placed where they are shown now.
   * Returns null when nothing changes.
   * @param {MDCCalendar} calendar @param {string} key @param {MDCPlacement[]} placed @param {string} label
   * @returns {MDCDayAction | null}
   */
  function placeOccurrences(calendar, key, placed, label) {
    const taken = new Set(calendar.series.map(series => "raw" in series ? "" : series.id));
    const dropped = new Set(placed.map(item => item.series));
    /** @type {MDCPlacement[]} */
    const hidden = [];
    let before = 0;
    for (const item of app.recurrence.dayOrder(app.recurrence.occurrences(calendar, key), entries(calendar, key), placedAt(calendar, key))) {
      if ("entry" in item) before += 1;
      else if (!dropped.has(item.occurrence.index)) hidden.push({ series: item.occurrence.index, at: before });
    }
    /** @type {MDCDayAction[]} */
    const actions = [];
    /** @type {MDCPin[]} */
    const next = [...placed, ...hidden].map(({ series: index, at }) => {
      const series = seriesAt(calendar, index);
      if (series.id && seriesIds(calendar).get(series.id) === index) return { id: series.id, at };
      const id = slug(series.title, taken);
      taken.add(id);
      actions.push(/** @type {MDCDayAction} */ (updateSeries(calendar, index, { ...series, id })));
      return { id, at };
    });
    // In one gap the dropped ones first: the hidden ones were shown after them.
    const ordered = next.map((pin, order) => ({ pin, order })).sort((left, right) => left.pin.at - right.pin.at || left.order - right.order).map(item => item.pin);
    if (!actions.length && JSON.stringify(ordered) === JSON.stringify(pins(calendar, key))) return null;
    return combine(label, [...actions, pinAction(calendar, key, label, ordered)]);
  }

  /**
   * Drops the pins whose occurrence no longer exists after a series change (docs/Domain.md#day-list-order). Returns the
   * days with their pins before, for `restorePins`.
   * @param {MDCCalendar} calendar @param {string[]} ids
   */
  function prunePins(calendar, ids) {
    /** @type {Array<{key: string, pins: readonly MDCPin[]}>} */
    const states = [];
    if (!ids.length) return states;
    for (const [key, item] of calendar.days) {
      if (!item.pins.some(pin => ids.includes(pin.id))) continue;
      const kept = item.pins.filter(pin => !ids.includes(pin.id) || pinHolds(calendar, key, pin.id));
      if (kept.length === item.pins.length) continue;
      states.push({ key, pins: item.pins });
      item.pins = kept;
    }
    return states;
  }

  /** @param {MDCCalendar} calendar @param {MDCEntryRef} ref */
  function entryAt(calendar, ref) {
    const entry = entries(calendar, ref.key)[ref.index];
    if (!entry) throw new Error(`No entry at ${ref.key} #${ref.index}.`);
    return entry;
  }

  /** @param {MDCEntry} entry */
  function sizeOf(entry) {
    return 2 * (entry.title.length + entry.location.length + entry.note.join("\n").length + entry.extra.join("\n").length + 64);
  }

  /**
   * Builds an action that removes `from` (if set) and inserts `to` (if set).
   * @param {MDCCalendar} calendar
   * @param {string} label
   * @param {{ref: MDCEntryRef, entry: MDCEntry} | null} from
   * @param {{ref: MDCEntryRef, entry: MDCEntry} | null} to
   * @returns {MDCDayAction}
   */
  function replaceAction(calendar, label, from, to) {
    /** @param {{ref: MDCEntryRef, entry: MDCEntry} | null} removed @param {{ref: MDCEntryRef, entry: MDCEntry} | null} inserted */
    function apply(removed, inserted) {
      if (removed) dayList(calendar, removed.ref.key).splice(removed.ref.index, 1);
      if (inserted) dayList(calendar, inserted.ref.key).splice(inserted.ref.index, 0, inserted.entry);
    }
    const days = [...new Set([from?.ref.key, to?.ref.key].filter(key => key !== undefined))];
    const options = pinOptions(from, to);
    /** @type {Array<{key: string, pins: readonly MDCPin[]}>} */
    let saved = [];
    return {
      label,
      days,
      size: (from ? sizeOf(from.entry) : 0) + (to ? sizeOf(to.entry) : 0),
      redo() { saved = keepPins(calendar, days, () => apply(from, to), options); },
      undo() {
        apply(to, from);
        restorePins(calendar, saved);
      }
    };
  }

  /**
   * How pins follow a change of one entry: an entry changed in its place keeps the pins around it; one that moved does
   * not take them along.
   * @param {{ref: MDCEntryRef, entry: MDCEntry} | null} from @param {{ref: MDCEntryRef, entry: MDCEntry} | null} to
   */
  function pinOptions(from, to) {
    const inPlace = from && to && from.ref.key === to.ref.key && from.ref.group === to.ref.group && from.ref.index === to.ref.index;
    return inPlace ? { replaced: new Map([[from.entry, to.entry]]) } : { moved: new Set([from?.entry, to?.entry].filter(entry => entry !== undefined)) };
  }

  /**
   * Where an entry with this start time goes in a day list (docs/Domain.md#day-list-order): directly before the first
   * entry that starts later, otherwise directly after the last timed entry; without a time at the end.
   * @param {readonly MDCEntry[]} list @param {string} time
   */
  function timeSlot(list, time) {
    if (!time) return list.length;
    const later = list.findIndex(entry => entry.start !== "" && entry.start > time);
    if (later >= 0) return later;
    let last = -1;
    list.forEach((entry, index) => { if (entry.start) last = index; });
    return last + 1;
  }

  /** @param {MDCCalendar} calendar @param {string} key @param {MDCEntryFields & Partial<Pick<MDCEntry, "tag" | "extra">>} fields */
  function createEntry(calendar, key, fields) {
    /** @type {MDCEntry} */
    const entry = { done: false, tag: "", extra: [], ...fields };
    return replaceAction(calendar, entry.title, null, { ref: { key, index: timeSlot(entries(calendar, key), entry.start) }, entry });
  }

  /**
   * Changes the fields of an entry. A new date or start time puts it into its time slot of that day.
   * @param {MDCCalendar} calendar @param {MDCEntryRef} ref @param {string} key @param {MDCEntryFields} fields
   * @returns {MDCDayAction | null}
   */
  function updateEntry(calendar, ref, key, fields) {
    const entry = entryAt(calendar, ref);
    const updated = { ...entry, ...fields, note: [...fields.note] };
    const unchanged = key === ref.key && (Object.keys(fields)).every(name => {
      const field = /** @type {keyof MDCEntryFields} */ (name);
      return JSON.stringify(entry[field]) === JSON.stringify(updated[field]);
    });
    if (unchanged) return null;
    const sameDay = key === ref.key;
    const index = sameDay && updated.start === entry.start ? ref.index
      : timeSlot(entries(calendar, key).filter((_, position) => !sameDay || position !== ref.index), updated.start);
    return replaceAction(calendar, updated.title, { ref, entry }, { ref: { key, index }, entry: updated });
  }

  /** @param {MDCCalendar} calendar @param {MDCEntryRef} ref */
  function deleteEntry(calendar, ref) {
    const entry = entryAt(calendar, ref);
    return replaceAction(calendar, entry.title, { ref, entry }, null);
  }

  /** @param {MDCCalendar} calendar @param {MDCEntryRef} ref */
  function toggleDone(calendar, ref) {
    const entry = entryAt(calendar, ref);
    return replaceAction(calendar, entry.title, { ref, entry }, { ref, entry: { ...entry, done: !entry.done } });
  }

  /**
   * Moves an entry; `to.index` is the position in the target list after the entry was removed.
   * @param {MDCCalendar} calendar @param {MDCEntryRef} from @param {MDCEntryRef} to
   * @returns {MDCDayAction | null}
   */
  function moveEntry(calendar, from, to) {
    if (from.key === to.key && from.index === to.index) return null;
    const entry = entryAt(calendar, from);
    const length = entries(calendar, to.key).length - (from.key === to.key ? 1 : 0);
    if (to.index < 0 || to.index > length) throw new Error(`Invalid target position ${to.key} #${to.index}.`);
    return replaceAction(calendar, entry.title, { ref: from, entry }, { ref: to, entry });
  }

  /** @param {{done: boolean}} entry @param {string} key @param {string} today */
  function isOverdue(entry, key, today) {
    return !entry.done && key < today;
  }

  // ---------- Series and multi-day entries ----------

  /** @param {{title: string, location: string, note: string[], extra: string[]}} item */
  function itemSize(item) {
    return 2 * (item.title.length + item.location.length + item.note.join("\n").length + item.extra.join("\n").length + 128);
  }

  /**
   * Replaces, inserts or removes one item of a list (series or multi-day entries).
   * @template T
   * @param {MDCCalendar} calendar @param {T[]} list @param {string} label @param {string[]} days
   * @param {{index: number, item: T} | null} from @param {{index: number, item: T} | null} to
   * @returns {MDCDayAction}
   */
  function listAction(calendar, list, label, days, from, to) {
    /** @param {{index: number, item: T} | null} removed @param {{index: number, item: T} | null} inserted */
    function apply(removed, inserted) {
      if (removed) list.splice(removed.index, 1);
      if (inserted) list.splice(inserted.index, 0, inserted.item);
      if (list === /** @type {unknown} */ (calendar.series)) calendar.seriesRevision += 1;
    }
    // A series change drops the pins of occurrences it removed, in the same step (docs/Domain.md#day-list-order).
    const ids = list === /** @type {unknown} */ (calendar.series)
      ? [...new Set([from, to].map(change => /** @type {MDCSeries | undefined} */ (change?.item)?.id || "").filter(Boolean))] : [];
    /** @type {Array<{key: string, pins: readonly MDCPin[]}>} */
    let pruned = [];
    const size = [from, to].reduce((total, change) => total + (change ? itemSize(/** @type {any} */ (change.item)) : 0), 0);
    return {
      label, days, size, layout: true,
      redo() {
        apply(from, to);
        pruned = prunePins(calendar, ids);
      },
      undo() {
        restorePins(calendar, pruned);
        apply(to, from);
      }
    };
  }

  /** Combines actions that touch different lists into one undo step. @param {string} label @param {MDCDayAction[]} actions @returns {MDCDayAction} */
  function combine(label, actions) {
    return {
      label,
      days: [...new Set(actions.flatMap(action => action.days))],
      layout: actions.some(action => action.layout),
      backlog: actions.some(action => action.backlog),
      size: actions.reduce((total, action) => total + (action.size || 0), 0),
      redo() { actions.forEach(action => action.redo()); },
      undo() { [...actions].reverse().forEach(action => action.undo()); }
    };
  }

  /** @param {MDCCalendar} calendar @param {number} index */
  function seriesAt(calendar, index) {
    const series = calendar.series[index];
    if (!series || "raw" in series) throw new Error(`No series #${index}.`);
    return series;
  }

  /** @param {MDCCalendar} calendar @param {number} index */
  function multiDayAt(calendar, index) {
    const item = calendar.multiDay[index];
    if (!item || "raw" in item) throw new Error(`No multi-day entry #${index}.`);
    return item;
  }

  /** @param {string} start @param {string} end */
  function daysBetween(start, end) {
    const days = [];
    for (let key = start; key <= end && days.length < 400; key = dates.addDays(key, 1)) days.push(key);
    return days;
  }

  /** @param {MDCCalendar} calendar @param {MDCSeries} series */
  function createSeries(calendar, series) {
    return listAction(calendar, calendar.series, series.title, [], null, { index: calendar.series.length, item: series });
  }

  /** @param {MDCCalendar} calendar @param {number} index @param {MDCSeries} series @returns {MDCDayAction | null} */
  function updateSeries(calendar, index, series) {
    const current = seriesAt(calendar, index);
    if (JSON.stringify(current) === JSON.stringify(series)) return null;
    return listAction(calendar, calendar.series, series.title, [], { index, item: current }, { index, item: series });
  }

  /** @param {MDCCalendar} calendar @param {number} index */
  function deleteSeries(calendar, index) {
    const current = seriesAt(calendar, index);
    return listAction(calendar, calendar.series, current.title, [], { index, item: current }, null);
  }

  /** @param {string[]} list @param {string} key */
  function toggled(list, key) {
    return list.includes(key) ? list.filter(date => date !== key) : [...list, key].sort();
  }

  /** @param {MDCCalendar} calendar @param {number} index @param {string} key */
  function toggleOccurrence(calendar, index, key) {
    const series = seriesAt(calendar, index);
    return { .../** @type {MDCDayAction} */ (updateSeries(calendar, index, { ...series, done: toggled(series.done, key) })), days: [key], layout: false };
  }

  /** Deletes one occurrence: an exception date; a done mark of that date is dropped. @param {MDCCalendar} calendar @param {number} index @param {string} key */
  function deleteOccurrence(calendar, index, key) {
    const series = seriesAt(calendar, index);
    const updated = { ...series, except: [...new Set([...series.except, key])].sort(), done: series.done.filter(date => date !== key) };
    return { .../** @type {MDCDayAction} */ (updateSeries(calendar, index, updated)), days: [key], layout: false };
  }

  /**
   * Ends a series with the occurrence on `key`: it stays the last one.
   * @param {MDCCalendar} calendar @param {number} index @param {string} key
   */
  function endSeries(calendar, index, key) {
    const series = seriesAt(calendar, index);
    return updateSeries(calendar, index, { ...series, rule: { ...series.rule, until: key } });
  }

  /** @param {MDCCalendar} calendar @param {MDCMultiDay} item */
  function createMultiDay(calendar, item) {
    return listAction(calendar, calendar.multiDay, item.title, daysBetween(item.start, item.end), null, { index: calendar.multiDay.length, item });
  }

  /** @param {MDCCalendar} calendar @param {number} index @param {MDCMultiDay} item @returns {MDCDayAction | null} */
  function updateMultiDay(calendar, index, item) {
    const current = multiDayAt(calendar, index);
    if (JSON.stringify(current) === JSON.stringify(item)) return null;
    const days = [...new Set([...daysBetween(current.start, current.end), ...daysBetween(item.start, item.end)])];
    return listAction(calendar, calendar.multiDay, item.title, days, { index, item: current }, { index, item });
  }

  /** @param {MDCCalendar} calendar @param {number} index */
  function deleteMultiDay(calendar, index) {
    const current = multiDayAt(calendar, index);
    return listAction(calendar, calendar.multiDay, current.title, daysBetween(current.start, current.end), { index, item: current }, null);
  }

  /**
   * Multi-day bars across `count` days from `start`, stacked in lanes:
   * ordered by start date, then the longer bar first, then file order (docs/ui/Views.md).
   * @param {MDCCalendar} calendar @param {string} start @param {number} count
   * @returns {{segments: MDCSegment[], lanes: number, dayLanes: number[]}}
   */
  function segments(calendar, start, count) {
    const end = dates.addDays(start, count - 1);
    const startNumber = dates.dayNumber(start);
    /** @type {MDCSegment[]} */
    const result = [];
    calendar.multiDay.forEach((item, index) => {
      if ("raw" in item || item.end < start || item.start > end) return;
      const column = Math.max(0, dates.dayNumber(item.start) - startNumber);
      const last = Math.min(count - 1, dates.dayNumber(item.end) - startNumber);
      result.push({ item, index, column, span: last - column + 1, lane: 0, continuesBefore: item.start < start, continuesAfter: item.end > end });
    });
    result.sort((left, right) => left.item.start.localeCompare(right.item.start) || right.item.end.localeCompare(left.item.end) || left.index - right.index);
    /** @type {number[]} */
    const laneEnds = [];
    for (const segment of result) {
      let lane = laneEnds.findIndex(laneEnd => laneEnd < segment.column);
      if (lane < 0) lane = laneEnds.push(0) - 1;
      laneEnds[lane] = segment.column + segment.span - 1;
      segment.lane = lane;
    }
    // Lanes each day needs: one more than the highest lane of a bar covering it, so that only those days make room.
    const dayLanes = Array.from({ length: count }, () => 0);
    for (const segment of result) {
      for (let column = segment.column; column < segment.column + segment.span; column += 1) dayLanes[column] = Math.max(dayLanes[column], segment.lane + 1);
    }
    return { segments: result, lanes: laneEnds.length, dayLanes };
  }

  /**
   * Changes several occurrences at once, grouped per series: marks them done or open, or deletes them.
   * @param {MDCCalendar} calendar @param {Array<{index: number, key: string}>} occurrences @param {"done" | "open" | "delete"} mode
   * @returns {MDCDayAction[]}
   */
  function changeOccurrences(calendar, occurrences, mode) {
    /** @type {Map<number, string[]>} */
    const bySeries = new Map();
    for (const item of occurrences) bySeries.set(item.index, [...(bySeries.get(item.index) || []), item.key]);
    /** @type {MDCDayAction[]} */
    const actions = [];
    for (const [index, keys] of bySeries) {
      const series = seriesAt(calendar, index);
      const done = mode === "done" ? [...new Set([...series.done, ...keys])].sort() : series.done.filter(date => !keys.includes(date));
      const except = mode === "delete" ? [...new Set([...series.except, ...keys])].sort() : series.except;
      const action = updateSeries(calendar, index, { ...series, done, except });
      if (action) actions.push({ ...action, days: keys, layout: false });
    }
    return actions;
  }

  /**
   * Imports events as one action: single-day events become entries (done before `today`), events over several days
   * multi-day entries, supported rules series. Events already present (same title and date) are skipped.
   * @param {MDCCalendar} calendar @param {MDCIcsEvent[]} events @param {string} today
   * @returns {{action: MDCDayAction | null, entries: number, series: number, multiDay: number, duplicates: number, simplified: number}}
   */
  function importEvents(calendar, events, today) {
    const result = { action: /** @type {MDCDayAction | null} */ (null), entries: 0, series: 0, multiDay: 0, duplicates: 0, simplified: 0 };
    const known = new Set([
      ...Array.from(calendar.days, ([key, day]) => day.entries.map(entry => `e|${key}|${entry.title}`)).flat(),
      ...calendar.series.map(item => "raw" in item ? "" : `s|${item.start}|${item.title}`),
      ...calendar.multiDay.map(item => "raw" in item ? "" : `m|${item.start}|${item.end}|${item.title}`)
    ]);
    /** @type {Map<string, MDCEntry[]>} */
    const newEntries = new Map();
    /** @type {MDCSeries[]} */
    const newSeries = [];
    /** @type {MDCMultiDay[]} */
    const newMultiDay = [];
    for (const event of events) {
      const base = { title: event.title, tag: "", location: event.location, note: event.note, extra: [] };
      if (event.rule && event.start === event.end) {
        const id = `s|${event.start}|${event.title}`;
        if (known.has(id)) { result.duplicates += 1; continue; }
        known.add(id);
        newSeries.push({ ...base, id: "", start: event.start, startTime: event.startTime, endTime: event.endTime, rule: event.rule, except: event.except, done: [] });
        result.series += 1;
      } else if (event.end > event.start) {
        const id = `m|${event.start}|${event.end}|${event.title}`;
        if (known.has(id)) { result.duplicates += 1; continue; }
        known.add(id);
        newMultiDay.push({ ...base, start: event.start, end: event.end });
        result.multiDay += 1;
      } else {
        const id = `e|${event.start}|${event.title}`;
        if (known.has(id)) { result.duplicates += 1; continue; }
        known.add(id);
        if (event.unsupportedRule) result.simplified += 1;
        newEntries.set(event.start, [...(newEntries.get(event.start) || []),
          { ...base, done: event.start < today, start: event.startTime, end: event.startTime ? event.endTime : "" }]);
        result.entries += 1;
      }
    }
    if (!newEntries.size && !newSeries.length && !newMultiDay.length) return result;
    const keys = Array.from(newEntries.keys());
    const before = keys.map(key => [...entries(calendar, key)]);
    // Imported entries go into their time slots like new ones (docs/Domain.md#day-list-order).
    const after = keys.map((key, index) => (newEntries.get(key) || []).reduce((list, entry) => {
      list.splice(timeSlot(list, entry.start), 0, entry);
      return list;
    }, [...before[index]]));
    const seriesBefore = [...calendar.series];
    const multiBefore = [...calendar.multiDay];
    const pinsBefore = keys.map(key => pins(calendar, key));
    // Imported entries are new: the pins keep their place among the entries that were there.
    const pinsAfter = keys.map((key, index) => pinsBefore[index].length ? repin(before[index], after[index], pinsBefore[index]) : pinsBefore[index]);
    /** @param {MDCEntry[][]} days @param {Array<MDCSeries | MDCRawBlock>} series @param {Array<MDCMultiDay | MDCRawBlock>} multi @param {ReadonlyArray<readonly MDCPin[]>} placed */
    const set = (days, series, multi, placed) => {
      keys.forEach((key, index) => {
        dayList(calendar, key).splice(0, Infinity, ...days[index]);
        day(calendar, key).pins = [...placed[index]];
      });
      calendar.series.splice(0, Infinity, ...series);
      calendar.multiDay.splice(0, Infinity, ...multi);
      calendar.seriesRevision += 1;
    };
    const seriesAfter = [...seriesBefore, ...newSeries];
    const multiAfter = [...multiBefore, ...newMultiDay];
    result.action = {
      label: "ICS import", days: keys, layout: true,
      size: after.flat().reduce((total, entry) => total + sizeOf(entry), 0) + [...newSeries, ...newMultiDay].reduce((total, item) => total + itemSize(item), 0),
      redo() { set(after, seriesAfter, multiAfter, pinsAfter); },
      undo() { set(before, seriesBefore, multiBefore, pinsBefore); }
    };
    return result;
  }

  /**
   * Periods of a year with the given tag: multi-day entries and entries, consecutive days with the same title merged.
   * Used for the vacations in the holiday overview (docs/ui/Views.md#holiday-overview).
   * @param {MDCCalendar} calendar @param {string} tag @param {number} year @returns {MDCPeriod[]}
   */
  function taggedPeriods(calendar, tag, year) {
    const prefix = String(year);
    /** @type {MDCPeriod[]} */
    const periods = [];
    for (const item of calendar.multiDay) {
      if (!("raw" in item) && item.tag === tag && item.start.slice(0, 4) <= prefix && item.end.slice(0, 4) >= prefix) periods.push({ start: item.start, end: item.end, title: item.title });
    }
    /** @type {MDCPeriod[]} */
    const singles = [];
    for (const key of Array.from(calendar.days.keys()).filter(day => day.startsWith(prefix)).sort()) {
      for (const entry of entries(calendar, key)) {
        if (entry.tag !== tag) continue;
        const previous = singles.find(period => period.title === entry.title && dates.addDays(period.end, 1) === key);
        if (previous) previous.end = key;
        else singles.push({ start: key, end: key, title: entry.title });
      }
    }
    return [...periods, ...singles].sort((left, right) => left.start.localeCompare(right.start));
  }

  /**
   * Periods as a tree for display (docs/ui/Views.md#holiday-overview): a period that lies within another one (a trip
   * during a vacation) follows it one level deeper. Periods that only overlap, or cover the same days, stay side by side.
   * @param {readonly MDCPeriod[]} periods @returns {Array<{period: MDCPeriod, depth: number}>}
   */
  function nestPeriods(periods) {
    const ordered = [...periods].sort((left, right) => left.start.localeCompare(right.start) || right.end.localeCompare(left.end));
    /** @type {MDCPeriod[]} Containers of the current period, outermost first. */
    const open = [];
    return ordered.map(period => {
      while (open.length) {
        const outer = open[open.length - 1];
        const within = outer.start <= period.start && period.end <= outer.end && (outer.start !== period.start || outer.end !== period.end);
        if (within) break;
        open.pop();
      }
      const depth = open.length;
      open.push(period);
      return { period, depth };
    });
  }

  app.calendar = {
    parseDate, formatDate: dates.format, formatDay, parseTime, todayKey: dates.today, addDays: dates.addDays, addMonths: dates.monthStart,
    weekStart: dates.weekStart, weekDays, isoWeek: dates.isoWeek,
    entries, dayList, pins, placedAt, repin, keepPins, restorePins, pinOptions, toPins, slug, placeOccurrences, timeSlot, createEntry, updateEntry, deleteEntry, toggleDone, moveEntry, isOverdue,
    combine, createSeries, updateSeries, deleteSeries, toggleOccurrence, deleteOccurrence, endSeries,
    createMultiDay, updateMultiDay, deleteMultiDay, segments, taggedPeriods, nestPeriods, changeOccurrences, importEvents
  };
})(window.MDCalendar);
