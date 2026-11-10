"use strict";

// Enforces the layer rules of docs/Architecture.md. Adapted from MD_Manager.
// Layers that do not exist yet are skipped; once any production script exists,
// MD_Calendar.html must exist and load it.

const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const HTML = "MD_Calendar.html";
const STYLES = "styles.css";
const STORAGE = "io/storage.js";

/** @param {string} value */
function slash(value) {
  return value.replaceAll("\\", "/");
}

/** @param {string} value */
function spacesPreservingLines(value) {
  return value.replace(/[^\r\n]/g, " ");
}

/**
 * Blanks comments and literal contents so that examples and user-facing strings
 * do not look like executable dependencies.
 * @param {string} source
 */
function executableSource(source) {
  const scanner = ts.createScanner(ts.ScriptTarget.ES2022, false, ts.LanguageVariant.Standard, source);
  let result = "";
  let cursor = 0;
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    const start = scanner.getTokenPos();
    const end = scanner.getTextPos();
    result += source.slice(cursor, start);
    const literal = token === ts.SyntaxKind.StringLiteral ||
      token === ts.SyntaxKind.NoSubstitutionTemplateLiteral ||
      token === ts.SyntaxKind.RegularExpressionLiteral ||
      token === ts.SyntaxKind.SingleLineCommentTrivia ||
      token === ts.SyntaxKind.MultiLineCommentTrivia;
    result += literal ? spacesPreservingLines(source.slice(start, end)) : source.slice(start, end);
    cursor = end;
  }
  return result + source.slice(cursor);
}

/** @param {string} root @param {string} relativePath */
function exactFileExists(root, relativePath) {
  const normalized = path.posix.normalize(slash(relativePath));
  if (normalized !== slash(relativePath) || normalized === "." || normalized.startsWith("../") || path.posix.isAbsolute(normalized)) return false;
  let current = root;
  for (const part of normalized.split("/")) {
    if (!fs.existsSync(current) || !fs.statSync(current).isDirectory()) return false;
    if (!fs.readdirSync(current).includes(part)) return false;
    current = path.join(current, part);
  }
  return fs.existsSync(current);
}

