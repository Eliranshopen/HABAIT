#!/usr/bin/env node
/* Habait — tools/qa/responsive-gate.mjs: THE responsive gate (Eliran 2026-11-05: «כל דבר שאתה מעדכן חייב להתאים גם לגרסת המובייל בנוסף
   לגרסת הדסקטופ» and «וזה כלל שחייב להיות בלוגיקה בקוד»). One checker, used by the project runner (step qa, before publish) and by the
   habait-flow predeploy (tools/deploy/predeploy.mjs). Headless Chrome at 1440×900 (desktop) and 390×844 (mobile emulation + touch).
   For every page and size it FAILS on:
     - a page error (an uncaught exception) or an HTTP 4xx/5xx response (--ignore-api skips /api/* when a static stage is served
       without its functions);
     - horizontal overflow on EITHER side: document scrollWidth > clientWidth, or any visible element whose rect reaches left < 0 or
       right > innerWidth (an RTL page overflows LEFT — the mobile-responsive skill measures only the right). An element clipped by an
       ancestor that does not overflow, and a fixed panel parked entirely off-screen (a closed drawer), are not overflow;
     - an interactive target smaller than 44×44 px (links inline in running text are listed as notes, the WCAG exception);
     - a fixed/absolute control covering more than 15% of the main canvas/panorama (the largest visible canvas or .pnlm/#pano element).
       A first-visit overlay ([data-first-visit] with a [data-first-visit-dismiss] button, 2026-11-08) is measured open for overflow and
       targets, then dismissed as a visitor would before the covering rule.
   It writes <out>/verdict.json and one viewport screenshot per page and size (<out>/<slug>-1440.png, -390.png); exit 0 = PASS,
   1 = FAIL, 2 = usage.
   usage: node tools/qa/responsive-gate.mjs --out <dir> [--serve <static dir> [--rewrites <vercel.json>]] [--base http://…]
          [--ignore-api] [--settle 3500] [--header-env name=ENV_VAR] <path-or-url> [<path-or-url> …]
   Chrome: C:/Program Files/Google/Chrome/Application/chrome.exe (or $CHROME); playwright-core from $HABAIT_APP_DIR (appdeps). $0. */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const VAL = ['--out', '--serve', '--rewrites', '--base', '--settle', '--header-env'];
const opt = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const urls = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && VAL.includes(argv[i - 1])));
const OUT = opt('--out');
const MAIN = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (MAIN && (!OUT || !urls.length)) { console.error('usage: responsive-gate.mjs --out <dir> [--serve <dir>] [--rewrites vercel.json] [--base url] [--ignore-api] <path> …'); process.exit(2); }
if (MAIN) fs.mkdirSync(OUT, { recursive: true });
const IGNORE_API = argv.includes('--ignore-api');
const SETTLE = Number(opt('--settle', '3500'));
const APP = process.env.HABAIT_APP_DIR || 'C:/RnD/Projects/Habait/tools/appdeps';
const { chromium } = createRequire(path.join(APP, 'package.json'))('playwright-core');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
export const SIZES = [{ name: '1440', viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
  { name: '390', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }];

// ── a static stage served the way Vercel would: files, dir/index.html, and vercel.json rewrites to static destinations
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp4': 'video/mp4', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
function serveStatic(dir, rewrites) {
  const rules = (rewrites || []).map((r) => {
    const names = []; const re = new RegExp('^' + r.source.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\/:(\w+)\*/g, (_, n) => { names.push(n); return '(?:/(.*))?'; }).replace(/:(\w+)/g, (_, n) => { names.push(n); return '([^/]+)'; }) + '$');
    return { re, names, dest: r.destination };
  });
  const file = (u) => { const f = path.join(dir, decodeURIComponent(u)); if (!f.startsWith(path.resolve(dir))) return null; if (fs.existsSync(f) && fs.statSync(f).isFile()) return f; const i = path.join(f, 'index.html'); return fs.existsSync(i) ? i : fs.existsSync(f + '.html') ? f + '.html' : null; };
  return http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'); let p = u.pathname; let f = file(p);
    if (!f) for (const r of rules) { const m = p.match(r.re); if (!m) continue; let d = r.dest; r.names.forEach((n, i) => { d = d.replace(new RegExp(`:${n}\\*?`, 'g'), m[i + 1] || ''); }); const dp = d.split('?')[0]; if (dp.startsWith('/api/')) { p = dp; break; } f = file(dp); if (f) break; }
    if (!f) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('not found'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(f).pipe(res);
  });
}

