import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  runRunner, runnerMain, nextAfter, hooksFromEnv, claimPid, releasePid, StageInterrupted, QUOTE_BASIS, APPROVAL_WAIT_MS,
  isTransient, MAX_TRANSIENT,
} from '../../engine/runner.mjs';
import { newJob, writeJob, readJob, updateJob, setState, STAGES } from '../../engine/jobs.mjs';
import { readManifest } from '../../engine/manifest.mjs';
import { readLedger } from '../../engine/ledger.mjs';
import { readHeavy } from '../../engine/heavy-lock.mjs';
import { EngineError } from '../../engine/inbox.mjs';
import { REGISTRY } from '../../engine/stages/index.mjs';
import { validate } from '../../mcp/schema-check.mjs';
import { loadJobSchema } from '../../mcp/tools.mjs';
import { stubConfig, writeFile, sink, holdLock } from '../helpers/fakes.mjs';

const ID = 'abcdef0123456789';
const input = { pdf_path: 'C:/x/source.pdf', pdf_name: 'plan.pdf', pdf_sha256: 'b'.repeat(64), apartment: 'apt846' };
const MANIFEST_SCHEMA = JSON.parse(fs.readFileSync(new URL('../../contracts/manifest.schema.json', import.meta.url), 'utf8'));

function setup(state = 'queued', { approved = false, callUsd = 0.6 } = {}) {
  const c = stubConfig({ serve: { host: '127.0.0.1', port: 8123 } });
  const config = { ...c, stub: { ...c.stub, callUsd }, runner: { ...c.runner, heartbeatMs: 10 } };
  const job = newJob({ id: ID, mode: 'stub', now: '2026-11-16T18:00:00.000Z', input });
  setState(job, state, '2026-11-16T18:00:00.000Z');
  if (approved) {
    job.approval = { cap_usd: 60, at: job.updated_at };
    job.cost.cap_usd = 60;
  }
  writeJob(config.jobsDir, job);
  return config;
}

// A clock that moves one second per call.
function fakeTime() {
  let t = Date.parse('2026-11-16T18:00:00.000Z');
  return { now: () => new Date((t += 1000)).toISOString(), clock: () => t };
}

// The real stub stages, with a stage replaced where a test needs it.
const registry = (over = {}) => ({ ...REGISTRY, ...Object.fromEntries(Object.entries(over).map(([k, v]) => [k, { stub: v }])) });

function base(config, over = {}) {
  const logs = [];
  const opts = {
    config, jobId: ID, pid: 4242, ...fakeTime(), sleep: async () => {}, log: (m) => logs.push(m),
    ensureServe: async () => {}, alive: (p) => p === 4242, timer: () => () => {}, claimWaitMs: 0, approvalWaitMs: 0,
    // These jobs are made by hand, with no PDF in their folder: the check of the stored input (contract 1.1 §4)
    // is answered here, and tested for real in tests/unit/intake-wiring.test.mjs.
    verifyInput: () => ({ ok: true }), ...over,
  };
  return { opts, logs };
}

test('nextAfter, hooksFromEnv, StageInterrupted', () => {
  assert.equal(nextAfter('tracing'), 'building');
  assert.equal(nextAfter('rendering'), 'awaiting_approval');
  assert.equal(nextAfter('skinning'), 'gating');
  assert.equal(nextAfter('qa'), 'done');
  assert.equal(nextAfter('weird'), null);
  assert.deepEqual(hooksFromEnv({}), { pauseAfterReserveMs: 0, pauseAfterCacheMs: 0, pauseAfterSettleMs: 0, freezeMs: 0, freezeAt: '', freezeWake: '' });
  assert.equal(hooksFromEnv({ ENGINE_TEST_PAUSE_AFTER_CACHE_MS: '40' }).pauseAfterCacheMs, 40);
  assert.deepEqual(hooksFromEnv({ ENGINE_TEST_PAUSE_AFTER_RESERVE_MS: '500', ENGINE_TEST_PAUSE_AFTER_SETTLE_MS: 'x' }),
    { pauseAfterReserveMs: 500, pauseAfterCacheMs: 0, pauseAfterSettleMs: 0, freezeMs: 0, freezeAt: '', freezeWake: '' });
  assert.deepEqual(hooksFromEnv({ ENGINE_TEST_FREEZE_MS: '4000', ENGINE_TEST_FREEZE_AT: 'skinning:reserved' }),
    { pauseAfterReserveMs: 0, pauseAfterCacheMs: 0, pauseAfterSettleMs: 0, freezeMs: 4000, freezeAt: 'skinning:reserved', freezeWake: '' });
  assert.equal(hooksFromEnv({ ENGINE_TEST_FREEZE_WAKE: 'C:/t/wake' }).freezeWake, 'C:/t/wake');
  assert.equal(hooksFromEnv({ ENGINE_TEST_FREEZE_MS: '9', ENGINE_TEST_FREEZE_AT: 'gating:sent' }).freezeAt, 'gating:sent');
  assert.deepEqual(hooksFromEnv({ ENGINE_TEST_PAUSE_AFTER_SETTLE_MS: '-3' }).pauseAfterSettleMs, 0);
  assert.equal(new StageInterrupted('cancelled').state, 'cancelled');
  assert.equal(APPROVAL_WAIT_MS, 86400000);
});

test('a whole walk with the real stub stages: rows, quote, wait, approval, three paid calls, result, heartbeat, pid released', async () => {
  const config = setup();
  const seen = [];
  const served = [];
  let beat;
  let stopped = false;
  const { opts, logs } = base(config, {
    approvalWaitMs: APPROVAL_WAIT_MS,
    timer: (fn, ms) => { beat = fn; assert.equal(ms, 10); return () => { stopped = true; }; },
    ensureServe: async () => { served.push(readJob(config.jobsDir, ID).state); },
    sleep: async () => {
      const j = readJob(config.jobsDir, ID);
      assert.deepEqual(validate(loadJobSchema(), j), [], j.state);
      assert.equal(fs.readFileSync(`${config.jobsDir}/${ID}/runner.pid`, 'utf8'), '4242');
      seen.push(j.state);
      if (j.state === 'awaiting_approval' && !j.approval) {
        assert.deepEqual(j.quote, { estimate_usd: 48, range_usd: [40, 60], rooms: 11, basis: QUOTE_BASIS });
        const before = j.heartbeat_at;
        beat();
        assert.ok(readJob(config.jobsDir, ID).heartbeat_at > before, 'the heartbeat moves while waiting');
        updateJob(config.jobsDir, ID, (x) => { x.approval = { cap_usd: 60, at: x.updated_at }; x.cost.cap_usd = 60; return x; });
      }
    },
  });
  assert.equal(await runRunner(opts), 'done');
  assert.equal(stopped, true);
  const job = readJob(config.jobsDir, ID);
  assert.equal(job.state, 'done');
  assert.equal(job.percent, 100);
  assert.deepEqual(job.result, { local_url: 'http://127.0.0.1:8123/tour/?scope=apartment', tour_dir: `${config.stub.siteRoot}/tour` });
  assert.deepEqual(served, ['qa']);
  assert.equal(job.cost.spent_usd, 1.8);
  assert.deepEqual(job.attempts, Object.fromEntries(STAGES.map((s) => [s, 1])));
  const m = readManifest(config.jobsDir, ID);
  assert.deepEqual(validate(MANIFEST_SCHEMA, m), []);
  assert.deepEqual(m.rows.map((r) => r.stage), STAGES);
  assert.deepEqual(m.rows.map((r) => r.cost_usd), [0, 0, 0, 0.6, 0.6, 0.6, 0, 0]);
  assert.ok(m.rows.every((r) => r.runner_pid === 4242 && r.attempt === 1));
  const out = JSON.parse(fs.readFileSync(`${config.jobsDir}/${ID}/stages/gating/stub.json`, 'utf8'));
  assert.deepEqual(Object.keys(out), ['stage', 'job_id', 'inputs_sha256', 'mode']);
  assert.deepEqual([out.stage, out.job_id, out.mode], ['gating', ID, 'stub']);
  assert.equal(readLedger(config.jobsDir, ID).rows.length, 3);
  assert.ok(seen.includes('awaiting_approval') && seen.includes('rendering'));
  assert.equal(fs.existsSync(`${config.jobsDir}/${ID}/runner.pid`), false);
  assert.equal(fs.existsSync(config.runner.heavyLock), false, 'the heavy lock was released');
  assert.match(logs.join('\n'), /rendering: attempt 1 started/);
  // the heartbeat never writes over a terminal job
  beat();
  assert.equal(readJob(config.jobsDir, ID).heartbeat_at, job.heartbeat_at);
});

