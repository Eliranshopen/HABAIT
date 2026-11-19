// Milestone 0.2 — a stub engine connected to the agent: the ENGINE half of the closing test.
// Drives the REAL server process (`node mcp/server.mjs`) over stdio against a temp engine home
// (ENGINE_HOME, ENGINE_JOBS_DIR, ENGINE_SERVE_PORT, ENGINE_STUB_STEP_MS): a temp jobs folder, a free
// port and a tiny temp site. Every process it causes (server, runners, static server) is stopped in `after`.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tempDir, writeFile } from '../helpers/fakes.mjs';
import { validate, formatErrors } from '../../mcp/schema-check.mjs';
import { loadConfig, ENGINE_VERSION } from '../../engine/config.mjs';
import { stopPids, removeHome } from '../helpers/cleanup.mjs';

const SERVER = fileURLToPath(new URL('../../mcp/server.mjs', import.meta.url));
const FIXTURES = fileURLToPath(new URL('../fixtures', import.meta.url)).replace(/\\/g, '/');
const BASE = JSON.parse(fs.readFileSync(new URL('../../engine.config.json', import.meta.url), 'utf8'));
const NAMES = ['engine_status', 'inspect_plan', 'start_simulation', 'get_job', 'approve_paid_stage', 'get_result', 'cancel_job', 'list_jobs'];
const SITE_HTML = '<!doctype html><title>stub tour</title><p>m0.2 stub tour</p>\n';
// The temp home runs the REAL first look (contract 1.1): it is pointed at the real engine home's Python and pipeline.
const REAL = loadConfig({ env: {} });
// A first look at a PDF starts Python once: about 2 s on a quiet machine. On a machine that another session had
// saturated (every core, most of the memory) it took more than 30 s, so this temp home gives the scanner 120 s and
// the test asserts no wall-clock bound on a first look beyond that limit. Every other call, and a repeated look,
// stays under 2 s.
const FIRST_LOOK = new Set(['inspect_plan', 'start_simulation']);
const FIRST_LOOK_S = 120;
const FIRST_LOOK_MS = FIRST_LOOK_S * 1000;

let home; let jobsDir; let inbox; let port; let proc; let tools;
const stdoutLines = [];
const waiting = new Map();
let nextId = 1;

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

function sendRaw(line) {
  proc.stdin.write(line + '\n');
}

function request(method, params, { timeoutMs = 5000 } = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`no answer to ${method} in ${timeoutMs} ms`)), timeoutMs);
    waiting.set(id, (msg) => {
      clearTimeout(t);
      resolve(msg);
    });
    sendRaw(JSON.stringify({ jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) }));
  });
}

// The next response whose id is null (parse errors).
function nextNullId(timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('no id:null answer')), timeoutMs);
    waiting.set(null, (msg) => {
      clearTimeout(t);
      resolve(msg);
    });
  });
}

const timings = [];
async function call(name, args = {}) {
  const t0 = performance.now();
  const msg = await request('tools/call', { name, arguments: args }, FIRST_LOOK.has(name) ? { timeoutMs: FIRST_LOOK_MS + 5000 } : undefined);
  const ms = performance.now() - t0;
  timings.push({ name, ms });
  assert.ok(ms < (FIRST_LOOK.has(name) ? FIRST_LOOK_MS : 2000), `${name} took ${ms.toFixed(0)} ms`);
  return msg;
}

async function ok(name, args) {
  const msg = await call(name, args);
  assert.ok(msg.result, JSON.stringify(msg));
  assert.notEqual(msg.result.isError, true, msg.result.content?.[0]?.text);
  const sc = msg.result.structuredContent;
  assert.deepEqual(JSON.parse(msg.result.content[0].text), sc);
  const schema = tools.find((t) => t.name === name).outputSchema;
  const errors = validate(schema, sc);
  assert.deepEqual(errors, [], `${name} output: ${formatErrors(errors)}`);
  return sc;
}

async function fails(name, args, code) {
  const msg = await call(name, args);
  assert.equal(msg.result?.isError, true, JSON.stringify(msg));
  assert.equal(msg.result.structuredContent.error.code, code);
  assert.match(msg.result.content[0].text, new RegExp(`^${code}: `));
  return msg.result.structuredContent.error;
}

