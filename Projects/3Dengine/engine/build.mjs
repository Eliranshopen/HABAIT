// The engine's ONE way to start the build steps of the brought-in chain (contract 2.1 §1, §3):
//   pipeline/Habait/tour360/tools/run-project.mjs <id> --plan <plan> --crop <crop> --steps apartment,casework,cameras,furnish
// It turns the plan the reading made into the files Blender builds a scene from. Nothing else in the engine starts it.
//
// The rules that live here, each at one place:
//   1. Every value handed to the tool is an absolute path, a checked id or a fixed word (the tools find their flags
//      by their text anywhere in the command).
//   2. FREE: the tool gets a fixed word in place of a key, no other key name, and an env root with no keys file (it
//      reads a keys file at its start when the fal name is unset).
//   3. Nothing returned or thrown carries text of the drawing: the tool's output goes to a log file in the job's
//      workspace, and what is read back from its files is counts, fixed step names and checked point names.
//   4. The run is asynchronous, bounded, and stopped as a whole process tree (lib/tool.mjs).
import fs from 'node:fs';
import { pipelineEnv } from './config.mjs';
import { startAndWait, killTree, KILL_WAIT_MS } from './lib/tool.mjs';
import { FREE_RUN_NAME, FREE_RUN_WORD } from './trace.mjs';

const fwd = (p) => String(p).replace(/\\/g, '/');
const ASCII_RE = /^[\x20-\x7E]+$/;

export const BUILD_STEPS = Object.freeze(['apartment', 'casework', 'cameras', 'furnish']);
// The nine values the reading tool maps every room to (its ROOM_TYPE table): a plan it made carries no other.
export const ROOM_TYPES = Object.freeze(['hall', 'living', 'kitchen', 'bedroom', 'bathroom', 'storage', 'balcony', 'safe_room', 'other']);
export const POINT_RE = /^cp-[A-Za-z0-9]{1,60}$/;         // a camera point: never a leading hyphen, never a flag
export const MAX_PLAN_BYTES = 20 * 1024 * 1024;

// The files of fixed names the four steps write (contract 2.1 §3), relative to the job's work folder. They are the
// same bytes in every run from the same input in the same job.
// Two of them exist only for a drawing that has vector lines (the reading wrote `pdf-vectors.json`).
export const OPTIONAL_OUTPUTS = Object.freeze(['apartment/_local/plan/pdf-vectors.json', 'apartment/_local/plan/trace-plan.json']);
export const BUILD_OUTPUTS = Object.freeze([
  'apartment/plan.general.json', 'apartment/cameras.json', 'apartment/apartment.json', 'apartment/material-board.json',
  'apartment/_local/plan/plan-crop.png', 'apartment/_local/plan/pdf-vectors.json', 'apartment/_local/plan/trace-plan.json',
  'tour/plan.base.json', 'tour/plan.json',
  'tour/_furnish/placements.json', 'tour/_furnish/plan.furnished.json', 'tour/_furnish/report.json',
]);

export class BuildUsageError extends Error {
  constructor(what, message) {
    super(message);
    this.name = 'BuildUsageError';
    this.what = what;            // 'PLAN' | 'ROOM_TYPE' | 'POINTS' | 'PATH'
  }
}

export const projectTool = (config) => `${fwd(config.pipelineRoot)}/Habait/tour360/tools/run-project.mjs`;

// The environment of a build or render tool: the engine's pointers, no key, an env root with no keys file, and
// a Blender lock path of the job's own (§5: the machine's lock is held by the engine, not by the tool).
export function toolEnv(config, ws, baseEnv = process.env) {
  const env = { ...baseEnv, ...pipelineEnv(config), PYTHONIOENCODING: 'utf-8', HABAIT_ENV_ROOT: ws.noKeys, HABAIT_BLENDER_LOCK: ws.toolLock };
  const names = new Set([...(config.keys || []), FREE_RUN_NAME].map((k) => k.toUpperCase()));       // Windows reads a name in any case
  for (const k of Object.keys(env)) if (names.has(k.toUpperCase())) delete env[k];
  env[FREE_RUN_NAME] = FREE_RUN_WORD;
  return env;
}

function readJson(file, fs_, what) {
  let st;
  try {
    st = fs_.statSync(file);
  } catch {
    throw new BuildUsageError(what, 'the plan of the drawing is not where the reading left it');
  }
  if (!st.isFile() || st.size > MAX_PLAN_BYTES) throw new BuildUsageError(what, 'the plan of the drawing is not a file the build can read');
  try {
    const doc = JSON.parse(fs_.readFileSync(file, 'utf8'));
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new Error('not an object');
    return doc;
  } catch {
    throw new BuildUsageError(what, 'the plan of the drawing is not readable JSON');
  }
}

