// JSON on disk: read, write (2-space, trailing newline), and append a manifest row.
import fs from 'node:fs';
import path from 'node:path';

export function readJson(file, readFile = (p) => fs.readFileSync(p, 'utf8')) {
  return JSON.parse(String(readFile(file)).replace(/^﻿/, ''));
}

export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

// A manifest is a JSON array of rows; a missing file starts an empty one.
export function appendManifestRow(file, row) {
  const rows = fs.existsSync(file) ? readJson(file) : [];
  if (!Array.isArray(rows)) throw new Error(`manifest is not a JSON array: ${file}`);
  rows.push(row);
  writeJson(file, rows);
  return rows.length;
}
