import { recent } from "@zang3th/md-libs/ui";

window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Start card shown while no folder is open: recent folders, “Open folder” and “New calendar” (docs/ui/Shell.md#start-card).
// The list is MD_Libs ui/recent; interactions.js handles its clicks.
(function (app) {
  const start = /** @type {HTMLElement} */ (document.getElementById("start"));
  const list = /** @type {HTMLElement} */ (document.getElementById("recentList"));
  /** @type {Record<string, string>} */
  const icons = { item: "folder", remove: "close" };

  /** @param {number} value */
  const pad = value => String(value).padStart(2, "0");

  /** Date and time as two lines: “Today”, “Yesterday” or DD.MM.YYYY above HH:MM. @param {number} timestamp */
  function formatOpened(timestamp) {
    const date = new Date(timestamp);
    const key = app.calendar.todayKey(date);
    const today = app.calendar.todayKey(new Date());
    const day = key === today ? "Today" : key === app.calendar.addDays(today, -1) ? "Yesterday" : `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
    return { date: day, time: `${pad(date.getHours())}:${pad(date.getMinutes())}` };
  }

  /** The line below the folder name, from the cached MD_Calendar.json summary. @param {MDCRecentFolder} folder */
  function detail({ info }) {
    if (!info) return "";
    return [info.path, info.devices ? `${info.devices} ${info.devices === 1 ? "device" : "devices"}` : "", info.savedBy ? `saved on ${info.savedBy}` : ""]
      .filter(Boolean).join(" · ");
  }

  /** @param {MDCRecentFolder[]} folders Most recently opened first. */
  function show(folders) {
    recent.render({
      list,
      items: folders.map(folder => ({ ...folder, detail: detail(folder) })),
      format: formatOpened,
      icon: name => `<svg class="ui-icon" aria-hidden="true" viewBox="0 0 32 32"><use href="#icon-${icons[name]}"></use></svg>`,
      strings: { empty: "No recent folders", remove: name => `Remove “${name}” from recent folders` }
    });
    start.hidden = false;
  }

  function hide() {
    start.hidden = true;
  }

  app.start = { show, hide };
})(window.MDCalendar);
