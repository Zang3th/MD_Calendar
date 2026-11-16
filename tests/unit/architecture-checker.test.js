const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { checkArchitecture } = require("../../tools/check-architecture.js");

const header = "window.MDCalendar = window.MDCalendar || {};\n";

/** @param {Record<string, string>} files */
function fixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mdc-arch-"));
  for (const [name, content] of Object.entries({ "package.json": "{}", ...files })) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), content);
  }
  test.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

/** @param {string[]} scripts */
function page(scripts) {
  return `<!DOCTYPE html><html><head>${scripts.map(src => `<script defer src="${src}"></script>`).join("")}</head></html>`;
}

/** @param {string[]} modules */
function entry(modules) {
  return `import { dates } from "@zang3th/md-libs/core";\n${modules.map(file => `import "./${file}";\n`).join("")}${header}`;
}

/** @param {string[]} violations @param {string} rule @param {string} file */
function hasRule(violations, rule, file) {
  return violations.some(violation => violation.startsWith(`${file}: ${rule}`));
}

// The checker engine (module wiring, page, styles, resources, dependencies) is tested in MD_Libs harness/checks;
// these tests cover the rules MD_Calendar adds: its layer boundaries and which packages each layer may import.
test("a correctly layered application passes", () => {
  const root = fixture({
    "domain/calendar.js": `import { dates } from "@zang3th/md-libs/core";
${header}// document.title in a comment is not code
const label = "window.location";
`,
    "io/storage.js": `import { storage } from "@zang3th/md-libs/platform";
${header}window.showDirectoryPicker; indexedDB;
`,
    "io/calendar-format.js": `${header}const entry = { location: "" }; entry.location;
`,
    "ui/interactions.js": `import Sortable from "sortablejs";
import { keymap } from "@zang3th/md-libs/ui";
${header}document.body; Sortable.create(document.body, {});
`,
    "app.js": entry(["domain/calendar.js", "io/storage.js", "io/calendar-format.js", "ui/interactions.js"]),
    "package.json": JSON.stringify({ dependencies: { sortablejs: "1.15.7", "@zang3th/md-libs": "file:../MD_Libs" } }),
    "MD_Calendar.html": page(["dist/app.js"])
  });
  assert.deepEqual(checkArchitecture(root), []);
});

test("an empty repository without production code passes", () => {
  assert.deepEqual(checkArchitecture(fixture({})), []);
});

test("layer boundary violations are reported", () => {
  const root = fixture({
    "domain/calendar.js": `import Sortable from "sortablejs";
${header}document.body; localStorage; Sortable.create();
`,
    "io/calendar-format.js": `${header}navigator.userAgent;
`,
    "io/storage.js": `${header}document.title;
`,
    "ui/header.js": `import { audio } from "@zang3th/md-libs/platform";
${header}window.showDirectoryPicker();
`,
    "app.js": `${entry(["domain/calendar.js", "io/storage.js", "io/calendar-format.js", "ui/header.js"])}new Sortable();
`,
    "MD_Calendar.html": page(["dist/app.js"])
  });
  const violations = checkArchitecture(root);
  assert.ok(hasRule(violations, "ARCH-DOMAIN-001", "domain/calendar.js"));
  assert.ok(hasRule(violations, "ARCH-IMPORTS-001", "domain/calendar.js"), "sortablejs is not allowed in domain/");
  assert.ok(hasRule(violations, "ARCH-IMPORTS-001", "ui/header.js"), "md-libs/platform is not allowed in ui/");
  assert.ok(hasRule(violations, "ARCH-IO-002", "io/calendar-format.js"));
  assert.ok(hasRule(violations, "ARCH-IO-001", "io/storage.js"));
  assert.ok(hasRule(violations, "ARCH-PERSISTENCE-001", "ui/header.js"));
  assert.ok(hasRule(violations, "ARCH-SORTABLE-001", "app.js"));
});

test("production modules without the application page are reported", () => {
  assert.ok(hasRule(checkArchitecture(fixture({ "domain/calendar.js": header })), "ARCH-WIRING-001", "MD_Calendar.html"));
});
