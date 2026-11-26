# Current Work

## Synchronization with Google Calendar (0.8.1)

### Outcome

The user synchronizes timed entries, timed series, multi-day entries and days off with one dedicated Google calendar from the sync dialog, reviews every difference in a two-column merge view, and applies the selection as a sequence of safe, resumable transactions. The specification lives in the owning documents:

| Topic | Document |
|---|---|
| Scope, decisions | [Product](../Product.md#scope), [Decisions](../Decisions.md) D61–D77, changed D1 and D4 |
| What is synchronized, mapping, comparison, preselection | [Domain](../Domain.md#synchronization-with-google) |
| `{sync=…}`, `#Sync`, `MD_Calendar.key.json`, the `sync` section | [DataFormat](../DataFormat.md#sync-ids) |
| Access, Calendar API, journal, saving, errors `MDC-4xx`, setup guide | [Architecture](../Architecture.md#synchronization-with-google) |
| Sync control, sync dialog phases and texts | [Shell](../ui/Shell.md#sync-control) |
| Look of the dialog, sync icon, motion | [Design System](../ui/DesignSystem.md#sync-dialog) |

### Scope boundaries

- Only the dedicated Google calendar; no OAuth, no other calendars, no automatic runs.
- No import of Google series, all-day events or timed multi-day events (notes only).
- No new production dependency (`fetch`, WebCrypto).
- The golden file `data/parsing/Calendar.md` gains a `{sync=…}` entry and `#Sync` blocks in step 1 (approved by the user on 26.11.2026); other golden files stay as they are. Placeholder data only.
- `docs/Roadmap.md` and the README text are not changed (README: only the `master` row in the final review).

### Steps

Each step leaves `npm run verify` green.

1. **Format.** Parse and serialize `{sync=<id>}` on entry lines (calendar and backlog) and `#Sync` in multi-day and recurring entries; report duplicate IDs. Copy, paste, duplicate and ICS import drop the ID; the entry dialog keeps it untouched. Golden file: `{sync=k3v9q2ab}` on “Dentist”, `#Sync` on “Trade fair” and “Gym”. Days off without a time: a `#DayOff` entry with a time is reported on reading and written without it; the entry dialog rules out the time token for the tag (“Not for a day off”) and drops a time chosen before on Apply.
2. **State.** `io/folder-state.js`: schema, key order and sorting of `sync` and `devices.*.lastSynced`; unknown fields kept.
3. **Google client** (`io/google.js`): read the key, sign the JWT, fetch and cache the token, `events.list` with paging and sync token, create with chosen ID, patch with `If-Match`, delete; map HTTP 404/409/410/412/429 to typed results; error codes `MDC-401`…`MDC-407`.
4. **Comparison** (`domain/sync.js`): item kinds and range, field fingerprints, mapping both ways (time zone, zero duration, colors, tag property, series rule and `EXDATE`, all-day exports), classification into the cases and the preselection of Domain, per-field combine, notes.
5. **Plan and apply** (`domain/sync-plan.js`): plan from the selection, idempotent operations, cancellation after the running operation, local changes as one undo action, the recorded state and `sync.open`. Done; the wiring in `app.js` (journal before the first request, saving through the session, `sync.last`, `lastSynced`, completing an open journal) comes with the dialog in step 7, where it is exercised end to end.
6. **Sync control** (`ui/header.js`): button left of save, `hdr-sync` and `icon-sync` symbols and files, dot and warning states, turning while busy.
7. **Sync dialog** (`ui/sync-dialog.js`, wiring in `app.js`): setup, overview, save and continue, check, review, apply, result, errors, keyboard and focus, reduced motion; journal before the first request, saving through the session, completing an open journal.

### Acceptance criteria

1. Setup with a valid key and a shared calendar stores `MD_Calendar.key.json` unchanged and `sync.calendarId`; each of the four setup failures names its cause and code.
2. A new local timed entry is created in Google with its app-chosen ID; the entry gains `{sync=<id>}`; the second run reports nothing.
3. A new timed event in Google arrives as an entry with `{sync=<google id>}`, its tag from the property or the unique color, open, without end time when end equals start.
4. A change on one side is preselected toward the other; a change of the same item on both sides is a conflict with nothing preselected; combine takes fields from both sides.
5. A deletion on either side is offered and not preselected; moving an entry into the backlog, removing its time or moving it before 23.11.2026 preselects removal from Google; applying drops the ID.
6. A timed series appears in Google with `RRULE`, `UNTIL` and `EXDATE`; a multi-day entry and a day off appear as all-day events; changes in Google to them offer “Keep calendar” and “Ignore” only.
7. Google events spanning days, Google all-day events and Google series appear as notes and are never imported.
8. Unselected differences reappear on the next run; ignored ones only after the next change in Google.
9. With unsaved changes the check is offered only as “Save and continue”.
10. The applied local changes are one undo action “Sync with Google (N changes)”; the files are saved and the unsaved count is 0.
11. Cancel during “Apply” finishes the running operation; done differences are applied and saved, the rest stays open. A tab closed during “Apply” leaves a journal; on the next opening the sync control shows its warning and completing the journal creates no duplicates.
12. An event changed in Google after the check (HTTP 412) is not overwritten and stays open; HTTP 410 on the sync token triggers one announced full comparison; a rate limit waits with a countdown.
13. Without local changes since the last sync the control has no dot and the check queries only Google.
14. Every phase shows its state with an animation; nothing flashes shorter than 600ms; reduced motion stops turning, shimmer and drawing.
15. A day off never has a time: a timed `#DayOff` entry in the file is reported and saved without its time; in the dialog the tag rules out the time.
16. The key and access tokens never appear in `MD_Calendar.json`, notifications or error details.

### Unhappy paths and risks to check during implementation

- Version conflict while the synchronization saves: changes stay unsaved, journal stays open, reload-or-overwrite choice appears.
- External change of `Calendar.md` during “Apply”: the automatic reload waits until the dialog is done.
- `MD_Calendar.json` recreated: items without a recorded state are compared directly.
- Kind changes (entry ↔ series ↔ multi-day, tag “DayOff” set or removed) update the same event.
- A Google event ID longer than 8 characters in the format and in the dialog.
- After switching to another Google calendar, local items still carry sync IDs of the old one: they have no recorded state and no event; they must be offered as new, not as deleted in Google.
- Portrait and windows narrower than 928px: the dialog shrinks to the window minus 48px; the columns keep `1fr 92px 1fr`.

### Planned test coverage

- `node:test`: format round trip with sync IDs and `#Sync`, duplicate IDs, ID dropped on copy, paste, duplicate and ICS import; `folder-state` schema; JWT signing against a fixed test key; mapping both ways including time zone and daylight saving time; classification and preselection for every case; plan, cancellation and journal completion with a fake Google client; one undo action.
- Playwright (Google mocked with `page.route`): setup, a full review and apply, cancel during apply, a journal completed after reload, the sync control states.
