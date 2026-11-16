const path = require("node:path");
const esbuild = require("esbuild");
const { loadClassic } = require("@zang3th/md-libs/harness/testing");

const root = path.join(__dirname, "../..");

/** Production modules with their imports in an isolated context; returns the shared namespace. @param {...string} files @returns {any} */
module.exports = function load(...files) {
  return loadClassic({ esbuild, root, namespace: "MDCalendar", files }).MDCalendar;
};
