# How to run this board
<!-- created: 2026-11-03 -->

1. Read `README.md` here, then the plan. Update **Key state** before each burst, and write the resume point last.
2. **Burst 1:** card 01, Eliran's calls in one AskUserQuestion. Nothing runs before (a).
3. **Burst 2:** card 02, the main session (`wt.py add`, dry run first).
4. **Bursts 3–7 (session 1):** 03 ∥ 04 → 05 → 06 → 07 → 08. Card 08 runs only with the install go from card 01 (c).
   - If the session started at `C:\RnD\Projects\Habait`, spawn `platform-dev` (opus) with the card.
   - Otherwise the main session runs it.
   - After each card, regenerate `CHANGES.md` and kill every server started (:8852, :8853) by PID.
5. **Session break.** Write the resume point "card 09" in Key state. Session 2 starts when `python scripts/wt.py status apartment-3d` shows it closed, or on card 01 (b) = release.
6. **Bursts 8–10:** 09 → 10 → 11.
7. **Burst 11:** card 12. Spawn a FRESH Sonnet reviewer, prompted to refute, with `qa-reviewer.md`'s charter and boundary. Then Eliran picks the theme. No buyer-page card starts before he does.
8. **Bursts 12–14:** 13 → (14 ∥ 15) → 16.
9. **Burst 15:** card 17 (fresh Sonnet reviewer). Then Eliran checks the legal-summary display.
10. **Bursts 16–17:** card 18 (fresh Sonnet reviewer), then card 19 (`habait-ux-judge`, spawned from any session; a harness agent).
11. **Burst 18:** card 20, only on Eliran's "good". Deploy is a separate go.
12. **Burst 19:** card 21, the QA on the live repo (fresh Sonnet reviewer). On PASS, close the board's records.
13. **Burst 20:** card 22 (`habait-deploy-qa`), only after a deploy that Eliran authorised on his own. Never ask for the deploy from this card.

## Post-task checklist (every card)
- The card's State cell in the README is updated with the time and the evidence path.
- `CHANGES.md` in the working folder lists every file the card changed or created. Every new file was added with `wt.py add` the moment it was created.
- Nothing live changed: `python scripts/wt.py status platform-ui-ux` shows 0 drift (until card 20).
- Every heavy command ran under `timeout`, one at a time; every server and browser started was killed by PID; no process is left on :8852 or :8853.
- $0 spent; no `.env*` opened.
- The memory entry exists, and its INDEX line is appended.
