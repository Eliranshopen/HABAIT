// The engine's ONE way to start the reading tool (contract 1.2): pipeline/Habait/tour360/tools/auto-trace.mjs,
// brought from git as it is, turns a sales-plan PDF into a measured plan. Nothing else in the engine starts it.
//
// Three rules live here, each at one place, so no caller can forget them:
//   1. A run costs nothing unless it was told to pay (decide): PAID only with go AND a cap. A free run gives the
//      tool a budget of 0, a fixed word in place of a key and an env root with no keys file, so the tool's own
//      budget check refuses every call, by exit code (contract 1.3 §2).
//   2. A result is read only from the folder this run created, and only when it names this run (readTraceResult).
//   3. Nothing returned, thrown, printed or logged carries text taken from the PDF: the tool's own output goes
//      to a log file in the output folder, and the result is built field by field from numbers, fixed words
//      and paths the engine put together itself.
import fs from 'node:fs';
import path from 'node:path';
import { spawn as nodeSpawn } from 'node:child_process';
import { pipelineEnv } from './config.mjs';
import { KILL_WAIT_MS, killTree, startAndWait } from './lib/tool.mjs';

// Stopping a tool's whole tree is the same for every wrapper (lib/tool.mjs); the names stay here for the callers
// and tests that learned them from this module.
export { KILL_WAIT_MS, killTree };

export class TraceUsageError extends Error {
  constructor(message, what = null) {
    super(message);
    this.name = 'TraceUsageError';
    this.code = 'TRACE_USAGE';
    this.what = what;              // 'OUT_PATH' = the output folder's path is one the tool cannot write to
  }
}

export const TRACE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;    // never a leading "-": the tool would read it as a flag
export const DEFAULT_TRACE_ID = 'apt-new';            // the tool's own default
export const CALL_ESTIMATE_USD = 0.02;                // what the tool reserves for one vision call
// What a free run gives the tool under the fal key's name: not a key. With it the tool passes its own «is there
// a key» question and reaches its budget check, which refuses every vision call with exit 4 (the budget is 0)
// before any request is made. So the engine learns «this needs a paid run» from an exit code, never from the
// tool's log (contract 1.3 §2; review of 1.2, O-6).
export const FREE_RUN_WORD = 'free-run-no-key';
export const FREE_RUN_NAME = 'FAL_KEY';
const NOT_ASCII = /[^\x20-\x7E]/;       // a character outside printable ASCII
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/;

// The tool's exit codes (its own header), by the name the engine gives each.
export const EXIT_OUTCOMES = Object.freeze({ 0: 'PASS', 5: 'FAIL', 3: 'NO_PLAN_FOUND', 4: 'BUDGET_REACHED', 2: 'USAGE' });

const fwd = (p) => String(p).replace(/\\/g, '/');
const abs = (p) => fwd(path.resolve(String(p)));
const pathKey = (p) => (process.platform === 'win32' ? abs(p).toLowerCase() : abs(p));
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export const toolPath = (config) => `${fwd(config.pipelineRoot)}/Habait/tour360/tools/auto-trace.mjs`;

