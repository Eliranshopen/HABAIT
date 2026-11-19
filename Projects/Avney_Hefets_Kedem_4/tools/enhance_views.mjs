/* enhance_views.mjs - each perspective view of a panorama (pano_views.py cut) made photoreal against Eliran's picture of the same room
   (2026-11-18, the 360 version; replaces the whole-panorama edit, which squashed the projection and invented a second sofa).
   fal-ai/nano-banana-pro/edit, 2K, 1:1, $0.15 a view. Ledger tools/catalog/ledger-pano.json (cap $10), reserved before, settled after.
   Dry by default; --go sends. Usage: node tools/enhance_views.mjs <room> [--go] [--only front,right] [--seed N]                    */
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import { execFileSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
import { loadEnv } from 'file:///C:/RnD/.wt/kedma-d1/Projects/3Dengine/pipeline/Habait/tour360/tools/file-ledger.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url)), PROJ = path.resolve(HERE, '..');
const PICS = 'C:/RnD/Projects/Avney_Hefets_Kedem_4/בניין 1 קומה א דירה 7';
const REF = { living: '01 סלון', dining: '03 פינת אוכל', kitchen: '02 מטבח', foyer: '04 מסדרון', corridor: '04 מסדרון', master: '05 חדר שינה הורים', ensuite: '06 מקלחת הורים', mamad: '07 חדר שינה ממד', bath: '08 חדר רחצה', bedroom: '09 חדר שינה 335-270', balcony: '10 מרפסת' };
const args = process.argv.slice(2), ROOM = args.find((a) => !a.startsWith('--') && !/^\d|,/.test(a) && REF[a]), GO = args.includes('--go');
const SEED = args.includes('--seed') ? Number(args[args.indexOf('--seed') + 1]) : 7;
if (!ROOM) { console.error('room: ' + Object.keys(REF).join(', ')); process.exit(2); }
const D = path.join(PROJ, 'work', 'pano-ai', `${ROOM}_v8`);
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : JSON.parse(fs.readFileSync(path.join(D, 'views.json'), 'utf8')).views.map((v) => v[0]);
const refPath = ROOM === 'balcony' ? `C:/RnD/Projects/Avney_Hefets_Kedem_4/בניין 1 קומה א דירה 7 - ${REF[ROOM]}.png` : path.join(PICS, `בניין 1 קומה א דירה 7 - ${REF[ROOM]}.png`);
const ref = path.join(D, 'ref.jpg');
if (!fs.existsSync(ref)) execFileSync('python', ['-I', '-c', "import sys\nfrom PIL import Image\nr=Image.open(sys.argv[1]).convert('RGB'); r.thumbnail((1600,1600)); r.save(sys.argv[2],quality=90)", refPath, ref]);
const NOREF = args.includes('--noref');
const FPROMPT = 'professional real-estate interior photograph, Canon EOS R5, 16mm, natural soft daylight, warm white matte plaster walls, light natural oak plank floor with fine grain, cream boucle upholstery, linen, oak furniture, travertine, subtle contact shadows, realistic materials, photorealistic, sharp, high dynamic range';
const PROMPT = (down) => [
  `Image 1 is a ${down ? 'straight-down view of the floor' : 'wide-angle (100 degree) view'} of an apartment interior rendered in 3D.`,
  NOREF ? 'Turn this image into a real photograph, like a high-end real-estate photo shoot: warm white walls, light natural oak floor, cream bouclé and linen upholstery, oak furniture, soft natural daylight. This is a photo-retouch of THIS exact image, not a new picture.' : 'Turn image 1 into a real photograph, like a high-end real-estate photo shoot, in the exact style, materials, colours and soft natural daylight of image 2 (a photo of the same room).',
  'Keep the camera, framing, perspective and lens distortion of image 1 EXACTLY: every wall edge, corner, window, door, opening, ceiling line and every piece of furniture stays at the same pixel position, size and shape.',
  'Do not add, remove, move or resize anything. No new furniture, no new decor, no new windows or doors, no people. No skirting boards between wall and floor.',
  'Improve only realism: real fabric texture (bouclé, linen), real oak grain, real stone, soft contact shadows, gentle floor reflections, natural light falloff, no CG look.',
].join(' ');
const lp = path.join(HERE, 'catalog', 'ledger-pano.json'); const L = JSON.parse(fs.readFileSync(lp, 'utf8'));
const save = () => fs.writeFileSync(lp, JSON.stringify(L, null, 1)); const spent = () => L.rows.reduce((t, r) => t + (r.status === 'failed-unbilled' ? 0 : (r.settled_usd ?? r.reserved_usd)), 0);
// --flux S: fal-ai/flux/dev/image-to-image at strength S (structure-locked: low strength cannot move objects); ~$0.025/MP, ledgered at $0.075
const FLUX = args.includes('--flux') ? Number(args[args.indexOf('--flux') + 1]) : 0;
const USD = FLUX ? 0.075 : 0.15, EP = FLUX ? 'fal-ai/flux/dev/image-to-image' : 'fal-ai/nano-banana-pro/edit';
const env = GO ? loadEnv('C:/RnD') : {}; const H = { Authorization: `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' };
const du = (f, t) => `data:image/${t};base64,${fs.readFileSync(f).toString('base64')}`;
let fail = 0;
await Promise.all(ONLY.map(async (name) => {
  const v = path.join(D, `v_${name}.png`), out = path.join(D, FLUX ? `f${Math.round(FLUX * 100)}_${name}.jpg` : NOREF ? `n_${name}.jpg` : `e_${name}.jpg`); const P = PROMPT(name === 'down');
  const ih = crypto.createHash('sha256').update(EP + P + SEED + FLUX).update(fs.readFileSync(v)).update(NOREF ? 'noref' : fs.readFileSync(ref)).digest('hex');
  if (L.rows.find((r) => r.inputs_hash === ih && r.status === 'settled') && fs.existsSync(out)) { console.log(name, 'CACHED $0'); return; }
  if (spent() + USD > L.cap_usd) { console.error(name, 'REFUSED: over the cap', spent().toFixed(2)); fail++; return; }
  console.log(JSON.stringify({ room: ROOM, view: name, usd: USD, spent_before: +spent().toFixed(2), cap: L.cap_usd, mode: GO ? 'GO' : 'dry-run' }));
  if (!GO) return;
  const row = { seq: L.rows.length + 1, at: new Date().toISOString(), item: `${ROOM}/${name}`, op: 'pano-view', model: EP, reserved_usd: USD, status: 'reserved', inputs_hash: ih, seed: SEED }; L.rows.push(row); save();
  try {
    const r = await fetch(`https://queue.fal.run/${EP}`, { method: 'POST', headers: H, body: JSON.stringify(FLUX ? { prompt: FPROMPT, image_url: du(v, 'png'), strength: FLUX, num_inference_steps: 40, guidance_scale: 3.5, output_format: 'jpeg', seed: SEED } : { prompt: P, image_urls: NOREF ? [du(v, 'png')] : [du(v, 'png'), du(ref, 'jpeg')], num_images: 1, resolution: '2K', aspect_ratio: '1:1', output_format: 'jpeg', seed: SEED }) });
    const t = await r.text(); if (!r.ok) throw new Error(`submit HTTP ${r.status}: ${t.slice(0, 200)}`); const q = JSON.parse(t); row.queue = { request_id: q.request_id }; save();
    for (let i = 0; i < 200; i++) { await new Promise((ok) => setTimeout(ok, 4000)); const st = await (await fetch(q.status_url, { headers: H })).json(); if (st.status === 'COMPLETED') break; if (!['IN_QUEUE', 'IN_PROGRESS'].includes(st.status)) throw new Error('status ' + JSON.stringify(st).slice(0, 200)); }
    const res = await (await fetch(q.response_url, { headers: H })).json();
    fs.writeFileSync(out, Buffer.from(await (await fetch(res.images[0].url)).arrayBuffer()));
    Object.assign(row, { status: 'settled', settled_usd: USD, out }); save(); console.log(name, 'OK');
  } catch (e) { const unb = String(e.message).includes('submit HTTP 4'); Object.assign(row, { status: unb ? 'failed-unbilled' : 'failed', settled_usd: unb ? 0 : undefined, error: String(e.message).slice(0, 300) }); save(); console.error(name, 'FAILED', e.message); fail++; }
}));
process.exit(fail ? 1 : 0);
