# docs/governance/ — the live registers
<!-- last-updated: 2026-11-04 -->

## What's here
Four append-only registers. A register row is a dated fact with its evidence path; it is never permission to act (root `CLAUDE.md` §8.5). `README.md` §4 holds the house rules for editing one.

## Key files
| File | Holds | Kept by | Empty today? |
|---|---|---|---|
| `README.md` | the register list and the §4 editing rules | main session | — |
| `SECRETS-LEDGER.md` | one row per credential NAME — never a value; §2 why env backups are a secrets question | `secrets-steward` (no Bash by construction) | 2 rows (names only: `FAL_KEY`, `MYARCHITECTAI_API_KEY`) |
| `WORKTREES.md` | the git-worktree rules and the last generated inventory — **frozen** until re-pointed to `C:\RnD`'s git worktrees (one repo since 2026-11-04) (Eliran 2026-11-04: features in `.wt\<feature>` worktrees); kept as history | `workspace-steward` | frozen |
| `worktrees.json` | the hand-kept half of the git-worktree inventory — **frozen** until Check 16 is re-pointed to `C:\RnD`'s git worktrees | — | frozen |
| `SHIP-LEDGER.md` | one row per production deploy: Vercel deployment, staged-from, live-verified evidence, rollback, Eliran's quoted go — **live again 2026-11-04** | `habait-deploy-qa` / main session after each deploy | yes |
| `OWED.md` | every open debt: id, owner, what resolves it — OWED-001 onward; the summary line under its title is the current state | main session | see `OWED.md` |

## Conventions / gotchas
- Ids continue from the highest on disk; ⛔ never reuse one. A wrong row is struck with a dated note, never deleted.
- Files the old harness kept here and that were **not** transferred: `RETENTION.md`, `MCP-REGISTRY.md`, `key-rotation-runbook-2026-08.md`, `versions.json`, `VERSIONS.md`, `PRUNE-PASTE-*.md`. Skills that read them report SKIP.
- Secrets: names only, in every register, always.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Root §8: [../../CLAUDE.md](../../CLAUDE.md)
