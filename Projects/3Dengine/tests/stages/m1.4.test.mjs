// The closing test of milestone 1.4, a saved reading (plan §7.1 row 1.4; contract 1.4 §8): a second run on the same
// PDF books $0 and returns the identical plan. Real processes, at $0.
//
// A temp engine home with no keys file. In every process started here `fetch` is replaced by a SCRIPTED vision
// model (scripted-vision.mjs): it answers the reading call with the 846 fixture reading and a made-up cost, and
// writes one line per request. So nothing leaves the machine and nothing can be billed.
//   1. FIRST run: the command, paid (a cap, --go, the judge off, a planted FAKE key). The real tool «asks the
//      model», traces and passes; the reading is KEPT in the home's store with what it cost.
//   2. SECOND run: a real JOB of the same PDF on the same home. It reads from the store: $0, NO new request, and
//      its plan.general.json is byte for byte the first run's.
//   3. `reading show` says what is kept, with no text of the reading.
//
// IT GOES ON FROM WHERE IT STOPPED. The two runs are two real readings, one after the other: about 71 s each on a
// quiet machine, up to 8 minutes each while other jobs render on it, and a run of this file is bounded at 540 s
// (root §12). So the home has a NAME, and the first run leaves a checkpoint in it (the hash of its plan, bound to
// the hash of the engine's code, of this test and of the reader). An invocation that was cut after the first run
// is followed by one that does NOT make the first run again: it checks the checkpoint against the disk and goes
// straight to the second run. A changed line of code anywhere makes the checkpoint void and the test starts over.
// When all three tests pass, the home is removed.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { startRealHome, quietHome, textsOf, ENGINE, FIXTURES, GOLDEN, GOLDEN_SHA, NO_RENDER } from './real-home.mjs';
import { UNKNOWN_POINT } from '../../engine/stages/rendering.mjs';
import { findReading, readerOf, sameReader, readingFile, recordFile } from '../../engine/readings.mjs';
import { drawingId } from '../../engine/jobs.mjs';
import { loadConfig, ENGINE_VERSION } from '../../engine/config.mjs';

const ANSWER = `${FIXTURES}/apt846/saved-reading.json`;     // what the scripted model «reads» from the drawing
const COST = 0.0123;                                         // what it «charges» for it
const OR = 'sk-or-PLANTED-openrouter-key-0123456789';        // a FAKE key: the scripted model is the only thing it reaches
const DRAWING = drawingId(GOLDEN_SHA, 'p1');
const LIMIT_MS = 1700 * 1000;          // above the engine's own limit for a reading (trace.timeoutSeconds = 1500)
const ENDED = ['done', 'review', 'failed', 'cancelled', 'awaiting_approval'];
const ATTEMPT = 'stages/tracing/attempt-1';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
// One home per engine home (the working folder's and the live one's never meet), named so that it is found again.
const HOME = `${os.tmpdir().replace(/\\/g, '/')}/m14-chain-${sha(ENGINE.toLowerCase()).slice(0, 10)}`;
const CHECKPOINT = `${HOME}/first-run.json`;
const RECORD = `${HOME}/requests.jsonl`;
const FIRST_OUT = `${HOME}/runs/first`;
const REAL = loadConfig({ env: {} });

// Everything the first run depends on: the engine's own code, the settings, this test and its helpers, the answer
// of the scripted model, the PDF. (The reader, two files of the pipeline, is compared apart.)
function codeSha() {
  const files = [`${ENGINE}/package.json`, `${ENGINE}/engine.config.json`, ANSWER, GOLDEN,
    ...['m1.4.test.mjs', 'real-home.mjs', 'scripted-vision.mjs'].map((f) => `${ENGINE}/tests/stages/${f}`)];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(`${dir}/${e.name}`);
      else if (e.name.endsWith('.mjs') || e.name.endsWith('.json')) files.push(`${dir}/${e.name}`);
    }
  };
  for (const d of ['engine', 'mcp', 'contracts']) walk(`${ENGINE}/${d}`);
  const h = createHash('sha256');
  for (const f of files.sort()) h.update(`${f.slice(ENGINE.length)}\n${sha(fs.readFileSync(f))}\n`);
  return h.digest('hex');
}

