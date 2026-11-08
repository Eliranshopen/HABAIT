<!-- Moved verbatim from .claude/skills/refero-design/SKILL.md lines 57-71 on 2026-09-08 — harness upgrade plan (docs/harness-upgrade-plan.md, not transferred), wave 6. Nothing rewritten; only CRLF normalised to LF. -->
<!-- Relocation note (2026-09-08): links written as references/<file>.md were relative to the skill root; from inside references/ read them as ./<file>.md. Body text left verbatim. -->

## MCP Setup

This skill is useful on its own as a research-first design methodology and craft reference.
Research is mandatory. Use Refero MCP for live style, screen, and flow research when
available; otherwise research with bundled craft references and any user-provided references.

Typical MCP setup:

```bash
claude mcp add --transport http refero https://api.refero.design/mcp
```

Then run `/mcp` in Claude Code and sign in to Refero when prompted.

For full tool details, read [references/mcp-tools.md](references/mcp-tools.md).
