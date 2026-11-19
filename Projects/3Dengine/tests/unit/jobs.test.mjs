import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  jobId, newJob, readJob, writeJob, withJobLock, updateJob, setState, listJobs, formatJob, isTerminal,
  PERCENT, STATES, TERMINAL, BEFORE_APPROVAL, AFTER_APPROVAL, jobFile,
} from '../../engine/jobs.mjs';
import { tempDir, writeFile } from '../helpers/fakes.mjs';
import { validate } from '../../mcp/schema-check.mjs';
import { loadJobSchema } from '../../mcp/tools.mjs';

const T = '2026-11-16T18:00:00.000Z';
const input = { pdf_path: 'C:/j/source.pdf', pdf_name: 'plan.pdf', pdf_sha256: 'a'.repeat(64), apartment: 'apt846' };

test('jobId: 16 hex, deterministic, sensitive to every part', () => {
  const base = { pdfSha256: 'a'.repeat(64), apartment: 'apt846', mode: 'stub', version: '0.2.0' };
  const id = jobId(base);
  assert.match(id, /^[0-9a-f]{16}$/);
  assert.equal(jobId(base), id);
  for (const k of Object.keys(base)) assert.notEqual(jobId({ ...base, [k]: 'x' }), id, k);
});

test('states, percents, terminal set match the contract', () => {
  assert.deepEqual([...BEFORE_APPROVAL, ...AFTER_APPROVAL].map((s) => PERCENT[s]), [0, 10, 25, 45, 55, 70, 82, 88, 93, 97, 100]);
  assert.equal(STATES.length, 14);
  assert.deepEqual([...TERMINAL], ['done', 'review', 'failed', 'cancelled']);
  assert.equal(isTerminal('done'), true);
  assert.equal(isTerminal('qa'), false);
});

test('newJob validates against contracts/job.schema.json; write/read round trip; no temp file left', () => {
  const dir = tempDir('jobs-');
  const job = newJob({ id: 'abcdef0123456789', mode: 'stub', now: T, input, capUsd: 50 });
  assert.deepEqual(validate(loadJobSchema(), job), []);
  assert.equal(job.cost.cap_usd, 50);
  writeJob(dir, job);
  assert.deepEqual(readJob(dir, job.job_id), job);
  assert.deepEqual(fs.readdirSync(`${dir}/${job.job_id}`), ['job.json']);
  assert.equal(newJob({ id: 'abcdef0123456789', mode: 'stub', now: T, input }).cost.cap_usd, null);
});

