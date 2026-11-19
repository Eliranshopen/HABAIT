// enhance.mjs - ONE paid fal call: a Blender still -> a photoreal still on the SAME geometry (root §7).
// Dry by default; --go sends. The call is reserved in the ledger BEFORE it is sent and settled after.
// The key is read BY NAME by the pipeline's own loader (file-ledger.mjs loadEnv); never printed, never stored.
// usage: node enhance.mjs <project> <still_id> [--model nb2|gpt25-medium] [--cap 15] [--go]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const LOADER = 'C:/RnD/.wt/kedma-d1/Projects/3Dengine/pipeline/Habait/tour360/tools/file-ledger.mjs';
const { loadEnv } = await import(pathToFileURL(LOADER).href);
const argv = process.argv.slice(2);
const [proj, id] = argv;
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.join(proj, 'out', 'avnei-hefetz-kedem', 'buildings-1-2', '4-rooms');
const src = path.join(OUT, 'renders', 'still', id + '.png');
const plan = JSON.parse(fs.readFileSync(path.join(proj, 'plan', 'plan.json'), 'utf8'));
const st = plan.stills.find((s) => s.id === id);
if (!st) { console.error('unknown still ' + id); process.exit(2); }
const MODELS = {
  nb2: { endpoint: 'fal-ai/nano-banana-2/edit', usd: 0.12, body: (p, im) => ({ prompt: p, image_urls: [im], num_images: 1, output_format: 'png', aspect_ratio: '3:2', resolution: '2K', sync_mode: true }) },
  'gpt25-medium': { endpoint: 'openai/gpt-image-2.5/sunburst/edit', usd: 0.20, body: (p, im) => ({ prompt: p, image_urls: [im], num_images: 1, output_format: 'png', quality: 'medium', image_size: { width: 1536, height: 1024 }, sync_mode: true }) },
};
const mk = opt('--model', 'nb2');
const m = MODELS[mk];
const cap = Number(opt('--cap', '15'));

