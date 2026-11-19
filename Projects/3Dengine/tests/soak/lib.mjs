// Shared helpers of the kill tests: a TEMP engine home with its own engine.config.json, the real stub engine
// handlers (real detached runner processes), and a clean-up that kills ONLY the pids this process spawned
// (recorded at spawn) plus the static server named in the temp home's own .runtime/serve.json.
import fs from 'node:fs';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { tempDir, writeFile } from '../helpers/fakes.mjs';
import { loadConfig } from '../../engine/config.mjs';
import { readJob } from '../../engine/jobs.mjs';
import { readManifest } from '../../engine/manifest.mjs';
import { readLedger } from '../../engine/ledger.mjs';
import { pidAlive } from '../../engine/lib/proc.mjs';
import { spawnRunnerDefault } from '../../engine/control.mjs';
import { createStubEngine } from '../../mcp/stub-engine.mjs';
import { stopPids, stopServers, removeHome } from '../helpers/cleanup.mjs';

export const FIXTURES = fileURLToPath(new URL('../fixtures', import.meta.url)).replace(/\\/g, '/');
export const BASE = JSON.parse(fs.readFileSync(new URL('../../engine.config.json', import.meta.url), 'utf8'));
export const SITE_HTML = '<!doctype html><title>stub tour</title><p>kill test stub tour</p>\n';
export const HOOK_VARS = ['ENGINE_TEST_PAUSE_AFTER_RESERVE_MS', 'ENGINE_TEST_PAUSE_AFTER_CACHE_MS', 'ENGINE_TEST_PAUSE_AFTER_SETTLE_MS'];
export const FREEZE_VARS = ['ENGINE_TEST_FREEZE_MS', 'ENGINE_TEST_FREEZE_AT', 'ENGINE_TEST_FREEZE_WAKE'];
export const FREEZE_MAX_MS = 60000;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// A scripted first look (contract 1.1 §8.3) for the tests that start dozens of made-up PDFs: one sheet, one
// drawing. A real look starts Python once per PDF, about 2 s each. The intake and the runner's check of the
// stored copy run for real in these tests; the real scanner runs in tests/milestones/m1.1.test.mjs.
export const scriptedLook = () => ({ pages: 1, kind: 'sheet', cached: true,
  page_rows: [{ page: 1, width_pt: 842, height_pt: 595, vector_paths: 300, images: 0, large_images: 0, content: 'vector' }],
  candidates: [{ id: 'p1', label: 'עמוד 1', page: 1, source: 'page', vector_paths: 300, large_images: 0 }] });

// A job whose FIRST runner blocks its own thread at `point` (the test hook ENGINE_TEST_FREEZE_MS / _AT / _WAKE;
// "<stage>", "<paid stage>:reserved" or "<paid stage>:sent"), so it is a LIVE process that gives no sign of
// life. It stays blocked until `wake()` is called (the hook's upper bound is FREEZE_MAX_MS), so nothing here
// depends on how fast the machine is. The env needs a small runner.staleSeconds. Returns once the engine
// itself says that runner is not alive.
export async function frozenJob(E, { name, point, firstEnv = {} }) {
  const pdf = E.pdf(name, name);
  const stage = point.split(':')[0];
  const wakeFile = `${E.home}/wake-${name}-${Date.now()}`;
  process.env.ENGINE_TEST_FREEZE_MS = String(FREEZE_MAX_MS);
  process.env.ENGINE_TEST_FREEZE_AT = point;
  process.env.ENGINE_TEST_FREEZE_WAKE = wakeFile;
  for (const [k, v] of Object.entries(firstEnv)) process.env[k] = String(v);   // more hooks for the first runner only
  let id;
  try {
    id = E.h.start_simulation({ pdf_path: pdf }).job_id;
  } finally {
    for (const k of [...FREEZE_VARS, ...Object.keys(firstEnv)]) delete process.env[k];
  }
  const pid = await E.waitFor('the first runner to hold runner.pid', () => E.runnerPid(id), 15000);
  const blocked = `runner ${pid} test hook: thread blocked for ${FREEZE_MAX_MS} ms at ${point} `;
  await E.waitFor(`the first runner to be blocked at ${point} and to look dead`, () => {
    const j = E.job(id);
    if (j.state === 'awaiting_approval' && !j.approval) {
      E.approve(id);
      return false;
    }
    return j.state === stage && pidAlive(pid) && E.log(id).includes(blocked) && E.h.get_job({ job_id: id }).job.runner.alive === false;
  }, 45000);
  return { id, pdf, stage, point, pid, wakeFile,
    wake: () => fs.writeFileSync(wakeFile, 'wake\n'),
    woke: () => E.log(id).includes(`runner ${pid} test hook: the block at ${point} is over`) };
}

