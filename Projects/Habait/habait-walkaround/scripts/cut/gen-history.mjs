#!/usr/bin/env node
/* scripts/cut/gen-history.mjs - runs only against the lab; provenance.

   It wrote this repo's two records of the first cut (2026-11-01), from a checkout of the lab repo
   (Slava12233/RealEstateTeam, private) that holds the cut tag:
     docs/rnd/HISTORY.md   for each moved file, grouped by folder, the lab commits that touched it, newest first:
                             git log --format='%h %ad %s' --date=short <tag> -- <path>
     PROVENANCE.json       (with --write-provenance) every moved file's sha256 and size, hashed from the tag's own blobs
                           and checked against the lab's reviewed move list before anything is written
   The lab is not reachable from this repo. The script is kept as the record of how the two files were made; nothing
   in this repo runs it. It is read-only toward the lab (git rev-parse, for-each-ref, ls-tree, cat-file, log).

   Usage:
     node scripts/cut/gen-history.mjs --lab <lab checkout> --tag walkaround/cut-2026-11-01 \
          [--move-list <MOVE-LIST.tsv> --write-provenance --branch <the lab branch>] [--jobs 3] [--force]
   Without --move-list the file list comes from this repo's PROVENANCE.json. Output is deterministic for a given tag:
   no clock time is written. A file that exists and would change is refused unless --force is given. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CUT_FILES = ['.gitignore', '.gitattributes', '.gitleaks.toml', 'PROVENANCE.json', 'docs/rnd/HISTORY.md',
  'scripts/cut/verify-provenance.mjs', 'scripts/cut/gen-history.mjs'];
const USAGE = 'usage: node scripts/cut/gen-history.mjs --lab <lab checkout> --tag <cut tag> '
  + '[--move-list <MOVE-LIST.tsv> --write-provenance --branch <lab branch>] [--lab-repo <owner/name>] [--jobs N] [--force]';
function fail(msg, code = 2) { console.error(`gen-history: ${msg}`); if (code === 2) console.error(USAGE); process.exit(code); }

// ── arguments ──
const opts = { jobs: 3, labRepo: 'Slava12233/RealEstateTeam' };
const flags = new Set();
const argv = process.argv.slice(2);
const VALUED = { '--lab': 'lab', '--tag': 'tag', '--move-list': 'moveList', '--branch': 'branch', '--lab-repo': 'labRepo', '--jobs': 'jobs' };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--help' || a === '-h') { console.log(USAGE); process.exit(0); }
  if (VALUED[a]) { const v = argv[++i]; if (!v || v.startsWith('--')) fail(`${a} needs a value`); opts[VALUED[a]] = v; }
  else if (a === '--write-provenance' || a === '--force') flags.add(a);
  else fail(`unknown argument ${a}`);
}
if (!opts.lab || !opts.tag) fail('--lab and --tag are required');
if (flags.has('--write-provenance') && (!opts.moveList || !opts.branch)) fail('--write-provenance needs --move-list and --branch');
const JOBS = Math.max(1, Math.min(8, Number(opts.jobs) || 3));

// --no-optional-locks: a read never refreshes (writes) the lab's index
const lab = (args, o = {}) => execFileSync('git', ['--no-optional-locks', '-C', opts.lab, ...args], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], ...o });
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// ── the tag ──
let tagCommit, tagObject, tagType, cutAt;
try {
  tagCommit = lab(['rev-parse', '--verify', `${opts.tag}^{commit}`]).toString().trim();
  tagObject = lab(['rev-parse', '--verify', `refs/tags/${opts.tag}`]).toString().trim();
  tagType = lab(['cat-file', '-t', tagObject]).toString().trim();
  cutAt = lab(['for-each-ref', '--format=%(if)%(taggerdate)%(then)%(taggerdate:iso-strict)%(else)%(committerdate:iso-strict)%(end)', `refs/tags/${opts.tag}`]).toString().trim();
} catch { fail(`the tag ${opts.tag} is not in the lab checkout given`, 1); }

// ── the files ──
let files;
if (opts.moveList) {
  const lines = fs.readFileSync(opts.moveList, 'utf8').split(/\r?\n/).filter(Boolean);
  const head = lines.shift().split('\t');
  const ix = Object.fromEntries(head.map((h, i) => [h, i]));
  for (const k of ['path', 'blob', 'sha256', 'bytes', 'fate']) if (!(k in ix)) fail(`the move list has no ${k} column`, 1);
  files = lines.map((l) => l.split('\t')).filter((c) => c[ix.fate] === 'MOVE')
    .map((c) => ({ path: c[ix.path], blob: c[ix.blob], sha256: c[ix.sha256], bytes: Number(c[ix.bytes]) }));
} else {
  const f = path.join(ROOT, 'PROVENANCE.json');
  if (!fs.existsSync(f)) fail('no --move-list and no PROVENANCE.json in this repo');
  files = JSON.parse(fs.readFileSync(f, 'utf8')).files.map((x) => ({ path: x.path, blob: x.blob, sha256: x.sha256, bytes: x.bytes }));
}
files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
if (new Set(files.map((f) => f.path)).size !== files.length) fail('a path is listed twice', 1);

function writeOnce(rel, text) {
  const abs = path.join(ROOT, rel);
  if (fs.existsSync(abs)) {
    if (fs.readFileSync(abs, 'utf8') === text) { console.log(`unchanged ${rel}`); return; }
    if (!flags.has('--force')) fail(`${rel} exists and would change; refused (pass --force to replace it)`, 1);
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
  console.log(`wrote ${rel} (${Buffer.byteLength(text)} bytes)`);
}

// ── PROVENANCE.json: hash the tag's own blobs, check them against the move list, then write ──
function hashTagBlobs(list) {
  const ls = lab(['ls-tree', '-r', '-z', '--long', opts.tag, '--', ...list.map((f) => f.path)]).toString('utf8')
    .split('\0').filter(Boolean).map((e) => { const t = e.indexOf('\t'); const [mode, type, oid, size] = e.slice(0, t).split(/\s+/); return { mode, type, oid, size: Number(size), p: e.slice(t + 1) }; });
  const byPath = new Map(ls.map((e) => [e.p, e]));
  const problems = [];
  for (const f of list) {
    const e = byPath.get(f.path);
    if (!e || e.type !== 'blob') problems.push(`NOT-AT-TAG ${f.path}`);
    else if (e.oid !== f.blob) problems.push(`BLOB-ID-DIFFERS ${f.path}`);
    else if (e.size !== f.bytes) problems.push(`SIZE-DIFFERS ${f.path}`);
  }
  if (problems.length) { problems.forEach((p) => console.log(p)); fail(`${problems.length} move-list row(s) do not match the tag; nothing written`, 1); }
  return new Promise((resolve, reject) => {
    const cp = spawn('git', ['--no-optional-locks', '-C', opts.lab, 'cat-file', '--batch'], { stdio: ['pipe', 'pipe', 'inherit'] });
    const got = new Map();
    let chunks = [], len = 0, i = 0, need = -1;
    const joined = () => { if (chunks.length > 1) chunks = [Buffer.concat(chunks, len)]; return chunks[0] || Buffer.alloc(0); };
    const drop = (n) => { const rest = joined().subarray(n); chunks = rest.length ? [rest] : []; len = rest.length; };
    cp.stdout.on('data', (chunk) => {
      chunks.push(chunk); len += chunk.length;
      for (;;) {
        if (need < 0) {
          const all = joined(); const nl = all.indexOf(10); if (nl < 0) break;
          const [oid, type, size] = all.subarray(0, nl).toString().split(' '); drop(nl + 1);
          if (type !== 'blob' || oid !== list[i].blob) { cp.kill(); return reject(new Error(`cat-file answered ${oid} ${type} for ${list[i].path}`)); }
          need = Number(size) + 1;
        }
        if (len < need) break;
        const content = joined().subarray(0, need - 1);
        got.set(list[i].path, { sha256: sha256(content), bytes: content.length });
        drop(need); need = -1; i++;
      }
    });
    cp.on('error', reject);
    cp.on('close', (code) => (code === 0 && i === list.length ? resolve(got) : reject(new Error(`cat-file exit ${code} after ${i} of ${list.length}`))));
    cp.stdin.end(list.map((f) => f.blob).join('\n') + '\n');
  });
}

if (flags.has('--write-provenance')) {
  const got = await hashTagBlobs(files);
  const bad = files.filter((f) => got.get(f.path).sha256 !== f.sha256 || got.get(f.path).bytes !== f.bytes);
  if (bad.length) { bad.forEach((f) => console.log(`SHA256-DIFFERS ${f.path}`)); fail(`${bad.length} file(s) hash differently at the tag than in the move list; nothing written`, 1); }
  // the move list itself, by its lab path, its last lab commit and its own sha256 (never a machine path)
  const mlDir = path.dirname(path.resolve(opts.moveList));
  const mlName = path.basename(opts.moveList);
  let mlPath = mlName, mlCommit = null;
  const ml = (args) => execFileSync('git', ['--no-optional-locks', '-C', mlDir, ...args], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  try {
    mlPath = ml(['ls-files', '--full-name', '--error-unmatch', '--', mlName]) || mlName;
    mlCommit = ml(['log', '-1', '--format=%H', '--', mlName]) || null;
    // the bytes read must be the committed ones: compare blob ids, which writes nothing
    if (ml(['hash-object', '--', mlName]) !== ml(['rev-parse', `HEAD:${mlPath}`])) mlCommit = null;
  } catch { mlCommit = null; /* not tracked: the sha256 alone identifies it */ }
  const meta = {
    labRepo: opts.labRepo,
    branch: opts.branch,
    tag: opts.tag,
    tagObject: tagType === 'tag' ? tagObject : null,
    tagCommit,
    cutAt,
    note: 'The first cut: each file was copied byte for byte from the lab at the tag, at its lab path (labPath equals path), '
      + 'with no git history. docs/rnd/HISTORY.md lists the lab commits behind each file. '
      + 'Check: node scripts/cut/verify-provenance.mjs (the working tree) or --at <rev> (a commit).',
    moveList: { path: mlPath, labCommit: mlCommit, sha256: sha256(fs.readFileSync(opts.moveList)), fate: 'MOVE' },
    count: files.length,
    bytes: files.reduce((s, f) => s + f.bytes, 0),
    cutFiles: CUT_FILES,
  };
  const head = Object.entries(meta).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n');
  const body = files.map((f) => '    ' + JSON.stringify({ path: f.path, sha256: f.sha256, bytes: f.bytes, labPath: f.path, blob: f.blob })).join(',\n');
  const text = `{\n${head},\n  "files": [\n${body}\n  ]\n}\n`;
  JSON.parse(text); // it must parse
  writeOnce('PROVENANCE.json', text);
}

