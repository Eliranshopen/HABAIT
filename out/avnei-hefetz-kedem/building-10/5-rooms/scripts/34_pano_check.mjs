// $0 browser check of the 360 version (walk/?mode=360): (1) yaw calibration — at a standpoint, the model's own picture vs the
// panorama for each yaw sign / offset, saved for a pixel diff; (2) with --qa: the RAINBOW features in 360 at 1440x900 and 390x844.
// Usage: node scripts/34_pano_check.mjs <url> <out dir> [--calib] [--qa]
import { createRequire } from 'module';
import fs from 'node:fs';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json');
const { chromium } = require('playwright-core');
const [url, outDir] = process.argv.slice(2); fs.mkdirSync(outDir, { recursive: true });
const CAL = process.argv.includes('--calib'), QA = process.argv.includes('--qa');
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const W = (p) => p.waitForFunction(() => window.__walk && window.__walk.ready, null, { timeout: 240000, polling: 1000 });
const res = {};
if (CAL) {
  const ctx = await b.newContext({ viewport: { width: 800, height: 600 } }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(url, { waitUntil: 'load' }); await W(p); await p.waitForTimeout(2500);
  await p.evaluate(async () => { const w = window.__walk; await w.PANO.show(w.PANO.points.find((q) => q.id === 'living'), false); w.me.pitch = 0; });
  for (const yawv of [0, 1.2]) {
    await p.evaluate((y) => { window.__walk.me.yaw = y; }, yawv); await p.waitForTimeout(600);
    await p.evaluate(() => window.__walk.PANO.doll(true)); await p.evaluate(() => { window.__walk.scene.background = null; }); await p.waitForTimeout(400);
    await p.screenshot({ path: `${outDir}/model_${yawv}.png` });
    await p.evaluate(() => window.__walk.PANO.doll(false));
    for (const sign of [1, -1]) for (const off of [0, 90, 180, -90]) {
      await p.evaluate(([s, o]) => { const w = window.__walk; const q = w.PANO.cur; w.scene.backgroundRotation.set(0, s * q.yaw_deg * Math.PI / 180 + o * Math.PI / 180, 0); }, [sign, off]);
      await p.waitForTimeout(300); await p.screenshot({ path: `${outDir}/pano_${yawv}_${sign}_${off}.png` });
    }
  }
  res.calib_errors = errs;
}
if (QA) {
  for (const [name, vp, mobile] of [['desktop', { width: 1440, height: 900 }, false], ['phone', { width: 390, height: 844 }, true]]) {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push('pageerror ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push('console ' + m.text()); });
    p.on('response', (r) => { if (r.status() >= 400 && !/api\/edit/.test(r.url())) errs.push(r.status() + ' ' + r.url()); });
    await p.goto(url, { waitUntil: 'load' }); await W(p); await p.waitForTimeout(3000);
    const r = {}; const ev = (f, a) => p.evaluate(f, a); const shot = (n) => p.screenshot({ path: `${outDir}/${name}-${n}.png` });
    r.overflow = await ev(() => document.documentElement.scrollWidth > innerWidth);
    r.start = await ev(() => window.__walk.PANO.cur.id); await shot('0-start');
    for (const room of ['living', 'parents', 'kitchen', 'balcony']) {
      const okc = await ev((rm) => { const e = [...document.querySelectorAll('#rooms .rc')].find((x) => x.dataset.room === rm); if (e) e.click(); return !!e; }, room);
      await p.waitForTimeout(2200); r['card_' + room] = okc ? await ev(() => window.__walk.PANO.cur.id) : 'no card';
      await shot('1-' + room);
    }
    r.rings_visible = await ev(() => [...document.querySelectorAll('.ring')].filter((e) => e.style.display !== 'none').length);
    r.model_hidden = await ev(() => window.__walk.scene.children.filter((o) => o.isMesh || o.isGroup).filter((o) => o.visible).length);
    // turning (drag) keeps the panorama fixed to the room
    await p.mouse.move(vp.width / 2, vp.height / 2); await p.mouse.down(); await p.mouse.move(vp.width / 2 - 200, vp.height / 2, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(500); await shot('2-turned');
    // pick bar on a circle (no paid call: we only open it)
    r.pick = await ev(() => { const t = window.__walk.studio.targets.find((q) => q.ring && q.ring.style.display !== 'none'); if (!t) return null; t.ring.click(); return t.key; }); await p.waitForTimeout(1500);
    r.pick_cards = await ev(() => [...document.querySelectorAll('.pick .cc em')].map((e) => e.textContent).slice(0, 6)); await shot('3-pick');
    await ev(() => { const x = document.querySelector('.pick .x'); if (x) x.click(); });
    // design panel opens, free text refuses structure
    await ev(() => document.querySelector('#b-design').click()); await p.waitForTimeout(500); await shot('4-design');
    r.refuse_structure = await ev(() => window.__walk.studio.typed('להזיז את הקיר של הסלון'));
    await ev(() => document.querySelector('#b-design').click());
    // dollhouse on/off
    r.doll = await ev(async () => { const s = window.__walk.studio; s.setMode('doll'); await new Promise((o) => setTimeout(o, 1500)); const vis = window.__walk.scene.children.filter((o) => (o.isMesh || o.isGroup) && o.visible).length; return vis; });
    await shot('5-doll');
    await ev(() => window.__walk.studio.setMode('walk')); await p.waitForTimeout(1200); await shot('6-back');
    r.back_hidden = await ev(() => window.__walk.scene.children.filter((o) => (o.isMesh || o.isGroup) && o.visible && o.type !== 'Group').length);
    r.errors = errs; res[name] = r; await ctx.close();
  }
}
fs.writeFileSync(`${outDir}/result.json`, JSON.stringify(res, null, 1)); console.log(JSON.stringify(res, null, 1));
await b.close();
