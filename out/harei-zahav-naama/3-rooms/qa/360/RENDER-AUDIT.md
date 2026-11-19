# Hatzav 360 — wall and vertical elements vs the developer's renders (audit, $0)
<!-- 2026-11-18 · audit sub-agent · read-only: no script, model or pano changed; Blender not run -->

**Question (Eliran, 2026-11-18):** the kitchen render has full-height light-oak upper cabinets right of the window (toward the living room); our model put open shelves there. What else differs in the elements the sales plan does not show?

**Method.** Each render (`Projects/Harey_zahav_Naama/*.jpg`, the look of record) was set against the GPT Image 2.5 panoramas (`work/pano360/real/<room>.jpg`) and, where the AI step could be the cause, the Blender originals (`work/pano360/<room>.png`). Each region was projected onto every panorama (eye 155 cm, yaw 0 = plan +u, + toward +v; cameras = `walkaround/walk-grid.json` views, except living (700,880) and dining (420,620) from `scripts/run_360_living.sh` and `run_360_dining.sh`). Each crop was then checked by eye for occlusion: `work/audit/proj.py`, `work/audit/projections.json` and `work/audit/crops.py`.

**Mapping that matters.** The renders are **mirrored** against the sales plan. In the living render 0060000 the kitchen stands LEFT of the TV wall, but in the plan, looking south from the sofa, it is on the right (west). So render-right = plan east. This matches Eliran's reading of the kitchen ("right of the window = toward the living room").

**Which render is which.** The task named `Corona-Camera0050000_Post_LightMix-Interactive.jpg` as the bedroom. It is **not**: it is a close-up of the living TV wall (TV, oak bookcase, woven chair, drum coffee table, sconce). `Corona-Camera0070000_Post.jpg` is the safe room's bookcase, `Corona-Camera0070000_Post_LightMix-Interactive.jpg` the dining room, and `Corona-Camera0020000_Post_LightMix-Interactive.jpg` a living/kitchen overview. **There is no render of the bedroom** (nor of the entrance, hall, deck or garden), so their wall elements cannot be checked against a render. They stay the model's assumed design (`hz_furniture.py` header: "heights, finishes, decor are ASSUMED").

