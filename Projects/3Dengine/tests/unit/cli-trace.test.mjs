// The command `node engine/cli.mjs trace` (contract 1.2 §6, 1.4 §4), with an injected runTrace and an injected
// store: what it passes on, what it prints, its exit codes, when it reads from the store and when it keeps a
// reading. The reading tool itself is never started here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { main, USAGE } from '../../engine/cli.mjs';
import { TraceUsageError, exitCodeOf } from '../../engine/trace.mjs';
import { ReadingError } from '../../engine/readings.mjs';
import { EngineError } from '../../engine/inbox.mjs';
import { fakeConfig, sink, SECRET } from '../helpers/fakes.mjs';

const io = (env = { FAL_KEY: SECRET }) => ({ stdout: sink(), stderr: sink(), env });
const SHA = 'c'.repeat(64);
const PLAN = { k: 1, page: 1, status: 'PASS', rounds: 1, rooms: 10, fixtures: 18, scalePxPerCm: 2.2677, checks: { total: 82, failed: 0 },
  roomCount: { expected: 10, got: 10 }, dims: { count: 18, failed: 0, maxPct: 0.82 }, couldNotRead: 10, judge: { state: 'skipped', runs: null, mismatches: 0 },
  files: { dir: 'C:/o/plan-1', plan: 'C:/o/plan-1/plan.general.json', overlay: 'C:/o/plan-1/overlay.png', report: 'C:/o/plan-1/report.json', traceCheck: 'C:/o/plan-1/trace-check.json' } };
const answer = (outcome, over = {}) => ({ outcome, exit: 0, seconds: 71.3, paid: false, outDir: 'C:/o', logFile: 'C:/o/auto-trace.log',
  result: outcome === 'PASS' || outcome === 'FAIL' ? { status: outcome, spentUsd: 0, plans: [{ ...PLAN, status: outcome }] } : null, ...over });
const DRY = { outcome: 'DRY', exit: null, seconds: 0, paid: false, outDir: 'C:/o', logFile: null, result: null,
  wouldCall: { reading: 1, judgeRuns: 3, total: 4, estimateUsd: 0.08, maxBudgetUsd: 1 } };
const NO_READING = { from: 'model', store: 'none', readAt: null, kept: false, superseded: null, notKept: null };
const RECORD = { readAt: '2026-11-06T10:09:31.897Z', date: '2026-11-06', savedAt: '2026-11-18T12:00:00.000Z', source: 'paid', costUsd: 0.0123, model: 'm', engineVersion: '1.4.0', readingSha256: 'e'.repeat(64) };
const FOUND = { status: 'found', file: 'C:/store/reading.json', record: RECORD };

// deps whose runTrace records what it was given and answers `r` (or throws it); the store answers `store` and
// records what it was asked to keep. With no `store`, the PDF cannot be hashed and nothing is kept for it.
function deps(r, over = {}, store = null) {
  const seen = [];
  const asked = [];
  const kept = [];
  const config = fakeConfig();
  const d = { loadConfig: () => config, readEnvNames: () => new Set(['OPENROUTER_API_KEY']),
    runTrace: async (cfg, options) => {
      seen.push({ cfg, options });
      if (r instanceof Error) throw r;
      return r;
    },
    hashFile: (file) => {
      if (!store) throw new Error('ENOENT');
      asked.push(['hash', file]);
      return SHA;
    },
    findReading: (cfg, sha) => {
      asked.push(['find', cfg === config, sha]);
      if (store instanceof Error) throw store;
      return store || { status: 'none' };
    },
    keepReading: (cfg, what) => {
      kept.push(what);
      return { kept: true, superseded: null, record: RECORD };
    },
    today: () => '2026-11-18',
    ...over };
  return { seen, asked, kept, config, d };
}

test('the usage text names the commands', () => {
  assert.match(USAGE, /\n {2}trace <pdf> --out <dir> \[--id <id>\] \[--vlm-file <file>\] \[--no-judge\] \[--budget <usd> --go\] \[--fresh\] \[--json\]\n/);
  assert.match(USAGE, /free unless --budget and --go are given/);
  assert.match(USAGE, /A kept reading of the PDF is used when there is one \(no reading call\); --fresh pays for a new one/);
  assert.match(USAGE, /\n {2}reading show <pdf> /);
  assert.match(USAGE, /\n {2}reading import <pdf> <file> \[--go\] .*dry-run without --go/);
});

