/* Habait Tour360 — edit-live.js (T09/T10, board habait-tour360) — the live typed change, inside the tour page.
   Behind the unlock code (?key=…, D-T360-18): the visitor types what should change; this module cuts the current view out of
   the room's current look as a flat photo (gnomonic), sends it with the words to /api/edit (server/handler.mjs: the scope rule,
   one fal instruction editor, reserved and settled), then pastes back ONLY the changed region — aligned by a resize, colour-fitted
   on the untouched border, a difference mask cleaned of specks, feathered — onto the panorama, and hands the result to tour.js
   as a live change (undo, original, reset). Nothing leaves the browser except the flat view and the words; nothing is saved.
   T16c (CATALOG-PLAN.md §10.3, D-CAT-12…18): a catalog turn starts at a RING on a piece (tour.js draws them from the scan's markers):
   the pick bar shows the piece's name and only the matching items, one tap sends the turn, the crop is cut around the piece, the
   replace judge (not the size rule) accepts, and the paste-back stays inside the piece's region; the ring then sits on the product. */
(() => {
  'use strict';
  const state = window.__tour;
  if (!state) return;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  let code = params.get('key') || '';
  try { if (code) sessionStorage.setItem('tour360-edit-key', code); else code = sessionStorage.getItem('tour360-edit-key') || ''; } catch (_) { /* storage blocked: the URL alone */ }
  const openProbe = !code; // plan 2026-11-04-apt-furniture-swap D5: an open host (TOUR_EDIT_OPEN=1) unlocks the page without a code

  const input = $('t-bar-input');
  const apply = $('t-bar-apply');
  const form = $('t-change-bar');
  const CROP_W = 1264, CROP_H = 848;
  const MAX_SECONDS = 150;
  let hooks = null;
  let unlocked = false;
  /* T17a (TEST-PLAN.md §6): when the host records (its GET says `record: true` — the laptop host only, never the hosted function),
     the page posts its own account of every turn after the paste or the failure: the view before and after at the turn's own
     field, the same two at WIDE_HFOV (the seams), lastTurn, the message shown. Nothing about the turn itself changes. */
  let recording = false;
  const WIDE_HFOV = 100;
  async function postRecord(account, ctx) {
    try {
      const metas = (state.liveMeta && state.liveMeta[ctx.room]) || [];
      const body = {
        op: 'record', code, apartment: tourData.id, scene: ctx.room, ok: account.ok === true, view: ctx.view, wide_hfov: ctx.wide_hfov || WIDE_HFOV,
        item: ctx.item, marker: ctx.marker, turn: state.lastTurn || null, live: account.ok === true ? (metas[metas.length - 1] || null) : null,
        message: account.message || null, ms_total: ctx.ms, maxTexture: state.maxTexture ?? null,
        viewport: [window.innerWidth, window.innerHeight, window.devicePixelRatio || 1], ua: navigator.userAgent,
        before: account.before || null, after: account.after || null, before_wide: account.before_wide || null, after_wide: account.after_wide || null,
      };
      await fetch('api/edit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
    } catch (_) { /* the record is a test aid: a lost one changes nothing on the page */ }
  }

  /* ── the catalog (T14e → T16c, CATALOG-PLAN.md §10.3): the strip is hidden; a RING on each replaceable piece opens the pick bar —
     a chip naming the piece and only the matching items. One tap on an item sends the turn (the words are the filled template,
     never typed). Without a catalog in the build nothing here renders and the typed change is as before. ── */
  const tourData = JSON.parse($('tour-data').textContent);
  const catalog = Array.isArray(tourData.catalog) && tourData.catalog.length ? tourData.catalog : null;
  const refCache = new Map();
  state.item = null;
  state.pick = null;
  const itemOf = (id) => (catalog ? catalog.find((i) => i.id === id) || null : null);
  const locale = () => (hooks.lang() === 'he' ? 'he-IL' : hooks.lang() === 'fr' ? 'fr-FR' : 'en-GB');
  const priceText = (it) => { if (it.ai || !it.price) return hooks.ui('catalogAiItem') || 'הדמיה · AI-generated'; try { return new Intl.NumberFormat(locale(), { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(it.price.ils); } catch (_) { return '₪' + it.price.ils; } };
  const dateText = (iso) => { try { return new Intl.DateTimeFormat(locale()).format(new Date(iso + 'T00:00:00')); } catch (_) { return iso; } };
  const itemName = (it) => (hooks.lang() === 'he' && it.name_he ? it.name_he : it.name);
  const pickBox = $('t-pick'), pickChip = $('t-pick-chip'), pickStrip = $('t-catalog-bar'), hintEl = $('t-mk-hint');
  /** A ring tapped: the pick bar for that piece — the chip with its name, the strip with its category's items. */
  function openPick(detail) {
    if (!catalog || !hooks || state.applying) return;
    const st = hooks.markerState(detail.room, detail.id);
    if (!st) return;
    const items = catalog.filter((i) => i.category === st.category);
    if (!items.length) return;
    state.marker = detail.id;
    state.pick = { room: detail.room, id: detail.id };
    hooks.openMarker(detail.id);
    const current = st.item ? itemOf(st.item) : null;
    pickChip.textContent = hooks.ui('catalogChip').replace('{target}', current ? itemName(current) : hooks.targetWords(st.category));
    $('t-pick-close').setAttribute('aria-label', hooks.ui('close'));
    pickStrip.textContent = '';
    for (const it of items) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 't-catalog-item'; b.setAttribute('role', 'option'); b.dataset.item = it.id;
      b.setAttribute('aria-selected', String(Boolean(current) && current.id === it.id));
      b.title = itemName(it) + ' · ' + priceText(it) + (it.price && it.price.read_on ? ' · ' + hooks.ui('catalogPriceAsOf').replace('{date}', dateText(it.price.read_on)) : '');  // T16i: the tooltip's price carries its date too (T15a F10a)
      const img = document.createElement('img'); img.src = it.image; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
      const nm = document.createElement('span'); nm.textContent = itemName(it); nm.dir = /[\u0590-\u05FF]/.test(nm.textContent) ? 'rtl' : 'ltr';
      b.append(img, nm);
      b.addEventListener('click', () => pickItem(it.id));
      pickStrip.append(b);
    }
    pickBox.hidden = false;
    hideHint(true);
  }
  function closePick() {
    state.marker = null; state.pick = null;
    if (hooks) hooks.openMarker(null);
    pickBox.hidden = true;
  }
  /** An item tapped: the turn, with the marker's state as the piece. */
  function pickItem(id) {
    const it = itemOf(id);
    const pick = state.pick;
    if (!it || !pick || !hooks.canChange()) return;
    const st = hooks.markerState(pick.room, pick.id);
    if (!st || st.category !== it.category) return;
    const words = hooks.ui('catalogReplaceWith').replace('{target}', hooks.targetWords(st.category)).replace('{item}', it.name);
    runChange(words, { item: it, marker: st });
  }
  /** The one-time hint (D-CAT-17): once per browser, gone at the first ring tap or after six seconds; the page is right without storage. */
  let hintTimer = null;
  function showHint() {
    if (!catalog || !hooks) return;
    let seen = false;
    try { seen = localStorage.getItem('tour360-mk-hint') === '1'; } catch (_) { seen = false; }
    if (seen || !hooks.markers(hooks.room()).length) return;
    hintEl.textContent = hooks.ui('catalogHint');
    hintEl.hidden = false;
    hintTimer = window.setTimeout(() => hideHint(true), 6000);
  }
  function hideHint(remember) {
    if (hintTimer) { window.clearTimeout(hintTimer); hintTimer = null; }
    hintEl.hidden = true;
    if (remember) { try { localStorage.setItem('tour360-mk-hint', '1'); } catch (_) { /* storage blocked: the hint may show again */ } }
  }
  /** The product photo as the page serves it, as a data URL (the handler binds its bytes to the catalog by hash). */
  async function referenceFor(it) {
    if (refCache.has(it.id)) return refCache.get(it.id);
    const blob = await (await fetch(it.image, { cache: 'force-cache' })).blob();
    const url = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => no(new Error('reference failed')); r.readAsDataURL(blob); });
    refCache.set(it.id, url);
    return url;
  }
  /** The item card under the view: shown while the room's newest live change came from the catalog, cleared by undo or the original. */
  function renderItemCard() {
    const card = $('t-item-card');
    if (!catalog || !hooks) { card.hidden = true; return; }
    const ui = hooks.ui;
    const metas = (state.liveMeta && state.liveMeta[hooks.room()]) || [];
    const last = metas[metas.length - 1];
    const it = last && last.item ? itemOf(last.item) : null;
    if (!it || state.original) { card.hidden = true; return; }
    // T18f: a card the visitor closed stays closed for this change; the next change brings it back
    if (state.cardClosed && state.cardClosed.room === hooks.room() && state.cardClosed.n === metas.length) { card.hidden = true; return; }
    $('t-item-thumb').src = it.image;
    $('t-item-name').textContent = hooks.lang() === 'he' && it.name_he ? it.name_he : it.name;
    $('t-item-price').textContent = it.price ? priceText(it) + ' · ' + ui('catalogPriceAsOf').replace('{date}', dateText(it.price.read_on)) : priceText(it);
    $('t-item-note').textContent = it.ai ? (ui('catalogAiNote') || ui('catalogNote')) : ui('catalogNote');
    const a = $('t-item-link'); a.hidden = !it.url; if (it.url) { a.href = it.url; a.textContent = ui('catalogSee'); } else a.removeAttribute('href');
    const x = $('t-item-close'); if (x) x.setAttribute('aria-label', ui('close'));
    card.hidden = false;
  }

  const ready = () => new Promise((resolve) => {
    const tick = () => { if (state.hooks && state.hooks.viewer()) resolve(state.hooks); else window.setTimeout(tick, 120); };
    tick();
  });

  /* ── geometry (the same maths as tools/edit-pano.py: +z forward at yaw 0, +x right, +y up; u,v on the full equirect) ── */
  function basis(yawDeg, pitchDeg) {
    const y = (yawDeg * Math.PI) / 180, p = (pitchDeg * Math.PI) / 180;
    const f = [Math.cos(p) * Math.sin(y), Math.sin(p), Math.cos(p) * Math.cos(y)];
    const r = [Math.cos(y), 0, -Math.sin(y)];
    const u = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]];
    return { f, r, u };
  }
  const focal = (w, hfovDeg) => (w / 2) / Math.tan((hfovDeg * Math.PI) / 360);

  /** A w×h perspective view cut out of an equirect canvas (bilinear, wrap-aware). Returns ImageData. */
  function equiToPers(src, yaw, pitch, hfov, w, h) {
    const W = src.width, H = src.height;
    const S = src.getContext('2d').getImageData(0, 0, W, H).data;
    const out = new ImageData(w, h);
    const O = out.data;
    const fpx = focal(w, hfov);
    const { f, r, u } = basis(yaw, pitch);
    const twoPi = 2 * Math.PI;
    for (let y = 0; y < h; y++) {
      const b = -(y + 0.5 - h / 2) / fpx;
      for (let x = 0; x < w; x++) {
        const a = (x + 0.5 - w / 2) / fpx;
        let dx = f[0] + a * r[0] + b * u[0], dy = f[1] + a * r[1] + b * u[1], dz = f[2] + a * r[2] + b * u[2];
        const n = 1 / Math.hypot(dx, dy, dz);
        dx *= n; dy *= n; dz *= n;
        const lon = Math.atan2(dx, dz);
        const lat = Math.asin(Math.max(-1, Math.min(1, dy)));
        let sx = (lon / twoPi + 0.5) * W - 0.5;
        let sy = (0.5 - lat / Math.PI) * H - 0.5;
        sx = ((sx % W) + W) % W;
        sy = Math.max(0, Math.min(H - 1, sy));
        const x0 = Math.floor(sx), y0 = Math.floor(sy);
        const x1 = (x0 + 1) % W, y1 = Math.min(H - 1, y0 + 1);
        const tx = sx - x0, ty = sy - y0;
        const i00 = (y0 * W + x0) * 4, i10 = (y0 * W + x1) * 4, i01 = (y1 * W + x0) * 4, i11 = (y1 * W + x1) * 4;
        const o = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          O[o + c] = (S[i00 + c] * (1 - tx) + S[i10 + c] * tx) * (1 - ty) + (S[i01 + c] * (1 - tx) + S[i11 + c] * tx) * ty;
        }
        O[o + 3] = 255;
      }
    }
    return out;
  }

  /** Paste a perspective RGBA layer (premultiplied by its alpha already applied as blend) back onto the equirect canvas. */
  function persToEquiBlend(dst, layer, alpha, yaw, pitch, hfov) {
    const W = dst.width, H = dst.height, w = layer.width, h = layer.height;
    const g = dst.getContext('2d');
    const fpx = focal(w, hfov);
    const { f, r, u } = basis(yaw, pitch);
    // the equirect box the view covers: project the view's border
    let uMin = 1, uMax = 0, vMin = 1, vMax = 0;
    const edge = [];
    for (let t = 0; t <= 64; t++) { const s = t / 64; edge.push([s * w, 0], [s * w, h], [0, s * h], [w, s * h]); }
    for (const [x, y] of edge) {
      const a = (x - w / 2) / fpx, b = -(y - h / 2) / fpx;
      let dx = f[0] + a * r[0] + b * u[0], dy = f[1] + a * r[1] + b * u[1], dz = f[2] + a * r[2] + b * u[2];
      const n = 1 / Math.hypot(dx, dy, dz);
      dx *= n; dy *= n; dz *= n;
      const uu = Math.atan2(dx, dz) / (2 * Math.PI) + 0.5, vv = 0.5 - Math.asin(Math.max(-1, Math.min(1, dy))) / Math.PI;
      uMin = Math.min(uMin, uu); uMax = Math.max(uMax, uu); vMin = Math.min(vMin, vv); vMax = Math.max(vMax, vv);
    }
    const wrap = uMax - uMin > 0.5; // the view crosses u = 0/1: walk the whole width
    const x0 = wrap ? 0 : Math.max(0, Math.floor(uMin * W) - 2), x1 = wrap ? W : Math.min(W, Math.ceil(uMax * W) + 2);
    const y0 = Math.max(0, Math.floor(vMin * H) - 2), y1 = Math.min(H, Math.ceil(vMax * H) + 2);
    const bw = x1 - x0, bh = y1 - y0;
    if (bw <= 0 || bh <= 0) return 0;
    const region = g.getImageData(x0, y0, bw, bh);
    const D = region.data, L = layer.data;
    let touched = 0;
    for (let yy = 0; yy < bh; yy++) {
      const v = (y0 + yy + 0.5) / H;
      const lat = (0.5 - v) * Math.PI;
      const cl = Math.cos(lat), sl = Math.sin(lat);
      for (let xx = 0; xx < bw; xx++) {
        const uu = (x0 + xx + 0.5) / W;
        const lon = (uu - 0.5) * 2 * Math.PI;
        const dx = cl * Math.sin(lon), dy = sl, dz = cl * Math.cos(lon);
        const zc = dx * f[0] + dy * f[1] + dz * f[2];
        if (zc <= 1e-6) continue;
        const xc = dx * r[0] + dy * r[1] + dz * r[2];
        const yc = dx * u[0] + dy * u[1] + dz * u[2];
        const px = (fpx * xc) / zc + w / 2 - 0.5;
        const py = (-fpx * yc) / zc + h / 2 - 0.5;
        if (px < 0 || py < 0 || px > w - 1 || py > h - 1) continue;
        const ix0 = Math.floor(px), iy0 = Math.floor(py), ix1 = Math.min(w - 1, ix0 + 1), iy1 = Math.min(h - 1, iy0 + 1);
        const tx = px - ix0, ty = py - iy0;
        const a00 = alpha[iy0 * w + ix0], a10 = alpha[iy0 * w + ix1], a01 = alpha[iy1 * w + ix0], a11 = alpha[iy1 * w + ix1];
        const al = ((a00 * (1 - tx) + a10 * tx) * (1 - ty) + (a01 * (1 - tx) + a11 * tx) * ty) / 255;
        if (al <= 0.003) continue;
        const o = (yy * bw + xx) * 4;
        const i00 = (iy0 * w + ix0) * 4, i10 = (iy0 * w + ix1) * 4, i01 = (iy1 * w + ix0) * 4, i11 = (iy1 * w + ix1) * 4;
        for (let c = 0; c < 3; c++) {
          const s = (L[i00 + c] * (1 - tx) + L[i10 + c] * tx) * (1 - ty) + (L[i01 + c] * (1 - tx) + L[i11 + c] * tx) * ty;
          D[o + c] = D[o + c] + (s - D[o + c]) * al;
        }
        touched++;
      }
    }
    g.putImageData(region, x0, y0);
    return touched;
  }

  /* ── the changed region: resize-align, colour fit on the border, difference, clean, feather ── */
  function imageToData(img, w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, w, h);
    return g.getImageData(0, 0, w, h);
  }
  function colourFit(A, B, w, h, ring) {
    const a = A.data, b = B.data;
    for (let c = 0; c < 3; c++) {
      let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
      for (let y = 0; y < h; y += 3) for (let x = 0; x < w; x += 3) {
        if (x >= ring && x < w - ring && y >= ring && y < h - ring) continue;
        const i = (y * w + x) * 4;
        const xv = a[i + c], yv = b[i + c];
        n++; sx += xv; sy += yv; sxx += xv * xv; sxy += xv * yv;
      }
      const den = n * sxx - sx * sx;
      let gain = den ? (n * sxy - sx * sy) / den : 1, off = n ? (sy - gain * sx) / n : 0;
      gain = Math.max(0.85, Math.min(1.15, gain)); off = Math.max(-24, Math.min(24, off));
      for (let i = c; i < a.length; i += 4) a[i] = Math.max(0, Math.min(255, a[i] * gain + off));
    }
  }
  /** Did the editor hold the frame? The share of the border ring (half-res) that differs from the crop. Measured on this
      apartment's stored results: 0–5.5 % when the frame held, 16–30 % when the editor re-framed (zoomed or re-composed). */
  function ringShare(A, B, w, h, ring, thr, exclude, mode) {
    // T18b (F2, OQ-C14): `exclude` = a box on 0-1000 (the piece's neighbourhood) whose pixels are not counted; `mode` 'top' = the top
    // band only. Returns { share, n (pixels counted), total (pixels of the ring or band before the exclusion) }.
    const hw = w >> 1, hh = h >> 1, r = ring >> 1;
    const ex = exclude ? [(exclude[0] / 1000) * hh, (exclude[1] / 1000) * hw, (exclude[2] / 1000) * hh, (exclude[3] / 1000) * hw] : null;
    const down = (src) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').putImageData(src, 0, 0);
      const d = document.createElement('canvas'); d.width = hw; d.height = hh;
      const g = d.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, hw, hh);
      return g.getImageData(0, 0, hw, hh).data;
    };
    const a = down(A), b = down(B);
    let n = 0, changed = 0, total = 0;
    for (let y = 0; y < hh; y++) for (let x = 0; x < hw; x++) {
      if (mode === 'top' ? y >= r : (x >= r && x < hw - r && y >= r && y < hh - r)) continue;
      total++;
      if (ex && y >= ex[0] && y < ex[2] && x >= ex[1] && x < ex[3]) continue;
      const i = (y * hw + x) * 4;
      n++;
      if (Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])) > thr) changed++;
    }
    return { share: n ? changed / n : 0, n, total };
  }
  /** A half-resolution binary mask of what changed, cleaned: close (bridge gaps), open (drop lines), drop small blobs, pad. */
  function changedMask(A, B, w, h, opts) {
    const hw = w >> 1, hh = h >> 1;
    const down = (src) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').putImageData(src, 0, 0);
      const d = document.createElement('canvas'); d.width = hw; d.height = hh;
      const g = d.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, hw, hh);
      return g.getImageData(0, 0, hw, hh).data;
    };
    const a = down(A), b = down(B);
    let m = new Uint8Array(hw * hh);
    const border = 6, L = opts.lift || {};
    for (let y = 0; y < hh; y++) for (let x = 0; x < hw; x++) {
      const i = (y * hw + x) * 4;
      const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
      if (d > opts.thr) m[y * hw + x] = 1;
    }
    const dil = (src, r) => { // square dilation, separable
      const t = new Uint8Array(src.length), o = new Uint8Array(src.length);
      for (let y = 0; y < hh; y++) for (let x = 0; x < hw; x++) { let v = 0; for (let k = -r; k <= r && !v; k++) { const xx = x + k; if (xx >= 0 && xx < hw && src[y * hw + xx]) v = 1; } t[y * hw + x] = v; }
      for (let y = 0; y < hh; y++) for (let x = 0; x < hw; x++) { let v = 0; for (let k = -r; k <= r && !v; k++) { const yy = y + k; if (yy >= 0 && yy < hh && t[yy * hw + x]) v = 1; } o[y * hw + x] = v; }
      return o;
    };
    const ero = (src, r) => { const inv = src.map((v) => 1 - v); return dil(inv, r).map((v) => 1 - v); };
    m = ero(dil(m, opts.close), opts.close);  // close
    m = dil(ero(m, 2), 2);                    // open
    // drop blobs under the area floor
    const seen = new Uint8Array(m.length), stack = [];
    for (let s = 0; s < m.length; s++) {
      if (!m[s] || seen[s]) continue;
      const comp = []; stack.push(s); seen[s] = 1;
      while (stack.length) {
        const p = stack.pop(); comp.push(p);
        const px = p % hw, py = (p - px) / hw;
        const nb = [p - 1, p + 1, p - hw, p + hw];
        if (px === 0) nb[0] = -1; if (px === hw - 1) nb[1] = -1; if (py === 0) nb[2] = -1; if (py === hh - 1) nb[3] = -1;
        for (const q of nb) if (q >= 0 && q < m.length && m[q] && !seen[q]) { seen[q] = 1; stack.push(q); }
      }
      if (comp.length < opts.minArea) for (const p of comp) m[p] = 0;
    }
    m = dil(m, opts.pad);
    for (let y = 0; y < hh; y++) for (let x = 0; x < hw; x++) if ((x < border && !L.left) || (y < border && !L.top) || (x >= hw - border && !L.right) || (y >= hh - border && !L.bottom)) m[y * hw + x] = 0;
    return { m, hw, hh };
  }
  /** The half-res mask upsampled and feathered into a full-res alpha (0..255). */
  function featherAlpha(mask, w, h, blurPx, lift) {
    const { m, hw, hh } = mask;
    const small = document.createElement('canvas'); small.width = hw; small.height = hh;
    const sd = small.getContext('2d').createImageData(hw, hh);
    for (let i = 0; i < m.length; i++) { const v = m[i] ? 255 : 0; sd.data[i * 4] = v; sd.data[i * 4 + 1] = v; sd.data[i * 4 + 2] = v; sd.data[i * 4 + 3] = 255; }
    small.getContext('2d').putImageData(sd, 0, 0);
    const big = document.createElement('canvas'); big.width = w; big.height = h;
    const g = big.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    try { g.filter = 'blur(' + blurPx + 'px)'; } catch (_) { /* no canvas filters: a hard edge */ }
    g.imageSmoothingEnabled = true;
    g.drawImage(small, 0, 0, w, h);
    g.filter = 'none';
    const d = g.getImageData(0, 0, w, h).data;
    const alpha = new Uint8ClampedArray(w * h);
    let area = 0;
    for (let i = 0; i < alpha.length; i++) { alpha[i] = d[i * 4]; if (alpha[i] > 127) area++; }
    const lim = 10, L = lift || {}; // never let the paste touch the crop border — but for the sides a piece runs past (T18a)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x < lim && !L.top && !L.left) || (y < lim && !L.top) || (x >= w - lim && !L.right) || (y >= h - lim && !L.bottom)) alpha[y * w + x] = 0;
    // a lifted side is pasted at full strength to the very edge: the blur fades toward the border (outside reads as nothing), so the
    // value a few px in is carried out to the edge — the reviewer measured 14 % at x = 0 against 80 % at x = 10
    const carry = 8;
    if (L.left) for (let y = 0; y < h; y++) for (let x = 0; x < carry; x++) alpha[y * w + x] = Math.max(alpha[y * w + x], alpha[y * w + carry]);
    if (L.right) for (let y = 0; y < h; y++) for (let x = w - carry; x < w; x++) alpha[y * w + x] = Math.max(alpha[y * w + x], alpha[y * w + (w - carry - 1)]);
    if (L.top) for (let x = 0; x < w; x++) for (let y = 0; y < carry; y++) alpha[y * w + x] = Math.max(alpha[y * w + x], alpha[carry * w + x]);
    if (L.bottom) for (let x = 0; x < w; x++) for (let y = h - carry; y < h; y++) alpha[y * w + x] = Math.max(alpha[y * w + x], alpha[(h - carry - 1) * w + x]);
    return { alpha, fraction: area / alpha.length };
  }

  const loadImg = (src) => new Promise((resolve, reject) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = () => reject(new Error('result image failed')); im.src = src; });
  const toJpeg = (imageData) => { const c = document.createElement('canvas'); c.width = imageData.width; c.height = imageData.height; c.getContext('2d').putImageData(imageData, 0, 0); return c.toDataURL('image/jpeg', 0.92); };

  /* ── the sphere ↔ the crop (tools/pano-geometry.mjs' pair): a direction from a crop pixel, a crop pixel from a direction ──── */
  function dirOfPixel(x, y, view, w, h) {
    const fpx = focal(w, view.hfov);
    const { f, r, u } = basis(view.yaw, view.pitch);
    const a = (x - w / 2) / fpx, b = -(y - h / 2) / fpx;
    const d = [f[0] + a * r[0] + b * u[0], f[1] + a * r[1] + b * u[1], f[2] + a * r[2] + b * u[2]];
    const n = 1 / Math.hypot(d[0], d[1], d[2]);
    return [d[0] * n, d[1] * n, d[2] * n];
  }
  function pixelOfDir(d, view, w, h) {
    const fpx = focal(w, view.hfov);
    const { f, r, u } = basis(view.yaw, view.pitch);
    const zc = d[0] * f[0] + d[1] * f[1] + d[2] * f[2];
    if (zc <= 1e-6) return null;
    return { x: (fpx * (d[0] * r[0] + d[1] * r[1] + d[2] * r[2])) / zc + w / 2, y: (-fpx * (d[0] * u[0] + d[1] * u[1] + d[2] * u[2])) / zc + h / 2 };
  }
  const dirOf = (yaw, pitch) => basis(yaw, pitch).f;
  const yawOf = (d) => (Math.atan2(d[0], d[2]) * 180) / Math.PI;
  const pitchOf = (d) => (Math.asin(Math.max(-1, Math.min(1, d[1]))) * 180) / Math.PI;
  const norm = (deg) => ((deg + 540) % 360) - 180;
  /** The view that frames a marker (T16c): centred on its outline, hfov from the spans × 2.2 (× 1.5 for a set), floor 45°, ceiling 90°. */
  // T16f (D-CAT-20, OQ-C11): the judge's product box may not widen the paste beyond the piece's neighbourhood — the old box grown by
  // BOX_GROW of its span on each side (the host's REPLACE_JUDGE_RULE.grow; kept here too, so an older host cannot widen the paste)
  const BOX_GROW = 0.25;
  function neighbourhood(box) {
    const gy = (box[2] - box[0]) * BOX_GROW, gx = (box[3] - box[1]) * BOX_GROW;
    return [Math.max(0, box[0] - gy), Math.max(0, box[1] - gx), Math.min(1000, box[2] + gy), Math.min(1000, box[3] + gx)];
  }
  function clipBox(pb, hood) {
    const c = [Math.max(pb[0], hood[0]), Math.max(pb[1], hood[1]), Math.min(pb[2], hood[2]), Math.min(pb[3], hood[3])];
    return c[2] > c[0] && c[3] > c[1] ? c.map((n) => Math.round(n)) : null;
  }
  function frameMarker(st) {
    const dirs = st.outlines.flat().map(([y, p]) => dirOf(y, p));
    const mean = dirs.reduce((m, d) => [m[0] + d[0], m[1] + d[1], m[2] + d[2]], [0, 0, 0]);
    const n = 1 / Math.hypot(mean[0], mean[1], mean[2]);
    const c = [mean[0] * n, mean[1] * n, mean[2] * n];
    const cy = yawOf(c), cp = pitchOf(c);
    let y0 = 0, y1 = 0, p0 = 0, p1 = 0;
    for (const d of dirs) { const dy = norm(yawOf(d) - cy), dp = pitchOf(d) - cp; y0 = Math.min(y0, dy); y1 = Math.max(y1, dy); p0 = Math.min(p0, dp); p1 = Math.max(p1, dp); }
    const factor = st.count > 1 ? 1.5 : 2.2;
    const span = y1 - y0;
    // T18a: a piece over 85° gets a 110° crop (a 90° one cut the sofa's chaise and the chair set's ends); a piece whose scan box ran
    // past its view's side (`cut_sides`, the scan's record) continues beyond its outline there — the crop reaches further on that
    // side: a 120° ceiling and the centre shifted 6° toward it (5° up or down for the top and the bottom). The reviewer's sliver.
    const cut = Array.isArray(st.cut_sides) ? st.cut_sides : [];
    const sideCut = cut.includes('left') || cut.includes('right');
    const ceiling = span > 85 ? (sideCut ? 120 : 110) : 90;
    const hfov = Math.max(45, Math.min(ceiling, Math.max(span * factor, (p1 - p0) * factor * (CROP_W / CROP_H), 10)));
    const shiftYaw = (cut.includes('left') ? -6 : 0) + (cut.includes('right') ? 6 : 0), shiftPitch = (cut.includes('bottom') ? -5 : 0) + (cut.includes('top') ? 5 : 0);
    return { yaw: norm(cy + shiftYaw), pitch: Math.max(-55, Math.min(55, cp + shiftPitch)), hfov, span: Number(span.toFixed(1)), cut };
  }
  /** Polygons in crop pixels filled into a half-res mask, then dilated by pad half-res px: the piece's region for the paste. */
  function polyMask(polys, w, h, pad) {
    const hw = w >> 1, hh = h >> 1;
    let m = new Uint8Array(hw * hh);
    for (const poly of polys) {
      const pts = poly.map(([x, y]) => [x / 2, y / 2]);
      for (let yy = 0; yy < hh; yy++) {
        const yc = yy + 0.5, xs = [];
        for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; if ((y1 <= yc && y2 > yc) || (y2 <= yc && y1 > yc)) xs.push(x1 + ((yc - y1) * (x2 - x1)) / (y2 - y1)); }
        xs.sort((a, b) => a - b);
        for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.ceil(xs[k])); x < Math.min(hw, xs[k + 1]); x++) m[yy * hw + x] = 1;
      }
    }
    if (pad > 0) {
      const t = new Uint8Array(m.length), o = new Uint8Array(m.length);
      for (let y = 0; y < hh; y++) for (let x = 0; x < hw; x++) { let v = 0; for (let k = -pad; k <= pad && !v; k++) { const xx = x + k; if (xx >= 0 && xx < hw && m[y * hw + xx]) v = 1; } t[y * hw + x] = v; }
      for (let y = 0; y < hh; y++) for (let x = 0; x < hw; x++) { let v = 0; for (let k = -pad; k <= pad && !v; k++) { const yy = y + k; if (yy >= 0 && yy < hh && t[yy * hw + x]) v = 1; } o[y * hw + x] = v; }
      m = o;
    }
    let area = 0; for (let i = 0; i < m.length; i++) area += m[i];
    return { m, hw, hh, fraction: area / m.length };
  }
  const boxPoly = (b, w, h) => [[(b[1] / 1000) * w, (b[0] / 1000) * h], [(b[3] / 1000) * w, (b[0] / 1000) * h], [(b[3] / 1000) * w, (b[2] / 1000) * h], [(b[1] / 1000) * w, (b[2] / 1000) * h]];
  // T18a: the piece as the host read it on this crop — accepted when it is a box over the scan's box (at least 30 % of the scan's
  // box inside it, at most four times its area), else the scan's box stands alone
  const boxArea = (b) => Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
  const unionBox = (a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
  function acceptSeen(ps, scanBox) {
    if (!ps || ps.found !== true || !Array.isArray(ps.box) || ps.box.length !== 4 || !ps.box.every(Number.isFinite)) return null;
    const b = ps.box.map((n) => Math.round(Math.max(0, Math.min(1000, n))));
    const inter = Math.max(0, Math.min(b[2], scanBox[2]) - Math.max(b[0], scanBox[0])) * Math.max(0, Math.min(b[3], scanBox[3]) - Math.max(b[1], scanBox[1]));
    if (boxArea(b) < 5000 || inter < 0.3 * boxArea(scanBox) || boxArea(b) > 4 * boxArea(scanBox) + 40000) return null;
    return { box: b, outline: Array.isArray(ps.outline) && ps.outline.length >= 3 ? ps.outline : null, touches_edge: Array.isArray(ps.touches_edge) ? ps.touches_edge : [] };
  }
  const PAD_BELOW = 60; // 0-1000 units of the crop's height under the piece's box: its legs' ends and the shadow on the floor (T18a)
  // plan 2026-11-04-apt-furniture-swap (P4, the eye's finding): what STOOD ON a table (a vase, a plant, books) rises above the table's
  // box; the editor clears it with the table, but a region cut at the box left its top in the panorama (a plant floating by the
  // window). For tables the region grows upward by this share of the box's height (at most PAD_ABOVE_MAX); only changed pixels paste.
  const PAD_ABOVE = { coffee_table: 1.2, dining_table: 0.9, shelf: 0.5 };
  const PAD_ABOVE_MAX = 320;

  /* ── the turn ─────────────────────────────────────────────────────────────────── */
  async function runChange(text, pick, opts = {}) {
    // T18d: `opts.room` names a room that is NOT on screen — the follow-up of a swap for the same piece seen from there; the view
    // stays, the pick bar stays, the result goes onto that room's stack quietly; `opts.linked_to` names the swap it follows
    const ui = hooks.ui;
    const viewer = hooks.viewer();
    const room = opts.room || hooks.room();
    if (!opts.room && !hooks.canChange()) return { ok: false, key: 'busy' };
    // a typed change takes the view on screen; a tapped piece (T16c) gets a crop zoomed onto it, and the screen turns to it meanwhile
    const marker = pick ? pick.marker : null;
    const view = marker ? frameMarker(marker) : { yaw: viewer.getYaw(), pitch: Math.max(-55, Math.min(55, viewer.getPitch())), hfov: Math.max(60, Math.min(100, viewer.getHfov() * 1.1)) };
    const { yaw, pitch, hfov } = view;
    const wideHfov = Math.min(135, Math.max(WIDE_HFOV, hfov + 12)); // the record's wide view stays wider than the crop, the 120° ceiling included
    const t0 = Date.now();
    let timer = null;
    input.disabled = true; apply.disabled = true;
    hooks.busy(true, opts.room ? ui('changeAlsoIn').replace('{room}', hooks.roomName(opts.room)) : ui('changeApplyingLive'));
    hooks.closeSheet();
    if (marker && !opts.room) { pickBox.hidden = true; try { viewer.lookAt(pitch, yaw, viewer.getHfov(), hooks.reduced() ? false : 700); } catch (_) { /* the view stays */ } }
    let account = recording ? {} : null; // T17a: the page's account of this turn, posted in `finally` when the host records
    let canvas = null;
    try {
      canvas = await hooks.currentCanvas(room);
      const crop = equiToPers(canvas, yaw, pitch, hfov, CROP_W, CROP_H);
      const cropJpeg = toJpeg(crop);
      if (account) account.before = cropJpeg; // T18j (F13): the wide "before" is cut after the answer, off the visitor's wait
      const apartment = tourData.id;
      // a catalog turn (T14e): the picked item and its photo ride with the words; the handler binds the photo to its catalog by hash
      const item = pick ? pick.item : null;
      const reference = item ? await referenceFor(item) : null;
      // the tapped piece in crop coordinates (T16c): its outlines projected into the crop, their box on 0-1000 for the handler
      let piece = null, oldPolys = null;
      let seen = null, fullBox = null, lift = null; // T18a: the piece as read on this crop, the fuller box, the crop sides it runs past
      if (marker) {
        oldPolys = marker.outlines.map((poly) => poly.map(([y, p]) => pixelOfDir(dirOf(y, p), view, CROP_W, CROP_H)).filter(Boolean).map((q) => [Math.max(0, Math.min(CROP_W, q.x)), Math.max(0, Math.min(CROP_H, q.y))])).filter((poly) => poly.length >= 3);
        const pts = oldPolys.flat();
        if (pts.length < 3) throw Object.assign(new Error('marker off view'), { uiKey: 'changeFailed', soft: true });
        const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
        const box = [Math.min(...ys) / CROP_H, Math.min(...xs) / CROP_W, Math.max(...ys) / CROP_H, Math.max(...xs) / CROP_W].map((v) => Math.round(Math.max(0, Math.min(1, v)) * 1000));
        piece = { id: marker.id, category: marker.category, box, count: marker.count || 1 };
        fullBox = box.slice();
      }
      // One turn, a few attempts. A result is pasted only on evidence that the editor kept the composition:
      //  · anything but a living change: the border ring of the result matches the view (a re-framed photo moves it);
      //  · a living change by the people editor that leaves the ring alone and touches a small share of the view: that editor
      //    keeps untouched pixels exact, so the furniture cannot have been redrawn larger;
      //  · every other living result: the furniture judge (the same piece boxed in both views, compared in code);
      //  · a catalog turn by marker (T16c): the ring, then the replace judge — the old piece gone, the product in its place.
      // A refused result is never pasted; the next attempt is the handler's choice of editor. A surface change is not tested.
      const RING_SOFT = 0.15, RING_HARD = 0.30;  // held results measured 0–12 % of the ring, re-framed ones 16–59 %
      const JUDGE_OVER = 0.22;                   // people in place changed 12–14 % of the view; redrawn larger, 40–64 %
      const judgeFrame = async (resultJpeg) => {
        try {
          const jr = await fetch('api/edit', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ op: 'judge', code, apartment, scene: room, crop: cropJpeg, result: resultJpeg }),
            signal: AbortSignal.timeout(60000),
          });
          const j = await jr.json();
          return j && j.ok ? { held: j.held === true, iou: j.iou, ratio: j.ratio, object: j.object } : { held: false, error: (j && j.reason) || 'error' };
        } catch (_) { return { held: false, error: 'network' }; } // cannot tell: treat as not held, the other editor takes it
      };
      const replaceJudgeCall = async (resultJpeg) => {
        try {
          const jr = await fetch('api/edit', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ op: 'replace_judge', code, apartment, scene: room, item: item.id, crop: cropJpeg, result: resultJpeg, box: fullBox, count: piece.count }),
            signal: AbortSignal.timeout(60000),
          });
          const j = await jr.json();
          return j && j.ok ? { held: j.held === true, original_present: j.original_present, product_present: j.product_present, product_box: Array.isArray(j.product_box) ? clipBox(j.product_box, neighbourhood(fullBox)) : null, product_box_raw: j.product_box_raw ?? j.product_box ?? null, box_kept: j.box_kept ?? null, placed: j.placed, count: j.count, rest_unchanged: j.rest_unchanged, note: j.note } : { held: false, error: (j && j.reason) || 'error' };
        } catch (_) { return { held: false, error: 'network' }; }
      };
      // the likeness score of a catalog result (D-CAT-5): measured for the record, never a gate
      const likenessCall = async (resultJpeg) => {
        try {
          const lr = await fetch('api/edit', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ op: 'likeness', code, apartment, scene: room, item: item.id, reference, result: resultJpeg }),
            signal: AbortSignal.timeout(60000),
          });
          const l = await lr.json();
          return l && l.ok ? { score: l.score, found: l.found, why: l.why } : { error: (l && l.reason) || 'error' };
        } catch (_) { return { error: 'network' }; }
      };
      let out = null, A = null, ring = 0, attempt = 1, alpha = null, fraction = 0, judged = null;
      if (!opts.room) state.lastTurn = { text, attempts: [], error: null, ...(piece ? { piece, view: { yaw: Number(yaw.toFixed(2)), pitch: Number(pitch.toFixed(2)), hfov: Number(hfov.toFixed(1)) } } : {}) };
      else { state.lastTurn.followUps = state.lastTurn.followUps || []; state.lastTurn.followUps.push({ room, id: marker ? marker.id : null, attempts: [], view: { yaw: Number(yaw.toFixed(2)), pitch: Number(pitch.toFixed(2)), hfov: Number(hfov.toFixed(1)) } }); }
      for (;;) {
        // plan 2026-11-04-apt-furniture-swap: on habait-flow a cold function answered 502 within a second (no vendor call ran);
        // a gateway error that fast is retried twice, 1.5 s apart, before it counts as a failure
        const send = () => fetch('api/edit', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, apartment, scene: room, instruction: text, lang: hooks.lang(), crop: cropJpeg, view: { yaw, pitch, hfov }, attempt, ...(item ? { item: item.id, reference } : {}), ...(piece ? { piece } : {}) }),
          signal: AbortSignal.timeout(MAX_SECONDS * 1000),
        });
        let res = null;
        for (let tries = 0; ; tries++) {
          const t0 = Date.now();
          res = await send();
          if (!([502, 503, 504].includes(res.status) && Date.now() - t0 < 10000 && tries < 2)) break;
          await new Promise((r) => window.setTimeout(r, 1500));
        }
        out = await res.json().catch(() => ({ ok: false, reason: 'error' }));
        if (!out.ok) {
          // structure and view are the two reaches the scope can refuse (D-T360-24); a named real person has its own message (D-T360-26);
          // unsafe is the content rule; the rest are the host's
          const key = ['structure', 'view'].includes(out.reason) ? 'changeRefusedScope' : out.reason === 'real_person' ? 'changeRefusedRealPerson' : out.reason === 'unsafe' ? 'changeRefusedUnsafe'
            : out.reason === 'catalog' ? 'changeRefusedCatalog' : out.reason === 'unclear' ? 'changeRefusedUnclear' : out.reason === 'cap' ? 'changeCapReached' : out.reason === 'code' ? 'changeLocked' : 'changeFailed';
          throw Object.assign(new Error(out.reason || 'error'), { uiKey: key, soft: true });
        }
        // T16f (OQ-C12): an item turn the host did not take as a catalog turn (no `catalog: true` echo) is a failure, never a plain paste
        if (item && out.catalog !== true) throw Object.assign(new Error('catalog echo missing'), { uiKey: 'changeFailed', soft: true });
        if (out.slow) hooks.busy(true, ui('changeApplyingSlow'));
        if (piece && attempt === 1) {
          // T18a: the host read the piece on this crop; a box over the scan's box widens the region and the judge's neighbourhood
          const ps = acceptSeen(out.piece_seen, piece.box);
          if (ps) { seen = ps; fullBox = unionBox(piece.box, ps.box); }
          piece.seen = out.piece_seen && typeof out.piece_seen === 'object' ? out.piece_seen : null; // attempt 2 carries it; the record keeps it
          const edges = new Set(seen ? seen.touches_edge : []);
          if (fullBox[1] <= 12) edges.add('left'); if (fullBox[3] >= 988) edges.add('right'); if (fullBox[0] <= 12) edges.add('top'); if (fullBox[2] >= 988) edges.add('bottom');
          lift = { left: edges.has('left'), right: edges.has('right'), top: edges.has('top'), bottom: edges.has('bottom') };
          Object.assign(opts.room ? state.lastTurn.followUps[state.lastTurn.followUps.length - 1] : state.lastTurn, { piece_seen: piece.seen, seen_accepted: !!seen, full_box: fullBox, lift: [...edges] });
        }
        if (account && !account.before_wide) account.before_wide = toJpeg(equiToPers(canvas, yaw, pitch, wideHfov, CROP_W, CROP_H)); // the canvas is untouched until the paste
        hooks.busy(true, (opts.room ? ui('changeAlsoIn').replace('{room}', hooks.roomName(opts.room)) + ' · ' : '') + ui('changeStepChecking') + (attempt > 1 ? ' · ' + ui('changeAttemptOf').replace('{n}', String(attempt)).replace('{m}', String(out.living === true ? 3 : 2)) : '')); // T18j: the step
        const img = await loadImg(out.image);
        A = imageToData(img, CROP_W, CROP_H);
        // the colour fit matches the result to the crop on the untouched border ring; a surface change (a wall, the floor, the light)
        // legitimately changes that ring, so fitting would pull the new colour back toward the old one — skip it for that reach
        if (out.reach !== 'surface') colourFit(A, crop, CROP_W, CROP_H, 40);
        const tested = out.reach === 'object' || out.reach === 'view';
        // T18b (F2, OQ-C14): for a tapped piece the ring is measured outside the piece's neighbourhood; when the piece fills the ring,
        // the top band; when nothing of the ring lies outside the piece, the ring is skipped and the replace judge alone decides
        let rs = tested ? ringShare(A, crop, CROP_W, CROP_H, 40, 22, piece ? neighbourhood(fullBox) : null) : { share: 0, n: 1, total: 1 };
        let ringBand = piece ? 'outside' : 'ring';
        if (tested && piece && rs.n < rs.total * 0.15) { rs = ringShare(A, crop, CROP_W, CROP_H, 40, 22, neighbourhood(fullBox), 'top'); ringBand = 'top'; }
        if (tested && piece && rs.n < rs.total * 0.05) { rs = { share: 0, n: 0, total: rs.total }; ringBand = 'skipped'; }
        ring = rs.share;
        const mask = changedMask(A, crop, CROP_W, CROP_H, { thr: 22, close: 8, minArea: 100, pad: 5, lift });
        ({ alpha, fraction } = featherAlpha(mask, CROP_W, CROP_H, 6, lift));
        judged = null;
        let held = true;
        if (item && piece) {
          // a catalog turn by marker (T16c): the ring, then the replace judge — the product decides its own size; the branch is the
          // page's own item and piece, never the host's echo (T16f, OQ-C12)
          held = ring < RING_SOFT;
          if (held) { judged = await replaceJudgeCall(toJpeg(A)); held = judged.held; }
        } else if (item) {
          // a catalog turn without a marker (T14e): the ring, then the furniture judge every time
          held = ring < RING_SOFT;
          if (held) { judged = await judgeFrame(toJpeg(A)); held = judged.held; }
        } else if (tested && out.living === true && out.reach === 'object') {
          if (ring >= RING_HARD) held = false;
          else if (out.modelKey === 'nb2' && ring < RING_SOFT && fraction <= JUDGE_OVER) held = true;
          else { judged = await judgeFrame(toJpeg(A)); held = judged.held; }
        } else if (tested) {
          held = ring < (out.reach === 'view' ? 0.35 : RING_SOFT);
        }
        (opts.room ? state.lastTurn.followUps[state.lastTurn.followUps.length - 1].attempts : state.lastTurn.attempts).push({ attempt, model: out.model, reach: out.reach, living: out.living === true, ring: Number(ring.toFixed(3)), ring_band: ringBand, ring_n: rs.n, ring_total: rs.total, fraction: Number(fraction.toFixed(3)), judge: judged, held });
        if (held) break;
        if (attempt >= (out.living === true ? 3 : 2)) {
          // T18l (F15, the judge's J-14): a catalog turn names what refused it — the ring, or the replace judge's own finding — and reads
          // its own line (`catalogRefused`, his words; the plain `changeFailed` until they land), never the typed change's «different angle»
          const reason = judged && judged.held === false ? (judged.original_present ? 'judge:original_present' : judged.placed === false ? 'judge:not_placed' : judged.product_present === false ? 'judge:no_product' : 'judge') : 'ring';
          throw Object.assign(new Error('refused: ' + reason), { uiKey: item ? (ui('catalogRefused') ? 'catalogRefused' : 'changeFailed') : 'changeReframed', soft: true, reason });
        }
        attempt++;
        hooks.busy(true, ui('changeRetrying') + ' · ' + ui('changeAttemptOf').replace('{n}', String(attempt)).replace('{m}', String(out.living === true ? 3 : 2)));
      }
      if (fraction < 0.002) throw Object.assign(new Error('no difference'), { uiKey: 'changeNoDiff', soft: true });
      let likeness = null;
      if (item) { likeness = await likenessCall(toJpeg(A)); (opts.room ? state.lastTurn.followUps[state.lastTurn.followUps.length - 1] : state.lastTurn).likeness = likeness; }
      // the paste stays inside the piece (T16c): the changed region ∩ (the old outlines ∪ the product's box, clipped to the piece's
      // neighbourhood — T16f), widened 12 px at half-res,
      // so what the editor touched elsewhere never reaches the panorama
      let regionFraction = null;
      if (piece) {
        // T18a: the region = the scan's outline ∪ the piece as read on this crop (its silhouette and its box) ∪ the judge's product box
        // (clipped to the fuller box's neighbourhood) ∪ a pad under the box for the legs' ends and the shadow — still the piece's own
        // neighbourhood and nothing else (D-CAT-20)
        const polys = oldPolys.slice();
        if (seen) {
          if (seen.outline) polys.push(seen.outline.map(([y, x]) => [(x / 1000) * CROP_W, (y / 1000) * CROP_H]));
          polys.push(boxPoly(seen.box, CROP_W, CROP_H));
        }
        if (judged && judged.product_box) polys.push(boxPoly(judged.product_box, CROP_W, CROP_H));
        const above = Math.min(PAD_ABOVE_MAX, (PAD_ABOVE[marker && marker.category] || 0) * (fullBox[2] - fullBox[0]));
        polys.push(boxPoly([Math.max(0, fullBox[0] - above), fullBox[1], Math.min(1000, fullBox[2] + PAD_BELOW), fullBox[3]], CROP_W, CROP_H));
        const region = polyMask(polys, CROP_W, CROP_H, 12);
        const ra = featherAlpha({ m: region.m, hw: region.hw, hh: region.hh }, CROP_W, CROP_H, 6, lift).alpha;
        let kept = 0;
        for (let i = 0; i < alpha.length; i++) { alpha[i] = (alpha[i] * ra[i]) / 255; if (alpha[i] > 127) kept++; }
        regionFraction = Number(region.fraction.toFixed(3));
        const rec = opts.room ? state.lastTurn.followUps[state.lastTurn.followUps.length - 1] : state.lastTurn;
        rec.region_fraction = regionFraction;
        rec.pasted_fraction = Number((kept / alpha.length).toFixed(3));
      }
      // the crop becomes "crop with the change": project only where alpha says
      hooks.busy(true, ui('changeStepPlacing')); // T18j
      persToEquiBlend(canvas, A, alpha, yaw, pitch, hfov);
      if (account) { account.after = toJpeg(equiToPers(canvas, yaw, pitch, hfov, CROP_W, CROP_H)); account.after_wide = toJpeg(equiToPers(canvas, yaw, pitch, wideHfov, CROP_W, CROP_H)); account.ok = true; }
      // the marker after the swap (OQ-C10): onto the product's box, named after the item; undo falls back through the stack
      let markerMeta = null;
      if (piece && marker) {
        const pb = judged && judged.product_box ? judged.product_box : fullBox;
        const corners = boxPoly(pb, CROP_W, CROP_H).map(([x, y]) => { const d = dirOfPixel(x, y, view, CROP_W, CROP_H); return [Number(norm(yawOf(d)).toFixed(2)), Number(pitchOf(d).toFixed(2))]; });
        const cd = dirOfPixel(((pb[1] + pb[3]) / 2000) * CROP_W, ((pb[0] + pb[2]) / 2000) * CROP_H, view, CROP_W, CROP_H);
        markerMeta = { id: marker.id, before: { yaw: marker.yaw, pitch: marker.pitch, outlines: marker.outlines, count: marker.count, item: marker.item || null }, after: { yaw: Number(norm(yawOf(cd)).toFixed(2)), pitch: Number(pitchOf(cd).toFixed(2)), outlines: [corners], count: judged && judged.count ? judged.count : marker.count, item: item.id } };
      }
      const meta = { prompt: out.prompt, model: out.model, reach: out.reach, living: out.living === true, attempt, ring: Number(ring.toFixed(3)), judge: judged, usd: out.usd, fraction: Number(fraction.toFixed(3)), ...(item ? { item: item.id, likeness } : {}), ...(piece ? { piece, region_fraction: regionFraction } : {}), ...(markerMeta ? { marker: markerMeta } : {}), ...(opts.linked_to ? { linked_to: opts.linked_to } : {}) };
      const entry = opts.room ? await hooks.pushLiveQuiet(room, canvas, text, meta) : await hooks.pushLive(room, canvas, text, meta);
      canvas.width = 0; canvas.height = 0;
      if (pick && !opts.room) closePick();
      renderItemCard();
      // T18d (D-CAT-27): the same piece seen from other scenes — one follow-up turn per scene, onto that room's stack, quietly
      if (!opts.room && marker && marker.piece) {
        const others = hooks.samePiece(marker.piece, room, marker.id);
        const linked = [];
        for (const o of others) {
          const stB = hooks.markerState(o.room, o.id);
          if (!stB || stB.category !== item.category) continue;
          const r = await runChange(text, { item, marker: stB }, { room: o.room, linked_to: { room, id: marker.id } }).catch((e) => ({ ok: false, key: 'error', error: String(e && e.message || e).slice(0, 120) }));
          linked.push({ room: o.room, id: o.id, ok: Boolean(r && r.ok), ...(r && r.key ? { key: r.key } : {}), ...(r && r.reason ? { reason: r.reason } : {}) });
        }
        if (linked.length) {
          entry.meta.linked = linked;
          state.lastTurn.linked = linked;
          const failed = linked.filter((l) => !l.ok);
          if (failed.length) {
            hooks.busy(true, ui('changeAlsoFailed').replace('{room}', failed.map((l) => hooks.roomName(l.room)).join(', ')), true);
            window.setTimeout(() => { if (state.applying) hooks.busy(false); }, 5000);
          } else hooks.busy(false);
          hooks.renderChange();
        }
      }
      // T18f (the judge's J-09): after a swap the view re-aims so the product's new ring sits at 38 % of the viewport's height — above
      // the bottom stack and the card, where a second tap finds it (the chair set's ring had moved down under the undo pill)
      if (markerMeta && markerMeta.after && !opts.room) {
        try {
          const hf = viewer.getHfov();
          const vf = (2 * Math.atan(Math.tan((hf * Math.PI) / 360) * (window.innerHeight / Math.max(1, window.innerWidth))) * 180) / Math.PI;
          viewer.lookAt(Math.max(-55, Math.min(55, markerMeta.after.pitch + 0.12 * vf)), markerMeta.after.yaw, hf, hooks.reduced() ? false : 500);
        } catch (_) { /* the view stays */ }
      }
      return { ok: true };
    } catch (e) {
      const key = e && e.uiKey ? e.uiKey : 'changeFailed';
      if (opts.room) {
        // a failed follow-up: recorded, said for its room by the caller; the swap on screen stands
        if (state.lastTurn) state.lastTurn.error = { key, reason: e && e.reason ? e.reason : null, room: opts.room, message: String(e && e.message || e).slice(0, 200) };
        if (account) { account.ok = false; account.message = { key, reason: e && e.reason ? e.reason : null, text: ui(key), error: String(e && e.message || e).slice(0, 200) }; }
        return { ok: false, key, reason: e && e.reason ? e.reason : null };
      }
      if (pick) closePick();
      if (state.lastTurn) state.lastTurn.error = { key, reason: e && e.reason ? e.reason : null, message: String(e && e.message || e).slice(0, 200) };
      hooks.busy(true, ui(key), true); // T18j: a final message carries no spinner — and it shows before the record's wide cut
      if (account) {
        account.ok = false;
        account.message = { key, reason: e && e.reason ? e.reason : null, text: ui(key), error: String(e && e.message || e).slice(0, 200) };
        if (!account.before_wide && canvas) { try { account.before_wide = toJpeg(equiToPers(canvas, yaw, pitch, wideHfov, CROP_W, CROP_H)); } catch (_) { /* no wide view for this record */ } }
      }
      // a message stays long enough to read: about 70 ms a character, between 3.2 and 8 seconds
      window.setTimeout(() => { if (!state.applying) return; hooks.busy(false); }, Math.max(3200, Math.min(8000, String(ui(key) || '').length * 70)));
      return { ok: false, key };
    } finally {
      if (timer) window.clearInterval(timer);
      input.disabled = false; apply.disabled = false;
      hooks.renderChange();
      if (account) void postRecord(account, { room, view: { yaw: Number(yaw.toFixed(2)), pitch: Number(pitch.toFixed(2)), hfov: Number(hfov.toFixed(1)) }, wide_hfov: wideHfov, item: pick && pick.item ? pick.item.id : null, marker: marker ? marker.id : null, ms: Date.now() - t0 });
    }
  }

  ready().then(async (h) => {
    hooks = h;
    let info = null;
    try { info = await (await fetch('api/edit', { cache: 'no-store', headers: { 'X-Tour-Code': code } })).json(); } catch (_) { info = null; }
    // T18i (F9): the host answers `configured` only for the right code — a wrong link keeps the field as "soon" and the rings hidden,
    // and no crop is ever cut for it
    if (openProbe && !(info && info.open === true && info.configured)) return; // a closed host and no code: the page stays as it was
    if (!info || !info.configured) { state.lockReason = info && info.reason === 'code' ? 'code' : 'keys'; return; }
    unlocked = true;
    recording = info.record === true; // T17a: only the laptop host says so
    state.recording = recording;
    h.setUnlocked();
    document.addEventListener('tour:change', () => { if (state.pick && state.pick.room !== hooks.room()) closePick(); renderItemCard(); });
    document.addEventListener('tour:marker', (e) => openPick(e.detail));
    $('t-pick-close').addEventListener('click', closePick);
    const cardClose = $('t-item-close');
    if (cardClose) cardClose.addEventListener('click', () => { state.cardClosed = { room: hooks.room(), n: ((state.liveMeta && state.liveMeta[hooks.room()]) || []).length }; renderItemCard(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pickBox.hidden) closePick(); });
    renderItemCard();
    showHint();
    const submit = () => { const text = input.value.trim(); if (text.length < 2 || !hooks.canChange()) return; input.value = ''; input.blur(); runChange(text); };
    form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
    state.liveReady = true;
  });
})();
