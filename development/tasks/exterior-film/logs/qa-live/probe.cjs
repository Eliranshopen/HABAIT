const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const BASE = 'http://127.0.0.1:8861', OUT = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms) { const t0 = Date.now(); for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() - t0 > ms) return null; await sleep(250); } }
(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const rows = {};
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(`${BASE}/?project=rainbow`, { waitUntil: 'domcontentloaded' });
  const href = await until(() => p.evaluate(() => { const a = document.getElementById('heroCta'); return a && !a.hidden && /\/hold\//.test(a.href) ? a.href : null; }), 15000);
  await p.goto(href, { waitUntil: 'domcontentloaded' });
  await until(() => p.evaluate(() => getComputedStyle(document.getElementById('buildingBtn')).display === 'block'), 60000);
  // 1 focus trap during play
  await p.click('#buildingBtn'); await sleep(800);
  const seq = [];
  for (let i = 0; i < 4; i++) { await p.keyboard.press('Tab'); seq.push(await p.evaluate(() => document.activeElement.id || document.activeElement.tagName)); }
  rows.tabPlaying = seq;
  // jump to end
  await p.evaluate(() => { const v = window.__building.video; v.currentTime = v.duration - 0.3; });
  await until(() => p.evaluate(() => window.__building.ended), 8000);
  const seq2 = [];
  for (let i = 0; i < 5; i++) { await p.keyboard.press('Tab'); seq2.push(await p.evaluate(() => document.activeElement.id || document.activeElement.tagName)); }
  rows.tabEnd = seq2;
  await p.keyboard.press('Shift+Tab'); rows.shiftTab = await p.evaluate(() => document.activeElement.id);
  // 2 rapid sync open/close/open
  await p.keyboard.press('Escape'); await sleep(300);
  await p.evaluate(() => { const b = document.getElementById('buildingBtn'); b.click(); document.getElementById('buildingClose').click(); b.click(); });
  await sleep(1200);
  rows.race = await p.evaluate(() => ({ endHidden: document.getElementById('buildingEnd').hidden, paused: window.__building.video.paused, t: window.__building.video.currentTime, open: window.__building.open }));
  // 3 dead fade: end then enter
  await p.evaluate(() => { const v = window.__building.video; v.currentTime = v.duration - 0.3; });
  await until(() => p.evaluate(() => window.__building.ended), 8000);
  await p.evaluate(() => { document.getElementById('buildingEnter').click(); });
  await sleep(300);
  rows.fade = await p.evaluate(() => { const f = document.getElementById('fade'); const cs = getComputedStyle(f); const top = document.elementFromPoint(300, 300); return { op: cs.opacity, z: cs.zIndex, topId: top && (top.id || top.tagName) }; });
  await p.screenshot({ path: OUT + '/probe_fade.png' });
  await p.close();
  // 4 resize / per-open source
  const p2 = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p2.goto(href, { waitUntil: 'domcontentloaded' });
  await until(() => p2.evaluate(() => getComputedStyle(document.getElementById('buildingBtn')).display === 'block'), 60000);
  await p2.click('#buildingBtn'); await sleep(500);
  const s1 = await p2.evaluate(() => window.__building.src);
  await p2.click('#buildingClose'); await p2.setViewportSize({ width: 600, height: 900 }); await sleep(300);
  await p2.click('#buildingBtn'); await sleep(500);
  const s2 = await p2.evaluate(() => window.__building.src);
  const dims = await p2.evaluate(() => ({ w: window.__building.video.videoWidth, h: window.__building.video.videoHeight }));
  rows.resize = { open1440: s1.split('/').pop(), reopen600: s2.split('/').pop(), dims };
  // legal byte-equal + disclosure
  rows.legal = await p2.evaluate(() => { const a = document.getElementById('clipLegal').textContent, f = document.querySelector('#buildingFilm .film-legal'); const bd = document.querySelector('#buildingFilm .film-badge'); return { equal: !!f && f.textContent === a, len: a.length, badge: bd && bd.textContent, badgeVisible: bd && getComputedStyle(bd).display !== 'none' }; });
  await b.close();
  console.log(JSON.stringify(rows, null, 1));
})().catch((e) => { console.error('ERR', e.message); process.exit(2); });
