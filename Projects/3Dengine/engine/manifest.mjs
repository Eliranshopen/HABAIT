// jobs/<job_id>/manifest.json (contract 0.3 §2): what was really done. One row per FINISHED stage
// attempt, appended only after the stage's outputs are on the disk; an interrupted stage leaves no row.
// Written atomically, by the job's runner only (one live runner per job, held by runner.pid).
import fs from 'node:fs';
import { jobDir, JOB_ID_RE, STAGES, readJob, listJobs, isFolder, setOwnCheck } from './jobs.mjs';
import { writeJsonAtomic } from './lib/atomic.mjs';
import { sha256FileSync, sha256Text } from './lib/hash.mjs';

export const MANIFEST_SCHEMA_ID = 'habait/manifest.v1';

export const manifestFile = (jobsDir, id) => `${jobDir(jobsDir, id)}/manifest.json`;

export function emptyManifest(id) {
  return { schema: MANIFEST_SCHEMA_ID, job_id: id, rows: [] };
}

// A manifest.json that is not the manifest of the job it was read for (contract 1.1 §5): it names another
// job or none, is not JSON, or has a row the engine cannot stand on. Never used, never written through.
export class ManifestUnreadable extends Error {
  constructor(id, why) {
    super(`job ${id}: manifest.json is not this job's file (${why})`);
    this.name = 'ManifestUnreadable';
    this.jobId = String(id);
    this.why = why;
  }
}

const HEX64 = /^[0-9a-f]{64}$/;
const shown = (v) => JSON.stringify(v === undefined ? null : v).slice(0, 40).replace(/[\r\n]+/g, ' ');

// Is `p` a path that stays inside the job folder? Relative, no drive, no leading slash, no `..` part.
export function insideJob(p) {
  if (typeof p !== 'string' || p === '' || p.includes('\0')) return false;
  if (/^[A-Za-z]:/.test(p) || p.startsWith('/') || p.startsWith('\\')) return false;
  return !p.split(/[\\/]+/).some((part) => part === '..');
}

// `doc` as the manifest of `id`, or ManifestUnreadable. A row is checked for what the resume rule reads:
// its stage, its attempt, its inputs hash, and outputs that are hashed files INSIDE the job folder.
export function checkManifest(doc, id) {
  const bad = (why) => {
    throw new ManifestUnreadable(id, why);
  };
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) bad('it is not a JSON object');
  if (doc.schema !== MANIFEST_SCHEMA_ID) bad(`its schema is ${shown(doc.schema)}`);
  if (doc.job_id !== id) bad(`it names job ${shown(doc.job_id)}`);
  if (!Array.isArray(doc.rows)) bad('it has no rows');
  doc.rows.forEach((r, i) => {
    const at = `row ${i + 1}`;
    if (!r || typeof r !== 'object' || Array.isArray(r)) bad(`${at} is not an object`);
    if (!STAGES.includes(r.stage)) bad(`${at} names no stage of the engine`);
    if (!Number.isInteger(r.attempt) || r.attempt < 1) bad(`${at} has no attempt number`);
    if (typeof r.status !== 'string') bad(`${at} has no status`);
    if (typeof r.inputs_sha256 !== 'string' || !HEX64.test(r.inputs_sha256)) bad(`${at} has no inputs hash`);
    if (!Array.isArray(r.outputs)) bad(`${at} has no outputs`);
    r.outputs.forEach((o, k) => {
      const out = `${at}, output ${k + 1}`;
      if (!o || typeof o !== 'object' || Array.isArray(o)) bad(`${out} is not an object`);
      if (!insideJob(o.path)) bad(`${out}: its path is not inside the job folder`);
      if (typeof o.sha256 !== 'string' || !HEX64.test(o.sha256)) bad(`${out} has no hash`);
      if (!Number.isInteger(o.bytes) || o.bytes < 0) bad(`${out} has no size`);
    });
  });
  return doc;
}

// The manifest, or an empty one when the file does not exist yet. A file that is there and is not this
// job's manifest throws ManifestUnreadable.
export function readManifest(jobsDir, id) {
  let text;
  try {
    text = fs.readFileSync(manifestFile(jobsDir, id), 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return emptyManifest(id);
    // A folder where manifest.json belongs is something there that is not this job's manifest.
    if (isFolder(manifestFile(jobsDir, id))) throw new ManifestUnreadable(id, 'it is not a file');
    throw e;
  }
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new ManifestUnreadable(id, 'it is not JSON');
  }
  return checkManifest(doc, id);
}