// What the engine checks of the reading's plan BEFORE any tool starts (§3): it has rooms, and every room's type is
// one the reading tool makes. → { rooms, other }. The sentence of a refusal gives counts, never a word of the plan.
export function checkPlan(planFile, fs_ = fs) {
  const plan = readJson(planFile, fs_, 'PLAN');
  const rooms = Array.isArray(plan.rooms) ? plan.rooms : [];
  if (rooms.length === 0) throw new BuildUsageError('PLAN', 'the plan of the drawing has no rooms');
  const unknown = rooms.filter((r) => !r || typeof r !== 'object' || !ROOM_TYPES.includes(r.type)).length;
  if (unknown > 0) {
    throw new BuildUsageError('ROOM_TYPE', `${unknown} of the ${rooms.length} rooms of the plan carry a type the build does not know: the plan was not left as the reading tool made it`);
  }
  return { rooms: rooms.length, other: rooms.filter((r) => r.type === 'other').length };
}

// The camera points of the BUILT plan, in its order. A point whose name is not `cp-` and letters or digits is refused:
// it is handed to the tool as an argument.
export function builtPoints(ws, fs_ = fs) {
  const plan = readJson(`${ws.apartment}/plan.general.json`, fs_, 'POINTS');
  const points = Array.isArray(plan.camera_points) ? plan.camera_points.map((p) => (p && typeof p === 'object' ? p.id : null)) : [];
  if (points.length === 0) throw new BuildUsageError('POINTS', 'the built plan has no camera points');
  if (points.some((id) => typeof id !== 'string' || !POINT_RE.test(id)) || new Set(points).size !== points.length) {
    throw new BuildUsageError('POINTS', 'the built plan names a camera point the render cannot be handed');
  }
  return points;
}

export function buildCommand(config, ws, { plan, crop }, baseEnv = process.env) {
  for (const p of [plan, crop, ws.work]) {
    if (typeof p !== 'string' || !ASCII_RE.test(p)) throw new BuildUsageError('PATH', 'a path handed to the build has a character outside printable ASCII');
  }
  return {
    command: process.execPath,
    args: [projectTool(config), ws.id, '--plan', fwd(plan), '--crop', fwd(crop), '--steps', BUILD_STEPS.join(',')],
    cwd: fwd(config.pipelineRoot),
    env: toolEnv(config, ws, baseEnv),
  };
}

// Which step the tool's own table says did not end well: one of the four fixed names, or null.
export function failedStep(ws, fs_ = fs) {
  try {
    const pkg = JSON.parse(fs_.readFileSync(`${ws.out}/package/package.json`, 'utf8'));
    const steps = pkg && typeof pkg.steps === 'object' && pkg.steps ? pkg.steps : {};
    for (const s of BUILD_STEPS) if (!steps[s] || steps[s].ok === false) return s;
  } catch { /* the tool did not get as far as its table */ }
  return null;
}

// Run the four build steps once. → { outcome: 'DONE' | 'FAILED' | 'TIMEOUT' | 'CANCELLED' | 'NOT_STARTED', exit, seconds, step, logFile }
// The workspace's three names must be in place (workspace.mjs) and the plan checked (checkPlan) by the caller.
export async function runBuild(config, { ws, plan, crop, signal }, deps = {}) {
  const d = { fs, clock: () => Date.now(), env: process.env, killTree, killWaitMs: KILL_WAIT_MS, ...deps };
  const cmd = buildCommand(config, ws, { plan, crop }, d.env);
  const logFile = `${ws.logs}/build.log`;
  if (signal?.aborted) return { outcome: 'CANCELLED', exit: null, seconds: 0, step: null, logFile: null };
  d.fs.mkdirSync(ws.logs, { recursive: true });
  d.fs.rmSync(`${ws.out}/package/package.json`, { force: true });      // the tool's own step table, of an earlier run
  const started = d.clock();
  const ended = await startAndWait(cmd, logFile, { timeoutMs: config.build.timeoutSeconds * 1000, signal, killWaitMs: d.killWaitMs }, d);
  const base = { exit: ended.code, seconds: Number(((d.clock() - started) / 1000).toFixed(1)), logFile };
  if (ended.why === 'not-started') return { ...base, outcome: 'NOT_STARTED', step: null };
  if (ended.why === 'timeout') return { ...base, outcome: 'TIMEOUT', step: failedStep(ws, d.fs) };
  if (ended.why === 'cancelled') return { ...base, outcome: 'CANCELLED', step: null };
  if (ended.code !== 0) return { ...base, outcome: 'FAILED', step: failedStep(ws, d.fs) };
  return { ...base, outcome: 'DONE', step: null };
}
