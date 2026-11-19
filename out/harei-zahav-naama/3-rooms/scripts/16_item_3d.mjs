/* Step 16 - one furniture item from the developer's renders → an exact spec → a clean studio photo → a textured 3D model (GLB).
   Eliran 2026-11-17: «להשתמש בהם כרפרנס כדי לבקש ממודל של FAL לייצר לך בדיוק את אותם הפריטים … באותם צבעים»; pilot of 3 items, ≈ $2.5.
   Stages (each cached by its inputs hash; a cached stage costs $0 and is never re-sent):
     spec    fal openrouter/router/vision, model google/gemini-3.7-flash (RAINBOW's text model): the crops + the measured colours + the
             plan size → JSON spec (parts, materials, hex colours, proportions)                                      ≈ $0.005 booked
     studio  fal-ai/nano-banana-pro/edit 2K: the crops + the spec → the same item as a clean studio product photo on white  $0.15
     mesh    fal-ai/hunyuan-3d/v3.1/pro/image-to-3d, enable_pbr: the studio photo → GLB (PBR)                       $0.375 + $0.15
   Ledger items/ledger.json: reserved BEFORE each call, settled after; a call that would cross the cap is refused.
   Dry-run by default (prints what would be sent and booked). --go sends. FAL_KEY by NAME via loadEnv; never printed.
   Usage: node scripts/16_item_3d.mjs <item-id> [--go] [--stage spec|studio|mesh|all]                                     */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadEnv } from '../../../../../../Projects/3Dengine/pipeline/Habait/tour360/tools/file-ledger.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const ID = args.find((a) => !a.startsWith('--'));
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const GO = args.includes('--go');
const STAGE = opt('--stage', 'all');
const CAP = 90;   // Eliran 2026-11-18: ceiling raised to $90 for both versions (walkaround + 360)
const IT = path.join(ROOT, 'items');

