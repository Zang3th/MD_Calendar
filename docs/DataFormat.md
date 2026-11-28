# Data Format

How the [domain](Domain.md) is stored. Markdown files in one folder hold all data; `MD_Calendar.json` next to them holds technical data only.

## Calendar folder

- The user selects one folder. Keeping it in sync between devices is left to any sync client; the app does not depend on one.
- A folder is a calendar folder when it holds `MD_Calendar.json`. Only such a folder opens; “New calendar” on the start card adds the file to a folder (see [Shell](ui/Shell.md#start-card)).
- The app reads and writes only the files listed below. Other files in the folder are ignored.
- File names are fixed.
- The format is English: file names, headings, `#Key` lines, labels and fixed values (`yes`). Only the user's own content (titles, notes, names, tag names) is written as the user enters it.

| File | Content | Written by the app |
|---|---|---|
| `Calendar.md` | The whole calendar: entries, multi-day entries, recurring entries. | yes |
| `Backlog.md` | Backlog groups and their entries. | yes |
| `Contacts.md` | Contacts. | yes |
| `Holidays.md` | Public holidays and school vacations. | no |
| `Config.md` | Tags with colors and icons. Optional; created and maintained by hand. | no |
| `MD_Calendar.json` | Technical data of the folder, see [below](#md_calendarjson). Mandatory. | yes |
| `MD_Calendar.key.json` | The key of the Google service account for the [synchronization](Domain.md#synchronization-with-google), see [below](#md_calendarkeyjson). Optional. | yes, only in the setup |

## MD_Calendar.json

Technical data that does not belong in Markdown. The app writes it when a folder opens, after each save and during a synchronization; the calendar never depends on its content, only the synchronization does.

```json
{
  "format": 1,
  "devices": {
    "6f1c2a9e-…": {
      "name": "Windows",
      "path": "N:\\Calendar",
      "lastOpened": "2026-11-16T09:12:04Z",
      "lastSaved": "2026-11-16T09:30:00Z"
    }
  },
  "files": {
    "Calendar.md": { "hash": "sha256-4f2a…", "savedAt": "2026-11-16T09:30:00Z", "savedBy": "6f1c2a9e-…" }
  },
  "sync": {
    "calendarId": "c_1a2b…@group.calendar.google.com",
    "syncToken": "CPjQ…",
    "last": {
      "at": "2026-11-16T09:41:12Z",
      "by": "6f1c2a9e-…",
      "toGoogle": 5, "toCalendar": 3, "skipped": 1, "failed": 0
    },
    "checked": { "at": "2026-11-17T08:05:40Z", "by": "6f1c2a9e-…", "differences": 2 },
    "items": {
      "k3v9q2ab": {
        "kind": "entry",
        "etag": "\"3511…\"",
        "calendar": { "date": "9c1d…", "time": "07aa…", "title": "e41b…", "location": "51f0…", "note": "0000…", "tag": "b7c2…" }
      }
    },
    "open": ["p9a0d2kc"],
    "journal": null
  }
}
```

| Field | Meaning |
|---|---|
| `format` | Version of this layout. An app that finds a higher number leaves the file untouched. |
| `devices` | One entry per device, keyed by a random ID that each browser creates once and keeps in `localStorage`. `name` is set from the platform on first use and may be changed by hand. `path` is optional and entered by hand: the browser never learns the folder path. `lastOpened` and `lastSaved` are written by the app. |
| `files` | One entry per file the app saved: SHA-256 of the content as written (`hash`), when (`savedAt`) and by which device (`savedBy`). |
| `devices.*.lastSynced` | When this device last completed a synchronization. |
| `sync` | Present once the synchronization is set up. |
| `sync.calendarId` | ID of the dedicated Google calendar. Setting up another calendar starts over: its token, items and last synchronization are dropped. |
| `sync.syncToken` | Google's sync token of the last query; the next query returns only what changed since. Absent before the first synchronization and after Google rejected it. |
| `sync.last` | The last completed synchronization: when, by which device and its counts. A check alone never changes it. |
| `sync.checked` | The last check: when, by which device and how many differences it found. Absent before the first check. |
| `sync.items` | The state of the last synchronization, one entry per sync ID: the kind (`entry`, `series`, `multi-day`, `day-off`), the ETag of the Google event, and per synchronized field a fingerprint of its value: the 53-bit hash of MD_Libs `core/history` (`fingerprint`) of the normalized value, in hexadecimal. `calendar` is the state both sides had; `google` is present only after “Ignore” and holds the Google state recorded as seen. A series has the fields `start`, `rule`, `except`; a multi-day entry or day off `start` and `end`. |
| `sync.open` | IDs of Google events whose differences were left open; the next synchronization reads them again, because the sync token no longer returns them. Absent when nothing is open. |
| `sync.journal` | `null`, or the plan of a synchronization being applied, see [Architecture](Architecture.md#journal). It holds the target state of each operation, including titles and notes, until the synchronization is complete. |

- Times are UTC in ISO 8601 without milliseconds.
- `sync.items` holds fingerprints only, never titles, notes or other content; the key never appears in this file.
- The app writes two-space indentation with known keys in the order above, devices, files and sync items sorted by key, and a final line break.
- Fields the app does not know are kept.
- An unreadable file is recreated with a warning; a missing one while the folder is open is recreated silently. The synchronization then has to be set up again; its comparison treats every item as described in [Domain](Domain.md#comparison).

## MD_Calendar.key.json

The JSON key of the Google service account, exactly as Google Cloud delivers it. The app writes it unchanged in the setup step of the [sync dialog](ui/Shell.md#sync-dialog), replaces it the same way, and otherwise only reads `client_email` and `private_key`. It is a permanent credential for the dedicated Google calendar: whoever can read the folder can change that calendar. It never appears in notifications, error details or `MD_Calendar.json`.

## Rules for the calendar file

- One file holds the whole calendar, all years included. It is loaded completely at startup.
- The file is created when the first entry is created.
- Moving an entry between the calendar and the backlog writes two files: the target first, then the source. A failure in between leaves a duplicate, never a loss.

## Entry identity

Entries carry no hidden markers, so the files stay readable. Two IDs are visible in the text: a series gets a readable `#Id` when one of its occurrences is placed by hand (see [Calendar](#calendar)), and a synchronized item carries its [sync ID](#sync-ids). Apart from the synchronization, which recognizes items only by their sync ID, an entry that has to be found again, for example when merging after a conflict, is identified by its date, title and position in the day list. When that is ambiguous, the user decides.

## Sync IDs

Every item synchronized with Google carries the ID of its Google event (see [Domain](Domain.md#comparison)).

- A day entry ends with `{sync=<id>}` after its optional tag: `- [ ] 09:30 - 10:15 Dentist #Private {sync=k3v9q2ab}`. The pattern is recognized only at the end of the entry line, separated by a space; elsewhere it stays part of the title. A backlog entry keeps it while its removal from Google is open.
- A multi-day or recurring entry has a `#Sync` block with one list item holding the ID, written after `#Id` and before `#Start`.
- An ID consists of `a`–`v` and `0`–`9`. Items created by the app get 8 characters chosen at random by the app; events created in Google keep their Google ID, which may be longer.
- An ID used more than once within a file is reported when the file is read and kept as written; the synchronization uses it only for the first item and treats the others as items without an ID. The synchronization also reports an ID found in both `Calendar.md` and `Backlog.md`.

## Parsing and serialization

- Parsing is line-based and tolerant. Unknown or malformed lines are reported and preserved on save; they are never dropped. Files may be edited by hand, also on a phone.
- Serialization is lossless for everything the parser understands. Months and days are written in chronological order.
- Each file type has a golden file in `data/parsing/`. The golden files define the format (see [AGENTS.md](../AGENTS.md#data)); the rules below explain them.

## Golden files

| File | Golden file |
|---|---|
| Calendar | [`data/parsing/Calendar.md`](../data/parsing/Calendar.md) |
| Backlog | [`data/parsing/Backlog.md`](../data/parsing/Backlog.md) |
| Contacts | [`data/parsing/Contacts.md`](../data/parsing/Contacts.md) |
| Holidays and school vacations | [`data/parsing/Holidays.md`](../data/parsing/Holidays.md) |
| Configuration | [`data/parsing/Config.md`](../data/parsing/Config.md) |

The conventions follow MD_Manager: headings structure the file, `#Key` lines start metadata blocks, list items hold values, free text below `#Note` holds a note.

### Calendar

- `# Calendar`, then one `## <Month> <YYYY>` per month with entries (English month names, chronological), then `## Multi-day` and `## Recurring`. Empty months and days are not written.
- `### DD.MM.YYYY` starts a day (date format in [Domain](Domain.md#time)). The order of its items is the entry position.
- `- @<id>` in a day is the position of an occurrence placed by hand (see [Domain](Domain.md#day-list-order)): the occurrence of the series with that `#Id` stands where the line stands among the entries. The line carries nothing else; title, time, done state and the rest stay in the series. At most one per series and day, written only for days where an occurrence was placed. A reference to an ID of no series, to a day without an occurrence of that series, or repeated in one day is reported and kept as an unknown line. Older versions of the app keep the line as an unknown line.
- An entry is `- [ ]` or `- [x]`, an optional time (`HH:MM` or `HH:MM - HH:MM`), the title, an optional `#Tag` and an optional [sync ID](#sync-ids) `{sync=<id>}` at the end of the line.
- Indented lines below an entry: `- Location: …` as the first one is the location; every other one is a note line, kept exactly as written after its indentation (up to two spaces or one tab). The note is free text: a line the user starts with “- ” is written as `  - …`, any other line as `  …`. A blank line inside a note is an empty line of the note and is written as an empty line; blank lines before or after the note are not part of it.
- A trailing `#Word` on the entry line is the tag; a time is recognized only when it is valid (`00:00` to `23:59`).
- An entry with the tag `#DayOff` and a time is reported when the file is read; the time is dropped and the entry is written without it on the next save (see [Domain](Domain.md#tags)).
- Days are written under the month of their date, whatever heading they stood under; repeated headings of the same day are merged in file order. A day heading with an invalid date (`31.02.2026`) is not a day.
- An unknown or malformed line is kept right after the element it followed (file heading, day heading or entry) and moves with it.
- Line endings follow the first line ending of the file.
- An item of `## Multi-day` or `## Recurring` that cannot be understood (a missing or invalid `#Start`, `#End` or `#Repeat`, an end before the start, a rule outside the allowed subset) is reported and written back verbatim. Unknown `#Key` blocks inside an understood item are reported and kept at its end.
- `#Repeat` is written in a fixed order: `FREQ`, `INTERVAL` (only above 1), `BYDAY`, `BYMONTHDAY`, `UNTIL`. `#Except` and `#Done` keep their order; dates added by the app are inserted in chronological order.
- A multi-day entry is a `###` heading with the title and an optional `#Tag`, followed by an optional `#Sync`, `#Start` and `#End` with one date each and optionally `#Location` and `#Note`. Multi-day entries are written ordered by start date; equal start dates keep their stored order, and items that cannot be understood follow in their stored order.
- A recurring entry is a `###` heading with the title and an optional `#Tag`, followed by an optional `#Id`, an optional `#Sync`, `#Start` (date, optional time or time range), `#Repeat` (one `RRULE` within the rules of [Domain](Domain.md#recurring-entry); its `UNTIL` keeps the RFC 5545 form `YYYYMMDD` so that ICS stays lossless) and optionally `#Except`, `#Done`, `#Location` and `#Note`.
- `#Id` holds one ID without spaces. The app creates it when an occurrence of the series is placed by hand for the first time: the title in lowercase ASCII, `ä ö ü ß` as `ae oe ue ss`, other accented letters without their accent, every other run of characters as one `-`, `series` when nothing is left, and `-2`, `-3`, … while the ID is taken. It never changes afterwards, also not on rename. Of two series with the same ID the second is reported; references resolve to the first.

### Backlog

- Entry lines are those of `Calendar.md`, including the [sync ID](#sync-ids), except that the backlog has no times: a time at the start of the line is part of the title and is written back as it stands.
- Entries directly below `# Backlog`, before the first `##` heading, are ungrouped. Without ungrouped entries the file has no such lines.
- Each `##` heading is a group in display order; its name is a tag (see [Domain](Domain.md#backlog)). Empty groups are kept. A `## Inbox` group from earlier versions is read as ungrouped entries; its unknown lines move after the file heading.
- Entries use the same syntax as day entries. Unknown lines are reported and kept after the element they followed, as in the calendar file.

### Contacts

- `## Contacts` holds one `###` heading per contact.
- The heading is the display name. It is derived from `#FirstName` and `#LastName` and rewritten on save. A contact without `#FirstName` and `#LastName` takes its name from the heading (first word: first name, rest: last name); a contact without any name is written as `### Unnamed`.
- Blocks: `#FirstName`, `#LastName`, `#Birthday`, `#Phone`, `#Email`, `#Address`, `#Anniversary`, `#Note`. Absent blocks are not written.
- Phone numbers, email addresses and addresses are `Label: value` with the labels `Mobile`, `Home`, `Work` and `Other`; anniversaries are `Label: DD.MM.YYYY`. A birthday without a year is written as `DD.MM.`.
- `## Contacts` is always written. A `## Groups` section and the blocks `#Nickname`, `#Company`, `#Position`, `#Groups` and `#Favorite` from earlier versions are read without a warning and dropped on the next save. Unknown `#Key` blocks and lines that cannot be read are reported and kept at the end of their contact; unknown lines outside a contact are kept after the file heading.

### Holidays and school vacations

- `## Holidays` lists `DD.MM.YYYY Name`, `## School vacations` lists `DD.MM.YYYY - DD.MM.YYYY Name`. The file is generated outside the app (see [Decisions](Decisions.md#d13--holiday-data-generated-outside-the-app)) and only read; lines that cannot be read are reported and skipped. Names are German, as delivered by the generator.

### Configuration

- The user creates the file by hand when tags are wanted; the app only reads it. Without the file there are no tags.
- `## Tags` lists `Name: #rrggbb icon-id`. The icon ID is the file name of a tag icon without `.svg`. Lines that cannot be read are reported and skipped. The entry dialog offers the tags in alphabetical order.
- A tag used by an entry but missing in `Config.md` is kept in the data; the entry is shown without color.
