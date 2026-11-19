// kedma-d1: the ONE paid call of a flat-view fix (hand/flatfix.py): the designed view redrawn on the CG view's geometry.
// The pipeline's own model table (tools/image-models.mjs) gives the endpoint, the request body and the booked price; the call is
// reserved in the apartment's ledger BEFORE it is sent and settled after (root §7); the key is read by name by the pipeline's
// loader and never printed. Dry by default: --go sends.
// usage (from the pipeline folder):
//   node flatfix-call.mjs <apartment id> <asset> <tag> <prompt.txt> --cap <usd, the ledger's absolute ceiling> [--model gpt25-high] [--size 1024] [--go]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const T = path.resolve('Habait/tour360/tools');
const { MODELS } = await import(pathToFileURL(path.join(T, 'image-models.mjs')).href);
const { fileLedger, loadEnv } = await import(pathToFileURL(path.join(T, 'file-ledger.mjs')).href);
const argv = process.argv.slice(2);
const [id, asset, tag, promptFile] = argv;
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

const APT = path.resolve('Habait/tour360/apartments', id);
const DIR = path.join(APT, '_local', 'flatfix', asset + '-' + tag);
const modelKey = opt('--model', 'gpt25-high');
const m = MODELS[modelKey];
if (!m) { console.error('unknown model ' + modelKey); process.exit(2); }
const size = Number(opt('--size', '1024'));
const cap = Number(opt('--cap', NaN));
if (!Number.isFinite(cap)) { console.error('--cap is required'); process.exit(2); }

const prompt = fs.readFileSync(promptFile, 'utf8').trim();
// --cg-first: Image 1 = the CG view (the geometry to keep), Image 2 = the designed view (materials only): the skin recipe itself.
// Without it Image 1 = the designed view, Image 2 = the CG view (an edit of the picture); that order let the model re-frame (2026-11-16).
// --cg-only: ONE image, the CG view (2026-11-17: with the old designed view beside it a cheaper model copied the old picture's
// wrong geometry where the CG view is pale, the corridor; one image in leaves nothing to copy but the true geometry).
// --in <file>: ONE image by name (hand/room_paint.py: in.png is the canvas seen from the view, painted where the room is painted and CG
// where it is not, so a view continues the materials of the views before it)
const order = opt('--in', '') ? [opt('--in', '')] : argv.includes('--cg-only') ? ['cg.png'] : argv.includes('--cg-first') ? ['cg.png', 'designed.png'] : ['designed.png', 'cg.png'];
const ims = order.map((f) => fs.readFileSync(path.join(DIR, f)));
const body = m.body(prompt, ims);
// a flat view is square. Each model takes its size its own way (fal's public input schemas, read 2026-11-17, $0):
// nano-banana takes an aspect ratio and a resolution name; seedream 4.5 refuses a side under 1920; the others take width and height.
// fal's own page for nano-banana-2/edit (read 2026-11-17): "2K and 4K outputs will be charged at 1.5 times and 2 times the standard rate",
// 0.5K at 0.75 times. The booked price follows the resolution, so the ledger never under-counts a sharper answer.
const RES_MULT = { '0.5K': 0.75, '1K': 1, '2K': 1.5, '4K': 2 };
const resName = opt('--resolution', '1K');
if (!(resName in RES_MULT)) { console.error('unknown --resolution ' + resName); process.exit(2); }
const byRes = 'aspect_ratio' in body;
if (byRes) { body.aspect_ratio = '1:1'; body.resolution = resName; }
else if (modelKey.startsWith('seedream')) body.image_size = { width: 2048, height: 2048 };
else body.image_size = { width: size, height: size };
// the model key is part of the answer's name for every key added after the first two (their answers on disk keep their names)
const hash = sha(JSON.stringify({ e: m.endpoint, prompt, size, i: ims.map(sha), ...(/^gpt25-(high|medium)$/.test(modelKey) ? {} : { k: modelKey }), ...(byRes && resName !== '1K' ? { r: resName } : {}) })).slice(0, 12);
const usd = Number((m.usd * (byRes ? RES_MULT[resName] : 1)).toFixed(4));
const out = path.join(DIR, 'answer-' + hash + '.png');
const ledger = fileLedger(path.join(APT, '_local', 'ledger.json'));
const total = ledger.total();
console.log('flatfix ' + id + '/' + asset + ' [' + tag + '] via ' + m.endpoint + ' — booked $' + usd.toFixed(2) + '; ledger so far $' + total.toFixed(2) + ' (ceiling $' + cap + ')');
if (fs.existsSync(out)) { console.log('cached: ' + out + ' — $0'); process.exit(0); }
if (total + usd > cap) { console.error('refused: $' + (total + usd).toFixed(2) + ' would pass the ceiling $' + cap); process.exit(3); }
if (!argv.includes('--go')) { console.log('dry run: no call made (pass --go); the answer would be ' + out); process.exit(0); }

const env = loadEnv(opt('--env-root', 'C:/RnD'));
if (!env.FAL_KEY) { console.error('FAL_KEY missing (read by name)'); process.exit(1); }
const row = ledger.reserve({ at: new Date().toISOString(), op: 'flatfix', scene: asset + ':' + tag, model: m.endpoint, model_key: modelKey, reserved_usd: usd,
  inputs_hash: hash, width: size, height: size, status: 'reserved', apartment: id });
try {
  const r = await fetch('https://fal.run/' + m.endpoint, { method: 'POST', headers: { Authorization: 'Key ' + env.FAL_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(400000) });
  const txt = await r.text();
  if (!r.ok) { ledger.settle(row, 0, { status: 'error-' + r.status, note: txt.slice(0, 200) }); console.error('fal ' + r.status + ': ' + txt.slice(0, 300)); process.exit(1); }
  const url = JSON.parse(txt).images?.[0]?.url;
  if (!url) { ledger.settle(row, usd, { status: 'error-no-image' }); console.error('no image in the answer'); process.exit(1); }
  const buf = url.startsWith('data:') ? Buffer.from(url.slice(url.indexOf(',') + 1), 'base64') : Buffer.from(await (await fetch(url)).arrayBuffer());
  fs.writeFileSync(out, buf);
  ledger.settle(row, usd, { status: 'ok', out: path.relative(APT, out) });
  console.log('ok: ' + out + ' (' + buf.length + ' B); ledger now $' + ledger.total().toFixed(2));
} catch (e) {
  ledger.settle(row, usd, { status: 'error-unknown-billing', note: String(e).slice(0, 200) });
  console.error('call failed: ' + String(e).slice(0, 200));
  process.exit(1);
}
