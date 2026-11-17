const base = require("@playwright/test");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

// The Origin Private File System is unavailable under file://, so browser tests that need a folder
// serve the application over http://127.0.0.1 and let the directory picker return an OPFS folder.
const root = path.resolve(__dirname, "../..");
/** @type {Record<string, string>} */
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ico": "image/x-icon", ".png": "image/png", ".webmanifest": "application/manifest+json" };

/** Every calendar folder needs MD_Calendar.json; `openApp` writes this one unless the files bring their own. */
const folderState = "MD_Calendar.json";
const emptyState = '{\n  "format": 1,\n  "devices": {},\n  "files": {}\n}\n';

/** Fixed "today" of the tests: Thursday, 12 November 2026. */
const today = new Date("2026-11-12T10:00:00");

/**
 * @typedef {{
 *   origin: string,
 *   errors: string[],
 *   openApp(files?: Record<string, string>): Promise<void>,
 *   writeFile(name: string, text: string): Promise<void>,
 *   readFile(name: string): Promise<string | null>,
 *   drag(source: import("@playwright/test").Locator, target: import("@playwright/test").Locator, height?: number): Promise<void>
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
        (await navigator.storage.getDirectory()).getDirectoryHandle("Calendar", { create: true });
    });

    /** @param {string} name @param {string} text */
    async function writeFile(name, text) {
      await page.evaluate(async ([fileName, content]) => {
        const folder = await (await navigator.storage.getDirectory()).getDirectoryHandle("Calendar", { create: true });
        const writable = await (await folder.getFileHandle(fileName, { create: true })).createWritable();
        await writable.write(content);
        await writable.close();
      }, [name, text]);
    }

    /** @param {string} name */
    async function readFile(name) {
      return page.evaluate(async fileName => {
        const folder = await (await navigator.storage.getDirectory()).getDirectoryHandle("Calendar", { create: true });
        try { return await (await (await folder.getFileHandle(fileName)).getFile()).text(); } catch { return null; }
      }, name);
    }

    /** Opens the application, puts the files and MD_Calendar.json into the folder and opens it via the start card. @param {Record<string, string>} [files] */
    async function openApp(files = {}) {
      await page.goto(`${origin}/MD_Calendar.html`);
      await base.expect(page.locator("body")).toHaveAttribute("data-startup-state", "ready");
      for (const [name, text] of Object.entries({ [folderState]: emptyState, ...files })) await writeFile(name, text);
      await page.locator("#pick").click();
      await base.expect(page.locator("#week:not([hidden]), #month:not([hidden])")).toBeVisible();
    }

    /**
     * Drags an entry onto the center of `target` like a pointer does. SortableJS reports a drag as started only in the
     * task after `dragstart` (`awaitingDragStarted`) and ignores a drop before that; Chromium runs input before timers,
     * so a drag sent at test speed could end before it had started and leave the entry in place. The drag therefore
     * waits until the app marks it as running (`is-sorting`, set in SortableJS's onStart), and measures the target
     * only then.
     * `height` is where on the target the pointer ends, as a share of its height: SortableJS keeps the entry in place
     * at a tile's exact middle, so a drop below or above another tile names its side.
     * @param {import("@playwright/test").Locator} source @param {import("@playwright/test").Locator} target @param {number} [height]
     */
    async function drag(source, target, height = 0.5) {
      const body = page.locator("body");
      // Hovering waits until the source stands still (the backlog panel slides in), then the box is exact.
      await source.hover();
      const from = /** @type {{x: number, y: number, width: number, height: number}} */ (await source.boundingBox());
      const x = from.x + from.width / 2;
      const y = from.y + from.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 6, y + 6, { steps: 3 });
      await base.expect(body).toHaveClass(/is-sorting/);
      // Jump next to the target, as dragTo does, so that no list on the way catches the entry; then step onto the
      // target's center, so that it receives several dragover events.
      const to = /** @type {{x: number, y: number, width: number, height: number}} */ (await target.boundingBox());
      const centerX = to.x + to.width / 2;
      const centerY = to.y + to.height * height;
      await page.mouse.move(centerX - Math.min(12, to.width / 4), centerY);
      await page.mouse.move(centerX, centerY, { steps: 4 });
      await page.mouse.move(centerX + 2, centerY, { steps: 2 });
      await page.mouse.up();
      await base.expect(body).not.toHaveClass(/is-sorting/);
    }

    await use({ origin, errors, openApp, writeFile, readFile, drag });
    base.expect(errors).toEqual([]);
  }
}))));

module.exports = { test, expect: base.expect, today, emptyState };
