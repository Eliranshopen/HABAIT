<!-- Moved verbatim from .claude/skills/ui-ux-pro-max/SKILL.md lines 308-334 on 2026-09-08 — harness upgrade plan (docs/harness-upgrade-plan.md, not transferred), wave 6. Nothing rewritten; only CRLF normalised to LF. -->

## Prerequisites

Check if Python is installed:

```bash
python3 --version || python --version
```

If Python is not installed, install it based on user's OS:

**macOS:**
```bash
brew install python3
```

**Ubuntu/Debian:**
```bash
sudo apt update && sudo apt install python3
```

**Windows:**
```powershell
winget install Python.Python.3.12
```

> **Note:** On Windows, use `python` instead of `python3` to run scripts (e.g., `python scripts/search.py` instead of `python3 scripts/search.py`).
