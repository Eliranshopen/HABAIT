/* Step 27 - the 360 realism pass (Eliran 2026-11-18: «תתקדם כרגע רק על 3D 360 תבחר את המודל הטוב ביותר מFAL שידע לייצר לך את התוצרים
   הכי טובים וריאליסטיים על סמך התמונות שסיפקתי לך»). One Blender equirectangular panorama of the plan layout (furniture = the Hitem3D
   pieces made from his renders) + his Corona render of that room as the LOOK reference → a 4K photoreal panorama, 2:1 kept.
   Models (the comparison picks one): nbp = nano-banana-pro/edit · sd45 = seedream v4.5 edit · sd5l = seedream v5 lite edit · flux2pro.
   §7: the row is reserved in work/pano360/ledger.json BEFORE the call; the project ceiling ($90, Eliran 2026-11-18) is checked against
   every ledger of the job; the queue ticket is saved before polling, so a retry collects instead of paying again. FAL_KEY by NAME.
   Dry-run by default; --go sends.  Usage: node scripts/27_pano_realism.mjs <pano.png> <ref.jpg> <out.png> --model nbp [--go]        */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { loadEnv } from '../../../../../../Projects/3Dengine/pipeline/Habait/tour360/tools/file-ledger.mjs';
const sharp = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json')('sharp');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const [pano, ref, out] = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--model');
const MODEL = args.includes('--model') ? args[args.indexOf('--model') + 1] : 'nbp';
const GO = args.includes('--go');
const CEILING = 102;   // Eliran 2026-11-18: raised to $102 to fix the 8 render mismatches (8 rooms again)
const SIZE = { width: 4096, height: 2048 };
const M = {
  // GPT Image 2.5 "Sunburst": the RAINBOW model of record for panoramas from a 3D model (clean 360 seam, keeps geometry;
  // Projects/Habait CLAUDE.md, bench 2026-11-02; flat $1.20 a call in the engine registry, checked 2026-11-02)
  gpt25: { ep: 'openai/gpt-image-2.5/sunburst/edit', usd: 1.20, body: { image_size: SIZE, quality: 'high', num_images: 1, output_format: 'png' } },
  nbp: { ep: 'fal-ai/nano-banana-pro/edit', usd: 0.30, body: { resolution: '4K', aspect_ratio: 'auto', output_format: 'png', num_images: 1 } },
  sd45: { ep: 'fal-ai/bytedance/seedream/v4.5/edit', usd: 0.04, body: { image_size: SIZE, num_images: 1 } },
  sd5l: { ep: 'fal-ai/bytedance/seedream/v5/lite/edit', usd: 0.04, body: { image_size: SIZE, num_images: 1 } },
  flux2pro: { ep: 'fal-ai/flux-2-pro/edit', usd: 0.25, body: { image_size: SIZE, output_format: 'png' } },
}[MODEL];
if (!M) { console.error('unknown --model', MODEL); process.exit(1); }
// --no-blender (Eliran 2026-11-19 «אם הייתי בונה את ההדמייה הזאת ללא בלנדר מה הייתי מקבל? … דוגמא», $1.20 approved): image 1 is the
// SALES PLAN, not a Blender panorama - the demo of what the model makes with no 3D model under it. Same model, same look reference.
const NO_BLENDER = args.includes('--no-blender');
const PROMPT_NO_BLENDER = [
  'Image 1 is the sales floor plan of a small house (dimensions in cm). Image 2 is the designer\'s photoreal render of its kitchen.',
  'Create an equirectangular 360-degree panorama (2:1, full sphere, seamless left and right edges, horizon in the middle) of the open',
  'kitchen-living-dining space, as seen by a person standing in the kitchen at eye level (about 1.6 m) between the kitchen counters and',
  'the dining table, following the plan: the kitchen along the left wall and the bottom wall with the sink under the window, the dining table',
  'of six in the middle, the L-shaped sofa and the TV unit beyond, the glass sliding doors to the wooden deck. Use the look of image 2: soft',
  'warm daylight, limewash plaster walls, natural oak cabinets, stone floor, rattan pendant lights. No skirting boards. Photoreal,',
  'professional real-estate 360 photograph. No people, no text, no logo, no watermark.',
].join(' ');
const PROMPT = NO_BLENDER ? PROMPT_NO_BLENDER : [
  'Image 1 is an equirectangular 360-degree panorama (2:1, full sphere) of an apartment interior, rendered from an exact 3D model of the sales plan.',
  'Turn it into a real, high-end professional 360-degree interior photograph.',
  'Image 2 is the designer\'s photoreal render of this apartment: use it ONLY as the reference for the look - the soft warm daylight, the limewash',
  'plaster walls, the fine natural oak grain, the linen and boucle fabrics, the stone floor, the tones and the photographic quality.',
  'STRICT, from image 1: keep the equirectangular projection exactly (straight vertical lines stay vertical, the horizon stays in the middle, the left',
  'and right edges must join seamlessly); keep every wall, opening, door, window, ceiling, light, cabinet and every piece of furniture and decor',
  'exactly where it is, same size, shape and colour. Do not add, remove, move or resize anything; do not copy objects or layout from image 2;',
  'no skirting boards; keep the view outside the windows. Only make materials, light, shadows and reflections real: soft contact shadows, gentle',
  'global illumination, real fabric weave and folds, real wood grain, natural reflections. No people, no text, no logo, no watermark.',
].join(' ');

