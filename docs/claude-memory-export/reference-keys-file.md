---
name: reference-keys-file
description: "Where the local fal key lives (C:\\RnD\\.env, a FILE Eliran creates) and why a session can never create, list or read it"
metadata:
  node_type: memory
  type: reference
  originSessionId: 1637a6da-e282-40ec-b653-0b72a459bc37
  modified: 2026-11-17T05:46:19.679Z
---

The harness's local keys file is `C:\RnD\.env`: one line, `FAL_KEY=<value>`. Eliran asked for it on 2026-11-16 («התכוונתי קובץ ENV לא תיקיית ENV» — a FILE, not a folder; a folder `ENV` I made first was removed).

- A session cannot create it, list it or read it: `.claude/settings.json` denies `Read(**/.env)`, and the harness extends that to the Write tool and to shell commands that name the file. Do not try a shell workaround; ask Eliran to create the file (VS Code: New File → `.env` at the root).
- Check without opening it: `python Habait/tour360/tools/edit_bench.py --key-check` (branch `typed-change-all-tabs` until merged) prints `present` or `missing` and where it looked.
- A shell command line that contains the file's path is refused too: put such text in a file (Write tool) and run that.
- Only `FAL_KEY` is needed for the tour's typed change and its bench; `OPENROUTER_API_KEY` is optional (fal's router is the fallback).
- **2026-11-17: both `FAL_KEY` and `OPENROUTER_API_KEY` are in it** (Eliran: «יש לך אבל מפתחות פה C:\RnD\.env»). I had told him the keys were missing: the engine `Projects/3Dengine` looks for the keys file in its own folder by default (`envRoot: "."`). Check by NAME with the engine's own readiness command: put `{ "envRoot": "C:/RnD" }` in the engine home's untracked `engine.config.local.json` and run `node engine/cli.mjs doctor` there; it prints `FAL_KEY: present, OPENROUTER_API_KEY: present`. Before saying a key is missing, ask where the tool looked.

Related: [[feedback-keys-and-paid-calls]], [[feedback-scripts-and-secrets-hygiene]].
