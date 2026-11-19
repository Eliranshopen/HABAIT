// Milestone 0.3 — a job on the disk: the closing test (contract 0.3 §7). REAL detached runner processes
// (`node engine/runner.mjs <job_id>`, started by the real tool handlers) on a temp engine home
// (ENGINE_HOME, ENGINE_JOBS_DIR, a free ENGINE_SERVE_PORT, ENGINE_STUB_STEP_MS 400, stub.callUsd 0.6,
// runner.heartbeatSeconds 0.1), REALLY killed by pid (process.kill = TerminateProcess on Windows) and
// confirmed gone before anything is asserted. Every runner and the static server are killed in `after`.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { tempDir, writeFile } from '../helpers/fakes.mjs';
import { loadConfig } from '../../engine/config.mjs';
import { readJob, STAGES } from '../../engine/jobs.mjs';
import { readManifest } from '../../engine/manifest.mjs';
import { readLedger } from '../../engine/ledger.mjs';
import { pidAlive } from '../../engine/lib/proc.mjs';
import { createStubEngine } from '../../mcp/stub-engine.mjs';
import { validate, formatErrors } from '../../mcp/schema-check.mjs';
import { mkEnv, frozenJob, frozenThenReplaced, toDone, wakeAndLeave, gone, lockFree, seenAlive, scriptedLook } from '../soak/lib.mjs';
import { sha256FileSync } from '../../engine/lib/hash.mjs';
import { stopPids, stopServers, removeHome } from '../helpers/cleanup.mjs';

const FIXTURES = fileURLToPath(new URL('../fixtures', import.meta.url)).replace(/\\/g, '/');
const BASE = JSON.parse(fs.readFileSync(new URL('../../engine.config.json', import.meta.url), 'utf8'));
const SCHEMA = (n) => JSON.parse(fs.readFileSync(new URL(`../../contracts/${n}.schema.json`, import.meta.url), 'utf8'));
const SITE_HTML = '<!doctype html><title>stub tour</title><p>m0.3 stub tour</p>\n';
const STEP_MS = 400;
const CALL_USD = 0.6;
const HOOKS = ['ENGINE_TEST_PAUSE_AFTER_RESERVE_MS', 'ENGINE_TEST_PAUSE_AFTER_CACHE_MS', 'ENGINE_TEST_PAUSE_AFTER_SETTLE_MS',
  'ENGINE_TEST_FREEZE_MS', 'ENGINE_TEST_FREEZE_AT', 'ENGINE_TEST_FREEZE_WAKE'];

let home; let config; let h; let port;
const extras = [];
const newEnv = async (o) => {
  const E = await mkEnv(o);
  extras.push(E);
  return E;
};
const killed = [];

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(what, fn, timeoutMs = 20000, everyMs = 15) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > until) {
      const states = fs.existsSync(config.jobsDir) ? fs.readdirSync(config.jobsDir).map((d) => `${d}: ${job(d)?.state}`).join(', ') : '';
      throw new Error(`timed out waiting for ${what} (jobs: ${states})`);
    }
    await sleep(everyMs);
  }
}

const job = (id) => readJob(config.jobsDir, id);
const rows = (id) => readManifest(config.jobsDir, id).rows;
const ledger = (id) => readLedger(config.jobsDir, id);
const runnerPid = (id) => {
  try {
    return Number(fs.readFileSync(`${config.jobsDir}/${id}/runner.pid`, 'utf8').trim());
  } catch {
    return null;
  }
};

// A HARD kill of the runner's pid; returns once the process is really gone.
async function killRunner(id) {
  const pid = runnerPid(id);
  assert.ok(pid > 0 && pidAlive(pid), `a live runner for ${id}`);
  process.kill(pid);
  await waitFor(`pid ${pid} to be gone`, () => !pidAlive(pid), 5000);
  assert.equal(pidAlive(pid), false);
  killed.push(pid);
  return pid;
}

function schemaOk(name, value) {
  const errors = validate(SCHEMA(name), value);
  assert.deepEqual(errors, [], `${name}: ${formatErrors(errors)}`);
}

function pdf(name, extra) {
  const p = `${home}/inbox/${name}`;
  writeFile(p, `${fs.readFileSync(`${FIXTURES}/sample.pdf`, 'latin1')}% ${extra}\n`);
  return p;
}

const callRows = (id, stage) => ledger(id).rows.filter((r) => r.stage === stage);

before(async () => {
  home = tempDir('m03-home-');
  writeFile(`${home}/site/tour/index.html`, SITE_HTML);
  fs.mkdirSync(`${home}/inbox`, { recursive: true });
  writeFile(`${home}/engine.config.json`, JSON.stringify({ ...BASE, inbox: [`${home}/inbox`],
    stub: { ...BASE.stub, siteRoot: `${home}/site`, callUsd: CALL_USD },
    runner: { ...BASE.runner, heartbeatSeconds: 0.1 } }));
  port = await freePort();
  assert.notEqual(port, 8891);
  config = loadConfig({ env: { ENGINE_HOME: home, ENGINE_JOBS_DIR: `${home}/jobs-temp`, ENGINE_SERVE_PORT: String(port),
    ENGINE_STUB_STEP_MS: String(STEP_MS) } });
  assert.equal(config.jobsDir, `${home}/jobs-temp`);
  assert.equal(config.runner.heavyLock, `${home}/.runtime/heavy.lock`);
  for (const k of HOOKS) delete process.env[k];
  // A scripted first look: this test starts dozens of made-up PDFs (contract 1.1 §8.3). The intake is real.
  h = createStubEngine(config, { doctor: { get: async () => null, kick() {}, stop() {} }, inspect: scriptedLook }).handlers;
});

after(async () => {
  for (const k of HOOKS) delete process.env[k];
  for (const E of extras) await E.cleanup();   // parts 8-17: only the pids that each env spawned itself
  const leftovers = extras.flatMap((E) => E.leftover || []);
  const pids = [];
  if (fs.existsSync(config.jobsDir)) {
    for (const d of fs.readdirSync(config.jobsDir)) {
      const p = runnerPid(d);
      if (p) pids.push(p);
    }
  }
  await stopPids(pids, { waitMs: 3000 });
  // The static server is found also when its record names a server that lost the start (tests/helpers/cleanup.mjs).
  if (process.env.M03_KEEP) {
    await stopServers(home, port);
    process.stderr.write(`m0.3: temp home kept at ${home}\n`);
  } else await removeHome(home, port);
  assert.deepEqual(leftovers, [], 'no process of parts 8-17 remains');
});

let A;
let beforeKill;

