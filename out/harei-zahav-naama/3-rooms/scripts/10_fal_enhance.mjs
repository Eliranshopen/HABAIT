/* Step 10 - ONE ledgered fal image-edit call on a Blender still (Eliran 2026-11-17: the small test, cap $1.50).
   Dry-run by default: prints the request (without the image bytes) and the booking. --go sends it.
   The ledger (job root ledger.json) is reserved BEFORE the call and settled after; a call that would cross the cap
   is refused. The key is read by NAME (FAL_KEY) from the process env or the harness root keys file via the
   existing loadEnv; it is never printed. A cached answer (same inputs hash) costs $0 and is not sent again.
   Usage: node scripts/10_fal_enhance.mjs <in.png> <out.png> [--model nano-banana-2] [--res 2K] [--go]           */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadEnv } from '../../../../../../Projects/3Dengine/pipeline/Habait/tour360/tools/file-ledger.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const [inPng, outPng] = args.filter((a) => !a.startsWith('--') && !/^(nano|google|0\.5K|1K|2K|4K)/.test(a));
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const GO = args.includes('--go');
const CAP = 1.5;
const MODELS = {
  'nano-banana-2': { endpoint: 'fal-ai/nano-banana-2/edit', usd: { '1K': 0.08, '2K': 0.12, '4K': 0.16 } },
  'nano-banana-2.1': { endpoint: 'google/nano-banana-2.1/edit', usd: { '1K': 0.04, '2K': 0.063, '4K': 0.138 } },
};
const key = opt('--model', 'nano-banana-2');
const res = opt('--res', '2K');
const model = MODELS[key];
const usd = model.usd[res];
const PROMPT = [
  'This is a 3D render of a real apartment interior. Make it look like a real professional architectural interior photograph:',
  'natural soft daylight from the windows, realistic global illumination and soft contact shadows, real fabric weave and folds on the sofa,',
  'cushions and bedding, real wood grain, natural stone and porcelain reflections, subtle photographic depth and lens character.',
  'STRICT: keep the exact same camera, framing, perspective and composition. Do not move, add, remove, resize or reshape any wall,',
  'door, window, opening, ceiling light, cabinet or piece of furniture. Keep every window and door exactly where and as large as it is.',
  'Keep the same colours and materials (warm white walls, light porcelain floor, oak wood, cream sofa). Do not add any text, logo,',
  'people or plants. Do not change what is visible outside the windows.',
].join(' ');

const ledgerPath = path.join(ROOT, 'ledger.json');
const ledger = fs.existsSync(ledgerPath) ? JSON.parse(fs.readFileSync(ledgerPath, 'utf8'))
  : { $schema: 'tour360/ledger.v1', cap_usd: CAP, note: 'Eliran 2026-11-17: small AI test, cap $1.50; reserve before send, settle after', rows: [] };
const spent = ledger.rows.reduce((t, r) => t + (r.status === 'failed' ? 0 : (r.settled_usd ?? r.reserved_usd)), 0);
const png = fs.readFileSync(inPng);
const inputsHash = crypto.createHash('sha256').update(model.endpoint).update(res).update(PROMPT).update(png).digest('hex');
const cached = ledger.rows.find((r) => r.inputs_hash === inputsHash && r.status === 'settled' && fs.existsSync(r.out));
const body = { prompt: PROMPT, image_urls: [`data:image/png;base64,${png.toString('base64')}`], num_images: 1, output_format: 'png',
  resolution: res, aspect_ratio: 'auto', sync_mode: true, seed: 7 };
console.log(JSON.stringify({ endpoint: model.endpoint, resolution: res, usd, spent_before: +spent.toFixed(3), cap: ledger.cap_usd,
  input: path.basename(inPng), input_bytes: png.length, cached: !!cached, mode: GO ? 'GO' : 'dry-run' }));
if (cached) { fs.copyFileSync(cached.out, outPng); console.log('CACHED - $0'); process.exit(0); }
if (spent + usd > ledger.cap_usd + 1e-9) { console.error(`REFUSED: ${spent.toFixed(2)} + ${usd} > cap ${ledger.cap_usd}`); process.exit(2); }
if (!GO) process.exit(0);

const env = loadEnv('C:/RnD');
if (!env.FAL_KEY) { console.error('FAL_KEY: missing (checked by name)'); process.exit(3); }
const row = { seq: ledger.rows.length + 1, at: new Date().toISOString(), op: 'enhance-still', scene: path.basename(inPng),
  model: model.endpoint, resolution: res, reserved_usd: usd, status: 'reserved', inputs_hash: inputsHash, out: path.resolve(outPng) };
ledger.rows.push(row);
fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 1));
const t0 = Date.now();
let ok = false;
try {
  const r = await fetch(`https://fal.run/${model.endpoint}`, { method: 'POST',
    headers: { Authorization: `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const txt = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${txt.slice(0, 300)}`);
  const j = JSON.parse(txt);
  const u = j.images?.[0]?.url;
  if (!u) throw new Error('no image in the answer');
  const buf = u.startsWith('data:') ? Buffer.from(u.split(',')[1], 'base64') : Buffer.from(await (await fetch(u)).arrayBuffer());
  fs.writeFileSync(outPng, buf);
  ok = true;
  Object.assign(row, { status: 'settled', settled_usd: usd, seconds: (Date.now() - t0) / 1000, out_bytes: buf.length });
} catch (e) {
  // a failed request is kept at its reservation until fal's own usage page says otherwise
  Object.assign(row, { status: 'failed', error: String(e.message).slice(0, 300), seconds: (Date.now() - t0) / 1000 });
  console.error('FAILED', row.error);
}
fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 1));
console.log(JSON.stringify({ status: row.status, seconds: row.seconds, out: ok ? outPng : null }));
process.exit(ok ? 0 : 1);
