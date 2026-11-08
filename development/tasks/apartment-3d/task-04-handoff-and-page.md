# Task 04 — the page side: 3D → 360 → back, layout and page fixes
**Agent:** `platform-dev` (status live, track habait) · **Model:** opus · **Ruling tier:** T0 · **Burst:** 3 · **Depends on:** 03 (the `habait:enter-room` contract)
**Memory file:** `memory/agents/platform-dev.md` (standing agent)
All paths are inside `C:\RnD\.wt\apartment-3d\`.

## What to do
1. **Enter the room** (`Habait/platform/js/apartment.js`): on the message `habait:enter-room` from the dollhouse frame (same origin; check `e.source === dollFrame.contentWindow`), call `showTab('tour')`.
   - Tour not loaded: set `room=<scene>` in `apartmentTourUrl()` (`:124-133`) before the src is set.
   - Tour loaded: `postMessage({type:'habait:goto', scene}, tourOrigin)`, as at `:414`. Success = the next `habait:view` with that scene. If none arrives within 3 s, reload the frame with `room=<scene>`.
2. **Back:**
   - A page-level chip "חזרה לתלת-ממד" / "Back to 3D" above the tour frame, shown only after an entry from 3D.
   - It calls `showTab('3d')`; the dollhouse keeps its camera and selection.
   - Strings go under `apt.3d.*` in `APT_STR` (`:14-95`).
3. **Deep link** (`:504`, `:335-362`):
   - `?tab=` wins when present; an unknown hash falls back to `?tab`, then `'tour'`.
   - Opening a tab on a phone scrolls its panel to just under the sticky tab strip (`.apt-tabs`, `css/apartment.css:31-35`).
4. **Phone layout** (`Habait/platform/css/apartment.css`):
   - `.apt-frame-3d` (`:47`) gets a height that keeps the whole frame above `.apt-mobilebar` (`:91-95`, ~64 px plus the safe area) at 390×664 and 412×839 (`calc(100dvh - <tabs> - <bar>)`, with a cap).
   - In the dollhouse template's inline CSS (`build_zip.mjs:340-357`), `#v{touch-action: pan-y}`: a vertical swipe scrolls the page, a horizontal drag orbits.
5. **Fixture badge:** `#aptFixture` (`apartment.html:28`, `apartment.js:254`) is shown only on localhost or with `?dev=1`, the same rule as `index.html:34,71`.
6. **Caption pill:** the 2-line `.cap` over the canvas (`build_zip.mjs`) becomes a small pill "הדמיה · להמחשה", which expands on tap to the full `m.legal.short`. **The legal text stays word for word**; only its presentation changes.
7. No new analytics event. If one is added, update `test/smoke.mjs:75` in the same change.

## Files
- modifies: `Habait/platform/js/apartment.js`, `Habait/platform/apartment.html`, `Habait/platform/css/apartment.css`, `Habait/platform/tools/build_zip.mjs` (CSS + caption only)

## Acceptance
- Headless on :8851 (iPhone 13, Pixel 7, desktop):
  - from the 3D tab, select `r-living`, click "צפו ב-360°" → the tour tab is active, its frame URL or the next `habait:view` names `living`;
  - the chip is visible; clicking it → the 3D tab is active and `__dollhouse.selected` is still `r-living`.
- `apartment.html?project=rainbow&unit=846&tab=3d#tour` opens 3D; `#3d` alone opens 3D.
- At 390 px: the 3D frame's bottom edge ≤ the mobile bar's top edge, and `document.documentElement.scrollWidth === innerWidth`.
- `#aptFixture` is hidden on a non-localhost host without `?dev=1` (test by a host override or by a `HABAIT_HOST` flag).
- The full legal text is unchanged (string-equal to `m.legal.short`).
- `node test/smoke.mjs` passes.

## Standing rails (inherited verbatim from the board README — root `CLAUDE.md` §0)
1. **Bounded read-first:** `memory/HOT.md`, then the LAST ~150 lines of your own `memory/agents/<name>.md` (plus its archive-index block). ⛔ Never read `memory/INDEX.md` whole — grep it.
2. **Write last, once:** ONE entry (`memory/_TEMPLATE.md`) into the layer that owns the fact, plus ONE ≤ 400-char pointer line under that layer's existing `memory/INDEX.md` header. ⛔ Never add a header.
3. **Second reader:** name which OTHER actor must know this; append ONE pointer line into their `memory/agents/<name>.md`, or say "none".
4. **An action is not done until its memory is written.**
5. ⛔ **The live repo `C:\RnD\Projects\Habait\habait-walkaround\` is read-only to every card until card 10.** Every write goes into `C:\RnD\.wt\apartment-3d\` (same relative paths as the repo) or into this board folder. Memory rows are the only live writes (root §8.7).
6. ⛔ **No git anywhere** (Eliran, 2026-11-03). `CHANGES.md` in the work tree is the diff.
7. ⚠ **Machine resource rules** (root `CLAUDE.md` §12): every test, build, server, browser or render runs as `timeout N <cmd>`, one heavy run at a time, foreground; kill what you start by PID. The work-tree server is `PORT=8851`. Never use :8850 (another session's port).
8. ⛔ **Blender only by its owner** (`Projects\Habait\SESSIONS.md` rule 4); no paid call on this board ($0 plan). Deploying is a separate explicit go from Eliran (root §9).
