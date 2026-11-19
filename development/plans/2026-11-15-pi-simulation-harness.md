# 2026-11-15 — the Pi agent wrapped to make Habait apartment simulations

**Ask (Eliran, 2026-11-15):** «אני רוצה לעטוף את PI AGENT בכל המעטפת שצריך כדי שהוא ידע לייצר לי את ההדמייה של הדירה. אתה יכול לספק לי את כל המעטפת?»

**What exists:**
- Pi `@earendil-works/pi-coding-agent` 1.5.2 is installed (`pi` on PATH, `~/.pi/agent`).
- The whole simulation pipeline is in `Projects/Habait/habait-walkaround`:
  - auto-trace (PDF → `plan.general.json`);
  - `run-project.mjs` (plan → Blender → CG renders → AI skin, gated → sets → markers → build → package);
  - the fix tools (gen-pano edit lane, close-seam, region/object paste);
  - the gates (fidelity 1 %, consistency, hotspot/point-move checks);
  - build-tour, stage_flow.
- Pi has no knowledge of any of this, and nothing stops it from opening `.env`, paying without a dry run, or deploying production.

## The wrapper (a project `.pi/` under `habait-walkaround`, loaded after project trust)
1. `.pi/APPEND_SYSTEM.md`: the role, the machine (paths, Python venv, `HABAIT_APP_DIR`, Blender, timeouts), and Eliran's standing rules:
   - sales-plan fidelity ≤ 1 %;
   - no skirting boards;
   - consistency across tabs;
   - the «הדמיה» badge;
   - spend gating;
   - never `.env`;
   - the test link only;
   - production on his own go;
   - every check at 1440 and 390;
   - Hebrew, short.
2. `.pi/skills/`:
   - `habait-simulation` (the end-to-end from a sales plan, with references to the pipeline, rules and tools);
   - `habait-scene-fix` (one element fixed in a shipped picture: the edit lane + polygon paste + install + gate, the laundry-niche recipe);
   - `habait-sim-check` (fidelity, consistency, every button, level view, screenshots at 1440 and 390);
   - `habait-ship-test` (stage → compare → deploy the test project → served = stage);
   - `habait-walk3d` (the free 3D walk).
3. `.pi/prompts/`: `/simulate`, `/fix`, `/check`, `/ship-test`.
4. `.pi/extensions/habait-guard/`: a `tool_call` gate.
   - Blocks any read/write/bash that touches `.env*`, `auth.json` or a key file.
   - Asks Eliran before:
     - a paid run (`--go`, fal, OpenRouter);
     - any Vercel deploy;
     - a deploy whose link is not `rainbow-v2-test`;
     - `git push`;
     - a delete outside the scratch folders.
   - Blocks `--prod` deploys of the platform without a typed confirmation.
   - Registers `habait_spend` (the ledgers' totals) and `habait_fal_status` (the locked/working probe, free, key by name).
5. Missing tools brought into the tracked tree:
   - `Habait/tour360/tools/qa/` (every-button check, level view, room views at both sizes);
   - `Habait/tour360/tools/ship/` (`cmpstage.py`, `deploy-test.sh` with the gate/project checks);
   - `Habait/tour360/tools/polygon_paste.py` (one answer's polygons onto every floor set, with install, backups and source records: the generalised laundry tool).
6. `.pi/README-he.md`: how Eliran starts it (`cd …/habait-walkaround && pi`, trust, `/simulate <pdf> <id>`).

## Checks
- `pi --approve --no-session -p` with a prompt that only lists the skills, prompts and tools it sees and stops. This costs one short model call on Eliran's Pi account, and it is the only way to prove the wrapper loads.
- The guard is tested with `pi -e` and `-p`, asking it to `cat .env`: it must refuse.

## Open
- Eliran's model and provider for Pi are his (`~/.pi/agent/settings.json`, not read).
- The 3D walk's tools live on branch `blender-walk` (not on main yet). The walk3d skill points at them and says so.