// frozenJob, then the same PDF is started again: a second runner takes the job over while the first is
// still blocked. `firstEnv` / `secondEnv` = environment variables for the first / the second runner only (a
// pause hook, for example).
// Returns { ...frozenJob, oldPid, newPid }; the first runner wakes only at `wake()`.
export async function frozenThenReplaced(E, { name, point, firstEnv = {}, secondEnv = {} }) {
  const f = await frozenJob(E, { name, point, firstEnv });
  if (E.runnerPid(f.id) !== f.pid) throw new Error(`runner.pid changed before the takeover (${E.runnerPid(f.id)}, was ${f.pid})`);
  for (const [k, v] of Object.entries(secondEnv)) process.env[k] = String(v);
  let again;
  try {
    again = E.h.start_simulation({ pdf_path: f.pdf });
  } finally {
    for (const k of Object.keys(secondEnv)) delete process.env[k];
  }
  if (again.created !== false || again.resumed !== true) throw new Error(`the takeover was not a resume: ${JSON.stringify(again)}`);
  const newPid = await E.waitFor('a second runner to own runner.pid', () => {
    const p = E.runnerPid(f.id);
    return p && p !== f.pid ? p : null;
  }, 20000);
  if (f.woke() || !pidAlive(f.pid)) throw new Error('the first runner was not blocked any more when it was replaced');
  return { ...f, oldPid: f.pid, newPid };
}

// The job reaches done (approved with $60 when it asks).
export async function toDone(E, id, timeoutMs = 45000) {
  await E.waitFor(`job ${id} to be done`, () => {
    const j = E.job(id);
    if (j.state === 'failed') throw new Error(`the job failed: ${JSON.stringify(j.reason)}`);
    if (j.state === 'awaiting_approval' && !j.approval) E.approve(id);
    return j.state === 'done';
  }, timeoutMs);
}

// Wake the blocked runner; it must then leave BY ITSELF.
export async function wakeAndLeave(E, r, timeoutMs = 20000) {
  r.wake();
  await E.waitFor(`the replaced runner ${r.oldPid} to leave by itself`, () => !pidAlive(r.oldPid), timeoutMs, 25);
}

// A process that ended (a runner after done, a replaced runner): gone within the time, or an error.
export async function gone(E, pid, what, timeoutMs = 8000) {
  await E.waitFor(`${what} (pid ${pid}) to be gone`, () => !pidAlive(pid), timeoutMs, 20);
}

// "No lock left behind": a live runner takes job.lock for a few milliseconds at every heartbeat, so one look
// can find it there. A lock that was LEFT stays; this waits for a look that finds none.
export async function lockFree(E, id, timeoutMs = 3000) {
  await E.waitFor(`the job.lock of ${id} to be free`, () => !fs.existsSync(E.jobPath(id, 'job.lock')), timeoutMs, 3);
}

// The engine says the job's runner is alive. One look can catch a late heartbeat on a loaded machine when
// runner.staleSeconds is small; a runner that is really dead never shows alive again.
export async function seenAlive(E, id, timeoutMs = 6000) {
  await E.waitFor(`the runner of ${id} to be reported alive`, () => E.h.get_job({ job_id: id }).job.runner.alive === true, timeoutMs, 25);
}

export function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
}

// Read a file that a runner may be renaming over at this instant (Windows): a short retry on EPERM/EBUSY/EACCES.
export function readText(file) {
  const until = Date.now() + 1500;
  for (;;) {
    try {
      return fs.readFileSync(file, 'utf8');
    } catch (e) {
      if (['EPERM', 'EBUSY', 'EACCES'].includes(e.code) && Date.now() < until) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
        continue;
      }
      throw e;
    }
  }
}

