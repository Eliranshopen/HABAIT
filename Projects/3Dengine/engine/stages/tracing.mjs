// Stage "tracing" (contract 0.3 §1): implementations by mode.
//   stub  the timer of milestone 0.3.
//   real  (milestone 1.3) the reading of the drawing: the reading tool, through engine/trace.mjs, on the job's own
//         copy of the PDF, free, from the reading the engine KEEPS for that PDF (engine/readings.mjs; since 1.4 a
//         reading the engine paid for, or an import). What the reading gives decides what the job does next, by
//         ONE table (OUTCOMES): a reading that fails its own check hands the job to a person and never reaches
//         the build.
import fs from 'node:fs';
import { stubStage } from './stub.mjs';
import { INPUT_REL } from './intake.mjs';
import { runTrace, TraceUsageError } from '../trace.mjs';
import { findReading } from '../readings.mjs';
import { EngineError } from '../inbox.mjs';
import { ReviewNeeded, drawingId } from '../jobs.mjs';
import { isTransient } from '../lib/atomic.mjs';

export const name = 'tracing';
export const stub = stubStage(name);

export const POLL_MS = 500;            // how often the stage asks the runner whether it must stop
export const PLAN_FILES = Object.freeze(['plan.general.json', 'overlay.png', 'report.json', 'trace-check.json', 'vlm.json']);
// (2.1, contract 2.1 §3) what the build takes from the same folder of the tool: the picture of the drawing, always;
// its vector lines, when the PDF has them. Both are the same bytes in every reading of the same PDF.
export const DRAWING_FILE = 'crop.png';
export const VECTORS_FILE = 'pdf-vectors.json';

// The fixed sentences of the stage. Nothing a job says about a reading is text taken from the PDF.
export const NEEDS_READING = 'a reading of this drawing has to be paid for, and the engine does not pay for one inside a job yet: put a saved reading of this PDF in the readings folder, or pay for one with the trace command';
export const BAD_READING = 'what is saved as the reading of this PDF is not a reading';
export const STALE_READING = 'the kept reading of this PDF was made by another reader (the reading tool or the model changed since): a new reading has to be paid for with the trace command, and the engine does not pay for one inside a job yet';
export const BAD_OUT_PATH = 'the job folder is under a path with characters outside ASCII, where the reading tool cannot write its images';

// What each outcome of a reading becomes for the job (contract 1.3 §3). PASS is the stage's normal return.
//   review: the job goes to `review` with this reason code;  fail: the job ends `failed` with this one.
export const OUTCOMES = Object.freeze({
  FAIL: Object.freeze({ review: 'TRACE_GATE_FAIL' }),
  NO_PLAN_FOUND: Object.freeze({ fail: 'NO_PLAN_FOUND', message: 'no plan drawing was found in this PDF' }),
  DRY: Object.freeze({ fail: 'BUDGET_CAP', message: NEEDS_READING }),
  NEEDS_PAID_RUN: Object.freeze({ fail: 'BUDGET_CAP', message: NEEDS_READING }),
  BUDGET_REACHED: Object.freeze({ fail: 'BUDGET_CAP', message: 'the reading reached its budget' }),
  NOT_STARTED: Object.freeze({ fail: 'TOOLCHAIN_MISSING', message: 'the reading tool could not be started' }),
  TIMEOUT: Object.freeze({ fail: 'STAGE_FAILED', message: 'the reading did not end in time' }),
  STEP_FAILED: Object.freeze({ fail: 'STAGE_FAILED', message: 'a step of the reading tool failed' }),
  USAGE: Object.freeze({ fail: 'STAGE_FAILED', message: 'the reading tool refused its command' }),
  RESULT_UNREADABLE: Object.freeze({ fail: 'STAGE_FAILED', message: 'the reading tool left no result that is this run\'s' }),
  CANCELLED: Object.freeze({ fail: 'STAGE_FAILED', message: 'the reading was stopped' }),
});
const UNKNOWN = Object.freeze({ fail: 'STAGE_FAILED', message: 'the reading ended in a way the engine does not know' });

const count = (n) => (typeof n === 'number' ? String(n) : '?');