test('resume rule: every stage with a valid row is skipped, not run, not billed; rows untouched', async () => {
  const config = setup('queued', { approved: true });
  await runRunner(base(config).opts);
  const rows = JSON.stringify(readManifest(config.jobsDir, ID).rows);
  updateJob(config.jobsDir, ID, (j) => { setState(j, 'tracing', j.updated_at); j.result = null; return j; });
  let ran = 0;
  const reg = Object.fromEntries(STAGES.map((s) => [s, { stub: { run: async () => { ran++; return { outputs: [] }; } } }]));
  const { opts, logs } = base(config, { registry: reg, pid: 5555, alive: (p) => p === 5555 });
  assert.equal(await runRunner(opts), 'done');
  assert.equal(ran, 0);
  assert.equal(JSON.stringify(readManifest(config.jobsDir, ID).rows), rows);
  assert.deepEqual(readJob(config.jobsDir, ID).attempts, Object.fromEntries(STAGES.map((s) => [s, 1])));
  assert.equal(readLedger(config.jobsDir, ID).rows.length, 3);
  assert.match(logs.join('\n'), /tracing: skipped \(valid row, attempt 1\)/);
});

test('an earlier stage whose output changed: the runner goes back to it, its old row superseded', async () => {
  const config = setup('queued', { approved: true });
  await runRunner(base(config).opts);
  fs.writeFileSync(`${config.jobsDir}/${ID}/stages/building/stub.json`, 'damaged\n');
  updateJob(config.jobsDir, ID, (j) => setState(j, 'rendering', j.updated_at));
  const { opts, logs } = base(config);
  assert.equal(await runRunner(opts), 'done');
  assert.match(logs.join('\n'), /building: no valid manifest row any more; going back from rendering/);
  const rows = readManifest(config.jobsDir, ID).rows;
  assert.deepEqual(rows.filter((r) => r.stage === 'building').map((r) => [r.attempt, Boolean(r.superseded)]), [[1, true], [2, false]]);
  assert.equal(rows.filter((r) => r.stage === 'tracing').length, 1, 'tracing was still valid: not run again');
  // The stage that ran again reproduced the same bytes, so every stage after it is still valid: none ran
  // again, and no paid call was made a second time.
  assert.equal(fs.readFileSync(`${config.jobsDir}/${ID}/stages/building/stub.json`, 'utf8').includes('damaged'), false, 'the output was rebuilt');
  const built = rows.filter((r) => r.stage === 'building');
  assert.equal(built[0].outputs[0].sha256, built[1].outputs[0].sha256, 'the rebuilt output has the hash of the first one');
  for (const s of STAGES.filter((x) => x !== 'building')) {
    assert.deepEqual(rows.filter((r) => r.stage === s).map((r) => [r.attempt, Boolean(r.superseded)]), [[1, false]], `${s}: not run again`);
  }
  const l = readLedger(config.jobsDir, ID);
  assert.deepEqual(l.rows.map((r) => [r.stage, r.status]), [['skinning', 'settled'], ['gating', 'settled'], ['finishing', 'settled']], 'nothing was billed again');
  assert.equal(readJob(config.jobsDir, ID).cost.spent_usd, 1.8);
});

test('a stage that runs again with OTHER bytes changes the inputs of every stage after it: they run again, new call keys', async () => {
  // Contract 0.3 §9: a paid call is keyed on the stage's inputs. This is why a real stage must reproduce its
  // output byte for byte: here `building` does not (it writes its attempt number), so the three paid stages
  // after it are run, and billed, again.
  const config = setup('queued', { approved: true });
  const unstable = { run: async (ctx) => {
    writeFile(`${ctx.stageDir}/out.txt`, `attempt ${ctx.attempt}\n`);
    return { outputs: [{ path: 'stages/building/out.txt' }] };
  } };
  const reg = registry({ building: unstable });
  await runRunner(base(config, { registry: reg }).opts);
  assert.equal(readJob(config.jobsDir, ID).cost.spent_usd, 1.8);
  fs.rmSync(`${config.jobsDir}/${ID}/stages/building/out.txt`);
  updateJob(config.jobsDir, ID, (j) => setState(j, 'qa', j.updated_at));
  assert.equal(await runRunner(base(config, { registry: reg }).opts), 'done');
  const rows = readManifest(config.jobsDir, ID).rows;
  for (const s of STAGES.filter((x) => x !== 'tracing')) {
    assert.deepEqual(rows.filter((r) => r.stage === s).map((r) => [r.attempt, Boolean(r.superseded)]), [[1, true], [2, false]], `${s}: ran again`);
  }
  assert.equal(readLedger(config.jobsDir, ID).rows.length, 6, 'new inputs downstream = new call keys');
  assert.equal(readJob(config.jobsDir, ID).cost.spent_usd, 3.6);
});

test('cancel in the middle of a stage: no row for it, heavy lock released, exits "cancelled"', async () => {
  const config = setup('rendering');
  const reg = registry({ rendering: { run: async (ctx) => {
    assert.equal(readHeavy(config.runner.heavyLock).pid, 4242, 'the heavy lock is held while rendering');
    ctx.checkCancelled();
    updateJob(config.jobsDir, ID, (j) => setState(j, 'cancelled', j.updated_at));
    ctx.checkCancelled();
    return { outputs: [] };
  } } });
  const { opts, logs } = base(config, { registry: reg });
  assert.equal(await runRunner(opts), 'cancelled');
  assert.deepEqual(readManifest(config.jobsDir, ID).rows.map((r) => r.stage), ['tracing', 'building'], 'no row for the interrupted rendering');
  assert.equal(fs.existsSync(config.runner.heavyLock), false);
  assert.equal(readJob(config.jobsDir, ID).percent, 45);
  assert.match(logs.join('\n'), /rendering: interrupted \(the job is now "cancelled"\); no manifest row/);
});

test('(2.1) a stage says what it waits for, while it is still the job\'s stage: the job file carries it, and stops carrying it', async () => {
  const config = setup('rendering');
  const seen = [];
  const reg = registry({ rendering: { run: async (ctx) => {
    const look = () => seen.push(readJob(config.jobsDir, ID).waiting_for ?? null);
    look();
    ctx.waiting('blender-lock');
    look();
    ctx.waiting('blender-lock');           // said again: nothing is written
    const at = readJob(config.jobsDir, ID).updated_at;
    ctx.waiting(null);
    look();
    ctx.waiting(null);                     // nothing to take away
    assert.equal(readJob(config.jobsDir, ID).updated_at, at, 'a second «no longer waiting» writes nothing');
    ctx.waiting('blender-lock');
    updateJob(config.jobsDir, ID, (j) => setState(j, 'cancelled', j.updated_at));
    ctx.waiting('blender-lock');           // the job left the stage: its file is not touched
    ctx.waiting(null);
    look();
    ctx.checkCancelled();
    return { outputs: [] };
  } } });
  assert.equal(await runRunner(base(config, { registry: reg }).opts), 'cancelled');
  assert.deepEqual(seen, [null, 'blender-lock', null, 'blender-lock'], 'the last look: what a job that left the stage says is not this stage\'s to change');
});

