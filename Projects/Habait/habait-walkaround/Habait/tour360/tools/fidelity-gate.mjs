#!/usr/bin/env node
/* Habait Tour360 — tools/fidelity-gate.mjs (Eliran 2026-11-04: every simulation must match the sales plan; plan fix-846-fidelity).
   A mechanical gate that a designed panorama must pass before it ships. The fidelity audit (Projects/Habait/research/
   fidelity-audit-2026-11-04/REPORT.md) found that the CG renders sit on the traced plan in every room and that every S0 came from the
   AI skin painting an OPENING where the plan has a solid wall (glass over a partition, a window over a column face, a doorway through a
   closet run). An opening shows something FAR where the plan says a wall stands NEAR, so the gate measures exactly that:
     1. the traced plan (plan.general.json: the room loops' non-open edges, classed wall / glass / railing by the nearest wall or pane polygon) is ray-cast from the scene's camera, one ray per panorama column (the audit's
        raycast.py, in JS): the first surface hit, its kind (wall / facade / railing) and its distance;
     2. the designed panorama's relative depth comes from a monocular depth model on fal (Depth Anything v2, one ledgered call per
        picture, cached by the picture's hash — a re-run is $0);
     3. in the UPPER wall band (180–270 cm above the floor: above sofas, sideboards and beds), the model's disparity is fitted to the plan's
        inverse distance over the wall columns (an affine fit, RANSAC), so the scene calibrates itself;
     4. a column FAILS when the fitted distance there is > --ratio (default 1.6) × the plan's wall distance AND > 120 cm farther; a run of
        failing columns ≥ --min-deg (default 3°) wide is a finding. Glass and railing columns are not judged (beyond glass anything goes).
   v3 (2026-11-05, Eliran: «גם סטייה של 2% זה הרבה, אני רוצה להוריד את אחוז הסטייה למינימלי» — and a room over the bar is never dropped:
   «תעשה הכל כדי שהכל יהיה תקין והכל יופיע כמו בתכנית מכר»). THE RULE IS A PARAMETER, read from Habait/tour360/fidelity.json
   (max_deviation_pct, min_finding_deg, strong_gap_below_deg, max_attempts); --max-deviation-pct / --min-deg override it for a probe,
   never for a ship. The project runner's stepGate passes the file's values, never a literal. Per room the gate writes:
     deviation_pct  = the largest deviation it measured: each finding as a length along the wall (2·t·tan(deg/2), t = the plan's wall
                      distance there) over the room's longest clear dimension, and — v3e — every printed dimension of the room
                      (plan_meta.printed_dimensions, read off the sheet's own ticks) measured by tools/printed_dimensions.py between
                      ITS OWN extension lines, never against the whole room loop: per dimension the span deviation and each end's
                      offset from its tick, both over the printed number; a niche outside the measured rectangle (a bay) is reported
                      in the row, not counted;
     resolution_pct = the smallest deviation the gate can resolve in that room: min_finding_deg at the median wall distance over the
                      longest clear dimension, and the trace's own ±1 % (its scale basis, F12) — a verdict is honest only when
                      resolution_pct <= max_deviation_pct, else the row says UNRESOLVED and counts as a FAIL (the fix is a finer trace
                      snapped to the printed dimensions, not a new skin);
     cg_pct         = v3b: the CG render itself against the plan, METRIC: Blender's depth.png (cm) on every wall column of the plan's
                      ray-cast vs the ray's distance; columns a plan fixture >= 200 cm tall or a door span covers are excluded; the 90th percentile of |Δ| over the room's longest clear dimension. A CG rendered
                      from an older trace fails here before any skin is judged (the fix is a re-render, not a skin).
     both directions: a skin column that reads FARTHER than the CG (an invented opening) or, in the upper band, NEARER (an invented
                      wall or end — the short terrace) is a finding.
     STALE          = v3c: the picture predates the CG render it is judged against (ledger row time / file time vs pano.render.json
                      rendered_utc): regenerate — a far-away change is below the depth model's floor, so time order is the rule.
     verdict        = PASS when deviation_pct <= max_deviation_pct and resolved and not STALE; otherwise FAIL → THE FIX LOOP (fidelity.json fix_loop):
                      regenerate from the CG, then CG-guided band repairs at the flagged bearings (close-seam --u/--band-deg/--extra),
                      up to max_attempts, then report to Eliran. build-tour refuses to package while any shipped picture lacks a PASS
                      row for its exact bytes. A room is never shipped without passing and never left out of the tour.
   Evidence per scene: _local/fidelity/<asset>__<hash>.gate.jpg (the picture with the plan's wall line in grey, glass in cyan, findings
   shaded red, plan bearings in yellow; the CG render below) and a JSON row in _local/fidelity/gate.json.
   Usage (Git Bash, paid only for an uncached picture, ≈ $0.01 each):
     node Habait/tour360/tools/fidelity-gate.mjs apt846 [--scenes 04-living,07-bedroom-main] [--skin <file> (one scene)] [--set balanced|picks|original]
       [--cg-tour apt846-furnished] [--max-deviation-pct 1] [--min-deg 1] [--delta 30] [--dry]
   Exit 0 = every judged scene PASSES, 1 = a FAIL / UNRESOLVED, 2 = usage / missing input. FAL_KEY by name only (process env or the repo .env). */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { appRequire } from './app-require.mjs';