Standing rulings applied: layout = sales plan; no kitchen island (the render's island, its stools and the two white cylinder pendants over it are not reported as a difference); the safe room keeps the open bookcase.

## Differences

| # | Room | Element | Render shows | Our 360 shows | Panoramas that show it | Model object / script to change | Severity |
|---|---|---|---|---|---|---|---|
| 1 | Kitchen | Wall units right (east) of the window | Full-height **light-oak upper cabinets**, two tiers of doors, from about 150 cm to the ceiling, flush to the end of the run (`1_CShading_LightMix.jpg`, also `0020000_LightMix`) | Three floating dark-oak **open shelves** (u 288–407, z 150/178/206) | kitchen, dining, living, entrance, hall; faintly deck and garden (through the sliding door, 4° and 2° wide) | `hz_public.py` lines 107–110 `K_shelf_0..2` → replace with an upper carcass (dark) + light-oak fronts, u `win[2]+4`…`rs[2]`, v `WALL_S-UD`…`WALL_S-1.5`, z 150…TOP, the same two-tier split as `K_upper_front_*` (z 150.4–205 / 205.5–TOP) | **clear mismatch** — `qa/360/audit/01-kitchen-uppers-vs-shelves.jpg` |
| 2 | Kitchen | Open shelves | Three floating oak shelves in the narrow recess **left (west) of the window**, between the tall column and the window, with ceramics | No shelves there: bare wall u 108–163 on the south wall | kitchen, dining, entrance, hall (the same views as row 1) | `hz_public.py`: move `K_shelf_*` to u `WALL_W+UD`…`win[0]-4` (≈ 110–159, 50 cm, which fits the render's narrow recess), keeping z 150/178/206 | **clear mismatch** (the other half of row 1: in the render, shelves and cabinets swap sides) |
| 3 | Kitchen | Window treatment | Linen **roman blind**, half raised, on the kitchen window | Bare window | kitchen (dining and living see it edge-on, small) | `hz_public.py` kitchen block: add a roman-blind box (L.sheer or linen, u 163–284, about 4 cm proud of the wall face, z ≈ 195–240, folded bottom) | **clear mismatch** (cheap) — `qa/360/audit/02-kitchen-window-blind.jpg` |
| 4 | Kitchen | West wall above the hob run | Render: no uppers on that wall (its hob sits under the east uppers; the west wall is the tall column) | Light-oak uppers 150–TOP above the hob run (`K_upper_*`) | kitchen, dining, entrance | none: the plan puts the hob on the west run; uppers over a hob is the render's own vocabulary | acceptable because of the plan |
| 5 | Kitchen | Tall column finish | One warm-oak bank (fridge + ovens) full height, oak end faces | Fridge column light oak (`K_fridge_door_*`), oven column warm oak; the oven column's side above the worktop shows the **dark carcass** (`K_tallS_carcass`, carcass_dark) | kitchen, dining, living, entrance | `hz_public.py` line 60–63: fridge doors `oak_l` → `oak_d`; add an oak end panel on the tall column's south face (v `ts[3]`…`ts[3]+2`, z 90…TOP) | minor |
| 6 | Kitchen | Pendants | Two white cylinder pendants over the island | None over the kitchen | — | none (no island by ruling) | acceptable because of the ruling |
| 7 | Dining | Large irregular oak bookcase (staggered cubbies, globe lamp) | Floor-to-near-ceiling warm-oak bookcase behind the table (`0040000`, `0070000_LightMix`, `0020000_LightMix`); in the overview it stands left of the tall kitchen column on the same wall | Not built (`hz_public.shelving(... irregular=True)` exists but is never called) | — | none now. Mirrored onto the plan it falls on the west wall north of the fridge (v 526–668), where the plan draws the **entrance door** (v 549–651). The plan has no free 3 m wall in the dining. | acceptable because of the plan |
| 8 | Dining | Glass door to the garden | Full-height glazed door beside the bookcase | Wall | — | none (not in the plan) | acceptable because of the plan |
| 9 | Dining | Rattan pendants | Two large woven bell pendants | Two woven egg pendants, same place | dining, kitchen, living, entrance | — | match |
| 10 | Living | Tall bookcase on the TV wall | Floor-to-ceiling warm-oak bookcase: two open columns + a closed middle column, in the corner right of the TV (`0060000`, `0050000`) | Not built | — | none now. Mirrored, its corner is plan **east** of the console, where the plan draws the living window (u 672–794); west of the console the kitchen run ends at u 410 (console starts 420). | acceptable because of the plan |
| 11 | Living | Console / TV | Long low warm-oak console the width of the wall, TV wall-mounted above | Light-oak console 250 cm (the plan's box), TV above | living, dining, kitchen | `hz_public.py` line 192 `L_console` `oak_l` → `oak_d` if the warm tone is wanted | minor |
| 12 | Living | Wall sconce (oak disc + glass globe) | On the side wall next to the bookcase corner | Same sconce, on the north wall above the sofa's west end | living, dining | none (its render wall carries the sliding door / window in the plan) | acceptable because of the plan |
| 13 | Safe room | Window curtain | **Full-height sheer curtain** on a ceiling track (pelmet line visible) along the window wall | Bare window | saferoom, hall (through the safe-room door) | `hz_furniture.py` SAFE ROOM block: add `curtain(...)` + rail like `B_curtain_*` (lines 205–209) on `win-saferoom` (u 159–262, face v 34), stacked both sides, z 1.5–(ceiling) | **clear mismatch** (cheap) — `qa/360/audit/06-saferoom-curtain.jpg` |
| 14 | Safe room | Wall reading lamp | Black swing-arm wall lamp + switch beside the headboard | None | saferoom | `hz_furniture.py`: small black arm + head over the bed's head end on the west wall (u 29, v ≈ 60, z ≈ 120) | minor |
| 15 | Safe room | Art over the bed | Large portrait poster centred over the bed | Small landscape frame on the west wall (`S_art`, 70 × 50) | saferoom | `hz_furniture.py` line 262 `S_art`: portrait, ≈ 70 × 100, z 110–210 | minor |
| 16 | Safe room | Bookcase | Light oak, slim open column + closed oak column, near ceiling, filled with books and toys (`0030000`, `0070000_Post`) | Warm-looking oak 2 × 6 open grid to 240 cm, nearly empty (four vases); already warm in the Blender original | saferoom, hall, bath (through the doors) | `hz_furniture.py` line 239 `S_bookcase` (+ `hz_public.books(...)` to fill it) | minor (kept by ruling; only finish and fill differ) |
| 17 | Bath | Wall cabinet over the WC | **Full-height warm-oak wall cabinet** above the WC build-out, with an open oak niche shelf under it (≈ 130 cm → ceiling) | Bare tiled wall over the ledge, a potted plant (`T_plant`) | bath, hall (through the bath door) | `hz_furniture.py` BATHROOM block: add a cabinet on `t-wc-wall` (u 24 → ≈ 54, v 324–433, z ≈ 150 → H) with two door fronts in `oak_d` + an open niche z 120–150; drop or move `T_plant` | **clear mismatch** — `qa/360/audit/03-bath-wc-wall-cabinet.jpg` |
| 18 | Bath | Shower enclosure | **Shower curtain** (linen) on a black ceiling rail; exposed black rain-shower column | **Smoked dark glass** enclosure with black bar handles (dark already in the Blender original: `M["glass"]`) | bath | `hz_furniture.py` lines 275–277: replace `T_shower_glass_e/n` + `T_shower_handle` with a black rail (L.cyl) + `curtain(...)` along the shower's open sides; optional: exposed column `T_shower_arm` vertical | **clear mismatch** — `qa/360/audit/04-bath-shower-curtain-vs-glass.jpg` |
| 19 | Bath | Vanity | Wall-hung light-oak vanity with **drawer fronts** (≈ 40 cm tall body), white top with an **integrated basin**, open oak shelf with towels below, **wall-mounted** black taps | Thin oak cabinet (z 52–80, one gap line), a **raised vessel basin** on the top, deck tap; shelf and towels below match | bath | `hz_furniture.py` lines 284–293: body z ≈ 40–80 with two drawer rows; `T_basin` → a sink cut into `T_vanity_top` (as `K_sink_bowl`); taps on the wall | **clear mismatch** — `qa/360/audit/05-bath-vanity-sconces.jpg` |
| 20 | Bath | Sconces | **Two pairs of white glass globe sconces** flanking the mirror | None | bath | `hz_furniture.py`: four emissive globes (≈ 7 cm radius) at the mirror's sides, z ≈ 150 / 170 | **clear mismatch** (missing light fitting) — same image 05 |
| 21 | Bath | Mirror | Large black-framed rectangle, wider than the basin | Black-framed rectangle, the vanity's width | bath | — | match |
| 22 | Bath | WC flush plate, bidet hose, towel hooks | Black flush plate, black hand-shower hose, black hooks with towels beside the mirror | Steel flush plate (`T_flush_plate` = steel), no hose, no hooks | bath, hall | `hz_furniture.py` line 271 `T_flush_plate` steel → black; hooks optional | minor |
| 23 | Bath | Wall tiles / door | Large-format beige stone, full height; white flush door, black lever | Same | bath, hall | — | match |
| 24 | Kitchen / living / dining | Ceiling | Plain ceiling, small recessed downlights | Same | all | — | match |
| 25 | Bedroom | Wardrobe, oak wall panel + TV shelf, curtains, headboard, lamps, art | **no render exists** | Built from the plan + assumed design | bedroom (and hall) | — | not auditable (no render) |

## Clear mismatches (to fix in one pass)
1. Kitchen: east of the window, shelves → full-height light-oak upper cabinets (`hz_public.py` `K_shelf_*`).
2. Kitchen: the three floating shelves go west of the window, ≈ u 110–159 (`hz_public.py`).
3. Kitchen: roman blind on the window (`hz_public.py`, new).
4. Safe room: full-height sheer curtain on the window (`hz_furniture.py` safe-room block, new, like `B_curtain_*`).
5. Bath: oak wall cabinet + niche over the WC (`hz_furniture.py` bathroom block, new).
6. Bath: shower curtain on a black rail instead of the smoked glass (`hz_furniture.py` `T_shower_glass_*`).
7. Bath: drawer vanity with an integrated basin and wall taps (`hz_furniture.py` `T_vanity_*`, `T_basin`, `T_tap_*`).
8. Bath: two pairs of globe sconces by the mirror (`hz_furniture.py`, new).

## Panoramas to re-render if all clear mismatches are fixed
| Panorama | Because of |
|---|---|
| kitchen | 1, 2, 3 |
| dining | 1, 2 |
| living | 1 |
| entrance | 1, 2 |
| hall | 1 (behind the pendant), 4 (safe-room window through its door), 5 (WC wall through the bath door) |
| saferoom | 4 |
| bath | 5, 6, 7, 8 |
| deck | 1, faint (4° wide through the sliding door); re-render to stay consistent, or accept |
| garden | 1, faint (2° wide); can be accepted as is |

**Not needed:** bedroom (no changed object is in its view; no render to audit it against).

So **7 must be re-rendered** (kitchen, dining, living, entrance, hall, saferoom, bath), plus deck as advised and garden as optional. At GPT Image 2.5's $1.20 a room that is ≈ $8.40–$10.80 of the realism step, against $4.11 left under the $95 ceiling: that is Eliran's call (§7).

Evidence: `qa/360/audit/01…06-*.jpg`; working crops and the projection tool are in `work/audit/`.
