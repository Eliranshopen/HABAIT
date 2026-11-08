/* Habait Tour360 — tools/catalog-gen.mjs (plan development/plans/2026-11-04-apt-furniture-swap.md P2) — the AI catalog.
   Turns each row of catalog/ai-spec.json into a product photo, catalog/ai/<id>.jpg (≤ 1024 px, ≤ 400 KB, tracked: no licence
   question, it is ours), and an items.json row with source "ai-generated" (no brand, price or link; the page shows it as AI-made).
     timeout 540 node Habait/tour360/tools/catalog-gen.mjs            # dry run: lists what would be generated and the estimate, $0
     timeout 540 node Habait/tour360/tools/catalog-gen.mjs --go       # generates the missing photos only (a photo on disk is never redone)
     timeout 300 node Habait/tour360/tools/catalog-gen.mjs --go --only <id>   # one item (the first look before the batch)
     timeout 60  node Habait/tour360/tools/catalog-gen.mjs --rows     # rewrites the items.json rows from the spec and the photos, $0
   Every call is reserved before it is sent and settled after, in catalog/ai/ledger.json (cap $3, --budget for this run, default 2).
   Root §5: dry by default, idempotent, exits non-zero with the reason. Secrets by name: FAL_KEY from the root .env, never printed. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { fileLedger, loadEnv } from './file-ledger.mjs';
import { loadSharp } from './pano-geometry.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HARNESS = path.resolve(ROOT, '..', '..');
const SPEC = path.join(ROOT, 'catalog', 'ai-spec.json');
const ITEMS = path.join(ROOT, 'catalog', 'items.json');
const OUT = path.join(ROOT, 'catalog', 'ai');
const has = (n) => process.argv.includes(n);
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const fail = (m) => { console.error('catalog-gen: ' + m); process.exit(1); };

const spec = JSON.parse(fs.readFileSync(SPEC, 'utf8'));
const go = has('--go');
const budget = Number(arg('--budget', '2'));
const VIEW_OF = { dining_table: 'dining', chair: 'dining' };   // catalog-check's closed list of proven looks; the rest read as living

async function generate(env, it) {
  const res = await fetch('https://fal.run/' + spec.model, {
    method: 'POST',
    headers: { Authorization: 'Key ' + env.FAL_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: `${spec.style} The piece: ${it.description_en}.`, num_images: 1, aspect_ratio: '1:1', output_format: 'jpeg' }),
    signal: AbortSignal.timeout(180_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`fal HTTP ${res.status}: ${text.slice(0, 200)}`);
  const url = JSON.parse(text).images?.[0]?.url;
  if (!url) throw new Error('fal answered without an image');
  const img = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!img.ok) throw new Error('image download HTTP ' + img.status);
  return Buffer.from(await img.arrayBuffer());
}

async function fit(sharp, buf) {
  for (const q of [88, 82, 76, 70]) {
    const out = await sharp(buf).resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: q, mozjpeg: true }).toBuffer();
    if (out.length <= 400_000) return out;
  }
  throw new Error('photo stays over 400 KB');
}

function writeRows() {
  const doc = JSON.parse(fs.readFileSync(ITEMS, 'utf8'));
  const keep = doc.items.filter((r) => r.source !== 'ai-generated');
  const today = new Date().toISOString().slice(0, 10);
  const rows = [];
  for (const it of spec.items) {
    const file = path.join(OUT, it.id + '.jpg');
    if (!fs.existsSync(file)) continue;
    const prev = doc.items.find((r) => r.id === it.id);
    rows.push({
      id: it.id, source: 'ai-generated', brand: 'Habait AI', name: it.name, name_he: it.name_he, category: it.category, colour: it.colour,
      size_cm: it.size_cm, image: 'ai/' + it.id + '.jpg', view: VIEW_OF[it.category] || 'living', description_en: it.description_en,
      generated: prev?.generated || { model: spec.model, on: today },
      image_sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
    });
  }
  doc.items = [...keep, ...rows];
  fs.writeFileSync(ITEMS, JSON.stringify(doc, null, 2) + '\n');
  console.log(`items.json: ${keep.length} retailer row(s) kept, ${rows.length} AI row(s) written`);
}

if (has('--rows')) { writeRows(); process.exit(0); }

const only = arg('--only', null);
const todo = spec.items.filter((it) => (!only || it.id === only) && !fs.existsSync(path.join(OUT, it.id + '.jpg')));
const est = Math.round(todo.length * spec.usd_each * 100) / 100;
console.log(`catalog-gen: ${spec.items.length} in the spec, ${todo.length} to generate on ${spec.model} ≈ $${est} (budget $${budget})`);
if (!go) { for (const it of todo) console.log('  would generate ' + it.id); console.log('dry run: nothing spent; add --go'); process.exit(0); }
if (est > budget) fail(`the estimate $${est} is over --budget $${budget}`);

const env = loadEnv(HARNESS);
if (!env.FAL_KEY) fail('FAL_KEY is missing from the root .env');
const sharp = loadSharp(HARNESS);
const ledger = fileLedger(path.join(OUT, 'ledger.json'));
fs.mkdirSync(OUT, { recursive: true });
let spent = 0, failed = 0;
for (const it of todo) {
  if (ledger.total() + spec.usd_each > ledger.cap) fail(`the ledger cap $${ledger.cap} would be crossed`);
  if (spent + spec.usd_each > budget + 1e-9) fail(`this run's budget $${budget} would be crossed`);
  const row = ledger.reserve({ ts: new Date().toISOString(), op: 'catalog-gen', item: it.id, model: spec.model, reserved_usd: spec.usd_each, settled_usd: null, status: 'reserved' });
  const t0 = Date.now();
  try {
    const jpg = await fit(sharp, await generate(env, it));
    fs.writeFileSync(path.join(OUT, it.id + '.jpg'), jpg);
    ledger.settle(row, spec.usd_each, { status: 'settled', bytes: jpg.length, seconds: Math.round((Date.now() - t0) / 100) / 10 });
    spent += spec.usd_each;
    console.log(`${it.id}: ${jpg.length} bytes in ${Math.round((Date.now() - t0) / 1000)} s`);
  } catch (e) {
    ledger.settle(row, 0, { status: 'failed', error: String(e.message || e).slice(0, 200) });
    console.error(`${it.id}: FAILED ${e.message}`); failed++;
  }
}
writeRows();
console.log(`catalog-gen: this run ≈ $${Math.round(spent * 100) / 100}, ledger $${Math.round(ledger.total() * 100) / 100} of $${ledger.cap}`);
if (failed) fail(`${failed} item(s) failed`);