test('trace: every option reaches runTrace as it was typed; nothing is defaulted on the way', async () => {
  const full = deps(answer('PASS'));
  const o = io();
  const code = await main(['trace', 'in/plan.pdf', '--out', 'out/run', '--id', 'apt846', '--vlm-file', 'in/reading.json', '--no-judge', '--budget', '0.5', '--go'], o, full.d);
  assert.equal(code, 0);
  assert.equal(full.seen.length, 1);
  assert.equal(full.seen[0].cfg, full.config);
  assert.deepEqual(full.seen[0].options, { pdf: 'in/plan.pdf', outDir: 'out/run', id: 'apt846', vlmFile: 'in/reading.json', judge: false, go: true, budgetUsd: 0.5 });
  // the least that can be typed: no go, no cap, the judge on, the id left to the module
  const bare = deps(DRY);
  assert.equal(await main(['trace', 'in/plan.pdf', '--out', 'out/run'], io(), bare.d), 0);
  assert.deepEqual(bare.seen[0].options, { pdf: 'in/plan.pdf', outDir: 'out/run', id: undefined, vlmFile: undefined, judge: true, go: false, budgetUsd: undefined });
  // no PDF: the first word is an option, so runTrace is told there is none (it answers the usage error)
  const none = deps(new TraceUsageError('a PDF path is needed'));
  const e = io();
  assert.equal(await main(['trace', '--out', 'out/run'], e, none.d), 2);
  assert.equal(none.seen[0].options.pdf, undefined);
  assert.equal(e.stderr.text, 'trace: a PDF path is needed\n');
  assert.equal(e.stdout.text, '');
  // a cap that is not a number is passed on as it is, for the module to refuse
  const nan = deps(new TraceUsageError('the cap must be a number above 0'));
  assert.equal(await main(['trace', 'p.pdf', '--out', 'o', '--budget', 'lots', '--go'], io(), nan.d), 2);
  assert.ok(Number.isNaN(nan.seen[0].options.budgetUsd));
});

test('trace: what it prints, and the exit code of every outcome', async () => {
  const pass = deps(answer('PASS'));
  let o = io();
  assert.equal(await main(['trace', 'p.pdf', '--out', 'o', '--vlm-file', 'r.json', '--no-judge'], o, pass.d), 0);
  assert.equal(o.stdout.text, [
    'outcome: PASS', 'seconds: 71.3', 'paid run: no', 'reading: the file given', 'tool exit code: 0',
    'plan 1: PASS after 1 round(s)',
    '  rooms: 10 (room count 10 of 10), fixtures: 18',
    '  checks: 82, failed: 0',
    '  printed dimensions: 18 checked, 0 failed, the largest 0.82 %',
    '  could not read: 10 line(s); judge: skipped',
    '  plan file: C:/o/plan-1/plan.general.json',
    'spent: $0.0000', 'output folder: C:/o', 'the tool\'s own output: C:/o/auto-trace.log', '',
  ].join('\n'));
  assert.equal(o.stderr.text, '');
  // --json prints the object itself, with where the reading came from
  o = io();
  assert.equal(await main(['trace', 'p.pdf', '--out', 'o', '--json'], o, pass.d), 0);
  assert.deepEqual(JSON.parse(o.stdout.text), { ...answer('PASS'), reading: NO_READING });
  for (const [outcome, code] of [['FAIL', 5], ['NO_PLAN_FOUND', 3], ['BUDGET_REACHED', 4], ['NEEDS_PAID_RUN', 4], ['USAGE', 1], ['STEP_FAILED', 1],
    ['RESULT_UNREADABLE', 1], ['NOT_STARTED', 1], ['TIMEOUT', 1], ['CANCELLED', 1]]) {
    o = io();
    assert.equal(await main(['trace', 'p.pdf', '--out', 'o'], o, deps(answer(outcome, { exit: code })).d), code, outcome);
    assert.equal(code, exitCodeOf(outcome));
    assert.match(o.stdout.text, new RegExp(`^outcome: ${outcome}\\n`));
  }
});

