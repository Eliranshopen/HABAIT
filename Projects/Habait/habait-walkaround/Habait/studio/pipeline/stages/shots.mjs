/* Stage 4 — shots: the camera path, decided from the plan (and the site when it exists), pure geometry, no Blender.
   World frame = the pipeline's: X = x_cm/100, Y = -y_cm/100 (plan +y is down), Z up, the unit's floor at Z=0,
   the ground at plan_meta.ground_offset_cm. Shots:
     ext-approach  aerial from far outside the main facade, descending toward the unit
     ext-facade    a slow arc in front of the terrace / facade, closing on the entry door
     ext-enter     a walk from the terrace, square to the slider, through it into the living room (the seam)
     room-<cp>     one slow push per camera point, starting ON it, so the skinned pano crop is the first frame
   Every keyframe is { t: seconds, pos: [x,y,z] m, look: [x,y,z] m }; the renderer eases between them. */
import fs from 'node:fs';

// render-to-real caps resolution x frames ("roughly 6s at 720p or 15s at 480p", a 422 above it): one clip is at
// most 137 frames (8k+1) = 5.71 s at 24 fps at 720p, so no shot is longer than that
export const MAX_CLIP_FRAMES_720P = 137;
const MAX_S = MAX_CLIP_FRAMES_720P / 24;
// every shot is a whole number of 8k+1 frames, so the clay has exactly the frames the video model is asked for
const snap = (s) => Math.min(MAX_CLIP_FRAMES_720P, Math.max(9, Math.round((s * 24 - 1) / 8) * 8 + 1)) / 24;
const DUR = { approach: MAX_S, facade: snap(5), enter: snap(4), room: snap(5) };
const WALK_M_S = 0.8; // a person walking in with a gimbal, not a drone

/** Wall polygon edges, plan cm. */
export function wallEdges(plan) {
  const out = [];
  for (const w of plan.walls || []) { const p = w.polygon_cm; if (!p) continue; for (let i = 0; i < p.length; i++) out.push([p[i], p[(i + 1) % p.length]]); }
  return out;
}
export function pointInPoly(pt, pg) {
  let c = false;
  for (let i = 0, j = pg.length - 1; i < pg.length; j = i++) { const [xi, yi] = pg[i], [xj, yj] = pg[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c; }
  return c;
}
/** Distance along the unit ray d from o to the first edge, or null. */
export function rayToEdges(o, d, edges) {
  let best = null;
  for (const [a, b] of edges) {
    const ex = b[0] - a[0], ey = b[1] - a[1], den = d[0] * ey - d[1] * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((a[0] - o[0]) * ey - (a[1] - o[1]) * ex) / den, u = ((a[0] - o[0]) * d[1] - (a[1] - o[1]) * d[0]) / den;
    if (t > 1 && u >= 0 && u <= 1 && (best === null || t < best)) best = t;
  }
  return best;
}
function rayToLoop(o, d, loop) { const e = []; for (let i = 0; i < loop.length; i++) e.push([loop[i], loop[(i + 1) % loop.length]]); return rayToEdges(o, d, e); }
/** How good a view is from o at plan bearing yawDeg: the mean log free distance over 7 rays across the frame
    (a close wall anywhere in frame costs a lot), plus a bonus for each ray that leaves through glazing (a window
    view; such a ray counts as glass distance + 3 m). Distances in cm, capped at 15 m (open terraces). */
export function viewScore(o, yawDeg, blockers, glazing, fovDeg = 74) {
  let depth = 0, win = 0;
  const offs = [-0.42, -0.28, -0.14, 0, 0.14, 0.28, 0.42].map((f) => f * fovDeg);
  for (const off of offs) {
    const b = ((yawDeg + off) * Math.PI) / 180, d = [Math.sin(b), -Math.cos(b)];
    let hit = Math.min(rayToEdges(o, d, blockers) ?? 1500, 1500);
    const g = rayToEdges(o, d, glazing);
    // a ray out through the glass counts as the room's depth to the glass plus 3 m, so a frame that is all window
    // (the view only, no room) does not beat one with the room in it and a window
    if (g !== null && g < hit) { win += 1; hit = g + 300; }
    depth += Math.log(Math.max(hit, 40));
  }
  return depth / offs.length + (0.5 * win) / offs.length;
}
function polyEdges(polys) { const e = []; for (const p of polys) for (let i = 0; i < p.length; i++) e.push([p[i], p[(i + 1) % p.length]]); return e; }

export function minWallDist(q, edges) {
  let m = Infinity;
  for (const [a, b] of edges) { const vx = b[0] - a[0], vy = b[1] - a[1], L = vx * vx + vy * vy || 1; const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * vx + (q[1] - a[1]) * vy) / L)); m = Math.min(m, Math.hypot(a[0] + t * vx - q[0], a[1] + t * vy - q[1])); }
  return m;
}

