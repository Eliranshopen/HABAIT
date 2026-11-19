// allbuttons.mjs <tour url> <out dir> [room ...] — every room button of every room, at 1440 and 390 (2026-11-12, made general 2026-11-15
// for the Pi wrapper): the view is turned to the button; it must be the element under its own centre (not hidden, not under the
// controls, not covered), overlap no other room button, and a click / tap must arrive in its room. Rooms come from the page's own
// #tour-data (every non-exterior scene) unless given. Writes report.json; ends `ALL BUTTONS: PASS` (exit 0) or `n BAD` (exit 1).
import fs from 'node:fs'; import { createRequire } from 'node:module';
const { chromium } = createRequire((process.env.HABAIT_APP_DIR || 'C:/RnD/Projects/Habait/tools/appdeps') + '/package.json')('playwright-core');
const [base, out, ...only] = process.argv.slice(2);
if (!base || !out) { console.error('usage: allbuttons.mjs <tour url> <out dir> [room ...]'); process.exit(2); }
fs.mkdirSync(out, { recursive: true }); const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' }); const report = []; let bad = 0;
const open = async (p, url) => { await p.goto(url, { waitUntil: 'load' }); await p.waitForFunction(() => window.__tour && window.__tour.ready && window.__tour.viewer.isLoaded(), null, { timeout: 60000 }); await sleep(800); };
for (const S of [{ n: '1440', ctx: { viewport: { width: 1440, height: 900 } } }, { n: '390', ctx: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } }]) {
  const c = await b.newContext(S.ctx); const p = await c.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await open(p, base + '?scope=apartment&video=0&coach=0&auto=0');
  const rooms = only.length ? only : await p.evaluate(() => JSON.parse(document.getElementById('tour-data').textContent).scenes.filter((s) => !s.exterior).map((s) => s.id));
  for (const room of rooms) {
    const url = base + `?scope=apartment&room=${room}&floor=parquet&video=0&coach=0&auto=0`;
    await open(p, url);
    const list = await p.evaluate(() => (window.__tour.viewer.getConfig().hotSpots || []).filter((h) => h.type === 'scene' && h.createTooltipArgs && h.createTooltipArgs.to).map((h) => ({ to: h.createTooltipArgs.to, as: h.createTooltipArgs.nameAs || null, yaw: h.yaw, pitch: h.pitch })));
    for (const h of list) {
      if (h.to === 'terraceOut') continue;
      if ((await p.evaluate(() => window.__tour.scene)) !== room) await open(p, url);
      let r = null;
      for (let k = 0; k < 8 && !(r && r.hit); k++) {   // the visitor turns the picture until the button is clear of the controls
        await p.evaluate(([y, pt]) => window.__tour.viewer.lookAt(pt, y, undefined, false), [h.yaw + (k % 2 ? 1 : -1) * 4 * Math.ceil(k / 2), Math.max(-60, Math.min(40, h.pitch + (S.n === '390' ? 8 : 4) + k * 2))]); await sleep(450);
        r = await p.evaluate(([to, as]) => {
          const hs = (window.__tour.viewer.getConfig().hotSpots || []).filter((x) => x.type === 'scene' && x.div && x.createTooltipArgs);
          const me = hs.find((x) => x.createTooltipArgs.to === to && (x.createTooltipArgs.nameAs || null) === as); if (!me) return null;
          const q = me.div.getBoundingClientRect(), x = q.left + q.width / 2, y = q.top + q.height / 2, e = document.elementFromPoint(x, y);
          const over = hs.filter((o) => o !== me && getComputedStyle(o.div).visibility !== 'hidden' && getComputedStyle(o.div).display !== 'none').map((o) => ({ o, b: o.div.getBoundingClientRect() })).filter(({ b }) => b.width && !(b.right < q.left + 6 || b.left > q.right - 6 || b.bottom < q.top + 6 || b.top > q.bottom - 6)).map(({ o }) => o.createTooltipArgs.nameAs || o.createTooltipArgs.to);
          return { x, y, hit: Boolean(e && me.div.contains(e)), label: me.div.textContent.trim(), over };
        }, [h.to, h.as]);
      }
      let at = null;
      if (r && r.hit) {
        if (S.n === '390') await p.touchscreen.tap(r.x, r.y); else await p.mouse.click(r.x, r.y);
        try { await p.waitForFunction((t) => window.__tour.scene === t && window.__tour.viewer.isLoaded(), h.to, { timeout: 12000 }); } catch { /* reported */ }
        at = await p.evaluate(() => window.__tour.scene);
      }
      const ok = Boolean(r && r.hit && at === h.to && !(r.over || []).length); if (!ok) bad++;
      report.push({ size: S.n, room, to: h.to, as: h.as, ok, hit: r && r.hit, label: r && r.label, overlaps: r && r.over, arrived: at });
      console.log(S.n, ok ? 'OK ' : 'BAD', (room + '>' + (h.as || h.to)).padEnd(30), (r && r.label) || '-', r && r.over && r.over.length ? 'overlaps ' + r.over.join(',') : '', at !== h.to ? '-> ' + at : '');
    }
  }
  if (errs.length) { bad++; console.log(S.n, 'page errors:', errs.join(' | ')); }
  await c.close();
}
fs.writeFileSync(out + '/report.json', JSON.stringify(report, null, 1));
await b.close(); console.log(bad ? `ALL BUTTONS: ${bad} BAD` : 'ALL BUTTONS: PASS'); process.exit(bad ? 1 : 0);
