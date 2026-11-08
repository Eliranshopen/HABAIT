#!/usr/bin/env node
// .claude/skills/sync-context/check-context.mjs — Checks 1, 5-9 of /sync-context (harness upgrade plan
// (docs/harness-upgrade-plan.md), wave 1; added 2026-09-08; checks 1 and 9 folded in 2026-10-22, V-09/V-17).
//
//   Check 1  MARKER LINT — exactly one bare `<!-- last-updated: YYYY-MM-DD -->` on line 2 of every harness card (vendor comp/ scaffolds excluded).
//   Check 9  MEMORY-CONTRACT CONSISTENCY — root section 0, memory/README.md and the memory preamble carry the same contract fragments
//            (markup-insensitive); a fragment missing from any of the three is a FAIL.
//   Check 5  MACHINE-RULES PARITY — the Machine resource rules block must be byte-identical in every
//            card that carries it (global user card = canonical, harness root card, app card, the
//            test-users worktree card). A file with no block is INFO, not a failure. The git-identity
//            string is reported for the root + app cards (report only, never gates).
//   Check 6  CARD LINE CEILINGS — harness cards <= 120 lines, the harness root card <= 200. App-repo
//            cards are REPORT-ONLY (D13: the app repo is additive-only for the harness). Card standard v1.3 (D-AUD-40) adds
//            20 KB per card and no line over 600 chars: FAIL since 2026-10-22 (V13_ENFORCE = true, the 34 cards trimmed).
//            The sample worktree is derived from docs/governance/worktrees.json (G-56), never a hard-coded path.
//   Check 7  STARTUP TOKEN BUDGET — tokens = chars/4 of the CLAUDE.md chain a session inherits, HTML
//            comments stripped. root-rooted <= 8000, app-rooted <= 15000, worktree <= 8000.
//   Check 8  HOOK CLAIMS — a card that claims a hook enforces/backs something must name a hook that is
//            actually installed in a settings file. A claim qualified with "once installed" passes.
//
// Read-only: it changes nothing on disk and makes no network call. Exit 1 on any FAIL, else 0.
// Usage: node .claude/skills/sync-context/check-context.mjs [--json]   (run from anywhere)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const GLOBAL_CARD = "C:/Users/elira/.claude/CLAUDE.md";
const ROOT_CARD = path.join(ROOT, "CLAUDE.md");
const APP_CARD = path.join(ROOT, "Habait/MVP/app/CLAUDE.md");
// The sample worktree is DERIVED, never hard-coded (G-56, 2026-10-22): the first app lane in docs/governance/worktrees.json
// (keys are relative to the parent of the harness root; the app's main checkout is skipped, it is APP_CARD) whose directory
// exists and carries a CLAUDE.md. None => WT_ROOT = null and every worktree-dependent line says "no worktree lane".
function sampleWorktree() {
  try {
    const reg = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/governance/worktrees.json"), "utf8").replace(/^﻿/, ""));
    const base = path.resolve(ROOT, "..");
    for (const [key, v] of Object.entries(reg)) {
      if (key.startsWith("_") || !v || v.repo !== "app" || /(^|\/)Habait\/MVP\/app$/.test(key)) continue;
      const dir = path.resolve(base, key);
      if (fs.existsSync(path.join(dir, "CLAUDE.md"))) return dir;
    }
  } catch { /* fall through */ }
  return null;
}
const WT_ROOT = sampleWorktree();
const WT_CARD = WT_ROOT ? path.join(WT_ROOT, "CLAUDE.md") : null;
const V13_ENFORCE = true;      // card standard v1.3 (D-AUD-40): 20 KB per card + no line over 600 chars. ENFORCED (FAIL) since 2026-10-22, when the
                               // 34 over-size or long-line cards were trimmed (phase 4; the cuts are in docs/CARD-LOG-2026-10-22.md).
