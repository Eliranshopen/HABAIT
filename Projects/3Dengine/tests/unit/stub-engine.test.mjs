import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createStubEngine, createDoctorCache, configEnv, tourDir, stubSiteCheck, runnerAlive, runnerPidFile, spawnRunnerDefault,
  MODE, RUNNER, INSPECT_MODE, chooseCandidate,
} from '../../mcp/stub-engine.mjs';
import { readJob, writeJob, updateJob, setState } from '../../engine/jobs.mjs';
import { EngineError } from '../../engine/inbox.mjs';
import { validate } from '../../mcp/schema-check.mjs';
import { loadTools } from '../../mcp/tools.mjs';
import { stubConfig, writeFile, PDF_BYTES, SECRET, holdLock } from '../helpers/fakes.mjs';

const TOOLS = Object.fromEntries(loadTools().map((t) => [t.name, t]));
const T = '2026-11-16T18:00:00.000Z';

// A scripted first look (contract 1.1 §1): what engine/inspect.mjs answers for a one-page sheet with a
// drawing. The unit tests of the tools never start Python; the real scanner runs in tests/milestones/m1.1.
const P1 = Object.freeze({ id: 'p1', label: 'עמוד 1', page: 1, source: 'page', vector_paths: 300, large_images: 0 });
const SHEET = Object.freeze({ pages: 1, kind: 'sheet', cached: false,
  page_rows: [{ page: 1, width_pt: 842, height_pt: 595, vector_paths: 300, images: 0, large_images: 0, content: 'vector' }], candidates: [P1] });

function setup(over = {}) {
  const config = stubConfig();
  writeFile(`${config.home}/inbox/plan.pdf`, PDF_BYTES);
  const spawned = [];
  const served = [];
  const looks = [];
  const eng = createStubEngine(config, {
    inspect: (c, file) => { looks.push(file); return SHEET; },
    now: () => T,
    spawnRunner: (c, id) => spawned.push(id),
    isRunnerAlive: () => false,
    ensureServe: async (c) => { served.push(c.serve.port); return { listening: true }; },
    doctor: { get: async () => ({ at: T, ready: false, ready_except_keys: true,
      checks: [{ id: 'node', kind: 'runtime', ok: true, detail: 'v24' }, { id: 'keys', kind: 'keys', ok: false, detail: 'FAL_KEY: missing', missing: ['FAL_KEY'] }] }) },
    version: '0.2.0',
    ...over,
  });
  return { config, eng, h: eng.handlers, spawned, served, looks, pdf: `${config.home}/inbox/plan.pdf` };
}

const out = (name, value) => assert.deepEqual(validate(TOOLS[name].outputSchema, value), [], name);

async function code(p) {
  try {
    await p();
  } catch (e) {
    assert.ok(e instanceof EngineError, e.stack);
    return e.code;
  }
  return 'no error';
}

test('engine_status: doctor checks + stub-site; mode stub; missing = failed ids', async () => {
  const { h } = setup();
  const s = await h.engine_status();
  out('engine_status', s);
  assert.equal(s.mode, MODE);
  assert.equal(s.ready, false);
  assert.equal(s.ready_except_keys, true);
  assert.deepEqual(s.missing, ['keys']);
  assert.deepEqual(s.checks.at(-1).id, 'stub-site');
  assert.equal(s.checked_at, T);
});

test('engine_status: no doctor result yet → not ready, a pending check; missing site → not ready', async () => {
  const { h, config } = setup({ doctor: { get: async () => null } });
  const s = await h.engine_status();
  out('engine_status', s);
  assert.equal(s.ready_except_keys, false);
  assert.equal(s.checked_at, null);
  assert.deepEqual(s.missing, ['doctor']);
  fs.rmSync(`${config.stub.siteRoot}/tour/index.html`);
  assert.equal(stubSiteCheck(config).ok, false);
  const { h: h2 } = setup({ doctor: { get: async () => ({ at: T, ready: true, ready_except_keys: true, checks: [] }) } });
  assert.equal((await h2.engine_status()).ready, true);
});

