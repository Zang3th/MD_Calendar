const { test, expect } = require("./fixtures");

const thursday = '.day[data-day="2026-11-12"]';
const friday = '.day[data-day="2026-11-13"]';
const calendarText = "# Calendar\n\n## November 2026\n\n### 12.11.2026\n- [ ] A\n- [ ] B\n- [ ] C\n";

test("the context menu copies an entry and pastes an open copy onto another day", async ({ page, calendar }) => {
  await calendar.openApp({ "Calendar.md": calendarText });
  await page.locator(`${thursday} .ev`, { hasText: "B" }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Kopieren" }).click();
  await page.locator(friday).click({ button: "right", position: { x: 60, y: 300 } });
  await page.getByRole("menuitem", { name: "Einfügen" }).click();
  await expect(page.locator(`${friday} .ev__title`)).toHaveText(["B"]);
  await page.keyboard.press("Control+z");
  await expect(page.locator(`${friday} .ev`)).toHaveCount(0);
});

test("Ctrl+click selects entries; Space checks them off and Delete removes them as one action", async ({ page, calendar }) => {
  await calendar.openApp({ "Calendar.md": calendarText });
  await page.locator(`${thursday} .ev`, { hasText: "A" }).locator(".ev__title").click({ modifiers: ["Control"] });
  await page.locator(`${thursday} .ev`, { hasText: "C" }).locator(".ev__title").click({ modifiers: ["Control"] });
  await expect(page.locator(`${thursday} .ev.is-selected`)).toHaveCount(2);
  await page.keyboard.press(" ");
  await expect(page.locator(`${thursday} .ev.is-done`)).toHaveCount(2);
  await page.keyboard.press("Delete");
  await expect(page.locator(`${thursday} .ev__title`)).toHaveText(["B"]);
  await page.keyboard.press("Control+z");
  await expect(page.locator(`${thursday} .ev__title`)).toHaveText(["A", "B", "C"]);
});

test("the search jumps to a hit in another month", async ({ page, calendar }) => {
  await calendar.openApp({ "Calendar.md": "# Calendar\n\n## March 2027\n\n### 15.03.2027\n- [ ] Zahnarzt Müller\n" });
  await page.keyboard.press("f");
  await page.keyboard.type("muller");
  await expect(page.locator(".sp__hit")).toHaveText(/Zahnarzt Müller/);
  await page.keyboard.press("Enter");
  await expect(page.locator('.day[data-day="2027-03-15"] .ev__title')).toHaveText(["Zahnarzt Müller"]);
  await expect(page.locator("#titleText")).toHaveText("März 2027");
});

test("double-clicking a day opens a new entry for that day", async ({ page, calendar }) => {
  await calendar.openApp();
  await page.locator(friday).dblclick({ position: { x: 60, y: 300 } });
  await expect(page.locator("#dialogDate")).toHaveValue("13.11.2026");
  await expect(page.locator("#dialogDateHint")).toHaveText("Freitag, 13. November 2026");
});
