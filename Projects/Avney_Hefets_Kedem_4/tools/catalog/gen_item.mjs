/* gen_item.mjs - one swap-catalog item: text design -> studio product photo -> textured 3D model (2026-11-17).
   Adapted from the Hatzav chain (.wt/harei-zahav-naama scripts/16_item_3d.mjs, proven 2026-11-17: $2.04 for 3 items).
   Stages (each cached by its inputs hash; a cached stage costs $0 and is never re-sent):
     studio  fal-ai/nano-banana-pro (text to image, 2K): the catalog.json design -> a clean product photo on white     $0.15
     mesh    fal-ai/hunyuan-3d/v3.1/pro/image-to-3d, enable_pbr, face_count 200000: the photo -> GLB             $0.525
   Ledger tools/catalog/ledger.json (gitignored with the outputs? no: kept beside them): reserved BEFORE each call, settled after; a call
   that would cross the cap is refused. Dry-run by default; --go sends. FAL_KEY by NAME via loadEnv; never printed.
   Usage: node tools/catalog/gen_item.mjs <item-id> [--go] [--stage studio|mesh|all]                                              */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'file:///C:/RnD/.wt/kedma-d1/Projects/3Dengine/pipeline/Habait/tour360/tools/file-ledger.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'work', 'catalog');
const args = process.argv.slice(2);
const ID = args.find((a) => !a.startsWith('--'));
const GO = args.includes('--go');
const STAGE = args.includes('--stage') ? args[args.indexOf('--stage') + 1] : 'all';
const SET = args.includes('--set') ? args[args.indexOf('--set') + 1] : 'catalog';
const CAP = SET === 'base' ? 26.0 : 10.0;   // base: $4.05 spent + his «upgrade the walk» pick (~$20), 2026-11-18   // root rule 7: the soft cap of a render batch; crossing it = stop and tell Eliran
const MODELS = { views: { endpoint: 'fal-ai/nano-banana-pro/edit', usd: 0.15 }, meshmv: { endpoint: 'fal-ai/hunyuan-3d/v3.1/pro/image-to-3d', usd: 0.825 }, studio: { endpoint: SET === 'base' ? 'fal-ai/nano-banana-pro/edit' : 'fal-ai/nano-banana-pro', usd: 0.15 }, mesh: { endpoint: 'fal-ai/hunyuan-3d/v3.1/pro/image-to-3d', usd: 0.525 } };
const cat = JSON.parse(fs.readFileSync(path.join(HERE, SET === 'base' ? 'base.json' : 'catalog.json'), 'utf8'));
const item = cat.items.find((i) => i.id === ID);
if (!item) { console.error(`unknown item ${ID}; items: ${cat.items.map((i) => i.id).join(', ')}`); process.exit(2); }
for (const d of ['studio', 'glb']) fs.mkdirSync(path.join(OUT, d), { recursive: true });
const hash = (...xs) => { const h = crypto.createHash('sha256'); xs.forEach((x) => h.update(typeof x === 'string' ? x : x instanceof Buffer ? x : JSON.stringify(x))); return h.digest('hex'); };
const ledgerPath = path.join(HERE, SET === 'base' ? 'ledger-base.json' : 'ledger.json');
const ledger = fs.existsSync(ledgerPath) ? JSON.parse(fs.readFileSync(ledgerPath, 'utf8'))
  : { $schema: 'tour360/ledger.v1', cap_usd: CAP, note: 'Eliran 2026-11-17: the swap furniture is generated with the best fal model (his words); 14 items ~ $9.45; reserve before send, settle after', rows: [] };
const spent = () => ledger.rows.reduce((t, r) => t + (r.status === 'failed-unbilled' ? 0 : (r.settled_usd ?? r.reserved_usd)), 0);
const saveLedger = () => fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 1));
let env = null;

