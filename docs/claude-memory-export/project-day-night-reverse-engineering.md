---
name: project-day-night-reverse-engineering
description: "2026-11-17 reverse engineering of a walkthrough reel's \"Explore the light\" slider + a working Day/Night PoC in C:\\RnD\\Files_reverse_engeneering"
metadata:
  node_type: memory
  type: project
  originSessionId: 19ae0004-ecc4-4541-a0fd-839a98d55670
  modified: 2026-11-17T15:28:33.988Z
---

Eliran's brief (2026-11-17): reverse-engineer the reel in `C:\RnD\Files_reverse_engeneering\` and build a Day/Night PoC; no paid calls, no commits, reference projects read-only.

Result: the reel's slider is a linear cross-fade of 2 pre-made images (measured); the PoC renders 6 Cycles lighting keyframes of Kedma D/1 cp-living from relit COPIES of the .blend and blends them in a WebGL viewer (`poc/viewer`, QA `poc/qa/run_qa.sh` PASS at 1440/390). The look is NOT matched (resolution, night fixtures, materials, view outside). Index: `Files_reverse_engeneering/README.md`; repo memory `memory/project/2026-11-17-day-night-reverse-engineering.md`.

**Why:** a candidate product feature; decisions (adopt, 4 vs 6 keyframes, look, view outside, AI relight) are Eliran's, listed in `research/09-roadmap.md`.
**How to apply:** reuse `poc/blender/build_keyframes.py` + `relight.py` instead of re-deriving; never use AI relight as the base (object drift, fidelity rule). Related: [[project-kedma-d1-simulation]], [[project-engine-mcp-plan]], [[rule-sales-plan-fidelity]].

2026-11-17 (later): mode B added for the free 3D walk: light baked per keyframe on the same atlases of the Hatzav walk, a shader cross-fade by the clock, QA PASS. Evidence in Files_reverse_engeneering/poc-walk. The night look is flat (too many ceiling spots).

**Resume point 2026-11-18** (Eliran asked to save before his PC shuts down): both modes done, QA PASS, $0, uncommitted, nothing in flight. Server 8770 must be restarted after a reboot: `cd /c/RnD/Files_reverse_engeneering/poc-walk; timeout 14400 python -m http.server 8770 --bind 127.0.0.1 --directory viewer` (background). Files changed by another hand after my last edit (walk_presets.json, run_qa.sh, walk.js, SKILL.md) — the files on disk win. Full entry: repo memory/project/2026-11-17-day-night-reverse-engineering.md (last section).
