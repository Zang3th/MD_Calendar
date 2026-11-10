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

**Decision:** Plain JavaScript with JSDoc, classic scripts, runs from `file://`; dependencies SortableJS and dayjs only. → [Architecture](Architecture.md)
**Rejected:** Tauri or Electron (toolchain and build step), a local server (an extra process to start), TypeScript with a build step, Temporal (support not guaranteed), a Markdown library (the files have a fixed structure).

## D9 · UI: Aurora with header pill, Nord scheme

**Decision:** The design direction is "Aurora" with all controls in a floating header pill (prototype `03b`), scheme Nord (fixed, see D19). → [Design System](ui/DesignSystem.md), [Shell](ui/Shell.md)
**Process:** six directions were compared (Precision, Notebook, Aurora, Console, Editorial, Bento); Aurora was refined over several rounds (portrait week rows, header pill instead of a sidebar).

## D10 · Borders kept, past periods dimmed

**Decision:** All 1px borders stay; past periods are dimmed except overdue entries.
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
**Rejected:** a separate native app; a JSON file in Drive with an own mobile UI only (no advantage over the PWA).

## D16 · Logo "Orbit C"

**Decision:** The logo is "Orbit C" and is used everywhere: application header, favicons, PWA icons. → [Design System](ui/DesignSystem.md#logo-orbit-c)
**Reasons:** minimal, strong silhouette that stays legible at 16px; the gold dot echoes "today".
**Rejected:** calendar sheet with "12", glass sheet with "C", "CAL" badge (illegible at favicon size), "C" with check mark. All options remain in `prototypes/logos/`.

## D17 · Completion sound "Arpeggio"

**Decision:** Marking an entry as done plays the "Arpeggio", three quick rising sine tones (C6, E6, G6). → [Design System](ui/DesignSystem.md#completion-sound-arpeggio)
**Reasons:** a short, light sense of achievement that fits the calm Aurora UI; brighter and quicker than the MD_Manager sound.
**Rejected:** the unchanged MD_Manager "sweep duo" (low octave glides, too heavy for the calendar) and nine further synthesized candidates: Glass, Drop, Two-tone, Marimba, Kalimba, Click & shimmer, Aurora pad, Glider, Soft.

## D18 · No entry IDs

**Decision:** Entries carry no IDs or hidden markers; they are identified by date, title and position. → [DataFormat](DataFormat.md#entry-identity)
**Reasons:** the files must stay readable and easy to edit by hand, also on a phone.
**Rejected:** visible or hidden IDs per entry (for example HTML comments).

## D19 · No user settings; mute in the options menu

**Decision:** The UI is fixed by the application: scheme Nord, lights in the corners at full size and intensity without drift, all borders, dimmed past periods. The only user control is a speaker toggle in the options menu right of **+** that mutes the completion sound, with the icons and behavior of MD_Manager; its state is not stored. → [Design System](ui/DesignSystem.md), [Shell](ui/Shell.md#sound-toggle)
**Rejected:** a settings dialog opened from the logo; selectable schemes, adjustable lights and style options; storing the mute state in `Config.md` (it would make muting an undoable, unsaved change).

## D20 · English data format

**Decision:** The whole data format is English: file names (`Contacts.md`, `Holidays.md`), headings, `#Key` lines, labels and fixed values. Only the user's own content is written as entered. → [DataFormat](DataFormat.md)
**Reasons:** one language for everything that code reads; only the roadmap is German.
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

**Decision:** The entry dialog creates multi-day entries: a small icon next to the date switches to a from–to range. → [Shell](ui/Shell.md#entry-dialog)
**Rejected:** a separate dialog for multi-day entries.

## D27 · Start card instead of an empty app

**Decision:** While no folder is open, the main panel shows a start card with the folder buttons; a remembered folder with a still granted permission opens directly. → [Shell](ui/Shell.md#start-card)
**Reasons:** one obvious first step; one click for the usual case.

## D28 · External changes are never applied silently over local work

**Decision:** A changed file with local changes and any deleted file lead to a persistent choice between „Neu laden“ and „Überschreiben“. → [Architecture](Architecture.md#external-changes), [Shell](ui/Shell.md#notifications)
**Rejected:** treating a deleted file as an empty file.

## D29 · No add button per day; no hover-only controls

**Decision:** Days have no add button. A new entry is created with **+**, `N` (on the day under the pointer), a double-click on a day or the context menu of a day. Controls never appear only on hover. → [Interaction](ui/Interaction.md#creating-entries), [AGENTS.md](../AGENTS.md#user-experience)
**Reasons:** the user wants the day cards without buttons; **+** and the dialog's date picker reach every day on touch too.
**Rejected:** an always visible add button per day; showing it only on hover, as in the prototype (touch has no hover).

## D30 · Series end with the chosen occurrence; occurrences are never overdue

**Decision:** „Ab hier beenden“ keeps the chosen occurrence as the last one; a whole series is deleted with „Serie löschen“. Occurrences of recurring entries are never shown as overdue. → [Domain](Domain.md#recurring-entry)
**Reasons:** a daily series would otherwise turn every missed past day red.
**Rejected:** ending the day before; marking all or only the latest missed occurrence as overdue.

## D31 · Multi-day bars are draggable

**Decision:** Dragging a bar moves it with its duration; dragging an end changes start or end. → [Interaction](ui/Interaction.md#drag-and-drop)

## D32 · Tag icon on tiles, bars and in the tag dropdown; holiday overview in the header

**Decision:** The tag icon appears on entry tiles, multi-day bars and in the tag dropdown of the entry dialog, where the tags are sorted alphabetically and „Kein Tag“ is the default. The holiday overview is a floating panel opened by an icon button in the header with the lists holidays, own vacations and school vacations. → [Views](ui/Views.md), [Shell](ui/Shell.md#entry-dialog)
**Rejected:** tag chips in the dialog (too wide with many tags); a year calendar of twelve small months; a fourth view in the view switcher.

## D33 · Birthdays on 29 February show on 28 February

**Decision:** In years without 29 February, a birthday or anniversary on that day shows on 28 February. → [Domain](Domain.md#birthdays-and-anniversaries)
**Rejected:** 1 March.

## D34 · vCard duplicates are merged

**Decision:** An imported contact with the same name, phone number or email address as an existing one is merged into it: missing values are added, nothing is overwritten. → [Domain](Domain.md#vcard-import-and-export)
**Rejected:** skipping duplicates; importing them as new contacts; asking per duplicate.

## D35 · No contact photos; badges with first and last name

**Decision:** Contacts have initials avatars only. Birthday and anniversary badges show first and last name, never the nickname. → [Domain](Domain.md#contact)

## D36 · Vacations are entries with the tag „Urlaub“

**Decision:** Entries and multi-day entries with the tag named „Urlaub“ are listed as own vacations in the holiday overview, between holidays and school vacations. → [Views](ui/Views.md#holiday-overview)
**Rejected:** recognizing vacations by the tag icon; listing multi-day entries only.

## D37 · Selection, internal clipboard and context menu

**Decision:** Entries are selected with a lasso on free space or `Ctrl`+click. A selection is checked off, copied, deleted and dragged together. Copies go to an app-internal clipboard and are pasted onto a day by its context menu or `Ctrl+V` on the day under the pointer; copies are open. Right-click opens a context menu. → [Interaction](ui/Interaction.md#selection-copy-and-paste)
**Rejected:** duplicating directly on the same day; dragging only single entries while a selection exists; the system clipboard (entries are not plain text).

## D38 · Further shortcuts

**Decision:** `F` search, `K` contacts, `?` shortcut overview, `Space`, `Del`, `Ctrl+A`, `Ctrl+C`, `Ctrl+V` for the selection, `N` on the day under the pointer, and the mouse wheel switches one week or month per gesture. → [Interaction](ui/Interaction.md#keyboard-shortcuts)
**Rejected:** `Ctrl+K` and `/` for the search.

## D39 · Imported history is done

**Decision:** The ICS import marks entries before today as done, so that years of history do not show as overdue. Events already present are skipped. → [Domain](Domain.md#ics-import)
**Rejected:** importing everything open.

## D40 · No tooltips for now

**Decision:** All tooltips were removed; icon buttons name their action through `aria-label`. Single tooltips are added back deliberately later; the tooltip system stays. → [Design System](ui/DesignSystem.md#icons)
**Reasons:** the user wants to start without tooltips and add useful ones back one by one.

## D41 · Logo without tile in the browser

**Decision:** Favicons and the regular PWA icons show the mark without tile; only the iOS home screen icon and the maskable icon keep the tile. → [Design System](ui/DesignSystem.md#logo-orbit-c)
**Reasons:** the user wants the logo without a frame wherever possible.

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
