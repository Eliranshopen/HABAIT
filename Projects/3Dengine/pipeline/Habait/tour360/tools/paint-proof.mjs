#!/usr/bin/env node
/* Habait Tour360 - paint-proof.mjs (T05b, board habait-tour360) - the board's only gate: a fresh paint proof of the LIVE tour.
   Standing law 6: a curl 200 does not prove a browser will paint. A real headless Chrome (playwright-core from the app's
   node_modules through createRequire, the system Chrome - the launcher of shots.mjs), a fresh no-cookie context per cell, the
   DEPLOYED url, one Chrome instance closed in `finally`.

   Six cells = {phone 390x844 touch+mobile (dsf 2), desktop 1440x900} x {he, en, fr} (?lang=). Per cell, the card's contract:
     a  the document answers 200 and carries `x-robots-tag: noindex, nofollow`
     b  window.__tour.ready within 60 s of navigation AND the panorama band of the screenshot is genuinely painted - measured
        on the decoded PNG (luma std-dev, unique colours, dominant-colour share), not inferred from file size - with the
        loading overlay gone, no error overlay, the Pannellum canvas filling the viewport and the page title the tour's
     c  #tour-badge, #tour-concept, #tour-ai-note: every text line box inside the viewport and not covered by another element
        (elementFromPoint), effective opacity >= 0.95, text equal to the copy pack's string for the cell's language,
        data-permanent="true", the badge's computed font-size >= 12 px, <html lang/dir> matching the cell
     d  ONE real hotspot tap (touchscreen on phone cells, mouse on desktop cells) at the hotspot's on-screen centre changes
        __tour.scene and raises __tour.loads, the new room's title equals the hotspot's label, and the new room paints
        (same measurement, and the frame differs from the first scene's). A fallback click is used ONLY to diagnose a failed tap.
     e  no horizontal scroll: documentElement.scrollWidth <= innerWidth and window.scrollTo(300,0) leaves scrollX at 0 (first paint
        and after the hotspot)
     f  zero console errors / page errors / failed requests; every panos/*.webp (or panos-full/*.webp, T18g) response is 200 image/webp and non-trivial in size,
        and on a tiled build (WALKAROUND-QUALITY-PLAN.md Q06) every panos-tiles/** response is too (≥ 500 bytes; a tile of plain ceiling is ~1 KB)
   Everything else the run sees (tap-target size, whether the hotspot caption is tappable, WebGL renderer, warnings, bytes) is
   recorded under `notes` / the cell record and never changes the verdict.

   Usage (harness root, Git Bash; the Bash-tool timeout is (N+60) s):
     timeout 540 node Habait/tour360/tools/paint-proof.mjs https://habait-tour.vercel.app [--cells phone-he,desktop-fr] [--out <dir>] [--apt <id>]
     node Habait/tour360/tools/paint-proof.mjs --selftest      (offline, no Chrome: the paint metric must FAIL flat frames, PASS real ones)
   Output: one line per cell + `6/6 PASS` | `n/6 FAIL`; paint-proof.json and the per-cell PNGs (the main session converts them with
   qa-evidence/_tools/webp-lossless.mjs --verify) in --out (default qa-evidence/tour360/T05b). Exit 0 ONLY when all six cells ran
   and passed (a --cells subset that passes exits 3: partial is never the gate).
   Caveat on the closing line `chrome processes new since start`: it is a PID diff, so it ALSO lists new child processes of a user's
   own Chrome running beside the proof (2026-10-04: two extension renderers, parent = the user's browser). The precise leftover test
   is a command-line query for --remote-debugging-pipe / --headless / playwright (Get-CimInstance Win32_Process, name chrome.exe). */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { appRequire } from './app-require.mjs'; // a worktree has no Habait/MVP/app (board habait-walkaround T18)

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // Habait/tour360
const REPO = path.resolve(ROOT, '..', '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const args = { url: null, cells: null, out: null, selftest: false };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--cells') args.cells = String(argv[++i] || '').split(',').filter(Boolean);
  else if (a === '--out') args.out = argv[++i];
  else if (a === '--apt') args.apt = argv[++i]; // the apartment whose title the page must carry (default demo-01)
  else if (a === '--selftest') args.selftest = true;
  else if (!a.startsWith('--') && !args.url) args.url = a;
  else { console.error('paint-proof: unknown argument ' + a); process.exit(2); }
}
if (!args.selftest && !args.url) {
  console.error('usage: node Habait/tour360/tools/paint-proof.mjs <url> [--cells phone-he,desktop-fr] [--out <dir>]   |   --selftest');
  process.exit(2);
}

/* ---------------------------------------------------------------- thresholds (all stated, none hidden) */
const READY_MAX_MS = 60000;
const BADGE_MIN_PX = 12;
const REGION = { x0: 0.15, x1: 0.85, y0: 0.40, y1: 0.66 }; // the middle band of the frame: panorama only - clear of the header, the title block, the tool column and the room strip
const PAINT_MIN = { stdLuma: 6, uniqueColours: 500, modalShareMax: 0.6 };
const FRAME_CHANGED_MIN = 4; // mean abs RGB difference between the first scene's band and the second scene's band
const PANO_MIN_BYTES = 100000;
const TILE_MIN_BYTES = 500; // card Q06: the smallest real 512 px tile cut for apt846 is 1122 bytes (a flat ceiling)
const CELL_BUDGET_MS = 150000;
const RUN_START_BUDGET_MS = 440000; // no new cell starts after this (the outer `timeout 540` is the hard bound)
const AFTER_READY_SETTLE_MS = 1500;