test('a stage that throws: STAGE_FAILED for an Error, its own code for an EngineError; no row; lock released', async () => {
  let config = setup('rendering');
  let { opts } = base(config, { registry: registry({ rendering: { run: async () => { throw new Error('blender crashed'); } } }) });
  assert.equal(await runRunner(opts), 'failed');
  let j = readJob(config.jobsDir, ID);
  assert.deepEqual(j.reason, { code: 'STAGE_FAILED', message: 'rendering: blender crashed' });
  assert.equal(j.percent, 45);
  assert.deepEqual(validate(loadJobSchema(), j), []);
  assert.deepEqual(readManifest(config.jobsDir, ID).rows.map((r) => r.stage), ['tracing', 'building'], 'no row for the failed rendering');
  assert.equal(fs.existsSync(config.runner.heavyLock), false);

  config = setup('queued', { approved: true, callUsd: 61 });
  // The cap is NOT a failure and not a dead end (contract 0.3 §10.3): back to awaiting_approval.
  ({ opts } = base(config, { approvalWaitMs: -1 }));
  assert.equal(await runRunner(opts), 'approval-timeout', 'a paid call above the cap: the job waits for a larger approval');
  j = readJob(config.jobsDir, ID);
  assert.equal(j.state, 'awaiting_approval');
  assert.equal(j.reason.code, 'BUDGET_CAP');
  assert.equal(j.approval, null);
  assert.deepEqual(j.approvals.map((a) => a.cap_usd), [60], 'the old approval is kept in the history');
  assert.deepEqual([j.quote.estimate_usd, j.quote.range_usd, j.quote.cap_reached, j.quote.rooms], [61, [61, 61], true, 11]);
  assert.deepEqual(validate(loadJobSchema(), j), []);
  assert.equal(readLedger(config.jobsDir, ID).rows.length, 0, 'nothing reserved');
  assert.deepEqual(readManifest(config.jobsDir, ID).rows.map((r) => r.stage), ['tracing', 'building', 'rendering'], 'no row for the stage that hit the cap');
  // A larger approval continues the job from the same stage; the cap in force is never crossed.
  updateJob(config.jobsDir, ID, (x) => { x.approval = { cap_usd: 200, at: x.updated_at }; x.cost.cap_usd = 200; x.reason = null; return x; });
  ({ opts } = base(config));
  assert.equal(await runRunner(opts), 'done');
  j = readJob(config.jobsDir, ID);
  assert.equal(j.cost.spent_usd, 183);
  assert.deepEqual(readLedger(config.jobsDir, ID).rows.map((r) => r.status), ['settled', 'settled', 'settled']);
  assert.deepEqual(readManifest(config.jobsDir, ID).rows.filter((r) => !r.superseded).map((r) => [r.stage, r.attempt]),
    [['tracing', 1], ['building', 1], ['rendering', 1], ['skinning', 2], ['gating', 1], ['finishing', 1], ['packaging', 1], ['qa', 1]]);

  config = setup('tracing');
  ({ opts } = base(config, { registry: registry({ tracing: { run: async () => { throw new EngineError('TRACE_GATE_FAIL', 'no walls'); } } }) }));
  assert.equal(await runRunner(opts), 'failed');
  assert.equal(readJob(config.jobsDir, ID).reason.code, 'TRACE_GATE_FAIL');

  config = setup('tracing');
  ({ opts } = base(config, { registry: { ...REGISTRY, tracing: {} } }));
  assert.equal(await runRunner(opts), 'failed');
  assert.match(readJob(config.jobsDir, ID).reason.message, /has no "stub" implementation/);

  config = setup('tracing');
  ({ opts } = base(config, { registry: registry({ tracing: { run: async () => ({ outputs: [{ path: 'stages/tracing/none.json' }] }) } }) }));
  assert.equal(await runRunner(opts), 'failed', 'an output that is not on the disk');
  assert.equal(readJob(config.jobsDir, ID).reason.code, 'STAGE_FAILED');

  config = setup('tracing');
  ({ opts } = base(config, { registry: registry({ tracing: { run: async () => null } }) }));
  assert.equal(await runRunner(opts), 'approval-timeout');
  assert.deepEqual(readManifest(config.jobsDir, ID).rows[0].outputs, [], 'a stage with no outputs still gets its row');
});

test('heavy lock busy: waits in building with waiting_for, takes the lock when the holder dies, field removed', async () => {
  const config = setup('building');
  writeFile(config.runner.heavyLock, JSON.stringify({ pid: 999, job_id: 'other', at: 't' }));
  let polls = 0;
  const { opts, logs } = base(config, {
    approvalWaitMs: 0,
    alive: (p) => p === 4242 || (p === 999 && polls < 3),
    sleep: async () => {
      const j = readJob(config.jobsDir, ID);
      if (j.waiting_for) {
        polls++;
        assert.equal(j.state, 'building');
        assert.equal(j.waiting_for, 'heavy-lock');
        assert.deepEqual(validate(loadJobSchema(), j), []);
      }
    },
  });
  assert.equal(await runRunner(opts), 'approval-timeout');
  const j = readJob(config.jobsDir, ID);
  assert.equal(j.state, 'awaiting_approval');
  assert.equal(j.waiting_for, undefined);
  assert.equal(polls, 3);
  const log = logs.join('\n');
  assert.match(log, /waiting for the heavy lock \(held by job other, pid 999\)/);
  assert.match(log, /heavy lock taken over from dead pid 999/);
  assert.match(log, /no approval in time/);
  assert.equal(fs.existsSync(config.runner.heavyLock), false);
});

test('the heavy lock is held until the job leaves the heavy state, and carried across two heavy stages in a row', async () => {
  const c = setup('queued');
  const config = { ...c, runner: { ...c.runner, heavyStages: ['building', 'rendering'] } };
  const seen = [];
  const probe = { run: async (ctx) => {
    seen.push([ctx.job.state, readHeavy(config.runner.heavyLock)?.pid]);
    return { outputs: [] };
  } };
  const { opts } = base(config, { registry: registry({ building: probe, rendering: probe }) });
  assert.equal(await runRunner(opts), 'approval-timeout');
  assert.deepEqual(seen, [['building', 4242], ['rendering', 4242]]);
  assert.equal(readJob(config.jobsDir, ID).state, 'awaiting_approval');
  assert.equal(fs.existsSync(config.runner.heavyLock), false, 'released once the job showed awaiting_approval');
});

test('heavy lock busy and the job is cancelled while it waits: exits, waiting_for removed', async () => {
  const config = setup('building');
  writeFile(config.runner.heavyLock, JSON.stringify({ pid: 999, job_id: 'other', at: 't' }));
  const { opts } = base(config, {
    alive: (p) => p === 4242 || p === 999,
    sleep: async () => {
      if (readJob(config.jobsDir, ID).waiting_for) updateJob(config.jobsDir, ID, (j) => setState(j, 'cancelled', j.updated_at));
    },
  });
  assert.equal(await runRunner(opts), 'cancelled');
  assert.equal(readJob(config.jobsDir, ID).waiting_for, undefined);
  assert.equal(readHeavy(config.runner.heavyLock).pid, 999, 'the other holder keeps its lock');
});

test('resumed IN a heavy stage with the lock busy: waits in that stage; cancelled meanwhile → exits', async () => {
  const config = setup('queued');
  // tracing and building get valid rows; rendering fails
  await runRunner(base(config, { registry: registry({ rendering: { run: async () => { throw new Error('x'); } } }) }).opts);
  updateJob(config.jobsDir, ID, (j) => { setState(j, 'rendering', j.updated_at); j.reason = null; return j; });
  writeFile(config.runner.heavyLock, JSON.stringify({ pid: 999, job_id: 'other', at: 't' }));
  const { opts } = base(config, {
    alive: (p) => p === 4242 || p === 999,
    sleep: async () => {
      const j = readJob(config.jobsDir, ID);
      assert.equal(j.waiting_for, 'heavy-lock');
      updateJob(config.jobsDir, ID, (x) => setState(x, 'cancelled', x.updated_at));
    },
  });
  assert.equal(await runRunner(opts), 'cancelled');
});

test('the job leaves the state while the heavy lock is taken: the lock is given back', async () => {
  const config = setup('building');
  let n = 0;
  const reg = registry({ building: { run: async (ctx) => {
    n++;
    writeFile(`${ctx.stageDir}/x.json`, '{}');
    updateJob(config.jobsDir, ID, (j) => setState(j, 'cancelled', j.updated_at));
    return { outputs: [{ path: 'stages/building/x.json' }] };
  } } });
  const { opts } = base(config, { registry: reg });
  assert.equal(await runRunner(opts), 'cancelled');
  assert.equal(n, 1);
  assert.equal(readManifest(config.jobsDir, ID).rows.filter((r) => r.stage === 'building').length, 1, 'the finished stage keeps its true row');
  assert.equal(fs.existsSync(config.runner.heavyLock), false, 'taken for rendering, then given back');
});

