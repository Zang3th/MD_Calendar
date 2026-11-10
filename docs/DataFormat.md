# Data Format

How the [domain](Domain.md) is stored. Markdown files in one folder are the only persistent data.

## Calendar folder

- The user selects one folder. A sync client keeps it in sync; the intended setup is Google Drive for desktop in mirror mode (or with the folder available offline).
- The app reads and writes only the files listed below. Other files in the folder are ignored.
- File names are fixed.
- The format is English: file names, headings, `#Key` lines, labels and fixed values (`yes`, `Inbox`). Only the user's own content (titles, notes, names, tag and group names) is written as the user enters it.

| File | Content | Written by the app |
|---|---|---|
| `Calendar.md` | The whole calendar: entries, multi-day entries, recurring entries. | yes |
| `Backlog.md` | Backlog groups and their entries. | yes |
| `Contacts.md` | Contacts and contact groups. | yes |
| `Holidays.md` | Public holidays and school vacations. | no |
| `Config.md` | Tags with colors and icons. Optional; created and maintained by hand. | no |

## Rules for the calendar file

- One file holds the whole calendar, all years included. It is loaded completely at startup.
- The file is created when the first entry is created.
- Moving an entry between the calendar and the backlog writes two files: the target first, then the source. A failure in between leaves a duplicate, never a loss.

## Entry identity

Entries carry no IDs or hidden markers, so the files stay readable. Where an entry has to be found again, for example when merging after a conflict, it is identified by its date, title and position in the day list. When that is ambiguous, the user decides.

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
- An entry is `- [ ]` or `- [x]`, an optional time (`HH:MM` or `HH:MM - HH:MM`), the title and an optional `#Tag` at the end of the line.
- Indented items below an entry: `Location: …` as the first item is the location, every other item is a note line.
- A trailing `#Word` on the entry line is the tag; a time is recognized only when it is valid (`00:00` to `23:59`).
- Days are written under the month of their date, whatever heading they stood under; repeated headings of the same day are merged in file order. A day heading with an invalid date (`31.02.2026`) is not a day.
- An unknown or malformed line is kept right after the element it followed (file heading, day heading or entry) and moves with it.
- Line endings follow the first line ending of the file.
- An item of `## Multi-day` or `## Recurring` that cannot be understood (a missing or invalid `#Start`, `#End` or `#Repeat`, an end before the start, a rule outside the allowed subset) is reported and written back verbatim. Unknown `#Key` blocks inside an understood item are reported and kept at its end.
- `#Repeat` is written in a fixed order: `FREQ`, `INTERVAL` (only above 1), `BYDAY`, `BYMONTHDAY`, `UNTIL`. `#Except` and `#Done` keep their order; dates added by the app are inserted in chronological order.
- A multi-day entry is a `###` heading with the title and an optional `#Tag`, followed by `#Start` and `#End` with one date each and optionally `#Location` and `#Note`. Multi-day entries are written ordered by start date; equal start dates keep their stored order.
- A recurring entry is a `###` heading with the title and an optional `#Tag`, followed by `#Start` (date, optional time or time range), `#Repeat` (one `RRULE` within the rules of [Domain](Domain.md#recurring-entry); its `UNTIL` keeps the RFC 5545 form `YYYYMMDD` so that ICS stays lossless) and optionally `#Except`, `#Done`, `#Location` and `#Note`.

### Backlog

- Each `##` heading is a group in display order. `Inbox` always exists; a file without it gets it as the first group. Empty groups are kept.
- Entries use the same syntax as day entries. Unknown lines are reported and kept after the element they followed, as in the calendar file.

### Contacts

- `## Groups` lists the contact groups in display order. `## Contacts` holds one `###` heading per contact.
- The heading is the display name. It is derived from `#FirstName` and `#LastName` and rewritten on save. A contact without `#FirstName` and `#LastName` takes its name from the heading (first word: first name, rest: last name); a contact without any name is written as `### Unnamed`.
- Blocks: `#FirstName`, `#LastName`, `#Nickname`, `#Birthday`, `#Phone`, `#Email`, `#Address`, `#Company`, `#Position`, `#Groups`, `#Anniversary`, `#Favorite` (`yes`), `#Note`. Absent blocks are not written.
- Phone numbers, email addresses and addresses are `Label: value` with the labels `Mobile`, `Home`, `Work` and `Other`; anniversaries are `Label: DD.MM.YYYY`. A birthday without a year is written as `DD.MM.`.
- `## Groups` and `## Contacts` are always written. Unknown `#Key` blocks and lines that cannot be read are reported and kept at the end of their contact; unknown lines outside a contact are kept after the file heading.

### Holidays and school vacations

- `## Holidays` lists `DD.MM.YYYY Name`, `## School vacations` lists `DD.MM.YYYY - DD.MM.YYYY Name`. The file is generated outside the app (see [Decisions](Decisions.md#d13--holiday-data-generated-outside-the-app)) and only read; lines that cannot be read are reported and skipped. Names are German, as delivered by the generator.

### Configuration

- The user creates the file by hand when tags are wanted; the app only reads it. Without the file there are no tags.
- `## Tags` lists `Name: #rrggbb icon-id`. The icon ID is the file name of a tag icon without `.svg`. Lines that cannot be read are reported and skipped. The entry dialog offers the tags in alphabetical order.
- A tag used by an entry but missing in `Config.md` is kept in the data; the entry is shown without color.