test('inspect_plan: sha256, bytes, and the first look as it is: mode real, pages, kind, rows, candidates', () => {
  const { h, pdf, looks } = setup();
  const r = h.inspect_plan({ pdf_path: pdf });
  out('inspect_plan', r);
  assert.equal(r.mode, INSPECT_MODE);
  assert.equal(INSPECT_MODE, 'real');
  assert.equal(r.bytes, PDF_BYTES.length);
  assert.match(r.sha256, /^[0-9a-f]{64}$/);
  assert.deepEqual([r.pages, r.kind], [1, 'sheet']);
  assert.deepEqual(r.page_rows, SHEET.page_rows);
  assert.deepEqual(r.candidates, [P1]);
  assert.equal('cached' in r, false, 'the tool answers what the schema names, nothing else');
  // The look is asked for the checked file and the hash of its bytes.
  assert.equal(looks.length, 1);
  assert.equal(looks[0].sha256, r.sha256);
  assert.equal(looks[0].path, r.pdf_path);
  // A booklet's candidates carry their own fields through the output schema.
  const book = { pages: 3, kind: 'booklet', cached: true,
    page_rows: [1, 2, 3].map((page) => ({ page, width_pt: 595, height_pt: 842, vector_paths: 4, images: 1, large_images: 1, content: 'image' })),
    candidates: [2, 3].map((page) => ({ id: `p${page}-x${page + 10}`, label: `עמוד ${page} · תמונה 1`, page, source: 'image', px: [2480, 1754], thumb: `C:/t/thumb-p${page}.jpg` })) };
  const b = setup({ inspect: () => book });
  out('inspect_plan', b.h.inspect_plan({ pdf_path: b.pdf }));
  // What the look throws is the tool's answer.
  const bad = setup({ inspect: () => { throw new EngineError('TOOLCHAIN_MISSING', 'no python'); } });
  assert.throws(() => bad.h.inspect_plan({ pdf_path: bad.pdf }), (e) => e instanceof EngineError && e.code === 'TOOLCHAIN_MISSING');
});

test('chooseCandidate: the one that was asked for; the only one when none is asked; otherwise NO_PLAN_FOUND with the ids', () => {
  const two = [P1, { ...P1, id: 'p2-x7', page: 2 }];
  assert.equal(chooseCandidate([P1]), P1);
  assert.equal(chooseCandidate([P1], null), P1);
  assert.equal(chooseCandidate(two, 'p2-x7').id, 'p2-x7');
  const fails = (fn, re) => assert.throws(fn, (e) => e instanceof EngineError && e.code === 'NO_PLAN_FOUND' && re.test(e.message), String(re));
  fails(() => chooseCandidate([]), /^no drawing was found in this PDF$/);
  fails(() => chooseCandidate([], 'p1'), /^"p1" is not a drawing of this PDF; no drawing was found in this PDF$/);
  fails(() => chooseCandidate(two), /^this PDF has 2 drawings; choose one \(candidates: p1, p2-x7\)$/);
  fails(() => chooseCandidate(two, 'apt846'), /^"apt846" is not a drawing of this PDF; candidates: p1, p2-x7$/);
  // An id that is not an id is never echoed.
  fails(() => chooseCandidate(two, 'x'.repeat(200)), /^that id is not a drawing of this PDF/);
  fails(() => chooseCandidate(two, 'a b<script>'), /^that id is not a drawing of this PDF/);
  fails(() => chooseCandidate(two, 7), /^that id is not a drawing/);
});

test('start_simulation: creates job + input copy + one runner; again → same job, no second job', () => {
  const { h, pdf, spawned, config } = setup();
  const a = h.start_simulation({ pdf_path: pdf, budget_cap_usd: 30 });
  out('start_simulation', a);
  assert.equal(a.created, true);
  assert.equal(a.job.state, 'queued');
  assert.equal(a.job.cost.cap_usd, 30);
  assert.equal(a.job.input.pdf_name, 'plan.pdf');
  assert.equal(a.job.input.apartment, 'p1', 'left out: the only candidate');
  assert.equal(a.job.input.pdf_bytes, PDF_BYTES.length);
  // The intake (contract 1.1 §3): the job's own copy, with the PDF's bytes, read-only.
  assert.ok(a.job.input.pdf_path.endsWith(`/${a.job_id}/input/source.pdf`));
  assert.equal(fs.readFileSync(a.job.input.pdf_path, 'utf8'), PDF_BYTES);
  assert.equal(fs.statSync(a.job.input.pdf_path).mode & 0o222, 0, 'read-only');
  assert.throws(() => fs.appendFileSync(a.job.input.pdf_path, 'x'));
  assert.deepEqual(spawned, [a.job_id]);
  const b = h.start_simulation({ pdf_path: pdf, apartment: 'p1' });
  assert.equal(b.created, false);
  assert.equal(b.job_id, a.job_id);
  assert.deepEqual(spawned, [a.job_id, a.job_id], 'a dead runner is restarted');
  assert.equal(fs.readdirSync(config.jobsDir).length, 1);
});

