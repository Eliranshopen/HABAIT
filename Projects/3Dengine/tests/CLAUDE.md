# tests/ — the engine's tests
<!-- last-updated: 2026-11-18 -->

## What's here
| Folder | Context file | Purpose |
|---|---|---|
| `unit/` | [`unit/CLAUDE.md`](unit/CLAUDE.md) | unit tests of `engine/`; no environment needed |
| `milestones/` | [`milestones/CLAUDE.md`](milestones/CLAUDE.md) | one closing test per milestone, against the real environment |
| `helpers/` | [`helpers/CLAUDE.md`](helpers/CLAUDE.md) | the fakes the unit tests share; the clean-up every test with real processes uses (`cleanup.mjs`) |
| `fixtures/` | [`fixtures/CLAUDE.md`](fixtures/CLAUDE.md) | a page with a drawing, an empty page, a non-PDF, and the golden 846 sales-plan PDF; bytes, pinned by hash |
| `e2e/` | [`e2e/CLAUDE.md`](e2e/CLAUDE.md) | the end-to-end test of 0.2: browser → bridge → Pi (RPC) → a scripted fake model → the engine; `npm run test:e2e` (not part of `npm test`) |
| `stages/` | [`stages/CLAUDE.md`](stages/CLAUDE.md) | (1.2) the second tier: closing tests that run a REAL pipeline tool (a reading of the 846 drawing: 71 s quiet, minutes on a busy machine); since 1.3 also through a real job (`real-home.mjs`); `npm run test:stages` (not part of `npm test`) |
| `soak/` | [`soak/CLAUDE.md`](soak/CLAUDE.md) | the soak of 0.3: real runners on a temp home, killed at random moments, then live runners that look dead and are replaced; `npm run test:soak` (not part of `npm test`) |

## Commands
```
npm test            # everything: unit + milestones, fails under 80 % line coverage of engine/** and mcp/**
npm run test:unit   # unit only, no environment needed
node --test tests/milestones/m0.1.test.mjs   # one milestone's closing test
npm run test:stages # the closing tests that run a real pipeline tool (1.2 on); timeout 540 can cut it since 1.4: then `node --test tests/stages/m1.4.test.mjs` once, which goes on from its checkpoint
npm run test:e2e    # the end-to-end test of 0.2 (needs the Pi CLI, Chrome and the staged 846 site); E2E_LOG_DIR=<folder> keeps its evidence
npm run test:soak -- --kills 60 --freezes 20   # random kills, then takeovers of live runners that look dead
```

## Conventions / gotchas
- **The gate of every milestone** (Eliran, 2026-11-16; plan §7.2): its closing test, unit tests for the code it adds or changes, every earlier milestone's tests again, and at least 80 % line coverage. `npm test` is the fast part of that gate (the unit tests and the closing tests of 0.1 to 1.1, with the coverage bar); from 1.2 on the gate also runs `npm run test:stages` (contract 1.2 §8). Each tier runs ONCE (Eliran, 2026-11-18): a run is repeated only when it failed or was cut by its limit.
- Runner and coverage are Node's own (`node --test`, `--experimental-test-coverage`): no test dependency to install.
- A milestone test FAILS when the environment is missing; it never skips.
- `npm test` takes about 150 s on a quiet machine (434 tests since 1.4) and 215 to 280 s when another job holds the machine at 100 %: give it `timeout 300`. Under such load a cut, or a failed WAIT of a closing test, is time, not a finding: read which line failed, and run it again (milestone 2.1 owes these waits a look).
- A run that is KILLED from outside (a timeout, Ctrl-C) leaves the detached runners and static servers of its temp homes, because the `after` hooks do not run. List them, then stop only those pids: `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -match 'runner\.mjs|cli\.mjs serve' } | Select-Object ProcessId, CommandLine | Format-List"`.
- The coverage counts `engine/**` and `mcp/**` only. The code under `pipeline/` came from git as it is and is proven by the milestones of kind «קיים», which run the real tool and compare with the measured number.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)
