// The closing test of milestone 1.2 (plan §7.1; contract 1.2 §8): the existing reading tool, unchanged, turns the
// 846 sales-plan PDF into a measured plan INSIDE this engine home, and gives the numbers that were measured before
// the engine existed: exit 0, 10 of 10 rooms, every printed dimension within 1 % (0.83 % at most).
//
// It starts the REAL tool with the REAL Python through the engine's own command, as a real process. A reading
// takes about 71 s on a quiet machine and about 8 minutes while other jobs render on it, so this file is not part
// of `npm test`: run it with `npm run test:stages`. It FAILS when the environment is missing; it never skips.
// Parts 1 and 2 are here; part 3 (the paid path, walked without paying) is m1.2-paid-path.test.mjs beside it.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../../engine/config.mjs';
import { toolPath } from '../../engine/trace.mjs';
import { drawingId } from '../../engine/jobs.mjs';
import { HASHED } from '../fixtures/make-expected-trace.mjs';

const HOME = fileURLToPath(new URL('../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
const FX = `${HOME}/tests/fixtures/apt846`;
const PDF = `${FX}/source.pdf`;
const READING = `${FX}/saved-reading.json`;
const EXPECTED = JSON.parse(fs.readFileSync(`${FX}/expected-trace.json`, 'utf8'));
const PLAN_PCT = 0.83;                 // the plan's line: «מידות מודפסות עד 0.83%»
const LIMIT_MS = 1700 * 1000;          // above the engine's own limit for a reading (trace.timeoutSeconds = 1500)
const PLANTED = 'sk-PLANTED-key-value-that-a-free-run-must-never-see-0123456789';
// (1.4) the run is handed the id of the DRAWING, as a job hands it, so the plan it writes is the plan a job writes.
const DRAWING = drawingId('0c74ab308917dd177aa9d307a2c7877ef0c9a1801849b85ad1b1b3eb542c0f0a', 'p1');

const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const works = [];
after(() => {
  for (const w of works) fs.rmSync(w, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
});

// Every file under a folder: relative path → sha256.
function tree(dir, base = dir, out = {}) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) tree(p, base, out);
    else out[p.slice(base.length + 1)] = sha(p);
  }
  return out;
}

