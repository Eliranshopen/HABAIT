// The engine behind the eight tools (contract 0.2 §2–§5, 0.3 §4, §6, 1.1): real job files, a REAL first
// look at the PDF (engine/inspect.mjs) and a real intake (engine/stages/intake.mjs: the job's own verified,
// read-only copy), then the detached runner of engine/runner.mjs walking the STUB stages, and the existing
// apartment-846 tour as the result. Nothing is rendered. A new job carries the mode of the settings (contract 1.3
// §1): "stub" unless they say "real", and a real job walks the REAL stages (the reading, since 1.3) with no stub.
// Each handler answers in seconds (contract 0.2 §1); none waits for a job. The first look at a PDF starts
// Python once (about 2 s on this machine); after that it comes from the cache.
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ENGINE_VERSION } from '../engine/config.mjs';
import { checkPdfPath, sha256Buffer, EngineError, UPLOAD_UNREADABLE } from '../engine/inbox.mjs';
import { jobId, jobDir, newJob, writeJob, withJobLock, updateJob, isTerminal, isFolder, JobUnreadable } from '../engine/jobs.mjs';
import { ManifestUnreadable, readManifest, readOwnJob, listOwnJobs } from '../engine/manifest.mjs';
import { inspectPdf } from '../engine/inspect.mjs';
import { intakePdf } from '../engine/stages/intake.mjs';
import { ensureServe as ensureServeDefault, localUrl } from '../engine/serve.mjs';
import { readJson, writeJson } from '../engine/lib/json.mjs';
import {
  RUNNER, configEnv, tourDir, runnerPidFile, runnerAlive, spawnRunnerDefault, withTrueCost, shownJob, startOrResume,
} from '../engine/control.mjs';

export { RUNNER, configEnv, tourDir, runnerPidFile, runnerAlive, spawnRunnerDefault };

export const MODE = 'stub';          // the mode of a new job when the settings name none (contract 1.3 §1)
const CLI = fileURLToPath(new URL('../engine/cli.mjs', import.meta.url));

// What inspect_plan says about itself: the first look reads the PDF for real (contract 1.1 §2).
export const INSPECT_MODE = 'real';
const CANDIDATE_ID = /^[A-Za-z0-9_-]{1,64}$/;

// A Node file error: its `code` is an errno name such as EACCES, or UNKNOWN (which Windows gives for some
// file errors), or one of Node's own ERR_FS_ codes (rm of a folder). Its message carries a local path.
export const ERRNO_CODE = /^(E[A-Z0-9]+|UNKNOWN|ERR_FS_[A-Z0-9_]+)$/;
export const isErrno = (e) => Boolean(e) && typeof e.code === 'string' && ERRNO_CODE.test(e.code);
export const OWN_FILES_FAILED = 'the engine could not read or write its own files';

// Which candidate a job is for (contract 1.1 §2). `apartment` left out = the only candidate, when there is
// exactly one. No candidate, several with none chosen, or an id that is not a candidate → NO_PLAN_FOUND.
export function chooseCandidate(candidates, apartment) {
  const ids = candidates.map((c) => c.id);
  const list = ids.length ? `candidates: ${ids.join(', ')}` : 'no drawing was found in this PDF';
  if (apartment === undefined || apartment === null) {
    if (candidates.length === 1) return candidates[0];
    throw new EngineError('NO_PLAN_FOUND', candidates.length ? `this PDF has ${candidates.length} drawings; choose one (${list})` : list);
  }
  const hit = candidates.find((c) => c.id === apartment);
  if (hit) return hit;
  const named = typeof apartment === 'string' && CANDIDATE_ID.test(apartment) ? `"${apartment}"` : 'that id';
  throw new EngineError('NO_PLAN_FOUND', `${named} is not a drawing of this PDF; ${list}`);
}

export function stubSiteCheck(config) {
  const dir = tourDir(config);
  const ok = fs.existsSync(`${dir}/index.html`);
  return { id: 'stub-site', ok, detail: ok ? dir : `not found: ${dir}/index.html` };
}