const V13_BYTES = 20 * 1024;   // bytes per card
const V13_LINE = 600;          // characters per line
const GIT_IDENTITY = process.env.RND_GIT_IDENTITY || "<pinned identity unset — set RND_GIT_IDENTITY or root CLAUDE.md §11>";
const HOOK_NAMES = ["test-guard", "secret-egress", "protect-originals", "subagent-context"];
const CLAIM_WORDS = ["enforced", "enforces", "enforcement", "backs", "backed"];
const QUALIFIERS = ["once installed", "once it is installed", "uninstalled"];
const PROXIMITY = 160;        // chars between the hook name and the claim word
const CARD_CAP = 120;         // lines, any harness card
const ROOT_CARD_CAP = 200;    // lines, the harness root card
const BUDGETS = { "root-rooted": 8000, "app-rooted": 15000, worktree: 8000 };

const asJson = process.argv.includes("--json");
const read = (p) => { try { return fs.readFileSync(p, "utf8").replace(/^\uFEFF/, ""); } catch { return null; } };
const relRoot = (p) => path.relative(ROOT, p).split(path.sep).join("/") || path.basename(p);
const checks = [];
const add = (id, name, status, summary, details) => checks.push({ id, name, status, summary, details });

// ---- Check 1: the section 3.3 marker lint (folded in 2026-10-22, V-09; spec = SKILL.md "Check 1") ------------------
// Every harness card carries EXACTLY ONE bare-form marker `<!-- last-updated: YYYY-MM-DD -->`, on its own line, immediately
// after the H1 (line 2). Vendor HyperFrames scaffolds under video/projects/*/comp/ are not our cards (known exclusion, INFO).
{
  const SCAFFOLD = /^video\/projects\/[^/]+\/comp\/CLAUDE\.md$/;
  const bad = [], info = [];
  let scanned = 0;
  for (const f of harnessCards()) {
    const r = relRoot(f);
    const text = read(f); if (text == null) continue;
    const ls = text.split(/\r?\n/);
    const marks = ls.map((l, i) => ({ l, i })).filter((x) => x.l.includes("last-updated"));
    if (SCAFFOLD.test(r)) { info.push(`INFO excluded (vendor scaffold, no marker by design): ${r}`); continue; }
    scanned++;
    const problems = [];
    if (marks.length !== 1) problems.push(`${marks.length} markers (must be exactly 1)`);
    else {
      const { l, i } = marks[0];
      if (!/^<!-- last-updated: \d{4}-\d\d-\d\d -->$/.test(l.trimEnd())) problems.push(`not the bare form on its own line: ${JSON.stringify(l.slice(0, 80))}`);
      if (i !== 1) problems.push(`marker on line ${i + 1}, not line 2`);
    }
    if (!/^# /.test(ls[0] ?? "")) problems.push("line 1 is not an H1");
    if (problems.length) bad.push(`${r}: ${problems.join("; ")}`);
  }
  add(1, "marker lint (section 3.3)", bad.length ? "FAIL" : "PASS", `${scanned} harness cards linted · ${bad.length} off-standard · ${info.length} vendor scaffold(s) excluded`, [...bad.map((b) => `FAIL ${b}`), ...info]);
}

// ---- Check 5: the Machine resource rules block, byte for byte ----------------------------------
const BLOCK_START = /^Since 2026-08-06 this 32 GB laptop/;
const BLOCK_END = /^6\. \*\*No heap-flag fixes/;
function extractBlock(text) {
  if (text == null) return null;
  const lines = text.split(/\r?\n/);
  const s = lines.findIndex((l) => BLOCK_START.test(l));
  if (s < 0) return null;
  const e = lines.findIndex((l, i) => i >= s && BLOCK_END.test(l));
  if (e < 0) return null;
  return lines.slice(s, e + 1).join("\n");
}
{
  const copies = [
    { label: "global (canonical)", file: GLOBAL_CARD },
    { label: "harness root", file: ROOT_CARD },
    { label: "app card", file: APP_CARD },
    { label: WT_ROOT ? `worktree ${path.basename(WT_ROOT)} (derived sample)` : "worktree (no worktree lane)", file: WT_CARD },
  ].map((c) => {
    const text = c.file ? read(c.file) : null;
    return { ...c, exists: text != null, block: extractBlock(text) };
  });
  const carriers = copies.filter((c) => c.block != null);
  const missing = copies.filter((c) => c.block == null);
  const canonical = carriers.find((c) => c.file === GLOBAL_CARD) ?? carriers[0];
  const differing = canonical ? carriers.filter((c) => c.block !== canonical.block) : [];
  const details = [];
  for (const c of carriers) details.push(`carries block: ${c.label} (${relRoot(c.file)}) — ${c.block.split("\n").length} lines, ${Buffer.byteLength(c.block, "utf8")} bytes${c === canonical ? " [canonical]" : c.block === canonical.block ? " [identical]" : " [DIFFERS]"}`);
  for (const c of missing) details.push(`INFO no block: ${c.label} (${c.file ? relRoot(c.file) : "none"})${c.exists ? "" : c.file ? " — file not found" : " — no worktree lane"}`);
  for (const c of differing) {
    const a = canonical.block.split("\n"), b = c.block.split("\n");
    const i = a.findIndex((l, k) => l !== b[k]);
    const la = a[i] ?? "", lb = b[i] ?? "";
    let col = 0; while (col < la.length && col < lb.length && la[col] === lb[col]) col++;
    const win = (s) => (s.length ? JSON.stringify(s.slice(Math.max(0, col - 40), col + 110)) : "<absent>");
    details.push(`DIFF ${c.label}: block line ${i + 1} diverges at char ${col + 1} of ${la.length} (this file ${lb.length})\n      canonical: …${win(la)}\n      this file: …${win(lb)}`);
  }
  const rootText = read(ROOT_CARD) ?? "", appText = read(APP_CARD) ?? "";
  const idRoot = rootText.includes(GIT_IDENTITY), idApp = appText.includes(GIT_IDENTITY);
  details.push(`REPORT git-identity string present: harness root card ${idRoot ? "yes" : "NO"} · app card ${idApp ? "yes" : "NO"} (report only, never gates)`);
  add(5, "machine-rules parity", differing.length ? "FAIL" : carriers.length ? "PASS" : "INFO",
    `${carriers.length}/${copies.length} cards carry the block · ${differing.length} differ from canonical · ${missing.length} have none`, details);
}

// ---- Check 6: card line ceilings ---------------------------------------------------------------
function harnessCards() {
  const skip = new Set(["node_modules", ".git", ".next", ".wt"]);
  const out = [];
  const walk = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (skip.has(e.name)) continue;
        // dated backup/archive copies are exempt from root §8.6, as generate-cards.py's SKIP_RE (2026-11-04)
        if (/-(backup|archive)-\d{4}-\d{2}-\d{2}$/i.test(e.name)) continue;
        const r = relRoot(p);
        if (r === "Habait/MVP/app" || r === ".claude/worktrees") continue;
        walk(p);
      } else if (e.isFile() && e.name === "CLAUDE.md") out.push(p);
    }
  };
  walk(ROOT);
  return out.sort();
}
// wc -l semantics for a newline-terminated file, and still counts a final unterminated line.
const lineCount = (text) => { const a = text.split(/\r?\n/); if (a.length && a[a.length - 1] === "") a.pop(); return a.length; };
{
  const details = [];
  const over = [];
  for (const f of harnessCards()) {
    const text = read(f);
    if (text == null) continue;
    const n = lineCount(text);
    const cap = path.resolve(f) === path.resolve(ROOT_CARD) ? ROOT_CARD_CAP : CARD_CAP;
    if (n > cap) { over.push({ f: relRoot(f), n, cap }); details.push(`OVER ${relRoot(f)}: ${n} lines (cap ${cap})`); }
  }
  // app-repo cards: report only
  const appReport = [];
  try {
    if (!WT_ROOT) throw new Error("no worktree lane (docs/governance/worktrees.json lists no app lane with a CLAUDE.md on disk)");
    const tracked = execFileSync("git", ["-C", WT_ROOT, "ls-files"], { encoding: "utf8" })
      .split(/\r?\n/).filter((l) => l.endsWith("CLAUDE.md"));
    const untracked = execFileSync("git", ["-C", WT_ROOT, "status", "--porcelain", "--untracked-files=all"], { encoding: "utf8" })
      .split(/\r?\n/).filter((l) => l.startsWith("?? ") && l.endsWith("CLAUDE.md")).map((l) => l.slice(3));
    for (const rel of [...new Set([...tracked, ...untracked])].sort()) {
      const text = read(path.join(WT_ROOT, rel));
      if (text == null) continue;
      const n = lineCount(text);
      if (n > CARD_CAP) appReport.push(`REPORT app-repo ${rel}: ${n} lines (> ${CARD_CAP}, report-only per D13)`);
    }
  } catch (e) {
    appReport.push(`INFO app-repo cards not measured: ${String(e.message).split("\n")[0]}`);
  }
  const harnessTotal = harnessCards().length;
  // ---- card standard v1.3 (D-AUD-40): bytes per card + longest line. WARN (report-only) while V13_ENFORCE is false. ----
  // Measured over the harness cards AND the app's main-checkout cards (Habait/MVP/app, its own repo; walked directly).
  const v13 = [];
  const appMain = [];
  (function walkApp(dir) {
    let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (["node_modules", ".next", ".git", ".vercel"].includes(e.name)) continue; walkApp(p); }
      else if (e.isFile() && e.name === "CLAUDE.md") appMain.push(p);
    }
  })(path.join(ROOT, "Habait/MVP/app"));
  for (const f of [...harnessCards(), ...appMain.sort()]) {
    const text = read(f); if (text == null) continue;
    const bytes = Buffer.byteLength(text, "utf8");
    const longest = text.split(/\r?\n/).reduce((m, l) => Math.max(m, l.length), 0);
    const why = [];
    if (bytes > V13_BYTES) why.push(`${(bytes / 1024).toFixed(1)} KB > ${V13_BYTES / 1024} KB`);
    if (longest > V13_LINE) why.push(`longest line ${longest} > ${V13_LINE} chars`);
    if (why.length) v13.push({ f: relRoot(f), bytes, longest, bigBytes: bytes > V13_BYTES, bigLine: longest > V13_LINE, why: why.join("; ") });
  }
  const v13Bytes = v13.filter((x) => x.bigBytes), v13Lines = v13.filter((x) => x.bigLine);
  const v13Lines_ = v13.sort((a, b) => b.bytes - a.bytes).map((x) => `${V13_ENFORCE ? "OVER" : "WARN"} v1.3 ${x.f}: ${x.why}`);
  const v13Summary = `v1.3 (${V13_ENFORCE ? "ENFORCED" : "report-only, V13_ENFORCE=false"}): ${v13Bytes.length} cards over ${V13_BYTES / 1024} KB · ${v13Lines.length} cards with a line over ${V13_LINE} chars · ${v13.length} distinct offenders of ${harnessTotal + appMain.length} cards measured`;
  const status = over.length || (V13_ENFORCE && v13.length) ? "FAIL" : v13.length ? "WARN" : "PASS";
  add(6, "card line ceilings", status,
    `${harnessTotal} harness cards measured · ${over.length} over cap (harness ${CARD_CAP}, root ${ROOT_CARD_CAP}) · ${appReport.filter((l) => l.startsWith("REPORT")).length} app-repo cards over ${CARD_CAP} (report only) · ${v13Summary}`,
    [...details, ...appReport, ...v13Lines_]);
}

