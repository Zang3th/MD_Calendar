const base = require("@playwright/test");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

// The Origin Private File System is unavailable under file://, so browser tests that need a folder
// serve the application over http://127.0.0.1 and let the directory picker return an OPFS folder.
const root = path.resolve(__dirname, "../..");
/** @type {Record<string, string>} */
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ico": "image/x-icon", ".png": "image/png", ".webmanifest": "application/manifest+json" };

/** Fixed "today" of the tests: Thursday, 12 November 2026, like the prototype. */
const today = new Date("2026-11-12T10:00:00");

/**
 * @typedef {{
 *   origin: string,
 *   errors: string[],
 *   openApp(files?: Record<string, string>): Promise<void>,
 *   writeFile(name: string, text: string): Promise<void>,
 *   readFile(name: string): Promise<string | null>
 * }} CalendarFixture
 */

/**
 * @typedef {import("@playwright/test").TestType<
 *   import("@playwright/test").PlaywrightTestArgs & import("@playwright/test").PlaywrightTestOptions & { calendar: CalendarFixture },
 *   import("@playwright/test").PlaywrightWorkerArgs & import("@playwright/test").PlaywrightWorkerOptions & { origin: string }
 * >} CalendarTest
 */

const test = /** @type {CalendarTest} */ (/** @type {unknown} */ (base.test.extend(/** @type {any} */ ({
  // Playwright fixtures must destructure their first argument, even when they need no other fixture.
  // eslint-disable-next-line no-empty-pattern
  origin: [async ({}, /** @type {(value: string) => Promise<void>} */ use) => {
    const server = http.createServer((request, response) => {
      const file = path.join(root, decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname));
      if (!file.startsWith(root) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
      fs.createReadStream(file).pipe(response);
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(undefined)));
    const address = server.address();
    await use(`http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`);
    await new Promise(resolve => server.close(() => resolve(undefined)));
  }, { scope: "worker" }],

  /** @param {{page: import("@playwright/test").Page, origin: string}} args @param {(value: CalendarFixture) => Promise<void>} use */
  calendar: async ({ page, origin }, use) => {
    /** @type {string[]} */
    const errors = [];
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.on("pageerror", error => errors.push(error.message));
    await page.clock.setFixedTime(today);
    await page.addInitScript(() => {
      /** @type {any} */ (window).showDirectoryPicker = async () =>
        (await navigator.storage.getDirectory()).getDirectoryHandle("Kalender", { create: true });
    });

    /** @param {string} name @param {string} text */
    async function writeFile(name, text) {
      await page.evaluate(async ([fileName, content]) => {
        const folder = await (await navigator.storage.getDirectory()).getDirectoryHandle("Kalender", { create: true });
        const writable = await (await folder.getFileHandle(fileName, { create: true })).createWritable();
        await writable.write(content);
        await writable.close();
      }, [name, text]);
    }

    /** @param {string} name */
    async function readFile(name) {
      return page.evaluate(async fileName => {
        const folder = await (await navigator.storage.getDirectory()).getDirectoryHandle("Kalender", { create: true });
        try { return await (await (await folder.getFileHandle(fileName)).getFile()).text(); } catch { return null; }
      }, name);
    }

    /** Opens the application, puts the files into the folder and opens it via the start card. @param {Record<string, string>} [files] */
    async function openApp(files = {}) {
      await page.goto(`${origin}/MD_Calendar.html`);
      await base.expect(page.locator("body")).toHaveAttribute("data-startup-state", "ready");
      for (const [name, text] of Object.entries(files)) await writeFile(name, text);
      await page.locator("#pick").click();
      await base.expect(page.locator("#week:not([hidden]), #month:not([hidden])")).toBeVisible();
    }

    await use({ origin, errors, openApp, writeFile, readFile });
    base.expect(errors).toEqual([]);
  }
}))));

module.exports = { test, expect: base.expect, today };
