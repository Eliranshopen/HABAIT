/* Step 39 (PAID, fal) - the step-38 panoramas ×2 with SeedVR2 (fal-ai/seedvr/upscale/image, factor 2: 3840 → 7680 wide), so the 360
   stays sharp on a desktop screen (3840 across 360° was softer than the screen). Content-preserving upscaler, no prompt.
   Eliran 2026-11-18: «התמונות בהדמייה נראות זולות …» → dialog: all 10 rooms, 360 cap $40. Ledger work/pano/ledger.json, reserved before.
   Out: work/pano/up/<id>.jpg. Usage: node scripts/39_pano_upscale.mjs <job root> <id[,id]> [--go]                                    */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { loadEnv } from 'file:///C:/RnD/Projects/3Dengine/pipeline/Habait/tour360/tools/file-ledger.mjs';

const args = process.argv.slice(2);
const [ROOT, ids] = args.filter((a) => !a.startsWith('--')); const GO = args.includes('--go');
const CAP = 65, USD = 0.03, EP = 'fal-ai/seedvr/upscale/image';   // fal page: «$0.001 per megapixel» × 29.5 MP output
const SRCD = args.includes('--src') ? args[args.indexOf('--src') + 1] : 'gpt25b';   // step 38 (gpt25b) or step 40 (realB)
const dir = path.join(ROOT, 'work/pano'), out = path.join(dir, args.includes('--out') ? args[args.indexOf('--out') + 1] : 'up'); fs.mkdirSync(out, { recursive: true });
const LP = path.join(dir, 'ledger.json'); const L = JSON.parse(fs.readFileSync(LP, 'utf8'));
const save = () => fs.writeFileSync(LP, JSON.stringify(L, null, 1));
const spent = () => L.rows.reduce((t, r) => t + (r.status === 'failed-unbilled' ? 0 : (r.settled_usd ?? r.reserved_usd)), 0);
let env = null;
const H = () => { env ??= loadEnv('C:/RnD'); if (!env.FAL_KEY) throw new Error('FAL_KEY missing (by name)'); return { Authorization: `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' }; };
const jobs = [];
for (const id of ids.split(',')) {
  const src = path.join(dir, SRCD, id + '.png'), jp = path.join(out, id + '_in.jpg'), o = path.join(out, id + '.jpg');
  if (!fs.existsSync(src)) { console.error('MISSING', src); continue; }
  if (!fs.existsSync(jp)) execFileSync('python', ['-c', `from PIL import Image; Image.open(r'''${src}''').convert('RGB').save(r'''${jp}''', quality=95)`]);
  const A = fs.readFileSync(jp); const hash = crypto.createHash('sha256').update(EP).update('x2').update(A).digest('hex');
  if (L.rows.find((r) => r.inputs_hash === hash && r.status === 'settled' && fs.existsSync(r.out))) { console.log('CACHED', id); continue; }
  if (spent() + USD > CAP + 1e-9) { console.error('REFUSED: over the cap at', id); process.exit(2); }
  if (!GO) { console.log('DRY', id, USD, 'spent', spent().toFixed(2)); continue; }
  const row = { seq: L.rows.length + 1, at: new Date().toISOString(), view: `upscale:${id}`, model: EP, reserved_usd: USD, status: 'reserved', inputs_hash: hash, out: o }; L.rows.push(row); save();
  jobs.push((async () => {
    const t0 = Date.now();
    try {
      const r = await fetch(`https://queue.fal.run/${EP}`, { method: 'POST', headers: H(), signal: AbortSignal.timeout(180e3),
        body: JSON.stringify({ image_url: `data:image/jpeg;base64,${A.toString('base64')}`, upscale_mode: 'factor', upscale_factor: 2, output_format: 'jpg', seed: 11 }) });
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
      const u = res.image && res.image.url; if (!u) throw new Error('no image: ' + JSON.stringify(res).slice(0, 300));
      fs.writeFileSync(o, Buffer.from(await (await fetch(u, { signal: AbortSignal.timeout(180e3) })).arrayBuffer()));
      Object.assign(row, { status: 'settled', settled_usd: USD, seconds: (Date.now() - t0) / 1000 }); save();
      console.log('OK', id, ((Date.now() - t0) / 1000).toFixed(0), 's');
    } catch (e) {
      Object.assign(row, { status: e.unbilled ? 'failed-unbilled' : 'failed', ...(e.unbilled ? { settled_usd: 0 } : {}), error: String(e.message).slice(0, 300) }); save();
      console.error('FAILED', id, row.error);
    }
  })());
}
await Promise.all(jobs);
console.log('SPENT', spent().toFixed(2), 'of', CAP);
