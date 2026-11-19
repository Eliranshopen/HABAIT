import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runDoctor, formatReport, readEnvNames, resolveNodeLib, pythonSnippet } from '../../engine/doctor.mjs';
import { fakeConfig, goodDeps, SECRET, tempDir, writeFile, PY_OK } from '../helpers/fakes.mjs';

const byId = (r, id) => r.checks.find((c) => c.id === id);

test('all checks ok with fakes → READY', async () => {
  const r = await runDoctor(fakeConfig(), goodDeps());
  assert.equal(r.ready, true);
  assert.equal(r.ready_except_keys, true);
  assert.deepEqual(r.checks.map((c) => c.id),
    ['node', 'python', 'node-libs', 'blender', 'chrome', 'legal', 'pipeline', 'assets-catalog', 'assets-packs', 'assets-hdri', 'keys']);
  assert.equal(byId(r, 'assets-packs').detail, '1/1');
  for (const c of r.checks) assert.ok(['runtime', 'pipeline', 'assets', 'keys'].includes(c.kind));
  assert.equal(byId(r, 'python').detail, '3/3 pinned');
  assert.equal(byId(r, 'node-libs').detail, 'sharp 0.34.4, playwright-core 1.56.1');
  assert.equal(byId(r, 'blender').detail, 'Blender 4.5.10 LTS');
  assert.equal(byId(r, 'pipeline').detail, 'parity: 41 rows · PASS');
  assert.equal(byId(r, 'assets-catalog').detail, '2/2');
  assert.match(formatReport(r), /\nREADY$/);
  assert.match(r.at, /^\d{4}-\d\d-\d\dT/);
});

test('a fake secret value never reaches the report or the result', async () => {
  const deps = goodDeps(fakeConfig(), { env: { FAL_KEY: SECRET }, readEnvNames: () => new Set(['OPENROUTER_API_KEY']) });
  const r = await runDoctor(fakeConfig(), deps);
  assert.ok(!formatReport(r).includes(SECRET));
  assert.ok(!JSON.stringify(r).includes(SECRET));
  assert.equal(byId(r, 'keys').detail, 'FAL_KEY: present, OPENROUTER_API_KEY: present');
});

test('keys: from env, from env-file names, missing → READY EXCEPT KEYS', async () => {
  const r = await runDoctor(fakeConfig(), goodDeps(fakeConfig(), { env: { FAL_KEY: '' }, readEnvNames: () => new Set(['FAL_KEY']) }));
  assert.equal(byId(r, 'keys').detail, 'FAL_KEY: present, OPENROUTER_API_KEY: missing');
  assert.equal(r.ready, false);
  assert.equal(r.ready_except_keys, true);
  const text = formatReport(r);
  assert.match(text, /^MISSING keys/m);
  assert.match(text, /\nREADY EXCEPT KEYS \(OPENROUTER_API_KEY\)$/);
  const broken = await runDoctor(fakeConfig(), goodDeps(fakeConfig(), { env: {}, readEnvNames: () => { throw new Error('x'); } }));
  assert.equal(byId(broken, 'keys').detail, 'FAL_KEY: missing, OPENROUTER_API_KEY: missing');
});

test('node version too old', async () => {
  for (const v of ['22.7.0', '20.11.1']) {
    const r = await runDoctor(fakeConfig(), goodDeps(fakeConfig(), { nodeVersion: v }));
    assert.equal(byId(r, 'node').ok, false);
    assert.equal(r.ready_except_keys, false);
  }
  const r = await runDoctor(fakeConfig(), goodDeps(fakeConfig(), { nodeVersion: 'v22.8.0' }));
  assert.equal(byId(r, 'node').ok, true);
});

