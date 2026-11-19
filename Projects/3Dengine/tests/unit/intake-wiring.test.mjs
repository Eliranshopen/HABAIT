// The stored input is checked at every runner start (contract 1.1 §4), with the real intake and the real
// check on real files; the settings block of the first look (§6); and the golden inputs of the tests (§8).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { runRunner } from '../../engine/runner.mjs';
import { newJob, writeJob, readJob, updateJob, setState, STAGES, jobId, checkJob, JobUnreadable } from '../../engine/jobs.mjs';
import { restartJob } from '../../engine/control.mjs';
import { REGISTRY } from '../../engine/stages/index.mjs';
import { readManifest } from '../../engine/manifest.mjs';
import { readLedger } from '../../engine/ledger.mjs';
import { intakePdf, verifyInput, inputFile, INPUT_REL } from '../../engine/stages/intake.mjs';
import { loadConfig, INSPECT_DEFAULTS } from '../../engine/config.mjs';
import { settingsOf } from '../../engine/inspect.mjs';
import { stubConfig, writeFile, tempDir } from '../helpers/fakes.mjs';
import { samplePdf, SEGMENTS } from '../fixtures/make-sample.mjs';
import { HASHED } from '../fixtures/make-expected-trace.mjs';

const ID = 'abcdef0123456789';
const T = '2026-11-17T08:00:00.000Z';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const homes = [];
after(() => {
  for (const h of homes) fs.rmSync(h, { recursive: true, force: true });
});

// A job made the way start_simulation makes one: the upload in the inbox, the intake's copy in the job.
function jobWithInput(state = 'queued', { approved = false } = {}) {
  const c = stubConfig({ serve: { host: '127.0.0.1', port: 8123 } });
  homes.push(c.home);
  const config = { ...c, stub: { ...c.stub, callUsd: 0.6 }, runner: { ...c.runner, heartbeatMs: 10 } };
  const upload = `${config.home}/inbox/plan.pdf`;
  writeFile(upload, samplePdf());
  const hash = sha(fs.readFileSync(upload));
  const copy = intakePdf(config.jobsDir, ID, { path: upload, bytes: fs.statSync(upload).size }, hash);
  const job = newJob({ id: ID, mode: 'stub', now: T,
    input: { pdf_path: copy.path, pdf_name: 'plan.pdf', pdf_sha256: hash, pdf_bytes: copy.bytes, apartment: 'p1' } });
  setState(job, state, T);
  if (approved) {
    job.approval = { cap_usd: 60, at: T };
    job.cost.cap_usd = 60;
  }
  writeJob(config.jobsDir, job);
  return { config, upload, hash, stored: inputFile(config.jobsDir, ID) };
}

function run(config, over = {}) {
  const logs = [];
  let t = Date.parse(T);
  const p = runRunner({ config, jobId: ID, pid: 4242, now: () => new Date((t += 1000)).toISOString(), clock: () => t, sleep: async () => {},
    log: (m) => logs.push(m), ensureServe: async () => {}, alive: (x) => x === 4242, timer: () => () => {}, claimWaitMs: 0, approvalWaitMs: 0, ...over });
  return { p, logs };
}

const unlock = (file) => fs.chmodSync(file, 0o666);

test('an intact stored input: the runner works (the real check, no stand-in)', async () => {
  const { config, stored } = jobWithInput('queued');
  assert.deepEqual(verifyInput(config.jobsDir, readJob(config.jobsDir, ID)), { ok: true });
  const { p } = run(config);
  assert.equal(await p, 'approval-timeout', 'it walked the free stages and waits for the approval');
  assert.deepEqual(readManifest(config.jobsDir, ID).rows.map((r) => r.stage), STAGES.slice(0, 3));
  assert.equal(fs.statSync(stored).mode & 0o222, 0, 'still read-only');
});

