import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { planEnv, applyEnv, STEP_TIMEOUT_MS } from '../../engine/setup/env.mjs';
import { fakeConfig, goodDeps, tempDir } from '../helpers/fakes.mjs';

test('nothing needed when the probes pass', () => {
  const plan = planEnv(fakeConfig(), goodDeps());
  assert.deepEqual(plan.steps.map((s) => [s.id, s.needed]), [['venv', false], ['pip', false], ['npm', false]]);
});

test('everything needed on a bare machine; commands as specified', () => {
  const cfg = fakeConfig();
  const plan = planEnv(cfg, goodDeps(cfg, { exists: () => false, resolveNodeLib: () => { throw new Error('x'); }, platform: 'win32' }));
  const [venv, pip, npm] = plan.steps;
  assert.ok(venv.needed && pip.needed && npm.needed);
  assert.deepEqual([venv.cmd, venv.args, venv.cwd], ['python', ['-m', 'venv', 'C:/eng/.venv'], 'C:/eng']);
  assert.deepEqual([pip.cmd, pip.args], [cfg.python,
    ['-m', 'pip', 'install', '--disable-pip-version-check', '-r', cfg.requirements]]);
  assert.deepEqual([npm.cmd, npm.args, npm.cwd, npm.shell], ['npm', ['ci'], cfg.appDepsDir, true]);
  const linux = planEnv(cfg, goodDeps(cfg, { platform: 'linux' }));
  assert.equal(linux.steps[2].shell, false);
});

test('pip needed when a pin is off even though the venv exists', () => {
  const cfg = fakeConfig();
  const base = goodDeps(cfg);
  const plan = planEnv(cfg, goodDeps(cfg, { run: (c, a) => (a[0] === '-c' ? { status: 1, stdout: '', stderr: 'x' } : base.run(c, a)) }));
  assert.deepEqual(plan.steps.map((s) => s.needed), [false, true, false]);
});

test('applyEnv runs needed steps in order and writes a manifest row each', () => {
  const dir = tempDir('envm-');
  const cfg = fakeConfig({ runtimeDir: dir });
  const calls = [];
  const plan = { steps: [
    { id: 'venv', needed: true, cmd: 'py', args: ['-m', 'venv'], cwd: 'C:/eng' },
    { id: 'pip', needed: false, cmd: 'p', args: [], cwd: 'C:/eng' },
    { id: 'npm', needed: true, cmd: 'npm', args: ['ci'], cwd: 'C:/eng/appdeps', shell: true },
  ] };
  const r = applyEnv(plan, cfg, { run: (c, a, o) => { calls.push([c, o]); return { status: 0, stdout: '', stderr: '' }; }, now: () => 'T' });
  assert.deepEqual(r, { ok: true, ran: ['venv', 'npm'], failed: null, reason: null });
  assert.deepEqual(calls.map(([c]) => c), ['py', 'npm']);
  assert.equal(calls[0][1].timeoutMs, STEP_TIMEOUT_MS);
  assert.equal(calls[1][1].shell, true);
  const rows = JSON.parse(fs.readFileSync(`${dir}/setup-manifest.json`, 'utf8'));
  assert.deepEqual(rows.map((x) => [x.at, x.step, x.status]), [['T', 'venv', 'ok'], ['T', 'npm', 'ok']]);
  assert.deepEqual(rows[1].inputs, { cmd: 'npm', args: ['ci'], cwd: 'C:/eng/appdeps' });
});

test('applyEnv stops at the first failure with its reason', () => {
  const dir = tempDir('envm-');
  const cfg = fakeConfig({ runtimeDir: dir });
  const plan = { steps: ['venv', 'pip', 'npm'].map((id) => ({ id, needed: true, cmd: id, args: [], cwd: 'C:/eng' })) };
  const ran = [];
  const r = applyEnv(plan, cfg, { run: (c) => { ran.push(c); return c === 'pip' ? { status: 1, stdout: '', stderr: 'a\nb\nNo matching distribution' } : { status: 0, stdout: '', stderr: '' }; } });
  assert.equal(r.ok, false);
  assert.equal(r.failed, 'pip');
  assert.match(r.reason, /^pip exited 1: .*No matching distribution/);
  assert.deepEqual(ran, ['venv', 'pip']);
  const rows = JSON.parse(fs.readFileSync(`${dir}/setup-manifest.json`, 'utf8'));
  assert.deepEqual(rows.map((x) => x.status), ['ok', 'failed']);
});

test('applyEnv with nothing needed runs nothing and writes nothing', () => {
  const dir = tempDir('envm-');
  const r = applyEnv({ steps: [{ id: 'venv', needed: false }] }, fakeConfig({ runtimeDir: dir }), { run: () => assert.fail('ran') });
  assert.deepEqual(r.ran, []);
  assert.equal(fs.existsSync(`${dir}/setup-manifest.json`), false);
});