// the pilot: which crops show the piece, its size from the plan (geometry.json) or ASSUMED, what is part of it
const PILOT = {
  sofa_modular: { crops: ['sofa_modular', 'sofa_front'], size: 'about 300 cm wide, 100 cm deep, 75 cm high (plan box l-sofa, VERIFIED width)',
    include: 'the three seat modules, the back and arm cushions, the two loose cushions (blush and ochre) and the white pleated throw',
    view: 'three-quarter front view from slightly above, the whole sofa in frame' },
  lounge_chair: { crops: ['lounge_chair'], size: 'about 70 cm wide, 80 cm deep, 70 cm high (plan box l-chair-rattan 70 x 70)',
    include: 'the chair only', view: 'three-quarter front view from slightly above, the whole chair in frame' },
  rattan_pendant: { crops: ['rattan_pendant'], size: 'about 55 cm diameter, 75 cm high (ASSUMED from the render)',
    include: 'the shade only, without the cord', view: 'side view at eye level, the whole shade in frame' },
  // 2026-11-18 (Eliran: «by the plan»): the sheet draws a CORNER sofa, 300 along the north wall + a 300 chaise along the east wall
  sofa_corner: { crops: ['sofa_modular', 'sofa_front'], size: 'a SYMMETRICAL L-shaped corner sectional: two equal sides, each 300 cm long and 100 cm deep, made of the same rounded seat modules (two seat modules on each side plus one square corner module), back cushions along both outer sides, one arm at each free end; 75 cm high; seen from above it is an L of 300 x 300 cm',
    include: 'the whole L with both equal sides, the blush and ochre cushions in the corner and the white pleated throw on one side',
    view: 'view from high above the open inner side of the L, at about 45 degrees, so both equal sides are fully visible, the corner at the back' },
  // round 2 (Eliran 2026-11-17: «I want you to use the pictures i sent you»): every movable piece of the renders
  dining_chair: { crops: ['dining_chair'], size: 'about 52 cm wide, 55 cm deep, 78 cm high', include: 'one chair only',
    view: 'three-quarter front view from slightly above, the whole chair in frame' },
  dining_table: { crops: ['dining_table'], size: '180 cm long, 90 cm wide, 75 cm high (plan box d-table)', include: 'the table only, nothing on it, no chairs',
    view: 'three-quarter view from above, the whole table in frame' },
  bar_stool: { crops: ['bar_stool'], size: 'about 45 cm wide, 45 cm deep, 90 cm high to the backrest, seat at 65 cm', include: 'one stool only',
    view: 'three-quarter front view, the whole stool in frame' },
  coffee_table: { crops: ['coffee_table'], size: '80 cm diameter, 40 cm high (plan box l-table-round)', include: 'the table only, nothing on it',
    view: 'three-quarter view from slightly above, the whole table in frame' },
  mushroom_lamp: { crops: ['mushroom_lamp'], size: 'about 20 cm diameter, 28 cm high', include: 'the lamp only', view: 'side view at eye level' },
  wall_sconce: { crops: ['wall_sconce'], size: 'about 22 cm diameter, 12 cm deep', include: 'the sconce only (wall plate and globe)',
    view: 'three-quarter front view' },
  vase_branches: { crops: ['vase_branches'], size: 'about 45 cm wide, 70 cm high with the branches', include: 'the glass vase and the olive branches',
    view: 'side view at eye level' },
  ribbed_vase: { crops: ['ribbed_vase'], size: 'about 18 cm diameter, 26 cm high', include: 'the vase only', view: 'side view at eye level' },
  paper_pendant: { crops: ['paper_pendant'], size: 'about 22 cm diameter, 45 cm high', include: 'the shade only, without the cord', view: 'side view at eye level' },
  kitchen_props: { crops: ['kitchen_props'], size: 'boards about 40 cm high, carafe 25 cm', include: 'the two walnut cutting boards leaning together and the glass carafe',
    view: 'three-quarter front view' },
  globe_lamp: { crops: ['globe_lamp'], size: 'about 25 cm diameter, 28 cm high', include: 'the lamp only', view: 'side view at eye level' },
  stone_bowl: { crops: ['stone_bowl'], size: 'about 35 cm diameter, 10 cm high', include: 'the bowl only, empty', view: 'three-quarter view from above' },
  kids_bed: { crops: ['kids_bed'], size: 'single bed 100 cm wide, 200 cm long, headboard 100 cm high (plan box s-bed)',
    include: 'the bed with its upholstered headboard, the linen bedding, the rust cushion and the clay throw; no toy',
    view: 'three-quarter view from the foot, slightly above, the whole bed in frame' },
  nightstand: { crops: ['nightstand'], size: 'about 45 cm wide, 35 cm deep, 50 cm high', include: 'the nightstand only, nothing on it',
    view: 'three-quarter front view' },
  paper_lantern: { crops: ['paper_lantern'], size: 'about 70 cm diameter, 30 cm high', include: 'the lantern only, without the cord',
    view: 'side view slightly from below' },
  kids_rug: { crops: ['kids_rug'], size: 'about 140 x 200 cm, 2 cm thick', include: 'the rug only, flat, nothing on it',
    view: 'view from above at 45 degrees, the whole rug in frame' },
};
const MODELS = {
  spec: { endpoint: 'openrouter/router/vision', usd: 0.005 },
  studio: { endpoint: 'fal-ai/nano-banana-pro/edit', usd: 0.15 },
  mesh: { endpoint: 'fal-ai/hunyuan-3d/v3.1/pro/image-to-3d', usd: 0.525 },
};

