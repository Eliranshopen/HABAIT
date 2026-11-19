const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const fs = require('fs');
const BASE = 'https://habait-flow.vercel.app';
const OUT = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const out = {};
  for (const [name, vp, mobile] of [['desktop', { width: 1440, height: 900 }, false], ['m390', { width: 390, height: 844 }, true]]) {
    const b = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const ctx = await b.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1, locale: 'he-IL' });
    const p = await ctx.newPage();
    const reqs = [], errs = [], cons = [];
    p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
    p.on('console', (m) => { if (m.type() === 'error') cons.push(m.text().slice(0, 160)); });
    p.on('response', (r) => { const u = r.url(); if (/\.(jpe?g|webp|png|avif)(\?|$)/i.test(u) && /tour|aerial|pano/i.test(u)) reqs.push({ s: r.status(), ct: r.headers()['content-type'], u: u.slice(0, 150), t: Date.now() }); });
    await p.goto(`${BASE}/hold/`, { waitUntil: 'domcontentloaded' });
    await sleep(2500);
    await p.click('#clipSkip', { timeout: 8000 }).catch(() => {});
    for (let i = 0; i < 50; i++) { if (await p.evaluate(() => getComputedStyle(document.getElementById('buildingBtn')).display === 'block')) break; await sleep(500); }
    const mark = reqs.length;
    await p.click('#buildingBtn');
    let fr = null;
    for (let i = 0; i < 40 && !fr; i++) { const h = await p.$('#buildingFrame'); fr = h && (await h.contentFrame()); if (!fr) await sleep(250); }
    let scene = null;
    for (let i = 0; i < 80 && scene !== 'aerial'; i++) { scene = await fr.evaluate(() => window.__tour && window.__tour.scene).catch(() => null); await sleep(250); }
    await sleep(4000);
    const box = await (await p.$('#buildingFrame')).boundingBox();
    const shot = `${OUT}/${name}_paint.png`;
    await p.screenshot({ path: shot });
    // pixel stats on screenshot of the frame area
    const stats = await (async () => {
      const buf = await p.screenshot({ clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
      const pg = await ctx.newPage();
      const b64 = buf.toString('base64');
      const r = await pg.evaluate(async (d) => { const im = new Image(); im.src = 'data:image/png;base64,' + d; await im.decode(); const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 64, 64); const px = x.getImageData(0, 0, 64, 64).data; const set = new Set(); let sum = 0, sq = 0, n = 0; for (let i = 0; i < px.length; i += 4) { set.add((px[i] >> 3) + ',' + (px[i + 1] >> 3) + ',' + (px[i + 2] >> 3)); const l = .3 * px[i] + .59 * px[i + 1] + .11 * px[i + 2]; sum += l; sq += l * l; n++; } const m = sum / n; return { colors: set.size, mean: Math.round(m), sd: Math.round(Math.sqrt(sq / n - m * m)) }; }, b64);
      await pg.close(); return r;
    })();
    const inner = await fr.evaluate(() => { const c = document.querySelector('canvas'); const q = c && c.getBoundingClientRect(); return { scene: window.__tour.scene, canvas: !!c, w: q && Math.round(q.width), h: q && Math.round(q.height) }; }).catch((e) => String(e).slice(0, 100));
    out[name] = { scene, box, stats, inner, imgReqs: reqs.slice(mark), allImgCount: reqs.length, errs, cons };
    await b.close();
  }
  fs.writeFileSync(OUT + '/paint-proof.json', JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
})();
