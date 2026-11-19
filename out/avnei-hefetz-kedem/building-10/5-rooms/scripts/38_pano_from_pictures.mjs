/* Step 38 (PAID, fal, $1.20 a room) - the 360 rebuilt with Eliran's picture as the design of record: GPT Image 2.5 gets the render
   panorama (walls, openings, sizes and where each piece stands, from the sales plan) and his picture of the room, and renders every piece
   as the exact piece in his picture. Eliran 2026-11-18: «התמונות בהדמייה נראות זולות … תתבסס על התמונות שסיפקתי … תהפוך אותן
   לאיכותיות וריאליסטיות יותר»; dialog: all 10 rooms without stopping, 360 cap $40. Out: work/pano/gpt25b/<id>.png.
   Usage: node scripts/38_pano_from_pictures.mjs <job root> <id[,id]> [--go]                                                           */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadEnv } from 'file:///C:/RnD/Projects/3Dengine/pipeline/Habait/tour360/tools/file-ledger.mjs';

const args = process.argv.slice(2);
const [ROOT, ids] = args.filter((a) => !a.startsWith('--')); const GO = args.includes('--go');
const CAP = 65, USD = 1.20, EP = 'openai/gpt-image-2.5/sunburst/edit';
const REF = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(ROOT, 'work/pano/polish_manifest.json'), 'utf8')).map((v) => [v.name.split('_')[0], v.ref]));   // step 32's room → picture
REF.corridor ??= REF.living;   // the corridor (2026-11-19, no picture of its own): the living-room picture, same walls and floor
const PROMPT = [
  'Image 1 is an equirectangular 360-degree panorama (2:1, full sphere) of an apartment room, rendered from an exact 3D model of the sales plan:',
  'it fixes the walls, openings, room size and the place and size of every piece of furniture. Image 2 is the developer photoreal render of',
  'this room and is the design of record. Re-render image 1 as a real, high-end professional 360-degree interior photograph in which every piece',
  'of furniture, fixture and decor is the exact piece shown in image 2 - same design, proportions, upholstery, wood, metal, colours and details -',
  'standing at the place and size of its counterpart in image 1. Walls, floor, ceiling, cabinets, worktops and fittings take the materials and',
  'finish of image 2. STRICT: keep the equirectangular projection (straight verticals, horizon in the middle, the left and right edges join',
  'seamlessly); keep every wall, opening, door and window exactly where image 1 has it; never add or remove walls or rooms; a piece of image 2',
  'with no counterpart in image 1 is not added; no skirting boards. Bright real daylight, soft contact shadows, gentle bounce light, natural',
  'reflections on the floor, crisp fine detail and texture everywhere. No people, no text, no logo, no watermark.',
].join(' ');
const FRIDGE = new Set(['kitchen', 'living', 'dining', 'entrance']);   // Eliran 2026-11-19: the plan's refrigerator, never a TV wall
const NOTE = ' The tall unit at the end of the kitchen counter is the built-in refrigerator from the sales plan: on its kitchen side the stainless steel double-door fridge with a white cabinet above, its other sides plain white panels. Keep it exactly so: no TV, no screen, no art, no shelf and nothing hung on it.';
const dir = path.join(ROOT, 'work/pano'), out = path.join(dir, 'gpt25b'); fs.mkdirSync(out, { recursive: true });
const LP = path.join(dir, 'ledger.json'); const L = JSON.parse(fs.readFileSync(LP, 'utf8')); L.cap_usd = 40;
const save = () => fs.writeFileSync(LP, JSON.stringify(L, null, 1));
const spent = () => L.rows.reduce((t, r) => t + (r.status === 'failed-unbilled' ? 0 : (r.settled_usd ?? r.reserved_usd)), 0);
const refs = fs.readdirSync(dir).filter((f) => f.startsWith('ref_') && f.endsWith('.jpg'));
let env = null;
const H = () => { env ??= loadEnv('C:/RnD'); if (!env.FAL_KEY) throw new Error('FAL_KEY missing (by name)'); return { Authorization: `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' }; };
const { execFileSync } = await import('node:child_process');
for (const id of ids.split(',')) {
  const jp = path.join(out, `${id}_in.jpg`);
  if (!fs.existsSync(jp)) execFileSync('python', ['-c', `from PIL import Image; Image.open(r'''${path.join(dir, args.includes('--base') ? args[args.indexOf('--base') + 1] : 'base', id + '.png')}''').convert('RGB').save(r'''${jp}''', quality=92)`]);
  const A = fs.readFileSync(jp), B = fs.readFileSync(path.join(dir, refs.find((f) => f.includes(`_-_${REF[id]}_`))));
  const o = path.join(out, `${id}.png`);
  const PR = PROMPT + (FRIDGE.has(id) ? NOTE : '');
  const body = { prompt: PR, image_urls: [`data:image/jpeg;base64,${A.toString('base64')}`, `data:image/jpeg;base64,${B.toString('base64')}`], image_size: { width: 4096, height: 2048 }, quality: 'high', num_images: 1, output_format: 'png' };
  const hash = crypto.createHash('sha256').update(EP).update(PR).update(A).update(B).digest('hex');
  if (L.rows.find((r) => r.inputs_hash === hash && r.status === 'settled' && fs.existsSync(r.out))) { console.log('CACHED', id); continue; }
  if (spent() + USD > CAP + 1e-9) { console.error('REFUSED: over the cap at', id, spent().toFixed(2)); process.exit(2); }
  if (!GO) { console.log('DRY', id, USD, 'spent', spent().toFixed(2)); continue; }
  const row = { seq: L.rows.length + 1, at: new Date().toISOString(), view: `gpt25b:${id}`, model: EP, reserved_usd: USD, status: 'reserved', inputs_hash: hash, out: o }; L.rows.push(row); save();
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
