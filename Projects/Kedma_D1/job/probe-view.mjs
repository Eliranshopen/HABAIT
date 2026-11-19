// kedma-d1 QA ($0): what the viewer itself says it is showing for one room — the panorama file it loaded and the yaw, pitch and
// field of view of the first look — so a flat render of the same file at the same numbers can be put next to the browser's picture.
// usage: node probe-view.mjs <base url ending in /p/kedma-d1/tour/> <room> <out.png>
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(path.join(process.env.HABAIT_APP_DIR, 'package.json'));
const { chromium } = require('playwright-core');
const [base, room, out] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, locale: 'he-IL' });
  const page = await ctx.newPage();
  const panos = [];
  page.on('response', (r) => { const u = r.url(); if (/panos|\.webp|\.jpg/.test(u) && /bath|shower|living|master|family|pantry|balcony|kitchen|\d\d-/.test(u)) panos.push(r.status() + ' ' + u.replace(base, '') + ' ' + (r.headers()['content-length'] || '?')); });
  await page.goto(`${base}?room=${room}&coach=0`, { waitUntil: 'load' }); await page.waitForTimeout(5000);
  const state = await page.evaluate(() => {
    const t = window.__tour || {}; const v = t.viewer || window.viewer || (window.pannellum && window.pannellum.__viewer) || null;
    const g = (f) => { try { return v && typeof v[f] === 'function' ? v[f]() : null; } catch (e) { return 'err ' + e; } };
    return { scene: t.scene, tourKeys: Object.keys(t).slice(0, 40), hasViewer: !!v, yaw: g('getYaw'), pitch: g('getPitch'), hfov: g('getHfov'), northOffset: g('getNorthOffset'),
      config: (() => { try { const c = v && v.getConfig && v.getConfig(); return c ? { panorama: c.panorama, type: c.type, haov: c.haov, vaov: c.vaov, vOffset: c.vOffset, minHfov: c.minHfov, maxHfov: c.maxHfov, hfov: c.hfov, yaw: c.yaw, pitch: c.pitch } : null; } catch (e) { return 'err ' + e; } })(),
      canvas: (() => { const c = document.querySelector('canvas'); return c ? [c.width, c.height, c.clientWidth, c.clientHeight] : null; })() };
  });
  await page.screenshot({ path: out });
  console.log(JSON.stringify(state, null, 1)); console.log('requests:\n' + panos.slice(0, 12).join('\n'));
} finally { await browser.close(); }
