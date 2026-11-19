// Every env pointer the brought-in pipeline falls back from (to an old C:/ default) must be
// one the engine sets, or be named here with a reason.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadConfig, pipelineEnv } from '../../engine/config.mjs';
import { listFiles } from '../../engine/lib/files.mjs';

const ALLOW = { LOCALAPPDATA: 'provided by Windows itself' };
const DIRS = ['Habait/tour360/tools', 'Habait/tour360/server', '360walkaround/pipeline', '360walkaround/catalog',
  'Habait/tools', 'Habait/platform/tools'];
const JS_RE = /process\.env\.([A-Z_][A-Z0-9_]*)\s*\|\|\s*['"]C:/g;
const PY_RE = /os\.environ\.get\(\s*['"]([A-Z_][A-Z0-9_]*)['"]\s*,\s*r?['"]C:/g;

export function scanPointers(root) {
  const found = new Map();
  for (const dir of DIRS) {
    for (const f of listFiles(`${root}/${dir}`)) {
      if (!/\.(mjs|js|cjs|py)$/.test(f)) continue;
      if (f.includes('/Habait/tour360/tools/sandbox-worker/')) continue;
      const text = fs.readFileSync(f, 'utf8');
      for (const re of [JS_RE, PY_RE]) {
        for (const m of text.matchAll(re)) {
          if (!found.has(m[1])) found.set(m[1], new Set());
          found.get(m[1]).add(f.slice(root.length + 1));
        }
      }
    }
  }
  return found;
}

test('every pipeline env fallback is covered by pipelineEnv or the allow-list', () => {
  const config = loadConfig({ env: {} });
  const set = pipelineEnv(config);
  const found = scanPointers(config.pipelineRoot);
  assert.ok(found.size >= 5, `scan found only ${found.size} names`);
  for (const k of ['HABAIT_APP_DIR', 'HABAIT_PY', 'HABAIT_ENV_ROOT', 'HABAIT_BLENDER_LOCK', 'CHROME']) assert.ok(found.has(k), k);
  const uncovered = [...found.keys()].filter((n) => !(n in set) && !(n in ALLOW));
  assert.deepEqual(uncovered, [], `uncovered: ${uncovered.map((n) => `${n} in ${[...found.get(n)].join(', ')}`).join('; ')}`);
});

test('the allow-list carries a reason for each name', () => {
  for (const [k, v] of Object.entries(ALLOW)) assert.ok(v.length > 5, k);
});
