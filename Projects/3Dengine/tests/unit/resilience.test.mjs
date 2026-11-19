// Contract 0.3 §10 (after the first QA round): locks that are never empty, liveness that needs a sign of
// life, a heavy lock that is refreshed, a call whose answer is cached is never sent again, spent_usd derived.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lockIsStale, lockState, withFileLock, EMPTY_LOCK_STALE_MS } from '../../engine/lib/atomic.mjs';
import { acquireHeavy, refreshHeavy, readHeavy, heavyIsStale } from '../../engine/heavy-lock.mjs';
import { runnerAlive, runnerPidFile } from '../../engine/control.mjs';
import { newJob, writeJob, setState, readJob, updateJob } from '../../engine/jobs.mjs';
import {
  createPaidCall, readLedger, writeLedger, callKey, cacheFile, syncSpent, CapReached, readCache, LEDGER_SCHEMA_ID,
} from '../../engine/ledger.mjs';
import { validate } from '../../mcp/schema-check.mjs';
import { stubConfig, tempDir, writeFile, holdLock } from '../helpers/fakes.mjs';

const ID = 'abcdef0123456789';
const input = { pdf_path: 'C:/x/source.pdf', pdf_name: 'plan.pdf', pdf_sha256: 'b'.repeat(64), apartment: 'apt846' };
const LEDGER_SCHEMA = JSON.parse(fs.readFileSync(new URL('../../contracts/ledger.schema.json', import.meta.url), 'utf8'));
const T0 = '2026-11-16T18:00:00.000Z';

test('a lock is born with its holder inside; when is a lock stale', () => {
  const dir = tempDir('lock-');
  const lock = `${dir}/x.lock`;
  // (contract 1.4 §11) the lock comes into being as a folder WITH its holder's entry: it is never seen empty
  let seen = null;
  withFileLock(lock, () => {
    seen = { state: lockState(lock), names: fs.readdirSync(dir) };
  });
  assert.deepEqual([seen.state.kind, seen.state.pid, seen.names], ['held', process.pid, ['x.lock']]);
  assert.deepEqual(fs.readdirSync(dir), [], 'no folder and no temp file is left');
  // what can be at a lock's path
  assert.deepEqual(lockState(lock), { kind: 'free' });
  fs.mkdirSync(lock);
  assert.deepEqual(lockState(lock), { kind: 'empty' });
  fs.rmdirSync(lock);
  holdLock(lock, { pid: 77, at: 1794000000000 });
  assert.deepEqual(lockState(lock), { kind: 'held', entry: 'h.77.1794000000000.abcdef01', pid: 77, takenAt: 1794000000000 });
  fs.rmSync(lock, { recursive: true });
  for (const name of ['free', 'h.77', 'h.x.1794000000000.abcdef01', 'h.77.1794000000000.XYZ', 'job.json']) {
    fs.mkdirSync(lock);
    fs.writeFileSync(`${lock}/${name}`, '');
    assert.equal(lockState(lock).kind, 'foreign', name);
    fs.rmSync(lock, { recursive: true });
  }

  const alive = (p) => p === 5;
  assert.equal(lockIsStale('', 500, { alive }), false, 'an empty lock file may be a creation in progress');
  assert.equal(lockIsStale('', EMPTY_LOCK_STALE_MS + 1, { alive }), true, 'an empty lock file older than a second is a killed holder');
  assert.equal(lockIsStale('garbage', 2000, { alive }), true);
  assert.equal(lockIsStale('9', 1, { alive }), true, 'a dead pid');
  assert.equal(lockIsStale('5', 9000, { alive }), false, 'a live holder');
  assert.equal(lockIsStale('5', 10001, { alive }), true, 'older than staleMs, whatever it holds');
  assert.equal(lockIsStale(String(process.pid), 1, { alive: () => false }), false, 'its own pid is not a dead holder');
});

// D-1 of the first review of 1.4, as a fixed sequence (the race itself, with real processes, is lock-race.test.mjs,
// and it shows only on a machine that is held by other work). A taker LOOKS (who holds, is it alive) and then ACTS.
// `alive` is asked between the two, so the test changes the holder exactly there.
test('the holder changed between a taker\'s look and its act: nothing of the lock that stands there is moved', () => {
  const dir = tempDir('lock-');
  const lock = `${dir}/x.lock`;

  // 1. A's hold ended and B, alive, took the lock: the taker moves nothing of B's, and waits like anybody else
  holdLock(lock, { pid: 111, at: Date.now() - 50 });
  let swaps = 0;
  let ran = 0;
  let bEntry = null;
  assert.throws(() => withFileLock(lock, () => { ran += 1; }, {
    waitMs: 60,
    alive: (pid) => {
      if (pid !== 111) return true;                       // B is alive
      fs.rmSync(lock, { recursive: true });               // A released and ended ...
      holdLock(lock, { pid: 222 });                       // ... and B holds
      bEntry = fs.readdirSync(lock);
      swaps += 1;
      return false;                                       // «A is dead»: true, and no longer what stands at the path
    },
  }), /lock busy/);
  assert.deepEqual([swaps, ran], [1, 0], 'one look at A; fn never ran');
  assert.deepEqual([lockState(lock).kind, lockState(lock).pid, fs.readdirSync(lock)], ['held', 222, bEntry], 'B\'s hold is as B made it');
  assert.deepEqual(fs.readdirSync(dir), ['x.lock'], 'nothing was moved aside and no temp folder is left');
  fs.rmSync(lock, { recursive: true });

  // 2. A's hold ended and nobody took the lock: the taker takes a FREE lock, once
  holdLock(lock, { pid: 111 });
  ran = 0;
  assert.equal(withFileLock(lock, () => { ran += 1; return lockState(lock).pid; }, {
    waitMs: 500,
    alive: () => { fs.rmSync(lock, { recursive: true, force: true }); return false; },
  }), process.pid);
  assert.equal(ran, 1);
  assert.deepEqual(fs.readdirSync(dir), [], 'released, nothing left');

  // 3. a NEW hold by a process with the same pid (a pid that was used again) is another hold: it is not taken over
  //    on the word of the look at the old one
  holdLock(lock, { pid: 111, at: Date.now() - 50 });
  let looks = 0;
  ran = 0;
  assert.throws(() => withFileLock(lock, () => { ran += 1; }, {
    waitMs: 60,
    alive: () => {
      looks += 1;
      if (looks > 1) return true;                         // the process that holds now is alive
      fs.rmSync(lock, { recursive: true });
      holdLock(lock, { pid: 111 });                       // same pid, a later moment: another entry
      return false;
    },
  }), /lock busy/);
  assert.equal(ran, 0);
  assert.deepEqual([lockState(lock).kind, lockState(lock).pid], ['held', 111]);
  assert.deepEqual(fs.readdirSync(dir), ['x.lock']);
  fs.rmSync(lock, { recursive: true });

  // 4. (the second review of 1.4) a stale hold is BROKEN and the lock is then TAKEN like a free one; the stale
  //    entry is never renamed into the taker's. So while fn runs the folder holds this process's entry and
  //    nothing else, and it is a NEW folder: the one the dead holder made is gone.
  holdLock(lock, { pid: 111 });
  const before = fs.statSync(lock).birthtimeMs;
  let inside = null;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
  withFileLock(lock, () => { inside = { state: lockState(lock), born: fs.statSync(lock).birthtimeMs, beside: fs.readdirSync(dir) }; }, { waitMs: 500, alive: () => false });
  assert.deepEqual([inside.state.kind, inside.state.pid, inside.beside], ['held', process.pid, ['x.lock']]);
  assert.ok(inside.born > before, 'the lock was taken as a free lock: a folder of its own, not the dead holder\'s');
  assert.deepEqual(fs.readdirSync(dir), []);

  // 5. an entry whose time is far in the FUTURE, by a live pid (a clock set back, or a name written by hand),
  //    is as stale as one that is too old; one that is a little ahead is a live hold
  holdLock(lock, { pid: 111, at: Date.now() + 3600000 });
  assert.equal(withFileLock(lock, () => 'in', { waitMs: 500, alive: () => true }), 'in');
  holdLock(lock, { pid: 111, at: Date.now() + 2000 });
  assert.throws(() => withFileLock(lock, () => 1, { waitMs: 40, alive: () => true }), /lock busy/);
  assert.equal(lockState(lock).pid, 111);
  fs.rmSync(lock, { recursive: true });

  // 6. a stale entry that cannot be moved just now (a passing file error): the taker WAITS between its looks, it
  //    does not spin; the lock is busy after waitMs, and the entry is where it was
  holdLock(lock, { pid: 111 });
  const realRename = fs.renameSync;
  let tries = 0;
  fs.renameSync = (from, to) => {
    if (String(from).includes('/h.111.')) {
      tries += 1;
      throw Object.assign(new Error('EPERM: operation not permitted, rename'), { code: 'EPERM' });
    }
    return realRename(from, to);
  };
  try {
    assert.throws(() => withFileLock(lock, () => 1, { waitMs: 100, alive: () => false }), /lock busy/);
  } finally {
    fs.renameSync = realRename;
  }
  assert.ok(tries >= 2 && tries <= 60, `it looked again every few milliseconds, ${tries} times in 100 ms, not thousands`);
  assert.equal(lockState(lock).pid, 111, 'the entry is where it was');
  assert.equal(withFileLock(lock, () => 'in', { waitMs: 500, alive: () => false }), 'in', 'and is broken once it can be moved');
});

