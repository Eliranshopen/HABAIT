/* bakeoff.mjs - one item (his sofa) through the other image-to-3D models from the 2026-11-18 research, same 4 studio views
   (front/back/left/right from tools/catalog/gen_item.mjs), so Eliran can choose by the result («זה נראה על הפנים … לא כמו ריהוט אמיתי»).
   Models: Rodin 2.5 High + HD texture + HighPack ($1.20) · Meshy 7.1 multi-image PBR ($1.20) · Hitem3D 3.0 multi-view 2048quality ($2.10).
   Ledger tools/catalog/ledger-bakeoff.json (cap $5), reserved before, settled after. Dry by default; --go sends.
   Usage: node tools/catalog/bakeoff.mjs <item-id> <rodin|meshy|hitem> [--go]                                                   */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'file:///C:/RnD/.wt/kedma-d1/Projects/3Dengine/pipeline/Habait/tour360/tools/file-ledger.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url)); const ST = path.resolve(HERE, '..', '..', 'work', 'catalog', 'studio'); const OUT = path.resolve(HERE, '..', '..', 'work', 'catalog', 'bakeoff');
const [ID, MODEL] = process.argv.slice(2); const GO = process.argv.includes('--go');
const du = (k) => `data:image/png;base64,${fs.readFileSync(path.join(ST, k ? `${ID}_${k}.png` : `${ID}.png`)).toString('base64')}`;
const SPEC = {
  rodin: { endpoint: 'fal-ai/hyper3d/rodin/v2.5', usd: 1.20, body: () => ({ image_urls: [du(), du('back'), du('left'), du('right')], tier: 'Gen-2.5-High', hd_texture: true, material: 'PBR', texture_delight: true, quality_mesh_option: '150K Triangle', geometry_file_format: 'glb', addons: 'HighPack' }) },
  meshy: { endpoint: 'meshy/v7.1/multi-image-to-3d', usd: 1.20, body: () => ({ image_urls: [du(), du('back'), du('left'), du('right')], enable_pbr: true, should_texture: true, topology: 'triangle', target_polycount: 150000, symmetry_mode: 'auto' }) },
  hitem: { endpoint: 'hitem3d/hi3d/v3.0/multi-view-to-3d', usd: 2.10, body: () => ({ front_image_url: du(), back_image_url: du('back'), left_image_url: du('left'), right_image_url: du('right'), resolution: '2048quality', enable_texture: true, enable_pbr: true, export_format: 'glb', face_count: 300000 }) },
};
const m = SPEC[MODEL]; if (!m) { console.error('model: rodin | meshy | hitem'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const lp = path.join(HERE, 'ledger-bakeoff.json'); const L = fs.existsSync(lp) ? JSON.parse(fs.readFileSync(lp, 'utf8')) : { $schema: 'tour360/ledger.v1', cap_usd: 5.0, note: 'Eliran 2026-11-18: the sofa through three more 3D models (inside his ~$20 «upgrade the walk»)', rows: [] };
const save = () => fs.writeFileSync(lp, JSON.stringify(L, null, 1)); const spent = () => L.rows.reduce((t, r) => t + (r.status === 'failed-unbilled' ? 0 : (r.settled_usd ?? r.reserved_usd)), 0);
const body = m.body(); const ih = crypto.createHash('sha256').update(m.endpoint).update(JSON.stringify(body)).digest('hex');
const out = path.join(OUT, `${ID}_${MODEL}.glb`);
console.log(JSON.stringify({ id: ID, model: MODEL, endpoint: m.endpoint, usd: m.usd, spent_before: +spent().toFixed(2), cap: L.cap_usd, mode: GO ? 'GO' : 'dry-run', exists: fs.existsSync(out) }));
if (L.rows.find((r) => r.inputs_hash === ih && r.status === 'settled')) { console.log('CACHED - $0'); process.exit(0); }
if (spent() + m.usd > L.cap_usd) { console.error('REFUSED: over the cap'); process.exit(2); }
if (!GO) process.exit(0);
const env = loadEnv('C:/RnD'); const H = { Authorization: `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' };
let row = L.rows.find((r) => r.inputs_hash === ih && r.queue && r.status !== 'settled');
if (!row) { row = { seq: L.rows.length + 1, at: new Date().toISOString(), item: ID, op: MODEL, model: m.endpoint, reserved_usd: m.usd, status: 'reserved', inputs_hash: ih }; L.rows.push(row); save(); }
const findGlb = (o) => { if (!o || typeof o !== 'object') return null; for (const v of Object.values(o)) { if (v && typeof v === 'object' && typeof v.url === 'string' && /\.glb(\?|$)/i.test(v.url)) return v.url; const r = findGlb(v); if (r) return r; } return null; };
try {
  if (!row.queue) { const r = await fetch(`https://queue.fal.run/${m.endpoint}`, { method: 'POST', headers: H, body: JSON.stringify(body) }); const t = await r.text(); if (!r.ok) throw new Error(`submit HTTP ${r.status}: ${t.slice(0, 200)}`); const q = JSON.parse(t); row.queue = { request_id: q.request_id, status_url: q.status_url, response_url: q.response_url }; save(); }
  const t0 = Date.now();
  for (;;) { if (Date.now() - t0 > 14 * 60e3) throw new Error('timeout; collect later with the same command'); await new Promise((ok) => setTimeout(ok, 5000)); let st = {}; try { st = await (await fetch(row.queue.status_url, { headers: H })).json(); } catch { continue; } if (st.status === 'COMPLETED') break; if (st.status && !['IN_QUEUE', 'IN_PROGRESS'].includes(st.status)) throw new Error('status ' + JSON.stringify(st).slice(0, 200)); }
  const res = await (await fetch(row.queue.response_url, { headers: H })).json(); fs.writeFileSync(out + '.json', JSON.stringify(res, null, 1));
  const url = findGlb(res); if (!url) throw new Error('no .glb in the result: ' + JSON.stringify(res).slice(0, 300));
  fs.writeFileSync(out, Buffer.from(await (await fetch(url)).arrayBuffer())); Object.assign(row, { status: 'settled', settled_usd: m.usd, seconds: (Date.now() - t0) / 1000, out }); save();
  console.log(`OK ${MODEL} ${Math.round((Date.now() - t0) / 1000)} s -> ${out} (${Math.round(fs.statSync(out).size / 1e6)} MB)`);
} catch (e) { const unb = String(e.message).includes('submit HTTP 4'); Object.assign(row, { status: unb ? 'failed-unbilled' : 'failed', settled_usd: unb ? 0 : undefined, error: String(e.message).slice(0, 300) }); save(); console.error('FAILED', e.message); process.exit(1); }
