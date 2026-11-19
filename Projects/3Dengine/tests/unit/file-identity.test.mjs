// A job's own files are read only when they are this job's (contract 1.1 §5). Carried from milestone 0.3:
// its eighth QA round showed that a hand-edited job.json or manifest.json that names another job, or none,
// made a runner write into that other job's file or create jobs/undefined/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import {
  newJob, writeJob, readJob, updateJob, checkJob, listJobs, setState, jobFile, JobUnreadable, JOB_SCHEMA_ID, STAGES,
} from '../../engine/jobs.mjs';
import {
  readManifest, writeManifest, appendRow, checkManifest, insideJob, emptyManifest, manifestFile, ManifestUnreadable, MANIFEST_SCHEMA_ID,
  readOwnJob, listOwnJobs,
} from '../../engine/manifest.mjs';
import { runRunner, runnerMain, notThisJobs } from '../../engine/runner.mjs';
import { restartJob, startOrResume } from '../../engine/control.mjs';
import { createStubEngine } from '../../mcp/stub-engine.mjs';
import { EngineError } from '../../engine/inbox.mjs';
import { main } from '../../engine/cli.mjs';
import { REGISTRY } from '../../engine/stages/index.mjs';
import { stubConfig, sink } from '../helpers/fakes.mjs';

const A = 'aaaaaaaaaaaaaaaa';
const B = 'bbbbbbbbbbbbbbbb';
const T = '2026-11-17T08:00:00.000Z';
const H = (c) => c.repeat(64);
const input = (c) => ({ pdf_path: 'C:/x/source.pdf', pdf_name: 'plan.pdf', pdf_sha256: H(c), apartment: 'p1' });

function job(id, state = 'queued', c = 'a') {
  const j = newJob({ id, mode: 'stub', now: T, input: input(c) });
  setState(j, state, T);
  return j;
}

// Two jobs in one jobs folder: A is the one a test spoils, B is the bystander.
function twoJobs(stateA = 'queued') {
  const c = stubConfig({ serve: { host: '127.0.0.1', port: 8123 } });
  const config = { ...c, runner: { ...c.runner, heartbeatMs: 10 } };
  writeJob(config.jobsDir, job(A, stateA, 'a'));
  writeJob(config.jobsDir, job(B, 'tracing', 'b'));
  writeManifest(config.jobsDir, emptyManifest(B));
  return config;
}

// Every file under a folder with the hash of its bytes: what a test compares before and after.
function snapshot(dir) {
  const out = {};
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else out[p.slice(dir.length + 1)] = createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    }
  };
  walk(dir);
  return out;
}

const put = (file, value) => fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2));

function runner(config, over = {}) {
  const logs = [];
  let t = Date.parse(T);
  return {
    logs,
    run: () => runRunner({ config, jobId: A, pid: 4242, now: () => new Date((t += 1000)).toISOString(), clock: () => t, sleep: async () => {},
      log: (m) => logs.push(m), ensureServe: async () => {}, alive: (p) => p === 4242, timer: () => () => {}, claimWaitMs: 0, approvalWaitMs: 0,
      verifyInput: () => ({ ok: true }), ...over }),   // these jobs are made by hand, with no PDF in their folder
  };
}

const unreadable = (fn, Kind, re) => assert.throws(fn, (e) => {
  assert.ok(e instanceof Kind, `${e.name}: ${e.message}`);
  assert.match(e.message, re);
  return true;
});

// ------------------------------------------------------------------ job.json

