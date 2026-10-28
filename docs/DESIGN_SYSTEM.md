# Design system (mobile shell)

The source of truth for how the phone app looks. Read it before adding or changing a screen, and update it in the same change when a rule moves. Tokens live in `web/src/components/mobile/theme.css`; the shared components are in `web/src/components/visuals.tsx`.

## Principles
1. **Colour carries meaning, never decoration.** Accent = actions and identity · gold = XP and rewards · flame = streak · green/red = success/penalty · one colour per life domain. A screen should be readable in greyscale plus one accent.
2. **The data is the decoration.** Charts, grids and numbers do the visual work. No glows, no gradient meshes, no emoji as icons.
3. **Quiet chrome, loud content.** Cards (Army, Arsenal, Vault) keep their animated Aura look; everything around them stays flat.
4. **Every number has a unit and a context** (XP, days, %, vs last week). Numbers are monospaced and tabular.
5. **Evidence over exhortation.** Copy states what happened and what to do next. No streak-shaming, no scarcity theatre.

## Tokens
| Token | Shadow Monarch (default) | Use |
|---|---|---|
| `--m-bg` | `#0b0912` | page |
| `--m-surface` / `--m-surface-2` | `#15121f` / `#1b1729` | panels / raised sheets |
| `--m-accent` / `--m-ink` | `#a78bfa` / `#170f2b` | actions / text on accent |
| `--m-gold` `--m-flame` `--m-good` `--m-bad` | `#f5c451 #ff8a3d #4ade80 #f87171` | XP, streak, success, penalty |
| `--m-text` / `--m-dim` / `--m-line` | `#f2f0fa` / 58% / 9% white | text, secondary text, hairlines |
| `--m-r` / `--m-r-lg` / `--m-r-sheet` | 22 / 26 / 32px | panels / grouped lists / sheets (the status window and licence use 30px) |
| `--m-fill` / `--m-rim` / `--m-lift` | gradients, see `polish.css` | container fill, gradient rim, soft shadow |

Six Monarch auras (Shadow, System, Frost, White Flame, Beast, Destruction) re-skin `bg/surface/accent/ink` only; semantic colours never change. Auras unlock by rank.

## Philosophy
A quiet, dense, softly glossy tool: rounded containers with smooth gradients, muted tones, numbers that do the work. It has **one signature**, the System status window (glowing rounded frame, rank hexagon, segmented XP bar) on Home, echoed by the Hunter licence on Profile. Nothing else is allowed to compete with it.

## Type
- **Chakra Petch** (`--m-display`): titles, section heads, numerals. Angular and HUD-like, which suits a game's System. 600 weight for titles, 500 for tabs, tabular figures for numbers.
- **Instrument Sans** (`--m-body`): running text and controls, 15px base, 1.5 line height.
- No tracked all-caps labels and no monospace for data. Section heads are sentence case in the display face. The only caps left are the System's own voice (the Transmission banner), because that is canon.
- Scale: 13 / 15 / 17 / 22 / 28 / 30. Titles on sub-screens are 28px and left-aligned; only the status window uses 30px.

## Space and shape
8-pt rhythm (8 / 16 / 24 / 32). Screen gutter 20px. Every container is rounded and glossy: a diagonal gradient fill that picks up the aura, a 1px gradient rim (bright top-left, quiet middle, faint bottom-right), a hairline top highlight and a soft lift shadow. Tinted containers (gold balance, red debt, green active) change only `--tint`. Padding is 16px. Sheets: `--m-r-sheet` top radius, portalled to `body`. Segmented controls are text tabs with a 2px accent underline, never boxed pills. Tap targets ≥ 40px. Nothing may exceed the viewport width; wide content scrolls inside its own container.

## Components (`visuals.tsx`)
`Panel` (title left, control right) · `RangeChips` (7D / 28D) · `Kpis` (label, mono value, ▲▼ delta) · `HatchBars` (hatched bars, solid highlight, real axis) · `XpArea` · `Waffle` (allocation grid) · `SegBar` (ratio bar + legend) · `DomainRadar` · `ActivityHeatmap`.

## Class prefixes (avoid collisions with the desktop CSS)
`mh-` Home (`mh-win` is the status window) · `mg-` Gates · `ma-` Army · `me-` Profile · `mr-` Rewards · `mlb-` Leaderboard · `co-`/`in-` Coach and Insights · `pln-` plan fields · `lsh-` lapse sheet · `sh-` sheets · `tx-` transmission. Check `grep -rn "\.<prefix>-" web/src --include=*.css` before inventing a new one; `lp-`, `lb-` and `pf-` are already taken by the landing page, the desktop leaderboard and the profile page.

## Do not
- Put purple on white, use gradient hero blocks, or centre everything in a card grid.
- Add a theme picker beyond the six lore-based auras.
- Add XP for reflecting or planning (it erodes the habit; see `GAME_RULES.md`).
- Ship a screen without checking it at 390px for horizontal overflow.

## Where the rules live
`theme.css` (tokens) · `polish.css` (the final layer: status window, label and tab rules, radii; it outranks the per-screen sheets by selector, not load order). Change a token or a polish rule once and every screen follows.