test('python: missing interpreter, probe failure, no JSON, import error, version mismatch', async () => {
  const cfg = fakeConfig();
  const base = goodDeps(cfg);
  const cases = [
    [{ exists: (p) => p !== cfg.python }, /not found/],
    [{ run: (c, a) => (a[0] === '-c' ? { status: 1, stdout: '', stderr: 'Traceback\nBoom' } : base.run(c, a)) }, /probe exit 1: Boom/],
    [{ run: (c, a) => (a[0] === '-c' ? { status: 0, stdout: 'not json', stderr: '' } : base.run(c, a)) }, /no JSON/],
    [{ run: (c, a) => (a[0] === '-c'
      ? { status: 0, stdout: JSON.stringify({ import_errors: ['PIL: ModuleNotFoundError'], versions: JSON.parse(PY_OK).versions }), stderr: '' }
      : base.run(c, a)) }, /import PIL: ModuleNotFoundError/],
    [{ run: (c, a) => (a[0] === '-c'
      ? { status: 0, stdout: JSON.stringify({ import_errors: [], versions: { numpy: '2.5.3', pillow: '13.0.0', 'lazy-loader': null } }), stderr: '' }
      : base.run(c, a)) }, /numpy 2\.5\.3 != 2\.5\.4; lazy-loader absent != 0\.6/],
  ];
  for (const [over, re] of cases) {
    const r = await runDoctor(cfg, goodDeps(cfg, over));
    assert.equal(byId(r, 'python').ok, false);
    assert.match(byId(r, 'python').detail, re);
    assert.match(formatReport(r), /^FAIL\s+python/m);
    assert.match(formatReport(r), /\nNOT READY$/);
  }
});

test('python snippet imports every module and asks every pin', () => {
  const s = pythonSnippet(['numpy', 'cv2'], ['opencv-python']);
  assert.match(s, /mods = \["numpy","cv2"\]/);
  assert.match(s, /dists = \["opencv-python"\]/);
});

test('node-libs: unresolvable, wrong version, no lock', async () => {
  const cfg = fakeConfig();
  let r = await runDoctor(cfg, goodDeps(cfg, { resolveNodeLib: (d, n) => { if (n === 'sharp') throw new Error('nope'); return '1.56.1'; } }));
  assert.equal(byId(r, 'node-libs').detail, 'sharp not resolvable != 0.34.4, playwright-core 1.56.1');
  r = await runDoctor(cfg, goodDeps(cfg, { resolveNodeLib: () => '9.9.9' }));
  assert.match(byId(r, 'node-libs').detail, /sharp 9\.9\.9 != 0\.34\.4/);
  const base = goodDeps(cfg);
  r = await runDoctor(cfg, goodDeps(cfg, { readFile: (p) => (p.endsWith('package-lock.json') ? '{' : base.readFile(p)) }));
  assert.match(byId(r, 'node-libs').detail, /^package-lock\.json:/);
  r = await runDoctor(cfg, goodDeps(cfg, { readFile: (p) => (p.endsWith('package-lock.json') ? '{"packages":{}}' : base.readFile(p)) }));
  assert.match(byId(r, 'node-libs').detail, /not locked/);
});

test('blender: missing, wrong version; chrome and legal missing', async () => {
  const cfg = fakeConfig();
  const base = goodDeps(cfg);
  let r = await runDoctor(cfg, goodDeps(cfg, { exists: (p) => p !== cfg.blender && p !== cfg.chrome && !p.endsWith('disclaimer-he-en.md') }));
  assert.match(byId(r, 'blender').detail, /not found/);
  assert.match(byId(r, 'chrome').detail, /not found/);
  assert.match(byId(r, 'legal').detail, /not found: .*disclaimer-he-en\.md/);
  r = await runDoctor(cfg, goodDeps(cfg, { run: (c, a) => (a[0] === '--version' ? { status: 0, stdout: 'Blender 4.2.0\n', stderr: '' } : base.run(c, a)) }));
  assert.match(byId(r, 'blender').detail, /want 4\.5\.10, got "Blender 4\.2\.0"/);
});

test('pipeline: parity failure and the env it is given', async () => {
  const cfg = fakeConfig();
  const base = goodDeps(cfg);
  let seen;
  let r = await runDoctor(cfg, goodDeps(cfg, { run: (c, a, o) => {
    if (a[1] === '--parity') { seen = o; return { status: 1, stdout: 'parity: 40 rows · FAIL\n', stderr: 'drift' }; }
    return base.run(c, a);
  } }));
  assert.equal(byId(r, 'pipeline').ok, false);
  assert.match(byId(r, 'pipeline').detail, /exit 1: drift/);
  assert.equal(seen.cwd, cfg.pipelineRoot);
  assert.equal(seen.env.HABAIT_ENV_ROOT, cfg.envRoot);
  assert.equal(seen.timeoutMs, 120000);
  r = await runDoctor(cfg, goodDeps(cfg, { run: (c, a) => (a[1] === '--parity' ? { status: 2, stdout: 'no line', stderr: '' } : base.run(c, a)) }));
  assert.match(byId(r, 'pipeline').detail, /exit 2: no line/);
});

