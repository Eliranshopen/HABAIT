/* A phone screenshot of the walk (390×844, touch, dpr 3), plus a few simulated drag steps to see the movement ($0).
   Usage: node scripts/25_phone_shot.mjs <url> <out-prefix>                                                   */
import { createRequire } from 'node:module';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json');
const { chromium } = require('playwright-core');
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
await page.goto(url, { waitUntil: 'load', timeout: 120e3 });
await page.waitForFunction(() => window.__walk?.ready, null, { timeout: 120e3 });
await page.waitForTimeout(4000);
await page.screenshot({ path: `${out}-0.png` });
// the movement trace: hold the arrow pad up (a real pointer drag on it), record the camera each frame, then let go
const pad = await page.$('.w-pad');
const startRec = () => page.evaluate(() => { const w = window.__walk; window.__rec = []; const t0 = performance.now();
  const f = () => { window.__rec.push([performance.now() - t0, w.camera.position.x, w.camera.position.z, w.me.yaw]); if (performance.now() - t0 < 3200) requestAnimationFrame(f); }; f(); });
await startRec();
if (pad) {
  const r = await pad.boundingBox(), cx = r.x + r.width / 2, cy = r.y + r.height / 2;
  await page.mouse.move(cx, cy); await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(cx + i * 1.2, cy - i * 6); await page.waitForTimeout(25); }
  await page.waitForTimeout(1600);
  await page.mouse.up();
} else await page.evaluate(() => window.__walk.press?.(1, 0));
await page.waitForTimeout(1500);
const trace = { pressed: pad ? 'pad' : 'none', rec: await page.evaluate(() => window.__rec) };
// smoothness: the largest frame-to-frame change of speed (m/s per frame) — a jump shows as a spike
const sp = []; for (let i = 1; i < trace.rec.length; i++) { const [t0, x0, z0] = trace.rec[i - 1], [t1, x1, z1] = trace.rec[i]; if (t1 > t0) sp.push(Math.hypot(x1 - x0, z1 - z0) / ((t1 - t0) / 1000)); }
let jerk = 0; for (let i = 1; i < sp.length; i++) jerk = Math.max(jerk, Math.abs(sp[i] - sp[i - 1]));
trace.peak = Math.max(...sp).toFixed(2); trace.maxJump = jerk.toFixed(3); trace.moved = Math.hypot(trace.rec.at(-1)[1] - trace.rec[0][1], trace.rec.at(-1)[2] - trace.rec[0][2]).toFixed(2);
await page.screenshot({ path: `${out}-1.png` });
console.log(JSON.stringify({ errors: logs.slice(0, 5), frames: trace.rec.length, input: trace.pressed, moved_m: trace.moved, peak_mps: trace.peak, max_speed_change_per_frame: trace.maxJump }));
await browser.close();
