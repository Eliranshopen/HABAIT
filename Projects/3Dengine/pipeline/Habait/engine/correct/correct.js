// correct.js - the intake correction screen (card 02, A2).
//
// One ES module, two lives:
//   * in Node (serve.mjs, the selftest, fixtures/make-fixtures.mjs) it is the pure core:
//     geometry, the edit operations (ops), the live checks, the schema-integrity diff;
//   * in the browser (index.html) the same core plus the UI at the bottom (boot()).
// No dependencies, no network. Coordinates: plan.json centimetres (360walkaround/pipeline/SCHEMA.md:
// x right, y DOWN); the raster is reached through report.raster (cm -> px affine).

export const TOL_PCT = 3;            // card 01 acceptance: |measured - printed| / printed <= 3 %
export const SNAP_PX = 14;           // snap radius in screen pixels

// Dimensions read left-to-right inside Hebrew text: an LTR isolate, else bidi prints 212×210 as 210×212.
export const dimsTxt = (wd) => `⁦${wd.map(Math.round).join('×')}⁩`;

// ------------------------------------------------------------------ vocab --
// Room presets: what Eliran taps. Each one sets name_he, name_en, type, is_outdoor (validator enum).
export const ROOM_PRESETS = [
  { he: 'סלון', en: 'Living room', type: 'living' },
  { he: 'חדר דיור', en: 'Living room', type: 'living' },
  { he: 'מטבח', en: 'Kitchen', type: 'kitchen' },
  { he: 'פינת אוכל', en: 'Dining corner', type: 'hall' },
  { he: 'כניסה', en: 'Entrance', type: 'hall' },
  { he: 'מסדרון', en: 'Corridor', type: 'corridor' },
  { he: 'חדר שינה', en: 'Bedroom', type: 'bedroom' },
  { he: 'חדר שינה הורים', en: 'Main bedroom', type: 'bedroom' },
  { he: 'ממ"ד', en: 'Safe room', type: 'safe_room' },
  { he: 'חדר רחצה כללי', en: 'Guest bathroom', type: 'bathroom' },
  { he: 'חדר רחצה הורים', en: 'Main bathroom', type: 'bathroom' },
  { he: 'שירותים', en: 'Toilet', type: 'toilet' },
  { he: 'פינת ארונות', en: 'Wardrobe corner', type: 'storage' },
  { he: 'מחסן', en: 'Storage', type: 'storage' },
  { he: 'מרפסת שמש', en: 'Sun terrace', type: 'balcony' },
  { he: 'מרפסת שירות', en: 'Service balcony', type: 'service_balcony' },
];
// Names that mean the same room (the drawing says one, a plan may say the other).
export const NAME_SYNONYMS = [['סלון', 'חדר דיור'], ['חדר שינה הורים', 'חדר הורים'], ['פינת ארונות', 'חדר ארונות']];
export const sameName = (a, b) => a === b || NAME_SYNONYMS.some((s) => s.includes(a) && s.includes(b));
export const OUTDOOR_TYPES = new Set(['balcony', 'service_balcony']);
export const TYPE_HE = {
  living: 'סלון', kitchen: 'מטבח', bedroom: 'חדר שינה', safe_room: 'ממ"ד', bathroom: 'חדר רחצה',
  toilet: 'שירותים', hall: 'כניסה / פינה פתוחה', corridor: 'מסדרון', balcony: 'מרפסת',
  service_balcony: 'מרפסת שירות', storage: 'אחסון', other: 'אחר',
};
// Opening kinds (validator enum). `main` = the three buttons on screen; the rest under advanced settings.
export const OPENING_KINDS = {
  door: { he: 'דלת', width: 90, sill: 0, head: 215, main: true },
  window: { he: 'חלון', width: 120, sill: 90, head: 215, main: true },
  opening: { he: 'פתח', width: 150, sill: 0, head: null, main: true },        // head = ceiling
  entrance_door: { he: 'דלת כניסה', width: 110, sill: 0, head: 215 },
  sliding_door: { he: 'דלת הזזה', width: 180, sill: 0, head: 215 },
  glazed_door: { he: 'דלת זכוכית', width: 120, sill: 0, head: 215 },
};

