# Decisions

Why the project is the way it is. Each entry records a decision, its reasons and the rejected alternatives. The resulting rules live in the documents linked from each entry. The file holds only decisions that are valid now. A changed decision is rewritten in place; a dropped one is removed.

## D1 · Own Markdown files instead of Google Calendar

**Decision:** The calendar stores its data in its own Markdown files in a synced folder.
**Reasons:** full control over the data model (ordered day lists, backlog, contacts, birthdays); no dependency on Google's broken birthday sync; human-readable data; fits the MD_Manager way of working.
**Rejected:**
- Buying a frontend for Google Calendar (Notion Calendar, Morgen, Akiflow): solves neither birthdays nor the portrait layout.
- Own frontend on the Google Calendar API: needs OAuth and a server origin, and Google's data model has no backlog or ordered day lists.
- CalDAV on the NAS: good mobile support, but more operations work and a constrained data model.
- Fully own sync engine and mobile app: far too large.

**Accepted trade-off:** no mobile access and no reminders until the mobile phase. → [Product](Product.md), [Mobile](Mobile.md)

## D2 · Ordered day lists, not a time grid

**Decision:** Days are ordered lists; time is an attribute. Views are rendered by the app; drag and drop uses SortableJS.
**Reasons:** the user works mostly with loose tasks in a fixed order.
**Rejected:** EventCalendar (vkurko), FullCalendar, Schedule-X and TOAST UI Calendar — their strength is the time grid, and reordering within a day is not their model. A separate time-grid view is out of scope. → [Domain](Domain.md), [Views](ui/Views.md)

## D3 · One calendar file, separate files for backlog, contacts, holidays and configuration

