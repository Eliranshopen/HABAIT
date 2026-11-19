#!/usr/bin/env node
// validate-plan.mjs - the enforcement point for pipeline/SCHEMA.md (CONTRACT C-360-81, C-360-85).
//
//   node pipeline/validate-plan.mjs tours/<id>/plan.json [--json] [--quiet]
//
// exit 0 = clean (warnings allowed) | 1 = at least one FAIL | 2 = usage / parse error.
// No dependencies. Node >= 20.

import { readFileSync } from 'node:fs';
import { argv, exit } from 'node:process';

const TOL = 0.05;                 // cm - coordinate coincidence tolerance
const AREA_TOL = 0.05;            // 5 % - SCHEMA 4 / C-360-81
const PRINTED_TOL = 0.05;         // 5 % - SCHEMA 8
const RIGHTS = ['own', 'licensed', 'partner-supplied', 'unrecorded'];   // C-360-85, CLOSED
const ROOM_TYPES = ['living', 'kitchen', 'bedroom', 'safe_room', 'bathroom', 'toilet',
  'hall', 'corridor', 'balcony', 'service_balcony', 'storage', 'other'];
const WALL_KINDS = ['exterior', 'interior', 'parapet', 'virtual'];
const OPEN_KINDS = ['door', 'entrance_door', 'sliding_door', 'glazed_door', 'opening', 'window'];
const META_REQUIRED = ['source_file', 'source_sha256', 'tracer', 'trace_date', 'trace_method',
  'scale_basis', 'rights_state'];

const fails = [];
const warns = [];
const notes = [];
const fail = (code, msg) => fails.push(`${code}: ${msg}`);
const warn = (code, msg) => warns.push(`${code}: ${msg}`);

// ---------------------------------------------------------------- geometry --
const near = (a, b, t = TOL) => Math.abs(a - b) <= t;

function shoelace(loop) {
  let a = 0;
  for (let i = 0; i < loop.length; i++) {
    const [x0, y0] = loop[i], [x1, y1] = loop[(i + 1) % loop.length];
    a += x0 * y1 - x1 * y0;
  }
  return Math.abs(a) / 2;
}

function bbox(loop) {
  const xs = loop.map(p => p[0]), ys = loop.map(p => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

// Exact decomposition of a rectilinear simple polygon into disjoint rectangles,
// by horizontal band sweep. Second, independent area computation - and the basis
// of the exact (non-sampling) overlap test.
function bands(loop) {
  const ys = [...new Set(loop.map(p => p[1]))].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < ys.length - 1; i++) {
    const y0 = ys[i], y1 = ys[i + 1];
    if (y1 - y0 < 1e-9) continue;
    const ym = (y0 + y1) / 2;
    // x of every edge crossing this band's midline
    const xs = [];
    for (let k = 0; k < loop.length; k++) {
      const [ax, ay] = loop[k], [bx, by] = loop[(k + 1) % loop.length];
      if (ax !== bx) continue;                       // horizontal edge - never crosses
      if (Math.min(ay, by) < ym && ym < Math.max(ay, by)) xs.push(ax);
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) out.push([xs[k], y0, xs[k + 1], y1]);
  }
  return out;
}

function rectOverlap(a, b) {
  const w = Math.min(a[2], b[2]) - Math.max(a[0], b[0]);
  const h = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
  return (w > TOL && h > TOL) ? w * h : 0;
}

function pointInPolygon([px, py], loop) {
  let inside = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const [xi, yi] = loop[i], [xj, yj] = loop[j];
    if ((yi > py) !== (yj > py)) {
      const xint = (xj - xi) * (py - yi) / (yj - yi) + xi;
      if (px < xint) inside = !inside;
    }
  }
  return inside;
}