// The strings a reading holds that came from the drawing: room and fixture names.
function textsOf(reading) {
  const out = new Set();
  const walk = (v, key) => {
    if (typeof v === 'string') {
      if (/name|label/.test(key) && v.trim().length >= 3) out.add(v.trim());
    } else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
    else if (v && typeof v === 'object' && key !== '_meta') for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk(reading, '');
  return [...out];
}

test('1. the 846 PDF from the saved reading, at $0: exit 0, 10 of 10 rooms, every printed dimension within 1 % (0.83 % at most); the measured run again, byte for byte', { timeout: LIMIT_MS }, () => {
  const config = loadConfig({ env: {} });
  assert.ok(fs.existsSync(config.python), `the engine's Python is missing: ${config.python} (node engine/cli.mjs setup-env --go)`);
  assert.ok(fs.existsSync(toolPath(config)), `the reading tool is missing: ${toolPath(config)}`);
  assert.equal(sha(PDF), '0c74ab308917dd177aa9d307a2c7877ef0c9a1801849b85ad1b1b3eb542c0f0a', 'the golden 846 PDF');

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'm12-home-')).replace(/\\/g, '/');
  works.push(work);
  const out = `${work}/run`;
  const fixturesBefore = tree(`${HOME}/tests/fixtures`);

  // A free run. Two key values are planted in the environment: the command must take them away from the tool.
  const r = spawnSync(process.execPath, ['engine/cli.mjs', 'trace', PDF, '--out', out, '--id', DRAWING, '--vlm-file', READING, '--no-judge', '--json'],
    { cwd: HOME, encoding: 'utf8', timeout: LIMIT_MS - 20000, windowsHide: true, maxBuffer: 16 << 20,
      env: { ...process.env, ENGINE_HOME: '', FAL_KEY: PLANTED, OPENROUTER_API_KEY: PLANTED } });
  assert.equal(r.error, undefined, `the command did not end in time: ${r.error?.message}`);
  assert.equal(r.status, 0, `exit ${r.status}\n${r.stderr}\n${r.stdout.slice(-800)}`);
  assert.equal(r.stderr, '');
  const a = JSON.parse(r.stdout);

  // (a) the engine's answer
  assert.deepEqual([a.outcome, a.exit, a.paid, a.result.status, a.result.spentUsd], ['PASS', 0, false, 'PASS', 0]);
  assert.equal(a.result.plans.length, 1, 'one sheet, one plan');
  const plan = a.result.plans[0];
  assert.deepEqual(plan.checks, { total: EXPECTED.checks, failed: 0 });
  assert.deepEqual(plan.roomCount, { expected: 10, got: 10 }, '10 of 10 rooms');
  assert.deepEqual([plan.rooms, plan.fixtures, plan.rounds, plan.status], [10, EXPECTED.fixtures, 1, 'PASS']);
  assert.deepEqual([plan.dims.count, plan.dims.failed], [EXPECTED.dims.length, 0]);
  assert.ok(plan.dims.maxPct <= PLAN_PCT, `the largest printed-dimension deviation is ${plan.dims.maxPct} %, the plan's line says ${PLAN_PCT} % at most`);
  assert.equal(plan.dims.maxPct, EXPECTED.max_pct);
  assert.equal(plan.judge.state, 'skipped');

  // (b) the tool's own check file says the same, check by check
  const dir = `${out}/plan-1`;
  const check = JSON.parse(fs.readFileSync(`${dir}/trace-check.json`, 'utf8'));
  assert.deepEqual([check.status, check.n_failed, check.failures], ['PASS', 0, []]);
  const dims = check.checks.filter((c) => c.check === 'dims');
  assert.equal(dims.length, 18);
  for (const c of dims) assert.ok(c.pass === true && c.pct <= 1, `${c.room}: ${c.got} against the printed ${c.expected} is ${c.pct} %`);
  assert.deepEqual(dims.map((c) => ({ room: c.room, fixture: c.fixture ?? null, expected: c.expected, got: c.got, pct: c.pct, pass: c.pass })), EXPECTED.dims);
  assert.equal(JSON.parse(fs.readFileSync(`${dir}/plan.general.json`, 'utf8')).rooms.length, 10);

  // (c) same inputs, same outputs: the files that carry the measurement are the measured run's, byte for byte, and
  //     since 1.4 the plan itself too: it carries the day the READING was made (2026-11-06), not the day of this
  //     run, and the id of the drawing, so its bytes are the same on every day (contract 1.4 §3)
  for (const f of HASHED) assert.equal(sha(`${dir}/${f}`), EXPECTED.sha256[f], f);
  assert.ok(HASHED.includes('plan.general.json'));
  const traced = JSON.parse(fs.readFileSync(`${dir}/plan.general.json`, 'utf8'));
  assert.deepEqual([traced.plan_meta.trace_date, traced.apartment_id], ['2026-11-06', DRAWING]);
  assert.notEqual(traced.plan_meta.trace_date, new Date().toISOString().slice(0, 10), 'not the day of the run');
  assert.equal(a.reading.from, 'file');

  // (d) nothing was paid, and no key reached the tool
  const files = tree(out);
  assert.deepEqual(Object.keys(files).filter((f) => /ledger/i.test(f)), [], 'no ledger file: nothing was booked');
  for (const f of Object.keys(files)) {
    if (/\.(json|log|md|txt)$/.test(f)) assert.equal(fs.readFileSync(`${out}/${f}`, 'utf8').includes(PLANTED), false, `a key value in ${f}`);
  }
  assert.equal((r.stdout + r.stderr).includes(PLANTED), false);

  // (e) text of the PDF is data: the command's own output holds none of the names the reading took from the drawing
  const names = textsOf(JSON.parse(fs.readFileSync(READING, 'utf8')));
  assert.ok(names.length >= 9, 'the reading names the rooms');
  for (const name of names) assert.equal((r.stdout + r.stderr).includes(name), false, 'a room name in the command\'s output');
  assert.ok(names.some((name) => fs.readFileSync(a.logFile, 'utf8').includes(name) || fs.readFileSync(`${dir}/report.json`, 'utf8').includes(name)),
    'the names are where they belong: in the tool\'s own files');

  // (f) nothing is written outside --out
  assert.deepEqual(fs.readdirSync(work), ['run']);
  assert.deepEqual(tree(`${HOME}/tests/fixtures`), fixturesBefore, 'the fixtures are as they were');
});

// The ONE paid run of this milestone (2026-11-18, inside a cap of $0.50 that Eliran gave): its small files, pinned.
const FRESH = `${FX}/fresh-reading`;
const FRESH_SHA = {
  'index.json': 'a3c0852ecb2729bd123387a8e24c4e8d89f9cc82d594c8ceb89582c92e2fa73f',
  'ledger.json': 'bc32fd3eea193af281c751fab6e2d07751134a8b67606ded081562447551fc8d',
  'reading.json': '8db9e74762ec7741bef7d293470edb011e01d544ed9102597a6c2ff55ab720af',
  'report.json': 'e3b30ea6603d7245eaacaae88ebff42527adb8053bd6d09cabbaab2105f3444b',
  'trace-check.json': '6531c179102612a279cf985c0607557ec5aee8af1ecfd81234be36c18c7f3080',
};
const CAP_USD = 0.5;

