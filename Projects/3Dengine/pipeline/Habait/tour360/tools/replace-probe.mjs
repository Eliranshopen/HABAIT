/* Habait Tour360 — tools/replace-probe.mjs (T14c re-scoped 2026-10-07: the point-to-replace probe, CATALOG-PLAN.md §10).
   Slava's rulings D-CAT-12…19: markers built ahead from a scan of every scene; a tap shows only the matching items; the engine
   is chosen from the pictures — "erase, then place" against "one zoomed editor call" on the same pieces; only pieces with a
   catalog match; a chair set is replaced whole; the probe runs now, up to $2 inside the $5 laptop cap.

   Three bounded steps, each resumable, every paid call reserved before and settled after in the laptop ledger
   (apartments/demo-01/_local/ledger.json, rows marked probe: "replace") and counted against this probe's own budget
   (<out>/spend.json):

     timeout 540 node Habait/tour360/tools/replace-probe.mjs --scan [--scenes living,kitchen] [--dry] [--out <dir>]
       renders four views per scene (yaw = heading + 0/90/180/270, pitch -15, hfov 90, 1264×848) from the balanced pano, asks the
       vision model for every piece of furniture (label, category, box, outline), draws the boxes, writes <out>/scan/*.jpg and
       <out>/scan.json. --dry renders the views only ($0). A scene already in scan.json is skipped unless --force.
     timeout 540 node Habait/tour360/tools/replace-probe.mjs --piece sofa|armchair|coffee_table|dining_table|chair|all [--engines erase,direct] [--force]
       picks the largest piece of the category from the scan (chair: every chair at the dining table, as one set), cuts a crop
       zoomed onto it, re-detects it there for a precise outline, builds the mask, then runs the engines:
         erase  — fal-ai/finegrain-eraser/mask (express, $0.04) clears the piece with its shadow; Nano Banana 2 ($0.08) places the
                  product from its photo in the cleared spot;
         direct — the handler's own catalog turn (text step + Nano Banana 2 with the product photo, $0.083) on the zoomed crop.
       Each result is checked: the border ring (free), the replace judge (one vision call: the old piece gone, the product standing
       where it stood, the rest unchanged) and the likeness score (report-only). Writes <out>/<category>/… and refreshes the sheet.
     timeout 60 node Habait/tour360/tools/replace-probe.mjs --report
       prints the table and refreshes <out>/index.html (the product photos are LINKED from catalog/_local/, never copied).

   Secrets by name: FAL_KEY and OPENROUTER_API_KEY are read from the root .env by file-ledger.mjs' loadEnv; never printed.
   T16a (2026-10-07 evening): the sphere maths moved to tools/pano-geometry.mjs, shared with tools/scan-pieces.mjs.
   The default <out> is qa-evidence/tour360/T14/replace-probe. Prices: the fal pages (eraser $0.04 express) and MODELS in the
   handler; the vision calls settle at the cost OpenRouter reports when it does, else the handler's $0.003/$0.004 assumptions. */
import { chatFetch } from '../server/chat-transport.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { fileLedger, loadEnv } from './file-ledger.mjs';
import * as G from './pano-geometry.mjs';
import { basis, focal, yawOf, pitchOf, angleBetween, fitPolygon, rasterMask, dilate, norm, clamp, round } from './pano-geometry.mjs';
import { TEXT_MODEL, TEXT_USD, JUDGE_USD, LIKENESS_USD, MODELS, edit, likeness, handleEdit, catalogIndex, describe, EditError } from '../server/handler.mjs';
import * as HANDLER from '../server/handler.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HARNESS = path.resolve(ROOT, '..', '..');
const sharp = G.loadSharp(HARNESS);

const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : dflt; };
const has = (name) => process.argv.includes(name);
const OUT = path.resolve(arg('--out', path.join(HARNESS, 'qa-evidence', 'tour360', 'T14', 'replace-probe')));
const BUDGET = Number(arg('--budget', '2'));
const APT = 'demo-01';
const W = 1264, H = 848;
const SCAN = { pitch: -15, hfov: 90, yaws: [0, 90, 180, 270] };
const ZOOM = { single: 2.2, set: 1.5, min: 45, max: 90 };
const RING = { ring: 40, thr: 22, max: 0.15 };
const MASK_PAD = 6;
/* Two mask erasers, both $0.04 on their fal pages (2026-10-07): Finegrain express (standard $0.13, premium $0.22) and Bria's,
   "trained exclusively on licensed data". Engine "erase" = Finegrain; engine "erase-bria" = Bria. */
const ERASERS = {
  finegrain: { id: 'fal-ai/finegrain-eraser/mask', usd: 0.04, body: (image_url, mask_url) => ({ image_url, mask_url, mode: 'express' }) },
  bria: { id: 'fal-ai/bria/eraser', usd: 0.04, body: (image_url, mask_url) => ({ image_url, mask_url }) },
};
const CATEGORIES = ['sofa', 'armchair', 'coffee_table', 'dining_table', 'chair', 'bed', 'lamp', 'rug', 'shelf', 'other'];
const TARGET_CATEGORIES = ['sofa', 'armchair', 'coffee_table', 'dining_table', 'chair'];
const WORDS = { sofa: 'the sofa', armchair: 'the armchair', coffee_table: 'the coffee table', dining_table: 'the dining table', chair: 'the dining chairs' };
const FRAME = 'Edit this photo in place: keep the exact same camera position, framing, zoom and field of view.';
const PRODUCT = 'The second image shows the product: reproduce its shape, proportions, colour, material and legs faithfully, and do not change the product\'s design.';
const KEEP = 'Keep everything else in the photo exactly as it is: the walls, the windows and the view outside, the floor, the ceiling, the lighting and shadows, and the camera angle. Do not move or zoom the camera.';

