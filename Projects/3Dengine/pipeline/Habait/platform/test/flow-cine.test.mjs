// card 36: the CINEMATIC flight end to end: flow.html?project=rainbow (the default) on iPhone 13 and Pixel 7 in Hebrew, and a
// desktop in English.
//   export HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps && node test/flow-cine.test.mjs [shotsDir]
// Needs: tools/build_segments.mjs --project rainbow (--cine-only) run once (fixtures/rainbow/flow.cine.json +
// _local/segments/rainbow-cine/), playwright-core + sharp ($HABAIT_APP_DIR/node_modules), Chrome (H.264) at $CHROME_PATH or Program Files.
// Starts its own platform server on a free port (serve.mjs's handler; POST /api/events answered 204 so _local/events.jsonl stays
// clean) and serves habait-98's built tour (Habait/tour360/dist/apt846, read-only) on units.json's tour origin by interception.
// Per device, 9 shots: the orbit's opening, mid-orbit, the hold, the hold after a drag, the unit card, the descent, the enter, the
// bridge into the tour's panorama, the tour. Checked: the flat clip plays and advances (cover-fit, no stretch), the cut into the
// hold lands on its rest frame (= the orbit's end pose, card 35's measured frame 65), a drag moves the frame and the pills with it
// (846's pill within 12 px of the projection of its units.json box through that frame's camera, computed here independently),
// a real tap on 846 opens the card and stops the glide, "continue" leaves the hold from its rest frame, the descent and the enter
// play, enter's last frame and the 360 viewer at the matching pose agree on screen (NCC), the tour opens in place on living at
// the yaw the turn ended on with the right URL, the caption v1 band on every shot (+ the expected overlay variant), nothing
// modal and no spinner ever, zero requests outside 127.0.0.1, zero page errors.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, dirname, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { handle } from '../serve.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const PLATFORM = resolve(here, '..');
const HABAIT = resolve(PLATFORM, '..');
const FIX = join(PLATFORM, 'fixtures/rainbow');
const TOUR_DIST = join(HABAIT, 'tour360/dist/apt846');
const CAPTION = resolve(HABAIT, '..', '..', 'data/sales-plans/legal/caption-v1.json');
const shots = process.argv[2] || join(PLATFORM, 'test/shots/flow-cine');
mkdirSync(shots, { recursive: true });
const readJSON = (p) => JSON.parse(readFileSync(p, 'utf8'));
const wrap180 = (d) => { const r = ((((d + 180) % 360) + 360) % 360) - 180; return r === -180 ? 180 : r; };

const req = createRequire(import.meta.url);
function fromAppDir(name) {
  const cands = [process.env.HABAIT_APP_DIR && join(process.env.HABAIT_APP_DIR, 'noop.js'), 'C:/RnD/Projects/Habait/tools/appdeps/noop.js', join(PLATFORM, 'noop.js')].filter(Boolean);
  for (const c of cands) { try { return createRequire(c)(name); } catch { /* next */ } }
  try { return req(name); } catch { throw new Error(`${name} not found; export HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps`); }
}
const pw = process.env.PLAYWRIGHT_CORE ? req(process.env.PLAYWRIGHT_CORE) : fromAppDir('playwright-core');
const sharp = fromAppDir('sharp');
const chromePath = process.env.CHROME_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);

let ok = 0, failures = 0;
const step = async (name, fn) => {
  try { const r = await fn(); ok++; console.log('ok   ' + name + (r ? `  (${r})` : '')); return r ?? true; }
  catch (e) { failures++; console.log('FAIL ' + name + '\n     ' + String(e.message || e).split('\n').slice(0, 4).join('\n     ')); return null; }
};

