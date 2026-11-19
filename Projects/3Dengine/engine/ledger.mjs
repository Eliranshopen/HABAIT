// jobs/<job_id>/ledger.json (contract 0.3 §3, §10 and §12): every paid call, RESERVED before it is sent
// and SETTLED after, the same manners as the pipeline's own ledger (pipeline/Habait/tour360/tools/file-ledger.mjs).
// The answer of a call is kept in jobs/<job_id>/cache/<call_key>.json together with what it cost and the
// row it belongs to, so a stage that runs again gets it from the cache and is never billed twice. Written
// atomically.
import fs from 'node:fs';
import { jobDir, readJob, writeJob, updateJob, withJobLock } from './jobs.mjs';
import { EngineError } from './inbox.mjs';
import { writeFileAtomic, writeJsonAtomic, isTransient } from './lib/atomic.mjs';
import { sha256Text } from './lib/hash.mjs';

export const LEDGER_SCHEMA_ID = 'habait/ledger.v1';

export const ledgerFile = (jobsDir, id) => `${jobDir(jobsDir, id)}/ledger.json`;
export const cacheFile = (jobsDir, id, key) => `${jobDir(jobsDir, id)}/cache/${key}.json`;

// Money is summed in micro-dollars, so 0.6 + 0.6 + 0.6 is 1.8 and not 1.7999999999999998.
export const usd = (n) => Math.round(Number(n) * 1e6) / 1e6;

// An amount of money in this ledger is a number from 0 to MAX_USD (contract 0.3 §15.1). Nothing else is:
// not null, not a missing field, not text, not NaN, not a negative number, not 1e308.
export const MAX_USD = 1000000;
export const isAmount = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_USD;

// A ledger file that is there and is not the ledger of this job (contract 0.3 §15.3, §16.2).
export class LedgerUnreadable extends Error {
  constructor(id, why) {
    super(`ledger.json of job ${id} cannot be read: ${why}`);
    this.code = 'LEDGER_UNREADABLE';
  }
}

const ROW_STATUSES = new Set(['reserved', 'settled', 'failed', 'orphaned']);

// Is this document the ledger of job `id`? Throws LedgerUnreadable when it is not: the schema id, this job's
// id, a cap that is null or a number of zero or more, and rows in which row number n has seq n, a call key
// and a stage that are text, one of the four states, a reserved amount, and a settled amount (null only
// on a row that is not settled). Returns the document.
export function checkLedger(doc, id) {
  const bad = (why) => {
    throw new LedgerUnreadable(id, why);
  };
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) bad('it is not a ledger document');
  if (doc.schema !== LEDGER_SCHEMA_ID) bad(`its schema is ${JSON.stringify(doc.schema)}, not "${LEDGER_SCHEMA_ID}"`);
  if (doc.job_id !== id) bad(`it names job ${JSON.stringify(doc.job_id)}`);
  if (!(doc.cap_usd === null || (typeof doc.cap_usd === 'number' && Number.isFinite(doc.cap_usd) && doc.cap_usd >= 0))) bad('its cap_usd is not null or a number of zero or more');
  if (!Array.isArray(doc.rows)) bad('it has no list of rows');
  doc.rows.forEach((r, i) => {
    const n = i + 1;
    if (!r || typeof r !== 'object' || Array.isArray(r)) bad(`row ${n} is not a row`);
    if (r.seq !== n) bad(`row ${n} has seq ${JSON.stringify(r.seq)}`);
    if (typeof r.call_key !== 'string' || !r.call_key) bad(`row ${n} has no call_key`);
    if (typeof r.stage !== 'string' || !r.stage) bad(`row ${n} has no stage`);
    if (!ROW_STATUSES.has(r.status)) bad(`row ${n} has the status ${JSON.stringify(r.status)}`);
    if (!isAmount(r.reserved_usd)) bad(`row ${n}: reserved_usd is not an amount`);
    if (!(isAmount(r.settled_usd) || (r.settled_usd === null && r.status !== 'settled'))) bad(`row ${n}: settled_usd is not an amount`);
  });
  return doc;
}