async function pollUntil(jobId, states, timeoutMs = 15000) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const { job } = await ok('get_job', { job_id: jobId });
    if (states.includes(job.state)) return job;
    if (Date.now() > until) throw new Error(`job ${jobId} stayed in ${job.state}`);
    await new Promise((r) => setTimeout(r, 40));
  }
}

before(async () => {
  home = tempDir('m02-home-');
  inbox = `${home}/uploads`;
  jobsDir = `${home}/jobs-temp`;
  writeFile(`${home}/site/tour/index.html`, SITE_HTML);
  fs.mkdirSync(inbox, { recursive: true });
  writeFile(`${home}/engine.config.json`, JSON.stringify({ ...BASE, python: REAL.python, pipelineRoot: REAL.pipelineRoot, inbox: [inbox, FIXTURES],
    stub: { ...BASE.stub, siteRoot: `${home}/site` }, inspect: { ...BASE.inspect, timeoutSeconds: FIRST_LOOK_S } }));
  port = await freePort();
  assert.notEqual(port, 8891);
  proc = spawn(process.execPath, [SERVER], {
    env: { ...process.env, ENGINE_HOME: home, ENGINE_JOBS_DIR: jobsDir, ENGINE_SERVE_PORT: String(port), ENGINE_STUB_STEP_MS: '30' },
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let buf = '';
  proc.stdout.setEncoding('utf8');
  proc.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      stdoutLines.push(line);
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
});

after(async () => {
  if (proc && proc.exitCode === null) {
    proc.stdin.end();
    await Promise.race([new Promise((r) => proc.once('exit', r)), new Promise((r) => setTimeout(r, 5000).unref())]);
    if (proc.exitCode === null) proc.kill();
  }
  // Every process of this temp home must be GONE before the folder is removed, or Windows refuses the removal
  // (QA round 8 of milestone 0.3: 1 gate run of 10 failed here with EPERM, and a static server was left alive).
  // 1. Runners still alive (none should be): a runner on its way out can still start the static server.
  const runners = [];
  if (fs.existsSync(jobsDir)) {
    for (const d of fs.readdirSync(jobsDir)) {
      const f = `${jobsDir}/${d}/runner.pid`;
      if (fs.existsSync(f)) runners.push(Number(fs.readFileSync(f, 'utf8')));
    }
  }
  await stopPids(runners);
  // 2. The static server, also when its record names a server that lost the start; then the folder.
  await removeHome(home, port);
});

test('initialize handshake, ping, tools/list = the eight tools with both schemas', async () => {
  const init = await request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'm02', version: '0' } });
  assert.deepEqual(init.result, {
    protocolVersion: '2025-06-18', capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'habait-engine', version: ENGINE_VERSION },
  });
  sendRaw(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }));
  assert.deepEqual((await request('ping')).result, {});
  const list = await request('tools/list');
  tools = list.result.tools;
  assert.deepEqual(tools.map((t) => t.name).sort(), [...NAMES].sort());
  for (const t of tools) {
    assert.equal(t.inputSchema.type, 'object', t.name);
    assert.equal(t.outputSchema.type, 'object', t.name);
    assert.ok(t.title && t.description, t.name);
    assert.equal(t.annotations.openWorldHint, false);
    for (const k of ['readOnlyHint', 'idempotentHint', 'destructiveHint']) assert.equal(typeof t.annotations[k], 'boolean');
  }
});

test('engine_status answers in time with a stub-site check', async () => {
  const s = await ok('engine_status');
  assert.equal(s.mode, 'stub');
  const site = s.checks.find((c) => c.id === 'stub-site');
  assert.equal(site.ok, true, site.detail);
});