test('withFileLock: a lock FILE of the older engine, left empty by a killed process, blocks about a second, not ten', () => {
  const lock = `${tempDir('lock-')}/job.lock`;
  fs.writeFileSync(lock, '');
  const past = new Date(Date.now() - 1500);
  fs.utimesSync(lock, past, past);
  const t0 = Date.now();
  let inside = null;
  const out = withFileLock(lock, () => {
    inside = lockState(lock);
    return 'ran';
  }, { waitMs: 2000 });
  assert.equal(out, 'ran');
  assert.deepEqual([inside.kind, inside.pid], ['held', process.pid], 'the lock names its holder while fn runs');
  assert.ok(Date.now() - t0 < 500, 'taken over at once');
  assert.equal(fs.existsSync(lock), false, 'released');

  // a FRESH empty lock file is respected until it ages
  fs.writeFileSync(lock, '');
  const t1 = Date.now();
  assert.equal(withFileLock(lock, () => 1, { waitMs: 3000, emptyStaleMs: 150 }), 1);
  assert.ok(Date.now() - t1 >= 100, 'it waited for the empty lock file to age');

  // a live holder: busy, in the old shape and in the new one
  fs.writeFileSync(lock, '424242');
  assert.throws(() => withFileLock(lock, () => 1, { waitMs: 50, alive: () => true }), /lock busy/);
  assert.equal(fs.readFileSync(lock, 'utf8'), '424242', 'a live holder keeps its lock');
  fs.rmSync(lock);
  holdLock(lock, { pid: 424242 });
  assert.throws(() => withFileLock(lock, () => 1, { waitMs: 50, alive: () => true }), /lock busy/);
  assert.equal(lockState(lock).pid, 424242, 'a live holder keeps its lock');
});

test('the heavy lock is refreshed by its holder and is stale when it is not', () => {
  const file = `${tempDir('heavy-')}/h.lock`;
  const alive = () => true;
  let t = Date.parse(T0);
  const now = () => new Date(t).toISOString();
  const clock = () => t;
  const take = (pid, jobId) => acquireHeavy(file, { pid, jobId, alive, now, clock, staleMs: 10000 });
  assert.equal(take(1, 'a').ok, true);
  t += 9000;
  assert.equal(take(2, 'b').ok, false, 'fresh enough');
  assert.equal(refreshHeavy(file, { pid: 2, now }), false, 'only the holder refreshes');
  assert.equal(refreshHeavy(file, { pid: 1, now }), true);
  assert.equal(readHeavy(file).refreshed_at, now());
  assert.equal(readHeavy(file).at, T0, 'taken when it was taken');
  t += 9000;
  assert.equal(take(2, 'b').ok, false, 'refreshed nine seconds ago');
  assert.equal(take(1, 'a').ok, true, 'the holder asks again: still its own');
  assert.equal(readHeavy(file).at, T0);
  t += 10001;
  const r = take(2, 'b');
  assert.equal(r.ok, true, 'a live pid that stopped refreshing is stale');
  assert.equal(r.took_over.pid, 1);
  assert.equal(refreshHeavy(file, { pid: 1, now }), false, 'the old holder learns it lost the lock');
  assert.equal(heavyIsStale(null), true);
  assert.equal(heavyIsStale({ pid: 'x' }), true);
  assert.equal(heavyIsStale({ pid: 3, at: T0 }, { alive, clock: () => Date.parse(T0) + 5 }), false, 'no staleMs given: only a dead pid is stale');
});

test('alive = a live pid AND a recent sign of life (a recycled pid does not look alive)', () => {
  const config = stubConfig();
  writeJob(config.jobsDir, newJob({ id: ID, mode: 'stub', now: T0, input }));
  const pidFile = runnerPidFile(config, ID);
  const base = Date.parse(T0);
  const at = (ms) => ({ clock: () => base + ms });
  const touch = (ms) => {
    const d = new Date(base + ms);
    fs.utimesSync(pidFile, d, d);
  };
  assert.equal(runnerAlive(config, ID, () => true, at(1000)), false, 'no pid file');
  fs.writeFileSync(pidFile, '777');
  touch(-60000);
  assert.equal(runnerAlive(config, ID, () => true, at(5000)), true, 'an old pid file, a heartbeat five seconds ago');
  assert.equal(runnerAlive(config, ID, () => false, at(5000)), false, 'a dead pid');
  assert.equal(runnerAlive(config, ID, () => true, at(60000)), false, 'the pid lives but nothing was heard for a minute');
  touch(59000);
  assert.equal(runnerAlive(config, ID, () => true, at(60000)), true, 'a runner that has just claimed the pid file');
  touch(-60000);
  updateJob(config.jobsDir, ID, (j) => {
    j.heartbeat_at = new Date(base + 55000).toISOString();
    return j;
  });
  assert.equal(runnerAlive(config, ID, () => true, at(60000)), true, 'a fresh heartbeat');
  assert.equal(runnerAlive(config, ID, () => true, { ...at(60000), read: () => null }), false, 'the job vanished');
});

function approvedJob(cap = 60) {
  const config = stubConfig();
  const job = newJob({ id: ID, mode: 'stub', now: T0, input });
  setState(job, 'skinning', T0);
  job.approval = { cap_usd: cap, at: T0 };
  job.cost.cap_usd = cap;
  writeJob(config.jobsDir, job);
  return config.jobsDir;
}
const row = (over) => ({ seq: 1, call_key: callKey('skinning', 'k1'), stage: 'skinning', provider: 'stub', what: 'one call',
  reserved_usd: 0.6, reserved_at: T0, status: 'reserved', settled_usd: null, settled_at: null, answer_sha256: null, attempt: 1, ...over });
const SPEC = { key: 'k1', provider: 'stub', what: 'one call', estimate_usd: 0.6 };

test('a reserved row whose answer is in the cache is settled from it and never sent again', async () => {
  const jobsDir = approvedJob();
  const key = callKey('skinning', 'k1');
  writeLedger(jobsDir, { schema: LEDGER_SCHEMA_ID, job_id: ID, cap_usd: 60, rows: [row({ sending_at: T0 })] });
  writeFile(cacheFile(jobsDir, ID, key), JSON.stringify({ answer: { ok: 1 }, settled_usd: 0.55 }));
  let sent = 0;
  const logs = [];
  const call = createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 2, now: () => 'T', log: (m) => logs.push(m) });
  const send = async () => {
    sent += 1;
    return { answer: 'sent again' };
  };
  assert.deepEqual(await call(SPEC, send), { ok: 1 });
  assert.equal(sent, 0, 'the call that already succeeded is not sent again');
  let l = readLedger(jobsDir, ID);
  assert.equal(l.rows.length, 1, 'no second row');
  assert.deepEqual([l.rows[0].status, l.rows[0].settled_usd, l.rows[0].recovered, l.rows[0].settled_at], ['settled', 0.55, true, 'T']);
  assert.deepEqual(validate(LEDGER_SCHEMA, l), []);
  assert.equal(readJob(jobsDir, ID).cost.spent_usd, 0.55, 'spent_usd follows the ledger');
  assert.match(logs.join('\n'), /settled from the cache \(recovered\)/);
  // once more: now it is a plain cache hit
  assert.deepEqual(await call(SPEC, send), { ok: 1 });
  assert.equal(sent, 0);
  l = readLedger(jobsDir, ID);
  assert.equal(l.rows.length, 1);
});

test('a reserved row whose send had started, with NO cached answer, is orphaned, kept and counted; the call is sent once', async () => {
  const jobsDir = approvedJob();
  writeLedger(jobsDir, { schema: LEDGER_SCHEMA_ID, job_id: ID, cap_usd: 60, rows: [row({ sending_at: T0 })] });
  let sent = 0;
  const call = createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 2, now: () => 'T' });
  assert.equal(await call(SPEC, async () => {
    sent += 1;
    return { answer: 'fresh', usd: 0.6 };
  }), 'fresh');
  assert.equal(sent, 1);
  const l = readLedger(jobsDir, ID);
  assert.deepEqual(l.rows.map((r) => [r.seq, r.status]), [[1, 'orphaned'], [2, 'settled']]);
  assert.equal(l.rows[0].orphaned_at, 'T');
  assert.equal(readJob(jobsDir, ID).cost.spent_usd, 0.6, 'the orphaned reservation is not counted as spent');
  assert.deepEqual(readCache(jobsDir, ID, callKey('skinning', 'k1')).answer, 'fresh');
  // the orphaned reservation counts toward the cap: 0.6 held + 0.6 settled + 59 > 60
  const e = await createPaidCall({ jobsDir, jobId: ID, stage: 'gating', attempt: 1 })(
    { key: 'k2', provider: 'stub', what: 'big', estimate_usd: 59 }, async () => assert.fail('must not be sent')).catch((x) => x);
  assert.ok(e instanceof CapReached);
  assert.equal(e.code, 'BUDGET_CAP');
  assert.equal(e.needUsd, 60.2, 'what the job needs in all: held + settled + this call');
  assert.equal(readLedger(jobsDir, ID).rows.length, 2, 'nothing reserved beyond the cap');
});

