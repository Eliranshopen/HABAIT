#!/usr/bin/env node
// .claude/skills/sync-context/verify-memory.mjs — the READ-ONLY memory verifier (rnd-reorg T14, CP-35)
//
// Walks the four memory layers and memory/INDEX*.md (the hot index + the cold archive) and prints a human-readable diff:
//   1. ORPHAN FILES  — a layer file (project/ runs/ listings/ agents/) with NO INDEX line pointing at it
//   2. DEAD LINKS    — an INDEX bullet whose link target does not exist on disk
//   3. LONG LINES    — (WARN) an INDEX bullet dated on/after the cutoff that exceeds the line cap
//   4. VOCAB         — (WARN) a layer file dated on/after the cutoff whose frontmatter actor:/type: is
//                      outside the controlled vocabulary (memory/README.md) — skipped while VOCAB is empty
// It changes nothing. Exit 1 only on class 1/2 findings; warnings never fail. ⛔ A GENERATOR is REFUTED
// (frontmatter carries no title/summary; 336 frontmatter blocks vs 932 bullets — not 1:1), so this
// tool reports for a human to fix by hand. Homed here, not in scripts/ (visualizer-scoped).
//
// Usage: node .claude/skills/sync-context/verify-memory.mjs [--quiet] [--strict]   (run from anywhere)
//   --strict adds class 5 (harness upgrade plan (docs/harness-upgrade-plan.md), wave 3, 2026-09-08):
//   the two size rails become FAILURES instead of prose — a post-cutoff INDEX line over the 400-char
//   cap, and a LIVE `memory/agents/<name>.md` (top level only; the month shelves in subdirectories are
//   exempt by design) over 200 KB, which is the rotation `/close-board` is supposed to have fired.
//   Without the flag the printed output and the exit code are exactly what they were before it existed.
//   It also prints a report-only census of the 6 largest live agents/ files (byte count + whether a month
//   shelf already holds their older content), so the rail can be audited without a separate `ls`.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const MEM = path.join(ROOT, "memory");
// 2026-10-22 (rnd-audit-2026-10 phase 4, D-AUD-18): the index is a hot file + a cold archive. Every memory/INDEX*.md is read
// (INDEX.md and INDEX-archive-*.md) so the orphan and dead-link checks cover both.
const INDEX_FILES = fs.readdirSync(MEM).filter((f) => /^INDEX(-[A-Za-z0-9._-]+)?\.md$/.test(f)).sort().map((f) => path.join(MEM, f));
const BOM = String.fromCharCode(0xfeff);
const LAYERS = ["project", "runs", "listings", "agents"];
const CUTOFF = "2026-08-28";        // rules below bind entries dated on/after this (date-gated, forward-only)
const LINE_CAP = 400;               // chars per NEW INDEX bullet — pointer + one hook; detail lives in the entry
// Controlled vocabulary (memory/README.md Rules, rnd-reorg T19 — forward-only from CUTOFF):
//   type  = one of five;  actor = `main-session` | an exact agent slug (derived live from .claude/agents/*.md,
//   never hard-coded) | `main-session + <slug>[, <slug>]` | `sub-agent: <context>` (only the prefix is controlled).
const AGENT_SLUGS = fs.existsSync(path.join(ROOT, ".claude", "agents"))
  ? fs.readdirSync(path.join(ROOT, ".claude", "agents")).filter((f) => f.endsWith(".md") && !f.startsWith("_") && f !== "CLAUDE.md").map((f) => f.slice(0, -3))
  : [];
const VOCAB = { actor: ["main-session", "sub-agent:", ...AGENT_SLUGS], type: ["run", "decision", "outcome", "learning", "deliverable"] };
const quiet = process.argv.includes("--quiet");
const strict = process.argv.includes("--strict");
const LIVE_AGENT_CAP = 200 * 1024;  // bytes — the rotation trigger for one live memory/agents/<name>.md

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.isFile() && e.name.endsWith(".md")) out.push(p);
  }
  return out;
}
const rel = (p) => path.relative(MEM, p).split(path.sep).join("/");

