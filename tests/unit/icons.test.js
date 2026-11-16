const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { compareIcons } = require("@zang3th/md-libs/harness/checks");

const root = path.resolve(__dirname, "../..");
const html = fs.readFileSync(path.join(root, "MD_Calendar.html"), "utf8");

test("UI icon files match their inline symbols", () => {
  assert.deepEqual(compareIcons({ html, directory: path.join(root, "res/icons"), prefix: "icon-" }), []);
});

test("tag icon files match their inline symbols", () => {
  assert.deepEqual(compareIcons({ html, directory: path.join(root, "res/tag-icons"), prefix: "tag-" }), []);
});
