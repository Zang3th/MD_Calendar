# Shell

The frame around all views: header, backlog panel, entry dialog and notifications. Visual values are defined in the [Design System](DesignSystem.md). The UI language is German; labels below are the exact UI texts.

## Page layout

- A floating glass **header pill** at the top, the **main panel** below it, both with a small gap to the window edge.
- There is no sidebar.

## Start card

While no folder is open, the main panel shows a centered card with the logo, „Wähle den Ordner mit deinen Kalenderdateien.“ and the folder buttons. The header shows only the logo and „MD_Calendar“; all controls that need a folder are hidden.

- Without a remembered folder: „Ordner öffnen“.
- With a remembered folder: „„<Ordnername>“ öffnen“ (one click, asks for permission if needed) and „Anderen Ordner wählen“.
- If the browser still grants access to the remembered folder, it opens at startup without the card.

## Header

Three zones in one row. The center zone is always exactly centered.

| Zone | Content, left to right |
|---|---|
| Left | Logo · current month and year (for example „November 2026") · KW badge (number only; only in the week view) · previous and next arrows |
| Center | View switcher **Woche · Monat · Kontakte** with a sliding indicator; the three options have the same width |
| Right | Holiday overview · search · backlog toggle · undo · redo · save control · **+** · options |

- There is no "today" button. Clicking the month title jumps to today.
- The title keeps the width of its longest text (the longest month name, „Kontakte“), so that the arrows next to it do not move when the month changes.
- The right zone uses plain icon buttons without separators or nested frames; groups are formed by spacing. A surface appears on hover.
- The backlog toggle shows no count. It is highlighted while the backlog panel is open.
- In the contacts view the title reads „Kontakte"; KW badge and arrows are hidden.
- The holiday overview button (flag icon) opens the panel described in [Views](Views.md#holiday-overview).
- **+** is an icon-only primary button. It creates an entry, in the contacts view a contact.
- Portrait: everything stays in one row; the view switcher shows icons only.

### Options menu

The icon button with three dots right of **+** opens a small menu below it:

| Item | Action |
|---|---|
| „Ton aus“ / „Ton an“ | The [sound toggle](#sound-toggle); the menu stays open so that the change is visible. |
| „Kalender importieren (.ics)“ | Opens an `.ics` file and imports it (see [Domain](../Domain.md#ics-import)); the result is reported in a notification. |
| „Tastenkürzel“ | Opens the shortcut overview (also `?`). |

Escape or a click outside closes the menu; arrow keys move between the items.

### Search

The search button and `F` open a floating panel below the button with a search field and up to 30 hits while typing (rules in [Domain](../Domain.md#search)). Each hit shows its tag icon or kind icon, the title and its date („Serie · ab …“, a range for multi-day entries, „Backlog“). Arrow keys choose a hit, Enter or a click jumps to it: the view shows its week or month and the hit pulses once; a backlog hit opens the backlog panel. Escape or a click outside closes the panel.

### Shortcut overview

A dialog lists all shortcuts and pointer gestures of [Interaction](Interaction.md) in four groups: Ansicht, Einträge, Auswahl, Bearbeiten. It opens with `?` or from the options menu and closes with Escape, the close button or a click on the backdrop.

### Sound toggle

- An item of the [options menu](#options-menu) with a speaker icon: with sound waves while the completion sound is on, with an X while it is muted. Icons and behavior follow MD_Manager (see [Icons](DesignSystem.md#icons)).
- The label names the action and switches with the state: „Ton aus" while the sound is on, „Ton an" while it is muted.
- Muting also stops a sound that is still playing.
- As in MD_Manager the state is not stored: every start begins with the sound on. Toggling is not an undoable action and is not an unsaved change.

### Undo and redo

- Disabled when nothing can be undone or redone.
- The accessible name names the concrete action, for example „Rückgängig: „Lena anrufen“ (Strg Z)".

### Save control

| State | Appearance |
|---|---|
| Saved | A calm green check mark. |
| Unsaved | Yellow pill „● Speichern N" with a gently pulsing dot and the number of unsaved changes. |
| Just saved | „✓ Gespeichert" in green for about 1.5 seconds, then back to the check mark. |

Clicking the control saves.

## Backlog panel

- Landscape: floating glass panel on the right, below the header; the main panel narrows to make room.
- Portrait: drawer at the bottom, about 28 % of the window height; groups are laid out side by side.
- Shows the groups in order with their entry counts. Entries look like calendar entries; they are never overdue. An empty group shows a dashed drop area.
- Opened and closed with the backlog toggle and `B`; the state is not stored. New backlog entries are created with „Ins Backlog“ in the entry dialog; groups are maintained in `Backlog.md`.

## Entry dialog

- Opens on click on an entry, an occurrence or a multi-day bar, on **+** and `N` (outside the contacts view), on a double-click on a day and from the context menu of a day. An occurrence opens its whole series.
- Preselected date of a new entry: the double-clicked day, the day under the pointer for `N`, otherwise today when it is visible, else the first day of the shown week or month. Below the date the dialog spells out the chosen day („Freitag, 13. November 2026“; a range for multi-day entries), so that the preselection is unmistakable.
- Fields: title, date, time, recurrence, tag, location, note. The date field is labeled „Datum“, „Beginn“ for a series and „Zeitraum“ for a multi-day entry.
- Date fields open a small month calendar below them (arrows switch the month; today outlined, the chosen day filled). Time fields open a list of times in steps of 15 minutes; the end time list starts at the start time. Typing keeps working in both; Escape closes the picker first, then the dialog.
- Recurrence and tag are dropdowns styled like the dialog.
- Recurrence: „Keine“, „Täglich“, „Wöchentlich“ (with weekday chips), „Monatlich am N.“, „Monatlich am n. Wochentag“ (first to fourth), „Monatlich am letzten Wochentag“ (in the last week of a month), „Jährlich“; all except „Keine“ with an interval („alle N Tage/Wochen/Monate/Jahre“). The options follow the date. An end set with „Ab hier beenden“ is shown as a hint and kept.
- A small icon next to the date turns the entry into a multi-day entry and back. The date then becomes a from–to range; time and recurrence are hidden, because a multi-day entry has neither (see [Domain](../Domain.md#multi-day-entry)). Switching discards them.
- A backlog entry opens with an empty date („Kein Datum (Backlog)“); entering a date schedules it into that day.
- Tag: a dropdown, empty („Kein Tag“) by default, then the tags of `Config.md` in alphabetical order, each with its icon on a swatch in its color; a tag that is not configured is offered as an extra option so that it is not lost.
- Actions: „Ins Backlog" (entries outside the backlog; moves or creates the entry in `Inbox` with the dialog's changes), „Löschen", „Übernehmen" (confirm with Enter). For an occurrence: „Serie löschen", „Termin löschen", „Ab hier beenden" (this occurrence stays the last one) and „Übernehmen" (applies to the series).
- Empty note lines are dropped on „Übernehmen“, because every note line is stored as its own list item.
- Escape or a click on the backdrop closes the dialog.

## Notifications

- Appear above the main panel, centered at the bottom edge.
- Used for results and hints, for example import results, reloads after external changes, deletions („Strg Z macht es rückgängig"), copying, the attempt to drag an occurrence of a series, and errors.
- When a file changed or was deleted outside the app while local changes exist, a warning stays until the user chooses „Neu laden“ (discard local changes) or „Überschreiben“ (save local changes over the file). Meanwhile the save control stays in its unsaved state and saving shows the choice again.

## Settings

There are no user settings. Scheme, background lights, borders and past dimming are fixed (see [Design System](DesignSystem.md)). The only user control besides the views is the [sound toggle](#sound-toggle) in the options menu.
