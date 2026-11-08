# Feature worktrees: split the Habait product into three tracks, then fix it feature by feature
<!-- filed: 2026-11-04 · main session 53fed981 · state: READY for Phase 0 — all six of Eliran's calls answered (§7, §9, §10) · research: Projects/Habait/research/feature-split-2026-11-04/ (A, B, C) -->

## The ask
Eliran, 2026-11-04: "תריץ ותכין רשימה". He wants the product split along three tracks, and each track split again into sub-features:
1. A general platform for the developer (יזם). It can upload any file the developer has, and a smart model behind it (fal) generates the apartment and surroundings simulation, based on the example we already built.
2. The bird's-eye surroundings film, with one feature per frame or segment. Example: the stop in front of the building.
3. The apartment simulation, with one feature per room.

He wants every feature in its own git worktree, never on `main`.

## Evidence (read these, not this summary)
| File | What |
|---|---|
| `Projects/Habait/research/feature-split-2026-11-04/A-live-flow.md` | Live walk of https://habait-flow.vercel.app at desktop and 390 px: the screen map and **26 fixes** (1 blocker, 6 major, 14 minor, 5 polish). Shots are in `shots/`. |
| `…/B-platform-track.md` | Track 1: the chain as it runs today, 15 gaps, 8 candidate features, 9 questions for Eliran. |
| `…/C-film-and-apartment.md` | Tracks 2 and 3: the 4 film segments, the 11 rooms, which files are per-room or per-segment and which are shared, and how to avoid merge conflicts. |

## 1. What we found, in five lines
- **The buyer path** goes home → orbit clip (17 s) → the stop in front of the building (`/hold/`) → unit card → descent → apartment tour (11 rooms) → dollhouse / apartment page. The developer Studio runs **only on the laptop**; `/studio/` returns 404 on production.
- **Blocker F01 (disclosure, root §6):** in the buyer flow, one CSS rule (`ui=min` in the tour viewer) hides the "הדמיה" badge and the AI note. The same rule hides the 3D/plan buttons (F03). F02: the hold, dollhouse, flow and landing pages carry no bilingual badge.
- **The `/hold/` page is outside the product repo.** It lives in `research/fal-bench-2026-11-02/flyover3d/`, as do the active `exterior-film` board's files, so no worktree can host them today.
- **Shared files block the per-room and per-segment split.** Every segment sits in one generated file, `flow.cine.json`. Every room sits in a few files: `scenes.json`, `cameras.json`, `guide.json`, the prompts and `plan.general.json`. `build-tour.mjs` refuses to build a subset of rooms.
- **A fresh worktree has no media.** It does not get `_local/`, `dist/`, the floor-plan webp or the renders, and the `media-pull` script that `.gitignore` names does not exist.

## 2. Which repo the worktrees come from
Plan `2026-11-04-one-git-repo.md` (session rnd-a2, DRAFT; Eliran chose "1") folds the product into `C:\RnD`'s single repo. **Feature worktrees open only after that fold lands**, using `git -C C:/RnD worktree add C:/RnD/.wt/<feature> -b <feature>`. A worktree opened from `habait-walkaround\.git` before the fold would be orphaned when that `.git` is archived. If Eliran drops the fold, the same plan runs from `habait-walkaround` (baseline `35cc0f6`).

