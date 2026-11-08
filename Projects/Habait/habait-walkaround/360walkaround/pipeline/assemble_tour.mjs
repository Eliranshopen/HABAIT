#!/usr/bin/env node
/**
 * assemble_tour.mjs — `plan.json` + the render `manifest.json` ⇒ `tour.json`   (board 360-v2, T08)
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 *
 *   node pipeline/assemble_tour.mjs tours/pilot-karnei            # writes tours/pilot-karnei/tour.json
 *   node pipeline/assemble_tour.mjs tours/pilot-karnei --out X    # elsewhere (tests)
 *   node pipeline/assemble_tour.mjs tours/pilot-karnei --json     # the report, machine-readable
 *
 * Exit 0 clean · 1 on an assembly failure (a missing/altered render, a stale render, an unknown
 * depth encoding, a broken registration) · 2 on a usage error.
 *
 * ── WHAT THIS FILE OWNS (CONTRACT §16.4 / C-360-80: ownership is BY FILE) ──────────────────────
 * `pipeline/assemble_tour.mjs` + its test + every `tours/<id>/tour.json` are walkthrough-engineer's.
 * `tour.json` is one of the FOUR shared file contracts (C-360-81): it may be EXTENDED by its owner
 * (a new optional field), ⛔ never RESHAPED (a renamed/retyped field, a moved path, a changed unit)
 * except on-board. **Units are part of the shape**: positions are CENTIMETRES, angles DEGREES,
 * areas m², depth METRES. T09 (viewer/minimap) and T10 (ruler/dimensions) consume this file.
 *
 * ── THE GRAPH RULE, AND WHY IT IS NOT THE REFERENCE'S ──────────────────────────────────────────
 * ⭐ F-360-116 (T02). GetFloorPlan reverse-indexes `doors[].Walls[]` against `rooms[].Walls[]`,
 * which works because every wall there separates exactly two rooms. Here a wall is a FOOTPRINT
 * rectangle and `w-kit-w` bounds FIVE rooms, so the pair is recorded on the OPENING and SCHEMA §6
 * makes that pair the edge:
 *
 *   edge(A,B) ⟺ some opening lists exactly {A,B} in `rooms`, A≠B, neither is "outside",
 *               and its `kind` is not "window".
 *
 * ⛔ A window is never a tour edge, even between two rooms. ⛔ An opening onto "outside" (the front
 * door) is never a tour edge. Two openings between the same pair (corridor↔dining has two, kitchen↔
 * dining has two) collapse to ONE edge; the link then walks through whichever of them is nearest the
 * source camera (squared-XY, ties by opening id) — recorded per link as `via_opening`.
 *
 * ── THE LINKS A POINT GETS ─────────────────────────────────────────────────────────────────────
 *  • `spot` — one to every OTHER camera point in its OWN room, aimed at that point at FLOOR level
 *             (z = 0), i.e. the floor disc you step onto.
 *  • `door` — one per incident edge whose far room HAS at least one camera point, aimed at the far
 *             room's NEAREST point (squared-XY argmin, ties by point id) at DOOR MID-HEIGHT
 *             (z = (sill+head)/2 of `via_opening`).
 * ⛔ An outdoor room carries no camera point (SCHEMA §7), so balconies are link-less by construction
 * — the edge still exists in `graph.edges` with `walkable:false`, because the minimap may want to
 * draw the door even though you cannot stand out there.
 *
 * ⚠ `offset_cm` is the direction the task prescribes (the TARGET at door mid-height). It is not
 * always a clear line: `sightline.direct=false` means a real wall stands between the camera and that
 * aim point, so the marker would paint ON the wall. Every door link therefore ALSO carries
 * `via_opening.offset_cm` — the doorway itself, which is by construction visible — and T09 chooses.
 * The blocking test is pure plan geometry (segment vs wall footprint, with the opening's own 3-D
 * aperture as the hole), never a depth read: the assembler stays $0 and fast.
 *
 * ── ANGLES: WHOSE CONVENTION, AND WHY IT IS NOT RE-DERIVED HERE ────────────────────────────────
 * The pano's direction↔pixel mapping belongs to the RENDER, so it is quoted from each point's own
 * `pano.render.json` and the 12 sidecars are asserted to agree. The formulas below are the ones
 * `scripts/g0-ruler.mjs` (T05) already cross-checked, pixel-exact, against the renderer's OWN
 * `depth_checks` rows — including asymmetric off-axis rows (az −90° = plan-east at yaw 180°,
 * decoded 1.86 m vs an expected 1.858 m), which is what pins the SIGN of the azimuth:
 *
 *   bearing_deg  = atan2(dx, −dy)                 plan bearing: 0 = −y (up on the drawing), 90 = +x,
 *                                                 clockwise, [0,360)  (SCHEMA §1)
 *   az_deg       = wrap180(bearing_deg − yaw_cam) azimuth FROM the camera's forward, + to the RIGHT
 *                                                 (the sidecar's "u=0.5 = forward, u increases right")
 *   elev_deg     = atan2(dz, hypot(dx,dy))        + is up
 *   u            = wrap01(0.5 + az_deg/360)       equirect texture coords, u∈[0,1), v=0 at the TOP
 *   v            = 0.5 − elev_deg/180             (the sidecar writes the PNG top-row-first)
 *
 * ⛔ These are NOT PSV coordinates. T09 maps them to PSV's own yaw/pitch (or hands PSV the
 * `texture_uv` directly) and MEASURES that mapping — this file states what its numbers mean and
 * stops there.
 *
 * ── THE MINIMAP REGISTRATION IS READ, NOT RECOMPUTED ───────────────────────────────────────────
 * T07's `renders/topview.registration.json` carries the two-way affine. This file VALIDATES it
 * (extent ⇄ cm/px ⇄ image size; world→uv→world on every camera point; the legend's own
 * `polygon_px` reproduced from plan.json's loops; every camera point's uv inside its room's polygon)
 * and then re-expresses it in the one form a viewer wants: NORMALISED image coordinates.
 *   u = (x_cm − origin_cm[0]) / span_cm[0]   v = (y_cm − origin_cm[1]) / span_cm[1]
 * ⚠ The legend's `polygon_px` are pixel-CENTRE indices; u,v here are EDGE-based continuous image
 * coordinates (0 = the left/top edge of the image, 1 = the right/bottom edge), so
 * u = (polygon_px + 0.5)/width. Half a pixel is 0.62 cm on this render and the assembler's own test
 * asserts the relation both ways — a viewer that mixes the two draws every room half a pixel NW.
 *
 * ── LOUD FAILURE (C-360-81's enforcement point for this contract) ──────────────────────────────
 * Every asset reference is validated against the manifest AND against the bytes on disk: the row
 * must exist, the file must exist, its size must equal the row's `bytes`, its sha256 must equal the
 * row's `sha256`. A render whose sidecar pose or plan hash does not match the CURRENT plan.json is a
 * STALE render and fails just as loudly — a tour assembled from a render of a different apartment
 * geometry is the failure nobody would see in a screenshot. ⛔ Nothing degrades, nothing is skipped.
 *
 * ── DETERMINISM ────────────────────────────────────────────────────────────────────────────────
 * ⛔ No wall clock anywhere. `meta.assembled.date_utc` is PINNED to the newest input timestamp
 * (max of the referenced rows' `rendered_utc` and the manifest's `updated_utc`), so a rerun over
 * unchanged inputs is byte-identical. Arrays are emitted in a stated order; every float is rounded
 * at a stated precision.
 *
 * ── DISCLOSURE: KEYS, ⛔ NEVER STRINGS (A8-19 / C-360-87) ───────────────────────────────────────
 * DS-9's wording is Slava's (OQ-360-10). This file emits key NAMES with `wording: null`; the test
 * asserts no sentence and no Hebrew letter ever appears in the disclosure block.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const TOOL = "pipeline/assemble_tour.mjs";
export const TOOL_VERSION = "0.1.0";
export const TOUR_SCHEMA = "tour/0.1.0";

/** C-360-82/83 — the ONE depth format, and ⛔ no fallback when a file declares another. */
export const KNOWN_DEPTH = Object.freeze({ encoding: "rgb24-be", scale: 100, invalid_value: 0 });

