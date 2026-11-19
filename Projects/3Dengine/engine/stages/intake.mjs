// The intake (contract 1.1 §3, §4): the checked plan PDF is copied into the job folder as
// `input/source.pdf`, verified by its hash, and marked read-only. Not a runner stage (it is not in
// `index.mjs`): it runs inside `start_simulation`, under the job lock, before a runner exists.
// `verifyInput` is what a runner calls before its first stage: the proof is the hash, the read-only
// mark only guards against an accident.
import nodeFs from 'node:fs';
import { EngineError, UPLOAD_UNREADABLE, sha256Buffer } from '../inbox.mjs';
import { jobDir } from '../jobs.mjs';
import { sha256FileSync } from '../lib/hash.mjs';
import { toPosix } from '../lib/paths.mjs';
import { pidAlive } from '../lib/proc.mjs';

export const INPUT_REL = 'input/source.pdf';
export const inputFile = (jobsDir, id) => `${jobDir(jobsDir, id)}/${INPUT_REL}`;

const SHA_RE = /^[0-9a-f]{64}$/;
const TEMP_RE = /^source\.pdf\.(\d+)\.tmp$/;

function defaults(deps = {}) {
  const fs = deps.fs || nodeFs;
  return {
    fs,
    hashFile: deps.hashFile || sha256FileSync,
    hashBytes: deps.hashBytes || sha256Buffer,
    read: deps.read || ((from) => fs.readFileSync(from)),          // the one read of the upload
    write: deps.write || ((to, bytes) => fs.writeFileSync(to, bytes)),   // the write of the job's copy
    alive: deps.alive || pidAlive,
  };
}

const exists = (fs, file) => {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
};

// Is there something at `p` that is not what belongs there (`want`: 'file' or 'dir')? Nothing at all is fine.
function foreignAt(fs, p, want) {
  let st;
  try {
    st = fs.statSync(p);
  } catch {
    return false;
  }
  return want === 'dir' ? !st.isDirectory() : !st.isFile();
}

const removeQuietly = (fs, file) => {
  try {
    fs.rmSync(file, { force: true });
  } catch {
    // nothing to do: the caller reports the real failure
  }
};

// Read-only again when the mark was taken off.
function markReadOnly(fs, file) {
  if ((fs.statSync(file).mode & 0o222) !== 0) fs.chmodSync(file, 0o444);
}

export function intakePdf(jobsDir, id, source, sha256, deps) {
  const { fs, hashFile, hashBytes, read, write, alive } = defaults(deps);
  const target = toPosix(inputFile(jobsDir, id));
  const dir = target.slice(0, target.lastIndexOf('/'));
  // Something foreign in the job folder is named as such, never answered with a raw file error (which
  // would carry a local path), and never overwritten or removed.
  if (foreignAt(fs, dir, 'dir')) {
    throw new EngineError('NOT_A_PDF', `job ${id} holds something that is not a folder where its input folder (input) belongs; it is never overwritten`);
  }
  fs.mkdirSync(dir, { recursive: true });
  if (foreignAt(fs, target, 'file')) {
    throw new EngineError('NOT_A_PDF',
      `job ${id} already holds something that is not a file as its input (${INPUT_REL}); it is never overwritten`);
  }

  if (exists(fs, target)) {
    const have = hashFile(target);
    if (have !== sha256) {
      throw new EngineError('NOT_A_PDF',
        `job ${id} already holds another file as its input (${INPUT_REL}); it is never overwritten`);
    }
    markReadOnly(fs, target);
    return { path: target, bytes: fs.statSync(target).size, sha256: have, copied: false };
  }

  // Temp files of processes that died mid-copy are left-overs: remove them.
  for (const name of fs.readdirSync(dir)) {
    const m = TEMP_RE.exec(name);
    if (m && Number(m[1]) !== process.pid && !alive(Number(m[1]))) removeQuietly(fs, `${dir}/${name}`);
  }

  const temp = `${target}.${process.pid}.tmp`;
  // Something that is not a file at our own temp name (a folder) is foreign: named, never removed. Copying
  // onto it would end as a raw file error with a local path in it.
  if (foreignAt(fs, temp, 'file')) {
    throw new EngineError('NOT_A_PDF',
      `job ${id} holds something that is not a file at the intake's temp name (${INPUT_REL}.${process.pid}.tmp); it is never removed`);
  }
  removeQuietly(fs, temp); // a stale one of a dead process with the same pid
  // The upload is READ here and the job's copy is WRITTEN below, as two steps, so a failure is known for what
  // it is: a failed read is the upload's, NOT_A_PDF like every read of the upload (contract 1.1 §1); a failed
  // write is the job folder's and leaves as it is. One copy call did both, and could only guess: an upload
  // that had become a folder was blamed on the job folder (QA round 4).
  let bytes;
  try {
    bytes = read(source.path);
  } catch (e) {
    throw new EngineError('NOT_A_PDF', e?.code === 'ENOENT' ? 'the file is gone' : UPLOAD_UNREADABLE);
  }
  if (hashBytes(bytes) !== sha256) throw new EngineError('NOT_A_PDF', 'the file changed while it was being read');
  try {
    write(temp, bytes);
    fs.renameSync(temp, target);
  } catch (e) {
    removeQuietly(fs, temp);
    throw e;
  }
  fs.chmodSync(target, 0o444);
  return { path: target, bytes: fs.statSync(target).size, sha256, copied: true };
}

export function verifyInput(jobsDir, job, deps) {
  const { fs, hashFile } = defaults(deps);
  const file = inputFile(jobsDir, job.job_id);
  if (!exists(fs, file)) return { ok: false, why: 'missing' };
  const want = job.input?.pdf_sha256;
  if (typeof want !== 'string' || !SHA_RE.test(want)) return { ok: false, why: 'changed' };
  return hashFile(file) === want ? { ok: true } : { ok: false, why: 'changed' };
}