function selfIntersects(loop) {
  const n = loop.length;
  const seg = i => [loop[i], loop[(i + 1) % n]];
  const between = (v, a, b) => v >= Math.min(a, b) - TOL && v <= Math.max(a, b) + TOL;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue;
      const [p1, p2] = seg(i), [q1, q2] = seg(j);
      const iVert = near(p1[0], p2[0]), jVert = near(q1[0], q2[0]);
      if (iVert === jVert) {                       // parallel - overlap counts as a touch
        const fixedSame = iVert ? near(p1[0], q1[0]) : near(p1[1], q1[1]);
        if (!fixedSame) continue;
        const [a0, a1] = iVert ? [p1[1], p2[1]] : [p1[0], p2[0]];
        const [b0, b1] = iVert ? [q1[1], q2[1]] : [q1[0], q2[0]];
        const lo = Math.max(Math.min(a0, a1), Math.min(b0, b1));
        const hi = Math.min(Math.max(a0, a1), Math.max(b0, b1));
        if (hi - lo > TOL) return [i, j];
      } else {
        const [v, h] = iVert ? [[p1, p2], [q1, q2]] : [[q1, q2], [p1, p2]];
        const vx = v[0][0], hy = h[0][1];
        if (between(hy, v[0][1], v[1][1]) && between(vx, h[0][0], h[1][0])) {
          const touchesEnd =
            (near(vx, h[0][0]) || near(vx, h[1][0])) && (near(hy, v[0][1]) || near(hy, v[1][1]));
          if (!touchesEnd) return [i, j];
        }
      }
    }
  }
  return null;
}

// A wall's long axis and its extent along it (openings are measured along this axis).
function wallGeom(w) {
  const [x0, y0, x1, y1] = w.rect_cm;
  const dx = x1 - x0, dy = y1 - y0;
  if (w.kind === 'virtual') {
    const axis = near(dx, 0) ? 'y' : 'x';
    return { axis, lo: axis === 'y' ? y0 : x0, hi: axis === 'y' ? y1 : x1 };
  }
  const axis = dx >= dy ? 'x' : 'y';
  return axis === 'x' ? { axis: 'x', lo: x0, hi: x1 } : { axis: 'y', lo: y0, hi: y1 };
}

// ALL FOUR sides of a wall footprint, as {vertical, fixed, lo, hi} face lines.
// A wall is a rectangle: its two long faces AND its two end faces can bound a room.
// (A virtual wall is degenerate and contributes exactly one face - itself.)
function wallFaces(w) {
  const [x0, y0, x1, y1] = w.rect_cm;
  if (w.kind === 'virtual') {
    return near(x0, x1)
      ? [{ vertical: true, fixed: x0, lo: y0, hi: y1 }]
      : [{ vertical: false, fixed: y0, lo: x0, hi: x1 }];
  }
  return [
    { vertical: true, fixed: x0, lo: y0, hi: y1 },
    { vertical: true, fixed: x1, lo: y0, hi: y1 },
    { vertical: false, fixed: y0, lo: x0, hi: x1 },
    { vertical: false, fixed: y1, lo: x0, hi: x1 },
  ];
}

// ------------------------------------------------------------------- main --
const args = argv.slice(2).filter(a => !a.startsWith('--'));
const flags = new Set(argv.slice(2).filter(a => a.startsWith('--')));
if (args.length !== 1) {
  console.error('usage: node pipeline/validate-plan.mjs <plan.json> [--json] [--quiet]');
  exit(2);
}
let P;
try {
  P = JSON.parse(readFileSync(args[0], 'utf8'));
} catch (e) {
  console.error(`E-PARSE: cannot read/parse ${args[0]}: ${e.message}`);
  exit(2);
}

// --- a GENERAL-polygon plan (SCHEMA v0.2.0, `geometry: "general"`, D-WQ-28) is validated by its own module;
//     everything below is the rectilinear v0.1.0 path, unchanged.
if (P.geometry === 'general' || P.plan_meta?.geometry === 'general') {
  const { validateGeneral } = await import('./validate-plan-general.mjs');
  exit(validateGeneral(P, { json: flags.has('--json'), quiet: flags.has('--quiet') }));
}

