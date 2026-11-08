# development/tasks/ — the boards
<!-- last-updated: 2026-11-04 -->

## What's here
One folder per board: `README.md` (the card table and execution order), `task-NN-<slug>.md` (one agent, one domain, acceptance criteria), `run-tasks.md` (how to run it), `logs/` (evidence). Boards are written by `/plan-to-tasks` from a plan in `development/plans/`. Per-board folders carry a generated `CLAUDE.md` (root §8.6) whose Purpose line points at the board's `README.md`; this card explains the convention.

## The board table (the one WIP authority — `/plan-to-tasks` Step 10 counts rows here, never folders)
| Board | Filed | State | Plan | Gate |
|---|---|---|---|---|
| `copy-habait-2026-11-03/` | 2026-11-03 | CLOSED (cut-over done 2026-11-03) | `development/plans/2026-11-03-copy-habait-to-projects.md` | task 04 (five checks) |
| `apartment-3d/` | 2026-11-03 | CLOSED 2026-11-03 ~19:40 (27 files copied back on Eliran's "good"; `.wt/apartment-3d` removal = Eliran's act; in production since 2026-11-04, staged from live) | `development/plans/2026-11-03-apartment-3d-ux.md` | tasks 06 and 09 (fresh reviewer) |
| `dollhouse-in-tour/` | 2026-11-03 | CLOSED 2026-11-03 23:25 (3D button in the tour, live check 48/48; in production since 2026-11-04, staged from live; option-3 spike done) | `development/plans/2026-11-03-dollhouse-in-tour.md` | tasks 05 (fresh reviewer, re-gate) |
| `platform-ui-ux/` | 2026-11-03 | CLOSED 2026-11-04 (shipped, QA 22 PASS) — prod habait-flow dpl_HprzbAudnPdUCLididJWbhB9Cm8X on Eliran's go; QA 22 round 1 FAIL (black cine stage) → landing fallback + cine clips staged → round 2 PASS · closed 2026-11-03 23:40 | `development/plans/2026-11-03-platform-ui-ux.md` | tasks 12, 17, 18 (fresh Sonnet), 19 (`habait-ux-judge`); final QA 21 (live) and 22 (deployed) |
| `transition-rise/` | 2026-11-04 | CLOSED 2026-11-04 ~08:20 (option 3: the 3D rises out of the 360, "צפו ב-360°" dives back; live check 36/0; DEPLOYED 2026-11-04 on Eliran's go with platform-ui-ux, dpl_HprzbAudnPdUCLididJWbhB9Cm8X) | `development/plans/2026-11-04-transition-rise.md` | task 05 (fresh Sonnet gate FAIL D1 → re-gate PASS) |
| `tour-exterior-floors/` | 2026-11-04 | CLOSED 2026-11-04 (no floor-finish buttons on the tour's building/surroundings scenes; live QA PASS; DEPLOYED to habait-flow on Eliran's go, prod QA PASS) | `development/plans/2026-11-04-tour-exterior-floors.md` | task 04 (fresh Sonnet, live result) |
| `hold-building-tour/` | 2026-11-04 | CLOSED 2026-11-04 ~11:15 (shipped; button "הדמיית הבניין והסביבה" on /hold/ → tour exterior overlay, one URL; prod dpl_3avVrzv8…, QA 06 + 07 PASS) | `development/plans/2026-11-04-hold-building-tour.md` | task 04 (gate) · final QA 06 (live) + 07 (deployed, BLOCKED deploy go) |
| `exterior-film/` | 2026-11-04 | EXECUTING (Eliran delegated the calls: A film ≤ $10, B splat spike ≤ $15; the button's 360 stills chain is replaced by a ≥1080p realistic film) | `development/plans/2026-11-04-exterior-realistic-video-3d.md` | A4 (fresh reviewer) · final QA A6 (live) + A7 (deployed, BLOCKED deploy go) |

State vocabulary: `PLANNED` · `EXECUTING` · `IN-PROGRESS` · `LIVE` · `BLOCKED` · `SHIPPED` · `CLOSED` · `ABANDONED`. At 3 boards EXECUTING/IN-PROGRESS/LIVE, stop and ask Eliran which closes first. `SHIPPED` = deployed while a QA card is still open; once the last QA card passes the board is `CLOSED` (the cell says it shipped).
**One state source** (plan `development/plans/2026-11-04-workflow-cleanup.md`): the board README's `**State:** \`WORD\`` line is the truth; the State cell here starts with the same word. `python scripts/board_state.py` checks both tables against the READMEs and lists boards with no row (dry-run; `--go` rewrites only a leading state word, never adds a row).

## Conventions / gotchas
- Board folders are committed to local git on `main` at filing (`/plan-to-tasks` Step 12, identity set 2026-11-04; no remote). A board that changes a project runs in its own working folder `C:\RnD\.wt\<board-slug>` (root §8.7); a harness board does not.
- Every card inherits the standing rails verbatim from its README; a brief without them is outside the memory contract.
- `/close-board` closes a board; it writes the `memory/runs/` entry and the lessons.
- **Every board ends with QA cards** (Eliran, 2026-11-03, root §8.9): after the build or copy-back, nothing but QA. The board is CLOSED only when its last QA card passes.

## Rule §8.9 — the QA cards
(Moved from root `CLAUDE.md` on 2026-11-04, wording unchanged.)
   - **QA on the result where it now lives:** after a copy-back, the live files (hashes equal the approved copies, nothing out of scope changed, the tests and the live preview run); for a board with no working folder, the finished artifact itself.
   - **QA on the deployed site** when the board's work reaches a deploy: `habait-deploy-qa`, the headless-Chrome paint proof on every alias. The card is `BLOCKED` until Eliran gives his own deploy go (§9); it never asks for one.
   - Every QA card has a runnable `Check:` and a narrow `Reviewer scope:`. The reviewer is fresh, never an author of the work, and prompted to refute. A FAIL reopens the authoring card in the same working folder (§8.7), never a sibling.
   - The board is `CLOSED` only when its last QA card passes; the close records (run entry, HOT, board row) are written then. Procedure: `/plan-to-tasks` Step 16.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Plans: [../plans/CLAUDE.md](../plans/CLAUDE.md)