test('syncSpent writes the settled sum only when it differs; a cache file of the wrong shape is no answer', () => {
  const jobsDir = approvedJob();
  writeLedger(jobsDir, { schema: LEDGER_SCHEMA_ID, job_id: ID, cap_usd: 60, rows: [
    row({ status: 'settled', settled_usd: 0.6, settled_at: T0, answer_sha256: 'a'.repeat(64) }),
    row({ seq: 2, call_key: callKey('gating', 'k'), stage: 'gating', status: 'settled', settled_usd: 0.6, settled_at: T0, answer_sha256: 'a'.repeat(64) }),
    row({ seq: 3, call_key: callKey('finishing', 'k'), stage: 'finishing', status: 'orphaned' }),
    row({ seq: 4, call_key: callKey('finishing', 'k2'), stage: 'finishing', status: 'failed', settled_usd: 0 }),
  ] });
  updateJob(jobsDir, ID, (j) => {
    j.cost.spent_usd = 0.1;
    return j;
  });
  assert.equal(syncSpent(jobsDir, ID), 1.2);
  const after = readJob(jobsDir, ID);
  assert.equal(after.cost.spent_usd, 1.2);
  assert.equal(syncSpent(jobsDir, ID), 1.2);
  assert.equal(readJob(jobsDir, ID).updated_at, after.updated_at, 'nothing is written when it already agrees');

  const key = callKey('skinning', 'old-shape');
  writeFile(cacheFile(jobsDir, ID, key), JSON.stringify({ ok: 1 }));
  assert.deepEqual(readCache(jobsDir, ID, key), { hit: false }, 'no `answer` field');
  writeFile(cacheFile(jobsDir, ID, key), '{');
  assert.deepEqual(readCache(jobsDir, ID, key), { hit: false }, 'half written');
  writeFile(cacheFile(jobsDir, ID, key), JSON.stringify({ answer: 1, settled_usd: 0.2 }));
  assert.equal(readCache(jobsDir, ID, key, 'f'.repeat(64)).hit, false, 'not the answer the row settled');
  assert.deepEqual([readCache(jobsDir, ID, key).hit, readCache(jobsDir, ID, key).settled_usd], [true, 0.2]);
});

test('the guard runs inside the lock before anything is reserved; a call that comes back late is still recorded', async () => {
  let jobsDir = approvedJob();
  let sent = 0;
  const refused = await createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 1, guard: () => { throw new Error('not the owner'); } })(
    SPEC, async () => { sent += 1; return { answer: 1 }; }).catch((e) => e);
  assert.equal(refused.message, 'not the owner');
  assert.equal(sent, 0);
  assert.equal(fs.existsSync(`${jobsDir}/${ID}/ledger.json`), false, 'nothing was reserved');
  assert.equal(fs.existsSync(`${jobsDir}/${ID}/job.lock`), false, 'the lock is released when the guard throws');

  // A call is in flight; another runner presumes it lost (orphaned); the call comes back: settled, late.
  jobsDir = approvedJob();
  const call = createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 1, now: () => 'T' });
  assert.equal(await call(SPEC, async () => {
    const l = readLedger(jobsDir, ID);
    l.rows[0].status = 'orphaned';
    writeLedger(jobsDir, l);
    return { answer: 'back', usd: 0.6 };
  }), 'back');
  const l = readLedger(jobsDir, ID);
  assert.deepEqual([l.rows[0].status, l.rows[0].late, l.rows[0].settled_usd], ['settled', true, 0.6]);
  assert.deepEqual(validate(LEDGER_SCHEMA, l), []);
  assert.equal(readJob(jobsDir, ID).cost.spent_usd, 0.6);

  // A call that fails: the row is closed as failed, nothing is spent, the error goes up.
  jobsDir = approvedJob();
  const boom = await createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 1 })(SPEC, async () => { throw new Error('provider down'); }).catch((e) => e);
  assert.equal(boom.message, 'provider down');
  assert.deepEqual(readLedger(jobsDir, ID).rows.map((r) => [r.status, r.settled_usd]), [['failed', 0]]);
  assert.equal(readJob(jobsDir, ID).cost.spent_usd, 0);
});

import { ledgerTotals as ledgerTotalsR2 } from '../../engine/ledger.mjs';

test('replaced between the reserve and the send: nothing is sent, the row is closed as never sent', async () => {
  let jobsDir = approvedJob();
  let checks = 0;
  let sent = 0;
  const secondCheckFails = () => {
    if (++checks > 1) throw new Error('replaced');
  };
  const logs = [];
  const err = await createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 1, now: () => 'T', guard: secondCheckFails,
    log: (m) => logs.push(m) })(SPEC, async () => { sent += 1; return { answer: 1 }; }).catch((e) => e);
  assert.equal(err.message, 'replaced');
  assert.equal(sent, 0);
  let l = readLedger(jobsDir, ID);
  assert.deepEqual(l.rows.map((r) => [r.status, r.settled_usd, r.settled_at, r.not_sent]), [['failed', 0, 'T', true]]);
  assert.deepEqual(validate(LEDGER_SCHEMA, l), []);
  assert.equal(ledgerTotalsR2(l).cap_total_usd, 0, 'nothing is held for a call that was never sent');
  assert.equal(fs.existsSync(cacheFile(jobsDir, ID, callKey('skinning', 'k1'))), false);
  assert.equal(fs.existsSync(`${jobsDir}/${ID}/job.lock`), false, 'the lock is released');
  assert.match(logs.join('\n'), /seq 1 was reserved but never sent \(replaced\)/);
  // The next runner is not held back by that row: it reserves and sends.
  assert.equal(await createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 2 })(SPEC, async () => { sent += 1; return { answer: 'a' }; }), 'a');
  assert.equal(sent, 1);
  assert.deepEqual(readLedger(jobsDir, ID).rows.map((r) => r.status), ['failed', 'settled']);

  // The other runner had already presumed the reservation lost (orphaned): the outcome is known now.
  jobsDir = approvedJob();
  checks = 0;
  const err2 = await createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 1, guard: secondCheckFails,
    beforeSend: () => {
      const d = readLedger(jobsDir, ID);
      assert.equal(d.rows[0].status, 'reserved', 'the reserve is on the disk before the seam is called');
      d.rows[0].status = 'orphaned';
      writeLedger(jobsDir, d);
    } })(SPEC, async () => { sent += 1; return { answer: 1 }; }).catch((e) => e);
  assert.equal(err2.message, 'replaced');
  assert.equal(sent, 1, 'not sent');
  l = readLedger(jobsDir, ID);
  assert.deepEqual(l.rows.map((r) => [r.status, r.not_sent]), [['failed', true]]);
  assert.equal(ledgerTotalsR2(l).held_usd, 0);
  assert.equal(ledgerTotalsR2(l).orphaned.length, 0);
});

import { sha256Text as sha256TextR2 } from '../../engine/lib/hash.mjs';