/* ---------------------------------------------------------------- libraries (read-only reuse) */
function loadSharp() {
  for (const pkg of ['qa-evidence/_tools/package.json', 'Habait/MVP/app/package.json']) {
    try { return createRequire(path.join(REPO, pkg))('sharp'); } catch { /* try the next */ }
  }
  try { return appRequire(REPO)('sharp'); } catch { /* a worktree: the main checkout's app (board habait-walkaround T18) */ }
  throw new Error('sharp not found (qa-evidence/_tools or the app repo)');
}
const sharp = loadSharp();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const withTimeout = (p, ms, label) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout ${ms} ms: ${label}`)), ms))]);
const r1 = (x) => Math.round(x * 10) / 10;

/* ---------------------------------------------------------------- the paint metric */
async function decode(png) {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height, c: info.channels };
}
function band(img) {
  return { X0: Math.floor(img.w * REGION.x0), X1: Math.floor(img.w * REGION.x1), Y0: Math.floor(img.h * REGION.y0), Y1: Math.floor(img.h * REGION.y1) };
}
function regionStats(img) {
  const { X0, X1, Y0, Y1 } = band(img);
  let sum = 0, sum2 = 0, n = 0;
  const uniq = new Set();
  const q5 = new Uint32Array(32768);
  for (let y = Y0; y < Y1; y++) {
    let i = (y * img.w + X0) * img.c;
    for (let x = X0; x < X1; x++, i += img.c) {
      const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      sum += l; sum2 += l * l; n++;
      uniq.add((r << 16) | (g << 8) | b);
      q5[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)]++;
    }
  }
  let modal = 0;
  for (let k = 0; k < q5.length; k++) if (q5[k] > modal) modal = q5[k];
  const mean = sum / n;
  return {
    image: [img.w, img.h], band: [X0, Y0, X1, Y1], pixels: n, meanLuma: r1(mean),
    stdLuma: r1(Math.sqrt(Math.max(0, sum2 / n - mean * mean))), uniqueColours: uniq.size, modalShare: Math.round((modal / n) * 1000) / 1000,
  };
}
const isPainted = (s) => s.stdLuma >= PAINT_MIN.stdLuma && s.uniqueColours >= PAINT_MIN.uniqueColours && s.modalShare <= PAINT_MIN.modalShareMax;
function meanAbsDiff(a, b) {
  if (a.w !== b.w || a.h !== b.h) return null;
  const { X0, X1, Y0, Y1 } = band(a);
  let sum = 0, n = 0;
  for (let y = Y0; y < Y1; y += 2) {
    for (let x = X0; x < X1; x += 2) {
      const i = (y * a.w + x) * a.c, j = (y * b.w + x) * b.c;
      sum += Math.abs(a.data[i] - b.data[j]) + Math.abs(a.data[i + 1] - b.data[j + 1]) + Math.abs(a.data[i + 2] - b.data[j + 2]);
      n += 3;
    }
  }
  return r1(sum / n);
}

/* ---------------------------------------------------------------- --selftest: a check that cannot fail proves nothing */
async function selftest() {
  const rows = [];
  const expect = (name, got, want, extra) => { rows.push({ name, ok: got === want, got, want, extra }); };
  const navy = { r: 10, g: 19, b: 48 };
  const flat = await sharp({ create: { width: 390, height: 844, channels: 3, background: navy } }).png().toBuffer();
  const block = await sharp({ create: { width: 60, height: 60, channels: 3, background: '#ffffff' } }).png().toBuffer();
  const spinner = await sharp({ create: { width: 390, height: 844, channels: 3, background: navy } }).composite([{ input: block, left: 165, top: 400 }]).png().toBuffer();
  const sFlat = regionStats(await decode(flat));
  const sSpin = regionStats(await decode(spinner));
  expect('flat navy frame is NOT painted', isPainted(sFlat), false, sFlat);
  expect('navy frame with one white block (a spinner) is NOT painted', isPainted(sSpin), false, sSpin);
  const T01 = path.join(REPO, 'qa-evidence', 'tour360', 'T01');
  const refs = ['phone-he.png', 'desktop-he.png', 'check-desktop-en.png', 'check-kitchen-en.png'];
  const imgs = {};
  for (const f of refs) {
    const p = path.join(T01, f);
    if (!fs.existsSync(p)) { rows.push({ name: `reference frame ${f} present`, ok: false, got: 'missing', want: 'present' }); continue; }
    imgs[f] = await decode(fs.readFileSync(p));
    const s = regionStats(imgs[f]);
    expect(`real frame ${f} IS painted`, isPainted(s), true, s);
  }
  if (imgs['check-desktop-en.png'] && imgs['check-kitchen-en.png']) {
    const same = meanAbsDiff(imgs['check-desktop-en.png'], imgs['check-desktop-en.png']);
    const diff = meanAbsDiff(imgs['check-desktop-en.png'], imgs['check-kitchen-en.png']);
    expect('a frame against itself is NOT "changed"', same >= FRAME_CHANGED_MIN, false, { mad: same });
    expect('living room vs kitchen IS "changed"', diff >= FRAME_CHANGED_MIN, true, { mad: diff });
  }
  for (const r of rows) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name}  ${JSON.stringify(r.extra || { got: r.got })}`);
  const bad = rows.filter((r) => !r.ok).length;
  console.log(`selftest: ${rows.length - bad}/${rows.length} as expected`);
  process.exit(bad ? 1 : 0);
}
if (args.selftest) { await selftest(); }