// ── docs/rnd/HISTORY.md: one git log per file, a few at a time ──
const run = promisify(execFile);
const logs = new Map();
let next = 0;
async function worker() {
  while (next < files.length) {
    const f = files[next++];
    const { stdout } = await run('git', ['--no-optional-locks', '-C', opts.lab, 'log', '--format=%h %ad %s', '--date=short', opts.tag, '--', f.path], { maxBuffer: 1 << 26 });
    logs.set(f.path, stdout.split('\n').filter(Boolean));
  }
}
await Promise.all(Array.from({ length: JOBS }, worker));

const folders = new Map();
for (const f of files) { const d = path.posix.dirname(f.path); if (!folders.has(d)) folders.set(d, []); folders.get(d).push(f.path); }
const commits = new Set();
let pairs = 0;
for (const l of logs.values()) for (const line of l) { commits.add(line.split(' ')[0]); pairs++; }
const fence = (lines) => { let f = '```'; while (lines.some((l) => l.includes(f))) f += '`'; return f; };

const out = [];
out.push('# HISTORY - the lab commits behind every moved file', '');
out.push('> **Generated at the cut; the lab is not reachable from here.**');
out.push(`> This repo starts with no git history. Every file listed below came from the lab repo \`${opts.labRepo}\` (private) at the tag \`${opts.tag}\` (commit \`${tagCommit.slice(0, 8)}\`, ${cutAt.slice(0, 10)}), at the same path.`);
out.push('> Under each file are the lab commits that touched it, newest first, exactly as this command printed them:');
out.push(`> \`git log --format='%h %ad %s' --date=short ${opts.tag} -- <path>\``);
out.push('> The hashes resolve only inside the lab. `PROVENANCE.json` holds each file\'s sha256; `scripts/cut/gen-history.mjs` wrote both files.', '');
out.push(`- **Files:** ${files.length} in ${folders.size} folders`);
out.push(`- **Lab commits:** ${commits.size} distinct, ${pairs} file-commit pairs`, '');
out.push('## Folders', '');
for (const [d, ps] of folders) out.push(`- \`${d}\` (${ps.length} file${ps.length === 1 ? '' : 's'})`);
out.push('');
for (const [d, ps] of folders) {
  out.push(`## \`${d}\``, '');
  for (const p of ps) {
    const l = logs.get(p);
    out.push(`### \`${p}\``, '');
    if (!l.length) { out.push('(no lab commit found)', ''); continue; }
    const f = fence(l);
    out.push(f + 'text', ...l, f, '');
  }
}
writeOnce('docs/rnd/HISTORY.md', out.join('\n'));
console.log(`files ${files.length} · folders ${folders.size} · lab commits ${commits.size} · file-commit pairs ${pairs}`);