test('1. kill in the middle of a stage: the state stays, runner.alive false, rows for tracing and building only', async () => {
  const s = h.start_simulation({ pdf_path: pdf('a.pdf', 'job A') });
  assert.equal(s.created, true);
  A = s.job_id;
  const j = await waitFor('rendering with a heartbeat written in it', () => {
    const x = job(A);
    return x.state === 'rendering' && Date.parse(x.heartbeat_at) > Date.parse(x.updated_at) ? x : null;
  });
  assert.equal(j.attempts.rendering, 1);
  await killRunner(A);
  assert.equal(job(A).state, 'rendering');
  const g = await waitFor('get_job to say the runner is not alive', () => {
    const r = h.get_job({ job_id: A });
    return r.job.runner.alive === false ? r : null;
  }, 3000);
  schemaOk('job', g.job);
  assert.equal(g.job.state, 'rendering');
  assert.deepEqual(rows(A).map((r) => r.stage), ['tracing', 'building']);
  beforeKill = rows(A);
});

test('2. resume: created false, resumed true; tracing and building untouched; rendering one row, attempt 2', async () => {
  process.env.ENGINE_TEST_PAUSE_AFTER_RESERVE_MS = '15000'; // carried by this runner into part 3
  const s = h.start_simulation({ pdf_path: pdf('a.pdf', 'job A') });
  assert.equal(s.created, false);
  assert.equal(s.resumed, true);
  assert.equal(s.job_id, A);
  const j = await waitFor('awaiting_approval', () => (job(A).state === 'awaiting_approval' ? job(A) : null));
  const r = rows(A);
  assert.deepEqual(r.slice(0, 2), beforeKill, 'byte for byte the same rows');
  assert.deepEqual(r.slice(0, 2).map((x) => x.attempt), [1, 1]);
  const rendering = r.filter((x) => x.stage === 'rendering');
  assert.equal(rendering.length, 1);
  assert.equal(rendering[0].attempt, 2);
  assert.notEqual(rendering[0].runner_pid, beforeKill[0].runner_pid);
  assert.deepEqual(j.attempts, { tracing: 1, building: 1, rendering: 2 });
  assert.equal(j.waiting_for, undefined);
  schemaOk('manifest', readManifest(config.jobsDir, A));
});

let skinKey;
test('3. kill between reserve and settle: one orphaned and one settled row for that call_key; the job goes on', async () => {
  h.approve_paid_stage({ job_id: A, cap_usd: 60 });
  // Reserved AND marked as sending: the runner is in its pause, just before the send. (A kill in the few
  // milliseconds between the reserve and that mark is another case: the call was never sent, part 16 b.)
  const reserved = await waitFor('the skinning call reserved and marked as sending', () => callRows(A, 'skinning').find((x) => x.status === 'reserved' && x.sending_at));
  skinKey = reserved.call_key;
  await killRunner(A);
  assert.equal(job(A).state, 'skinning');
  assert.equal(ledger(A).rows.length, 1);
  delete process.env.ENGINE_TEST_PAUSE_AFTER_RESERVE_MS;
  process.env.ENGINE_TEST_PAUSE_AFTER_SETTLE_MS = '3000'; // carried by this runner into part 4
  const s = h.start_simulation({ pdf_path: pdf('a.pdf', 'job A') });
  assert.equal(s.resumed, true);
  await waitFor('the skinning call settled', () => callRows(A, 'skinning').some((x) => x.status === 'settled'));
  const mine = ledger(A).rows.filter((x) => x.call_key === skinKey);
  assert.deepEqual(mine.map((x) => x.status), ['orphaned', 'settled']);
  assert.deepEqual(mine.map((x) => x.attempt), [1, 2]);
  await waitFor('the job to go on to gating', () => job(A).state === 'gating');
  schemaOk('ledger', ledger(A));
});

test('4. kill after the settle, before the manifest row: gating runs again (attempt 2), still ONE ledger row for its call', async () => {
  const settled = await waitFor('the gating call settled', () => callRows(A, 'gating').find((x) => x.status === 'settled'));
  await killRunner(A);
  assert.equal(job(A).state, 'gating');
  assert.equal(rows(A).filter((x) => x.stage === 'gating').length, 0, 'the interrupted stage left no row');
  delete process.env.ENGINE_TEST_PAUSE_AFTER_SETTLE_MS;
  const s = h.start_simulation({ pdf_path: pdf('a.pdf', 'job A') });
  assert.equal(s.resumed, true);
  const row = await waitFor('the gating row', () => rows(A).find((x) => x.stage === 'gating'));
  assert.equal(row.attempt, 2);
  assert.equal(row.cost_usd, 0, 'answered from the cache: nothing settled in attempt 2');
  const same = ledger(A).rows.filter((x) => x.call_key === settled.call_key);
  assert.equal(same.length, 1);
  assert.equal(same[0].status, 'settled');
  assert.equal(same[0].attempt, 1);
});

test('5. the end: done, one valid row per stage, spent = 3 × 0.6, the orphan reported apart, the link answers 200', async () => {
  const j = await waitFor('done', () => (['done', 'failed'].includes(job(A).state) ? job(A) : null), 30000);
  assert.equal(j.state, 'done', JSON.stringify(j.reason));
  const r = rows(A);
  for (const stage of STAGES) assert.equal(r.filter((x) => x.stage === stage && !x.superseded).length, 1, stage);
  assert.equal(r.length, STAGES.length);
  assert.ok(Math.abs(j.cost.spent_usd - 3 * CALL_USD) < 1e-9, `spent ${j.cost.spent_usd}`);
  assert.equal(j.cost.spent_usd, 1.8);
  const l = ledger(A);
  assert.equal(l.rows.filter((x) => x.status === 'settled').length, 3);
  assert.deepEqual(l.rows.filter((x) => x.status === 'orphaned').map((x) => x.call_key), [skinKey]);
  assert.equal(l.cap_usd, 60);
  assert.deepEqual(j.attempts, { tracing: 1, building: 1, rendering: 2, skinning: 2, gating: 2, finishing: 1, packaging: 1, qa: 1 });
  schemaOk('job', j);
  schemaOk('manifest', readManifest(config.jobsDir, A));
  schemaOk('ledger', l);
  const res = await h.get_result({ job_id: A });
  assert.deepEqual(res.cost, { spent_usd: 1.8, cap_usd: 60 });
  const http = await fetch(res.local_url);
  assert.equal(http.status, 200);
  assert.equal(await http.text(), SITE_HTML);
  await waitFor('the runner to end by itself', () => runnerPid(A) === null, 5000);
});