// A real calendar day written YYYY-MM-DD (contract 1.4 §3): what the tool may be handed as the date of a plan.
export function isDate(v) {
  if (typeof v !== 'string' || !DATE_RE.test(v)) return false;
  const t = Date.parse(`${v}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === v;
}

// An instant as the reading tool and the engine write one (ISO, UTC), and a real one.
// A REAL one: what the clock reads back is what was written (24:00:00 and the 31st of February are read back as
// another moment, and are refused).
export function isInstant(v) {
  if (typeof v !== 'string' || !INSTANT_RE.test(v)) return false;
  const t = Date.parse(v);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 19) === v.slice(0, 19);
}

function statOf(fs_, p) {
  try {
    return fs_.statSync(p);
  } catch {
    return null;
  }
}

function readJsonObject(fs_, file) {
  try {
    const doc = JSON.parse(fs_.readFileSync(file, 'utf8'));
    return doc && typeof doc === 'object' && !Array.isArray(doc) ? doc : null;
  } catch {
    return null;
  }
}

// What a run is: every value checked, every path absolute, and whether it may pay (contract 1.2 §1, §2).
// Throws TraceUsageError; creates nothing.
export function decide(config, options = {}, fs_ = fs) {
  const { pdf, outDir, vlmFile, id = DEFAULT_TRACE_ID, judge = true, go = false, budgetUsd, traceDate } = options;
  if (typeof pdf !== 'string' || pdf === '') throw new TraceUsageError('a PDF path is needed');
  if (typeof outDir !== 'string' || outDir === '') throw new TraceUsageError('an output folder is needed (--out)');
  if (typeof id !== 'string' || !TRACE_ID_RE.test(id)) throw new TraceUsageError('the id must be 1 to 64 letters, digits, "_" or "-", and start with a letter or a digit');
  const o = { pdf: abs(pdf), outDir: abs(outDir), id, vlmFile: null, judge: judge !== false, go: go === true, budgetUsd: null, paid: false, traceDate: null };
  if (traceDate !== undefined && traceDate !== null) {
    if (!isDate(traceDate)) throw new TraceUsageError('the date of the plan must be a real day written YYYY-MM-DD');
    o.traceDate = traceDate;
  }
  if (!statOf(fs_, o.pdf)?.isFile()) throw new TraceUsageError('the PDF is not a file');
  if (vlmFile !== undefined && vlmFile !== null) {
    if (typeof vlmFile !== 'string' || vlmFile === '') throw new TraceUsageError('the saved reading must be a file path');
    o.vlmFile = abs(vlmFile);
    if (!statOf(fs_, o.vlmFile)?.isFile()) throw new TraceUsageError('the saved reading is not a file');
    const reading = readJsonObject(fs_, o.vlmFile);
    if (!reading) throw new TraceUsageError('the saved reading is not a JSON object');
    // The same reading must give the same plan on every day (contract 1.4 §3): with no date from the caller, the
    // plan gets the day the reading itself says it was made. A reading that carries none gets the day of the run.
    if (o.traceDate === null && isInstant(reading._meta?.at)) o.traceDate = reading._meta.at.slice(0, 10);
  }
  // The tool's raster step cannot open its own image under a path with letters outside ASCII (review of 1.2, O-1).
  if (NOT_ASCII.test(o.outDir)) throw new TraceUsageError('the path of the output folder has characters outside ASCII: the reading tool cannot write its images there', 'OUT_PATH');
  const st = statOf(fs_, o.outDir);
  if (st && !st.isDirectory()) throw new TraceUsageError('the output folder is not a folder');
  if (st && fs_.readdirSync(o.outDir).length > 0) throw new TraceUsageError('the output folder is not empty: a run needs a folder of its own');
  const max = config.trace.maxBudgetUsd;
  if (budgetUsd !== undefined && budgetUsd !== null) {
    if (typeof budgetUsd !== 'number' || !Number.isFinite(budgetUsd) || budgetUsd <= 0) throw new TraceUsageError('the cap must be a number above 0');
    if (budgetUsd > max) throw new TraceUsageError(`the cap is above the most a reading may be allowed (${max})`);
    o.budgetUsd = budgetUsd;
  }
  if (o.go && o.budgetUsd === null) throw new TraceUsageError('a paid run needs a cap (--budget <usd>) together with --go');
  o.paid = o.go && o.budgetUsd !== null;
  return o;
}

// The vision calls a run of these options would make, as far as it can be known before the run.
export function plannedCalls(config, o) {
  const reading = o.vlmFile ? 0 : 1;
  const judgeRuns = o.judge ? config.trace.judgeRuns : 0;
  const total = reading + judgeRuns;
  return { reading, judgeRuns, total, estimateUsd: Number((total * CALL_ESTIMATE_USD).toFixed(2)), maxBudgetUsd: config.trace.maxBudgetUsd };
}

// The command, for a decided run. `baseEnv` is the caller's environment.
export function traceCommand(config, o, baseEnv = process.env) {
  const args = [toolPath(config), o.pdf, '--out', o.outDir, '--id', o.id];
  if (o.vlmFile) args.push('--vlm-file', o.vlmFile);
  if (!o.judge) args.push('--no-judge');
  args.push('--rounds', String(config.trace.rounds));
  if (o.traceDate) args.push('--trace-date', o.traceDate);      // a checked day: digits and hyphens, never read as a flag
  const env = { ...baseEnv, ...pipelineEnv(config), PYTHONIOENCODING: 'utf-8' };
  if (o.paid) {
    args.push('--budget', String(o.budgetUsd), '--env-root', fwd(config.envRoot), '--ledger', `${o.outDir}/ledger.json`);
  } else {
    // A free run cannot pay: a budget of 0, an env root with no keys file, and no real key in the environment
    // (every key name of the settings is taken out, then the fixed word is put under the fal name).
    args.push('--budget', '0', '--env-root', o.outDir);
    const names = new Set([...config.keys, FREE_RUN_NAME].map((k) => k.toUpperCase()));       // Windows reads a name in any case
    for (const k of Object.keys(env)) if (names.has(k.toUpperCase())) delete env[k];
    env[FREE_RUN_NAME] = FREE_RUN_WORD;
  }
  return { command: process.execPath, args, cwd: fwd(config.pipelineRoot), env };
}

// One plan of a result, field by field: numbers, fixed words and paths the engine builds. Nothing is copied
// from the tool's text fields (labels, room names, failure lines, could-not-read lines).
function planSummary(k, row, check, report, dir) {
  const checks = Array.isArray(check.checks) ? check.checks.filter((c) => c && typeof c === 'object') : [];
  const dims = checks.filter((c) => c.check === 'dims');
  const pcts = dims.map((c) => num(c.pct)).filter((v) => v !== null);
  const count = checks.find((c) => c.check === 'room_count');
  const judge = check.judge && typeof check.judge === 'object' ? check.judge : {};
  const skipped = typeof judge.unavailable === 'string' && judge.unavailable.startsWith('judge skipped');
  return {
    k,
    page: num(row.page),
    status: check.status,
    rounds: num(check.round),
    rooms: num(report.rooms),
    fixtures: num(report.fixtures),
    scalePxPerCm: num(report.scale_px_per_cm),
    checks: { total: num(check.n_checks), failed: num(check.n_failed) },
    roomCount: { expected: num(count?.expected), got: num(count?.got) },
    dims: { count: dims.length, failed: dims.filter((c) => c.pass !== true).length, maxPct: pcts.length ? Math.max(...pcts) : null },
    couldNotRead: Array.isArray(report.could_not_read) ? report.could_not_read.length : 0,
    judge: { state: skipped ? 'skipped' : (judge.unavailable ? 'unavailable' : 'report'), runs: num(judge.runs), mismatches: Array.isArray(judge.mismatches) ? judge.mismatches.length : 0 },
    files: { dir, plan: `${dir}/plan.general.json`, overlay: `${dir}/overlay.png`, report: `${dir}/report.json`, traceCheck: `${dir}/trace-check.json` },
  };
}

// The result of the run `o`, or null when the folder does not hold THIS run's result (contract 1.2 §3).
export function readTraceResult(o, fs_ = fs) {
  const index = readJsonObject(fs_, `${o.outDir}/index.json`);
  if (!index) return null;
  if (typeof index.input !== 'string' || pathKey(index.input) !== pathKey(o.pdf) || index.id !== o.id) return null;
  if ((index.status !== 'PASS' && index.status !== 'FAIL') || !Array.isArray(index.plans)) return null;
  const plans = [];
  for (const row of index.plans) {
    if (!row || typeof row !== 'object' || typeof row.dir !== 'string') return null;
    const m = /^plan-(\d{1,4})$/.exec(path.basename(fwd(row.dir)));
    if (!m) return null;
    const dir = `${o.outDir}/plan-${Number(m[1])}`;          // built here, never copied from the file
    if (pathKey(row.dir) !== pathKey(dir)) return null;
    const check = readJsonObject(fs_, `${dir}/trace-check.json`);
    const report = readJsonObject(fs_, `${dir}/report.json`);
    if (!check || !report || (check.status !== 'PASS' && check.status !== 'FAIL')) return null;
    plans.push(planSummary(Number(m[1]), row, check, report, dir));
  }
  const all = plans.length > 0 && plans.every((p) => p.status === 'PASS') ? 'PASS' : 'FAIL';
  if (all !== index.status) return null;            // the index and the plans' own check files must agree
  return { status: index.status, spentUsd: num(index.spent_usd), plans };
}

// Run the reading tool once. → { outcome, exit, seconds, paid, outDir, logFile, result } (contract 1.2 §3, §4);
// a DRY answer also carries `wouldCall`. Throws TraceUsageError for a caller's mistake, before anything starts.
export async function runTrace(config, options = {}, deps = {}) {
  const d = { fs, spawn: nodeSpawn, killTree, clock: () => Date.now(), env: process.env, killWaitMs: KILL_WAIT_MS, ...deps };
  const o = decide(config, options, d.fs);
  const calls = plannedCalls(config, o);
  if (!o.paid && calls.total > 0) {
    return { outcome: 'DRY', exit: null, seconds: 0, paid: false, outDir: o.outDir, logFile: null, result: null, wouldCall: calls };
  }
  if (options.signal?.aborted) {        // cancelled before it began: nothing is created
    return { outcome: 'CANCELLED', exit: null, seconds: 0, paid: o.paid, outDir: o.outDir, logFile: null, result: null };
  }
  try {
    d.fs.mkdirSync(o.outDir, { recursive: true });
  } catch {
    throw new TraceUsageError('the output folder cannot be created');
  }
  const logFile = `${o.outDir}/auto-trace.log`;
  const started = d.clock();
  const ended = await startAndWait(traceCommand(config, o, d.env), logFile,
    { timeoutMs: config.trace.timeoutSeconds * 1000, signal: options.signal, killWaitMs: d.killWaitMs }, d);
  const base = { exit: ended.code, seconds: Number(((d.clock() - started) / 1000).toFixed(1)), paid: o.paid, outDir: o.outDir, logFile };
  if (ended.why === 'not-started') return { ...base, outcome: 'NOT_STARTED', result: null };
  if (ended.why === 'timeout') return { ...base, outcome: 'TIMEOUT', result: null };
  if (ended.why === 'cancelled') return { ...base, outcome: 'CANCELLED', result: null };
  let outcome = EXIT_OUTCOMES[ended.code] || 'STEP_FAILED';
  // On a free run the budget is 0, so «budget reached» means the tool met a vision call it was not allowed to make.
  if (!o.paid && outcome === 'BUDGET_REACHED') outcome = 'NEEDS_PAID_RUN';
  let result = null;
  if (outcome === 'PASS' || outcome === 'FAIL') {
    result = readTraceResult(o, d.fs);
    if (!result || result.status !== outcome) {
      outcome = 'RESULT_UNREADABLE';
      result = null;
    }
  }
  return { ...base, outcome, result };
}

// The exit code of the command for an outcome (contract 1.2 §6).
export function exitCodeOf(outcome) {
  if (outcome === 'PASS' || outcome === 'DRY') return 0;
  if (outcome === 'FAIL') return 5;
  if (outcome === 'NO_PLAN_FOUND') return 3;
  if (outcome === 'BUDGET_REACHED' || outcome === 'NEEDS_PAID_RUN') return 4;
  return 1;
}

// What the command prints: one line per fact. `keys` = the readiness command's line about the key names.
// The fixed words for what the store said about a PDF (contract 1.4 §1). Never a word of a reading.
const STORE_LINES = Object.freeze({
  found: 'the engine keeps a reading of this PDF',
  none: 'the engine keeps no reading of this PDF',
  stale: 'the engine keeps a reading of this PDF made by another reader (the reading tool or the model changed since): it is not used',
  bad: 'what the engine\'s store holds for this PDF does not add up: it is not used',
});

// Where the reading of this run came from (contract 1.4 §4): `reading` = { from, store, readAt, kept, superseded, notKept }.
function readingLines(r, reading) {
  if (!reading) return [];
  const day = typeof reading.readAt === 'string' ? reading.readAt.slice(0, 10) : null;
  if (r.outcome === 'DRY') {
    if (reading.from === 'store') return [`the reading: from the engine's store (read ${day}); a run would make no reading call`];
    return reading.store && STORE_LINES[reading.store] ? [STORE_LINES[reading.store]] : [];
  }
  if (reading.from === 'store') return [`reading: from the engine's store (read ${day}); no reading call was made`];
  if (reading.from === 'file') return ['reading: the file given'];
  if (reading.notKept) {
    return [`reading: from the model, NOT KEPT (${reading.notKept})`,
      `  it is in this run's folder: keep it with  reading import <pdf> ${r.outDir}/plan-1/vlm.json --go`];
  }
  if (reading.kept) return [`reading: from the model, kept in the engine's store${reading.superseded ? ` (the one before it is in superseded/${reading.superseded})` : ''}`];
  return ['reading: from the model'];
}

