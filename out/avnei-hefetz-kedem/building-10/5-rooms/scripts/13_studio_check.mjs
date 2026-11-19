// $0 browser check of studio.js + daynight.js (RAINBOW's interface, root CLAUDE.md §8.10; the day-night-keyframes skill):
// circles, pick bar (other models + finishes), free-text line, undo / original / reset, presets, dollhouse, measure,
// language, share link round trip, time of day (keyframes, midpoint weight) — at 1440x900 and 390x844.
import { createRequire } from 'module';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json');
const { chromium } = require('playwright-core');
const [url, outDir] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const res = {};
const W = (p) => p.waitForFunction(() => window.__walk && window.__walk.ready, null, { timeout: 240000, polling: 1000 });
for (const [name, vp, mobile] of [['desktop', { width: 1440, height: 900 }, false], ['phone', { width: 390, height: 844 }, true]]) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push('console ' + m.text()); });
  p.on('response', (r) => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
  await p.goto(url, { waitUntil: 'load' }); await W(p); await p.waitForTimeout(3500);
  const r = {};
  const idle = () => p.evaluate(() => window.__walk.studio.idle());
  const shot = (n) => p.screenshot({ path: `${outDir}/${name}-${n}.png` });
  const ev = (f, a) => p.evaluate(f, a);
  r.overflow = await ev(() => document.documentElement.scrollWidth > innerWidth);
  await shot('0-start');
  await ev(() => [...document.querySelectorAll('#rooms .rc')].find((e) => e.dataset.room === 'living').click()); await p.waitForTimeout(3500);
  r.rings_visible = await ev(() => [...document.querySelectorAll('.ring')].filter((e) => e.style.display !== 'none').length);
  r.room_labels_visible = await ev(() => [...document.querySelectorAll('.nl')].filter((e) => e.style.display !== 'none').map((e) => e.textContent));
  await shot('1-living');
  // pick bar on the sofa: another model, then a finish
  await ev(() => window.__walk.studio.targets.find((q) => q.kind === 'sofa').ring.click()); await p.waitForTimeout(2500); await shot('2-pick-sofa');
  r.pick_cards = await ev(() => [...document.querySelectorAll('.pick .cc em')].map((e) => e.textContent));
  await ev(() => [...document.querySelectorAll('.pick .cc')].find((e) => /ספה מודרנית|Modern sofa/.test(e.textContent)).click()); await idle(); await p.waitForTimeout(1200);
  r.sofa_model = await ev(() => window.__walk.studio.targets.find((q) => q.kind === 'sofa').items.map((it) => it.model));
  await ev(() => document.querySelector('.pick .x').click()); await shot('3-sofa-model');
  await ev(() => window.__walk.studio.openPick(window.__walk.studio.targets.find((q) => q.kind === 'dining_chair'))); await p.waitForTimeout(1500);
  await ev(() => [...document.querySelectorAll('.pick .cc')].find((e) => /כיסא מרופד|Upholstered/.test(e.textContent)).click()); await idle(); await p.waitForTimeout(1200);
  await ev(() => document.querySelector('.pick .x').click());
  // free-text line
  await p.click('#b-design'); await p.waitForTimeout(300);
  await p.fill('.panel .line input', 'קירות בירוק מרווה ורצפת פרקט ושולחן אוכל שחור'); await p.click('.panel .line button'); await idle(); await p.waitForTimeout(800);
  r.ops = await ev(() => window.__walk.studio.ops.map((o) => o.sel + ':' + (o.k || o.name || o.model || '')));
  r.refuse_structure = await ev(() => window.__walk.studio.typed('להזיז את הקיר של הסלון'));
  await shot('4-design-panel');
  await ev(() => document.querySelector('.panel .x').click()); await p.waitForTimeout(400); await shot('5-after-changes');
  const link = await ev(() => window.__walk.studio.shareUrl());
  await p.click('#b-design');
  await ev(() => document.querySelectorAll('.panel .acts .btn')[0].click()); await idle(); r.ops_after_undo = await ev(() => window.__walk.studio.ops.length);
  await ev(() => document.querySelector('.panel .x').click());
  // time of day: keyframes and the midpoint weight (skill gate: weight 0.5 ± 0.05 at the midpoint hour)
  if (mobile) { await p.click('#b-view'); await ev(() => [...document.querySelectorAll('.menu .mi')].find((e) => /שעה ביום/.test(e.textContent)).click()); }
  for (const [h, n] of [[7.5, 'morning'], [12.5, 'noon'], [17.5, 'golden'], [21.5, 'night']]) { await ev((x) => window.__walk.daynight.apply(x), h); await p.waitForTimeout(900); await shot(`6-time-${n}`); }
  r.midpoint = await ev(() => { window.__walk.daynight.apply(15); return window.__walk.daynight.mixInfo; });
  await ev(() => window.__walk.daynight.apply(14));
  // views: dollhouse; tools: measure; language; coach
  await p.click('#b-view'); await p.waitForTimeout(200); await shot('7-views-menu');
  await ev(() => [...document.querySelectorAll('.menu .mi')].find((e) => /תלת-ממד/.test(e.textContent)).click()); await p.waitForTimeout(1500); await shot('8-dollhouse');
  await p.click('#b-view'); await ev(() => [...document.querySelectorAll('.menu .mi')].find((e) => /הליכה/.test(e.textContent)).click()); await p.waitForTimeout(1500);
  await p.click('#b-tools'); await ev(() => document.querySelectorAll('.menu .mi')[0].click()); await p.waitForTimeout(300);
  await ev(([x, y]) => window.__walk.studio.tap(x, y), [vp.width * 0.3, vp.height * 0.7]); await ev(([x, y]) => window.__walk.studio.tap(x, y), [vp.width * 0.7, vp.height * 0.7]); await p.waitForTimeout(400);
  r.measure = await ev(() => document.querySelector('.mlabel').textContent); await shot('9-measure');
  await p.click('#b-tools'); await ev(() => document.querySelectorAll('.menu .mi')[0].click());
  await p.click('#b-lang'); await ev(() => [...document.querySelectorAll('.menu .mi')].find((e) => /English/.test(e.textContent)).click()); await p.waitForTimeout(500);
  r.english = await ev(() => ({ dir: document.documentElement.dir, design: document.querySelector('#b-design').textContent, room: document.querySelector('#room').textContent, clock: document.querySelector('.dn-t')?.textContent }));
  r.overflow_en = await ev(() => document.documentElement.scrollWidth > innerWidth);
  await shot('10-english');
  await p.click('#b-lang'); await ev(() => [...document.querySelectorAll('.menu .mi')].find((e) => /עברית/.test(e.textContent)).click()); await p.waitForTimeout(300);
  await p.click('#b-help'); await p.waitForTimeout(400); await shot('11-coach');
  r.errs = errs; await ctx.close();
  const ctx2 = await b.newContext({ viewport: vp }); const p2 = await ctx2.newPage(); const e2 = [];
  p2.on('pageerror', (e) => e2.push(e.message));
  await p2.goto(link, { waitUntil: 'load' }); await W(p2); await p2.evaluate(() => window.__walk.studio.idle()); await p2.waitForTimeout(2500);
  r.link_ops = await p2.evaluate(() => window.__walk.studio.ops.length); r.link_errs = e2;
  await p2.screenshot({ path: `${outDir}/${name}-12-shared-link.png` }); await ctx2.close();
  res[name] = r;
}
await b.close();
console.log(JSON.stringify(res, null, 1));
