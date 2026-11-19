# REKEY — 846's recorded input hashes, CRLF → LF, once (WP-04)

**Board** `walkaround-production` · **Card** WP-04 · **Owner** render-pipeline-engineer · **Date** 2026-11-01 ·
**Cost** $0: no render, no Blender, no network · **Tool** `pipeline/tools/rekey-reports.mjs` v0.1.0 ·
**Pin** `360walkaround/.gitattributes`, the WP-04 block · **Branch** `claude/360-walkaround-progress-95e351`

**Resume rule:** a worker resuming WP-04 continues from the first row of §3 without a «done» mark. Every row is
«done». The tool is idempotent: a second `--rekey` finds 0 fields to move and reproduces all 22 keys.

## 0. The answer first

- **Seven recorded inputs are now pinned `text eol=lf`.** The plan named three CRLF-recorded scripts. Measuring found
  **five** recorded as CRLF bytes: `materials_kit`, `placement_templates`, `plan_general`, the style lock, and
  `render_pano.py`, which hashes itself into every point key. Two more, `build_scene` and `general_furnish`, were
  recorded as LF but unpinned, so an `autocrlf=true` clone wrote them CRLF.
- **Before this card, no fresh export was clean.** `git archive` of `875b4750` read `build_scene.py changed` under
  `autocrlf=true` and `placement_templates.py changed` under `false` (§5).
- **What changed.** In the 2 scene reports and the 2 manifests, only 64-hex values moved: 117 fields went to the LF
  form of the same content, and the 22 `input_key`s were re-derived the way `render_pano.py` derives them. Each file
  kept its byte length, and every changed byte sits inside a quoted hash. This was checked by the tool and again by
  an independent diff.
- **After the fix, both exports read the furnished scene CLEAN** (`git archive` of `49a13d1a` under `true` and
  `false`), and 9 of 11 point keys are clean in both (§5).
- **Two furnished points are stale for a reason that is not line endings** (§6 F1), so the card's «0 stale» is
  9 of 11, not 11 of 11.

## 1. Every recorded hash, mapped to its file

Collected from `tours/apt846{,-furnished}/{scene-full.report.json,manifest.json,plan.json}`. The eol state is
`git ls-files --eol` before this card.

| Recorded at | File | eol before | Recorded form | Action |
|---|---|---|---|---|
| `generator.script_sha256` | `pipeline/build_scene.py` | `i/lf w/lf attr/` | LF | pin only |
| `generator.placement_templates_sha256` | `pipeline/placement_templates.py` | `i/lf w/crlf attr/` | **CRLF** | pin + re-key |
| `generator.materials_kit_sha256` | `pipeline/materials_kit.py` | `i/lf w/crlf attr/` | **CRLF** | pin + re-key |
| `generator.plan_general_sha256` | `pipeline/plan_general.py` | `i/lf w/crlf attr/` | **CRLF** | pin + re-key |
| `generator.general_furnish_sha256` | `pipeline/general_furnish.py` | `i/lf w/lf attr/` | LF | pin only |
| `inputs.style_sha256`, `style.file_sha256` | `catalog/style-habait-modern.json` | `i/lf w/crlf attr/` | **CRLF** | pin + re-key |
| `settings.script_sha256` (every point row) | `pipeline/render_pano.py` | `i/lf w/crlf attr/` | **CRLF** | pin + re-key |
| `inputs.plan_sha256`, `plan_source.sha256` | `tours/<id>/plan.json` | `i/lf w/lf attr/text eol=lf` | LF | pinned since T08 |
| `inputs.material_board.sha256` | `Habait/tour360/apartments/apt846/material-board.json` | `i/lf w/lf attr/` | LF | ⚠ not pinnable from this tree (§6 F4) |
| `lighting.environment.sha256` | `pipeline/probe/probe-assets/hdri/qwantani_noon_puresky_4k.hdr` | gitignored binary | — | none: fetched and pinned by `assets.lock.json` |
| `catalog_models_verified[].sha256` (24) | `catalog/models/*/*.glb` | gitignored binary | — | none: fetched by `catalog/fetch.mjs` |
| `plan_meta.source_sha256` | `apartments/apt846/_local/plan/plan-crop.png` | gitignored binary | — | none |
| `outputs.{pano,depth}.sha256` | the renders | untracked media; outputs, not inputs | — | none |
| `input_key` | derived from the row's own `inputs` | — | — | re-derived (§4) |
| `plan_source.previous_sha256` | an earlier `plan.json` | historical | — | none |

