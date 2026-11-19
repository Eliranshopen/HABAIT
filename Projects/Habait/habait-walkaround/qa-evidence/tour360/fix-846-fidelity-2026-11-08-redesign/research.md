# Tour360 viewer redesign — research (2026-11-08)

Ask (Eliran): «תחפש איזה סקיל יש לעיצוב UI ואני רוצה שתעצב את כל המראה והכפתורים בצורה יותר יפה למשתמש ויותר אינטואיטיבית».
Scope of this step: research only. $0, no paid call, no product file edited, no `.env` opened. The viewer in this worktree has
uncommitted changes from another session (`git status`: template.html, tour.css, tour.js modified); nothing here touches them.

---

## 1. Skills read · CLI run

**Skills (all under `C:\RnD\.claude\skills\`):**

| Skill | Files read |
|---|---|
| ui-ux-pro-max | `SKILL.md`, `references/workflow-and-cli.md`, `prerequisites.md`, `search-reference.md`, `common-rules-app-ui.md`, `quick-reference.md` (grep: labels, hierarchy, nav, z-index, safe area) |
| refero-design | `SKILL.md`, `references/non-negotiables.md` (first), `synthesis.md`, `research-workflow.md` (lock rules), `visual-workflow.md`, `present-findings.md`, `quality-gate.md`, `design-craft.md`, `icons.md`, `motion.md` §1–4, 6, 8, `anti-ai-slop.md` #2–#3, `color.md` §3, §5 |
| apple-design | `SKILL.md` §1–3, §12 materials, §14 reduced motion/transparency, `references/typography-and-foundations.md` §16 |
| emil-design-eng | `SKILL.md`, `references/component-building.md`, `animation-decision-framework.md`, `accessibility.md` |
| hebrew-rtl-best-practices | `SKILL.md` (house rules 1–5, rules 1–8), `references/hebrew-typography.md` |
| mobile-responsive | `SKILL.md` (Step 0–4, rules) |
| web-design-guidelines | `SKILL.md`, `references/command-2026-08-18.md` (pinned rules) |

No Refero MCP is configured: the refero lock below uses the bundled craft references plus products described from knowledge (marked).

**CLI (Python 3.13.5, `python`, from `C:\RnD`, `PYTHONIOENCODING=utf-8`; raw output saved next to this file):**

```
S=.claude/skills/ui-ux-pro-max/scripts/search.py
python $S "real estate virtual tour 360 panorama viewer immersive premium luxury apartment" --design-system -p "Habait Tour360" --variance 3 --motion 3 --density 4   > cli-design-system.txt
python $S "real estate property listing"                       --domain product -n 3   > cli-product-realestate.txt
python $S "virtual tour 360 panorama viewer immersive media"     --domain product -n 3   > cli-product-virtualtour.txt
python $S "glassmorphism dark overlay immersive"                 --domain style -n 4     > cli-style-glass.txt
python $S "glassmorphism frosted"                                --domain style -n 2     > cli-style-glassmorphism.txt
python $S "immersive media viewer minimal dark content-first"    --domain style -n 4     > cli-style-immersive.txt
python $S "map viewer controls toolbar grouping icon labels"     --domain ux -n 8        > cli-ux-controls.txt
python $S "bottom navigation tab bar mobile"                     --domain ux -n 8        > cli-ux-bottomnav.txt
python $S "touch target 44 spacing focus keyboard"               --domain ux -n 8        > cli-ux-touch.txt
python $S "animation reduced motion duration easing"             --domain ux -n 8        > cli-ux-motion.txt
python $S "z-index overlay modal fixed position safe area"       --domain ux -n 6        > cli-ux-zindex.txt
python $S "real estate luxury property"                          --domain color -n 3     > cli-color-realestate.txt
python $S "hebrew rtl modern elegant"                            --domain typography -n 3 > cli-typo-hebrew.txt
python $S "accessibilityLabel touch targets safe areas"          --domain web -n 6       > cli-web-a11y.txt
python $S "icon set outline stroke"                              --domain icons -n 5     > cli-icons.txt
```

What the CLI gave that is usable: pattern **Immersive/Interactive Experience** (full-screen interactive element, guided tour, skip
option); real-estate product row **Glassmorphism + Minimalism, trust blue + gold** (matches the house `--brand-primary` #005d83 +
`--brand-accent` #eea927); glass caveat **"Ensure 4.5:1"** and Spatial-UI **"Contrast risks"**; touch 44 px / 8 px gaps; 150–300 ms;
"reserve horizontal swipes for carousels" (gesture conflict). Rejected: its type pick (Cinzel / Josefin Sans: no Hebrew glyphs), its
teal palette (not the house), "Exaggerated Minimalism" oversized type (fights the panorama). The ux-domain searches for toolbar /
viewer controls returned generic label rules only; there is no 360-viewer row in the corpus.

---

## 2. Audit — current tour (desktop 1440, phone 390)

Evidence: `..\fix-846-fidelity-2026-11-05\design-button-2026-11-08\after-tour-1440.png`, `-1440-open.png`, `-390.png`, `-390-open.png`,
`hold-real-sheet.jpg`; code `Habait\tour360\viewer\template.html`, `tour.css`, `tour.js` (working copy). The screenshots predate the
(?) help button (`#t-help` / `#t-help-rail`, in the code since 2026-11-08). Severity P0–P3 per refero `visual-workflow.md` "Visual QA".
Contrast values marked *est.* are read off the screenshots, not measured.

| # | Finding | Rule broken · source | Sev |
|---|---|---|---|
| 1 | Top bar = 6 separate floating dark pills of equal weight (lang ×3, «חזרה לבניין», ruler, guide, (?), «שינוי עיצוב · פרקט»); no grouping, no primary. | `visual-hierarchy`, `nav-hierarchy` — ui-ux-pro-max `quick-reference.md` §Layout/§Navigation; "use hierarchy so the most important thing is the most obvious" — apple-design `typography-and-foundations.md` §16.6 | P1 |
| 2 | Icon-only controls: ruler, guide, (?), 3D/plan, rotate, home view, fullscreen (+ back and the design label on phone). Accessible names exist (`aria-label` + `title`, tour.js:371), but meaning is visible only after a 400 ms hover / 500 ms long-press tooltip. A 17-step autoplay walkthrough (`COACH_STEPS`, tour.js:1606) exists to explain them — the symptom. | `nav-label-icon` ("icon-only nav harms discoverability") — ui-ux-pro-max `quick-reference.md` §Navigation; "Action icons: aria-label **or visible text nearby**" — refero `icons.md` §Accessibility | P1 |
| 3 | Left rail = 6 detached 44 px squares (map, +, −, rotate, home view, fullscreen; phone adds (?)), 8 px apart, mid-height over the room. It mixes view **modes** (3D/plan) with **camera** controls (zoom). | "material weight encodes hierarchy; bigger surfaces thicker" — apple-design §12; `avoid-mixed-patterns`, `nav-hierarchy` — ui-ux-pro-max §Navigation | P2 |
| 4 | The fidelity/concept line (legal) is 13.5 px at `--ink-2` (86 % white) with only a text-shadow, at y≈190–215 px where the top shade (210 px tall, 0.42 at 58 %) has faded; over the bright wall it reads at *est.* < 4.5:1. The room name (36 px/700) is the loudest thing on screen and sits on the brightest area. | Contrast 4.5:1 — refero `color.md` §4, ui-ux-pro-max priority 1; "vibrancy: higher contrast over translucent/changing backgrounds" — apple-design §12; disclosure must be legible — root CLAUDE.md §6 | P1 |
| 5 | Shades: top 210 px + bottom 290 px gradients cover 500 of 900 px on desktop and 560 of 844 on phone (the code comment at tour.css:985 already records "shades covered 500 of 844 px"). The product — the image — is dimmed over half its height. | "edge effects only where floating UI actually overlaps content" — apple-design §12; pattern "full-screen interactive element" — `cli-design-system.txt` | P2 |
| 6 | Two markers with different actions look the same: room hotspot (56 px white ring + dot + label) and furniture ring (44 px white ring + dot, no label). In after-tour-1440.png the sofa ring (563,672) and lamp ring (1160,476) read as unlabeled doors. | "things that look the same must behave the same" — apple-design §16.4 Familiarity; one icon language per meaning — refero `icons.md` §Style | P1 |
| 7 | Bottom stack = 3 rows (arrows + count + hint, strip, AI line), ~190 px. Desktop strip is cut at the start edge (card 08 clipped at x≈118) with the scrollbar hidden and no fade or chevron. Arrows sit 360 px apart, on a different row from the strip they drive. | `swipe-clarity` ("swipe actions must show clear affordance") — ui-ux-pro-max §Touch; "reflow, don't just shrink" — mobile-responsive Step 3 | P2 |
| 8 | Desktop «שינוי עיצוב» panel opens at top:72 px on the inline-end side and covers the rail's 3D/plan and + buttons (after-tour-1440-open.png). Not anchored to its trigger visually. | "popovers origin-aware" — emil `component-building.md`; "overlays must not cover the focused element" — web-design-guidelines §Focus | P2 |
| 9 | Phone «שינוי עיצוב» sheet covers the bottom AI disclosure line (after-tour-390-open.png). The lift rule `html.has-dialog …#tour-ai-note` (tour.css ~912) only runs for `.t-sheet`; `designOpen` (tour.js ~925) does not add `has-dialog`. | The AI line "must stay visible always" (brief; root §6 disclosure is structural) | P1 |
| 10 | `letter-spacing: .02em` on the panel's Hebrew sub-headings «תצוגה» «ריצוף» (`.t-design-sub`, tour.css:1242). | House rule 1 "no letter-spacing on Hebrew text" — hebrew-rtl `SKILL.md` | P3 |
| 11 | Tokens drift: tour.css runs its own navy system (`--ground #0A1330`, `--glass rgba(10,19,48,.55)`, `--amber #F4B740`, Assistant body) while the house chrome is warm stone (`--chrome-panel` = n-950 84 %, `--brand-accent #eea927`, Heebo). tour360 was explicitly out of scope of the chrome-token card (`development/tasks/platform-ui-ux/task-15-visual-chrome-tokens.md` line 31). Coach card uses an off-system cream `#fbf8f3` (tour.css:1271). | "use the tokens, never hard-coded hex that duplicates a token" — mobile-responsive Step 0; "define tokens before implementation" — refero `design-craft.md` | P2 |
| 12 | Motion: coach card animates `left/top` over 600 ms (tour.css:1304); hotspot pulse runs infinitely (`t-pulse 2.6s infinite`, gated by reduced motion — good). | "animate transform/opacity only" — web-design-guidelines §Animation; "UI animations under 300 ms" — emil `animation-decision-framework.md` §4; "infinite loops in product screens" — refero `motion.md` §8 | P3 |
| 13 | Walkthrough autoplays on every open: `COACH_STEP_MS = 6500` in the working copy (commit 290ad4b's message says 3.5 s) × up to 17 steps. It has «דלג», pause on hover/touch, manual stop — the WCAG pause rule is met — but it covers the tour every visit. | "Autoplay motion > 5 s … needs pause/stop" (met) — web-design-guidelines §Animation; "rare/first-time → can add delight; frequent → reduce" — emil decision framework §1 | P2 (Eliran's ruling) |
| 14 | Phone header packs badge + 5 controls into 390 px; the design button's words are visually hidden (`.t-design-label` sr-only, tour.css:1257), leaving a pencil + «פרקט» chip as the primary action. Language shows as «עב ⇄». | `nav-label-icon` — ui-ux-pro-max; "Hide vs. transform: collapse desktop navs into a toggle" — mobile-responsive Step 3 | P2 |
| 15 | Desktop language switch shows three 44 px buttons (≈140 px) for a once-per-session action. | "show the common path first, advanced options one level deeper" — apple-design §16.6 | P3 |
| 16 | Kept as-is (positive): every target ≥ 44 px; `:focus-visible` rings; hover gated by `(hover: hover) and (pointer: fine)`; logical properties; prev/next arrows mirrored in RTL (`.t-dir`); zoom hidden on coarse pointers; badge `data-permanent`; reduced-motion gates on the pulse and the coach. | emil `accessibility.md`; hebrew-rtl rule 4; web-design-guidelines | — |

---

## 3. Reference lock

Dominant direction: **"the room is the hero; chrome is a thin, labelled instrument layer grouped by the buyer's three questions"** —
*where am I* · *what can I do* · *where do I go next*. Secondary references own one narrow job each (refero `research-workflow.md`:
bounded jobs, no token moved out of its role).

| Reference | Source | Job it owns (take) | Reject |
|---|---|---|---|
| House tokens `platform/css/tokens.css` (`--chrome-*`, `--sp-*`, `--r-*`, `--dur-*`, `--ease`, `--tap-min`, `--fs-*`) | repo | colour, radius, space, motion, type values — every value below maps to one | navy tour palette (decision 1) |
| apple-design §12 Materials | skill file | translucent functional layer; heavier material for structure, lighter for controls; never light-on-light glass; materialize (blur+scale) not plain fade; `prefers-reduced-transparency` → solid | light glass `rgba(255,255,255,.6)` toolbar sample (photo is bright → contrast) |
| apple-design §16 Familiarity / Simplicity | skill file | same look = same behaviour (markers); common path first, language one level deeper | — |
| Apple Maps Look Around | **knowledge** (not re-verified) | one translucent **place card** that carries the location title; content stays clear | its tiny "Done" text button; its map inset |
| Matterport Showcase | **knowledge** | **view-mode switch** (inside / floor plan / dollhouse) as one labelled control; collapsible highlight strip | its idle auto-tour by default; its pale UI on bright rooms |
| Google Street View | **knowledge** | **camera controls in one vertical capsule** at the inline-end bottom, visually secondary | compass, its separate filmstrip window |
| Zillow 3D Home | **knowledge** | room chips with names; floor-plan toggle labelled in words | its opaque top bar |
| Kuula | **knowledge** | single bottom toolbar; chrome fades when idle (used only in direction A) | hiding the disclosure with the chrome |
| ui-ux-pro-max CLI | `cli-*.txt` | immersive pattern + skip; glass + "ensure 4.5:1"; 44/8 px; 150–300 ms; bottom nav ≤ 5 items with labels | Cinzel/Josefin, teal, oversized type |
| refero `icons.md` | skill file | one outline set, `currentColor`, 20 px in 24 box, 1.8 stroke (current set kept), 3:1 non-text contrast | mixing filled + outline at one level |
| emil `component-building.md` | skill file | press `scale(0.97)`; popover scales from its trigger; nothing from `scale(0)`; transitions over keyframes | — |
| hebrew-rtl | skill file | amber only for the הדמיה badge and the AI-line dot; 13 px floor; no tracking; mirror arrows only; plural imperative microcopy | upstream "tracking as emphasis" |

Knowledge rows are from memory of those products, not from a capture made today; treat them as pattern names, not specs.

---

## 4. Three directions

### Shared base (all three)

- **Never moves, never covered:** the הדמיה badge (top inline-start corner, `z-index` above every sheet/popover/coach veil); the concept line
  «הדמיה על בסיס תכנית המכר. המידות תואמות לתכנית בסטייה של עד 1%…»; the bottom AI line. Every sheet's `max-height` ends above the AI line
  (fixes #9); the concept line sits on a plate (fixes #4). Wording unchanged.
- **Tokens** (tour.css imports or mirrors `tokens.css`; values below are the token names). Proposed tour-local additions, flagged as new:
  `--glass-thin: color-mix(in srgb, var(--n-950) 48%, transparent)`, `--glass-mid: color-mix(in srgb, var(--n-950) 64%, transparent)`,
  `--blur-thin: blur(16px) saturate(140%)`, `--blur-thick: blur(24px) saturate(160%)`, `--focus-chrome: #80bee0` (= the house dark-theme
  `--focus`; the light-root `--focus` #005d83 is invisible on dark chrome).
- **Fallbacks:** `@media (prefers-reduced-transparency: reduce)` → `background: var(--chrome-panel-solid); backdrop-filter: none`;
  `@media (prefers-contrast: more)` → `border-color: var(--chrome-line-strong)` and panels at `--chrome-panel`.
- **Type:** Heebo (`--font-text`) for labels and numbers; sizes `--fs-small` 14 px for control labels, 13 px for the two disclosure lines
  (Hebrew floor), `--fs-body` 16 px room-bar name, `--fs-h2` 22 px room name (phone), `--fs-h1` lower bound 28 px (desktop). Weights
  `--fw-semibold` labels, `--fw-bold` room name. No letter-spacing, no case transforms. `.t-num` isolation kept for "4 / 11".
- **Icons:** keep the current outline set (24 box, 1.8 stroke, round caps, `currentColor`), 20 px in 44 px buttons, 18 px beside a label.
  Mirror only prev/next/back (`:dir(rtl)` scaleX(-1)); never mirror rotate, fullscreen, ruler, (?).
- **States (every control):** rest = transparent on its glass; hover (`(hover:hover) and (pointer:fine)` only) = `background:
  color-mix(in srgb, var(--n-50) 10%, transparent)`; pressed = `transform: scale(0.97)` 100 ms; toggled on (`aria-pressed=true`: ruler,
  rotate, guide; open: design) = `background: var(--chrome-fg); color: var(--chrome-bg)`; focus = `outline: 2px solid var(--focus-chrome);
  outline-offset: 2px`; disabled = `opacity: .5`. Transitions list properties (`background-color, color, transform`), never `all`.
- **Motion:** hover/press `--dur-fast` 150 ms `--ease`; popover/sheet enter `--dur-base` 250 ms (opacity + `translateY(8px)` or
  `scale(.96)` from the trigger, `transform-origin` at the trigger corner); exit 150 ms; room change: title cross-fade 150 ms. Coach
  card moves by `transform`, ≤ 300 ms. Hotspot pulse: 2 iterations after entering a room, not infinite. Reduced motion: the house tokens
  zero the durations (tokens.css) — state changes become instant; no slide, no scale.
- **Markers (fixes #6):** room hotspot = 40 px glass disc (`--glass-mid`, 2px `--chrome-fg` border) with an up-chevron "walk" glyph, label
  pill always shown beside it (14 px/600, `--chrome-panel`, `--r-full`, padding 6/12), hit 56 px. Furniture ring = 24 px visual, 1.5 px ring
  at 70 % white, no dot, hit 44 px; on hover/focus it grows to 32 px and shows a small ⇄ glyph + the item name chip. Two shapes, two weights.
- **Notation:** `(name)` in a layout map = that icon from the current outline set (no emoji, no new set).
- **RTL:** inline-start = right, inline-end = left. All positions below are logical; the physical side is in brackets for reading.
- **Targets:** every hit area ≥ `--tap-min` 44 px, ≥ `--sp-2` 8 px between targets; 320 / 390 / 1440 checked with RTL left-edge overflow
  (HOT: `check-overflow.js` misses `rect.left < -1`).

### A — "Quiet glass"

**Rationale:** keep today's map (muscle memory, smallest QA surface) and remove the noise — fewer surfaces, lighter shades, a legible legal plate, chrome that steps back while you look.

**Desktop 1440 × 900**
| Zone | Contents | Label? |
|---|---|---|
| Top inline-start [right], x 20 / y 16 | brand «Habait» + badge; under it (y 64) title block: zone 14/600 muted · room 28/700 · apt 14 muted; concept line on a plate (max-width 380) | text |
| Top inline-end [left], y 16 | from the edge: `[עב ▾]` (one 44 px button → 3-item menu) · `[(building) חזרה לבניין]` · tools capsule `[? | ruler | guide]` (one 44 px-high capsule, 1 px `--chrome-line` dividers) · `[(pencil) שינוי עיצוב · פרקט]` | design + back have text; tools icon + tooltip |
| Rail inline-end [left], vertically centred | 3 stacked capsules, 8 px apart: `[3D | plan]` · `[+ | −]` (fine pointer only) · `[rotate | home | fullscreen]` | icons + tooltip |
| Bottom centre | count «4 / 11 נקודות מבט» 14 px muted centred above the strip; strip with `‹` `›` 44 px discs at its two ends, cards 132×80, `mask-image` fade 32 px at both ends; AI line last | strip cards named |
| Shades | top 140 px (0.6→0), bottom 180 px (0.75→0) | — |
| Idle | after 4 s with no pointer/key: tools capsule, rail, strip, arrows fade to opacity 0 over 250 ms; badge, title, concept plate, AI line never fade; any pointer move / touch / key / focus restores in 150 ms | — |

**Phone 390 × 844:** top row `[badge] … [(pencil) פרקט] [⋯]` — `⋯` (44 px) opens a sheet: guide, ruler, (?), «חזרה לבניין», language
(each a 48 px row with icon + words). Title block: room 22/700 + apt 13; concept plate full width (inline 16 px gutters). Rail: one capsule
`[3D/plan | rotate | home | full]` at inline-end, y ≈ 45 %. Bottom: strip (cards 104×64) with the count inside the current card; arrows
dropped (strip + swipe + hotspots); AI line.

**Materials:** capsules / buttons `background: var(--glass-thin); backdrop-filter: var(--blur-thin); border: 1px solid var(--chrome-line);
border-radius: var(--r-full); box-shadow: none`. Concept plate `background: var(--glass-mid); backdrop-filter: var(--blur-thin);
border-radius: var(--r-md); padding: var(--sp-2) var(--sp-3); color: var(--chrome-fg)`. Design pill (primary) `background: var(--chrome-fg);
color: var(--chrome-bg); box-shadow: var(--chrome-shadow-sm)`. Popover `background: var(--chrome-panel); backdrop-filter: var(--blur-thick);
border: 1px solid var(--chrome-line-strong); border-radius: var(--r-md); box-shadow: var(--chrome-shadow)`, anchored under its trigger,
never over the rail.

**Weak spot:** most controls stay icon-only; discoverability still leans on tooltips and the walkthrough. Idle fade can hide controls from first-time users.

### B — "Grouped command bar + bottom dock"

**Rationale:** one place for every action — a labelled dock at the bottom (thumb reach on phones), the top keeps only identity, legal and
system. Follows the bottom-nav rules (≤ 5 items, icon + label) and the Matterport/Kuula bottom toolbars.

**Desktop 1440 × 900**
| Zone | Contents | Label? |
|---|---|---|
| Top inline-start [right] | brand + badge; title block (zone · room 28/700 · apt); concept plate | text |
| Top inline-end [left] | system cluster, quiet: `[עב ▾]` `[(building) חזרה לבניין]` `[?]` | back in words; ? icon |
| Bottom centre, above AI line | **dock** (max-width 760, height 64): `[(cube) תלת-ממד] [(plan) תוכנית] │ [(speaker) סיור קולי] [(ruler) מדידה] │ [(pencil) שינוי עיצוב · פרקט]` — icon 20 over label 13–14 px, item min 64×56; the design item is the only filled one | all labelled |
| Above dock | room row: `‹` · strip (cards 120×72, fade edges) · `›`; a «חדרים ▴/▾» toggle at the dock's inline-start end collapses it | names on cards |
| Inline-end [left], bottom, above dock | camera capsule, vertical: `[+][−]` (fine only) `[rotate][home][fullscreen]` | icons + tooltip |
| Shades | top 150 px; bottom 220 px | — |

**Phone 390 × 844:** top row `[badge] … [(building)] [עב] [?]` (all 44). Under it a plate: apt line 13 muted + concept line 13. Bottom, from the
AI line up: **tab dock** full width, 5 items × 72 × 56: `חדרים · תלת-ממד · סיור · מדידה · עיצוב` (13 px labels); room pill
`‹ סלון · 4/11 ›` (44 high, centred, room name 16/600); «חדרים» opens the strip as a sheet above the dock. Camera capsule
`[rotate][home][full]` at inline-end, y ≈ 55 %. Floor plan reached from the 3D layer and the rooms sheet (both exist today).

**Materials:** dock `background: var(--chrome-panel); backdrop-filter: var(--blur-thick); border: 1px solid var(--chrome-line);
border-radius: 20px (new; or --r-md 12 to stay on the three house radii); box-shadow: var(--chrome-shadow)`; dock item rest transparent,
active/open `background: var(--chrome-fg); color: var(--chrome-bg); border-radius: var(--r-md)`; group dividers 1 px × 32 `--chrome-line`.
Top system cluster and camera capsule `--glass-thin` + `--blur-thin`, `--r-full`.

**Weak spot:** the biggest move from today (every control relocates); a 64 px dock + room row + AI line is still ~170 px of bottom chrome on a phone; desktop users reach to the bottom for tools.

### C — "Place card + three labelled clusters" (recommended)

**Rationale:** each cluster answers one question — *where am I* (place card, top inline-start), *what can I do* (labelled tool bar,
top inline-end, with a view-mode switch), *where next* (room bar, bottom centre) — and camera controls become one quiet capsule. Labels
where the meaning is not universal; legal lines bound to the place card so they always travel together.

**Desktop 1440 × 900**
| Zone | Contents | Label? |
|---|---|---|
| Place card, inline-start [right], x 20 / y 16, width 360 | row 1: «Habait» 16/700 + badge (inline-end of the row); row 2 zone 14/600 muted; row 3 room 28/700; row 4 apt 14 muted; hairline `--chrome-line`; row 5 concept line 13/1.55 `--chrome-fg` | text |
| Tool bar, inline-end [left], y 16 | system: `[עב ▾]` `[(building) חזרה לבניין]` `[?]` · 8 px · **actions capsule** `[(ruler) מדידה] [(speaker) סיור קולי] [(pencil) שינוי עיצוב · פרקט ▾]` (icon 18 + label 14/600, 44 high) | actions labelled; ? icon |
| View-mode switch, bottom inline-end [left], same row as room bar | segmented `[360°] [תוכנית] [תלת-ממד]` — 360° is the selected state; the others open the existing plan sheet / 3D layer (the 3D rise transition starts from this button) | labelled |
| Camera capsule, inline-end [left], vertically centred | `[+][−]` (fine only) hairline `[rotate][home][fullscreen]`; visual 40, hit 44, opacity .86 at rest → 1 on hover/focus | icons + tooltip |
| Room bar, bottom centre | strip (cards 120×72, fade edges, current card ringed) above a pill `[‹] סלון · 4 / 11 [›]` (52 high; name 16/600, count 14 muted, `.t-num`); a chevron on the pill collapses/expands the strip (open by default ≥ 1024 px) | names |
| AI line | last row, 13 px, its own `--glass-thin` strip 28 px high, amber dot kept | text |
| Shades | top 120 px (behind the tool bar only); bottom 160 px | — |
| Design popover | drops from its trigger (`transform-origin: top left` [the trigger's corner in RTL]), width 360, below the tool bar, never over the camera capsule (it sits at y ≥ 72, capsule centred at 450) | — |

**Phone 390 × 844**
| Zone | Contents |
|---|---|
| Place card, top, inline 12 px gutters (y 12 + safe-top) | row 1 (44 high): badge · room 22/700 · … · `[(building)]` `[עב]`; row 2: apt 13 muted; row 3: concept line 13 (2 lines). Height ≈ 120 |
| Camera capsule, inline-end [left], y ≈ 50 % | `[rotate][home][full][?]` (the (?) lives here on phones, as in today's code) |
| Room bar, above the action bar | pill `‹ סלון · 4/11 ›` 48 high; tap the name → the strip slides up as a horizontal row (cards 104×64) above the pill; swipe on the strip only (gesture conflict rule) |
| Action bar, bottom | 4 labelled items, full width, 56 high: `[(cube) תצוגה]` (opens the 360°/תוכנית/תלת-ממד chooser) `[(speaker) סיור]` `[(ruler) מדידה]` `[(pencil) עיצוב · פרקט]` |
| AI line | last, 13 px, may wrap to 2 lines |
| Design sheet | bottom sheet, `max-height: 60dvh`, ends above the AI line; place card stays visible above it |

**Materials (exact):**
```css
.place-card  { background: var(--glass-mid); -webkit-backdrop-filter: var(--blur-thick); backdrop-filter: var(--blur-thick);
               border: 1px solid var(--chrome-line); border-radius: var(--r-md); box-shadow: var(--chrome-shadow-sm);
               padding: var(--sp-3) var(--sp-4); color: var(--chrome-fg); }
.tool-capsule{ background: var(--glass-mid); backdrop-filter: var(--blur-thin); border: 1px solid var(--chrome-line);
               border-radius: var(--r-full); padding: var(--sp-1); gap: var(--sp-1); }
.tool-capsule > button { min-height: var(--tap-min); padding-inline: var(--sp-3); border-radius: var(--r-full); }
.cam-capsule { background: var(--glass-thin); backdrop-filter: var(--blur-thin); border: 1px solid var(--chrome-line);
               border-radius: var(--r-full); }
.room-pill, .action-bar { background: var(--chrome-panel); backdrop-filter: var(--blur-thick);
               border: 1px solid var(--chrome-line); border-radius: var(--r-full) /* action bar: var(--r-md) */; box-shadow: var(--chrome-shadow); }
.mode-seg [aria-pressed="true"], .is-open { background: var(--chrome-fg); color: var(--chrome-bg); }
.popover, .sheet { background: var(--chrome-panel); backdrop-filter: var(--blur-thick); border: 1px solid var(--chrome-line-strong);
               border-radius: var(--r-md); box-shadow: var(--chrome-shadow); }
.t-badge     { background: var(--brand-accent); color: var(--brand-on-accent); border-radius: var(--r-full); font: 700 13px/1 var(--font-text); }
```
No glass stacks on glass (popover opens over the room, not over the place card). Heavier material (`--chrome-panel`) for navigation
surfaces, lighter (`--glass-thin`) for the camera capsule — apple-design §12.

**Why C:** fixes the P1 findings directly — labels on the actions (#2), one primary per cluster (#1), legal lines on a plate that
travels with the room title (#4, #9), markers split (#6) — while keeping positions close to today (tools still top inline-end, camera
still at inline-end, rooms still at the bottom), so QA, the coach steps and the 3D-rise origin move less than in B. The walkthrough can
shrink to the four things a label cannot say (hotspot, ring, strip swipe, ruler taps).

---

## 5. Risks · Eliran's calls

1. **Palette (Eliran):** move the tour from its navy (`#0A1330`) to the house warm-stone `--chrome-*` (one system with the platform), or keep navy and only regroup. Recommended: house tokens. It is a visible change on every room.
2. **Fonts (Eliran):** `tokens.css` sets Heebo for text; hebrew-rtl house rule 5 and today's tour use Assistant body + Heebo headings. One must win.
3. **Disclosure placement (Eliran, root §6):** the concept line moves into the place card / plate; the AI line gets its own strip; on phones it wraps to 2 lines. Wording is untouched; any shortening is his call.
4. **Walkthrough on every open (his ruling, 2c6f64d):** with labelled actions, recommend first visit + (?) replay. His call.
5. **Idle fade (A only):** hides controls from first-time users; disclosures never fade. Recommend off unless he likes it.
6. **3D rise transition:** C/B move the 3D entry into a mode switch; the rise animation (board transition-rise) must start from the new button — retest.
7. **Glass over bright rooms:** contrast must be **measured** on all 11 rooms at 1440 and 390 (not estimated) before any build passes; `prefers-reduced-transparency` path checked.
8. **Radius:** B's 20 px dock radius is outside the three house radii (6/12/999) — use 12 or add a token (his call if added).
9. **Design-skill precedence (D14, unruled):** refero used as method, ui-ux-pro-max as data; its Cinzel/teal output rejected in favour of house tokens.
10. **Housekeeping:** this new evidence folder has no `CLAUDE.md` yet (`.wt` working folders are excepted by root §8.6; it needs one before a merge to `main`). Next step if he picks: static HTML mockups of the chosen direction(s) at 1440 and 390 over a real panorama, before any viewer code.
