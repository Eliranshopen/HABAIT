// Atomic file writes and a small file mutex. A job's three files (job.json, manifest.json, ledger.json)
// are written through writeFileAtomic: temp file in the same folder, then rename over the target, retried
// on Windows, where any reader holding the file open (the bridge, a poller, a virus scanner) makes the
// rename fail until it lets go. The retry is bounded by time (retryMs, backoff 5 → 50 ms), not by count.
import fs from 'node:fs';
import path from 'node:path';
import { sleepSync, pidAlive } from './proc.mjs';

// UNKNOWN is what Node reports for a Windows error it has no name for; the one seen here (2026-11-17) is
// "the file has a user-mapped section open": another process (a scanner, a `git status`) has the file
// mapped at that instant. It passes like the others.
export const RETRY = new Set(['EPERM', 'EBUSY', 'EACCES', 'UNKNOWN']);
export const RENAME_RETRY_MS = 3000;

// A file error another process causes for a moment (Windows: a reader holds the file; a lock is busy).
export const isTransient = (e) => Boolean(e) && (RETRY.has(e.code) || / lock busy$/.test(String(e.message)));

export function writeFileAtomic(file, data, { retryMs = RENAME_RETRY_MS, clock = () => Date.now() } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`;
  fs.writeFileSync(tmp, data);
  const until = clock() + retryMs;
  for (let wait = 5; ; wait = Math.min(50, wait * 2)) {
    try {
      fs.renameSync(tmp, file);
      return;
    } catch (e) {
      if (!RETRY.has(e.code) || clock() >= until) {
        fs.rmSync(tmp, { force: true });
        throw e;
      }
      sleepSync(wait);
    }
  }
}

export function writeJsonAtomic(file, data, opts) {
  writeFileAtomic(file, JSON.stringify(data, null, 2) + '\n', opts);
  return data;
}

// ---------------------------------------------------------------- the file mutex
// THE LOCK IS A FOLDER THAT HOLDS ONE ENTRY, NAMED AFTER ITS HOLDER (contract 1.4 §11; it replaces the lock FILE
// of milestone 0.3). EVERY HOLD BEGINS WITH THE SAME ONE STEP, the only one the file system makes exclusive: a
// folder prepared beside the path, with the holder's entry inside, is renamed ONTO the path, and that fails when
// a folder is there. Everything else only ever takes an entry OUT of the folder, by its own name:
//
//   free        the path is not there (or is an empty folder for a moment, while a release ends).
//   take        the prepared folder is renamed to the path: two takers, one winner.
//   release     the holder's own entry is moved OUT of the folder; then the empty folder is removed. A holder
//               whose hold was broken finds its entry gone and touches nothing.
//   a stale hold (its holder is dead, or silent for longer than staleMs) is BROKEN, never handed over: its entry
//               is moved out of the folder and the empty folder is removed. The lock is then free, and whoever
//               wants it TAKES it, by the one exclusive step.
//
// An entry's name is never used twice and nothing is ever renamed INTO the folder, so the name of an entry can
// only ever mean the hold that was looked at: moving it out can break that hold and no other.
//
// WHY NOT «rename the stale entry to my own» (the first form of this lock, 5c9b049f): a rename is exclusive on
// the name it CREATES, not on its source. Windows renames through a handle of the source, so several processes
// that rename ONE source at the same moment are ALL told it worked (measured here: 8 of 8, in 30 rounds of 30).
// Four takers of one killed holder all «took over» and ran together: the second review of milestone 1.4.
//
// The lock of 0.3 was a file that a taker moved aside, looked at, and put back when it was not the one judged
// stale. A holder that released and exited at once (a command) made the next process judge «its holder is dead»
// from text it had read a moment before; it then moved aside the lock of a third, live process, and for that
// moment the path was free: two holders. Found by the review of milestone 1.4 with eight short-lived processes
// (two holders in a third of the runs).
//
// An entry is `h.<pid>.<taken at, ms>.<nonce>`: the pid says whether the holder lives, the time how long it holds.
export const EMPTY_LOCK_STALE_MS = 1000;
const HOLDER_RE = /^h\.(\d{1,10})\.(\d{10,16})\.([0-9a-f]{6,16})$/;
const nonce = () => Math.random().toString(16).slice(2, 14).padEnd(6, '0');

// Is a lock whose holder's text is `text` and whose age is `ageMs` stale? (contract 0.3 §10.4)
//   - it names the pid of a dead process (a killed holder);
//   - it names no pid for more than emptyStaleMs (a lock FILE of the older engine, empty or damaged);
//   - it is older than staleMs, whatever it names.
export function lockIsStale(text, ageMs, { staleMs = 10000, emptyStaleMs = EMPTY_LOCK_STALE_MS, alive = pidAlive, self = process.pid } = {}) {
  const holder = Number(String(text).trim());
  const empty = String(text).trim() === '' || !Number.isInteger(holder) || holder <= 0;
  if (empty) return ageMs > emptyStaleMs;
  if (holder !== self && !alive(holder)) return true;
  return ageMs > staleMs;
}

// What is at the lock's path right now.
//   { kind: 'free' }                         nothing there
//   { kind: 'held', entry, pid, takenAt }    a folder with one holder's entry
//   { kind: 'empty' }                        an empty folder: a release that is ending (or a folder nobody holds)
//   { kind: 'foreign', mtimeMs }             a folder that holds something else
//   { kind: 'file', text, mtimeMs }          a lock FILE of the engine before 1.4
export function lockState(lock) {
  let st;
  try {
    st = fs.statSync(lock);
  } catch (e) {
    return e.code === 'ENOENT' || e.code === 'ENOTDIR' ? { kind: 'free' } : { kind: 'foreign', mtimeMs: Date.now() };
  }
  if (!st.isDirectory()) {
    let text = '';
    try {
      text = fs.readFileSync(lock, 'utf8');
    } catch { /* unreadable: treated as empty */ }
    return { kind: 'file', text, mtimeMs: st.mtimeMs };
  }
  let names;
  try {
    names = fs.readdirSync(lock);
  } catch {
    return { kind: 'free' };       // removed between the two looks
  }
  if (names.length === 0) return { kind: 'empty' };
  const holders = names.map((n) => HOLDER_RE.exec(n)).filter(Boolean);
  if (holders.length !== 1 || names.length !== 1) return { kind: 'foreign', mtimeMs: st.mtimeMs };
  return { kind: 'held', entry: holders[0][0], pid: Number(holders[0][1]), takenAt: Number(holders[0][2]) };
}

// Take the lock when the path is free: the folder comes into being WITH its holder inside, in one rename.
// False = somebody else was first. An error of making the prepared folder is the caller's to hear: the place
// cannot be written to.
function takeFree(lock, mine) {
  const tmp = `${lock}.${process.pid}.${nonce()}.new.tmp`;
  try {
    fs.mkdirSync(tmp);
    fs.writeFileSync(`${tmp}/${mine}`, '');
  } catch (e) {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw e;
  }
  try {
    fs.renameSync(tmp, lock);          // fails when a folder is there: somebody else was first
    return true;
  } catch {
    fs.rmSync(tmp, { recursive: true, force: true });
    return false;
  }
}

// Move one entry OUT of the lock's folder (to a name of this process's own beside it) and remove it. → 'done', or
// 'gone' when the entry is not there (the hold it named is over). Several processes that move the same entry out
// at the same moment may ALL be told 'done' (a rename is not exclusive on its source): that is why nothing rests
// on who moved it, only on the entry being out. A passing file error is tried again for retryMs; after that it is
// 'gone' when the entry is no longer there, 'stuck' for the breaker of a stale hold (it simply looks again), and
// thrown for a release (the holder could not give its lock back).
function moveOut(lock, entry, { retryMs, mustWork }) {
  const from = `${lock}/${entry}`;
  const out = `${lock}.${process.pid}.${nonce()}.gone.tmp`;
  const until = Date.now() + retryMs;
  for (;;) {
    try {
      fs.renameSync(from, out);
      try {
        fs.rmSync(out, { force: true });
      } catch { /* another process moved it on, or holds it for a moment: it is out of the folder, which is what counts */ }
      return 'done';
    } catch (e) {
      if (e.code === 'ENOENT') return 'gone';
      if (!RETRY.has(e.code) || Date.now() >= until) {
        if (!fs.existsSync(from)) return 'gone';
        if (mustWork) throw e;
        return 'stuck';
      }
      sleepSync(5);
    }
  }
}

// Remove the lock's folder when it is empty. Only an EMPTY folder can be removed: never one a holder is in.
function removeEmpty(lock, tries) {
  for (let i = 0; i < tries; i++) {
    try {
      fs.rmdirSync(lock);
      return;
    } catch (e) {
      if (!RETRY.has(e.code)) return;                        // gone already, or somebody holds it again
      sleepSync(5);
    }
  }
}

// Give the lock back: the holder's own entry leaves the folder, then the empty folder goes.
function release(lock, mine) {
  // Broken meanwhile (this holder was silent for longer than staleMs): its entry is gone, and nothing of the lock
  // that stands there now is touched.
  if (moveOut(lock, mine, { retryMs: 1000, mustWork: true }) === 'gone') return false;
  removeEmpty(lock, 40);
  return true;
}

// Break a stale hold: its entry leaves the folder and the empty folder goes. The lock is then FREE; nobody holds
// it by this. When that hold ended a moment before, its entry is not there and nothing is moved.
// → false when the entry could not be moved just now (a passing file error): the caller waits before it looks again.
function breakHold(lock, entry) {
  const out = moveOut(lock, entry, { retryMs: 0, mustWork: false });
  removeEmpty(lock, 1);
  return out !== 'stuck';
}

// Run fn() holding the lock at `lock`. Throws `<label>: lock busy` after waitMs. The hold of a holder that is
// dead, or that holds for longer than staleMs, is broken, and the lock is then taken like any free lock.
export function withFileLock(lock, fn, { waitMs = 2000, staleMs = 10000, emptyStaleMs = EMPTY_LOCK_STALE_MS, label = lock, alive = pidAlive } = {}) {
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  const until = Date.now() + waitMs;
  let mine = null;
  while (mine === null) {
    const me = `h.${process.pid}.${Date.now()}.${nonce()}`;
    const s = lockState(lock);
    let broke = false;
    if (s.kind === 'free') {
      if (takeFree(lock, me)) mine = me;
    } else if (s.kind === 'held') {
      // A stale hold is BROKEN (its own entry out, the empty folder gone), never handed over: the lock is free
      // after it, and this process takes it by the one exclusive step like anybody else, at its next look.
      // The age is the distance from now in EITHER direction: an entry that says it was taken further than staleMs
      // in the future (a clock that was set back, or a name written by hand) would otherwise never grow old.
      if (lockIsStale(String(s.pid), Math.abs(Date.now() - s.takenAt), { staleMs, emptyStaleMs, alive })) {
        broke = breakHold(lock, s.entry);
      }
    } else if (s.kind === 'empty') {
      try {
        fs.rmdirSync(lock);            // a release that did not finish; a folder with a holder in it cannot be removed
      } catch { /* gone, or taken */ }
    } else if (s.kind === 'file' && lockIsStale(s.text, Date.now() - s.mtimeMs, { staleMs, emptyStaleMs, alive })) {
      // A lock FILE of the engine before 1.4, stale by its old rules: removed (a lock folder cannot be unlinked).
      try {
        fs.unlinkSync(lock);
      } catch { /* gone, or it is a lock folder now */ }
    }
    // 'foreign' (a folder that holds something the lock does not know) is never emptied by the engine: busy.
    if (mine === null) {
      if (Date.now() > until) throw new Error(`${label}: lock busy`);
      if (!broke) sleepSync(s.kind === 'empty' || s.kind === 'free' ? 1 : 5);
    }
  }
  try {
    return fn();
  } finally {
    release(lock, mine);
  }
}
