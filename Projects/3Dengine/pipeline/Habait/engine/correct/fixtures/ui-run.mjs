#!/usr/bin/env node
// ui-run.mjs - drives the correction screen in a real browser (Playwright from C:\RnD\Projects\Habait\tools\appdeps)
// on the three-error fixture: fixes the three errors with taps/drags only (no keyboard), counts the
// actions, times them, saves through "אשר ושמור", then checks the tablet layout with touch taps.
//
//   HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps node Habait/engine/correct/fixtures/ui-run.mjs [shotsDir]
//
// Screenshots go to shotsDir (default: Habait/engine/correct/_local/shots, gitignored).
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const shots = resolve(process.argv[2] || join(ROOT, '_local', 'shots'));
mkdirSync(shots, { recursive: true });
const appDir = process.env.HABAIT_APP_DIR || 'C:/RnD/Projects/Habait/tools/appdeps';
const require = createRequire(join(appDir, 'node_modules', 'x.js'));
const { chromium } = (() => { for (const c of [process.env.PLAYWRIGHT_CORE, 'playwright-core', 'playwright'].filter(Boolean)) { try { return require(c); } catch { /* next */ } } throw new Error('playwright-core not found (HABAIT_APP_DIR)'); })();
const chromePath = process.env.CHROME_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);

