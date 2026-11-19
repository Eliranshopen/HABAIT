// The STUB implementation every stage has today (contract 0.3 §1): wait the stub step in small slices,
// checking for a cancel after each; the three stages that cost money in the real engine make ONE paid
// call through ctx.paidCall (amount stub.callUsd); then, still the job's runner (ctx.checkOwner), write
// stages/<stage>/stub.json as the one output.
import fs from 'node:fs';
import { writeFileAtomic } from '../lib/atomic.mjs';
import { sha256Text } from '../lib/hash.mjs';

export const PAID_STAGES = Object.freeze(['skinning', 'gating', 'finishing']);
export const SLICE_MS = 100;

const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function stubStage(stage) {
  const paid = PAID_STAGES.includes(stage);
  return {
    stage,
    paid,
    async run(ctx) {
      const sleep = ctx.sleep || realSleep;
      let left = ctx.config.stub.stepMs;
      while (left > 0) {
        const d = Math.min(SLICE_MS, left);
        await sleep(d);
        left -= d;
        ctx.checkCancelled();
      }
      let answer = null;
      if (paid) {
        const amount = ctx.config.stub.callUsd;
        answer = await ctx.paidCall(
          { key: `stub-call:${ctx.inputsSha256}`, provider: 'stub', what: 'one stub call', estimate_usd: amount },
          async () => {
            // One line per call that is REALLY sent: the proof that a call was not made twice.
            fs.mkdirSync(ctx.stageDir, { recursive: true });
            fs.appendFileSync(`${ctx.stageDir}/sends.log`, `${new Date().toISOString()} attempt ${ctx.attempt}\n`);
            return { answer: { stage, stub: true }, usd: amount };
          },
        );
      }
      // The same bytes at every attempt (no attempt number, no time): a stage that runs again reproduces
      // its output, so the rows of the stages after it stay valid and their paid calls are not made again.
      const text = JSON.stringify({ stage, job_id: ctx.job.job_id, inputs_sha256: ctx.inputsSha256, mode: 'stub' }) + '\n';
      // Time passed in the paid call: a runner that was replaced meanwhile must not write over the output of
      // the runner that owns the job now. (Not checkCancelled: what was paid is recorded after a cancel too.)
      ctx.checkOwner();
      writeFileAtomic(`${ctx.stageDir}/stub.json`, text);
      ctx.log(`${stage}: stub output written${paid ? ' (one paid call)' : ''}`);
      return {
        outputs: [{ path: `stages/${stage}/stub.json`, sha256: sha256Text(text), bytes: Buffer.byteLength(text) }],
        detail: paid ? { paid_call: answer } : {},
      };
    },
  };
}
