window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Parser for Holidays.md; the file is generated outside the app and only read (see docs/DataFormat.md#holidays-and-school-vacations).
(function (app) {
  const byteOrderMark = String.fromCharCode(0xFEFF);
  const holidayPattern = /^- (\d{2}\.\d{2}\.\d{4}) (.+)$/;
  const vacationPattern = /^- (\d{2}\.\d{2}\.\d{4}) - (\d{2}\.\d{2}\.\d{4}) (.+)$/;

  /**
   * @param {string} text
   * @returns {{holidays: MDCHolidays, warnings: MDCFormatWarning[]}}
   */
  function parse(text) {
    /** @type {MDCHolidays} */
    const holidays = { holidays: [], vacations: [] };
    /** @type {MDCFormatWarning[]} */
    const warnings = [];
    /** @type {"holidays" | "vacations" | null} */
    let section = null;
    text.replace(byteOrderMark, "").split(/\r?\n/).forEach((line, index) => {
      if (line.trim() === "" || line === "# Holidays") return;
      if (line === "## Holidays") { section = "holidays"; return; }
      if (line === "## School vacations") { section = "vacations"; return; }
      const vacation = section === "vacations" ? vacationPattern.exec(line) : null;
      const holiday = section === "holidays" ? holidayPattern.exec(line) : null;
      if (vacation) {
        const start = app.calendar.parseDate(vacation[1]);
        const end = app.calendar.parseDate(vacation[2]);
        if (start && end && start <= end) {
          holidays.vacations.push({ start, end, name: vacation[3].trim() });
          return;
        }
      } else if (holiday) {
        const date = app.calendar.parseDate(holiday[1]);
        if (date) {
          holidays.holidays.push({ date, name: holiday[2].trim() });
          return;
        }
      }
      warnings.push({ lineNumber: index + 1, kind: "unknown-line", text: line });
    });
    holidays.holidays.sort((left, right) => left.date.localeCompare(right.date));
    holidays.vacations.sort((left, right) => left.start.localeCompare(right.start));
    return { holidays, warnings };
  }

  app.holidaysFormat = { parse };
})(window.MDCalendar);
