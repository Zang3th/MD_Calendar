const { test, expect } = require("./fixtures");

const thursday = '.day[data-day="2026-11-12"]';

test("entries move between the backlog and the days, and saving writes both files", async ({ page, calendar }) => {
  await calendar.openApp({
    "Calendar.md": "# Calendar\n\n## November 2026\n\n### 12.11.2026\n- [ ] Day entry\n",
    "Backlog.md": "# Backlog\n\n## Home\n- [ ] Someday task #Home\n\n## Later\n"
  });
  await page.keyboard.press("b");
  const home = page.locator('.bl__list[data-group="0"]');
  await calendar.drag(home.locator(".ev"), page.locator(`${thursday} .ev`));
  await expect(page.locator(`${thursday} .ev__title`)).toHaveText(["Someday task", "Day entry"]);
  await expect(home.locator(".ev")).toHaveCount(0);

  // The drag steps like a real pointer, so that the empty target list receives several dragover events.
  await calendar.drag(page.locator(`${thursday} .ev`, { hasText: "Day entry" }), page.locator('.bl__list[data-group="1"]'));
  await expect(page.locator('.bl__list[data-group="1"] .ev__title')).toHaveText(["Day entry"]);
  await expect(page.locator(".bl__count").nth(1)).toHaveText("1");
  // A backlog entry has no check box, and Space leaves it open (docs/Domain.md#backlog).
  await expect(page.locator('.bl__list[data-group="1"] .ev__check')).toHaveCount(0);
  await page.locator('.bl__list[data-group="1"] .ev').hover();
  await page.keyboard.press("Space");

  await page.keyboard.press("Control+s");
  await expect(page.locator("#save")).not.toHaveClass(/is-dirty/);
  expect(await calendar.readFile("Calendar.md")).toBe("# Calendar\n\n## November 2026\n\n### 12.11.2026\n- [ ] Someday task #Home\n");
  // Dropped into a group, the untagged entry takes the group's tag (docs/Domain.md#backlog).
  expect(await calendar.readFile("Backlog.md")).toBe("# Backlog\n\n## Home\n\n## Later\n- [ ] Day entry #Later\n");

  await page.keyboard.press("Control+z");
  await expect(page.locator(`${thursday} .ev__title`)).toHaveText(["Someday task", "Day entry"]);
});

