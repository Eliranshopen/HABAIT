// Recursive file listing: absolute forward-slash paths, sorted; a missing folder is empty.
import fs from 'node:fs';
import path from 'node:path';
import { toPosix } from './paths.mjs';

export function listFiles(dir) {
  const out = [];
  const walk = (d) => {
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch (e) {
      if (e.code === 'ENOENT' || e.code === 'ENOTDIR') return;
      throw e;
    }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) out.push(toPosix(p));
    }
  };
  walk(dir);
  return out.sort();
}

export function totalBytes(files) {
  return files.reduce((n, f) => n + fs.statSync(f).size, 0);
}