/* ---------------------------------------------------------------- live run */
const { chromium } = appRequire(REPO)('playwright-core');
const OUT = path.resolve(args.out || path.join(REPO, 'qa-evidence', 'tour360', 'T05b'));
const COPY = JSON.parse(fs.readFileSync(path.join(ROOT, 'copy', 'tour360-copy.json'), 'utf8'));
const APT = JSON.parse(fs.readFileSync(path.join(ROOT, 'apartments', args.apt || 'demo-01', 'apartment.json'), 'utf8'));

const ALL_CELLS = [];
for (const kind of ['phone', 'desktop']) {
  for (const lang of ['he', 'en', 'fr']) {
    ALL_CELLS.push({
      name: `${kind}-${lang}`, kind, lang,
      ...(kind === 'phone'
        ? { viewport: { width: 390, height: 844 }, dsf: 2, isMobile: true, hasTouch: true }
        : { viewport: { width: 1440, height: 900 }, dsf: 1, isMobile: false, hasTouch: false }),
    });
  }
}

/* page-side readers (serialised into the page - no outer-scope references) */
const readPage = () => {
  // Occlusion is judged by PAINT ORDER, not pointer routing: the title block is pointer-events:none by design (taps pass
  // through to the panorama), and elementFromPoint skips such boxes - so pointer-events is forced to auto for the length of
  // the measurement and removed again in `finally`.
  const forced = document.createElement('style');
  forced.textContent = '*{pointer-events:auto !important}';
  document.head.appendChild(forced);
  try {
  const vw = window.innerWidth, vh = window.innerHeight;
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const effOpacity = (node) => {
    let o = 1;
    for (let e = node; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none') return 0;
      o *= parseFloat(cs.opacity);
    }
    return getComputedStyle(node).visibility === 'hidden' ? 0 : o;
  };
  const REPLACED = ['IMG', 'CANVAS', 'SVG', 'VIDEO', 'PICTURE', 'INPUT', 'TEXTAREA', 'SELECT'];
  const paintsNothing = (e) => {
    if (effOpacity(e) < 0.05) return true;
    if (REPLACED.includes(e.tagName.toUpperCase())) return false;
    const cs = getComputedStyle(e);
    const transparentBg = cs.backgroundColor === 'transparent' || /rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)/.test(cs.backgroundColor);
    const noBorder = ['Top', 'Right', 'Bottom', 'Left'].every((s) => parseFloat(cs['border' + s + 'Width']) === 0 || cs['border' + s + 'Style'] === 'none');
    const ownText = Array.from(e.childNodes).some((c) => c.nodeType === 3 && c.textContent.trim());
    return transparentBg && cs.backgroundImage === 'none' && noBorder && cs.boxShadow === 'none' && !ownText;
  };
  const describe = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).join('.') : '');
  const disclosure = (id, textId) => {
    const n = document.getElementById(id);
    if (!n) return { present: false };
    const t = textId ? document.getElementById(textId) : n;
    const cs = getComputedStyle(n);
    const range = document.createRange();
    range.selectNodeContents(t);
    const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0.5 && r.height > 0.5);
    let inside = rects.length > 0, covered = 0;
    const coveredBy = [];
    for (const r of rects) {
      if (r.left < 0 || r.top < 0 || r.right > vw + 0.5 || r.bottom > vh + 0.5) inside = false;
      for (const f of [0.1, 0.5, 0.9]) {
        let ok = false, by = null;
        for (const e of document.elementsFromPoint(r.left + r.width * f, r.top + r.height / 2)) { // topmost first
          if (n.contains(e)) { ok = true; break; }
          if (paintsNothing(e)) continue;
          by = describe(e);
          break;
        }
        if (!ok) { covered++; if (coveredBy.length < 3) coveredBy.push(by); }
      }
    }
    const b = n.getBoundingClientRect();
    return {
      present: true, text: norm(n.textContent), permanent: n.getAttribute('data-permanent'),
      fontPx: parseFloat(getComputedStyle(t).fontSize), fontPxBox: parseFloat(cs.fontSize),
      display: cs.display, visibility: cs.visibility, opacity: Math.round(effOpacity(n) * 100) / 100,
      lineBoxes: rects.length, inside, covered, coveredBy, bbox: [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)],
    };
  };
  const q = (sel) => document.querySelector(sel);
  const loading = document.getElementById('t-loading');
  const err = document.getElementById('t-error');
  const pnlmErr = q('.pnlm-error-msg');
  const canvas = q('#pano canvas');
  const cr = canvas ? canvas.getBoundingClientRect() : null;
  const t = window.__tour || {};
  const de = document.documentElement;
  const hs = Array.from(document.querySelectorAll('.t-hs'));
  const inView = hs.filter((n) => {
    const r = n.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    return r.width > 0 && getComputedStyle(n).visibility !== 'hidden' && cx > 0 && cx < vw && cy > 0 && cy < vh;
  }).length;
  const el = (id) => document.getElementById(id);
  return {
    viewport: [vw, vh], visualScale: window.visualViewport ? window.visualViewport.scale : null,
    lang: de.lang, dir: de.dir, title: document.title,
    tour: { ready: t.ready, scene: t.scene, lang: t.lang, loads: t.loads, interacted: t.interacted },
    room: norm(el('t-room') && el('t-room').textContent), zone: norm(el('t-zone') && el('t-zone').textContent),
    loading: loading ? { cls: loading.className, opacity: getComputedStyle(loading).opacity } : null,
    errorShown: err ? !err.hidden : null,
    pnlmError: pnlmErr ? getComputedStyle(pnlmErr).display !== 'none' : false,
    canvas: cr ? { w: Math.round(cr.width), h: Math.round(cr.height), cw: canvas.width, ch: canvas.height } : null,
    badge: disclosure('tour-badge'), concept: disclosure('tour-concept'), ai: disclosure('tour-ai-note', 't-ai-text'),
    langButtons: Array.from(document.querySelectorAll('#t-lang button')).map((b) => b.dataset.lang + ':' + b.getAttribute('aria-pressed')),
    scroll: { docW: de.scrollWidth, bodyW: document.body.scrollWidth, innerW: vw, docH: de.scrollHeight, innerH: vh },
    hotspotsTotal: hs.length, hotspotsInView: inView,
    robotsMeta: (q('meta[name="robots"]') || {}).content || null,
  };
  } finally { forced.remove(); }
};
const readHotspots = () => {
  const vw = innerWidth, vh = innerHeight;
  return Array.from(document.querySelectorAll('.t-hs')).map((n) => {
    const r = n.getBoundingClientRect();
    const cs = getComputedStyle(n);
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const lab = n.querySelector('.t-hs-label');
    const lr = lab ? lab.getBoundingClientRect() : null;
    const lx = lr ? lr.left + lr.width / 2 : null, ly = lr ? lr.top + lr.height / 2 : null;
    const labelMeasurable = lr && lx > 0 && lx < vw && ly > 0 && ly < vh;
    const labelHit = labelMeasurable ? document.elementFromPoint(lx, ly) : null;
    const inView = r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cx > 16 && cx < vw - 16 && cy > 16 && cy < vh - 16;
    const hit = inView ? document.elementFromPoint(cx, cy) : null;
    return {
      label: (lab ? lab.textContent : '').trim(), cx, cy, w: Math.round(r.width), h: Math.round(r.height), inView, hits: !!hit && n.contains(hit),
      labelTapHitsHotspot: labelMeasurable ? (!!labelHit && n.contains(labelHit)) : null, centreDist: Math.hypot(cx - vw / 2, cy - vh / 2),
    };
  });
};
const turnToFirstHotspot = () => {
  const v = window.__tour && window.__tour.viewer;
  const cfg = v && v.getConfig && v.getConfig();
  const h = cfg && cfg.hotSpots && cfg.hotSpots[0];
  if (!h) return null;
  v.lookAt(h.pitch, h.yaw, v.getHfov(), false);
  return { yaw: h.yaw, pitch: h.pitch };
};
const loadingGone = () => { const l = document.getElementById('t-loading'); return !!l && l.classList.contains('is-hidden') && getComputedStyle(l).opacity === '0'; };
const webglProbe = () => {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return null;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return { version: gl.getParameter(gl.VERSION), renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) };
  } catch (e) { return { error: String(e) }; }
};

