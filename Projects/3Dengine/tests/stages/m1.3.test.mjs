// The closing test of milestone 1.3, the trace gate (plan §7.1 row 1.3; contract 1.3 §7): parts 1, 2, 3 and 5.
// REAL processes all the way: the MCP server, the detached runner it starts, the reading tool and Python, on a
// temp engine home whose jobs are real (mode `real`). For the 846 PDF its readings folder holds the saved reading
// with ONE printed dimension changed by hand (the master bedroom's 348 cm written as 448 cm).
//   1. that reading fails its own check: the job goes to `review` with TRACE_GATE_FAIL, the files a person needs
//      are where the job says, and the build never starts (Blender is not started);
//   2. a PDF with no drawing starts no job: NO_PLAN_FOUND;
//   3. a PDF that has a drawing and no saved reading: `failed` / BUDGET_CAP, and the reading tool never starts;
//   5. no answer of a tool, no job file and no line of a runner's log holds a name the reading took from the drawing.
// Part 4 (the true reading passes, and the job stops at the build) is m1.3-pass.test.mjs beside this file, so the
// two real readings run side by side. A reading takes about 71 s on a quiet machine and several minutes on a
// loaded one: run with `npm run test:stages`. It never pays: no key is in this home or in its environment.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { startRealHome, textsOf, FIXTURES, GOLDEN, GOLDEN_SHA } from './real-home.mjs';
import { samplePdf } from '../fixtures/make-sample.mjs';
import { NEEDS_READING } from '../../engine/stages/tracing.mjs';
import { drawingId } from '../../engine/jobs.mjs';
import { findReading } from '../../engine/readings.mjs';

const TRUE_READING = `${FIXTURES}/apt846/saved-reading.json`;
const CHANGED = `${FIXTURES}/apt846/changed-dimension-reading.json`;
const LIMIT_MS = 1700 * 1000;          // above the engine's own limit for a reading (trace.timeoutSeconds = 1500)
const ENDED = ['done', 'review', 'failed', 'cancelled', 'awaiting_approval'];
const ATTEMPT = 'stages/tracing/attempt-1';
const LATER_STAGE = /runner \d+ (building|rendering|skinning|gating|finishing|packaging|qa):/;   // a line of the runner about a stage after the reading

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const jobIds = [];
let h;

before(async () => {
  h = await startRealHome({ prefix: 'm13-home-', readings: { [GOLDEN_SHA]: CHANGED } });
});
after(async () => {
  if (h) await h.stop();
});

const rowsOf = (file) => {
  const doc = h.readJson(file);
  return doc && Array.isArray(doc.rows) ? doc.rows : [];
};

test('the fixture: the saved reading of 846 with ONE printed dimension changed by hand, and nothing else', () => {
  assert.equal(sha(fs.readFileSync(GOLDEN)), GOLDEN_SHA, 'the golden 846 PDF');
  assert.equal(sha(fs.readFileSync(CHANGED)), 'a83f0b3714052e8c0ab2a51f3d27d985c6d395dc64aaefbdc27027e6c33180ad');
  const truth = JSON.parse(fs.readFileSync(TRUE_READING, 'utf8'));
  const changed = JSON.parse(fs.readFileSync(CHANGED, 'utf8'));
  // Put the two values back and the reading is the saved one.
  const room = changed.rooms.find((r) => r.name_en === 'master bedroom');
  assert.deepEqual(room.dims_cm, [448, 344]);
  room.dims_cm = [348, 344];
  const at = changed.printed_dims_cm.indexOf(448);
  assert.ok(at >= 0, '448 is in the list of printed values');
  changed.printed_dims_cm[at] = 348;
  assert.deepEqual(changed, truth);
  assert.equal(h.readJson(`${h.readingsDir}/${GOLDEN_SHA}/reading.json`).rooms.find((r) => r.name_en === 'master bedroom').dims_cm[0], 448,
    'the reading this home keeps for the 846 PDF is the changed one');
  assert.deepEqual([findReading(h.config, GOLDEN_SHA).status, findReading(h.config, GOLDEN_SHA).record.source], ['found', 'imported']);
});

