#!/usr/bin/env node
/* Habait Tour360 - cg-lock-test.mjs (WALKAROUND-QUALITY-PLAN.md, D-WQ-36: the apartment exists once; the AI is a locked polish).
   Measures how well a skin TRACKS its CG render: the one scene every camera sees is the only thing that makes rooms agree
   with each other, so a skin that keeps the CG's edges keeps the apartment; a skin that invents edges invents an apartment.

   Per camera, eight perspective views (yaw 0,45,..315 at 70° across, pitch -8) are rendered from both equirects at the same
   size; on each, a Sobel edge map is thresholded (the strongest edges, by a fixed quantile of the CG's gradient) and:
     kept     = share of the CG's strong edge pixels that have a skin edge within `tol` px     (the lock: 1.0 = every line kept)
     invented = share of the skin's strong edge pixels with no CG edge within 2·tol px       (advisory: materials add edges)
   The CG's edges exclude the floor-grid region? No - the grid is drawn by the CG since v1.4 and must be kept too.
   A view PASSES when kept >= --min (default 0.70, calibrated 2026-10-29: the generative skins of the seven-room round score
   0.3-0.5 against their CG, the CG against itself 1.0; set the bar from a probe before it holds a deploy). A camera passes when
   every view passes; the tool exits 1 if any camera fails.

   Usage:
     node tools/cg-lock-test.mjs --cg <equirect> --skin <equirect> [--tol 3] [--min 0.70] [--out <dir>] [--label name]
     node tools/cg-lock-test.mjs --apt apt846 [--picks] ...   (every room of the apartment's picks.json against its CG render)
   Output: one line per view, one per camera, a JSON (`--out`) and a strip per camera (CG edges red, skin edges green, kept yellow). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appRequire } from './app-require.mjs';
import { render } from './pano-geometry.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..', '..');
const sharp = appRequire(REPO)('sharp');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const TOL = Number(opt('--tol', 3));
const MIN = Number(opt('--min', 0.70));
const VIEWS = [0, 45, 90, 135, 180, 225, 270, 315].map((yaw) => ({ yaw, pitch: -8, hfov: 70 }));
const VW = 960, VH = 640;
const QUANT = 0.94; // the strongest 6 % of gradient magnitudes are "edges" (of the CG; the skin uses the CG's threshold)
const BLANK_MIN_EDGES = Math.round(0.004 * 960 * 640); // under 0.4 % of a view's pixels as CG edges = sky or a blank wall: not judged
const OUT = opt('--out', null);
if (OUT) fs.mkdirSync(OUT, { recursive: true });

async function loadRGB(file) {
  const { data, info } = await sharp(file).resize({ width: 3840, height: 1920, fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, W: info.width, H: info.height };
}
function luma(rgb, w, h) { const L = new Float32Array(w * h); for (let i = 0, j = 0; i < L.length; i++, j += 3) L[i] = 0.299 * rgb[j] + 0.587 * rgb[j + 1] + 0.114 * rgb[j + 2]; return L; }
function sobel(L, w, h) {
  const G = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const gx = -L[i - w - 1] - 2 * L[i - 1] - L[i + w - 1] + L[i - w + 1] + 2 * L[i + 1] + L[i + w + 1];
    const gy = -L[i - w - 1] - 2 * L[i - w] - L[i - w + 1] + L[i + w - 1] + 2 * L[i + w] + L[i + w + 1];
    G[i] = Math.hypot(gx, gy);
  }
  return G;
}
function quantile(G, q) { const s = Float32Array.from(G).sort(); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; }
function dilate(B, w, h, r) {
  const D = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!B[y * w + x]) continue;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < h && xx >= 0 && xx < w) D[yy * w + xx] = 1; }
  }
  return D;
}
/** a 5-tap binomial blur, twice: texture (grain, fabric weave, grout) drops below the edge threshold, structure stays */
function soften(L, w, h) {
  const k = [1, 4, 6, 4, 1], T = new Float32Array(w * h), O = new Float32Array(w * h);
  for (let pass = 0; pass < 2; pass++) {
    const src = pass ? O : L;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let i = -2; i <= 2; i++) { const xx = Math.min(w - 1, Math.max(0, x + i)); s += k[i + 2] * src[y * w + xx]; } T[y * w + x] = s / 16; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let i = -2; i <= 2; i++) { const yy = Math.min(h - 1, Math.max(0, y + i)); s += k[i + 2] * T[yy * w + x]; } O[y * w + x] = s / 16; }
  }
  return O;
}
function compare(cgRGB, skRGB, w, h) {
  const gc = sobel(soften(luma(cgRGB, w, h), w, h), w, h), gs = sobel(soften(luma(skRGB, w, h), w, h), w, h);
  const th = Math.max(24, quantile(gc, QUANT)); // never below a visible step
  const Ec = new Uint8Array(w * h), Es = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) { Ec[i] = gc[i] >= th ? 1 : 0; Es[i] = gs[i] >= th ? 1 : 0; }
  const Ds = dilate(Es, w, h, TOL), Dc = dilate(Ec, w, h, 2 * TOL);
  let nc = 0, kept = 0, ns = 0, inv = 0;
  for (let i = 0; i < w * h; i++) { if (Ec[i]) { nc++; if (Ds[i]) kept++; } if (Es[i]) { ns++; if (!Dc[i]) inv++; } }
  return { kept: nc ? kept / nc : 1, invented: ns ? inv / ns : 0, cgEdges: nc, skinEdges: ns, Ec, Es, Ds };
}
async function strip(views, file) {
  const tiles = []; const w = VW / 2, h = VH / 2;
  for (let i = 0; i < views.length; i++) {
    const v = views[i]; const img = Buffer.alloc(VW * VH * 3);
    for (let p = 0; p < VW * VH; p++) { const o = p * 3; const c = v.cmp.Ec[p], s = v.cmp.Es[p]; img[o] = c ? 255 : 20; img[o + 1] = s ? 255 : 20; img[o + 2] = 20; if (c && v.cmp.Ds[p]) { img[o] = 255; img[o + 1] = 230; img[o + 2] = 60; } }
    tiles.push({ input: await sharp(img, { raw: { width: VW, height: VH, channels: 3 } }).resize(w, h).png().toBuffer(), left: (i % 4) * w, top: Math.floor(i / 4) * h });
  }
  await sharp({ create: { width: w * 4, height: h * Math.ceil(views.length / 4), channels: 3, background: '#000' } }).composite(tiles).jpeg({ quality: 80 }).toFile(file);
}
async function testPair(cgFile, skinFile, label) {
  const cg = await loadRGB(cgFile), sk = await loadRGB(skinFile);
  const views = [];
  for (const v of VIEWS) {
    const a = render(cg, v.yaw, v.pitch, v.hfov, VW, VH), b = render(sk, v.yaw, v.pitch, v.hfov, VW, VH);
    const cmp = compare(a, b, VW, VH);
    // a view of sky or a blank wall has too few CG edges to judge (the quantile threshold then sits on noise): BLANK, not a verdict
    const blank = cmp.cgEdges < BLANK_MIN_EDGES;
    views.push({ ...v, cmp, kept: +cmp.kept.toFixed(3), invented: +cmp.invented.toFixed(3), cgEdges: cmp.cgEdges, blank, pass: blank || cmp.kept >= MIN });
    console.log(`${label}  yaw ${String(v.yaw).padStart(3)}  kept ${cmp.kept.toFixed(3)}  invented ${cmp.invented.toFixed(3)}  edges ${cmp.cgEdges}  ${blank ? 'BLANK' : cmp.kept >= MIN ? 'PASS' : 'FAIL'}`);
  }
  const judged = views.filter((v) => !v.blank);
  const min = judged.length ? Math.min(...judged.map((v) => v.kept)) : 1, mean = judged.length ? judged.reduce((s, v) => s + v.kept, 0) / judged.length : 1;
  const pass = views.every((v) => v.pass);
  console.log(`${label}  camera: kept min ${min.toFixed(3)} mean ${mean.toFixed(3)}  ${pass ? 'PASS' : 'FAIL'}  (bar ${MIN}, tol ${TOL} px)`);
  if (OUT) await strip(views, path.join(OUT, `${label}-edges.jpg`));
  return { label, cg: cgFile, skin: skinFile, min: +min.toFixed(3), mean: +mean.toFixed(3), pass, views: views.map(({ cmp, ...r }) => r) };
}

