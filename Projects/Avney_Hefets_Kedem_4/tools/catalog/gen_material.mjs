/* gen_material.mjs - a seamless PBR material from a crop of Eliran's pictures (2026-11-18, his pick «upgrade the walk»):
   fal-ai/patina/material/extract: the crop -> tileable basecolor / normal / roughness / metalness / height maps ($0.17 at 1024 with 5 maps).
   Ledger tools/catalog/ledger-materials.json (cap $2), reserved before the call, settled after; dry-run by default, --go sends.
   Usage: node tools/catalog/gen_material.mjs <material-id> [--go]                                                                  */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'file:///C:/RnD/.wt/kedma-d1/Projects/3Dengine/pipeline/Habait/tour360/tools/file-ledger.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'work', 'materials');
const PICS = 'C:/RnD/Projects/Avney_Hefets_Kedem_4/בניין 1 קומה א דירה 7';
const MATS = {
  oak_floor: { pic: 'בניין 1 קומה א דירה 7 - 02 מטבח.png', box: [520, 600, 960, 714], prompt: 'wide light natural oak engineered wood floor planks, matte oiled finish, long boards with fine grain, seen straight from above, seamless tileable texture' },
  travertine: { pic: 'בניין 1 קומה א דירה 7 - 08 חדר רחצה.png', box: [140, 90, 360, 300], prompt: 'honed beige travertine stone tile surface with soft horizontal veins and small natural pores, seen straight on, seamless tileable texture' },
  boucle: { pic: 'בניין 1 קומה א דירה 7 - 01 סלון.png', box: [905, 505, 1085, 600], prompt: 'cream white bouclé upholstery fabric with dense curly wool loops, close-up, even soft light, seamless tileable texture' },
  rug_wool: { pic: 'בניין 1 קומה א דירה 7 - 01 סלון.png', box: [450, 585, 700, 714], prompt: 'cream textured wool rug with a fine bouclé loop weave, seen straight from above, seamless tileable texture' },
};
const args = process.argv.slice(2); const ID = args.find((a) => !a.startsWith('--')); const GO = args.includes('--go');
const m = MATS[ID]; if (!m) { console.error('materials: ' + Object.keys(MATS).join(', ')); process.exit(2); }
const ENDPOINT = 'fal-ai/patina/material/extract', USD = 0.17, CAP = 2.0;
fs.mkdirSync(path.join(OUT, ID), { recursive: true });
const crop = path.join(OUT, ID, 'crop.png');
if (!fs.existsSync(crop)) execFileSync('python', ['-I', '-c', "import sys;from PIL import Image;im=Image.open(sys.argv[1]);k=im.width/1280;b=[int(float(v)*k) for v in sys.argv[3].split(',')];im.crop(b).convert('RGB').save(sys.argv[2])", path.join(PICS, m.pic), crop, m.box.join(',')]);
const lp = path.join(HERE, 'ledger-materials.json');
const ledger = fs.existsSync(lp) ? JSON.parse(fs.readFileSync(lp, 'utf8')) : { $schema: 'tour360/ledger.v1', cap_usd: CAP, note: 'Eliran 2026-11-18 «upgrade the walk»: seamless PBR materials from his pictures (fal patina)', rows: [] };
const save = () => fs.writeFileSync(lp, JSON.stringify(ledger, null, 1));
const spent = () => ledger.rows.reduce((t, r) => t + (r.status === 'failed-unbilled' ? 0 : (r.settled_usd ?? r.reserved_usd)), 0);
const body = { image_url: `data:image/png;base64,${fs.readFileSync(crop).toString('base64')}`, prompt: m.prompt, maps: ['basecolor', 'normal', 'roughness', 'height'], tiling_mode: 'both', image_size: 'square_hd', output_format: 'jpeg', seed: 7 };
const ih = crypto.createHash('sha256').update(ENDPOINT).update(m.prompt).update(fs.readFileSync(crop)).digest('hex');
const done = ledger.rows.find((r) => r.inputs_hash === ih && r.status === 'settled');
console.log(JSON.stringify({ id: ID, endpoint: ENDPOINT, usd: USD, spent_before: +spent().toFixed(3), cap: CAP, cached: !!done, mode: GO ? 'GO' : 'dry-run' }));
if (done) { console.log('CACHED - $0'); process.exit(0); }
if (spent() + USD > CAP) { console.error('REFUSED: over the cap'); process.exit(2); }
if (!GO) process.exit(0);
const env = loadEnv('C:/RnD'); if (!env.FAL_KEY) { console.error('FAL_KEY: missing (by name)'); process.exit(1); }
const H = { Authorization: `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' };
const row = { seq: ledger.rows.length + 1, at: new Date().toISOString(), item: ID, op: 'material', model: ENDPOINT, reserved_usd: USD, status: 'reserved', inputs_hash: ih }; ledger.rows.push(row); save();
try {
  const r = await fetch(`https://queue.fal.run/${ENDPOINT}`, { method: 'POST', headers: H, body: JSON.stringify(body) }); const t = await r.text();
  if (!r.ok) throw new Error(`submit HTTP ${r.status}: ${t.slice(0, 200)}`);
  const q = JSON.parse(t); row.queue = { request_id: q.request_id }; save();
  for (let i = 0; i < 150; i++) { await new Promise((ok) => setTimeout(ok, 4000)); const st = await (await fetch(q.status_url, { headers: H })).json(); if (st.status === 'COMPLETED') break; if (!['IN_QUEUE', 'IN_PROGRESS'].includes(st.status)) throw new Error('status ' + JSON.stringify(st).slice(0, 200)); }
  const out = await (await fetch(q.response_url, { headers: H })).json();
  const files = [];
  for (const [i, im] of (out.images || []).entries()) {
    const name = (im.file_name || im.content_type || `map_${i}`).toString().replace(/[^a-z0-9_.-]/gi, '_');
    const f = path.join(OUT, ID, `${i}_${name}${name.endsWith('.jpg') || name.endsWith('.jpeg') ? '' : '.jpg'}`);
    fs.writeFileSync(f, Buffer.from(await (await fetch(im.url)).arrayBuffer())); files.push(f);
  }
  fs.writeFileSync(path.join(OUT, ID, 'result.json'), JSON.stringify({ request_id: q.request_id, images: (out.images || []).map((x) => ({ file_name: x.file_name, content_type: x.content_type, width: x.width, height: x.height })), files }, null, 1));
  Object.assign(row, { status: 'settled', settled_usd: USD, out: files }); save(); console.log('OK', files.length, 'maps');
} catch (e) {
  Object.assign(row, { status: String(e.message).includes('submit HTTP 4') ? 'failed-unbilled' : 'failed', settled_usd: String(e.message).includes('submit HTTP 4') ? 0 : undefined, error: String(e.message).slice(0, 300) }); save(); console.error('FAILED', e.message); process.exit(1);
}
