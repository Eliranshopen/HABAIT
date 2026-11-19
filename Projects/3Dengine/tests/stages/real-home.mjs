// TEST ONLY. A temp engine home whose jobs are REAL (contract 1.3 §1), with the real MCP server on it: the real
// Python, pipeline and Node libraries of the engine home this file lives in, an inbox of its own, readings kept in
// its store by the engine's own function (an import: contract 1.4 §1), one self-correction round, and no keys file. The closing tests of the stages that
// run through a job share it.
import fs from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { tempDir, writeFile } from '../helpers/fakes.mjs';
import { stopPids, stopServers, removeHome, processesOf } from '../helpers/cleanup.mjs';
import { validate, formatErrors } from '../../mcp/schema-check.mjs';
import { loadConfig } from '../../engine/config.mjs';
import { toolPath, killTree } from '../../engine/trace.mjs';
import { keepReading } from '../../engine/readings.mjs';
import { pidAlive } from '../../engine/lib/proc.mjs';

export const ENGINE = fileURLToPath(new URL('../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
export const FIXTURES = `${ENGINE}/tests/fixtures`;
export const GOLDEN = `${FIXTURES}/apt846/source.pdf`;
export const GOLDEN_SHA = '0c74ab308917dd177aa9d307a2c7877ef0c9a1801849b85ad1b1b3eb542c0f0a';
const SERVER = `${ENGINE}/mcp/server.mjs`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
}

// The strings a reading holds that came from the drawing: room and fixture names.
export function textsOf(reading) {
  const out = new Set();
  const walk = (v, key) => {
    if (typeof v === 'string') {
      if (/name|label/.test(key) && v.trim().length >= 3) out.add(v.trim());
    } else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
    else if (v && typeof v === 'object' && key !== '_meta') for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk(reading, '');
  return [...out];
}

// Make a home that an earlier invocation left quiet: stop what still names it (a runner in the middle of a reading
// has the tool and Python under it), then remove its jobs. The store, and whatever else the caller keeps there, stay.
export async function quietHome(home) {
  const jobsDir = `${home}/jobs-temp`;
  const pids = [...processesOf(home)];
  for (const id of fs.existsSync(jobsDir) ? fs.readdirSync(jobsDir) : []) {
    try {
      const pid = Number(fs.readFileSync(`${jobsDir}/${id}/runner.pid`, 'utf8').trim());
      if (Number.isInteger(pid) && pid > 0) pids.push(pid);
    } catch { /* no runner holds this job */ }
  }
  const live = [...new Set(pids)].filter((p) => p !== process.pid && pidAlive(p));
  for (const p of live) killTree(p);
  await stopPids(live);
  fs.rmSync(jobsDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
  fs.rmSync(`${home}/.runtime/serve.json`, { force: true });
}

// → the home and what a test needs to drive it. `readings` = { <sha256 of a PDF>: <file of a reading to keep for it> }.
// `home` names a folder to use (made when it is not there; a test that goes on from an earlier invocation hands
// its own); without it a new temp folder is made.
// (2.1) Since the build and the render are real stages, a real job no longer stops at the build. These tests are
// about the reading: their home tells the render to render a point no plan has, so the job ends at the start of
// `rendering`, before any tool or lock of the render (contract 2.1 §4), with the build done for real on the way.
export const NO_RENDER = Object.freeze({ render: Object.freeze({ points: Object.freeze(['cp-none']) }) });

export async function startRealHome({ prefix, home: named = null, readings = {}, settings = {}, env: extraEnv = {} }) {
  const REAL = loadConfig({ env: {} });
  const BASE = JSON.parse(fs.readFileSync(`${ENGINE}/engine.config.json`, 'utf8'));
  assert.ok(fs.existsSync(REAL.python), `the engine's Python is missing: ${REAL.python} (node engine/cli.mjs setup-env --go)`);
  assert.ok(fs.existsSync(toolPath(REAL)), `the reading tool is missing: ${toolPath(REAL)}`);

  const home = (named || tempDir(prefix)).replace(/\\/g, '/');
  fs.mkdirSync(home, { recursive: true });
  const inbox = `${home}/uploads`;
  const jobsDir = `${home}/jobs-temp`;
  const readingsDir = `${home}/.runtime/readings`;
  fs.mkdirSync(inbox, { recursive: true });
  writeFile(`${home}/site/tour/index.html`, '<!doctype html><title>stub tour</title><p>stage test stub tour</p>\n');
  writeFile(`${home}/engine.config.json`, JSON.stringify({ ...BASE, python: REAL.python, pipelineRoot: REAL.pipelineRoot, appDepsDir: REAL.appDepsDir,
    legalDir: REAL.legalDir, requirements: REAL.requirements, envRoot: '.', inbox: [inbox], stub: { ...BASE.stub, siteRoot: `${home}/site` },
    runner: { ...BASE.runner, heartbeatSeconds: 0.5 }, inspect: { ...BASE.inspect, timeoutSeconds: 120 },
    mode: 'real', trace: { ...BASE.trace, rounds: 1 }, ...settings }));
  // The home's kept readings: each is put in the store as an import, by today's reader (the real reading tool).
  const config = loadConfig({ env: { ENGINE_HOME: home } });
  assert.equal(config.readingsDir, readingsDir);
  for (const [sha, file] of Object.entries(readings)) assert.equal(keepReading(config, { pdfSha256: sha, readingFile: file, source: 'imported', costUsd: 0 }).kept, true);
  const port = await freePort();
  assert.notEqual(port, 8891);
  // `extraEnv` is for a test's own preload (a recording or scripted fetch): it reaches the server, its runners and
  // the tools they start.
  const env = { ...process.env, ...extraEnv, ENGINE_HOME: home, ENGINE_JOBS_DIR: jobsDir, ENGINE_SERVE_PORT: String(port) };
  for (const k of Object.keys(env)) if (/^(fal_key|openrouter_api_key)$/i.test(k)) delete env[k];   // no key reaches this home

  const proc = spawn(process.execPath, [SERVER], { env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  const lines = [];
  const waiting = new Map();
  let nextId = 1;
  let buf = '';
  proc.stdout.setEncoding('utf8');
  proc.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      lines.push(line);
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      const cb = waiting.get(msg.id);
      if (cb) {
        waiting.delete(msg.id);
        cb(msg);
      }
    }
  });
  proc.stderr.resume();
  const request = (method, params, timeoutMs = 140000) => {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`no answer to ${method} in ${timeoutMs} ms`)), timeoutMs);
      waiting.set(id, (msg) => {
        clearTimeout(t);
        resolve(msg);
      });
      proc.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) })}\n`);
    });
  };
  await request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'stage-test', version: '0' } });
  proc.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
  const tools = (await request('tools/list')).result.tools;

  // A tool call that must succeed: its structured answer, checked against the tool's output schema.
  const ok = async (name, args = {}) => {
    const msg = await request('tools/call', { name, arguments: args });
    assert.ok(msg.result, JSON.stringify(msg));
    assert.notEqual(msg.result.isError, true, msg.result.content?.[0]?.text);
    const errors = validate(tools.find((t) => t.name === name).outputSchema, msg.result.structuredContent);
    assert.deepEqual(errors, [], `${name} output: ${formatErrors(errors)}`);
    return msg.result.structuredContent;
  };
  // A tool call that must be refused with this reason code.
  const fails = async (name, args, code) => {
    const msg = await request('tools/call', { name, arguments: args });
    assert.equal(msg.result?.isError, true, JSON.stringify(msg));
    assert.equal(msg.result.structuredContent.error.code, code, msg.result.content?.[0]?.text);
    return msg.result.structuredContent.error;
  };
  // Follow a job until it is in one of `states`; → the job and every state that was seen on the way.
  const follow = async (id, states, timeoutMs) => {
    const seen = [];
    const end = Date.now() + timeoutMs;
    for (;;) {
      const job = (await ok('get_job', { job_id: id })).job;
      if (seen.at(-1) !== job.state) seen.push(job.state);
      if (states.includes(job.state)) return { job, seen };
      if (Date.now() > end) throw new Error(`timed out waiting for job ${id} in ${states.join('/')}; it was seen in ${seen.join(' → ')}`);
      await sleep(400);
    }
  };
  const jobDir = (id) => `${jobsDir}/${id}`;
  const readJson = (file) => {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return null;
    }
  };
  // The pid each job's runner.pid names (a plain number in the file), whether that process is alive or not.
  const runnerPids = () => {
    const out = [];
    for (const id of fs.existsSync(jobsDir) ? fs.readdirSync(jobsDir) : []) {
      try {
        const pid = Number(fs.readFileSync(`${jobsDir}/${id}/runner.pid`, 'utf8').trim());
        if (Number.isInteger(pid) && pid > 0) out.push(pid);
      } catch { /* no runner holds this job */ }
    }
    return out;
  };
  // Wait until no runner of this home is alive (a runner gives its pid file back as its last act).
  const runnersGone = async (timeoutMs = 20000) => {
    const end = Date.now() + timeoutMs;
    while (runnerPids().some((p) => pidAlive(p))) {
      if (Date.now() > end) throw new Error('a runner of this home is still alive');
      await sleep(100);
    }
  };
  // `keepHome`: leave the folder (its store, its files) for a later invocation; every process is still stopped.
  const stop = async ({ keepHome = false } = {}) => {
    if (proc.exitCode === null) {
      proc.stdin.end();
      await Promise.race([new Promise((r) => proc.once('exit', r)), new Promise((r) => setTimeout(r, 5000).unref())]);
      if (proc.exitCode === null) proc.kill();
    }
    // A runner that is still alive here is one whose test did not reach its end. It may be in the middle of a
    // reading: the runner AND everything it started (the reading tool, the tool's Python) are stopped.
    const pids = runnerPids().filter((p) => pidAlive(p));
    for (const p of pids) killTree(p);
    await stopPids(pids);
    if (keepHome) await stopServers(home, port);
    else await removeHome(home, port);
  };
  return { home, config, inbox, jobsDir, readingsDir, port, lines, ok, fails, follow, jobDir, readJson, runnersGone, stop };
}
