import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import {
  MANIFEST_SCHEMA_ID, manifestFile, emptyManifest, readManifest, writeManifest, inputsSha256, outputsIntact,
  validRow, walkManifest, firstInvalidStage, supersede, appendRow,
} from '../../engine/manifest.mjs';
import { STAGES } from '../../engine/jobs.mjs';
import { validate } from '../../mcp/schema-check.mjs';
import { tempDir, writeFile } from '../helpers/fakes.mjs';

const ID = 'abcdef0123456789';
const SCHEMA = JSON.parse(fs.readFileSync(new URL('../../contracts/manifest.schema.json', import.meta.url), 'utf8'));
const sha = (t) => createHash('sha256').update(t).digest('hex');
const job = { job_id: ID, mode: 'stub', input: { pdf_sha256: 'a'.repeat(64), apartment: 'apt846' } };
const T = '2026-11-16T18:00:00.000Z';

// Write one stage's output and return its done row.
function done(dir, stage, inputs, { attempt = 1, text = `${stage}\n` } = {}) {
  writeFile(`${dir}/stages/${stage}/stub.json`, text);
  return { stage, attempt, status: 'done', started_at: T, finished_at: T, seconds: 0.1, inputs_sha256: inputs,
    outputs: [{ path: `stages/${stage}/stub.json`, sha256: sha(text), bytes: Buffer.byteLength(text) }], cost_usd: 0, runner_pid: 7 };
}

// A manifest where the first n stages are done with chained inputs.
function chain(jobsDir, n, version = '0.2.0') {
  const dir = `${jobsDir}/${ID}`;
  const doc = emptyManifest(ID);
  let prev = [];
  for (const stage of STAGES.slice(0, n)) {
    const inputs = inputsSha256({ pdfSha256: job.input.pdf_sha256, apartment: 'apt846', mode: 'stub', version, stage, prevOutputs: prev });
    const row = done(dir, stage, inputs);
    doc.rows.push(row);
    prev = row.outputs;
  }
  writeManifest(jobsDir, doc);
  return { dir, doc };
}

