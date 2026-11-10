# Shell

The frame around all views: header, backlog panel, entry dialog and notifications. Visual values are defined in the [Design System](DesignSystem.md). The UI language is German; labels below are the exact UI texts.

## Page layout

- A floating glass **header pill** at the top, the **main panel** below it, both with a small gap to the window edge.
- There is no sidebar.

## Start card

While no folder is open, the main panel shows a centered card with the logo, „Wähle den Ordner mit deinen Kalenderdateien.“ and the folder buttons. Header controls that need a folder are disabled.

- Without a remembered folder: „Ordner öffnen“.
- With a remembered folder: „„<Ordnername>“ öffnen“ (one click, asks for permission if needed) and „Anderen Ordner wählen“.
- If the browser still grants access to the remembered folder, it opens at startup without the card.

## Header

Three zones in one row. The center zone is always exactly centered.

| Zone | Content, left to right |
|---|---|
| Left | Logo · current month and year (for example „November 2026") · KW badge (number only, date range in the tooltip; only in the week view) · previous and next arrows |
| Center | View switcher **Woche · Monat · Kontakte** with a sliding indicator |
| Right | Sound toggle · holiday overview · search · backlog toggle · undo · redo · save control · **+ Neu** |

- There is no "today" button. Clicking the month title jumps to today.
- The right zone uses plain icon buttons without separators or nested frames; groups are formed by spacing. A surface appears on hover.
- The backlog toggle shows no count. It is highlighted while the backlog panel is open.
- In the contacts view the title reads „Kontakte"; KW badge and arrows are hidden.
- Until their release, „Kontakte“ is shown disabled in the view switcher and search is left out.
- The holiday overview button (flag icon) opens the panel described in [Views](Views.md#holiday-overview).
- Portrait: everything stays in one row; the view switcher and „+ Neu" show icons only.

### Sound toggle

- Icon button with a speaker: with sound waves while the completion sound is on, with an X while it is muted. Icons and behavior follow MD_Manager (see [Icons](DesignSystem.md#icons)).
- Muted is the pressed state (`aria-pressed="true"`). The accessible name and the tooltip name the action and switch with the state: „Ton aus" while the sound is on, „Ton an" while it is muted.
- Muting also stops a sound that is still playing.
- As in MD_Manager the state is not stored: every start begins with the sound on. Toggling is not an undoable action and is not an unsaved change.

### Undo and redo

- Disabled when nothing can be undone or redone.
- The tooltip names the concrete action, for example „Rückgängig: „Lena anrufen“ (Strg Z)".

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

- Opens on click on an entry, an occurrence or a multi-day bar, on „+ Neu" (outside the contacts view) and on the add button of a day. An occurrence opens its whole series.
- Fields: title, date, time, recurrence, location, tag (chips), note. The date field is labeled „Datum“, „Beginn“ for a series and „Zeitraum“ for a multi-day entry.
- Recurrence: „Keine“, „Täglich“, „Wöchentlich“ (with weekday chips), „Monatlich am N.“, „Monatlich am n. Wochentag“ (first to fourth), „Monatlich am letzten Wochentag“ (in the last week of a month), „Jährlich“; all except „Keine“ with an interval („alle N Tage/Wochen/Monate/Jahre“). The options follow the date. An end set with „Ab hier beenden“ is shown as a hint and kept.
- A small icon next to the date turns the entry into a multi-day entry and back. The date then becomes a from–to range; time and recurrence are hidden, because a multi-day entry has neither (see [Domain](../Domain.md#multi-day-entry)). Switching discards them.
- A backlog entry opens with an empty date („Kein Datum (Backlog)“); entering a date schedules it into that day.
- Tag: chips „Kein Tag“ and the tags of `Config.md` in their colors; a tag that is not configured is shown as an extra chip so that it is not lost.
- Actions: „Ins Backlog" (entries outside the backlog; moves or creates the entry in `Inbox` with the dialog's changes), „Löschen", „Übernehmen" (confirm with Enter). For an occurrence: „Serie löschen", „Termin löschen", „Ab hier beenden" (this occurrence stays the last one) and „Übernehmen" (applies to the series).
- Empty note lines are dropped on „Übernehmen“, because every note line is stored as its own list item.
- Escape or a click on the backdrop closes the dialog.

## Notifications

- Appear above the main panel, centered at the bottom edge.
- Used for results and hints, for example import results, reloads after external changes, deletions („Strg Z macht es rückgängig") and errors.
- When a file changed or was deleted outside the app while local changes exist, a warning stays until the user chooses „Neu laden“ (discard local changes) or „Überschreiben“ (save local changes over the file). Meanwhile the save control stays in its unsaved state and saving shows the choice again.

## Settings

There are no user settings. Scheme, background lights, borders and past dimming are fixed (see [Design System](DesignSystem.md)). The only user control besides the views is the [sound toggle](#sound-toggle).
