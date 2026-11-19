// card 34: the real flight end to end: flow.html?project=rainbow&real=1 on iPhone 13, Pixel 7 (Hebrew) and desktop (English).
//   export HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps && node test/flow-real.test.mjs [shotsDir]
// Needs: tools/build_segments.mjs --project rainbow run once (fixtures/rainbow/flow.real.json + _local/segments/rainbow/),
// playwright-core + sharp ($HABAIT_APP_DIR/node_modules), Chrome (H.264) at $CHROME_PATH or Program Files.
// Starts its own platform server on a free port (serve.mjs's handler; POST /api/events is answered 204 here so test runs
// leave _local/events.jsonl alone) and serves habait-98's built tour (Habait/tour360/dist/apt846, read-only) on the origin
// of units.json's tour_url (127.0.0.1:8848) by request interception, so the hand-off is checked against the real viewer.
// Per device: 8 screenshots along the flow (approach start, the orbit, the hold loop, unit card, descent, enter, enter's last
// frame, the tour; with the orbit not rendered the second shot is the approach dissolving into the hold), the caption v1 checked in each (band on top and on screen, the expected overlay variant, no "{"),
// nothing modal and no spinner ever, the viewer's yaw never reset between segments, the tour opened on the hand-off room at
// the buyer's yaw (habait:view from the tour), the seam between enter's last frame and the tour measured on the screen,
// and zero requests outside 127.0.0.1. The desktop run turns the view by ~30 deg during the descent (non-zero yaw hand-off).
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, dirname, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { handle } from '../serve.mjs';
import { validateSchema, flowSchema, crossCheck } from '../contracts/validate.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const PLATFORM = resolve(here, '..');
const HABAIT = resolve(PLATFORM, '..');
const FIX = join(PLATFORM, 'fixtures/rainbow');
const SEGDIR = join(PLATFORM, '_local/segments/rainbow');
const TOUR_DIST = join(HABAIT, 'tour360/dist/apt846');
const SCENES = join(HABAIT, 'tour360/apartments/apt846/scenes.json');
const CAPTION = resolve(HABAIT, '..', '..', 'data/sales-plans/legal/caption-v1.json');
const shots = process.argv[2] || join(PLATFORM, 'test/shots/flow-real');
mkdirSync(shots, { recursive: true });
const readJSON = (p) => JSON.parse(readFileSync(p, 'utf8'));
const wrap180 = (d) => { const r = ((((d + 180) % 360) + 360) % 360) - 180; return r === -180 ? 180 : r; };

const req = createRequire(import.meta.url);
function fromAppDir(name) {
  const cands = [process.env.HABAIT_APP_DIR && join(process.env.HABAIT_APP_DIR, 'noop.js'), 'C:/RnD/Projects/Habait/tools/appdeps/noop.js', join(PLATFORM, 'noop.js')].filter(Boolean);
  for (const c of cands) { try { return createRequire(c)(name); } catch { /* next */ } }
  try { return req(name); } catch { throw new Error(`${name} not found; export HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps`); }
}
const pw = (() => { try { return process.env.PLAYWRIGHT_CORE ? req(process.env.PLAYWRIGHT_CORE) : fromAppDir('playwright-core'); } catch (e) { throw e; } })();
const sharp = fromAppDir('sharp');
const chromePath = process.env.CHROME_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);

let ok = 0, failures = 0;
const step = async (name, fn) => {
  try { const r = await fn(); ok++; console.log('ok   ' + name + (r ? `  (${r})` : '')); return r; }
  catch (e) { failures++; console.log('FAIL ' + name + '\n     ' + String(e.message || e).split('\n').slice(0, 3).join('\n     ')); return null; }
};

