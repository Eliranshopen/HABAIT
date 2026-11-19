// The job runner (contract 0.3 §1–§6): `node engine/runner.mjs <job_id>`, started DETACHED. It walks the
// stages tracing → building → rendering → (awaiting_approval) → skinning → gating → finishing → packaging
// → qa → done. Before each stage it applies the resume rule (a done manifest row with the same inputs and
// intact outputs = the stage is skipped, not run, not billed); otherwise it raises attempts[stage], runs
// the stage's implementation for job.mode, and appends the manifest row only after the outputs are on the
// disk. Heavy stages take the machine's heavy lock first. While it lives it writes heartbeat_at every
// runner.heartbeatSeconds and holds runner.pid; a second runner for the same job waits briefly, then exits.
import { loadConfig, ENGINE_VERSION } from './config.mjs';
import { isMain } from './lib/main.mjs';
import { pidAlive, sleepSync } from './lib/proc.mjs';
import { readJob, updateJob, setState, isTerminal, jobDir, withJobLock, JOB_ID_RE, STAGES, JobUnreadable, ReviewNeeded } from './jobs.mjs';
import { EngineError } from './inbox.mjs';
import { readManifest, walkManifest, appendRow, outputsIntact, ManifestUnreadable } from './manifest.mjs';
import { verifyInput as verifyInputDefault, INPUT_REL } from './stages/intake.mjs';
import { readLedger, settledBy, createPaidCall, CapReached, syncSpent } from './ledger.mjs';
import { acquireHeavy, releaseHeavy, refreshHeavy, holdsHeavy } from './heavy-lock.mjs';
import { REGISTRY, implFor } from './stages/index.mjs';
import { ensureServe as ensureServeDefault, localUrl } from './serve.mjs';
import { configEnv, tourDir, runnerAlive } from './control.mjs';
import { sha256FileSync } from './lib/hash.mjs';
import { RETRY, isTransient, writeFileAtomic } from './lib/atomic.mjs';
import fs from 'node:fs';

export const APPROVAL_WAIT_MS = 24 * 60 * 60 * 1000;
export const QUOTE_BASIS = 'measured on apartment 846';
export const CLAIM_WAIT_MS = 3000;
export const MAX_TRANSIENT = 20;

// A file error another process causes for a moment (Windows: a reader holds the file; a lock is busy).
export { isTransient };

// Thrown by ctx.checkCancelled() when the job left the stage (cancelled, or moved by someone else).
export class StageInterrupted extends Error {
  constructor(state) {
    super(`the job is now "${state}"`);
    this.state = state;
  }
}

// Thrown when this runner finds that runner.pid no longer names it: another runner took the job over
// (this one was presumed dead: no sign of life for runner.staleMs). It must not touch the job any more.
export class Superseded extends Error {
  constructor() {
    super('another runner took this job over');
  }
}

// Thrown inside a heavy stage when this runner finds that it holds the heavy lock no longer: it gave no
// sign of life for runner.staleMs and another job took the lock over. The stage stops, writes no row, and
// runs again once the lock is this runner's (contract 0.3 §10.13).
export class HeavyLockLost extends Error {
  constructor() {
    super('the heavy lock was taken over while this runner was silent');
  }
}

// The state after a finished stage.
export function nextAfter(stage) {
  if (stage === 'rendering') return 'awaiting_approval';
  if (stage === 'qa') return 'done';
  const i = STAGES.indexOf(stage);
  return i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1] : null;
}

