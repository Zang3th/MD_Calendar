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
- Overdue: red check box border and a red outline; a border beam travels around the tile at a constant speed without pause, one lap in 4s: a light in full `--danger` with a long tail over about a third of the outline that fades to transparent and bends around the rounded corners, over border and outline. It is hidden with reduced motion.
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
- The middle button drags the days sideways (see [Interaction](Interaction.md#pointer)); then the view shows the seven days from any weekday, and the title names the month of the first shown day. Bars, badges and the day lists behave as in a whole week. `T`, the wheel, a change of view and a jump to a day outside the shown days return to whole weeks.

## Week, portrait

- The seven days are rows stacked vertically. Each row: day header on the left, at the top of the row and level with the first entries (weekday, date, badges below the date), multi-day lane, entry grid.
- **Entry grid: 3 columns × 4 entries = 12 entries at a glance.** Spacing and heights are tuned for this. Entries fill column by column. A 13th entry starts a fourth column and the row scrolls horizontally.
- Multi-day entries become vertical bars between day header and grid, spanning the covered rows, with vertical text.
- The middle button drags the day rows up and down, like the columns in [landscape](#week-landscape); the strip, the snap to whole days and the return to whole weeks are the same.

## Focus mode

A double-click on a day header of the week view (landscape or portrait) shows that day as a floating card in front of the app, so that every entry can be read in full.

- The app behind is dimmed and blurred like behind the dialog (`--base` at 40 %, 10px blur). The card is centered, at most 620px wide and as tall as its content, with 48px to the window edges at least; a longer day scrolls inside the card. Surface, frame and shadow are the dialog's; the card fades and rises in like the dialog.
- Head: weekday in small capitals, the date large (44px, 800) followed by month and year with a “Today” pill on today, centered on the month's text. The day's badges (holidays, birthdays, anniversaries) sit at the top right; the head has no buttons. On today the card carries the accent light of today's day card and an accent frame.
- Below the head, multi-day entries covering the day as full-width bars with title and range; a click opens them.
- Then the day list with the usual entry tiles, larger: titles wrap instead of being cut, and below the title the location (with a pin) and every note line (as a dotted list) show. Check box and repeat icon are centered on the whole tile. Done entries keep their dimming. Without entries the list says “No entries”.
- Checking off, opening, copying, pasting and adding work as in the day (see [Interaction](Interaction.md#pointer)); a click on free space of the card adds an entry to the focused day. Entries can be dragged to another position within the card (occurrences of recurring entries stay, as in the day); they cannot leave it.
- `←`/`→` show the previous or next day; the card content glides in from that side. `Esc` or a click on the background close it. Changes refresh the card in place and keep its scroll position.

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

- Search field across name, email and phone; filters while typing.
- “Next up” below the search field, above the sort and in every sort: the next three birthdays and anniversaries from today on, soonest first (on the same day birthdays before anniversaries, then by name). Each is a tile tinted like an entry, `--warm` for birthdays and `--heart` for anniversaries, filled on the day itself, with the short weekday and day (“Sat 21”), the name and the details (“today · 30”, “32”, “Wedding · 9”). A click selects the contact. It stays in place while the list scrolls, is hidden while a search is active and when no contact has a date.
- Sort: “A–Z” or “Birthday”.
- Sorted by name: sections by initial letter. Sorted by birthday: chronological by day and month from January, one section per month, then “No birthday”. Choosing “Birthday” scrolls the list to the next birthday (with its month heading when it is the first of its month); choosing “A–Z” scrolls to the top. Edits and searches keep the scroll position.
- Row: initials avatar with a color gradient derived from the name, display name, and a second line. Sorted by name it shows the first phone number and never a birthday. Sorted by birthday it shows the birthday with its year when known, without an icon (“25 November 1989 · turns 37”, “25 November”), in `--warm` for every contact with a birthday.
- “Import” opens a vCard file; the result is reported in a notification. “Export” saves all contacts as one vCard file.
- Footer: number of contacts and the file name.

### Detail

- Header: large avatar; the name as one inline field. On commit its first word becomes the first name and the rest the last name; an unchanged name keeps its split.
- Actions below the name, side by side: “vCard” (export) and “Delete”.
- Section cards in two columns:
  - “Phone”, “Email”, “Addresses”: one row per value with a label button (click cycles through the labels), the value, a direct link (call, mail) or a copy button (address), and a remove button; “Add …” adds a row.
  - “Dates”: birthday (`DD.MM.YYYY` or `DD.MM.`) with the upcoming age (“turns 34”) in `--warm` right after the date in the same line, anniversaries with an editable label and a date, without icons. Every row has a remove button; the birthday’s is disabled while there is none.
  - “Note”: full width, a plain field without a resize handle, as in the entry dialog.
- Inline fields have no frame; a surface appears on hover and an accent outline on focus. Remove buttons are always visible.
- “Dates”: an invalid birthday or anniversary date is rejected with a notification and the field returns to its value.
- “Create new contact” in the **+** menu and `A` create a new contact and focus its name.
- Portrait: narrower list, single-column detail.