test('a late answer never replaces the cached answer of the runner that owns the job', async () => {
  // The first runner's call is on the wire. Meanwhile the second runner presumes it lost (orphaned), sends
  // the same call, caches ITS answer and settles. Then the first answer comes back.
  let jobsDir = approvedJob();
  const key = callKey('skinning', 'k1');
  const ownerText = JSON.stringify({ answer: 'the owner\'s answer', settled_usd: 0.6 });
  const logs = [];
  const first = createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 1, now: () => 'T1', log: (m) => logs.push(m) });
  assert.equal(await first(SPEC, async () => {
    const l = readLedger(jobsDir, ID);
    l.rows[0].status = 'orphaned';
    l.rows.push({ ...l.rows[0], seq: 2, attempt: 2, status: 'settled', settled_usd: 0.6, settled_at: 'T0', answer_sha256: sha256TextR2(ownerText) });
    writeLedger(jobsDir, l);
    writeFile(cacheFile(jobsDir, ID, key), ownerText);
    return { answer: 'the late answer', usd: 0.6 };
  }), 'the late answer');
  let l = readLedger(jobsDir, ID);
  assert.deepEqual(l.rows.map((r) => [r.seq, r.status, r.late === true, r.settled_usd]), [[1, 'settled', true, 0.6], [2, 'settled', false, 0.6]],
    'both calls were billed, and both rows say so');
  assert.equal(fs.readFileSync(cacheFile(jobsDir, ID, key), 'utf8'), ownerText, 'the cached answer is still the owner\'s');
  assert.notEqual(l.rows[0].answer_sha256, l.rows[1].answer_sha256);
  assert.deepEqual(validate(LEDGER_SCHEMA, l), []);
  assert.equal(readJob(jobsDir, ID).cost.spent_usd, 1.2, 'what was really billed');
  assert.match(logs.join('\n'), /the late answer of seq 1 is recorded in the ledger only/);
  // A stage that runs again gets the owner's answer from the cache: nothing is sent a third time.
  let sent = 0;
  assert.equal(await createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 3 })(SPEC, async () => { sent += 1; return { answer: 'x' }; }), 'the owner\'s answer');
  assert.equal(sent, 0);
  assert.equal(readLedger(jobsDir, ID).rows.length, 2);

  // The late answer comes back BEFORE the second runner has an answer: it is cached (there is nothing to
  // protect yet), and its row is settled late.
  jobsDir = approvedJob();
  const early = createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 1, now: () => 'T1' });
  await early(SPEC, async () => {
    const d = readLedger(jobsDir, ID);
    d.rows[0].status = 'orphaned';
    writeLedger(jobsDir, d);
    return { answer: 'first back', usd: 0.6 };
  });
  l = readLedger(jobsDir, ID);
  assert.deepEqual(l.rows.map((r) => [r.status, r.late]), [['settled', true]]);
  assert.equal(JSON.parse(fs.readFileSync(cacheFile(jobsDir, ID, key), 'utf8')).answer, 'first back');
  assert.equal(l.rows[0].answer_sha256, sha256TextR2(fs.readFileSync(cacheFile(jobsDir, ID, key), 'utf8')));
});

test('syncSpent reads the ledger while it holds the job lock, so a stale total is never written', () => {
  const jobsDir = approvedJob();
  writeLedger(jobsDir, { schema: LEDGER_SCHEMA_ID, job_id: ID, cap_usd: 60, rows: [row({ status: 'settled', settled_usd: 0.6 })] });
  const lock = `${jobsDir}/${ID}/job.lock`;
  const seen = [];
  const spent = syncSpent(jobsDir, ID, { read: (dir, id) => {
    seen.push(fs.existsSync(lock));
    return readLedger(dir, id);
  } });
  assert.equal(spent, 0.6);
  assert.deepEqual(seen, [true], 'one read, inside the lock');
  assert.equal(fs.existsSync(lock), false);
  assert.equal(readJob(jobsDir, ID).cost.spent_usd, 0.6);
  // the ledger changed (another runner settled a call): the next sync writes the new total
  const l = readLedger(jobsDir, ID);
  l.rows.push(row({ seq: 2, call_key: callKey('gating', 'k2'), stage: 'gating', status: 'settled', settled_usd: 0.6 }));
  writeLedger(jobsDir, l);
  assert.equal(syncSpent(jobsDir, ID), 1.2);
  assert.equal(readJob(jobsDir, ID).cost.spent_usd, 1.2);
  // no such job: the total is still answered, nothing is written
  assert.equal(syncSpent(stubConfig().jobsDir, ID), 0);
});

// ---- round 4 (QA round 3, defect D1): no reservation is ever left open; the cache names its row ----
const ledgerOf = (jobsDir, rows) => writeLedger(jobsDir, { schema: LEDGER_SCHEMA_ID, job_id: ID, cap_usd: 60, rows });
const cacheText = (answer, seq) => JSON.stringify(seq === undefined ? { answer, settled_usd: 0.6 } : { answer, settled_usd: 0.6, seq });
const KEY = callKey('skinning', 'k1');
const neverSend = async () => assert.fail('the call must not be sent');
const statuses = (jobsDir) => readLedger(jobsDir, ID).rows.map((r) => [r.seq, r.status]);

test('D1: the answer is in the cache and ANOTHER runner left a reservation: that row is closed too, never left reserved', async () => {
  // seq 1: the first runner's late answer, settled, its answer cached. seq 2: the second runner reserved,
  // marked the call as sending, and was killed. The third runner must answer from the cache AND close seq 2.
  let jobsDir = approvedJob();
  const text = cacheText('late answer', 1);
  ledgerOf(jobsDir, [row({ status: 'settled', settled_usd: 0.6, settled_at: T0, answer_sha256: sha256TextR2(text), late: true, sending_at: T0 }),
    row({ seq: 2, attempt: 2, sending_at: T0 })]);
  writeFile(cacheFile(jobsDir, ID, KEY), text);
  const logs = [];
  assert.equal(await createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 3, now: () => 'T', log: (m) => logs.push(m) })(SPEC, neverSend), 'late answer');
  let l = readLedger(jobsDir, ID);
  assert.deepEqual(l.rows.map((r) => [r.seq, r.status, r.orphaned_at ?? null]), [[1, 'settled', null], [2, 'orphaned', 'T']],
    'the send of seq 2 had started: outcome unknown, orphaned');
  assert.equal(l.rows.some((r) => r.status === 'reserved'), false);
  assert.deepEqual(validate(LEDGER_SCHEMA, l), []);
  assert.match(logs.join('\n'), /1 marked orphaned \(the send had started\), 0 closed as never sent/);
  // the same, but seq 2 was never marked as sending: it was never sent, so nothing is held for it
  jobsDir = approvedJob();
  ledgerOf(jobsDir, [row({ status: 'settled', settled_usd: 0.6, settled_at: T0, answer_sha256: sha256TextR2(text), late: true, sending_at: T0 }),
    row({ seq: 2, attempt: 2, sending_at: null })]);
  writeFile(cacheFile(jobsDir, ID, KEY), text);
  assert.equal(await createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 3, now: () => 'T' })(SPEC, neverSend), 'late answer');
  l = readLedger(jobsDir, ID);
  assert.deepEqual(l.rows.map((r) => [r.seq, r.status, r.not_sent === true, r.settled_usd]), [[1, 'settled', false, 0.6], [2, 'failed', true, 0]]);
  assert.equal(ledgerTotalsR2(l).held_usd, 0, 'no hold is left for a call that was never sent');
  assert.equal(ledgerTotalsR2(l).cap_total_usd, 0.6);
  assert.deepEqual(validate(LEDGER_SCHEMA, l), []);
});

test('a reserved row that was never marked as sending is closed as never sent; the call goes out once, nothing is held', async () => {
  const jobsDir = approvedJob();
  ledgerOf(jobsDir, [row()]);   // reserved, no sending_at: its runner died (or was blocked and killed) before the send
  let sent = 0;
  assert.equal(await createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 2, now: () => 'T' })(SPEC, async () => { sent += 1; return { answer: 'a' }; }), 'a');
  assert.equal(sent, 1);
  const l = readLedger(jobsDir, ID);
  assert.deepEqual(l.rows.map((r) => [r.seq, r.status, r.not_sent === true]), [[1, 'failed', true], [2, 'settled', false]]);
  assert.equal(ledgerTotalsR2(l).held_usd, 0);
  assert.equal(readJob(jobsDir, ID).cost.spent_usd, 0.6);
});

test('the cache names its row: that row is the one settled from it, whatever its place or state', async () => {
  // two reserved rows, the cache is the OLDER one's: that one is recovered, the newer is closed
  let jobsDir = approvedJob();
  ledgerOf(jobsDir, [row({ sending_at: T0 }), row({ seq: 2, attempt: 2, sending_at: T0 })]);
  writeFile(cacheFile(jobsDir, ID, KEY), cacheText('of seq 1', 1));
  assert.equal(await createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 3, now: () => 'T' })(SPEC, neverSend), 'of seq 1');
  let l = readLedger(jobsDir, ID);
  assert.deepEqual(l.rows.map((r) => [r.seq, r.status, r.recovered === true]), [[1, 'settled', true], [2, 'orphaned', false]]);
  // an ORPHANED row's runner came back, cached its answer and died before it settled: the call was paid
  jobsDir = approvedJob();
  ledgerOf(jobsDir, [row({ status: 'orphaned', orphaned_at: T0, sending_at: T0 }), row({ seq: 2, attempt: 2 })]);
  writeFile(cacheFile(jobsDir, ID, KEY), cacheText('came back', 1));
  assert.equal(await createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 3, now: () => 'T' })(SPEC, neverSend), 'came back');
  l = readLedger(jobsDir, ID);
  assert.deepEqual(l.rows.map((r) => [r.seq, r.status, r.recovered === true, r.late === true, r.settled_usd]),
    [[1, 'settled', true, true, 0.6], [2, 'failed', false, false, 0]]);
  assert.deepEqual(validate(LEDGER_SCHEMA, l), []);
  assert.equal(readJob(jobsDir, ID).cost.spent_usd, 0.6);
  // a cache written before rows were named (no seq): the newest reserved row, as before
  jobsDir = approvedJob();
  ledgerOf(jobsDir, [row({ sending_at: T0 }), row({ seq: 2, attempt: 2, sending_at: T0 })]);
  writeFile(cacheFile(jobsDir, ID, KEY), cacheText('unnamed'));
  assert.equal(await createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 3 })(SPEC, neverSend), 'unnamed');
  assert.deepEqual(statuses(jobsDir), [[1, 'orphaned'], [2, 'settled']]);
});

