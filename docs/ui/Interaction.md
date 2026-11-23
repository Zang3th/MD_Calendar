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
| `T` | Jump to today: the period slides in, the day scrolls into view and is highlighted once (see [Motion](DesignSystem.md#motion)); after dragging the days it returns to today's whole week |
| `A` | New entry on the day under the pointer, in the backlog group under the pointer (its tag preset), otherwise on the preselected day (in the contacts view: new contact) |
| `F` | Open the search bar at the bottom edge |
| `?` | Show or hide the help |
| `←` / `→` | Previous or next week or month; after dragging the days, seven days back or on, keeping the offset; in focus mode the previous or next day |
| `Space` | Check off the selection (all open: done; all done: open) |
| `Del` | Delete the selection |
| `Ctrl+A` | Select all entries of the day under the pointer, also those hidden behind “+N”, or of the backlog group under it |
| `Ctrl+C` | Copy the selection |
| `Ctrl+X` | Cut the selection: copy it and delete it as one undoable action |
| `Ctrl+V` | Paste onto the day under the pointer, or into the backlog group under it at the pointer's position (where the tag decides the group, see [Domain](../Domain.md#backlog)), otherwise onto the preselected day |
| `Ctrl+S` | Save |
| `Ctrl+Z` | Undo |
| `Ctrl+Y`, `Ctrl+Shift+Z` | Redo |
| `Esc` | Close the popover of the entry dialog, the dialog, a menu, panel or focus card; otherwise clear the selection and shrink an enlarged month cell |
| `Tab` | In the entry dialog: open the next token's popover and keep what the current one holds |
| `Enter` | Apply the entry dialog, also from one of its popovers; in an inline field, finish editing. In a notes field `Enter` starts a new line and `Ctrl+Enter` applies or finishes |

The arrows, `Space`, `Del`, `Ctrl+A` and `Ctrl+X` do nothing in the contacts view. While the [focus card](Views.md#focus-mode) is open, `W`, `M`, `C`, `B`, `F` and `T` do nothing; `A`, `Ctrl+V` and a right-click on its free space use the focused day, and the actions on entries work on its entries. The help (see [Shell](Shell.md#help)) lists all shortcuts and pointer gestures.

## Pointer

| Gesture | Action |
|---|---|
| Click on the body of a day (below its header, outside entries and bars) | New entry on that day |
| Right-click on an entry (in a day or the backlog) | Copies the entry; on a selected entry it copies the whole selection |
| Right-click on free space of a day (outside entries, bars and badges) | Pastes into that day when something is copied, otherwise nothing |
| Right-click on free space of the backlog panel | Pastes into the group there at the pointer's position, like `Ctrl+V` |
| Click on free space of the backlog panel | New backlog entry in the group under or nearest to the pointer, with its tag preset (see [Shell](Shell.md#backlog-panel)) |
| Right-click anywhere else | Nothing; the browser menu does not open either, except in text fields |
| Dragging on free space | Lasso: selects every entry it touches |
| `Ctrl`+click on an entry | Adds it to the selection or removes it |
| Mouse wheel over the week or month | One week or month per wheel gesture; a day list that can still scroll in that direction scrolls first. After dragging the days, the first gesture only returns to the calendar week that is mostly shown |
| Double-click on a day header in the week view | Opens the day in [focus mode](Views.md#focus-mode) |
| Holding the middle button on the week and dragging along the days (sideways in landscape, up and down in portrait) | The days follow the pointer, without end; on release they snap to the nearest whole day with a short glide, so that any seven consecutive days can show. The browser's autoscroll does not start there |
| Click on the blurred background of the focus card | Closes it |

A click on free space clears the selection; when a selection existed, a menu or panel was open (**+** menu, help, holiday overview, badge list, search bar) or an enlarged month cell shrinks, that click does only this and creates no entry. A `Ctrl`+click creates no entry either. Menus show only icon and label, no shortcut hints; they close with Escape or a click outside, and arrow keys move between their items.

## Creating entries

- “Create new entry” in the **+** menu, `A` and a click on the body of a day open the entry dialog for a new entry (preselected date in [Shell](Shell.md#entry-dialog)).
- New backlog entries are created with a click on free space of the backlog panel, with `A` over it, or by choosing “Backlog” as the date in the dialog.

## Selection, copy and paste

Rules in [Domain](../Domain.md#selection-copy-and-paste).

- Selected entries get an accent edge (`--strong`) and an accent tint (`--active`) over their own surface, both inside the tile, so that neighbouring selected tiles stay apart. The selection survives re-rendering and is cleared by undo, redo, deleting it and dragging it.
- Dragging a selected entry moves the whole selection: the entries keep their order and land together at the drop position. Occurrences in the selection stay where they are.
- While a selection is dragged, the drag image shows all moving entries stacked in their order and in the look of the view, at most five, the rest as “+N” (also entries hidden behind “+N” in the month). Their tiles in place fade like the placeholder until the drop.
- Copying and cutting confirm with a notification; cutting and pasting are each one undoable action.

## Drag and drop

- Reorder normal entries and occurrences within a day; an occurrence stays where it is dropped (see [Domain](../Domain.md#day-list-order)). An occurrence does not leave its day: held over another day or the backlog it shows the notification “Occurrence not moved” once per drag and returns when dropped.
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
- Browser spell checking is off in every field.
- An inline change is committed when the field loses focus or on Enter (in the notes on `Ctrl+Enter`). Focus moves on naturally (Tab keeps working) and is restored after the view re-renders.
- Invalid dates are rejected with a notification; the field returns to its previous value.
- A birthday is `TT.MM.JJJJ` or `TT.MM.`; an anniversary needs a full date.

## Links

- Notes recognize links: Markdown links `[label](https://…)` and bare addresses starting with `https://`, `http://` or `www.` (opened as `https://`). Punctuation that ends a sentence after a bare address is not part of it.
- Where note lines are shown, as in the [focus card](Views.md#focus-mode), a link shows its label (a bare address itself) in `--accent`, underlined, and a click opens it in a new browser tab instead of the entry.
- The note of the entry dialog shows the same way while it is not being edited. A click on a link opens it; a click elsewhere on the note edits it, with the caret at the clicked place; a dragged selection stays a selection.
- While a notes field is being edited (entry dialog), and always in the contacts view, it shows its text as written: a link is underlined in `--accent` on a faint accent surface while the text keeps its color. A click places the caret; `Ctrl+click` on a link opens it in a new browser tab.

## Undo and redo

- Every change is undoable: entries, moves, selections, paste, backlog, contacts, groups, imports.
- After undo or redo the view returns to the state it had for that action; for a contact change that is the contacts view with the changed contact.

## Deleting

- Entries and contacts are deleted without a confirmation dialog.
- A notification confirms the deletion (““Title” deleted”); `Ctrl+Z` restores it.
