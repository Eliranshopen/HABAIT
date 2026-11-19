/* Step 36 (PAID, fal, $1.20 a room) - the whole equirect panorama in one call to GPT Image 2.5 (openai/gpt-image-2.5/sunburst/edit),
   the RAINBOW model of record for panoramas from a 3D model; the Hatzav session (2026-11-18) found it keeps every item and place where
   nano-banana-pro added objects. Eliran 2026-11-18: «תבחר את המודל הטוב ביותר מFAL … על סמך התמונות שסיפקתי». Same look reference
   (his picture of the room) and the same STRICT rules as step 32. Ledger: work/pano/ledger.json (360 cap $21, Eliran's dialog 2026-11-18: «GPT לכל הדירה, תקרה $21»), reserved BEFORE the call.
   Out: work/pano/gpt25/<id>.png. Dry-run by default; --go sends.
   Usage: node scripts/36_pano_gpt25.mjs <job root> <id[,id]> [--go]                                                                   */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadEnv } from 'file:///C:/RnD/Projects/3Dengine/pipeline/Habait/tour360/tools/file-ledger.mjs';

const args = process.argv.slice(2);
const [ROOT, ids] = args.filter((a) => !a.startsWith('--')); const GO = args.includes('--go');
const CAP = 21, USD = 1.20, EP = 'openai/gpt-image-2.5/sunburst/edit';
const REF = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(ROOT, 'work/pano/polish_manifest.json'), 'utf8')).map((v) => [v.name.split('_')[0], v.ref]));   // step 32's room → picture
const PROMPT = [
  'Image 1 is an equirectangular 360-degree panorama (2:1, full sphere) of an apartment interior, rendered from an exact 3D model of the sales plan.',
  'Turn it into a real, high-end professional 360-degree interior photograph.',
  "Image 2 is the developer's photoreal render of this apartment: use it ONLY as the reference for the look - the bright soft daylight, the clean",
  'white painted walls and ceiling, the large polished light-grey veined marble floor tiles, the grey velvet upholstery, the light oak with fine grain,',
  'the white handleless kitchen, the black fittings, the tones and the photographic quality.',
  'STRICT, from image 1: keep the equirectangular projection exactly (straight vertical lines stay vertical, the horizon stays in the middle, the left',
  'and right edges must join seamlessly); keep every wall, opening, door, window, ceiling, light, cabinet and every piece of furniture and decor',
  'exactly where it is, same size, shape and colour. Do not add, remove, move or resize anything; a plain wall stays a plain wall; do not copy objects',
  'or layout from image 2; no skirting boards; keep the view outside the windows. Only make materials, light, shadows and reflections real: soft',
  'contact shadows, gentle global illumination, real fabric weave and folds, real wood grain, natural reflections. No people, no text, no logo, no watermark.',
].join(' ');
const dir = path.join(ROOT, 'work/pano'), out = path.join(dir, 'gpt25'); fs.mkdirSync(out, { recursive: true });
const LP = path.join(dir, 'ledger.json'); const L = JSON.parse(fs.readFileSync(LP, 'utf8'));
const save = () => fs.writeFileSync(LP, JSON.stringify(L, null, 1));
const spent = () => L.rows.reduce((t, r) => t + (r.status === 'failed-unbilled' ? 0 : (r.settled_usd ?? r.reserved_usd)), 0);
const refs = fs.readdirSync(dir).filter((f) => f.startsWith('ref_') && f.endsWith('.jpg'));
let env = null;
const H = () => { env ??= loadEnv('C:/RnD'); if (!env.FAL_KEY) throw new Error('FAL_KEY missing (by name)'); return { Authorization: `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' }; };
const { execFileSync } = await import('node:child_process');
for (const id of ids.split(',')) {
  const jp = path.join(out, `${id}_in.jpg`);
  if (!fs.existsSync(jp)) execFileSync('python', ['-c', `from PIL import Image; Image.open(r'''${path.join(dir, 'base', id + '.png')}''').convert('RGB').save(r'''${jp}''', quality=92)`]);
  const A = fs.readFileSync(jp), B = fs.readFileSync(path.join(dir, refs.find((f) => f.includes(`_-_${REF[id]}_`))));
  const o = path.join(out, `${id}.png`);
  const body = { prompt: PROMPT, image_urls: [`data:image/jpeg;base64,${A.toString('base64')}`, `data:image/jpeg;base64,${B.toString('base64')}`], image_size: { width: 4096, height: 2048 }, quality: 'high', num_images: 1, output_format: 'png' };
  const hash = crypto.createHash('sha256').update(EP).update(PROMPT).update(A).update(B).digest('hex');
  if (L.rows.find((r) => r.inputs_hash === hash && r.status === 'settled' && fs.existsSync(r.out))) { console.log('CACHED', id); continue; }
  if (spent() + USD > CAP + 1e-9) { console.error('REFUSED: over the cap at', id, spent().toFixed(2)); process.exit(2); }
  if (!GO) { console.log('DRY', id, USD, 'spent', spent().toFixed(2)); continue; }
  const row = { seq: L.rows.length + 1, at: new Date().toISOString(), view: `gpt25:${id}`, model: EP, reserved_usd: USD, status: 'reserved', inputs_hash: hash, out: o }; L.rows.push(row); save();
  const t0 = Date.now();
  try {
    const r = await fetch(`https://queue.fal.run/${EP}`, { method: 'POST', headers: H(), signal: AbortSignal.timeout(120e3), body: JSON.stringify(body) });
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
    if (!res.images || !res.images[0]) throw new Error('no image: ' + JSON.stringify(res).slice(0, 300));
    fs.writeFileSync(o, Buffer.from(await (await fetch(res.images[0].url, { signal: AbortSignal.timeout(120e3) })).arrayBuffer()));
    Object.assign(row, { status: 'settled', settled_usd: USD, seconds: (Date.now() - t0) / 1000 }); save();
    console.log('OK', id, ((Date.now() - t0) / 1000).toFixed(0), 's');
  } catch (e) {
    Object.assign(row, { status: e.unbilled ? 'failed-unbilled' : 'failed', ...(e.unbilled ? { settled_usd: 0 } : {}), error: String(e.message).slice(0, 300) }); save();
    console.error('FAILED', id, row.error);
  }
}
console.log('SPENT', spent().toFixed(2), 'of', CAP);
