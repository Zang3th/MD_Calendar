# Design System

The visual language of MD_Calendar. The values below are authoritative.

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
| `--accent` | `#8fd8ee` | Primary accent: today, selection, focused text fields, current week number |
| `--accent-2` | `#c9a2e0` | Secondary accent: holidays, gradients |
| `--warm` | `#f3cf7e` | Birthdays |
| `--heart` | `#ff8a8a` | Anniversaries |
| `--dayoff` | `#8ee0b0` | Days off |
| `--panel` | `#182235` | Opaque tint for floating panels and dialogs |
| `--on-accent` | `#07121a` | Text on accent fills |
| `--tag-s` | `62%` | Saturation applied to tag hues |
| `--tag-l` | `68%` | Lightness applied to tag hues |

### Shared tokens

| Token | Value | Use |
|---|---|---|
| `--text` | `#f1eefc` | Primary text |
| `--muted` | `rgba(241,238,252,.70)` | Secondary text |
| `--faint` | `rgba(241,238,252,.66)` | Tertiary text, placeholders |
| `--deco` | `rgba(241,238,252,.30)` | Decorative strokes only, never text |
| `--glass` | `rgba(255,255,255,.08)` | Glass panels |
| `--glass-2` | `rgba(255,255,255,.11)` | Hover and pressed surfaces |
| `--edge` | `rgba(255,255,255,.12)` | Glass panel borders |
| `--card` | `rgba(255,255,255,.05)` | Day cards, month cells, editor sections |
| `--card-edge` | `rgba(255,255,255,.09)` | Card borders |
| `--item` | `rgba(255,255,255,.08)` | Entries without tag, inline controls |
| `--item-edge` | `rgba(255,255,255,.09)` | Entry borders |
| `--tint-a` / `--tint-b` | `.30` / `.13` | Tag tint gradient strength on entries |
| `--tint-edge` | `.34` | Tag-tinted entry border alpha |
| `--danger` | `#ff8fa3` | Overdue, delete, failed save |
| `--ok` | `#6ee7b7` | Saved state |
| `--warn` | `#fcd34d` | Unsaved state |

### Contrast

Measured as WCAG 2 contrast against the rendered background (glass, tints and lights included):

| Content | Minimum |
|---|---|
| Readable text, including secondary and tertiary text, placeholders and labels | 4.5:1 |
| Large text (24px, or 18.7px bold) | 3:1 |
| De-emphasized states: done entries, past periods, days outside the month | 3:1, target 3.5:1 and more |
| Controls and their states (check boxes, selected states) | 3:1 |
| Disabled controls, decorative borders | no minimum |

