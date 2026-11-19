// coachcheck.mjs <tour url> <out dir> — the walkthrough («?») explains the walking arrows: the joystick step on a phone, the keyboard line on a desktop
import fs from 'node:fs'; import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/RnD/Projects/Habait/tools/appdeps/package.json')('playwright-core');
const [base, out] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true }); const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' }); let bad = 0;
for (const S of [{ n: '390', want: 'חיצי ההליכה', ctx: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } }, { n: '1440', want: 'חיצי המקלדת', ctx: { viewport: { width: 1440, height: 900 } } }]) {
  const c = await b.newContext(S.ctx); const p = await c.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(base + '?scope=apartment&room=living&floor=parquet&video=0&auto=0', { waitUntil: 'load' });
  await p.waitForFunction(() => { const n = document.getElementById('t-coach'); return n && !n.hidden; }, null, { timeout: 30000 });
  let found = null; const seen = [];
  for (let i = 0; i < 45; i++) {
    await sleep(350); const t = await p.evaluate(() => document.getElementById('t-coach-text').textContent); seen.push(t);
    if (t.includes(S.want)) { found = t; await sleep(400); await p.screenshot({ path: `${out}/coach-${S.n}.png` }); break; }
    const more = await p.evaluate(() => { const n = document.getElementById('t-coach-next'); if (!n || n.hidden || document.getElementById('t-coach').hidden) return false; n.click(); return true; });
    if (!more) break;
  }
  const joy = S.n === '390' && found ? await p.evaluate(() => Number(getComputedStyle(document.getElementById('t-joy')).opacity)) : null;
  const ok = Boolean(found) && !errs.length && (joy === null || joy > 0.9); if (!ok) bad++;
  console.log(S.n, ok ? 'OK' : 'BAD', 'steps read', seen.length, '·', found || 'NOT FOUND', joy === null ? '' : '· joystick shown ' + joy, errs.join(' | '));
  await c.close();
}
await b.close(); process.exit(bad ? 1 : 0);
