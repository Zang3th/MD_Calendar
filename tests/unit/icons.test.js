const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const html = fs.readFileSync(path.join(root, "MD_Calendar.html"), "utf8");

/** @param {string} value */
function normalize(value) {
  return value.replace(/\s+/g, " ").replace(/> </g, "><").trim();
}

/** @param {string} directory @param {string} prefix */
function checkFolder(directory, prefix) {
  const symbols = new Map(Array.from(html.matchAll(/<symbol id="([^"]+)" viewBox="([^"]+)"([^>]*)>([\s\S]*?)<\/symbol>/g))
    .filter(match => match[1].startsWith(prefix))
    .map(match => [match[1].slice(prefix.length), { viewBox: match[2], attributes: normalize(match[3]), content: normalize(match[4]) }]));
  const folder = path.join(root, directory);
  const files = fs.existsSync(folder) ? fs.readdirSync(folder).filter(name => name.endsWith(".svg")).sort() : [];

  assert.deepEqual(files.map(name => name.slice(0, -4)), Array.from(symbols.keys()).sort(), `${directory} and the ${prefix}* symbols list the same icons`);
  for (const name of files) {
    const source = fs.readFileSync(path.join(folder, name), "utf8").trim();
    const file = source.match(/^<svg\s+xmlns="http:\/\/www\.w3\.org\/2000\/svg"\s+viewBox="([^"]+)"([^>]*)>([\s\S]*?)<\/svg>$/);
    assert.ok(file, `${directory}/${name} has the standalone SVG wrapper`);
    const symbol = symbols.get(name.slice(0, -4));
    assert.ok(symbol);
    assert.equal(file[1], "0 0 32 32", `${directory}/${name} uses the 32x32 canvas`);
    assert.equal(symbol.viewBox, file[1], `${name}: viewBox matches`);
    assert.equal(symbol.attributes, normalize(file[2]), `${name}: root attributes match`);
    assert.equal(symbol.content, normalize(file[3]), `${name}: geometry matches`);
  }
}

test("UI icon files match their inline symbols", () => checkFolder("res/icons", "icon-"));

test("tag icon files match their inline symbols", () => checkFolder("res/tag-icons", "tag-"));
