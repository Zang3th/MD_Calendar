window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Parser for Config.md; the file is maintained by hand and only read (see docs/DataFormat.md#configuration).
(function (app) {
  const byteOrderMark = String.fromCharCode(0xFEFF);
  const tagPattern = /^- ([^:#]+): #([0-9a-fA-F]{6})(?: ([a-z0-9]+(?:-[a-z0-9]+)*))?$/;

  /**
   * @param {string} text
   * @returns {{config: MDCConfig, warnings: MDCFormatWarning[]}}
   */
  function parse(text) {
    /** @type {MDCConfig} */
    const config = { tags: [] };
    /** @type {MDCFormatWarning[]} */
    const warnings = [];
    let inTags = false;
    text.replace(byteOrderMark, "").split(/\r?\n/).forEach((line, index) => {
      if (line.trim() === "" || line === "# Config") return;
      if (line.startsWith("## ")) {
        inTags = line === "## Tags";
        if (inTags) return;
      }
      const tag = inTags ? tagPattern.exec(line) : null;
      if (tag && !config.tags.some(existing => existing.name === tag[1].trim())) {
        config.tags.push({ name: tag[1].trim(), color: `#${tag[2].toLowerCase()}`, icon: tag[3] || "" });
        return;
      }
      warnings.push({ lineNumber: index + 1, kind: "unknown-line", text: line });
    });
    return { config, warnings };
  }

  /** Hue in degrees of a #rrggbb color; the UI derives tag tints from it (docs/ui/DesignSystem.md#color-tokens). @param {string} color */
  function hue(color) {
    const [red, green, blue] = [1, 3, 5].map(offset => Number.parseInt(color.slice(offset, offset + 2), 16) / 255);
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    if (max === min) return 0;
    const delta = max - min;
    const value = max === red ? (green - blue) / delta + (green < blue ? 6 : 0) : max === green ? (blue - red) / delta + 2 : (red - green) / delta + 4;
    return Math.round(value * 60);
  }

  app.configFormat = { parse, hue };
})(window.MDCalendar);