// ---- Check 7: startup token budget -------------------------------------------------------------
// tokens = chars/4 of the concatenated chain a session inherits, HTML comments stripped.
function chainTokens(files) {
  let chars = 0;
  const per = [];
  for (const f of files) {
    const text = read(f);
    if (text == null) { per.push({ file: f, chars: 0, missing: true }); continue; }
    const stripped = text.replace(/<!--[\s\S]*?-->/g, "");
    chars += stripped.length;
    per.push({ file: f, chars: stripped.length });
  }
  return { chars, tokens: Math.round(chars / 4), per };
}
const CHAINS = {
  "root-rooted": [GLOBAL_CARD, ROOT_CARD],
  "app-rooted": [GLOBAL_CARD, ROOT_CARD, path.join(ROOT, "Habait/CLAUDE.md"), path.join(ROOT, "Habait/MVP/CLAUDE.md"), APP_CARD],
  ...(WT_CARD ? { worktree: [GLOBAL_CARD, WT_CARD] } : {}),
};
{
  const details = [];
  let fails = 0;
  const numbers = {};
  if (!WT_CARD) details.push("INFO worktree: no worktree lane — session type not measured");
  for (const [kind, files] of Object.entries(CHAINS)) {
    const { chars, tokens, per } = chainTokens(files);
    const budget = BUDGETS[kind];
    numbers[kind] = { tokens, chars, budget };
    const verdict = tokens > budget ? "OVER" : "ok";
    if (tokens > budget) fails++;
    details.push(`${verdict} ${kind}: ${tokens} tokens (${chars} chars / 4) vs budget ${budget}${tokens > budget ? ` — over by ${tokens - budget}` : ` — ${budget - tokens} to spare`}`);
    for (const p of per) details.push(`      ${p.missing ? "MISSING " : ""}${relRoot(p.file)}: ${p.chars} chars`);
  }
  add(7, "startup token budget", fails ? "FAIL" : "PASS",
    Object.entries(numbers).map(([k, v]) => `${k} ${v.tokens}/${v.budget}`).join(" · "), details);
}

