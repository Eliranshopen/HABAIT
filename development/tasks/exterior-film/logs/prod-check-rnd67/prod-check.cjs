// rnd-67 prod check 2026-11-04: habait-flow serves the building film (c7a3677) and the הדמיה badge (7b6f617). Desktop + 390 px.
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const OUT = process.argv[2];
const BASE = 'https://habait-flow.vercel.app';
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--autoplay-policy=no-user-gesture-required'] });
  const rows = [];
  for (const [name, vp] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errors = [], bad = [];
    page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 120)));
    page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('favicon')) bad.push(r.status() + ' ' + r.url().slice(0, 100)); });
    // 1. the hold: the building button plays the film
    await page.goto(BASE + '/hold/?skip=1', { waitUntil: 'load', timeout: 90000 });
    await page.waitForTimeout(6000);
    const filmEl = await page.$('#buildingFilm');
    const btn = await page.$('#buildingBtn');
    let playing = null, t = null, src = null;
    if (btn) {
      await page.evaluate(() => { const b = document.getElementById('buildingBtn'); b.style.display = ''; b.click(); });
      await page.waitForTimeout(7000);
      ({ t, src } = await page.evaluate(() => { const v = window.__building && window.__building.video; return { t: v ? v.currentTime : null, src: v ? (v.currentSrc || '') : '' }; }));
      playing = t != null && t > 1;
    }
    await page.screenshot({ path: `${OUT}/prod-hold-film-${name}.png` });
    // 2. the tour in the buyer flow (ui=min): the הדמיה badge is shown
    await page.goto(BASE + '/tour/?scope=apartment&from=flight&ui=min', { waitUntil: 'load', timeout: 90000 });
    await page.waitForTimeout(6000);
    const badge = await page.evaluate(() => {
      const els = [...document.querySelectorAll('body *')].filter((e) => e.children.length === 0 && /הדמיה/.test(e.textContent || ''));
      const vis = els.filter((e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0; });
      return { found: els.length, visible: vis.length, text: vis[0] ? vis[0].textContent.trim().slice(0, 60) : '' };
    });
    await page.screenshot({ path: `${OUT}/prod-tour-badge-${name}.png` });
    rows.push({ name, filmElement: !!filmEl, buildingBtn: !!btn, filmPlaying: playing, filmTime: t, filmSrc: (src || '').replace(BASE, ''), badge, pageErrors: errors, bad4xx5xx: bad });
    await ctx.close();
  }
  await browser.close();
  const ok = rows.every((r) => r.filmElement && r.filmPlaying && r.badge.visible > 0 && r.pageErrors.length === 0);
  require('fs').writeFileSync(`${OUT}/prod-check.json`, JSON.stringify({ when: new Date().toISOString(), base: BASE, ok, rows }, null, 1));
  console.log(JSON.stringify(rows, null, 1));
  console.log(ok ? 'PROD CHECK PASS' : 'PROD CHECK FAIL');
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
