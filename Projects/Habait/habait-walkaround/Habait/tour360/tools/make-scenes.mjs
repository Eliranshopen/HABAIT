#!/usr/bin/env node
/* Habait Tour360 — tools/make-scenes.mjs (apt846, 2026-10-28). The viewpoint graph from the camera table: apartments/<id>/cameras.json
   → apartments/<id>/scenes.json. Every door marker is placed by the plan bearing to the opening the visitor walks through (`via`),
   minus the bearing the panorama centre faces (`lookAt`): u = 0.5 + (bearing(via) − bearing(lookAt)) / 360, wrapped; v = 0.68
   (the floor line) — the apartment-37 rule (2026-10-15), never by eye. Plan x/y = crop px × planScale (the viewer's sheet).
     node Habait/tour360/tools/make-scenes.mjs <apartment>
   $0. R23b (2026-11-06): needs sharp (app-require) and the CG depth renders to keep markers off fixture faces (tools/hotspot-hit.mjs). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOLS = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TOOLS, '..');
const id = process.argv[2];
if (!id) { console.error('usage: make-scenes.mjs <apartment>'); process.exit(2); }
const APT = path.join(ROOT, 'apartments', id);
const cams = JSON.parse(fs.readFileSync(path.join(APT, 'cameras.json'), 'utf8'));
const bearingDeg = (from, to) => ((Math.atan2(to[0] - from[0], -(to[1] - from[1])) * 180) / Math.PI + 360) % 360;
const ids = new Set(cams.scenes.map((s) => s.id));
const V_FLOOR = 0.68;
const scale = cams.plan.planScale;

// WALKABLE HOTSPOTS (2026-11-05, fix-846-fidelity; parity R23): a hotspot must land on floor the visitor can walk to — not on a wall that
// hides the door (a camera moved by the jamb rule), a closet, a counter or a bed. When the hand-placed `via` is hidden from the camera
// (the sight line crosses a wall or a fixture >= 100 cm tall) or stands on a fixture, the hotspot takes the nearest visible floor point
// on the opening between the two rooms, else on the straight way toward the target camera (80-300 cm out), clear of every fixture by
// 25 cm. Plan geometry from plan.general.json (cm; the camera table is in crop px = cm x plan_meta.scale_px_per_cm).
const planFile = path.join(APT, 'plan.general.json');
const PG = fs.existsSync(planFile) ? JSON.parse(fs.readFileSync(planFile, 'utf8')) : null;
const K = PG ? Number(PG.plan_meta?.scale_px_per_cm || cams.plan.pxPerCm) : cams.plan.pxPerCm;
const segX = (p, q, a, b) => { const d = (q[0] - p[0]) * (b[1] - a[1]) - (q[1] - p[1]) * (b[0] - a[0]); if (Math.abs(d) < 1e-9) return false; const t = ((a[0] - p[0]) * (b[1] - a[1]) - (a[1] - p[1]) * (b[0] - a[0])) / d; const s = ((a[0] - p[0]) * (q[1] - p[1]) - (a[1] - p[1]) * (q[0] - p[0])) / d; return t > 1e-6 && t < 1 - 1e-6 && s >= 0 && s <= 1; };
const inPoly = (pt, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c; } return c; };
const segDist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy; const t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0; return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
const polyDist = (p, P) => (inPoly(p, P) ? 0 : Math.min(...P.map((a, i) => segDist(p, a, P[(i + 1) % P.length]))));
const walls = PG ? PG.walls.map((w) => w.polygon_cm) : [];
const fixtures = PG ? PG.fixtures.filter((f) => (f.polygon_cm || []).length >= 3) : [];
const blockers = [...walls, ...fixtures.filter((f) => Number(f.height_cm || 0) >= 100).map((f) => f.polygon_cm)];
const sees = (C, P) => !blockers.some((B) => inPoly(P, B) || B.some((a, i) => segX(C, P, a, B[(i + 1) % B.length])));
const onFloor = (P) => !walls.some((w) => inPoly(P, w)) && fixtures.every((f) => polyDist(P, f.polygon_cm) >= 25);
function walkableVia(scene, link) {
  if (!PG) return { via: link.via, how: 'plan-bearing via the opening' };
  const camOf = (sid) => PG.camera_points.find((c) => c.id.toLowerCase() === `cp-${sid}`.toLowerCase());
  const c0 = camOf(scene.id), c1 = camOf(link.to);
  if (!c0) return { via: link.via, how: 'plan-bearing via the opening' };
  const C = [c0.x, c0.y], V = [link.via[0] / K, link.via[1] / K];
  if (sees(C, V) && onFloor(V)) return { via: link.via, how: 'plan-bearing via the opening' };
  const near = (pts) => pts.filter((P) => sees(C, P) && onFloor(P)).sort((a, b) => Math.hypot(a[0] - V[0], a[1] - V[1]) - Math.hypot(b[0] - V[0], b[1] - V[1]))[0];
  const ops = c1 ? PG.openings.filter((o) => o.rooms?.includes(c0.room_id) && o.rooms?.includes(c1.room_id)) : [];
  const onOps = ops.flatMap((o) => { const n = Math.max(2, Math.round(Math.hypot(o.b_cm[0] - o.a_cm[0], o.b_cm[1] - o.a_cm[1]) / 10)); return Array.from({ length: n + 1 }, (_, i) => [o.a_cm[0] + (o.b_cm[0] - o.a_cm[0]) * i / n, o.a_cm[1] + (o.b_cm[1] - o.a_cm[1]) * i / n]); });
  let P = near(onOps), how = 'the visible part of the opening (the hand via is hidden from this camera)';
  if (!P && c1) {
    const T = [c1.x, c1.y], d = Math.hypot(T[0] - C[0], T[1] - C[1]);
    P = near(Array.from({ length: 23 }, (_, i) => 80 + i * 10).filter((r) => r < d).map((r) => [C[0] + (T[0] - C[0]) * r / d, C[1] + (T[1] - C[1]) * r / d]));
    how = 'the visible floor toward the target camera (the hand via and its opening are hidden)';
  }
  if (!P && c1) {
    // the way round: the floor in front of any door of the target room (40-100 cm out, on the side away from that room)
    const tRoom = PG.rooms.find((r) => r.id === c1.room_id);
    const pts = [];
    for (const o of PG.openings.filter((x) => x.kind !== 'opening' && x.rooms?.includes(c1.room_id))) {
      const mx = (o.a_cm[0] + o.b_cm[0]) / 2, my = (o.a_cm[1] + o.b_cm[1]) / 2, L = Math.hypot(o.b_cm[0] - o.a_cm[0], o.b_cm[1] - o.a_cm[1]);
      const nx = -(o.b_cm[1] - o.a_cm[1]) / L, ny = (o.b_cm[0] - o.a_cm[0]) / L;
      for (const sgn of [1, -1]) for (let r = 40; r <= 100; r += 10) {
        const P2 = [mx + sgn * nx * r, my + sgn * ny * r];
        if (tRoom && inPoly(P2, tRoom.loop)) continue;
        pts.push(P2);
      }
    }
    const ok = pts.filter((Q) => sees(C, Q) && onFloor(Q)).sort((a, b) => Math.hypot(a[0] - C[0], a[1] - C[1]) - Math.hypot(b[0] - C[0], b[1] - C[1]));
    P = ok[0]; how = "the visible floor in front of the target room's door (the way round)";
  }
  if (!P) { console.warn(`dropped: ${scene.id} → ${link.to}: no floor point of the way there is visible from this camera (a hotspot on a wall leads nowhere); the map and the way back still link them`); return null; }
  return { via: [P[0] * K, P[1] * K], how };
}

// THE START VIEW (2026-11-05, parity R23): a room opened from the map or the room strip starts at its scene's `heading` (the viewer's
// yaw from the panorama centre). The centre is the authored lookAt; a camera moved by the R22 rule can face a near wall from there
// (cp-bedroomMain: a blank wall at 1 m). When the clear sight at the centre (smoothed over 30 deg) is under 200 cm, the heading turns
// to the bearing with the longest clear sight (walls and fixtures >= 100 cm block); otherwise it stays 0, the authored view.
function startHeading(scene, centre) {
  if (!PG) return 0;
  const cp = PG.camera_points.find((c) => c.id.toLowerCase() === `cp-${scene.id}`.toLowerCase());
  if (!cp) return 0;
  const C = [cp.x, cp.y];
  // the pictures show doors CLOSED: a door's chord blocks the start view too (a bathroom would otherwise face its own door)
  const doorChords = (PG.openings || []).filter((o) => o.kind !== 'opening').map((o) => [o.a_cm, o.b_cm]);
  const ray = (b) => { const r = (b * Math.PI) / 180, D = [Math.sin(r), -Math.cos(r)]; let best = 2000;
    for (const B of [...blockers, ...doorChords]) for (let i = 0; i < B.length; i++) { const a = B[i], c = B[(i + 1) % B.length];
      const ex = c[0] - a[0], ey = c[1] - a[1], den = D[0] * ey - D[1] * ex; if (Math.abs(den) < 1e-9) continue;
      const t = ((a[0] - C[0]) * ey - (a[1] - C[1]) * ex) / den, u = ((a[0] - C[0]) * D[1] - (a[1] - C[1]) * D[0]) / den;
      if (t > 1 && u >= 0 && u <= 1 && t < best) best = t; } return best; };
  const d = Array.from({ length: 360 }, (_, b) => ray(b));
  const sm = (b) => { let s = 0; for (let k = -15; k <= 15; k++) s += Math.min(d[((Math.round(b) + k) % 360 + 360) % 360], 800); return s / 31; };
  if (sm(centre) >= 200) return 0;
  let bb = 0; for (let b = 0; b < 360; b++) if (sm(b) > sm(bb)) bb = b;
  if (sm(bb) < 1.5 * sm(centre)) return 0;
  const h = ((bb - centre + 540) % 360) - 180;
  console.log(`start view: ${scene.id} faces ${Math.round(sm(centre))} cm of clear sight at its centre; heading ${Math.round(h)} deg (${Math.round(sm(bb))} cm)`);
  return Math.round(h);
}

// R23b (2026-11-06, Eliran found the LIVE 02-kitchen "כניסה" marker on the fridge's face): the marker is DRAWN at the viewer's pitch
// (viewer/tour.js hsPitch), not on the picture's floor line, so a walkable `via` can still put it on a fixture or a wall. Each marker is
// looked up in the CG depth of its camera (tools/hotspot-hit.mjs, the model tools/hotspot-check.mjs verifies with) and, when it lands on
// a FIXTURE face or a wall, moved to the nearest (u ±25°, v 0.40-1.00) whose ray lands on floor, an opening or glass toward the target.
// No depth (renders not on disk) → the old placement, said once; hotspot-check then refuses.
const { appRequire } = await import('./app-require.mjs');
const { avoidFor, hitModel, rendersDir, placeOff } = await import('./hotspot-hit.mjs');
const REPO = path.resolve(ROOT, '..', '..');
const cgTour = (() => { try { return JSON.parse(fs.readFileSync(path.join(APT, 'apartment.json'), 'utf8')).sets?.original?.cg_tour; } catch { return null; } })() || id;
const RENDERS = PG ? rendersDir(REPO, cgTour, null) : null;
const models = {};
if (RENDERS) { const sharp = appRequire(REPO)('sharp'); for (const s of cams.scenes) { const cp = PG.camera_points.find((c) => c.id.toLowerCase() === `cp-${s.id}`.toLowerCase()); if (cp) models[s.id] = { cp, m: await hitModel(sharp, PG, cp, RENDERS, avoidFor(ROOT, s.asset)) }; } }
else console.warn(`R23b: no CG depth for ${cgTour}: markers keep the plan placement (hotspot-check.mjs will refuse)`);
const camOfId = (sid) => PG && PG.camera_points.find((c) => c.id.toLowerCase() === `cp-${sid}`.toLowerCase());

const scenes = cams.scenes.map((s) => {
  const centre = bearingDeg(s.at, s.lookAt);
  const hotspots = (s.links || []).map((l) => {
    if (!ids.has(l.to)) throw new Error(`${s.id}: link to unknown scene ${l.to}`);
    const w = walkableVia(s, l);
    if (!w) return null;
    const b = bearingDeg(s.at, w.via);
    let u = 0.5 + (b - centre) / 360; u = ((u % 1) + 1) % 1;
    u = Number(u.toFixed(3));
    const M = models[s.id];
    if (M?.m) {
      const t = camOfId(l.to); const p = placeOff(M.m, Number(centre.toFixed(1)), u, V_FLOOR, [M.cp.x, M.cp.y], t ? [t.x, t.y] : null);
      if (p.unresolved) console.warn(`R23b: ${s.id} → ${l.to}: no marker position within ±25° lands on floor/opening/glass (${p.row.what}); kept`);
      if (p.moved) return { to: l.to, u: p.u, v: p.v, source: `${w.how}; R23b moved off ${p.was.what} (CG depth) to ${p.row.what}` };
    }
    return { to: l.to, u, v: V_FLOOR, source: w.how };
  }).filter(Boolean);
  return {
    id: s.id,
    name: cams.names[s.id],
    zone: cams.zones[s.zone],
    asset: s.asset,
    plan: { x: Math.round(s.at[0] * scale), y: Math.round(s.at[1] * scale) },
    heading: startHeading(s, centre),
    northOffset: 0,
    centreBearingDeg: Number(centre.toFixed(1)),
    hotspots,
  };
});

// the exterior 360 nodes (2026-11-02, Eliran: the flyover is a chain of 360 scenes, not a clip): apartments/<id>/exterior.json
// lists them with hand-placed hotspots (u/v on the equirect) and no plan position; they go first, the bird's-eye node opens the tour.
// A node may name `backFrom`: an existing room scene that gets a reciprocal hotspot (u/v given) back out to the node.
const extPath = path.join(APT, 'exterior.json');
if (fs.existsSync(extPath)) {
  const ext = JSON.parse(fs.readFileSync(extPath, 'utf8'));
  // autoNext/autoDwellMs: the automatic passages (the intro orbit, the descent); hold: the node the buyer gets control at (2026-11-02)
  const extScenes = ext.scenes.map((s) => ({ id: s.id, name: s.name, zone: s.zone || ext.zone, asset: s.asset, exterior: true, heading: 0, northOffset: 0, centreBearingDeg: null, ...(s.autoNext ? { autoNext: s.autoNext, autoDwellMs: s.autoDwellMs, ...(Number.isFinite(s.autoYaw) ? { autoYaw: s.autoYaw } : {}) } : {}), ...(s.hold ? { hold: true } : {}), hotspots: s.hotspots.map((h) => ({ ...h, source: h.source || 'exterior.json, placed on the equirect' })) }));
  for (const s of ext.scenes) if (s.backFrom) {
    const room = scenes.find((t) => t.id === s.backFrom.scene);
    if (!room) throw new Error(`exterior.json: ${s.id}.backFrom names an unknown scene ${s.backFrom.scene}`);
    room.hotspots.push({ to: s.id, u: s.backFrom.u, v: s.backFrom.v, source: 'exterior.json backFrom' });
  }
  scenes.unshift(...extScenes);
}

// every link reciprocal, by rule
for (const s of scenes) for (const h of s.hotspots) {
  const back = scenes.find((t) => t.id === h.to);
  if (!back.hotspots.some((x) => x.to === s.id)) console.warn(`warning: ${s.id} → ${h.to} has no way back`);
}

const doc = {
  $schema: 'tour360/scenes.v1',
  apartment: id,
  coordinateNotes: {
    u_v: 'normalized position on the FULL equirectangular image: u 0→1 left→right (0.5 = image centre = yaw 0); v 0.68 on the floor line',
    plan: `x/y in the pixel space of ${cams.plan.sheet} = the plan crop (${cams.plan.width}×${cams.plan.height} px, ≈${cams.plan.pxPerCm} px/cm, rotated as the architect drew it) × ${scale}`,
    hotspots: 'u from the plan bearing to the opening the visitor walks through (cameras.json `via`), minus the bearing the panorama centre faces (`lookAt`); computed by tools/make-scenes.mjs, not calibrated by eye',
    heading: 'the start yaw of every room is 0, the panorama centre the prompt aimed (cameras.json lookAt; centreBearingDeg is that bearing in plan image space)',
  },
  scenes,
};
fs.writeFileSync(path.join(APT, 'scenes.json'), JSON.stringify(doc, null, 1) + '\n');
console.log(`scenes.json: ${scenes.length} scenes, ${scenes.reduce((n, s) => n + s.hotspots.length, 0)} links`);
for (const s of scenes) console.log(`  ${s.id.padEnd(15)} centre ${String(s.centreBearingDeg).padStart(5)}°  ` + s.hotspots.map((h) => `${h.to}@u${h.u}`).join('  '));