// ---- Check 8: hook enforcement claims ----------------------------------------------------------
function installedHooks() {
  const found = new Set();
  const files = [GLOBAL_CARD.replace(/CLAUDE\.md$/, "settings.json"), path.join(ROOT, ".claude/settings.local.json")];
  const seen = [];
  for (const f of files) {
    const text = read(f);
    if (text == null) { seen.push(`${relRoot(f)}: not found`); continue; }
    let json;
    try { json = JSON.parse(text); } catch (e) { seen.push(`${relRoot(f)}: UNPARSEABLE (${String(e.message).split("\n")[0]})`); continue; }
    const blob = JSON.stringify(json.hooks ?? {});
    const hits = HOOK_NAMES.filter((h) => blob.includes(h));
    hits.forEach((h) => found.add(h));
    seen.push(`${relRoot(f)}: hooks ${json.hooks ? "present" : "absent"}${hits.length ? ` → ${hits.join(", ")}` : " → none"}`);
  }
  return { found, seen };
}
function claimScanFiles() {
  const skipDirs = new Set(["node_modules", ".git", ".next", "worktrees", ".wt"]);
  const out = [];
  const walk = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      const r = relRoot(p);
      if (e.isDirectory()) {
        if (skipDirs.has(e.name)) continue;
        if (r === "memory/runs" || r === ".claude/worktrees") continue;
        walk(p);
      } else if (e.isFile() && e.name.endsWith(".md")) {
        if (/^development\/tasks\/[^/]+\/task-.*\.md$/.test(r)) continue;
        if (/^Habait\/MVP\/docs\/compliance-gate-.*\.md$/.test(r)) continue;
        if (r === "docs/harness-upgrade-plan.md") continue;
        out.push(p);
      }
    }
  };
  walk(ROOT);
  return out.sort();
}
{
  const { found, seen } = installedHooks();
  const hookRe = new RegExp(`(${HOOK_NAMES.join("|")})`, "g");
  const wordRe = new RegExp(`(${CLAIM_WORDS.join("|")})`, "gi");
  const bad = [];
  let claims = 0, qualified = 0, scanned = 0;
  for (const f of claimScanFiles()) {
    const text = read(f);
    if (text == null) continue;
    scanned++;
    const words = [...text.matchAll(wordRe)].map((m) => m.index);
    if (!words.length) continue;
    const lineOf = (idx) => text.slice(0, idx).split("\n").length;   // claims are few — a slice per hit is cheap
    for (const m of text.matchAll(hookRe)) {
      const hIdx = m.index, hook = m[1];
      const near = words.find((w) => Math.abs(w - hIdx) <= PROXIMITY);
      if (near === undefined) continue;
      claims++;
      const from = Math.max(0, Math.min(hIdx, near) - PROXIMITY);
      const to = Math.min(text.length, Math.max(hIdx + hook.length, near) + PROXIMITY);
      const window = text.slice(from, to).toLowerCase();
      const isQualified = QUALIFIERS.some((q) => window.includes(q));
      if (isQualified) { qualified++; continue; }
      if (found.has(hook)) continue;
      bad.push(`${relRoot(f)}:${lineOf(hIdx)} claims \`${hook}\` enforces/backs, but it is NOT installed — ${text.slice(Math.max(0, hIdx - 60), hIdx + 100).replace(/\s+/g, " ").trim().slice(0, 150)}`);
    }
  }
  add(8, "hook enforcement claims", bad.length ? "FAIL" : "PASS",
    `${scanned} md files scanned · ${claims} enforcement claims · ${qualified} qualified ("once installed"/UNINSTALLED) · installed: ${found.size ? [...found].sort().join(", ") : "none"} · ${bad.length} unbacked`,
    [...seen.map((s) => `settings ${s}`), ...bad]);
}

