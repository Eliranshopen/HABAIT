/* Habait Tour360 — tools/hotspot-hit.mjs (R23b, 2026-11-06: Eliran found the LIVE 02-kitchen "כניסה" hotspot on the fridge's face).
   ONE model of "what does a hotspot marker sit on", used by make-scenes.mjs (to place it) and hotspot-check.mjs (to verify it).
   The marker is drawn at u → bearing and v → the VIEWER's pitch (viewer/tour.js hsPitch: −12° − min(5, (v − 0.6)·35), and past v 0.743 the floor line at 180°/unit; NOT the floor line
   of the picture). That ray is looked up in the CG render's depth of the same camera (360walkaround/tours/<cg_tour>/renders/<cam>/depth.png,
   rgb24-be radial cm; the main checkout's when this runs in a .wt/ worktree, the renders being gitignored) → the 3D point it lands on:
     floor (≤ 8 cm up) · opening <id> (within 30 cm of an opening/door chord; past one the landing counts) · glass <id> (a facade/railing pane or its sill/parapet, within 40 cm) → ok
     FIXTURE <id> (within 20 cm of a fixture polygon, up to its height + 15 cm; or floor closer than CLEAR_CM to any fixture footprint, or a ray that passes less than GRAZE_CM over a fixture on its way) · wall
   → NOT ok; a marker is ok only when its centre ray AND the 8 rays ±STENCIL_DEG around it are ok. */
import fs from 'node:fs';
import path from 'node:path';

export const CLEAR_CM = 35, STENCIL_DEG = 2, GRAZE_CM = 25;
export const hsPitch = (v) => -12 - Math.min(5, (v - 0.6) * 35) - Math.max(0, (v - 0.6 - 5 / 35) * 180);   // = viewer/tour.js hsPitch (R23b)
const inPoly = (p, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > p[1]) !== (P[j][1] > p[1]) && p[0] < ((P[j][0] - P[i][0]) * (p[1] - P[i][1])) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; };
const segDist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy; const t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0; return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
const polyDist = (p, P) => (inPoly(p, P) ? 0 : Math.min(...P.map((a, i) => segDist(p, a, P[(i + 1) % P.length]))));
const lineDist = (p, L) => Math.min(...L.slice(1).map((b, i) => segDist(p, L[i], b)));
const segX = (p, q, a, b) => { const d = (q[0] - p[0]) * (b[1] - a[1]) - (q[1] - p[1]) * (b[0] - a[0]); if (Math.abs(d) < 1e-9) return false; const t = ((a[0] - p[0]) * (b[1] - a[1]) - (a[1] - p[1]) * (b[0] - a[0])) / d, s = ((a[0] - p[0]) * (q[1] - p[1]) - (a[1] - p[1]) * (q[0] - p[0])) / d; return t > 0 && t < 1 && s >= 0 && s <= 1; };

export function rendersDir(REPO, cgTour, explicit) {
  const wt = REPO.match(/^(.*)[\\/]\.wt[\\/][^\\/]+[\\/](.*)$/);
  const cands = [explicit, path.join(REPO, '360walkaround', 'tours', cgTour, 'renders'), wt ? path.join(wt[1], wt[2], '360walkaround', 'tours', cgTour, 'renders') : null].filter(Boolean);
  return cands.find((d) => fs.existsSync(d) && fs.readdirSync(d).some((x) => x.startsWith('cp-') && fs.existsSync(path.join(d, x, 'depth.png')))) || null;
}

