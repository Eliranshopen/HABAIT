// point-move-check.mjs — the tour's point-to-point movement (plan development/plans/2026-11-11-tour-point-move.md).
//   node Habait/tour360/tools/point-move-check.mjs <tour url, e.g. http://127.0.0.1:8871/dist1/index.html> --out <dir> [--room living]
// Desktop (1440×900, a mouse and a keyboard): a click on the floor under each way out of the room lands in that room; a click toward a
// side with no way stays and pulses the door rings; a drag stays; the ring under the mouse is lit and the cursor is a hand.
// The arrow keys on the desktop work as a person walking: ↑ steps to the way ahead, ← → turn the view while held (a short press = a
// small turn) and move nowhere, ↓ steps back to the way behind and arrives still facing the room just left; ↑ with no way ahead stays
// and says so; every press is named on the screen; every viewpoint is reached with the keys alone. No walking arrows on any screen.
// Phone (390×844, touch): no joystick (removed 2026-11-11 on Eliran's word); every viewpoint is reached by taps on the door rings; a
// tap on the picture hides / shows the controls.
// Both: no page error, no horizontal scroll, the disclosure stays. Exit code 1 on any failure. No paid call, no upload.
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const { chromium } = createRequire((process.env.HABAIT_APP_DIR || 'C:/RnD/Projects/Habait/tools/appdeps') + '/package.json')('playwright-core');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const base = process.argv[2]; if (!base || base.startsWith('--')) { console.error('usage: point-move-check.mjs <tour url> --out <dir>'); process.exit(2); }
const OUT = arg('--out', null); if (OUT) fs.mkdirSync(OUT, { recursive: true });
const ROOM = arg('--room', 'living');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const url = (room, extra = '') => `${base}${base.includes('?') ? '&' : '?'}scope=apartment&room=${room}&floor=parquet&video=0&coach=0&auto=0${extra}`;
const fails = []; const fail = (size, m) => { fails.push(size + ': ' + m); console.log('  FAIL', size, m); };
const shot = async (page, name) => { if (OUT) await page.screenshot({ path: path.join(OUT, name + '.png') }); };

const ready = (page) => page.waitForFunction(() => window.__tour && window.__tour.ready && window.__tour.viewer && window.__tour.viewer.isLoaded() && window.__tour.nav && !window.__tour.nav.busy, null, { timeout: 40000 });
const scene = (page) => page.evaluate(() => window.__tour.scene);
const exitsOf = (page) => page.evaluate(() => (window.__tour.viewer.getConfig().hotSpots || []).filter((h) => h.type === 'scene' && h.createTooltipArgs).map((h) => ({ to: h.createTooltipArgs.to, yaw: h.yaw, pitch: h.pitch })));
const waitScene = async (page, id, ms = 9000) => { try { await page.waitForFunction((x) => window.__tour.scene === x && window.__tour.viewer.isLoaded() && !window.__tour.nav.busy, id, { timeout: ms }); return true; } catch { return false; } };
const common = async (page, size, errors) => {
  const r = await page.evaluate(() => {
    const vis = (id) => { const n = document.getElementById(id); if (!n) return false; const b = n.getBoundingClientRect(); const cs = getComputedStyle(n); return b.width > 4 && b.height > 4 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.5 && n.textContent.trim().length > 0; };
    return { overflow: document.documentElement.scrollWidth > window.innerWidth + 1, badge: vis('tour-badge') || vis('t-badge-mini'), concept: vis('tour-concept'), ai: vis('t-ai-text') };
  });
  if (r.overflow) fail(size, 'horizontal scroll'); if (!r.badge) fail(size, 'the הדמיה badge is not shown'); if (!r.concept) fail(size, 'the concept line is not shown'); if (!r.ai) fail(size, 'the AI line is not shown');
  if (errors.length) fail(size, 'page errors: ' + errors.join(' | '));
};

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });

