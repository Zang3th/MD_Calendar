# Interaction

Keyboard, pointer and editing behavior. Layout and appearance are defined in [Shell](Shell.md) and [Views](Views.md).

## Keyboard shortcuts

Single-key shortcuts are ignored while a text field has focus.

| Key | Action |
|---|---|
| `W` | Week view |
| `M` | Month view |
| `K` | Contacts view |
| `B` | Show or hide the backlog panel |
| `T` | Jump to today: the period slides in, the day scrolls into view and is highlighted once |
| `N` | New entry on the day under the pointer, otherwise on the preselected day (in the contacts view: new contact) |
| `F` | Open the search |
| `?` | Open the shortcut overview |
| `←` / `→` | Previous or next week or month |
| `Space` | Check off the selection (all open: done; all done: open) |
| `Del` | Delete the selection |
| `Ctrl+A` | Select all entries of the shown week or month |
| `Ctrl+C` | Copy the selection |
| `Ctrl+V` | Paste onto the day under the pointer, otherwise onto the preselected day |
| `Ctrl+S` | Save |
| `Ctrl+Z` | Undo |
| `Ctrl+Y`, `Ctrl+Shift+Z` | Redo |
| `Esc` | Close the picker, dialog, menu or panel; otherwise clear the selection |
| `Enter` | Confirm the dialog; in an inline field, finish editing |

The arrows, `Space`, `Del` and `Ctrl+A` do nothing in the contacts view. The shortcut overview (see [Shell](Shell.md#shortcut-overview)) lists all of them.

## Pointer

| Gesture | Action |
|---|---|
| Double-click on free space of a day | New entry on that day |
| Right-click on an entry | Context menu: „Erledigt“ or „Nicht erledigt“, „Kopieren“, „Löschen“; on a selected entry it applies to the whole selection |
| Right-click on free space of a day | Context menu: „Neuer Eintrag“ and, when something is copied, „Einfügen“ |
| Dragging on free space | Lasso: selects every entry it touches |
| `Ctrl`+click on an entry | Adds it to the selection or removes it |
| Mouse wheel over the week or month | One week or month per wheel gesture; a day list that can still scroll in that direction scrolls first |

A click on free space clears the selection. Context menus close with Escape or a click outside; arrow keys move between their items.

## Creating entries

- **+**, `N`, a double-click on a day and „Neuer Eintrag“ in the context menu of a day open the entry dialog for a new entry (preselected date in [Shell](Shell.md#entry-dialog)).
- New backlog entries are created with „Ins Backlog“ in the dialog.

## Selection, copy and paste

Rules in [Domain](../Domain.md#selection-copy-and-paste).

- Selected entries have an accent outline. The selection survives re-rendering and is cleared by undo, redo, deleting it and dragging it.
- Dragging a selected entry moves the whole selection: the entries keep their order and land together at the drop position. Occurrences in the selection stay where they are.
- Copying confirms with a notification; pasting is one undoable action.

## Drag and drop

- Reorder normal entries within a day. Occurrences of recurring entries do not move; trying to drag one shows a notification that series occurrences cannot be moved.
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
- A birthday is `TT.MM.JJJJ` or `TT.MM.`; an anniversary needs a full date.

## Undo and redo

- Every change is undoable: entries, moves, selections, paste, backlog, contacts, groups, imports.
- After undo or redo the view returns to the state it had for that action; for a contact change that is the contacts view with the changed contact.

## Deleting

- Entries and contacts are deleted without a confirmation dialog.
- A notification confirms the deletion and points to `Ctrl+Z`.
