#!/usr/bin/env node
/* The hold's stop on a PHONE (hold-phone, 2026-11-09; Eliran: the phone stop «לא נראה טוב, צריך לתקן»). Headless Chrome on a STAGE at
   375×667, 390×844, 430×932 (portrait, touch) and 1440×900 (desktop must stay as before): landing CTA → the film → the stop. Phones:
     - the framing comes from the tower's projected bounds (window.__hold.framing): the tower's right edge left of the right-edge column
       (72 px), the tower over ≥ 70 % of the width, ≤ 22 % of it (the left flank, no pills) off-screen, a floor ≥ 33 px; every visible pill lies
       inside the sharp frame and inside the screen;
     - the pills are small (drawn ≤ 26 px tall) and each keeps a 44×44 px hit area (the 9 points of a 44 px square land on it);
     - the legal line is ONE line; the drag hint (a toast) is in the lower air, clear of the right column and of every pill;
     - 846's card: one primary button «כניסה לדירה»; it goes to the apartment journey; the floor glows while the card is open.
   The air above the framed tower holds no picture (a smooth gradient; at rest and mid-drag — 2026-11-10, the iPhone ghost tower).
   Desktop: the framing is the plain cover (settle 0 effect: the frame fills the screen) and the button still reads «המשיכו אל הדירה».
   Screenshots + hold-phone.json into --out. $0. usage: node test/hold-phone.check.mjs <stage> --out <dir> */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const stage = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--out');