test("holidays show in the day header and tags take their color from Config.md", async ({ page, calendar }) => {
  await calendar.openApp({
    "Calendar.md": "# Calendar\n\n## November 2026\n\n### 12.11.2026\n- [ ] Tagged #Work\n- [ ] Unconfigured #Other\n\n" +
      "## Recurring\n\n### Gym\n#Start\n- 13.11.2026\n#Repeat\n- FREQ=WEEKLY;BYDAY=FR\n",
    "Holidays.md": "# Holidays\n\n## Holidays\n- 11.11.2026 St. Martin's Day\n\n## School vacations\n",
    "Config.md": "# Config\n\n## Tags\n- Work: #ff0000 briefcase\n",
    "Contacts.md": "# Contacts\n\n## Contacts\n\n### Lena\n#FirstName\n- Lena\n#Birthday\n- 14.11.1994\n"
  });
  const friday = '.day[data-day="2026-11-13"]';
  const gift = page.locator('.day[data-day="2026-11-14"] .badge--occasion .ui-icon');
  // At this width the name would be cut, so the holiday shows as a compact badge named by its label.
  await expect(page.locator('.day[data-day="2026-11-11"] .badge--holiday')).toHaveAttribute("aria-label", /St\. Martin's Day/);
  await expect(page.locator(`${thursday} .ev`).first()).toHaveClass(/has-tag/);
  await expect(page.locator(`${thursday} .ev`).first()).toHaveAttribute("style", "--h:0");
  await expect(page.locator(`${thursday} .ev`).nth(1)).not.toHaveClass(/has-tag/);

  // The options menu hides tag icons, never the series icon or the gift of a day badge; the choice survives a reload.
  await expect(page.locator(`${thursday} .ev__tag`)).toBeVisible();
  await expect(gift).toBeVisible();
  await page.locator("#optionsButton").click();
  await expect(page.locator("#optionsButton")).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("menuitemcheckbox", { name: "Hide icons" }).click();
  await expect(page.locator(`${thursday} .ev__tag`)).toBeHidden();
  await expect(gift).toBeVisible();
  await expect(page.locator(`${friday} .ev__repeat`)).toBeVisible();
  // The reload opens the folder again on its own.
  await page.reload();
  await expect(page.locator(`${thursday} .ev`).first()).toBeVisible();
  await expect(page.locator(`${thursday} .ev__tag`)).toBeHidden();
  await expect(page.locator("#hideIcons")).toHaveAttribute("aria-checked", "true");
});

test("an entry dropped on the backlog title becomes ungrouped without moving the panel, and is saved above the groups", async ({ page, calendar }) => {
  await calendar.openApp({
    "Calendar.md": "# Calendar\n\n## November 2026\n\n### 12.11.2026\n- [ ] Day entry\n",
    "Backlog.md": "# Backlog\n\n## Home\n- [ ] Someday task #Home\n"
  });
  await page.keyboard.press("b");
  const head = page.locator(".bl__head").first();
  await expect(head).toBeInViewport({ ratio: 1 });
  const source = /** @type {{x: number, y: number, width: number, height: number}} */ (await page.locator(`${thursday} .ev`).boundingBox());
  const title = /** @type {{x: number, y: number, width: number, height: number}} */ (await page.locator(".backlog__title").boundingBox());
  const before = await head.boundingBox();
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 - 20, source.y + source.height / 2, { steps: 4 });
  // Starting the drag moves nothing in the panel; the title shows the drop hint.
  await expect(page.locator("body")).toHaveClass(/is-sorting/);
  expect((await head.boundingBox())?.y).toBe(before?.y);
  await page.mouse.move(title.x + title.width / 2, title.y + title.height / 2, { steps: 12 });
  await page.mouse.move(title.x + title.width / 2 + 2, title.y + title.height / 2, { steps: 2 });
  await page.mouse.up();
  await expect(page.locator('.bl__list[data-group="-1"] .ev__title')).toHaveText(["Day entry"]);

  await page.keyboard.press("Control+s");
  await expect(page.locator("#save")).not.toHaveClass(/is-dirty/);
  expect(await calendar.readFile("Backlog.md")).toBe("# Backlog\n\n- [ ] Day entry\n\n## Home\n- [ ] Someday task #Home\n");
});

test("backlog groups are reordered by dragging their head, saved in that order and undone in one step", async ({ page, calendar }) => {
  await calendar.openApp({ "Calendar.md": "# Calendar\n", "Backlog.md": "# Backlog\n\n- [ ] Loose\n\n## Home\n- [ ] A #Home\n\n## Later\n- [ ] B #Later\n" });
  await page.keyboard.press("b");
  const heads = page.locator(".bl__head .bl__name");
  await expect(heads).toHaveText(["Home", "Later"]);
  await calendar.drag(page.locator(".bl__head", { hasText: "Later" }), page.locator(".bl__head", { hasText: "Home" }));
  await expect(heads).toHaveText(["Later", "Home"]);
  // The drag did not collapse a group, and the moved group still takes entries.
  await expect(page.locator(".bl__group.is-collapsed")).toHaveCount(0);
  await page.keyboard.press("Control+s");
  await expect(page.locator("#save")).not.toHaveClass(/is-dirty/);
  expect(await calendar.readFile("Backlog.md")).toBe("# Backlog\n\n- [ ] Loose\n\n## Later\n- [ ] B #Later\n\n## Home\n- [ ] A #Home\n");
  await page.keyboard.press("Control+z");
  await expect(heads).toHaveText(["Home", "Later"]);
  // The rebuilt lists keep their drag and drop.
  await calendar.drag(page.locator(".bl__list .ev", { hasText: "A" }), page.locator(".bl__list .ev", { hasText: "B" }), 0.8);
  await expect(page.locator('.bl__list[data-group="1"] .ev__title')).toHaveText(["B", "A"]);
});