/** @param {string} root */
function checkArchitecture(root) {
  /** @type {string[]} */
  const violations = [];
  /** @type {Map<string, string>} */
  const rawCache = new Map();
  /** @type {Map<string, string>} */
  const executableCache = new Map();

  /** @param {string} file @param {string} rule @param {string} detail */
  function report(file, rule, detail) {
    violations.push(`${slash(file)}: ${rule} — ${detail}`);
  }

  /** @param {string} file */
  function source(file) {
    let value = rawCache.get(file);
    if (value === undefined) {
      value = fs.readFileSync(path.join(root, file), "utf8");
      rawCache.set(file, value);
    }
    return value;
  }

  /** @param {string} file */
  function code(file) {
    let value = executableCache.get(file);
    if (value === undefined) {
      value = executableSource(source(file));
      executableCache.set(file, value);
    }
    return value;
  }

  /** @param {string[]} files @param {string} rule @param {Array<[RegExp, string]>} patterns */
  function forbid(files, rule, patterns) {
    for (const file of files) {
      const value = code(file);
      for (const [pattern, detail] of patterns) {
        if (pattern.test(value)) report(file, rule, detail);
      }
    }
  }

  /** @param {string} directory */
  function javascriptFiles(directory) {
    /** @type {string[]} */
    const files = [];
    /** @param {string} relative */
    function visit(relative) {
      for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const target = slash(path.join(relative, entry.name));
        if (fs.lstatSync(path.join(root, target)).isSymbolicLink()) report(target, "ARCH-FILES-001", "symbolic links are forbidden in production layers");
        else if (entry.isDirectory()) visit(target);
        else if (entry.name.endsWith(".js")) files.push(target);
        else report(target, "ARCH-FILES-002", "only JavaScript files are allowed in production layer directories");
      }
    }
    if (fs.existsSync(path.join(root, directory))) visit(directory);
    return files.sort();
  }

  const domainFiles = javascriptFiles("domain");
  const ioFiles = javascriptFiles("io");
  const uiFiles = javascriptFiles("ui");
  const appFiles = fs.existsSync(path.join(root, "app.js")) ? ["app.js"] : [];
  const productionFiles = [...domainFiles, ...ioFiles, ...uiFiles, ...appFiles];

  const dom = /\b(?:document|HTMLElement|Element|Node|MutationObserver|ResizeObserver|IntersectionObserver)\b/;
  // Property accesses and object keys such as entry.location are model fields, not browser globals.
  const browser = /(?<![.\w$])(?:window(?!\.MDCalendar\b)|navigator|location|localStorage|sessionStorage|indexedDB|AudioContext)\b(?!\s*:)/;
  const files = /\b(?:showDirectoryPicker|showOpenFilePicker|showSaveFilePicker|FileSystem\w*Handle|createWritable|getFile|FileReader)\b/;
  const sortable = /\bSortable(?:JS)?\b/;

  forbid(domainFiles, "ARCH-DOMAIN-001", [
    [dom, "DOM access is forbidden in domain/"],
    [browser, "browser APIs are forbidden in domain/"],
    [files, "file APIs are forbidden in domain/"],
    [sortable, "SortableJS is forbidden in domain/"]
  ]);

  forbid(ioFiles, "ARCH-IO-001", [
    [dom, "DOM access is forbidden in io/"],
    [sortable, "SortableJS is forbidden in io/"]
  ]);

  forbid(ioFiles.filter(file => file !== STORAGE), "ARCH-IO-002", [
    [browser, "parsers and serializers must not access browser APIs"],
    [files, "parsers and serializers must not access files"]
  ]);

  forbid(productionFiles.filter(file => file !== STORAGE), "ARCH-PERSISTENCE-001", [
    [files, `file access belongs in the storage adapter (${STORAGE})`],
    [/\bindexedDB\b/, `IndexedDB belongs in the storage adapter (${STORAGE})`]
  ]);

  forbid(productionFiles.filter(file => !file.startsWith("ui/")), "ARCH-SORTABLE-001", [
    [sortable, "SortableJS belongs in ui/"]
  ]);

  forbid(productionFiles, "ARCH-SCRIPTS-001", [
    [/(?:^|\n)\s*(?:import|export)\s/, "ES module syntax is forbidden in production code"],
    [/\brequire\s*\(/, "CommonJS is forbidden in production code"],
    [/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\b/, "network APIs are forbidden in production code"]
  ]);

  for (const file of productionFiles) {
    if (!/window\.MDCalendar\s*=\s*window\.MDCalendar\s*\|\|/.test(code(file))) {
      report(file, "ARCH-NAMESPACE-001", "production scripts must use the single window.MDCalendar namespace");
    }
  }

  const hasHtml = exactFileExists(root, HTML);
  if (productionFiles.length && !hasHtml) report(HTML, "ARCH-WIRING-001", "production scripts exist but the application page is missing");

  if (hasHtml) {
    const html = source(HTML);
    const scripts = [...html.matchAll(/<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)><\/script>/gi)].map(match => ({
      attributes: `${match[1]} ${match[3]}`,
      src: slash(match[2])
    }));
    const order = scripts.map(script => script.src);
    for (const script of scripts) {
      if (!/\bdefer\b/i.test(script.attributes)) report(HTML, "ARCH-SCRIPTS-002", `script '${script.src}' must be deferred`);
      if (/\btype\s*=\s*["']module["']/i.test(script.attributes)) report(HTML, "ARCH-SCRIPTS-002", `script '${script.src}' must not be an ES module`);
    }
    for (const file of productionFiles) {
      const count = order.filter(value => value === file).length;
      if (count !== 1) report(HTML, "ARCH-WIRING-001", `'${file}' must be loaded exactly once, found ${count}`);
    }
    for (const script of order) {
      if (!script.startsWith("vendor/") && !productionFiles.includes(script)) report(HTML, "ARCH-WIRING-001", `script '${script}' is neither a vendor file nor a production script`);
    }
    if (appFiles.length && order.at(-1) !== "app.js") report(HTML, "ARCH-WIRING-001", "app.js must load last");
    const groups = [order.filter(src => src.startsWith("vendor/")), domainFiles, ioFiles, uiFiles, appFiles].filter(group => group.length);
    for (let index = 1; index < groups.length; index += 1) {
      const previousEnd = Math.max(...groups[index - 1].map(file => order.indexOf(file)));
      const start = Math.min(...groups[index].map(file => order.indexOf(file)));
      if (previousEnd >= start) {
        report(HTML, "ARCH-WIRING-002", "scripts must load in the order vendor, domain, io, ui, app");
        break;
      }
    }
    for (const match of html.matchAll(/<(?:script|link|img|use|image)\b[^>]*\b(?:src|href)=["']([^"'#][^"']*)["'][^>]*>/gi)) {
      const resource = match[1];
      if (/^(?:[a-z]+:)?\/\//i.test(resource) || /^data:/i.test(resource)) {
        report(HTML, "ARCH-RESOURCES-001", `resource '${resource}' must be stored locally`);
        continue;
      }
      const resourcePath = resource.split(/[?#]/, 1)[0];
      if (!exactFileExists(root, resourcePath)) report(HTML, "ARCH-RESOURCES-002", `resource '${resource}' does not exist with exact path casing`);
    }
  }

  if (exactFileExists(root, STYLES)) {
    const css = source(STYLES);
    if (/@import\b/i.test(css)) report(STYLES, "ARCH-RESOURCES-001", "CSS imports are forbidden");
    for (const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
      const resource = match[1].trim();
      if (resource.startsWith("#")) continue;
      if (/^(?:[a-z]+:)?\/\//i.test(resource) || /^data:/i.test(resource)) {
        report(STYLES, "ARCH-RESOURCES-001", `resource '${resource}' must be stored locally`);
        continue;
      }
      if (!exactFileExists(root, resource.split(/[?#]/, 1)[0])) report(STYLES, "ARCH-RESOURCES-002", `resource '${resource}' does not exist with exact path casing`);
    }
  }

  const packageJson = JSON.parse(source("package.json"));
  for (const dependency of Object.keys(packageJson.dependencies || {})) {
    report("package.json", "ARCH-DEPENDENCIES-001", `production dependency '${dependency}' is not allowed; production dependencies are stored under vendor/`);
  }

  return violations.sort();
}

if (require.main === module) {
  const violations = checkArchitecture(path.resolve(__dirname, ".."));
  if (violations.length) {
    console.error("Architecture verification failed:\n");
    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
  } else {
    console.log("Architecture verification passed.");
  }
}

module.exports = { checkArchitecture, executableSource };
