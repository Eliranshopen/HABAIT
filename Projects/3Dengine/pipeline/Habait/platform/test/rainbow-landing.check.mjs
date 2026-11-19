#!/usr/bin/env node
/* The Rainbow landing page check (plan development/plans/2026-11-08-rainbow-landing.md). Headless Chrome on a STAGE folder (stage_flow.py
   output), served with its vercel.json rewrites (tools/qa/responsive-gate.mjs serveStatic). At 1440×900 and 390×844 it asserts:
   the poster paints first (video blocked), the film plays (currentTime advances), the pause button stops it, reduced motion does not
   autoplay, no page error / console error / 4xx outside /api, no horizontal overflow on either side, every property picture carries a
   visible badge, every route resolves (HTTP 200) and the hero CTA really opens the hold, the LCP element is the poster, CLS < 0.05,
   EN flips to LTR. Screenshots + result.json into --out. $0.
   usage: node test/rainbow-landing.check.mjs <stage dir> --out <dir>      (exit 0 = PASS, 1 = FAIL) */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const stage = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--out');
const OUT = argv[argv.indexOf('--out') + 1];
if (!stage || !OUT || argv.indexOf('--out') < 0) { console.error('usage: rainbow-landing.check.mjs <stage> --out <dir>'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const APP = process.env.HABAIT_APP_DIR || 'C:/RnD/Projects/Habait/tools/appdeps';
const { chromium } = createRequire(path.join(APP, 'package.json'))('playwright-core');
const { serveStatic } = await import(pathToFileURL(path.join(HERE, '..', '..', 'tools', 'qa', 'responsive-gate.mjs')).href);
const rw = fs.existsSync(path.join(stage, 'vercel.json')) ? JSON.parse(fs.readFileSync(path.join(stage, 'vercel.json'), 'utf8')).rewrites : null;
const srv = serveStatic(path.resolve(stage), rw); await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--autoplay-policy=no-user-gesture-required'] });
const SIZES = [{ name: '1440', viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
  { name: '390', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }];
const result = { at: new Date().toISOString(), base, stage: path.resolve(stage), sizes: {}, fails: [] };
const fail = (size, msg) => { result.fails.push(`${size}: ${msg}`); console.log(`  FAIL ${size}: ${msg}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function watch(page, bag) {
  page.on('pageerror', (e) => bag.errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') bag.errors.push('console: ' + m.text()); });
  page.on('response', (r) => { const u = new URL(r.url()); if (r.status() >= 400 && !u.pathname.startsWith('/api/')) bag.http.push(`${r.status()} ${u.pathname}`); });
}
const overflow = (page) => page.evaluate(() => {
  const W = innerWidth, out = [];
  const doc = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (r.left < -1 || r.right > W + 1) {
      let clipped = false; for (let a = el.parentElement; a; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o === 'hidden' || o === 'clip') { const ar = a.getBoundingClientRect(); if (ar.left >= -1 && ar.right <= W + 1) { clipped = true; break; } } }
      if (!clipped) out.push(`${el.tagName.toLowerCase()}.${el.className}`.slice(0, 80) + ` [${Math.round(r.left)},${Math.round(r.right)}]`);
    }
  }
  return { doc, els: out.slice(0, 10) };
});
const badges = (page) => page.evaluate(() => {
  const rows = [];
  const hosts = [document.querySelector('.rl-hero'), ...document.querySelectorAll('.rl-fig, .rl-card__media')];
  for (const h of hosts) {
    // round 7: a host that is not shown at this size (the sticky frame's hidden layers, the per-step pictures on desktop) is not checked
    { const hr0 = h.getBoundingClientRect(); if (!hr0.width || !hr0.height || getComputedStyle(h).opacity === '0') continue; }
    const b = h.querySelector('.hb-ai-badge'); const img = h.querySelector('img');
    const r = b && b.getBoundingClientRect(); const hr = h.getBoundingClientRect(); const cs = b && getComputedStyle(b);
    const ok = Boolean(b && r.width > 20 && r.height > 12 && cs.visibility !== 'hidden' && cs.opacity !== '0' && r.left >= hr.left - 1 && r.right <= hr.right + 1 && r.top >= hr.top - 1 && r.bottom <= hr.bottom + 1);
    rows.push({ img: img ? img.getAttribute('src') : null, kind: b ? b.dataset.badge : null, text: b ? b.textContent.trim() : null, ok });
  }
  return rows;
});

for (const S of SIZES) {
  const R = result.sizes[S.name] = {};
  console.log(`== ${S.name}`);
  // (1) first paint: the film blocked, so what shows is the poster alone (= what a visitor sees before the film arrives)
  {
    const ctx = await browser.newContext({ ...S }); const page = await ctx.newPage(); const bag = { errors: [], http: [] }; watch(page, bag);
    await page.route(/\.mp4(\?|$)/, (r) => r.abort());
    await page.goto(base + '/', { waitUntil: 'load' }); await sleep(1200);
    R.poster = await page.evaluate(() => { const i = document.getElementById('heroPoster'); return { complete: i.complete, w: i.naturalWidth, src: i.currentSrc.split('/').pop(), videoOpacity: getComputedStyle(document.getElementById('heroVideo')).opacity }; });
    if (!R.poster.complete || !R.poster.w) fail(S.name, 'poster did not paint');
    await page.screenshot({ path: path.join(OUT, `01-first-paint-poster-${S.name}.png`) });
    await ctx.close();
  }
  // (2) the normal visit
  const ctx = await browser.newContext({ ...S }); const page = await ctx.newPage(); const bag = { errors: [], http: [] }; watch(page, bag);
  await page.addInitScript(() => {
    window.__lcp = []; window.__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp.push({ t: Math.round(e.startTime), el: e.element ? (e.element.id || e.element.tagName) : null, url: (e.url || '').split('/').pop(), size: e.size }); }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto(base + '/', { waitUntil: 'load' });
  try { await page.waitForFunction(() => window.__rl && window.__rl.video.currentTime > 1.0, null, { timeout: 20000 }); } catch { fail(S.name, 'the film did not start within 20 s'); }
  const t1 = await page.evaluate(() => window.__rl.video.currentTime); await sleep(1500); const t2 = await page.evaluate(() => window.__rl.video.currentTime);
  R.video = await page.evaluate(() => { const v = window.__rl.video; return { src: v.currentSrc.split('/').pop(), paused: v.paused, muted: v.muted, loop: v.loop, playsinline: v.playsInline, preload: v.preload, w: v.videoWidth, h: v.videoHeight, dur: v.duration, playingClass: document.getElementById('hero').classList.contains('is-playing'), button: document.getElementById('heroToggle').dataset.state, label: document.getElementById('heroToggle').getAttribute('aria-label') }; });
  R.video.t1 = t1; R.video.t2 = t2;
  if (!(t2 > t1 + 0.8)) fail(S.name, `currentTime did not advance (${t1} → ${t2})`);
  if (S.name === '390' && !/portrait/.test(R.video.src)) fail(S.name, 'phone did not get the portrait film');
  if (S.name === '1440' && !/1080/.test(R.video.src)) fail(S.name, 'desktop did not get the 1080p film');
  await page.screenshot({ path: path.join(OUT, `02-film-playing-${S.name}.png`) });
  // pause button (WCAG 2.2.2)
  await page.click('#heroToggle'); await sleep(300);
  const p1 = await page.evaluate(() => window.__rl.video.currentTime); await sleep(800); const p2 = await page.evaluate(() => window.__rl.video.currentTime);
  R.pause = { paused: await page.evaluate(() => window.__rl.video.paused), t: [p1, p2], label: await page.getAttribute('#heroToggle', 'aria-label') };
  if (!R.pause.paused || p2 !== p1) fail(S.name, 'pause button did not stop the film');
  await page.screenshot({ path: path.join(OUT, `03-film-paused-${S.name}.png`) });
  await page.click('#heroToggle'); await sleep(600);
  R.resume = await page.evaluate(() => !window.__rl.video.paused);
  if (!R.resume) fail(S.name, 'play button did not resume');
  R.lcp = await page.evaluate(() => window.__lcp); R.cls = await page.evaluate(() => window.__cls);
  const last = R.lcp[R.lcp.length - 1];
  // the LCP must be the poster or the hero text (Chrome may skip a viewport-filling image as background), never the film, and fast
  if (!last || /\.mp4/.test(last.url) || last.el === 'heroVideo' || last.t > 2500) fail(S.name, `LCP: ${JSON.stringify(last)}`);
  if (R.cls > 0.05) fail(S.name, `CLS ${R.cls}`);
  // sections: scroll through (lazy images load), screenshot each, then the full page
  for (const [id, name] of [['place', '04-location'], ['arch', '05-architecture'], ['experience', '06-experience']]) {
    await page.evaluate((i) => document.getElementById(i).scrollIntoView({ block: 'start' }), id); await sleep(1300);
    await page.screenshot({ path: path.join(OUT, `${name}-${S.name}.png`) });
  }
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await sleep(1500);
  await page.screenshot({ path: path.join(OUT, `08-close-footer-${S.name}.png`) });
  R.videoPausedOffscreen = await page.evaluate(() => window.__rl.video.paused);
  if (!R.videoPausedOffscreen) fail(S.name, 'film keeps playing off-screen');
  R.headerSolid = await page.evaluate(() => document.getElementById('top').classList.contains('is-solid'));
  await page.evaluate(() => scrollTo(0, 0)); await sleep(1800);
  R.videoResumed = await page.evaluate(() => !window.__rl.video.paused);
  await page.screenshot({ path: path.join(OUT, `09-full-page-${S.name}.png`), fullPage: true });
  R.overflow = await overflow(page);
  if (R.overflow.doc || R.overflow.els.length) fail(S.name, 'horizontal overflow ' + JSON.stringify(R.overflow));
  R.badges = await badges(page);
  for (const b of R.badges) if (!b.ok) fail(S.name, `badge missing/hidden on ${b.img}`);
  R.targets = await page.evaluate(() => [...document.querySelectorAll('a[href], button')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.height && getComputedStyle(e).visibility !== 'hidden' && !e.classList.contains('rl-skip'); })
    .map((e) => { const r = e.getBoundingClientRect(); return { el: (e.id || e.className || e.tagName).toString().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) }; }).filter((x) => x.w < 44 || x.h < 44));
  for (const t of R.targets) fail(S.name, `target < 44 px: ${JSON.stringify(t)}`);
  // routes: every [data-route] link answers 200, and the hero CTA really opens the hold
  R.routes = await page.evaluate(() => window.__rl.routes());
  // Eliran 2026-11-08: the landing is about the whole project — no 846 shortcut in the page, and ONE action (every CTA = the same route)
  R.mentions846 = await page.evaluate(() => (document.querySelector('main').innerText.match(/846/g) || []).length);
  if (R.mentions846) fail(S.name, `the page still mentions 846 (${R.mentions846}×)`);
  if (new Set(R.routes.map((r) => r.href)).size !== 1) fail(S.name, 'more than one CTA target: ' + JSON.stringify(R.routes));
  for (const r of R.routes) {
    const u = new URL(r.href);
    if (u.origin !== base) { fail(S.name, `route leaves the site: ${r.id} ${r.href}`); continue; }
    const st = (await page.request.get(r.href)).status(); r.status = st;
    if (st !== 200) fail(S.name, `route ${r.id} → ${st} ${r.href}`);
  }
  for (const href of ['/studio/', '/apartment.html?project=rainbow&unit=846', '/tour/', '/hold/']) { const st = (await page.request.get(base + href)).status(); R.routes.push({ id: 'fixed', href, status: st }); if (st !== 200) fail(S.name, `${href} → ${st}`); }
  // EN
  await page.click('#langToggle'); await sleep(500);
  R.en = await page.evaluate(() => ({ dir: document.documentElement.dir, lang: document.documentElement.lang, promise: document.querySelector('.rl-hero__promise').textContent, cta: document.getElementById('heroCta').textContent.trim(), badge: document.querySelector('[data-badge="render"]').textContent.trim(), title: document.title }));
  if (R.en.dir !== 'ltr' || !/Tour the project/.test(R.en.cta) || R.en.badge !== 'Render') fail(S.name, 'EN did not apply ' + JSON.stringify(R.en));
  await page.screenshot({ path: path.join(OUT, `10-en-hero-${S.name}.png`) });
  await page.screenshot({ path: path.join(OUT, `11-en-full-page-${S.name}.png`), fullPage: true });
  R.overflowEn = await overflow(page);
  if (R.overflowEn.doc || R.overflowEn.els.length) fail(S.name, 'EN horizontal overflow ' + JSON.stringify(R.overflowEn));
  await page.click('#langToggle'); await sleep(300);
  // the hero CTA → the hold (the product's own page; its errors are its own, only the load is asserted here)
  const cta = await page.getAttribute('#heroCta', 'href');
  R.ctaHref = cta;
  const hold = await ctx.newPage(); const hb = { errors: [], http: [] }; watch(hold, hb);
  const resp = await hold.goto(cta, { waitUntil: 'domcontentloaded' }); await sleep(2500);
  R.ctaOpens = { status: resp && resp.status(), url: hold.url(), title: await hold.title(), errors: hb.errors.slice(0, 5) };
  if (!resp || resp.status() !== 200 || !/\/hold\//.test(hold.url())) fail(S.name, 'hero CTA did not open /hold/ ' + JSON.stringify(R.ctaOpens));
  await hold.screenshot({ path: path.join(OUT, `12-cta-opens-hold-${S.name}.png`) });
  await hold.close();
  R.errors = bag.errors; R.http = bag.http;
  if (bag.errors.length) fail(S.name, 'page errors: ' + bag.errors.join(' | '));
  if (bag.http.length) fail(S.name, 'http errors: ' + bag.http.join(' | '));
  await ctx.close();
  // (3) reduced motion: no autoplay, poster + play button; one tap plays
  {
    const c = await browser.newContext({ ...S, reducedMotion: 'reduce' }); const pg = await c.newPage(); const b2 = { errors: [], http: [] }; watch(pg, b2);
    await pg.goto(base + '/', { waitUntil: 'load' }); await sleep(2000);
    R.reduced = await pg.evaluate(() => ({ paused: window.__rl.video.paused, t: window.__rl.video.currentTime, button: document.getElementById('heroToggle').dataset.state, label: document.getElementById('heroToggle').getAttribute('aria-label') }));
    if (!R.reduced.paused || R.reduced.button !== 'paused') fail(S.name, 'reduced motion autoplayed');
    await pg.screenshot({ path: path.join(OUT, `13-reduced-motion-${S.name}.png`) });
    await pg.click('#heroToggle');
    try { await pg.waitForFunction(() => window.__rl.video.currentTime > 0.5, null, { timeout: 15000 }); R.reduced.tapPlays = true; } catch { R.reduced.tapPlays = false; fail(S.name, 'reduced motion: play button did not play'); }
    if (b2.errors.length) fail(S.name, 'reduced: page errors ' + b2.errors.join(' | '));
    await c.close();
  }
}
await browser.close(); srv.close();
result.pass = result.fails.length === 0;
fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(result, null, 1));
console.log(result.pass ? `PASS · ${OUT}` : `FAIL · ${result.fails.length} · ${OUT}`);
process.exit(result.pass ? 0 : 1);