// ── the in-page measure (runs inside Chrome)
const MEASURE = () => {
  const W = innerWidth, H = innerHeight, out = { overflow: [], targets: [], inline_links: [], covering: [], doc: {} };
  const de = document.documentElement; out.doc = { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, bodyScrollWidth: document.body ? document.body.scrollWidth : 0 };
  const visible = (el) => { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const hiddenByAncestor = (el) => { for (let a = el.parentElement; a; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return true; } return false; };
  const clipped = (el) => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const cs = getComputedStyle(a); if (/(hidden|clip|auto|scroll)/.test(cs.overflowX + cs.overflow)) { const r = a.getBoundingClientRect(); if (r.left >= -1 && r.right <= W + 1) return true; } } return false; };
  const fixedChain = (el) => { for (let a = el; a; a = a.parentElement) if (getComputedStyle(a).position === 'fixed') return a; return null; };
  const name = (el) => (el.id ? `#${el.id}` : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '') || el.tagName.toLowerCase();
  const label = (el) => `${el.tagName.toLowerCase()}${name(el).startsWith('#') || name(el).startsWith('.') ? name(el) : ''} «${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)}»`;
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el) || hiddenByAncestor(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.left < -1 || r.right > W + 1) {
      const fx = fixedChain(el);
      if (fx && (r.right <= 0 || r.left >= W)) continue;   // a closed fixed drawer parked off-screen
      if (clipped(el)) continue;
      out.overflow.push({ el: label(el), left: Math.round(r.left), right: Math.round(r.right) });
    }
  }
  const INTER = 'a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=tab],[role=link],summary,[onclick],[tabindex]:not([tabindex="-1"])';
  for (const el of document.querySelectorAll(INTER)) {
    if (!visible(el) || hiddenByAncestor(el) || el.disabled) continue;
    const cs = getComputedStyle(el); if (cs.pointerEvents === 'none') continue;
    const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > H * 3 || r.right < 0 || r.left > W) continue;
    if (el.tagName === 'INPUT' && /^(checkbox|radio)$/.test(el.type)) { const lab = el.closest('label'); if (lab) { const lr = lab.getBoundingClientRect(); if (lr.width >= 44 && lr.height >= 44) continue; } }
    // an interactive control cut by the viewport edge is overflow even inside a clipping container (the tour header's language pill
    // was cut at the left edge of a phone and the clip exception hid it, 2026-11-05)
    // (a card in a horizontally SCROLLING strip — the room strip, a tab bar — is reachable by scrolling it: a carousel, not a cut)
    const inScroller = (() => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const c = getComputedStyle(a); if (/(auto|scroll)/.test(c.overflowX) && a.scrollWidth > a.clientWidth + 1) return true; } return false; })();
    // (a ring or hotspot drawn IN the 360 panorama moves with the view: one at the edge is the world turning, not chrome cut off —
    //  exempt from THIS edge rule only; its 44 px size and the 15% cover rule still apply. Found on production 2026-11-05: a swap ring
    //  at the panorama's edge at 390 px; accepted by the coordinator the same day)
    const inPano = !!el.closest('.pnlm-container, .pnlm-render-container, [data-main-canvas]');
    if ((r.left < -1 || r.right > W + 1) && r.top < H && r.bottom > 0 && !inScroller && !inPano) out.overflow.push({ el: `${label(el)} (a control cut by the edge)`, left: Math.round(r.left), right: Math.round(r.right) });
    if (r.width >= 44 - 0.5 && r.height >= 44 - 0.5) continue;
    // the HIT area decides, not the drawn box: a stretched link (::after over its card) or a transparent hit area around a pin counts.
    // Nine points of a 44×44 square on the control's centre must all land on it (on screen only; off screen the drawn box decides)
    const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
    if (cx - 22 >= 0 && cx + 22 <= W && cy - 22 >= 0 && cy + 22 <= H) {
      // dense neighbours (the /hold/ pins one floor apart, 38 px): two 44-px hit areas whose centres are closer than 44 px must share
      // their invisible margins (WCAG 2.5.8's spacing idea). A point that lands on a NEIGHBOUR's invisible hit area (outside that
      // neighbour's drawn box) still counts; a point on a neighbour's drawn box, or on anything that is not a control, does not.
      const sharedMargin = (h, x, y) => { const t = h.closest(INTER); if (!t || t === el) return false; const q = t.getBoundingClientRect(); return x < q.left || x > q.right || y < q.top || y > q.bottom; };
      let all = true; for (const dx of [-21, 0, 21]) for (const dy of [-21, 0, 21]) { const x = cx + dx, y = cy + dy; const h = document.elementFromPoint(x, y); if (!h || !(h === el || el.contains(h) || sharedMargin(h, x, y))) all = false; }
      if (all) continue;
    }
    const inlineText = el.tagName === 'A' && cs.display === 'inline' && el.parentElement && [...el.parentElement.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    (inlineText ? out.inline_links : out.targets).push({ el: label(el), w: Math.round(r.width), h: Math.round(r.height) });
  }
  // the main canvas/panorama: the largest visible canvas / panorama container covering ≥ 30% of the viewport
  const cands = [...document.querySelectorAll('canvas,.pnlm-container,#pano,[data-main-canvas]')].filter(visible).map((el) => ({ el, r: el.getBoundingClientRect() }))
    .map((c) => ({ ...c, a: Math.max(0, Math.min(c.r.right, W) - Math.max(c.r.left, 0)) * Math.max(0, Math.min(c.r.bottom, H) - Math.max(c.r.top, 0)) })).sort((a, b) => b.a - a.a);
  const main = cands[0] && cands[0].a >= 0.3 * W * H ? cands[0] : null;
  if (main) {
    out.canvas = { el: label(main.el), area: Math.round(main.a) };
    const mr = { l: Math.max(main.r.left, 0), r: Math.min(main.r.right, W), t: Math.max(main.r.top, 0), b: Math.min(main.r.bottom, H) };
    const seen = new Set();
    for (const el of document.querySelectorAll(INTER)) {
      if (!visible(el) || hiddenByAncestor(el)) continue;
      if (main.el.contains(el)) continue;   // a hotspot / ring drawn IN the panorama is part of it, not a control over it
      // the control's outermost positioned (fixed/absolute) box that is not the canvas or its container; a pass-through wrapper
      // (pointer-events: none) is not a cover — then the control's own box counts
      let box = null; for (let a = el; a && a !== document.body; a = a.parentElement) { if (a.contains(main.el)) break; const p = getComputedStyle(a).position; if ((p === 'fixed' || p === 'absolute') && getComputedStyle(a).pointerEvents !== 'none') box = a; }
      if (!box) { const p = getComputedStyle(el).position; box = el; if (p !== 'fixed' && p !== 'absolute' && !el.closest('[style*="position"]')) { let fixedAnc = null; for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const pp = getComputedStyle(a).position; if (pp === 'fixed' || pp === 'absolute') { fixedAnc = a; break; } } if (!fixedAnc) continue; } }
      if (seen.has(box)) continue; seen.add(box);
      if (getComputedStyle(el).pointerEvents === 'none') continue;
      const b = box.getBoundingClientRect(); const ix = Math.max(0, Math.min(b.right, mr.r) - Math.max(b.left, mr.l)), iy = Math.max(0, Math.min(b.bottom, mr.b) - Math.max(b.top, mr.t));
      const share = (ix * iy) / main.a; if (share > 0.15) out.covering.push({ el: label(box), share: Math.round(share * 100) });
    }
  }
  return out;
};

