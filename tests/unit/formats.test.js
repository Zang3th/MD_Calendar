const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const load = require("./load-classic");

const app = load("domain/calendar.js", "domain/recurrence.js", "io/calendar-format.js", "io/backlog-format.js", "io/holidays-format.js", "io/config-format.js");
/** @param {string} name */
const golden = name => fs.readFileSync(path.join(__dirname, "../../data/parsing", name), "utf8");

/** @param {unknown} value */
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("the backlog golden file round-trips and keeps groups in order", () => {
  const { backlog, warnings } = app.backlogFormat.parse(golden("Backlog.md"));
  assert.deepEqual(plain(warnings), []);
  assert.equal(app.backlogFormat.serialize(backlog), golden("Backlog.md"));
  assert.deepEqual(plain(backlog.groups.map((/** @type {any} */ group) => [group.name, group.entries.map((/** @type {any} */ entry) => entry.title)])), [
    ["Inbox", ["Cancel the phone contract"]],
    ["Someday", ["Change the tires", "Sort the photos"]],
    ["Empty group", []]
  ]);
  assert.deepEqual(plain(backlog.groups[1].entries[0]), {
    done: false, start: "", end: "", title: "Change the tires", tag: "Car", location: "Garage", note: ["Call the garage first"], extra: []
  });
});

test("a backlog without Inbox gets one, and unknown lines stay", () => {
  const { backlog, warnings } = app.backlogFormat.parse("# Backlog\n\n## Later\n- [ ] A\nloose\n");
  assert.deepEqual(plain(warnings).map((/** @type {any} */ warning) => warning.lineNumber), [5]);
  assert.equal(app.backlogFormat.serialize(backlog), "# Backlog\n\n## Inbox\n\n## Later\n- [ ] A\nloose\n");
});

test("holidays and school vacations are read from their golden file", () => {
  const { holidays, warnings } = app.holidaysFormat.parse(golden("Holidays.md"));
  assert.deepEqual(plain(warnings), []);
  assert.deepEqual(plain(holidays), {
    holidays: [{ date: "2026-12-25", name: "Christmas Day" }, { date: "2026-12-26", name: "Boxing Day" }],
    vacations: [{ start: "2026-12-23", end: "2027-01-06", name: "Christmas vacation" }]
  });
});

test("tags with color and icon are read from the configuration", () => {
  const { config, warnings } = app.configFormat.parse(golden("Config.md"));
  assert.deepEqual(plain(warnings), []);
  assert.deepEqual(plain(config.tags), [
    { name: "Private", color: "#458588", icon: "home" },
    { name: "Work", color: "#d79921", icon: "briefcase" },
    { name: "Car", color: "#689d6a", icon: "car" }
  ]);
  assert.equal(app.configFormat.hue("#458588"), 183);
  assert.equal(app.configFormat.hue("#ff0000"), 0);
  assert.equal(app.configFormat.hue("#0000ff"), 240);
});
