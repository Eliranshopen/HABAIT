#!/usr/bin/env node
/* Habait Tour360 — tools/ref-scale-check.mjs (2026-11-06, parity R28; the coordinator's order after fork F's finding).
   A band repair with --ref (close-seam.mjs: the element's own finished picture as the last image) can TRANSPLANT the reference's close-up
   into a small band: the object comes out at the wrong scale, and the depth gate still passes it (fork F: 0.19%). This check measures it.
   For one repaired band of one picture:
     1. the same perspective view is cut from the picture and from its OWN final render (apartment.json sets.original.cg_tour), centred on
        the band, wide enough to hold the band and what stands at its edges;
     2. ONE vision call (gemini-3.7-flash via the chat transport, ledgered before it runs, ~$0.01) boxes the named object in both
        ([ymin, xmin, ymax, xmax], 0-1000; the render shows the object as a placeholder block at the true scale);
     3. apparent width ratio = photo box width / render box width; PASS when within +-ref_scale.tolerance (fidelity.json, 10 %), or when
        the object is in neither view. Every run is a row in _local/fidelity/ref-scale.json and a sheet with both boxes drawn.
   close-seam.mjs runs this automatically after every --ref repair and writes the verdict into the picture's sidecar; band-lineage.mjs
   fails a --ref band without a PASS (R28).
   usage: node Habait/tour360/tools/ref-scale-check.mjs <apt> <asset> --picture <png> --u0 <u> --u1 <u> [--object "<name>"] [--json]
   FAL_KEY by name only. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { appRequire } from './app-require.mjs';
import { fileLedger, loadEnv } from './file-ledger.mjs';
import { loadPano, render } from './pano-geometry.mjs';
import { chatFetch } from '../server/chat-transport.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOUR = path.resolve(HERE, '..');
const REPO = path.resolve(TOUR, '..', '..');
const sharp = appRequire(REPO)('sharp');
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const VALUE = ['--picture', '--u0', '--u1', '--object', '--class', '--before'];
const [aptId, asset] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && VALUE.includes(args[i - 1])));
if (!aptId || !asset || !flag('--picture') || flag('--u0') == null || flag('--u1') == null) { console.error('usage: ref-scale-check.mjs <apt> <asset> --picture <png> --u0 <u> --u1 <u> [--object "<name>"]'); process.exit(2); }
const APT = path.join(TOUR, 'apartments', aptId);
const RULE = JSON.parse(fs.readFileSync(path.join(TOUR, 'fidelity.json'), 'utf8')).ref_scale || {};
// R28 (the coordinator's ruling 2026-11-06), three classes:
//   transplant (--before <the same picture before the --ref repair>): the object's width after the repair vs before it, +-10 % (fork F's hole)
//   builtin (kitchen run/column, wardrobes, vanities: plan-dimensioned) vs the final render: +-15 % (boxes ~10 % noisy; the 1 % gate covers geometry)
//   loose (sofa, bed, armchair, table) vs the final render: +-25 %, with the R27 judge beside it
const CLASS = flag('--before') ? 'transplant' : flag('--class', 'loose');
const TOL = Number((RULE.tolerances || {})[CLASS] ?? { transplant: 0.10, builtin: 0.15, loose: 0.25 }[CLASS]);
if (!Number.isFinite(TOL)) { console.error(`--class ${CLASS}: transplant|builtin|loose`); process.exit(2); }
const apt = JSON.parse(fs.readFileSync(path.join(APT, 'apartment.json'), 'utf8'));
const cgTour = apt.sets?.original?.cg_tour || aptId;
const scenes = JSON.parse(fs.readFileSync(path.join(APT, 'scenes.json'), 'utf8')).scenes;
const scene = scenes.find((s) => s.asset === asset);
const plan = JSON.parse(fs.readFileSync(path.join(APT, 'plan.general.json'), 'utf8'));
const cam = plan.camera_points.find((c) => c.id.toLowerCase() === `cp-${scene.id}`.toLowerCase());
const cgFile = path.join(REPO, '360walkaround', 'tours', cgTour, 'renders', cam.id, 'pano.webp');
const picture = path.resolve(flag('--picture'));
const object = flag('--object', 'the largest piece of furniture or built-in element in the middle of the image');

// the band in picture u (wrap-aware), the view centred on it
let u0 = Number(flag('--u0')), u1 = Number(flag('--u1'));
if (u1 < u0) u1 += 1;
const bandDeg = (u1 - u0) * 360, mid = ((u0 + u1) / 2) % 1;
const yaw = (mid - 0.5) * 360;
const hfov = Math.max(60, Math.min(120, bandDeg * 1.6 + 20));
const VW = 900, VH = 600;
const cut = async (file) => { const p = await loadPano(sharp, file); const buf = render(p, yaw, -10, hfov, VW, VH); return sharp(buf, { raw: { width: VW, height: VH, channels: 3 } }).jpeg({ quality: 88 }).toBuffer(); };
const photo = await cut(picture), rend = await cut(flag('--before') ? path.resolve(flag('--before')) : cgFile);

const env = loadEnv(REPO);
const MODEL = 'google/gemini-3.7-flash', EST = 0.01;
const h = crypto.createHash('sha256').update(Buffer.concat([photo, rend, Buffer.from(object)])).digest('hex').slice(0, 12);
const ledger = fileLedger(path.join(APT, '_local', 'ledger.json'));
const row = ledger.reserve({ ts: new Date().toISOString(), op: 'ref_scale_check', apartment: aptId, scene: asset, model: MODEL, inputs_hash: h, reserved_usd: EST, status: 'reserved' });
const SECOND = CLASS === 'transplant' ? 'the SAME photograph before a local repair, from exactly the same camera and field of view' : 'the plain computer render from exactly the same camera and field of view (its furniture are grey or wooden placeholder blocks at the TRUE size and place)';
const sys = 'You measure objects in two images of the SAME view: Image 1 is a photograph, Image 2 is ' + SECOND + '. Find the named object in each image and box it tightly. Return ONLY JSON: {"photo": {"found": true|false, "box": [ymin, xmin, ymax, xmax]}, "render": {"found": true|false, "box": [ymin, xmin, ymax, xmax]}, "note": "..."} with coordinates normalised to 0-1000. In the render box the placeholder that stands where the photo\'s object stands.';
const img = (b) => ({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + b.toString('base64') } });
let res, j;
try {
  res = await chatFetch(env)('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { Authorization: 'Bearer ' + (env.OPENROUTER_API_KEY || ''), 'Content-Type': 'application/json' }, body: JSON.stringify({ model: MODEL, temperature: 0, max_tokens: 4000, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: sys + ' Output ONLY the one JSON object: no prose, no markdown fences.' }, { role: 'user', content: [{ type: 'text', text: `The object: ${object}. Image 1 (photo):` }, img(photo), { type: 'text', text: CLASS === 'transplant' ? 'Image 2 (the same photo before the repair, same view):' : 'Image 2 (render, same view):' }, img(rend)] }] }), signal: AbortSignal.timeout(120000) });
  j = await res.json();
} catch (e) { ledger.settle(row, EST, { status: 'error-unknown-billing', note: String(e.message).slice(0, 120) }); throw e; }
ledger.settle(row, Number(j?.usage?.cost) || EST, { status: res.ok ? 'ok' : `http-${res.status}` });
const text = j?.choices?.[0]?.message?.content || '';
let a = null; try { const s = text.indexOf('{'), e = text.lastIndexOf('}'); a = JSON.parse(text.slice(s, e + 1)); } catch { a = null; }

let verdict, ratio = null, why = '';
if (!a) { verdict = 'FAIL'; why = 'the judge returned no JSON'; }
else if (!a.photo?.found && !a.render?.found) { verdict = 'PASS'; why = 'the object is in neither view'; }
else if (!a.photo?.found || !a.render?.found) { verdict = 'FAIL'; why = `the object is only in the ${a.photo?.found ? 'photo' : 'render'}`; }
else {
  const w = (b) => Math.max(1, Number(b[3]) - Number(b[1]));
  ratio = +(w(a.photo.box) / w(a.render.box)).toFixed(3);
  verdict = Math.round(Math.abs(ratio - 1) * 1000) <= Math.round(TOL * 1000) ? 'PASS' : 'FAIL';   // compared at the 3 decimals the ratio is reported with
  why = `apparent width ${ratio}x ${CLASS === 'transplant' ? 'the picture before the repair' : "the render's"} (${CLASS}, tolerance +-${Math.round(TOL * 100)}%)`;
}
// the sheet: both views with their boxes
const OUTD = path.join(APT, '_local', 'fidelity');
fs.mkdirSync(OUTD, { recursive: true });
const box = (b, col) => b ? `<rect x="${b[1] * VW / 1000}" y="${b[0] * VH / 1000}" width="${(b[3] - b[1]) * VW / 1000}" height="${(b[2] - b[0]) * VH / 1000}" fill="none" stroke="${col}" stroke-width="4"/>` : '';
const over = (b) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${VW}" height="${VH}">${box(b, verdict === 'PASS' ? '#3f3' : '#f33')}</svg>`);
const sheet = path.join(OUTD, `ref-scale__${asset}__${h}.jpg`);
await sharp({ create: { width: VW * 2 + 8, height: VH + 30, channels: 3, background: '#222' } }).composite([
  { input: await sharp(photo).composite([{ input: over(a?.photo?.found ? a.photo.box : null) }]).toBuffer(), left: 0, top: 30 },
  { input: await sharp(rend).composite([{ input: over(a?.render?.found ? a.render.box : null) }]).toBuffer(), left: VW + 8, top: 30 },
  { input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${VW * 2 + 8}" height="30"><text x="8" y="21" fill="#fff" font-size="16" font-family="Arial">${asset} · ${object.replace(/[<&>]/g, '')} · ${verdict}: ${why} · band u ${u0.toFixed(3)}-${(u1 % 1).toFixed(3)}</text></svg>`), left: 0, top: 0 },
]).jpeg({ quality: 84 }).toFile(sheet);
const out = { at: new Date().toISOString(), asset, picture: path.basename(picture), class: CLASS, against: flag('--before') ? path.basename(flag('--before')) : 'render', object, band: { u0, u1: u1 % 1, deg: +bandDeg.toFixed(1) }, cg_tour: cgTour, verdict, ratio, tolerance: TOL, why, judge: a, sheet: path.relative(APT, sheet) };
const log = path.join(OUTD, 'ref-scale.json');
const doc = fs.existsSync(log) ? JSON.parse(fs.readFileSync(log, 'utf8')) : { rows: [] };
doc.rows.push(out); fs.writeFileSync(log, JSON.stringify(doc, null, 1));
console.log(args.includes('--json') ? JSON.stringify(out) : `${asset} ref-scale ${verdict}: ${why} → ${path.relative(APT, sheet)}`);
process.exit(verdict === 'PASS' ? 0 : 1);
