---
name: 21st-ui-review
description: Review existing UI against the project's design context, accessibility expectations, responsive behavior, interaction quality, and high-confidence production rules. Use for UI audits, design QA, frontend review, accessibility review, consistency checks, or requests to find and safely fix visual defects. Trigger for requests such as "review this UI", "audit this page", "find design issues", "check responsiveness", or "fix obvious UX problems". Use 21st-ui-build when the request is primarily to create new UI.
disable-model-invocation: true
---
> Explicit-invocation only since 2026-10-22 — D-AUD-30 (Q 6.2, DEC-055; B-07, B-08): borrowed UI skill, archived only after /skill-doctor exists or on his word, D14 not ruled; invoke it by name (`/21st-ui-review`); the flag is reversible and nothing is archived.

# Review UI with evidence

Separate deterministic defects from subjective design recommendations.

## Workflow

1. Read `.21st/design.json`, project instructions, and the relevant source.
2. Run the deterministic review first:

   ```bash
   21st review <path>
   21st review <path> --json
   ```

3. Inspect the actual component composition and runtime states. Validate claims
   against code rather than inferring behavior from names.
4. Group findings into:
   - deterministic defects;
   - design-system drift;
   - accessibility and interaction defects;
   - responsive risks;
   - subjective product/design recommendations.
5. Prioritize by user impact and include exact file and line attribution.
6. Use `21st review <path> --fix` only for deterministic, low-ambiguity fixes.
   Never silently redesign, change brand identity, or alter product behavior.
7. Run relevant project tests after fixes and rerun review to prove resolution.
⚠ **Machine resource rules** (root `CLAUDE.md`; backed by the `test-guard` hook once it is installed per `.claude/hooks/README.md` — until then this line is the only rule): every test, build, server, browser or render command runs in Git Bash as `timeout N <cmd>` (tests 300 s, build/typecheck 540, servers/sweeps/renders 540 per chunk, 1800 once `BASH_MAX_TIMEOUT_MS` is raised) with the tool timeout above N; one heavy run at a time; foreground only; kill what you start by PID; never sleep-poll a backgrounded run — stop it, kill its tree, re-run bounded once.

## Review priorities

- semantic controls and accessible names;
- keyboard access, focus visibility, and dialog/menu behavior;
- image alternatives and meaningful labels;
- touch target size and disabled/loading states;
- responsive overflow and fixed-width assumptions;
- reduced-motion handling;
- hardcoded visual values that conflict with project tokens;
- duplicate primitives instead of existing components;
- inconsistent typography, radius, spacing, shadows, and icons;
- fake data, placeholder copy, or missing empty/error states.

## Output

Lead with actionable findings ordered by severity. Keep subjective suggestions
clearly labeled. If no issue is proven, say so and state what was inspected.