export class AssemblyError extends Error {
  constructor(message) {
    super(message);
    this.name = "AssemblyError";
  }
}
const fail = (msg) => {
  throw new AssemblyError(msg);
};

// ── small numeric helpers ───────────────────────────────────────────────────────────────────────
const nz = (v) => (Object.is(v, -0) ? 0 : v);
const r = (v, n) => nz(Number(v.toFixed(n)));
const r3 = (v) => r(v, 3); // cm  (1e-3 cm = 10 µm — far below anything measurable here)
const r4 = (v) => r(v, 4); // deg
const r6 = (v) => r(v, 6); // uv  (1e-6 of 1018 px = 1e-3 px)
const wrap360 = (d) => ((d % 360) + 360) % 360;
const wrap180 = (d) => {
  const w = wrap360(d);
  return w > 180 ? w - 360 : w;
};
const wrap01 = (u) => ((u % 1) + 1) % 1;
const DEG = 180 / Math.PI;

/** plan bearing of a plan-frame delta: 0 = −y (up on the drawing), 90 = +x, clockwise (SCHEMA §1) */
export const bearingDeg = (dx, dy) => wrap360(Math.atan2(dx, -dy) * DEG);

/**
 * A plan-frame offset seen from a camera at plan yaw `yawDeg`, in the RENDER's own conventions.
 * @returns {{bearing_deg:number, az_from_forward_deg:number, elev_deg:number, texture_uv:[number,number]}}
 */
export function look(dx, dy, dz, yawDeg) {
  const bearing = bearingDeg(dx, dy);
  const az = wrap180(bearing - yawDeg);
  const elev = Math.atan2(dz, Math.hypot(dx, dy)) * DEG;
  return {
    bearing_deg: r4(bearing),
    az_from_forward_deg: r4(az),
    elev_deg: r4(elev),
    texture_uv: [r6(wrap01(0.5 + az / 360)), r6(0.5 - elev / 180)],
  };
}

/** even-odd point-in-polygon over a `[[x,y],…]` ring (rings here are rectilinear and simple). */
export function pointInPolygon(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ── sightline: does a real wall stand between two points, and does an aperture let it through? ──
/**
 * @param {{x:number,y:number,z:number}} p0 camera
 * @param {{x:number,y:number,z:number}} p1 aim point
 * @param {object} wall a plan.json wall
 * @param {object[]} openingsOfWall the openings that pierce it
 * @returns {null | {wall_id:string, through:string|null, margin_cm:number|null}}
 *   null = the segment never enters this wall's footprint (or passes over it).
 *   `through` = the opening id whose 3-D aperture contains BOTH crossing points; null ⇒ blocked.
 */
export function wallCrossing(p0, p1, wall, openingsOfWall) {
  if (wall.kind === "virtual") return null; // ⛔ no geometry at all (SCHEMA §5)
  const [wx0, wy0, wx1, wy1] = wall.rect_cm;
  let t0 = 0;
  let t1 = 1;
  for (const [s, e, lo, hi] of [
    [p0.x, p1.x, wx0, wx1],
    [p0.y, p1.y, wy0, wy1],
  ]) {
    const d = e - s;
    if (Math.abs(d) < 1e-9) {
      if (s < lo || s > hi) return null;
      continue;
    }
    let ta = (lo - s) / d;
    let tb = (hi - s) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 >= t1) return null;
  }
  const at = (t) => ({ x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t, z: p0.z + (p1.z - p0.z) * t });
  const a = at(t0);
  const b = at(t1);
  // a parapet the sightline passes clean over is not a blocker
  if (a.z > wall.height_cm && b.z > wall.height_cm) return null;
  for (const o of openingsOfWall) {
    const ca = o.axis === "x" ? a.x : a.y;
    const cb = o.axis === "x" ? b.x : b.y;
    const inSpan = ca >= o.start_cm && ca <= o.end_cm && cb >= o.start_cm && cb <= o.end_cm;
    const inHeight = a.z >= o.sill_cm && a.z <= o.head_cm && b.z >= o.sill_cm && b.z <= o.head_cm;
    if (inSpan && inHeight) {
      const margin = Math.min(ca - o.start_cm, o.end_cm - ca, cb - o.start_cm, o.end_cm - cb);
      return { wall_id: wall.id, through: o.id, margin_cm: r3(margin) };
    }
  }
  return { wall_id: wall.id, through: null, margin_cm: null };
}

