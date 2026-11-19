// Step 19 - RAINBOW's features in the 3D walk, in a real browser (headless Chrome, WebGL) at 1440x900 and 390x844:
// rings on the pieces, the piece sheet (colour, remove/bring back), undo, floor finish, light, compare (hold), plan with
// you-are-here, measure; with --paid one free-text request through the local server (≈ $0.003, ledgered by the server).
// Usage: node scripts/19_features_check.mjs <base url of scripts/17_walk_server.mjs> <out dir> [--paid]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json');
const { chromium } = require('playwright-core');

const [base, outDir] = process.argv.slice(2);
const PAID = process.argv.includes('--paid');
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-angle=d3d11', '--enable-webgl', '--ignore-gpu-blocklist'] });
const report = { base, at: new Date().toISOString(), paid: PAID, sizes: {} };
const shot = async (page, r, name) => { await page.screenshot({ path: path.join(outDir, name + '.png') }); r.shots.push(name + '.png'); };
for (const [name, vp, mobile] of [['desktop-1440', { width: 1440, height: 900 }, false], ['phone-390', { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  const errors = [], failed = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/404 \(Not Found\)/.test(m.text())) errors.push(m.text()); });
  page.on('response', (x) => { if (x.status() >= 400 && !x.url().endsWith('/daynight.json')) failed.push(`${x.status()} ${x.url()}`); });
  await page.goto(`${base}/walkaround/`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__items && window.__items.live.size >= window.__items.REG.items.length && [...window.__items.live.values()].every((p) => p.model), null, { timeout: 180000 });
  const r = { errors, failed, shots: [], checks: {} };
  const C = r.checks;
  // stand in the living room facing the sofa and the chair
  await page.evaluate(() => { const w = window.__walk; const [u, v] = w.grid.views.living; w.me.x = u / 100; w.me.z = v / 100; w.setYaw(159); w.me.pitch = -0.12; });
  await page.waitForTimeout(900);
  C.pieces = await page.evaluate(() => window.__items.live.size);
  C.rings_visible = await page.evaluate(() => [...document.querySelectorAll('.w-ring')].filter((e) => e.style.display !== 'none').length);
  await shot(page, r, `${name}-rings`);
  // the sofa's sheet
  const ring = await page.evaluate(() => { const p = window.__items.live.get('sofa_modular'); return p && p.ring.style.display !== 'none'; });
  C.sofa_ring_visible = ring;
  await page.evaluate(() => window.__items.live.get('sofa_modular').ring.click());
  await page.waitForTimeout(400);
  C.sheet_open = await page.evaluate(() => !!document.getElementById('swap'));
  await shot(page, r, `${name}-sheet`);
  await page.evaluate(() => document.querySelector('#swap .w-sw').click());   // the first swatch
  await page.waitForTimeout(500);
  C.colour_applied = await page.evaluate(() => window.__items.live.get('sofa_modular').color);
  C.undo_enabled = await page.evaluate(() => window.__items.undo.length > 0);
  await page.evaluate(() => document.querySelector('#swap .w-icon').click());
  await shot(page, r, `${name}-colour`);
  // compare (hold) shows the original, release brings the change back
  await page.evaluate(() => document.getElementById('b-compare').dispatchEvent(new PointerEvent('pointerdown')));
  await page.waitForTimeout(600);
  C.compare_shows_original = await page.evaluate(() => window.__items.live.get('sofa_modular').color === null);
  await page.evaluate(() => document.getElementById('b-compare').dispatchEvent(new PointerEvent('pointerup')));
  await page.waitForTimeout(600);
  C.compare_restores = await page.evaluate(() => window.__items.live.get('sofa_modular').color !== null);
  // undo
  await page.evaluate(() => document.getElementById('b-undo').click());
  await page.waitForTimeout(500);
  C.undo_restores = await page.evaluate(() => window.__items.live.get('sofa_modular').color === null);
  // remove and bring back
  await page.evaluate(() => window.__items.run([{ op: 'remove', item: 'lounge_chair' }], 'test'));
  C.remove_hides = await page.evaluate(() => !window.__items.live.get('lounge_chair').group.visible);
  await page.evaluate(() => window.__items.run([{ op: 'show', item: 'lounge_chair' }], 'test'));
  C.show_returns = await page.evaluate(() => window.__items.live.get('lounge_chair').group.visible);
  // floor finish
  C.finishes = await page.evaluate(() => window.__items.REG.finishes.map((f) => f.id));
  if (C.finishes.includes('parquet')) {
    await page.evaluate(() => window.__items.run([{ op: 'finish', to: 'parquet' }], 'test'));
    await page.waitForTimeout(800);
    C.finish_parquet = await page.evaluate(() => window.__items.state.finish === 'parquet');
    await shot(page, r, `${name}-parquet`);
    await page.evaluate(() => window.__items.run([{ op: 'finish', to: 'stone' }], 'test'));
  }
  // light
  await page.evaluate(() => window.__items.run([{ op: 'light', warmth: 3000, level: 0.92 }], 'test'));
  await page.waitForTimeout(300);
  C.light_warm = await page.evaluate(() => window.__items.state.light.warmth === 3000);
  await shot(page, r, `${name}-warm`);
  // reset
  await page.evaluate(() => document.getElementById('b-reset').click());
  await page.waitForTimeout(1200);
  C.reset_empty = await page.evaluate(() => window.__items.undo.length === 0 && window.__items.state.light.warmth === 4000);
  // plan with you-are-here
  C.plan_map = await page.evaluate(() => { const c = document.querySelector('#map canvas'); return !!(c && c.width > 0); });
  // measure: two taps on the floor
  await page.evaluate(() => document.getElementById('b-measure').click());
  const tap = async (x, y) => { if (mobile) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); await page.waitForTimeout(250); };
  await page.evaluate(() => document.getElementById("rings").classList.add("hidden"));   // taps measure the floor, not a ring
  await tap(vp.width * 0.3, vp.height * 0.6); await tap(vp.width * 0.7, vp.height * 0.62);
  C.measure_label = await page.evaluate(() => document.getElementById('mlabel')?.textContent || null);
  await shot(page, r, `${name}-measure`);
  await page.evaluate(() => document.getElementById('b-measure').click());
  // the free-text line (paid only with --paid, desktop only: one call)
  if (PAID && !mobile) {
    await page.evaluate(() => document.getElementById('b-design').click());
    await page.fill('#i-type', 'תצבע את הספה בירוק זית');
    await page.click('#b-type');
    await page.waitForFunction(() => !document.getElementById('b-type').disabled, null, { timeout: 60000 });
    await page.waitForTimeout(800);
    C.text_colour = await page.evaluate(() => window.__items.live.get('sofa_modular').color);
    C.text_say = await page.evaluate(() => document.getElementById('say')?.textContent || null);
    await shot(page, r, `${name}-text`);
  }
  r.overflow = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => { const b = e.getBoundingClientRect(); return b.width && (b.right > innerWidth + 1 || b.left < -1) && getComputedStyle(e).position !== 'fixed' && !e.closest('nav') && !e.closest('#rings') && !e.closest('.w-strip'); }).length);
  report.sizes[name] = r;
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(outDir, 'features-check.json'), JSON.stringify(report, null, 1));
const must = ['sheet_open', 'colour_applied', 'undo_enabled', 'compare_shows_original', 'compare_restores', 'undo_restores', 'remove_hides', 'show_returns', 'light_warm', 'reset_empty', 'plan_map', 'measure_label'];
const bad = Object.values(report.sizes).some((r) => r.errors.length || r.failed.length || r.overflow || must.some((k) => !r.checks[k]) || r.checks.rings_visible < 1 || (r.checks.finishes.includes('parquet') && !r.checks.finish_parquet));
console.log(JSON.stringify(report, null, 1));
console.log(bad ? 'FEATURES CHECK FAIL' : 'FEATURES CHECK PASS');
process.exit(bad ? 1 : 0);
