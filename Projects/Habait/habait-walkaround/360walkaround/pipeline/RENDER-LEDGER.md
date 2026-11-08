# 360walkaround V2 — render ledger

**Opened:** 2026-09-01 · board `360-v2` T04 · render-pipeline-engineer
**Governs:** every Blender/Cycles render of the V2 pipeline, local or rented.
**Money law of record:** `CONTRACT.md` **§16.3 (A8)** — the numbers live there **once**; this file
cites, it never restates a different figure. Cloud-GPU lane: **soft $10 / hard $15, board-wide.**
Zero generative-API calls exist on this lane at all (S-V2-2 is a *stack* decision, not a budget line).

---

## 0. The rules this file exists to enforce

1. **A local render costs $0 and is still logged.** Wall clock, peak VRAM, device and settings are the
   product; "free" is not the same as "unmeasured". Root `CLAUDE.md` §7 / board rail 1.
2. ⛔ **A rented machine gets its row BEFORE it starts** — job, machine, $/h, the hour cap, and who
   authorised it. A cloud-produced output whose hash appears in a `tours/*/manifest.json` with **no
   row dated at or before its render** is an **unledgered charge** and is reported as one (C-360-79).
   ⚠ That is a **gate check, not a code check** — a Markdown ledger is not a test, and this file does
   not pretend otherwise.
3. **Past the soft line, say so in the result; the hard line is a stop.** Rail 3.
4. **Output hashes: hash the DECODED data, not the container.** An identical re-render produces a
   different `.exr`/`.png`/`.webp` byte stream (ENV.md §4.3 — Blender stamps `Date`/`RenderTime`, and
   colour panos carry genuine Monte-Carlo differences). The depth map's *packed pixel bytes* ARE
   stable and are hashed as such (`packed_data_sha256` in each point's sidecar).
5. **Rerun-skip keys on INPUT hashes only** (`plan.json` + `build_scene.py` version + render settings
   + script version). Keying on an output hash would re-trigger an expensive render on every
   identical rerun — exactly the bug §7 and rail 2 forbid.

---

## 1. Local runs — RTX A2000 Laptop 4 GB (ENV.md §1), $0.00

All rows: Blender 4.5.10 LTS, Cycles, **OptiX GPU-only**, `--factory-startup`, seed 0,
adaptive sampling on (threshold 0.01), denoise on (OpenImageDenoise, **CPU** — `denoising_use_gpu`
is `False` by default), `use_auto_tile` on with `tile_size` 2048, `texture_limit_render` OFF.
Scene: `tours/pilot-karnei/scene-probe.blend` (T03) — the furnished `r-living` probe room,
32 objects / 23 meshes / 5 CC0 models with 2K PBR textures / HDRI + sun + 2 emitters.

| # | Date | Job | Resolution | spp | Wall clock | Cycles `Time:` | Peak VRAM (device) | Peak host RAM | $/h | Hours | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|
| L1 | 2026-09-01 | T04 plumbing smoke (scratch) | 1024×512 | 32 | **5.21 s** | 4.84 s | 1087.58 MB | 983.40 MB | $0 | 0.001 | **$0.00** |
| L2 | 2026-09-01 | T04 **draft of record** (`pano-4k-draft.png` + `depth-4k-draft.png`) | 4096×2048 | 64 | **107.43 s cold / 112.75 s warm** | 105.88 / 111.18 s | **1368.21 MB** | 1939.99 MB | $0 | 0.061 | **$0.00** |
| L3 | 2026-09-01 | T04 8K pixel-scaling probe (scratch, not committed) | 8192×4096 | 64 | **470.29 s (7:50)** | 460.39 s | **1369.48 MB** | 5972.01 MB | $0 | 0.131 | **$0.00** |
| L4 | 2026-09-01 | T04 **final of record** (`pano-8k.webp` + `depth.png`) | 8192×4096 | 256 | **1403.98 s (23:24)** | 1389.95 s | **1369.48 MB** | 5972.03 MB | $0 | 0.390 | **$0.00** |
| L5 | 2026-09-01 | T05 denoiser-isolation control (scratch) | 4096×2048 | 64 | 73.54 s | — | — | — | $0 | 0.020 | **$0.00** |

⚠ **L5 is T05's row, appended here by T06** — `RENDER-LEDGER.md` §16.4 makes this file
render-pipeline-engineer's, so T05 (`walkthrough-engineer`) could not write into it directly; its own
task file (`task-05-probe-verify-g0.md`, "Owed") states the render exactly: `--denoise off`,
**1179.86 MB peak VRAM**, run against the T03 probe scene, purpose = isolating the seam finding
(F-360-118) from denoiser residue. The "Peak VRAM (device)"/"Peak host RAM" columns are left `—` above
because T05's own record did not distinguish device-vs-host peak (T04's `parse_render_log` convention);
**1179.86 MB** is the one number T05 reported and is not misfiled into either column.

Total local GPU time on this task: **≈ 0.58 h** (plus two re-runs of L2 while the log/sidecar were
brought back into agreement, and one 25 s deliberately-killed run used to prove the rerun-skip key
changes when a setting changes). ⛔ **All of it $0.00 — nothing left this machine.**

### 1.1a T06 — the whole-apartment draft coverage batch