// The readiness report takes about five seconds (Python, Blender, the parity run), longer than a tool may
// take. It runs in a child process; the last result is kept in memory and in <runtimeDir>/doctor.json.
export function createDoctorCache(config, {
  runChild = (cb) => execFile(process.execPath, [CLI, 'doctor', '--json'],
    { env: configEnv(config), timeout: 120000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, cb),
  maxAgeMs = 10 * 60 * 1000,
  clock = () => Date.now(),
} = {}) {
  const file = `${config.runtimeDir}/doctor.json`;
  let last = null;
  try {
    last = readJson(file);
  } catch { /* none yet */ }
  let running = null;
  let child = null;
  const fresh = () => last && clock() - Date.parse(last.at) < maxAgeMs;
  function kick() {
    if (running || fresh()) return running;
    running = new Promise((resolve) => {
      child = runChild((error, stdout) => {
        try {
          const r = JSON.parse(String(stdout));
          last = { at: r.at || new Date(clock()).toISOString(), ready: r.ready, ready_except_keys: r.ready_except_keys, checks: r.checks };
          try {
            writeJson(file, last);
          } catch { /* the cache file is a convenience */ }
        } catch {
          last = { at: new Date(clock()).toISOString(), ready: false, ready_except_keys: false,
            checks: [{ id: 'doctor', ok: false, detail: `readiness check failed: ${error ? error.message.split('\n')[0] : 'no JSON'}` }] };
        }
        running = null;
        child = null;
        resolve(last);
      });
    });
    return running;
  }
  return {
    kick,
    async get(waitMs = 1000) {
      const p = kick();
      if (p && !last) await Promise.race([p, new Promise((r) => setTimeout(r, waitMs).unref?.())]);
      return last;
    },
    stop() {
      if (child && child.kill) child.kill();
    },
    get last() {
      return last;
    },
  };
}

export function createStubEngine(config, {
  now = () => new Date().toISOString(),
  spawnRunner = spawnRunnerDefault,
  isRunnerAlive = runnerAlive,
  ensureServe = (c) => ensureServeDefault(c, { waitMs: 1500, env: configEnv(c) }),
  doctor = createDoctorCache(config),
  version = ENGINE_VERSION,
  inspect = (c, file) => inspectPdf(c, file),   // the first look; the tests that start dozens of made-up PDFs script it
  log = (m) => process.stderr.write(`[habait-engine] ${m}\n`),   // stderr: stdout carries protocol messages only
} = {}) {
  // The mode of a NEW job is the settings' (contract 1.3 §1); it is part of the job id.
  const mode = config.mode ?? MODE;
  const ensureRunner = (job) => {
    if (isTerminal(job.state) || isRunnerAlive(config, job.job_id)) return false;
    spawnRunner(config, job.job_id);
    return true;
  };
  // A job as the engine shows it: the true cost (the ledger's settled total, contract 0.3 §14.1) and the computed runner.
  const shown = (job) => shownJob(config, job, { isAlive: isRunnerAlive });
  const costed = (job) => withTrueCost(config, job);

  // A job is read only when BOTH its files are its own (contract 1.1 §5): readOwnJob throws for a job.json
  // or a manifest.json of another job, and the wrapper below makes that JOB_NOT_FOUND.
  const mustJob = (id) => {
    const job = readOwnJob(config.jobsDir, id);
    if (!job) throw new EngineError('JOB_NOT_FOUND', `no job ${id}`);
    return job;
  };

  // Every read of the UPLOAD has one answer when it fails: NOT_A_PDF (contract 1.1 §1). A file that another
  // program holds, or that may not be read, is not a PDF the engine can take at this moment; the error's own
  // message would carry a local path. The check of the path and the read that gives the hash are both here.
  const checkedUpload = (pdfPath) => {
    try {
      const f = checkPdfPath(pdfPath, config);
      return { f, sha256: sha256Buffer(fs.readFileSync(f.path)) };
    } catch (e) {
      if (e instanceof EngineError || !isErrno(e)) throw e;
      log(`the upload cannot be read (${e.code})`);
      throw new EngineError('NOT_A_PDF', e.code === 'ENOENT' ? 'no such file' : UPLOAD_UNREADABLE);
    }
  };

  // The job-folder part of start_simulation: the lock, the job's files, the intake, the new job.
  const startInFolder = (id, f, sha, chosen, capUsd) => {
    const made = withJobLock(config.jobsDir, id, () => {
      const existing = readOwnJob(config.jobsDir, id);
      if (existing) return { existing };
      // The intake (contract 1.1 §3): the job's own copy, put in place only when its hash is the one the
      // job id was made from, then read-only. A job never reads the upload again.
      const copy = intakePdf(config.jobsDir, id, f, sha);
      const job = newJob({ id, mode, now: now(),
        input: { pdf_path: copy.path, pdf_name: f.name, pdf_sha256: sha, pdf_bytes: copy.bytes, apartment: chosen.id },
        capUsd: capUsd ?? null, version });
      writeJob(config.jobsDir, job);
      spawnRunner(config, id);
      return { job };
    });
    if (made.job) return { job_id: id, created: true, resumed: false, job: made.job };   // a new job: nothing spent yet
    // An existing job (contract 0.3 §6): done → as it is; alive → as it is; else resumed or restarted.
    const r = startOrResume(config, made.existing, { spawnRunner, isRunnerAlive, now, version });
    return { job_id: id, created: false, resumed: r.resumed, job: costed(r.job) };
  };

  // A file error from the job folder (it cannot be made, read or written: EACCES, EPERM, EEXIST, EIO ...)
  // is the engine's trouble, and its message carries a local path: the answer is TOOLCHAIN_MISSING with a
  // fixed message that names the job only; the errno code goes to the log. The engine's own errors (a reason
  // code, a job file that is not its own, a busy lock) pass as they are.
  const jobFolderWork = (id, fn) => {
    try {
      return fn();
    } catch (e) {
      if (e instanceof EngineError || e instanceof JobUnreadable || e instanceof ManifestUnreadable) throw e;
      if (!isErrno(e)) throw e;
      log(`start_simulation: the folder of job ${id} cannot be used (${e.code})`);
      throw new EngineError('TOOLCHAIN_MISSING', `the folder of job ${id} cannot be used by the engine`);
    }
  };

  const handlers = {
    async engine_status() {
      const d = await doctor.get(1000);
      const site = stubSiteCheck(config);
      const base = d || { at: null, ready: false, ready_except_keys: false,
        checks: [{ id: 'doctor', ok: false, detail: 'the readiness check is still running (about 5 s); ask again' }] };
      const checks = [...base.checks.map((c) => ({ id: String(c.id), ok: Boolean(c.ok), detail: String(c.detail) })), site];
      return {
        mode,
        ready: Boolean(base.ready) && site.ok,
        ready_except_keys: Boolean(base.ready_except_keys) && site.ok,
        checked_at: base.at,
        checks,
        missing: checks.filter((c) => !c.ok).map((c) => c.id),
      };
    },

    inspect_plan({ pdf_path }) {
      const { f, sha256 } = checkedUpload(pdf_path);
      const look = inspect(config, { path: f.path, sha256 });
      return { mode: INSPECT_MODE, pdf_path: f.path, sha256, bytes: f.bytes, pages: look.pages, kind: look.kind,
        page_rows: look.page_rows, candidates: look.candidates };
    },

    start_simulation({ pdf_path, apartment, budget_cap_usd }) {
      const { f, sha256: sha } = checkedUpload(pdf_path);
      // A job is started only for a drawing the first look found (from the cache when inspect_plan ran before).
      const chosen = chooseCandidate(inspect(config, { path: f.path, sha256: sha }).candidates, apartment);
      const id = jobId({ pdfSha256: sha, apartment: chosen.id, mode, version });
      // Something that is not a folder where the job's folder belongs is named, never overwritten. Checked
      // before the lock, whose file lives inside that folder (taking it would end as a raw EEXIST).
      if (fs.existsSync(jobDir(config.jobsDir, id)) && !isFolder(jobDir(config.jobsDir, id))) {
        throw new EngineError('NOT_A_PDF', `job ${id} holds something that is not a folder where its folder belongs; it is never overwritten`);
      }
      return jobFolderWork(id, () => startInFolder(id, f, sha, chosen, budget_cap_usd));
    },

    get_job({ job_id }) {
      return { job: shown(mustJob(job_id)) };
    },

    approve_paid_stage({ job_id, cap_usd }) {
      mustJob(job_id);
      const r = updateJob(config.jobsDir, job_id, (job) => {
        readManifest(config.jobsDir, job_id);   // checked again under the lock: nothing is written to a job that is not its own
        if (job.state !== 'awaiting_approval') throw new EngineError('NOT_AWAITING_APPROVAL', `job ${job_id} is "${job.state}", not "awaiting_approval"`);
        const estimate = job.quote?.estimate_usd ?? 0;
        if (cap_usd < estimate) throw new EngineError('BUDGET_CAP', `cap $${cap_usd} is below the estimate $${estimate}`);
        const at = now();
        job.approval = { cap_usd, at };
        job.cost.cap_usd = cap_usd;
        job.reason = null;   // an approval answers the reason the job was waiting for (the cap was reached: contract 0.3 §10.3)
        job.updated_at = at;
        return job;
      });
      if (!r.job) throw new EngineError('JOB_NOT_FOUND', `no job ${job_id}`);
      ensureRunner(r.job);
      return { job: costed(r.job) };
    },

    async get_result({ job_id }) {
      const job = costed(mustJob(job_id));
      if (job.state !== 'done' || !job.result) throw new EngineError('NOT_DONE', `job ${job_id} is "${job.state}", not "done"`);
      // The link must answer: start the local server again if it is gone (e.g. after a reboot).
      await ensureServe(config);
      return {
        job_id, mode: job.mode, local_url: job.result.local_url, tour_dir: job.result.tour_dir,
        rooms: config.stub.rooms, deviations: [], cost: { spent_usd: job.cost.spent_usd, cap_usd: job.cost.cap_usd },
      };
    },

    cancel_job({ job_id }) {
      mustJob(job_id);
      const r = updateJob(config.jobsDir, job_id, (job) => {
        readManifest(config.jobsDir, job_id);   // as for approve: checked again under the lock
        if (isTerminal(job.state)) return null;
        const at = now();
        job.state = 'cancelled';
        job.updated_at = at;
        return job;
      });
      if (!r.job) throw new EngineError('JOB_NOT_FOUND', `no job ${job_id}`);
      return { job: costed(r.job) };
    },

    list_jobs({ limit = 10 } = {}) {
      return { jobs: listOwnJobs(config.jobsDir, limit).map(shown) };
    },
  };

  // A job whose own job.json or manifest.json is not that job's file (contract 1.1 §5) is, for a tool, a
  // job that is not there: the answer is JOB_NOT_FOUND, and its message names the job and says why.
  // Any other file error that reaches a tool's answer is one of the engine's OWN folders (the upload's are
  // answered where the upload is read): the engine's trouble, TOOLCHAIN_MISSING with a fixed message and no
  // path. The error's code goes to the log.
  const answerOf = (name) => (e) => {
    if (e instanceof JobUnreadable || e instanceof ManifestUnreadable) throw new EngineError('JOB_NOT_FOUND', e.message);
    if (isErrno(e)) {
      log(`${name}: a file error of the engine's own folders (${e.code})`);
      throw new EngineError('TOOLCHAIN_MISSING', OWN_FILES_FAILED);
    }
    throw e;
  };
  for (const [name, fn] of Object.entries(handlers)) {
    const notFound = answerOf(name);
    handlers[name] = (args) => {
      try {
        const r = fn(args);
        return r && typeof r.then === 'function' ? r.catch(notFound) : r;
      } catch (e) {
        return notFound(e);
      }
    };
  }

  return { handlers, doctor, ensureRunner, localUrl: () => localUrl(config) };
}