// --- V1 top level
for (const k of ['schema_version', 'units', 'axes', 'apartment_id', 'plan_meta',
                 'rooms', 'walls', 'openings', 'camera_points']) {
  if (!(k in P)) fail('V1', `missing top-level field "${k}"`);
}
if (P.units !== 'cm') fail('V1', `units must be "cm" (SCHEMA intro), got ${JSON.stringify(P.units)}`);
if (typeof P.schema_version !== 'string' || !/^\d+\.\d+\.\d+$/.test(P.schema_version))
  fail('V1', `schema_version must be MAJOR.MINOR.PATCH, got ${JSON.stringify(P.schema_version)}`);
if (typeof P.apartment_id !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(P.apartment_id))
  fail('V1', `apartment_id must be lowercase-kebab (C-360-77), got ${JSON.stringify(P.apartment_id)}`);
for (const k of ['rooms', 'walls', 'openings', 'camera_points'])
  if (!Array.isArray(P[k])) fail('V1', `"${k}" must be an array`);

const rooms = Array.isArray(P.rooms) ? P.rooms : [];
const walls = Array.isArray(P.walls) ? P.walls : [];
const openings = Array.isArray(P.openings) ? P.openings : [];
const cams = Array.isArray(P.camera_points) ? P.camera_points : [];

// --- V2 plan_meta (C-360-85)
const M = P.plan_meta ?? {};
for (const k of META_REQUIRED) {
  const v = M[k];
  if (typeof v !== 'string' || v.trim() === '')
    fail('V2', `plan_meta.${k} is required and must be a non-empty string (CONTRACT A8-13 / C-360-85)`);
}
if (M.rights_state !== undefined && !RIGHTS.includes(M.rights_state))
  fail('V2', `plan_meta.rights_state must be one of ${RIGHTS.join(' | ')} (closed set, C-360-85), got ${JSON.stringify(M.rights_state)}`);
if (M.rights_state === 'unrecorded')
  warn('V2', 'plan_meta.rights_state is "unrecorded" - this tour may NEVER be exposed to anyone and must be flagged at the gate (A8-13)');
if (!(typeof M.ceiling_height_cm === 'number' && M.ceiling_height_cm > 0))
  fail('V2', 'plan_meta.ceiling_height_cm must be a positive number');
if (!(typeof M.scale_px_per_cm === 'number' && M.scale_px_per_cm > 0))
  fail('V2', 'plan_meta.scale_px_per_cm must be a positive number');
if (!Array.isArray(M.assumptions))
  fail('V2', 'plan_meta.assumptions[] is required (may be empty) - every number not on the drawing');
if (!Array.isArray(M.disagreements))
  fail('V2', 'plan_meta.disagreements[] is required (may be empty)');
if (typeof M.source_sha256 === 'string' && !/^[0-9a-f]{64}$/.test(M.source_sha256))
  fail('V2', 'plan_meta.source_sha256 must be 64 lowercase hex chars');
if (typeof M.trace_date === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(M.trace_date))
  fail('V2', 'plan_meta.trace_date must be YYYY-MM-DD');
if (!Array.isArray(M.raster_origin_px) || M.raster_origin_px.length !== 2)
  fail('V2', 'plan_meta.raster_origin_px must be [x, y]');

const disagreeing = new Set((M.disagreements ?? []).map(d => `${d.room}|${d.axis}`));
for (const d of M.disagreements ?? []) {
  for (const k of ['id', 'room', 'printed_cm', 'traced_cm', 'delta_cm', 'axis', 'resolution', 'why'])
    if (d[k] === undefined || d[k] === null || d[k] === '')
      fail('V2', `plan_meta.disagreements[${d.id ?? '?'}] is missing "${k}" (SCHEMA 8)`);
  if (d.axis !== undefined && !['x', 'y'].includes(d.axis))
    fail('V2', `plan_meta.disagreements[${d.id}].axis must be "x" or "y"`);
}