test('6. two jobs, one heavy lock: rendering never overlaps; the one that waited showed waiting_for "heavy-lock"', async () => {
  // Job B is blocked (the freeze hook) the moment it starts `rendering`, with the heavy lock in its hand, until
  // this test wakes it. So "C waits while B renders" is a state the test can look at, not a short window.
  const wakeB = `${home}/wake-part6`;
  process.env.ENGINE_TEST_FREEZE_MS = '60000';
  process.env.ENGINE_TEST_FREEZE_AT = 'rendering';
  process.env.ENGINE_TEST_FREEZE_WAKE = wakeB;
  let B;
  try {
    B = h.start_simulation({ pdf_path: pdf('b.pdf', 'job B') }).job_id;
  } finally {
    for (const k of ['ENGINE_TEST_FREEZE_MS', 'ENGINE_TEST_FREEZE_AT', 'ENGINE_TEST_FREEZE_WAKE']) delete process.env[k];
  }
  const logB = () => {
    try {
      return fs.readFileSync(`${config.jobsDir}/${B}/runner.log`, 'utf8');
    } catch {
      return '';
    }
  };
  await waitFor('B to be blocked in rendering', () => job(B).state === 'rendering' && /thread blocked for 60000 ms at rendering /.test(logB()), 30000);
  const heavyNow = () => JSON.parse(fs.readFileSync(config.runner.heavyLock, 'utf8'));
  assert.equal(heavyNow().pid, runnerPid(B), 'B holds the heavy lock');
  const C = h.start_simulation({ pdf_path: pdf('c.pdf', 'job C') }).job_id;
  await waitFor('C to wait for the heavy lock', () => job(C).waiting_for === 'heavy-lock', 30000);
  assert.equal(job(C).state, 'building', 'it waits in the state BEFORE the heavy stage');
  assert.equal(job(B).state, 'rendering', 'while B is in rendering');
  assert.equal(/the block at rendering is over/.test(logB()), false);
  assert.equal(heavyNow().job_id, B);
  fs.writeFileSync(wakeB, 'wake\n');
  await waitFor('both at awaiting_approval', () => {
    // Two files cannot be read at one instant: x, y, x again — y fell inside x's interval when x did not change.
    const r = (id) => job(id).state === 'rendering';
    for (const [x, y] of [[B, C], [C, B]]) assert.ok(!(r(x) && r(y) && r(x)), 'never both in rendering');
    return [B, C].every((id) => job(id).state === 'awaiting_approval');
  }, 30000);
  const [rb, rc] = [B, C].map((id) => rows(id).find((x) => x.stage === 'rendering'));
  const overlap = Date.parse(rb.started_at) < Date.parse(rc.finished_at) && Date.parse(rc.started_at) < Date.parse(rb.finished_at);
  assert.equal(overlap, false, `B ${rb.started_at}–${rb.finished_at}, C ${rc.started_at}–${rc.finished_at}`);
  assert.ok(Date.parse(rc.started_at) >= Date.parse(rb.finished_at), 'C rendered after B');
  assert.deepEqual([rb.attempt, rc.attempt], [1, 1], 'nobody lost the lock: B kept it while it was blocked (a live holder, refreshed within 10 s)');
  for (const id of [B, C]) {
    assert.equal(job(id).waiting_for, undefined);
    h.cancel_job({ job_id: id });
  }
  for (const id of [B, C]) await waitFor(`runner ${id} to exit`, () => runnerPid(id) === null, 5000);
  assert.equal(fs.existsSync(config.runner.heavyLock), false, 'the heavy lock was released');
});

test('7. restart after cancel: resumed, finishes, no stage that was done before the cancel ran again', async () => {
  const D = h.start_simulation({ pdf_path: pdf('d.pdf', 'job D') }).job_id;
  await waitFor('building, mid-stage', () => job(D).state === 'building' && job(D).attempts?.building === 1 && rows(D).length === 1);
  const c = h.cancel_job({ job_id: D });
  assert.equal(c.job.state, 'cancelled');
  await waitFor('the runner to exit', () => runnerPid(D) === null, 5000);
  const done = rows(D);
  const attempts = { ...job(D).attempts };
  assert.ok(done.length >= 1, 'tracing was done before the cancel');
  assert.equal(attempts.building, 1);
  const s = h.start_simulation({ pdf_path: pdf('d.pdf', 'job D') });
  assert.equal(s.created, false);
  assert.equal(s.resumed, true);
  assert.equal(s.job.reason, null);
  assert.equal(s.job.state, STAGES[done.length], 'back to the first stage with no valid row');
  await waitFor('awaiting_approval', () => job(D).state === 'awaiting_approval');
  h.approve_paid_stage({ job_id: D, cap_usd: 60 });
  const j = await waitFor('done', () => (['done', 'failed'].includes(job(D).state) ? job(D) : null), 30000);
  assert.equal(j.state, 'done', JSON.stringify(j.reason));
  const after = rows(D);
  assert.deepEqual(after.slice(0, done.length), done, 'the rows done before the cancel are untouched');
  for (const x of done) assert.equal(j.attempts[x.stage], attempts[x.stage], `${x.stage} did not run again`);
  for (const stage of STAGES) assert.equal(after.filter((x) => x.stage === stage).length, 1, stage);
  assert.equal(j.cost.spent_usd, 1.8);
  await waitFor('the runner to end by itself', () => runnerPid(D) === null, 5000);
});

// ---- Contract 0.3 §10.7: the five parts added after the first QA round. Each has its own TEMP engine home. ----
const settledSum = (l) => Math.round(l.rows.filter((r) => r.status === 'settled').reduce((n, r) => n + (Number(r.settled_usd) || 0), 0) * 1e6) / 1e6;

test('8. kill after the cache write, before the settle: ONE settled recovered row, ONE send, done, spent = settled sum', async () => {
  const E = await newEnv({ prefix: 'm03p8-' });
  process.env.ENGINE_TEST_PAUSE_AFTER_CACHE_MS = '20000';
  const id = E.h.start_simulation({ pdf_path: E.pdf('p8.pdf', 'part 8') }).job_id;
  await E.waitFor('awaiting_approval', () => E.job(id).state === 'awaiting_approval');
  E.h.approve_paid_stage({ job_id: id, cap_usd: 60 });
  const row = await E.waitFor('the skinning answer cached while its row is still reserved', () => {
    const r = E.ledger(id).rows.find((x) => x.stage === 'skinning');
    return r && r.status === 'reserved' && fs.existsSync(E.jobPath(id, `cache/${r.call_key}.json`)) ? r : null;
  });
  await E.kill(id);
  assert.equal(E.ledger(id).rows.find((x) => x.call_key === row.call_key).status, 'reserved', 'killed before the settle');
  assert.equal(E.sends(id, 'skinning'), 1);
  delete process.env.ENGINE_TEST_PAUSE_AFTER_CACHE_MS;
  const s = E.h.start_simulation({ pdf_path: E.pdf('p8.pdf', 'part 8') });
  assert.equal(s.resumed, true);
  const j = await E.waitFor('done', () => (['done', 'failed'].includes(E.job(id).state) ? E.job(id) : null), 30000);
  assert.equal(j.state, 'done', JSON.stringify(j.reason));
  const mine = E.ledger(id).rows.filter((x) => x.call_key === row.call_key);
  assert.equal(mine.length, 1, JSON.stringify(mine));
  assert.equal(mine[0].status, 'settled');
  assert.equal(mine[0].recovered, true);
  assert.equal(E.sends(id, 'skinning'), 1, 'the call was not sent again');
  assert.equal(E.sends(id, 'gating'), 1);
  assert.equal(E.sends(id, 'finishing'), 1);
  const l = E.ledger(id);
  assert.equal(l.rows.filter((x) => x.status === 'orphaned').length, 0);
  assert.equal(j.cost.spent_usd, settledSum(l));
  assert.equal(j.cost.spent_usd, 1.8);
  for (const stage of STAGES) assert.equal(E.rows(id).filter((x) => x.stage === stage && !x.superseded).length, 1, stage);
});

