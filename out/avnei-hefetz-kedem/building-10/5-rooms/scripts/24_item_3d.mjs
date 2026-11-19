/* Step 24 (PAID, fal) - one piece of Eliran's pictures → an exact spec → a clean studio photo → a 3D model (GLB), with a choice of
   3D model for the bake-off. The chain is the Hatzav job's scripts/16_item_3d.mjs (2026-11-17, proven on 19 items), adapted:
   the crops come from 23_item_crops.py; the mesh stage takes --model hunyuan|tripo|meshy|rodin (same studio photo for all).
   Eliran 2026-11-18: «תבדוק בFAL איזה מודל יספק לך את התוצר הטוב ביותר שמתבסס על התמונות שהבאתי» — bake-off on the bed, then all
   pieces with his pick; hard cap $15 for this stage (his dialog answer).
   Every call: reserved in items/ledger/<id>.json BEFORE it is sent, settled after; a cached stage costs $0; a queued request is
   collected, never re-sent. Dry-run by default; --go sends. FAL_KEY by NAME (loadEnv), never printed.
   Usage: node scripts/24_item_3d.mjs <item-id> [--stage spec|studio|mesh|all] [--model hunyuan|tripo|meshy|rodin] [--go]       */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'file:///C:/RnD/Projects/3Dengine/pipeline/Habait/tour360/tools/file-ledger.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const ID = args.find((a) => !a.startsWith('--') && !['spec', 'studio', 'mesh', 'all', 'hunyuan', 'tripo', 'meshy', 'rodin'].includes(a));
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const GO = args.includes('--go');
const STAGE = opt('--stage', 'all');
const MODEL = opt('--model', 'hunyuan');
const CAP = 15;
const IT = path.join(ROOT, 'items');