// --------------------------------------------------------------- geometry --
const r1 = (v) => Math.round(v * 10) / 10;
export const shoelaceSigned = (L) => { let a = 0; for (let i = 0; i < L.length; i++) { const [x0, y0] = L[i], [x1, y1] = L[(i + 1) % L.length]; a += x0 * y1 - x1 * y0; } return a / 2; };
export const bbox = (L) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of L) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return [x0, y0, x1, y1]; };
export function pointInPolygon([px, py], L) {
  let inside = false;
  for (let i = 0, j = L.length - 1; i < L.length; j = i++) {
    const [xi, yi] = L[i], [xj, yj] = L[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function closestOnSegment(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
  const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) : 0;
  const q = [a[0] + t * dx, a[1] + t * dy];
  return { q, t, d: Math.hypot(p[0] - q[0], p[1] - q[1]) };
}
function segX(a, b, c, d) {               // proper intersection of segments ab and cd
  const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}
export function selfIntersects(L) {
  const n = L.length;
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue;
    if (segX(L[i], L[(i + 1) % n], L[j], L[(j + 1) % n])) return [i, j];
  }
  return null;
}
// Dominant wall direction of a loop (length-weighted angle histogram, mod 90).
export function dominantAngle(L) {
  const h = new Float64Array(90);
  for (let i = 0; i < L.length; i++) {
    const a = L[i], b = L[(i + 1) % L.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ang = ((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI) % 90 + 90) % 90;
    h[Math.round(ang) % 90] += len;
  }
  let best = 0, bv = -1;
  for (let k = 0; k < 90; k++) { let v = 0; for (let d = -2; d <= 2; d++) v += h[(k + d + 90) % 90]; if (v > bv) { bv = v; best = k; } }
  return best;
}
// The room's size along its own walls (the plan is skewed, so the axis bbox is not the room size).
export function orientedDims(L) {
  const a = dominantAngle(L) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const [x, y] of L) { const u = x * c + y * s, v = -x * s + y * c; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  return [r1(u1 - u0), r1(v1 - v0)];
}
// Deviation of measured [a,b] against printed [w,d], in the better of the two pairings. Returns
// { pct, measured: [mw, md] ordered like printed }.
export function deviation(measured, printed) {
  if (!Array.isArray(printed) || !Array.isArray(measured)) return null;
  const [w, d] = printed, [a, b] = measured;
  const p1 = Math.max(Math.abs(a - w) / w, Math.abs(b - d) / d);
  const p2 = Math.max(Math.abs(b - w) / w, Math.abs(a - d) / d);
  return p1 <= p2 ? { pct: r1(p1 * 100), measured: [a, b] } : { pct: r1(p2 * 100), measured: [b, a] };
}
// An interior point for a label / a camera: the room's camera if inside, else a grid search for the
// point farthest from the boundary.
export function interiorPoint(L, hint) {
  if (hint && pointInPolygon(hint, L)) return hint;
  const [x0, y0, x1, y1] = bbox(L);
  let best = null, bd = -1;
  const N = 24;
  for (let i = 1; i < N; i++) for (let j = 1; j < N; j++) {
    const p = [x0 + (x1 - x0) * i / N, y0 + (y1 - y0) * j / N];
    if (!pointInPolygon(p, L)) continue;
    let d = Infinity;
    for (let k = 0; k < L.length; k++) d = Math.min(d, closestOnSegment(p, L[k], L[(k + 1) % L.length]).d);
    if (d > bd) { bd = d; best = p; }
  }
  return best || [(x0 + x1) / 2, (y0 + y1) / 2];
}

// ------------------------------------------------------- derived fields ----
// Recompute exactly the fields validate-plan-general checks against the loop; nothing else is touched.
export function recomputeRoom(r) {
  const L = r.loop;
  r.area_m2 = Math.round(Math.abs(shoelaceSigned(L)) / 10) / 1000;
  const bb = bbox(L);
  if ('bbox_cm' in r) r.bbox_cm = bb.map(r1);
  if ('clear_dims_cm' in r) r.clear_dims_cm = [r1(bb[2] - bb[0]), r1(bb[3] - bb[1])];
  return r;
}
export function recomputeOpening(o) {
  const [ax, ay] = o.a_cm, [bx, by] = o.b_cm;
  o.centre_cm = [r1((ax + bx) / 2), r1((ay + by) / 2)];
  o.width_cm = r1(Math.hypot(bx - ax, by - ay));
  o.angle_deg = r1(Math.atan2(by - ay, bx - ax) * 180 / Math.PI);
  return o;
}
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

// ------------------------------------------------------------- the ops ----
// An op is one correction: { type, target, before, after, t }. applyOp mutates the plan; undo = apply
// with dir -1 (swaps before/after). Every op is invertible, so corrections.json replays both ways.
export const OP_TYPES = ['move_vertex', 'set_room', 'add_opening', 'delete_opening', 'set_opening', 'auto_move_camera'];
export function vertexTarget(roomId, i) { return `${roomId}/loop/${i}`; }
export function parseVertexTarget(t) { const m = /^(.*)\/loop\/(\d+)$/.exec(t); return m ? { roomId: m[1], i: +m[2] } : null; }
export function applyOp(plan, op, dir = 1) {
  const val = dir > 0 ? op.after : op.before;
  const room = (id) => { const r = plan.rooms.find((x) => x.id === id); if (!r) throw new Error(`no room ${id}`); return r; };
  switch (op.type) {
    case 'move_vertex': {
      const { roomId, i } = parseVertexTarget(op.target);
      const r = room(roomId);
      if (!r.loop[i]) throw new Error(`no vertex ${op.target}`);
      r.loop[i] = [r1(val[0]), r1(val[1])];
      recomputeRoom(r);
      break;
    }
    case 'set_room': {
      Object.assign(room(op.target), clone(val));
      break;
    }
    case 'add_opening':
    case 'delete_opening': {
      const adding = (op.type === 'add_opening') === (dir > 0);
      if (adding) {
        const o = clone(op.type === 'add_opening' ? op.after : op.before);
        const at = Math.min(op.index ?? plan.openings.length, plan.openings.length);
        plan.openings.splice(at, 0, o);
      } else {
        const k = plan.openings.findIndex((o) => o.id === op.target);
        if (k < 0) throw new Error(`no opening ${op.target}`);
        plan.openings.splice(k, 1);
      }
      break;
    }
    case 'set_opening': {
      const k = plan.openings.findIndex((o) => o.id === op.target);
      if (k < 0) throw new Error(`no opening ${op.target}`);
      plan.openings[k] = clone(val);
      break;
    }
    case 'auto_move_camera': {
      const c = plan.camera_points.find((x) => x.id === op.target);
      if (!c) throw new Error(`no camera ${op.target}`);
      c.x = val[0]; c.y = val[1];
      break;
    }
    default: throw new Error(`unknown op ${op.type}`);
  }
  return plan;
}
export const stamp = (op) => ({ ...op, t: op.t || new Date().toISOString() });

// Build the ops the UI emits (also used by the selftest and the fixtures, so all three share one path).
export function opMoveVertex(plan, roomId, i, to) {
  const r = plan.rooms.find((x) => x.id === roomId);
  return stamp({ type: 'move_vertex', target: vertexTarget(roomId, i), before: [...r.loop[i]], after: [r1(to[0]), r1(to[1])] });
}
export function opSetRoom(plan, roomId, preset) {
  const r = plan.rooms.find((x) => x.id === roomId);
  const pick = (o) => ({ name_he: o.name_he, name_en: o.name_en, type: o.type, is_outdoor: o.is_outdoor });
  const after = { name_he: preset.he, name_en: preset.en, type: preset.type, is_outdoor: OUTDOOR_TYPES.has(preset.type) };
  return stamp({ type: 'set_room', target: roomId, before: pick(r), after });
}
export function opDeleteOpening(plan, id) {
  const index = plan.openings.findIndex((o) => o.id === id);
  return stamp({ type: 'delete_opening', target: id, index, before: clone(plan.openings[index]), after: null });
}
export function opSetOpening(plan, id, patch) {
  const o = plan.openings.find((x) => x.id === id);
  const after = clone(o);
  if (patch.kind) {
    after.kind = patch.kind;
    const k = OPENING_KINDS[patch.kind];
    after.sill_cm = k.sill;
    after.head_cm = k.head ?? ceilingOf(plan);
  }
  if (patch.width) {                       // resize about the centre, along the opening's own line
    const [ax, ay] = o.a_cm, [bx, by] = o.b_cm, L = Math.hypot(bx - ax, by - ay) || 1;
    const ux = (bx - ax) / L, uy = (by - ay) / L, cx = (ax + bx) / 2, cy = (ay + by) / 2, h = patch.width / 2;
    after.a_cm = [r1(cx - ux * h), r1(cy - uy * h)];
    after.b_cm = [r1(cx + ux * h), r1(cy + uy * h)];
    recomputeOpening(after);
  }
  return stamp({ type: 'set_opening', target: id, before: clone(o), after });
}
export const ceilingOf = (plan) => plan.plan_meta?.ceiling_height_cm || 290;
export function nextOpeningId(plan) {
  let n = 1; const ids = new Set(plan.openings.map((o) => o.id));
  while (ids.has(`o-${n}`)) n++;
  return `o-${n}`;
}
export function roomAt(plan, p) { return plan.rooms.find((r) => pointInPolygon(p, r.loop)) || null; }

// Where would an opening go if Eliran taps at p (cm)? Nearest wall face (or room edge where there is no
// wall), centred in the wall's thickness, with the room on each side. null = not near a wall.
export function placeOpening(plan, p, kind, tolCm = 40) {
  let best = null;
  const consider = (L, src, id) => {
    for (let i = 0; i < L.length; i++) {
      const a = L[i], b = L[(i + 1) % L.length];
      const c = closestOnSegment(p, a, b);
      if (c.d <= tolCm && (!best || c.d < best.d)) best = { ...c, a, b, src, id, L };
    }
  };
  for (const w of plan.walls || []) if (Array.isArray(w.polygon_cm)) consider(w.polygon_cm, 'wall', w.id);
  if (!best) for (const r of plan.rooms) consider(r.loop, 'room', r.id);
  if (!best) return null;
  const L = Math.hypot(best.b[0] - best.a[0], best.b[1] - best.a[1]) || 1;
  const u = [(best.b[0] - best.a[0]) / L, (best.b[1] - best.a[1]) / L];
  let n = [-u[1], u[0]];
  let centre = best.q, half = 0;
  if (best.src === 'wall') {
    // march from the face into the wall to find its thickness (<= 60 cm)
    const inWall = (t) => pointInPolygon([best.q[0] + n[0] * t, best.q[1] + n[1] * t], best.L);
    if (!inWall(2)) n = [-n[0], -n[1]];
    let t = 2; while (t < 60 && inWall(t + 1)) t += 1;
    half = t / 2;
    centre = [best.q[0] + n[0] * half, best.q[1] + n[1] * half];
  }
  const probe = (s) => roomAt(plan, [centre[0] + n[0] * s * (half + 25), centre[1] + n[1] * s * (half + 25)]);
  const ra = probe(1), rb = probe(-1);
  if (ra && rb && ra.id === rb.id) return null;
  if (!ra && !rb) return null;
  const rooms = [rb ? rb.id : 'outside', ra ? ra.id : 'outside'];
  let k = kind;
  if (rooms.includes('outside') && (k === 'door' || k === 'opening')) k = 'entrance_door';
  const K = OPENING_KINDS[k];
  const w = K.width;
  const o = {
    id: nextOpeningId(plan), kind: k, rooms,
    a_cm: [r1(centre[0] - u[0] * w / 2), r1(centre[1] - u[1] * w / 2)],
    b_cm: [r1(centre[0] + u[0] * w / 2), r1(centre[1] + u[1] * w / 2)],
    centre_cm: [0, 0], angle_deg: 0, width_cm: 0,
    sill_cm: K.sill, head_cm: K.head ?? ceilingOf(plan), source: 'correction',
  };
  recomputeOpening(o);
  return o;
}
export function opAddOpening(plan, opening) {
  return stamp({ type: 'add_opening', target: opening.id, index: plan.openings.length, before: null, after: clone(opening) });
}

// Snap a dragged corner to the nearest wall corner / room corner, else to a wall face / room edge.
export function snapPoint(plan, p, tolCm, skip = {}) {
  let bestV = null, bestE = null;
  const polys = [];
  for (const w of plan.walls || []) if (Array.isArray(w.polygon_cm)) polys.push({ L: w.polygon_cm, room: null });
  for (const r of plan.rooms) polys.push({ L: r.loop, room: r.id });
  for (const { L, room } of polys) {
    for (let i = 0; i < L.length; i++) {
      if (room === skip.roomId && (i === skip.i)) continue;
      const v = L[i], d = Math.hypot(p[0] - v[0], p[1] - v[1]);
      if (d <= tolCm && (!bestV || d < bestV.d)) bestV = { p: [v[0], v[1]], d, kind: 'corner' };
      if (room === skip.roomId && (i === skip.i || (i + 1) % L.length === skip.i)) continue;
      const c = closestOnSegment(p, v, L[(i + 1) % L.length]);
      if (c.d <= tolCm && (!bestE || c.d < bestE.d)) bestE = { p: c.q, d: c.d, kind: 'edge' };
    }
  }
  const hit = bestV || bestE;
  return hit ? { p: [r1(hit.p[0]), r1(hit.p[1])], kind: hit.kind } : { p, kind: null };
}

// ---------------------------------------------------------- live checks ----
// What the screen lists under "מה לבדוק". Recomputed after every op, so an item turns green by itself.
export function computeIssues(plan, report) {
  const issues = [];
  const rep = new Map((report?.rooms || []).map((r) => [r.room_id, r]));
  const name = (id) => plan.rooms.find((r) => r.id === id)?.name_he || id;
  for (const r of plan.rooms) {
    const rr = rep.get(r.id);
    const xi = selfIntersects(r.loop);
    if (xi) issues.push({ kind: 'shape', target: r.id, text: `הצורה של "${r.name_he}" חוצה את עצמה: צריך להזיז פינה בחזרה` });
    if (rr?.printed_dims_cm && rr.printed_scope !== 'part') {
      const dv = deviation(orientedDims(r.loop), rr.printed_dims_cm);
      if (dv && dv.pct > TOL_PCT) issues.push({
        kind: 'dims', target: r.id, pct: dv.pct,
        text: `"${r.name_he}": בשרטוט ${dimsTxt(rr.printed_dims_cm)}, בתכנית ${dimsTxt(dv.measured)} (סטייה ${dv.pct}%)`,
      });
    }
    if (rr?.label_he && !sameName(rr.label_he, r.name_he)) issues.push({
      kind: 'label', target: r.id, text: `בשרטוט כתוב "${rr.label_he}", בתכנית החדר נקרא "${r.name_he}"`,
    });
  }
  // every room reachable from the entrance (or from the first room) through doors/openings
  const adj = new Map(plan.rooms.map((r) => [r.id, new Set()]));
  for (const o of plan.openings) if (Array.isArray(o.rooms) && o.rooms.length === 2) {
    const [a, b] = o.rooms; adj.get(a)?.add(b); adj.get(b)?.add(a);
  }
  const start = plan.openings.filter((o) => o.rooms?.includes('outside')).flatMap((o) => o.rooms).filter((x) => x !== 'outside');
  if (!start.length && plan.rooms[0]) start.push(plan.rooms[0].id);
  const seen = new Set(start), q = [...start];
  while (q.length) { const a = q.shift(); for (const b of adj.get(a) || []) if (b !== 'outside' && !seen.has(b)) { seen.add(b); q.push(b); } }
  for (const r of plan.rooms) if (!seen.has(r.id)) issues.push({ kind: 'reach', target: r.id, text: `אי אפשר להגיע ל"${r.name_he}": חסרה דלת או פתח` });
  // openings the report expects between two rooms
  for (const m of report?.mismatches || []) {
    if (m.kind !== 'opening_missing' || !Array.isArray(m.rooms)) continue;
    const has = plan.openings.some((o) => o.rooms && m.rooms.every((x) => o.rooms.includes(x)));
    if (!has) issues.push({ kind: 'opening_missing', target: m.rooms.find((x) => x !== 'outside'), text: m.message_he || `חסר פתח בין "${name(m.rooms[0])}" ל"${name(m.rooms[1])}"` });
  }
  return issues;
}

// ---------------------------------------------------- schema integrity ----
// Reviewer scope of card 02: saving may not delete a field or change its shape. Returns problems[].
const kindOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
export function shapeDiff(orig, saved) {
  const out = [];
  const sameKeys = (a, b, at, { allowNullSwap = false } = {}) => {
    for (const k of Object.keys(a)) {
      if (!(k in b)) { out.push(`${at}.${k} was deleted`); continue; }
      const ka = kindOf(a[k]), kb = kindOf(b[k]);
      if (ka !== kb && !(allowNullSwap && (ka === 'null' || kb === 'null'))) out.push(`${at}.${k} changed shape ${ka} -> ${kb}`);
    }
  };
  sameKeys(orig, saved, 'plan');
  if (orig.plan_meta && saved.plan_meta) {
    if (JSON.stringify(orig.plan_meta) !== JSON.stringify(saved.plan_meta)) out.push('plan.plan_meta was modified (the editor never touches it)');
  }
  for (const [k, v] of Object.entries(orig)) if (!Array.isArray(v) && kindOf(v) !== 'object' && saved[k] !== v) out.push(`plan.${k} changed value`);
  const byId = (arr) => new Map((arr || []).map((x) => [x.id, x]));
  // rooms: same ids, same keys, loop length unchanged, edge_kinds aligned
  const R0 = byId(orig.rooms), R1 = byId(saved.rooms);
  for (const id of R0.keys()) if (!R1.has(id)) out.push(`rooms[${id}] was deleted`);
  for (const id of R1.keys()) if (!R0.has(id)) out.push(`rooms[${id}] was added`);
  for (const [id, a] of R0) { const b = R1.get(id); if (!b) continue; sameKeys(a, b, `rooms[${id}]`, { allowNullSwap: true });
    if (a.loop.length !== b.loop.length) out.push(`rooms[${id}].loop changed length`);
    if (Array.isArray(b.edge_kinds) && b.edge_kinds.length !== b.loop.length) out.push(`rooms[${id}].edge_kinds misaligned`);
    if (b.loop.some((p) => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite))) out.push(`rooms[${id}].loop has a bad point`); }
  // openings: survivors keep their keys; new ones carry the full key set of the originals
  const O0 = byId(orig.openings), O1 = byId(saved.openings);
  const template = new Set(orig.openings.flatMap((o) => Object.keys(o)));
  for (const [id, b] of O1) {
    const a = O0.get(id);
    if (a) sameKeys(a, b, `openings[${id}]`);
    else for (const k of template) if (!(k in b)) out.push(`openings[${id}] (new) lacks "${k}"`);
  }
  // everything else: same ids and keys (cameras may move: x/y values only)
  for (const k of ['walls', 'panes', 'camera_points', 'fixtures']) {
    if (!Array.isArray(orig[k])) continue;
    const A = byId(orig[k]), B = byId(saved[k]);
    if (A.size !== B.size) out.push(`${k} count changed ${A.size} -> ${B.size}`);
    for (const [id, a] of A) { const b = B.get(id); if (!b) { out.push(`${k}[${id}] was deleted`); continue; } sameKeys(a, b, `${k}[${id}]`);
      if (k !== 'camera_points' && JSON.stringify(a) !== JSON.stringify(b)) out.push(`${k}[${id}] was modified (the editor never edits ${k})`); }
  }
  return out;
}

// Server side of "אשר": recompute derived fields of what changed, pull cameras back inside their rooms
// (recorded as auto ops), and return the extra ops.
export function finalizePlan(orig, plan) {
  const auto = [];
  const o0 = new Map(orig.rooms.map((r) => [r.id, r]));
  for (const r of plan.rooms) {
    const a = o0.get(r.id);
    if (a && JSON.stringify(a.loop) === JSON.stringify(r.loop)) continue;
    recomputeRoom(r);
    for (const c of plan.camera_points || []) {
      if (c.room_id !== r.id || pointInPolygon([c.x, c.y], r.loop)) continue;
      const p = interiorPoint(r.loop).map(r1);
      auto.push(stamp({ type: 'auto_move_camera', target: c.id, before: [c.x, c.y], after: p }));
      c.x = p[0]; c.y = p[1];
    }
  }
  const op0 = new Map(orig.openings.map((o) => [o.id, o]));
  for (const o of plan.openings) {
    const a = op0.get(o.id);
    if (a && JSON.stringify(a) === JSON.stringify(o)) continue;
    recomputeOpening(o);
  }
  return auto;
}

// cm -> raster px. report.raster = { image, cm_to_px: [a,b,c,d,e,f] } or { px_per_cm, origin_px, rotation_deg }.
// Falls back to plan_meta.scale_px_per_cm + raster_origin_px.
export function rasterAffine(raster, plan) {
  if (Array.isArray(raster?.cm_to_px) && raster.cm_to_px.length === 6) return raster.cm_to_px;
  const s = raster?.px_per_cm ?? plan?.plan_meta?.scale_px_per_cm ?? 1;
  const [ox, oy] = raster?.origin_px ?? plan?.plan_meta?.raster_origin_px ?? [0, 0];
  const t = ((raster?.rotation_deg ?? 0) * Math.PI) / 180;
  return [s * Math.cos(t), -s * Math.sin(t), ox, s * Math.sin(t), s * Math.cos(t), oy];
}

// ======================================================================
// ============================== the UI ================================
// ======================================================================
if (typeof document !== 'undefined') boot();

function boot() {
  const $ = (s) => document.querySelector(s);
  const NS = 'http://www.w3.org/2000/svg';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const S = {
    session: null, plan: null, report: null, ops: [], step: 1, sel: null, // sel: {kind:'room'|'opening'|'wall', id, p}
    view: null, A: null, Ainv: null, img: null, snap: true, showWalls: false, showAllCorners: false, opacity: 1,
    t0: Date.now(), saved: null,
  };
  const svg = $('#plan');

  // ------------------------------------------------------------ load --
  fetch('/api/session').then((r) => r.json()).then((s) => {
    S.session = s; S.plan = clone(s.plan); S.report = s.report; S.img = s.image;
    S.A = rasterAffine(s.report?.raster, s.plan);
    const [a, b, c, d, e, f] = S.A, det = a * e - b * d;
    S.Ainv = [e / det, -b / det, (b * f - c * e) / det, -d / det, a / det, (c * d - a * f) / det];
    document.title = `תיקון תכנית · ${s.plan.apartment_id}`;
    $('#title').textContent = `תיקון תכנית · ${s.title_he || s.plan.apartment_id}`;
    $('#caption').textContent = s.caption_he || '';
    $('#adv-paths').textContent = `קלט: ${s.paths.plan}\nדוח: ${s.paths.report || '-'}\nתמונה: ${s.paths.image}\nשמירה אל: ${s.paths.out}`;
    // resume a previous unsaved session on this exact plan
    const key = storeKey();
    const prev = JSON.parse(localStorage.getItem(key) || 'null');
    if (prev?.ops?.length) {
      showResume(prev.ops);
    }
    fit(); render(); renderPanel();
  }).catch((e) => { $('#panel-body').innerHTML = `<p class="bad">לא הצלחתי לטעון: ${esc(e.message)}</p>`; });

  const storeKey = () => `habait-correct:${S.session.plan.apartment_id}:${S.session.plan_sha256}`;
  const persist = () => { try { localStorage.setItem(storeKey(), JSON.stringify({ ops: S.ops })); } catch { /* private mode */ } };
  function showResume(ops) {
    const live = ops.filter((o) => !o.undone).length;
    const box = $('#resume');
    box.hidden = false;
    box.innerHTML = `<span>יש ${live} תיקונים מהפעם הקודמת שלא נשמרו.</span>
      <button class="primary" data-act="resume-yes">להמשיך מאיפה שעצרתי</button>
      <button data-act="resume-no">להתחיל מחדש</button>`;
    box.onclick = (ev) => {
      const act = ev.target.dataset.act; if (!act) return;
      if (act === 'resume-yes') { for (const op of ops) { if (!op.undone) applyOp(S.plan, op); } S.ops = ops; }
      else localStorage.removeItem(storeKey());
      box.hidden = true; render(); renderPanel();
    };
  }

  // -------------------------------------------------------- ops / undo --
  function commit(op) {
    applyOp(S.plan, op); S.ops.push(op); S.saved = null; persist(); render(); renderPanel();
  }
  function undo() {
    for (let i = S.ops.length - 1; i >= 0; i--) if (!S.ops[i].undone) {
      applyOp(S.plan, S.ops[i], -1); S.ops[i].undone = true; S.ops[i].undone_t = new Date().toISOString();
      if (S.sel?.kind === 'opening' && !S.plan.openings.some((o) => o.id === S.sel.id)) S.sel = null;
      S.saved = null; persist(); render(); renderPanel(); return;
    }
  }
  const liveOps = () => S.ops.filter((o) => !o.undone);

  // ------------------------------------------------------- transforms --
  const toPx = ([x, y]) => [S.A[0] * x + S.A[1] * y + S.A[2], S.A[3] * x + S.A[4] * y + S.A[5]];
  const toCm = ([x, y]) => [S.Ainv[0] * x + S.Ainv[1] * y + S.Ainv[2], S.Ainv[3] * x + S.Ainv[4] * y + S.Ainv[5]];
  const pxPerScreen = () => S.view.w / svg.clientWidth;               // image px per screen px
  const cmPerScreen = () => pxPerScreen() / Math.hypot(S.A[0], S.A[3]);
  function eventPx(ev) {
    const r = svg.getBoundingClientRect();
    return [S.view.x + ((ev.clientX - r.left) / r.width) * S.view.w, S.view.y + ((ev.clientY - r.top) / r.height) * S.view.h];
  }
  function fit() {
    // fit the apartment (rooms bbox), not the whole sheet
    const pts = S.plan.rooms.flatMap((r) => r.loop.map(toPx));
    const [x0, y0, x1, y1] = bbox(pts);
    const pad = 0.06 * Math.max(x1 - x0, y1 - y0);
    setView(x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad);
  }
  function setView(x, y, w, h) {
    const ar = svg.clientWidth / Math.max(1, svg.clientHeight);
    if (w / h > ar) { const nh = w / ar; y -= (nh - h) / 2; h = nh; } else { const nw = h * ar; x -= (nw - w) / 2; w = nw; }
    S.view = { x, y, w, h };
    svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
    render();
  }
  function zoomAt(px, factor) {
    const v = S.view, w = v.w / factor, h = v.h / factor;
    if (w < 150 || w > 40000) return;
    setView(px[0] - (px[0] - v.x) / factor, px[1] - (px[1] - v.y) / factor, w, h);
  }
  function focusRoom(id) {
    const r = S.plan.rooms.find((x) => x.id === id); if (!r) return;
    const [x0, y0, x1, y1] = bbox(r.loop.map(toPx)); const pad = 0.35 * Math.max(x1 - x0, y1 - y0);
    setView(x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad);
  }

  // ------------------------------------------------------------ render --
  function roomStatus(r) {
    const rr = S.report?.rooms?.find((x) => x.room_id === r.id);
    if (!rr?.printed_dims_cm) return { cls: 'none' };
    const dv = deviation(orientedDims(r.loop), rr.printed_dims_cm);
    if (rr.printed_scope === 'part') return { cls: 'part', dv, rr };
    return { cls: dv.pct <= TOL_PCT ? 'ok' : 'bad', dv, rr };
  }
  function render() {
    if (!S.view || !S.plan) return;
    const sp = pxPerScreen();
    const fs = 13 * sp, hr = 7 * sp, sw = 2;
    const P = (L) => L.map((p) => toPx(p).map((v) => v.toFixed(1)).join(',')).join(' ');
    let h = `<image href="/plan-image" x="0" y="0" width="${S.img.width}" height="${S.img.height}" opacity="${S.opacity}" />`;
    if (S.showWalls) for (const w of S.plan.walls) h += `<polygon class="wall" points="${P(w.polygon_cm)}" />`;
    for (const r of S.plan.rooms) {
      const st = roomStatus(r);
      const sel = S.sel?.kind === 'room' && S.sel.id === r.id;
      h += `<polygon id="room-${esc(r.id)}" class="room st-${st.cls}${sel ? ' sel' : ''}" data-room="${esc(r.id)}" points="${P(r.loop)}" />`;
    }
    for (const o of S.plan.openings) {
      const [a, b] = [toPx(o.a_cm), toPx(o.b_cm)];
      const sel = S.sel?.kind === 'opening' && S.sel.id === o.id;
      h += `<line class="op k-${esc(o.kind)}${sel ? ' sel' : ''}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke-width="${(sel ? 9 : 6) * sp}" />`;
    }
    // labels
    for (const r of S.plan.rooms) {
      const st = roomStatus(r);
      const cam = S.plan.camera_points?.find((c) => c.room_id === r.id);
      const [lx, ly] = toPx(interiorPoint(r.loop, cam ? [cam.x, cam.y] : null));
      let sub = '';
      if (st.rr) {
        const m = st.dv.measured.map(Math.round);
        sub = st.cls === 'part' ? `${dimsTxt(st.rr.printed_dims_cm)} (מידה חלקית)` : `בשרטוט ${dimsTxt(st.rr.printed_dims_cm)} · בתכנית ${dimsTxt(m)}`;
      }
      h += `<g class="label st-${st.cls}" data-room="${esc(r.id)}"><text x="${lx}" y="${ly}" font-size="${fs}" class="nm">${esc(r.name_he)}</text>`;
      if (sub) h += `<text x="${lx}" y="${ly + fs * 1.3}" font-size="${fs * 0.85}" class="dm">${esc(sub)}</text>`;
      h += '</g>';
    }
    // corner handles of the selected room (or all, from advanced settings)
    for (const r of S.plan.rooms) {
      if (!(S.showAllCorners || (S.sel?.kind === 'room' && S.sel.id === r.id))) continue;
      r.loop.forEach((p, i) => { const [x, y] = toPx(p); h += `<circle class="corner" data-room="${esc(r.id)}" data-i="${i}" cx="${x}" cy="${y}" r="${hr}" />`; });
    }
    if (S.sel?.kind === 'wall') { const [x, y] = toPx(S.sel.p); h += `<circle class="tapmark" cx="${x}" cy="${y}" r="${hr * 1.4}" />`; }
    if (S.snapMark) { const [x, y] = toPx(S.snapMark); h += `<circle class="snapmark" cx="${x}" cy="${y}" r="${hr * 1.8}" />`; }
    svg.innerHTML = h;
    svg.style.setProperty('--sw', sw);
    renderIssuesBadge();
  }

  // ------------------------------------------------------------ panel --
  function renderIssuesBadge() {
    const n = computeIssues(S.plan, S.report).length;
    $('#badge').textContent = n ? `${n} לבדיקה` : 'הכול תקין';
    $('#badge').className = n ? 'badge bad' : 'badge ok';
    $('#undo').disabled = !liveOps().length;
    $('#count').textContent = liveOps().length ? `${liveOps().length} תיקונים` : '';
  }
  function setStep(n) { S.step = n; document.querySelectorAll('.steps li').forEach((li) => li.classList.toggle('on', +li.dataset.step === n)); renderPanel(); }
  function renderPanel() {
    const body = $('#panel-body');
    if (!S.plan) return;
    if (S.step === 1) {
      const issues = computeIssues(S.plan, S.report);
      body.innerHTML = `<h2>1. מה לבדוק</h2>
        <p class="hint">התכנית מצוירת מעל השרטוט. ירוק = המידה מתאימה לשרטוט, אדום = לא מתאימה. לחצו על שורה כדי להגיע אליה.</p>
        ${issues.length ? `<ul class="issues">${issues.map((x, i) => `<li data-i="${i}" class="k-${x.kind}">${esc(x.text)}</li>`).join('')}</ul>`
          : '<p class="ok big">לא נמצא שום דבר חשוד. אפשר לעבור לאישור, או לבדוק בעין על השרטוט.</p>'}
        ${(S.report?.mismatches || []).filter((m) => m.kind === 'other').map((m) => `<p class="note">${esc(m.message_he)}</p>`).join('')}`;
      body.querySelectorAll('.issues li').forEach((li) => li.onclick = () => {
        const x = issues[+li.dataset.i]; S.sel = { kind: 'room', id: x.target }; focusRoom(x.target); setStep(2);
      });
      return;
    }
    if (S.step === 2) {
      let inner = `<h2>2. תיקון</h2>`;
      if (!S.sel) {
        inner += `<ul class="howto">
          <li><b>חדר במקום הלא נכון?</b> לחצו על החדר, ואז גררו את הנקודות הכתומות לפינות שעל השרטוט.</li>
          <li><b>שם לא נכון?</b> לחצו על החדר ובחרו שם.</li>
          <li><b>חסרה דלת או חלון?</b> לחצו על הקיר במקום שלהם.</li>
          <li><b>דלת מיותרת?</b> לחצו עליה ובחרו "למחוק".</li></ul>`;
      } else if (S.sel.kind === 'room') {
        const r = S.plan.rooms.find((x) => x.id === S.sel.id);
        const st = roomStatus(r);
        inner += `<div class="card"><div class="cardtitle">${esc(r.name_he)}</div>
          ${st.rr ? `<div class="dims st-${st.cls}">בשרטוט ${dimsTxt(st.rr.printed_dims_cm)} · בתכנית ${dimsTxt(st.dv.measured)}${st.cls === 'part' ? ' (המידה בשרטוט מכסה רק חלק מהחלל)' : ` · סטייה ${st.dv.pct}%`}</div>` : ''}
          <p class="hint">גררו את הנקודות הכתומות לפינות החדר שעל השרטוט. הנקודה נצמדת לקירות.</p>
          <div class="lbl">איך קוראים לחדר?</div>
          <div class="chips">${ROOM_PRESETS.map((p, i) => `<button class="chip${p.he === r.name_he ? ' on' : ''}" data-preset="${i}">${esc(p.he)}</button>`).join('')}</div>
          <button class="ghost" data-act="close">סיימתי עם החדר</button></div>`;
      } else if (S.sel.kind === 'opening') {
        const o = S.plan.openings.find((x) => x.id === S.sel.id);
        const kinds = Object.entries(OPENING_KINDS);
        inner += `<div class="card"><div class="cardtitle">${esc(OPENING_KINDS[o.kind]?.he || o.kind)} · ${Math.round(o.width_cm)} ס"מ</div>
          <div class="lbl">מה זה?</div>
          <div class="chips">${kinds.filter(([, k]) => k.main).map(([k, v]) => `<button class="chip${o.kind === k ? ' on' : ''}" data-kind="${k}">${v.he}</button>`).join('')}</div>
          <div class="lbl">רוחב</div>
          <div class="row"><button data-w="-10">צר יותר</button><span class="wv">${Math.round(o.width_cm)} ס"מ</span><button data-w="10">רחב יותר</button></div>
          <div class="row"><button class="danger" data-act="del">למחוק</button><button class="ghost" data-act="close">סגור</button></div>
          <details class="adv"><summary>סוגים נוספים</summary><div class="chips">${kinds.filter(([, k]) => !k.main).map(([k, v]) => `<button class="chip${o.kind === k ? ' on' : ''}" data-kind="${k}">${v.he}</button>`).join('')}</div></details></div>`;
      } else if (S.sel.kind === 'wall') {
        inner += `<div class="card"><div class="cardtitle">להוסיף כאן:</div>
          <div class="chips big">${Object.entries(OPENING_KINDS).filter(([, k]) => k.main).map(([k, v]) => `<button class="chip" data-add="${k}">${v.he}</button>`).join('')}</div>
          <button class="ghost" data-act="close">ביטול</button></div>`;
      }
      body.innerHTML = inner;
      body.querySelectorAll('[data-preset]').forEach((b) => b.onclick = () => commit(opSetRoom(S.plan, S.sel.id, ROOM_PRESETS[+b.dataset.preset])));
      body.querySelectorAll('[data-kind]').forEach((b) => b.onclick = () => commit(opSetOpening(S.plan, S.sel.id, { kind: b.dataset.kind })));
      body.querySelectorAll('[data-w]').forEach((b) => b.onclick = () => {
        const o = S.plan.openings.find((x) => x.id === S.sel.id); const w = Math.max(40, Math.round(o.width_cm) + +b.dataset.w);
        commit(opSetOpening(S.plan, S.sel.id, { width: w }));
      });
      body.querySelectorAll('[data-add]').forEach((b) => b.onclick = () => {
        const o = placeOpening(S.plan, S.sel.p, b.dataset.add, Math.max(40, 15 * cmPerScreen()));
        if (!o) { flash('כאן אין קיר בין שני חדרים. נסו ללחוץ על הקיר עצמו.'); return; }
        const op = opAddOpening(S.plan, o); S.sel = { kind: 'opening', id: o.id }; commit(op);
      });
      const act = (a, fn) => body.querySelectorAll(`[data-act="${a}"]`).forEach((b) => b.onclick = fn);
      act('close', () => { S.sel = null; render(); renderPanel(); });
      act('del', () => { const op = opDeleteOpening(S.plan, S.sel.id); S.sel = null; commit(op); });
      return;
    }
    // step 3
    const issues = computeIssues(S.plan, S.report);
    const n = liveOps().length;
    body.innerHTML = `<h2>3. אישור</h2>
      <p>${n ? `עשיתם ${n} תיקונים.` : 'לא עשיתם תיקונים.'} ${issues.length ? `<span class="bad">נשארו ${issues.length} דברים לבדוק (אפשר לאשר גם כך).</span>` : '<span class="ok">אין דברים פתוחים.</span>'}</p>
      <button id="save" class="primary big">אשר ושמור</button>
      <div id="save-out">${S.saved ? saveHtml(S.saved) : ''}</div>`;
    $('#save').onclick = save;
  }
  function saveHtml(res) {
    if (res.ok) return `<p class="ok big">נשמר. התכנית עברה את הבדיקה האוטומטית.</p>
      ${res.auto?.length ? `<p class="hint">${res.auto.length} נקודות צילום הוזזו לתוך החדר שלהן.</p>` : ''}
      <details class="adv"><summary>פרטים</summary><pre>${esc(res.files.join('\n'))}\n${esc((res.warns || []).length)} warnings</pre></details>`;
    return `<p class="bad big">לא נשמר: יש בעיה שצריך לתקן קודם.</p>
      <ul class="issues">${(res.problems_he || []).map((p) => `<li data-room="${esc(p.room || '')}">${esc(p.text)}</li>`).join('')}</ul>
      <p class="hint">הטיוטה והתיקונים נשמרו בצד, שום דבר לא אבד.</p>
      <details class="adv"><summary>פרטים</summary><pre>${esc((res.fails || []).concat(res.shape || []).join('\n'))}</pre></details>`;
  }
  async function save() {
    $('#save').disabled = true; $('#save').textContent = 'שומר...';
    try {
      const res = await fetch('/api/save', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan: S.plan, corrections: S.ops, elapsed_s: Math.round((Date.now() - S.t0) / 1000) }) }).then((r) => r.json());
      S.saved = res;
      if (res.ok) { for (const op of res.auto || []) applyOp(S.plan, op); S.ops.push(...(res.auto || [])); localStorage.removeItem(storeKey()); }
    } catch (e) { S.saved = { ok: false, problems_he: [{ text: 'השרת לא ענה: ' + e.message }] }; }
    renderPanel(); render();
    document.querySelectorAll('#save-out li[data-room]').forEach((li) => li.onclick = () => { if (li.dataset.room) { S.sel = { kind: 'room', id: li.dataset.room }; focusRoom(li.dataset.room); setStep(2); } });
  }
  function flash(msg) { const f = $('#flash'); f.textContent = msg; f.hidden = false; clearTimeout(flash.t); flash.t = setTimeout(() => { f.hidden = true; }, 3500); }

  // ----------------------------------------------------- interaction --
  const ptrs = new Map();
  let drag = null;          // {mode:'pan'|'corner'|'pinch', ...}
  function hitTest(ev) {
    const t = ev.target;
    if (t.classList?.contains('corner')) return { kind: 'corner', roomId: t.dataset.room, i: +t.dataset.i };
    const px = eventPx(ev), cm = toCm(px), tolCm = 10 * cmPerScreen();
    let best = null;
    for (const o of S.plan.openings) { const c = closestOnSegment(cm, o.a_cm, o.b_cm); if (c.d <= tolCm && (!best || c.d < best.d)) best = { kind: 'opening', id: o.id, d: c.d }; }
    if (best) return best;
    for (const w of S.plan.walls) if (pointInPolygon(cm, w.polygon_cm)) return { kind: 'wall', p: cm };
    const r = roomAt(S.plan, cm);
    if (r) {
      // a tap on a room edge with no traced wall (e.g. the facade line) also offers an opening
      let d = Infinity; for (let i = 0; i < r.loop.length; i++) d = Math.min(d, closestOnSegment(cm, r.loop[i], r.loop[(i + 1) % r.loop.length]).d);
      if (d <= 6 * cmPerScreen() && !(S.sel?.kind === 'room' && S.sel.id === r.id)) return { kind: 'wall', p: cm };
      return { kind: 'room', id: r.id };
    }
    // outside every room = on a wall or in a gap in it (where a missing door goes)
    return core_near_any_room(cm, 60) ? { kind: 'wall', p: cm } : { kind: 'none' };
  }
  svg.addEventListener('pointerdown', (ev) => {
    svg.setPointerCapture(ev.pointerId);
    ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (ptrs.size === 2) {                      // pinch
      const [a, b] = [...ptrs.values()];
      drag = { mode: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), view: { ...S.view } };
      return;
    }
    const hit = hitTest(ev);
    if (hit.kind === 'corner') {
      const r = S.plan.rooms.find((x) => x.id === hit.roomId);
      drag = { mode: 'corner', roomId: hit.roomId, i: hit.i, before: [...r.loop[hit.i]], moved: false };
    } else {
      drag = { mode: 'pan', sx: ev.clientX, sy: ev.clientY, view: { ...S.view }, hit, moved: false };
    }
  });
  svg.addEventListener('pointermove', (ev) => {
    if (!ptrs.has(ev.pointerId)) return;
    ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (!drag) return;
    if (drag.mode === 'pinch' && ptrs.size === 2) {
      const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
      const f = d / drag.d0, v = drag.view, cx = v.x + v.w / 2, cy = v.y + v.h / 2;
      if (v.w / f > 150) setView(cx - v.w / f / 2, cy - v.h / f / 2, v.w / f, v.h / f);
      return;
    }
    if (drag.mode === 'corner') {
      drag.moved = true;
      let cm = toCm(eventPx(ev));
      S.snapMark = null;
      if (S.snap) { const s = snapPoint(S.plan, cm, SNAP_PX * cmPerScreen(), { roomId: drag.roomId, i: drag.i }); if (s.kind) { cm = s.p; S.snapMark = s.p; } }
      const r = S.plan.rooms.find((x) => x.id === drag.roomId);
      r.loop[drag.i] = [r1(cm[0]), r1(cm[1])];
      render();
      return;
    }
    if (drag.mode === 'pan') {
      const dx = ev.clientX - drag.sx, dy = ev.clientY - drag.sy;
      if (!drag.moved && Math.hypot(dx, dy) < 6) return;
      drag.moved = true;
      const k = drag.view.w / svg.clientWidth;
      setView(drag.view.x - dx * k, drag.view.y - dy * k, drag.view.w, drag.view.h);
    }
  });
  const end = (ev) => {
    ptrs.delete(ev.pointerId);
    if (!drag) return;
    const d = drag; if (d.mode === 'pinch') { if (ptrs.size === 0) drag = null; return; }
    drag = null; S.snapMark = null;
    if (d.mode === 'corner') {
      const r = S.plan.rooms.find((x) => x.id === d.roomId);
      const after = [...r.loop[d.i]];
      r.loop[d.i] = d.before;                    // restore, then commit as one op (one drag = one correction)
      if (d.moved && (after[0] !== d.before[0] || after[1] !== d.before[1])) commit(opMoveVertex(S.plan, d.roomId, d.i, after));
      else render();
      return;
    }
    if (d.mode === 'pan' && !d.moved) onTap(d.hit);
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('wheel', (ev) => { ev.preventDefault(); zoomAt(eventPx(ev), ev.deltaY < 0 ? 1.2 : 1 / 1.2); }, { passive: false });
  function core_near_any_room(cm, tolCm) {
    for (const r of S.plan.rooms) for (let i = 0; i < r.loop.length; i++) if (closestOnSegment(cm, r.loop[i], r.loop[(i + 1) % r.loop.length]).d <= tolCm) return true;
    return false;
  }
  function onTap(hit) {
    if (hit.kind === 'opening') S.sel = { kind: 'opening', id: hit.id };
    else if (hit.kind === 'wall') S.sel = { kind: 'wall', p: hit.p };
    else if (hit.kind === 'room') S.sel = { kind: 'room', id: hit.id };
    else S.sel = null;
    if (S.sel && S.step !== 2) setStep(2); else renderPanel();
    render();
  }

  // ------------------------------------------------------------ chrome --
  document.querySelectorAll('.steps li').forEach((li) => li.onclick = () => setStep(+li.dataset.step));
  $('#next').onclick = () => setStep(Math.min(3, S.step + 1));
  $('#prev').onclick = () => setStep(Math.max(1, S.step - 1));
  $('#undo').onclick = undo;
  $('#zin').onclick = () => zoomAt([S.view.x + S.view.w / 2, S.view.y + S.view.h / 2], 1.4);
  $('#zout').onclick = () => zoomAt([S.view.x + S.view.w / 2, S.view.y + S.view.h / 2], 1 / 1.4);
  $('#zfit').onclick = fit;
  $('#adv-snap').onchange = (e) => { S.snap = e.target.checked; };
  $('#adv-walls').onchange = (e) => { S.showWalls = e.target.checked; render(); };
  $('#adv-corners').onchange = (e) => { S.showAllCorners = e.target.checked; render(); };
  $('#adv-opacity').oninput = (e) => { S.opacity = +e.target.value; render(); };
  window.addEventListener('resize', () => { if (S.view) setView(S.view.x, S.view.y, S.view.w, S.view.h); });
  // for the UI test fixture: read-only view of the state
  window.__correct = { S, computeIssues: () => computeIssues(S.plan, S.report), toPx, toCm };
}
