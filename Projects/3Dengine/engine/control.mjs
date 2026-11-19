// Starting, resuming and restarting a job's runner (contract 0.3 §4, §6), shared by the MCP tools and
// the CLI. A job's runner is `node engine/runner.mjs <job_id>`, DETACHED, holding jobs/<id>/runner.pid.
// `runner` = { alive, pid, heartbeat_age_s } is COMPUTED for get_job / list_jobs / the CLI and never
// written to job.json. A job in a working state whose runner is not alive is STALLED; nothing restarts
// it by itself.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENGINE_VERSION } from './config.mjs';
import { jobDir, readJob, updateJob, setState, isWorking, PRE_APPROVAL_STAGES } from './jobs.mjs';
import { readManifest, readOwnJob, firstInvalidStage } from './manifest.mjs';
import { readLedger, ledgerTotals, syncSpent } from './ledger.mjs';
import { pidAlive, spawnDetached } from './lib/proc.mjs';

export const RUNNER = fileURLToPath(new URL('./runner.mjs', import.meta.url));

// The environment that makes a child process load exactly this config.
export function configEnv(config, base = process.env) {
  return {
    ...base,
    ENGINE_HOME: config.home,
    ENGINE_JOBS_DIR: config.jobsDir,
    ENGINE_SERVE_PORT: String(config.serve.port),
    ENGINE_STUB_STEP_MS: String(config.stub.stepMs),
  };
}

// The stub's tour folder (the result of every stub job).
export const tourDir = (config) => path.posix.join(config.stub.siteRoot, config.stub.tourPath.split('?')[0]).replace(/\/+$/, '');

export const runnerPidFile = (config, id) => `${jobDir(config.jobsDir, id)}/runner.pid`;

