#!/usr/bin/env node
// .claude/skills/sync-context/generate-hot.mjs — writes memory/HOT.md, the always-read slice
// (harness upgrade plan (docs/harness-upgrade-plan.md), wave 3; added 2026-09-08).
//
// HOT.md is the bounded read-first entry point named in root CLAUDE.md section 0: <= 60 lines,
// GENERATED, never hand-edited. Since 2026-10-22 (D-AUD-41) it is also capped at 8,192 BYTES (enforced below) and carries four gauges:
// boards in flight, OWED open/total, check 17's last recorded state, the close backlog; INDEX.md's cold-archive stub bullet is skipped.
// Everything in it is derived FROM FILES ON DISK — there is no clock
// call anywhere in this script, so two runs over an unchanged tree are byte-identical and the
// "as of" stamp is the newest date the memory index itself carries.
//
// Sources:  docs/governance/OWED.md (the debt rows) · development/tasks/CLAUDE.md (Board status
//           table) · memory/INDEX.md (newest project/ and runs/ bullets).
// Usage: node .claude/skills/sync-context/generate-hot.mjs [--check]     (run from anywhere)
//        --check regenerates in memory and exits 1 with a diff summary if HOT.md on disk differs.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const OUT = path.join(ROOT, "memory/HOT.md");
const OWED_MD = path.join(ROOT, "docs/governance/OWED.md");
const BOARDS_MD = path.join(ROOT, "development/tasks/CLAUDE.md");
const INDEX_MD = path.join(ROOT, "memory/INDEX.md");
const VERSIONS_MD = path.join(ROOT, "docs/governance/VERSIONS.md");
const LINE_CAP = 60;
const BYTE_CAP = 8192;       // D-AUD-41 (2026-10-22): HOT.md is also capped in BYTES, enforced here (the generator trims, then fails if it still cannot fit)
const BACKLOG_DAYS = 30;     // a board in flight whose directory has no commit in this many days counts toward the close backlog
const BULLETS = 12;          // newest project/ and newest runs/ pointers
const OWED_SHOW = 5;         // the oldest open rows to name
const BOARD_SHOW = 6;        // active boards to name
const SHIPPED_WINDOW = 7;    // days: a SHIPPED board still counts as "this week"
const REGEN = "node .claude/skills/sync-context/generate-hot.mjs";

const check = process.argv.includes("--check");
const read = (p) => { try { return fs.readFileSync(p, "utf8").replace(/^﻿/, ""); } catch { return null; } };
const lines = (t) => (t == null ? [] : t.split(/\r?\n/));
const dateRe = /\b(20\d\d-\d\d-\d\d)\b/;
const dayNum = (d) => Math.floor(Date.parse(d + "T00:00:00Z") / 86400000);

// ---- truncate a bullet without breaking its leading markdown link -----------------------------
function clip(s, max) {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const link = t.match(/^\[[^\]]*\]\([^)]*\)/);
  if (link && link[0].length >= max - 1) return link[0] + " …";
  return t.slice(0, max - 1).trimEnd() + "…";
}

// ---- OWED rows --------------------------------------------------------------------------------
// A row starts with "| OWED-". Its State is the last non-empty cell; classification is by that cell
// only, and all three buckets are printed so the number can be audited against the file.
function owed() {
  const text = read(OWED_MD);
  if (text == null) return null;
  const asOf = (lines(text).find((l) => l.startsWith("**As-of:")) || "").match(dateRe)?.[1] ?? "";
  const rows = [];
  for (const l of lines(text)) {
    if (!l.startsWith("| OWED-")) continue;
    const cells = l.split("|").map((c) => c.trim());
    const id = cells[1];
    const opened = cells[2]?.match(dateRe)?.[1] ?? "";
    const what = cells[3] ?? "";
    const nonEmpty = cells.filter((c) => c !== "");
    const state = nonEmpty[nonEmpty.length - 1] ?? "";
    const bare = state.replace(/[*⛔⚠→\s]/g, " ").trim();
    let cls = "other";
    if (/^(CLOSED|PAID|DONE|MOOT|SUPERSEDED|CUT|WITHDRAWN)/i.test(bare)) cls = "closed";
    else if (/\bOPEN\b/i.test(bare) || /NOT SENT/i.test(bare) || /\bDUE\b/i.test(bare) || /\bPENDING\b/i.test(bare)) cls = "open";
    rows.push({ id, opened, what, cls });
  }
  const open = rows.filter((r) => r.cls === "open");
  const oldest = [...open].sort((a, b) => (a.opened < b.opened ? -1 : a.opened > b.opened ? 1 : a.id < b.id ? -1 : 1)).slice(0, OWED_SHOW);
  return { asOf, total: rows.length, open: open.length, closed: rows.filter((r) => r.cls === "closed").length, other: rows.filter((r) => r.cls === "other").length, oldest };
}

