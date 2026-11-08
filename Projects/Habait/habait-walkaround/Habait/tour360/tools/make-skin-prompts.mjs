#!/usr/bin/env node
/* Habait Tour360 — make-skin-prompts.mjs (WALKAROUND-QUALITY-PLAN §3.1, cards Q03/Q04; D-WQ-13, D-WQ-22).
   Writes apartments/<id>/skin-prompts.json from the material board, the general plan and a skins config:
   one entry per camera, in the same shape gen-pano.mjs reads (id, references, prompt), so
     timeout 540 node tools/gen-pano.mjs <apt> <camera> muse  --prompts skin-prompts.json --cap 200   (a draft, $0.01)
     timeout 540 node tools/gen-pano.mjs <apt> <camera> gpt25x --prompts skin-prompts.json --cap 200   (a final, $2.40)
   runs the skin lane on the apartment's ledger. Image 1 is always the CG render of that camera; the anchor room's
   finished skin (when it exists) is image 2 and the board's reference image 3. $0, no network.

   usage: node tools/make-skin-prompts.mjs <apartment> [--renders <dir>] [--anchor <camera>] [--anchor-file <png>] [--ref <file>] [--roll auto|none]
     --renders  the folder with <cp-id>/pano.webp (default ../../360walkaround/tours/<apartment>/renders)
     --anchor   the camera whose finished skin anchors every other room (default living)
     --anchor-file the finished anchor skin (default _local/skins/<anchor>__final.png when it exists)
     --ref      an extra style reference (default _local/refs/style-living.png when it exists)
     --roll     auto (2026-10-29, OQ-2 / D-WQ-33): a generative skin does not join its own left and right edges, so the wrap
                edge is parked on the blankest wall the camera sees — the CG is rolled so that bearing becomes the image edge
                (the rolled copy is image 1, _local/refs/cg-rolled/), the position words follow the rolled frame, the entry
                carries `roll` and gen-pano.mjs rolls the answer back into the camera frame. A camera with no clear wall
                (under 4° of clear wall each side, the living room of 846) keeps the plain frame and says so. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { paneSpanInRoom, roomsAlong, projector, positionWords, visibleShare } from './plan-geometry.mjs';
import { appRequire } from './app-require.mjs';
const sharp = appRequire(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..'))('sharp');
// the CG depth beside a render (metres x 100 packed big-endian in RGB): an opening the camera cannot see from where it
// stands (the entrance's two doors sit round the guest-bath corner) must not be named, or the model draws it on the wall
const loadDepth = async (cgFile) => { if (!cgFile) return null; const f = path.join(path.dirname(cgFile), 'depth.png'); if (!fs.existsSync(f)) return null; const d = sharp(f).removeAlpha(); const m = await d.metadata(); const { data } = await d.raw().toBuffer({ resolveWithObject: true }); return { W: m.width, H: m.height, at: (x, y) => { const i = (y * m.width + x) * 3; return (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]; } }; };

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOUR = path.resolve(HERE, '..');
const HARNESS = path.resolve(TOUR, '..', '..');
const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const aptId = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
if (!aptId) { console.error('usage: make-skin-prompts.mjs <apartment> [--renders <dir>] [--anchor <camera>] [--anchor-file <png>] [--ref <file>]'); process.exit(2); }
const APT = path.join(TOUR, 'apartments', aptId);
const board = JSON.parse(fs.readFileSync(path.join(APT, 'material-board.json'), 'utf8'));
const plan = JSON.parse(fs.readFileSync(path.join(APT, 'plan.general.json'), 'utf8'));
const renders = flag('--renders') ? path.resolve(flag('--renders')) : path.join(HARNESS, '360walkaround', 'tours', aptId, 'renders');
const anchorCam = flag('--anchor') || 'living';
const anchorFile = flag('--anchor-file') || path.join(APT, '_local', 'skins', `${anchorCam}__final.png`);
const extraRef = flag('--ref') || path.join(APT, '_local', 'refs', 'style-living.png');
const rel = (f) => path.relative(APT, f).split(path.sep).join('/');
const rollMode = flag('--roll') || 'none';
const skinNotes = (() => { try { return JSON.parse(fs.readFileSync(path.join(APT, 'skin-notes.json'), 'utf8')); } catch { return {}; } })();
const picks = (() => { try { return JSON.parse(fs.readFileSync(path.join(APT, '_local', 'picks.json'), 'utf8')); } catch { return {}; } })();
// the roll: `uEdge` is where, in the camera's own frame (u 0.5 = its heading), the rolled image's edge sits; every position
// word and the view order are read in the rolled frame, the depth (the camera's frame) is not
let uEdge = 0;
const sh = (u) => (((u - uEdge) % 1) + 1) % 1;
const scenesJson = fs.existsSync(path.join(APT, 'scenes.json')) ? JSON.parse(fs.readFileSync(path.join(APT, 'scenes.json'), 'utf8')).scenes : [];
const bearingTo = (cp, p) => { const b = (Math.atan2(p[0] - cp.x, -(p[1] - cp.y)) * 180) / Math.PI; return (b + 360) % 360; };
const dAng = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const inArc = (b, a1, a2) => { const w = dAng(a1, a2); return dAng(b, a1) <= w && dAng(b, a2) <= w; };   // b inside the shorter arc a1..a2
/** the blankest wall bearing for the seam: not inside any opening or pane of the room, as far as possible from every jamb,
    pane end, nearby fixture corner and hotspot, and behind the visitor on arrival when it can be; null when nothing clears 4° */