test('start_simulation: a live runner is not doubled; a terminal job gets no runner', () => {
  const { h, pdf, spawned, config } = setup({ isRunnerAlive: () => true });
  const a = h.start_simulation({ pdf_path: pdf });
  h.start_simulation({ pdf_path: pdf });
  assert.equal(spawned.length, 1);
  updateJob(config.jobsDir, a.job_id, (j) => setState(j, 'cancelled', T));
  const { eng } = setup();
  assert.equal(eng.ensureRunner({ job_id: a.job_id, state: 'done' }), false);
});

test('start_simulation: unknown apartment → NO_PLAN_FOUND; bad path → PATH_NOT_ALLOWED', async () => {
  const { h, pdf, config } = setup();
  assert.equal(await code(() => h.start_simulation({ pdf_path: pdf, apartment: 'apt1' })), 'NO_PLAN_FOUND');
  assert.equal(await code(() => h.start_simulation({ pdf_path: pdf, apartment: 'apt846' })), 'NO_PLAN_FOUND', 'the old id of the stub is no candidate');
  assert.equal(await code(() => h.start_simulation({ pdf_path: `${config.home}/x.pdf` })), 'PATH_NOT_ALLOWED');
  assert.equal(fs.existsSync(config.jobsDir), false, 'a refused start leaves no job folder');
});

test('start_simulation: a PDF with no drawing, and one with several and none chosen, start no job', async () => {
  const none = setup({ inspect: () => ({ ...SHEET, candidates: [] }) });
  assert.equal(await code(() => none.h.start_simulation({ pdf_path: none.pdf })), 'NO_PLAN_FOUND');
  assert.equal(fs.existsSync(none.config.jobsDir), false);
  assert.deepEqual(none.spawned, []);
  const many = setup({ inspect: () => ({ ...SHEET, kind: 'booklet', candidates: [P1, { ...P1, id: 'p2-x9', page: 2 }] }) });
  assert.equal(await code(() => many.h.start_simulation({ pdf_path: many.pdf })), 'NO_PLAN_FOUND');
  const a = many.h.start_simulation({ pdf_path: many.pdf, apartment: 'p2-x9' });
  const b = many.h.start_simulation({ pdf_path: many.pdf, apartment: 'p1' });
  assert.equal(a.job.input.apartment, 'p2-x9');
  assert.notEqual(a.job_id, b.job_id, 'another drawing of the same PDF is another job');
});

test('start_simulation: the upload changes between its hash and the copy: no job, no copy left', async () => {
  // The look swaps the upload, the way a second writer would between the hash and the intake.
  const t = setup({ inspect: () => {
    fs.writeFileSync(`${t.config.home}/inbox/plan.pdf`, `${PDF_BYTES}% other bytes`);
    return SHEET;
  } });
  assert.equal(await code(() => t.h.start_simulation({ pdf_path: t.pdf })), 'NOT_A_PDF');
  assert.deepEqual(t.spawned, []);
  const folders = fs.existsSync(t.config.jobsDir) ? fs.readdirSync(t.config.jobsDir) : [];
  assert.equal(folders.length, 1, 'only the folder that held the lock');
  for (const f of folders) {
    assert.equal(fs.existsSync(`${t.config.jobsDir}/${f}/job.json`), false, 'no job file');
    assert.deepEqual(fs.readdirSync(`${t.config.jobsDir}/${f}/input`), [], 'no copy and no temp file');
  }
});

test('get_job / approve / cancel / get_result: reason codes and the happy path', async () => {
  const { h, pdf, spawned, served, config } = setup();
  const none = '0000000000000000';
  for (const n of ['get_job', 'cancel_job', 'get_result']) assert.equal(await code(() => h[n]({ job_id: none })), 'JOB_NOT_FOUND', n);
  assert.equal(await code(() => h.approve_paid_stage({ job_id: none, cap_usd: 60 })), 'JOB_NOT_FOUND');
  const { job_id } = h.start_simulation({ pdf_path: pdf });
  out('get_job', h.get_job({ job_id }));
  assert.equal(await code(() => h.approve_paid_stage({ job_id, cap_usd: 60 })), 'NOT_AWAITING_APPROVAL');
  assert.equal(await code(() => h.get_result({ job_id })), 'NOT_DONE');
  updateJob(config.jobsDir, job_id, (j) => {
    setState(j, 'awaiting_approval', T);
    j.quote = { estimate_usd: 48, range_usd: [40, 60], rooms: 11, basis: 'b' };
    return j;
  });
  assert.equal(await code(() => h.approve_paid_stage({ job_id, cap_usd: 47.99 })), 'BUDGET_CAP');
  const before = spawned.length;
  const ap = h.approve_paid_stage({ job_id, cap_usd: 48 });
  out('approve_paid_stage', ap);
  assert.deepEqual(ap.job.approval, { cap_usd: 48, at: T });
  assert.equal(ap.job.cost.cap_usd, 48);
  assert.equal(spawned.length, before + 1, 'approve restarts a missing runner');
  updateJob(config.jobsDir, job_id, (j) => {
    setState(j, 'done', T);
    j.result = { local_url: 'http://127.0.0.1:1/tour/?scope=apartment', tour_dir: tourDir(config) };
    return j;
  });
  const r = await h.get_result({ job_id });
  out('get_result', r);
  assert.deepEqual(r, { job_id, mode: 'stub', local_url: 'http://127.0.0.1:1/tour/?scope=apartment', tour_dir: tourDir(config),
    rooms: 11, deviations: [], cost: { spent_usd: 0, cap_usd: 48 } });
  assert.deepEqual(served, [1]);
  const c = h.cancel_job({ job_id });
  assert.equal(c.job.state, 'done', 'a terminal job is not cancelled');
  out('cancel_job', c);
});