// → { hit(sceneCentreBearing, u, v) → row } for one camera, or null when its depth is missing
// avoid: fidelity.json known_deviations[].marker_avoid of THIS picture ({ bearing_deg: [a, b], above_pitch_deg }): where a shipped picture
// shows a fixture the render does not have there (01-entrance's fridge without the passage), the render's floor is the picture's fixture
export function avoidFor(TOUR, asset) {
  try { return (JSON.parse(fs.readFileSync(path.join(TOUR, 'fidelity.json'), 'utf8')).known_deviations || []).filter((k) => k.asset === asset && k.marker_avoid).map((k) => ({ ...k.marker_avoid, asset })); } catch { return []; }
}
export async function hitModel(sharp, plan, cam, RENDERS, avoid = []) {
  const dir = RENDERS && path.join(RENDERS, cam.id);
  if (!dir || !fs.existsSync(path.join(dir, 'depth.png'))) return null;
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'pano.render.json'), 'utf8'));
  const yaw = meta.point?.yaw_deg, z = cam.z ?? 160;
  const { data, info } = await sharp(path.join(dir, 'depth.png')).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, ch = info.channels;
  const fixtures = plan.fixtures.filter((f) => (f.polygon_cm || []).length >= 3);
  const chords = (plan.openings || []).filter((o) => o.a_cm && o.b_cm);
  const panes = (plan.panes || []).filter((q) => (q.polygon_cm || []).length >= 2);
  const C = [cam.x, cam.y];
  return {
    yaw,
    // one ray: what the depth says at bearing b, pitch p
    ray(b, pitch) {
      const col = Math.round(((((b - (yaw ?? b)) / 360 + 0.5) % 1) + 1) % 1 * W) % W;
      const row = Math.min(H - 1, Math.max(0, Math.round((0.5 - pitch / 180) * H)));
      const i = (row * W + col) * ch, d = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
      const pr = pitch * Math.PI / 180, br = b * Math.PI / 180, horiz = d * Math.cos(pr), height = z + d * Math.sin(pr);
      const P = [C[0] + horiz * Math.sin(br), C[1] - horiz * Math.cos(br)];
      const fd = fixtures.map((f) => ({ f, dd: polyDist(P, f.polygon_cm) })).sort((a, c) => a.dd - c.dd);
      const fx = fd.find((q) => height > 8 && q.dd <= 20 && height <= Number(q.f.height_cm || 0) + 15);
      // the designed picture's furniture is not the CG's blocks to the centimetre: floor must keep CLEAR_CM from every fixture's footprint
      // a ray that skims a fixture on its way (the designed bed/sofa is taller than the CG block: pillows, cushions) lands "on" it in the picture
      let graze = null;
      if (!fx) for (let t = 10; t < horiz - 10 && !graze; t += 10) {
        const Q = [C[0] + t * Math.sin(br), C[1] - t * Math.cos(br)], hq = z - t * Math.tan(-pr);
        graze = fixtures.find((f) => hq < Number(f.height_cm || 0) + GRAZE_CM && inPoly(Q, f.polygon_cm)) || null;
      }
      const crowd = !graze && height <= 8 && fd[0] && fd[0].dd < CLEAR_CM ? fd[0] : null;
      const op = chords.find((o) => segDist(P, o.a_cm, o.b_cm) <= 30);   // AT the doorway; a ray that passes one lands like any other (floor ok, a bed or a wall not)
      const gl = panes.find((q) => lineDist(P, q.polygon_cm) <= 40);   // a pane is a polyline (a curved facade has many points), never a closed area
      const bn = ((b % 360) + 360) % 360, av = avoid.find((a) => bn >= a.bearing_deg[0] && bn <= a.bearing_deg[1] && pitch > a.above_pitch_deg);
      const what = av ? `FIXTURE ${av.fixture || 'shown'} (known deviation of ${av.asset})` : fx ? `FIXTURE ${fx.f.id}` : graze ? `FIXTURE ${graze.id} (the ray skims it)` : crowd ? `FIXTURE ${crowd.f.id} (floor ${Math.round(crowd.dd)} cm from it)` : height <= 8 ? 'floor' : op ? `opening ${op.id}` : gl ? `glass ${gl.id}` : 'wall';
      return { bearing: Math.round(b), pitch: Number(pitch.toFixed(1)), depth_cm: d, height_cm: Math.round(height), hit_cm: P.map(Math.round), what, ok: !/^(FIXTURE|wall)/.test(what) };
    },
    // the marker at (u, v): its centre ray, and ok only when the ring around it (±STENCIL_DEG in bearing and pitch) is ok too — the picture
    // is not the render to the pixel, and a marker has a size
    hit(centre, u, v) {
      const b = centre + (u - 0.5) * 360, pitch = v == null ? -14 : hsPitch(v);
      const r = this.ray(b, pitch);
      if (!r.ok) return r;
      for (const [db, dp] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) {
        const q = this.ray(b + db * STENCIL_DEG, pitch + dp * STENCIL_DEG);
        if (!q.ok) return { ...r, what: `${q.what} (within ${STENCIL_DEG}° of the marker)`, ok: false };
      }
      return r;
    },
  };
}

// the nearest marker position (u ±25°, v 0.40-1.00) whose ray lands on floor / an opening / glass AND lands closer to the target camera than this camera is
export function placeOff(model, centre, u0, v0, C, T) {
  const toward = (r) => !T || Math.hypot(r.hit_cm[0] - T[0], r.hit_cm[1] - T[1]) < Math.hypot(C[0] - T[0], C[1] - T[1]);
  const first = model.hit(centre, u0, v0);
  if (first.ok) return { u: u0, v: v0, row: first, moved: false };   // an ok marker is never moved
  const cands = [];
  for (let db = -25; db <= 25; db++) for (let k = -28; k <= 32; k++) { const v = Number((v0 + k * 0.01).toFixed(2)); cands.push({ db, v, cost: Math.abs(db) + Math.abs(v - v0) * 100 }); }
  cands.sort((a, b) => a.cost - b.cost || Math.abs(a.db) - Math.abs(b.db) || a.v - b.v);
  for (const c of cands) {
    const u = Number(((((u0 + c.db / 360) % 1) + 1) % 1).toFixed(3)); const r = model.hit(centre, u, c.v);
    if (r.ok && toward(r)) return { u, v: c.v, row: r, moved: true, was: first };
  }
  return { u: u0, v: v0, row: first, moved: false, unresolved: true };
}