const CATALOG_FILE = path.join(ROOT, 'catalog', 'items.json');
const LOCAL = path.join(ROOT, 'catalog', '_local');
const SCENES_FILE = path.join(ROOT, 'apartments', APT, 'scenes.json');
const PANOS = path.join(ROOT, 'apartments', APT, 'panos', 'balanced');
const LEDGER = path.join(ROOT, 'apartments', APT, '_local', 'ledger.json');
const SCAN_FILE = path.join(OUT, 'scan.json');
const SPEND_FILE = path.join(OUT, 'spend.json');

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const writeJson = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o, null, 2) + '\n'); };
const b64 = (s) => Buffer.from(s.slice(s.indexOf(',') + 1), 'base64');
const toDataUrl = (buf, mime = 'image/jpeg') => `data:${mime};base64,${buf.toString('base64')}`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const log = (m) => console.log('  ' + m);

/* ── spend: this probe's own ceiling on top of the ledger's cap ───────────────────────────────────────────────────────── */
function loadSpend() {
  const s = fs.existsSync(SPEND_FILE) ? readJson(SPEND_FILE) : { budget: BUDGET, settled: 0, rows: [] };
  s.budget = BUDGET; s.reserved = 0;
  return s;
}
function saveSpend(s) { writeJson(SPEND_FILE, { budget: s.budget, settled: round(s.settled), rows: s.rows }); }
/** Reserve one paid call. Returns { settle(usd, patch), fail(err, usd) }. Throws before any money moves when a ceiling is reached. */
function paid(ctx, row, reserve) {
  const { ledger, spend } = ctx;
  if (ledger.total() + reserve > ledger.cap) throw new Error(`the ledger's cap of $${ledger.cap} would be passed (at $${round(ledger.total())})`);
  if (spend.settled + spend.reserved + reserve > spend.budget) throw new Error(`the probe's budget of $${spend.budget} would be passed (settled $${round(spend.settled)})`);
  const id = ledger.reserve({ ts: new Date().toISOString(), apartment: APT, ...row, reserved_usd: reserve, settled_usd: null, status: 'reserved', probe: 'replace' });
  spend.reserved += reserve;
  const t0 = Date.now();
  return {
    settle(usd, patch = {}) {
      ledger.settle(id, usd, { status: 'settled', seconds: round((Date.now() - t0) / 1000, 1), ...patch });
      spend.reserved -= reserve; spend.settled += usd; spend.rows.push({ ts: new Date().toISOString(), op: row.op, usd: round(usd, 4) }); saveSpend(spend);
      return usd;
    },
    fail(err, usd = 0) {
      ledger.settle(id, usd, { status: 'failed', error: String(err && err.message || err).slice(0, 200), seconds: round((Date.now() - t0) / 1000, 1) });
      spend.reserved -= reserve; spend.settled += usd; saveSpend(spend);
    },
  };
}

/* ── geometry: tools/pano-geometry.mjs, bound to this tool's view size ──────────────────────────────────────────────── */
async function loadPano(asset) {
  const file = path.join(PANOS, asset + '.webp');
  if (!fs.existsSync(file)) throw new Error('no pano ' + file);
  return G.loadPano(sharp, file);
}
const render = (pano, yaw, pitch, hfov, w, h) => G.render(pano, yaw, pitch, hfov, w, h);
const direction = (x, y, v) => G.direction(x, y, v, W, H);
const boxOnSphere = (box, v) => G.boxOnSphere(box, v, W, H);
const frameView = (dirs, factor) => G.frameView(dirs, factor, W, H, { min: ZOOM.min, max: ZOOM.max });

/* ── images: jpeg, overlays, masks, the ring ──────────────────────────────────────────────────────────────────────────── */
const toJpeg = (rgb, w = W, h = H) => sharp(rgb, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 90 }).toBuffer();
const rawOf = (buf, w, h) => sharp(buf).resize(w, h, { fit: 'fill' }).removeAlpha().raw().toBuffer();
async function drawBoxes(jpg, items, file) {
  const rects = items.map((it, i) => {
    const b = it.box_2d; const x = (b[1] / 1000) * W, y = (b[0] / 1000) * H, w = ((b[3] - b[1]) / 1000) * W, h = ((b[2] - b[0]) / 1000) * H;
    const col = TARGET_CATEGORIES.includes(it.category) ? '#ff3b3b' : '#ffd23b';
    const poly = it.mask ? `<polygon points="${it.mask.map(([px, py]) => `${((px / 1000) * W).toFixed(1)},${((py / 1000) * H).toFixed(1)}`).join(' ')}" fill="${col}" fill-opacity="0.18" stroke="${col}" stroke-width="1.5"/>` : '';
    return `${poly}<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="none" stroke="${col}" stroke-width="3"/><text x="${(x + 6).toFixed(1)}" y="${(y + 24).toFixed(1)}" font-family="sans-serif" font-size="22" font-weight="700" fill="#fff" stroke="#000" stroke-width="1">${i + 1} ${esc(it.category)}</text>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${rects}</svg>`;
  await sharp(jpg).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).jpeg({ quality: 88 }).toFile(file);
}
/** The share of the picture OUTSIDE the mask (widened by 12 px at half-res, so the piece's own edge and shadow do not count)
    that changed: what the edit touched beyond the piece. Free, the browser's ring test generalised. */
async function collateral(aJpg, bJpg, m) {
  const hw = W >> 1, hh = H >> 1;
  const a = await rawOf(aJpg, hw, hh), b = await rawOf(bJpg, hw, hh);
  const small = new Uint8Array(hw * hh);
  for (let y = 0; y < hh; y++) for (let x = 0; x < hw; x++) small[y * hw + x] = m[2 * y * W + 2 * x];
  const wide = dilate(small, hw, hh, 12);
  let n = 0, changed = 0;
  for (let i = 0; i < wide.length; i++) {
    if (wide[i]) continue;
    n++;
    const k = i * 3;
    if (Math.max(Math.abs(a[k] - b[k]), Math.abs(a[k + 1] - b[k + 1]), Math.abs(a[k + 2] - b[k + 2])) > RING.thr) changed++;
  }
  return n ? round(changed / n, 3) : 0;
}
const readMask = async (file) => new Uint8Array((await sharp(file).raw().toBuffer()).map((v) => (v > 127 ? 1 : 0)));
const maskPng = (m, w, h) => sharp(Buffer.from(m.map((v) => (v ? 255 : 0))), { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
async function maskOverlay(rgb, m, file) {
  const o = Buffer.from(rgb);
  for (let i = 0; i < m.length; i++) if (m[i]) { o[i * 3] = Math.min(255, o[i * 3] * 0.45 + 140); o[i * 3 + 1] *= 0.45; o[i * 3 + 2] *= 0.45; }
  await sharp(o, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 85 }).toFile(file);
}
/** The share of the half-res border ring that differs (the browser's test: 0–5.5 % held, 16–30 % re-framed). */
async function ringShare(aJpg, bJpg) {
  const hw = W >> 1, hh = H >> 1, r = RING.ring >> 1;
  const a = await rawOf(aJpg, hw, hh), b = await rawOf(bJpg, hw, hh);
  let n = 0, changed = 0;
  for (let y = 0; y < hh; y++) for (let x = 0; x < hw; x++) {
    if (x >= r && x < hw - r && y >= r && y < hh - r) continue;
    const i = (y * hw + x) * 3; n++;
    if (Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])) > RING.thr) changed++;
  }
  return n ? round(changed / n, 3) : 0;
}

