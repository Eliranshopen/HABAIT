/* enhance_pano.mjs - a Cycles panorama made photoreal against Eliran's picture of the same room (2026-11-18, the 360 version).
   The 2:1 panorama is padded into 21:9 (nano-banana-pro has no 2:1), sent with his picture as the style reference to
   fal-ai/nano-banana-pro/edit at 4K, cropped back to 2:1. Geometry, layout and furniture must stay; only realism, materials and light.
   Ledger tools/catalog/ledger-pano.json (cap $10), reserved before, settled after. Dry by default; --go sends.
   Usage: node tools/enhance_pano.mjs <room> [--go] [--seed N]                                                                    */
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import { execFileSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
import { loadEnv } from 'file:///C:/RnD/.wt/kedma-d1/Projects/3Dengine/pipeline/Habait/tour360/tools/file-ledger.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url)), PROJ = path.resolve(HERE, '..');
const PANO = path.join(PROJ, 'out', 'avnei-hefetz-kedem', 'buildings-1-2', '4-rooms', 'renders', 'pano'); const OUT = path.join(PROJ, 'work', 'pano-ai');
const PICS = 'C:/RnD/Projects/Avney_Hefets_Kedem_4/בניין 1 קומה א דירה 7';
const REF = { living: '01 סלון', dining: '03 פינת אוכל', kitchen: '02 מטבח', foyer: '04 מסדרון', corridor: '04 מסדרון', master: '05 חדר שינה הורים', ensuite: '06 מקלחת הורים', mamad: '07 חדר שינה ממד', bath: '08 חדר רחצה', bedroom: '09 חדר שינה 335-270', balcony: '10 מרפסת' };
const args = process.argv.slice(2), ROOM = args.find((a) => !a.startsWith('--')), GO = args.includes('--go'), SEED = args.includes('--seed') ? Number(args[args.indexOf('--seed') + 1]) : 7;
if (!REF[ROOM]) { console.error('room: ' + Object.keys(REF).join(', ')); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const src = path.join(PANO, ROOM + '.png'); const refPath = ROOM === 'balcony' ? `C:/RnD/Projects/Avney_Hefets_Kedem_4/בניין 1 קומה א דירה 7 - ${REF[ROOM]}.png` : path.join(PICS, `בניין 1 קומה א דירה 7 - ${REF[ROOM]}.png`);
const padded = path.join(OUT, `${ROOM}_pad.jpg`), ref = path.join(OUT, `${ROOM}_ref.jpg`), outF = path.join(OUT, `${ROOM}.jpg`);
// pad 2:1 to 21:9 with a neutral band top and bottom (the model returns the same frame; we crop the band away)
execFileSync('python', ['-I', '-c', `import sys
from PIL import Image
p=Image.open(sys.argv[1]).convert('RGB'); W,H=p.size; H2=round(W*9/21); c=Image.new('RGB',(W,H2),(128,128,128)); c.paste(p,(0,(H2-H)//2)); c.save(sys.argv[2],quality=93)
r=Image.open(sys.argv[3]).convert('RGB'); r.thumbnail((1600,1600)); r.save(sys.argv[4],quality=90)`, src, padded, refPath, ref]);
const PROMPT = [
  'Image 1 is a 360-degree equirectangular panorama of an apartment interior rendered in 3D, padded with grey bands at the top and bottom.',
  'Make image 1 photorealistic, like a high-end real-estate photograph, in the exact style, materials, colours and soft natural light of image 2 (the reference photo of the same room).',
  'Keep EVERYTHING in image 1 in exactly the same place and shape: walls, ceiling, windows, doors, openings, every piece of furniture and its position, the equirectangular projection and its curvature, the horizon line, the left and right edges (they must still meet seamlessly).',
  'Do not add, remove or move any object, wall, window or door. Do not change the room. Improve only realism: real fabric texture (bouclé, linen), real wood grain, real stone, soft shadows, gentle reflections on the floor, natural daylight from the windows.',
  'Keep the grey bands at the top and bottom unchanged.',
].join(' ');
const lp = path.join(HERE, 'catalog', 'ledger-pano.json'); const L = fs.existsSync(lp) ? JSON.parse(fs.readFileSync(lp, 'utf8')) : { $schema: 'tour360/ledger.v1', cap_usd: 10, note: 'Eliran 2026-11-18: the 360 version, panoramas made photoreal against his room pictures', rows: [] };
const save = () => fs.writeFileSync(lp, JSON.stringify(L, null, 1)); const spent = () => L.rows.reduce((t, r) => t + (r.status === 'failed-unbilled' ? 0 : (r.settled_usd ?? r.reserved_usd)), 0);
const USD = 0.30, EP = 'fal-ai/nano-banana-pro/edit';
const ih = crypto.createHash('sha256').update(EP + PROMPT + SEED).update(fs.readFileSync(padded)).update(fs.readFileSync(ref)).digest('hex');
console.log(JSON.stringify({ room: ROOM, endpoint: EP, usd: USD, spent_before: +spent().toFixed(2), cap: L.cap_usd, mode: GO ? 'GO' : 'dry-run' }));
if (L.rows.find((r) => r.inputs_hash === ih && r.status === 'settled')) { console.log('CACHED - $0'); process.exit(0); }
if (spent() + USD > L.cap_usd) { console.error('REFUSED: over the cap'); process.exit(2); }
if (!GO) process.exit(0);
const env = loadEnv('C:/RnD'); const H = { Authorization: `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' };
const du = (f) => `data:image/jpeg;base64,${fs.readFileSync(f).toString('base64')}`;
const row = { seq: L.rows.length + 1, at: new Date().toISOString(), item: ROOM, op: 'pano', model: EP, reserved_usd: USD, status: 'reserved', inputs_hash: ih, seed: SEED }; L.rows.push(row); save();
try {
  const r = await fetch(`https://queue.fal.run/${EP}`, { method: 'POST', headers: H, body: JSON.stringify({ prompt: PROMPT, image_urls: [du(padded), du(ref)], num_images: 1, resolution: '4K', aspect_ratio: '21:9', output_format: 'jpeg', seed: SEED }) });
  const t = await r.text(); if (!r.ok) throw new Error(`submit HTTP ${r.status}: ${t.slice(0, 200)}`); const q = JSON.parse(t); row.queue = { request_id: q.request_id }; save();
  for (let i = 0; i < 200; i++) { await new Promise((ok) => setTimeout(ok, 4000)); const st = await (await fetch(q.status_url, { headers: H })).json(); if (st.status === 'COMPLETED') break; if (!['IN_QUEUE', 'IN_PROGRESS'].includes(st.status)) throw new Error('status ' + JSON.stringify(st).slice(0, 200)); }
  const res = await (await fetch(q.response_url, { headers: H })).json(); const raw = path.join(OUT, `${ROOM}_raw.jpg`);
  fs.writeFileSync(raw, Buffer.from(await (await fetch(res.images[0].url)).arrayBuffer()));
  execFileSync('python', ['-I', '-c', `import sys
from PIL import Image
a=Image.open(sys.argv[1]).convert('RGB'); W,H=a.size; h=round(W/2); y=(H-h)//2; a.crop((0,y,W,y+h)).save(sys.argv[2],quality=92)`, raw, outF]);
  Object.assign(row, { status: 'settled', settled_usd: USD, out: outF }); save(); console.log('OK', outF);
} catch (e) { const unb = String(e.message).includes('submit HTTP 4'); Object.assign(row, { status: unb ? 'failed-unbilled' : 'failed', settled_usd: unb ? 0 : undefined, error: String(e.message).slice(0, 300) }); save(); console.error('FAILED', e.message); process.exit(1); }
