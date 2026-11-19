/* Habait Tour360 — tools/gen-pano.mjs — the generator lane for a NEW apartment (PLAN §4.4; caps D-T360-10).
   One scene, one model per call: apartments/<id>/prompts.json → fal (sync_mode, references as data URIs) → apartments/<id>/_local/generated/,
   padded to 2:1 with black bars when the model cannot emit 2:1 (360walkaround F-360-29: black pads read as clean poles, edge pads smear).
   Money: reserve before send, settle after, in apartments/<id>/_local/ledger.json — a soft cap warns, the hard cap refuses before any call.
   Cache: the inputs hash names the output, so a re-run of the same scene + model + seed is $0. FAL_KEY is read by name, never printed.
   usage (Git Bash, paid → bounded): timeout 540 node Habait/tour360/tools/gen-pano.mjs <apartment> <scene> <model> [--seed N] [--dry]
   models: seedream45 (4096×2048, $0.04) · nbpro (Nano Banana Pro 2K at 21:9, padded, $0.15) · gpt2 (GPT Image 2 at 2048×1024, booked $0.40) */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { fileLedger, loadEnv } from './file-ledger.mjs';
import { MODELS as IMAGE_MODELS } from './image-models.mjs';
import { appRequire } from './app-require.mjs';
import { padToPano2x1, measurePng } from '../../../360walkaround/server/pano.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOUR = path.resolve(HERE, '..');
const HARNESS = path.resolve(TOUR, '..', '..');
// --cap <usd> raises the apartment's hard cap (soft = half) — apt846 runs under Slava's 2026-10-28 "unlimited budget" ruling with a reported cap.
const capFlag = (() => { const i = process.argv.indexOf('--cap'); return i > 0 ? Number(process.argv[i + 1]) : undefined; })();
const HARD_USD = capFlag && capFlag > 0 ? capFlag : 10, SOFT_USD = capFlag && capFlag > 0 ? capFlag / 2 : 5;

const MODELS = {
  seedream45: {
    endpoint: 'fal-ai/bytedance/seedream/v4.5/edit', usd: 0.04,
    body: (p, refs, seed) => ({ prompt: p, image_urls: refs, image_size: { width: 4096, height: 2048 }, num_images: 1, max_images: 1, seed, sync_mode: true, enable_safety_checker: true }),
    pad: false,
  },
  // Token-billed on fal ($30 per 1M output image tokens, 2026-10-15): ≈ $0.25–0.30 at 2048×1024 high, BOOKED at a worst case of $0.40.
  gpt2: {
    endpoint: 'openai/gpt-image-2/edit', usd: 0.40,
    body: (p, refs, seed) => ({ prompt: p, image_urls: refs, image_size: { width: 2048, height: 1024 }, quality: 'high', num_images: 1, output_format: 'png', sync_mode: true }),
    pad: false,
  },
  // 2026-10-28 (apt846 model probe): the same lane at 4096×2048 — token-billed, booked at a worst case of $1.60.
  gpt2x: {
    endpoint: 'openai/gpt-image-2/edit', usd: 1.60,
    body: (p, refs, seed) => ({ prompt: p, image_urls: refs, image_size: { width: 4096, height: 2048 }, quality: 'high', num_images: 1, output_format: 'png', sync_mode: true }),
    pad: false,
  },
  // GPT Image 2.5 "Sunburst" edit (fal, published 2026-09-08): custom sizes, quality up to max; booked worst case $0.60 at 2048×1024 high.
  gpt25: {
    endpoint: 'openai/gpt-image-2.5/sunburst/edit', usd: 0.60,
    body: (p, refs, seed) => ({ prompt: p, image_urls: refs, image_size: { width: 2048, height: 1024 }, quality: 'high', num_images: 1, output_format: 'png', sync_mode: true }),
    pad: false,
  },
  gpt25x: {
    endpoint: 'openai/gpt-image-2.5/sunburst/edit', usd: 2.40,
    body: (p, refs, seed) => ({ prompt: p, image_urls: refs, image_size: { width: 4096, height: 2048 }, quality: 'high', num_images: 1, output_format: 'png', sync_mode: true }),
    pad: false,
  },
  // the same lane at quality xhigh (more detail, more tokens) — booked worst case $3.50; the answer comes back 3840×1920 (measured 2026-10-28).
  gpt25xx: {
    endpoint: 'openai/gpt-image-2.5/sunburst/edit', usd: 3.50,
    body: (p, refs, seed) => ({ prompt: p, image_urls: refs, image_size: { width: 4096, height: 2048 }, quality: 'xhigh', num_images: 1, output_format: 'png', sync_mode: true }),
    pad: false,
  },
  // Seedream 5.0 Pro edit: custom size, max area 4,624,220 px → 3040×1520 is the largest 2:1; $0.0675 a unit.
  seedream5: {
    endpoint: 'bytedance/seedream/v5/pro/edit', usd: 0.14,
    body: (p, refs, seed) => ({ prompt: p, image_urls: refs, image_size: { width: 3040, height: 1520 }, num_images: 1, output_format: 'png', sync_mode: true, enable_safety_checker: true, enhance_prompt_mode: 'standard' }),
    pad: false,
  },
  // FLUX.2 [pro] edit: $0.03 per processed megapixel (inputs + output) — 2048×1024 out ≈ $0.15 booked.
  flux2: {
    endpoint: 'fal-ai/flux-2-pro/edit', usd: 0.25,
    body: (p, refs, seed) => ({ prompt: p, image_urls: refs, image_size: { width: 2048, height: 1024 }, output_format: 'png', seed, sync_mode: true, enable_safety_checker: true }),
    pad: false,
  },
  nbpro: {
    endpoint: 'fal-ai/nano-banana-pro/edit', usd: 0.15,
    body: (p, refs, seed) => ({ prompt: p, image_urls: refs, aspect_ratio: '21:9', resolution: '2K', output_format: 'png', num_images: 1, seed, sync_mode: true }),
    pad: true,
  },
};

