/* Habait Tour360 — tools/printed-dimensions.mjs (2026-11-05). A THIN WRAPPER, not a second implementation: the measurement of a
   trace against the sheet's printed dimensions lives ONCE, in tools/printed_dimensions.py (the rule, the auto-tie of a dimension to
   its room or fixture, the visible-surface ends, the niches, the fixes snap_fixtures / fit_edges / face_bias). The fidelity gate, the
   auto-trace dims gate and the portal's plan gate all call that file (PROJECT-PACKAGE.md parity R16). This wrapper writes the plan to
   a temp file, runs `python printed_dimensions.py <plan> --json [--bar N]` and returns its {rows, niches}.
   Python: $HABAIT_PY, else the habait venv when present, else `python` on PATH (the same resolution as studio/lib/env.mjs). */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PY_CANDIDATES = ['C:/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe'];

export function pythonBin() {
  if (process.env.HABAIT_PY) return process.env.HABAIT_PY;
  return PY_CANDIDATES.find((p) => fs.existsSync(p)) || 'python';
}

export function measurePrintedDimensions(plan, { barPct = null, lines = null } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdims-'));
  try {
    const planFile = path.join(dir, 'plan.json');
    fs.writeFileSync(planFile, JSON.stringify(plan));
    const args = ['-I', path.join(HERE, 'printed_dimensions.py'), planFile, '--json'];
    if (barPct != null) args.push('--bar', String(barPct));
    if (lines) { const lf = path.join(dir, 'lines.json'); fs.writeFileSync(lf, JSON.stringify(lines)); args.push('--lines', lf); }
    const r = spawnSync(pythonBin(), args, { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, windowsHide: true, maxBuffer: 64 << 20 });
    if (r.status !== 0) throw new Error(`printed_dimensions.py failed (${r.status}): ${(r.stderr || r.error || '').toString().slice(0, 800)}`);
    return JSON.parse(r.stdout);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