/* ── desktop ─────────────────────────────────────────────────────────────────── */
{
  const size = '1440'; const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url(ROOM), { waitUntil: 'load' }); await ready(page);
  const mode = await page.evaluate(() => window.__tour.nav.mode); if (mode !== 'keys') fail(size, 'mode is ' + mode + ', expected keys');
  const exits = await exitsOf(page); console.log(size, ROOM, 'ways out:', exits.map((e) => e.to).join(', '));
  if (!exits.length) fail(size, 'no ways out of ' + ROOM);
  // the floor point under a ring: the ring's own column, 110 px lower (below its label), kept clear of the bottom chrome
  const floorUnder = async (to) => page.evaluate((id) => {
    const h = (window.__tour.viewer.getConfig().hotSpots || []).find((x) => x.type === 'scene' && x.createTooltipArgs && x.createTooltipArgs.to === id);
    if (!h || !h.div) return null; const b = h.div.getBoundingClientRect(); const x = b.left + b.width / 2;
    for (const dy of [110, 140, 85, 170, -90, -130]) {
      const y = b.top + b.height / 2 + dy; const el = document.elementFromPoint(x, y);
      if (el && (el.classList.contains('pnlm-dragfix') || el.classList.contains('pnlm-render-container') || el.tagName === 'CANVAS')) return { x, y };
    }
    return null;
  }, to);
  for (const e of exits) {
    await page.goto(url(ROOM), { waitUntil: 'load' }); await ready(page);
    await page.evaluate((y) => window.__tour.viewer.lookAt(-8, y + 12, undefined, false), e.yaw); await sleep(350);
    const p = await floorUnder(e.to); if (!p) { fail(size, 'no clear floor point under the ring to ' + e.to); continue; }
    await page.mouse.move(p.x - 30, p.y - 4); await page.mouse.move(p.x, p.y, { steps: 4 }); await sleep(200);
    const hov = await page.evaluate((id) => { const a = window.__tour.nav.aim; return { aim: a && a.createTooltipArgs.to, lit: Boolean(a && a.div && a.div.classList.contains('is-aim')), hand: document.getElementById('pano').classList.contains('can-go') }; }, e.to);
    if (hov.aim !== e.to || !hov.lit || !hov.hand) fail(size, `hover toward ${e.to}: ${JSON.stringify(hov)}`);
    if (e === exits[0]) await shot(page, 'desktop-hover');
    await page.mouse.click(p.x, p.y);
    if (e === exits[0]) { await sleep(320); await shot(page, 'desktop-moving'); }
    const ok = await waitScene(page, e.to); const at = await scene(page);
    console.log(' ', size, 'click toward', e.to, '→', at, ok ? 'OK' : 'BAD'); if (!ok) fail(size, `a click toward ${e.to} ended in ${at}`);
    if (e === exits[0]) { await sleep(900); await shot(page, 'desktop-arrived'); }
  }
  // a side with no way: the middle of the widest gap between the ways out
  await page.goto(url(ROOM), { waitUntil: 'load' }); await ready(page);
  { const ys = exits.map((e) => ((e.yaw % 360) + 360) % 360).sort((a, b) => a - b); let gap = 0, mid = 0;
    for (let i = 0; i < ys.length; i++) { const a = ys[i], b = i + 1 < ys.length ? ys[i + 1] : ys[0] + 360; if (b - a > gap) { gap = b - a; mid = a + (b - a) / 2; } }
    if (gap / 2 > 45) {
      await page.evaluate((y) => window.__tour.viewer.lookAt(-10, y, undefined, false), mid); await sleep(350);
      const moves = await page.evaluate(() => window.__tour.nav.moves);
      await page.mouse.click(720, 520); await sleep(150);
      const pulse = await page.evaluate(() => document.getElementById('pano').classList.contains('is-nowhere'));
      await sleep(1500); const at = await scene(page); const moves2 = await page.evaluate(() => window.__tour.nav.moves);
      console.log(' ', size, 'click toward a blank side (gap ' + Math.round(gap) + '°) →', at, 'pulse', pulse);
      if (at !== ROOM || moves2 !== moves) fail(size, 'a click toward a blank side moved to ' + at); if (!pulse) fail(size, 'no pulse on a click with no way');
    } else console.log(' ', size, 'no blank side in', ROOM, '(widest gap ' + Math.round(gap) + '°): skipped');
  }
  // a drag is not a click
  { const e = exits[0]; await page.evaluate((y) => window.__tour.viewer.lookAt(-8, y + 12, undefined, false), e.yaw); await sleep(350);
    const p = await floorUnder(e.to);
    if (p) { await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(p.x + 90, p.y + 10, { steps: 6 }); await page.mouse.up(); await sleep(1500);
      const at = await scene(page); console.log(' ', size, 'drag →', at); if (at !== ROOM) fail(size, 'a drag moved to ' + at); } }
  await common(page, size, errors); await ctx.close();
}