// the skin lanes (WALKAROUND-QUALITY-PLAN §3.1, D-WQ-13): image 1 = the CG render, then the anchor and the board references
MODELS.muse = { endpoint: 'meta/muse-image/edit', usd: 0.01, body: (p, refs, seed) => ({ prompt: p, image_urls: refs, aspect_ratio: '2:1', output_format: 'png', num_images: 1, sync_mode: true }) };
MODELS.flux3 = { endpoint: 'blackforestlabs/flux-3/edit-image', usd: 0.2, body: (p, refs, seed) => ({ prompt: p, image_urls: refs, aspect_ratio: '2:1', resolution: '2k', output_format: 'png', safety_tolerance: 2, sync_mode: true }) };
// the LOCKED-POLISH lanes (D-WQ-36, 2026-10-29: the apartment exists once in the CG; the AI may only change finish and light).
// nb21: Nano Banana 2.1 edit at 4K, image 1 = the furnished CG render (fal's published default editor; unit-priced, booked $0.40 worst case).
MODELS.nb21 = { endpoint: 'google/nano-banana-2.1/edit', usd: 0.40, body: (p, refs, seed) => ({ prompt: p, image_urls: refs, aspect_ratio: '21:9', resolution: '4K', output_format: 'png', num_images: 1, seed, sync_mode: true }), pad: true };
// fluxdepth: FLUX.1 [dev] Control LoRA Depth, image-to-image — refs[0] = the CG render (the init image, `strength` 0.55 keeps its colour and
// layout), refs[1] = the CG's OWN depth pass as an 8-bit map (make-depth-map.mjs): the structure is conditioned, not guessed. 2048×1024
// ($0.04 a megapixel → ≈ $0.08, booked $0.15); the 2× seamless upscale of the web sets takes it to 4K.
// R30 (2026-11-06): the shared image-models.mjs table as lanes too (key = its key), so a skin can be made by the cheaper models the bake-off chose
for (const [k, m] of Object.entries(IMAGE_MODELS)) if (!MODELS[k]) MODELS[k] = { endpoint: m.endpoint, usd: m.usd, body: (p, refs) => ({ ...m.body(p, []), image_urls: refs }) };
MODELS.fluxdepth = { endpoint: 'fal-ai/flux-control-lora-depth/image-to-image', usd: 0.15, body: (p, refs, seed) => ({ prompt: p, image_url: refs[0], control_lora_image_url: refs[1], control_lora_strength: 1, strength: 0.55, image_size: { width: 2048, height: 1024 }, num_inference_steps: 28, guidance_scale: 3.5, seed, output_format: 'png', sync_mode: true }), pad: false };
const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const VALUE_FLAGS = ['--seed', '--cap', '--prompts'];
const [aptId, sceneId, modelKey] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && VALUE_FLAGS.includes(args[i - 1])));
const PROMPTS_FILE = flag('--prompts') || 'prompts.json';   // --prompts skin-prompts.json runs the skin lane on the same ledger
const dry = args.includes('--dry');
const seed = flag('--seed') !== undefined ? Number(flag('--seed')) : 7;
if (!aptId || !sceneId || !MODELS[modelKey]) { console.error(`usage: gen-pano.mjs <apartment> <scene> <${Object.keys(MODELS).join('|')}> [--seed N] [--cap USD] [--dry]`); process.exit(2); }