const results = [];
if (opt('--apt')) {
  const apt = opt('--apt'); const A = path.join(ROOT, 'apartments', apt);
  const scenes = JSON.parse(fs.readFileSync(path.join(A, 'scenes.json'), 'utf8')).scenes;
  const picks = JSON.parse(fs.readFileSync(path.join(A, '_local', 'picks.json'), 'utf8'));
  const renders = opt('--renders', path.join(REPO, '360walkaround', 'tours', apt, 'renders'));
  for (const s of scenes) {
    const pick = picks[s.asset] && (picks[s.asset].file || picks[s.asset]);
    const cgFile = path.join(renders, `cp-${s.id}`, 'pano.webp');
    const skinFile = typeof pick === 'string' ? path.join(A, '_local', 'generated', pick) : null;
    if (!fs.existsSync(cgFile) || !skinFile || !fs.existsSync(skinFile)) { console.log(`${s.asset}  skipped (no CG render or no pick)`); continue; }
    results.push(await testPair(cgFile, skinFile, s.asset));
  }
} else if (opt('--cg') && opt('--skin')) {
  results.push(await testPair(opt('--cg'), opt('--skin'), opt('--label', 'pair')));
} else { console.error('usage: cg-lock-test.mjs --cg <pano> --skin <pano> | --apt <id> [--renders dir] [--tol 3] [--min 0.7] [--out dir]'); process.exit(2); }
if (OUT) fs.writeFileSync(path.join(OUT, 'cg-lock-test.json'), JSON.stringify({ at: new Date().toISOString(), tol: TOL, min: MIN, views: VIEWS, results }, null, 1));
const failed = results.filter((r) => !r.pass).length;
console.log(`${results.length - failed}/${results.length} cameras PASS`);
process.exit(failed ? 1 : 0);
