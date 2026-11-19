
## 2026-11-18 · main session · Eliran: each tier of the engine's tests runs ONCE per gate; after a merge the live home gets the readiness command only
- **Did:** During the gate of milestone 1.3 Eliran asked whether things in the process are not critical and slow it down. He was shown four: the tests run three times in a row and again in the live home; a fresh QA reviewer per milestone; the whole sync-context pass per milestone; eight task cards per milestone. In the session's question dialog he chose ONE: «בדיקות פעם אחת». The other three stay as they are. Written into step 3 of development/tasks/3dengine/run-tasks.md.
- **Evidence:** `development/tasks/3dengine/logs/1.3/gate-summary.txt` · `development/tasks/3dengine/run-tasks.md`
- **Learned:** Three runs in a row and the rerun of everything in the live home were the main session's own habit, not a rule of his. That day five full runs and three cut ones of npm test cost about 35 minutes on a machine other sessions held at 100 %. A run is repeated only when it failed or was cut, and the gate summary says so.
- **Owed / open:** Nothing. QA per milestone, sync-context per milestone and plan-to-tasks per milestone were offered and NOT chosen: they are not to be trimmed.
- **Second reader:** `qa-reviewer`
