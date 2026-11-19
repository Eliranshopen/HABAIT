// One bounded child process: spawnSync with a timeout, hidden window, text output.
import { spawnSync } from 'node:child_process';

export function run(cmd, args = [], { cwd, env, timeoutMs = 120000, shell = false, input } = {}) {
  const opts = {
    cwd,
    env,
    input,
    timeout: timeoutMs,
    windowsHide: true,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  };
  // Through a shell (needed for `npm` on Windows) the command goes as ONE string: Node warns (DEP0190) when an
  // args array is passed with a shell, because it does not escape it. Callers pass fixed words only, never input.
  const r = shell ? spawnSync([cmd, ...args].join(' '), { ...opts, shell: true }) : spawnSync(cmd, args, opts);
  let stderr = r.stderr || '';
  if (r.error) stderr = `${stderr}${stderr ? '\n' : ''}${r.error.code || 'ERROR'}: ${r.error.message}`;
  return { status: r.status === null ? -1 : r.status, stdout: r.stdout || '', stderr };
}