// ---------------- 1. the data ----------------
const units = readJSON(join(FIX, 'units.json'));
const project = readJSON(join(FIX, 'project.json'));
let flow = null;
await step('flow.cine.json exists and is a habait-platform/flow.cine.v1 chain built from one video manifest', () => {
  assert.ok(existsSync(join(FIX, 'flow.cine.json')), 'fixtures/rainbow/flow.cine.json missing: run tools/build_segments.mjs --project rainbow --cine-only');
  flow = readJSON(join(FIX, 'flow.cine.json'));
  assert.equal(flow.schema, 'habait-platform/flow.cine.v1');
  assert.equal(flow.project, 'rainbow');
  assert.ok(flow.manifest?.path && flow.manifest.sha256_16, 'manifest provenance');
  return `${flow.segments.map((s) => s.id).join(' > ')}; manifest ${flow.manifest.kind} ${flow.manifest.path} (${flow.manifest.sha256_16})`;
});
if (!flow) { console.log(`\nflow cine: ${ok}/${ok + failures} ok, caption on 0/0 shots`); process.exit(1); }
const seg = new Map(flow.segments.map((s) => [s.id, s]));
const asset = (p) => resolve(FIX, p);
const hold = seg.get(flow.hold), orbit = seg.get('orbit'), descend = seg.get(flow.defaults.descend), enter = seg.get(flow.defaults.enter);
await step('the chain: orbit (flat) > hold (frames) > descend-846 (flat) > enter-846 (flat) > hand-off; every file on disk', () => {
  assert.deepEqual(flow.segments.map((s) => s.id), ['orbit', 'hold-facade', 'descend-846', 'enter-846']);
  assert.deepEqual(flow.segments.map((s) => s.next), ['hold-facade', null, 'enter-846', 'handoff']);
  for (const s of [orbit, descend, enter]) { assert.equal(s.kind, 'flat-video'); for (const f of [s.src, s.poster, s.last]) assert.ok(existsSync(asset(f)), f); }
  assert.equal(hold.kind, 'frames'); assert.equal(hold.track, 'hold-arc', 'the arc is the hold (the ring is a preview)');
  for (let i = 1; i <= hold.frames; i++) { const f = `frame_${String(i).padStart(4, '0')}.jpg`; assert.ok(existsSync(join(asset(hold.dir), hold.hi, f)), f); if (hold.lo) assert.ok(existsSync(join(asset(hold.dir), hold.lo, f)), 'lo ' + f); }
  assert.ok(existsSync(asset(hold.camera)) && existsSync(asset(enter.handoff.pano)));
  return `hold ${hold.track} ${hold.frames} frames (lo + hi), rest frame ${hold.rest_frame}; orbit ${orbit.frames} fr, descend ${descend.frames} fr, enter ${enter.frames} fr`;
});
const cam = readJSON(asset(hold.camera));
await step('the hold camera: one matrix per real frame; the rest frame looks from the orbit\'s end pose; 846 projects onto the frame', () => {
  assert.equal(cam.frames.length, hold.frames);
  const M = cam.frames[hold.rest_frame - 1], pos = [M[0][3], M[1][3], M[2][3]];
  const node = [68.4477, -47.2597, 17.7875];                         // node-b-tower = the orbit clip's end pose (memory.md §4)
  const d = Math.hypot(pos[0] - node[0], pos[1] - node[1], pos[2] - node[2]);
  assert.ok(d < 0.5, `rest camera ${pos.map((v) => v.toFixed(2))} is ${d.toFixed(2)} m from node-b`);
  const u = hold.units_at_rest['846'];
  assert.ok(u && u[0] > 0.3 && u[0] < 0.7 && u[1] > 0.5 && u[1] < 0.95, `846 at ${u}`);
  return `rest frame ${hold.rest_frame} at ${d.toFixed(2)} m from node-b; 846 at frame (${u.join(', ')}); ${Object.keys(flow.units).length} unit boxes`;
});
await step('junctions: orbit > hold crossfade, hold > descent crossfade from the rest frame, descent > enter a cut (one take)', () => {
  assert.equal(orbit.junction.mode, 'crossfade'); assert.equal(hold.junction.mode, 'crossfade');
  assert.equal(descend.junction.mode, 'cut');
  assert.ok(descend.junction.dpos_m < 0.15, `descend > enter ${descend.junction.dpos_m} m`);
  assert.ok(descend.junction.seam_mae <= 20, `descend > enter decoded seam ${descend.junction.seam_mae}`);
  return `orbit>hold ${orbit.junction.seconds} s (seam ${orbit.junction.seam_mae}), hold>descend ${hold.junction.seconds} s (seam ${hold.junction.seam_mae}), descend>enter cut ${descend.junction.dpos_m} m (seam ${descend.junction.seam_mae} = one frame of motion)`;
});
await step('hand-off: enter ends at the living camera point; start yaw = camera bearing - living centre bearing (111.3); turn to yaw 0', () => {
  const h = enter.handoff;
  assert.equal(h.room, 'living');
  assert.ok(Math.abs(h.bearing_deg - 111.3) < 0.05);
  assert.ok(Math.abs(wrap180(h.last_camera.yaw - h.bearing_deg - h.start_yaw)) < 0.1, `start yaw ${h.start_yaw}`);
  assert.ok(Math.hypot(h.last_camera.pos[0] - 6.85, h.last_camera.pos[1] + 9.35) < 0.2, `enter ends at ${h.last_camera.pos}`);
  assert.equal(h.view_yaw, 0);
  return `camera ${h.last_camera.yaw}° at (${h.last_camera.pos.join(', ')}) -> living yaw ${h.start_yaw}, then ${h.turn_s} s to yaw ${h.view_yaw}`;
});
const capSrc = readJSON(CAPTION);
const planDate = flow.caption.plan_date;
const expectCap = (lang, variant, unit = '846') => capSrc[lang][variant].replace('{PROJECT}', project.name[lang]).replace('{PLAN_DATE}', planDate).replace('{UNIT}', unit);
await step('caption in flow.cine.json = caption-v1.json (short_project, micro, short), project + plan date filled', () => {
  assert.equal(planDate, '15.10.2025');
  for (const l of ['he', 'en']) { assert.equal(flow.caption[l].short_project, expectCap(l, 'short_project')); assert.equal(flow.caption[l].micro, expectCap(l, 'micro')); }
  return `${flow.caption.id}`;
});

