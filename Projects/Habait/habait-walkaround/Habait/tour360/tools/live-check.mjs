#!/usr/bin/env node
/* Habait Tour360 — live-check.mjs (T09) — the typed change driven end to end in a real browser against a running edit host.
   Opens <base>/?key=<code>&lang=<lang>, waits for the field to unlock, types a change that the scope rule must REFUSE (a wall),
   then one it must ACCEPT, waits for the live scene, undoes it, and writes screenshots + a JSON record to --out.
   PAID: the accepted change is one real fal call (about $0.05); the refusal costs the text step only.
   Usage (from the harness root, Git Bash, the host already running):
     timeout 540 node Habait/tour360/tools/live-check.mjs --base http://127.0.0.1:8720 --key <code> [--lang he] [--text "..."] [--refuse "..."]
       [--look pitch,yaw,hfov] [--force-first reframe|rescale] [--item <catalog id>] [--out dir]
   --look is Pannellum's lookAt order; the default frames the sofa (-18,-100,95); the dining table is -13,0,80 (T12, people).
   --item (T14e) picks that item in the catalog strip instead of typing: the prefilled words are sent, the look defaults from the
   item's view, and PASS also needs the live meta to name the item and the item card to be on screen (a phone frame is taken too).
   --force-first answers the accepted change's FIRST request inside the browser, with no vendor call, so a guard must catch it
   and the second attempt — a real one, on the other editor — must land: `reframe` sends a different picture (another room's
   thumbnail; the border ring catches it, T12b); `rescale` sends the page's own view with its middle redrawn 1.6 times larger and
   its edges intact (the ring cannot see it; the furniture judge — a real vision call — must, T12c). */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { appRequire } from './app-require.mjs'; // a worktree has no Habait/MVP/app (board habait-walkaround T18)

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..', '..');
const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : dflt; };
const base = arg('--base', '').replace(/\/$/, '');
const key = arg('--key', '');
const lang = arg('--lang', 'he');
const text = arg('--text', 'כריות כחולות על הספה');
const refuse = arg('--refuse', 'תהרסו את הקיר בין הסלון למטבח');
const forceFirst = arg('--force-first', process.argv.includes('--reframe-first') ? 'reframe' : '');
if (forceFirst && !['reframe', 'rescale'].includes(forceFirst)) { console.error('--force-first wants reframe or rescale'); process.exit(2); }
const item = arg('--item', '');
let itemRow = null, marker = null, markerRoom = '';
if (item) {
  const doc = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalog', 'items.json'), 'utf8'));
  itemRow = doc.items.find((i) => i.id === item) || null;
  if (!itemRow) { console.error('--item: no such catalog item ' + item); process.exit(2); }
  // T16c: the turn starts at a ring — the named marker, else the largest of the item's category in the scan
  const markersDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'apartments', 'demo-01', 'markers.json'), 'utf8'));
  const wanted = arg('--marker', '');
  const all = Object.entries(markersDoc.scenes).flatMap(([room, sc]) => sc.markers.map((m) => ({ room, m })));
  const hit = wanted ? all.find((x) => x.m.id === wanted) : all.filter((x) => x.m.category === itemRow.category).sort((a, b) => b.m.span_deg[0] * b.m.span_deg[1] - a.m.span_deg[0] * a.m.span_deg[1])[0];
  if (!hit) { console.error(`--item: no marker of category ${itemRow.category}${wanted ? ' named ' + wanted : ''} in markers.json`); process.exit(2); }
  marker = hit.m; markerRoom = hit.room;
}
const look = (process.argv.includes('--look') ? arg('--look', '') : marker ? `${marker.pitch},${marker.yaw},80` : '-18,-100,95').split(',').map(Number);
if (look.length !== 3 || look.some((n) => !Number.isFinite(n))) { console.error('--look wants pitch,yaw,hfov'); process.exit(2); }
const OUT = path.resolve(arg('--out', path.join(REPO, 'qa-evidence', 'tour360', 'T09')));
if (!base || !key) { console.error('usage: live-check.mjs --base <url> --key <code> [--lang he] [--text "..."]'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const { chromium } = appRequire(REPO)('playwright-core');

const rec = { base, lang, text, refuse, look, forceFirst, item: item || null, marker: marker ? { id: marker.id, room: markerRoom, category: marker.category, count: marker.count } : null, when: new Date().toISOString(), steps: [], errors: [] };
let browser;
try {
  browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => rec.errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') rec.errors.push(m.text()); });
  const t0 = Date.now();
  await page.goto(`${base}/?key=${encodeURIComponent(key)}&lang=${lang}${marker ? '&room=' + encodeURIComponent(markerRoom) : ''}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__tour && window.__tour.ready === true && window.__tour.liveReady === true, null, { timeout: 60000 });
  rec.steps.push({ step: 'unlocked', ms: Date.now() - t0, placeholder: await page.$eval('#t-bar-input', (n) => n.placeholder), barHidden: await page.$eval('#t-change-bar', (n) => n.hidden), panelRowHidden: await page.$eval('#t-change-row', (n) => n.hidden) });

  // aim first so the crop frames the target (the sofa by default)
  await page.evaluate(([p, y, h]) => window.__tour.viewer.lookAt(p, y, h, false), look);
  await page.waitForTimeout(400);

  // 1. the refusal — typed in the bar on the main screen
  await page.fill('#t-bar-input', refuse);
  const r0 = Date.now();
  await page.click('#t-bar-apply');
  await page.waitForFunction(() => /\S/.test(document.getElementById('t-loading-text').textContent) && !document.getElementById('t-loading').classList.contains('is-hidden') && !window.__tour.applying === false, null, { timeout: 60000 }).catch(() => {});
  // wait for the refusal text to show (the busy pill carries it) or the loading pill to hide
  const refusedText = await page.waitForFunction(() => {
    const el = document.getElementById('t-loading-text');
    const t = el.textContent;
    const pill = document.getElementById('t-loading');
    return (!pill.classList.contains('is-hidden') && t && !/15|minute|דקה|secondes|שניות/.test(t)) ? t : null;
  }, null, { timeout: 60000 }).then((h) => h.jsonValue()).catch(() => null);
  await page.screenshot({ path: path.join(OUT, `refusal-${lang}.png`) });
  rec.steps.push({ step: 'refusal', ms: Date.now() - r0, text: refusedText, liveCount: await page.evaluate(() => Object.keys(window.__tour.live).length) });
  await page.waitForFunction(() => window.__tour.applying === false, null, { timeout: 30000 });

  // 2. the accepted change (with --force-first its first edit request is answered here, with no vendor call)
  let forced = 0;
  if (forceFirst) {
    const other = fs.readFileSync(path.join(ROOT, 'apartments', 'demo-01', 'panos', 'thumb', '02-kitchen.webp')).toString('base64');
    await page.route('**/api/edit', async (route) => {
      const req = route.request();
      const post = req.method() === 'POST' ? req.postDataJSON() : null;
      if (!post || post.op === 'judge' || forced > 0) return route.continue();
      forced++;
      let image = 'data:image/webp;base64,' + other;
      if (forceFirst === 'rescale') {
        // the page's own view with its middle redrawn 1.6 times larger about the centre, the outer 90 px left as they are
        image = await page.evaluate(async (cropUrl) => {
          const im = new Image(); await new Promise((ok, no) => { im.onload = ok; im.onerror = no; im.src = cropUrl; });
          const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
          const g = c.getContext('2d'); g.drawImage(im, 0, 0);
          const inset = 90, k = 1.6;
          g.save(); g.beginPath(); g.rect(inset, inset, c.width - 2 * inset, c.height - 2 * inset); g.clip();
          g.translate(c.width / 2, c.height / 2); g.scale(k, k); g.translate(-c.width / 2, -c.height / 2);
          g.drawImage(im, 0, 0); g.restore();
          return c.toDataURL('image/jpeg', 0.92);
        }, post.crop);
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, image, prompt: `forced ${forceFirst} (live-check)`, target: '', change: '', reach: 'object', living: true, attempt: 1, model: 'forced', modelKey: 'forced', usd: 0, ms: 1, slow: false }) });
    });
  }
  let r1 = Date.now();
  if (item) {
    // T16c: tap the piece's ring, then the item in the pick bar — that tap IS the turn (no text box)
    await page.waitForFunction(() => !document.getElementById('pano').classList.contains('is-moving'), null, { timeout: 10000 });
    await page.waitForSelector(`.t-mk[data-marker="${marker.id}"]`, { timeout: 10000 });
    const ring = await page.$eval(`.t-mk[data-marker="${marker.id}"]`, (n) => { const b = n.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), onScreen: b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight, label: n.getAttribute('aria-label') }; });
    await page.click(`.t-mk[data-marker="${marker.id}"]`);
    await page.waitForSelector(`#t-pick:not([hidden]) [data-item="${item}"]`, { timeout: 10000 });
    const pickState = await page.evaluate(() => ({ chip: document.getElementById('t-pick-chip').textContent, items: document.querySelectorAll('#t-catalog-bar .t-catalog-item').length, open: document.querySelectorAll('.t-mk.is-open').length, marker: window.__tour.marker }));
    rec.steps.push({ step: 'picked', item, marker: marker.id, ring, ...pickState });
    r1 = Date.now();
    await page.click(`#t-catalog-bar [data-item="${item}"]`);
  } else {
    await page.fill('#t-bar-input', text);
    r1 = Date.now();
    await page.click('#t-bar-apply');
  }
  await page.waitForFunction(() => window.__tour.live && Object.values(window.__tour.live).some((l) => l.length > 0) && window.__tour.applying === false && window.__tour.viewer.isLoaded(), null, { timeout: 200000 });
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => ({ key: window.__tour.sceneKey, live: window.__tour.live, yaw: Math.round(window.__tour.viewer.getYaw()), pitch: Math.round(window.__tour.viewer.getPitch()) }));
  await page.screenshot({ path: path.join(OUT, `change-${lang}.png`) });
  const lastLive = await page.evaluate(() => { const all = Object.values(window.__tour.liveMeta || {}).flat(); const m = all[all.length - 1]; return m ? { model: m.model, reach: m.reach, living: m.living, attempt: m.attempt, ring: m.ring, judge: m.judge, usd: m.usd, fraction: m.fraction, ms: m.ms, prompt: m.prompt, item: m.item || null, likeness: m.likeness || null, piece: m.piece || null, region_fraction: m.region_fraction ?? null, marker: m.marker ? { id: m.marker.id, after: m.marker.after } : null } : null; });
  const cardShown = item ? await page.$eval('#t-item-card', (n) => !n.hidden) : null;
  // T16c: the ring now sits on the product and carries the item's name; the pick bar closed
  const markerAfter = marker ? await page.evaluate(([room, id]) => { const st = window.__tour.hooks.markerState(room, id); return st ? { item: st.item, yaw: st.yaw, pitch: st.pitch, count: st.count } : null; }, [markerRoom, marker.id]) : null;
  const pickClosed = marker ? await page.$eval('#t-pick', (n) => n.hidden) : null;
  if (item) {
    // the same page at phone width: the strip and the card must fit (T14e)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT, `card-phone-${lang}.png`) });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(500);
  }
  rec.steps.push({ step: 'change', ms: Date.now() - r1, ...after, result: lastLive, forced, cardShown, markerAfter, pickClosed });

  // 3. compare with the original, then undo
  await page.click('#t-compare');
  await page.waitForFunction(() => window.__tour.applying === false && window.__tour.original === true && window.__tour.viewer.isLoaded(), null, { timeout: 60000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, `original-${lang}.png`) });
  await page.click('#t-compare');
  await page.waitForFunction(() => window.__tour.applying === false && window.__tour.original === false && window.__tour.viewer.isLoaded(), null, { timeout: 60000 });
  await page.click('#t-change-btn');
  await page.waitForSelector('#t-change:not([hidden]) .t-change-item.is-live', { timeout: 10000 });
  await page.screenshot({ path: path.join(OUT, `panel-${lang}.png`) });
  await page.click('#t-change-close');
  await page.waitForSelector('#t-undo:not([hidden])', { timeout: 10000 });
  await page.click('#t-undo');
  await page.waitForFunction(() => window.__tour.applying === false && Object.keys(window.__tour.live).length === 0 && window.__tour.viewer.isLoaded(), null, { timeout: 60000 });
  const markerRestored = marker ? await page.evaluate(([room, id]) => { const st = window.__tour.hooks.markerState(room, id); return st ? { item: st.item, yaw: st.yaw, pitch: st.pitch } : null; }, [markerRoom, marker.id]) : null;
  rec.steps.push({ step: 'undo', key: await page.evaluate(() => window.__tour.sceneKey), markerRestored });
  rec.lastTurn = await page.evaluate(() => window.__tour.lastTurn || null).catch(() => null);
  await ctx.close();
} catch (e) {
  rec.failure = String(e && e.message ? e.message : e).split('\n')[0];
  try { const pg = browser && browser.contexts()[0] && browser.contexts()[0].pages()[0]; if (pg) { rec.lastTurn = await pg.evaluate(() => window.__tour.lastTurn || null); rec.pill = await pg.evaluate(() => document.getElementById('t-loading-text').textContent); await pg.screenshot({ path: path.join(OUT, `failure-${lang}.png`) }); } } catch (_) { /* the page is gone */ }
} finally {
  if (browser) await browser.close();
}
const changeStep = rec.steps.find((s) => s.step === 'change');
rec.ok = !rec.failure && rec.errors.length === 0 && Boolean(changeStep) && rec.steps.some((s) => s.step === 'refusal' && s.liveCount === 0)
  && (!forceFirst || (changeStep.forced === 1 && changeStep.result && changeStep.result.attempt >= 2))
  && (!item || (changeStep.result && changeStep.result.item === item && changeStep.cardShown === true))
  // T16c: by marker — the replace judge held, the paste stayed inside the piece, the ring took the item, undo gave it back
  && (!marker || (changeStep.result && changeStep.result.judge && changeStep.result.judge.held === true && changeStep.result.region_fraction > 0
    && changeStep.markerAfter && changeStep.markerAfter.item === item && changeStep.pickClosed === true
    && rec.steps.some((s) => s.step === 'undo' && s.markerRestored && s.markerRestored.item === null)));
