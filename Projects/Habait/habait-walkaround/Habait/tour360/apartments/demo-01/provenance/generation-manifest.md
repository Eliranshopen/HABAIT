# Apartment panorama asset manifest

Generated with the built-in image_gen tool: 13 room images plus two targeted projection corrections. All PNGs are **1774 × 887 (2:1)** at native resolution. Originals are preserved; these files are copies. Exact prompts, reference paths, original paths, and saved paths are in `prompts.json`.

These are photoreal generated design concepts. Each image was inspected visually. They have spherical panorama styling and full ceiling/sky and floor coverage, but seamlessness, metric geometry, and exact projection are not guaranteed. Openings and bed arrangements sometimes differ from the plan. Do not describe these images as surveyed, geometry exact, or 4K.

Use the 13 preferred files below. Initial `07-bedroom4.png` and `13-utility.png` remain for review; their v2 images remove windows incorrectly folded into the floor.

The centre heading is an approximate compass estimate. `u` is horizontal image position normalized to 0–1; 0.5 is the image centre. Inconsistent generated room geometry can prevent a single heading from matching every plan opening.

| Preferred filename | Approximate centre | Best initial u | Notes |
| --- | --- | ---: | --- |
| 01-living.png | north | 0.40 | Good photoreal master. Room features broadly follow plan. Ceiling/floor show equirectangular distortion; exact seam/metric geometry not verified. |
| 02-kitchen.png | north | 0.42 | Good materials. Cabinet runs are visually separated by a doorway instead of exact plan L arrangement; south seam adjacency uncertain. |
| 03-hall.png | north | 0.59 | Compact panorama; good visual connections. Door count/precise room correspondence remains approximate. |
| 04-primary.png | northeast (very approximate) | 0.63 | Compass arrangement does not admit a confident single rotation: bed/window and entry relationships differ from plan. Nice primary interior but not geometry faithful. |
| 05-bedroom2.png | north intended; room arrangement inconsistent | 0.40 | Bed is wider than requested and appears toward central/north side instead of south wall. Window/entry support intended north centre only approximately. |
| 06-bedroom3.png | north | 0.49 | Bed appears wider than requested, and its long axis is north–south rather than the plan east–west. Other room features present. |
| 07-bedroom4-v2.png | north | 0.72 | Targeted correction removed floor-window fold. Floor hemisphere now continuous. South window sits near left edge; exact seam consistency remains uncertain. |
| 08-main-bath.png | north | 0.62 | Requested main fixtures present; looks roomier than target dimensions. Seam appears to pass through door at both edges but not mathematically tested. |
| 09-ensuite.png | north | 0.47 | Compact bath concept with requested fixture set and no tub. Camera makes it appear somewhat larger than the plan; exact seam unverified. |
| 10-guest-wc.png | north | 0.57 | Correct visible fixture set, no physical tub/shower. Basin/cabinet and room appear larger than stated 1.5×1m. Reflection is generative and not spatially reliable. |
| 11-terrace.png | north | 0.50 | Strong outdoor spherical appearance and full sky/deck. Facade shape/width conceptual and deck outline simplified; exact edge seam unverified. |
| 12-garden.png | north | 0.56 | Lawn, bistro, storage volume and deck present. Replaces standard bedroom windows with full-height glazing; storage door orientation/facade differs. |
| 13-utility-v2.png | north | 0.45 | Targeted correction removed floor-window cutout. Remaining seam-side mismatch: small window near left edge and tall glazing near right edge. Shelf/washer/door arrangement broadly follows plan. |

See `manifest.json` for per-image feature positions and orientation confidence.

