import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  RUNNER, configEnv, tourDir, runnerPidFile, readRunnerPid, runnerAlive, runnerInfo, withRunner, isStalled,
  restartState, restartJob, startOrResume, RESTARTABLE,
} from '../../engine/control.mjs';
import { newJob, writeJob, readJob, updateJob, setState, STAGES } from '../../engine/jobs.mjs';
import { emptyManifest, writeManifest, inputsSha256 } from '../../engine/manifest.mjs';
import { createHash } from 'node:crypto';
import { stubConfig, writeFile } from '../helpers/fakes.mjs';

const ID = 'abcdef0123456789';
const V = '0.2.0';
const input = { pdf_path: 'C:/x/source.pdf', pdf_name: 'plan.pdf', pdf_sha256: 'b'.repeat(64), apartment: 'apt846' };
const T = '2026-11-16T18:00:00.000Z';
const sha = (t) => createHash('sha256').update(t).digest('hex');

function setup(state, { approved = false, done = 0, reason = null } = {}) {
  const config = stubConfig();
  const job = newJob({ id: ID, mode: 'stub', now: T, input });
  setState(job, state, T);
  job.reason = reason;
  if (approved) job.approval = { cap_usd: 60, at: T };
  writeJob(config.jobsDir, job);
  // the first `done` stages get valid rows
  const doc = emptyManifest(ID);
  let prev = [];
  for (const stage of STAGES.slice(0, done)) {
    const text = `${stage}\n`;
    writeFile(`${config.jobsDir}/${ID}/stages/${stage}/stub.json`, text);
    const outputs = [{ path: `stages/${stage}/stub.json`, sha256: sha(text), bytes: text.length }];
    doc.rows.push({ stage, attempt: 1, status: 'done', started_at: T, finished_at: T, seconds: 0, cost_usd: 0, runner_pid: 1, outputs,
      inputs_sha256: inputsSha256({ pdfSha256: input.pdf_sha256, apartment: 'apt846', mode: 'stub', version: V, stage, prevOutputs: prev }) });
    prev = outputs;
  }
  writeManifest(config.jobsDir, doc);
  return config;
}

test('RUNNER is engine/runner.mjs; configEnv; tourDir; the pid file and runnerAlive', () => {
  assert.match(RUNNER.replace(/\\/g, '/'), /engine\/runner\.mjs$/);
  const config = stubConfig({ serve: { host: '127.0.0.1', port: 9999 } });
  assert.deepEqual(configEnv(config, { PATH: 'p' }), { PATH: 'p', ENGINE_HOME: config.home, ENGINE_JOBS_DIR: config.jobsDir,
    ENGINE_SERVE_PORT: '9999', ENGINE_STUB_STEP_MS: '5' });
  assert.equal(tourDir(config), `${config.stub.siteRoot}/tour`);
  assert.equal(readRunnerPid(config, ID), null);
  assert.equal(runnerAlive(config, ID), false);
  writeFile(runnerPidFile(config, ID), String(process.pid));
  assert.equal(readRunnerPid(config, ID), process.pid);
  assert.equal(runnerAlive(config, ID), true);
  assert.equal(runnerAlive(config, ID, () => false), false);
  writeFile(runnerPidFile(config, ID), 'junk');
  assert.equal(readRunnerPid(config, ID), null);
});

test('runnerInfo / withRunner / isStalled: computed, never in the file', () => {
  const config = setup('rendering');
  writeFile(runnerPidFile(config, ID), '4321');
  const job = readJob(config.jobsDir, ID);
  const info = runnerInfo(config, job, { isAlive: () => false, clock: () => Date.parse(T) + 1234 });
  assert.deepEqual(info, { alive: false, pid: 4321, heartbeat_age_s: 1.2 });
  const shown = withRunner(config, job, { isAlive: () => true, clock: () => Date.parse(T) - 5000 });
  assert.deepEqual(shown.runner, { alive: true, pid: 4321, heartbeat_age_s: 0 });
  assert.equal(readJob(config.jobsDir, ID).runner, undefined);
  assert.equal(isStalled({ state: 'rendering', runner: { alive: false } }), true);
  assert.equal(isStalled({ state: 'queued', runner: { alive: false } }), true);
  assert.equal(isStalled({ state: 'rendering', runner: { alive: true } }), false);
  assert.equal(isStalled({ state: 'awaiting_approval', runner: { alive: false } }), false, 'a wait with no runner is normal');
  assert.equal(isStalled({ state: 'done', runner: { alive: false } }), false);
  assert.equal(runnerInfo(config, { ...job, heartbeat_at: 'bad' }).heartbeat_age_s, null);
});