test('2. the 846 PDF from ONE fresh reading (paid, $0.04 inside a cap of $0.50): PASS, 10 of 10 rooms, every printed dimension within 1 %; asserted from the evidence the run wrote, with no call', () => {
  const read = (f) => JSON.parse(fs.readFileSync(`${FRESH}/${f}`, 'utf8'));
  for (const [f, hash] of Object.entries(FRESH_SHA)) assert.equal(sha(`${FRESH}/${f}`), hash, `${f} is the file the paid run wrote`);
  const [index, check, report, ledger, reading] = ['index.json', 'trace-check.json', 'report.json', 'ledger.json', 'reading.json'].map(read);

  // (a) the result: the plan's line, on a reading the model made that day
  assert.deepEqual([index.status, index.id, index.model, index.input], ['PASS', 'apt846', 'google/gemini-3.7-flash', 'tests/fixtures/apt846/source.pdf']);
  assert.deepEqual(index.plans.map((p) => [p.dir, p.status, p.rooms, p.rounds]), [['plan-1', 'PASS', 10, 1]]);
  assert.deepEqual([check.status, check.n_failed, check.failures, report.rooms], ['PASS', 0, [], 10]);
  assert.deepEqual(check.checks.filter((c) => c.check === 'room_count').map((c) => [c.expected, c.got, c.pass]), [[10, 10, true]], '10 of 10 rooms');
  const dims = check.checks.filter((c) => c.check === 'dims');
  assert.equal(dims.length, 18);
  for (const c of dims) assert.ok(c.pass === true && c.pct <= 1, `${c.room}: ${c.got} against the printed ${c.expected} is ${c.pct} %`);
  assert.ok(Math.max(...dims.map((c) => c.pct)) <= PLAN_PCT, 'the largest deviation is inside the plan\'s 0.83 %');
  // the judge ran (three runs) and is a report: no mismatch that two runs agree on
  assert.deepEqual([check.judge.runs, check.judge.mismatches, check.judge.agreed_2of3], [3, [], []]);

  // (b) it IS a fresh reading: made on the day of the run, by the model, and not the saved one
  assert.deepEqual([reading._meta.label, reading._meta.model, reading._meta.at.slice(0, 10)], ['read', 'google/gemini-3.7-flash', '2026-11-18']);
  assert.notEqual(sha(`${FRESH}/reading.json`), sha(READING));
  assert.ok(reading.rooms.length >= 9 && reading._meta.usd > 0);

  // (c) the ledger: one reading and three runs of the judge, each booked (reserved) and then settled; the total is
  //     what the result says was spent, and it is inside the cap
  assert.deepEqual(ledger.rows.map((r) => r.op), ['auto-trace-read', 'auto-trace-judge', 'auto-trace-judge', 'auto-trace-judge']);
  for (const r of ledger.rows) {
    assert.deepEqual([r.apartment, r.model, r.reserved_usd, r.status], ['apt846', 'google/gemini-3.7-flash', 0.02, 'done'], `row ${r.seq}`);
    assert.ok(typeof r.settled_usd === 'number' && r.settled_usd > 0 && r.settled_usd <= r.reserved_usd, `row ${r.seq}: settled ${r.settled_usd}`);
    assert.equal(r.ts.slice(0, 10), '2026-11-18');
  }
  assert.deepEqual(ledger.rows.map((r) => r.seq), [1, 2, 3, 4]);
  assert.deepEqual([...ledger.rows].sort((a, b) => a.ts.localeCompare(b.ts)).map((r) => r.seq), [1, 2, 3, 4], 'in the order of the calls');
  const total = ledger.rows.reduce((t, r) => t + r.settled_usd, 0);
  assert.ok(Math.abs(total - index.spent_usd) < 1e-9, `the ledger's total ${total} is the result's spent_usd ${index.spent_usd}`);
  assert.equal(ledger.rows[0].settled_usd, reading._meta.usd, 'the reading\'s own cost is its ledger row');
  assert.ok(total > 0 && total <= CAP_USD, `spent ${total}, the cap was ${CAP_USD}`);
  assert.ok(total < 0.05, 'about four cents');

  // (d) no key value in any file of the evidence
  for (const f of Object.keys(FRESH_SHA)) {
    const text = fs.readFileSync(`${FRESH}/${f}`, 'utf8');
    assert.equal(/sk-[A-Za-z0-9_-]{12,}|Bearer\s|Authorization|(FAL_KEY|OPENROUTER_API_KEY)\s*[=:]/i.test(text), false, `${f} holds something shaped like a key`);
  }
});
