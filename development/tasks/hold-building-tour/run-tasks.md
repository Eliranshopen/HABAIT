# run-tasks — hold-building-tour

1. Cards in order 01 → 07; a card starts only when its `Depends on` is DONE.
2. After every card: update its `State` and the README table; save the evidence under `logs/`; the Key state gets one line.
3. A gate or QA FAIL reopens card 02 in the SAME working folder `.wt/hold-building-tour` (`wt.py add` for any new file) — never a sibling folder.
4. Card 05 waits for Eliran's word; card 07 waits for his own deploy go and never asks for it.
5. Close (after card 06 PASS, or 07 when deployed): `memory/runs/2026-11-04-hold-building-tour.md` via `scripts/mem_entry.py`, HOT line, board row → CLOSED, plan row → CLOSED.
