# 360walkaround V2 — render environment of record

**Dated:** 2026-09-01 · **Task:** board `360-v2` T01 · **Actor:** render-pipeline-engineer ·
**Spend:** $0.00 (local only; no cloud GPU touched — `RENDER-LEDGER.md` has no row for this task)
**Governs:** every Blender/Cycles stage of `V2-PLAN.md` §5 (stages 2 and 3).

This file is the **pinned, measured** answer to "what renders V2". Numbers here were measured on this
machine on the date above, not quoted from documentation. Where a number is an extrapolation it says so.

---

## 1. Machine

| | |
|---|---|
| OS | Windows 11 Pro 10.0.26200 |
| CPU | 11th Gen Intel Core i7-11850H @ 2.50 GHz (8C/16T) |
| GPU | **NVIDIA RTX A2000 Laptop GPU — 4096 MiB** |
| NVIDIA driver | **596.47** |
| Console codepage | cp1255 → **always `PYTHONIOENCODING=utf-8`** before any Python (root rail 7) |

## 2. Blender — install method and exact version

Installed **2026-09-01 via winget**, first attempt, no fallback needed:

```
winget install --id BlenderFoundation.Blender.LTS.4.5 -e --source winget \
  --accept-package-agreements --accept-source-agreements --disable-interactivity --scope user
```

| | |
|---|---|
| winget client | v1.29.290 |
| Package id | `BlenderFoundation.Blender.LTS.4.5` (the current LTS line; `BlenderFoundation.Blender` = 5.2.1 non-LTS, `…LTS.4.2` = 4.2.16 — **LTS 4.5 chosen deliberately**) |
| Package version | **4.5.10** |
| Installer | WiX MSI, `https://download.blender.org/release/Blender4.5/blender-4.5.10-windows-x64.msi`, SHA256 `38a3f6eed2da970ed14721f8312a8187487a35bb69a1f88bffaadb4e0612c957`, published 2026-05-19 (official Blender Foundation host — the only sanctioned source) |
| Install path | `C:\Program Files\Blender Foundation\Blender 4.5\blender.exe` |
| Blender reports | **`4.5.10 LTS`**, build hash `6dc0b208d1b5`, built 2026-05-19, branch `blender-v4.5-release`, Release |
| Bundled Python | **3.11.11** (`main, May 31 2025, 09:35:27` · MSC v.1929 64-bit AMD64) |

⚠ **`--scope user` had no effect** — the manifest offers only a machine-scope WiX MSI, so the install
went to `C:\Program Files\…` and required elevation. The shell was **not** elevated; the UAC prompt was
auto-approved and winget returned 0. On a machine where that prompt is *denied*, this install fails and
T01's sanctioned fallback applies (the official portable zip under `D:\AgentTeams\tools\blender\`).

⚠ **Blender is NOT on PATH** — the MSI adds nothing to the machine or user `Path` (verified by reading
both environment scopes). **Every invocation must use the full path.** `which blender` fails; that is
expected, not a broken install.

## 3. Render device — OptiX: YES

Cycles reports the backends `['NONE', 'CUDA', 'OPTIX', 'HIP', 'ONEAPI']` as available on this build, and
the A2000 is enumerated under **both CUDA and OPTIX**. The probe selects **OPTIX** (preferred) and falls
back to CUDA, then CPU.

**OptiX was not merely selected, it was used** — the render log emits
`Updating Geometry BVH … | Building OptiX acceleration structure`, which only the OptiX backend prints.
That log line, not the preference value, is the proof.

⚠ **Device-enumeration gotcha (measured):** `prefs.devices` is the **union of every backend's entries**
regardless of what `compute_device_type` is set to — the same A2000 appears twice (once `type='CUDA'`,
once `type='OPTIX'`) and the CPU is always in the list. Setting `compute_device_type = 'HIP'` on this
NVIDIA laptop still returns the same list. **Filter by `d.type == backend`**; enumerating `prefs.devices`
tells you nothing about which backend is active. `probe/hello-render.py::select_device()` does this
correctly — copy it, do not re-derive it.

## 4. The smoke test

`probe/hello-render.py` builds a cube-plus-ground scene from an **empty** file, selects OptiX, renders a
**512×256 equirectangular** Cycles pano **and the Z pass of the same frame in the same projection**, then
verifies its own output and writes `probe/hello-render.json`.

**The exact headless invocation line** (repo root as cwd; the script resolves its own paths off
`__file__`, so any cwd works):

```
PYTHONIOENCODING=utf-8 "/c/Program Files/Blender Foundation/Blender 4.5/blender.exe" \
  -b -P 360walkaround/pipeline/probe/hello-render.py
```

PowerShell form:

```
$env:PYTHONIOENCODING="utf-8"
& "C:\Program Files\Blender Foundation\Blender 4.5\blender.exe" -b -P 360walkaround\pipeline\probe\hello-render.py
```

**For pipeline stages add `--factory-startup`** (before `-P`) so the result cannot depend on whoever's
startup `.blend` or add-on set is on the machine. Optional probe args go after `--`, e.g.
`-- --res 4096x2048 --samples 64 --hybrid --device CUDA`.

