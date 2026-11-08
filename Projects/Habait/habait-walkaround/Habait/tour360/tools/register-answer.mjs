/* Habait Tour360 — tools/register-answer.mjs (2026-11-06, R30b). A model without a size control answers in its own aspect
   (fal nano-banana-2: 1584x672, 21:9 — a near-centred crop of the 2:1 picture it was given). Stretching that to 2:1 misplaces every row
   (02-kitchen oven band: a 16-px step at the band edge). Registered instead: scaled by width (x scale 0.98-1.03), placed at the vertical
   and horizontal offset that best matches the picture in the rows/columns the edit was NOT asked to change (greyscale, half resolution), and the rows
   the answer does not cover taken from the picture itself. ONE function for close-seam.mjs (a band) and finish-pano.mjs (a floor).
     const { buf, registration } = await registerAnswer(sharp, answerPng, pictureBuf, { W, H, skipCols: [x0, x1], rows: [v0, v1] }) */
export async function registerAnswer(sharp, answerPng, pictureBuf, { W, H, skipCols = null, rows = [0.04, 0.96], scales = [0.98, 1.03], dy = 30, dx = 40 }) {
  const m = await sharp(answerPng).metadata(), w2 = Math.round(W / 2), h2 = Math.round(H / 2);
  const P = await sharp(pictureBuf).resize(w2, h2, { fit: 'fill' }).removeAlpha().greyscale().raw().toBuffer();
  const r0 = Math.round(rows[0] * h2), r1 = Math.round(rows[1] * h2);
  // coarse (scale step 0.01, rows step 2, columns step 4 px at half resolution), then fine around the best (step 0.0025 / 1 / 1)
  const cost = (A, aw, ah, left, top) => { let e = 0, n = 0;
    for (let r = Math.max(r0, top); r < Math.min(r1, top + ah); r += 3) for (let c = 8; c < w2 - 8; c += 5) {
      if (skipCols && c >= skipCols[0] / 2 && c <= skipCols[1] / 2) continue;
      const ca = c - left; if (ca < 0 || ca >= aw) continue;
      e += Math.abs(P[r * w2 + c] - A[(r - top) * aw + ca]); n++;
    }
    return n > 500 ? e / n : Infinity; };
  const cache = new Map();
  const ans = async (s) => { const k = s.toFixed(4); if (!cache.has(k)) { const ah = Math.round(w2 * s * m.height / m.width), aw = Math.round(w2 * s); cache.set(k, { aw, ah, A: await sharp(answerPng).resize(aw, ah, { fit: 'fill' }).removeAlpha().greyscale().raw().toBuffer() }); } return cache.get(k); };
  let best = null;
  const search = async (sList, tops, lefts) => { for (const s of sList) { const { aw, ah, A } = await ans(s); const c0 = Math.round((h2 - ah) / 2), l0 = Math.round((w2 - aw) / 2);
    for (const dt of tops) for (const dl of lefts) { const err = cost(A, aw, ah, l0 + dl, c0 + dt); if (!best || err < best.err) best = { s, top: c0 + dt, left0: l0 + dl, aw, ah, err }; } } };
  const range = (a, b, st) => { const o = []; for (let v = a; v <= b + 1e-9; v += st) o.push(+v.toFixed(4)); return o; };
  await search(range(scales[0], scales[1], 0.01), range(-dy, dy, 2), range(-dx, dx, 4));
  const b0 = best; await search(range(b0.s - 0.01, b0.s + 0.01, 0.0025), range(b0.top - Math.round((h2 - b0.ah) / 2) - 2, b0.top - Math.round((h2 - b0.ah) / 2) + 2, 1), range(b0.left0 - Math.round((w2 - b0.aw) / 2) - 4, b0.left0 - Math.round((w2 - b0.aw) / 2) + 4, 1));
  const aw = best.aw * 2, ah = best.ah * 2, top = best.top * 2, left = best.left0 * 2;
  const registration = { answer: [m.width, m.height], x_scale: +best.s.toFixed(3), top_px: top, left_px: left, mean_abs_err: +best.err.toFixed(2) };
  const a = await sharp(answerPng).resize(aw, ah, { fit: 'fill' }).removeAlpha().toBuffer();
  const ex = { left: Math.max(0, -left), top: Math.max(0, -top) };
  ex.width = Math.min(aw - ex.left, W - Math.max(0, left)); ex.height = Math.min(ah - ex.top, H - Math.max(0, top));
  const base = await sharp(pictureBuf).resize(W, H, { fit: 'fill' }).removeAlpha().png().toBuffer();
  const buf = await sharp(base).composite([{ input: await sharp(a).extract(ex).toBuffer(), left: Math.max(0, left), top: Math.max(0, top) }]).removeAlpha().png().toBuffer();
  return { buf, registration };
}
