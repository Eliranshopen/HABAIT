---
name: feedback-scripts-and-secrets-hygiene
description: "Lessons in C:\\RnD: the Bash tool collapses doubled backslashes in heredocs (write scripts with the Write tool); every sub-agent brief that reads product folders must forbid opening .env files; never probe for a .env file even by name (blocked) — check key NAMES in the environment as booleans."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 40c3c5f2-e1ea-4dd3-baf1-ad71447227fd
  modified: 2026-11-16T12:52:04.823Z
---

1. On this Windows machine the Bash tool turns a doubled backslash inside a heredoc into a single one, so a Python string like "C:\\RnD\\tools" can reach Python as `C:\RnD\tools` and a `\t` becomes a TAB. That is how earlier sessions produced TAB-mangled paths in `Projects/Habait` (`memory.md`, `REPOINTED.md`, `exclude.txt`).

**Why:** a mangled path silently corrupts a register or a memory line, and the harness forbids invented facts.

**How to apply:** write any script that contains Windows paths with the Write tool into the scratchpad, use raw strings or forward slashes, and verify with a TAB scan after editing text files.

2. On 2026-11-03 a read-only reviewer sub-agent opened `Projects/Habait/habait-walkaround/.env` while reviewing docs; by root `CLAUDE.md` §8.1 that burned `FAL_KEY` and `MYARCHITECTAI_API_KEY` (OWED-013).

**Why:** a value in any transcript is burned and must be rotated by Eliran.

**How to apply:** every sub-agent brief that touches a project or product folder says "never open `.env*` or env backups; names only". See [[user-eliran-head-of-rnd]].

3. On 2026-11-16 a PowerShell call that only ran `Test-Path` on a `.env` path (to see whether a secrets file existed) was blocked by the permission system, and the whole command with it.

**Why:** the harness denies any access to `.env*`, existence checks included; that is the intended rail (root §8.1), not an obstacle to route around.

**How to apply:** never name a `.env` path in a command. To learn whether a key is available, check its NAME in the environment as a boolean, for example `[bool][Environment]::GetEnvironmentVariable('FAL_KEY','User')`, and report "set / not set" only. Where the secrets file lives is Eliran's to say ([[feedback-keys-and-paid-calls]]).

**2026-11-18, added after the QA of engine milestone 1.3:** a sub-agent brief must also say «never print an environment VALUE, names only, also when proving that a value is absent». A reviewer proved a free run's environment held no key by dumping every entry whose name looked like a key, and the dump carried the VALUE of the harness's own per-session token into an evidence file (and, when I read the file, into the transcript). **How to apply:** tell a sub-agent to print names and booleans only (`name: present/absent`, or `value equals the fixed word: true`); before staging any evidence file a sub-agent wrote, grep it for a key-like name followed by 24+ key characters and remove the value, noting the removal; file the event with secrets-steward (root §8.1).
