const { test, expect, emptyState, today } = require("./fixtures");

// The storage adapter and the handle store are tested in MD_Libs; this covers the browser wiring:
// recent folders in IndexedDB, opening the last folder at startup and the way back to the start card.

/** The fixtures fix the clock; each step moves it on, so that “most recently opened” is unambiguous. */
let minute = 0;
/** @param {import("@playwright/test").Page} page */
async function tick(page) {
  minute += 1;
  await page.clock.setFixedTime(new Date(2026, 10, 12, 10, minute));
}

/** Lets the directory picker return the OPFS folder `name`. @param {import("@playwright/test").Page} page @param {string} name */
async function usePicker(page, name) {
  await page.evaluate(async folder => {
    const root = await navigator.storage.getDirectory();
    /** @type {any} */ (window).showDirectoryPicker = async () => root.getDirectoryHandle(folder, { create: true });
  }, name);
}

/** Remembers the calendar folder `name` as if it had been chosen with “Open folder”. @param {import("@playwright/test").Page} page @param {string} name */
async function pickFolder(page, name) {
  await tick(page);
  await usePicker(page, name);
  await page.evaluate(async ([folder, state]) => {
    const directory = await (await navigator.storage.getDirectory()).getDirectoryHandle(folder, { create: true });
    const writable = await (await directory.getFileHandle("MD_Calendar.json", { create: true })).createWritable();
    await writable.write(state);
    await writable.close();
    await /** @type {any} */ (window).MDCalendar.storage.pickFolder();
  }, [name, emptyState]);
}

test("the last folder opens again after a reload", async ({ page, calendar }) => {
  await page.goto(`${calendar.origin}/MD_Calendar.html`);
  await expect(page.locator("body")).toHaveAttribute("data-startup-state", "ready");
  await pickFolder(page, "Calendar");

  await page.reload();
  await expect(page.locator("#week")).toBeVisible();
  await expect(page.locator("#start")).toBeHidden();
  await expect(page.locator(".notification", { hasText: "Calendar" })).toBeVisible();
});

test("the start card lists recent folders, newest first, and removes them", async ({ page, calendar }) => {
  await page.goto(`${calendar.origin}/MD_Calendar.html`);
  await expect(page.locator("body")).toHaveAttribute("data-startup-state", "ready");
  await expect(page.locator(".recent-empty")).toHaveText("No recent folders");
  await expect(page.locator("#helpButton")).toBeVisible();
  await expect(page.locator("#sound")).toBeVisible();
  await expect(page.locator("#optionsButton")).toBeVisible();
  await expect(page.locator("#new")).toBeHidden();
  for (const name of ["Work", "Private", "Calendar"]) await pickFolder(page, name);

  await page.reload();
  await expect(page.locator("#week")).toBeVisible();
  await tick(page);
  await page.locator("#logo").click();
  await expect(page.locator("#start")).toBeVisible();
  await expect(page.locator("#week")).toBeHidden();
  await expect(page.locator("#appVersion")).toBeVisible();
  await expect(page.locator("#watermark")).toBeVisible();
  await expect(page.locator(".recent-name")).toHaveText(["Calendar", "Private", "Work"]);

  await tick(page);
  await page.locator(".recent-open", { hasText: "Work" }).click();
  await expect(page.locator("#week")).toBeVisible();
  await expect(page.locator("#appVersion")).toBeHidden();
  await expect(page.locator("#watermark")).toBeHidden();
  await page.locator("#logo").click();
  await expect(page.locator(".recent-name")).toHaveText(["Work", "Calendar", "Private"]);
  // Opening Work recorded this device in its MD_Calendar.json; the start card shows that below the name.
  await expect(page.locator(".recent-item", { hasText: "Work" }).locator(".recent-detail")).toHaveText("1 device");
  await expect(page.locator(".recent-item", { hasText: "Work" }).locator(".recent-date")).toHaveText("Today");

  await page.locator(".recent-remove[aria-label*='Private']").click();
  await expect(page.locator(".recent-name")).toHaveText(["Work", "Calendar"]);
  await tick(page);
  await page.reload();
  await expect(page.locator("#week")).toBeVisible();
  await page.locator("#logo").click();
  await expect(page.locator(".recent-name")).toHaveText(["Work", "Calendar"]);
});

test("a last folder that no longer exists leaves the start card open with a warning", async ({ page, calendar }) => {
  await page.goto(`${calendar.origin}/MD_Calendar.html`);
  await expect(page.locator("body")).toHaveAttribute("data-startup-state", "ready");
  await pickFolder(page, "Gone");
  await page.evaluate(async () => (await navigator.storage.getDirectory()).removeEntry("Gone", { recursive: true }));

  await page.reload();
  await expect(page.locator("body")).toHaveAttribute("data-startup-state", "ready");
  await expect(page.locator("#start")).toBeVisible();
  await expect(page.locator("#week")).toBeHidden();
  await expect(page.locator(".notification", { hasText: "Last folder not found" }).filter({ hasText: "Gone was moved or deleted." })).toBeVisible();
  await expect(page.locator(".recent-name")).toHaveText(["Gone"]);

  await page.locator(".recent-open", { hasText: "Gone" }).click();
  await expect(page.locator(".notification", { hasText: "Folder not found" })).toBeVisible();
  await expect(page.locator("#start")).toBeVisible();
});

test("a folder without MD_Calendar.json does not open; “New calendar” sets it up and saving records hashes", async ({ page, calendar }) => {
  await page.goto(`${calendar.origin}/MD_Calendar.html`);
  await expect(page.locator("body")).toHaveAttribute("data-startup-state", "ready");
  await calendar.writeFile("Calendar.md", "# Calendar\n\n## November 2026\n\n### 12.11.2026\n- [ ] Kept\n");
  const utc = today.toISOString().replace(".000Z", "Z");

  await page.locator("#pick").click();
  await expect(page.locator(".notification", { hasText: "Not a calendar folder" }).filter({ hasText: "Calendar has no MD_Calendar.json." })).toBeVisible();
  await expect(page.locator("#start")).toBeVisible();
  await expect(page.locator(".recent-empty")).toBeVisible();

  await page.locator("#create").click();
  await expect(page.locator('.day[data-day="2026-11-12"] .ev__title')).toHaveText(["Kept"]);
  await expect.poll(async () => JSON.parse(await calendar.readFile("MD_Calendar.json") || "{}").format).toBe(1);
  const device = await page.evaluate(() => localStorage.getItem("md-calendar-device"));
  const opened = JSON.parse(await calendar.readFile("MD_Calendar.json") || "{}");
  expect(opened.devices[device || ""].lastOpened).toBe(utc);

  await page.locator("#new").click();
  await page.getByRole("menuitem", { name: "Create new entry" }).click();
  await page.locator("#dialogTitle").fill("Added");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Control+s");
  await expect(page.locator("#save")).not.toHaveClass(/is-dirty/);
  await expect.poll(async () => JSON.parse(await calendar.readFile("MD_Calendar.json") || "{}").files?.["Calendar.md"]?.savedBy).toBe(device);
  const saved = JSON.parse(await calendar.readFile("MD_Calendar.json") || "{}");
  expect(saved.files["Calendar.md"].hash).toMatch(/^sha256-[0-9a-f]{64}$/);
  // The hash is the one of the file as it was written.
  const written = await calendar.readFile("Calendar.md") || "";
  expect(saved.files["Calendar.md"].hash).toBe(await page.evaluate(text => /** @type {any} */ (window).MDCalendar.storage.fingerprint(text), written));
  expect(saved.devices[device || ""].lastSaved).toBe(utc);
});
