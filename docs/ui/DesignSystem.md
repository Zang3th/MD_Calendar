# Design System

The visual language of MD_Calendar. The values below are authoritative; the approved prototype ([prototypes/README.md](../../prototypes/README.md)) shows them in use.

## Visual language: Aurora

- Dark only. There is no light theme.
- Translucent glass surfaces float above a dark base with soft colored background lights.
- Every day is a card. Entries are rounded tiles tinted with their tag color.
- Calm by default: color and motion are used for state and attention, not for decoration.
- Fixed by the application. There are no appearance settings; scheme, lights, borders and past dimming are exactly as defined here.

## Color tokens

### Scheme: Nord

| Token | Value | Use |
|---|---|---|
| `--base` | `#0e1520` | Page background |
| `--g1` | `rgba(94,129,190,.58)` | Background light 1 |
| `--g2` | `rgba(110,200,225,.34)` | Background light 2 |
| `--g3` | `rgba(180,142,200,.20)` | Background light 3 |
| `--accent` | `#8fd8ee` | Primary accent: today, selection, focus, KW badge |
| `--accent-2` | `#c9a2e0` | Secondary accent: holidays, gradients |
| `--warm` | `#f3cf7e` | Birthdays, anniversaries, favorites |
| `--panel` | `#182235` | Opaque tint for floating panels and dialogs |
| `--on-accent` | `#07121a` | Text on accent fills |
| `--tag-s` | `62%` | Saturation applied to tag hues |
| `--tag-l` | `68%` | Lightness applied to tag hues |

### Shared tokens

| Token | Value | Use |
|---|---|---|
| `--text` | `#f1eefc` | Primary text |
| `--muted` | `rgba(241,238,252,.68)` | Secondary text |
| `--faint` | `rgba(241,238,252,.58)` | Tertiary text, placeholders |
| `--deco` | `rgba(241,238,252,.30)` | Decorative strokes only, never text |
| `--glass` | `rgba(255,255,255,.07)` | Glass panels |
| `--glass-2` | `rgba(255,255,255,.11)` | Hover and pressed surfaces |
| `--edge` | `rgba(255,255,255,.12)` | Glass panel borders |
| `--card` | `rgba(255,255,255,.06)` | Day cards, month cells, editor sections |
| `--card-edge` | `rgba(255,255,255,.09)` | Card borders |
| `--item` | `rgba(255,255,255,.08)` | Entries without tag, inline controls |
| `--item-edge` | `rgba(255,255,255,.09)` | Entry borders |
| `--tint-a` / `--tint-b` | `.30` / `.13` | Tag tint gradient strength on entries |
| `--tint-edge` | `.34` | Tag-tinted entry border alpha |
| `--danger` | `#ff8fa3` | Overdue, delete |
| `--ok` | `#6ee7b7` | Saved state |
| `--warn` | `#fcd34d` | Unsaved state |

### Contrast

Measured as WCAG 2 contrast against the rendered background (glass, tints and lights included):

| Content | Minimum |
|---|---|
| Readable text, including secondary and tertiary text, placeholders and labels | 4.5:1 |
| Large text (24px, or 18.7px bold) | 3:1 |
| De-emphasized states: done entries, past periods, days outside the month | 3:1, target 3.5:1 and more |
| Controls and their states (check boxes, focus rings, selected states) | 3:1 |
| Disabled controls, decorative borders | no minimum |

- Never lower text contrast with `opacity` on the text itself; use a lighter or darker color token. Opacity is allowed only for whole de-emphasized tiles (done, past).
- Accent-colored text on accent tints uses a lightened accent (accent mixed with white), not the raw accent.
- Minimum text size is 11px.

### Surface hierarchy

Surfaces stack in a fixed order, and every nested surface is one step **lighter** than its parent:

| Level | Surfaces | Token |
|---|---|---|
| 0 | Page | `--base` |
| 1 | Header pill, main panel, backlog panel | `--glass` |
| 2 | Day cards, month cells, contact list and detail, editor sections | `--card` |
| 3 | Entries, chips, labels, buttons | `--item` |