**Result: exit 0.** Outputs in `probe/`:

| File | What |
|---|---|
| `hello.png` | 512×256 (2:1) equirect pano, 8-bit RGB |
| `hello-depth.exr` | the Z pass, 32-bit float **BW**, values in **metres** — lossless; T04 packs the real 24-bit RGB PNG |
| `hello-depth-preview.png` | normalised 8-bit depth, eyeballing only |
| `hello-render.json` | the machine-readable record of the last run |

### 4.1 Depth is real, radial metres — verified against known geometry

The camera sits at exactly **Z = 1.40 m** (V2's camera height), so the scene has analytic ground truth:

| Probe ray | Measured | Exact | Error |
|---|---|---|---|
| Nadir (straight down to the floor) | **1.400026 m** | 1.400 m | **0.0019 %** |
| Equator, into the cube's near face (the x = 2 plane) | **2.000075 m** | 2.000 m | **0.0038 %** |
| Row 64 of 256 (latitude −44.65°), onto the ground | **1.992172 m** | 1.99220 m | **0.0014 %** |

⭐ **The Cycles Z pass under a panoramic camera is the RADIAL distance from the camera origin along each
ray, in metres — not a planar depth.** That is exactly the quantity V2-PLAN §5.5's ruler needs
(`point = origin + dir × depth`), with **no conversion**. Confirmed against three independent rays.

⭐ **The equirect row↔latitude mapping is `lat = −90° + (row + 0.5)/H × 180°`, row 0 = BOTTOM = nadir**
(this is Blender's pixel-buffer order). The third row above matches the analytic value to six significant
figures, so this mapping is verified, not assumed. T04's packer and T05's decoder must both use it.

### 4.2 Timings — measured, `bpy.ops.render.render()` wall clock only

All at 32 samples, denoising **off**, seed 0, on the scene described above (2 objects, no textures).

| Resolution | Device | Wall clock | Cycles' own `Time:` | Cycles peak device mem |
|---|---|---|---|---|
| 512×256 | OptiX GPU — **cold** | **1.690 s** | 00:01.49 | 342.60 M |
| 512×256 | OptiX GPU — warm | **0.476 s** | — | 342.60 M |
| 2048×1024 | OptiX GPU | 1.693 s | — | 380.10 M |
| 4096×2048 | OptiX GPU | **5.787 s** | 00:04.44 | 436.10 M |
| 4096×2048 | OptiX GPU **+ CPU hybrid** | 6.426 s | 00:05.23 | (masked — see §5) |
| 4096×2048 | **CPU only** | 40.644 s | 00:39.37 | 96.09 M (host) |

Three things this table says, and one it does not:

1. ⚠ **Cold vs warm differs 3.5×** at the small size — the first OptiX render of a session pays kernel
   compile/load (NVIDIA's OptiX cache). **Report cold and warm separately** or an 8K number will be a
   lie by omission.
2. **GPU is ≈ 7.0× the CPU** on this machine (39.37 s → 4.44 s at 4K, Cycles time).
3. ⚠ **The CPU+GPU hybrid was ~18 % SLOWER than GPU-only**, not faster. On a trivial scene the CPU tile
   drags the schedule. Rail 6 names hybrid as a 4 GB mitigation — **it is a hypothesis to re-measure at
   8K on a furnished scene, not a setting to switch on by faith.**
4. ✋ **These timings do NOT extrapolate to 8K on a real scene.** 512×256 and 2048×1024 took the *same*
   wall clock, i.e. fixed scene-sync/startup cost dominates entirely at these sizes; and this scene has
   two untextured objects. T04 measures the real curve.

### 4.3 Determinism — the finding T04's manifest must be built around

Five identical runs (same script, same seed, same device) were hashed:

- ⛔ **`hello.png` is NOT byte-stable** — the file *length* changes run to run (130090 / 130093 / 130109 B),
  so the difference is genuine Monte-Carlo colour data, not metadata.
- ⭐ **The depth pixel data IS bit-identical** — 62,908 finite pixels compared across two runs:
  **0 differing floats, max |Δ| exactly 0.0**, and 0 differing after rounding to centimetres.
- ⛔ **…yet `hello-depth.exr` still hashes differently every run.** `cmp -l` says **exactly one byte
  differs**, at offset 67: it is the ASCII seconds digit of the EXR header's **`Date` attribute**
  (`2026/09/01 11:50:17` vs `…:19`). Blender stamps `Date` — and `RenderTime` right after it — into every
  EXR it writes.

**Consequences, binding on T04:**

- **Manifest rerun-skip keys on INPUT content hashes only** (`plan.json`, catalog, render settings, script
  version) — **never** on an output hash. Hashing an output would show drift on every identical re-render
  and re-trigger an expensive render, which is precisely the bug root `CLAUDE.md` §7 and rail 2 forbid.
- Where an output hash is *recorded* (rail 2's manifest rows, the RENDER-LEDGER's "output hashes"), hash
  the **decoded pixel data**, or strip `Date`/`RenderTime` first. For T04's packed depth PNG the values
  are bit-identical **and** quantised to centimetres, so its *pixel data* will be stable — hash that, not
  the container.
- Rail 1's "deterministic or it doesn't ship" is satisfiable at the **scene** layer (T03's procedural build
  from `plan.json` + catalog + seed) and at the **depth** layer. It is **not** satisfiable at the colour-pano
  byte layer, and no amount of seed-fixing will make it so. Say so in the contract rather than claiming it.

## 5. VRAM — 4 GB is the standing constraint

Measured, from Cycles' own device accounting (the `Mem:…, Peak:…` field of the render status line), on
the 2-object untextured probe scene:

| Resolution | Pixels | Cycles peak device mem |
|---|---|---|
| 512×256 | 0.13 Mpx | 342.60 M |
| 2048×1024 | 2.10 Mpx | 380.10 M |
| 4096×2048 | 8.39 Mpx | 436.10 M |

Fitting the last two: ≈ **8.9 MB per megapixel** of framebuffer above a ≈ 361 MB floor. Naively extended
to 8192×4096 (33.55 Mpx) that is **≈ 0.66 GB** — leaving roughly **3.3 GB of the 4 GB for geometry,
textures and BVH**, which is where a furnished apartment will actually spend it. **This is an
extrapolation from a scene with two untextured objects; treat it as a starting budget, not a measurement.**

Two measurement gotchas found while producing that table:

- ⚠ **`nvidia-smi --query-compute-apps=…,used_memory` returns `[N/A]`** for the Blender process on this
  laptop GPU (Windows WDDM does not expose per-process VRAM here). **Poll it and you will log nothing.**
  Cycles' own `Peak:` field is the number of record.
- ⚠ **In a multi-device (hybrid) run the reported `Peak:` is not the GPU's** — the hybrid 4K run reported
  `96.09 M`, identical to the CPU-only run, i.e. the host figure masked the device figure. **Measure VRAM
  in a GPU-only run.**

Two Blender 4.5 defaults that already help, confirmed by query, not by reading docs:

- ⭐ **`cycles.use_auto_tile = True` and `cycles.tile_size = 2048` are the DEFAULTS.** The 4096×2048 render
  logged `Rendered 1/2 Tiles` without being asked. So 8192×4096 auto-splits into **8 tiles of 2048²** out
  of the box — rail 6's "default to Cycles tiling" is already satisfied by stock settings; T04's job is to
  *tune* `tile_size` down if 8 tiles still OOM, not to switch tiling on.
- `cycles.use_denoising = True` with `denoiser = 'OPENIMAGEDENOISE'` is the default. **The probe disables
  it** to keep the smoke pure. T04 must decide it deliberately: GPU-side OIDN allocates additional VRAM
  and is a prime OOM suspect at 8K on 4 GB — check `cycles.denoising_use_gpu` before blaming the render.
- `texture_limit_render = 'OFF'` by default: full-resolution textures go to the device. This is the
  **first knob to reach for** if a furnished 8K scene OOMs — clamping to 2048 costs little at pano scale.

### 5.1 The 8K settings of record (T04 — measured, not planned)

All rows below were measured on 2026-09-01 by `pipeline/render_pano.py` v0.1.0 against T03's furnished
probe room (`tours/pilot-karnei/scene-probe.blend`, camera `cp-living`), GPU-only OptiX,
`--factory-startup`, seed 0. Full per-run records: `tours/pilot-karnei/renders/probe/*.render.json`
and `RENDER-LEDGER.md` §1.

| Item | Value | How measured |
|---|---|---|
| Final resolution | **8192×4096** (2:1) | V2-PLAN §5.3 — rendered, verified 8192×4096 on read-back |
| Draft resolution | **4096×2048** | V2-PLAN §5.3 — rendered |
| Samples (final / draft) | **256 / 64**, adaptive sampling ON, threshold **0.01** | both rendered; ⭐ 8K at **64 spp + OIDN was already clean at 1:1** on the hardest surfaces (dark leather, wood grain, a soft wall shadow) — 256 is the hero setting, **64 is the batch setting** and costs 3.0× less |
| `tile_size` of record | **2048** (Blender's default, `use_auto_tile` on) | 8192×4096 → **8 tiles**; ⭐ see the VRAM note below — the tile, not the frame, is what sits on the device |
| Denoising | **ON** · `OPENIMAGEDENOISE` · **CPU** (`denoising_use_gpu = False`, the default) | costs a **fixed ~2.5–3 min tail** on an 8K frame regardless of sample count (the denoiser runs once, on the full frame, after the last tile) |
| `texture_limit_render` | **OFF** (full-resolution textures reach the device) | never needed — no OOM occurred, so the first mitigation knob was never turned |
| Hybrid CPU+GPU: helps or hurts? | **Not used — GPU-only.** §4.2 measured it ~18 % SLOWER at 4K, and 8K removed the only reason to retry it (VRAM was never the constraint). ⚠ It also masks the device figure | the question §5.1 was reserved to answer: **answered NO** |
| Peak VRAM, furnished 8K pano | **1369.48 MB** of 4096 MB (33 %) | Cycles `Mem:…, Peak:…`, **render phases only**, GPU-only run |
| Wall clock, furnished 8K pano | **1403.98 s (23:24)** @ 256 spp · **470.29 s (7:50)** @ 64 spp | `bpy.ops.render.render()` wall clock, cold process each time |
| Wall clock, 4K draft (cold / warm) | **107.43 s / 112.75 s** @ 64 spp | two renders in one process; ⚠ warm is *slower* again (T03 saw the same) |
| Wall clock, full apartment batch | **≈ 3.5 h @ 256 spp · ≈ 1.2 h @ 64 spp** for the pilot's **9** camera points — an **extrapolation** (9 × the one-point figure), not a measurement | `plan.json` carries 9 `camera_points` for 14 rooms |
| OOM encountered? mitigation applied | **NO.** No mitigation applied, none needed | 8K rendered first try at stock tile/texture settings |

**Three things this table says that the earlier extrapolations could not.**

1. ⭐ **VRAM is a function of TILE SIZE and SCENE, not of output resolution.** 4096×2048 peaked at
   **1368.21 MB** and 8192×4096 at **1369.48 MB** — *+1.27 MB for four times the pixels*. With
   `use_auto_tile` on, Cycles renders 2048² tiles and spools the full-resolution buffer to the HOST
   (the log literally says `Reading full buffer from disk` before denoising). ⛔ So §5's
   "≈8.9 MB/Mpx of framebuffer on the device" is **superseded**: the framebuffer is not on the device
   beyond one tile. **8K on a 4 GB card is not the risk; a bigger catalog is** — the ~1.37 GB is
   textures + BVH for *five* CC0 models, and Phase 3 wants 40–60.
2. ⚠ **The host is where 8K costs.** Peak host RAM **5972 MB** for one 8K frame (vs 1940 MB at 4K).
   A batch runner must therefore serialise 8K renders — parallelising four of them on this 32 GB
   machine would be the real out-of-memory, and it would be RAM, not VRAM.
3. ⛔ **The `Mem:…, Peak:…` field stops meaning VRAM once the render session ends.** During
   `Finishing`/`Compositing` the same slot reports HOST result buffers: the 8K run logged
   `Peak:3524.18M` there while the true device peak throughout the eight tiles was **1369.48 MB**. A
   naive `max()` over the log overstates VRAM by **2.6×**. `render_pano.py::parse_render_log` excludes
   those two phases and records the post-render figure separately. (This is the sibling of §5's hybrid
   trap: same field, different lie.)

⚠ **Run-to-run variance on this laptop is ±5 %** (the same 4K draft measured 101.61 s and 107.43 s on
two separate cold processes) — thermal, not statistical. Quote a single timing as approximate.

## 6. Files

| Path | What |
|---|---|
| `360walkaround/pipeline/ENV.md` | this file |
| `360walkaround/pipeline/probe/hello-render.py` | the smoke script (also the reference implementation of device selection + equirect camera setup) |
| `360walkaround/pipeline/probe/hello-render.json` | the last run's machine-readable record |
| `360walkaround/pipeline/probe/hello.png` · `hello-depth.exr` · `hello-depth-preview.png` | the smoke outputs (~200 KB total, committed as evidence) |

## 7. API notes the next task needs

- **Panorama settings moved in Blender 4.3.** On 4.5 it is `camera_data.type = 'PANO'` +
  **`camera_data.panorama_type = 'EQUIRECTANGULAR'`** — a *Camera* property. The pre-4.3 path
  (`camera_data.cycles.panorama_type`) still exists on older builds; `hello-render.py` probes for both and
  records which it used (`"panorama_api": "camera.panorama_type (4.3+)"`).
- A panoramic camera looks along **−Z local**; `rotation_euler = (90°, 0, 0)` puts the equator on the
  horizon with **+Y world as the centre column**. Measured: **+X world lands at u ≈ 0.749**. T03 must pin
  the yaw convention explicitly in `plan.json` terms and not inherit it by accident. → **PINNED in §9.**
- Depth pass: `view_layer.use_pass_z = True`, then compositor `Render Layers.Depth → File Output`
  (OPEN_EXR / BW / 32-bit / ZIP). **Reading a pass off `bpy.data.images['Render Result']` is unreliable in
  background mode** — the File Output node, then loading the written file back, is the path that works.
- The File Output node **stamps a frame number** (`hello-depth-0001.exr`); rename to a stable name
  afterwards if the pipeline wants one.
- Background/sky rays return a huge sentinel in the Z pass (≫ 1e7). **Filter before computing statistics**
  or every min/max is garbage.

## 8. ⛔ Headless exit codes — a crash reads as a success (added by T03)

Measured on this machine, Blender 4.5.10, three one-line scripts run as `blender -b --factory-startup
-P <script>`:

| The script does | Blender's process exit code |
|---|---|
| `sys.exit(1)` | **1** ✔ propagates |
| `raise RuntimeError(...)` (uncaught) | ⛔ **0** — the traceback goes to **stderr** and Blender still reports success |
| `os._exit(1)` | **1** |

⛔ **So an uncaught exception in a pipeline stage is invisible to any caller that checks the return
code.** This was not theoretical: T03's first double-build run crashed on a cross-drive
`os.path.relpath`, wrote no `.blend` at all, and `subprocess.run(...).returncode` was **0**. The next
step then failed with a confusing "cannot read file" instead of the real error.

**Binding on every `-P` stage of this pipeline** (T04's render CLI, T07's batch CLI included):

1. Wrap the whole entry point in `try / except BaseException`, print the traceback, and
   `sys.exit(1)` yourself. `build_scene.py` and `probe/dump_scene.py` carry the reference footer.
2. A caller must ALSO assert the expected output file exists — exit 0 is necessary, not sufficient.
3. ⚠ On Windows, `os.path.relpath` **raises `ValueError`** when the two paths sit on different
   drives (`C:` scratch dir vs `D:` repo). Any path-relativising code needs the fallback.

## 9. The plan ⇄ world frame, PINNED (T03 — `build_scene.py` is the implementation of record)

`plan.json` is a **left-handed 2-D frame in centimetres** (SCHEMA v0.1.0 §1: +x right, +y **down** on
the drawing, origin = the outer NW corner). Blender is a right-handed Z-up world in metres. The
mapping adopted for the whole track, byte-for-byte as `build_scene.py::wx/wy/wz`:

```
world_X = +x_cm / 100        world_Y = -y_cm / 100        world_Z = +z_cm / 100
```

so **world +Y is plan-north** (up on the drawing) and handedness is preserved. `plan.json` itself never
carries a 3-D coordinate (SCHEMA §1), and this is the only place the flip happens.

**Yaw.** `yaw_deg` is a bearing in the plan frame: 0 = toward −y (plan-north), 90 = toward +x
(plan-east), clockwise, `[0,360)`. Under the mapping above:

```
dir_world      = ( sin(yaw), cos(yaw), 0 )
camera euler   = ( 90°, 0, -yaw_deg )        # Blender 'XYZ' order, R = Rz·Ry·Rx
sun lamp euler = ( 90° - elevation, 0, 180° - azimuth )   # a sun lamp's +Z points AT the sun
```

Verified in the built scene: the seed `cp-living` (yaw 180 = plan-south) renders with the south
glazing on the image's centre column, and plan-west lands to the **right** of centre — which is what a
person standing in the room facing south actually sees. Combined with §4.1's row↔latitude mapping,
the equirect convention is now fully pinned at both axes.

## 10. Furnished-scene numbers (T03 measurement — the first non-toy data point)

The probe living room: 32 objects, 23 meshes, 5 CC0 models with **2K** PBR textures, an HDRI world, a
sun and 2 interior emitters. Rendered GPU-only (OptiX), denoising on.

| | |
|---|---|
| Resolution | 1280×640 (0.82 Mpx), 96 samples |
| Wall clock | **16.65 s cold / 17.74 s warm** |
| Cycles peak **device** memory | **1110.08 M** |
| `cycles.denoising_use_gpu` | **False by default** — OIDN runs on the CPU |

Three things this says that T01's two-object extrapolation could not:

1. ⚠ **The furnished floor is ~1.11 GB at under 1 Mpx**, not T01's ≈361 MB. Textures and BVH, not
   framebuffer, are where a 4 GB card actually spends. Extending §5's ≈8.9 MB/Mpx framebuffer slope
   from here gives **≈1.4 GB at 8192×4096 for THIS one room** — comfortable, but the pilot has 14
   rooms and Phase 3 wants 40–60 catalog models. `texture_limit_render` (§5) is the knob.
2. ⭐ **GPU-side OIDN is NOT the 8K OOM suspect T01 flagged** — `denoising_use_gpu` is `False` out of
   the box, so the denoiser is already on the host. Cross that hypothesis off before T04 spends time
   on it.
3. ⚠ Warm was **slower** than cold here (17.74 s vs 16.65 s) — at ~17 s the run is long enough that
   thermal/clock behaviour dominates the kernel-load saving §4.2 measured at 512×256. Do not assume
   the cold/warm gap survives into real render sizes.

⛔ **Cycles cannot light a room through a refractive pane.** Sun → glass → floor is a caustic path
(L S D); Cycles cannot sample it with MIS, so the direct-light shadow ray is simply blocked. The
first probe render had a bright sky outside the door and **no sun patch on the floor**. The fix, in
`build_scene.py::make_glass_material`, is the standard archviz one: a `Mix Shader` driven by
`Light Path → Is Shadow Ray` that swaps in a **Transparent BSDF for shadow rays only** — camera and
reflection rays still see real glass. Any V2 scene with glazing needs this or its interiors are lit
only by whatever fill light someone happened to add.

## 11. Output-format notes (T04 — what the render stage actually writes)

- ⚠ **`scene.render.use_file_extension = False` suppresses the extension on File Output NODES too**,
  not only on the main render path: the node then writes `<prefix>0001` with **no suffix at all**.
  `render_pano.py::settle()` looks for both spellings. Cost me one crashed run to find.
- **WebP is a first-class render format on 4.5** (`image_settings.file_format = 'WEBP'` + `quality`).
  Measured at 8192×4096, quality **90**: **1,353,452 B**, and against the lossless PNG master of the
  same frame **PSNR 45.24 dB** (mean error 0.92/255, p99 5, max 30). For scale, the reverse-engineered
  reference product's own pano (`research/walkaround-reference/evidence/gfp/sample-pano-*.webp`) is
  **8192×4096 lossy VP8 at 857,432 B** — so ours is 1.6× its weight at the same resolution, which
  makes the G0 side-by-side a fair comparison rather than a quality-for-bytes trade.
  ⚠ The lossless 8K PNG master is **31.9 MB** — measure with it, do not commit it.
- **The depth PNG is written by our own encoder, not by Blender** (colour type 2, 8-bit, filter Sub,
  zlib level 6): ⛔ no colour-managed encoder may ever touch a depth byte. Measured at 8192×4096:
  **975,417 B** (the Sub filter is what makes a 100 MB raw buffer compress 100:1 — depth is smooth
  horizontally), packed in **2.5 s**. It round-trips byte-exactly through Blender's own libpng and
  through a dependency-free Node reader (`fixtures/check-depth-golden.mjs`).
- ⭐ **The Z pass is sample-FILTERED at silhouettes.** The same frame at 64 spp and at 256 spp gave
  depth maps differing in **35 pixels out of 33,554,432 (0.0001 %)** — all of them on object
  silhouettes (the door-frame corner, the plant's alpha-masked leaves), where the pixel filter blends
  foreground and background distances; the deltas there are large (9–81 cm). Everywhere else the two
  maps are **bit-identical**. ⛔ So a ruler must never trust a single edge pixel — the reference
  product's 3×3 neighbourhood probe (REPORT §2.4) is the right mitigation, and depth is otherwise
  sample-count-independent (a draft's depth is as accurate as a final's).
- **No wrap seam in the depth map**: |column 0 − column W−1| MAD = **0.00002 m**, which is **0.06×**
  the median adjacent-column MAD (V1's photo-scene seam measured 45.4× on the same style of
  instrument). An equirect render has no stitch, and the numbers say so.
- **Invalid depth = 0** (R=G=B=0) for sky/background rays: 33,367 of 33.5 M pixels here (they escape
  through the glazing where the Z pass sees the world background). ⛔ A decoder must test for 0 before
  using a reading — 0 means *no surface*, not *zero metres*. Recorded per point as
  `depth_invalid_value` beside `depth_encoding`/`depth_scale` (C-360-83).

## 12. The wrap pad — F-360-118's fix, measured (T07)

**The finding it answers** (`NOTES.md` F-360-118): an equirectangular frame wraps left↔right, but
**OpenImageDenoise and the WebP encoder are 2-D operators that do not know that**. At columns 0 and
W−1 their neighbourhood is truncated, so they clean the *interior* harder than the two edge columns
and the wrap-column discontinuity survives as denoiser residue. T05 measured the shipped 8K artefact
at **3.03×** the adjacent-column median and reported the miss honestly.

**The fix, in one line:** render `W + 2·pad` columns over `360 × (W+2·pad)/W` degrees of longitude —
real azimuthal *overlap*, not a mirror — denoise and encode with it, then crop the pad off in the
compositor. The pad angle is exactly `pad × 360/W`, so the surviving columns keep the unpadded
angular grid: `azimuth(col) = −180 + (col+0.5)·360/W` either way.

⭐ **Proven, not assumed** — the same point rendered at pad 0 and pad 64 (1024×512) and its two
**depth** maps differenced (depth is deterministic geometry, so a misalignment is loud):

| horizontal shift applied before differencing | mean \|Δ\| | pixels > 1 cm |
|---|---|---|
| −1 column | 0.5865 cm | 5.04 % |
| **0 (the crop as shipped)** | **0.0002 cm** | **2 px of 524,288 (0.0004 %)** |
| +1 column | 0.5867 cm | 5.04 % |

### 12.1 The pad-size and encode sweep (4096×2048, `cp-living`, 64 spp, the T03 probe scene)

Every row through the **same instrument T05 used** — `server/seam.mjs::boundaryDiscontinuity({x0:k,w:1})`,
one call per column, so the wrap pair and all 4,095 interior pairs are the same function on the same
population (`scripts/g0-seam-poles.mjs`). The pad-0 rows **reproduce T05's own controls** (2.35× / 3.53×
published; 2.3525× / 3.4978× here), which is what makes the comparison a measurement and not a claim.

| pad | encode | wrap MAD | interior median | **global ratio** | local ±64 | bytes |
|---|---|---|---|---|---|---|
| 0 | PNG (lossless) | 2.1737 | 0.9240 | 2.3525× | 2.7045× | 8,267,910 |
| 128 | PNG | 1.5765 | 0.9272 | 1.7002× | 1.9556× | — |
| 256 | PNG | 1.5228 | 0.9277 | 1.6414× | 1.8909× | — |
| **512** | PNG | **1.4313** | 0.9261 | **1.5455×** | 1.7723× | — |
| 0 | **WebP q90** | 2.0905 | 0.5977 | **3.4978× ✗** | 4.7290× | 359,372 |
| 128 | WebP q90 | 1.8787 | 0.6229 | **3.0162× ✗** | 4.2097× | 359,906 |
| 256 | WebP q90 | 1.8252 | 0.6071 | **3.0064× ✗** | 4.1969× | — |
| **512** | **WebP q90 — the setting of record** | **1.6616** | 0.5796 | **2.8669× ✓** | 3.7966× | ~360 KB |
| 128 | WebP q95 | 1.7303 | 0.7253 | 2.3858× ✓ | 3.5928× | 599,208 |
| 128 | WebP q98 | 1.7000 | 0.8431 | 2.0164× ✓ | 2.7286× | 945,964 |
| 512 | WebP q95 | 1.6561 | 0.7253 | 2.2834× ✓ | 3.5183× | 598,760 |

⭐⭐ **Quality moves the DENOMINATOR; the pad moves the NUMERATOR.** At pad 0 the wrap MAD is
2.091 / 2.167 / 2.130 at q90 / q93 / q95 — it does not move — while the interior median climbs
0.598 → 0.679 → 0.747. ⛔ *So buying the bar with WebP quality is a metric intervention, not a seam
fix.* The pad is the fix: it drops the absolute discontinuity **34 %** (2.174 → 1.431 lossless).
The pipeline therefore ships **`--wrap-pad 512` at the unchanged `--webp-quality 90`**, keeping T04's
weight parity with the reference product's own pano.

⭐ **The knee is at 128** (80 % of the whole 0→512 gain for a quarter of the extra pixels) — that is
the setting to fall back to if a render budget ever bites; it reads 3.02×, i.e. it does *not* clear
the bar on its own. The cost of the pad is pure pixels: `(W + 2·pad)/W` = **+25 % at 4096 wide,
+12.5 % at 8192**, no bytes and no VRAM (Cycles tiles at 2048 either way — measured 1369.22 MB at
pad 512, against T04's 1368.21 MB at pad 0).

### 12.2 Two controls that explain the residual — and one hypothesis they refuted

1. ⛔ **The residual is NOT Monte-Carlo noise.** The same pad-512 frame at **256 spp** measures wrap
   MAD **1.4259** against 64 spp's **1.4313** — a 0.4 % difference, i.e. sample count does not touch
   it. (Hypothesis was: the two edge columns are different pixels with independent noise, so more
   samples would converge them. Refuted by measurement.) What the pad *does* fix is the denoiser's
   truncated neighbourhood, and after it the wrap column is an **ordinary busy column**: its rank
   among the 4,095 interior pairs falls from **p99.46 (pad 0) to p95.95 (pad 512)** on the lossless
   encode.
2. ⭐ **The lossy ratio's denominator is structurally depressed, and the honest control is the
   BLOCK-BOUNDARY population.** VP8 codes 16×16 macroblocks with 4×4 transforms, so ~3 of every 4
   interior adjacent-column pairs sit *inside* one transform block and are correlated by the
   quantiser — while the wrap pair, at opposite ends of the buffer, never can be. Measured on the
   shipped pad-512 WebP: median MAD **0.851** at 16-px macroblock edges · **0.646** at 4-px transform
   edges · **0.531** strictly inside a block. On the **lossless** master of the same frame the three
   populations are identical (0.9266 / 0.9220 / 0.9272), which proves the split is the encoder's and
   not the picture's. Against the matched population the shipped wrap pair is **1.95×**, not 2.87×.
   ⚠ Reported as a diagnostic, never as the bar — the bar stays T05's global ratio, unmoved.

### 12.3 `dump_rgb.py` — the measurement plumbing, and why the sweep is free

There is no ffmpeg and no `sharp` on this machine, and `fixtures/check-depth-golden.mjs`'s reader is
PNG-only, so a WebP has no dependency-free decoder here. `pipeline/dump_rgb.py` decodes through
Blender's own libpng/libwebp with `colorspace_settings.name = "Non-Color"` (max distance from an
integer byte after ×255: **1.53e-05**, asserted per dump) and writes the raw RGB8 the seam instrument
eats. Its `--encode` mode re-encodes a lossless master to WebP at a list of qualities: ⭐ the control
re-encode at q90 came out **byte-identical (same sha256) to the WebP the render itself wrote**, so a
quality sweep costs **zero GPU time** and is still the render's own encoder.

### 12.4 The top view (minimap substrate)

One orthographic straight-down Cycles render of the whole floor with every `CEIL_*` object hidden,
plus a room-id mask **rasterised from `plan.json`** on the same grid — deliberately not rendered: a
renderer needs a colour-managed emission material per room (any view transform shifts the bytes) and
would anti-alias two rooms into a third colour that decodes to nothing. Alignment is then *measured*,
not asserted: the top view's own **depth pass** is the oracle (a straight-down ray reaches a wall top
at `cam_z − wall_height`), and the plan's walls are rasterised through the same affine and scored by
IoU over every integer shift in [−3,3]² — **the best shift must be (0,0)**. Registration, the colour
legend and the shift table travel in `renders/topview.registration.json` (T08 reads it).

### 12.5 ⛔ Blender's Crop node: two API traps that both render silently-wrong buffers

Measured on 4.5.10 while building the pad (each cost a render):

1. **The max is EXCLUSIVE** — the output is `max_x − min_x` wide. The inclusive form (`min_x + W − 1`)
   produced a 1023-px-wide buffer.
2. ⭐ **The Y pair is INVERTED and two of the four setters MOVE the window instead of resizing it.**
   A fresh node's defaults are `min_x=0 max_x=1920 min_y=1080 max_y=0` — **min_y > max_y by design**:
   width = `max_x − min_x`, height = **`min_y − max_y`**. Assigning `min_x` *translates* the window
   (max_x follows, keeping the width); assigning `max_y` translates the Y window the same way;
   `max_x` and `min_y` are the resize setters. So the landing order is **position first, size second,
   per axis**: `min_x` → `max_x`, `max_y` → `min_y`. The "obvious" `min_y=0, max_y=H` **reads back
   correctly through RNA** and still renders a **1-pixel-tall** frame. ⭐ *The RNA read-back is not
   the crop* — `pack_depth`'s size assertion is what caught it, twice.

---
## 13. The FURNISHED apartment — the numbers T12 added

The scene stopped being a shell: **56 imported catalog models + 11 luminaires across 13 rooms**, 30
distinct CC0 models (10 Poly Haven at 2K PBR, 20 Kenney/Quaternius rebound onto the locked palette).

### 13.1 Cost of furnishing, measured

| | bare shell (T07) | furnished (T12) |
|---|---|---|
| draft render, 4096×2048 @ 64 spp + pad 512 | 112–199 s/point | **156–188 s/point** |
| peak VRAM (device) | 1369.22 MB | **1329.76 MB** |
| peak host RAM | 2216 MB | 2216 MB |
| `.blend` on disk | 2.26 MB | **≈1.07 MB** (the catalog models are LOW-poly; T06's bare scene carried
the probe room's 70 k-tri plant) |

⭐ **Furnishing did not cost VRAM.** T04's finding holds: at 4K the driver is the TILE SIZE, not the
scene. A 30-model catalog with 2K PBR maps sits inside the same ~1.3 GB envelope as an empty shell, so
the 4 GB constraint is still a *tile* question, not a *content* question. (8K is a HOST-RAM question —
§5.1 — and that is unchanged too.)

### 13.2 The luminaire rule of record (T12, replacing T06's coverage light)

⛔ **Never hang a bare POINT light near a ceiling.** Illuminance goes as 1/d², and T06's 15 cm hang blew
the ceiling to pure white in every windowless room (T07 measured 1 unique colour, 255). The rule now:

* **rooms with a pendant MODEL** (living / bedroom / dining) — the model + a POINT bulb inside the shade,
  70+ cm below the slab. Rendered clip-free since T04.
* **every other indoor room** — a **flush AREA disc, unrotated, at ceiling − 2 cm**. A Cycles area light
  emits from its FRONT FACE only and an unrotated area light faces its local −Z, so it physically cannot
  light the ceiling above it. Energy `40 + 6 × area_m2` W. A separate thin disc mesh is the visible
  fixture (mild emission) so the zenith reads as a luminaire, not as a hot spot.
* the superseded emitter stays buildable behind **`build_scene.py --luminaire t06-point`** — the control
  that makes the fix a measurement (`qa-evidence/360-v2/t12/ab-ceiling.json`).

### 13.3 Catalog facts a future runner should not re-derive

* **`node catalog/fetch.mjs --seal`** fetched **57/57 rows, 112 files, 273.8 MB on disk** (Poly Haven
  dominates: one 2K model is ≈40 MB because each map is a 2K PNG). Kenney's 45 rows come out of ONE
  5.13 MB zip; poly.pizza serves single `.glb`s. **0 broken rows, 57/57 imported OK in 3.4 s** in ONE
  Blender process.
* ⭐ **Blender is the import test AND the measuring instrument**: bbox in cm, tri count, material names,
  image-texture count and a tall-mass "which way does it face" estimate, all in one pass. Doing it per
  asset would re-pay ~3 s of Blender boot 57 times.
* **glTF is Y-up**; the importer converts to Z-up, so a Kenney model's front is Blender **local −Y**.
  Confirmed by the six highest-confidence tall-mass measurements; the low-confidence `+Y` guesses are on
  box-shaped pieces where the heuristic has nothing to grip.
* **The Kenney kit carries no image textures at all** — named materials only. That is why the style lock
  can restyle it by NAME (`material_map`), and it is what closes `catalog/RESEARCH.md` §8's coherence risk.
* ⛔ **`bpy.ops.import_scene.gltf` leaves the mesh transforms on the objects**; `import_glb()` bakes each
  one into the vertices and drops the importer's empties, because every measurement in `build_scene.py`
  assumes local coordinates ARE world coordinates (T03's invariant).

---

**Document control** — v1.4 · 2026-09-01 · board `360-v2` T01 (§1–§7) + T03 (§8–§10) + T04 (§5.1, §11)
+ T07 (§12) + T12 (§13)
· author render-pipeline-engineer · $0 spent · Companions: `../V2-PLAN.md` §5/§7, `SCHEMA.md` v0.1.0,
`RENDER-LEDGER.md`, `../CONTRACT.md` §16.3/§16.5, `../NOTES.md` F-360-118,
`../research/walkaround-reference/REPORT.md` §2.4, root `CLAUDE.md` §2/§5/§7.
