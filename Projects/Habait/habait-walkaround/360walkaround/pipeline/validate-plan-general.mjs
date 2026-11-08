#!/usr/bin/env node
// validate-plan-general.mjs - the enforcement point for a GENERAL-polygon plan (SCHEMA v0.2.0, `geometry: "general"`;
// ruled D-WQ-28, 2026-10-28). validate-plan.mjs delegates here when the plan declares general geometry; the rectilinear
// path (v0.1.0) is untouched. Same contract: exit 0 clean (warnings allowed) | 1 any FAIL | 2 usage/parse.
//
//   node pipeline/validate-plan-general.mjs tours/<id>/plan.json [--json] [--quiet]
//
// What a general plan carries that v0.1.0 does not: rooms[].loop is ANY simple polygon; walls[] have polygon_cm (no
// rect_cm); openings[] are oriented segments (a_cm, b_cm, centre_cm, angle_deg, width_cm, sill_cm, head_cm, rooms[2]);
// panes[] are thin glazing polygons (kind facade | railing, head_cm); camera_points[] may sit in outdoor rooms
// (a roofed terrace on a tower floor). No dependencies. Node >= 20.

import { readFileSync } from 'node:fs';
import { argv as ARGV, exit } from 'node:process';

const TOL = 0.05;
const AREA_TOL = 0.05;            // area_m2 vs shoelace
const COVER_CM = 15;              // a room edge must have a wall, a pane or an opening within this distance
const OVERLAP_WARN_M2 = 0.10, OVERLAP_FAIL_M2 = 0.50;
const RIGHTS = ['own', 'licensed', 'partner-supplied', 'unrecorded'];
const ROOM_TYPES = ['living', 'kitchen', 'bedroom', 'safe_room', 'bathroom', 'toilet', 'hall', 'corridor', 'balcony', 'service_balcony', 'storage', 'other'];
const OPEN_KINDS = ['door', 'entrance_door', 'sliding_door', 'glazed_door', 'opening', 'window'];
const PANE_KINDS = ['facade', 'railing'];
const META_REQUIRED = ['source_file', 'tracer', 'trace_date', 'trace_method', 'scale_basis', 'rights_state'];

