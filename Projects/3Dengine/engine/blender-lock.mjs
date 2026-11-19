// The machine's Blender lock (contract 2.1 §5). One Blender at a time on this machine, whoever starts it.
//
// The lock is NOT the engine's: it is the lock FILE of the brought-in tools (run-project.mjs `withLock`), at the path
// the settings name (`blenderLock`; machine-wide, shared with every other session that renders). The tools make it
// by an exclusive create, write their owner and pid into it, wait for ever when it is there, and remove it on a
// normal exit only. The engine holds that same file around every tool run that can start Blender, by the same
// protocol, so the tools of other sessions and the engine exclude each other.
//
//   - Held by anybody else: the engine WAITS. It never removes and never takes a lock that names another owner.
//   - The engine removes a lock in ONE case: it names the engine as owner and a pid that is dead. Before the file
//     goes, every process that still carries that lock's mark is stopped (a killed runner leaves its tool and its
//     Blender running).
//   - Every look-then-act of the engine on the lock happens under the engine's own guard, a folder lock beside it
//     (contract 1.4 §11), so two engine processes never act on the lock at the same moment.
//   - ⛔ The engine's folder lock is never used on the Blender lock's own path: a folder renamed onto a file
//     REPLACES the file, and that file may be another session's hold.
import fs from 'node:fs';
import { withFileLock } from './lib/atomic.mjs';
import { pidAlive } from './lib/proc.mjs';
import { stopNaming, MARK_RE } from './lib/tool.mjs';

export const OWNER = 'habait-engine';
export const GUARD_WAIT_MS = 5000;
export const guardPath = (lock) => `${lock}.engine-guard`;

// What stands at the lock's path.
//   { state: 'free' }
//   { state: 'held', own, pid, alive, mark, job }   own = it names the engine as its owner
//   { state: 'unreadable' }                         a file that is not (yet) a holder's record: treated as held
export function readLock(lock, deps = {}) {
  const d = { fs, alive: pidAlive, ...deps };
  let text;
  try {
    text = d.fs.readFileSync(lock, 'utf8');
  } catch (e) {
    return e.code === 'ENOENT' ? { state: 'free' } : { state: 'unreadable' };
  }
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    return { state: 'unreadable' };
  }
  if (!doc || typeof doc !== 'object' || !Number.isInteger(doc.pid) || doc.pid <= 0) return { state: 'unreadable' };
  const own = doc.owner === OWNER;
  return { state: 'held', own, pid: doc.pid, alive: d.alive(doc.pid), mark: own && MARK_RE.test(String(doc.mark)) ? doc.mark : null,
    job: own && typeof doc.job === 'string' ? doc.job : null };
}

// Try to take the lock for a job. → { taken: true } | { taken: false, holder: 'engine' | 'other' | 'unreadable' }
// (`engine` = another engine process that is alive). `removed` says that a dead engine lock was removed on the way,
// and how many of its leftover processes were stopped first.
export function tryTake(lock, { job, mark }, deps = {}) {
  const d = { fs, alive: pidAlive, stopNaming, withFileLock, pid: process.pid, now: () => new Date().toISOString(), ...deps };
  if (!MARK_RE.test(String(mark))) throw new Error('the Blender lock is taken with the mark of a job');
  return d.withFileLock(guardPath(lock), () => {
    let s = readLock(lock, d);
    let removed = null;
    if (s.state === 'held' && s.own && !s.alive) {
      // The engine's own, left by a runner that was killed: first whatever that run still has alive, then the file.
      removed = { stopped: s.mark ? d.stopNaming(s.mark) : 0 };
      try {
        d.fs.unlinkSync(lock);
      } catch (e) {
        if (e.code !== 'ENOENT') return { taken: false, holder: 'engine', removed };
      }
      s = { state: 'free' };
    }
    if (s.state !== 'free') return { taken: false, holder: s.state === 'unreadable' ? 'unreadable' : s.own ? 'engine' : 'other', removed };
    let fd;
    try {
      fd = d.fs.openSync(lock, 'wx');        // the tools' own step: it fails when a file is there
    } catch (e) {
      if (e.code === 'EEXIST') return { taken: false, holder: 'other', removed };       // a tool was first
      throw e;
    }
    try {
      d.fs.writeSync(fd, JSON.stringify({ owner: OWNER, job, mark, pid: d.pid, at: d.now() }));
    } finally {
      d.fs.closeSync(fd);
    }
    return { taken: true, removed };
  }, { waitMs: GUARD_WAIT_MS, label: 'the guard of the Blender lock' });
}

// Give the lock back: the file is removed only when it names this process as its holder. → true when removed.
export function release(lock, deps = {}) {
  const d = { fs, alive: pidAlive, withFileLock, pid: process.pid, ...deps };
  return d.withFileLock(guardPath(lock), () => {
    const s = readLock(lock, d);
    if (s.state !== 'held' || !s.own || s.pid !== d.pid) return false;
    try {
      d.fs.unlinkSync(lock);
      return true;
    } catch {
      return false;
    }
  }, { waitMs: GUARD_WAIT_MS, label: 'the guard of the Blender lock' });
}