// --- V3 id uniqueness (whole file)
const seen = new Map();
for (const [kind, arr] of [['room', rooms], ['wall', walls], ['opening', openings], ['camera_point', cams]])
  for (const o of arr) {
    if (typeof o?.id !== 'string' || !o.id) { fail('V3', `a ${kind} has no id`); continue; }
    if (seen.has(o.id)) fail('V3', `duplicate id "${o.id}" (${seen.get(o.id)} and ${kind})`);
    else seen.set(o.id, kind);
  }
const roomById = new Map(rooms.map(r => [r.id, r]));
const wallById = new Map(walls.map(w => [w.id, w]));
const isRoomRef = v => v === 'outside' || roomById.has(v);

// --- V4/V5 rooms
const roomBands = new Map();
for (const r of rooms) {
  const at = `room ${r.id}`;
  if (!ROOM_TYPES.includes(r.type)) fail('V4', `${at}: type "${r.type}" not in the enum`);
  if (typeof r.is_outdoor !== 'boolean') fail('V4', `${at}: is_outdoor must be a boolean`);
  for (const k of ['name_he', 'name_en'])
    if (typeof r[k] !== 'string' || !r[k]) fail('V4', `${at}: ${k} must be a non-empty string`);
  const loop = r.loop;
  if (!Array.isArray(loop) || loop.length < 4) { fail('V4', `${at}: loop needs >= 4 points`); continue; }
  if (loop.some(p => !Array.isArray(p) || p.length !== 2 || p.some(v => typeof v !== 'number')))
    { fail('V4', `${at}: loop points must be [number, number]`); continue; }
  const first = loop[0], last = loop[loop.length - 1];
  if (near(first[0], last[0]) && near(first[1], last[1]))
    fail('V4', `${at}: loop must NOT repeat the first point at the end (SCHEMA 4)`);
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i], b = loop[(i + 1) % loop.length];
    if (!near(a[0], b[0]) && !near(a[1], b[1]))
      fail('V4', `${at}: loop edge ${i} (${a}) -> (${b}) is not axis-aligned (rectilinear only)`);
    if (near(a[0], b[0]) && near(a[1], b[1]))
      fail('V4', `${at}: loop edge ${i} is zero-length`);
  }
  const xi = selfIntersects(loop);
  if (xi) fail('V4', `${at}: loop self-intersects (edges ${xi[0]} and ${xi[1]})`);

  const sl = shoelace(loop);
  const bs = bands(loop);
  roomBands.set(r.id, bs);
  const ba = bs.reduce((s, b) => s + (b[2] - b[0]) * (b[3] - b[1]), 0);
  if (sl <= 0) fail('V4', `${at}: loop has zero area`);
  if (Math.abs(sl - ba) > Math.max(1, sl * 1e-6))
    fail('V5', `${at}: the two independent area computations disagree - shoelace ${(sl / 1e4).toFixed(3)} m2 vs band decomposition ${(ba / 1e4).toFixed(3)} m2 (the loop is probably not a simple rectilinear polygon)`);
  if (typeof r.area_m2 !== 'number') fail('V5', `${at}: area_m2 must be a number`);
  else {
    const d = Math.abs(r.area_m2 - sl / 1e4) / (sl / 1e4);
    if (d > AREA_TOL)
      fail('V5', `${at}: area_m2 ${r.area_m2} differs from the shoelace area ${(sl / 1e4).toFixed(3)} m2 by ${(d * 100).toFixed(1)}% (> ${AREA_TOL * 100}%)`);
    else notes.push(`area  ${r.id.padEnd(20)} declared ${r.area_m2.toFixed(3)} m2  shoelace ${(sl / 1e4).toFixed(3)}  bands ${(ba / 1e4).toFixed(3)}  delta ${(d * 100).toFixed(2)}%`);
  }
  const bb = bbox(loop);
  if (!Array.isArray(r.bbox_cm) || r.bbox_cm.length !== 4 || r.bbox_cm.some((v, i) => !near(v, bb[i])))
    fail('V4', `${at}: bbox_cm ${JSON.stringify(r.bbox_cm)} != the loop bbox ${JSON.stringify(bb.map(v => +v.toFixed(1)))}`);
  const cd = [bb[2] - bb[0], bb[3] - bb[1]];
  if (!Array.isArray(r.clear_dims_cm) || r.clear_dims_cm.length !== 2 ||
      !near(r.clear_dims_cm[0], cd[0], 0.11) || !near(r.clear_dims_cm[1], cd[1], 0.11))
    fail('V4', `${at}: clear_dims_cm ${JSON.stringify(r.clear_dims_cm)} != the loop bbox size ${JSON.stringify(cd.map(v => +v.toFixed(1)))}`);

  // V6 printed vs clear (SCHEMA 8)
  if (r.printed_dims_cm !== null && r.printed_dims_cm !== undefined) {
    if (!Array.isArray(r.printed_dims_cm) || r.printed_dims_cm.length !== 2)
      fail('V6', `${at}: printed_dims_cm must be [w, d] or null`);
    else {
      ['x', 'y'].forEach((axis, i) => {
        const pr = r.printed_dims_cm[i], cl = cd[i];
        const rel = Math.abs(cl - pr) / pr;
        const line = `printed ${r.id.padEnd(20)} ${axis}: printed ${String(pr).padStart(5)} cm  traced ${cl.toFixed(1).padStart(6)} cm  delta ${(cl - pr >= 0 ? '+' : '')}${(cl - pr).toFixed(1)} cm (${(rel * 100).toFixed(2)}%)`;
        if (rel > PRINTED_TOL) {
          if (disagreeing.has(`${r.id}|${axis}`)) notes.push(line + '   [DISAGREEMENT, recorded]');
          else fail('V6', `${at}: traced ${axis} ${cl.toFixed(1)} cm differs from the printed ${pr} cm by ${(rel * 100).toFixed(1)}% and there is no matching plan_meta.disagreements[] entry (SCHEMA 8)`);
        } else notes.push(line);
      });
    }
  }
}

