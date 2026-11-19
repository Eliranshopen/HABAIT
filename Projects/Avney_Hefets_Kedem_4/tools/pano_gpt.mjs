/* pano_gpt.mjs - a whole Cycles panorama made photoreal by openai/gpt-image-2.5/sunburst/edit at 4096x2048 (2026-11-18, the 360 version;
   a teammate session found it kept every item in place on a panorama, unlike nano-banana / seedream). NO reference picture: every editor
   given Eliran's photo copied its composition (bake-off in memory). The look comes from his materials and furniture already in the render.
   Ledger tools/catalog/ledger-pano.json (cap $10), reserved before, settled after. Dry by default; --go sends.
   Usage: node tools/pano_gpt.mjs <room> [--go]   -> work/pano-ai/<room>_gpt.jpg                                                     */
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import { fileURLToPath } from 'node:url';
import { loadEnv } from 'file:///C:/RnD/.wt/kedma-d1/Projects/3Dengine/pipeline/Habait/tour360/tools/file-ledger.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url)), PROJ = path.resolve(HERE, '..');
const ROOM = process.argv[2], GO = process.argv.includes('--go');
const src = path.join(PROJ, 'out', 'avnei-hefetz-kedem', 'buildings-1-2', '4-rooms', 'renders', 'pano', ROOM + '.png'); const out = path.join(PROJ, 'work', 'pano-ai', `${ROOM}_gpt.jpg`);
const EP = 'openai/gpt-image-2.5/sunburst/edit', USD = 1.20;
const PROMPT = [
  'This is a 360-degree equirectangular panorama (2:1) of an apartment interior, rendered in 3D. Turn it into a real 360 photograph taken by a',
  'professional real-estate photographer: real matte plaster walls, real light natural oak floor grain, real bouclé, linen and wood textures,',
  'soft natural daylight, soft contact shadows, gentle reflections, natural light falloff, no CG look.',
  'STRICT: keep the equirectangular projection, the horizon, the curvature and the left/right edges that meet seamlessly. Keep every wall,',
  'corner, window, door, opening, ceiling light and every piece of furniture and decor exactly where it is, at the same size, shape and colour.',
  'Keep the windows and what is seen through them exactly as they are (bright soft daylight haze): do not add a city, a landscape or any view.',
  'Do not add, remove, move or resize anything. No new objects, no skirting boards, no people, no text.',
].join(' ');
const lp = path.join(HERE, 'catalog', 'ledger-pano.json'); const L = JSON.parse(fs.readFileSync(lp, 'utf8'));
const save = () => fs.writeFileSync(lp, JSON.stringify(L, null, 1)); const spent = () => L.rows.reduce((t, r) => t + (r.status === 'failed-unbilled' ? 0 : (r.settled_usd ?? r.reserved_usd)), 0);
const A = fs.readFileSync(src); const ih = crypto.createHash('sha256').update(EP + PROMPT).update(A).digest('hex');
console.log(JSON.stringify({ room: ROOM, endpoint: EP, usd: USD, spent_before: +spent().toFixed(2), cap: L.cap_usd, mode: GO ? 'GO' : 'dry-run' }));
if (L.rows.find((r) => r.inputs_hash === ih && r.status === 'settled') && fs.existsSync(out)) { console.log('CACHED $0'); process.exit(0); }
if (spent() + USD > L.cap_usd) { console.error('REFUSED: over the cap'); process.exit(2); }
if (!GO) process.exit(0);
const H = { Authorization: `Key ${loadEnv('C:/RnD').FAL_KEY}`, 'Content-Type': 'application/json' };
const row = { seq: L.rows.length + 1, at: new Date().toISOString(), item: ROOM, op: 'pano-gpt', model: EP, reserved_usd: USD, status: 'reserved', inputs_hash: ih }; L.rows.push(row); save();
try {
  const r = await fetch(`https://queue.fal.run/${EP}`, { method: 'POST', headers: H, body: JSON.stringify({ prompt: PROMPT, image_urls: [`data:image/png;base64,${A.toString('base64')}`], image_size: { width: 4096, height: 2048 }, quality: 'high', output_format: 'jpeg', num_images: 1 }) });
  const t = await r.text(); if (!r.ok) throw new Error(`submit HTTP ${r.status}: ${t.slice(0, 300)}`); const q = JSON.parse(t); row.queue = { request_id: q.request_id }; save();
  for (let i = 0; i < 200; i++) { await new Promise((ok) => setTimeout(ok, 4000)); const st = await (await fetch(q.status_url, { headers: H })).json(); if (st.status === 'COMPLETED') break; if (!['IN_QUEUE', 'IN_PROGRESS'].includes(st.status)) throw new Error('status ' + JSON.stringify(st).slice(0, 300)); }
  const res = await (await fetch(q.response_url, { headers: H })).json(); if (!res.images) throw new Error('result ' + JSON.stringify(res).slice(0, 300));
  fs.writeFileSync(out, Buffer.from(await (await fetch(res.images[0].url)).arrayBuffer()));
  Object.assign(row, { status: 'settled', settled_usd: USD, out }); save(); console.log('OK', out);
} catch (e) { const unb = String(e.message).includes('submit HTTP 4'); Object.assign(row, { status: unb ? 'failed-unbilled' : 'failed', settled_usd: unb ? 0 : undefined, error: String(e.message).slice(0, 300) }); save(); console.error('FAILED', e.message); process.exit(1); }
