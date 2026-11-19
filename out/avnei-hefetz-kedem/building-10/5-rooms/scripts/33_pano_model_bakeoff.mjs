/* Step 33 (PAID, fal, ≈$0.8) - which fal edit model makes the most realistic 360 views from Eliran's pictures?
   Eliran 2026-11-18: «תבחר את המודל הטוב ביותר מFAL שידע לייצר לך את התוצרים הכי טובים וריאליסטיים על סמך התמונות שסיפקתי לך».
   Same two views (work/pano/faces), same reference picture, same prompt as step 32 → seedream v4.5 edit, flux-2-pro edit,
   qwen-image-edit-2509, gpt-image-1.5 edit (nano-banana-pro is step 32's own result). Out: work/pano/bakeoff/<view>__<model>.png.
   Ledger: the same work/pano/ledger.json (cap $12 for the whole 360 polish), reserved BEFORE each call. Dry-run by default; --go sends.
   Usage: node scripts/33_pano_model_bakeoff.mjs <job root> [--go]                                                                   */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadEnv } from 'file:///C:/RnD/Projects/3Dengine/pipeline/Habait/tour360/tools/file-ledger.mjs';

const args = process.argv.slice(2);
const ROOT = args.find((a) => !a.startsWith('--')); const GO = args.includes('--go');
const CAP = 12;
const src32 = fs.readFileSync(path.join(ROOT, 'scripts/32_pano_realism.mjs'), 'utf8');
const PROMPT = eval(src32.slice(src32.indexOf('const PROMPT = ') + 15, src32.indexOf(".join(' ');") + 10));
const MODELS = [
  { id: 'seedream45', ep: 'fal-ai/bytedance/seedream/v4.5/edit', usd: 0.05, body: (u) => ({ prompt: PROMPT, image_urls: u, image_size: { width: 2048, height: 2048 }, num_images: 1, seed: 11 }) },
  { id: 'flux2pro', ep: 'fal-ai/flux-2-pro/edit', usd: 0.08, body: (u) => ({ prompt: PROMPT, image_urls: u, image_size: { width: 2048, height: 2048 }, output_format: 'png', seed: 11 }) },
  { id: 'qwen2509', ep: 'fal-ai/qwen-image-edit-2509', usd: 0.05, body: (u) => ({ prompt: PROMPT, image_urls: u, image_size: 'square_hd', num_images: 1, output_format: 'png', seed: 11 }) },
  { id: 'gptimg15', ep: 'fal-ai/gpt-image-1.5/edit', usd: 0.25, body: (u) => ({ prompt: PROMPT, image_urls: u, image_size: '1024x1024', quality: 'high', input_fidelity: 'high', num_images: 1, output_format: 'png' }) },
];
const VIEWS = [['living_front', '01'], ['parents_front', '05']];
const dir = path.join(ROOT, 'work/pano'), out = path.join(dir, 'bakeoff'); fs.mkdirSync(out, { recursive: true });
const LP = path.join(dir, 'ledger.json'); const L = JSON.parse(fs.readFileSync(LP, 'utf8'));
const save = () => fs.writeFileSync(LP, JSON.stringify(L, null, 1));
const spent = () => L.rows.reduce((t, r) => t + (r.status === 'failed-unbilled' ? 0 : (r.settled_usd ?? r.reserved_usd)), 0);
const refs = fs.readdirSync(dir).filter((f) => f.startsWith('ref_') && f.endsWith('.jpg'));
const refOf = (nn) => path.join(dir, refs.find((f) => f.includes(`_-_${nn}_`)));
let env = null;
const H = () => { env ??= loadEnv('C:/RnD'); if (!env.FAL_KEY) throw new Error('FAL_KEY missing (by name)'); return { Authorization: `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' }; };
console.log(JSON.stringify({ models: MODELS.map((m) => m.ep), views: VIEWS.map((v) => v[0]), est: MODELS.reduce((t, m) => t + m.usd, 0) * VIEWS.length, spent_before: spent(), cap: CAP, mode: GO ? 'GO' : 'dry-run' }));
const jobs = [];
for (const [view, nn] of VIEWS) for (const m of MODELS) {
  const A = fs.readFileSync(path.join(dir, 'faces', view + '.png')), B = fs.readFileSync(refOf(nn));
  const o = path.join(out, `${view}__${m.id}.png`);
  const hash = crypto.createHash('sha256').update(m.ep).update(PROMPT).update(A).update(B).digest('hex');
  if (L.rows.find((r) => r.inputs_hash === hash && r.status === 'settled' && fs.existsSync(r.out))) { console.log('CACHED', view, m.id); continue; }
  if (spent() + m.usd > CAP + 1e-9) { console.error('REFUSED: over the cap at', view, m.id); process.exit(2); }
  if (!GO) { console.log('DRY', view, m.id, m.usd); continue; }
  const row = { seq: L.rows.length + 1, at: new Date().toISOString(), view: `bakeoff:${view}`, model: m.ep, reserved_usd: m.usd, status: 'reserved', inputs_hash: hash, out: o }; L.rows.push(row); save();
  jobs.push((async () => {
    const t0 = Date.now();
    try {
      const r = await fetch(`https://queue.fal.run/${m.ep}`, { method: 'POST', headers: H(), signal: AbortSignal.timeout(120e3),
        body: JSON.stringify(m.body([`data:image/png;base64,${A.toString('base64')}`, `data:image/jpeg;base64,${B.toString('base64')}`])) });
      const t = await r.text(); if (!r.ok) { const e = new Error(`submit HTTP ${r.status}: ${t.slice(0, 300)}`); e.unbilled = true; throw e; }
      const j = JSON.parse(t); row.queue = { status_url: j.status_url, response_url: j.response_url, request_id: j.request_id }; save();
      for (;;) {
        if (Date.now() - t0 > 10 * 60e3) throw new Error('timeout');
        await new Promise((ok) => setTimeout(ok, 4000));
        let s = {}; try { s = await (await fetch(row.queue.status_url, { headers: H(), signal: AbortSignal.timeout(30e3) })).json(); } catch { continue; }
        if (s.status === 'COMPLETED') break;
        if (s.status && !['IN_QUEUE', 'IN_PROGRESS'].includes(s.status)) throw new Error('status ' + JSON.stringify(s).slice(0, 200));
      }
      const res = await (await fetch(row.queue.response_url, { headers: H(), signal: AbortSignal.timeout(60e3) })).json();
      if (!res.images || !res.images[0]) throw new Error('no image: ' + JSON.stringify(res).slice(0, 300));
      fs.writeFileSync(o, Buffer.from(await (await fetch(res.images[0].url, { signal: AbortSignal.timeout(120e3) })).arrayBuffer()));
      Object.assign(row, { status: 'settled', settled_usd: m.usd, seconds: (Date.now() - t0) / 1000 }); save();
      console.log('OK', view, m.id, ((Date.now() - t0) / 1000).toFixed(0), 's');
    } catch (e) {
      Object.assign(row, { status: e.unbilled ? 'failed-unbilled' : 'failed', ...(e.unbilled ? { settled_usd: 0 } : {}), error: String(e.message).slice(0, 300) }); save();
      console.error('FAILED', view, m.id, row.error);
    }
  })());
}
await Promise.all(jobs);
console.log('SPENT', spent().toFixed(2), 'of', CAP);