test('a stored input that was changed by hand: the next start ends the job failed, no stage runs, nothing is billed', async () => {
  const { config, stored } = jobWithInput('queued');
  unlock(stored);
  fs.appendFileSync(stored, '% one more line\n');
  const { p, logs } = run(config, { ensureServe: async () => assert.fail('no link is started') });
  assert.equal(await p, 'failed');
  const job = readJob(config.jobsDir, ID);
  assert.equal(job.state, 'failed');
  assert.deepEqual(job.reason, { code: 'STAGE_FAILED', message: `the stored input (${INPUT_REL}) is not the PDF this job was started with` });
  assert.equal(job.attempts, undefined, 'no stage was started');
  assert.deepEqual(readManifest(config.jobsDir, ID).rows, []);
  assert.deepEqual(readLedger(config.jobsDir, ID).rows, []);
  assert.equal(job.cost.spent_usd, 0);
  assert.equal(fs.existsSync(`${config.jobsDir}/${ID}/stages`), false);
  assert.equal(fs.existsSync(`${config.jobsDir}/${ID}/runner.pid`), false, 'runner.pid given back');
  assert.ok(logs.some((l) => /not the PDF this job was started with; the job fails here and no stage runs/.test(l)), logs.join('\n'));
  // A second runner finds a job that has ended and does nothing.
  assert.equal(await run(config).p, 'failed');
});

test('a stored input that is gone: failed with "missing"; and a resume in the middle of a job checks it too', async () => {
  const gone = jobWithInput('queued');
  unlock(gone.stored);
  fs.rmSync(gone.stored);
  assert.equal(await run(gone.config).p, 'failed');
  assert.equal(readJob(gone.config.jobsDir, ID).reason.message, `the stored input (${INPUT_REL}) is missing`);

  // A job that already paid for a stage (skinning), stopped in the next one (cancelled there), its stored
  // input swapped, then restarted. Nothing runs on the other bytes: no new row, no new call.
  const mid = jobWithInput('queued', { approved: true });
  const stopAtGating = { ...REGISTRY, gating: { stub: { run: async (ctx) => {
    updateJob(mid.config.jobsDir, ID, (j) => setState(j, 'cancelled', T));
    ctx.checkCancelled();
  } } } };
  assert.equal(await run(mid.config, { registry: stopAtGating, approvalWaitMs: 86400000 }).p, 'cancelled');
  const rowsBefore = readManifest(mid.config.jobsDir, ID).rows.length;
  const ledgerBefore = JSON.stringify(readLedger(mid.config.jobsDir, ID).rows);
  assert.equal(rowsBefore, 4, 'tracing, building, rendering and skinning have rows');
  assert.equal(readLedger(mid.config.jobsDir, ID).rows.filter((r) => r.status === 'settled').length, 1, 'skinning was paid for');
  unlock(mid.stored);
  fs.writeFileSync(mid.stored, samplePdf().replace('0.5 w', '0.6 w'));
  assert.equal(restartJob(mid.config, ID).state, 'gating', 'restarted where it stopped');
  const again = run(mid.config);
  assert.equal(await again.p, 'failed');
  const job = readJob(mid.config.jobsDir, ID);
  assert.equal(job.reason.code, 'STAGE_FAILED');
  assert.equal(readManifest(mid.config.jobsDir, ID).rows.length, rowsBefore, 'no new row');
  assert.equal(JSON.stringify(readLedger(mid.config.jobsDir, ID).rows), ledgerBefore, 'no new call, nothing billed again');
});

test('a job that has ended is not looked at again; a job whose folder lost its input after `done` stays done', async () => {
  const { config, stored } = jobWithInput('done');
  unlock(stored);
  fs.rmSync(stored);
  assert.equal(await run(config).p, 'done');
  assert.equal(readJob(config.jobsDir, ID).state, 'done');
});

test('the settings of the first look: defaults, a settings file that sets them, a local override, bad values', () => {
  const base = JSON.parse(fs.readFileSync(new URL('../../engine.config.json', import.meta.url), 'utf8'));
  assert.deepEqual(base.inspect, { minSidePx: 1000, vectorMinPaths: 200, timeoutSeconds: 30 });
  assert.deepEqual(INSPECT_DEFAULTS, { minSidePx: 1000, vectorMinPaths: 200, timeoutSeconds: 30 });
  const homeWith = (cfg, local) => {
    const h = tempDir('cfg-');
    homes.push(h);
    writeFile(`${h}/engine.config.json`, JSON.stringify(cfg));
    if (local) writeFile(`${h}/engine.config.local.json`, JSON.stringify(local));
    return h;
  };
  assert.deepEqual(loadConfig({ home: homeWith(base), env: {} }).inspect, INSPECT_DEFAULTS);
  const old = { ...base };
  delete old.inspect;
  const c = loadConfig({ home: homeWith(old), env: {} });
  assert.deepEqual(c.inspect, INSPECT_DEFAULTS, 'a settings file written before 1.1 still loads');
  assert.deepEqual(settingsOf(c), INSPECT_DEFAULTS);
  const local = loadConfig({ home: homeWith(base, { inspect: { vectorMinPaths: 50 } }), env: {} });
  assert.deepEqual(local.inspect, { minSidePx: 1000, vectorMinPaths: 50, timeoutSeconds: 30 }, 'merged one level deep');
  assert.throws(() => loadConfig({ home: homeWith({ ...base, inspect: { minSidePx: 0 } }), env: {} }), /"inspect.minSidePx"/);
  assert.throws(() => loadConfig({ home: homeWith({ ...base, inspect: { vectorMinPaths: 1.5 } }), env: {} }), /"inspect.vectorMinPaths"/);
  assert.throws(() => loadConfig({ home: homeWith({ ...base, inspect: { timeoutSeconds: 0 } }), env: {} }), /"inspect.timeoutSeconds"/);
});

