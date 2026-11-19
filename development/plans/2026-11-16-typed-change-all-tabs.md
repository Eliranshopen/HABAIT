# Typed change in every tab that sees the spot + a faster editor
<!-- last-updated: 2026-11-16 -->

**State:** LIVE ON habait-flow PRODUCTION since 2026-11-16 (`dpl_oJVuhJUb…`, Eliran's «תעלה … לאתר האמיתי»), merged into `main` (`42f41a1`), live on the test link (`dpl_4xh6KLAC…`). Verified on production: served = stage, the page at 1440 and 390, a paid canary through the deployed function. $4.84 booked of the $5 he approved. Open: his own try; the day cap and per-visitor limit; surfaces do not follow. Results: §9 (P1), §10 (P2); the deploys: `memory/runs/2026-11-16-typed-change-test-link.md`.
**Asked by:** Eliran, 2026-11-16 — «אני רוצה להעביר את השינוי לכל לשונית שרואה את הנקודה» and «מתוך המודלים הקיימים ב-FAL צריך למצוא מודל יותר מהיר ממה שעובד כרגע כי כרגע משלב הבקשה עד שלב התוצר של רינדור חדש לוקח מלא זמן».
**Diagnosis it follows:** `memory/project/2026-11-16-typed-change-one-tab-only.md`.

## 1. The ask
1. A free-text change made in one tab of the 360 tour (people added at the dining corner, typed in the kitchen tab) must also show in every other tab whose picture sees that spot.
2. The wait from the request to the new picture is too long: choose, among the models fal hosts, a faster editor than the ones in use.

## 2. What was found (2026-11-16, $0)
- Every tab is its own 360 picture. `viewer/edit-live.js` cuts the view on screen out of the current tab's picture, sends it to `api/edit`, pastes the changed region back into that picture only; nothing is saved. The live page serves this code (fetched 2026-11-16).
- The page already has what locating the spot needs: every interior scene carries its plan position (`scenes[].plan`, sheet pixels) and the plan bearing of its picture's centre (`centreBearingDeg`); the build ships a depth map per scene (`data.depth`, the ruler). Missing: the sheet's pixels per centimetre (in `cameras.json`: 2.25 × 0.4 = 0.9), one line in `build-tour.mjs`.
- The shipped depth maps are from the 2026-11-03 camera spots; kitchen moved about 49 cm and entrance 20 cm since (cameras.json vs depth.json). Good enough to AIM a 60–100° view at the spot, not for a pixel-exact paste. The editor places the change by what it sees (the table, the chairs) and by a reference picture.
- One typed turn today = a text step (OpenRouter, with reasoning) + one fal editor (`kontext` $0.04, `nb2` $0.08 for people, `flux3` for a resize) + for people often a judge call, and up to three attempts when the editor re-frames. The handler returns only the total time; no step times are recorded anywhere in git.
- fal's own guides (2026-03, 2026-07) give prices but no measured seconds per edit model. Candidates that are sold as fast or cheap and take a second image: FLUX.2 klein edit, Seedream 5.0 Lite edit ($0.035), Grok Imagine edit ($0.022), Nano Banana 2 at 0.5K ($0.06), FLUX.2 pro edit ($0.03/MP). Only a measured run on our own crops decides.
- The machine has no `FAL_KEY` / `OPENROUTER_API_KEY` (the secrets file went with `Projects/Habait`); the two Vercel projects have them.

## 3. Mechanism — part A, every tab that sees the spot
1. The first turn runs as today and its result shows at once.
2. The page finds the spot in the apartment: the centre of the pasted region → a direction in tab A; the distance along it from A's depth map (median of several samples; the floor under the region when there is no depth map); the spot P on the plan = A's plan position + that ray.
3. Every other interior tab B with a plan position is a candidate when P is within 12 m and nothing nearer blocks the ray from B (B's depth along the ray ≥ 80 % of the distance − 0.5 m). At most 3 tabs, nearest first.
4. For each B the page cuts a view aimed at P (60–100° wide, by the size of the change seen from B) and sends a FOLLOW turn: B's view + the first tab's edited view as a second image. The handler tells the editor: "the second image shows the same room from another camera after the change; make the same change here, the same people/objects at the same place, as seen from this camera; if that place is not in view, change nothing".
5. The follow turn skips the text step: the first answer carries a signed token of the prepared instruction (HMAC, 10 minutes), so the scope rule cannot be bypassed and no second text call is paid.
6. Follow turns run in parallel, in the background; the visitor keeps looking. Each result passes the same frame test as today and is pasted only where it changed. Undo of the change removes it from the other tabs too (the T18d links).
7. Scope of v1: changes of reach `object` (furniture, décor, people, pets). A wall/floor colour, the light and the view outside stay in their tab (phase 2). A terrace looking in through glass is not reached (the depth map stops at the pane).

## 4. Mechanism — part B, speed
- B1 ($0, in the same change): the handler returns the time of each step (text, piece read, editor) and the page keeps them in its turn record; follow turns pay no text step and run in parallel; the first picture shows before the other tabs are done.
- B2 (paid, measured): `tools/edit_bench.py` (+ `tools/edit-bench-cases.mjs` for the handler's own wording) — the same views (people at the dining table · the dining chairs swapped by words · a follow turn with a second image) through every candidate, twice: seconds, the frame-hold ring, the changed share, the picture. Dry by default, `--go` under `--cap`, ledger row before every call, a rerun never re-bills. Ten configs, all read from fal's public endpoint descriptions on 2026-11-16: today's `kontext` and `nb2-1k`, and `nb2-0.5k`, `klein-9b`, `klein-4b` (FLUX.2 klein, 4 steps), `flux2-flash`, `flux2-turbo`, `flux2-pro`, `seedream5-lite`, `grok`. 58 calls, books $2.35 (four prices are high-side estimates); cap $5.
- B3: the winner per kind of change goes into the handler's `MODELS` / `routeModel` (data, one line each). The text step's reasoning budget is measured in the same run (a refusal test set first).

## 5. Eliran's calls
| # | Call | Recommendation |
|---|---|---|
| Q1 | The key for the paid proof and the bench: `FAL_KEY` on this machine, or run both through the test Vercel project (needs a deploy go). **Only `FAL_KEY` is required** (corrected 2026-11-16 on Eliran's question): the bench calls fal's editors directly, and the handler's text step and judges go through fal's own router when `OPENROUTER_API_KEY` is absent (`server/chat-transport.mjs`, `hasChat`). Which route is faster is not measured; the new step times will say | `FAL_KEY` on the machine: no deploy for a measurement |
| Q2 | Budget: the bench books $2.68 for all 58 calls on fal's own prices, read 2026-11-16 (cap $3) + the cross-tab proof with a real editor (cap $2). Asked 2026-11-16 after he put the key in | yes, $5 in all |
| Q3 | Cost per change rises: every extra tab is one more paid edit (today $0.08 with nb2; less if the bench finds a cheaper editor). Day cap is $5 per instance, 40 requests per visitor per hour | raise to $10 a day and 120 requests an hour when this ships |
| Q4 | The same people in every tab is the editor's best effort (a reference picture, not 3D). The proof shows how close | judge it on the proof before the test link |

## 6. Phases
- P1 ($0): the build — page, handler, build line, checks with a stub host. Worktree `.wt/typed-change-all-tabs`.
- P2 (paid, after Q1/Q2): the hand proof kitchen → dining → living on apt846; the bench; the model choice written into the handler.
- P3: test link (`rainbow-v2-test`) on his go; 1440 and 390; his look. **Stage READY 2026-11-16, not deployed:** `C:\RnD\.wt\deploy-T-r49` = `test-r48` (what the link serves, hash-checked) + `tour/index.html` + `api/_handler.mjs`, built by `tools/restage-viewer.mjs` (the tour cannot be built here); the staged page passes `follow-live-check --as-is` at 1440 and 390.
- P4: habait-flow on his own go.

## 7. Risks
- The people differ between tabs (faces, clothes): reference picture + the instruction; measured in P2.
- The spot is aimed a few degrees off (old-spot depth maps): wide views, and the editor is told to change nothing when the place is not in view. Fresh depth maps from the current spots need the render assets (not on disk).
- More requests per change: the per-visitor limit and the day cap (Q3).
- `Projects/Habait` is off the disk: the code lives in the worktree; a full tour build needs the local media back.

## 9. P1 result (2026-11-16, $0)
- Built on branch `typed-change-all-tabs`, commit `6bc67b8`: `server/handler.mjs` (the signed `follow` token, `handleFollow`, step times), `viewer/edit-live.js` (the spot, the aimed rooms, side-by-side follow turns, linked undo, depth maps asked for at the typed field's first focus), `viewer/tour.js` (seven hooks), `tools/build-tour.mjs` (`apartment.plan.pxPerCm`).
- Checks: `tools/follow-check.mjs` 33/33 (nine old kinds of turn send the vendor the same requests as main's handler); `tools/follow-live-check.mjs` 18/18 at 1440×900 and 390×844 on a local copy of the served tour with a stub in the page. From the kitchen, looking at the dining table, the page aimed dining (2.07 m) and living (4.78 m) and no other room; both cut views show the table; the two turns left within 1 ms; undo cleared all three rooms. Evidence: `Projects/Habait/habait-walkaround/qa-evidence/tour360/typed-all-tabs-2026-11-16/REPORT.md` (in the worktree).
- Found on the way: the served `edit-live.js` equals main's byte for byte and the served `tour.js` differs by the one return-link line the stage step rewrites — main `a63494a` IS production's viewer code. `tools/catalog-probe.mjs --selftest` cannot run in this repo (its golden commit `1b04ba65` is in the old lab repo's history); `follow-check` carries its own comparison against HEAD.
- Not done: the paid proof (do the same people appear from the other cameras), any real timing, a full `build-tour` run (local media not on disk), merge, deploy. The speed bench is written and dry-tested only.

## 10. P2 result (2026-11-16, paid: $3.76 of the $5 Eliran approved)
Evidence and every number: `Projects/Habait/habait-walkaround/qa-evidence/tour360/typed-all-tabs-2026-11-16/REPORT.md` (in the worktree), `bench/REPORT.md`, the pictures beside them.
- **The faster editor (part B):** FLUX.2 klein 9B (`fal-ai/flux-2/klein/9b/edit`, four steps) answers the people view in 3.8 s against nb2's 12.6 s (3.3×) and the furniture view in 4.1 s against kontext's 9.0 s (2.2×), the frame held, two people as asked; fal lists it at $0.011 a megapixel (about 2–3 cents an edit against 4–8). It now takes the first attempt of a change of a thing inside the view (`FAST_EDITOR`); a refused answer goes on to the old editors. With a second image it answers the second image's view, so follow turns stay on nb2.
- **End to end, measured:** request → first picture 33.3 s with nb2 first, 16.0 s and 16.6 s with klein first (text step 4–5 s, editor 3.5 s, judge 7–9 s for a big change; through fal's text router). The other tabs land 20–24 s after that, in the background.
- **The cross-tab proof (part A):** the same people (clothes, hair, build) appear in the dining and living tabs. Their seats are the editor's composition, not the same seats seen from another side.
- **What the proof found and fixed:** two of six follow answers whose border held had the dining table itself redrawn (once three times too large); the plain furniture judge held one of them on the sofa in the foreground; no pixel measure separates them; a new judge wording that boxes the piece the change is AT read all six right twice (12 of 12) and is what follow turns use. Judge answers cut at 900 tokens through fal's router (3 of about 12) are why the ceiling is now 2400.
- **Every generation, not only people (Eliran, later the same day: «רמקולים ליד הטלוויזיה … מכרטיסיית סלון … ומכרטיסיית פינת אוכל»):** run for real from the living tab looking at the TV — two floor speakers beside the TV landed in the living tab and then, on the first attempt each, in dining, entrance and kitchen (`real-speakers-tv/`, $0.278). A first run of it was invalid (my mistake: the check ignored `--look=…`, $0.366) and showed the page aiming the main bedroom behind the TV wall; the follow now stays inside the same `zone` of `scenes.json`. Booked in all: **$4.40 of the $5**. Head of the branch: `a98dfd5`.
- **Open:** a tab whose two attempts are refused stays without the change (the page says so). A surface change (a wall's colour, the floor, the light) and the view outside still stay in their tab — Eliran's "every generation" may include them: his call whether that is the next piece. The rates come from four runs on one view. The judge (7–9 s) and the text step (4–5 s) are now most of the wait: the next speed lever is the text model and its transport, not the image editor. Q3 (the day cap and the per-visitor limit) and Q4 (his look at the pictures) are still his.

## 8. Done when
A change typed in the kitchen tab shows in the dining and living tabs within the same session, undo clears all three, the frame test passes in each, measured times are on record, and the chosen editor is faster than today's by measurement — on the test link at 1440 and 390, then on habait-flow on his go.