// The ledger of a job: an empty one when there is no file; LedgerUnreadable when the file is not JSON or is
// not the ledger of this job.
export function readLedger(jobsDir, id, capUsd = null) {
  let text;
  try {
    text = fs.readFileSync(ledgerFile(jobsDir, id), 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return { schema: LEDGER_SCHEMA_ID, job_id: id, cap_usd: capUsd, rows: [] };
    throw e;
  }
  let doc;
  try {
    doc = JSON.parse(text);
  } catch (e) {
    throw new LedgerUnreadable(id, `it is not JSON (${e.message})`);
  }
  return checkLedger(doc, id);
}

// Written under the id the document names, and only a document that is a ledger of that job: nothing is ever
// written into another job's file, or into a folder named after a missing id.
export function writeLedger(jobsDir, doc) {
  checkLedger(doc, doc?.job_id);
  if (typeof doc.job_id !== 'string' || !/^[0-9a-f]{16}$/.test(doc.job_id)) throw new LedgerUnreadable(String(doc.job_id), 'it has no job id');
  return writeJsonAtomic(ledgerFile(jobsDir, doc.job_id), doc);
}

// call_key = sha256 of the stage name + the caller's stable description of the input.
export const callKey = (stage, key) => sha256Text(`${stage}\n${key}`);

// settled: what was really billed. held: the reserved amount of every row whose outcome is unknown
// (reserved or orphaned). cap_total: what counts toward the cap.
export function ledgerTotals(doc) {
  let settled = 0;
  let held = 0;
  for (const r of doc.rows) {
    if (r.status === 'settled') settled += Number(r.settled_usd) || 0;
    else if (r.status === 'reserved' || r.status === 'orphaned') held += Number(r.reserved_usd) || 0;
  }
  return { settled_usd: usd(settled), held_usd: usd(held), cap_total_usd: usd(settled + held),
    orphaned: doc.rows.filter((r) => r.status === 'orphaned') };
}

// What one stage settled during one attempt (the manifest row's cost_usd).
export function settledBy(doc, stage, attempt) {
  return usd(doc.rows.filter((r) => r.stage === stage && r.attempt === attempt && r.status === 'settled')
    .reduce((n, r) => n + (Number(r.settled_usd) || 0), 0));
}

// The cache file of a call: { answer, settled_usd, seq } (contract 0.3 §10.1, §12.1), written atomically
// BEFORE the row is settled. `seq` names the ledger row the answer belongs to (null in a file written before
// rows were named). Returns { hit, answer, settled_usd, seq, text } or { hit: false }. With `sha`, the text
// must have that sha256.
export function readCache(jobsDir, id, key, sha = null) {
  try {
    const text = fs.readFileSync(cacheFile(jobsDir, id, key), 'utf8');
    if (sha && sha256Text(text) !== sha) return { hit: false };
    const c = JSON.parse(text);
    if (!c || typeof c !== 'object' || !('answer' in c)) return { hit: false };
    // What it cost must be there and be an amount; a file without one is not the record of a paid call.
    if (!isAmount(c.settled_usd)) return { hit: false };
    return { hit: true, answer: c.answer, settled_usd: usd(c.settled_usd), seq: Number.isInteger(c.seq) ? c.seq : null, text };
  } catch {
    return { hit: false };
  }
}

// job.cost.spent_usd is DERIVED (contract 0.3 §10.2): the ledger's settled total, written when it differs.
// The ledger is read INSIDE the job lock (every ledger write happens under it too), so the value written is
// never older than the ledger: two runners that sync at the same moment cannot leave a stale total behind.
// `waitMs` = how long to wait for the job lock (a read of a job passes a short one: it must not be held up).
export function syncSpent(jobsDir, id, { read = readLedger, waitMs } = {}) {
  let spent = null;
  updateJob(jobsDir, id, (j) => {
    spent = ledgerTotals(read(jobsDir, id)).settled_usd;
    if (j.cost.spent_usd === spent) return null;
    j.cost.spent_usd = spent;
    return j;
  }, waitMs === undefined ? undefined : { waitMs });
  return spent ?? ledgerTotals(read(jobsDir, id)).settled_usd;   // no such job: nothing was written
}

// The cap was reached: the error carries what the job needs in all (counted toward the cap + this call).
export class CapReached extends EngineError {
  constructor(message, needUsd) {
    super('BUDGET_CAP', message);
    this.needUsd = needUsd;
  }
}

const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));

