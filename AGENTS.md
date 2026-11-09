# AGENTS.md

Rules for every agent working in this repository. This file contains rules only; knowledge about the product lives in `docs/`. Start with the documentation map in [README.md](README.md).

## Principles

- Implement only what is explicitly requested, using the smallest localized solution.
- Preserve existing and unrelated behavior.
- The documents in `docs/` are the specification. Follow them literally. When a request conflicts with them or leaves product behavior open, ask instead of inventing behavior, and record the answer in the owning document.
- Runtime, technology and production dependencies are fixed in [Architecture](docs/Architecture.md#runtime). Test-only dependencies and package tooling are allowed.
- Do not add unrequested features, abstractions, fallbacks, configuration or polish.
- MD_Manager (`../MD_Manager`) is the reference for structure and for the systems listed in [Architecture](docs/Architecture.md#systems-adopted-from-md_manager). Copy deliberately and adapt; never copy blindly and never share code between the repositories.

## Documentation

- **Single source of truth.** Every fact lives in exactly one document; the map in [README.md](README.md) says which. Link to it instead of restating it. When a change makes a statement elsewhere obsolete, update or remove that statement in the same change.
- **Language.** `docs/Roadmap.md` is German. Every other file is English: documentation, code, comments, identifiers, and the entire data format (file names, headings, `#Key` lines, labels, fixed values, golden files). User-facing text in the application is German.
- **Roadmap.** `docs/Roadmap.md` is owned by the user and changes only on explicit request. It uses the MD_Manager Markdown layout.
- **Keep docs current.** A change in behavior, format or architecture updates the owning document in the same change.
- **Decisions and questions.** A new product or technical decision is appended to [Decisions](docs/Decisions.md); a changed decision is rewritten in place and a dropped one removed. Never keep superseded decisions or history in the documentation. A resolved question is removed from [Open Questions](docs/OpenQuestions.md) and its outcome is written to the owning document.

## Architecture

- [Architecture](docs/Architecture.md) is binding: runtime, layers and their boundaries, storage adapter, saving, external changes, undo history, notifications and startup. Never cross a layer boundary and never bypass the storage adapter, the version check or the undo history.

## Data

- The golden files in `data/parsing/` define the data format; [DataFormat](docs/DataFormat.md) explains them.
- Never modify a golden file unless explicitly instructed.
- Browser storage (IndexedDB, `localStorage`) holds per-device conveniences only, such as the folder handle or the last view. Never calendar, backlog, contact or configuration data.

## User Interface

- [Design System](docs/ui/DesignSystem.md), [Shell](docs/ui/Shell.md), [Views](docs/ui/Views.md) and [Interaction](docs/ui/Interaction.md) are binding. Deviations need the user's approval.
- [prototypes/README.md](prototypes/README.md) names the approved visual reference. Where a document and the prototype disagree, the document wins.
- Prototype code is not production code. Do not load or import anything from `prototypes/` in the application; port behavior deliberately into the layered structure.
- Do not modify the prototypes unless explicitly asked.

## User Experience

- Deliver immediate and predictable feedback without layout shifts, jumping content, transient wrong states or avoidable latency.
- Use repository-local fonts and inline SVG icons. Do not rely on emoji, platform icons or unspecified font fallbacks where they affect layout.
- Keep spacing, typography, colors, borders, hover, active, focus, disabled and ARIA states consistent across equivalent components.
- Preserve user context across view changes, including scroll positions, open panels and the selected contact.
- Use short, interruptible, compositor-friendly animations and respect `prefers-reduced-motion`.
- Every function must be reachable by pointer and touch. Nothing may be available only on hover or only by keyboard; controls are always visible, hover only adds a surface or emphasis.

## Performance

- Treat compute time, memory, layout, painting and allocations as finite. Do not choose knowingly naive algorithms or data flows because the test data is small; a calendar accumulates years of entries.
- Do not parse, serialize, expand recurrences, traverse or render again when neither the input nor the relevant environment changed. Cache derived values with explicit, minimal invalidation and keep caches bounded.
- Prefer targeted state and DOM updates over rebuilding a view for a local change.
- Group DOM reads and writes into separate phases; never alternate them inside loops.
- Coalesce resize, scroll and observer work into at most one pending animation frame.
- Keep interaction handlers short. Disconnect observers and listeners when their lifecycle ends.

## Work Specification

- For non-trivial behavior, format, architecture or harness changes, keep the active specification in `docs/work/current.md`: outcome, scope boundaries, affected documents and contracts, acceptance criteria and planned test coverage. Trivial corrections may use a short specification.
- Keep exactly one active work item. Check the specification for unhappy paths, persistence, undo/redo, conflicts, portrait and landscape before implementing.
- Implement in small steps that each leave the project working. Update the specification before expanding scope.
- Finish with a short review: changed files and why, evidence for each acceptance criterion, commands run with results, and remaining risks.
- After completion, reset `docs/work/current.md` to its empty state.

## Harness and Tests

The test suite is deliberately lean so that iteration stays fast. Every test must be able to catch a real defect that no cheaper test catches.

- `npm run verify` is the Definition of Done. It runs type checking, linting, the architecture checker and the tests, and fails fast.
- Use `node:test` for `domain/` and the parsers and serializers in `io/`: golden-file round trips, recurrence expansion, date logic, moves between calendar and backlog, undo actions.
- Use Playwright only for critical flows that need a real browser: opening the folder and saving with the version check, external changes, drag and drop, wiring of undo and redo, the contact editor's commit and focus behavior.
- No visual baseline screenshots until the implemented UI has stabilized; then the user decides.
- Tests are deterministic, isolated and order-independent. Wait for observable states, never for fixed delays. Browser tests fail on console errors.
- Never weaken a check or remove coverage of intended behavior to make a change pass.
- Do not commit focused or skipped tests.
