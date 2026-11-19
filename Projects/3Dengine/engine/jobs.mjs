// The job files (contract §3): jobs/<job_id>/job.json, written atomically (temp file + rename) and
// changed only under a per-job lock file, because two processes write it: the MCP server (approve,
// cancel) and the runner (the steps). The bridge reads job.json directly.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { writeJsonAtomic, withFileLock } from './lib/atomic.mjs';

export const JOB_SCHEMA_ID = 'habait/job.v1';
export const JOB_ID_RE = /^[0-9a-f]{16}$/;

export const PERCENT = Object.freeze({
  queued: 0, tracing: 10, building: 25, rendering: 45, awaiting_approval: 55,
  skinning: 70, gating: 82, finishing: 88, packaging: 93, qa: 97, done: 100,
});
export const BEFORE_APPROVAL = Object.freeze(['queued', 'tracing', 'building', 'rendering', 'awaiting_approval']);
export const AFTER_APPROVAL = Object.freeze(['skinning', 'gating', 'finishing', 'packaging', 'qa', 'done']);
export const TERMINAL = Object.freeze(['done', 'review', 'failed', 'cancelled']);
export const STATES = Object.freeze([...BEFORE_APPROVAL, ...AFTER_APPROVAL, 'review', 'failed', 'cancelled']);

export const isTerminal = (state) => TERMINAL.includes(state);
// The stages a runner walks (contract 0.3 §1), in order; awaiting_approval is a wait between rendering and skinning.
export const STAGES = Object.freeze(['tracing', 'building', 'rendering', 'skinning', 'gating', 'finishing', 'packaging', 'qa']);
export const PRE_APPROVAL_STAGES = Object.freeze(['tracing', 'building', 'rendering']);
// A working state: the job is (or should be) moved by a live runner.
export const isWorking = (state) => state === 'queued' || STAGES.includes(state);

// job_id = first 16 hex of sha256(pdf_sha256 \n apartment \n mode \n engine version).
export function jobId({ pdfSha256, apartment, mode, version }) {
  return createHash('sha256').update(`${pdfSha256}\n${apartment}\n${mode}\n${version}`).digest('hex').slice(0, 16);
}

// The id of a DRAWING (contract 1.4 §3): the PDF and the candidate, and nothing of the job. It is what the reading
// tool is handed and writes into the plan, so every job of one drawing (any engine version, any mode) gives the
// same bytes of the plan. Sixteen hex characters: it passes the id rule of contract 1.2 (no leading hyphen).
export function drawingId(pdfSha256, apartment) {
  return createHash('sha256').update(`drawing\n${pdfSha256}\n${apartment}`).digest('hex').slice(0, 16);
}

export const jobDir = (jobsDir, id) => `${jobsDir}/${id}`;
export const jobFile = (jobsDir, id) => `${jobDir(jobsDir, id)}/job.json`;

// `version` = the engine version the job id was made with. Recorded so that the id can always be checked
// against the job's own input (checkJob, contract 1.1 §4).
export function newJob({ id, mode, now, input, capUsd = null, version }) {
  return {
    schema: JOB_SCHEMA_ID,
    job_id: id,
    ...(version === undefined ? {} : { engine_version: version }),
    mode,
    state: 'queued',
    percent: 0,
    created_at: now,
    updated_at: now,
    heartbeat_at: now,
    input,
    quote: null,
    approval: null,
    cost: { spent_usd: 0, cap_usd: capUsd },
    result: null,
    reason: null,
  };
}

// A job.json that is not the file of the job it was read for (contract 1.1 §5): it names another job or
// none, is not JSON, or is not a job file at all. The engine neither uses such a file nor writes through it.
export class JobUnreadable extends Error {
  constructor(id, why) {
    super(`job ${id}: job.json is not this job's file (${why})`);
    this.name = 'JobUnreadable';
    this.jobId = String(id);
    this.why = why;
  }
}