async function falQueue(endpoint, body, row) {
  env ??= loadEnv('C:/RnD');
  if (!env.FAL_KEY) throw new Error('FAL_KEY: missing (checked by name)');
  const H = { Authorization: `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' };
  let q = row.queue;
  if (!q) {   // a row that already holds a queue ticket is collected, never sent again
    const r = await fetch(`https://queue.fal.run/${endpoint}`, { method: 'POST', headers: H, body: JSON.stringify(body), signal: AbortSignal.timeout(120e3) });
    const t = await r.text();
    if (!r.ok) throw new Error(`submit HTTP ${r.status}: ${t.slice(0, 300)}`);
    const j = JSON.parse(t); q = { request_id: j.request_id, status_url: j.status_url, response_url: j.response_url }; row.queue = q; saveLedger();
  }
  const t0 = Date.now();
  for (;;) {
    if (Date.now() - t0 > 9 * 60e3) throw new Error(`timeout waiting for ${q.request_id} (collect later with the same command)`);
    await new Promise((ok) => setTimeout(ok, 4000));
    let s = {}; try { s = await (await fetch(q.status_url, { headers: H, signal: AbortSignal.timeout(30e3) })).json(); } catch { continue; }
    if (s.status === 'COMPLETED') break;
    if (s.status && !['IN_QUEUE', 'IN_PROGRESS'].includes(s.status)) throw new Error(`status ${JSON.stringify(s).slice(0, 300)}`);
  }
  const res = await fetch(q.response_url, { headers: H, signal: AbortSignal.timeout(60e3) }); const rt = await res.text();
  if (!res.ok) throw new Error(`result HTTP ${res.status}: ${rt.slice(0, 300)}`);
  return { request_id: q.request_id, out: JSON.parse(rt) };
}
async function paid(stage, inputsHash, body, save) {
  const m = MODELS[stage];
  const done = ledger.rows.find((r) => r.inputs_hash === inputsHash && r.status === 'settled' && r.out && fs.existsSync(r.out));
  const show = JSON.parse(JSON.stringify(body, (k, v) => (typeof v === 'string' && v.startsWith('data:') ? `<${v.length} chars>` : v)));
  console.log(JSON.stringify({ item: ID, stage, endpoint: m.endpoint, usd: m.usd, spent_before: +spent().toFixed(3), cap: ledger.cap_usd, cached: !!done, mode: GO ? 'GO' : 'dry-run', body: show }));
  if (done) { console.log(`CACHED ${stage} - $0`); return done.out; }
  if (spent() + m.usd > ledger.cap_usd + 1e-9) { console.error(`REFUSED: ${spent().toFixed(3)} + ${m.usd} > cap ${ledger.cap_usd}`); process.exit(2); }
  if (!GO) return null;
  let row = ledger.rows.find((r) => r.inputs_hash === inputsHash && r.queue && r.status !== 'settled');
  if (row) console.log(`COLLECT ${stage} ${row.queue.request_id}`);
  else { row = { seq: ledger.rows.length + 1, at: new Date().toISOString(), item: ID, op: stage, model: m.endpoint, reserved_usd: m.usd, status: 'reserved', inputs_hash: inputsHash }; ledger.rows.push(row); saveLedger(); }
  const t0 = Date.now();
  try {
    const { request_id, out } = await falQueue(m.endpoint, body, row);
    const file = await save(out);
    Object.assign(row, { status: 'settled', settled_usd: m.usd, request_id, seconds: (Date.now() - t0) / 1000, out: file }); saveLedger();
    console.log(`OK ${stage} ${((Date.now() - t0) / 1000).toFixed(0)} s -> ${file}`); return file;
  } catch (e) {
    Object.assign(row, { status: 'failed', error: String(e.message).slice(0, 300), seconds: (Date.now() - t0) / 1000 }); saveLedger();
    console.error(`FAILED ${stage}: ${row.error}`); process.exit(1);
  }
}
const download = async (url, file) => { fs.writeFileSync(file, Buffer.from(await (await fetch(url, { signal: AbortSignal.timeout(600e3) })).arrayBuffer())); return file; };

