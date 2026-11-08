# Plan — copy the Habait project from `C:\Habait` into `C:\RnD\Projects\Habait`
<!-- created: 2026-11-03 · author: main session for Eliran Shopen · status: CLOSED 2026-11-03 (executed and cut over) → board development/tasks/copy-habait-2026-11-03/ -->

## 1. The ask
Eliran (2026-11-03): copy all the files of the project at `C:\Habait` into `C:\RnD\Projects`, correctly and clean — nothing irrelevant — after research, with a plan file and a task board.

## 2. What the research found (measured 2026-11-03, 12:00–12:30)
| Fact | Value | Why it matters |
|---|---|---|
| `C:\Habait` total | **33 GB**, ~51,300 files outside `node_modules`/`.git` | a plain copy is slow and carries junk; a selective copy needs an explicit manifest |
| It is **not** a git repo | only `habait-walkaround/` inside it is (remote `Slava12233/habait-walkaround`, HEAD `506f63d`) | a `git clone` would lose everything outside the repo AND the repo's uncommitted work |
| Repo state | 521 tracked · **385 untracked · 56 modified = 146 dirty entries**; the project's own rule forbids commits without Eliran | the working tree must be copied byte-for-byte, `.git` included (62 MB) |
| Paid, irreplaceable outputs | every `_local/` folder (gitignored): `studio/_local` 8.5 GB, `tour360/apartments/apt846/_local` 1.9 GB, `engine/_local` 1.0 GB, `flyover/*/_local` 5.9 GB; ledgers `ledger*.json`; `flyover/skins-extra` 0.39 GB (GPT skins) | money bought these; they are copied, never "cleaned" |
| Compute-only artefacts | `flyover/renders` 8.6 GB, `flyover/orbit` 0.7 GB, `renders-pano`; `360walkaround/catalog/models` 0.28 GB + `probe-assets` 0.17 GB (hash-verified re-fetch scripts exist); `tools/deploy-vercel/qa` 0.79 GB of QA screenshots | rebuildable with hours of CPU or minutes of download — Eliran's call (§5 Q1) |
| Free-rebuildable junk | 9× `node_modules` 0.43 GB · 665× `__pycache__` 0.15 GB · `*.pyc` · `.cache` · `habait-walkaround/.claude/worktrees` | excluded, always |
| Tool installs | portable Blender 4.5.10 0.93 GB (relocatable) · Ghidra 0.9 GB · `habait-venv` 0.83 GB (**not relocatable**: `pyvenv.cfg` pins `C:\Habait\tools\habait-venv`) · `js-sandbox` 0.27 GB (`node_modules` only) · `downloads/blender` zip 0.39 GB | the venv is re-created, not copied; Ghidra and the zip are re-downloadable; Blender is copied (§5 Q3) |
| Secrets | one file, `habait-walkaround/.env`, two names: `FAL_KEY`, `MYARCHITECTAI_API_KEY` | copied as a file, never printed; names go to `docs/governance/SECRETS-LEDGER.md` |
| Hard-coded paths | `C:\Habait` / `/c/Habait` in `CLAUDE.md`, `memory.md`, `SESSIONS.md`, `tools/README.md`, the board, `research/.../HANDOFF.md`, env recipes (`BLENDER`, `HABAIT_APP_DIR`, `HABAIT_PY`) | the copy is re-pointed; the source is untouched |
| Live use | `SESSIONS.md` shows session `habait-da` active in `C:\Habait` today; local servers on :8820/:8846/:8848/:8850/:8870/:8899 | the copy is a **snapshot**; a re-sync pass runs at cut-over (§5 Q4) |
| Target | `C:\RnD\Projects\` exists, empty · C: has 699 GB free · `robocopy` present · no junctions or symlinks in the source | one root swap (`C:\Habait` → `C:\RnD\Projects\Habait`) makes every documented path valid |

## 3. The decision: a tiered manifest, not a blind copy
| Tier | Rule | Examples | Size |
|---|---|---|---|
| **0 — never copied** | free to rebuild, or pinned to the old path | `node_modules`, `__pycache__`, `*.pyc`, `.cache`, `.claude/worktrees`, `tools/habait-venv`, `tools/ghidra_12.1.4_PUBLIC`, `tools/downloads/blender`, `tools/js-sandbox/node_modules` | ≈ 3.0 GB |
| **1 — always copied** | irreplaceable: source, history, paid outputs, Eliran's own files | `habait-walkaround/` (with `.git`, `.env`, every `_local/`, `skins-extra`), `memory.md`, `SESSIONS.md`, `CLAUDE.md`, `.claude/`, `.vscode/`, `docs/`, `development/`, `data/`, `mix/`, `research/`, `tools/{bench,scripts,rea,README.md,downloads/kenney}`, `tools/appdeps` and `tools/deploy-vercel` without `node_modules`, `tools/js-sandbox/package*.json` | ≈ 19 GB |
| **2 — Eliran's call** | rebuildable with compute or download; large | `flyover/renders`, `flyover/renders-pano`, `flyover/orbit`, `360walkaround/catalog/models`, `360walkaround/pipeline/probe/probe-assets`, `tools/deploy-vercel/qa`, `tools/blender-4.5.10` | ≈ 11 GB |

Recommended default: **tier 2 is copied too** (disk is not the constraint; re-rendering is hours and re-fetching needs the network and the hash checks). Then the copy is "everything except tier 0" ≈ 30 GB, and "clean" means: no dependencies, no caches, no installs pinned to the old path.

## 4. Mechanism
- **Tool:** `robocopy` (Windows, in `System32`): preserves timestamps, handles long paths and Hebrew names, restarts, logs. Flags: `/E /COPY:DAT /DCOPY:DAT /XJ /R:2 /W:2 /NP /NFL /NDL /TEE /LOG+:<log>`; exclusions by `/XD` (directory names and absolute paths) and `/XF *.pyc`. Run from PowerShell or `cmd //c`. Exit code 0–3 = success (1 = files copied); ≥ 8 = failure.
- **Dry run first:** the same command with `/L` writes the would-copy list and the byte total to the log; Eliran sees the number before anything moves.
- **One command per top-level entry** (`habait-walkaround`, `tools`, `research`, `mix`, `development`, `data`, `.claude`, `.vscode`, `docs`, and the three root files), so each log is readable and a failure is local.
- **Verification is independent of the copy:** (a) a second `robocopy /L` pass must list nothing left to copy; (b) a Python walk with the same exclusion predicate must give equal file counts and bytes on both sides; (c) sha256 of 300 random files + every file ≤ 64 KB in `development/` and `docs/` must match; (d) in the copied repo: `git fsck --full` clean, `git rev-parse HEAD` = `506f63d`, `git status --porcelain | wc -l` = the source's count at snapshot time; (e) `.env` present with the same two names.
- **Re-pointing happens in the copy only:** every `C:\Habait`, `C:/Habait`, `/c/Habait` in the copied text files becomes the `C:\RnD\Projects\Habait` form, with a per-file count recorded; the venv is re-created at the new path from a `pip freeze` of the old one; Blender's env var points at the copied portable folder.
- **The source is never modified** by any task. Cut-over (renaming or archiving `C:\Habait`) is Eliran's own `!` command (root §8.2), after the re-sync pass passes verification.