const chooseRoll = (room, cp) => {
  const edges = [], arcs = [];
  // a door split across the edges vanishes (the living probe lost its wardrobe door at 5.9° clear), so a door's span is out
  // and 10° of clear wall is the floor; a zone-boundary passage (no door) is open floor and a far wall — a fair place, its
  // jambs still kept away from
  for (const o of plan.openings) if (o.rooms.includes(room.id)) { const a = bearingTo(cp, o.a_cm), b = bearingTo(cp, o.b_cm); edges.push({ b: a, w: 1, what: `${o.id} jamb` }, { b, w: 1, what: `${o.id} jamb` }); if (o.kind !== 'opening') arcs.push([a, b]); }
  for (const p of plan.panes) { if (p.kind === 'railing' && !room.is_outdoor) continue; const sp = paneSpanInRoom(p, room.loop); if (!sp) continue; const a = bearingTo(cp, sp.a), b = bearingTo(cp, sp.b); edges.push({ b: a, w: 1, what: `${p.id} end` }, { b, w: 1, what: `${p.id} end` }); arcs.push([a, b]); }
  const joined = new Set([room.id]); for (const o of plan.openings) if (o.kind === 'opening' && o.rooms.includes(room.id)) joined.add(o.rooms.find((x) => x !== room.id));
  for (const f of plan.fixtures || []) { if (!joined.has(f.room_id)) continue; const near = Math.min(...f.polygon_cm.map(([x, y]) => Math.hypot(x - cp.x, y - cp.y))); if (near > 450) continue; for (const q of f.polygon_cm) edges.push({ b: bearingTo(cp, q), w: near < 150 ? 2 : 1, what: `${f.id} corner` });
    // fix-846-fidelity 2026-11-04: a FIXED element's whole span is out, not only its corners — the kitchen's seam was parked at 315°,
    // between the sink (275°) and the hob (341°) of one counter run, and the skin came back with the run mirrored
    if (['counter', 'tall_unit', 'wardrobe'].includes(f.kind)) { const bs = f.polygon_cm.map((q) => bearingTo(cp, q)).sort((x, y) => x - y); let gi = 0, gap = -1; for (let i = 0; i < bs.length; i++) { const g = ((bs[(i + 1) % bs.length] - bs[i]) + 360) % 360 || 360; if (g > gap) { gap = g; gi = i; } } arcs.push([bs[(gi + 1) % bs.length], bs[gi]]); } }
  const sc = scenesJson.find((s) => `cp-${s.id}`.toLowerCase() === cp.id.toLowerCase());
  for (const h of (sc && sc.hotspots) || []) edges.push({ b: ((cp.yaw_deg || 0) + (h.u - 0.5) * 360 + 360) % 360, w: 2, what: `hotspot ${h.to}` });
  let best = null;
  for (let b = 0; b < 360; b++) {
    if (arcs.some(([a1, a2]) => inArc(b, a1, a2))) continue;
    let clear = Infinity, who = ''; for (const e of edges) { const d = dAng(b, e.b) / e.w; if (d < clear) { clear = d; who = e.what; } }
    const rel = ((b - (cp.yaw_deg || 0) + 540) % 360) - 180; const score = clear - (Math.abs(rel) < 90 ? 8 : 0);   // the first view is the last place for a seam
    if (!best || score > best.score) best = { bearing: b, rel, clear, who, score };
  }
  if (!best || best.clear < 10) return null;
  return { bearing_deg: best.bearing, rel_deg: best.rel, clear_deg: +best.clear.toFixed(1), nearest: best.who, u_edge: +((0.5 + best.rel / 360 + 1) % 1).toFixed(4) };
};
/** the CG rolled so that the column at u_edge becomes the left edge: image 1 of a rolled skin */
const rollImage = async (src, u_edge, dst) => { const m = await sharp(src).metadata(); const W = m.width, H = m.height, x0 = Math.round(u_edge * W) % W; if (!x0) { fs.copyFileSync(src, dst); return; }
  const R = await sharp(src).extract({ left: x0, top: 0, width: W - x0, height: H }).toBuffer(); const L = await sharp(src).extract({ left: 0, top: 0, width: x0, height: H }).toBuffer();
  await sharp({ create: { width: W, height: H, channels: 3, background: '#000' } }).composite([{ input: R, left: 0, top: 0 }, { input: L, left: W - x0, top: 0 }]).webp({ quality: 92 }).toFile(dst); };