/* ── the vision calls (OpenRouter, the handler's model, JSON mode, the real cost when reported) ─────────────────────── */
async function vision(env, system, parts, { maxTokens = 2500, reasoning = 200, title = 'probe' } = {}) {
  const res = await chatFetch(env)('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.OPENROUTER_API_KEY, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://habait.ai', 'X-Title': 'Habait Tour360 (' + title + ')' },
    body: JSON.stringify({ model: TEXT_MODEL, temperature: 0, max_tokens: maxTokens, reasoning: { max_tokens: reasoning }, response_format: { type: 'json_object' }, usage: { include: true }, messages: [{ role: 'system', content: system }, { role: 'user', content: parts }] }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`vision HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const text = json.choices?.[0]?.message?.content || '';
  let parsed;
  try { parsed = JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')); } catch { throw new Error('vision returned no JSON: ' + text.slice(0, 160)); }
  const cost = Number(json.usage?.cost);
  return { parsed, cost: Number.isFinite(cost) && cost > 0 ? cost : null, finish: json.choices?.[0]?.finish_reason || null };
}

const DETECT_SYSTEM = `You find the furniture in a photo of a room (a rendering of an apartment). Return ONLY a JSON object:
{"items":[{"label":"short name","category":"one of sofa, armchair, coffee_table, dining_table, chair, bed, lamp, rug, shelf, other","box_2d":[ymin,xmin,ymax,xmax],"mask":[[x,y],[x,y],...]}]}
All coordinates are normalized to 0-1000 of the image. "box_2d" is the piece's bounding box. "mask" is the piece's outline: a polygon
of 10 to 40 points in order around its silhouette, following the actual shape (the backrest, the seat, the legs), not the box.
One entry per piece: each dining chair, each armchair and each table is its own entry; a corner or sectional sofa is ONE entry;
a bar stool is a "chair"; a side table, a bedside table, a desk, a TV unit or a kitchen island is "other". List only pieces that
are at least partly visible, including pieces cut by the edge of the photo. Omit kitchen cabinets, appliances, doors, curtains,
wall art and plants.`;
async function detect(ctx, dataUrl, what) {
  const t = paid(ctx, { op: 'probe_scan', what }, TEXT_USD);
  try {
    const { parsed, cost, finish } = await vision(ctx.env, DETECT_SYSTEM, [{ type: 'text', text: 'Find the furniture in this photo.' }, { type: 'image_url', image_url: { url: dataUrl } }], { maxTokens: 9000, reasoning: 200, title: 'replace probe scan' });
    const items = (Array.isArray(parsed.items) ? parsed.items : []).map((it) => {
      const b = Array.isArray(it.box_2d) && it.box_2d.length === 4 && it.box_2d.every((n) => Number.isFinite(n)) ? it.box_2d.map((n) => clamp(Number(n), 0, 1000)) : null;
      const poly = Array.isArray(it.mask) ? it.mask.filter((p) => Array.isArray(p) && p.length === 2 && p.every((n) => Number.isFinite(n))).map((p) => [clamp(Number(p[0]), 0, 1000), clamp(Number(p[1]), 0, 1000)]) : [];
      return b && b[2] > b[0] && b[3] > b[1] ? { label: String(it.label || '').slice(0, 40), category: CATEGORIES.includes(it.category) ? it.category : 'other', box_2d: b, mask: poly.length >= 3 ? poly : null } : null;
    }).filter(Boolean);
    const usd = t.settle(cost ?? TEXT_USD, { items: items.length, finish });
    return { items, usd, finish };
  } catch (e) { t.fail(e); throw e; }
}

/* The replace judge lives in the handler since T16b (`replaceJudge`); the probe reserves and settles around it. */
async function replaceJudge(ctx, cropDataUrl, resultDataUrl, box, item, count) {
  const t = paid(ctx, { op: 'probe_judge', item: item.id }, JUDGE_USD);
  try {
    const j = await HANDLER.replaceJudge(ctx.env, cropDataUrl, resultDataUrl, box, item, count);
    const out = { original_present: j.original_present, product_present: j.product_present, product_box: j.product_box, count: j.count, rest_unchanged: j.rest_unchanged, note: j.note, placed: j.placed, held: j.held };
    out.usd = t.settle(j.cost ?? JUDGE_USD, out);
    return out;
  } catch (e) { t.fail(e); throw e; }
}

/* ── the paid image steps ──────────────────────────────────────────────────────────────────────────────────────────── */
async function fetchImage(url) {
  if (url.startsWith('data:')) return b64(url);
  const r = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error('result fetch HTTP ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}
async function erase(ctx, cropDataUrl, maskDataUrl, item, which = 'finegrain') {
  const ERASER = ERASERS[which];
  if (!ERASER) throw new Error('unknown eraser ' + which);
  const t = paid(ctx, { op: 'probe_erase', model: ERASER.id, item: item.id }, ERASER.usd);
  try {
    const res = await fetch('https://fal.run/' + ERASER.id, { method: 'POST', headers: { Authorization: 'Key ' + ctx.env.FAL_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(ERASER.body(cropDataUrl, maskDataUrl)), signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new Error(`eraser HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json = await res.json();
    const img = json.image || json.images?.[0];
    if (!img?.url) throw new Error('eraser returned no image');
    const buf = await fetchImage(img.url);
    const jpg = await sharp(buf).resize(W, H, { fit: 'fill' }).jpeg({ quality: 92 }).toBuffer();
    const usd = t.settle(ERASER.usd, { eraser: which, result_size: [img.width || null, img.height || null] });
    return { jpg, usd };
  } catch (e) { t.fail(e); throw e; }
}
async function place(ctx, clearedDataUrl, prompt, referenceDataUrl, item) {
  const t = paid(ctx, { op: 'probe_place', model: MODELS.nb2.id, item: item.id, prompt_en: prompt }, MODELS.nb2.reserve);
  try {
    const r = await edit(ctx.env, 'nb2', clearedDataUrl, prompt, fetch, referenceDataUrl);
    const jpg = await sharp(b64(r.dataUrl)).resize(W, H, { fit: 'fill' }).jpeg({ quality: 92 }).toBuffer();
    const usd = t.settle(MODELS.nb2.usd, { result_size: [r.width, r.height], seed: r.seed });
    return { jpg, usd };
  } catch (e) { t.fail(e); throw e; }
}
async function likenessOf(ctx, referenceDataUrl, resultDataUrl, item) {
  const t = paid(ctx, { op: 'probe_likeness', item: item.id }, LIKENESS_USD);
  try { const l = await likeness(ctx.env, referenceDataUrl, resultDataUrl); l.usd = t.settle(LIKENESS_USD, { found: l.found, score: l.score, why: l.why }); return l; } catch (e) { t.fail(e); throw e; }
}
function where(box) {
  const cx = (box[1] + box[3]) / 2000, cy = (box[0] + box[2]) / 2000;
  const h = cx < 0.36 ? 'left' : cx > 0.64 ? 'right' : 'centre', v = cy < 0.4 ? 'upper' : cy > 0.7 ? 'lower' : 'middle';
  return v === 'middle' && h === 'centre' ? 'centre' : `${v} ${h}`;
}
function placePrompt(category, item, box, count) {
  const size = item.size_cm ? ` It is about ${item.size_cm.w} cm wide, ${item.size_cm.d} cm deep and ${item.size_cm.h} cm high.` : '';
  if (category === 'chair') return `${FRAME} The first image shows a dining area: the ${count} dining chairs that stood around the table were removed and the table stayed. Put ${count} chairs around the table where the removed chairs stood, in the same arrangement, each one exactly the product shown in the second image: ${item.name}, ${item.description_en}.${size} Each chair rests on the floor, at a realistic size for the table, in the photo's perspective, lit like the room with soft natural shadows. The table and everything on it stay exactly as they are. ${PRODUCT} ${KEEP}`;
  return `${FRAME} The first image shows a room: ${WORDS[category]} that stood in the ${where(box)} of the photo was removed, and that spot on the floor is now empty. Put the product shown in the second image in that empty spot: ${item.name}, ${item.description_en}.${size} It stands on the floor exactly where the removed piece stood, facing the same way the removed piece faced, at a realistic size for this room and in the photo's perspective, lit like the room with a soft natural shadow. ${PRODUCT} ${KEEP}`;
}

