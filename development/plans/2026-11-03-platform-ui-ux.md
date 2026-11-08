# Plan: the Habait platform shell, from v0 to premium (look and UX, not the visualizations)
<!-- filed: 2026-11-03 · session rnd-ed · state: APPROVED 2026-11-03 (card 01, as written); board EXECUTING -->

**State:** filed; board `development/tasks/platform-ui-ux/` filed 2026-11-03 16:21. ⚠ Correction found at filing: `.wt/apartment-3d` holds all 235 `Habait/platform/` files (not three), and it changed `css/apartment.css`, not `css/style.css`. Every platform card waits for that folder to close (board README, Key state). The working folder `C:\RnD\.wt\platform-ui-ux\` exists with an empty manifest; no product file has changed.

**Eliran decides:**
1. Approve this plan. Five defaults below stand unless he changes them.
2. The go for `npm ci` in the Studio working copy (Phase 3, final check only).
3. The theme pick at the Phase 1 gate.
4. Every deploy, each with its own go (root §9).

## Context
Eliran, 2026-11-03: improve the look of the platform itself, without touching the video or the visualizations, on its own branch in `.wt`. Research came first; the product vision is a place where a developer uploads a project's files, and behind the scenes an LLM and the render pipeline produce the exterior video and then the apartment's visualization.

Research (measured 2026-11-03, screenshots in `current/`): `C:\RnD\Projects\Habait\research\platform-ui-ux-2026-11-03\README.md`, with `raw-A-platforms.md` (21 platforms) and `raw-B-patterns.md` (patterns, 15 ranked principles, a 30-item audit checklist).

Measured on https://habait-flow.vercel.app and the local Studio:
- The apartment page throws "Failed to construct 'URL'". Cause: `js/apartment.js:110` `new URL(ext.url)` has no base, and `stage_flow.py` rewrites the hold URL to `/hold`. **This is fixed on board apartment-3d (rnd-fd, card 08, live at its card 10 copy-back), not here.**
- Heebo is named in every CSS file but never loaded.
- The home page is one card on an empty dark canvas, and the developer mark is dark on dark.
- Dev labels are public: `js/landing.js:64` "תצוגת פיתוח" (shown on `meta.fixture` with no DEV gate, `:147`) and `flow.html:50` "placeholders (clay)". `index.html:35` already gates its own dev items behind `DEV`.
- The landing gallery shows clay because `stage_flow.py:11` excludes `_local`. `_local/dist/rainbow/846/apartment.json` 404s, and `landing.js` falls back to the fixture stills (`:107-118`).
- Studio (`Habait/studio/dashboard/`) is local only and does not start: `zod` is not installed. It prints raw float durations and shows 16 identical players with no hierarchy, in a light and orange look unrelated to the buyer side.
- There are no shared tokens. Each of `style.css`, `landing.css`, `apartment.css`, `dashboard.css` and the Studio's `style.css` redefines colour, radius and font.

## Scope
**In:**
- `Habait/platform/`: `index.html`, `landing.html`, `apartment.html` (the page frame, not the 3D tab), `css/*.css`, `js/i18n.js`, `js/landing.js`, the page-level parts of `js/apartment.js`, and new `css/tokens.css`, `fonts/` and `styleguide.html`.
- `Habait/studio/dashboard/` (`index.html`, `app.js`, `style.css`).
- The colour, font and radius of the chrome over the visualization (the unit card and legend in `picker.js`/`flow-real.css`). This is CSS only; behaviour and layout stay untouched.
- One staging change in `tools/deploy-vercel/stage_flow.py`: include `_local/dist/<project>/<unit>/`, so the real apartment media reaches the site.

**Out:**
- `/hold/` (flyover3d), `/tour/` (tour360) and every clip, render, Kling, fal or Blender step.
- `js/apartment-3d.js`, `tools/build_zip.mjs` and the dollhouse (board apartment-3d).
- `js/flow.js`, `viewer360.js` and `cine.js` behaviour.
- Studio server, pipeline and API changes; the engine wiring from upload to the three deliverables (that is the engine track, card 37's gap map).
- Email or WhatsApp notifications.
- Legal and accessibility wording (Eliran's, §6).

## The five defaults (from the research's §4, applied unless Eliran says otherwise)
1. **The developer studio lives in the platform's design system and runs locally only for now.** The public site stays buyer-only. A public demo of the studio is a later, separate decision.
2. **Theme: both are built and Eliran picks after seeing them.** Tokens carry a light editorial theme and a refined dark one. `styleguide.html` and the redesigned home page render in both, side by side. The research leans light outside and dark only inside the media. Until he picks, light is the default.
3. **Type: Heebo (UI and body) + Frank Ruhl Libre (display headings).** Both are OFL and self-hosted as woff2 in `platform/fonts/` with the licence files; no Google Fonts call at runtime. A commercial Israeli face costs money and is Eliran's call, not part of this plan.
4. **Chrome over the visualization:** tokens only (colour, font, radius). No change to positions, timing or behaviour.
5. **Legal caption:** wording unchanged. The page shows a one-line summary plus "לנוסח המלא" that opens the full text in place, so it no longer fills half the landing page. Whether that display is acceptable is Eliran's check at the Phase 2 gate.

## Step 0: the working folder (no git), `C:\RnD\.wt\platform-ui-ux\`
- **Layout:** `files\<path relative to C:\RnD>` (`.wt\CLAUDE.md`). The copy is runnable: all of `Habait\platform\` (code, css, js, fixtures, tools, test; not `fixtures\rainbow\orbit_real.mp4` or `_local\segments`) and `Habait\studio\dashboard\` + `styles\`. Copy `_local\dist\rainbow\846\` read-only for the landing and apartment media.
- **Manifest:** `sha256_at_open` for every copied file. New files get `null`.
- **Files held by board apartment-3d** (`apartment.html`, `css/style.css`, `js/apartment.js`, held in `.wt\apartment-3d`): copied here **only after** that board's copy-back (rnd-fd agreed 2026-11-03), so their `sha256_at_open` includes its work. Until then:
  - Phase 1 writes `tokens.css` as a new file.
  - Phase 2 starts with the home and landing pages.
  - The apartment page waits.
- **`CHANGES.md`:** what is on the branch for Eliran. Each changed or new file gets a readable before/after summary, regenerated after each step.
- **Preview:** `PORT=8852 node files\Projects\Habait\habait-walkaround\Habait\platform\serve.mjs`, bounded and killed by PID after each check (root §12). 8850 and 8851 belong to others.
- **Close:** copy back only changed files, each only if the live sha256 still equals `sha256_at_open`; otherwise stop and reconcile. Nothing is copied back before Eliran's "good".

## Phase 0: fixes that need no design decision ($0)
1. Gate the landing's dev badge like `index.html:35` (`DEV` = laptop or `?dev=1`), and gate `flow.html`'s `#fixtureNote` the same way.
2. Load the fonts: `@font-face` for self-hosted Heebo (variable, wght 300–800) and Frank Ruhl Libre (500, 700) with `font-display: swap`, plus a preload for the Heebo file.
3. Developer mark on cards: a light plate behind the logo, or the logo's light variant from `project.json`, at contrast ≥ 3:1. Measured, not eyeballed.
4. Studio: format durations as `m:ss` and costs as `$0.00`; use `<bdi>` for numbers inside Hebrew.
5. `stage_flow.py`: also copy `_local/dist/<project>/<unit>/` (manifest, stills, plan, media) and never `_local` as a whole. The staged-copy check then shows 0 × 404 on the landing and apartment pages. This takes effect on the next deploy only, with its own go.

## Phase 1: one design system ($0)
- **`css/tokens.css`:**
  - Colour: one neutral ramp (LCH-derived) + brand primary + one accent + status (available, reserved, sold), each paired with a text label.
  - Two themes via `[data-theme]`: light editorial and dark. White-label: `project.json` may override only `--brand-*`.
  - Type scale of six steps (display uses Frank Ruhl Libre; text uses Heebo; Hebrew body line-height ≈ 1.6; no letter-spacing on Hebrew).
  - Spacing on a 4 px grid; three radii; two shadows; motion tokens (durations 150/250/400 ms, one ease). `prefers-reduced-motion` turns motion off.
- **Components, as CSS classes with no framework:** button (primary, secondary, ghost, WhatsApp), card, media card with reserved aspect ratio, badge/status chip (colour + text), file row, step timeline (waiting / running / needs you / done / failed), result card (empty, in progress, ready), sticky CTA bar, spec grid (numbers in `<bdi>`), the disclosure badge "הדמיה · AI-generated", and the legal summary with expand.
- **`styleguide.html`:** every token and component in both themes, RTL, at 1440 and 390 width.
- **Gate 1 (Eliran):** he looks at the style guide and the home page in both themes and picks the theme. Nothing else proceeds on the buyer pages until he picks; the Studio may.
- Existing CSS files switch to the tokens. Their own colour, radius and font literals are removed, and each file keeps only its layout.

## Phase 2: the buyer pages ($0; the media itself unchanged)
1. **Home (`index.html`):**
   - Header: Habait wordmark plus language toggle.
   - Hero: one line of what Habait is, over the project's own cover still.
   - Project gallery: large media cards with developer mark, city, a status summary ("12 דירות · 4 פנויות"), one CTA "לסיור בפרויקט".
   - A footer with the accessibility-statement link slot (the text is Eliran's).
   - The research's three-part empty state applies when there are no projects.
2. **Project landing (`landing.html`):**
   - Media first: the flight's poster with a play affordance into the existing flight.
   - ~~Three highlights from `project.json`~~ (not built: project.json has none and the landing forbids marketing text, D-WQ-18; Eliran's blanket approval 2026-11-03, judge Q6 = a), then availability as a list or grid of apartments (status chip + rooms + area + floor). This is the non-visual alternative to the picker, and each row links to its apartment page.
   - The lead block, then the one-line legal summary.
   - Gallery from the real `_local/dist` stills (after Phase 0 step 5), with clay never shown to buyers.
3. **Apartment page frame (`apartment.html`, after the apartment-3d copy-back):**
   - Title row with unit number, rooms, area and floor in `<bdi>`.
   - Tabs restyled on the tokens. The 3D tab's content is untouched.
   - Spec grid; a sticky CTA bar on phone (WhatsApp, call, ZIP) that never covers the media; back to the building.
4. **Chrome over the visualization:** the token pass on `picker.js`'s unit card and legend and on `flow-real.css`. A screenshot diff of `/hold/` before and after must show the same layout with new colour and type only.
- **Gate 2 (Eliran):** before/after screenshots of every page, both widths. He checks the legal-summary display (default 5).

## Phase 3: the developer studio ($0; UI only, on the existing API)
The flow is the research's three visible steps plus one review, in `Habait/studio/dashboard/` on the shared tokens:
1. **הפרויקטים שלי:** project cards with cover, state, and the last run's cost. A three-part empty state with "פרויקט חדש".
2. **New project:** a two-field wizard (name, address); then straight to upload.
3. **Upload:**
   - One large drop zone with a click fallback and accepted types stated up front.
   - One row per file: name, size, progress, remove.
   - A role chip (תכנית מכר / הדמיה / חזית / אחר) suggested client-side from extension, name and page count, editable. It is stored in the existing `notes` field until the API carries a role. This is UI only and says so in a tooltip.
4. **"מה המערכת הבינה":** the existing `intake` shown as a review card (rooms, areas, floors, units). The intake's own `confidence` (0.82 on apt846) is shown once at the top, and each entry of its `uncertainties` list is flagged on the field it names, with colour + text. Nothing else is flagged. "אישור" calls the existing `approve-plan`.
5. **Create:**
   - The estimate from the existing `create-hint` sits on the button.
   - A step timeline mapped from the existing stage list and `state.json` (waiting / running / needs you / done / failed, elapsed time). Never a fake percentage.
   - The page can be left and the state is restored on return; that already holds, since state is on disk.
6. **Results:** three deliverable cards in the order of Eliran's vision.
   - (a) The exterior video.
   - (b) The building with clickable apartments.
   - (c) The apartment visualization.
   - Each card is empty, in progress or ready. The Studio's per-room clips sit inside (c) as a collapsed list with formatted durations.
   - Where the Studio pipeline does not yet produce a deliverable, the card says "עוד לא בשרשרת הזו" honestly instead of hiding it.
7. **הגדרות מתקדמות:** everything else (styles, variants, lat/lon, panos), one level deep.
- **Development without an install:** the UI is built against a recorded fixture API, an extension of `research/platform-ui-ux-2026-11-03/current/cap_studio.cjs`. GETs are answered from `_local/projects/apt846-rainbow-tlv`, and POSTs are refused.
- **Final check needs Eliran's go:** `npm ci` in the working copy's `Habait/studio`, then the real server on a free port, upload of one small file and back. **No run of a paid stage.**

## Phase 4: verification and copy-back ($0)
1. The project's tests in the working copy: `npm test`, `test/landing.test.mjs`, `test/apartment.test.mjs`, `test/card-overflow.test.mjs` and `test/browser.mjs` in the platform; `node test/run.mjs` in the Studio. All green, or every failure explained.
2. An after set in `research/platform-ui-ux-2026-11-03/after/`, using the same capture scripts, URLs and sizes as `current/`. Add 1280×720.
3. Audit against the research's 30-item checklist:
   - Contrast measured (4.5:1 text, 3:1 UI).
   - The keyboard path works on every page and in the Studio.
   - `prefers-reduced-motion` is honoured.
   - Status is never conveyed by colour alone.
   - No physical `left`/`right` in changed CSS.
4. A fresh-context review by `qa-reviewer` (project agent), reading the before and after frames against this plan.
5. Eliran looks, says "good", then the copy-back (Step 0 close). Deploy is a separate go.

## Board
`/plan-to-tasks development/plans/2026-11-03-platform-ui-ux.md`. Builder: `platform-dev`. Gates: `qa-reviewer`.

Order:
- **Step 0**
- **Phase 0**
- **Phase 1 → Gate 1**
- **Phase 2:**
  - Home and landing first.
  - The apartment page frame after the apartment-3d copy-back.
- **Phase 3:** in parallel with Phase 2 after Gate 1, since it doesn't depend on the theme pick beyond tokens.
- **Phase 4**

At most two workers at a time (SESSIONS rule 4: the subscription limit is the real bottleneck).

## Risks
- **Board apartment-3d holds three of our files.** Mitigation: we wait for its copy-back and hash at open after it, and agreed the order with rnd-fd. If its close slips, Phase 2 step 3 waits, and nothing else does.
- **White-label colours from `project.json` can break contrast.** Mitigation: only `--brand-*` is overridable, and the style guide checks the contrast of the brand-on-surface pairs.
- **The Studio's pipeline is the older per-room-video one, while Eliran's vision is the three deliverables.** The UI shows the three cards and is honest about which are not produced yet; wiring the engine is a separate track.
- **The deploy carries the apartment-3d changes too, if they have closed.** Each deploy is Eliran's go anyway; the deploy note lists both boards' files.

## Done when
- Every page in scope renders on the tokens in Eliran's chosen theme, with fonts loaded and zero dev labels for buyers.
- The landing and apartment pages show real media with 0 × 4xx in the staged-copy check.
- The Studio shows the three steps + review + three deliverable cards on the tokens.
- Tests are green, the 30-item audit is passed or each exception is named, and the `qa-reviewer` verdict is filed.
- Eliran said "good" and the copy-back is recorded in the manifest.