test('a cache that cannot be trusted is no answer: the call is made again, and the new row says why', async () => {
  // it names a row that failed
  let jobsDir = approvedJob();
  ledgerOf(jobsDir, [row({ status: 'failed', settled_usd: 0, settled_at: T0, not_sent: true })]);
  writeFile(cacheFile(jobsDir, ID, KEY), cacheText('whose?', 1));
  let sent = 0;
  const send = async () => { sent += 1; return { answer: `fresh ${sent}` }; };
  assert.equal(await createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 2 })(SPEC, send), 'fresh 1');
  assert.deepEqual(statuses(jobsDir), [[1, 'failed'], [2, 'settled']]);
  assert.equal(readCache(jobsDir, ID, KEY).seq, 2, 'the cache is the new row\'s now');
  // it names a row that does not exist
  jobsDir = approvedJob();
  writeFile(cacheFile(jobsDir, ID, KEY), cacheText('nobody', 7));
  assert.equal(await createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 1 })(SPEC, send), 'fresh 2');
  assert.deepEqual(statuses(jobsDir), [[1, 'settled']]);
  // the settled row recorded another hash (the file was changed), or the file is gone: the cache is the only
  // copy of a paid answer, so the call is made AGAIN, and the new row names the row it repeats
  jobsDir = approvedJob();
  const logs = [];
  const call = (attempt) => createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt, log: (m) => logs.push(m) });
  assert.equal(await call(1)(SPEC, send), 'fresh 3');
  writeFile(cacheFile(jobsDir, ID, KEY), cacheText('changed by hand', 1));
  assert.equal(await call(2)(SPEC, send), 'fresh 4');
  fs.rmSync(cacheFile(jobsDir, ID, KEY));
  assert.equal(await call(3)(SPEC, send), 'fresh 5');
  const l = readLedger(jobsDir, ID);
  assert.deepEqual(l.rows.map((r) => [r.seq, r.status, r.resend_of ?? null]), [[1, 'settled', null], [2, 'settled', 1], [3, 'settled', 2]]);
  assert.deepEqual(validate(LEDGER_SCHEMA, l), []);
  assert.equal(readJob(jobsDir, ID).cost.spent_usd, 1.8, 'every one of them was billed');
  assert.match(logs.join('\n'), /the cached answer of seq 1 is gone; paid call [0-9a-f]{12} is made again/);
});

test('a row is marked as sending just before the send, under the lock; the pause "after the reserve" comes after that mark', async () => {
  const jobsDir = approvedJob();
  const seen = [];
  const look = (where) => {
    const r = readLedger(jobsDir, ID).rows[0];
    seen.push([where, r.status, r.sending_at]);
  };
  const call = createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 1, now: () => 'T', pauseAfterReserveMs: 5,
    beforeSend: () => look('beforeSend'), sleep: async () => look('pause') });
  await call(SPEC, async () => {
    look('send');
    return { answer: 1 };
  });
  assert.deepEqual(seen, [['beforeSend', 'reserved', null], ['pause', 'reserved', 'T'], ['send', 'reserved', 'T']]);
  const l = readLedger(jobsDir, ID);
  assert.deepEqual([l.rows[0].status, l.rows[0].sending_at], ['settled', 'T']);
  assert.deepEqual(validate(LEDGER_SCHEMA, l), []);
  assert.equal(readCache(jobsDir, ID, KEY).seq, 1);
});

test('a reservation that was closed while its own runner still owns the job is not sent (a state that should not exist)', async () => {
  // confirm() refuses to send a row that is no longer `reserved`, whoever closed it.
  const jobsDir = approvedJob();
  let sent = 0;
  const first = createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 1,
    beforeSend: () => {
      const d = readLedger(jobsDir, ID);
      Object.assign(d.rows[0], { status: 'failed', settled_usd: 0, settled_at: 'T', not_sent: true });
      writeLedger(jobsDir, d);
    } });
  const e = await first(SPEC, async () => { sent += 1; return { answer: 1 }; }).catch((x) => x);
  assert.equal(e.code, 'STAGE_FAILED');
  assert.match(e.message, /the reservation seq 1 was closed by another runner \(failed\)/);
  assert.equal(sent, 0);
  assert.deepEqual(readLedger(jobsDir, ID).rows.map((r) => [r.status, r.not_sent]), [['failed', true]]);
});

// ---- round 5 (QA round 4): D2 two same-key calls at once, O-E a planted cache, O-G a busy lock after the send ----
import { withJobLock as withJobLockR5 } from '../../engine/jobs.mjs';
import { isTransient as isTransientR5 } from '../../engine/lib/atomic.mjs';
import { HOLD_ANSWER_MS, HOLD_RETRY_MS } from '../../engine/ledger.mjs';

const later = (ms, value) => new Promise((r) => setTimeout(() => r(value), ms));

test('D2: two calls with the same key at the same moment are ONE call: one reservation, one send, the same answer', async () => {
  let jobsDir = approvedJob();
  let sent = 0;
  const logs = [];
  const pc = createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 1, log: (m) => logs.push(m) });
  const send = async () => {
    sent += 1;
    return later(40, { answer: { n: sent }, usd: 0.6 });
  };
  const [a, b, c] = await Promise.all([pc(SPEC, send), pc(SPEC, send), pc(SPEC, send)]);
  assert.equal(sent, 1, 'sent ONCE');
  assert.deepEqual([a, b, c], [{ n: 1 }, { n: 1 }, { n: 1 }]);
  let l = readLedger(jobsDir, ID);
  assert.deepEqual(l.rows.map((r) => [r.seq, r.status, r.settled_usd, Boolean(r.sending_at)]), [[1, 'settled', 0.6, true]], 'one row');
  assert.equal(readJob(jobsDir, ID).cost.spent_usd, 0.6);
  assert.equal(logs.filter((m) => /is already in flight in this stage/.test(m)).length, 2);
  // afterwards the key is free again: the next call is answered from the cache, nothing is sent
  assert.deepEqual(await pc(SPEC, send), { n: 1 });
  assert.equal(sent, 1);
  // another key at the same moment is another call
  const other = { key: 'k2', provider: 'stub', what: 'another call', estimate_usd: 0.6 };
  await Promise.all([pc(other, send), pc({ ...SPEC, key: 'k3' }, send)]);
  assert.equal(sent, 3);
  assert.equal(readLedger(jobsDir, ID).rows.length, 3);
  // the first call fails: the second gets the same error, and the call was tried once
  jobsDir = approvedJob();
  let tries = 0;
  const failing = createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 1 });
  const boom = async () => {
    tries += 1;
    await later(20);
    throw new Error('provider down');
  };
  const res = await Promise.allSettled([failing(SPEC, boom), failing(SPEC, boom)]);
  assert.deepEqual(res.map((r) => [r.status, r.reason?.message]), [['rejected', 'provider down'], ['rejected', 'provider down']]);
  assert.equal(tries, 1);
  l = readLedger(jobsDir, ID);
  assert.deepEqual(l.rows.map((r) => [r.status, r.settled_usd]), [['failed', 0]]);
  // and after a failure the key is free: a new call is a new try
  assert.equal(await failing(SPEC, async () => ({ answer: 'ok' })), 'ok');
  assert.deepEqual(readLedger(jobsDir, ID).rows.map((r) => r.status), ['failed', 'settled']);
});

test('O-E: a cache file is no answer for a row whose send never started, whatever the file says', async () => {
  for (const seq of [1, undefined]) {
    const jobsDir = approvedJob();
    ledgerOf(jobsDir, [row()]);   // reserved, never marked as sending
    writeFile(cacheFile(jobsDir, ID, KEY), JSON.stringify(seq === undefined ? { answer: 'planted', settled_usd: 50 } : { answer: 'planted', settled_usd: 50, seq }));
    let sent = 0;
    const got = await createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 2, now: () => 'T' })(SPEC, async () => { sent += 1; return { answer: 'real', usd: 0.6 }; });
    assert.equal(got, 'real', 'the planted answer was not used');
    assert.equal(sent, 1);
    const l = readLedger(jobsDir, ID);
    assert.deepEqual(l.rows.map((r) => [r.seq, r.status, r.not_sent === true, r.settled_usd]), [[1, 'failed', true, 0], [2, 'settled', false, 0.6]]);
    assert.equal(readJob(jobsDir, ID).cost.spent_usd, 0.6, 'spent follows what was really billed, not the file');
    assert.equal(readCache(jobsDir, ID, KEY).answer, 'real');
    assert.equal(readCache(jobsDir, ID, KEY).seq, 2);
  }
  // the same file for a row whose send HAD started is its answer (the runner died after the cache write)
  const jobsDir = approvedJob();
  ledgerOf(jobsDir, [row({ sending_at: T0 })]);
  writeFile(cacheFile(jobsDir, ID, KEY), cacheText('cached before the kill', 1));
  assert.equal(await createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 2 })(SPEC, neverSend), 'cached before the kill');
  assert.deepEqual(statuses(jobsDir), [[1, 'settled']]);
});

