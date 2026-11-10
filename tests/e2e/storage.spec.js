const { test, expect } = require("./fixtures");

test("the local folder adapter reads, writes with the version check and is remembered", async ({ page, calendar }) => {
  await page.goto(`${calendar.origin}/MD_Calendar.html`);
  await expect(page.locator("body")).toHaveAttribute("data-startup-state", "ready");

  const result = await page.evaluate(async () => {
    const { storage } = /** @type {any} */ (window).MDCalendar;
    const folder = await storage.pickFolder();
    const external = await (await navigator.storage.getDirectory()).getDirectoryHandle("Kalender");
    /** @param {string} name @param {string} text */
    async function writeExternally(name, text) {
      const writable = await (await external.getFileHandle(name, { create: true })).createWritable();
      await writable.write(text);
      await writable.close();
    }
    /** @param {Promise<unknown>} operation */
    async function failure(operation) {
      try { await operation; return null; } catch (error) {
        const conflict = /** @type {any} */ (error);
        return { name: conflict.name, file: conflict.file, text: conflict.text };
      }
    }

    const missing = await folder.read("Calendar.md");
    const stamp = await folder.write("Calendar.md", "# Calendar\n", null);
    const read = await folder.read("Calendar.md");
    const stat = await folder.stat("Calendar.md");
    await writeExternally("notes.txt", "not a calendar file");
    const files = await folder.listFiles();

    await writeExternally("Calendar.md", "# Calendar\n\nchanged elsewhere\n");
    const conflict = await failure(folder.write("Calendar.md", "# Calendar\nmine\n", stamp));
    const duplicate = await failure(folder.write("Calendar.md", "# Calendar\n", null));
    const afterConflicts = (await folder.read("Calendar.md"))?.text;
    return { missing, stamp, read, stat, files, conflict, duplicate, afterConflicts };
  });

  expect(result.missing).toBeNull();
  expect(result.read).toEqual({ text: "# Calendar\n", stamp: result.stamp });
  expect(result.stat).toBe(result.stamp);
  expect(result.files).toEqual(["Calendar.md"]);
  const current = { name: "StorageConflictError", file: "Calendar.md", text: "# Calendar\n\nchanged elsewhere\n" };
  expect(result.conflict).toEqual(current);
  expect(result.duplicate).toEqual(current);
  expect(result.afterConflicts).toBe(current.text);

  // The remembered folder still has its permission and opens again without the start card.
  await page.reload();
  await expect(page.locator("#week")).toBeVisible();
  await expect(page.locator("#start")).toBeHidden();
  await expect(page.locator(".notification", { hasText: "Kalender" })).toBeVisible();
});
