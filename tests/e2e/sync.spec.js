const { test, expect } = require("./fixtures");

// The sync control in the header (docs/ui/Shell.md#sync-control); placeholder data only.

/** MD_Calendar.json with a synchronization set up. @param {object} [sync] */
function state(sync = {}) {
  return JSON.stringify({
    format: 1, devices: {}, files: { "Calendar.md": { hash: "sha256-same" } },
    sync: { calendarId: "placeholder@group.calendar.google.com", last: { at: "2026-11-12T09:00:00Z", by: "d1", calendarHash: "sha256-same", toGoogle: 0, toCalendar: 0, skipped: 0, failed: 0 }, items: {}, journal: null, ...sync }
  });
}

test("the sync control sits left of the save control and gets its dot once the calendar is saved after the last sync", async ({ page, calendar }) => {
  await calendar.openApp({ "MD_Calendar.json": state(), "Calendar.md": "# Calendar\n\n## November 2026\n\n### 12.11.2026\n- [ ] First\n" });
  const sync = page.locator("#syncButton");
  await expect(sync).toBeVisible();
  expect(await page.locator(".edit > button").evaluateAll(buttons => buttons.map(button => button.id))).toEqual(["new", "undo", "redo", "syncButton", "save"]);
  await expect(sync).toHaveAttribute("aria-label", "Sync with Google");
  await expect(sync).not.toHaveClass(/is-changed/);

  await page.locator('.day[data-day="2026-11-12"] .ev__check').first().click();
  await page.keyboard.press("Control+s");
  await expect(sync).toHaveClass(/is-changed/);
  await expect(sync).toHaveAttribute("aria-label", "Sync with Google (local changes since last sync)");
  await expect(sync.locator(".sync__dot")).toHaveCSS("opacity", "1");
});

test("an interrupted synchronization shows the warning state on the sync control", async ({ page, calendar }) => {
  await calendar.openApp({ "MD_Calendar.json": state({ journal: { startedAt: "2026-11-12T09:00:00Z", by: "d1", syncToken: "", operations: [], same: [], forgotten: [], open: [], skipped: 0 } }) });
  const sync = page.locator("#syncButton");
  await expect(sync).toHaveClass(/is-interrupted/);
  await expect(sync).toHaveAttribute("aria-label", "Sync with Google (interrupted, needs completing)");
});

const { generateKeyPairSync } = require("node:crypto");

/** A service account key with a fresh RSA key; placeholder names only. */
function serviceKey() {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
  return JSON.stringify({ type: "service_account", client_email: "sync@placeholder.iam.gserviceaccount.com", private_key: privateKey });
}

const calendarId = "placeholder@group.calendar.google.com";
const events = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

/**
 * A Google calendar behind page.route: the token endpoint and the events of one calendar.
 * @param {import("@playwright/test").Page} page @param {any[]} initial
 */
