// Set up the engine's own runtime: the Python venv, the pinned Python libraries, the two Node
// libraries. planEnv decides what is needed (same probes as the doctor); applyEnv acts.
import fs from 'node:fs';
import { checkPython, checkNodeLibs, resolveNodeLib } from '../doctor.mjs';
import { run as runProcess } from '../lib/run.mjs';
import { appendManifestRow } from '../lib/json.mjs';

export const STEP_TIMEOUT_MS = 540000;

function probeDeps(deps) {
  return {
    run: runProcess,
    exists: fs.existsSync,
    readFile: (p) => fs.readFileSync(p, 'utf8'),
    resolveNodeLib,
    platform: process.platform,
    ...deps,
  };
}

export function planEnv(config, deps = {}) {
  const d = probeDeps(deps);
  const venvNeeded = !d.exists(config.python);
  const pipNeeded = venvNeeded || !checkPython(config, d).ok;
  const npmNeeded = !checkNodeLibs(config, d).ok;
  const steps = [
    { id: 'venv', needed: venvNeeded, cmd: config.basePython, args: ['-m', 'venv', `${config.home}/.venv`], cwd: config.home },
    { id: 'pip', needed: pipNeeded, cmd: config.python,
      args: ['-m', 'pip', 'install', '--disable-pip-version-check', '-r', config.requirements], cwd: config.home },
    { id: 'npm', needed: npmNeeded, cmd: 'npm', args: ['ci'], cwd: config.appDepsDir, shell: d.platform === 'win32' },
  ];
  return { steps };
}

export function applyEnv(plan, config, deps = {}) {
  const d = { run: runProcess, appendRow: appendManifestRow, now: () => new Date().toISOString(), ...deps };
  const manifest = `${config.runtimeDir}/setup-manifest.json`;
  const ran = [];
  for (const step of plan.steps) {
    if (!step.needed) continue;
    const r = d.run(step.cmd, step.args, { cwd: step.cwd, timeoutMs: STEP_TIMEOUT_MS, shell: Boolean(step.shell) });
    const ok = r.status === 0;
    d.appendRow(manifest, {
      at: d.now(),
      step: step.id,
      status: ok ? 'ok' : 'failed',
      inputs: { cmd: step.cmd, args: step.args, cwd: step.cwd },
    });
    if (!ok) {
      const tail = String(r.stderr || r.stdout || '').trim().split(/\r?\n/).slice(-3).join(' | ');
      return { ok: false, ran, failed: step.id, reason: `${step.id} exited ${r.status}: ${tail}` };
    }
    ran.push(step.id);
  }
  return { ok: true, ran, failed: null, reason: null };
}