test('an approval already there: awaiting_approval is passed without a wait; a state with no earlier rows walks back first', async () => {
  const config = setup('awaiting_approval', { approved: true, callUsd: 0 });
  const states = [];
  const reg = Object.fromEntries(STAGES.map((s) => [s, { stub: { run: async (ctx) => { states.push(ctx.job.state); return { outputs: [] }; } } }]));
  assert.equal(await runRunner(base(config, { registry: reg, sleep: async () => assert.fail('no wait') }).opts), 'done');
  assert.deepEqual(states, STAGES, 'skinning had no valid earlier rows: back to tracing');
});

test('already terminal / unknown job / malformed id / a state outside the contract / the job file vanishes', async () => {
  assert.equal(await runRunner(base(setup('done'), { sleep: async () => assert.fail() }).opts), 'done');
  const c = stubConfig();
  assert.equal(await runRunner({ config: c, jobId: '0000000000000000' }), 'no-job');
  assert.equal(await runRunner({ config: c, jobId: '../x' }), 'no-job');
  // A state the contract does not have cannot be written by the engine, and a file that carries one (a hand
  // edit) is not read as a job: the runner stops and leaves it as it is (contract 1.1 §5).
  const odd = setup();
  assert.throws(() => updateJob(odd.jobsDir, ID, (j) => { j.state = 'weird'; return j; }), /its state is "weird"/);
  const oddFile = `${odd.jobsDir}/${ID}/job.json`;
  fs.writeFileSync(oddFile, JSON.stringify({ ...readJob(odd.jobsDir, ID), state: 'weird' }));
  const oddBytes = fs.readFileSync(oddFile, 'utf8');
  assert.equal(await runRunner(base(odd).opts), 'unreadable');
  assert.equal(fs.readFileSync(oddFile, 'utf8'), oddBytes);
  assert.equal(fs.existsSync(`${odd.jobsDir}/${ID}/runner.pid`), false);
  const gone = setup('awaiting_approval');
  assert.equal(await runRunner(base(gone, { sleep: async () => fs.rmSync(`${gone.jobsDir}/${ID}/job.json`) }).opts), 'no-job');
});

test('a second runner waits for runner.pid, then exits "busy"; a stale pid file is taken over; claim/release', async () => {
  const config = setup();
  const pidFile = `${config.jobsDir}/${ID}/runner.pid`;
  writeFile(pidFile, '555');
  // The clock starts at the real time (the pid file's age is measured against it) and moves only when the
  // runner sleeps, so the count of waits does not depend on how loaded the machine is. With the real clock and
  // a 150 ms window, one slow pass of the loop made this fail once under a parallel suite (milestone 1.1 gate).
  let slept = 0;
  let t = Date.now();
  const { opts, logs } = base(config, { alive: () => true, claimWaitMs: 150, clock: () => t,
    sleep: async (ms) => { slept++; t += ms; } });
  assert.equal(await runRunner(opts), 'busy');
  assert.equal(slept, 2, 'it waited for the other runner: two waits of 100 ms cover the 150 ms window');
  assert.match(logs.join('\n'), /another runner holds runner\.pid/);
  assert.equal(fs.readFileSync(pidFile, 'utf8'), '555');
  assert.equal(claimPid(config, ID, 9, () => false), true);
  assert.equal(fs.readFileSync(pidFile, 'utf8'), '9');
  assert.equal(claimPid(config, ID, 9, () => true), true, 'its own pid');
  releasePid(config, ID, 8);
  assert.ok(fs.existsSync(pidFile), 'not released by another pid');
  releasePid(config, ID, 9);
  assert.equal(fs.existsSync(pidFile), false);
  releasePid(config, ID, 9);
  assert.equal(claimPid(config, ID, 9), true, 'no pid file: claimed');
  fs.rmSync(pidFile);
  fs.mkdirSync(pidFile);
  assert.throws(() => claimPid(config, ID, 9), /EISDIR|EPERM|EACCES/);
});

test('a heartbeat that cannot take the job lock is skipped, not fatal', async () => {
  const config = setup('awaiting_approval');
  let beat;
  const { opts, logs } = base(config, { approvalWaitMs: -1, timer: (fn) => { beat = fn; return () => {}; } });
  assert.equal(await runRunner(opts), 'approval-timeout');
  // a job.lock held by a live process keeps the lock busy: updateJob throws after its wait
  holdLock(`${config.jobsDir}/${ID}/job.lock`);
  beat();
  fs.rmSync(`${config.jobsDir}/${ID}/job.lock`, { recursive: true });
  assert.match(logs.join('\n'), /heartbeat skipped: job abcdef0123456789: lock busy/);
});

test('a transient file error (EPERM, lock busy) is waited out, not a failure; past MAX_TRANSIENT it ends the runner', async () => {
  assert.equal(isTransient(Object.assign(new Error('x'), { code: 'EPERM' })), true);
  assert.equal(isTransient(new Error('job abc: lock busy')), true);
  assert.equal(isTransient(new Error('boom')), false);
  assert.equal(isTransient(null), false);
  let config = setup('queued', { callUsd: 0 });
  let n = 0;
  let reg = registry({ tracing: { run: async () => {
    if (++n < 3) throw Object.assign(new Error('EPERM: rename'), { code: 'EPERM' });
    return { outputs: [] };
  } } });
  let { opts, logs } = base(config, { registry: reg });
  assert.equal(await runRunner(opts), 'approval-timeout');
  assert.equal(n, 3);
  assert.equal(readJob(config.jobsDir, ID).attempts.tracing, 3);
  assert.equal(readManifest(config.jobsDir, ID).rows.filter((r) => r.stage === 'tracing').length, 1);
  assert.match(logs.join('\n'), /transient file error \(2\/20\), trying again: EPERM/);
  config = setup('queued');
  reg = registry({ tracing: { run: async () => { throw new Error('job x: lock busy'); } } });
  ({ opts } = base(config, { registry: reg }));
  await assert.rejects(runRunner(opts), /lock busy/);
  assert.equal(readJob(config.jobsDir, ID).attempts.tracing, MAX_TRANSIENT + 1);
  assert.equal(fs.existsSync(`${config.jobsDir}/${ID}/runner.pid`), false, 'the pid file is released even then');
});

test('runnerMain: loads the config from env, passes the hooks, exit codes, logs to stderr', async () => {
  const err = sink();
  let got;
  const code = await runnerMain([ID], { env: { ENGINE_TEST_PAUSE_AFTER_RESERVE_MS: '7' }, stderr: err,
    load: ({ env }) => ({ fromEnv: env }), run: async (o) => { got = o; return 'done'; } });
  assert.equal(code, 0);
  assert.equal(got.jobId, ID);
  assert.deepEqual(got.hooks, { pauseAfterReserveMs: 7, pauseAfterCacheMs: 0, pauseAfterSettleMs: 0, freezeMs: 0, freezeAt: '', freezeWake: '' });
  assert.match(err.text, /runner \d+ stopped: done/);
  assert.equal(await runnerMain(['x'], { env: {}, stderr: sink(), load: () => ({}), run: async () => 'no-job' }), 1);
  const e2 = sink();
  assert.equal(await runnerMain([ID], { env: {}, stderr: e2, load: () => { throw new Error('bad config'); } }), 1);
  assert.match(e2.text, /error: .*bad config/);
});

// ---- contract 0.3 §10 (after the first QA round) ----
import { writeLedger as writeLedgerR2 } from '../../engine/ledger.mjs';
import { readHeavy as readHeavyR2 } from '../../engine/heavy-lock.mjs';

