// What a test leaves behind and must take away: the detached static server of its temp home, then the home.
// The record <home>/.runtime/serve.json is NOT enough to find the server. When two processes start one at the
// same moment (a runner reaching `done` and a get_result, on a loaded machine), the second cannot bind the
// port and exits, and ITS pid is what was written last. QA round 8 of milestone 0.3 saw the result: one gate
// run in ten ended with a live static server and a temp home that Windows refused to remove.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pidAlive } from '../../engine/lib/proc.mjs';
import { isListening } from '../../engine/serve.mjs';

const nap = (ms) => new Promise((r) => setTimeout(r, ms));
const isPid = (p) => Number.isInteger(p) && p > 0 && p !== process.pid;

// Kill these pids (the live ones only, never this process) and wait until they are gone.
// Returns the ones that are still alive after waitMs.
export async function stopPids(pids, { waitMs = 6000, alive = pidAlive, kill = (p) => process.kill(p) } = {}) {
  const live = [...new Set(pids)].filter((p) => isPid(p) && alive(p));
  for (const p of live) {
    try {
      kill(p);
    } catch { /* gone */ }
  }
  const until = Date.now() + waitMs;
  while (live.some((p) => alive(p)) && Date.now() < until) await nap(40);
  return live.filter((p) => alive(p));
}

// The node processes whose command line names this temp home (the folder name of a temp home is unique).
// Windows only; elsewhere, and whenever the question cannot be asked, the answer is an empty list.
export function processesOf(home, { run = spawnSync, platform = process.platform } = {}) {
  const name = path.basename(String(home));
  if (platform !== 'win32' || !/^[\w.-]{8,}$/.test(name)) return [];
  const script = `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*${name}*' } | ForEach-Object { $_.ProcessId }`;
  const r = run('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
    { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  if (!r || r.status !== 0 || typeof r.stdout !== 'string') return [];
  return r.stdout.split(/\r?\n/).map((s) => Number(s.trim())).filter(isPid);
}

// Stop the static server(s) of a temp home. Call it when nothing that could start one is alive any more.
// First whatever the record names. Then, when the port is still answered, the processes that name this home
// in their command line: never "whoever holds the port", which by now could be a stranger.
// Returns the pids it stopped.
export async function stopServers(home, port, { host = '127.0.0.1', rounds = 4, alive = pidAlive, kill, waitMs,
  listening = isListening, find = processesOf, readFile = (f) => fs.readFileSync(f, 'utf8') } = {}) {
  const stopped = [];
  for (let round = 0; round < rounds; round++) {
    let pids = [];
    try {
      const rec = JSON.parse(readFile(`${home}/.runtime/serve.json`));
      if (isPid(rec.pid) && alive(rec.pid)) pids = [rec.pid];
    } catch { /* no server was started, or the file is being written */ }
    if (!pids.length && port && await listening(host, port, 300)) pids = find(home).filter((p) => alive(p));
    if (!pids.length) break;
    await stopPids(pids, { alive, kill, waitMs });
    stopped.push(...pids);
  }
  return [...new Set(stopped)];
}

// How fs.rmSync is asked to remove a temp home. It waits retryDelay x 1, 2, 3 ... between its tries
// (measured on Node 24.22: 60 tries of 150 ms kept the thread for a whole minute and would keep it for 4.5),
// so one pass is 8 tries = up to 5.4 s: longer than the readiness check that engine_status leaves in a child.
export const RM = Object.freeze({ recursive: true, force: true, maxRetries: 8, retryDelay: 150 });

// Remove a temp home. Windows refuses while a process of the home is alive (its current folder, an open
// file), so: the static servers first, then the removal; when the removal is refused, whoever still names
// the home is stopped and it is tried again. Throws the last refusal after `passes` passes.
export async function removeHome(home, port, { passes = 3, rm = (h) => fs.rmSync(h, RM), find = processesOf, alive = pidAlive, kill, waitMs,
  ...rest } = {}) {
  await stopServers(home, port, { alive, kill, waitMs, find, ...rest });
  let last = null;
  for (let pass = 0; pass < passes; pass++) {
    try {
      rm(home);
      return;
    } catch (e) {
      last = e;
      await stopPids(find(home), { alive, kill, waitMs });
    }
  }
  throw last;
}
