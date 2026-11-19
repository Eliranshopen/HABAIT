// debug: frame pacing while walking on the phone page — share of frames over 50 ms, the worst frame ($0)
import { createRequire } from 'node:module';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json');
const { chromium } = require('playwright-core');
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage();
await p.goto(process.argv[2]); await p.waitForFunction(() => window.__walk?.ready, null, { timeout: 120e3 });
await p.waitForTimeout(+(process.argv[3] || 40000));   // let the pieces load
const r = await p.evaluate(async () => {
  const w = window.__walk, ft = []; let last = performance.now(), t0 = last;
  w.press(1, 0.35);   // walk forward while turning slowly: new pieces come into view
  await new Promise((res) => { const f = (t) => { ft.push(t - last); last = t; if (t - t0 < 6000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  w.press(0, 0);
  ft.shift(); ft.sort((a, b) => a - b);
  return { frames: ft.length, fps: +(ft.length / 6).toFixed(1), median_ms: +ft[ft.length >> 1].toFixed(1), p95_ms: +ft[Math.floor(ft.length * 0.95)].toFixed(1), worst_ms: +ft.at(-1).toFixed(0),
    over50: ft.filter((x) => x > 50).length, pieces: window.__items?.live?.size, pixelRatio: w.pixelRatio ? w.pixelRatio() : w.renderer.getPixelRatio() };
});
console.log(process.argv[2], JSON.stringify(r));
await b.close();