// alternatives for the rings (items/catalog-spec.json): a NEW piece described in words, the original's studio photo as the style reference
const CATSPEC = fs.existsSync(path.join(IT, 'catalog-spec.json')) ? JSON.parse(fs.readFileSync(path.join(IT, 'catalog-spec.json'), 'utf8')).categories : {};
let ALT = null;
for (const [cat, c] of Object.entries(CATSPEC)) for (const x of c.items) if (x.id === ID) ALT = { ...x, category: cat, ref: c.ref, size: c.size };
if (ALT && !PILOT[ID]) PILOT[ID] = { crops: [], size: ALT.size, include: 'the piece only, nothing on it', view: PILOT[ALT.ref]?.view || 'three-quarter front view' };
const item = PILOT[ID];
if (!item) { console.error(`unknown item ${ID}; items: ${Object.keys(PILOT).join(', ')}`); process.exit(2); }
const meta = JSON.parse(fs.readFileSync(path.join(IT, 'items.json'), 'utf8')).items;
const rows = ALT ? [{ id: ALT.ref, crop: `items/studio/${ALT.ref}.png`, what: ALT.desc, colours: [] }] : item.crops.map((c) => meta.find((m) => m.id === c));
const dataUri = (p) => `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;
const hash = (...xs) => { const h = crypto.createHash('sha256'); xs.forEach((x) => h.update(typeof x === 'string' ? x : JSON.stringify(x))); return h.digest('hex'); };
for (const d of ['specs', 'studio', 'glb']) fs.mkdirSync(path.join(IT, d), { recursive: true });

// one ledger file per item (parallel runs never share a file); the cap is checked against the sum of every ledger
const LD = path.join(IT, 'ledger'); fs.mkdirSync(LD, { recursive: true });
const ledgerPath = path.join(LD, `${ID}.json`);
const legacy = path.join(IT, 'ledger.json');   // the pilot's rows (one shared file, before round 2)
const ledger = fs.existsSync(ledgerPath) ? JSON.parse(fs.readFileSync(ledgerPath, 'utf8'))
  : { $schema: 'tour360/ledger.v1', cap_usd: CAP, item: ID, note: 'reserve before send, settle after', rows: [] };
ledger.cap_usd = CAP;
const sumFile = (f) => JSON.parse(fs.readFileSync(f, 'utf8')).rows.reduce((t, r) => t + (r.status === 'failed-unbilled' ? 0 : (r.settled_usd ?? r.reserved_usd)), 0);
const spent = () => ledger.rows.reduce((t, r) => t + (r.status === 'failed-unbilled' ? 0 : (r.settled_usd ?? r.reserved_usd)), 0)
  + (fs.existsSync(legacy) ? sumFile(legacy) : 0)
  + fs.readdirSync(LD).filter((f) => f.endsWith('.json') && f !== `${ID}.json`).reduce((t, f) => t + sumFile(path.join(LD, f)), 0);
// a pilot item's earlier rows live in the legacy file: treat them as this item's cache
const legacyRows = fs.existsSync(legacy) ? JSON.parse(fs.readFileSync(legacy, 'utf8')).rows.filter((r) => r.item === ID) : [];
const saveLedger = () => fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 1));
let env = null;

async function falQueue(endpoint, body, row) {
  env ??= loadEnv('C:/RnD');
  if (!env.FAL_KEY) throw new Error('FAL_KEY: missing (checked by name)');
  const H = { Authorization: `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' };
  let q = row.queue;
  if (!q) {  // a row that already holds a queue ticket is collected, never sent again
    const r = await fetch(`https://queue.fal.run/${endpoint}`, { method: 'POST', headers: H, body: JSON.stringify(body), signal: AbortSignal.timeout(120e3) });
    const t = await r.text();
    if (!r.ok) throw new Error(`submit HTTP ${r.status}: ${t.slice(0, 300)}`);
    const j = JSON.parse(t);
    q = { request_id: j.request_id, status_url: j.status_url, response_url: j.response_url };
    row.queue = q;
    saveLedger();
  }
  const t0 = Date.now();
  for (;;) {
    if (Date.now() - t0 > 40 * 60e3) throw new Error(`timeout waiting for ${q.request_id} (collect later with the same command)`);
    await new Promise((ok) => setTimeout(ok, 4000));
    let s = {};
    try { s = await (await fetch(q.status_url, { headers: H, signal: AbortSignal.timeout(30e3) })).json(); } catch { continue; }  // a hung poll is retried
    if (s.status === 'COMPLETED') break;
    if (s.status && !['IN_QUEUE', 'IN_PROGRESS'].includes(s.status)) throw new Error(`status ${JSON.stringify(s).slice(0, 300)}`);
  }
  const res = await fetch(q.response_url, { headers: H, signal: AbortSignal.timeout(60e3) });
  const rt = await res.text();
  if (!res.ok) throw new Error(`result HTTP ${res.status}: ${rt.slice(0, 300)}`);
  return { request_id: q.request_id, out: JSON.parse(rt) };
}