/* ---------------------------------------------------------------- chrome process bookkeeping */
function chromePids() {
  try {
    const out = execFileSync('tasklist', ['/FI', 'IMAGENAME eq chrome.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf8', timeout: 20000 });
    return out.split(/\r?\n/).map((l) => l.match(/^"chrome\.exe","(\d+)"/i)).filter(Boolean).map((m) => Number(m[1]));
  } catch { return null; }
}

/* ---------------------------------------------------------------- one cell */
async function runCell(browser, cell, major, runInfo) {
  const rec = { cell: cell.name, ok: false, kind: cell.kind, lang: cell.lang, viewport: cell.viewport, deviceScaleFactor: cell.dsf, isMobile: cell.isMobile, hasTouch: cell.hasTouch, checks: {}, notes: [] };
  const t0 = Date.now();
  const userAgent = cell.isMobile
    ? `Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Mobile Safari/537.36`
    : `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`;
  rec.userAgent = userAgent;
  const ctx = await browser.newContext({ viewport: cell.viewport, deviceScaleFactor: cell.dsf, isMobile: cell.isMobile, hasTouch: cell.hasTouch, userAgent });
  const page = await ctx.newPage();
  const net = { responses: [], failed: [], consoleErrors: [], pageErrors: [], warnings: [] };
  page.on('console', (m) => {
    if (m.type() === 'error') net.consoleErrors.push({ text: m.text().slice(0, 300), at: m.location().url || null });
    else if (m.type() === 'warning') net.warnings.push(m.text().slice(0, 200));
  });
  page.on('pageerror', (e) => net.pageErrors.push(String(e).slice(0, 300)));
  page.on('requestfailed', (r) => net.failed.push({ url: r.url(), error: (r.failure() || {}).errorText || null }));
  page.on('response', (r) => {
    const h = r.headers();
    net.responses.push({ url: r.url(), status: r.status(), type: r.request().resourceType(), contentType: h['content-type'] || null, length: h['content-length'] ? Number(h['content-length']) : null, atMs: Date.now() - t0 });
  });
  const check = (id, ok, detail) => { rec.checks[id] = { ok: Boolean(ok), ...detail }; return Boolean(ok); };
  try {
    await withTimeout(cellBody(page, cell, rec, net, check, t0, runInfo), CELL_BUDGET_MS, `cell ${cell.name}`);
  } catch (e) {
    rec.error = String((e && e.message) || e).split('\n')[0];
  }
  // (f) is judged whatever happened above
  const origin = new URL(args.url).origin;
  const pano = net.responses.filter((r) => /\/panos(-full)?\/[^/?]+\.webp(\?|$)/.test(r.url)); // T18g: a --full build serves desktops from panos-full/
  const badPano = pano.filter((r) => r.status !== 200 || !/image\/webp/i.test(r.contentType || '') || (r.length != null && r.length < PANO_MIN_BYTES));
  // WALKAROUND-QUALITY-PLAN.md card Q06: a tiled build paints from panos-tiles/ (512 px faces and tiles, a flat ceiling tile ~1 KB)
  const tileResp = net.responses.filter((r) => /\/panos-tiles\/[^?]+\.webp(\?|$)/.test(r.url));
  const badTile = tileResp.filter((r) => r.status !== 200 || !/image\/webp/i.test(r.contentType || '') || (r.length != null && r.length < TILE_MIN_BYTES));
  const httpErrors = net.responses.filter((r) => r.url.startsWith(origin) && r.status >= 400);
  const realFailures = net.failed.filter((f) => !/ERR_ABORTED/.test(f.error || ''));
  check('f', net.consoleErrors.length === 0 && net.pageErrors.length === 0 && pano.length + tileResp.length >= 1 && badPano.length === 0 && badTile.length === 0 && httpErrors.length === 0 && realFailures.length === 0, {
    consoleErrors: net.consoleErrors, pageErrors: net.pageErrors, failedRequests: net.failed, httpErrors: httpErrors.map((r) => ({ url: r.url, status: r.status })),
    panoResponses: pano.map((r) => ({ file: r.url.split('/').pop(), status: r.status, contentType: r.contentType, bytes: r.length })), badPano: badPano.length,
    tileResponses: tileResp.length, badTile: badTile.length, badTileSample: badTile.slice(0, 3).map((r) => ({ url: r.url, status: r.status, contentType: r.contentType, bytes: r.length })),
  });
  const byType = {};
  for (const r of net.responses) { const k = new URL(r.url).pathname.split('/')[1] || '(doc)'; (byType[k] = byType[k] || []).push(r.status); }
  rec.requestsByFolder = Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, { n: v.length, statuses: [...new Set(v)].sort() }]));
  if (net.warnings.length) rec.notes.push(`${net.warnings.length} console warning(s), first: ${net.warnings[0]}`);
  try { await withTimeout(ctx.close(), 15000, 'context.close'); } catch (e) { rec.notes.push('context close: ' + e.message); }
  rec.ok = ['a', 'b', 'c', 'd', 'e', 'f'].every((k) => rec.checks[k] && rec.checks[k].ok);
  rec.totalMs = Date.now() - t0;
  return rec;
}

