
## 2026-11-04 · main-session · C:/Program Files/Git/sync-context pass 3 (after the platform-ui-ux ship)
- **Did:** Cards: generate-cards --apply (12 refreshed, then 3 incl. qa-deployed/ marker fix); cartographer relocated root/§0.1/§1/§8.6–8.9 detail with stubs (root 25.0→19.9 KB) and reflowed 5 cards: check-context PASS 6/6. Memory: verify-memory parser now reads mem_entry's backtick and '->' forms and skips CLAUDE.md (49 false orphans → CLEAN); HOT corrected by hand (stale deploy/.wt/count facts, garbled line 7). OWED-022 resolved (metrics.mjs runs no git). INCIDENT: a second --apply wrote 414 generated CLAUDE.md into Projects/Habait-backup-2026-11-04 while another session was copying it; owner asked, nothing deleted.
- **Evidence:** `docs/governance/OWED.md`
- **Learned:** generate-cards --apply walks every folder under C:\RnD, including a backup being copied: check for in-flight copies (new Projects/* folders) before --apply. generate-hot.mjs does not fit this harness (expects '## project/' headers and DECISIONS.md) — HOT stays hand-kept. Heredocs eat backslashes again: use Write for scripts.
- **Owed / open:** Habait-backup-2026-11-04: 414 cards written by --apply, owner's call (asked rnd-1f); generate-cards should exclude backup copies (ruling for Eliran); check 11 HOT generator mismatch
- **Second reader:** `codebase-cartographer`

## Correction 2026-11-04 (same day, main session; Eliran delegated both calls: "תחשוב ותקבל את ההחלטה הנכונה ביותר")
- The backup `Projects/Habait-backup-2026-11-04` is not rnd-1f's nor rnd-3f's; no copy process was running. rnd-1f's own --apply (~09:38) also wrote there.
- Measured (scratchpad backup_cards.py, read-only): of the backup's CLAUDE.md files, 523 carry the generator marker AND have a counterpart at the same path in the source `Projects/Habait/habait-walkaround`; 0 have none. So the runs added no foreign file: they re-generated the fact tables of context files the copy already had (Purpose/Gotchas kept). Decision: nothing removed, the backup is left as it is.
- generate-cards.py now skips dated backup/archive copies (`-(backup|archive)-YYYY-MM-DD`); root §8.6 says so. After the fix: 975 folders scanned (was 1453), 0 backup rows in docs/context-map.generated.md, 0 backup files touched by the next --apply.