const requests = () => (fs.existsSync(RECORD) ? fs.readFileSync(RECORD, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);

// The checkpoint of an earlier invocation, when it still adds up with the disk and with today's code; else null.
function checkpoint() {
  try {
    const c = JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8'));
    if (c.code !== codeSha() || c.version !== ENGINE_VERSION || !sameReader(c.reader, readerOf(REAL))) return null;
    if (sha(fs.readFileSync(`${FIRST_OUT}/plan-1/plan.general.json`)) !== c.planSha || requests().length !== 1) return null;
    return c;
  } catch {
    return null;
  }
}

let h;
let scripted;
let resumed = null;    // the checkpoint this invocation goes on from, or null
let first = null;      // what the first run left: the hash of its plan, the day its plan carries
let jobId = null;
const passed = { second: false, third: false };

before(async () => {
  resumed = checkpoint();
  if (fs.existsSync(HOME)) await quietHome(HOME);      // whatever an earlier invocation left running, and its jobs
  if (!resumed) fs.rmSync(HOME, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
  scripted = { NODE_OPTIONS: `--import ${pathToFileURL(`${ENGINE}/tests/stages/scripted-vision.mjs`).href}`, SCRIPTED_VISION_FILE: RECORD,
    SCRIPTED_VISION_ANSWER: ANSWER, SCRIPTED_VISION_COST: String(COST), RECORD_EXPECT_BEARER: OR, HABAIT_FAL_BASE: '' };
  h = await startRealHome({ home: HOME, readings: {}, env: scripted, settings: NO_RENDER });
});
after(async () => {
  // Kept for the next invocation unless everything passed: a cut run is then followed by one that goes on.
  if (h) await h.stop({ keepHome: !(passed.second && passed.third) });
});

test('1. the FIRST run pays (a scripted model, a made-up cost): the real tool traces and passes, and the reading is kept with what it cost', { timeout: LIMIT_MS }, (t) => {
  if (resumed) {
    // An earlier invocation made the first run and was cut after it. It is not made again: the checkpoint is
    // checked against the disk (the plan's hash and the one request in `checkpoint()`, the store here).
    const kept = findReading(h.config, GOLDEN_SHA);
    assert.deepEqual([kept.status, kept.record.source, kept.record.costUsd, kept.record.date], ['found', 'paid', COST, resumed.planDate]);
    assert.equal(sha(fs.readFileSync(readingFile(h.config, GOLDEN_SHA))), sha(fs.readFileSync(`${FIRST_OUT}/plan-1/vlm.json`)));
    first = { planSha: resumed.planSha, planDate: resumed.planDate };
    t.diagnostic(`going on from the first run of an earlier invocation (made ${resumed.at}, ${resumed.seconds} s): it is not made again`);
    return;
  }
  assert.deepEqual(findReading(h.config, GOLDEN_SHA), { status: 'none' }, 'this home keeps no reading yet');
  const out = FIRST_OUT;
  const env = { ...process.env, ...scripted, ENGINE_HOME: h.home };
  for (const k of Object.keys(env)) if (/^(fal_key|openrouter_api_key)$/i.test(k)) delete env[k];
  env.OPENROUTER_API_KEY = OR;
  const t0 = Date.now();
  const r = spawnSync(process.execPath, ['engine/cli.mjs', 'trace', GOLDEN, '--out', out, '--id', DRAWING, '--no-judge', '--budget', '0.5', '--go', '--json'],
    { cwd: ENGINE, encoding: 'utf8', timeout: LIMIT_MS - 60000, windowsHide: true, maxBuffer: 16 << 20, env });
  assert.equal(r.error, undefined, `the command did not end in time: ${r.error?.message}`);
  assert.equal(r.status, 0, `exit ${r.status}\n${r.stderr}\n${r.stdout.slice(-800)}`);
  const a = JSON.parse(r.stdout);

  // (a) a paid run that passed, on a reading the «model» gave
  assert.deepEqual([a.outcome, a.paid, a.result.status, a.result.plans.length], ['PASS', true, 'PASS', 1]);
  assert.deepEqual([a.result.plans[0].rooms, a.result.plans[0].checks.failed, a.result.plans[0].roomCount.got], [10, 0, 10]);
  assert.equal(a.result.spentUsd, COST, 'the made-up cost is what the run says it spent');
  assert.deepEqual([a.reading.from, a.reading.store, a.reading.kept, a.reading.notKept, a.reading.superseded], ['model', 'none', true, null, null]);

  // (b) exactly ONE request, to the model's address, with the planted key where that route wants it
  const reqs = requests();
  assert.equal(reqs.length, 1, 'one reading call');
  assert.deepEqual([reqs[0].url, reqs[0].method, reqs[0].authorization], ['https://openrouter.ai/api/v1/chat/completions', 'POST', 'bearer-planted']);
  assert.ok(reqs[0].body_bytes > 1000, 'the drawing is in the request');

  // (c) the run's own ledger: the reading call, booked and settled at the made-up cost
  const ledger = JSON.parse(fs.readFileSync(`${out}/ledger.json`, 'utf8'));
  assert.deepEqual(ledger.rows.map((x) => [x.op, x.settled_usd, x.status]), [['auto-trace-read', COST, 'done']]);

  // (d) the reading is KEPT: the file the tool wrote, byte for byte, and a record that adds up
  const kept = findReading(h.config, GOLDEN_SHA);
  assert.equal(kept.status, 'found');
  assert.deepEqual([kept.record.source, kept.record.costUsd, kept.record.model, kept.record.engineVersion], ['paid', COST, 'google/gemini-3.7-flash', ENGINE_VERSION]);
  const bytes = fs.readFileSync(`${out}/plan-1/vlm.json`);
  assert.equal(sha(fs.readFileSync(readingFile(h.config, GOLDEN_SHA))), sha(bytes), 'the kept reading is the run\'s own reading file');
  const rec = JSON.parse(fs.readFileSync(recordFile(h.config, GOLDEN_SHA), 'utf8'));
  assert.deepEqual([rec.pdf_sha256, rec.reading_sha256, rec.reading_bytes, rec.reader], [GOLDEN_SHA, sha(bytes), bytes.length, readerOf(h.config)]);
  assert.equal(JSON.parse(bytes.toString('utf8'))._meta.usd, COST, 'the cost is the one the reading itself carries');

  // (e) the plan of the first run: the day the command decided before the tool started (the record's), and the drawing's id
  const planBytes = fs.readFileSync(`${out}/plan-1/plan.general.json`);
  const plan = JSON.parse(planBytes.toString('utf8'));
  assert.deepEqual([plan.plan_meta.trace_date, plan.apartment_id, plan.rooms.length], [rec.plan_date, DRAWING, 10]);
  assert.equal(kept.record.date, rec.plan_date);
  assert.match(rec.plan_date, /^\d{4}-\d{2}-\d{2}$/);
  first = { planSha: sha(planBytes), planDate: rec.plan_date };

  // (f) no key value anywhere: the command's output, the request record, the kept record
  for (const text of [r.stdout, r.stderr, fs.readFileSync(RECORD, 'utf8'), JSON.stringify(rec)]) assert.equal(text.includes(OR), false, 'a key value was written');

  // The checkpoint: an invocation that is cut after this point is followed by one that goes on from here.
  fs.writeFileSync(CHECKPOINT, `${JSON.stringify({ code: codeSha(), version: ENGINE_VERSION, reader: readerOf(REAL), planSha: first.planSha, planDate: first.planDate,
    at: new Date().toISOString(), seconds: Math.round((Date.now() - t0) / 1000) }, null, 1)}\n`);
});

test('2. the SECOND run, a real job of the same PDF: it reads from the store, books $0, makes NO request, and its plan is the first run\'s, byte for byte', { timeout: LIMIT_MS }, async () => {
  assert.ok(first, 'the first run kept a reading');
  const pdf = `${h.inbox}/rainbow-846.pdf`;
  fs.copyFileSync(GOLDEN, pdf);
  const s = await h.ok('start_simulation', { pdf_path: pdf });
  assert.deepEqual([s.created, s.job.mode, s.job.input.pdf_sha256], [true, 'real', GOLDEN_SHA]);
  jobId = s.job_id;
  const dir = h.jobDir(jobId);
  const { job, seen } = await h.follow(jobId, ENDED, LIMIT_MS - 60000);
  await h.runnersGone();

  // (a) the reading passed ((2.1) the job then builds for real and stops at the start of the render, where this home tells it to)
  assert.equal(job.state, 'failed', `the job ended ${job.state} (${job.reason?.code}: ${job.reason?.message}); it was seen in ${seen.join(' → ')}`);
  assert.equal(job.reason.code, 'STAGE_FAILED');
  assert.equal(job.reason.message, UNKNOWN_POINT, 'the reading itself did not fail (on a machine where this run was cut by its time limit, the cut stops the tool: run the file again, it goes on from the first run)');
  const rows = h.readJson(`${dir}/manifest.json`).rows;
  assert.deepEqual(rows.map((x) => [x.stage, x.attempt, x.status, x.cost_usd]), [['tracing', 1, 'done', 0], ['building', 1, 'done', 0]]);

  // (b) $0: the job's ledger is empty, the tool booked nothing, and NO request was made after the first run's one
  const ledger = h.readJson(`${dir}/ledger.json`);
  assert.deepEqual(ledger?.rows ?? [], [], 'no ledger row');
  assert.equal(job.cost.spent_usd, 0);
  assert.equal(fs.existsSync(`${dir}/${ATTEMPT}/ledger.json`), false, 'the tool booked nothing either');
  assert.equal(requests().length, 1, 'no request after the first run: the model was not asked again');

  // (c) the identical plan: the same bytes as the first run's
  const planBytes = fs.readFileSync(`${dir}/${ATTEMPT}/plan-1/plan.general.json`);
  assert.equal(sha(planBytes), first.planSha, 'plan.general.json is byte for byte the first run\'s');
  assert.equal(sha(planBytes), sha(fs.readFileSync(`${FIRST_OUT}/plan-1/plan.general.json`)));
  const plan = JSON.parse(planBytes.toString('utf8'));
  assert.deepEqual([plan.plan_meta.trace_date, plan.apartment_id], [first.planDate, DRAWING]);
  assert.notEqual(plan.apartment_id, jobId, 'the plan carries the drawing\'s id, not the job\'s');
  // and it was traced from the kept reading
  assert.equal(sha(fs.readFileSync(`${dir}/${ATTEMPT}/plan-1/vlm.json`)), sha(fs.readFileSync(readingFile(h.config, GOLDEN_SHA))));
  assert.match(fs.readFileSync(`${dir}/runner.log`, 'utf8'), /tracing: the reading passed: 10 rooms/);
  passed.second = true;
});

test('3. `reading show`: what is kept, in numbers and fixed words; and no room name of the reading in any answer, job file, record or log', () => {
  assert.ok(jobId, 'the second run made its job');
  const env = { ...process.env, ENGINE_HOME: h.home };
  const r = spawnSync(process.execPath, ['engine/cli.mjs', 'reading', 'show', GOLDEN], { cwd: ENGINE, encoding: 'utf8', timeout: 120000, windowsHide: true, env });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, `pdf sha256: ${GOLDEN_SHA}\nkept reading: kept, and made by today's reader\n`
    + `  read: ${first.planDate} · source: paid · cost: $${COST.toFixed(4)} · model: google/gemini-3.7-flash · kept by engine ${ENGINE_VERSION}\nsuperseded readings: 0\n`);
  const names = textsOf(JSON.parse(fs.readFileSync(ANSWER, 'utf8')));
  assert.ok(names.length >= 9, 'the reading names the rooms');
  const holds = (text) => names.filter((name) => text.includes(name));
  assert.deepEqual(holds(r.stdout + r.stderr), [], 'a name in what the command printed');
  assert.deepEqual(holds(h.lines.join('\n')), [], 'a name in an answer of a tool');
  for (const f of ['job.json', 'manifest.json', 'ledger.json', 'runner.log']) {
    const file = `${h.jobDir(jobId)}/${f}`;
    if (fs.existsSync(file)) assert.deepEqual(holds(fs.readFileSync(file, 'utf8')), [], `a name in ${f}`);
  }
  assert.deepEqual(holds(fs.readFileSync(recordFile(h.config, GOLDEN_SHA), 'utf8')), [], 'a name in the record');
  assert.deepEqual(holds(fs.readFileSync(RECORD, 'utf8')), [], 'a name in the request record');
  assert.deepEqual(holds(fs.readFileSync(CHECKPOINT, 'utf8')), [], 'a name in the checkpoint');
  // The names are where they belong: in the kept reading itself and in the tool's own files.
  assert.ok(holds(fs.readFileSync(readingFile(h.config, GOLDEN_SHA), 'utf8')).length > 0);
  passed.third = true;
});