async function paid(stage, inputsHash, body, save) {
  const m = MODELS[stage];
  const done = [...ledger.rows, ...legacyRows].find((r) => r.inputs_hash === inputsHash && r.status === 'settled' && r.out && fs.existsSync(r.out));
  const show = JSON.parse(JSON.stringify(body, (k, v) => (typeof v === 'string' && v.startsWith('data:') ? `<${v.length} chars>` : v)));
  console.log(JSON.stringify({ item: ID, stage, endpoint: m.endpoint, usd: m.usd, spent_before: +spent().toFixed(3), cap: ledger.cap_usd,
    cached: !!done, mode: GO ? 'GO' : 'dry-run', body: show }, null, 1));
  if (done) { console.log(`CACHED ${stage} - $0`); return done.out; }
  if (spent() + m.usd > ledger.cap_usd + 1e-9) { console.error(`REFUSED: ${spent().toFixed(3)} + ${m.usd} > cap ${ledger.cap_usd}`); process.exit(2); }
  if (!GO) return null;
  // an earlier run that sent this exact call and stopped before the answer: collect it (no new charge)
  let row = ledger.rows.find((r) => r.inputs_hash === inputsHash && r.queue && r.status !== 'settled');
  if (row) console.log(`COLLECT ${stage} ${row.queue.request_id}`);
  else {
    row = { seq: ledger.rows.length + 1, at: new Date().toISOString(), item: ID, op: stage, model: m.endpoint,
      reserved_usd: m.usd, status: 'reserved', inputs_hash: inputsHash };
    ledger.rows.push(row); saveLedger();
  }
  const t0 = Date.now();
  try {
    const { request_id, out } = await falQueue(m.endpoint, body, row);
    const file = await save(out);
    Object.assign(row, { status: 'settled', settled_usd: m.usd, request_id, seconds: (Date.now() - t0) / 1000, out: file,
      usage: out.usage || undefined });
    saveLedger();
    console.log(`OK ${stage} ${((Date.now() - t0) / 1000).toFixed(0)} s → ${path.relative(ROOT, file)}`);
    return file;
  } catch (e) {
    // kept at its reservation (billed or not is read later from fal's usage page)
    const refused = /^submit HTTP 4\d\d/.test(String(e.message)) && !row.queue;   // refused before any work: fal does not bill it
    Object.assign(row, { status: refused ? 'failed-unbilled' : 'failed', ...(refused ? { settled_usd: 0 } : {}), error: String(e.message).slice(0, 300), seconds: (Date.now() - t0) / 1000 });
    saveLedger();
    console.error(`FAILED ${stage}: ${row.error}`);
    process.exit(1);
  }
}

const download = async (url, file) => {
  const buf = url.startsWith('data:') ? Buffer.from(url.split(',')[1], 'base64') : Buffer.from(await (await fetch(url, { signal: AbortSignal.timeout(600e3) })).arrayBuffer());
  fs.writeFileSync(file, buf);
  return file;
};

