const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { webcrypto } = require("node:crypto");
const { loadClassic } = require("@zang3th/md-libs/harness/testing");

// The Google client against a fake fetch: token signing, paging and sync tokens, idempotent writes, waiting and errors.
const { google } = loadClassic({
  esbuild, root: path.join(__dirname, "../.."), namespace: "MDCalendar", files: ["io/google.js"],
  globals: { btoa, atob, TextEncoder, URLSearchParams, setTimeout, clearTimeout, crypto: webcrypto }
}).MDCalendar;

const calendarId = "placeholder@group.calendar.google.com";
const events = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

/** A service account key with a fresh RSA key pair. */
async function serviceKey() {
  const pair = await webcrypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const pkcs8 = Buffer.from(await webcrypto.subtle.exportKey("pkcs8", pair.privateKey)).toString("base64");
  const pem = `-----BEGIN PRIVATE KEY-----\n${(pkcs8.match(/.{1,64}/g) || []).join("\n")}\n-----END PRIVATE KEY-----\n`;
  const text = JSON.stringify({ type: "service_account", client_email: "sync@placeholder.iam.gserviceaccount.com", private_key: pem });
  return { text, publicKey: pair.publicKey };
}

/**
 * A fake fetch that answers with the queued responses for each URL prefix and records every request.
 * @param {Array<[string, (request: {url: string, init: any}) => Response]>} routes
 */
function fakeFetch(routes) {
  /** @type {Array<{url: string, init: any}>} */
  const requests = [];
  const fetch = async (/** @type {string} */ url, /** @type {any} */ init) => {
    const request = { url, init };
    requests.push(request);
    const route = routes.find(([prefix]) => url.startsWith(prefix));
    if (!route) throw new TypeError("Failed to fetch");
    return route[1](request);
  };
  return { fetch, requests };
}

/** Compares a value from the module's realm by its JSON form. @param {unknown} actual @param {unknown} expected */
const same = (actual, expected) => assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected);
const json = (/** @type {unknown} */ value, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json", ...headers } });
const tokenRoute = /** @type {[string, () => Response]} */ (["https://oauth2.googleapis.com/token", () => json({ access_token: "secret-token", expires_in: 3600 })]);

/** @param {any} fetch @param {object} [options] */
async function clientWith(fetch, options = {}) {
  const { text, publicKey } = await serviceKey();
  return { client: google.client({ key: google.readKey(text), calendarId, fetch, crypto: webcrypto, sleep: async () => {}, now: () => 1_800_000_000_000, ...options }), publicKey };
}

/** Runs `action` and returns the error it rejects with. @param {() => Promise<unknown>} action */
async function failure(action) {
  try {
    await action();
  } catch (error) {
    return /** @type {any} */ (error);
  }
  assert.fail("expected a failure");
}

test("a key that is not a service account key is refused with MDC-401", () => {
  for (const text of ["{ broken", "{}", JSON.stringify({ type: "authorized_user", client_email: "a", private_key: "b" })]) {
    assert.throws(() => google.readKey(text), (/** @type {any} */ error) => error.code === "MDC-401");
  }
});

test("the token request is a JWT signed with the key; the token is kept until shortly before it expires", async () => {
  let time = 1_800_000_000_000;
  const { fetch, requests } = fakeFetch([tokenRoute, [events, () => json({ accessRole: "owner", timeZone: "Europe/Berlin", items: [] })]]);
  const { client, publicKey } = await clientWith(fetch, { now: () => time });
  same(await client.probe(), { timeZone: "Europe/Berlin", accessRole: "owner" });
  await client.probe();
  const grants = requests.filter(request => request.url.startsWith("https://oauth2"));
  assert.equal(grants.length, 1);
  const form = new URLSearchParams(grants[0].init.body);
  assert.equal(form.get("grant_type"), "urn:ietf:params:oauth:grant-type:jwt-bearer");
  const [header, claims, signature] = String(form.get("assertion")).split(".");
  const decode = (/** @type {string} */ part) => JSON.parse(Buffer.from(part, "base64url").toString());
  assert.deepEqual(decode(header), { alg: "RS256", typ: "JWT" });
  assert.deepEqual(decode(claims), {
    iss: "sync@placeholder.iam.gserviceaccount.com", scope: "https://www.googleapis.com/auth/calendar.events",
    aud: "https://oauth2.googleapis.com/token", iat: 1_800_000_000, exp: 1_800_003_600
  });
  assert.ok(await webcrypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, Buffer.from(signature, "base64url"), new TextEncoder().encode(`${header}.${claims}`)));
  assert.equal(requests.find(request => request.url.startsWith(events))?.init.headers.Authorization, "Bearer secret-token");
  time += 3541_000;
  await client.probe();
  assert.equal(requests.filter(request => request.url.startsWith("https://oauth2")).length, 2);
});