const fill = (tpl, map) => tpl.replace(/\{([A-Z_]+)\}/g, (_, k) => (k in map ? map[k] : `{${k}}`));
// what lies behind every opening and pane of the camera's room, in view order (left edge → right), from the plan:
// the model is told what each door, glass wall and railing is so it stops inventing a corridor behind a glass wall,
// a balcony behind a window or a glass door between two rooms (the 2026-10-28 Muse drafts did all three)
const PROSE = { dining: 'dining area', entrance: 'entrance hall', wardrobe: 'walk-in wardrobe', 'terrace, bedroom end': 'bedroom terrace' };
const prose = (r) => { const n = r.name_en.toLowerCase(); if (r.id === 'r-bedroom-2') return 'second bedroom'; return PROSE[n] || n; };
const nameOf = (id) => { const r = plan.rooms.find((x) => x.id === id); return r ? prose(r) : id; };
// a passage between walls (both jambs within 10 cm of a wall): only then are its width and side walls named — an open-plan zone
// boundary (a virtual line between kitchen and living) keeps the open words
const segDist = ([px, py], [ax, ay], [bx, by]) => { const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy; const t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0; return Math.hypot(px - (ax + t * dx), py - (ay + t * dy)); };
const nearWall = (pt) => (plan.walls || []).some((wl) => wl.polygon_cm.some((a, i) => segDist(pt, a, wl.polygon_cm[(i + 1) % wl.polygon_cm.length]) <= 10));
const betweenWalls = (o) => o.a_cm && o.b_cm && nearWall(o.a_cm) && nearWall(o.b_cm);
const neighboursLine = (room, cp, depth) => {
  const proj = projector(cp); const parts = []; const hidden = [];
  const seen = (a, b, sill, head) => !depth || visibleShare(cp, a, b, sill, head, depth.at, depth.W, depth.H) >= 0.5;
  for (const o of plan.openings) {
    if (!o.rooms.includes(room.id)) continue;
    if (!seen(o.a_cm, o.b_cm, o.sill_cm ?? 0, o.head_cm)) { hidden.push(o.id); continue; }
    const otherId = o.rooms.find((x) => x !== room.id); const other = plan.rooms.find((r) => r.id === otherId) || {};
    const u = sh(proj(o.centre_cm).u); const pos = positionWords(u); const crossing = !!room.is_outdoor !== !!other.is_outdoor;
    if (o.kind === 'entrance_door') parts.push([u, `the apartment's front door ${pos}: a tall flush frameless door in matte graphite, closed, nothing visible beyond it`]);
    else if (o.kind === 'opening' && crossing) parts.push([u, `a sliding glass door ${pos} ${room.is_outdoor ? 'into' : 'out to'} the ${nameOf(otherId)}`]);
    // (fork F 2026-11-05, parity row 15: «no wall and no door between them» made the model take down the walls BESIDE a 160-cm passage —
    //  apt846-auto's bedroom widened its passage to the wardrobe in two independent generations, 5.38 % against the plan. The passage's
    //  own width and the walls on both sides of it are now part of the words.)
    else if (o.kind === 'opening') { const w = Math.round(Math.hypot(o.b_cm[0] - o.a_cm[0], o.b_cm[1] - o.a_cm[1]));
      parts.push([u, room.is_outdoor ? `${pos} the terrace continues into the ${nameOf(otherId)} with no wall and no door between them` : (!betweenWalls(o) ? `${pos} the room opens into the ${nameOf(otherId)} with no wall and no door between them` : `${pos} an open passage exactly ${w} cm wide, with no door, leads into the ${nameOf(otherId)}; the walls on both sides of the passage stay exactly where Image 1 has them`)]); }
    else if (crossing) parts.push([u, `a glass sliding door ${pos} ${room.is_outdoor ? 'into' : 'out to'} the ${nameOf(otherId)}`]);
    else parts.push([u, `a door ${pos} leading to the ${nameOf(otherId)} (a zero-line door: full-height, frameless, flush with the wall, no architrave, painted the wall colour, or an open doorway; never glass)`]);
  }
  for (const p of plan.panes) {
    if (p.kind === 'railing' && !room.is_outdoor) continue;
    const sp = paneSpanInRoom(p, room.loop); if (!sp) continue;
    if (!seen(sp.a, sp.b, p.sill_cm ?? 0, p.head_cm)) { hidden.push(p.id); continue; }
    const across = roomsAlong(sp.points, plan.rooms, { exceptId: room.id });
    const mid = [(sp.a[0] + sp.b[0]) / 2, (sp.a[1] + sp.b[1]) / 2]; const u = sh(proj(mid).u); const pos = positionWords(u);
    const names = (rs) => rs.map(prose).join(' and the ');
    if (p.kind === 'railing') parts.push([u, `a frameless glass railing ${pos}: beyond it only open air and the hazy city far below`]);
    else if (room.is_outdoor) { const inside = across.filter((r) => !r.is_outdoor); parts.push([u, `the apartment's glass facade ${pos}: through it you see the ${inside.length ? names(inside) : 'rooms inside'}`]); }
    else { const out = across.filter((r) => r.is_outdoor); parts.push([u, out.length ? `floor-to-ceiling glass ${pos}, with the ${names(out)} (a covered terrace with a glass railing) directly outside it` : `a floor-to-ceiling glass facade ${pos}: beyond it only the open air, a bright hazy sky and the far city below; no balcony, no railing, no terrace, no neighbouring building close by`]); }
  }
  parts.sort((a, b) => a[0] - b[0]);
  const texts = parts.map((x) => x[1]).filter((t, i, arr) => i === 0 || t !== arr[i - 1]);   // several panes of one glass wall read as one
  if (hidden.length) console.log(`  ${cp.id}: ${hidden.join(', ')} hidden from this camera (not named)`);
  return texts.length ? `What the openings in this view are, from the left edge of the image to the right: ${texts.join('; ')}. Nothing else in this room is a door, a window or a glass wall.` : '';
};
// the plan's furniture (plan.fixtures, card Q02b): the builder extrudes each as a plain light-grey block, and this line
// tells the model what each block is, by bearing from the camera; the blocks of the zones joined to this room by a
// virtual opening (the open-plan kitchen seen from the living room) are named too, with their zone
// parity row 23: when the room's tall unit has a type, every other fixture's words that name the column ("the tall oven column closes its
// south end") say the same type — one name for one column in every prompt
const TALL_NAME = { fridge: 'fridge', oven: 'oven', pantry: 'storage' };
// parity row 25 (2026-11-06, fork F: apt846-auto's 01-entrance and 05-terrace-living never named the kitchen's tall column, so the model
// painted its habit — an oven tower — where the drawing has the fridge): a fixture in ANOTHER room is named when the camera SEES it
// (a clear sight line to one of its corners within 700 cm: no wall or door leaf crosses it — the same sight lines the consistency judge uses, skin-project SEE_CM; glass does not block, and the CG depth is NOT used because it reads the glass as a surface), not only
// when its room is joined to this one by an open passage
const sightWalls = (plan.walls || []).flatMap((w) => w.polygon_cm.map((a, i) => [a, w.polygon_cm[(i + 1) % w.polygon_cm.length]]))
  .concat((plan.openings || []).filter((o) => o.kind !== 'opening' && o.a_cm && o.b_cm).map((o) => [o.a_cm, o.b_cm]));
