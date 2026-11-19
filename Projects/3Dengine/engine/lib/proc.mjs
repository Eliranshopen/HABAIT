// Processes the engine leaves running on purpose: the stub runner and the static server.
// They are DETACHED (they outlive the MCP server) and write their output to a log file, never to
// the parent's stdout, which carries the MCP protocol.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

// True when a process with this pid exists (signal 0 only probes).
export function pidAlive(pid) {
  const n = Number(pid);
  if (!Number.isInteger(n) || n <= 0) return false;
  try {
    process.kill(n, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

// Start `node <script> ...args` detached, stdout+stderr appended to `logFile`. Returns the child's pid.
export function spawnDetached(script, args, { logFile, env = process.env, cwd } = {}) {
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const fd = fs.openSync(logFile, 'a');
  try {
    const child = spawn(process.execPath, [script, ...args], {
      detached: true,
      stdio: ['ignore', fd, fd],
      windowsHide: true,
      env,
      cwd,
    });
    child.unref();
    return child.pid;
  } finally {
    fs.closeSync(fd);
  }
}

// A blocking pause for synchronous retry loops (no busy wait).
export function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.max(0, ms));
}