// ------------------------------------------------------------------ geometry
const shoelaceSigned = (L) => { let a = 0; for (let i = 0; i < L.length; i++) { const [x0, y0] = L[i], [x1, y1] = L[(i + 1) % L.length]; a += x0 * y1 - x1 * y0; } return a / 2; };
const bbox = (L) => { const xs = L.map((p) => p[0]), ys = L.map((p) => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
function pointInPolygon([px, py], L) { let inside = false; for (let i = 0, j = L.length - 1; i < L.length; j = i++) { const [xi, yi] = L[i], [xj, yj] = L[j]; if ((yi > py) !== (yj > py)) { const xint = ((xj - xi) * (py - yi)) / (yj - yi) + xi; if (px < xint) inside = !inside; } } return inside; }
function segIntersect(p1, p2, q1, q2) { // proper or touching intersection of two segments
  const o = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  const onSeg = (a, b, c) => Math.min(a[0], b[0]) - TOL <= c[0] && c[0] <= Math.max(a[0], b[0]) + TOL && Math.min(a[1], b[1]) - TOL <= c[1] && c[1] <= Math.max(a[1], b[1]) + TOL;
  const o1 = o(p1, p2, q1), o2 = o(p1, p2, q2), o3 = o(q1, q2, p1), o4 = o(q1, q2, p2);
  if (o1 !== o2 && o3 !== o4 && o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0) return true;
  if (o1 === 0 && onSeg(p1, p2, q1)) return true; if (o2 === 0 && onSeg(p1, p2, q2)) return true; if (o3 === 0 && onSeg(q1, q2, p1)) return true; if (o4 === 0 && onSeg(q1, q2, p2)) return true; return false;
}
function selfIntersects(L) { const n = L.length; for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue; if (segIntersect(L[i], L[(i + 1) % n], L[j], L[(j + 1) % n])) return [i, j]; } return null; }
function distPointSeg([px, py], [ax, ay], [bx, by]) { const dx = bx - ax, dy = by - ay; const l2 = dx * dx + dy * dy; if (!l2) return Math.hypot(px - ax, py - ay); let t = ((px - ax) * dx + (py - ay) * dy) / l2; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - (ax + t * dx), py - (ay + t * dy)); }
function distPointPolygonBoundary(p, L) { let d = Infinity; for (let i = 0; i < L.length; i++) d = Math.min(d, distPointSeg(p, L[i], L[(i + 1) % L.length])); return d; }
const distPointPolygon = (p, L) => (pointInPolygon(p, L) ? 0 : distPointPolygonBoundary(p, L));
// ear-clipping triangulation (simple polygons, any orientation)
function triangulate(L) { const n = L.length; if (n < 3) return []; const idx = [...Array(n).keys()]; const ccw = shoelaceSigned(L) > 0; const tris = []; const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); const inTri = (p, a, b, c) => { const s1 = cross(a, b, p), s2 = cross(b, c, p), s3 = cross(c, a, p); return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0); }; let guard = 0;
  while (idx.length > 3 && guard++ < 10000) { let clipped = false; for (let i = 0; i < idx.length; i++) { const ia = idx[(i + idx.length - 1) % idx.length], ib = idx[i], ic = idx[(i + 1) % idx.length]; const a = L[ia], b = L[ib], c = L[ic]; const cr = cross(a, b, c); if ((ccw && cr <= 0) || (!ccw && cr >= 0)) continue; let ear = true; for (const k of idx) { if (k === ia || k === ib || k === ic) continue; if (inTri(L[k], a, b, c)) { ear = false; break; } } if (!ear) continue; tris.push([a, b, c]); idx.splice(i, 1); clipped = true; break; } if (!clipped) break; }
  if (idx.length === 3) tris.push([L[idx[0]], L[idx[1]], L[idx[2]]]); return tris; }
// convex clip (Sutherland-Hodgman) of triangle subject by triangle clip -> area
function clipArea(subj, clip) { let out = subj.slice(); const sgn = shoelaceSigned(clip) > 0 ? 1 : -1; for (let i = 0; i < clip.length; i++) { const a = clip[i], b = clip[(i + 1) % clip.length]; const inp = out; out = []; if (!inp.length) break; const side = (p) => sgn * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) >= 0; const inter = (p, q) => { const dx1 = q[0] - p[0], dy1 = q[1] - p[1], dx2 = b[0] - a[0], dy2 = b[1] - a[1]; const den = dx1 * dy2 - dy1 * dx2; if (Math.abs(den) < 1e-12) return p; const t = ((a[0] - p[0]) * dy2 - (a[1] - p[1]) * dx2) / den; return [p[0] + t * dx1, p[1] + t * dy1]; }; for (let k = 0; k < inp.length; k++) { const p = inp[k], q = inp[(k + 1) % inp.length]; const pin = side(p), qin = side(q); if (pin && qin) out.push(q); else if (pin && !qin) out.push(inter(p, q)); else if (!pin && qin) { out.push(inter(p, q)); out.push(q); } } } return out.length >= 3 ? Math.abs(shoelaceSigned(out)) : 0; }
function polygonOverlapArea(A, B) { const ba = bbox(A), bb = bbox(B); if (ba[2] < bb[0] || bb[2] < ba[0] || ba[3] < bb[1] || bb[3] < ba[1]) return 0; const ta = triangulate(A), tb = triangulate(B); let s = 0; for (const x of ta) for (const y of tb) s += clipArea(x, y); return s; }

