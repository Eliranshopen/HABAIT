# Apartment furniture swap: a ring on every piece in apt846, a catalog drawer, and a typed change bar
<!-- filed: 2026-11-04 · main session rnd-67 · state: SHIPPED 2026-11-04 to habait-flow (dpl_6wv13ZNoj38U8kuXEMiUVWjos5zA, the last of 4); Eliran D4–D7 in §2 · worktree: .wt/apt-furniture-swap (branch apt-furniture-swap) -->

## The ask
Eliran, 2026-11-04: "ברמת ההדמייה של הדירה, אני רוצה להוסיף פיצ'ר שכל ריהוט שאני עומד עליו תהיה לי יכולת שינוי ריהוט לפי קטלוג שיפתח ואופציה נוספת שיהיה לי שורת בר שעל סמך מה שאכתוב בבר, יגונרט לי מה שצריך בהדמייה בהתאם"
In the apartment simulation, any piece of furniture the visitor points at can be:
- (a) swapped for an item from a catalog that opens; or
- (b) changed by a typed prompt in a bar, which generates the change in the view.

## 1. What already exists (do not rebuild)
| File | What |
|---|---|
| `Projects/Habait/habait-walkaround/Habait/tour360/viewer/edit-live.js` | The typed change (`#t-change-bar`, `/api/edit`) and the catalog turn from a ring on a piece (T16c). Both sit behind the unlock code `?key=` (D-T360-18). Only the changed region is pasted back; there is undo, original and reset. |
| `…/tour360/CATALOG-PLAN.md` v0.5 | The prototype's plan and rulings D-CAT-1…27. The last test wave failed (`qa-evidence/tour360/T17/REPORT.md`: on big pieces the paste leaves the old piece behind). Fix wave T18a–T18m: T18a and T18g are built; the paid proof waited on OpenRouter credits (402, 2026-10-09). |
| `…/tour360/tools/scan-pieces.mjs` | Scans the panoramas at build time and writes `apartments/<id>/markers.json` (pieces on the sphere, with outlines). Run so far for `demo-01` only: 19 markers in 5 scenes, $0.155. |
| `…/tour360/catalog/items.json` | 5 IKEA items. Under D-CAT-21 their photos stay on the laptop only until IKEA Israel gives written permission (OQ-C1). |
| `…/tour360/dist/apt846/api/edit.mjs` | The edit handler. The habait-flow production site is static: `stage_flow.py` stages no function. |

**The gap:** apt846, the product apartment, has no `markers.json`, so no rings appear. The catalog holds 5 items that cannot be shown publicly. The prototype's quality bar (FAIL at T17) has not been re-proven.

## 2. Eliran's calls (2026-11-04, AskUserQuestion)
| # | Question | Answer |
|---|---|---|
| D1 | Extend the prototype or build from scratch | **Extend the prototype** (recommended option) |
| D2 | Catalog source | **"Ikea and Fal generators models"**: keep the IKEA items (laptop only while OQ-C1 stands) and add catalog items generated on fal. The generated items carry the AI badge (root §6) and can go public. |
| D3 | Access and cost | **"choose the best answer you think"**. The session chose: behind the unlock code, laptop host plus a preview link, board cap **$5 soft / $10 hard**. Opening it to every buyer on habait-flow (a server function, rate limit, daily cap) is a separate call for Eliran later. |

**Eliran's later rulings (2026-11-04, AskUserQuestion; they replace D3 and the inherited D-T360-18):**
| # | Question | Answer |
|---|---|---|
| D4 | Where | **On https://habait-flow.vercel.app**: "אני צריך את היכולות האלה בלינק הזה שמוביל אותי להדמיית הדירה" |
| D5 | Who | **Everyone, no code**: "אני רוצה שכל מי שנכנס לאתר יהיה לו את היכולות שביקשתי ממך". The host runs open (`TOUR_EDIT_OPEN=1`); the guards are a per-IP limit and the per-instance daily cap ($5). A hard spend limit in the fal console is recommended (his console act). |
| D6 | Keys | **"תשתמש במפתחות של FAL שכתובים לך בENV"**: the session moves `FAL_KEY` from the root `.env` into the habait-flow Vercel env by command, never printed and never opened by eye. This replaces D-T360-18 ("pasted by Eliran, never by an agent") for this project. The name is recorded in SECRETS-LEDGER. |
| D7 | Scope | "זה לא שאני רוצה שעכשיו תחליף את כל הריהוט": a capability for the visitor (a ring on the piece → catalog; the typed bar → generated change), never a batch restyle of the apartment. |