// ---------------- 1. the data: flow.real.json, segments.json, caption, junctions, hand-off ----------------
const units = readJSON(join(FIX, 'units.json'));
const project = readJSON(join(FIX, 'project.json'));
let flow = null, seg = null;
await step('flow.real.json + segments.json exist (tools/build_segments.mjs --project rainbow ran)', () => {
  assert.ok(existsSync(join(FIX, 'flow.real.json')), 'fixtures/rainbow/flow.real.json missing: run tools/build_segments.mjs --project rainbow');
  assert.ok(existsSync(join(SEGDIR, 'segments.json')), '_local/segments/rainbow/segments.json missing');
  flow = readJSON(join(FIX, 'flow.real.json'));
  seg = readJSON(join(SEGDIR, 'segments.json'));
  return `${flow.segments.length} segments, built ${seg.generated_at}`;
});
if (!flow || !seg) { console.log(`\nflow real: ${ok}/${ok + failures} ok, caption on 0/0 shots, handoff yaw n/a`); process.exit(1); }
const byId = new Map(seg.segments.map((s) => [s.id, s]));
const HAS_ORBIT = seg.chain.includes('orbit');
const HOLD_LOOP = byId.get('hold-facade').kind === 'video';
const enterMeta = seg.segments.find((s) => s.role === 'enter');

await step('flow.real.json is a valid flow.v0 chain and cross-checks with units.json (every src on disk)', () => {
  assert.deepEqual(validateSchema(flowSchema, flow), []);
  const x = crossCheck({ units, flow, project, dir: FIX });
  assert.deepEqual(x.errors, []);
  const ids = flow.segments.map((s) => s.id);
  if (HAS_ORBIT) {
    assert.deepEqual(ids, ['approach', 'orbit', 'hold-facade', 'descend-846', 'enter-846']);
    assert.deepEqual(flow.segments.map((s) => s.next), ['orbit', 'hold-facade', null, 'enter-846', 'handoff']);
  } else {
    assert.deepEqual(ids, ['approach', 'hold-facade', 'descend-846', 'enter-846']);
    assert.deepEqual(flow.segments.map((s) => s.next), ['hold-facade', null, 'enter-846', 'handoff']);
  }
  assert.deepEqual(ids, seg.chain);
  assert.equal(flow.start, 'approach');
  const hold = flow.segments.find((s) => s.role === 'hold');
  assert.equal(hold.loop, true);
  return `${ids.join(' > ')}; hold = ${hold.kind}${hold.kind === 'video' ? ' loop' : ' still'}; ${x.warnings.length} warnings (units.json placeholder hotspot windows)`;
});

await step('every segment names its source (real frames or the documented fallback)', () => {
  const src = seg.segments.map((s) => `${s.id}=${s.source.type}${s.source.partial ? `(partial ${s.source.frames_used}/${s.source.frames_planned})` : s.source.frames_used ? `(${s.source.frames_used})` : ''}`);
  for (const s of seg.segments) {
    assert.ok(['frames', 'pano', 'fallback-dissolve'].includes(s.source.type), s.id);
    if (s.kind === 'video') for (const f of [s.src, s.poster, s.last]) assert.ok(existsSync(join(SEGDIR, f)), f);
    else assert.ok(existsSync(join(SEGDIR, s.src)), s.src);
  }
  const ap = byId.get('approach');
  if (ap.source.partial) assert.ok(ap.tail && ap.tail.hold > 0 && ap.tail.into === 'hold-facade', 'partial approach must end in a dissolve into the hold');
  if (enterMeta.source.type === 'fallback-dissolve') assert.equal(enterMeta.frames, 96, 'the enter fallback follows the 96-frame camera timeline');
  const hold = byId.get('hold-facade');
  if (hold.kind === 'video') {
    assert.equal(hold.source.type, 'frames'); assert.equal(hold.loop, true);
    assert.equal(hold.hotspots_by_frame.length, hold.frames, 'the loop needs card 19 hotspots for every frame');
    assert.ok(Object.keys(hold.hotspots).length >= 9);
  } else assert.equal(hold.source.type, 'pano');
  return src.join(', ');
});

const capSrc = readJSON(CAPTION);
const planDate = seg.caption.plan_date;
const expectCap = (lang, variant, unit = '846') => capSrc[lang][variant].replace('{PROJECT}', project.name[lang]).replace('{PLAN_DATE}', planDate).replace('{UNIT}', unit);
await step('caption in segments.json = caption-v1.json short_project / micro / short, project + plan date filled', () => {
  assert.equal(planDate, '15.10.2025');
  for (const l of ['he', 'en']) {
    assert.equal(seg.caption[l].short_project, expectCap(l, 'short_project'));
    assert.equal(seg.caption[l].micro, expectCap(l, 'micro'));
    assert.equal(seg.caption[l].short.replace('{UNIT}', '846'), expectCap(l, 'short'));
    assert.ok(!seg.caption[l].short_project.includes('{') && !seg.caption[l].micro.includes('{'));
  }
  return `${seg.caption.id}, ${seg.caption.status}`;
});