/** the whole-segment verdict: `{direct, blocked_by[], through[], min_margin_cm}` */
export function sightline(p0, p1, walls, openingsByWall) {
  const blocked = [];
  const through = [];
  let minMargin = null;
  for (const w of walls) {
    const c = wallCrossing(p0, p1, w, openingsByWall.get(w.id) ?? []);
    if (!c) continue;
    if (c.through === null) blocked.push(c.wall_id);
    else {
      through.push(c.through);
      minMargin = minMargin === null ? c.margin_cm : Math.min(minMargin, c.margin_cm);
    }
  }
  const out = { direct: blocked.length === 0 };
  if (blocked.length) out.blocked_by = blocked.sort();
  if (through.length) out.through = through.sort();
  if (minMargin !== null) out.min_aperture_margin_cm = minMargin;
  return out;
}

// ── the room graph ──────────────────────────────────────────────────────────────────────────────
/**
 * SCHEMA §6's rule, and nothing else. Returns edges keyed `A|B` with A<B, in sorted order.
 * @returns {{key:string, rooms:[string,string], openings:string[]}[]}
 */
export function deriveEdges(plan) {
  const roomIds = new Set(plan.rooms.map((x) => x.id));
  const byKey = new Map();
  for (const o of plan.openings) {
    if (o.kind === "window") continue; // ⛔ never a tour edge, even between two rooms
    const [a, b] = o.rooms;
    if (a === "outside" || b === "outside") continue; // the front door is not an edge
    if (a === b) continue;
    if (!roomIds.has(a) || !roomIds.has(b)) fail(`opening '${o.id}' names a room that does not exist: ${o.rooms.join(", ")}`);
    const [lo, hi] = [a, b].sort();
    const key = `${lo}|${hi}`;
    if (!byKey.has(key)) byKey.set(key, { key, rooms: [lo, hi], openings: [] });
    byKey.get(key).openings.push(o.id);
  }
  for (const e of byKey.values()) e.openings.sort();
  return [...byKey.values()].sort((x, y) => (x.key < y.key ? -1 : x.key > y.key ? 1 : 0));
}

// ── io helpers ──────────────────────────────────────────────────────────────────────────────────
const readJson = (p) => {
  if (!existsSync(p)) fail(`required input is missing: ${p}`);
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    fail(`cannot parse ${p}: ${e.message}`);
  }
};
const sha256File = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

