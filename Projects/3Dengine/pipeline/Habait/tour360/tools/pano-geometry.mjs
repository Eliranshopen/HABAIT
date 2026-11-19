/* Habait Tour360 — tools/pano-geometry.mjs (T16a, CATALOG-PLAN.md §10) — the sphere maths the tools share, pure functions, no
   dependencies. The same frame as viewer/edit-live.js and tools/edit-pano.py: +z forward at yaw 0, +x right, +y up; u,v on the
   full equirect (u 0.5 = yaw 0). Moved here from tools/replace-probe.mjs (2026-10-07 evening) so the scan (tools/scan-pieces.mjs),
   the probe and any later tool cut the same crops and read the same directions. Every function takes the view size it works in. */
import { createRequire } from 'node:module';
import path from 'node:path';

export const norm = (deg) => ((deg + 540) % 360) - 180;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const round = (n, d = 3) => Math.round(n * 10 ** d) / 10 ** d;

/** sharp lives beside the evidence tools (qa-evidence/_tools); the harness root is where .env and qa-evidence sit. */
export function loadSharp(harnessRoot) {
  // (2026-11-06) the evidence tools may not carry sharp; then the app's copy (HABAIT_APP_DIR, the same resolution as app-require.mjs)
  try { return createRequire(path.join(harnessRoot, 'qa-evidence', '_tools', 'package.json'))('sharp'); }
  catch { const dir = process.env.HABAIT_APP_DIR || 'C:/RnD/Projects/Habait/tools/appdeps'; return createRequire(path.join(dir, 'package.json'))('sharp'); }
}
/** The equirect as raw RGB: { data, W, H, file }. */
export async function loadPano(sharp, file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, W: info.width, H: info.height, file };
}

/** The camera basis for a look direction: f forward, r right, u up (unit vectors). */
export function basis(yawDeg, pitchDeg) {
  const y = (yawDeg * Math.PI) / 180, p = (pitchDeg * Math.PI) / 180;
  const f = [Math.cos(p) * Math.sin(y), Math.sin(p), Math.cos(p) * Math.cos(y)];
  const r = [Math.cos(y), 0, -Math.sin(y)];
  const u = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]];
  return { f, r, u };
}
export const focal = (w, hfovDeg) => (w / 2) / Math.tan((hfovDeg * Math.PI) / 360);
/** The unit direction of a yaw/pitch pair. */
export const dirOf = (yawDeg, pitchDeg) => basis(yawDeg, pitchDeg).f;
export const yawOf = (d) => (Math.atan2(d[0], d[2]) * 180) / Math.PI;
export const pitchOf = (d) => (Math.asin(clamp(d[1], -1, 1)) * 180) / Math.PI;
export const angleBetween = (a, b) => (Math.acos(clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1)) * 180) / Math.PI;