test('trace: a DRY answer names the keys as present or missing, by name only; --json carries no key line', async () => {
  const dry = deps(DRY);
  const o = io({ FAL_KEY: SECRET });
  assert.equal(await main(['trace', 'p.pdf', '--out', 'o'], o, dry.d), 0);
  assert.equal(o.stdout.text, [
    'outcome: DRY',
    'nothing was started and nothing was booked',
    'a paid run would call the vision model: 1 reading(s) and up to 3 run(s) of the judge, about $0.08 in all',
    'to pay: add --budget <usd> --go (a cap above 0 and at most 1); the tool stops before a call that would pass the cap',
    'the engine keeps no reading of this PDF',
    'keys (by name): FAL_KEY: present, OPENROUTER_API_KEY: present', '',
  ].join('\n'));
  assert.equal(o.stdout.text.includes(SECRET) || o.stderr.text.includes(SECRET), false, 'a key value is never printed');
  // neither in the environment nor in the keys file
  const missing = deps(DRY, { readEnvNames: () => new Set() });
  const m = io({});
  assert.equal(await main(['trace', 'p.pdf', '--out', 'o'], m, missing.d), 0);
  assert.match(m.stdout.text, /keys \(by name\): FAL_KEY: missing, OPENROUTER_API_KEY: missing\n$/);
  // a keys file that cannot be read is "missing", not a crash
  const broken = deps(DRY, { readEnvNames: () => { throw new Error('EACCES'); } });
  const b = io({});
  assert.equal(await main(['trace', 'p.pdf', '--out', 'o'], b, broken.d), 0);
  assert.match(b.stdout.text, /FAL_KEY: missing/);
  const j = io({ FAL_KEY: SECRET });
  assert.equal(await main(['trace', 'p.pdf', '--out', 'o', '--json'], j, dry.d), 0);
  assert.deepEqual(JSON.parse(j.stdout.text), { ...DRY, reading: NO_READING });
  assert.equal(j.stdout.text.includes(SECRET), false);
});

test('trace: an option with no value, and an error that is not a usage error, exit 1 with the command\'s name', async () => {
  const d = deps(answer('PASS'));
  for (const argv of [['trace', 'p.pdf', '--out'], ['trace', 'p.pdf', '--out', 'o', '--budget'], ['trace', 'p.pdf', '--out', 'o', '--id', '--go'],
    ['trace', 'p.pdf', '--out', 'o', '--vlm-file', '--no-judge']]) {
    const o = io();
    assert.equal(await main(argv, o, d.d), 1, argv.join(' '));
    assert.match(o.stderr.text, /^trace: --[a-z-]+ needs a value\n$/);
  }
  assert.equal(d.seen.length, 0, 'runTrace was not called');
  const boom = deps(new Error('something else'));
  const o = io();
  assert.equal(await main(['trace', 'p.pdf', '--out', 'o'], o, boom.d), 1);
  assert.equal(o.stderr.text, 'trace: something else\n');
});

