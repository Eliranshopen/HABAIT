// The closing test of milestone 1.2, part 3 (contract 1.2 §8): the PAID path of a reading, walked without paying.
// The real reading tool is started through the engine's own command with `--budget` and `--go`, on a temp engine
// home that has no keys file; the keys it sees are two planted values, and `fetch` is replaced in its process by
// a recorder that answers HTTP 500 (record-fetch.mjs). So nothing leaves the machine and nothing can be billed.
// It proves the one line the engine changed in the tool (pipeline/PORT-CHANGES.md): with an OpenRouter key the
// call carries that key in its header. Run with `npm run test:stages`; not part of `npm test`.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadConfig } from '../../engine/config.mjs';
import { toolPath } from '../../engine/trace.mjs';

const HOME = fileURLToPath(new URL('../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
const PDF = `${HOME}/tests/fixtures/apt846/source.pdf`;
const LIMIT_MS = 1700 * 1000;

const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const works = [];
after(() => {
  for (const w of works) fs.rmSync(w, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
});

// Every file under a folder: relative path → sha256.
function tree(dir, base = dir, out = {}) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) tree(p, base, out);
    else out[p.slice(base.length + 1)] = sha(p);
  }
  return out;
}

// A temp engine home that uses the real Python, pipeline and Node libraries, and has NO keys file: the keys a paid
// run sees there are the ones the test plants in the environment.
function homeWithoutKeys() {
  const REAL = loadConfig({ env: {} });
  const BASE = JSON.parse(fs.readFileSync(`${HOME}/engine.config.json`, 'utf8'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'm12-home-')).replace(/\\/g, '/');
  works.push(home);
  fs.writeFileSync(`${home}/engine.config.json`, JSON.stringify({ ...BASE, python: REAL.python, pipelineRoot: REAL.pipelineRoot,
    appDepsDir: REAL.appDepsDir, legalDir: REAL.legalDir, requirements: REAL.requirements, envRoot: '.' }));
  return home;
}

test('3. the paid path, walked without paying: the vision call is booked before it is sent, carries the key in its header on either route, and a refused call costs nothing', { timeout: LIMIT_MS }, () => {
  const real = loadConfig({ env: {} });
  assert.ok(fs.existsSync(real.python), `the engine's Python is missing: ${real.python} (node engine/cli.mjs setup-env --go)`);
  assert.ok(fs.existsSync(toolPath(real)), `the reading tool is missing: ${toolPath(real)}`);
  const OR = 'sk-or-PLANTED-openrouter-key-0123456789';
  const FAL = 'PLANTED-fal-key-0123456789:secret';
  const preload = pathToFileURL(`${HOME}/tests/stages/record-fetch.mjs`).href;
  const routes = [
    { name: 'with an OpenRouter key: straight to OpenRouter, the key as a Bearer header (the one line the engine changed in the tool)',
      keys: { OPENROUTER_API_KEY: OR, FAL_KEY: FAL }, url: 'https://openrouter.ai/api/v1/chat/completions', authorization: 'bearer-planted' },
    { name: 'with the fal key alone: through fal\'s router, with fal\'s own header (the route of the measured runs)',
      keys: { FAL_KEY: FAL }, url: 'https://fal.run/openrouter/router/vision', authorization: 'key-planted' },
  ];
  for (const route of routes) {
    const home = homeWithoutKeys();
    const out = `${home}/run`;
    const record = `${home}/requests.jsonl`;
    const env = { ...process.env, ENGINE_HOME: home, NODE_OPTIONS: `--import ${preload}`, RECORD_FETCH_FILE: record,
      RECORD_EXPECT_BEARER: OR, RECORD_EXPECT_KEY: FAL, HABAIT_FAL_BASE: '' };
    for (const k of Object.keys(env)) if (/^(fal_key|openrouter_api_key)$/i.test(k)) delete env[k];
    Object.assign(env, route.keys);
    const r = spawnSync(process.execPath, ['engine/cli.mjs', 'trace', PDF, '--out', out, '--id', 'apt846', '--budget', '0.05', '--go', '--json'],
      { cwd: HOME, encoding: 'utf8', timeout: LIMIT_MS / 2 - 20000, windowsHide: true, maxBuffer: 16 << 20, env });
    assert.equal(r.error, undefined, `${route.name}: the command did not end in time`);
    // the recorded answer is HTTP 500, so the tool stops at its first vision call: a failed step, exit 1
    assert.equal(r.status, 1, `${route.name}: exit ${r.status}\n${r.stderr}\n${r.stdout.slice(-600)}`);
    const a = JSON.parse(r.stdout);
    assert.deepEqual([a.outcome, a.paid, a.exit, a.result], ['STEP_FAILED', true, 1, null], route.name);
    // exactly one request left the tool, to the route's address, with the key where that route wants it
    const requests = fs.readFileSync(record, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    assert.equal(requests.length, 1, route.name);
    assert.deepEqual([requests[0].url, requests[0].method, requests[0].authorization], [route.url, 'POST', route.authorization], route.name);
    assert.ok(requests[0].header_names.includes('content-type') && requests[0].body_bytes > 1000, 'the drawing is in the request');
    // the ledger: the call was booked before it was sent (a reserved row exists although the call was refused), and a refused call costs nothing
    const ledger = JSON.parse(fs.readFileSync(`${out}/ledger.json`, 'utf8'));
    assert.equal(ledger.rows.length, 1);
    const row = ledger.rows[0];
    assert.deepEqual([row.op, row.apartment, row.reserved_usd, row.settled_usd, row.status], ['auto-trace-read', 'apt846', 0.02, 0, 'http 500'], route.name);
    // no key value anywhere: not in the command's output, not in a file of the run, not in the record itself
    const texts = [r.stdout, r.stderr, fs.readFileSync(record, 'utf8'), ...Object.keys(tree(out)).filter((f) => /\.(json|log|md|txt)$/.test(f)).map((f) => fs.readFileSync(`${out}/${f}`, 'utf8'))];
    for (const t of texts) assert.equal(t.includes(OR) || t.includes(FAL), false, `${route.name}: a key value was written`);
  }
});
