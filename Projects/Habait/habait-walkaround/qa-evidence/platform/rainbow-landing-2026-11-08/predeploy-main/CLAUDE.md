# qa-evidence/platform/rainbow-landing-2026-11-08/predeploy-main/ — context file
<!-- last-updated: 2026-11-08 -->

## Purpose
The proof on a stage built by the real `Projects/Habait/tools/deploy-vercel/stage_flow.py --edit-api --studio` from live main after merge `df98ecd`.
`predeploy-verdict.json` is its built-in predeploy gate (PASS 32 page×size).
`result.json` and the PNGs are `Habait/platform/test/rainbow-landing.check.mjs` on that same stage (PASS 1440 + 390).
`hold-chrome.json` + `h1`/`h2` PNGs are `test/hold-chrome.check.mjs` and `flow.json` + `f1…f7` are `test/rainbow-flow.check.mjs` on the same stage (round 3, after merge `69cfd49`).
`no-price.json` + `p1…p6` PNGs are `test/no-price.check.mjs` on the stage after the price round (merge `6673204`).
The PNGs are git-ignored.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Rule: root `CLAUDE.md` §8.6 · Plan: `development/plans/2026-11-08-rainbow-landing.md`