export async function gate(base, paths, outDir, { ignoreApi = false, settle = 3500 } = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME });
  const results = [];
  try {
    for (const p of paths) {
      const url = /^https?:/.test(p) ? p : base.replace(/\/$/, '') + (p.startsWith('/') ? p : `/${p}`);
      const slug = (p.replace(/^https?:\/\/[^/]+/, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'root').slice(0, 80);
      for (const sz of SIZES) {
        const ctx = await browser.newContext({ viewport: sz.viewport, isMobile: sz.isMobile, hasTouch: sz.hasTouch, deviceScaleFactor: sz.deviceScaleFactor, locale: 'he-IL' });
        // --header-env name=ENV (a protected Vercel preview: x-vercel-trusted-oidc-idp-token=VERCEL_OIDC_TOKEN under `vercel env run`):
        // the header is added ONLY to requests for the page's own host; the value is read from the environment by name, never printed
        const he = opt('--header-env'); if (he) { const [hn, ev] = he.split('='); const hv = process.env[ev]; const host = new URL(url).host;
          if (hv) await ctx.route((u) => u.host === host, (route) => route.continue({ headers: { ...route.request().headers(), [hn]: hv } })); }
        const page = await ctx.newPage(); const errors = [], httpErr = [];
        page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
        page.on('response', (r) => { const u = r.url(); if (r.status() >= 400 && !(ignoreApi && /\/api\//.test(u)) && !/favicon\.ico$/.test(u)) httpErr.push(`${r.status()} ${u.replace(/^https?:\/\/[^/]+/, '')}`.slice(0, 200)); });
        let nav = null; try { const r = await page.goto(url, { waitUntil: 'load', timeout: 90000 }); nav = r ? r.status() : null; } catch (e) { errors.push(`navigation: ${String(e.message).slice(0, 160)}`); }
        await page.waitForTimeout(settle);
        let m = null; try { m = await page.evaluate(MEASURE); } catch (e) { errors.push(`measure: ${String(e.message).slice(0, 160)}`); m = { overflow: [], targets: [], inline_links: [], covering: [], doc: {} }; }
        // 2026-11-08: an INTRO overlay the visitor dismisses (the tour's autoplay walkthrough of its buttons, on every open: [data-first-visit] with a
        // [data-first-visit-dismiss] button) is not chrome. Its own targets and overflow were measured above, with it open; then the gate
        // dismisses it as a visitor would and measures what STAYS on the panorama (the covering rule). An overlay without a dismiss button
        // is measured as it is.
        try {
          const fv = await page.evaluate(() => { const o = [...document.querySelectorAll('[data-first-visit]')].find((e) => !e.hidden && e.getBoundingClientRect().width > 0); const b = o && o.querySelector('[data-first-visit-dismiss]'); if (!b) return null; b.click(); return o.id || o.className; });
          if (fv) { await page.waitForTimeout(500); const m2 = await page.evaluate(MEASURE); m = { ...m, covering: m2.covering, first_visit_dismissed: fv }; }
        } catch (e) { errors.push(`first-visit overlay: ${String(e.message).slice(0, 160)}`); }
        const shot = path.join(outDir, `${slug}-${sz.name}.png`); await page.screenshot({ path: shot }).catch(() => {});
        const docOverflow = m.doc.scrollWidth > m.doc.clientWidth + 1;
        const fails = [...(nav && nav >= 400 ? [`HTTP ${nav}`] : []), ...errors.map((e) => `page error: ${e}`), ...httpErr.map((e) => `HTTP ${e}`),
          ...(docOverflow ? [`page scrolls sideways: scrollWidth ${m.doc.scrollWidth} > ${m.doc.clientWidth}`] : []),
          ...m.overflow.slice(0, 12).map((o) => `overflow ${o.el} ${o.left}..${o.right} (viewport 0..${sz.viewport.width})`),
          ...m.targets.slice(0, 20).map((t) => `target under 44 px: ${t.el} ${t.w}×${t.h}`),
          ...m.covering.map((c) => `covers ${c.share}% of the panorama: ${c.el}`)];
        results.push({ url: p, size: sz.name, pass: !fails.length, fails, counts: { overflow: m.overflow.length, targets: m.targets.length, covering: m.covering.length, errors: errors.length, http: httpErr.length }, inline_links: m.inline_links.slice(0, 10), canvas: m.canvas || null, screenshot: path.basename(shot) });
        console.log(`${!fails.length ? 'PASS' : 'FAIL'}  ${sz.name.padEnd(4)} ${p}${fails.length ? `  — ${fails.slice(0, 3).join(' | ')}${fails.length > 3 ? ` (+${fails.length - 3})` : ''}` : ''}`);
        await ctx.close();
      }
    }
  } finally { await browser.close(); }
  const verdict = { $schema: 'habait/responsive-gate.v1', at: new Date().toISOString(), rule: 'Eliran 2026-11-05: desktop AND mobile, in code', sizes: SIZES.map((s) => s.viewport), pass: results.every((r) => r.pass), pages: results };
  fs.writeFileSync(path.join(outDir, 'verdict.json'), JSON.stringify(verdict, null, 1));
  return verdict;
}

if (MAIN) {
  let server = null; let base = opt('--base');
  if (opt('--serve')) {
    const rw = opt('--rewrites') && fs.existsSync(opt('--rewrites')) ? JSON.parse(fs.readFileSync(opt('--rewrites'), 'utf8')).rewrites : null;
    server = serveStatic(path.resolve(opt('--serve')), rw); await new Promise((r) => server.listen(0, '127.0.0.1', r)); base = `http://127.0.0.1:${server.address().port}`;
  }
  if (!base && urls.some((u) => !/^https?:/.test(u))) { console.error('responsive-gate: a path needs --base or --serve'); process.exit(2); }
  const v = await gate(base, urls, OUT, { ignoreApi: IGNORE_API, settle: SETTLE });
  if (server) server.close();
  console.log(`responsive-gate: ${v.pass ? 'PASS' : 'FAIL'} · ${v.pages.filter((p) => !p.pass).length} of ${v.pages.length} page×size failed · ${path.join(OUT, 'verdict.json')}`);
  process.exit(v.pass ? 0 : 1);
}
export { serveStatic };