// --- stage 1: the spec
const crops = rows.map((r) => path.join(ROOT, r.crop));
const colourLine = rows.map((r) => `${r.id}: ${r.colours.map((c) => `${c.hex} (${Math.round(c.share * 100)}%)`).join(', ')}`).join('; ');
const SPEC_SYS = 'You are a senior furniture product analyst for a high-end interior visualisation studio. You read reference renders of ONE piece of furniture or lighting and write a precise manufacturing-grade description so another model can recreate exactly the same piece. Never invent a different design. Answer with the JSON object only.';
const SPEC_PROMPT = [
  `The images show the same piece: ${rows[0].what}. Size: ${item.size}. Include: ${item.include}.`,
  `Dominant colours measured from the render pixels (they include light and shade, the background may leak in): ${colourLine}.`,
  'Return JSON: {"name": str, "category": str, "silhouette": str, "proportions": str, "parts": [{"part": str, "shape": str, "material": str,',
  '"finish": str, "colour_name": str, "colour_hex": str}], "details": [str], "style": str, "studio_prompt": str (60-120 words, one paragraph,',
  'describing exactly this piece for a photoreal product photo: every part, material, weave or grain, colour with hex, proportions; no background or camera words)}',
].join(' ');
const specFile = path.join(IT, 'specs', `${ID}.json`);
const specHash = hash(MODELS.spec.endpoint, SPEC_SYS, SPEC_PROMPT, ...crops.map((p) => fs.readFileSync(p)));
let spec = null;
if (ALT && !fs.existsSync(specFile)) {   // an alternative is specified in words already: no analysis call
  fs.writeFileSync(specFile, JSON.stringify({ item: ID, alternative_to: ALT.ref, category: ALT.category, size: item.size,
    spec: { name: ALT.name_en, studio_prompt: `${ALT.desc}. Colour: ${ALT.colour}. Materials: ${ALT.material}.` } }, null, 1));
}
if (!ALT && (['all', 'spec'].includes(STAGE) || !fs.existsSync(specFile))) {
  const f = await paid('spec', specHash, { model: 'google/gemini-3.7-flash', system_prompt: SPEC_SYS, prompt: SPEC_PROMPT,
    image_urls: crops.map(dataUri), temperature: 0, max_tokens: 3000, reasoning: true }, async (out) => {
    const txt = String(out.output || '').replace(/^```(json)?/m, '').replace(/```\s*$/m, '').trim();
    const j = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
    fs.writeFileSync(specFile, JSON.stringify({ item: ID, crops: rows.map((r) => r.crop), measured: colourLine, size: item.size, spec: j }, null, 1));
    return specFile;
  });
  if (!f && !GO) process.exit(0);
}
spec = JSON.parse(fs.readFileSync(specFile, 'utf8')).spec;
if (STAGE === 'spec') process.exit(0);

// --- stage 2: the studio photo
const STUDIO = ALT ? [
  `A high-end catalogue product photograph of a NEW piece: ${spec.name}. ${spec.studio_prompt}`,
  'The reference image only sets the photographic style, the light, the camera angle and the quality; the piece itself is a different design, as described.',
  `Size: ${item.size}. Camera: ${item.view}. Seamless pure white studio background, soft large diffused light, a faint soft contact shadow only.`,
  'The complete object, nothing cropped, centred, nothing else in the picture, no text, no logo; photoreal, crisp material detail; not a copy of any named or branded design.',
].join(' ') : [
  `Recreate exactly the same ${spec.name} shown in the reference images as a high-end catalogue product photograph.`,
  spec.studio_prompt,
  `Size: ${item.size}. Include ${item.include}.`,
  `Camera: ${item.view}. Seamless pure white studio background, soft large diffused light, a faint soft contact shadow only.`,
  'The complete object, nothing cropped, centred, nothing else in the picture: no walls, no floor objects, no props, no text, no logo.',
  'Keep the same design, proportions, materials and colours as the references; photoreal, crisp material detail.',
].join(' ');
const studioFile = path.join(IT, 'studio', `${ID}.png`);
const studioHash = hash(MODELS.studio.endpoint, STUDIO, ...crops.map((p) => fs.readFileSync(p)));
if (['all', 'studio'].includes(STAGE)) {
  const f = await paid('studio', studioHash, { prompt: STUDIO, image_urls: crops.map(dataUri), num_images: 1, resolution: '2K',
    aspect_ratio: '1:1', output_format: 'png', seed: 7 }, async (out) => download(out.images[0].url, studioFile));
  if (!f) process.exit(0);
}
if (STAGE === 'studio') process.exit(0);

// --- stage 3: the 3D model
const glbFile = path.join(IT, 'glb', `${ID}.glb`);
const meshHash = hash(MODELS.mesh.endpoint, fs.readFileSync(studioFile), 'pbr');
await paid('mesh', meshHash, { input_image_url: dataUri(studioFile), enable_pbr: true, generate_type: 'Normal' },
  async (out) => download((out.model_glb || out.model_urls?.glb).url, glbFile));
console.log(`DONE ${ID}: spent ${spent().toFixed(3)} of ${ledger.cap_usd}`);
