# Harness focus, phase 4 — the prompt for a fresh Claude session
<!-- created: 2026-11-03 · main session · Eliran: "אתה רוצה לכתוב לי פרומפט לקלוד שיבצע את כל הדברים שאתה מציע?" -->

Paste everything below the line into a new Claude Code session started in `C:\RnD`.

---

You are the main session of the Habait R&D harness in `C:\RnD`. Eliran Shopen owns it. Answer him in Hebrew, briefly.

**Read first, bounded:** `CLAUDE.md` (root), `memory/HOT.md`, `development/plans/2026-11-03-harness-focus.md`, `docs/governance/OWED.md`. Grep `memory/INDEX.md`; never read it whole.

**Hard limits for this whole session:**
- No git of any kind (it is denied in settings anyway). Never open, print or grep any `.env*` file or env backup.
- Nothing is deleted. Move to `archive/` if something must go.
- Harness files are edited live, with no `.wt` folder. Any file under `Projects\` is changed only through `python scripts/wt.py open|add|close <name> … --go`, using one folder for the whole session: `harness-phase4`.
- Each script runs dry first, then with `--go`. Heavy commands run as `timeout N`.
- Stop and ask Eliran before anything that costs money, deploys, or touches legal or disclosure wording.

**Tasks, in order. Do 1–4, then report.**

1. **Re-point the two kept `habait-*` agents (OWED-009).** `.claude/agents/habait-deploy-qa.md` and `.claude/agents/habait-ux-judge.md` still cite `Habait/MVP/app` and other chat-MVP paths.
   - Find what they should point at in the real product (`Projects/Habait/habait-walkaround/`, e.g. `tools/deploy-vercel/`, `Habait/platform/`, `Habait/tour360/`). Cite the file that proves each new path.
   - If a duty has no counterpart in the product, mark it "not applicable since 2026-11-03" instead of inventing a target.
   - Update `docs/agent-team-org-chart.md` and the OWED-009 row.

2. **Skill frontmatter pass (OWED-018)** over `.claude/skills/*/SKILL.md`:
   - `description` must be one trigger sentence of ≤ 300 chars.
   - `allowed-tools` must be declared.
   - Replace `model: inherit` with `sonnet` or `opus`.
   - A model-invocable skill whose `SKILL.md` is over 150 lines moves its detail to `references/`.
   - A skill that writes files or registers gets `disable-model-invocation: true`.
   - **Skip** the three `skills-lock.json` skills (`improve-codebase-architecture`, `codebase-design`, `domain-modeling`) and any skill with an upstream `LICENSE` (vendored copies). List them in the report instead.
   - Regenerate `docs/skill-taxonomy.md` §2 from the frontmatter.

3. **`metrics.mjs` still runs git (OWED-022).** In `.claude/skills/sync-context/metrics.mjs`, sections [2], [5] and [6] should print `SUSPENDED (no git)` without calling git. Point `APP` at `Projects/Habait/habait-walkaround`. Run it once under `timeout 120` to prove it completes.

4. **Context files.** Run `python .claude/skills/sync-context/generate-cards.py --check`, then `--apply`, then `--check` again; it must end with 0 missing. Never overwrite a hand-written context file.

5. **Prepare, don't execute: key rotation (OWED-013).** From `docs/governance/SECRETS-LEDGER.md` §4, write a short Hebrew step list for Eliran covering `FAL_KEY` and `MYARCHITECTAI_API_KEY`: which console, what to click, which file he pastes the new value into himself, and the probe that proves the old key is dead.
   - Names only, never values.
   - Hand ledger updates to the `secrets-steward` agent.

**Close:** run the `/close-task` procedure (`scripts/wt.py close harness-phase4 --go` if a folder was opened, then `scripts/mem_entry.py … --go`):
- write one `runs/` entry and its INDEX line;
- update the OWED rows and their current-state line;
- update the plan row in `development/plans/CLAUDE.md`;
- update the harness-focus line in `memory/HOT.md`.

Then report to Eliran in Hebrew, in 10 lines or fewer:
- what was done, and what was verified (with the command or path);
- what was skipped and why;
- what is left for him: the rotation in the consoles, and installing the HOT hook from `docs/OWNER-PASTE.md` §b if it is still not in `.claude/settings.json`.