export function readRunnerPid(config, id) {
  try {
    const n = Number(fs.readFileSync(runnerPidFile(config, id), 'utf8').trim());
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

// Alive = the pid in runner.pid is a live process AND it gave a recent sign of life (contract 0.3 §10.5):
// a heartbeat in job.json, or the pid file itself (a runner that has just started), not older than
// runner.staleMs. A recycled pid, or a hung process, does not make a dead runner look alive.
export function runnerAlive(config, id, alive = pidAlive, { clock = () => Date.now(), read = readJob } = {}) {
  const pid = readRunnerPid(config, id);
  if (pid === null || !alive(pid)) return false;
  const staleMs = config.runner?.staleMs ?? 10000;
  const fresh = (t) => Number.isFinite(t) && clock() - t <= staleMs;
  let claimed = NaN;
  try {
    claimed = fs.statSync(runnerPidFile(config, id)).mtimeMs;
  } catch { /* gone meanwhile */ }
  if (fresh(claimed)) return true;
  const job = read(config.jobsDir, id);
  return Boolean(job) && fresh(Date.parse(job.heartbeat_at));
}

export function spawnRunnerDefault(config, id) {
  return spawnDetached(RUNNER, [id], { logFile: `${jobDir(config.jobsDir, id)}/runner.log`, env: configEnv(config), cwd: config.home });
}

// { alive, pid, heartbeat_age_s } for a job; `isAlive(config, id)` decides alive.
export function runnerInfo(config, job, { isAlive = runnerAlive, clock = () => Date.now() } = {}) {
  const pid = readRunnerPid(config, job.job_id);
  const beat = Date.parse(job.heartbeat_at);
  return {
    alive: Boolean(isAlive(config, job.job_id)),
    pid,
    heartbeat_age_s: Number.isFinite(beat) ? Math.max(0, Math.round((clock() - beat) / 100) / 10) : null,
  };
}

export const withRunner = (config, job, opts) => ({ ...job, runner: runnerInfo(config, job, opts) });

// What a job has really spent is the ledger's settled total (contract 0.3 §14.1). `cost.spent_usd` in
// job.json is a copy of it. A runner that dies between the ledger write and the copy leaves the copy
// behind, and a job that is done gets no runner to put it right: so every READ of a job by the engine
// (get_job, list_jobs, get_result, the CLI) reports the ledger's total, and puts the copy right when it
// differs. When the copy cannot be written just now (the job lock is busy) the answer is still the true one.
export const READ_REPAIR_WAIT_MS = 50;   // a read does not wait for a busy job lock; the next read repairs
export function withTrueCost(config, job, { read = readLedger, sync = syncSpent } = {}) {
  let spent;
  try {
    spent = ledgerTotals(read(config.jobsDir, job.job_id)).settled_usd;
  } catch {
    return job;   // the ledger cannot be read at this moment: the copy is all there is
  }
  if (job.cost?.spent_usd === spent) return job;
  try {
    sync(config.jobsDir, job.job_id, { waitMs: READ_REPAIR_WAIT_MS });
  } catch { /* the copy stays behind for now; the next read tries again */ }
  return { ...job, cost: { ...job.cost, spent_usd: spent } };
}

// A job as the engine shows it: the true cost and the computed runner.
export const shownJob = (config, job, opts) => withRunner(config, withTrueCost(config, job), opts);

export const isStalled = (job) => isWorking(job.state) && job.runner?.alive === false;

// The state a cancelled / failed / review job restarts in: the first stage with no valid manifest row,
// or awaiting_approval when that stage is a paid one and there is no approval. When every stage has a
// valid row: qa (the runner skips it and writes done).
export function restartState(config, job, { version = ENGINE_VERSION } = {}) {
  const dir = jobDir(config.jobsDir, job.job_id);
  const first = firstInvalidStage(readManifest(config.jobsDir, job.job_id), job, { version, dir });
  if (first === null) return 'qa';
  if (!PRE_APPROVAL_STAGES.includes(first) && !job.approval) return 'awaiting_approval';
  return first;
}

export const RESTARTABLE = Object.freeze(['cancelled', 'failed', 'review']);

// Restart a cancelled / failed / review job in place: reason cleared, state set back (restartState).
// Returns the new job, or null when the job is not (or no longer) restartable.
// Both of the job's files must be its own (contract 1.1 §5): readOwnJob throws JobUnreadable or
// ManifestUnreadable otherwise, and nothing is written.
export function restartJob(config, id, { now = () => new Date().toISOString(), version = ENGINE_VERSION } = {}) {
  const job = readOwnJob(config.jobsDir, id);
  if (!job || !RESTARTABLE.includes(job.state)) return null;
  const state = restartState(config, job, { version });
  const r = updateJob(config.jobsDir, id, (j) => {
    readManifest(config.jobsDir, id);   // checked again under the lock: nothing is written to a job that is not its own
    if (j.state !== job.state) return null;
    setState(j, state, now());
    j.reason = null;
    delete j.waiting_for;
    return j;
  });
  return r.written ? r.job : null;
}

// An existing job asked to run (start_simulation with its PDF again, or `engine resume`):
//   done → nothing; working or awaiting_approval with a live runner → nothing;
//   the same with no live runner → a runner is started (resumed);
//   cancelled / failed / review → restarted, then a runner is started (resumed).
// Returns { resumed, job }.
// No runner is started through a job whose files are not its own (contract 1.1 §5): both files are read
// again here, and JobUnreadable / ManifestUnreadable is thrown before anything is spawned or written. A
// runner would stop on such a file by itself, but `engine resume` would still say it started one.
export function startOrResume(config, job, {
  spawnRunner = spawnRunnerDefault, isRunnerAlive = runnerAlive, now, version = ENGINE_VERSION,
} = {}) {
  readOwnJob(config.jobsDir, job.job_id);
  if (job.state === 'done') return { resumed: false, job };
  if (RESTARTABLE.includes(job.state)) {
    const next = restartJob(config, job.job_id, { now, version });
    if (!next) return { resumed: false, job: readJob(config.jobsDir, job.job_id) || job };
    // Always a new runner: a cancelled job's old runner may still be on its way out. If it is not (it
    // never saw the cancel), the new one waits for its pid file a few seconds and leaves it the job.
    spawnRunner(config, job.job_id);
    return { resumed: true, job: next };
  }
  if (isRunnerAlive(config, job.job_id)) return { resumed: false, job };
  spawnRunner(config, job.job_id);
  return { resumed: true, job };
}
