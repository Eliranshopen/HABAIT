# Task 05 — the secrets ledger rows
**Agent:** `secrets-steward` (status live, track harness-ops; no Bash by construction) · **Model:** sonnet · **Ruling tier:** T0 · **Burst:** 3 · **Depends on:** 03
**Memory file:** `memory/agents/secrets-steward.md`

## What to do
Add two rows to `docs/governance/SECRETS-LEDGER.md` §1, names only: `FAL_KEY` and `MYARCHITECTAI_API_KEY`. Columns: lives in `C:\RnD\Projects\Habait\habait-walkaround\.env` (copied 2026-11-03 from `C:\Habait\habait-walkaround\.env`, which still holds the same values until cut-over); exposure event: none known (the names were read from the file by a `sed` that masks values; no value entered any transcript); rotation state: not rotated; probe: task 07's smoke that calls fal with `--dry-run` only. Add a §3 note: two copies of the same `.env` exist until cut-over (task 09) — a rotation must update both, or the source must be archived first.
⛔ Never open `.env` or any env backup; the names come from task 01's inventory.

## Files
- edits: `docs/governance/SECRETS-LEDGER.md`

## Acceptance
Two rows present with every column filled, no value anywhere in the diff; the §3 note present.

## Standing rails (inherited verbatim from the board README — root `CLAUDE.md` §0)
1. **Bounded read-first:** `memory/HOT.md`, then the LAST ~150 lines of your own `memory/agents/<name>.md` (plus its archive-index block). ⛔ Never read `memory/INDEX.md` whole — grep it.
2. **Write last, once:** ONE entry (`memory/_TEMPLATE.md`) into the layer that owns the fact, plus ONE ≤ 400-char pointer line under that layer's existing `memory/INDEX.md` header. ⛔ Never add a header.
3. **Second reader:** name which OTHER actor must know this; append ONE pointer line into their `memory/agents/<name>.md`, or say "none".
4. **An action is not done until its memory is written.**
5. ⛔ **The source `C:\Habait` is read-only to every task on this board.** Nothing is edited, moved or deleted there. Every write goes to `C:\RnD\Projects\Habait` or to this board folder.
6. ⚠ **Machine resource rules** (root `CLAUDE.md` §12): every heavy command under `timeout N`, one at a time, foreground; robocopy runs from PowerShell or `cmd //c`, never bare in Git Bash (it rewrites `/E`-style flags into paths).
