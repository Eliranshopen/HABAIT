// A job's workspace (contract 2.1 §2). The build and render tools write at fixed places INSIDE the pipeline tree:
//   Habait/tour360/apartments/<id> · 360walkaround/tours/<id> · Habait/tour360/out/<id>
// and cannot be told another place. So a job's files live in the job, jobs/<job id>/work/{apartment,tour,out}, and
// for the time a stage runs a tool the three names in the pipeline tree are directory junctions to them.
//   - a stage makes the names before it starts a tool (linkWorkspace) and removes them when it ends (unlinkWorkspace);
//   - a name that exists and is not a junction to THIS job's folder is never followed and never removed;
//   - removing a name removes the link, never what it points at.
import fs from 'node:fs';
import path from 'node:path';
import { JOB_ID_RE } from './jobs.mjs';

const fwd = (p) => String(p).replace(/\\/g, '/');
const ASCII_RE = /^[\x20-\x7E]+$/;

export const PARTS = Object.freeze(['apartment', 'tour', 'out']);
export const IN_THE_WAY = 'a name the build needs inside the pipeline folder is taken by something that is not this job\'s: nothing was touched';
export const BAD_WORK_PATH = 'the job folder\'s path has a character the build and render tools cannot work with (anything outside printable ASCII)';

export class WorkspaceError extends Error {
  constructor(what, message) {
    super(message);
    this.name = 'WorkspaceError';
    this.what = what;          // 'IN_THE_WAY' | 'PATH' | 'ID'
  }
}

// The id the tools are handed for a job, and the mark every process of that job's tools carries (lib/tool.mjs).
export function toolId(jobId) {
  if (!JOB_ID_RE.test(String(jobId))) throw new WorkspaceError('ID', 'a job id is sixteen hex characters');
  return `j${jobId}`;
}

// Where everything is: nothing is created here.
export function workspaceOf(config, jobDir, jobId) {
  const id = toolId(jobId);
  const work = `${fwd(jobDir)}/work`;
  const pipe = fwd(config.pipelineRoot);
  if (!ASCII_RE.test(work) || !ASCII_RE.test(pipe)) throw new WorkspaceError('PATH', BAD_WORK_PATH);
  return {
    id,
    work,
    apartment: `${work}/apartment`,
    tour: `${work}/tour`,
    out: `${work}/out`,
    noKeys: `${work}/no-keys`,               // the env root handed to the tools: a folder with no keys file
    toolLock: `${work}/blender.lock`,        // the lock path handed to the tool, the job's own (§5)
    logs: `${work}/logs`,
    links: {
      apartment: `${pipe}/Habait/tour360/apartments/${id}`,
      tour: `${pipe}/360walkaround/tours/${id}`,
      out: `${pipe}/Habait/tour360/out/${id}`,
    },
  };
}

const same = (a, b) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);

// 'free' (nothing there) · 'ours' (a junction to this job's folder) · 'other' (anything else)
export function linkState(link, target, fs_ = fs) {
  let st;
  try {
    st = fs_.lstatSync(link);
  } catch (e) {
    if (e.code === 'ENOENT') return 'free';
    return 'other';
  }
  if (!st.isSymbolicLink()) return 'other';
  try {
    return same(fwd(fs_.realpathSync(link)), fwd(fs_.realpathSync(target))) ? 'ours' : 'other';
  } catch {
    return 'other';              // a junction whose target is gone, or cannot be read: not ours to judge
  }
}

// Make the three folders of the job and the three names that lead to them. Throws WorkspaceError('IN_THE_WAY')
// before it creates anything when one of the names is taken by something else.
export function linkWorkspace(ws, fs_ = fs) {
  for (const part of PARTS) fs_.mkdirSync(ws[part], { recursive: true });
  fs_.mkdirSync(ws.noKeys, { recursive: true });
  fs_.mkdirSync(ws.logs, { recursive: true });
  const states = PARTS.map((part) => linkState(ws.links[part], ws[part], fs_));
  if (states.includes('other')) throw new WorkspaceError('IN_THE_WAY', IN_THE_WAY);
  PARTS.forEach((part, i) => {
    if (states[i] === 'ours') return;
    fs_.mkdirSync(path.dirname(ws.links[part]), { recursive: true });
    fs_.symlinkSync(ws[part], ws.links[part], 'junction');
  });
  return ws;
}

// Remove the three names (the links only). A name that is not this job's is left as it is. → how many were removed.
export function unlinkWorkspace(ws, fs_ = fs) {
  let n = 0;
  for (const part of PARTS) {
    if (linkState(ws.links[part], ws[part], fs_) !== 'ours') continue;
    try {
      fs_.rmdirSync(ws.links[part]);      // a junction is removed like an empty folder: the target stays
      n += 1;
    } catch { /* held for a moment: the next stage run, or the next job run, removes it */ }
  }
  return n;
}