test('the fixtures are the bytes the tests count on: the golden 846 PDF, the page with a drawing, the empty page', () => {
  const fx = (name) => fs.readFileSync(new URL(`../fixtures/${name}`, import.meta.url));
  // The golden input (contract 1.1 §8): a copy of Projects/Habait/data/sales-plans/israel-canada/rainbow-tel-aviv/unit-846/source.pdf.
  const golden = fx('apt846/source.pdf');
  assert.equal(golden.length, 183222);
  assert.equal(sha(golden), '0c74ab308917dd177aa9d307a2c7877ef0c9a1801849b85ad1b1b3eb542c0f0a');
  // sample.pdf is exactly what its generator writes: git did not touch its line endings (.gitattributes).
  const sample = fx('sample.pdf');
  assert.equal(sample.toString('latin1'), samplePdf());
  assert.equal(SEGMENTS, 300);
  assert.equal(sample.includes(Buffer.from('\r\n')), false, 'no CRLF: the cross-reference offsets are byte offsets');
  assert.equal(sha(sample), 'd3f140994367f1bc8ed3ae6d3aa3e6e1b8a3a23157efe028db516235c5b11035');
  assert.equal(sha(fx('empty-page.pdf')), 'f58ffe67d265480cbcb273f85f86c1bb4032fa6b96494a35080f1025cc2ce741');
  for (const f of ['apt846/source.pdf', 'sample.pdf', 'empty-page.pdf']) assert.equal(fx(f).subarray(0, 5).toString('latin1'), '%PDF-', f);
  // The saved reading of the 846 drawing (contract 1.2 §8): one vision call of 2026-11-06, copied byte for byte from
  // .wt/portal-stage/Projects/Habait/habait-walkaround/Habait/tour360/out/ptrace846/trace/plan-1/vlm.json.
  const reading = fx('apt846/saved-reading.json');
  assert.equal(reading.length, 4783);
  assert.equal(sha(reading), '5578716415b3e95a2bf971c057d4a39ba968635667980b701984802805a51537');
  const meta = JSON.parse(reading.toString('utf8'))._meta;
  assert.deepEqual([meta.model, meta.label, meta.at], ['google/gemini-3.7-flash', 'read', '2026-11-06T10:09:31.897Z']);
  // The same reading with ONE printed dimension changed by hand (contract 1.3 §7): the master bedroom's 348 cm is
  // written as 448 cm, in the room's own dimensions and in the list of printed values. Nothing else differs.
  const changed = fx('apt846/changed-dimension-reading.json');
  assert.equal(changed.length, 4784);
  assert.equal(sha(changed), 'a83f0b3714052e8c0ab2a51f3d27d985c6d395dc64aaefbdc27027e6c33180ad');
  const [was, is] = [reading, changed].map((b) => JSON.parse(b.toString('utf8')));
  const differ = [];
  const walk = (a, b, at) => {
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[k], b[k], `${at}/${k}`);
    } else if (a !== b) differ.push([at, a, b]);
  };
  walk(was, is, '');
  assert.equal(differ.length, 2, JSON.stringify(differ));
  assert.ok(differ.every(([, a, b]) => a === 348 && b === 448), JSON.stringify(differ));
  assert.match(differ[0][0], /^\/rooms\/\d+\/dims_cm\/0$/);
  assert.match(differ[1][0], /^\/printed_dims_cm\/\d+$/);
  // The expected table is what its generator wrote from a run that was checked by hand: the numbers of the plan's line.
  const expected = JSON.parse(fx('apt846/expected-trace.json').toString('utf8'));
  assert.deepEqual([expected.status, expected.checks, expected.failed, expected.rooms, expected.room_count, expected.dims.length, expected.max_pct],
    ['PASS', 82, 0, 10, { expected: 10, got: 10 }, 18, 0.82]);
  assert.ok(expected.dims.every((d) => d.pass === true && d.pct <= 1), 'every printed dimension within 1 %');
  assert.deepEqual(Object.keys(expected.sha256), HASHED);
  assert.ok(Object.values(expected.sha256).every((h) => /^[0-9a-f]{64}$/.test(h)));
});

