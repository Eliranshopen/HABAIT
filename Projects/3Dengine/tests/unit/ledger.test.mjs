import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  LEDGER_SCHEMA_ID, ledgerFile, cacheFile, usd, readLedger, writeLedger, callKey, ledgerTotals, settledBy,
  createPaidCall, formatLedger,
} from '../../engine/ledger.mjs';
import { newJob, writeJob, readJob, updateJob } from '../../engine/jobs.mjs';
import { EngineError } from '../../engine/inbox.mjs';
import { validate } from '../../mcp/schema-check.mjs';
import { tempDir, writeFile } from '../helpers/fakes.mjs';

const ID = 'abcdef0123456789';
const SCHEMA = JSON.parse(fs.readFileSync(new URL('../../contracts/ledger.schema.json', import.meta.url), 'utf8'));
const input = { pdf_path: 'C:/x/source.pdf', pdf_name: 'plan.pdf', pdf_sha256: 'b'.repeat(64), apartment: 'apt846' };
let tick = 0;
const now = () => new Date(Date.parse('2026-11-16T18:00:00.000Z') + 1000 * tick++).toISOString();

function setup({ cap = 60, approved = true } = {}) {
  const jobsDir = tempDir('led-');
  const job = newJob({ id: ID, mode: 'stub', now: now(), input });
  if (approved) {
    job.approval = { cap_usd: cap, at: now() };
    job.cost.cap_usd = cap;
  }
  writeJob(jobsDir, job);
  return jobsDir;
}

const spec = (over = {}) => ({ key: 'k1', provider: 'stub', what: 'one call', estimate_usd: 0.6, ...over });
const pc = (jobsDir, over = {}) => createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 1, now, ...over });

async function code(p) {
  try {
    await p();
  } catch (e) {
    assert.ok(e instanceof EngineError, e.stack);
    return e.code;
  }
  return 'no error';
}

test('usd rounds to micro-dollars; callKey depends on stage and key; empty ledger', () => {
  assert.equal(usd(0.6 + 0.6 + 0.6), 1.8);
  assert.equal(callKey('a', 'k'), callKey('a', 'k'));
  assert.notEqual(callKey('a', 'k'), callKey('b', 'k'));
  assert.notEqual(callKey('a', 'k'), callKey('a', 'l'));
  const jobsDir = tempDir('led-');
  assert.deepEqual(readLedger(jobsDir, ID, 5), { schema: LEDGER_SCHEMA_ID, job_id: ID, cap_usd: 5, rows: [] });
  assert.deepEqual(readLedger(jobsDir, ID).cap_usd, null);
  fs.mkdirSync(ledgerFile(jobsDir, ID), { recursive: true });
  assert.throws(() => readLedger(jobsDir, ID), /EISDIR|EPERM|EACCES/);
});

test('no approval → BUDGET_CAP "no approved cap", nothing written; unknown job → JOB_NOT_FOUND', async () => {
  const jobsDir = setup({ approved: false });
  let sent = 0;
  const e = await pc(jobsDir)(spec(), async () => { sent++; }).catch((x) => x);
  assert.equal(e.code, 'BUDGET_CAP');
  assert.equal(e.message, 'no approved cap');
  assert.equal(sent, 0);
  assert.equal(fs.existsSync(ledgerFile(jobsDir, ID)), false);
  assert.equal(await code(() => createPaidCall({ jobsDir, jobId: '0000000000000000', stage: 's', attempt: 1 })(spec(), async () => 1)), 'JOB_NOT_FOUND');
});

test('reserve, send, cache, settle; spent_usd updated; the same call again comes from the cache (no row, not sent)', async () => {
  const jobsDir = setup();
  const order = [];
  const call = pc(jobsDir, { log: (m) => order.push(m) });
  const answer = await call(spec(), async () => {
    const l = readLedger(jobsDir, ID);
    assert.equal(l.rows[0].status, 'reserved', 'reserved and written BEFORE the call');
    assert.equal(l.rows[0].reserved_usd, 0.6);
    order.push('sent');
    return { answer: { ok: 1 }, usd: 0.55 };
  });
  assert.deepEqual(answer, { ok: 1 });
  const l = readLedger(jobsDir, ID);
  assert.deepEqual(validate(SCHEMA, l), []);
  assert.equal(l.cap_usd, 60);
  assert.equal(l.rows.length, 1);
  const r = l.rows[0];
  assert.deepEqual([r.seq, r.status, r.settled_usd, r.attempt, r.stage, r.provider], [1, 'settled', 0.55, 1, 'skinning', 'stub']);
  assert.equal(r.call_key, callKey('skinning', 'k1'));
  assert.deepEqual(JSON.parse(fs.readFileSync(cacheFile(jobsDir, ID, r.call_key), 'utf8')), { answer: { ok: 1 }, settled_usd: 0.55, seq: 1 }, 'the cache holds the answer AND what it cost');
  assert.equal(readJob(jobsDir, ID).cost.spent_usd, 0.55);
  // again, another attempt: from the cache
  let sent = 0;
  const again = await pc(jobsDir, { attempt: 2, log: (m) => order.push(m) })(spec(), async () => { sent++; return { answer: 'x' }; });
  assert.deepEqual(again, { ok: 1 });
  assert.equal(sent, 0);
  assert.equal(readLedger(jobsDir, ID).rows.length, 1);
  assert.match(order.join('\n'), /from the cache/);
  assert.equal(settledBy(readLedger(jobsDir, ID), 'skinning', 1), 0.55);
  assert.equal(settledBy(readLedger(jobsDir, ID), 'skinning', 2), 0);
});