test('9. a wrong spent_usd on the disk is corrected when the runner starts, and again at done', async () => {
  const E = await newEnv({ prefix: 'm03p9-' });
  process.env.ENGINE_TEST_PAUSE_AFTER_SETTLE_MS = '20000';
  const id = E.h.start_simulation({ pdf_path: E.pdf('p9.pdf', 'part 9') }).job_id;
  await E.waitFor('awaiting_approval', () => E.job(id).state === 'awaiting_approval');
  E.h.approve_paid_stage({ job_id: id, cap_usd: 60 });
  await E.waitFor('the skinning call settled', () => E.ledger(id).rows.some((x) => x.status === 'settled'));
  await E.kill(id);
  delete process.env.ENGINE_TEST_PAUSE_AFTER_SETTLE_MS;
  assert.ok(settledSum(E.ledger(id)) > 0);
  // No runner is alive: put a wrong number on the disk.
  const file = E.jobPath(id, 'job.json');
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  doc.cost.spent_usd = 99.5;
  fs.writeFileSync(file, JSON.stringify(doc, null, 2) + '\n');
  assert.equal(E.job(id).cost.spent_usd, 99.5);
  // The resumed runner is blocked when `gating` starts (the freeze hook, woken by this test): the correction
  // made at its START is then looked at with the job standing still, not within some number of milliseconds.
  const wake = `${E.home}/wake-part9`;
  process.env.ENGINE_TEST_FREEZE_MS = '60000';
  process.env.ENGINE_TEST_FREEZE_AT = 'gating';
  process.env.ENGINE_TEST_FREEZE_WAKE = wake;
  try {
    assert.equal(E.h.start_simulation({ pdf_path: E.pdf('p9.pdf', 'part 9') }).resumed, true);
  } finally {
    for (const k of ['ENGINE_TEST_FREEZE_MS', 'ENGINE_TEST_FREEZE_AT', 'ENGINE_TEST_FREEZE_WAKE']) delete process.env[k];
  }
  await E.waitFor('the resumed runner to be blocked at gating', () => /thread blocked for 60000 ms at gating /.test(E.log(id)), 30000);
  assert.equal(E.job(id).state, 'gating');
  assert.equal(settledSum(E.ledger(id)), 0.6, 'one call settled so far');
  assert.equal(E.job(id).cost.spent_usd, 0.6, 'the wrong number was replaced by the ledger\'s total when the runner started');
  fs.writeFileSync(wake, 'wake\n');
  const j = await E.waitFor('done', () => (['done', 'failed'].includes(E.job(id).state) ? E.job(id) : null), 30000);
  assert.equal(j.state, 'done', JSON.stringify(j.reason));
  assert.equal(j.cost.spent_usd, settledSum(E.ledger(id)));
  assert.equal(j.cost.spent_usd, 1.8);
});

test('10. the cap is reached and it is not a dead end: back to awaiting_approval, 60 refused, 90 accepted, done with 90', async () => {
  const E = await newEnv({ prefix: 'm03p10-', callUsd: 30, stepMs: 200 });
  const id = E.h.start_simulation({ pdf_path: E.pdf('p10.pdf', 'part 10') }).job_id;
  await E.waitFor('awaiting_approval', () => E.job(id).state === 'awaiting_approval');
  assert.equal(E.job(id).quote.estimate_usd, 48);
  E.h.approve_paid_stage({ job_id: id, cap_usd: 60 });
  const first = E.job(id).approval;
  const j = await E.waitFor('the job back at awaiting_approval with BUDGET_CAP', () => {
    const x = E.job(id);
    return x.state === 'awaiting_approval' && x.reason?.code === 'BUDGET_CAP' ? x : null;
  }, 30000);
  assert.equal(j.approval, null);
  assert.deepEqual(j.approvals, [first]);
  assert.equal(j.quote.cap_reached, true);
  assert.equal(j.quote.estimate_usd, 90);
  assert.ok(j.quote.range_usd[0] === 90 && j.quote.range_usd[1] >= 90, JSON.stringify(j.quote));
  const l = E.ledger(id);
  assert.deepEqual(l.rows.map((r) => [r.stage, r.status]), [['skinning', 'settled'], ['gating', 'settled']], 'no third reserved row');
  assert.ok(l.rows.reduce((n, r) => n + (r.status === 'settled' ? r.settled_usd : r.reserved_usd), 0) <= 60);
  assert.equal(E.job(id).cost.spent_usd, 60);
  const before = E.rows(id);
  assert.deepEqual(before.map((r) => r.stage), ['tracing', 'building', 'rendering', 'skinning', 'gating']);
  assert.throws(() => E.h.approve_paid_stage({ job_id: id, cap_usd: 60 }), (e) => e.code === 'BUDGET_CAP');
  assert.equal(E.job(id).approval, null, 'a refused approval changes nothing');
  assert.equal(E.job(id).reason.code, 'BUDGET_CAP');
  const ok = E.h.approve_paid_stage({ job_id: id, cap_usd: 90 });
  assert.equal(ok.job.reason, null);
  assert.equal(ok.job.approval.cap_usd, 90);
  const done = await E.waitFor('done', () => (['done', 'failed'].includes(E.job(id).state) ? E.job(id) : null), 30000);
  assert.equal(done.state, 'done', JSON.stringify(done.reason));
  assert.equal(done.reason, null);
  assert.equal(done.cost.spent_usd, 90);
  assert.equal(done.cost.cap_usd, 90);
  const r = E.rows(id);
  for (const stage of STAGES) assert.equal(r.filter((x) => x.stage === stage && !x.superseded).length, 1, stage);
  assert.deepEqual(r.slice(0, 5), before, 'the stages done before the cap are byte-for-byte what they were');
  assert.deepEqual(done.attempts, { tracing: 1, building: 1, rendering: 1, skinning: 1, gating: 1, finishing: 2, packaging: 1, qa: 1 });
  for (const stage of ['skinning', 'gating', 'finishing']) assert.equal(E.sends(id, stage), 1, `${stage} sent once`);
  const fl = E.ledger(id);
  assert.equal(fl.rows.length, 3);
  assert.equal(settledSum(fl), 90);
  assert.equal(fl.cap_usd, 90);
  schemaOk('ledger', fl);
  schemaOk('manifest', readManifest(E.config.jobsDir, id));
  schemaOk('job', done);
});

