// extract-walls.mjs <plan-crop.png> <pxPerCm> <outJson> <outPng>
// The sales plan draws walls as a mid-grey fill; lines and text are black; furniture is light grey.
// 1. threshold the grey fill, 2. 8-connected components, 3. trace each component's outer contour,
// 4. simplify (Douglas-Peucker, 1.5 cm), 5. write polygons in cm (crop frame, y down) + an overlay PNG.
import path from "node:path"; import fs from "node:fs"; import { fileURLToPath } from "node:url"; import { appRequire } from "./app-require.mjs";
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", ".."); const sharp = appRequire(REPO)("sharp");
const [, , inp, pxPerCmS, outJson, outPng] = process.argv; const pxPerCm = Number(pxPerCmS);
const { data, info } = await sharp(inp).greyscale().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height; const N = W * H;
// histogram to see the fill level
const hist = new Array(256).fill(0); for (let i = 0; i < N; i++) hist[data[i]]++;
const peaks = hist.map((c, v) => [v, c]).filter(([v, c]) => v > 40 && v < 200 && c > N * 0.002).map(([v, c]) => `${v}:${(c / N * 100).toFixed(2)}%`);
console.log("grey peaks (40..200, >0.2%):", peaks.join(" "));
const LO = 70, HI = 150; // the wall fill band
const mask = new Uint8Array(N); let cnt = 0; for (let i = 0; i < N; i++) if (data[i] >= LO && data[i] <= HI) { mask[i] = 1; cnt++; }
console.log(`fill pixels ${cnt} (${(cnt / N * 100).toFixed(2)}%)`);
// morphological open (3x3) to drop thin grey anti-aliasing of black lines
const eroded = new Uint8Array(N); for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (mask[i] && mask[i - 1] && mask[i + 1] && mask[i - W] && mask[i + W] && mask[i - W - 1] && mask[i - W + 1] && mask[i + W - 1] && mask[i + W + 1]) eroded[i] = 1; }
const opened = new Uint8Array(N); for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (eroded[i] || eroded[i - 1] || eroded[i + 1] || eroded[i - W] || eroded[i + W] || eroded[i - W - 1] || eroded[i - W + 1] || eroded[i + W - 1] || eroded[i + W + 1]) opened[i] = 1; }
// components
const label = new Int32Array(N); let nlab = 0; const comps = [];
const stack = new Int32Array(N);
for (let s = 0; s < N; s++) {
  if (!opened[s] || label[s]) continue; nlab++; let sp = 0; stack[sp++] = s; label[s] = nlab; let area = 0, minx = W, miny = H, maxx = 0, maxy = 0;
  while (sp) { const i = stack[--sp]; area++; const x = i % W, y = (i / W) | 0; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
    for (const d of [-1, 1, -W, W, -W - 1, -W + 1, W - 1, W + 1]) { const j = i + d; if (j < 0 || j >= N) continue; const jx = j % W; if (Math.abs(jx - x) > 1) continue; if (opened[j] && !label[j]) { label[j] = nlab; stack[sp++] = j; } } }
  comps.push({ id: nlab, area, bbox: [minx, miny, maxx, maxy] });
}
const MIN_AREA = 1200; // px ≈ 240 cm² (a 15×16 cm stub)
const big = comps.filter((c) => c.area >= MIN_AREA).sort((a, b) => b.area - a.area);
console.log(`components ${comps.length}, kept ${big.length} (>= ${MIN_AREA} px)`);
// contour tracing (Moore neighbourhood) of each kept component's outer boundary
function traceContour(id, bbox) {
  const [minx, miny, maxx, maxy] = bbox; const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H && label[y * W + x] === id;
  // start: the top-left-most pixel of the component
  let sx = -1, sy = -1; outer: for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) if (inside(x, y)) { sx = x; sy = y; break outer; }
  const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]; // clockwise from east
  const pts = []; let x = sx, y = sy, dir = 6; // come from the north
  let guard = 0;
  do { pts.push([x, y]); let found = false; for (let k = 0; k < 8; k++) { const d = (dir + 6 + k) % 8; const nx = x + dirs[d][0], ny = y + dirs[d][1]; if (inside(nx, ny)) { x = nx; y = ny; dir = d; found = true; break; } } if (!found) break; guard++; } while (!(x === sx && y === sy) && guard < 2_000_000);
  return pts;
}
function simplify(pts, tol) { if (pts.length < 3) return pts; const sq = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2; const dseg = (p, a, b) => { const l2 = sq(a, b); if (!l2) return Math.sqrt(sq(p, a)); let t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / l2; t = Math.max(0, Math.min(1, t)); return Math.sqrt(sq(p, [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])])); }; const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const st = [[0, pts.length - 1]]; while (st.length) { const [i, j] = st.pop(); let dmax = 0, idx = -1; for (let k = i + 1; k < j; k++) { const d = dseg(pts[k], pts[i], pts[j]); if (d > dmax) { dmax = d; idx = k; } } if (dmax > tol && idx > 0) { keep[idx] = 1; st.push([i, idx], [idx, j]); } } return pts.filter((_, k) => keep[k]); }
const out = [];
for (const c of big) { const contour = traceContour(c.id, c.bbox); const simp = simplify(contour, 1.5 * pxPerCm); const cm = simp.map(([x, y]) => [+(x / pxPerCm).toFixed(1), +(y / pxPerCm).toFixed(1)]); out.push({ id: `wall-${out.length + 1}`, area_cm2: +(c.area / (pxPerCm * pxPerCm)).toFixed(0), bbox_cm: c.bbox.map((v) => +(v / pxPerCm).toFixed(1)), vertices: cm.length, polygon_cm: cm }); }
fs.writeFileSync(outJson, JSON.stringify({ source: path.basename(inp), px_per_cm: pxPerCm, width_cm: +(W / pxPerCm).toFixed(1), height_cm: +(H / pxPerCm).toFixed(1), threshold: [LO, HI], min_area_px: MIN_AREA, walls: out }, null, 1));
for (const w of out) console.log(w.id.padEnd(9), "area", String(w.area_cm2).padStart(7), "cm²  bbox", JSON.stringify(w.bbox_cm), "verts", w.vertices);
// overlay
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`;
for (const w of out) { const d = w.polygon_cm.map(([x, y], i) => `${i ? "L" : "M"}${(x * pxPerCm).toFixed(1)},${(y * pxPerCm).toFixed(1)}`).join(" ") + " Z"; svg += `<path d="${d}" fill="rgba(255,0,0,0.25)" stroke="#f00" stroke-width="3"/>`; for (const [x, y] of w.polygon_cm) svg += `<circle cx="${x * pxPerCm}" cy="${y * pxPerCm}" r="6" fill="#00f"/>`; const [bx, by] = w.polygon_cm[0]; svg += `<text x="${bx * pxPerCm + 10}" y="${by * pxPerCm - 10}" font-size="40" fill="#060" font-family="Arial">${w.id}</text>`; }
svg += `</svg>`;
const buf = await sharp(inp).composite([{ input: Buffer.from(svg), left: 0, top: 0 }]).png().toBuffer(); await sharp(buf).resize({ width: 1800 }).png().toFile(outPng); console.log("overlay", outPng);
