---
name: web-design-guidelines
description: "Review UI code for compliance with Vercel's Web Interface Guidelines (accessibility, focus, forms, animation, typography, content, images, performance, navigation, dark mode, locale). Use when asked to review a UI, check accessibility, audit design or check a page against best practices."
allowed-tools: Read, Grep, Glob
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
  pinned: "2026-10-03, rules commit e3d624b of 2026-08-18 (D-DEV-UX-10)"
---

# Web Interface Guidelines

Review files for compliance with Web Interface Guidelines.

## How It Works

1. Read the pinned rules in `references/command-2026-08-18.md` (this folder)
2. Read the specified files (or ask which files or pattern)
3. Check against every rule in the pinned file
4. Output findings in the terse `file:line` format the rules specify

## Guidelines Source (pinned)

The rules are vendored, not fetched: `references/command-2026-08-18.md` is a dated copy of
`https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md` at commit `e3d624b` (2026-08-18), taken on
2026-10-03. Updating it is a deliberate act: download the new file under a new dated name, diff it against this one, then point this
section at it. Never fetch the rules at review time.

**Hebrew caveat.** The Typography and Content sections assume English: Title Case, curly English quotes, `&`, `...` endings do not apply to
Hebrew copy. On a Hebrew RTL surface read them through the house rules in `../hebrew-rtl-best-practices/SKILL.md` (gershayim ״ and geresh ׳,
no letter-spacing, dot dates).

## Usage

When a user provides a file or pattern argument:
1. Read the pinned rules
2. Read the specified files
3. Apply all rules from the pinned file
4. Output findings using the format specified in it

If no files specified, ask the user which files to review.
