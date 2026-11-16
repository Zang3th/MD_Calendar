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
  await expect(browser.locator("body")).toHaveAttribute("data-startup-state", "ready");
  await expect(browser.locator(".build-missing")).toBeHidden();
  const faces = await browser.evaluate(async () => (await document.fonts.load('16px "Plus Jakarta Sans"', "Äb")).length);
  expect(faces).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("a page without a build shows how to build it instead of the application", async ({ page: browser }) => {
  await browser.route("**/dist/app.js", route => route.abort("failed"));
  await browser.goto(page);
  await expect(browser.locator(".build-missing")).toBeVisible();
  await expect(browser.locator(".build-missing")).toContainText("npm run build");
  await expect(browser.locator(".app")).toBeHidden();
});
