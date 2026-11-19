// Milestone 0.1 — the engine home. Runs against the REAL environment: a missing environment
// FAILS here, it never skips. Plan §7.1 row 0.1: parity 41/41, catalog 57/57, ready except keys,
// and pipeline/ is byte-identical (git blob ids) to its source in commit a63494a.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadConfig, pipelineEnv } from '../../engine/config.mjs';
import { runDoctor, formatReport } from '../../engine/doctor.mjs';
import { run } from '../../engine/lib/run.mjs';
import { listFiles } from '../../engine/lib/files.mjs';

const config = loadConfig();
const PIPE = config.pipelineRoot;
const childEnv = () => ({ ...process.env, ...pipelineEnv(config) });

test('a. parity: run-project.mjs --parity → 41 rows · PASS', () => {
  const r = run(process.execPath, [`${PIPE}/Habait/tour360/tools/run-project.mjs`, '--parity'],
    { cwd: PIPE, env: childEnv(), timeoutMs: 120000 });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /parity: 41 rows · PASS/);
});

// On Windows another process (a `git status` of the editor, a virus scanner, an indexer) can hold a file for
// a moment, and an open then fails with EBUSY, EPERM, EACCES or UNKNOWN (seen 2026-11-17: UNKNOWN on the
// restore of the tracked report, which left it modified). A step on that file is tried again for a few seconds.
const HELD = new Set(['EBUSY', 'EPERM', 'EACCES', 'UNKNOWN']);
function patiently(step, ms = 10000) {
  const until = Date.now() + ms;
  for (;;) {
    try {
      return step();
    } catch (e) {
      if (!HELD.has(e.code) || Date.now() > until) throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
}

test('b. catalog: fetch.mjs --verify-only → 57/57 rows OK', () => {
  const report = `${PIPE}/360walkaround/catalog/fetch.report.json`;
  const before = fs.existsSync(report) ? patiently(() => fs.readFileSync(report)) : null;
  const verify = () => run(process.execPath, [`${PIPE}/360walkaround/catalog/fetch.mjs`, '--verify-only', '--no-import-test'],
    { cwd: PIPE, env: childEnv(), timeoutMs: 300000 });
  try {
    let r = verify();
    // The tool rewrites the same report file: when ITS write met a held file, it is run once more.
    if (r.status !== 0 && /\b(EBUSY|EPERM|EACCES|UNKNOWN)\b[^\n]*fetch\.report\.json/.test(r.stderr)) r = verify();
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /57\/57 rows OK/, r.stdout.split('\n').filter((l) => /rows OK|broken|FAIL/i.test(l)).join('\n'));
  } finally {
    // The report is a TRACKED file: it is put back byte for byte, whatever holds it for a moment.
    if (before) patiently(() => fs.writeFileSync(report, before));
    else if (fs.existsSync(report)) patiently(() => fs.rmSync(report));
  }
});

test('c. readiness: the doctor reports ready except keys', async () => {
  const result = await runDoctor(config);
  assert.equal(result.ready_except_keys, true, formatReport(result));
});

// --- d. port identity -------------------------------------------------------------------
const COMMIT = 'a63494a';
const SRC = 'Projects/Habait/habait-walkaround/';
const PREFIXES = ['360walkaround', 'Habait/tour360', 'Habait/tools', 'Habait/studio-web', 'Habait/engine', 'Habait/platform'];
const IGNORED = new Set(['models', 'hdri', 'node_modules', '.cache', '_local', '__pycache__']);
const SKIP_FILES = new Set(['360walkaround/catalog/fetch.report.json']);

function skipped(rel) {
  if (SKIP_FILES.has(rel) || rel.startsWith('Habait/platform/tools/_unused/')) return true;
  return rel.split('/').some((seg, i, all) => i < all.length - 1 && IGNORED.has(seg));
}

function git(args, input) {
  const r = run('git', ['-c', 'core.quotepath=off', ...args], { cwd: PIPE, timeoutMs: 120000, input });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
}

// The files PORT-CHANGES.md lists: path → the git blob id the list records for the changed file (null when it
// records none). A listed file is left out of the comparison with the commit and compared with ITS recorded blob
// instead, so it can differ from its source only in the way that was written down (QA of milestone 1.2, O-3:
// before, a listed file was left out whole, and a later edit of another line of it would have passed).
function portChanges() {
  const f = `${PIPE}/PORT-CHANGES.md`;
  const listed = new Map();
  if (!fs.existsSync(f)) return listed;
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const name = /`([^`\s]+\.[A-Za-z0-9]+)`/.exec(line);
    if (!name) continue;
    const blob = /`([0-9a-f]{40})`/.exec(line);
    listed.set(name[1], blob ? blob[1] : null);
  }
  return listed;
}

test('d. port identity: pipeline/ equals commit a63494a, blob for blob', () => {
  const specs = [...PREFIXES, '.gitignore', '.gitattributes'].map((p) => SRC + p);
  const tree = new Map();
  let ported = 0;
  for (const rec of git(['ls-tree', '-r', '-z', '--full-tree', COMMIT, '--', ...specs]).split('\0')) {
    if (!rec) continue;
    const [meta, full] = rec.split('\t');
    const [, type, blob] = meta.split(' ');
    if (type !== 'blob') continue;
    const rel = full.slice(SRC.length);
    if (SKIP_FILES.has(rel)) ported += 1; // ported, but rewritten by fetch.mjs: not compared
    else if (!skipped(rel)) { ported += 1; tree.set(rel, blob); }
  }
  assert.equal(ported, 1126, `files in ${COMMIT} under the ported prefixes`);

  const listed = portChanges();
  const exempt = new Set(['PORT-CHANGES.md', ...listed.keys()]);
  const disk = listFiles(PIPE).map((f) => f.slice(PIPE.length + 1)).filter((rel) => !skipped(rel));
  const ids = git(['hash-object', '--stdin-paths'], disk.map((rel) => `${PIPE}/${rel}`).join('\n') + '\n').trim().split(/\r?\n/);
  assert.equal(ids.length, disk.length);
  const onDisk = new Map(disk.map((rel, i) => [rel, ids[i]]));

  // a listed file: it is a file of the port, the list records the blob of its changed form, and the disk holds exactly that
  const notPorted = [...listed.keys()].filter((rel) => !tree.has(rel));
  const unpinned = [...listed].filter(([, blob]) => !blob).map(([rel]) => rel);
  const moved = [...listed].filter(([rel, blob]) => blob && onDisk.get(rel) !== blob).map(([rel]) => rel);
  const unchanged = [...listed].filter(([rel, blob]) => blob && tree.get(rel) === blob).map(([rel]) => rel);
  assert.deepEqual({ notPorted, unpinned, moved, unchanged }, { notPorted: [], unpinned: [], moved: [], unchanged: [] },
    'PORT-CHANGES.md: every listed file is a ported file, records the git blob id of its changed form, is exactly that form on the disk, and does differ from its source');

  // context files are kept current in place by the context-file generator (root §8.6), so their bytes are not compared
  const isContextFile = (rel) => rel === 'CLAUDE.md' || rel.endsWith('/CLAUDE.md');
  const differing = [...tree].filter(([rel, blob]) => onDisk.has(rel) && onDisk.get(rel) !== blob && !exempt.has(rel) && !isContextFile(rel)).map(([r]) => r);
  const missing = [...tree.keys()].filter((rel) => !onDisk.has(rel) && !exempt.has(rel));
  const extra = disk.filter((rel) => !tree.has(rel) && !exempt.has(rel) && !rel.endsWith('/CLAUDE.md') && rel !== 'CLAUDE.md');
  const show = (a) => `${a.length}${a.length ? `: ${a.slice(0, 10).join(', ')}` : ''}`;
  assert.deepEqual({ differing: differing.length, missing: missing.length, extra: extra.length },
    { differing: 0, missing: 0, extra: 0 },
    `differing ${show(differing)} · missing ${show(missing)} · extra ${show(extra)}`);
});