The only readers of these fields are `render_tour.mjs:148-205` (scene freshness: plan, build_scene, placement_templates,
materials_kit, plan_general, general_furnish, the style lock, and the material board's WORDS) and
`render_pano.py:887-939` (the point key and its SKIP). The sweep was a grep of both trees, `Habait/tour360` included.

**Why CRLF.** The 846 scenes were built in this worktree, checked out 2026-10-13 under `core.autocrlf=true`.
`pilot-karnei`'s September report holds the LF hashes `3c25bedb…` (placement_templates) and `be613e60…` (the style
lock), so LF was the original form.

## 2. The pin

Seven lines in `360walkaround/.gitattributes`, each group under a MEASURED comment: the five generator scripts, the
style lock, and `render_pano.py`. `place_cameras.py` is not pinned: its version is recorded, not its hash (the hash
`render_tour.mjs:151` takes is never compared). The scene reports are not pinned: they are parsed, never hashed.
**Renormalization was content-neutral.** Every pinned file was already `i/lf` in the index, so
`update-index` through the new attributes stores the same blobs and the commit carries no diff for them. The pin
changes what a checkout writes, not what git stores.

## 3. The re-key: old → new per file, with the CRLF ↔ LF proof

**The proof**, run per file by `rekey-reports.mjs --rekey` before any write:
- (a) the old recorded value is the sha256 of the CRLF bytes (this checkout's working copy);
- (b) the new value is the sha256 of the LF bytes, which equal the committed `HEAD` blob byte for byte;
- (c) the LF bytes hold no CR;
- (d) CRLF equals LF with one CR before every LF, and LF equals CRLF with those CRs removed (byte-equal both ways).

So the two contents differ only by `\r`. The CR count equals the byte difference. A file with a lone CR or mixed
line endings is refused.

| # | File | CRLF bytes | LF bytes | CRs | old (CRLF, as recorded) | new (LF) | (a) (b) (c) (d) | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | `pipeline/placement_templates.py` | 92,707 | 90,984 | 1,723 | `3b82d7f7de340cdd…` | `3c25bedb5461f741…` | ✓ ✓ ✓ ✓ | «done» |
| 2 | `pipeline/materials_kit.py` | 24,217 | 23,774 | 443 | `63e3524616c439af…` | `7018a8bc12c75ae3…` | ✓ ✓ ✓ ✓ | «done» |
| 3 | `pipeline/plan_general.py` | 66,227 | 64,976 | 1,251 | `1b2cd674fdf87158…` | `9616d913b2889dde…` | ✓ ✓ ✓ ✓ | «done» |
| 4 | `catalog/style-habait-modern.json` | 72,727 | 70,336 | 2,391 | `8fae372304e3dcb5…` | `be613e60c659c989…` | ✓ ✓ ✓ ✓ | «done» |
| 5 | `pipeline/render_pano.py` | 90,413 | 88,783 | 1,630 | `11a429369bb32b8f…` | `13d695a96f8c8640…` | ✓ ✓ ✓ ✓ | «done» |
| 6 | `pipeline/build_scene.py` | 154,289 | 151,657 | 2,632 | `4fdb59b9…` (never recorded) | `49e485fc3b739df7…` (recorded) | ✓ ✓ ✓ ✓ | «done», pin only |
| 7 | `pipeline/general_furnish.py` | 63,396 | 62,285 | 1,111 | `a427e44c…` (never recorded) | `c0beb324f6abf89c…` (recorded) | ✓ ✓ ✓ ✓ | «done», pin only |

Full 64-hex values are in the tool's `--json` record. Re-run it any time: the CRLF form is derived from the LF
bytes, so the proof does not need a CRLF copy on disk.

## 4. What moved in the four files

| File | sha256 before → after | Fields re-keyed | `input_key` re-derived | Left as recorded (historical) |
|---|---|---|---|---|
| `apt846-furnished/scene-full.report.json` | `a921a8fa…` → `21dada19…` | 5 | — | 0 |
| `apt846-furnished/manifest.json` | `10c0d02b…` → `02220f67…` | 55 (11 rows × 5) | 11 of 11 | 2 |
| `apt846/scene-full.report.json` | `b168daa3…` → `6f2b71c3…` | 5 | — | 1 |
| `apt846/manifest.json` | `96b51b8a…` → `0634d38c…` | 52 (8 × 5 + 3 × 4) | 11 of 11 | 14 |

**The keys.** `input_key` = sha256(`json.dumps(inputs, sort_keys=True, ensure_ascii=False)`), from
`render_pano.py:905-907`. The tool first proved that its canonical form reproduces every one of the 22 recorded keys
from the row's own recorded `inputs`; it refuses to re-derive anything otherwise. On this machine, before the change,
`--check` also reproduced the 9 clean furnished keys from the scene report on disk. Old → new (12-hex prefixes):

| Point | apt846-furnished | apt846 |
|---|---|---|
| cp-living | `4ad03851fd6e` → `071190b6357c` | `625fc75a747b` → `8191c2f0e36d` |
| cp-entrance | `a4a7b511b5c3` → `dafd37605ece` | `95658c9a992e` → `aa325725dcc4` |
| cp-kitchen | `fa85a198ff30` → `b069c12af69e` | `2a8fe776d370` → `66db980d86c5` |
| cp-dining | `4b9907043a26` → `271a190bbdca` | `b42199055171` → `59b7295fbbf7` |
| cp-terraceLiving | `07399099c71d` → `386114723ea0` | `cb4705dfb9e8` → `40efb0ac249f` |
| cp-terraceBedroom | `66ed080289c7` → `ddcb45b71a6a` | `87c00692b81b` → `fba309bbe07d` |
| cp-bedroomMain | `50d511eeea9f` → `ced8291ca71e` | `29da79ded342` → `92852835f471` |
| cp-wardrobe | `640642f9c3ca` → `76253fe4ce4d` | `d493964b01b7` → `d3f4ba3a2607` |
| cp-bathMain | `2e44c8f02c15` → `437314860ded` | `7f3b595bbf81` → `da56d85e5fd3` |
| cp-bedroom2 | `281c80ef28f1` → `00bde92033e2` | `d03829407c17` → `03935a77e974` |
| cp-bathguest | `336dd0e637ab` → `f17cf60058d8` | `ac3a7398a8cc` → `f304bd5d1ef3` |

**Left as recorded.** These values are neither form of the file's current content; they belong to an older
version, and re-keying them would be a guess:
- furnished cp-living and cp-entrance: `general_furnish 69bc546a…` (v0.1.0);
- apt846's report and 8 rows: `build_scene 3213042d…` (v1.4.0);
- apt846's 3 oldest rows: `build_scene a19f5879…` (v1.3.0) and `materials_kit ee451c6b…` (v0.2.0).

**Untouched by design.** The untracked render sidecars (`renders/<id>/pano.render.json`) and
`renders/_render-tour.report.json` keep the pre-re-key values. They are the renderer's own account of each render,
and no code compares them: only `render_pano.py:933-939` compares a key, against the manifest row, and
`render_tour.mjs:296` only reports the sidecar's.

## 5. The fresh-export proof

**Method.** Each export is `git -c core.autocrlf=<x> archive --format=tar <commit> -- 360walkaround Habait/tour360 | tar -x`
into its own folder under `D:/AgentTeams/_walk-gate/lf-proof-2026-11-01/`. `git archive` applies `core.autocrlf` and
the archived tree's own eol attributes. Measured at `875b4750`: `materials_kit.py` carries 443 CRs under `true`
and 0 under `false`.

An export has no `.git`, no `renders/` and no `.blend`. The `.blend` is gitignored, so this worktree's copy was put in
place to stand in for the drive's copy (F3). Each command ran from the export root under `timeout 540`:
- scene: `node 360walkaround/pipeline/render_tour.mjs 360walkaround/tours/apt846-furnished --dry-run`
- points: `node 360walkaround/pipeline/tools/rekey-reports.mjs --check 360walkaround/tours/apt846-furnished`

Neither command starts Blender or renders anything.

| Export | CRs: materials_kit / build_scene / render_pano / style | Scene (`.blend` in place) | Point keys | A rerun re-renders |
|---|---|---|---|---|
| before `875b4750`, autocrlf=true | 443 / 2,632 / 1,630 / 2,391 | STALE — `build_scene.py changed since the scene was built` | 9 clean, 2 stale | **11** (a scene rebuild re-keys every point) |
| before `875b4750`, autocrlf=false | 0 / 0 / 0 / 0 | STALE — `placement_templates.py changed since the scene was built` | **0 clean**, 11 stale (`render_pano.py recorded 11a429369bb3…, on disk 13d695a96f8c…`) | **11** |
| **after `49a13d1a`, autocrlf=true** | 0 / 0 / 0 / 0 | **CLEAN** | **9 clean, 2 stale (F1)** | **2** |
| **after `49a13d1a`, autocrlf=false** | 0 / 0 / 0 / 0 | **CLEAN** | **9 clean, 2 stale (F1)** | **2** |
| either «after» export, bare (no `.blend`) | 0 / 0 / 0 / 0 | STALE — `scene-full.blend does not exist` | — | 11 (F3) |

**The output, verbatim** (after `49a13d1a`, autocrlf=false; the autocrlf=true export prints the same lines):

```
          scene: CLEAN — plan.json + the style lock + the material board + the generator scripts hash the same as the scene report (built 2026-10-29T15:30:18+00:00, checks 192/192)
  STALE  points.cp-living           key 071190b6357c… now b7189d261c8f…  outputs absent  (the scene differs from the report at generator.generated_utc, generator.general_furnish_version, generator.general_furnish_sha256)
  STALE  points.cp-entrance         key dafd37605ece… now d69b4ffa58b6…  outputs absent  (the scene differs from the report at generator.generated_utc, generator.general_furnish_version, generator.general_furnish_sha256)
  CLEAN  points.cp-kitchen          key b069c12af69e…  outputs absent
  … (cp-dining, cp-terraceLiving, cp-terraceBedroom, cp-bedroomMain, cp-wardrobe, cp-bathMain, cp-bedroom2, cp-bathguest: CLEAN)
  => 2 key-stale of 11 · scene CLEAN · outputs present 0/11 · a rerun would re-render 2 for a key reason
```

**Reading it:**
- The two «after» exports and this checkout (§7) compute byte-identical keys.
- `render_tour.mjs`'s dry-run summary says «11 rendered, 0 skipped», but that is not a point verdict. Dry-run starts no
  Blender, and the per-point SKIP is decided inside `render_pano.py:933-939`, which is what `--check` replicates.
- «outputs absent» is the media, not a key. `render_pano.py` also needs `renders/<id>/{pano.webp,depth.png}` on disk
  to SKIP, so they come from the drive with the `.blend`.
- Re-keying only the plan's three scripts would not have been enough. Under `false`, `render_pano.py`'s own hash keys
  every point stale, and the style lock keeps the scene stale.

## 6. Findings for the main session (not line endings)

- **F1 · two furnished points are stale on every checkout.** cp-living and cp-entrance are the 32-spp evidence
  drafts (ledger L55/L56) on the 15:11 UTC scene, with `general_furnish` 0.1.0. The scene of record was rebuilt at
  15:30 UTC with 0.1.1, and the other 9 points are 64-spp drafts on it. Re-keying those two to the current scene would
  be a false checkpoint, so they stay stale. The ruling is the main session's: re-render them as 64-spp drafts (about
  2 × 3 min local, $0, a Blender run outside this card), or carry them as known-stale.