/** A w×h perspective view (RGB buffer) cut out of the equirect, bilinear and wrap-aware — the browser's equiToPers. */
export function render(pano, yaw, pitch, hfov, w, h) {
  const { data: S, W: PW, H: PH } = pano;
  const O = Buffer.alloc(w * h * 3);
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
      let sx = (lon / twoPi + 0.5) * PW - 0.5;
      let sy = (0.5 - lat / Math.PI) * PH - 0.5;
      sx = ((sx % PW) + PW) % PW;
      sy = Math.max(0, Math.min(PH - 1, sy));
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      const x1 = (x0 + 1) % PW, y1 = Math.min(PH - 1, y0 + 1);
      const tx = sx - x0, ty = sy - y0;
      const i00 = (y0 * PW + x0) * 3, i10 = (y0 * PW + x1) * 3, i01 = (y1 * PW + x0) * 3, i11 = (y1 * PW + x1) * 3;
      const o = (y * w + x) * 3;
      for (let c = 0; c < 3; c++) O[o + c] = (S[i00 + c] * (1 - tx) + S[i10 + c] * tx) * (1 - ty) + (S[i01 + c] * (1 - tx) + S[i11 + c] * tx) * ty;
    }
  }
  return O;
}
/** The unit direction a view pixel looks along (view = { yaw, pitch, hfov }). */
export function direction(x, y, v, w, h) {
  const fpx = focal(w, v.hfov);
  const { f, r, u } = basis(v.yaw, v.pitch);
  const a = (x - w / 2) / fpx, b = -(y - h / 2) / fpx;
  const d = [f[0] + a * r[0] + b * u[0], f[1] + a * r[1] + b * u[1], f[2] + a * r[2] + b * u[2]];
  const n = 1 / Math.hypot(...d);
  return d.map((c) => c * n);
}
/** Where a direction lands in a view: { x, y } in pixels, or null when it is behind the camera. The inverse of `direction`. */
export function project(d, v, w, h) {
  const fpx = focal(w, v.hfov);
  const { f, r, u } = basis(v.yaw, v.pitch);
  const zc = d[0] * f[0] + d[1] * f[1] + d[2] * f[2];
  if (zc <= 1e-6) return null;
  const xc = d[0] * r[0] + d[1] * r[1] + d[2] * r[2];
  const yc = d[0] * u[0] + d[1] * u[1] + d[2] * u[2];
  return { x: (fpx * xc) / zc + w / 2, y: (-fpx * yc) / zc + h / 2 };
}
/** Where a box (normalized 0-1000, [ymin, xmin, ymax, xmax]) sits on the sphere: its centre and corner directions, its angular area. */
export function boxOnSphere(box, v, w, h) {
  const px = (q) => (q / 1000) * w, py = (q) => (q / 1000) * h;
  const corners = [[px(box[1]), py(box[0])], [px(box[3]), py(box[0])], [px(box[1]), py(box[2])], [px(box[3]), py(box[2])]].map(([x, y]) => direction(x, y, v, w, h));
  const centre = direction((px(box[1]) + px(box[3])) / 2, (py(box[0]) + py(box[2])) / 2, v, w, h);
  const fpx = focal(w, v.hfov);
  const area = ((px(box[3]) - px(box[1])) / fpx) * ((py(box[2]) - py(box[0])) / fpx); // angular area, small-angle (steradian-ish)
  return { centre, corners, area };
}
/** The view that frames a set of directions with a margin: centred on their mean, hfov from their yaw and pitch spans. */
export function frameView(dirs, factor, w, h, { min = 45, max = 90 } = {}) {
  const mean = dirs.reduce((m, d) => [m[0] + d[0], m[1] + d[1], m[2] + d[2]], [0, 0, 0]);
  const n = 1 / Math.hypot(...mean);
  const c = mean.map((v) => v * n);
  const cy = yawOf(c), cp = pitchOf(c);
  let ymin = 0, ymax = 0, pmin = 0, pmax = 0;
  for (const d of dirs) {
    const dy = norm(yawOf(d) - cy), dp = pitchOf(d) - cp;
    ymin = Math.min(ymin, dy); ymax = Math.max(ymax, dy); pmin = Math.min(pmin, dp); pmax = Math.max(pmax, dp);
  }
  const spanYaw = ymax - ymin, spanPitch = pmax - pmin;
  const hfov = clamp(Math.max(spanYaw * factor, spanPitch * factor * (w / h), 10), min, max);
  return { yaw: round(norm(cy), 2), pitch: round(clamp(cp, -55, 55), 2), hfov: round(hfov, 1), spanYaw: round(spanYaw, 1), spanPitch: round(spanPitch, 1) };
}
/** The outline the vision model drew, checked against its own box: the model sometimes returns an outline that does not sit on
    the piece at all (the sofa's zoomed crop, 2026-10-07: the box right, the outline over the painting). Returns the better of
    the two axis orders with its box overlap, or null when neither overlaps the box enough — then the box itself is the mask. */
export function fitPolygon(poly, box) {
  if (!poly || poly.length < 6) return null;
  const bbox = (pts) => [Math.min(...pts.map((p) => p[1])), Math.min(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0]))];
  const area = (q) => Math.max(0, q[2] - q[0]) * Math.max(0, q[3] - q[1]);
  const iou = (a, b) => { const inter = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1])); const u = area(a) + area(b) - inter; return u > 0 ? inter / u : 0; };
  const swappedPoly = poly.map(([x, y]) => [y, x]);
  const asIs = iou(bbox(poly), box), swapped = iou(bbox(swappedPoly), box);
  const best = swapped > asIs ? { poly: swappedPoly, fit: swapped, order: 'yx' } : { poly, fit: asIs, order: 'xy' };
  return best.fit >= 0.6 ? best : null;
}
/** Scanline fill of polygons (points in px) into a w×h Uint8 mask, then a square dilation by pad px. */
export function rasterMask(polys, w, h, pad) {
  let m = new Uint8Array(w * h);
  for (const poly of polys) {
    const n = poly.length;
    for (let y = 0; y < h; y++) {
      const yc = y + 0.5, xs = [];
      for (let i = 0; i < n; i++) {
        const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % n];
        if ((y1 <= yc && y2 > yc) || (y2 <= yc && y1 > yc)) xs.push(x1 + ((yc - y1) * (x2 - x1)) / (y2 - y1));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.ceil(xs[k])); x < Math.min(w, xs[k + 1]); x++) m[y * w + x] = 1;
    }
  }
  if (pad > 0) m = dilate(m, w, h, pad);
  let area = 0; for (let i = 0; i < m.length; i++) area += m[i];
  return { m, fraction: area / m.length };
}
/** Square dilation by r px, separable. */
export function dilate(m, w, h, r) {
  const t = new Uint8Array(w * h), o = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 0; for (let k = -r; k <= r && !v; k++) { const xx = x + k; if (xx >= 0 && xx < w && m[y * w + xx]) v = 1; } t[y * w + x] = v; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 0; for (let k = -r; k <= r && !v; k++) { const yy = y + k; if (yy >= 0 && yy < h && t[yy * w + x]) v = 1; } o[y * w + x] = v; }
  return o;
}
/** A box's box_2d corners as a polygon in px. */
export const boxPolygon = (b, w, h) => [[(b[1] / 1000) * w, (b[0] / 1000) * h], [(b[3] / 1000) * w, (b[0] / 1000) * h], [(b[3] / 1000) * w, (b[2] / 1000) * h], [(b[1] / 1000) * w, (b[2] / 1000) * h]];