import { fileLedger, loadEnv } from './file-ledger.mjs';
import { measurePrintedDimensions } from './printed-dimensions.mjs';
import { loadPano, render } from './pano-geometry.mjs';
import { bandLineage } from './band-lineage.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOUR = path.resolve(HERE, '..');
const REPO = path.resolve(TOUR, '..', '..');
const sharp = appRequire(REPO)('sharp');
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const VALUE = ['--scenes', '--skin', '--set', '--ratio', '--min-deg', '--cap', '--delta', '--edge-deg', '--cg-tour', '--max-deviation-pct', '--wrap-deg'];
const cgTour = flag('--cg-tour', null);   // the CG tour whose renders are the reference (default: the apartment's own id)
const aptId = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && VALUE.includes(args[i - 1])))[0];
if (!aptId) { console.error('usage: fidelity-gate.mjs <apartment> [--scenes a,b] [--skin file] [--set balanced|picks|original] [--dry]'); process.exit(2); }
const RULE = (() => { try { return JSON.parse(fs.readFileSync(path.join(TOUR, 'fidelity.json'), 'utf8')); } catch { return {}; } })();
const MAX_PCT = Number(flag('--max-deviation-pct', RULE.max_deviation_pct ?? 2));
const MIN_DEG = Number(flag('--min-deg', RULE.min_finding_deg ?? 3)), STRONG_BELOW_DEG = Number(RULE.strong_gap_below_deg ?? 3);
const TRACE_FLOOR_PCT = 1.0;   // the trace's own accuracy against the plan's printed dimensions (scale basis in plan_meta; F12)
const RATIO = Number(flag('--ratio', 1.6)), dry = args.includes('--dry');
// --cg-only (fork E, 2026-11-05): a CG set (every designed picture IS the CG render of its camera — run-project's stepGate without a
// skin) is judged by the METRIC checks alone: cg_pct (Blender's depth.png in cm vs the plan's ray-cast) and the trace vs the printed
// dimensions. The depth-model comparison of a picture against its own CG is an identity there, so no fal call is made: $0. A designed
// (skinned) pick is refused in this mode.
const CG_ONLY = args.includes('--cg-only');
const setName = flag('--set', 'balanced');
const ENDPOINT = 'fal-ai/image-preprocessors/depth-anything/v2', EST_USD = 0.01;

const APT = path.join(TOUR, 'apartments', aptId);
const OUTD = path.join(APT, '_local', 'fidelity');
fs.mkdirSync(OUTD, { recursive: true });
const plan = JSON.parse(fs.readFileSync(path.join(APT, 'plan.general.json'), 'utf8'));
const scenes = JSON.parse(fs.readFileSync(path.join(APT, 'scenes.json'), 'utf8')).scenes;
const picks = (() => { try { return JSON.parse(fs.readFileSync(path.join(APT, '_local', 'picks.json'), 'utf8')); } catch { return {}; } })();
const want = flag('--scenes') ? flag('--scenes').split(',') : scenes.filter((s) => s.kind !== 'exterior' && /^\d\d-/.test(s.asset)).map((s) => s.asset);

// ---- the plan's segments (walls and panes), as the audit's raycast.py
const CEIL = 290;
const segs = [];
// v3d (2026-11-05): the plan the CG is built from is the ROOM LOOPS (build_scene: "a room's interior-face loop"), so the ray-cast
// walks the loops' non-open edges; the wall and pane polygons only say what an edge is (glass / railing / wall) and how high.
const dSeg = (pt, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy; const t = L ? Math.max(0, Math.min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / L)) : 0; return Math.hypot(pt[0] - (a[0] + t * dx), pt[1] - (a[1] + t * dy)); };
const nearestOf = (pt, polys) => { let best = { d: Infinity, rec: null }; for (const { poly, rec } of polys) for (let i = 0; i < poly.length; i++) { const d = dSeg(pt, poly[i], poly[(i + 1) % poly.length]); if (d < best.d) best = { d, rec }; } return best; };
const wallPolys = plan.walls.map((w) => ({ poly: w.polygon_cm, rec: w })), panePolys = plan.panes.map((q) => ({ poly: q.polygon_cm, rec: q }));
const EDGE_CLASS_CM = 14;
const openEdges = [];   // parity row 34: loop edges with no physical face (open, or no wall/pane polygon near)
for (const r of plan.rooms) {
  const L = r.loop, K = r.edge_kinds || [];
  for (let i = 0; i < L.length; i++) {
    if (K[i] === 'open') { openEdges.push([L[i], L[(i + 1) % L.length]]); continue; }
    const a = L[i], b = L[(i + 1) % L.length], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const pn = nearestOf(mid, panePolys), wl = nearestOf(mid, wallPolys);
    if (pn.d <= EDGE_CLASS_CM && pn.d <= wl.d) segs.push([a, b, pn.rec.kind, pn.rec.head_cm]);
    // a 'line' loop edge is a single drawn stroke (a door leaf, a glazing line beside a door): never judged as a wall face — the wall
    // polygon's own face (cast below) is the wall behind it
    else if (wl.d <= EDGE_CLASS_CM && K[i] !== 'line') segs.push([a, b, 'wall', wl.rec.height_cm || CEIL, 'loop', `loop:${r.id}#${i}`]);
    else openEdges.push([a, b]);   // no wall or pane near: an undrawn open-plan boundary (no CG face)
    // a loop edge with no wall or pane polygon near it has no physical face in the CG: not a wall, not judged (like an open edge)
  }
}
// v3d-2: the physical faces themselves too — a ray must stop at the near face of a wall even where the room's loop edge is open or
// glass, never pass through into the next room's loop on the far side of the wall
for (const w of plan.walls) for (let i = 0; i < w.polygon_cm.length; i++) segs.push([w.polygon_cm[i], w.polygon_cm[(i + 1) % w.polygon_cm.length], 'wall', w.height_cm || CEIL, 'face', `${w.id}#${i}`]);
for (const q of plan.panes) for (let i = 0; i < q.polygon_cm.length; i++) segs.push([q.polygon_cm[i], q.polygon_cm[(i + 1) % q.polygon_cm.length], q.kind, q.head_cm]);
function hit(cx, cy, bearing) {
  const dx = Math.sin(bearing * Math.PI / 180), dy = -Math.cos(bearing * Math.PI / 180);
  let best = null;
  for (const [a, c, k, h, src, key] of segs) {
    const ex = c[0] - a[0], ey = c[1] - a[1], den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((a[0] - cx) * ey - (a[1] - cy) * ex) / den, s = ((a[0] - cx) * dy - (a[1] - cy) * dx) / den;
    if (t > 1 && s >= 0 && s <= 1 && (!best || t < best.t)) best = { t, kind: k, h, src: src || 'face', key: key || null };   // h = the segment's height (a wall's height_cm, a pane's head)
  }
  return best;
}

