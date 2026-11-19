// debug: does holding "forward" move the visitor, and how smoothly ($0, local)
import { createRequire } from 'node:module';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json');
const { chromium } = require('playwright-core');
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
await p.goto(process.argv[2]); await p.waitForFunction(() => window.__walk?.ready, null, { timeout: 120e3 });
await p.waitForTimeout(+(process.env.WAITMS || 3000));
console.log(await p.evaluate(async () => {
  const w = window.__walk, f = (x) => +x.toFixed(3);
  const a = { x: f(w.me.x), z: f(w.me.z), here: w.ok(w.me.x, w.me.z), ahead30cm: w.ok(w.me.x - Math.sin(w.me.yaw) * 0.3, w.me.z - Math.cos(w.me.yaw) * 0.3) };
  const rec = []; let t0 = performance.now();
  w.press(1, 0);
  await new Promise((r) => { const g = () => { rec.push([performance.now() - t0, w.me.x, w.me.z]); if (performance.now() - t0 < 2000) requestAnimationFrame(g); else r(); }; g(); });
  w.press(0, 0);
  await new Promise((r) => setTimeout(r, 800));
  const sp = []; for (let i = 1; i < rec.length; i++) sp.push(Math.hypot(rec[i][1] - rec[i - 1][1], rec[i][2] - rec[i - 1][2]) / ((rec[i][0] - rec[i - 1][0]) / 1000));
  let jump = 0; for (let i = 1; i < sp.length; i++) jump = Math.max(jump, Math.abs(sp[i] - sp[i - 1]));
  const steps = []; for (let i = 1; i < rec.length; i++) steps.push([+(rec[i][0] - rec[i - 1][0]).toFixed(1), +Math.hypot(rec[i][1] - rec[i - 1][1], rec[i][2] - rec[i - 1][2]).toFixed(4)]);
  return JSON.stringify({ maxStep_m: Math.max(...steps.map((x) => x[1])), minDt_ms: Math.min(...steps.map((x) => x[0])), tail: steps.slice(-4), start: a, frames: rec.length, moved: f(Math.hypot(w.me.x - a.x, w.me.z - a.z)), speeds: sp.filter((_, i) => i % 4 === 0).map(f), maxSpeedStep: f(jump), vAfterRelease: f(w.mv.v) });
}));
// the pad by a real touch (CDP): press its centre, slide 48 px up, hold 1.5 s, release
const box = await (await p.$('.w-pad')).boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2;
const cdp = await p.context().newCDPSession(p);
const t = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
const before = await p.evaluate(() => [window.__walk.me.x, window.__walk.me.z]);
await t('touchStart', cx, cy); for (let i = 1; i <= 8; i++) { await t('touchMove', cx, cy - i * 6); await p.waitForTimeout(20); }
await p.waitForTimeout(1500); const knob = await p.evaluate(() => getComputedStyle(document.querySelector('.w-pad-knob')).transform);
await t('touchEnd'); await p.waitForTimeout(800);
const after = await p.evaluate(() => [window.__walk.me.x, window.__walk.me.z]);
console.log(JSON.stringify({ padTouchMoved_m: +Math.hypot(after[0] - before[0], after[1] - before[1]).toFixed(3), knobWhileHeld: knob }));
await p.screenshot({ path: process.argv[3] || 'qa/phone/new-pad.png' });
await b.close();