export function centroid(loop) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < loop.length; i++) {
    const [x0, y0] = loop[i], [x1, y1] = loop[(i + 1) % loop.length];
    const f = x0 * y1 - x1 * y0; a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
  }
  if (Math.abs(a) < 1e-9) { const n = loop.length; return [loop.reduce((s, p) => s + p[0], 0) / n, loop.reduce((s, p) => s + p[1], 0) / n]; }
  a *= 0.5; return [cx / (6 * a), cy / (6 * a)];
}

export function bbox(points) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of points) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  return [x0, y0, x1, y1];
}

/** Longest edge of a thin polygon = its line; returns {dir, len, centre} in plan cm. */
function longAxis(poly) {
  let best = { len: -1 };
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
    if (len > best.len) best = { len, dir: [dx / len, dy / len], centre: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
  }
  return best;
}

/** The unit's main outward direction (plan frame, unit vector): the length-weighted mean of the facade panes'
    outward normals; falls back to the exterior walls' normals, then to "down the plan". */
export function mainFacadeNormal(plan, aptCentre) {
  const acc = [0, 0];
  const use = (poly, w) => {
    const ax = longAxis(poly);
    if (!ax.dir) return;
    let n = [-ax.dir[1], ax.dir[0]];
    const toC = [ax.centre[0] - aptCentre[0], ax.centre[1] - aptCentre[1]];
    if (n[0] * toC[0] + n[1] * toC[1] < 0) n = [-n[0], -n[1]];
    acc[0] += n[0] * w; acc[1] += n[1] * w;
  };
  for (const p of plan.panes || []) if (p.kind === 'facade' && p.polygon_cm) use(p.polygon_cm, longAxis(p.polygon_cm).len);
  if (Math.hypot(acc[0], acc[1]) < 1e-6) for (const w of plan.walls || []) if (w.kind === 'exterior' && w.polygon_cm) use(w.polygon_cm, longAxis(w.polygon_cm).len);
  const L = Math.hypot(acc[0], acc[1]);
  return L < 1e-6 ? [0, 1] : [acc[0] / L, acc[1] / L];
}

export function toWorld([x, y], zCm = 0) { return [x / 100, -y / 100, zCm / 100]; }

function ease(a, b, f) { return a + (b - a) * f; }
function wallPoints(plan) { return (plan.walls || []).flatMap((w) => w.polygon_cm || (w.rect_cm ? [[w.rect_cm[0], w.rect_cm[1]], [w.rect_cm[2], w.rect_cm[3]]] : [])); }

