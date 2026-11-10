window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Fuzzy search over the whole calendar and the backlog (docs/Domain.md#search).
(function (app) {
  /** Search index, rebuilt only when the data version changes. @type {{version: number, items: MDCSearchItem[]}} */
  let cache = { version: -1, items: [] };

  /** Lowercase without diacritics, so that „Arzt“ finds „ärzt“ and „Muller“ finds „Müller“. @param {string} value */
  function normalize(value) {
    return value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").toLowerCase();
  }

  /** @param {MDCCalendar} calendar @param {MDCBacklog} backlog @returns {MDCSearchItem[]} */
  function index(calendar, backlog) {
    /** @type {MDCSearchItem[]} */
    const items = [];
    /** @param {Omit<MDCSearchItem, "title" | "text" | "words">} base @param {{title: string, location: string, note: string[], tag: string}} item */
    const add = (base, item) => {
      const text = normalize([item.title, item.location, ...item.note, item.tag].join(" "));
      items.push({ ...base, title: item.title, tag: item.tag, text, words: normalize(item.title) });
    };
    for (const [key, day] of calendar.days) day.entries.forEach((entry, position) => add({ kind: "entry", key, ref: { key, index: position } }, entry));
    calendar.series.forEach((series, position) => { if (!("raw" in series)) add({ kind: "series", key: series.start, series: position }, series); });
    calendar.multiDay.forEach((item, position) => { if (!("raw" in item)) add({ kind: "multiDay", key: item.start, end: item.end, multi: position }, item); });
    backlog.groups.forEach((group, groupIndex) => group.entries.forEach((entry, position) => add({ kind: "backlog", key: "", ref: { key: "", group: groupIndex, index: position } }, entry)));
    return items;
  }

  /**
   * Score of one query word in a text: substring matches score high, more at a word start;
   * a subsequence of the letters (typos by omission, abbreviations) scores low; -1 when it does not match.
   * @param {string} word @param {string} text
   */
  function wordScore(word, text) {
    const at = text.indexOf(word);
    if (at >= 0) return 10 + (at === 0 || /[^a-z0-9]/.test(text[at - 1]) ? 6 : 0) + word.length;
    let position = -1;
    let gaps = 0;
    for (const character of word) {
      const next = text.indexOf(character, position + 1);
      if (next < 0) return -1;
      if (position >= 0) gaps += next - position - 1;
      position = next;
    }
    return word.length >= 3 && gaps <= word.length * 2 ? Math.max(1, 6 - gaps) : -1;
  }

  /**
   * Hits for a query, best first; equally good hits closer to today come first.
   * @param {MDCCalendar} calendar @param {MDCBacklog} backlog @param {number} version @param {string} query @param {string} today @param {number} limit
   * @returns {MDCSearchItem[]}
   */
  function search(calendar, backlog, version, query, today, limit) {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    if (cache.version !== version) cache = { version, items: index(calendar, backlog) };
    const todayNumber = Date.parse(today);
    /** @type {Array<{item: MDCSearchItem, score: number, distance: number}>} */
    const hits = [];
    for (const item of cache.items) {
      let score = 0;
      for (const word of words) {
        const inTitle = wordScore(word, item.words);
        const value = inTitle >= 0 ? inTitle + 4 : wordScore(word, item.text);
        if (value < 0) {
          score = -1;
          break;
        }
        score += value;
      }
      if (score < 0) continue;
      const distance = item.key ? Math.abs(Date.parse(item.key) - todayNumber) : 0;
      hits.push({ item, score, distance });
    }
    hits.sort((left, right) => right.score - left.score || left.distance - right.distance);
    return hits.slice(0, limit).map(hit => hit.item);
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

  app.search = { search, nextOccurrence, normalize };
})(window.MDCalendar);
