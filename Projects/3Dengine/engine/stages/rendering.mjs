// Stage "rendering" (contract 0.3 §1): implementations by mode.
//   stub  the timer of milestone 0.3.
//   real  (milestone 2.1, contract 2.1 §4 to §6) the render of the built apartment, ONE ROOM AT A TIME, through
//         engine/render.mjs, under the machine's Blender lock (engine/blender-lock.mjs). Free.
//         - a room the job HOLDS is never rendered again: its row is there, names the same inputs, and its three kept
//           files re-hash to what the row says;
//         - a room is kept as a copy of the tool's three files, under a name that is its place in the plan's order
//           (the point's own name comes from the drawing and stays in the tools' files);
//         - the row is written last, so a kill in the middle of a room leaves that room without one.
import fs from 'node:fs';
import { stubStage } from './stub.mjs';
import { readingFiles } from './building.mjs';
import { EngineError } from '../inbox.mjs';
import { isTransient, writeFileAtomic } from '../lib/atomic.mjs';
import { sha256FileSync } from '../lib/hash.mjs';
import { stopNaming } from '../lib/tool.mjs';
import { workspaceOf, linkWorkspace, unlinkWorkspace, WorkspaceError, IN_THE_WAY, BAD_WORK_PATH } from '../workspace.mjs';
import { builtPoints, BuildUsageError } from '../build.mjs';
import { runRender, roomInputs, pointDir, ROOM_FILES } from '../render.mjs';
import { tryTake, release } from '../blender-lock.mjs';

export const name = 'rendering';
export const stub = stubStage(name);

export const POLL_MS = 500;                 // how often the stage asks the runner whether it must stop
export const ROOM_SCHEMA_ID = 'habait/room.v1';
export const ROOMS_REL = `stages/${name}/rooms`;
export const WAITING = 'blender-lock';      // what the job says it waits for (job.waiting_for)
export const UNKNOWN_POINT = 'the settings name a camera point that the built plan does not have';
export const OUTCOMES = Object.freeze({
  NOT_STARTED: Object.freeze({ fail: 'TOOLCHAIN_MISSING', what: 'the render tool could not be started' }),
  TIMEOUT: Object.freeze({ fail: 'STAGE_FAILED', what: 'did not end in time' }),
  FAILED: Object.freeze({ fail: 'STAGE_FAILED', what: 'failed' }),
  NO_FILES: Object.freeze({ fail: 'STAGE_FAILED', what: 'ended without its three files' }),
});

export const roomName = (place) => `room-${String(place).padStart(2, '0')}`;
const isSha = (v) => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);

// Does the job hold this room? Its row names this place and these inputs, and the three kept files re-hash to it.
// → the row, or null. A row that does not add up is no row.
export function heldRoom(jobDir, place, inputs, fs_ = fs) {
  const base = `${jobDir}/${ROOMS_REL}/${roomName(place)}`;
  let row;
  try {
    row = JSON.parse(fs_.readFileSync(`${base}.json`, 'utf8'));
  } catch {
    return null;
  }
  if (!row || typeof row !== 'object' || row.schema !== ROOM_SCHEMA_ID || row.place !== place || row.inputs_sha256 !== inputs) return null;
  if (!Array.isArray(row.files) || row.files.length !== ROOM_FILES.length) return null;
  for (let i = 0; i < ROOM_FILES.length; i++) {
    const f = row.files[i];
    if (!f || f.name !== ROOM_FILES[i] || !isSha(f.sha256) || !Number.isInteger(f.bytes)) return null;
    try {
      if (fs_.statSync(`${base}/${f.name}`).size !== f.bytes || sha256FileSync(`${base}/${f.name}`) !== f.sha256) return null;
    } catch {
      return null;
    }
  }
  return row;
}

// The tool's own copy of a held room, in the workspace, is put back from the kept one when it is gone or changed:
// the stages after this one read it there.
export function restoreRoom(jobDir, ws, point, row, fs_ = fs) {
  const kept = `${jobDir}/${ROOMS_REL}/${roomName(row.place)}`;
  const dir = pointDir(ws, point);
  let put = 0;
  for (const f of row.files) {
    let same = false;
    try {
      same = fs_.statSync(`${dir}/${f.name}`).size === f.bytes && sha256FileSync(`${dir}/${f.name}`) === f.sha256;
    } catch { /* gone */ }
    if (same) continue;
    fs_.mkdirSync(dir, { recursive: true });
    fs_.copyFileSync(`${kept}/${f.name}`, `${dir}/${f.name}`);
    put += 1;
  }
  return put;
}

// Keep a room the tool just rendered: the three files copied into the job's own folder of that place, then the row.
export function keepRoom(jobDir, ws, point, { place, inputs, render, seconds, attempt, now }, fs_ = fs) {
  const kept = `${jobDir}/${ROOMS_REL}/${roomName(place)}`;
  const from = pointDir(ws, point);
  fs_.rmSync(`${kept}.json`, { force: true });           // whatever row was there is no row from here on
  fs_.rmSync(kept, { recursive: true, force: true });
  fs_.mkdirSync(kept, { recursive: true });
  const files = ROOM_FILES.map((f) => {
    fs_.copyFileSync(`${from}/${f}`, `${kept}/${f}`);
    return { name: f, bytes: fs_.statSync(`${kept}/${f}`).size, sha256: sha256FileSync(`${kept}/${f}`) };
  });
  const row = { schema: ROOM_SCHEMA_ID, place, inputs_sha256: inputs, res: render.res, samples: render.samples, files, seconds, attempt, rendered_at: now };
  writeFileAtomic(`${kept}.json`, `${JSON.stringify(row, null, 2)}\n`);
  return row;
}

