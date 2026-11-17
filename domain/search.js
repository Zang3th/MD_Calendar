import { search as fuzzy } from "@zang3th/md-libs/core";

window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Search over the whole calendar and the backlog with MD_Libs core/search (docs/Domain.md#search).
(function (app) {
  /** Hits in the title rank before hits elsewhere. */
  const titleWeight = 24;
  /** Search index, rebuilt only when the data version changes. @type {{version: number, index: import("@zang3th/md-libs/core").search.MDLSearchIndex<MDCSearchItem> | null}} */
  let cache = { version: -1, index: null };

  /** @param {MDCCalendar} calendar @param {MDCBacklog} backlog @returns {MDCSearchItem[]} */
  function items(calendar, backlog) {
    /** @type {MDCSearchItem[]} */
    const found = [];
    /** @param {Omit<MDCSearchItem, "title" | "tag" | "details">} base @param {{title: string, location: string, note: string[], tag: string}} item */
    const add = (base, item) => {
      found.push({ ...base, title: item.title, tag: item.tag, details: [item.location, ...item.note, item.tag].join(" ") });
    };
    for (const [key, day] of calendar.days) day.entries.forEach((entry, position) => add({ kind: "entry", key, ref: { key, index: position } }, entry));
    calendar.series.forEach((series, position) => { if (!("raw" in series)) add({ kind: "series", key: series.start, series: position }, series); });
    calendar.multiDay.forEach((item, position) => { if (!("raw" in item)) add({ kind: "multiDay", key: item.start, end: item.end, multi: position }, item); });
    backlog.ungrouped.forEach((entry, position) => add({ kind: "backlog", key: "", ref: { key: "", group: app.backlog.ungrouped, index: position } }, entry));
    backlog.groups.forEach((group, groupIndex) => group.entries.forEach((entry, position) => add({ kind: "backlog", key: "", ref: { key: "", group: groupIndex, index: position } }, entry)));
    return found;
  }

  /**
   * Hits for a query, best first; equally good hits closer to today come first.
   * @param {MDCCalendar} calendar @param {MDCBacklog} backlog @param {number} version @param {string} query @param {string} today @param {number} limit
   * @returns {MDCSearchItem[]}
   */
  function search(calendar, backlog, version, query, today, limit) {
    let index = cache.version === version ? cache.index : null;
    if (!index) {
      const todayNumber = Date.parse(today);
      /** @param {MDCSearchItem} item */
      const distance = item => item.key ? Math.abs(Date.parse(item.key) - todayNumber) : 0;
      index = fuzzy.create({
        items: items(calendar, backlog),
        fields: [{ get: item => item.title, weight: titleWeight }, { get: item => item.details }],
        fold: "diacritics",
        words: true,
        tieBreak: (left, right) => distance(left) - distance(right)
      });
      cache = { version, index };
    }
    return index.query(query, { limit }).results.map(result => result.item);
  }

  /** The first occurrence of a series on or after `from` within two years, or its start. @param {MDCSeries} series @param {string} from */
  function nextOccurrence(series, from) {
    let key = from > series.start ? from : series.start;
    for (let step = 0; step < 732; step += 1, key = app.calendar.addDays(key, 1)) {
      if (series.rule.until && key > series.rule.until) break;
      if (!series.except.includes(key) && app.recurrence.occursOn(series.rule, series.start, key)) return key;
    }
    return series.start;
  }

  app.search = { search, nextOccurrence };
})(window.MDCalendar);