const PORT = 8871;
const out = mkdtempSync(join(tmpdir(), 'habait-correct-ui-'));
const srv = spawn(process.execPath, [join(ROOT, 'serve.mjs'), '--plan', join(HERE, 'apt846-3errors.plan.json'), '--report', join(HERE, 'apt846-3errors.report.json'), '--out', out, '--port', String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => srv.stdout.once('data', r));
const base = `http://127.0.0.1:${PORT}/`;
const report = JSON.parse(readFileSync(join(HERE, 'apt846-3errors.report.json'), 'utf8'));

let fails = 0;
const check = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails++; };
const browser = await chromium.launch({ executablePath: chromePath, headless: true });
try {
  // ------------------------------------------------------------ desktop --
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'he-IL' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.goto(base);
  await page.waitForSelector('#plan polygon.room');
  await page.screenshot({ path: join(shots, '1-desktop-check.png') });
  const badge0 = await page.textContent('#badge');
  const issues0 = await page.$$eval('.issues li', (els) => els.map((e) => e.textContent));
  check(issues0.length === 4, `step 1 lists ${issues0.length} things to check (badge "${badge0}"): ${issues0.join(' / ')}`);

  let taps = 0, drags = 0;
  const t0 = Date.now();
  const screenOf = (cm) => page.evaluate((cm) => {
    const svg = document.querySelector('#plan'); const [x, y] = window.__correct.toPx(cm);
    const p = svg.createSVGPoint(); p.x = x; p.y = y; const q = p.matrixTransform(svg.getScreenCTM()); return [q.x, q.y];
  }, cm);
  const issueCount = () => page.evaluate(() => window.__correct.computeIssues().length);

  // error 1: the bedroom corner. Tap its line in the list -> the room is selected and zoomed; drag the corner.
  await page.locator('.issues li.k-dims', { hasText: '"חדר שינה"' }).click(); taps++;
  const { room, i, from } = report.deliberate_errors.corner;
  const h = await page.$(`circle.corner[data-room="${room}"][data-i="${i}"]`);
  const hb = await h.boundingBox();
  const [tx, ty] = await screenOf(from);
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  for (let k = 1; k <= 8; k++) await page.mouse.move(hb.x + hb.width / 2 + (tx + 3 - hb.x - hb.width / 2) * k / 8, hb.y + hb.height / 2 + (ty - 2 - hb.y - hb.height / 2) * k / 8);
  await page.mouse.up(); drags++;
  const v = await page.evaluate(({ room, i }) => window.__correct.S.plan.rooms.find((r) => r.id === room).loop[i], { room, i });
  check(Math.hypot(v[0] - from[0], v[1] - from[1]) < 12, `error 1 fixed by one drag: corner at ${v} (drawing ${from}), snapped`);
  await page.click('[data-act="close"]'); taps++;
  await page.screenshot({ path: join(shots, '2-desktop-corner-fixed.png') });

  // error 2: the label. Back to the list, tap the line, pick the name.
  await page.click('.steps li[data-step="1"]'); taps++;
  await page.click('.issues li.k-label'); taps++;
  await page.locator('button.chip', { hasText: 'חדר רחצה כללי' }).click(); taps++;
  check(await page.evaluate(() => window.__correct.S.plan.rooms.find((r) => r.id === 'r-bath-guest').name_he) === 'חדר רחצה כללי', 'error 2 fixed: guest bathroom renamed with two taps');

  // error 3: the missing door. Tap the line (zooms to the bathroom), tap the gap in the wall, tap "דלת", narrow it twice.
  await page.click('.steps li[data-step="1"]'); taps++;
  await page.click('.issues li.k-reach'); taps++;
  await page.click('[data-act="close"]'); taps++;
  const gap = [388, 1301.2];                 // where the drawing shows the bathroom door (the gap in the wall)
  const [gx, gy] = await screenOf(gap);
  await page.mouse.click(gx, gy); taps++;
  await page.screenshot({ path: join(shots, '3-desktop-wall-tap.png') });
  await page.click('[data-add="door"]'); taps++;
  await page.click('[data-w="-10"]'); taps++;
  await page.click('[data-w="-10"]'); taps++;
  const door = await page.evaluate(() => { const S = window.__correct.S; return S.plan.openings.find((o) => o.source === 'correction'); });
  check(!!door && door.rooms.includes('r-bath-main'), `error 3 fixed: door ${door?.id} ${door?.rooms?.join('|')} ${door?.width_cm} cm`);
  await page.screenshot({ path: join(shots, '4-desktop-door-added.png') });

  // step 3: confirm
  await page.click('#next'); taps++;
  if (!(await page.$('#save'))) { await page.click('#next'); taps++; }
  await page.click('#save'); taps++;
  await page.waitForSelector('#save-out p');
  const saved = await page.textContent('#save-out');
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  check(saved.includes('נשמר'), `saved through "אשר ושמור": ${saved.trim().split('\n')[0]}`);
  await page.screenshot({ path: join(shots, '5-desktop-saved.png') });
  const left = await issueCount();
  check(left === 1, `issues left after the fix: ${left} (expected 1: the ground truth's own main-bathroom 3.6% dimension)`);
  const corr = JSON.parse(readFileSync(join(out, 'corrections.json'), 'utf8'));
  check(corr.filter((c) => !c.undone).length >= 5, `corrections.json: ${corr.length} entries [${corr.map((c) => c.type).join(', ')}]`);
  check(existsSync(join(out, 'plan.json')), 'plan.json written (validate-plan passed on the server)');
  check(!requests.some((u) => !u.startsWith(base)), `no request left 127.0.0.1 (${requests.length} requests)`);
  check(!errors.length, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  console.log(`RESULT three errors fixed with ${taps} taps + ${drags} drag, 0 keystrokes, scripted run ${secs} s`);

  // ------------------------------------------------------------- tablet --
  const ctx = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, locale: 'he-IL' });
  const tab = await ctx.newPage();
  await tab.goto(base);
  await tab.waitForSelector('#plan polygon.room');
  // the previous session was saved, so there is nothing to resume; tap a room
  const cam = report.rooms.find((r) => r.room_id === 'r-bedroom-2');
  const [cx, cy] = await tab.evaluate(() => {
    const S = window.__correct.S; const c = S.plan.camera_points.find((x) => x.room_id === 'r-bedroom-2');
    const svg = document.querySelector('#plan'); const [x, y] = window.__correct.toPx([c.x, c.y]);
    const p = svg.createSVGPoint(); p.x = x; p.y = y; const q = p.matrixTransform(svg.getScreenCTM()); return [q.x, q.y];
  });
  await tab.touchscreen.tap(cx, cy);
  await tab.waitForSelector('.card .cardtitle');
  check((await tab.textContent('.card .cardtitle')).includes('חדר שינה'), `tablet 820x1180: a touch tap selects the room (${cam.room_id})`);
  const panelBox = await tab.$eval('#panel', (e) => { const r = e.getBoundingClientRect(); return [r.top, r.height]; });
  check(panelBox[0] > 500, `tablet: the panel sits under the plan (top ${Math.round(panelBox[0])} px)`);
  const small = await tab.$$eval('#panel button, .zoom button', (bs) => bs.filter((b) => b.offsetParent && b.getBoundingClientRect().height < 40).length);
  check(small === 0, `tablet: every visible button is at least 40 px tall (${small} smaller)`);
  await tab.screenshot({ path: join(shots, '6-tablet-room.png') });
} catch (e) { fails++; console.log('FAIL exception: ' + (e.stack || e)); }
srv.kill();
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
rmSync(out, { recursive: true, force: true });
console.log(fails ? `ui-run FAIL (${fails})` : 'ui-run OK');
process.exit(fails ? 1 : 0);
