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

test("days off show a day badge instead of a tile; the holiday overview lists vacations and days off, holidays and school vacations as tabs", async ({ page, calendar }) => {
  await calendar.openApp({
    "Calendar.md": "# Calendar\n\n## November 2026\n\n### 13.11.2026\n- [ ] Overtime #DayOff\n- [ ] Report\n- [ ] Slides\n\n### 24.11.2026\n- [ ] Day trip #Vacation\n\n" +
      "## Multi-day\n\n### Comp days #DayOff\n#Start\n- 09.11.2026\n#End\n- 10.11.2026\n\n### Trip #Vacation\n#Start\n- 23.11.2026\n#End\n- 25.11.2026\n",
    "Holidays.md": "# Holidays\n\n## Holidays\n- 25.12.2026 Christmas Day\n\n## School vacations\n- 13.11.2026 - 13.11.2026 Bridge day\n- 23.12.2026 - 06.01.2027 Christmas vacation\n",
    "Config.md": "# Config\n\n## Tags\n- Vacation: #00ff00 vacation\n- DayOff: #7be0c7 clock\n"
  });
  // A one-day day off shows no tile, only a badge with its icon and “Day off”; a multi-day one keeps its bar only.
  await page.setViewportSize({ width: 2400, height: 900 });
  const friday = '.day[data-day="2026-11-13"]';
  await expect(page.locator(`${friday} .ev:visible .ev__title`)).toHaveText(["Report", "Slides"]);
  await expect(page.locator(`${friday} .day__badges .badge--dayoff`)).toHaveText("Day off");
  await expect(page.locator(`${friday} .day__badges .badge--dayoff .ui-icon`)).toBeVisible();
  await expect(page.locator('.day[data-day="2026-11-09"] .day__badges .badge')).toHaveCount(0);
  // The hidden day off still counts for positions: a drop before “Report” keeps it first.
  await calendar.drag(page.locator(`${friday} .ev`, { hasText: "Slides" }), page.locator(`${friday} .ev`, { hasText: "Report" }), 0.2);
  await page.keyboard.press("Control+s");
  await expect(page.locator("#save")).not.toHaveClass(/is-dirty/);
  expect(await calendar.readFile("Calendar.md")).toContain("### 13.11.2026\n- [ ] Overtime #DayOff\n- [ ] Slides\n- [ ] Report\n");
  // The month shows the icon only; a click opens the days off of the holiday overview, a second one closes it.
  await page.keyboard.press("m");
  const badge = page.locator('.mcell[data-day="2026-11-13"] .badge--dayoff');
  await expect(badge).toHaveText("");
  await badge.click();
  await expect(page.locator("#holidaysPanel")).toBeVisible();
  await badge.click();
  await expect(page.locator("#holidaysPanel")).toBeHidden();
  await badge.click();
  await expect(page.locator("#holidaysYear")).toHaveText("2026");
  // Only the day off of that day lights up.
  const lit = (/** @type {import("@playwright/test").Locator} */ locator) => locator.evaluate(element => element.getAnimations().length > 0);
  expect(await lit(page.locator("#holidaysContent .hp__row", { hasText: "Overtime" }))).toBe(true);
  expect(await lit(page.locator("#holidaysContent .hp__row", { hasText: "Comp days" }))).toBe(false);

  await expect(page.getByRole("tab")).toHaveText(["Vacation", "Holidays", "School vacations"]);
  await expect(page.getByRole("tab", { name: "Vacation", exact: true })).toHaveAttribute("aria-selected", "true");
  // Vacations and days off share one list by date, without icons; the color of the date tells them apart. A vacation
  // within another one is listed below it, indented.
  await expect(page.locator("#holidaysContent .hp__name")).toHaveText(["Comp days", "Overtime", "Trip", "Day trip"]);
  await expect(page.locator("#holidaysContent .hp__date")).toHaveText(["09.11.26 – 10.11.26", "13.11.26Fri", "23.11.26 – 25.11.26", "24.11.26Tue"]);
  // The weekday of a single day starts where the second date of a range starts.
  // Left edge of the weekday of a single day, or of the second date of a range.
  const second = (/** @type {string} */ text) => page.locator("#holidaysContent .hp__row", { hasText: text }).evaluate(row => {
    const date = /** @type {HTMLElement} */ (row.querySelector(".hp__date"));
    const weekday = date.querySelector(".hp__weekday");
    if (weekday) return weekday.getBoundingClientRect().left;
    const node = /** @type {Text} */ (date.firstChild);
    const range = document.createRange();
    range.setStart(node, node.data.indexOf("–") + 2);
    range.setEnd(node, node.data.indexOf("–") + 3);
    return range.getBoundingClientRect().left;
  });
  expect(Math.abs(await second("Overtime") - await second("Comp days"))).toBeLessThan(1);
  await expect(page.locator("#holidaysContent .hp__row .ui-icon")).toHaveCount(0);
  await expect(page.locator("#holidaysContent .hp__row:not(.hp__row--sub) > :first-child")).toHaveClass(Array(3).fill(/hp__date/));
  // A vacation takes the color of its tag from Config.md.
  await expect(page.locator("#holidaysContent .hp__row--vacation").first()).toHaveClass(/has-tag/);
  await expect(page.locator("#holidaysContent .hp__row").nth(3)).toHaveClass(/hp__row--sub/);
  await page.getByRole("tab", { name: "Holidays" }).click();
  await expect(page.locator("#holidaysContent .hp__name")).toHaveText(["Christmas Day"]);
  await expect(page.locator("#holidaysContent .hp__date")).toHaveText(["25.12.26"]);
  // A day-off badge opens the overview on the vacations, also when another tab was open last.
  await badge.click();
  await expect(page.locator("#holidaysPanel")).toBeHidden();
  await badge.click();
  await expect(page.getByRole("tab", { name: "Vacation", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "School vacations" }).click();
  // A one-day school vacation shows its weekday behind the date, like a single vacation day.
  await expect(page.locator("#holidaysContent .hp__name")).toHaveText(["Bridge day", "Christmas vacation"]);
  await expect(page.locator("#holidaysContent .hp__date")).toHaveText(["13.11.26Fri", "23.12.26 – 06.01.27"]);
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
