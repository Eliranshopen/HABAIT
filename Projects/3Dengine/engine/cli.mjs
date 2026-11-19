// The engine's command line. Commands that change the disk are dry runs unless --go is given.
import { loadConfig, pipelineEnv } from './config.mjs';
import { runDoctor, formatReport, checkKeys, readEnvNames } from './doctor.mjs';
import { planEnv, applyEnv } from './setup/env.mjs';
import { planAssets, applyAssets } from './setup/assets.mjs';
import { isMain } from './lib/main.mjs';
import { readJob, formatJob, STAGES } from './jobs.mjs';
import { startServe } from './serve.mjs';
import { shownJob, isStalled, startOrResume, spawnRunnerDefault, runnerAlive } from './control.mjs';
import { readManifest, readOwnJob, listOwnJobs } from './manifest.mjs';
import { readLedger, ledgerTotals, formatLedger } from './ledger.mjs';
import { runTrace, formatTrace, exitCodeOf, TraceUsageError } from './trace.mjs';
import { findReading, keepReading, readingCost, supersededCount, isReading, ReadingError } from './readings.mjs';
import { EngineError } from './inbox.mjs';
import { sha256FileSync } from './lib/hash.mjs';
import fs from 'node:fs';

export { isMain };

export const USAGE = [
  'usage: node engine/cli.mjs <command>',
  '  doctor [--json]                 readiness report (exit 0 = ready, or ready except keys)',
  '  env                             the pipeline pointers as NAME=path lines (never keys)',
  '  setup-env [--go]                Python venv + pinned libraries + Node libraries',
  '  bring-assets [--from <dir>] [--go]   copy the sealed render assets from a backup copy',
  '  job <job_id> [--json]           one job: its stages and manifest rows, the ledger, STALLED (exit 1 when there is no such job)',
  '  jobs [--json]                   the newest jobs',
  '  resume <job_id>                 start a runner for a stalled job, or restart a cancelled / failed / review one',
  '  ledger <job_id> [--json]        the paid calls of a job: reserved, settled, failed, orphaned',
  '  trace <pdf> --out <dir> [--id <id>] [--vlm-file <file>] [--no-judge] [--budget <usd> --go] [--fresh] [--json]',
  '                                  read a sales-plan PDF into a measured plan; free unless --budget and --go are given.',
  '                                  A kept reading of the PDF is used when there is one (no reading call); --fresh pays for a new one',
  '  reading show <pdf>              what the engine keeps as the reading of this PDF (exit 0 when one is kept and still valid)',
  '  reading import <pdf> <file> [--go]   keep a reading a hand has as the reading of this PDF (dry-run without --go)',
  '  serve --root <dir> [--port N] [--host H]   static server for a folder (foreground)',
  '  mcp                             the MCP server on stdio (habait-engine)',
  '  help                            this text',
].join('\n');

const runMcp = async (opts) => (await import('../mcp/server.mjs')).runStdio(opts);

const DEFAULT_DEPS = { loadConfig, runDoctor, planEnv, applyEnv, planAssets, applyAssets, startServe, runMcp,
  spawnRunner: spawnRunnerDefault, isRunnerAlive: runnerAlive, runTrace, readEnvNames, findReading, keepReading, hashFile: sha256FileSync,
  today: () => new Date().toISOString().slice(0, 10) };

function optValue(argv, name) {
  const i = argv.indexOf(name);
  if (i < 0) return undefined;
  const v = argv[i + 1];
  if (!v || v.startsWith('--')) throw new Error(`${name} needs a value`);
  return v;
}

const human = (n) => (n >= 1 << 30 ? `${(n / (1 << 30)).toFixed(2)} GB` : `${(n / (1 << 20)).toFixed(1)} MB`);

async function doctor(argv, io, d, config) {
  const result = await d.runDoctor(config);
  io.stdout.write((argv.includes('--json') ? JSON.stringify(result, null, 2) : formatReport(result)) + '\n');
  return result.ready || result.ready_except_keys ? 0 : 1;
}

