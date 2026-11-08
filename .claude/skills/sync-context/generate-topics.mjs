#!/usr/bin/env node
// .claude/skills/sync-context/generate-topics.mjs — writes memory/TOPICS.generated.md, the tag index
// over the four memory layers (harness upgrade plan (docs/harness-upgrade-plan.md), wave 3;
// department-memory T05; added 2026-09-08).
//
// One ## section per frontmatter tag, alphabetical; one line per entry (relative link + date).
// Entries whose frontmatter is malformed (no opening `---` on line 1, or no closing `---` inside the
// first 40 lines) are SKIPPED and counted — this tool never guesses a tag. No clock, no network:
// two runs over an unchanged tree are byte-identical.
//
// Usage: node .claude/skills/sync-context/generate-topics.mjs [--check]   (run from anywhere)
//        --check regenerates in memory and exits 1 with a diff summary if the file on disk differs.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const MEM = path.join(ROOT, "memory");
const OUT = path.join(MEM, "TOPICS.generated.md");
const LAYERS = ["project", "runs", "listings", "agents"];
const FM_WINDOW = 40;        // lines: how far a closing `---` may be
const REGEN = "node .claude/skills/sync-context/generate-topics.mjs";

const check = process.argv.includes("--check");
const read = (p) => { try { return fs.readFileSync(p, "utf8").replace(/^﻿/, ""); } catch { return null; } };
const rel = (p) => path.relative(MEM, p).split(path.sep).join("/");

function walk(dir) {
  const out = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.isFile() && e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

// ---- collect ----------------------------------------------------------------------------------
const files = LAYERS.flatMap((L) => walk(path.join(MEM, L)))
  .map(rel)
  .filter((f) => !/(^|\/)(_TEMPLATE|_about|README)\.md$/.test(f))
  .sort();

const byTag = new Map();     // tag -> [{file, date}]
const untagged = [];
const malformed = [];
for (const f of files) {
  const text = read(path.join(MEM, f));
  if (text == null) { malformed.push(`${f} — unreadable`); continue; }
  const L = text.split(/\r?\n/);
  if (L[0].trim() !== "---") { malformed.push(`${f} — no opening \`---\``); continue; }
  const close = L.slice(1, FM_WINDOW).findIndex((l) => l.trim() === "---");
  if (close < 0) { malformed.push(`${f} — no closing \`---\` within ${FM_WINDOW} lines`); continue; }
  const fm = L.slice(1, close + 1);
  const dateLine = fm.find((l) => /^date:/i.test(l)) ?? "";
  const date = dateLine.match(/\b(20\d\d-\d\d-\d\d)\b/)?.[1] ?? "";
  const tagLine = fm.find((l) => /^tags:/i.test(l));
  if (!tagLine) { untagged.push({ file: f, date }); continue; }
  const raw = tagLine.slice(tagLine.indexOf(":") + 1).trim().replace(/^\[|\]$/g, "");
  const tags = [...new Set(raw.split(",").map((t) => t.trim().replace(/^["']|["']$/g, "").toLowerCase()).filter((t) => t && t !== "..." && t !== "…"))];
  if (!tags.length) { untagged.push({ file: f, date }); continue; }
  for (const t of tags) {
    if (!byTag.has(t)) byTag.set(t, []);
    byTag.get(t).push({ file: f, date });
  }
}

// ---- build ------------------------------------------------------------------------------------
const tagNames = [...byTag.keys()].sort();
const entryCount = new Set([...byTag.values()].flat().map((e) => e.file)).size;
const L = [];
L.push("# TOPICS (generated) — the tag index over `memory/`");
L.push(`<!-- GENERATED — do not edit. Regenerate: ${REGEN} · verify: ${REGEN} --check -->`);
L.push("");
L.push(`${tagNames.length} tags · ${entryCount} tagged entries · ${untagged.length} untagged · ${malformed.length} skipped (no frontmatter block at line 1) · ${files.length} layer files walked (\`project/ runs/ listings/ agents/\`).`);
L.push("Tags come from the `tags:` frontmatter line only, lower-cased and de-duplicated per entry. One fact, one home — this index points, it never holds content.");
L.push("The skipped list is mostly the append-only agent logs, which carry per-entry frontmatter further down instead of one block at the top: this tool reads the top block only and never guesses a tag.");
L.push("");
for (const t of tagNames) {
  const rows = byTag.get(t).sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : a.file < b.file ? -1 : 1));
  L.push(`## ${t} (${rows.length})`);
  for (const r of rows) L.push(`- [${r.file}](./${r.file}) — ${r.date || "undated"}`);
  L.push("");
}
L.push(`## (untagged) (${untagged.length})`);
if (untagged.length) {
  for (const r of untagged.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : a.file < b.file ? -1 : 1))) L.push(`- [${r.file}](./${r.file}) — ${r.date || "undated"}`);
} else {
  L.push("- none — every walked entry carries a `tags:` line.");
}
L.push("");
L.push(`## (skipped — no frontmatter block at line 1) (${malformed.length})`);
if (malformed.length) { for (const m of malformed.sort()) L.push(`- ${m}`); } else { L.push("- none."); }
const body = L.join("\n") + "\n";

if (check) {
  const disk = read(OUT);
  if (disk === body) { console.log(`generate-topics --check: OK — memory/TOPICS.generated.md matches (${tagNames.length} tags, ${entryCount} entries)`); process.exit(0); }
  if (disk == null) { console.log("generate-topics --check: FAIL — memory/TOPICS.generated.md does not exist"); process.exit(1); }
  const a = disk.split("\n"), b = body.split("\n");
  const diffs = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) diffs.push(i + 1);
  console.log("generate-topics --check: FAIL — memory/TOPICS.generated.md differs from a fresh generation");
  console.log(`    on disk ${a.length} lines / ${disk.length} chars · generated ${b.length} lines / ${body.length} chars · ${diffs.length} differing lines: ${diffs.slice(0, 12).join(", ")}${diffs.length > 12 ? ", …" : ""}`);
  for (const i of diffs.slice(0, 3)) console.log(`    line ${i}\n      disk:      ${(a[i - 1] ?? "<absent>").slice(0, 160)}\n      generated: ${(b[i - 1] ?? "<absent>").slice(0, 160)}`);
  console.log(`    fix: ${REGEN}`);
  process.exit(1);
}

fs.writeFileSync(OUT, body, "utf8");
const top = tagNames.map((t) => [t, byTag.get(t).length]).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 10);
console.log(`generate-topics: wrote memory/TOPICS.generated.md — ${L.length} lines, ${body.length} chars`);
console.log(`    ${tagNames.length} tags · ${entryCount} tagged entries · ${untagged.length} untagged · ${malformed.length} skipped (no frontmatter block at line 1) · ${files.length} files walked`);
console.log(`    top 10 tags: ${top.map(([t, n]) => `${t} ${n}`).join(" · ")}`);
process.exit(0);