/* ── context ───────────────────────────────────────────────────────────────────────────────────────────────────────── */
function context({ needKeys = true } = {}) {
  const env = loadEnv(HARNESS);
  if (!env.TOUR_EDIT_CODE) env.TOUR_EDIT_CODE = crypto.randomBytes(9).toString('base64url'); // this run's own code; never printed
  const doc = readJson(CATALOG_FILE);
  const catalog = catalogIndex(doc);
  if (needKeys && !describe(env, catalog).configured) { console.error('replace-probe: FAL_KEY or OPENROUTER_API_KEY is missing from the root .env'); process.exit(1); }
  const scenes = readJson(SCENES_FILE).scenes;
  fs.mkdirSync(OUT, { recursive: true });
  return { env, doc, catalog, scenes, ledger: fileLedger(LEDGER), spend: loadSpend() };
}
const loadScan = () => (fs.existsSync(SCAN_FILE) ? readJson(SCAN_FILE) : { when: null, views: [], pieces: [] });

/* ── step 1: the scan ──────────────────────────────────────────────────────────────────────────────────────────────── */
async function scan() {
  const dry = has('--dry');
  const ctx = context({ needKeys: !dry });
  const only = arg('--scenes', '') ? arg('--scenes', '').split(',') : ctx.scenes.map((s) => s.id);
  const scanDir = path.join(OUT, 'scan');
  fs.mkdirSync(scanDir, { recursive: true });
  const doc = loadScan();
  let usd = 0;
  for (const scene of ctx.scenes) {
    if (!only.includes(scene.id)) continue;
    if (!has('--force') && doc.views.some((v) => v.scene === scene.id)) { console.log(`${scene.id}: already scanned (--force to redo)`); continue; }
    const t0 = Date.now();
    const pano = await loadPano(scene.asset);
    const views = SCAN.yaws.map((k) => ({ scene: scene.id, k, yaw: round(norm((scene.heading || 0) + k), 2), pitch: SCAN.pitch, hfov: SCAN.hfov, file: `scan/${scene.id}-${k}.jpg` }));
    const jpgs = await Promise.all(views.map(async (v) => { const jpg = await toJpeg(render(pano, v.yaw, v.pitch, v.hfov, W, H)); fs.writeFileSync(path.join(OUT, v.file), jpg); return jpg; }));
    if (dry) { console.log(`${scene.id}: 4 views rendered ($0) in ${((Date.now() - t0) / 1000).toFixed(1)}s`); continue; }
    const found = await Promise.all(views.map(async (v, i) => {
      const det = await detect(ctx, toDataUrl(jpgs[i]), v.file);
      usd += det.usd;
      const items = det.items.map((it, n) => ({ ...it, id: `${scene.id}-${v.k}-${n + 1}`, scene: scene.id, view: { yaw: v.yaw, pitch: v.pitch, hfov: v.hfov, file: v.file }, ...boxOnSphere(it.box_2d, v), finish: det.finish }));
      await drawBoxes(jpgs[i], items, path.join(OUT, v.file.replace('.jpg', '-boxes.jpg')));
      return { view: { ...v, boxes: v.file.replace('.jpg', '-boxes.jpg'), usd: round(det.usd, 4), finish: det.finish }, items };
    }));
    doc.views = doc.views.filter((v) => v.scene !== scene.id).concat(found.map((f) => f.view));
    doc.pieces = doc.pieces.filter((p) => p.scene !== scene.id).concat(found.flatMap((f) => f.items.map((it) => ({ id: it.id, scene: it.scene, label: it.label, category: it.category, box_2d: it.box_2d, mask: it.mask, view: it.view, centre: it.centre.map((c) => round(c, 5)), corners: it.corners.map((d) => d.map((c) => round(c, 5))), area: round(it.area, 5), finish: it.finish }))));
    doc.when = new Date().toISOString();
    writeJson(SCAN_FILE, doc);
    const counts = {};
    for (const f of found) for (const it of f.items) counts[it.category] = (counts[it.category] || 0) + 1;
    console.log(`${scene.id}: ${found.reduce((n, f) => n + f.items.length, 0)} pieces — ${Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(', ') || 'none'} — $${round(found.reduce((t, f) => t + f.view.usd, 0), 4)} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
  if (!dry) { dedupe(doc); writeJson(SCAN_FILE, doc); console.log(`scan: ${doc.pieces.length} pieces (${doc.pieces.filter((p) => !p.dup).length} after dedupe) over ${doc.views.length} views · this step $${round(usd, 4)} · probe settled $${round(ctx.spend.settled)} of $${ctx.spend.budget} · ledger $${round(ctx.ledger.total())} of $${ctx.ledger.cap}`); }
}
/** Pieces of one category seen twice from neighbouring views (centres within 10°): keep the one nearer its own view's centre. */
function dedupe(doc) {
  for (const p of doc.pieces) { p.dup = false; p.offCentre = angleBetween(p.centre, direction(W / 2, H / 2, p.view)); }
  for (let i = 0; i < doc.pieces.length; i++) for (let j = i + 1; j < doc.pieces.length; j++) {
    const a = doc.pieces[i], b = doc.pieces[j];
    if (a.scene !== b.scene || a.category !== b.category || a.dup || b.dup) continue;
    if (angleBetween(a.centre, b.centre) < 10) (a.offCentre <= b.offCentre ? b : a).dup = true;
  }
}

/* ── step 2: one piece through both engines ────────────────────────────────────────────────────────────────────────── */
function pickTarget(doc, category) {
  const live = doc.pieces.filter((p) => !p.dup);
  if (category === 'chair') {
    // the set: every chair in the view that holds the largest dining table (fallback: the view with the most chairs)
    const table = live.filter((p) => p.category === 'dining_table').sort((a, b) => b.area - a.area)[0];
    const inView = (v) => doc.pieces.filter((p) => p.category === 'chair' && p.view.file === v);
    let chairs = table ? inView(table.view.file) : [];
    if (!chairs.length) { const by = {}; for (const p of live.filter((q) => q.category === 'chair')) (by[p.view.file] = by[p.view.file] || []).push(p); chairs = Object.values(by).sort((a, b) => b.length - a.length)[0] || []; }
    chairs = sameSet(chairs);
    return chairs.length ? { set: chairs, table: table && table.view.file === chairs[0].view.file ? table : null, scene: chairs[0].scene } : null;
  }
  const best = live.filter((p) => p.category === category).sort((a, b) => b.area - a.area)[0];
  return best ? { set: [best], table: null, scene: best.scene } : null;
}
/** The chairs of ONE set: a chair under a quarter of the largest chair's box is a far chair of another set (the scan saw two such
    beyond the kitchen's six), not one of these. */
function sameSet(chairs) {
  const boxArea = (c) => (c.box_2d[2] - c.box_2d[0]) * (c.box_2d[3] - c.box_2d[1]);
  const big = Math.max(0, ...chairs.map(boxArea));
  return chairs.filter((c) => boxArea(c) >= big * 0.25);
}
async function piece(category) {
  const ctx = context();
  const doc = loadScan();
  if (!doc.pieces.length) { console.error('replace-probe: run --scan first'); process.exit(2); }
  const engines = arg('--engines', 'erase,direct').split(',');
  const item = ctx.doc.items.find((it) => it.category === category);
  if (!item) { console.error('replace-probe: no catalog item of category ' + category); process.exit(2); }
  const dir = path.join(OUT, category);
  const recFile = path.join(dir, 'record.json');
  const record = fs.existsSync(recFile) ? readJson(recFile) : { category, item: item.id, name: item.name, when: new Date().toISOString(), engines: {}, usd: 0 };
  delete record.error;
  fs.mkdirSync(dir, { recursive: true });
  const target = pickTarget(doc, category);
  if (!target) { record.error = `no ${category} found in the scan of ${APT}`; writeJson(recFile, record); sheet(ctx); console.log(`SKIP ${category}: ${record.error}`); return; }
  const scene = ctx.scenes.find((s) => s.id === target.scene);
  const framing = target.table ? [...target.set, target.table] : target.set;
  const view = frameView(framing.flatMap((p) => p.corners), category === 'chair' ? ZOOM.set : ZOOM.single);
  console.log(`${category} → ${item.name}: ${target.set.length} piece(s) in ${scene.id} (${target.set.map((p) => p.label).join(', ')}) · zoom yaw ${view.yaw} pitch ${view.pitch} hfov ${view.hfov}`);
  let cropJpg, zoom, box, maskInfo, maskM;
  if (!has('--force') && record.crop && fs.existsSync(path.join(dir, 'crop.jpg')) && fs.existsSync(path.join(dir, 'mask.png')) && record.box) {
    cropJpg = fs.readFileSync(path.join(dir, 'crop.jpg')); box = record.box; maskInfo = record.mask; zoom = record.zoom;
    maskM = await readMask(path.join(dir, 'mask.png'));
    console.log('  crop and mask kept from the earlier run');
  } else {
    const pano = await loadPano(scene.asset);
    const rgb = render(pano, view.yaw, view.pitch, view.hfov, W, H);
    cropJpg = await toJpeg(rgb);
    fs.writeFileSync(path.join(dir, 'crop.jpg'), cropJpg);
    // re-detect on the zoomed crop for a precise outline
    const det = await detect(ctx, toDataUrl(cropJpg), `${category}/crop.jpg`);
    record.usd += det.usd;
    const cands = det.items.filter((it) => it.category === category);
    const centreDist = (it) => Math.hypot((it.box_2d[1] + it.box_2d[3]) / 2 - 500, (it.box_2d[0] + it.box_2d[2]) / 2 - 500);
    const chosen = category === 'chair' ? sameSet(cands) : cands.sort((a, b) => (b.box_2d[2] - b.box_2d[0]) * (b.box_2d[3] - b.box_2d[1]) / (1 + centreDist(b) / 400) - (a.box_2d[2] - a.box_2d[0]) * (a.box_2d[3] - a.box_2d[1]) / (1 + centreDist(a) / 400)).slice(0, 1);
    await drawBoxes(cropJpg, det.items, path.join(dir, 'crop-boxes.jpg'));
    if (!chosen.length) { record.error = `the zoomed crop shows no ${category} to the vision model`; record.zoom = view; writeJson(recFile, record); sheet(ctx); console.log('FAIL ' + record.error); process.exit(1); }
    box = [Math.min(...chosen.map((c) => c.box_2d[0])), Math.min(...chosen.map((c) => c.box_2d[1])), Math.max(...chosen.map((c) => c.box_2d[2])), Math.max(...chosen.map((c) => c.box_2d[3]))];
    const toPx = (poly) => poly.map(([x, y]) => [(x / 1000) * W, (y / 1000) * H]);
    const boxPoly = (b) => [[(b[1] / 1000) * W, (b[0] / 1000) * H], [(b[3] / 1000) * W, (b[0] / 1000) * H], [(b[3] / 1000) * W, (b[2] / 1000) * H], [(b[1] / 1000) * W, (b[2] / 1000) * H]];
    const polys = [], fits = []; let kind = 'polygon';
    for (const c of chosen) {
      const f = fitPolygon(c.mask, c.box_2d);
      if (f) { polys.push(toPx(f.poly)); fits.push(round(f.fit, 2)); } else { polys.push(boxPoly(c.box_2d)); fits.push(0); kind = 'box'; }
    }
    const m = rasterMask(polys, W, H, MASK_PAD);
    fs.writeFileSync(path.join(dir, 'mask.png'), await maskPng(m.m, W, H));
    await maskOverlay(rgb, m.m, path.join(dir, 'mask-over.jpg'));
    maskInfo = { kind, pieces: chosen.length, fraction: round(m.fraction, 3), labels: chosen.map((c) => c.label), fits };
    maskM = m.m;
    zoom = view;
    Object.assign(record, { scene: scene.id, zoom, box, mask: maskInfo, crop: `${category}/crop.jpg`, scanPieces: target.set.map((p) => p.id), detectUsd: det.usd });
    writeJson(recFile, record);
    console.log(`  zoomed crop ${cropJpg.length >> 10} KB · ${chosen.length} ${category} outlined (${kind}, ${Math.round(m.fraction * 100)} % of the crop)`);
  }
  const cropUrl = toDataUrl(cropJpg);
  const maskUrl = toDataUrl(fs.readFileSync(path.join(dir, 'mask.png')), 'image/png');
  const reference = toDataUrl(fs.readFileSync(path.join(LOCAL, item.image)));
  const count = maskInfo.pieces;
  for (const engine of engines) {
    if (record.engines[engine] && !record.engines[engine].error && !has('--force')) {
      const kept = record.engines[engine];
      if (kept.result && fs.existsSync(path.join(OUT, kept.result))) kept.collateral = await collateral(cropJpg, fs.readFileSync(path.join(OUT, kept.result)), maskM);
      console.log(`  ${engine}: kept from the earlier run (collateral ${Math.round((kept.collateral || 0) * 100)} %)`);
      continue;
    }
    const t0 = Date.now();
    const e = { usd: 0, seconds: 0, error: null };
    record.engines[engine] = e;
    try {
      let resultJpg;
      if (engine === 'erase' || engine === 'erase-bria') {
        const er = await erase(ctx, cropUrl, maskUrl, item, engine === 'erase-bria' ? 'bria' : 'finegrain');
        e.usd += er.usd; fs.writeFileSync(path.join(dir, `${engine}-cleared.jpg`), er.jpg); e.cleared = `${category}/${engine}-cleared.jpg`;
        e.eraseSeconds = round((Date.now() - t0) / 1000, 1);
        e.prompt = placePrompt(category, item, box, count);
        const pl = await place(ctx, toDataUrl(er.jpg), e.prompt, reference, item);
        e.usd += pl.usd; resultJpg = pl.jpg;
      } else if (engine === 'direct') {
        const instruction = `replace ${WORDS[category]} with ${item.name}`;
        const r = await handleEdit({ code: ctx.env.TOUR_EDIT_CODE, apartment: APT, scene: scene.id, lang: 'en', crop: cropUrl, view: zoom, instruction, attempt: 1, item: item.id, reference }, ctx.env, ctx.ledger, { log, catalog: ctx.catalog });
        e.usd += r.usd || 0; ctx.spend.settled += r.usd || 0; ctx.spend.rows.push({ ts: new Date().toISOString(), op: 'live_edit (direct)', usd: round(r.usd || 0, 4) }); saveSpend(ctx.spend);
        if (!r.ok) throw new Error('the handler refused: ' + r.reason);
        e.prompt = r.prompt; e.model = r.model;
        resultJpg = await sharp(b64(r.image)).resize(W, H, { fit: 'fill' }).jpeg({ quality: 92 }).toBuffer();
      } else throw new Error('unknown engine ' + engine);
      fs.writeFileSync(path.join(dir, `${engine}-result.jpg`), resultJpg);
      e.result = `${category}/${engine}-result.jpg`;
      e.ring = await ringShare(cropJpg, resultJpg);
      e.collateral = await collateral(cropJpg, resultJpg, maskM);
      const j = await replaceJudge(ctx, cropUrl, toDataUrl(resultJpg), box, item, count);
      e.usd += j.usd; e.judge = j;
      const l = await likenessOf(ctx, reference, toDataUrl(resultJpg), item);
      e.usd += l.usd; e.likeness = { score: l.score, why: l.why };
      e.verdict = e.ring < RING.max && !j.original_present && j.product_present && j.placed ? 'PASS' : 'FAIL';
      e.why = [e.ring >= RING.max ? `ring ${Math.round(e.ring * 100)} %` : null, j.original_present ? 'the old piece is still there' : null, !j.product_present ? 'no product in the result' : !j.placed ? 'the product stands elsewhere' : null].filter(Boolean).join('; ') || 'the old piece gone, the product in its place, the frame held';
    } catch (err) {
      e.error = err instanceof EditError ? `${err.status} ${err.reason}: ${err.message}` : String(err && err.message || err).slice(0, 240);
      e.verdict = 'ERROR';
      console.error(`  ${engine}: ${e.error}`);
    }
    e.seconds = round((Date.now() - t0) / 1000, 1);
    record.usd = round(Object.values(record.engines).reduce((t, x) => t + (x.usd || 0), 0) + (record.detectUsd || 0));
    writeJson(recFile, record);
    console.log(`  ${engine}: ${e.verdict}${e.error ? '' : ` — ${e.why} · ring ${Math.round(e.ring * 100)} % · collateral ${Math.round(e.collateral * 100)} % · rest ${e.judge.rest_unchanged}/3 · count ${e.judge.count ?? '—'} · likeness ${e.likeness.score}/3 (${e.likeness.why})`} · $${round(e.usd)} · ${e.seconds}s`);
  }
  sheet(ctx);
  console.log(`${category} done · $${record.usd} · probe settled $${round(ctx.spend.settled)} of $${ctx.spend.budget} · ledger $${round(ctx.ledger.total())} of $${ctx.ledger.cap}`);
}

/* ── the sheet and the report ──────────────────────────────────────────────────────────────────────────────────────── */
function sheet(ctx) {
  const doc = loadScan();
  const spend = loadSpend();
  const sections = [];
  for (const category of TARGET_CATEGORIES) {
    const recFile = path.join(OUT, category, 'record.json');
    if (!fs.existsSync(recFile)) continue;
    const rec = readJson(recFile);
    const item = ctx.doc.items.find((it) => it.id === rec.item);
    const photo = item ? path.relative(OUT, path.join(LOCAL, item.image)).split(path.sep).join('/') : '';
    const fig = (src, cap) => (src ? `<figure><a href="${src}"><img src="${src}" alt=""></a><figcaption>${cap}</figcaption></figure>` : '');
    const eng = (name) => {
      const e = rec.engines && rec.engines[name];
      if (!e) return '';
      if (e.error) return `<p class="v fail"><b>${name}</b>: ERROR — ${esc(e.error)}</p>`;
      return `<p class="v ${e.verdict === 'PASS' ? 'pass' : 'fail'}"><b>${name}</b>: ${e.verdict} — ${esc(e.why)} · ring ${Math.round(e.ring * 100)} % · collateral ${Math.round((e.collateral || 0) * 100)} % · rest unchanged ${e.judge.rest_unchanged}/3 · count ${e.judge.count ?? '—'} · likeness ${e.likeness.score}/3 (${esc(e.likeness.why)}) · $${round(e.usd)} · ${e.seconds}s<br><span class="note">judge: ${esc(e.judge.note)}</span></p><p class="prompt">${esc(e.prompt || '')}</p>`;
    };
    const names = Object.keys(rec.engines || {});
    const figs = names.flatMap((n) => { const e = rec.engines[n]; return n === 'direct' ? [fig(e.result, 'direct: one zoomed editor call')] : [fig(e.cleared, `${n}: the piece removed`), fig(e.result, `${n} → place: the result`)]; });
    sections.push(`<section><h2>${esc(category)} → ${esc(rec.name)} <small>${rec.error ? esc(rec.error) : `${esc(rec.scene)} · zoom yaw ${rec.zoom?.yaw} pitch ${rec.zoom?.pitch} hfov ${rec.zoom?.hfov} · mask ${esc(rec.mask?.kind || '')} over ${rec.mask?.pieces || 0} piece(s)`} · $${rec.usd}</small></h2>
<div class="row">${fig(rec.crop, 'the zoomed crop')}${fig(rec.crop ? `${category}/mask-over.jpg` : '', 'the mask (what the eraser removes)')}${fig(photo, 'the product (linked from catalog/_local/)')}${figs.join('')}</div>
${names.map(eng).join('')}</section>`);
  }
  const scanRows = ctx.scenes.map((s) => {
    const views = doc.views.filter((v) => v.scene === s.id);
    if (!views.length) return '';
    const pieces = doc.pieces.filter((p) => p.scene === s.id && !p.dup);
    const counts = {}; for (const p of pieces) counts[p.category] = (counts[p.category] || 0) + 1;
    return `<tr><td>${esc(s.id)}</td><td>${Object.entries(counts).map(([k, n]) => `${esc(k)} ${n}`).join(', ') || '—'}</td><td>${views.map((v) => `<a href="${v.boxes}">${v.k}°</a>`).join(' · ')}</td><td>$${round(views.reduce((t, v) => t + (v.usd || 0), 0), 4)}</td></tr>`;
  }).join('');
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Tour360 — the point-to-replace probe (T14c)</title>
<style>body{font:14px/1.5 system-ui,sans-serif;margin:24px;background:#0A1330;color:#fff}h1{font-size:20px}h2{font-size:16px;margin:28px 0 8px}small{font-weight:400;color:#bcd}.row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}figure{margin:0}img{width:100%;height:auto;border-radius:6px;background:#000}figcaption{color:#bcd;font-size:12px;margin-top:4px}.v{margin:10px 0 2px}.pass b{color:#7CF2A5}.fail b{color:#FF8A8A}.note{color:#bcd}.prompt{color:#9ab;font-size:12px;margin:0 0 6px}table{border-collapse:collapse;margin:8px 0 20px}td,th{border:1px solid #345;padding:4px 10px;text-align:start}a{color:#9cf}</style>
<h1>Tour360 — the point-to-replace probe (T14c, 2026-10-07). Both engines on the same pieces; the product photos are linked from the ignored folder and are not part of this evidence.</h1>
<p>Probe settled $${round(spend.settled)} of $${spend.budget}. Scan: ${doc.pieces.filter((p) => !p.dup).length} pieces over ${doc.views.length} views${doc.when ? ', ' + esc(doc.when) : ''}.</p>
<table><tr><th>scene</th><th>pieces found</th><th>views (boxes drawn)</th><th>usd</th></tr>${scanRows}</table>
${sections.join('\n')}</html>`;
  fs.writeFileSync(path.join(OUT, 'index.html'), html);
}
function report() {
  const ctx = context({ needKeys: false });
  sheet(ctx);
  const doc = loadScan();
  console.log(`scan: ${doc.pieces.filter((p) => !p.dup).length} pieces over ${doc.views.length} views`);
  console.log('category      item       engine  verdict  ring   coll.  gone  product  placed  rest  count  likeness  usd     seconds');
  let bad = 0;
  for (const category of TARGET_CATEGORIES) {
    const f = path.join(OUT, category, 'record.json');
    if (!fs.existsSync(f)) { console.log(`${category.padEnd(13)} — no record`); bad++; continue; }
    const r = readJson(f);
    if (r.error) { console.log(`${category.padEnd(13)} ${String(r.item).padEnd(10)} ${r.error}`); bad++; continue; }
    for (const [name, e] of Object.entries(r.engines || {})) {
      if (e.error) { console.log(`${category.padEnd(13)} ${String(r.item).padEnd(10)} ${name.padEnd(7)} ERROR    ${e.error}`); bad++; continue; }
      const j = e.judge;
      console.log(`${category.padEnd(13)} ${String(r.item).padEnd(10)} ${name.padEnd(7)} ${e.verdict.padEnd(8)} ${(Math.round(e.ring * 100) + '%').padEnd(6)} ${(Math.round((e.collateral || 0) * 100) + '%').padEnd(6)} ${(j.original_present ? 'no' : 'yes').padEnd(5)} ${(j.product_present ? 'yes' : 'no').padEnd(8)} ${(j.placed ? 'yes' : 'no').padEnd(7)} ${String(j.rest_unchanged).padEnd(5)} ${String(j.count ?? '—').padEnd(6)} ${(e.likeness.score + '/3').padEnd(9)} ${('$' + round(e.usd)).padEnd(7)} ${e.seconds}`);
      if (e.verdict !== 'PASS') bad++;
    }
  }
  const spend = loadSpend();
  console.log(`probe settled $${round(spend.settled)} of $${spend.budget} · ledger $${round(ctx.ledger.total())} of $${ctx.ledger.cap}`);
  process.exit(bad ? 1 : 0);
}

if (has('--scan')) await scan();
else if (has('--piece')) { const c = arg('--piece', ''); for (const cat of c === 'all' ? TARGET_CATEGORIES : [c]) { if (!TARGET_CATEGORIES.includes(cat)) { console.error('replace-probe: unknown category ' + cat); process.exit(2); } await piece(cat); } }
else if (has('--report')) report();
else { console.error('usage: replace-probe.mjs --scan [--scenes a,b] [--dry] | --piece <category|all> [--engines erase,direct] [--force] | --report   (--out <dir> --budget 2)'); process.exit(2); }