// ---------------------------------------------------------------- the store (contract 1.4 §4)
test('(1.4) a kept reading of the PDF is used: the run gets the kept file and the day it was read, and no reading call is made', async () => {
  const s = deps(answer('PASS'), {}, FOUND);
  const o = io();
  assert.equal(await main(['trace', 'in/plan.pdf', '--out', 'o', '--no-judge'], o, s.d), 0);
  assert.deepEqual(s.asked, [['hash', 'in/plan.pdf'], ['find', true, SHA]], 'the store is asked by the hash of the PDF');
  assert.deepEqual(s.seen[0].options, { pdf: 'in/plan.pdf', outDir: 'o', id: undefined, vlmFile: FOUND.file, judge: false, go: false, budgetUsd: undefined, traceDate: '2026-11-06' });
  assert.match(o.stdout.text, /\nreading: from the engine's store \(read 2026-11-06\); no reading call was made\n/);
  assert.equal(s.kept.length, 0, 'a free run keeps nothing');
  // a PAID run with a kept reading: the reading is still the kept one (only the judge can cost), and nothing is kept again
  const p = deps(answer('PASS', { paid: true }), {}, FOUND);
  assert.equal(await main(['trace', 'in/plan.pdf', '--out', 'o', '--budget', '0.5', '--go'], io(), p.d), 0);
  assert.deepEqual([p.seen[0].options.vlmFile, p.seen[0].options.traceDate, p.seen[0].options.go], [FOUND.file, '2026-11-06', true]);
  assert.equal(p.kept.length, 0);
  // a free run with the judge on: the DRY answer of the wrapper, and the line says where the reading would come from
  const dryFound = deps({ ...DRY, wouldCall: { reading: 0, judgeRuns: 3, total: 3, estimateUsd: 0.06, maxBudgetUsd: 1 } }, {}, FOUND);
  const d = io();
  assert.equal(await main(['trace', 'in/plan.pdf', '--out', 'o'], d, dryFound.d), 0);
  assert.match(d.stdout.text, /would call the vision model: 0 reading\(s\) and up to 3 run\(s\) of the judge/);
  assert.match(d.stdout.text, /\nthe reading: from the engine's store \(read 2026-11-06\); a run would make no reading call\n/);
  // --json carries the same fact
  const j = io();
  assert.equal(await main(['trace', 'in/plan.pdf', '--out', 'o', '--no-judge', '--json'], j, deps(answer('PASS'), {}, FOUND).d), 0);
  assert.deepEqual(JSON.parse(j.stdout.text).reading, { from: 'store', store: 'found', readAt: RECORD.readAt, kept: false, superseded: null, notKept: null });
});

test('(1.4) when the kept reading is NOT used: --fresh, a stale one, a bad one, a reading file given; each says which', async () => {
  // --fresh: the store is asked (to say what is there) and not used
  const fresh = deps(DRY, {}, FOUND);
  const o = io();
  assert.equal(await main(['trace', 'in/plan.pdf', '--out', 'o', '--fresh'], o, fresh.d), 0);
  assert.deepEqual([fresh.seen[0].options.vlmFile, 'traceDate' in fresh.seen[0].options], [undefined, false], 'no go: nothing will be asked of the model, so no day is decided');
  assert.match(o.stdout.text, /\nthe engine keeps a reading of this PDF\n/);
  for (const [status, line] of [['stale', /made by another reader \(the reading tool or the model changed since\): it is not used\n/],
    ['bad', /what the engine's store holds for this PDF does not add up: it is not used\n/], ['none', /the engine keeps no reading of this PDF\n/]]) {
    const s = deps(DRY, {}, { status, record: RECORD });
    const x = io();
    assert.equal(await main(['trace', 'in/plan.pdf', '--out', 'o'], x, s.d), 0, status);
    assert.equal(s.seen[0].options.vlmFile, undefined, status);
    assert.match(x.stdout.text, line, status);
  }
  // a reading file given: the store is not asked at all
  const file = deps(answer('PASS'), {}, FOUND);
  assert.equal(await main(['trace', 'in/plan.pdf', '--out', 'o', '--vlm-file', 'mine.json', '--no-judge'], io(), file.d), 0);
  assert.deepEqual(file.asked, []);
  assert.equal(file.seen[0].options.vlmFile, 'mine.json');
  // --fresh with a reading file is a usage mistake: nothing is asked, nothing runs
  const both = deps(answer('PASS'), {}, FOUND);
  const e = io();
  assert.equal(await main(['trace', 'in/plan.pdf', '--out', 'o', '--vlm-file', 'mine.json', '--fresh'], e, both.d), 2);
  assert.match(e.stderr.text, /^trace: --fresh asks the model for a new reading; it cannot go with --vlm-file\n$/);
  assert.deepEqual([both.asked.length, both.seen.length], [0, 0]);
  // no reader today (the reading tool is not there): the engine's trouble, exit 1, nothing runs
  const gone = deps(answer('PASS'), {}, new EngineError('TOOLCHAIN_MISSING', 'the reading tool, or the file that names its model, is not in the pipeline folder'));
  const g = io();
  assert.equal(await main(['trace', 'in/plan.pdf', '--out', 'o'], g, gone.d), 1);
  assert.match(g.stderr.text, /^trace: the reading tool, or the file that names its model, is not in the pipeline folder\n$/);
  assert.equal(gone.seen.length, 0);
});

test('(1.4) a PAID run that made a fresh reading and passed keeps it; nothing else is ever kept', async () => {
  const paidPass = () => answer('PASS', { paid: true, result: { status: 'PASS', spentUsd: 0.0123, plans: [PLAN] } });
  const s = deps(paidPass(), {}, { status: 'none' });
  const o = io();
  assert.equal(await main(['trace', 'in/plan.pdf', '--out', 'o', '--no-judge', '--budget', '0.5', '--go'], o, s.d), 0);
  assert.deepEqual(s.kept, [{ pdfSha256: SHA, readingFile: 'C:/o/plan-1/vlm.json', source: 'paid', costUsd: null, planDate: '2026-11-18' }],
    'the reading of the run\'s own folder, under the PDF\'s hash; this fake folder holds no file to read a cost from');
  // the day of the plan is decided by the command BEFORE the tool starts, and the same day goes into the record
  assert.equal(s.seen[0].options.traceDate, '2026-11-18');
  assert.equal(s.kept[0].planDate, s.seen[0].options.traceDate);
  assert.match(o.stdout.text, /\nreading: from the model, kept in the engine's store\n/);
  // --fresh although one is kept: a new reading, and the old one is moved aside by the store
  const again = deps(paidPass(), { keepReading: () => ({ kept: true, superseded: 2, record: RECORD }) }, FOUND);
  const a = io();
  assert.equal(await main(['trace', 'in/plan.pdf', '--out', 'o', '--no-judge', '--budget', '0.5', '--go', '--fresh'], a, again.d), 0);
  assert.equal(again.seen[0].options.vlmFile, undefined);
  assert.match(a.stdout.text, /\nreading: from the model, kept in the engine's store \(the one before it is in superseded\/2\)\n/);
  // never kept: a paid run that FAILED its check; a paid run of two plans; a free run; a run from a file; a run that could not hash its PDF
  const not = [
    [answer('FAIL', { paid: true, exit: 5 }), ['--budget', '0.5', '--go'], { status: 'none' }, 5],
    [answer('PASS', { paid: true, result: { status: 'PASS', spentUsd: 0.02, plans: [PLAN, { ...PLAN, k: 2 }] } }), ['--budget', '0.5', '--go'], { status: 'none' }, 0],
    [answer('PASS'), ['--no-judge'], { status: 'none' }, 0],
    [paidPass(), ['--vlm-file', 'mine.json', '--budget', '0.5', '--go'], { status: 'none' }, 0],
    [paidPass(), ['--budget', '0.5', '--go'], null, 0],
    [answer('STEP_FAILED', { paid: true, exit: 1 }), ['--budget', '0.5', '--go'], { status: 'none' }, 1],
  ];
  for (const [r, extra, store, code] of not) {
    const n = deps(r, {}, store);
    assert.equal(await main(['trace', 'in/plan.pdf', '--out', 'o', ...extra], io(), n.d), code, extra.join(' '));
    assert.equal(n.kept.length, 0, `${r.outcome} ${extra.join(' ')}`);
  }
});

test('(1.4) a reading that was paid for and could not be kept: said loudly, with how to keep it, and exit 1', async () => {
  const s = deps(answer('PASS', { paid: true }), { keepReading: () => { throw new ReadingError('STORE', 'the store holds something that is not a folder where this PDF\'s readings belong; it is never overwritten'); } }, { status: 'bad' });
  const o = io();
  assert.equal(await main(['trace', 'in/plan.pdf', '--out', 'o', '--no-judge', '--budget', '0.5', '--go'], o, s.d), 1);
  assert.match(o.stdout.text, /^outcome: PASS\n/);
  assert.match(o.stdout.text, /\nreading: from the model, NOT KEPT \(the store holds something that is not a folder .*never overwritten\)\n {2}it is in this run's folder: keep it with {2}reading import <pdf> C:\/o\/plan-1\/vlm\.json --go\n/);
  // an error of another kind is not echoed: a fixed sentence
  const x = deps(answer('PASS', { paid: true }), { keepReading: () => { throw new Error('EPERM: C:/secret/path'); } }, { status: 'none' });
  const xo = io();
  assert.equal(await main(['trace', 'in/plan.pdf', '--out', 'o', '--no-judge', '--budget', '0.5', '--go', '--json'], xo, x.d), 1);
  const j = JSON.parse(xo.stdout.text);
  assert.deepEqual([j.outcome, j.reading.kept, j.reading.notKept], ['PASS', false, 'the store could not be written']);
  assert.equal(xo.stdout.text.includes('secret'), false);
});