// A value from a file, shown in a message: short, and never more than one line.
const shown = (v) => JSON.stringify(v === undefined ? null : v).slice(0, 40).replace(/[\r\n]+/g, ' ');

// `job` as the job file of `id`, or JobUnreadable. What is checked is what the engine leans on when it
// builds a path or decides what to do next: the schema, the id, the state, and the two objects every
// reader opens (`input`, `cost`).
export function checkJob(job, id) {
  const bad = (why) => {
    throw new JobUnreadable(id, why);
  };
  if (!job || typeof job !== 'object' || Array.isArray(job)) bad('it is not a JSON object');
  if (job.schema !== JOB_SCHEMA_ID) bad(`its schema is ${shown(job.schema)}`);
  if (job.job_id !== id) bad(`it names job ${shown(job.job_id)}`);
  if (!STATES.includes(job.state)) bad(`its state is ${shown(job.state)}`);
  if (!job.input || typeof job.input !== 'object' || Array.isArray(job.input)) bad('it has no input');
  if (!job.cost || typeof job.cost !== 'object' || Array.isArray(job.cost)) bad('it has no cost');
  // The id is made from the input (jobId). A job file that says which engine version made it must still add
  // up: a hand that swaps the stored PDF and writes the new hash here changes the input, not the id.
  if ('engine_version' in job) {
    const made = typeof job.engine_version === 'string'
      ? jobId({ pdfSha256: job.input.pdf_sha256, apartment: job.input.apartment, mode: job.mode, version: job.engine_version }) : null;
    if (made !== id) bad('its id is not the id of its own input');
  }
  checkReview(job, bad);
  return job;
}

// What a stage throws when its own gate refused and a person has to look (contract 1.3 §4): the runner ends the
// job in `review` with this reason code, this message and these files. `files` maps a name of REVIEW_FILES to a
// path relative to the job folder. The message is the stage's own fixed sentence: never text of the PDF.
export class ReviewNeeded extends Error {
  constructor(code, message, files = {}) {
    super(message);
    this.name = 'ReviewNeeded';
    this.code = code;
    this.files = { ...files };
  }
}

export const REVIEW_FILES = Object.freeze(['report', 'overlay']);
const REVIEW_PATH_RE = /^[A-Za-z0-9._/-]+$/;

// The `review` record of a job file: there only while the state is `review`; a stage of the contract, a whole
// positive attempt, and files that are named by the contract and lie inside that attempt's own folder.
function checkReview(job, bad) {
  if (job.review === undefined || job.review === null) return;
  if (job.state !== 'review') bad('it carries a review record and is not in review');
  const r = job.review;
  if (typeof r !== 'object' || Array.isArray(r)) bad('its review record is not an object');
  if (Object.keys(r).sort().join(',') !== 'attempt,files,stage') bad('its review record has other fields than stage, attempt and files');
  if (!STAGES.includes(r.stage)) bad('its review record names no stage of the contract');
  if (!Number.isInteger(r.attempt) || r.attempt < 1) bad('its review record has no attempt number');
  if (!r.files || typeof r.files !== 'object' || Array.isArray(r.files)) bad('its review record has no files');
  const prefix = `stages/${r.stage}/attempt-${r.attempt}/`;
  for (const [name, p] of Object.entries(r.files)) {
    if (!REVIEW_FILES.includes(name)) bad('its review record names a file the contract does not');
    if (typeof p !== 'string' || !p.startsWith(prefix) || !REVIEW_PATH_RE.test(p) || p.split('/').includes('..')) {
      bad('its review record names a path outside its own attempt folder');
    }
  }
}

// Is there a folder at `p`? (Where a job's file belongs, a folder is something that is not that file.)
export const isFolder = (p) => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};