export function formatTrace(r, { keys = '', reading = null } = {}) {
  const lines = [`outcome: ${r.outcome}`];
  if (r.outcome === 'DRY') {
    const w = r.wouldCall;
    lines.push('nothing was started and nothing was booked',
      `a paid run would call the vision model: ${w.reading} reading(s) and up to ${w.judgeRuns} run(s) of the judge, about $${w.estimateUsd.toFixed(2)} in all`,
      `to pay: add --budget <usd> --go (a cap above 0 and at most ${w.maxBudgetUsd}); the tool stops before a call that would pass the cap`);
    lines.push(...readingLines(r, reading));
    if (keys) lines.push(`keys (by name): ${keys}`);
    return lines.join('\n');
  }
  lines.push(`seconds: ${r.seconds}`, `paid run: ${r.paid ? 'yes' : 'no'}`);
  lines.push(...readingLines(r, reading));
  if (r.exit !== null) lines.push(`tool exit code: ${r.exit}`);
  for (const p of r.result?.plans || []) {
    lines.push(`plan ${p.k}: ${p.status} after ${p.rounds ?? '?'} round(s)`,
      `  rooms: ${p.rooms ?? '?'} (room count ${p.roomCount.got ?? '?'} of ${p.roomCount.expected ?? '?'}), fixtures: ${p.fixtures ?? '?'}`,
      `  checks: ${p.checks.total ?? '?'}, failed: ${p.checks.failed ?? '?'}`,
      `  printed dimensions: ${p.dims.count} checked, ${p.dims.failed} failed, the largest ${p.dims.maxPct ?? '?'} %`,
      `  could not read: ${p.couldNotRead} line(s); judge: ${p.judge.state}${p.judge.state === 'report' ? `, ${p.judge.mismatches} mismatch(es)` : ''}`,
      `  plan file: ${p.files.plan}`);
  }
  if (r.result) lines.push(`spent: $${(r.result.spentUsd ?? 0).toFixed(4)}`);
  lines.push(`output folder: ${r.outDir}`);
  if (r.logFile) lines.push(`the tool's own output: ${r.logFile}`);
  return lines.join('\n');
}