// The real implementation. `deps` is for the tests: a fake runTrace, a fake store, a fake timer.
export function realStage(deps = {}) {
  const d = { runTrace, findReading, fs, pollMs: POLL_MS, setInterval, clearInterval, ...deps };
  return {
    async run(ctx) {
      const { job, config } = ctx;
      // It never pays: with no kept reading of today's reader nothing is started (contract 1.4 §5).
      const saved = d.findReading(config, job.input.pdf_sha256);
      if (saved.status === 'none') throw new EngineError('BUDGET_CAP', NEEDS_READING);
      if (saved.status === 'stale') throw new EngineError('BUDGET_CAP', STALE_READING);
      if (saved.status !== 'found') throw new EngineError('STAGE_FAILED', BAD_READING);

      // A folder of this attempt, which only the stage and the tool write.
      const rel = `stages/${name}/attempt-${ctx.attempt}`;
      // While the tool runs: must the stage stop? (the job was cancelled, another runner took it over, the heavy
      // lock was lost). A passing file error of that question is not a stop.
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
        // The id is the DRAWING's and the date is the reading's, so the same reading gives the same bytes of the
        // plan in every job of this drawing and on every day (contract 1.4 §3).
        r = await d.runTrace(config, { pdf: `${ctx.jobDir}/${INPUT_REL}`, outDir: `${ctx.jobDir}/${rel}`,
          id: drawingId(job.input.pdf_sha256, job.input.apartment), vlmFile: saved.file, traceDate: saved.record.date, judge: false, signal: ac.signal });
      } catch (e) {
        if (!(e instanceof TraceUsageError)) throw e;
        // The engine's own sentence about its own folders: never text of the PDF.
        throw new EngineError(e.what === 'OUT_PATH' ? 'TOOLCHAIN_MISSING' : 'STAGE_FAILED', e.what === 'OUT_PATH' ? BAD_OUT_PATH : `the reading could not be started: ${e.message}`);
      } finally {
        d.clearInterval(timer);
      }
      if (stop) throw stop;            // exactly what the runner threw: it knows what to do with it
      ctx.checkCancelled();            // and once more: the job may have left the stage as the tool ended

      if (r.outcome === 'PASS') {
        const plans = r.result?.plans || [];
        if (plans.length !== 1) throw new EngineError('STAGE_FAILED', `the reading traced ${plans.length} plans, and a job reads one drawing`);
        const p = plans[0];
        ctx.log(`the reading passed: ${count(p.rooms)} rooms, ${count(p.checks.total)} checks, ${p.dims.count} printed dimensions (the largest ${count(p.dims.maxPct)} %), ${count(r.seconds)} s`);
        return {
          outputs: [...PLAN_FILES, DRAWING_FILE, ...(d.fs.existsSync(`${ctx.jobDir}/${rel}/plan-${p.k}/${VECTORS_FILE}`) ? [VECTORS_FILE] : [])]
            .map((f) => ({ path: `${rel}/plan-${p.k}/${f}` })),
          detail: { rooms: p.rooms, fixtures: p.fixtures, checks: p.checks.total, dims_checked: p.dims.count, dims_max_pct: p.dims.maxPct,
            could_not_read: p.couldNotRead, rounds: p.rounds, seconds: r.seconds },
        };
      }
      if (r.outcome === 'FAIL') {
        const plans = r.result?.plans || [];
        const p = plans.find((x) => x.status === 'FAIL') || plans[0];
        if (!p) throw new ReviewNeeded(OUTCOMES.FAIL.review, 'the reading traced no plan from this drawing', {});
        const files = {};
        for (const [key, f] of [['report', 'report.json'], ['overlay', 'overlay.png']]) {
          if (d.fs.existsSync(`${ctx.jobDir}/${rel}/plan-${p.k}/${f}`)) files[key] = `${rel}/plan-${p.k}/${f}`;
        }
        throw new ReviewNeeded(OUTCOMES.FAIL.review,
          `the reading failed its own check: ${count(p.checks.failed)} of ${count(p.checks.total)} checks failed (${p.dims.failed} of the ${p.dims.count} printed dimensions)`, files);
      }
      const row = OUTCOMES[r.outcome] || UNKNOWN;
      throw new EngineError(row.fail, row.message);
    },
  };
}

export const real = realStage();