// job.json is never written when manifest.json is not this job's (contract 1.1 §5): every write of a job file
// (writeJob in jobs.mjs) asks here first. A job with no manifest yet passes.
setOwnCheck((jobsDir, id) => {
  readManifest(jobsDir, id);
});

// A job's files are read only when they are this job's (contract 1.1 §5), BOTH of them: the job, or null
// when there is none; JobUnreadable when job.json is not its file, ManifestUnreadable when manifest.json
// is there and is not its manifest. A job with no manifest yet is a job. (Here and not in jobs.mjs, which
// manifest.mjs imports.)
export function readOwnJob(jobsDir, id) {
  const job = readJob(jobsDir, id);
  if (job) readManifest(jobsDir, id);
  return job;
}

// listJobs, leaving out a job whose manifest.json is not its own as well.
export function listOwnJobs(jobsDir, limit = 10) {
  return listJobs(jobsDir, limit, { accept: (job) => Boolean(readManifest(jobsDir, job.job_id)) });
}

// Written only when the document is a manifest, and only under the id it names.
export function writeManifest(jobsDir, doc) {
  const id = doc?.job_id;
  if (typeof id !== 'string' || !JOB_ID_RE.test(id)) throw new ManifestUnreadable(String(id), 'it has no job id');
  checkManifest(doc, id);
  return writeJsonAtomic(manifestFile(jobsDir, id), doc);
}

// sha256 of what a stage's result depends on: the PDF, the apartment, the mode, the engine version, the
// stage, and the output hashes of the previous stage's row (empty for the first stage).
export function inputsSha256({ pdfSha256, apartment, mode, version, stage, prevOutputs = [] }) {
  return sha256Text(JSON.stringify({ pdf_sha256: pdfSha256, apartment, mode, version, stage,
    prev_outputs: prevOutputs.map((o) => o.sha256) }));
}

// Is every output of the row on the disk with the same hash? Paths are relative to the job folder.
export function outputsIntact(dir, outputs) {
  for (const o of outputs || []) {
    const file = `${dir}/${o.path}`;
    try {
      if (fs.statSync(file).size !== o.bytes) return false;
      if (sha256FileSync(file) !== o.sha256) return false;
    } catch {
      return false;
    }
  }
  return true;
}

// The resume rule: the done, not superseded row of `stage` with these inputs whose outputs are intact.
export function validRow(doc, { stage, inputs, dir }) {
  for (let i = doc.rows.length - 1; i >= 0; i--) {
    const r = doc.rows[i];
    if (r.stage !== stage || r.status !== 'done' || r.superseded || r.inputs_sha256 !== inputs) continue;
    if (outputsIntact(dir, r.outputs)) return r;
  }
  return null;
}

// Walk the stages in order: for each, its inputs hash (chained from the previous valid row) and its
// valid row or null. Stops at the first stage with no valid row (later stages cannot be valid).
export function walkManifest(doc, job, { version, dir, stages = STAGES }) {
  const base = { pdfSha256: job.input.pdf_sha256, apartment: job.input.apartment, mode: job.mode, version };
  const out = [];
  let prevOutputs = [];
  for (const stage of stages) {
    const inputs = inputsSha256({ ...base, stage, prevOutputs });
    const row = validRow(doc, { stage, inputs, dir });
    out.push({ stage, inputs, row });
    if (!row) break;
    prevOutputs = row.outputs;
  }
  return out;
}

// The first stage with no valid row, or null when every stage has one.
export function firstInvalidStage(doc, job, opts) {
  const walk = walkManifest(doc, job, opts);
  const miss = walk.find((w) => !w.row);
  return miss ? miss.stage : null;
}

// Mark every done row of `stage` that is not `keep` as superseded (kept, never deleted).
export function supersede(doc, stage, keepInputs) {
  let n = 0;
  for (const r of doc.rows) {
    if (r.stage === stage && r.status === 'done' && !r.superseded) {
      if (keepInputs !== undefined && r.inputs_sha256 === keepInputs) continue;
      r.superseded = true;
      n++;
    }
  }
  return n;
}

// Append one row (after the stage's outputs are on the disk). Earlier done rows of the same stage are
// superseded: they no longer describe what the job holds.
export function appendRow(jobsDir, id, row) {
  const doc = readManifest(jobsDir, id);
  supersede(doc, row.stage);
  doc.rows.push(row);
  writeManifest(jobsDir, doc);
  return doc;
}