function env(argv, io, d, config) {
  for (const [k, v] of Object.entries(pipelineEnv(config))) io.stdout.write(`${k}=${v}\n`);
  return 0;
}

async function setupEnv(argv, io, d, config) {
  const plan = d.planEnv(config);
  for (const s of plan.steps) io.stdout.write(`${s.needed ? 'needed ' : 'ok     '}${s.id.padEnd(6)}${s.cmd} ${s.args.join(' ')}\n`);
  if (!plan.steps.some((s) => s.needed)) {
    io.stdout.write('nothing to do\n');
    return 0;
  }
  if (!argv.includes('--go')) {
    io.stdout.write('dry run: pass --go to run the needed steps\n');
    return 0;
  }
  const r = d.applyEnv(plan, config);
  if (!r.ok) {
    io.stderr.write(`setup-env failed: ${r.reason}\n`);
    return 1;
  }
  io.stdout.write(`done: ${r.ran.join(', ')}\n`);
  return 0;
}

async function bringAssets(argv, io, d, config) {
  const from = optValue(argv, '--from') || config.assets.source;
  const plan = await d.planAssets(config, { from });
  const by = (s) => plan.entries.filter((e) => e.state === s);
  const copy = by('copy');
  const missing = by('missing-in-source');
  io.stdout.write(`from ${plan.from}\npresent ${by('present').length} · copy ${copy.length} ` +
    `(${human(copy.reduce((n, e) => n + e.bytes, 0))}) · missing-in-source ${missing.length}\n`);
  for (const e of missing) io.stdout.write(`missing-in-source ${e.id}\n`);
  if (!argv.includes('--go')) {
    if (missing.length) {
      io.stderr.write(`bring-assets: ${missing.length} entries are missing in the source\n`);
      return 1;
    }
    io.stdout.write(copy.length ? 'dry run: pass --go to copy\n' : 'nothing to do\n');
    return 0;
  }
  const r = await d.applyAssets(plan, config);
  io.stdout.write(`copied ${r.copied} · present ${r.present} · failed ${r.failed.length}\n`);
  if (r.failed.length) {
    io.stderr.write(`bring-assets failed: ${r.failed.map((f) => `${f.id} (${f.reason})`).join('; ')}\n`);
    return 1;
  }
  return 0;
}

function jobArg(argv, cmd) {
  const id = argv.find((a) => !a.startsWith('--'));
  if (!id) throw new Error(`${cmd} needs a job_id`);
  return id;
}

const shown = (config, j, d) => shownJob(config, j, { isAlive: d.isRunnerAlive });
const lineOf = (j) => `${formatJob(j)}${isStalled(j) ? ' · STALLED' : ''}`;

// The job, its runner, its stages with their manifest rows, the ledger total and the orphaned rows.
export function formatJobDetail(j, manifest, ledger) {
  const lines = [lineOf(j)];
  const r = j.runner;
  lines.push(r.alive ? `runner: alive, pid ${r.pid}, heartbeat ${r.heartbeat_age_s} s ago`
    : `runner: not alive${isStalled(j) ? ' - STALLED: the job is in a working state and nothing moves it (engine resume)' : ''}`);
  if (j.waiting_for) lines.push(`waiting for: ${j.waiting_for}`);
  lines.push('stages:');
  for (const stage of STAGES) {
    const rows = manifest.rows.filter((x) => x.stage === stage);
    const now = j.state === stage ? '  <- now' : '';
    const tries = j.attempts?.[stage] ?? 0;
    if (!rows.length) lines.push(`  ${stage.padEnd(10)} ${tries ? `started ${tries}x, no row` : '-'}${now}`);
    for (const x of rows) {
      lines.push(`  ${stage.padEnd(10)} ${x.status} attempt ${x.attempt}  ${x.seconds} s  $${x.cost_usd}  ${x.finished_at}  pid ${x.runner_pid}` +
        `${x.superseded ? '  (superseded)' : ''}${now}`);
    }
  }
  const t = ledgerTotals(ledger);
  lines.push(`ledger: settled $${t.settled_usd} · held $${t.held_usd} · ${ledger.rows.length} row(s)`);
  for (const o of t.orphaned) {
    lines.push(`  ORPHANED #${o.seq} ${o.stage} attempt ${o.attempt}: $${o.reserved_usd} reserved, outcome unknown (counts toward the cap)`);
  }
  return lines.join('\n');
}

