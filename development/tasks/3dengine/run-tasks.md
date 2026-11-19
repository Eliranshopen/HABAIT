# How to run board 3dengine
<!-- created: 2026-11-16 -->

**Order:** card 01 → card 30, one at a time. A card starts only when the card before it is `DONE` (Eliran, 2026-11-16).

**Resume:** read `README.md` → Key state. Then `git -C C:/RnD/.wt/3dengine log --oneline -5` and `git -C C:/RnD/.wt/3dengine status --short`. The first card in the table whose State is not `DONE` is the one to work on.

**After every card (the close):**
1. `cd C:/RnD/.wt/3dengine/Projects/3Dengine && timeout 540 node --test tests/milestones/m<id>.test.mjs` — the closing test.
2. `timeout 300 npm test` — the whole suite, with the 80 % coverage bar.
3. Save both outputs in `development/tasks/3dengine/logs/<id>/`.
   - **Each tier of tests runs ONCE (Eliran, 2026-11-18, his answer «בדיקות פעם אחת»).** `npm test` once and, from milestone 1.2 on, `timeout 540 npm run test:stages` once. A run is repeated only when it failed or was cut by its limit, and the summary says so. No «three in a row». After the merge the live home gets the readiness command only (`node engine/cli.mjs doctor`), not the whole suite a second time: it is the same commit. The fresh reviewer's own gate run is also once per tier.
   - **The stage tier on a loaded machine (Eliran, 2026-11-18, his answer «ריצה אחת ארוכה ברקע»).** Read the load first (`powershell -NoProfile -Command "(Get-CimInstance Win32_Processor).LoadPercentage"`). Quiet: the foreground run under `timeout 540`. Held at 100 % by other sessions' renders (one reading then takes up to 9 minutes instead of 71 s): ONE bounded run of up to 25 minutes in the background, `timeout 1500 npm run test:stages`, and wait for the harness to say it ended (never poll). For the engine's stage tests only; root §12 stays for everything else. A cut by the limit kills the reading tool in the middle, and a test then reports a failed step: read the exit code (124) before the assertion.
4. A card with a `Reviewer scope:` line: a fresh Sonnet reviewer, prompted to refute, before the close.
5. Commit on the branch (`git -C C:/RnD/.wt/3dengine add Projects/3Dengine` and the commit; never `git add -A`), then merge `3dengine` into the local `main`. Never push.
6. A sync-context pass on the live files (the session runs it itself, on Eliran's word of 2026-11-16). **The whole pass, every time** (the first two passes skipped checks 0, 2, 3 and once the metrics; Eliran asked «אתה זכרת לעשות SYNC CONTEXT בסיום כל MILESTONE?»), from `C:\RnD`:
   - `git status` first: nothing of another session staged.
   - `python .claude/skills/sync-context/generate-cards.py --check`, then `--apply`, then `--check` again until `missing context files: 0 · stale generated: 0`; fill the Purpose line of every new generated file; refresh the hand-written context files the milestone touched.
   - `node .claude/skills/sync-context/verify-memory.mjs` until `CLEAN`, then `--strict`.
   - The auto-memory: one index line per file, every fact the disk now contradicts corrected.
   - `memory/HOT.md` rewritten by hand, at most 60 lines, the stamp on line 2 naming this pass.
   - `node .claude/skills/sync-context/check-context.mjs` (checks 1, 5–9), `python scripts/sync_checks.py` (checks 0, 2, 3), `python scripts/board_state.py` (check 18), `node .claude/skills/sync-context/metrics.mjs`.
   - Report every check line, the failing ones with whose they are. Checks 4, 10, 13–15 are skipped or retired, 16 and 17 are suspended.
7. Memory: one entry (`python scripts/mem_entry.py … --go`), HOT made true.
8. The plan: the milestone log row in §7.2, the progress line on the page, the page published again.
9. This board: the card's State → `DONE`, the README's Key state → the next card.

**A card that waits for keys or for Eliran's answer:** stop there and report. Never skip to a later card.
