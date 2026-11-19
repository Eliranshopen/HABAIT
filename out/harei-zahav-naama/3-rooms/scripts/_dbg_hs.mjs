// debug ($0): the door markers of the live 360 — which are in view, what covers their centre; then a real tap on one
import { createRequire } from 'node:module';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json');
const { chromium } = require('playwright-core');
const [url, phone] = [process.argv[2], process.argv.includes('--phone')];
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] });
const ctx = await b.newContext(phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(6000);
const skip = p.getByRole('button', { name: 'דלג' }); if (await skip.count()) { if (phone) await skip.first().tap(); else await skip.first().click(); await p.waitForTimeout(800); console.log('skipped the coach'); }
const hs = await p.evaluate(() => Array.from(document.querySelectorAll('.t-hs')).map((n) => {
  const r = n.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const hit = r.width ? document.elementFromPoint(cx, cy) : null;
  return { label: (n.querySelector('.t-hs-label')?.textContent || '').trim(), cx: Math.round(cx), cy: Math.round(cy), w: Math.round(r.width), h: Math.round(r.height),
    vis: getComputedStyle(n).visibility, hitsSelf: !!hit && n.contains(hit), coveredBy: hit && !n.contains(hit) ? (hit.className || hit.tagName).toString().slice(0, 60) : null };
}));
console.log(JSON.stringify(hs));
const scene0 = await p.evaluate(() => window.__tour?.viewer?.getScene?.());
const t = hs.find((h) => h.w && h.cx > 20 && h.cy > 20);
if (t) { if (phone) await p.touchscreen.tap(t.cx, t.cy); else await p.mouse.click(t.cx, t.cy); await p.waitForTimeout(3000); }
console.log('tapped', t?.label, 'scene', scene0, '->', await p.evaluate(() => window.__tour?.viewer?.getScene?.()));
await b.close();