function mustRead(config, id, io) {
  const raw = readJob(config.jobsDir, id);
  if (!raw) io.stderr.write(`job ${id}: not found\n`);
  return raw;
}

// The ledger and the manifest of a job, for the commands that print them. A file that is damaged (cut
// short, not JSON, another shape) is named in the error instead of a parser's message.
function readBooks(config, id, raw) {
  try {
    const ledger = readLedger(config.jobsDir, id, raw.cost?.cap_usd ?? null);
    const manifest = readManifest(config.jobsDir, id);
    ledgerTotals(ledger);
    if (!Array.isArray(manifest.rows)) throw new Error('manifest.json has no rows');
    return { ledger, manifest };
  } catch (e) {
    throw new Error(`ledger.json or manifest.json of job ${id} cannot be read (${e.message}); "job ${id} --json" still prints the job file`);
  }
}

function job(argv, io, d, config) {
  const id = jobArg(argv, 'job');
  const raw = mustRead(config, id, io);
  if (!raw) return 1;
  const j = shown(config, raw, d);
  if (argv.includes('--json')) {
    io.stdout.write(JSON.stringify(j, null, 2) + '\n');
    return 0;
  }
  const books = readBooks(config, id, raw);
  io.stdout.write(formatJobDetail(j, books.manifest, books.ledger) + '\n');
  return 0;
}

function jobs(argv, io, d, config) {
  const list = listOwnJobs(config.jobsDir, 10).map((j) => shown(config, j, d));
  if (argv.includes('--json')) io.stdout.write(JSON.stringify({ jobs: list }, null, 2) + '\n');
  else io.stdout.write(list.length ? list.map(lineOf).join('\n') + '\n' : 'no jobs\n');
  return 0;
}

// Both files of the job are read (contract 1.1 §5): a job.json or a manifest.json that is not this job's
// throws, `main` prints the job and the reason and exits 1, and no runner is started.
function resume(argv, io, d, config) {
  const id = jobArg(argv, 'resume');
  const raw = readOwnJob(config.jobsDir, id);
  if (!raw) {
    io.stderr.write(`job ${id}: not found\n`);
    return 1;
  }
  const r = startOrResume(config, raw, { spawnRunner: d.spawnRunner, isRunnerAlive: d.isRunnerAlive });
  io.stdout.write(r.resumed ? `resumed: ${id} in "${r.job.state}", a runner was started\n`
    : `not resumed: ${id} is "${r.job.state}"${r.job.state === 'done' ? '' : ' and its runner is alive'}\n`);
  return 0;
}

function ledger(argv, io, d, config) {
  const id = jobArg(argv, 'ledger');
  const raw = mustRead(config, id, io);
  if (!raw) return 1;
  const doc = readBooks(config, id, raw).ledger;
  io.stdout.write((argv.includes('--json') ? JSON.stringify(doc, null, 2) : formatLedger(doc)) + '\n');
  return 0;
}

