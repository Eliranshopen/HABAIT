---
name: feedback-renders-to-fal-3d-items
description: "Eliran 2026-11-17 (Hatzav walk) — box-built furniture \"looks drawn and cheap\"; make the developer's render items as real 3D models on fal (crop → vision spec → studio photo → image-to-3D), and the walk must carry RAINBOW's features"
metadata:
  node_type: memory
  type: feedback
  originSessionId: c76b1b3f-627c-4655-a8a1-652a0fa40800
  modified: 2026-11-17T19:00:36.463Z
---

On the Hatzav walkaround (2026-11-17 evening) Eliran said the procedural box furniture «נראה מאוד מאוד זול» / «ממש מצויר». His instruction: use the developer's interior renders **as references** and have a **fal model make exactly the same items, same colours, high-end and realistic, for the 3D walkaround** — and «תמצא כלי שיודע לקחת את אותם תמונות לנתח אותם ולהעביר פרויקט מדויק למודל».

The chain that worked (pilot, $2.04 for 3 items): crop from render ($0, measured hex colours) → `google/gemini-3.7-flash` via fal `openrouter/router/vision` writes a JSON spec + studio prompt (≈$0.005) → `fal-ai/nano-banana-pro/edit` 2K clean studio photo on white ($0.15; matched the renders very closely) → `fal-ai/hunyuan-3d/v3.1/pro/image-to-3d` enable_pbr ($0.525, ~3–5 min, 47–67 MB GLB, 500k faces → decimate for web). Script: job `scripts/16_item_3d.mjs`.

Gotchas: fal result files are big — every fetch needs a timeout; never wrap a paid queue call in a shell `timeout` before the request id is saved; run ledgered calls one at a time (two processes on one ledger lost rows). fal request history (`api.fal.ai/v1/models/requests/by-endpoint`) recovers a lost request id at $0.

He also wants **all RAINBOW tour features** in a 3D walk (rings on items → swap from a catalog, free-text design line, floor finishes, undo/compare, plan with location, measure) — in 3D these are scene operations ($0 per click), not pixel edits. Built-ins with thin boards (shelving, kitchen) stay Blender geometry with real materials.

**Why:** a walkaround with box furniture never reads as luxury; his standard is the developer's Corona renders.
**How to apply:** for any apartment visual, plan real 3D items from the references from the start (cost the chain per item, ask for the spend), never ship box furniture as final. Related: [[feedback-walkaround-not-panorama]], [[feedback-realism-over-diagram-look]], [[feedback-right-from-the-start-no-piecemeal-fixes]].