// The real implementation. `deps` is for the tests: a fake renderer, a fake lock, a fake timer.
export function realStage(deps = {}) {
  const d = { fs, runRender, builtPoints, readingFiles, linkWorkspace, unlinkWorkspace, stopNaming, tryTake, release,
    pollMs: POLL_MS, setInterval, clearInterval, now: () => new Date().toISOString(), ...deps };
  return {
    async run(ctx) {
      const { job, config } = ctx;
      const mapped = (e) => {
        if (e instanceof WorkspaceError) return new EngineError(e.what === 'PATH' ? 'TOOLCHAIN_MISSING' : 'STAGE_FAILED', e.what === 'PATH' ? BAD_WORK_PATH : IN_THE_WAY);
        if (e instanceof BuildUsageError) return new EngineError(e.what === 'PATH' ? 'TOOLCHAIN_MISSING' : 'STAGE_FAILED', e.what === 'PATH' ? BAD_WORK_PATH : e.message);
        return e;
      };
      let ws;
      let all;
      try {
        ws = workspaceOf(config, ctx.jobDir, job.job_id);
        all = d.builtPoints(ws, d.fs);
      } catch (e) {
        throw mapped(e);
      }
      const src = d.readingFiles(ctx.jobDir, job.job_id, { fs: d.fs });
      const wanted = config.render.points;
      if (wanted && wanted.some((p) => !all.includes(p))) throw new EngineError('STAGE_FAILED', UNKNOWN_POINT);
      // In the plan's order; a room's place is its place in the WHOLE plan, whatever subset is rendered.
      const rooms = all.map((point, i) => ({ point, place: i + 1 })).filter((r) => !wanted || wanted.includes(r.point));

      // Whatever an earlier, killed run of this job left running must not write the workspace beside this one.
      d.stopNaming(ws.id);
      const t0 = Date.now();
      let rendered = 0;
      let held = 0;
      let waitingSaid = false;
      const outputs = [];
      for (const room of rooms) {
        ctx.checkCancelled();
        const inputs = roomInputs(ctx.inputsSha256, room.point, config.render);
        let row = heldRoom(ctx.jobDir, room.place, inputs, d.fs);
        if (row) {
          restoreRoom(ctx.jobDir, ws, room.point, row, d.fs);
          held += 1;
        } else {
          // The machine's Blender lock: wait for whoever holds it, never take it (§5).
          for (;;) {
            let got;
            try {
              got = d.tryTake(config.blenderLock, { job: job.job_id, mark: ws.id });
            } catch (e) {
              if (!/lock busy$/.test(String(e?.message))) throw e;
              got = { taken: false, holder: 'engine' };        // another engine process is looking at the lock just now
            }
            if (got.removed) ctx.log(`a Blender lock left by a dead engine runner was removed (${got.removed.stopped} leftover processes stopped first)`);
            if (got.taken) break;
            if (!waitingSaid) {
              waitingSaid = true;
              ctx.log(`waiting for the machine's Blender lock (held by ${got.holder === 'engine' ? 'another engine job' : 'another program'})`);
            }
            ctx.waiting?.(WAITING);
            await ctx.sleep(config.render.lockPollSeconds * 1000);
            ctx.checkCancelled();
          }
          ctx.waiting?.(null);
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
            d.linkWorkspace(ws, d.fs);
            r = await d.runRender(config, { ws, plan: src.plan, crop: src.crop, point: room.point, log: `render-${roomName(room.place)}.log`, signal: ac.signal });
          } catch (e) {
            throw mapped(e);
          } finally {
            d.clearInterval(timer);
            d.unlinkWorkspace(ws, d.fs);
            try {
              d.release(config.blenderLock);
            } catch { /* the guard was busy: the lock names this process, and is given back at the next look */ }
          }
          if (stop) throw stop;              // exactly what the runner threw
          if (r.outcome !== 'DONE') {
            const o = OUTCOMES[r.outcome] || OUTCOMES.FAILED;
            ctx.log(`room ${room.place} of ${all.length}: the render ${o.what} (${r.outcome}, exit ${r.exit ?? '?'}, ${r.seconds} s)`);
            throw new EngineError(o.fail, r.outcome === 'NOT_STARTED' ? o.what : `the render of room ${room.place} of ${all.length} ${o.what}`);
          }
          ctx.checkCancelled();              // the row is written only by a runner that still owns the job and the heavy lock
          row = keepRoom(ctx.jobDir, ws, room.point, { place: room.place, inputs, render: config.render, seconds: r.seconds, attempt: ctx.attempt, now: d.now() }, d.fs);
          rendered += 1;
          ctx.log(`room ${room.place} of ${all.length} rendered in ${r.seconds} s (${config.render.res}, ${config.render.samples} samples)`);
        }
        const base = `${ROOMS_REL}/${roomName(room.place)}`;
        outputs.push({ path: `${base}.json` }, ...ROOM_FILES.map((f) => ({ path: `${base}/${f}` })));
      }
      const seconds = Number(((Date.now() - t0) / 1000).toFixed(1));
      ctx.log(`rendered: ${rooms.length} of the plan's ${all.length} rooms (${rendered} now, ${held} held already), ${seconds} s`);
      return { outputs, detail: { rooms: rooms.length, rooms_in_plan: all.length, rendered, held, res: config.render.res, samples: config.render.samples, seconds } };
    },
  };
}

export const real = realStage();
