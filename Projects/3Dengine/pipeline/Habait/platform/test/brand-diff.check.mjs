#!/usr/bin/env node
/* The optimised brand SVG must render pixel-identical to Eliran's original (brand/habait-logo.svg vs brand/habait-logo-navy.svg), at
   1×, 4× and 10× in headless Chrome; plus a sheet of every variant and the favicon mark for the eye. $0.
   usage: node test/brand-diff.check.mjs --out <dir> */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BRAND = path.join(HERE, '..', 'brand');
const OUT = process.argv[process.argv.indexOf('--out') + 1];
fs.mkdirSync(OUT, { recursive: true });
const APP = process.env.HABAIT_APP_DIR || 'C:/RnD/Projects/Habait/tools/appdeps';
const req = createRequire(path.join(APP, 'package.json'));
const { chromium } = req('playwright-core'); const sharp = req('sharp');
const b = await chromium.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await (await b.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 })).newPage();
const src = (f) => 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(BRAND, f)).toString('base64');
const res = { at: new Date().toISOString(), scales: {}, fails: [] };
for (const k of [1, 4, 10]) {
  const w = Math.round(130.943 * k), h = Math.round(80.892 * k);
  const shot = async (f) => { await page.setContent(`<body style="margin:0;background:#fff"><img id="i" src="${src(f)}" style="display:block;width:${w}px;height:${h}px"></body>`);
    await page.waitForFunction(() => document.getElementById('i').complete); return page.screenshot({ clip: { x: 0, y: 0, width: w, height: h } }); };
  // Chrome's raster is not perfectly stable at 10× (the ORIGINAL against itself differs by ±1 on ~240 bytes on some runs), so each file is
  // rendered 3 times and the closest pair counts: identical = some render of the optimised file equals some render of the original, byte for byte
  const R = async (f) => { const out = []; for (let i = 0; i < 3; i++) out.push(await sharp(await shot(f)).raw().toBuffer()); return out; };
  const cmp = (X, Y) => { let n = 0; for (let i = 0; i < X.length; i++) if (X[i] !== Y[i]) n++; return n; };
  const As = await R('habait-logo.svg'), Bs = await R('habait-logo-navy.svg');
  const diff = Math.min(...As.flatMap((A) => Bs.map((B) => cmp(A, B))));
  const noise = Math.max(cmp(As[0], As[1]), cmp(As[0], As[2]));
  res.scales[k] = { w, h, bytesCompared: As[0].length, differing: diff, originalVsItselfNoise: noise };
  if (diff) res.fails.push(`${k}×: ${diff} differing bytes`);
  if (k === 4) { fs.writeFileSync(path.join(OUT, 'original-4x.png'), await shot('habait-logo.svg')); fs.writeFileSync(path.join(OUT, 'optimised-4x.png'), await shot('habait-logo-navy.svg')); }
}
// the eye sheet: every variant on its intended ground, and the mark at 16/32/64/180 px
const tiles = [['habait-logo-navy.svg', '#fff'], ['habait-logo-white.svg', '#051F6E'], ['habait-logo-sand.svg', '#0A1A28'], ['habait-wordmark-navy.svg', '#F4EFE7'],
  ['habait-wordmark-white.svg', '#0A1A28'], ['habait-wordmark-sand.svg', '#10283B']];
await page.setContent(`<body style="margin:0;padding:24px;background:#888;font:13px sans-serif;color:#fff;display:grid;grid-template-columns:repeat(3,420px);gap:16px">
  ${tiles.map(([f, bg]) => `<figure style="margin:0"><div style="background:${bg};padding:28px;display:grid;place-items:center;height:220px"><img src="${src(f)}" style="width:340px"></div><figcaption>${f} on ${bg}</figcaption></figure>`).join('')}
  <figure style="margin:0;grid-column:span 3"><div style="background:#fff;padding:20px;display:flex;gap:24px;align-items:end">${[16, 32, 64, 180].map((s) => `<img src="${src('habait-mark.svg')}" style="width:${s}px;height:${s}px">`).join('')}
  <img src="${src('habait-wordmark-navy-small.svg')}" style="height:28px"><img src="${src('habait-wordmark-navy-small.svg')}" style="height:24px"><span style="background:#0A1A28;padding:10px"><img src="${src('habait-wordmark-sand-small.svg')}" style="height:28px"></span></div><figcaption>favicon mark at 16 / 32 / 64 / 180 px · the wordmark at 28 and 24 px high</figcaption></figure></body>`);
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(OUT, 'variants.png'), fullPage: true });
await b.close();
res.pass = res.fails.length === 0;
fs.writeFileSync(path.join(OUT, 'brand-diff.json'), JSON.stringify(res, null, 1));
console.log(res.pass ? `PASS · pixel-identical at 1×/4×/10× · ${OUT}` : `FAIL · ${res.fails.join('; ')}`);
process.exit(res.pass ? 0 : 1);