// The reading tool, once (contract 1.2 §6). Free unless --budget and --go are given; a configuration that would
// need a vision call and was not told to pay answers DRY and starts nothing.
// Since 1.4 (contract 1.4 §4) the command asks the store first: a kept reading of this PDF by today's reader is
// used and no reading call is made; a PAID run that made a fresh reading and passed keeps it.
async function trace(argv, io, d, config) {
  const budget = optValue(argv, '--budget');
  const pdf = argv[0] && !argv[0].startsWith('--') ? argv[0] : undefined;
  const given = optValue(argv, '--vlm-file');
  const fresh = argv.includes('--fresh');
  // Where the reading comes from, and what the store said. Never a word of the reading itself.
  const reading = { from: given ? 'file' : 'model', store: null, readAt: null, kept: false, superseded: null, notKept: null };
  let pdfSha = null;
  let planDate = null;
  let r;
  try {
    if (given && fresh) throw new TraceUsageError('--fresh asks the model for a new reading; it cannot go with --vlm-file');
    const options = { pdf, outDir: optValue(argv, '--out'), id: optValue(argv, '--id'), vlmFile: given, judge: !argv.includes('--no-judge'),
      go: argv.includes('--go'), budgetUsd: budget === undefined ? undefined : Number(budget) };
    if (!given && pdf) {
      try {
        pdfSha = d.hashFile(pdf);
      } catch {
        pdfSha = null;                 // not a file: the wrapper says so below, as a usage mistake
      }
      const kept = pdfSha ? d.findReading(config, pdfSha) : { status: 'none' };
      reading.store = kept.status;
      if (kept.status === 'found' && !fresh) {
        options.vlmFile = kept.file;
        options.traceDate = kept.record.date;
        reading.from = 'store';
        reading.readAt = kept.record.readAt;
      }
    }
    // A paid run that will ask the model: the day its plan carries is decided HERE, before the tool starts, and is
    // what the kept record will say. A run that crosses midnight cannot then give a later run another date.
    if (reading.from === 'model' && options.go === true) {
      planDate = d.today();
      options.traceDate = planDate;
    }
    r = await d.runTrace(config, options);
  } catch (e) {
    if (e instanceof EngineError) {       // no reader today: the reading tool is not there
      io.stderr.write(`trace: ${e.message}\n`);
      return 1;
    }
    if (!(e instanceof TraceUsageError)) throw e;
    io.stderr.write(`trace: ${e.message}\n`);
    return 2;
  }
  // A paid run that made a fresh reading and passed keeps it, with what the reading itself says it cost.
  if (reading.from === 'model' && r.paid && r.outcome === 'PASS' && r.result?.plans?.length === 1 && pdfSha) {
    const file = `${r.result.plans[0].files.dir}/vlm.json`;
    try {
      const k = d.keepReading(config, { pdfSha256: pdfSha, readingFile: file, source: 'paid', costUsd: readingCost(file), planDate });
      reading.kept = k.kept;
      reading.readAt = k.record.readAt;
      reading.superseded = k.superseded ?? null;
    } catch (e) {
      // The money is spent and the reading is in the run's own folder: say so, loudly, and how to keep it.
      reading.notKept = e instanceof ReadingError || e instanceof EngineError ? e.message : 'the store could not be written';
    }
  }
  if (argv.includes('--json')) {
    io.stdout.write(JSON.stringify({ ...r, reading }, null, 2) + '\n');
  } else {
    // The key NAMES, present or missing, the way the readiness command says it; never a value.
    const keys = r.outcome === 'DRY' ? checkKeys(config, { readEnvNames: d.readEnvNames, env: io.env || process.env }).detail : '';
    io.stdout.write(formatTrace(r, { keys, reading }) + '\n');
  }
  return reading.notKept ? 1 : exitCodeOf(r.outcome);
}

const STORE_WORDS = Object.freeze({
  found: 'kept, and made by today\'s reader',
  none: 'none',
  stale: 'kept, but made by another reader (the reading tool or the model changed since): not used',
  bad: 'what the store holds for this PDF does not add up: not used',
});