// ---------------- 2. the browser ----------------
const tourOrigin = new URL(units.units.find((u) => u.id === '846').tour_url).origin;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg' };
const server = createServer((rq, rs) => {
  if ((rq.url || '').startsWith('/api/events')) { rs.writeHead(204); rs.end(); return; }
  handle(rq, rs).catch((e) => { console.error(e); if (!rs.headersSent) rs.writeHead(500); rs.end(); });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await pw.chromium.launch({ executablePath: chromePath, headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--mute-audio',
    '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
const dev = (name) => { const d = { ...pw.devices[name] }; delete d.defaultBrowserType; d.deviceScaleFactor = 2; return d; };
const runs = [
  { name: 'iphone13', opts: dev('iPhone 13'), lang: 'he' },
  { name: 'pixel7', opts: dev('Pixel 7'), lang: 'he' },
  { name: 'desktop', opts: { viewport: { width: 1280, height: 800 } }, lang: 'en' },
];

async function raw(file) { const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, w: info.width, h: info.height }; }
function ncc(a, b, box) {
  // normalised cross-correlation of the grey levels inside box (fractions of the image)
  const xs = [], ys = [];
  for (let y = Math.floor(a.h * box[1]); y < Math.floor(a.h * box[3]); y += 2) for (let x = Math.floor(a.w * box[0]); x < Math.floor(a.w * box[2]); x += 2) {
    const i = (y * a.w + x) * 3;
    xs.push(a.data[i] * 0.299 + a.data[i + 1] * 0.587 + a.data[i + 2] * 0.114); ys.push(b.data[i] * 0.299 + b.data[i + 1] * 0.587 + b.data[i + 2] * 0.114);
  }
  const m = (v) => v.reduce((p, q) => p + q, 0) / v.length, mx = m(xs), my = m(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < xs.length; i++) { const p = xs[i] - mx, q = ys[i] - my; sxy += p * q; sxx += p * p; syy += q * q; }
  return sxy / Math.sqrt(sxx * syy);
}
// structure, not colour: gradient-magnitude NCC of two screenshots (greyscale, 256 px wide) inside box (fractions); the bridge
// crossfades Kling's furniture into the tour's, so only the plan's walls, door and slider can agree
async function edgeNcc(fa, fb, box) {
  const g = async (f) => { const { data, info } = await sharp(f).removeAlpha().resize(256).greyscale().raw().toBuffer({ resolveWithObject: true }); return { d: data, w: info.width, h: info.height }; };
  const A = await g(fa), B = await g(fb);
  const blur = (a, w, h, r) => { const o = new Float32Array(a.length), o2 = new Float32Array(a.length); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, n = 0; for (let k = -r; k <= r; k++) if (x + k >= 0 && x + k < w) { s += a[y * w + x + k]; n++; } o[y * w + x] = s / n; } for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, n = 0; for (let k = -r; k <= r; k++) if (y + k >= 0 && y + k < h) { s += o[(y + k) * w + x]; n++; } o2[y * w + x] = s / n; } return o2; };
  const e = (I) => { let m0 = new Float32Array(I.w * I.h); for (let y = 1; y < I.h - 1; y++) for (let x = 1; x < I.w - 1; x++) { const i = y * I.w + x; m0[i] = Math.hypot(I.d[i + 1] - I.d[i - 1], I.d[i + I.w] - I.d[i - I.w]); } m0 = blur(blur(m0, I.w, I.h, 3), I.w, I.h, 3);
    const o = []; for (let y = Math.floor(I.h * box[1]); y < Math.floor(I.h * box[3]); y++) for (let x = Math.floor(I.w * box[0]); x < Math.floor(I.w * box[2]); x++) o.push(m0[y * I.w + x]); const m = o.reduce((a, b) => a + b, 0) / o.length; let v = 0; for (const q of o) v += (q - m) ** 2; const sd = Math.sqrt(v / o.length) || 1; return o.map((q) => (q - m) / sd); };
  const a = e(A), b = e(B); let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s / a.length;
}
function cropMae(a, b) { let s = 0, n = 0; for (let y = Math.floor(a.h * 0.25); y < Math.floor(a.h * 0.75); y += 2) for (let x = Math.floor(a.w * 0.2); x < Math.floor(a.w * 0.8); x += 2) { const i = (y * a.w + x) * 3; s += Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]); n += 3; } return s / n; }
function meanLum(a) { let s = 0, n = 0; for (let i = 0; i < a.data.length; i += 30) { s += a.data[i] + a.data[i + 1] + a.data[i + 2]; n += 3; } return s / n; }
// the pill position of a unit, computed HERE from the camera of frame i, the stage and the cover-fit around focus_x (js/cine.js's rule)
function projectHere(id, i, stage) {
  const M = cam.frames[i], c = flow.units[id].centre, W = hold.size[0], H = hold.size[1];
  const R = [[M[0][0], M[1][0], M[2][0]], [M[0][1], M[1][1], M[2][1]], [M[0][2], M[1][2], M[2][2]]], t = [M[0][3], M[1][3], M[2][3]];
  const d = [c[0] - t[0], c[1] - t[1], c[2] - t[2]];
  const x = R[0][0] * d[0] + R[0][1] * d[1] + R[0][2] * d[2], y = R[1][0] * d[0] + R[1][1] * d[1] + R[1][2] * d[2], z = R[2][0] * d[0] + R[2][1] * d[1] + R[2][2] * d[2];
  const f = 1 / Math.tan((cam.hfov_deg * Math.PI) / 360), nx = (x / -z) * f, ny = (y / -z) * f * (W / H);
  const s = Math.max(stage.w / W, stage.h / H), dw = W * s, dh = H * s;
  const ox = Math.min(0, Math.max(stage.w - dw, stage.w / 2 - flow.focus_x * dw)), oy = (stage.h - dh) / 2;
  return { x: ox + ((nx + 1) / 2) * dw, y: oy + ((1 - ny) / 2) * dh };
}