test("the probe names a missing calendar, missing write access, a refused key and a lost connection", async () => {
  const cases = /** @type {Array<[Array<[string, () => Response]>, string]>} */ ([
    [[tokenRoute, [events, () => json({ error: { code: 404, message: "Not Found" } }, 404)]], "MDC-403"],
    [[tokenRoute, [events, () => json({ accessRole: "reader", items: [] })]], "MDC-404"],
    [[["https://oauth2", () => json({ error: "invalid_grant", error_description: "Invalid JWT Signature." }, 400)]], "MDC-402"],
    [[tokenRoute], "MDC-405"]
  ]);
  for (const [routes, code] of cases) {
    const { client } = await clientWith(fakeFetch(routes).fetch);
    const error = await failure(() => client.probe());
    assert.equal(error.code, code);
    assert.doesNotMatch(`${error.message} ${error.detail}`, /secret-token|PRIVATE KEY/);
  }
});

test("changes page through the calendar, return the next sync token and report an expired token", async () => {
  const { fetch, requests } = fakeFetch([tokenRoute, [events, ({ url }) => {
    const query = new URL(url).searchParams;
    if (query.get("syncToken") === "old") return json({ error: { code: 410, message: "Gone" } }, 410);
    return query.get("pageToken")
      ? json({ items: [{ id: "b" }], nextSyncToken: "next", timeZone: "Europe/Berlin" })
      : json({ items: [{ id: "a" }], nextPageToken: "page-2", timeZone: "Europe/Berlin" });
  }]]);
  const { client } = await clientWith(fetch);
  /** @type {number[]} */
  const counts = [];
  const result = await client.changes({ onPage: (/** @type {number} */ count) => counts.push(count) });
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { expired: false, events: [{ id: "a" }, { id: "b" }], syncToken: "next", timeZone: "Europe/Berlin" });
  assert.deepEqual(counts, [1, 2]);
  assert.equal(new URL(requests[1].url).searchParams.get("singleEvents"), "false");
  same(await client.changes({ syncToken: "old" }), { expired: true });
});

test("writes are idempotent: an existing ID, a changed ETag and a missing event are told apart", async () => {
  const { fetch, requests } = fakeFetch([tokenRoute, [events, ({ url, init }) => {
    if (init.method === "POST") return json({ error: { code: 409, message: "The requested identifier already exists." } }, 409);
    if (url.endsWith("/changed")) return json({ error: { code: 412, message: "Precondition Failed" } }, 412);
    if (url.endsWith("/missing")) return json({ error: { code: 404, message: "Not Found" } }, 404);
    if (init.method === "DELETE") return new Response(null, { status: 410 });
    return json({ id: "ab12cd34", etag: "\"2\"" });
  }]]);
  const { client } = await clientWith(fetch);
  same(await client.insert({ id: "ab12cd34", summary: "Placeholder" }), { status: "exists" });
  assert.equal(JSON.parse(requests[1].init.body).id, "ab12cd34");
  same(await client.patch("changed", { summary: "x" }, "\"1\""), { status: "changed" });
  assert.equal(requests[2].init.headers["If-Match"], "\"1\"");
  same(await client.patch("missing", { summary: "x" }, "\"1\""), { status: "gone" });
  assert.deepEqual(JSON.parse(JSON.stringify(await client.patch("ab12cd34", { summary: "x" }, "\"1\""))), { status: "updated", event: { id: "ab12cd34", etag: "\"2\"" } });
  same(await client.remove("ab12cd34"), { status: "deleted" });
});

test("the client waits as Google asks, fetches an expired token again and stops on a real refusal", async () => {
  let calls = 0;
  const { fetch, requests } = fakeFetch([tokenRoute, [events, ({ init }) => {
    calls += 1;
    if (calls === 1) return json({ error: { code: 429 } }, 429, { "Retry-After": "3" });
    if (calls === 2) return json({ error: { code: 403, errors: [{ reason: "rateLimitExceeded" }] } }, 403);
    if (calls === 3) return json({ error: { code: 401 } }, 401);
    if (init.method === "DELETE") return json({ error: { code: 403, errors: [{ reason: "forbidden" }], message: "Forbidden" } }, 403);
    return json({ accessRole: "writer", timeZone: "Europe/Berlin", items: [] });
  }]]);
  /** @type {number[]} */
  const waits = [];
  /** @type {number[]} */
  const slept = [];
  const { client } = await clientWith(fetch, { onWait: (/** @type {number} */ seconds) => waits.push(seconds), sleep: async (/** @type {number} */ ms) => { slept.push(ms); } });
  assert.equal((await client.probe()).accessRole, "writer");
  assert.deepEqual([waits, slept], [[3, 2], [3000, 2000]]);
  assert.equal(requests.filter(request => request.url.startsWith("https://oauth2")).length, 2);
  assert.equal((await failure(() => client.remove("ab12cd34"))).code, "MDC-404");
});

test("new sync IDs are 8 characters of base32hex", () => {
  const ids = Array.from({ length: 50 }, () => google.newId(webcrypto));
  assert.ok(ids.every(id => /^[0-9a-v]{8}$/.test(id)));
  assert.equal(new Set(ids).size, 50);
});
