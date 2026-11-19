// One heavy stage at a time (contract 0.3 §5 and §10.5, root §12). The lock file (runner.heavyLock, default
// .runtime/heavy.lock) holds { pid, job_id, at, refreshed_at }. Its holder refreshes it at every heartbeat.
// The lock is stale, and is taken over, when its pid is dead OR it was not refreshed for staleMs (a hung
// holder, or a recycled pid that only looks alive). Taking, refreshing, checking and releasing happen under
// a short guard lock (<lock>.guard), so two runners can never both take over the same stale lock.
// A holder that was only SILENT (alive, no refresh for staleMs) can so lose the lock while it works: it
// finds out at its next refresh or check (holdsHeavy) and must stop its heavy stage (contract 0.3 §10.13).
import fs from 'node:fs';
import { withFileLock, writeJsonAtomic } from './lib/atomic.mjs';
import { pidAlive } from './lib/proc.mjs';

export function readHeavy(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function heavyIsStale(holder, { alive = pidAlive, clock = () => Date.now(), staleMs = Infinity } = {}) {
  if (!holder || !Number.isInteger(holder.pid)) return true;
  if (!alive(holder.pid)) return true;
  const t = Date.parse(holder.refreshed_at || holder.at);
  return Number.isFinite(t) && clock() - t > staleMs;
}

// Take the lock for (pid, jobId). Returns { ok: true, took_over } or { ok: false, holder }.
export function acquireHeavy(file, {
  pid = process.pid, jobId, alive = pidAlive, now = () => new Date().toISOString(), clock = () => Date.now(), staleMs = Infinity,
} = {}) {
  return withFileLock(`${file}.guard`, () => {
    const holder = readHeavy(file);
    if (holder && holder.pid !== pid && !heavyIsStale(holder, { alive, clock, staleMs })) return { ok: false, holder };
    const t = now();
    writeJsonAtomic(file, { pid, job_id: jobId, at: holder && holder.pid === pid ? holder.at : t, refreshed_at: t });
    return { ok: true, took_over: holder && holder.pid !== pid ? holder : null };
  });
}

// Does this pid hold the lock? true or false; null when the file could not be read for a moment (Windows:
// another process holds it), which is not a loss. No file, or a file that names another pid or does not
// parse, is false: anyone may take such a lock.
export function holdsHeavy(file, { pid = process.pid, readFile = (p) => fs.readFileSync(p, 'utf8') } = {}) {
  let text;
  try {
    text = readFile(file);
  } catch (e) {
    return e.code === 'ENOENT' ? false : null;
  }
  try {
    return JSON.parse(text).pid === pid;
  } catch {
    return false;
  }
}

// The holder says it is still there. False when this pid no longer holds the lock (it was taken over);
// null when the lock could not be read just now (nothing is written, the next heartbeat tries again).
export function refreshHeavy(file, { pid = process.pid, now = () => new Date().toISOString(), readFile } = {}) {
  return withFileLock(`${file}.guard`, () => {
    const mine = holdsHeavy(file, readFile ? { pid, readFile } : { pid });
    if (!mine) return mine;
    writeJsonAtomic(file, { ...readHeavy(file), refreshed_at: now() });
    return true;
  });
}

// Release the lock if (and only if) this pid holds it.
export function releaseHeavy(file, { pid = process.pid } = {}) {
  return withFileLock(`${file}.guard`, () => {
    const holder = readHeavy(file);
    if (!holder || holder.pid !== pid) return false;
    fs.rmSync(file, { force: true });
    return true;
  });
}
