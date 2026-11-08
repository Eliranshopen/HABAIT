# Inventory — C:\Habait, measured 2026-11-03 12:00–12:40 (task 01)
<!-- executed by the main session (the research pass already produced every number; workspace-steward's brief is satisfied by this file) -->

## Snapshot anchors (source, read-only)
| Anchor | Value |
|---|---|
| `habait-walkaround` HEAD | `506f63d` |
| `git status --porcelain` entries | 146 |
| tracked / untracked-not-ignored | 521 / 403 |
| `memory.md` size | 199242 bytes |
| `SESSIONS.md` last modified | 2026-11-03 11:12:07 |
| C: free space | 699.3 GB of 951.7 GB |
| junctions / symlinks in source (outside node_modules) | none (`dir /S /AL` filtered) |
| active session per `SESSIONS.md` | `habait-da` (since 2026-11-03 11:05); servers listed on :8820 :8846 :8848 :8801 :8899 :8850 :8870 :8720 |

## Sizes (du -sk, KB) and the tier
| Path | KB | Tier | Note |
|---|---|---|---|
| `habait-walkaround/` | 28,153,543 | 1 (+2 inside) | the repo; `.git` 62,073 |
| `habait-walkaround/Habait/flyover` | 15,806,194 | 1+2 | `renders` 8,600,645 (2) · `orbit` 689,243 (2) · `skins-extra` 387,345 (1, paid GPT skins) · `equirect/_local` 2,831,786 (1) · `kaggle/_local` 2,819,425 (1) · `enter/_local` 219,360 (1) |
| `habait-walkaround/Habait/studio/_local` | 8,477,586 | 1 | projects, paid stages, ledgers |
| `habait-walkaround/Habait/tour360/apartments` | 1,946,929 | 1 | `apt846/_local` 1,863,625 (paid panos, ledger) |
| `habait-walkaround/Habait/engine/_local` | 1,021,288 | 1 | |
| `habait-walkaround/360walkaround/catalog/models` | 280,636 | 2 | re-fetchable (`catalog/fetch.mjs`) |
| `habait-walkaround/360walkaround/pipeline/probe/probe-assets` | 171,040 | 2 | re-fetchable (`fetch-assets.py`) |
| `habait-walkaround/**/node_modules` (3) | 130,207 | 0 | |
| `habait-walkaround/.claude/worktrees` | 13 | 0 | |
| `tools/` | 4,212,470 | mixed | `blender-4.5.10` 930,435 (2, copied) · `ghidra_12.1.4_PUBLIC` 896,580 (0) · `habait-venv` 833,358 (0, re-created) · `deploy-vercel/qa` 790,382 (2) · `downloads/blender` 389,568 (0) · `js-sandbox/node_modules` ≈ 272,000 (0) · `rea` 41,624 (1) · `bench` 24,224 (1) · `appdeps` w/o node_modules ≈ 20 (1) · `downloads/kenney` 5,013 (1) · `scripts` 28 (1) |
| `research/` | 1,753,165 | 1 | `fal-bench-2026-11-02` 1,703,101 (its `flyover3d/data` 992,071 is the running flyover app) |
| `mix/` | 99,496 | 1 | Eliran's uploads (3 videos, 1 PDF, 2 md) |
| `development/` | 57,549 | 1 | the 33-card board + gates/qa evidence |
| `data/` | 2,188 | 1 | sales-plan corpus |
| `memory.md` · `SESSIONS.md` · `CLAUDE.md` · `.claude/` · `docs/` · `.vscode/` | 196 · 24 · 12 · 84 · 20 · 1 | 1 | |
| **whole tree** | **≈ 33 GB** | | **tier 0 ≈ 3.0 GB excluded → copy ≈ 30 GB** |

`__pycache__`: 665 dirs, 150,984 KB (tier 0). `*.pyc`: 7,101 files (tier 0). `.cache`: 2 dirs, 13,808 KB (tier 0).

## Rulings applied (task 02, 2026-11-03): Q1 copy all of tier 2 (Blender included) · Q2 copy `.env` as-is · Q4 snapshot now, re-sync at cut-over · Q5 keep the project's own `.claude` layer.
