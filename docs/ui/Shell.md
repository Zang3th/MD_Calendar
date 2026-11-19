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
- **+** opens a menu below it with the ways to add; a click on an item runs it. In the calendar views the items are “Create new entry” and “Import .ics event”, in the contacts view “Create new contact” and “Import .ics event”. The file type `.ics` shows as code: monospace on a tinted chip. While the menu is open, the plus turns by 45° into a “×” and a soft accent ring surrounds the button, so it reads as “close”. A second click on **+**, Escape or a click outside closes the menu. `A` still creates a new entry or contact directly.
- “Import .ics event” chooses an `.ics` file and imports it into the open calendar (see [Domain](../Domain.md#ics-import)); a notification reports the result. It is offered in every view; from the contacts view the import switches to the calendar.
- Options (three horizontal lines, “Options”) opens a menu below the button, aligned to its right edge; while it is open the button keeps its surface, like the holiday overview and help. Its first and so far only item is the switch “Hide icons” (see [Settings](#settings)).
- Help (question mark from MD_Manager) toggles the [help panel](#help).
- The backlog toggle shows no count. It is highlighted while the backlog panel is open.
- In the contacts view the title reads “Contacts”.
- The holiday overview button (calendar with a star, the holiday icon) opens the panel described in [Views](Views.md#holiday-overview).
- **+** is an icon-only primary button. It creates an entry, in the contacts view a contact.
- Portrait: everything stays in one row; the view switcher shows icons only.

### Search

There is no search button. `F` opens a search bar centered at the bottom edge of the window; at first it shows only the field. While typing, up to 30 hits appear above the field (rules in [Domain](../Domain.md#search)); without hits it says “No results”. Each hit shows its tag icon or kind icon, the title and its date (“from …” for a series, a range for multi-day entries, “Backlog”). Arrow keys and `Tab`/`Shift+Tab` choose a hit (`Tab` does not leave the field), Enter or a click jumps to it: the view shows its week or month, a month cell hiding the hit behind “+N” enlarges, and the hit is highlighted once (see [Motion](DesignSystem.md#motion)); a backlog hit opens the backlog panel. Escape or a click outside closes the bar.

### Help

The help button and `?` toggle a small floating glass panel below the button, built like the [holiday overview](Views.md#holiday-overview), with the title “Shortcuts”. It lists every shortcut and pointer gesture of [Interaction](Interaction.md). Each row has a short action on the left and the keys as key caps (`Ctrl` + `C`). Groups with pointer gestures lay every row on one grid, so that every “+” and “or” lines up: the keys, a narrow join and an end cell at the right edge. The join is “or” when key and gesture are alternatives and “+” when they go together (Ctrl + click); the end cell holds the gesture as an icon or, for a key combination without a gesture, its last key with the “+” in the join (Ctrl | + | A). A single key ends at the right edge of the card; Cut stays in line with Copy and Paste above it. Groups without gestures end with their keys at the right edge. Icons: `mouse-click` (click, left button filled), `mouse-right-click` (right button filled), `mouse-wheel` and `lasso` (dragging a dotted area). Each group is a card of its own (`--card` with a `--card-edge` frame, radius 12px, 10px apart, the title inside); the last card of each column fills it, so that both columns end level. The cards sit in two columns side by side so that the panel never scrolls: Views (Week W, Month M, Contacts C, Backlog B), Navigate (Previous / Next: ← → or wheel, Today T, Search F), Select (Area: drag, Add / Remove: Ctrl + click, Whole day: Ctrl+A) | Edit (New entry: A or click, Done / Undone: Space, Delete: Del, Copy: Ctrl+C or right-click, Paste: Ctrl+V or right-click, Cut: Ctrl+X), History (Save Ctrl+S, Undo Ctrl+Z, Redo: Ctrl+Y and below it Ctrl+Shift+Z, both right-aligned, with the label beside the first). Below both columns, without a line, one centered row holds the keys that apply everywhere: ? Help, Esc Close / Clear, Enter Confirm. The panel is 600px wide; below 760px window width the columns stack. Like the rows of the holiday overview, its rows are not interactive and have no hover highlight. Escape or a click outside closes it.

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
- Shows the ungrouped entries first, as a list without a head, then the groups in order. While there are no ungrouped entries their list takes no room; an entry dropped onto the panel title “Backlog” becomes ungrouped, in landscape and portrait. While an entry is being dragged, the title shows a dashed frame as the drop hint. Nothing moves when a drag starts.
- Each group head shows the name, the entry count right after it and a chevron at the right (down while open, right while collapsed). The whole head is one button that collapses the group to its head or expands it again; it gets a surface on hover. The collapsed groups are kept while the app is open, not stored. Entries look like calendar entries; they are never overdue. An empty group shows a dashed drop area.
- Opened and closed with the backlog toggle and `B`; the state is not stored. New backlog entries are created with “To backlog” in the entry dialog; groups are maintained in `Backlog.md`.

## Entry dialog

- Opens on click on an entry, an occurrence or a multi-day bar, on **+** and `A` (outside the contacts view) and on a click on the body of a day. An occurrence opens its whole series.
- Preselected date of a new entry: the clicked day, the day under the pointer for `A`, otherwise today when it is visible, else the first day of the shown week or month. Below the date the dialog spells out the chosen day (“Friday, 13 November 2026”; a range for multi-day entries), so that the preselection is unmistakable.
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

- Appear in the bottom right corner, above the main panel and the backlog panel, as a stack of cards 270px wide (narrower on small screens). Text is left-aligned; buttons sit at the bottom right.
- Each notification has three parts: the **severity** as a colored dot (info accent, warning yellow, error red), the **title** and an optional **body** below a thin line, indented to the title.
- Used for results and hints, for example import results, reloads after external changes, deletions, copying, the attempt to drag an occurrence of a series, and errors.
- The title names the action or the problem, without the data it concerns: Copied to clipboard, Cut to clipboard, Entry deleted, 3 entries deleted, Series ended, Folder opened, File reloaded, Events imported, Invalid time, Folder not found.
- The body says what exactly, without prose, each fact on its own line: the entries concerned (at most three titles, then “and N more”), the contact, folder or file, the date, counts, and for problems why and what helps (Use *HH:MM*. / Set it up with [New calendar].). Obvious hints are left out, in particular shortcuts such as undo, paste or save. Errors also show their code and offer copyable details.
- Notifications use no quotation marks. Names the user gave or that identify data (entries, series, contacts, folders, files, formats) are highlighted: italic, bold, in the accent color. Buttons and functions of MD_Calendar (New calendar, Open folder, Reload, Overwrite) appear as a small control chip. Line breaks separate what happened from what to do; within a sentence the text wraps on its own and avoids single words on the last line.
- When a file changed or was deleted outside the app while local changes exist, a warning stays until the user chooses “Reload” (discard local changes) or “Overwrite” (save local changes over the file). Meanwhile the save control stays in its unsaved state and saving shows the choice again.

## Settings

Scheme, background lights, borders and past dimming are fixed (see [Design System](DesignSystem.md)). Besides the views, the user controls the [sound toggle](#sound-toggle) and the options menu:

- **Hide icons** (switch, off by default) hides the tag icons on entries and multi-day bars in all views and in the backlog. The series icon always stays, because it says that an entry repeats, and so do the icons of the day badges (heart, gift, calendar star). Colors, titles and times stay. The choice is kept per device in `localStorage`.
