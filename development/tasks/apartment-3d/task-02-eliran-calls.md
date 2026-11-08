# Task 02 — Eliran's calls
**Agent:** main session → Eliran · **Model:** — · **Ruling tier:** T1 · **Burst:** 1, then again before cards 07 and 09 · **Depends on:** none
**Memory file:** `memory/project/` (each ruling), `memory/runs/` at close

## The calls (one question each, default stated)
| # | When | Question | Default if silent |
|---|---|---|---|
| a | before 01 | Approve the plan `development/plans/2026-11-03-apartment-3d-ux.md`? | nothing starts |
| b | during 01 | Go for `npm ci` inside `C:\RnD\.wt\apartment-3d\Habait\platform\` (three 0.170.0 from the lockfile; no copy of it is on disk; installs are his act)? | cards 03–05 are written but not built or tested |
| c | before 07 | Blender for the bake: hand Blender to rnd-23 for one local run (`habait-da` owns it in SESSIONS.md), or wait for the owner? | card 07 waits |
| d | at 09 | The disclosure wording on the 3D tab once the baked look is shown (today's legal caption stays word for word until he rules) | today's wording stays |

## What to do
Ask each call when its "When" arrives, in Hebrew, short, with the default. Record the answer in this file (date, his words) and in `memory/project/`.

## Answers
- **a + b — 2026-11-03, Eliran: "go"**, given after being told it covers starting the work (opening the work tree) and running `npm ci` inside the work tree only.
- **c — 2026-11-03, Eliran (AskUserQuestion): "rnd-23 takes it"** — one bounded local Blender bake by rnd-23, logged in SESSIONS.md.
- **d — 2026-11-03, Eliran (AskUserQuestion): "Keep today's wording"** — the legal caption stays word for word.
- **Review cadence — 2026-11-03, Eliran: "Once, at the end"** — both phases run straight through with the fresh-reviewer gates enforced; he looks once at the A/B before copy-back (card 10 still needs his "good").

## Acceptance
- Each row has his answer, quoted with a date, or "default applied".

## Standing rails (inherited verbatim from the board README — root `CLAUDE.md` §0)
1. **Bounded read-first:** `memory/HOT.md`, then the LAST ~150 lines of your own `memory/agents/<name>.md` (plus its archive-index block). ⛔ Never read `memory/INDEX.md` whole — grep it.
2. **Write last, once:** ONE entry (`memory/_TEMPLATE.md`) into the layer that owns the fact, plus ONE ≤ 400-char pointer line under that layer's existing `memory/INDEX.md` header. ⛔ Never add a header.
3. **Second reader:** name which OTHER actor must know this; append ONE pointer line into their `memory/agents/<name>.md`, or say "none".
4. **An action is not done until its memory is written.**
5. ⛔ **The live repo `C:\RnD\Projects\Habait\habait-walkaround\` is read-only to every card until card 10.** Every write goes into `C:\RnD\.wt\apartment-3d\` (same relative paths as the repo) or into this board folder. Memory rows are the only live writes (root §8.7).
6. ⛔ **No git anywhere** (Eliran, 2026-11-03). `CHANGES.md` in the work tree is the diff.
7. ⚠ **Machine resource rules** (root `CLAUDE.md` §12): every test, build, server, browser or render runs as `timeout N <cmd>`, one heavy run at a time, foreground; kill what you start by PID. The work-tree server is `PORT=8851`. Never use :8850 (another session's port).
8. ⛔ **Blender only by its owner** (`Projects\Habait\SESSIONS.md` rule 4); no paid call on this board ($0 plan). Deploying is a separate explicit go from Eliran (root §9).
