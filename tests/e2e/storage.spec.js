const { test, expect } = require("./fixtures");

// The storage adapter itself is tested in MD_Libs (storage contract); this covers the browser wiring:
// the picked folder is remembered in IndexedDB and opens again after a reload.
test("a picked folder is remembered and opens again after a reload", async ({ page, calendar }) => {
  await page.goto(`${calendar.origin}/MD_Calendar.html`);
  await expect(page.locator("body")).toHaveAttribute("data-startup-state", "ready");
  await page.evaluate(async () => { await /** @type {any} */ (window).MDCalendar.storage.pickFolder(); });

  await page.reload();
  await expect(page.locator("#week")).toBeVisible();
  await expect(page.locator("#start")).toBeHidden();
  await expect(page.locator(".notification", { hasText: "Kalender" })).toBeVisible();
});
