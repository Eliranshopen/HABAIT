// Real-browser QA shots of a Day/Night viewer folder (one Chrome, SwiftShader WebGL).
// node shots.mjs <outDir> <baseUrl>
// Reads <baseUrl>/scene.json; for the first node it takes the FIRST and the LAST adjacent keyframe pairs and shoots
// each pair's two hours and their midpoint (canvas only, same view) -> pairs.json for analyse.py; plus product
// shots at 1440x900 and 390x844 (console errors and horizontal overflow on both edges fail the run).
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'C:/RnD/Projects/3Dengine/appdeps/node_modules/playwright-core');
const [out, base] = process.argv.slice(2);
const scene = await (await fetch(`${base}/scene.json`)).json();
const node = scene.nodes[0];
const k = node.keyframes.slice().sort((a, b) => a.hour - b.hour);
if (k.length < 2) { console.log('need >= 2 keyframes'); process.exit(1); }
const pairList = [[k[0], k[1]], [k[k.length - 2], k[k.length - 1]]];
const pairs = []; const SHOTS = [];
const yaw = node.yaw ?? 0, pitch = node.pitch ?? 0;
for (const [a, b] of pairList) {
  const m = +((a.hour + b.hour) / 2).toFixed(3);
  pairs.push({ a: `raw_h${a.hour}`, mid: `raw_h${m}`, b: `raw_h${b.hour}` });
  for (const h of [a.hour, m, b.hour]) SHOTS.push({ n: `raw_h${h}`, w: 1440, h: 900, q: `ui=0&hour=${h}&yaw=${yaw}&pitch=${pitch}` });
}
const mid = (k[0].hour + k[k.length - 1].hour) / 2;
SHOTS.push({ n: 'desk_mid', w: 1440, h: 900, q: `hour=${mid}` }, { n: 'desk_last', w: 1440, h: 900, q: `hour=${k[k.length - 1].hour}` },
  { n: 'phone_mid', w: 390, h: 844, q: `hour=${mid}`, mobile: true }, { n: 'phone_last', w: 390, h: 844, q: `hour=${k[k.length - 1].hour}`, mobile: true });
writeFileSync(`${out}/pairs.json`, JSON.stringify(pairs, null, 1));
const browser = await chromium.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let fail = 0; const seen = new Set();
for (const s of SHOTS) {
  if (seen.has(s.n)) continue; seen.add(s.n);
  const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1, isMobile: !!s.mobile, hasTouch: !!s.mobile });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`${base}/index.html?${s.q}`);
  try {
    await page.waitForSelector('body[data-ready="1"]', { timeout: 30000 });
    await page.waitForTimeout(400);
    const ovf = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect();
      return getComputedStyle(e).display !== 'none' && r.width > 0 && (r.right > innerWidth + 1 || r.left < -1) && !e.closest('#tabs') && !e.closest('#hotspots'); }).map((e) => e.id || e.className || e.tagName));
    await page.screenshot({ path: `${out}/${s.n}.png` });
    console.log(`shot ${s.n} ok`, ovf.length ? `OVERFLOW ${ovf.join(',')}` : 'no-overflow', errs.length ? `ERRORS ${errs.join(' | ')}` : '');
    if (errs.length || ovf.length) fail = 1;
  } catch (e) { console.log(`shot ${s.n} FAILED ${e.message} ${errs.join(' | ')}`); fail = 1; }
  await ctx.close();
}
await browser.close();
process.exit(fail);
