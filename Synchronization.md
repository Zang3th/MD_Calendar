# Synchronization with Google Calendar

Working document for the synchronization feature (Roadmap 0.8.1). It collects the agreed requirements and the open questions. Once the feature is specified, its content moves into the owning documents in `docs/` and this file is removed.

## Agreed requirements

### Scope

- Synchronization runs only with Google Calendar.
- It runs only explicitly: nothing happens automatically, in the background or on a timer.
- Entries with a time are synchronized in both directions.
- Multi-day entries and day-off entries (tag “DayOff”, see [Domain](docs/Domain.md#tags)) are exported to Google as all-day events. Google all-day events are never imported.
- Other entries without a time, backlog entries and tasks/to-dos are not synchronized.
- Entries are created in Google with as much of their information as possible; where Google needs a value the calendar does not have, a sensible default is used.
- Only entries from the cutover date **23.11.2026** onward are compared.

### Storage

- The service account key (see [S1](#s1--authentication-with-a-service-account)) is stored locally in the calendar folder, next to the other files.
- Timestamps, device information and the synchronization state are kept in `MD_Calendar.json`.

### Flow

1. A **Sync** button opens the **sync dialog**.
2. The dialog shows the last synchronization, the last saves and similar status information.
3. **Check sync status** compares the timed entries of the calendar with those in Google from the cutover date onward.
4. The differences are shown clearly. The user selects per difference how to synchronize, similar to the merge view of a source-control client such as Fork.
5. When no local timed entries have changed since the last synchronization (judged by the save state), the local-to-Google direction is skipped and only Google is queried. The app tells this from the hash of `Calendar.md` at the last synchronization, kept in the `sync` section; Google is always queried incrementally (S4).

### Quality

- All text is English.
- Clear, unambiguous and attractive icons for every step.
- The dialog meets the visual standard of the [Design System](docs/ui/DesignSystem.md).
- Waiting times are bridged with polished animations.
- At every moment it is clear what is happening: every phase shows what it does, progress is shown wherever it can be measured, and every wait is bridged by an animation.
- Cancelling is possible at every moment.
- The process follows the principles of transactions (atomicity, consistency, isolation, durability) as far as two independent systems allow.

## Conflicts with existing documents

These statements contradict the feature and must be changed when it is specified:

- [Product](docs/Product.md#out-of-scope): "Synchronization with Google Calendar after the cutover" is out of scope; the cutover section calls Google Calendar a read-only archive.
- [Decisions D1](docs/Decisions.md): rejects an own frontend on the Google Calendar API because it "needs OAuth and a server origin".
- [Architecture](docs/Architecture.md#runtime): no server, started from `file://`; production dependencies are fixed.
- [DataFormat](docs/DataFormat.md#entry-identity): entries carry no IDs; identity is date, title and position.
- [Domain](docs/Domain.md#time): no time zones.
- [Architecture](docs/Architecture.md#saving) and [D4](docs/Decisions.md#d4--explicit-saving): saving is explicit; the synchronization saves at its end (S16).

## Technical constraints found so far

- **CORS under `file://` (tested 26.11.2026):** `oauth2.googleapis.com/token` and the Calendar API (`www.googleapis.com/calendar/v3`) answer requests with `Origin: null` with `Access-Control-Allow-Origin: null`. Once a credential exists, the page can fetch tokens and call the API from `file://` without a server.
- **Sign-in under `file://`:** Google's browser sign-in (Google Identity Services) requires a registered `http(s)` JavaScript origin; `file://` cannot be registered. Loopback redirects (`http://127.0.0.1:<port>`) of a "Desktop app" client need a listener, or the user copies the redirected URL by hand.
- **Testing mode:** refresh tokens of an OAuth app in publishing status "Testing" expire seven days after consent. In status "In production" without verification they do not expire; Google shows an "unverified app" warning on consent.
- **No IDs in entries:** to recognize an entry again after a title or time change, the link between a local entry and a Google event must be stored somewhere.
- **Not atomic across systems:** Google has no transaction across several events. Atomicity can be achieved locally (one undo action, one save) but only approximated on the Google side (plan, apply step by step, record progress, compensate or resume).

## Open questions

See the current list in the conversation; answers are recorded here.

## Decisions

### S1 · Authentication with a service account

**Decision:** The app authenticates as a Google service account. The user shares the Google calendar to synchronize with the service account's email address ("Make changes to events"). The service account's JSON key lies in the calendar folder; the app signs the token request itself (JWT, RS256 through WebCrypto) and calls the token endpoint and the Calendar API directly from the page. Access tokens live only in memory.
**Reasons:** works under `file://` without a server or a sign-in flow; no consent screen, no seven-day expiry in testing mode and no verification warning; the key reaches only calendars that were explicitly shared with the service account, not the whole Google account.
**Consequences:** the key is a permanent credential for the shared calendar until it is deleted in the Google Cloud console; whoever can read the folder can change that calendar. Inviting attendees is not possible (not needed). A one-time setup in the Google Cloud console is required (project, Calendar API, service account, key, sharing) and is documented step by step.
**Rejected:** OAuth with a desktop client and copying the redirected URL by hand (consent flow, refresh token expires after seven days in testing mode); OAuth with a setup script (needs Node and the command line); Google Identity Services (needs an `http(s)` origin, which breaks the `file://` runtime); a Google Apps Script endpoint (second code location, slow, weak error handling); API key, secret iCal address and CalDAV (read-only or no gain).

### S2 · A dedicated Google calendar

**Decision:** Synchronization uses one dedicated secondary Google calendar (for example "MD_Calendar"), created by the user and shared only with the service account. The primary calendar is neither read nor written. The user sets this calendar as the default calendar in the Google Calendar apps so that entries created on the phone land in it.
**Reasons:** the key reaches nothing but this calendar; the Google history in the primary calendar stays out of reach; what comes from the app is visible at a glance; the calendar can be deleted and set up again if needed.
**Consequences:** entries created in Google in another calendar are not synchronized. The calendar starts empty, so the first synchronization uploads the timed entries from the cutover date onward.
**Rejected:** the primary calendar (the key could change the whole history); writing a dedicated calendar while also reading the primary one (unclear where a local change to an entry from the primary calendar goes).

### S3 · Guided setup in the sync dialog

**Decision:** When the folder has no key or no calendar ID, the sync dialog shows a setup step: the user picks or drops the downloaded service account key and pastes the calendar ID. The app checks both at once (key readable, token obtained, calendar reachable and writable) and names a failure precisely, for example that the calendar is not shared with the service account. On success it writes the key unchanged as `MD_Calendar.key.json` into the folder and the calendar ID into a new `sync` section of `MD_Calendar.json`, which later also holds the timestamps and the sync state.
**Reasons:** no renaming or hand-written JSON; the setup is verified immediately; the secret stays separate from the status file, which can be read or shared without risk.
**Consequences:** the key is replaced through the same step. `MD_Calendar.key.json` is a new file the app writes; [DataFormat](docs/DataFormat.md) gains it and the `sync` section.
**Rejected:** renaming the key by hand and entering the ID in the dialog only (no check of the key before use); one hand-made file with key and ID (error-prone).

### S4 · Range from the cutover date, incremental Google queries

**Decision:** Synchronization covers every timed entry from the cutover date 23.11.2026 onward, without an end. Google is queried incrementally with the Calendar API sync token, which returns only the events changed or deleted since the previous query; the token is kept in the `sync` section of `MD_Calendar.json`. Locally the app compares in memory against the state of the last synchronization.
**Reasons:** complete and fast for years of entries; deletions in Google are reported explicitly instead of being inferred from a missing event.
**Consequences:** a sync token cannot be combined with a time range, so the first query reads the whole dedicated calendar and events before the cutover date are ignored locally. When Google rejects the token (HTTP 410), the app runs one full comparison and says so in the dialog.
**Rejected:** a full comparison of everything on each run (grows with the years, deletions only inferred); a sliding window (later corrections to older entries would not be synchronized).

### S5 · Recurring entries only from local to Google

**Decision:** Recurring entries with a time are uploaded as Google series: `#Repeat` becomes the `RRULE`, `#Except` becomes cancelled occurrences, `UNTIL` the end of the series. Series are never imported from Google: a series created in Google is shown in the merge view as a note only. A change in Google to a synchronized series (the series itself or a single occurrence moved, renamed or deleted) is shown as a conflict with the choice "keep local" (Google is overwritten with the local series) or "ignore".
**Reasons:** series are created on the desktop; Google can express what the calendar cannot (single occurrences moved or renamed, rules outside the allowed subset), and importing that is by far the most complex part of the synchronization.
**Consequences:** a series changed on the phone does not reach the calendar automatically; it has to be changed locally as well.
**Rejected:** series in both directions (single changed occurrences and unsupported rules need a lossy mapping); no series at all (recurring entries would be missing on the phone).

### S6 · No end time means zero duration

**Decision:** An entry with a start time and no end time is written to Google with the end equal to the start. Reading back, an event whose end equals its start becomes an entry without an end time; any other end is taken as the entry's end time.
**Reasons:** no invented duration; the round trip is lossless without a hidden marker.
**Consequences:** such entries look small in Google's week view.
**Rejected:** a fixed default duration with a hidden marker (Google shows a duration that never existed; a changed end has to be interpreted); a default duration per tag (needs an extension of `Config.md`).

### S7 · Time zone of the Google calendar

**Decision:** The app reads the time zone of the dedicated Google calendar (for example `Europe/Berlin`) on each synchronization. Entries are written as local times in that zone; events are read converted into it.
**Reasons:** one source of truth, independent of the device and its system settings; Google handles daylight saving time.
**Consequences:** an event created in another time zone appears at the converted time (09:00 in New York becomes 15:00).
**Rejected:** a fixed `Europe/Berlin` in the code (diverges when the calendar setting changes); the time zone of the synchronizing device (shifts every entry when synchronizing while travelling).

### S8 · Field mapping and tags

**Decision:** Title, location and note map to the Google event's summary, location and description. A tag is written as the Google event color closest to the tag's color in `Config.md` (one of Google's 11 fixed event colors) and its name as a private extended property of the event. Reading back, the extended property gives the tag; an event without it (created in Google) gets the tag whose Google color it has when exactly one tag maps to that color, otherwise no tag.
**Reasons:** lossless round trip; colors in Google resemble the local ones; on the phone a tag can be set through the color.
**Consequences:** tags that share a Google color cannot be set through the color on the phone. A tag missing in `Config.md` is kept in the extended property and written without a color.
**Rejected:** the tag as `#Tag` text in the title (clutters titles, no colors); color and title text together (redundant); no tags (entries from the phone always arrive untagged).

### S9 · Done state stays local

**Decision:** The done state of entries and occurrences is not synchronized. Checking an entry off or on is no change for Google; entries from Google arrive open; a checked entry stays checked when Google changes another field.
**Reasons:** simple, no traffic for checking off; done carries little meaning for timed entries; Google has no done state for events.
**Consequences:** the phone does not show which entries are checked off.
**Rejected:** a visible "✓ " prefix in the title (changes titles in Google, and checked occurrences would become single changes of a series, which contradicts S5); a hidden property (no use on either side).

### S10 · Google events the calendar cannot hold

**Decision:** A Google event with a time that spans several days is not imported; the merge view shows it as a note ("spans several days – not imported"). All-day events created in Google are not imported either. Of every Google event the app reads and writes only title, start, end, location, description, color and its own extended properties; attendees, attachments, reminders, conference links and other fields are ignored and never changed.
**Reasons:** the calendar has no timed entries over several days; importing them would lose the end or create duplicates; writing only known fields keeps what was set in Google.
**Rejected:** importing as a single entry on the start day (loses the end, conflicts with S6 on the next run); importing as a multi-day entry without times (falls out of the synchronization and duplicates the event).

### S11 · All-day exports: the calendar is the source

**Decision:** Multi-day entries and day-off entries are written to Google as all-day events, one way only. A multi-day entry becomes one all-day event over its dates, with title, location, note and the color and tag of S8. A day-off entry becomes an all-day event on its day, also when it has a time. A change or deletion in Google of such an exported event is shown in the merge view as a conflict with the choice "keep local" (Google is set back to the local state or created again) or "ignore"; it is never taken over locally.
**Reasons:** the same behavior as series (S5); the calendar keeps days off and multi-day entries by hand; nothing changes silently.
**Rejected:** overwriting Google silently (a change on the phone would vanish unnoticed); ignoring changes in Google (both sides drift apart unnoticed).

### S12 · Visible sync IDs in the calendar file

**Decision:** Every synchronized entry carries a visible sync ID in `Calendar.md`: the ID of its Google event. The app recognizes entries by this ID only; there is no heuristic matching. The state of the last synchronization (one fingerprint per field) is kept per ID in the `sync` section of `MD_Calendar.json`, so that the comparison can tell local changes, Google changes and conflicts apart.
**Reasons:** absolutely robust, also for entries edited by hand, moved to another day or renamed; no need to follow entries through every domain operation.
**Consequences:** contradicts the rule that entries carry no IDs ([DataFormat](docs/DataFormat.md#entry-identity)); that rule and the golden file `Calendar.md` change.
**Format:** a day entry ends with `{sync=<id>}` after its optional tag, for example `- [ ] 09:30 - 10:15 Dentist #Private {sync=k3v9q2ab}`. Multi-day and recurring entries get a `#Sync` block with one list item holding the ID. The pattern is recognized only at the end of the entry line; elsewhere it stays part of the title. Entries created by the app get an 8-character ID chosen by the app from `a`–`v` and `0`–`9` (Google accepts client-chosen event IDs, so a repeated create is recognized instead of duplicated); events created in Google keep their Google ID.
**Rejected:** a trailing `^id` (does not say what it is), `[sync:: id]` (longer), `(sync: id)` (parentheses are common in titles), an indented `- Sync:` line (collides with notes), an HTML comment (loudest in the raw text), `@` and `#` (taken by placed occurrences and tags); a link table that follows entries through the session (complex, every domain operation involved); a link table with heuristic matching only (renamed and moved entries appear as deleted and new).

### S13 · Deletions in both directions, never preselected

**Decision:** A deletion on one side is offered for the other side in its own category of the merge view, with a trash icon, and is never preselected; the user confirms each deletion or all at once. An entry that leaves the synchronized range counts as a deletion for the other side and is marked with its reason. Locally that is an entry moved into the backlog (it has no date and no time there; Google has no backlog), an entry whose time is removed and an entry moved before the cutover date: the event is removed from Google, and this removal is preselected, because the entry still exists locally. In Google it is an event that becomes an all-day event or moves before the cutover date: this is offered as a deletion of the local entry and is not preselected. When such a deletion is applied, the app removes the `{sync=…}` ID from the local entry.
**Reasons:** nothing disappears by accident, for example after deleting an event on the phone by mistake; an entry that leaves the range locally was moved on purpose and is not lost.
**Rejected:** deletions preselected like other changes (one quick apply loses an entry); deletions never transferred (every deletion by hand on both sides).

### S14 · Preselection in the merge view; unselected differences stay open

**Decision:** The merge view lists every difference with a choice, preselected as follows:

| Case | Preselected |
|---|---|
| New locally / new in Google | Copy to the other side |
| Changed only locally / only in Google | Copy to the other side |
| Locally moved into the backlog, time removed, moved before the cutover date | Remove from Google |
| Conflict (changed on both sides) | Nothing: local, Google, or per field |
| Deleted on one side, or left the range in Google | Nothing |
| Series or all-day export changed in Google (S5, S11) | Nothing: "keep local" or "ignore" |
| Cannot be imported (S10, a new series in Google) | Note only |

A conflict can be resolved per field (for example the title from local, the time from Google) as long as the same field did not change on both sides. A difference left unselected is skipped: its state of the last synchronization stays as it is, so it appears again on the next run. "Ignore" stores the current Google state as seen, so the difference reappears only after the next change.
**Reasons:** nothing is lost; decisions can be postponed while the unambiguous differences are applied.
**Rejected:** treating unselected differences as accepted (both sides drift apart invisibly); requiring a decision for every difference before applying.

### S15 · Synchronization starts from the saved state

**Decision:** "Check sync status" is available only without unsaved changes. Otherwise the dialog shows "You have N unsaved changes" and a "Save and continue" button, which saves as usual (with the version check) and then checks.
**Reasons:** the synchronization always starts from a state that is on disk, a clear starting point for the transaction; saving stays explicit.
**Rejected:** a hint only (one click more for the same result); synchronizing unsaved changes (after a reload Google would hold entries that never existed locally).

### S16 · Local changes as one undo action, saved by the synchronization

**Decision:** All local changes a synchronization applies form one undo action ("Sync with Google (N changes)"). The synchronization saves `Calendar.md` and `MD_Calendar.json` itself at its end, through the usual write queue and version check; afterwards the unsaved count is 0. Undoing the action later is an ordinary local change that the next synchronization offers for Google.
**Reasons:** the synchronization is one completed operation; there is no state in which Google has changed and the calendar only in memory.
**Consequences:** the one place where the app saves without the save control, triggered by the explicit "Apply"; [Architecture](docs/Architecture.md#saving) and [D4](docs/Decisions.md#d4--explicit-saving) gain this exception.
**Rejected:** applying as unsaved changes (Google already changed; a reload or closing the page leaves both sides apart).

### S17 · Journal, idempotent operations, one transaction per difference

**Decision:** Before the first call to Google, "Apply" writes the complete plan (operations, IDs and target states) as a journal into the `sync` section of `MD_Calendar.json`. Every Google operation can be repeated safely: a create uses the ID chosen in advance (a repetition is reported as existing, not duplicated), an update applies only while the event is unchanged since the check (ETag), a delete accepts an event that is already gone. Each difference is its own transaction: "Cancel" during "Apply" finishes the running operation and stops; the differences already done are applied locally, saved and recorded as synchronized, the rest stays open and appears again on the next run (S14). An open journal found when the folder opens (a crash, a closed tab, a lost connection) is completed in the sync dialog, which says so.
**Reasons:** every state after a cancellation is consistent: each entry is either completely synchronized or unchanged; no compensation that can fail on its own.
**Rejected:** all or nothing with compensation (needs the network again and can fail, events appear and vanish on the phone); no cancellation during "Apply" (contradicts cancelling at any moment).

### S18 · Feedback in every phase

**Decision:** The sync dialog shows in every phase what happens; no state only flashes (minimum durations as in D51), every wait has an animation, calmer under `prefers-reduced-motion`.

| Phase | Display |
|---|---|
| Setup (S3) | Checklist "Reading key", "Getting access", "Reaching calendar", "Checking write access"; each step turns from a spinner into a drawn check mark, or into a red cross with the exact reason and how to fix it. |
| Overview | Last synchronization (time, device, result such as "5 ↑ · 3 ↓"), "Local changes since last sync: yes/no", the connected calendar. An open journal (S17) is a warning card at the top. |
| Saving (S15) | "Save and continue" shows the same saving state as the save control. |
| Check | Steps "Connecting to Google", "Reading changes" with a live counter ("124 events read"), "Comparing"; below them a shimmering skeleton of the merge view, so that the list appears without a jump. |
| Merge view | Counts per category (new, changed, conflict, deleted, note); the button names the amount: "Apply 7 changes". |
| Apply | Determinate progress bar "4 of 12"; every row of the merge view shows its state live (waiting, running, done, failed) and is checked off in place. After "Cancel": "Cancelling after the current change…" until the running operation ends. |
| Saving locally | Step "Saving calendar" at the end of the bar. |
| Result | Animated summary "12 synchronized · 2 skipped · 1 failed"; a failed entry shows its reason and "Retry". |
| Errors | Offline, key revoked, calendar no longer shared: a clear message with the way out. Google's rate limit: automatic waiting with a countdown ("Google asks to wait – retrying in 4 s"). An event changed in Google since the check (ETag) is not overwritten; it stays an open difference with a note. |

Closing the dialog during the check cancels it without effect; during "Apply" the dialog closes only through "Cancel", so it is never unclear whether something is still being written.

### S19 · Sync button in the header

**Decision:** An icon button "Sync" in the left zone of the header, directly left of the save control: logo · month · **+** · undo · redo · **sync** · save. It shows a subtle dot while something was saved locally since the last synchronization (from the hash of `Calendar.md`, without a network request), and a warning state while a journal is open (S17). Changes in Google are not shown, because nothing queries Google automatically.
**Reasons:** synchronization is the step after saving; the dot is a quiet reminder; an interrupted synchronization must not go unnoticed.
**Consequences:** [Shell](docs/ui/Shell.md#header) gains the button.

### S20 · Merge view in two columns

**Decision:** The sync dialog opens its review as two columns, "Calendar" on the left and "Google" on the right, grouped by day, one row per difference with a direction control between the columns. Each side shows time and title on one line and, only when it differs, the location below. Changed values are tinted in `--warn`, the value that wins in `--ok`. The control between the columns is an arrow for a single direction (`→` to Google, `←` to the calendar, dimmed when skipped), three icon buttons for a conflict (take Google, combine, keep calendar) and two for a series (keep local, ignore). With "combine", the changed values on both sides become clickable to pick per field. A missing side reads "— not in the calendar", "in the backlog", "deleted" and the like. During "Apply" the control turns into the row's state icon. The dialog is lean: no step indicator, no illustration, no cards; overview and check are short lists, the result one line. Mockups: https://claude.ai/artifact/W3pSbFHAr9qrbDipmQhwtf (variant A).
**Look** (all tokens from the [Design System](docs/ui/DesignSystem.md)):

| Element | Values |
|---|---|
| Dialog | 880 × 660px, radius 22px, `--panel` at 88 %, 1px `--edge`, shadow `.6`; rises 8px and fades in (200ms) |
| Head | padding 16px 16px 14px 20px; sync icon 18px in the lightened `--accent` (turns while busy); "Sync with Google" 16px/800; status text 12.5px `--faint` right after it; close as a 32px icon button |
| Body | padding 0 20px 12px, 1px `--edge` line above; scrolls with the standard scrollbar |
| Column head | sticky, "Calendar" left, "Google" right-aligned, 11.5px/700 `--faint`; columns `1fr 92px 1fr`, gap 12px |
| Day label | 11.5px/700 `--faint`, tabular, 14px above, 4px below ("Thu 27.11.", "Series") |
| Row | padding 7px 0, 1px `--card-edge` line below; left side left-aligned, right side right-aligned |
| Side | line 1: time 12.5px `--muted` tabular, 10px gap, title 700 with a 7px dot in the tag hue (`hsl(h 62% 68%)`); line 2, only when the location differs: 12px `--faint`; a missing side 12.5px `--faint` ("— in the backlog") |
| Changed value | `--warn` at 12 % behind, text lightened `--warn`, radius 5px, padding 1px 4px |
| Winning value | `--ok` at 12 % behind, text lightened `--ok`; with "combine" pickable values get a 1px underline in their text color |
| Direction | 44 × 26px, radius 8px; `→` in `--accent`, `←` in `--accent-2`, removals in `--danger`, each on its color at 12 %; skipped: `--deco` without fill, and both sides of the row drop to `.55` |
| Conflict and series control | icon buttons 26 × 24px in a recessed well (padding 2px, radius 9px), selected: `--accent` at 24 % with lightened accent; while undecided the well has a 1px `--warn` ring at 45 % |
| States during "Apply" | 20px circles: waiting 2px `--deco` ring, running spinner in `--accent`, done drawn check on `--ok` at 24 %, failed cross on `--danger` at 24 %, left open clock on `--warn` at 24 %, not selected dash in `--faint` |
| Footer | padding 12px 16px 12px 20px, 1px `--edge` line above; "N changes selected · N to decide" (count 700 `--text`, open decisions lightened `--warn`), Cancel, Apply (primary); during "Apply" a 4px progress bar in `--accent` (scaleX) with the running operation and "4 / 9" above it |
| Overview, check, result | centered, max 520px (check 360px); overview as a two-column fact list (140px labels in `--faint`); check as three rows with state circle, label and counter; result: 56px circle with drawn check (or pause in `--warn`), 18px/800 title, one line of counts |

**Reasons:** the comparison of both sides and the direction of each change are visible at a glance, as in a merge tool.
**Rejected:** a list by categories with a one-line summary per change (variant B); a list with a detail pane (variant C).

### S21 · Error codes, setup guide, several devices

**Decision:** Synchronization errors use the codes `MDC-4xx`. The one-time setup in the Google Cloud console (project, Calendar API, service account, key, sharing the calendar) is documented step by step in its own section of the documentation. The sync state and the journal live in the shared folder; the existing assumption that one device writes at a time ([Product](docs/Product.md#usage-profile)) also covers synchronization.

### S22 · Sync icon: circle arrows

**Decision:** The sync button and the head of the sync dialog use the circle arrows: two arcs of one circle, each ending in an arrowhead. As a header icon it is drawn on the 36-unit canvas (`hdr-sync`, `res/header-icons/sync.svg`), as a UI icon on the 32-unit canvas (`icon-sync`, `res/icons/sync.svg`), following the [icon rules](docs/ui/DesignSystem.md#icons). While a check or "Apply" runs, the icon turns (a transform; it stands still under reduced motion). States of the button as in S19: a dot in `--accent` for local changes since the last synchronization, a dot in `--warn` for an open journal. Drafts: https://claude.ai/artifact/W3pSbFHAr9qrbDipmQhwtf (artboard "Sync icon drafts", design 1); the final drawing is aligned to whole pixels during implementation.
**Reasons:** the established sign for synchronization, read instantly; it turns naturally while busy.
**Rejected:** the Orbit ring of the logo with an arrowhead, a calendar with a small circular arrow (too dense at 18px), two opposed arrows.
