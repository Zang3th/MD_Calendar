# Domain

The business model and its rules. How the model is stored is described in [DataFormat](DataFormat.md); how it is presented is described in [UI](ui/Views.md).

## Time

- All dates and times are local time. There are no time zones. Only the [synchronization with Google](#synchronization-with-google) converts times, using the time zone of the Google calendar.
- An all-day value is a plain date, never a point in time.
- Dates are written as `DD.MM.YYYY` everywhere: in the data files, in the UI and in inputs. A date without a year (a birthday) is `DD.MM.` in the files and `DD.MM` in the UI. The holiday overview is the exception and writes `DD.MM.YY` (see [Views](ui/Views.md#holiday-overview)).
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
- A time places an entry when it lands on a day and places occurrences of recurring entries until they are placed by hand (see [Day list order](#day-list-order)).

## Multi-day entry

- Has a title, a start date, an end date and optionally a location, a note and a tag. It has no time and no recurrence.
- Is not part of any day list and cannot be checked off.

## Day list order

- The **time slot** of a start time, judged on the day as shown: directly before the first entry or occurrence with a later start time; when none starts later, directly after the last one with a time; when none has a time, first. Entries and occurrences without a time do not count. Placed occurrences keep their place, so a timed entry sorts in among them: after an 18:30 placed occurrence, a 19:00 entry goes behind it whatever its position when pasted.
- A normal entry with a time goes into its time slot when it is created, pasted or imported, when it moves to another day (in the dialog or by dragging it in from another day or the backlog) and when its start time changes. A new entry without a time goes to the end of the day; a pasted one goes to the pointer's position: before the first entry shown whose middle lies below the pointer, otherwise to the end. One dragged in lands where it is dropped.
- After that, normal entries keep their stored order and are freely sortable: dragging within a day puts an entry exactly where it is dropped, and other edits keep its place.
- An occurrence of a recurring entry sits in its time slot among the normal entries until it is **placed** by hand: dragging an occurrence within its day places every occurrence of that day exactly as dropped (those hidden behind “+N” in the month where they are shown), and the occurrence stays part of its series. A placed occurrence stays directly before the normal entry that followed it when entries are added, edited, moved or deleted, unless a timed entry takes its time slot between them; dragging a normal entry past it puts the entry where it is dropped. Dragging a normal entry past an occurrence that is not placed places every occurrence of that day as dropped, so that the entry also stays where it is dropped.
- Occurrences that are not placed: those without a time, and all of a day whose normal entries have no time, come first; others take their time slot. Occurrences that land in the same place are ordered by time, then by title; placed ones come before them, in their order.
- A placement is dropped in the same step when its occurrence goes away: the occurrence is deleted, the series ends before that day or is deleted, or its start date or rule no longer hits that day. A new start time or title keeps every placement.

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

Single occurrences cannot be moved to another day or renamed; within their day they can be placed (see [Day list order](#day-list-order)).

- “End series here” sets `UNTIL` to the date of the chosen occurrence; it stays the last one.
- A whole series can be deleted.
- Deleting an occurrence also removes its done mark.
- Occurrences are computed per day and cached until a series changes.

## Converting entries

An entry, a recurring entry and a multi-day entry can be turned into each other in the entry dialog. Title, location, note, tag and preserved lines are kept. What the new kind cannot hold is dropped: the done state of an entry, exceptions and done dates of a series, the time and rule when switching to a multi-day entry. A series or multi-day entry becomes an entry on its start date.

## Backlog

- The backlog holds entries without a date: same fields as an entry except date, time and position. An entry that arrives in the backlog (dragged, pasted, moved or created there in the entry dialog) loses its time; scheduling it again sets no time.
- It holds **ungrouped** entries and ordered **groups**. Ungrouped entries belong to the backlog itself and come before all groups; they are the untagged entries and the target for quick capture from outside the app. Every group is a tag: the tag decides the group. An entry with a tag that arrives from outside the backlog (dragged from a day, pasted, given “Backlog” as its date, created) goes into the group of its tag, created at the end when missing, at the dropped position only when that lies in this group. Inside the backlog, moving an entry into another group gives it that group’s tag, moving it to the ungrouped entries removes its tag, and reordering within a group never changes a tag; an untagged entry dropped into a group takes the group’s tag. Groups are not created by hand: tags come from `Config.md` and the entries.
- A backlog entry cannot be done: only a day can be done, so the backlog shows no check box and `Space` leaves its entries alone. A done state in `Backlog.md` is kept as it stands.
- Scheduling a backlog entry **moves** it into a day. An entry can move from a day back into the ungrouped entries or any backlog group.
- Entries can be reordered and moved between the ungrouped entries and the groups. Groups can be reordered; the ungrouped entries always come first.

## Tags

- Tags are defined by hand in `Config.md`, each with a color and an icon ID; the app does not create or edit tags. The icon ID names one of the tag icons (see [Design System](ui/DesignSystem.md#tag-icons)).
- An unknown or missing icon ID is an error. It is reported when `Config.md` is read, through the [notifications](Architecture.md#notifications) with the code `MDC-301`; the tag keeps its color and shows no icon.
- The tag named “Vacation” marks vacations: its entries and multi-day entries are listed in the [holiday overview](ui/Views.md#holiday-overview).
- The tag named “DayOff” marks days off, for example to reduce overtime. Days off are kept by hand in `Calendar.md`; the app only shows them. A day off covers whole days and never has a time: in the entry dialog the tag rules out the time, and a day off with a time in the file is reported when it is read and loses its time on the next save (see [DataFormat](DataFormat.md#calendar)). Its entries and multi-day entries are listed together with the vacations in the [holiday overview](ui/Views.md#holiday-overview), marked as days off. Its entries show no tile in the day list; instead their day gets a day-off badge (see [Views](ui/Views.md#day-header)), and they are left out of selections. Multi-day entries with this tag keep their bar and add no badge.
- An entry has at most one tag. Without a tag it has no color and no icon.

## Contact

| Field | Rule |
|---|---|
| First name, last name | The display name is first name plus last name. A contact without both shows “No name”. |
| Birthday | Optional; the year is optional. |
| Phone numbers | Any number, each with a label (for example Mobile, Home, Work). |
| Email addresses | Any number, each with a label. |
| Addresses | Any number, each with a label. |
| Anniversaries | Any number, each with a label and a date. |
| Note | Optional free text. |

- Contacts have no photos; the list and the detail show initials avatars.
- Phone numbers, email addresses and addresses carry one of the labels Mobile (phone only), Home, Work and Other; a label from a hand-edited file is kept.

## Birthdays and anniversaries

- They are derived from contacts and are never stored as calendar data.
- A birthday shows the age the contact turns, if the birth year is known. An anniversary shows the number of years.
- A birthday or anniversary on 29 February shows on 28 February in years without 29 February.
- They are shown with the first and last name of the contact.
- They cannot be checked off.

## Holidays and school vacations

- A holiday has a date and a name. A school vacation has a date range and a name. Both cover North Rhine-Westphalia.
- Holidays appear in the calendar; school vacations do not. Both are listed in the holiday overview (see [Views](ui/Views.md#holiday-overview)).
- Both are read-only in the app and cannot be checked off.
- Their data is produced outside the app. The generator is not part of this repository.

## Search

- The search covers the whole calendar and the backlog: entries, recurring entries, multi-day entries and backlog entries, by title, location, note and tag.
- It is the fuzzy search of MD_Manager (MD_Libs `core/search`): the letters of a word must appear in order, so letters may be missing (“dntst” finds “Dentist”). Case and diacritics are ignored (“muller” finds “Müller”). Every word of the query must match.
- Hits in the title rank before hits elsewhere; contiguous letters, word starts and shorter texts rank higher; equally good hits closer to today come first.
- A hit on a recurring entry leads to its next occurrence from today on.

## Selection, copy and paste

- Several entries and occurrences can be selected together. A selection can be checked off, copied, cut, deleted and dragged as one undoable action.
- Checking off a selection marks all of it done; when all of it is done already, it marks all of it open.
- Copying keeps the entries in an app-internal clipboard. Pasting inserts copies into a day like new entries (see [Day list order](#day-list-order)); copies are open. A copied occurrence becomes a normal entry with the fields of its series.
- Cutting copies the selection and deletes it; undoing the cut restores the entries, the clipboard keeps them.
- Deleting an occurrence in a selection deletes that occurrence only.

## Imports and exports

| Source | Behavior |
|---|---|
| Google Calendar history (`.ics`) | Imported once at cutover into the calendar file. |
| Dedicated Google calendar | Synchronized on request, see [Synchronization with Google](#synchronization-with-google). |
| Invitation (`.ics`) | Imported the same way; usually one entry. |
| Contacts (vCard) | Imported repeatedly; existing contacts are detected as duplicates and merged. |
| Contacts (vCard) | Exported per contact and as the whole list. |

### ICS import

- An event on one day becomes an entry with its time; an event over several days becomes a multi-day entry without time.
- An event with a rule inside the allowed subset (see [Recurring entry](#recurring-entry)) becomes a series. `COUNT` becomes the date of the last occurrence; `EXDATE` and moved instances (`RECURRENCE-ID`) become exceptions, moved instances are imported as entries. An event with any other rule is imported as one entry on its start date.
- Entries before today are imported as done, so that the history does not show as overdue.
- Summary, location and description become title, location and note (blank lines inside the description stay, those around it are dropped). Cancelled events are skipped.
- An event that already exists with the same title on the same date (series: start; multi-day entries: range) is skipped, so that importing a file twice adds nothing.
- Times in UTC are converted to local time; times with a time zone are taken as local time.
- The import is one undoable action.

### vCard import and export

- A contact matches an existing one when the name, a phone number or an email address is the same. A match is merged: values the existing contact lacks are added, nothing is overwritten. All other contacts are added.
- The import is one undoable action; a notification reports how many contacts were added and merged.
- Export writes vCard 3.0. Labels map to `TYPE` values (Mobile `CELL`, Home `HOME`, Work `WORK`); anniversaries are written as `X-ABDATE` with `X-ABLabel`.

## Synchronization with Google

The calendar can be synchronized with one dedicated Google calendar, so that timed entries are available on the phone. Synchronization runs only when the user starts it in the [sync dialog](ui/Shell.md#sync-dialog); nothing happens automatically, in the background or on a timer. How it is carried out is described in [Architecture](Architecture.md#synchronization-with-google), how links are stored in [DataFormat](DataFormat.md#sync-ids).

### What is synchronized

| Local item | Google | Direction |
|---|---|---|
| Entry with a time | Event with a time | both |
| Recurring entry with a time | Recurring event | calendar → Google |
| Multi-day entry | All-day event over its dates | calendar → Google |
| Entry or multi-day entry with the tag “DayOff” | All-day event on its day or days | calendar → Google |

- Only items from the cutover date **23.11.2026** onward are synchronized; a series counts when it has an occurrence from that date on. There is no end date.
- Entries without a time, recurring entries without a time, backlog entries, contacts, birthdays and holidays are not synchronized.
- Of Google, only the dedicated calendar is read and written; the primary calendar is never touched.
- Not imported from Google, shown as a note in the merge view: events with a time that span several days, all-day events created in Google, and recurring events created in Google.

### Field mapping

| Calendar | Google event |
|---|---|
| Title | Summary |
| Date, start and end time | Start and end as local times in the time zone of the Google calendar, read on each synchronization. An event created in another time zone arrives converted (09:00 in New York becomes 15:00). |
| No end time | End equal to the start. Reading back, an end equal to the start becomes no end time. |
| Location | Location |
| Note | Description |
| Tag | The Google event color closest to the tag's color in `Config.md` and the tag name as a private extended property. Reading back, the property gives the tag; an event without it gets the tag whose Google color it has when exactly one tag maps to that color, otherwise no tag. A tag missing in `Config.md` keeps its name in the property and is written without a color. |
| Done state | Not synchronized. Entries from Google arrive open; a done entry stays done when Google changes another field. |
| `#Repeat`, end of the series, `#Except` | Recurrence rule with `UNTIL`, removed occurrences (`EXDATE`). Done dates and placed occurrences stay local. |
| Multi-day entry | All-day event from `#Start` to `#End`, with title, location, note, color and tag. |

Of every Google event only title, start, end, location, description, color, recurrence and the app's own extended properties are read and written; attendees, attachments, reminders, conference links and every other field are kept as Google has them.

### Comparison

Every synchronized item carries a [sync ID](DataFormat.md#sync-ids), the ID of its Google event; items are recognized by this ID only, never by title or date. The state of the last synchronization is kept per ID, so each difference is classified as one of the cases below. Each case has a preselected choice in the merge view:

| Case | Preselected |
|---|---|
| New locally / new in Google | Copy to the other side |
| Changed only locally / only in Google | Copy to the other side |
| Locally moved into the backlog, time removed, or moved before the cutover date | Remove from Google |
| Conflict: changed on both sides | Nothing: take Google, combine per field, or keep local |
| Deleted on one side | Nothing |
| Left the range in Google (became an all-day event, moved before the cutover date) | Nothing; offered as deletion of the local entry |
| A series or all-day export changed or deleted in Google | Nothing: keep local (Google is set back or created again) or ignore |
| Cannot be imported | Note only |

- A conflict can be combined (the title from local, the time from Google): each field comes from the side that changed it. This is offered only when no field changed on both sides.
- Deletions are never preselected; the user confirms each one or all at once. Removing an event from Google because its entry left the range locally is preselected, because the entry still exists locally.
- Applying a deletion or removal drops the sync ID from the local item, which stays where it is (in the backlog, without time, before the cutover date).
- A difference left unselected is skipped: its state of the last synchronization stays, so it appears again on the next run. “Ignore” records the current Google state as seen, so the difference appears again only after the next change in Google.
- An item whose state of the last synchronization is missing (for example after `MD_Calendar.json` was recreated) is compared directly: equal sides are recorded as synchronized, different ones are a conflict.
- Changing the kind of a synchronized item (an entry into a series, the tag “DayOff” set on an entry) is a local change of that item; its event keeps its ID.
- When no local item changed since the last synchronization, only Google is queried for changes.

### Applying

- Synchronization starts only from the saved state; unsaved changes are saved first (“Save and continue”).
- All local changes of one synchronization are one undo action, “Sync with Google (N changes)”. Undoing it later is an ordinary local change that the next synchronization offers for Google.
- Each difference is applied as its own unit: it is either completely synchronized or left unchanged. A cancellation stops after the running difference; what is done stays done and is saved.
- An event changed in Google after the check is not overwritten; its difference stays open.
- Copying, pasting, duplicating and importing never copy a sync ID, and the entry dialog does not show it.
