/* Step 23 - which fal image-to-3D model makes the best furniture from Eliran's renders (Eliran 2026-11-18: «כל הריהוט … נראים לא טוב
   וברמה נמוכה … תבדוק בFAL איזה מודל יספק לך את התוצר הטוב ביותר»; approved: a comparison ≈ $10, then every piece in the winner).
   The same studio photo (step 16, made from his renders) goes to each model; the GLBs land in items/compare/<model>/<item>.glb and are
   rendered side by side by scripts/blender/compare_render.py. Ledger items/ledger/compare.json, reserved before each call (booked at
   the price below; fal's usage page has the exact figure for credit-priced models), queue ticket saved at once so a stopped run is
   collected, never re-sent. Dry-run by default; --go sends. FAL_KEY by NAME.
   Usage: node scripts/23_i23d_compare.mjs <item> <model|all> [--go]                                                                    */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadEnv } from '../../../../../../Projects/3Dengine/pipeline/Habait/tour360/tools/file-ledger.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const [ITEM, WHICH] = args;
const GO = process.argv.includes('--go');
const CAP = 90;   // Eliran 2026-11-18: ceiling raised to $90 for both versions (walkaround + 360)
const img = (p) => `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;
const MODELS = {
  rodin: { ep: 'fal-ai/hyper3d/rodin/v2.5', usd: 1.2, body: (u) => ({ image_urls: [u], tier: 'Gen-2.5-High', addons: { high_pack: true }, material: 'PBR', texture_mode: 'high',
    quality_mesh_option: '150K Triangle', geometry_file_format: 'glb', texture_delight: true }), glb: (o) => o.model_mesh?.url },
  meshy: { ep: 'meshy/v7.1/image-to-3d', usd: 1.2, body: (u) => ({ image_url: u, should_texture: true, enable_pbr: true, target_polycount: 150000,
    topology: 'triangle', should_remesh: true }), glb: (o) => o.model_glb?.url || o.model_urls?.glb?.url },
  tripo: { ep: 'tripo3d/h3.1/image-to-3d', usd: 0.6, body: (u) => ({ image_url: u, texture: true, pbr: true, geometry_quality: 'detailed',
    texture_quality: 'detailed', face_limit: 150000 }), glb: (o) => o.model_mesh?.url || o.model_urls?.pbr_model?.url || o.model_urls?.base_model?.url },
  hitem: { ep: 'hitem3d/hi3d/v3.0/image-to-3d', usd: 2.1, body: (u) => ({ image_url: u, resolution: '2048quality', enable_pbr: true,
    face_count: 300000, export_format: 'glb' }), glb: (o) => o.model_mesh?.url },
};
const studio = path.join(ROOT, 'items', 'studio', `${ITEM}.png`);
if (!fs.existsSync(studio)) { console.error('no studio photo for', ITEM); process.exit(2); }
const LD = path.join(ROOT, 'items', 'ledger'); fs.mkdirSync(LD, { recursive: true });
const LP = path.join(LD, `compare_${ITEM}.json`);   // one ledger file per item: the two items run in parallel
const L = fs.existsSync(LP) ? JSON.parse(fs.readFileSync(LP, 'utf8')) : { $schema: 'tour360/ledger.v1', cap_usd: CAP, note: 'image-to-3D comparison, Eliran 2026-11-18', rows: [] };
const sumFile = (f) => JSON.parse(fs.readFileSync(f, 'utf8')).rows.reduce((t, r) => t + (r.status === 'failed-unbilled' ? 0 : (r.settled_usd ?? r.reserved_usd)), 0);
const spentAll = () => [path.join(ROOT, 'items', 'ledger.json'), path.join(ROOT, 'work', 'realism', 'ledger.json'),
  ...fs.readdirSync(LD).filter((f) => f.endsWith('.json') && f !== `compare_${ITEM}.json`).map((f) => path.join(LD, f))]
  .filter((f) => fs.existsSync(f)).reduce((t, f) => t + sumFile(f), 0)
  + L.rows.reduce((t, r) => t + (r.status === 'failed-unbilled' ? 0 : (r.settled_usd ?? r.reserved_usd)), 0);
const save = () => fs.writeFileSync(LP, JSON.stringify(L, null, 1));
let env = null;

async function run(name) {
  const m = MODELS[name];
  const out = path.join(ROOT, 'items', 'compare', name, `${ITEM}.glb`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const body = m.body(img(studio));
  const hash = crypto.createHash('sha256').update(m.ep).update(JSON.stringify({ ...body, image_url: undefined, image_urls: undefined })).update(fs.readFileSync(studio)).digest('hex');
  if (fs.existsSync(out)) { console.log(`CACHED ${name} ${ITEM}`); return; }
  console.log(JSON.stringify({ item: ITEM, model: name, endpoint: m.ep, usd: m.usd, spent_before: +spentAll().toFixed(2), cap: CAP, mode: GO ? 'GO' : 'dry-run' }));
  if (!GO) return;
  let row = L.rows.find((r) => r.inputs_hash === hash && r.queue && r.status !== 'settled');
  if (!row) {
    if (spentAll() + m.usd > CAP + 1e-9) { console.error(`REFUSED ${name}: over the cap ${CAP}`); return; }
    row = { seq: L.rows.length + 1, at: new Date().toISOString(), item: ITEM, op: 'compare', model: m.ep, reserved_usd: m.usd, status: 'reserved', inputs_hash: hash };
    L.rows.push(row); save();
  }
  env ??= loadEnv('C:/RnD');
  const H = { Authorization: `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' };
  const t0 = Date.now();
  try {
    if (!row.queue) {
      const r = await fetch(`https://queue.fal.run/${m.ep}`, { method: 'POST', headers: H, body: JSON.stringify(body), signal: AbortSignal.timeout(120e3) });
      const t = await r.text();
      if (!r.ok) throw Object.assign(new Error(`submit HTTP ${r.status}: ${t.slice(0, 300)}`), { refused: r.status < 500 });
      const j = JSON.parse(t); row.queue = { request_id: j.request_id, status_url: j.status_url, response_url: j.response_url }; save();
    }
    for (;;) {
      if (Date.now() - t0 > 40 * 60e3) throw new Error('timeout (collect later with the same command)');
      await new Promise((ok) => setTimeout(ok, 5000));
      let s = {};
      try { s = await (await fetch(row.queue.status_url, { headers: H, signal: AbortSignal.timeout(30e3) })).json(); } catch { continue; }
      if (s.status === 'COMPLETED') break;
      if (s.status && !['IN_QUEUE', 'IN_PROGRESS'].includes(s.status)) throw new Error(`status ${JSON.stringify(s).slice(0, 200)}`);
    }
    const res = await fetch(row.queue.response_url, { headers: H, signal: AbortSignal.timeout(60e3) });
    const o = JSON.parse(await res.text());
    if (!res.ok) throw new Error(`result ${res.status}: ${JSON.stringify(o).slice(0, 300)}`);
    const u = m.glb(o);
    if (!u) throw new Error(`no glb in ${JSON.stringify(Object.keys(o))}`);
    fs.writeFileSync(out, Buffer.from(await (await fetch(u, { signal: AbortSignal.timeout(600e3) })).arrayBuffer()));
    Object.assign(row, { status: 'settled', settled_usd: m.usd, request_id: row.queue.request_id, seconds: (Date.now() - t0) / 1000, out });
    save();
    console.log(`OK ${name} ${ITEM} ${((Date.now() - t0) / 1000).toFixed(0)} s ${(fs.statSync(out).size / 1e6).toFixed(1)} MB`);
  } catch (e) {
    Object.assign(row, { status: e.refused && !row.queue ? 'failed-unbilled' : 'failed', error: String(e.message).slice(0, 300) });
    if (row.status === 'failed-unbilled') row.settled_usd = 0;
    save();
    console.error(`FAILED ${name} ${ITEM}: ${row.error}`);
  }
}
for (const n of WHICH === 'all' ? Object.keys(MODELS) : [WHICH]) await run(n);