test('O-G: the job lock is busy right after the send: the answer stays in hand and is recorded when the lock is free', async () => {
  assert.equal(isTransientR5(new Error('job x: lock busy')), true);
  assert.equal(isTransientR5(Object.assign(new Error('x'), { code: 'EBUSY' })), true);
  assert.equal(isTransientR5(Object.assign(new Error('UNKNOWN: unknown error, open'), { code: 'UNKNOWN' })), true, 'a Windows error with no name: a mapped file');
  assert.equal(isTransientR5(new Error('disk full')), false);
  assert.deepEqual([HOLD_ANSWER_MS, HOLD_RETRY_MS], [30000, 250]);
  let jobsDir = approvedJob();
  let busy = 0;
  let sent = 0;
  const logs = [];
  const naps = [];
  const lock = (dir, id, fn) => {
    if (busy > 0) {
      busy -= 1;
      throw new Error(`job ${id}: lock busy`);
    }
    return withJobLockR5(dir, id, fn);
  };
  const pc = createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 1, lock, log: (m) => logs.push(m), sleep: async (ms) => naps.push(ms) });
  assert.equal(await pc(SPEC, async () => {
    sent += 1;
    busy = 3;   // the cache write fails twice, then the settle once
    return { answer: 'kept', usd: 0.6 };
  }), 'kept');
  assert.equal(sent, 1);
  assert.deepEqual(naps, [250, 250, 250]);
  let l = readLedger(jobsDir, ID);
  assert.deepEqual(l.rows.map((r) => [r.status, r.settled_usd]), [['settled', 0.6]]);
  assert.equal(readCache(jobsDir, ID, KEY).answer, 'kept');
  assert.equal(logs.filter((m) => /waits \(job abcdef0123456789: lock busy\); the answer stays in hand/.test(m)).length, 3);
  assert.equal(readJob(jobsDir, ID).cost.spent_usd, 0.6);
  // The lock stays busy for longer than the hold: only then is the answer lost. The row keeps its mark;
  // the next attempt cannot know the outcome, marks it orphaned and makes the call again (a known limit).
  jobsDir = approvedJob();
  let t = 0;
  let stuck = false;
  const lock2 = (dir, id, fn) => {
    if (stuck) throw new Error(`job ${id}: lock busy`);
    return withJobLockR5(dir, id, fn);
  };
  const pc2 = createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 1, lock: lock2, clock: () => t, holdMs: 1000, sleep: async (ms) => { t += ms; } });
  const e = await pc2(SPEC, async () => {
    stuck = true;
    return { answer: 'lost', usd: 0.6 };
  }).catch((x) => x);
  assert.match(e.message, /lock busy$/);
  assert.equal(t, 1000, 'it held the answer for the whole hold');
  stuck = false;
  l = readLedger(jobsDir, ID);
  assert.deepEqual(l.rows.map((r) => [r.status, Boolean(r.sending_at)]), [['reserved', true]]);
  assert.equal(await createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 2 })(SPEC, async () => ({ answer: 'again', usd: 0.6 })), 'again');
  assert.deepEqual(statuses(jobsDir), [[1, 'orphaned'], [2, 'settled']]);
  // an error that is not a passing one is not waited for
  jobsDir = approvedJob();
  const lock3 = (dir, id, fn) => {
    if (stuck) throw new Error('disk full');
    return withJobLockR5(dir, id, fn);
  };
  const waits = [];
  const e3 = await createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 1, lock: lock3, sleep: async (ms) => waits.push(ms) })(SPEC, async () => {
    stuck = true;
    return { answer: 1 };
  }).catch((x) => x);
  stuck = false;
  assert.equal(e3.message, 'disk full');
  assert.deepEqual(waits, []);
});

// ---- round 6 (QA round 5): D3 the copy of the settled total, O-J amounts in a cache, O-L the close of a failed send ----
import { withTrueCost, shownJob, READ_REPAIR_WAIT_MS } from '../../engine/control.mjs';
import { isAmount, MAX_USD } from '../../engine/ledger.mjs';

test('D3: job.cost.spent_usd is written in the same locked step as the settle, before anything else can happen', async () => {
  // The pause after the settle is the moment at which round 5 killed the runner: the copy must be true there.
  let jobsDir = approvedJob();
  const seen = [];
  const call = createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 1, pauseAfterSettleMs: 5,
    sleep: async () => seen.push([readLedger(jobsDir, ID).rows[0].status, readJob(jobsDir, ID).cost.spent_usd]) });
  await call(SPEC, async () => ({ answer: 1, usd: 0.6 }));
  assert.deepEqual(seen, [['settled', 0.6]], 'at the pause after the settle the job file already says 0.6');
  // a LATE settle (the row was presumed lost meanwhile), on a job that is done
  jobsDir = approvedJob();
  updateJob(jobsDir, ID, (j) => setState(j, 'done', T0));
  const late = [];
  const first = createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 1, pauseAfterSettleMs: 5,
    sleep: async () => late.push(readJob(jobsDir, ID).cost.spent_usd) });
  await first(SPEC, async () => {
    const d = readLedger(jobsDir, ID);
    d.rows[0].status = 'orphaned';
    writeLedger(jobsDir, d);
    return { answer: 'late', usd: 0.6 };
  });
  assert.deepEqual(late, [0.6], 'the late row is in the total before the runner does anything else');
  assert.equal(readLedger(jobsDir, ID).rows[0].late, true);
  // a row recovered from the cache: the total follows in the same step, with no send
  jobsDir = approvedJob();
  ledgerOf(jobsDir, [row({ sending_at: T0 })]);
  writeFile(cacheFile(jobsDir, ID, KEY), cacheText('cached', 1));
  let inside = null;
  const lock = (dir, id, fn) => withJobLockR5(dir, id, () => {
    const out = fn();
    inside = readJob(dir, id).cost.spent_usd;   // still inside the locked step
    return out;
  });
  assert.equal(await createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 2, lock })(SPEC, neverSend), 'cached');
  assert.equal(inside, 0.6);
});

test('D3: withTrueCost / shownJob: the ledger\'s total is what a read of a job reports', () => {
  const config = stubConfig();
  const job = newJob({ id: ID, mode: 'stub', now: T0, input });
  setState(job, 'done', T0);
  job.cost = { spent_usd: 1.8, cap_usd: 60 };
  writeJob(config.jobsDir, job);
  // no ledger file: nothing was spent
  assert.equal(withTrueCost(config, { ...job, cost: { spent_usd: 0, cap_usd: 60 } }).cost.spent_usd, 0);
  writeLedger(config.jobsDir, { schema: LEDGER_SCHEMA_ID, job_id: ID, cap_usd: 60,
    rows: [row({ status: 'settled', settled_usd: 0.6 }), row({ seq: 2, status: 'settled', settled_usd: 1.8 }), row({ seq: 3, status: 'orphaned', sending_at: T0 })] });
  const same = { ...job, cost: { spent_usd: 2.4, cap_usd: 60 } };
  assert.equal(withTrueCost(config, same), same, 'nothing to correct: the same object, nothing written');
  const shown = withTrueCost(config, job);
  assert.deepEqual(shown.cost, { spent_usd: 2.4, cap_usd: 60 }, 'settled rows only; the orphaned hold is not spent');
  assert.equal(job.cost.spent_usd, 1.8, 'the argument is not changed');
  assert.equal(readJob(config.jobsDir, ID).cost.spent_usd, 2.4, 'the copy on the disk is put right');
  // the copy cannot be written: the true number is still the answer
  let tried = 0;
  const got = withTrueCost(config, job, { sync: () => { tried += 1; throw new Error('job x: lock busy'); } });
  assert.equal(tried, 1);
  assert.equal(got.cost.spent_usd, 2.4);
  // the ledger cannot be read: the copy is all there is
  assert.equal(withTrueCost(config, job, { read: () => { throw new Error('EBUSY'); } }), job);
  const s = shownJob(config, job, { isAlive: () => false });
  assert.deepEqual([s.cost.spent_usd, s.runner.alive], [2.4, false]);
});

