#!/usr/bin/env node
/* ADAPTED COPY (2026-11-18) of RAINBOW's Habait/tour360/tools/catalog-check.mjs, for an apartment's OWN catalog folder
   (<apartment>/catalog/items.json + its photos), never RAINBOW's catalog/. Same rules: the fields, the categories, the proven views,
   a JPEG <= 1024 px on the long side and <= 400 KB, the photo's SHA-256 equal to image_sha256 (the handler binds a request's reference
   image to the catalog by this hash, D-CAT-9). $0, zero dependencies.
     node tools/tour360/catalog-check.mjs <catalog-dir>          (also imported by tools/tour360/build-tour.mjs) */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const isAi = (it) => it.source === 'ai-generated';
export const photoPath = (dir, it) => path.join(dir, String(it.image || ''));
export const CATEGORIES = ['sofa', 'armchair', 'coffee_table', 'dining_table', 'chair', 'lamp', 'rug', 'bed', 'shelf'];
export const VIEWS = { living: [-18, -100, 95], dining: [-13, 0, 80] };
export const LIMITS = { longSidePx: 1024, bytes: 400_000, descriptionMin: 20 };

function jpegSize(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1];
    if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01 || m === 0xff) { i += 2; continue; }
    const len = buf.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}

export function checkCatalog(dir, { only = null } = {}) {
  const problems = [], rows = [];
  const bad = (id, msg) => problems.push(`${id}: ${msg}`);
  const file = path.join(dir, 'items.json');
  if (!fs.existsSync(file)) return { ok: false, problems: [file + ' is missing'], rows };
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (doc.$schema !== 'tour360/catalog.v1') bad('catalog', 'unknown $schema ' + doc.$schema);
  for (const k of ['retailer', 'site', 'read_on', 'licence']) if (!doc.source?.[k]) bad('catalog', 'source.' + k + ' missing');
  const ids = new Set();
  for (const it of (doc.items || []).filter((r) => only !== 'ai' || isAi(r))) {
    const id = String(it.id || '?');
    if (!/^[a-z0-9-]{2,24}$/.test(id)) bad(id, 'id must be [a-z0-9-]{2,24}');
    if (ids.has(id)) bad(id, 'duplicate id'); ids.add(id);
    if (!isAi(it)) bad(id, 'only AI-generated rows belong in this project catalog');
    for (const k of ['brand', 'name', 'colour', 'image', 'description_en']) if (typeof it[k] !== 'string' || !it[k].trim()) bad(id, k + ' missing');
    if (!CATEGORIES.includes(it.category)) bad(id, 'category not in ' + CATEGORIES.join('|'));
    if (!VIEWS[it.view]) bad(id, 'view not in ' + Object.keys(VIEWS).join('|'));
    for (const k of ['w', 'd', 'h']) if (!(it.size_cm?.[k] > 0)) bad(id, 'size_cm.' + k + ' missing');
    if ((it.description_en || '').trim().length < LIMITS.descriptionMin) bad(id, 'description_en too short');
    const p = photoPath(dir, it);
    if (!fs.existsSync(p)) { bad(id, 'photo missing ' + it.image); continue; }
    const buf = fs.readFileSync(p), sz = jpegSize(buf), sha = crypto.createHash('sha256').update(buf).digest('hex');
    if (!sz) bad(id, 'photo is not a JPEG');
    else if (Math.max(sz.width, sz.height) > LIMITS.longSidePx) bad(id, 'photo long side > ' + LIMITS.longSidePx);
    if (buf.length > LIMITS.bytes) bad(id, `photo ${buf.length} bytes > ${LIMITS.bytes}`);
    if (it.image_sha256 !== sha) bad(id, 'image_sha256 does not match the photo on disk');
    rows.push({ id, category: it.category, px: sz ? `${sz.width}x${sz.height}` : '-', bytes: buf.length, sha: sha.slice(0, 16) });
  }
  if (!rows.length) bad('catalog', 'no items');
  return { ok: problems.length === 0, problems, rows };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = checkCatalog(path.resolve(process.argv[2] || 'tour360/apartments/ahk-apt7/catalog'));
  for (const row of r.rows) console.log(`${row.id.padEnd(22)} ${row.category.padEnd(13)} ${row.px.padEnd(9)} ${String(row.bytes).padStart(7)} ${row.sha}`);
  for (const p of r.problems) console.error('PROBLEM ' + p);
  console.log(r.ok ? 'catalog-check: OK' : 'catalog-check: FAIL');
  process.exit(r.ok ? 0 : 1);
}