export function planShots(plan, site, opts = {}) {
  const rooms = plan.rooms || [];
  const roomById = Object.fromEntries(rooms.map((r) => [r.id, r]));
  const pts = wallPoints(plan);
  const bb = bbox(pts.length ? pts : rooms.flatMap((r) => r.loop || []));
  const aptC = [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2];
  const n = mainFacadeNormal(plan, aptC);
  const ceiling = plan.plan_meta?.ceiling_height_cm || 290;
  const eye = 160;
  const cams = plan.camera_points || [];

  // the entry: a door from an outdoor room inward, else the entrance door, else the facade centre
  const outdoorIds = new Set(rooms.filter((r) => r.is_outdoor).map((r) => r.id));
  const isLivingRoom = (rid) => { const r = roomById[rid]; return Boolean(r) && (/living/i.test(r.type || '') || /living/i.test(r.id || '') || /living/i.test(r.name_en || '')); };
  const living = cams.find((c) => isLivingRoom(c.room_id)) || cams.find((c) => /living/i.test(c.id)) || cams[0];
  const livingRoomId = living?.room_id || rooms.find((r) => isLivingRoom(r.id))?.id || null;
  const connects = (o, pred) => (o.rooms || []).some((r) => outdoorIds.has(r)) && (o.rooms || []).some((r) => !outdoorIds.has(r) && pred(r));
  const ops = plan.openings || [];
  // the entry, in order of preference: a door/opening from an outdoor room INTO THE LIVING ROOM (the terrace
  // slider), then any outdoor door, then the entrance door, then the facade centre
  let entry = ops.find((o) => /door|opening/.test(o.kind || '') && connects(o, (r) => r === livingRoomId));
  let entryKind = entry ? (entry.kind === 'opening' ? 'terrace-opening' : 'terrace-door') : null;
  if (!entry) { entry = ops.find((o) => /door/.test(o.kind || '') && connects(o, () => true)); entryKind = entry ? 'terrace-door' : null; }
  if (!entry) { entry = ops.find((o) => o.kind === 'entrance_door'); entryKind = entry ? 'entrance-door' : null; }
  const entryC = entry?.centre_cm || [aptC[0] + n[0] * ((bb[2] - bb[0]) / 2), aptC[1] + n[1] * ((bb[3] - bb[1]) / 2)];
  const livingXY = living ? [living.x, living.y] : aptC;

  // outward direction at the entry: from the unit centre through the entry, blended with the facade normal
  let out = [entryC[0] - aptC[0], entryC[1] - aptC[1]];
  const oL = Math.hypot(out[0], out[1]); out = oL > 1 ? [out[0] / oL, out[1] / oL] : n;
  out = [(out[0] + n[0]) / 2, (out[1] + n[1]) / 2]; const L2 = Math.hypot(out[0], out[1]); out = [out[0] / L2, out[1] / L2];
  const side = [-out[1], out[0]];
  const at = (base, dist_m, lateral_m = 0) => [base[0] + out[0] * dist_m * 100 + side[0] * lateral_m * 100, base[1] + out[1] * dist_m * 100 + side[1] * lateral_m * 100];

  const shots = [];
  const fps = opts.fps || 24;
  const bearingOf = (d) => ((Math.atan2(d[0], -d[1]) * 180) / Math.PI + 360) % 360; // plan: 0 = up (-y), clockwise
  const headingOf = (from, to) => ((Math.atan2(to[0] - from[0], to[1] - from[1]) * 180) / Math.PI + 360) % 360; // world: 0 = +Y, cw
  const lookPoint = (pos, headingDeg, dist = 4) => [pos[0] + Math.sin((headingDeg * Math.PI) / 180) * dist, pos[1] + Math.cos((headingDeg * Math.PI) / 180) * dist, pos[2] - 0.1];
  const edges = wallEdges(plan);
  // what a standing person cannot see past: walls and tall fixtures (wardrobes, fridge); glazing is see-through
  const blockers = edges.concat(polyEdges((plan.fixtures || []).filter((f) => (f.height_cm || 0) >= 140 && f.polygon_cm).map((f) => f.polygon_cm)));
  const glazing = polyEdges((plan.panes || []).filter((p) => p.polygon_cm).map((p) => p.polygon_cm));

  // the entry's own outward normal (perpendicular to the slider, pointing onto the terrace): the camera walks in
  // square to the opening, like a person, never skimming the facade wall
  const outdoorRoomId = entry ? (entry.rooms || []).find((r) => outdoorIds.has(r)) : null;
  const outdoorLoop = outdoorRoomId ? roomById[outdoorRoomId]?.loop : null;
  let nIn = null; // unit vector, plan frame, from the terrace INTO the unit
  if (entry?.a_cm && entry?.b_cm) {
    const tv = [entry.b_cm[0] - entry.a_cm[0], entry.b_cm[1] - entry.a_cm[1]]; const tL = Math.hypot(tv[0], tv[1]) || 1;
    let no = [-tv[1] / tL, tv[0] / tL];
    const probe = [entryC[0] + no[0] * 60, entryC[1] + no[1] * 60];
    const onTerrace = outdoorLoop ? pointInPoly(probe, outdoorLoop) : no[0] * out[0] + no[1] * out[1] > 0;
    if (!onTerrace) no = [-no[0], -no[1]];
    nIn = [-no[0], -no[1]];
  }
  if (!nIn) nIn = [-out[0], -out[1]];
  const nOut = [-nIn[0], -nIn[1]];
  // how far back onto the terrace the walk starts: up to 3 m, at least 40 cm inside the terrace edge (the railing) and 60 cm
  // clear of every wall
  const rd = outdoorLoop ? rayToLoop([entryC[0] + nOut[0] * 30, entryC[1] + nOut[1] * 30], nOut, outdoorLoop) : null; // start past the slider edge of the terrace loop
  const terraceDepth = rd == null ? null : rd + 30;
  let back = Math.max(120, Math.min(300, (terraceDepth ?? 300) - 40));
  while (back > 120 && minWallDist([entryC[0] + nOut[0] * back, entryC[1] + nOut[1] * back], edges) < 60) back -= 10;
  const startXY = [entryC[0] + nOut[0] * back, entryC[1] + nOut[1] * back];

  // 4 (computed first). rooms: one slow push per camera point, STARTING ON the camera point (so the skinned pano,
  //    cropped at yaw_rel_deg, is exactly the first frame), looking the way a person who just walked in looks:
  //    from the room's arrival door toward the room's centre (the pano's own yaw only as a fallback)
  const roomShots = [];
  for (const c of cams) {
    const room = roomById[c.room_id] || {};
    const cen = room.loop ? centroid(room.loop) : [c.x, c.y];
    // the door the tour ARRIVES through: for the living room that is the terrace entry (the seam continues
    // straight into the room, no turn-around); elsewhere the widest door
    const doorsOfRoom = ops.filter((o) => /door|opening/.test(o.kind || '') && (o.rooms || []).includes(c.room_id) && o.centre_cm)
      .sort((a, b) => (a === entry && c.room_id === livingRoomId ? -1 : b === entry && c.room_id === livingRoomId ? 1 : 0) || (b.width_cm || 0) - (a.width_cm || 0));
    let d = null, lookSource = 'pano-yaw';
    for (const o of doorsOfRoom) {
      const v = [cen[0] - o.centre_cm[0], cen[1] - o.centre_cm[1]]; const L = Math.hypot(v[0], v[1]);
      if (L > 80) { d = [v[0] / L, v[1] / L]; lookSource = `door ${o.id} → centre`; break; }
    }
    if (!d) { const yaw = ((c.yaw_deg || 0) * Math.PI) / 180; d = [Math.sin(yaw), -Math.cos(yaw)]; }
    // the composition: from the camera point, the heading with the most visible depth (and window), like a
    // real-estate camera, not the door→centre line that often ends on a blank wall a metre away. The living room
    // keeps its arrival line exactly (the seam walks straight in and ends on it).
    const arrive = bearingOf(d);
    const isLiving = c.room_id === livingRoomId && entry;
    // a hero view chosen from real frames (tools/view_pick.py depth scores → tools/pick_views.mjs, an LLM's pick)
    // beats the plan score; the living room still keeps its arrival line
    const chosen = !isLiving ? opts.views?.points?.[c.id]?.chosen : null;
    let best = chosen ? { yaw: chosen.yaw_deg, score: Infinity } : { yaw: arrive, score: -Infinity };
    for (const yy of chosen ? [] : [arrive, ...Array.from({ length: 72 }, (_, i) => i * 5)]) { // the exact arrival line first: it wins ties
      const diff = Math.abs(((yy - arrive + 540) % 360) - 180);
      if (isLiving && yy !== arrive) continue; // the living room keeps its exact arrival line: the seam ends on it
      const sc = viewScore([c.x, c.y], yy, blockers, glazing) + 0.25 * Math.cos((diff * Math.PI) / 180); // mild pull toward the arrival line
      if (sc > best.score + 0.02) best = { yaw: yy, score: sc }; // a real improvement only: near-ties keep the arrival line
    }
    if (best.yaw !== arrive) { const b = (best.yaw * Math.PI) / 180; d = [Math.sin(b), -Math.cos(b)]; lookSource = chosen ? `hero view: ${chosen.source}` : `view score (arrival ${Math.round(arrive)}°)`; }
    const yawDeg = bearingOf(d);
    const yawRel = ((yawDeg - (c.yaw_deg || 0) + 540) % 360) - 180;
    const z = c.z || eye;
    const clear = rayToEdges([c.x, c.y], d, blockers) ?? 400;
    const push = Math.max(30, Math.min(100, clear - 100)); // cm forward, stopping a metre short of the wall ahead
    const p0 = [c.x, c.y], p1 = [c.x + d[0] * push, c.y + d[1] * push];
    const lookAt = [c.x + d[0] * 400, c.y + d[1] * 400];
    roomShots.push({
      id: `room-${c.id.replace(/^cp-/, '')}`, kind: 'room', camera_point: c.id, room_id: c.room_id || null,
      room_name_he: room.name_he || null, room_name_en: room.name_en || c.id,
      yaw_deg: Math.round(yawDeg * 10) / 10, yaw_rel_deg: Math.round(yawRel * 10) / 10, look_source: lookSource, push_cm: Math.round(push), view_score: Math.round(viewScore([c.x, c.y], yawDeg, blockers, glazing) * 100) / 100,
      duration_s: DUR.room, fov_mm: 24,
      keys: [{ t: 0, pos: toWorld(p0, z), look: toWorld(lookAt, z - 10) }, { t: DUR.room, pos: toWorld(p1, z), look: toWorld(lookAt, z - 10) }],
    });
  }

  // 3. enter: from the terrace, square to the slider, at walking pace, through the open slider, ending EXACTLY
  //    on the living room's first frame (shared seam frame)
  const livingShot = roomShots.find((x) => x.camera_point === living?.id) || roomShots[0];
  const startPos = toWorld(startXY, eye);
  const entryW = toWorld(entryC, eye);
  const endKey = livingShot ? livingShot.keys[0] : { pos: toWorld(livingXY, eye), look: toWorld(aptC, eye) };
  const h0 = headingOf(startPos, entryW); // straight through the middle of the opening
  const hEnd = headingOf(endKey.pos, endKey.look);
  const turn = ((hEnd - h0 + 540) % 360) - 180;
  const midPos = toWorld([entryC[0] + nOut[0] * 30, entryC[1] + nOut[1] * 30], eye); // 30 cm outside the plane, never ON it
  const len1 = Math.hypot(midPos[0] - startPos[0], midPos[1] - startPos[1]);
  const len2 = Math.hypot(endKey.pos[0] - midPos[0], endKey.pos[1] - midPos[1]);
  const enterDur = snap(Math.max(DUR.enter, (len1 + len2) / WALK_M_S)); // capped by the video model, so the walk may run a little faster than WALK_M_S
  const tMid = Math.round(enterDur * (len1 / (len1 + len2)) * 100) / 100; // constant speed across both legs
  const hMid = h0 + turn * (tMid / enterDur);
  const enterKey0 = { t: 0, pos: startPos, look: lookPoint(startPos, h0) };

  // 1. approach: far out, high, descending toward the unit; ends where the facade arc begins
  const facadeLook = toWorld(entryC, ceiling / 2);
  const sideE = [-nOut[1], nOut[0]];
  const fromEntry = (distCm, latCm) => [entryC[0] + nOut[0] * distCm + sideE[0] * latCm, entryC[1] + nOut[1] * distCm + sideE[1] * latCm];
  const arcStart = { pos: toWorld(fromEntry(4000, 1400), 600), look: facadeLook };
  shots.push({
    id: 'ext-approach', kind: 'exterior', duration_s: DUR.approach, fov_mm: 32,
    keys: [
      { t: 0, pos: toWorld(at(aptC, 220, 60), 9000), look: toWorld(aptC, 3000) },
      { t: DUR.approach * 0.55, pos: toWorld(at(aptC, 110, 20), 3500), look: toWorld(aptC, 800) },
      { t: DUR.approach, ...arcStart },
    ],
  });
  // 2. facade: an arc in front of the entry, 40 m out and 6 m up, down to the terrace start point at eye height,
  //    ending on the entry shot's first frame
  const arc = [];
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    if (i === steps) { arc.push({ t: DUR.facade, pos: enterKey0.pos, look: enterKey0.look }); break; }
    arc.push({ t: DUR.facade * f, pos: toWorld(fromEntry(ease(4000, back, f), ease(1400, 0, f)), ease(600, eye, f)), look: i === 0 ? facadeLook : toWorld(entryC, ease(ceiling / 2, eye - 10, f)) });
  }
  shots.push({ id: 'ext-facade', kind: 'exterior', duration_s: DUR.facade, fov_mm: 40, keys: arc });
  shots.push({
    id: 'ext-enter', kind: 'seam', duration_s: enterDur, fov_mm: 24, hide: entry && entry.kind !== 'opening' ? [entry.id] : [], entry: entry ? { id: entry.id, kind: entryKind } : null,
    start_back_cm: Math.round(back), terrace_depth_cm: terraceDepth == null ? null : Math.round(terraceDepth), walk_m_s: Math.round(((len1 + len2) / enterDur) * 100) / 100,
    // the slider stands open: the renderer hides the glass whose footprint covers this point (an "opening" in
    // the plan is not cut out of the pane by build_scene; a door is)
    open_glass_at_m: entry ? entryW : null,
    headings_deg: [Math.round(h0), Math.round(hMid), Math.round(hEnd)], turn_deg: Math.round(turn), yaw_rate_deg_s: Math.round(Math.abs(turn) / enterDur),
    keys: [enterKey0, { t: tMid, pos: midPos, look: lookPoint(midPos, hMid) }, { t: enterDur, pos: endKey.pos, look: endKey.look }],
  });
  // 4. the continuous opening (Eliran 2026-11-01: "פריים רציף ממעוף הציפור ועד הכניסה לדירה"): the three paths above as ONE
  //    shot, keys per frame on a speed profile, one lens; the video model takes it in segments that share their boundary frame
  const enterShot = shots[shots.length - 1];
  shots.push(...roomShots);
  shots.push(flightShot(shots[0], shots[1], enterShot, fps)); // last: the three legacy exterior shots and the rooms keep their indices
  return {
    schema: 'habait-studio/shots.v1', fps, apartment_id: plan.apartment_id || null,
    frame: 'world metres: X = x_cm/100, Y = -y_cm/100, Z up, floor at 0; ground at plan_meta.ground_offset_cm',
    unit_centre_m: toWorld(aptC, 0), facade_normal_plan: n, outward_plan: out,
    entry: entry ? { id: entry.id, kind: entryKind, centre_cm: entry.centre_cm, rooms: entry.rooms || [], outdoor_room: (entry.rooms || []).find((r) => outdoorIds.has(r)) || null, living_room: livingRoomId } : null,
    ground_offset_cm: plan.plan_meta?.ground_offset_cm ?? site?.ground_offset_cm ?? -300,
    shots, total_s: shots.reduce((s, x) => s + x.duration_s, 0),
  };
}

