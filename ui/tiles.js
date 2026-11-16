import { markdown } from "@zang3th/md-libs/core";

window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Entry tiles, multi-day bars and day header badges shared by the views and the backlog panel (docs/ui/Views.md).
(function (app) {
  /** Tag name → hue in degrees and icon ID, from Config.md. @type {Map<string, {hue: number, icon: string}>} */
  let tagStyles = new Map();
  /** @type {MDCContacts | null} */
  let contacts = null;
  /** Day key → holiday names, from Holidays.md. @type {Map<string, string[]>} */
  let holidaysByDay = new Map();

  /** @param {string} value */
  function escape(value) {
    return markdown.escapeHtml(value);
  }

  /** @param {string} name */
  function icon(name) {
    return `<svg class="ui-icon" aria-hidden="true" viewBox="0 0 32 32"><use href="#icon-${name}"></use></svg>`;
  }

  /** Class and style that tint an element with its tag color; empty without a configured tag. @param {string} tag */
  function tint(tag) {
    const style = tagStyles.get(tag);
    return style === undefined ? { className: "", style: "", hue: null } : { className: " has-tag", style: ` style="--h:${style.hue}"`, hue: style.hue };
  }

  /** The tag icon of a configured tag, or "" (docs/ui/DesignSystem.md#tag-icons). @param {string} tag @param {string} [className] */
  function tagIcon(tag, className = "tag-icon") {
    const style = tagStyles.get(tag);
    return style?.icon ? `<svg class="ui-icon ${className}" aria-hidden="true" viewBox="0 0 32 32"><use href="#tag-${style.icon}"></use></svg>` : "";
  }

  /**
   * @param {{title: string, done: boolean, start: string, end: string, tag: string}} item
   * @param {string} attributes data attributes identifying the item
   * @param {boolean} overdue @param {boolean} series @param {boolean} compact
   */
  function tile(item, attributes, overdue, series, compact) {
    const classes = ["ev", series && "ev--series", item.done && "is-done", overdue && "is-overdue"].filter(Boolean).join(" ");
    const tagged = tint(item.tag);
    const time = item.start ? `${item.start}${item.end && !compact ? `–${item.end}` : ""}` : "";
    const description = [item.title, time, item.tag, series ? "recurring" : "", item.done ? "done" : overdue ? "overdue" : ""].filter(Boolean).join(", ");
    return `<div class="${classes}${tagged.className}"${tagged.style} ${attributes}>` +
      `<button class="ev__check" type="button" role="checkbox" aria-checked="${item.done}" aria-label="Done: ${escape(item.title)}">${icon("check")}</button>` +
      `<button class="ev__open" type="button" aria-label="${escape(description)}"><span class="ev__line">` +
      (time ? `<span class="ev__time">${time}</span>` : "") +
      tagIcon(item.tag, "ev__tag") +
      `<span class="ev__title">${escape(item.title)}</span>` +
      `</span></button>` +
      // Outside the text lines, so that it stays centered on the whole tile (docs/ui/Views.md#entry-tile).
      (series ? `<span class="ev__repeat">${icon("repeat")}</span>` : "") +
      `</div>`;
  }

  /**
   * The day list of one day: occurrences first, then the entries in their order.
   * @param {MDCCalendar} calendar @param {string} key @param {string} today @param {{limit?: number, compact?: boolean}} [options]
   */
  function dayTiles(calendar, key, today, options = {}) {
    const occurrences = app.recurrence.occurrences(calendar, key);
    const entries = app.calendar.entries(calendar, key);
    const limit = options.limit ?? Infinity;
    const compact = Boolean(options.compact);
    const html = [];
    for (const occurrence of occurrences.slice(0, limit)) {
      const item = { title: occurrence.series.title, done: occurrence.done, start: occurrence.series.startTime, end: occurrence.series.endTime, tag: occurrence.series.tag };
      // Occurrences of recurring entries are never overdue (docs/Domain.md#entry).
      html.push(tile(item, `data-series="${occurrence.index}" data-key="${key}"`, false, true, compact));
    }
    entries.slice(0, Math.max(0, limit - occurrences.length)).forEach((entry, index) => {
      html.push(tile(entry, `data-index="${index}"`, app.calendar.isOverdue(entry, key, today), false, compact));
    });
    return { html: html.join(""), hidden: Math.max(0, occurrences.length + entries.length - limit) };
  }

  /** Tiles of a backlog group; backlog entries have no date and are never overdue. @param {readonly MDCEntry[]} entries */
  function backlogTiles(entries) {
    return entries.map((entry, index) => tile(entry, `data-index="${index}"`, false, false, false)).join("");
  }

  /** @param {MDCSegment} segment @param {string} today @param {boolean} withRange */
  function bar(segment, today, withRange) {
    const { item } = segment;
    const tagged = tint(item.tag);
    const classes = ["bar", segment.continuesBefore && "cont-l", segment.continuesAfter && "cont-r", item.end < today && "is-past"].filter(Boolean).join(" ");
    const range = `${app.calendar.formatDay(item.start, "D MMM")} – ${app.calendar.formatDay(item.end, "D MMM")}`;
    return `<button class="${classes}${tagged.className}" type="button" data-multi="${segment.index}" data-start="${item.start}" data-end="${item.end}" ` +
      `style="--col:${segment.column};--span:${segment.span};--lane:${segment.lane}${tagged.hue === null ? "" : `;--h:${tagged.hue}`}" ` +
      `aria-label="${escape(item.title)}, ${range}">${tagIcon(item.tag, "bar__tag")}<span class="bar__title">${escape(item.title)}</span>${withRange ? `<span class="bar__range">${range}</span>` : ""}</button>`;
  }

  /**
   * Badges of a day header: holidays first, then birthdays and anniversaries; at most `max`,
   * the last one shows “+X” for the rest (docs/ui/Views.md#day-header).
   * @param {string} key @param {number} max
   */
  /** Name, label and age of an occasion, for accessible names and the occasion list. @param {{name: string, label: string, age: number | null}} item */
  function describeOccasion(item) {
    return `${item.name}${item.label ? ` (${item.label})` : ""}${item.age !== null ? ` ${item.age}` : ""}`;
  }

  /** The kinds of day badges, highest priority first, with their icon and wording. */
  const badgeKinds = /** @type {const} */ ([
    { kind: "anniversary", icon: "heart", one: "Anniversary", many: "anniversaries" },
    { kind: "birthday", icon: "gift", one: "Birthday", many: "birthdays" },
    { kind: "holiday", icon: "holiday", one: "Holiday", many: "holidays" }
  ]);

  /** What a day has to show, by kind, in priority order. @param {string} key */
  function dayOccasions(key) {
    const occasions = contacts ? app.contacts.occasionsOn(contacts, key) : [];
    return {
      anniversary: occasions.filter(item => item.label),
      birthday: occasions.filter(item => !item.label),
      holiday: (holidaysByDay.get(key) || []).map(name => ({ index: -1, name, label: "", age: /** @type {number | null} */ (null) }))
    };
  }

  /**
   * Badges of a day header, starting at the top right: anniversaries (heart), birthdays (gift), holidays (calendar with a star).
   * Written out (week): one anniversary or birthday shows its name and age, several share one badge with the icon and their
   * count, holidays show their names; more than `max` of them switch to the compact form. Compact (month): one icon badge
   * per kind with the count when there are several. Every anniversary and birthday badge, and every compact holiday badge,
   * opens the list of its kind (docs/ui/Views.md#day-header).
   * @param {string} key @param {number} max @param {boolean} [compact]
   */
  function badges(key, max, compact = false) {
    const byKind = dayOccasions(key);
    /** @type {Array<{label: string, tag: "button" | "span", attributes: string, action: string, content: string}>} */
    const parts = [];
    for (const { kind, icon: symbol, one, many } of badgeKinds) {
      const items = byKind[kind];
      if (!items.length) continue;
      const css = `badge badge--${kind}${kind === "holiday" ? "" : " badge--occasion"}`;
      // Every badge of people, and a compact holiday badge, opens the list of its kind; written-out holidays are text.
      const label = items.length === 1 ? `${one}: ${describeOccasion(items[0])}` : `${items.length} ${many}: ${items.map(describeOccasion).join(", ")}`;
      const list = { tag: /** @type {const} */ ("button"), action: "show list", label,
        attributes: `class="${css}${compact ? " badge--compact" : ""}" type="button" data-occasions="${key}" data-kind="${kind}" aria-haspopup="dialog"` };
      if (compact) {
        parts.push({ ...list, content: `${icon(symbol)}${items.length > 1 ? `<span class="badge__count">${items.length}</span>` : ""}` });
      } else if (kind === "holiday") {
        for (const item of items) parts.push({ label: item.name, tag: "span", action: "", attributes: `class="${css}"`, content: `<span class="badge__name">${escape(item.name)}</span>` });
      } else if (items.length === 1) {
        const [item] = items;
        parts.push({ ...list, content: `${icon(symbol)}<span class="badge__name">${escape(item.name)}</span>${item.age !== null ? `<span class="badge__age">${item.age}</span>` : ""}` });
      } else {
        parts.push({ ...list, content: `${icon(symbol)}<span class="badge__count">${items.length}</span>` });
      }
    }
    // Written-out badges that do not fit fall back to the compact row, which always fits.
    if (!compact && parts.length > max) return badges(key, badgeKinds.length, true);
    const shown = parts.slice(0, max);
    const rest = parts.slice(max);
    return shown.map((part, index) => {
      const last = rest.length > 0 && index === shown.length - 1;
      const label = [part.label, last ? `also ${rest.map(other => other.label).join(", ")}` : "", part.action].filter(Boolean).join("; ");
      const accessible = part.tag === "button" ? ` aria-label="${escape(label)}"` : "";
      return `<${part.tag} ${part.attributes}${accessible}>${part.content}${last ? `<span class="badge__more">+${rest.length}</span>` : ""}</${part.tag}>`;
    }).join("");
  }

  /** IDs of the shipped tag icons, from the inline sprite. */
  function tagIconIds() {
    return Array.from(document.querySelectorAll("symbol[id^='tag-']"), symbol => symbol.id.slice(4)).sort();
  }

  /** Takes the tags of Config.md; returns the tags whose icon ID is unknown (docs/Domain.md#tags). @param {MDCTag[]} tags */
  function setTags(tags) {
    const known = new Set(tagIconIds());
    tagStyles = new Map(tags.map(tag => [tag.name, { hue: app.configFormat.hue(tag.color), icon: known.has(tag.icon) ? tag.icon : "" }]));
    return tags.filter(tag => !known.has(tag.icon));
  }

  /** Slides a newly shown period in from the side it comes from (docs/ui/DesignSystem.md#motion). @param {string} id @param {number} direction */
  function slide(id, direction) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    document.getElementById(id)?.animate([{ transform: `translateX(${direction * 24}px)`, opacity: 0.4 }, { transform: "none", opacity: 1 }], { duration: 220, easing: "cubic-bezier(.2,.8,.2,1)" });
  }

  /** @param {MDCContacts | null} next */
  function setContacts(next) {
    contacts = next;
  }

  /** @param {MDCHolidays} holidays */
  function setHolidays(holidays) {
    holidaysByDay = new Map();
    for (const holiday of holidays.holidays) holidaysByDay.set(holiday.date, [...(holidaysByDay.get(holiday.date) || []), holiday.name]);
  }

  /** Scrolls a day into view and highlights it once (docs/ui/DesignSystem.md#motion). @param {HTMLElement} element */
  function pulse(element) {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest", inline: "nearest" });
    if (reduced) return;
    element.animate([{ transform: "scale(1)" }, { transform: "scale(1.015)" }, { transform: "scale(1)" }], { duration: 600, easing: "ease-out" });
  }

  app.tiles = { escape, icon, tint, tagIcon, tagIconIds, dayTiles, backlogTiles, bar, badges, describeOccasion, dayOccasions, setTags, setContacts, setHolidays, pulse, slide };
})(window.MDCalendar);