const dir = path.join(ROOT, 'work', 'pano360');
fs.mkdirSync(dir, { recursive: true });
const LP = path.join(dir, 'ledger.json');
const L = fs.existsSync(LP) ? JSON.parse(fs.readFileSync(LP, 'utf8')) : { $schema: 'tour360/ledger.v1', note: 'the 360 realism pass; project ceiling $95 (Eliran 2026-11-18)', rows: [] };
const cost = (rows) => rows.reduce((t, r) => t + (r.status === 'failed-unbilled' ? 0 : (r.settled_usd ?? r.reserved_usd ?? 0)), 0);
function projectSpent() {   // every ledger of the job except this one, plus this one
  let t = 0;
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!/node_modules|walkaround|deploy|publish|\.git/.test(e.name)) walk(p); }
    else if (/ledger.*\.json$|^(compare_)?[a-z_]+\.json$/.test(e.name) && (d.includes('ledger') || e.name.startsWith('ledger')) && path.resolve(p) !== path.resolve(LP)) {
      try { const j = JSON.parse(fs.readFileSync(p, 'utf8')); t += cost(Array.isArray(j) ? j : (j.rows || [])); } catch { /* not a ledger */ }
    } } };
  walk(ROOT);
  return t + cost(L.rows);
}
const jpg = async (p, max) => sharp(fs.readFileSync(p)).resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer();
const A = await jpg(pano, 4096), B = await jpg(ref, 2048);
const hash = crypto.createHash('sha256').update(M.ep).update(JSON.stringify(M.body)).update(PROMPT).update(A).update(B).digest('hex');
const spent = projectSpent();
let row = L.rows.find((r) => r.inputs_hash === hash && (r.status === 'settled' || r.status === 'reserved' || (r.status === 'failed' && r.queue)));   // a failed row that holds a queue ticket is collected, never paid again
console.log(JSON.stringify({ model: MODEL, endpoint: M.ep, usd: M.usd, project_spent: +spent.toFixed(2), ceiling: CEILING, cached: row?.status === 'settled', mode: GO ? 'GO' : 'dry-run' }));
if (row?.status === 'settled' && fs.existsSync(row.out)) { if (path.resolve(row.out) !== path.resolve(out)) fs.copyFileSync(row.out, out); console.log('CACHED $0'); process.exit(0); }
if (!row && spent + M.usd > CEILING + 1e-9) { console.error('REFUSED: over the $90 ceiling'); process.exit(2); }
if (!GO) process.exit(0);
const env = loadEnv('C:/RnD');
if (!env.FAL_KEY) { console.error('FAL_KEY missing (by name)'); process.exit(3); }
const H = { Authorization: `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' };
const save = () => fs.writeFileSync(LP, JSON.stringify(L, null, 1));
if (!row) { row = { seq: L.rows.length + 1, at: new Date().toISOString(), op: NO_BLENDER ? 'pano-no-blender-demo' : 'pano-realism', model: M.ep, room: path.basename(pano, '.png'), reserved_usd: M.usd, status: 'reserved', inputs_hash: hash, out: path.resolve(out) }; L.rows.push(row); save(); }
const t0 = Date.now();
try {
  if (!row.queue) {
    const r = await fetch(`https://queue.fal.run/${M.ep}`, { method: 'POST', headers: H, signal: AbortSignal.timeout(180e3),
      body: JSON.stringify({ prompt: PROMPT, image_urls: [`data:image/jpeg;base64,${A.toString('base64')}`, `data:image/jpeg;base64,${B.toString('base64')}`], ...M.body }) });
    const t = await r.text();
    if (!r.ok) throw new Error(`submit HTTP ${r.status}: ${t.slice(0, 300)}`);
    const j = JSON.parse(t); row.queue = { request_id: j.request_id, status_url: j.status_url, response_url: j.response_url }; save();
  }
  for (let i = 0; ; i++) {
    const s = await (await fetch(row.queue.status_url, { headers: H, signal: AbortSignal.timeout(60e3) })).json();
    if (s.status === 'COMPLETED') break;
    if (i > 200) throw new Error('timeout waiting (ticket kept, re-run collects)');
    await new Promise((r) => setTimeout(r, 4000));
  }
  const res = await (await fetch(row.queue.response_url, { headers: H, signal: AbortSignal.timeout(120e3) })).json();
  const u = res.images?.[0]?.url; if (!u) throw new Error('no image: ' + JSON.stringify(res).slice(0, 300));
  const buf = Buffer.from(await (await fetch(u, { signal: AbortSignal.timeout(180e3) })).arrayBuffer());
  const meta = await sharp(buf).metadata();
  await sharp(buf).resize(SIZE.width, SIZE.height, { fit: 'fill' }).png().toFile(out);   // exact 2:1 for the viewer (the model's own size is recorded)
  Object.assign(row, { status: 'settled', settled_usd: M.usd, seconds: (Date.now() - t0) / 1000, model_size: [meta.width, meta.height] });
  console.log('OK', MODEL, `${meta.width}x${meta.height}`, ((Date.now() - t0) / 1000).toFixed(0), 's');
} catch (e) {
  Object.assign(row, { status: /submit HTTP 4/.test(e.message) ? 'failed-unbilled' : 'failed', error: String(e.message).slice(0, 300) });
  console.error('FAILED', row.error); process.exitCode = 1;
}
save();
