window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Applying a synchronization: the plan of the chosen differences, its run against Google as one small transaction per
// difference, the local changes as one undo action, and the state recorded afterwards (docs/Architecture.md#journal).
(function (app) {
  /** Cases that carry a change or deletion made in Google; left unapplied, their events are read again next time. */
  const fromGoogle = ["new-google", "changed-google", "conflict", "deleted-google", "left-google", "export-changed"];

  /** Entry fields of the model from compared fields. @param {Record<string, string>} fields */
  function entryFields(fields) {
    const [start = "", end = ""] = fields.time.split("-");
    return { title: fields.title, start, end, location: fields.location, note: fields.note ? fields.note.split("\n") : [], tag: fields.tag };
  }

  /**
   * The operations of the chosen differences, in the order of the merge view. `choices` maps a difference's key to the
   * choice made, `null` for one left unselected.
   * @param {MDCSyncComparison} comparison @param {Record<string, MDCSyncChoice | null>} choices
   * @param {{base: Record<string, MDCSyncItem>, timeZone: string, tags: MDCTag[], newId: () => string, by: string, startedAt: string, syncToken: string}} context
   * @returns {MDCSyncJournal}
   */
  function plan(comparison, choices, { base, timeZone, tags, newId, by, startedAt, syncToken }) {
    const { fingerprints, toEvent, combined } = app.sync;
    /** @type {MDCSyncOperation[]} */
    const operations = [];
    /** @type {string[]} */
    const open = [];
    let skipped = 0;
    for (const difference of comparison.differences) {
      const choice = difference.key in choices ? choices[difference.key] : difference.preselected;
      if (difference.case === "note") continue;
      if (!choice || !difference.choices.includes(choice)) {
        skipped += 1;
        if (difference.id && fromGoogle.includes(difference.case)) open.push(difference.id);
        continue;
      }
      const { kind } = difference;
      const id = difference.id || newId();
      const calendar = difference.calendar || {};
      const google = difference.google || {};
      const title = calendar.title || google.title || "";
      const etag = difference.etag;
      /** @param {Record<string, string>} fields @param {string} [tagged] */
      const body = (fields, tagged) => toEvent(kind, fields, timeZone, tags, tagged);
      /** @param {Record<string, string>} fields @returns {MDCSyncItem} */
      const state = fields => ({ kind, etag, calendar: fingerprints(fields) });
      /** @type {Omit<MDCSyncOperation, "google" | "local" | "record">} */
      const head = { key: difference.key, id, kind, choice, title, state: "pending" };
      const gone = difference.case === "deleted-google" || difference.case === "left-google" || (difference.case === "export-changed" && difference.reason === "deleted");

      if (choice === "to-google" || choice === "keep") {
        const action = difference.case === "new-local" ? "insert" : gone ? "restore" : "patch";
        operations.push({
          ...head,
          google: { action, body: body(calendar), etag: action === "patch" && choice === "to-google" ? etag : "" },
          ...(difference.id ? {} : { local: { action: "link", ref: difference.ref || undefined, match: JSON.stringify(fingerprints(calendar)) } }),
          record: state(calendar)
        });
      } else if (choice === "to-calendar") {
        operations.push({ ...head, local: { action: difference.case === "new-google" ? "import" : "change", fields: google }, record: state(google) });
      } else if (choice === "combine") {
        const fields = combined(difference);
        operations.push({ ...head, google: { action: "patch", body: body(fields), etag }, local: { action: "change", fields }, record: state(fields) });
      } else if (choice === "ignore") {
        const known = base[id];
        const record = kind === "entry"
          ? { kind, etag, calendar: known?.calendar || fingerprints(calendar), google: fingerprints(google) }
          : { ...(known || state(calendar)), etag };
        operations.push({ ...head, record });
      } else if (choice === "delete-google") {
        operations.push({ ...head, google: { action: "delete" }, ...(difference.case === "left-local" ? { local: { action: "unlink" } } : {}), record: null });
      } else {
        operations.push({ ...head, local: { action: "remove" }, record: null });
      }
    }
    return { startedAt, by, syncToken, operations, same: comparison.same, forgotten: comparison.forgotten, open, skipped };
  }

  /**
   * Runs the Google part of every pending operation, one after another. Each one is idempotent, so a journal can be
   * run again after an interruption. `cancelled` is asked before each operation; `persist` stores the journal at least
   * every 10 operations and before returning. An error that is not about the single operation stops the run.
   * @param {{journal: MDCSyncJournal, client: MDCGoogleClient, cancelled?: () => boolean, progress?: (operation: MDCSyncOperation) => void,
   *   persist?: (journal: MDCSyncJournal) => Promise<void>, signal?: AbortSignal}} options
   */
  async function run({ journal, client, cancelled = () => false, progress = () => {}, persist = async () => {}, signal }) {
    let unsaved = 0;
    try {
      for (const operation of journal.operations) {
        if (operation.state !== "pending") continue;
        if (cancelled()) break;
        progress(operation);
        try {
          await perform(operation, client, signal);
        } catch (error) {
          if (/** @type {any} */ (error)?.code !== "MDC-406") throw error;
          operation.state = "failed";
          operation.error = String(/** @type {any} */ (error).detail || /** @type {Error} */ (error).message);
        }
        progress(operation);
        unsaved += 1;
        if (unsaved >= 10) {
          unsaved = 0;
          await persist(journal);
        }
      }
    } finally {
      await persist(journal);
    }
  }

  /** @param {MDCSyncOperation} operation @param {MDCGoogleClient} client @param {AbortSignal} [signal] */
  async function perform(operation, client, signal) {
    const { google } = operation;
    /** @param {any} event */
    const done = event => {
      operation.state = "done";
      if (operation.record && event?.etag) operation.record.etag = String(event.etag);
    };
    if (!google) return done(null);
    const body = google.body || {};
    if (google.action === "delete") {
      await client.remove(operation.id, signal);
      return done(null);
    }
    if (google.action === "insert") {
      const created = await client.insert({ ...body, id: operation.id }, signal);
      if (created.status === "created") return done(created.event);
      // Created before, by an interrupted run, or an ID Google still keeps for a deleted event: bring it to the target state.
      const updated = await client.patch(operation.id, { ...body, status: "confirmed" }, "", signal);
      return updated.status === "updated" ? done(updated.event) : leave(operation, "deleted-meanwhile");
    }
    if (google.action === "restore") {
      const restored = await client.patch(operation.id, { ...body, status: "confirmed" }, "", signal);
      if (restored.status === "updated") return done(restored.event);
      const created = await client.insert({ ...body, id: operation.id }, signal);
      return created.status === "created" ? done(created.event) : leave(operation, "deleted-meanwhile");
    }
    const updated = await client.patch(operation.id, body, google.etag || "", signal);
    if (updated.status === "updated") return done(updated.event);
    return leave(operation, updated.status === "changed" ? "changed-meanwhile" : "deleted-meanwhile");
  }

  /** An operation Google's state since the check rules out; its difference stays open. @param {MDCSyncOperation} operation @param {string} reason */
  function leave(operation, reason) {
    operation.state = "open";
    operation.reason = reason;
  }

  // ---------- Local changes ----------

  /** @param {MDCCalendar} calendar @param {MDCBacklog} backlog @param {MDCEntryRef} ref */
  function listOf(calendar, backlog, ref) {
    if (ref.key) return /** @type {MDCDay} */ (calendar.days.get(ref.key)).entries;
    return ref.group === -1 ? backlog.ungrouped : backlog.groups[/** @type {number} */ (ref.group)].entries;
  }

  /**
   * Where the item with a sync ID is now.
   * @param {MDCCalendar} calendar @param {MDCBacklog} backlog @param {string} id @returns {MDCSyncRef | null}
   */
  function find(calendar, backlog, id) {
    for (const [key, day] of calendar.days) {
      const index = day.entries.findIndex(entry => entry.sync === id);
      if (index >= 0) return { key, index };
    }
    const groups = [backlog.ungrouped, ...backlog.groups.map(group => group.entries)];
    for (let group = 0; group < groups.length; group += 1) {
      const index = groups[group].findIndex(entry => entry.sync === id);
      if (index >= 0) return { key: "", group: group - 1, index };
    }
    const multiDay = calendar.multiDay.findIndex(item => !("raw" in item) && item.sync === id);
    if (multiDay >= 0) return { multiDay };
    const series = calendar.series.findIndex(item => !("raw" in item) && item.sync === id);
    return series >= 0 ? { series } : null;
  }

  /**
   * Sets or removes the sync ID of the item at `ref`, in place. @param {MDCCalendar} calendar @param {MDCBacklog} backlog
   * @param {MDCSyncRef} ref @param {string} id "" removes it @returns {MDCUndoAction | null}
   */
  function setSync(calendar, backlog, ref, id) {
    /** @param {any} item */
    const marked = item => {
      const copy = { ...item, sync: id };
      if (!id) delete copy.sync;
      return copy;
    };
    if ("multiDay" in ref) return app.calendar.updateMultiDay(calendar, ref.multiDay, marked(calendar.multiDay[ref.multiDay]));
    if ("series" in ref) return app.calendar.updateSeries(calendar, ref.series, marked(calendar.series[ref.series]));
    const list = listOf(calendar, backlog, ref);
    const before = list[ref.index];
    const after = marked(before);
    return {
      label: before.title, days: ref.key ? [ref.key] : [], layout: false, backlog: !ref.key, size: 0,
      redo() { list[ref.index] = after; },
      undo() { list[ref.index] = before; }
    };
  }

  /**
   * The local changes of the done operations as one undo action, “Sync with Google (N changes)”. Each change is computed
   * on the state the previous ones left. New items are linked first, while they still stand where the plan found them;
   * the other changes find their item by its sync ID. An operation whose item cannot be found any more is marked `open`.
   * @param {MDCCalendar} calendar @param {MDCBacklog} backlog @param {MDCSyncJournal} journal @returns {MDCUndoAction | null}
   */
  function applyLocal(calendar, backlog, journal) {
    /** @type {MDCDayAction[]} */
    const actions = [];
    /** @param {MDCUndoAction | null} action */
    const take = action => {
      if (!action) return;
      action.redo();
      actions.push({ ...action, days: action.days || [] });
    };
    const links = journal.operations.filter(operation => operation.local?.action === "link");
    for (const operation of [...links, ...journal.operations.filter(operation => !links.includes(operation))]) {
      const { local } = operation;
      if (operation.state !== "done" || !local) continue;
      // Completing a journal again after an interruption finds what an earlier run already applied and leaves it.
      const current = find(calendar, backlog, operation.id);
      const applied = local.action === "import" || local.action === "link" ? Boolean(current) : local.action === "remove" || local.action === "unlink" ? !current : false;
      if (applied) continue;
      const where = local.action === "link" ? linkTarget(calendar, backlog, local) : current;
      if (local.action !== "import" && !where) {
        leave(operation, "missing-locally");
        continue;
      }
      if (local.action === "import") {
        const fields = /** @type {Record<string, string>} */ (local.fields);
        take(app.calendar.createEntry(calendar, fields.date, { ...entryFields(fields), extra: [], sync: operation.id }));
      } else if (local.action === "change") {
        const fields = /** @type {Record<string, string>} */ (local.fields);
        take(app.backlog.update(calendar, backlog, /** @type {MDCEntryRef} */ (where), { key: fields.date }, entryFields(fields)));
      } else if (local.action === "remove") {
        const ref = /** @type {MDCSyncRef} */ (where);
        take("multiDay" in ref ? app.calendar.deleteMultiDay(calendar, ref.multiDay)
          : "series" in ref ? app.calendar.deleteSeries(calendar, ref.series)
            : app.backlog.remove(calendar, backlog, ref));
      } else {
        take(setSync(calendar, backlog, /** @type {MDCSyncRef} */ (where), local.action === "link" ? operation.id : ""));
      }
    }
    if (!actions.length) return null;
    for (const action of [...actions].reverse()) action.undo();
    const count = actions.length;
    return app.calendar.combine(`Sync with Google (${count} ${count === 1 ? "change" : "changes"})`, actions);
  }

  /**
   * The new item at the place it had when the plan was made, if it is still the same item.
   * @param {MDCCalendar} calendar @param {MDCBacklog} backlog @param {NonNullable<MDCSyncOperation["local"]>} local
   */
  function linkTarget(calendar, backlog, local) {
    const ref = local.ref;
    if (!ref) return null;
    const { sync } = app;
    /** @type {[MDCSyncKind, any, string] | null} */
    let found = null;
    if ("multiDay" in ref) {
      const item = calendar.multiDay[ref.multiDay];
      if (item && !("raw" in item)) found = [item.tag === app.calendar.dayOffTag ? "day-off" : "multi-day", item, ""];
    } else if ("series" in ref) {
      const item = calendar.series[ref.series];
      if (item && !("raw" in item)) found = ["series", item, ""];
    } else if (ref.key) {
      const entry = calendar.days.get(ref.key)?.entries[ref.index];
      if (entry) found = [entry.tag === app.calendar.dayOffTag ? "day-off" : "entry", entry, ref.key];
    }
    if (!found || found[1].sync) return null;
    return JSON.stringify(sync.fingerprints(sync.localFields(found[0], found[1], found[2]))) === local.match ? ref : null;
  }

  /**
   * The recorded state after the run: done operations replace or drop their item, items whose sides agree are recorded,
   * items gone on both sides dropped; the events of differences left open are read again next time.
   * @param {Record<string, MDCSyncItem>} base @param {MDCSyncJournal} journal
   * @returns {{items: Record<string, MDCSyncItem>, open: string[], counts: MDCSyncCounts}}
   */
  function record(base, journal) {
    const items = { ...base };
    for (const id of journal.forgotten) delete items[id];
    for (const same of journal.same) items[same.id] = { kind: same.kind, etag: same.etag, calendar: same.calendar };
    const open = new Set(journal.open);
    const counts = { toGoogle: 0, toCalendar: 0, skipped: journal.skipped, failed: 0 };
    for (const operation of journal.operations) {
      if (operation.state === "done") {
        if (operation.record) items[operation.id] = operation.record;
        else delete items[operation.id];
        if (operation.google) counts.toGoogle += 1;
        if (operation.local && operation.local.action !== "link" && operation.local.action !== "unlink") counts.toCalendar += 1;
      } else {
        if (operation.state === "failed") counts.failed += 1;
        else counts.skipped += 1;
        open.add(operation.id);
        // A new item that was created in Google but could not be linked is no longer recorded as new.
        if (operation.local?.action === "link") delete items[operation.id];
      }
    }
    return { items, open: [...open].filter(Boolean), counts };
  }

  app.syncPlan = { plan, run, applyLocal, record };
})(window.MDCalendar);
