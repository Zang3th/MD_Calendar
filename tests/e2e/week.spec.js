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
  await page.getByRole("menuitem", { name: "Create new entry" }).click();
  await page.locator("#dialogTitle").fill("Call Lena");
  // Tab opens token after token; in the prefilled date it first walks day, month and year. Leaving the time popover
  // keeps what was typed, and Enter applies from anywhere.
  const date = page.locator("#dialogDateInput");
  const selected = () => date.evaluate(input => input instanceof HTMLInputElement ? input.value.slice(input.selectionStart ?? 0, input.selectionEnd ?? 0) : "");
  for (const part of ["12", "11", "2026"]) {
    await page.keyboard.press("Tab");
    expect(await selected()).toBe(part);
  }
  await page.keyboard.press("Tab");
  // A time may be typed without its colon.
  await page.keyboard.type("930");
  await page.keyboard.press("Tab");
  await expect(page.locator("#dialogTime")).toHaveText("09:30");
  await expect(page.locator("#dialogRepeat")).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Enter");
  await expect(titles(page, thursday)).toHaveText(["Call Lena"]);
  await expect(page.locator("#save .save__count")).toHaveText("1");

  await page.keyboard.press("Control+s");
  await expect(page.locator("#save")).not.toHaveClass(/is-dirty/);
  expect(await calendar.readFile("Calendar.md")).toBe("# Calendar\n\n## November 2026\n\n### 12.11.2026\n- [ ] 09:30 Call Lena\n");

  await page.locator(`${thursday} .ev__check`).click();
  await calendar.writeFile("Calendar.md", "# Calendar\n\n## November 2026\n\n### 13.11.2026\n- [ ] Changed elsewhere, longer\n");
  await page.keyboard.press("Control+s");
  const overwrite = page.getByRole("button", { name: "Overwrite", exact: true });
  await expect(overwrite).toBeVisible();
  expect(await calendar.readFile("Calendar.md")).toContain("Changed elsewhere");

  await overwrite.click();
  await expect(page.locator("#save")).not.toHaveClass(/is-dirty/);
  expect(await calendar.readFile("Calendar.md")).toBe("# Calendar\n\n## November 2026\n\n### 12.11.2026\n- [x] 09:30 Call Lena\n");
});

test("an external change without local changes is reloaded", async ({ page, calendar }) => {
  await calendar.openApp({ "Calendar.md": "# Calendar\n\n## November 2026\n\n### 12.11.2026\n- [ ] First\n" });
  await expect(titles(page, thursday)).toHaveText(["First"]);
  await calendar.writeFile("Calendar.md", "# Calendar\n\n## November 2026\n\n### 12.11.2026\n- [ ] First\n- [ ] Added elsewhere\n");
  await expect(titles(page, thursday)).toHaveText(["First", "Added elsewhere"]);
  await expect(page.locator(".notification", { hasText: "reloaded" })).toBeVisible();
});

test("drag and drop moves an entry as one undoable action", async ({ page, calendar }) => {
  await calendar.openApp({ "Calendar.md": "# Calendar\n\n## November 2026\n\n### 12.11.2026\n- [ ] A\n- [ ] B\n\n### 13.11.2026\n- [ ] C\n" });
  await calendar.drag(page.locator(`${thursday} .ev`, { hasText: "B" }), page.locator(`${friday} .ev`, { hasText: "C" }));
  await expect(titles(page, thursday)).toHaveText(["A"]);
  await expect(titles(page, friday)).toHaveText(["B", "C"]);
  await expect(page.locator("#undo")).toHaveAttribute("aria-label", "Undo “B” (Ctrl+Z)");

  await page.locator("#undo").click();
  await expect(titles(page, thursday)).toHaveText(["A", "B"]);
  await expect(titles(page, friday)).toHaveText(["C"]);
  await expect(page.locator("#save")).not.toHaveClass(/is-dirty/);

  await page.keyboard.press("Control+y");
  await expect(titles(page, friday)).toHaveText(["B", "C"]);
  await page.keyboard.press("Control+z");
  await expect(titles(page, friday)).toHaveText(["C"]);
});