// ------------------------------------------------------------------ validate
export function validateGeneral(P, opts = {}) {
  const fails = [], warns = [], notes = []; const fail = (c, m) => fails.push(`${c}: ${m}`); const warn = (c, m) => warns.push(`${c}: ${m}`);
  // V1 shape
  for (const k of ['schema_version', 'units', 'axes', 'apartment_id', 'plan_meta', 'rooms', 'walls', 'openings', 'panes', 'camera_points']) if (!(k in P)) fail('V1', `missing top-level field "${k}"`);
  if (P.units !== 'cm') fail('V1', `units must be "cm"`);
  if (!/^0\.2\.\d+(-draft)?$/.test(String(P.schema_version))) warn('V1', `schema_version ${JSON.stringify(P.schema_version)}: a general plan is v0.2.x`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(P.apartment_id))) fail('V1', `apartment_id must be lowercase-kebab`);
  for (const k of ['rooms', 'walls', 'openings', 'panes', 'camera_points']) if (!Array.isArray(P[k])) fail('V1', `"${k}" must be an array`);
  if (fails.length) return finish();
  // V2 meta
  const M = P.plan_meta || {};
  for (const k of META_REQUIRED) if (typeof M[k] !== 'string' || !M[k]) fail('V2', `plan_meta.${k} is required and must be non-empty (A8-13 / C-360-85)`);
  if (!RIGHTS.includes(M.rights_state)) fail('V2', `plan_meta.rights_state must be one of ${RIGHTS.join(' | ')}`); else if (M.rights_state === 'unrecorded') warn('V2', 'rights_state "unrecorded": the tour may never be exposed (A8-13)');
  if (!(M.ceiling_height_cm > 0)) fail('V2', 'plan_meta.ceiling_height_cm must be positive'); if (!(M.scale_px_per_cm > 0)) fail('V2', 'plan_meta.scale_px_per_cm must be positive');
  if (!Array.isArray(M.assumptions)) fail('V2', 'plan_meta.assumptions[] is required'); if (!Array.isArray(M.disagreements)) fail('V2', 'plan_meta.disagreements[] is required');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(M.trace_date))) fail('V2', 'plan_meta.trace_date must be YYYY-MM-DD');
  if (typeof M.source_sha256 === 'string' && M.source_sha256 && !/^[0-9a-f]{64}$/.test(M.source_sha256)) fail('V2', 'plan_meta.source_sha256 must be 64 lowercase hex chars when given'); if (!M.source_sha256) warn('V2', 'plan_meta.source_sha256 is empty: the raster is not pinned (fill it before the gate)');
  const H = M.ceiling_height_cm || 0;
  // V3 ids
  const seen = new Map(); for (const [kind, arr] of [['room', P.rooms], ['wall', P.walls], ['opening', P.openings], ['pane', P.panes], ['camera', P.camera_points]]) for (const o of arr) { if (typeof o?.id !== 'string' || !o.id) { fail('V3', `a ${kind} has no id`); continue; } if (seen.has(o.id)) fail('V3', `duplicate id "${o.id}" (${seen.get(o.id)} and ${kind})`); seen.set(o.id, kind); }
  // V4 rooms
  const rooms = P.rooms; const byRoom = new Map(rooms.map((r) => [r.id, r]));
  for (const r of rooms) { const at = `rooms[${r.id}]`; if (!ROOM_TYPES.includes(r.type)) fail('V4', `${at}: type "${r.type}" not in the enum`); if (typeof r.is_outdoor !== 'boolean') fail('V4', `${at}: is_outdoor must be a boolean`); for (const k of ['name_he', 'name_en']) if (typeof r[k] !== 'string' || !r[k]) fail('V4', `${at}: ${k} must be a non-empty string`);
    const L = r.loop; if (!Array.isArray(L) || L.length < 3) { fail('V4', `${at}: loop needs >= 3 points`); continue; } if (L.some((p) => !Array.isArray(p) || p.length !== 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) { fail('V4', `${at}: loop points must be [number, number]`); continue; }
    if (Math.abs(L[0][0] - L[L.length - 1][0]) <= TOL && Math.abs(L[0][1] - L[L.length - 1][1]) <= TOL) fail('V4', `${at}: loop must NOT repeat the first point at the end`);
    for (let i = 0; i < L.length; i++) { const a = L[i], b = L[(i + 1) % L.length]; if (Math.hypot(b[0] - a[0], b[1] - a[1]) <= TOL) fail('V4', `${at}: loop edge ${i} is zero-length`); }
    const xi = selfIntersects(L); if (xi) fail('V4', `${at}: loop self-intersects (edges ${xi[0]} and ${xi[1]})`);
    const sl = shoelaceSigned(L); if (sl <= 0) fail('V4', `${at}: loop must be positively oriented (shoelace > 0 in the y-down frame), got ${sl.toFixed(1)}`);
    const area = Math.abs(sl); if (typeof r.area_m2 !== 'number') fail('V5', `${at}: area_m2 must be a number`); else { const d = Math.abs(r.area_m2 - area / 1e4) / Math.max(area / 1e4, 1e-6); if (d > AREA_TOL) fail('V5', `${at}: area_m2 ${r.area_m2} differs from the shoelace ${(area / 1e4).toFixed(3)} m2 by ${(d * 100).toFixed(1)}%`); }
    const bb = bbox(L); if (Array.isArray(r.bbox_cm) && r.bbox_cm.some((v, k) => Math.abs(v - bb[k]) > 0.2)) fail('V4', `${at}: bbox_cm != the loop bbox ${JSON.stringify(bb.map((v) => +v.toFixed(1)))}`);
    if (Array.isArray(r.printed_dims_cm)) { const [pw, pd] = r.printed_dims_cm; const cw = bb[2] - bb[0], cd = bb[3] - bb[1]; const rel = Math.min(Math.abs(cw - pw) / pw, Math.abs(cd - pd) / pd, Math.abs(cw - pd) / pd, Math.abs(cd - pw) / pw); if (rel > 0.05) { const ok = (M.disagreements || []).some((d) => d.room_id === r.id); if (!ok) fail('V6', `${at}: the bbox ${cw.toFixed(0)}×${cd.toFixed(0)} differs from the printed ${pw}×${pd} by ${(rel * 100).toFixed(1)}% with no disagreements[] entry (the bbox of a skewed room is not its clear size: record it)`); else notes.push(`${at}: printed vs traced disagreement recorded`); } }
  }
  // V7 overlap (triangulated clip; traced regions cannot overlap, hulls may slightly)
  for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++) { const ov = polygonOverlapArea(rooms[i].loop, rooms[j].loop) / 1e4; if (ov > OVERLAP_FAIL_M2) fail('V7', `rooms ${rooms[i].id} and ${rooms[j].id} overlap by ${ov.toFixed(3)} m2`); else if (ov > OVERLAP_WARN_M2) warn('V7', `rooms ${rooms[i].id} and ${rooms[j].id} overlap by ${ov.toFixed(3)} m2 (a hull or a zone bar)`); }
  // V8 walls
  for (const w of P.walls) { const at = `walls[${w.id}]`; const L = w.polygon_cm; if (!Array.isArray(L) || L.length < 3) { fail('V8', `${at}: polygon_cm needs >= 3 points`); continue; } if (!(w.height_cm > 0)) fail('V8', `${at}: height_cm must be positive`); if (w.height_cm > H + TOL) fail('V8', `${at}: height ${w.height_cm} above the ceiling ${H}`); const xi = selfIntersects(L); if (xi) warn('V8', `${at}: polygon self-touches (edges ${xi[0]}, ${xi[1]}) - a raster piece; the builder extrudes it as drawn`); if (typeof w.area_cm2 === 'number') { const a = Math.abs(shoelaceSigned(L)); if (Math.abs(a - w.area_cm2) / Math.max(a, 1) > 0.15) warn('V8', `${at}: area_cm2 ${w.area_cm2} vs the polygon ${a.toFixed(0)}`); } }
  // V12 panes
  for (const p of P.panes) { const at = `panes[${p.id}]`; if (!PANE_KINDS.includes(p.kind)) fail('V12', `${at}: kind must be facade | railing`); const L = p.polygon_cm; if (!Array.isArray(L) || L.length < 3) fail('V12', `${at}: polygon_cm needs >= 3 points`); if (!(p.head_cm > (p.sill_cm ?? 0))) fail('V12', `${at}: head must be above the sill`); if (p.head_cm > H + TOL) fail('V12', `${at}: head ${p.head_cm} above the ceiling`); if (p.kind === 'railing' && p.head_cm > 130) warn('V12', `${at}: a railing ${p.head_cm} cm high`); }
  // V10 openings
  const allEdges = []; for (const w of P.walls) for (let i = 0; i < w.polygon_cm.length; i++) allEdges.push([w.polygon_cm[i], w.polygon_cm[(i + 1) % w.polygon_cm.length]]); for (const p of P.panes) for (let i = 0; i < p.polygon_cm.length; i++) allEdges.push([p.polygon_cm[i], p.polygon_cm[(i + 1) % p.polygon_cm.length]]);
  const nearStructure = (pt) => { let d = Infinity; for (const [a, b] of allEdges) { d = Math.min(d, distPointSeg(pt, a, b)); if (d <= COVER_CM) return d; } return d; };
  for (const o of P.openings) { const at = `openings[${o.id}]`; if (!OPEN_KINDS.includes(o.kind)) fail('V10', `${at}: kind "${o.kind}" not in the enum`); if (!Array.isArray(o.rooms) || o.rooms.length !== 2) fail('V10', `${at}: rooms must list exactly 2 entries`); else for (const r of o.rooms) if (r !== 'outside' && !byRoom.has(r)) fail('V10', `${at}: unknown room "${r}"`); for (const k of ['a_cm', 'b_cm', 'centre_cm']) if (!Array.isArray(o[k]) || o[k].length !== 2) fail('V10', `${at}: ${k} must be [x, y]`); if (!(o.width_cm > 0)) fail('V10', `${at}: width_cm must be positive`); else if (Array.isArray(o.a_cm) && Array.isArray(o.b_cm)) { const L = Math.hypot(o.b_cm[0] - o.a_cm[0], o.b_cm[1] - o.a_cm[1]); if (Math.abs(L - o.width_cm) > 2) fail('V10', `${at}: width_cm ${o.width_cm} != |b - a| ${L.toFixed(1)}`); }
    if (!(o.sill_cm >= 0 && o.sill_cm < o.head_cm && o.head_cm <= H + TOL)) fail('V10', `${at}: 0 <= sill < head <= ceiling violated`);
    // a door sits IN a wall gap: its centre is half a width from the wall ends by construction, so the ends are what must touch
    // the walls (the builder's Q01b finding, 2026-10-28: a centre-based check invited a snap that slid doors onto solid wall)
    if (o.kind !== 'opening' && Array.isArray(o.a_cm) && Array.isArray(o.b_cm)) { const da = nearStructure(o.a_cm), db = nearStructure(o.b_cm); if (Math.max(da, db) > 30) warn('V10', `${at}: a ${o.kind} whose end is ${Math.max(da, db).toFixed(0)} cm from any wall or pane (the ends of a door touch its jambs)`); }
    if (o.kind === 'opening' && o.rooms?.includes('outside')) fail('V10', `${at}: an opening to the outside must be a door or a window`); }
  // V9 coverage: every room edge has a wall, a pane or an opening within COVER_CM, unless its edge_kinds entry is "open"
  for (const r of rooms) { const L = r.loop; let uncovered = 0, open = 0; for (let i = 0; i < L.length; i++) { const kind = Array.isArray(r.edge_kinds) ? r.edge_kinds[i] : undefined; if (kind === 'open') { open++; continue; } const a = L[i], b = L[(i + 1) % L.length]; const pts = [[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], [(3 * a[0] + b[0]) / 4, (3 * a[1] + b[1]) / 4], [(a[0] + 3 * b[0]) / 4, (a[1] + 3 * b[1]) / 4]]; let ok = true; for (const p of pts) { if (nearStructure(p) <= COVER_CM) continue; let byOpening = false; for (const o of P.openings) if (Array.isArray(o.a_cm) && Array.isArray(o.b_cm) && distPointSeg(p, o.a_cm, o.b_cm) <= COVER_CM + 10) { byOpening = true; break; } if (!byOpening) { ok = false; break; } } if (!ok) uncovered++; } if (uncovered) warn('V9', `rooms[${r.id}]: ${uncovered} of ${L.length} edges have no wall, pane or opening within ${COVER_CM} cm (${open} open edges)`); }
  // V13 fixtures (card Q02b): plain placeholder masses the sales plan draws; each a simple loop inside its room, a height
  // within the ceiling, a kind from the enum; the builder extrudes them, the skin dresses them
  const FIX_KINDS = ['counter', 'tall_unit', 'island', 'table', 'sofa', 'tv_unit', 'bed', 'bedside', 'wardrobe', 'vanity', 'shower', 'wc', 'lounger'];
  for (const f of P.fixtures || []) { const at = `fixtures[${f.id}]`; if (!FIX_KINDS.includes(f.kind)) fail('V13', `${at}: kind "${f.kind}" not in the enum`); const r = byRoom.get(f.room_id); if (!r) { fail('V13', `${at}: room_id "${f.room_id}" unknown`); continue; } const L = f.polygon_cm; if (!Array.isArray(L) || L.length < 3) { fail('V13', `${at}: polygon_cm needs >= 3 points`); continue; } const outside = L.filter((p) => !pointInPolygon(p, r.loop)).length; if (outside) warn('V13', `${at}: ${outside} of ${L.length} corners outside ${r.id} (a box overlapping a wall is extruded as drawn)`); const z0 = f.z_cm ?? 0; if (!(f.height_cm > 0 && z0 >= 0 && z0 + f.height_cm <= H + TOL)) fail('V13', `${at}: 0 <= z_cm, height > 0, z + height <= ceiling violated`); }
  // V11 cameras
  for (const c of P.camera_points) { const at = `camera_points[${c.id}]`; const r = byRoom.get(c.room_id); if (!r) { fail('V11', `${at}: room_id "${c.room_id}" unknown`); continue; } if (!pointInPolygon([c.x, c.y], r.loop)) fail('V11', `${at}: (${c.x}, ${c.y}) is not inside ${r.id}`); if (!(c.z > 0 && c.z < H)) fail('V11', `${at}: z must be within (0, ceiling)`); if (!(c.yaw_deg >= 0 && c.yaw_deg < 360)) fail('V11', `${at}: yaw_deg must be in [0, 360)`); if (r.is_outdoor) notes.push(`${at}: in the outdoor room ${r.id} (allowed for a general plan: a roofed terrace)`); }
  // report
  const inA = rooms.filter((r) => !r.is_outdoor).reduce((s, r) => s + (r.area_m2 || 0), 0), outA = rooms.filter((r) => r.is_outdoor).reduce((s, r) => s + (r.area_m2 || 0), 0);
  notes.push(`rooms ${rooms.length} (indoor clear floor ${inA.toFixed(2)} m2, outdoor ${outA.toFixed(2)} m2) · walls ${P.walls.length} pieces · openings ${P.openings.length} · panes ${P.panes.length} · cameras ${P.camera_points.length}`);
  return finish();
  function finish() { const res = { ok: fails.length === 0, fails, warns, notes }; if (!opts.quiet) { if (opts.json) console.log(JSON.stringify(res, null, 2)); else { console.log(`validate-plan-general: ${res.ok ? 'CLEAN' : 'FAIL'} - ${fails.length} fail, ${warns.length} warn`); for (const f of fails) console.log('  FAIL ' + f); for (const w of warns) console.log('  warn ' + w); for (const n of notes) console.log('  note ' + n); } } return res.ok ? 0 : 1; }
}

const isMain = process.argv[1] && /validate-plan-general\.mjs$/.test(process.argv[1].replace(/\\/g, '/'));
if (isMain) { const args = ARGV.slice(2); const file = args.find((a) => !a.startsWith('--')); if (!file) { console.error('usage: node pipeline/validate-plan-general.mjs <plan.json> [--json] [--quiet]'); exit(2); } let P; try { P = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { console.error(`parse error: ${e.message}`); exit(2); } exit(validateGeneral(P, { json: args.includes('--json'), quiet: args.includes('--quiet') })); }