const OUT = argv[argv.indexOf('--out') + 1];
if (!stage || argv.indexOf('--out') < 0) { console.error('usage: hold-phone.check.mjs <stage> --out <dir>'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const APP = process.env.HABAIT_APP_DIR || 'C:/RnD/Projects/Habait/tools/appdeps';
const { chromium } = createRequire(path.join(APP, 'package.json'))('playwright-core');
const { serveStatic } = await import(pathToFileURL(path.join(HERE, '..', '..', 'tools', 'qa', 'responsive-gate.mjs')).href);
const rw = fs.existsSync(path.join(stage, 'vercel.json')) ? JSON.parse(fs.readFileSync(path.join(stage, 'vercel.json'), 'utf8')).rewrites : null;
const srv = serveStatic(path.resolve(stage), rw); await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--autoplay-policy=no-user-gesture-required'] });
const phone = (w, h) => ({ name: String(w), viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const SIZES = [phone(375, 667), phone(390, 844), phone(430, 932), { name: '1440', viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 }];
const res = { at: new Date().toISOString(), base, sizes: {}, fails: [] };
const fail = (s, m) => { res.fails.push(`${s}: ${m}`); console.log(`  FAIL ${s}: ${m}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sharp = createRequire(path.join(APP, 'package.json'))('sharp');
// 2026-11-10 (Eliran, iPhone: a larger translucent copy of the tower over the sharp one while dragging): the air ABOVE the framed tower must
// hold no picture — a smooth gradient. Measured on the band from the top of the screen to 4 px above the frame, left of the right column:
// every row's luminance spread (p95 − p5) must stay small; a copy of the tower there (sharp or not) would show as a large spread.
async function airSpread(page, f, W) {
  const top = 0, bottom = Math.floor(f.OY) - 4; if (bottom - top < 16) return null;
  const png = await page.screenshot({ clip: { x: 8, y: top, width: W - 88, height: bottom - top } });
  const { data, info } = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true });
  let worst = 0;
  for (let y = 0; y < info.height; y += 2) {
    const row = []; for (let x = 0; x < info.width; x++) row.push(data[y * info.width + x]); row.sort((a, b) => a - b);
    worst = Math.max(worst, row[Math.floor(row.length * 0.95)] - row[Math.floor(row.length * 0.05)]);
  }
  return worst;
}
for (const S of SIZES) {
  const R = res.sizes[S.name] = {}; console.log(`== ${S.name}`);
  const ctx = await browser.newContext({ ...S }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => /hold/.test(document.getElementById('heroCta').href));
  await Promise.all([page.waitForURL(/\/hold\//, { timeout: 20000 }), page.click('#heroCta')]);
  try { await page.waitForFunction(() => window.__orbit && window.__orbit.done, null, { timeout: 100000 }); } catch { fail(S.name, 'no stop'); }
  try { await page.waitForFunction(() => document.getElementById('dragHint').classList.contains('on'), null, { timeout: 8000 }); } catch { /* measured below */ }
  await sleep(2000);
  const m = await page.evaluate(() => {
    const W = innerWidth, H = innerHeight, f = window.__hold && window.__hold.framing;
    const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return cs.display === 'none' || !r.width ? null : { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
    const pills = [...document.querySelectorAll('#pickerStage .hotspot')].filter((b) => getComputedStyle(b).display !== 'none').map((b) => { const r = b.getBoundingClientRect(); return { id: b.dataset.unit, x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; });
    // the 44 px hit test of each pill (as the responsive gate: 9 points of a 44 px square on its centre land on it or on a neighbour's invisible margin)
    const hit = pills.map((p) => { const el = document.querySelector(`#pickerStage .hotspot[data-unit="${p.id}"]`); const cx = (p.x + p.r) / 2, cy = (p.y + p.b) / 2; let ok = 0;
      for (const dx of [-21, 0, 21]) for (const dy of [-21, 0, 21]) { const h = document.elementFromPoint(cx + dx, cy + dy); const t = h && h.closest('#pickerStage .hotspot'); if (t === el || (t && (() => { const q = t.getBoundingClientRect(); return cx + dx < q.left || cx + dx > q.right || cy + dy < q.top || cy + dy > q.bottom; })())) ok++; }
      return { id: p.id, ok }; });
    const lg = document.querySelector('#pickerStage .picker-disclaimer'); let lines = 0;
    if (lg) { const b = lg.getBoundingClientRect(); const rg = document.createRange(); rg.selectNodeContents(lg); lines = new Set([...rg.getClientRects()].filter((r) => r.width > 0 && r.bottom <= b.bottom + 1 && r.top >= b.top - 1).map((r) => Math.round(r.top))).size; }
    return { W, H, f, pills, hit, lines, drag: document.getElementById('dragHint').classList.contains('on') ? box('#dragHint') : null,
      col: ['#soundBtn', '#buildingBtn', '#pickerStage .picker-units-btn', '#pickerStage .picker-legend'].map(box).filter(Boolean) };
  });
  R.framing = m.f; R.pills = m.pills.map((p) => p.id); R.legalLines = m.lines; R.drag = m.drag;
  await page.screenshot({ path: path.join(OUT, `p1-stop-${S.name}.png`) });
  if (S.isMobile && m.f && m.f.portrait) {   // the air holds no picture, at rest and mid-drag
    R.airRest = await airSpread(page, m.f, m.W);
    const cx = m.W / 2, cy = m.H * 0.45; await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx - 70, cy, { steps: 6 }); await sleep(300);
    const fd = await page.evaluate(() => window.__hold && window.__hold.framing); R.airDrag = fd ? await airSpread(page, fd, m.W) : null;
    await page.screenshot({ path: path.join(OUT, `p1b-drag-${S.name}.png`) });
    await page.mouse.up(); await sleep(1500);
    for (const [k, v] of [['rest', R.airRest], ['drag', R.airDrag]]) if (v != null && v > 24) fail(S.name, `the air above the tower holds a picture (${k}: row spread ${v} > 24) — a copy of the view?`);
  }
  if (S.isMobile) {
    const f = m.f; if (!f || !f.portrait || f.settle < 0.99) fail(S.name, 'no settled portrait framing ' + JSON.stringify(f));
    else {
      const bx0 = f.OX + (f.box[0] + 1) / 2 * f.W * f.S, bx1 = f.OX + (f.box[1] + 1) / 2 * f.W * f.S;
      R.towerPx = [Math.round(bx0), Math.round(bx1)];
      // the tower's right edge (the pills' side) stands left of the 72 px column; it spans most of the screen; at most a fifth of the
      // tower (its left flank, no pills) may run off the screen when the floor-pitch rule (≥ 33 px a floor) wins
      if (bx1 > m.W - 64) fail(S.name, `the tower's right edge ${Math.round(bx1)} runs under the column`);
      if (Math.min(bx1, m.W) - Math.max(bx0, 0) < m.W * 0.7) fail(S.name, `the tower fills only ${Math.round(Math.min(bx1, m.W) - Math.max(bx0, 0))} px of ${m.W}`);
      // 22 %: on a 375 px phone the 33 px floor (clean 44 px hit areas one floor apart, the gate's target rule) wins over the flank (20.5 %)
      if (bx0 < -(bx1 - bx0) * 0.22) fail(S.name, `more than 22 % of the tower runs off the screen: ${R.towerPx}`);
      R.floorPx = +(f.S * f.H * 0.0636).toFixed(1); if (R.floorPx < 32.5) fail(S.name, `a floor is ${R.floorPx} px on screen (< 33)`);
      for (const p of m.pills) if (p.y < f.OY || p.b > f.OY + f.H * f.S || p.x < 0 || p.r > m.W) fail(S.name, `pill ${p.id} outside the frame/screen`);
    }
    for (const p of m.pills) if (p.h > 26) fail(S.name, `pill ${p.id} is ${Math.round(p.h)} px tall (small pills: ≤ 26)`);
    for (const h of m.hit) if (h.ok < 9) fail(S.name, `pill ${h.id}: ${h.ok}/9 points of its 44 px hit area`);
    if (m.lines !== 1) fail(S.name, `the legal line takes ${m.lines} lines (one)`);
    if (m.drag) {
      if (m.drag.y < m.H * 0.6) fail(S.name, 'the drag hint is not in the lower air');
      for (const c of m.col) if (Math.min(c.r, m.drag.r) - Math.max(c.x, m.drag.x) > 1 && Math.min(c.b, m.drag.b) - Math.max(c.y, m.drag.y) > 1) fail(S.name, 'the drag hint overlaps the right column');
      for (const p of m.pills) if (Math.min(p.r, m.drag.r) - Math.max(p.x, m.drag.x) > 1 && Math.min(p.b, m.drag.b) - Math.max(p.y, m.drag.y) > 1) fail(S.name, `the drag hint covers pill ${p.id}`);
    }
    for (const c of m.col) if (R.towerPx && c.x < R.towerPx[1] - 2 && c.y > (f ? f.OY + f.H * f.S * 0.12 : 0)) fail(S.name, 'a right-column control stands on the facade');
  } else if (m.f && m.f.portrait) fail(S.name, 'desktop got the portrait framing');
  // 846's card
  await page.evaluate(() => document.querySelector('#pickerStage .hotspot[data-unit="846"]').click()); await sleep(900);
  R.card = await page.evaluate(() => { const b = document.getElementById('unitContinue'); const s = document.getElementById('unitSheet'); const r = s.getBoundingClientRect();
    return { label: b && b.textContent.trim(), primaries: s.querySelectorAll('.btn-primary').length, sheetTop: Math.round(r.top), glow: window.__glow ? window.__glow.on : null, prices: /₪|מחיר/.test(s.innerText) }; });
  await page.screenshot({ path: path.join(OUT, `p2-card846-${S.name}.png`) });
  const want = S.isMobile ? 'כניסה לדירה' : 'המשיכו אל הדירה';
  if (R.card.label !== want) fail(S.name, `846's button reads «${R.card.label}», not «${want}»`);
  if (R.card.primaries !== 1) fail(S.name, `${R.card.primaries} primary buttons in the card (one)`);
  if (!R.card.glow) fail(S.name, 'the chosen floor does not glow');
  if (R.card.prices) fail(S.name, 'a price shows in the card');
  // another unit: its floor glows too, its card keeps its own action
  const other = m.pills.find((p) => p.id !== '846');
  if (other) { await page.click('#unitClose').catch(() => {}); await sleep(300); await page.evaluate((id) => document.querySelector(`#pickerStage .hotspot[data-unit="${id}"]`).click(), other.id); await sleep(700);
    R.other = await page.evaluate(() => ({ glow: window.__glow ? window.__glow.on : null, label: document.getElementById('unitContinue')?.textContent.trim() }));
    if (!R.other.glow) fail(S.name, `${other.id}'s floor does not glow`); if (R.other.label === 'כניסה לדירה') fail(S.name, `${other.id} took 846's label`);
    await page.click('#unitClose').catch(() => {}); await sleep(300); await page.evaluate(() => document.querySelector('#pickerStage .hotspot[data-unit="846"]').click()); await sleep(700); }
  // the one button goes to the journey
  // (round 4: the journey plays in a frame over the hold)
  await page.click('#unitContinue');
  try { await page.waitForFunction(() => { const f = document.getElementById('journeyFrame'); return f && /\/apartment-journey\//.test(f.src); }, null, { timeout: 8000 }); } catch { fail(S.name, 'the CTA did not open the journey'); }
  R.after = await page.evaluate(() => { const f = document.getElementById('journeyFrame'); return f ? f.src.replace(location.origin, '').slice(0, 60) : null; });
  R.errors = errors; if (errors.length) fail(S.name, 'page errors: ' + errors.join(' | '));
  await ctx.close();
}
await browser.close(); srv.close();
res.pass = res.fails.length === 0;
fs.writeFileSync(path.join(OUT, 'hold-phone.json'), JSON.stringify(res, null, 1));
console.log(res.pass ? `PASS · ${OUT}` : `FAIL · ${res.fails.length} · ${OUT}`);
process.exit(res.pass ? 0 : 1);
