#!/usr/bin/env node
/* Habait Tour360 — tools/skin-frame.mjs (2026-11-01, Eliran's flyover: the exterior keyframes of Habait/studio).
   Skins ONE perspective clay frame (a grey Cycles render of the tower massing + OSM neighbours, 960x540) into a photograph
   with GPT Image 2.5 edit, keeping the composition: the Studio's render-to-real then drives the clip from this frame.
   The look is the apartment's material board (glazing line) plus an exterior line; nothing branded (D-WQ-18): the tower is a
   massing from the sales sheet's floor key, not the real facade, so the words say "a glass residential tower, Tel Aviv".
   Money: one ledgered call per frame in apartments/<apt>/_local/ledger.json (reserve-and-settle, booked $1.20 at 1920x1080
   high); the inputs hash names the output, so a re-run is $0. FAL_KEY by name from the root .env, never printed.
     node Habait/tour360/tools/skin-frame.mjs <apt> <clay.png> <out.png> --time morning|evening [--ref facade.png] [--cap USD] [--dry] [--seed N]
   --ref: a still of the real tower (e.g. a frame of the developer's video) as Image 2, for the facade's materials only;
   the clay still owns the geometry and framing, and nothing branded is copied (no logos, signage or lettering).
   The answer (1920x1080) is saved beside <out.png> as <out>.full.png; <out.png> is the clay's own size (sharp, app-require). */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { fileLedger, loadEnv } from './file-ledger.mjs';
import { appRequire } from './app-require.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOUR = path.resolve(HERE, '..');
const HARNESS = path.resolve(TOUR, '..', '..');
const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const VALUED = ['--time', '--cap', '--seed', '--ref'];
const [aptId, clayFile, outFile] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && VALUED.includes(args[i - 1])));
if (!aptId || !clayFile || !outFile) { console.error('usage: skin-frame.mjs <apt> <clay.png> <out.png> --time morning|evening [--cap USD] [--dry] [--seed N]'); process.exit(2); }
const time = flag('--time') || 'morning';
const seed = Number(flag('--seed') || 7);
const capFlag = Number(flag('--cap') || 0);
const HARD_USD = capFlag > 0 ? capFlag : 10, SOFT_USD = capFlag > 0 ? capFlag / 2 : 5;
const dry = args.includes('--dry');
const refFile = flag('--ref');
const ENDPOINT = 'openai/gpt-image-2.5/sunburst/edit', USD = 1.2;
const APT = path.join(TOUR, 'apartments', aptId);
const board = JSON.parse(fs.readFileSync(path.join(APT, 'material-board.json'), 'utf8'));
const sharp = appRequire(HARNESS)('sharp');

const LIGHT = {
  morning: 'soft bright morning light from the east, a clear pale-blue sky with a little haze, the sea a calm silver-blue',
  evening: 'warm golden-hour light from the west over the sea, long soft shadows, a pale orange-to-blue sky, a few apartment windows lit',
}[time];
if (!LIGHT) { console.error(`--time must be morning or evening, not ${time}`); process.exit(2); }

const clay = fs.readFileSync(path.resolve(clayFile));
const ref = refFile ? fs.readFileSync(path.resolve(refFile)) : null;
const TOWER = ref
  ? 'a slender new-build residential tower that twists gently as it rises: every floor wrapped in white, softly undulating curved balcony slabs with planters and frameless glass railings, floor-to-ceiling glazing with slim dark mullions behind them, a sculpted crown of curved slabs at the top; at its base, lower white residential buildings with curved balconies, wherever the clay has them'
  : `a new-build glass residential tower: ${board.surfaces.glazing}; floor-to-ceiling glazing on every floor, slim dark mullions, continuous balconies with frameless glass railings, a pale stone base, a flat roof with a slim parapet`;
