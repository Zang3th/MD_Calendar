"use strict";

// Bundles app.js and everything it imports into dist/app.js (see docs/Architecture.md#runtime).

const path = require("node:path");
const esbuild = require("esbuild");
const { build } = require("@zang3th/md-libs/harness/build");

const root = path.resolve(__dirname, "..");
// package.json is the only place of the version; the bundle receives it as the constant MDC_VERSION.
const { version } = require("../package.json");

/** Builds dist/app.js. */
function buildApp() {
  return build({ esbuild, root, define: { MDC_VERSION: JSON.stringify(version) } });
}

if (require.main === module) {
  buildApp().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

module.exports = { buildApp };
