// trace-rooms.mjs <plan-crop.png> <pxPerCm> <config.json> <outJson> <outPng>
// Semi-automatic trace of a clean CAD sales plan: barriers = the mid-grey wall fill (morphologically closed)
// + the drawing's black lines (walls' outlines, glazing, door leaves and swing arcs) + virtual bars from the config;
// a 4-connected flood from each camera gives its room region; an opening of radius R removes glyph notches and
// swing-arc slivers; the outer contour is traced and simplified. Doorways between linked rooms = the overlap of
// the two regions each dilated by a few px. Walls = the closed grey mask's components. Output in cm, crop frame (y down).
import path from "node:path"; import fs from "node:fs"; import crypto from "node:crypto"; import { fileURLToPath } from "node:url"; import { appRequire } from "./app-require.mjs";
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", ".."); const sharp = appRequire(REPO)("sharp");
const [, , inp, pxPerCmS, cfgPath, outJson, outPng] = process.argv; const pxPerCm = Number(pxPerCmS);
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
const { data, info } = await sharp(inp).greyscale().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, N = W * H;
const cm2px = (c) => Math.round(c * pxPerCm);
// --- masks
const grey = new Uint8Array(N), black = new Uint8Array(N);
for (let i = 0; i < N; i++) { const v = data[i]; if (v >= 70 && v <= 150) grey[i] = 1; else if (v < 70) black[i] = 1; }
function dilate(src, r) { const out = new Uint8Array(N); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!src[i]) continue; for (let dy = -r; dy <= r; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue; for (let dx = -r; dx <= r; dx++) { const xx = x + dx; if (xx < 0 || xx >= W) continue; out[yy * W + xx] = 1; } } } return out; }
function erode(src, r) { const inv = new Uint8Array(N); for (let i = 0; i < N; i++) inv[i] = src[i] ? 0 : 1; const d = dilate(inv, r); const out = new Uint8Array(N); for (let i = 0; i < N; i++) out[i] = d[i] ? 0 : 1; return out; }
// thin strokes are anti-aliased into the grey band too, so: walls = the grey band OPENED (r=2 drops strokes up to ~4 px)
// then CLOSED (r=3 heals the outlines drawn through the fill); strokes = everything dark that is not a wall.
const greyClosed = erode(dilate(dilate(erode(grey, 2), 2), 3), 3);
const wallHalo = dilate(greyClosed, 1);
const stroke = new Uint8Array(N); for (let i = 0; i < N; i++) stroke[i] = ((grey[i] || black[i]) && !wallHalo[i]) ? 1 : 0;
for (let i = 0; i < N; i++) black[i] = stroke[i]; // from here on "black" means any thin stroke
{ // strokes inside the listed boxes (bathroom interiors: fixtures, their dimension lines) are ignored unless within 14 px of a wall
  const nw = dilate(greyClosed, 14); let removed = 0;
  for (const b of cfg.stroke_ignore_boxes || []) { const [x0, y0, x1, y1] = b.map((v) => cm2px(v)); for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) { const i = y * W + x; if (black[i] && !nw[i]) { black[i] = 0; removed++; } } }
  if (removed) console.log(`stroke_ignore_boxes removed ${removed} stroke pixels`);
}
// strokes count as barriers only NEAR walls (door leaves, jambs, outlines); dimension lines, hatches and glazing far from
// walls are dropped, and the glazing comes back from the kept line components / the config's manual lines.
// barriers = walls + every stroke component that TOUCHES a wall (door leaves and swing arcs, glazing, jambs, fixtures),
// except the ids the config blacklists (dimension lines, counters, fixture outlines); far strokes (text, hatches) are not.
const NEAR = cfg.near_wall_px ?? 14; const nearWall = dilate(greyClosed, NEAR);
// strokes are CUT where they meet walls (4 px) so that each line, leaf+arc, glazing piece and dimension line is its own
// component; "touches" = any pixel within 7 px of a wall (measured before the cut). A straight single stroke >= 100 cm
// (pixel count per unit length under the straightness bound) is a dimension line and is dropped automatically.
const CUT = cfg.cut_px ?? 8; const cutHalo = dilate(greyClosed, CUT), touchHalo = dilate(greyClosed, CUT + 4);
const barrier = new Uint8Array(N);
for (let i = 0; i < N; i++) barrier[i] = greyClosed[i];
const strokeComps = []; const strokeLab = new Int32Array(N); let dblGlobal = null;
{
  let nl = 0; const st = new Int32Array(N); const blacklist = new Set(cfg.blacklist_strokes || []); const whitelist = new Set(cfg.whitelist_strokes || []);
  // DOUBLE lines (glazing, railings: two parallel strokes 4-9 px apart) vs SINGLE lines (door leaves, dimension lines,
  // hatches): a box count of stroke pixels in an 11x11 window separates them (a 2 px single line ~ 22, a double ~ 44).
  const R = 5; const integ = new Float64Array((W + 1) * (H + 1));
  for (let y = 1; y <= H; y++) { let row = 0; for (let x = 1; x <= W; x++) { row += black[(y - 1) * W + (x - 1)]; integ[y * (W + 1) + x] = integ[(y - 1) * (W + 1) + x] + row; } }
  const boxCount = (x, y) => { const x0 = Math.max(0, x - R), y0 = Math.max(0, y - R), x1 = Math.min(W, x + R + 1), y1 = Math.min(H, y + R + 1); return integ[y1 * (W + 1) + x1] - integ[y0 * (W + 1) + x1] - integ[y1 * (W + 1) + x0] + integ[y0 * (W + 1) + x0]; };
  const DOUBLE = cfg.double_count_min ?? 32; const dbl = new Uint8Array(N); let ndbl = 0; dblGlobal = dbl;
  const ignoreBoxes = (cfg.double_ignore_boxes || []).map((b) => b.map((v) => cm2px(v)));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (black[i] && boxCount(x, y) >= DOUBLE) { let ign = false; for (const [x0, y0, x1, y1] of ignoreBoxes) if (x >= x0 && x <= x1 && y >= y0 && y <= y1) { ign = true; break; } if (ign) continue; dbl[i] = 1; ndbl++; } }
  // double pixels are barriers when their stroke network (uncut) touches a wall; single pixels go through the component rules
  { const lab = new Int32Array(N); let n2 = 0; const keepLab2 = new Set(); for (let s = 0; s < N; s++) { if (!black[s] || lab[s]) continue; n2++; let sp = 0; st[sp++] = s; lab[s] = n2; let touches = false, hasDbl = false; while (sp) { const i = st[--sp]; const x = i % W; if (touchHalo[i]) touches = true; if (dbl[i]) hasDbl = true; for (const d of [-1, 1, -W, W, -W - 1, -W + 1, W - 1, W + 1]) { const j = i + d; if (j < 0 || j >= N || Math.abs((j % W) - x) > 1) continue; if (black[j] && !lab[j]) { lab[j] = n2; st[sp++] = j; } } } if (touches && hasDbl) keepLab2.add(n2); }
    let kd = 0; for (let i = 0; i < N; i++) if (dbl[i] && keepLab2.has(lab[i])) { barrier[i] = 1; kd++; } const bd = dilate(barrier, 1); for (let i = 0; i < N; i++) if (bd[i] && black[i]) barrier[i] = 1; console.log(`DOUBLE-line pixels ${ndbl}, kept as barriers ${kd}`); }
  const single = new Uint8Array(N); for (let i = 0; i < N; i++) single[i] = (black[i] && !dbl[i]) ? 1 : 0;
  const cut = new Uint8Array(N); for (let i = 0; i < N; i++) cut[i] = (single[i] && !cutHalo[i]) ? 1 : 0;
  for (let s = 0; s < N; s++) { if (!cut[s] || strokeLab[s]) continue; nl++; let sp = 0; st[sp++] = s; strokeLab[s] = nl; let cnt = 0, touches = false, minx = W, miny = H, maxx = 0, maxy = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0; while (sp) { const i = st[--sp]; cnt++; const x = i % W, y = (i / W) | 0; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; if (touchHalo[i]) touches = true; for (const d of [-1, 1, -W, W, -W - 1, -W + 1, W - 1, W + 1]) { const j = i + d; if (j < 0 || j >= N || Math.abs((j % W) - x) > 1) continue; if (cut[j] && !strokeLab[j]) { strokeLab[j] = nl; st[sp++] = j; } } }
    const mx = sx / cnt, my = sy / cnt; const vxx = sxx / cnt - mx * mx, vyy = syy / cnt - my * my, vxy = sxy / cnt - mx * my; const tr = vxx + vyy, det = vxx * vyy - vxy * vxy; const disc = Math.sqrt(Math.max(0, tr * tr / 4 - det)); const l1 = tr / 2 + disc, l2 = Math.max(0, tr / 2 - disc); const elong = l1 > 0 ? Math.sqrt(l2 / l1) : 0;
    const diagPx = Math.hypot(maxx - minx, maxy - miny); strokeComps.push({ lab: nl, cnt, touches, bbox_cm: [minx, miny, maxx, maxy].map((v) => +(v / pxPerCm).toFixed(0)), diag_cm: +(diagPx / pxPerCm).toFixed(0), density: +(cnt / Math.max(1, diagPx)).toFixed(2), elong: +elong.toFixed(3) }); }
  strokeComps.sort((a, b) => b.diag_cm - a.diag_cm); strokeComps.forEach((c, i) => (c.id = `st-${i + 1}`));
  const keepLab = new Set(); let autoDropped = 0;
  for (const c of strokeComps) { c.dimension_like = c.diag_cm >= (cfg.dimension_min_cm ?? 100) && c.elong <= (cfg.straight_elong_max ?? 0.06); if (c.dimension_like && !whitelist.has(c.id)) autoDropped++; c.keep = whitelist.has(c.id) || (c.touches && !blacklist.has(c.id) && !c.dimension_like && c.diag_cm >= (cfg.stroke_min_cm ?? 8)); if (c.keep) keepLab.add(c.lab); }
  const keepMask = new Uint8Array(N); for (let i = 0; i < N; i++) if (cut[i] && keepLab.has(strokeLab[i])) keepMask[i] = 1;
  // the kept strokes get their wall contact back: dilate by CUT+1 inside the near-wall band so a cut stroke reconnects
  const keepD = dilate(keepMask, CUT + 1); for (let i = 0; i < N; i++) if (keepD[i] && (nearWall[i] || keepMask[i])) barrier[i] = 1;
  const keepD1 = dilate(keepMask, 1); for (let i = 0; i < N; i++) if (keepD1[i]) barrier[i] = 1;
  console.log(`STROKES ${strokeComps.length} components (cut at walls); touching ${strokeComps.filter((c) => c.touches).length}; kept ${keepLab.size}; auto-dropped straight >= 100 cm ${autoDropped}; blacklisted ${blacklist.size}`);
  for (const c of strokeComps.filter((c) => c.touches && c.diag_cm >= 40).slice(0, 80)) console.log(`  ${c.id.padEnd(6)} diag ${String(c.diag_cm).padStart(5)} cm  px ${String(c.cnt).padStart(6)} elong ${String(c.elong).padStart(6)}  bbox ${JSON.stringify(c.bbox_cm)}${c.keep ? "" : c.dimension_like ? "  (straight line, dropped)" : "  (not a barrier)"}`);
}
function drawBar(a, b, w) { const ax = cm2px(a[0]), ay = cm2px(a[1]), bx = cm2px(b[0]), by = cm2px(b[1]); const len = Math.hypot(bx - ax, by - ay); const n = Math.ceil(len); for (let k = 0; k <= n; k++) { const x = Math.round(ax + (bx - ax) * k / n), y = Math.round(ay + (by - ay) * k / n); for (let dy = -w; dy <= w; dy++) for (let dx = -w; dx <= w; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H) barrier[yy * W + xx] = 1; } } }
for (const bar of cfg.bars || []) drawBar(bar.a, bar.b, bar.width_px ?? 3);
for (const line of cfg.lines || []) for (let k = 0; k + 1 < line.points.length; k++) drawBar(line.points[k], line.points[k + 1], line.width_px ?? 2);
// thin black lines far from walls (glazing, railings, dimension lines, hatches, arcs, text): components listed with ids;
// the config's keep_line_components names the ones that are real boundaries (glazing, railing) -> barriers + glass footprints
const lineComps = [];
{
  const far = new Uint8Array(N); for (let i = 0; i < N; i++) far[i] = (black[i] && !nearWall[i]) ? 1 : 0;
  const lab3 = new Int32Array(N); let nl3 = 0; const st3 = new Int32Array(N);
  for (let s = 0; s < N; s++) { if (!far[s] || lab3[s]) continue; nl3++; let sp = 0; st3[sp++] = s; lab3[s] = nl3; let cnt = 0, minx = W, miny = H, maxx = 0, maxy = 0; while (sp) { const i = st3[--sp]; cnt++; const x = i % W, y = (i / W) | 0; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; for (const d of [-1, 1, -W, W, -W - 1, -W + 1, W - 1, W + 1]) { const j = i + d; if (j < 0 || j >= N || Math.abs((j % W) - x) > 1) continue; if (far[j] && !lab3[j]) { lab3[j] = nl3; st3[sp++] = j; } } }
    const diag = Math.hypot(maxx - minx, maxy - miny) / pxPerCm; if (diag >= (cfg.line_min_cm ?? 60)) lineComps.push({ lab: nl3, cnt, bbox_cm: [minx, miny, maxx, maxy].map((v) => +(v / pxPerCm).toFixed(0)), diag_cm: +diag.toFixed(0) }); }
  lineComps.sort((a, b) => b.diag_cm - a.diag_cm); lineComps.forEach((c, i) => (c.id = `ln-${i + 1}`));
  const keep = new Set(cfg.keep_line_components || []);
  for (const c of lineComps) { const m = new Uint8Array(N); for (let i = 0; i < N; i++) if (lab3[i] === c.lab) m[i] = 1; const ct = traceContour(m); const sp = simplify(ct, 1.0 * pxPerCm); c.polygon_cm = sp.map(([x, y]) => [+(x / pxPerCm).toFixed(1), +(y / pxPerCm).toFixed(1)]); c.keep = keep.has(c.id); if (c.keep) { const d = dilate(m, 1); for (let i = 0; i < N; i++) if (d[i]) barrier[i] = 1; } }
  console.log(`LINES ${lineComps.length} far-from-wall black components >= ${cfg.line_min_cm ?? 60} cm; kept ${[...keep].length}`);
  for (const c of lineComps.slice(0, 60)) console.log(`  ${c.id.padEnd(6)} diag ${String(c.diag_cm).padStart(5)} cm  px ${String(c.cnt).padStart(6)}  bbox ${JSON.stringify(c.bbox_cm)}${c.keep ? "  KEPT" : ""}`);
}
// automatic door bars: a gap of 60..140 cm between two wall components' vertices, the segment free of wall fill
const autoBars = [];
{
  const lab2 = new Int32Array(N); let nl2 = 0; const comps2 = []; const st2 = new Int32Array(N);
  for (let s = 0; s < N; s++) { if (!greyClosed[s] || lab2[s]) continue; nl2++; let sp = 0; st2[sp++] = s; lab2[s] = nl2; let cnt = 0; const pts = []; while (sp) { const i = st2[--sp]; cnt++; const x = i % W, y = (i / W) | 0; let edge = false; for (const d of [-1, 1, -W, W]) { const j = i + d; if (j < 0 || j >= N || Math.abs((j % W) - x) > 1 || !greyClosed[j]) { edge = true; } else if (!lab2[j]) { lab2[j] = nl2; st2[sp++] = j; } } if (edge && (x + y) % 3 === 0) pts.push([x, y]); } if (cnt >= 1200) comps2.push({ lab: nl2, pts }); }
  const lo = (cfg.door_gap_cm?.[0] ?? 60) * pxPerCm, hi = (cfg.door_gap_cm?.[1] ?? 140) * pxPerCm;
  for (let a = 0; a < comps2.length; a++) for (let b = a + 1; b < comps2.length; b++) {
    let best = null, bd = Infinity; const A = comps2[a].pts, B = comps2[b].pts;
    for (let i = 0; i < A.length; i += 2) for (let j = 0; j < B.length; j += 2) { const d = Math.hypot(A[i][0] - B[j][0], A[i][1] - B[j][1]); if (d < bd) { bd = d; best = [A[i], B[j]]; } }
    if (best && bd >= lo && bd <= hi) { // the segment must not cross wall fill
      let ok = true; const n = Math.ceil(bd); for (let k = 2; k < n - 2; k++) { const x = Math.round(best[0][0] + (best[1][0] - best[0][0]) * k / n), y = Math.round(best[0][1] + (best[1][1] - best[0][1]) * k / n); if (greyClosed[y * W + x]) { ok = false; break; } }
      if (ok) { const A0 = best[0].map((v) => v / pxPerCm), B0 = best[1].map((v) => v / pxPerCm); autoBars.push({ a: A0, b: B0, cm: bd / pxPerCm }); }
    }
  }
  const skip = new Set(cfg.skip_auto_bars || []);
  autoBars.forEach((g, i) => { g.id = `gap-${i + 1}`; if (!skip.has(g.id)) drawBar(g.a, g.b, 3); console.log(`AUTO ${g.id.padEnd(7)} ${g.cm.toFixed(0).padStart(4)} cm  ${g.a.map((v) => v.toFixed(0))} -> ${g.b.map((v) => v.toFixed(0))}${skip.has(g.id) ? "  (skipped)" : ""}`); });
}
// auto-trace (2026-11-04): the barrier mask, for the automatic zone split (tools/auto-trace.mjs runs a watershed on it)
if (cfg.dump_barrier_png) { const m = Buffer.alloc(N); for (let i = 0; i < N; i++) m[i] = barrier[i] ? 255 : 0; await sharp(m, { raw: { width: W, height: H, channels: 1 } }).png().toFile(cfg.dump_barrier_png); console.log(`BARRIER written ${cfg.dump_barrier_png}`); if (cfg.dump_barrier_only) process.exit(0); }
// --- flood fill (4-connected) from a seed
function flood(seedX, seedY, mask, limit) { const reg = new Uint8Array(N); const st = new Int32Array(N); let sp = 0; const s = seedY * W + seedX; if (mask[s]) return { reg, count: 0, leaked: false, msg: "seed on a barrier" }; st[sp++] = s; reg[s] = 1; let count = 0; while (sp) { const i = st[--sp]; count++; if (count > limit) return { reg, count, leaked: true }; const x = i % W; const nb = [i - 1, i + 1, i - W, i + W]; for (let k = 0; k < 4; k++) { const j = nb[k]; if (j < 0 || j >= N) continue; if (k === 0 && x === 0) continue; if (k === 1 && x === W - 1) continue; if (!mask[j] && !reg[j]) { reg[j] = 1; st[sp++] = j; } } } return { reg, count, leaked: false }; }
// --- component containing a point (4-conn), contour, simplify
function componentOf(mask, sx, sy) { const r = flood(sx, sy, invertMask(mask), N); return r.reg; }
function invertMask(m) { const o = new Uint8Array(N); for (let i = 0; i < N; i++) o[i] = m[i] ? 0 : 1; return o; }
function traceContour(reg) { let sx = -1, sy = -1; outer: for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (reg[y * W + x]) { sx = x; sy = y; break outer; } const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H && reg[y * W + x] === 1; const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]; const pts = []; let x = sx, y = sy, dir = 6, guard = 0; do { pts.push([x, y]); let found = false; for (let k = 0; k < 8; k++) { const d = (dir + 6 + k) % 8; const nx = x + dirs[d][0], ny = y + dirs[d][1]; if (inside(nx, ny)) { x = nx; y = ny; dir = d; found = true; break; } } if (!found) break; guard++; } while (!(x === sx && y === sy) && guard < 3_000_000); return pts; }
function simplify(pts, tol) { if (pts.length < 3) return pts; const sq = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2; const dseg = (p, a, b) => { const l2 = sq(a, b); if (!l2) return Math.sqrt(sq(p, a)); let t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / l2; t = Math.max(0, Math.min(1, t)); return Math.sqrt(sq(p, [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])])); }; const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const st = [[0, pts.length - 1]]; while (st.length) { const [i, j] = st.pop(); let dmax = 0, idx = -1; for (let k = i + 1; k < j; k++) { const d = dseg(pts[k], pts[i], pts[j]); if (d > dmax) { dmax = d; idx = k; } } if (dmax > tol && idx > 0) { keep[idx] = 1; st.push([i, idx], [idx, j]); } } return pts.filter((_, k) => keep[k]); }
function shoelace(poly) { let a = 0; for (let i = 0; i < poly.length; i++) { const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length]; a += x1 * y2 - x2 * y1; } return a / 2; }
// --- rooms
const R = cfg.open_radius_px ?? 5; const rooms = []; const regions = {}; let fallbackLab = null;
for (const cam of cfg.cameras) {
  let sx = cm2px(cam.at_cm[0]), sy = cm2px(cam.at_cm[1]);
  if (barrier[sy * W + sx]) { // the camera sits on a drawn line: take the nearest free pixel within 40 px
    let best = null; for (let r = 1; r <= 40 && !best; r++) for (let dy = -r; dy <= r && !best; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const xx = sx + dx, yy = sy + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && !barrier[yy * W + xx]) { best = [xx, yy]; break; } }
    if (best) { console.log(`ROOM ${cam.id}: seed moved ${Math.hypot(best[0] - sx, best[1] - sy).toFixed(0)} px off a line`); [sx, sy] = best; }
  }
  let f = flood(sx, sy, barrier, Math.round(N * 0.35));
  if ((f.leaked || f.count === 0) && cfg.fallback_labels_png) { // auto-trace: the geodesic split's region for this seed (cannot leak)
    if (!fallbackLab) { const r = await sharp(cfg.fallback_labels_png).raw().toBuffer({ resolveWithObject: true }); fallbackLab = r.data; }
    const k = cfg.cameras.indexOf(cam) + 1; const reg = new Uint8Array(N); let cnt = 0; for (let i = 0; i < N; i++) if (fallbackLab[i] === k && !barrier[i]) { reg[i] = 1; cnt++; }
    if (cnt > 0) { if (!reg[sy * W + sx]) { let best = null, bd = Infinity; for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) { const i = y * W + x; if (reg[i]) { const d = (x - sx) ** 2 + (y - sy) ** 2; if (d < bd) { bd = d; best = [x, y]; } } } if (best) [sx, sy] = best; } f = { reg, count: cnt, leaked: false, fallback: true }; console.log(`ROOM ${cam.id}: flood leaked, region taken from the geodesic split (${cnt} px)`); }
  }
  if (f.leaked || f.count === 0) { console.log(`ROOM ${cam.id}: ${f.leaked ? "LEAKED" : f.msg}`); continue; }
  // open (erode R, dilate R) then keep the component containing the camera
  let reg = dilate(erode(f.reg, R), R); if (!reg[sy * W + sx]) reg = f.reg; // if the camera fell off after opening, keep the raw region
  const comp = componentOf(reg, sx, sy);
  const contour = traceContour(comp); const simp = simplify(contour, (cfg.simplify_cm ?? 3) * pxPerCm);
  let poly = simp.map(([x, y]) => [+(x / pxPerCm).toFixed(1), +(y / pxPerCm).toFixed(1)]);
  if (poly.length > 1 && poly[0][0] === poly[poly.length - 1][0] && poly[0][1] === poly[poly.length - 1][1]) poly.pop();
  if (cam.hull) { // convex hull (monotone chain) for small convex rooms whose fixtures notch the region
    const pts = [...poly].sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = []; for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
    const upper = []; for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
    upper.pop(); lower.pop(); poly = lower.concat(upper); console.log(`ROOM ${cam.id}: convex hull, ${poly.length} vertices`);
  }
  if (shoelace(poly) < 0) poly.reverse(); // positive orientation in the y-down frame (the validator convention)
  const area = shoelace(poly) / 1e4;
  regions[cam.id] = comp;
  rooms.push({ id: cam.room_id || `r-${cam.id}`, camera: cam.id, name_he: cam.name_he, name_en: cam.name_en, type: cam.type, is_outdoor: !!cam.is_outdoor, loop: poly, area_m2: +area.toFixed(3), region_px: f.count, vertices: poly.length });
  console.log(`ROOM ${cam.id.padEnd(16)} region ${String(f.count).padStart(8)} px  area ${area.toFixed(2)} m²  verts ${poly.length}`);
}
// --- doorways between linked cameras
const openings = []; const D = cfg.door_dilate_px ?? 5;
const dil = {}; for (const id of Object.keys(regions)) dil[id] = dilate(regions[id], D);
const seenPair = new Set(); const ids = Object.keys(regions);
for (const camId of ids) for (const to of ids) {
  if (camId >= to) continue; const cam = { id: camId };
  const key = [cam.id, to].sort().join("|"); if (seenPair.has(key)) continue; seenPair.add(key);
  if (!dil[cam.id] || !dil[to]) continue;
  const pts = []; for (let i = 0; i < N; i++) if (dil[cam.id][i] && dil[to][i]) pts.push([i % W, (i / W) | 0]);
  if (pts.length < 40) continue;
  // principal axis of the contact blob
  let mx = 0, my = 0; for (const [x, y] of pts) { mx += x; my += y; } mx /= pts.length; my /= pts.length;
  let sxx = 0, syy = 0, sxy = 0; for (const [x, y] of pts) { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); }
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy); const ux = Math.cos(ang), uy = Math.sin(ang);
  let tmin = Infinity, tmax = -Infinity; for (const [x, y] of pts) { const t = (x - mx) * ux + (y - my) * uy; if (t < tmin) tmin = t; if (t > tmax) tmax = t; }
  const a = [mx + ux * tmin, my + uy * tmin], b = [mx + ux * tmax, my + uy * tmax];
  const width = (tmax - tmin) / pxPerCm;
  openings.push({ id: `o-${cam.id}-${to}`, rooms: [cam.id, to], a_cm: a.map((v) => +(v / pxPerCm).toFixed(1)), b_cm: b.map((v) => +(v / pxPerCm).toFixed(1)), centre_cm: [+(mx / pxPerCm).toFixed(1), +(my / pxPerCm).toFixed(1)], angle_deg: +((ang * 180) / Math.PI).toFixed(1), width_cm: +width.toFixed(1), contact_px: pts.length });
  console.log(`DOOR ${key.padEnd(30)} width ${width.toFixed(0).padStart(4)} cm  centre ${(mx / pxPerCm).toFixed(0)},${(my / pxPerCm).toFixed(0)}  angle ${((ang * 180) / Math.PI).toFixed(0)}°  px ${pts.length}`);
}
// --- glazing: the kept double-line pixels as thin footprints (components of barrier ∧ double, >= 60 cm)
const glazing = [];
{
  const g = new Uint8Array(N); for (let i = 0; i < N; i++) g[i] = (barrier[i] && !greyClosed[i] && dblGlobal[i]) ? 1 : 0;
  const lab = new Int32Array(N); let n = 0; const st = new Int32Array(N);
  for (let s = 0; s < N; s++) { if (!g[s] || lab[s]) continue; n++; let sp = 0; st[sp++] = s; lab[s] = n; let cnt = 0, minx = W, miny = H, maxx = 0, maxy = 0; while (sp) { const i = st[--sp]; cnt++; const x = i % W, y = (i / W) | 0; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; for (const d of [-1, 1, -W, W, -W - 1, -W + 1, W - 1, W + 1]) { const j = i + d; if (j < 0 || j >= N || Math.abs((j % W) - x) > 1) continue; if (g[j] && !lab[j]) { lab[j] = n; st[sp++] = j; } } }
    const diag = Math.hypot(maxx - minx, maxy - miny) / pxPerCm; if (diag < 60) continue; const m = new Uint8Array(N); for (let i = 0; i < N; i++) if (lab[i] === n) m[i] = 1; const c = traceContour(m); const sp2 = simplify(c, 1.0 * pxPerCm); glazing.push({ id: `gl-${glazing.length + 1}`, diag_cm: +diag.toFixed(0), px: cnt, bbox_cm: [minx, miny, maxx, maxy].map((v) => +(v / pxPerCm).toFixed(0)), polygon_cm: sp2.map(([x, y]) => [+(x / pxPerCm).toFixed(1), +(y / pxPerCm).toFixed(1)]) }); }
  // keep a footprint only if it touches the outside (the sheet's free area) or an outdoor room; railing = outdoor/outside on both sides and no indoor room
  const outside = flood(5, 5, barrier, N).reg; const outdoorIds = cfg.cameras.filter((c) => c.is_outdoor).map((c) => c.id); const indoorIds = cfg.cameras.filter((c) => !c.is_outdoor).map((c) => c.id);
  // per-pixel adjacency: an indoor room within 12 px -> facade pane; else an outdoor room within 12 px -> railing; else screen (dropped)
  const indoorNear = new Uint8Array(N), outdoorNear = new Uint8Array(N);
  { const ind = new Uint8Array(N), outd = new Uint8Array(N); for (const id of indoorIds) if (regions[id]) for (let i = 0; i < N; i++) if (regions[id][i]) ind[i] = 1; for (const id of outdoorIds) if (regions[id]) for (let i = 0; i < N; i++) if (regions[id][i]) outd[i] = 1; const di = dilate(ind, 12), dO = dilate(outd, 12); for (let i = 0; i < N; i++) { indoorNear[i] = di[i]; outdoorNear[i] = dO[i]; } }
  const panes = []; const wallBand = dilate(greyClosed, 5);
  for (const gz of glazing) { const gl = glazing.indexOf(gz) + 1;
    // the network must touch the outside or an outdoor room (wall outlines, closets and counters do not)
    { const m = new Uint8Array(N); for (let i = 0; i < N; i++) if (lab[i] === gl) m[i] = 1; const d = dilate(m, 8); let tOut = false, tOutdoor = false; for (let i = 0; i < N; i++) { if (!d[i]) continue; if (outside[i]) { tOut = true; } if (outdoorNear[i] && !indoorNear[i]) tOutdoor = true; } gz.touch = { outside: tOut, outdoor: tOutdoor }; if (!tOut && !tOutdoor) { console.log(`  ${gz.id}: touches neither the outside nor a terrace, dropped (${gz.diag_cm} cm, bbox ${JSON.stringify(gz.bbox_cm)})`); continue; } }
    const fac = new Uint8Array(N), rail = new Uint8Array(N); let nf = 0, nr = 0, ns = 0, nw = 0; for (let i = 0; i < N; i++) { if (lab[i] !== gl) continue; if (wallBand[i]) { nw++; continue; } if (indoorNear[i]) { fac[i] = 1; nf++; } else if (outdoorNear[i]) { rail[i] = 1; nr++; } else ns++; } gz.split = { facade_px: nf, railing_px: nr, screen_px: ns, in_wall_px: nw };
    for (const [mask, kind] of [[fac, "facade"], [rail, "railing"]]) { // components of each sub-mask >= 40 cm
      const l2 = new Int32Array(N); let n2 = 0; const st2 = new Int32Array(N); for (let s = 0; s < N; s++) { if (!mask[s] || l2[s]) continue; n2++; let sp = 0; st2[sp++] = s; l2[s] = n2; let minx = W, miny = H, maxx = 0, maxy = 0, cnt = 0; while (sp) { const i = st2[--sp]; cnt++; const x = i % W, y = (i / W) | 0; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; for (const d of [-1, 1, -W, W, -W - 1, -W + 1, W - 1, W + 1]) { const j = i + d; if (j < 0 || j >= N || Math.abs((j % W) - x) > 1) continue; if (mask[j] && !l2[j]) { l2[j] = n2; st2[sp++] = j; } } } const diag = Math.hypot(maxx - minx, maxy - miny) / pxPerCm; if (diag < 40) continue; const m2 = new Uint8Array(N); for (let i = 0; i < N; i++) if (l2[i] === n2) m2[i] = 1; const c2 = traceContour(m2); const s2 = simplify(c2, 1.0 * pxPerCm); panes.push({ id: `${kind}-${panes.length + 1}`, kind, from: gz.id, diag_cm: +diag.toFixed(0), bbox_cm: [minx, miny, maxx, maxy].map((v) => +(v / pxPerCm).toFixed(0)), polygon_cm: s2.map(([x, y]) => [+(x / pxPerCm).toFixed(1), +(y / pxPerCm).toFixed(1)]) }); } }
  }
  // per pane: >= 60 cm, must itself touch the outside or a terrace; kind overrides by position
  const kept = [];
  for (const p of panes) { if (p.diag_cm < 60) continue; const m = new Uint8Array(N); const [x0, y0, x1, y1] = p.bbox_cm.map((v) => cm2px(v)); let t = false; for (let y = Math.max(0, y0 - 10); y <= Math.min(H - 1, y1 + 10) && !t; y++) for (let x = Math.max(0, x0 - 10); x <= Math.min(W - 1, x1 + 10); x++) { const i = y * W + x; if (outside[i] || (outdoorNear[i] && !indoorNear[i])) { t = true; break; } } if (!t) { console.log(`  ${p.id}: interior, dropped`); continue; }
    const cx = (p.bbox_cm[0] + p.bbox_cm[2]) / 2, cy = (p.bbox_cm[1] + p.bbox_cm[3]) / 2; for (const o of cfg.pane_kind_boxes || []) if (cx >= o.box[0] && cx <= o.box[2] && cy >= o.box[1] && cy <= o.box[3]) { p.kind_override = o.kind; p.kind = o.kind; } kept.push(p); }
  kept.forEach((p, i) => (p.id = `${p.kind}-${i + 1}`));
  console.log(`GLAZING ${glazing.length} double-line networks -> ${kept.length} panes`); for (const p of kept) console.log(`  ${p.id.padEnd(12)} ${p.kind.padEnd(8)} diag ${String(p.diag_cm).padStart(5)} cm  bbox ${JSON.stringify(p.bbox_cm)}  verts ${p.polygon_cm.length}${p.kind_override ? "  (override)" : ""}`);
  glazing.length = 0; for (const p of kept) glazing.push(p);
}
// --- openings: drop tiny contacts; add the automatic wall gaps with their rooms resolved by sampling both sides
for (let k = openings.length - 1; k >= 0; k--) if (openings[k].width_cm < (cfg.opening_min_cm ?? 60)) { console.log(`DOOR ${openings[k].id}: ${openings[k].width_cm} cm, dropped`); openings.splice(k, 1); }
const roomAt = (x, y) => { const px = cm2px(x), py = cm2px(y); if (px < 0 || py < 0 || px >= W || py >= H) return null; for (const id of Object.keys(regions)) if (regions[id][py * W + px]) return id; return null; };
for (const g of autoBars) {
  const mx = (g.a[0] + g.b[0]) / 2, my = (g.a[1] + g.b[1]) / 2; const dx = g.b[0] - g.a[0], dy = g.b[1] - g.a[1]; const L = Math.hypot(dx, dy) || 1; const nx = -dy / L, ny = dx / L;
  let A = null, B = null; for (const d of [12, 20, 30, 45]) { A = A || roomAt(mx + nx * d, my + ny * d); B = B || roomAt(mx - nx * d, my - ny * d); }
  const pair = [A || "outside", B || "outside"]; const dup = openings.find((o) => Math.hypot(o.centre_cm[0] - mx, o.centre_cm[1] - my) < 60);
  if (dup) { dup.width_cm = +g.cm.toFixed(1); dup.a_cm = g.a.map((v) => +v.toFixed(1)); dup.b_cm = g.b.map((v) => +v.toFixed(1)); dup.source = "wall-gap"; console.log(`DOOR ${dup.id}: width set from the wall gap ${g.id} = ${g.cm.toFixed(0)} cm`); continue; }
  if (pair[0] === pair[1]) { console.log(`GAP ${g.id}: both sides ${pair[0]}, skipped`); continue; }
  if (pair.includes("outside") && g.id !== (cfg.front_door_gap || "gap-2")) { console.log(`GAP ${g.id}: ${pair.join("|")} is not a door (an outdoor passage), skipped`); continue; }
  openings.push({ id: `o-${pair[0]}-${pair[1]}`, rooms: pair, a_cm: g.a.map((v) => +v.toFixed(1)), b_cm: g.b.map((v) => +v.toFixed(1)), centre_cm: [+mx.toFixed(1), +my.toFixed(1)], angle_deg: +((Math.atan2(dy, dx) * 180) / Math.PI).toFixed(1), width_cm: +g.cm.toFixed(1), contact_px: 0, source: "wall-gap" });
  console.log(`DOOR ${pair.join("|").padEnd(30)} width ${g.cm.toFixed(0).padStart(4)} cm  from the wall gap ${g.id}`);
}
// --- walls from the closed grey mask
const label = new Int32Array(N); let nl = 0; const walls = []; const stck = new Int32Array(N);
for (let s = 0; s < N; s++) { if (!greyClosed[s] || label[s]) continue; nl++; let sp = 0; stck[sp++] = s; label[s] = nl; let cnt = 0; while (sp) { const i = stck[--sp]; cnt++; const x = i % W; for (const d of [-1, 1, -W, W, -W - 1, -W + 1, W - 1, W + 1]) { const j = i + d; if (j < 0 || j >= N) continue; if (Math.abs((j % W) - x) > 1) continue; if (greyClosed[j] && !label[j]) { label[j] = nl; stck[sp++] = j; } } } if (cnt >= 1200) walls.push({ lab: nl, cnt }); }
for (const w of walls) { const m = new Uint8Array(N); for (let i = 0; i < N; i++) if (label[i] === w.lab) m[i] = 1; const c = traceContour(m); const s = simplify(c, 1.5 * pxPerCm); let poly = s.map(([x, y]) => [+(x / pxPerCm).toFixed(1), +(y / pxPerCm).toFixed(1)]); if (poly.length > 1 && poly[0][0] === poly[poly.length - 1][0] && poly[0][1] === poly[poly.length - 1][1]) poly.pop(); w.poly = poly; }
console.log(`WALLS ${walls.length} components after closing`);
// --- edge kinds per room edge: wall if grey within 8 px outward of the edge midpoint, else glazing/open
for (const r of rooms) { r.edge_kinds = []; const L = r.loop.length; for (let i = 0; i < L; i++) { const [x1, y1] = r.loop[i], [x2, y2] = r.loop[(i + 1) % L]; const mx = (x1 + x2) / 2, my = (y1 + y2) / 2; const ex = x2 - x1, ey = y2 - y1; const len = Math.hypot(ex, ey) || 1; const nx = ey / len, ny = -ex / len; // outward for a positively oriented loop in y-down? check both sides
    let kind = "open"; for (const sgn of [1, -1]) { for (const d of [4, 8, 12, 16]) { const px = cm2px(mx + sgn * nx * d / pxPerCm), py = cm2px(my + sgn * ny * d / pxPerCm); if (px >= 0 && py >= 0 && px < W && py < H) { if (greyClosed[py * W + px]) { kind = "wall"; break; } if (black[py * W + px]) kind = kind === "wall" ? "wall" : "line"; } } if (kind === "wall") break; } r.edge_kinds.push(kind); } }
