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

Six Monarch auras (Shadow, System, Frost, White Flame, Beast, Destruction) re-skin `bg/surface/accent/ink` only; semantic colours never change. Auras unlock by rank.

## Type
- **Outfit** for titles and large numerals' companions (500 weight, tight tracking `-0.4…-0.8px`).
- **Inter** for running text, 15px base, 1.5 line height.
- **JetBrains Mono** for numerals, eyebrows, tabular data and chips (`--m-mono`).
- Scale: 11 / 12 / 13 / 15 / 17 / 22 / 34. Eyebrows are 11px mono, `.14em` tracking, uppercase.

## Space and shape
8-pt rhythm (8 / 16 / 24 / 32). Screen gutter 20px. Panels: 14–16px radius, 1px `--m-line` border, 16px padding. Sheets: 28px top radius, portalled to `body`. Tap targets ≥ 40px. Nothing may exceed the viewport width; wide content scrolls inside its own container.

## Components (`visuals.tsx`)
`Panel` (title left, control right) · `RangeChips` (7D / 28D) · `Kpis` (label, mono value, ▲▼ delta) · `HatchBars` (hatched bars, solid highlight, real axis) · `XpArea` · `Waffle` (allocation grid) · `SegBar` (ratio bar + legend) · `DomainRadar` · `ActivityHeatmap`.

## Class prefixes (avoid collisions with the desktop CSS)
`mh-` Home · `mg-` Gates · `ma-` Army · `me-` Profile · `mr-` Rewards · `mlb-` Leaderboard · `co-`/`in-` Coach and Insights · `pln-` plan fields · `lsh-` lapse sheet · `sh-` sheets · `tx-` transmission. Check `grep -rn "\.<prefix>-" web/src --include=*.css` before inventing a new one; `lp-`, `lb-` and `pf-` are already taken by the landing page, the desktop leaderboard and the profile page.

## Do not
- Put purple on white, use gradient hero blocks, or centre everything in a card grid.
- Add a theme picker beyond the six lore-based auras.
- Add XP for reflecting or planning (it erodes the habit; see `GAME_RULES.md`).
- Ship a screen without checking it at 390px for horizontal overflow.

## Known direction, not yet done
The body face is Inter. A more distinctive body face (and a bolder dominant colour per aura) is the next typographic upgrade; change `--m-body` once and the whole shell follows.
