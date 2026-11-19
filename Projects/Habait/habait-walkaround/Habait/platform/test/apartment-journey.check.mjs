#!/usr/bin/env node
/* The apartment journey, round 4 (plan development/plans/2026-11-09-rainbow-v2.md §9; Eliran 2026-11-10: from «המשיכו אל הדירה» ONE flight —
   the floors, the glide — straight into the 360 tour, no scrolling). Headless Chrome on a STAGE at 375×667, 390×844, 430×932 (touch) and
   1440×900: landing → «לסיור בפרויקט» → the hold's stop → 846 → its button. Then, timed from the tap:
     - the journey plays in a frame OVER the hold (#journeyFrame; the page URL stays /hold/); no scrolling, no overflow in it;
     - the counter reaches «16», «דירה 846» and the facts (3 · 106.72 · 26.15, no price) show, the badge «הדמיה · AI-generated» shows;
     - the landing is drawn as the tour will open it (room living, the hand-off URL's yaw, pitch −2, the tour's hfov for this screen);
     - the tour (#tourFrame, room=living) comes in front 8–14 s after the tap, its parent holds the AudioContext of the tap;
     - «דלג לסיור» brings the tour within 3 s; reduced motion: no journey, the tour within 3 s.
   Screenshots j1…j8 per size + apartment-journey.json into --out. $0. usage: node test/apartment-journey.check.mjs <stage> --out <dir> */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const stage = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--out');
