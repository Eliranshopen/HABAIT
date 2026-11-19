/* Step 40 (PAID, fal, $1.20 a room a variant) - the realism pass on top of step 38: image 1 = the step-38 panorama (sales-plan walls,
   openings, sizes, furniture places; his pieces), image 2 = his picture of the room. Variant A = a real photograph of the same pieces;
   variant B = an interior designer's premium staging in the style of his picture (decor added, never walls/openings). Eliran 2026-11-18:
   «הריהוט והפריטים צריכים להתבסס בגדול על התמונות … ההדמיה תהיה ריאליסטית בסוף ובאיכות גבוהה ומותאמת לתכנית מכר».
   Out: work/pano/real<A|B>/<id>.png. Usage: node scripts/40_pano_realism_pass.mjs <job root> <id[,id]> --variant A|B [--go]           */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadEnv } from 'file:///C:/RnD/Projects/3Dengine/pipeline/Habait/tour360/tools/file-ledger.mjs';

const args = process.argv.slice(2);
const [ROOT, ids] = args.filter((a) => !a.startsWith('--')); const GO = args.includes('--go');
const CAP = 55, USD = 1.20, EP = 'openai/gpt-image-2.5/sunburst/edit';
const REF = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(ROOT, 'work/pano/polish_manifest.json'), 'utf8')).map((v) => [v.name.split('_')[0], v.ref]));   // step 32's room → picture
REF.corridor ??= REF.living;   // the corridor (2026-11-19, no picture of its own): the living-room picture, same walls and floor
const VAR = args.includes('--variant') ? args[args.indexOf('--variant') + 1] : 'A';
const COMMON_START = [
  'Image 1 is an equirectangular 360-degree panorama (2:1, full sphere) of an apartment room; its walls, openings, doors, windows, room size and the',
  'place of every piece of furniture follow the sales plan exactly and must not change. Image 2 is the developer render of this room: the furniture',
  'and materials are based on it.',
];
const COMMON_END = [
  'STRICT: keep the equirectangular projection (straight verticals, horizon in the middle, the left and right edges join seamlessly); keep every wall,',
  'opening, door, window, cabinet and the furniture layout exactly as in image 1; never add or remove walls, doors or windows; no skirting boards.',
  'No people, no text, no logo, no watermark.',
];
const PROMPT = [...COMMON_START, ...(VAR === 'A' ? [
  'Make it indistinguishable from a real photograph taken by a top architectural photographer with a full-frame 360 camera in this finished apartment:',
  'true-to-life exposure (not blown out, whites are soft and slightly warm), natural daylight from the windows with real falloff into the room,',
  'soft directional shadows and contact shadows under every piece, subtle ambient occlusion in corners, real reflections on the polished floor,',
  'physically real materials - fabric weave, wrinkles and soft sag on upholstery and bedding, real oak grain, veined stone, matte paint with gentle',
  'variation - and fine detail everywhere. Keep the same pieces, colours and decor as image 1.',
] : [
  'Make it a real photograph of this apartment styled by a top interior designer for a luxury sales brochure: each piece in the spirit of image 2 but',
  'as a premium real product (refined proportions, rich upholstery, real oak and stone, black metal details), plus tasteful styling - cushions and a',
  'throw on the sofa, layered bedding, a soft rug, framed art, books, ceramics, a few plants, warm lamps - never blocking a door or window.',
  'True-to-life exposure, warm natural daylight with soft directional shadows, contact shadows, real reflections on the polished floor, fine detail.',
]), ...COMMON_END].join(' ');
const dir = path.join(ROOT, 'work/pano'), out = path.join(dir, 'real' + VAR); fs.mkdirSync(out, { recursive: true });
const LP = path.join(dir, 'ledger.json'); const L = JSON.parse(fs.readFileSync(LP, 'utf8')); L.cap_usd = 55;
const save = () => fs.writeFileSync(LP, JSON.stringify(L, null, 1));
const spent = () => L.rows.reduce((t, r) => t + (r.status === 'failed-unbilled' ? 0 : (r.settled_usd ?? r.reserved_usd)), 0);
const refs = fs.readdirSync(dir).filter((f) => f.startsWith('ref_') && f.endsWith('.jpg'));
let env = null;
const H = () => { env ??= loadEnv('C:/RnD'); if (!env.FAL_KEY) throw new Error('FAL_KEY missing (by name)'); return { Authorization: `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' }; };
const { execFileSync } = await import('node:child_process');
for (const id of ids.split(',')) {
  const jp = path.join(out, `${id}_in.jpg`);
  if (!fs.existsSync(jp)) execFileSync('python', ['-c', `from PIL import Image; Image.open(r'''${path.join(dir, 'gpt25b', id + '.png')}''').convert('RGB').save(r'''${jp}''', quality=92)`]);
  const A = fs.readFileSync(jp), B = fs.readFileSync(path.join(dir, refs.find((f) => f.includes(`_-_${REF[id]}_`))));
  const o = path.join(out, `${id}.png`);
  const body = { prompt: PROMPT, image_urls: [`data:image/jpeg;base64,${A.toString('base64')}`, `data:image/jpeg;base64,${B.toString('base64')}`], image_size: { width: 4096, height: 2048 }, quality: 'high', num_images: 1, output_format: 'png' };
  const hash = crypto.createHash('sha256').update(EP).update(PROMPT).update(A).update(B).digest('hex');
  if (L.rows.find((r) => r.inputs_hash === hash && r.status === 'settled' && fs.existsSync(r.out))) { console.log('CACHED', id); continue; }
  if (spent() + USD > CAP + 1e-9) { console.error('REFUSED: over the cap at', id, spent().toFixed(2)); process.exit(2); }
  if (!GO) { console.log('DRY', id, USD, 'spent', spent().toFixed(2)); continue; }
  const row = { seq: L.rows.length + 1, at: new Date().toISOString(), view: `real${VAR}:${id}`, model: EP, reserved_usd: USD, status: 'reserved', inputs_hash: hash, out: o }; L.rows.push(row); save();
  const t0 = Date.now();
  try {
    const r = await fetch(`https://queue.fal.run/${EP}`, { method: 'POST', headers: H(), signal: AbortSignal.timeout(120e3), body: JSON.stringify(body) });
    const t = await r.text(); if (!r.ok) { const e = new Error(`submit HTTP ${r.status}: ${t.slice(0, 300)}`); e.unbilled = true; throw e; }
    const j = JSON.parse(t); row.queue = { status_url: j.status_url, response_url: j.response_url, request_id: j.request_id }; save();
    for (;;) {
      if (Date.now() - t0 > 15 * 60e3) throw new Error('timeout');
      await new Promise((ok) => setTimeout(ok, 5000));
      let s = {}; try { s = await (await fetch(j.status_url, { headers: H(), signal: AbortSignal.timeout(30e3) })).json(); } catch { continue; }
      if (s.status === 'COMPLETED') break;
      if (s.status && !['IN_QUEUE', 'IN_PROGRESS'].includes(s.status)) throw new Error('status ' + JSON.stringify(s).slice(0, 200));
    }
    const res = await (await fetch(j.response_url, { headers: H(), signal: AbortSignal.timeout(60e3) })).json();
    if (!res.images || !res.images[0]) throw new Error('no image: ' + JSON.stringify(res).slice(0, 300));
    fs.writeFileSync(o, Buffer.from(await (await fetch(res.images[0].url, { signal: AbortSignal.timeout(120e3) })).arrayBuffer()));
    Object.assign(row, { status: 'settled', settled_usd: USD, seconds: (Date.now() - t0) / 1000 }); save();
    console.log('OK', id, ((Date.now() - t0) / 1000).toFixed(0), 's');
  } catch (e) {
    Object.assign(row, { status: e.unbilled ? 'failed-unbilled' : 'failed', ...(e.unbilled ? { settled_usd: 0 } : {}), error: String(e.message).slice(0, 300) }); save();
    console.error('FAILED', id, row.error);
  }
}
console.log('SPENT', spent().toFixed(2), 'of', CAP);
