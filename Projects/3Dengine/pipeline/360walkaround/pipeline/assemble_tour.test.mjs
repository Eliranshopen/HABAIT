#!/usr/bin/env node
/**
 * assemble_tour.test.mjs — the T08 assembler, falsified.   `node --test pipeline/assemble_tour.test.mjs`
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 * node:test only, ⛔ no dependencies (the board's house rule).
 *
 * Five groups, and each one is here because it can go RED for a real reason:
 *   A. the derived graph over the REAL pilot plan — stated counts, the window/outside exclusions
 *      falsified by construction (promote a window to an opening and the edge count MUST move),
 *      zero orphans, balconies link-less.
 *   B. the minimap registration — round trip, the legend against plan.json's own loops, and the
 *      ⚠ half-pixel relation between the sidecar's pixel-CENTRE polygons and this file's EDGE-based uv.
 *   C. schema completeness + determinism + ⛔ no disclosure STRING may ever appear.
 *   D. loud failure, on a hermetic synthetic tour: a missing row, a missing file, a byte-tampered
 *      file, a stale render and an unknown depth encoding each REFUSE (C-360-81 / C-360-83).
 *   E. ⭐ the angle convention measured against RENDERED PIXELS, not asserted: the link angles are
 *      re-projected into T07's own depth maps and compared with plan geometry, with a sign-flipped
 *      control that must read a different surface. This is the one assumption every link depends on.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { assembleTour, AssemblyError, bearingDeg, deriveEdges, look, pointInPolygon, serialise, sightline } from "./assemble_tour.mjs";
import { decodeDepth, readPng } from "./fixtures/check-depth-golden.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PILOT = join(HERE, "..", "tours", "pilot-karnei");
const plan = JSON.parse(readFileSync(join(PILOT, "plan.json"), "utf8"));
const { tour, report } = assembleTour(PILOT);
const linksOf = (id) => tour.scenes.find((s) => s.id === id).links;
const allLinks = tour.scenes.flatMap((s) => s.links.map((l) => ({ from: s.id, ...l })));

// ── A. the derived graph ────────────────────────────────────────────────────────────────────────
describe("A. the room graph is derived from openings[].rooms (SCHEMA §6 / F-360-116)", () => {
  it("13 edges, 10 of them walkable — the stated list, not just the count", () => {
    assert.equal(tour.graph.counts.edges, 13);
    assert.equal(tour.graph.counts.walkable_edges, 10);
    assert.deepEqual(
      tour.graph.edges.map((e) => e.rooms.join("|")),
      [
        "r-balcony-north|r-dining",
        "r-balcony-south|r-living",
        "r-bath-main|r-corridor",
        "r-bath-main|r-service-balcony",
        "r-bed-2|r-corridor",
        "r-corridor|r-dining",
        "r-corridor|r-master-lobby",
        "r-corridor|r-mamad",
        "r-dining|r-kitchen",
        "r-dining|r-living",
        "r-dining|r-wc",
        "r-ensuite|r-master",
        "r-master|r-master-lobby",
      ].sort(),
    );
  });

  it("two openings between the same pair collapse to ONE edge (corridor↔dining, kitchen↔dining)", () => {
    const byKey = new Map(tour.graph.edges.map((e) => [e.rooms.join("|"), e]));
    assert.deepEqual(byKey.get("r-corridor|r-dining").openings, ["o-corridor-north", "o-corridor-south"]);
    assert.deepEqual(byKey.get("r-dining|r-kitchen").openings, ["o-kitchen-east", "o-kitchen-north"]);
    // …and each still yields exactly one link per point on either side, never two
    assert.equal(byKey.get("r-corridor|r-dining").links, 3); // cp-corridor + cp-entry + cp-dining
    assert.equal(byKey.get("r-dining|r-kitchen").links, 3);
  });

  it("⛔ a window is never an edge — proved by an A/B, because this plan cannot prove it alone", () => {
    const windows = plan.openings.filter((o) => o.kind === "window");
    assert.equal(windows.length, 7);
    const openingIds = new Set(tour.graph.edges.flatMap((e) => e.openings));
    for (const w of windows) assert.ok(!openingIds.has(w.id), `${w.id} must not be an edge`);
    // ⚠ ALL SEVEN of this plan's windows open onto "outside", so they are already excluded by the
    //   outside rule — deleting the window rule changes nothing here, and a test that only counted
    //   edges on the real plan would be inert. So: the same fake interior window, twice.
    const interiorWindow = (kind) => {
      const m = structuredClone(plan);
      const o = m.openings.find((x) => x.id === "win-bath-main");
      o.kind = kind;
      o.rooms = ["r-bath-main", "r-wc"]; // an invented interior window between two real rooms
      return deriveEdges(m).length;
    };
    assert.equal(interiorWindow("window"), 13, "a window between two rooms must NOT create an edge");
    assert.equal(interiorWindow("opening"), 14, "…and the same aperture, not a window, MUST — otherwise the A/B proves nothing");
  });

  it("⛔ an opening onto 'outside' is never an edge (the front door, every window)", () => {
    const openingIds = new Set(tour.graph.edges.flatMap((e) => e.openings));
    assert.ok(!openingIds.has("d-entrance"));
    for (const e of tour.graph.edges) for (const r of e.rooms) assert.notEqual(r, "outside");
  });

  it("26 links = 24 door + 2 spot, and every point's own count is the stated one", () => {
    assert.deepEqual(
      { ...tour.graph.counts, aim: undefined },
      {
        rooms: 14,
        rooms_with_points: 11,
        points: 12,
        edges: 13,
        walkable_edges: 10,
        door_links: 24,
        spot_links: 2,
        links: 26,
        orphan_points: 0,
        components: 1,
        aim: undefined,
      },
    );
    const expected = {
      "cp-entry": 5,
      "cp-dining": 5,
      "cp-living": 1,
      "cp-kitchen": 1,
      "cp-corridor": 5,
      "cp-mamad": 1,
      "cp-bed-2": 1,
      "cp-master": 2,
      "cp-bath-main": 1,
      "cp-ensuite": 1,
      "cp-master-lobby": 2,
      "cp-wc": 1,
    };
    for (const [id, n] of Object.entries(expected)) assert.equal(linksOf(id).length, n, `${id} link count`);
    assert.equal(Object.values(expected).reduce((a, b) => a + b, 0), 26);
  });

  it("zero orphan points, one connected component", () => {
    assert.equal(tour.graph.counts.orphan_points, 0);
    assert.equal(tour.graph.counts.components, 1);
    for (const s of tour.scenes) assert.ok(s.links.length > 0, `${s.id} is an orphan`);
  });

  it("balconies are link-less by rule: no points, no links, and the edge says why", () => {
    const outdoor = tour.rooms.filter((r) => r.is_outdoor).map((r) => r.id);
    assert.deepEqual(outdoor.sort(), ["r-balcony-north", "r-balcony-south", "r-service-balcony"]);
    for (const id of outdoor) {
      assert.deepEqual(tour.minimap.room_points[id], [], `${id} must carry no camera point`);
      assert.ok(!allLinks.some((l) => l.target_room === id), `no link may target ${id}`);
    }
    const notWalkable = tour.graph.edges.filter((e) => !e.walkable);
    assert.equal(notWalkable.length, 3);
    for (const e of notWalkable) {
      assert.equal(e.links, 0);
      assert.match(e.not_walkable_because, /has no camera point/);
      assert.ok(e.rooms.some((r) => outdoor.includes(r)));
    }
  });

  it("a door link targets the far room's NEAREST point (squared-XY argmin) — on cases where 'nearest' and 'first' disagree", () => {
    const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
    const cp = (id) => plan.camera_points.find((p) => p.id === id);
    // r-dining holds two points, so every door link into it is an argmin. ⚠ Two of the three
    // sources must pick the one that is NOT first in either the plan's order or the alphabet,
    // otherwise "argmin" and "take the first" are the same function on this data.
    const l1 = linksOf("cp-corridor").find((x) => x.target_room === "r-dining");
    assert.equal(l1.target, "cp-dining");
    assert.equal(d2(cp("cp-corridor"), cp("cp-dining")), 70900);
    assert.equal(d2(cp("cp-corridor"), cp("cp-entry")), 144800);
    for (const [from, expected, near, far] of [
      ["cp-living", "cp-entry", 134100, 357800],
      ["cp-kitchen", "cp-entry", 142100, 270800],
    ]) {
      const l = linksOf(from).find((x) => x.target_room === "r-dining");
      assert.equal(l.target, expected, `${from} must reach the dining room at its nearest point`);
      assert.equal(d2(cp(from), cp("cp-entry")), near);
      assert.equal(d2(cp(from), cp("cp-dining")), far);
      // and "cp-dining" is what BOTH lazy rules would have picked: it is first alphabetically…
      assert.ok("cp-dining" < "cp-entry");
      // …and first in the room's own point list
      assert.deepEqual(tour.minimap.room_points["r-dining"], ["cp-dining", "cp-entry"]);
    }
  });

  it("spot links aim at FLOOR level, door links at DOOR MID-HEIGHT", () => {
    const spots = allLinks.filter((l) => l.kind === "spot");
    assert.equal(spots.length, 2);
    for (const l of spots) {
      assert.equal(l.aim_height_cm, 0);
      assert.equal(l.offset_cm[2], -140); // eye height 140 ⇒ the floor is 140 below
    }
    for (const l of allLinks.filter((x) => x.kind === "door")) {
      const o = plan.openings.find((x) => x.id === l.via_opening.id);
      const mid = (o.sill_cm + o.head_cm) / 2;
      assert.equal(l.aim_height_cm, mid);
      assert.equal(l.offset_cm[2], mid - 140);
      assert.ok(mid === 102.5 || mid === 112.5 || mid === 130, `unexpected door mid-height ${mid}`);
    }
  });

  it("every link's offset, bearing and texture_uv agree with each other and with the plan", () => {
    for (const l of allLinks) {
      const from = plan.camera_points.find((p) => p.id === l.from);
      const to = plan.camera_points.find((p) => p.id === l.target);
      assert.deepEqual(l.offset_cm, [to.x - from.x, to.y - from.y, l.aim_height_cm - from.z].map((v) => Number(v.toFixed(3))));
      const re = look(l.offset_cm[0], l.offset_cm[1], l.offset_cm[2], from.yaw_deg);
      assert.equal(re.bearing_deg, l.bearing_deg);
      assert.equal(re.az_from_forward_deg, l.az_from_forward_deg);
      assert.deepEqual(re.texture_uv, l.texture_uv);
      assert.ok(l.texture_uv[0] >= 0 && l.texture_uv[0] < 1);
      assert.ok(l.texture_uv[1] > 0 && l.texture_uv[1] < 1);
    }
    // the bearing convention itself: 0 = −y (up on the drawing), 90 = +x, clockwise
    assert.equal(bearingDeg(0, -10), 0);
    assert.equal(bearingDeg(10, 0), 90);
    assert.equal(bearingDeg(0, 10), 180);
    assert.equal(bearingDeg(-10, 0), 270);
  });

  it("⭐ the aim verdict is stated, and the two dead aims are named (F-360-124)", () => {
    assert.deepEqual(tour.graph.counts.aim, { target: 11, opening: 13, none: 2 });
    const none = allLinks.filter((l) => l.best_aim === "none").map((l) => `${l.from}->${l.target}`);
    assert.deepEqual(none.sort(), ["cp-dining->cp-wc", "cp-entry->cp-wc"]);
    // both are blocked by the SAME wall, in both aims — the toilet door faces away from the hall
    for (const l of allLinks.filter((x) => x.best_aim === "none")) {
      assert.deepEqual(l.sightline.blocked_by, ["w-wc-s"]);
      assert.deepEqual(l.via_opening.sightline.blocked_by, ["w-wc-s"]);
    }
    // and every "opening" verdict really does have a clear line through its own aperture
    for (const l of allLinks.filter((x) => x.best_aim === "opening")) {
      assert.equal(l.sightline.direct, false);
      assert.equal(l.via_opening.sightline.direct, true);
      // ⚠ an opening in a VIRTUAL wall has no geometry at all (SCHEMA §5), so the ray crosses
      //   nothing and `through` is absent — that is the open-plan case, not a missing check.
      const wall = plan.walls.find((w) => w.id === l.via_opening.wall_id);
      if (wall.kind === "virtual") assert.equal(l.via_opening.sightline.through, undefined, `${l.via_opening.id} pierces a virtual wall`);
      else assert.ok(l.via_opening.sightline.through.includes(l.via_opening.id));
    }
  });

  it("the sightline test is falsifiable: close the door and the line goes dark", () => {
    const src = { x: 400, y: 620, z: 140 }; // cp-corridor
    const aim = { x: 393.75, y: 217.55, z: 102.5 }; // the bathroom door's centre
    const walls = plan.walls;
    const byWall = new Map();
    for (const o of plan.openings) {
      if (!byWall.has(o.wall_id)) byWall.set(o.wall_id, []);
      byWall.get(o.wall_id).push(o);
    }
    assert.equal(sightline(src, aim, walls, byWall).direct, true);
    const bricked = new Map([...byWall].map(([k, v]) => [k, k === "w-bath-s" ? [] : v]));
    const blind = sightline(src, aim, walls, bricked);
    assert.equal(blind.direct, false);
    assert.deepEqual(blind.blocked_by, ["w-bath-s"]);
  });
});

// ── B. the minimap registration ─────────────────────────────────────────────────────────────────
describe("B. the registration is READ from T07's sidecar and validated, ⛔ never recomputed", () => {
  const reg = JSON.parse(readFileSync(join(PILOT, "renders", "topview.registration.json"), "utf8"));
  const R = tour.minimap.registration;

  it("world → uv → world is exact to far better than the 1 cm bar, on all 12 points", () => {
    let worst = 0;
    for (const p of plan.camera_points) {
      const [u, v] = tour.minimap.points_uv[p.id];
      // ⚠ the emitted uv is rounded for the file; re-derive from the transform for the round trip
      const uu = (p.x - R.origin_cm[0]) / R.span_cm[0];
      const vv = (p.y - R.origin_cm[1]) / R.span_cm[1];
      const x = R.origin_cm[0] + uu * R.span_cm[0];
      const y = R.origin_cm[1] + vv * R.span_cm[1];
      worst = Math.max(worst, Math.abs(x - p.x), Math.abs(y - p.y));
      assert.ok(Math.abs(u - uu) <= 5e-7 && Math.abs(v - vv) <= 5e-7, `${p.id} emitted uv is the transform's own, to the emitted precision`);
    }
    assert.ok(worst < 1e-6, `round trip worst ${worst} cm`);
    assert.ok(R.validated_here.world_uv_world_worst_cm < 1e-6);
    assert.equal(R.validated_here.bars.round_trip_cm, 1);
  });

  it("the sidecar's own legend polygons ARE plan.json's loops through that affine", () => {
    assert.ok(R.validated_here.legend_vs_plan_worst_px < 0.001, `worst ${R.validated_here.legend_vs_plan_worst_px} px`);
    assert.equal(reg.rooms.length, plan.rooms.length);
  });

  it("⚠ the half-pixel relation between pixel-CENTRE polygons and EDGE-based uv holds both ways", () => {
    const [W, H] = tour.minimap.size_px;
    assert.deepEqual([W, H], [reg.image.width, reg.image.height]);
    for (const room of tour.minimap.rooms) {
      const leg = reg.rooms.find((r) => r.room_id === room.room_id);
      for (let i = 0; i < room.polygon_uv.length; i++) {
        const [u, v] = room.polygon_uv[i];
        const [col, row] = leg.polygon_px[i];
        assert.ok(Math.abs(u - (col + 0.5) / W) < 1e-5, `${room.room_id} vertex ${i}: u vs (col+0.5)/W`);
        assert.ok(Math.abs(v - (row + 0.5) / H) < 1e-5, `${room.room_id} vertex ${i}: v vs (row+0.5)/H`);
      }
    }
  });

  it("every camera dot lands inside its OWN room polygon and no other", () => {
    for (const p of plan.camera_points) {
      const [u, v] = tour.minimap.points_uv[p.id];
      for (const room of tour.minimap.rooms) {
        const inside = pointInPolygon(u, v, room.polygon_uv);
        assert.equal(inside, room.room_id === p.room_id, `${p.id} in ${room.room_id}?`);
      }
    }
  });

  it("room → points covers every room, and the mask legend carries a colour per room", () => {
    assert.deepEqual(Object.keys(tour.minimap.room_points).sort(), plan.rooms.map((r) => r.id).sort());
    const colours = new Set();
    for (const room of tour.minimap.rooms) {
      assert.equal(room.rgb.length, 3);
      assert.match(room.hex, /^#[0-9A-Fa-f]{6}$/);
      colours.add(room.hex);
    }
    assert.equal(colours.size, plan.rooms.length, "two rooms sharing a mask colour would be one room to a click");
    assert.ok(!colours.has("#000000"), "black is the mask's 'no room' background");
  });
});

// ── C. schema completeness, determinism, disclosure ─────────────────────────────────────────────
describe("C. the tour.json contract (C-360-81: EXTEND freely, ⛔ never reshape)", () => {
  it("the top-level shape is the stated one", () => {
    assert.deepEqual(Object.keys(tour), ["schema", "tour_id", "_doc", "meta", "scenes", "graph", "minimap", "rooms"]);
    assert.equal(tour.schema, "tour/0.1.0");
    assert.equal(tour.tour_id, "pilot-karnei");
  });

  it("every scene carries id/room/position/pano/depth/links, and the refs are the manifest's", () => {
    const manifest = JSON.parse(readFileSync(join(PILOT, "manifest.json"), "utf8"));
    assert.equal(tour.scenes.length, plan.camera_points.length);
    for (const s of tour.scenes) {
      const p = plan.camera_points.find((x) => x.id === s.id);
      assert.ok(p, `${s.id} is a plan camera point`);
      assert.deepEqual(s.position_cm, [p.x, p.y, p.z]);
      assert.equal(s.yaw_deg, p.yaw_deg);
      assert.equal(s.room_id, p.room_id);
      const row = manifest.points[s.id];
      assert.equal(s.pano.path, `${row.dir}/${row.outputs.pano.file}`);
      assert.equal(s.pano.sha256, row.outputs.pano.sha256);
      assert.equal(s.depth.path, `${row.dir}/${row.outputs.depth.file}`);
      assert.equal(s.depth.sha256, row.outputs.depth.sha256);
      assert.equal(s.pano.bytes, statSync(join(PILOT, s.pano.path)).size);
      assert.equal(s.depth.bytes, statSync(join(PILOT, s.depth.path)).size);
      // C-360-83 — recorded per point, never implied
      assert.equal(s.depth.encoding, "rgb24-be");
      assert.equal(s.depth.scale, 100);
      assert.equal(s.depth.invalid_value, 0);
      assert.equal(s.depth.units, "m");
    }
  });

  it("rooms carry the plan's own numbers, exactly", () => {
    for (const room of tour.rooms) {
      const src = plan.rooms.find((r) => r.id === room.id);
      assert.equal(room.name_he, src.name_he);
      assert.equal(room.name_en, src.name_en);
      assert.deepEqual(room.printed_dims_cm, src.printed_dims_cm);
      assert.deepEqual(room.clear_dims_cm, src.clear_dims_cm);
      assert.equal(room.area_m2, src.area_m2);
      assert.deepEqual(room.bbox_cm, src.bbox_cm);
    }
    // the one drawing-internal conflict travels with the room it belongs to (D-01, F-360-112)
    const bath = tour.rooms.find((r) => r.id === "r-bath-main");
    assert.equal(bath.disagreement.id, "D-01");
    assert.equal(bath.disagreement.printed_cm, 185);
    assert.equal(tour.rooms.filter((r) => r.disagreement).length, 1);
    // rooms whose boundary is not a drawn line are flagged (the ruler's circular-ground-truth trap)
    assert.deepEqual(
      tour.rooms.filter((r) => r.has_virtual_boundary).map((r) => r.id).sort(),
      ["r-corridor", "r-dining", "r-kitchen", "r-living", "r-master", "r-master-lobby"],
    );
  });

  it("the meta block carries provenance, the depth contract and ASSUMED ceiling height", () => {
    assert.equal(tour.meta.plan.sha256, createHash("sha256").update(readFileSync(join(PILOT, "plan.json"))).digest("hex"));
    assert.equal(tour.meta.manifest.sha256, createHash("sha256").update(readFileSync(join(PILOT, "manifest.json"))).digest("hex"));
    assert.equal(tour.meta.plan.rights_state, "partner-supplied");
    assert.equal(tour.meta.ceiling.height_cm, 260);
    assert.equal(tour.meta.ceiling.provenance, "ASSUMED");
    assert.match(tour.meta.ceiling.why, /no section/i);
    assert.equal(tour.meta.depth.encoding, "rgb24-be");
    assert.equal(tour.meta.depth.scale, 100);
    assert.equal(tour.meta.depth.invalid_value, 0);
    assert.equal(tour.meta.depth.units, "m");
    assert.ok(tour.meta.projection.col_mapping.includes("u=0.5 = camera forward"));
  });

  it("⛔ the disclosure block is KEYS ONLY — not one string, in either language", () => {
    const d = tour.meta.disclosure;
    const keys = d.keys.map((k) => k.key);
    assert.ok(keys.includes("ds1.badge"));
    assert.ok(keys.includes("ds9.measurement_provenance"));
    for (const k of d.keys) {
      assert.equal(k.wording, null, `${k.key} must carry no wording — DS-9's words are Slava's (OQ-360-10)`);
      assert.match(k.key, /^ds\d\.[a-z_]+$/);
    }
    const blob = JSON.stringify(d);
    assert.ok(!/[֐-׿]/.test(blob), "no Hebrew letter may appear in tour.json's disclosure block");
    assert.match(d.exposure, /INTERNAL ONLY/);
  });

  it("determinism: assembling twice is byte-identical, and the date is pinned to an INPUT", () => {
    const again = assembleTour(PILOT);
    assert.equal(serialise(again.tour), serialise(tour));
    assert.ok(!/"assembled_at"|Date\(/.test(serialise(tour)));
    const manifest = JSON.parse(readFileSync(join(PILOT, "manifest.json"), "utf8"));
    const newest = [manifest.updated_utc, ...Object.values(manifest.points).map((p) => p.rendered_utc)]
      .filter(Boolean)
      .sort()
      .at(-1);
    // the pin is the newest timestamp among the rows this tour actually references
    const referenced = [manifest.updated_utc, ...plan.camera_points.map((p) => manifest.points[p.id].rendered_utc), manifest.points.topview.rendered_utc]
      .filter(Boolean)
      .sort()
      .at(-1);
    assert.equal(tour.meta.assembled.date_utc, referenced);
    assert.equal(tour.meta.assembled.date, referenced.slice(0, 10));
    assert.ok(referenced <= newest);
    assert.match(tour.meta.assembled.date_note, /NOT a wall clock/);
  });

  it("the file on disk is what the assembler produces (the CLI wrote this exact object)", () => {
    const onDisk = readFileSync(join(PILOT, "tour.json"), "utf8");
    assert.equal(onDisk, serialise(tour));
  });
});

// ── D. loud failure, on a hermetic synthetic tour ───────────────────────────────────────────────
const sha = (b) => createHash("sha256").update(b).digest("hex");

/** a two-room, two-point, one-door tour with real (tiny) files whose hashes match their rows */
function makeFixture(root) {
  const w = (p, buf) => {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), buf);
    return { file: p.split("/").pop(), bytes: buf.length, sha256: sha(buf) };
  };
  const fixPlan = {
    schema_version: "0.1.0",
    units: "cm",
    axes: "x right, y down",
    apartment_id: "fixture",
    plan_meta: {
      source_file: "none",
      source_sha256: "0".repeat(64),
      tracer: "assemble_tour.test.mjs",
      trace_date: "2026-09-01",
      trace_method: "hand-built fixture",
      scale_basis: "n/a",
      scale_px_per_cm: 1,
      raster_origin_px: [0, 0],
      rights_state: "own",
      ceiling_height_cm: 260,
      assumptions: ["ceiling_height_cm 260 is ASSUMED"],
      disagreements: [],
    },
    rooms: [
      { id: "r-a", name_he: "א", name_en: "A", type: "living", is_outdoor: false, loop: [[0, 0], [200, 0], [200, 200], [0, 200]], printed_dims_cm: null, clear_dims_cm: [200, 200], bbox_cm: [0, 0, 200, 200], area_m2: 4 },
      { id: "r-b", name_he: "ב", name_en: "B", type: "bedroom", is_outdoor: false, loop: [[220, 0], [400, 0], [400, 200], [220, 200]], printed_dims_cm: null, clear_dims_cm: [180, 200], bbox_cm: [220, 0, 400, 200], area_m2: 3.6 },
    ],
    walls: [{ id: "w-mid", rect_cm: [200, 0, 220, 200], kind: "interior", height_cm: 260, sides: ["r-a", "r-b"] }],
    openings: [{ id: "d-mid", kind: "door", wall_id: "w-mid", axis: "y", start_cm: 80, end_cm: 160, width_cm: 80, sill_cm: 0, head_cm: 200, rooms: ["r-a", "r-b"], note: null }],
    camera_points: [
      { id: "cp-a", room_id: "r-a", x: 100, y: 100, z: 140, yaw_deg: 90, note: null },
      { id: "cp-b", room_id: "r-b", x: 300, y: 100, z: 140, yaw_deg: 270, note: null },
    ],
  };
  writeFileSync(join(root, "plan.json"), `${JSON.stringify(fixPlan, null, 2)}\n`);

  const points = {};
  for (const p of fixPlan.camera_points) {
    const pano = w(`renders/${p.id}/pano.webp`, Buffer.from(`pano:${p.id}`));
    const depth = w(`renders/${p.id}/depth.png`, Buffer.from(`depth:${p.id}`));
    w(
      `renders/${p.id}/pano.render.json`,
      Buffer.from(
        `${JSON.stringify(
          {
            point: { id: p.id, room_id: p.room_id, plan_cm: [p.x, p.y, p.z], yaw_deg: p.yaw_deg },
            projection: { type: "equirectangular", col_mapping: "u=0.5 = camera forward" },
          },
          null,
          2,
        )}\n`,
      ),
    );
    points[p.id] = {
      point_id: p.id,
      room_id: p.room_id,
      dir: `renders/${p.id}`,
      outputs: { pano, depth },
      depth_encoding: "rgb24-be",
      depth_scale: 100,
      depth_invalid_value: 0,
      resolution: [64, 32],
      render: { backend: "OPTIX", samples: 8, denoise: true, seed: 0 },
      sidecar: "pano.render.json",
      rendered_utc: "2026-09-01T10:00:00+00:00",
      inputs: { scene: { inputs: { plan_sha256: sha(readFileSync(join(root, "plan.json"))) } } },
    };
  }
  const topview = w("renders/topview.png", Buffer.from("topview"));
  const roomids = w("renders/topview-roomids.png", Buffer.from("roomids"));
  const toPx = (x, y) => [x / 1 - 0.5, y / 1 - 0.5];
  const reg = {
    image: { file: "topview.png", mask_file: "topview-roomids.png", width: 400, height: 200 },
    plan_cm: { x0: 0, y0: 0, x1: 400, y1: 200 },
    cm_per_px: { x: 1, y: 1 },
    mask: { decode: "exact RGB", background_rgb: [0, 0, 0], anti_aliasing: "NONE" },
    rooms: fixPlan.rooms.map((r, i) => ({
      room_id: r.id,
      rgb: i === 0 ? [230, 25, 75] : [60, 180, 75],
      hex: i === 0 ? "#E6194B" : "#3CB44B",
      polygon_px: r.loop.map(([x, y]) => toPx(x, y)),
    })),
  };
  writeFileSync(join(root, "renders", "topview.registration.json"), `${JSON.stringify(reg, null, 2)}\n`);
  points.topview = {
    kind: "topview",
    dir: "renders",
    outputs: { topview, roomids },
    depth_encoding: "rgb24-be",
    depth_scale: 100,
    depth_invalid_value: 0,
    resolution: [400, 200],
    registration: { file: "topview.registration.json" },
    rendered_utc: "2026-09-01T10:05:00+00:00",
  };
  writeFileSync(
    join(root, "manifest.json"),
    `${JSON.stringify({ schema: "render-manifest/0.1.0", tour_id: "fixture", points, updated_utc: "2026-09-01T10:06:00+00:00", batches: [] }, null, 2)}\n`,
  );
  return root;
}