// --- V7 no room-room overlap (exact)
for (let i = 0; i < rooms.length; i++)
  for (let j = i + 1; j < rooms.length; j++) {
    const A = roomBands.get(rooms[i].id) ?? [], B = roomBands.get(rooms[j].id) ?? [];
    let ov = 0;
    for (const a of A) for (const b of B) ov += rectOverlap(a, b);
    if (ov > 1)
      fail('V7', `rooms ${rooms[i].id} and ${rooms[j].id} overlap by ${(ov / 1e4).toFixed(3)} m2`);
  }

// --- V8 walls
for (const w of walls) {
  const at = `wall ${w.id}`;
  if (!WALL_KINDS.includes(w.kind)) fail('V8', `${at}: kind "${w.kind}" not in the enum`);
  const rc = w.rect_cm;
  if (!Array.isArray(rc) || rc.length !== 4 || rc.some(v => typeof v !== 'number'))
    { fail('V8', `${at}: rect_cm must be [x0,y0,x1,y1]`); continue; }
  if (rc[0] > rc[2] + TOL || rc[1] > rc[3] + TOL)
    fail('V8', `${at}: rect_cm must be ordered x0<=x1, y0<=y1`);
  const degen = near(rc[0], rc[2]) || near(rc[1], rc[3]);
  if (w.kind === 'virtual' && !degen)
    fail('V8', `${at}: a virtual wall must be degenerate in exactly one axis (zero thickness)`);
  if (w.kind !== 'virtual' && degen)
    fail('V8', `${at}: a non-virtual wall must have a non-zero footprint`);
  if (typeof w.height_cm !== 'number' || w.height_cm < 0)
    fail('V8', `${at}: height_cm must be a number >= 0`);
  if (w.kind === 'virtual' && w.height_cm !== 0)
    fail('V8', `${at}: a virtual wall must have height_cm 0 (it has no geometry)`);
  if (w.kind !== 'virtual' && w.height_cm > (M.ceiling_height_cm ?? Infinity) + TOL)
    fail('V8', `${at}: height_cm ${w.height_cm} exceeds the ceiling height`);
  if (!Array.isArray(w.sides) || w.sides.length === 0)
    fail('V8', `${at}: sides[] must list at least one room id or "outside"`);
  else for (const s of w.sides)
    if (!isRoomRef(s)) fail('V8', `${at}: sides[] references unknown room "${s}"`);
}