test('a stored input changed while a LIVE runner waits for the approval: the paid stage never starts on it', async () => {
  const { config, stored } = jobWithInput('queued');
  let done = false;
  const { p, logs } = run(config, { approvalWaitMs: 86400000,
    sleep: async () => {
      const j = readJob(config.jobsDir, ID);
      if (j.state !== 'awaiting_approval' || done) return;
      done = true;
      // While the runner waits: the hand changes the copy, and then the approval arrives.
      unlock(stored);
      fs.appendFileSync(stored, '% changed while the runner waited\n');
      updateJob(config.jobsDir, ID, (x) => {
        x.approval = { cap_usd: 60, at: T };
        x.cost.cap_usd = 60;
        return x;
      });
    } });
  assert.equal(await p, 'failed');
  const job = readJob(config.jobsDir, ID);
  assert.deepEqual(job.reason, { code: 'STAGE_FAILED', message: `the stored input (${INPUT_REL}) is not the PDF this job was started with` });
  assert.equal(job.attempts.skinning, undefined, 'the paid stage was never started');
  assert.deepEqual(readManifest(config.jobsDir, ID).rows.map((r) => r.stage), STAGES.slice(0, 3), 'only the three free stages have rows');
  assert.deepEqual(readLedger(config.jobsDir, ID).rows, [], 'nothing was reserved, sent or billed');
  assert.equal(fs.existsSync(`${config.jobsDir}/${ID}/runner.pid`), false);
  assert.ok(logs.some((l) => /no stage runs on it/.test(l)));
});

test('the hash in job.json cannot be moved: a job file must carry the id of its own input', () => {
  const c = stubConfig();
  homes.push(c.home);
  const V = '1.1.0';
  const hash = sha(Buffer.from(samplePdf()));
  const id = jobId({ pdfSha256: hash, apartment: 'p1', mode: 'stub', version: V });
  const made = newJob({ id, mode: 'stub', now: T, version: V,
    input: { pdf_path: 'x', pdf_name: 'plan.pdf', pdf_sha256: hash, pdf_bytes: 1, apartment: 'p1' } });
  assert.equal(made.engine_version, V);
  writeJob(c.jobsDir, made);
  assert.equal(readJob(c.jobsDir, id).job_id, id);
  // Every way of moving the input under the same id: the file is no longer this job's.
  const other = sha(Buffer.from('other bytes'));
  const moves = [
    (j) => { j.input.pdf_sha256 = other; },
    (j) => { j.input.apartment = 'p2'; },
    (j) => { j.mode = 'real'; },
    (j) => { j.engine_version = '9.9.9'; },
    (j) => { j.engine_version = null; },
    (j) => { j.engine_version = 7; },
  ];
  for (const move of moves) {
    const j = structuredClone(made);
    move(j);
    assert.throws(() => checkJob(j, id), (e) => e instanceof JobUnreadable && /its id is not the id of its own input/.test(e.message));
    assert.throws(() => writeJob(c.jobsDir, j, id), JobUnreadable, 'such a file is never written either');
    fs.writeFileSync(`${c.jobsDir}/${id}/job.json`, JSON.stringify(j));
    assert.throws(() => readJob(c.jobsDir, id), JobUnreadable);
  }
  // A job file made before this milestone has no engine_version: its id is not checked this way.
  const old = structuredClone(made);
  delete old.engine_version;
  old.input.pdf_sha256 = other;
  assert.equal(checkJob(old, id).job_id, id);
  // And a job without a version stays without one.
  assert.equal('engine_version' in newJob({ id, mode: 'stub', now: T, input: made.input }), false);
});
