# How to run this board
<!-- created: 2026-11-03 -->

1. Read `README.md` here and the plan. Update **Key state** before each burst.
2. **Burst 1:** card 02 first (Eliran's approval), then card 01. Nothing is created before Eliran approves. Card 01's `npm ci` waits for his separate go.
3. **Bursts 2–4:** cards 03 → 04 → 05, one at a time (same files).
   - If the session started at `C:\RnD\Projects\Habait`, spawn `platform-dev` (opus) with the card.
   - Otherwise the main session runs it.
   - After each card, regenerate `CHANGES.md` and restart the :8851 server by PID.
4. **Burst 5:** card 06. Spawn a FRESH Sonnet reviewer, prompted to refute. Then send Eliran the preview link and wait for his look.
5. **Burst 6:** card 07, only after Eliran's Blender ruling (card 02). One Blender run, local, under `timeout`.
6. **Bursts 7–8:** card 08, then card 09 (fresh reviewer). Eliran rules the disclosure wording.
7. **Burst 9:** card 10, only on Eliran's "good".

## Post-task checklist (every card)
- The card's State cell in README is updated with the time and the evidence path.
- `CHANGES.md` in the work tree lists every file the card changed.
- Nothing under the live `habait-walkaround` changed: the sha256 of every manifest file still equals `sha256_at_open` (until card 10).
- Every heavy command ran under `timeout`, one at a time; every server started was killed by PID.
- The memory entry exists, and its INDEX line is appended.