// What else must hold before a job's file is written: BOTH of a job's files are its own (contract 1.1 §5).
// manifest.mjs puts its check of manifest.json here when it is loaded (it imports this file, so this file
// cannot import it); every process of the engine loads it: the tools, the CLI, the runner.
let ownCheck = () => {};
export const setOwnCheck = (fn) => {
  ownCheck = fn;
};

// The job, or null when the id is malformed or there is no job.json. A file that is there and is not this
// job's throws JobUnreadable: a path is never built from an id that a file names for itself.
export function readJob(jobsDir, id) {
  if (!JOB_ID_RE.test(String(id))) return null;
  let text;
  try {
    text = fs.readFileSync(jobFile(jobsDir, id), 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    // A folder where job.json belongs is something there that is not this job's file (asked of the disk, not
    // of the error code, which is not the same on every system).
    if (isFolder(jobFile(jobsDir, id))) throw new JobUnreadable(id, 'it is not a file');
    throw e;
  }
  let job;
  try {
    job = JSON.parse(text);
  } catch {
    throw new JobUnreadable(id, 'it is not JSON');
  }
  return checkJob(job, id);
}

// Atomic write: temp file in the same folder, then rename over job.json. Written only under `id`, and only
// when the job names that id: a job that names another one (or none) is never written anywhere.
export function writeJob(jobsDir, job, id = job?.job_id) {
  if (!JOB_ID_RE.test(String(id))) throw new JobUnreadable(String(id), 'that is not a job id');
  checkJob(job, id);
  ownCheck(jobsDir, id);   // nothing is written to a job whose manifest.json is not its own (throws ManifestUnreadable)
  return writeJsonAtomic(jobFile(jobsDir, id), job);
}

// Run fn() holding jobs/<id>/job.lock. A lock older than staleMs is a crashed holder's and is taken over.
export function withJobLock(jobsDir, id, fn, { waitMs = 2000, staleMs = 10000 } = {}) {
  return withFileLock(`${jobDir(jobsDir, id)}/job.lock`, fn, { waitMs, staleMs, label: `job ${id}` });
}

// Read, change, write under the lock. `mutate(job)` returns the new job, or null to write nothing.
// Returns { job, written }; job is null when there is no such job.
export function updateJob(jobsDir, id, mutate, opts) {
  return withJobLock(jobsDir, id, () => {
    const job = readJob(jobsDir, id);
    if (!job) return { job: null, written: false };
    const next = mutate(structuredClone(job));
    if (!next) return { job, written: false };
    writeJob(jobsDir, next, id);   // under the id that was asked for, never under one the change put in
    return { job: next, written: true };
  }, opts);
}

export function setState(job, state, now) {
  job.state = state;
  if (state !== 'review') delete job.review;   // the record of a review lives only while the job is in review (contract 1.3 §4)
  if (state in PERCENT) job.percent = PERCENT[state];
  job.updated_at = now;
  job.heartbeat_at = now;
  return job;
}

// Every job under jobsDir, newest first (created_at, then job_id); unreadable folders are skipped.
// `accept(job)` may throw to leave a job out as well (readers that check more than job.json; manifest.mjs).
export function listJobs(jobsDir, limit = 10, { accept = () => true } = {}) {
  let names = [];
  try {
    names = fs.readdirSync(jobsDir).filter((n) => JOB_ID_RE.test(n));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  const jobs = [];
  for (const n of names) {
    try {
      const j = readJob(jobsDir, n);
      if (j && accept(j)) jobs.push(j);
    } catch { /* a half-written or foreign folder is not a job */ }
  }
  jobs.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '') || b.job_id.localeCompare(a.job_id));
  return jobs.slice(0, limit);
}

// One human line per job, for the CLI.
export function formatJob(job) {
  const extra = job.reason ? ` · ${job.reason.code}` : job.result ? ` · ${job.result.local_url}` : '';
  return `${job.job_id}  ${job.state.padEnd(17)} ${String(job.percent).padStart(3)}%  ${job.mode}  ${job.input?.pdf_name ?? ''}${extra}`;
}
