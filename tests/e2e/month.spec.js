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

test("the month view collapses long days into „+N“ and opens their week", async ({ page, calendar }) => {
  const entries = ["A", "B", "C", "D", "E"].map(title => `- [ ] ${title}`).join("\n");
  await calendar.openApp({ "Calendar.md": `# Calendar\n\n## November 2026\n\n### 18.11.2026\n${entries}\n` });
  await page.keyboard.press("m");
  const cell = page.locator('.mcell[data-day="2026-11-18"]');
  // How many tiles fit depends on the cell height; the visible ones plus „+N“ always cover all entries.
  const visible = await cell.locator(".ev__title").allTextContents();
  expect(visible.length).toBeGreaterThan(0);
  expect(visible).toEqual(["A", "B", "C", "D", "E"].slice(0, visible.length));
  await expect(cell.locator(".more")).toHaveText(`+${5 - visible.length}`);
  await cell.locator(".more").click();
  await expect(page.locator("#week")).toBeVisible();
  await expect(page.locator('.day[data-day="2026-11-18"] .ev__title')).toHaveText(["A", "B", "C", "D", "E"]);
  await expect(page.locator("#kw")).toHaveText("KW 47");
});

test("drag and drop in the month moves an entry below the occurrences of the target day", async ({ page, calendar }) => {
  await calendar.openApp({ "Calendar.md": `# Calendar\n\n## November 2026\n\n### 10.11.2026\n- [ ] Move me\n\n${series}` });
  await page.keyboard.press("m");
  await page.locator('.mcell[data-day="2026-11-10"] .ev:not(.ev--series)').dragTo(page.locator('.mcell[data-day="2026-11-13"] .ev--series'));
  await expect(page.locator('.mcell[data-day="2026-11-13"] .ev__title')).toHaveText(["Vitamins", "Move me"]);
  await expect(page.locator('.mcell[data-day="2026-11-10"] .ev__title')).toHaveText(["Vitamins"]);
  await page.keyboard.press("Control+z");
  await expect(page.locator('.mcell[data-day="2026-11-10"] .ev__title')).toHaveText(["Vitamins", "Move me"]);
});
