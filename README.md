# MD_Calendar

A local-first calendar built around ordered to-do lists per day, with a backlog and a contact book. All data lives in human-readable Markdown files in a synced folder. It runs directly from the local filesystem in Chrome or Edge, without installation or a server.

## Status

Concept, documentation and the approved UI prototype are complete. The harness, the vendored dependencies and an empty application skeleton (`MD_Calendar.html`, `app.js`, `styles.css`) are in place. The next release is 0.1.0 "Wochenkalender" in the [Roadmap](docs/Roadmap.md).

To see the intended UI, open [`prototypes/03b-aurora-header.html`](prototypes/03b-aurora-header.html) in Chrome or Edge (details in [prototypes/README.md](prototypes/README.md)).

## Documentation map

Each topic has exactly one owning document.

| Topic | Document |
|---|---|
| Rules for agents and contributors | [AGENTS.md](AGENTS.md) |
| Vision, problems solved, scope, out of scope, cutover | [docs/Product.md](docs/Product.md) |
| Business model and rules: entries, day order, recurrence, backlog, tags, contacts, holidays, imports | [docs/Domain.md](docs/Domain.md) |
| Calendar folder, files, storage rules, parsing rules, format drafts | [docs/DataFormat.md](docs/DataFormat.md) |
| Runtime, dependencies, layers, storage adapter, saving, external changes, undo, notifications, startup, systems adopted from MD_Manager | [docs/Architecture.md](docs/Architecture.md) |
| Visual language, color tokens, lights, borders, past dimming, typography, spacing, shapes, logo, icons, tag icons, motion, completion sound | [docs/ui/DesignSystem.md](docs/ui/DesignSystem.md) |
| Page layout, header, save control, backlog panel, entry dialog, notifications, settings | [docs/ui/Shell.md](docs/ui/Shell.md) |
| Week, month and contacts views; entry tiles; day header badges | [docs/ui/Views.md](docs/ui/Views.md) |
| Shortcuts, drag and drop, editing, undo, deleting | [docs/ui/Interaction.md](docs/ui/Interaction.md) |
| Mobile phase: plan, obstacles, interim options | [docs/Mobile.md](docs/Mobile.md) |
| Decisions with reasons and rejected alternatives, research notes | [docs/Decisions.md](docs/Decisions.md) |
| Unresolved questions | [docs/OpenQuestions.md](docs/OpenQuestions.md) |
| Work packages and progress (German, user-owned) | [docs/Roadmap.md](docs/Roadmap.md) |
| Active work specification | [docs/work/current.md](docs/work/current.md) |
| Prototypes and the approved visual reference | [prototypes/README.md](prototypes/README.md) |

## Repository layout

```text
AGENTS.md  CLAUDE.md  README.md
docs/         documentation (see the map above)
  ui/         UI specification
  work/       active work specification
prototypes/   UI mockups; 03b is the approved reference
data/parsing/ golden files that define the data format
res/logo/     final logo and web icon set
res/icons/    standalone SVG files of the UI icons
res/tag-icons/ standalone SVG files of the tag icons
vendor/       SortableJS, dayjs, Plus Jakarta Sans
tools/        architecture checker
tests/        unit/ (node:test), e2e/ (Playwright)
types/        type declarations for checkJs
```

## Development

Requires Node.js. Once after cloning:

```sh
npm install
npx playwright install chromium
```

`npm run verify` runs type checking, linting, the architecture checker, the unit tests and the browser tests and stops at the first failure. It is the Definition of Done (see [AGENTS.md](AGENTS.md#harness-and-tests)).

The planned application layout is described in [docs/Architecture.md](docs/Architecture.md#layers).