// --- the draft general plan (schema v0.2.0 draft, geometry "general"): rooms, wall pieces from the open-only extraction, openings, panes, cameras
if (cfg.export_plan) {
  // auto-trace (2026-11-04): without a pre-extracted walls file, the wall pieces are the components of the grey-fill mask
  let wallsX;
  if (cfg.walls_extracted && fs.existsSync(cfg.walls_extracted) && !cfg.walls_recompute) wallsX = JSON.parse(fs.readFileSync(cfg.walls_extracted, "utf8")).walls;
  else {
    wallsX = []; const labW = new Int32Array(N); const stW = new Int32Array(N); let nW = 0;
    for (let s0 = 0; s0 < N; s0++) { if (!greyClosed[s0] || labW[s0]) continue; nW++; let sp = 0; stW[sp++] = s0; labW[s0] = nW; let cnt = 0; const m = new Uint8Array(N); while (sp) { const i = stW[--sp]; cnt++; m[i] = 1; const x = i % W; for (const d of [-1, 1, -W, W]) { const j = i + d; if (j < 0 || j >= N || Math.abs((j % W) - x) > 1) continue; if (greyClosed[j] && !labW[j]) { labW[j] = nW; stW[sp++] = j; } } }
      if (cnt < 400) continue; const ct = traceContour(m); const sp2 = simplify(ct, 1.0 * pxPerCm); let poly = sp2.map(([x, y]) => [+(x / pxPerCm).toFixed(1), +(y / pxPerCm).toFixed(1)]); if (poly.length > 1 && poly[0][0] === poly[poly.length - 1][0] && poly[0][1] === poly[poly.length - 1][1]) poly.pop(); if (poly.length < 3) continue; if (shoelace(poly) < 0) poly.reverse(); wallsX.push({ polygon_cm: poly, area_cm2: Math.round(cnt / (pxPerCm * pxPerCm)) }); }
    if (cfg.walls_extracted) fs.writeFileSync(cfg.walls_extracted, JSON.stringify({ source: "trace-plan.mjs grey-fill components", walls: wallsX }, null, 1));
    console.log(`WALLS extracted from the grey fill: ${wallsX.length} pieces`);
  }
  const camsSrc = JSON.parse(fs.readFileSync(cfg.cameras_json, "utf8"));
  // doors are snapped onto the nearest wall edge (their traced position is the door leaf, inside the room)
  const wallEdges = []; for (const w of wallsX) for (let i = 0; i < w.polygon_cm.length; i++) wallEdges.push([w.polygon_cm[i], w.polygon_cm[(i + 1) % w.polygon_cm.length]]);
  const nearestOnEdges = ([px, py]) => { let best = null, bd = Infinity; for (const [[ax, ay], [bx, by]] of wallEdges) { const dx = bx - ax, dy = by - ay; const l2 = dx * dx + dy * dy || 1; let t = ((px - ax) * dx + (py - ay) * dy) / l2; t = Math.max(0, Math.min(1, t)); const qx = ax + t * dx, qy = ay + t * dy; const d = Math.hypot(px - qx, py - qy); if (d < bd) { bd = d; best = [qx, qy]; } } return { point: best, dist: bd }; };
  // ⛔ no snapping of doors onto "the nearest wall edge": a door centred in a drawn wall gap is always half a width from the
  // wall ENDS, and the nearest edge is the jamb, so a snap slides the door along its own axis onto solid wall (the builder's
  // Q01b finding, 2026-10-28). A door's ends (a_cm, b_cm) are what must touch the walls; the validator checks them.
  let snapped = 0; for (const o of openings) { if (!o.source && o.width_cm > 150) continue; const da = nearestOnEdges(o.a_cm).dist, db = nearestOnEdges(o.b_cm).dist; o.end_gap_cm = [+da.toFixed(1), +db.toFixed(1)]; if (Math.max(da, db) > 25) console.log(`DOOR ${o.id}: an end is ${Math.max(da, db).toFixed(0)} cm from any wall edge (check the gap)`); }
  console.log(`DOORS kept at their traced centres (${openings.filter((o) => o.source || o.width_cm <= 150).length} real openings), ends checked against the wall edges${snapped ? "" : ""}`);
  const sha256 = (() => { try { return crypto.createHash("sha256").update(fs.readFileSync(inp)).digest("hex"); } catch { return ""; } })();
  const bearing = (from, to) => ((Math.atan2(to[0] - from[0], -(to[1] - from[1])) * 180) / Math.PI + 360) % 360;
  const roomOf = {}; for (const r of rooms) roomOf[r.camera] = r.id;
  const plan = {
    schema_version: "0.2.0-draft", units: "cm", geometry: "general",
    axes: "x right, y down on the plan crop (raster frame, 2.25 px/cm); origin = the crop's top-left; angles are bearings, 0 = up (-y), clockwise",
    apartment_id: cfg.apartment_id || "apt846",
    plan_meta: { source_file: cfg.source_file, source_sha256: cfg.source_sha256 || sha256, tracer: "main session, trace-rooms.mjs (raster: grey fill = walls, double strokes = glazing, wall-connected single strokes = door leaves; zone bars from the config)", trace_date: cfg.trace_date, trace_method: "flood fill from each camera inside a barrier mask built from the drawing; wall footprints from the grey fill (opened, 37 pieces); openings from region contacts and wall-end gaps; panes from double strokes split by adjacency", scale_basis: cfg.scale_basis, scale_px_per_cm: pxPerCm, raster_origin_px: [0, 0], rights_state: cfg.rights_state || "partner-supplied", rights_note: cfg.rights_note || "", ceiling_height_cm: cfg.ceiling_height_cm || 290, floor_height_cm: cfg.floor_height_cm ?? 0, ground_offset_cm: cfg.ground_offset_cm ?? -(cfg.floor_height_cm ?? 0), ground_offset_note: cfg.ground_offset_note || '', floor_height_note: cfg.floor_height_note || "", assumptions: cfg.assumptions || [], disagreements: [], virtual_boundaries: (cfg.bars || []).map((b) => b.name) },
    rooms: rooms.map((r) => { const xs = r.loop.map((p) => p[0]), ys = r.loop.map((p) => p[1]); const bb = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map((v) => +v.toFixed(1)); const c = cfg.cameras.find((c) => c.id === r.camera); return { id: r.id, name_he: r.name_he, name_en: r.name_en, type: r.type, is_outdoor: r.is_outdoor, roofed: r.is_outdoor ? (c.roofed ?? cfg.roofed_outdoor ?? false) : undefined, loop: r.loop, printed_dims_cm: c.printed_dims_cm || null, clear_dims_cm: [+(bb[2] - bb[0]).toFixed(1), +(bb[3] - bb[1]).toFixed(1)], bbox_cm: bb, area_m2: r.area_m2, edge_kinds: r.edge_kinds, note: c.note || null }; }),
    walls: wallsX.map((w, i) => ({ id: `w-${i + 1}`, kind: "interior", height_cm: cfg.ceiling_height_cm || 290, polygon_cm: w.polygon_cm, area_cm2: w.area_cm2 })),
    openings: openings.map((o, i) => { const A = roomOf[o.rooms[0]] || o.rooms[0], B = roomOf[o.rooms[1]] || o.rooms[1]; const virt = o.width_cm > 150 && !o.source; const outsideDoor = o.rooms.includes("outside"); const kind = outsideDoor ? "entrance_door" : virt ? "opening" : o.width_cm >= 150 ? "sliding_door" : "door"; return { id: `o-${i + 1}`, kind, rooms: [A, B], a_cm: o.a_cm, b_cm: o.b_cm, centre_cm: o.centre_cm, angle_deg: o.angle_deg, width_cm: o.width_cm, sill_cm: 0, head_cm: kind === "opening" ? (cfg.ceiling_height_cm || 290) : 215, source: o.source || "region-contact" }; }),
    panes: glazing.map((p) => ({ id: p.id, kind: p.kind, sill_cm: 0, head_cm: p.kind === "railing" ? 110 : (cfg.ceiling_height_cm || 290), polygon_cm: p.polygon_cm, bbox_cm: p.bbox_cm, diag_cm: p.diag_cm })),
    camera_points: camsSrc.scenes.map((s) => { const at = [s.at[0] / pxPerCm, s.at[1] / pxPerCm], la = [s.lookAt[0] / pxPerCm, s.lookAt[1] / pxPerCm]; return { id: `cp-${s.id}`, room_id: roomOf[s.id] || null, x: +at[0].toFixed(1), y: +at[1].toFixed(1), z: cfg.eye_cm || 160, yaw_deg: +bearing(at, la).toFixed(1), note: `from cameras.json ${s.id}` }; }),
    // fixtures (card Q02b, 2026-10-28): the furniture the sales plan DRAWS, read off the sheet by hand into the config as
    // rotated boxes (centre, length along angle_deg from +x toward +y, depth across, base z, height) and exported as
    // positively-oriented loops; the builder extrudes each as a plain placeholder prism so the skin dresses a mass that
    // is where the plan puts it instead of inventing one (the first GPT finals came back with an empty kitchen)
    fixtures: (cfg.fixtures || []).map((f) => { const a = ((f.angle_deg || 0) * Math.PI) / 180; const u = [Math.cos(a), Math.sin(a)], v = [-Math.sin(a), Math.cos(a)]; const [cx, cy] = f.centre_cm; const L = f.length_cm / 2, D = f.depth_cm / 2;
      let poly = [[cx + u[0] * L + v[0] * D, cy + u[1] * L + v[1] * D], [cx - u[0] * L + v[0] * D, cy - u[1] * L + v[1] * D], [cx - u[0] * L - v[0] * D, cy - u[1] * L - v[1] * D], [cx + u[0] * L - v[0] * D, cy + u[1] * L - v[1] * D]].map((p) => [+p[0].toFixed(1), +p[1].toFixed(1)]);
      let s = 0; for (let i = 0; i < 4; i++) { const p = poly[i], q = poly[(i + 1) % 4]; s += p[0] * q[1] - q[0] * p[1]; } if (s < 0) poly.reverse();   // the rooms' loops are positive in this frame
      return { id: f.id, room_id: roomOf[f.room] || f.room, kind: f.kind, polygon_cm: poly, z_cm: f.z_cm || 0, height_cm: f.height_cm, centre_cm: f.centre_cm, angle_deg: f.angle_deg || 0, size_cm: [f.length_cm, f.depth_cm], source: "sales-plan drawing, read by hand", note: f.note || "", ...(f.words_en ? { words_en: f.words_en } : {}) }; }),
  };
  fs.writeFileSync(cfg.export_plan, JSON.stringify(plan, null, 1)); console.log(`PLAN written ${cfg.export_plan}: ${plan.rooms.length} rooms, ${plan.walls.length} wall pieces, ${plan.openings.length} openings, ${plan.panes.length} panes, ${plan.camera_points.length} cameras, ${plan.fixtures.length} fixtures`);
}
fs.writeFileSync(outJson, JSON.stringify({ source: path.basename(inp), px_per_cm: pxPerCm, rooms, openings, walls: walls.map((w, i) => ({ id: `w-${i + 1}`, area_cm2: +(w.cnt / (pxPerCm * pxPerCm)).toFixed(0), polygon_cm: w.poly })), auto_bars: autoBars, glazing, lines: lineComps.map((c) => ({ id: c.id, keep: c.keep, diag_cm: c.diag_cm, bbox_cm: c.bbox_cm, polygon_cm: c.keep ? c.polygon_cm : undefined })) }, null, 1));
// --- overlay
const colors = ["#e6194b", "#3cb44b", "#4363d8", "#f58231", "#911eb4", "#46f0f0", "#f032e6", "#bcf60c", "#fabebe", "#008080", "#e6beff", "#9a6324"];
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`;
for (const w of walls) { const d = w.poly.map(([x, y], i) => `${i ? "L" : "M"}${x * pxPerCm},${y * pxPerCm}`).join(" ") + " Z"; svg += `<path d="${d}" fill="rgba(80,80,80,0.35)" stroke="#000" stroke-width="2"/>`; }
rooms.forEach((r, k) => { const col = colors[k % colors.length]; const d = r.loop.map(([x, y], i) => `${i ? "L" : "M"}${x * pxPerCm},${y * pxPerCm}`).join(" ") + " Z"; svg += `<path d="${d}" fill="${col}" fill-opacity="0.25" stroke="${col}" stroke-width="4"/>`; r.loop.forEach(([x, y], i) => { const kind = r.edge_kinds[i]; svg += `<circle cx="${x * pxPerCm}" cy="${y * pxPerCm}" r="7" fill="${kind === "wall" ? "#000" : kind === "line" ? "#0a0" : "#f00"}"/>`; }); const c = cfg.cameras.find((c) => c.id === r.camera); svg += `<text x="${c.at_cm[0] * pxPerCm}" y="${c.at_cm[1] * pxPerCm}" font-size="44" fill="${col}" font-family="Arial" font-weight="bold">${r.camera} ${r.area_m2.toFixed(1)}</text>`; });
for (const o of openings) svg += `<line x1="${o.a_cm[0] * pxPerCm}" y1="${o.a_cm[1] * pxPerCm}" x2="${o.b_cm[0] * pxPerCm}" y2="${o.b_cm[1] * pxPerCm}" stroke="#ff0" stroke-width="10"/><text x="${o.centre_cm[0] * pxPerCm}" y="${o.centre_cm[1] * pxPerCm - 12}" font-size="34" fill="#a60" font-family="Arial">${o.width_cm}</text>`;
for (const bar of cfg.bars || []) svg += `<line x1="${bar.a[0] * pxPerCm}" y1="${bar.a[1] * pxPerCm}" x2="${bar.b[0] * pxPerCm}" y2="${bar.b[1] * pxPerCm}" stroke="#0ff" stroke-width="6" stroke-dasharray="20,10"/>`;
for (const line of cfg.lines || []) svg += `<polyline points="${line.points.map(([x, y]) => `${x * pxPerCm},${y * pxPerCm}`).join(" ")}" fill="none" stroke="#08f" stroke-width="6"/>`;
for (const c of lineComps) { const d = c.polygon_cm.map(([x, y], i) => `${i ? "L" : "M"}${x * pxPerCm},${y * pxPerCm}`).join(" ") + " Z"; svg += `<path d="${d}" fill="none" stroke="${c.keep ? "#08f" : "#f80"}" stroke-width="${c.keep ? 8 : 4}"/><text x="${c.bbox_cm[0] * pxPerCm}" y="${c.bbox_cm[1] * pxPerCm - 8}" font-size="30" fill="${c.keep ? "#04a" : "#c60"}" font-family="Arial">${c.id}</text>`; }
for (const p of glazing) { const d = p.polygon_cm.map(([x, y], i) => `${i ? "L" : "M"}${x * pxPerCm},${y * pxPerCm}`).join(" ") + " Z"; const col = p.kind === "facade" ? "#00c" : "#0a0"; svg += `<path d="${d}" fill="${col}" fill-opacity="0.9" stroke="${col}" stroke-width="5"/><text x="${p.bbox_cm[0] * pxPerCm}" y="${p.bbox_cm[1] * pxPerCm - 10}" font-size="34" fill="${col}" font-family="Arial" font-weight="bold">${p.id}</text>`; }
for (const c of strokeComps.filter((c) => c.touches && c.diag_cm >= 40)) { const [x0, y0, x1, y1] = c.bbox_cm; svg += `<rect x="${x0 * pxPerCm}" y="${y0 * pxPerCm}" width="${(x1 - x0) * pxPerCm}" height="${(y1 - y0) * pxPerCm}" fill="none" stroke="${c.keep ? "#0a0" : "#c00"}" stroke-width="3" stroke-dasharray="12,8"/><text x="${x0 * pxPerCm + 6}" y="${y0 * pxPerCm + 34}" font-size="32" fill="${c.keep ? "#070" : "#c00"}" font-family="Arial" font-weight="bold">${c.id}</text>`; }
for (const g of autoBars) svg += `<line x1="${g.a[0] * pxPerCm}" y1="${g.a[1] * pxPerCm}" x2="${g.b[0] * pxPerCm}" y2="${g.b[1] * pxPerCm}" stroke="#f0f" stroke-width="8"/><text x="${(g.a[0] + g.b[0]) / 2 * pxPerCm}" y="${(g.a[1] + g.b[1]) / 2 * pxPerCm + 40}" font-size="30" fill="#a0a" font-family="Arial">${g.id}</text>`;
svg += `</svg>`;
const buf = await sharp(inp).composite([{ input: Buffer.from(svg), left: 0, top: 0 }]).png().toBuffer(); await sharp(buf).resize({ width: 1800 }).png().toFile(outPng); console.log("overlay", outPng);