const PIECES = {   // size from the sales sheet (geometry.json) where it is drawn, else ASSUMED from the picture
  bed_parents: { size: 'double bed 160 cm wide, 200 cm long; headboard about 125 cm high with wings (sheet box p-bed 160 x 200)',
    include: 'the whole bed: the winged channel-tufted headboard, the upholstered base, the mattress, the white sheets and two pillows, the grey duvet; no nightstands, no lamps',
    view: 'three-quarter view from the foot, slightly above, the whole bed in frame' },
  bed_single: { size: 'single bed 90 cm wide, 190 cm long, base about 45 cm high (sheet box m-bed 90 x 187)', include: 'the whole bed with its bedding; nothing else',
    view: 'three-quarter view from the foot, slightly above, the whole bed in frame' },
  nightstand: { size: 'about 45 cm wide, 40 cm deep, 50 cm high (sheet box p-night 42 x 46)', include: 'the nightstand only, nothing on it', view: 'three-quarter front view' },
  mushroom_lamp: { size: 'about 30 cm diameter, 40 cm high', include: 'the lamp only', view: 'side view at eye level' },
  sofa: { size: 'three-seat sofa about 220 cm wide, 95 cm deep, 80 cm high (the sheet draws an L of two 158 cm runs)', include: 'the whole sofa, its seat and back cushions; no throw pillows from other pieces',
    view: 'three-quarter front view from slightly above, the whole sofa in frame' },
  coffee_table: { size: 'round, about 100 cm diameter, 40 cm high (sheet circle r 52 cm)', include: 'the table only, nothing on it', view: 'three-quarter view from slightly above, the whole table in frame' },
  dining_table: { size: '162 cm long, 89 cm wide, 75 cm high (sheet box dining-table)', include: 'the table only, nothing on it, no chairs', view: 'three-quarter view from above, the whole table in frame' },
  dining_chair: { size: 'about 46 cm wide, 55 cm deep, 95 cm high', include: 'one chair only', view: 'three-quarter front view from slightly above, the whole chair in frame' },
  balcony_chair: { size: 'about 70 cm wide, 70 cm deep, 75 cm high', include: 'one armchair with its cushions', view: 'three-quarter front view from slightly above, the whole chair in frame' },
  balcony_table: { size: 'round top about 60 cm diameter, 72 cm high', include: 'the table only, nothing on it', view: 'three-quarter view from slightly above, the whole table in frame' },
  planter_agave: { size: 'planter about 40 cm diameter, 80 cm high; the agave about 70 cm across above it', include: 'the planter and the plant', view: 'side view at eye level, the whole planter and plant in frame' },
  plant_pachira: { size: 'pot about 35 cm diameter, 30 cm high; the plant about 100 cm high', include: 'the pot and the plant', view: 'side view at eye level, the whole plant in frame' },
};
const STUDIO_EP = 'fal-ai/nano-banana-pro/edit';
const SPEC_EP = 'openrouter/router/vision';
const MESH = {   // usd = what is reserved (unit-priced models: an estimate, read the real charge on fal's usage page)
  hunyuan: { endpoint: 'fal-ai/hunyuan-3d/v3.1/pro/image-to-3d', usd: 0.525, body: (u) => ({ input_image_url: u, enable_pbr: true, generate_type: 'Normal' }), glb: (o) => (o.model_glb || o.model_urls?.glb)?.url },
  tripo: { endpoint: 'tripo3d/p2/image-to-3d', usd: 0.8, body: (u) => ({ image_url: u, texture_quality: 'detailed', pbr: true }), glb: (o) => (o.model_mesh || o.model_urls?.pbr_model || o.model_urls?.glb)?.url },
  meshy: { endpoint: 'meshy/v7.1/image-to-3d', usd: 0.8, body: (u) => ({ image_url: u, enable_pbr: true, should_texture: true, target_polycount: 60000 }), glb: (o) => (o.model_glb || o.model_urls?.glb)?.url },
  rodin: { endpoint: 'fal-ai/hyper3d/rodin/v2.5', usd: 0.4, body: (u) => ({ image_urls: [u], material: 'PBR', tier: 'Gen-2.5-High', geometry_file_format: 'glb' }), glb: (o) => (o.model_mesh || o.model_meshes?.[0])?.url },
};
const item = PIECES[ID]; const mesh = MESH[MODEL];
if (!item || !mesh) { console.error(`usage: <item> one of ${Object.keys(PIECES)} · --model one of ${Object.keys(MESH)}`); process.exit(2); }
const meta = JSON.parse(fs.readFileSync(path.join(IT, 'items.json'), 'utf8')).items.find((m) => m.id === ID);
const hash = (...xs) => { const h = crypto.createHash('sha256'); xs.forEach((x) => h.update(typeof x === 'string' ? x : JSON.stringify(x))); return h.digest('hex'); };
for (const d of ['specs', 'studio', 'glb', 'ledger']) fs.mkdirSync(path.join(IT, d), { recursive: true });
const LD = path.join(IT, 'ledger'), ledgerPath = path.join(LD, `${ID}.json`);
const ledger = fs.existsSync(ledgerPath) ? JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) : { cap_usd: CAP, item: ID, note: 'reserve before send, settle after', rows: [] };
const sumFile = (f) => JSON.parse(fs.readFileSync(f, 'utf8')).rows.reduce((t, r) => t + (r.status === 'failed-unbilled' ? 0 : (r.settled_usd ?? r.reserved_usd)), 0);
const spent = () => ledger.rows.reduce((t, r) => t + (r.status === 'failed-unbilled' ? 0 : (r.settled_usd ?? r.reserved_usd)), 0)
  + fs.readdirSync(LD).filter((f) => f.endsWith('.json') && f !== `${ID}.json`).reduce((t, f) => t + sumFile(path.join(LD, f)), 0);
const saveLedger = () => fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 1));
let env = null;
const H = () => { env ??= loadEnv('C:/RnD'); if (!env.FAL_KEY) throw new Error('FAL_KEY: missing (checked by name)'); return { Authorization: `Key ${env.FAL_KEY}` }; };

