// Stage "building" (contract 0.3 §1): implementations by mode.
//   stub  the timer of milestone 0.3.
//   real  (milestone 2.1, contract 2.1 §3) the four build steps of the brought-in chain (apartment, casework,
//         cameras, furnish), through engine/build.mjs, on the plan the reading stage left, in the job's own
//         workspace (engine/workspace.mjs). Free. Its outputs are the files of fixed names the steps write; they
//         are the same bytes in every attempt.
import fs from 'node:fs';
import path from 'node:path';
import { stubStage } from './stub.mjs';
import { readManifest } from '../manifest.mjs';
import { EngineError } from '../inbox.mjs';
import { isTransient } from '../lib/atomic.mjs';
import { stopNaming } from '../lib/tool.mjs';
import { workspaceOf, linkWorkspace, unlinkWorkspace, WorkspaceError, IN_THE_WAY, BAD_WORK_PATH } from '../workspace.mjs';
import { runBuild, checkPlan, builtPoints, BuildUsageError, BUILD_OUTPUTS, OPTIONAL_OUTPUTS } from '../build.mjs';

export const name = 'building';
export const stub = stubStage(name);

export const POLL_MS = 500;            // how often the stage asks the runner whether it must stop
export const NO_READING_FILES = 'the plan and the picture of the drawing are not where the reading stage left them';
// The fixed sentences of a build that did not end well, by the step the tool's own table names.
export const STEP_SENTENCE = Object.freeze({
  apartment: 'the build could not set the apartment up from the plan',
  casework: 'the build could not place the kitchen and the fixtures',
  cameras: 'the build could not place a camera in every room',
  furnish: 'the build could not furnish the rooms',
});
export const OUTCOMES = Object.freeze({
  NOT_STARTED: Object.freeze({ fail: 'TOOLCHAIN_MISSING', message: 'the build tool could not be started' }),
  TIMEOUT: Object.freeze({ fail: 'STAGE_FAILED', message: 'the build did not end in time' }),
  FAILED: Object.freeze({ fail: 'STAGE_FAILED', message: 'a step of the build failed' }),
});

// The plan and the picture of the drawing, as the job's reading stage left them: the outputs of its manifest row.
export function readingFiles(jobDir, jobId, deps = {}) {
  const d = { readManifest, fs, ...deps };
  let rows;
  try {
    rows = d.readManifest(path.dirname(jobDir), jobId).rows;
  } catch {
    throw new EngineError('STAGE_FAILED', NO_READING_FILES);
  }
  const row = [...rows].reverse().find((r) => r.stage === 'tracing' && r.status === 'done' && !r.superseded);
  const pick = (base) => (row?.outputs || []).map((o) => o.path).find((p) => typeof p === 'string' && p.endsWith(`/${base}`));
  const plan = pick('plan.general.json');
  const crop = pick('crop.png');
  if (!plan || !crop || path.dirname(plan) !== path.dirname(crop)) throw new EngineError('STAGE_FAILED', NO_READING_FILES);
  return { plan: `${jobDir}/${plan}`, crop: `${jobDir}/${crop}` };
}

// The real implementation. `deps` is for the tests: a fake tool, a fake workspace, a fake timer.
export function realStage(deps = {}) {
  const d = { fs, runBuild, checkPlan, builtPoints, readingFiles, linkWorkspace, unlinkWorkspace, stopNaming, pollMs: POLL_MS, setInterval, clearInterval, ...deps };
  return {
    async run(ctx) {
      const { job, config } = ctx;
      let ws;
      try {
        ws = workspaceOf(config, ctx.jobDir, job.job_id);
      } catch (e) {
        if (e instanceof WorkspaceError) throw new EngineError(e.what === 'PATH' ? 'TOOLCHAIN_MISSING' : 'STAGE_FAILED', e.what === 'PATH' ? BAD_WORK_PATH : e.message);
        throw e;
      }
      const src = d.readingFiles(ctx.jobDir, job.job_id, { fs: d.fs });
      // Before any tool starts: is this a plan the reading tool made? (a room type outside its list is not)
      let seen;
      try {
        seen = d.checkPlan(src.plan, d.fs);
      } catch (e) {
        if (e instanceof BuildUsageError) throw new EngineError('STAGE_FAILED', e.message);
        throw e;
      }
      // Whatever an earlier, killed run of this job left running must not write the workspace beside this one.
      d.stopNaming(ws.id);
      try {
        d.linkWorkspace(ws, d.fs);
      } catch (e) {
        if (e instanceof WorkspaceError) throw new EngineError('STAGE_FAILED', IN_THE_WAY);
        throw e;
      }
      // While the tool runs: must the stage stop? A passing file error of that question is not a stop.
      const ac = new AbortController();
      let stop = null;
      const timer = d.setInterval(() => {
        if (stop) return;
        try {
          ctx.checkCancelled();
        } catch (e) {
          if (isTransient(e)) return;
          stop = e;
          ac.abort();
        }
      }, d.pollMs);
      let r;
      try {
        r = await d.runBuild(config, { ws, plan: src.plan, crop: src.crop, signal: ac.signal });
      } catch (e) {
        if (e instanceof BuildUsageError) throw new EngineError(e.what === 'PATH' ? 'TOOLCHAIN_MISSING' : 'STAGE_FAILED', e.what === 'PATH' ? BAD_WORK_PATH : e.message);
        throw e;
      } finally {
        d.clearInterval(timer);
        d.unlinkWorkspace(ws, d.fs);       // the three names are in the pipeline tree only while a tool runs
      }
      if (stop) throw stop;                // exactly what the runner threw: it knows what to do with it
      ctx.checkCancelled();                // and once more: the job may have left the stage as the tool ended

      if (r.outcome !== 'DONE') {
        const row = OUTCOMES[r.outcome] || OUTCOMES.FAILED;
        const sentence = r.outcome === 'FAILED' && r.step ? STEP_SENTENCE[r.step] : row.message;
        ctx.log(`the build did not end well: ${r.outcome}${r.step ? `, at the step ${r.step}` : ''}, exit ${r.exit ?? '?'}, ${r.seconds} s`);
        throw new EngineError(row.fail, sentence);
      }
      let points;
      try {
        points = d.builtPoints(ws, d.fs);
      } catch (e) {
        if (e instanceof BuildUsageError) throw new EngineError('STAGE_FAILED', e.message);
        throw e;
      }
      const outputs = [];
      for (const f of BUILD_OUTPUTS) {
        if (d.fs.existsSync(`${ws.work}/${f}`)) outputs.push({ path: `work/${f}` });
        else if (!OPTIONAL_OUTPUTS.includes(f)) throw new EngineError('STAGE_FAILED', 'the build ended without one of the files it always writes');
      }
      ctx.log(`built: ${seen.rooms} rooms (${seen.other} of type other), ${points.length} camera points, ${outputs.length} files, ${r.seconds} s`);
      return { outputs, detail: { rooms: seen.rooms, rooms_other: seen.other, points: points.length, seconds: r.seconds } };
    },
  };
}

export const real = realStage();
