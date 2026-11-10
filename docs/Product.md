# Product

MD_Calendar is a local-first calendar for a single user. It replaces Google Calendar as the primary calendar. All data lives in human-readable Markdown files in a folder that a sync client (Google Drive for desktop) keeps in sync.

## Core idea

The calendar is built around **ordered to-do lists per day**, not around timed appointments. Most entries are loose tasks whose order within the day matters. A time of day is an optional attribute of an entry, not its organizing principle.

Around the day lists sit:

- a **backlog** for spontaneous, not yet scheduled entries that move into a day and back,
- a **contact book with a full editor**, which is also the source of birthdays and anniversaries,
- read-only **public holidays and school vacations**.

## Problems it solves

| Problem with Google Calendar | Answer in MD_Calendar |
|---|---|
| The UI lacks quality-of-life features and keyboard shortcuts. | Own views for landscape and portrait monitors, keyboard-first operation, drag and drop, undo/redo. |
| Birthdays have not synchronized for about two years. | Birthdays are derived from the app's own contact book. |
| There is no backlog for entries that may come up spontaneously. | A grouped backlog that entries move into and out of. |

## Usage profile

- Primary use is on desktop, on monitors in landscape and portrait orientation.
- A typical day holds up to about twelve entries.
- Invitations from other people are rare; they are imported as `.ics` files.
- One computer writes the data. Mobile access is planned for a later phase (see [Mobile](Mobile.md)).

## Scope

In scope for the desktop releases up to the cutover (0.6.0):

- Week and month views for landscape and portrait, ordered day lists with drag and drop
- Entries with optional time, location, note and one tag; multi-day entries
- Recurring entries within a restricted rule set
- Backlog with groups
- Contact editor; birthdays and anniversaries in the calendar
- Public holidays and school vacations from a file
- Search and keyboard shortcuts
- Undo/redo and explicit saving
- One-time import of the complete Google Calendar history and import of single `.ics` invitations; vCard import and export

The ordered work packages are in the [Roadmap](Roadmap.md).

## Out of scope

- Reminders and notifications at entry time (permanently not needed)
- Sending invitations or sharing calendars with other people
- Synchronization with Google Calendar after the cutover
- Several computers writing at the same time (until the mobile phase)
- Time zones: everything is local time
- A time-grid view
- Natural-language input and automatic scheduling
- Subtasks: one note per entry is enough
- Automatically moving unfinished entries to the next day
- Generating holiday and vacation data inside the app

## Cutover

On a cutover date the complete Google Calendar history is imported once. Google Calendar then remains as a read-only archive.
