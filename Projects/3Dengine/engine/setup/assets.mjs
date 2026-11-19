// Bring the render assets (57 sealed catalog rows + the HDRI) from a backup copy into the
// engine home. Only rows not already present are copied; every copy is re-verified by sha256.
import fs from 'node:fs';
import path from 'node:path';
import { readJson, appendManifestRow } from '../lib/json.mjs';
import { listFiles as listFilesDefault, totalBytes as totalBytesDefault } from '../lib/files.mjs';
import { sha256File } from '../lib/hash.mjs';
import { rowPresent, packSources } from '../doctor.mjs';
import { resolveFrom } from '../lib/paths.mjs';

function withDefaults(deps) {
  return {
    readFile: (p) => fs.readFileSync(p, 'utf8'),
    exists: fs.existsSync,
    listFiles: listFilesDefault,
    totalBytes: totalBytesDefault,
    hashFile: sha256File,
    copyDir: (src, dst) => fs.cpSync(src, dst, { recursive: true }),
    copyFile: (src, dst) => {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
    },
    appendRow: appendManifestRow,
    now: () => new Date().toISOString(),
    ...deps,
  };
}

export async function planAssets(config, { from } = {}, deps = {}) {
  const d = withDefaults(deps);
  const src = resolveFrom(config.home, from || config.assets.source);
  const manifest = readJson(config.assets.catalogManifest, d.readFile);
  const entries = [];
  for (const row of (manifest.assets || []).filter((r) => r.sha256)) {
    const source = `${src}/catalog/models/${row.id}`;
    const target = `${config.assets.catalogModels}/${row.id}`;
    let state;
    let bytes = 0;
    if (await rowPresent(target, row.sha256, d)) {
      state = 'present';
      bytes = d.totalBytes(d.listFiles(target));
    } else {
      const files = d.listFiles(source);
      state = files.length ? 'copy' : 'missing-in-source';
      bytes = files.length ? d.totalBytes(files) : 0;
    }
    entries.push({ id: row.id, kind: 'catalog', sha256: row.sha256, source, target, state, bytes });
  }

  const packSrc = resolveFrom(config.home, config.assets.packSource);
  for (const s of packSources(manifest)) {
    entries.push(await fileEntry(`pack:${s.id}`, 'pack', s.pack_zip_sha256,
      `${packSrc}/${s.id}.zip`, `${config.assets.packCache}/${s.id}.zip`, d));
  }

  const hdri = readJson(config.assets.styleFile, d.readFile).surfaces?.hdri;
  if (hdri?.file && hdri?.sha256) {
    entries.push(await fileEntry('hdri', 'hdri', hdri.sha256,
      `${src}/${hdri.file}`, `${config.assets.hdriBase}/${hdri.file}`, d));
  }
  return { from: src, entries };
}

// A single sealed file: present when the target hashes right; a wrong target is overwritten.
async function fileEntry(id, kind, sha256, source, target, d) {
  let state;
  if (d.exists(target) && (await d.hashFile(target)) === sha256) state = 'present';
  else state = d.exists(source) ? 'copy' : 'missing-in-source';
  const sized = state === 'present' ? target : state === 'copy' ? source : null;
  return { id, kind, sha256, source, target, state, bytes: sized ? d.totalBytes([sized]) : 0 };
}

async function verified(entry, d) {
  if (entry.kind !== 'catalog') return d.exists(entry.target) && (await d.hashFile(entry.target)) === entry.sha256;
  return rowPresent(entry.target, entry.sha256, d);
}

export async function applyAssets(plan, config, deps = {}) {
  const d = withDefaults(deps);
  const copied = [];
  const failed = [];
  let present = 0;
  for (const e of plan.entries) {
    if (e.state === 'present') {
      present += 1;
      continue;
    }
    if (e.state === 'missing-in-source') {
      failed.push({ id: e.id, reason: `missing in source: ${e.source}` });
      continue;
    }
    try {
      if (e.kind !== 'catalog') d.copyFile(e.source, e.target);
      else d.copyDir(e.source, e.target);
    } catch (err) {
      failed.push({ id: e.id, reason: `copy failed: ${err.message}` });
      continue;
    }
    if (await verified(e, d)) copied.push(e.id);
    else failed.push({ id: e.id, reason: 'sha256 mismatch after copy' });
  }
  if (copied.length || failed.length) {
    d.appendRow(`${config.runtimeDir}/assets-manifest.json`, {
      at: d.now(),
      step: 'bring-assets',
      status: failed.length ? 'failed' : 'ok',
      inputs: { from: plan.from, entries: plan.entries.length },
      copied,
      failed,
    });
  }
  return { copied: copied.length, present, failed };
}