test('assets-catalog: a missing row, an unreadable manifest', async () => {
  const cfg = fakeConfig();
  const base = goodDeps(cfg);
  let r = await runDoctor(cfg, goodDeps(cfg, { hashFile: async (f) => (f === 'x/b1.blend' ? 'bad' : base.hashFile(f)) }));
  assert.equal(byId(r, 'assets-catalog').detail, '1/2; missing or mismatched: b');
  assert.equal(r.ready_except_keys, false);
  const many = JSON.stringify({ assets: Array.from({ length: 7 }, (_, i) => ({ id: `r${i}`, sha256: 'z' })) });
  r = await runDoctor(cfg, goodDeps(cfg, { readFile: (p) => (p === cfg.assets.catalogManifest ? many : base.readFile(p)) }));
  assert.match(byId(r, 'assets-catalog').detail, /^0\/7; .*r4, …$/);
  r = await runDoctor(cfg, goodDeps(cfg, { readFile: (p) => (p === cfg.assets.catalogManifest ? 'x' : base.readFile(p)) }));
  assert.match(byId(r, 'assets-catalog').detail, /^error: /);
});

test('assets-hdri: missing file, mismatch, no record in the style file', async () => {
  const cfg = fakeConfig();
  const base = goodDeps(cfg);
  const hdr = `${cfg.assets.hdriBase}/p/sky.hdr`;
  let r = await runDoctor(cfg, goodDeps(cfg, { exists: (p) => p !== hdr }));
  assert.match(byId(r, 'assets-hdri').detail, /not found/);
  r = await runDoctor(cfg, goodDeps(cfg, { hashFile: async (f) => (f === hdr ? 'nope' : base.hashFile(f)) }));
  assert.match(byId(r, 'assets-hdri').detail, /mismatch/);
  r = await runDoctor(cfg, goodDeps(cfg, { readFile: (p) => (p === cfg.assets.styleFile ? '{"surfaces":{}}' : base.readFile(p)) }));
  assert.match(byId(r, 'assets-hdri').detail, /no surfaces\.hdri/);
});

test('assets-packs: zip missing, zip with the wrong hash, no sources array', async () => {
  const cfg = fakeConfig();
  const base = goodDeps(cfg);
  const zip = `${cfg.assets.packCache}/kit.zip`;
  let r = await runDoctor(cfg, goodDeps(cfg, { exists: (p) => p !== zip }));
  assert.equal(byId(r, 'assets-packs').detail, '0/1; kit: not found');
  assert.equal(r.ready_except_keys, false);
  r = await runDoctor(cfg, goodDeps(cfg, { hashFile: async (f) => (f === zip ? 'bad' : base.hashFile(f)) }));
  assert.equal(byId(r, 'assets-packs').detail, '0/1; kit: sha256 mismatch');
  r = await runDoctor(cfg, goodDeps(cfg, { readFile: (p) => (p === cfg.assets.catalogManifest ? '{"assets":[]}' : base.readFile(p)) }));
  assert.equal(byId(r, 'assets-packs').detail, '0/0');
});

test('readEnvNames returns names with non-empty values only, never values', () => {
  const d = tempDir();
  assert.equal(readEnvNames(d).size, 0);
  writeFile(`${d}/.env`, `# c\nFAL_KEY=${SECRET}\nEMPTY=\nQUOTED_EMPTY=""\nexport OPENROUTER_API_KEY='${SECRET}'\nnot a line\n`);
  const names = readEnvNames(d);
  assert.deepEqual([...names].sort(), ['FAL_KEY', 'OPENROUTER_API_KEY']);
  assert.ok(!JSON.stringify([...names]).includes(SECRET));
});

test('resolveNodeLib finds an installed library version, throws when absent', () => {
  const d = tempDir();
  writeFile(`${d}/package.json`, '{}');
  writeFile(`${d}/node_modules/libx/package.json`, JSON.stringify({ name: 'libx', version: '1.2.3', main: 'lib/index.js' }));
  writeFile(`${d}/node_modules/libx/lib/package.json`, JSON.stringify({ type: 'commonjs' }));
  writeFile(`${d}/node_modules/libx/lib/index.js`, 'module.exports = 1;');
  assert.equal(resolveNodeLib(d, 'libx'), '1.2.3');
  assert.throws(() => resolveNodeLib(d, 'nolib'));
});
