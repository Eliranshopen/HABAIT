#!/usr/bin/env node
/* Habait Tour360 — tools/sharpness-probe.mjs (T17a/T17b, TEST-PLAN.md C7–C9) — is the panorama the blur he saw? $0.
   The numbers: panorama pixels per CSS pixel and per device pixel at the page's fit field of view and at its deepest zoom (40°),
   for the balanced set (3548 px) and the 7K set (7096 px), on three device cells. The frames: the same region of the living room
   (the sofa) at both fields, from the real build and from a scratch copy of it whose living panorama is the 7K file, each cell;
   a Laplacian sharpness number per frame (the standard deviation of the 3×3 Laplacian over the centre crop; higher = crisper).
   Also the GPU's largest texture as headless Chrome reports it, and whether the 7K panorama painted at all.
   Usage (from the harness root, Git Bash):
     timeout 540 node Habait/tour360/tools/sharpness-probe.mjs demo-01 [--scene living --asset 01-living]
       [--full "D:/RealEstate3D/enhanced-panoramas/web/full/01-living.webp"] [--out qa-evidence/tour360/T17/sweeps/sharpness]
       [--look -18,-100]
   Nothing under dist/ or apartments/ is changed: the 7K variant is a scratch copy served from the temp folder. */
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadSharp } from './pano-geometry.mjs';
import { appRequire } from './app-require.mjs'; // a worktree has no Habait/MVP/app (board habait-walkaround T18)

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..', '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const argv = process.argv.slice(2);
const id = argv.find((a) => !a.startsWith('--') && !argv[argv.indexOf(a) - 1]?.startsWith('--')) || 'demo-01';
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const SCENE = arg('--scene', 'living'), ASSET = arg('--asset', '01-living');
const FULL = arg('--full', `D:/RealEstate3D/enhanced-panoramas/web/full/${ASSET}.webp`);
const OUT = path.resolve(arg('--out', path.join(REPO, 'qa-evidence', 'tour360', 'T17', 'sweeps', 'sharpness')));
const [LOOK_P, LOOK_Y] = String(arg('--look', '-18,-100')).split(',').map(Number);
const DIST = path.join(ROOT, 'dist', id);
if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.error('sharpness-probe: build first'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const sharp = loadSharp(REPO);
const { chromium } = appRequire(REPO)('playwright-core');

/* the page's own fit field (tour.js fitHfov): 75° vertical → horizontal by the aspect, clamped 50–105 */
const fitHfov = (w, h) => { const v = (75 * Math.PI) / 180; return Math.max(50, Math.min(105, (2 * Math.atan(Math.tan(v / 2) * (w / h)) * 180) / Math.PI)); };
const CELLS = [{ name: 'phone-390x844@2', w: 390, h: 844, dsf: 2, mobile: true }, { name: 'desktop-1440x900', w: 1440, h: 900, dsf: 1 }, { name: 'desktop-1920x1080', w: 1920, h: 1080, dsf: 1 }];
const SETS = [{ name: 'balanced', width: 3548 }, { name: 'full-7k', width: 7096 }];
const numbers = [];
for (const c of CELLS) for (const s of SETS) for (const [field, hfov] of [['fit', fitHfov(c.w, c.h)], ['zoom-40', 40]]) {
  const perCss = (s.width / 360) * hfov / c.w;
  numbers.push({ cell: c.name, set: s.name, field, hfov: Number(hfov.toFixed(1)), pano_px_per_css_px: Number(perCss.toFixed(3)), pano_px_per_device_px: Number((perCss / c.dsf).toFixed(3)), upsample: Number((c.dsf / perCss).toFixed(2)) });
}

/* the two static roots: the real build, and a scratch copy with the 7K living panorama */
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'tour360-sharp-'));
const variants = [{ name: 'balanced', dir: DIST }];
let fullOk = false;
if (fs.existsSync(FULL)) {
  const copy = path.join(SCRATCH, 'full');
  fs.cpSync(DIST, copy, { recursive: true });
  fs.copyFileSync(FULL, path.join(copy, 'panos', ASSET + '.webp'));
  variants.push({ name: 'full-7k', dir: copy }); fullOk = true;
} else console.log(`sharpness-probe: no 7K file at ${FULL} — the balanced frames only`);
const TYPES = { '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
const serve = (dir) => new Promise((resolve) => {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    const file = path.normalize(path.join(dir, p));
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  srv.listen(0, '127.0.0.1', () => resolve({ srv, base: `http://127.0.0.1:${srv.address().port}/` }));
});
/** The standard deviation of the 3×3 Laplacian over the centre crop of a frame — higher is crisper. */
async function laplacian(png, w, h, dsf) {
  const cw = Math.round(Math.min(480, w * 0.6) * dsf), ch = Math.round(Math.min(360, h * 0.45) * dsf);
  const left = Math.round((w * dsf - cw) / 2), top = Math.round((h * dsf - ch) / 2);
  const crop = sharp(png).extract({ left, top, width: cw, height: ch }).greyscale();
  const { data, info } = await crop.clone().convolve({ width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0] }).raw().toBuffer({ resolveWithObject: true });
  let s = 0, s2 = 0; const n = info.width * info.height;
  for (let i = 0; i < n; i++) { const v = data[i]; s += v; s2 += v * v; }
  const mean = s / n; return { lap_std: Number(Math.sqrt(Math.max(0, s2 / n - mean * mean)).toFixed(2)), crop: { left, top, width: cw, height: ch } };
}

