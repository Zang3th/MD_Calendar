const { test, expect } = require("@playwright/test");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const page = pathToFileURL(path.resolve(__dirname, "../../MD_Calendar.html")).href;

test("the application page loads from file:// without errors", async ({ page: browser }) => {
  /** @type {string[]} */
  const errors = [];
  browser.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  browser.on("pageerror", error => errors.push(error.message));

  await browser.goto(page);
  await expect.poll(() => browser.evaluate(() => {
    const dayjs = /** @type {any} */ (window).dayjs;
    return typeof dayjs === "function" && dayjs.locale();
  })).toBe("de");
  const faces = await browser.evaluate(async () => (await document.fonts.load('16px "Plus Jakarta Sans"', "Äb")).length);
  expect(faces).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
