const { test, expect } = require("./fixtures");

const contacts = "# Contacts\n\n## Groups\n- Friends\n\n## Contacts\n\n### Max Example\n#FirstName\n- Max\n#LastName\n- Example\n#Birthday\n- 12.11.1990\n";

test("contacts are edited inline with undo, focus moves on, and saving writes Contacts.md", async ({ page, calendar }) => {
  await calendar.openApp({ "Contacts.md": contacts });
  const badge = page.locator('.day[data-day="2026-11-12"] .badge--occasion');
  await expect(badge).toContainText("Max Example");
  await expect(badge).toContainText("36");
  await badge.click();
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
  await expect(page.locator(".notification", { hasText: "Ungültiger Geburtstag" })).toBeVisible();
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
  await page.keyboard.press("k");
  await page.locator("#contactsImport").setInputFiles({
    name: "import.vcf", mimeType: "text/vcard",
    buffer: Buffer.from("BEGIN:VCARD\r\nVERSION:3.0\r\nN:Example;Max;;;\r\nEMAIL:max@example.com\r\nEND:VCARD\r\nBEGIN:VCARD\r\nVERSION:3.0\r\nN:Neu;Lena;;;\r\nEND:VCARD\r\n")
  });
  await expect(page.locator(".notification", { hasText: "1 neu, 1 zusammengeführt" })).toBeVisible();
  await expect(page.locator(".cx-row")).toHaveCount(2);
  await page.keyboard.press("Control+z");
  await expect(page.locator(".cx-row")).toHaveCount(1);
});