async function fakeGoogle(page, initial) {
  const stored = new Map(initial.map(event => [event.id, event]));
  const writes = /** @type {string[]} */ ([]);
  let version = 1;
  await page.route("https://oauth2.googleapis.com/token", route => route.fulfill({ json: { access_token: "placeholder-token", expires_in: 3600 } }));
  await page.route(`${events}**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const id = decodeURIComponent(url.pathname.split("/events/")[1] || "");
    if (request.method() === "GET" && !id) {
      if (url.searchParams.get("maxResults") === "1") return route.fulfill({ json: { accessRole: "owner", timeZone: "Europe/Berlin", items: [] } });
      return route.fulfill({ json: { timeZone: "Europe/Berlin", items: [...stored.values()], nextSyncToken: "token-1" } });
    }
    if (request.method() === "GET") return stored.has(id) ? route.fulfill({ json: stored.get(id) }) : route.fulfill({ status: 404, json: { error: { code: 404 } } });
    writes.push(`${request.method()} ${id || JSON.parse(request.postData() || "{}").id}`);
    if (request.method() === "POST") {
      const body = JSON.parse(request.postData() || "{}");
      if (stored.has(body.id)) return route.fulfill({ status: 409, json: { error: { code: 409 } } });
      const created = { ...body, etag: `"${version++}"`, status: "confirmed" };
      stored.set(body.id, created);
      return route.fulfill({ json: created });
    }
    if (request.method() === "PATCH") {
      const updated = { ...stored.get(id), ...JSON.parse(request.postData() || "{}"), etag: `"${version++}"` };
      stored.set(id, updated);
      return route.fulfill({ json: updated });
    }
    stored.delete(id);
    return route.fulfill({ status: 204, body: "" });
  });
  return { stored, writes };
}

test("the setup checks the key and the calendar step by step and stores both", async ({ page, calendar }) => {
  await fakeGoogle(page, []);
  await calendar.openApp();
  await page.locator("#syncButton").click();
  const dialog = page.locator("#syncDialog");
  await expect(dialog).toHaveAttribute("data-phase", "setup");
  const connect = dialog.getByRole("button", { name: "Connect" });
  await expect(connect).toBeDisabled();
  const key = serviceKey();
  await page.locator("#syncKeyInput").setInputFiles({ name: "placeholder-key.json", mimeType: "application/json", buffer: Buffer.from(key) });
  await page.locator("#syncCalendarId").fill(calendarId);
  await connect.click();
  await expect(dialog.locator(".sd__step.is-done")).toHaveCount(3, { timeout: 10_000 });
  await expect(dialog).toHaveAttribute("data-phase", "overview", { timeout: 10_000 });
  await expect(dialog.locator(".sd__facts")).toContainText("Never");
  expect(await calendar.readFile("MD_Calendar.key.json")).toBe(key);
  expect(JSON.parse(await calendar.readFile("MD_Calendar.json") || "{}").sync.calendarId).toBe(calendarId);
});

test("a check shows both sides in the merge view; applying copies each way, saves and records the synchronization", async ({ page, calendar }) => {
  const google = await fakeGoogle(page, [{
    id: "phon0001", etag: "\"7\"", status: "confirmed", summary: "From the phone",
    start: { dateTime: "2026-11-24T08:00:00+01:00" }, end: { dateTime: "2026-11-24T08:30:00+01:00" }
  }]);
  await calendar.openApp({
    "MD_Calendar.key.json": serviceKey(),
    "MD_Calendar.json": JSON.stringify({ format: 1, devices: {}, files: {}, sync: { calendarId, items: {}, journal: null } }),
    "Calendar.md": "# Calendar\n\n## November 2026\n\n### 24.11.2026\n- [ ] 09:00 Dentist\n"
  });
  await page.locator("#syncButton").click();
  const dialog = page.locator("#syncDialog");
  await dialog.getByRole("button", { name: "Check sync status" }).click();
  await expect(dialog).toHaveAttribute("data-phase", "review", { timeout: 10_000 });
  const rows = dialog.locator(".sd__row");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("From the phone");
  await expect(rows.nth(0).getByRole("button", { name: "Copy to the calendar" })).toHaveAttribute("aria-pressed", "true");
  await expect(rows.nth(1).getByRole("button", { name: "Copy to Google" })).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.locator(".sd__sum")).toContainText("2 changes selected");
  await dialog.getByRole("button", { name: "Apply 2 changes" }).click();
  await expect(dialog).toHaveAttribute("data-phase", "done", { timeout: 10_000 });
  await expect(dialog).toContainText("Sync complete");
  await expect(dialog).toContainText("2 synchronized · 0 skipped");

  const text = await calendar.readFile("Calendar.md") || "";
  expect(text).toMatch(/- \[ \] 08:00 - 08:30 From the phone \{sync=phon0001\}/);
  const dentist = /- \[ \] 09:00 Dentist \{sync=([0-9a-v]{8})\}/.exec(text);
  expect(dentist).not.toBeNull();
  expect(google.writes).toEqual([`POST ${dentist?.[1]}`]);
  expect(google.stored.get(dentist?.[1]).summary).toBe("Dentist");
  const state = JSON.parse(await calendar.readFile("MD_Calendar.json") || "{}");
  expect([state.sync.syncToken, state.sync.journal, state.sync.last.toGoogle, state.sync.last.toCalendar]).toEqual(["token-1", null, 1, 1]);
  expect(Object.keys(state.sync.items).sort()).toEqual([dentist?.[1], "phon0001"].sort());

  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("#undo")).toHaveAttribute("aria-label", "Undo “Sync with Google (2 changes)” (Ctrl+Z)");
  await expect(page.locator("#syncButton")).not.toHaveClass(/is-changed/);
});

test("an interrupted synchronization is completed from its journal without creating anything twice", async ({ page, calendar }) => {
  const google = await fakeGoogle(page, [{ id: "dent0001", etag: "\"3\"", status: "confirmed", summary: "Dentist", start: { dateTime: "2026-11-24T09:00:00" }, end: { dateTime: "2026-11-24T09:00:00" } }]);
  const body = { summary: "Dentist", location: "", description: "", colorId: null, extendedProperties: { private: { mdcTag: "" } }, start: { dateTime: "2026-11-24T09:00:00", timeZone: "Europe/Berlin" }, end: { dateTime: "2026-11-24T09:00:00", timeZone: "Europe/Berlin" } };
  const journal = {
    startedAt: "2026-11-12T09:00:00Z", by: "d1", syncToken: "token-2", skipped: 0, open: [], forgotten: [], same: [],
    operations: [{ key: "new:0", id: "dent0001", kind: "entry", choice: "to-google", title: "Dentist", state: "pending", google: { action: "insert", body, etag: "" },
      local: { action: "link", ref: { key: "2026-11-24", index: 0 }, match: "" }, record: { kind: "entry", etag: "", calendar: {} } }]
  };
  await calendar.openApp({
    "MD_Calendar.key.json": serviceKey(),
    "MD_Calendar.json": JSON.stringify({ format: 1, devices: {}, files: {}, sync: { calendarId, items: {}, journal } }),
    "Calendar.md": "# Calendar\n\n## November 2026\n\n### 24.11.2026\n- [ ] 09:00 Dentist\n"
  });
  await expect(page.locator("#syncButton")).toHaveClass(/is-interrupted/);
  await page.locator("#syncButton").click();
  const dialog = page.locator("#syncDialog");
  await expect(dialog).toContainText("The last sync was interrupted after 0 of 1 changes.");
  await dialog.getByRole("button", { name: "Complete sync" }).click();
  await expect(dialog).toHaveAttribute("data-phase", "done", { timeout: 10_000 });
  // The event existed already: it is brought to the target state, not created again.
  expect(google.writes).toEqual(["POST dent0001", "PATCH dent0001"]);
  const state = JSON.parse(await calendar.readFile("MD_Calendar.json") || "{}");
  expect([state.sync.journal, state.sync.syncToken]).toEqual([null, "token-2"]);
  await expect(page.locator("#syncButton")).not.toHaveClass(/is-interrupted/);
  // Chrome logs the intended 409 of the repeated create as a failed resource.
  const expected = calendar.errors.filter(error => error.includes("status of 409"));
  expect(expected).toHaveLength(1);
  calendar.errors.splice(0, calendar.errors.length, ...calendar.errors.filter(error => !expected.includes(error)));
});