test("moving an entry and moving it back leaves nothing unsaved and nothing to undo", async ({ page, calendar }) => {
  await calendar.openApp({ "Calendar.md": "# Calendar\n\n## November 2026\n\n### 12.11.2026\n- [ ] A\n- [ ] B\n" });
  await calendar.drag(page.locator(`${thursday} .ev`, { hasText: "B" }), page.locator(`${thursday} .ev`, { hasText: "A" }));
  await expect(titles(page, thursday)).toHaveText(["B", "A"]);
  await expect(page.locator("#save .save__count")).toHaveText("1");
  await calendar.drag(page.locator(`${thursday} .ev`, { hasText: "A" }), page.locator(`${thursday} .ev`, { hasText: "B" }));
  await expect(titles(page, thursday)).toHaveText(["A", "B"]);
  await expect(page.locator("#save")).not.toHaveClass(/is-dirty/);
  // A change and its reversal leave no undo steps (docs/Architecture.md#undo-history).
  await expect(page.locator("#undo")).toBeDisabled();
});

test("the time wheels of the entry dialog pick start and end with the pointer", async ({ page, calendar }) => {
  await calendar.openApp();
  await page.locator(thursday).click({ position: { x: 60, y: 400 } });
  await page.locator("#dialogTitle").fill("Dentist");
  await page.locator("#dialogTime").click();
  // An invalid time is reported above the dialog, not behind its blurred backdrop, and the dialog stays open.
  await page.keyboard.type("25:00");
  await page.keyboard.press("Enter");
  const warning = page.locator(".notification-warning", { hasText: "Invalid time" });
  await expect(warning).toBeVisible();
  const box = /** @type {{x: number, y: number, width: number, height: number}} */ (await warning.boundingBox());
  expect(await page.evaluate(([x, y]) => Boolean(document.elementFromPoint(x, y)?.closest(".notification-warning")), [box.x + box.width / 2, box.y + box.height / 2])).toBe(true);
  await expect(page.locator("#dialog")).toBeVisible();
  // A click on a row turns its wheel there. The field follows: the changed part is selected, and the end adds “ – ”.
  const row = (/** @type {string} */ wheel, /** @type {string} */ value) => page.locator(`[data-wheel="${wheel}"] span`, { hasText: new RegExp(`^${value}$`) });
  const field = page.locator("#dialogTimeInput");
  const cursor = () => field.evaluate(input => input instanceof HTMLInputElement ? [input.value, input.selectionStart, input.selectionEnd] : []);
  await row("sh", "09").click();
  await row("sm", "30").click();
  expect(await cursor()).toEqual(["09:30", 3, 5]);
  await row("eh", "10").click();
  expect(await cursor()).toEqual(["09:30 – 10:30", 8, 10]);
  await row("em", "15").click();
  expect(await cursor()).toEqual(["09:30 – 10:15", 11, 13]);
  // A new start keeps the duration.
  await row("sh", "11").click();
  expect(await cursor()).toEqual(["11:30 – 12:15", 0, 2]);
  await expect(page.locator("#dialogTime")).toHaveText("11:30–12:15");
  await page.keyboard.press("Enter");
  // The new entry is highlighted once in the view, like a search hit.
  expect(await page.locator(`${thursday} .ev`, { hasText: "Dentist" }).evaluate(tile => tile.getAnimations().length)).toBeGreaterThan(0);
  await page.keyboard.press("Control+s");
  await expect(page.locator("#save")).not.toHaveClass(/is-dirty/);
  expect(await calendar.readFile("Calendar.md")).toBe("# Calendar\n\n## November 2026\n\n### 12.11.2026\n- [ ] 11:30 - 12:15 Dentist\n");
});