**Decision:** The whole calendar lives in `Calendar.md`; month headings carry the year. Backlog, contacts, holidays and configuration have their own files. → [DataFormat](DataFormat.md#calendar-folder)
**Reasons:** simple loading, saving and moving; clear ownership per file; holidays stay externally generated.
**Rejected:** one file per year.

## D4 · Explicit saving

**Decision:** Save with `Ctrl+S`; no autosave, no crash recovery; a version check before every write.
**Reasons:** the user wants control over when the synced files change. → [Architecture](Architecture.md#saving)

## D5 · No reminders

**Decision:** The app never notifies about upcoming entries. → [Product](Product.md#out-of-scope)

## D6 · One tag per entry

**Decision:** An entry has zero or one tag; tags carry the color.
**Reasons:** a clear color per entry; multiple tags add little for the user. → [Domain](Domain.md#tags)

## D7 · Restricted recurrence, own implementation

**Decision:** Only the rule subset in [Domain](Domain.md#recurring-entry); implemented in the domain layer; stored as RFC 5545 `RRULE`.
**Rejected:** `rrule.js` (much more than needed, built on `Date`), moving or renaming single occurrences (large complexity, not needed).

## D8 · Technology

**Decision:** Plain JavaScript with JSDoc as ES modules, bundled by esbuild into one classic script that runs from `file://`; `dist/` is not committed and `npm run build` creates it; dependencies SortableJS and MD_Libs from npm only, no date library; MD_Libs provides the build and the shared application core. → [Architecture](Architecture.md#runtime)
**Reasons:** dependencies come from npm with exact versions instead of copied files; code shared with MD_Manager moves into MD_Libs, which needs a bundler; ES modules do not load from `file://`, a bundled classic script does.
**Rejected:** Tauri or Electron (toolchain), a local server (an extra process to start), committing `dist/` (generated files in every diff), TypeScript syntax (JSDoc with `checkJs` is checked as strictly), Temporal (support not guaranteed), dayjs and `Intl.DateTimeFormat` (day keys without time zones need only a small date module; `Intl` names differ between platforms), a Markdown library (the files have a fixed structure).

## D9 · UI: Aurora with header pill, Nord scheme

**Decision:** The design direction is "Aurora" with all controls in a floating header pill, scheme Nord (fixed, see D19). → [Design System](ui/DesignSystem.md), [Shell](ui/Shell.md)
**Process:** six directions were compared (Precision, Notebook, Aurora, Console, Editorial, Bento); Aurora was refined over several rounds (portrait week rows, header pill instead of a sidebar).

## D10 · Borders kept inside, none on header and main panel; past periods dimmed

**Decision:** The header pill and the main panel have no border and no light edge; all other surfaces keep their 1px borders. Past periods are dimmed except overdue entries.
**Rejected:** "reduced" (top light edge on outer glass, no inner borders) and "none" (structure dissolves on the Nord background). → [Design System](ui/DesignSystem.md#borders)

## D11 · Birthdays and holidays in the day header

**Decision:** They are badges next to the date, not list items.
**Reasons:** the day list stays a pure task list; the header shows context. → [Views](ui/Views.md#day-header)

## D12 · Contacts as a full editor

**Decision:** Contacts are edited in the app with all fields; `Contacts.md` stays the data source and remains editable by hand.
**Layout:** list on the left, detail on the right. → [Views](ui/Views.md#contacts)

## D13 · Holiday data generated outside the app

**Decision:** `Holidays.md` is a plain file in the folder; its generator is not part of the repository. The generator is the Python script `C:DevClaudeHubprojectsmd-calendarholidays.py`; it fetches the public holidays and school vacations of North Rhine-Westphalia from the OpenHolidays API.

## D14 · Lean tests

**Decision:** Tests concentrate on parsing, recurrence and date logic; browser tests only for critical flows.
**Reasons:** iteration speed. MD_Manager's extensive suite slowed it down. → [AGENTS.md](../AGENTS.md#harness-and-tests)

## D15 · Mobile later, as a PWA with a second storage adapter

**Decision:** See [Mobile](Mobile.md).
**Rejected:** a separate native app; a JSON file in the synced folder with an own mobile UI only (no advantage over the PWA).

## D16 · Logo "Orbit C"

**Decision:** The logo is "Orbit C" and is used everywhere: application header and favicons. → [Design System](ui/DesignSystem.md#logo-orbit-c)
**Reasons:** minimal, strong silhouette that stays legible at 16px; the gold dot echoes "today".
**Rejected:** calendar sheet with "12", glass sheet with "C", "CAL" badge (illegible at favicon size), "C" with check mark.

## D17 · Completion sound "Arpeggio"

**Decision:** Marking an entry as done plays the "Arpeggio", three quick rising sine tones (C6, E6, G6). → [Design System](ui/DesignSystem.md#completion-sound-arpeggio)
**Reasons:** a short, light sense of achievement that fits the calm Aurora UI; brighter and quicker than the MD_Manager sound.
**Rejected:** the unchanged MD_Manager "sweep duo" (low octave glides, too heavy for the calendar) and nine further synthesized candidates: Glass, Drop, Two-tone, Marimba, Kalimba, Click & shimmer, Aurora pad, Glider, Soft.

## D18 · No entry IDs

**Decision:** Entries carry no IDs or hidden markers; they are identified by date, title and position. → [DataFormat](DataFormat.md#entry-identity)
**Reasons:** the files must stay readable and easy to edit by hand, also on a phone.
**Rejected:** visible or hidden IDs per entry (for example HTML comments).

## D19 · No user settings; mute in the header

**Decision:** The UI is fixed by the application: scheme Nord, two lights in the corners at full size and intensity without drift and none in the middle, the borders of D10, dimmed past periods. The only user control is a speaker toggle in the header that mutes the completion sound, with the icons and behavior of MD_Manager; its state is not stored. → [Design System](ui/DesignSystem.md), [Shell](ui/Shell.md#sound-toggle)
**Rejected:** a settings dialog opened from the logo; selectable schemes, adjustable lights and style options; storing the mute state in `Config.md` (it would make muting an undoable, unsaved change).

## D20 · English data format

**Decision:** The whole data format is English: file names (`Contacts.md`, `Holidays.md`), headings, `#Key` lines, labels and fixed values. Only the user's own content is written as entered. → [DataFormat](DataFormat.md)
**Reasons:** one language for everything that code reads, like the UI (D42); only the roadmap is German.
**Rejected:** German file names and keywords as user-facing data.

## D21 · Multi-day entries as metadata blocks

**Decision:** Multi-day entries live in `## Multi-day` as `###` headings with `#Start` and `#End` blocks, like recurring entries. Overlapping bars stack by start date, then longer first, then file order. → [DataFormat](DataFormat.md#calendar), [Views](ui/Views.md)
**Reasons:** same structure as recurring entries; easy to extend.
**Rejected:** a one-line list in its own section, a list item on the start day (`- bis …`), a date range as a heading.

## D22 · Date format DD.MM.YYYY

**Decision:** Dates are `DD.MM.YYYY` everywhere: data files, UI and inputs; a date without a year is `DD.MM.`. Only `UNTIL` inside an `RRULE` keeps the RFC 5545 form. → [Domain](Domain.md#time)
**Rejected:** ISO dates (`YYYY-MM-DD`) in the files.

## D23 · Tags carry an icon

**Decision:** A tag has a color and an icon ID. Tag icons are a fixed, designed set, built like the UI icons but stored in `res/tag-icons/`. An unknown icon ID is reported as an error at startup. → [Domain](Domain.md#tags), [Design System](ui/DesignSystem.md#tag-icons)

## D24 · School vacations only in an overview

**Decision:** School vacations are not shown in the calendar. A button toggles a small overview of all public holidays and the NRW school vacations of the current year. → [Views](ui/Views.md#holiday-overview)
**Rejected:** tinted day cards, a band like a multi-day bar, a badge in the day header.

## D25 · `Config.md` is maintained by hand

**Decision:** `Config.md` is optional. The user creates and edits it by hand; the app only reads it and has no tag management. → [DataFormat](DataFormat.md#configuration)
**Rejected:** creating and editing tags in the app.

## D26 · Multi-day entries in the entry dialog

**Decision:** The entry dialog creates multi-day entries: a range of days picked in the calendar of the date popover. → [Shell](ui/Shell.md#entry-dialog)
**Rejected:** a separate dialog for multi-day entries.

## D27 · Start card instead of an empty app

**Decision:** While no folder is open, the main panel shows a start card with the five most recently opened folders and “Open folder”, as in MD_Manager. The most recently opened folder opens directly while its permission is still granted; the logo leads back to the start card. → [Shell](ui/Shell.md#start-card)
**Reasons:** one obvious first step; one click for the usual case; switching between folders without the system dialog.
**Rejected:** a start card with only the last folder; always showing the start card at startup (the daily calendar should open directly).

## D28 · External changes are never applied silently over local work

**Decision:** A changed file with local changes and any deleted file lead to a persistent choice between “Reload” and “Overwrite”. → [Architecture](Architecture.md#external-changes), [Shell](ui/Shell.md#notifications)
**Rejected:** treating a deleted file as an empty file.

## D29 · No add button per day; no hover-only controls

**Decision:** Days have no add button. A new entry is created with **+**, `A` (on the day under the pointer) or a click on the body of a day. Controls never appear only on hover. → [Interaction](ui/Interaction.md#creating-entries), [AGENTS.md](../AGENTS.md#user-experience)
**Reasons:** the user wants the day cards without buttons; **+** and the dialog's date picker reach every day on touch too.
**Rejected:** an always visible add button per day; showing it only on hover (touch has no hover).

## D30 · Series end with the chosen occurrence; occurrences are never overdue

**Decision:** “End series here” keeps the chosen occurrence as the last one; a whole series is deleted with “Delete series”. Occurrences of recurring entries are never shown as overdue. → [Domain](Domain.md#recurring-entry)
**Reasons:** a daily series would otherwise turn every missed past day red.
**Rejected:** ending the day before; marking all or only the latest missed occurrence as overdue.

## D31 · Multi-day bars are draggable

**Decision:** Dragging a bar moves it with its duration; dragging an end changes start or end. → [Interaction](ui/Interaction.md#drag-and-drop)

## D32 · Tag icon on tiles, bars and in the tag popover; holiday overview in the header

**Decision:** The tag icon appears on entry tiles, multi-day bars and in the tag popover of the entry dialog, where the tags are sorted alphabetically and “No tag” is the default. The holiday overview is a floating panel opened by an icon button in the header with the lists holidays, own vacations and school vacations. → [Views](ui/Views.md), [Shell](ui/Shell.md#entry-dialog)
**Rejected:** tag chips in the dialog itself (too wide with many tags; they live in the tag popover); a year calendar of twelve small months; a fourth view in the view switcher.

## D33 · Birthdays on 29 February show on 28 February

**Decision:** In years without 29 February, a birthday or anniversary on that day shows on 28 February. → [Domain](Domain.md#birthdays-and-anniversaries)
**Rejected:** 1 March.

## D34 · vCard duplicates are merged

**Decision:** An imported contact with the same name, phone number or email address as an existing one is merged into it: missing values are added, nothing is overwritten. → [Domain](Domain.md#vcard-import-and-export)
**Rejected:** skipping duplicates; importing them as new contacts; asking per duplicate.

## D35 · No contact photos; badges with first and last name

**Decision:** Contacts have initials avatars only. Birthday and anniversary badges show first and last name. → [Domain](Domain.md#contact)

## D36 · Vacations are entries with the tag “Vacation”

**Decision:** Entries and multi-day entries with the tag named “Vacation” are listed as own vacations in the holiday overview, between holidays and school vacations. → [Views](ui/Views.md#holiday-overview)
**Rejected:** recognizing vacations by the tag icon; listing multi-day entries only.

## D37 · Selection, internal clipboard and right-click

**Decision:** Entries are selected with a lasso on free space or `Ctrl`+click. A selection is checked off, copied, deleted and dragged together. Copies go to an app-internal clipboard and are pasted with `Ctrl+V` onto the day under the pointer or by a right-click on free space of a day; copies are open. A right-click on an entry copies it, or the whole selection when it belongs to it; there is no context menu, and elsewhere right-click does nothing. → [Interaction](ui/Interaction.md#selection-copy-and-paste)
**Rejected:** duplicating directly on the same day; dragging only single entries while a selection exists; the system clipboard (entries are not plain text).

## D38 · Further shortcuts

**Decision:** `F` opens the search bar at the bottom edge (there is no search button), `C` contacts, `T` today, `?` help panel, `Space`, `Del`, `Ctrl+C`, `Ctrl+X`, `Ctrl+V` for the selection (`Space`, `Del`, `Ctrl+C`, `Ctrl+X` without a selection for the entry under the pointer), `A` on the day under the pointer, `Ctrl+A` selects the day under the pointer, and the mouse wheel switches one week or month per gesture. → [Interaction](ui/Interaction.md#keyboard-shortcuts)
**Rejected:** `Ctrl+K` and `/` for the search.

## D39 · Imported history is done

**Decision:** The ICS import marks entries before today as done, so that years of history do not show as overdue. Events already present are skipped. The import is the second item of the **+** menu (“Import .ics event”), as one more way to add entries, and runs into the open calendar. → [Domain](Domain.md#ics-import), [Shell](ui/Shell.md#header)
**Rejected:** importing everything open.

## D40 · No tooltips for now

**Decision:** All tooltips were removed; icon buttons name their action through `aria-label`. Single tooltips are added back deliberately later; the tooltip system stays. → [Design System](ui/DesignSystem.md#icons)
**Reasons:** the user wants to start without tooltips and add useful ones back one by one.

## D41 · Logo without tile in the browser

**Decision:** Favicons show the mark without tile; only the iOS home screen icon keeps the tile. → [Design System](ui/DesignSystem.md#logo-orbit-c)
**Reasons:** the user wants the logo without a frame wherever possible.

## D42 · English UI

**Decision:** The whole project is English except the roadmap: UI texts, accessible names, notifications, displayed dates, docs and tests. Texts use the short wording of common calendar apps and MD_Manager (“Today”, “Recurring”, “Delete occurrence”, “End series here”). Displayed dates keep the day first (`Thursday, 12 November 2026`, `12 Nov`); numeric dates stay `DD.MM.YYYY`. Shortcut letters follow the English words: `T` today, `C` contacts. The vacation tag is “Vacation” (D36). → [Shell](ui/Shell.md), [Interaction](ui/Interaction.md#keyboard-shortcuts)
**Reasons:** one language with MD_Manager and MD_Libs, whose default texts are English.
**Rejected:** month-first US dates (the data format and MD_Manager put the day first).

## D43 · MD_Calendar.json marks a calendar folder

**Decision:** Every calendar folder holds `MD_Calendar.json` with technical data that does not belong in Markdown: a format version, one entry per device and the hash of each file as the app last saved it. The file is mandatory; a folder without it does not open, and “New calendar” on the start card sets a folder up. The sync client is the user's choice and is named nowhere. → [DataFormat](DataFormat.md#md_calendarjson), [Shell](ui/Shell.md#start-card)
**Reasons:** a later comparison between devices needs data that is independent of device clocks and of file times a sync client rewrites; content hashes and device IDs provide it. Requiring the file keeps the app from opening an arbitrary folder as an empty calendar.
**Rejected:** INI (no standard, flat, untyped); TOML and YAML (need a parser for a file nobody edits by hand); front matter in the Markdown files; timestamps alone as the comparison.

## D44 · No visible keyboard focus

**Decision:** Keyboard navigation of controls is not supported, so keyboard focus is never drawn: no focus ring or outline on buttons, fields or other controls. Text fields keep their focus border while they are edited, and arrow-key navigation in menus and lists keeps marking the current item. → [Interaction](ui/Interaction.md#keyboard-shortcuts)
**Reasons:** keyboard input (shortcuts, typing) made the browser show focus rings on fields and buttons at random; a highlight for a navigation the app does not offer only distracts.
**Rejected:** a styled focus ring, which would promise keyboard navigation the app does not provide.

## D45 · Timed entries arrive in their time slot

**Decision:** Occurrences of recurring entries always sit in their time slot among the normal entries of a day. A normal entry with a time goes into its time slot when it lands on a day (created, pasted, imported, moved to another day in the dialog or by dragging) and when its start time changes; afterwards it stays freely sortable. → [Domain](Domain.md#day-list-order)
**Reasons:** a series at 19:00 above a 09:00 entry misread the day, and so did a new timed entry at the end of the day; placing entries only when they arrive keeps the user's own order intact.
**Rejected:** occurrences always on top; new entries always at the end; sorting all entries by time, which would take the free order away.

## D46 · “+N” enlarges the month cell in place

**Decision:** Month cells show as many entries as fit, with no fixed maximum. “+N” enlarges the cell in place over its neighbors until all entries show; it no longer opens the week. → [Views](ui/Views.md#month)
**Reasons:** a fixed maximum hid entries in cells with room for them; jumping to the week lost the month overview for one look at a day.
**Rejected:** a popover list (drops the cell's look and its drag and drop); opening the week.

## D47 · Ungrouped backlog entries and movable groups

**Decision:** Backlog entries may stand outside any group: in `Backlog.md` directly below `# Backlog`, in the panel above the groups. An untagged entry dropped onto the panel title becomes ungrouped. Groups are reordered by dragging their head. → [Domain](Domain.md#backlog), [DataFormat](DataFormat.md#backlog), [Shell](ui/Shell.md#backlog-panel)
**Reasons:** not every backlog entry fits a group; the format needs no new syntax and old files stay valid. The title as drop area avoids a drop zone that appears on drag start and moves the panel under the pointer.
**Rejected:** a reserved “Ungrouped” group heading; a drop area shown only while dragging.

## D48 · Running outline on overdue entries

**Decision:** Besides their red outline, overdue entries show a border beam: a red light with a fading tail that keeps circling the outline, one lap in 4s; with reduced motion it is hidden. The light and its long tail are 24 dash pieces of one rounded SVG outline, each a step behind and fainter than the one before, all moved by the same stroke dash offset. → [Views](ui/Views.md#entry-tile)
**Reasons:** overdue entries need attention, and a moving light draws the eye without making the tile louder. The fading tail reads as light; moving along the outline keeps the speed constant on every side, and the pieces let the long tail bend around the corners. Overdue tiles are few and small, so repainting their outline each frame is cheap.
**Rejected:** a solid dash running along the outline (it looked like a snake game); a conic gradient rotating around the center (it crawls along the middle of the long sides and rushes over the short ones); animating the gradient angle through `@property` (same unevenness); one straight gradient moved with `offset-path` (a long tail runs straight off the outline at corners and short sides).

## D49 · Focus mode for one day

**Decision:** A double-click on a day header of the week view opens the day as a floating card in front of the blurred app, with full titles, locations and note lines; it reuses the entry tiles and all their actions; drag and drop only reorders entries within the card. The head carries the day's badges instead of buttons; the arrow keys, `Esc` and the background navigate and close. → [Views](ui/Views.md#focus-mode)
**Reasons:** the narrow week columns cut titles and hide notes; a card over the kept context shows one day completely without leaving the week. Reusing the tiles keeps every action consistent.
**Rejected:** a separate day view (loses the week behind it); expanding the column in place (too narrow in landscape, no room for notes).

## D50 · Dragging the days of the week

**Decision:** Holding the middle button on the week drags the days along their axis (sideways in landscape, up and down in portrait); on release they snap to whole days, so that any seven consecutive days can show. The wheel's first gesture, `T`, a view change and a jump outside return to whole weeks; the arrows keep the offset. → [Interaction](ui/Interaction.md#pointer), [Views](ui/Views.md#week-landscape)
**Reasons:** a week boundary often splits what belongs together (a weekend, a trip); the middle button is free on the week and the wheel already means “whole weeks”.
**Rejected:** dragging with the left button (taken by the lasso and drag and drop); keeping the offset on the wheel (two ways to page that disagree).

## D51 · Saving state with a minimum duration

**Decision:** While a save writes, the save control shows “Saving” with a spinner, at least 600ms. → [Shell](ui/Shell.md#save-control)
**Reasons:** saving to a network share takes a noticeable, varying time; a steady state masks it, and the minimum keeps quick saves from flickering.
**Rejected:** a progress bar (the write cycles give no progress); showing the state only above a delay (the control would jump between states).

## D52 · Backlog groups are tags

**Decision:** Every backlog group is a tag and the ungrouped entries are the untagged ones. The tag decides the group of an entry that arrives from outside the backlog; a move between groups gives the entry the new group's tag, a move to the ungrouped entries removes it. `Inbox` is no longer a required group: a `## Inbox` from earlier files is read as ungrouped entries, and quick capture appends there. Tags stay read-only: the app creates no tags and no groups by hand; a click on free space of the panel only adds an entry. → [Domain](Domain.md#backlog), [DataFormat](DataFormat.md#backlog), [Shell](ui/Shell.md#backlog-panel)
**Reasons:** entries carry a tag anyway; groups that mirror the tags sort them without extra work, and a dropped entry can no longer end up in an unrelated group. Keeping `Config.md` hand-maintained keeps colors and icons in one deliberate place.
**Rejected:** the drop position deciding the group regardless of the tag; creating tags from the backlog panel; keeping `Inbox` as a group without a tag.

## D53 · The undo history keeps to real changes

**Decision:** A change and its reversal leave no undo steps, and repeated edits of one contact field are one step. The history compares a fingerprint of the written files after every action and drops the steps back to an equal earlier state; contact field edits carry a coalesce key. Both live in MD_Libs `core/history` as options. → [Architecture](Architecture.md#undo-history)
**Reasons:** clicking done and undone or cycling a phone label grew the undo history and the unsaved count without any change; fixing each operation on its own would miss the next one, while comparing states catches every such cycle.
**Rejected:** per-operation checks (toggle twice, move back); counting changed lines instead of steps (no undo steps would be removed).

## D54 · A lean entry dialog

**Decision:** The entry dialog shows the title and one strip of tokens (date, time, repeat, tag, location, note) ending in Apply. Unset tokens are icons; each token opens a popover of one common width with ready choices, for the time four scroll wheels (start and end, hour and minute). `Tab` walks the tokens and keeps each popover's value; `Enter` applies from everywhere. Several days are a range picked in the date's calendar, the backlog is a choice of the date, tags appear only in their popover, past locations are offered, and the note has room for five lines. There is no heading, no close button and no key icon on Apply. → [Shell](ui/Shell.md#entry-dialog)
**Reasons:** most entries need only a title and the preselected date; everything else was always visible and cost space and attention. Ready choices and a typed field make the common cases one click or one line of typing.
**Rejected:** labeled fields for everything (the previous dialog); natural-language parsing of the title (a second way to the same result, for now); a calendar always open in the dialog; all tags visible at once; a 24-hour clock dial for the time (below the visual standard, and a 24-hour dial does not match how people think of the time of day), a day timeline, hour chips, a duration ring and rolling digits (the other mockups).

## D55 · Lean contacts

**Decision:** Contacts have no groups, no favorites, no nickname, company or position. The list has no filter chips; the detail shows the name as one field and only “vCard” and “Delete” below it. The birthday order is chronological through the year and scrolls to the next birthday. Files of earlier versions are read and the dropped blocks disappear on the next save. → [Domain](Domain.md#contact), [DataFormat](DataFormat.md#contacts), [Views](ui/Views.md#contacts)
**Reasons:** the contact book is streamlined to what it is mainly for, names, ways to reach someone and the dates behind birthdays and anniversaries; the extra fields, filters and actions cost space and attention.
**Rejected:** keeping the data in the file while hiding it in the UI.

## D56 · Next up in the contact list

**Decision:** The contact list shows the next three birthdays and anniversaries as tiles above the sort, in every sort, and hides them while searching. → [Views](ui/Views.md#list)
**Reasons:** the contact book is mainly the source of these dates; what comes next is visible at once without switching to the birthday order.
**Rejected:** a year strip over the list and detail (more room for little information); next-up chips (less readable than tiles in the style of entries); a strip across list and detail.

## Research notes

Open-source projects that were evaluated and what they contributed:

| Project | Finding |
|---|---|
| WeekToDo | Closest concept (weekly planner with day lists), but data in `localStorage`, no sync. |
| Super Productivity | Backlog drawer and planner validate the backlog concept. |
| org-mode | Repeaters with a log of completed occurrences match the done-dates approach. |
| Logseq journals | Ordered to-dos per day confirm the day-list model. |
| calendar.txt | One line per day becomes unwieldy; one entry per line under day headings is better. |
| Obsidian Full Calendar | Recurrence is the weak point of Markdown calendars; justifies the restricted rule set. |
| FluidCalendar, Analog, Keeper.sh | Reference for Google sync code; Keeper.sh is an option for a later calendar sync. |
