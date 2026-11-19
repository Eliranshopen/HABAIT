// walk-check.mjs <page url> --out <dir> — the walk at 1440x900 (keys, click) and 390x844 (touch). It loads; a short hold of ↑ walks
// a little and stops between two viewpoints; ↓ walks back; ← turns in place; holding ↑ follows a whole route, bends included, to
// the next viewpoint; every viewpoint is reached; a click / tap on the floor walks there; a drag turns; the picture is never flat;
// the compare button works where walk.json has one; no arrow buttons on a phone; no page error, no horizontal scroll. Exit 1 on failure.
import fs from 'node:fs'; import { createRequire } from 'node:module';
const { chromium } = createRequire((process.env.HABAIT_APP_DIR || 'C:/RnD/Projects/Habait/tools/appdeps') + '/package.json')('playwright-core');
const args = process.argv.slice(2), base = args[0], out = args[args.indexOf('--out') + 1]; fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const fails = []; const fail = (s, m) => { fails.push(s + ': ' + m); console.log('  FAIL', s, m); };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: process.env.WALK_SOFT ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const pos = (p) => p.evaluate(() => window.__walk.pos());
const ready = (p) => p.waitForFunction(() => window.__walk && window.__walk.ready && window.__walk.frames > 0, null, { timeout: 60000 });
const settle = async (p, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { const a = await pos(p); await sleep(350); const b = await pos(p); if (!b.gliding && Math.hypot(a.x - b.x, a.y - b.y) < 0.5) return b; } return pos(p); };
const probe = (p) => p.evaluate(() => window.__walk.probe());
const common = async (p, s, errs) => {
  const o = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, errs: window.__walk.errors, badge: document.getElementById('w-badge').getBoundingClientRect().width > 0 }));
  if (o.sw > o.cw + 1) fail(s, 'horizontal scroll ' + o.sw + ' > ' + o.cw); if (o.errs.length) fail(s, 'walk errors: ' + o.errs.join(' | ')); if (errs.length) fail(s, 'page errors: ' + errs.join(' | ')); if (!o.badge) fail(s, 'the simulation badge is not shown');
};
const info = (p) => p.evaluate(() => ({ ids: window.__walk.nodes.map((n) => n.id), cmp: window.__walk.nodes.filter((n) => n.compare).map((n) => n.id), adj: window.__walk.nodes.map((n) => n.adj.map((j) => window.__walk.nodes[j].id)) }));
async function visitAll(p, s, ids, shots) {
  for (const id of ids) {
    await p.evaluate((x) => window.__walk.goNode(x), id); const r = await settle(p, 45000);
    if (r.a !== id || r.b !== id) { fail(s, 'did not reach ' + id + ': ' + JSON.stringify(r)); continue; }
    await sleep(500); const pr = await probe(p); if (pr.sd < 4) fail(s, 'the picture at ' + id + ' is flat (sd ' + pr.sd.toFixed(1) + ')');
    if (shots.includes(id)) await p.screenshot({ path: `${out}/${s}-at-${id}.png` });
  }
  console.log(' ', s, 'reached every viewpoint:', ids.length);
}

