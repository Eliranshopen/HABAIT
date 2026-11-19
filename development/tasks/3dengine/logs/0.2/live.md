# Milestone 0.2 · task 08 — one real conversation through Pi's model
<!-- created: 2026-11-16 · board: development/tasks/3dengine (card 02) -->

## Ledger row (written BEFORE the run, root §7)
| Field | Value |
|---|---|
| Date | 2026-11-16 |
| What | ONE conversation in the agent's UI: a one-page PDF uploaded, one user message, one approval message sent by the card's button. The model is expected to call `inspect_plan`, `start_simulation` and, after the approval, `approve_paid_stage` |
| Who pays | Pi's own provider login (the bridge is configured for the provider `openrouter`, model `moonshotai/kimi-k2.7-code`). The session never reads that login |
| Approved by | Eliran: «מאשר», 2026-11-16, in answer to "approve a cap of $1 and I run one conversation and report" |
| Cap | $1.00 |
| Estimate | a few cents (about 4–6 model turns, a system text of about 8,000 characters plus eight tool descriptions each turn) |
| What bounds the spend | the script aborts and kills everything above 20 tool calls, after 8 minutes, or at any unexpected card; one conversation, no retry |
| The engine itself | a stub: it spends nothing |
| Actual | ONE conversation, 160 seconds, 6 tool calls (about 8 model turns). The amount is not readable by the script: the chat stream and the bridge carry no token usage, and Pi keeps it in its own session file, which the session does not read. Expected: a few cents, far under the cap. The exact amount is in the provider's own activity page |

## The run (2026-11-16, `node tests/e2e/m0.2.e2e.mjs --live`, exit 0, `LIVE PASS in 160 s`)
Evidence: `live/live-report.json`, `live/1440-card.png`, `1440-quote.png`, `1440-approval.png`, `1440-done.png`, `live/bridge.log` (pairing code removed), `live-run.txt`.

- **The real setup:** the bridge from `C:\HABAIT-Agent-UI\bridge` in place, Pi 1.5.2 with the user's own configuration and provider login, the engine as registered in Pi (`C:\RnD\Projects\3Dengine`), the guard from `C:\pi-main\habait`, the app in headless Chrome at 1440×900.
- **The one user message:** «הכינו לי בבקשה הדמיה 360 מהתכנית שהעליתי, דירה 846.» — no tool was named.
- **The model's tool calls, in order:** `project_open`, `mcp__habait_engine__inspect_plan`, `mcp__habait_engine__start_simulation`, `project_record`; after the approve button's message: `mcp__habait_engine__approve_paid_stage`, `project_record`. It did not poll `get_job`.
- **What the user saw:** the job card with «שחזור הדגמה» after 50 s; the quote «הערכת עלות: $48 · טווח $40–$60 · 11 חדרים» after 74 s; after the click, the guard's card «שלב בתשלום: אישור תקציב לעבודה db4d76d9d9c2deb2» while the job file still had no approval; after «לאשר», `approval.cap_usd` = 60; 100 % and «פתחו את הסיור» after 149 s; the link answered 200 with the page «סיור 360° · דירה 846 · קומה 16 · Rainbow תל אביב (הדמיה)».
- **Honesty:** the agent told the user on its own that the engine is a stub, that the result is a replay of the existing 846 tour and not a new simulation, and that nothing is spent.
- **Brake:** not triggered (6 of 20 tool calls, 160 of 480 seconds, no unexpected card). Nothing was left running; ports 8787, 4173 and 8891 are free.
- **Side effects on the user's setup:** `app/dist` of the agent UI was rebuilt; the bridge now resumes the conversation this run opened (the earlier ones stay in the list); one job folder `db4d76d9d9c2deb2` in the engine's real `jobs/` folder (ignored by git).