// ---- Check 9: three-way memory-contract consistency (folded in 2026-10-22, V-17; spec = SKILL.md "Check 9") --------
// Root CLAUDE.md section 0, memory/README.md and .claude/agents/_MEMORY_PREAMBLE.md state ONE contract. Markup-insensitive
// (backticks, asterisks, link wrappers, line breaks and case are normalised away), each fragment below must appear in ALL
// three files; a fragment missing from any one is a DRIFT and a FAIL that names the fragment and the file.
{
  const norm = (t) => (t ?? "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")      // [text](url) -> text
    .replace(/[`*_>]/g, "")                       // inline markup + quote marks
    .replace(/\s+/g, " ").toLowerCase();
  const FILES = [["CLAUDE.md", ROOT_CARD], ["memory/README.md", path.join(ROOT, "memory/README.md")], [".claude/agents/_MEMORY_PREAMBLE.md", path.join(ROOT, ".claude/agents/_MEMORY_PREAMBLE.md")]];
  const FRAGMENTS = [
    "bounded read-first",
    "second reader",
    "an action is not done until its memory is written",
    "index.md whole",   // 2026-11-03: the cold-archive wording was stale (no INDEX archive exists); root §0 owns the contract
    "the last ~150 lines of",
    "archive-index block",
    "regenerated at every /close-board and /sync-context",   // 2026-11-03: matched to the wording root §0 and memory/README.md use
  ].map(norm);   // the fragments go through the same normaliser as the files (so the asterisk in INDEX*.md survives on both sides)
  const texts = FILES.map(([label, p]) => ({ label, text: norm(read(p)), exists: read(p) != null }));
  const drift = [];
  for (const fr of FRAGMENTS) for (const t of texts) if (!t.exists) { if (!drift.some((d) => d.includes(t.label))) drift.push(`${t.label}: file not found`); } else if (!t.text.includes(fr)) drift.push(`"${fr}" absent from ${t.label}`);
  const cells = FRAGMENTS.length * FILES.length;
  add(9, "memory-contract consistency (3 files)", drift.length ? "FAIL" : "PASS", `${cells - drift.length}/${cells} fragment cells present (${FRAGMENTS.length} contract fragments x ${FILES.length} files) · ${drift.length} drift`, drift.map((d) => `FAIL (check 9): ${d}`));
}

// ---- report ------------------------------------------------------------------------------------
checks.sort((a, b) => a.id - b.id);
const failed = checks.filter((c) => c.status === "FAIL");
if (asJson) {
  console.log(JSON.stringify({ root: ROOT.split(path.sep).join("/"), checks, failed: failed.map((c) => c.id), exit: failed.length ? 1 : 0 }, null, 2));
} else {
  console.log(`check-context: Checks 1, 5-9 over ${ROOT.split(path.sep).join("/")}`);
  for (const c of checks) {
    console.log(`\n[${c.id}] ${c.status} — ${c.name}: ${c.summary}`);
    for (const d of c.details) console.log(`    ${d}`);
  }
  console.log(`\ncheck-context: ${failed.length ? `FAIL (${failed.map((c) => "Check " + c.id).join(", ")})` : `PASS (${checks.length} checks${checks.some((c) => c.status === "WARN") ? ", " + checks.filter((c) => c.status === "WARN").length + " WARN report-only" : ""})`}`);
}
process.exit(failed.length ? 1 : 0);
