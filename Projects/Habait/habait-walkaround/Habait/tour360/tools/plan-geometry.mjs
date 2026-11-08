/* Habait Tour360 — plan-geometry.mjs (WALKAROUND-QUALITY-PLAN §3.1/§4.2): the plan-frame geometry the skin lane
   tools share (openings-test.mjs, make-skin-prompts.mjs). Plan frame: x right, y down, centimetres; a bearing is
   0 = up, clockwise; a camera's yaw_deg is a bearing; equirect u = 0.5 + rel/2π, v = 0.5 − elev/π. $0, no I/O. */

// distance from a point to a closed loop (the nearest edge)
export const distToLoop = (p, L) => {
  let d = Infinity;
  for (let i = 0; i < L.length; i++) {
    const a = L[i], b = L[(i + 1) % L.length];
    const dx = b[0] - a[0], dy = b[1] - a[1]; const l2 = dx * dx + dy * dy || 1;
    let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2; t = Math.max(0, Math.min(1, t));
    d = Math.min(d, Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy)));
  }
  return d;
};

// ray-casting point-in-loop
export const pointInLoop = (p, L) => {
  let inside = false;
  for (let i = 0, j = L.length - 1; i < L.length; j = i++) {
    const xi = L[i][0], yi = L[i][1], xj = L[j][0], yj = L[j][1];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

// a pane's long axis: its two farthest polygon vertices
export const paneAxis = (pane) => {
  const P = pane.polygon_cm; let best = null, bd = 0;
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
    const d = Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1]); if (d > bd) { bd = d; best = [P[i], P[j]]; }
  }
  return best ? { a: best[0], b: best[1], length_cm: bd } : null;
};

// the stretch of a pane that bounds a room: the axis sampled every `step` cm, the points within `tol` of the loop;
// null when none (the pane is somewhere else) or the stretch is shorter than `min`
export const paneSpanInRoom = (pane, loop, { tol = 60, step = 10, min = 60 } = {}) => {
  const ax = paneAxis(pane); if (!ax) return null;
  const n = Math.max(2, Math.ceil(ax.length_cm / step)); const pts = [];
  for (let k = 0; k <= n; k++) { const t = k / n; const p = [ax.a[0] + t * (ax.b[0] - ax.a[0]), ax.a[1] + t * (ax.b[1] - ax.a[1])]; if (distToLoop(p, loop) <= tol) pts.push(p); }
  if (pts.length < 2) return null;
  const a = pts[0], b = pts[pts.length - 1]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  // which ends of the stretch are the pane's own physical ends (a jamb): a stretch cut by a zone boundary has no jamb there
  const ends = [Math.hypot(a[0] - ax.a[0], a[1] - ax.a[1]) <= 15, Math.hypot(b[0] - ax.b[0], b[1] - ax.b[1]) <= 15];
  return l >= min ? { a, b, length_cm: l, share: l / ax.length_cm, points: pts, ends } : null;
};

// the share of an item's columns (a segment a→b between sill and head, seen from cam) whose surface the CG depth pass
// actually reached: a door around a corner or a pane behind a nearer wall reads 0; depthCm(x, y) returns centimetres
export const visibleShare = (cam, a, b, sill, head, depthCm, W, H, { tol = 0.85, slack = 30 } = {}) => {
  const proj = projector(cam); const zmid = (sill + head) / 2;
  const pa = proj(a, zmid), pb = proj(b, zmid);
  let d = pb.u - pa.u; if (d > 0.5) d -= 1; if (d < -0.5) d += 1;   // the short way round
  const n = Math.max(2, Math.round(Math.abs(d) * W)); const ymid = Math.max(0, Math.min(H - 1, Math.round(((pa.v + pb.v) / 2) * H)));
  const elev = (0.5 - ymid / H) * Math.PI; const yaw0 = ((cam.yaw_deg || 0) * Math.PI) / 180;
  const ax = a[0] - cam.x, ay = a[1] - cam.y, ex = b[0] - a[0], ey = b[1] - a[1]; let vis = 0, cnt = 0;
  for (let k = 0; k <= n; k++) {
    let u = pa.u + (d * k) / n; u = ((u % 1) + 1) % 1; const x = Math.min(W - 1, Math.floor(u * W));
    const th = yaw0 + (u - 0.5) * 2 * Math.PI; const dx = Math.sin(th), dy = -Math.cos(th);
    const den = dx * ey - dy * ex; if (Math.abs(den) < 1e-9) continue;
    const t = (ax * ey - ay * ex) / den, s = (ax * dy - ay * dx) / den; if (!(t > 0 && s >= -0.05 && s <= 1.05)) continue;
    const expected = t / Math.max(0.2, Math.cos(elev)); cnt++; if (depthCm(x, ymid) >= expected * tol - slack) vis++;
  }
  return cnt ? vis / cnt : 1;
};

// the rooms a stretch of points also bounds (other than `exceptId`): a room is across when at least `minShare` of the
// points lie within `tol` of its loop (a corner touch is not a shared boundary)
export const roomsAlong = (points, rooms, { tol = 40, exceptId = null, minShare = 0.35 } = {}) =>
  rooms.filter((r) => r.id !== exceptId && points.filter((p) => distToLoop(p, r.loop) <= tol).length >= Math.max(2, minShare * points.length));

// a camera's projection of a plan point at height z (cm) into equirect u,v (0..1) and its distance
export const projector = (cam) => {
  const yaw0 = ((cam.yaw_deg || 0) * Math.PI) / 180;
  return (p, z = cam.z || 160) => {
    const dx = p[0] - cam.x, dy = p[1] - cam.y; const bearing = Math.atan2(dx, -dy);
    let rel = bearing - yaw0; while (rel <= -Math.PI) rel += 2 * Math.PI; while (rel > Math.PI) rel -= 2 * Math.PI;
    const dist = Math.hypot(dx, dy); const elev = Math.atan2(z - (cam.z || 160), dist);
    return { u: 0.5 + rel / (2 * Math.PI), v: 0.5 - elev / Math.PI, dist, rel_deg: (rel * 180) / Math.PI };
  };
};

// where a direction sits in the panorama, in words a vision model follows (u 0.5 = straight ahead)
export const positionWords = (u) => {
  const d = (u - 0.5) * 360, a = Math.abs(d);
  if (a <= 20) return 'straight ahead, at the centre of the image';
  if (a <= 60) return d < 0 ? 'ahead and to the left' : 'ahead and to the right';
  if (a <= 115) return d < 0 ? 'on the left' : 'on the right';
  if (a <= 155) return d < 0 ? 'behind and to the left' : 'behind and to the right';
  return 'directly behind the camera, split across the left and right edges of the image';
};