test('round 2: spent_usd is put right from the ledger when a runner starts', async () => {
  const config = setup('awaiting_approval');
  const r = (over) => ({ seq: 1, call_key: 'a'.repeat(64), stage: 'skinning', provider: 'stub', what: 'w', reserved_usd: 0.6,
    reserved_at: 't', status: 'settled', settled_usd: 0.6, settled_at: 't', answer_sha256: 'b'.repeat(64), attempt: 1, ...over });
  writeLedgerR2(config.jobsDir, { schema: 'habait/ledger.v1', job_id: ID, cap_usd: null, rows: [
    r(), r({ seq: 2, call_key: 'c'.repeat(64), stage: 'gating', status: 'orphaned', settled_usd: null, settled_at: null, answer_sha256: null }) ] });
  updateJob(config.jobsDir, ID, (j) => { j.cost.spent_usd = 0.1; return j; });
  assert.equal(await runRunner(base(config, { approvalWaitMs: -1 }).opts), 'approval-timeout');
  assert.equal(readJob(config.jobsDir, ID).cost.spent_usd, 0.6, 'the settled sum; an orphaned reservation is not spent');
});

test('round 2: the heavy lock is refreshed at every heartbeat', async () => {
  const config = setup('queued');
  let beatFn = null;
  const seen = [];
  const { opts } = base(config, { approvalWaitMs: -1, timer: (fn) => { beatFn = fn; return () => {}; },
    registry: registry({ rendering: { run: async (ctx) => {
      const before = readHeavyR2(config.runner.heavyLock);
      beatFn();
      seen.push([before.pid, before.refreshed_at, readHeavyR2(config.runner.heavyLock).refreshed_at]);
      writeFile(`${ctx.stageDir}/stub.json`, '{}\n');
      return { outputs: [{ path: 'stages/rendering/stub.json' }] };
    } } }) });
  assert.equal(await runRunner(opts), 'approval-timeout');
  assert.equal(seen.length, 1);
  assert.equal(seen[0][0], 4242);
  assert.notEqual(seen[0][1], seen[0][2], 'refreshed_at moved with the heartbeat');
  assert.equal(fs.existsSync(config.runner.heavyLock), false, 'released after the stage');
});

test('round 2: a cancel that arrives during a paid call: what was done and paid is recorded, then the runner stops', async () => {
  const config = setup('queued', { approved: true });
  const { opts } = base(config, { registry: registry({ skinning: { run: async (ctx) => {
    await ctx.paidCall({ key: 'k', provider: 'stub', what: 'w', estimate_usd: 0.6 }, async () => {
      updateJob(config.jobsDir, ID, (j) => { setState(j, 'cancelled', '2026-11-16T18:30:00.000Z'); return j; });
      return { answer: 1, usd: 0.6 };
    });
    writeFile(`${ctx.stageDir}/stub.json`, '{}\n');
    return { outputs: [{ path: 'stages/skinning/stub.json' }] };
  } } }) });
  assert.equal(await runRunner(opts), 'cancelled');
  assert.deepEqual(readManifest(config.jobsDir, ID).rows.map((x) => x.stage), ['tracing', 'building', 'rendering', 'skinning'], 'the paid stage has its row');
  assert.deepEqual(readLedger(config.jobsDir, ID).rows.map((x) => x.status), ['settled']);
  const j = readJob(config.jobsDir, ID);
  assert.equal(j.state, 'cancelled');
  assert.equal(j.cost.spent_usd, 0.6);
});

import { Superseded as SupersededR2 } from '../../engine/runner.mjs';

test('round 2: a runner that was replaced writes nothing more (no row, no state change, no heartbeat)', async () => {
  const config = setup('queued');
  const pidFile = `${config.jobsDir}/${ID}/runner.pid`;
  const { opts, logs } = base(config, { registry: registry({ building: { run: async (ctx) => {
    fs.writeFileSync(pidFile, '9999');   // another runner took the job over while this stage ran
    writeFile(`${ctx.stageDir}/stub.json`, '{}\n');
    return { outputs: [{ path: 'stages/building/stub.json' }] };
  } } }) });
  assert.equal(await runRunner(opts), 'superseded');
  const j = readJob(config.jobsDir, ID);
  assert.equal(j.state, 'building', 'the job is left exactly where the new runner will find it');
  assert.deepEqual(readManifest(config.jobsDir, ID).rows.map((r) => r.stage), ['tracing'], 'no row from the replaced runner');
  assert.equal(fs.readFileSync(pidFile, 'utf8'), '9999', 'the new runner keeps its pid file');
  assert.match(logs.join('\n'), /another runner took this job over/);
  assert.equal(new SupersededR2().message, 'another runner took this job over');
});

test('round 2: replaced while it waits for an approval: it stops at the next step', async () => {
  const config = setup('awaiting_approval');
  const pidFile = `${config.jobsDir}/${ID}/runner.pid`;
  const before = readJob(config.jobsDir, ID);
  const { opts } = base(config, { sleep: async () => fs.writeFileSync(pidFile, '9999') });
  assert.equal(await runRunner(opts), 'superseded');
  assert.equal(readJob(config.jobsDir, ID).state, 'awaiting_approval');
  assert.equal(readJob(config.jobsDir, ID).approval, before.approval);
});

test('round 2: a replaced runner cannot reserve a paid call', async () => {
  const config = setup('queued', { approved: true });
  const pidFile = `${config.jobsDir}/${ID}/runner.pid`;
  let sent = 0;
  const { opts } = base(config, { registry: registry({ skinning: { run: async (ctx) => {
    fs.writeFileSync(pidFile, '9999');
    await ctx.paidCall({ key: 'k', provider: 'stub', what: 'w', estimate_usd: 0.6 }, async () => { sent += 1; return { answer: 1 }; });
    return { outputs: [] };
  } } }) });
  assert.equal(await runRunner(opts), 'superseded');
  assert.equal(sent, 0, 'the call was never sent');
  assert.equal(readLedger(config.jobsDir, ID).rows.length, 0, 'nothing was reserved');
  assert.equal(readJob(config.jobsDir, ID).state, 'skinning');
});

test('round 2: the freeze hook blocks at the named point, and only there', async () => {
  let config = setup('queued', { approved: true });
  const frozen = [];
  let { opts, logs } = base(config, { hooks: { freezeMs: 50, freezeAt: 'building' },
    freeze: (ms) => frozen.push([ms, readJob(config.jobsDir, ID).state]) });
  assert.equal(await runRunner(opts), 'done');
  assert.deepEqual(frozen, [[50, 'building']]);
  // once in the life of a runner: a stage that runs again in the same runner is not blocked again
  config = setup('queued', { approved: true });
  const again = [];
  ({ opts } = base(config, { hooks: { freezeMs: 3, freezeAt: 'tracing' }, freeze: () => again.push(readJob(config.jobsDir, ID).attempts.tracing),
    registry: registry({ tracing: { run: async (ctx) => {
      if (ctx.attempt === 1) throw Object.assign(new Error('EPERM: once'), { code: 'EPERM' });
      return { outputs: [] };
    } } }) }));
  assert.equal(await runRunner(opts), 'done');
  assert.deepEqual(again, [1], 'blocked at the first attempt only');
  assert.match(logs.join('\n'), /test hook: thread blocked for 50 ms at building/);
  // "<stage>:reserved" = after that stage's paid call is reserved, before it is sent
  config = setup('queued', { approved: true });
  const seen = [];
  ({ opts } = base(config, { hooks: { freezeMs: 7, freezeAt: 'gating:reserved' },
    freeze: (ms) => seen.push([ms, readLedger(config.jobsDir, ID).rows.map((r) => `${r.stage}:${r.status}`)]) }));
  assert.equal(await runRunner(opts), 'done');
  assert.deepEqual(seen, [[7, ['skinning:settled', 'gating:reserved']]]);
  // no milliseconds, or no such point: never
  config = setup('queued', { approved: true });
  ({ opts } = base(config, { hooks: { freezeMs: 0, freezeAt: 'building' }, freeze: () => assert.fail('no freeze') }));
  assert.equal(await runRunner(opts), 'done');
  config = setup('queued', { approved: true });
  ({ opts } = base(config, { hooks: { freezeMs: 9, freezeAt: 'nowhere' }, freeze: () => assert.fail('no freeze') }));
  assert.equal(await runRunner(opts), 'done');
});