// Parts 11 and 12 share one temp home whose stale threshold is small (runner.staleSeconds 1).
let E12;
async function killedMidStage(E, name) {
  const id = E.h.start_simulation({ pdf_path: E.pdf(name, name) }).job_id;
  await E.waitFor('a stage running with a heartbeat', () => {
    const x = E.job(id);
    return ['tracing', 'building', 'rendering'].includes(x.state) && Date.parse(x.heartbeat_at) > Date.parse(x.updated_at) ? x : null;
  });
  await E.kill(id);
  fs.rmSync(E.jobPath(id, 'job.lock'), { force: true });   // what the dead runner may have left; the test sets its own
  return id;
}

test('11. an EMPTY job.lock does not block a resume (stale after 1 s); a fresh empty one delays it by about 2 s at most', async () => {
  E12 = await newEnv({ prefix: 'm03p11-', callUsd: 0, staleSeconds: 1 });
  const E = E12;
  // (a) empty lock, modified 1.5 s ago
  const a = await killedMidStage(E, 'p11a.pdf');
  const lock = E.jobPath(a, 'job.lock');
  fs.writeFileSync(lock, '');
  const past = new Date(Date.now() - 1500);
  fs.utimesSync(lock, past, past);
  let t0 = Date.now();
  const sa = E.h.start_simulation({ pdf_path: E.pdf('p11a.pdf', 'p11a.pdf') });
  const dtA = Date.now() - t0;
  assert.ok(dtA < 5000, `the resume answered in ${dtA} ms (the defect was 10 000)`);
  assert.equal(sa.resumed, true);
  await E.waitFor('the job to go on to awaiting_approval', () => E.job(a).state === 'awaiting_approval');
  // (b) a FRESH empty lock
  const b = await killedMidStage(E, 'p11b.pdf');
  fs.writeFileSync(E.jobPath(b, 'job.lock'), '');
  t0 = Date.now();
  const sb = E.h.start_simulation({ pdf_path: E.pdf('p11b.pdf', 'p11b.pdf') });
  const dtB = Date.now() - t0;
  assert.ok(dtB < 5000, `a fresh empty lock delayed the resume by ${dtB} ms (the defect was 10 000)`);
  assert.equal(sb.resumed, true);
  await E.waitFor('the job to go on to awaiting_approval', () => E.job(b).state === 'awaiting_approval');
  // No lock left behind. One look is not enough: the live runner of each job takes job.lock for a few
  // milliseconds at every heartbeat (QA round 2, defect G1).
  for (const id of [a, b]) await lockFree(E, id);
});

test('12. a recycled pid does not look alive: runner.alive false, resumed true, a real runner takes the pid file over', async () => {
  const E = E12;
  const id = await killedMidStage(E, 'p12.pdf');
  const deadPid = E.killed.at(-1);
  assert.ok(pidAlive(process.pid) && process.pid !== deadPid);
  // A live process that is not a runner (this test) named in runner.pid, with an old pid file and an old heartbeat.
  const pidFile = E.jobPath(id, 'runner.pid');
  fs.writeFileSync(pidFile, String(process.pid));
  const old = new Date(Date.now() - 60000);
  fs.utimesSync(pidFile, old, old);
  const file = E.jobPath(id, 'job.json');
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  doc.heartbeat_at = old.toISOString();
  fs.writeFileSync(file, JSON.stringify(doc, null, 2) + '\n');
  const g = E.h.get_job({ job_id: id });
  assert.equal(g.job.runner.pid, process.pid);
  assert.equal(g.job.runner.alive, false, 'a live foreign pid with a stale heartbeat is not a live runner');
  const s = E.h.start_simulation({ pdf_path: E.pdf('p12.pdf', 'p12.pdf') });
  assert.equal(s.created, false);
  assert.equal(s.resumed, true);
  await E.waitFor('a real runner owns runner.pid', () => {
    const p = E.runnerPid(id);
    return p && p !== process.pid && p !== deadPid && E.spawned.has(p);
  }, 10000);
  await E.waitFor('the job to go on to awaiting_approval', () => E.job(id).state === 'awaiting_approval');
  await seenAlive(E, id);
});

