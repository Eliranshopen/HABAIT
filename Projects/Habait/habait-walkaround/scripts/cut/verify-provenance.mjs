#!/usr/bin/env node
/* scripts/cut/verify-provenance.mjs - the cut's proof: every file the lab handed over is here, byte for byte.

   The first cut (2026-11-01) copied the walkaround's production files from the lab repo (Slava12233/RealEstateTeam,
   private) at the tag walkaround/cut-2026-11-01, at their lab paths and with no git history. PROVENANCE.json records
   each file's sha256 and size; docs/rnd/HISTORY.md lists the lab commits behind each file. This script re-hashes them.

   Usage (from any directory):
     node scripts/cut/verify-provenance.mjs              the working tree against PROVENANCE.json
     node scripts/cut/verify-provenance.mjs --at <rev>   the committed bytes of <rev> (for example HEAD) against PROVENANCE.json
     node scripts/cut/verify-provenance.mjs --move-list <MOVE-LIST.tsv>
                                                         cut time only: the lab's reviewed move list (its MOVE rows) is the
                                                         source; when PROVENANCE.json exists too, the two must agree file by file

   The first line is «files N · sha256 mismatches M · missing K · extra E». Exit 0 only when M, K and E are 0 (and the two
   sources agree when both are read); exit 1 on a difference; exit 2 on a usage error.
   - «missing»: a provenance file that is absent, or present on disk but ignored by a .gitignore rule (it would not be committed).
   - «extra»: a file that is neither in the provenance nor one of the cut's own files (PROVENANCE.json's cutFiles).
   Later changes edit moved files in place, and every later card adds files, so after the cut the working-tree run
   reports them. To re-prove the cut itself, run it with --at <the cut's last commit>.
   Read-only. Prints paths and counts, never file content. Node built-ins only. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// the cut's own files, used before PROVENANCE.json exists (afterwards its cutFiles field is the list)
const DEFAULT_CUT_FILES = ['.gitignore', '.gitattributes', '.gitleaks.toml', 'PROVENANCE.json', 'docs/rnd/HISTORY.md',
  'scripts/cut/verify-provenance.mjs', 'scripts/cut/gen-history.mjs'];

const USAGE = 'usage: node scripts/cut/verify-provenance.mjs [--at <rev>] [--move-list <MOVE-LIST.tsv>]';
function fail(msg) { console.error(`verify-provenance: ${msg}\n${USAGE}`); process.exit(2); }

// ── arguments ──
const argv = process.argv.slice(2);
let at = null, moveListPath = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--help' || a === '-h') { console.log(USAGE); process.exit(0); }
  else if (a === '--at' || a === '--move-list') {
    const v = argv[++i];
    if (!v || v.startsWith('--')) fail(`${a} needs a value`);
    if (a === '--at') at = v; else moveListPath = path.resolve(v);
  } else fail(`unknown argument ${a}`);
}

const git = (args) => execFileSync('git', ['-C', ROOT, ...args], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] });
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// ── the expected files ──
function readProvenance() {
  const f = path.join(ROOT, 'PROVENANCE.json');
  if (!fs.existsSync(f)) return null;
  let j;
  try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { fail(`PROVENANCE.json does not parse: ${e.message}`); }
  if (!Array.isArray(j.files)) fail('PROVENANCE.json has no files array');
  return j;
}
function readMoveList(file) {
  if (!fs.existsSync(file)) fail(`no move list at ${file}`);
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
  const head = lines.shift().split('\t');
  const ix = Object.fromEntries(head.map((h, i) => [h, i]));
  for (const k of ['path', 'sha256', 'bytes', 'fate']) if (!(k in ix)) fail(`the move list has no ${k} column`);
  return lines.map((l) => l.split('\t')).filter((c) => c[ix.fate] === 'MOVE')
    .map((c) => ({ path: c[ix.path], sha256: c[ix.sha256], bytes: Number(c[ix.bytes]) }));
}

const prov = readProvenance();
const fromList = moveListPath ? readMoveList(moveListPath) : null;
if (!prov && !fromList) fail('PROVENANCE.json is missing (at the cut, pass --move-list <MOVE-LIST.tsv>)');
const expected = prov ? prov.files : fromList;
const cutFiles = prov && Array.isArray(prov.cutFiles) ? prov.cutFiles : DEFAULT_CUT_FILES;
const dupes = expected.length - new Set(expected.map((f) => f.path)).size;
if (dupes) fail(`the source lists ${dupes} path(s) twice`);

// both sources read: they must agree file by file
let disagree = null;
const disagreeLines = [];
if (prov && fromList) {
  const a = new Map(prov.files.map((f) => [f.path, f]));
  const b = new Map(fromList.map((f) => [f.path, f]));
  for (const [p, f] of b) {
    const g = a.get(p);
    if (!g) disagreeLines.push(`ONLY-IN-MOVE-LIST ${p}`);
    else if (g.sha256 !== f.sha256 || g.bytes !== f.bytes) disagreeLines.push(`SOURCES-DIFFER ${p}`);
  }
  for (const p of a.keys()) if (!b.has(p)) disagreeLines.push(`ONLY-IN-PROVENANCE ${p}`);
  disagree = disagreeLines.length;
}

// ── the actual files ──
function isOwnWorkTree() {
  try {
    const top = git(['rev-parse', '--show-toplevel']).toString().trim();
    return path.resolve(top).toLowerCase() === ROOT.toLowerCase();
  } catch { return false; }
}

function actualWorkingTree() {
  const actual = new Map();
  let listed;
  if (isOwnWorkTree()) {
    // tracked files plus untracked files that no .gitignore rule hides: what a commit can hold
    listed = git(['ls-files', '-z', '--cached', '--others', '--exclude-standard']).toString('utf8').split('\0').filter(Boolean);
    listed = [...new Set(listed)];
  } else {
    listed = [];
    (function walk(dir) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === '.git' && dir === ROOT) continue;
        const abs = path.join(dir, e.name);
        if (e.isDirectory()) walk(abs); else listed.push(path.relative(ROOT, abs).split(path.sep).join('/'));
      }
    })(ROOT);
  }
  for (const p of listed) {
    const abs = path.join(ROOT, p);
    let buf;
    try { buf = fs.readFileSync(abs); } catch { continue; } // tracked but deleted on disk: missing
    actual.set(p, { sha256: sha256(buf), bytes: buf.length });
  }
  return actual;
}

function actualAt(rev) {
  try { git(['rev-parse', '--verify', '--quiet', `${rev}^{tree}`]); } catch { fail(`${rev} is not a commit or tree here`); }
  const entries = git(['ls-tree', '-r', '-z', '--long', rev]).toString('utf8').split('\0').filter(Boolean).map((e) => {
    const tab = e.indexOf('\t');
    const [mode, type, oid, size] = e.slice(0, tab).split(/\s+/);
    return { mode, type, oid, size, p: e.slice(tab + 1) };
  });
  const blobs = entries.filter((e) => e.type === 'blob');
  const actual = new Map(entries.filter((e) => e.type !== 'blob').map((e) => [e.p, { sha256: `(${e.type})`, bytes: -1 }]));
  if (!blobs.length) return Promise.resolve(actual);
  // one `git cat-file --batch` pass; chunks are joined only per header or per blob
  return new Promise((resolve, reject) => {
    const cp = spawn('git', ['-C', ROOT, 'cat-file', '--batch'], { stdio: ['pipe', 'pipe', 'inherit'] });
    let chunks = [], len = 0, i = 0, need = -1;
    const joined = () => { if (chunks.length > 1) chunks = [Buffer.concat(chunks, len)]; return chunks[0] || Buffer.alloc(0); };
    const drop = (n) => { const rest = joined().subarray(n); chunks = rest.length ? [rest] : []; len = rest.length; };
    cp.stdout.on('data', (chunk) => {
      chunks.push(chunk); len += chunk.length;
      for (;;) {
        if (need < 0) {
          const all = joined(); const nl = all.indexOf(10); if (nl < 0) break;
          const [oid, type, size] = all.subarray(0, nl).toString().split(' '); drop(nl + 1);
          if (type !== 'blob' || oid !== blobs[i].oid) { cp.kill(); return reject(new Error(`cat-file answered ${oid} ${type} for ${blobs[i].p}`)); }
          need = Number(size) + 1;
        }
        if (len < need) break;
        const content = joined().subarray(0, need - 1);
        actual.set(blobs[i].p, { sha256: sha256(content), bytes: content.length });
        drop(need); need = -1; i++;
      }
    });
    cp.on('error', reject);
    cp.on('close', (code) => (code === 0 && i === blobs.length ? resolve(actual) : reject(new Error(`cat-file exit ${code} after ${i} of ${blobs.length}`))));
    cp.stdin.end(blobs.map((b) => b.oid).join('\n') + '\n');
  });
}

const actual = at ? await actualAt(at) : actualWorkingTree();

// ── compare ──
const want = new Map(expected.map((f) => [f.path, f]));
const mismatches = [], missing = [], ignored = [];
for (const f of expected) {
  const got = actual.get(f.path);
  if (!got) { (!at && fs.existsSync(path.join(ROOT, f.path)) ? ignored : missing).push(f.path); continue; }
  if (got.sha256 !== f.sha256 || got.bytes !== f.bytes) mismatches.push(f.path);
}
const extra = [...actual.keys()].filter((p) => !want.has(p) && !cutFiles.includes(p)).sort();
const ownPresent = cutFiles.filter((p) => actual.has(p)).length;
const totalBytes = expected.reduce((s, f) => s + f.bytes, 0);

console.log(`files ${expected.length} · sha256 mismatches ${mismatches.length} · missing ${missing.length + ignored.length} · extra ${extra.length}`);
console.log(`checked ${at ? `the commit ${at}` : 'the working tree'} · source ${prov ? 'PROVENANCE.json' : 'the move list'}${prov && fromList ? ' (and the move list)' : ''}`
  + ` · ${totalBytes.toLocaleString('en-US')} bytes · the cut's own files present ${ownPresent} of ${cutFiles.length}`);
if (disagree !== null) console.log(`PROVENANCE.json against the move list: files ${fromList.length} · differ ${disagree}`);
for (const p of mismatches) console.log(`MISMATCH ${p}`);
for (const p of missing) console.log(`MISSING ${p}`);
for (const p of ignored) console.log(`IGNORED ${p} (on disk, but a .gitignore rule hides it from a commit)`);
for (const p of extra) console.log(`EXTRA ${p}`);
for (const l of disagreeLines) console.log(l);
process.exit(mismatches.length || missing.length || ignored.length || extra.length || disagree ? 1 : 0);
