import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { REGISTRY, implFor, STAGES } from '../../engine/stages/index.mjs';
import { stubStage, PAID_STAGES, SLICE_MS } from '../../engine/stages/stub.mjs';
import { tempDir } from '../helpers/fakes.mjs';

function ctx(over = {}) {
  const dir = tempDir('stage-');
  const calls = [];
  const c = {
    job: { job_id: 'abcdef0123456789' }, config: { stub: { stepMs: 250, callUsd: 0.6 } }, jobDir: dir, stageDir: `${dir}/stages/x`,
    attempt: 3, inputsSha256: 'i'.repeat(64), log: () => {}, slept: [], cancelChecks: 0, ownerChecks: 0,
    checkCancelled() { c.cancelChecks++; },
    checkOwner() { c.ownerChecks++; },
    async paidCall(spec, fn) { calls.push(spec); return (await fn()).answer; },
    ...over,
  };
  c.sleep = async (ms) => { c.slept.push(ms); };
  c.calls = calls;
  return c;
}

test('the registry has one module per stage, in the runner order, each with a stub', () => {
  assert.deepEqual(Object.keys(REGISTRY), STAGES);
  assert.deepEqual(STAGES, ['tracing', 'building', 'rendering', 'skinning', 'gating', 'finishing', 'packaging', 'qa']);
  for (const s of STAGES) {
    assert.equal(REGISTRY[s].name, s);
    assert.equal(implFor(s, 'stub'), REGISTRY[s].stub);
    assert.equal(REGISTRY[s].stub.paid, PAID_STAGES.includes(s));
  }
  assert.throws(() => implFor('nope', 'stub'), /no stage "nope"/);
  // (1.3) the reading is the first stage with a real implementation; the others still have only the stub
  assert.equal(implFor('tracing', 'real'), REGISTRY.tracing.real);
  for (const s of STAGES.filter((x) => x !== 'tracing')) assert.throws(() => implFor(s, 'real'), /has no "real" implementation/, s);
});

test('the stub: waits in slices checking for a cancel, then writes stub.json as its one output, the same bytes at every attempt', async () => {
  const c = ctx({ stageDir: undefined });
  c.stageDir = `${c.jobDir}/stages/building`;
  const r = await stubStage('building').run(c);
  assert.deepEqual(c.slept, [SLICE_MS, SLICE_MS, 50]);
  assert.equal(c.cancelChecks, 3);
  assert.equal(c.calls.length, 0, 'not a paid stage');
  const text = fs.readFileSync(`${c.stageDir}/stub.json`, 'utf8');
  assert.deepEqual(JSON.parse(text), { stage: 'building', job_id: 'abcdef0123456789', inputs_sha256: 'i'.repeat(64), mode: 'stub' });
  // another attempt with the same inputs: the same bytes (a stage that runs again reproduces its output)
  const again = ctx({ attempt: 7 });
  again.stageDir = `${again.jobDir}/stages/building`;
  const r2 = await stubStage('building').run(again);
  assert.equal(fs.readFileSync(`${again.stageDir}/stub.json`, 'utf8'), text);
  assert.equal(r2.outputs[0].sha256, r.outputs[0].sha256);
  // other inputs: other bytes
  const other = ctx({ inputsSha256: 'j'.repeat(64) });
  other.stageDir = `${other.jobDir}/stages/building`;
  assert.notEqual((await stubStage('building').run(other)).outputs[0].sha256, r.outputs[0].sha256);
  assert.deepEqual(r.outputs.map((o) => [o.path, o.bytes]), [['stages/building/stub.json', Buffer.byteLength(text)]]);
  assert.match(r.outputs[0].sha256, /^[0-9a-f]{64}$/);
});

test('a paid stub stage makes ONE paid call with a stable key and stub.callUsd', async () => {
  const c = ctx();
  const r = await stubStage('gating').run(c);
  assert.deepEqual(c.calls, [{ key: `stub-call:${'i'.repeat(64)}`, provider: 'stub', what: 'one stub call', estimate_usd: 0.6 }]);
  assert.deepEqual(r.detail, { paid_call: { stage: 'gating', stub: true } });
  assert.equal(c.ownerChecks, 1, 'it asks whether it still owns the job before it writes its output');
});

test('a stub that is no longer the job\'s runner after its paid call writes no output', async () => {
  const order = [];
  const c = ctx({
    async paidCall(spec, fn) { order.push('call'); return (await fn()).answer; },
    checkOwner() { order.push('owner?'); throw new Error('another runner took this job over'); },
  });
  await assert.rejects(stubStage('skinning').run(c), /another runner took this job over/);
  assert.deepEqual(order, ['call', 'owner?'], 'the check comes after the paid call and before the write');
  assert.equal(fs.existsSync(`${c.stageDir}/stub.json`), false);
  assert.equal(fs.readFileSync(`${c.stageDir}/sends.log`, 'utf8').split('\n').filter(Boolean).length, 1, 'the call itself was made');
});

test('a cancel stops the stub before it writes anything; the default sleep is real', async () => {
  const c = ctx({ checkCancelled() { throw new Error('cancelled'); } });
  await assert.rejects(stubStage('tracing').run(c), /cancelled/);
  assert.equal(fs.existsSync(`${c.stageDir}/stub.json`), false);
  const d = ctx({ config: { stub: { stepMs: 5, callUsd: 0 } } });
  delete d.sleep;
  const t = Date.now();
  await stubStage('qa').run(d);
  assert.ok(Date.now() - t >= 4);
});