test("the entry dialog picks days and ranges in its calendar, moves an entry to the backlog by date and deletes with its trash button", async ({ page, calendar }) => {
  await calendar.openApp({ "Calendar.md": "# Calendar\n\n## November 2026\n\n### 12.11.2026\n- [ ] Call Lena #Work\n" });
  const day = (/** @type {string} */ key) => page.locator(`[data-calday="${key}"]`);
  await page.locator('.day[data-day="2026-11-13"]').click({ position: { x: 60, y: 400 } });
  // A new entry opens with its calendar open and the focus in the title.
  await expect(page.locator("#dialogTitle")).toBeFocused();
  await page.keyboard.type("Trip");
  // The first click sets the day, a second one the range; a click on its end returns to the start as one day.
  await day("2026-11-14").click();
  await day("2026-11-16").click();
  await expect(page.locator("#dialogDate")).toHaveText("14 – 16 Nov");
  // Time and repeat stay visible but cannot be chosen for several days.
  await expect(page.locator("#dialogTime")).toHaveAttribute("aria-disabled", "true");
  await expect(page.locator("#dialogRepeat")).toHaveAttribute("aria-disabled", "true");
  await day("2026-11-16").click();
  await expect(page.locator("#dialogDate")).toHaveText("Sat, 14 Nov");
  await day("2026-11-15").click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Enter");
  await expect(page.locator(".wk .bar")).toHaveText(/Trip/);

  // “Backlog” as the date moves a day entry to the backlog, into the group of its tag.
  // An item without a note opens with its calendar, for viewing: no cursor in the title; Tab starts at the buttons above it.
  await page.locator(".ev__open", { hasText: "Call Lena" }).click();
  await expect(page.locator("#dialog")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#dialogDuplicate")).toBeFocused();
  await page.locator("[data-pick=backlog]").click();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Control+s");
  await expect(page.locator("#save")).not.toHaveClass(/is-dirty/);
  expect(await calendar.readFile("Backlog.md")).toBe("# Backlog\n\n## Work\n- [ ] Call Lena #Work\n");
  expect(await calendar.readFile("Calendar.md")).toBe("# Calendar\n\n## Multi-day\n\n### Trip\n#Start\n- 14.11.2026\n#End\n- 15.11.2026\n");

  // A duplicated backlog entry stays in the backlog.
  await page.keyboard.press("b");
  await page.locator(".bl__list .ev__open", { hasText: "Call Lena" }).click();
  await page.locator("#dialogDuplicate").click();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Control+s");
  await expect(page.locator("#save")).not.toHaveClass(/is-dirty/);
  expect(await calendar.readFile("Backlog.md")).toBe("# Backlog\n\n## Work\n- [ ] Call Lena #Work\n- [ ] Call Lena #Work\n");
  await page.keyboard.press("b");

  // An item with a note opens with its note; the trash button above the title deletes it.
  await page.locator(".wk .bar", { hasText: "Trip" }).click();
  await page.locator("#dialogNoteToken").click();
  // Fourteen lines fit the notes popover without a scrollbar; a fifteenth scrolls.
  const lines = Array.from({ length: 15 }, (_, index) => `- Line ${index + 1}`);
  const overflow = () => page.locator("#dialogNote").evaluate(element => element.scrollHeight - element.clientHeight);
  await page.locator("#dialogNote").fill(lines.slice(0, 14).join("\n"));
  expect(await overflow()).toBe(0);
  await page.locator("#dialogNote").fill(lines.join("\n"));
  expect(await overflow()).toBeGreaterThan(0);
  await page.locator("#dialogNote").fill("Pack boots");
  await page.locator("#dialogApply").click();
  await page.locator(".wk .bar", { hasText: "Trip" }).click();
  await expect(page.locator("#dialogNoteToken")).toHaveAttribute("aria-expanded", "true");
  // A set note shows only its lit icon.
  await expect(page.locator("#dialogNoteToken")).toHaveClass(/is-set/);
  await expect(page.locator("#dialogNoteToken")).toHaveText("");
  await page.locator("#dialogDelete").click();
  await expect(page.locator(".wk .bar")).toHaveCount(0);
});
