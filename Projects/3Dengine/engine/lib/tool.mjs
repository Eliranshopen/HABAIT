// Starting a brought-in tool, and stopping it: what every wrapper of a pipeline tool shares (the reading since 1.2,
// the build and the render since 2.1). A tool is a process that starts processes (Python, Blender): it is always
// stopped as a whole tree, and what it prints goes to a log file, never to a caller.
import fs from 'node:fs';
import { spawn as nodeSpawn, spawnSync } from 'node:child_process';

export const KILL_WAIT_MS = 15000;      // how long a stop waits for the tree to end before it answers anyway

// Stop a process and everything it started.
export function killTree(pid, { platform = process.platform, run = spawnSync, kill = process.kill.bind(process) } = {}) {
  if (!Number.isInteger(pid) || pid <= 0) return;
  if (platform === 'win32') {
    run('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, timeout: KILL_WAIT_MS, stdio: 'ignore' });
    return;
  }
  try {
    kill(-pid, 'SIGKILL');       // the process group (the tool is started detached there)
  } catch {
    try {
      kill(pid, 'SIGKILL');
    } catch { /* it has ended already */ }
  }
}

// Start the command with its output in the log file, and wait for its end, the time limit or the signal.
// → { why: 'exit' | 'not-started' | 'timeout' | 'cancelled', code }
export function startAndWait(cmd, logFile, { timeoutMs, signal, killWaitMs = KILL_WAIT_MS }, deps = {}) {
  const d = { fs, spawn: nodeSpawn, killTree, ...deps };
  return new Promise((resolve) => {
    let fd = null;
    let child = null;
    let why = null;
    let timer = null;
    let lastWait = null;
    let done = false;
    const finish = (answer) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      clearTimeout(lastWait);
      signal?.removeEventListener?.('abort', onAbort);
      if (fd !== null) {
        try {
          d.fs.closeSync(fd);
        } catch { /* closed already */ }
      }
      resolve(answer);
    };
    const stop = (reason) => {
      if (why || done) return;
      why = reason;
      d.killTree(child.pid);
      lastWait = setTimeout(() => finish({ why, code: null }), killWaitMs);   // it did not end: answer anyway
    };
    function onAbort() {
      stop('cancelled');
    }
    try {
      fd = d.fs.openSync(logFile, 'a');
      child = d.spawn(cmd.command, cmd.args, { cwd: cmd.cwd, env: cmd.env, stdio: ['ignore', fd, fd], windowsHide: true, detached: process.platform !== 'win32' });
    } catch {
      finish({ why: 'not-started', code: null });
      return;
    }
    child.once('error', () => finish({ why: why || 'not-started', code: null }));
    child.once('exit', (code) => finish({ why: why || 'exit', code: typeof code === 'number' ? code : null }));
    timer = setTimeout(() => stop('timeout'), timeoutMs);
    if (signal?.aborted) onAbort();
    else signal?.addEventListener?.('abort', onAbort, { once: true });
  });
}

// A mark is a word every process of one job's tools carries in its command line (the tool id of the job, contract
// 2.1 §5). Only a word that cannot be part of another word by accident is searched for.
export const MARK_RE = /^j[0-9a-f]{16}$/;

// The pids of the processes whose command line carries the mark (never this process).
export function processesNaming(mark, { run = spawnSync, platform = process.platform, self = process.pid } = {}) {
  if (!MARK_RE.test(String(mark))) return [];
  let out = '';
  if (platform === 'win32') {
    const script = `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${mark}*' } | ForEach-Object { $_.ProcessId }`;
    const r = run('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
      { encoding: 'utf8', windowsHide: true, timeout: 30000 });
    if (!r || r.status !== 0 || typeof r.stdout !== 'string') return [];
    out = r.stdout;
  } else {
    const r = run('pgrep', ['-f', mark], { encoding: 'utf8', timeout: 30000 });
    if (!r || typeof r.stdout !== 'string') return [];
    out = r.stdout;
  }
  return out.split(/\r?\n/).map((s) => Number(s.trim())).filter((p) => Number.isInteger(p) && p > 0 && p !== self);
}

// Stop every process that carries the mark, each with what it started. → how many were found.
// A killed runner leaves its tool and its Blender running; nothing of a job may write its workspace beside a new run.
export function stopNaming(mark, deps = {}) {
  const d = { find: processesNaming, killTree, rounds: 3, ...deps };
  let found = 0;
  for (let round = 0; round < d.rounds; round++) {
    const pids = d.find(mark);
    if (pids.length === 0) break;
    if (round === 0) found = pids.length;
    for (const pid of pids) d.killTree(pid);
  }
  return found;
}