export async function mkEnv({ prefix = 'kill-', callUsd = 0.6, stepMs = 400, heartbeat = 0.1, staleSeconds } = {}) {
  const home = tempDir(prefix);
  writeFile(`${home}/site/tour/index.html`, SITE_HTML);
  fs.mkdirSync(`${home}/inbox`, { recursive: true });
  const runner = { ...BASE.runner, heartbeatSeconds: heartbeat };
  if (staleSeconds !== undefined) runner.staleSeconds = staleSeconds;
  writeFile(`${home}/engine.config.json`, JSON.stringify({ ...BASE, inbox: [`${home}/inbox`],
    stub: { ...BASE.stub, siteRoot: `${home}/site`, callUsd }, runner }));
  const port = await freePort();
  if (port === 8891) throw new Error('refusing port 8891');
  const config = loadConfig({ env: { ENGINE_HOME: home, ENGINE_JOBS_DIR: `${home}/jobs-temp`, ENGINE_SERVE_PORT: String(port),
    ENGINE_STUB_STEP_MS: String(stepMs) } });
  if (config.jobsDir !== `${home}/jobs-temp`) throw new Error(`jobs dir escaped the temp home: ${config.jobsDir}`);
  const spawned = new Set();
  const h = createStubEngine(config, {
    doctor: { get: async () => null, kick() {}, stop() {} },
    inspect: scriptedLook,
    spawnRunner: (c, id) => {
      const pid = spawnRunnerDefault(c, id);
      spawned.add(pid);
      return pid;
    },
  }).handlers;
  const E = { home, config, h, port, spawned, killed: [] };
  E.job = (id) => readJob(config.jobsDir, id);
  E.rows = (id) => readManifest(config.jobsDir, id).rows;
  E.ledger = (id) => readLedger(config.jobsDir, id);
  E.jobPath = (id, rel) => `${config.jobsDir}/${id}/${rel}`;
  E.runnerPid = (id) => {
    try {
      return Number(fs.readFileSync(E.jobPath(id, 'runner.pid'), 'utf8').trim()) || null;
    } catch {
      return null;
    }
  };
  // Who holds the heavy lock of this temp home: { pid, job_id, at, refreshed_at } or null.
  E.heavy = () => {
    try {
      return JSON.parse(readText(config.runner.heavyLock));
    } catch {
      return null;
    }
  };
  E.log = (id) => {
    try {
      return readText(E.jobPath(id, 'runner.log'));
    } catch (e) {
      if (e.code === 'ENOENT') return '';
      throw e;
    }
  };
  // Approve with a $60 cap; false when the job lock was busy or the job is no longer waiting (try again).
  E.approve = (id) => {
    try {
      E.h.approve_paid_stage({ job_id: id, cap_usd: 60 });
      return true;
    } catch (e) {
      if (/lock busy|NOT_AWAITING/i.test(`${e.code} ${e.message}`)) return false;
      throw e;
    }
  };
  E.sends = (id, stage) => {
    try {
      return fs.readFileSync(E.jobPath(id, `stages/${stage}/sends.log`), 'utf8').split('\n').filter(Boolean).length;
    } catch {
      return 0;
    }
  };
  E.pdf = (name, extra) => {
    const p = `${home}/inbox/${name}`;
    writeFile(p, `${fs.readFileSync(`${FIXTURES}/sample.pdf`, 'latin1')}% ${extra}\n`);
    return p;
  };
  E.waitFor = async (what, fn, timeoutMs = 20000, everyMs = 15) => {
    const until = Date.now() + timeoutMs;
    for (;;) {
      const v = await fn();
      if (v) return v;
      if (Date.now() > until) {
        const states = fs.existsSync(config.jobsDir) ? fs.readdirSync(config.jobsDir).map((d) => `${d}: ${E.job(d)?.state}`).join(', ') : '';
        throw new Error(`timed out waiting for ${what} (jobs: ${states})`);
      }
      await sleep(everyMs);
    }
  };
  // A HARD kill of the live runner of a job (pid from this temp home's runner.pid); returns once it is gone.
  E.kill = async (id) => {
    const pid = E.runnerPid(id);
    if (!(pid > 0 && pidAlive(pid) && pid !== process.pid)) throw new Error(`no live runner for ${id} (pid ${pid})`);
    process.kill(pid);
    await E.waitFor(`pid ${pid} to be gone`, () => !pidAlive(pid), 5000, 10);
    E.killed.push(pid);
    return pid;
  };
  E.cleanup = async () => {
    for (const k of [...HOOK_VARS, ...FREEZE_VARS]) delete process.env[k];
    // The runners this env spawned, then its static server (found also when the record names a server that
    // lost the start: ../helpers/cleanup.mjs), then the folder.
    const left = await stopPids([...spawned], { waitMs: 3000 });
    const servers = await stopServers(home, port);
    E.leftover = [...left, ...servers.filter((p) => pidAlive(p))];
    if (process.env.M03_KEEP) process.stderr.write(`kept temp home ${home}\n`);
    else await removeHome(home, port);
  };
  return E;
}
