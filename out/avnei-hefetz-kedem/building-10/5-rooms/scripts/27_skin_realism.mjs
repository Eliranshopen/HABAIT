/* Step 27 (PAID, fal) - the realism pass of the photo skin: a frame of the walk (step 26) → fal-ai/nano-banana-pro/edit, with Eliran's
   picture of the same room (input/supplied) as the LOOK reference only. Strict: same camera, walls, openings, furniture, positions and
   sizes; only light, materials and photographic quality. Recipe: the Hatzav job's 22_realism.mjs, adapted (this apartment's materials,
   the queue API so a long call is collected, never re-sent).
   Eliran 2026-11-18: «אני רוצה את התוצאה הטובה ביותר והריאליסטית ביותר» → photo skin, cap $8, no stop to look.
   Ledger work/realism/ledger.json: reserved BEFORE the call, settled after; a cached frame costs $0. Dry-run by default; --go sends.
   Usage: node scripts/27_skin_realism.mjs <job root> [--only name,name] [--go]                                                       */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadEnv } from 'file:///C:/RnD/Projects/3Dengine/pipeline/Habait/tour360/tools/file-ledger.mjs';

const args = process.argv.slice(2);
const ROOT = args.find((a) => !a.startsWith('--'));
const GO = args.includes('--go');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const CAP = 8, USD = 0.15, EP = 'fal-ai/nano-banana-pro/edit';
const PROMPT = [
  'Image 1 is a real-time 3D view of an apartment interior. Turn it into a real, high-end professional architectural interior photograph.',
  "Image 2 is the developer's photoreal render of this apartment: use it ONLY as the reference for the look - the bright soft daylight,",
  'the clean white painted walls and ceiling, the large polished light-grey veined marble floor tiles, the grey velvet upholstery, the light',
  'oak with fine grain, the white handleless kitchen, the black fittings, the depth and the photographic quality.',
  'STRICT, from image 1: keep exactly the same camera, framing and perspective; keep every wall, opening, door, window, ceiling light, cabinet',
  'and every piece of furniture and decor exactly where it is, at the same size, shape and colour. Do not add, remove, move or resize anything;',
  'do not copy objects or layout from image 2; no skirting boards. Only make materials, light, shadows and reflections look real: soft contact',
  'shadows, gentle global illumination, real fabric folds and weave, real wood grain, soft natural reflections on the marble floor, subtle lens',
  'character. No people, no text, no logo, no watermark.',
].join(' ');
const dir = path.join(ROOT, 'work/realism'); const outDir = path.join(dir, 'photos'); fs.mkdirSync(outDir, { recursive: true });
const LP = path.join(dir, 'ledger.json');
const L = fs.existsSync(LP) ? JSON.parse(fs.readFileSync(LP, 'utf8')) : { cap_usd: CAP, note: 'photo skin realism photos (Eliran 2026-11-18, cap $8)', rows: [] };
const save = () => fs.writeFileSync(LP, JSON.stringify(L, null, 1));
const spent = () => L.rows.reduce((t, r) => t + (r.status === 'failed-unbilled' ? 0 : (r.settled_usd ?? r.reserved_usd)), 0);
const SUP = fs.readdirSync(path.join(ROOT, 'input/supplied')).filter((f) => f.endsWith('.png'));
const refOf = (nn) => path.join(ROOT, 'input/supplied', SUP.find((f) => f.includes(` - ${nn} `)));
const V = JSON.parse(fs.readFileSync(path.join(dir, 'cams.json'), 'utf8')).filter((v) => !only || only.includes(v.name));
let env = null;
const H = () => { env ??= loadEnv('C:/RnD'); if (!env.FAL_KEY) throw new Error('FAL_KEY missing (by name)'); return { Authorization: `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' }; };
const small = async (file, max) => {   // the reference picture as a JPEG data URI (the originals are 5 MB PNGs)
  const { execFileSync } = await import('node:child_process');
  const tmp = path.join(dir, 'ref_' + path.basename(file).replace(/[^\w.-]/g, '_') + '.jpg');
  if (!fs.existsSync(tmp)) execFileSync('python', ['-c', `from PIL import Image; im=Image.open(r'''${file}''').convert('RGB'); im.thumbnail((${max},${max})); im.save(r'''${tmp}''', quality=90)`]);
  return tmp;
};
console.log(JSON.stringify({ endpoint: EP, frames: V.length, usd_each: USD, spent_before: spent(), cap: CAP, mode: GO ? 'GO' : 'dry-run' }));
for (const v of V) {
  const frame = path.join(dir, 'frames', v.name + '.png'), out = path.join(outDir, v.name + '_real.png');
  const ref = await small(refOf(v.ref), 1536);
  const A = fs.readFileSync(frame), B = fs.readFileSync(ref);
  const hash = crypto.createHash('sha256').update(EP).update(PROMPT).update(A).update(B).digest('hex');
  const done = L.rows.find((r) => r.inputs_hash === hash && r.status === 'settled' && fs.existsSync(r.out));
  if (done) { console.log('CACHED', v.name); continue; }
  if (spent() + USD > CAP + 1e-9) { console.error('REFUSED: over the cap at', v.name); process.exit(2); }
  if (!GO) { console.log('DRY', v.name, '<-', path.basename(refOf(v.ref))); continue; }
  let row = L.rows.find((r) => r.inputs_hash === hash && r.queue && r.status !== 'settled');
  if (!row) { row = { seq: L.rows.length + 1, at: new Date().toISOString(), view: v.name, model: EP, reserved_usd: USD, status: 'reserved', inputs_hash: hash, out }; L.rows.push(row); save(); }
  const t0 = Date.now();
  try {
    if (!row.queue) {
      const r = await fetch(`https://queue.fal.run/${EP}`, { method: 'POST', headers: H(), signal: AbortSignal.timeout(120e3), body: JSON.stringify({ prompt: PROMPT,
        image_urls: [`data:image/png;base64,${A.toString('base64')}`, `data:image/jpeg;base64,${B.toString('base64')}`], num_images: 1, resolution: '2K', aspect_ratio: '3:2', output_format: 'png', seed: 11 }) });
      const t = await r.text(); if (!r.ok) throw new Error(`submit HTTP ${r.status}: ${t.slice(0, 300)}`);
      const j = JSON.parse(t); row.queue = { status_url: j.status_url, response_url: j.response_url, request_id: j.request_id }; save();
    }
    for (;;) {
      if (Date.now() - t0 > 15 * 60e3) throw new Error('timeout (collect later with the same command)');
      await new Promise((ok) => setTimeout(ok, 4000));
      let s = {}; try { s = await (await fetch(row.queue.status_url, { headers: H(), signal: AbortSignal.timeout(30e3) })).json(); } catch { continue; }
      if (s.status === 'COMPLETED') break;
      if (s.status && !['IN_QUEUE', 'IN_PROGRESS'].includes(s.status)) throw new Error('status ' + JSON.stringify(s).slice(0, 200));
    }
    const res = await (await fetch(row.queue.response_url, { headers: H(), signal: AbortSignal.timeout(60e3) })).json();
    const u = res.images[0].url;
    fs.writeFileSync(out, Buffer.from(await (await fetch(u, { signal: AbortSignal.timeout(120e3) })).arrayBuffer()));
    Object.assign(row, { status: 'settled', settled_usd: USD, seconds: (Date.now() - t0) / 1000 }); save();
    console.log('OK', v.name, ((Date.now() - t0) / 1000).toFixed(0), 's');
  } catch (e) {
    const refused = /^submit HTTP 4/.test(e.message) && !row.queue;
    Object.assign(row, { status: refused ? 'failed-unbilled' : 'failed', ...(refused ? { settled_usd: 0 } : {}), error: String(e.message).slice(0, 300) }); save();
    console.error('FAILED', v.name, row.error);
  }
}
console.log('SPENT', spent().toFixed(2), 'of', CAP);
