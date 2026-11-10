window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Dates and day list operations (see docs/Domain.md).
// Days are addressed by ISO keys (YYYY-MM-DD); entries by their day and position.
(function (app) {
  const isoFormat = "YYYY-MM-DD";

  /**
   * Converts DD.MM.YYYY into an ISO day key, or "" when the date does not exist.
   * @param {string} value
   */
  function parseDate(value) {
    const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
    if (!match) return "";
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (month < 1 || month > 12 || day < 1 || day > daysInMonth) return "";
    return `${match[3]}-${match[2]}-${match[1]}`;
  }

  /** @param {string} key */
  function formatDate(key) {
    return `${key.slice(8, 10)}.${key.slice(5, 7)}.${key.slice(0, 4)}`;
  }

  /**
   * Normalizes H:MM or HH:MM; returns "" for an invalid time.
   * @param {string} value
   */
  function parseTime(value) {
    const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
    return match ? `${match[1].padStart(2, "0")}:${match[2]}` : "";
  }

  /** @param {Date} now */
  function todayKey(now) {
    return dayjs(now).format(isoFormat);
  }

  /** @param {string} key @param {number} days */
  function addDays(key, days) {
    return dayjs(key).add(days, "day").format(isoFormat);
  }

  /** First day of the month `months` after the month of `key`. @param {string} key @param {number} months */
  function addMonths(key, months) {
    return dayjs(`${key.slice(0, 7)}-01`).add(months, "month").format(isoFormat);
  }

  /** @param {string} key */
  function weekStart(key) {
    return dayjs(key).startOf("isoWeek").format(isoFormat);
  }

  /** @param {string} key */
  function weekDays(key) {
    const start = weekStart(key);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }

  /** @param {string} key */
  function isoWeek(key) {
    return dayjs(key).isoWeek();
  }

  /** @param {MDCCalendar} calendar @param {string} key @returns {readonly MDCEntry[]} */
  function entries(calendar, key) {
    return calendar.days.get(key)?.entries || [];
  }

  /** @param {MDCCalendar} calendar @param {string} key */
  function dayList(calendar, key) {
    let day = calendar.days.get(key);
    if (!day) {
      day = { key, entries: [], extra: [] };
      calendar.days.set(key, day);
    }
    return day.entries;
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
    return {
      label,
      days,
      size: (from ? sizeOf(from.entry) : 0) + (to ? sizeOf(to.entry) : 0),
      redo() { apply(from, to); },
      undo() { apply(to, from); }
    };
  }

  /** @param {MDCCalendar} calendar @param {string} key @param {MDCEntryFields & Partial<Pick<MDCEntry, "tag" | "extra">>} fields */
  function createEntry(calendar, key, fields) {
    /** @type {MDCEntry} */
    const entry = { done: false, tag: "", extra: [], ...fields };
    return replaceAction(calendar, entry.title, null, { ref: { key, index: entries(calendar, key).length }, entry });
  }

  /**
   * Changes the fields of an entry. A new date moves it to the end of that day.
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
    const index = key === ref.key ? ref.index : entries(calendar, key).length;
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
    const size = [from, to].reduce((total, change) => total + (change ? itemSize(/** @type {any} */ (change.item)) : 0), 0);
    return { label, days, size, layout: true, redo() { apply(from, to); }, undo() { apply(to, from); } };
  }

  /** Combines actions that touch different lists into one undo step. @param {string} label @param {MDCDayAction[]} actions @returns {MDCDayAction} */
  function combine(label, actions) {
    return {
      label,
      days: [...new Set(actions.flatMap(action => action.days))],
      layout: actions.some(action => action.layout),
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
    for (let key = start; key <= end && days.length < 400; key = addDays(key, 1)) days.push(key);
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

  /** @param {string[]} dates @param {string} key */
  function toggled(dates, key) {
    return dates.includes(key) ? dates.filter(date => date !== key) : [...dates, key].sort();
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
    const end = addDays(start, count - 1);
    const startNumber = dayCount(start);
    /** @type {MDCSegment[]} */
    const result = [];
    calendar.multiDay.forEach((item, index) => {
      if ("raw" in item || item.end < start || item.start > end) return;
      const column = Math.max(0, dayCount(item.start) - startNumber);
      const last = Math.min(count - 1, dayCount(item.end) - startNumber);
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
        newSeries.push({ ...base, start: event.start, startTime: event.startTime, endTime: event.endTime, rule: event.rule, except: event.except, done: [] });
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
    const after = keys.map((key, index) => [...before[index], ...(newEntries.get(key) || [])]);
    const seriesBefore = [...calendar.series];
    const multiBefore = [...calendar.multiDay];
    /** @param {MDCEntry[][]} days @param {Array<MDCSeries | MDCRawBlock>} series @param {Array<MDCMultiDay | MDCRawBlock>} multi */
    const set = (days, series, multi) => {
      keys.forEach((key, index) => dayList(calendar, key).splice(0, Infinity, ...days[index]));
      calendar.series.splice(0, Infinity, ...series);
      calendar.multiDay.splice(0, Infinity, ...multi);
      calendar.seriesRevision += 1;
    };
    const seriesAfter = [...seriesBefore, ...newSeries];
    const multiAfter = [...multiBefore, ...newMultiDay];
    result.action = {
      label: "ICS-Import", days: keys, layout: true,
      size: after.flat().reduce((total, entry) => total + sizeOf(entry), 0) + [...newSeries, ...newMultiDay].reduce((total, item) => total + itemSize(item), 0),
      redo() { set(after, seriesAfter, multiAfter); },
      undo() { set(before, seriesBefore, multiBefore); }
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
        const previous = singles.find(period => period.title === entry.title && addDays(period.end, 1) === key);
        if (previous) previous.end = key;
        else singles.push({ start: key, end: key, title: entry.title });
      }
    }
    return [...periods, ...singles].sort((left, right) => left.start.localeCompare(right.start));
  }

  /** Days since 1970-01-01. @param {string} key */
  function dayCount(key) {
    return Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10))) / 86400000;
  }

  app.calendar = {
    parseDate, formatDate, parseTime, todayKey, addDays, addMonths, weekStart, weekDays, isoWeek,
    entries, dayList, createEntry, updateEntry, deleteEntry, toggleDone, moveEntry, isOverdue,
    combine, createSeries, updateSeries, deleteSeries, toggleOccurrence, deleteOccurrence, endSeries,
    createMultiDay, updateMultiDay, deleteMultiDay, segments, taggedPeriods, changeOccurrences, importEvents
  };
})(window.MDCalendar);