test('D4 / O-J / O-P: a cache whose amount is not a number from 0 to 1,000,000 is not an answer', async () => {
  for (const [what, v] of [[0, true], [0.6, true], [50, true], [1000000, true], [1000000.01, false], [1e7, false], [1e308, false],
    [-5, false], [-0.000001, false], [Number.NaN, false], [Infinity, false], [null, false], [undefined, false], ['0.6', false], ['abc', false], [true, false], [[1], false], [{}, false]]) {
    assert.equal(isAmount(what), v, `isAmount(${String(what)})`);
  }
  assert.equal(MAX_USD, 1000000);
  // every one of these files sits beside a row whose send had started: a real amount would make it its answer
  const files = {
    'null': '{"answer":"x","settled_usd":null,"seq":1}',
    'missing': '{"answer":"x","seq":1}',
    'negative': '{"answer":"x","settled_usd":-5,"seq":1}',
    'text': '{"answer":"x","settled_usd":"0.6","seq":1}',
    'not a number': '{"answer":"x","settled_usd":NaN,"seq":1}',
    'huge': '{"answer":"x","settled_usd":1e308,"seq":1}',
    'over the bound': '{"answer":"x","settled_usd":1000001,"seq":1}',
    'true': '{"answer":"x","settled_usd":true,"seq":1}',
  };
  for (const [name, text] of Object.entries(files)) {
    const jobsDir = approvedJob();
    ledgerOf(jobsDir, [row({ sending_at: T0 })]);
    writeFile(cacheFile(jobsDir, ID, KEY), text);
    assert.equal(readCache(jobsDir, ID, KEY).hit, false, name);
    let sent = 0;
    assert.equal(await createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 2 })(SPEC, async () => { sent += 1; return { answer: 'real', usd: 0.6 }; }), 'real', name);
    assert.equal(sent, 1, `${name}: the file was not used; the outcome of the old send is unknown, so the call is made`);
    const l = readLedger(jobsDir, ID);
    assert.deepEqual(l.rows.map((r) => [r.seq, r.status, r.settled_usd]), [[1, 'orphaned', null], [2, 'settled', 0.6]], name);
    assert.deepEqual(validate(LEDGER_SCHEMA, l), [], name);
    assert.equal(readJob(jobsDir, ID).cost.spent_usd, 0.6, name);
  }
  // amounts that ARE amounts, zero included (a free call)
  for (const amount of [0, 0.6, 1000000]) {
    const jobsDir = approvedJob(2000000);
    ledgerOf(jobsDir, [row({ sending_at: T0 })]);
    writeFile(cacheFile(jobsDir, ID, KEY), JSON.stringify({ answer: 'kept', settled_usd: amount, seq: 1 }));
    assert.equal(await createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 2 })(SPEC, neverSend), 'kept');
    assert.deepEqual(readLedger(jobsDir, ID).rows.map((r) => [r.status, r.settled_usd]), [['settled', amount]]);
  }
});

test('O-P: an estimate that is not an amount stops the call before anything is written; a cost that is not one is recorded as the estimate', async () => {
  for (const bad of [-1, Number.NaN, 1e308, '0.6', true]) {
    const jobsDir = approvedJob();
    let sent = 0;
    const e = await createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 1 })({ ...SPEC, estimate_usd: bad }, async () => { sent += 1; return { answer: 1 }; }).catch((x) => x);
    assert.equal(e.code, 'STAGE_FAILED', String(bad));
    assert.match(e.message, /estimate_usd is not an amount/);
    assert.equal(sent, 0);
    assert.equal(fs.existsSync(`${jobsDir}/${ID}/ledger.json`), false, 'nothing was reserved');
  }
  // no estimate at all = 0, as before
  let jobsDir = approvedJob();
  assert.equal(await createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 1 })({ key: 'k1', provider: 'stub', what: 'free' }, async () => ({ answer: 'ok' })), 'ok');
  assert.deepEqual(readLedger(jobsDir, ID).rows.map((r) => [r.reserved_usd, r.settled_usd]), [[0, 0]]);
  // what the call says it cost
  for (const [said, recorded, logged] of [[0.55, 0.55, false], [0, 0, false], [undefined, 0.6, false], [null, 0.6, false],
    [Number.NaN, 0.6, true], [-3, 0.6, true], [1e308, 0.6, true], ['0.55', 0.6, true]]) {
    jobsDir = approvedJob();
    const logs = [];
    await createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 1, log: (m) => logs.push(m) })(SPEC, async () => ({ answer: 1, usd: said }));
    const l = readLedger(jobsDir, ID);
    assert.deepEqual(l.rows.map((r) => [r.status, r.settled_usd]), [['settled', recorded]], String(said));
    assert.deepEqual(validate(LEDGER_SCHEMA, l), [], String(said));
    assert.equal(readCache(jobsDir, ID, KEY).settled_usd, recorded);
    assert.equal(logs.some((m) => /came back with a cost that is not an amount/.test(m)), logged, String(said));
    assert.equal(readJob(jobsDir, ID).cost.spent_usd, recorded);
  }
});

test('O-M: a read of a job does not wait for a busy job lock; it answers with the ledger\'s total at once', () => {
  const config = stubConfig();
  const job = newJob({ id: ID, mode: 'stub', now: T0, input });
  job.cost = { spent_usd: 99, cap_usd: 60 };
  writeJob(config.jobsDir, job);
  writeLedger(config.jobsDir, { schema: LEDGER_SCHEMA_ID, job_id: ID, cap_usd: 60, rows: [row({ status: 'settled', settled_usd: 0.6, sending_at: T0 })] });
  holdLock(`${config.jobsDir}/${ID}/job.lock`);   // held by a live process: busy for every writer
  const t0 = Date.now();
  const shown = withTrueCost(config, job);
  const ms = Date.now() - t0;
  fs.rmSync(`${config.jobsDir}/${ID}/job.lock`, { recursive: true });
  assert.equal(shown.cost.spent_usd, 0.6);
  assert.ok(ms < 1000, `answered in ${ms} ms (the lock wait of a writer is 2000)`);
  assert.equal(READ_REPAIR_WAIT_MS, 50);
  assert.equal(readJob(config.jobsDir, ID).cost.spent_usd, 99, 'the copy could not be written; the next read does it');
  assert.equal(withTrueCost(config, job).cost.spent_usd, 0.6);
  assert.equal(readJob(config.jobsDir, ID).cost.spent_usd, 0.6);
  // syncSpent with its own wait
  holdLock(`${config.jobsDir}/${ID}/job.lock`);
  const t1 = Date.now();
  assert.throws(() => syncSpent(config.jobsDir, ID, { waitMs: 30 }), /lock busy$/);
  assert.ok(Date.now() - t1 < 1000);
  fs.rmSync(`${config.jobsDir}/${ID}/job.lock`, { recursive: true });
});

test('O-L: a failed send whose row cannot be closed at once: the close is tried again, and the caller gets the send\'s own error', async () => {
  let jobsDir = approvedJob();
  let busy = 0;
  const naps = [];
  const logs = [];
  const lock = (dir, id, fn) => {
    if (busy > 0) {
      busy -= 1;
      throw new Error(`job ${id}: lock busy`);
    }
    return withJobLockR5(dir, id, fn);
  };
  const e = await createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 1, lock, sleep: async (ms) => naps.push(ms), log: (m) => logs.push(m) })(SPEC, async () => {
    busy = 2;
    throw new Error('provider down');
  }).catch((x) => x);
  assert.equal(e.message, 'provider down', 'not "lock busy"');
  assert.deepEqual(naps, [250, 250]);
  assert.deepEqual(readLedger(jobsDir, ID).rows.map((r) => [r.status, r.settled_usd]), [['failed', 0]], 'closed as failed once the lock was free');
  // the lock stays busy for longer than the hold: still the send's own error; the row keeps its mark
  jobsDir = approvedJob();
  let t = 0;
  let stuck = false;
  const lock2 = (dir, id, fn) => {
    if (stuck) throw new Error(`job ${id}: lock busy`);
    return withJobLockR5(dir, id, fn);
  };
  const e2 = await createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 1, lock: lock2, clock: () => t, holdMs: 500,
    sleep: async (ms) => { t += ms; }, log: (m) => logs.push(m) })(SPEC, async () => {
    stuck = true;
    throw new Error('provider down again');
  }).catch((x) => x);
  stuck = false;
  assert.equal(e2.message, 'provider down again');
  assert.deepEqual(readLedger(jobsDir, ID).rows.map((r) => [r.status, Boolean(r.sending_at)]), [['reserved', true]]);
  assert.match(logs.join('\n'), /seq 1 could not be closed as failed \(job abcdef0123456789: lock busy\); it stays reserved/);
});

// ---- round 8 (QA round 7): D6 what a ledger file must be; O-2 the estimate first; O-3 an answer JSON cannot hold ----
import { checkLedger, LedgerUnreadable } from '../../engine/ledger.mjs';

