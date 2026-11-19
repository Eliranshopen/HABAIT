// The closing test of milestone 1.3, the trace gate (plan §7.1 row 1.3; contract 1.3 §7): part 4, and part 5 on
// its own home. The other side of the gate: the 846 PDF with its TRUE saved reading, through a real job (the real
// MCP server, the detached runner, the reading tool and Python, on a temp home of mode `real`). The reading passes
// its own check, its five files become the stage's outputs with their hashes in the manifest, and the job goes on
// to the build, where it stops: there is no real build yet (a later milestone moves that line).
// It is a file of its own so that this reading and the failing one of m1.3.test.mjs run side by side.
// Run with `npm run test:stages`. It never pays: no key is in this home or in its environment.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { startRealHome, textsOf, FIXTURES, GOLDEN, GOLDEN_SHA, NO_RENDER } from './real-home.mjs';
import { PLAN_FILES, DRAWING_FILE, VECTORS_FILE } from '../../engine/stages/tracing.mjs';
import { UNKNOWN_POINT } from '../../engine/stages/rendering.mjs';
import { BUILD_OUTPUTS } from '../../engine/build.mjs';
import { workspaceOf } from '../../engine/workspace.mjs';
import { drawingId } from '../../engine/jobs.mjs';
import { findReading } from '../../engine/readings.mjs';
import { HASHED } from '../fixtures/make-expected-trace.mjs';

const READING = `${FIXTURES}/apt846/saved-reading.json`;
const EXPECTED = JSON.parse(fs.readFileSync(`${FIXTURES}/apt846/expected-trace.json`, 'utf8'));
const PLAN_PCT = 0.83;                 // the plan's line: «מידות מודפסות עד 0.83%»
const LIMIT_MS = 1700 * 1000;          // above the engine's own limit for a reading (trace.timeoutSeconds = 1500)
const ENDED = ['done', 'review', 'failed', 'cancelled', 'awaiting_approval'];
const ATTEMPT = 'stages/tracing/attempt-1';
const AFTER_RENDER = /runner \d+ (skinning|gating|finishing|packaging|qa):/;   // a line of the runner about a stage after the render

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
let h;
let jobId = null;

before(async () => {
  h = await startRealHome({ prefix: 'm13p-home-', readings: { [GOLDEN_SHA]: READING }, settings: NO_RENDER });
});
after(async () => {
  if (h) await h.stop();
});

const rowsOf = (file) => {
  const doc = h.readJson(file);
  return doc && Array.isArray(doc.rows) ? doc.rows : [];
};

