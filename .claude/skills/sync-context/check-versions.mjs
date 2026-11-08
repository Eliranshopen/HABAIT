#!/usr/bin/env node
/* check-versions.mjs — /sync-context Check 17: the VERSION register (both repos).
 *
 *   node .claude/skills/sync-context/check-versions.mjs           # (re)generate docs/governance/VERSIONS.md
 *   node .claude/skills/sync-context/check-versions.mjs --check   # exit 0 = PASS · exit 1 = FAIL (parity/origin/moved) or STALE
 *
 * "See every version we created" (inherited rulings R-ORG-6/R-ORG-7, 2026-09-16): every version is a git ref —
 *   archive/<branch>   the tip of a branch that was CLOSED (annotated tag; the branch may or may not still exist)
 *   deploy/<name>      a build that went to a URL (annotated tag; prod, alias or preview)
 *   a live branch      work still open (no tag — the branch IS the version until it closes)
 * git answers everything measurable — name, commit, date, behind/ahead of the repo's trunk, merged-or-not,
 * whether the ref is on origin (ONE live `ls-remote` per repo) — and the ONE hand-kept half is
 * docs/governance/versions.json: what · deploy · record per ref, keyed "<repo>:<ref>" (repo = harness | app).
 *
 * --check reports four things and exits 1 on any of them:
 *   PARITY   a tag or live branch with no versions.json entry (or an entry with no `what`), or an entry with no ref on disk
 *   ORIGIN   a tag or live branch whose tip is not on origin (the register exists so that nothing is local-only)
 *   MOVED    a branch that carries an archive/ tag but whose tip moved past it — it is live again; re-tag or re-open deliberately
 *   STALE    the committed file's STABLE half differs from git now — a ref appeared or disappeared, a name changed, or
 *            merged / on-origin flipped. Hashes, dates and behind/ahead are NOT compared: the harness trunk is itself a row,
 *            so the commit that files this register always moves those cells (revision 2, 2026-09-16, refute finding).
 * SKIP (exit 0) when versions.json is absent or a remote is unreachable — printed, never a stack trace.
 * Never edits git state; never runs anything heavy. */
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const BASE = "C:/RnD";
const ROOT = BASE; // the harness checkout itself (fresh department repo, 2026-11-03)
const REGISTER = `${ROOT}/docs/governance/VERSIONS.md`;
const NAMES = `${ROOT}/docs/governance/versions.json`;
const REPOS = [
  { name: "harness", label: "Harness", dir: ROOT, trunk: "main", remote: "origin", github: "<github-org>/<harness-repo>", checkout: "C:/RnD" },
  { name: "app", label: "App", dir: `${ROOT}/Habait/MVP/app`, trunk: "origin/main", remote: "origin", github: "<github-org>/<app-repo>", checkout: "C:/RnD/Habait/MVP/app" },
];
const CHECK = process.argv.includes("--check");
const TAG = "[17]";