test('round 2: replaced between the reserve and the send: the call is not sent, and its row says so', async () => {
  const config = setup('queued', { approved: true });
  const pidFile = `${config.jobsDir}/${ID}/runner.pid`;
  const { opts, logs } = base(config, { hooks: { freezeMs: 1, freezeAt: 'skinning:reserved' },
    freeze: () => fs.writeFileSync(pidFile, '9999') });
  assert.equal(await runRunner(opts), 'superseded');
  const l = readLedger(config.jobsDir, ID);
  assert.deepEqual(l.rows.map((r) => [r.stage, r.status, r.settled_usd, r.not_sent]), [['skinning', 'failed', 0, true]]);
  assert.equal(fs.existsSync(`${config.jobsDir}/${ID}/stages/skinning/sends.log`), false, 'the stub never sent the call');
  assert.equal(fs.existsSync(`${config.jobsDir}/${ID}/cache`), false, 'no answer was cached');
  assert.equal(readJob(config.jobsDir, ID).state, 'skinning');
  assert.equal(readJob(config.jobsDir, ID).cost.spent_usd, 0);
  assert.equal(readManifest(config.jobsDir, ID).rows.some((r) => r.stage === 'skinning'), false);
  assert.equal(fs.readFileSync(pidFile, 'utf8'), '9999', 'the new runner keeps its pid file');
  assert.match(logs.join('\n'), /seq 1 was reserved but never sent \(another runner took this job over\)/);
});

test('round 2: replaced while it waits for the heavy lock: it stops and never takes the lock', async () => {
  const config = setup('building');
  const pidFile = `${config.jobsDir}/${ID}/runner.pid`;
  writeFile(config.runner.heavyLock, JSON.stringify({ pid: 999, job_id: 'other', at: 't' }));
  let waits = 0;
  const { opts } = base(config, {
    alive: (p) => p === 4242 || p === 999,
    sleep: async () => {
      if (!readJob(config.jobsDir, ID).waiting_for) return;
      waits += 1;
      fs.writeFileSync(pidFile, '9999');
      fs.rmSync(config.runner.heavyLock);   // the lock is free now: a replaced runner must still not take it
    },
  });
  assert.equal(await runRunner(opts), 'superseded');
  assert.equal(waits, 1, 'one wait, then it saw it was replaced');
  assert.equal(fs.existsSync(config.runner.heavyLock), false, 'the free lock was not taken');
  assert.equal(readJob(config.jobsDir, ID).state, 'building');
  assert.equal(fs.readFileSync(pidFile, 'utf8'), '9999');
});

test('round 2: a stage that asks checkCancelled after it was replaced stops there', async () => {
  const config = setup('queued');
  const pidFile = `${config.jobsDir}/${ID}/runner.pid`;
  let after = 0;
  const { opts } = base(config, { registry: registry({ building: { run: async (ctx) => {
    ctx.checkCancelled();   // still the owner: nothing
    fs.writeFileSync(pidFile, '9999');
    ctx.checkCancelled();
    after += 1;
    return { outputs: [] };
  } } }) });
  assert.equal(await runRunner(opts), 'superseded');
  assert.equal(after, 0, 'the stage went no further');
});

test('round 2: the pid file is given back under the job lock; another runner\'s file is left alone', async () => {
  const config = setup();
  const dir = `${config.jobsDir}/${ID}`;
  const pidFile = `${dir}/runner.pid`;
  writeFile(pidFile, '9999');
  releasePid(config, ID, 4242);
  assert.equal(fs.readFileSync(pidFile, 'utf8'), '9999', 'not its own: left alone');
  // its own, but the job lock is busy (a fresh lock that is a folder): the file stays, nothing is thrown
  writeFile(pidFile, '4242');
  holdLock(`${dir}/job.lock`);
  releasePid(config, ID, 4242, { waitMs: 30 });
  assert.equal(fs.readFileSync(pidFile, 'utf8'), '4242');
  fs.rmSync(`${dir}/job.lock`, { recursive: true });
  releasePid(config, ID, 4242);
  assert.equal(fs.existsSync(pidFile), false, 'given back');
  assert.equal(fs.existsSync(`${dir}/job.lock`), false);
  // a job folder that is gone is not created again
  fs.rmSync(dir, { recursive: true });
  releasePid(config, ID, 4242);
  assert.equal(fs.existsSync(dir), false);
});

test('round 2: a pid file that cannot be read for a moment is not a lost job', async () => {
  const config = setup('queued', { callUsd: 0 });
  let fails = 30;
  const { opts, logs } = base(config, { readPidFile: (file) => {
    if (fails-- > 0) throw Object.assign(new Error('EBUSY: resource busy'), { code: 'EBUSY' });
    return fs.readFileSync(file, 'utf8');
  } });
  assert.equal(await runRunner(opts), 'approval-timeout');
  assert.equal(readJob(config.jobsDir, ID).state, 'awaiting_approval', 'it went on: the three stages ran');
  assert.deepEqual(readManifest(config.jobsDir, ID).rows.map((r) => r.stage), ['tracing', 'building', 'rendering']);
  assert.match(logs.join('\n'), /heartbeat skipped: EBUSY/);
  assert.doesNotMatch(logs.join('\n'), /names another runner/);
});

test('round 2: replaced during a paid call: what was paid is in the ledger, no output is written, no row', async () => {
  const config = setup('queued', { approved: true });
  const dir = `${config.jobsDir}/${ID}`;
  const pidFile = `${dir}/runner.pid`;
  // The pause after the settle stands for "time passed in the call": the runner is replaced during it.
  const { opts } = base(config, { hooks: { pauseAfterSettleMs: 7 },
    sleep: async (ms) => { if (ms === 7) fs.writeFileSync(pidFile, '9999'); } });
  assert.equal(await runRunner(opts), 'superseded');
  const l = readLedger(config.jobsDir, ID);
  assert.deepEqual(l.rows.map((r) => [r.stage, r.status, r.settled_usd]), [['skinning', 'settled', 0.6]], 'the call was made and is recorded');
  assert.equal(fs.readFileSync(`${dir}/stages/skinning/sends.log`, 'utf8').split('\n').filter(Boolean).length, 1);
  assert.equal(fs.existsSync(`${dir}/stages/skinning/stub.json`), false, 'the replaced runner wrote no output');
  assert.equal(readManifest(config.jobsDir, ID).rows.some((r) => r.stage === 'skinning'), false);
  assert.equal(readJob(config.jobsDir, ID).state, 'skinning');
  assert.equal(readJob(config.jobsDir, ID).cost.spent_usd, 0.6, 'spent_usd follows the ledger');
  // The runner that owns the job now gets the answer from the cache: nothing is sent or billed again.
  fs.rmSync(pidFile);
  const next = base(config, { pid: 4343, alive: (p) => p === 4343 });
  assert.equal(await runRunner(next.opts), 'done');
  assert.deepEqual(readLedger(config.jobsDir, ID).rows.filter((r) => r.stage === 'skinning').map((r) => r.status), ['settled']);
  assert.equal(fs.readFileSync(`${dir}/stages/skinning/sends.log`, 'utf8').split('\n').filter(Boolean).length, 1);
  assert.ok(fs.existsSync(`${dir}/stages/skinning/stub.json`), 'the output is written by the runner that owns the job');
  assert.deepEqual(readManifest(config.jobsDir, ID).rows.filter((r) => r.stage === 'skinning').map((r) => [r.attempt, r.runner_pid]), [[2, 4343]]);
  assert.equal(readJob(config.jobsDir, ID).cost.spent_usd, 1.8);
});

import { HeavyLockLost } from '../../engine/runner.mjs';

// The heavy lock of this runner (pid 4242) is taken over by another job (pid 999), as happens when the
// runner gave no sign of life for runner.staleMs; later that job gives the lock back.
const takenOver = (config) => writeFile(config.runner.heavyLock, JSON.stringify({ pid: 999, job_id: 'other', at: 't', refreshed_at: 't' }));