/** an asset reference validated three ways: the manifest row, the bytes on disk, the hash. */
function assetRef(tourDir, rowDir, out, what, where) {
  if (!out || typeof out.file !== "string") fail(`${where}: the manifest row has no '${what}' output — nothing to reference`);
  const rel = `${rowDir}/${out.file}`.replace(/\\/g, "/").replace(/^\.\//, "");
  const abs = join(tourDir, rel);
  if (!existsSync(abs)) fail(`${where}: the manifest names '${rel}' as its ${what}, and that file does not exist on disk`);
  const bytes = statSync(abs).size;
  if (typeof out.bytes === "number" && bytes !== out.bytes)
    fail(`${where}: ${rel} is ${bytes} bytes on disk, the manifest row records ${out.bytes} — the render and its checkpoint disagree`);
  const sha = sha256File(abs);
  if (typeof out.sha256 === "string" && sha !== out.sha256)
    fail(`${where}: ${rel} hashes ${sha.slice(0, 12)}…, the manifest row records ${out.sha256.slice(0, 12)}… — the file changed under its checkpoint`);
  return { path: rel, bytes, sha256: sha };
}

// ── the assembler ───────────────────────────────────────────────────────────────────────────────
/**
 * @param {string} tourDirIn a tour directory holding plan.json + manifest.json + renders/
 * @returns {{tour:object, report:object}}
 */
export function assembleTour(tourDirIn) {
  const tourDir = resolve(tourDirIn);
  const planPath = join(tourDir, "plan.json");
  const manifestPath = join(tourDir, "manifest.json");
  const plan = readJson(planPath);
  const manifest = readJson(manifestPath);
  const planSha = sha256File(planPath);
  const manifestSha = sha256File(manifestPath);
  const report = { tour_dir: tourDir, checks: [] };
  const ok = (name, detail) => report.checks.push({ name, pass: true, ...detail });

  if (plan.units !== "cm") fail(`plan.json declares units '${plan.units}' — this assembler only knows 'cm' (C-360-81: units are part of the shape)`);
  if (manifest.tour_id !== plan.apartment_id)
    fail(`manifest.tour_id '${manifest.tour_id}' ≠ plan.apartment_id '${plan.apartment_id}' — these are not the same tour`);

  const rooms = plan.rooms;
  const roomById = new Map(rooms.map((x) => [x.id, x]));
  const points = plan.camera_points;
  const pointById = new Map(points.map((p) => [p.id, p]));
  if (pointById.size !== points.length) fail("duplicate camera_point id in plan.json");
  const pointsByRoom = new Map(rooms.map((x) => [x.id, []]));
  for (const p of points) {
    if (!pointsByRoom.has(p.room_id)) fail(`camera point '${p.id}' names an unknown room '${p.room_id}'`);
    pointsByRoom.get(p.room_id).push(p.id);
  }
  for (const list of pointsByRoom.values()) list.sort();

  // ── renders: every point's row, sidecar and bytes ────────────────────────────────────────────
  const rowFor = (id, where) => {
    const row = manifest.points?.[id];
    if (!row) fail(`${where}: manifest.json has no render row for '${id}' — assemble refuses to emit a scene with no render`);
    return row;
  };
  let newestUtc = manifest.updated_utc ?? "";
  const projections = new Set();
  const sceneAssets = new Map();
  for (const p of points) {
    const where = `scene '${p.id}'`;
    const row = rowFor(p.id, where);
    if (row.point_id && row.point_id !== p.id) fail(`${where}: the manifest row's point_id is '${row.point_id}'`);
    if (row.room_id && row.room_id !== p.room_id)
      fail(`${where}: the render says room '${row.room_id}', plan.json says '${p.room_id}' — a stale render`);
    // C-360-83: an unknown encoding/scale REFUSES. ⛔ no fallback to the format we happen to know.
    const enc = row.depth_encoding;
    const scale = row.depth_scale;
    const invalid = row.depth_invalid_value;
    if (enc !== KNOWN_DEPTH.encoding) fail(`${where}: unknown depth_encoding '${enc}' — refusing (C-360-83; this assembler knows only '${KNOWN_DEPTH.encoding}')`);
    if (scale !== KNOWN_DEPTH.scale) fail(`${where}: unknown depth_scale '${scale}' — refusing (C-360-83)`);
    if (invalid !== KNOWN_DEPTH.invalid_value) fail(`${where}: unknown depth_invalid_value '${invalid}' — refusing (C-360-83)`);
    const pano = assetRef(tourDir, row.dir, row.outputs?.pano, "pano", where);
    const depth = assetRef(tourDir, row.dir, row.outputs?.depth, "depth", where);
    // the sidecar is the render's own account of the pose it used — the stale-render detector
    let sidecar = null;
    if (row.sidecar) {
      const sp = join(tourDir, row.dir, row.sidecar);
      if (!existsSync(sp)) fail(`${where}: the manifest names sidecar '${row.dir}/${row.sidecar}', which does not exist`);
      sidecar = readJson(sp);
      const pc = sidecar.point?.plan_cm ?? [];
      if (pc[0] !== p.x || pc[1] !== p.y || pc[2] !== p.z)
        fail(`${where}: the render was made at plan_cm [${pc}], plan.json now says [${p.x}, ${p.y}, ${p.z}] — a STALE render`);
      if (sidecar.point?.yaw_deg !== p.yaw_deg)
        fail(`${where}: the render was made at yaw ${sidecar.point?.yaw_deg}°, plan.json now says ${p.yaw_deg}° — a STALE render`);
      projections.add(JSON.stringify(sidecar.projection ?? null));
    }
    const rowPlanSha = row.inputs?.scene?.inputs?.plan_sha256;
    if (rowPlanSha && rowPlanSha !== planSha)
      fail(`${where}: rendered from plan sha ${rowPlanSha.slice(0, 12)}…, plan.json on disk is ${planSha.slice(0, 12)}… — a STALE render`);
    if (typeof row.rendered_utc === "string" && row.rendered_utc > newestUtc) newestUtc = row.rendered_utc;
    sceneAssets.set(p.id, { row, pano, depth, sidecar });
  }
  if (projections.size > 1)
    fail(`the ${points.length} renders do not share one projection convention (${projections.size} distinct) — a link angle would mean different things in different scenes`);
  ok("renders", { points: points.length, panos: points.length, depths: points.length, hashed: points.length * 2 });

  // ── the top view + its registration ──────────────────────────────────────────────────────────
  const tvRow = rowFor("topview", "minimap");
  const tv = {
    image: assetRef(tourDir, tvRow.dir, tvRow.outputs?.topview, "topview", "minimap"),
    room_mask: assetRef(tourDir, tvRow.dir, tvRow.outputs?.roomids, "roomids", "minimap"),
    depth: tvRow.outputs?.topview_depth ? assetRef(tourDir, tvRow.dir, tvRow.outputs.topview_depth, "topview_depth", "minimap") : null,
  };
  if (typeof tvRow.rendered_utc === "string" && tvRow.rendered_utc > newestUtc) newestUtc = tvRow.rendered_utc;
  const regRel = `${tvRow.dir}/${tvRow.registration?.file ?? "topview.registration.json"}`.replace(/^\.\//, "");
  const regPath = join(tourDir, regRel);
  if (!existsSync(regPath)) fail(`minimap: the registration sidecar '${regRel}' does not exist`);
  const reg = readJson(regPath);

  // VALIDATE the affine — ⛔ never recompute it (T07 owns it; T08 proves it still holds)
  const W = reg.image?.width;
  const H = reg.image?.height;
  if (!W || !H) fail("registration: image width/height missing");
  const originCm = [reg.plan_cm.x0, reg.plan_cm.y0];
  const spanCm = [reg.plan_cm.x1 - reg.plan_cm.x0, reg.plan_cm.y1 - reg.plan_cm.y0];
  const cmPerPx = [reg.cm_per_px.x, reg.cm_per_px.y];
  const extentErr = [Math.abs(spanCm[0] / W - cmPerPx[0]), Math.abs(spanCm[1] / H - cmPerPx[1])];
  if (extentErr[0] > 1e-6 || extentErr[1] > 1e-6)
    fail(`registration: (extent / image size) disagrees with cm_per_px by [${extentErr}] — the affine is internally inconsistent`);
  const toUv = (x, y) => [(x - originCm[0]) / spanCm[0], (y - originCm[1]) / spanCm[1]];
  const toPlan = (u, v) => [originCm[0] + u * spanCm[0], originCm[1] + v * spanCm[1]];

  let worstRoundTripCm = 0;
  const roundTrip = [];
  for (const p of points) {
    const [u, v] = toUv(p.x, p.y);
    const [x2, y2] = toPlan(u, v);
    const d = Math.max(Math.abs(x2 - p.x), Math.abs(y2 - p.y));
    worstRoundTripCm = Math.max(worstRoundTripCm, d);
    roundTrip.push({ point: p.id, u, v, err_cm: d });
    if (u < 0 || u > 1 || v < 0 || v > 1) fail(`registration: camera point '${p.id}' falls outside the top view (u=${u}, v=${v})`);
  }
  if (worstRoundTripCm > 1) fail(`registration: world→uv→world is off by ${worstRoundTripCm} cm (bar: 1 cm)`);
  ok("registration_round_trip", { points: points.length, worst_cm: worstRoundTripCm, bar_cm: 1 });

  // the legend's polygons must be the plan's own loops through that same affine
  const legendByRoom = new Map((reg.rooms ?? []).map((x) => [x.room_id, x]));
  let worstPolyPx = 0;
  for (const room of rooms) {
    const leg = legendByRoom.get(room.id);
    if (!leg) fail(`registration: no legend entry for room '${room.id}' — the minimap could not colour it`);
    if (!Array.isArray(leg.polygon_px) || leg.polygon_px.length !== room.loop.length)
      fail(`registration: room '${room.id}' has ${leg.polygon_px?.length} legend vertices, plan.json has ${room.loop.length}`);
    for (let i = 0; i < room.loop.length; i++) {
      const [x, y] = room.loop[i];
      const col = (x - originCm[0]) / cmPerPx[0] - 0.5;
      const row = (y - originCm[1]) / cmPerPx[1] - 0.5;
      worstPolyPx = Math.max(worstPolyPx, Math.abs(col - leg.polygon_px[i][0]), Math.abs(row - leg.polygon_px[i][1]));
    }
  }
  if (worstPolyPx > 0.01)
    fail(`registration: the legend's room polygons differ from plan.json's loops by up to ${worstPolyPx} px — the mask and the plan are not the same rooms`);
  ok("registration_legend", { rooms: rooms.length, worst_px: worstPolyPx, bar_px: 0.01 });

  // and every camera dot must land inside its own room on the minimap
  for (const p of points) {
    const leg = legendByRoom.get(p.room_id);
    const [u, v] = toUv(p.x, p.y);
    const ring = leg.polygon_px.map(([c, rw]) => [(c + 0.5) / W, (rw + 0.5) / H]);
    if (!pointInPolygon(u, v, ring)) fail(`registration: camera '${p.id}' does not fall inside room '${p.room_id}' on the minimap`);
  }
  ok("minimap_dots_in_room", { points: points.length });

  // ── the graph + the links ────────────────────────────────────────────────────────────────────
  const edges = deriveEdges(plan);
  const openingById = new Map(plan.openings.map((o) => [o.id, o]));
  const openingsByWall = new Map();
  for (const o of plan.openings) {
    if (!openingsByWall.has(o.wall_id)) openingsByWall.set(o.wall_id, []);
    openingsByWall.get(o.wall_id).push(o);
  }
  const walls = plan.walls;
  const edgesOfRoom = new Map(rooms.map((x) => [x.id, []]));
  for (const e of edges) for (const rid of e.rooms) edgesOfRoom.get(rid).push(e);

  const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const nearest = (from, ids) =>
    ids
      .map((id) => pointById.get(id))
      .sort((a, b) => d2(from, a) - d2(from, b) || (a.id < b.id ? -1 : 1))[0];

  const linksByPoint = new Map(points.map((p) => [p.id, []]));
  const mkLink = (src, kind, target, aimZ, extra) => {
    const dx = target.x - src.x;
    const dy = target.y - src.y;
    const dz = aimZ - src.z;
    const aim = { x: target.x, y: target.y, z: aimZ };
    return {
      kind,
      target: target.id,
      target_room: target.room_id,
      offset_cm: [r3(dx), r3(dy), r3(dz)],
      distance_cm: r3(Math.hypot(dx, dy, dz)),
      distance_xy_cm: r3(Math.hypot(dx, dy)),
      ...look(dx, dy, dz, src.yaw_deg),
      sightline: sightline({ x: src.x, y: src.y, z: src.z }, aim, walls, openingsByWall),
      ...extra,
    };
  };

  // (a) spot links — every other point in the same room, at floor level
  let spotCount = 0;
  for (const p of points) {
    for (const otherId of pointsByRoom.get(p.room_id)) {
      if (otherId === p.id) continue;
      const t = pointById.get(otherId);
      const link = mkLink(p, "spot", t, 0, { aim_height_cm: 0, aim_height_rule: "floor level (z=0)" });
      link.best_aim = link.sightline.direct ? "target" : "none";
      linksByPoint.get(p.id).push(link);
      spotCount++;
    }
  }

  // (b) door links — one per incident edge whose far room has a point
  let doorCount = 0;
  const edgeOut = [];
  for (const e of edges) {
    const [a, b] = e.rooms;
    const pa = pointsByRoom.get(a);
    const pb = pointsByRoom.get(b);
    const walkable = pa.length > 0 && pb.length > 0;
    let made = 0;
    if (walkable) {
      for (const [here, there] of [
        [a, b],
        [b, a],
      ]) {
        for (const srcId of pointsByRoom.get(here)) {
          const src = pointById.get(srcId);
          const target = nearest(src, pointsByRoom.get(there));
          // Which of this edge's openings do we walk through? ⭐ VISIBLE first, then nearest, then
          // id — measured on this pilot: the plain "nearest" rule sent cp-dining's corridor marker
          // over the toilet's roof and grazed the WC door jamb by 0.7 cm (F-360-124). Distance alone
          // is not a route.
          const candidates = e.openings
            .map((id) => openingById.get(id))
            .map((o) => {
              const c = openingCentre(o, walls);
              const midH = (o.sill_cm + o.head_cm) / 2;
              const sl = sightline({ x: src.x, y: src.y, z: src.z }, { x: c[0], y: c[1], z: midH }, walls, openingsByWall);
              return { o, c, midH, sl, d: (c[0] - src.x) ** 2 + (c[1] - src.y) ** 2 };
            })
            .sort((x, y) => Number(y.sl.direct) - Number(x.sl.direct) || x.d - y.d || (x.o.id < y.o.id ? -1 : 1));
          const chosen = candidates[0];
          const midH = chosen.midH;
          const via = viaOpening(src, chosen.o, chosen.c, midH, walls, openingsByWall);
          const link = mkLink(src, "door", target, midH, {
            aim_height_cm: r3(midH),
            aim_height_rule: "door mid-height ((sill+head)/2 of via_opening)",
            edge: e.key,
            via_opening: via,
            ...(candidates.length > 1
              ? {
                  via_opening_choice: {
                    rule: "a clear sightline from this camera first, then the nearest centre (squared XY), then the id",
                    considered: candidates.map((c) => ({ id: c.o.id, distance_xy_cm: r3(Math.sqrt(c.d)), direct: c.sl.direct })),
                  },
                }
              : {}),
          });
          link.best_aim = link.sightline.direct ? "target" : via.sightline.direct ? "opening" : "none";
          linksByPoint.get(srcId).push(link);
          made++;
          doorCount++;
        }
      }
    }
    edgeOut.push({
      rooms: e.rooms,
      openings: e.openings,
      kinds: e.openings.map((id) => openingById.get(id).kind),
      walkable,
      links: made,
      ...(walkable ? {} : { not_walkable_because: `${[a, b].filter((rid) => pointsByRoom.get(rid).length === 0).join(", ")} has no camera point (SCHEMA §7: an outdoor room carries none)` }),
    });
  }

  for (const [id, list] of linksByPoint) {
    list.sort((x, y) => (x.kind < y.kind ? -1 : x.kind > y.kind ? 1 : x.target < y.target ? -1 : 1));
    if (list.length === 0) fail(`orphan camera point '${id}': no spot link and no door link — it cannot be reached and cannot be left`);
  }

  // how many markers can actually be painted where they aim (the T09-facing number)
  const allLinks = [...linksByPoint.values()].flat();
  const aim = {
    target: allLinks.filter((l) => l.best_aim === "target").length,
    opening: allLinks.filter((l) => l.best_aim === "opening").length,
    none: allLinks.filter((l) => l.best_aim === "none").length,
  };

  // connectivity over the points that exist (a component count of 1 is the claim the viewer relies on)
  const comp = components(points, linksByPoint);
  ok("graph", {
    edges: edges.length,
    walkable_edges: edgeOut.filter((e) => e.walkable).length,
    door_links: doorCount,
    spot_links: spotCount,
    orphan_points: 0,
    components: comp.length,
    aim,
  });
  if (comp.length !== 1)
    fail(`the walk graph has ${comp.length} disconnected components (${comp.map((c) => c.join("+")).join(" | ")}) — some scenes cannot be reached on foot`);

  // ── emit ─────────────────────────────────────────────────────────────────────────────────────
  const selfPath = fileURLToPath(import.meta.url);
  const proj = sceneAssets.get(points[0].id)?.sidecar?.projection ?? null;
  const latestBatch = Array.isArray(manifest.batches) && manifest.batches.length ? manifest.batches[manifest.batches.length - 1] : null;

  const tour = {
    schema: TOUR_SCHEMA,
    tour_id: plan.apartment_id,
    _doc: {
      contract: "one of the four shared file contracts (CONTRACT §16.4 A8-8 / C-360-81): EXTEND freely, ⛔ RESHAPE only on-board. Producer: pipeline/assemble_tour.mjs (walkthrough-engineer). Consumers: T09 viewer/minimap, T10 ruler/dimensions.",
      units: "positions and offsets in CENTIMETRES, angles in DEGREES, areas in m², decoded depth in METRES. ⛔ A unit change is a reshape, not an extension.",
      frame: plan.axes,
      scenes: "one per plan.json camera_point, in the plan's own order. `pano`/`depth` paths are relative to the tour directory and were validated against manifest.json AND the bytes on disk.",
      links: "scenes[].links[] — `kind` spot|door, `target` a scene id, `offset_cm` the plan-frame offset from THIS camera to the aim point. Derived angles are in the RENDER's convention (see meta.projection), ⛔ not PSV's.",
      minimap: "the top view + the world↔uv affine (READ from renders/topview.registration.json, validated here, never recomputed) + room polygons in normalised image coords (u,v ∈ [0,1], v=0 at the image TOP) + room→points.",
      rooms: "plan.json's own numbers, exact: printed_dims_cm is what the drawing prints, clear_dims_cm is what the trace measures. ⛔ Neither is a measurement of a built unit.",
      meta: "provenance: the plan + manifest hashes, the pinned date, the depth contract, ceiling-height provenance, and the disclosure KEYS (⛔ never wording).",
    },
    meta: {
      assembled: {
        tool: TOOL,
        tool_version: TOOL_VERSION,
        tool_sha256: sha256File(selfPath),
        date_utc: newestUtc,
        date: newestUtc.slice(0, 10),
        date_note: "⛔ NOT a wall clock. Pinned to the newest INPUT timestamp (max of the referenced rows' rendered_utc and manifest.updated_utc) so that a rerun over unchanged inputs is byte-identical.",
      },
      plan: {
        file: "plan.json",
        sha256: planSha,
        schema_version: plan.schema_version,
        apartment_id: plan.apartment_id,
        source_file: plan.plan_meta.source_file,
        source_sha256: plan.plan_meta.source_sha256,
        tracer: plan.plan_meta.tracer,
        trace_date: plan.plan_meta.trace_date,
        scale_basis: plan.plan_meta.scale_basis,
        rights_state: plan.plan_meta.rights_state,
        rights_note: plan.plan_meta.rights_note,
        assumptions: plan.plan_meta.assumptions,
        disagreements: plan.plan_meta.disagreements,
        virtual_boundaries: plan.plan_meta.virtual_boundaries ?? [],
      },
      manifest: {
        file: "manifest.json",
        sha256: manifestSha,
        schema: manifest.schema,
        updated_utc: manifest.updated_utc ?? null,
        newest_batch: latestBatch
          ? { tool: latestBatch.tool, version: latestBatch.version, mode: latestBatch.mode, resolution: latestBatch.resolution, samples: latestBatch.samples, finished_utc: latestBatch.finished_utc, cost_usd: latestBatch.cost_usd }
          : null,
        render_quality_note: "⚠ the newest batch's `mode` describes what these panos ARE today. T13 re-renders the pilot; nothing here claims final quality.",
      },
      ceiling: {
        height_cm: plan.plan_meta.ceiling_height_cm,
        provenance: "ASSUMED",
        why: plan.plan_meta.assumptions.find((a) => a.toLowerCase().includes("ceiling")) ?? "see plan_meta.assumptions",
      },
      depth: {
        encoding: KNOWN_DEPTH.encoding,
        scale: KNOWN_DEPTH.scale,
        invalid_value: KNOWN_DEPTH.invalid_value,
        units: "m",
        decode: "(R<<16 | G<<8 | B) / scale ⇒ metres (radial distance from the camera origin, NOT planar depth)",
        refusal: "⛔ C-360-83: a decoder meeting an encoding/scale it does not know THROWS. It never falls back. This assembler refuses to emit a scene whose row declares anything else.",
        recorded_per_scene: true,
      },
      projection: proj,
      angles: {
        bearing_deg: "plan bearing of the offset: 0 = −y (up on the drawing), 90 = +x, clockwise, [0,360) — SCHEMA §1",
        az_from_forward_deg: "azimuth measured FROM this scene's camera forward (its yaw_deg), positive toward the viewer's RIGHT — the sidecar's own 'u=0.5 = forward, u increases to the right'",
        elev_deg: "positive up",
        texture_uv: "the equirect texture coordinate of the aim direction: u = wrap01(0.5 + az/360), v = 0.5 − elev/180, v=0 at the image TOP",
        psv: "⛔ NOT PhotoSphereViewer coordinates. T09 maps these to PSV and measures the mapping.",
      },
      disclosure: {
        note: "⛔ KEYS ONLY — no wording is authored in this file. DS-9's words are Slava's (OQ-360-10, A8-19/C-360-87); the viewer resolves each key per language through app/src/ui/copy.ts.",
        keys: [
          { key: "ds1.badge", surface: "DS-1", binds: "every viewer state — permanent, non-dismissible", wording: null, wording_owner: "shipped in V1 (app/src/ui/badge.ts)" },
          { key: "ds5.nadir", surface: "DS-5", binds: "the nadir disk", wording: null, wording_owner: "shipped in V1" },
          { key: "ds8.scope_notice", surface: "DS-8", binds: "leaving a scene an edit belongs to", wording: null, wording_owner: "shipped in V1 (edit lane; V2 has no edit lane yet)" },
          { key: "ds9.measurement_provenance", surface: "DS-9", binds: "any distance, area or room dimension rendered to a human; ⛔ the ruler renders no number while this surface is absent", wording: null, wording_owner: "Slava — OQ-360-10 (PROPOSED wording ships as PROPOSED)" },
          { key: "ds9.cg_render_caption", surface: "DS-9", binds: "the scene itself: a CG render built from the project's floor plan, furniture illustrative", wording: null, wording_owner: "Slava — OQ-360-10 / copy pack" },
        ],
        exposure: "⛔ INTERNAL ONLY — OWED-022 binds V2 identically (C-360-86), and the drawing's own rights are OQ-360-11. Nothing assembled here is shown to a third party.",
      },
      paths: {
        tour_dir_track_rel: `tours/${plan.apartment_id}`,
        asset_refs: "every `path` in this file is relative to the tour directory",
      },
    },
    scenes: points.map((p) => {
      const a = sceneAssets.get(p.id);
      const room = roomById.get(p.room_id);
      return {
        id: p.id,
        room_id: p.room_id,
        room_name_he: room.name_he,
        room_name_en: room.name_en,
        position_cm: [p.x, p.y, p.z],
        eye_height_cm: p.z,
        yaw_deg: p.yaw_deg,
        yaw_note: "the SEED yaw the pano was rendered facing; the viewer preserves the user's own pose across a swap (M-360-5)",
        note: p.note ?? null,
        pano: { ...a.pano, resolution: a.row.resolution ?? null, format: a.pano.path.endsWith(".webp") ? "webp" : "png" },
        depth: {
          ...a.depth,
          resolution: a.row.resolution ?? null,
          encoding: a.row.depth_encoding,
          scale: a.row.depth_scale,
          invalid_value: a.row.depth_invalid_value,
          units: "m",
        },
        render: a.row.render ? { backend: a.row.render.backend, samples: a.row.render.samples, denoise: a.row.render.denoise, seed: a.row.render.seed } : null,
        rendered_utc: a.row.rendered_utc ?? null,
        minimap_uv: toUv(p.x, p.y).map(r6),
        links: linksByPoint.get(p.id),
      };
    }),
    graph: {
      rule: "SCHEMA §6 / F-360-116 — an edge is an OPENING's own `rooms` pair. ⛔ Never reverse-indexed from walls: a footprint wall here bounds up to five rooms.",
      aim_rule: "`best_aim` per link: 'target' = the prescribed aim (the far room's nearest point at door mid-height) has a clear line from this camera; 'opening' = it does not, but the doorway does — render the marker at `via_opening.offset_cm`; 'none' = neither is visible from here (the route turns a corner), so a marker painted in either direction lands on a wall. Pure plan geometry (segment vs wall footprint, the opening's own 3-D aperture as the hole) — ⛔ no depth is read.",
      edges: edgeOut,
      counts: {
        rooms: rooms.length,
        rooms_with_points: [...pointsByRoom.values()].filter((l) => l.length).length,
        points: points.length,
        edges: edgeOut.length,
        walkable_edges: edgeOut.filter((e) => e.walkable).length,
        door_links: doorCount,
        spot_links: spotCount,
        links: doorCount + spotCount,
        orphan_points: 0,
        components: comp.length,
        aim,
      },
    },
    minimap: {
      image: tv.image,
      room_mask: {
        ...tv.room_mask,
        decode: reg.mask?.decode ?? "match the pixel's exact RGB triple against minimap.rooms[].rgb; (0,0,0) = no room",
        background_rgb: reg.mask?.background_rgb ?? [0, 0, 0],
        anti_aliasing: reg.mask?.anti_aliasing ?? null,
      },
      depth: tv.depth,
      size_px: [W, H],
      registration: {
        source: regRel,
        validated_here: {
          world_uv_world_worst_cm: Number(worstRoundTripCm.toExponential(3)),
          legend_vs_plan_worst_px: Number(worstPolyPx.toExponential(3)),
          bars: { round_trip_cm: 1, legend_px: 0.01 },
        },
        origin_cm: originCm,
        span_cm: [r6(spanCm[0]), r6(spanCm[1])],
        cm_per_px: cmPerPx,
        world_to_uv: "u = (x_cm − origin_cm[0]) / span_cm[0] ; v = (y_cm − origin_cm[1]) / span_cm[1]",
        uv_to_world: "x_cm = origin_cm[0] + u·span_cm[0] ; y_cm = origin_cm[1] + v·span_cm[1]",
        uv_note: "u,v are EDGE-based continuous image coordinates in [0,1] (0 = the left/top edge of the image). ⚠ The sidecar's polygon_px are pixel-CENTRE indices: u = (col_px + 0.5)/width, v = (row_px + 0.5)/height. Half a pixel is 0.62 cm here.",
        no_flip: "row 0 is the image's TOP scanline and the SMALLEST plan y — the affine flips neither axis (plan y grows downward, SCHEMA §1)",
      },
      rooms: rooms.map((room) => {
        const leg = legendByRoom.get(room.id);
        return {
          room_id: room.id,
          rgb: leg.rgb,
          hex: leg.hex,
          polygon_uv: room.loop.map(([x, y]) => toUv(x, y).map(r6)),
          centroid_uv: toUv((room.bbox_cm[0] + room.bbox_cm[2]) / 2, (room.bbox_cm[1] + room.bbox_cm[3]) / 2).map(r6),
        };
      }),
      room_points: Object.fromEntries(rooms.map((room) => [room.id, pointsByRoom.get(room.id)])),
      points_uv: Object.fromEntries(points.map((p) => [p.id, toUv(p.x, p.y).map(r6)])),
    },
    rooms: rooms.map((room) => ({
      id: room.id,
      name_he: room.name_he,
      name_en: room.name_en,
      type: room.type,
      is_outdoor: room.is_outdoor,
      printed_dims_cm: room.printed_dims_cm,
      clear_dims_cm: room.clear_dims_cm,
      area_m2: room.area_m2,
      bbox_cm: room.bbox_cm,
      dims_source: "plan.json, exact — `clear_dims_cm` is the traced interior-face bounding box, `printed_dims_cm` is what the drawing prints (null where it prints none)",
      has_virtual_boundary: walls.some((w) => w.kind === "virtual" && w.sides.includes(room.id)),
      disagreement: (plan.plan_meta.disagreements ?? []).find((d) => d.room === room.id) ?? null,
      camera_points: pointsByRoom.get(room.id),
    })),
  };

  report.counts = tour.graph.counts;
  report.registration = tour.minimap.registration.validated_here;
  report.newest_input_utc = newestUtc;
  return { tour, report };
}

/** the plan-frame centre of an opening: mid-span along its axis, mid-thickness across its wall */
function openingCentre(o, walls) {
  const w = walls.find((x) => x.id === o.wall_id);
  if (!w) fail(`opening '${o.id}' names a wall '${o.wall_id}' that does not exist`);
  const mid = (o.start_cm + o.end_cm) / 2;
  const [x0, y0, x1, y1] = w.rect_cm;
  return o.axis === "x" ? [mid, (y0 + y1) / 2] : [(x0 + x1) / 2, mid];
}

/** the doorway itself as a second, always-visible aim point for the same link */
function viaOpening(src, o, centre, midH, walls, openingsByWall) {
  const dx = centre[0] - src.x;
  const dy = centre[1] - src.y;
  const dz = midH - src.z;
  return {
    id: o.id,
    kind: o.kind,
    wall_id: o.wall_id,
    width_cm: o.width_cm,
    sill_cm: o.sill_cm,
    head_cm: o.head_cm,
    centre_cm: [r3(centre[0]), r3(centre[1]), r3(midH)],
    offset_cm: [r3(dx), r3(dy), r3(dz)],
    distance_cm: r3(Math.hypot(dx, dy, dz)),
    ...look(dx, dy, dz, src.yaw_deg),
    sightline: sightline({ x: src.x, y: src.y, z: src.z }, { x: centre[0], y: centre[1], z: midH }, walls, openingsByWall),
  };
}

/** connected components over the emitted links (undirected) */
function components(points, linksByPoint) {
  const adj = new Map(points.map((p) => [p.id, new Set()]));
  for (const [id, list] of linksByPoint)
    for (const l of list) {
      adj.get(id).add(l.target);
      adj.get(l.target)?.add(id);
    }
  const seen = new Set();
  const out = [];
  for (const p of points) {
    if (seen.has(p.id)) continue;
    const stack = [p.id];
    const comp = [];
    seen.add(p.id);
    while (stack.length) {
      const cur = stack.pop();
      comp.push(cur);
      for (const n of adj.get(cur)) if (!seen.has(n)) (seen.add(n), stack.push(n));
    }
    out.push(comp.sort());
  }
  return out;
}

/** the exact bytes written — one place, so the test can compare without re-serialising */
export function serialise(tour) {
  return `${JSON.stringify(tour, null, 2)}\n`;
}

// ── CLI ─────────────────────────────────────────────────────────────────────────────────────────
function main(argv) {
  const args = argv.slice(2);
  const flag = (n) => args.includes(`--${n}`);
  const val = (n, d) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 && args[i + 1] ? args[i + 1] : d;
  };
  const positional = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1] === "--out"));
  if (positional.length !== 1) {
    console.error("usage: node pipeline/assemble_tour.mjs <tour-dir> [--out <file>] [--json] [--quiet]");
    return 2;
  }
  const tourDir = resolve(positional[0]);
  const out = resolve(val("out", join(tourDir, "tour.json")));
  let result;
  try {
    result = assembleTour(tourDir);
  } catch (e) {
    if (e instanceof AssemblyError) {
      console.error(`\n⛔ ASSEMBLY FAILED — ${e.message}\n`);
      return 1;
    }
    throw e;
  }
  writeFileSync(out, serialise(result.tour));
  if (flag("json")) console.log(JSON.stringify({ out, ...result.report }, null, 2));
  else if (!flag("quiet")) {
    const c = result.report.counts;
    console.log(`tour.json ← ${result.tour.tour_id}`);
    console.log(`  scenes ${c.points} in ${c.rooms_with_points} of ${c.rooms} rooms (${c.rooms - c.rooms_with_points} outdoor, link-less by rule)`);
    console.log(`  edges  ${c.edges} (${c.walkable_edges} walkable) ⇒ links ${c.links} = ${c.door_links} door + ${c.spot_links} spot · orphans ${c.orphan_points} · components ${c.components}`);
    console.log(`  aim    ${c.aim.target} at the target · ${c.aim.opening} only via the doorway · ${c.aim.none} with no clear line either way`);
    console.log(`  registration world→uv→world worst ${result.report.registration.world_uv_world_worst_cm} cm (bar 1) · legend vs plan ${result.report.registration.legend_vs_plan_worst_px} px (bar 0.01)`);
    console.log(`  pinned date ${result.tour.meta.assembled.date_utc} (newest input, ⛔ not a wall clock)`);
    console.log(`  → ${out}`);
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exit(main(process.argv));
}