const git = (dir, args) => {
  try { return execFileSync("git", ["-C", dir, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return ""; }
};
const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

/* ── names (hand-kept half) ──────────────────────────────────────────────── */
if (!fs.existsSync(NAMES)) { console.log("SKIP (check 17 — version register): docs/governance/versions.json not present"); process.exit(0); }
let names;
try { names = JSON.parse(fs.readFileSync(NAMES, "utf8")); }
catch (e) { console.log(`${TAG} FAIL — versions.json is not valid JSON: ${e.message}`); console.log("check-versions: FAIL"); process.exit(1); }
const known = Object.keys(names).filter((k) => !k.startsWith("_"));
const named = (key) => Boolean(names[key] && typeof names[key] === "object" && names[key].what);

/* ── refs per repo ───────────────────────────────────────────────────────── */
const moved = [];
function refsOf(repo) {
  const rows = [];
  // ONE live remote listing: heads + tags (refs only, no peel lines). Empty = unreachable → SKIP.
  const remote = git(repo.dir, ["ls-remote", "--heads", "--tags", "--refs", repo.remote]);
  if (!remote) { console.log(`SKIP (check 17 — version register): ${repo.remote} of ${repo.name} unreachable — on-origin not measured, nothing generated`); process.exit(0); }
  const remoteTags = new Set(), remoteHeads = new Map();
  for (const line of remote.split(/\r?\n/)) {
    const [sha, ref] = line.split(/\s+/);
    if (!ref) continue;
    if (ref.startsWith("refs/tags/")) remoteTags.add(ref.slice("refs/tags/".length));
    else if (ref.startsWith("refs/heads/")) remoteHeads.set(ref.slice("refs/heads/".length), sha.toLowerCase());
  }
  // tags — one for-each-ref; annotated tags dereference via *objectname / *committerdate
  const tagLines = git(repo.dir, ["for-each-ref", "refs/tags", "--format=%(refname:short)%09%(objectname)%09%(*objectname)%09%(committerdate:short)%09%(*committerdate:short)"]);
  const archiveTip = new Map();
  for (const line of tagLines.split(/\r?\n/).filter(Boolean)) {
    const [tag, obj, deref, cdate, derefDate] = line.split("\t");
    const commit = (deref || obj).toLowerCase();
    const kind = tag.startsWith("archive/") ? "archive" : tag.startsWith("deploy/") ? "deploy" : "tag";
    if (kind === "archive") archiveTip.set(tag.slice("archive/".length), commit);
    rows.push(baseRow(repo, { ref: tag, kind, commit, date: derefDate || cdate || "?", onOrigin: remoteTags.has(tag) }));
  }
  // local branches — one for-each-ref
  const heads = git(repo.dir, ["for-each-ref", "refs/heads", "--format=%(refname:short)%09%(objectname)%09%(committerdate:short)"]);
  const localHeads = new Set();
  for (const line of heads.split(/\r?\n/).filter(Boolean)) {
    const [branch, sha, cdate] = line.split("\t");
    const commit = sha.toLowerCase();
    localHeads.add(branch);
    let kind = "live-branch";
    if (archiveTip.has(branch)) {
      if (archiveTip.get(branch) === commit) kind = "closed-branch";
      else moved.push(`${repo.name}:${branch} (tip ${commit.slice(0, 10)} ≠ archive/${branch} ${archiveTip.get(branch).slice(0, 10)})`);
    }
    rows.push(baseRow(repo, { ref: branch, kind, commit, date: cdate || "?", onOrigin: remoteHeads.get(branch) === commit }));
  }
  // remote-only branches — from the live listing
  for (const [rb, sha] of remoteHeads) {
    if (localHeads.has(rb)) continue;
    const kind = archiveTip.has(rb) ? (archiveTip.get(rb) === sha ? "closed-branch-remote-only" : "remote-only-branch") : "remote-only-branch";
    if (archiveTip.has(rb) && archiveTip.get(rb) !== sha) moved.push(`${repo.name}:${rb} (remote-only; tip ${sha.slice(0, 10)} ≠ archive/${rb} ${archiveTip.get(rb).slice(0, 10)})`);
    rows.push(baseRow(repo, { ref: rb, kind, commit: sha, date: git(repo.dir, ["log", "-1", "--format=%cs", sha]) || "?", onOrigin: true }));
  }
  return rows;
}

function baseRow(repo, r) {
  const lr = git(repo.dir, ["rev-list", "--left-right", "--count", `${repo.trunk}...${r.commit}`]);
  const [behind, ahead] = lr ? lr.split(/\s+/) : ["?", "?"];
  const merged = ahead === "0" ? "yes" : ahead === "?" ? "?" : "no";   // ahead 0 ⇔ merge-base --is-ancestor commit trunk
  return { repo: repo.name, key: `${repo.name}:${r.ref}`, ref: r.ref, kind: r.kind, commit: r.commit.slice(0, 10), date: r.date || "?", behind, ahead, merged, onOrigin: r.onOrigin, trunk: repo.trunk };
}

const all = REPOS.flatMap(refsOf);

/* ── parity + origin + moved ────────────────────────────────────────────── */
const gated = (r) => r.kind === "archive" || r.kind === "deploy" || r.kind === "tag" || r.kind === "live-branch";
const tagRows = all.filter((r) => r.kind === "archive" || r.kind === "deploy" || r.kind === "tag");
const liveRows = all.filter((r) => r.kind === "live-branch");
const allKeys = new Set(all.map((r) => r.key));
const unnamedTags = tagRows.filter((r) => !named(r.key)).map((r) => r.key);
const unnamedLive = liveRows.filter((r) => !named(r.key)).map((r) => r.key);
const dead = known.filter((k) => !allKeys.has(k));
const notOnOrigin = all.filter((r) => gated(r) && !r.onOrigin).map((r) => r.key);

/* ── the document ───────────────────────────────────────────────────────── */
const today = new Date().toISOString().slice(0, 10);
const cell = (r, field) => (names[r.key]?.[field] ? esc(names[r.key][field]) : field === "what" ? (gated(r) ? "⚠ UNNAMED — add an entry to `versions.json`" : "—") : "—");
const D = (x) => (x.date === "?" ? "0000-00-00" : x.date);
const byDateDesc = (a, b) => (D(a) < D(b) ? 1 : D(a) > D(b) ? -1 : a.ref.localeCompare(b.ref));

function section(repo) {
  const R = REPOS.find((x) => x.name === repo);
  const n = REPOS.findIndex((x) => x.name === repo) + 2;
  const rows = all.filter((r) => r.repo === repo);
  const deploys = rows.filter((r) => r.kind === "deploy").sort(byDateDesc);
  const archives = rows.filter((r) => r.kind === "archive").sort(byDateDesc);
  const live = rows.filter((r) => r.kind === "live-branch").sort(byDateDesc);
  const closedStill = rows.filter((r) => r.kind === "closed-branch" || r.kind === "closed-branch-remote-only").sort(byDateDesc);
  const other = rows.filter((r) => r.kind === "tag" || r.kind === "remote-only-branch").sort(byDateDesc);
  const out = [];
  out.push(`## ${n}. ${R.label} repo — \`${R.github}\` · trunk \`${R.trunk}\` · checkout \`${R.checkout}\``, "");
  out.push(`### ${n}.1 Deployed builds — \`deploy/*\` tags (${deploys.length})`, "");
  if (deploys.length) {
    out.push("| Tag | Date | Commit | What went live | Where | On trunk | On origin | Record |", "|---|---|---|---|---|---|---|---|");
    for (const r of deploys) out.push(`| \`${esc(r.ref)}\` | ${r.date} | \`${r.commit}\` | ${cell(r, "what")} | ${cell(r, "deploy")} | ${r.merged === "yes" ? "yes" : `no (${r.behind}/${r.ahead})`} | ${r.onOrigin ? "yes" : "⛔ NO"} | ${cell(r, "record")} |`);
  } else out.push("_none yet_");
  out.push("", `### ${n}.2 Live branches — open work, the branch is the version (${live.length})`, "");
  out.push("| Branch | Last commit | Tip | What it is | Behind/ahead of trunk | Merged | Pushed | Record |", "|---|---|---|---|---|---|---|---|");
  for (const r of live) out.push(`| \`${esc(r.ref)}\` | ${r.date} | \`${r.commit}\` | ${cell(r, "what")} | ${r.behind}/${r.ahead} | ${r.merged} | ${r.onOrigin ? "yes" : "⛔ NO (tip not on origin)"} | ${cell(r, "record")} |`);
  out.push("", `### ${n}.3 Closed branches — \`archive/*\` tags (${archives.length})`, "");
  out.push("| Tag | Tip date | Commit | What it was | Merged into trunk | Behind/ahead | On origin | Deploy | Record |", "|---|---|---|---|---|---|---|---|---|");
  for (const r of archives) out.push(`| \`${esc(r.ref)}\` | ${r.date} | \`${r.commit}\` | ${cell(r, "what")} | ${r.merged} | ${r.behind}/${r.ahead} | ${r.onOrigin ? "yes" : "⛔ NO"} | ${cell(r, "deploy")} | ${cell(r, "record")} |`);
  if (closedStill.length) {
    out.push("", `> **${closedStill.length} closed branch name(s) still exist** beside their archive tag (local: ${closedStill.filter((r) => r.kind === "closed-branch").length} · remote-only: ${closedStill.filter((r) => r.kind === "closed-branch-remote-only").length}) — nothing was deleted (ruling R-ORG-2, 2026-09-16); the removal commands are \`PRUNE-PASTE-2026-09-16.md\`, Eliran's act. A closed branch whose tip moves past its tag is a live branch again — Check 17 reports it as MOVED; re-tag or re-open it deliberately.`);
  }
  const movedHere = moved.filter((m) => m.startsWith(`${repo}:`));
  if (movedHere.length) out.push("", `> ⚠ **MOVED past their archive tag:** ${movedHere.map((m) => `\`${m}\``).join(", ")}.`);
  if (other.length) {
    out.push("", `### ${n}.4 Other refs (${other.length}) — not gated by Check 17`, "", "| Ref | Kind | Date | Commit | Note |", "|---|---|---|---|---|");
    for (const r of other) out.push(`| \`${esc(r.ref)}\` | ${r.kind} | ${r.date} | \`${r.commit}\` | ${cell(r, "what")} |`);
  }
  return out;
}