// --- V9 every room loop edge is covered by a face of a wall that lists that room
for (const r of rooms) {
  const mine = walls.filter(w => Array.isArray(w.sides) && w.sides.includes(r.id));
  const loop = Array.isArray(r.loop) ? r.loop : [];
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i], b = loop[(i + 1) % loop.length];
    const vert = near(a[0], b[0]);
    const fixed = vert ? a[0] : a[1];
    const lo = vert ? Math.min(a[1], b[1]) : Math.min(a[0], b[0]);
    const hi = vert ? Math.max(a[1], b[1]) : Math.max(a[0], b[0]);
    // collect covered sub-intervals from any FACE (all four sides) of a wall listing this room
    const cov = [];
    for (const w of mine)
      for (const f of wallFaces(w)) {
        if (f.vertical !== vert) continue;
        if (!near(f.fixed, fixed, 0.6)) continue;
        const s = Math.max(lo, f.lo - TOL), e = Math.min(hi, f.hi + TOL);
        if (e - s > TOL) cov.push([s, e]);
      }
    cov.sort((p, q) => p[0] - q[0]);
    let reach = lo, gap = null;
    for (const [s, e] of cov) {
      if (s > reach + 0.6) { gap = [reach, s]; break; }
      reach = Math.max(reach, e);
    }
    if (!gap && reach < hi - 0.6) gap = [reach, hi];
    if (gap)
      fail('V9', `room ${r.id}: loop edge ${i} (${vert ? 'x' : 'y'}=${fixed.toFixed(1)}, ${lo.toFixed(1)}..${hi.toFixed(1)}) is not covered by any wall listing this room - uncovered ${gap[0].toFixed(1)}..${gap[1].toFixed(1)}`);
  }
}

// --- V10 openings
for (const o of openings) {
  const at = `opening ${o.id}`;
  if (!OPEN_KINDS.includes(o.kind)) fail('V10', `${at}: kind "${o.kind}" not in the enum`);
  const w = wallById.get(o.wall_id);
  if (!w) { fail('V10', `${at}: wall_id "${o.wall_id}" does not exist`); continue; }
  const g = wallGeom(w);
  if (o.axis !== g.axis)
    fail('V10', `${at}: axis "${o.axis}" does not match its wall's long axis "${g.axis}"`);
  if (!(typeof o.start_cm === 'number' && typeof o.end_cm === 'number' && o.end_cm > o.start_cm))
    fail('V10', `${at}: needs start_cm < end_cm`);
  else {
    if (!near(o.width_cm, o.end_cm - o.start_cm, 0.11))
      fail('V10', `${at}: width_cm ${o.width_cm} != end-start ${(o.end_cm - o.start_cm).toFixed(1)}`);
    if (o.start_cm < g.lo - TOL || o.end_cm > g.hi + TOL)
      fail('V10', `${at}: span ${o.start_cm}..${o.end_cm} falls outside its wall's extent ${g.lo.toFixed(1)}..${g.hi.toFixed(1)}`);
  }
  if (!(typeof o.sill_cm === 'number' && typeof o.head_cm === 'number' && o.sill_cm >= 0 && o.head_cm > o.sill_cm))
    fail('V10', `${at}: needs 0 <= sill_cm < head_cm`);
  else if (w.kind !== 'virtual' && o.head_cm > w.height_cm + TOL)
    fail('V10', `${at}: head_cm ${o.head_cm} exceeds its wall's height ${w.height_cm}`);
  if (!Array.isArray(o.rooms) || o.rooms.length !== 2)
    fail('V10', `${at}: rooms must have exactly 2 entries - it IS the graph edge (SCHEMA 6)`);
  else {
    for (const s of o.rooms) {
      if (!isRoomRef(s)) fail('V10', `${at}: rooms references unknown room "${s}"`);
      else if (Array.isArray(w.sides) && !w.sides.includes(s))
        fail('V10', `${at}: rooms lists "${s}" but its wall ${w.id} does not bound it`);
    }
    if (o.rooms[0] === o.rooms[1]) fail('V10', `${at}: rooms lists the same side twice`);
  }
}