const OUT = argv[argv.indexOf('--out') + 1];
if (!stage || argv.indexOf('--out') < 0) { console.error('usage: apartment-journey.check.mjs <stage> --out <dir>'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const APP = process.env.HABAIT_APP_DIR || 'C:/RnD/Projects/Habait/tools/appdeps';
const { chromium } = createRequire(path.join(APP, 'package.json'))('playwright-core');
const { serveStatic } = await import(pathToFileURL(path.join(HERE, '..', '..', 'tools', 'qa', 'responsive-gate.mjs')).href);
const rw = fs.existsSync(path.join(stage, 'vercel.json')) ? JSON.parse(fs.readFileSync(path.join(stage, 'vercel.json'), 'utf8')).rewrites : null;
const srv = serveStatic(path.resolve(stage), rw); await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--autoplay-policy=no-user-gesture-required'] });
const phone = (w, h) => ({ name: String(w), viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const ONLY = argv.includes('--sizes') ? argv[argv.indexOf('--sizes') + 1].split(',') : null;   // --sizes 390,1440: a partial run (debugging)
const SIZES = [phone(375, 667), phone(390, 844), phone(430, 932), { name: '1440', viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 }].filter((s) => !ONLY || ONLY.includes(s.name));
const res = { at: new Date().toISOString(), base, sizes: {}, fails: [] };
const fail = (s, m) => { res.fails.push(`${s}: ${m}`); console.log(`  FAIL ${s}: ${m}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// the bird flight (2026-11-10): the film plays between the floors and the landing, so the sequence is ~10 s
const FLY = true; const LAND = [5500, 10500], TOUR = [6000, 16000];   // the 6.2 s film starts with the tap (the hold warms it): landing at ~6.6 s; a late film start is still inside the bounds

async function toStop(page) {
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => /hold/.test(document.getElementById('heroCta').href));
  await Promise.all([page.waitForURL(/\/hold\//, { timeout: 20000 }), page.click('#heroCta')]);
  await page.waitForFunction(() => window.__orbit && window.__orbit.done, null, { timeout: 100000 });
  await page.waitForFunction(() => [...document.querySelectorAll('#pickerStage .hotspot')].some((b) => b.dataset.unit === '846' && b.offsetParent), null, { timeout: 30000 });
  await sleep(1500);
  await page.evaluate(() => document.querySelector('#pickerStage .hotspot[data-unit="846"]').click()); await sleep(900);
}
const jf = (page) => page.frames().find((f) => /\/apartment-journey\//.test(f.url()));
const tourIn = (page) => page.evaluate(() => { const f = document.getElementById('tourFrame'); return Boolean(f && getComputedStyle(f).opacity === '1'); });

for (const S of SIZES) {
  const R = res.sizes[S.name] = {}; console.log(`== ${S.name}`);
  const ctx = await browser.newContext({ ...S }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  if (argv.includes('--verbose')) { page.on('console', (m) => console.log('   [console]', Date.now() % 100000, m.text().slice(0, 160))); page.on('framenavigated', (fr) => console.log('   [nav]', Date.now() % 100000, fr.url().replace(base, '').slice(0, 90))); }
  try { await toStop(page); } catch (e) { fail(S.name, 'no stop / no 846: ' + e.message.slice(0, 80)); await ctx.close(); continue; }
  const tap = Date.now(); await page.click('#unitContinue');
  try { await page.waitForFunction(() => document.getElementById('journeyFrame'), null, { timeout: 5000 }); } catch { fail(S.name, 'no journey frame over the hold'); }
  R.url = page.url().replace(base, '').slice(0, 40); if (!/\/hold\//.test(R.url)) fail(S.name, 'the page left the hold');
  const shots = FLY ? [[700, 'j1-start'], [2200, 'j2-floors'], [3900, 'j3-floor16'], [3000, 'j2b-flight-terrace'], [4700, 'j4-flight-room'], [5600, 'j5-flight-end'], [6700, 'j6-landing']]
    : [[700, 'j1-start'], [2200, 'j2-floors'], [3900, 'j3-floor16'], [5300, 'j4-isolated'], [6800, 'j5-glide'], [7900, 'j6-landing']];
  for (const [t, name] of shots) {
    const wait = t - (Date.now() - tap); if (wait > 0) await sleep(wait);
    await page.screenshot({ path: path.join(OUT, `${name}-${S.name}.png`) });
    const f = jf(page);
    // the journey's own state, kept from the last shot that still found its frame (the hold removes the frame right after the hand-off)
    if (f) { const st = await f.evaluate(() => ({ phase: window.__journey.phase, mode: window.__journey.mode, flyT: window.__journey.flyT, flyStart: Math.round(window.__journey.flyStart || 0), rendered: window.__journey.rendered, landing: window.__journey.landing, landedAt: Math.round(window.__journey.landedAt || 0),
      band: (() => { const b = document.getElementById('band'), p = document.getElementById('pin'); return [b, p].some((e) => e && getComputedStyle(e).visibility !== 'hidden' && Number(getComputedStyle(e).opacity) > 0.02); })() })).catch(() => null); if (st) { R.last = st; if (st.band) R.bandSeen = name; } }
    if (name === 'j3-floor16' && f) {
      // read the floor stage when the JOURNEY says it is there (its own clock), not at a wall-clock instant: other runs on the machine
      // can delay the start (2026-11-10: a contended run read «15» at 3.9 s although the sequence itself was on time)
      await f.waitForFunction(() => window.__journey && ['floors', 'glide', 'landed', 'land', 'skip'].includes(window.__journey.phase), null, { timeout: 8000 }).catch(() => {});
      await page.screenshot({ path: path.join(OUT, `${name}-${S.name}.png`) });
      R.floor = await f.evaluate(() => ({ num: document.getElementById('num').textContent.trim(), unit: document.getElementById('unit').textContent.trim(), facts: document.getElementById('facts').textContent.replace(/\s+/g, ' ').trim(),   /* textContent: the copy fades as the film crosses the glass, the read must not race it */
        badge: (() => { const b = document.querySelector('.jr-badge'); const r = b.getBoundingClientRect(); return b && r.width > 0 && getComputedStyle(b).visibility !== 'hidden'; })(),
        overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight + 1, price: /₪|מחיר/.test(document.body.innerText) }));
      if (R.floor.num !== '16') fail(S.name, `the counter shows «${R.floor.num}» at the floor stage`);
      if (!/846/.test(R.floor.unit)) fail(S.name, 'no «דירה 846»');
      if (!/3/.test(R.floor.facts) || !/106\.72/.test(R.floor.facts) || !/26\.15/.test(R.floor.facts)) fail(S.name, 'the facts are not 3 · 106.72 · 26.15: ' + R.floor.facts);
      if (!R.floor.badge) fail(S.name, 'the badge «הדמיה · AI-generated» is not visible');
      if (R.floor.overflow) fail(S.name, 'the journey scrolls / overflows'); if (R.floor.price) fail(S.name, 'a price shows');
    }
  }
  R.journey = R.last || null;
  if (R.bandSeen) fail(S.name, `the yellow band / the 846 pin showed at ${R.bandSeen} (Eliran 2026-11-10: not wanted)`);
  try { await page.waitForFunction(() => { const f = document.getElementById('tourFrame'); return f && getComputedStyle(f).opacity === '1'; }, null, { timeout: 20000 }); } catch { fail(S.name, 'the tour never came in front'); }
  R.toTourMs = Date.now() - tap;
  // the sequence's length on its OWN clock (landing at ~8 s) — the wall-clock tap → tour also holds the tour's load and machine load
  const fl = jf(page); R.landedAt = (fl ? await fl.evaluate(() => Math.round(window.__journey.landedAt || 0)).catch(() => null) : null) || (R.last && R.last.landedAt) || null;
  if (R.landedAt != null && (R.landedAt < LAND[0] || R.landedAt > LAND[1])) fail(S.name, `the sequence landed at ${R.landedAt} ms of its own clock (${LAND.join('–')} expected)`);
  if (R.toTourMs < TOUR[0] || R.toTourMs > TOUR[1]) fail(S.name, `tap → tour took ${R.toTourMs} ms (${TOUR.join('–')} wall clock)`);
  if (R.journey && R.journey.mode !== 'fly') fail(S.name, `the journey ran as «${R.journey.mode}»: the flight film did not play`);
  if (R.journey && !(R.journey.flyT > 4)) fail(S.name, `the flight film only reached ${R.journey.flyT} s`);
  if (R.journey && R.journey.flyStart > 1500) fail(S.name, `the flight started ${R.journey.flyStart} ms after the journey opened: the picture stood still (Eliran 2026-11-10: no stop)`);
  await sleep(1200); await page.screenshot({ path: path.join(OUT, `j7-tour-${S.name}.png`) });
  R.tour = await page.evaluate(() => { const f = document.getElementById('tourFrame'); return { src: f.src.replace(location.origin, ''), audio: Boolean(window.__habaitAudio && window.__habaitAudio.ac), journeyGone: !document.getElementById('journeyFrame') }; });
  if (!/\/tour\//.test(R.tour.src) || !/room=living/.test(R.tour.src)) fail(S.name, 'the tour frame is not /tour/ room=living: ' + R.tour.src.slice(0, 80));
  if (!R.tour.audio) fail(S.name, 'no AudioContext from the tap in the hold');
  if (!R.journey || !R.journey.rendered) fail(S.name, 'the landing was not drawn');
  else {
    const yaw = Number(new URL(base + R.tour.src).searchParams.get('yaw'));
    if (R.journey.landing.yaw !== yaw || R.journey.landing.pitch !== -2) fail(S.name, `the landing (yaw ${R.journey.landing.yaw}, pitch ${R.journey.landing.pitch}) is not the tour's first view (yaw ${yaw}, pitch −2)`);
  }
  R.errors = errors; if (errors.length) fail(S.name, 'page errors: ' + errors.join(' | '));
  await ctx.close();
  // «דלג לסיור»
  { const c2 = await browser.newContext({ ...S }); const p2 = await c2.newPage();
    try { await toStop(p2); await p2.click('#unitContinue'); await p2.waitForFunction(() => document.getElementById('journeyFrame'), null, { timeout: 5000 }); await sleep(1500);
      const f2 = jf(p2); const t = Date.now(); await f2.click('#skip');
      await p2.waitForFunction(() => { const f = document.getElementById('tourFrame'); return f && getComputedStyle(f).opacity === '1'; }, null, { timeout: 12000 });
      R.skipMs = Date.now() - t; } catch (e) { fail(S.name, '«דלג לסיור» did not bring the tour: ' + e.message.slice(0, 60)); }
    await p2.screenshot({ path: path.join(OUT, `j8-skip-${S.name}.png`) }); await c2.close(); }
}
// reduced motion (one size): no journey, the tour at once
{ const S = SIZES[1] || SIZES[0]; const c3 = await browser.newContext({ ...S, reducedMotion: 'reduce' }); const p3 = await c3.newPage();
  try { await toStop(p3); const t = Date.now(); await p3.click('#unitContinue');
    await p3.waitForFunction(() => { const f = document.getElementById('tourFrame'); return f && getComputedStyle(f).opacity === '1'; }, null, { timeout: 12000 });
    res.reduced = { ms: Date.now() - t, journey: await p3.evaluate(() => Boolean(document.getElementById('journeyFrame'))) };
    if (res.reduced.journey) fail('reduce', 'the journey played under reduced motion');
  } catch (e) { fail('reduce', 'the tour did not open: ' + e.message.slice(0, 60)); }
  await c3.close(); }
await browser.close(); srv.close();
res.pass = res.fails.length === 0;
fs.writeFileSync(path.join(OUT, 'apartment-journey.json'), JSON.stringify(res, null, 1));
console.log(res.pass ? `PASS · ${OUT}` : `FAIL · ${res.fails.length} · ${OUT}`);
process.exit(res.pass ? 0 : 1);
