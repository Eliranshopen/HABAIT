#!/usr/bin/env node
// .claude/skills/sync-context/metrics.mjs — the weekly harness metrics block (harness upgrade plan
// (docs/harness-upgrade-plan.md), wave 5; added 2026-09-08).
//
// REPORT-ONLY BY DESIGN: it prints numbers and always exits 0. No metric value ever gates anything —
// a metric that can fail a run becomes a target, and the plan's rule is that the gates are the four
// checks in check-context.mjs, not this block. A metric this script cannot measure prints the reason
// instead of a number (NEVER INVENT: a number appears only with the command that measured it).
//
// Nothing here is heavy: git plumbing, file stats, and three ~250 ms PowerShell hook invocations.
// Usage: node .claude/skills/sync-context/metrics.mjs      (run from anywhere)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const APP = path.join(ROOT, "Habait/MVP/app");
const GLOBAL_CARD = "C:/Users/elira/.claude/CLAUDE.md";
const ROOT_CARD = path.join(ROOT, "CLAUDE.md");
const APP_CARD = path.join(APP, "CLAUDE.md");
// The sample worktree card is DERIVED from docs/governance/worktrees.json (G-56, 2026-10-22), never a hard-coded path: the first app
// lane (the app's main checkout skipped) whose directory exists and carries a CLAUDE.md; none => null and the line says so.
const WT_CARD = (() => {
  try {
    const reg = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/governance/worktrees.json"), "utf8").replace(/^\uFEFF/, ""));
    for (const [key, v] of Object.entries(reg)) {
      if (key.startsWith("_") || !v || v.repo !== "app" || /(^|\/)Habait\/MVP\/app$/.test(key)) continue;
      const card = path.join(path.resolve(ROOT, ".."), key, "CLAUDE.md");
      if (fs.existsSync(card)) return card;
    }
  } catch { /* none */ }
  return null;
})();
const PROJECTS_DIR = "C:/Users/elira/.claude/projects";
const TEST_GUARD = path.join(ROOT, ".claude/hooks/test-guard.ps1");
const BUDGETS = { "root-rooted": 8000, "app-rooted": 15000, worktree: 8000 };

