#!/usr/bin/env node
/* Time from the landing's «לסיור בפרויקט» click to the unit picker being interactive at the /hold/ stop (Eliran 2026-11-09: «אני רוצה
   שהסרטון אחרי העמוד נחיתה יהיה יותר מהיר … והגעה לשלב של העצירה מול הבניין עם הבחירת דירות, גם במובייל וגם בדסקטופ»).
   Headless Chrome on a STAGE at 390×844 (phone) and 1440×900; per size N runs: click → the orbit clip plays → it hands over
   (window.__orbit.done) → a pill is visible and clickable (its card opens). Wall-clock ms from the click. Also: the clip's duration and
   frame rate, and whether the hand-off was by the clip's end (not a skip). timing.json into --out. $0.
   usage: node test/hold-timing.check.mjs <stage> --out <dir> [--runs 2] */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const stage = argv.find((a, i) => !a.startsWith('--') && !['--out', '--runs'].includes(argv[i - 1]));
const OUT = opt('--out'); const RUNS = Number(opt('--runs', '2'));
if (!stage || !OUT) { console.error('usage: hold-timing.check.mjs <stage> --out <dir> [--runs 2]'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const APP = process.env.HABAIT_APP_DIR || 'C:/RnD/Projects/Habait/tools/appdeps';
const { chromium } = createRequire(path.join(APP, 'package.json'))('playwright-core');
const { serveStatic } = await import(pathToFileURL(path.join(HERE, '..', '..', 'tools', 'qa', 'responsive-gate.mjs')).href);
const rw = fs.existsSync(path.join(stage, 'vercel.json')) ? JSON.parse(fs.readFileSync(path.join(stage, 'vercel.json'), 'utf8')).rewrites : null;
const srv = serveStatic(path.resolve(stage), rw); await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--autoplay-policy=no-user-gesture-required'] });
const SIZES = [{ name: '390', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: '1440', viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 }];
const res = { at: new Date().toISOString(), base, runs: RUNS, sizes: {}, fails: [] };
const fail = (s, m) => { res.fails.push(`${s}: ${m}`); console.log(`  FAIL ${s}: ${m}`); };
for (const S of SIZES) {
  const R = res.sizes[S.name] = { runs: [] }; console.log(`== ${S.name}`);
  for (let i = 0; i < RUNS; i++) {
    const ctx = await browser.newContext({ ...S }); const page = await ctx.newPage();
    await page.goto(base + '/', { waitUntil: 'load' });
    await page.waitForFunction(() => /hold/.test(document.getElementById('heroCta').href));
    const t0 = Date.now();
    await Promise.all([page.waitForURL(/\/hold\//, { timeout: 20000 }), page.click('#heroCta')]);
    const tNav = Date.now() - t0;
    await page.waitForFunction(() => { const v = document.getElementById('clip'); return v && v.currentTime > 0.05; }, null, { timeout: 30000 });
    const tFilm = Date.now() - t0;
    const clip = await page.evaluate(() => { const v = document.getElementById('clip'); return { src: v.currentSrc.split('/').pop().split('?')[0], duration: v.duration }; });
    await page.waitForFunction(() => window.__orbit && window.__orbit.done, null, { timeout: 60000 });
    const tStop = Date.now() - t0;
    await page.waitForFunction(() => [...document.querySelectorAll('#pickerStage .hotspot')].some((b) => getComputedStyle(b).display !== 'none' && b.getBoundingClientRect().width > 0), null, { timeout: 20000 });
    const tPills = Date.now() - t0;
    // interactive = a pill takes a click and its card opens
    await page.evaluate(() => [...document.querySelectorAll('#pickerStage .hotspot')].find((b) => getComputedStyle(b).display !== 'none').click());
    await page.waitForFunction(() => { const s = document.getElementById('unitSheet'); return s && !s.hidden; }, null, { timeout: 5000 });
    const tCard = Date.now() - t0;
    const how = await page.evaluate(() => ({ ended: window.__orbit.ended, skipped: window.__orbit.skipped, error: window.__orbit.error }));
    if (!how.ended || how.skipped || how.error) fail(S.name, 'the hand-off was not by the clip ending ' + JSON.stringify(how));
    R.runs.push({ tNav, tFilm, tStop, tPills, tCard, clip, how });
    console.log(`  run ${i + 1}: film ${tFilm} ms · stop ${tStop} ms · picker interactive ${tCard} ms · ${clip.src} ${clip.duration?.toFixed(2)} s`);
    await ctx.close();
  }
  R.medianCardMs = R.runs.map((r) => r.tCard).sort((a, b) => a - b)[Math.floor(R.runs.length / 2)];
}
await browser.close(); srv.close();
res.pass = res.fails.length === 0;
fs.writeFileSync(path.join(OUT, 'timing.json'), JSON.stringify(res, null, 1));
console.log(res.pass ? `PASS · ${OUT}` : `FAIL · ${res.fails.length} · ${OUT}`);
process.exit(res.pass ? 0 : 1);
