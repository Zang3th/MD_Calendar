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

/** @param {string[]} violations @param {string} rule @param {string} file */
function hasRule(violations, rule, file) {
  return violations.some(violation => violation.startsWith(`${file}: ${rule}`));
}

test("a correctly layered application passes", () => {
  const root = fixture({
    "domain/calendar.js": `${header}// document.title in a comment is not code\nconst label = "window.location";\n`,
    "io/storage.js": `${header}window.showDirectoryPicker; indexedDB;\n`,
    "io/calendar-format.js": `${header}`,
    "ui/interactions.js": `${header}document.body; new Sortable(document.body, {});\n`,
    "app.js": header,
    "vendor/Sortable.min.js": "",
    "MD_Calendar.html": page(["vendor/Sortable.min.js", "domain/calendar.js", "io/storage.js", "io/calendar-format.js", "ui/interactions.js", "app.js"])
  });
  assert.deepEqual(checkArchitecture(root), []);
});

test("an empty repository without production code passes", () => {
  assert.deepEqual(checkArchitecture(fixture({})), []);
});

test("layer boundary violations are reported", () => {
  const root = fixture({
    "domain/calendar.js": `${header}document.body; localStorage; new Sortable();\n`,
    "io/calendar-format.js": `${header}navigator.userAgent;\n`,
    "io/storage.js": `${header}document.title;\n`,
    "ui/header.js": `${header}window.showDirectoryPicker();\n`,
    "app.js": `${header}new Sortable(); fetch("x");\n`,
    "MD_Calendar.html": page(["domain/calendar.js", "io/storage.js", "io/calendar-format.js", "ui/header.js", "app.js"])
  });
  const violations = checkArchitecture(root);
  assert.ok(hasRule(violations, "ARCH-DOMAIN-001", "domain/calendar.js"));
  assert.ok(hasRule(violations, "ARCH-IO-002", "io/calendar-format.js"));
  assert.ok(hasRule(violations, "ARCH-IO-001", "io/storage.js"));
  assert.ok(hasRule(violations, "ARCH-PERSISTENCE-001", "ui/header.js"));
  assert.ok(hasRule(violations, "ARCH-SORTABLE-001", "app.js"));
  assert.ok(hasRule(violations, "ARCH-SCRIPTS-001", "app.js"));
});

test("script wiring, namespace and resources are checked", () => {
  const root = fixture({
    "domain/calendar.js": "const x = 1;\n",
    "io/storage.js": header,
    "ui/header.js": header,
    "app.js": header,
    "styles.css": "@font-face { src: url(vendor/fonts/missing.woff2); } a { background: url(https://example.com/x.png); }",
    "package.json": JSON.stringify({ dependencies: { dayjs: "1.11.23" } }),
    "MD_Calendar.html": '<script src="ui/header.js"></script><script defer src="io/storage.js"></script>' +
      '<script defer type="module" src="app.js"></script><script defer src="domain/calendar.js"></script>' +
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2"><svg><use href="#icon-volume"></use></svg>'
  });
  const violations = checkArchitecture(root);
  assert.ok(hasRule(violations, "ARCH-NAMESPACE-001", "domain/calendar.js"));
  assert.ok(hasRule(violations, "ARCH-SCRIPTS-002", "MD_Calendar.html"));
  assert.ok(violations.some(v => v.includes("app.js must load last")));
  assert.ok(hasRule(violations, "ARCH-WIRING-002", "MD_Calendar.html"));
  assert.ok(hasRule(violations, "ARCH-RESOURCES-001", "MD_Calendar.html"));
  assert.ok(hasRule(violations, "ARCH-RESOURCES-001", "styles.css"));
  assert.ok(hasRule(violations, "ARCH-RESOURCES-002", "styles.css"));
  assert.ok(hasRule(violations, "ARCH-DEPENDENCIES-001", "package.json"));
  assert.ok(!violations.some(v => v.includes("#icon-volume")));
});

test("production scripts without the application page are reported", () => {
  const violations = checkArchitecture(fixture({ "domain/calendar.js": header }));
  assert.ok(hasRule(violations, "ARCH-WIRING-001", "MD_Calendar.html"));
});