test('approve with no quote on the job → estimate 0; cancel a live job keeps its percent', () => {
  const { h, pdf, config } = setup();
  const { job_id } = h.start_simulation({ pdf_path: pdf });
  updateJob(config.jobsDir, job_id, (j) => setState(j, 'awaiting_approval', T));
  assert.equal(h.approve_paid_stage({ job_id, cap_usd: 0 }).job.approval.cap_usd, 0);
  const c = h.cancel_job({ job_id });
  assert.equal(c.job.state, 'cancelled');
  assert.equal(c.job.percent, 55);
});

test('an unknown job id creates no folder', async () => {
  const { h, config } = setup();
  await code(() => h.cancel_job({ job_id: '0000000000000000' }));
  await code(() => h.approve_paid_stage({ job_id: '0000000000000000', cap_usd: 1 }));
  assert.equal(fs.existsSync(`${config.jobsDir}/0000000000000000`), false);
  assert.equal(readJob(config.jobsDir, '0000000000000000'), null);
});

test('list_jobs: newest first, default 10', () => {
  const { h, pdf, config } = setup();
  assert.deepEqual(h.list_jobs({}).jobs, []);
  h.start_simulation({ pdf_path: pdf });
  writeFile(`${config.home}/inbox/b.pdf`, PDF_BYTES + '%b\n');
  h.start_simulation({ pdf_path: `${config.home}/inbox/b.pdf` });
  const r = h.list_jobs();
  out('list_jobs', r);
  assert.equal(r.jobs.length, 2);
  assert.equal(h.list_jobs({ limit: 1 }).jobs.length, 1);
});

test('configEnv points a child at the same home, jobs, port and step; tourDir; runner pid file', () => {
  const config = stubConfig({ serve: { host: '127.0.0.1', port: 9999 } });
  const env = configEnv(config, { PATH: 'p' });
  assert.deepEqual(env, { PATH: 'p', ENGINE_HOME: config.home, ENGINE_JOBS_DIR: config.jobsDir, ENGINE_SERVE_PORT: '9999', ENGINE_STUB_STEP_MS: '5' });
  assert.equal(tourDir(config), `${config.stub.siteRoot}/tour`);
  const id = 'abcdef0123456789';
  assert.equal(runnerAlive(config, id), false);
  writeFile(runnerPidFile(config, id), String(process.pid));
  assert.equal(runnerAlive(config, id), true);
  writeFile(runnerPidFile(config, id), 'junk');
  assert.equal(runnerAlive(config, id), false);
  assert.match(RUNNER.replace(/\\/g, '/'), /engine\/runner\.mjs$/);
});

test('spawnRunnerDefault starts the real runner detached; for an unknown job it exits at once', async () => {
  const config = stubConfig();
  writeFile(`${config.home}/engine.config.json`, fs.readFileSync(new URL('../../engine.config.json', import.meta.url)));
  const pid = spawnRunnerDefault(config, '0000000000000000');
  assert.ok(pid > 0);
  const log = `${config.jobsDir}/0000000000000000/runner.log`;
  for (let i = 0; i < 100 && !/stopped: no-job/.test(fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : ''); i++) {
    await new Promise((r) => setTimeout(r, 50));
  }
  assert.match(fs.readFileSync(log, 'utf8'), /stopped: no-job/);
});

