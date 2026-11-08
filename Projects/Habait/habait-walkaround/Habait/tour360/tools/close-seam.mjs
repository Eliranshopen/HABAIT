#!/usr/bin/env node
/* Habait Tour360 — tools/close-seam.mjs (WALKAROUND-QUALITY-PLAN.md OQ-2, D-WQ-33 step 3/4, 2026-10-29): close a skin's wrap seam.
   A generative skin does not join its own left and right edges (the living room's armchair and island were cut at the entrance).
   The close: the picked final and its CG render are rolled half a turn so the wrap edge sits at the centre column; a mask marks a
   band of --band-deg (default 12°) around it; GPT Image 2.5's edit is asked to repaint ONLY the band so floor, walls and furniture
   continue across it, with the rolled CG as Image 2 for the true geometry inside the band; the answer's band is pasted back onto the
   rolled final with a feathered edge (nothing outside the band changes, whatever the model returned), the picture is rolled back and
   saved as a new generated answer; --pick makes it the scene's pick (tools/make-sets.mjs then carries it).
   Money: one ledgered call per close (booked $2.40, reserve-and-settle in _local/ledger.json under --cap, as gen-pano.mjs); the
   inputs hash names the output, so a re-run of the same close is $0. FAL_KEY by name, never printed. Prints the seam step before and
   after (openings-test.mjs's measure) and writes a before/after strip beside the answer for the eye.
   2026-11-01 (habait-de): the close now rolls the skin's OWN join to the centre — for a rolled skin (make-skin-prompts.mjs --roll auto)
   that is u = roll.u_edge (tools/skin-seam.mjs), not x 0; before, every rolled room's close repainted a column inside the answer and
   left the real cut. An unrolled skin (u 0) rolls by exactly half as before, so its inputs hash and its cached answers are unchanged.
     timeout 540 node Habait/tour360/tools/close-seam.mjs <apartment> <asset> [--band-deg 12] [--cap USD] [--dry] [--pick] [--no-cg] [--u <u>] [--extra "<words>"]
   --extra appends room-specific words to the prompt (e.g. "no plant in front of the open view"); absent, the prompt and hash are as before.
   --ref <file> (2026-11-05, parity R10: one fixed element painted once) adds the element's own finished picture as the LAST image: inside the
   band the element copies its materials and fixtures; geometry still comes from the CG. Absent, prompt and hash are as before. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { appRequire } from './app-require.mjs';
import { fileLedger, loadEnv } from './file-ledger.mjs';
import { skinSeamU } from './skin-seam.mjs';
import { modelFor } from './image-models.mjs';
import { registerAnswer } from './register-answer.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOUR = path.resolve(HERE, '..');
const HARNESS = path.resolve(TOUR, '..', '..');
const sharp = appRequire(HARNESS)('sharp');
const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const VALUE_FLAGS = ['--band-deg', '--cap', '--u', '--extra', '--cg-tour', '--ref', '--raw', '--cut-search', '--align-max', '--align-at', '--ref-object', '--ref-class', '--model', '--rows'];
const [aptId, asset] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && VALUE_FLAGS.includes(args[i - 1])));
// --cut-search <px> (R25): how far outside the band each cut may move to where answer and picture agree (default 40); recorded in the sidecar
const cutSearch = Number(flag('--cut-search') || 40);
// --align-max <px> (R25): how far the repaint's lines may be bent to meet the picture's (default 16; 10 reproduces the first v3 composites)
const alignMax = Number(flag('--align-max') || 16);
// --align-at cut|edge (R25): match the lines where the cut lands (default) or at the band edge (the first v3 composites)
const alignAt = flag('--align-at') || 'cut';
if (!aptId || !asset) { console.error('usage: close-seam.mjs <apartment> <asset> [--band-deg 12] [--cap USD] [--dry] [--pick]'); process.exit(2); }
const bandDeg = Number(flag('--band-deg') || 12);
// --rows v0,v1 (2026-11-06, the oven under the hob): the band covers only these rows (fractions of the height, e.g. the base cabinets
// below a counter's front edge); above and below them the picture is kept as it is (6-px ramps), so the hob and the worktop cannot move
const ROWS = flag('--rows') ? flag('--rows').split(',').map(Number) : null;
const capFlag = Number(flag('--cap') || 0);
const HARD_USD = capFlag > 0 ? capFlag : 10, SOFT_USD = capFlag > 0 ? capFlag / 2 : 5;
const dry = args.includes('--dry'), pick = args.includes('--pick');
// 2026-11-01 (Eliran): --no-cg closes the seam without the CG render (Image 2) when the renders are not on this machine; the band is then
// repainted from the final alone — the prompt asks for continuity only, and the inputs hash carries no CG.
const noCg = args.includes('--no-cg');
// --lite (2026-11-04, fix-846-fidelity): the site ships the 2048×1024 balanced set, so a 2048 skin is closed at 2048 (booked $0.60, the
// gpt25 lane of gen-pano.mjs) instead of 4096 ($2.40); the hash carries the size, so a lite close never collides with a full one.
const LITE = args.includes('--lite');
// --model <key> (2026-11-06, R30; the coordinator's go for the $5 live fixes): the painter from image-models.mjs; the default is
// fidelity.json image_models.defaults.repaint (gpt25-high, unchanged). A gpt25 key keeps the masked call exactly as before (the same
// hash for gpt25-high); any other model has no mask input, so it gets the mask as its LAST image and one sentence naming it — the band
// is pasted by the same cut + blend whatever the model returns, so nothing outside the band can change
const MODEL = modelFor('repaint', flag('--model'));
const GPT = MODEL.endpoint.startsWith('openai/gpt-image');
const ENDPOINT = MODEL.endpoint, USD = GPT ? (LITE ? MODEL.usd : MODEL.usd * 4) : MODEL.usd, SIZE = LITE || !GPT ? { width: 2048, height: 1024 } : { width: 4096, height: 2048 };

const APT = path.join(TOUR, 'apartments', aptId);
const GEN = path.join(APT, '_local', 'generated');
const picksFile = path.join(APT, '_local', 'picks.json');
const picks = fs.existsSync(picksFile) ? JSON.parse(fs.readFileSync(picksFile, 'utf8')) : {};
if (!picks[asset]) { console.error(`${asset}: no pick in _local/picks.json`); process.exit(2); }
const finalFile = path.join(GEN, picks[asset]);
const scenes = JSON.parse(fs.readFileSync(path.join(APT, 'scenes.json'), 'utf8')).scenes;
const scene = scenes.find((s) => s.asset === asset);
if (!scene) { console.error(`${asset}: no scene carries this asset`); process.exit(2); }
const plan = JSON.parse(fs.readFileSync(path.join(APT, 'plan.general.json'), 'utf8'));
const cam = plan.camera_points.find((c) => c.id.toLowerCase() === `cp-${scene.id}`.toLowerCase());
if (!cam) { console.error(`${asset}: no camera point cp-${scene.id} in the plan`); process.exit(2); }
const cgFile = path.resolve(HARNESS, '360walkaround', 'tours', flag('--cg-tour') || aptId, 'renders', cam.id, 'pano.webp');
if (!noCg && !fs.existsSync(cgFile)) { console.error(`${asset}: no CG render at ${cgFile} (pass --no-cg to close without it)`); process.exit(2); }
if (noCg) console.warn(`${asset}: closing WITHOUT the CG render (--no-cg)`);
const roomEn = (scene.name && scene.name.en) || scene.id;

// --- the pictures, rolled so the skin's own join sits at the centre column (half a turn for an unrolled skin)
const meta = await sharp(finalFile).metadata(); const W = meta.width, H = meta.height, half = W / 2;
if (Math.abs(W / H - 2) > 0.01) { console.error(`${asset}: ${W}x${H} is not 2:1`); process.exit(2); }
const seam = flag('--u') != null ? { u: Number(flag('--u')), from: '--u' } : skinSeamU(APT, finalFile, { asset });
const xs = Math.round(seam.u * W) % W, dx = (((half - xs) % W) + W) % W;
// shift right by d px, wrapping (d = half is the old half-turn roll, byte for byte)
const shift = async (input, d) => { d = ((d % W) + W) % W; if (!d) return sharp(input).png().toBuffer(); const A = await sharp(input).extract({ left: W - d, top: 0, width: d, height: H }).toBuffer(); const B = await sharp(input).extract({ left: 0, top: 0, width: W - d, height: H }).toBuffer(); return sharp({ create: { width: W, height: H, channels: 3, background: '#000' } }).composite([{ input: A, left: 0, top: 0 }, { input: B, left: d, top: 0 }]).png().toBuffer(); };
const roll = (input) => shift(input, dx), unroll = (input) => shift(input, W - dx);
const finalRolled = await roll(finalFile);
const cgRolled = noCg ? null : await roll(await sharp(cgFile).resize({ width: W, height: H, fit: 'fill' }).png().toBuffer());
const bandPx = Math.round((bandDeg / 360) * W), b0 = half - Math.floor(bandPx / 2), b1 = b0 + bandPx;
const mask = await sharp({ create: { width: W, height: H, channels: 3, background: '#000' } }).composite([{ input: { create: { width: bandPx, height: ROWS ? Math.round((ROWS[1] - ROWS[0]) * H) : H, channels: 3, background: '#fff' } }, left: b0, top: ROWS ? Math.round(ROWS[0] * H) : 0 }]).png().toBuffer();

// --- the seam step, openings-test.mjs's measure (8-px strips, rows 25–85 %, against neighbouring strips), at the skin's own join
const seamStep = async (buf) => { const { data: g, info } = await sharp(buf).greyscale().raw().toBuffer({ resolveWithObject: true }); const Wd = info.width, Hd = info.height, r0 = Math.floor(Hd * 0.25), r1 = Math.floor(Hd * 0.85), S = 8, xj = Math.round(seam.u * Wd) % Wd;
  const strip = (r, c0) => { let s = 0; for (let c = c0; c < c0 + S; c++) s += g[r * Wd + (((c % Wd) + Wd) % Wd)]; return s / S; };
  let wrap = 0, n = 0; for (let r = r0; r < r1; r += 2) { wrap += Math.abs(strip(r, xj) - strip(r, xj - S)); n++; }
  let base = 0, m = 0; for (let r = r0; r < r1; r += 8) for (let c = 64; c < Wd - 64; c += 97) { base += Math.abs(strip(r, c - S) - strip(r, c)); m++; }
  return { wrap: +(wrap / n).toFixed(2), base: +(base / m).toFixed(2) }; };
const before = await seamStep(fs.readFileSync(finalFile));
console.log(`${aptId}/${asset} (${roomEn}, ${cam.id}): ${W}x${H}, the skin's join at u ${seam.u} (x ${xs}, ${seam.from}); the seam step before ${before.wrap} (neighbours ${before.base}); band ${bandDeg}° = ${bandPx} px at ${b0}..${b1}`);

const prompt = `Image 1 is a 360-degree equirectangular photograph (2:1) of the ${roomEn} of a real apartment, rotated half a turn so that the picture's original left and right edges now meet along a vertical line at the centre; the white band of the mask covers that join. Repaint ONLY inside the band so that the floor, the walls, the ceiling and every object cross it continuously from the left side to the right side with no visible join: the same materials, the same light, the same furniture continued through the band. ${noCg ? 'Inside the band continue exactly what touches it on both sides (the same wall, counter, floor tiles and grout lines, ceiling, window frames or furniture) and add no new object.' : 'Image 2 is the plain computer render of the same room at the same rotation: inside the band it shows the true walls, openings, floor and furniture placeholders; follow its geometry and add no object the render does not show.'} Keep everything outside the band exactly as it is. No text, no people, no watermark.${flag('--ref') ? ` Image ${noCg ? 2 : 3} is the finished photograph of the same element seen from its own room in THIS apartment: inside the band copy its materials, fronts, worktop, splashback, shelves and appliances exactly (their positions come from ${noCg ? 'the picture itself' : 'Image 2'}); copy nothing else from it.` : ''}${flag('--extra') ? ' ' + flag('--extra') : ''}`;
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const refBuf = flag('--ref') ? await sharp(path.resolve(flag('--ref'))).png().toBuffer() : null;
const hash = sha(JSON.stringify({ e: ENDPOINT, ...(ROWS ? { rows: ROWS } : {}), ...(MODEL.key !== 'gpt25-high' ? { k: MODEL.key } : {}), p: prompt, f: sha(finalRolled), c: cgRolled ? sha(cgRolled) : null, m: sha(mask), ...(LITE ? { s: SIZE } : {}), ...(refBuf ? { r: sha(refBuf) } : {}) })).slice(0, 12);
// v2 (2026-11-05, R25): the composite cuts where the answer and the picture AGREE (no 24-px cross-fade of two different pictures:
// that ghosted shelves and counters at every band edge); the model's raw answer is the v1 one, so a v1 band re-composites at $0
const outFile = path.join(GEN, `${asset}__seam3__s7__${hash}.png`);
const ledger = fileLedger(path.join(APT, '_local', 'ledger.json'));
const rawFile = path.join(GEN, `${asset}__seam__s7__${hash}.raw.png`);

// R28 (a) (2026-11-06): after every --ref repair, the transplant guard: the repaired object's apparent width vs the same picture before the
// repair (tools/ref-scale-check.mjs --before <parent>), +-10 %; the verdict goes into the sidecar and band-lineage fails a --ref band without it
function refScale(file, cuts) {
  // a wrap-seam close (no --u) repairs the skin's own left/right join: the picture before it has its objects CUT at the join, so there the
  // guard measures against the final render instead (--ref-class loose|builtin, +-25 % / +-15 %); a --u band repair compares with the picture before it
  const against = flag('--u') != null ? ['--before', finalFile] : ['--class', flag('--ref-class') || 'loose'];
  const r = spawnSync(process.execPath, [path.join(HERE, 'ref-scale-check.mjs'), aptId, asset, '--picture', file, ...against, '--u0', String(cuts[0].u), '--u1', String(cuts[1].u), '--object', flag('--ref-object') || 'the largest piece of furniture or built-in element in the middle of the image', '--json'], { encoding: 'utf8', env: process.env });
  try { const j = JSON.parse(r.stdout.trim().split(/\r?\n/).pop()); console.log(`ref-scale (transplant guard): ${j.verdict} ${j.why}`); return { verdict: j.verdict, ratio: j.ratio, class: j.class, against: j.against, object: j.object, sheet: j.sheet }; }
  catch { console.error(`ref-scale-check failed: ${(r.stderr || '').slice(0, 200)}`); return { verdict: 'FAIL', why: 'the check did not run' }; }
}

// a model without a size control answers in its own aspect (nano-banana-2: 21:9): registered, not stretched (tools/register-answer.mjs)
let registration = null;
async function finish(answerPng) {
  // v3 (R25): tools/band_blend.py cuts where the STRUCTURE of answer and picture agrees best and pastes with a Laplacian-pyramid blend
  // (detail switches sharply at the cut, so no ghost; tone blends wide, so no step); the structure left at each cut is recorded
  // beside the picture (<out>.seam.json) and the gate fails a band edge it can see (fidelity.json band_edge)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'band-'));
  const tf = path.join(tmp, 'f.png'), ta = path.join(tmp, 'a.png'), to = path.join(tmp, 'o.png');
  fs.writeFileSync(tf, finalRolled);
  if (GPT) await sharp(answerPng).resize({ width: W, height: H, fit: 'fill' }).removeAlpha().png().toFile(ta);
  else { const rg = await registerAnswer(sharp, answerPng, finalRolled, { W, H, skipCols: [b0 - bandPx / 2 - 32, b1 + bandPx / 2 + 32] }); registration = { model: MODEL.key, ...rg.registration }; console.log(`registered the ${MODEL.key} answer: ${JSON.stringify(registration)}`); fs.writeFileSync(ta, rg.buf); }
  if (ROWS) {   // outside the rows the answer IS the picture (6-px linear ramps), so band_blend can only change the rows
    const A = await sharp(ta).removeAlpha().raw().toBuffer(), Pp = await sharp(finalRolled).removeAlpha().raw().toBuffer(), r0 = ROWS[0] * H, r1 = ROWS[1] * H;
    for (let y = 0; y < H; y++) { const a = Math.max(0, Math.min(1, (y - r0) / 6 + 0.5, (r1 - y) / 6 + 0.5)); if (a >= 1) continue; for (let x = 0; x < W * 3; x++) { const k = y * W * 3 + x; A[k] = Math.round(A[k] * a + Pp[k] * (1 - a)); } }
    await sharp(A, { raw: { width: W, height: H, channels: 3 } }).png().toFile(ta);
  }
  const py = process.env.HABAIT_PY || (fs.existsSync('C:/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe') ? 'C:/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe' : 'python');
  const r = spawnSync(py, ['-I', path.join(HERE, 'band_blend.py'), tf, ta, String(b0), String(b1), to], { encoding: 'utf8', env: { ...process.env, BAND_CUT_SEARCH: String(cutSearch), BAND_ALIGN_MAX: String(alignMax), BAND_ALIGN_AT: alignAt } });
  if (r.status !== 0) { console.error(`band_blend.py failed: ${r.stderr}`); process.exit(1); }
  const res = JSON.parse(r.stdout.trim().split(/\r?\n/).pop());
  const cutsCam = res.cuts.map((c) => ({ u: +((((c.x - dx) % W) + W) % W / W).toFixed(4), structure: c.structure, tone: c.tone, aligned_px: c.aligned_px, line_step_px: c.line_step_px, lines: c.lines }));
  const merged = await sharp(to).removeAlpha().png().toBuffer();
  fs.rmSync(tmp, { recursive: true, force: true });
  const unrolled = await unroll(merged);
  fs.writeFileSync(outFile, unrolled);
  fs.writeFileSync(outFile.replace(/\.png$/, '.seam.json'), JSON.stringify({ version: 3, blend: res.blend, parent: path.basename(finalFile), ...(registration ? { registration } : {}), band: { u: seam.u, deg: bandDeg, ...(ROWS ? { rows: ROWS } : {}) }, cut_search_px: cutSearch, align_max_px: alignMax, cuts: cutsCam, ...(refBuf ? { ref: path.basename(flag('--ref')), ref_scale: refScale(outFile, cutsCam) } : {}) }, null, 1));
  const after = await seamStep(unrolled);
  // the strip for the eye: the centre of the rolled picture before and after, side by side
  const cw = Math.floor(W * 0.22), ch = Math.floor(H * 0.6), top = Math.floor(H * 0.22);
  const sb = await sharp(finalRolled).extract({ left: half - Math.floor(cw / 2), top, width: cw, height: ch }).resize({ width: 700 }).toBuffer();
  const sa = await sharp(merged).extract({ left: half - Math.floor(cw / 2), top, width: cw, height: ch }).resize({ width: 700 }).toBuffer();
  const sbm = await sharp(sb).metadata();
  await sharp({ create: { width: 1420, height: sbm.height, channels: 3, background: '#222' } }).composite([{ input: sb, left: 0, top: 0 }, { input: sa, left: 720, top: 0 }]).jpeg({ quality: 86 }).toFile(outFile.replace(/\.png$/, '.strip.jpg'));
  console.log(`ok: ${path.relative(TOUR, outFile)} — the seam step ${before.wrap} → ${after.wrap} (neighbours ${after.base}); strip ${path.basename(outFile).replace(/\.png$/, '.strip.jpg')}`);
  if (pick) { picks[asset] = path.basename(outFile); fs.writeFileSync(picksFile, JSON.stringify(picks, null, 1)); console.log(`pick: ${asset} → ${path.basename(outFile)}`); }
  return after;
}

// --raw <file> (R25 re-composite): an earlier answer of THIS band is pasted onto the current picture with the v2 cut, $0, no call
if (flag('--raw')) { const rf = path.resolve(flag('--raw')); if (!fs.existsSync(rf)) { console.error(`--raw ${rf}: not found`); process.exit(2); } await finish(fs.readFileSync(rf)); process.exit(0); }
if (fs.existsSync(outFile)) { console.log(`cache hit ($0): ${path.relative(TOUR, outFile)}`); if (pick) { picks[asset] = path.basename(outFile); fs.writeFileSync(picksFile, JSON.stringify(picks, null, 1)); console.log(`pick: ${asset} → ${path.basename(outFile)}`); } process.exit(0); }
if (fs.existsSync(rawFile)) { await finish(fs.readFileSync(rawFile)); const d = ledger.load(); d.rows.forEach((x, i) => { if (x.inputs_hash === hash && x.status === 'reserved') ledger.settle(i, x.reserved_usd, { status: 'ok', out: path.relative(APT, outFile), note: 'finished locally from the saved raw answer' }); }); process.exit(0); }
const spent = ledger.total();
console.log(`close-seam via ${ENDPOINT} — booked $${USD.toFixed(2)}; ledger so far $${spent.toFixed(2)} (soft $${SOFT_USD}, hard $${HARD_USD})`);
if (spent + USD > HARD_USD) { console.error('close-seam: REFUSED — this call would cross the hard cap'); process.exit(3); }
if (spent + USD > SOFT_USD) console.warn('close-seam: WARNING — past the soft cap; Slava is told before the next call');
if (dry) { fs.mkdirSync(GEN, { recursive: true }); await sharp(mask).resize({ width: 960 }).png().toFile(path.join(GEN, `${asset}__seam__mask-preview.png`)); console.log('dry run: no call made; the mask preview written beside the answers'); process.exit(0); }

let env = loadEnv(HARNESS);
for (let dir = HARNESS, i = 0; !env.FAL_KEY && i < 5; i++) { dir = path.dirname(dir); env = loadEnv(dir); }
if (!env.FAL_KEY) { console.error('close-seam: FAL_KEY missing (read by name from the environment or a root .env)'); process.exit(1); }
const doc = ledger.load(); if (doc.cap_usd !== HARD_USD) { doc.cap_usd = HARD_USD; doc.soft_usd = SOFT_USD; ledger.save(doc); }
const row = ledger.reserve({ at: new Date().toISOString(), apartment: aptId, scene: `${asset}-seam`, model: ENDPOINT, model_key: MODEL.key, seed: 7, inputs_hash: hash, reserved_usd: USD, status: 'reserved' });
const uri = (b) => `data:image/png;base64,${b.toString('base64')}`;
let res, json;
try {
  res = await fetch(`https://fal.run/${ENDPOINT}`, {
    method: 'POST', headers: { Authorization: `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(GPT
      ? { prompt, image_urls: [uri(finalRolled), ...(cgRolled ? [uri(cgRolled)] : []), ...(refBuf ? [uri(refBuf)] : [])], mask_url: uri(mask), image_size: SIZE, quality: MODEL.key.replace('gpt25-', ''), num_images: 1, output_format: 'png', sync_mode: true }
      : MODEL.body(`${prompt} The LAST image is the mask: its white vertical band is the only area you may repaint; return the whole panorama at the same 2:1 framing.`, [finalRolled, ...(cgRolled ? [cgRolled] : []), ...(refBuf ? [refBuf] : []), mask])),
    signal: AbortSignal.timeout(300000),
  });
  json = await res.json().catch(() => ({}));
} catch (e) { ledger.settle(row, USD, { status: 'error-unknown-billing', note: String(e.message).slice(0, 160) }); console.error('close-seam: call failed before an answer; booked at the worst case:', String(e.message).slice(0, 160)); process.exit(1); }
if (!res.ok) { ledger.settle(row, 0, { status: `http-${res.status}`, note: JSON.stringify(json).slice(0, 200) }); console.error(`close-seam: HTTP ${res.status}`, JSON.stringify(json).slice(0, 300)); process.exit(1); }
const img = json.images?.[0];
if (!img?.url) { ledger.settle(row, USD, { status: 'billed-no-image', note: JSON.stringify(json).slice(0, 200) }); console.error('close-seam: no image in the answer'); process.exit(1); }
const bytes = img.url.startsWith('data:') ? Buffer.from(img.url.split(',')[1], 'base64') : Buffer.from(await (await fetch(img.url)).arrayBuffer());
fs.mkdirSync(GEN, { recursive: true });
fs.writeFileSync(rawFile, bytes);
ledger.settle(row, USD, { status: 'billed-raw-saved' });
const after = await finish(bytes);
ledger.settle(row, USD, { status: 'ok', out: path.relative(APT, outFile), width: W, height: H, note: `seam ${before.wrap} -> ${after.wrap}` });
console.log(`ledger now $${ledger.total().toFixed(2)}`);