test('read: a missing file is an empty manifest; write is atomic and round-trips; schema holds', () => {
  const jobsDir = tempDir('man-');
  assert.deepEqual(readManifest(jobsDir, ID), { schema: MANIFEST_SCHEMA_ID, job_id: ID, rows: [] });
  const { doc } = chain(jobsDir, 3);
  assert.deepEqual(readManifest(jobsDir, ID), doc);
  assert.deepEqual(validate(SCHEMA, doc), []);
  assert.deepEqual(fs.readdirSync(`${jobsDir}/${ID}`).filter((f) => f.endsWith('.tmp')), []);
  assert.match(manifestFile(jobsDir, ID), /\/manifest\.json$/);
  writeFile(manifestFile(jobsDir, ID), '{broken');
  assert.throws(() => readManifest(jobsDir, ID));
  // A read error that is not "no such file" leaves as it is ...
  const realRead = fs.readFileSync;
  fs.readFileSync = () => { throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' }); };
  try {
    assert.throws(() => readManifest(jobsDir, ID), /EACCES/);
  } finally {
    fs.readFileSync = realRead;
  }
  // ... but a folder where manifest.json belongs is not this job's manifest (contract 1.1 section 5).
  fs.rmSync(manifestFile(jobsDir, ID));
  fs.mkdirSync(manifestFile(jobsDir, ID));
  assert.throws(() => readManifest(jobsDir, ID), /manifest\.json is not this job's file \(it is not a file\)/);
});

test('inputsSha256 changes with every part, and with the previous outputs', () => {
  const base = { pdfSha256: 'a', apartment: 'x', mode: 'stub', version: '1', stage: 'tracing', prevOutputs: [] };
  const h = inputsSha256(base);
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(inputsSha256({ ...base }), h);
  for (const k of ['pdfSha256', 'apartment', 'mode', 'version', 'stage']) assert.notEqual(inputsSha256({ ...base, [k]: 'z' }), h, k);
  assert.notEqual(inputsSha256({ ...base, prevOutputs: [{ sha256: 'f' }] }), h);
  assert.equal(inputsSha256({ pdfSha256: 'a', apartment: 'x', mode: 'stub', version: '1', stage: 'tracing' }), h);
});

test('the resume rule: valid only when done, not superseded, same inputs, outputs intact', () => {
  const jobsDir = tempDir('man-');
  const { dir, doc } = chain(jobsDir, 2);
  const row = doc.rows[0];
  assert.equal(validRow(doc, { stage: 'tracing', inputs: row.inputs_sha256, dir }), row);
  assert.equal(validRow(doc, { stage: 'tracing', inputs: 'other', dir }), null);
  assert.equal(validRow(doc, { stage: 'rendering', inputs: row.inputs_sha256, dir }), null);
  assert.equal(validRow({ rows: [{ ...row, superseded: true }] }, { stage: 'tracing', inputs: row.inputs_sha256, dir }), null);
  assert.equal(validRow({ rows: [{ ...row, status: 'running' }] }, { stage: 'tracing', inputs: row.inputs_sha256, dir }), null);
  // an output that changed (same size, other bytes), one with another size, one that vanished
  fs.writeFileSync(`${dir}/stages/tracing/stub.json`, 'tracinG\n');
  assert.equal(outputsIntact(dir, row.outputs), false);
  fs.writeFileSync(`${dir}/stages/tracing/stub.json`, 'longer text\n');
  assert.equal(outputsIntact(dir, row.outputs), false);
  fs.rmSync(`${dir}/stages/tracing/stub.json`);
  assert.equal(validRow(doc, { stage: 'tracing', inputs: row.inputs_sha256, dir }), null);
  assert.equal(outputsIntact(dir, undefined), true);
});

test('walkManifest / firstInvalidStage: chained inputs; a broken early output invalidates the rest', () => {
  const jobsDir = tempDir('man-');
  const { dir, doc } = chain(jobsDir, 3);
  const w = walkManifest(doc, job, { version: '0.2.0', dir });
  assert.deepEqual(w.map((x) => [x.stage, Boolean(x.row)]), [['tracing', true], ['building', true], ['rendering', true], ['skinning', false]]);
  assert.equal(firstInvalidStage(doc, job, { version: '0.2.0', dir }), 'skinning');
  assert.equal(firstInvalidStage(doc, job, { version: '9.9.9', dir }), 'tracing', 'another engine version = other inputs');
  assert.equal(firstInvalidStage(doc, job, { version: '0.2.0', dir, stages: STAGES.slice(0, 3) }), null);
  fs.writeFileSync(`${dir}/stages/building/stub.json`, 'changed\n');
  assert.equal(firstInvalidStage(doc, job, { version: '0.2.0', dir }), 'building');
});

test('appendRow supersedes older done rows of the same stage, keeps them; supersede can keep one inputs hash', () => {
  const jobsDir = tempDir('man-');
  const { dir } = chain(jobsDir, 1);
  const again = done(dir, 'tracing', 'b'.repeat(64), { attempt: 2 });
  const doc = appendRow(jobsDir, ID, again);
  assert.equal(doc.rows.length, 2);
  assert.equal(doc.rows[0].superseded, true);
  assert.equal(doc.rows[1].superseded, undefined);
  assert.deepEqual(readManifest(jobsDir, ID), doc);
  assert.deepEqual(validate(SCHEMA, doc), []);
  const d2 = { rows: [{ stage: 's', status: 'done', inputs_sha256: 'k' }, { stage: 's', status: 'done', inputs_sha256: 'x' }, { stage: 't', status: 'done' }] };
  assert.equal(supersede(d2, 's', 'k'), 1);
  assert.deepEqual(d2.rows.map((r) => Boolean(r.superseded)), [false, true, false]);
  assert.equal(appendRow(tempDir('man-'), ID, again).rows.length, 1, 'a new manifest file');
});
