# qa/360/fixes/ — context file
<!-- last-updated: 2026-11-18 -->

## What's here
Proof of the 2026-11-18 render fixes (the 8 clear mismatches of `../RENDER-AUDIT.md`, approved by Eliran in one pass), rendered from `scene/hatzav_v2.blend` ($0, Cycles CPU, low samples):
| File | What |
|---|---|
| `<shot>.png` + `.json` | perspective stills from `scripts/blender/fix_stills.py` (kitchen south wall, bath WC + shower, bath vanity, safe-room window) |
| `pano-172_890.png` | low 360 (1024×512, 16 samples) of the kitchen from plan u=172, v=890 |
| `cmp-*.jpg` | side by side: the developer's render crop (left, mirrored to plan orientation where noted) and our still (right) |

Not the tour panoramas: those are rendered by the main session after this proof.

## Links
Parent: `../` (qa/360) · Audit: `../RENDER-AUDIT.md`
