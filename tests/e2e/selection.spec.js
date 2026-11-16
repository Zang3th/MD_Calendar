const { test, expect } = require("./fixtures");

const thursday = '.day[data-day="2026-11-12"]';
const friday = '.day[data-day="2026-11-13"]';
const calendarText = "# Calendar\n\n## November 2026\n\n### 12.11.2026\n- [ ] A\n- [ ] B\n- [ ] C\n";

test("the context menu copies an entry and pastes an open copy onto another day", async ({ page, calendar }) => {
  await calendar.openApp({ "Calendar.md": calendarText });
  await page.locator(`${thursday} .ev`, { hasText: "B" }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Copy" }).click();
  await page.locator(friday).click({ button: "right", position: { x: 60, y: 300 } });
  await page.getByRole("menuitem", { name: "Paste" }).click();
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
  await calendar.openApp({ "Calendar.md": "# Calendar\n\n## March 2027\n\n### 15.03.2027\n- [ ] Dentist Müller\n" });
  await page.keyboard.press("f");
  await page.keyboard.type("muller");
  await expect(page.locator(".sp__hit")).toHaveText(/Dentist Müller/);
  await page.keyboard.press("Enter");
  await expect(page.locator('.day[data-day="2027-03-15"] .ev__title')).toHaveText(["Dentist Müller"]);
  await expect(page.locator("#titleText")).toHaveText("March 2027");
});

test("double-clicking a day opens a new entry for that day", async ({ page, calendar }) => {
  await calendar.openApp();
  await page.locator(friday).dblclick({ position: { x: 60, y: 300 } });
  await expect(page.locator("#dialogDate")).toHaveValue("13.11.2026");
  await expect(page.locator("#dialogDateHint")).toHaveText("Friday, 13 November 2026");
});

test("“+” opens a choice; its ICS item imports into the open calendar", async ({ page, calendar }) => {
  await calendar.openApp();
  await page.locator("#new").click();
  // The file type is a chip without spaces around it; the accessible name keeps the plain sentence.
  await expect(page.locator("#new")).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("menuitem")).toHaveCount(2);
  await expect(page.getByRole("menuitem").first()).toHaveAccessibleName("Create new entry");
  await expect(page.getByRole("menuitem").nth(1)).toHaveAccessibleName("Import .ics event");
  await expect(page.locator("#contextMenu .menu__code")).toHaveText(".ics");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("menuitem", { name: "Import .ics event" }).click();
  await chooser;
  await page.locator("#icsImport").setInputFiles({
    name: "invitation.ics", mimeType: "text/calendar",
    buffer: Buffer.from("BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:x\r\nDTSTART;VALUE=DATE:20261113\r\nDTEND;VALUE=DATE:20261114\r\nSUMMARY:Invitation\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n")
  });
  await expect(page.locator(`${friday} .ev__title`)).toHaveText(["Invitation"]);
  await expect(page.locator(".notification", { hasText: "1 event imported" })).toBeVisible();
});
