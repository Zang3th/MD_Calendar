# Views

The three views behind the view switcher. Rules about what appears where come from the [Domain](../Domain.md); this document defines how it is presented.

## Default view

| Orientation | Default view |
|---|---|
| Landscape | Week |
| Portrait | Month |

Rotating the screen switches to the default view of the new orientation. The backlog panel is hidden by default.

## Entry tile

- Check box, optional time, tag icon, title. A recurring entry shows a repeat icon (16px, 12px in the month view) at the right end, vertically centered on the whole tile.
- The tile is tinted with its tag color and shows the tag icon; without a tag it uses the neutral item surface and has no icon.
- Time: in the week view (landscape) on its own small line above the title in the tag color; elsewhere inline before the title.
- Done: `--o-past` opacity (55 %), title struck through, check box filled.
- Overdue: red check box border and a red outline.
- Hover lifts the tile slightly.

## Day header

- Weekday and date. Today: weekday in the accent color, a “Today” pill in the accent color next to the date and an accent-tinted day card with an accent outline and glow, so that today stands out wherever it is in the week. In the month view the date of today sits on an accent pill.
- **Badges** start at the top right of the day card, by priority: anniversaries (heart, `--heart`), then birthdays (gift, `--warm`), then holidays (calendar with a star, `--accent-2`).
  - **Written out** (week, while they fit: 2 badges in the landscape week, 5 in the portrait week): an anniversary or birthday shows the icon, the name and the age or number of years; several of one kind share one badge with the icon and their count; a holiday shows its name. Badges stack downwards.
  - **Compact** (month, and the week when the written-out badges do not fit): one icon badge per kind in a row, with the count when there are several.
  - Every anniversary or birthday badge, also for a single person, and every compact holiday badge opens a list below it, right-aligned to it, or left-aligned when there is no room to its left (badges at the left edge, as in the portrait week), in the color of its kind: a header with the icon on a tinted tile, the title (“2 birthdays”, “Anniversary”, “2 holidays”) and the weekday and date; below it one row per name. Birthdays show “turns 32” as a pill, anniversaries their label (“Wedding”) and “6 years”; rows of people end with a chevron and open the contact, holidays are only listed.
- School vacations are not shown in the week and month views; they appear only in the [holiday overview](#holiday-overview).

## Holiday overview

An icon button in the right zone of the header toggles a small floating glass panel below the button. It shows the lists of one year; arrows switch the year. Below the year, a segmented control with a sliding indicator (as the view switcher) switches between three tabs by mouse; only the list of the selected tab is shown, so the panel does not scroll:

1. “Vacation”: own vacations, that is entries and multi-day entries with the tag “Vacation”; date or date range and title. Consecutive days with the same title form one range. Without vacations: “No vacation in <year>.”
2. “Holidays”: date, weekday and name of each public holiday.
3. “School vacations”: date range and name of each school vacation of North Rhine-Westphalia; a one-day vacation shows one date.

“Vacation” is selected at first; the selected tab stays when the year changes and when the panel opens again. The list area has a fixed height, so the panel keeps its size when the tab changes.

Past holidays and vacations are dimmed.

## Week, landscape

- Seven day cards side by side, Monday to Sunday.
- Each card: day header, then the day list from top to bottom. There is no add button; a click on the body of the card creates an entry (see [Interaction](Interaction.md#creating-entries)).
- Multi-day entries are horizontal bars across the covered days, between day header and list. Only the days a bar covers make room for it; the lists of the other days keep their place. Overlapping bars stack in lanes, ordered by start date, then the longer bar first, then the order in the file. Bars continuing beyond the week have square ends on that side. A bar shows title and date range. A bar with a tag shows the tag icon before its title; a bar without a tag uses the accent gradient. Clicking a bar opens the entry dialog. Dragging a bar moves it, dragging one of its ends changes its start or end (see [Interaction](Interaction.md#drag-and-drop)).

## Week, portrait

- The seven days are rows stacked vertically. Each row: day header on the left, at the top of the row and level with the first entries (weekday, date, badges below the date), multi-day lane, entry grid.
- **Entry grid: 3 columns × 4 entries = 12 entries at a glance.** Spacing and heights are tuned for this. Entries fill column by column. A 13th entry starts a fourth column and the row scrolls horizontally.
- Multi-day entries become vertical bars between day header and grid, spanning the covered rows, with vertical text.

## Month

- Grid of week rows, Monday to Sunday. Days outside the month are faded.
- A slim column (20px) on the left shows the ISO week number of each row, without a column heading. The current week's number is highlighted in the accent color.
- Each cell: date (the first of a month shows the month name), compact badges (see [Day header](#day-header)), compact entry list.
- Visible entries per cell: as many as the cell's height leaves room for next to its bar lanes. When not all fit, the remaining ones collapse into a “+N” chip, which takes the place of the last entry row.
- Clicking “+N” enlarges the cell in place, at its width, until all its entries show: it lies over the cells below it, or, when they lack the room, aligned to the bottom of the month and over the cells above it; then it covers the bars of its own row. A cell taller than the month scrolls. The chip then reads “Less” and shrinks the cell back, as do Escape, a click elsewhere in the month and a change of month. At most one cell is enlarged; it closes by itself once its entries fit again. Its entries behave as everywhere else: check, open, select and drag and drop within the cell and to other days.
- In narrow cells (portrait) tiles show only check box and title.
- Multi-day bars run across the cells of each week row; only the cells a bar covers make room for it.

## Contacts

A full contact editor with a list on the left and the selected contact on the right.

### List

- Search field across name, company, email and phone; filters while typing.
- Filter chips: “All”, “Favorites”, one chip per contact group.
- Sort: “A–Z” or “Birthday” (next birthday first).
- Sorted by name: favorites pinned at the top, then sections by initial letter. Sorted by birthday: “Next 30 days”, “Later”, “No birthday”.
- Row: initials avatar with a color gradient derived from the name, display name, and either an upcoming birthday (“today · turns 32”, “in 7 days”) in `--warm` or company, groups or first phone number. Favorites show a star.
- “Import” opens a vCard file; the result is reported in a notification. “Export” saves all contacts as one vCard file.
- Footer: number of contacts and the file name.

### Detail

- Header: large avatar; first name, last name, nickname, company and position as inline fields.
- Actions: “Call” (`tel:`), “Email” (`mailto:`), “Favorite”, “vCard” (export), “Delete”.
- Birthday card on the right: countdown (“Today!”, “tomorrow”, “in N days”), date and age; highlighted in `--warm` when the birthday is today or within 14 days.
- Section cards in two columns:
  - “Phone”, “Email”, “Addresses”: one row per value with a label button (click cycles through the labels), the value, a direct link (call, mail) or a copy button (address), and a remove button; “Add …” adds a row.
  - “Dates”: birthday (`DD.MM.YYYY` or `DD.MM.`) with the upcoming age, anniversaries with an editable label and a date.
  - “Groups”: toggle chips per group and an input to create a new group with Enter.
  - “Note”: full width.
- Inline fields have no frame; a surface appears on hover and an accent outline on focus. Remove buttons are always visible.
- “Dates”: an invalid birthday or anniversary date is rejected with a notification and the field returns to its value.
- “Create new contact” in the **+** menu and `A` create a new contact and focus its first name.
- Portrait: narrower list, single-column detail, birthday card as a row below the header.
