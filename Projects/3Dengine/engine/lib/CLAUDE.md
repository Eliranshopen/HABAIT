# engine/lib/ — small helpers
<!-- last-updated: 2026-11-18 -->

## What's here
| File | Purpose |
|---|---|
| `paths.mjs` | forward-slash paths, resolve against the engine home |
| `hash.mjs` | sha256 of a file (streamed async, or sync in 1 MB chunks), of a text |
| `atomic.mjs` | (0.3) `writeFileAtomic` / `writeJsonAtomic` (temp + rename, retried); `isTransient(e)`: a file error that passes by itself (`RETRY` = EPERM, EBUSY, EACCES and UNKNOWN, Node's name for a Windows error it does not know). (1.4) the file mutex `withFileLock(lock, fn)`: the lock is a FOLDER with one entry named after its holder; every hold begins with ONE exclusive step (a prepared folder renamed onto the path); a release, and the breaking of a stale hold, only move an entry OUT (`lockState`, contract 1.4 §11); `lockIsStale`: a dead pid, or further than `staleMs` from now |
| `run.mjs` | `run(cmd, args, {cwd, env, timeoutMs, input})` over `spawnSync` → `{status, stdout, stderr}`; always with a timeout |
| `json.mjs` | read and write JSON, append a row to a manifest array |
| `lock.mjs` | parse `name==version` lines of `requirements.lock.txt`; names normalised as pip does |
| `files.mjs` | list the files of a folder, recursively |
| `main.mjs` | `isMain(argv1, moduleUrl)`: a module runs its main only when executed directly |
| `proc.mjs` | `pidAlive(pid)`, `spawnDetached(script, args, {logFile, env, cwd})` (node, detached, output to a log file, never to the parent's stdout), `sleepSync(ms)` |
| `tool.mjs` | (2.1) what every wrapper of a pipeline tool shares: `startAndWait(cmd, logFile, { timeoutMs, signal })` (the tool's output into a log file; its end, the time limit or the signal), `killTree(pid)` (a tool is stopped with everything it started), `processesNaming(mark)` / `stopNaming(mark)` (the processes whose command line carries a job's mark `j<job id>`, and their stop) |

## Conventions / gotchas
- No helper reads the environment or the clock on its own: callers pass what they need, so the tests stay deterministic.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)