// The test hooks (contract 0.3 §7): nothing unless the variable is set to a positive number of ms.
// The three pauses are sleeps (the heartbeat goes on). ENGINE_TEST_FREEZE_MS BLOCKS the runner's thread,
// once, at the point ENGINE_TEST_FREEZE_AT names ("<stage>" = when that stage starts, "<stage>:reserved" =
// after its paid call is reserved, before it is sent, "<stage>:sent" = the call was sent and its answer is
// in hand, nothing recorded yet): no heartbeat, a live runner that looks dead. With ENGINE_TEST_FREEZE_WAKE
// (a file path) the block ends as soon as that file exists, and ENGINE_TEST_FREEZE_MS is its upper bound.
export function hooksFromEnv(env = process.env) {
  const ms = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);
  return {
    pauseAfterReserveMs: ms(env.ENGINE_TEST_PAUSE_AFTER_RESERVE_MS),
    pauseAfterCacheMs: ms(env.ENGINE_TEST_PAUSE_AFTER_CACHE_MS),
    pauseAfterSettleMs: ms(env.ENGINE_TEST_PAUSE_AFTER_SETTLE_MS),
    freezeMs: ms(env.ENGINE_TEST_FREEZE_MS),
    freezeAt: String(env.ENGINE_TEST_FREEZE_AT || ''),
    freezeWake: String(env.ENGINE_TEST_FREEZE_WAKE || ''),
  };
}

// The block of the freeze hook: `ms` long, or shorter when the file `wake` appears (a test ends the block at
// the moment it chooses, so its outcome does not depend on how fast the machine is).
export function blockThread(ms, wake = '', { clock = () => Date.now(), exists = fs.existsSync, nap = sleepSync } = {}) {
  if (!wake) {
    nap(ms);
    return;
  }
  const until = clock() + ms;
  while (clock() < until && !exists(wake)) nap(Math.max(1, Math.min(20, until - clock())));
}

// Take runner.pid (under the job lock); false when another LIVE runner holds it, 'ended' when the job has
// ended (or is gone). Live = a live pid and a recent sign of life (control.mjs runnerAlive): a recycled pid
// in an old pid file does not block a new runner.
export function claimPid(config, id, pid, alive = pidAlive, clock = () => Date.now()) {
  const file = `${jobDir(config.jobsDir, id)}/runner.pid`;
  return withJobLock(config.jobsDir, id, () => {
    // Looked at again UNDER the lock: the runner that ends a job changes its state under this same lock, so
    // a job that has ended is never taken, however close two runners are (contract 0.3 §16.1).
    const job = readJob(config.jobsDir, id);
    if (!job || isTerminal(job.state)) return 'ended';
    let other = null;
    try {
      other = Number(String(fs.readFileSync(file, 'utf8')).trim());
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
    if (other && other !== pid && runnerAlive(config, id, alive, { clock })) return false;
    writeFileAtomic(file, String(pid));   // never seen half-written, and a file held for a moment is waited for
    return true;
  });
}

// Give runner.pid back, under the job lock (the lock a runner claims it under): a runner that was replaced
// must never remove the pid file of the runner that replaced it.
export function releasePid(config, id, pid, { waitMs = 2000 } = {}) {
  const file = `${jobDir(config.jobsDir, id)}/runner.pid`;
  const mine = () => {
    try {
      return Number(fs.readFileSync(file, 'utf8').trim()) === pid;
    } catch {
      return false;
    }
  };
  if (!mine()) return;   // gone, or another runner's: nothing to give back
  try {
    withJobLock(config.jobsDir, id, () => {
      if (mine()) fs.rmSync(file, { force: true });
    }, { waitMs });
  } catch { /* the lock is busy: a pid file whose process has ended blocks nobody */ }
}

const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));
const intervalTimer = (fn, ms) => {
  const t = setInterval(fn, ms);
  return () => clearInterval(t);
};

// A job.json or manifest.json that is not this job's (contract 1.1 §5). A runner that meets one stops at
// once: it writes nothing, gives runner.pid back, and its log names the job and the reason.
export const notThisJobs = (e) => e instanceof JobUnreadable || e instanceof ManifestUnreadable;

