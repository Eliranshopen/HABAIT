#!/usr/bin/env node
/* Habait Tour360 — openings-test.mjs (WALKAROUND-QUALITY-PLAN §4.2: the openings test; D-WQ-10 measurably true).
   For one camera, every door, window pane and wall-end opening of the general plan is projected into the equirect frame
   (its two ends at the sill and the head heights -> a box in u,v), and the skinned answer is compared with the CG render
   inside each box: both images give a Sobel edge map; the test reports, per opening, the share of the CG's strong edges
   that the skin reproduces within a 6 px tolerance (kept) and the share of the skin's strong edges with no CG edge nearby
   (new), plus the mean position shift of the opening's vertical jambs (the strongest vertical edge column on each side).
   Pass: kept >= 0.60 and |shift| <= 2 % of the box width for every opening in view; the room's verdict is the worst row.
   $0, no network. sharp from the Habait app (app-require.mjs).
   2026-10-29 (OQ-2, D-WQ-33 step 2 — what Slava's eye caught that the test could not): three more kinds of row.
     · seam     — the wrap: the skin's luminance step across its own left/right edge (8-px strips, rows 25–85 %) against
                  the CG's; bound max(10, 3 × the CG's step). A generative skin does not join its edges on its own.
     · fixture  — every placeholder mass (plan.fixtures) in view, its silhouette read like a door frame (its two sides
                  and its top). ADVISORY: a dressed box's silhouette moves, and a fitted box's silhouette is the wall's own
                  edges (the kitchen GPT left empty still read kept 0.76), so the row reports and does not judge.
     · passage  — a zone-boundary `opening` (no door, head = ceiling): the floor the CG sees through it (its depth = the
                  floor plane) read in the skin — the strong-edge density of the skin's floor band against the CG's.
                  ADVISORY for now: against a plank-textured CG floor the ratio does not separate a covered passage from
                  a clean one; it gets its bound once the CG floor carries the real tile grid (OQ-2 step 3).
   2026-11-01 (habait-de; Eliran's eye caught the kitchen's counter cut at the bedroom-2 hotspot, which passed at 6.2): the seam rows
   read the skin's OWN join — u = roll.u_edge for a rolled skin (tools/skin-seam.mjs; --seam-u overrides), not x 0, which for a rolled
   skin is a column inside the answer — and a second row reads geometry, which a luminance step averages away:
     · lines    — the vertical-gradient row profiles of the two sides of the join must correlate (counters, shelves, skirting continue):
                  corr >= min(0.55, the CG's corr at the same column - 0.15). Calibrated on apt846's 11 picks against the eye.

   usage: node tools/openings-test.mjs <apartment> <camera-id> <cg-pano> <skin-pano> [--json] [--out <png>]
     camera-id as in plan.general.json camera_points (cp-living) or the short id (living) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appRequire } from './app-require.mjs';
import { paneSpanInRoom } from './plan-geometry.mjs';
import { skinSeamU, seamLines } from './skin-seam.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOUR = path.resolve(HERE, '..');
const HARNESS = path.resolve(TOUR, '..', '..');
const sharp = appRequire(HARNESS)('sharp');
const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const pos = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--out', '--seam-u'].includes(args[i - 1])));
const [aptId, camArg, cgFile, skinFile] = pos;
if (!aptId || !camArg || !cgFile || !skinFile) { console.error('usage: openings-test.mjs <apartment> <camera-id> <cg-pano> <skin-pano> [--json] [--out <png>]'); process.exit(2); }
const plan = JSON.parse(fs.readFileSync(path.join(TOUR, 'apartments', aptId, 'plan.general.json'), 'utf8'));
const cam = plan.camera_points.find((c) => c.id === camArg || c.id === `cp-${camArg}`);
if (!cam) { console.error(`camera ${camArg} not in the plan`); process.exit(2); }
const room = plan.rooms.find((r) => r.id === cam.room_id);

// --- projection: plan frame (x right, y down, bearings 0 = up clockwise) -> equirect u,v for a point at height z (cm)
const yaw0 = (cam.yaw_deg * Math.PI) / 180;
function project([px, py], z) {
  const dx = px - cam.x, dy = py - cam.y; const bearing = Math.atan2(dx, -dy);                   // 0 = up, clockwise
  let rel = bearing - yaw0; while (rel <= -Math.PI) rel += 2 * Math.PI; while (rel > Math.PI) rel -= 2 * Math.PI;
  const dist = Math.hypot(dx, dy); const elev = Math.atan2(z - cam.z, dist);
  return { u: 0.5 + rel / (2 * Math.PI), v: 0.5 - elev / Math.PI, dist };
}
// the openings and panes that bound this room (an opening lists the room; a pane is adjacent when its centroid is within 60 cm of the loop)
const distToLoop = (p, L) => { let d = Infinity; for (let i = 0; i < L.length; i++) { const a = L[i], b = L[(i + 1) % L.length]; const dx = b[0] - a[0], dy = b[1] - a[1]; const l2 = dx * dx + dy * dy || 1; let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2; t = Math.max(0, Math.min(1, t)); d = Math.min(d, Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))); } return d; };
const items = [];
// a zone-boundary `opening` is a passage: judged on the floor seen through it, not on a frame it does not have
for (const o of plan.openings) if (o.rooms.includes(room.id)) items.push(o.kind === 'opening' ? { id: o.id, kind: 'passage', a: o.a_cm, b: o.b_cm, sill: 0, head: o.head_cm } : { id: o.id, kind: o.kind, a: o.a_cm, b: o.b_cm, sill: o.sill_cm, head: o.head_cm });
// every placeholder mass of the apartment that this camera can see (the depth pass decides below): its bearing extent is the
// chord between its two extreme corners, its height the box's; `poly` keeps the whole footprint for the occlusion ray
const bearingOf = ([px, py]) => { let r = Math.atan2(px - cam.x, -(py - cam.y)) - yaw0; while (r <= -Math.PI) r += 2 * Math.PI; while (r > Math.PI) r -= 2 * Math.PI; return r; };
for (const f of plan.fixtures || []) {
  const P = f.polygon_cm; if (!P || P.length < 3) continue;
  const bs = P.map(bearingOf); let lo = 0, hi = 0; for (let i = 1; i < P.length; i++) { if (bs[i] < bs[lo]) lo = i; if (bs[i] > bs[hi]) hi = i; }
  if (bs[hi] - bs[lo] > Math.PI) { // the footprint straddles the seam: take the extremes the other way round
    lo = 0; hi = 0; const w = bs.map((b) => (b < 0 ? b + 2 * Math.PI : b)); for (let i = 1; i < P.length; i++) { if (w[i] < w[lo]) lo = i; if (w[i] > w[hi]) hi = i; } }
  const z0 = f.z_cm ?? 0, z1 = z0 + (f.height_cm ?? 75);
  items.push({ id: f.id, kind: 'fixture', a: P[lo], b: P[hi], sill: z0, head: z1, poly: P, near: Math.min(...P.map(([x, y]) => Math.hypot(x - cam.x, y - cam.y))) });
}
// a pane is tested along the stretch of its axis that runs within 60 cm of this room's loop (a facade pane may run past
// several rooms: bedroom 2's window is 40 % of facade-1); a railing bounds outdoor rooms only
for (const p of plan.panes) { if (p.kind === 'railing' && !room.is_outdoor) continue; const sp = paneSpanInRoom(p, room.loop); if (!sp) continue; items.push({ id: p.id, kind: p.kind, a: sp.a, b: sp.b, sill: p.sill_cm ?? 0, head: p.head_cm, ends: sp.ends }); }
if (!items.length) { console.log(`${cam.id}: no openings or panes bound ${room.id}`); process.exit(0); }

// --- images
const load = async (f) => { const img = sharp(f).greyscale(); const m = await img.metadata(); const { data } = await img.raw().toBuffer({ resolveWithObject: true }); return { W: m.width, H: m.height, g: data }; };
const A = await load(cgFile), B = await load(skinFile);
if (Math.abs(A.W / A.H - 2) > 0.05 || Math.abs(B.W / B.H - 2) > 0.05) console.warn('warning: an input is not 2:1');
function sobel(img) { const { W, H, g } = img; const m = new Float32Array(W * H); for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; const gx = -g[i - W - 1] - 2 * g[i - 1] - g[i + W - 1] + g[i - W + 1] + 2 * g[i + 1] + g[i + W + 1]; const gy = -g[i - W - 1] - 2 * g[i - W] - g[i - W + 1] + g[i + W - 1] + 2 * g[i + W] + g[i + W + 1]; m[i] = Math.hypot(gx, gy); } return m; }
const EA = sobel(A), EB = sobel(B);
// --- the CG depth beside the pano (metres × 100 packed big-endian into 24-bit RGB, the pipeline's depth contract):
// an opening the camera cannot see because a nearer wall stands in front of it (the terrace's curved wall hides two
// living-room panes) is not judged; a partly hidden one is judged on its visible columns only
const depthFile = path.join(path.dirname(cgFile), 'depth.png');
let depthCm = null;
if (fs.existsSync(depthFile)) { const d = sharp(depthFile).removeAlpha(); const m = await d.metadata(); if (m.width === A.W && m.height === A.H) { const { data } = await d.raw().toBuffer({ resolveWithObject: true }); depthCm = (x, y) => { const i = (y * A.W + x) * 3; return (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]; }; } else console.warn(`warning: ${path.basename(depthFile)} is ${m.width}x${m.height}, the pano ${A.W}x${A.H}: occlusion not tested`); }
const raySeg = (dx, dy, pa, pb) => { // the horizontal distance along a ray (dx, dy) from the camera to the segment pa→pb, or null
  const ax = pa[0] - cam.x, ay = pa[1] - cam.y, ex = pb[0] - pa[0], ey = pb[1] - pa[1];
  const den = dx * ey - dy * ex; if (Math.abs(den) < 1e-9) return null;
  const t = (ax * ey - ay * ex) / den, s = (ax * dy - ay * dx) / den;
  return t > 0 && s >= -0.05 && s <= 1.05 ? t : null;
};
const rayDist = (it, x) => { // the horizontal distance from the camera to the item along the bearing of column x (plan frame, bearing 0 = up):
  // an opening's segment, or the nearest edge of a fixture's footprint (its front face is what the depth pass saw)
  const th = yaw0 + (x / A.W - 0.5) * 2 * Math.PI; const dx = Math.sin(th), dy = -Math.cos(th);
  if (!it.poly) return raySeg(dx, dy, it.a, it.b);
  let best = null; for (let i = 0; i < it.poly.length; i++) { const t = raySeg(dx, dy, it.poly[i], it.poly[(i + 1) % it.poly.length]); if (t != null && (best == null || t < best)) best = t; }
  return best;
};
const visibleColumns = (it, bx) => { // per column of a CG box: is the opening's own surface what the depth pass saw there?
  const vis = new Uint8Array(bx.x1 - bx.x0 + 1).fill(1); if (!depthCm) return { vis, share: 1 };
  const ymid = Math.round((bx.y0 + bx.y1) / 2); const elev = (0.5 - ymid / A.H) * Math.PI; let n = 0;
  for (let x = bx.x0; x <= bx.x1; x++) { const t = rayDist(it, x); if (t == null) continue; const expected = t / Math.max(0.2, Math.cos(elev)); const seen = depthCm(x, ymid); vis[x - bx.x0] = seen >= expected * 0.85 - 30 ? 1 : 0; n += vis[x - bx.x0]; }
  return { vis, share: n / vis.length };
};
const box = (it, img) => { // the equirect box of an opening in this image's pixels (handles the seam by splitting into up to two boxes)
  const pa0 = project(it.a, it.sill), pa1 = project(it.a, it.head), pb0 = project(it.b, it.sill), pb1 = project(it.b, it.head);
  let u0 = Math.min(pa0.u, pb0.u), u1 = Math.max(pa0.u, pb0.u); const v0 = Math.min(pa1.v, pb1.v), v1 = Math.max(pa0.v, pb0.v);
  const wraps = u1 - u0 > 0.5; const boxes = wraps ? [[0, Math.min(u0, u1) + 0, v0, v1], [Math.max(u0, u1), 1, v0, v1]] : [[u0, u1, v0, v1]];
  return boxes.map(([a, b, c, d]) => ({ x0: Math.max(0, Math.floor(a * img.W)), x1: Math.min(img.W - 1, Math.ceil(b * img.W)), y0: Math.max(0, Math.floor(c * img.H)), y1: Math.min(img.H - 1, Math.ceil(d * img.H)) })).filter((bx) => bx.x1 - bx.x0 > 6 && bx.y1 - bx.y0 > 6);
};
// --- the passage metric: inside a zone opening's box, below the horizon, the pixels whose CG depth is the floor plane's
// (the slant distance cam.z / sin(-elev), within 8 %) are the floor seen through the passage; the share of them carrying a
// strong edge (above each image's own 90th percentile) is compared, skin against CG
const strongT = (E, img) => { const s = []; for (let i = 0; i < E.length; i += 97) s.push(E[i]); s.sort((p, q) => p - q); return s[Math.floor(s.length * 0.9)] || 1; };
const tGA = strongT(EA, A), tGB = strongT(EB, B);
const passageMetric = (it, bxA, bxB) => {
  let n = 0, eA = 0, eB = 0;
  for (let k = 0; k < bxA.length; k++) { const a = bxA[k], b = bxB[k] || bxB[0]; const sx = (b.x1 - b.x0) / Math.max(1, a.x1 - a.x0), sy = (b.y1 - b.y0) / Math.max(1, a.y1 - a.y0);
    for (let y = Math.max(a.y0, Math.floor(A.H * 0.52)); y <= Math.min(a.y1, Math.floor(A.H * 0.88)); y++) { const elev = (0.5 - y / A.H) * Math.PI; const floorSlant = cam.z / Math.sin(-elev);
      for (let x = a.x0; x <= a.x1; x++) { if (depthCm && Math.abs(depthCm(x, y) - floorSlant) > floorSlant * 0.08) continue; n++; if (EA[y * A.W + x] >= tGA) eA++; const bx = Math.round(b.x0 + (x - a.x0) * sx), by = Math.round(b.y0 + (y - a.y0) * sy); if (bx >= 0 && by >= 0 && bx < B.W && by < B.H && EB[by * B.W + bx] >= tGB) eB++; } } }
  return { floor_px: n, cg_density: n ? eA / n : 0, skin_density: n ? eB / n : 0 };
};
const rows = [];
for (const it of items) {
  const bxA = box(it, A), bxB = box(it, B); if (!bxA.length) { rows.push({ id: it.id, kind: it.kind, note: 'behind or degenerate' }); continue; }
  const visA = bxA.map((a) => visibleColumns(it, a)); const visShare = visA.reduce((p, v) => p + v.share * v.vis.length, 0) / visA.reduce((p, v) => p + v.vis.length, 0);
  if (visShare < 0.5) { rows.push({ id: it.id, kind: it.kind, note: `occluded: ${Math.round((1 - visShare) * 100)} % of it behind a nearer surface in the CG depth` }); continue; }
  if (it.kind === 'passage') {
    const m = passageMetric(it, bxA, bxB); if (!depthCm) { rows.push({ id: it.id, kind: it.kind, note: 'no depth: the floor through the passage cannot be told' }); continue; }
    if (m.floor_px < 2000) { rows.push({ id: it.id, kind: it.kind, note: `too little floor seen through it (${m.floor_px} px)` }); continue; }
    const ratio = m.cg_density > 0 ? m.skin_density / m.cg_density : (m.skin_density > 0 ? 99 : 1);
    // ADVISORY, no verdict (2026-10-29, the eleven finals of 846): against a plank-textured CG floor the ratio sits at
    // 0.05–0.9 for passages the eye accepted and at 0.33 for the one with an island drawn across it — the CG's floor texture
    // decides it, not the skin. It becomes a bound once the CG floor carries the real tile grid (OQ-2 step 3) and the ratio
    // is re-read on a room known clean and a room known covered. Until then the row reports and does not judge.
    rows.push({ id: it.id, kind: it.kind, box_px: bxA.map((b) => `${b.x0}-${b.x1}x${b.y0}-${b.y1}`).join('+'), visible: +visShare.toFixed(2), floor_px: m.floor_px, cg_density: +m.cg_density.toFixed(3), skin_density: +m.skin_density.toFixed(3), ratio: +ratio.toFixed(2), advisory: true, note: `advisory, uncalibrated: the skin's floor-edge density through the passage is x${ratio.toFixed(2)} the CG's` });
    continue;
  }
  let kept = 0, keptN = 0, newE = 0, newN = 0, shiftSum = 0, shiftN = 0, wsum = 0;
  for (let k = 0; k < bxA.length; k++) { const a = bxA[k], b = bxB[k] || bxB[0]; const sx = (b.x1 - b.x0) / (a.x1 - a.x0), sy = (b.y1 - b.y0) / (a.y1 - a.y0); const vis = visA[k].vis;
    // the FRAME of the opening is what must stay: the two jamb bands (the outer 20 % of the box on each side) and the head
    // band (the top 15 %); the glass or the door leaf inside may change (sky, haze, curtains, a different mullion rhythm).
    // strong edges: the top 15 % inside the frame bands of each image; the skin's box sampled at the same relative position
    const inFrame = (bx, x, y) => { const w = bx.x1 - bx.x0, h = bx.y1 - bx.y0; return x < bx.x0 + 0.2 * w || x > bx.x1 - 0.2 * w || y < bx.y0 + 0.15 * h; };
    const vals = []; for (let y = a.y0; y <= a.y1; y++) for (let x = a.x0; x <= a.x1; x++) if (inFrame(a, x, y)) vals.push(EA[y * A.W + x]); const tA = vals.sort((p, q) => p - q)[Math.floor(vals.length * 0.85)] || 1;
    const valsB = []; for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) if (inFrame(b, x, y)) valsB.push(EB[y * B.W + x]); const tB = valsB.sort((p, q) => p - q)[Math.floor(valsB.length * 0.85)] || 1;
    const near = (E, img, x, y, t, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= img.W || yy >= img.H) continue; if (E[yy * img.W + xx] >= t) return true; } return false; };
    for (let y = a.y0; y <= a.y1; y++) for (let x = a.x0; x <= a.x1; x++) { if (!vis[x - a.x0] || !inFrame(a, x, y) || EA[y * A.W + x] < tA) continue; keptN++; const bx = Math.round(b.x0 + (x - a.x0) * sx), by = Math.round(b.y0 + (y - a.y0) * sy); if (near(EB, B, bx, by, tB, 8)) kept++; }
    for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) { if (!inFrame(b, x, y) || EB[y * B.W + x] < tB) continue; const ax = Math.round(a.x0 + (x - b.x0) / sx), ay = Math.round(a.y0 + (y - b.y0) / sy); if (!vis[Math.max(0, Math.min(vis.length - 1, ax - a.x0))]) continue; newN++; if (!near(EA, A, ax, ay, tA, 8)) newE++; }
    // jamb shift: cross-correlate the vertical-edge column profiles of the two boxes (resampled to the CG box width,
    // the box widened by 12 % on each side so a jamb that moved outward is still inside); the lag of the best
    // correlation over ±15 % of the width is the shift. Robust to added curtains, plants and mullions.
    const wA = a.x1 - a.x0, wB = b.x1 - b.x0; const pad = Math.round(wA * 0.12);
    const profile = (E, img, bx, from, to, n) => { const out = new Float64Array(n); for (let k = 0; k < n; k++) { const x = Math.round(from + ((to - from) * k) / Math.max(1, n - 1)); if (x < 0 || x >= img.W) continue; let s = 0; for (let y = bx.y0; y <= bx.y1; y++) { const i = y * img.W + x; if (x > 0 && x < img.W - 1) s += Math.abs(img.g[i + 1] - img.g[i - 1]); } out[k] = s; } const m = out.reduce((p, q) => p + q, 0) / n; let v = 0; for (let k = 0; k < n; k++) { out[k] -= m; v += out[k] * out[k]; } const sd = Math.sqrt(v / n) || 1; for (let k = 0; k < n; k++) out[k] /= sd; return out; };
    // the shift is measured per JAMB: the left band and the right band (each 30 % of the box, padded outward 12 %) are
    // cross-correlated separately, so a changed mullion rhythm inside the glass cannot drive the lag
    const corrLag = (pA, pB, n) => { const maxLag = Math.max(2, Math.round(n * 0.3)); let bestLag = 0, bestC = -Infinity; for (let lag = -maxLag; lag <= maxLag; lag++) { let c = 0, cnt = 0; for (let k = 0; k < n; k++) { const j = k + lag; if (j < 0 || j >= n) continue; c += pA[k] * pB[j]; cnt++; } c /= Math.max(1, cnt); if (c > bestC) { bestC = c; bestLag = lag; } } return bestLag; };
    const bandW = Math.round(wA * 0.3); const nL = bandW + pad;
    // a pane stretch cut by a zone boundary (the dining's share of a glass wall that runs on into the kitchen) has no
    // jamb at that end: only an end that is the pane's own physical end is correlated
    const pa0 = project(it.a, it.sill), pb0 = project(it.b, it.sill); const leftIsA = pa0.u <= pb0.u; const ends = it.ends || [true, true];
    const jambL = bxA.length > 1 ? true : (leftIsA ? ends[0] : ends[1]), jambR = bxA.length > 1 ? true : (leftIsA ? ends[1] : ends[0]);
    const lags = [];
    if (jambL) lags.push(Math.abs(corrLag(profile(EA, A, a, a.x0 - pad, a.x0 + bandW, nL), profile(EB, B, b, b.x0 - pad * sx, b.x0 + bandW * sx, nL), nL)));
    if (jambR) lags.push(Math.abs(corrLag(profile(EA, A, a, a.x1 - bandW, a.x1 + pad, nL), profile(EB, B, b, b.x1 - bandW * sx, b.x1 + pad * sx, nL), nL)));
    if (lags.length) { shiftSum += lags.reduce((p, q) => p + q, 0) / lags.length / wA; shiftN++; wsum += wA; } }
  // the shift in degrees of view: a share of the box width × the box width in px × 360 / the image width
  const keptShare = keptN ? kept / keptN : 0, newShare = newN ? newE / newN : 0, shift = shiftN ? shiftSum / shiftN : 0;
  const shiftPx = shift * (wsum / Math.max(1, shiftN)), shiftDeg = (shiftPx / A.W) * 360;
  // bounds by kind, calibrated 2026-10-28 on the living room of 846 (the CG against itself = 1.0 / 0 deg; GPT: door 0.85 /
  // 0.26 deg, the curved curtain wall 0.57 / 4.9 deg because the skin redraws the mullion grid the plan never drew and a
  // curtain covers one jamb): doors and windows are strict, a floor-to-ceiling facade is judged on its extents, a railing
  // beyond the glass is second-class. The eye review of every room (D-WQ-12) stays part of the acceptance.
  // The jamb shift is read by cross-correlation inside a band 42 % of the box wide, so a curtain or a mullion a few
  // degrees from a jamb can win the correlation on a wide box (bedroom 2's 94-degree window read 10 deg with 83 % of
  // its frame edges kept within 8 px = 0.7 deg): kept three quarters or more means the frame is where it was, and the
  // shift is then not consulted. A railing has corners, not jambs: it is judged on its kept edges (bound 10 deg).
  // a fixture is a DRESSED box: chairs round a table, a headboard, a sofa's curved back all move its silhouette (the eleven
  // finals of 846 read shifts of 0.1–17.6 deg on pieces the eye accepted), and a FITTED box's silhouette is the architecture's
  // own edges (four kitchen answers, the one GPT left EMPTY among them, all read kept 0.70–0.85 on the counter boxes), so
  // the row is ADVISORY: it reports kept/new/shift and does not judge. The presence test that works is the depth one (phase 2).
  if (it.kind === 'fixture') { rows.push({ id: it.id, kind: it.kind, box_px: bxA.map((b) => `${b.x0}-${b.x1}x${b.y0}-${b.y1}`).join('+'), visible: +visShare.toFixed(2), kept: +keptShare.toFixed(3), new: +newShare.toFixed(3), jamb_shift: +shift.toFixed(3), shift_deg: +shiftDeg.toFixed(2), advisory: true, note: `advisory: silhouette kept ${keptShare.toFixed(2)}, new ${newShare.toFixed(2)}, shift ${shiftDeg.toFixed(1)} deg` }); continue; }
  const BND = it.kind === 'facade' ? { kept: 0.5, deg: 5.0 } : it.kind === 'railing' ? { kept: 0.5, deg: 10.0 } : { kept: 0.6, deg: 2.0 };
  const pass = keptShare >= BND.kept && (shiftDeg <= BND.deg || keptShare >= 0.75);
  rows.push({ id: it.id, kind: it.kind, box_px: bxA.map((b) => `${b.x0}-${b.x1}x${b.y0}-${b.y1}`).join('+'), visible: +visShare.toFixed(2), kept: +keptShare.toFixed(3), new: +newShare.toFixed(3), jamb_shift: +shift.toFixed(3), shift_deg: +shiftDeg.toFixed(2), bound: BND, pass });
}
// --- the wrap seam: the skin's own left and right edges must meet as the CG's do (the living room's armchair and island were
// cut at the entrance, 2026-10-29). 8-px strips, rows 25–85 % (walls and floor, not the ceiling), against the step between
// neighbouring strips elsewhere; the bound is set from the CG's own step at the wrap (a real edge may sit there)
const seam = flag('--seam-u') != null ? { u: Number(flag('--seam-u')), from: '--seam-u' } : skinSeamU(path.join(TOUR, 'apartments', aptId), skinFile, { camera: cam.id });
const seamStep = (img) => { const { W, H, g } = img; const r0 = Math.floor(H * 0.25), r1 = Math.floor(H * 0.85), S = 8, xj = Math.round(seam.u * W) % W;
  const strip = (r, c0) => { let s = 0; for (let c = c0; c < c0 + S; c++) s += g[r * W + (((c % W) + W) % W)]; return s / S; };
  let wrap = 0, n = 0; for (let r = r0; r < r1; r += 2) { wrap += Math.abs(strip(r, xj) - strip(r, xj - S)); n++; }
  let base = 0, m = 0; for (let r = r0; r < r1; r += 8) for (let c = 64; c < W - 64; c += 97) { base += Math.abs(strip(r, c - S) - strip(r, c)); m++; }
  return { wrap: wrap / n, base: base / m }; };
{ const sA = seamStep(A), sB = seamStep(B); const bound = Math.max(10, 3 * sA.wrap); const pass = sB.wrap <= bound;
  rows.push({ id: 'seam', kind: 'seam', u: seam.u, u_from: seam.from, wrap: +sB.wrap.toFixed(2), neighbours: +sB.base.toFixed(2), ratio: +(sB.wrap / Math.max(0.01, sB.base)).toFixed(2), cg_wrap: +sA.wrap.toFixed(2), bound: { wrap: +bound.toFixed(1) }, pass, note: pass ? undefined : 'the left and right edges do not meet' }); }
{ const lA = seamLines(A, Math.round(seam.u * A.W) % A.W), lB = seamLines(B, Math.round(seam.u * B.W) % B.W); const bound = Math.min(0.55, lA.corr0 - 0.15); const pass = lB.corr0 >= bound;
  rows.push({ id: 'seam-lines', kind: 'seam', lines: true, corr: lB.corr0, pct: lB.pct, cg_corr: lA.corr0, bound: { corr: +bound.toFixed(3) }, pass, note: pass ? undefined : 'counters, shelves or skirting do not continue across the join' }); }
const verdict = rows.filter((r) => r.pass !== undefined).every((r) => r.pass) ? 'PASS' : 'FAIL';
if (args.includes('--json')) console.log(JSON.stringify({ camera: cam.id, room: room.id, verdict, rows }, null, 2));
else { console.log(`openings-test ${cam.id} (${room.id}) against ${path.basename(cgFile)} -> ${path.basename(skinFile)}: ${verdict}  (doors and windows: kept >= 0.60, shift <= 2 deg; a facade: 0.50 / 5 deg; a railing: 0.50 / 10 deg; kept >= 0.75 settles the shift; the seam: <= max(10, 3 x the CG's step); fixtures and passages advisory; occluded items skipped${depthCm ? '' : '; NO DEPTH, occlusion untested'})`);
  for (const r of rows) { const line = r.kind === 'seam' && r.lines ? `lines corr ${String(r.corr).padStart(6)}  (better than ${r.pct}% of the columns)  CG ${r.cg_corr}  bound ${r.bound.corr}  ${r.pass ? 'pass' : 'FAIL'}${r.note ? '  ' + r.note : ''}`
    : r.kind === 'seam' ? `at u ${r.u} (${r.u_from})  wrap ${String(r.wrap).padStart(6)}  neighbours ${String(r.neighbours).padStart(6)}  (x${r.ratio})  CG ${r.cg_wrap}  bound ${r.bound.wrap}  ${r.pass ? 'pass' : 'FAIL'}${r.note ? '  ' + r.note : ''}`
    : r.kind === 'passage' && r.pass !== undefined ? `box ${r.box_px.padEnd(22)} vis ${String(r.visible).padStart(4)}  floor ${String(r.floor_px).padStart(7)} px  edges CG ${String(r.cg_density).padStart(5)}  skin ${String(r.skin_density).padStart(5)}  x${String(r.ratio).padStart(5)}  ${r.pass ? 'pass' : 'FAIL'}${r.note ? '  ' + r.note : ''}`
    : r.note ? r.note : `box ${r.box_px.padEnd(22)} vis ${String(r.visible).padStart(4)}  kept ${String(r.kept).padStart(5)}  new ${String(r.new).padStart(5)}  shift ${String(r.shift_deg).padStart(5)} deg  ${r.pass ? 'pass' : 'FAIL'}`;
    console.log(`  ${r.id.padEnd(14)} ${r.kind.padEnd(14)} ${line}`); } }
if (flag('--out')) { // an overlay of the boxes on the skin (green pass, red fail, grey occluded or behind)
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${B.W}" height="${B.H}">`; for (const it of items) for (const b of box(it, B)) { const r = rows.find((x) => x.id === it.id); svg += `<rect x="${b.x0}" y="${b.y0}" width="${b.x1 - b.x0}" height="${b.y1 - b.y0}" fill="none" stroke="${r && r.note ? '#999' : r && r.pass ? '#0c0' : '#f00'}" stroke-width="4"/><text x="${b.x0 + 4}" y="${b.y0 + 28}" font-size="24" fill="#ff0" font-family="Arial">${it.id}</text>`; } svg += '</svg>';
  const buf = await sharp(skinFile).composite([{ input: Buffer.from(svg), left: 0, top: 0 }]).png().toBuffer(); await sharp(buf).resize({ width: 1800 }).png().toFile(flag('--out')); console.log(`overlay ${flag('--out')}`); }
process.exit(verdict === 'PASS' ? 0 : 1);