// ---- depth through fal, cached by the picture's hash, ledgered before the call
const ledger = fileLedger(path.join(APT, '_local', 'ledger.json'));
let env = null;
async function depthOf(pngBuf, label) {
  const h = crypto.createHash('sha256').update(pngBuf).digest('hex').slice(0, 12);
  const cache = path.join(OUTD, `depth__${h}.png`);
  if (fs.existsSync(cache)) return { file: cache, hash: h, usd: 0 };
  if (CG_ONLY) return { file: null, hash: h, usd: 0 };   // the metric checks only (see --cg-only)
  if (dry) { console.log(`dry: ${label} needs a depth call (${ENDPOINT}, ≈ $${EST_USD})`); return null; }
  if (!env) { env = loadEnv(REPO); if (!env.FAL_KEY) { console.error('fidelity-gate: FAL_KEY missing (by name: process env or the repo .env)'); process.exit(2); } }
  const row = ledger.reserve({ ts: new Date().toISOString(), op: 'fidelity_depth', apartment: aptId, scene: label, model: ENDPOINT, inputs_hash: h, reserved_usd: EST_USD, status: 'reserved' });
  let res, j;
  try {
    res = await fetch(`https://fal.run/${ENDPOINT}`, { method: 'POST', headers: { Authorization: `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: `data:image/png;base64,${pngBuf.toString('base64')}` }), signal: AbortSignal.timeout(180000) });
    j = await res.json().catch(() => ({}));
  } catch (e) { ledger.settle(row, EST_USD, { status: 'error-unknown-billing', note: String(e.message).slice(0, 120) }); throw e; }
  if (!res.ok || !j.image?.url) { ledger.settle(row, res.ok ? EST_USD : 0, { status: `http-${res.status}`, note: JSON.stringify(j).slice(0, 160) }); throw new Error(`depth call failed: HTTP ${res.status} ${JSON.stringify(j).slice(0, 200)}`); }
  const bytes = j.image.url.startsWith('data:') ? Buffer.from(j.image.url.split(',')[1], 'base64') : Buffer.from(await (await fetch(j.image.url)).arrayBuffer());
  fs.writeFileSync(cache, bytes);
  ledger.settle(row, EST_USD, { status: 'ok', out: path.relative(APT, cache) });
  return { file: cache, hash: h, usd: EST_USD };
}

// ---- RANSAC affine fit disp = a * inv + b over the column samples
function fitAffine(pts) {
  let best = null;
  const n = pts.length; if (n < 10) return null;
  let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const spread = Math.max(...pts.map((p) => p.d)) - Math.min(...pts.map((p) => p.d));
  const tol = Math.max(4, spread * 0.06);
  for (let it = 0; it < 600; it++) {
    const p = pts[Math.floor(rnd() * n)], q = pts[Math.floor(rnd() * n)];
    if (Math.abs(p.x - q.x) < 1e-5) continue;
    const a = (p.d - q.d) / (p.x - q.x), b = p.d - a * p.x;
    if (a <= 0) continue;   // nearer must read whiter
    const inl = pts.filter((r) => Math.abs(a * r.x + b - r.d) < tol);
    if (!best || inl.length > best.inl.length) best = { a, b, inl };
  }
  if (!best) return null;
  // least squares on the inliers
  const I = best.inl, mx = I.reduce((s, r) => s + r.x, 0) / I.length, md = I.reduce((s, r) => s + r.d, 0) / I.length;
  const sxx = I.reduce((s, r) => s + (r.x - mx) ** 2, 0), sxd = I.reduce((s, r) => s + (r.x - mx) * (r.d - md), 0);
  const a = sxx > 0 ? sxd / sxx : best.a, b = md - a * mx;
  return { a, b, inliers: I.length, n, tol };
}

const W = 1024, H = 512;
// THE WRAP EDGE (fork F 2026-11-05, parity row 14): a monocular depth model sees an equirectangular panorama's left and right edges as
// an image border and reads the wall there as far away — apt846-auto's bedroom failed at 5.38 % on a plain wall at bearing 319–329°,
// 2–6 % of the width from the image edge, through five repairs that could not change it. The picture is also judged half-turned
// (one more depth call, cached): within WRAP_DEG of the edge the half-turned map is used, fitted to the plain map by least squares over
// the columns that are interior in both. Every column is still judged; none is skipped.
const WRAP_DEG = Number(flag('--wrap-deg', 20));
async function halfTurn(pngBuf) {
  const m = await sharp(pngBuf).metadata(); const w = m.width, h = m.height, x0 = Math.round(w / 2);
  const L = await sharp(pngBuf).extract({ left: 0, top: 0, width: x0, height: h }).toBuffer(); const R = await sharp(pngBuf).extract({ left: x0, top: 0, width: w - x0, height: h }).toBuffer();
  return sharp({ create: { width: w, height: h, channels: 3, background: '#000' } }).composite([{ input: R, left: 0, top: 0 }, { input: L, left: w - x0, top: 0 }]).png().toBuffer();
}
async function depthMap(pngBuf, label) {
  const d0 = await depthOf(pngBuf, label); if (!d0) return null;
  if (!d0.file) return { data: null, hash: d0.hash, usd: 0 };   // --cg-only: no picture depth (the metric checks only)
  const A = (await sharp(d0.file).resize({ width: W, height: H, fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true })).data;
  const d1 = await depthOf(await halfTurn(pngBuf), `${label}-half`); if (!d1) return { data: A, hash: d0.hash, usd: d0.usd };
  const B = (await sharp(d1.file).resize({ width: W, height: H, fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true })).data;
  const half = W / 2; const at = (i) => (i + half) % W;   // column i of the plain map is column at(i) of the half-turned one
  let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let r = 0; r < H; r += 2) for (let i = Math.round(W * 0.1); i < Math.round(W * 0.4); i += 2) { const x = B[r * W + at(i)], y = A[r * W + i]; n++; sx += x; sy += y; sxx += x * x; sxy += x * y; }
  const a = n && (n * sxx - sx * sx) ? (n * sxy - sx * sy) / (n * sxx - sx * sx) : 1, b = n ? (sy - a * sx) / n : 0;
  const out = Buffer.from(A); const e = Math.round((WRAP_DEG / 360) * W);
  for (let r = 0; r < H; r++) for (let i = 0; i < W; i++) if (i < e || i >= W - e) out[r * W + i] = Math.max(0, Math.min(255, Math.round(a * B[r * W + at(i)] + b)));
  return { data: out, hash: d0.hash, usd: (d0.usd || 0) + (d1.usd || 0), wrap: { deg: WRAP_DEG, fit: [+a.toFixed(3), +b.toFixed(1)] } };
}
const rows = [];
let failAny = false;
for (const asset of want) {
  const scene = scenes.find((s) => s.asset === asset);
  if (!scene) { console.error(`${asset}: not a scene`); process.exit(2); }
  const cam = plan.camera_points.find((c) => c.id.toLowerCase() === `cp-${scene.id}`.toLowerCase());
  if (!cam) { console.error(`${asset}: no camera cp-${scene.id} in the plan`); process.exit(2); }
  const skinFile = flag('--skin') && want.length === 1 ? path.resolve(flag('--skin'))
    : setName === 'picks' ? path.join(APT, '_local', 'generated', picks[asset] || '')
    : setName === 'original' ? path.join(REPO, '360walkaround', 'tours', cgTour || aptId, 'renders', cam.id, 'pano.webp')
    : path.join(APT, 'panos', setName, `${asset}.webp`);
  if (!fs.existsSync(skinFile)) { console.error(`${asset}: no picture at ${skinFile}`); process.exit(2); }
  if (CG_ONLY && picks[asset] && !/__cg__/.test(picks[asset])) { console.error(`${asset}: --cg-only refuses a designed (skinned) pick (${picks[asset]})`); process.exit(2); }
  const png = await sharp(skinFile).resize({ width: 2048, height: 1024, fit: 'fill' }).removeAlpha().png().toBuffer();
  const dep = await depthMap(png, asset);
  if (!dep) continue;
  const D = dep.data;
  const cb = scene.centreBearingDeg, cx = cam.x, cy = cam.y, ez = cam.z || 160;
  const vOf = (hcm, t) => 0.5 - (Math.atan2(hcm - ez, t) * 180 / Math.PI) / 180;
  // the median disparity of column i between heights lo..hi (cm) on a surface t cm away
  const band = (M, i, t, lo, hi) => { if (!M) return null; const r0 = Math.max(0, Math.floor(vOf(hi, t) * H)), r1 = Math.min(H - 1, Math.ceil(vOf(lo, t) * H)); const v = []; for (let r = r0; r <= r1; r++) v.push(M[r * W + i]); v.sort((p, q) => p - q); return v.length ? v[Math.floor(v.length / 2)] : null; };
  // columns not judged: inside ±EDGE° of a plan opening's jambs (a door leaf may swing anywhere) or of a wall/glass boundary
  const EDGE = Number(flag('--edge-deg', 1.5));
  const bearingTo = (p) => (((Math.atan2(p[0] - cx, -(p[1] - cy)) * 180 / Math.PI) % 360) + 360) % 360;
  const angd = (a, b2) => Math.abs((((a - b2) % 360) + 540) % 360 - 180);
  const jambs = []; for (const o of plan.openings || []) { if (o.a_cm && o.b_cm) { jambs.push(bearingTo(o.a_cm), bearingTo(o.b_cm)); } }
  // only a DOOR's span is left unjudged (its leaf may stand anywhere); an open-plan boundary (kind 'opening', region-contact) has no
  // leaf, and the ray already sees through it to the far wall (2026-11-04: the dining camera kept 10 wall columns of 556 before this)
  const openSpans = (plan.openings || []).filter((o) => o.a_cm && o.b_cm && o.kind !== 'opening').map((o) => [bearingTo(o.a_cm), bearingTo(o.b_cm)]);
  const inOpening = (b2) => openSpans.some(([a1, a2]) => { const w = angd(a1, a2); return angd(b2, a1) <= w + EDGE && angd(b2, a2) <= w + EDGE; });
  const cols = [];
  for (let i = 0; i < W; i++) {
    const b = (((cb + (i / W - 0.5) * 360) % 360) + 360) % 360;
    const h = hit(cx, cy, b);
    if (!h) { cols.push({ i, b, kind: 'none' }); continue; }
    const d = band(D, i, h.t, 180, 270), dm = band(D, i, h.t, 100, 180);
    const rMid = h.t / Math.cos(Math.atan2(225 - ez, h.t));   // radial distance to the band's middle
    cols.push({ i, b, kind: h.kind, src: h.src, key: h.key, t: h.t, hh: h.h, rMid, d, dm });
  }
  // v2 (same day): the reference is the CG render of the same camera through the SAME depth model — the CG sits on the plan in every
  // room (the audit), so a column where the skin reads FAR and the CG reads NEAR, on a column the plan calls a wall, is an invented
  // opening. The skin's disparity is fitted to the CG's over the wall columns (affine, RANSAC), then a column fails when the skin is
  // > DELTA below the fit and the CG is not itself far there.
  const cgFileRef = path.join(REPO, '360walkaround', 'tours', cgTour || aptId, 'renders', cam.id, 'pano.webp');
  if (!fs.existsSync(cgFileRef)) { console.error(`${asset}: no CG render at ${cgFileRef}`); process.exit(2); }
  const cgPng = await sharp(cgFileRef).resize({ width: 2048, height: 1024, fit: 'fill' }).removeAlpha().png().toBuffer();
  // v3b: the CG against the plan, metric — depth.png is rgb24-be centimetres (render_pano.py's contract), radial distance
  let cgCheck = null;
  const cgDepthFile = path.join(path.dirname(cgFileRef), 'depth.png');
  if (fs.existsSync(cgDepthFile)) {
    const { data: Z, info: zi } = await sharp(cgDepthFile).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const zw = zi.width, zh = zi.height, errs = [];
    // the plan's own occluders: a fixture that reaches the band (tall unit, wardrobe, laundry closet: height >= 200) and a door's
    // span (its leaf may stand anywhere) — a column they cover is not judged; what remains is plan vs CG disagreement
    const tallSegs = [];
    // parity row 33 (the coordinator, 2026-11-06): in --cg-only mode the render is compared with the plan's WALL line, so whatever tall
    // stands in front of that wall in the RENDER is an occluder too — the plan's fixtures >= 100 cm AND the furnisher's template ones
    // (a bedroom closet the plan does not draw: tours/<cg>/plan.json); without them every bearing at a closet read as a deviation
    // (apt846-auto 8/11 and the auto-traced 846 bedrooms 16-69 % false FAILs). The skin gate is unchanged
    const occluders = CG_ONLY ? (() => { const own = new Set((plan.fixtures || []).map((x) => x.id)); let fp = []; try { fp = JSON.parse(fs.readFileSync(path.join(REPO, '360walkaround', 'tours', cgTour || aptId, 'plan.json'), 'utf8')).fixtures || []; } catch { /* no furnished plan */ } return [...(plan.fixtures || []), ...fp.filter((x) => !own.has(x.id))].filter((x) => Number(x.height_cm) >= 100 || ['wardrobe', 'tall_unit', 'shower'].includes(x.kind)); })() : null;   // a shower's glass screen stands full height over its low tray
    for (const f of occluders || plan.fixtures || []) { if (f.polygon_cm && (occluders || Number(f.height_cm) >= 200 || ['shower', 'wardrobe', 'tall_unit'].includes(f.kind))) for (let k = 0; k < f.polygon_cm.length; k++) tallSegs.push([f.polygon_cm[k], f.polygon_cm[(k + 1) % f.polygon_cm.length]]); }
    // a door leaf stands anywhere inside its swing: a ray passing within the leaf's width of either jamb, before the wall, is not judged
    const doorJambs = (plan.openings || []).filter((o) => o.a_cm && o.b_cm && o.kind !== 'opening').flatMap((o) => [[o.a_cm, o.width_cm], [o.b_cm, o.width_cm]]);
    const inSwing = (b, t) => { const dx = Math.sin(b * Math.PI / 180), dy = -Math.cos(b * Math.PI / 180); return doorJambs.some(([j, w]) => { const px = j[0] - cx, py = j[1] - cy, along = px * dx + py * dy, perp = Math.abs(px * dy - py * dx); return along > 0 && along < t + w && perp < w; }); };
    const tallHit = (b) => { const dx = Math.sin(b * Math.PI / 180), dy = -Math.cos(b * Math.PI / 180); let best = Infinity; for (const [a, c2] of tallSegs) { const ex = c2[0] - a[0], ey = c2[1] - a[1], den = dx * ey - dy * ex; if (Math.abs(den) < 1e-9) continue; const t = ((a[0] - cx) * ey - (a[1] - cy) * ex) / den, u = ((a[0] - cx) * dy - (a[1] - cy) * dx) / den; if (t > 1 && u >= 0 && u <= 1 && t < best) best = t; } return best; };
    // parity row 34 (the coordinator, 2026-11-07), --cg-only only: (a) a LOOP edge judged as 'wall' within 40 cm of glass or of an undrawn
    // open-plan edge is a junction with no CG face — not judged; (b) only the camera room's own faces are judged — a ray that leaves the
    // room through an open-plan boundary lands on another room's wall, which that room's own camera judges. A real wall face (a wall
    // polygon's own face, or a loop edge away from glass/open edges, inside the room) is always judged: the negative control proves it
    const ownLoop = (plan.rooms.find((r) => r.id === cam.room_id) || {}).loop || [];
    const dseg2 = (p, a, q) => { const ex = q[0] - a[0], ey = q[1] - a[1], L = ex * ex + ey * ey; const u = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * ex + (p[1] - a[1]) * ey) / L)) : 0; return Math.hypot(p[0] - (a[0] + u * ex), p[1] - (a[1] + u * ey)); };
    const dpoly2 = (p, P) => Math.min(...P.map((a, k) => dseg2(p, a, P[(k + 1) % P.length])));
    const inPoly2 = (p, P) => { let c2 = false; for (let k = 0, j = P.length - 1; k < P.length; j = k++) { const [xi, yi] = P[k], [xj, yj] = P[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c2 = !c2; } return c2; };
    const faceSegs = segs.filter((sg) => sg[2] === 'wall' && sg[4] === 'face');
    const castFace = (b) => { const dx = Math.sin(b * Math.PI / 180), dy = -Math.cos(b * Math.PI / 180); let best = null; for (const [a, c2] of faceSegs) { const ex = c2[0] - a[0], ey = c2[1] - a[1], den = dx * ey - dy * ex; if (Math.abs(den) < 1e-9) continue; const t = ((a[0] - cx) * ey - (a[1] - cy) * ex) / den, u = ((a[0] - cx) * dy - (a[1] - cy) * dx) / den; if (t > 1 && u >= 0 && u <= 1 && (!best || t < best.t)) best = { t }; } return best; };
    const perWall = new Map();   // parity row 36: the signed errors per wall face (cg-only)
    const cgOnlySkip = (c) => {
      const P = [cx + Math.sin(c.b * Math.PI / 180) * c.t, cy - Math.cos(c.b * Math.PI / 180) * c.t];
      if (ownLoop.length > 2 && !inPoly2(P, ownLoop) && dpoly2(P, ownLoop) > 20) return true;                         // (b) another room's face
      // (a) a loop edge was classed 'wall' by its MIDPOINT; at the hit point itself there may be no wall face (the polygon ended at glass or
      //     at an open-plan edge): no wall face within EDGE_CLASS_CM of the hit = no CG face to compare = not judged
      // (a″) the coordinator 2026-11-07: judged only if the ray meets a PHYSICAL wall face within EDGE_CLASS_CM of the loop hit, along the
      //     same ray (a loop corner that overruns a wall end has no face on that ray: the terrace's w-5 end, 7.7 cm past it)
      if (c.src === 'loop') { const fh = castFace(c.b); if (!fh || fh.t > c.t + EDGE_CLASS_CM) return true; }
      return false;
    };
    let occluded = 0;
    for (const c of cols) {
      if (c.kind !== 'wall') continue;
      if (inOpening(c.b) || inSwing(c.b, c.t) || tallHit(c.b) < c.t) { occluded++; continue; }
      if (CG_ONLY && cgOnlySkip(c)) { occluded++; continue; }
      const hBand = c.hh && c.hh < 250 ? Math.max(100, c.hh - 20) : 225;   // sample a low wall (the 1.80 m terrace screen) below its own top
      const zx = Math.min(zw - 1, Math.round((c.i + 0.5) / W * zw)), zy = Math.min(zh - 1, Math.round(vOf(hBand, c.t) * zh));
      const o = (zy * zw + zx) * 3, cm = (Z[o] << 16) | (Z[o + 1] << 8) | Z[o + 2];
      if (!cm) continue;
      const radial = c.t / Math.cos(Math.atan2(hBand - ez, c.t));
      c.cgErrCm = Math.abs(cm - radial); errs.push(c.cgErrCm);
      if (CG_ONLY && c.key) { if (!perWall.has(c.key)) perWall.set(c.key, []); perWall.get(c.key).push([cm - radial, c.t]); }
    }
    errs.sort((a, b) => a - b);
    if (errs.length) cgCheck = { columns: errs.length, occluded_columns: occluded, median_cm: +errs[Math.floor(errs.length / 2)].toFixed(1), p90_cm: +errs[Math.floor(errs.length * 0.90)].toFixed(1), p95_cm: +errs[Math.floor(errs.length * 0.95)].toFixed(1) };
    // parity row 36 (the coordinator, 2026-11-07), --cg-only: every wall face the camera sees is judged ON ITS OWN, beside the room p90 —
    // the median of its signed errors against max(1 % of its distance, 5 cm). One wall 10 cm off in a large open room stays under the room
    // p90/Lmax; it does not stay under its own limit. A face needs >= 10 judged columns (~1.8 deg) to be judged
    if (cgCheck && CG_ONLY) {
      const med = (a) => { const v = [...a].sort((x, y) => x - y); return v[Math.floor(v.length / 2)]; };
      cgCheck.walls = [...perWall.entries()].filter(([, v]) => v.length >= 10).map(([key, v]) => { const e = med(v.map((x) => x[0])), t = med(v.map((x) => x[1])), lim = Math.max(0.01 * t, 5); return { face: key, columns: v.length, median_err_cm: +e.toFixed(1), at_cm: Math.round(t), limit_cm: +lim.toFixed(1), ratio: +(Math.abs(e) / lim).toFixed(2), pass: Math.abs(e) <= lim }; }).sort((x, y) => y.ratio - x.ratio);
      cgCheck.wall_ratio_max = cgCheck.walls.length ? cgCheck.walls[0].ratio : 0;
      cgCheck.walls_failing = cgCheck.walls.filter((w) => !w.pass).map((w) => `${w.face} ${w.median_err_cm} cm at ${w.at_cm} cm`);
    }
  }
  const cgDep = await depthMap(cgPng, `${asset}-cg`);
  if (!cgDep) continue;
  const C = cgDep.data;
  for (const c of cols) {
    if (c.kind !== 'wall') continue;
    c.dc = band(C, c.i, c.t, 180, 270); c.dcm = band(C, c.i, c.t, 100, 180);
  }
  // boundaries between kinds (wall ↔ glass/railing), and door openings, are not judged
  for (let k = 0; k < W; k++) { const c = cols[k]; const n = Math.ceil((EDGE / 360) * W); let edge = false; for (let j = -n; j <= n; j++) { const o = cols[(k + j + W) % W]; if (o.kind !== c.kind) edge = true; } c.skip = edge || inOpening(c.b); }
  const pts = cols.filter((c) => c.kind === 'wall' && !c.skip && c.d != null && c.dc != null).flatMap((c) => [{ x: c.dc, d: c.d }, ...(c.dm != null && c.dcm != null ? [{ x: c.dcm, d: c.dm }] : [])]);
  const fit = CG_ONLY ? { a: 1, b: 0, inliers: 0, n: 0, mode: 'cg-only' } : fitAffine(pts);
  if (!fit) { console.error(`${asset}: too few wall columns to calibrate`); rows.push({ asset, verdict: 'NO-CALIBRATION' }); failAny = true; continue; }
  const DELTA = Number(flag('--delta', 30));
  // a column the plan puts a fixture in front of (a shower screen, a closet, a tall unit) is judged only in the FARTHER direction:
  // the depth model reads a glass edge or a closet front at its own distance, which is not an invented wall
  const occSegs = [];
  for (const f of plan.fixtures || []) { if (f.polygon_cm && (Number(f.height_cm) >= 200 || ['shower', 'wardrobe', 'tall_unit'].includes(f.kind))) for (let k = 0; k < f.polygon_cm.length; k++) occSegs.push([f.polygon_cm[k], f.polygon_cm[(k + 1) % f.polygon_cm.length]]); }
  const occHit = (b) => { const dx = Math.sin(b * Math.PI / 180), dy = -Math.cos(b * Math.PI / 180); let best = Infinity; for (const [a, c2] of occSegs) { const ex = c2[0] - a[0], ey = c2[1] - a[1], den = dx * ey - dy * ex; if (Math.abs(den) < 1e-9) continue; const t = ((a[0] - cx) * ey - (a[1] - cy) * ex) / den, u = ((a[0] - cx) * dy - (a[1] - cy) * dx) / den; if (t > 1 && u >= 0 && u <= 1 && t < best) best = t; } return best; };
  for (const c of cols) {
    if (c.kind !== 'wall' || c.skip || c.d == null || c.dc == null) continue;
    const gU = (fit.a * c.dc + fit.b) - c.d, gM = c.dm != null && c.dcm != null ? (fit.a * c.dcm + fit.b) - c.dm : -1e9;
    c.gap = Math.max(gU * (c.dc > 25 ? 1 : 0), gM * (c.dcm > 25 ? 1 : 0));   // > 0: the skin reads farther than the CG (where the CG is not itself far)
    c.gapNear = occHit(c.b) < c.t ? 0 : -gU;                                // > 0: the skin reads NEARER than the CG in the upper band (an invented wall or end); not on a fixture column
    c.bad = c.gap > DELTA || c.gapNear > DELTA;
  }
  // runs of failing columns (wrapping)
  const minCols = Math.ceil((MIN_DEG / 360) * W);
  const bad = cols.map((c) => Boolean(c.bad));
  const runs = [];
  let start = bad.findIndex((x) => !x); if (start < 0) start = 0;
  const strongCols = Math.ceil((STRONG_BELOW_DEG / 360) * W);
  for (let k = 0, run = null; k <= W; k++) {
    const i = (start + k) % W, on = k < W && bad[i];
    if (on && !run) run = { from: i, n: 0, worst: 0 };
    if (on) { run.n++; run.worst = Math.max(run.worst, cols[i].gap || 0, cols[i].gapNear || 0); }
    // a run narrower than STRONG_BELOW_DEG counts only with a strong gap (>= 2·DELTA): the depth model's own noise is not a finding
    if ((!on || k === W) && run) { if (run.n >= minCols && (run.n >= strongCols || run.worst >= 2 * DELTA)) runs.push(run); run = null; }
  }
  let findings = runs.map((r) => {
    const mid = cols[(r.from + Math.floor(r.n / 2)) % W];
    const seg = Array.from({ length: r.n }, (_, k) => cols[(r.from + k) % W]);
    const worst = seg.reduce((m, c) => Math.max(m, c.gap || 0, c.gapNear || 0), 0);
    const direction = seg.some((c) => (c.gapNear || 0) > DELTA && (c.gapNear || 0) >= (c.gap || 0)) ? 'nearer (an invented wall or end)' : 'farther (an invented opening)';
    const deg = (r.n / W) * 360, width_cm = 2 * mid.t * Math.tan((deg / 2) * Math.PI / 180);
    return { bearing_from: Math.round(cols[r.from].b), bearing_to: Math.round(cols[(r.from + r.n - 1) % W].b), deg: +deg.toFixed(1), at_bearing: Math.round(mid.b), plan_wall_cm: Math.round(mid.t), worst_gap: Math.round(worst), direction, width_cm: +width_cm.toFixed(1) };
  });
  // A MIRROR over a basin reflects the room: the depth model reads it as far away (parity row 17, fork F 2026-11-06 — apt846-auto's guest
  // bath failed at 11.79 % on its vanity mirror while the same picture passed at 0.28 % another time). A "farther" finding that lies
  // inside the bearing span of a plan VANITY (± 4°) is that mirror, not an opening; it is listed in mirror_findings, never counted.
  // A "nearer" finding there, or a farther one anywhere else, still counts.
  const vanitySpans = (plan.fixtures || []).filter((f) => f.kind === 'vanity' && (f.polygon_cm || []).length).map((f) => { const bs = f.polygon_cm.map((q) => bearingTo(q)); let lo = bs[0], hi = bs[0]; for (const b2 of bs) { if (((b2 - lo + 540) % 360) - 180 < 0) lo = b2; if (((b2 - hi + 540) % 360) - 180 > 0) hi = b2; } return [lo, hi]; });
  const inVanity = (b2) => vanitySpans.some(([lo, hi]) => { const w = ((hi - lo + 360) % 360); const d = ((b2 - lo + 360 + 4) % 360); return d <= w + 8; });
  const mirror_findings = findings.filter((f) => f.direction.startsWith('farther') && inVanity(f.bearing_from) && inVanity(f.bearing_to));
  findings = findings.filter((f) => !mirror_findings.includes(f));
  // every exempted span is saved as a crop beside the gate's evidence, so a person can audit that it IS the mirror (the coordinator's
  // condition, 2026-11-06); the row carries the crop's path. Only plan vanities qualify — nowhere else.
  if (mirror_findings.length) {
    const pano = await loadPano(sharp, skinFile);
    for (const f of mirror_findings) {
      const yaw = ((f.at_bearing - cb + 540) % 360) - 180; const hf = Math.min(110, Math.max(50, f.deg * 3 + 30));
      const crop = path.join(OUTD, `${asset}__mirror__${f.at_bearing}__${dep.hash}.jpg`);
      await sharp(render(pano, yaw, 0, hf, 640, 480), { raw: { width: 640, height: 480, channels: 3 } }).jpeg({ quality: 85 }).toFile(crop);
      f.crop = path.relative(APT, crop); f.vanity_span = true;
    }
  }
  // v3: the room's numbers — the deviation measured, and the smallest deviation this gate can resolve here
  const room = plan.rooms.find((r) => r.id === cam.room_id) || {};
  const Lmax = Math.max(...(room.clear_dims_cm || [1]));
  const wallT = cols.filter((c) => c.kind === 'wall').map((c) => c.t).sort((a, b) => a - b);
  const medT = wallT.length ? wallT[Math.floor(wallT.length / 2)] : 300;
  const panoFloorPct = 2 * medT * Math.tan((MIN_DEG / 2) * Math.PI / 180) / Lmax * 100;
  // v3e/v3f: the room's printed dimensions, between their own extension lines, measured ONCE by tools/printed_dimensions.py (through
  // the thin wrapper printed-dimensions.mjs; the auto-trace dims gate and the portal call the same file). Each row is tied to its room
  // or fixture by where its ends land; an end is the VISIBLE surface (the loop's wall edge the CG faces, a pane, else the nearest traced
  // feature). pct = max(|span deviation|, every end's |offset| / printed) — a fixture slid along its wall fails with the right length.
  const pdAll = measurePrintedDimensions(plan);
  const dimRows = pdAll.rows.filter((r) => r.room === cam.room_id && (r.kind === 'room' || r.kind === 'fixture')).map((r) => ({
    id: r.id, kind: r.kind, fixture: r.fixture || null, printed_cm: r.printed_cm, drawn_cm: r.drawn_cm, trace_cm: r.trace_cm ?? null,
    mode: r.verdict || r.kind, pct: r.pct ?? null, ends: r.ends || null }));
  const dims = { rows: dimRows, niche: pdAll.niches.find((n) => n.room === cam.room_id) || null,
    unchecked: dimRows.filter((r) => r.pct == null).map((r) => `${r.id}: ${r.mode}`) };
  dims.max_pct = dimRows.length ? Math.max(0, ...dimRows.filter((r) => r.pct != null).map((r) => r.pct)) : null;
  // provenance (v3c): a shipped picture skinned from an OLDER CG than the one it is judged against is stale by definition — from a far
  // camera a changed end of a room is below the depth model's floor (the terrace end at 11 m), so the time order is the rule:
  // the CG's rendered_utc (pano.render.json) must precede the picture (its ledger row by hash, else its file time)
  let stale = null;
  try {
    const rj = JSON.parse(fs.readFileSync(path.join(path.dirname(cgFileRef), 'pano.render.json'), 'utf8'));
    const cgAt = Date.parse(rj.generator && rj.generator.rendered_utc);
    const ledgerDoc = ledger.load();
    const pickName = path.basename(skinFile); const m = pickName.match(/__([0-9a-f]{12})\.(png|webp)$/);
    const row = m && ledgerDoc.rows.find((r) => r.inputs_hash === m[1] && (r.at || r.ts));
    const picAt = row ? Date.parse(row.at || row.ts) : fs.statSync(skinFile).mtimeMs;
    if (Number.isFinite(cgAt) && Number.isFinite(picAt) && picAt < cgAt) stale = { cg_rendered: rj.generator.rendered_utc, picture_at: new Date(picAt).toISOString() };
  } catch { /* no render record: no provenance test */ }
  const findingPct = findings.length ? Math.max(...findings.map((f) => f.width_cm / Lmax * 100)) : 0;
  const dimsPct = dims.max_pct || 0;
  const cgPct = cgCheck ? +(cgCheck.p90_cm / Lmax * 100).toFixed(2) : 0;   // p90 after the plan's own occluders are excluded
  const cgNote = cgCheck ? null : 'CG vs plan not judgeable from this camera: every wall column is covered by a plan fixture or a door span';
  const wallPct = CG_ONLY && cgCheck?.wall_ratio_max ? +(cgCheck.wall_ratio_max * MAX_PCT).toFixed(2) : 0;   // row 36: ratio 1 = the bar
  const deviation_pct = +Math.max(findingPct, dimsPct, cgPct, wallPct).toFixed(2);
  const resolution_pct = +Math.max(panoFloorPct, TRACE_FLOOR_PCT).toFixed(2);
  const resolved = resolution_pct <= MAX_PCT;
  // R25 (2026-11-05): no visible band edge ships; the picture's repair chain is read from close-seam's sidecars (tools/band-lineage.mjs)
  // a CG render carries no band repair: R25 does not apply in --cg-only mode (it would judge the CG set as an unrecorded pick)
  const band_edge = CG_ONLY ? { verdict: 'PASS', chain: [], failures: [], note: 'cg-only: a CG render has no band repairs' } : bandLineage(APT, skinFile, asset, RULE.band_edge || {});
  const verdict = stale ? 'STALE' : band_edge.verdict === 'FAIL' ? 'FAIL' : deviation_pct <= MAX_PCT && resolved ? 'PASS' : !resolved && deviation_pct <= MAX_PCT ? 'UNRESOLVED' : 'FAIL';
  if (verdict !== 'PASS') failAny = true;

  // evidence: the picture + plan lines + findings, the CG below
  const vis = await sharp(skinFile).resize({ width: 1600, height: 800, fit: 'fill' }).removeAlpha().raw().toBuffer();
  const sx = 1600 / W;
  const svg = [`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="800">`];
  for (const r of runs) for (let k = 0; k < r.n; k++) { const i = (r.from + k) % W; svg.push(`<rect x="${(i * sx).toFixed(1)}" y="0" width="${(sx + 0.6).toFixed(1)}" height="800" fill="rgba(255,0,0,0.28)"/>`); }
  for (const c of cols) {
    if (c.kind === 'none') continue;
    const col = c.kind === 'wall' ? '#555' : c.kind === 'railing' ? '#0c0' : '#0cf';
    for (const hcm of [0, CEIL]) svg.push(`<circle cx="${(c.i * sx).toFixed(1)}" cy="${(vOf(hcm, c.t) * 800).toFixed(1)}" r="1.4" fill="${col}"/>`);
  }
  for (let bb = 0; bb < 360; bb += 30) { const u = 0.5 + ((((bb - cb + 180) % 360) + 360) % 360 - 180) / 360; svg.push(`<line x1="${u * 1600}" y1="0" x2="${u * 1600}" y2="16" stroke="yellow" stroke-width="2"/><text x="${u * 1600 + 3}" y="13" fill="yellow" font-size="12" font-family="Arial">${bb}</text>`); }
  svg.push(`<rect x="0" y="770" width="1600" height="30" fill="rgba(0,0,0,0.6)"/><text x="8" y="790" fill="${verdict === 'PASS' ? '#7f7' : '#f77'}" font-size="16" font-family="Arial">${asset} — ${verdict} · deviation ${deviation_pct.toFixed(2)}% (bar ${MAX_PCT}%, resolves ${resolution_pct.toFixed(2)}%)${findings.length ? ': opening where the plan has a wall at ' + findings.map((f) => `${f.bearing_from}–${f.bearing_to}° (${f.deg}°, ${f.width_cm} cm, gap ${f.worst_gap})`).join(', ') : ''} · calibration ${fit.inliers}/${fit.n} wall columns</text></svg>`);
  const top = await sharp(vis, { raw: { width: 1600, height: 800, channels: 3 } }).composite([{ input: Buffer.from(svg.join('')), left: 0, top: 0 }]).png().toBuffer();
  const cgFile = path.join(REPO, '360walkaround', 'tours', cgTour || aptId, 'renders', cam.id, 'pano.webp');
  const parts = [{ input: top, left: 0, top: 0 }];
  if (fs.existsSync(cgFile) && setName !== 'original') parts.push({ input: await sharp(cgFile).resize({ width: 1600, height: 800, fit: 'fill' }).png().toBuffer(), left: 0, top: 804 });
  const ev = path.join(OUTD, `${asset}__${setName}__${dep.hash}.gate.jpg`);
  await sharp({ create: { width: 1600, height: parts.length > 1 ? 1604 : 800, channels: 3, background: '#000' } }).composite(parts).jpeg({ quality: 84 }).toFile(ev);
  const row = { mirror_findings, at: new Date().toISOString(), asset, mode: CG_ONLY ? 'cg-only' : 'depth', room: cam.room_id, set: setName, cg_tour: cgTour || aptId, picture: path.relative(APT, skinFile), picture_hash: dep.hash, verdict, stale, deviation_pct, max_deviation_pct: MAX_PCT, resolution_pct, resolved, dims, cg_vs_plan: cgCheck ? { ...cgCheck, pct: cgPct } : { note: cgNote }, findings, band_edge, calibration: { inliers: fit.inliers, columns: fit.n }, delta: Number(flag('--delta', 30)), min_deg: MIN_DEG, evidence: path.relative(APT, ev) };
  rows.push(row);
  console.log(`${asset.padEnd(20)} ${verdict.padEnd(10)}${stale ? ' (the picture predates its CG render ' + stale.cg_rendered + ' — regenerate) ' : ''}deviation ${deviation_pct.toFixed(2)}% (bar ${MAX_PCT}%, resolves ${resolution_pct.toFixed(2)}%; CG vs plan p90 ${cgCheck ? cgCheck.p90_cm + ' cm (median ' + cgCheck.median_cm + ') = ' + cgPct.toFixed(2) + '%' : 'NOT JUDGEABLE from this camera'}${dims.max_pct != null ? '; printed dims ' + dims.rows.map((r) => r.id + ' ' + (r.pct == null ? r.mode : r.pct.toFixed(2) + '%')).join(', ') : ''}${dims.niche ? '; niche ' + dims.niche.niche_m2 + ' m2 (reported, not counted)' : ''})${findings.length ? '  ' + findings.map((f) => `${f.bearing_from}–${f.bearing_to}° ${f.deg}° ${f.width_cm}cm gap ${f.worst_gap}`).join(' | ') : ''}${band_edge.failures.length ? '  BAND EDGE: ' + band_edge.failures.join(' | ') : ''}  (calibration ${fit.inliers}/${fit.n}) → ${path.relative(APT, ev)}`);
}
const gj = path.join(OUTD, 'gate.json');
const prev = (() => { try { return JSON.parse(fs.readFileSync(gj, 'utf8')); } catch { return { $schema: 'tour360/fidelity-gate.v2', rows: [] }; } })();
prev.$schema = 'tour360/fidelity-gate.v2'; prev.rule = { max_deviation_pct: MAX_PCT, min_finding_deg: MIN_DEG, source: 'Habait/tour360/fidelity.json' };
prev.rows.push(...rows); fs.writeFileSync(gj, JSON.stringify(prev, null, 1));
process.exit(failAny ? 1 : 0);
