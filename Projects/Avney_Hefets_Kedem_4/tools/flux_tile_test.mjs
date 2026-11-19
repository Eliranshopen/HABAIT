/* flux_tile_test.mjs - one test: flux-general img2img at strength S with a controlnet-union TILE lock on the render itself
   (2026-11-18, the 360 model bake-off). Ledger ledger-pano.json, $0.10 reserved. Usage: node tools/flux_tile_test.mjs <room> <view> <strength> [--go] */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { loadEnv } from 'file:///C:/RnD/.wt/kedma-d1/Projects/3Dengine/pipeline/Habait/tour360/tools/file-ledger.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url)); const [ROOM, VN, S] = process.argv.slice(2); const GO = process.argv.includes('--go');
const D = path.resolve(HERE, '..', 'work', 'pano-ai', `${ROOM}_v8`); const v = path.join(D, `v_${VN}.png`), out = path.join(D, `ft${Math.round(S * 100)}${process.env.CS ? 'c' + process.env.CS : ''}_${VN}.jpg`);
const EP = 'fal-ai/flux-general/image-to-image', USD = 0.10; const du = `data:image/png;base64,${fs.readFileSync(v).toString('base64')}`;
const lp = path.join(HERE, 'catalog', 'ledger-pano.json'); const L = JSON.parse(fs.readFileSync(lp, 'utf8')); const save = () => fs.writeFileSync(lp, JSON.stringify(L, null, 1));
const spent = L.rows.reduce((t, r) => t + (r.status === 'failed-unbilled' ? 0 : (r.settled_usd ?? r.reserved_usd)), 0);
console.log(JSON.stringify({ EP, VN, S, usd: USD, spent: +spent.toFixed(2), cap: L.cap_usd, mode: GO ? 'GO' : 'dry' })); if (spent + USD > L.cap_usd) process.exit(2); if (!GO) process.exit(0);
const H = { Authorization: `Key ${loadEnv('C:/RnD').FAL_KEY}`, 'Content-Type': 'application/json' };
const body = { prompt: 'professional real-estate interior photograph, natural soft daylight, warm white matte plaster walls, light natural oak plank floor with visible grain, cream boucle upholstery, linen, oak wood furniture, travertine, subtle contact shadows, realistic materials, photorealistic, sharp', image_url: du, strength: Number(S), num_inference_steps: 32, guidance_scale: 3.5, image_size: { width: 1536, height: 1536 }, output_format: 'jpeg', seed: 7,
  controlnet_unions: [{ path: 'InstantX/FLUX.1-dev-Controlnet-Union', controls: [{ control_image_url: du, control_mode: 'tile', conditioning_scale: Number(process.env.CS || 0.6), end_percentage: Number(process.env.CE || 0.8) }] }] };
const row = { seq: L.rows.length + 1, at: new Date().toISOString(), item: `${ROOM}/${VN}`, op: 'view-bakeoff', model: EP + ' +tile', reserved_usd: USD, status: 'reserved' }; L.rows.push(row); save();
try { const r = await fetch(`https://queue.fal.run/${EP}`, { method: 'POST', headers: H, body: JSON.stringify(body) }); const t = await r.text(); if (!r.ok) throw new Error(`submit HTTP ${r.status}: ${t.slice(0, 200)}`); const q = JSON.parse(t);
  for (let i = 0; i < 150; i++) { await new Promise((ok) => setTimeout(ok, 3000)); const st = await (await fetch(q.status_url, { headers: H })).json(); if (st.status === 'COMPLETED') break; if (!['IN_QUEUE', 'IN_PROGRESS'].includes(st.status)) throw new Error('status ' + JSON.stringify(st).slice(0, 300)); }
  const res = await (await fetch(q.response_url, { headers: H })).json(); if (!res.images) throw new Error('result ' + JSON.stringify(res).slice(0, 300));
  fs.writeFileSync(out, Buffer.from(await (await fetch(res.images[0].url)).arrayBuffer())); Object.assign(row, { status: 'settled', settled_usd: USD, out }); save(); console.log('OK', out);
} catch (e) { const unb = String(e.message).includes('submit HTTP 4'); Object.assign(row, { status: unb ? 'failed-unbilled' : 'failed', settled_usd: unb ? 0 : undefined, error: String(e.message).slice(0, 300) }); save(); console.error('FAILED', e.message); process.exit(1); }