test("a tagged entry goes to its tag's group, keys paste at the pointer and a click on free space adds an entry to the group there", async ({ page, calendar }) => {
  await calendar.openApp({
    "Calendar.md": "# Calendar\n\n## November 2026\n\n### 12.11.2026\n- [ ] Report #Work\n- [ ] Plain\n",
    "Backlog.md": "# Backlog\n\n## Home\n- [ ] Dishes #Home\n",
    "Config.md": "# Config\n\n## Tags\n- Home: #458588 home\n- Work: #d79921 briefcase\n"
  });
  await page.keyboard.press("b");
  // Dropped onto the panel title (ungrouped), the tagged entry still goes to its tag's group, created for it.
  await calendar.drag(page.locator(`${thursday} .ev`, { hasText: "Report" }), page.locator(".backlog__title"));
  await expect(page.locator(".bl__head .bl__name")).toHaveText(["Home", "Work"]);
  await expect(page.locator('.bl__list[data-group="1"] .ev__title')).toHaveText(["Report"]);

  // Cut on a day, paste with the pointer over the Home group: the untagged entry lands there and takes its tag.
  await page.locator(`${thursday} .ev`, { hasText: "Plain" }).hover();
  await page.keyboard.press("Control+x");
  await page.locator('.bl__list[data-group="0"] .ev').hover();
  await page.keyboard.press("Control+v");
  await expect(page.locator('.bl__list[data-group="0"] .ev__title')).toHaveText(["Plain", "Dishes"]);
  await expect(page.locator(`${thursday} .ev`)).toHaveCount(0);

  // A click on free space below a group opens the dialog for a new entry there, with the group's tag preset.
  const work = /** @type {{x: number, y: number, width: number, height: number}} */ (await page.locator('.bl__list[data-group="1"]').boundingBox());
  await page.mouse.click(work.x + 30, work.y + work.height + 6);
  await expect(page.locator("#dialogTag")).toHaveText("Work");
  await page.keyboard.type("Slides");
  await page.keyboard.press("Enter");
  await expect(page.locator('.bl__list[data-group="1"] .ev__title')).toHaveText(["Report", "Slides"]);

  await page.keyboard.press("Control+s");
  await expect(page.locator("#save")).not.toHaveClass(/is-dirty/);
  expect(await calendar.readFile("Backlog.md")).toBe("# Backlog\n\n## Home\n- [ ] Plain #Home\n- [ ] Dishes #Home\n\n## Work\n- [ ] Report #Work\n- [ ] Slides #Work\n");
  // Tags are only read: Config.md stays as it was.
  expect(await calendar.readFile("Config.md")).toBe("# Config\n\n## Tags\n- Home: #458588 home\n- Work: #d79921 briefcase\n");
});

test("the holiday overview shows vacations, holidays and school vacations as tabs", async ({ page, calendar }) => {
  await calendar.openApp({
    "Calendar.md": "# Calendar\n\n## November 2026\n\n### 24.11.2026\n- [ ] Day trip #Vacation\n\n## Multi-day\n\n### Trip #Vacation\n#Start\n- 23.11.2026\n#End\n- 25.11.2026\n",
    "Holidays.md": "# Holidays\n\n## Holidays\n- 25.12.2026 Christmas Day\n\n## School vacations\n- 23.12.2026 - 06.01.2027 Christmas vacation\n",
    "Config.md": "# Config\n\n## Tags\n- Vacation: #00ff00 vacation\n"
  });
  await page.locator("#holidaysButton").click();
  await expect(page.getByRole("tab")).toHaveText(["Vacation", "Holidays", "School vacations"]);
  await expect(page.getByRole("tab", { name: "Vacation", exact: true })).toHaveAttribute("aria-selected", "true");
  // A vacation within another one is listed below it, indented.
  await expect(page.locator("#holidaysContent .hp__name")).toHaveText(["Trip", "Day trip"]);
  await expect(page.locator("#holidaysContent .hp__date")).toHaveText(["23.11.26 – 25.11.26", "24.11.26"]);
  await expect(page.locator("#holidaysContent .hp__row").nth(1)).toHaveClass(/hp__row--sub/);
  await page.getByRole("tab", { name: "Holidays" }).click();
  await expect(page.locator("#holidaysContent .hp__name")).toHaveText(["Christmas Day"]);
  await expect(page.locator("#holidaysContent .hp__date")).toHaveText(["25.12.26"]);
  await page.getByRole("tab", { name: "School vacations" }).click();
  await expect(page.locator("#holidaysContent .hp__name")).toHaveText(["Christmas vacation"]);
  await expect(page.locator("#holidaysContent .hp__date")).toHaveText(["23.12.26 – 06.01.27"]);
  await page.locator("[data-year='1']").click();
  await expect(page.locator("#holidaysContent .hp__name")).toHaveText(["Christmas vacation"]);
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