let jobId;
test('one full job: inspect → start → awaiting_approval → BUDGET_CAP → approve → done → result → the link answers 200', async () => {
  const pdf = `${FIXTURES}/sample.pdf`;
  const plan = await ok('inspect_plan', { pdf_path: pdf });
  // Since milestone 1.1 the first look is real: the fixture is one page with a small vector drawing.
  assert.equal(plan.mode, 'real');
  assert.deepEqual([plan.pages, plan.kind], [1, 'sheet']);
  assert.deepEqual(plan.candidates, [{ id: 'p1', label: 'עמוד 1', page: 1, source: 'page', vector_paths: 300, large_images: 0 }]);
  assert.equal(plan.bytes, fs.statSync(pdf).size);
  // A second look at the same PDF comes from the cache: the same answer, in well under 2 s.
  const t0 = performance.now();
  assert.deepEqual(await ok('inspect_plan', { pdf_path: pdf }), plan);
  assert.ok(performance.now() - t0 < 2000, 'a repeated look is answered from the cache');

  const start = await ok('start_simulation', { pdf_path: pdf });
  assert.equal(start.created, true);
  assert.equal(start.job.state, 'queued');
  assert.equal(start.job.mode, 'stub');
  jobId = start.job_id;
  assert.ok(fs.existsSync(`${jobsDir}/${jobId}/input/source.pdf`));

  const waitingJob = await pollUntil(jobId, ['awaiting_approval']);
  assert.equal(waitingJob.percent, 55);
  assert.deepEqual(waitingJob.quote, { estimate_usd: 48, range_usd: [40, 60], rooms: 11, basis: 'measured on apartment 846' });

  await fails('get_result', { job_id: jobId }, 'NOT_DONE');
  await fails('approve_paid_stage', { job_id: jobId, cap_usd: 10 }, 'BUDGET_CAP');
  const approved = await ok('approve_paid_stage', { job_id: jobId, cap_usd: 60 });
  assert.equal(approved.job.approval.cap_usd, 60);
  assert.equal(approved.job.cost.cap_usd, 60);

  const done = await pollUntil(jobId, ['done', 'failed', 'cancelled', 'review']);
  assert.equal(done.state, 'done');
  assert.equal(done.percent, 100);
  const result = await ok('get_result', { job_id: jobId });
  assert.equal(result.mode, 'stub');
  assert.equal(result.rooms, 11);
  assert.deepEqual(result.deviations, []);
  assert.deepEqual(result.cost, { spent_usd: 0, cap_usd: 60 });
  assert.equal(result.local_url, `http://127.0.0.1:${port}/tour/?scope=apartment&room=terraceLiving&floor=parquet&video=0`);
  const res = await fetch(result.local_url);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.equal(await res.text(), SITE_HTML);

  await fails('approve_paid_stage', { job_id: jobId, cap_usd: 60 }, 'NOT_AWAITING_APPROVAL');
  // The runner ended by itself and released its pid file.
  for (let i = 0; i < 50 && fs.existsSync(`${jobsDir}/${jobId}/runner.pid`); i++) await new Promise((r) => setTimeout(r, 40));
  assert.equal(fs.existsSync(`${jobsDir}/${jobId}/runner.pid`), false);
});

test('the same PDF again → created: false and the same job', async () => {
  const again = await ok('start_simulation', { pdf_path: `${FIXTURES}/sample.pdf` });
  assert.equal(again.created, false);
  assert.equal(again.job_id, jobId);
  assert.equal(again.job.state, 'done');
  const { jobs } = await ok('list_jobs', {});
  assert.deepEqual(jobs.map((j) => j.job_id), [jobId]);
});

test('cancel_job on a fresh job: cancelled, the runner stops', async () => {
  const pdf = `${inbox}/other.pdf`;
  writeFile(pdf, `${fs.readFileSync(`${FIXTURES}/sample.pdf`, 'latin1')}% another plan\n`);
  const start = await ok('start_simulation', { pdf_path: pdf, budget_cap_usd: 50 });
  assert.equal(start.created, true);
  assert.equal(start.job.cost.cap_usd, 50);
  const c = await ok('cancel_job', { job_id: start.job_id });
  assert.equal(c.job.state, 'cancelled');
  const again = await ok('cancel_job', { job_id: start.job_id });
  assert.equal(again.job.state, 'cancelled');
  await fails('get_result', { job_id: start.job_id }, 'NOT_DONE');
  const pidFile = `${jobsDir}/${start.job_id}/runner.pid`;
  for (let i = 0; i < 100 && fs.existsSync(pidFile); i++) await new Promise((r) => setTimeout(r, 40));
  assert.equal(fs.existsSync(pidFile), false, 'the runner exited');
  assert.equal((await ok('get_job', { job_id: start.job_id })).job.state, 'cancelled');
  const { jobs } = await ok('list_jobs', { limit: 1 });
  assert.equal(jobs.length, 1);
});