async function upload(file) {   // fal storage: some models take only a URL (Tripo refused a data URI on 2026-11-18)
  const ct = file.endsWith('.png') ? 'image/png' : 'image/jpeg';
  const r = await fetch('https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3', { method: 'POST', headers: { ...H(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_name: path.basename(file), content_type: ct }), signal: AbortSignal.timeout(60e3) });
  if (!r.ok) throw new Error(`upload initiate HTTP ${r.status}`);
  const d = await r.json();
  const p = await fetch(d.upload_url, { method: 'PUT', headers: { 'Content-Type': ct }, body: fs.readFileSync(file), signal: AbortSignal.timeout(120e3) });
  if (!p.ok) throw new Error(`upload PUT HTTP ${p.status}`);
  return d.file_url;
}
async function falQueue(endpoint, body, row) {
  const h = { ...H(), 'Content-Type': 'application/json' };
  let q = row.queue;
  if (!q) {
    const r = await fetch(`https://queue.fal.run/${endpoint}`, { method: 'POST', headers: h, body: JSON.stringify(body), signal: AbortSignal.timeout(120e3) });
    const t = await r.text();
    if (!r.ok) throw new Error(`submit HTTP ${r.status}: ${t.slice(0, 300)}`);
    const j = JSON.parse(t); q = { request_id: j.request_id, status_url: j.status_url, response_url: j.response_url }; row.queue = q; saveLedger();
  }
  const t0 = Date.now();
  for (;;) {
    if (Date.now() - t0 > 40 * 60e3) throw new Error(`timeout waiting for ${q.request_id} (collect later with the same command)`);
    await new Promise((ok) => setTimeout(ok, 5000));
    let s = {}; try { s = await (await fetch(q.status_url, { headers: h, signal: AbortSignal.timeout(30e3) })).json(); } catch { continue; }
    if (s.status === 'COMPLETED') break;
    if (s.status && !['IN_QUEUE', 'IN_PROGRESS'].includes(s.status)) throw new Error(`status ${JSON.stringify(s).slice(0, 300)}`);
  }
  const res = await fetch(q.response_url, { headers: h, signal: AbortSignal.timeout(60e3) }); const rt = await res.text();
  if (!res.ok) throw new Error(`result HTTP ${res.status}: ${rt.slice(0, 300)}`);
  return { request_id: q.request_id, out: JSON.parse(rt) };
}
async function paid(stage, endpoint, usd, inputsHash, mkBody, save) {
  const done = ledger.rows.find((r) => r.inputs_hash === inputsHash && r.status === 'settled' && r.out && fs.existsSync(r.out));
  console.log(JSON.stringify({ item: ID, stage, endpoint, usd, spent_before: +spent().toFixed(3), cap: CAP, cached: !!done, mode: GO ? 'GO' : 'dry-run' }));
  if (done) { console.log(`CACHED ${stage} - $0`); return done.out; }
  if (spent() + usd > CAP + 1e-9) { console.error(`REFUSED: ${spent().toFixed(3)} + ${usd} > cap ${CAP}`); process.exit(2); }
  if (!GO) return null;
  let row = ledger.rows.find((r) => r.inputs_hash === inputsHash && r.queue && r.status !== 'settled');
  if (!row) { row = { seq: ledger.rows.length + 1, at: new Date().toISOString(), item: ID, op: stage, model: endpoint, reserved_usd: usd, status: 'reserved', inputs_hash: inputsHash }; ledger.rows.push(row); saveLedger(); }
  const t0 = Date.now();
  try {
    const body = row.queue ? null : await mkBody();
    const { request_id, out } = await falQueue(endpoint, body, row);
    const file = await save(out);
    Object.assign(row, { status: 'settled', settled_usd: usd, request_id, seconds: (Date.now() - t0) / 1000, out: file }); saveLedger();
    console.log(`OK ${stage} ${((Date.now() - t0) / 1000).toFixed(0)} s → ${path.relative(ROOT, file)}`); return file;
  } catch (e) {
    const refused = /^submit HTTP 4\d\d/.test(String(e.message)) && !row.queue;
    Object.assign(row, { status: refused ? 'failed-unbilled' : 'failed', ...(refused ? { settled_usd: 0 } : {}), error: String(e.message).slice(0, 300), seconds: (Date.now() - t0) / 1000 }); saveLedger();
    console.error(`FAILED ${stage}: ${row.error}`); process.exit(1);
  }
}
const download = async (url, file) => { fs.writeFileSync(file, Buffer.from(await (await fetch(url, { signal: AbortSignal.timeout(600e3) })).arrayBuffer())); return file; };
const dataUri = (p) => `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;
const crop = path.join(ROOT, meta.crop);
const colourLine = meta.colours.map((c) => `${c.hex} (${Math.round(c.share * 100)}%)`).join(', ');

// --- 1. the spec: what exactly is in his picture (parts, materials, colours)
const SPEC_SYS = 'You are a senior furniture product analyst for a high-end interior visualisation studio. You read a reference render of ONE piece of furniture and write a precise manufacturing-grade description so another model can recreate exactly the same piece. Never invent a different design. Answer with the JSON object only.';
const SPEC_PROMPT = [`The image shows: ${meta.what}. Size: ${item.size}. Include: ${item.include}.`,
  `Dominant colours measured from the picture's pixels (they include light and shade; the background may leak in): ${colourLine}.`,
  'Return JSON: {"name": str, "parts": [{"part": str, "shape": str, "material": str, "finish": str, "colour_name": str, "colour_hex": str}], "details": [str],',
  '"studio_prompt": str (60-120 words, one paragraph, exactly this piece for a photoreal product photo: every part, material, weave or grain, colour with hex, proportions; no background or camera words)}'].join(' ');