const crosses = (p, q, a, b) => { const d = (q[0] - p[0]) * (b[1] - a[1]) - (q[1] - p[1]) * (b[0] - a[0]); if (Math.abs(d) < 1e-9) return false; const t = ((a[0] - p[0]) * (b[1] - a[1]) - (a[1] - p[1]) * (b[0] - a[0])) / d, s = ((a[0] - p[0]) * (q[1] - p[1]) - (a[1] - p[1]) * (q[0] - p[0])) / d; return t > 0.02 && t < 0.98 && s >= 0 && s <= 1; };
// at least TWO of its points (corners or centre) must be in clear sight: one ray slipping through a joint between two wall polygons is a leak, not a view
const seesFixture = (cp, f) => { const C = [cp.x, cp.y]; const pts = [...(f.polygon_cm || []), ...(f.centre_cm ? [f.centre_cm] : [])]; return pts.filter((q) => Math.hypot(q[0] - C[0], q[1] - C[1]) <= 700 && !sightWalls.some(([a, b]) => crosses(C, q, a, b))).length >= Math.min(2, pts.length); };
const tallSays = (roomId, text) => {
  const t = (plan.fixtures || []).find((x) => x.kind === 'tall_unit' && x.room_id === roomId && x.tall_type);
  return t ? String(text).replace(/\btall (?:oven|fridge|storage|pantry) (column|tower)\b/gi, `tall ${TALL_NAME[t.tall_type] || t.tall_type} column`) : text;
};
const fixturesLine = (room, cp) => {
  const fixtures = plan.fixtures || []; if (!fixtures.length) return '';
  const proj = projector(cp); const words = board.fixture_words || {}; const parts = [];
  const joined = new Set([room.id]); for (const o of plan.openings) if (o.kind === 'opening' && o.rooms.includes(room.id)) joined.add(o.rooms.find((x) => x !== room.id));
  for (const f of fixtures) {
    if (!joined.has(f.room_id) && !seesFixture(cp, f)) continue; const c = f.centre_cm || f.polygon_cm.reduce((a, p) => [a[0] + p[0] / f.polygon_cm.length, a[1] + p[1] / f.polygon_cm.length], [0, 0]);
    const p = proj(c); const what = /* a tall unit is named by its type, parity row 23 */ tallSays(f.room_id, (f.kind === 'tall_unit' && f.tall_type && words[`tall_unit_${f.tall_type}`]) || f.words_en || words[f.kind] || f.kind); const where = f.room_id === room.id ? '' : ` (over in the ${nameOf(f.room_id)})`;
    const near = p.dist < 120 ? ', very close to the camera' : p.dist > 500 ? ', far off' : '';
    const u = sh(p.u); parts.push([u, `${positionWords(u)}${near}${where}: ${what}`]);
  }
  if (!parts.length) return '';
  parts.sort((a, b) => a[0] - b[0]);
  return `${board.fixtures_line_head || 'The plain light-grey blocks in Image 1 are furniture placeholders at their true place and size; dress each as what it is and add no other large piece.'} From the left edge of the image to the right: ${parts.map((x) => x[1]).join('; ')}.`;
};
// the entry id is the tour's asset name (cameras.json scenes[].asset, e.g. 04-living) so gen-pano's answer lands as
// _local/generated/04-living__<model>__… and make-sets picks it up like any generated panorama
const camsJson = fs.existsSync(path.join(APT, 'cameras.json')) ? JSON.parse(fs.readFileSync(path.join(APT, 'cameras.json'), 'utf8')) : null;
const assetOf = (camId) => (camsJson?.scenes?.find((s) => s.id === camId) || {}).asset || camId;
const out = [];
for (const cp of plan.camera_points) {
  const camId = cp.id.replace(/^cp-/, '');
  const room = plan.rooms.find((r) => r.id === cp.room_id);
  if (!room) { console.warn(`${cp.id}: no room, skipped`); continue; }
  const cg = path.join(renders, cp.id, 'pano.webp');
  const cgDraft = path.join(renders, cp.id, 'pano-draft.webp');
  const cgFile = fs.existsSync(cg) ? cg : fs.existsSync(cgDraft) ? cgDraft : null;
  const depth = await loadDepth(cgFile);   // null without a render: every opening is then named
  // --self-anchor (the re-skin round, D-WQ-33): the anchor room itself is skinned AGAINST its own earlier final, so the
  // apartment's look holds while its geometry is redone
  const isAnchor = camId === anchorCam && !args.includes('--self-anchor');
  const refs = [];
  let roll = null; uEdge = 0;
  // --roll-at <cp-id>=<bearing> (fix-846-fidelity 2026-11-04): a person parks the seam where the chooser cannot (the kitchen: no 10°
  // of clear wall, and the plain frame's edge falls in the middle of the counter run)
  const rollAt = Object.fromEntries(args.flatMap((a, i) => (a === '--roll-at' ? [args[i + 1].split('=')] : [])));
  // the plan's own seam data (2026-11-05, parity: the portal gets the same): camera_points[].seam_bearing_deg parks the seam at that
  // bearing (a person's choice where the chooser cannot: the kitchen's counter run), seam: "plain" keeps the unrolled frame
  if (rollAt[cp.id] === undefined && Number.isFinite(cp.seam_bearing_deg)) rollAt[cp.id] = cp.seam_bearing_deg;
  if (cp.seam === 'plain' && rollAt[cp.id] === undefined) { roll = null; uEdge = 0; console.log(`  ${cp.id}: the plain frame (plan: seam "plain")`); }
  else if (rollAt[cp.id] !== undefined) { const b = Number(rollAt[cp.id]); const rel = ((b - (cp.yaw_deg || 0) + 540) % 360) - 180; roll = { bearing_deg: b, rel_deg: rel, clear_deg: null, nearest: 'set by the plan / --roll-at', u_edge: +((0.5 + rel / 360 + 1) % 1).toFixed(4) }; uEdge = roll.u_edge; console.log(`  ${cp.id}: the seam parked at bearing ${b}° (${Number.isFinite(cp.seam_bearing_deg) && cp.seam_bearing_deg === b ? 'plan seam_bearing_deg' : '--roll-at'})`); }
  else if (rollMode === 'auto') {
    roll = chooseRoll(room, cp);
    if (roll) { uEdge = roll.u_edge; console.log(`  ${cp.id}: the seam parked at bearing ${roll.bearing_deg}° (rel ${roll.rel_deg.toFixed(0)}°, ${roll.clear_deg}° clear each side, nearest ${roll.nearest})`); }
    else console.log(`  ${cp.id}: no clear wall for the seam (under 4°) — the plain frame; close the seam after`);
  }
  if (roll && cgFile) { const dir = path.join(APT, '_local', 'refs', 'cg-rolled'); fs.mkdirSync(dir, { recursive: true }); const dst = path.join(dir, `${cp.id}.webp`); await rollImage(cgFile, roll.u_edge, dst); refs.push(rel(dst)); }
  else refs.push(rel(cgFile || cg));   // a missing render keeps its expected path (gen-pano refuses on read); see the `cg` field
  if (!isAnchor && fs.existsSync(anchorFile)) refs.push(rel(anchorFile));
  if (fs.existsSync(extraRef)) refs.push(rel(extraRef));
  const surfKey = board.room_surfaces[room.type] || 'walls';
  const roomSurfaces = surfKey === 'FEATURE' ? board.surfaces.feature : board.surfaces[surfKey] || board.surfaces.walls;
  const anchorRoom = plan.rooms.find((r) => r.id === (plan.camera_points.find((c) => c.id === `cp-${anchorCam}`) || {}).room_id);
  const anchorLine = isAnchor || !fs.existsSync(anchorFile) ? board.anchor_lines.first : fill(board.anchor_lines.next, { ANCHOR_ROOM: anchorRoom ? anchorRoom.name_en.toLowerCase() : 'living room' });
  const prompt = fill(board.skin_prompt_template, {
    ROOM_EN: room.name_en, ROOM_HE: room.name_he, ANCHOR_LINE: anchorLine, OUTDOOR_LINE: room.is_outdoor ? (board.outdoor_line || '') + ' ' : '', NEIGHBOURS: neighboursLine(room, cp, depth), FIXTURES: fixturesLine(room, cp),
    FLOOR: board.surfaces.floor, WALLS: board.surfaces.walls, CEILING: board.surfaces.ceiling, FEATURE: board.surfaces.feature, DOORS: board.surfaces.doors,
    ROOM_SURFACES: roomSurfaces, GLAZING: board.surfaces.glazing, TEXTILES: board.textiles, DRESSING: board.dressing[room.type] || board.dressing.other,
    LIGHT: board.light, WINDOWS: board.windows, AVOID: board.avoid,
  });
  // skin-notes.json (2026-11-05, parity): the apartment's per-room fidelity sentences (DATA, not code) and references taken from another
  // room's passed picture (a fixed element seen from several rooms is painted once: the kitchen of 02 is Image N of 03 and 04)
  let finalPrompt = prompt; const finalRefs = refs.slice();
  const note = skinNotes.notes && skinNotes.notes[assetOf(camId)];
  if (note) finalPrompt += ' [fidelity] ' + note;
  const rf = skinNotes.reference_from && skinNotes.reference_from[assetOf(camId)];
  if (rf && picks[rf.from] && fs.existsSync(path.join(APT, '_local', 'generated', picks[rf.from]))) {
    finalRefs.push(rel(path.join(APT, '_local', 'generated', picks[rf.from])));
    finalPrompt += ` [reference] Image ${finalRefs.length} ` + rf.words.replace(/\{N\}/g, String(finalRefs.length));
  }
  out.push({ id: assetOf(camId), scene: camId, camera: cp.id, room: room.id, outdoor: room.is_outdoor, references: finalRefs, prompt: finalPrompt, board: board.id, cg: cgFile ? rel(cgFile) : null, ...(roll ? { roll } : {}) });
}
const outFile = path.join(APT, 'skin-prompts.json');
fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
const missing = out.filter((s) => !s.cg).length;
console.log(`${rel(outFile)}: ${out.length} skins from board ${board.id}; anchor ${anchorCam} (${fs.existsSync(anchorFile) ? 'finished skin present' : 'not yet skinned: every room gets the first-room line'}); renders ${renders}${missing ? `; ${missing} camera(s) without a CG render yet` : ''}`);
