# Board — hold-building-tour
<!-- created: 2026-11-04 · plan: development/plans/2026-11-04-hold-building-tour.md · coordinator: main session rnd-1f · owner: Eliran Shopen -->

**Goal:** a "הדמיית הבניין והסביבה" button on the hold (`/hold/`, after the clip) opens the tour's exterior chain (aerial → orbit1…5 → tower → descent → facade) as an overlay at the same URL, continuing into the apartment; ✕ / Esc back to the hold. `/tour/` unchanged. $0, no deploy.
**State:** `EXECUTING` (copied back; deploy go given) (Eliran: "כן", 2026-11-04).

## Key state
- Files changed: `Projects/Habait/research/fal-bench-2026-11-02/flyover3d/index.html`, `app.js` only. `tour.js` is in another session's open `.wt/tour-exterior-floors` (hides the floor buttons on exterior scenes) — not touched here.
- WIP at filing: 0 boards EXECUTING/IN-PROGRESS/LIVE in `development/tasks/CLAUDE.md` (all rows CLOSED/SHIPPED).
- Project agents (`platform-dev`, `qa-reviewer`) live in `Projects/Habait/.claude/agents/` and are not in this session's registry: build cards run in the main session in the platform-dev role (as boards apartment-3d / transition-rise did); reviewer cards are fresh general-purpose Sonnet spawns carrying the qa-reviewer definition.

- 09:4x card 01: `.wt/hold-building-tour` opened (index.html eb913224…, app.js def31396…); test build `stage_flow.py` → scratchpad `hb-run`, served :8853; `logs/rebuild-run.py` = stage_flow's URL rewrite, byte-equal to its output (a5f42a3e… / 4e5c4184…). `qa_chain.cjs` is stale (waits for `a.project-card`, gone since the platform redesign) → the check starts from `#heroCta`.
- card 02/03: button + overlay + ✕ + Esc + descent guard; `logs/check-building.cjs` **80/80** on desktop, iPhone 13, Pixel 7, tablet 820 (`logs/check-all.txt`, `logs/shots/`). Found on the way and fixed: ✕ over the tour's FR button (desktop) → top-centre; over the guide button (phones) → row below on < 900 px; button tappable during the descent ease (tablet) → `building.leaving`. Decisions: `logs/decisions.md`.
- card 04 gate (fresh Sonnet, `logs/gate-report.md`): **FAIL D1** — ✕ within ~600 ms of opening left the ambience paused at volume 0 with the icon on (the open's fade kept running). Card 02 reopened in the same folder: `fadeGen` cancels a running fade on close. Gate probe Q1 now PASS (`gate-probes/probe2.after-fix.txt`); Check 79/80 once (tablet C3: auto chain at orbit4 at 60 s, software GL) → tablet re-run twice 20/20. Re-gate (fresh Sonnet, `logs/regate-report.md`): **PASS**, 0 defects (close at 0–1500 ms, fast cycles, mute kept, descent fade intact); tablet C3 timing again (orbit5 at 60 s, rerun 20/20) → C3 wait raised to 90 s.
- card 05 (Eliran: "כן תעלה לאוויר" = copy back + deploy go): `wt.py close --go` 10:5x, 2 files, live == approved (cmp). Stage from live `scratchpad/deploy-hbt-1` (367.0 MB); vs prod stage deploy-prod-6 (rnd-23's OWED-024 deploy dpl_D4nm8a…, Eliran's go) = exactly hold/app.js + hold/index.html. rnd-fd (deploy-prod-5, tour-exterior-floors) and rnd-23 confirmed: nothing else pending, one deploy from this stage. Card 06 running on it.

## Cards (execution order)
| # | File | Card | Agent · model · tier | State |
|---|---|---|---|---|
| 01 | `task-01-open.md` | Open the working folder + a test build on the live baseline | main session · opus · T0 | DONE |
| 02 | `task-02-button-overlay.md` | The button, the overlay and the way back | main session · opus · T0 | DONE |
| 03 | `task-03-checks.md` | Acceptance check + regression | main session · opus · T0 | DONE — 80/80 |
| 04 | `task-04-gate.md` | Gate: fresh reviewer, refute | fresh Sonnet sub-agent · sonnet · T0 | DONE — FAIL D1 → fixed → re-gate PASS |
| 05 | `task-05-copy-back.md` | Copy back on Eliran's word | main session · opus · T1 | DONE — copied back |
| 06 | `task-06-qa-live.md` | QA on the live files | fresh Sonnet sub-agent · sonnet · T0 | TODO |
| 07 | `task-07-qa-deployed.md` | QA on the deployed site | `habait-deploy-qa` (live, habait) · sonnet · T0 | BLOCKED (deploy go) |

## Waves
Sequential, one worker at a time (≤ 5 per burst never reached). One session.

## Gates
- Card 04 — fresh reviewer, refute (Check + Reviewer scope in the card).
- **Final QA:** card 06 (live files) and card 07 (deployed site, `BLOCKED` until Eliran's own deploy go). The board is CLOSED only when the last QA card passes.

## Standing rails
1. **Bounded read-first:** `memory/HOT.md`, then the LAST ~150 lines of your own `memory/agents/<name>.md` (plus its archive-index block), then `memory/listings/<id>.md` only if the task names a listing. ⛔ Never read `memory/INDEX.md` whole — grep it.
2. **Write last, once:** ONE entry (`memory/_TEMPLATE.md`) into the layer that owns the fact, plus ONE ≤400-char pointer line under that layer's existing `memory/INDEX.md` header. ⛔ Never add a header.
3. **Second reader:** at write time, name which OTHER actor must know this; append ONE pointer line into each named actor's `memory/agents/<name>.md` — `→ see <entry> — why it binds you`. No affected actor = say "none".
4. **An action is not done until its memory is written.**
5. **Ruling tier** — every brief carries its own `T0` / `T1` / `T2` (below).
6. Root `CLAUDE.md` §2, §8.7, §12: no git; work only in `C:\RnD\.wt\hold-building-tour\files\`; `timeout` on every run, one heavy run at a time, foreground; local test port **8853** only; never open a `.env`; **no paid call ($0)**; **no deploy** (Eliran's own go, §9); `PYTHONIOENCODING=utf-8`.
7. ⛔ Do not edit `habait-walkaround/Habait/tour360/viewer/tour.js` or `dist/apt846/index.html`: they are in another session's open working folder `.wt/tour-exterior-floors`. A gap in the tour is reported to the main session, never patched here.

Full contract: `memory/README.md` and root `CLAUDE.md` §0.