// ---- boards in an active state ----------------------------------------------------------------
function boards(asOf) {
  const text = read(BOARDS_MD);
  if (text == null) return null;
  const all = lines(text);
  const head = all.findIndex((l) => /^\|\s*Board\s*\|\s*Opened\s*\|\s*State\s*\|/.test(l));
  if (head < 0) return null;
  const out = [];
  for (let i = head + 2; i < all.length; i++) {
    const l = all[i];
    if (!l.startsWith("|")) { if (out.length) break; else continue; }
    const cells = l.split("|").map((c) => c.trim());
    if (cells.length < 5) continue;
    const name = cells[1].match(/`([^`]+)`/)?.[1] ?? cells[1].slice(0, 40);
    const opened = cells[2].match(dateRe)?.[1] ?? "";
    const state = cells[3];
    const bare = state.replace(/[*`]/g, "").toUpperCase();
    let label = null;
    if (bare.includes("EXECUTING")) label = "EXECUTING";
    else if (bare.includes("IN-PROGRESS")) label = "IN-PROGRESS";
    else if (bare.includes("LIVE")) label = "LIVE";
    else if (bare.includes("SHIPPED") && opened && asOf && dayNum(asOf) - dayNum(opened) <= SHIPPED_WINDOW) label = "SHIPPED-this-week";
    if (label) out.push({ name, opened, label });
  }
  if (!out.length) return null;
  const rank = { EXECUTING: 0, LIVE: 1, "SHIPPED-this-week": 2, "IN-PROGRESS": 3 };
  out.sort((a, b) => rank[a.label] - rank[b.label] || (a.opened > b.opened ? -1 : a.opened < b.opened ? 1 : a.name < b.name ? -1 : 1));
  return out;
}