- **F2 · `apt846` (the grey control tour) reads STALE on every checkout.** `build_scene.py` v1.5.0 (`49e485fc…`)
  replaced v1.4.0 (`3213042d…`) after this scene was built. A rerun rebuilds it and re-renders all 11 finals (about
  3.5–5 h at 8K). Its 3 oldest rows are from the v1.3.0 scene.
- **F3 · a clone carries no `scene-full.blend` (gitignored `tours/*/*.blend`) and no `renders/`.** `render_tour.mjs:161`
  reads a missing `.blend` as STALE, and a rebuild changes every point key, because `generated_utc` sits inside the
  key. The plan's drive list (§3.3, §4) names «the furnished renders» but not the `.blend`. Unless it travels too, a
  fresh clone re-renders all 11 whatever the line endings say. This concerns WP-22 (media pull) and WP-21.
- **F4 · the material board has no pin.** `Habait/tour360/apartments/apt846/material-board.json` is recorded LF and
  checked out LF, but `360walkaround/.gitattributes` cannot reach it. Its eol moves no key: the freshness test reads its
  words, and the point key copies the recorded value. Its pin belongs in the new repo's root `.gitattributes` (WP-21) or
  in a `Habait/tour360/.gitattributes`. Neither is this card's file.
- **F5 · the render ledger stops at L56.** The nine 64-spp furnished drafts of record (2026-10-29, 15:33–16:23 UTC)
  have no ledger rows. They are local and $0, but the track law logs every render.