## 3. Phase 0: foundation ($0, before any feature)
| # | Step | Where | Fixes |
|---|---|---|---|
| 0.1 | **Clean `.wt`.** 11 of its 12 folders belong to boards that are CLOSED and copied back. Move them to `C:\RnD\.wt-archive-2026-11-04\`; that move is Eliran's `!` command. Keep `exterior-film` until its board closes. | harness | none |
| 0.2 | **`media-pull` script.** Dry-run by default; `--go` creates read-only junctions from the main checkout's `_local/`, `dist/`, floor-plan webp and render folders into a worktree, then hash-checks them. Also set `HABAIT_APP_DIR` and `HABAIT_DOTENV` (names only), so a worktree reads the one `.env` without copying it. | product `scripts/` | G15 |
| 0.3 | **First worktree = the hand-proof (root §3): `fix-disclosure`.** Restore the badge, concept line and AI note in `ui=min`, and give the 3D/plan buttons back to the buyer flow. Add the bilingual badge to hold, dollhouse, flow and landing. Check it live, merge into `main`, deploy on Eliran's go. | `tour360/viewer`, `flyover3d`, `platform` | F01, F02, F03 |
| 0.4 | **Move `/hold/` into the repo** as `Habait/hold/` (today it is `research/…/flyover3d`), and point `stage_flow.py` at it. This runs only after `exterior-film` closes, because that board edits the same files. | product | enables track 2 |

## 4. Phase 1: the shells (each merges before its track's features open)
| Feature (worktree) | What it does | Fixes |
|---|---|---|
| `apartment-shell` | Split the room files into `apartments/apt846/rooms/<id>/{camera,scene,guide,prompts}.json` plus `rooms/index.json`. The generators still write the same `scenes.json`. Add `build-tour.mjs --rooms <id>` (one room builds alone), one map of the 4 id spellings, and the viewer root that never scrolls sideways. | F22, F06 |
| `film-shell` | Add `film/sequence.json` plus one fragment per segment `film/segments/<id>.json`; `build_segments.mjs` stitches them into `flow.cine.json`. Split `path.json` per segment. Split `cine.js` into core, hold and handoff. | none (enabler) |
| `platform-spine` | One decision record (ADR): which pipeline is the spine (§7 Q3). No code until Eliran rules. | G1 |
| `shell-chrome` | Shared chrome fixes: the analytics events, the duplicated legal text, the home grid, `styleguide.html` out of production, the phone/WhatsApp number. | F15, F17, F18, F19, F20, F21 |

## 5. Phase 2: features per track
**Track 3, the apartment.** One feature per room: `apt-room-<id>` × 11. Each owns only its own room paths: `panos/*/<NN-room>.webp`, `depth`, `guide/he/<NN-room>.*`, `cp-<room>/` and its shard. Their fixes:
- `apt-room-terrace-living`: F05 (the landing view faces a wall, so set the landing yaw) and F16 (the embed on the apartment page).
- `apt-room-kitchen`, `apt-room-bath-guest`: F23 ("כניסה אל כניסה").
- Cross-room features: `apt-dollhouse` (F24, the terraces render as a blob; fit to a phone), `apt-floor-finishes`.
- Pairs Eliran may want as one worktree: bedroom-main + wardrobe + bath-main; living + terrace-living.

**Track 2, the film.**
- `film-seg-orbit`
- `film-seg-stop-facade`, the stop in front of the building: F04 (stacking at 390 px), F07 (pill overlap), F08 (bidi), F09 (sound over the drawer), F10 ("טיוטה" in the title).
- `film-seg-descend`: F05, the side of the clip that has to match the landing.
- `film-seg-enter-handoff`
- `film-exterior-stops`, the 11 panoramas of "הדמיית הבניין והסביבה": F11 (next after the last stop), F12 ("סיבוב · 1" is missing), F13 (curved horizon, crossfade), F14 (toast over the title).
- `film-building-video`: the exterior-film board, folded in after it closes.

Rule: a change to the living-room pano re-runs the enter-handoff registration.

**Track 1, the platform.**
- Start now, at $0: `intake-router` (any file in, classified and read) and `project-spec` (facts → `project.json` → platform fixtures for a new project).
- Then, in parallel: `site-surroundings` (the contract with track 2) and `plan-to-geometry` (the human gate).
- Then: `jobs-and-spend`, then `skin-backend` (paid, ledgered), then `publish-generic`.
- Also: F26 (the Studio lists `CLAUDE.md` as a developer file) and F25 (where the Studio lives, §7 Q5).

## 6. How every feature runs (the worktree cycle)
1. `git worktree add C:/RnD/.wt/<feature> -b <feature>` (from the repo in §2), then `media-pull --go`, then `npm ci` where needed.
2. Work and commit on the branch, path-limited (never `git add -A`). Every paid call is ledgered first (root §7).
3. Run the feature's own check: a $0 test, a headless-Chrome paint proof, and a 390 px shot.
4. `git merge --no-ff <feature>` into `main`, then the live QA card, then deployed QA after Eliran's own go (root §8.9). Removing the worktree is Eliran's act.

**Parallelism.** At most 5 worktrees open at once (root §10.2). Shells first. Room and segment features can run in parallel, because each one touches only its own paths.

**Boards.** Each phase becomes a board via `/plan-to-tasks`, with QA cards at the end.

## 7. Eliran's calls (needed before or during Phase 0/1)
1. **F01/F02, disclosure:** restore the existing badge "הדמיה · AI-generated" everywhere in the buyer flow. Recommended: yes, with today's wording.
2. **F20, contact number:** the real sales number, or hide the buttons until one is set.
3. **Spine (track 1):** the Studio as the developer's UI, with engine stages as the runner (recommended); or the Studio alone; or the engine alone.
4. **Move `/hold/` into the repo** after `exterior-film` closes. Recommended: yes.
5. **Archive the 11 closed `.wt` folders.** Recommended: yes, as a move, not a delete.
6. **Granularity:** 11 room worktrees, or about 8 with the pairs in §5.
7. **Later, track 1:** which file types are the promise (DWG needs an ODA install), hosting (laptop or a hosted portal), and the cost per project (apt846 alone was $129.74).

### Eliran's answers (2026-11-04)
1. Disclosure: **"כן"** — restore "הדמיה · AI-generated" everywhere in the buyer flow, existing wording (F01/F02/F03 → worktree `fix-disclosure`).
2. Contact number: **"להסתיר"** — hide the WhatsApp/phone buttons until a real number is set (F20, in `fix-disclosure` or `shell-chrome`).
3. Spine: Eliran set the goal and delegated the call ("תחשוב … ותקבל החלטה") → decided, §9.
4. Move `/hold/` into the repo: **"תעשה מה שאתה חושב"** → yes, after `exterior-film` closes (step 0.4).
5. Archive closed `.wt` folders: **"תעשה מה שאתה חושב"** → done 2026-11-04: 12 closed folders moved to `C:\RnD\.wt-archive-2026-11-04\` (not deleted); only `exterior-film` stays (step 0.1 DONE).
6. Room granularity: **one worktree per room, with clear names** → §10.

### Repo (update)
The one-git-repo fold has landed: `git -C Projects/Habait/habait-walkaround worktree list` now reports `C:/RnD [main]`, so feature worktrees open from `C:\RnD` (§2).

## 8. Order at a glance
1. one-git-repo fold (rnd-a2)
2. 0.1 clean `.wt`
3. 0.2 `media-pull`
4. 0.3 `fix-disclosure` (the hand-proof, then deploy on his go)
5. Phase 1 shells: `apartment-shell` ∥ `film-shell` ∥ `shell-chrome`, with `platform-spine` as a decision only
6. 0.4 move `/hold/` (after `exterior-film`)
7. Phase 2, at most 5 in parallel: rooms, segments, then track-1 features

Cost of Phases 0–1: $0.

## 9. Decision: the platform's spine (Q3, delegated by Eliran 2026-11-04)
Eliran: "הפלטפורמה המטרה שלה בסוף היא שיהיה בה מקום להעלאת הקבצים של היזם והAI מאחורה ידע לקחת את כל הקבצים ולהפיק מהם גם את הסרטון וגם את ההדמייה של הדירה … תחשוב מה הצורה הנכונה ביותר שזה יתבצע ותקבל החלטה".

**Decision (main session, navigator-mode, root §6):**
- **One project file is the truth.** That file is the engine's `project.json` (it already has a schema, `validate_project.py` and stamps), and every stage reads and writes it. The Studio's own project format is retired once it is mapped into this file.
- **The Studio is the developer's front.** It handles upload, "what the system understood", confirmations, the spend estimate and approval, progress and results. Its fal LLM reads the files and holds the grounded chat.
- **The engine is the one runner behind it.** Its `cli.py` stage registry runs every step with gates, stamps and one ledger. The Node tools (`tour360` build, `build_segments.mjs`) are wrapped as engine stages, not copied.
- **One bridge.** The Studio starts `cli.py run <stage> --project <id>` and reads JSON progress lines; nothing else crosses between Node and Python.
- **The stages, in order:**
  1. intake: classify and read every file
  2. project facts: the developer confirms
  3. plan → geometry: the developer approves the plan
  4. site and surroundings
  5. film (track 2) ∥ apartment (track 3: render → skin → tour)
  6. QA gates
  7. preview → publish, with the deploy on Eliran's go
- **Human stops:** confirm the facts, approve the plan, approve the spend estimate, approve before publish.
- **It runs locally on the laptop first.** Blender and Python already live there. Hosting is a later call and stays Eliran's (cost and keys, §7 Q7).

**Why:** both halves already exist and work. The Studio has the UI, the fal reading and the chat; the engine has the schema, the gates, the determinism (root §2) and the Python/Blender stages. This joins them instead of writing a third pipeline. It also gives tracks 2 and 3 a single contract: each one is a stage that reads `project.json` and writes its outputs and a manifest row.

**What it is not:** cost and model choices per stage are still Eliran's (root §6/§7).

This decision becomes the first track-1 worktree, `platform-00-one-pipeline`: an ADR plus a stage-compatibility table, then the bridge.

## 10. Worktree names (Q6: one worktree per room, "שהשמות יהיו ברורים")
The branch name and the folder `C:\RnD\.wt\<name>` are the same. Names are English kebab-case (git-safe) with a number in buyer order. When a worktree opens, `git config branch.<name>.description` gets the Hebrew name, and the table in `.wt/CLAUDE.md` gets a row.

| Worktree | Hebrew | What it covers |
|---|---|---|
| `fix-disclosure-badge` | תג הדמיה + הסתרת כפתורי קשר | F01, F02, F03, F20 (hand-proof) |
| `base-apartment-shared` | בסיס הדירה | room shards, `build-tour --rooms`, id map, F22, F06 |
| `base-film-shared` | בסיס הסרטון | sequence + segment fragments, `path.json` / `cine.js` split |
| `base-site-chrome` | מעטפת האתר | F15, F17, F18, F19, F21 |
| `apt846-room-01-entrance` | כניסה | |
| `apt846-room-02-kitchen` | מטבח | F23 |
| `apt846-room-03-dining` | פינת אוכל | |
| `apt846-room-04-living-room` | סלון | re-runs the film entry registration |
| `apt846-room-05-sun-terrace` | מרפסת שמש | F05, F16 |
| `apt846-room-06-bedroom-terrace` | מרפסת · קצה החדרים | |
| `apt846-room-07-master-bedroom` | חדר שינה הורים | |
| `apt846-room-08-wardrobe` | פינת ארונות | |
| `apt846-room-09-master-bath` | חדר רחצה הורים | |
| `apt846-room-10-second-bedroom` | חדר שינה | |
| `apt846-room-11-guest-bath` | חדר רחצה כללי | F23 |
| `apt846-dollhouse` | בית בובות | F24 |
| `apt846-floor-finishes` | גימורי ריצוף | |
| `film-01-orbit` | סיבוב סביב המגדל | |
| `film-02-stop-at-facade` | העצירה מול הבניין | F04, F07, F08, F09, F10 |
| `film-03-descent-to-846` | הירידה לדירה | F05 (clip side) |
| `film-04-entry-to-living-room` | הכניסה לסלון | |
| `film-05-building-stops-360` | הדמיית הבניין והסביבה (11 תחנות) | F11, F12, F13, F14 |
| `film-06-building-video` | סרטון הבניין (exterior-film) | after that board closes |
| `platform-00-one-pipeline` | צינור אחד: Studio + engine | §9 |
| `platform-01-upload-any-file` | העלאת כל קובץ | F26 |
| `platform-02-project-facts` | נתוני הפרויקט | |
| `platform-03-plan-to-3d` | מתוכנית לתלת־ממד | |
| `platform-04-surroundings` | הסביבה | contract with film-* |
| `platform-05-jobs-and-costs` | משימות ועלויות | |
| `platform-06-interior-generation` | הדמיית פנים (fal) | paid, ledgered |
| `platform-07-publish` | פרסום | |