test('readJob: malformed id or missing job → null; a broken file throws', () => {
  const dir = tempDir('jobs-');
  assert.equal(readJob(dir, '../x'), null);
  assert.equal(readJob(dir, '0123456789abcdef'), null);
  writeFile(jobFile(dir, '0123456789abcdef'), '{broken');
  assert.throws(() => readJob(dir, '0123456789abcdef'));
  // A folder where job.json belongs is not this job's file (contract 1.1 section 5) ...
  writeFile(`${dir}/fedcba9876543210/job.json/x`, 'dir in the way');
  assert.throws(() => readJob(dir, 'fedcba9876543210'), /job fedcba9876543210: job\.json is not this job's file \(it is not a file\)/);
  // ... and any other read error leaves as it is.
  const realRead = fs.readFileSync;
  fs.readFileSync = () => { throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' }); };
  try {
    assert.throws(() => readJob(dir, '0123456789abcdef'), /EACCES/);
  } finally {
    fs.readFileSync = realRead;
  }
});

test('writeJob gives up on a non-retryable rename error and removes its temp file', () => {
  const dir = tempDir('jobs-');
  const job = newJob({ id: 'abcdef0123456789', mode: 'stub', now: T, input });
  fs.mkdirSync(`${dir}/${job.job_id}/job.json/blocker`, { recursive: true });
  assert.throws(() => writeJob(dir, job));
  assert.deepEqual(fs.readdirSync(`${dir}/${job.job_id}`), ['job.json']);
});

test('updateJob: mutate writes, null writes nothing, missing job → job null; lock released', () => {
  const dir = tempDir('jobs-');
  const job = writeJob(dir, newJob({ id: 'abcdef0123456789', mode: 'stub', now: T, input }));
  let r = updateJob(dir, job.job_id, (j) => setState(j, 'tracing', '2026-11-16T18:00:06.000Z'));
  assert.equal(r.written, true);
  assert.equal(readJob(dir, job.job_id).percent, 10);
  r = updateJob(dir, job.job_id, () => null);
  assert.equal(r.written, false);
  assert.equal(r.job.state, 'tracing');
  r = updateJob(dir, '0000000000000000', () => assert.fail('not called'));
  assert.deepEqual(r, { job: null, written: false });
  assert.equal(fs.existsSync(`${dir}/${job.job_id}/job.lock`), false);
  assert.throws(() => updateJob(dir, job.job_id, () => { throw new Error('boom'); }), /boom/);
  assert.equal(fs.existsSync(`${dir}/${job.job_id}/job.lock`), false);
});

test('setState keeps percent for review/failed/cancelled', () => {
  const j = setState(newJob({ id: 'abcdef0123456789', mode: 'stub', now: T, input }), 'rendering', T);
  setState(j, 'cancelled', T);
  assert.equal(j.percent, 45);
});

test('withJobLock: a busy lock times out; a stale one is taken over', () => {
  const dir = tempDir('jobs-');
  const id = 'abcdef0123456789';
  withJobLock(dir, id, () => {
    assert.throws(() => withJobLock(dir, id, () => 1, { waitMs: 30 }), /lock busy/);
  });
  writeFile(`${dir}/${id}/job.lock`, '1');
  const old = new Date(Date.now() - 60000);
  fs.utimesSync(`${dir}/${id}/job.lock`, old, old);
  assert.equal(withJobLock(dir, id, () => 7), 7);
});

test('listJobs: newest first, limit, skips foreign and broken folders; missing dir is empty', () => {
  const dir = tempDir('jobs-');
  assert.deepEqual(listJobs(`${dir}/none`), []);
  writeJob(dir, newJob({ id: '1111111111111111', mode: 'stub', now: '2026-11-16T10:00:00.000Z', input }));
  writeJob(dir, newJob({ id: '2222222222222222', mode: 'stub', now: '2026-11-16T12:00:00.000Z', input }));
  writeJob(dir, newJob({ id: '3333333333333333', mode: 'stub', now: '2026-11-16T12:00:00.000Z', input }));
  writeFile(`${dir}/4444444444444444/job.json`, 'nope');
  fs.mkdirSync(`${dir}/not-a-job`);
  fs.mkdirSync(`${dir}/5555555555555555`);
  assert.deepEqual(listJobs(dir).map((j) => j.job_id), ['3333333333333333', '2222222222222222', '1111111111111111']);
  assert.equal(listJobs(dir, 1).length, 1);
  writeFile(`${dir}/file-not-dir`, 'x');
  assert.throws(() => listJobs(`${dir}/file-not-dir`), /ENOTDIR/);
});

test('formatJob: one line with state, percent, name, and link or reason', () => {
  const j = newJob({ id: 'abcdef0123456789', mode: 'stub', now: T, input });
  assert.match(formatJob(j), /^abcdef0123456789  queued\s+0%  stub  plan\.pdf$/);
  j.result = { local_url: 'http://127.0.0.1:1/tour/', tour_dir: 'x' };
  assert.match(formatJob(j), /· http:\/\/127\.0\.0\.1:1\/tour\/$/);
  j.reason = { code: 'NOT_DONE', message: 'm' };
  assert.match(formatJob(j), /· NOT_DONE$/);
  assert.match(formatJob({ ...j, input: undefined, reason: null, result: null }), / {2}stub {2}$/);
});
