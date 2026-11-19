---
name: feedback-walkaround-not-panorama
description: "Eliran 2026-11-17 wants a free real-time 3D walkaround (walk in the model), not 360 panoramas, for the Hatzav house; ask before assuming panoramas for a new visualization"
metadata:
  node_type: memory
  type: feedback
  originSessionId: c76b1b3f-627c-4655-a8a1-652a0fa40800
  modified: 2026-11-17T15:43:04.574Z
---

Eliran, 2026-11-17, mid-job on the Harei Zahav Na'ama house: «I want a fully interactive 3D Walkaround visualization, not a 3D 360° panorama». The written brief had asked for 360° panoramas; he overrode it.

**Why:** he wants the feel of walking through the home (same wish as the apt846 walk3d, 2026-11-12: «תחושה אמיתית של הליכה בדירה»), and fixed 360 viewpoints cannot give that ([[rule-tour-movement-like-walking]]).

**How to apply:** the working recipe is the Blender model with daylight and lamps baked into texture atlases, exported to glTF and walked in three.js with keys / drag / tap-to-walk and a free-floor grid (job `C:\RnD\.wt\harei-zahav-naama\out\harei-zahav-naama\3-rooms\`, scripts `blender/walk_bake.py`, `12_walk_grid.py`, `walkaround/walk.js`; adapted from branch `blender-walk`). My reading: for a new apartment visualization, ask early whether he wants the walkaround, panoramas or both, rather than defaulting to panoramas.
