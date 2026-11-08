# secrets-steward — lessons and entries (newest last)

## 2026-11-03 · secrets-steward · burned-credential filing: FAL_KEY, MYARCHITECTAI_API_KEY
- **Did:** upgraded both ledger rows to `BURNED — ROTATION OWED` (exposure: read-only doc review sub-agent opened the live `.env`, values entered its transcript; names only). Named `C:\Habait-archive-2026-11-03\habait-walkaround\.env` as the second copy. §2 wording "worktree's" -> "working folder's". Added a §3 addendum (rotate in the live `.env` only, archive stays frozen, scrub is Eliran's call). Added §4 rotation checklist (9 steps, 4 probes owed). Added OWED-013 pointing at it.
- **Evidence:** `C:\RnD\docs\governance\SECRETS-LEDGER.md` §1, §3, §4; `C:\RnD\docs\governance\OWED.md` OWED-013. Exposure source is the main session's task statement; no transcript path exists on disk.
- **Learned:** the persona's OWED-001/002 refer to the old harness; here OWED-001/002 are git items, so a new id (013) was used. The rotation runbook was not transferred, so the ledger §4 holds the procedure for this round. No probe exists yet for MYARCHITECTAI_API_KEY.
- **Owed / open:** Eliran runs console steps; main session or `habait-deploy-qa` runs the 4 probes; Eliran approves any paid probe call. Rows stay BURNED until probe evidence is recorded.
- **Second reader:** main session — must run/route the probes and never let a value into chat; pointer: ledger §4 and OWED-013.

## 2026-11-04 · main-session → second-reader pointer
- project/2026-11-04-keys-kept.md — Eliran kept the exposed FAL_KEY + MYARCHITECTAI_API_KEY (no rotation); OWED-013 closed by ruling; ledger rows EXPOSED — KEPT → `memory/project/2026-11-04-keys-kept.md`

## 2026-11-04 · main session rnd-67 → second-reader pointer
- 2026-11-04 · rnd-67 · Eliran: furniture swap + typed bar on habait-flow for everyone (no code); FAL_KEY moved from .env by command (replaces D-T360-18) → project\2026-11-04-apt-furniture-swap.md → `memory/project/2026-11-04-apt-furniture-swap.md`

## 2026-11-05 · secrets-steward · burned-credential filing: TOUR_EDIT_CODE
- **Did:** new ledger §1 row `TOUR_EDIT_CODE` = BURNED — ROTATION OWED (fork A of rnd-9d read an old scratch-log line where the local edit server printed the code, ~20:00; transcript only). Added §5 rotation checklist (7 steps, 2 probes owed) and OWED-027 (rotation, Eliran) and OWED-028 (startup must not log the code, project code fix). Names only.
- **Evidence:** `C:\RnD\docs\governance\SECRETS-LEDGER.md` §1, §5; `C:\RnD\docs\governance\OWED.md` OWED-027/028; code path `Projects/Habait/habait-walkaround/Habait/tour360/server/handler.mjs` (`isOpen`, `codeOk`, `describe`).
- **Learned:** production habait-flow does not depend on the code while `TOUR_EDIT_OPEN=1` (`codeOk` returns true first). Whether the name is set in the habait-flow Vercel env is not recorded anywhere; the old project `habait-tour-design` also held one (PROVISION.md, T39/OWED-432). `.env.example` is blocked by the settings deny, so name manifests there were not read.
- **Owed / open:** Eliran: §5 steps 1-4; main session or `habait-deploy-qa`: 2 probes; main session: OWED-028 fix in a worktree. Rotate after the fix or accept the repeat print.
- **Second reader:** main session (rnd-9d, fork A coordinator) — must not repeat the value, and schedules OWED-028; pointer: ledger §5.