test('doctor cache: runs the child once, keeps the result in memory and on disk, never a key value', async () => {
  const config = stubConfig();
  let runs = 0;
  const report = { at: T, ready: false, ready_except_keys: true, checks: [{ id: 'keys', ok: false, detail: 'FAL_KEY: missing' }] };
  let now = Date.parse(T);
  const cache = createDoctorCache(config, { runChild: (cb) => { runs++; setTimeout(() => cb(null, JSON.stringify(report)), 5); return {}; },
    clock: () => now });
  assert.equal(cache.last, null);
  const r = await cache.get(1000);
  assert.equal(r.ready_except_keys, true);
  assert.equal(runs, 1);
  await cache.get(1000);
  assert.equal(runs, 1, 'fresh result reused');
  const disk = JSON.parse(fs.readFileSync(`${config.runtimeDir}/doctor.json`, 'utf8'));
  assert.equal(disk.at, T);
  assert.ok(!JSON.stringify(disk).includes(SECRET));
  // a new cache starts from the file; stale → refresh in the background, the old answer comes at once
  now += 11 * 60 * 1000;
  let release;
  const cache2 = createDoctorCache(config, { runChild: (cb) => { runs++; release = () => cb(null, 'not json'); return { kill() { this.killed = true; } }; },
    clock: () => now });
  assert.equal((await cache2.get(10)).at, T);
  assert.equal(runs, 2);
  cache2.stop();
  release();
  const after = await cache2.kick() ?? cache2.last;
  assert.match(after.checks[0].detail, /readiness check failed: no JSON/);
});

test('doctor cache: a slow first run → get returns null after the wait; an error is reported', async () => {
  const config = stubConfig();
  let finish;
  const cache = createDoctorCache(config, { runChild: (cb) => { finish = cb; return {}; } });
  assert.equal(await cache.get(20), null);
  finish(new Error('spawn failed\nmore'), '');
  await new Promise((r) => setImmediate(r));
  assert.match(cache.last.checks[0].detail, /readiness check failed: spawn failed$/);
  cache.stop();
});

test('doctor cache default child: the real CLI on a temp home answers with JSON', async () => {
  const config = stubConfig();
  writeFile(`${config.home}/engine.config.json`, fs.readFileSync(new URL('../../engine.config.json', import.meta.url)));
  const cache = createDoctorCache({ ...config, runtimeDir: `${config.home}/.runtime` });
  cache.kick();
  let r = null;
  for (let i = 0; i < 300 && !r; i++) {
    await new Promise((res) => setTimeout(res, 100));
    r = cache.last;
  }
  assert.ok(r, 'the doctor answered');
  assert.equal(r.ready, false, 'a temp home has no python environment');
  assert.ok(r.checks.some((c) => c.id === 'python'));
});

test('0.3: start_simulation resumes a stalled job, restarts a cancelled one; get_job and list_jobs carry the computed runner', () => {
  let alive = false;
  const { h, pdf, spawned, config } = setup({ isRunnerAlive: () => alive });
  const a = h.start_simulation({ pdf_path: pdf });
  assert.equal(a.resumed, false);
  out('start_simulation', a);
  updateJob(config.jobsDir, a.job_id, (j) => setState(j, 'rendering', T));
  const b = h.start_simulation({ pdf_path: pdf });
  assert.deepEqual([b.created, b.resumed, spawned.length], [false, true, 2]);
  out('start_simulation', b);
  alive = true;
  assert.equal(h.start_simulation({ pdf_path: pdf }).resumed, false, 'a live runner: nothing starts');
  const g = h.get_job({ job_id: a.job_id });
  out('get_job', g);
  assert.equal(g.job.runner.alive, true);
  assert.equal(readJob(config.jobsDir, a.job_id).runner, undefined, 'never written to the file');
  const l = h.list_jobs({});
  out('list_jobs', l);
  assert.equal(l.jobs[0].runner.alive, true);
  h.cancel_job({ job_id: a.job_id });
  const c = h.start_simulation({ pdf_path: pdf });
  out('start_simulation', c);
  assert.deepEqual([c.created, c.resumed, c.job.state, c.job.reason], [false, true, 'tracing', null]);
  assert.equal(spawned.length, 3, 'a restarted job always gets a new runner');
  updateJob(config.jobsDir, a.job_id, (j) => setState(j, 'done', T));
  assert.equal(h.start_simulation({ pdf_path: pdf }).resumed, false);
});

// ---- round 6 (QA round 5, defect D3): the tools report what the LEDGER says was spent ----
import { writeLedger as writeLedgerR6, LEDGER_SCHEMA_ID as LEDGER_ID_R6 } from '../../engine/ledger.mjs';