// Part 13 (contract §10 rules 9, 10, 12). The freeze hook blocks the first runner's thread: a LIVE process
// with no heartbeat. The engine presumes it dead (runner.staleSeconds 1 here) and a second runner takes the
// job over. The test wakes the first runner itself (a wake file) at the moment each case needs, so nothing
// depends on the speed of the machine. When it wakes it must do nothing more to the job, and leave by itself.
test('13. a live runner that gives no sign of life is replaced; when it wakes it writes nothing and sends nothing', async () => {
  const E = await newEnv({ prefix: 'm03p13-', callUsd: CALL_USD, staleSeconds: 1 });
  const PAID = ['skinning', 'gating', 'finishing'];
  const stopped = (pid, why) => new RegExp(`runner ${pid} stopped: ${why}`);
  const skinning = (id) => E.ledger(id).rows.filter((r) => r.stage === 'skinning');

  // (a) blocked at the start of `building`; woken while the second runner is alive and owns the job
  const a = await frozenThenReplaced(E, { name: 'p13a.pdf', point: 'building' });
  await E.waitFor('the second runner to reach awaiting_approval', () => E.job(a.id).state === 'awaiting_approval', 30000);
  assert.equal(a.woke(), false, 'the first runner was blocked all that time');
  await wakeAndLeave(E, a);
  assert.equal(E.runnerPid(a.id), a.newPid, 'the first runner left the second runner\'s pid file alone');
  await seenAlive(E, a.id);
  assert.equal(E.job(a.id).state, 'awaiting_approval');
  assert.deepEqual(E.rows(a.id).map((r) => [r.stage, r.attempt, r.runner_pid]),
    [['tracing', 1, a.oldPid], ['building', 2, a.newPid], ['rendering', 1, a.newPid]], 'no row from the runner that woke');
  assert.match(E.log(a.id), stopped(a.oldPid, 'superseded'));
  assert.equal(E.ledger(a.id).rows.length, 0);
  await toDone(E, a.id);
  await gone(E, a.newPid, 'the second runner, after done');
  assert.deepEqual(E.rows(a.id).map((r) => [r.stage, r.attempt, r.runner_pid, r.status, Boolean(r.superseded)]),
    STAGES.map((s) => [s, s === 'building' ? 2 : 1, s === 'tracing' ? a.oldPid : a.newPid, 'done', false]),
    'one row per stage; every row after tracing is the second runner\'s');
  const built = E.rows(a.id).find((r) => r.stage === 'building').outputs[0];
  assert.equal(sha256FileSync(E.jobPath(a.id, built.path)), built.sha256, 'the output on the disk is what the row says');
  assert.equal(E.job(a.id).attempts.building, 2);
  assert.match(E.log(a.id), stopped(a.newPid, 'done'));
  assert.deepEqual(E.ledger(a.id).rows.map((r) => [r.stage, r.status]), PAID.map((s) => [s, 'settled']));
  for (const s of PAID) assert.equal(E.sends(a.id, s), 1, `${s}: sent once`);
  assert.equal(E.job(a.id).cost.spent_usd, 1.8);

  // (b) blocked after the `skinning` call was RESERVED and before it was sent; woken after the job is done
  const b = await frozenThenReplaced(E, { name: 'p13b.pdf', point: 'skinning:reserved' });
  await toDone(E, b.id);
  await gone(E, b.newPid, 'the second runner, after done');
  assert.equal(b.woke(), false);
  assert.deepEqual(skinning(b.id).map((r) => [r.seq, r.status, r.not_sent === true, r.sending_at]), [[1, 'failed', true, null], [2, 'settled', false, skinning(b.id)[1].sending_at]],
    'the first runner never marked its call as sending, so the second one dropped that reservation at once');
  assert.ok(skinning(b.id)[1].sending_at, 'the second runner marked its own call before it sent it');
  await wakeAndLeave(E, b);
  const sk = skinning(b.id);
  assert.deepEqual(sk.map((r) => [r.seq, r.status, r.settled_usd, r.not_sent === true, r.attempt]),
    [[1, 'failed', 0, true, 1], [2, 'settled', CALL_USD, false, 2]],
    'the blocked runner\'s reservation is closed as never sent; the second runner\'s call is the one that was made');
  assert.equal(sk[0].call_key, sk[1].call_key);
  assert.equal(sk[0].orphaned_at, undefined, 'it was never held as an unknown outcome');
  assert.equal(E.sends(b.id, 'skinning'), 1, 'the call was sent ONCE');
  let led = E.ledger(b.id);
  assert.equal(led.rows.filter((r) => r.status === 'settled').length, 3);
  assert.equal(led.rows.some((r) => r.status === 'orphaned' || r.status === 'reserved'), false, 'no reservation is left with an unknown outcome');
  assert.equal(E.job(b.id).cost.spent_usd, 1.8);
  assert.deepEqual(E.rows(b.id).map((r) => [r.stage, r.attempt, r.runner_pid]),
    STAGES.map((s) => [s, s === 'skinning' ? 2 : 1, STAGES.indexOf(s) < STAGES.indexOf('skinning') ? b.oldPid : b.newPid]));
  assert.match(E.log(b.id), new RegExp(`runner ${b.oldPid} skinning: seq 1 was reserved but never sent`));
  assert.match(E.log(b.id), stopped(b.oldPid, 'superseded'));
  assert.match(E.log(b.id), stopped(b.newPid, 'done'));

  // (c) blocked with the ANSWER of the `skinning` call in hand: the call was sent. The second runner cannot
  // know that, so it makes the same call. This is the one case in which a call is billed twice (rule 10):
  // both rows are in the ledger, the late one says so, and the answer the second runner cached is kept.
  const c = await frozenThenReplaced(E, { name: 'p13c.pdf', point: 'skinning:sent' });
  await toDone(E, c.id);
  await gone(E, c.newPid, 'the second runner, after done');
  assert.equal(c.woke(), false);
  assert.deepEqual(skinning(c.id).map((r) => [r.seq, r.status]), [[1, 'orphaned'], [2, 'settled']]);
  assert.equal(E.sends(c.id, 'skinning'), 2, 'both runners really sent the call');
  assert.equal(E.job(c.id).cost.spent_usd, 1.8, 'before the late answer is recorded');
  const cached = fs.readFileSync(E.jobPath(c.id, `cache/${skinning(c.id)[1].call_key}.json`), 'utf8');
  await wakeAndLeave(E, c);
  assert.deepEqual(skinning(c.id).map((r) => [r.seq, r.status, r.late === true, r.settled_usd, r.attempt]),
    [[1, 'settled', true, CALL_USD, 1], [2, 'settled', false, CALL_USD, 2]], 'the late answer is recorded: it was billed');
  assert.equal(E.sends(c.id, 'skinning'), 2, 'nothing was sent a third time');
  led = E.ledger(c.id);
  assert.equal(led.rows.filter((r) => r.status === 'settled').length, 4);
  assert.equal(led.rows.some((r) => r.status === 'orphaned' || r.status === 'reserved'), false);
  assert.equal(E.job(c.id).cost.spent_usd, 2.4, 'spent_usd follows the ledger: four calls were billed');
  assert.equal(fs.readFileSync(E.jobPath(c.id, `cache/${skinning(c.id)[1].call_key}.json`), 'utf8'), cached, 'the cached answer was not replaced');
  assert.deepEqual(E.rows(c.id).filter((r) => r.stage === 'skinning').map((r) => [r.attempt, r.runner_pid]), [[2, c.newPid]], 'the replaced runner wrote no row');
  assert.match(E.log(c.id), new RegExp(`runner ${c.oldPid} skinning: the late answer of seq 1 is recorded in the ledger only`));
  assert.match(E.log(c.id), stopped(c.oldPid, 'superseded'));

  for (const r of [a, b, c]) {
    assert.equal(E.job(r.id).state, 'done');
    assert.equal(fs.existsSync(E.jobPath(r.id, 'runner.pid')), false, 'the pid file was given back by the runner that owned it');
    await lockFree(E, r.id);
    schemaOk('ledger', E.ledger(r.id));
    schemaOk('manifest', readManifest(E.config.jobsDir, r.id));
    schemaOk('job', E.job(r.id));
  }
});

