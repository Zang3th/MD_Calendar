window.MDCalendar = window.MDCalendar || {};

(function () {
  dayjs.extend(dayjs_plugin_isoWeek);
  dayjs.extend(dayjs_plugin_customParseFormat);
  dayjs.locale("de");
})();
