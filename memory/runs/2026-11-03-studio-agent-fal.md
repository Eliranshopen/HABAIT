
## 2026-11-03 · main session (rnd-23) · plan studio-agent-fal DONE (agent chat + fal intake)
- **Did:** The Studio reads the developer's files through a fal model (openrouter/router/vision, anthropic/claude-sonnet-5.5) and has a grounded agent chat per project. Live paid check: intake $0.13 (10 rooms, confidence 0.85) + two chat answers $0.035; night total $0.17 of a $1 budget. A refute review found 2 money gaps (other callers could hit fal ungated; a chat cap race) — fixed and tested. Copied back; live tests 14/14 + 9/9; Vercel preview 2 from live.
- **Evidence:** `development/tasks/studio-agent-fal/logs/spend-ledger.txt`
- **Learned:** On fal openrouter/router/vision the Claude 5.x models refuse reasoning:false (HTTP 400) — send reasoning:true; the output stays the answer alone. A paid backend made the default must be opt-in per caller, or every older caller silently starts spending.
- **Owed / open:** FAL_KEY is still burned (OWED-013) — rotation is Eliran's; the agent chat is local-only (Studio not public)
- **Second reader:** none