test('round 2: a runner that lost the heavy lock stops its heavy stage, writes no row, waits, and runs it again', async () => {
  const config = setup('queued');
  const attempts = [];
  let waits = 0;
  const { opts, logs } = base(config, {
    alive: (p) => p === 4242 || p === 999,
    registry: registry({ rendering: { run: async (ctx) => {
      attempts.push(ctx.attempt);
      if (ctx.attempt === 1) {
        ctx.checkCancelled();   // the holder: nothing
        takenOver(config);
        ctx.checkCancelled();   // throws: the lock is another job's now
        assert.fail('the stage went on without the heavy lock');
      }
      assert.equal(readHeavy(config.runner.heavyLock).pid, 4242, 'the second attempt runs with the lock');
      writeFile(`${ctx.stageDir}/stub.json`, '{}\n');
      return { outputs: [{ path: 'stages/rendering/stub.json' }] };
    } } }),
    sleep: async () => {
      const j = readJob(config.jobsDir, ID);
      if (j.state !== 'rendering' || j.waiting_for !== 'heavy-lock') return;
      waits += 1;
      assert.equal(readHeavy(config.runner.heavyLock).pid, 999, 'it did not remove the other job\'s lock');
      fs.rmSync(config.runner.heavyLock);   // the other job is done
    },
  });
  assert.equal(await runRunner(opts), 'approval-timeout');
  assert.deepEqual(attempts, [1, 2]);
  assert.equal(waits, 1, 'it waited in rendering for the lock');
  assert.deepEqual(readManifest(config.jobsDir, ID).rows.filter((r) => r.stage === 'rendering').map((r) => r.attempt), [2], 'no row for the attempt that lost the lock');
  assert.equal(readJob(config.jobsDir, ID).state, 'awaiting_approval');
  assert.equal(fs.existsSync(config.runner.heavyLock), false);
  assert.match(logs.join('\n'), /rendering: the heavy lock was taken over while this runner was silent; no manifest row/);
  assert.equal(new HeavyLockLost().message, 'the heavy lock was taken over while this runner was silent');
});

test('round 2: the loss is seen by the heartbeat and stays seen; a stage that never asks is stopped before its row', async () => {
  // (a) the heartbeat sees it; the lock is ours again afterwards (the other job was quick): still stopped,
  // because another job may have rendered in between
  let config = setup('queued');
  let beatFn = null;
  let attempts = [];
  let { opts, logs } = base(config, {
    alive: (p) => p === 4242 || p === 999, timer: (fn) => { beatFn = fn; return () => {}; },
    registry: registry({ rendering: { run: async (ctx) => {
      attempts.push(ctx.attempt);
      if (ctx.attempt === 1) {
        const mine = fs.readFileSync(config.runner.heavyLock, 'utf8');
        takenOver(config);
        beatFn();
        beatFn();   // logged once
        writeFile(config.runner.heavyLock, mine);
        ctx.checkCancelled();
        assert.fail('the stage went on');
      }
      return { outputs: [] };
    } } }),
  });
  assert.equal(await runRunner(opts), 'approval-timeout');
  assert.deepEqual(attempts, [1, 2]);
  assert.equal(logs.filter((l) => /the heavy lock is no longer ours/.test(l)).length, 1);
  // (b) the stage finishes without asking: the row is not written, the stage runs again with the lock
  config = setup('queued');
  attempts = [];
  ({ opts, logs } = base(config, {
    alive: (p) => p === 4242 || p === 999,
    registry: registry({ rendering: { run: async (ctx) => {
      attempts.push(ctx.attempt);
      if (ctx.attempt === 1) takenOver(config);
      writeFile(`${ctx.stageDir}/stub.json`, `${ctx.attempt}\n`);
      return { outputs: [{ path: 'stages/rendering/stub.json' }] };
    } } }),
    sleep: async () => {
      if (readJob(config.jobsDir, ID).waiting_for === 'heavy-lock') fs.rmSync(config.runner.heavyLock, { force: true });
    },
  }));
  assert.equal(await runRunner(opts), 'approval-timeout');
  assert.deepEqual(attempts, [1, 2]);
  assert.deepEqual(readManifest(config.jobsDir, ID).rows.filter((r) => r.stage === 'rendering').map((r) => r.attempt), [2]);
  assert.equal(fs.readFileSync(`${config.jobsDir}/${ID}/stages/rendering/stub.json`, 'utf8'), '2\n');
  // (c) a stage that is not heavy never asks about the heavy lock
  config = setup('queued');
  ({ opts } = base(config, { registry: registry({ building: { run: async (ctx) => {
    takenOver(config);
    ctx.checkCancelled();
    fs.rmSync(config.runner.heavyLock);
    return { outputs: [] };
  } } }) }));
  assert.equal(await runRunner(opts), 'approval-timeout');
  assert.equal(readJob(config.jobsDir, ID).attempts.building, 1);
});

// ---- after the second QA round ----
import { cacheFile as cacheFileR3 } from '../../engine/ledger.mjs';
import { sha256Text as sha256TextR3 } from '../../engine/lib/hash.mjs';

test('round 3: the freeze point "<stage>:sent" is after the call was sent and before anything is recorded', async () => {
  const config = setup('queued', { approved: true });
  const dir = `${config.jobsDir}/${ID}`;
  const seen = [];
  const { opts } = base(config, { hooks: { freezeMs: 5, freezeAt: 'skinning:sent' },
    freeze: () => seen.push([readLedger(config.jobsDir, ID).rows.map((r) => r.status), fs.existsSync(`${dir}/cache`),
      fs.readFileSync(`${dir}/stages/skinning/sends.log`, 'utf8').split('\n').filter(Boolean).length]) });
  assert.equal(await runRunner(opts), 'done');
  assert.deepEqual(seen, [[['reserved'], false, 1]], 'sent once, the row still reserved, no answer cached yet');
});

test('round 3: the answer of a replaced runner comes back late: billed and recorded, the cached answer of the owner kept, no output', async () => {
  const config = setup('queued', { approved: true });
  const dir = `${config.jobsDir}/${ID}`;
  const pidFile = `${dir}/runner.pid`;
  let key = null;
  const ownerText = JSON.stringify({ answer: { stage: 'skinning', stub: true, by: 'the runner that owns the job' }, settled_usd: 0.6 });
  // While the first runner is blocked with its answer in hand, a second runner takes the job over, presumes
  // the reservation lost, makes the same call, caches ITS answer and settles.
  const takeover = () => {
    const l = readLedger(config.jobsDir, ID);
    key = l.rows[0].call_key;
    l.rows[0].status = 'orphaned';
    l.rows.push({ ...l.rows[0], seq: 2, attempt: 2, status: 'settled', settled_usd: 0.6, settled_at: 't', answer_sha256: sha256TextR3(ownerText) });
    writeLedgerR2(config.jobsDir, l);
    writeFile(cacheFileR3(config.jobsDir, ID, key), ownerText);
    fs.writeFileSync(pidFile, '9999');
  };
  const { opts, logs } = base(config, { hooks: { freezeMs: 1, freezeAt: 'skinning:sent' }, freeze: takeover });
  assert.equal(await runRunner(opts), 'superseded');
  const l = readLedger(config.jobsDir, ID);
  assert.deepEqual(l.rows.map((r) => [r.seq, r.status, r.late === true, r.settled_usd]), [[1, 'settled', true, 0.6], [2, 'settled', false, 0.6]]);
  assert.equal(l.rows[0].call_key, l.rows[1].call_key);
  assert.equal(fs.readFileSync(cacheFileR3(config.jobsDir, ID, key), 'utf8'), ownerText, 'the cached answer is the owner\'s');
  assert.equal(fs.existsSync(`${dir}/stages/skinning/stub.json`), false, 'the replaced runner wrote no output');
  assert.equal(readManifest(config.jobsDir, ID).rows.some((r) => r.stage === 'skinning'), false);
  assert.equal(readJob(config.jobsDir, ID).cost.spent_usd, 1.2, 'both calls were billed, and spent_usd says so');
  assert.equal(fs.readFileSync(pidFile, 'utf8'), '9999');
  assert.match(logs.join('\n'), /the late answer of seq 1 is recorded in the ledger only/);
});

import { blockThread } from '../../engine/runner.mjs';

