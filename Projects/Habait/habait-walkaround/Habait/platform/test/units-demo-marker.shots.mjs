#!/usr/bin/env node
/* The «נתוני הדגמה» badge (Eliran 2026-11-10: «להשאיר כהדגמה עם סימון» — only 846 has sales-plan data; every other Rainbow unit keeps
   its demo numbers, marked). Headless Chrome on a STAGE at 390×844 (phone, touch) and 1440×900: wherever a unit's rooms / area / terrace
   render, a unit with units.json `source: "demo"` shows the badge next to the numbers and 846 (`sales-plan`) shows nothing extra:
     /apartment.html?project=rainbow&unit=845 (hero chip #aptDemo + the «אודות» row) vs unit=846 (hidden) ·
     /landing.html?project=rainbow (facts title of 846: no chip; availability rows: 11 chips) ·
     /hold/ via the landing CTA: the card of 856 (badge under the facts), the card of 846 (none), the «דירות» drawer (11 badges),
     the pills' sub-line (desktop: 11 marks; a phone hides .sub except on the selected pill).
   Also: the badge is never a tap target (no button/link), the sheet does not scroll sideways, «המשיכו אל הדירה»/«כניסה לדירה» keeps ≥ 44 px,
   no price text anywhere the badge is. Screenshots + units-demo-marker.json into --out. $0.
   usage: node test/units-demo-marker.shots.mjs <stage> --out <dir> */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const stage = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--out');