async function cellBody(page, cell, rec, net, check, t0, runInfo) {
  const navUrl = new URL(args.url);
  navUrl.searchParams.set('lang', cell.lang);
  const want = {
    badge: COPY.badge[cell.lang], concept: COPY.conceptLine[cell.lang], ai: COPY.aiNote[cell.lang],
    title: `${COPY.ui.title[cell.lang]} \u00b7 ${APT.title[cell.lang]}`,
  };
  const evidence = (suffix) => path.join(OUT, `${cell.name}${suffix}.png`);

  /* (a) the document */
  const resp = await page.goto(navUrl.href, { waitUntil: 'load', timeout: 60000 });
  const h = resp.headers();
  const robots = String(h['x-robots-tag'] || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const from = resp.request().redirectedFrom();
  rec.document = {
    requested: navUrl.href, finalUrl: page.url(), status: resp.status(), contentType: h['content-type'] || null, xRobotsTag: h['x-robots-tag'] || null,
    redirectedFrom: from ? from.url() : null, server: h.server || null, vercelId: h['x-vercel-id'] || null, vercelCache: h['x-vercel-cache'] || null, loadEventMs: Date.now() - t0,
  };
  check('a', resp.status() === 200 && robots === 'noindex, nofollow' && /text\/html/i.test(h['content-type'] || ''), {
    status: resp.status(), xRobotsTag: h['x-robots-tag'] || null, contentType: h['content-type'] || null,
  });

  /* (b) ready within 60 s, then the panorama band painted */
  let ready = false;
  try {
    await page.waitForFunction(() => window.__tour && window.__tour.ready === true, null, { timeout: Math.max(3000, READY_MAX_MS - (Date.now() - t0)), polling: 100 });
    ready = true;
  } catch (e) { rec.notes.push('ready wait: ' + String(e.message).split('\n')[0]); }
  rec.readyMs = ready ? Date.now() - t0 : null;
  rec.bytesBeforeReady = net.responses.filter((r) => r.atMs <= (rec.readyMs || Date.now() - t0)).reduce((s, r) => s + (r.length || 0), 0);
  if (!ready) {
    check('b', false, { ready: false, waitedMs: Date.now() - t0 });
    try { await page.screenshot({ path: evidence('-NOT-READY'), type: 'png' }); } catch { /* best effort */ }
    return;
  }
  await page.waitForFunction(loadingGone, null, { timeout: 15000, polling: 100 }).catch(() => rec.notes.push('loading overlay did not reach is-hidden / opacity 0 within 15 s'));
  await sleep(AFTER_READY_SETTLE_MS);
  const p1 = await page.evaluate(readPage);
  const png1 = await page.screenshot({ path: evidence(''), type: 'png' });
  const img1 = await decode(png1);
  const st1 = regionStats(img1);
  rec.screenshot = { file: `${cell.name}.webp`, capturedAs: `${cell.name}.png`, pngSha256: crypto.createHash('sha256').update(png1).digest('hex').slice(0, 16), size: [img1.w, img1.h] };
  if (!runInfo.webgl) runInfo.webgl = await page.evaluate(webglProbe).catch(() => null);
  const loadingHidden1 = !!p1.loading && p1.loading.opacity === '0';
  const titleOk = p1.title === want.title;
  const canvasOk = !!p1.canvas && p1.canvas.w >= cell.viewport.width * 0.9 && p1.canvas.h >= cell.viewport.height * 0.9 && p1.canvas.cw > 0 && p1.canvas.ch > 0;
  check('b', rec.readyMs <= READY_MAX_MS && isPainted(st1) && loadingHidden1 && !p1.errorShown && !p1.pnlmError && titleOk && canvasOk, {
    readyMs: rec.readyMs, paint: st1, painted: isPainted(st1), loadingOverlayGone: loadingHidden1, errorOverlayShown: p1.errorShown, pannellumError: p1.pnlmError,
    titleOk, title: p1.title, canvas: p1.canvas, firstScene: p1.tour.scene,
  });

  /* (c) the disclosure, in frame, in the cell's language */
  const dis = (e, text) => ({
    present: e.present, textOk: Boolean(e.present && e.text === text), text: e.text, permanent: e.permanent, fontPx: e.fontPx, fontPxBox: e.fontPxBox, opacity: e.opacity,
    lineBoxes: e.lineBoxes, insideViewport: e.inside, coveredSamples: e.covered, coveredBy: e.coveredBy, bbox: e.bbox,
  });
  const dB = dis(p1.badge, want.badge), dC = dis(p1.concept, want.concept), dA = dis(p1.ai, want.ai);
  const shown = (e) => Boolean(e.present && e.display !== 'none' && e.visibility !== 'hidden' && e.opacity >= 0.95 && e.lineBoxes > 0 && e.inside && e.covered === 0);
  const langOk = p1.lang === cell.lang && p1.dir === (cell.lang === 'he' ? 'rtl' : 'ltr') && p1.tour.lang === cell.lang;
  check('c', shown(p1.badge) && shown(p1.concept) && shown(p1.ai) && dB.textOk && dC.textOk && dA.textOk &&
    p1.badge.permanent === 'true' && p1.concept.permanent === 'true' && p1.ai.permanent === 'true' && p1.badge.fontPx >= BADGE_MIN_PX && langOk, {
    badge: dB, concept: dC, aiNote: dA, htmlLang: p1.lang, htmlDir: p1.dir, tourLang: p1.tour.lang, languageButtons: p1.langButtons, badgeMinPx: BADGE_MIN_PX,
  });

  /* (e) part 1 - first paint */
  const scrollX1 = await page.evaluate(() => { window.scrollTo(300, 0); const x = window.scrollX; window.scrollTo(0, 0); return x; });
  const e1 = { docScrollWidth: p1.scroll.docW, bodyScrollWidth: p1.scroll.bodyW, innerWidth: p1.scroll.innerW, scrollXAfterScrollTo300: scrollX1, visualViewportScale: p1.visualScale };
  const noH1 = e1.docScrollWidth <= e1.innerWidth && scrollX1 === 0;
  rec.firstView = { room: p1.room, zone: p1.zone, hotspotsTotal: p1.hotspotsTotal, hotspotsInView: p1.hotspotsInView };

  /* (d) one real hotspot tap */
  const s0 = { scene: p1.tour.scene, loads: p1.tour.loads };
  let hs = await page.evaluate(readHotspots);
  const pickIn = (list) => list.filter((x) => x.inView && x.hits).sort((a, b) => a.centreDist - b.centreDist)[0];
  let cand = pickIn(hs);
  let turned = null;
  if (!cand) {
    turned = await page.evaluate(turnToFirstHotspot);
    await sleep(800);
    hs = await page.evaluate(readHotspots);
    cand = pickIn(hs);
    rec.notes.push('no hotspot was tappable in the first view; the view was turned to one through the page hook (window.__tour.viewer.lookAt)');
  }
  if (!cand) {
    check('d', false, { reason: 'no tappable hotspot found', hotspotsTotal: hs.length, turnedViaHook: turned });
    check('e', noH1, { firstPaint: e1 });
    return;
  }
  await sleep(150);
  const again = pickIn(await page.evaluate(readHotspots).catch(() => [])) || cand;
  const target = again.label === cand.label ? again : cand;
  const via = cell.hasTouch ? 'touchscreen.tap' : 'mouse.click';
  const tapAt = Date.now();
  if (cell.hasTouch) await page.touchscreen.tap(target.cx, target.cy); else await page.mouse.click(target.cx, target.cy);
  const moved = await page.waitForFunction(([sc, ld]) => window.__tour.scene !== sc && window.__tour.loads > ld, [s0.scene, s0.loads], { timeout: 30000, polling: 100 }).then(() => true, () => false);
  const navMs = moved ? Date.now() - tapAt : null;
  let fallback = null;
  if (!moved) {
    try {
      await page.locator('.t-hs', { hasText: target.label }).first().click({ force: true, timeout: 8000 });
      fallback = await page.waitForFunction(([sc, ld]) => window.__tour.scene !== sc && window.__tour.loads > ld, [s0.scene, s0.loads], { timeout: 20000, polling: 100 }).then(() => 'a forced locator click DID navigate', () => 'a forced locator click did not navigate either');
    } catch (e) { fallback = 'fallback click errored: ' + String(e.message).split('\n')[0]; }
  }
  await page.waitForFunction(loadingGone, null, { timeout: 20000, polling: 100 }).catch(() => rec.notes.push('after the hotspot: loading overlay did not reach is-hidden within 20 s'));
  await sleep(AFTER_READY_SETTLE_MS);
  const p2 = await page.evaluate(readPage);
  const png2 = await page.screenshot({ path: evidence('-after-hotspot'), type: 'png' });
  const img2 = await decode(png2);
  const st2 = regionStats(img2);
  const mad = meanAbsDiff(img1, img2);
  const loadingHidden2 = !!p2.loading && p2.loading.opacity === '0';
  const destinationOk = p2.room === target.label;
  rec.afterHotspot = { room: p2.room, zone: p2.zone, screenshot: `${cell.name}-after-hotspot.webp`, pngSha256: crypto.createHash('sha256').update(png2).digest('hex').slice(0, 16) };
  check('d', moved && p2.tour.scene !== s0.scene && p2.tour.loads > s0.loads && isPainted(st2) && mad != null && mad >= FRAME_CHANGED_MIN && destinationOk && loadingHidden2 && !p2.errorShown && !p2.pnlmError, {
    via, hotspotLabel: target.label, tapAt: [Math.round(target.cx), Math.round(target.cy)], tapTargetPx: [target.w, target.h], moved, navMs,
    sceneBefore: s0.scene, sceneAfter: p2.tour.scene, loadsBefore: s0.loads, loadsAfter: p2.tour.loads, roomTitleAfter: p2.room, destinationMatchesLabel: destinationOk,
    paintAfter: st2, paintedAfter: isPainted(st2), frameMeanAbsDiffVsFirst: mad, frameChangedMin: FRAME_CHANGED_MIN, loadingOverlayGone: loadingHidden2,
    turnedViaHook: turned, fallbackDiagnosis: fallback,
  });
  if (target.labelTapHitsHotspot === false) rec.notes.push('hotspot caption: tapping the caption pill does not hit the hotspot (pointer-events none, outside the 56 px box) - the ring is the only live target');
  if (Math.min(target.w, target.h) < 44 && cell.isMobile) rec.notes.push(`hotspot tap target ${target.w}x${target.h} px (< 44)`);

  /* (e) part 2 - after the hotspot */
  const scrollX2 = await page.evaluate(() => { window.scrollTo(300, 0); const x = window.scrollX; window.scrollTo(0, 0); return x; });
  const e2 = { docScrollWidth: p2.scroll.docW, bodyScrollWidth: p2.scroll.bodyW, innerWidth: p2.scroll.innerW, scrollXAfterScrollTo300: scrollX2 };
  check('e', noH1 && e2.docScrollWidth <= e2.innerWidth && scrollX2 === 0, { firstPaint: e1, afterHotspot: e2 });
}

/* ---------------------------------------------------------------- main */
async function main() {
  const startedAt = new Date().toISOString();
  const tStart = Date.now();
  fs.mkdirSync(OUT, { recursive: true });
  const wanted = ALL_CELLS.filter((c) => !args.cells || args.cells.includes(c.name));
  if (!wanted.length) { console.error('paint-proof: no cell matches --cells ' + args.cells); process.exit(2); }
  const pidsBefore = chromePids();
  const runInfo = { webgl: null };
  const results = [];
  let browser, version = null, closeError = null;
  try {
    browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--mute-audio'] });
    version = browser.version();
    const major = String(version).split('.')[0];
    for (const cell of wanted) {
      if (Date.now() - tStart > RUN_START_BUDGET_MS) {
        results.push({ cell: cell.name, ok: false, checks: {}, notes: [], error: 'NOT RUN - the run budget was spent before this cell started' });
        continue;
      }
      results.push(await runCell(browser, cell, major, runInfo));
    }
  } finally {
    if (browser) { try { await withTimeout(browser.close(), 20000, 'browser.close'); } catch (e) { closeError = String(e.message || e); } }
  }
  const pidsAfter = chromePids();
  const leftover = pidsBefore && pidsAfter ? pidsAfter.filter((p) => !pidsBefore.includes(p)) : null;

  const pass = results.filter((r) => r.ok).length;
  const fail = results.length - pass;
  const full = results.length === ALL_CELLS.length;
  const verdict = fail === 0 ? `${pass}/${results.length} PASS` : `${fail}/${results.length} FAIL`;
  const report = {
    schema: 'tour360/paint-proof.v1', board: 'habait-tour360', task: 'T05b', actor: 'habait-deploy-qa', url: args.url,
    startedAt, finishedAt: new Date().toISOString(), durationMs: Date.now() - tStart,
    verdict: full ? verdict : `${verdict} (PARTIAL: ${results.length} of ${ALL_CELLS.length} cells run)`, partial: !full,
    host: { platform: process.platform, node: process.version, chrome: version, chromeExecutable: CHROME, webgl: runInfo.webgl },
    thresholds: { readyMaxMs: READY_MAX_MS, badgeMinPx: BADGE_MIN_PX, paintBandOfFrame: REGION, paintMin: PAINT_MIN, frameChangedMin: FRAME_CHANGED_MIN, panoMinBytes: PANO_MIN_BYTES },
    chromeProcesses: { before: pidsBefore ? pidsBefore.length : null, after: pidsAfter ? pidsAfter.length : null, newSinceStart: leftover, browserCloseError: closeError },
    screenshotsNote: 'Captured as PNG by this script; converted to lossless WebP by qa-evidence/_tools/webp-lossless.mjs --verify (pixels byte-identical); only the converted PNGs are removed.',
    cells: results,
  };
  fs.writeFileSync(path.join(OUT, full ? 'paint-proof.json' : 'paint-proof.partial.json'), JSON.stringify(report, null, 2) + '\n');

  console.log(`paint-proof ${args.url} - Chrome ${version} - WebGL ${runInfo.webgl ? runInfo.webgl.renderer + ' (max texture ' + runInfo.webgl.maxTextureSize + ')' : 'unknown'}`);
  for (const r of results) {
    const c = r.checks || {};
    const failing = ['a', 'b', 'c', 'd', 'e', 'f'].filter((k) => !(c[k] && c[k].ok));
    if (r.ok) {
      const d = c.d, b = c.b, cc = c.c;
      console.log(`PASS ${r.cell.padEnd(11)} ${r.viewport.width}x${r.viewport.height} | doc ${c.a.status} ${c.a.xRobotsTag} | ready ${(r.readyMs / 1000).toFixed(1)}s paint std=${b.paint.stdLuma} uniq=${b.paint.uniqueColours} modal=${b.paint.modalShare} | disclosure 3/3 ${r.lang} badge=${cc.badge.fontPx}px | hotspot "${d.hotspotLabel}" via ${d.via} ${d.sceneBefore}->${d.sceneAfter} loads ${d.loadsBefore}->${d.loadsAfter} mad=${d.frameMeanAbsDiffVsFirst} | scroll ${c.e.firstPaint.docScrollWidth}/${c.e.firstPaint.innerWidth} | errors 0, panos ${c.f.panoResponses.length}x200${c.f.tileResponses ? `, tiles ${c.f.tileResponses}x200` : ''}`);
    } else {
      console.log(`FAIL ${r.cell.padEnd(11)} failing checks: ${failing.join(',') || '-'}${r.error ? ' | ' + r.error : ''}`);
      for (const k of failing) if (c[k]) console.log(`       ${k}: ${JSON.stringify(c[k]).slice(0, 700)}`);
    }
  }
  console.log(report.verdict);
  console.log(`chrome processes new since start: ${leftover === null ? 'unknown' : leftover.length ? leftover.join(',') : 'none'}${closeError ? ' (close error: ' + closeError + ')' : ''}`);
  console.log(`wrote ${path.join(OUT, full ? 'paint-proof.json' : 'paint-proof.partial.json')}`);
  process.exit(fail === 0 && full ? 0 : fail === 0 ? 3 : 1);
}

main().catch((e) => { console.error('paint-proof: fatal: ' + ((e && e.stack) || e)); process.exit(2); });