test('round 3: the block of the freeze hook ends at its time, or as soon as the wake file is there', () => {
  // no wake file: one sleep of the whole time
  const naps = [];
  blockThread(70, '', { nap: (ms) => naps.push(ms) });
  assert.deepEqual(naps, [70]);
  // a wake file that never comes: short naps until the time is over
  let t = 1000;
  let n = 0;
  blockThread(100, 'never', { clock: () => t, exists: () => false, nap: (ms) => { n += 1; t += ms; } });
  assert.equal(t, 1100, 'it stopped at its upper bound');
  assert.equal(n, 5, 'five naps of 20 ms');
  // the wake file appears: the block ends at once
  t = 0;
  n = 0;
  let looks = 0;
  blockThread(60000, 'wake', { clock: () => t, exists: () => ++looks > 3, nap: (ms) => { n += 1; t += ms; } });
  assert.equal(n, 3);
  assert.ok(t < 100, 'far from the upper bound');
  // the real thing, with a real file
  const dir = `${stubConfig().jobsDir}`;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(`${dir}/wake`, '');
  const t0 = Date.now();
  blockThread(5000, `${dir}/wake`);
  assert.ok(Date.now() - t0 < 1000);
  // the runner hands the hook's wake file to the block
  const got = [];
  const config = setup('queued', { approved: true });
  return runRunner(base(config, { hooks: { freezeMs: 9, freezeAt: 'tracing', freezeWake: 'C:/t/w' }, freeze: (ms, wake) => got.push([ms, wake]) }).opts)
    .then((why) => {
      assert.equal(why, 'done');
      assert.deepEqual(got, [[9, 'C:/t/w']]);
    });
});

test('round 4: a runner started for a job that has ended leaves at once and never takes runner.pid', async () => {
  for (const state of ['done', 'cancelled', 'failed']) {
    const config = setup(state);
    const pidFile = `${config.jobsDir}/${ID}/runner.pid`;
    // another runner's pid file (it is finishing): left alone, and no 3 s wait for it
    writeFile(pidFile, '555');
    let slept = 0;
    const { opts } = base(config, { alive: () => true, claimWaitMs: 3000, sleep: async () => { slept += 1; } });
    assert.equal(await runRunner(opts), state);
    assert.equal(slept, 0, 'no wait');
    assert.equal(fs.readFileSync(pidFile, 'utf8'), '555');
    // no pid file: none is created
    fs.rmSync(pidFile);
    assert.equal(await runRunner(base(config).opts), state);
    assert.equal(fs.existsSync(pidFile), false);
  }
  // the job ends WHILE this runner waits for the other runner's pid file: it leaves, without the file
  const config = setup('qa');
  const pidFile = `${config.jobsDir}/${ID}/runner.pid`;
  writeFile(pidFile, '555');
  let waits = 0;
  const { opts } = base(config, { alive: () => true, claimWaitMs: 60000, clock: () => Date.now(),
    sleep: async () => {
      waits += 1;
      if (waits === 2) updateJob(config.jobsDir, ID, (j) => setState(j, 'done', j.updated_at));
    } });
  assert.equal(await runRunner(opts), 'done');
  assert.equal(waits, 2);
  assert.equal(fs.readFileSync(pidFile, 'utf8'), '555');
});

test('round 7: a ledger that cannot be read ends the runner at once: no stage runs, nothing is paid, the pid file is given back', async () => {
  const config = setup('skinning', { approved: true });
  const dir = `${config.jobsDir}/${ID}`;
  writeFile(`${dir}/ledger.json`, '{ "rows": [ { "seq": 1, "sta');   // cut short
  let ran = 0;
  const reg = Object.fromEntries(STAGES.map((s) => [s, { stub: { run: async () => { ran += 1; return { outputs: [] }; } } }]));
  await assert.rejects(runRunner(base(config, { registry: reg }).opts), (e) => e.code === 'LEDGER_UNREADABLE' && /ledger\.json of job abcdef0123456789 cannot be read: it is not JSON/.test(e.message));
  assert.equal(ran, 0, 'no stage ran');
  assert.equal(readJob(config.jobsDir, ID).state, 'skinning', 'the job stays where it is');
  assert.equal(fs.existsSync(`${dir}/runner.pid`), false, 'runner.pid was given back');
  assert.equal(fs.readFileSync(`${dir}/ledger.json`, 'utf8'), '{ "rows": [ { "seq": 1, "sta', 'the damaged file was not written over');
});

// ---- round 8 (QA round 7, D5): a job that has ended is never taken, however close two runners are ----
test('D5: the state of the job is looked at again inside the locked claim: a job that ended in between is not taken', async () => {
  // claimPid itself
  for (const state of ['done', 'cancelled', 'failed']) {
    const config = setup(state);
    const pidFile = `${config.jobsDir}/${ID}/runner.pid`;
    assert.equal(claimPid(config, ID, 4242), 'ended', state);
    assert.equal(fs.existsSync(pidFile), false, 'no pid file is written for a job that has ended');
    assert.equal(fs.existsSync(`${config.jobsDir}/${ID}/job.lock`), false);
  }
  const none = setup();
  fs.rmSync(`${none.jobsDir}/${ID}/job.json`);
  assert.equal(claimPid(none, ID, 4242), 'ended', 'the job file is gone');
  // The race of QA round 7: this runner sees the job in `qa`; before it reaches the lock, the other runner
  // finishes the job and gives its pid file back.
  const config = setup('qa');
  const pidFile = `${config.jobsDir}/${ID}/runner.pid`;
  writeFile(pidFile, '555');
  let between = 0;
  const { opts } = base(config, { alive: () => true, sleep: async () => assert.fail('no wait'),
    beforeClaim: () => {
      between += 1;
      updateJob(config.jobsDir, ID, (j) => setState(j, 'done', j.updated_at));
      fs.rmSync(pidFile);
    } });
  assert.equal(await runRunner(opts), 'done');
  assert.equal(between, 1);
  assert.equal(fs.existsSync(pidFile), false, 'it did not take the pid file of the job that had just ended');
  // the job file vanishes in between: no-job
  const gone = setup('qa');
  assert.equal(await runRunner(base(gone, { beforeClaim: () => fs.rmSync(`${gone.jobsDir}/${ID}/job.json`) }).opts), 'no-job');
  assert.equal(fs.existsSync(`${gone.jobsDir}/${ID}/runner.pid`), false);
});

test('D6: a runner started on a job whose ledger names ANOTHER job stops at once and writes into no ledger', async () => {
  const config = setup('skinning', { approved: true });
  const other = '0123456789abcdef';
  const mine = `${config.jobsDir}/${ID}/ledger.json`;
  const theirs = `${config.jobsDir}/${other}/ledger.json`;
  const theirText = JSON.stringify({ schema: 'habait/ledger.v1', job_id: other, cap_usd: 60, rows: [] });
  writeFile(theirs, theirText);
  for (const text of [JSON.stringify({ schema: 'habait/ledger.v1', job_id: other, cap_usd: 60, rows: [] }), '{"rows":[]}', '{"rows":[{}]}', '{"rows":[1,2]}',
    JSON.stringify({ schema: 'habait/ledger.v9', job_id: ID, cap_usd: 60, rows: [] })]) {
    writeFile(mine, text);
    let ran = 0;
    const reg = Object.fromEntries(STAGES.map((s) => [s, { stub: { run: async () => { ran += 1; return { outputs: [] }; } } }]));
    await assert.rejects(runRunner(base(config, { registry: reg }).opts), (e) => e.code === 'LEDGER_UNREADABLE', text);
    assert.equal(ran, 0, 'no stage ran');
    assert.equal(fs.readFileSync(mine, 'utf8'), text, 'its own file was not written over');
    assert.equal(fs.readFileSync(theirs, 'utf8'), theirText, 'the other job\'s ledger was not touched');
    assert.equal(fs.existsSync(`${config.jobsDir}/undefined`), false, 'no folder named after a missing id');
    assert.equal(fs.existsSync(`${config.jobsDir}/${ID}/runner.pid`), false);
    assert.equal(readJob(config.jobsDir, ID).state, 'skinning');
  }
});
