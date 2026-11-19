# QA live: milestone 0.1 engine home (commit 5844920, main)

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Parity | PASS | m0.1 test a: `parity: 41 rows · PASS`; doctor pipeline row same |
| 2 | Catalog | PASS (partial form) | test b: `57/57 rows OK` (run with `--no-import-test`, report file restored); doctor `assets-catalog 57/57`. The plain `--verify-only` was not run by me: it rewrites the tracked fetch.report.json |
| 3 | Readiness | PASS | all ok, `MISSING keys FAL_KEY, OPENROUTER_API_KEY: missing` last line `READY EXCEPT KEYS (FAL_KEY, OPENROUTER_API_KEY)`, exit 0 |
| 4 | Port identity | PASS | test d: 1126 files in a63494a, differing 0 / missing 0 / extra 0. Exemption of CLAUDE.md and fetch.report.json is reasonable (generator-maintained; tool-rewritten). PORT-CHANGES.md does not exist, so no hidden exempt list |
| 5 | Tests, coverage | PASS | 62/62 pass; all files 99.74 % lines; 11 engine .mjs files, all in table; all-modules test imports every engine module; --test-coverage-lines=80 enforced |
| 6 | Secrets | PASS | doctor, doctor --json, env print names only; regex scan for fal_/sk-or- tokens in .runtime/ found nothing |
| 7 | Script contract | PASS (partial) | setup-env and bring-assets without --go: "nothing to do", exit 0, .runtime manifests unchanged (newest row 14:15:06, before my runs). Second --go run not exercised (forbidden); code returns early when nothing needed |

Notes: git status for Projects/3Dengine clean; no .env, .venv, node_modules, models tracked (3 apt846 .glb files are tracked, they are also in a63494a). Test d ignores any dir named models/hdri/.cache anywhere under pipeline (loose but the catalog/assets doctor checks cover models by sha256).

## Defects
No defects found. (Low observation: test b uses --no-import-test, so the plain card command is not exactly what the test runs.)

VERDICT: PASS