test('4. the 846 PDF with its true saved reading: the reading passes, its five files are the stage\'s outputs, and the job stops at the build', { timeout: LIMIT_MS }, async () => {
  assert.equal(sha(fs.readFileSync(`${h.readingsDir}/${GOLDEN_SHA}/reading.json`)), '5578716415b3e95a2bf971c057d4a39ba968635667980b701984802805a51537',
    'the reading this home keeps for the 846 PDF is the saved one, byte for byte');
  const keptReading = findReading(h.config, GOLDEN_SHA);
  assert.deepEqual([keptReading.status, keptReading.record.source, keptReading.record.date], ['found', 'imported', '2026-11-06']);
  const pdf = `${h.inbox}/rainbow-846.pdf`;
  fs.copyFileSync(GOLDEN, pdf);
  const s = await h.ok('start_simulation', { pdf_path: pdf });
  assert.deepEqual([s.created, s.job.mode, s.job.input.pdf_sha256], [true, 'real', GOLDEN_SHA]);
  const id = s.job_id;
  jobId = id;
  const dir = h.jobDir(id);

  const { job, seen } = await h.follow(id, ENDED, LIMIT_MS - 60000);
  await h.runnersGone();

  // (a) the reading passed and the job went on: (2.1) the build ran for real, and the job stops where this home
  // tells it to, at the start of the render
  assert.equal(job.state, 'failed', `the job ended ${job.state} (${job.reason?.code}: ${job.reason?.message}); it was seen in ${seen.join(' → ')}`);
  assert.deepEqual(job.reason, { code: 'STAGE_FAILED', message: UNKNOWN_POINT });
  assert.equal(job.review ?? null, null);
  assert.deepEqual(h.readJson(`${dir}/job.json`).attempts, { tracing: 1, building: 1, rendering: 1 });
  for (const state of ['awaiting_approval', 'skinning', 'done']) assert.equal(seen.includes(state), false, `the job was seen in ${state}`);

  // (b) ONE manifest row, the reading's: its five outputs are on the disk with the hashes the row states
  const rows = rowsOf(`${dir}/manifest.json`);
  assert.equal(rows.length, 1, 'one row: the reading; the build has none');
  const row = rows[0];
  assert.deepEqual([row.stage, row.attempt, row.status, row.cost_usd], ['tracing', 1, 'done', 0]);
  // (2.1) the build takes two more files of the reading: the picture of the drawing and its vector lines
  assert.deepEqual(row.outputs.map((o) => o.path), [...PLAN_FILES, DRAWING_FILE, VECTORS_FILE].map((f) => `${ATTEMPT}/plan-1/${f}`));
  assert.deepEqual(PLAN_FILES, ['plan.general.json', 'overlay.png', 'report.json', 'trace-check.json', 'vlm.json']);
  for (const o of row.outputs) {
    const bytes = fs.readFileSync(`${dir}/${o.path}`);
    assert.deepEqual([o.sha256, o.bytes], [sha(bytes), bytes.length], o.path);
    assert.ok(bytes.length > 0, o.path);
  }

  // (c) the plan of the plan's line: 10 of 10 rooms, every printed dimension within 1 % (0.83 % at most)
  const plan = h.readJson(`${dir}/${ATTEMPT}/plan-1/plan.general.json`);
  assert.equal(plan.rooms.length, 10);
  const check = h.readJson(`${dir}/${ATTEMPT}/plan-1/trace-check.json`);
  assert.deepEqual([check.status, check.n_failed, check.n_checks, check.failures], ['PASS', 0, EXPECTED.checks, []]);
  assert.deepEqual(check.checks.filter((c) => c.check === 'room_count').map((c) => [c.expected, c.got, c.pass]), [[10, 10, true]]);
  const dims = check.checks.filter((c) => c.check === 'dims');
  assert.equal(dims.length, 18);
  for (const c of dims) assert.ok(c.pass === true && c.pct <= 1, `${c.room}: ${c.got} against the printed ${c.expected} is ${c.pct} %`);
  assert.ok(Math.max(...dims.map((c) => c.pct)) <= PLAN_PCT);
  // Same inputs, same outputs: the files that carry the measurement, and since 1.4 the PLAN itself, are the pinned
  // run's, byte for byte, although this reading ran inside a job and on another day. The plan carries the day the
  // reading was made and the id of the drawing, never the day of the run or the id of the job (contract 1.4 §3).
  for (const f of HASHED) assert.equal(sha(fs.readFileSync(`${dir}/${ATTEMPT}/plan-1/${f}`)), EXPECTED.sha256[f], f);
  assert.ok(HASHED.includes('plan.general.json'));
  assert.deepEqual([plan.plan_meta.trace_date, plan.apartment_id], ['2026-11-06', drawingId(GOLDEN_SHA, 'p1')]);
  assert.notEqual(plan.plan_meta.trace_date, new Date().toISOString().slice(0, 10), 'not the day of the run');
  assert.notEqual(plan.apartment_id, id, 'not the id of the job');
  assert.equal(h.readJson(`${dir}/${ATTEMPT}/index.json`).id, drawingId(GOLDEN_SHA, 'p1'), 'the reading is of this job\'s drawing');

  // (d) (2.1) the build ran: its files are in the job's workspace, its row has the twelve of them, and no name of
  // the job is left in the pipeline tree; the render started nothing
  assert.deepEqual(fs.readdirSync(`${dir}/stages`).sort(), ['building', 'rendering', 'tracing']);
  assert.deepEqual(fs.readdirSync(`${dir}/stages/rendering`), [], 'the render wrote nothing');
  const built = rowsOf(`${dir}/manifest.json`).find((r) => r.stage === 'building');
  assert.deepEqual(built.outputs.map((o) => o.path), BUILD_OUTPUTS.map((f) => `work/${f}`));
  assert.equal(built.cost_usd, 0);
  const ws = workspaceOf(h.config, dir, id);
  for (const link of Object.values(ws.links)) assert.equal(fs.existsSync(link), false, `left in the pipeline tree: ${link}`);
  const log = fs.readFileSync(`${dir}/runner.log`, 'utf8');
  assert.match(log, /tracing: the reading passed: 10 rooms, \d+ checks, 18 printed dimensions \(the largest [\d.]+ %\), [\d.]+ s/);
  assert.match(log, /tracing: done \(attempt 1, \$0\)/);
  assert.match(log, /building: built: 10 rooms \(\d+ of type other\), 10 camera points, 12 files, [\d.]+ s/);
  assert.match(log, /rendering: failed STAGE_FAILED/);
  assert.match(log, /stopped: failed/);
  assert.equal(AFTER_RENDER.test(log), false, 'the runner\'s log has no line of a stage after the render');

  // (e) nothing was billed
  assert.deepEqual(rowsOf(`${dir}/ledger.json`), [], 'no ledger row');
  assert.equal(job.cost.spent_usd, 0);
  assert.equal(fs.existsSync(`${dir}/${ATTEMPT}/ledger.json`), false, 'the tool booked nothing either');
});

test('5. no answer of a tool, no job file and no line of the runner\'s log holds a name the reading took from the drawing', () => {
  assert.ok(jobId, 'part 4 made its job');
  const names = textsOf(JSON.parse(fs.readFileSync(READING, 'utf8')));
  assert.ok(names.length >= 9, 'the reading names the rooms');
  const holds = (text) => names.filter((name) => text.includes(name));
  assert.ok(h.lines.length > 10, 'the answers of the server were kept');
  assert.deepEqual(holds(h.lines.join('\n')), [], 'a name in an answer of a tool');
  for (const f of ['job.json', 'manifest.json', 'ledger.json', 'runner.log']) {
    const file = `${h.jobDir(jobId)}/${f}`;
    if (fs.existsSync(file)) assert.deepEqual(holds(fs.readFileSync(file, 'utf8')), [], `a name in ${f}`);
  }
  // The names are where they belong: in the tool's own files, in the attempt folder.
  const own = `${h.jobDir(jobId)}/${ATTEMPT}`;
  assert.ok(holds(fs.readFileSync(`${own}/plan-1/report.json`, 'utf8') + fs.readFileSync(`${own}/auto-trace.log`, 'utf8')).length > 0);
});