fs.writeFileSync(path.join(OUT, `live-check-${lang}.json`), JSON.stringify(rec, null, 2) + '\n');
console.log(`${rec.ok ? 'PASS' : 'FAIL'} live-check ${lang}: ${rec.steps.map((s) => s.step + (s.ms ? ' ' + s.ms + 'ms' : '')).join(' · ')}${rec.failure ? ' · ' + rec.failure : ''}${rec.errors.length ? ' · errors=' + rec.errors.slice(0, 2).join(' | ') : ''}`);
for (const s of rec.steps) if (s.text) console.log('   refusal text:', s.text);
if (rec.lastTurn) console.log('   last turn:', JSON.stringify(rec.lastTurn.attempts), rec.lastTurn.error ? 'error ' + JSON.stringify(rec.lastTurn.error) : '');
if (rec.pill) console.log('   pill:', rec.pill);
if (changeStep && changeStep.result) console.log(`   change: ${changeStep.result.model} · attempt ${changeStep.result.attempt} · ring ${changeStep.result.ring} · changed ${changeStep.result.fraction} · judge ${changeStep.result.judge ? JSON.stringify(changeStep.result.judge) : 'not asked'} · $${changeStep.result.usd}${changeStep.result.item ? ` · item ${changeStep.result.item} · likeness ${JSON.stringify(changeStep.result.likeness)} · card ${changeStep.cardShown ? 'shown' : 'NOT shown'}` : ''}`);
process.exit(rec.ok ? 0 : 1);