// Part 14 (contract §10 rule 13). Nobody replaces job A's runner here: it is only SILENT for a while (its
// thread is blocked when `rendering` starts, with the heavy lock in its hand). Job B takes the lock over and
// renders. When A's runner wakes it must stop its own rendering, write no row for that attempt, wait for the
// lock and render again; the two rendering rows never overlap.
test('14. a runner that was silent loses the heavy lock to another job: it stops, waits, renders again; no overlap', async () => {
  const E = await newEnv({ prefix: 'm03p14-', callUsd: 0, staleSeconds: 1 });
  const A = await frozenJob(E, { name: 'p14a.pdf', point: 'rendering' });
  assert.equal(E.heavy().pid, A.pid, 'A holds the heavy lock while it is blocked');

  const b = E.h.start_simulation({ pdf_path: E.pdf('p14b.pdf', 'p14b.pdf') }).job_id;
  await E.waitFor('B to render and reach awaiting_approval', () => E.job(b).state === 'awaiting_approval', 30000);
  assert.equal(A.woke(), false, 'A was blocked all the time B rendered');
  assert.equal(E.job(A.id).state, 'rendering');
  const pidB = E.runnerPid(b);
  const rowB = E.rows(b).find((r) => r.stage === 'rendering');
  assert.equal(rowB.attempt, 1);
  assert.match(E.log(b), new RegExp(`runner ${pidB} heavy lock taken over from silent pid ${A.pid}`));

  A.wake();
  await E.waitFor('A to give up its first attempt and render again', () => E.job(A.id).state === 'awaiting_approval', 30000);
  const rowsA = E.rows(A.id).filter((r) => r.stage === 'rendering');
  assert.deepEqual(rowsA.map((r) => [r.attempt, r.runner_pid, r.status]), [[2, A.pid, 'done']],
    'ONE rendering row for A: from its second attempt, by the same runner (nobody replaced it)');
  assert.ok(Date.parse(rowsA[0].started_at) >= Date.parse(rowB.finished_at), 'A rendered only after B had finished');
  assert.equal(E.job(A.id).attempts.rendering, 2);
  assert.equal(E.runnerPid(A.id), A.pid);
  await seenAlive(E, A.id);
  const logA = E.log(A.id);
  assert.match(logA, new RegExp(`runner ${A.pid} the heavy lock is no longer ours`));
  assert.match(logA, new RegExp(`runner ${A.pid} rendering: the heavy lock was taken over while this runner was silent; no manifest row`));
  await E.waitFor('the heavy lock to be free', () => E.heavy() === null, 5000);
  for (const id of [A.id, b]) {
    schemaOk('manifest', readManifest(E.config.jobsDir, id));
    schemaOk('job', E.job(id));
  }
});

// Part 15 (contract §11 item 3). While the runner is dead, the output of one earlier stage is damaged and the
// output of another is deleted. The runner goes back and builds them again; they come out byte for byte the
// same, so every stage after them is still valid: none runs again, and no paid call is made a second time.
test('15. a damaged and a deleted output of earlier stages are rebuilt; no later stage runs again; nothing is billed again', async () => {
  const E = await newEnv({ prefix: 'm03p15-', callUsd: CALL_USD, staleSeconds: 1 });
  const PAID = ['skinning', 'gating', 'finishing'];
  // The runner is blocked the moment `packaging` starts (the three paid stages are done) and is killed there,
  // so the kill does not have to catch a short window.
  const f = await frozenJob(E, { name: 'p15.pdf', point: 'packaging' });
  const id = f.id;
  await E.kill(id);
  const before = E.rows(id);
  assert.deepEqual(before.map((r) => r.stage), STAGES.slice(0, 6), 'rows for tracing … finishing; packaging was killed');
  const sha = Object.fromEntries(before.map((r) => [r.stage, r.outputs[0].sha256]));
  assert.equal(E.job(id).cost.spent_usd, 1.8);

  fs.writeFileSync(E.jobPath(id, 'stages/tracing/stub.json'), 'damaged\n');
  fs.rmSync(E.jobPath(id, 'stages/building/stub.json'));
  const s = E.h.start_simulation({ pdf_path: f.pdf });
  assert.equal(s.created, false);
  assert.equal(s.resumed, true);
  await toDone(E, id);

  const rows = E.rows(id);
  const of = (stage) => rows.filter((r) => r.stage === stage).map((r) => [r.attempt, Boolean(r.superseded)]);
  assert.deepEqual(of('tracing'), [[1, true], [2, false]], 'tracing ran again, its first row kept as superseded');
  assert.deepEqual(of('building'), [[1, true], [2, false]]);
  for (const st of ['rendering', ...PAID]) assert.deepEqual(of(st), [[1, false]], `${st}: not run again`);
  assert.deepEqual(of('packaging'), [[2, false]], 'packaging: its first attempt was killed and left no row');
  assert.deepEqual(of('qa'), [[1, false]]);
  for (const st of ['tracing', 'building']) {
    const r = rows.filter((x) => x.stage === st).at(-1);
    assert.equal(r.outputs[0].sha256, sha[st], `${st}: the row of the second attempt has the hash of the first`);
    assert.equal(sha256FileSync(E.jobPath(id, r.outputs[0].path)), sha[st], `${st}: rebuilt byte for byte`);
  }
  assert.deepEqual(E.ledger(id).rows.map((r) => [r.stage, r.status, r.attempt]), PAID.map((p) => [p, 'settled', 1]), 'the ledger did not grow');
  for (const p of PAID) assert.equal(E.sends(id, p), 1, `${p}: sent once`);
  assert.equal(E.job(id).cost.spent_usd, 1.8, 'nothing was billed again');
  schemaOk('ledger', E.ledger(id));
  schemaOk('manifest', readManifest(E.config.jobsDir, id));
  schemaOk('job', E.job(id));
});