// --- V11 camera points
for (const c of cams) {
  const at = `camera point ${c.id}`;
  const r = roomById.get(c.room_id);
  if (!r) { fail('V11', `${at}: room_id "${c.room_id}" does not exist`); continue; }
  if (r.is_outdoor)
    fail('V11', `${at}: is in outdoor room ${r.id} - an outdoor room carries NO camera point (product rule, REPORT 2.1)`);
  if (!(typeof c.x === 'number' && typeof c.y === 'number'))
    { fail('V11', `${at}: x and y must be numbers`); continue; }
  if (!pointInPolygon([c.x, c.y], r.loop))
    fail('V11', `${at}: (${c.x}, ${c.y}) is not inside room ${r.id}`);
  if (!(typeof c.z === 'number' && c.z > 0 && c.z < (M.ceiling_height_cm ?? Infinity)))
    fail('V11', `${at}: z must satisfy 0 < z < ceiling_height_cm`);
  if (!(typeof c.yaw_deg === 'number' && c.yaw_deg >= 0 && c.yaw_deg < 360))
    fail('V11', `${at}: yaw_deg must be in [0, 360)`);
}
const covered = new Set(cams.map(c => c.room_id));
for (const r of rooms)
  if (!r.is_outdoor && !covered.has(r.id))
    warn('V11', `indoor room ${r.id} has no camera point - it will not be walkable`);

// ------------------------------------------------------------------ output --
if (flags.has('--json')) {
  console.log(JSON.stringify({ ok: fails.length === 0, fails, warns, notes }, null, 2));
} else if (!flags.has('--quiet')) {
  const inA = rooms.filter(r => !r.is_outdoor).reduce((s, r) => s + (r.area_m2 ?? 0), 0);
  const outA = rooms.filter(r => r.is_outdoor).reduce((s, r) => s + (r.area_m2 ?? 0), 0);
  console.log(`validate-plan ${args[0]}`);
  console.log(`  schema ${P.schema_version}  units ${P.units}  apartment ${P.apartment_id}`);
  console.log(`  ${rooms.length} rooms  ${walls.length} walls  ${openings.length} openings  ${cams.length} camera points`);
  console.log(`  indoor clear floor ${inA.toFixed(2)} m2   outdoor ${outA.toFixed(2)} m2`);
  console.log('');
  for (const n of notes) console.log(`  . ${n}`);
  if (warns.length) { console.log(''); for (const w of warns) console.log(`  WARN  ${w}`); }
  console.log('');
  if (fails.length) { for (const f of fails) console.log(`  FAIL  ${f}`); console.log(`\n${fails.length} FAIL, ${warns.length} WARN`); }
  else console.log(`OK - 0 FAIL, ${warns.length} WARN`);
}
exit(fails.length ? 1 : 0);