// ---- INDEX bullets + their link targets --------------------------------------------------------
const bullets = INDEX_FILES.flatMap((f) => fs.readFileSync(f, "utf8").replace(BOM, "").split(/\r?\n/).filter((l) => l.startsWith("- ")));
const linked = new Set();
const dead = [];
// 2026-11-04: also the two forms this harness writes — scripts/mem_entry.py's "→ `agents/x.md`" and the older "-> memory/agents/x.md"
const linkRe = /\]\((\.\/|\.\.\/memory\/)?((?:project|runs|listings|agents)\/[^)#\s]+)\)|\[\[((?:project|runs|listings|agents)\/[^\]|#]+)\]\]|`(?:memory\/)?((?:project|runs|listings|agents)\/[^`#\s]+\.md)`|(?:->|→)\s*(?:see\s+)?memory\/((?:project|runs|listings|agents)\/[^\s;,)]+\.md)/g;
for (const b of bullets) {
  for (const m of b.matchAll(linkRe)) {
    let t = m[2] ?? m[3] ?? m[4] ?? m[5];
    if (!t.endsWith(".md")) t += ".md";
    linked.add(t);
    if (!fs.existsSync(path.join(MEM, t))) dead.push({ target: t, line: b.slice(0, 120) });
  }
}

// ---- layer files ------------------------------------------------------------------------------
const files = LAYERS.flatMap((L) => (fs.existsSync(path.join(MEM, L)) ? walk(path.join(MEM, L)) : [])).map(rel)
  .filter((f) => !/\/_TEMPLATE\.md$|\/_about\.md$|\/README\.md$|(^|\/)CLAUDE\.md$/.test(f));   // CLAUDE.md = folder context files (root §8.6), not entries
const orphans = files.filter((f) => !linked.has(f));

// ---- forward-only warnings --------------------------------------------------------------------
const dateOf = (s) => (s.match(/\b(20\d\d-\d\d-\d\d)\b/) || [])[1] || "";
const longLines = bullets.filter((b) => dateOf(b) >= CUTOFF && b.length > LINE_CAP).map((b) => `${b.length} chars: ${b.slice(0, 100)}…`);
const vocabHits = [];
if (VOCAB.actor.length || VOCAB.type.length) {
  for (const f of files) {
    const head = fs.readFileSync(path.join(MEM, f), "utf8").replace(/^﻿/, "").split(/\r?\n/).slice(0, 12);
    const fm = Object.fromEntries(head.filter((l) => /^(date|actor|type):/.test(l)).map((l) => { const i = l.indexOf(":"); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; })); // 2026-09-03: split on the FIRST colon only and strip quotes — the controlled `sub-agent: <context>` form was being cut at its own colon (73 false WARNs)
    if ((fm.date || "") < CUTOFF) continue;
    if (VOCAB.actor.length && fm.actor && !VOCAB.actor.some((v) => fm.actor.startsWith(v))) vocabHits.push(`${f}: actor "${fm.actor}"`);
    if (VOCAB.type.length && fm.type && !VOCAB.type.includes(fm.type.trim())) vocabHits.push(`${f}: type "${fm.type}"`);
  }
}

// ---- report -----------------------------------------------------------------------------------
const say = (s) => { if (!quiet) console.log(s); };
say(`verify-memory: ${files.length} layer files · ${bullets.length} INDEX bullets (${INDEX_FILES.map((f) => path.basename(f)).join(" + ")}) · ${linked.size} distinct link targets`);
say(`\n[1] ORPHAN FILES (no INDEX line): ${orphans.length}`); orphans.forEach((o) => say(`    ${o}`));
say(`\n[2] DEAD LINKS (target missing): ${dead.length}`); dead.forEach((d) => say(`    ${d.target}\n       from: ${d.line}`));
say(`\n[3] WARN long INDEX lines (dated ≥ ${CUTOFF}, > ${LINE_CAP} chars): ${longLines.length}`); longLines.forEach((l) => say(`    ${l}`));
say(`\n[4] WARN vocab (dated ≥ ${CUTOFF}): ${VOCAB.actor.length || VOCAB.type.length ? vocabHits.length : "SKIPPED — vocabulary not yet set in this script"}`); vocabHits.forEach((v) => say(`    ${v}`));
const fail = orphans.length + dead.length;

// ---- [5] --strict: the two size rails become failures -----------------------------------------
let strictFail = 0;
if (strict) {
  const bigAgents = [];
  const agentsDir = path.join(MEM, "agents");
  if (fs.existsSync(agentsDir)) {
    for (const e of fs.readdirSync(agentsDir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (!e.isFile() || !e.name.endsWith(".md") || e.name.startsWith("_")) continue;   // month shelves live in subdirs — exempt
      const size = fs.statSync(path.join(agentsDir, e.name)).size;
      if (size > LIVE_AGENT_CAP) bigAgents.push({ file: `agents/${e.name}`, size });
    }
  }
  bigAgents.sort((a, b) => b.size - a.size);
  strictFail = longLines.length + bigAgents.length;
  say(`\n[5] STRICT size rails: ${longLines.length} INDEX lines over ${LINE_CAP} chars (dated ≥ ${CUTOFF}) · ${bigAgents.length} live agents/ files over ${LIVE_AGENT_CAP} bytes (200 KB)`);
  longLines.forEach((l) => say(`    LONG INDEX LINE  ${l}`));
  bigAgents.forEach((b) => say(`    OVERSIZE FILE    ${b.file}: ${b.size} bytes (${(b.size / 1024).toFixed(1)} KB) — rotate onto a month shelf (memory/agents/<name>/<YYYY-MM>.md)`));
  // Report-only census (2026-09-08, harness upgrade plan (docs/harness-upgrade-plan.md), wave 3) so the rail
  // is auditable at a glance: the largest live files with their exact byte counts and whether a month shelf
  // already carries their older content. It never touches the exit code — only the OVERSIZE FILE lines do.
  const census = fs.existsSync(agentsDir)
    ? fs.readdirSync(agentsDir, { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith(".md") && !e.name.startsWith("_"))
        .map((e) => {
          const shelfDir = path.join(agentsDir, e.name.slice(0, -3));
          const shelves = fs.existsSync(shelfDir)
            ? fs.readdirSync(shelfDir).filter((f) => /^\d{4}-\d\d\.md$/.test(f)).sort().map((f) => f.slice(0, -3))
            : [];
          return { file: `agents/${e.name}`, size: fs.statSync(path.join(agentsDir, e.name)).size, shelves };
        })
        .sort((a, b) => b.size - a.size || (a.file < b.file ? -1 : 1))
        .slice(0, 6)
    : [];
  say(`    census (report-only) — the 6 largest live agents/ files against the ${LIVE_AGENT_CAP}-byte cap:`);
  census.forEach((c) => say(`      ${c.file}: ${c.size} bytes — ${c.size > LIVE_AGENT_CAP ? "OVER CAP" : "under cap"}; ${c.shelves.length ? "shelved " + c.shelves.join(", ") : "no month shelf"}`));
}

console.log(`\nverify-memory: ${fail ? "FINDINGS " + fail : "CLEAN"} (orphans ${orphans.length}, dead links ${dead.length}; warnings ${longLines.length + vocabHits.length})`);
if (strict) console.log(`verify-memory --strict: ${strictFail ? "FAIL — " + strictFail + " size-rail offender(s)" : "PASS — both size rails clean"}`);
process.exit(fail + strictFail ? 1 : 0);