## 5. Decisions Eliran rules before the copy runs (one question each, defaults stated)
| # | Question | Default |
|---|---|---|
| Q1 | Tier 2 (renders, orbit, re-fetchable assets, QA screenshots, Blender): copy all, or exclude the renders (−9.3 GB), or exclude everything rebuildable (−11 GB)? | copy all |
| Q2 | `habait-walkaround/.env` (two keys): copy the file as-is, or leave it and re-create by hand? | copy as-is, never printed, names to the ledger |
| Q3 | The portable Blender folder (0.93 GB): copy it, or re-extract later from the official zip? | copy it |
| Q4 | Cut-over: snapshot now and re-sync when you say "cut over", or wait until `C:\Habait` is idle and copy once? | snapshot now + re-sync |
| Q5 | The project's own `.claude/` (7 agents, 1 skill) and Hebrew `CLAUDE.md`/`memory.md`: keep them as the project's own layer (Habait sessions start from `C:\RnD\Projects\Habait`), or merge the agents into `C:\RnD\.claude\agents\`? | keep the project's own layer |

## 6. Phases → tasks (the board: `development/tasks/copy-habait-2026-11-03/`)
| Phase | Task | Agent | Tier |
|---|---|---|---|
| A. Inventory | 01 — exclusion manifest, counts, snapshot anchors, `pip freeze`, free space | `workspace-steward` | T0 |
| B. Rulings | 02 — the five questions above | main session → Eliran | T1 |
| C. Copy | 03 — dry run, then the real robocopy pass per entry, logs in the board | `habait-asset-wrangler` | T0 after 02 |
| D. Verify | 04 — the five independent checks; the board's gate | fresh `workspace-steward` | T0 (gate) |
| E. Secrets | 05 — ledger rows for the two names | `secrets-steward` | T0 |
| F. Re-point | 06 — path rewrite in the copy, `REPOINTED.md` | `codebase-cartographer` | T0 |
| G. Toolchain | 07 — venv re-created, Blender/Node smoke from the new root | `habait-asset-wrangler` | T0 |
| H. Harness | 08 — `Projects/` cards, root Context map, memory entries, OWED | `codebase-cartographer` + main session | T1 (Q5) |
| I. Cut-over | 09 — re-sync pass, re-verify, hand Eliran the archive command | `habait-asset-wrangler` → Eliran | T1 |

## 7. Risks and how the plan holds them
- **The source changes during the copy** (active session, running servers): robocopy copies file-by-file; a file written mid-copy is caught by the verification pass and by the re-sync at cut-over. The copy is declared a snapshot with its time.
- **Hebrew file names and long paths:** robocopy handles both; the verification walk uses Python with `os.walk` on `\\?\` paths.
- **Secrets:** one `.env`; copied as bytes, never read into a transcript; the ledger holds names only.
- **Losing uncommitted work:** nothing is cloned; the working tree plus `.git` is copied, and `git status` count is part of the gate.
- **Two harnesses in one tree:** Claude Code loads `C:\RnD\CLAUDE.md` above the project's own `CLAUDE.md`; the project's memory protocol (`memory.md`) differs from root §0. Q5 rules it; until then the project's own files win inside `Projects/Habait/`, and the root contract applies above it.
- **No git in `C:\RnD`:** the board cannot be committed (plan-to-tasks Step 12) → `OWED-008`.

## 8. Done when
`C:\RnD\Projects\Habait` passes task 04's five checks, task 06's re-pointing is counted, task 07's smokes pass from the new root, the cards and memory are written (08), and Eliran has either cut over (09) or said the snapshot is enough.