const [w, d, h] = item.size_cm;
// base items: crops of Eliran's pictures (read-only originals; crops are new files under work/catalog/crops)
let crops = [];
if (item.crops) {
  const { execFileSync } = await import('node:child_process');
  const src = 'C:/RnD/Projects/Avney_Hefets_Kedem_4/בניין 1 קומה א דירה 7';
  fs.mkdirSync(path.join(OUT, 'crops'), { recursive: true });
  crops = item.crops.map(([pic, box], i) => {
    const f = path.join(OUT, 'crops', `${ID}_${i}.png`);
    if (!fs.existsSync(f)) execFileSync('python', ['-I', '-c', "import sys;from PIL import Image;im=Image.open(sys.argv[1]);k=im.width/1280;b=[int(float(v)*k) for v in sys.argv[3].split(',')];im.crop(b).convert('RGB').save(sys.argv[2])", (cat.pics[pic].includes(':') ? cat.pics[pic] : path.join(src, cat.pics[pic])), f, box.join(',')]);
    return f;
  });
}
const STUDIO = item.crops ? [
  `The reference images are crops of an interior rendering. Recreate ${item.desc} as a high-end furniture catalogue product photograph.`,
  `Include ${item.include}. Real-world size about ${w} cm wide, ${d} cm deep, ${h} cm high; true proportions.`,
  'Keep exactly the same design, proportions, materials and colours as the references, complete the parts the crops cut off consistently.',
  'Three-quarter front view from slightly above eye level, the complete object in frame and centred, nothing cropped.',
  'Seamless pure white studio background, soft large diffused light, only a faint soft contact shadow. Nothing else in the picture: no room, no rug, no props, no text. Photoreal, crisp material detail.',
].join(' ') : [
  `A high-end furniture catalogue product photograph of ${item.desc}.`,
  `Real-world size about ${w} cm wide, ${d} cm deep, ${h} cm high; true proportions.`,
  'Three-quarter front view from slightly above eye level, the complete object in frame and centred, nothing cropped.',
  'Seamless pure white studio background, soft large diffused light, only a faint soft contact shadow.',
  'Nothing else in the picture: no room, no rug, no props, no plants, no people, no text, no logo. Photoreal, crisp material detail.',
].join(' ');
const studioFile = path.join(OUT, 'studio', `${ID}.png`);
if (['all', 'studio'].includes(STAGE)) {
  const body = { prompt: STUDIO, num_images: 1, resolution: '2K', aspect_ratio: '1:1', output_format: 'png', seed: 7 };
  if (crops.length) body.image_urls = crops.map((f) => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`);
  const f = await paid('studio', hash(MODELS.studio.endpoint, STUDIO, ...crops.map((f) => fs.readFileSync(f))), body,
    async (out) => download(out.images[0].url, studioFile));
  if (!f) process.exit(0);
}
if (STAGE === 'studio') process.exit(0);
// ---- multi-view (2026-11-18): back / left / right of the SAME item from the studio photo, then the 4-view Hunyuan call
if (item.mv) {
  const VIEWS = { back: 'seen from directly behind (its back side)', left: 'seen from its left side, a pure side profile', right: 'seen from its right side, a pure side profile' };
  const vfiles = {};
  for (const [k, words] of Object.entries(VIEWS)) {
    const f = path.join(OUT, 'studio', `${ID}_${k}.png`); vfiles[k] = f;
    const prompt = `The reference is a studio product photograph of one object. Show exactly the same object ${words}, the whole object in frame and centred, the same size, the same design, materials, colours and proportions, on the same seamless pure white studio background with soft diffused light. Nothing else in the picture, no text. Photoreal.`;
    const ok = await paid('views', hash(MODELS.views.endpoint, prompt, fs.readFileSync(studioFile)), { prompt, image_urls: [`data:image/png;base64,${fs.readFileSync(studioFile).toString('base64')}`], num_images: 1, resolution: '2K', aspect_ratio: '1:1', output_format: 'png', seed: 7 },
      async (out) => download(out.images[0].url, f));
    if (!ok) process.exit(0);
  }
  if (STAGE === 'views') process.exit(0);
  const du = (f) => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`;
  const glbMv = path.join(OUT, 'glb', `${ID}.glb`);
  await paid('meshmv', hash(MODELS.meshmv.endpoint, fs.readFileSync(studioFile), ...Object.values(vfiles).map((f) => fs.readFileSync(f)), 'pbr', 200000),
    { input_image_url: du(studioFile), back_image_url: du(vfiles.back), left_image_url: du(vfiles.left), right_image_url: du(vfiles.right), enable_pbr: true, generate_type: 'Normal', face_count: 200000 },
    async (out) => download((out.model_glb || out.model_urls?.glb).url, glbMv));
  console.log(`DONE ${ID} (4 views): spent ${spent().toFixed(3)} of ${ledger.cap_usd}`);
  process.exit(0);
}
const glbFile = path.join(OUT, 'glb', `${ID}.glb`);
await paid('mesh', hash(MODELS.mesh.endpoint, fs.readFileSync(studioFile), 'pbr', 200000),
  { input_image_url: `data:image/png;base64,${fs.readFileSync(studioFile).toString('base64')}`, enable_pbr: true, generate_type: 'Normal', face_count: 200000 },
  async (out) => download((out.model_glb || out.model_urls?.glb).url, glbFile));
console.log(`DONE ${ID}: spent ${spent().toFixed(3)} of ${ledger.cap_usd}`);