const unversioned = Array.isArray(names._unversioned) ? names._unversioned : [];
const UN = REPOS.length + 2;
const doc = [
  `# VERSIONS — every version we created, in both repos (generated ${today})`,
  "",
  "<!-- GENERATED by .claude/skills/sync-context/check-versions.mjs — never hand-edit; names live in versions.json. Verify: node .claude/skills/sync-context/check-versions.mjs --check -->",
  "",
  "**Derivation rule (line 1, governing): every row is a git ref read at generation time; the three prose cells (What · Where/Deploy · Record) are the hand-kept half in [`versions.json`](versions.json).** A version is one of three things: a **`deploy/<name>` tag** (a build that went to a URL), an **`archive/<branch>` tag** (the tip of a branch that was closed — the branch name may or may not still exist), or a **live branch** (open work; the branch is the version until it closes). The inherited rulings of 2026-09-16 (R-ORG-1…8, `docs/INHERITED-DECISIONS.md`): close = archive-tag + push, never delete; every ref is on GitHub; `main` is the trunk of both repos. Hashes, dates and behind/ahead cells are a snapshot of generation time — `git` is the authority for those; the check compares only the stable half (which refs exist, their names, merged and on-origin).",
  "",
  "## 1. How to use this register",
  "",
  "| You want to… | Run |",
  "|---|---|",
  "| list every version of the app | `git -C C:/RnD/Habait/MVP/app tag -n1` |",
  "| list every version of the harness | `git -C C:/RnD tag -n1` |",
  "| read a closed branch's history | `git log archive/<branch>` |",
  "| bring a closed branch back | `git branch <branch> archive/<branch>` (then `git worktree add C:/RnD/.wt/<name> <branch>` for the app — `WORKTREES.md` rules 1–6 apply) |",
  "| check out exactly what a URL served | `git worktree add C:/RnD/.wt/<name> deploy/<kind>-<date>-<slug>` (a flat folder name, never the tag's slashes) |",
  "| diff two versions | `git diff deploy/<a> deploy/<b> --stat` |",
  "| read why a deploy tag exists | `git tag -n20 deploy/<name>` — the message carries the URL, the ledger line, the refuter's verdict and the alternative names |",
  "| see the same list on GitHub | `https://github.com/<repo>/tags` |",
  "",
  "⛔ A row here is never permission to delete a branch or a worktree — removal is `PRUNE-PASTE-2026-09-16.md`, Eliran's own act (R-ORG-2, D11). ⭐ A tag is immutable by convention: a wrong tag gets a NEW tag and a note in `versions.json`, never a `-f`.",
  "",
  ...REPOS.flatMap((R, i) => (i ? ["", ...section(R.name)] : section(R.name))),
  "",
  `## ${UN}. Known work that is NOT versioned (hand-kept — \`versions.json\` \`_unversioned\`)`,
  "",
  "| Path | What | Why not in git | Owner / ruling |",
  "|---|---|---|---|",
  ...(unversioned.length ? unversioned.map((u) => `| \`${esc(u.path)}\` | ${esc(u.what)} | ${esc(u.why)} | ${esc(u.owner)} |`) : ["| — | — | — | — |"]),
  "",
  `> **Totals** — ${REPOS.map((R) => `${R.name}: ${all.filter((r) => r.repo === R.name && r.kind === "deploy").length} deploy · ${all.filter((r) => r.repo === R.name && r.kind === "archive").length} archive · ${all.filter((r) => r.repo === R.name && r.kind === "live-branch").length} live`).join(" · ")} · refs not on origin: ${notOnOrigin.length} · moved past their tag: ${moved.length} · unnamed: ${unnamedTags.length + unnamedLive.length} · dead entries: ${dead.length}.`,
  "",
  "---",
  "",
  "**Document control** — Created 2026-09-16 by the organize pass (inherited rulings R-ORG-1…8); revision 2 the same day after the refute pass (stable-half freshness, live `ls-remote`, MOVED class, SKIP paths) · Generated by `.claude/skills/sync-context/check-versions.mjs`, verified as `/sync-context` Check 17 · Companion registers: `WORKTREES.md` (§6 the worktree inventory), `SHIP-LEDGER.md` (what shipped, the paper trail), `PRUNE-PASTE-2026-09-16.md` (the removal commands, unexecuted).",
  "",
].join("\n");

