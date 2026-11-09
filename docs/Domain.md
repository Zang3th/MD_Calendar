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

## Backlog

- The backlog holds entries without a date: same fields as an entry except date and position.
- It is divided into ordered **groups**. The group **Inbox** always exists and is the target for quick capture from outside the app.
- Scheduling a backlog entry **moves** it into a day. An entry can move from a day back into any backlog group.
- Entries can be reordered and moved between groups.

## Tags

- Tags are defined by hand in `Config.md`, each with a color and an icon ID; the app does not create or edit tags. The icon ID names one of the tag icons (see [Design System](ui/DesignSystem.md#tag-icons)).
- An unknown icon ID is an error. It is reported at startup through the [notifications](Architecture.md#notifications) with an `MDC-` error code.
- An entry has at most one tag. Without a tag it has no color and no icon.

## Contact

| Field | Rule |
|---|---|
| First name, last name | The display name is first name plus last name. |
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

## Birthdays and anniversaries

- They are derived from contacts and are never stored as calendar data.
- A birthday shows the age the contact turns, if the birth year is known.
- They cannot be checked off.

## Holidays and school vacations

- A holiday has a date and a name. A school vacation has a date range and a name. Both cover North Rhine-Westphalia.
- Holidays appear in the calendar; school vacations do not. Both are listed in the holiday overview (see [Views](ui/Views.md#holiday-overview)).
- Both are read-only in the app and cannot be checked off.
- Their data is produced outside the app. The generator is not part of this repository.

## Imports and exports

| Source | Behavior |
|---|---|
| Google Calendar history (`.ics`) | Imported once at cutover into the calendar file. |
| Invitation (`.ics`) | Imported as a single entry. |
| Contacts (vCard) | Imported repeatedly; existing contacts are detected as duplicates. |
| Contact (vCard) | Exported per contact. |