let capOk = 0, capTotal = 0;
const summary = { drag: [], handoff: [] };
for (const run of runs) {
  const context = await browser.newContext({ ...run.opts, locale: run.lang === 'he' ? 'he-IL' : 'en-US' });
  const external = [];
  context.on('request', (r) => { try { const u = new URL(r.url()); if (/^https?:$/.test(u.protocol) && !['127.0.0.1', 'localhost'].includes(u.hostname)) external.push(r.url()); } catch { /* data: */ } });
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
  const L = run.lang, tag = `[${run.name}]`, files = [];
  async function shot(n, label, variant) {
    const file = join(shots, `${run.name}-${String(n).padStart(2, '0')}-${label}.png`);
    await page.screenshot({ path: file });
    files[n] = file;
    const c = await page.evaluate(() => {
      const vis = (el, needTop) => {
        if (!el || el.hidden) return null;
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        const top = needTop ? document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 9)) : null;
        return { text: el.textContent, onScreen: r.width > 50 && r.height > 8 && r.top >= -1 && r.bottom <= innerHeight + 1, shown: cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.5, onTop: needTop ? !!top && (top === el || el.contains(top)) : null };
      };
      return { band: vis(document.getElementById('legalBand'), true), over: vis(document.getElementById('legalOverlay'), false),
        modal: ['startOverlay', 'handoffOverlay', 'loading'].filter((id) => !document.getElementById(id).hidden) };
    });
    capTotal++;
    const bad = [];
    if (!c.band || !c.band.shown || !c.band.onScreen || !c.band.onTop) bad.push('caption band not visible / not on top');
    else if (c.band.text !== expectCap(L, 'micro')) bad.push(`band text "${c.band.text}"`);
    if (variant) { const want = expectCap(L, variant); if (!c.over || !c.over.shown || !c.over.onScreen) bad.push(`overlay ${variant} not visible`); else if (c.over.text !== want) bad.push(`overlay text != ${variant}`); }
    for (const t of [c.band?.text, c.over?.text]) if (t && t.includes('{')) bad.push('a "{" placeholder on screen');
    if (c.modal.length) bad.push(`modal/spinner visible: ${c.modal.join(',')}`);
    const img = await raw(file); if (meanLum(img) < 18) bad.push(`black frame (mean ${meanLum(img).toFixed(1)})`);
    if (!bad.length) capOk++; else throw new Error(`${label}: ${bad.join('; ')}`);
    return `${label}: band${variant ? ` + ${variant}` : ''}`;
  }
  const C = (fn, arg) => page.evaluate(fn, arg);
  await page.goto(`${base}/flow.html?project=rainbow${L === 'en' ? '&lang=en' : ''}`);

  const played = await step(`${tag} default = the cinematic flight: no start modal, the orbit is a flat cover-fit clip that plays and advances (shot 1)`, async () => {
    await page.waitForFunction(() => window.__habait?.mode === 'cine' && window.__cine?.seg === 'orbit', null, { timeout: 20000 });
    await page.waitForFunction(() => window.__cine.videoTime > 1.2, null, { timeout: 30000 });
    await C(() => document.querySelector('video.cine-video[data-seg="orbit"]').pause());   // freeze the opening for the shot (its caption lasts 3 s)
    const s1 = await shot(1, 'orbit-open', 'short_project');
    await C(() => document.querySelector('video.cine-video[data-seg="orbit"]').play());
    const a = await C(() => window.__cine.videoTime); await page.waitForTimeout(500); const b = await C(() => window.__cine.videoTime);
    if (!(b > a + 0.2)) throw new Error(`the orbit does not advance (${a} -> ${b})`);
    const geo = await C(() => { const v = document.querySelector('video.cine-video[data-seg="orbit"]'); const r = v.getBoundingClientRect(), s = document.getElementById('stage').getBoundingClientRect(); return { vw: r.width, vh: r.height, l: r.left, t: r.top, sw: s.width, sh: s.height, op: getComputedStyle(v).opacity }; });
    if (Math.abs(geo.vw / geo.vh - 16 / 9) > 0.01) throw new Error(`the clip is stretched: ${geo.vw}x${geo.vh}`);
    if (geo.vw < geo.sw - 1 || geo.vh < geo.sh - 1 || geo.l > 0.5 || geo.t > 0.5) throw new Error(`not cover-fit: ${JSON.stringify(geo)}`);
    return s1 + `, t ${a.toFixed(2)} -> ${b.toFixed(2)} s, clip ${geo.vw.toFixed(0)}x${geo.vh.toFixed(0)} over the ${geo.sw.toFixed(0)}x${geo.sh.toFixed(0)} stage`;
  });
  if (!played) { await context.close(); continue; }
  await step(`${tag} mid-orbit: the band only after the opening caption (shot 2)`, async () => {
    await page.waitForFunction(() => window.__cine.videoTime > 7.5, null, { timeout: 30000 });
    const r = await shot(2, 'orbit-mid', null);
    await C(() => { document.querySelector('video.cine-video[data-seg="orbit"]').playbackRate = 3; }); // the test does not need the rest at 1x
    return r;
  });
  await step(`${tag} the orbit lands on the hold: its rest frame (${hold.rest_frame}) under a crossfade, no loading screen (shot 3)`, async () => {
    await page.waitForFunction(() => window.__cine.seg === 'hold-facade' && window.__cine.hold?.active, null, { timeout: 40000 });
    const at = await C(() => ({ shown: window.__cine.hold.shown, rest: window.__cine.hold.rest, log: window.__cine.log.filter((e) => e.ev === 'shown' && e.seg === 'hold-facade').pop() }));
    if (at.shown !== at.rest) throw new Error(`the hold opened on frame ${at.shown + 1}, rest ${at.rest + 1}`);
    if (!(at.log && at.log.from === 'orbit' && at.log.crossfade > 0)) throw new Error(`no crossfade from the orbit: ${JSON.stringify(at.log)}`);
    await page.waitForFunction(() => { const el = document.querySelector('.hotspot[data-unit="846"]'); return el && el.style.display !== 'none'; }, null, { timeout: 10000 });
    await page.waitForTimeout(700);
    const pills = await C(() => [...document.querySelectorAll('.hotspot[data-unit]')].filter((h) => h.style.display !== 'none').map((h) => h.dataset.unit).sort());
    if (!pills.includes('846')) throw new Error('no 846 pill');
    return (await shot(3, 'hold', 'short_project')) + `, landed on frame ${at.shown + 1} (${at.log.crossfade} s crossfade from the orbit), pills ${pills.join(' ')}`;
  });
  await step(`${tag} drag: the frame moves along the arc and the pills move with it; 846 stays within 12 px of its box projected through that frame's camera (shot 4)`, async () => {
    const box = await (await page.$('#cineHold')).boundingBox();
    const before = await C(() => { const el = document.querySelector('.hotspot[data-unit="846"]'); return { i: window.__cine.hold.shown, x: el._px, y: el._py }; });
    const y = box.y + box.height * 0.3, x0 = box.x + box.width * 0.62, x1 = box.x + box.width * 0.38;   // a quarter of the width: ~30 frames
    await page.mouse.move(x0, y); await page.mouse.down(); await page.mouse.move(x1, y, { steps: 14 }); await page.mouse.up();
    await page.waitForFunction(() => Math.abs(window.__cine.hold.index - Math.round(window.__cine.hold.index)) < 1e9 && !window.__cine.hold.gliding, null, { timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(250);
    // the pill's anchor as the picker received it (el._px/_py: before its own row stagger of compact pills)
    const after = await C(() => { const el = document.querySelector('.hotspot[data-unit="846"]'); const s = document.getElementById('stage').getBoundingClientRect(); return { i: window.__cine.hold.shown, x: el._px, y: el._py, top: parseFloat(el.style.top), shown: el.style.display !== 'none', zoom: window.__cine.hold.zoom, stage: { w: s.width, h: s.height } }; });
    if (Math.abs(after.i - before.i) < 10) throw new Error(`the drag moved the arc ${before.i + 1} -> ${after.i + 1} only`);
    if (after.zoom !== 1) throw new Error(`zoom ${after.zoom}`);
    const moved = Math.hypot(after.x - before.x, after.y - before.y);
    if (moved < 6) throw new Error(`the 846 pill did not move with the frame (${moved.toFixed(1)} px)`);
    const p = projectHere('846', after.i, after.stage);
    const dx = Math.abs(after.x - p.x), dy = Math.abs(after.y - p.y);
    if (!after.shown || dx > 12 || dy > 12) throw new Error(`846 at (${after.x}, ${after.y}) vs projection (${p.x.toFixed(1)}, ${p.y.toFixed(1)}): dx ${dx.toFixed(1)} dy ${dy.toFixed(1)}`);
    summary.drag.push(`${run.name}: frame ${before.i + 1}->${after.i + 1}, 846 moved ${moved.toFixed(0)} px, off its box projection ${dx.toFixed(1)}/${dy.toFixed(1)} px`);
    const r = await shot(4, 'hold-drag', 'short_project');
    const mv = cropMae(await raw(files[3]), await raw(files[4]));
    if (mv < 3) throw new Error(`the picture did not change after the drag (MAE ${mv.toFixed(1)})`);
    return `${r}, arc frame ${before.i + 1} -> ${after.i + 1}, 846 pill moved ${moved.toFixed(0)} px, ${dx.toFixed(1)} / ${dy.toFixed(1)} px from the projection, picture MAE ${mv.toFixed(1)}`;
  });
  await step(`${tag} a real tap on 846 -> the unit card; the glide stops under it (shot 5)`, async () => {
    await page.waitForTimeout(400);
    const hit = await C(() => { const el = document.querySelector('.hotspot[data-unit="846"]'); const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return top && top.closest('.hotspot')?.dataset.unit; });
    if (hit !== '846') throw new Error(`the centre of the 846 pill is covered by ${hit}`);
    await page.click('.hotspot[data-unit="846"]', { timeout: 8000 });
    await page.waitForSelector('#unitSheet:not([hidden])');
    await page.waitForTimeout(500);
    const a = await C(() => window.__cine.hold.index); await page.waitForTimeout(700); const b = await C(() => window.__cine.hold.index);
    if (Math.abs(a - b) > 0.05) throw new Error(`the arc keeps gliding under the card (${a.toFixed(2)} -> ${b.toFixed(2)})`);
    return (await shot(5, 'card', null)) + `, arc still at ${(b + 1).toFixed(2)}`;
  });
  await step(`${tag} continue -> the arc eases back to its rest frame, the descent crossfades in and plays (shot 6)`, async () => {
    await page.click('#unitContinue');
    await page.waitForFunction(() => window.__cine.seg === 'descend-846' && window.__cine.videoTime > 0.9, null, { timeout: 20000 });
    await C(() => document.querySelector('video.cine-video[data-seg="descend-846"]').pause());   // freeze for the shot (the opening caption lasts 3 s)
    const lg = await C(() => window.__cine.log.filter((e) => e.ev === 'hold-rest').pop());
    if (!lg || Math.abs(lg.index - lg.rest) > 0.01) throw new Error(`the descent did not start from the rest frame: ${JSON.stringify(lg)}`);
    const sh = await C(() => window.__cine.log.filter((e) => e.ev === 'shown' && e.seg === 'descend-846').pop());
    if (!(sh && sh.crossfade > 0)) throw new Error(`no crossfade into the descent: ${JSON.stringify(sh)}`);
    const pills = await C(() => [...document.querySelectorAll('.hotspot[data-unit]')].filter((h) => h.style.display !== 'none').length);
    if (pills) throw new Error(`${pills} pills over the descent`);
    const r6 = await shot(6, 'descend', 'short_project');
    await C(() => document.querySelector('video.cine-video[data-seg="descend-846"]').play());
    return r6 + `, left the hold at frame ${lg.index} (rest ${lg.rest}), ${sh.crossfade} s crossfade`;
  });
  await step(`${tag} descend -> enter: a cut on consecutive frames of one take, the unit caption (short, 846) opens the enter (shot 7)`, async () => {
    await C(() => { Object.assign(window.__habait, { holdBridge: true, holdTurn: true, holdReveal: true }); });   // the bridge waits for the shots below
    await page.waitForFunction(() => window.__cine.seg === 'enter-846' && window.__cine.videoTime > 0.6, null, { timeout: 20000 });
    await C(() => document.querySelector('video.cine-video[data-seg="enter-846"]').pause());     // freeze for the shot (the opening caption lasts 3 s)
    const t = await C(() => window.__cine.videoTime);
    if (t > 2.8) throw new Error(`too late for the opening caption (t ${t})`);
    const lg = await C(() => ({ end: window.__cine.log.filter((e) => e.ev === 'ended' && e.seg === 'descend-846').pop(), shown: window.__cine.log.filter((e) => e.ev === 'shown' && e.seg === 'enter-846').pop() }));
    if (!lg.end || !lg.shown || lg.shown.crossfade !== 0) throw new Error(`descend > enter is not a cut: ${JSON.stringify(lg)}`);
    if (lg.shown.at - lg.end.at > 400) throw new Error(`a ${lg.shown.at - lg.end.at} ms gap between the descent's end and the enter's first frame`);
    const r = await shot(7, 'enter', 'short');
    await page.evaluate(() => { const v = document.querySelector('video.cine-video[data-seg="enter-846"]'); if (v.currentTime < 3.2) v.currentTime = 3.2; v.playbackRate = 2; v.play(); });
    return `${r}, enter's first frame ${lg.shown.at - lg.end.at} ms after the descent ended`;
  });
  await step(`${tag} the bridge starts on the same view: enter's last frame (shot 8) vs the tour's living panorama at the clip's pose and field of view in the 360 viewer (shot 9)`, async () => {
    await page.waitForFunction(() => typeof window.__habait.bridgeGo === 'function', null, { timeout: 30000 });
    const r8 = await shot(8, 'enter-last', null);
    await page.evaluate(() => window.__habait.bridgeGo());
    await page.waitForFunction(() => typeof window.__habait.turnGo === 'function', null, { timeout: 10000 });
    const r9 = await shot(9, 'bridge-pose', null);
    // controls: the same panorama in the same viewer turned -20, -10, +10, +20 degrees (then back); a narrow portrait window can
    // land another vertical edge on the door by chance, so the pose must beat their MEAN
    const box = [0.04, 0.14, 0.96, 0.72];                                      // under the HUD, above the caption overlay and the foreground armchair
    const same = await edgeNcc(files[8], files[9], box), controls = [];
    for (const d of [-20, -10, 10, 20]) {
      const ctl = join(shots, `${run.name}-09c-bridge-control-${d > 0 ? '+' : ''}${d}deg.png`);
      await page.evaluate((dd) => new Promise((ok) => { const v = window.__habait.state.viewer; v._y0 = v._y0 ?? v.yaw; v.yaw = v._y0 + dd; requestAnimationFrame(() => requestAnimationFrame(ok)); }), d);
      await page.screenshot({ path: ctl });
      controls.push(await edgeNcc(files[8], ctl, box));
    }
    await page.evaluate(() => new Promise((ok) => { const v = window.__habait.state.viewer; v.yaw = v._y0; delete v._y0; requestAnimationFrame(() => requestAnimationFrame(ok)); }));
    const mean = controls.reduce((x, y) => x + y, 0) / controls.length;
    summary.bridge = (summary.bridge || []).concat(`${run.name} ${same.toFixed(3)} (turned ±10/20°: mean ${mean.toFixed(3)})`);
    if (!(same >= 0.15 && same >= mean + 0.08)) throw new Error(`clip's last frame vs the panorama at its pose: edge NCC ${same.toFixed(3)}; turned ${controls.map((c) => c.toFixed(3)).join(' / ')} (mean ${mean.toFixed(3)})`);
    await page.evaluate(() => window.__habait.turnGo());
    return `${r8}; ${r9}; walls/door/slider agree: edge NCC ${same.toFixed(3)} vs ${mean.toFixed(3)} (mean of the panorama turned -20/-10/+10/+20°: ${controls.map((c) => c.toFixed(2)).join(' ')})`;
  });
  await step(`${tag} the turn: to the windows, pitch and field of view eased to the tour's (shot 10)`, async () => {
    await page.waitForFunction(() => window.__cine.log.some((e) => e.ev === 'bridge'), null, { timeout: 30000 });
    await page.waitForFunction(() => typeof window.__habait.reveal === 'function', null, { timeout: 20000 });
    const b = await C(() => ({ bridge: window.__cine.log.find((e) => e.ev === 'bridge'), yaw: window.__habait.viewYaw(), fov: window.__habait.state.viewer.fov, tf: window.__habait.tourFov(), pitch: window.__habait.state.viewer.pitch }));
    if (Math.abs(wrap180(b.yaw - enter.handoff.view_yaw)) > 1) throw new Error(`the turn ended at yaw ${b.yaw}`);
    if (Math.abs(b.fov - b.tf) > 1 || Math.abs(b.pitch + 2) > 0.5) throw new Error(`view not eased to the tour's: fov ${b.fov} vs ${b.tf}, pitch ${b.pitch}`);
    if (Math.abs(wrap180(b.bridge.yaw - enter.handoff.start_yaw)) > 3) throw new Error(`the bridge started at yaw ${b.bridge.yaw}, hand-off ${enter.handoff.start_yaw}`);
    return (await shot(10, 'bridge-turned', null)) + `, bridge from yaw ${b.bridge.yaw} vfov ${b.bridge.vfov} (the clip's) to yaw ${b.yaw.toFixed(1)} fov ${b.fov.toFixed(1)} (the tour's)`;
  });
  await step(`${tag} hand-off: the tour opens in place on living at the bridge's yaw, quiet chrome, return = this hold; seam measured on screen (shot 11)`, async () => {
    await page.evaluate(() => window.__habait.reveal());
    await page.waitForFunction(() => window.__cine.tourShown && window.__habait.real.tour?.view?.scene, null, { timeout: 30000 });
    await page.waitForTimeout(900);
    const st = await C(() => { const R = window.__habait.real; return { view: R.tour.view, url: R.tour.url, frames: document.querySelectorAll('iframe.tour-frame.shown').length, reveal: window.__cine.log.filter((e) => e.ev === 'reveal').pop() }; });
    const u = new URL(st.url);
    assert.equal(u.origin, tourOrigin);
    assert.equal(u.searchParams.get('scope'), 'apartment'); assert.equal(u.searchParams.get('room'), 'living'); assert.equal(u.searchParams.get('ui'), 'min');
    assert.equal(u.searchParams.get('floor'), 'parquet'); assert.equal(u.searchParams.get('video'), '0');
    const ret = new URL(u.searchParams.get('return'));
    assert.equal(ret.pathname, '/flow.html'); assert.equal(ret.searchParams.get('seg'), 'hold-facade'); assert.equal(ret.searchParams.get('real'), null);
    assert.equal(st.view.scene, 'living', `tour shows ${st.view.scene}`);
    const dy = Math.abs(wrap180(st.view.yaw - Number(u.searchParams.get('yaw'))));
    if (dy > 2) throw new Error(`tour yaw ${st.view.yaw} vs requested ${u.searchParams.get('yaw')}`);
    if (st.frames !== 1) throw new Error(`${st.frames} tour iframes shown`);
    const r = await shot(11, 'tour', null);
    const a = await raw(files[10]), c = await raw(files[11]);
    const seam = ncc(a, c, [0.15, 0.22, 0.85, 0.55]);
    summary.handoff.push(`${run.name}: living yaw ${st.view.yaw.toFixed(1)}, seam NCC ${seam.toFixed(3)}`);
    if (seam < 0.6) throw new Error(`the bridge's last view and the tour differ on screen: NCC ${seam.toFixed(3)}`);
    return `${r}; living at tour yaw ${st.view.yaw.toFixed(1)} (asked ${u.searchParams.get('yaw')}); bridge vs tour NCC ${seam.toFixed(3)}; return ${ret.pathname}${ret.search}`;
  });
  await step(`${tag} continuity: every step logged its transition (orbit>hold crossfade, rest frame, descent crossfade, cut, bridge, reveal); nothing modal`, async () => {
    const log = await C(() => window.__cine.log.map((e) => e.ev + (e.seg ? ':' + e.seg : '')));
    const want = ['segment:orbit', 'shown:orbit', 'ended:orbit', 'segment:hold-facade', 'shown:hold-facade', 'hold-rest', 'segment:descend-846', 'shown:descend-846', 'ended:descend-846', 'segment:enter-846', 'shown:enter-846', 'ended:enter-846', 'bridge:enter-846', 'reveal'];
    let k = 0; for (const e of log) if (e === want[k]) k++;
    if (k < want.length) throw new Error(`missing "${want[k]}" in ${log.join(' ')}`);
    return want.join(' > ');
  });
  await step(`${tag} zero requests outside 127.0.0.1; no page errors`, async () => {
    assert.deepEqual(external, [], external.slice(0, 5).join('\n'));
    assert.deepEqual(errors, [], errors.join('\n'));
  });
  await context.close();
}
// the routes: the cinematic flight is the default; card 34's 360 flight and the placeholder stay reachable; the tour's return
// URL (?seg=hold-facade&from=tour) opens the cinematic hold directly, without the orbit
{
  const context = await browser.newContext({ ...dev('iPhone 13'), locale: 'he-IL' });
  const page = await context.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  const routes = [['', 'cine', 'orbit'], ['&mode=360', '360', 'approach'], ['&real=1', '360', 'approach'], ['&real=0', 'placeholder', null], ['&seg=hold-facade&from=tour', 'cine', 'hold-facade']];
  await step('routes: flow.html?project=rainbow = cinematic; ?mode=360 / ?real=1 = the 360 flight of card 34; ?real=0 = placeholder; ?seg=hold-facade&from=tour = the cinematic hold at once', async () => {
    const out = [];
    for (const [q, mode, first] of routes) {
      await page.goto(`${base}/flow.html?project=rainbow${q}`);
      await page.waitForFunction(() => window.__habait?.mode, null, { timeout: 20000 });
      if (first) await page.waitForFunction((f) => window.__habait.state.seg?.id === f, first, { timeout: 20000 });
      const m = await page.evaluate(() => ({ mode: window.__habait.mode, seg: window.__habait.state.seg?.id || null }));
      if (m.mode !== mode) throw new Error(`${q || '(none)'}: mode ${m.mode}, want ${mode}`);
      out.push(`${q || '(none)'} -> ${m.mode}${m.seg ? ' @ ' + m.seg : ''}`);
    }
    if (errs.length) throw new Error(errs.join(' | '));
    return out.join('; ');
  });
  await context.close();
}
await browser.close();
server.close();
console.log(`\nshots: ${shots}`);
console.log(`drag: ${summary.drag.join('; ')}`);
console.log(`bridge start (clip's last frame vs the panorama at its pose): ${(summary.bridge || []).join('; ')}`);
console.log(`flow cine: ${ok}/${ok + failures} ok, caption on ${capOk}/${capTotal} shots, drag moves labels (${summary.drag.length}/${runs.length} devices), handoff living (${summary.handoff.join('; ') || 'n/a'})`);
process.exit(failures ? 1 : 0);