const OUT = argv[argv.indexOf('--out') + 1];
if (!stage || argv.indexOf('--out') < 0) { console.error('usage: units-demo-marker.shots.mjs <stage> --out <dir>'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const APP = process.env.HABAIT_APP_DIR || 'C:/RnD/Projects/Habait/tools/appdeps';
const { chromium } = createRequire(path.join(APP, 'package.json'))('playwright-core');
const { serveStatic } = await import(pathToFileURL(path.join(HERE, '..', '..', 'tools', 'qa', 'responsive-gate.mjs')).href);
const rw = fs.existsSync(path.join(stage, 'vercel.json')) ? JSON.parse(fs.readFileSync(path.join(stage, 'vercel.json'), 'utf8')).rewrites : null;
const srv = serveStatic(path.resolve(stage), rw); await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--autoplay-policy=no-user-gesture-required'] });
const SIZES = [
  { name: '390', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: '1440', viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
];
const BADGE = 'נתוני הדגמה';
const PRICE = /₪|\bILS\b|\b\d{1,3}(?:,\d{3}){2,}\b|מחיר|\bPrice\b/;
const res = { at: new Date().toISOString(), base, sizes: {}, fails: [] };
const fail = (s, m) => { res.fails.push(`${s}: ${m}`); console.log(`  FAIL ${s}: ${m}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });
// every badge/chip: visible, says the words, is not interactive on its own, sits inside its container
const badges = (page, sel) => page.evaluate(([s, words]) => [...document.querySelectorAll(s)].map((e) => {
  const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
  return { text: e.textContent.trim(), visible: cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0 && !e.closest('[hidden]'),
    says: e.textContent.includes(words), h: Math.round(r.height), w: Math.round(r.width), x: Math.round(r.left), y: Math.round(r.top),
    interactive: !!(e.closest('a,button') && e.closest('a,button') !== e.closest('.unit-row,.hotspot,.avail-row')) || ['A', 'BUTTON'].includes(e.tagName) || e.hasAttribute('onclick') };
}), [sel, BADGE]);

for (const S of SIZES) {
  const R = res.sizes[S.name] = {}; console.log(`== ${S.name}`);
  const ctx = await browser.newContext({ ...S }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));

  // ---- apartment page: a demo unit (845, fallback from units.json) then 846
  for (const unit of ['845', '846']) {
    await page.goto(`${base}/apartment.html?project=rainbow&unit=${unit}`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.getElementById('aptTitle').textContent.trim() !== '…'); await sleep(1200);
    const hero = await page.evaluate(() => { const e = document.getElementById('aptDemo'); const r = e.getBoundingClientRect(); return { hidden: e.hidden, text: e.textContent, h: Math.round(r.height), w: Math.round(r.width) }; });
    R[`apt${unit}`] = hero;
    if (unit === '845' && (hero.hidden || !hero.text.includes(BADGE) || hero.h < 18 || hero.h > 32)) fail(S.name, `apartment 845: hero chip ${JSON.stringify(hero)}`);
    if (unit === '846' && (!hero.hidden || hero.text)) fail(S.name, `apartment 846 must carry no badge: ${JSON.stringify(hero)}`);
    const txt = await page.evaluate(() => document.querySelector('.apt-hero').innerText);
    if (PRICE.test(txt)) fail(S.name, `apartment ${unit}: price text`);
    await shot(page, `a1-apartment-${unit}-${S.name}`);
    await page.click('#tab-about'); await sleep(600);
    const about = await page.evaluate((w) => [...document.querySelectorAll('#aboutFacts dd')].filter((d) => d.textContent.includes(w)).length, BADGE);
    R[`apt${unit}About`] = about;
    if (unit === '845' && about !== 1) fail(S.name, `apartment 845 «אודות»: expected 1 data-source row, got ${about}`);
    if (unit === '846' && about !== 0) fail(S.name, `apartment 846 «אודות»: badge row present`);
    if (unit === '845') { await page.evaluate(() => document.getElementById('aboutFacts')?.scrollIntoView({ block: 'center' })); await sleep(300); await shot(page, `a2-apartment-845-about-${S.name}`); }
  }

  // ---- landing.html: the featured unit is 846 (no chip in the title); the availability list marks the 11 demo rows
  await page.goto(`${base}/landing.html?project=rainbow&v=a`, { waitUntil: 'load' }); await sleep(1500);
  R.landingTitleChips = (await badges(page, '#factsTitle .hb-chip--demo')).length;
  if (R.landingTitleChips) fail(S.name, 'landing facts (846) carry the demo chip');
  const rows = await badges(page, '#availList .hb-chip--demo');
  R.landingRows = { chips: rows.length, visible: rows.filter((b) => b.visible && b.says).length, interactive: rows.filter((b) => b.interactive).length, h: rows[0]?.h };
  if (rows.length !== 11 || R.landingRows.visible !== 11) fail(S.name, `landing availability: ${JSON.stringify(R.landingRows)}`);
  if (rows.some((b) => b.h > 30)) fail(S.name, `landing chip too tall: ${rows[0]?.h}`);
  await page.evaluate(() => document.getElementById('availList')?.scrollIntoView({ block: 'start' })); await sleep(400);
  await shot(page, `l1-landing-availability-${S.name}`);
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) fail(S.name, 'landing: horizontal overflow');

  // ---- the hold via the root landing CTA
  await page.goto(`${base}/`, { waitUntil: 'load' }); await sleep(800);
  await page.waitForFunction(() => /hold/.test(document.getElementById('heroCta').href));
  await Promise.all([page.waitForURL(/\/hold\//, { timeout: 20000 }), page.click('#heroCta')]);
  await page.waitForFunction(() => window.__orbit && window.__orbit.done, null, { timeout: 60000 });
  await page.waitForFunction(() => [...document.querySelectorAll('#pickerStage .hotspot')].some((b) => getComputedStyle(b).display !== 'none'), null, { timeout: 20000 });
  await sleep(3500);
  // the pills: NO pill carries a demo mark (Eliran 2026-11-10, option 1: the mark lives on the unit card and in the units list only)
  const pills = await page.evaluate((w) => [...document.querySelectorAll('#pickerStage .hotspot')].map((b) => { const m = b.querySelector('.demo-mark'); const r = b.getBoundingClientRect(); return { unit: b.dataset.unit, mark: !!m, markShown: !!m && getComputedStyle(m).display !== 'none' && getComputedStyle(b.querySelector('.sub')).display !== 'none', h: Math.round(r.height), shown: getComputedStyle(b).display !== 'none' }; }), BADGE);
  R.pills = { total: pills.length, marked: pills.filter((p) => p.mark).length, markShown: pills.filter((p) => p.markShown && p.shown).length, p846mark: pills.find((p) => p.unit === '846')?.mark, maxH: Math.max(...pills.filter((p) => p.shown).map((p) => p.h)) };
  if (R.pills.marked !== 0) fail(S.name, `pills carry a demo mark: ${JSON.stringify(R.pills)}`);
  if (S.name === '390' && R.pills.maxH > 26) fail(S.name, `phone pills grew: ${R.pills.maxH} px`);
  await shot(page, `h1-hold-pills-${S.name}`);
  // 846's card: no badge, the primary button unchanged (≥ 44 px)
  await page.evaluate(() => document.querySelector('#pickerStage .hotspot[data-unit="846"]').click()); await sleep(900);
  const c846 = await badges(page, '#unitSheet .badge-demo');
  const btn846 = await page.evaluate(() => { const b = document.getElementById('unitContinue'); const r = b.getBoundingClientRect(); return { label: b.textContent.trim(), h: Math.round(r.height), w: Math.round(r.width) }; });
  R.card846 = { badges: c846.length, btn: btn846 };
  if (c846.length) fail(S.name, '846 card carries the demo badge');
  if (btn846.h < 44) fail(S.name, `846 primary button ${btn846.h} px`);
  await shot(page, `h2-hold-card-846-${S.name}`);
  await page.click('#unitClose'); await sleep(400);
  // 856's card: one badge under the facts, inside the sheet, not a tap target; the sheet does not scroll sideways
  await page.evaluate(() => document.querySelector('#pickerStage .hotspot[data-unit="856"]').click()); await sleep(900);
  const c856 = await badges(page, '#unitSheet .badge-demo');
  const sheet = await page.evaluate(() => { const s = document.getElementById('unitSheet'); const r = s.getBoundingClientRect(); const f = s.querySelector('.unit-facts').getBoundingClientRect(); const b = document.getElementById('unitContinue').getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), scrollW: s.scrollWidth, clientW: s.clientWidth, factsBottom: Math.round(f.bottom), btnTop: Math.round(b.top), btnH: Math.round(b.height), text: s.innerText }; });
  R.card856 = { badges: c856, sheet: { ...sheet, text: undefined } };
  if (c856.length !== 1 || !c856[0].visible || !c856[0].says || c856[0].interactive) fail(S.name, `856 card badge: ${JSON.stringify(c856)}`);
  if (c856.length === 1 && !(c856[0].y >= sheet.factsBottom - 2 && c856[0].y + c856[0].h <= sheet.btnTop + 2)) fail(S.name, `856 badge not between the facts and the button: ${JSON.stringify({ b: c856[0], sheet })}`);
  if (c856.length === 1 && (c856[0].x < sheet.x || c856[0].x + c856[0].w > sheet.x + sheet.w)) fail(S.name, '856 badge outside the sheet');
  if (sheet.scrollW > sheet.clientW + 1) fail(S.name, `856 sheet scrolls sideways ${sheet.scrollW} > ${sheet.clientW}`);
  if (sheet.btnH < 44) fail(S.name, `856 primary button ${sheet.btnH} px`);
  if (PRICE.test(sheet.text)) fail(S.name, '856 card: price text');
  await shot(page, `h3-hold-card-856-${S.name}`);
  await page.click('#unitClose'); await sleep(400);
  // the «דירות» drawer: 11 badges, none on 846, rows keep ≥ 44 px
  await page.click('#pickerStage .picker-units-btn'); await sleep(900);
  const dr = await badges(page, '#unitsDrawer .unit-row .badge-demo');
  const rowsInfo = await page.evaluate(() => [...document.querySelectorAll('#unitsDrawer .unit-row')].map((r) => ({ unit: r.dataset.unit, h: Math.round(r.getBoundingClientRect().height), demo: !!r.querySelector('.badge-demo') })));
  R.drawer = { badges: dr.length, visible: dr.filter((b) => b.visible && b.says).length, r846: rowsInfo.find((r) => r.unit === '846')?.demo, minRowH: Math.min(...rowsInfo.map((r) => r.h)), scrollW: await page.evaluate(() => { const d = document.getElementById('unitsDrawer'); return [d.scrollWidth, d.clientWidth]; }) };
  if (dr.length !== 11 || R.drawer.visible < 1 || R.drawer.r846 !== false) fail(S.name, `drawer: ${JSON.stringify(R.drawer)}`);
  if (R.drawer.minRowH < 44) fail(S.name, `drawer row under 44 px: ${R.drawer.minRowH}`);
  if (R.drawer.scrollW[0] > R.drawer.scrollW[1] + 1) fail(S.name, `drawer scrolls sideways ${R.drawer.scrollW}`);
  await shot(page, `h4-hold-units-list-${S.name}`);
  R.errors = errors; if (errors.length) fail(S.name, 'page errors: ' + errors.join(' | '));
  await ctx.close();
}
await browser.close(); srv.close();
res.pass = res.fails.length === 0;
fs.writeFileSync(path.join(OUT, 'units-demo-marker.json'), JSON.stringify(res, null, 1));
console.log(res.pass ? `PASS · ${OUT}` : `FAIL · ${res.fails.length} · ${OUT}`);
process.exit(res.pass ? 0 : 1);
