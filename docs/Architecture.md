# Architecture

Technical structure of the application. This document is binding for all code (see [AGENTS.md](../AGENTS.md#architecture)).

## Runtime

- Plain HTML, CSS and JavaScript, started by opening `MD_Calendar.html` from the local filesystem. No build step, no server, no CDN at runtime.
- The same files run unchanged from an `https` origin, because the mobile phase hosts them (see [Mobile](Mobile.md)). Nothing may depend on `file://`.
- Fonts are loaded only through `@font-face`. A `<link rel="preload">` for a font needs CORS and is blocked under `file://`.
- File access uses the File System Access API (`showDirectoryPicker`). Supported browsers are therefore Chromium-based (Chrome, Edge).
- Classic deferred scripts share one global namespace, `window.MDCalendar`. ES modules do not load from `file://` and are not used.
- Code is typed with JSDoc and checked by TypeScript (`checkJs`, strict) through `jsconfig.json`.
- Transient application state is plain JavaScript data.

## Production dependencies

| Dependency | Use |
|---|---|
| SortableJS | Drag and drop of entries within a day, between days, and between days and the backlog. Supports touch. |
| dayjs (UMD build, required plugins only) | Date arithmetic, formatting, ISO weeks. Local time only; no time zone plugins. |
| Plus Jakarta Sans | UI font, stored locally. |

These are the only production dependencies. They are stored locally under `vendor/`; adding another one needs the user's approval. Recurrence rules are implemented in the domain layer; no recurrence library is used.

## Layers

| Layer | Responsibility | Must not |
|---|---|---|
| `domain/` | Business rules and state transitions: day lists, moves, recurrence expansion, backlog, contacts, derived birthdays, search, ICS import into the calendar, undo history. | Access the DOM, browser APIs, files, storage adapters or SortableJS. |
| `io/` | Storage adapters, Markdown parsing and serialization per file type, ICS and vCard conversion. | Access the DOM. Parsers and serializers additionally must not access files or browser APIs. |
| `ui/` | Rendering of state, DOM events, SortableJS callbacks, panels, dialogs, notifications. | Contain business or persistence logic, or change persistent data without a domain operation. |
| `app.js` | Wires the layers together, owns startup, saving and external change handling. | Contain business rules. |

All file access goes through the [storage adapter](#storage-adapter). Every change to persistent data is an action in the [undo history](#undo-history).

dayjs is allowed in `domain/` and `io/`; it is a pure library and runs in Node.js for unit tests.

Layout:

```text
MD_Calendar.html  app.js  styles.css
domain/   calendar.js  recurrence.js  backlog.js  contacts.js  search.js  history.js
io/       storage.js  calendar-format.js  backlog-format.js  contacts-format.js
          holidays-format.js  config-format.js  ics.js  vcard.js
ui/       tiles.js  render-week.js  render-month.js  render-contacts.js  header.js  start.js  backlog-panel.js
          holidays-panel.js  search-panel.js  menus.js  pickers.js  dialog.js  interactions.js
          notifications.js  tooltips.js  sounds.js
vendor/   sortable/  dayjs/  fonts/
res/logo/ logo and web icon set
res/icons/ standalone SVG files of the UI icons
res/tag-icons/ standalone SVG files of the tag icons
data/parsing/   golden files, one per file type
tools/    check-architecture.js
tests/    unit/  e2e/
types/    type declarations for checkJs
```

## Storage adapter

One small interface. Domain and UI never know which adapter is active.

| Operation | Contract |
|---|---|
| `listFiles()` | Names of the calendar files present in the folder. |
| `read(name)` | File text and a version stamp; `null` for a missing file. |
| `stat(name)` | Current version stamp without reading the text; `null` for a missing file. |
| `write(name, text, expected)` | Writes only if the file still matches `expected` and returns the new stamp. `expected` is `null` to create a file that must not exist yet. A mismatch fails with a `StorageConflictError` that carries the current text and stamp (`null` for a deleted file). |

All writes run through one serialized write queue.

Until the mobile phase there is one adapter for a local folder (`io/storage.js`). Its version stamp is the file's modification time and size. It also remembers the last opened folder handle in IndexedDB (see [Startup](#startup)). The mobile phase adds a second adapter (see [Mobile](Mobile.md)).

## Saving

- Saving is explicit (`Ctrl+S` or the save control). There is no autosave and no draft recovery after a crash.
- Every file tracks whether it has unsaved changes. Saving writes all changed files through a serialized write queue. `Calendar.md`, `Backlog.md` and `Contacts.md` are written; `Holidays.md` and `Config.md` are only read. `Contacts.md` is written last.
- When the latest move between the calendar and the backlog went into the backlog, `Backlog.md` is written first, otherwise `Calendar.md` (see [DataFormat](DataFormat.md#rules-for-the-calendar-file)). A missing file is created only when its content differs from an empty one.
- Every write checks the version first. A mismatch never overwrites silently; the user chooses between reloading and overwriting.
- Closing the page with unsaved changes triggers the browser's leave warning.

## External changes

While the page is visible, the stamps of loaded files are checked every two seconds and on every return to the page.

- A changed file without local changes is reloaded and a notification says so.
- A changed file with local changes leads to the reload-or-overwrite choice.
- A deleted file always leads to the reload-or-overwrite choice; it is never emptied silently.
- A write whose stamp no longer matches but whose file content is unchanged (a sync client touched the file) is retried once with the new stamp.
- No reload happens while the entry dialog is open.
- External changes are handled per file. A changed `Holidays.md` or `Config.md` is always reloaded.
- „Neu laden“ reads `Calendar.md`, `Backlog.md` and `Contacts.md` again and discards all local changes. Every reload of a written file starts a new undo history.

## Undo history

- Every change to persistent data is one action with a label, an `undo` and a `redo` function, and the view state before and after. This covers calendar entries, backlog and contacts.
- An operation that touches several files, such as moving an entry from the backlog into the calendar, is one action.
- The history is capped by entry count and memory size.
- The number of unsaved changes shown in the UI is the distance between the current history position and the position at the last save. When the data serializes to exactly the files on disk again (an entry moved up and back down), the current position becomes the saved one and the count is 0, as MD_Manager compares with the saved text. It survives trimming; when new actions discard a redo branch that contains the saved state, the discarded steps are added to the distance.
- Reloading a file starts a new history.

## Notifications

- Severities: info, warning, error. Info and warnings dismiss themselves after a few seconds; errors stay until dismissed and offer copyable details.
- Every error carries a stable code with the prefix `MDC-`. `MDC-0xx` are startup errors, `MDC-1xx` opening the folder, `MDC-2xx` saving and file checks, `MDC-3xx` configuration.
- Unexpected errors and unhandled promise rejections are reported as errors.

## Startup

- Startup checks that all application files, resources and required browser APIs are present. A missing requirement blocks the app with a fatal notification instead of running in a broken state.
- The last opened folder handle is kept in IndexedDB so the folder can be reopened with one click. When its permission is still granted, it opens automatically (see [Shell](ui/Shell.md#start-card)). Under `file://` Chrome asks for permission again in each session; that is accepted.

## Systems adopted from MD_Manager

MD_Manager (`../MD_Manager`) solves several of these problems already. Code is copied and adapted, never shared between the repositories.

| System | Source in MD_Manager | Adaptation |
|---|---|---|
| Undo history | `domain/history.js` | Take over as is; namespace and type names change. |
| Notifications | `ui/notifications.js` | Take over; error code prefix `MDC-`; restyle to the [Design System](ui/DesignSystem.md). |
| File access with conflict detection and write queue | `io/files.js` | Becomes the local folder storage adapter; works on a directory handle and several files. |
| External change detection, reload or overwrite | `app.js` | Per file instead of one project file. |
| Recent file handles in IndexedDB | `io/files.js` | One remembered folder instead of a list of files. |
| Startup checks and fatal notifications | `app.js` | Take over. |
| Tooltips | `ui/tooltips.js` | Take over and restyle. |
| Completion sound | `ui/sounds.js` | Take over the playback structure: synthesized with the Web Audio API, no audio files, mutable. The sound itself is replaced by the [Arpeggio](ui/DesignSystem.md#completion-sound-arpeggio). |
| Architecture checker | `tools/check-architecture.js` | Adapt to the layer rules above. |
| Test setup | `tests/`, `package.json` | Reduced to the lean test policy in [AGENTS.md](../AGENTS.md). |

Not adopted: the MD_Manager themes and its Markdown layout.