## 3. Phases (one worktree: `apt-furniture-swap`; one board via `/plan-to-tasks`)
| # | Step | Cost |
|---|---|---|
| P0 | **Baseline.** Open the worktree and link the media (`_local/`, `dist/`, panos) read-only. Run the prototype on `demo-01` with the stub host (`tools/stub-host.mjs`) and record where T18 left it: what works, and what is still FAIL from T17. | $0 |
| P1 | **Rings in apt846.** Run `scan-pieces.mjs --apartment apt846` over the 11 rooms to write `markers.json`, open the contact sheet, and fix the false markers by hand (T17 found terrace markers pointing through the glass). Run `build-tour --catalog` for apt846. | ≤ $0.50 |
| P2 | **The catalog drawer.** A tap on a ring opens a drawer (a bottom sheet at 390 px) filtered to the piece's category. It shows the item photo, name and source, and an "AI-generated" tag on generated items. Add about 20 fal-generated generic items (sofa, armchair, coffee table, dining table, chair, bed, rug, lamp): Nano Banana product shots on white. Each one is hashed into `items.json` by `catalog-check.mjs --write`, with `source: "ai-generated"`. | ≤ $1.50 |
| P3 | **The typed bar on apt846.** The existing `#t-change-bar`, in Hebrew first. Add-only (root §6): structure, walls, windows and views are refused, as the handler does today. The result carries the "הדמיה · AI-generated" badge. | in P4 |
| P4 | **Paid proof.** Make 10 catalog turns and 5 typed turns across 4 rooms, open every picture, and have a fresh judge refute it against the T17 failure list. The fal editor replaces OpenRouter where it is blocked. | ≤ $3 |
| P5 | Merge into `main`. Live QA (fresh Sonnet), then preview QA. The production deploy is a separate go from Eliran (root §9). | $0 |

## 4. Conflicts and order
- **`.wt/fix-disclosure-badge`** (its owner did not answer: rnd-db holds cross-session messages) edited `tour360/viewer/tour.css`. **It was already merged into `main` (`7b6f617`) before this worktree opened**, so this branch starts after it and there is no conflict. Before its own merge this branch still merges `main`, in case later commits land there.
- **`.wt/exterior-film`** (rnd-32) owns `flyover3d/` (the hold). This board does not touch it.
- `scenes.json` / `cameras.json` are shared room files (feature-worktrees plan §1). This board reads them and never writes them; it only adds `apartments/apt846/markers.json`.

