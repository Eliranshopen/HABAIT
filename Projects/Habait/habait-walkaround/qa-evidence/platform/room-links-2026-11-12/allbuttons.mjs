// allbuttons.mjs <tour url> <out dir> [scene ...] — every room button of every room, at 1440 and 390: the view turned to it, it is the
// element under its own centre (not hidden, not under the controls, not covered), it does not overlap another room button, its
// label is the room's name, and a click / tap arrives in that room. Writes a shot of every NEW button (names in NEW) and a JSON report.
import fs from 'node:fs'; import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/RnD/Projects/Habait/tools/appdeps/package.json')('playwright-core');
const [base, out, ...only] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true }); const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NEW = new Set(['entrance>dining', 'dining>entrance', 'living>bathguest', 'terraceLiving>bedroomMain', 'terraceBedroom>bedroomMain', 'terraceBedroom>wardrobe', 'terraceBedroom>living', 'bedroomMain>terraceBedroom', 'bedroomMain>living', 'bedroomMain>terraceLiving', 'wardrobe>entrance', 'wardrobe>terraceBedroom']);
const ROOMS = ['entrance', 'kitchen', 'dining', 'living', 'terraceLiving', 'terraceBedroom', 'bedroomMain', 'wardrobe', 'bathMain', 'bedroom2', 'bathguest'].filter((r) => !only.length || only.includes(r));
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' }); const report = []; let bad = 0;
for (const S of [{ n: '1440', ctx: { viewport: { width: 1440, height: 900 } } }, { n: '390', ctx: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } }]) {
  const c = await b.newContext(S.ctx); const p = await c.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  for (const room of ROOMS) {
    const url = base + `?scope=apartment&room=${room}&floor=parquet&video=0&coach=0&auto=0`;
    await p.goto(url, { waitUntil: 'load' }); await p.waitForFunction(() => window.__tour && window.__tour.ready && window.__tour.viewer.isLoaded(), null, { timeout: 60000 }); await sleep(900);
    const list = await p.evaluate(() => (window.__tour.viewer.getConfig().hotSpots || []).filter((h) => h.type === 'scene' && h.createTooltipArgs && h.createTooltipArgs.to).map((h) => ({ to: h.createTooltipArgs.to, as: h.createTooltipArgs.nameAs || null, yaw: h.yaw, pitch: h.pitch })));
    for (const h of list) {
      if (h.to === 'terraceOut') continue;
      const key = room + '>' + (h.as || h.to);
      if (p.url() !== url || (await p.evaluate(() => window.__tour.scene)) !== room) { await p.goto(url, { waitUntil: 'load' }); await p.waitForFunction(() => window.__tour && window.__tour.ready && window.__tour.viewer.isLoaded(), null, { timeout: 60000 }); await sleep(700); }
      let r = null;
      for (let k = 0; k < 8 && !(r && r.hit); k++) {   // the visitor turns the picture until the button is clear of the controls
        await p.evaluate(([y, pt]) => window.__tour.viewer.lookAt(pt, y, undefined, false), [h.yaw + (k % 2 ? 1 : -1) * 4 * Math.ceil(k / 2), Math.max(-60, Math.min(40, h.pitch + (S.n === '390' ? 8 : 4) + k * 2))]); await sleep(450);
        r = await p.evaluate(([to, as]) => {
          const hs = (window.__tour.viewer.getConfig().hotSpots || []).filter((x) => x.type === 'scene' && x.div && x.createTooltipArgs);
          const me = hs.find((x) => x.createTooltipArgs.to === to && (x.createTooltipArgs.nameAs || null) === as); if (!me) return null;
          const q = me.div.getBoundingClientRect(), x = q.left + q.width / 2, y = q.top + q.height / 2, e = document.elementFromPoint(x, y);
          const over = hs.filter((o) => o !== me && getComputedStyle(o.div).visibility !== 'hidden' && getComputedStyle(o.div).display !== 'none').map((o) => ({ o, b: o.div.getBoundingClientRect() })).filter(({ b }) => b.width && !(b.right < q.left + 6 || b.left > q.right - 6 || b.bottom < q.top + 6 || b.top > q.bottom - 6)).map(({ o }) => o.createTooltipArgs.nameAs || o.createTooltipArgs.to);
          return { x, y, hit: Boolean(e && me.div.contains(e)), label: me.div.textContent.trim(), over, onScreen: x > 10 && x < innerWidth - 10 && y > 10 && y < innerHeight - 10 };
        }, [h.to, h.as]);
      }
      if (NEW.has(key)) await p.screenshot({ path: `${out}/${S.n}-${room}-to-${h.as || h.to}.png` });
      let at = null;
      if (r && r.hit) {
        if (S.n === '390') await p.touchscreen.tap(r.x, r.y); else await p.mouse.click(r.x, r.y);
        try { await p.waitForFunction((t) => window.__tour.scene === t && window.__tour.viewer.isLoaded(), h.to, { timeout: 12000 }); } catch { /* reported */ }
        at = await p.evaluate(() => window.__tour.scene);
      }
      const ok = Boolean(r && r.hit && at === h.to && !(r.over || []).length);
      if (!ok) bad++;
      report.push({ size: S.n, room, to: h.to, as: h.as, isNew: NEW.has(key), ok, hit: r && r.hit, label: r && r.label, overlaps: r && r.over, arrived: at });
      console.log(S.n, ok ? 'OK ' : 'BAD', key.padEnd(30), (r && r.label) || '-', r && r.over && r.over.length ? 'overlaps ' + r.over.join(',') : '', at !== h.to ? '→ ' + at : '', NEW.has(key) ? '(new)' : '');
    }
  }
  if (errs.length) { bad++; console.log(S.n, 'page errors:', errs.join(' | ')); }
  await c.close();
}
fs.writeFileSync(out + '/report.json', JSON.stringify(report, null, 1));
await b.close(); console.log(bad ? `ALL BUTTONS: ${bad} BAD` : 'ALL BUTTONS: PASS'); process.exit(bad ? 1 : 0);
