# Task 07 — the toolchain from the new root
**Agent:** `habait-asset-wrangler` (status live, track habait) · **Model:** sonnet · **Ruling tier:** T0 · **Burst:** 4 · **Depends on:** 04 PASS
**Memory file:** `memory/agents/habait-asset-wrangler.md`

## What to do
1. **venv (not relocatable, so re-created):** `python -m venv C:\RnD\Projects\Habait\tools\habait-venv` with the Anaconda 3.13 python the old `pyvenv.cfg` names (`C:\Users\elira\anaconda3\python.exe`), then `timeout 540 .../Scripts/python.exe -m pip install -r C:\RnD\development\tasks\copy-habait-2026-11-03\logs\pip-freeze.txt`. Record the pip log in `logs/venv-install.log`.
2. **Blender:** if Q3 = copied, `BLENDER=/c/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe`; smoke: `timeout 120 "$BLENDER" -b --factory-startup -P /c/RnD/Projects/Habait/habait-walkaround/360walkaround/pipeline/probe/hello-render.py` (the 3-second probe the project's `CLAUDE.md` names). If Q3 = re-extract, write the extraction command into `docs/OWNER-PASTE.md` §e and mark this step SKIPPED.
3. **Node deps where tests exist:** `cd .../habait-walkaround/Habait/tour360/engine && timeout 540 npm ci && timeout 300 node test/run.mjs` (the project reports 15 passed); `cd .../tools/appdeps && timeout 540 npm ci`. Nothing else is installed.
4. **Python imports:** `$PY -c "import numpy, PIL, cv2, shapely, ezdxf, fitz"` exits 0.
5. Write `logs/toolchain-report.md`: each step, the command, the exit code, the first error line if any; and the three env lines for the new root (`BLENDER`, `HABAIT_APP_DIR`, `HABAIT_PY`) ready to paste into the copied `CLAUDE.md` "Environment setup" block (task 06 already re-pointed the paths; confirm they match).
⚠ Machine resource rules: one heavy command at a time, `timeout` on every one, Blender is CPU-only here.

## Files
- creates: `C:\RnD\Projects\Habait\tools\habait-venv\**`, `node_modules` in the two folders above, `logs/venv-install.log`, `logs/toolchain-report.md`
- never touches: `C:\Habait`

## Acceptance
`toolchain-report.md` shows exit 0 for the venv install, the Python import line, the Blender probe (or SKIPPED with the paste written) and the engine tests (15 passed, or the real count with the failing names).

## Standing rails (inherited verbatim from the board README — root `CLAUDE.md` §0)
1. **Bounded read-first:** `memory/HOT.md`, then the LAST ~150 lines of your own `memory/agents/<name>.md` (plus its archive-index block). ⛔ Never read `memory/INDEX.md` whole — grep it.
2. **Write last, once:** ONE entry (`memory/_TEMPLATE.md`) into the layer that owns the fact, plus ONE ≤ 400-char pointer line under that layer's existing `memory/INDEX.md` header. ⛔ Never add a header.
3. **Second reader:** name which OTHER actor must know this; append ONE pointer line into their `memory/agents/<name>.md`, or say "none".
4. **An action is not done until its memory is written.**
5. ⛔ **The source `C:\Habait` is read-only to every task on this board.** Nothing is edited, moved or deleted there. Every write goes to `C:\RnD\Projects\Habait` or to this board folder.
6. ⚠ **Machine resource rules** (root `CLAUDE.md` §12): every heavy command under `timeout N`, one at a time, foreground; robocopy runs from PowerShell or `cmd //c`, never bare in Git Bash (it rewrites `/E`-style flags into paths).