describe("D. ⛔ a missing, changed or stale render fails assembly LOUDLY (C-360-81)", () => {
  const base = mkdtempSync(join(tmpdir(), "t08-fixture-"));
  makeFixture(base);
  after(() => rmSync(base, { recursive: true, force: true }));
  const fresh = (name) => {
    const d = join(base, "..", `${name}-${Math.random().toString(36).slice(2, 8)}`);
    cpSync(base, d, { recursive: true });
    return d;
  };
  const throws = (dir, re) => assert.throws(() => assembleTour(dir), (e) => e instanceof AssemblyError && re.test(e.message), `expected ${re}`);
  /**
   * Edit the plan AND refresh every row's recorded `plan_sha256`. ⭐ Without this the plan-hash
   * guard fires first and every plan mutation "passes" for the wrong reason — the first version of
   * the orphan test was green against the STALE-RENDER message, not the orphan one.
   */
  const rewritePlan = (dir, mutate) => {
    const p = JSON.parse(readFileSync(join(dir, "plan.json"), "utf8"));
    mutate(p);
    writeFileSync(join(dir, "plan.json"), `${JSON.stringify(p, null, 2)}\n`);
    const hash = sha(readFileSync(join(dir, "plan.json")));
    const m = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
    for (const row of Object.values(m.points)) if (row.inputs?.scene?.inputs) row.inputs.scene.inputs.plan_sha256 = hash;
    writeFileSync(join(dir, "manifest.json"), JSON.stringify(m, null, 2));
  };

  it("the fixture itself assembles clean (1 edge, 2 door links, 0 orphans)", () => {
    const { tour: t } = assembleTour(base);
    assert.deepEqual(t.graph.counts, { rooms: 2, rooms_with_points: 2, points: 2, edges: 1, walkable_edges: 1, door_links: 2, spot_links: 0, links: 2, orphan_points: 0, components: 1, aim: { target: 2, opening: 0, none: 0 } });
    assert.equal(t.scenes[0].links[0].target, "cp-b");
  });

  it("a MISSING FILE fails (the AC's temporarily-renamed render, in a sandbox)", () => {
    const d = fresh("missing-file");
    renameSync(join(d, "renders/cp-b/pano.webp"), join(d, "renders/cp-b/pano.webp.bak"));
    throws(d, /does not exist on disk/);
    renameSync(join(d, "renders/cp-b/pano.webp.bak"), join(d, "renders/cp-b/pano.webp"));
    assert.ok(assembleTour(d).tour, "restoring the file restores assembly");
    rmSync(d, { recursive: true, force: true });
  });

  it("a MISSING MANIFEST ROW fails, naming the point", () => {
    const d = fresh("missing-row");
    const m = JSON.parse(readFileSync(join(d, "manifest.json"), "utf8"));
    delete m.points["cp-b"];
    writeFileSync(join(d, "manifest.json"), JSON.stringify(m, null, 2));
    throws(d, /no render row for 'cp-b'/);
    rmSync(d, { recursive: true, force: true });
  });

  it("a TAMPERED file fails on size and on hash", () => {
    const d = fresh("tampered");
    writeFileSync(join(d, "renders/cp-a/depth.png"), Buffer.from("depth:cp-a-LONGER"));
    throws(d, /bytes on disk, the manifest row records/);
    writeFileSync(join(d, "renders/cp-a/depth.png"), Buffer.from("depth:cp-b")); // same length, other bytes
    throws(d, /hashes .*, the manifest row records/);
    rmSync(d, { recursive: true, force: true });
  });

  it("a STALE render fails TWICE over: by the recorded plan hash, and by the pose itself", () => {
    // (i) the plan changed under the render — the hash guard
    const d = fresh("stale-hash");
    const p = JSON.parse(readFileSync(join(d, "plan.json"), "utf8"));
    p.camera_points[1].x = 305;
    writeFileSync(join(d, "plan.json"), JSON.stringify(p, null, 2));
    throws(d, /rendered from plan sha .* — a STALE render/);
    rmSync(d, { recursive: true, force: true });

    // (ii) the hash was refreshed but the camera really did move — the pose guard, on its own
    const d2 = fresh("stale-pose");
    rewritePlan(d2, (pl) => {
      pl.camera_points[1].x = 305;
    });
    throws(d2, /the render was made at plan_cm \[300,100,140\], plan.json now says \[305, 100, 140\] — a STALE render/);
    rmSync(d2, { recursive: true, force: true });

    // (iii) …and the yaw limb has its own probe, because one limb can hide the other
    const d3 = fresh("stale-yaw");
    rewritePlan(d3, (pl) => {
      pl.camera_points[0].yaw_deg = 91;
    });
    throws(d3, /the render was made at yaw 90°, plan.json now says 91° — a STALE render/);
    rmSync(d3, { recursive: true, force: true });
  });

  it("⛔ an unknown depth encoding or scale REFUSES — no fallback (C-360-83)", () => {
    for (const [field, value, re] of [
      ["depth_encoding", "rgb24-le", /unknown depth_encoding 'rgb24-le' — refusing/],
      ["depth_scale", 1000, /unknown depth_scale '1000' — refusing/],
      ["depth_invalid_value", 65535, /unknown depth_invalid_value '65535' — refusing/],
    ]) {
      const d = fresh("depth-contract");
      const m = JSON.parse(readFileSync(join(d, "manifest.json"), "utf8"));
      m.points["cp-a"][field] = value;
      writeFileSync(join(d, "manifest.json"), JSON.stringify(m, null, 2));
      throws(d, re);
      rmSync(d, { recursive: true, force: true });
    }
  });

  it("a broken registration fails: an inconsistent affine, and a dot outside its room", () => {
    const d = fresh("bad-reg");
    const r = JSON.parse(readFileSync(join(d, "renders/topview.registration.json"), "utf8"));
    r.cm_per_px.x = 2;
    writeFileSync(join(d, "renders/topview.registration.json"), JSON.stringify(r, null, 2));
    throws(d, /disagrees with cm_per_px/);
    rmSync(d, { recursive: true, force: true });

    const d2 = fresh("bad-legend");
    const r2 = JSON.parse(readFileSync(join(d2, "renders/topview.registration.json"), "utf8"));
    r2.rooms[0].polygon_px = r2.rooms[0].polygon_px.map(([c, rw]) => [c + 3, rw]);
    writeFileSync(join(d2, "renders/topview.registration.json"), JSON.stringify(r2, null, 2));
    throws(d2, /legend's room polygons differ from plan.json's loops/);
    rmSync(d2, { recursive: true, force: true });
  });

  it("an orphan point fails rather than shipping a scene nobody can reach", () => {
    const d = fresh("orphan");
    rewritePlan(d, (p) => {
      p.openings = []; // brick up the only door
    });
    throws(d, /orphan camera point/);
    rmSync(d, { recursive: true, force: true });
  });
});

