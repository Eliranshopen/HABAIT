import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { planAssets, applyAssets } from '../../engine/setup/assets.mjs';
import { fakeConfig, tempDir, writeFile } from '../helpers/fakes.mjs';

const sha = (s) => createHash('sha256').update(s).digest('hex');

// A tiny engine home + backup: rows a (present), b (copy), c (missing in source), one pack, the HDRI.
function world() {
  const root = tempDir('assets-');
  const home = `${root}/home`;
  const src = `${root}/backup/360walkaround`;
  const packs = `${root}/backup/packs`;
  const cfg = fakeConfig({
    home,
    runtimeDir: `${home}/.runtime`,
    assets: {
      source: src,
      catalogManifest: `${home}/catalog.manifest.json`,
      catalogModels: `${home}/models`,
      styleFile: `${home}/style.json`,
      hdriBase: `${home}/pipeline/360walkaround`,
      packSource: packs,
      packCache: `${home}/models/.cache`,
    },
  });
  writeFile(cfg.assets.catalogManifest, JSON.stringify({
    sources: [{ id: 'kit', pack_zip_sha256: sha('ZIP') }, { id: 'free' }],
    assets: [{ id: 'a', sha256: sha('A') }, { id: 'b', sha256: sha('B') }, { id: 'c', sha256: sha('C') }, { id: 'u' }],
  }));
  writeFile(cfg.assets.styleFile, JSON.stringify({ surfaces: { hdri: { file: 'p/sky.hdr', sha256: sha('SKY') } } }));
  writeFile(`${home}/models/a/a.blend`, 'A');
  writeFile(`${src}/catalog/models/a/a.blend`, 'A');
  writeFile(`${src}/catalog/models/b/tex/b.png`, 'B');
  writeFile(`${src}/catalog/models/b/readme.txt`, 'xx');
  writeFile(`${src}/p/sky.hdr`, 'SKY');
  writeFile(`${packs}/kit.zip`, 'ZIP');
  return { cfg, src, home, packs };
}

const states = (plan) => Object.fromEntries(plan.entries.map((e) => [e.id, e.state]));

test('planAssets: present / copy / missing-in-source, pack and HDRI, with sizes', async () => {
  const { cfg, src } = world();
  const plan = await planAssets(cfg, {});
  assert.equal(plan.from, src);
  assert.deepEqual(states(plan), { a: 'present', b: 'copy', c: 'missing-in-source', 'pack:kit': 'copy', hdri: 'copy' });
  const b = plan.entries.find((e) => e.id === 'b');
  assert.equal(b.bytes, 3);
  assert.equal(b.target, `${cfg.assets.catalogModels}/b`);
  assert.equal(plan.entries.find((e) => e.id === 'hdri').target, `${cfg.assets.hdriBase}/p/sky.hdr`);
  assert.equal(plan.entries.find((e) => e.id === 'pack:kit').target, `${cfg.assets.packCache}/kit.zip`);
});

test('applyAssets copies, verifies, fails the missing row, writes a manifest row; second run copies nothing', async () => {
  const { cfg, src } = world();
  const r1 = await applyAssets(await planAssets(cfg, {}), cfg, { now: () => 'T' });
  assert.equal(r1.copied, 3);
  assert.equal(r1.present, 1);
  assert.deepEqual(r1.failed.map((f) => f.id), ['c']);
  assert.match(r1.failed[0].reason, /missing in source/);
  assert.equal(fs.readFileSync(`${cfg.assets.catalogModels}/b/tex/b.png`, 'utf8'), 'B');
  assert.equal(fs.readFileSync(`${cfg.assets.packCache}/kit.zip`, 'utf8'), 'ZIP');
  const rows = JSON.parse(fs.readFileSync(`${cfg.runtimeDir}/assets-manifest.json`, 'utf8'));
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].at, rows[0].status, rows[0].copied], ['T', 'failed', ['b', 'pack:kit', 'hdri']]);

  writeFile(`${src}/catalog/models/c/c.blend`, 'C');
  const r2 = await applyAssets(await planAssets(cfg, {}), cfg);
  assert.deepEqual(r2, { copied: 1, present: 4, failed: [] });
  const plan3 = await planAssets(cfg, {});
  assert.ok(plan3.entries.every((e) => e.state === 'present'));
  const r3 = await applyAssets(plan3, cfg);
  assert.deepEqual(r3, { copied: 0, present: 5, failed: [] });
  assert.equal(JSON.parse(fs.readFileSync(`${cfg.runtimeDir}/assets-manifest.json`, 'utf8')).length, 2);
});

test('a wrong file at the target is overwritten; a bad source is a post-copy mismatch', async () => {
  const { cfg, src, packs } = world();
  writeFile(`${cfg.assets.packCache}/kit.zip`, 'OLD');
  writeFile(`${cfg.assets.hdriBase}/p/sky.hdr`, 'OLD');
  writeFile(`${src}/catalog/models/b/tex/b.png`, 'CORRUPT');
  fs.writeFileSync(`${packs}/kit.zip`, 'ZIP');
  const plan = await planAssets(cfg, {});
  assert.equal(states(plan)['pack:kit'], 'copy');
  assert.equal(states(plan).hdri, 'copy');
  const r = await applyAssets(plan, cfg);
  assert.deepEqual(r.failed.map((f) => [f.id, f.reason.startsWith('sha256 mismatch') || f.reason.startsWith('missing')]),
    [['b', true], ['c', true]]);
  assert.equal(fs.readFileSync(`${cfg.assets.packCache}/kit.zip`, 'utf8'), 'ZIP');
  assert.equal(fs.readFileSync(`${cfg.assets.hdriBase}/p/sky.hdr`, 'utf8'), 'SKY');
});

test('--from overrides the source; a missing HDRI / pack source is a failure; copy errors are caught', async () => {
  const { cfg, home } = world();
  const plan = await planAssets(cfg, { from: `${home}/nowhere` });
  assert.deepEqual(states(plan), { a: 'present', b: 'missing-in-source', c: 'missing-in-source', 'pack:kit': 'copy', hdri: 'missing-in-source' });
  const r = await applyAssets(plan, cfg, { copyFile: () => { throw new Error('disk full'); } });
  assert.deepEqual(r.failed.map((f) => f.id), ['b', 'c', 'pack:kit', 'hdri']);
  assert.match(r.failed[2].reason, /copy failed: disk full/);
});

test('a style file without an HDRI record plans no HDRI entry', async () => {
  const { cfg } = world();
  writeFile(cfg.assets.styleFile, '{}');
  const plan = await planAssets(cfg, {});
  assert.ok(!plan.entries.some((e) => e.id === 'hdri'));
});