// Part 16 (contract §12). No reservation is ever left open: a reserved row that a dead runner left is closed
// by the next runner, also when the next runner finds the answer in the cache.
test('16. a reservation left by a dead runner is always closed: orphaned when its send had started, dropped when it had not', async () => {
  const E = await newEnv({ prefix: 'm03p16-', callUsd: CALL_USD, staleSeconds: 1 });
  const skinning = (id) => E.ledger(id).rows.filter((r) => r.stage === 'skinning');

  // (a) QA round 3, defect D1. Runner 1 has the answer of the skinning call in hand and is blocked. Runner 2
  // takes the job over, reserves the same call, marks it as sending, and is KILLED before it has an answer.
  // Runner 1 wakes: its late answer is settled and cached. Runner 3 finds the answer in the cache; it must
  // close the reservation that runner 2 left as well.
  const a = await frozenThenReplaced(E, { name: 'p16a.pdf', point: 'skinning:sent', secondEnv: { ENGINE_TEST_PAUSE_AFTER_RESERVE_MS: 60000 } });
  await E.waitFor('runner 2 to reserve the call and mark it as sending', () => skinning(a.id).some((r) => r.seq === 2 && r.status === 'reserved' && r.sending_at), 30000);
  assert.deepEqual(skinning(a.id).map((r) => [r.seq, r.status]), [[1, 'orphaned'], [2, 'reserved']]);
  await wakeAndLeave(E, a);
  assert.deepEqual(skinning(a.id).map((r) => [r.seq, r.status, r.late === true]), [[1, 'settled', true], [2, 'reserved', false]]);
  assert.equal(E.runnerPid(a.id), a.newPid);
  await E.kill(a.id);   // runner 2, in the pause after it marked its call as sending
  assert.equal(E.sends(a.id, 'skinning'), 1, 'only runner 1 sent the call');
  assert.equal(E.h.start_simulation({ pdf_path: a.pdf }).resumed, true);
  await toDone(E, a.id);
  assert.deepEqual(skinning(a.id).map((r) => [r.seq, r.status, r.late === true]), [[1, 'settled', true], [2, 'orphaned', false]],
    'the reservation of the killed runner is closed: its send had started, so its outcome is not known');
  let led = E.ledger(a.id);
  assert.equal(led.rows.some((r) => r.status === 'reserved'), false, 'no reservation is left open');
  assert.equal(E.sends(a.id, 'skinning'), 1, 'runner 3 answered from the cache: nothing was sent again');
  assert.equal(led.rows.filter((r) => r.status === 'settled').length, 3);
  assert.equal(E.job(a.id).cost.spent_usd, 1.8);
  assert.deepEqual(E.rows(a.id).filter((r) => r.stage === 'skinning').map((r) => r.attempt), [3], 'one skinning row, from the third runner');

  // (b) A runner is blocked after it RESERVED the skinning call and before it marked it as sending, and is
  // killed there. It never sent the call, and the ledger can tell: the next runner drops the reservation
  // (nothing is held for it) and makes the call once.
  const f = await frozenJob(E, { name: 'p16b.pdf', point: 'skinning:reserved' });
  assert.deepEqual(skinning(f.id).map((r) => [r.seq, r.status, r.sending_at]), [[1, 'reserved', null]]);
  await E.kill(f.id);
  assert.equal(E.h.start_simulation({ pdf_path: f.pdf }).resumed, true);
  await toDone(E, f.id);
  assert.deepEqual(skinning(f.id).map((r) => [r.seq, r.status, r.not_sent === true, r.settled_usd]), [[1, 'failed', true, 0], [2, 'settled', false, CALL_USD]]);
  assert.equal(E.sends(f.id, 'skinning'), 1);
  led = E.ledger(f.id);
  assert.equal(led.rows.some((r) => r.status === 'reserved' || r.status === 'orphaned'), false, 'nothing is held for a call that was never sent');
  assert.equal(E.job(f.id).cost.spent_usd, 1.8);

  for (const id of [a.id, f.id]) {
    schemaOk('ledger', E.ledger(id));
    schemaOk('manifest', readManifest(E.config.jobsDir, id));
    schemaOk('job', E.job(id));
  }
});

// Part 17 (contract §14.1; QA round 5, defect D3). A late answer is settled on a job that is already done, and
// the runner that brought it is killed right after that settle. The copy of the total in job.json must be
// true all the same, and whatever the copy says, the engine reports what the ledger says.
test('17. what was spent is what the ledger says, also after done: a late answer, and its runner killed right after the settle', async () => {
  const E = await newEnv({ prefix: 'm03p17-', callUsd: CALL_USD, staleSeconds: 1 });
  // Runner 1: blocked with the answer of the skinning call in hand, and (when woken) a long pause right
  // after its settle, which is where round 5 killed it.
  const r = await frozenThenReplaced(E, { name: 'p17.pdf', point: 'skinning:sent', firstEnv: { ENGINE_TEST_PAUSE_AFTER_SETTLE_MS: 60000 } });
  await toDone(E, r.id);
  await gone(E, r.newPid, 'the second runner, after done');
  assert.equal(E.job(r.id).cost.spent_usd, 1.8, 'done: three calls settled, the first runner\'s answer not yet recorded');
  r.wake();
  await E.waitFor('the late row', () => E.ledger(r.id).rows.some((x) => x.late === true && x.status === 'settled'), 20000);
  await E.waitFor('the copy of the total in job.json', () => E.job(r.id).cost.spent_usd === 2.4, 5000);
  assert.ok(pidAlive(r.oldPid), 'runner 1 is still inside its pause after the settle: the copy was written with the settle, not at the end of the call');
  assert.ok(E.log(r.id).includes(`runner ${r.oldPid} test hook: pausing 60000 ms after the settle`));
  process.kill(r.oldPid);
  await gone(E, r.oldPid, 'runner 1, killed in its pause');
  assert.equal(E.job(r.id).cost.spent_usd, 2.4, 'the kill changed nothing: the total was already true');
  assert.deepEqual((await E.h.get_result({ job_id: r.id })).cost, { spent_usd: 2.4, cap_usd: 60 });
  assert.equal(E.ledger(r.id).rows.filter((x) => x.status === 'settled').length, 4);

  // The copy can still be behind: a process that dies in the few milliseconds between the ledger write and
  // the copy. That state is made by hand here. Every read through the engine reports the ledger's total and
  // puts the copy right; a done job gets no runner to do it.
  const stale = () => {
    const file = E.jobPath(r.id, 'job.json');
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    doc.cost.spent_usd = 1.8;
    fs.writeFileSync(file, JSON.stringify(doc, null, 2) + '\n');
    assert.equal(E.job(r.id).cost.spent_usd, 1.8);
  };
  stale();
  const again = E.h.start_simulation({ pdf_path: r.pdf });
  assert.deepEqual([again.created, again.resumed, again.job.state], [false, false, 'done'], 'a done job gets no runner');
  assert.equal(again.job.cost.spent_usd, 2.4);
  assert.equal(E.job(r.id).cost.spent_usd, 2.4, 'the read put the copy right');
  stale();
  assert.equal(E.h.get_job({ job_id: r.id }).job.cost.spent_usd, 2.4);
  assert.equal(E.job(r.id).cost.spent_usd, 2.4);
  stale();
  assert.equal(E.h.list_jobs({}).jobs.find((j) => j.job_id === r.id).cost.spent_usd, 2.4);
  stale();
  assert.deepEqual((await E.h.get_result({ job_id: r.id })).cost, { spent_usd: 2.4, cap_usd: 60 });
  assert.equal(E.job(r.id).cost.spent_usd, 2.4);
  schemaOk('ledger', E.ledger(r.id));
  schemaOk('job', E.job(r.id));
});