const read = (p) => { try { return fs.readFileSync(p, "utf8").replace(/^﻿/, ""); } catch { return null; } };
// Local git is back (Eliran, 2026-11-04: root §8.7). Read-only plumbing only — status/log/rev-parse, never a write verb.
// A cwd that is not a repo (APP is Habait/MVP/app, absent; OWED-009) reports "no repo" instead of throwing.
const git = (args, cwd = ROOT) => {
  if (!fs.existsSync(path.join(cwd, ".git"))) return { ok: false, out: "", why: `no repo at ${path.relative(ROOT, cwd) || "."}` };
  try { return { ok: true, out: execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30000 }), why: "" }; }
  catch (e) { return { ok: false, out: "", why: String(e.message || e).split("\n")[0] }; }
};
const median = (xs) => { if (!xs.length) return null; const a = [...xs].sort((x, y) => x - y); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const dayNum = (d) => Math.floor(Date.parse(d + "T00:00:00Z") / 86400000);
const dateRe = /\b(20\d\d-\d\d-\d\d)\b/;
const today = new Date().toISOString().slice(0, 10);
const say = (s) => console.log(s);

say(`metrics — harness weekly block, generated ${today} (report-only, never gates)`);
say(`root: ${ROOT.split(path.sep).join("/")}`);

// ---- 1. board WIP by State ---------------------------------------------------------------------
say("\n[1] Board WIP by State — development/tasks/CLAUDE.md Board status table");
{
  const text = read(path.join(ROOT, "development/tasks/CLAUDE.md"));
  const all = text == null ? [] : text.split(/\r?\n/);
  const head = all.findIndex((l) => /^\|\s*Board\s*\|\s*Opened\s*\|\s*State\s*\|/.test(l));
  if (head < 0) { say("    table not parseable — read development/tasks/CLAUDE.md directly"); }
  else {
    const buckets = new Map();
    let rows = 0;
    for (let i = head + 2; i < all.length; i++) {
      if (!all[i].startsWith("|")) { if (rows) break; else continue; }
      const cells = all[i].split("|").map((c) => c.trim());
      if (cells.length < 5) continue;
      rows++;
      const bare = cells[3].replace(/[*`]/g, "").toUpperCase();
      const key = ["EXECUTING", "LIVE IN PRODUCTION", "LIVE", "IN-PROGRESS", "SHIPPED", "BUILT-NOT-SHIPPED", "DEPLOYED-PREVIEW", "OPEN-NOT-STARTED", "FILED", "CLOSED", "RESEARCH-ONLY", "PARTIAL-BOARD"].find((k) => bare.includes(k)) ?? "other";
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    say(`    ${rows} table rows`);
    for (const [k, v] of [...buckets].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))) say(`      ${k}: ${v}`);
    const dirs = fs.existsSync(path.join(ROOT, "development/tasks")) ? fs.readdirSync(path.join(ROOT, "development/tasks"), { withFileTypes: true }).filter((e) => e.isDirectory()).length : 0;
    say(`    board directories on disk (ls -d development/tasks/*/): ${dirs} — the table is not exhaustive of them`);
  }
}

// ---- 2. untracked board dirs -------------------------------------------------------------------
say("\n[2] Untracked board paths — git status --porcelain --untracked-files=normal -- development/tasks");
{
  const r = git(["status", "--porcelain", "--untracked-files=normal", "--", "development/tasks"]);
  if (!r.ok) say(`    not measured: ${r.why}`);
  else {
    const ls = r.out.split(/\r?\n/).filter(Boolean);
    const untracked = ls.filter((l) => l.startsWith("?? "));
    say(`    ${ls.length} changed paths · ${untracked.length} untracked`);
    for (const l of untracked.slice(0, 15)) say(`      ${l}`);
    if (untracked.length > 15) say(`      …${untracked.length - 15} more`);
  }
}

// ---- 3. OWED open/closed + median age ----------------------------------------------------------
say("\n[3] OWED — docs/governance/OWED.md (Age = As-of − Opened, the file's own single stamp)");
{
  const text = read(path.join(ROOT, "docs/governance/OWED.md"));
  if (text == null) say("    not measured: OWED.md unreadable");
  else {
    const asOf = (text.split(/\r?\n/).find((l) => l.startsWith("**As-of:")) || "").match(dateRe)?.[1] ?? "";
    let open = 0, closed = 0, other = 0;
    const ages = [];
    for (const l of text.split(/\r?\n/)) {
      if (!l.startsWith("| OWED-")) continue;
      const cells = l.split("|").map((c) => c.trim());
      const opened = cells[2]?.match(dateRe)?.[1] ?? "";
      const nonEmpty = cells.filter((c) => c !== "");
      const bare = (nonEmpty[nonEmpty.length - 1] ?? "").replace(/[*⛔⚠→\s]/g, " ").trim();
      if (/^(CLOSED|PAID|DONE|MOOT|SUPERSEDED|CUT|WITHDRAWN)/i.test(bare)) { closed++; continue; }
      if (/\bOPEN\b/i.test(bare) || /NOT SENT/i.test(bare) || /\bDUE\b/i.test(bare) || /\bPENDING\b/i.test(bare)) {
        open++;
        if (opened && asOf) ages.push(dayNum(asOf) - dayNum(opened));
        continue;
      }
      other++;
    }
    say(`    As-of ${asOf || "unstamped"} · ${open} open · ${closed} closed · ${other} unclassified (of ${open + closed + other} rows)`);
    say(`    median open age: ${ages.length ? median(ages) + "d" : "not computable"} (min ${ages.length ? Math.min(...ages) : "-"}d, max ${ages.length ? Math.max(...ages) : "-"}d)`);
  }
}

// ---- 4. gate memos -----------------------------------------------------------------------------
say("\n[4] Compliance gate memos — Habait/MVP/docs/compliance-gate-*.md");
{
  const dir = path.join(ROOT, "Habait/MVP/docs");
  let names = [];
  try { names = fs.readdirSync(dir).filter((f) => /^compliance-gate-.*\.md$/.test(f)); } catch {}
  if (!names.length) say("    0 memos found");
  else {
    const counts = names.map((f) => (read(path.join(dir, f)) ?? "").split(/\r?\n/).length);
    say(`    ${names.length} memos · median ${median(counts)} lines (min ${Math.min(...counts)}, max ${Math.max(...counts)})`);
  }
}

// ---- 5. CLAUDE.md churn, last 30 days ----------------------------------------------------------
say("\n[5] CLAUDE.md churn — git log --since=30.days --numstat -- \"*CLAUDE.md\"");
for (const [label, cwd] of [["harness repo", ROOT], ["app repo (Habait/MVP/app)", APP]]) {
  const r = git(["log", "--since=30.days", "--numstat", "--format=%H", "--", "*CLAUDE.md"], cwd);
  if (!r.ok) { say(`    ${label}: not measured: ${r.why}`); continue; }
  let add = 0, del = 0, commits = 0, touched = new Set();
  for (const l of r.out.split(/\r?\n/)) {
    if (/^[0-9a-f]{40}$/.test(l.trim())) { commits++; continue; }
    const m = l.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
    if (!m) continue;
    if (m[1] !== "-") add += Number(m[1]);
    if (m[2] !== "-") del += Number(m[2]);
    touched.add(m[3]);
  }
  say(`    ${label}: ${commits} commits touching a CLAUDE.md · +${add} / -${del} lines · ${touched.size} distinct cards`);
}

// ---- 6. root checkout dirty count --------------------------------------------------------------
say("\n[6] Working tree — git status --porcelain | wc -l");
{
  const r = git(["status", "--porcelain"]);
  if (!r.ok) say(`    not measured: ${r.why}`);
  else {
    const ls = r.out.split(/\r?\n/).filter(Boolean);
    const untracked = ls.filter((l) => l.startsWith("?? ")).length;
    say(`    harness repo: ${ls.length} dirty paths (${untracked} untracked, ${ls.length - untracked} tracked-modified) on branch ${git(["rev-parse", "--abbrev-ref", "HEAD"]).out.trim() || "?"}`);
  }
  const ra = git(["status", "--porcelain"], APP);
  say(ra.ok ? `    app repo:     ${ra.out.split(/\r?\n/).filter(Boolean).length} dirty paths` : `    app repo:     not measured: ${ra.why}`);
}

// ---- 7. startup tokens per session type (same estimator as check-context Check 7) --------------
say("\n[7] Startup tokens per session type — chars/4 of the CLAUDE.md chain, HTML comments stripped");
{
  const chainTokens = (files) => {          // duplicated from check-context.mjs on purpose: importing it
    let chars = 0;                          // would run that script's checks and its process.exit
    for (const f of files) {
      const t = read(f);
      if (t == null) continue;
      chars += t.replace(/<!--[\s\S]*?-->/g, "").length;
    }
    return { chars, tokens: Math.round(chars / 4) };
  };
  const chains = {
    "root-rooted": [GLOBAL_CARD, ROOT_CARD],
    "app-rooted": [GLOBAL_CARD, ROOT_CARD, path.join(ROOT, "Habait/CLAUDE.md"), path.join(ROOT, "Habait/MVP/CLAUDE.md"), APP_CARD],
    ...(WT_CARD ? { worktree: [GLOBAL_CARD, WT_CARD] } : {}),
  };
  if (!WT_CARD) say("    worktree: no worktree lane (docs/governance/worktrees.json lists no app lane with a CLAUDE.md on disk)");
  for (const [k, files] of Object.entries(chains)) {
    const { chars, tokens } = chainTokens(files);
    say(`    ${k}: ${tokens} tokens (${chars} chars) vs budget ${BUDGETS[k]} — ${tokens > BUDGETS[k] ? `OVER by ${tokens - BUDGETS[k]}` : `${BUDGETS[k] - tokens} to spare`}`);
  }
}

// ---- 8. hook latency ---------------------------------------------------------------------------
say("\n[8] PreToolUse hook latency — 3 runs of test-guard.ps1 with a dummy Bash event on stdin");
{
  if (!fs.existsSync(TEST_GUARD)) say(`    not measured: ${path.relative(ROOT, TEST_GUARD)} not on disk`);
  else {
    const input = JSON.stringify({ tool_name: "Bash", tool_input: { command: "echo metrics-probe" } });
    const ms = [];
    for (let i = 0; i < 3; i++) {
      const t0 = process.hrtime.bigint();
      const r = spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", TEST_GUARD], { input, encoding: "utf8" });
      ms.push(Number(process.hrtime.bigint() - t0) / 1e6);
      if (r.error) { say(`    not measured: ${r.error.message}`); ms.length = 0; break; }
    }
    if (ms.length) say(`    mean ${Math.round(ms.reduce((a, b) => a + b, 0) / ms.length)} ms over ${ms.length} runs (each ${ms.map((m) => Math.round(m)).join(", ")} ms) — paid on every Bash tool call`);
  }
}

// ---- 9. exit-124 count -------------------------------------------------------------------------
say("\n[9] Exit-124 (timeout-bounded heavy runs): not tracked (no test-guard log yet)");

// ---- 10. model spend proxy ---------------------------------------------------------------------
say("\n[10] Model spend proxy — bytes of *.jsonl under C:/Users/elira/.claude/projects/*/ modified in the last 7 days");
{
  const cutoff = Date.now() - 7 * 86400000;
  let bytes = 0, files = 0, projects = 0;
  try {
    for (const p of fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })) {
      if (!p.isDirectory()) continue;
      projects++;
      const walk = (d) => {
        let es; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
        for (const e of es) {
          const fp = path.join(d, e.name);
          if (e.isDirectory()) { walk(fp); continue; }
          if (!e.name.endsWith(".jsonl")) continue;
          let st; try { st = fs.statSync(fp); } catch { continue; }
          if (st.mtimeMs >= cutoff) { bytes += st.size; files++; }
        }
      };
      walk(path.join(PROJECTS_DIR, p.name));
    }
    say(`    ${files} transcript files across ${projects} project dirs · ${(bytes / 1048576).toFixed(1)} MiB (${bytes} bytes) — a PROXY for volume, not a dollar figure`);
  } catch (e) {
    say(`    not measured: ${String(e.message).split("\n")[0]}`);
  }
}

say("\nmetrics: report complete (exit 0 always — no metric value gates anything).");
process.exit(0);
