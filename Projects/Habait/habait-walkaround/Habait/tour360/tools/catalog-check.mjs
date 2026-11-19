#!/usr/bin/env node
/* catalog-check.mjs — the one check of the catalog (CATALOG-PLAN.md §4, T14·P0). Zero dependencies.
   Reads catalog/items.json, verifies every item's fields and its photo in catalog/_local/ (a JPEG, ≤ 1024 px on the long side,
   ≤ 400 KB), computes the photo's SHA-256 and — with --write — records it as image_sha256 (the handler binds a request's
   reference image to the catalog by this hash, D-CAT-9). Prints one row per item; exit 1 on any miss.
     node Habait/tour360/tools/catalog-check.mjs [--write]
   The photos are reference-only and never committed (catalog/_local/ is gitignored); this check never copies or publishes them. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'catalog', 'items.json');
const LOCAL = path.join(ROOT, 'catalog', '_local');
/** Where a row's photo lives: an AI row (source "ai-generated", plan 2026-11-04-apt-furniture-swap) in the tracked catalog/ai/, a retailer row in the gitignored _local/. */
export const photoPath = (it) => (it.source === 'ai-generated' ? path.join(ROOT, 'catalog', String(it.image || '')) : path.join(LOCAL, String(it.image || '')));
export const isAi = (it) => it.source === 'ai-generated';
const WRITE = process.argv.includes('--write');
export const CATEGORIES = ['sofa', 'armchair', 'coffee_table', 'dining_table', 'chair', 'lamp', 'rug', 'bed', 'shelf'];
export const VIEWS = { living: [-18, -100, 95], dining: [-13, 0, 80] }; // live-check's two proven looks (pitch, yaw, hfov)
export const LIMITS = { longSidePx: 1024, bytes: 400_000, descriptionMin: 20 };

/** JPEG pixel size from the first SOF marker (no decoder needed). */
export function jpegSize(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01 || marker === 0xff) { i += 2; continue; }
    const len = buf.readUInt16BE(i + 2);
    const sof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (sof) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}

export function checkCatalog({ write = false , only = null } = {}) {
  const problems = [];
  const bad = (id, msg) => problems.push(`${id}: ${msg}`);
  if (!fs.existsSync(FILE)) return { ok: false, problems: ['catalog/items.json is missing'], rows: [] };
  const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  if (doc.$schema !== 'tour360/catalog.v1') bad('catalog', 'unknown $schema ' + doc.$schema);
  for (const k of ['retailer', 'site', 'read_on', 'licence']) if (!doc.source?.[k]) bad('catalog', 'source.' + k + ' missing');
  if (!Array.isArray(doc.items) || doc.items.length === 0) bad('catalog', 'no items');
  const ids = new Set();
  const rows = [];
  for (const it of (doc.items || []).filter((r) => only !== 'ai' || isAi(r))) {
    const id = String(it.id || '?');
    if (!/^[a-z0-9-]{2,24}$/.test(id)) bad(id, 'id must be [a-z0-9-]{2,24}');
    if (ids.has(id)) bad(id, 'duplicate id'); ids.add(id);
    for (const k of isAi(it) ? ['brand', 'name', 'colour', 'image', 'description_en'] : ['brand', 'name', 'article', 'colour', 'url', 'image', 'description_en']) if (typeof it[k] !== 'string' || !it[k].trim()) bad(id, k + ' missing');
    if (!CATEGORIES.includes(it.category)) bad(id, 'category not in ' + CATEGORIES.join('|'));
    if (!VIEWS[it.view]) bad(id, 'view not in ' + Object.keys(VIEWS).join('|'));
    if (!isAi(it) && !/^https:\/\/www\.ikea\.com\/il\/he\/p\//.test(it.url || '') && !/^https:\/\//.test(it.url || '')) bad(id, 'url is not https');
    for (const k of ['w', 'd', 'h']) if (typeof it.size_cm?.[k] !== 'number' || !(it.size_cm[k] > 0)) bad(id, 'size_cm.' + k + ' missing');
    if (!isAi(it) && (typeof it.price?.ils !== 'number' || !(it.price.ils > 0))) bad(id, 'price.ils missing');
    if (!isAi(it) && !/^\d{4}-\d{2}-\d{2}$/.test(it.price?.read_on || '')) bad(id, 'price.read_on is not a date');
    if ((it.description_en || '').trim().length < LIMITS.descriptionMin) bad(id, 'description_en under ' + LIMITS.descriptionMin + ' chars');
    const row = { id, category: it.category, view: it.view, px: '-', bytes: 0, sha: '-' };
    const img = photoPath(it);
    if (!it.image || !fs.existsSync(img)) { bad(id, 'photo missing: ' + path.relative(ROOT, img).replace(/\\/g, '/')); rows.push(row); continue; }
    const buf = fs.readFileSync(img);
    const size = jpegSize(buf);
    if (!size) bad(id, 'photo is not a JPEG');
    else {
      row.px = size.width + 'x' + size.height;
      if (Math.max(size.width, size.height) > LIMITS.longSidePx) bad(id, `photo long side ${Math.max(size.width, size.height)} > ${LIMITS.longSidePx}`);
    }
    row.bytes = buf.length;
    if (buf.length > LIMITS.bytes) bad(id, `photo ${buf.length} bytes > ${LIMITS.bytes}`);
    const sha = crypto.createHash('sha256').update(buf).digest('hex');
    row.sha = sha.slice(0, 16);
    if (it.image_sha256 && it.image_sha256 !== sha) bad(id, 'image_sha256 does not match the photo on disk' + (write ? ' (rewritten)' : ''));
    if (write) it.image_sha256 = sha; else if (!it.image_sha256) bad(id, 'image_sha256 missing (run with --write)');
    rows.push(row);
  }
  if (write && problems.every((p) => !/missing|not a JPEG|duplicate|unknown|no items/.test(p))) fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + '\n');
  return { ok: problems.length === 0, problems, rows, count: (doc.items || []).length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = checkCatalog({ write: WRITE, only: process.argv.includes('--ai') ? 'ai' : null });
  for (const row of r.rows) console.log(`${row.id.padEnd(12)} ${row.category.padEnd(13)} ${row.view.padEnd(7)} ${row.px.padEnd(10)} ${String(row.bytes).padStart(7)} B  ${row.sha}`);
  for (const p of r.problems) console.error('MISS ' + p);
  console.log(r.ok ? `catalog-check: OK — ${r.rows.length} items${WRITE ? ', hashes written' : ''}` : `catalog-check: FAIL — ${r.problems.length} problem(s)`);
  process.exit(r.ok ? 0 : 1);
}
