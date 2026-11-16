"use strict";

// Enforces the layer rules of docs/Architecture.md on top of the MD_Libs checker engine, which covers
// modules, wiring, the page, styles and dependencies.

const path = require("node:path");
const ts = require("typescript");
const { createChecker, printResult } = require("@zang3th/md-libs/harness/checks");

const STORAGE = "io/storage.js";
/** Packages or package entry points each layer may import; app.js may import all of them. */
const PACKAGES = {
  domain: ["@zang3th/md-libs/core"],
  io: ["@zang3th/md-libs/core", "@zang3th/md-libs/platform"],
  ui: ["sortablejs", "@zang3th/md-libs/core", "@zang3th/md-libs/ui"],
  app: ["sortablejs", "@zang3th/md-libs"]
};

/** @param {string} root */
function checkArchitecture(root) {
  const checker = createChecker({ ts, root });
  const layers = { domain: checker.javascriptFiles("domain"), io: checker.javascriptFiles("io"), ui: checker.javascriptFiles("ui") };
  const production = [...layers.domain, ...layers.io, ...layers.ui, ...(checker.exists("app.js") ? ["app.js"] : [])];

  const dom = /\b(?:document|HTMLElement|Element|Node|MutationObserver|ResizeObserver|IntersectionObserver)\b/;
  // Property accesses and object keys such as entry.location are model fields, not browser globals.
  const browser = /(?<![.\w$])(?:window(?!\.MDCalendar\b)|navigator|location|localStorage|sessionStorage|indexedDB|AudioContext)\b(?!\s*:)/;
  const files = /\b(?:showDirectoryPicker|showOpenFilePicker|showSaveFilePicker|FileSystem\w*Handle|createWritable|getFile|FileReader)\b/;
  const sortable = /\bSortable(?:JS)?\b/;

  checker.forbid(layers.domain, "ARCH-DOMAIN-001", [
    [dom, "DOM access is forbidden in domain/"],
    [browser, "browser APIs are forbidden in domain/"],
    [files, "file APIs are forbidden in domain/"],
    [sortable, "SortableJS is forbidden in domain/"]
  ]);
  checker.forbid(layers.io, "ARCH-IO-001", [
    [dom, "DOM access is forbidden in io/"],
    [sortable, "SortableJS is forbidden in io/"]
  ]);
  checker.forbid(layers.io.filter(file => file !== STORAGE), "ARCH-IO-002", [
    [browser, "parsers and serializers must not access browser APIs"],
    [files, "parsers and serializers must not access files"]
  ]);
  checker.forbid(production.filter(file => file !== STORAGE), "ARCH-PERSISTENCE-001", [
    [files, `file access belongs in the storage adapter (${STORAGE})`],
    [/\bindexedDB\b/, `IndexedDB belongs in the storage adapter (${STORAGE})`]
  ]);
  checker.forbid(production.filter(file => !file.startsWith("ui/")), "ARCH-SORTABLE-001", [
    [sortable, "SortableJS belongs in ui/"]
  ]);

  checker.checkModules(layers, { namespace: "MDCalendar", packages: (_file, layer) => PACKAGES[layer] });
  if (checker.exists("MD_Calendar.html")) checker.checkPage("MD_Calendar.html", "dist/app.js", production.length > 0);
  else if (production.length) checker.report("MD_Calendar.html", "ARCH-WIRING-001", "production modules exist but the application page is missing");
  if (checker.exists("styles.css")) checker.checkStyles("styles.css");
  checker.checkDependencies(["@zang3th/md-libs", "sortablejs"]);
  return checker.violations();
}

if (require.main === module) printResult(checkArchitecture(path.resolve(__dirname, "..")));

module.exports = { checkArchitecture };
