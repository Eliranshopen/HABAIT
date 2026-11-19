// entrydiag.mjs <base> — what the browser downloads between the tap on «כניסה לדירה» and the tour, at 1440: every finished request over 150 KB with its
// start / end relative to the tap, and the film's own progress. A diagnosis, no assertion.
import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/RnD/Projects/Habait/tools/appdeps/package.json')('playwright-core');
const base = process.argv[2].replace(/\/$/, ''); const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const page = await ctx.newPage();
const reqs = new Map(); let tap = 0; const rows = [];
page.on('request', (r) => reqs.set(r, Date.now()));
page.on('requestfinished', async (r) => { try { const s = await r.sizes(); const kb = Math.round((s.responseBodySize || 0) / 1024); if (kb >= 150) rows.push({ kb, from: reqs.get(r), to: Date.now(), url: r.url().replace(base, '').slice(0, 70), range: (r.headers().range || '') }); } catch { /* gone */ } });
await page.goto(base + '/', { waitUntil: 'load' });
await page.waitForFunction(() => /hold/.test(document.getElementById('heroCta').href));
await Promise.all([page.waitForURL(/\/hold\//, { timeout: 60000 }), page.click('#heroCta')]);
await page.waitForFunction(() => window.__orbit && window.__orbit.done, null, { timeout: 120000 });
await page.waitForFunction(() => [...document.querySelectorAll('#pickerStage .hotspot')].some((x) => x.dataset.unit === '846' && x.offsetParent), null, { timeout: 60000 });
await sleep(1500); await page.evaluate(() => document.querySelector('#pickerStage .hotspot[data-unit="846"]').click()); await sleep(900);
tap = Date.now(); await page.click('#unitContinue');
const prog = [];
for (let i = 0; i < 60; i++) {
  await sleep(500); const f = page.frames().find((x) => /\/apartment-journey\//.test(x.url()));
  const st = f ? await f.evaluate(() => { const v = document.getElementById('fly'); return { m: window.__journey.mode || '-', t: v ? +v.currentTime.toFixed(1) : -1, rs: v ? v.readyState : -1, buf: v && v.buffered.length ? +v.buffered.end(v.buffered.length - 1).toFixed(1) : 0, ph: window.__journey.phase }; }).catch(() => null) : null;
  const shown = await page.evaluate(() => { const t = document.getElementById('tourFrame'); return t ? getComputedStyle(t).opacity : '-'; });
  prog.push(`${((Date.now() - tap) / 1000).toFixed(1)}s ${st ? `${st.m} t${st.t} buf${st.buf} rs${st.rs} ${st.ph}` : 'no-journey'} tour${shown}`);
  if (shown === '1') break;
}
console.log(prog.join('\n'));
console.log('--- requests over 150 KB that were in flight after the tap (s from the tap) ---');
for (const r of rows.filter((x) => x.to > tap - 500).sort((a, c) => a.from - c.from)) console.log(`${((r.from - tap) / 1000).toFixed(1).padStart(6)} → ${((r.to - tap) / 1000).toFixed(1).padStart(5)}  ${String(r.kb).padStart(6)} KB  ${r.url} ${r.range}`);
await b.close();