const specFile = path.join(IT, 'specs', `${ID}.json`);
if (['all', 'spec'].includes(STAGE) || !fs.existsSync(specFile)) {
  const f = await paid('spec', SPEC_EP, 0.005, hash(SPEC_EP, SPEC_SYS, SPEC_PROMPT, fs.readFileSync(crop)),
    async () => ({ model: 'google/gemini-3.7-flash', system_prompt: SPEC_SYS, prompt: SPEC_PROMPT, image_urls: [dataUri(crop)], temperature: 0, max_tokens: 3000, reasoning: true }),
    async (out) => { const t = String(out.output || '').replace(/^```(json)?/m, '').replace(/```\s*$/m, '').trim();
      fs.writeFileSync(specFile, JSON.stringify({ item: ID, crop: meta.crop, measured: colourLine, size: item.size, spec: JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)) }, null, 1)); return specFile; });
  if (!f) process.exit(0);
}
const spec = JSON.parse(fs.readFileSync(specFile, 'utf8')).spec;
if (STAGE === 'spec') process.exit(0);

// --- 2. the studio photo: the same piece, complete, on white (his picture is the reference)
const STUDIO = [`Recreate exactly the same ${spec.name} shown in the reference image as a high-end catalogue product photograph.`, spec.studio_prompt,
  `Size: ${item.size}. Include ${item.include}.`, `Camera: ${item.view}. Seamless pure white studio background, soft large diffused light, a faint soft contact shadow only.`,
  'The complete object, nothing cropped, centred, nothing else in the picture: no walls, no floor objects, no props, no text, no logo.',
  'Keep the same design, proportions, materials and colours as the reference; photoreal, crisp material detail.'].join(' ');
const studioFile = path.join(IT, 'studio', `${ID}.png`);
if (['all', 'studio'].includes(STAGE) || !fs.existsSync(studioFile)) {
  const f = await paid('studio', STUDIO_EP, 0.15, hash(STUDIO_EP, STUDIO, fs.readFileSync(crop)),
    async () => ({ prompt: STUDIO, image_urls: [dataUri(crop)], num_images: 1, resolution: '2K', aspect_ratio: '1:1', output_format: 'png', seed: 7 }),
    async (out) => download(out.images[0].url, studioFile));
  if (!f) process.exit(0);
}
if (STAGE === 'studio') process.exit(0);

// --- 3. the 3D model by the chosen generator (the same studio photo for every model of the bake-off)
const glbFile = path.join(IT, 'glb', `${ID}__${MODEL}.glb`);
await paid(`mesh:${MODEL}`, mesh.endpoint, mesh.usd, hash(mesh.endpoint, fs.readFileSync(studioFile), JSON.stringify(mesh.body('x'))),
  async () => mesh.body(await upload(studioFile)),
  async (out) => { const u = mesh.glb(out); if (!u) throw new Error('no GLB in the answer: ' + Object.keys(out).join(',')); return download(u, glbFile); });
console.log(`DONE ${ID} ${MODEL}: spent ${spent().toFixed(3)} of ${CAP}`);
