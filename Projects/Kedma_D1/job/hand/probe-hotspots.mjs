// throwaway probe (kedma-d1, 2026-11-18): where are the room arrows, can a real click move rooms?
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appRequire } from '../../../pipeline/Habait/tour360/tools/app-require.mjs';
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(ROOT, '../../../pipeline/Habait');
const { chromium } = appRequire(REPO)('playwright-core');
const url = process.argv[2]; const out = process.argv[3];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
for (const [name, vp, touch] of [['desk', { width: 1440, height: 900 }, false], ['phone', { width: 390, height: 844 }, true]]) {
  const ctx = await b.newContext({ viewport: vp, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 2 : 1 });
  const p = await ctx.newPage();
  await p.goto(url + '/?lang=he', { waitUntil: 'load' });
  await p.waitForFunction(() => window.__tour && window.__tour.ready, null, { timeout: 60000 });
  await sleep(2500);
  const info = await p.evaluate(() => {
    const v = window.__tour.viewer; const cfg = v.getConfig();
    const hs = Array.from(document.querySelectorAll('.t-hs')).map((n) => {
      const r = n.getBoundingClientRect(); const cs = getComputedStyle(n);
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const hit = document.elementFromPoint(cx, cy);
      return { cls: n.className, label: (n.textContent || '').trim().slice(0, 30), cx: Math.round(cx), cy: Math.round(cy), w: r.width, vis: cs.visibility, disp: cs.display, hitsSelf: !!hit && n.contains(hit), hitEl: hit ? (hit.id || hit.className || hit.tagName) : null };
    });
    return { scene: window.__tour.scene, pitch: v.getPitch(), yaw: v.getYaw(), hfov: v.getHfov(), minPitch: cfg.minPitch, maxPitch: cfg.maxPitch, cfgHs: (cfg.hotSpots || []).map((h) => [h.type || '', h.pitch, h.yaw, h.text || h.sceneId || '']), hs };
  });
  await p.click('#t-coach-skip'); await sleep(800);
  if (touch) { await p.evaluate(() => { const v = window.__tour.viewer; const h = v.getConfig().hotSpots.find((x) => x.type === 'scene'); v.lookAt(h.pitch, h.yaw, v.getHfov(), false); }); await sleep(1000); }
  const pick = await p.evaluate(() => Array.from(document.querySelectorAll('.t-hs-floor')).map((n) => {
    const r = n.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    return { label: (n.textContent || '').trim().slice(0, 30), cx, cy, ok: !!hit && n.contains(hit) && getComputedStyle(n).visibility !== 'hidden' };
  }).filter((x) => x.ok)[0] || null);
  const before = await p.evaluate(() => window.__tour.scene);
  if (pick) { if (touch) await p.touchscreen.tap(pick.cx, pick.cy); else await p.mouse.click(pick.cx, pick.cy); }
  await sleep(4000);
  const after = await p.evaluate(() => window.__tour.scene);
  console.log(name, JSON.stringify({ firstScene: info.scene, tapped: pick && pick.label, before, after, moved: before !== after }));
  await p.screenshot({ path: `${out}/probe-${name}.png` });
  ctx.close();
}
await b.close();