{ // desktop
  const s = '1440'; const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(base, { waitUntil: 'load' }); await ready(p); await sleep(900); await p.screenshot({ path: `${out}/1440-start.png` });
  const I = await info(p); const first = I.ids[0]; const p0 = await pos(p); if (p0.a !== first) fail(s, 'does not start at ' + first);
  // a short hold walks a little and stops between two viewpoints
  const to = await p.evaluate(() => window.__walk.faceNext(0)); await sleep(200);
  await p.keyboard.down('ArrowUp'); await sleep(500); await p.keyboard.up('ArrowUp'); await sleep(250); const p1 = await pos(p); const moved = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  console.log(' ', s, 'held ↑ 0.5 s toward', to, ': moved', moved.toFixed(0), 'cm'); if (!(moved > 25 && moved < 110)) fail(s, 'a 0.5 s hold moved ' + moved.toFixed(0) + ' cm'); if (!(p1.s > 0.02 && p1.s < 0.98)) fail(s, 'did not stop between two viewpoints');
  await p.screenshot({ path: `${out}/1440-midway.png` }); await sleep(300); const p1b = await pos(p); if (Math.hypot(p1b.x - p1.x, p1b.y - p1.y) > 0.5) fail(s, 'keeps moving after the key is released');
  await p.keyboard.down('ArrowDown'); await sleep(300); await p.keyboard.up('ArrowDown'); await sleep(200); const p2 = await pos(p); if (!(Math.hypot(p2.x - p0.x, p2.y - p0.y) < moved - 5)) fail(s, '↓ did not walk back');
  const y0 = await p.evaluate(() => window.__walk.yaw); await p.keyboard.down('ArrowLeft'); await sleep(400); await p.keyboard.up('ArrowLeft'); await sleep(100); const y1 = await p.evaluate(() => window.__walk.yaw); const p3 = await pos(p);
  if (Math.abs(y1 - y0) < 0.2) fail(s, '← did not turn'); if (Math.hypot(p3.x - p2.x, p3.y - p2.y) > 0.5) fail(s, '← moved the visitor');
  { const f0 = await p.evaluate(() => window.__walk.frames); await p.keyboard.down('ArrowRight'); await sleep(1000); await p.keyboard.up('ArrowRight'); const f1 = await p.evaluate(() => window.__walk.frames); console.log(' ', s, 'frames in one second while turning:', f1 - f0); }
  // holding ↑ follows every route out of the start, bends included, to the next viewpoint (and back by the page's own walk)
  for (let k = 0; k < I.adj[0].length; k++) {
    await p.evaluate((x) => window.__walk.goNode(x), first); await settle(p, 30000);
    const want = await p.evaluate((kk) => window.__walk.faceNext(kk), k); await sleep(150);
    // a person holding ↑ walks THROUGH a viewpoint and on; reached = the walker stood at `want` or has left it (a === want)
    await p.keyboard.down('ArrowUp'); const t0 = Date.now(); let r = await pos(p), shot = false, wrong = null;
    while (Date.now() - t0 < 12000) { await sleep(150); r = await pos(p); if (!shot && Date.now() - t0 > 1400) { shot = true; await p.screenshot({ path: `${out}/1440-walking-to-${want}.png` }); } if (r.a === want) break; if (r.a !== first && r.a !== want) { wrong = r; break; } }
    await p.keyboard.up('ArrowUp'); await sleep(200);
    console.log(' ', s, 'held ↑ from', first, 'toward', want, '→', r.a === want ? 'reached ' + want : 'NOT reached (' + r.a + ' → ' + r.b + ')', ((Date.now() - t0) / 1000).toFixed(1) + ' s');
    if (wrong) fail(s, 'holding ↑ toward ' + want + ' went elsewhere: ' + JSON.stringify(wrong)); else if (r.a !== want) fail(s, 'holding ↑ 12 s did not reach ' + want);
  }
  await visitAll(p, s, I.ids.slice(1).concat([first]), ['kitchen', 'bedroom2', 'terraceLiving', 'bathMain', 'w09', 'w04']);
  // a click on the floor ahead walks there
  await p.evaluate(() => window.__walk.faceNext(0)); await p.evaluate(() => { window.__walk.pitch = -0.35; }); await p.keyboard.down('ArrowLeft'); await sleep(20); await p.keyboard.up('ArrowLeft'); await sleep(300);
  const b0 = await pos(p); await p.mouse.click(720, 640); const b1 = await settle(p, 15000); const went = Math.hypot(b1.x - b0.x, b1.y - b0.y); console.log(' ', s, 'click on the floor ahead: walked', went.toFixed(0), 'cm'); if (went < 30) fail(s, 'a click on the floor did not walk');
  for (const id of I.cmp) {   // compare, where the folder has it
    await p.evaluate((x) => window.__walk.goNode(x), id); await settle(p, 30000); await sleep(500); const btn = p.locator('#w-cmp');
    if (!(await btn.isVisible())) { fail(s, 'no compare button at ' + id); continue; }
    await btn.click(); await p.waitForFunction((x) => { const n = window.__walk.nodes.find((q) => q.id === x); return window.__walk.compare && n.cmp && n.cmp.tex; }, id, { timeout: 30000 }).catch(() => fail(s, 'the compare picture did not load at ' + id));
    await sleep(500); await p.screenshot({ path: `${out}/1440-${id}-compare.png` }); await btn.click(); await sleep(300); if (await p.evaluate(() => window.__walk.compare)) fail(s, 'compare did not switch off');
  }
  await common(p, s, errs); await ctx.close();
}
{ // phone
  const s = '390'; const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(base, { waitUntil: 'load' }); await ready(p); await sleep(900); await p.screenshot({ path: `${out}/390-start.png` });
  const I = await info(p);
  if (await p.evaluate(() => Boolean(document.querySelector('[id*=joy], [id*=arrow], .t-joy')))) fail(s, 'arrow buttons on the phone');
  const hint = await p.evaluate(() => document.getElementById('w-hint').textContent); if (!hint.includes('הקישו על הרצפה')) fail(s, 'the phone hint: ' + hint);
  await p.evaluate(() => { window.__walk.faceNext(0); window.__walk.pitch = -0.45; }); await p.touchscreen.tap(195, 300); await sleep(300);
  await settle(p, 8000); const p0 = await pos(p); await p.touchscreen.tap(195, 560); await sleep(1200); await p.screenshot({ path: `${out}/390-walking.png` }); const p1 = await settle(p, 15000); const went = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  console.log(' ', s, 'tap on the floor: walked', went.toFixed(0), 'cm'); if (went < 30) fail(s, 'a tap on the floor did not walk'); await p.screenshot({ path: `${out}/390-after-tap.png` });
  const y0 = await p.evaluate(() => window.__walk.yaw); await p.evaluate(() => { const c = document.getElementById('gl'); const ev = (t, x) => c.dispatchEvent(new PointerEvent(t, { clientX: x, clientY: 400, pointerId: 7, pointerType: 'touch', bubbles: true, isPrimary: true })); ev('pointerdown', 300); ev('pointermove', 240); ev('pointermove', 160); ev('pointerup', 160); }); await sleep(200);
  const y1 = await p.evaluate(() => window.__walk.yaw); if (Math.abs(y1 - y0) < 0.15) fail(s, 'a drag did not turn the view');
  await visitAll(p, s, I.ids.slice(1).concat([I.ids[0]]), ['kitchen', 'terraceLiving', 'w09']);
  for (const id of I.cmp.slice(0, 1)) { await p.evaluate((x) => window.__walk.goNode(x), id); await settle(p, 30000); await sleep(400); const btn = p.locator('#w-cmp'); if (!(await btn.isVisible())) fail(s, 'no compare button at ' + id); else { const bb = await btn.boundingBox(); if (bb.height < 44) fail(s, 'compare button ' + bb.height + ' px high'); await btn.tap(); await sleep(2500); await btn.tap(); await sleep(300); } }
  await common(p, s, errs); await ctx.close();
}
await browser.close();
console.log(fails.length ? 'WALK CHECK: FAIL (' + fails.length + ')\n' + fails.join('\n') : 'WALK CHECK: PASS');
process.exit(fails.length ? 1 : 0);
