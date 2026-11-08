# Copy summary (task 03) — 2026-11-03

- Real pass: one robocopy, 12:14:48 → 12:19:13 (4 min 25 s), exit 1 (= files copied), **1,965 dirs / 29,552 files / 30.401 GB, 0 FAILED, 0 mismatch, 0 extras**, 126 MB/s. Log: `logs/copy-all.log`. One file more than the dry run: the source changed during the window (live session).
- Snapshot anchors at copy time: source HEAD `506f63d`; source dirty entries 146 at research time (see verify report for the count at verification).
- Junk check after copy: 0 `node_modules` / `__pycache__` / `*.pyc` under the copy. Copy HEAD `506f63d`.
- `.env` copied as bytes, never opened.
- Executed by the main session (habait-asset-wrangler brief satisfied by this record).
