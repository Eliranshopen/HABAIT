#!/usr/bin/env node
/* The hold's chrome at the stop (the first screen after the landing's «לסיור בפרויקט»; rainbow-landing round 3, 2026-11-08). Headless
   Chrome on a STAGE at 360×780, 390×844, 430×932 (phones) and 1440×900: landing CTA → the film → the stop; then the bounding boxes of the
   top elements — «הדמיית הבניין והסביבה», the sound button, the picker title, the legend, «דירות», the hint, the legal line, the drag
   hint — must not intersect each other, must sit inside the viewport, must not cover a visible apartment pill; the legal line (the AI
   disclosure) must be visible; the drag hint must go after the first drag. Screenshots + hold-chrome.json into --out. $0.
   usage: node test/hold-chrome.check.mjs <stage> --out <dir> */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const stage = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--out');
const OUT = argv[argv.indexOf('--out') + 1];
if (!stage || argv.indexOf('--out') < 0) { console.error('usage: hold-chrome.check.mjs <stage> --out <dir>'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const APP = process.env.HABAIT_APP_DIR || 'C:/RnD/Projects/Habait/tools/appdeps';
const { chromium } = createRequire(path.join(APP, 'package.json'))('playwright-core');
const { serveStatic } = await import(pathToFileURL(path.join(HERE, '..', '..', 'tools', 'qa', 'responsive-gate.mjs')).href);
const rw = fs.existsSync(path.join(stage, 'vercel.json')) ? JSON.parse(fs.readFileSync(path.join(stage, 'vercel.json'), 'utf8')).rewrites : null;
const srv = serveStatic(path.resolve(stage), rw); await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--autoplay-policy=no-user-gesture-required'] });
const phone = (w, h) => ({ name: String(w), viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const SIZES = [phone(360, 780), phone(390, 844), phone(430, 932), { ...phone(844, 390), name: '390-landscape' }, { name: '1440', viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 }];
const sharp = createRequire(path.join(APP, 'package.json'))('sharp');
const res = { at: new Date().toISOString(), base, sizes: {}, fails: [] };
const fail = (s, m) => { res.fails.push(`${s}: ${m}`); console.log(`  FAIL ${s}: ${m}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TOP = { building: '#buildingBtn', sound: '#soundBtn', title: '#pickerStage .picker-title', legend: '#pickerStage .picker-legend', units: '#pickerStage .picker-units-btn', hint: '#pickerStage .picker-hint', legal: '#pickerStage .picker-disclaimer', drag: '#dragHint' };
const boxes = (page) => page.evaluate((TOP) => {
  const out = {};
  for (const [k, sel] of Object.entries(TOP)) {
    const e = document.querySelector(sel); if (!e) continue;
    const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
    let vis = cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0;
    for (let a = e.parentElement; a && vis; a = a.parentElement) if (getComputedStyle(a).display === 'none' || a.hidden) vis = false;
    if (k === 'drag' && !e.classList.contains('on')) vis = false;
    if (vis) out[k] = { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), r: Math.round(r.right), b: Math.round(r.bottom), opacity: cs.opacity };
  }
  const lg = document.querySelector('#pickerStage .picker-disclaimer');
  if (lg && out.legal) {
    const box = lg.getBoundingClientRect(); const rg = document.createRange(); rg.selectNodeContents(lg);
    const rs = [...rg.getClientRects()].filter((r) => r.width > 0 && r.bottom > box.top && r.top < box.bottom - 0.5);
    const vis = rs.filter((r) => r.bottom <= box.bottom + 1);
    if (vis.length) out.legal = { ...out.legal, x: Math.round(Math.min(...vis.map((r) => r.left))), y: Math.round(Math.min(...vis.map((r) => r.top))), r: Math.round(Math.max(...vis.map((r) => r.right))), b: Math.round(Math.max(...vis.map((r) => r.bottom))) };
    out.legal.lines = new Set(vis.map((r) => Math.round(r.top))).size;
    // the AI disclosure must be on a VISIBLE line: the words «בינה מלאכותית» inside the clamped box
    const t = lg.textContent; const i = t.indexOf('בינה מלאכותית');
    if (i >= 0) { const r2 = document.createRange(); r2.setStart(lg.firstChild, i); r2.setEnd(lg.firstChild, i + 'בינה מלאכותית'.length); const rr = r2.getBoundingClientRect(); out.legal.aiVisible = rr.width > 0 && rr.bottom <= box.bottom + 1 && rr.top >= box.top; }
    out.legal.cue = lg.dataset.more || '';
  }
  const pills = [...document.querySelectorAll('#pickerStage .hotspot')].filter((b) => getComputedStyle(b).display !== 'none').map((b) => { const r = b.getBoundingClientRect(); return { id: b.dataset.unit, x: r.left, y: r.top, r: r.right, b: r.bottom }; }).filter((p) => p.r > 0 && p.x < innerWidth && p.b > 0 && p.y < innerHeight);
  return { out, pills, W: innerWidth, H: innerHeight };
}, TOP);
const hit = (a, b) => Math.min(a.r, b.r) - Math.max(a.x, b.x) > 1 && Math.min(a.b, b.b) - Math.max(a.y, b.y) > 1;

for (const S of SIZES) {
  const R = res.sizes[S.name] = {}; console.log(`== ${S.name}`);
  const ctx = await browser.newContext({ ...S }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => /hold/.test(document.getElementById('heroCta').href));
  await Promise.all([page.waitForURL(/\/hold\//, { timeout: 20000 }), page.click('#heroCta')]);
  try { await page.waitForFunction(() => window.__orbit && window.__orbit.done, null, { timeout: 60000 }); } catch { fail(S.name, 'no stop'); }
  try { await page.waitForFunction(() => document.getElementById('dragHint').classList.contains('on'), null, { timeout: 8000 }); R.dragShown = true; } catch { R.dragShown = false; }
  await sleep(2600);
  const m = await boxes(page); R.boxes = m.out; R.pills = m.pills.map((p) => p.id);
  const keys = Object.keys(m.out);
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) if (hit(m.out[keys[i]], m.out[keys[j]])) fail(S.name, `${keys[i]} overlaps ${keys[j]} ${JSON.stringify([m.out[keys[i]], m.out[keys[j]]])}`);
  for (const k of keys) { const b = m.out[k]; if (b.x < -1 || b.r > m.W + 1 || b.y < -1 || b.b > m.H + 1) fail(S.name, `${k} leaves the viewport ${JSON.stringify(b)}`); }
  for (const k of keys) for (const p of m.pills) if (hit(m.out[k], p)) fail(S.name, `${k} covers pill ${p.id}`);
  // round 6 (Eliran 2026-11-09): phones show no title, «הדמיית הבניין והסביבה» as a 44 px icon in a right-edge column with «דירות» and a
  // vertical legend; desktop keeps the title and the labelled pill
  const o = m.out;
  if (S.isMobile) {
    if (o.title) fail(S.name, 'the title «מול החזית · בחרו דירה» still shows on a phone');
    if (o.hint) fail(S.name, 'the hint «לחצו על דירה» still shows on a phone');
    if (!o.building || o.building.w > 48 || o.building.h < 44 || o.building.x < m.W * 0.6) fail(S.name, 'the building button is not a ≥44 px icon on the right ' + JSON.stringify(o.building));
    if (!o.units || o.units.h < 44 || o.units.r < m.W - 24) fail(S.name, '«דירות» is not a ≥44 px target on the right edge ' + JSON.stringify(o.units));
    if (!o.legend || o.legend.r < m.W - 24 || o.legend.h < o.legend.w * 0.6) fail(S.name, 'the legend is not a vertical stack on the right edge ' + JSON.stringify(o.legend));
    R.buildingName = await page.evaluate(() => document.getElementById('buildingBtn').textContent.trim());
    if (!/הדמיית הבניין/.test(R.buildingName)) fail(S.name, 'the building icon lost its accessible name');
  } else {
    if (!o.title) fail(S.name, 'desktop lost the title');
    if (!o.building || o.building.w < 100) fail(S.name, 'desktop lost the labelled building pill ' + JSON.stringify(o.building));
  }
  if (!m.out.legal) fail(S.name, 'the legal line (AI disclosure) is not visible');
  else {
    if (!m.out.legal.aiVisible) fail(S.name, 'the AI words are not on a visible line of the legal text');
    if (m.out.legal.y < m.H * 0.75) fail(S.name, `the legal line is not at the bottom (top ${m.out.legal.y} of ${m.H})`);
    if (m.out.legal.lines > 3) fail(S.name, `the legal line takes ${m.out.legal.lines} lines`);
  }
  // contrast of the legal text at its worst pixel: glyph pixels = where the white text is drawn; their backdrop = the same frame with
  // the text made transparent (its shadow kept), and again without the shadow (the fade alone). WCAG ratio vs white (L = 1).
  if (m.out.legal) {
    const L = (r, g, b) => { const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const dpr = S.deviceScaleFactor; const bx = m.out.legal;
    const clip = { x: Math.max(0, bx.x - 2), y: Math.max(0, bx.y - 2), width: Math.min(m.W, bx.r + 2) - Math.max(0, bx.x - 2), height: Math.min(m.H, bx.b + 2) - Math.max(0, bx.y - 2) };
    await page.evaluate(() => { window.__orbit && (window.__orbit.frozen = true); document.documentElement.style.setProperty('--x', '1'); });
    const raw = async () => { const png = await page.screenshot({ clip, animations: 'disabled' }); return sharp(png).raw().toBuffer({ resolveWithObject: true }); };
    const setLegal = (css) => page.evaluate((c) => { const e = document.querySelector('#pickerStage .picker-disclaimer'); e.style.cssText = c; }, css);
    const A = await raw();
    await setLegal('color: transparent !important;'); const B = await raw();
    await setLegal('color: transparent !important; text-shadow: none !important;'); const C = await raw();
    await setLegal('');
    const ch = A.info.channels; let n = 0, worstB = 0, worstC = 0; const lb = [];
    for (let i = 0; i < A.data.length; i += ch) {
      const la = L(A.data[i], A.data[i + 1], A.data[i + 2]), lbv = L(B.data[i], B.data[i + 1], B.data[i + 2]), lc = L(C.data[i], C.data[i + 1], C.data[i + 2]);
      if (la - lbv > 0.35 && la > 0.6) { n++; lb.push(lbv); if (lbv > worstB) worstB = lbv; if (lc > worstC) worstC = lc; }
    }
    lb.sort((a, b) => a - b); const p95 = lb.length ? lb[Math.floor(lb.length * 0.95)] : 0;
    const ratio = (l) => +(1.05 / (l + 0.05)).toFixed(2);
    R.contrast = { glyphPixels: n, worstWithShadow: ratio(worstB), p95WithShadow: ratio(p95), worstFadeOnly: ratio(worstC) };
    if (!n) fail(S.name, 'contrast: no glyph pixels found');
    else if (R.contrast.worstWithShadow < 4.5) fail(S.name, `legal-line contrast ${R.contrast.worstWithShadow}:1 < 4.5:1 at its worst pixel`);
  }
  R.legalText = await page.evaluate(() => document.querySelector('#pickerStage .picker-disclaimer')?.textContent.slice(0, 80));
  await page.screenshot({ path: path.join(OUT, `h1-stop-${S.name}.png`) });
  // «פרטים»: a tap opens the full legal text (exact wording), a second tap closes it
  if (m.out.legal && m.out.legal.cue) {
    const full = await page.evaluate(() => document.querySelector('#pickerStage .picker-disclaimer').textContent);
    await page.click('#pickerStage .picker-disclaimer'); await sleep(400);
    R.legalOpen = await page.evaluate(() => { const e = document.querySelector('#pickerStage .picker-disclaimer'); return { open: e.classList.contains('open'), expanded: e.getAttribute('aria-expanded'), clipped: e.scrollHeight > e.clientHeight + 2, h: Math.round(e.getBoundingClientRect().height) }; });
    if (!R.legalOpen.open || R.legalOpen.clipped) fail(S.name, 'the legal line did not open in full ' + JSON.stringify(R.legalOpen));
    R.legalFullChars = full.length;
    await page.screenshot({ path: path.join(OUT, `h3-legal-open-${S.name}.png`) });
    await page.click('#pickerStage .picker-disclaimer'); await sleep(300);
    if (await page.evaluate(() => document.querySelector('#pickerStage .picker-disclaimer').classList.contains('open'))) fail(S.name, 'the legal line did not close');
  }
  // the first drag: the hint goes
  const cx = m.W / 2, cy = m.H * 0.55;
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx - 80, cy, { steps: 8 }); await page.mouse.up();
  if (S.hasTouch) { try { await page.touchscreen.tap(5, m.H - 5); } catch { /* not needed */ } }
  await sleep(1200);
  R.dragAfter = await page.evaluate(() => document.getElementById('dragHint').classList.contains('on'));
  if (R.dragShown && R.dragAfter) fail(S.name, 'the drag hint stays after the first drag');
  await page.screenshot({ path: path.join(OUT, `h2-after-drag-${S.name}.png`) });
  // the building button (an icon on phones) still opens the building film, and ✕ brings the hold back
  await page.click('#buildingBtn'); await sleep(1800);
  R.buildingOpens = await page.evaluate(() => { const f = document.getElementById('buildingFilm'); return f && getComputedStyle(f).display !== 'none'; });
  if (!R.buildingOpens) fail(S.name, 'the building button did not open the building film');
  await page.screenshot({ path: path.join(OUT, `h4-building-film-${S.name}.png`) });
  await page.click('#buildingClose').catch(() => {}); await sleep(900);
  R.buildingClosed = await page.evaluate(() => getComputedStyle(document.getElementById('buildingFilm')).display === 'none');
  R.errors = errors; if (errors.length) fail(S.name, 'page errors: ' + errors.join(' | '));
  await ctx.close();
}
await browser.close(); srv.close();
res.pass = res.fails.length === 0;
fs.writeFileSync(path.join(OUT, 'hold-chrome.json'), JSON.stringify(res, null, 1));
console.log(res.pass ? `PASS · ${OUT}` : `FAIL · ${res.fails.length} · ${OUT}`);
process.exit(res.pass ? 0 : 1);
