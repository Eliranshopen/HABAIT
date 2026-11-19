// The engine's ONE way to start a render of camera points (contract 2.1 §1, §4):
//   pipeline/Habait/tour360/tools/run-project.mjs <id> --plan <plan> --crop <crop> --steps render
//                                                  --render-points <point> --res <WxH> --samples <n>
// The tool starts render_tour.mjs, which builds the scene when it is missing or stale (a Blender run) and renders
// the point (a Blender run). Nothing else in the engine starts it. The same rules as engine/build.mjs: checked
// values only, free, the tool's words to a log file, asynchronous, bounded, stopped as a whole tree.
//
// The machine's Blender lock is NOT taken here: the stage holds it around this call (engine/blender-lock.mjs). The
// tool takes a lock of its own, and is handed a lock path that is the job's (toolEnv), removed before every start.
import fs from 'node:fs';
import { startAndWait, killTree, KILL_WAIT_MS } from './lib/tool.mjs';
import { projectTool, toolEnv, POINT_RE, BuildUsageError } from './build.mjs';
import { sha256Text } from './lib/hash.mjs';

const fwd = (p) => String(p).replace(/\\/g, '/');
const ASCII_RE = /^[\x20-\x7E]+$/;

export const ROOM_FILES = Object.freeze(['pano.webp', 'depth.png', 'pano.render.json']);     // what the tool leaves for a point
export const pointDir = (ws, point) => `${ws.tour}/renders/${point}`;

// The hash of a room's inputs (§4): everything before the stage, the point, the size and the samples.
export function roomInputs(stageInputs, point, render) {
  return sha256Text(`room\n${stageInputs}\n${point}\n${render.res}\n${render.samples}`);
}

export function renderCommand(config, ws, { plan, crop, point }, baseEnv = process.env) {
  if (typeof point !== 'string' || !POINT_RE.test(point)) throw new BuildUsageError('POINTS', 'a camera point is cp- and letters or digits');
  for (const p of [plan, crop, ws.work]) {
    if (typeof p !== 'string' || !ASCII_RE.test(p)) throw new BuildUsageError('PATH', 'a path handed to the render has a character outside printable ASCII');
  }
  return {
    command: process.execPath,
    args: [projectTool(config), ws.id, '--plan', fwd(plan), '--crop', fwd(crop), '--steps', 'render',
      '--render-points', point, '--res', config.render.res, '--samples', String(config.render.samples)],
    cwd: fwd(config.pipelineRoot),
    env: toolEnv(config, ws, baseEnv),
  };
}

// Render ONE point. → { outcome: 'DONE' | 'FAILED' | 'NO_FILES' | 'TIMEOUT' | 'CANCELLED' | 'NOT_STARTED', exit, seconds, logFile }
// `log` names the log file inside the workspace (the stage names it by the room's place, never by the point).
export async function runRender(config, { ws, plan, crop, point, log = 'render.log', signal }, deps = {}) {
  const d = { fs, clock: () => Date.now(), env: process.env, killTree, killWaitMs: KILL_WAIT_MS, ...deps };
  const cmd = renderCommand(config, ws, { plan, crop, point }, d.env);
  if (signal?.aborted) return { outcome: 'CANCELLED', exit: null, seconds: 0, logFile: null };
  const logFile = `${ws.logs}/${log}`;
  d.fs.mkdirSync(ws.logs, { recursive: true });
  d.fs.rmSync(ws.toolLock, { force: true });         // the tool's own lock of an earlier, killed run of this job
  const started = d.clock();
  const ended = await startAndWait(cmd, logFile, { timeoutMs: config.render.timeoutSeconds * 1000, signal, killWaitMs: d.killWaitMs }, d);
  const base = { exit: ended.code, seconds: Number(((d.clock() - started) / 1000).toFixed(1)), logFile };
  if (ended.why === 'not-started') return { ...base, outcome: 'NOT_STARTED' };
  if (ended.why === 'timeout') return { ...base, outcome: 'TIMEOUT' };
  if (ended.why === 'cancelled') return { ...base, outcome: 'CANCELLED' };
  if (ended.code !== 0) return { ...base, outcome: 'FAILED' };
  const dir = pointDir(ws, point);
  if (!ROOM_FILES.every((f) => d.fs.existsSync(`${dir}/${f}`))) return { ...base, outcome: 'NO_FILES' };
  return { ...base, outcome: 'DONE' };
}