test('checkJob takes a job file of the id asked for, and names what is wrong with any other', () => {
  assert.equal(checkJob(job(A), A).job_id, A);
  const cases = [
    [null, /not a JSON object/], [[], /not a JSON object/], ['x', /not a JSON object/],
    [{ ...job(A), schema: 'habait/job.v0' }, /its schema is "habait\/job\.v0"/],
    [job(B), /it names job "bbbbbbbbbbbbbbbb"/],
    [(() => { const j = job(A); delete j.job_id; return j; })(), /it names job null/],
    [{ ...job(A), state: 'sleeping' }, /its state is "sleeping"/],
    [{ ...job(A), input: null }, /it has no input/], [{ ...job(A), input: [] }, /it has no input/],
    [{ ...job(A), cost: undefined }, /it has no cost/],
  ];
  for (const [value, re] of cases) {
    unreadable(() => checkJob(value, A), JobUnreadable, re);
    unreadable(() => checkJob(value, A), JobUnreadable, /^job aaaaaaaaaaaaaaaa: job\.json is not this job's file/);
  }
  // A long or multi-line value from the file is cut short in the message.
  unreadable(() => checkJob({ ...job(A), schema: `x\n${'y'.repeat(500)}` }, A), JobUnreadable, /^[^\n]{0,140}$/);
  const e = new JobUnreadable(A, 'why');
  assert.deepEqual([e.name, e.jobId, e.why], ['JobUnreadable', A, 'why']);
});

test('readJob: no file and a malformed id are null; a file that is not this job\'s throws', () => {
  const config = twoJobs();
  assert.equal(readJob(config.jobsDir, 'cccccccccccccccc'), null);
  assert.equal(readJob(config.jobsDir, '../x'), null);
  assert.equal(readJob(config.jobsDir, undefined), null);
  assert.equal(readJob(config.jobsDir, A).job_id, A);
  put(jobFile(config.jobsDir, A), job(B));
  unreadable(() => readJob(config.jobsDir, A), JobUnreadable, /it names job "bbbbbbbbbbbbbbbb"/);
  put(jobFile(config.jobsDir, A), '{ "job_id": "aaaaaaaaaaaaaaaa", ');
  unreadable(() => readJob(config.jobsDir, A), JobUnreadable, /it is not JSON/);
  put(jobFile(config.jobsDir, A), '[]');
  unreadable(() => readJob(config.jobsDir, A), JobUnreadable, /not a JSON object/);
});

test('writeJob and updateJob write only under the id asked for, and never a job that names another', () => {
  const config = twoJobs();
  const before = snapshot(config.jobsDir);
  // A job that names no id, or a thing that is no id: nothing is written, anywhere.
  const noId = job(A);
  delete noId.job_id;
  unreadable(() => writeJob(config.jobsDir, noId), JobUnreadable, /that is not a job id/);
  unreadable(() => writeJob(config.jobsDir, { ...job(A), job_id: '../evil' }), JobUnreadable, /that is not a job id/);
  unreadable(() => writeJob(config.jobsDir, null), JobUnreadable, /that is not a job id/);
  // Job B's content under job A's name, and the other way round.
  unreadable(() => writeJob(config.jobsDir, job(B), A), JobUnreadable, /it names job "bbbbbbbbbbbbbbbb"/);
  // A change that swaps the id inside the job is refused; the file stays as it was.
  unreadable(() => updateJob(config.jobsDir, A, (j) => ({ ...j, job_id: B })), JobUnreadable, /it names job "bbbbbbbbbbbbbbbb"/);
  unreadable(() => updateJob(config.jobsDir, A, (j) => { delete j.job_id; return j; }), JobUnreadable, /it names job null/);
  assert.deepEqual(snapshot(config.jobsDir), before);
  assert.equal(fs.existsSync(`${config.jobsDir}/undefined`), false);
  // An honest change is written, under A.
  const r = updateJob(config.jobsDir, A, (j) => setState(j, 'tracing', T));
  assert.equal(r.written, true);
  assert.equal(readJob(config.jobsDir, A).state, 'tracing');
  assert.equal(readJob(config.jobsDir, B).input.pdf_sha256, H('b'));
  // updateJob on a file that is not this job's: thrown, nothing written.
  put(jobFile(config.jobsDir, A), job(B));
  const spoiled = snapshot(config.jobsDir);
  unreadable(() => updateJob(config.jobsDir, A, (j) => setState(j, 'building', T)), JobUnreadable, /it names job/);
  assert.deepEqual(snapshot(config.jobsDir), spoiled);
});

test('listJobs leaves out a folder whose job.json is not that job\'s', () => {
  const config = twoJobs();
  assert.deepEqual(listJobs(config.jobsDir).map((j) => j.job_id).sort(), [A, B]);
  put(jobFile(config.jobsDir, A), job(B));
  assert.deepEqual(listJobs(config.jobsDir).map((j) => j.job_id), [B]);
});

// ------------------------------------------------------------------ manifest.json

const row = (over = {}) => ({ stage: 'tracing', attempt: 1, status: 'done', started_at: T, finished_at: T, seconds: 0.1,
  inputs_sha256: H('1'), outputs: [{ path: 'stages/tracing/stub.json', sha256: H('2'), bytes: 10 }], cost_usd: 0, runner_pid: 9, ...over });

test('insideJob: a relative path that stays in the job folder, and nothing else', () => {
  for (const p of ['stages/tracing/stub.json', 'a', 'a/b/c.txt', 'a\\b.txt', 'a..b/c', '.hidden/x']) assert.equal(insideJob(p), true, p);
  for (const p of ['', '..', '../x', 'a/../../x', 'a\\..\\x', '/x', '\\x', 'C:/x', 'c:\\x', 'D:x', 'a\0b', null, undefined, 7, {}]) {
    assert.equal(insideJob(p), false, String(p));
  }
});

test('checkManifest takes the manifest of the id asked for, and names the row that is wrong', () => {
  assert.equal(checkManifest(emptyManifest(A), A).rows.length, 0);
  assert.equal(checkManifest({ schema: MANIFEST_SCHEMA_ID, job_id: A, rows: [row(), row({ stage: 'building', superseded: true, outputs: [] })] }, A).rows.length, 2);
  const m = (rows) => ({ schema: MANIFEST_SCHEMA_ID, job_id: A, rows });
  const cases = [
    [null, /not a JSON object/], [[], /not a JSON object/],
    [{ ...emptyManifest(A), schema: 'x' }, /its schema is "x"/],
    [emptyManifest(B), /it names job "bbbbbbbbbbbbbbbb"/],
    [{ schema: MANIFEST_SCHEMA_ID, rows: [] }, /it names job null/],
    [{ schema: MANIFEST_SCHEMA_ID, job_id: A }, /it has no rows/], [{ schema: MANIFEST_SCHEMA_ID, job_id: A, rows: {} }, /it has no rows/],
    [m([null]), /row 1 is not an object/], [m([row(), []]), /row 2 is not an object/],
    [m([row({ stage: 'intake' })]), /row 1 names no stage of the engine/], [m([row({ stage: undefined })]), /row 1 names no stage/],
    [m([row({ attempt: 0 })]), /row 1 has no attempt number/], [m([row({ attempt: '1' })]), /row 1 has no attempt number/],
    [m([row({ status: 1 })]), /row 1 has no status/],
    [m([row({ inputs_sha256: 'i' })]), /row 1 has no inputs hash/], [m([row({ inputs_sha256: H('A') })]), /row 1 has no inputs hash/],
    [m([row({ outputs: null })]), /row 1 has no outputs/],
    [m([row({ outputs: [7] })]), /row 1, output 1 is not an object/],
    [m([row({ outputs: [{ path: `../${B}/stages/tracing/stub.json`, sha256: H('2'), bytes: 1 }] })]), /row 1, output 1: its path is not inside the job folder/],
    [m([row({ outputs: [{ path: 'C:/Windows/x', sha256: H('2'), bytes: 1 }] })]), /its path is not inside the job folder/],
    [m([row(), row({ outputs: [{ path: 'ok', sha256: H('2'), bytes: 1 }, { path: 'ok2', sha256: 'short', bytes: 1 }] })]), /row 2, output 2 has no hash/],
    [m([row({ outputs: [{ path: 'ok', sha256: H('2'), bytes: -1 }] })]), /row 1, output 1 has no size/],
    [m([row({ outputs: [{ path: 'ok', sha256: H('2'), bytes: 1.5 }] })]), /row 1, output 1 has no size/],
  ];
  for (const [doc, re] of cases) {
    unreadable(() => checkManifest(doc, A), ManifestUnreadable, re);
    unreadable(() => checkManifest(doc, A), ManifestUnreadable, /^job aaaaaaaaaaaaaaaa: manifest\.json is not this job's file/);
  }
  const e = new ManifestUnreadable(A, 'why');
  assert.deepEqual([e.name, e.jobId, e.why], ['ManifestUnreadable', A, 'why']);
});

test('readManifest, writeManifest and appendRow never work through a manifest that is not this job\'s', () => {
  const config = twoJobs();
  assert.deepEqual(readManifest(config.jobsDir, A), emptyManifest(A), 'no file yet: an empty manifest');
  put(manifestFile(config.jobsDir, A), emptyManifest(B));
  unreadable(() => readManifest(config.jobsDir, A), ManifestUnreadable, /it names job "bbbbbbbbbbbbbbbb"/);
  const before = snapshot(config.jobsDir);
  unreadable(() => appendRow(config.jobsDir, A, row()), ManifestUnreadable, /it names job/);
  assert.deepEqual(snapshot(config.jobsDir), before, 'no row went into either job');
  put(manifestFile(config.jobsDir, A), 'not json');
  unreadable(() => readManifest(config.jobsDir, A), ManifestUnreadable, /it is not JSON/);
  // writeManifest: only a manifest, only under the id it names.
  unreadable(() => writeManifest(config.jobsDir, { schema: MANIFEST_SCHEMA_ID, rows: [] }), ManifestUnreadable, /it has no job id/);
  unreadable(() => writeManifest(config.jobsDir, null), ManifestUnreadable, /it has no job id/);
  unreadable(() => writeManifest(config.jobsDir, { ...emptyManifest(A), job_id: '../x' }), ManifestUnreadable, /it has no job id/);
  unreadable(() => writeManifest(config.jobsDir, { schema: MANIFEST_SCHEMA_ID, job_id: A, rows: [row({ stage: 'x' })] }), ManifestUnreadable, /names no stage/);
  assert.equal(fs.existsSync(`${config.jobsDir}/undefined`), false);
  // An honest row is appended under A.
  writeManifest(config.jobsDir, emptyManifest(A));
  appendRow(config.jobsDir, A, row());
  assert.equal(readManifest(config.jobsDir, A).rows.length, 1);
  assert.equal(readManifest(config.jobsDir, B).rows.length, 0);
});

// ------------------------------------------------------------------ the runner

test('a runner on a job.json that names another job, or none: it stops, writes nothing, and takes no pid file', async () => {
  for (const spoil of [(j) => ({ ...j, job_id: B }), (j) => { const x = { ...j }; delete x.job_id; return x; }, () => 'not json', () => []]) {
    const config = twoJobs();
    put(jobFile(config.jobsDir, A), spoil(job(B, 'tracing', 'b')));
    const before = snapshot(config.jobsDir);
    const { run, logs } = runner(config);
    assert.equal(await run(), 'unreadable');
    assert.deepEqual(snapshot(config.jobsDir), before, 'no file of any job changed, and no runner.pid is left');
    assert.equal(fs.existsSync(`${config.jobsDir}/undefined`), false);
    assert.ok(logs.some((l) => l.includes(`job ${A}: job.json is not this job's file`) && l.includes('stops and writes nothing')), logs.join('\n'));
  }
});

test('a runner on a manifest.json that names another job: it stops before its first heartbeat and gives the pid file back', async () => {
  for (const bad of [emptyManifest(B), { schema: MANIFEST_SCHEMA_ID, rows: [] }, 'not json',
    { schema: MANIFEST_SCHEMA_ID, job_id: A, rows: [row({ outputs: [{ path: `../${B}/manifest.json`, sha256: H('2'), bytes: 1 }] })] }]) {
    const config = twoJobs('tracing');
    put(manifestFile(config.jobsDir, A), bad);
    const before = snapshot(config.jobsDir);
    const { run, logs } = runner(config);
    assert.equal(await run(), 'unreadable');
    assert.deepEqual(snapshot(config.jobsDir), before, 'job.json has no new heartbeat; runner.pid was given back; job B untouched');
    assert.ok(logs.some((l) => l.includes(`job ${A}: manifest.json is not this job's file`)), logs.join('\n'));
  }
});

test('a job file spoiled WHILE the runner works: it stops, and the job is not marked failed', async () => {
  // The tracing stage itself overwrites the manifest (then the job file) the way a hand would, mid-stage.
  for (const [file, value, re] of [
    [manifestFile, emptyManifest(B), /manifest\.json is not this job's file/],
    [jobFile, job(B, 'tracing', 'b'), /job\.json is not this job's file/],
  ]) {
    const config = twoJobs('tracing');
    const bBefore = snapshot(`${config.jobsDir}/${B}`);
    const registry = { ...REGISTRY, tracing: { stub: { run: async (ctx) => {
      const out = `${ctx.stageDir}/stub.json`;
      fs.writeFileSync(out, '{}\n');
      put(file(config.jobsDir, A), value);
      return { outputs: [{ path: 'stages/tracing/stub.json' }] };
    } } } };
    const { run, logs } = runner(config, { registry });
    assert.equal(await run(), 'unreadable');
    assert.ok(logs.some((l) => re.test(l)), logs.join('\n'));
    assert.ok(!logs.some((l) => /failed STAGE_FAILED/.test(l)), 'not a stage failure');
    assert.equal(fs.existsSync(`${config.jobsDir}/${A}/runner.pid`), false, 'runner.pid given back');
    assert.deepEqual(snapshot(`${config.jobsDir}/${B}`), bBefore, 'job B untouched');
    assert.equal(fs.existsSync(`${config.jobsDir}/undefined`), false);
    // What the spoiled file holds is what the hand wrote: the runner did not write over it.
    assert.deepEqual(JSON.parse(fs.readFileSync(file(config.jobsDir, A), 'utf8')), JSON.parse(JSON.stringify(value)));
  }
});

test('notThisJobs, and the process exit code of a runner that stopped on such a file', async () => {
  assert.equal(notThisJobs(new JobUnreadable(A, 'x')), true);
  assert.equal(notThisJobs(new ManifestUnreadable(A, 'x')), true);
  assert.equal(notThisJobs(new Error('x')), false);
  const err = sink();
  assert.equal(await runnerMain([A], { env: {}, stderr: err, load: () => ({}), run: async () => 'unreadable' }), 1);
  assert.match(err.text, /stopped: unreadable/);
  assert.equal(await runnerMain([A], { env: {}, stderr: sink(), load: () => ({}), run: async () => 'done' }), 0);
});

// ------------------------------------------------------------------ the restart rules, the tools, the CLI

test('restartJob and startOrResume do not restart a job through a file that is not its own', () => {
  const config = twoJobs('failed');
  put(manifestFile(config.jobsDir, A), emptyManifest(B));
  const before = snapshot(config.jobsDir);
  const spawned = [];
  unreadable(() => restartJob(config, A), ManifestUnreadable, /it names job/);
  unreadable(() => startOrResume(config, readJob(config.jobsDir, A), { spawnRunner: (c, id) => spawned.push(id), isRunnerAlive: () => false }),
    ManifestUnreadable, /it names job/);
  assert.deepEqual(snapshot(config.jobsDir), before);
  assert.deepEqual(spawned, [], 'no runner is started for it');
});

// QA round 2, D-2: a manifest.json that is not the job's own, on a job that is waiting or working (not only
// a restartable one): no runner is started, nothing is written, and `engine resume` exits 1.
const SPOILED_MANIFESTS = [
  ['another job\'s', (config) => put(manifestFile(config.jobsDir, A), emptyManifest(B)), /it names job "bbbbbbbbbbbbbbbb"/],
  ['not JSON', (config) => put(manifestFile(config.jobsDir, A), '{not json'), /it is not JSON/],
  ['a folder', (config) => fs.mkdirSync(manifestFile(config.jobsDir, A)), /it is not a file/],
];

test('D-2: startOrResume and restartJob start no runner through a manifest that is not the job\'s own, in any state', () => {
  for (const [label, spoil, re] of SPOILED_MANIFESTS) {
    for (const state of ['awaiting_approval', 'tracing', 'queued', 'failed', 'cancelled', 'done']) {
      const config = twoJobs(state);
      const read = readJob(config.jobsDir, A);   // read before the spoiling, as a caller holding the job would
      spoil(config);
      const before = snapshot(config.jobsDir);
      const spawned = [];
      unreadable(() => startOrResume(config, read, { spawnRunner: (c, id) => spawned.push(id), isRunnerAlive: () => false }),
        ManifestUnreadable, re);
      unreadable(() => restartJob(config, A), ManifestUnreadable, re);
      assert.deepEqual(spawned, [], `${label} · ${state}: no runner`);
      assert.deepEqual(snapshot(config.jobsDir), before, `${label} · ${state}: every file byte-identical`);
    }
  }
});

test('D-2: restartJob checks the manifest again under the lock: spoiled between the read and the write, nothing is written', () => {
  const config = twoJobs('failed');
  writeManifest(config.jobsDir, emptyManifest(A));
  const jobBefore = fs.readFileSync(jobFile(config.jobsDir, A), 'utf8');
  const realRead = fs.readFileSync;
  let reads = 0;
  fs.readFileSync = function (p, ...rest) {
    // read 1: readOwnJob; read 2: restartState; read 3: under the lock
    if (String(p).endsWith(`${A}/manifest.json`) && ++reads === 3) put(manifestFile(config.jobsDir, A), emptyManifest(B));
    return realRead.call(this, p, ...rest);
  };
  try {
    unreadable(() => restartJob(config, A), ManifestUnreadable, /it names job/);
  } finally {
    fs.readFileSync = realRead;
  }
  assert.equal(reads, 3);
  assert.equal(fs.readFileSync(jobFile(config.jobsDir, A), 'utf8'), jobBefore, 'job.json not written');
  assert.equal(fs.existsSync(`${config.jobsDir}/${A}/job.lock`), false, 'the lock is given back');
});

test('D-2: CLI resume on a job whose manifest is not its own prints the job and the reason, exits 1, starts no runner', async () => {
  for (const [label, spoil, re] of SPOILED_MANIFESTS) {
    for (const state of ['awaiting_approval', 'tracing', 'failed']) {
      const config = twoJobs(state);
      spoil(config);
      const before = snapshot(config.jobsDir);
      const spawned = [];
      const deps = { loadConfig: () => config, isRunnerAlive: () => false, spawnRunner: (c, id) => spawned.push(id) };
      const o = { stdout: sink(), stderr: sink(), env: {} };
      assert.equal(await main(['resume', A], o, deps), 1, `${label} · ${state}`);
      assert.match(o.stderr.text, /^resume: job aaaaaaaaaaaaaaaa: manifest\.json is not this job's file/, `${label} · ${state}`);
      assert.match(o.stderr.text, re);
      assert.equal(o.stdout.text, '', 'no "resumed" line');
      assert.deepEqual(spawned, [], `${label} · ${state}: no runner`);
      assert.deepEqual(snapshot(config.jobsDir), before, `${label} · ${state}: every file byte-identical`);
    }
  }
  // the bystander resumes as before; a job that is not there exits 1
  const config = twoJobs('awaiting_approval');
  const spawned = [];
  const deps = { loadConfig: () => config, isRunnerAlive: () => false, spawnRunner: (c, id) => spawned.push(id) };
  let o = { stdout: sink(), stderr: sink(), env: {} };
  assert.equal(await main(['resume', B], o, deps), 0);
  assert.deepEqual(spawned, [B]);
  o = { stdout: sink(), stderr: sink(), env: {} };
  assert.equal(await main(['resume', 'cccccccccccccccc'], o, deps), 1);
  assert.match(o.stderr.text, /job cccccccccccccccc: not found/);
});

test('the tools answer JOB_NOT_FOUND, naming the job and the reason; list_jobs leaves it out', async () => {
  const config = twoJobs('awaiting_approval');
  const eng = createStubEngine(config, { now: () => T, spawnRunner: () => {}, isRunnerAlive: () => false, ensureServe: async () => ({ listening: true }),
    doctor: { get: async () => null }, version: '1.1.0' });
  const h = eng.handlers;
  assert.equal((await h.get_job({ job_id: A })).job.job_id, A);
  put(jobFile(config.jobsDir, A), job(B, 'awaiting_approval', 'b'));
  const before = snapshot(config.jobsDir);
  for (const call of [() => h.get_job({ job_id: A }), () => h.approve_paid_stage({ job_id: A, cap_usd: 60 }), () => h.cancel_job({ job_id: A }),
    () => h.get_result({ job_id: A })]) {
    await assert.rejects(async () => call(), (e) => {
      assert.ok(e instanceof EngineError, `${e.name}: ${e.message}`);
      assert.equal(e.code, 'JOB_NOT_FOUND');
      assert.match(e.message, /job aaaaaaaaaaaaaaaa: job\.json is not this job's file \(it names job "bbbbbbbbbbbbbbbb"\)/);
      return true;
    });
  }
  assert.deepEqual((await h.list_jobs({})).jobs.map((j) => j.job_id), [B]);
  assert.deepEqual(snapshot(config.jobsDir), before, 'no tool wrote anything');
  // An error that is not about a job's identity goes through as it is.
  await assert.rejects(async () => h.get_job({ job_id: 'cccccccccccccccc' }), (e) => e instanceof EngineError && e.code === 'JOB_NOT_FOUND' && /no job/.test(e.message));
});

// O-1 of the 1.1 QA: the same holds for manifest.json, for every tool that names a job.
const FOREIGN_MANIFESTS = [
  [emptyManifest(B), /it names job "bbbbbbbbbbbbbbbb"/],
  [{ schema: MANIFEST_SCHEMA_ID, rows: [] }, /it names job null/],
  ['not json', /it is not JSON/],
  [{ schema: MANIFEST_SCHEMA_ID, job_id: A, rows: {} }, /it has no rows/],
  [{ schema: MANIFEST_SCHEMA_ID, job_id: A, rows: [row({ outputs: [{ path: `../${B}/job.json`, sha256: H('2'), bytes: 1 }] })] }, /not inside the job folder/],
];

test('readOwnJob and listOwnJobs: a job is its own only when its manifest is too; no manifest yet is fine', () => {
  const config = twoJobs();
  assert.equal(readOwnJob(config.jobsDir, A).job_id, A, 'A has no manifest.json yet');
  assert.equal(readOwnJob(config.jobsDir, 'cccccccccccccccc'), null);
  assert.deepEqual(listOwnJobs(config.jobsDir).map((j) => j.job_id).sort(), [A, B]);
  for (const [bad, re] of FOREIGN_MANIFESTS) {
    put(manifestFile(config.jobsDir, A), bad);
    unreadable(() => readOwnJob(config.jobsDir, A), ManifestUnreadable, re);
    assert.deepEqual(listOwnJobs(config.jobsDir).map((j) => j.job_id), [B]);
    assert.deepEqual(listJobs(config.jobsDir).map((j) => j.job_id).sort(), [A, B], 'listJobs alone reads job.json only');
  }
});

test('O-1: every tool that names a job answers JOB_NOT_FOUND for a manifest.json that is not its own; list_jobs leaves it out; nothing is written', async () => {
  for (const [bad, re] of FOREIGN_MANIFESTS) {
    for (const state of ['awaiting_approval', 'done']) {
      const config = twoJobs(state);
      if (state === 'done') {
        updateJob(config.jobsDir, A, (j) => ({ ...j, result: { local_url: 'http://127.0.0.1:8123/x', tour_dir: 'C:/x' } }));
      }
      const spawned = [];
      const eng = createStubEngine(config, { now: () => T, spawnRunner: (c, id) => spawned.push(id), isRunnerAlive: () => false,
        ensureServe: async () => ({ listening: true }), doctor: { get: async () => null }, version: '1.1.0' });
      const h = eng.handlers;
      assert.equal((await h.get_job({ job_id: A })).job.job_id, A, 'no manifest yet: the job answers');
      if (state === 'done') assert.equal((await h.get_result({ job_id: A })).job_id, A);
      put(manifestFile(config.jobsDir, A), bad);
      const before = snapshot(config.jobsDir);
      for (const [name, call] of [['get_job', () => h.get_job({ job_id: A })], ['approve_paid_stage', () => h.approve_paid_stage({ job_id: A, cap_usd: 60 })],
        ['cancel_job', () => h.cancel_job({ job_id: A })], ['get_result', () => h.get_result({ job_id: A })]]) {
        await assert.rejects(async () => call(), (e) => {
          assert.ok(e instanceof EngineError, `${name}: ${e.name}: ${e.message}`);
          assert.equal(e.code, 'JOB_NOT_FOUND', name);
          assert.match(e.message, /^job aaaaaaaaaaaaaaaa: manifest\.json is not this job's file/, name);
          assert.match(e.message, re, name);
          return true;
        });
      }
      assert.deepEqual((await h.list_jobs({})).jobs.map((j) => j.job_id), [B]);
      assert.deepEqual(snapshot(config.jobsDir), before, 'no approval, no cancel, nothing written to either job');
      assert.deepEqual(spawned, [], 'no runner is started');
    }
  }
});

test('O-1: a manifest spoiled between the check and the write is caught under the lock; nothing is written', async () => {
  for (const tool of ['approve_paid_stage', 'cancel_job']) {
    const config = twoJobs('awaiting_approval');
    const spawned = [];
    const eng = createStubEngine(config, { now: () => T, spawnRunner: (c, id) => spawned.push(id), isRunnerAlive: () => false,
      ensureServe: async () => ({ listening: true }), doctor: { get: async () => null }, version: '1.1.0' });
    put(manifestFile(config.jobsDir, A), emptyManifest(A));
    const jobBefore = fs.readFileSync(jobFile(config.jobsDir, A), 'utf8');
    // The first read of the manifest (before the lock) finds it this job's; it is spoiled just before the
    // second read, the one under the job lock.
    const realRead = fs.readFileSync;
    let reads = 0;
    fs.readFileSync = function (p, ...rest) {
      if (String(p).endsWith(`${A}/manifest.json`) && ++reads === 2) put(manifestFile(config.jobsDir, A), emptyManifest(B));
      return realRead.call(this, p, ...rest);
    };
    try {
      await assert.rejects(async () => eng.handlers[tool]({ job_id: A, cap_usd: 60 }), (e) => e instanceof EngineError && e.code === 'JOB_NOT_FOUND');
    } finally {
      fs.readFileSync = realRead;
    }
    assert.equal(reads, 2, `${tool}: the manifest was read again under the lock`);
    assert.equal(fs.readFileSync(jobFile(config.jobsDir, A), 'utf8'), jobBefore, `${tool}: job.json not written`);
    assert.equal(fs.existsSync(`${config.jobsDir}/${A}/job.lock`), false, 'the lock is given back');
    assert.deepEqual(spawned, []);
  }
});

test('the CLI prints the job and the reason and exits 1; `jobs` leaves the folder out', async () => {
  const config = twoJobs('tracing');
  const deps = { loadConfig: () => config, isRunnerAlive: () => false, spawnRunner: () => { throw new Error('no runner may be started'); } };
  const io = () => ({ stdout: sink(), stderr: sink(), env: {} });
  put(manifestFile(config.jobsDir, A), emptyManifest(B));
  let o = io();
  assert.equal(await main(['jobs', '--json'], o, deps), 0);
  assert.deepEqual(JSON.parse(o.stdout.text).jobs.map((j) => j.job_id), [B], 'a job whose manifest is not its own is left out');
  o = io();
  assert.equal(await main(['job', A], o, deps), 1);
  assert.match(o.stderr.text, /manifest\.json of job aaaaaaaaaaaaaaaa cannot be read \(job aaaaaaaaaaaaaaaa: manifest\.json is not this job's file \(it names job "bbbbbbbbbbbbbbbb"\)\)/);
  put(jobFile(config.jobsDir, A), job(B, 'tracing', 'b'));
  for (const cmd of ['job', 'resume', 'ledger']) {
    o = io();
    assert.equal(await main([cmd, A], o, deps), 1, cmd);
    assert.match(o.stderr.text, new RegExp(`^${cmd}: job aaaaaaaaaaaaaaaa: job\\.json is not this job's file \\(it names job "bbbbbbbbbbbbbbbb"\\)`), cmd);
  }
  o = io();
  assert.equal(await main(['jobs'], o, deps), 0);
  assert.ok(o.stdout.text.includes(B) && !o.stdout.text.includes(A), o.stdout.text);
  assert.equal(JOB_SCHEMA_ID, 'habait/job.v1');
  assert.equal(STAGES.length, 8);
});

// Found by the main session after QA round 1, in the family of its O-5: the wrong KIND of thing at a job
// file's path left the readers as a raw EISDIR (through the server: -32603 with a local path in it).
test('a FOLDER where job.json or manifest.json belongs is not this job\'s file: readers, tools, list, runner', async () => {
  const NO_PATH = /[A-Za-z]:[\\/]/;
  const cases = [
    { file: jobFile, state: 'queued', read: () => readJob, Kind: JobUnreadable, what: 'job.json' },
    { file: manifestFile, state: 'awaiting_approval', read: () => readManifest, Kind: ManifestUnreadable, what: 'manifest.json' },
  ];
  for (const c of cases) {
    const config = twoJobs(c.state);
    const at = c.file(config.jobsDir, A);
    fs.rmSync(at, { force: true });
    fs.mkdirSync(at);
    unreadable(() => c.read()(config.jobsDir, A), c.Kind, new RegExp(`job ${A}: ${c.what.replace('.', '\\.')} is not this job's file \\(it is not a file\\)`));
    assert.deepEqual(listOwnJobs(config.jobsDir).map((j) => j.job_id), [B], `${c.what}: the list leaves the job out`);
    const before = snapshot(config.jobsDir);
    const spawned = [];
    const eng = createStubEngine(config, { now: () => T, spawnRunner: (cfg, id) => spawned.push(id), isRunnerAlive: () => false,
      ensureServe: async () => ({ listening: true }) });
    for (const tool of ['get_job', 'approve_paid_stage', 'cancel_job', 'get_result']) {
      await assert.rejects(async () => eng.handlers[tool]({ job_id: A, cap_usd: 60 }), (e) => {
        assert.ok(e instanceof EngineError && e.code === 'JOB_NOT_FOUND', `${c.what} · ${tool}: ${e.name} ${e.code} ${e.message}`);
        assert.doesNotMatch(e.message, NO_PATH, 'no local path in the answer');
        return true;
      });
    }
    assert.deepEqual((await eng.handlers.list_jobs({})).jobs.map((j) => j.job_id), [B], `${c.what}: list_jobs`);
    const { run, logs } = runner(config);
    assert.equal(await run(), 'unreadable', c.what);
    assert.ok(logs.some((l) => l.includes(`job ${A}: ${c.what} is not this job's file (it is not a file)`)), logs.join('\n'));
    assert.deepEqual(snapshot(config.jobsDir), before, `${c.what}: nothing was written, and no runner.pid is left`);
    assert.deepEqual(spawned, [], `${c.what}: no runner was started`);
    assert.equal(fs.statSync(at).isDirectory(), true, 'the folder is still there: nothing is removed');
  }
});

// QA round 3, D-2: `engine job <id>` put the cost copy right in job.json before it looked at the manifest. The
// rule now sits at the one place a job file is written (writeJob), so no caller can forget it.
test('QA round 3, D-2: job.json is never written when manifest.json is not this job\'s: writeJob, updateJob, the cost repair, the CLI', async () => {
  const io = () => ({ stdout: sink(), stderr: sink(), env: {} });
  for (const spoil of [emptyManifest(B), 'not json', { schema: MANIFEST_SCHEMA_ID, rows: [] }]) {
    const config = twoJobs('awaiting_approval');
    const deps = { loadConfig: () => config, isRunnerAlive: () => false, spawnRunner: () => { throw new Error('no runner may be started'); } };
    // The cost copy in job.json is wrong on purpose (7, while the job has no ledger: 0), so a read WOULD repair it.
    const wrong = job(A, 'awaiting_approval', 'a');
    wrong.cost.spent_usd = 7;
    writeJob(config.jobsDir, wrong);
    put(manifestFile(config.jobsDir, A), spoil);
    const before = snapshot(config.jobsDir);
    unreadable(() => writeJob(config.jobsDir, job(A, 'tracing', 'a')), ManifestUnreadable, /manifest\.json is not this job's file/);
    unreadable(() => updateJob(config.jobsDir, A, (j) => { j.percent = 99; return j; }), ManifestUnreadable, /manifest\.json is not this job's file/);
    assert.equal(fs.existsSync(`${config.jobsDir}/${A}/job.lock`), false, 'the lock is given back');
    // The CLI: `job` and `ledger` say why and exit 1; `job --json` still prints the job file (contract 0.3 §15
    // item 4). None of them writes.
    let o = io();
    assert.equal(await main(['job', A], o, deps), 1);
    assert.match(o.stderr.text, /manifest\.json/);
    o = io();
    assert.equal(await main(['job', A, '--json'], o, deps), 0);
    assert.equal(JSON.parse(o.stdout.text).job_id, A);
    o = io();
    assert.equal(await main(['ledger', A], o, deps), 1);
    assert.deepEqual(snapshot(config.jobsDir), before, 'no file of any job changed');
    assert.equal(JSON.parse(fs.readFileSync(jobFile(config.jobsDir, A), 'utf8')).cost.spent_usd, 7, 'the copy was not touched');
    // The same read on a job whose manifest IS its own does repair the copy: the write path is the one tested.
    put(manifestFile(config.jobsDir, A), emptyManifest(A));
    o = io();
    assert.equal(await main(['job', A, '--json'], o, deps), 0);
    assert.equal(JSON.parse(fs.readFileSync(jobFile(config.jobsDir, A), 'utf8')).cost.spent_usd, 0, 'with its own manifest the copy is put right');
  }
});