test('a settled row whose cache is gone or altered is billed again (a new row), and the estimate is the default amount', async () => {
  const jobsDir = setup();
  await pc(jobsDir)(spec(), async () => ({ answer: 'one' }));
  const key = callKey('skinning', 'k1');
  fs.writeFileSync(cacheFile(jobsDir, ID, key), '"tampered"');
  assert.equal(await pc(jobsDir)(spec(), async () => ({ answer: 'two' })), 'two');
  fs.rmSync(cacheFile(jobsDir, ID, key));
  assert.equal(await pc(jobsDir)(spec(), async () => ({})), null);
  const l = readLedger(jobsDir, ID);
  assert.deepEqual(l.rows.map((r) => [r.status, r.settled_usd]), [['settled', 0.6], ['settled', 0.6], ['settled', 0.6]]);
  assert.equal(readJob(jobsDir, ID).cost.spent_usd, 1.8);
});

test('a reserved row whose send had started (runner died in the call) becomes orphaned, is kept, counts toward the cap', async () => {
  const jobsDir = setup({ cap: 1 });
  const key = callKey('skinning', 'k1');
  writeLedger(jobsDir, { schema: LEDGER_SCHEMA_ID, job_id: ID, cap_usd: 1, rows: [{ seq: 1, call_key: key, stage: 'skinning',
    provider: 'stub', what: 'w', reserved_usd: 0.6, reserved_at: now(), sending_at: now(), status: 'reserved', settled_usd: null, settled_at: null,
    answer_sha256: null, attempt: 1 }] });
  // 0.6 orphaned + 0.6 estimate > 1 → BUDGET_CAP, nothing reserved, the orphan written
  let sent = 0;
  const e = await pc(jobsDir, { attempt: 2 })(spec(), async () => { sent++; }).catch((x) => x);
  assert.equal(e.code, 'BUDGET_CAP');
  assert.match(e.message, /\$0\.6 of the \$1 cap/);
  assert.equal(sent, 0);
  let l = readLedger(jobsDir, ID);
  assert.deepEqual(l.rows.map((r) => r.status), ['orphaned']);
  assert.ok(l.rows[0].orphaned_at);
  assert.deepEqual(validate(SCHEMA, l), []);
  // a raised cap: the call goes through, the orphan stays
  updateJob(jobsDir, ID, (j) => { j.cost.cap_usd = 2; return j; });
  assert.equal(await pc(jobsDir, { attempt: 2 })(spec(), async () => ({ answer: 'ok' })), 'ok');
  l = readLedger(jobsDir, ID);
  assert.deepEqual(l.rows.map((r) => r.status), ['orphaned', 'settled']);
  const t = ledgerTotals(l);
  assert.deepEqual([t.settled_usd, t.held_usd, t.cap_total_usd, t.orphaned.length], [0.6, 0.6, 1.2, 1]);
  assert.equal(readJob(jobsDir, ID).cost.spent_usd, 0.6, 'spent = settled only');
  const text = formatLedger(l);
  assert.match(text, /settled \$0\.6 · held \$0\.6 · cap \$2/);
  assert.match(text, /ORPHANED 1: outcome unknown, \$0\.6 counts toward the cap/);
  assert.match(formatLedger(readLedger(tempDir('x-'), ID)), /cap none/);
});

test('a cap that the estimate alone exceeds → BUDGET_CAP; a null cap does not limit', async () => {
  const jobsDir = setup({ cap: 0.5 });
  assert.equal(await code(() => pc(jobsDir)(spec(), async () => ({}))), 'BUDGET_CAP');
  assert.equal(fs.existsSync(ledgerFile(jobsDir, ID)), false);
  updateJob(jobsDir, ID, (j) => { j.cost.cap_usd = null; return j; });
  assert.equal(await pc(jobsDir)(spec({ estimate_usd: undefined }), async () => ({ answer: 3 })), 3);
  assert.equal(readLedger(jobsDir, ID).rows[0].reserved_usd, 0);
});

test('a failed call: row failed with settled_usd 0, the error rethrown, no cache', async () => {
  const jobsDir = setup();
  await assert.rejects(pc(jobsDir)(spec(), async () => { throw new Error('provider down'); }), /provider down/);
  const l = readLedger(jobsDir, ID);
  assert.deepEqual([l.rows[0].status, l.rows[0].settled_usd], ['failed', 0]);
  assert.equal(fs.existsSync(cacheFile(jobsDir, ID, l.rows[0].call_key)), false);
  assert.deepEqual(validate(SCHEMA, l), []);
});

test('the test hooks sleep after the reserve and after the settle, only when set', async () => {
  const jobsDir = setup();
  const slept = [];
  const states = [];
  const sleep = async (ms) => { slept.push(ms); states.push(readLedger(jobsDir, ID).rows.at(-1).status); };
  await pc(jobsDir, { sleep, pauseAfterReserveMs: 50, pauseAfterSettleMs: 70 })(spec(), async () => ({ answer: 1 }));
  assert.deepEqual(slept, [50, 70]);
  assert.deepEqual(states, ['reserved', 'settled']);
  await pc(jobsDir, { sleep })(spec({ key: 'k2' }), async () => ({ answer: 1 }));
  assert.deepEqual(slept, [50, 70], 'no hook, no sleep');
  writeFile(`${jobsDir}/x`, '');
});