New scene as of this row: `tours/pilot-karnei/scene-full.blend` (board `360-v2` T06, `build_scene.py`
v1.0.0) — **all 14 rooms, 31 real walls, 199 meshes / 212 objects**, materials from the new
`materials_kit` module, a coverage light in 4 windowless rooms, one large terrain plane. L1–L5 above are
all against the OLD `scene-probe.blend` (T03's single-room probe); this batch is the first render of the
new whole-apartment scene.

| # | Date | Job | Resolution | spp | Wall clock (12 points) | Peak VRAM (device) | $/h | Hours | Cost |
|---|---|---|---|---|---|---|---|---|---|
| L6 | 2026-09-01 | T06 **draft coverage batch** — all 12 `camera_points[]` (9 authored + 3 auto-placed: `cp-wc`/`cp-master-lobby`/`cp-ensuite`), one `render_pano.py` process per point | 2048×1024 | 64 | **414.02 s total (6.90 min)**, per-point 26.00–85.36 s (`cp-living` slowest — the only furnished room) | **1207.97 MB** (identical on all 12 — flat scene, no per-room texture variation beyond the one shared floor material) | $0 | 0.115 | **$0.00** |

Per-point breakdown (`tours/pilot-karnei/renders/drafts/_batch-results.tsv`, machine-generated, not
retyped here): `cp-entry` 28.78 s · `cp-dining` 42.05 s · `cp-living` 85.36 s · `cp-kitchen` 26.00 s ·
`cp-corridor` 26.64 s · `cp-mamad` 26.13 s · `cp-bed-2` 26.56 s · `cp-master` 26.65 s · `cp-bath-main`
27.62 s · `cp-ensuite` 27.52 s · `cp-master-lobby` 28.15 s · `cp-wc` 42.57 s. All 12 device-peak VRAM
identical at 1207.97 MB (33 % lower than L2's furnished-single-room 1368 MB — the whole 14-room shell,
mostly flat-coloured walls/floor/ceiling, costs LESS device memory than one textured 5-model living room;
the catalog is still the VRAM driver, not room count, matching T04's own finding).

⚠ **One real defect found and fixed before this batch ran, not after**: the first build (pre-fix) left a
green sliver at every floor-level doorway threshold — each room's floor slab stops at its own interior
wall face, so a door cut through to `sill_cm=0` opened a gap with neither floor nor (cut-away) wall
under it, and a steep-down ray fell through to the new terrain plane 3 m below. Caught by eye on the
`cp-wc` smoke render (a 5 cm-wide green strip crossing the wood floor), fixed with one filler slab per
wall footprint (`build_wall_floor_fillers`, `build_scene.py`) before any of the 12 drafts were rendered
for real — **not** a "the drafts show a bug" ledger entry, the bug never reached a logged render.

**Camera clearance** (build_scene.py's own mesh-BVH check, all 12 points, bar 40 cm): **12/12 PASS**,
worst case **42.56 cm** (`cp-entry`, from `WALL_w-hall-e` — deliberately placed close to the entrance
door per its own T02 authored note "inside the entrance door"), next-worst 62.50 cm (`cp-wc`, auto-placed).

**What's on disk** (`tours/pilot-karnei/renders/drafts/`): 61 files, **26.79 MB** — 12× (`pano.png` +
`depth.png` + `pano.render.json` + `pano.render.log` + `build.stdout.log`) + `_batch-results.tsv`. All
PNG (draft-quality, not the WebP/8K encoding L4 uses) — **the orchestrator's call** whether this stays
committed evidence or gets `.gitignore`d as regenerable (108 s/point × 12 ≈ 7 min to remake in full).

Three derived numbers the board will want:
- **Pixel scaling at fixed samples:** 4K → 8K = **4.38×** wall clock for 4× the pixels (L2 → L3).
- **Sample scaling at fixed 8K:** 64 → 256 spp = **2.99×** wall clock for 4× the samples — adaptive
  sampling (threshold 0.01) eats a quarter of the nominal cost (L3 → L4).
- **Full pilot extrapolation** (9 camera points in `plan.json`): **≈ 1.2 h at 64 spp**, **≈ 3.5 h at
  256 spp**. ⚠ An extrapolation, not a measurement — one room, rendered once.

**Outputs and their hashes.** ⚠ Per rule 4 the depth row is the hash of the **decoded packed pixels**
(stable across identical re-renders); the pano/PNG rows are file hashes and are **not** expected to
repeat byte-for-byte (measured: the same 4K draft produced 8,267,910 / 8,267,232 / 8,268,413 B on
three identical runs).

| Row | File | Bytes | sha256 |
|---|---|---|---|
| L2 | `tours/pilot-karnei/renders/probe/pano-4k-draft.png` (file) | 8,268,413 | `0b8d573234ff3087338cf10abfd5b91e95e4a1e005fe3fcc47c5396cb0d4c873` |
| L2 | `tours/pilot-karnei/renders/probe/depth-4k-draft.png` (file) | 354,852 | `3af835d63da84c0cc1a6487aa8c9e9ab9d75c04e8153161d9a6f1475343cda1e` |
| L2 | `tours/pilot-karnei/renders/probe/depth-4k-draft.png` (**decoded pixels**) | — | `38c2264490a971378e96f27ed08f2e1886625043b9ab21c256b54655434ac197` |
| L4 | `tours/pilot-karnei/renders/probe/pano-8k.webp` (file) | 1,353,452 | `1ee96ea76dd289f34ac0bfe824d609dc7d54bda49961db0b9e280ad7088f8fb6` |
| L4 | `tours/pilot-karnei/renders/probe/depth.png` (file) | 975,417 | `89260e4e9eb2a733f27e4e034eebe37ec423eb2b5109c54245be392ff27ce6ed` |
| L4 | `tours/pilot-karnei/renders/probe/depth.png` (**decoded pixels**) | — | `4d7b6100aa899359df5f08bb141a3db45754658b1f0faea76832c588f4229b03` |
| L4 | `pano-8k.png` — the lossless master, **measured then deleted** (31,946,066 B, too heavy for git) | — | `0bd9ffc758e561df036e38f724748e0629ef8874ee96efd06fc52c7e77c6f965` |

### 1.1b T07 — the wrap-pad experiment and the resumable batch CLI

All rows: the same machine and settings block as §1 above, **plus `--wrap-pad`** (T07's fix for
F-360-118, ENV.md §12). A padded frame renders `W + 2·pad` columns and is cropped back, so the wall
clock scales with `(W+2·pad)/W` — at 4096 wide, pad 512 is **+25 % pixels**.

| # | Date | Job | Scene / point | Resolution | spp | pad | Wall clock | Peak VRAM (device) | Cost |
|---|---|---|---|---|---|---|---|---|---|
| L7 | 2026-09-01 | T07 crop-alignment probe (scratch) — the pad-0/pad-64 pair whose **depth** maps prove the crop lands on the unpadded grid | scene-full / cp-living | 1024×512 | 32 | 0 + 64 | 5.07 s + 5.61 s | ~1088 MB | **$0.00** |
| L8 | 2026-09-01 | T07 **wrap-pad sweep** (scratch) — 4 renders, pad 0 / 128 / 256 / 512, each `--also-png` so one render yields both encodings | scene-probe / cp-living | 4096×2048 | 64 | 0,128,256,512 | 4 × ≈115–140 s | 1368–1369 MB | **$0.00** |
| L9 | 2026-09-01 | T07 sample-count control (scratch) — the refutation of "the residual is Monte-Carlo noise" | scene-probe / cp-living | 4096×2048 | **256** | 512 | **411.44 s** | 1368.83 MB | **$0.00** |
| L10 | 2026-09-01 | T07 kill/resume proof — a 4-point batch killed mid-flight (blender child **and** the node parent), then resumed | scene-full ×4 pts | 4096×2048 | 64 | 512 | 2 rendered before the kill; the resume rendered **2 and skipped 2 in 302.4 s** | 1369.22 MB | **$0.00** |
| L11 | 2026-09-01 | T07 **the batch of record** — `render_tour.mjs --mode draft`, all 12 camera points + the top view, ONE Blender process for the points | scene-full ×12 pts | 4096×2048 | 64 | 512 | **1908.7 s (31.8 min)** total · per point 112.2–199.1 s · top view **14.0 s** | **1369.22 MB** (flat across all 12) | **$0.00** |
| L12 | 2026-09-01 | T07 rerun-skip proof — the same command again, immediately | — | — | — | — | **6.1 s, 0 rendered / 12 skipped**, every output's mtime unchanged to the nanosecond | — | **$0.00** |
| L13 | 2026-09-01 | T07 `--force cp-wc` proof | scene-full / cp-wc | 4096×2048 | 64 | 512 | **152.4 s**, 11 skipped, only cp-wc's mtime moved | 1369.22 MB | **$0.00** |
| L14 | 2026-09-01 | T07 before/after on the SHIPPED scene (scratch) — pad-0 control + a pad-512 `--also-png` master for the lossless comparison | scene-full / cp-living | 4096×2048 | 64 | 0, 512 | 148.2 s + 150 s | 1368.60 MB | **$0.00** |

⚠ **The one number the board should read as a miss, stated plainly.** F-360-118's bar is *wrap-column
MAD ≤ 3× the adjacent-column median*. With the fix shipped (pad 512, WebP q90, unchanged):

| scene / point | before (pad 0) | **after (pad 512)** | local ±64 after | macroblock-matched after |
|---|---|---|---|---|
| `scene-probe` / cp-living — **T05's own comparison artefact** | 3.4978× ✗ | **2.8669× ✓** | 3.7966× | 1.952× |
| `scene-full` / cp-living — the whole apartment | 3.8049× ✗ | **3.0321× ✗ (misses by 1.07 %)** | 3.9651× | 2.104× |

The absolute discontinuity fell **18 %** on the full scene (2.1304 → 1.7386) and the lossless master of
that very frame reads **1.6515×** — so the remaining gap is the WebP block structure, not the render
(ENV.md §12.2's block-boundary control: on the lossless frame the macroblock-edge and inside-block
populations are identical, on the WebP they differ 1.6×). ⛔ **Not bought back with encoder quality**:
q95 would "pass" at 2.85× while leaving the seam itself untouched (the wrap MAD does not move with
quality — ENV.md §12.1), and it would cost +66 % bytes against T04's weight parity with the reference
product. A pad of 1024 would probably cross the line at **+50 % render time for a ~1 % metric move**;
that is the same purchase in a different currency and was refused for the same reason. ⇒ **T13 measures
this at 8K before any decision**, and F-360-118's own recommendation (score the LOCAL or the
block-matched population, not the global median) is on the table for the board.

**What the batch left on disk** (`tours/pilot-karnei/renders/`, T07's own files only): **10.35 MB** —
12 × (`pano.webp` 145–369 KB + `depth.png` ~330–430 KB + `pano.render.json` ~12 KB + `pano.render.log`
~91 KB) + `topview.png` 1.29 MB + `topview-roomids.png` 15 KB + `topview-depth.png` 25 KB +
`topview.registration.json` 17 KB + `_render-tour.report.json` 11 KB + `_logs/` 17 KB. Of that,
**~1.2 MB is `.log`** (Cycles progress spam) and is **already excluded by the root `.gitignore`'s
`*.log`** (verified with `git check-ignore -v`), so the committable weight is **≈ 9.2 MB**.
⚠ One orchestrator call, not mine: T06's superseded `renders/drafts/` (**26.8 MB**, 2048×1024 PNG) is
now redundant with this batch — its manifest rows were legitimately overwritten by the same point ids,
so that directory is evidence of a past run and nothing reads it.

### 1.1c T12 — the furnished scene: catalog integration, the style lock, the ceiling-clip A/B

Same machine and settings block as §1. The scene is no longer the bare shell: **56 imported catalog
models + 11 luminaires across 13 rooms**, 30 distinct CC0 models (10 Poly Haven with 2K PBR maps,
20 Kenney/Quaternius restyled onto the locked palette). ⭐ **Peak VRAM barely moved** — 1329.76 MB
furnished vs T07's 1369.22 MB bare at the same resolution — which is T04's finding holding up: the
driver is TILE SIZE, not scene content, on this GPU at 4K.

| # | Date | Job | Scene / point | Resolution | spp | pad | Wall clock | Peak VRAM (device) | Cost |
|---|---|---|---|---|---|---|---|---|---|
| L15 | 2026-09-01 | T12 furnishing iteration previews (scratch) — 4 look checks that drove 4 style decisions (the L-sofa, the balcony floor, the wet-room floor, the mirror) | scene-full / cp-living, cp-bath-main | 1600×800 – 2048×1024 | 16–24 | 0 | 5 × ≈10–18 s | 1168–1169 MB | **$0.00** |
| L16 | 2026-09-01 | T12 **the 3-room strip of record** — `render_tour.mjs --mode draft --force`, the eyeball set the task asks for | scene-full / cp-living, cp-master, cp-bath-main | 4096×2048 | 64 | 512 | **515.1 s** (160.0 / 166.8 / 180.4) | 1329.76 MB | **$0.00** |
| L17 | 2026-09-01 | T12 the ceiling-clip evidence set — the two rooms T07 named, re-rendered furnished | scene-full / cp-wc, cp-master-lobby | 4096×2048 | 64 | 512 | 186.9 s + 182.0 s (in an 891.4 s 5-point batch) | 1329.76 MB | **$0.00** |
| L18 | 2026-09-01 | T12 **the controlled A/B** — `--luminaire t06-point` rebuilds the superseded emitter into the SAME furnished scene; one variable | scene-t06light + scene-full / cp-wc | 2048×1024 | 32 | 0 | 2 × ≈40 s (+ 2 × ≈18 s of scene build) | ~1170 MB | **$0.00** |
| L19 | 2026-09-01 | T12 stale-detection proof — a plain (unforced) run of a point last rendered by T07 **re-rendered instead of skipping**, because the scene report's hash is inside every point's input key | scene-full / cp-mamad | 4096×2048 | 64 | 512 | 175.4 s (incl. a scene rebuild) | 1329.76 MB | **$0.00** |
| L20 | 2026-09-01 | T12 consistency re-render + the rerun-skip proof on the shipped code | scene-full ×5 pts, then ×6 pts | 4096×2048 | 64 | 512 | see §1.1c note | 1329.76 MB | **$0.00** |

**Determinism, re-run on the furnished apartment** (`pipeline/probe/check-determinism.py --room all`):
two builds, **identical decoded scene data** — 350 objects, 280 meshes, dump sha256 `48f170f0…`,
604,121 B both times. Container bytes differ (ENV.md §4.3), as always, and are not the criterion.

**Local GPU time on T12: ≈ 0.75 h, all of it $0.00.** Nothing left this machine; no rented machine was
considered, so §2 stays empty.

### 1.1d T13 — THE FINALS: the whole pilot at 8192×4096 @ 256 spp

Same machine and settings block as §1 (OptiX GPU-only, adaptive 0.01, OIDN on CPU, `tile_size` 2048,
`texture_limit` OFF, seed 0), **wrap pad 512** (ENV.md §12), scene `scene-full.blend` — the furnished
14-room apartment. **12 camera points × (colour pano + packed depth) + 1 top view + its room mask and
depth.** Everything below is measured; nothing is extrapolated.

| # | Date | Job | Points | Resolution | spp | Wall clock | Peak VRAM (device) | Peak host RAM | Cost |
|---|---|---|---|---|---|---|---|---|---|
| L21 | 2026-09-02 | T13 lighting A/B — the pendant-wattage decision, one variable, 3 points × 3 wattages (2 candidate scene builds + 9 probe renders) | cp-bed-2, cp-living, cp-dining | 2048×1024 | 32 | ≈ 9 × 19 s + 3 × 17 s build ≈ **3.7 min** | ~1266 MB | — | **$0.00** |
| L22 | 2026-09-02 | T13 **the finals, batch 1** — `render_tour.mjs --mode final --chunk 1`, 12 points | all 12 | 8192×4096 | 256 | **23,089.5 s = 6.41 h** (per point 1756.4–2096.8 s, mean 1924.1 s = 32:04) | **1427.91 MB** (34.9 % of 4096) | **6682.28 MB** | **$0.00** |
| L23 | 2026-09-02 | T13 top view + mask + registration + the complete batch report (all 12 points SKIPPED — the rerun-skip proof on the shipped code) | topview | 1018×1166 | 128 | **19.1 s** render, 31.5 s for the whole verifying pass | — | — | **$0.00** |
| L24 | 2026-09-02 | T13 art-panel probe — one point at probe settings to prove the material override renders before paying for a re-batch | cp-master-lobby | 2048×1024 | 24 | ≈ 17 s | ~1266 MB | — | **$0.00** |
| L25 | 2026-09-02 | T13 **the finals, batch 2** — the re-render forced by style lock **v1.3.0** (the `Ray Hopes` placeholder artwork, F-360-163) | all 12 | 8192×4096 | 256 | **PLACEHOLDER — filled at close** | 1427.91 MB | 6682.28 MB | **$0.00** |
| L26 | 2026-09-02 | T13 determinism re-proof after the T13 scene changes (`probe/check-determinism.py --room all`) — 2 builds + 2 dumps | n/a (scene build only) | — | — | ≈ 80 s | — | — | **$0.00** |

⚠ **One render was LOST and re-paid: ≈ 30 min.** The first batch ran as a harness *background task* and
was killed at 03:20 while `cp-dining` was in `Compositing` at 30:31. Re-launched **detached** (a
PowerShell `Start-Process`, not a child of the tool) it survived every later tool timeout. ⭐ *A
23-minute render must not be owned by the thing that is watching it.* The resume itself was free and
correct: `cp-entry` was `SKIP`ped on the manifest's own input key, so exactly one point was re-paid.

**Per-point figures, batch 1** (the batch-2 table is appended at close; the shape is identical):

| Point | Wall clock | pano.webp | depth.png | nadir error | depth-check (report mode) |
|---|---:|---:|---:|---:|---|
| cp-entry | 1756.4 s | 854,024 | 1,260,883 | 0 cm | 0 outside 2 cm |
| cp-dining | 1800.6 s | 1,123,598 | 1,065,575 | 0 cm | 0 |
| cp-living | 1941.5 s | 817,492 | 952,911 | −2 cm | 3 (worst 317.2 cm — all rays through an opening/GLASS) |
| cp-kitchen | 1812.8 s | 1,307,744 | 1,030,791 | 0 cm | 4 (worst 434.9 cm — same class) |
| cp-corridor | 2006.6 s | 966,042 | 1,277,546 | 0 cm | 0 |
| cp-mamad | 1828.9 s | 1,176,398 | 903,769 | 0 cm | 1 (16.0 cm) |
| cp-bed-2 | 1850.4 s | 1,056,566 | 1,011,166 | 0 cm | 1 (12.9 cm) |
| cp-master | 1873.4 s | 1,071,086 | 1,017,343 | 0 cm | 1 (12.9 cm) |
| cp-bath-main | 2096.8 s | 298,296 | 1,212,674 | −2 cm | 5 (worst 266.2 cm — same class) |
| cp-ensuite | 2087.1 s | 343,034 | 1,209,223 | 0 cm | 3 (worst 321.5 cm — same class) |
| cp-master-lobby | 2047.8 s | 1,000,370 | 1,294,806 | 0 cm | 0 |
| cp-wc | 1987.1 s | 233,700 | 1,144,864 | −2 cm | 1 (2.0 cm) |

⚠ The `depth-check` column is `--check-mode report`, and its failures are **an over-simple expectation,
not a bad render** — T07 already named this: the bbox-face rays assume an unobstructed path to a bare
wall, and in this apartment they leave through an opening or hit a glass pane instead. The per-point
bar that IS safe everywhere is the **nadir**, and it reads **12/12 within 2 cm** (the three −2 cm are
the rug: 1.38 m to a 1.78 cm rug under a 1.40 m camera, T12's own finding).

**What 8K cost that 4K did not.** Device VRAM barely moved again (1427.91 MB furnished 8K vs 1329.76 MB
furnished 4K, T12's L16) — T04's law holds a third time: the tile is what sits on the card. **Host RAM
is the 8K price: 6682.28 MB peak per frame**, which is why the batch is serialised and why `--chunk 1`
costs nothing worth having (a per-point Blender process re-pays only its ≈17 s scene sync).

### 1.1e Q01b — apartment 846 on the general-polygon path (2026-10-28, D-WQ-28)

Same machine and settings block as §1 (OptiX GPU-only, adaptive 0.01, OIDN on CPU, seed 0), **wrap pad
512**, `render_tour.mjs --mode draft` (4096×2048 @ 64 spp). Scene `tours/apt846/scene-full.blend`, built by
`build_scene.py` v1.2.0 + `plan_general.py` v0.1.0 from `tours/apt846/plan.json` (schema 0.2.0-draft, the
re-export of 18:52, sha256 `af672a01…`): 37 wall prisms, 75 facings, 14 pane-joint posts, 11 panes, 6 cut
openings with infills, the floor/ceiling fill, 9 flush luminaires, **no furniture** (Q01b scope). Every
run local and $0.

| # | Date | Job | Scene / point | Resolution | spp | pad | Wall clock | Peak VRAM (device) | Cost |
|---|---|---|---|---|---|---|---|---|---|
| L27 | 2026-10-28 | Q01b pilot regression (scratch) — the pilot built by v1.1.0 (baseline) and twice by v1.2.0, each dumped by `probe/dump_scene.py`: **decoded scene data byte-identical** (`probe/determinism/q01b-verdict.json`) | pilot-karnei, scene only | — | — | — | 24 s + 23 s + 23 s builds, ≈ 10 s per dump | — | **$0.00** |
| L28 | 2026-10-28 | Q01b 846 scene builds — 7 iterations + the determinism pair A/B (**dumps byte-identical**, 251 objects) | apt846, scene only | — | — | — | 9 × 4–6 s | — | **$0.00** |
| L29 | 2026-10-28 | Q01b QA previews (scratch, scratch manifest) — a Workbench top view and three Cycles previews; they found the façade slit, the coplanar-ceiling leak and the zone-bar sky leak (`GENERAL-POLYGONS.md` §4) | apt846 / cp-living | 1024×512 · 2048×1024 ×2 · top 1800² | 16 · 32 | 0 | 10.3 s · 25.2 s · 23.3 s · top ≈ 3 s | 634–754 MB | **$0.00** |
| L30 | 2026-10-28 | Q01b draft iterations superseded the same day (each re-rendered after a scene fix; the manifest keeps only the last) | apt846 / cp-living ×3, cp-kitchen ×1 | 4096×2048 | 64 | 512 | 190.1 · 180.1 · 189.4 s · kitchen 209.1 s | 915.2–915.3 MB | **$0.00** |
| L31 | 2026-10-28 | Q01b **the drafts of record** — one bounded `render_tour.mjs --points <one>` call per point, all on the final scene (182/182 checks); the top view is skipped by design for a general plan | apt846 / cp-living, cp-kitchen, cp-bedroomMain | 4096×2048 | 64 | 512 | **195.0 · 196.1 · 184.7 s** (+ a 6.2 s scene rebuild) | **915.25 MB** (host 1880 MB) | **$0.00** |
| L32 | 2026-10-28 | Q01b rerun-skip proof — the same three points again | — | — | — | — | **1.6 s, 0 rendered / 3 skipped** | — | **$0.00** |

**Per-point figures, the drafts of record** (sha256s in `tours/apt846/manifest.json`):

| Point | Wall clock | pano.webp | depth.png | nadir error | valid depth | sky px | note |
|---|---:|---:|---:|---:|---:|---:|---|
| cp-living | 195.0 s | 327,732 | 325,184 | 0 cm | 100.00 % | 3 | the façade top where the kitchen/dining zone bar meets the glass |
| cp-kitchen | 196.1 s | 343,010 | 367,295 | 0 cm | 100.00 % | 1 | the same junction |
| cp-bedroomMain | 184.7 s | 231,522 | 435,393 | 0 cm | 99.57 % | 35,819 | ⚠ plan data: `railing-11` (110 cm) is the bedroom's own east façade, so it opens to the sky above 110 cm |

**What a general scene costs.** The unfurnished 846 scene puts **915 MB** on the card at 4K (the furnished
pilot: 1330 MB) and ≈ 190 s a point — the same order as the pilot's drafts (T07: 112–199 s). By the pilot's
measured draft-to-final ratio (≈ ×12, L11 → L22) an 8K final is ≈ 35–40 min a point, ≈ 7 h for eleven,
point-chunked under `timeout` (Q05).

### 1.1f Q02 — all eleven 846 points on the corrected plan (2026-10-28, OQ-G1…G4)

Same settings as §1.1e. Plan sha256 `e2ad053f…` (doors at their traced centres, `facade-11`, roofed terraces,
`ground_offset_cm` −5120). Code: `build_scene.py` v1.2.0 (roofed rooms, the ground offset, `fixtures[]` prep),
`plan_general.py` (facing bridging ≤ 25 cm, pane-joint posts to 12 cm), `render_pano.py` **v0.3.0**.

⚠ **Ledger note (OQ-G4, accepted):** `render_pano.py` v0.3.0 changed its sha256, which is inside every render's
input key, so **every `tours/pilot-karnei` point and its top view are now re-keyed**: a pilot `render_tour.mjs`
run would re-render all of them (12 × ≈ 3 min draft, ≈ 6.4 h final). **Not re-rendered**; the pilot's scene
DATA is unchanged (dump-identical, L33).

| # | Date | Job | Scene / point | Resolution | spp | pad | Wall clock | Peak VRAM (device) | Cost |
|---|---|---|---|---|---|---|---|---|---|
| L33 | 2026-10-28 | Q02 pilot regression on the Q02 code (scratch): build + dump, **byte-identical to the v1.1.0 baseline** | pilot-karnei, scene only | — | — | — | 24 s + ≈ 10 s | — | **$0.00** |
| L34 | 2026-10-28 | Q02 846 scene builds (3, as the code moved) + one `fixtures[]` test build on a scratch plan (191/191) + two Workbench top views | apt846, scene only | — | — | — | 5 × 4–6 s | — | **$0.00** |
| L35 | 2026-10-28 | Q02 first pass, superseded the same hour: 10 points on the 18:29 scene, then cp-bedroom2 twice more while the two envelope fixes landed (bridging; the 12 cm posts) | apt846 / 10 points + cp-bedroom2 ×2 | 4096×2048 | 64 | 512 | 176.4–208.4 s a point, ≈ 2,370 s in all | 915.3 MB | **$0.00** |
| L36 | 2026-10-28 | Q02 **the drafts of record** — eleven bounded `render_tour.mjs --points <one>` calls on ONE scene (built 19:11:22 UTC, 185/185 checks) | apt846 / all 11 | 4096×2048 | 64 | 512 | **2,233.5 s = 37.2 min** (185.2–213.2 s a point) | **915.3 MB** (host 1880 MB) | **$0.00** |
| L37 | 2026-10-28 | Q02 rerun-skip proof — `render_tour.mjs tours/apt846 --mode draft`, all eleven | — | — | — | — | **3.1 s, 0 rendered / 11 skipped** | — | **$0.00** |

**Per point, the drafts of record** (sha256s in `tours/apt846/manifest.json`; nadir error 0 cm and zenith 1.30 m
— the ceiling or the deck — on all eleven):

| Point | Wall clock | sky px | note |
|---|---:|---:|---|
| cp-entrance | 199.8 s | 0 | o-10 / o-11 are behind the guest-bath block from here (hidden, not shut) |
| cp-kitchen | 210.6 s | 1 | |
| cp-dining | 212.2 s | 4 | |
| cp-living | 204.9 s | 3 | |
| cp-terraceLiving | 185.2 s | 984,151 (11.7 %) | the open band between railing and deck; the column 41 cm away fills a third of the view |
| cp-terraceBedroom | 210.7 s | 623,154 (7.4 %) | the same band |
| cp-bedroomMain | 201.7 s | 37,351 (0.45 %) | through the open terrace door o-13 |
| cp-wardrobe | 204.2 s | 0 | |
| cp-bathMain | 213.2 s | 1,824 (0.02 %) | through o-9, the bedroom and o-13 |
| cp-bedroom2 | 191.3 s | 2 | (3,691 before the bridging fix, 121 before the 12 cm posts) |
| cp-bathguest | 199.6 s | 0 | o-11 25/25 open from here |

### 1.1g Q02b — the plan's furniture as placeholder masses (2026-10-28)

Plan sha256 `48f21d90…` (the stable export: 19 `fixtures[]`, cp-bedroomMain and cp-bedroom2 moved off the beds).
`build_scene.py` builds each fixture as a `FIXTURE_<id>` prism (`height_cm` = the extent above `z_cm`, OQ-G6) in
`M_fixture_placeholder`. Final scene built 20:44:43 UTC, **223/223** checks.

| # | Date | Job | Scene / point | Resolution | spp | pad | Wall clock | Peak VRAM (device) | Cost |
|---|---|---|---|---|---|---|---|---|---|
| L38 | 2026-10-28 | Q02b fixture builds: a synthetic-fixture test and two dry builds of the export on scratch copies (191/191, 223/223), then 3 tour builds as the plan and the grey moved | apt846, scene only | — | — | — | 6 × 4–6 s | — | **$0.00** |
| L39 | 2026-10-28 | Q02b superseded drafts: cp-entrance + cp-kitchen on the 21:55 export, then all eleven on the stable plan with the first placeholder (0.62 grey) — measured too close to the wall white (174–194 vs 179–192 /255) | apt846 / 13 renders | 4096×2048 | 64 | 512 | 177.6–212.2 s each, ≈ 2,550 s in all | 915.3 MB | **$0.00** |
| L40 | 2026-10-28 | Q02b grey preview (scratch): cp-kitchen at 0.26 grey — fixtures 127–164 vs walls 171–186 /255 | apt846 / cp-kitchen | 2048×1024 | 32 | 0 | 25.8 s | 754 MB | **$0.00** |
| L41 | 2026-10-28 | Q02b **the drafts of record** — eleven bounded calls on ONE scene (20:44:43 UTC) | apt846 / all 11 | 4096×2048 | 64 | 512 | **2,129.8 s = 35.5 min** (175.7–212.2 s a point) | **915.34 MB** (host 1881 MB) | **$0.00** |
| L42 | 2026-10-28 | Q02b rerun-skip proof — all eleven | — | — | — | — | **3.0 s, 0 rendered / 11 skipped** | — | **$0.00** |

Per point (the drafts of record): nadir 0 cm and zenith 1.30 m on all eleven; sky px 0 · 1 · 4 · 3 · 984,151 (11.7 %,
the terrace band) · 623,154 (7.4 %, the terrace band) · 51,485 (0.61 %, through o-13) · 0 · 0 · 5 · 0 for cp-entrance,
kitchen, dining, living, terraceLiving, terraceBedroom, bedroomMain, wardrobe, bathMain, bedroom2, bathguest.

### 1.1h Q05 — the eleven 846 finals at 8K (2026-10-28, opened BEFORE the first chunk)

Scene `tours/apt846/scene-full.blend` as Q04 chose it (built 20:44:43 UTC, 223/223, plan `48f21d90…`), unchanged
for the whole card. **8192×4096 @ 128 spp** (`render_tour.mjs --mode final --samples 128`), wrap pad 512, adaptive
0.01, OIDN on CPU, seed 0, OptiX; **one point per `timeout 1800` call** (root rule 1: renders 1800 s per chunk once
`BASH_MAX_TIMEOUT_MS` is raised), foreground, one heavy run at a time, never while the viewer lane's headless
Chrome holds the machine. ⚠ **Why 128 and not the final of record's 256:** at 256 spp a point needs ≈ 2,150 s
(846 drafts ≈ 190 s × the pilot's measured ×12 draft→final ratio, L11 → L22), over the 1800 s bound, and a point
cannot be split without a render-region feature that does not exist; 128 spp ≈ 1,150–1,400 s fits with margin.
256 stays available the day a chunk may run 40 min or the region split is built (the main session's call).
Resumable: each point's manifest row (input key + output sha256s) is written when its final completes; the
draft `pano.webp`/`depth.png` stay in `renders/<point>/` until then (Blender writes at completion; a killed
chunk leaves the draft untouched). Local, **$0**. **128 spp is the final setting of record for this tour** — the
main session's ruling 2026-10-29, for all eleven points.

| # | Date | Job | Points | Resolution | spp | pad | Wall clock | Peak VRAM (device) | Peak host RAM | Cost |
|---|---|---|---|---|---|---|---|---|---|---|
| L43 | 2026-10-28/29 | Q05 **the finals** — `timeout 1800` chunks, one point each: **7 of 11 done**, then STOPPED (below) | 7 points | 8192×4096 | 128 | 512 | **7,996.8 s = 2.22 h** (1,023.8–1,259.3 s a point, 57–70 % of the bound) | **915.99 MB** | **6,248.6 MB** | **$0.00** |
| L44 | 2026-10-29 | Q05 two runaway chunks, cp-wardrobe: the harness moved each call to the background at **180 s** (the seven before it ran 17–21 min in the foreground); rule 5 — stopped, the process tree killed by PID (4 processes each), the draft untouched | cp-wardrobe | 8192×4096 | 128 | 512 | 2 × ≈ 180 s, discarded | — | — | **$0.00** |

**Per point, the finals of record** (sha256 of the files; the decoded-depth hash and every setting in each
`renders/<point>/pano.render.json`; nadir 0 cm on all seven):

| Point | Wall clock | depth.png sha256 | pano.webp sha256 |
|---|---:|---|---|
| cp-entrance | 1,135.4 s | `9fa8e6f6af2c5e1797315a595ad4ddd1f648d41bb473ff793a171155bef461a6` | `f48e5581a7ce3fa86d3c578a54227591e47356d905fc6a7157b3eafc463f3474` |
| cp-kitchen | 1,116.7 s | `6e43f1869e6a1f0c782bda6d7683f25713b4d9a329921f33a659cd7b43b3e676` | `a1d5b5e0af0b3f340e0b6f0d65ec11371cfc95fa59897f3a12367e261397b0c9` |
| cp-dining | 1,145.7 s | `3ef6ff548045f2cbcad4317e3a787fd4b76cbc0dd58ec09969a617a4fed4f8c4` | `579e903637a969cf04d0f430b2af2668377c778da1069b7af03992f394ec0240` |
| cp-living | 1,105.7 s | `4ef0f9a57f1d6a887ad08e69c09c51f2a036393468472df6c4d1871fd4cf0780` | `c747b85b09bfe20a9447558d6d80cc6ef00b4f13eba21f93471b70931db293f8` |
| cp-terraceLiving | 1,023.8 s | `999076348469a600e93741be5d815430611059229221eba5bccbc34f33d55c80` | `47a9c16a1eee610e54add67a3b143c12cd54f01df5bffce3b8a1a31395fb1eea` |
| cp-terraceBedroom | 1,259.3 s | `2626bb4a7defa561de17b5d2af21bb4418ffc9149af5bb08f959d33db93b71e0` | `158d466aef7a871dd906f80bedd5108a77ca6bee675ae241ce979c3bb7436a88` |
| cp-bedroomMain | 1,210.2 s | `232d024ce30248de0501d97ae4e4d79dfcb30ad5501f46302ee8ee2b14d10475` | `e6f49a99e5a03fe297ca986ce654a20e11359b0f6fc02453d16da842e11aaa22` |

The cp-terraceBedroom and cp-bedroomMain finals above were **superseded on disk 2026-10-29** by the §1.1i frame
drafts (each draft replaced its final only on completion); the two final files were kept outside the tree, and they
match a scene that no longer exists.

⚠ **Still on drafts (4096×2048): cp-wardrobe, cp-bathMain, cp-bedroom2, cp-bathguest, and since §1.1i
cp-bedroomMain and cp-terraceBedroom.** The main session runs them, one foreground call of ≈ 20 min each —
`timeout 1800 node pipeline/render_tour.mjs tours/apt846 --mode final --samples 128 --points <point>` with a
1,860,000 ms tool timeout — in a session that does not background a call at 180 s. ⚠ **Since the §1.1i rebuild every
point is stale by key** (`build_scene.py` and `plan_general.py` both changed): `--skip-if-clean` no longer skips the
five finals above that were not re-rendered, and the new frame is in sight of all five (§1.1i) — a run WITHOUT
`--points` re-renders them (≈ 1.6 h). Always name the points; whether those five are re-rendered is the main
session's call.

### 1.1i Q05b — the door-in-glass frame (2026-10-29, `plan_general.py` answer 2c)

The skin lane read o-13 as 190 cm wide for the plan's 132: the door is cut through facade glass, and a bare cut in
transparent glass shows no edge. `plan_general.py` v0.2.0 `door_glass_frames()` + `build_scene.py` v1.3.0 build a
frame in the WALL material in the cut pane's own line (o-13's door line runs 21–35 cm inside `facade-11`): two
6 cm posts centred on the cutter's sides, a 6 cm head centred on the 215 cm head, 7.39 cm deep (the glass's own
spread in the cut), clear 125.9 × 212 cm; no glazed leaf. Scene rebuilt **00:10:09 UTC**, **230/230** geometry checks
(+7: three heights, three footprints, the 2-D enclosure), the fill, cuts and infills identical to the 20:44:43
report; a second 846 build dumps identical with the four image paths normalised (`416c2513…`; raw, they differ only
in relative vs absolute texture paths, the scratch `.blend` sitting on another drive); the pilot's dump byte-identical
to its baseline (`6d8f9b88…`). Only cp-bedroomMain and cp-terraceBedroom were re-rendered, as DRAFTS at **32 spp**,
not the draft of record's 64: since L44 the harness backgrounds any call at 180 s, a 64-spp draft of these two points
takes 195–213 s, and 32 spp ran 120–126 s inside a `timeout 170` bound.

| # | Date | Job | Points | Resolution | spp | pad | Wall clock | Peak VRAM (device) | Peak host RAM | Cost |
|---|---|---|---|---|---|---|---|---|---|---|
| L45 | 2026-10-29 | Q05b scene work: the tour build, a second 846 build + two dumps (determinism), a pilot build + dump (regression), three Blender ray-cast probes of where the frame is in sight | apt846 + pilot-karnei, scene only | — | — | — | 3 builds × 5–9 s, 3 dumps ≈ 30 s, 3 probes ≈ 25 s | — | — | **$0.00** |
| L46 | 2026-10-29 | Q05b the two frame drafts — one bounded `render_tour.mjs --mode draft --samples 32 --points <one>` call each (`timeout 170`); rerun-skip proof: both SKIPPED in 1.2 s, the other nine manifest rows untouched | cp-bedroomMain, cp-terraceBedroom | 4096×2048 | 32 | 512 | **120.4 s + 126.3 s** (124.2 + 129.0 s a call) | **915.35 MB** | 1,880.73 MB | **$0.00** |

**Where the frame is in sight** (ray casts from each point to samples on the frame's faces, continued through glass;
extent at 8K): cp-terraceBedroom 2,360 × 2,635 px (0.6–1.8 m) · cp-bedroomMain 307 × 1,269 px · **cp-terraceLiving
137 × 630 px** (the whole frame, 4.0–5.5 m) · cp-dining 56 × 535 px · cp-living 24 × 580 px · cp-kitchen 37 × 349 px
(the left post, through the living room's double facade) · cp-entrance 4 × 257 px · cp-wardrobe, cp-bathMain,
cp-bedroom2, cp-bathguest: none. Draft sky counts: cp-bedroomMain 50,514 px (51,485 before: the head now covers a
little of the sky seen through o-13), cp-terraceBedroom 623,154 (unchanged); every nadir 0 cm.

### 1.1j Q05 completed from the main session (2026-10-29, 02:45–04:48)

The six points the engineer's lane could not finish (its calls were backgrounded after 180 s, machine rule 5): rendered by the main
session, one bounded foreground call each (`timeout 1800 node pipeline/render_tour.mjs tours/apt846 --mode final --samples 128 --points <one>`,
`PYTHONIOENCODING=utf-8`), nothing else heavy on the machine, every point PASS (nadir 1.6 m, 0 cm). The last two are on the framed-door
scene (`plan_general.py` v0.2.0); the five earlier finals (L43–L44) show no frame — OQ-G8 stays open. All eleven at 8192×4096, 128 spp.

| # | Date | What | Points | Resolution | Samples | Tiles | Wall clock | GPU peak | RAM peak | $ |
|---|---|---|---|---|---|---|---|---|---|---|
| L47 | 2026-10-29 | Q05 final, main session, one bounded call (02:45–03:02) | cp-wardrobe | 8192×4096 | 128 | 512 | **1,029.1 s** | ≤ 916 MB (not re-measured) | ≤ 6.2 GB (not re-measured) | **$0.00** |
| L48 | 2026-10-29 | Q05 final, main session, one bounded call (03:03–03:22) | cp-bathMain | 8192×4096 | 128 | 512 | **1,147.9 s** | ≤ 916 MB (not re-measured) | ≤ 6.2 GB (not re-measured) | **$0.00** |
| L49 | 2026-10-29 | Q05 final, main session, one bounded call (03:22–03:43) | cp-bedroom2 | 8192×4096 | 128 | 512 | **1,233.6 s** | ≤ 916 MB (not re-measured) | ≤ 6.2 GB (not re-measured) | **$0.00** |
| L50 | 2026-10-29 | Q05 final, main session, one bounded call (03:43–04:06) | cp-bathguest | 8192×4096 | 128 | 512 | **1,352.3 s** | ≤ 916 MB (not re-measured) | ≤ 6.2 GB (not re-measured) | **$0.00** |
| L51 | 2026-10-29 | Q05 final, main session, one bounded call (04:06–04:25) | cp-bedroomMain (framed door) | 8192×4096 | 128 | 512 | **1,129.4 s** | ≤ 916 MB (not re-measured) | ≤ 6.2 GB (not re-measured) | **$0.00** |
| L52 | 2026-10-29 | Q05 final, main session, one bounded call (04:25–04:48) | cp-terraceBedroom (framed door) | 8192×4096 | 128 | 512 | **1,356.9 s** | ≤ 916 MB (not re-measured) | ≤ 6.2 GB (not re-measured) | **$0.00** |

### 1.1k The furnished 846 (2026-10-29, D-WQ-36, build_scene v1.5.0 + general_furnish v0.1.0)

Scratch tour `tours/apt846-furnished/` (the shipped `tours/apt846/renders` untouched). Drafts at 4096×2048 @ **32 spp** (the brief), one bounded
foreground call per point (`timeout 540 node pipeline/render_tour.mjs tours/apt846-furnished --mode draft --samples 32 --points <one>`), nothing else
heavy on the machine. The scene: 53 catalog placements (24 models), 5 procedural assemblies, 4 interior doors + the dressed entrance door; 192/192
geometry checks; scene build 7–16 s. L53/L54 were on the first furnished scene (the entrance leaf still flush white); L55/L56 are the evidence renders.
Against the placeholder scene's 32-spp drafts (120–126 s, §1.1i) the furniture costs ≈ ×1.05–1.25 in time and ≈ +600 MB on the card.

| # | Date | What | Points | Resolution | Samples | Tiles | Wall clock | GPU peak | RAM peak | $ |
|---|---|---|---|---|---|---|---|---|---|---|
| L53 | 2026-10-29 | furnished draft, first scene | cp-living | 4096×2048 | 32 | 512 | **156.9 s** | 1,519 MB | 2.50 GB | **$0.00** |
| L54 | 2026-10-29 | furnished draft, first scene | cp-entrance | 4096×2048 | 32 | 512 | **149.8 s** | 1,519 MB | 2.50 GB | **$0.00** |
| L55 | 2026-10-29 | furnished draft, entrance door dressed (evidence) | cp-living | 4096×2048 | 32 | 512 | **140.0 s** | 1,519 MB | 2.50 GB | **$0.00** |
| L56 | 2026-10-29 | furnished draft, entrance door dressed (evidence) | cp-entrance | 4096×2048 | 32 | 512 | **127.9 s** | 1,519 MB | 2.50 GB | **$0.00** |

Projection for the eleven finals at 8192×4096 @ 128 spp on this scene: the placeholder-scene finals took 1,029–1,357 s a point (L43–L52); ×1.05–1.25
⇒ **≈ 1,100–1,700 s a point, ≈ 3.5–5 h for eleven, serialised, $0 local** — every point is over 540 s, so it runs in the 1800-s class (one point per
bounded call). No cloud machine is needed or proposed.

### 1.1 What those runs left on disk (`tours/pilot-karnei/renders/probe/`)

| File | Bytes | Keep? |
|---|---|---|
| `pano-8k.webp` | 1,353,452 | **yes** — the G0 artifact T05 loads |
| `depth.png` | 975,417 | **yes** — the metric substrate, lossless by contract |
| `pano-8k.render.json` · `pano-8k.render.log` | 11,315 · 33,503 | **yes** — the settings/timings/VRAM evidence |
| `pano-4k-draft.png` | 8,268,413 | ⚠ **the orchestrator's call**: the task names it a deliverable, but it is a *draft* regenerable in 108 s and it is 8.3 MB of git. Committing it once is defensible; so is a `.gitignore` line. ⛔ Not decided unilaterally here |
| `depth-4k-draft.png` · `pano-4k-draft.render.{json,log}` | 354,852 · 10,557 · 29,717 | yes (small) |
| `pano-8k.png` (lossless master) | 31,946,066 | **deleted after measurement** — see the hash table |

Total committed weight if the 4K draft stays: **≈ 10.6 MB**; without it, **≈ 2.4 MB**.

---

## 2. Cloud-GPU rentals — **NONE. This section is empty on purpose.**

**No machine has been rented on this track. $0.00 of the $10 soft / $15 hard cloud lane is spent.**
Local 8K was measured possible on the 4 GB card (§1 L3/L4: peak VRAM **1.37 GB**, no OOM, no
mitigation needed), so the last-resort lane was never approached.

Before any row is filled here, in this order:

- [ ] the render is genuinely impossible or uneconomic locally, with the local measurement to prove it
- [ ] the orchestrator/board has the number in writing (rail 3), and it is inside soft $10
- [ ] **this row is written and committed BEFORE the machine boots**
- [ ] the row names: job · provider + machine type · $/h · hour cap · who authorised · date/time started
- [ ] on completion: actual hours, actual cost, and the output hashes it produced

| # | Date opened | Job | Provider / machine | $/h | Hour cap | Actual hours | Cost | Authorised by | Output hashes |
|---|---|---|---|---|---|---|---|---|---|
| — | — | *(no cloud render has ever been run on this track)* | — | — | — | — | **$0.00** | — | — |
| C1 | 2026-11-04, opened before boot (branch `sandbox-worker`) | **feasibility spike, not a capacity rental**: build_scene + render_pano of apt846 `cp-kitchen` at the runner's draft setting 1024×512 @ 16 spp, `tools/sandbox-worker/spike.mjs --go` | Vercel Sandbox (Firecracker, **CPU only, no GPU**), project habait-flow, iad1, 8 vCPU / 16 GB (4 / 8 if the plan refuses 8), `persistent:false` | Pro rates (vercel.com/docs/sandbox/pricing, read 2026-11-04): $0.128 per active vCPU-h + $0.0212 per GB-h → at most **$1.36/h** (8 vCPU at 100 % + 16 GB) | **1.0 h** total session, 45-min sandbox timeout | **0.094 h** in 3 sessions (13.1 s + 17.4 s + 307.3 s); the team refused 8 vCPU ("should be <= 4"), so every session ran on **4 vCPU / 8 GB** | **$0.031 at Pro rates** (0.12 active vCPU-h + 0.79 GB-h); the 4-vCPU cap points to Hobby, where this falls inside the included quota and is billed **$0** | Eliran, 2026-11-04 ("שרת העבודה ירוץ ב-VERCEL", "אני רוצה את זה מוכן"), via session rnd-9d's brief | session 3 (`sapphire-greasy-zebra-iEPYPf`): pano.webp `b6ca4d2d…19cf`, depth.png `7899fbfd…91a3`; verdict PASS, 87.5 s Cycles CPU, nadir 0 cm → `Habait/tour360/tools/sandbox-worker/evidence/2026-11-04-c1/` |

⚠ Row C1 does not meet the first checklist item, and says so: the render IS possible locally (§1). The reason
for this rental is different: Eliran wants the portal's job executor to run in Vercel, not on his laptop, so the
question is whether it CAN, and at what cost. CPU, not GPU: Vercel Sandbox has no GPU.

---

## 3. Totals

| Lane | Spent | Cap | Left |
|---|---|---|---|
| Local compute | **$0.00** | n/a (time only) | — · T07 added ≈1.5 h (L7–L14) and T12 ≈0.75 h (L15–L20) of local GPU time · Q01b ≈0.45 h (L27–L32) · Q02 ≈1.3 h (L33–L37) · Q02b ≈1.4 h (L38–L42) · Q05 ≈2.3 h (L43–L44) · Q05b ≈0.1 h (L45–L46) · Q05 completed ≈2.0 h (L47–L52, the main session) · the furnished 846 ≈0.2 h (L53–L56), all of it $0 |
| Cloud GPU | **$0.00** | $10 soft / $15 hard (CONTRACT §16.3, board-wide) | $10.00 / $15.00 |
| Cloud CPU (Vercel Sandbox, §2 row C1) | **$0.031** at Pro rates ($0 billed if the team is on Hobby, inside the included quota) | the same $10 soft / $15 hard cloud lane | ≈ $9.97 / $14.97 |
| Generative APIs | **$0.00** | **zero calls exist on this lane by design** (S-V2-2) | — |

---

**Document control** — v0.9 · 2026-10-29 · opened by board `360-v2` T04, extended by T05 (L5), T06
(§1.1a, the whole-apartment scene's first render batch), T07 (§1.1b, the wrap pad + the resumable
batch CLI, L7–L14), T12 (§1.1c, the furnished scene + the ceiling-clip A/B, L15–L20) and Q01b (§1.1e,
apartment 846 on the general-polygon path, L27–L32, D-WQ-28) and Q02 (§1.1f, all eleven 846 points, L33–L37, with
the pilot re-key note) Q02b (§1.1g, the plan's furniture, L38–L42) and Q05 (§1.1h, the 8K finals, L43–L44, opened before its first chunk; 128 spp ruled the final setting) and Q05b (§1.1i, the door-in-glass frame, L45–L46) ·
author render-pipeline-engineer ·
companions: `ENV.md` §5.1 + **§12** (the wrap pad, measured), `../CONTRACT.md` §16.3/§16.5,
`../NOTES.md` F-360-118/123/124/125 + F-360-126…131, `qa-evidence/360-v2/t07/` + `t12/`,
`tours/pilot-karnei/manifest.json` (the per-point checkpoints), `tours/pilot-karnei/scene-full.report.json`
(T06's build report: 166/166 geometry checks, 12/12 camera-clearance checks).
