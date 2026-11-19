/* bakeoff_views.mjs - which fal model turns a Cycles view into a real photo in the style of Eliran's picture WITHOUT moving anything
   (2026-11-18, his word: «תבחר את המודל הטוב ביותר מFAL … על סמך התמונות שסיפקתי לך»). Same view + his living picture to each model.
   Out: work/pano-ai/<room>_v8/bo_<model>_<view>.jpg. Ledger tools/catalog/ledger-pano.json (cap $10), reserved before, settled after.
   Usage: node tools/bakeoff_views.mjs <room> <view,view> [--go]                                                                    */
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import { fileURLToPath } from 'node:url';
import { loadEnv } from 'file:///C:/RnD/.wt/kedma-d1/Projects/3Dengine/pipeline/Habait/tour360/tools/file-ledger.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url)), PROJ = path.resolve(HERE, '..');
const [ROOM, VIEWS] = process.argv.slice(2); const GO = process.argv.includes('--go');
const D = path.join(PROJ, 'work', 'pano-ai', `${ROOM}_v8`); const REF = path.join(PROJ, 'work', 'pano-ai', `${ROOM}_views`, 'ref.jpg');
const KEEP = 'Keep the camera, framing, perspective, every wall edge, window, door and every piece of furniture EXACTLY where it is, same size and shape. Do not add, remove or move anything. No new objects, no skirting boards.';
const P2 = `Make image 1 a real photograph (high-end real-estate photo) with the materials, colours and soft natural daylight of image 2, a photo of the same apartment. ${KEEP} Only realism changes: real plaster, real oak grain, real fabric, soft shadows.`;
const P1 = `Make this a real photograph (high-end real-estate photo): warm white plaster walls, light natural oak floor, cream bouclé and linen upholstery, oak furniture, soft natural daylight. ${KEEP} Only realism changes: real materials, soft shadows.`;
const du = (f) => `data:image/${f.endsWith('.png') ? 'png' : 'jpeg'};base64,${fs.readFileSync(f).toString('base64')}`;
const M = {
  kontextmax: { ep: 'fal-ai/flux-pro/kontext/max/multi', usd: 0.08, body: (v) => ({ prompt: P2, image_urls: [du(v), du(REF)], aspect_ratio: '1:1', output_format: 'jpeg', seed: 7 }) },
  kontext: { ep: 'fal-ai/flux-pro/kontext', usd: 0.04, body: (v) => ({ prompt: P1, image_url: du(v), aspect_ratio: '1:1', output_format: 'jpeg', seed: 7 }) },
  qwen: { ep: 'fal-ai/qwen-image-edit-plus', usd: 0.08, body: (v) => ({ prompt: P2, image_urls: [du(v), du(REF)], image_size: { width: 1536, height: 1536 }, output_format: 'jpeg', seed: 7 }) },
  seedream: { ep: 'fal-ai/bytedance/seedream/v4/edit', usd: 0.03, body: (v) => ({ prompt: P2, image_urls: [du(v), du(REF)], image_size: { width: 2048, height: 2048 }, seed: 7 }) },
  gemini: { ep: 'fal-ai/gemini-25-flash-image/edit', usd: 0.039, body: (v) => ({ prompt: P2, image_urls: [du(v), du(REF)], aspect_ratio: '1:1', output_format: 'jpeg', seed: 7 }) },
};
const lp = path.join(HERE, 'catalog', 'ledger-pano.json'); const L = JSON.parse(fs.readFileSync(lp, 'utf8'));
const save = () => fs.writeFileSync(lp, JSON.stringify(L, null, 1)); const spent = () => L.rows.reduce((t, r) => t + (r.status === 'failed-unbilled' ? 0 : (r.settled_usd ?? r.reserved_usd)), 0);
const env = GO ? loadEnv('C:/RnD') : {}; const H = { Authorization: `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' };
const jobs = []; for (const k of Object.keys(M)) for (const vn of VIEWS.split(',')) jobs.push([k, vn]);
console.log(JSON.stringify({ jobs: jobs.length, usd: +jobs.reduce((t, [k]) => t + M[k].usd, 0).toFixed(3), spent_before: +spent().toFixed(2), cap: L.cap_usd, mode: GO ? 'GO' : 'dry-run' }));
if (spent() + jobs.reduce((t, [k]) => t + M[k].usd, 0) > L.cap_usd) { console.error('REFUSED: over the cap'); process.exit(2); }
if (!GO) process.exit(0);
await Promise.all(jobs.map(async ([k, vn]) => {
  const m = M[k], v = path.join(D, `v_${vn}.png`), out = path.join(D, `bo_${k}_${vn}.jpg`);
  if (fs.existsSync(out)) { console.log(k, vn, 'exists $0'); return; }
  const body = m.body(v); const ih = crypto.createHash('sha256').update(m.ep + JSON.stringify(body)).digest('hex');
  const row = { seq: L.rows.length + 1, at: new Date().toISOString(), item: `${ROOM}/${vn}`, op: 'view-bakeoff', model: m.ep, reserved_usd: m.usd, status: 'reserved', inputs_hash: ih }; L.rows.push(row); save();
  try {
    const r = await fetch(`https://queue.fal.run/${m.ep}`, { method: 'POST', headers: H, body: JSON.stringify(body) }); const t = await r.text();
    if (!r.ok) throw new Error(`submit HTTP ${r.status}: ${t.slice(0, 200)}`); const q = JSON.parse(t); row.queue = { request_id: q.request_id }; save();
    for (let i = 0; i < 150; i++) { await new Promise((ok) => setTimeout(ok, 3000)); const st = await (await fetch(q.status_url, { headers: H })).json(); if (st.status === 'COMPLETED') break; if (!['IN_QUEUE', 'IN_PROGRESS'].includes(st.status)) throw new Error('status ' + JSON.stringify(st).slice(0, 200)); }
    const res = await (await fetch(q.response_url, { headers: H })).json(); const u = (res.images || [res.image])[0].url;
    fs.writeFileSync(out, Buffer.from(await (await fetch(u)).arrayBuffer())); Object.assign(row, { status: 'settled', settled_usd: m.usd, out }); save(); console.log(k, vn, 'OK');
  } catch (e) { const unb = String(e.message).includes('submit HTTP 4'); Object.assign(row, { status: unb ? 'failed-unbilled' : 'failed', settled_usd: unb ? 0 : undefined, error: String(e.message).slice(0, 300) }); save(); console.error(k, vn, 'FAILED', e.message.slice(0, 200)); }
}));
