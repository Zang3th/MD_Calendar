# Views

The three views behind the view switcher. Rules about what appears where come from the [Domain](../Domain.md); this document defines how it is presented.

## Default view

| Orientation | Default view |
|---|---|
| Landscape | Week |
| Portrait | Month |

Rotating the screen switches to the default view of the new orientation. The backlog panel is hidden by default.

## Entry tile

- Check box, optional time, tag icon, title. A recurring entry shows a repeat icon (16px, 13px in the month view) at the right end, vertically centered on the whole tile.
- The tile is tinted with its tag color and shows the tag icon; without a tag it uses the neutral item surface and has no icon.
- Time: in the week view (landscape) on its own small line above the title in the tag color; elsewhere inline before the title.
- Done: 60 % opacity, title struck through, check box filled.
- Overdue: red check box border and a red outline.
- Hover lifts the tile slightly.

## Day header

- Weekday and date. Today: weekday in the accent color, a „Heute“ pill in the accent color next to the date and an accent-tinted day card with an accent outline and glow, so that today stands out wherever it is in the week. In the month view the date of today sits on an accent pill.
- **Badges** next to the date: the holiday first, then birthdays and anniversaries, stacked vertically while there is room.
  - Holiday badge in `--accent-2`; birthday badges in `--warm` with a cake icon, first and last name and the age the contact turns; anniversary badges in `--warm` with a heart icon, the name and the number of years.
  - Maximum badges: 3 in the landscape week, 5 in the portrait week, 1 in the month view. Beyond the maximum the last badge shows „+X"; its accessible name lists the others with ages.
  - Clicking a birthday or anniversary badge opens the contact in the contacts view.
- School vacations are not shown in the week and month views; they appear only in the [holiday overview](#holiday-overview).

## Holiday overview

An icon button in the right zone of the header toggles a small floating glass panel below the button. It shows the lists of one year; arrows switch the year:

- „Feiertage“: date, weekday and name of each public holiday.
- „Urlaub“: only when there are own vacations, that is entries and multi-day entries with the tag „Urlaub“; date or date range and title. Consecutive days with the same title form one range.
- „Schulferien“: date range and name of each school vacation of North Rhine-Westphalia.

Past holidays and vacations are dimmed.

## Week, landscape

- Seven day cards side by side, Monday to Sunday.
- Each card: day header, then the day list from top to bottom. There is no add button; a double-click on free space of the card creates an entry (see [Interaction](Interaction.md#creating-entries)).
- Multi-day entries are horizontal bars across the covered days, between day header and list. Only the days a bar covers make room for it; the lists of the other days keep their place. Overlapping bars stack in lanes, ordered by start date, then the longer bar first, then the order in the file. Bars continuing beyond the week have square ends on that side. A bar shows title and date range. A bar with a tag shows the tag icon before its title; a bar without a tag uses the accent gradient. Clicking a bar opens the entry dialog. Dragging a bar moves it, dragging one of its ends changes its start or end (see [Interaction](Interaction.md#drag-and-drop)).

## Week, portrait

- The seven days are rows stacked vertically. Each row: day header on the left (badges below the date), multi-day lane, entry grid.
- **Entry grid: 3 columns × 4 entries = 12 entries at a glance.** Spacing and heights are tuned for this. Entries fill column by column. A 13th entry starts a fourth column and the row scrolls horizontally.
- Multi-day entries become vertical bars between day header and grid, spanning the covered rows, with vertical text.

## Month

- Grid of week rows, Monday to Sunday. Days outside the month are faded.
- A slim column (20px) on the left shows the ISO week number of each row, without a column heading. The current week's number is highlighted in the accent color.
- Each cell: date (the first of a month shows the month name), at most one badge plus „+X", compact entry list.
- Visible entries per cell: at most 3 in landscape and 4 in portrait, fewer when the cell is too low (bar lanes, small window). Further entries collapse into a „+N" chip; clicking it opens the week of that day.
- In narrow cells (portrait) tiles show only check box and title.
- Multi-day bars run across the cells of each week row; only the cells a bar covers make room for it.

## Contacts

A full contact editor with a list on the left and the selected contact on the right.

### List

- Search field across name, company, email and phone; filters while typing.
- Filter chips: „Alle", „Favoriten", one chip per contact group.
- Sort: „A–Z" or „Geburtstag" (next birthday first).
- Sorted by name: favorites pinned at the top, then sections by initial letter. Sorted by birthday: „Nächste 30 Tage", „Später", „Ohne Geburtstag".
- Row: initials avatar with a color gradient derived from the name, display name, and either an upcoming birthday („heute · wird 32", „in 7 Tagen") in `--warm` or company, groups or first phone number. Favorites show a star.
- „Import" opens a vCard file; the result is reported in a notification. „Export" saves all contacts as one vCard file.
- Footer: number of contacts and the file name.

### Detail

- Header: large avatar; first name, last name, nickname, company and position as inline fields.
- Actions: „Anrufen" (`tel:`), „Mail" (`mailto:`), „Favorit", „vCard" (export), „Löschen".
- Birthday card on the right: countdown („Heute!", „morgen", „in N Tagen"), date and age; highlighted in `--warm` when the birthday is today or within 14 days.
- Section cards in two columns:
  - „Telefon", „E-Mail", „Adressen": one row per value with a label button (click cycles through the labels), the value, a direct link (call, mail) or a copy button (address), and a remove button; „… hinzufügen" adds a row.
  - „Daten": birthday (`TT.MM.JJJJ` or `TT.MM.`) with the upcoming age, anniversaries with an editable label and a date.
  - „Gruppen": toggle chips per group and an input to create a new group with Enter.
  - „Notiz": full width.
- Inline fields have no frame; a surface appears on hover and an accent outline on focus. Remove buttons are always visible.
- „Daten“: an invalid birthday or anniversary date is rejected with a notification and the field returns to its value.
- „+“ in the header and `N` create a new contact and focus its first name.
- Portrait: narrower list, single-column detail, birthday card as a row below the header.