const frames = [];
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--mute-audio'] });
try {
  for (const v of variants) {
    const { srv, base } = await serve(v.dir);
    try {
      for (const c of CELLS) {
        const ctx = await browser.newContext({ viewport: { width: c.w, height: c.h }, deviceScaleFactor: c.dsf, isMobile: Boolean(c.mobile), hasTouch: Boolean(c.mobile) });
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e).split('\n')[0])); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
        const t0 = Date.now();
        let ready = false;
        try {
          await page.goto(base + `?room=${SCENE}`, { waitUntil: 'load', timeout: 60000 });
          await page.waitForFunction(() => window.__tour && window.__tour.ready === true && window.__tour.viewer && window.__tour.viewer.isLoaded(), null, { timeout: 90000 });
          ready = true;
        } catch (e) { errors.push('not ready: ' + String(e.message).split('\n')[0]); }
        const readyMs = Date.now() - t0;
        const info = await page.evaluate(() => ({ maxTexture: window.__tour && window.__tour.maxTexture, errorShown: !document.getElementById('t-error').hidden, errorText: document.getElementById('t-error-text').textContent })).catch(() => ({}));
        for (const [field, hfov] of [['fit', fitHfov(c.w, c.h)], ['zoom-40', 40]]) {
          const name = `${v.name}-${c.name}-${field}.webp`;
          let lap = null;
          if (ready) {
            await page.evaluate(([p, y, h]) => window.__tour.viewer.lookAt(p, y, h, false), [LOOK_P, LOOK_Y, hfov]); await page.waitForTimeout(900);
            const png = await page.screenshot({ type: 'png' });
            lap = await laplacian(png, c.w, c.h, c.dsf);
            await sharp(png).webp({ lossless: true }).toFile(path.join(OUT, name));
            await sharp(png).extract(lap.crop).webp({ lossless: true }).toFile(path.join(OUT, name.replace('.webp', '-crop.webp')));
          }
          frames.push({ variant: v.name, cell: c.name, field, hfov: Number(hfov.toFixed(1)), ready, readyMs, maxTexture: info.maxTexture ?? null, errorShown: info.errorShown ?? null, lap_std: lap ? lap.lap_std : null, frame: ready ? name : null, errors: errors.slice(0, 3) });
          console.log(`${v.name.padEnd(9)} ${c.name.padEnd(18)} ${field.padEnd(8)} hfov ${hfov.toFixed(1).padStart(5)} · ready ${ready} ${readyMs} ms · maxTexture ${info.maxTexture} · lap_std ${lap ? lap.lap_std : '-'}${info.errorShown ? ' · ERROR OVERLAY: ' + info.errorText : ''}${errors.length ? ' · ' + errors[0] : ''}`);
        }
        await ctx.close();
      }
    } finally { srv.close(); }
  }
} finally { await browser.close(); fs.rmSync(SCRATCH, { recursive: true, force: true }); }

const md = [`# Sharpness probe — ${id} · ${SCENE} (${ASSET}) · ${new Date().toISOString()}`, '',
  '## The numbers (the page\'s fit field per cell; the deepest zoom is 40°)', '', '| Cell | Set | Field | hfov | pano px / CSS px | pano px / device px | upsample on screen |', '|---|---|---|---|---|---|---|',
  ...numbers.map((n) => `| ${n.cell} | ${n.set} | ${n.field} | ${n.hfov}° | ${n.pano_px_per_css_px} | ${n.pano_px_per_device_px} | ×${n.upsample} |`), '',
  `## The frames (the sofa at pitch ${LOOK_P}, yaw ${LOOK_Y}; the Laplacian std over the centre crop — higher is crisper)${fullOk ? '' : ' — the 7K file was not found, balanced only'}`, '', '| Variant | Cell | Field | hfov | ready | ms | maxTexture | lap_std | frame |', '|---|---|---|---|---|---|---|---|---|',
  ...frames.map((f) => `| ${f.variant} | ${f.cell} | ${f.field} | ${f.hfov}° | ${f.ready}${f.errorShown ? ' (error overlay)' : ''} | ${f.readyMs} | ${f.maxTexture} | ${f.lap_std ?? '-'} | ${f.frame ? '`' + f.frame + '`' : '-'} |`), '',
  'Headless Chrome paints with a software GL (SwiftShader); its texture limit is not a phone\'s — read `window.__tour.maxTexture` on the real device (TEST-PLAN C9).', ''].join('\n');
fs.writeFileSync(path.join(OUT, 'SHARPNESS.md'), md);
fs.writeFileSync(path.join(OUT, 'sharpness.json'), JSON.stringify({ apartment: id, scene: SCENE, asset: ASSET, full: fullOk ? FULL : null, look: [LOOK_P, LOOK_Y], numbers, frames, at: new Date().toISOString() }, null, 1) + '\n');
console.log(`sharpness-probe: ${frames.length} frames → ${path.relative(process.cwd(), OUT)}`);