const REF_WORDS = ref ? ' Image 2 is an architectural render of the real tower: copy only its facade (cladding colour, glazing rhythm, balcony and railing design, the crown at the top) onto the tall tower, never its framing, camera, surroundings, logos or lettering.' : '';
const meta = await sharp(clay).metadata();
const prompt = `Image 1 is a plain grey computer render (a clay render) of a residential tower and its neighbourhood in Tel Aviv, seen from the air. Re-render it as a photograph taken from exactly the same camera: keep every building mass, every edge, the horizon, the roads, the sea and the composition exactly where they are, add no building and remove none, and keep the aspect and framing unchanged.${REF_WORDS} The tall tower in the centre of attention is ${TOWER}. The neighbouring buildings are ordinary pale Tel Aviv apartment blocks with balconies, trees along the streets, the Mediterranean sea to the west with a sandy beach. ${LIGHT}. Photoreal, sharp, natural colours, no text, no logos, no signage, no branding, no people, no watermark, no border.`;
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const hash = sha(JSON.stringify({ e: ENDPOINT, p: prompt, c: sha(clay), r: ref ? sha(ref) : null, seed })).slice(0, 12);
const out = path.resolve(outFile);
const full = out.replace(/\.png$/i, '') + `.full.${hash}.png`;
const ledger = fileLedger(path.join(APT, '_local', 'ledger.json'));

async function finish(answer) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(full, answer);
  await sharp(answer).resize({ width: meta.width, height: meta.height, fit: 'fill' }).png().toFile(out);
  console.log(`ok: ${path.relative(process.cwd(), out)} ${meta.width}x${meta.height} (the full answer ${path.basename(full)})`);
}
if (fs.existsSync(full)) { console.log(`cache hit ($0): ${path.basename(full)}`); await finish(fs.readFileSync(full)); process.exit(0); }
const spent = ledger.total();
console.log(`${aptId} skin-frame ${path.basename(clayFile)} (${meta.width}x${meta.height}, ${time}) via ${ENDPOINT} — booked $${USD.toFixed(2)}; ledger so far $${spent.toFixed(2)} (soft $${SOFT_USD}, hard $${HARD_USD})`);
if (spent + USD > HARD_USD) { console.error('skin-frame: REFUSED — this call would cross the hard cap'); process.exit(3); }
if (dry) { console.log('dry run: no call made\n--- prompt ---\n' + prompt); process.exit(0); }

let env = loadEnv(HARNESS);
for (let dir = HARNESS, i = 0; !env.FAL_KEY && i < 5; i++) { dir = path.dirname(dir); env = loadEnv(dir); }
if (!env.FAL_KEY) { console.error('skin-frame: FAL_KEY missing (read by name from the environment or a root .env)'); process.exit(1); }
const row = ledger.reserve({ at: new Date().toISOString(), apartment: aptId, scene: `frame:${path.basename(clayFile)}:${time}`, model: ENDPOINT, seed, inputs_hash: hash, reserved_usd: USD, status: 'reserved' });
const uri = (b) => `data:image/png;base64,${b.toString('base64')}`;
let res, json;
try {
  res = await fetch(`https://fal.run/${ENDPOINT}`, {
    method: 'POST', headers: { Authorization: `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, image_urls: ref ? [uri(clay), uri(ref)] : [uri(clay)], image_size: { width: 1920, height: 1080 }, quality: 'high', num_images: 1, output_format: 'png', sync_mode: true }),
    signal: AbortSignal.timeout(300000),
  });
  json = await res.json().catch(() => ({}));
} catch (e) { ledger.settle(row, USD, { status: 'error-unknown-billing', note: String(e.message).slice(0, 160) }); console.error('skin-frame: call failed before an answer; booked at the worst case:', String(e.message).slice(0, 160)); process.exit(1); }
if (!res.ok) { ledger.settle(row, 0, { status: `http-${res.status}`, note: JSON.stringify(json).slice(0, 200) }); console.error(`skin-frame: HTTP ${res.status}`, JSON.stringify(json).slice(0, 300)); process.exit(1); }
const img = json.images?.[0];
if (!img?.url) { ledger.settle(row, USD, { status: 'billed-no-image', note: JSON.stringify(json).slice(0, 200) }); console.error('skin-frame: no image in the answer'); process.exit(1); }
const bytes = img.url.startsWith('data:') ? Buffer.from(img.url.split(',')[1], 'base64') : Buffer.from(await (await fetch(img.url)).arrayBuffer());
await finish(bytes);
ledger.settle(row, USD, { status: 'ok', out: path.relative(APT, full) });
console.log(`ledger now $${ledger.total().toFixed(2)}`);
