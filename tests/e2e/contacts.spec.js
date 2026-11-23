const { test, expect } = require("./fixtures");

const contacts = "# Contacts\n\n## Contacts\n\n### Max Example\n#FirstName\n- Max\n#LastName\n- Example\n#Birthday\n- 12.11.1990\n";

test("contacts are edited inline with undo, focus moves on, and saving writes Contacts.md", async ({ page, calendar }) => {
  await calendar.openApp({ "Contacts.md": contacts });
  const badge = page.locator('.day[data-day="2026-11-12"] .badge--occasion');
  // A written-out badge shows the name only where it fits; a day too narrow for it shows the compact badge instead.
  await expect(badge).toHaveClass(/badge--compact/);
  await expect(badge).toHaveAttribute("aria-label", /Max Example 36/);
  await page.setViewportSize({ width: 2400, height: 900 });
  await expect(badge).toContainText("Max Example");
  await expect(badge).toContainText("36");
  await expect(badge.locator(".badge__name")).toHaveJSProperty("scrollWidth", await badge.locator(".badge__name").evaluate(name => name.clientWidth));
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(badge).toHaveClass(/badge--compact/);
  await badge.click();
  await page.locator("#occasionsPanel .occ__row", { hasText: "Max Example" }).click();
  await expect(page.locator("#contacts")).toBeVisible();
  await expect(page.locator('[data-key="name"]')).toHaveValue("Max Example");
  await expect(page.locator(".cx-next__day")).toHaveText(["12.11, Thu"]);

  await page.locator('[data-key="name"]').fill("Maxi  Muster ");
  await page.keyboard.press("Tab");
  await expect(page.locator('[data-action="export"]')).toBeFocused();
  await expect(page.locator("#save .save__count")).toHaveText("1");
  await expect(page.locator('[data-key="name"]')).toHaveValue("Maxi Muster");

  await page.locator('[data-add="phones"]').click();
  await expect(page.locator('[data-key="phones:0"]')).toBeFocused();
  await page.keyboard.type("+49 170 1");
  await page.keyboard.press("Enter");
  await page.locator('[data-key="birthday"]').fill("31.02");
  await page.keyboard.press("Enter");
  await expect(page.locator(".notification", { hasText: "Invalid birthday" })).toBeVisible();
  await expect(page.locator('[data-key="birthday"]')).toHaveValue("12.11.1990");

  await page.keyboard.press("Control+z");
  await expect(page.locator('[data-key="phones:0"]')).toHaveCount(1);
  await expect(page.locator('[data-key="phones:0"]')).toHaveValue("");
  await page.keyboard.press("Control+y");
  await page.keyboard.press("Control+s");
  await expect(page.locator("#save")).not.toHaveClass(/is-dirty/);
  expect(await calendar.readFile("Contacts.md")).toBe("# Contacts\n\n## Contacts\n\n### Maxi Muster\n#FirstName\n- Maxi\n#LastName\n- Muster\n" +
    "#Birthday\n- 12.11.1990\n#Phone\n- Mobile: +49 170 1\n");

  // The notes field grows with its text instead of scrolling.
  const notes = page.getByRole("textbox", { name: "Notes" });
  await notes.fill(Array.from({ length: 8 }, (_, index) => `Line ${index + 1}`).join("\n"));
  expect(await notes.evaluate(element => element.scrollHeight - element.clientHeight)).toBe(0);
  // Enter starts a new line; Ctrl+Enter commits the note.
  await notes.press("End");
  await notes.press("Enter");
  await expect(page.locator("#save")).not.toHaveClass(/is-dirty/);
  await notes.press("Control+Enter");
  await expect(page.locator("#save")).toHaveClass(/is-dirty/);
  await expect(notes).not.toBeFocused();
});

