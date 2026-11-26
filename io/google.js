window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Client for the dedicated Google calendar: a service account key signs a token request (JWT, RS256 through WebCrypto),
// the token reads and writes the calendar's events (docs/Architecture.md#synchronization-with-google). Tokens live only
// in memory; neither the key nor a token ever appears in an error.
(function (app) {
  const tokenUrl = "https://oauth2.googleapis.com/token";
  const apiUrl = "https://www.googleapis.com/calendar/v3/calendars/";
  const scope = "https://www.googleapis.com/auth/calendar.events";
  /** A token is fetched again this long before it expires. */
  const tokenMargin = 60;
  /** Attempts of one request while Google asks to wait or fails on its side. */
  const attempts = 6;
  const rateLimitReasons = ["rateLimitExceeded", "userRateLimitExceeded", "quotaExceeded"];

  /** An error of the synchronization with its code (docs/Architecture.md#errors). */
  class GoogleError extends Error {
    /** @param {MDCGoogleErrorCode} code @param {string} message @param {string} [detail] */
    constructor(code, message, detail = "") {
      super(message);
      this.name = "GoogleError";
      this.code = code;
      this.detail = detail;
    }
  }

  /**
   * Reads a service account key as Google Cloud delivers it.
   * @param {string} text @returns {MDCGoogleKey}
   */
  function readKey(text) {
    /** @type {any} */
    let value = null;
    try { value = JSON.parse(text); } catch { /* reported below */ }
    if (!value || value.type !== "service_account" || typeof value.client_email !== "string" || typeof value.private_key !== "string" || !value.private_key.includes("PRIVATE KEY")) {
      throw new GoogleError("MDC-401", "This is not a service account key", "Expected the JSON key of a Google service account.");
    }
    return { clientEmail: value.client_email, privateKey: value.private_key };
  }

  /** @param {Uint8Array} bytes */
  function base64Url(bytes) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  /** @param {unknown} value */
  const jsonPart = value => base64Url(new TextEncoder().encode(JSON.stringify(value)));

  /** @param {string} pem @returns {Uint8Array<ArrayBuffer>} */
  function pemBytes(pem) {
    const body = pem.replace(/-----(?:BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "");
    return Uint8Array.from(atob(body), character => character.charCodeAt(0));
  }

  /**
   * The signed token request of a service account (RFC 7523).
   * @param {MDCGoogleKey} key @param {number} now seconds since the epoch @param {Crypto} crypto
   */
  async function assertion(key, now, crypto) {
    /** @type {CryptoKey} */
    let signer;
    try {
      signer = await crypto.subtle.importKey("pkcs8", pemBytes(key.privateKey), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
    } catch {
      throw new GoogleError("MDC-401", "The key cannot be read", "The private key of the service account key is damaged.");
    }
    const unsigned = `${jsonPart({ alg: "RS256", typ: "JWT" })}.${jsonPart({ iss: key.clientEmail, scope, aud: tokenUrl, iat: now, exp: now + 3600 })}`;
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", signer, new TextEncoder().encode(unsigned));
    return `${unsigned}.${base64Url(new Uint8Array(signature))}`;
  }

  /** @param {Response} response @returns {Promise<any>} */
  async function body(response) {
    try { return await response.json(); } catch { return null; }
  }

  /** Google's own reason and message of a failed request, without anything secret. @param {any} payload */
  function reason(payload) {
    const error = payload?.error;
    if (typeof error === "string") return { reason: error, message: String(payload.error_description || error) };
    return { reason: String(error?.errors?.[0]?.reason || error?.status || ""), message: String(error?.message || "") };
  }

  /**
   * A client for one calendar. `fetch`, `crypto`, `sleep` and `now` default to the browser's; tests pass fakes.
   * @param {MDCGoogleClientOptions} options @returns {MDCGoogleClient}
   */
  function client({ key, calendarId, fetch = globalThis.fetch.bind(globalThis), crypto = globalThis.crypto, sleep, now = () => Date.now(), onWait = () => {} }) {
    const wait = sleep || ((/** @type {number} */ ms, /** @type {AbortSignal | undefined} */ signal) => new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(signal.reason);
      }, { once: true });
    }));
    const events = `${apiUrl}${encodeURIComponent(calendarId)}/events`;
    /** @type {{value: string, expires: number} | null} */
    let token = null;

    /** @param {string} url @param {RequestInit} init */
    async function send(url, init) {
      try {
        return await fetch(url, init);
      } catch (error) {
        if (init.signal?.aborted) throw error;
        throw new GoogleError("MDC-405", "No connection to Google", error instanceof Error ? error.message : String(error));
      }
    }

    /**
     * Sends a request again while Google asks to wait (HTTP 429, a rate-limit 403) or fails on its side (5xx), waiting as
     * Google says or 1, 2, 4, … seconds; `onWait` gets each wait in seconds.
     * @param {string} url @param {RequestInit} init
     */
    async function patiently(url, init) {
      for (let attempt = 0; ; attempt += 1) {
        const response = await send(url, init);
        const limited = response.status === 429 || response.status >= 500 ||
          (response.status === 403 && rateLimitReasons.includes(reason(await body(response.clone())).reason));
        if (!limited || attempt === attempts - 1) return response;
        const after = Number(response.headers.get("Retry-After"));
        const seconds = Number.isFinite(after) && after > 0 ? after : 2 ** attempt;
        onWait(seconds);
        await wait(seconds * 1000, init.signal || undefined);
      }
    }

    /** Fetches an access token, or reuses the one in memory. @param {AbortSignal} [signal] */
    async function authorize(signal) {
      const seconds = Math.floor(now() / 1000);
      if (token && token.expires - tokenMargin > seconds) return token.value;
      const grant = new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: await assertion(key, seconds, crypto) });
      const response = await patiently(tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: grant.toString(), signal });
      const payload = await body(response);
      if (!response.ok || typeof payload?.access_token !== "string") {
        throw new GoogleError("MDC-402", "Google refused the key", `HTTP ${response.status} ${reason(payload).message}`.trim());
      }
      token = { value: payload.access_token, expires: seconds + Number(payload.expires_in || 3600) };
      return token.value;
    }

    /**
     * An authorized request to the calendar; a token Google no longer accepts is fetched again once.
     * @param {string} url @param {{method?: string, json?: unknown, headers?: Record<string, string>, signal?: AbortSignal}} [options]
     */
    async function call(url, { method = "GET", json, headers = {}, signal } = {}) {
      for (let retry = 0; ; retry += 1) {
        const value = await authorize(signal);
        const response = await patiently(url, {
          method, signal,
          headers: { Authorization: `Bearer ${value}`, ...(json === undefined ? {} : { "Content-Type": "application/json" }), ...headers },
          ...(json === undefined ? {} : { body: JSON.stringify(json) })
        });
        if (response.status !== 401 || retry) return { response, payload: response.status === 204 ? null : await body(response) };
        token = null;
      }
    }

    /** Turns a failed calendar request into its error. @param {Response} response @param {any} payload @returns {never} */
    function fail(response, payload) {
      const { reason: why, message } = reason(payload);
      const detail = `HTTP ${response.status} ${message}`.trim();
      if (why === "accessNotConfigured" || why === "SERVICE_DISABLED") throw new GoogleError("MDC-406", "The Google Calendar API is not enabled", detail);
      if (response.status === 404) throw new GoogleError("MDC-403", "Calendar not found", detail);
      if (response.status === 403) throw new GoogleError("MDC-404", "No write access to the calendar", detail);
      throw new GoogleError("MDC-406", "Google rejected the request", detail);
    }

    /**
     * Proves that the calendar is reachable and writable and reads its time zone (docs/Architecture.md#access).
     * @param {AbortSignal} [signal] @returns {Promise<{timeZone: string, accessRole: string}>}
     */
    async function probe(signal) {
      const { response, payload } = await call(`${events}?maxResults=1`, { signal });
      if (!response.ok) fail(response, payload);
      const accessRole = String(payload?.accessRole || "");
      if (accessRole !== "writer" && accessRole !== "owner") {
        throw new GoogleError("MDC-404", "No write access to the calendar", `Access role: ${accessRole || "none"}`);
      }
      return { timeZone: String(payload?.timeZone || ""), accessRole };
    }

    /**
     * The events changed since `syncToken`, or every event without one; deleted events come as `cancelled`. Returns
     * `expired` when Google rejects the token (HTTP 410).
     * @param {{syncToken?: string, signal?: AbortSignal, onPage?: (count: number) => void}} [options]
     * @returns {Promise<{expired: true} | {expired: false, events: any[], syncToken: string, timeZone: string}>}
     */
    async function changes({ syncToken, signal, onPage = () => {} } = {}) {
      /** @type {any[]} */
      const found = [];
      let pageToken = "";
      let timeZone = "";
      for (;;) {
        const query = new URLSearchParams({ maxResults: "2500", singleEvents: "false" });
        if (syncToken) query.set("syncToken", syncToken);
        if (pageToken) query.set("pageToken", pageToken);
        const { response, payload } = await call(`${events}?${query}`, { signal });
        if (response.status === 410 && syncToken) return { expired: true };
        if (!response.ok) fail(response, payload);
        found.push(...(payload?.items || []));
        timeZone = String(payload?.timeZone || timeZone);
        onPage(found.length);
        if (payload?.nextPageToken) {
          pageToken = payload.nextPageToken;
          continue;
        }
        return { expired: false, events: found, syncToken: String(payload?.nextSyncToken || ""), timeZone };
      }
    }

    /**
     * One event as Google has it now; a deleted or missing one is returned as cancelled.
     * @param {string} id @param {AbortSignal} [signal] @returns {Promise<any>}
     */
    async function get(id, signal) {
      const { response, payload } = await call(`${events}/${encodeURIComponent(id)}`, { signal });
      if (response.status === 404 || response.status === 410) return { id, status: "cancelled" };
      if (!response.ok) fail(response, payload);
      return payload;
    }

    /**
     * Creates an event with the ID chosen in advance; an ID that already exists means the create happened before.
     * @param {Record<string, unknown> & {id: string}} event @param {AbortSignal} [signal]
     * @returns {Promise<{status: "created", event: any} | {status: "exists"}>}
     */
    async function insert(event, signal) {
      const { response, payload } = await call(events, { method: "POST", json: event, signal });
      if (response.status === 409) return { status: "exists" };
      if (!response.ok) fail(response, payload);
      return { status: "created", event: payload };
    }

    /**
     * Changes the given fields of an event while it still has `etag`.
     * @param {string} id @param {Record<string, unknown>} fields @param {string} etag @param {AbortSignal} [signal]
     * @returns {Promise<{status: "updated", event: any} | {status: "changed"} | {status: "gone"}>}
     */
    async function patch(id, fields, etag, signal) {
      const { response, payload } = await call(`${events}/${encodeURIComponent(id)}`, { method: "PATCH", json: fields, headers: etag ? { "If-Match": etag } : {}, signal });
      if (response.status === 412) return { status: "changed" };
      if (response.status === 404 || response.status === 410) return { status: "gone" };
      if (!response.ok) fail(response, payload);
      return { status: "updated", event: payload };
    }

    /**
     * Deletes an event; one that is already gone counts as deleted.
     * @param {string} id @param {AbortSignal} [signal] @returns {Promise<{status: "deleted"}>}
     */
    async function remove(id, signal) {
      const { response, payload } = await call(`${events}/${encodeURIComponent(id)}`, { method: "DELETE", signal });
      if (!response.ok && response.status !== 404 && response.status !== 410) fail(response, payload);
      return { status: "deleted" };
    }

    return { authorize, probe, changes, get, insert, patch, remove };
  }

  /** A new sync ID for an item created by the app: 8 characters of base32hex (docs/DataFormat.md#sync-ids). @param {Crypto} [crypto] */
  function newId(crypto = globalThis.crypto) {
    const alphabet = "0123456789abcdefghijklmnopqrstuv";
    return Array.from(crypto.getRandomValues(new Uint8Array(8)), byte => alphabet[byte % 32]).join("");
  }

  app.google = { readKey, client, newId, GoogleError };
})(window.MDCalendar);