const APT = path.join(TOUR, 'apartments', aptId);
const scene = JSON.parse(fs.readFileSync(path.join(APT, PROMPTS_FILE), 'utf8')).find((s) => s.id === sceneId);
if (!scene) { console.error(`gen-pano: no scene ${sceneId} in ${aptId}/prompts.json`); process.exit(2); }
const model = MODELS[modelKey];

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const refs = (scene.references || []).map((r) => path.resolve(APT, r));
const refBytes = refs.map((r) => fs.readFileSync(r));
const mimeOf = (f) => (/\.png$/i.test(f) ? 'image/png' : /\.webp$/i.test(f) ? 'image/webp' : 'image/jpeg');
const hash = sha(JSON.stringify({ e: model.endpoint, p: scene.prompt, r: refBytes.map(sha), seed, b: model.body('', [], seed) })).slice(0, 12);
const OUT = path.join(APT, '_local', 'generated');
const outFile = path.join(OUT, `${sceneId}__${modelKey}__s${seed}__${hash}.png`);
const ledger = fileLedger(path.join(APT, '_local', 'ledger.json'));

const hitFile = [outFile, outFile.replace(/\.png$/, '.jpg')].find((f) => fs.existsSync(f));
if (hitFile) { console.log(`cache hit ($0): ${path.relative(TOUR, hitFile)}`); process.exit(0); }
// A paid answer whose local step failed is finished from its saved raw bytes, never by a second call.
const rawFile = [outFile.replace(/\.png$/, '.raw.png'), outFile.replace(/\.png$/, '.raw.jpg')].find((f) => fs.existsSync(f));
if (rawFile) {
  const r = finish(fs.readFileSync(rawFile)); await unrollIfRolled(r.file);
  const d = ledger.load();
  d.rows.forEach((x, i) => { if (x.inputs_hash === hash && x.status === 'reserved') ledger.settle(i, x.reserved_usd, { status: 'ok', out: path.relative(APT, r.file), width: r.width, height: r.height, note: 'finished locally from the saved raw answer' }); });
  console.log(`finished from the saved raw answer, no call: ${path.relative(TOUR, r.file)} ${r.width}×${r.height}; ledger $${ledger.total().toFixed(2)}`);
  process.exit(0);
}
const spent = ledger.total();
console.log(`${aptId}/${sceneId} via ${model.endpoint} seed ${seed} — booked $${model.usd.toFixed(2)}; ledger so far $${spent.toFixed(2)} (soft $${SOFT_USD}, hard $${HARD_USD})`);
if (spent + model.usd > HARD_USD) { console.error('gen-pano: REFUSED — this call would cross the hard cap'); process.exit(3); }
if (spent + model.usd > SOFT_USD) console.warn('gen-pano: WARNING — past the soft cap; Slava is told before the next call');
if (dry) { console.log('dry run: no call made'); process.exit(0); }

// A git worktree under .claude/worktrees/ has no .env of its own: walk up to the checkout that does.
let env = loadEnv(HARNESS);
for (let dir = HARNESS, i = 0; !env.FAL_KEY && i < 5; i++) { dir = path.dirname(dir); env = loadEnv(dir); }
if (!env.FAL_KEY) { console.error('gen-pano: FAL_KEY missing (read by name from the environment or a root .env)'); process.exit(1); }
const doc = ledger.load(); if (doc.cap_usd !== HARD_USD) { doc.cap_usd = HARD_USD; doc.soft_usd = SOFT_USD; ledger.save(doc); }
const row = ledger.reserve({ at: new Date().toISOString(), apartment: aptId, scene: sceneId, model: model.endpoint, seed, inputs_hash: hash, reserved_usd: model.usd, status: 'reserved' });

