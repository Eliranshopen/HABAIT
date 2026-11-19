#!/usr/bin/env node
/* Screenshots of the landing page's motion (round 9: the rainbowtlv.com feel — fade-ups, the picture wipes, the parallax bands) at
   390×844 and 1440×900: the hero, then each section mid-animation and at rest, plus the reduced-motion page (static, every word visible).
   Also asserts: the motion layer is on (html.rl-motion), Lenis runs on desktop only, nothing is pinned (round 9 has no pins), no page
   error, no horizontal overflow at any stop, the vendor JS stays under 80 KB gz.
   usage: node test/landing-motion.shots.mjs <stage> --out <dir>      $0 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const stage = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--out');
const OUT = argv[argv.indexOf('--out') + 1];
if (!stage || argv.indexOf('--out') < 0) { console.error('usage: landing-motion.shots.mjs <stage> --out <dir>'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const APP = process.env.HABAIT_APP_DIR || 'C:/RnD/Projects/Habait/tools/appdeps';
const { chromium } = createRequire(path.join(APP, 'package.json'))('playwright-core');
const { serveStatic } = await import(pathToFileURL(path.join(HERE, '..', '..', 'tools', 'qa', 'responsive-gate.mjs')).href);
const rw = fs.existsSync(path.join(stage, 'vercel.json')) ? JSON.parse(fs.readFileSync(path.join(stage, 'vercel.json'), 'utf8')).rewrites : null;
const srv = serveStatic(path.resolve(stage), rw); await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--autoplay-policy=no-user-gesture-required'] });
const SIZES = [{ name: '1440', viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
  { name: '390', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }];
const res = { at: new Date().toISOString(), base, sizes: {}, fails: [] };
const fail = (s, m) => { res.fails.push(`${s}: ${m}`); console.log(`  FAIL ${s}: ${m}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const gz = ['gsap-3.13.0.min.js', 'ScrollTrigger-3.13.0.min.js', 'CustomEase-3.13.0.min.js', 'lenis-1.3.4.min.js'].reduce((n, f) => n + zlib.gzipSync(fs.readFileSync(path.join(stage, 'js', 'vendor', f)), { level: 9 }).length, 0);
res.vendorGzBytes = gz; if (gz > 80 * 1024) fail('all', `vendor JS ${gz} B gz > 80 KB`);

// scroll to a point: an element's top, or a fraction through the ScrollTrigger whose trigger is that element
async function go(page, sel, frac = null) {
  await page.evaluate(({ sel, frac }) => {
    let y;
    const st = frac !== null && window.ScrollTrigger && window.ScrollTrigger.getAll().find((t) => t.trigger && t.trigger.matches(sel) && t.pin);
    if (st) y = st.start + (st.end - st.start) * frac;
    else { const el = document.querySelector(sel); y = el.getBoundingClientRect().top + scrollY + (frac || 0) * el.offsetHeight - (frac === null ? 0 : innerHeight * 0.3); }
    if (window.__rlLenis) window.__rlLenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y);
  }, { sel, frac });
  await sleep(1400);
}
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);

for (const S of SIZES) {
  const R = res.sizes[S.name] = { shots: [] }; console.log(`== ${S.name}`);
  const ctx = await browser.newContext({ ...S }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__rl && window.__rl.video.currentTime > 1, null, { timeout: 20000 }).catch(() => {});
  await sleep(800);
  R.state = await page.evaluate(() => ({ motion: document.documentElement.classList.contains('rl-motion'), desk: document.documentElement.classList.contains('rl-desk'),
    lenis: Boolean(window.__rlLenis), triggers: window.ScrollTrigger ? window.ScrollTrigger.getAll().length : 0,
    pins: window.ScrollTrigger ? window.ScrollTrigger.getAll().filter((t) => t.pin).length : 0 }));
  if (!R.state.motion) fail(S.name, 'the motion layer did not start');
  if (S.name === '1440' && (!R.state.lenis || R.state.pins)) fail(S.name, 'desktop: Lenis missing or a pin is active ' + JSON.stringify(R.state));
  if (S.name === '390' && (R.state.lenis || R.state.pins)) fail(S.name, 'phone: Lenis or a pin is active ' + JSON.stringify(R.state));
  const stops = [['m01-hero', '#hero', null], ['m02-statement', '#statement', 0.2], ['m03-band-the2', '[data-band]', 0.3],
    ['m04-location', '#place', 0.1], ['m05-architecture', '#arch', 0.1], ['m06-band-the6', '#arch [data-band]', 0.3], ['m07-experience-head', '#experience', 0.05],
    ['m08-step-1', '.rl-step[data-step="0"]', 0.2], ['m09-step-2', '.rl-step[data-step="1"]', 0.2], ['m10-step-4', '.rl-step[data-step="3"]', 0.2],
    ['m11-close', '.rl-close', 0.1], ['m12-footer', '.rl-foot', 0]];
  for (const [name, sel, frac] of stops) {
    await go(page, sel, frac);
    await page.screenshot({ path: path.join(OUT, `${name}-${S.name}.png`) });
    if (await overflow(page)) fail(S.name, `horizontal overflow at ${name}`);
    R.shots.push(name);
  }
  R.errors = errors; if (errors.length) fail(S.name, 'page errors: ' + errors.join(' | '));
  await ctx.close();
  // reduced motion: the static page, every word visible
  const c2 = await browser.newContext({ ...S, reducedMotion: 'reduce' }); const p2 = await c2.newPage();
  await p2.goto(base + '/', { waitUntil: 'load' }); await sleep(1500);
  R.reduced = await p2.evaluate(() => ({ motion: document.documentElement.classList.contains('rl-motion'), split: document.querySelectorAll('.rl-split, .rl-line, .rl-word-u').length,
    hidden: [...document.querySelectorAll('main h2, main h3, main p, main li')].filter((e) => { const cs = getComputedStyle(e); return cs.opacity === '0' || cs.visibility === 'hidden'; }).length }));
  if (R.reduced.motion || R.reduced.split || R.reduced.hidden) fail(S.name, 'reduced motion is not the static page ' + JSON.stringify(R.reduced));
  await p2.screenshot({ path: path.join(OUT, `m00-reduced-full-${S.name}.png`), fullPage: true });
  await c2.close();
}
await browser.close(); srv.close();
res.pass = res.fails.length === 0;
fs.writeFileSync(path.join(OUT, 'motion.json'), JSON.stringify(res, null, 1));
console.log(res.pass ? `PASS · ${OUT}` : `FAIL · ${res.fails.length} · ${OUT}`);
process.exit(res.pass ? 0 : 1);