// ---- the four gauges (D-AUD-41) ---------------------------------------------------------------
// In flight = the LEADING vocabulary word of a live-table State cell is EXECUTING or IN-PROGRESS (the earliest vocabulary
// word in the cell, so a SHIPPED or RESEARCH-ONLY cell that merely mentions EXECUTING is not counted); the History table is
// a second table and is never read. All of it derives from files and git, never from a clock: "30+ days" is measured against
// the INDEX as-of date.
const VOCAB = ["BUILT-NOT-SHIPPED", "DEPLOYED-PREVIEW", "OPEN-NOT-STARTED", "RESEARCH-ONLY", "PARTIAL-BOARD", "CLOSED-HISTORY", "IN-PROGRESS", "EXECUTING", "SHIPPED", "CLOSED"];
const leadingWord = (cell) => {
  const t = cell.replace(/[*`]/g, "").toUpperCase();
  let best = null;
  for (const w of VOCAB) { const i = t.indexOf(w); if (i >= 0 && (best === null || i < best.i || (i === best.i && w.length > best.w.length))) best = { i, w }; }
  return best ? best.w : "";
};
function inFlight() {
  const text = read(BOARDS_MD);
  if (text == null) return null;
  const all = lines(text);
  const head = all.findIndex((l) => /^\|\s*Board\s*\|\s*Opened\s*\|\s*State\s*\|/.test(l));
  if (head < 0) return null;
  const rows = [];
  for (let i = head + 2; i < all.length; i++) {
    const l = all[i];
    if (!l.startsWith("|")) { if (rows.length) break; else continue; }
    const cells = l.split("|").map((c) => c.trim());
    if (cells.length < 5) continue;
    const slug = (cells[1].match(/`([^`]+)`/)?.[1] ?? "").replace(/\/$/, "");
    rows.push({ slug, word: leadingWord(cells[3]) });
  }
  return { total: rows.length, flying: rows.filter((r) => r.word === "EXECUTING" || r.word === "IN-PROGRESS" ).filter((r) => r.slug) };
}
function closeBacklog(flying, asOf) {
  const stale = [];
  for (const b of flying) {
    let d = "";
    try { d = execFileSync("git", ["log", "-1", "--format=%cs", "--", `development/tasks/${b.slug}`], { cwd: ROOT, encoding: "utf8" }).trim(); } catch { return null; }
    if (!d || (asOf && dayNum(asOf) - dayNum(d) >= BACKLOG_DAYS)) stale.push({ slug: b.slug, last: d || "none" });
  }
  return stale;
}
function versionsLine() {
  const t = read(VERSIONS_MD);
  if (t == null) return null;
  const gen = (t.split(/\r?\n/)[0] || "").match(dateRe)?.[1] ?? "";
  const tot = lines(t).find((l) => l.startsWith("> **Totals**"));
  if (!tot) return null;
  return { gen, totals: tot.replace(/^>\s*\*\*Totals\*\*\s*[—-]\s*/, "").replace(/\s+/g, " ").replace(/[.\s]+$/, "").trim() };
}

// ---- newest INDEX bullets per layer -----------------------------------------------------------
function indexSlices() {
  const text = read(INDEX_MD);
  if (text == null) return { asOf: "", project: [], runs: [] };
  const all = lines(text);
  const grab = (layer) => {
    const s = all.findIndex((l) => new RegExp(`^##\\s+${layer}/`).test(l));
    if (s < 0) return [];
    const out = [];
    for (let i = s + 1; i < all.length; i++) {
      if (/^##\s/.test(all[i])) break;
      if (all[i].startsWith("- ") && !all[i].startsWith("- [archive 2026-05")) out.push(all[i].slice(2));   // the cold-archive stub is not an entry
    }
    return out;
  };
  const bullets = all.filter((l) => l.startsWith("- "));
  const dates = bullets.map((b) => b.match(dateRe)?.[1]).filter(Boolean).sort();
  return { asOf: dates[dates.length - 1] ?? "", project: grab("project"), runs: grab("runs") };
}

// ---- build ------------------------------------------------------------------------------------
const idx = indexSlices();
const ow = owed();
const bd = boards(idx.asOf);
const fl = inFlight();
const bl = fl ? closeBacklog(fl.flying, idx.asOf) : null;
const vr = versionsLine();
const L = [];
L.push("# HOT — the always-read memory slice");
L.push(`<!-- GENERATED — do not edit. Regenerate: ${REGEN} · verify: ${REGEN} --check -->`);
L.push(`*As of ${idx.asOf || "unknown"} (newest date carried by \`memory/INDEX.md\`). Generated from files, never from a clock.*`);
L.push("");
L.push("## Open now");
if (ow) {
  L.push(`**OWED** (\`docs/governance/OWED.md\`, As-of ${ow.asOf || "unstamped"}): ${ow.open} open · ${ow.closed} closed · ${ow.other} other, of ${ow.total} rows. Oldest open:`);
  for (const r of ow.oldest) L.push(`- \`${r.id}\` opened ${r.opened} — ${clip(r.what, 90)}`);
} else {
  L.push("**OWED**: `docs/governance/OWED.md` unreadable — read it directly.");
}
if (bd) {
  L.push(`**Boards** (\`development/tasks/CLAUDE.md\` Board status table) — active now:`);
  for (const b of bd.slice(0, BOARD_SHOW)) L.push(`- \`${b.name}\` — ${b.label} (opened ${b.opened})`);
  if (bd.length > BOARD_SHOW) L.push(`- …${bd.length - BOARD_SHOW} more active rows — see \`development/tasks/CLAUDE.md\``);
} else {
  L.push("boards: see development/tasks/CLAUDE.md");
}
L.push("**Gauges** (D-AUD-41; files and git only):");
L.push(fl ? `- boards in flight: ${fl.flying.length} of ${fl.total} live-table rows (leading State word EXECUTING or IN-PROGRESS; the History table is excluded)` : "- boards in flight: `development/tasks/CLAUDE.md` table unparsed");
L.push(ow ? `- OWED: ${ow.open} open / ${ow.total} total (\`docs/governance/OWED.md\`, As-of ${ow.asOf || "unstamped"})` : "- OWED: unreadable");
L.push(vr ? `- check 17 (\`VERSIONS.md\` generated ${vr.gen || "undated"}, its last recorded state): ${vr.totals} — live proof: \`check-versions.mjs --check\`` : "- check 17: `docs/governance/VERSIONS.md` has no Totals line");
L.push(bl ? `- close backlog: ${bl.length} of ${fl.flying.length} boards in flight with no commit in ${BACKLOG_DAYS}+ days (as of ${idx.asOf})${bl.length ? ": " + bl.slice(0, 4).map((b) => `\`${b.slug}\` ${b.last}`).join(" · ") + (bl.length > 4 ? " · …" : "") : ""}` : "- close backlog: not measured (git unavailable)");
L.push("");
L.push(`## Newest \`project/\` (durable facts — ${BULLETS} of ${idx.project.length})`);
const pStart = L.length;
for (const b of idx.project.slice(0, BULLETS)) L.push(`- ${clip(b, 180)}`);
const pEnd = L.length;
L.push("");
L.push(`## Newest \`runs/\` (append-only log — ${BULLETS} of ${idx.runs.length})`);
const rStart = L.length;
for (const b of idx.runs.slice(0, BULLETS)) L.push(`- ${clip(b, 180)}`);
const rEnd = L.length;
L.push("");
L.push("## Read next");
L.push("- root `CLAUDE.md` section 0 — the memory contract (bounded read-first, write-last)");
L.push("- `memory/README.md` — the full contract, layers and entry format");
L.push("- `docs/governance/OWED.md` · `docs/governance/DECISIONS.md` — the debt and decision registers");

// Hard cap: trim the runs list first, then the project list, so the ceiling is never a surprise.
for (const [start, end] of [[rStart, rEnd], [pStart, pEnd]]) {
  let last = end;
  while (L.length > LINE_CAP && last > start) { L.splice(--last, 1); }
}
const bytesOf = () => Buffer.byteLength(L.join("\n") + "\n", "utf8");
for (const [start, end] of [[rStart, rEnd], [pStart, pEnd]]) {
  let last = end;
  while (bytesOf() > BYTE_CAP && last > start) { L.splice(--last, 1); }
}
if (bytesOf() > BYTE_CAP || L.length > LINE_CAP) { console.error(`generate-hot: cannot fit memory/HOT.md in ${LINE_CAP} lines / ${BYTE_CAP} bytes (${L.length} lines, ${bytesOf()} bytes) — shorten the fixed blocks`); process.exit(1); }
const body = L.join("\n") + "\n";

if (check) {
  const disk = read(OUT);
  if (disk === body) { console.log(`generate-hot --check: OK — memory/HOT.md matches (${L.length} lines, cap ${LINE_CAP}; ${Buffer.byteLength(body, "utf8")} bytes, cap ${BYTE_CAP})`); process.exit(0); }
  if (disk == null) { console.log("generate-hot --check: FAIL — memory/HOT.md does not exist"); process.exit(1); }
  const a = disk.split("\n"), b = body.split("\n");
  const diffs = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) diffs.push(i + 1);
  console.log(`generate-hot --check: FAIL — memory/HOT.md differs from a fresh generation`);
  console.log(`    on disk ${a.length} lines / ${disk.length} chars · generated ${b.length} lines / ${body.length} chars · ${diffs.length} differing lines: ${diffs.slice(0, 12).join(", ")}${diffs.length > 12 ? ", …" : ""}`);
  for (const i of diffs.slice(0, 3)) {
    console.log(`    line ${i}\n      disk:      ${(a[i - 1] ?? "<absent>").slice(0, 160)}\n      generated: ${(b[i - 1] ?? "<absent>").slice(0, 160)}`);
  }
  console.log(`    fix: ${REGEN}`);
  process.exit(1);
}

fs.writeFileSync(OUT, body, "utf8");
console.log(`generate-hot: wrote memory/HOT.md — ${L.length} lines (cap ${LINE_CAP}), ${Buffer.byteLength(body, "utf8")} bytes (cap ${BYTE_CAP}), as of ${idx.asOf || "unknown"}`);
console.log(`    OWED ${ow ? `${ow.open} open / ${ow.total} rows` : "unreadable"} · boards ${bd ? bd.length + " active" : "table unparsed"} · project bullets ${idx.project.length} · runs bullets ${idx.runs.length}`);
process.exit(0);