const dataUris = refBytes.map((b, i) => `data:${mimeOf(refs[i])};base64,${b.toString('base64')}`);
let res, json;
try {
  res = await fetch(`https://fal.run/${model.endpoint}`, {
    method: 'POST', headers: { Authorization: `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(model.body(scene.prompt, dataUris, seed)), signal: AbortSignal.timeout(300000),
  });
  json = await res.json().catch(() => ({}));
} catch (e) {
  ledger.settle(row, model.usd, { status: 'error-unknown-billing', note: String(e.message).slice(0, 160) });
  console.error('gen-pano: call failed before an answer; booked at the worst case:', String(e.message).slice(0, 160)); process.exit(1);
}
if (!res.ok) {
  ledger.settle(row, 0, { status: `http-${res.status}`, note: JSON.stringify(json).slice(0, 200) });
  console.error(`gen-pano: HTTP ${res.status}`, JSON.stringify(json).slice(0, 300)); process.exit(1);
}
const img = json.images?.[0];
if (!img?.url) { ledger.settle(row, model.usd, { status: 'billed-no-image', note: JSON.stringify(json).slice(0, 200) }); console.error('gen-pano: no image in the answer'); process.exit(1); }
const bytes = img.url.startsWith('data:') ? Buffer.from(img.url.split(',')[1], 'base64') : Buffer.from(await (await fetch(img.url)).arrayBuffer());
fs.mkdirSync(OUT, { recursive: true });
const isPng = bytes.subarray(1, 4).toString('ascii') === 'PNG';
fs.writeFileSync(outFile.replace(/\.png$/, isPng ? '.raw.png' : '.raw.jpg'), bytes);
ledger.settle(row, model.usd, { status: 'billed-raw-saved' });
const r = finish(bytes); await unrollIfRolled(r.file);
ledger.settle(row, model.usd, { status: 'ok', out: path.relative(APT, r.file), width: r.width, height: r.height, ...(scene.roll ? { roll_u_edge: scene.roll.u_edge } : {}) });
console.log(`ok: ${path.relative(TOUR, r.file)} ${r.width}×${r.height}; ledger now $${ledger.total().toFixed(2)}`);

/** A rolled skin (make-skin-prompts.mjs --roll auto: image 1 was the CG rolled so the seam parks on a blank wall) is rolled
    back here into the camera's frame, so the finished answer, the tests and the web sets all read the same u. The raw answer
    stays as it came. The entry's roll.u_edge is where the answer's left edge sits in the camera frame. */
async function unrollIfRolled(file) {
  if (!scene.roll || !(scene.roll.u_edge > 0)) return;
  const sharp = appRequire(HARNESS)('sharp');
  const m = await sharp(file).metadata(); const W = m.width, H = m.height, x0 = Math.round(scene.roll.u_edge * W) % W; if (!x0) return;
  const L = await sharp(file).extract({ left: W - x0, top: 0, width: x0, height: H }).toBuffer(); const R = await sharp(file).extract({ left: 0, top: 0, width: W - x0, height: H }).toBuffer();
  const out = await sharp({ create: { width: W, height: H, channels: 3, background: '#000' } }).composite([{ input: L, left: 0, top: 0 }, { input: R, left: x0, top: 0 }]).png().toBuffer();
  fs.writeFileSync(file, out);
  console.log(`rolled back into the camera frame by ${x0} px (u_edge ${scene.roll.u_edge})`);
}

/** The local step: pad a PNG to 2:1 when the model cannot emit it; a JPEG passes through. Returns what it wrote. */
function finish(raw) {
  const png = raw.subarray(1, 4).toString('ascii') === 'PNG';
  if (png && model.pad) {
    const w0 = measurePng(raw).width, w = w0 - (w0 % 2);
    const p = padToPano2x1(raw, { targetW: w, targetH: w / 2, padMode: 'black' });
    fs.writeFileSync(outFile, p.png);
    return { file: outFile, width: p.width, height: p.height };
  }
  if (png) { const d = measurePng(raw); fs.writeFileSync(outFile, raw); return { file: outFile, width: d.width, height: d.height }; }
  const jpg = outFile.replace(/\.png$/, '.jpg');
  fs.writeFileSync(jpg, raw);
  return { file: jpg, ...jpegSize(raw) };
}

function jpegSize(b) {
  for (let i = 2; i < b.length - 9;) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1], len = b.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
    i += 2 + len;
  }
  return { width: null, height: null };
}