## 7. This checkout's own copies

**Method.** This checkout's five CRLF copies were rewritten through the pin after commit `49a13d1a`. For each file:
1. `git diff --quiet -- <file>` (no content change);
2. `rm`;
3. `git checkout -- <file>`;
4. check that the working copy's sha256 equals the `HEAD` blob.

All five came out EQUAL with 0 CR. `build_scene.py` and `general_furnish.py` were LF already.

**Results:**
- `git ls-files --eol` now reads `i/lf w/lf attr/text eol=lf` for all seven pinned inputs and for the four pinned
  tour JSONs.
- `--check` on this checkout: the furnished scene is CLEAN, with 9 clean rows and 2 stale (F1), and the same keys as
  the exports. `apt846` is STALE (F2), as it was before the re-key.
- So the re-key changed no freshness verdict on the machine that recorded the hashes. It removed only the
  line-ending one, everywhere else.

---

**Document control** · v1.0 · 2026-11-01 · render-pipeline-engineer (WP-04):
- first commit `49a13d1a`: pin + re-key + tool + this file's §0–§4 and §6;
- second commit: §5 and §7, written from the measured exports.

Companions: `../../.gitattributes` (WP-04 block),
`../../pipeline/tools/rekey-reports.mjs`, `docs/walkaround-production/PLAN.md` §2.4 coupling 6, Appendix B (the LF
row), Appendix C lessons 13–14, §10 R10.
