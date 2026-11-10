const { test, expect } = require("./fixtures");

const thursday = '.day[data-day="2026-11-12"]';

test("entries move between the backlog and the days, and saving writes both files", async ({ page, calendar }) => {
  await calendar.openApp({
    "Calendar.md": "# Calendar\n\n## November 2026\n\n### 12.11.2026\n- [ ] Day entry\n",
    "Backlog.md": "# Backlog\n\n## Inbox\n- [ ] Someday task\n\n## Later\n"
  });
  await page.keyboard.press("b");
  const inbox = page.locator('.bl__list[data-group="0"]');
  await inbox.locator(".ev").dragTo(page.locator(`${thursday} .ev`));
  await expect(page.locator(`${thursday} .ev__title`)).toHaveText(["Someday task", "Day entry"]);
  await expect(inbox.locator(".ev")).toHaveCount(0);

  // Step through the move like a real pointer, so that the empty target list receives several dragover events.
  const source = /** @type {{x: number, y: number, width: number, height: number}} */ (await page.locator(`${thursday} .ev`, { hasText: "Day entry" }).boundingBox());
  const target = /** @type {{x: number, y: number, width: number, height: number}} */ (await page.locator('.bl__list[data-group="1"]').boundingBox());
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
  await page.mouse.move(target.x + target.width / 2 + 2, target.y + target.height / 2, { steps: 2 });
  await page.mouse.up();
  await expect(page.locator('.bl__list[data-group="1"] .ev__title')).toHaveText(["Day entry"]);
  await expect(page.locator(".bl__count").nth(1)).toHaveText("1");

  await page.keyboard.press("Control+s");
  await expect(page.locator("#save")).not.toHaveClass(/is-dirty/);
  expect(await calendar.readFile("Calendar.md")).toBe("# Calendar\n\n## November 2026\n\n### 12.11.2026\n- [ ] Someday task\n");
  expect(await calendar.readFile("Backlog.md")).toBe("# Backlog\n\n## Inbox\n\n## Later\n- [ ] Day entry\n");

  await page.keyboard.press("Control+z");
  await expect(page.locator(`${thursday} .ev__title`)).toHaveText(["Someday task", "Day entry"]);
});

test("holidays show in the day header and tags take their color from Config.md", async ({ page, calendar }) => {
  await calendar.openApp({
    "Calendar.md": "# Calendar\n\n## November 2026\n\n### 12.11.2026\n- [ ] Tagged #Work\n- [ ] Unconfigured #Other\n",
    "Holidays.md": "# Holidays\n\n## Holidays\n- 11.11.2026 Sankt Martin\n\n## School vacations\n",
    "Config.md": "# Config\n\n## Tags\n- Work: #ff0000 briefcase\n"
  });
  await expect(page.locator('.day[data-day="2026-11-11"] .badge--holiday')).toHaveText("Sankt Martin");
  await expect(page.locator(`${thursday} .ev`).first()).toHaveClass(/has-tag/);
  await expect(page.locator(`${thursday} .ev`).first()).toHaveAttribute("style", "--h:0");
  await expect(page.locator(`${thursday} .ev`).nth(1)).not.toHaveClass(/has-tag/);
});

test("dragging a multi-day bar moves the entry; dragging its end changes the end date", async ({ page, calendar }) => {
  await calendar.openApp({ "Calendar.md": "# Calendar\n\n## Multi-day\n\n### Trip\n#Start\n- 09.11.2026\n#End\n- 10.11.2026\n" });
  const bar = page.locator(".bar");
  /** @param {string} key */
  const center = async key => {
    const box = /** @type {{x: number, y: number, width: number, height: number}} */ (await page.locator(`.day[data-day="${key}"] .day__list`).boundingBox());
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };

  const box = /** @type {{x: number, y: number, width: number, height: number}} */ (await bar.boundingBox());
  const target = await center("2026-11-12");
  await page.mouse.move(box.x + box.width / 4, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, box.y + box.height / 2, { steps: 8 });
  await page.mouse.move(target.x, target.y, { steps: 4 });
  await page.mouse.up();
  await expect(bar).toHaveAttribute("data-start", "2026-11-12");
  await expect(bar).toHaveAttribute("data-end", "2026-11-13");

  const moved = /** @type {{x: number, y: number, width: number, height: number}} */ (await bar.boundingBox());
  const end = await center("2026-11-15");
  await page.mouse.move(moved.x + moved.width - 3, moved.y + moved.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
  await expect(bar).toHaveAttribute("data-end", "2026-11-15");
  await expect(page.locator("#dialog")).not.toBeVisible();

  await page.keyboard.press("Control+s");
  await expect(page.locator("#save")).not.toHaveClass(/is-dirty/);
  expect(await calendar.readFile("Calendar.md")).toBe("# Calendar\n\n## Multi-day\n\n### Trip\n#Start\n- 12.11.2026\n#End\n- 15.11.2026\n");
});
