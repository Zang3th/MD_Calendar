# Shell

The frame around all views: header, backlog panel, entry dialog and notifications. Visual values are defined in the [Design System](DesignSystem.md). The UI language is German; labels below are the exact UI texts.

## Page layout

- A floating glass **header pill** at the top, the **main panel** below it, both with a small gap to the window edge.
- There is no sidebar.

## Header

Three zones in one row. The center zone is always exactly centered.

| Zone | Content, left to right |
|---|---|
| Left | Logo · current month and year (for example „November 2026") · KW badge (number only, date range in the tooltip; only in the week view) · previous and next arrows |
| Center | View switcher **Woche · Monat · Kontakte** with a sliding indicator |
| Right | Sound toggle · search · backlog toggle · undo · redo · save control · **+ Neu** |

- There is no "today" button. Clicking the month title jumps to today.
- The right zone uses plain icon buttons without separators or nested frames; groups are formed by spacing. A surface appears on hover.
- The backlog toggle shows no count. It is highlighted while the backlog panel is open.
- In the contacts view the title reads „Kontakte"; KW badge and arrows are hidden.
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
- Shows the groups in order with their entry counts. Entries look like calendar entries.

## Entry dialog

- Opens on click on an entry, on „+ Neu" (outside the contacts view) and on the add button of a day.
- Fields: title, date, time, recurrence, location, tag (chips), note.
- A small icon next to the date turns the entry into a multi-day entry and back. The date then becomes a from–to range; time and recurrence are hidden, because a multi-day entry has neither (see [Domain](../Domain.md#multi-day-entry)). Switching discards them.
- Actions: „Ins Backlog", „Löschen", „Übernehmen" (confirm with Enter).
- Escape or a click on the backdrop closes the dialog.

## Notifications

- Appear above the main panel, centered at the bottom edge.
- Used for results and hints, for example import results, reloads after external changes, deletions („Strg Z macht es rückgängig") and errors.

## Settings

There are no user settings. Scheme, background lights, borders and past dimming are fixed (see [Design System](DesignSystem.md)). The only user control besides the views is the [sound toggle](#sound-toggle).
