const { test, expect } = require("./fixtures");

const thursday = '.day[data-day="2026-11-12"]';
const friday = '.day[data-day="2026-11-13"]';

/** @param {import("@playwright/test").Page} page @param {string} day */
function titles(page, day) {
  return page.locator(`${day} .ev__title`);
}

test("an entry is created and saved; a stale write leads to the reload-or-overwrite choice", async ({ page, calendar }) => {
  await calendar.openApp();
  await page.locator("#new").click();
  await page.locator("#dialogTitle").fill("Lena anrufen");
  await page.locator("#dialogStart").fill("9:30");
  await page.keyboard.press("Enter");
  await expect(titles(page, thursday)).toHaveText(["Lena anrufen"]);
  await expect(page.locator("#save .save__count")).toHaveText("1");

  await page.keyboard.press("Control+s");
  await expect(page.locator("#save")).not.toHaveClass(/is-dirty/);
  expect(await calendar.readFile("Calendar.md")).toBe("# Calendar\n\n## November 2026\n\n### 12.11.2026\n- [ ] 09:30 Lena anrufen\n");

  await page.locator(`${thursday} .ev__check`).click();
  await calendar.writeFile("Calendar.md", "# Calendar\n\n## November 2026\n\n### 13.11.2026\n- [ ] Changed elsewhere, longer\n");
  await page.keyboard.press("Control+s");
  const overwrite = page.getByRole("button", { name: "Überschreiben", exact: true });
  await expect(overwrite).toBeVisible();
  expect(await calendar.readFile("Calendar.md")).toContain("Changed elsewhere");

  await overwrite.click();
  await expect(page.locator("#save")).not.toHaveClass(/is-dirty/);
  expect(await calendar.readFile("Calendar.md")).toBe("# Calendar\n\n## November 2026\n\n### 12.11.2026\n- [x] 09:30 Lena anrufen\n");
});

test("an external change without local changes is reloaded", async ({ page, calendar }) => {
  await calendar.openApp({ "Calendar.md": "# Calendar\n\n## November 2026\n\n### 12.11.2026\n- [ ] First\n" });
  await expect(titles(page, thursday)).toHaveText(["First"]);
  await calendar.writeFile("Calendar.md", "# Calendar\n\n## November 2026\n\n### 12.11.2026\n- [ ] First\n- [ ] Added elsewhere\n");
  await expect(titles(page, thursday)).toHaveText(["First", "Added elsewhere"]);
  await expect(page.locator(".notification", { hasText: "neu geladen" })).toBeVisible();
});

test("drag and drop moves an entry as one undoable action", async ({ page, calendar }) => {
  await calendar.openApp({ "Calendar.md": "# Calendar\n\n## November 2026\n\n### 12.11.2026\n- [ ] A\n- [ ] B\n\n### 13.11.2026\n- [ ] C\n" });
  await page.locator(`${thursday} .ev`, { hasText: "B" }).dragTo(page.locator(`${friday} .ev`, { hasText: "C" }));
  await expect(titles(page, thursday)).toHaveText(["A"]);
  await expect(titles(page, friday)).toHaveText(["B", "C"]);
  await expect(page.locator("#undo")).toHaveAttribute("aria-label", "Rückgängig: „B“ (Strg Z)");

  await page.locator("#undo").click();
  await expect(titles(page, thursday)).toHaveText(["A", "B"]);
  await expect(titles(page, friday)).toHaveText(["C"]);
  await expect(page.locator("#save")).not.toHaveClass(/is-dirty/);

  await page.keyboard.press("Control+y");
  await expect(titles(page, friday)).toHaveText(["B", "C"]);
  await page.keyboard.press("Control+z");
  await expect(titles(page, friday)).toHaveText(["C"]);
});
