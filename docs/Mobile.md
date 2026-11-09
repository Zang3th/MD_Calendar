# Mobile

Mobile access is planned for version 2.0 (see [Roadmap](Roadmap.md)). Goal: the same application as a hosted progressive web app on the iPhone, with reading, creating, checking off and the backlog. Version 1.0 keeps this possible without restructuring through the storage adapter, the `https`-compatible runtime and the version check ([Architecture](Architecture.md)), the tolerant parser ([DataFormat](DataFormat.md#parsing-and-serialization)) and touch-reachable functions ([AGENTS.md](../AGENTS.md#user-experience)).

## Plan

| Topic | Plan |
|---|---|
| Hosting | Static hosting over `https`, for example on the NAS or GitHub Pages. A service worker enables offline use; the app is installed to the iPhone home screen. |
| Storage | A second storage adapter for the Google Drive REST API with OAuth (Google Identity Services, token flow in the browser). Alternative: WebDAV on the NAS. |
| Layout | A third layout for narrow screens, for example a day list or agenda, plus the backlog. |
| Several devices | The single-writer assumption ends. On a conflict the app reloads and re-applies its own unsaved changes, or lets the user decide. |

## Known obstacles

- **Drive permissions:** with the `drive.file` scope the app sees only files it created or that were granted through the Google Picker. Files synced from the desktop are not included. Options: the full `drive` scope (unverified app, acceptable for personal use) or granting through the Picker.
- **Token lifetime:** the browser token flow issues tokens valid for about one hour. Renewal is usually silent, sometimes a popup.
- **Storage eviction in Safari:** iOS clears website storage after seven days without use, except for installed web apps. Drive therefore always holds the truth; local storage is only a cache.

## Interim options before 2.0

- Read the Markdown files directly in the iOS Files app.
- Write an ICS file on save, served by the NAS, subscribed in the iOS calendar (read-only).
- An iOS Shortcut that appends a line to the Inbox group of `Backlog.md` (to be verified with Google Drive as the target).