/* ── the four directions, as a person walking: the keyboard (desktop) and the joystick (phone) ── */
const KEY = { up: 'ArrowUp', right: 'ArrowRight', down: 'ArrowDown', left: 'ArrowLeft' };
const press = async (page, dir, touch) => { if (touch) await page.tap('#t-joy [data-dir="' + dir + '"]'); else await page.keyboard.press(KEY[dir]); };
// ← → are held: the view turns for as long as the key / the button is down
const hold = async (page, dir, ms, touch) => {
  if (touch) { await page.dispatchEvent('#t-joy [data-dir="' + dir + '"]', 'pointerdown', { pointerId: 7, pointerType: 'touch', isPrimary: true }); await sleep(ms); await page.dispatchEvent('#t-joy [data-dir="' + dir + '"]', 'pointerup', { pointerId: 7, pointerType: 'touch', isPrimary: true }); }
  else { await page.keyboard.down(KEY[dir]); await sleep(ms); await page.keyboard.up(KEY[dir]); }
  await sleep(260);
};
const hud = (page) => page.evaluate(() => { const n = document.getElementById('t-nav-hud'); const h = window.__tour.nav.hud || {}; return { kind: h.kind, dir: h.dir, n: h.n || 0, on: n.classList.contains('is-on'), text: document.getElementById('t-nav-hud-text').textContent, shown: n.dataset.dir }; });
const picks = (page) => page.evaluate(() => ({ up: window.__tour.nav.pick('up'), down: window.__tour.nav.pick('down') }));
const yawOf = (page) => page.evaluate(() => window.__tour.viewer.getYaw());
const turned = (a, b) => ((b - a + 540) % 360) - 180;
const stat = { turns: 0, back: 0 };
// go to a linked viewpoint as a walker does: turn (→ held) until that way is ahead or behind, then step ↑ or ↓
const goTo = async (page, size, to, touch) => {
  const trail = [];
  for (let i = 0; i < 40; i++) {
    const p = await picks(page); const dir = p.up === to ? 'up' : (p.down === to ? 'down' : null); trail.push(Math.round(await yawOf(page)) + ':' + p.up + '/' + p.down);
    if (dir) {
      const before = (await hud(page)).n; await press(page, dir, touch); await sleep(120); const h = await hud(page);
      if (h.n === before || h.kind !== 'go' || h.dir !== dir || !h.on || !h.text.trim() || h.shown !== dir) fail(size, `no on-screen word for ${dir} → ${to}: ${JSON.stringify(h)}`);
      if (dir === 'down') stat.back++;
      return waitScene(page, to);
    }
    await hold(page, 'right', 230, touch); stat.turns++;
  }
  console.log('    trail to ' + to + ': ' + trail.join('  ')); return false;
};
const walkAll = async (page, size, touch, shotName) => {
  const seen = new Set(); let moves = 0; stat.turns = 0; stat.back = 0;
  const walk = async (id) => {
    seen.add(id);
    for (const e of await exitsOf(page)) {
      if (seen.has(e.to)) continue;
      if (!(await goTo(page, size, e.to, touch))) { fail(size, `the directions did not go ${id} → ${e.to} (at ${await scene(page)})`); return; }
      moves++; if (moves === 1) { await sleep(900); await shot(page, shotName); }
      await sleep(300); await walk(e.to);
      if ((await scene(page)) !== id) {
        const hasBack = (await exitsOf(page)).some((x) => x.to === id);
        if (!hasBack) { await page.goto(url(id), { waitUntil: 'load' }); await ready(page); await sleep(500); stat.strip = (stat.strip || 0) + 1; }   // no door leads straight back: the room strip
        else if (!(await goTo(page, size, id, touch))) { fail(size, `the directions did not come back ${e.to} → ${id}`); return; } else { moves++; await sleep(300); }
      }
    }
  };
  await walk(ROOM);
  console.log(' ', size, 'reached by the four directions alone:', seen.size, 'viewpoints in', moves, 'steps (' + stat.back + ' of them backward) and', stat.turns, 'turns:', [...seen].join(', '));
  if (seen.size < 11) fail(size, 'only ' + seen.size + ' viewpoints reached by the directions');
};
const walkerCases = async (page, size, touch) => {
  const exits = await exitsOf(page); const tag = touch ? 'phone' : 'desktop';
  // ← → turn the view and move nowhere; a held press turns more than a short one; the two sides are opposite
  { const y0 = await yawOf(page); await hold(page, 'right', 60, touch); const y1 = await yawOf(page); const h1 = await hud(page);
    await hold(page, 'right', 700, touch); const y2 = await yawOf(page); await hold(page, 'left', 700, touch); const y3 = await yawOf(page); const h3 = await hud(page);
    const a = turned(y0, y1), b = turned(y1, y2), c = turned(y2, y3); const at = await scene(page);
    console.log(' ', size, 'turns: short →', Math.round(a) + '°, held →', Math.round(b) + '°, held ←', Math.round(c) + '°, still in', at);
    if (!(a > 6 && a < 40)) fail(size, 'a short → turned ' + Math.round(a) + '°'); if (!(b > a + 15)) fail(size, 'a held → turned ' + Math.round(b) + '°'); if (!(c < -30)) fail(size, 'a held ← turned ' + Math.round(c) + '°');
    if (at !== ROOM) fail(size, '← → moved to ' + at); if (h1.kind !== 'turn' || h1.dir !== 'right' || h3.kind !== 'turn' || h3.dir !== 'left') fail(size, 'no on-screen word for the turns: ' + JSON.stringify([h1, h3])); }
  // ↑ with no way ahead stays and says so
  { const ys = exits.map((e) => ((e.yaw % 360) + 360) % 360).sort((a, b) => a - b); let gap = 0, mid = 0;
    for (let i = 0; i < ys.length; i++) { const a = ys[i], b = i + 1 < ys.length ? ys[i + 1] : ys[0] + 360; if (b - a > gap) { gap = b - a; mid = a + (b - a) / 2; } }
    if (gap / 2 > 55) {
      await page.evaluate((y) => window.__tour.viewer.lookAt(-4, y, undefined, false), mid); await sleep(300);
      await press(page, 'up', touch); await sleep(250); const h = await hud(page); await shot(page, tag + '-no-way'); await sleep(900); const at = await scene(page);
      console.log(' ', size, '↑ with no way ahead →', at, h.kind, h.text);
      if (at !== ROOM || h.kind !== 'none' || !h.on) fail(size, '↑ with no way ahead: ' + at + ' ' + JSON.stringify(h));
    } }
  // ↓ = a step back: to the way behind, still facing the way the visitor faced (the room just left is ahead)
  { const e = exits[0]; await page.evaluate((y) => window.__tour.viewer.lookAt(-2, y + 180, undefined, false), e.yaw); await sleep(300);
    const p = await picks(page);
    if (p.down !== e.to) fail(size, 'facing away from ' + e.to + ', ↓ picks ' + p.down); else {
      await press(page, 'down', touch); await sleep(250); const h = await hud(page); await shot(page, tag + '-step-back'); const ok = await waitScene(page, e.to); await sleep(500);
      const ahead = await page.evaluate(() => window.__tour.nav.pick('up'));
      console.log(' ', size, '↓ from', ROOM, '→', await scene(page), '· word:', h.text, '· ahead after the step:', ahead);
      if (!ok || h.kind !== 'go' || h.dir !== 'down') fail(size, '↓ did not step back to ' + e.to + ': ' + JSON.stringify(h));
      if (ahead !== ROOM) fail(size, 'after a step back the room just left is not ahead (ahead: ' + ahead + ')');
    } }
};
{
  const size = '1440'; const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url(ROOM), { waitUntil: 'load' }); await ready(page); await sleep(800);
  const ui = await page.evaluate(() => ({ joy: (() => { const n = document.getElementById('t-joy'); return Boolean(n) && !n.hidden; })(), walk: Boolean(document.getElementById('t-walk')), ring: (() => { const r = document.querySelector('.t-hs .t-hs-arrow, .t-hs .t-hs-ring'); return r ? getComputedStyle(r).display : 'none'; })()   /* 2026-11-12: the room buttons are floor arrows */ }));
  if (ui.joy) fail(size, 'the joystick shows on a mouse screen'); if (ui.walk) fail(size, 'the floor arrows are still in the page'); if (ui.ring === 'none') fail(size, 'the door rings are not shown');
  { const p = await picks(page); if (p.up) { await press(page, 'up', false); await sleep(260); await shot(page, 'desktop-key-word'); await waitScene(page, p.up); await sleep(400); }
    await page.goto(url(ROOM), { waitUntil: 'load' }); await ready(page); await sleep(500); }
  await walkerCases(page, size, false);
  await page.goto(url(ROOM), { waitUntil: 'load' }); await ready(page); await sleep(500);
  await walkAll(page, size, false, 'desktop-key-arrived');
  await common(page, size, errors); await ctx.close();
}
{
  const size = '390'; const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url(ROOM), { waitUntil: 'load' }); await ready(page); await sleep(1200);
  // no walking arrows on a phone (Eliran 2026-11-11); it moves by a tap on a door ring
  if (await page.evaluate(() => Boolean(document.getElementById('t-joy') || document.getElementById('t-walk') || document.getElementById('t-nav')))) fail(size, 'walking arrows are still in the page');
  await shot(page, 'phone-no-arrows');
  const seen = new Set([ROOM]); let moves = 0;
  const tapRing = async (to) => {
    for (let i = 0; i < 20; i++) {
      const p = await page.evaluate((id) => { const h = (window.__tour.viewer.getConfig().hotSpots || []).find((x) => x.type === 'scene' && x.createTooltipArgs && x.createTooltipArgs.to === id); if (!h || !h.div) return null; const b = h.div.getBoundingClientRect(); const x = b.left + b.width / 2, y = b.top + b.height / 2; const e = document.elementFromPoint(x, y); return x > 30 && x < 360 && y > 150 && y < 700 && e && h.div.contains(e) ? { x, y } : null; }, to);
      if (p) { await page.touchscreen.tap(p.x, p.y); return waitScene(page, to); }
      const y = await page.evaluate((id) => { const h = (window.__tour.viewer.getConfig().hotSpots || []).find((x) => x.type === 'scene' && x.createTooltipArgs && x.createTooltipArgs.to === id); return h ? [h.yaw, h.pitch] : null; }, to);
      if (y === null) return false;
      await page.evaluate(([yy, pp, k]) => window.__tour.viewer.lookAt(pp + 6 - k * 3, yy + (k % 2 ? 5 : -5) * Math.ceil(k / 2), undefined, false), [y[0], y[1], i]); await sleep(350);   // the visitor drags the picture until the ring is clear of the controls (a ring under them is hidden by design)
    }
    return false;
  };
  const walk = async (id) => {
    for (const e of await exitsOf(page)) {
      if (seen.has(e.to)) continue;
      if (!(await tapRing(e.to))) { fail(size, `a tap on the ring did not go ${id} → ${e.to} (at ${await scene(page)})`); return; }
      seen.add(e.to); moves++; if (moves === 1) { await sleep(900); await shot(page, 'phone-ring-arrived'); }
      await sleep(300); await walk(e.to);
      if ((await scene(page)) !== id) { const back = (await exitsOf(page)).find((x) => x.to === id); if (!back || !(await tapRing(id))) { await page.goto(url(id), { waitUntil: 'load' }); await ready(page); await sleep(600); } else moves++; await sleep(300); }
    }
  };
  await walk(ROOM);
  console.log(' ', size, 'reached by taps on the door rings:', seen.size, 'viewpoints in', moves, 'taps:', [...seen].join(', '));
  if (seen.size < 11) fail(size, 'only ' + seen.size + ' viewpoints reached by the rings');
  { await page.touchscreen.tap(150, 330); await sleep(900); const off = await page.evaluate(() => document.documentElement.classList.contains('t-chrome-off')); await page.touchscreen.tap(150, 330); await sleep(900); const on = await page.evaluate(() => document.documentElement.classList.contains('t-chrome-off'));
    if (!off || on) fail(size, 'a tap on the picture does not hide / show the controls: ' + off + ' ' + on); }
  await common(page, size, errors); await ctx.close();
}
await browser.close();
console.log(fails.length ? 'point-move-check: FAIL (' + fails.length + ')\n - ' + fails.join('\n - ') : 'point-move-check: PASS');
process.exit(fails.length ? 1 : 0);
