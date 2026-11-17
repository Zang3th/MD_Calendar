const { test, expect } = require("./fixtures");

const series = "## Recurring\n\n### Vitamins\n#Start\n- 01.11.2026 08:00\n#Repeat\n- FREQ=DAILY\n";

test("checking off an occurrence records its date as done", async ({ page, calendar }) => {
  await calendar.openApp({ "Calendar.md": `# Calendar\n\n${series}` });
  const occurrence = page.locator('.day[data-day="2026-11-12"] .ev--series');
  await occurrence.locator(".ev__check").click();
  await expect(occurrence).toHaveClass(/is-done/);
  await page.keyboard.press("Control+s");
  await expect(page.locator("#save")).not.toHaveClass(/is-dirty/);
  expect(await calendar.readFile("Calendar.md")).toBe(`# Calendar\n\n${series}#Done\n- 12.11.2026\n`);
});

test("“+N” enlarges a long day in place; its entries can be dragged out and “Less” shrinks it", async ({ page, calendar }) => {
  const titles = Array.from({ length: 12 }, (_, index) => `E${index + 1}`);
  await calendar.openApp({ "Calendar.md": `# Calendar\n\n## November 2026\n\n### 18.11.2026\n${titles.map(title => `- [ ] ${title}`).join("\n")}\n` });
  await page.keyboard.press("m");
  const cell = page.locator('.mcell[data-day="2026-11-18"]');
  // How many tiles fit depends on the cell height; the visible ones plus “+N” always cover all entries, and one more
  // entry row would not fit next to the chip.
  const visible = await cell.locator(".ev__title").allTextContents();
  expect(visible.length).toBeGreaterThan(0);
  expect(visible).toEqual(titles.slice(0, visible.length));
  await expect(cell.locator(".more")).toHaveText(`+${titles.length - visible.length}`);
  const fits = await cell.evaluate(element => {
    const list = /** @type {HTMLElement} */ (element.querySelector(".mcell__list")).getBoundingClientRect();
    // Below the list: chip with its margin (24), cell padding (6) and border (1); another entry row needs 26 more.
    return element.getBoundingClientRect().bottom - list.bottom >= 24 + 6 + 1 + 26;
  });
  expect(fits).toBe(false);
  await cell.locator(".more").click();
  await expect(cell.locator(".ev__title")).toHaveText(titles);
  await expect(cell.locator(".more")).toHaveText("Less");
  await expect(page.locator("#month")).toBeVisible();
  // The neighbors keep their columns while the cell lies over them.
  const columns = await page.locator('.mcell[data-day="2026-11-19"]').evaluate(element => getComputedStyle(element).gridColumnStart);
  expect(columns).toBe("4");
  await calendar.drag(cell.locator(".ev", { hasText: "E12" }), page.locator('.mcell[data-day="2026-11-10"] .mcell__list'));
  await expect(page.locator('.mcell[data-day="2026-11-10"] .ev__title')).toHaveText(["E12"]);
  await expect(cell.locator(".ev__title")).toHaveText(titles.slice(0, 11));
  await cell.locator(".more").click();
  await expect(cell).not.toHaveClass(/is-expanded/);
  await expect(cell.locator(".more")).toHaveText(/^\+\d+$/);
  await cell.locator(".more").click();
  await page.keyboard.press("Escape");
  await expect(cell).not.toHaveClass(/is-expanded/);
});

test("drag and drop in the month moves an entry below the occurrences of the target day", async ({ page, calendar }) => {
  await calendar.openApp({ "Calendar.md": `# Calendar\n\n## November 2026\n\n### 10.11.2026\n- [ ] Move me\n\n${series}` });
  await page.keyboard.press("m");
  await calendar.drag(page.locator('.mcell[data-day="2026-11-10"] .ev:not(.ev--series)'), page.locator('.mcell[data-day="2026-11-13"] .ev--series'));
  await expect(page.locator('.mcell[data-day="2026-11-13"] .ev__title')).toHaveText(["Vitamins", "Move me"]);
  await expect(page.locator('.mcell[data-day="2026-11-10"] .ev__title')).toHaveText(["Vitamins"]);
  await page.keyboard.press("Control+z");
  await expect(page.locator('.mcell[data-day="2026-11-10"] .ev__title')).toHaveText(["Vitamins", "Move me"]);
});