test('D3: get_job, list_jobs and get_result report the ledger\'s settled total and put the copy in job.json right', async () => {
  const { config, h, pdf } = setup();
  const { job_id } = h.start_simulation({ pdf_path: pdf });
  // The job is done; its file says 1.8 was spent, but a late answer was settled after that and its runner
  // was killed before it could copy the new total (QA round 5): the ledger says 2.4.
  updateJob(config.jobsDir, job_id, (j) => {
    setState(j, 'done', T);
    j.cost = { spent_usd: 1.8, cap_usd: 60 };
    j.result = { local_url: 'http://127.0.0.1:8123/tour/', tour_dir: `${config.home}/site/tour` };
    return j;
  });
  const settled = (seq, stage, extra = {}) => ({ seq, call_key: String(seq).repeat(64).slice(0, 64), stage, provider: 'stub', what: 'w',
    reserved_usd: 0.6, reserved_at: T, sending_at: T, status: 'settled', settled_usd: 0.6, settled_at: T, answer_sha256: 'a'.repeat(64), attempt: 1, ...extra });
  writeLedgerR6(config.jobsDir, { schema: LEDGER_ID_R6, job_id, cap_usd: 60,
    rows: [settled(1, 'skinning', { late: true }), settled(2, 'skinning'), settled(3, 'gating'), settled(4, 'finishing')] });
  assert.equal(readJob(config.jobsDir, job_id).cost.spent_usd, 1.8);

  const r = await h.get_result({ job_id });
  out('get_result', r);
  assert.deepEqual(r.cost, { spent_usd: 2.4, cap_usd: 60 }, 'the ledger\'s total, not the stale copy');
  assert.equal(readJob(config.jobsDir, job_id).cost.spent_usd, 2.4, 'and the copy was put right');

  // the same through get_job and list_jobs; here the job lock is busy, so the copy cannot be written
  updateJob(config.jobsDir, job_id, (j) => { j.cost.spent_usd = 0; return j; });
  holdLock(`${config.jobsDir}/${job_id}/job.lock`);   // a lock held by a live process: busy for every writer
  try {
    const g = h.get_job({ job_id });
    out('get_job', g);
    assert.equal(g.job.cost.spent_usd, 2.4, 'the answer is the true number even when the copy could not be written');
    assert.equal(h.list_jobs({}).jobs.find((j) => j.job_id === job_id).cost.spent_usd, 2.4);
  } finally {
    fs.rmSync(`${config.jobsDir}/${job_id}/job.lock`, { recursive: true });
  }
  assert.equal(readJob(config.jobsDir, job_id).cost.spent_usd, 0, 'the lock was busy: the copy is still behind');
  assert.equal(h.get_job({ job_id }).job.cost.spent_usd, 2.4);
  assert.equal(readJob(config.jobsDir, job_id).cost.spent_usd, 2.4, 'the next read put it right');
  // a ledger that cannot be parsed at this moment: the copy is all there is, and nothing throws
  fs.writeFileSync(`${config.jobsDir}/${job_id}/ledger.json`, '{ not json');
  assert.equal(h.get_job({ job_id }).job.cost.spent_usd, 2.4);
});

// ---- QA round 2, D-3: no raw file error leaves start_simulation from the job-folder side ----

import { createHash as createHashD3 } from 'node:crypto';
import { jobId as jobIdD3 } from '../../engine/jobs.mjs';
import { isErrno } from '../../mcp/stub-engine.mjs';

const ID_D3 = jobIdD3({ pdfSha256: createHashD3('sha256').update(PDF_BYTES).digest('hex'), apartment: 'p1', mode: 'stub', version: '0.2.0' });
const NO_PATH_D3 = /[A-Za-z]:[\\/]|\/tmp\/|\\|EEXIST|EACCES|ENOTDIR/;

test('D-3: jobs/<id> is a file → NOT_A_PDF naming the job; the file is never overwritten; no lock, no runner', async () => {
  const { h, pdf, spawned, config } = setup();
  writeFile(`${config.jobsDir}/${ID_D3}`, 'a file, not a folder');
  let err = null;
  try {
    h.start_simulation({ pdf_path: pdf });
  } catch (e) {
    err = e;
  }
  assert.ok(err instanceof EngineError, String(err));
  assert.equal(err.code, 'NOT_A_PDF');
  assert.equal(err.message, `job ${ID_D3} holds something that is not a folder where its folder belongs; it is never overwritten`);
  assert.equal(fs.readFileSync(`${config.jobsDir}/${ID_D3}`, 'utf8'), 'a file, not a folder');
  assert.deepEqual(fs.readdirSync(config.jobsDir), [ID_D3]);
  assert.deepEqual(spawned, []);
});