// ── E. the angle convention, measured against rendered pixels ───────────────────────────────────
describe("E. ⭐ the link angles are in the RENDER's frame — proved against T07's depth, not asserted", () => {
  /**
   * For a camera in a rectangular room, aim at each of the four wall faces at eye height, convert
   * with the SAME `look()` the links use, re-project to a depth pixel with the renderer's own
   * mappings, and compare the decoded metres with the plan distance. A sign error in the azimuth
   * would read the OPPOSITE wall; the control column proves those two are far apart.
   *
   * ⚠ Where the ray leaves through a window or a glazed door, the depth is the distance to the PANE
   * in the reveal, i.e. ≈ +½ the wall's thickness past the interior face (measured, F-360-125) — so
   * those rays are checked against that, and they are exactly the rays a ruler must not trust.
   */
  const rays = [
    // point, room, face, expect-through-aperture (wall id whose thickness is added)
    ["cp-bath-main", "r-bath-main", "west", "w-svc-e"],
    ["cp-bath-main", "r-bath-main", "east", null],
    ["cp-bath-main", "r-bath-main", "north", null],
    ["cp-bath-main", "r-bath-main", "south", null],
    ["cp-master", "r-master", "west", "w-ext-w-master"],
    ["cp-master", "r-master", "east", null],
    ["cp-master", "r-master", "north", null],
    ["cp-master", "r-master", "south", "w-ext-s"],
  ];
  const wallThickness = (id) => {
    const w = plan.walls.find((x) => x.id === id);
    return Math.min(w.rect_cm[2] - w.rect_cm[0], w.rect_cm[3] - w.rect_cm[1]);
  };

  const cache = new Map();
  const depthOf = (pid) => {
    if (!cache.has(pid)) cache.set(pid, readPng(readFileSync(join(PILOT, "renders", pid, "depth.png"))));
    return cache.get(pid);
  };
  // ⭐ the pixel comes from the EMITTED `texture_uv` — the field T09/T10 will actually consume —
  //    not from a second derivation that could agree with the code and disagree with the render.
  const readAt = (pid, [u, v]) => {
    const { w: W, h: H, rgb } = depthOf(pid);
    const col = (((Math.round(u * W - 0.5)) % W) + W) % W;
    const row = Math.min(H - 1, Math.max(0, Math.round(v * H - 0.5)));
    return decodeDepth(rgb, W, col, row, { encoding: "rgb24-be", scale: 100 });
  };

  it("8 horizontal rays in 2 rooms decode within 2 cm of plan geometry — a flipped azimuth does not", () => {
    let worst = 0;
    let discriminating = 0;
    for (const [pid, rid, face, aperture] of rays) {
      const p = plan.camera_points.find((c) => c.id === pid);
      const room = plan.rooms.find((r) => r.id === rid);
      const [x0, y0, x1, y1] = room.bbox_cm;
      const aim = { west: [x0, p.y], east: [x1, p.y], north: [p.x, y0], south: [p.x, y1] }[face];
      const dx = aim[0] - p.x;
      const dy = aim[1] - p.y;
      const L = look(dx, dy, 0, p.yaw_deg);
      const read = readAt(pid, L.texture_uv);
      const flipped = readAt(pid, [(1 - L.texture_uv[0]) % 1, L.texture_uv[1]]); // u ↦ 1−u ≡ az ↦ −az
      const truth = (Math.hypot(dx, dy) + (aperture ? wallThickness(aperture) / 2 : 0)) / 100;
      const err = Math.abs(read - truth) * 100;
      worst = Math.max(worst, err);
      assert.ok(err <= 2, `${pid} ${face}: read ${read} m, expected ${truth.toFixed(3)} m (Δ ${err.toFixed(1)} cm)`);
      // ⚠ a ray dead ahead (az 0) or dead behind (az ±180) CANNOT see a sign flip — same column.
      //   Only the off-axis rays are evidence, and there must be enough of them.
      if (Math.abs(flipped - truth) * 100 > 5) discriminating++;
    }
    assert.ok(worst <= 2, `worst ray error ${worst.toFixed(1)} cm`);
    // ⛔ a control that cannot tell the two hypotheses apart is not a control
    assert.ok(discriminating >= 4, `only ${discriminating} of ${rays.length} rays can see a sign flip`);
  });

  it("the vertical convention is pinned at both poles, on all 12 scenes (v=1 is the FLOOR)", () => {
    for (const p of plan.camera_points) {
      const down = look(0, 0, -p.z, p.yaw_deg);
      const up = look(0, 0, tour.meta.ceiling.height_cm - p.z, p.yaw_deg);
      assert.equal(down.elev_deg, -90);
      assert.equal(up.elev_deg, 90);
      assert.equal(down.texture_uv[1], 1);
      assert.equal(up.texture_uv[1], 0);
      // eye height 140 below, ceiling 260 ⇒ 120 above: the two poles differ by 20 cm, so a flipped
      // v reads the wrong one and this assertion goes red (⭐ it is also the ONLY thing in this
      // suite that can see a v flip — every wall ray sits at v = 0.5).
      assert.equal(readAt(p.id, down.texture_uv), p.z / 100, `${p.id} nadir = the eye height`);
      assert.equal(readAt(p.id, up.texture_uv), (tour.meta.ceiling.height_cm - p.z) / 100, `${p.id} zenith = the ceiling clearance`);
    }
  });
});