test('D6 / O-1: a ledger file is read only when it is the ledger of this job, row by row', () => {
  const jobsDir = approvedJob();
  const file = `${jobsDir}/${ID}/ledger.json`;
  const good = () => ({ schema: LEDGER_SCHEMA_ID, job_id: ID, cap_usd: 60,
    rows: [row({ status: 'settled', settled_usd: 0.6, sending_at: T0 }), row({ seq: 2 }), row({ seq: 3, status: 'orphaned', sending_at: T0 }), row({ seq: 4, status: 'failed', settled_usd: 0 })] });
  writeFile(file, JSON.stringify(good()));
  assert.equal(readLedger(jobsDir, ID).rows.length, 4);
  assert.equal(checkLedger(good(), ID).job_id, ID);
  const no = (change, why) => {
    const doc = good();
    const out = change(doc);
    writeFile(file, typeof out === 'string' ? out : JSON.stringify(out === undefined ? doc : out));
    assert.throws(() => readLedger(jobsDir, ID), (e) => e instanceof LedgerUnreadable && e.code === 'LEDGER_UNREADABLE' && e.message.startsWith(`ledger.json of job ${ID} cannot be read: `) && why.test(e.message), `${why}`);
  };
  no(() => '{ "rows": [', /it is not JSON/);
  no(() => '', /it is not JSON/);
  no(() => 'null', /not a ledger document/);
  no(() => '[]', /not a ledger document/);
  no(() => '"x"', /not a ledger document/);
  no((d) => { d.schema = 'habait/ledger.v2'; }, /its schema is "habait\/ledger\.v2"/);
  no((d) => { delete d.schema; }, /its schema is undefined/);
  no((d) => { d.job_id = '0123456789abcdef'; }, /it names job "0123456789abcdef"/);
  no((d) => { delete d.job_id; }, /it names job undefined/);
  no((d) => { d.cap_usd = '60'; }, /cap_usd/);
  no((d) => { d.cap_usd = -1; }, /cap_usd/);
  no((d) => { d.rows = null; }, /no list of rows/);
  no((d) => { delete d.rows; }, /no list of rows/);
  no((d) => { d.rows = 'abc'; }, /no list of rows/);
  no((d) => { d.rows = [1, 2]; }, /row 1 is not a row/);
  no((d) => { d.rows = [{}]; }, /row 1 has seq undefined/);
  no((d) => { d.rows[1].seq = 7; }, /row 2 has seq 7/);
  no((d) => { d.rows.splice(1, 1); }, /row 2 has seq 3/);
  no((d) => { d.rows[0].call_key = 5; }, /row 1 has no call_key/);
  no((d) => { delete d.rows[0].stage; }, /row 1 has no stage/);
  no((d) => { d.rows[0].status = 'paid'; }, /row 1 has the status "paid"/);
  no((d) => { d.rows[0].settled_usd = '5'; }, /row 1: settled_usd is not an amount/);
  no((d) => { d.rows[0].settled_usd = 1e308; }, /row 1: settled_usd is not an amount/);
  no((d) => { d.rows[0].settled_usd = null; }, /row 1: settled_usd is not an amount/);   // a settled row has an amount
  no((d) => { d.rows[1].reserved_usd = -1; }, /row 2: reserved_usd is not an amount/);
  no((d) => { d.rows[1].reserved_usd = null; }, /row 2: reserved_usd is not an amount/);
  // a cap of null (no approval yet) and one above a million are fine: a cap is not the price of one call
  for (const cap of [null, 0, 5000000]) {
    const d = good();
    d.cap_usd = cap;
    writeFile(file, JSON.stringify(d));
    assert.equal(readLedger(jobsDir, ID).cap_usd, cap);
  }
  // no file: an empty ledger of this job
  fs.rmSync(file);
  assert.deepEqual(readLedger(jobsDir, ID, 60), { schema: LEDGER_SCHEMA_ID, job_id: ID, cap_usd: 60, rows: [] });
  // writing: only a ledger of the job it names, and only under a job id
  assert.throws(() => writeLedger(jobsDir, { rows: [] }), LedgerUnreadable);
  assert.throws(() => writeLedger(jobsDir, { schema: LEDGER_SCHEMA_ID, job_id: 'undefined', cap_usd: null, rows: [] }), /it has no job id/);
  assert.throws(() => writeLedger(jobsDir, { schema: LEDGER_SCHEMA_ID, job_id: ID, cap_usd: null, rows: [{}] }), /row 1 has seq undefined/);
  assert.equal(fs.existsSync(`${jobsDir}/undefined`), false);
  assert.equal(fs.existsSync(file), false, 'nothing was written');
  // a read through the engine reports the copy when the file is not this job's ledger
  writeFile(file, JSON.stringify({ ...good(), job_id: '0123456789abcdef' }));
  updateJob(jobsDir, ID, (j) => { j.cost.spent_usd = 1.8; return j; });
  const config = { jobsDir };
  assert.equal(withTrueCost(config, readJob(jobsDir, ID)).cost.spent_usd, 1.8);
  assert.equal(readJob(jobsDir, ID).cost.spent_usd, 1.8, 'the copy was not written over');
});

test('O-2: an estimate that is not an amount is refused first: with no approval, and with the same key in flight', async () => {
  // no approval: the earlier check would have said BUDGET_CAP
  const config = stubConfig();
  const job = newJob({ id: ID, mode: 'stub', now: T0, input });
  setState(job, 'skinning', T0);
  writeJob(config.jobsDir, job);
  const e = await createPaidCall({ jobsDir: config.jobsDir, jobId: ID, stage: 'skinning', attempt: 1 })({ ...SPEC, estimate_usd: -1 }, neverSend).catch((x) => x);
  assert.equal(e.code, 'STAGE_FAILED');
  // and a sane estimate with no approval is still BUDGET_CAP
  const e0 = await createPaidCall({ jobsDir: config.jobsDir, jobId: ID, stage: 'skinning', attempt: 1 })(SPEC, neverSend).catch((x) => x);
  assert.equal(e0.code, 'BUDGET_CAP');
  // the same key is in flight: the second call, with a bad estimate, fails by itself; the first is not touched
  const jobsDir = approvedJob();
  const pc = createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 1 });
  let sent = 0;
  const first = pc(SPEC, async () => {
    sent += 1;
    return later(40, { answer: 'first', usd: 0.6 });
  });
  const second = await pc({ ...SPEC, estimate_usd: Number.NaN }, neverSend).catch((x) => x);
  assert.equal(second.code, 'STAGE_FAILED');
  assert.match(second.message, /estimate_usd is not an amount \(NaN\)/);
  assert.equal(await first, 'first');
  assert.equal(sent, 1);
  assert.deepEqual(readLedger(jobsDir, ID).rows.map((r) => r.status), ['settled']);
});

test('O-3: an answer that JSON cannot hold: the stage gets it, the call is settled, nothing is cached, and the row says so', async () => {
  const circular = { name: 'loop' };
  circular.self = circular;
  for (const [name, answer] of [['a BigInt', { n: 5n }], ['a circular value', circular], ['a function', () => 1]]) {
    const jobsDir = approvedJob();
    const logs = [];
    const pc = createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 1, now: () => 'T', log: (m) => logs.push(m) });
    const got = await pc(SPEC, async () => ({ answer, usd: 0.6 }));
    assert.equal(got, answer, `${name}: the stage gets the answer itself`);
    let l = readLedger(jobsDir, ID);
    assert.deepEqual(l.rows.map((r) => [r.status, r.settled_usd, r.answer_sha256, r.answer_not_kept]), [['settled', 0.6, null, true]], name);
    assert.deepEqual(validate(LEDGER_SCHEMA, l), [], name);
    assert.equal(fs.existsSync(cacheFile(jobsDir, ID, KEY)), false, `${name}: nothing is cached`);
    assert.equal(readJob(jobsDir, ID).cost.spent_usd, 0.6, `${name}: it was paid`);
    assert.match(logs.join('\n'), /the answer of seq 1 cannot be written as JSON; the call is settled and its answer is not kept/);
    // the stage runs again: there is no answer to give it, so the call is made again, and the row says why
    assert.equal(await pc(SPEC, async () => ({ answer: 'again', usd: 0.6 })), 'again');
    l = readLedger(jobsDir, ID);
    assert.deepEqual(l.rows.map((r) => [r.seq, r.status, r.resend_of ?? null]), [[1, 'settled', null], [2, 'settled', 1]], name);
    assert.equal(readJob(jobsDir, ID).cost.spent_usd, 1.2);
  }
  // an answer JSON can hold, null included, is kept as before
  const jobsDir = approvedJob();
  assert.equal(await createPaidCall({ jobsDir, jobId: ID, stage: 'skinning', attempt: 1 })(SPEC, async () => ({ usd: 0.6 })), null);
  assert.equal(readCache(jobsDir, ID, KEY).hit, true);
  assert.equal(readLedger(jobsDir, ID).rows[0].answer_not_kept, undefined);
});