/* ── freshness: the STABLE half only ─────────────────────────────────────── */
const strip = (s) => s.replace(/\r\n/g, "\n").split("\n")
  .filter((l) => !l.startsWith("# VERSIONS — "))
  .map((l) => (l.startsWith("| `") ? l.replace(/`[0-9a-f]{7,40}`/g, "`…`").replace(/\| [0-9?]+\/[0-9?]+ \|/g, "| …/… |").replace(/\(\d+\/\d+\)/g, "(…)").replace(/\| \d{4}-\d{2}-\d{2} \|/g, "| … |") : l))
  .join("\n");
const current = fs.existsSync(REGISTER) ? fs.readFileSync(REGISTER, "utf8") : null;
const stale = current === null || strip(current) !== strip(doc);

const fail = [];
if (unnamedTags.length) fail.push(`PARITY — ${unnamedTags.length} tag(s) with no versions.json entry (or no \`what\`): ${unnamedTags.join(", ")}`);
if (unnamedLive.length) fail.push(`PARITY — ${unnamedLive.length} live branch(es) with no versions.json entry (or no \`what\`): ${unnamedLive.join(", ")}`);
if (dead.length) fail.push(`PARITY — ${dead.length} versions.json entr(y/ies) with no ref on disk: ${dead.join(", ")}`);
if (notOnOrigin.length) fail.push(`ORIGIN — ${notOnOrigin.length} ref(s) not on origin: ${notOnOrigin.join(", ")}`);
if (moved.length) fail.push(`MOVED — ${moved.length} archived branch(es) whose tip moved past the tag: ${moved.join("; ")}`);