test('restartState: the first stage with no valid row; awaiting_approval for a paid stage with no approval; qa when all are valid', () => {
  assert.deepEqual(RESTARTABLE, ['cancelled', 'failed', 'review']);
  for (const [done, approved, want] of [[0, true, 'tracing'], [1, false, 'building'], [3, false, 'awaiting_approval'], [3, true, 'skinning'],
    [5, true, 'finishing'], [8, true, 'qa']]) {
    const config = setup('cancelled', { done, approved });
    assert.equal(restartState(config, readJob(config.jobsDir, ID), { version: V }), want, `${done} done, approved ${approved}`);
  }
  const config = setup('failed', { done: 3 });
  assert.equal(restartState(config, readJob(config.jobsDir, ID), { version: '9.9.9' }), 'tracing', 'another engine version');
});

test('restartJob: state set back, reason cleared, waiting_for removed; not restartable → null', () => {
  const config = setup('failed', { done: 2, reason: { code: 'STAGE_FAILED', message: 'x' } });
  updateJob(config.jobsDir, ID, (j) => { j.waiting_for = 'heavy-lock'; return j; });
  const j = restartJob(config, ID, { now: () => T, version: V });
  assert.equal(j.state, 'rendering');
  assert.equal(j.percent, 45);
  assert.equal(j.reason, null);
  assert.equal('waiting_for' in j, false);
  assert.equal(restartJob(config, ID, { version: V }), null, 'rendering is not restartable');
  assert.equal(restartJob(config, '0000000000000000'), null);
});

test('startOrResume: the four rules of contract 0.3 §6', () => {
  const run = (state, alive, opts = {}) => {
    const config = setup(state, opts);
    const spawned = [];
    const r = startOrResume(config, readJob(config.jobsDir, ID), { spawnRunner: (c, id) => spawned.push(id), isRunnerAlive: () => alive,
      now: () => T, version: V });
    return { r, spawned, config };
  };
  let x = run('done', false);
  assert.deepEqual([x.r.resumed, x.spawned.length], [false, 0]);
  for (const s of ['queued', 'rendering', 'awaiting_approval', 'qa']) {
    x = run(s, true);
    assert.deepEqual([x.r.resumed, x.spawned.length], [false, 0], `${s} alive`);
    x = run(s, false);
    assert.deepEqual([x.r.resumed, x.spawned.length, x.r.job.state], [true, 1, s], `${s} not alive`);
  }
  for (const s of ['cancelled', 'failed', 'review']) {
    x = run(s, true, { done: 1, reason: { code: 'NOT_DONE', message: 'm' } });
    assert.deepEqual([x.r.resumed, x.spawned.length, x.r.job.state, x.r.job.reason], [true, 1, 'building', null], s);
    assert.equal(readJob(x.config.jobsDir, ID).state, 'building');
  }
  // a job that stopped being restartable between the read and the update
  const config = setup('cancelled');
  const stale = readJob(config.jobsDir, ID);
  updateJob(config.jobsDir, ID, (j) => setState(j, 'done', T));
  const spawned = [];
  const r = startOrResume(config, stale, { spawnRunner: () => spawned.push(1), isRunnerAlive: () => false });
  assert.deepEqual([r.resumed, r.job.state, spawned.length], [false, 'done', 0]);
  fs.rmSync(`${config.jobsDir}/${ID}/job.json`);
  assert.equal(startOrResume(config, stale, { spawnRunner: () => {} }).job, stale);
});