test("a vCard import merges a duplicate and adds a new contact as one undoable step", async ({ page, calendar }) => {
  await calendar.openApp({ "Contacts.md": contacts });
  await page.keyboard.press("c");
  await page.locator("#contactsImport").setInputFiles({
    name: "import.vcf", mimeType: "text/vcard",
    buffer: Buffer.from("BEGIN:VCARD\r\nVERSION:3.0\r\nN:Example;Max;;;\r\nEMAIL:max@example.com\r\nEND:VCARD\r\nBEGIN:VCARD\r\nVERSION:3.0\r\nN:Walker;Lena;;;\r\nEND:VCARD\r\n")
  });
  await expect(page.locator(".notification", { hasText: "1 new, 1 merged" })).toBeVisible();
  await expect(page.locator(".cx-row")).toHaveCount(2);
  await page.keyboard.press("Control+z");
  await expect(page.locator(".cx-row")).toHaveCount(1);
});

test("day badges: written out while they fit, otherwise one icon badge per kind; a count opens the list", async ({ page, calendar }) => {
  await calendar.openApp({
    "Contacts.md": "# Contacts\n\n## Contacts\n\n### Lena\n#FirstName\n- Lena\n#Birthday\n- 13.11.1994\n\n### Max\n#FirstName\n- Max\n#Birthday\n- 13.11.1990\n\n" +
      "### Beckers\n#FirstName\n- Beckers\n#Anniversary\n- Wedding: 13.11.2020\n\n### Tom\n#FirstName\n- Tom\n#Birthday\n- 12.11.1988\n",
    "Holidays.md": "# Holidays\n\n## Holidays\n- 12.11.2026 Some holiday\n- 13.11.2026 Other holiday\n\n## School vacations\n"
  });
  // A wide window leaves room for written-out names. Thursday: a birthday and a holiday fit written out, the birthday first.
  await page.setViewportSize({ width: 2400, height: 900 });
  await expect(page.locator('.day[data-day="2026-11-12"] .day__badges .badge')).toHaveText(["Tom38", "Some holiday"]);
  // Before a contact was opened, the contacts view shows the one whose birthday comes next.
  await page.keyboard.press("c");
  await expect(page.locator('[data-key="name"]')).toHaveValue("Tom");
  await page.keyboard.press("w");
  // A single birthday opens its list too.
  await page.locator('.day[data-day="2026-11-12"] .badge--birthday').click();
  await expect(page.locator("#occasionsPanel .occ__title")).toHaveText("Birthday");
  await expect(page.locator("#occasionsPanel .occ__row")).toHaveText(["Tomturns 38"]);
  // A second click on the same badge closes the list again.
  await page.locator('.day[data-day="2026-11-12"] .badge--birthday').click();
  await expect(page.locator("#occasionsPanel")).toBeHidden();
  // Friday: anniversary, two birthdays and a holiday do not fit; heart, gift with count and calendar star, in that order.
  const friday = page.locator('.day[data-day="2026-11-13"] .day__badges .badge');
  await expect(friday).toHaveCount(3);
  await expect(friday.nth(0)).toHaveClass(/badge--anniversary/);
  await expect(friday.nth(1)).toHaveClass(/badge--birthday/);
  await expect(friday.nth(1)).toHaveText("2");
  await expect(friday.nth(2)).toHaveClass(/badge--holiday/);
  await friday.nth(1).click();
  await expect(page.locator("#occasionsPanel .occ__title")).toHaveText("2 birthdays");
  await expect(page.locator("#occasionsPanel .occ__row")).toHaveText(["Lenaturns 32", "Maxturns 36"]);
  await page.locator("#occasionsPanel .occ__row", { hasText: "Max" }).click();
  await expect(page.locator('[data-key="name"]')).toHaveValue("Max");

  // The month shows only icon badges.
  await page.keyboard.press("m");
  await expect(page.locator('.mcell[data-day="2026-11-12"] .mcell__badges .badge--compact')).toHaveCount(2);
  await page.locator('.mcell[data-day="2026-11-12"] .badge--holiday').click();
  await expect(page.locator("#occasionsPanel")).toHaveClass(/occ--holiday/);
  await expect(page.locator("#occasionsPanel .occ__row")).toHaveText(["Some holiday"]);
  // Afterwards it shows the contact opened last.
  await page.keyboard.press("Escape");
  await page.keyboard.press("c");
  await expect(page.locator('[data-key="name"]')).toHaveValue("Max");
});
