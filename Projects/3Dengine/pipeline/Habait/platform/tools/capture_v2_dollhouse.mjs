#!/usr/bin/env node
// Rainbow v2 (plan development/plans/2026-11-09-rainbow-v2.md): a still of the live apartment dollhouse for the v2 cutaway stage. $0.
// Opens <dollhouse.html> (the tour's own offline 3D page) in headless Chrome at 1600x1000 @1.5x, preset 3d, stops the auto-rotate
// at its first pose (a pointer press on an empty corner, which is what a buyer's touch does), hides the page's UI, room labels and
// background, screenshots with alpha, trims the transparent border and writes a WebP. Called by tools/make_v2_media.py (manifest row there).
// usage: node tools/capture_v2_dollhouse.mjs <dollhouse.html> <out.webp>
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const [, , html, out] = process.argv;
if (!html || !out) { console.error('usage: capture_v2_dollhouse.mjs <dollhouse.html> <out.webp>'); process.exit(2); }
const APP = process.env.HABAIT_APP_DIR || 'C:/RnD/Projects/Habait/tools/appdeps';
const req = createRequire(APP + '/package.json');
const { chromium } = req('playwright-core');
const sharp = req('sharp');
const b = await chromium.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
try {
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1.5 });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(pathToFileURL(html).href + '#preset=3d', { waitUntil: 'load', timeout: 120000 });
  await p.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 120000 });
  await p.addStyleTag({ content: '.top,.cap,#ui,.dh-labels,.dh-presets,.dh-sheet{display:none!important} html,body{background:transparent!important}' });
  await p.mouse.move(8, 500); await p.mouse.down(); await p.mouse.up();             // empty canvas: stops the auto-rotate (OrbitControls 'start')
  await p.waitForTimeout(1200);
  if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
  const png = await p.screenshot({ omitBackground: true });
  await sharp(png).trim({ threshold: 1 }).webp({ quality: 86, alphaQuality: 90, effort: 6 }).toFile(out);
  console.log('dollhouse still:', out);
} finally { await b.close(); }