test('1. a reading with a printed dimension changed by hand: the job ends in review with TRACE_GATE_FAIL, and the build never starts', { timeout: LIMIT_MS }, async () => {
  const pdf = `${h.inbox}/rainbow-846.pdf`;
  fs.copyFileSync(GOLDEN, pdf);
  const s = await h.ok('start_simulation', { pdf_path: pdf });
  assert.deepEqual([s.created, s.job.mode, s.job.input.pdf_sha256], [true, 'real', GOLDEN_SHA]);
  const id = s.job_id;
  jobIds.push(id);
  const dir = h.jobDir(id);

  const { job, seen } = await h.follow(id, ENDED, LIMIT_MS - 60000);
  await h.runnersGone();

  // (a) handed to a person, with the reason code of the plan's line and a message made of numbers
  assert.equal(job.state, 'review', `the job ended ${job.state} (${job.reason?.code}: ${job.reason?.message}); it was seen in ${seen.join(' → ')}`);
  assert.equal(job.reason.code, 'TRACE_GATE_FAIL');
  const m = /^the reading failed its own check: (\d+) of (\d+) checks failed \((\d+) of the (\d+) printed dimensions\)$/.exec(job.reason.message);
  assert.ok(m, job.reason.message);
  const [failed, total, dimsFailed, dims] = m.slice(1).map(Number);
  assert.ok(failed >= 1 && failed < total, `${failed} of ${total}`);
  assert.ok(dimsFailed >= 1 && dimsFailed <= dims, 'a printed dimension is among the failed checks');
  assert.equal(dims, 18, 'the 18 printed-dimension checks of this drawing');

  // (b) the files a person needs are where the job says, and they are the tool's own
  assert.deepEqual(job.review, { stage: 'tracing', attempt: 1, files: { report: `${ATTEMPT}/plan-1/report.json`, overlay: `${ATTEMPT}/plan-1/overlay.png` } });
  for (const f of Object.values(job.review.files)) assert.ok(fs.statSync(`${dir}/${f}`).size > 0, f);
  assert.equal(fs.readFileSync(`${dir}/${job.review.files.overlay}`).subarray(1, 4).toString('latin1'), 'PNG');
  const check = h.readJson(`${dir}/${ATTEMPT}/plan-1/trace-check.json`);
  assert.deepEqual([check.status, check.n_failed, check.n_checks], ['FAIL', failed, total], 'the numbers of the message are the check file\'s');
  assert.equal(check.checks.filter((c) => c.check === 'dims' && c.pass !== true).length, dimsFailed);
  assert.equal(h.readJson(`${dir}/${ATTEMPT}/plan-1/vlm.json`).rooms.find((r) => r.name_en === 'master bedroom').dims_cm[0], 448,
    'the tool read the changed reading');
  assert.equal(h.readJson(`${dir}/${ATTEMPT}/index.json`).status, 'FAIL');

  // (c) the build never started: no row, no attempt of any later stage, no folder of one, no word of one in the log
  const onDisk = h.readJson(`${dir}/job.json`);
  assert.deepEqual([onDisk.state, onDisk.reason.code, onDisk.review], ['review', 'TRACE_GATE_FAIL', job.review]);
  assert.deepEqual(onDisk.attempts, { tracing: 1 }, 'one attempt of the reading, none of any later stage');
  assert.deepEqual(rowsOf(`${dir}/manifest.json`), [], 'no manifest row: a reading that failed is not a done stage');
  assert.deepEqual(fs.readdirSync(`${dir}/stages`), ['tracing'], 'no folder of a later stage');
  for (const state of ['building', 'rendering', 'awaiting_approval', 'skinning']) assert.equal(seen.includes(state), false, `the job was seen in ${state}`);
  const log = fs.readFileSync(`${dir}/runner.log`, 'utf8');
  assert.match(log, /tracing: attempt 1 started/);
  assert.match(log, /tracing: handed to a person \(TRACE_GATE_FAIL\): the reading failed its own check: .*; no manifest row/);
  assert.match(log, /stopped: review/);
  assert.equal(LATER_STAGE.test(log), false, 'the runner\'s log has no line of a later stage');

  // (d) nothing was billed, and the job's own copy of the PDF is what was read
  assert.deepEqual(rowsOf(`${dir}/ledger.json`), [], 'no ledger row');
  assert.equal(job.cost.spent_usd, 0);
  assert.equal(fs.existsSync(`${dir}/${ATTEMPT}/ledger.json`), false, 'the tool booked nothing either');
  assert.equal(sha(fs.readFileSync(`${dir}/input/source.pdf`)), GOLDEN_SHA);
  assert.equal(h.readJson(`${dir}/${ATTEMPT}/index.json`).id, drawingId(GOLDEN_SHA, 'p1'), 'the reading is of this job\'s drawing (the id handed to the tool is the drawing\'s: contract 1.4 §3)');
});

