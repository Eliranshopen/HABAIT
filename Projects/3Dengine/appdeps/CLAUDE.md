# appdeps/ — the two Node libraries the pipeline loads
<!-- last-updated: 2026-11-16 -->

## What's here
`package.json` and `package-lock.json` for `sharp` (0.34.4, image work) and `playwright-core` (1.56.1, the headless-browser checks), copied on 2026-11-16 from the backup of the environment that produced apartment 846. The pipeline tools load them from the folder named by `HABAIT_APP_DIR`, which the engine points here.

`node_modules/` is not in git: `node engine/cli.mjs setup-env --go` runs `npm ci` here.

## Conventions / gotchas
- Change a version only by changing the lock on purpose, and run the whole suite afterwards: the readiness command compares the installed versions with the lock.
- The engine's own code (`engine/`) uses Node built-ins only and does not load from here.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)