- Never lower text contrast with `opacity` on the text itself; use a lighter or darker color token. Opacity is allowed only for whole elements in the steps of [Transparency](#transparency): de-emphasized tiles (done, past), disabled controls and drag states.
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

Tag colors come from the configuration. The UI derives tints from the tag hue with `--tag-s`, `--tag-l` and the tint tokens. Colored surfaces behind light text, the tag-tinted bars and the contact avatars, take the hue at a fixed perceptual lightness (OKLCH lightness .5, the avatar's second stop .42), so that their text reaches its contrast for every hue.

### Transparency

Every alpha value belongs to one group and uses one of its steps; there are no values in between. The steps are tokens in `:root`, except where the table names a plain value.

| Group | Steps |
|---|---|
| White surfaces | `.05` cards (`--card`), `.08` glass and items (`--glass`, `--item`), `.11` hover (`--glass-2`); edges `.09` (`--card-edge`, `--item-edge`) and `.12` (`--edge`) |
| Text | `.70` `--muted`, `.66` `--faint`, `.30` `--deco` |
| Shadows (black) | `.35` header pill and main panel, `.5` popovers, menus, tooltips, notifications and the enlarged month cell, `.6` dialog |
| Color tints (accent, accent-2, status colors, `--tone`; mixed with transparent) | `--hover` 12 % hover and subtle fills, `--active` 24 % selected, pressed and badge fills, `--glow` 30 % glows, halos and nested fills, `--ring` 45 % borders, focus and inset rings, `--strong` 70 % today outline, selection, lasso, drop target, pulse |
| Lightened accent (mixed with white, for text) | `--light` 60 % |
| Floating panels (`--panel` mixed with transparent) | 60 % backlog panel, 88 % dialog, popovers, search bar, notifications |
| Recessed wells (`--base` mixed with transparent) | 40 % segmented controls, search fields, inputs, key caps, dialog backdrop |
| Opacity of whole elements | `--o-disabled` .35 disabled controls, drag placeholder, blocked startup; `--o-past` .55 done and past entries, days outside the month (as a whole, their entries are not dimmed again), past holiday rows; `--o-dim` .7 ended bars, past badges, dragged bar; `--o-hover` .95 hovered past entries |

Kept apart, because they are not alpha steps of a surface: the background lights (`--g1`, `--g2`), the tag tints (`--tint-a`, `--tint-b`, `--tint-edge` on entries, `.55`/`.35` with a `.4` border on bars), the past card fill (`--card` at 45 %), and three strokes on colored ground: the check box frame `.45`, the avatar highlight `.25` and the date range on bars `.95`.

### Scrollbars

One style for every scroll area:

- The thumb is 6px wide in `--deco` (`--faint` on hover) on a transparent track, with round ends.
- It sits 6px from the edge of the surface it scrolls in and stops 10px before the surface's ends, so it keeps about 6px to rounded corners as well. Both ends of the thumb are round. Lists inside a padded panel (backlog, holiday overview, contact list) reach into the panel padding for this.
- While a list scrolls, its content keeps 6px to the thumb, the same as the thumb keeps to the edge. Without a scrollbar the content keeps its normal padding.
- The entry grid of the portrait week scrolls sideways without a visible scrollbar.

## Background lights

Two soft radial lights in the scheme colors `--g1` and `--g2`, one in the top left and one in the bottom right corner. There is no light in the middle, so that nothing competes with the highlighted day.

| Property | Value |
|---|---|
| Arrangement | Corners |
| Size | 100 % |
| Intensity | 100 % |
| Drift | none |

## Borders

The header pill and the main panel have no border; they stand out by their glass fill and shadow. All other surfaces keep their 1px borders.

## Past periods

Past days are dimmed:

- the day card fill is reduced; the weekday uses `--faint`, the date `--muted`,
- entries on past days drop to `--o-past` and return to `--o-hover` on hover,
- multi-day bars that have ended drop to `--o-dim`,
- birthday and holiday badges on past days drop to `--o-dim`.

The values keep past content at the de-emphasized contrast minimum (see [Contrast](#contrast)).

Overdue entries are excluded and keep full visibility.

## Typography

- Font: Plus Jakarta Sans, weights 400 to 800, stored locally.
- Body text 13.5px. Headings are bold (800) with slightly negative letter spacing.
- Times and counters use tabular figures.

## Spacing

Scale: 2, 4, 6, 8, 10, 12, 14, 16, 20, 22, 24 px. Every padding, margin and gap uses a value of the scale. The only exceptions are derived values and optical corrections:

- Day cards are laid out with 5px on each side, half of the 10px gap between cards, so that multi-day bars can use equal columns. A bar starts and ends where the entries of its days do: 15px inside the column in the week (5px + the list padding of 10px), 11px in the month (cell margin 4px, border 1px, padding 6px), and 18px from the top and bottom of the day rows in the portrait week (card inset 4px + list padding 14px). On hover a bar lifts by 1px like an entry.
- Single-line tiles (month, portrait week) center their text on its capitals: title and time trim their line box to cap height and baseline (`text-box: trim-both cap alphabetic`) with 4px padding above and below, so the font's uneven ascent and descent cannot shift it at any pixel density.
- Positions computed from other values: the backlog panel starts below the header pill (14px + header height + 14px), the main panel makes room for it (panel width + 14px), and notifications sit 28px from the bottom and right window edges (twice the page spacing).

| Area | Spacing |
|---|---|
| Page | 14px around the header pill, main panel and backlog panel; 14px between them |
| Header pill | padding 8px 12px; 14px between the three groups; 10px between title and **+**, 4px after **+**, no gap between undo and redo, 6px before the save control; 4px between the right zone buttons; 6px between icon and label in the view switcher; the save control is a 36px icon button in every state |
| Main panel | padding 12px, the sides of the header pill, so that cards start below the logo and end below Options; the week cancels the 5px card spacing and the month the 4px cell margin at the outer edges, the month's ISO week column stays left of the cells |
| Week | 10px between day cards; day header padding 0 14px 0 16px, 4px between weekday and date, 4px between badges; day list padding 4px 10px 10px |
| Entries in a day | 6px between entries; entry padding 8px 10px; 8px between check box and text |
| Month | 8px between cells; cell padding 0 6px 6px; 4px between entries; entry padding 0 8px; “+N” 30px wide and as high as an entry at the end of the last entry row, 4px after its entry; ISO week number 8px from the top |
| Backlog panel | padding 16px 14px; 16px between groups; 6px between entries; group head 28px high, padding 0 6px, 4px above the list, radius 9px, `--glass-2` on hover; counter 2px 8px, 8px after the group name; 16px chevron at the right |
| Holiday overview | padding 12px; rows 6px |
| Entry dialog | centered in the upper 60 % of the window (20 % above the center); padding 20px; duplicate, delete and close as 34px icon buttons 4px apart above the title at the right, reaching 8px into the padding, delete in `--danger`; 12px between title and tokens; Apply 32px high, padding 0 16px, 12px after the tokens at the bottom right; title field padding 10px 16px, radius 16px, 22px/800; tokens 32px high, padding 0 10px, radius 10px, 6px apart, an unset token 32px square; popovers 360px wide, at most 372px high (the date popover), padding 10px, 10px gaps, radius 16px, 8px below the tokens, horizontally centered in the dialog; pills 30px high, fully rounded, 6px apart, sharing the width; time wheels 180px high in a recessed well (radius 12px), columns 1fr 1fr 18px 1fr 1fr, rows 36px at 18px/700 tabular, a middle band 36px high in `--accent` at `--hover` with a 30 % accent edge, the panel color fading over the top and bottom 30 %; note popover 372px high without padding, the note filling it with lines of 24px, padding 17px 16px so that exactly 14 lines fit before it scrolls, no frame of its own, not resizable; series delete menu as the context menu, radius 16px, 8px below the trash button, right-aligned with it |
| Menus and search bar | menus padding 6px; items 8px 10px; 10px between icon and label. The search bar is two separate glass surfaces without an enclosing panel: the field (44px high, padding 0 14px, radius 16px) 28px above the window edge and, 8px above it, the hit list (padding 6px, radius 16px), each with one 1px `--edge` frame |
| Start card | width 460px, padding 22px 24px 24px; heading (18px, 800) to list 16px, list to buttons 20px; buttons 40px high, gap 10px, “Open folder” primary, “New calendar” on `--glass-2`; rows padding 11px 12px, gap 6px; name 13.5px 700 with the detail line 2px below (11.5px, 600, `--faint`); day 12px 700 `--muted` above the time 11.5px 600 `--faint`, right-aligned |
| Contacts | 14px between list and detail; list padding 12px; detail padding 22px; “Next up” tiles padding 6px 10px, 6px apart, radius 12px, 10px above a divider to the sort |
| Chips and badges | chips 6px 12px; badges 2px 8px (month 2px 6px, portrait week 4px 8px), at least 20px high, so that icon-only badges match badges with text; their 12px icon sits centered; “+X” 0 6px; 6px between chips |
| Tooltip | padding 6px 10px |
| “+” menu | as in “Menus”, 8px below **+**, left-aligned to it; a file type as code chip (11.5px monospace, 700, `--accent` on `--hover` accent with a `--ring` accent border, radius 5px, padding 1px 5px) |
| Options menu | as in “Menus”; the switch 30×18px with a 12px knob, `--accent` when on |
| Notifications | width 270px, narrower only when the window is, padding 12px 14px, 8px between cards; dot 8px, 10px to the title (13.5px, 700, line height 20px); a title that wraps keeps dot, error code and close button on its first line; body 9px below, after a 1px `--edge` line and 8px, indented 18px, 12.5px in `--muted`; highlighted names italic, 700, `--accent`; controls and shortcut keys as one key-cap style (11.5px, 700, padding 0 3px, radius 4px, 1px `--edge` outline with 2px bottom, no fill); buttons 10px below, right-aligned |

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
- The mark is used without a tile everywhere it is shown on its own: in the header, on the start card and as favicon in the browser tab. Only the iOS home screen icon keeps the rounded tile in `--base` with soft background lights, because that platform needs an opaque square.
- All shapes are paths; no font is involved. The assets must not be redrawn or recolored.
- The complete web icon set lives in `res/logo/`:

| File | Use |
|---|---|
| `logo.svg` | Master with tile |
| `mark.svg` | Mark without tile, tightly cropped; header logo (32px) |
| `icon.svg`, `favicon.ico`, `favicon-16/32/48.png` | Favicons, mark without tile on a square canvas |
| `apple-touch-icon.png` | iOS home screen, with tile |
| `mask-icon.svg` | Monochrome contexts |
| `head.html` | `<head>` tags for `MD_Calendar.html`, with paths relative to the application root |

## Icons

Line icons as inline SVG with a 2px stroke and round caps and joins. No emoji and no platform icons. The icon system is taken over from MD_Manager:

- Every icon is a `<symbol id="icon-…">` in one inline sprite in `MD_Calendar.html` and is used with `<use href="#icon-…">`. There are no icon fonts and no `<img>` icons.
- Icons are drawn on a 32×32 canvas and displayed at 16×16px, so a stroke width of 4 renders as a crisp 2px line. Fine details may use 3 (1.5px).
- Three display sizes, chosen by context, never by icon; the same function has the same size everywhere:
  - **16px**, the default: icon buttons (✕ included) and buttons, rows and fields with text of 13px and more.
  - **14px**: next to 11–12px text (chips, sort, “Import”, “Add”, dialog labels, contact hints), tag icons and chevrons in lists.
  - **12px**: dense places only, namely badges and, in the month, the repeat icon and tag icons.
- The check box of an entry is 18px with the 16px check mark centered in it, 1px from each side, so that the mark keeps its strokes on whole pixels; the month's 12px box takes the small check mark (`icon-check-small`), drawn in the middle of the same 16px canvas, which overhangs the box by exactly 2px on each side, so that its 2px strokes also stay on whole pixels. The box frame is an inset 1.5px shadow, not a border. Both legs of the check mark run at exactly 45°, as in MD_Manager, which keeps their edges as even steps; its corners lie on the same pixel phase as there, and its outline is centered on the canvas (`M5 15L13 23L27 9`, slightly larger than MD_Manager's, whose outline sits half a pixel high).
- An icon button is about twice as large as its icon (16px in 28–36px) and at least 24px in each direction.
- Header exception: the ten buttons of the header pill (**+**, undo, redo, sync, save and the five buttons on the right) are 36×36px with 18px icons, in landscape and portrait; the save control shows its icon only, in every layout. The view switcher keeps 16px icons. A 32-unit symbol would render with 2.25px strokes at 18px, so the header has its own symbols, `hdr-<name>` in the sprite and `res/header-icons/<name>.svg`, drawn on a 36×36 canvas: strokes of 4 units are exactly 2px, and straight strokes lie on even units, that is on whole pixels. Fine details use 3 units (1.5px). They exist for every header icon (plus, undo, redo, sync, check, spinner, close, holiday, inbox, help, volume, muted, menu), including those taken over from MD_Manager.
- Stroke and fill use `currentColor`; the button's state colors the icon.
- Optical centering and pixel alignment are done with a `translate` group inside the symbol (for example `translate(.5 .5)` or `translate(-.625 0)`), never with CSS offsets.
- Every symbol also exists as a standalone file `res/icons/<name>.svg` with identical geometry. A unit test checks that file and symbol match.
- A toggle shows both of its icons in the markup; CSS shows one of them based on the button's `aria-pressed` state. The markup is never swapped.
- The header icons for sound (speaker with two sound waves, speaker with an X) and help (question mark) follow the drawings of MD_Manager, redrawn on the 36-unit canvas (see the header exception).
- The sync icon is the circle arrows: two arcs of one circle, each ending in an arrowhead, as `hdr-sync` for the header and `icon-sync` (32-unit canvas) for the head of the sync dialog. Draft geometry on the 36-unit canvas: `M7.5 16A10.5 10.5 0 0 1 26.5 11`, `M27 5v6.5h-6.5`, `M28.5 20A10.5 10.5 0 0 1 9.5 25`, `M9 31v-6.5h6.5`; the final drawing puts its straight strokes on whole pixels.
- Tooltips are not used for now; every icon button names its action through `aria-label`. The tooltip system stays in place for tooltips that are added back one by one.

## Tag icons

Every tag has an icon, referenced by its icon ID in `Config.md` (see [DataFormat](../DataFormat.md#configuration)). The icons are a fixed, designed set that ships with the application; users cannot add their own.

- Tag icons are built exactly like the UI icons (see [Icons](#icons)): 32×32 canvas, shown at 14px (12px in the month), `currentColor`, inline `<symbol>` plus an identical standalone file.
- They live in their own folder, `res/tag-icons/<icon-id>.svg`, and their symbols use the ID `tag-<icon-id>`, so they never collide with UI icons.
- The icon ID is lowercase ASCII with hyphens, for example `home` or `shopping`.
- On entry tiles the icon sits before the title, on multi-day bars before the bar title, the icon of the tag “Vacation” marks vacations in the holiday overview (the `vacation` icon without that tag), and in the tag token and tag chips of the entry dialog in the lightened tag hue. On tinted tiles it uses the lightened tag hue.

The set, chosen by the user from three designs per tag:

| Icon ID | Meant for | Drawing |
|---|---|---|
| `home` | Private | House |
| `briefcase` | Work | Office building |
| `dumbbell` | Gym | Dumbbell |
| `finance` | Finance | Stack of coins |
| `games` | Games | Die |
| `sauna` | Sauna | Steam above a bench |
| `sport` | Sport | Running shoe |
| `cooking` | Cooking | Pot with steam |
| `code` | Programming | Angle brackets with slash |
| `household` | Household | Washing machine |
| `shopping` | Shopping | Shopping cart |
| `martial-arts` | Martial arts | Gi jacket |
| `car` | Car | Car from the side |
| `doctor` | Doctor | Cross in a rounded square |
| `physio` | Physio | Stretching figure |
| `vacation` | Vacation | Palm tree |
| `heart` | Relationship | Heart, the same drawing as the UI icon `heart` |
| `friends` | Friends | Two people, the same drawing as the UI icon `contacts` |
| `clock` | Day off | Clock, the same drawing as the UI icon `clock` |
| `chip` | Tech | Processor chip with pins |

## Motion

- Short, interruptible transitions without layout work: transform and opacity, and paint-only properties (colors, backgrounds, borders, shadows). Never `filter` and never layout properties (size, margin, position); a hover that brightens adds a `--glass-2` surface instead of a brightness filter. The one exception: when the backlog panel opens or closes, the main panel's margin follows the slide with the same curve (350ms), so that it narrows and widens smoothly.
- The view switcher indicator slides between options; panels slide in.
- A new week or month slides in briefly from the side it comes from (navigation, mouse wheel, jump to today or to a search hit).
- Jumping to today, to a search hit or to the target of a day badge, and creating an item in the entry dialog, scrolls smoothly and highlights the target once: after the slide, its own frame lights up in one long pulse: the border turns full `--accent` with a 2px inner accent edge and an accent glow (18px at `--strong` and 44px at `--ring` around a day, month cell or bar; inside an entry, an overview row, a contact row or a contact field, which sit in scrolling lists, 18px at `--strong`); it rises over the first 20 %, holds until 60 % and fades back to the target's own look, 1.3s in all after a 120ms pause. There is no extra ring and no scale, so nothing moves and text and icons stay sharp; reduced motion keeps it, as it only fades.
- After dragging the days, and when a snap or `T` moves them by less than a week, the days glide the remaining distance into place (240ms); a move by a week or more slides in like a new period.
- The entry dialog fades in and rises 8px into place (200ms). It does not scale, and it keeps its own compositor layer while open, so that its icons do not snap to other pixels when the motion ends.
- The focus card fades in its blurred background and rises in like the dialog; switching its day lets the content glide 16px in from that side.
- The time wheels of the entry dialog turn like a drum: each row turns away by 22° per row from the middle (at most 80°), sinks back 6px per row and fades by 28 % per row (to at least 15 %); the middle row is lit. Wheels glide to a row with smooth scrolling and snap row by row. Only a row's face turns; the row itself stays flat, because a turned row would move its snap position.
- While saving, the save control's arc turns once per 0.8s (a transform); with reduced motion it stands still. The sync icon turns the same way, once per 1.4s, while the sync dialog checks or applies.
- The slide of a new period moves the view by 24px only; it does not fade it, because opacity on the view would break the glass blur of the bars inside.
- Overdue entries are the one continuous animation: a red border beam travels along their outline at a constant speed (24 fading dash pieces of one rounded SVG outline, one lap in 4s). → [Views](Views.md#entry-tile)
- `prefers-reduced-motion` disables non-essential motion.

## Sync dialog

The [sync dialog](Shell.md#sync-dialog) uses only the tokens above.

| Element | Values |
|---|---|
| Dialog | 880 × 660px (at most the window minus 48px), radius 22px, `--panel` at 88 %, 1px `--edge`, shadow `.6`; fades in and rises 8px like the entry dialog (200ms) |
| Head | padding 16px 16px 14px 20px; sync icon 18px in lightened `--accent` (turns while busy); “Sync with Google” 16px/800; status text 12.5px `--faint` right after it; close as a 32px icon button |
| Body | padding 0 20px 12px, a 1px `--edge` line above; scrolls with the standard scrollbar |
| Column head | sticky; “Calendar” left, “Google” right-aligned, 11.5px/700 `--faint`; columns `1fr 92px 1fr`, gap 12px |
| Day label | 11.5px/700 `--faint`, tabular figures, 14px above, 4px below |
| Row | padding 7px 0, a 1px `--card-edge` line below; the left side left-aligned, the right side right-aligned |
| Side | line 1: time 12.5px `--muted` tabular, 10px gap, title 700 with a 7px dot in the tag hue (`hsl(h var(--tag-s) var(--tag-l))`); line 2, only when the location differs: 12px `--faint`; a missing side 12.5px `--faint` |
| Changed value | `--warn` at 12 % behind, text lightened `--warn`, radius 5px, padding 1px 4px |
| Winning value | `--ok` at 12 % behind, text lightened `--ok` |
| Direction | 44 × 26px, radius 8px; `→` in `--accent`, `←` in `--accent-2`, removals in `--danger`, each on its color at 12 %; skipped: `--deco` without fill, and both sides of the row drop to opacity `.55` |
| Conflict and series control | icon buttons 26 × 24px in a recessed well (padding 2px, radius 9px); selected: `--accent` at 24 % with lightened accent; while undecided the well has a 1px `--warn` ring at 45 % |
| Row states during “Apply” | 20px circles: waiting a 2px `--deco` ring; running a spinner in `--accent`; done a drawn check mark on `--ok` at 24 %; failed a cross on `--danger` at 24 %; left open a clock on `--warn` at 24 %; not selected a dash in `--faint` |
| Footer | padding 12px 16px 12px 20px, a 1px `--edge` line above; “N changes selected · N to decide” (counts 700 `--text`, open decisions lightened `--warn`), Cancel, Apply as the primary button; during “Apply” a 4px progress bar in `--accent` (grows with `scaleX`) with the running operation and “4 / 9” above it |
| Overview, setup, check, result | centered, at most 520px wide (check 360px); overview as a fact list with 140px labels in `--faint`; check and setup steps as rows with state circle, label and counter; result: a 56px circle with a drawn check mark (or a pause sign in `--warn`), title 18px/800, one line of counts |
| Waiting | the check shows a shimmering skeleton of the merge view below its steps, so that the list appears without a jump; check marks draw their stroke (240ms); under reduced motion the shimmer and drawing are replaced by a plain fade |

Reference mockup (variant A): https://claude.ai/artifact/W3pSbFHAr9qrbDipmQhwtf

## Completion sound: Arpeggio

Three quick sine tones rising through a C major triad. When it plays is defined in [Interaction](Interaction.md#checking-off); how it is built in [Architecture](../Architecture.md#systems-from-md_libs).

| Voice | Note | Frequency | Start | Attack | Hold | Release | Peak gain |
|---|---|---|---|---|---|---|---|
| 1 | C6 | 1046.50 Hz | 0 ms | 4 ms | 20 ms | 320 ms | 0.70 |
| 2 | E6 | 1318.51 Hz | 55 ms | 4 ms | 20 ms | 320 ms | 0.70 |
| 3 | G6 | 1567.98 Hz | 110 ms | 4 ms | 40 ms | 550 ms | 0.75 |

- Envelope: exponential from 0.0001 to the peak, held, exponential back to 0.0001.
- Mix: master gain 0.09; each voice goes 70 % dry and 30 % into the plate reverb.
- Plate reverb: the MD_Manager impulse (1 s, stereo, seeded noise with cubic decay).
- Length about 0.7 s plus reverb tail. A new completion stops the sound that is still playing.
