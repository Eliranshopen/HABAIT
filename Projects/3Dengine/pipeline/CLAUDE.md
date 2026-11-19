# pipeline/ — the tools brought from git, unchanged but for what `PORT-CHANGES.md` lists
<!-- last-updated: 2026-11-18 -->

## What's here
The proven pipeline that produced apartment 846 (Rainbow), copied on 2026-11-16 from git commit `a63494a`, path `Projects/Habait/habait-walkaround/`, into the same layout: this folder stands where `habait-walkaround/` stood, so every relative path inside the tools still holds. 1,124 files plus `.gitignore` and `.gitattributes`; nothing was edited.

## Subfolders
| Folder | Files | Purpose |
|---|---|---|
| `360walkaround/` | 220 | the deterministic Blender plan → panorama pipeline (`pipeline/`), the furniture catalog and its checker (`catalog/`), tour data (`tours/`) |
| `Habait/tour360/` | 592 | the tour system: the tools (`tools/`: trace, run-project, skin, gates, build, package), the viewer, the house data of apartment 846 (`apartments/apt846`), `PROJECT-PACKAGE.md` (the parity registry), `fidelity.json` |
| `Habait/tools/` | 5 | `qa/responsive-gate.mjs`, `deploy/predeploy.mjs` |
| `Habait/studio-web/` | 15 | the portal front; here because the parity registry names five of its files |
| `Habait/engine/` | 100 | the earlier engine; here because the parity registry names `gates/plan_gate.py`. The tour pipeline does not call it |
| `Habait/platform/` | 192 | the apartment page and the platform shell that the package step and the local publish read; `tools/build_zip.mjs` builds the dollhouse. Brought without `tools/_unused/` |

Every folder below keeps the context file it had in the source tree.

## Conventions / gotchas
- **Do not edit files here.** The engine wraps these tools; it does not fork them. If a tool must change, list the file in `PORT-CHANGES.md` with the reason (one file is listed since milestone 1.2: one line of `Habait/tour360/tools/auto-trace.mjs`, the key's header on the direct OpenRouter route); the closing test of milestone 0.1 (`tests/milestones/m0.1.test.mjs`) compares every other file with its source in git, and a listed file with the git blob id that the list records for it: after another change of a listed file, write its new id there (`git hash-object <file>`).
- **The tools read their machine paths from the environment**: `HABAIT_PY`, `HABAIT_APP_DIR`, `HABAIT_ENV_ROOT`, `HABAIT_BLENDER_LOCK`, `HABAIT_ASSETS_ROOT`, `HABAIT_LEGAL_SRC`, `HABAIT_LEGAL_DIR`, `HABAIT_LEGAL_MD`, `BLENDER`, `CHROME`, `CHROME_PATH`. Always start a tool with the pointers from `node engine/cli.mjs env` (`engine/config.mjs` → `pipelineEnv`): they lead to the engine's own runtime.
- **Why not the built-in defaults:** they point at `C:/RnD/Projects/Habait/…`. That project was off the disk for part of 2026-11-16; its tracked files were restored from git the same evening, but its `tools/` folder (the Python environment, the Node libraries, the Blender bundle) is not tracked and did not come back.
- **Not in git on purpose** (ignored by `360walkaround/.gitignore`): `360walkaround/catalog/models/` (57 furniture models, 275 MB, CC0), `360walkaround/catalog/.cache/` (the pack zip), `360walkaround/pipeline/probe/probe-assets/hdri/` (the HDRI). They are sha256-locked in `catalog.manifest.json` and `style-habait-modern.json`; `node engine/cli.mjs bring-assets --go` restores them.
- `360walkaround/catalog/fetch.mjs` rewrites the tracked `fetch.report.json` on every run: restore it afterwards (the closing test does).
- `run-project.mjs --parity` must print `parity: 41 rows · PASS`.
- The apartment-846 literals in these tools are by design today; moving them into `house/` is milestone 5.4.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Source: git `a63494a`, `Projects/Habait/habait-walkaround/`