// How long an answer that is in hand is kept while the job lock cannot be taken (contract 0.3 §13.3). A lock
// held by a live process is taken over after 10 seconds, so 30 is enough for anything but a broken disk.
export const HOLD_ANSWER_MS = 30000;
export const HOLD_RETRY_MS = 250;

// paidCall(spec, fn) for one stage attempt of one job. `fn()` sends the call and resolves to
// { answer, usd } (usd = what was billed; the estimate when absent). The test hooks pauseAfterReserveMs /
// pauseAfterCacheMs / pauseAfterSettleMs only add a sleep on this same path, and only when above zero.
//
// The life of a row: reserved → (sending_at set, just before the send) → settled | failed | orphaned.
// Every read-change-write of the ledger happens under the job lock. `guard()` is called inside that lock
// twice: before anything is decided or reserved, and again just before the call is sent. The runner passes
// a check that it still owns the job (a runner that takes a job over claims runner.pid under the same
// lock), so a runner that was replaced can never reserve a call, nor send one it had reserved. It may still
// SETTLE a call it had already sent: that is what really happened. `beforeSend()` (reserved, not yet marked
// as sending) and `afterSend()` (the answer is in hand, nothing is recorded yet) are seams for the tests.
export function createPaidCall({
  jobsDir, jobId, stage, attempt, now = () => new Date().toISOString(), sleep = realSleep,
  pauseAfterReserveMs = 0, pauseAfterCacheMs = 0, pauseAfterSettleMs = 0, log = () => {}, guard = () => {},
  beforeSend = () => {}, afterSend = () => {}, clock = () => Date.now(), holdMs = HOLD_ANSWER_MS, lock = withJobLock,
}) {
  const locked = (fn) => lock(jobsDir, jobId, fn);
  const short = (key) => key.slice(0, 12);

  // Called INSIDE a locked step that changed the ledger: job.cost.spent_usd, the copy of the ledger's settled
  // total, follows in the same step (the job lock is held, so the job file is written directly). A runner that
  // dies right after a settle then leaves a true total behind, also on a job that is already done, where no
  // runner would come to put it right (contract 0.3 §14.1).
  const copySpent = (doc) => {
    const j = readJob(jobsDir, jobId);
    if (!j) return;
    const spent = ledgerTotals(doc).settled_usd;
    if (j.cost.spent_usd === spent) return;
    j.cost.spent_usd = spent;
    writeJob(jobsDir, j, jobId);
  };

  // An answer in hand must not be lost to a busy file: the call would then be made, and paid, again. A step
  // that records the answer is tried again while the error is a passing one (the job lock is busy, a file
  // is held for a moment), for up to holdMs.
  const keep = async (what, step) => {
    const until = clock() + holdMs;
    for (;;) {
      try {
        return step();
      } catch (e) {
        if (!isTransient(e) || clock() >= until) throw e;
        log(`${stage}: ${what} waits (${e.message}); the answer stays in hand`);
        await sleep(HOLD_RETRY_MS);
      }
    }
  };

  // Just before the send, in one locked section. Is this still the job's runner, and is the reservation
  // still open? If not, the call is NOT sent and the row is closed as failed with nothing billed
  // (`not_sent`). If so, the row is marked `sending_at`: from here on its outcome can be unknown; a reserved
  // row WITHOUT that mark was provably never sent (contract 0.3 §12.2).
  const confirm = (seq, cap) => locked(() => {
    const doc = readLedger(jobsDir, jobId, cap);
    const mine = doc.rows.find((r) => r.seq === seq);
    let why = null;
    try {
      guard();
    } catch (e) {
      why = e;
    }
    if (!why && mine.status !== 'reserved') why = new EngineError('STAGE_FAILED', `the reservation seq ${seq} was closed by another runner (${mine.status})`);
    if (why) {
      Object.assign(mine, { status: 'failed', settled_usd: 0, settled_at: now(), not_sent: true });
      writeLedger(jobsDir, doc);
      log(`${stage}: seq ${seq} was reserved but never sent (${why.message})`);
      throw why;
    }
    mine.sending_at = now();
    writeLedger(jobsDir, doc);
  });

  // Keep the answer of a call that came back, with what it cost and its row, in the cache: under the lock,
  // and never over another runner's answer. An answer whose row was presumed lost meanwhile (orphaned) is a
  // LATE one; when the cache already holds an answer for this call, that one stays (its row points at it,
  // and a stage that runs again must find it, or the call would be sent once more).
  const cacheAnswer = (seq, cap, key, text) => locked(() => {
    const mine = readLedger(jobsDir, jobId, cap).rows.find((r) => r.seq === seq);
    if (mine.status === 'orphaned' && readCache(jobsDir, jobId, key).hit) {
      log(`${stage}: the late answer of seq ${seq} is recorded in the ledger only; the cached answer is kept`);
      return false;
    }
    writeFileAtomic(cacheFile(jobsDir, jobId, key), text);
    return true;
  });

  // Change this call's own row (found by seq), under the lock.
  const closeRow = (seq, cap, patch) => locked(() => {
    const doc = readLedger(jobsDir, jobId, cap);
    const mine = doc.rows.find((r) => r.seq === seq);
    // Another runner presumed this reservation lost and marked it orphaned; the call came back all the same.
    const late = mine.status === 'orphaned' ? { late: true } : {};
    Object.assign(mine, patch, late);
    writeLedger(jobsDir, doc);
    copySpent(doc);
  });

  // Decide from the ledger and, when the call must be sent, reserve it: one section under the lock.
  // Returns { answer } (nothing to send) or { seq } (reserved); throws CapReached.
  const decide = (spec, key, estimate, cap) => locked(() => {
    guard();
    const doc = readLedger(jobsDir, jobId, cap);
    doc.cap_usd = cap;
    const rows = doc.rows.filter((r) => r.call_key === key);
    const t = now();
    let changed = false;

    // 2. Is the answer of this call in the cache, and whose is it? The cache names its row (`seq`). A file
    // written before rows were named belongs to the settled row whose answer_sha256 matches it, else to
    // the newest reserved row.
    const cached = readCache(jobsDir, jobId, key);
    let owner = null;
    if (cached.hit) {
      const sha = sha256Text(cached.text);
      owner = cached.seq !== null
        ? rows.find((r) => r.seq === cached.seq) || null
        : rows.find((r) => r.status === 'settled' && r.answer_sha256 === sha) || rows.filter((r) => r.status === 'reserved' && r.sending_at).at(-1) || null;
      // Not to be trusted: a row that failed has no answer; a settled row that recorded another hash; a row
      // whose send never started (no sending_at) cannot have an answer at all (contract 0.3 §13.2).
      if (owner && (owner.status === 'failed' || (owner.status === 'settled' && owner.answer_sha256 !== sha)
        || (owner.status !== 'settled' && !owner.sending_at))) owner = null;
      if (owner && owner.status !== 'settled') {
        // Its runner had the answer and died, or was replaced, before it settled the row: the call was
        // made and paid. Settle the row FROM the cache; nothing is sent.
        const late = owner.status === 'orphaned' ? { late: true } : {};
        Object.assign(owner, { status: 'settled', settled_usd: cached.settled_usd, settled_at: t, answer_sha256: sha, recovered: true }, late);
        changed = true;
        log(`${stage}: seq ${owner.seq} settled from the cache (recovered)`);
      }
    }

    // 3. Every OTHER reserved row of this call belongs to a runner that is dead or was replaced (this
    // runner owns the job and has not reserved yet). One that was never marked as sending was never sent:
    // closed, nothing billed. One whose send had started has an unknown outcome: orphaned, kept, and
    // counted toward the cap. This is done whether or not the answer was found (contract 0.3 §12.1).
    let dropped = 0;
    let orphaned = 0;
    for (const r of rows) {
      if (r === owner || r.status !== 'reserved') continue;
      if (r.sending_at) {
        Object.assign(r, { status: 'orphaned', orphaned_at: t });
        orphaned += 1;
      } else {
        Object.assign(r, { status: 'failed', settled_usd: 0, settled_at: t, not_sent: true });
        dropped += 1;
      }
      changed = true;
    }
    if (changed) {
      writeLedger(jobsDir, doc);
      copySpent(doc);
    }
    if (dropped || orphaned) {
      log(`${stage}: reserved row(s) of ${short(key)} left by another runner: ${orphaned} marked orphaned (the send had started), ${dropped} closed as never sent`);
    }
    if (owner) {
      log(`${stage}: paid call ${short(key)} answered from the cache (seq ${owner.seq})`);
      return { answer: cached.answer };
    }

    // 4. The cap.
    const totals = ledgerTotals(doc);
    const need = usd(totals.cap_total_usd + estimate);
    if (typeof cap === 'number' && need > cap) {
      throw new CapReached(`the call needs $${estimate}; $${totals.cap_total_usd} of the $${cap} cap is spent or held`, need);
    }
    // 5. Reserve and write. The call is sent only after `confirm`. A call that was settled before and is
    // sent again because its cached answer is gone says so (`resend_of`): the cache is the only copy of a
    // paid answer.
    const lost = rows.filter((r) => r.status === 'settled').at(-1);
    const row = { seq: doc.rows.length + 1, call_key: key, stage, provider: String(spec.provider), what: String(spec.what),
      reserved_usd: estimate, reserved_at: t, sending_at: null, status: 'reserved', settled_usd: null, settled_at: null,
      answer_sha256: null, attempt, ...(lost ? { resend_of: lost.seq } : {}) };
    if (lost) log(`${stage}: the cached answer of seq ${lost.seq} is gone; paid call ${short(key)} is made again`);
    doc.rows.push(row);
    writeLedger(jobsDir, doc);
    return { seq: row.seq };
  });

  const call = async function paidCall(spec, fn) {
    const job = readJob(jobsDir, jobId);
    if (!job) throw new EngineError('JOB_NOT_FOUND', `no job ${jobId}`);
    if (!job.approval) throw new EngineError('BUDGET_CAP', 'no approved cap');
    const estimate = usd(spec.estimate_usd ?? 0);   // an amount: checked by the wrapper below, before anything else
    const key = callKey(stage, String(spec.key));
    const cap = job.cost?.cap_usd ?? null;

    const decided = decide(spec, key, estimate, cap);
    if ('answer' in decided) return decided.answer;
    const { seq } = decided;

    beforeSend();
    confirm(seq, cap);
    if (pauseAfterReserveMs > 0) {
      log(`test hook: pausing ${pauseAfterReserveMs} ms after the reserve of seq ${seq} (marked as sending)`);
      await sleep(pauseAfterReserveMs);
    }
    let got;
    try {
      got = await fn();
    } catch (e) {
      // The send failed. Its row is closed as failed; a lock that is busy at this moment is waited for like
      // after a success, and whatever happens the caller gets the call's own error.
      try {
        await keep(`the close of seq ${seq}`, () => closeRow(seq, cap, { status: 'failed', settled_usd: 0, settled_at: now() }));
      } catch (closeErr) {
        log(`${stage}: seq ${seq} could not be closed as failed (${closeErr.message}); it stays reserved and the next attempt marks it orphaned`);
      }
      throw e;
    }
    afterSend();
    // 6. Cache the answer WITH what it cost and its row, then settle.
    const answer = got?.answer ?? null;
    // What the call says it cost; the estimate when it says nothing, or says something that is not an amount.
    let billed = estimate;
    if (got?.usd !== undefined && got?.usd !== null) {
      if (isAmount(got.usd)) billed = usd(got.usd);
      else log(`${stage}: seq ${seq} came back with a cost that is not an amount (${String(got.usd)}); the estimate $${estimate} is recorded`);
    }
    // An answer that JSON cannot hold (a BigInt, a circular value, a function) cannot be kept. The call was
    // made and paid all the same: it is settled, the stage gets its answer, and the row says the answer was
    // not kept; a stage that runs again then makes the call again (contract 0.3 §16.4).
    let text = null;
    try {
      const t = JSON.stringify({ answer, settled_usd: billed, seq });
      if ('answer' in JSON.parse(t)) text = t;
    } catch { /* not JSON */ }
    if (text === null) log(`${stage}: the answer of seq ${seq} cannot be written as JSON; the call is settled and its answer is not kept`);
    else await keep(`the cache write of seq ${seq}`, () => cacheAnswer(seq, cap, key, text));
    if (pauseAfterCacheMs > 0) {
      log(`test hook: pausing ${pauseAfterCacheMs} ms after the cache write of seq ${seq}`);
      await sleep(pauseAfterCacheMs);
    }
    const settled = text === null
      ? { status: 'settled', settled_usd: billed, settled_at: now(), answer_sha256: null, answer_not_kept: true }
      : { status: 'settled', settled_usd: billed, settled_at: now(), answer_sha256: sha256Text(text) };
    await keep(`the settle of seq ${seq}`, () => closeRow(seq, cap, settled));
    if (pauseAfterSettleMs > 0) {
      log(`test hook: pausing ${pauseAfterSettleMs} ms after the settle of seq ${seq}`);
      await sleep(pauseAfterSettleMs);
    }
    return answer;
  };
  // Two calls with the same key at the same moment, in one stage attempt, are ONE call: the second waits
  // for the first and gets its answer, or its error (contract 0.3 §13.1). One reservation, one send.
  // spent_usd is recomputed after EVERY paid call, a cache hit or a recovery included.
  const inFlight = new Map();
  return async function paidCall(spec, fn) {
    // The estimate is what gets reserved: it must be an amount (absent or null = 0). It is checked FIRST,
    // whatever else is true of the call: before the approval is looked at, and also when a call with the
    // same key is in flight (contract 0.3 §15.1 b, §16.3).
    const wanted = spec.estimate_usd ?? 0;
    if (!isAmount(wanted)) throw new EngineError('STAGE_FAILED', `paid call "${spec.what}": estimate_usd is not an amount (${String(wanted)})`);
    const key = callKey(stage, String(spec.key));
    const running = inFlight.get(key);
    if (running) {
      log(`${stage}: paid call ${short(key)} is already in flight in this stage; the second call waits for its answer`);
      return running;
    }
    const mine = (async () => {
      try {
        return await call(spec, fn);
      } finally {
        inFlight.delete(key);
        try {
          syncSpent(jobsDir, jobId);
        } catch (e) {
          log(`spent_usd not synced now: ${e.message}`);
        }
      }
    })();
    inFlight.set(key, mine);
    return mine;
  };
}

// Human lines for the CLI: the rows, the totals, the orphaned rows (never hidden).
export function formatLedger(doc) {
  const t = ledgerTotals(doc);
  const lines = [`ledger ${doc.job_id}: settled $${t.settled_usd} · held $${t.held_usd} · cap ${doc.cap_usd === null ? 'none' : `$${doc.cap_usd}`}`];
  for (const r of doc.rows) {
    lines.push(`  #${r.seq} ${r.status.padEnd(8)} ${r.stage.padEnd(9)} attempt ${r.attempt}  reserved $${r.reserved_usd}` +
      `${r.status === 'settled' ? `  settled $${r.settled_usd}` : ''}  ${r.provider}: ${r.what}  ${r.call_key.slice(0, 12)}`);
  }
  if (t.orphaned.length) lines.push(`  ORPHANED ${t.orphaned.length}: outcome unknown, $${usd(t.orphaned.reduce((n, r) => n + r.reserved_usd, 0))} counts toward the cap`);
  return lines.join('\n');
}
