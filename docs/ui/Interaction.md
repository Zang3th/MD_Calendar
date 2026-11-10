# Interaction

Keyboard, pointer and editing behavior. Layout and appearance are defined in [Shell](Shell.md) and [Views](Views.md).

## Keyboard shortcuts

Single-key shortcuts are ignored while a text field has focus.

| Key | Action |
|---|---|
| `W` | Week view |
| `M` | Month view |
| `B` | Show or hide the backlog panel |
| `T` | Jump to today with a smooth scroll and a short highlight of the day |
| `N` | New entry (in the contacts view: new contact) |
| `←` / `→` | Previous or next week or month |
| `Ctrl+S` | Save |
| `Ctrl+Z` | Undo |
| `Ctrl+Y`, `Ctrl+Shift+Z` | Redo |
| `Esc` | Close the dialog or panel |
| `Enter` | Confirm the dialog; in an inline field, finish editing |

Further shortcuts are not decided yet (see [Open Questions](../OpenQuestions.md)).

## Drag and drop

- Reorder normal entries within a day. Occurrences of recurring entries do not move.
- Move an entry to another day.
- Move a multi-day bar; drag one of its ends to change the start or end date. The duration stays when the bar is moved.
- Move a backlog entry onto a day, and an entry from a day into any backlog group.
- Reorder backlog entries and move them between groups.
- Every drop is one undoable action.

## Checking off

- Clicking the check box toggles done. It is an undoable action and counts as an unsaved change.
- Marking an entry (or an occurrence) as done plays a short completion sound. Reopening it, undo and redo play no sound. The sound can be muted with the [sound toggle](Shell.md#sound-toggle).

## Editing

- Entries are edited in the entry dialog. Contacts are edited inline in the contacts view.
- An inline change is committed when the field loses focus or on Enter. Focus moves on naturally (Tab keeps working) and is restored after the view re-renders.
- Invalid dates are rejected with a notification; the field returns to its previous value.

## Undo and redo

- Every change is undoable: entries, moves, backlog, contacts, groups, imports.
- After undo or redo the view returns to the state it had for that action.

## Deleting

- Entries and contacts are deleted without a confirmation dialog.
- A notification confirms the deletion and points to `Ctrl+Z`.
