# Interaction

Keyboard, pointer and editing behavior. Layout and appearance are defined in [Shell](Shell.md) and [Views](Views.md).

## Keyboard shortcuts

Single-key shortcuts are ignored while a text field has focus.

`Space`, `Del`, `Ctrl+C` and `Ctrl+X` act on the selection; without a selection they act on the entry under the pointer, in a day or in the backlog. Without either they do nothing.

Keyboard navigation of controls is not supported, so keyboard focus is never shown: no focus ring on buttons, fields or other controls. A text field shows its usual focus border while it is being edited, however it was entered, and arrow keys in menus and lists still mark the current item.

| Key | Action |
|---|---|
| `W` | Week view |
| `M` | Month view |
| `C` | Contacts view |
| `B` | Show or hide the backlog panel |
| `T` | Jump to today: the period slides in, the day scrolls into view and is highlighted once |
| `A` | New entry on the day under the pointer, otherwise on the preselected day (in the contacts view: new contact) |
| `F` | Open the search bar at the bottom edge |
| `?` | Show or hide the help |
| `←` / `→` | Previous or next week or month |
| `Space` | Check off the selection (all open: done; all done: open) |
| `Del` | Delete the selection |
| `Ctrl+A` | Select all entries of the day under the pointer, also those hidden behind “+N” |
| `Ctrl+C` | Copy the selection |
| `Ctrl+X` | Cut the selection: copy it and delete it as one undoable action |
| `Ctrl+V` | Paste onto the day under the pointer, otherwise onto the preselected day |
| `Ctrl+S` | Save |
| `Ctrl+Z` | Undo |
| `Ctrl+Y`, `Ctrl+Shift+Z` | Redo |
| `Esc` | Close the picker, dialog, menu or panel; otherwise clear the selection and shrink an enlarged month cell |
| `Enter` | Confirm the dialog; in an inline field, finish editing |

The arrows, `Space`, `Del`, `Ctrl+A` and `Ctrl+X` do nothing in the contacts view. The help (see [Shell](Shell.md#help)) lists the main ones.

## Pointer

| Gesture | Action |
|---|---|
| Click on the body of a day (below its header, outside entries and bars) | New entry on that day |
| Right-click on an entry (in a day or the backlog) | Copies the entry; on a selected entry it copies the whole selection |
| Right-click on free space of a day (outside entries, bars and badges) | Pastes into that day when something is copied, otherwise nothing |
| Right-click anywhere else | Nothing; the browser menu does not open either, except in text fields |
| Dragging on free space | Lasso: selects every entry it touches |
| `Ctrl`+click on an entry | Adds it to the selection or removes it |
| Mouse wheel over the week or month | One week or month per wheel gesture; a day list that can still scroll in that direction scrolls first |

A click on free space clears the selection; when a selection existed, a menu or panel was open (**+** menu, help, holiday overview, badge list, search bar) or an enlarged month cell shrinks, that click does only this and creates no entry. A `Ctrl`+click creates no entry either. Menus show only icon and label, no shortcut hints; they close with Escape or a click outside, and arrow keys move between their items.

## Creating entries

- “Create new entry” in the **+** menu, `A` and a click on the body of a day open the entry dialog for a new entry (preselected date in [Shell](Shell.md#entry-dialog)).
- New backlog entries are created with “To backlog” in the dialog.

## Selection, copy and paste

Rules in [Domain](../Domain.md#selection-copy-and-paste).

- Selected entries get an accent edge (`--strong`) and an accent tint (`--active`) over their own surface, both inside the tile, so that neighbouring selected tiles stay apart. The selection survives re-rendering and is cleared by undo, redo, deleting it and dragging it.
- Dragging a selected entry moves the whole selection: the entries keep their order and land together at the drop position. Occurrences in the selection stay where they are.
- While a selection is dragged, the drag image shows all moving entries stacked in their order and in the look of the view, at most five, the rest as “+N” (also entries hidden behind “+N” in the month). Their tiles in place fade like the placeholder until the drop.
- Copying and cutting confirm with a notification; cutting and pasting are each one undoable action.

## Drag and drop

- Reorder normal entries within a day. Occurrences of recurring entries do not move; trying to drag one shows a notification that series occurrences cannot be moved.
- Move an entry to another day. A timed entry dragged in from another day or the backlog goes into its time slot of that day, wherever it is dropped (see [Domain](../Domain.md#day-list-order)); within a day the drop position counts.
- Move a multi-day bar; drag one of its ends to change the start or end date. The duration stays when the bar is moved.
- Move a backlog entry onto a day, and an entry from a day into any backlog group.
- Reorder backlog entries and move them between the ungrouped entries and the groups; an entry dropped onto the panel title becomes ungrouped.
- Reorder backlog groups by dragging their head; a click on the head still collapses or expands the group. The ungrouped entries stay first. The new order is saved to `Backlog.md` and is undoable.
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
- A notification confirms the deletion (““Title” deleted”); `Ctrl+Z` restores it.
