const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

/**
 * Runs classic scripts (vendor and production) in an isolated context and returns the shared namespace.
 * Loaded dayjs plugins are registered the way app.js registers them.
 * @param {...string} files
 * @returns {any}
 */
module.exports = function loadClassic(...files) {
  const context = vm.createContext({ window: { MDCalendar: {} } });
  for (const file of files) {
    const source = fs.readFileSync(path.join(__dirname, "../..", file), "utf8");
    vm.runInContext(source, context, { filename: file });
  }
  if (context.dayjs && context.dayjs_plugin_isoWeek) context.dayjs.extend(context.dayjs_plugin_isoWeek);
  return context.window.MDCalendar;
};
