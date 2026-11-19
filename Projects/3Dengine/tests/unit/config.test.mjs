import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadConfig, pipelineEnv, ENGINE_HOME, ENGINE_VERSION } from '../../engine/config.mjs';
import { tempDir, writeFile } from '../helpers/fakes.mjs';

const BASE = JSON.parse(fs.readFileSync(new URL('../../engine.config.json', import.meta.url), 'utf8'));

function homeWith(cfg, local) {
  const h = tempDir('cfg-');
  writeFile(`${h}/engine.config.json`, JSON.stringify(cfg));
  if (local) writeFile(`${h}/engine.config.local.json`, JSON.stringify(local));
  return h;
}

test('ENGINE_HOME is the folder above engine/, absolute, forward slashes', () => {
  assert.match(ENGINE_HOME, /3Dengine$/);
  assert.ok(!ENGINE_HOME.includes('\\'));
  assert.ok(fs.existsSync(`${ENGINE_HOME}/engine.config.json`));
});

test('defaults: relative paths resolve against home, absolute kept, basePython untouched', () => {
  const h = homeWith(BASE);
  const c = loadConfig({ home: h, env: {} });
  assert.equal(c.home, h);
  assert.equal(c.pipelineRoot, `${h}/pipeline`);
  assert.equal(c.python, `${h}/.venv/Scripts/python.exe`);
  assert.equal(c.envRoot, h);
  assert.equal(c.basePython, 'python');
  assert.equal(c.blender, 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe');
  assert.equal(c.blenderVersion, '4.5.10');
  assert.equal(c.legalDir, `${h}/house/legal`);
  assert.equal(c.runtimeDir, `${h}/.runtime`);
  assert.equal(c.assets.hdriBase, `${h}/pipeline/360walkaround`);
  assert.equal(c.assets.source, 'C:/HABAIT-Archive/Habait-Backup/habait-walkaround/360walkaround');
  assert.equal(c.assets.packCache, `${h}/pipeline/360walkaround/catalog/.cache`);
  assert.equal(c.assets.packSource, BASE.assets.packSource);
  assert.deepEqual(c.keys, ['FAL_KEY', 'OPENROUTER_API_KEY']);
  assert.deepEqual(c.nodeLibs, ['sharp', 'playwright-core']);
  assert.equal(c.pythonLibs.cv2, 'opencv-python');
  for (const v of [c.pipelineRoot, c.python, c.assets.catalogModels]) assert.ok(!v.includes('\\'));
  assert.ok(Object.isFrozen(c) && Object.isFrozen(c.assets) && Object.isFrozen(c.keys));
});

test('the real engine.config.json loads with the default home', () => {
  const c = loadConfig({ env: {} });
  assert.equal(c.home, ENGINE_HOME);
});

test('local override merges shallow, assets one level deep', () => {
  const h = homeWith(BASE, { chrome: 'D:/chrome.exe', assets: { source: 'E:/bk' } });
  const c = loadConfig({ home: h, env: {} });
  assert.equal(c.chrome, 'D:/chrome.exe');
  assert.equal(c.assets.source, 'E:/bk');
  assert.equal(c.assets.catalogModels, `${h}/pipeline/360walkaround/catalog/models`);
});

test('env overrides ENGINE_PYTHON / ENGINE_BLENDER / ENGINE_CHROME win over files', () => {
  const h = homeWith(BASE, { python: 'x/py.exe' });
  const c = loadConfig({ home: h, env: { ENGINE_PYTHON: 'C:/py/python.exe', ENGINE_BLENDER: 'bl/blender.exe', ENGINE_CHROME: '' } });
  assert.equal(c.python, 'C:/py/python.exe');
  assert.equal(c.blender, `${h}/bl/blender.exe`);
  assert.equal(c.chrome, 'C:/Program Files/Google/Chrome/Application/chrome.exe');
});

test('injected readFile / exists are used', () => {
  const files = { 'C:/h/engine.config.json': JSON.stringify(BASE) };
  const c = loadConfig({ home: 'C:/h', env: {}, readFile: (p) => files[p], exists: () => false });
  assert.equal(c.jobsDir, 'C:/h/jobs');
});

test('a missing required field throws an Error naming it', () => {
  for (const field of ['pipelineRoot', 'basePython', 'blenderVersion', 'keys', 'pythonLibs']) {
    const cfg = { ...BASE };
    delete cfg[field];
    assert.throws(() => loadConfig({ home: homeWith(cfg), env: {} }), new RegExp(`"${field}"`));
  }
  const cfg = { ...BASE, assets: { ...BASE.assets } };
  delete cfg.assets.hdriBase;
  assert.throws(() => loadConfig({ home: homeWith(cfg), env: {} }), /"assets\.hdriBase"/);
});

test('wrong shapes are rejected', () => {
  assert.throws(() => loadConfig({ home: homeWith({ ...BASE, keys: 'FAL_KEY' }), env: {} }), /"keys" must be an array/);
  assert.throws(() => loadConfig({ home: homeWith({ ...BASE, pythonLibs: ['numpy'] }), env: {} }), /"pythonLibs" must be an object/);
});

test('pipelineEnv returns exactly the eleven pointers', () => {
  const h = homeWith(BASE);
  const c = loadConfig({ home: h, env: {} });
  assert.deepEqual(pipelineEnv(c), {
    HABAIT_PY: `${h}/.venv/Scripts/python.exe`,
    HABAIT_APP_DIR: `${h}/appdeps`,
    HABAIT_ENV_ROOT: h,
    HABAIT_BLENDER_LOCK: 'C:/RnD/.wt/_blender.lock',
    HABAIT_ASSETS_ROOT: `${h}/pipeline`,
    HABAIT_LEGAL_SRC: `${h}/house/legal`,
    HABAIT_LEGAL_DIR: `${h}/house/legal`,
    HABAIT_LEGAL_MD: `${h}/house/legal/disclaimer-he-en.md`,
    BLENDER: 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe',
    CHROME: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    CHROME_PATH: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });
});

test('0.2 blocks: inbox, stub, serve resolved; ENGINE_VERSION from package.json', () => {
  const h = homeWith(BASE);
  const c = loadConfig({ home: h, env: {} });
  assert.deepEqual(c.inbox, ['C:/HABAIT-Agent-UI/bridge/workspace/uploads', `${h}/inbox`, `${h}/tests/fixtures`]);
  assert.equal(c.stub.siteRoot, 'C:/RnD/.wt/deploy-P-7');
  assert.equal(c.stub.tourPath, 'tour/?scope=apartment&room=terraceLiving&floor=parquet&video=0');
  assert.equal(c.stub.stepMs, 6000);
  assert.equal(c.stub.rooms, 11);
  assert.deepEqual(c.stub.quote, { estimate_usd: 48, range_usd: [40, 60] });
  assert.deepEqual(c.serve, { host: '127.0.0.1', port: 8891 });
  assert.match(ENGINE_VERSION, /^\d+\.\d+\.\d+$/);
});

test('0.2 env overrides: ENGINE_HOME, ENGINE_JOBS_DIR, ENGINE_SERVE_PORT, ENGINE_STUB_STEP_MS', () => {
  const h = homeWith(BASE);
  const c = loadConfig({ env: { ENGINE_HOME: h, ENGINE_JOBS_DIR: 'tmpjobs', ENGINE_SERVE_PORT: '9123', ENGINE_STUB_STEP_MS: '30' } });
  assert.equal(c.home, h);
  assert.equal(c.jobsDir, `${h}/tmpjobs`);
  assert.equal(c.serve.port, 9123);
  assert.equal(c.stub.stepMs, 30);
  assert.throws(() => loadConfig({ home: h, env: { ENGINE_SERVE_PORT: 'x' } }), /ENGINE_SERVE_PORT/);
  assert.throws(() => loadConfig({ home: h, env: { ENGINE_STUB_STEP_MS: '0' } }), /ENGINE_STUB_STEP_MS/);
});

test('0.2 local override merges stub and serve one level deep', () => {
  const h = homeWith(BASE, { stub: { siteRoot: 'site' }, serve: { port: 9000 } });
  const c = loadConfig({ home: h, env: {} });
  assert.equal(c.stub.siteRoot, `${h}/site`);
  assert.equal(c.stub.rooms, 11);
  assert.deepEqual(c.serve, { host: '127.0.0.1', port: 9000 });
});

test('0.2 blocks: missing or wrong shapes are named', () => {
  for (const f of ['inbox', 'stub', 'serve']) {
    const cfg = { ...BASE };
    delete cfg[f];
    assert.throws(() => loadConfig({ home: homeWith(cfg), env: {} }), new RegExp(`"${f}"`));
  }
  assert.throws(() => loadConfig({ home: homeWith({ ...BASE, inbox: [] }), env: {} }), /"inbox" must be a non-empty array/);
  assert.throws(() => loadConfig({ home: homeWith({ ...BASE, stub: { ...BASE.stub, quote: { estimate_usd: 1, range_usd: [1] } } }), env: {} }),
    /range_usd" must be \[low, high\]/);
  assert.throws(() => loadConfig({ home: homeWith({ ...BASE, stub: { ...BASE.stub, rooms: 0 } }), env: {} }), /"stub.rooms"/);
  assert.throws(() => loadConfig({ home: homeWith({ ...BASE, serve: { host: 'h', port: 70000 } }), env: {} }), /"serve.port"/);
  const noTour = { ...BASE, stub: { ...BASE.stub } };
  delete noTour.stub.tourPath;
  assert.throws(() => loadConfig({ home: homeWith(noTour), env: {} }), /"stub.tourPath"/);
});

test('0.3: the runner block and stub.callUsd, with defaults for a 0.2 settings file', () => {
  const h = homeWith(BASE);
  const c = loadConfig({ home: h, env: {} });
  assert.deepEqual(c.runner, { heartbeatSeconds: 2, heartbeatMs: 2000, staleSeconds: 10, staleMs: 10000, heavyStages: ['rendering'], heavyLock: `${h}/.runtime/heavy.lock` });
  assert.equal(c.stub.callUsd, 0);
  const old = { ...BASE, stub: { ...BASE.stub } };
  delete old.runner;
  delete old.stub.callUsd;
  const d = loadConfig({ home: homeWith(old), env: {} });
  assert.equal(d.runner.heartbeatMs, 2000);
  assert.equal(d.stub.callUsd, 0);
  const local = loadConfig({ home: homeWith(BASE, { runner: { heartbeatSeconds: 0.1 }, stub: { callUsd: 0.6 } }), env: {} });
  assert.equal(local.runner.heartbeatMs, 100);
  assert.deepEqual(local.runner.heavyStages, ['rendering'], 'merged one level deep');
  assert.equal(local.stub.callUsd, 0.6);
  assert.throws(() => loadConfig({ home: homeWith({ ...BASE, runner: { heartbeatSeconds: 0 } }), env: {} }), /"runner.heartbeatSeconds"/);
  assert.throws(() => loadConfig({ home: homeWith({ ...BASE, runner: { heavyStages: 'rendering' } }), env: {} }), /"runner.heavyStages"/);
  assert.throws(() => loadConfig({ home: homeWith({ ...BASE, runner: { heavyLock: '' } }), env: {} }), /"runner.heavyLock"/);
  assert.throws(() => loadConfig({ home: homeWith({ ...BASE, stub: { ...BASE.stub, callUsd: true } }), env: {} }), /"stub.callUsd"/);
  assert.throws(() => loadConfig({ home: homeWith({ ...BASE, stub: { ...BASE.stub, callUsd: -1 } }), env: {} }), /"stub.callUsd"/);
});

test('1.4: a number of the settings file is a JSON number; an environment override takes plain digits (the review of 1.3, O-3)', () => {
  // every numeric field of the file, by its name: none of them takes something that only LOOKS like a number
  const fields = [
    ['serve.port', (v) => ({ ...BASE, serve: { ...BASE.serve, port: v } })],
    ['stub.rooms', (v) => ({ ...BASE, stub: { ...BASE.stub, rooms: v } })],
    ['stub.stepSeconds', (v) => ({ ...BASE, stub: { ...BASE.stub, stepSeconds: v } })],
    ['stub.callUsd', (v) => ({ ...BASE, stub: { ...BASE.stub, callUsd: v } })],
    ['stub.quote.estimate_usd', (v) => ({ ...BASE, stub: { ...BASE.stub, quote: { ...BASE.stub.quote, estimate_usd: v } } })],
    ['stub.quote.range_usd[0]', (v) => ({ ...BASE, stub: { ...BASE.stub, quote: { ...BASE.stub.quote, range_usd: [v, 60] } } })],
    ['runner.heartbeatSeconds', (v) => ({ ...BASE, runner: { ...BASE.runner, heartbeatSeconds: v } })],
    ['runner.staleSeconds', (v) => ({ ...BASE, runner: { ...BASE.runner, staleSeconds: v } })],
    ['inspect.minSidePx', (v) => ({ ...BASE, inspect: { ...BASE.inspect, minSidePx: v } })],
    ['inspect.vectorMinPaths', (v) => ({ ...BASE, inspect: { ...BASE.inspect, vectorMinPaths: v } })],
    ['inspect.timeoutSeconds', (v) => ({ ...BASE, inspect: { ...BASE.inspect, timeoutSeconds: v } })],
    ['trace.timeoutSeconds', (v) => ({ ...BASE, trace: { ...BASE.trace, timeoutSeconds: v } })],
    ['trace.maxBudgetUsd', (v) => ({ ...BASE, trace: { ...BASE.trace, maxBudgetUsd: v } })],
    ['trace.judgeRuns', (v) => ({ ...BASE, trace: { ...BASE.trace, judgeRuns: v } })],
    ['trace.rounds', (v) => ({ ...BASE, trace: { ...BASE.trace, rounds: v } })],
  ];
  for (const [label, make] of fields) {
    for (const bad of [true, [4], '0x3', '3', ' 3 ', '', {}]) {
      assert.throws(() => loadConfig({ home: homeWith(make(bad)), env: {} }), (e) => e.message.includes(`"${label}"`), `${label} = ${JSON.stringify(bad)}`);
    }
  }
  // the real settings file still loads, and its numbers are numbers
  const c = loadConfig({ home: homeWith(BASE), env: {} });
  assert.deepEqual([typeof c.serve.port, typeof c.trace.rounds, typeof c.stub.stepSeconds, typeof c.stub.quote.range_usd[0]], ['number', 'number', 'number', 'number']);
  // the environment is text by nature: plain decimal digits are a number, anything else is refused by the override's name
  assert.equal(loadConfig({ home: homeWith(BASE), env: { ENGINE_SERVE_PORT: '4174', ENGINE_STUB_STEP_MS: '40' } }).serve.port, 4174);
  assert.equal(loadConfig({ home: homeWith(BASE), env: { ENGINE_STUB_STEP_MS: '40' } }).stub.stepMs, 40);
  for (const bad of ['0x10', '4174.5', '4 174', '-1', 'port', '1e3']) {
    assert.throws(() => loadConfig({ home: homeWith(BASE), env: { ENGINE_SERVE_PORT: bad } }), /"ENGINE_SERVE_PORT"/, bad);
    assert.throws(() => loadConfig({ home: homeWith(BASE), env: { ENGINE_STUB_STEP_MS: bad } }), /"ENGINE_STUB_STEP_MS"/, bad);
  }
});