test('every stub reason code', async () => {
  await fails('inspect_plan', { pdf_path: `${home}/engine.config.json` }, 'PATH_NOT_ALLOWED');
  await fails('inspect_plan', { pdf_path: `${inbox}/../engine.config.json` }, 'PATH_NOT_ALLOWED');
  await fails('start_simulation', { pdf_path: 'C:/Windows/win.ini' }, 'PATH_NOT_ALLOWED');
  await fails('inspect_plan', { pdf_path: `${FIXTURES}/not-a-pdf.txt` }, 'NOT_A_PDF');
  await fails('inspect_plan', { pdf_path: `${inbox}/missing.pdf` }, 'NOT_A_PDF');
  const big = `${inbox}/big.pdf`;
  const buf = Buffer.alloc(20 * 1024 * 1024 + 1, 0x20);
  buf.write('%PDF-1.4\n', 0, 'latin1');
  fs.writeFileSync(big, buf);
  await fails('inspect_plan', { pdf_path: big }, 'FILE_TOO_LARGE');
  await fails('start_simulation', { pdf_path: big }, 'FILE_TOO_LARGE');
  await fails('start_simulation', { pdf_path: `${FIXTURES}/sample.pdf`, apartment: 'apt999' }, 'NO_PLAN_FOUND');
  for (const name of ['get_job', 'get_result', 'cancel_job']) await fails(name, { job_id: '0000000000000000' }, 'JOB_NOT_FOUND');
  await fails('approve_paid_stage', { job_id: '0000000000000000', cap_usd: 60 }, 'JOB_NOT_FOUND');
  // NOT_AWAITING_APPROVAL, NOT_DONE and BUDGET_CAP were reached in the full-job and cancel tests.
});

test('protocol errors: -32601, -32602, -32700', async () => {
  assert.equal((await request('resources/list')).error.code, -32601);
  assert.equal((await request('tools/call', { name: 'no_such_tool', arguments: {} })).error.code, -32602);
  assert.equal((await request('tools/call', { name: 'get_job', arguments: {} })).error.code, -32602);
  assert.equal((await request('tools/call', { name: 'get_job', arguments: { job_id: '../../etc' } })).error.code, -32602);
  assert.equal((await request('tools/call', { name: 'approve_paid_stage', arguments: { job_id: jobId, cap_usd: '60' } })).error.code, -32602);
  const p = nextNullId();
  sendRaw('{"jsonrpc": "2.0", "id": 9, "method": ');
  const err = await p;
  assert.equal(err.error.code, -32700);
  assert.equal(err.id, null);
});

test('stdout held JSON-RPC lines only; every tools/call answered in time (under 2 s; a first look at a PDF inside the time limit of the scanner)', async () => {
  assert.ok(stdoutLines.length > 20);
  for (const line of stdoutLines) {
    const msg = JSON.parse(line);
    assert.equal(msg.jsonrpc, '2.0');
    assert.ok('result' in msg || 'error' in msg, line);
  }
  assert.ok(timings.length > 20);
  const worst = Math.max(...timings.filter((t) => !FIRST_LOOK.has(t.name)).map((t) => t.ms));
  assert.ok(worst < 2000, `slowest tools/call ${worst.toFixed(0)} ms`);
  // The two tools that may start the scanner: inside its time limit when they do, and under 2 s once the look is kept.
  for (const name of FIRST_LOOK) {
    const ms = timings.filter((t) => t.name === name).map((t) => t.ms);
    assert.ok(ms.length >= 2, name);
    assert.ok(Math.max(...ms) < FIRST_LOOK_MS, `slowest ${name} ${Math.max(...ms).toFixed(0)} ms`);
    assert.ok(Math.min(...ms) < 2000, `fastest ${name} ${Math.min(...ms).toFixed(0)} ms`);
  }
});
