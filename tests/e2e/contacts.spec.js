const { test, expect } = require("./fixtures");

const contacts = "# Contacts\n\n## Groups\n- Friends\n\n## Contacts\n\n### Max Example\n#FirstName\n- Max\n#LastName\n- Example\n#Birthday\n- 12.11.1990\n";

test("contacts are edited inline with undo, focus moves on, and saving writes Contacts.md", async ({ page, calendar }) => {
  await calendar.openApp({ "Contacts.md": contacts });
  const badge = page.locator('.day[data-day="2026-11-12"] .badge--occasion');
  await expect(badge).toContainText("Max Example");
  await expect(badge).toContainText("36");
  await badge.click();
  await page.locator("#occasionsPanel .occ__row", { hasText: "Max Example" }).click();
  await expect(page.locator("#contacts")).toBeVisible();
  await expect(page.locator('[data-key="firstName"]')).toHaveValue("Max");

  await page.locator('[data-key="nickname"]').fill("Maxi");
  await page.keyboard.press("Tab");
  await expect(page.locator('[data-key="company"]')).toBeFocused();
  await expect(page.locator("#save .save__count")).toHaveText("1");

  await page.locator('[data-key="company"]').fill("ACME");
  await page.keyboard.press("Enter");
  await page.locator('[data-add="phones"]').click();
  await expect(page.locator('[data-key="phones:0"]')).toBeFocused();
  await page.keyboard.type("+49 170 1");
  await page.keyboard.press("Enter");
  await page.locator('[data-key="birthday"]').fill("31.02.");
  await page.keyboard.press("Enter");
  await expect(page.locator(".notification", { hasText: "Invalid birthday" })).toBeVisible();
  await expect(page.locator('[data-key="birthday"]')).toHaveValue("12.11.1990");

  await page.keyboard.press("Control+z");
  await expect(page.locator('[data-key="phones:0"]')).toHaveCount(1);
  await expect(page.locator('[data-key="phones:0"]')).toHaveValue("");
  await page.keyboard.press("Control+y");
  await page.keyboard.press("Control+s");
  await expect(page.locator("#save")).not.toHaveClass(/is-dirty/);
  expect(await calendar.readFile("Contacts.md")).toBe("# Contacts\n\n## Groups\n- Friends\n\n## Contacts\n\n### Max Example\n#FirstName\n- Max\n#LastName\n- Example\n" +
    "#Nickname\n- Maxi\n#Birthday\n- 12.11.1990\n#Phone\n- Mobile: +49 170 1\n#Company\n- ACME\n");
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
  // Thursday: a birthday and a holiday fit written out, the birthday first.
  await expect(page.locator('.day[data-day="2026-11-12"] .day__badges .badge')).toHaveText(["Tom38", "Some holiday"]);
  // A single birthday opens its list too.
  await page.locator('.day[data-day="2026-11-12"] .badge--birthday').click();
  await expect(page.locator("#occasionsPanel .occ__title")).toHaveText("Birthday");
  await expect(page.locator("#occasionsPanel .occ__row")).toHaveText(["Tomturns 38"]);
  await page.keyboard.press("Escape");
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
  await expect(page.locator('[data-key="firstName"]')).toHaveValue("Max");

  // The month shows only icon badges.
  await page.keyboard.press("m");
  await expect(page.locator('.mcell[data-day="2026-11-12"] .mcell__badges .badge--compact')).toHaveCount(2);
  await page.locator('.mcell[data-day="2026-11-12"] .badge--holiday').click();
  await expect(page.locator("#occasionsPanel")).toHaveClass(/occ--holiday/);
  await expect(page.locator("#occasionsPanel .occ__row")).toHaveText(["Some holiday"]);
});