const summary = `${all.filter((r) => r.kind === "deploy").length} deploy · ${all.filter((r) => r.kind === "archive").length} archive · ${liveRows.length} live (${REPOS.map((R) => `${R.name} ${all.filter((r) => r.repo === R.name).length} refs`).join(" · ")})`;
if (CHECK) {
  const verdict = fail.length ? "FAIL" : stale ? "STALE" : "PASS";
  console.log(`${TAG} ${verdict} — version register: ${summary} · ${unnamedTags.length + unnamedLive.length} unnamed · ${dead.length} dead · ${notOnOrigin.length} not on origin · ${moved.length} moved · VERSIONS.md ${current === null ? "ABSENT" : stale ? "stale (refs appeared/disappeared or a name/merged/on-origin cell changed — regenerate without --check)" : "current"}`);
  for (const f of fail) console.log(`    ${f}`);
  console.log(`check-versions: ${verdict}`);
  process.exit(fail.length || stale ? 1 : 0);
}

const eol = current && current.includes("\r\n") ? "\r\n" : "\n";
fs.writeFileSync(REGISTER, doc.replace(/\n/g, eol));
console.log(`check-versions: wrote VERSIONS.md — ${summary} · ${unnamedTags.length + unnamedLive.length} unnamed · ${dead.length} dead · ${notOnOrigin.length} not on origin · ${moved.length} moved${fail.length ? "\n    " + fail.join("\n    ") : ""}`);
process.exit(fail.length ? 1 : 0);