// What the engine keeps as the reading of a PDF (contract 1.4 §4): `reading show <pdf>`, `reading import <pdf> <file> [--go]`.
// Numbers, dates, fixed words and hashes; never a word of a reading.
async function reading(argv, io, d, config) {
  const words = argv.filter((a) => !a.startsWith('--'));
  const [verb, pdf, file] = words;
  const usage = () => {
    io.stderr.write('reading: usage: reading show <pdf> | reading import <pdf> <reading file> [--go]\n');
    return 2;
  };
  if ((verb !== 'show' && verb !== 'import') || !pdf || (verb === 'show' && words.length !== 2) || (verb === 'import' && words.length !== 3)) return usage();
  let pdfSha;
  try {
    pdfSha = d.hashFile(pdf);
  } catch {
    io.stderr.write('reading: the PDF is not a file\n');
    return 2;
  }
  try {
    if (verb === 'show') {
      const r = d.findReading(config, pdfSha);
      const lines = [`pdf sha256: ${pdfSha}`, `kept reading: ${STORE_WORDS[r.status] || r.status}`];
      if (r.record) {
        lines.push(`  read: ${r.record.date} · source: ${r.record.source} · cost: ${r.record.costUsd === null ? 'unknown' : `$${r.record.costUsd.toFixed(4)}`}`
          + ` · model: ${r.record.model ?? 'not named'} · kept by engine ${r.record.engineVersion}`);
      }
      lines.push(`superseded readings: ${supersededCount(config, pdfSha)}`);
      io.stdout.write(lines.join('\n') + '\n');
      return r.status === 'found' ? 0 : 1;
    }
    // import: dry-run unless --go (root §5)
    let doc = null;
    let bytes = 0;
    try {
      const buf = fs.readFileSync(file);
      bytes = buf.length;
      doc = JSON.parse(buf.toString('utf8'));
    } catch {
      doc = null;
    }
    if (!isReading(doc)) {
      io.stderr.write('reading: the file is not a reading (JSON with a list of rooms)\n');
      return 1;
    }
    if (!argv.includes('--go')) {
      io.stdout.write(`dry run: would keep that file (${bytes} bytes, ${doc.rooms.length} rooms) as the reading of the PDF ${pdfSha.slice(0, 12)}…, source imported, cost $0\n`
        + `the store holds now: ${STORE_WORDS[d.findReading(config, pdfSha).status]}\nadd --go to keep it\n`);
      return 0;
    }
    const k = d.keepReading(config, { pdfSha256: pdfSha, readingFile: file, source: 'imported', costUsd: 0 });
    io.stdout.write(k.kept ? `kept: the reading of the PDF ${pdfSha.slice(0, 12)}… (read ${k.record.date})${k.superseded ? `; the one before it is in superseded/${k.superseded}` : ''}\n`
      : `already kept: the same reading by today's reader (read ${k.record.date}, source ${k.record.source})\n`);
    return 0;
  } catch (e) {
    if (!(e instanceof ReadingError || e instanceof EngineError)) throw e;
    io.stderr.write(`reading: ${e.message}\n`);
    return 1;
  }
}

async function serve(argv, io, d, config) {
  const root = optValue(argv, '--root');
  if (!root) throw new Error('serve needs --root <dir>');
  const port = Number(optValue(argv, '--port') || config.serve.port);
  const host = optValue(argv, '--host') || config.serve.host;
  const server = await d.startServe({ root, host, port });
  io.stderr.write(`serving ${root} at http://${host}:${port}/ (pid ${process.pid})\n`);
  await new Promise((resolve) => server.once('close', resolve));
  return 0;
}

async function mcp(argv, io, d, config) {
  return d.runMcp({ config });
}

const COMMANDS = { doctor, env, 'setup-env': setupEnv, 'bring-assets': bringAssets, job, jobs, resume, ledger, trace, reading, serve, mcp };

export async function main(argv, io = { stdout: process.stdout, stderr: process.stderr, env: process.env }, deps = {}) {
  const d = { ...DEFAULT_DEPS, ...deps };
  const [cmd, ...rest] = argv;
  if (cmd === 'help' || cmd === '--help') {
    io.stdout.write(USAGE + '\n');
    return 0;
  }
  const fn = COMMANDS[cmd];
  if (!fn) {
    io.stderr.write(`${cmd ? `unknown command: ${cmd}\n` : ''}${USAGE}\n`);
    return 2;
  }
  try {
    const config = d.loadConfig({ env: io.env || process.env });
    return await fn(rest, io, d, config);
  } catch (e) {
    io.stderr.write(`${cmd}: ${e.message}\n`);
    return 1;
  }
}

if (isMain(process.argv[1], import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