test('2. a PDF with no drawing: NO_PLAN_FOUND, and no job is made', async () => {
  const before_ = fs.readdirSync(h.jobsDir).sort();
  const pdf = `${h.inbox}/empty-page.pdf`;
  fs.copyFileSync(`${FIXTURES}/empty-page.pdf`, pdf);
  const look = await h.ok('inspect_plan', { pdf_path: pdf });
  assert.deepEqual(look.candidates, [], 'the first look finds no drawing');
  const e = await h.fails('start_simulation', { pdf_path: pdf }, 'NO_PLAN_FOUND');
  assert.match(e.message, /no drawing was found in this PDF/);
  assert.deepEqual(fs.readdirSync(h.jobsDir).sort(), before_, 'no job folder was made');
  await h.runnersGone();
});

test('3. a PDF that has a drawing and no saved reading: failed / BUDGET_CAP; the reading tool never starts, nothing is billed', { timeout: 300000 }, async () => {
  const pdf = `${h.inbox}/another-plan.pdf`;
  fs.writeFileSync(pdf, `${samplePdf()}% a plan the engine holds no reading of\n`, 'latin1');
  const s = await h.ok('start_simulation', { pdf_path: pdf });
  assert.deepEqual([s.created, s.job.mode], [true, 'real']);
  const id = s.job_id;
  jobIds.push(id);
  const dir = h.jobDir(id);
  assert.deepEqual(findReading(h.config, s.job.input.pdf_sha256), { status: 'none' }, 'this home keeps no reading of that PDF');

  const { job, seen } = await h.follow(id, ENDED, 240000);
  await h.runnersGone();
  assert.equal(job.state, 'failed', `the job ended ${job.state}; it was seen in ${seen.join(' → ')}`);
  assert.deepEqual(job.reason, { code: 'BUDGET_CAP', message: NEEDS_READING });
  assert.equal(job.review ?? null, null);
  // The tool never started: the wrapper makes the attempt folder before it starts the tool, and there is none.
  assert.deepEqual(fs.readdirSync(`${dir}/stages`), ['tracing']);
  assert.deepEqual(fs.readdirSync(`${dir}/stages/tracing`), [], 'no attempt folder: the reading tool was never started');
  assert.deepEqual(h.readJson(`${dir}/job.json`).attempts, { tracing: 1 });
  assert.deepEqual(rowsOf(`${dir}/manifest.json`), []);
  assert.deepEqual(rowsOf(`${dir}/ledger.json`), [], 'no ledger row');
  assert.equal(job.cost.spent_usd, 0);
  assert.equal(LATER_STAGE.test(fs.readFileSync(`${dir}/runner.log`, 'utf8')), false, 'the runner\'s log has no line of a later stage');
});

test('5. no answer of a tool, no job file and no line of a runner\'s log holds a name the reading took from the drawing', () => {
  assert.equal(jobIds.length, 2, 'parts 1 and 3 made their jobs');
  const names = textsOf(JSON.parse(fs.readFileSync(CHANGED, 'utf8')));
  assert.ok(names.length >= 9, 'the reading names the rooms');
  const holds = (text) => names.filter((name) => text.includes(name));
  assert.ok(h.lines.length > 10, 'the answers of the server were kept');
  assert.deepEqual(holds(h.lines.join('\n')), [], 'a name in an answer of a tool');
  for (const id of jobIds) {
    for (const f of ['job.json', 'manifest.json', 'ledger.json', 'runner.log']) {
      const file = `${h.jobDir(id)}/${f}`;
      if (fs.existsSync(file)) assert.deepEqual(holds(fs.readFileSync(file, 'utf8')), [], `a name in ${f} of job ${id}`);
    }
  }
  // The names are where they belong: in the tool's own files, in the attempt folder.
  const own = `${h.jobDir(jobIds[0])}/${ATTEMPT}`;
  assert.ok(holds(fs.readFileSync(`${own}/plan-1/report.json`, 'utf8') + fs.readFileSync(`${own}/auto-trace.log`, 'utf8')).length > 0);
});