/** One continuous camera path from the aerial start, down the facade arc, onto the terrace and into the living room. The three
    shots' keys form one polyline (their boundaries are shared points already); the camera runs along it on a speed profile —
    drone speed far out, decaying smoothly to walking speed over the last `rampM` metres before the terrace, walking speed from
    there in — sampled as one key PER FRAME (easing: 'linear' tells the renderer not to ease again). A fixed lens: a focal-length
    change between clips reads as a cut. `segments` are the ≤137-frame pieces the video model renders, each starting on the
    previous one's last frame. */
export const FLIGHT_SEG = 137; // the render-to-real budget at 720p (8k+1)
export function flightShot(approach, facade, enter, fps = 24, nSegments = 3, rampM = 45) {
  const nFrames = nSegments * (FLIGHT_SEG - 1) + 1; // 3 → 409 frames, boundaries shared
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const keys = [...approach.keys, ...facade.keys.slice(1), ...enter.keys.slice(1)];
  const segs = []; let total = 0;
  for (let i = 1; i < keys.length; i++) { const L = dist(keys[i - 1].pos, keys[i].pos); segs.push({ a: keys[i - 1], b: keys[i], L, s0: total }); total += L; }
  const walkLen = enter.keys.slice(1).reduce((s, k, i) => s + dist(enter.keys[i].pos, k.pos), 0);
  const vWalk = enter.walk_m_s || WALK_M_S;
  const sm = (x) => { const u = Math.min(1, Math.max(0, x)); return u * u * (3 - 2 * u); };
  const vAt = (s, vAir) => { const d = total - s; return d <= walkLen ? vWalk : vWalk + (vAir - vWalk) * sm((d - walkLen) / rampM); };
  const travelTime = (vAir) => { let t = 0; const ds = total / 4000; for (let s = 0; s < total; s += ds) t += ds / vAt(s + ds / 2, vAir); return t; };
  const T = (nFrames - 1) / fps;
  let lo = vWalk, hi = 400; // m/s: find the drone speed that lands the whole path in T seconds
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (travelTime(mid) > T) lo = mid; else hi = mid; }
  const vAir = (lo + hi) / 2;
  const at = (s) => {
    const seg = segs.find((g) => s <= g.s0 + g.L) || segs[segs.length - 1];
    const f = seg.L ? Math.min(1, Math.max(0, (s - seg.s0) / seg.L)) : 1;
    return { pos: seg.a.pos.map((v, i) => v + (seg.b.pos[i] - v) * f), look: seg.a.look.map((v, i) => v + (seg.b.look[i] - v) * f) };
  };
  const out = []; let s = 0;
  const sub = 20;
  for (let k = 0; k < nFrames; k++) {
    const p = at(Math.min(s, total));
    out.push({ t: Math.round((k / fps) * 10000) / 10000, pos: p.pos.map((v) => Math.round(v * 10000) / 10000), look: p.look.map((v) => Math.round(v * 10000) / 10000) });
    for (let j = 0; j < sub; j++) s += vAt(s, vAir) / fps / sub;
  }
  out[out.length - 1] = { t: out[out.length - 1].t, pos: keys[keys.length - 1].pos.slice(), look: keys[keys.length - 1].look.slice() }; // lands exactly on the living hero view
  const segments = Array.from({ length: nSegments }, (_, i) => [i * (FLIGHT_SEG - 1) + 1, (i + 1) * (FLIGHT_SEG - 1) + 1]);
  return {
    id: 'ext-flight', kind: 'flight', duration_s: nFrames / fps, fov_mm: 28, easing: 'linear', frames: nFrames, segments,
    hide: enter.hide || [], entry: enter.entry || null, open_glass_at_m: enter.open_glass_at_m || null,
    path_m: Math.round(total), walk_m: Math.round(walkLen * 100) / 100, v_air_m_s: Math.round(vAir * 10) / 10, v_walk_m_s: vWalk, ramp_m: rampM,
    keys: out,
  };
}

export default {
  id: 'shots',
  title_he: 'מסלול המצלמה (shots.json)',
  title_en: 'Shots: the camera path',
  local: true,
  needs(ctx) { return ctx.derived('plan.json') ? null : 'plan.json missing (the plan stage must be done/approved)'; },
  async run(ctx) {
    const plan = ctx.derived('plan.json');
    const site = ctx.derived('site.json');
    const fps = ctx.project.options?.clay?.fps || 24;
    const shots = planShots(plan, site, { fps, views: ctx.derived('views.json') });
    ctx.saveDerived('shots.json', shots);
    ctx.log(`entry: ${shots.entry ? `${shots.entry.kind} ${shots.entry.id}` : 'none found (facade centre used)'}; facade normal (plan) ${shots.facade_normal_plan.map((v) => v.toFixed(2)).join(',')}`);
    return { status: 'done', note: `${shots.shots.length} shots, ${shots.total_s}s total (${shots.shots.filter((s) => s.kind !== 'room').length} exterior/seam + ${shots.shots.filter((s) => s.kind === 'room').length} rooms)`, outputs: ['derived/shots.json'] };
  },
};

export { fs };
