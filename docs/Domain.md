# Domain

The business model and its rules. How the model is stored is described in [DataFormat](DataFormat.md); how it is presented is described in [UI](ui/Views.md).

## Time

- All dates and times are local time. There are no time zones.
- An all-day value is a plain date, never a point in time.
- Dates are written as `DD.MM.YYYY` everywhere: in the data files, in the UI and in inputs. A date without a year (a birthday) is `DD.MM.`.
- Weeks start on Monday. Week numbers follow ISO 8601.

## Entry

An entry belongs to one day of the calendar.

| Field | Rule |
|---|---|
| Title | Required. |
| Date | The day the entry belongs to. |
| Position | Its place within the day's list. |
| Done | Done or open. |
| Time | Optional start time, optional end time. |
| Location | Optional. |
| Note | Optional free text. |
| Tag | Zero or one tag (see [Tags](#tags)). |

- All entries can be edited, including entries on past days.
- An **open entry on a past day is overdue**. It stays on its day and is highlighted. It is never moved automatically.
- Occurrences of recurring entries are never overdue.
- A time does not influence the order within the day.

## Multi-day entry

- Has a title, a start date, an end date and optionally a location, a note and a tag. It has no time and no recurrence.
- Is not part of any day list and cannot be checked off.

## Day list order

Within one day the order is fixed by kind:

1. Occurrences of recurring entries, ordered by time, then by title. Not sortable.
2. Normal entries in their stored order. Freely sortable.

Birthdays, anniversaries and holidays are not list items; they belong to the day itself.

## Recurring entry

A recurring entry is an entry with a rule. Its occurrences are computed for the visible period.

Allowed rules (a subset of RFC 5545 `RRULE`, so that ICS import and export stay lossless):

- daily, weekly on selected weekdays, yearly — each with an interval
- monthly on a day of the month (for example the 15th)
- monthly on a position (for example the second Tuesday or the last Friday)

Rules have no end when created. Actions on a series:

| Action | Effect |
|---|---|
| End series from here | Sets an end date (`UNTIL`). Past occurrences stay visible. |
| Delete one occurrence | Adds an exception date (`EXDATE`). |
| Check off one occurrence | Records the date as done for this series. |

Single occurrences cannot be moved or renamed.

- „End series from here“ sets `UNTIL` to the date of the chosen occurrence; it stays the last one.
- A whole series can be deleted.
- Deleting an occurrence also removes its done mark.
- Occurrences are computed per day and cached until a series changes.

## Converting entries

An entry, a recurring entry and a multi-day entry can be turned into each other in the entry dialog. Title, location, note, tag and preserved lines are kept. What the new kind cannot hold is dropped: the done state of an entry, exceptions and done dates of a series, the time and rule when switching to a multi-day entry. A series or multi-day entry becomes an entry on its start date.

## Backlog

- The backlog holds entries without a date: same fields as an entry except date and position.
- It is divided into ordered **groups**. The group **Inbox** always exists and is the target for quick capture from outside the app.
- Scheduling a backlog entry **moves** it into a day. An entry can move from a day back into any backlog group.
- Entries can be reordered and moved between groups.

## Tags

- Tags are defined by hand in `Config.md`, each with a color and an icon ID; the app does not create or edit tags. The icon ID names one of the tag icons (see [Design System](ui/DesignSystem.md#tag-icons)).
- An unknown or missing icon ID is an error. It is reported when `Config.md` is read, through the [notifications](Architecture.md#notifications) with the code `MDC-301`; the tag keeps its color and shows no icon.
- The tag named „Urlaub“ marks vacations: its entries and multi-day entries are listed in the [holiday overview](ui/Views.md#holiday-overview).
- An entry has at most one tag. Without a tag it has no color and no icon.

## Contact

| Field | Rule |
|---|---|
| First name, last name | The display name is first name plus last name. A contact without both shows „Ohne Namen“. |
| Nickname | Optional. |
| Birthday | Optional; the year is optional. |
| Phone numbers | Any number, each with a label (for example Mobile, Home, Work). |
| Email addresses | Any number, each with a label. |
| Addresses | Any number, each with a label. |
| Company, position | Optional. |
| Groups | Any number of the defined contact groups. |
| Anniversaries | Any number, each with a label and a date. |
| Note | Optional free text. |
| Favorite | Pinned to the top of the contact list. |

- Contacts have no photos; the list and the detail show initials avatars.
- Phone numbers, email addresses and addresses carry one of the labels Mobile (phone only), Home, Work and Other; a label from a hand-edited file is kept.

## Birthdays and anniversaries

- They are derived from contacts and are never stored as calendar data.
- A birthday shows the age the contact turns, if the birth year is known. An anniversary shows the number of years.
- A birthday or anniversary on 29 February shows on 28 February in years without 29 February.
- They are shown with the first and last name of the contact, never the nickname.
- They cannot be checked off.

## Holidays and school vacations

- A holiday has a date and a name. A school vacation has a date range and a name. Both cover North Rhine-Westphalia.
- Holidays appear in the calendar; school vacations do not. Both are listed in the holiday overview (see [Views](ui/Views.md#holiday-overview)).
- Both are read-only in the app and cannot be checked off.
- Their data is produced outside the app. The generator is not part of this repository.

## Search

- The search covers the whole calendar and the backlog: entries, recurring entries, multi-day entries and backlog entries, by title, location, note and tag.
- It is tolerant: case and diacritics are ignored („muller“ finds „Müller“), and letters of a word may be missing („zhnrzt“ finds „Zahnarzt“). Every word of the query must match.
- Hits in the title rank before hits elsewhere, matches at a word start before matches inside a word; equally good hits closer to today come first.
- A hit on a recurring entry leads to its next occurrence from today on.

## Selection, copy and paste

- Several entries and occurrences can be selected together. A selection can be checked off, copied, deleted and dragged as one undoable action.
- Checking off a selection marks all of it done; when all of it is done already, it marks all of it open.
- Copying keeps the entries in an app-internal clipboard. Pasting inserts copies at the end of a day; copies are open. A copied occurrence becomes a normal entry with the fields of its series.
- Deleting an occurrence in a selection deletes that occurrence only.

## Imports and exports

| Source | Behavior |
|---|---|
| Google Calendar history (`.ics`) | Imported once at cutover into the calendar file. |
| Invitation (`.ics`) | Imported the same way; usually one entry. |
| Contacts (vCard) | Imported repeatedly; existing contacts are detected as duplicates and merged. |
| Contacts (vCard) | Exported per contact and as the whole list. |

### ICS import

- An event on one day becomes an entry with its time; an event over several days becomes a multi-day entry without time.
- An event with a rule inside the allowed subset (see [Recurring entry](#recurring-entry)) becomes a series. `COUNT` becomes the date of the last occurrence; `EXDATE` and moved instances (`RECURRENCE-ID`) become exceptions, moved instances are imported as entries. An event with any other rule is imported as one entry on its start date.
- Entries before today are imported as done, so that the history does not show as overdue.
- Summary, location and description become title, location and note. Cancelled events are skipped.
- An event that already exists with the same title on the same date (series: start; multi-day entries: range) is skipped, so that importing a file twice adds nothing.
- Times in UTC are converted to local time; times with a time zone are taken as local time.
- The import is one undoable action.

### vCard import and export

- A contact matches an existing one when the name, a phone number or an email address is the same. A match is merged: values the existing contact lacks are added, nothing is overwritten. All other contacts are added.
- The import is one undoable action; a notification reports how many contacts were added and merged.
- Export writes vCard 3.0. Labels map to `TYPE` values (Mobile `CELL`, Home `HOME`, Work `WORK`); anniversaries are written as `X-ABDATE` with `X-ABLabel`. Groups and the favorite mark are not exported.