test('D-3: a file error from the lock or from the write of the new job → TOOLCHAIN_MISSING with a fixed message, no path; the code goes to the log', () => {
  for (const [label, hit] of [
    ['the lock', (p) => p.includes(`/${ID_D3}/job.lock.`)],
    ['the write of the new job', (p) => p.includes(`/${ID_D3}/job.json.`)],
  ]) {
    const lines = [];
    const { h, pdf, spawned, config } = setup({ log: (m) => lines.push(m) });
    const real = fs.writeFileSync;
    fs.writeFileSync = function (p, ...rest) {
      if (hit(String(p).replace(/\\/g, '/'))) throw Object.assign(new Error(`EACCES: permission denied, open '${p}'`), { code: 'EACCES' });
      return real.call(this, p, ...rest);
    };
    let err = null;
    try {
      h.start_simulation({ pdf_path: pdf });
    } catch (e) {
      err = e;
    } finally {
      fs.writeFileSync = real;
    }
    assert.ok(err instanceof EngineError, `${label}: ${err}`);
    assert.equal(err.code, 'TOOLCHAIN_MISSING', label);
    assert.equal(err.message, `the folder of job ${ID_D3} cannot be used by the engine`, label);
    assert.doesNotMatch(err.message, NO_PATH_D3, label);
    assert.ok(!err.message.includes(config.home), label);
    assert.ok(lines.some((l) => l.includes(ID_D3) && l.includes('(EACCES)')), `${label}: ${lines.join('\n')}`);
    assert.ok(lines.every((l) => !l.includes(config.home)), 'no path in the log line either');
    assert.deepEqual(spawned, [], `${label}: no runner`);
    assert.equal(fs.existsSync(`${config.jobsDir}/${ID_D3}/job.json`), false, `${label}: no job file`);
    assert.equal(fs.existsSync(`${config.jobsDir}/${ID_D3}/job.lock`), false, `${label}: no lock left`);
  }
});

test('D-3: the engine\'s own errors pass as they are; an error with no errno code passes as it is', () => {
  assert.equal(isErrno(Object.assign(new Error('x'), { code: 'EPERM' })), true);
  assert.equal(isErrno(Object.assign(new Error('x'), { code: 'EIO' })), true);
  assert.equal(isErrno(Object.assign(new Error('x'), { code: 'NOT_A_PDF' })), false);
  assert.equal(isErrno(Object.assign(new Error('x'), { code: 'ERR_FS_EISDIR' })), true, "Node's own file errors carry a path too");
  assert.equal(isErrno(Object.assign(new Error('x'), { code: 'UNKNOWN' })), true, 'Windows gives UNKNOWN for some file errors');
  assert.equal(isErrno(Object.assign(new Error('x'), { code: 'ERR_INVALID_ARG_TYPE' })), false);
  assert.equal(isErrno(new Error('job x: lock busy')), false);
  assert.equal(isErrno(null), false);
  // a spawn that fails with a plain error: it is not turned into TOOLCHAIN_MISSING
  const { h, pdf } = setup({ spawnRunner: () => { throw new Error('plain failure'); } });
  assert.throws(() => h.start_simulation({ pdf_path: pdf }), (e) => !(e instanceof EngineError) && e.message === 'plain failure');
  // a foreign file at input/source.pdf is still the intake's own NOT_A_PDF
  const f = setup();
  writeFile(`${f.config.jobsDir}/${ID_D3}/input/source.pdf`, 'somebody else');
  assert.throws(() => f.h.start_simulation({ pdf_path: f.pdf }), (e) => e instanceof EngineError && e.code === 'NOT_A_PDF' && /already holds another file/.test(e.message));
});

// ------------------------------------------------------------------ QA round 3
import { OWN_FILES_FAILED } from '../../mcp/stub-engine.mjs';
import { UPLOAD_UNREADABLE } from '../../engine/inbox.mjs';

const errnoR3 = (code, p) => Object.assign(new Error(`${code}: some file error, open '${p}'`), { code });
const thrownBy = (fn) => {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return null;
};