// Returns why it stopped: 'done' | 'cancelled' | 'failed' | <other terminal state> | 'no-job' | 'busy' |
// 'approval-timeout' | 'superseded' (another runner took the job over) | 'unreadable' (the job's
// own job.json or manifest.json is not this job's file).
export async function runRunner({
  config, jobId, pid = process.pid, sleep = realSleep, now = () => new Date().toISOString(), clock = () => Date.now(),
  ensureServe = (c) => ensureServeDefault(c, { env: configEnv(c) }), log = () => {}, approvalWaitMs = APPROVAL_WAIT_MS,
  alive = pidAlive, registry = REGISTRY, version = ENGINE_VERSION, hooks = {}, timer = intervalTimer, claimWaitMs = CLAIM_WAIT_MS,
  freeze = blockThread, readPidFile = (file) => fs.readFileSync(file, 'utf8'), beforeClaim = () => {},
  verifyInput = verifyInputDefault,
}) {
  if (!JOB_ID_RE.test(String(jobId))) return 'no-job';
  const claimUntil = clock() + claimWaitMs;
  const unreadable = (e) => {
    log(`${e.message}; this runner stops and writes nothing`);
    return 'unreadable';
  };
  for (;;) {
    let claimed;
    try {
      const j = readJob(config.jobsDir, jobId);
      if (!j) return 'no-job';
      // A job that has ended needs no runner: leave without taking runner.pid (a runner that was started
      // while another one was finishing the job must not hold the pid file of a job that is done).
      if (isTerminal(j.state)) return j.state;
      beforeClaim();   // a seam for the tests: the moment between this look at the job and the locked claim
      claimed = claimPid(config, jobId, pid, alive, clock);
      if (claimed === 'ended') {
        const again = readJob(config.jobsDir, jobId);
        return again ? again.state : 'no-job';
      }
    } catch (e) {
      if (notThisJobs(e)) return unreadable(e);   // before the claim: runner.pid was never taken
      throw e;
    }
    if (claimed) break;
    if (clock() >= claimUntil) {
      log('another runner holds runner.pid; exiting');
      return 'busy';
    }
    await sleep(100);
  }

  const { jobsDir } = config;
  const dir = jobDir(jobsDir, jobId);
  const heavyFile = config.runner.heavyLock;
  const heavy = (stage) => config.runner.heavyStages.includes(stage);
  const poll = Math.max(10, Math.min(config.runner.heartbeatMs, 250));
  // How long the runner waits for an approval: a window from its start, and a fresh one when the cap is reached.
  let waitUntil = Infinity;
  let holding = false;      // this runner took the heavy lock and has not given it back
  let heavyLost = false;    // ...and then found that another job had taken it over

  // Ownership (fencing). A runner that takes a job over writes runner.pid under the job lock; this runner
  // checks, under the same lock, that the file still names it before it changes job.json, reserves a paid
  // call or appends a manifest row. So a runner that was replaced can do nothing more to the job.
  const pidFile = `${dir}/runner.pid`;
  let lost = false;
  // A pid file that cannot be read for a moment (Windows: another process holds it) is not a lost job:
  // a short retry, then the file error goes up and the loop waits it out like any other.
  const owns = () => {
    for (let i = 0; ; i++) {
      try {
        return Number(String(readPidFile(pidFile)).trim()) === pid;
      } catch (e) {
        if (!RETRY.has(e.code)) return false;   // no such file: the job is not ours
        if (i >= 20) throw e;
        sleepSync(5);
      }
    }
  };
  const guard = () => {
    if (!lost && owns()) return;
    lost = true;
    throw new Superseded();
  };
  // The test hook ENGINE_TEST_FREEZE_MS / ENGINE_TEST_FREEZE_AT: block this thread at the named point,
  // ONCE in the life of this runner (a stage that runs again in the same runner is not blocked again).
  let frozenOnce = false;
  const freezeAt = (point) => {
    if (frozenOnce || !(hooks.freezeMs > 0) || hooks.freezeAt !== point) return;
    frozenOnce = true;
    log(`test hook: thread blocked for ${hooks.freezeMs} ms at ${point} (a live runner that gives no sign of life)`);
    freeze(hooks.freezeMs, hooks.freezeWake || '');
    log(`test hook: the block at ${point} is over`);
  };
  const update = (mutate) => updateJob(jobsDir, jobId, (j) => {
    if (lost || !owns()) {
      lost = true;
      return null;
    }
    return mutate(j);
  });
  const beat = () => {
    try {
      update((j) => {
        if (isTerminal(j.state)) return null;
        j.heartbeat_at = now();
        return j;
      });
    } catch (e) {
      log(`heartbeat skipped: ${e.message}`);
    }
    // The heavy lock's holder says it is still there at every heartbeat (contract 0.3 §10.5). False = it
    // was taken over while this runner was silent: the heavy stage stops at its next check (§10.13).
    if (holding && !heavyLost) {
      try {
        if (refreshHeavy(heavyFile, { pid, now }) === false) {
          heavyLost = true;
          log('the heavy lock is no longer ours (taken over as stale); the heavy stage stops at its next check');
        }
      } catch (e) {
        log(`heavy lock not refreshed now: ${e.message}`);
      }
    }
  };
  // Inside a heavy stage: still the holder of the heavy lock? A lock file that cannot be read for a moment
  // is not a loss (holdsHeavy answers null).
  const heavyGuard = () => {
    if (!holding) return;
    if (!heavyLost && holdsHeavy(heavyFile, { pid }) !== false) return;
    heavyLost = true;
    throw new HeavyLockLost();
  };
  // job.cost.spent_usd is derived from the ledger (contract 0.3 §10.2); a file busy for a moment is not fatal.
  const spent = () => {
    try {
      syncSpent(jobsDir, jobId);
    } catch (e) {
      if (!isTransient(e)) throw e;
      log(`spent_usd not synced now: ${e.message}`);
    }
  };
  const release = () => {
    if (!holding) return;
    holding = false;
    heavyLost = false;
    releaseHeavy(heavyFile, { pid });   // removes the lock only when it is still this runner's
  };
  // from → to, only if the job is still in `from`; returns true when written.
  const transition = (from, to, extra) => update((j) => {
    if (j.state !== from) return null;
    setState(j, to, now());
    delete j.waiting_for;
    if (extra) extra(j);
    return j;
  }).written;
  const clearWaiting = () => update((j) => {
    if (!('waiting_for' in j)) return null;
    delete j.waiting_for;
    return j;
  });

  // Take the heavy lock while the job stays in `state`; false when the job left that state meanwhile.
  async function waitHeavy(state) {
    let marked = false;
    for (;;) {
      if (lost || !owns()) return false;   // replaced while it waited: it must not take the lock
      const r = acquireHeavy(heavyFile, { pid, jobId, alive, now, clock, staleMs: config.runner.staleMs });
      if (r.ok) {
        holding = true;
        heavyLost = false;
        if (r.took_over) log(`heavy lock taken over from ${alive(r.took_over.pid) ? 'silent' : 'dead'} pid ${r.took_over.pid}`);
        return true;
      }
      if (!marked) {
        update((j) => {
          if (j.state !== state) return null;
          j.waiting_for = 'heavy-lock';
          return j;
        });
        marked = true;
        log(`waiting for the heavy lock (held by job ${r.holder.job_id}, pid ${r.holder.pid})`);
      }
      const j = readJob(jobsDir, jobId);
      if (!j || j.state !== state) {
        if (j) clearWaiting();
        return false;
      }
      await sleep(poll);
    }
  }

  async function runStage(stage, inputs) {
    const up = update((j) => {
      if (j.state !== stage) return null;
      j.attempts = { ...(j.attempts || {}) };
      j.attempts[stage] = (j.attempts[stage] || 0) + 1;
      delete j.waiting_for;
      const t = now();
      j.updated_at = t;
      j.heartbeat_at = t;
      return j;
    });
    if (!up.written) return { interrupted: true };
    const attempt = up.job.attempts[stage];
    const stageDir = `${dir}/stages/${stage}`;
    const startedAt = now();
    const t0 = clock();
    log(`${stage}: attempt ${attempt} started`);
    const ctx = {
      job: up.job, config, jobDir: dir, stageDir, attempt, inputsSha256: inputs, sleep,
      log: (line) => log(`${stage}: ${line}`),
      // Throws when the stage must stop: another runner took the job over, the heavy lock was lost, or the
      // job left the stage.
      checkCancelled() {
        guard();
        heavyGuard();
        const j = readJob(jobsDir, jobId);
        if (!j || j.state !== stage) throw new StageInterrupted(j ? j.state : 'gone');
      },
      // Throws only when another runner took the job over. For the moment before a stage writes an output
      // after a paid call: what was paid is recorded even when the job was cancelled meanwhile (§10.6),
      // but a runner that was replaced must not write over the files of the runner that owns the job.
      checkOwner() {
        guard();
      },
      paidCall: createPaidCall({ jobsDir, jobId, stage, attempt, now, sleep, log, guard, clock,
        beforeSend: () => freezeAt(`${stage}:reserved`), afterSend: () => freezeAt(`${stage}:sent`),
        pauseAfterReserveMs: hooks.pauseAfterReserveMs || 0, pauseAfterCacheMs: hooks.pauseAfterCacheMs || 0,
        pauseAfterSettleMs: hooks.pauseAfterSettleMs || 0 }),
    };
    let res;
    try {
      freezeAt(stage);
      fs.mkdirSync(stageDir, { recursive: true });
      res = await implFor(stage, up.job.mode, registry).run(ctx);
      // The row states what is REALLY on the disk: the hashes are taken again from the files.
      const outputs = (res?.outputs || []).map((o) => {
        const file = `${dir}/${o.path}`;
        return { path: o.path, sha256: sha256FileSync(file), bytes: fs.statSync(file).size };
      });
      if (!outputsIntact(dir, outputs)) throw new Error(`${stage}: an output changed while it was being recorded`);
      const row = { stage, attempt, status: 'done', started_at: startedAt, finished_at: now(),
        seconds: Math.round(clock() - t0) / 1000, inputs_sha256: inputs, outputs,
        cost_usd: settledBy(readLedger(jobsDir, jobId), stage, attempt), runner_pid: pid };
      heavyGuard();   // the row of a heavy stage is written only by a runner that still holds the heavy lock
      withJobLock(jobsDir, jobId, () => {
        guard();
        appendRow(jobsDir, jobId, row);
      });
      log(`${stage}: done (attempt ${attempt}, $${row.cost_usd})`);
      return { row };
    } catch (e) {
      if (e instanceof Superseded) {
        log(`${stage}: ${e.message}; nothing more is written by this runner`);
        return { superseded: true };
      }
      if (e instanceof StageInterrupted) {
        log(`${stage}: interrupted (${e.message}); no manifest row`);
        return { interrupted: true };
      }
      if (e instanceof HeavyLockLost) {
        log(`${stage}: ${e.message}; no manifest row, the stage runs again once the lock is ours`);
        return { interrupted: true };
      }
      // The stage's own gate refused and a person has to look (contract 1.3 §4): no row for this attempt.
      if (e instanceof ReviewNeeded) {
        log(`${stage}: handed to a person (${e.code}): ${e.message}; no manifest row`);
        return { review: e, attempt };
      }
      // A transient file error is not the stage's failure: the runner's loop waits and tries again (the
      // stage has no row, so it runs again; its paid calls come from the cache).
      if (isTransient(e)) throw e;
      // Nor is a job file that is not this job's: the runner stops, it does not mark the job failed.
      if (notThisJobs(e)) throw e;
      return { error: e };
    }
  }

  function fail(stage, e) {
    const reason = e instanceof EngineError ? { code: e.code, message: e.message } : { code: 'STAGE_FAILED', message: `${stage}: ${e.message}` };
    log(`${stage}: failed ${reason.code}: ${e.stack || e.message}`);
    update((j) => {
      if (j.state !== stage) return null;
      setState(j, 'failed', now());
      j.reason = reason;
      delete j.waiting_for;
      return j;
    });
  }

  // A stage handed the job to a person (contract 1.3 §4): the state `review`, the reason, and the record of what
  // to look at. No later stage runs; the job is restarted like a failed one (contract 0.3 §6).
  function review(stage, e, attempt) {
    update((j) => {
      if (j.state !== stage) return null;
      setState(j, 'review', now());
      j.reason = { code: e.code, message: e.message };
      j.review = { stage, attempt, files: { ...e.files } };
      delete j.waiting_for;
      return j;
    });
  }

  // The cap was reached (contract 0.3 §10.3): not a failure and not a dead end. The job goes back to
  // awaiting_approval with the reason, a quote for what it needs in all, the old approval kept in the
  // history and `approval` null; a larger approval continues it (the stages that are done are skipped).
  function capReached(stage, e) {
    log(`${stage}: the cap was reached (${e.message}); back to awaiting_approval, needs $${e.needUsd}`);
    update((j) => {
      if (j.state !== stage) return null;
      const need = e.needUsd;
      const upper = Math.max(need, Number(j.quote?.range_usd?.[1]) || 0);
      setState(j, 'awaiting_approval', now());
      j.approvals = [...(Array.isArray(j.approvals) ? j.approvals : []), ...(j.approval ? [j.approval] : [])];
      j.approval = null;
      j.reason = { code: 'BUDGET_CAP', message: e.message };
      j.quote = { ...(j.quote || {}), estimate_usd: need, range_usd: [need, upper], cap_reached: true };
      delete j.waiting_for;
      return j;
    });
    waitUntil = clock() + approvalWaitMs;   // a new wait for an approval begins
  }

  // Leave a finished (or skipped) stage for the next state. A heavy next stage is entered only with the
  // heavy lock held; while it waits, the job stays in `stage` with waiting_for: "heavy-lock".
  async function advance(stage) {
    const next = nextAfter(stage);
    if (next === 'awaiting_approval') {
      transition(stage, next, (j) => {
        j.quote = { estimate_usd: config.stub.quote.estimate_usd, range_usd: [...config.stub.quote.range_usd],
          rooms: config.stub.rooms, basis: QUOTE_BASIS };
      });
      return;
    }
    if (next === 'done') {
      await ensureServe(config);
      spent();
      transition(stage, next, (j) => {
        j.result = { local_url: localUrl(config), tour_dir: tourDir(config) };
      });
      return;
    }
    if (heavy(next) && !holding) {
      const job = readJob(jobsDir, jobId);
      const walk = job ? walkManifest(readManifest(jobsDir, jobId), job, { version, dir, stages: STAGES.slice(0, STAGES.indexOf(next) + 1) }) : [];
      const skip = walk.length && walk.at(-1).stage === next && walk.at(-1).row;
      if (!skip && !(await waitHeavy(stage))) return;
    }
    if (!transition(stage, next)) release();
  }

  // The job's own copy of the PDF, checked against the hash in job.json (contract 1.1 §4). False = it is gone
  // or is not that PDF any more: the job is ended `failed` here, and the caller stops. Asked at every runner
  // start and before every stage attempt, so a copy changed while a live runner waited (for an approval, for
  // the heavy lock) is never the input of a stage.
  function inputIntact() {
    const mine = readJob(jobsDir, jobId);
    const input = mine ? verifyInput(jobsDir, mine) : { ok: true };
    if (input.ok) return true;
    const message = `the stored input (${INPUT_REL}) is ${input.why === 'missing' ? 'missing' : 'not the PDF this job was started with'}`;
    log(`${message}; the job fails here and no stage runs on it`);
    update((j) => {
      if (isTerminal(j.state)) return null;
      setState(j, 'failed', now());
      j.reason = { code: 'STAGE_FAILED', message };
      delete j.waiting_for;
      return j;
    });
    return false;
  }

  // One pass of the loop: returns why the runner stops, or undefined to go on.
  async function step() {
    {
      const job = readJob(jobsDir, jobId);
      if (!job) return 'no-job';
      if (lost || !owns()) {
        log('runner.pid names another runner now; stopping without touching the job');
        return 'superseded';
      }
      if (isTerminal(job.state)) return job.state;
      const state = job.state;
      if (state === 'queued') {
        transition('queued', STAGES[0]);
        return undefined;
      }
      if (state === 'awaiting_approval') {
        if (job.approval) {
          transition(state, 'skinning');
          return undefined;
        }
        if (clock() > waitUntil) {
          log('no approval in time; exiting (approve_paid_stage starts a new runner)');
          return 'approval-timeout';
        }
        await sleep(poll);
        return undefined;
      }
      // Every other state is a stage: a job file with a state outside the contract is not read at all
      // (checkJob, contract 1.1 §5), so there is no state here that the runner does not know.

      const walk = walkManifest(readManifest(jobsDir, jobId), job, { version, dir, stages: STAGES.slice(0, STAGES.indexOf(state) + 1) });
      const here = walk.at(-1);
      if (here.stage !== state) {
        // An earlier stage lost its valid row (an output changed or vanished): it must be done again.
        log(`${here.stage}: no valid manifest row any more; going back from ${state}`);
        transition(state, here.stage);
        release();
        return undefined;
      }
      if (here.row) {
        log(`${state}: skipped (valid row, attempt ${here.row.attempt})`);
        await advance(state);
        return undefined;
      }
      if (heavy(state) && !holding && !(await waitHeavy(state))) return undefined;
      if (!inputIntact()) return 'failed';   // looked at again right before the stage (the `finally` gives the heavy lock back)
      const r = await runStage(state, here.inputs);
      if (r.superseded) {
        release();
        return 'superseded';
      }
      if (r.interrupted) {
        release();
        return undefined;
      }
      if (r.review) {
        release();
        review(state, r.review, r.attempt);
        return undefined;
      }
      if (r.error) {
        release();
        if (r.error instanceof CapReached) capReached(state, r.error);
        else fail(state, r.error);
        return undefined;
      }
      // Keep the heavy lock until job.json has left the heavy state (so no two jobs ever SHOW a heavy stage
      // at once), and across into a next stage that is heavy too.
      await advance(state);
      const after = readJob(jobsDir, jobId);
      if (!after || !heavy(after.state)) release();
      return undefined;
    }
  }

  let stopBeat = () => {};
  let transient = 0;
  try {
    // A first sign of life at once, and spent_usd put right from the ledger, before the first step. A ledger
    // that cannot be read (damaged) ends the runner here, with runner.pid given back: the job stays where it
    // is, and nothing is paid on top of a record that cannot be trusted (contract 0.3 §15.3).
    // The manifest is read before anything is written, for the same reason (contract 1.1 §5): job.json was
    // checked by the claim, and a manifest that is not this job's ends the runner before its first heartbeat.
    readManifest(jobsDir, jobId);
    // The job's own copy of the PDF is checked at every start, a first one and a resume, before any stage
    // (contract 1.1 §4). A copy that is gone, or is not the PDF the job was started with, ends the job here:
    // no stage runs on other bytes than the ones the job id was made from, and nothing is billed.
    if (!inputIntact()) return 'failed';
    beat();
    spent();
    waitUntil = clock() + approvalWaitMs;
    stopBeat = timer(beat, config.runner.heartbeatMs);
    for (;;) {
      let out;
      try {
        out = await step();
        transient = 0;
      } catch (e) {
        // A file another process holds open for a moment (Windows) must not kill the runner: wait, read again.
        if (!isTransient(e) || ++transient > MAX_TRANSIENT) throw e;
        log(`transient file error (${transient}/${MAX_TRANSIENT}), trying again: ${e.code || e.message}`);
        await sleep(poll);
        continue;
      }
      if (out !== undefined) return out;
    }
  } catch (e) {
    if (notThisJobs(e)) return unreadable(e);   // the `finally` below gives runner.pid back
    throw e;
  } finally {
    stopBeat();
    release();
    releasePid(config, jobId, pid);
  }
}

// The process's main: `node engine/runner.mjs <job_id>`. Returns the exit code.
export async function runnerMain(argv, { env = process.env, stderr = process.stderr, load = loadConfig, run = runRunner } = {}) {
  const jobId = argv[0];
  const log = (m) => stderr.write(`${new Date().toISOString()} runner ${process.pid} ${m}\n`);
  try {
    const why = await run({ config: load({ env }), jobId, log, hooks: hooksFromEnv(env) });
    log(`stopped: ${why}`);
    return why === 'no-job' || why === 'unreadable' ? 1 : 0;
  } catch (e) {
    log(`error: ${e.stack || e.message}`);
    return 1;
  }
}

if (isMain(process.argv[1], import.meta.url)) {
  process.exitCode = await runnerMain(process.argv.slice(2));
}
