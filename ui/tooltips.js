import { tooltips } from "@zang3th/md-libs/ui";

window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Tooltips of MD_Libs ui/tooltips: no touch tooltips, keyboard focus only, empty texts show nothing.
(function (app) {
  const tips = tooltips.create({
    window,
    element: /** @type {HTMLElement} */ (document.getElementById("appTooltip")),
    touch: false,
    focusVisibleOnly: true,
    hideEmpty: true
  });
  app.tooltips = { hide: tips.hide };
})(window.MDCalendar);