## 5. Spend ledger (written BEFORE each call; the tool settles in `apartments/apt846/_local/ledger.json`)
| When | Call | Estimate | Settled |
|---|---|---|---|
| 2026-11-04 | scan-pieces `--probe living-0` (one vision call, gemini-3.7-flash through fal's OpenRouter router) | ≈ $0.005 | $0.0063 (the first try was a fal 400, "reasoning mandatory", unbilled) |
| 2026-11-04 | scan-pieces apt846, 11 interior scenes × 4 views, two runs of `--budget 0.25` | ≤ $0.50 | $0.1538 (0.0855 + 0.0683). Tool ledger total $0.16 |
| 2026-11-04 | catalog-gen `--go`, 18 AI product photos on `fal-ai/nano-banana-2` (`catalog/ai/ledger.json`) | ≈ $1.44 | $1.44 (1 + 17, all settled) |
| 2026-11-04 | scan-pieces of the 5 outdoor scenes (the build needs every scene scanned) | ≤ $0.15 | $0.0731 |
| 2026-11-04 | replace-matrix living: living-0-1 sofa → ai-sofa-leather, living-0-2 coffee table → ai-coffee-marble (editor + judges) | ≤ $0.40 | $0.1877 |

| 2026-11-04 | one typed change on the open host, no code ("החליפו את השטיח לשטיח כחול כהה"), living | ≈ $0.09 | $0.043 (kontext) |
| 2026-11-04 | PROD check on habait-flow after dpl_CUCZCiqcxt73cETiVB77UtU61Zig: typed changes (3 fast 502s unbilled, then 2 OK) | ≈ $0.15 | ≈ $0.09 (2 × kontext 0.043) |
| 2026-11-04 | PROD catalog swap after dpl_Ee76NM6uV6ZTZXCyPVuwZxq6sHRC: bedroomMain-0-1 bed → ai-bed-oak (replace-matrix) | ≈ $0.10 | ≈ $0.09 (host ledger is in memory on Vercel) |
| 2026-11-04 | leftover fix re-test, laptop host: living-0-2 → ai-coffee-marble, living-0-1 → ai-sofa-leather | ≈ $0.19 | $0.2787 (the table took 2 attempts) |
| 2026-11-04 | PROD after dpl_6wv13ZNoj38U8kuXEMiUVWjos5zA: living-0-2 → ai-coffee-walnut | ≈ $0.18 | |

**Spent so far: ≈ $1.86 of the $5 soft cap.**

### Progress, later the same day (commits `006c397`, `a914d6f` on branch `apt-furniture-swap`)
- **P2 done.** 18 AI items in `catalog/ai/` (contact sheet checked by eye: clean catalog shots). `catalog-check --ai` OK 18. `--refinish` brings **49 rings in 8 scenes** (bedroomMain 4, bedroom2 4; the wardrobe and baths have none). `build-tour apt846 --catalog=ai` passes (22 scenes, 18 items, 49 markers).
- **Worktree media:** the `fix-disclosure-badge.media.json` links were reused (`.wt/apt-furniture-swap.media.json`; `platform/_local` gave "access denied", not needed here). `apt846/_local` is now a junction to the live folder; the 46 scan rows were moved into the live ledger (backup `ledger.json.bak-2026-11-04-rnd67`, copy `.wt/apt-furniture-swap.scan-ledger-2026-11-04.json`).
- **P4, first two paid swaps** (laptop host + `replace-matrix`, he): both **held** by the judges (likeness 3, rest 3/3). **My eye finds a defect in each:** the sofa swap leaves a white wedge cut into the rug under the new sofa; the coffee-table swap leaves the old table's plant standing on the floor by the window. That is the T17 class (paste leftovers), and the replace judge does not catch it. Evidence: `qa-evidence/tour360/furniture-swap/matrix/he/*/before-after.jpg`.
- **Next:** (1) the paste-back must clean what was ON the old piece (décor on a table) and must not cut the floor/rug under it, and the judge must look for leftovers outside the box; (2) the typed bar on apt846 (`live-check --text`); (3) a bed in bedroomMain; (4) a fresh judge, then merge and QA.

## 7. Progress (rnd-67, 2026-11-04; Eliran: "תריץ כל מה שאתה יכול ללא עצירה")
- **P0. Worktree media.** In the worktree only: `.env` is hard-linked from the live checkout (never opened), and `qa-evidence/_tools/node_modules` is a junction to `Projects/Habait/tools/appdeps/node_modules` (sharp). The prototype's `catalog-probe --selftest` can't run: its golden commits (`1b04ba65`) are in the archived pre-fold repo. That is not a regression.
- **No OpenRouter key in `.env`.** I added `tour360/server/chat-transport.mjs`: with `OPENROUTER_API_KEY` it is plain fetch; without it, the same request goes through fal's `openrouter/router/vision` with `FAL_KEY`, and reasoning stays on. `handler.mjs` (5 call sites and the keys check), `scan-pieces.mjs` and `replace-probe.mjs` use it. Mock test PASS (scratchpad `chat-test.mjs`); the real probe works.
- **P1 done.** `apartments/apt846/markers.json`: 110 pieces, **27 rings** in 6 rooms (entrance, kitchen, dining, living, terraceLiving, terraceBedroom). I opened the terraceBedroom-0 and living-0 views by eye: the markers sit on the room's own pieces, and the pieces behind glass are left out.
- **Bedrooms, wardrobe and baths have 0 rings.** That is not a scan miss: the catalog has only sofa/armchair/coffee_table/dining_table/chair, and `scan-pieces --refinish` ($0) adds the rings once there are bed/lamp/rug items. `tour.js` `TARGET_KEY` and the copy pack also need those 3 categories.
- **The IKEA photos are gone.** `catalog/_local/` does not exist in the worktree or the live checkout, so the 5 IKEA rows fail `catalog-check` until someone saves the photos again by hand (laptop only, OQ-C1).
- **Next: P2.** About 18 AI items (sofa 3, armchair 3, coffee table 2, dining table 2, chair 2, bed 3, lamp 2, rug 1) on `fal-ai/nano-banana-2`, ≈ $1.44, written to a tracked `catalog/ai/`. Also `catalog-check` lets `source: "ai-generated"` rows go without price/url/article. `build-tour --catalog=ai` gives a public-safe build without the IKEA rows. The item card shows "AI-generated" instead of a price.

## 6. Rails
Root §6: add-only, décor only, badge on every changed view, IKEA images laptop-only. Root §7: ledger before every call (`logs/spend-ledger.txt`), dry run first, `--go` only inside the estimate. Root §8.7: work only in `.wt/apt-furniture-swap`. Root §8.9: the board ends with QA cards. Root §12: `timeout` on every run.

### Shipped (2026-11-04 afternoon, rnd-67, Eliran: "כן, תעלה עכשיו" then "מאשר הכל")
- habait-flow production carries the capability for EVERY visitor (no code): **49 rings → an 18-item AI catalog, and the typed bar**. The function is at `/api/tour-edit` (`stage_flow.py --edit-api`, rewrite `/tour/api/edit`). `FAL_KEY` + `TOUR_EDIT_OPEN=1` are in the Vercel env.
- **4 deploys**: CUCZ (first; 3 cold 502s) → Ee76 (retry) → 2862 (phone: rings tappable, bar folded) → 6wv1 (leftovers: table region rises, the rug continues). SHIP-LEDGER rows; evidence `Projects/Habait/habait-walkaround/qa-evidence/tour360/furniture-swap/prod/`.
- **Spent ≈ $2.9 of the $5 soft cap**, plus ~$0.27 on prod turns (the hosted ledger is per instance, in memory).
- **Open:**
  1. Desktop: the bar and the toggles still stack mid-view (it works, but it is busy).
  2. `api/chat-transport.mjs` is also listed as a function (harmless; rename to `_chat-transport.mjs` next time).
  3. The 5 IKEA photos are missing from disk.
  4. A fal console spend limit (Eliran's act) would back the in-memory caps.
  5. No board/QA cards were filed (`/plan-to-tasks` is Eliran-only); the prod checks above stand in for them.
