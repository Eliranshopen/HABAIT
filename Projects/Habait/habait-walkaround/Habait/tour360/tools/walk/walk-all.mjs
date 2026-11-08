#!/usr/bin/env node
/* Habait Tour360 — tools/walk/walk-all.mjs — walk every door of one apartment on a SERVED tour and film each transition.
   Rescued 2026-11-01 (board walkaround-production, WP-02) from an old session's %TEMP% scratchpad, where it was written on
   2026-10-29 for the cross-room finding (D-WQ-36). The walk itself is unchanged; the tour, the apartment, the output folder and
   the browser are parameters now, and nothing names a machine path.
   Per door: the view at the door before the click, six frames of the walk (a CDP screencast), the arrival, and the look back
   toward the room you came from. One headless Chrome, desktop 1090x910, Hebrew labels. Writes into --out:
     <from>--<to>-0-before.jpg · <from>--<to>-1-walk<i>-<ms>ms.jpg · <from>--<to>-2-arrived.jpg · <from>--<to>-3-lookback.jpg
     walks.json (per door: the view before/after, the walk times, errors) · index.html (the contact sheet)
   ⚠ Heavy (a browser): run it in Git Bash under `timeout 540`, foreground, one heavy run at a time (root CLAUDE.md §11). The door
   loop stops starting new doors after --budget-ms, so a full run ends inside that bound. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appRequire } from '../app-require.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..', '..');
const HELP = `walk-all.mjs — walk every door of one apartment on a served tour; film before, the walk, the arrival and the look back.

usage: node Habait/tour360/tools/walk/walk-all.mjs --tour <url> --apartment <id|dir> --out <dir> [--doors a>b,c>d] [--budget-ms 470000]
  --tour       the served tour's base URL: a local server (http://127.0.0.1:<port>) or a live link; ?room=<id>&lang=he is appended
  --apartment  an apartment id under Habait/tour360/apartments/ (its scenes.json lists the doors), or the path of that folder
  --out        the output folder (created)
  --doors      only these doors, as from>to pairs, comma-separated (default: every hotspot of every scene)
  --budget-ms  stop starting new doors after this many milliseconds (default 470000, inside a 540 s bound)
  --help       this text
env: CHROME_PATH   the Chrome executable (default C:/Program Files/Google/Chrome/Application/chrome.exe)
     HABAIT_APP_DIR where playwright-core is borrowed from (see ../app-require.mjs)
Heavy: run under \`timeout 540\` in Git Bash, foreground, one heavy run at a time.`;

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) { console.log(HELP); process.exit(0); }
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d; };
const fail = (m) => { console.error(`walk-all: ${m}\n\n${HELP}`); process.exit(2); };

const tourArg = opt('--tour');
const aptArg = opt('--apartment');
const OUT = opt('--out');
if (!tourArg || !/^https?:\/\//.test(tourArg)) fail('--tour must be a served URL (http:// or https://)');
if (!aptArg) fail('--apartment is required');
if (!OUT) fail('--out is required');
const base = tourArg.replace(/\/+$/, '');
const APT = fs.existsSync(aptArg) && fs.statSync(aptArg).isDirectory() ? path.resolve(aptArg) : path.join(REPO, 'Habait', 'tour360', 'apartments', aptArg);
const SCENES = path.join(APT, 'scenes.json');
if (!fs.existsSync(SCENES)) fail(`no scenes.json at ${SCENES}`);
const aptId = path.basename(APT);
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
if (!fs.existsSync(CHROME)) fail(`no Chrome at ${CHROME} (set CHROME_PATH)`);
const only = opt('--doors') ? opt('--doors').split(',') : null;
const budget = Number(opt('--budget-ms', 470000));

const { chromium } = appRequire(REPO)('playwright-core');
fs.mkdirSync(OUT, { recursive: true });
const scenes = JSON.parse(fs.readFileSync(SCENES, 'utf8')).scenes;
const by = Object.fromEntries(scenes.map((s) => [s.id, s]));
const doors = [];
for (const s of scenes) for (const h of s.hotspots) if (!only || only.includes(`${s.id}>${h.to}`)) doors.push({ from: s.id, to: h.to });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T0 = Date.now();
const VW = 1090, VH = 910; // his screenshot's size (desktop)

const doorAt = (name) => {
  const n = Array.from(document.querySelectorAll('.t-hs')).find((d) => (d.querySelector('.t-hs-label') || {}).textContent === name);
  if (!n) return null;
  const r = n.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, inView: r.width > 0 && r.left > 8 && r.right < innerWidth - 8 && r.top > 8 && r.bottom < innerHeight - 8 };
};
const view = () => { const v = window.__tour.viewer; return { yaw: +v.getYaw().toFixed(1), pitch: +v.getPitch().toFixed(1), hfov: +v.getHfov().toFixed(1), scene: window.__tour.scene }; };
// one rotation step toward the named door marker (or a fixed 60° turn while it is off screen)
const stepToward = (nm) => { const v = window.__tour.viewer; const n = Array.from(document.querySelectorAll('.t-hs')).find((d) => (d.querySelector('.t-hs-label') || {}).textContent === nm); let dx = 60; if (n) { const r = n.getBoundingClientRect(); if (r.width > 0) dx = Math.sign(r.left + r.width / 2 - innerWidth / 2) * Math.min(40, Math.abs(r.left + r.width / 2 - innerWidth / 2) / 12); } v.lookAt(v.getPitch(), v.getYaw() + dx, undefined, false); };

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--mute-audio'] });
const results = [];
try {
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1, bypassCSP: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  const cdp = await ctx.newCDPSession(page);
  let frames = [];
  cdp.on('Page.screencastFrame', async (f) => { frames.push({ ts: f.metadata.timestamp, data: f.data }); try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {} });
  for (const d of doors) {
    if (Date.now() - T0 > budget) { results.push({ ...d, skipped: 'budget' }); continue; }
    const tag = `${d.from}--${d.to}`;
    const rec = { ...d, tag, frames: [] };
    try {
      await page.goto(`${base}/?room=${d.from}&lang=he&t=${Date.now()}`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => window.__tour && window.__tour.ready === true, null, { timeout: 60000, polling: 50 });
      await sleep(1500);
      // rotate in steps until the door marker is in the central third
      const name = by[d.to].name.he;
      let door = null;
      for (let i = 0; i < 40; i++) {
        door = await page.evaluate(doorAt, name);
        if (door && door.inView && Math.abs(door.x - VW / 2) < 120) break;
        await page.evaluate(stepToward, name);
        await sleep(120);
      }
      await sleep(1800); // tiles for this direction
      rec.door = door; rec.before = await page.evaluate(view);
      fs.writeFileSync(path.join(OUT, `${tag}-0-before.jpg`), await page.screenshot({ type: 'jpeg', quality: 85 }));
      if (!door || !door.inView) { rec.error = 'door not in view'; results.push(rec); continue; }
      frames = [];
      await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80, maxWidth: VW, maxHeight: VH, everyNthFrame: 1 });
      await sleep(200);
      const tapWall = Date.now();
      await page.mouse.click(door.x, door.y);
      await page.waitForFunction((sc) => window.__tour.scene === sc && window.__tour.viewer.isLoaded(), d.to, { timeout: 20000, polling: 16 });
      await page.waitForFunction(() => !document.querySelector('.hb-walk'), null, { timeout: 20000, polling: 16 });
      await sleep(400);
      await cdp.send('Page.stopScreencast');
      rec.walkTimes = await page.evaluate(() => { const w = window.__tour.viewer.walkTimes || {}; const t = w.tap; return Object.fromEntries(Object.entries(w).map(([k, v]) => [k, Math.round(v - t)])); });
      // pick frames evenly through the move: 6 mid frames
      const fr = frames.map((f) => ({ t: Math.round(f.ts * 1000 - tapWall), data: f.data })).filter((f) => f.t >= 0);
      const picks = [];
      const n = Math.min(6, fr.length);
      for (let i = 0; i < n; i++) picks.push(fr[Math.round((i * (fr.length - 1)) / Math.max(1, n - 1))]);
      picks.forEach((f, i) => { fs.writeFileSync(path.join(OUT, `${tag}-1-walk${i}-${f.t}ms.jpg`), Buffer.from(f.data, 'base64')); rec.frames.push(`${tag}-1-walk${i}-${f.t}ms.jpg`); });
      await sleep(2000); // arrival tiles
      rec.after = await page.evaluate(view);
      fs.writeFileSync(path.join(OUT, `${tag}-2-arrived.jpg`), await page.screenshot({ type: 'jpeg', quality: 85 }));
      // look back toward the source: find the door marker back to `from`, centre it
      const back = by[d.from].name.he;
      let bd = null;
      for (let i = 0; i < 40; i++) {
        bd = await page.evaluate(doorAt, back);
        if (bd && bd.inView && Math.abs(bd.x - VW / 2) < 120) break;
        await page.evaluate(stepToward, back);
        await sleep(120);
      }
      await sleep(1800);
      rec.lookBack = await page.evaluate(view);
      fs.writeFileSync(path.join(OUT, `${tag}-3-lookback.jpg`), await page.screenshot({ type: 'jpeg', quality: 85 }));
      rec.errors = errors.splice(0);
    } catch (e) { rec.error = String(e.message || e).slice(0, 300); try { await cdp.send('Page.stopScreencast'); } catch {} }
    results.push(rec);
    console.log(tag, rec.error || `ok ${JSON.stringify(rec.walkTimes)}`);
  }
} finally { await browser.close(); }
fs.writeFileSync(path.join(OUT, 'walks.json'), JSON.stringify({ base, apartment: aptId, at: new Date().toISOString(), results }, null, 1));
// the sheet
let html = '';
for (const r of results) {
  const imgs = [`${r.tag}-0-before.jpg`, ...(r.frames || []), `${r.tag}-2-arrived.jpg`, `${r.tag}-3-lookback.jpg`].filter((f) => fs.existsSync(path.join(OUT, f)));
  html += `<section><h2>${r.from} → ${r.to}${r.error ? ` <em>${r.error}</em>` : ''}${r.skipped ? ` <em>skipped: ${r.skipped}</em>` : ''}</h2><p class="v">before ${JSON.stringify(r.before)} · after ${JSON.stringify(r.after)} · walk ${JSON.stringify(r.walkTimes)}</p><div class="row">${imgs.map((f) => `<figure><img src="${f}" loading="lazy"><figcaption>${f.replace(r.tag + '-', '')}</figcaption></figure>`).join('')}</div></section>`;
}
fs.writeFileSync(path.join(OUT, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${aptId}: every door walked on ${base}</title><style>body{font:14px/1.4 system-ui,sans-serif;margin:20px;color:#222}h2{font-size:16px;margin:26px 0 2px}em{color:#b00;font-style:normal}.v{margin:0 0 6px;color:#666;font-size:12px}.row{display:flex;gap:6px;overflow-x:auto}figure{margin:0;flex:0 0 300px}img{width:300px;height:auto;border:1px solid #bbb;background:#111}figcaption{font-size:11px;color:#666}</style></head><body><h1>Apartment ${aptId}: every door walked (${base}, ${new Date().toISOString().slice(0, 16)})</h1><p>Per door: the view at the door before the click, six frames of the walk, the arrival, and the look back toward the room you came from.</p>${html}</body></html>`);
console.log('sheet', path.join(OUT, 'index.html'));