test('QA round 3, D-1: an upload that another program holds → NOT_A_PDF from both tools, at the check and at the read; no look, no job', () => {
  for (const [label, method] of [['the check of the path (open)', 'openSync'], ['the read that gives the hash', 'readFileSync']]) {
    for (const tool of ['inspect_plan', 'start_simulation']) {
      const lines = [];
      const { h, pdf, spawned, looks, config } = setup({ log: (m) => lines.push(m) });
      const real = fs[method];
      fs[method] = function (p, ...rest) {
        if (String(p).replace(/\\/g, '/') === pdf) throw errnoR3('EBUSY', p);
        return real.call(this, p, ...rest);
      };
      let err;
      try {
        err = thrownBy(() => h[tool]({ pdf_path: pdf }));
      } finally {
        fs[method] = real;
      }
      assert.ok(err instanceof EngineError, `${label} · ${tool}: ${err}`);
      assert.equal(err.code, 'NOT_A_PDF', `${label} · ${tool}`);
      assert.equal(err.message, UPLOAD_UNREADABLE, `${label} · ${tool}`);
      assert.ok(lines.some((l) => l.includes('(EBUSY)')) && lines.every((l) => !l.includes(config.home)), lines.join('\n'));
      assert.deepEqual(looks, [], 'the first look was not asked for');
      assert.deepEqual(spawned, []);
      assert.equal(fs.existsSync(config.jobsDir), false, 'no job folder');
    }
  }
  // Gone between the check and the read: as for a file that is not there.
  const { h, pdf } = setup();
  const real = fs.readFileSync;
  fs.readFileSync = function (p, ...rest) {
    if (String(p).replace(/\\/g, '/') === pdf) throw errnoR3('ENOENT', p);
    return real.call(this, p, ...rest);
  };
  let gone;
  try {
    gone = thrownBy(() => h.inspect_plan({ pdf_path: pdf }));
  } finally {
    fs.readFileSync = real;
  }
  assert.equal(gone.code, 'NOT_A_PDF');
  assert.equal(gone.message, 'no such file');
});

test('QA round 3: a file error of the engine\'s own folders that reaches a tool\'s answer is TOOLCHAIN_MISSING, fixed message, no path', async () => {
  // `jobs` is a file: every tool that lists or reads a job.
  {
    const lines = [];
    const { h, config } = setup({ log: (m) => lines.push(m) });
    writeFile(config.jobsDir, 'a file where the jobs folder belongs');
    const real = fs.readdirSync;
    fs.readdirSync = function (p, ...rest) {
      if (String(p).replace(/\\/g, '/') === config.jobsDir) throw errnoR3('ENOTDIR', p);
      return real.call(this, p, ...rest);
    };
    let err;
    try {
      err = thrownBy(() => h.list_jobs({}));
    } finally {
      fs.readdirSync = real;
    }
    // listJobs itself answers an unreadable jobs folder with an empty list; a file error that still leaves it
    // must not reach the client raw.
    if (err) {
      assert.ok(err instanceof EngineError, String(err));
      assert.equal(err.code, 'TOOLCHAIN_MISSING');
      assert.equal(err.message, OWN_FILES_FAILED);
    }
  }
  // A read of a job's file that fails with a file error (not "no such file", not a folder): get_job, cancel_job.
  for (const tool of ['get_job', 'cancel_job', 'get_result', 'approve_paid_stage']) {
    const lines = [];
    const { h, pdf, config } = setup({ log: (m) => lines.push(m) });
    const id = h.start_simulation({ pdf_path: pdf }).job_id;
    const real = fs.readFileSync;
    fs.readFileSync = function (p, ...rest) {
      if (String(p).replace(/\\/g, '/').endsWith(`/${id}/job.json`)) throw errnoR3('EACCES', p);
      return real.call(this, p, ...rest);
    };
    let err;
    try {
      err = await (async () => h[tool]({ job_id: id, cap_usd: 60 }))().then(() => null, (e) => e);
    } finally {
      fs.readFileSync = real;
    }
    assert.ok(err instanceof EngineError, `${tool}: ${err}`);
    assert.equal(err.code, 'TOOLCHAIN_MISSING', tool);
    assert.equal(err.message, OWN_FILES_FAILED, tool);
    assert.ok(!err.message.includes(config.home) && !/[A-Za-z]:[\\/]/.test(err.message), tool);
    assert.ok(lines.some((l) => l.startsWith(`${tool}: `) && l.includes('(EACCES)')), `${tool}: ${lines.join('\n')}`);
    assert.ok(lines.every((l) => !l.includes(config.home)), 'no path in the log line');
  }
  // What is not a file error passes as it is (a busy lock, a programming error).
  {
    const { h, pdf } = setup();
    const id = h.start_simulation({ pdf_path: pdf }).job_id;
    const plain = new Error(`job ${id}: lock busy`);
    const real = fs.readFileSync;
    fs.readFileSync = function (p, ...rest) {
      if (String(p).replace(/\\/g, '/').endsWith(`/${id}/job.json`)) throw plain;
      return real.call(this, p, ...rest);
    };
    try {
      assert.equal(thrownBy(() => h.get_job({ job_id: id })), plain);
    } finally {
      fs.readFileSync = real;
    }
  }
  assert.equal(OWN_FILES_FAILED, 'the engine could not read or write its own files');
});