let dataYaw = '';
await step('yaw continuity in the data: every junction that shares a pose has dpos <= 0.05 m and dyaw <= 0.05 deg; the gap is a dissolve', () => {
  const out = [];
  for (let i = 0; i < seg.segments.length - 1; i++) {
    const s = seg.segments[i], j = s.junction;
    assert.ok(j, `${s.id} has no junction record`);
    if (j.gap) { assert.ok(s.tail && s.tail.hold > 0, `${s.id} -> ${j.to}: a gap without a dissolve`); out.push(`${s.id}->${j.to} gap ${j.dpos_m} m (dissolve, seam ${j.seam_mae})`); continue; }
    assert.ok(j.dpos_m <= 0.05, `${s.id} -> ${j.to}: dpos ${j.dpos_m}`);
    assert.ok(j.dyaw_deg <= 0.05, `${s.id} -> ${j.to}: dyaw ${j.dyaw_deg}`);
    out.push(`${s.id}->${j.to} ${j.dpos_m} m ${j.dyaw_deg} deg seam ${j.seam_mae}`);
  }
  dataYaw = out.join('; ');
  return dataYaw;
});

await step('blends only where they belong: none across a same-look cut (clay -> clay), one across each look change', () => {
  const out = [];
  for (let i = 0; i < seg.segments.length - 1; i++) {
    const a = seg.segments[i], b = seg.segments[i + 1], j = a.junction;
    const same = a.look && b.look && a.look === b.look;
    const blended = !!(a.tail || (b.head && b.head.frames));
    if (same && !j.gap) assert.ok(!blended, `${a.id} -> ${b.id} (${a.look}) is blended`);
    if (!same && !j.gap) assert.ok(blended, `${a.id} -> ${b.id} (${a.look} -> ${b.look}) is a hard look cut`);
    out.push(`${a.id}->${b.id} ${a.look}->${b.look} ${j.gap ? 'dissolve' : blended ? 'blend' : 'cut'}`);
  }
  return out.join('; ');
});

await step('seams on the decoded videos: the frame shown before a cut = the first frame after it (MAE <= 6/255 at 512x256)', () => {
  const out = [];
  for (const s of seg.segments) if (s.junction) { assert.ok(s.junction.seam_mae <= 6, `${s.id} -> ${s.junction.to}: seam ${s.junction.seam_mae}`); out.push(`${s.junction.seam_mae}`); }
  return out.join(' / ');
});

const scenes = readJSON(SCENES);
const living = (scenes.scenes || scenes).find((s) => s.id === enterMeta.handoff.room);
await step('hand-off data: enter ends on the living panorama at bearing 111.3 = its centreBearingDeg (tour yaw offset 0, shift 0)', () => {
  const h = enterMeta.handoff;
  assert.equal(h.room, 'living');
  assert.equal(h.bearing_deg, living.centreBearingDeg);
  assert.ok(Math.abs(h.bearing_deg - 111.3) <= 0.05, `bearing ${h.bearing_deg}`);
  assert.ok(Math.abs(wrap180(h.last_camera_yaw - h.bearing_deg)) <= 0.1, `camera ${h.last_camera_yaw}`);
  assert.ok(Math.abs(h.tour_yaw_offset_deg) <= 0.1);
  assert.equal(h.last_frame_vs_pano.best_shift_deg, 0, `best shift ${h.last_frame_vs_pano.best_shift_deg}`);
  assert.ok(h.last_frame_vs_pano.mae <= 4, `last frame vs pano ${h.last_frame_vs_pano.mae}`);
  return `last frame vs ${h.pano}: MAE ${h.last_frame_vs_pano.mae}/255, shift ${h.last_frame_vs_pano.best_shift_deg} deg`;
});

// ---------------- 2. the browser ----------------
const holdShown = Object.entries(byId.get('hold-facade').hotspots).filter(([, h]) => h.visible_frac >= seg.hotspot_min_visible).map(([k]) => k).sort();
const tourOrigin = new URL(units.units.find((u) => u.id === '846').tour_url).origin;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.m4a': 'audio/mp4' };