// what this view contains, read from the plan (so the model is told, never left to guess)
const ROOM_WORDS = {
  'hero-living': 'a living room: a light grey fabric two-seat sofa with two cushions, a round light-oak coffee table on a beige wool rug, a black leather lounge armchair with a wooden frame, a wall-mounted black TV above a low oak media unit, a doorway on the left wall, two aluminium sliding windows on the far wall, and the edge of a dining table with white chairs at the left',
  'living-dining': 'an open living and dining space: an oak dining table with six white upholstered chairs under a black pendant lamp, a wide aluminium glass sliding door to the balcony, an open white kitchen at the far end, a sofa and a round coffee table on a rug',
  'entry-view': 'the view from the front door into the living room: the living area with sofa, rug and round coffee table, dining table with white chairs, the doorway to the bedroom corridor, aluminium windows',
  kitchen: 'an L-shaped kitchen: flat white handle-less lower cabinets on a black plinth, a white quartz countertop and backsplash, two black undermount sinks with a tall steel tap, a black glass gas hob, closed white upper cabinets with under-cabinet light, a stainless steel fridge, a small aluminium window above the counter',
  master: 'a main bedroom: a double bed with a grey upholstered headboard, white bedding and a sage green throw, two round walnut nightstands with lamps, a full-height oak wardrobe, wood-look parquet floor, an aluminium window, the doorway to the en-suite bathroom',
  bedroom: 'a children\'s bedroom: two single beds with grey bedding, a full-height oak wardrobe, an aluminium window, white walls, porcelain floor',
  mamad: 'a bedroom that is also the reinforced safe room: two single beds with grey bedding, a full-height oak wardrobe, a small aluminium window, a heavy steel door',
  bath: 'a family bathroom: a white built-in bathtub, a wall-hung white toilet with a tiled concealed cistern, an oak vanity with a white basin and a mirror, a white front-loading washing machine, a small frosted window, light porcelain tiles on the walls to 2.4 m',
  ensuite: 'a small en-suite bathroom: a glass shower enclosure with a rain shower, a wall-hung toilet, a small oak vanity with a mirror, a small frosted window, porcelain tiles on the walls',
  balcony: 'a covered balcony: wood-look deck floor, a glass railing with an aluminium top rail, an outdoor table with chairs, potted plants, a wide aluminium sliding glass door into the living room',
};
const prompt = [
  'This image is a computer render of a real apartment interior from its sales plan. Turn it into a high-end, natural, photorealistic interior photograph of the SAME room.',
  'Keep the geometry pixel for pixel: every wall, corner, ceiling line, doorway, window, sliding door and piece of furniture stays exactly where it is, with the same size and shape. Same camera, same framing, same perspective, same lens - do not zoom, crop, re-frame, straighten or rotate.',
  'Do not add, remove, move or resize any wall, door, window, opening, column, beam or furniture. Do not add skirting boards (there are none between the walls and the floor). Do not add curtains, ceiling beams, niches or shelves.',
  'In this picture there is ' + (ROOM_WORDS[id] || 'a room') + '. Nothing else is a door or a window.',
  'Make the materials real: matte warm-white painted walls, large 80x80 cm light grey porcelain floor tiles with thin joints (wood-look parquet in the main bedroom), real fabric texture, real wood grain, real brushed metal, clear glass. Soft natural daylight from the windows, gentle realistic shadows, balanced exposure, no lens distortion. Outside the windows: a soft bright sky.',
].join(' ');
const img = fs.readFileSync(src);
const dataUri = 'data:image/png;base64,' + img.toString('base64');
const hash = crypto.createHash('sha256').update(JSON.stringify({ e: m.endpoint, prompt, i: crypto.createHash('sha256').update(img).digest('hex') })).digest('hex').slice(0, 12);
const outDir = path.join(OUT, 'renders', 'ai', mk);
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, id + '.png');
const ledgerFile = path.join(OUT, 'ledger.json');
const ledger = fs.existsSync(ledgerFile) ? JSON.parse(fs.readFileSync(ledgerFile, 'utf8')) : { cap_usd: cap, rows: [] };
const total = () => ledger.rows.reduce((s, r) => s + (r.settled_usd ?? r.reserved_usd), 0);
const save = () => fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 1));
console.log(`enhance ${id} via ${m.endpoint} - booked $${m.usd.toFixed(2)}; ledger so far $${total().toFixed(2)} (cap $${cap})`);
const cached = ledger.rows.find((r) => r.inputs_hash === hash && r.status === 'ok' && fs.existsSync(out));
if (cached) { console.log('cached: ' + out + ' - $0'); process.exit(0); }
if (total() + m.usd > cap) { console.error('refused: would pass the cap'); process.exit(3); }
if (!argv.includes('--go')) { console.log('dry run: no call made (pass --go)'); process.exit(0); }
const env = loadEnv(opt('--env-root', 'C:/RnD'));
if (!env.FAL_KEY) { console.error('FAL_KEY missing (read by name)'); process.exit(1); }
const row = { at: new Date().toISOString(), op: 'enhance-still', id, model: m.endpoint, reserved_usd: m.usd, inputs_hash: hash, status: 'reserved' };
ledger.rows.push(row); save();
const t0 = Date.now();
try {
  const r = await fetch('https://fal.run/' + m.endpoint, { method: 'POST', headers: { Authorization: 'Key ' + env.FAL_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(m.body(prompt, dataUri)), signal: AbortSignal.timeout(400000) });
  const txt = await r.text();
  if (!r.ok) { row.status = 'error-' + r.status; row.settled_usd = 0; row.note = txt.slice(0, 200); save(); console.error('fal ' + r.status + ': ' + txt.slice(0, 300)); process.exit(1); }
  const url = JSON.parse(txt).images?.[0]?.url;
  if (!url) { row.status = 'error-no-image'; row.settled_usd = m.usd; save(); console.error('no image'); process.exit(1); }
  const buf = url.startsWith('data:') ? Buffer.from(url.slice(url.indexOf(',') + 1), 'base64') : Buffer.from(await (await fetch(url)).arrayBuffer());
  fs.writeFileSync(out, buf);
  row.status = 'ok'; row.settled_usd = m.usd; row.seconds = Math.round((Date.now() - t0) / 100) / 10; row.out = path.relative(OUT, out);
  fs.writeFileSync(path.join(outDir, id + '.prompt.txt'), prompt);
  save();
  console.log(`ok: ${out} (${buf.length} B, ${row.seconds} s); ledger now $${total().toFixed(2)}`);
} catch (e) {
  row.status = 'error-unknown-billing'; row.settled_usd = m.usd; row.note = String(e).slice(0, 200); save();
  console.error('call failed: ' + String(e).slice(0, 200)); process.exit(1);
}
