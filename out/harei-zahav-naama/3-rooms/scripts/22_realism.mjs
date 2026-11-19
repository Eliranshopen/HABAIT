/* Step 22 - the realism pass (Eliran 2026-11-17: «זה נראה כמו משחק מחשב ולא ריאליסטי … תהפוך את הכל למשהו ריאליסטי ויוקרתי אבל תשמור על
   אותו ריהוט ופריטים»): a frame of the walk → fal-ai/nano-banana-pro/edit, with the developer's Corona render of the same room as the LOOK
   reference only. Strict: same camera, walls, windows, doors, furniture, positions and sizes; only light, materials and photographic quality.
   Ledger work/realism/ledger.json (cap $1 for this proof), reserved before the call; dry-run by default; --go sends. FAL_KEY by NAME.
   Usage: node scripts/22_realism.mjs <frame.png> <reference.jpg> <out.png> [--go]                                                   */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadEnv } from '../../../../../../Projects/3Dengine/pipeline/Habait/tour360/tools/file-ledger.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [frame, ref, out] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const GO = process.argv.includes('--go');
const CAP = 6.5, USD = 0.15, EP = 'fal-ai/nano-banana-pro/edit';
const PROMPT = [
  'Image 1 is a real-time 3D view of an apartment interior. Turn it into a real, high-end professional architectural interior photograph.',
  'Image 2 is the designer\'s photoreal render of this apartment: use it ONLY as the reference for the look — the soft warm daylight, the',
  'limewash plaster walls, the fine natural oak grain, the linen and boucle fabrics, the stone floor, the depth and the photographic quality.',
  'STRICT, from image 1: keep exactly the same camera, framing and perspective; keep every wall, opening, door, window, ceiling light, cabinet,',
  'shelf and every piece of furniture and decor exactly where it is, at the same size, shape and colour. Do not add, remove, move or resize',
  'anything; do not copy objects or layout from image 2. Only make materials, light, shadows and reflections look real: soft contact shadows,',
  'gentle global illumination, real fabric folds and weave, real wood grain, slight natural reflections on the floor, subtle lens character.',
  'No people, no text, no logo, no watermark.',
].join(' ');
const dir = path.join(ROOT, 'work', 'realism');
fs.mkdirSync(dir, { recursive: true });
const LP = path.join(dir, 'ledger.json');
const L = fs.existsSync(LP) ? JSON.parse(fs.readFileSync(LP, 'utf8')) : { $schema: 'tour360/ledger.v1', cap_usd: CAP, note: "realism photos for the photo skin (Eliran 2026-11-18: ceiling $36 for the project)", rows: [] };
const spent = L.rows.reduce((t, r) => t + (r.status === 'failed-unbilled' ? 0 : (r.settled_usd ?? r.reserved_usd)), 0);
const A = fs.readFileSync(frame), B = fs.readFileSync(ref);
const hash = crypto.createHash('sha256').update(EP).update(PROMPT).update(A).update(B).digest('hex');
const done = L.rows.find((r) => r.inputs_hash === hash && r.status === 'settled' && fs.existsSync(r.out));
console.log(JSON.stringify({ endpoint: EP, usd: USD, spent_before: spent, cap: CAP, frame: path.basename(frame), ref: path.basename(ref), cached: !!done, mode: GO ? 'GO' : 'dry-run' }));
if (done) { fs.copyFileSync(done.out, out); console.log('CACHED $0'); process.exit(0); }
if (spent + USD > CAP + 1e-9) { console.error('REFUSED: over the cap'); process.exit(2); }
if (!GO) process.exit(0);
const env = loadEnv('C:/RnD');
if (!env.FAL_KEY) { console.error('FAL_KEY missing (by name)'); process.exit(3); }
const mime = (p) => (p.endsWith('.png') ? 'image/png' : 'image/jpeg');
const row = { seq: L.rows.length + 1, at: new Date().toISOString(), op: 'realism', model: EP, reserved_usd: USD, status: 'reserved', inputs_hash: hash, out: path.resolve(out) };
L.rows.push(row); fs.writeFileSync(LP, JSON.stringify(L, null, 1));
const t0 = Date.now();
try {
  const r = await fetch(`https://fal.run/${EP}`, { method: 'POST', headers: { Authorization: `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: PROMPT, image_urls: [`data:${mime(frame)};base64,${A.toString('base64')}`, `data:${mime(ref)};base64,${B.toString('base64')}`],
      num_images: 1, resolution: '2K', aspect_ratio: '3:2', output_format: 'png', seed: 11 }), signal: AbortSignal.timeout(300e3) });
  const t = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${t.slice(0, 300)}`);
  const u = JSON.parse(t).images[0].url;
  const buf = u.startsWith('data:') ? Buffer.from(u.split(',')[1], 'base64') : Buffer.from(await (await fetch(u, { signal: AbortSignal.timeout(120e3) })).arrayBuffer());
  fs.writeFileSync(out, buf);
  Object.assign(row, { status: 'settled', settled_usd: USD, seconds: (Date.now() - t0) / 1000 });
  console.log('OK', ((Date.now() - t0) / 1000).toFixed(0), 's');
} catch (e) {
  Object.assign(row, { status: /^HTTP 4/.test(e.message) ? 'failed-unbilled' : 'failed', error: String(e.message).slice(0, 300) });
  console.error('FAILED', row.error);
}
fs.writeFileSync(LP, JSON.stringify(L, null, 1));