Search fields and segmented controls are the only exception: they are recessed wells, slightly darker than their surroundings. The same kind of element always uses the same level, in every view.

Tag colors come from the configuration. The UI derives tints from the tag hue with `--tag-s`, `--tag-l` and the tint tokens.

## Background lights

Three soft radial lights in the scheme colors `--g1` to `--g3`.

| Property | Value |
|---|---|
| Arrangement | Corners |
| Size | 100 % |
| Intensity | 100 % |
| Drift | none |

## Borders

All surfaces keep their 1px borders.

## Past periods

Past days are dimmed:

- the day card fill is reduced; the weekday uses `--faint`, the date `--muted`,
- entries on past days drop to 55 % opacity and return to near full opacity on hover,
- multi-day bars that have ended drop to 60 % opacity and lose some saturation,
- birthday and holiday badges on past days drop to 70 % opacity.

The values keep past content at the de-emphasized contrast minimum (see [Contrast](#contrast)).

Overdue entries are excluded and keep full visibility.

## Typography

- Font: Plus Jakarta Sans, weights 400 to 800, stored locally.
- Body text 13.5px. Headings are bold (800) with slightly negative letter spacing.
- Times and counters use tabular figures.

## Spacing

Scale: 2, 4, 6, 8, 10, 12, 14, 16, 22 px. Every padding, margin and gap uses a value of the scale. The only exceptions are derived values and optical corrections:

- Day cards are laid out with 5px on each side, half of the 10px gap between cards, so that multi-day bars can use equal columns.
- The check box of an entry sits 1px lower to align with the first text line.
- Positions computed from other values: the backlog panel starts below the header pill (14px + header height + 14px), the main panel makes room for it (panel width + 14px), and notifications sit 28px above the window edge (page spacing plus main panel padding).

| Area | Spacing |
|---|---|
| Page | 14px around the header pill, main panel and backlog panel; 14px between them |
| Header pill | padding 8px 10px 8px 12px; 14px between the three groups; 10px inside a group; 6px between icon and label in the view switcher; save control padding 0 10px, 6px between dot, label and counter |
| Main panel | padding 16px |
| Week | 10px between day cards; day header padding 0 14px 0 16px, 4px between weekday and date, 4px between badges; day list padding 4px 10px 10px |
| Entries in a day | 6px between entries; entry padding 8px 10px; 8px between check box and text |
| Month | 8px between cells; cell padding 0 6px 6px; 4px between entries; entry padding 0 8px; „+N“ 4px below the entries; ISO week number 8px from the top |
| Backlog panel | padding 16px 14px; 16px between groups; 6px between entries; counter 2px 8px |
| Holiday overview | padding 12px; rows 6px |
| Entry dialog | padding 22px; 16px between sections; 10px between fields; field padding 12px 14px; buttons 8px 16px, in the footer 8px 10px |
| Start card | padding 22px |
| Contacts | 14px between list and detail; list padding 12px; detail padding 22px |
| Chips and badges | chips 6px 12px; badges 2px 8px (month 2px 6px, portrait week 4px 8px); „+X“ 0 6px; 6px between chips |
| Tooltip | padding 6px 10px |

## Shape

| Element | Radius |
|---|---|
| Header pill, main panel, backlog panel | 22–24px |
| Day card | 20px |
| Contact editor sections and cards | 18–20px |
| Month cell | 16px |
| Entry | 13px (8px in the month view) |
| Multi-day bar | 11px (7px in the month view) |
| Buttons and inputs | 9–12px |
| Chips, pills, badges | fully rounded |

## Logo: Orbit C

- A bold "C" drawn as an open ring in the brand gradient (`--accent` → `--accent-2` → `--warm`), with a gold `--warm` dot in the opening that stands for "today".
- App icon: the mark on a rounded tile in `--base` with soft background lights. Inside the UI the mark is used cut out, without a tile (`mark.svg`), for example in the header.
- All shapes are paths; no font is involved. The assets must not be redrawn or recolored.
- The complete web icon set lives in `res/logo/`:

| File | Use |
|---|---|
| `logo.svg` | Master with tile |
| `mark.svg` | Mark without tile, tightly cropped; header logo (32px) |
| `icon.svg`, `favicon.ico`, `favicon-16/32/48.png` | Favicons |
| `apple-touch-icon.png` | iOS home screen |
| `icon-192.png`, `icon-512.png`, `maskable-512.png` | PWA icons |
| `mask-icon.svg` | Monochrome contexts |
| `site.webmanifest` | Web app manifest; scope and start URL point to the application root |
| `head.html` | `<head>` tags for `MD_Calendar.html`, with paths relative to the application root |

## Icons

Line icons as inline SVG with a 2px stroke and round caps and joins. No emoji and no platform icons. The icon system is taken over from MD_Manager:

- Every icon is a `<symbol id="icon-…">` in one inline sprite in `MD_Calendar.html` and is used with `<use href="#icon-…">`. There are no icon fonts and no `<img>` icons.
- Icons are drawn on a 32×32 canvas and displayed at 16×16px, so a stroke width of 4 renders as a crisp 2px line. Fine details may use 3 (1.5px).
- Stroke and fill use `currentColor`; the button's state colors the icon.
- Optical centering and pixel alignment are done with a `translate` group inside the symbol (for example `translate(.5 .5)` or `translate(-.625 0)`), never with CSS offsets.
- Every symbol also exists as a standalone file `res/icons/<name>.svg` with identical geometry. A unit test checks that file and symbol match.
- A toggle shows both of its icons in the markup; CSS shows one of them based on the button's `aria-pressed` state. The markup is never swapped.
- `volume.svg` (speaker with two sound waves) and `muted.svg` (speaker with an X) are copied from MD_Manager unchanged.

## Tag icons

Every tag has an icon, referenced by its icon ID in `Config.md` (see [DataFormat](../DataFormat.md#configuration)). The icons are a fixed, designed set that ships with the application; users cannot add their own.

- Tag icons are built exactly like the UI icons (see [Icons](#icons)): 32×32 canvas, shown at 16px, `currentColor`, inline `<symbol>` plus an identical standalone file.
- They live in their own folder, `res/tag-icons/<icon-id>.svg`, and their symbols use the ID `tag-<icon-id>`, so they never collide with UI icons.
- The icon ID is lowercase ASCII with hyphens, for example `home` or `shopping-cart`.

## Motion

- Short, interruptible, compositor-friendly transitions (transform, opacity).
- The view switcher indicator slides between options; panels slide in.
- Jumping to today scrolls smoothly and pulses the target day once.
- `prefers-reduced-motion` disables non-essential motion.

## Completion sound: Arpeggio

Three quick sine tones rising through a C major triad. When it plays is defined in [Interaction](Interaction.md#checking-off); how it is built in [Architecture](../Architecture.md#systems-adopted-from-md_manager).

| Voice | Note | Frequency | Start | Attack | Hold | Release | Peak gain |
|---|---|---|---|---|---|---|---|
| 1 | C6 | 1046.50 Hz | 0 ms | 4 ms | 20 ms | 320 ms | 0.70 |
| 2 | E6 | 1318.51 Hz | 55 ms | 4 ms | 20 ms | 320 ms | 0.70 |
| 3 | G6 | 1567.98 Hz | 110 ms | 4 ms | 40 ms | 550 ms | 0.75 |

- Envelope: exponential from 0.0001 to the peak, held, exponential back to 0.0001.
- Mix: master gain 0.09; each voice goes 70 % dry and 30 % into the plate reverb.
- Plate reverb: the MD_Manager impulse (1 s, stereo, seeded noise with cubic decay).
- Length about 0.7 s plus reverb tail. A new completion stops the sound that is still playing.
