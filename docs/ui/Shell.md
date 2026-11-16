# Shell

The frame around all views: header, backlog panel, entry dialog and notifications. Visual values are defined in the [Design System](DesignSystem.md). The UI language is English; labels below are the exact UI texts.

## Page layout

- A floating glass **header pill** at the top, the **main panel** below it, both with a small gap to the window edge.
- There is no sidebar.

## Start card

While no folder is open, the main panel shows a centered card with the heading “Recent folders”, the list and the buttons “Open folder” and “New calendar”. Logo, name and version are shown only in the header, as in MD_Manager. The header shows the logo, “MD_Calendar”, the version label, help and the sound toggle; all controls that need a folder are hidden.

- **Recent folders**: the five most recently opened folders, most recently opened first, each with its name and, at the right, when it was last opened on this device: the day (“Today”, “Yesterday” or `DD.MM.YYYY`) above the time (`HH:MM`). Below the name a smaller line shows what the folder's `MD_Calendar.json` says: the path entered for this device, the number of devices and the device that saved last (“2 devices · saved on MacBook”, “saved on this device”). The line comes from a copy kept when the folder was last opened or saved; when the browser still grants access, the start card reads the file again and updates the line. Without any of these facts the line is left out. Clicking a row opens the folder (asks for permission if needed). The × at the end of a row removes the folder from the list; the folder itself is not touched. Without recent folders the list says “No recent folders”.
- **Open folder** (primary button) chooses a folder with the system dialog, opens it and adds it to the list.
- **New calendar** (secondary button) chooses a folder, adds `MD_Calendar.json` to it and opens it; Markdown files already in the folder are kept. A folder that already has the file simply opens.
- Only a calendar folder opens, one that holds `MD_Calendar.json` (see [DataFormat](../DataFormat.md#md_calendarjson)). Opening any other folder, by “Open folder”, a recent folder or at startup, keeps the card open with the warning “Not a calendar folder”; the body names the folder and says to set it up with [New calendar].
- If the browser still grants access to the most recently opened folder, it opens at startup without the card. If that folder no longer exists (moved, renamed, deleted or its drive not mounted), the card stays open with the warning “Last folder not found”; clicking such a row shows “Folder not found”. The body names the folder and says to open it from its new place. Without permission the card stays open silently. The folder stays in the list, so that it opens again once it is back.
- Clicking the logo in the header returns to the start card. It reloads the page, so unsaved changes trigger the browser's leave prompt; the next startup then shows the card instead of opening the last folder.
- **Version and watermark**, as in MD_Manager: the header shows the version label (`v0.7.0-dev`) next to “MD_Calendar”, and the bottom left corner shows the watermark “© 2026 MD_Calendar v0.7.0-dev · Tim Krüger (Zang3th) · GitHub”. Both appear only on the start card. The version comes from `package.json` (see [Architecture](../Architecture.md#runtime)); between releases it carries the next release with `-dev`.
- The header has the same height on the start card and in the views (58px), so that nothing moves when a folder opens.

## Header

Three zones in one row. The center zone is always exactly centered.

| Zone | Content, left to right |
|---|---|
| Left | Logo (back to the [start card](#start-card)) · current month and year (for example “November 2026”) · **+** · undo · redo · save control |
| Center | View switcher **Week · Month · Contacts** with a sliding indicator; the three options have the same width |
| Right | Holiday overview · backlog toggle · help · sound toggle · options (three lines) |

- **+**, undo, redo and the save control follow the title as one group, in the order of MD_Manager. There are no arrows and no week number badge; weeks and months change with `←`/`→`, the mouse wheel and a click on the title (today).

- There is no "today" button. Clicking the month title jumps to today.
- The title keeps the width of its longest text (the longest month name, “Contacts”), so that the buttons next to it do not move when the month changes.
- The right zone uses plain icon buttons without separators or nested frames. A surface appears on hover. Help, the sound toggle and the options sit at the far right and are also shown on the start card; they keep their position when a folder opens.
- **+** opens a menu below it with the ways to add; a click on an item runs it. In the calendar views the items are “Create new entry” and “Import .ics event”, in the contacts view “Create new contact” and “Import .ics event”. The file type `.ics` shows as code: monospace on a tinted chip. While the menu is open, the plus turns by 45° into a “×” and a soft accent ring surrounds the button, so it reads as “close”. A second click on **+**, Escape or a click outside closes the menu. `N` still creates a new entry or contact directly.
- “Import .ics event” chooses an `.ics` file and imports it into the open calendar (see [Domain](../Domain.md#ics-import)); a notification reports the result. It is offered in every view; from the contacts view the import switches to the calendar.
- Options (three horizontal lines, “Options”) opens a menu below the button, aligned to its right edge; while it is open the button keeps its surface, like the holiday overview and help. Its first and so far only item is the switch “Hide icons” (see [Settings](#settings)).
- Help (question mark from MD_Manager) toggles the [help panel](#help).
- The backlog toggle shows no count. It is highlighted while the backlog panel is open.
- In the contacts view the title reads “Contacts”.
- The holiday overview button (calendar with a star, the holiday icon) opens the panel described in [Views](Views.md#holiday-overview).
- **+** is an icon-only primary button. It creates an entry, in the contacts view a contact.
- Portrait: everything stays in one row; the view switcher shows icons only.

### Search

There is no search button. `F` opens a search bar centered at the bottom edge of the window; at first it shows only the field. While typing, up to 30 hits appear above the field (rules in [Domain](../Domain.md#search)); without hits it says “No results”. Each hit shows its tag icon or kind icon, the title and its date (“from …” for a series, a range for multi-day entries, “Backlog”). Arrow keys choose a hit, Enter or a click jumps to it: the view shows its week or month and the hit pulses once; a backlog hit opens the backlog panel. Escape or a click outside closes the bar.

### Help

The help button and `?` toggle a small floating glass panel below the button, built like the [holiday overview](Views.md#holiday-overview), with the title “Shortcuts”. The rows follow the quick reference of MD_Manager: a short action on the left, the keys on the right as key caps (`Ctrl` + `C`). The panel lists only the main shortcuts, in three columns side by side so that it never scrolls: Navigation (W, M, C, T, B, F) | Entries (N, Space, Ctrl+C, Ctrl+V, Del) | Edit (Ctrl+S, Ctrl+Z, Ctrl+Y). Selection, mouse gestures and paging are left out. Below 760px window width the columns stack. Like the rows of the holiday overview, its rows are not interactive and have no hover highlight. Escape or a click outside closes it.

### Sound toggle

- An icon button in the header with a speaker: with sound waves while the completion sound is on, with an X while it is muted. Icons and behavior follow MD_Manager (see [Icons](DesignSystem.md#icons)).
- Muted is the pressed state (`aria-pressed="true"`). The accessible name names the action and switches with the state: “Mute” while the sound is on, “Unmute” while it is muted.
- Muting also stops a sound that is still playing.
- As in MD_Manager the state is not stored: every start begins with the sound on. Toggling is not an undoable action and is not an unsaved change.

### Undo and redo

- Disabled when nothing can be undone or redone.
- The accessible name names the concrete action, for example “Undo “Call Lena” (Ctrl+Z)”.

### Save control

| State | Appearance |
|---|---|
| Saved | A calm green check mark. |
| Unsaved | Yellow pill “● Save N” with a gently pulsing dot and the number of unsaved changes. |
| Just saved | “✓ Saved” in green for about 1.5 seconds, then back to the check mark. |

Clicking the control saves.

## Backlog panel

- Landscape: floating glass panel on the right, below the header; the main panel narrows to make room.
- Portrait: drawer at the bottom, about 28 % of the window height; groups are laid out side by side.
- Shows the groups in order with their entry counts. Entries look like calendar entries; they are never overdue. An empty group shows a dashed drop area.
- Opened and closed with the backlog toggle and `B`; the state is not stored. New backlog entries are created with “To backlog” in the entry dialog; groups are maintained in `Backlog.md`.

## Entry dialog

- Opens on click on an entry, an occurrence or a multi-day bar, on **+** and `N` (outside the contacts view), on a double-click on a day and from the context menu of a day. An occurrence opens its whole series.
- Preselected date of a new entry: the double-clicked day, the day under the pointer for `N`, otherwise today when it is visible, else the first day of the shown week or month. Below the date the dialog spells out the chosen day (“Friday, 13 November 2026”; a range for multi-day entries), so that the preselection is unmistakable.
- Fields: title, date, time, recurrence, tag, location, note. The date field is labeled “Date”, “Starts” for a series and “Dates” for a multi-day entry.
- Date fields open a small month calendar below them (arrows switch the month; today outlined, the chosen day filled). Time fields open a list of times in steps of 15 minutes; the end time list starts at the start time. Typing keeps working in both; Escape closes the picker first, then the dialog.
- Recurrence and tag are dropdowns styled like the dialog.
- Recurrence: “None”, “Daily”, “Weekly” (with weekday chips), “Monthly on day N”, “Monthly on the Nth weekday” (1st to 4th), “Monthly on the last weekday” (in the last week of a month), “Yearly on D MMMM”; all except “None” with an interval (“every N days/weeks/months/years”). The options follow the date. An end set with “End series here” is shown as a hint (“Ends after …”) and kept.
- A small icon next to the date turns the entry into a multi-day entry and back. The date then becomes a from–to range; time and recurrence are hidden, because a multi-day entry has neither (see [Domain](../Domain.md#multi-day-entry)). Switching discards them.
- A backlog entry opens with an empty date (“No date (backlog)”); entering a date schedules it into that day.
- Tag: a dropdown, empty (“No tag”) by default, then the tags of `Config.md` in alphabetical order, each with its icon on a swatch in its color; a tag that is not configured is offered as an extra option so that it is not lost.
- Actions: “To backlog” (entries outside the backlog; moves or creates the entry in `Inbox` with the dialog's changes), “Delete”, “Apply” (confirm with Enter). For an occurrence: “Delete series”, “Delete occurrence”, “End series here” (this occurrence stays the last one) and “Apply” (applies to the series).
- Empty note lines are dropped on “Apply”, because every note line is stored as its own list item.
- Escape or a click on the backdrop closes the dialog.

## Notifications

- Appear in the bottom right corner, above the main panel and the backlog panel, as a stack of cards 280px wide (narrower on small screens). Text is left-aligned; buttons sit at the bottom right.
- Each notification has three parts: the **severity** as a colored dot (info accent, warning yellow, error red), the **title** and an optional **body** below a thin line, indented to the title.
- Used for results and hints, for example import results, reloads after external changes, deletions, copying, the attempt to drag an occurrence of a series, and errors.
- The title is short, precise and unambiguous: it names what happened (*Call Lena* deleted, 3 entries copied, Invalid time, Folder not found). The body holds the rest in a few words, without prose, each fact on its own line: which file or folder, why, what the user can do (Use *HH:MM*. / Undo with `Ctrl`+`Z`. / Set it up with [New calendar].). A plain confirmation without anything to add has no body (*Calendar* opened, Address copied). Errors also show their code and offer copyable details.
- Notifications use no quotation marks. Names the user gave or that identify data (entries, series, contacts, folders, files, formats) are highlighted: italic, bold, in the accent color. Buttons and functions of MD_Calendar (New calendar, Open folder, Reload, Overwrite) appear as a small control chip. Shortcuts appear as keys, one per key (`Ctrl` + `Z`), like in the help panel. Line breaks separate what happened from what to do; within a sentence the text wraps on its own and avoids single words on the last line.
- When a file changed or was deleted outside the app while local changes exist, a warning stays until the user chooses “Reload” (discard local changes) or “Overwrite” (save local changes over the file). Meanwhile the save control stays in its unsaved state and saving shows the choice again.

## Settings

Scheme, background lights, borders and past dimming are fixed (see [Design System](DesignSystem.md)). Besides the views, the user controls the [sound toggle](#sound-toggle) and the options menu:

- **Hide icons** (switch, off by default) hides the tag icons on entries and multi-day bars in all views and in the backlog. The series icon always stays, because it says that an entry repeats, and so do the icons of the day badges (heart, gift, calendar star). Colors, titles and times stay. The choice is kept per device in `localStorage`.
