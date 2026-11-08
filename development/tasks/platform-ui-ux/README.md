# Board — platform-ui-ux
<!-- created: 2026-11-03 · plan: development/plans/2026-11-03-platform-ui-ux.md · coordinator: main session rnd-ed · owner: Eliran Shopen -->

**Source:** `development/plans/2026-11-03-platform-ui-ux.md`. Read it first: this README gives the execution order, and the plan gives the reasons. Research: `C:\RnD\Projects\Habait\research\platform-ui-ux-2026-11-03\README.md` (+ `raw-A-platforms.md`, `raw-B-patterns.md`, before frames in `current/`).
**Goal:** the Habait platform shell (home, project landing, apartment page frame, developer Studio) runs on one design system with loaded fonts, no dev labels for buyers and real media. The video and the visualizations stay untouched. Everything is built in `C:\RnD\.wt\platform-ui-ux\` and copied back only on Eliran's "good".
**State:** `CLOSED` 2026-11-04 (shipped, QA 22 PASS; was `SHIPPED (QA 22 PASS)` until the state vocabulary was settled 2026-11-04, plan `2026-11-04-workflow-cleanup.md`) — production https://habait-flow.vercel.app (deploy 1 dpl_9RL6…, deploy 2 dpl_Hprzb… with transition-rise); card 22 round 1 FAIL → fixed → round 2 PASS (`logs/qa-deployed-report.md`, `logs/prod-deploy-1.txt`). Was `CLOSED` 2026-11-03 23:40 (card 21 QA PASS) — was `EXECUTING` (filed 2026-11-03 16:21; card 01 answered 2026-11-03: approve · wait · no `npm ci` go). Session 1 = cards 02–07.

## Key state (update before every burst)
- 2026-11-03 16:21: board filed by rnd-ed. The working folder `.wt/platform-ui-ux/` exists with an empty manifest (`files: []`); no product file has changed.
- ⚠ **Finding at filing, which corrects the plan's Step 0 and Risks.** The plan says board apartment-3d holds three of our files: `apartment.html`, `css/style.css` and `js/apartment.js`. In fact `.wt/apartment-3d/manifest.json` holds **235 files: the whole runnable `Habait/platform/` copy**. That includes `index.html`, `landing.html`, `flow.html`, `serve.mjs`, every `css/*.css`, `js/i18n.js`, `js/landing.js` and `js/picker.js`.
  - `scripts/wt.py` refuses any path that another open folder holds (`held_elsewhere`). A dry run at 16:21 confirmed the refusal for `serve.mjs`.
  - apartment-3d actually changed 11 files (`.wt/apartment-3d/CHANGES.md`): `apartment.html`, `css/apartment.css` (**not** `style.css`), `js/apartment.js`, `js/apartment-3d.js`, `tools/build_zip.mjs`, and six under `_local/dist/rainbow/846/`.
  - **Consequence:** every card that writes under `Habait/platform/` waits until apartment-3d's manifest is closed (its card 10). The exceptions are new files, which no manifest holds.
  - Not held, so free now: `Habait/studio/dashboard/*` (index.html, app.js, style.css), `Projects/Habait/tools/deploy-vercel/stage_flow.py`, and the new `css/tokens.css`, `css/components.css`, `fonts/` and `styleguide.html`.
  - Card 01 asks Eliran: wait (default) or ask rnd-fd to release the unchanged paths.
- **Navigator calls (rnd-ed, logged for Eliran's audit):**
  - (1) Because of the hold, the Studio (Phase 3) runs **before** Gate 1 rather than after it. It depends only on the tokens; whichever theme Eliran picks becomes its default through one `data-theme` attribute.
  - (2) Plan Phase 4.4 ("a fresh-context review by `qa-reviewer` reading the before and after frames against this plan") goes to `habait-ux-judge`, whose charter is exactly that. `qa-reviewer` keeps the runnable Check and the 30-item audit (card 18).
  - (3) The plan's font load (Phase 0.2) is split. The `@font-face` rules are written in new files now (card 05); the `<link>` on the pages waits for the hold to clear (card 10).
- **Who executes:**
  - `platform-dev` and `qa-reviewer` are **project agents** (`C:\RnD\Projects\Habait\.claude\agents\`). They load only in a session started from `C:\RnD\Projects\Habait`.
  - rnd-ed started at `C:\RnD`, so the main session runs the builder cards itself, as apartment-3d did.
  - The gates go to a FRESH Sonnet sub-agent, briefed with `qa-reviewer.md`'s charter and boundary, that never saw the implementation.
  - `habait-ux-judge` is a harness agent and is spawned directly.
- **Two sessions on purpose (fan-out rule, Step 15).**
  - Session 1 = cards 01–08: everything the hold does not block.
  - Session 2 = cards 09–22: they start when apartment-3d's manifest shows `closed`. Check it with `python scripts/wt.py status apartment-3d`.
- 2026-11-03: Eliran will give the go in a **new session** (rnd-ed explained the reach of "go": 02–07 only; 08 needs "npm ci"; 09–20 wait for apartment-3d; gates 12/17/20 stay his). The new session records his words in card 01 before card 02.
- 2026-11-03: Eliran ruled that every board ends with QA cards (root §8.9). Cards 21 (live-repo QA) and 22 (deployed-site QA) were added; card 20 is now the copy-back only.
- 2026-11-03: **card 01 answered** (task-01 §Answers): plan approved as written; hold = wait; `npm ci` = no go yet → card 08 waits, session 1 ends at card 07.
- 2026-11-03 16:37–17:05: **session 1 ran cards 02–07** (main session as platform-dev; logs `logs/c03…c07`). 32 manifest entries, 0 live drift, 8852/8853 free, $0.
  - Found: **OWED-023**. The live `stage_flow.py` cannot run, because `Habait/platform/node_modules/three` was not carried by the cut-over. Every deploy needs an install go first.
  - Navigator calls (logged for Eliran's audit):
    - (4) Fonts come from Fontsource 5.3.0 on jsDelivr rather than tour360's copies, whose source was never recorded.
    - (5) Components are namespaced `hb-*`, so they cannot clash with the old `.btn`/`.card` before card 13.
    - (6) Studio deliverable (a) = this chain's exterior clips; (b) says "עוד לא בשרשרת הזו"; (c) = master + room clips.
    - (7) File roles ride in `notes` as one `[roles] {json}` line, hidden from the notes field.
    - (8) Studio fonts are generated copies in `dashboard/fonts/`, alongside `tokens.css`/`components.css`.
- 2026-11-03: **Eliran changed 01b to release** ("כן"). The request went to rnd-fd (msg 0b48d97f). It names index/landing/flow, serve.mjs, the shell CSS, i18n/landing/picker JS, package.json, test/ and fixtures/rainbow/. Waiting for rnd-fd's reply, which should give the time and the paths released.
- 2026-11-03 17:14: **rnd-fd released 37 unchanged paths.** Its manifest moved them to a `released` key and now holds 198 files. Still held: `apartment.html`, `css/apartment.css`, `js/apartment.js`, `js/apartment-3d.js`, `tools/build_zip.mjs`, `_local/dist/rainbow/846/*` and ~34 other platform files. Those stay held until its card 10.
- 2026-11-03 17:19–17:31: **cards 09–11 DONE.**
  - Card 09 added 48 platform files (not `test/shots/`). Baseline: smoke 12 · landing 35 · card-overflow 18 · browser 25 — all green.
  - Runnable tree: `.wt/platform-ui-ux/tools/preview.py`, a throwaway build in the scratchpad. It overlays the live platform read-only, never edits it and never copies anything back.
  - Navigator calls (logged for Eliran's audit):
    - (9) Buyer-view checks run on host `buyer.test`, because DEV is true on 127.0.0.1.
    - (10) `flow-real.css`'s `--caption-h` default moved to `:root`, a regression fix exposed by the real Heebo.
    - (11) `apartment.html`'s font link moves to card 16.
    - (12) The home page no longer links `style.css`.
  - Home copy is a draft for Eliran (CHANGES).
- 2026-11-03 17:35–18:27:
  - **Cards 08 and 12–15 DONE.**
    - Eliran: "תעשה מה שצריך בשביל להגיע לתוצאה ושנתקדם". This was read as the `npm ci` go (working copy only) and as the default theme (light). It is not a go for copy-back or deploy.
    - Gate 1 FAILED once (`browser.mjs` was stale after card 11), was fixed, then PASSED.
  - Navigator calls (logged for Eliran's audit):
    - (13) a theme-independent `--chrome-*` token set for the controls over the media;
    - (14) `style.css` `@import`s `tokens.css` (the hold loads it cross-origin);
    - (15) `browser.mjs` updated to the new home markup and to the token status colours;
    - (16) landing highlights not built: there is no data, and D-WQ-18 forbids marketing text.
  - flow-cine flake recorded (1/5 runs, iPhone glide timing).
- 2026-11-03 ~18:35: rnd-fd's ETA for the copy-back of `apartment.html`/`css/apartment.css`/`js/apartment.js` is **~3 h, and it depends on Eliran**. Before it: dollhouse floor textures (~1–2 h), a fresh-reviewer gate, then Eliran's "good". rnd-fd will message when its card 10 has copied them back. It noted the `--line` alias plan.
- 2026-11-03 ~18:55: **Vercel PREVIEW deploy** on Eliran's "go ל-preview ב-Vercel": https://habait-flow-qxl71je9p-eliran-5390.vercel.app (target preview, behind Vercel Authentication). Production is untouched. Evidence: `logs/preview-deploy-1.txt`.
- 2026-11-03 19:40–22:10:
  - **Card 16 DONE.**
    - apartment-3d closed at 19:40. rnd-fd refreshed 4 generated context files (`platform/CLAUDE.md`, `css/`, `js/`, `tools/`), so they show as explained drift at close: take the live version or re-run `generate-cards`.
    - `tools/build_zip.mjs` was released to rnd-fd, who made it copy tokens/components/fonts into the apartment dist (live ~20:10, sha ae5026ce…).
  - **Eliran's blanket approval (21:50).** Cards 17/18 went to one fresh reviewer (running).
  - New plan filed: `development/plans/2026-11-03-studio-agent-fal.md` (the Studio agent chat + intake through a fal LLM), after card 20. Drafts in the scratchpad `agent-draft/`.
  - Owed after card 20:
    - `npm ci` in the live `Habait/platform` (OWED-023, under the blanket approval);
    - rebuild the 846 dist from live with `build_zip`;
    - refresh `platform/tools/CLAUDE.md`'s table (`generate-cards --apply`).
- 2026-11-03 ~22:30:
  - `js/apartment-3d.js` (unchanged here) was released to rnd-fd's board dollhouse-in-tour.
  - **The 846 dist is NOT rebuilt by this board.** rnd-fd holds `_local/dist/rainbow/846/*` and rebuilds it from live at its close. If this board closes after it, rnd-fd messages and this board rebuilds it once.
- 2026-11-03 23:01: rnd-fd's dollhouse-in-tour closed; this board holds nothing of rnd-fd's and rnd-fd nothing of this board's.
  - **This board's work after the card 20 copy-back:**
    1. rebuild the platform 846 dist (`tools/build_zip.mjs`, needs the live platform `node_modules`: `npm ci` first, OWED-023);
    2. then `node Habait/tour360/tools/build-tour.mjs apt846` (no flags);
    3. then `generate-cards.py --apply` for `platform/`, `platform/css`, `platform/js`, `platform/tools`.
  - The 4-file context drift is rnd-fd's 19:42 refresh, nothing new.
- Resume point: **card 16** once rnd-fd's card 10 copy-back makes `apartment.html`/`apartment.css`/`apartment.js` free (asked rnd-fd 18:28, msg 87ee9c91). Then 17 (Gate 2: Eliran checks the legal-summary display), 18, 19, then 20 on Eliran's "good"

## The cards (execution order; at most two workers at once, per the plan and `SESSIONS.md` rule 4)
| Burst | # | Card | Agent | status / track | model | tier | State |
|---|---|---|---|---|---|---|---|
| 1 | [01](task-01-eliran-calls.md) | Eliran's calls: approve the plan + five defaults; the apartment-3d hold (wait / release); the `npm ci` go for card 08 | main session → Eliran | — | — | T1 | DONE 2026-11-03 (approve · wait · no npm go) |
| 2 | [02](task-02-open-phase-a.md) | `wt.py add`: the free set (Studio dashboard, `stage_flow.py`, new platform files); `CHANGES.md` | main session | — | — | T0 | DONE 2026-11-03 16:39 (5 copied, 3 new; 0 drift) |
| 3 | [03](task-03-stage-flow-dist.md) | `stage_flow.py` also stages `_local/dist/<project>/<unit>/`, never `_local` whole | `platform-dev` | live / habait | opus | T0 | DONE 2026-11-03 16:41 (`logs/c03-stage.txt`: 0×4xx on _local/dist, lists identical; found OWED-023) |
| 3 | [04](task-04-studio-formatting.md) | Studio: durations `m:ss`, costs `$0.00`, `<bdi>` numbers | `platform-dev` | live / habait | opus | T0 | DONE 2026-11-03 16:42 (`logs/c04-format.txt`: 11/11) |
| 4 | [05](task-05-tokens-components-styleguide.md) | `tokens.css` (both themes), self-hosted fonts, `components.css`, `styleguide.html` | `platform-dev` | live / habait | opus | T0 | DONE 2026-11-03 16:52 (`logs/c05-contrast.txt` 0 fails both themes + brand; `logs/c05-styleguide.txt`; frames `after/c05/`) |
| 5 | [06](task-06-studio-projects-upload.md) | Studio A: fixture API, הפרויקטים שלי, new-project wizard, upload with role chips | `platform-dev` | live / habait | opus | T0 | DONE 2026-11-03 17:03 (`logs/c06-studio.txt`; frames `after/studio/`; tokens-sync PASS) |
| 6 | [07](task-07-studio-review-results.md) | Studio B: "מה המערכת הבינה" review, create + step timeline, three deliverable cards, הגדרות מתקדמות | `platform-dev` | live / habait | opus | T0 | DONE 2026-11-03 17:03 (`logs/c07-studio.txt`: 0.82 ×1, 10/10 flags, no %, a·b·c) |
| 7 | [08](task-08-studio-live-check.md) | Studio live check: `npm ci` (Eliran's go), real server on :8853, one small upload and back, no paid stage | `platform-dev` | live / habait | opus | T1 | DONE 17:51 (`logs/c08-live.txt`: npm ci 9 pkgs; real server :8853; upload round-trip done; 0 stages, $0; run.mjs 13/14, 1 env failure explained) |
| — | — | **session break: wait for apartment-3d's manifest to show `closed`** | — | — | — | — | — |
| 8 | [09](task-09-open-phase-b.md) | `wt.py add`: the runnable platform set + `_local/dist/rainbow/846/` (read-only), hashed after apartment-3d's copy-back | main session | — | — | T0 | DONE 2026-11-03 17:19 (release 17:14; 48 added, 0 refusals; baseline 126 ok / 0 fail, `logs/c09-baseline.txt`) |
| 9 | [10](task-10-platform-phase0-fixes.md) | Phase 0 on the pages: dev-label gates, font links + preload, developer-mark contrast ≥ 3:1 | `platform-dev` | live / habait | opus | T0 | DONE 2026-11-03 17:28 (`logs/c10-phase0.txt`: buyer 0 dev labels, Heebo on, mark 6.97:1; caption-h regression fixed; tests = baseline; apartment.html link → card 16) |
| 10 | [11](task-11-home-redesign.md) | Home page on the tokens, both themes: header, hero, project gallery, footer slot, empty state | `platform-dev` | live / habait | opus | T0 | DONE 2026-11-03 17:31 (`logs/c11-home.txt`: 4 themes×sizes + empty, 0 errors, 0 h-scroll, status from data, home.css 0 literals) |
| 11 | [12](task-12-gate1-theme.md) | **Gate 1:** fresh refute of 05, 10, 11 → Eliran picks the theme | `qa-reviewer` (fresh) → Eliran | live / harness-ops | sonnet | T1 | DONE 17:50 (Gate 1: FAIL→fixed→PASS, `logs/gate1-report.md`; theme = light) |
| 12 | [13](task-13-css-migration.md) | Existing CSS files onto the tokens (literals out, layout kept): `style.css`, `landing.css`, `apartment.css`, `dashboard.css`, Studio `style.css` | `platform-dev` | live / habait | opus | T0 | DONE 17:59 (`logs/c13-literals.txt` 0 literal values; `c13-layout.txt` 94/94 landmarks ±2px; tests = baseline; apartment.css → card 16) |
| 13 | [14](task-14-landing-redesign.md) | Project landing: media first, highlights, availability list, lead block, legal summary + "לנוסח המלא", real gallery | `platform-dev` | live / habait | opus | T0 | DONE 18:27 (`logs/c14-landing.txt`: legal byte-equal he+en; 0 clay; 11/11 badges; 12 rows 200; tests = baseline) |
| 13 | [15](task-15-visual-chrome-tokens.md) | Chrome over the visualization: `picker.js` unit card + legend, `flow-real.css`, colour, type and radius only; `/hold/` screenshot diff | `platform-dev` | live / habait | opus | T0 | DONE 18:20 (`logs/c15-chrome.txt`: picker.js 0 lines; flow-real.css 6 values; anchors 0 px; flow-real 38 · flow-cine 43) |
| 14 | [16](task-16-apartment-frame.md) | Apartment page frame: title row, tabs on the tokens (3D content untouched), spec grid, sticky CTA on phone | `platform-dev` | live / habait | opus | T0 | DONE 21:57 (`logs/c16-apartment.txt`: CTA overlap 0 px all tabs; 0 errors, no URL error; tests = baseline; apartment-3d.js untouched) |
| 15 | [17](task-17-gate2.md) | **Gate 2:** fresh refute of 13–16, before/after frames at both widths → Eliran checks the legal-summary display | `qa-reviewer` (fresh) → Eliran | live / harness-ops | sonnet | T1 | DONE 22:54 (Gate 2: FAIL F1 price wrap → fixed → PASS; legal display approved under Eliran's blanket go; `logs/gate2-report.md`) |
| 16 | [18](task-18-verify-audit.md) | **Phase 4 gate:** all tests, the after set (+1280×720), the 30-item audit measured | `qa-reviewer` (fresh) | live / harness-ops | sonnet | T0 | DONE 22:54 (Phase 4: FAIL A1–A5 → fixed → PASS, CLS 0; named exceptions 9,10,13,15,16,27,29,30; `logs/phase4-report.md`) |
| 17 | [19](task-19-ux-judge-review.md) | **Phase 4 frames review:** before vs after against the plan, refute-first, one finding per row | `habait-ux-judge` | live / habait | opus | T0 | DONE 23:14 (habait-ux-judge: FAIL 4×S1 → 2 fix rounds → PASS-WITH-NOTES; open: F8, F10 (S2), Q4/Q5/Q7 Eliran's; `logs/ux-review.md`) |
| 18 | [20](task-20-close.md) | Copy back: Eliran's "good" → `wt.py close` (hash check, copy back) → run entry + deploy note | main session | — | — | T1 | DONE 23:16 (copied back 164/164 verified; 4 context files reconciled to live; npm ci live (OWED-023); 846 dist + tour rebuilt; generate-cards; Eliran's blanket go) |
| 19 | [21](task-21-qa-live.md) | **QA — live repo after the copy-back:** hashes, nothing out of scope changed, tests + live preview on :8852 → board CLOSED | `qa-reviewer` (fresh) | live / harness-ops | sonnet | T0 | DONE 23:25 (QA live: PASS; Studio live run.mjs CANNOT-RUN, no node_modules — npm ci after plan studio-agent-fal; `logs/qa-live-report.md`) |
| 20 | [22](task-22-qa-deployed.md) | **QA — deployed site** (only after Eliran's own deploy go): paint proof on every alias, 0 × 4xx, fonts, no dev labels, badges | `habait-deploy-qa` | live / habait | sonnet | T1 | BLOCKED (deploy go) |

Burst rule: the plan allows at most two workers at once, under the root limit of five (root §10.2). Cards 03∥04 and 14∥15 touch disjoint files. Every other card runs alone because it shares files with its neighbours or is a heavy run. Every card can be resumed: it states what it has already written before it continues.

## Gates
- **12 (Gate 1), 17 (Gate 2), 18 and 19 (Phase 4), 21 and 22 (final QA, root §8.9).** Each has `Check:` and `Reviewer scope:` lines in its card.
- **The board ends with QA** (Eliran, 2026-11-03, root §8.9): nothing but QA comes after card 20. The board is `CLOSED` when card 21 passes; card 22 runs after a deploy Eliran authorises on his own and sets `SHIPPED`.
- The reviewer is a fresh sub-agent that never ran the card under review and is prompted to refute. Gates 12, 17 and 18 use Sonnet; gate 19 is `habait-ux-judge` on Opus, by its own definition.
- After Gate 1, no buyer-page card starts until Eliran has picked the theme. After Gate 2, nothing proceeds until he has checked the legal-summary display.
- Previews: platform `http://127.0.0.1:8852/`, Studio `http://127.0.0.1:8853/`. Both are bounded and killed by PID.

## Standing rails (inherited verbatim into every card — root `CLAUDE.md` §0)
1. **Bounded read-first:** `memory/HOT.md`, then the LAST ~150 lines of your own `memory/agents/<name>.md` (plus its archive-index block). ⛔ Never read `memory/INDEX.md` whole — grep it.
2. **Write last, once:** ONE entry (`memory/_TEMPLATE.md`) into the layer that owns the fact, plus ONE ≤ 400-char pointer line under that layer's existing `memory/INDEX.md` header. ⛔ Never add a header.
3. **Second reader:** name which OTHER actor must know this; append ONE pointer line into their `memory/agents/<name>.md`, or say "none".
4. **An action is not done until its memory is written.**
5. ⛔ **The live files under `C:\RnD\Projects\Habait\habait-walkaround\` and `C:\RnD\Projects\Habait\tools\deploy-vercel\` are read-only to every card until card 20.** Every write goes into `C:\RnD\.wt\platform-ui-ux\files\<path relative to C:\RnD>`, into `.wt\platform-ui-ux\tools\` (dev scaffolding that is never copied back) or into this board folder. Memory rows are the only live writes (root §8.7).
6. ⛔ **No git anywhere** (Eliran, 2026-11-03). `CHANGES.md` in the working folder is the diff.
7. ⚠ **Machine resource rules** (root `CLAUDE.md` §12): every test, build, server, browser or install runs as `timeout N <cmd>`, one heavy run at a time, in the foreground; kill what you start by PID. This board's ports: **:8852** (platform preview) and **:8853** (Studio, fixture or real). Never :8850, :8851 or :8820 (other sessions).
8. ⛔ **$0 board:** no paid call, no paid Studio stage, no Blender, Kling or fal. `npm ci` runs only on Eliran's go (card 01c). Deploying is a separate explicit go from Eliran (root §9).
9. ⛔ **Out of scope, never edited:** `/hold/` (flyover3d), `/tour/` (tour360), every clip and render, `js/apartment-3d.js`, `tools/build_zip.mjs`, the behaviour of `flow.js`, `viewer360.js` and `cine.js`, and the Studio server, pipeline and API. Legal and accessibility **wording** is Eliran's (§6). Every AI image keeps its "הדמיה · AI-generated" badge.
10. ⛔ **A path held by another open working folder is never copied in.** `wt.py` refuses it; never route around the refusal (no plain copy, no manifest edit, no second folder). Wait, or take Eliran's ruling (card 01b).

## Records
- Evidence: `development/tasks/platform-ui-ux/logs/` (test output, contrast measurements, gate reports; created with its context file when the first card writes) and `.wt\platform-ui-ux\after\` (frames; copied to `research\platform-ui-ux-2026-11-03\after\` at card 18).
- Memory: one `memory/runs/` entry at close by the main session; a pointer line in `Projects\Habait\memory.md` is not written (that file is frozen, grep-only).
