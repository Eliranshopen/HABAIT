# engine/setup/ — the set-up scripts
<!-- last-updated: 2026-11-16 -->

## What's here
| File | Purpose |
|---|---|
| `env.mjs` | `planEnv` / `applyEnv`: create `.venv` on the base Python, `pip install -r requirements.lock.txt`, `npm ci` in `appdeps/`. A step runs only when its probe says it is needed; a row goes to `.runtime/setup-manifest.json` |
| `assets.mjs` | `planAssets` / `applyAssets`: the 57 model folders and the HDRI from `assets.source`, the pack zips from `assets.packSource`; each verified against its locked sha256 before and after the copy; a row goes to `.runtime/assets-manifest.json` |

Run them through the CLI: `node engine/cli.mjs setup-env [--go]`, `node engine/cli.mjs bring-assets [--from <dir>] [--go]`.

## Conventions / gotchas
- Dry-run by default; `--go` acts; a second run does nothing (root §5).
- `bring-assets` never downloads. A row missing in the source is a failure with a non-zero exit; a pack zip with a wrong hash at the target is overwritten.
- `--from` replaces only the source of the models and the HDRI; pack zips always come from `assets.packSource`.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)