const server = createServer((rq, rs) => {
  if ((rq.url || '').startsWith('/api/events')) { rs.writeHead(204); rs.end(); return; } // keep _local/events.jsonl clean
  handle(rq, rs).catch((e) => { console.error(e); if (!rs.headersSent) rs.writeHead(500); rs.end(); });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await pw.chromium.launch({ executablePath: chromePath, headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });

const dev = (name) => { const d = { ...pw.devices[name] }; delete d.defaultBrowserType; d.deviceScaleFactor = 2; return d; }; // DPR 2: the viewer caps at 2 anyway
const runs = [
  { name: 'iphone13', opts: dev('iPhone 13'), lang: 'he', drag: 0 },
  { name: 'pixel7', opts: dev('Pixel 7'), lang: 'he', drag: 0 },
  { name: 'desktop', opts: { viewport: { width: 1280, height: 800 } }, lang: 'en', drag: 30 },
];

let capOk = 0, capTotal = 0;
const handoffs = [];

async function raw(file) { const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, w: info.width, h: info.height }; }
function cropMae(a, b, dx = 0) {
  // mean |a-b| over the centre of the frame (x 25..75 %, y 30..70 %), b shifted by dx px
  let s = 0, n = 0;
  for (let y = Math.floor(a.h * 0.3); y < Math.floor(a.h * 0.7); y += 2) for (let x = Math.floor(a.w * 0.25); x < Math.floor(a.w * 0.75); x += 2) {
    const ia = (y * a.w + x) * 3, ib = (y * b.w + x + dx) * 3;
    s += Math.abs(a.data[ia] - b.data[ib]) + Math.abs(a.data[ia + 1] - b.data[ib + 1]) + Math.abs(a.data[ia + 2] - b.data[ib + 2]); n += 3;
  }
  return s / n;
}
// normalised cross-correlation of the grey levels over the part of the view the tour leaves free of widgets
// (x 15..85 %, y 22..55 %): the tour's own UI darkens the panorama (a veil), so structure, not brightness, decides the seam
function ncc(a, b, dx = 0) {
  const xs = [], ys = [];
  for (let y = Math.floor(a.h * 0.22); y < Math.floor(a.h * 0.55); y += 2) for (let x = Math.floor(a.w * 0.15); x < Math.floor(a.w * 0.85); x += 2) {
    const ia = (y * a.w + x) * 3, ib = (y * b.w + x + dx) * 3;
    xs.push(a.data[ia] * 0.299 + a.data[ia + 1] * 0.587 + a.data[ia + 2] * 0.114);
    ys.push(b.data[ib] * 0.299 + b.data[ib + 1] * 0.587 + b.data[ib + 2] * 0.114);
  }
  const m = (v) => v.reduce((p, q) => p + q, 0) / v.length, mx = m(xs), my = m(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < xs.length; i++) { const p = xs[i] - mx, q = ys[i] - my; sxy += p * q; sxx += p * p; syy += q * q; }
  return { ncc: sxy / Math.sqrt(sxx * syy), lum: my / mx };
}
function meanLum(a) { let s = 0, n = 0; for (let i = 0; i < a.data.length; i += 30) { s += a.data[i] + a.data[i + 1] + a.data[i + 2]; n += 3; } return s / n; }

for (const run of runs) {
  const context = await browser.newContext({ ...run.opts, locale: run.lang === 'he' ? 'he-IL' : 'en-US' });
  const external = [];
  context.on('request', (r) => { try { const u = new URL(r.url()); if (/^https?:$/.test(u.protocol) && !['127.0.0.1', 'localhost'].includes(u.hostname)) external.push(r.url()); } catch { /* data: etc */ } });
  await context.route(`${tourOrigin}/**`, async (route) => {
    const u = new URL(route.request().url());
    let p = decodeURIComponent(u.pathname); if (p.endsWith('/')) p += 'index.html';
    const f = normalize(join(TOUR_DIST, p));
    if (!f.startsWith(TOUR_DIST + sep) || !existsSync(f) || statSync(f).isDirectory()) return route.fulfill({ status: 404, body: 'not found' });
    return route.fulfill({ status: 200, path: f, contentType: MIME[extname(f).toLowerCase()] || 'application/octet-stream', headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && (m.location()?.url || '').startsWith(base)) errors.push('console: ' + m.text()); });
  const L = run.lang;
  const tag = `[${run.name}]`;
  const shotFiles = [];

  // one shot + the caption check; `variant` = the overlay expected (null = band only)
  async function shot(n, label, variant) {
    const file = join(shots, `${run.name}-${String(n).padStart(2, '0')}-${label}.png`);
    await page.screenshot({ path: file });
    shotFiles.push(file);
    const c = await page.evaluate(() => {
      const vis = (el, needTop) => {
        if (!el || el.hidden) return null;
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        const top = needTop ? document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 9)) : null;
        return { text: el.textContent, onScreen: r.width > 50 && r.height > 8 && r.top >= -1 && r.bottom <= innerHeight + 1, shown: cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.5,
          onTop: needTop ? !!top && (top === el || el.contains(top)) : null, font: parseFloat(cs.fontSize) };
      };
      return { band: vis(document.getElementById('legalBand'), true), over: vis(document.getElementById('legalOverlay'), false), variant: document.getElementById('legalOverlay')?.dataset.variant || null,
        modal: ['startOverlay', 'handoffOverlay', 'loading'].filter((id) => !document.getElementById(id).hidden) };
    });
    capTotal++;
    const bad = [];
    const wantBand = expectCap(L, 'micro');
    if (!c.band || !c.band.shown || !c.band.onScreen || !c.band.onTop) bad.push(`band not visible/on top ${JSON.stringify(c.band && { ...c.band, text: undefined })}`);
    else if (c.band.text !== wantBand) bad.push(`band text "${c.band.text}"`);
    if (variant) {
      const want = expectCap(L, variant);
      if (!c.over || !c.over.shown || !c.over.onScreen) bad.push(`overlay ${variant} not visible`);
      else if (c.over.text !== want) bad.push(`overlay text "${c.over.text.slice(0, 60)}…" != ${variant}`);
    }
    for (const t of [c.band?.text, c.over?.text]) if (t && t.includes('{')) bad.push('a "{" placeholder is on screen');
    if (c.modal.length) bad.push(`modal/spinner visible: ${c.modal.join(',')}`);
    const img = await raw(file);
    if (meanLum(img) < 18) bad.push(`black frame (mean ${meanLum(img).toFixed(1)})`);
    if (!bad.length) capOk++;
    if (bad.length) throw new Error(`${label}: ${bad.join('; ')}`);
    return `${label}: band${variant ? ` + ${variant}` : ''}`;
  }

  await page.goto(`${base}/flow.html?project=rainbow&real=1${L === 'en' ? '&lang=en' : ''}`);
  await step(`${tag} real flight loads: no start modal, frame 1 of approach up, approach plays (shot 1)`, async () => {
    await page.waitForFunction(() => window.__habait?.real && window.__habait.state.seg?.id === 'approach', null, { timeout: 20000 });
    await page.waitForFunction(() => window.__habait.state.activeVideo?.currentTime > 0.3 && window.__habait.real.log.some((e) => e.ev === 'swap' && e.seg === 'approach'), null, { timeout: 20000 });
    return shot(1, 'approach', 'short_project');
  });
  if (HAS_ORBIT) await step(`${tag} approach -> orbit, cut frame to frame; the orbit after its opening caption shows the band only (shot 2)`, async () => {
    await page.waitForFunction(() => window.__habait.state.seg?.id === 'orbit' && window.__habait.real.log.some((e) => e.ev === 'swap' && e.seg === 'orbit'), null, { timeout: 30000 });
    await page.waitForFunction(() => window.__habait.state.activeVideo?.currentTime > 4, null, { timeout: 20000 });
    return shot(2, 'orbit', null);
  });
  else await step(`${tag} approach dissolves into the hold still (shot 2)`, async () => {
    await page.waitForFunction(() => window.__habait.state.activeVideo?.currentTime > 2.3 || window.__habait.state.seg?.id !== 'approach', null, { timeout: 20000 });
    return shot(2, 'approach-dissolve', 'short_project');
  });
  await step(`${tag} hold: ${HOLD_LOOP ? 'the 72-frame clay loop at node-b' : 'the skinned facade still'}, ${holdShown.length} unit pills from card 19 (visible >= ${seg.hotspot_min_visible}), 846 among them (shot 3)`, async () => {
    await page.waitForFunction(() => window.__habait.state.seg?.id === 'hold-facade' && window.__habait.real.log.some((e) => e.ev === 'swap' && e.seg === 'hold-facade'), null, { timeout: 60000 });
    await page.waitForFunction(() => { const el = document.querySelector('.hotspot[data-unit="846"]'); return el && el.style.display !== 'none'; }, null, { timeout: 10000 });
    await page.waitForFunction(() => !window.__habait.real.viewEase, null, { timeout: 5000 }); // the hold framing settled
    await page.waitForTimeout(300);
    const pills = await page.evaluate(() => [...document.querySelectorAll('.hotspot[data-unit]')].filter((h) => h.style.display !== 'none').map((h) => h.dataset.unit).sort());
    assert.deepEqual(pills, holdShown);
    let loop = '';
    if (HOLD_LOOP) {
      const a = await page.evaluate(() => { const v = window.__habait.state.activeVideo; return v && { loop: v.loop, t: v.currentTime, src: v.dataset.seg }; });
      await page.waitForTimeout(400);
      const b2 = await page.evaluate(() => window.__habait.state.activeVideo.currentTime);
      if (!a || a.src !== 'hold-facade' || !a.loop) throw new Error(`the hold is not a looping video: ${JSON.stringify(a)}`);
      if (Math.abs(b2 - a.t) < 0.1) throw new Error(`the hold loop does not play (t ${a.t} -> ${b2})`);
      loop = `, loop playing (t ${a.t.toFixed(2)} -> ${b2.toFixed(2)})`;
    }
    return (await shot(3, 'hold', 'short_project')) + `, pills ${pills.join(' ')}${loop}`;
  });
  await step(`${tag} tap 846 (a real click: Playwright refuses an obscured pill) -> the unit card; the caption band stays visible (shot 4)`, async () => {
    const hit = await page.evaluate(() => { const el = document.querySelector('.hotspot[data-unit="846"]'); const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return top && top.closest('.hotspot')?.dataset.unit; });
    if (hit !== '846') throw new Error(`the centre of the 846 pill is covered by ${hit}`);
    await page.click('.hotspot[data-unit="846"]', { timeout: 5000 });
    await page.waitForSelector('#unitSheet:not([hidden])');
    await page.waitForTimeout(350);
    const r = await shot(4, 'card', null);
    if (!HOLD_LOOP) return r;
    await page.waitForFunction(() => window.__habait.state.activeVideo.paused, null, { timeout: 2000 }).catch(() => {});
    const st = await page.evaluate(() => ({ paused: window.__habait.state.activeVideo.paused, t: window.__habait.state.activeVideo.currentTime }));
    if (!st.paused) throw new Error('the hold keeps looping while the card is open (it should pause in place)');
    return `${r}, loop paused under the card at t ${st.t.toFixed(2)}`;
  });
  await step(`${tag} continue -> descend-846 starts on the hold frame, the video texture moves (shot 5)`, async () => {
    await page.click('#unitContinue');
    await page.waitForFunction(() => window.__habait.state.seg?.id === 'descend-846', null, { timeout: 10000 });
    await page.waitForFunction(() => window.__habait.state.activeVideo?.currentTime > 1.2, null, { timeout: 20000 });
    const r = await shot(5, 'descend', 'short_project');
    const cut = await page.evaluate(() => window.__habait.real.log.filter((e) => e.ev === 'segment' && e.seg === 'descend-846').pop());
    if (HOLD_LOOP && !(cut.hold && cut.hold.rest)) throw new Error(`the descent started from the hold loop off its rest pose: ${JSON.stringify(cut.hold)}`);
    if (run.drag) {
      const box = await (await page.$('#viewer')).boundingBox();
      const vfov = await page.evaluate(() => window.__habait.state.viewer.fov);
      const px = (run.drag / vfov) * box.height; // one stage height = one vertical fov
      await page.mouse.move(box.x + box.width / 2 + px / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 - px / 2, box.y + box.height / 2, { steps: 10 });
      await page.waitForTimeout(120);
      await page.mouse.up();
    }
    const moved = cropMae(await raw(shotFiles[2]), await raw(shotFiles[4]));
    if (moved < 4) throw new Error(`descent frame equals the hold (crop MAE ${moved.toFixed(1)}): video texture not rendering?`);
    const settle = await page.evaluate(() => window.__habait.real.log.filter((e) => e.ev === 'settle' || e.ev === 'settle-mirror').map((e) => e.ev + (e.to !== undefined ? ' ' + e.to.toFixed(2) : ' from ' + e.t.toFixed(2))).join(', '));
    return `${r}${HOLD_LOOP ? `, left the hold at rest (t ${cut.hold.t.toFixed(2)}${settle ? '; ' + settle : ''})` : ''}, differs from the hold by ${moved.toFixed(1)}/255${run.drag ? `, dragged to yaw ${(await page.evaluate(() => window.__habait.viewYaw())).toFixed(1)}` : ''}`;
  });
  await step(`${tag} enter-846 with the unit caption (short, 846) in its first 3 s (shot 6)`, async () => {
    await page.waitForFunction(() => window.__habait.state.seg?.id === 'enter-846' && window.__habait.real.log.some((e) => e.ev === 'swap' && e.seg === 'enter-846'), null, { timeout: 20000 });
    await page.evaluate(() => { window.__habait.holdReveal = true; });
    await page.waitForFunction(() => window.__habait.state.activeVideo?.currentTime > 0.8, null, { timeout: 15000 });
    const t = await page.evaluate(() => window.__habait.state.activeVideo.currentTime);
    if (t >= 2.9) throw new Error(`too late for the opening caption (t ${t})`);
    return shot(6, 'enter', 'short');
  });
  let before = null;
  await step(`${tag} enter's last frame stays up at the hand-off, pitch/fov eased to the tour's (shot 7)`, async () => {
    await page.waitForFunction(() => typeof window.__habait.reveal === 'function', null, { timeout: 20000 });
    const v = await page.evaluate(() => ({ pitch: window.__habait.state.viewer.pitch, fov: window.__habait.state.viewer.fov, tf: window.__habait.tourFov() }));
    if (Math.abs(v.pitch + 2) > 0.5 || Math.abs(v.fov - Math.min(v.tf, 200)) > 1) throw new Error(`view not eased: pitch ${v.pitch} fov ${v.fov} vs tour ${v.tf}`);
    const r = await shot(7, 'enter-last', null);
    before = await raw(shotFiles[6]);
    return `${r}, pitch ${v.pitch.toFixed(1)} fov ${v.fov.toFixed(1)}`;
  });
  await step(`${tag} hand-off: the tour opens in place on living at the buyer's yaw, no card, no spinner (shot 8)`, async () => {
    await page.evaluate(() => window.__habait.reveal());
    await page.waitForFunction(() => window.__habait.real.tourShown && window.__habait.real.tour?.view?.scene, null, { timeout: 30000 });
    await page.waitForTimeout(600);
    const st = await page.evaluate(() => { const R = window.__habait.real; return { log: R.log.filter((e) => e.ev === 'handoff').pop(), view: R.tour.view, url: R.tour.url, frames: document.querySelectorAll('iframe.tour-frame').length }; });
    const u = new URL(st.url);
    assert.equal(u.origin, tourOrigin);
    assert.equal(u.searchParams.get('scope'), 'apartment'); assert.equal(u.searchParams.get('room'), 'living'); assert.equal(u.searchParams.get('ui'), 'min');
    assert.equal(u.searchParams.get('floor'), 'parquet'); assert.equal(u.searchParams.get('video'), '0');
    assert.ok(u.searchParams.get('return').startsWith(`${base}/flow.html?project=rainbow&real=1&seg=hold-facade`), u.searchParams.get('return'));
    assert.equal(Number(u.searchParams.get('yaw')), st.log.tour_yaw);
    assert.equal(st.view.scene, 'living', `tour shows ${st.view.scene}`);
    const dy = Math.abs(wrap180(st.view.yaw - st.log.tour_yaw));
    if (dy > 2) throw new Error(`tour yaw ${st.view.yaw} vs requested ${st.log.tour_yaw}`);
    if (Math.abs(wrap180(st.log.viewer_yaw - st.log.tour_yaw)) > 0.15) throw new Error(`viewer ${st.log.viewer_yaw} vs tour ${st.log.tour_yaw}`);
    if (run.drag && Math.abs(st.log.tour_yaw) < run.drag / 2) throw new Error(`drag did not reach the hand-off (tour yaw ${st.log.tour_yaw})`);
    if (!run.drag && Math.abs(st.log.tour_yaw) > 2) throw new Error(`no drag but tour yaw ${st.log.tour_yaw}`);
    const bearing = enterMeta.handoff.bearing_deg + st.view.yaw;
    handoffs.push({ run: run.name, tourYaw: st.view.yaw, bearing, requested: st.log.tour_yaw, dy });
    const r = await shot(8, 'tour', null);
    const after = await raw(shotFiles[7]);
    const seam = ncc(before, after), control = ncc(before, after, Math.round(before.w * 0.12)), mae = cropMae(before, after);
    Object.assign(handoffs[handoffs.length - 1], { ncc: seam.ncc, lum: seam.lum, mae });
    if (!(seam.ncc >= 0.75 && seam.ncc >= control.ncc + 0.25)) throw new Error(`seam between enter's last frame and the tour: NCC ${seam.ncc.toFixed(3)} (control shifted 12%: ${control.ncc.toFixed(3)}), raw MAE ${mae.toFixed(1)}`);
    return `${r}; living at tour yaw ${st.view.yaw.toFixed(1)} (asked ${st.log.tour_yaw}), bearing ${bearing.toFixed(1)}; seam NCC ${seam.ncc.toFixed(3)} vs ${control.ncc.toFixed(3)} shifted 12%; raw MAE ${mae.toFixed(1)}/255, tour brightness x${seam.lum.toFixed(2)} (the tour's UI veil)`;
  });
  await step(`${tag} continuity in the player: no cut moves the view (yaw at each segment start = yaw when its first frame shows); nothing modal, no spinner, ever`, async () => {
    const R = await page.evaluate(() => ({ log: window.__habait.real.log, seen: window.__habait.real.overlaysSeen, init: window.__habait.real.meta.initial_view }));
    const out = [];
    for (const e of R.log.filter((x) => x.ev === 'segment')) {
      const sw = R.log.find((x) => x.ev === 'swap' && x.seg === e.seg && x.at >= e.at);
      if (!sw) throw new Error(`no first frame logged for ${e.seg}`);
      if (Math.abs(wrap180(sw.yaw - e.yaw)) > 0.01) throw new Error(`the cut to ${e.seg} moved the view ${e.yaw} -> ${sw.yaw}`);
      out.push(`${e.seg} ${e.yaw.toFixed(1)}`);
    }
    const first = R.log.find((x) => x.ev === 'segment');
    if (Math.abs(wrap180(first.yaw - R.init.yaw)) > 0.01) throw new Error('initial view not applied');
    const fr = R.log.filter((x) => x.ev === 'frame').map((x) => `${x.kind} framing yaw ${x.from.yaw.toFixed(1)}->${x.to.yaw === undefined ? 'kept' : x.to.yaw.toFixed(1)} pitch ${x.from.pitch.toFixed(1)}->${x.to.pitch === undefined ? 'kept' : x.to.pitch.toFixed(1)} fov ${x.from.fov.toFixed(0)}->${x.to.fov.toFixed(1)}`);
    out.push(...fr);
    if (R.seen.length) throw new Error(`modal/spinner seen ${R.seen.length} frames: ${JSON.stringify(R.seen.slice(0, 3))}`);
    const swaps = R.log.filter((e) => e.ev === 'swap').map((e) => e.seg);
    return `yaw at each cut: ${out.join(', ')}; swaps ${swaps.join(' > ')}`;
  });
  await step(`${tag} zero requests outside 127.0.0.1; no page errors`, async () => {
    assert.deepEqual(external, [], external.slice(0, 5).join('\n'));
    assert.deepEqual(errors, [], errors.join('\n'));
  });
  await context.close();
}
await browser.close();
server.close();

const phone = handoffs.find((h) => h.run === 'iphone13') || handoffs[0];
const ho = phone ? `handoff yaw ${phone.bearing.toFixed(1)} (bearing; tour room=living yaw ${phone.tourYaw.toFixed(1)} on iPhone 13, seam NCC ${(phone.ncc ?? NaN).toFixed(3)}${handoffs.find((h) => h.run === 'desktop') ? `, desktop after a drag: tour yaw ${handoffs.find((h) => h.run === 'desktop').tourYaw.toFixed(1)} = bearing ${handoffs.find((h) => h.run === 'desktop').bearing.toFixed(1)}` : ''})` : 'handoff yaw n/a';
console.log(`\nshots: ${shots}`);
console.log(`flow real: ${ok}/${ok + failures} ok, caption on ${capOk}/${capTotal} shots, ${ho}`);
process.exit(failures ? 1 : 0);
