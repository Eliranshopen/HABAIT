#!/usr/bin/env node
/* Habait Tour360 — apartments/hatzav/prep.mjs (2026-11-18). The Hatzav house (3 rooms, 80 m², Harei Zahav, Moshav Na'ama) as a
   RAINBOW tour apartment, built at $0 from the Hatzav job's own files (no generation, no vision scan, no network):
     the panoramas  JOB/work/pano360/<room>.png (Blender, 2048×1024)  or  JOB/work/pano360/real/<room>.jpg (the realism pass, 4096×2048, seam closed; the .png there is never read)
     the cameras    JOB/walkaround/walk-grid.json `views` (plan u,v cm), overridden by source.json `cameraOverrides`
                    (living = 700,880: the coordinator's 2026-11-18 ruling), checked against the render's own strip record
     the plan sheet JOB/input/plan-hatzav-colour.png, mapped by JOB/geometry/geometry.json `source` (origin_px, px_per_cm)
     the rings      JOB/items/placements.json: each piece's box projected on the sphere from each camera that shares its room
                    and has a clear line to it through the walls of geometry.json (instead of RAINBOW's paid vision scan)
     the catalog    JOB/items/catalog-spec.json + the studio photos JOB/items/studio/<id>.png (our own AI-made items, never RAINBOW's)
     the ruler      depth/<asset>.png: a radial depth map ray-cast from geometry.json (walls, openings, floor, ceiling); furniture
                    is not in it
   Writes (all inside this folder): apartment.json, cameras.json, scenes.json, markers.json, copy.json, catalog/, panos/, plan/,
   depth/, and with the realism source _local/full/ + panos/original/.
   Usage (Git Bash, from tour360/):  HABAIT_APP_DIR=C:/RnD/Projects/3Dengine/appdeps timeout 540 node apartments/hatzav/prep.mjs [--source blender|real]
   The source defaults to source.json `panoSource` — that ONE line switches the tour between the Blender and the realistic set. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const APT = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(APT, 'source.json'), 'utf8'));
const argAfter = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const SOURCE = argAfter('--source') || cfg.panoSource;
if (!cfg.sources[SOURCE]) { console.error(`prep: unknown source "${SOURCE}" (source.json sources: ${Object.keys(cfg.sources).join(', ')})`); process.exit(2); }
const JOB = path.resolve(APT, cfg.job);
const appDir = process.env.HABAIT_APP_DIR || cfg.appDepsFallback;
const sharp = createRequire(path.join(appDir, 'package.json'))('sharp');
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJson = (p, o) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(o, null, 1) + '\n'); };
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const D = Math.PI / 180;
const wrap180 = (d) => { const r = ((((d + 180) % 360) + 360) % 360) - 180; return r === -180 ? 180 : r; };
const r2 = (x) => Math.round(x * 100) / 100;
const TODAY = '2026-11-18';

const geo = readJson(path.join(JOB, 'geometry', 'geometry.json'));
const grid = readJson(path.join(JOB, 'walkaround', 'walk-grid.json'));
const placements = readJson(path.join(JOB, 'items', 'placements.json')).pieces;
const spec = readJson(path.join(JOB, 'items', 'catalog-spec.json')).categories;
const EYE = 155;
const CEIL = geo.heights.ceiling_cm.v;

/* ── the rooms: order, names ×3, zones, links (the doors and openings of geometry.json) ─────────────────────────────── */
const ZONES = {
  public: { he: 'סלון · מטבח · פינת אוכל', en: 'Living · kitchen · dining', fr: 'Séjour · cuisine · repas' },
  wing: { he: 'אגף השינה', en: 'Bedroom wing', fr: 'Espace nuit' },
  out: { he: 'בחוץ', en: 'Outside', fr: 'Extérieur' },
};
const ROOMS = [
  { id: 'living', he: 'סלון', en: 'Living room', fr: 'Séjour', zone: 'public' },
  { id: 'dining', he: 'פינת אוכל', en: 'Dining', fr: 'Coin repas', zone: 'public' },
  { id: 'kitchen', he: 'מטבח', en: 'Kitchen', fr: 'Cuisine', zone: 'public' },
  { id: 'entrance', he: 'כניסה', en: 'Entrance', fr: 'Entrée', zone: 'public' },
  { id: 'hall', he: 'מבואה', en: 'Hall', fr: 'Dégagement', zone: 'wing' },
  { id: 'bedroom', he: 'חדר שינה', en: 'Bedroom', fr: 'Chambre', zone: 'wing' },
  { id: 'saferoom', he: 'ממ"ד', en: 'Safe room', fr: 'Pièce sécurisée', zone: 'wing' },
  { id: 'bath', he: 'חדר רחצה', en: 'Bathroom', fr: 'Salle de bains', zone: 'wing' },
  { id: 'deck', he: 'דק', en: 'Deck', fr: 'Terrasse', zone: 'out' },
  { id: 'garden', he: 'גינה', en: 'Garden', fr: 'Jardin' , zone: 'out' },
];
const opening = (id) => { const o = geo.openings.find((x) => x.id === id); return [(o.box[0] + o.box[2]) / 2, (o.box[1] + o.box[3]) / 2]; };
const HALL_GAP = [268, 526]; // the open side between the hall and the public space (hall loop v = 526, u 212–325; no wall there)
// via = the point the visitor walks through; null = open space (aim at the target camera)
const LINKS = {
  living: { dining: null, kitchen: null, entrance: null, hall: HALL_GAP, deck: opening('door-sliding') },
  dining: { living: null, kitchen: null, entrance: null, hall: HALL_GAP },
  kitchen: { living: null, dining: null, entrance: null },
  // from the entrance the hall shows only as a strip beside the shaft block (checked on the entrance render 2026-11-18): aim at that strip
  entrance: { living: null, dining: null, kitchen: null, hall: [222, 520] },
  hall: { entrance: HALL_GAP, bedroom: opening('door-bedroom'), saferoom: opening('door-saferoom'), bath: opening('door-bath') },
  bedroom: { hall: opening('door-bedroom') },
  saferoom: { hall: opening('door-saferoom') },
  bath: { hall: opening('door-bath') },
  deck: { living: opening('door-sliding'), garden: null },
  garden: { deck: null },
};

/* ── the panoramas that exist now ─────────────────────────────────────────────────────────────────────────────────── */
const src = cfg.sources[SOURCE];
const SRC_DIR = path.join(JOB, src.dir);
const BLENDER_DIR = path.join(JOB, cfg.sources.blender.dir);
const present = ROOMS.filter((r) => fs.existsSync(path.join(SRC_DIR, r.id + src.ext)));
const missing = ROOMS.filter((r) => !present.includes(r)).map((r) => r.id);
if (!present.length) { console.error(`prep: no panorama in ${SRC_DIR}`); process.exit(1); }
if (SOURCE !== 'blender') for (const r of present) if (!fs.existsSync(path.join(BLENDER_DIR, r.id + '.png'))) { console.error(`prep: ${r.id} has a ${SOURCE} panorama but no Blender one (the Original switch needs both)`); process.exit(1); }
const assetOf = (r) => String(ROOMS.indexOf(r) + 1).padStart(2, '0') + '-' + r.id;

/* ── cameras: walk-grid views, the overrides, checked against the render's own record ─────────────────────────────── */
const cams = {};
const camNotes = [];
for (const r of present) {
  let at = cfg.cameraOverrides[r.id] ? cfg.cameraOverrides[r.id].at : grid.views[r.id].slice(0, 2);
  // the render's own record: the NEWEST strips/<room>[n]_0.png.json written before the panorama (a re-render writes <room>2_0…)
  const sdir = path.join(BLENDER_DIR, 'strips');
  const pngT0 = fs.statSync(path.join(BLENDER_DIR, r.id + '.png')).mtimeMs;
  const strip = (fs.existsSync(sdir) ? fs.readdirSync(sdir) : []).filter((f) => new RegExp('^' + r.id + '[0-9]*_0[.]png[.]json$').test(f)).map((f) => path.join(sdir, f))
    .filter((f) => fs.statSync(f).mtimeMs <= pngT0 + 60e3).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] || '-';
  const pngT = fs.statSync(path.join(BLENDER_DIR, r.id + '.png')).mtimeMs;
  // only the strip record of THIS render counts (written in the 30 min before the panorama); an older one belongs to a replaced render
  if (fs.existsSync(strip) && Math.abs(pngT - fs.statSync(strip).mtimeMs - 15 * 60e3) <= 15 * 60e3 + 60e3) {
    const rec = readJson(strip);
    if (Array.isArray(rec.at_uv_cm)) {
      const d = Math.hypot(rec.at_uv_cm[0] - at[0], rec.at_uv_cm[1] - at[1]);
      if (d > 1) {
        camNotes.push(`${r.id}: the render's strip record says ${rec.at_uv_cm} but the config says ${at} — the render's record is used`);
        at = rec.at_uv_cm.slice(0, 2);
      }
    }
  }
  cams[r.id] = at;
}

/* ── wall geometry: ray-casting in the plan (walls are boxes; doors pass between sill and head, windows stop at the pane) ─ */
const WALLS = geo.walls.map((w) => w.box);
const OPEN = geo.openings.map((o) => ({ box: o.box, kind: o.kind, sill: o.sill_cm, head: o.head_cm }));
const inBox = (p, b, pad = 0.5) => p[0] >= b[0] - pad && p[0] <= b[2] + pad && p[1] >= b[1] - pad && p[1] <= b[3] + pad;
/** the [enter, exit] distances of the ray (o, unit d) through an axis box, or null */
function slab(o, d, b) {
  let t0 = -Infinity, t1 = Infinity;
  for (let k = 0; k < 2; k++) {
    const lo = b[k], hi = b[k + 2];
    if (Math.abs(d[k]) < 1e-9) { if (o[k] < lo || o[k] > hi) return null; continue; }
    let a = (lo - o[k]) / d[k], c = (hi - o[k]) / d[k];
    if (a > c) [a, c] = [c, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, c);
  }
  return t1 >= Math.max(t0, 0) ? [Math.max(t0, 0), t1] : null;
}
/** the horizontal distance along (o, d) at which the ray is stopped by a wall, at height z(t) = eye + t·slope; Infinity when none */
function wallHit(o, d, slope, eyeZ) {
  const hits = [];
  for (const b of WALLS) { const s = slab(o, d, b); if (s) hits.push(s[0]); }
  hits.sort((a, b) => a - b);
  for (const t of hits) {
    const p = [o[0] + d[0] * (t + 0.6), o[1] + d[1] * (t + 0.6)];
    const z = eyeZ + t * slope;
    const op = OPEN.find((x) => inBox(p, x.box, 1));
    if (op && (op.kind === 'door' || op.kind === 'sliding_door') && z > op.sill && z < op.head) continue; // through the doorway
    return { t, z, kind: op ? op.kind : 'wall' };
  }
  return null;
}
const ROOM_POLYS = geo.rooms.map((r) => ({ id: r.id, poly: r.poly }));
const inPoly = (p, P) => { let c = false; for (let k = 0, j = P.length - 1; k < P.length; j = k++) { const [xi, yi] = P[k], [xj, yj] = P[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c; } return c; };
const roomAt = (p) => { const r = ROOM_POLYS.find((x) => inPoly(p, x.poly)); return r ? r.id : 'outside'; };
const FOOT = geo.footprint;
const inside = (p) => inPoly(p, FOOT);

/* ── the plan sheet ──────────────────────────────────────────────────────────────────────────────────────────────── */
const S = cfg.planScale;
const ORIGIN = geo.source.origin_px, PPC = geo.source.px_per_cm;
const sheet = (u, v) => ({ x: r2((ORIGIN[0] + u * PPC) * S), y: r2((ORIGIN[1] + v * PPC) * S) });
const planSrc = path.join(JOB, geo.source.file);
const planMeta = await sharp(planSrc).metadata();
const SW = Math.round(planMeta.width * S), SH = Math.round(planMeta.height * S);
fs.mkdirSync(path.join(APT, 'plan'), { recursive: true });
await sharp(planSrc).resize(SW, SH).webp({ quality: 90 }).toFile(path.join(APT, 'plan', 'floorplan.webp'));
const vb0 = sheet(cfg.planView[0], cfg.planView[1]), vb1 = sheet(cfg.planView[2], cfg.planView[3]);
const viewBox = [Math.max(0, Math.round(vb0.x)), Math.max(0, Math.round(vb0.y)), 0, 0];
viewBox[2] = Math.min(SW, Math.round(vb1.x)) - viewBox[0];
viewBox[3] = Math.min(SH, Math.round(vb1.y)) - viewBox[1];

/* ── the panorama sets ───────────────────────────────────────────────────────────────────────────────────────────── */
// every folder this script makes carries its context file (root CLAUDE.md §8.6), rewritten with the folder
const CARDS = {
  panos: 'the tour’s panorama sets (balanced, thumb, and original when the realism source is built)',
  'panos/balanced': 'the 2048×1024 WebP panoramas the page shows, one per room, named <nn>-<room>.webp; written by ../../prep.mjs from the chosen source',
  'panos/thumb': 'the 640×320 WebP room thumbnails of the room strip; written by ../../prep.mjs',
  'panos/original': 'the Blender renders (2048×1024 WebP) behind the realism pass, shown by the page’s Original switch; written by ../../prep.mjs only for the "real" source',
  plan: 'floorplan.webp: the sales plan sheet (JOB/input/plan-hatzav-colour.png × planScale) the page’s plan sheet draws; written by ../prep.mjs',
  depth: 'the ruler’s depth maps (rgb24-be centimetres, radial, 1024×512) ray-cast from geometry.json, and depth.json; furniture is not in them; written by ../prep.mjs',
  catalog: 'items.json: this tour’s own swap catalog (tour360/catalog.v1, AI rows); build-tour --catalog uses it instead of RAINBOW’s catalog (tools/apartment-overrides.mjs)',
  'catalog/photos': 'the catalog photos (JPEG 768 px) made from the Hatzav job’s studio photos JOB/items/studio/<id>.png; hashed in ../items.json',
  guide: 'guide.json: the voice tour’s written narration per room (no voice made, $0); written by ../prep.mjs',
  'guide/audio': 'silent WAV files, one per room, the reading time of its narration (the page’s guide advances on their end); written by ../../prep.mjs',
  _local: 'untracked (gitignored) sets: full/ = the 4096×2048 realism set for build-tour --full',
  '_local/full': 'the 4096×2048 WebP realism set (untracked), carried by build-tour --full; written by ../../prep.mjs only for the "real" source',
};
const card = (rel) => { const d = path.join(APT, rel); fs.mkdirSync(d, { recursive: true }); const depth = rel.split('/').length; fs.writeFileSync(path.join(d, 'CLAUDE.md'), `# apartments/hatzav/${rel}/ — context file
<!-- last-updated: ${TODAY} -->

## What's here
${CARDS[rel] || 'generated by prep.mjs'}.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Apartment: [${'../'.repeat(depth)}CLAUDE.md](${'../'.repeat(depth)}CLAUDE.md)
`); };
const reset = (rel) => { const d = path.join(APT, rel); fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true }); const parts = rel.split('/'); for (let i = 1; i <= parts.length; i++) card(parts.slice(0, i).join('/')); return d; };
const balDir = reset('panos/balanced'), thumbDir = reset('panos/thumb');
const origDir = SOURCE === 'blender' ? null : reset('panos/original');
const fullDir = SOURCE === 'blender' ? null : reset('_local/full');
if (SOURCE === 'blender') { fs.rmSync(path.join(APT, 'panos', 'original'), { recursive: true, force: true }); fs.rmSync(path.join(APT, '_local', 'full'), { recursive: true, force: true }); }
card('plan');
const panoRows = [];
for (const r of present) {
  const a = assetOf(r);
  const file = path.join(SRC_DIR, r.id + src.ext);
  const meta = await sharp(file).metadata();
  if (meta.width !== 2 * meta.height) { console.error(`prep: ${file} is ${meta.width}×${meta.height}, not 2:1`); process.exit(1); }
  await sharp(file).resize(2048, 1024).webp({ quality: 92 }).toFile(path.join(balDir, a + '.webp'));
  await sharp(file).resize(640, 320).webp({ quality: 82 }).toFile(path.join(thumbDir, a + '.webp'));
  if (fullDir) await sharp(file).webp({ quality: 90 }).toFile(path.join(fullDir, a + '.webp'));
  if (origDir) await sharp(path.join(BLENDER_DIR, r.id + '.png')).resize(2048, 1024).webp({ quality: 92 }).toFile(path.join(origDir, a + '.webp'));
  panoRows.push({ room: r.id, asset: a, source: path.relative(JOB, file).replace(/\\/g, '/'), px: [meta.width, meta.height], sha256: sha(fs.readFileSync(file)), mtime: fs.statSync(file).mtime.toISOString() });
}

/* ── scenes.json ─────────────────────────────────────────────────────────────────────────────────────────────────── */
// The panorama frame (checked 2026-11-18 on the living render: the sofa, the lounge chair and the dining table sit where their
// placements say): yaw 0 = image centre = plan +u, positive yaw toward plan +v. On the sheet (0 = up, clockwise) +u is 90°.
const CENTRE_BEARING = 90;
const yawTo = (from, to) => Math.atan2(to[1] - from[1], to[0] - from[0]) / D;
/** the start yaw: source.json headings, else toward the middle of the camera's room, else the longest clear look; outside, toward the house */
function startYaw(id) {
  const at = cams[id];
  if (id === 'deck' || id === 'garden') return r2(yawTo(at, cams.living || [700, 880]));
  if (cfg.headings && Number.isFinite(cfg.headings[id])) return cfg.headings[id]; // a look chosen by eye (source.json headings)
  // the room's middle: the camera's own room polygon's area centroid (the first try, 2026-11-18, the longest clear ray, looked through
  // the safe-room door at a shelf a metre away)
  const room = ROOM_POLYS.find((x) => inPoly(at, x.poly));
  if (room) {
    let A = 0, cx = 0, cy = 0; const P = room.poly;
    for (let k = 0, j = P.length - 1; k < P.length; j = k++) { const f = P[j][0] * P[k][1] - P[k][0] * P[j][1]; A += f; cx += (P[j][0] + P[k][0]) * f; cy += (P[j][1] + P[k][1]) * f; }
    const c = [cx / (3 * A), cy / (3 * A)];
    if (Math.hypot(c[0] - at[0], c[1] - at[1]) > 60) return Math.round(yawTo(at, c));
  }
  const free = [];
  for (let y = -180; y < 180; y += 2) { const d = [Math.cos(y * D), Math.sin(y * D)]; const h = wallHit(at, d, 0, EYE); free.push(h ? h.t : 3000); }
  let best = 0, bestV = -1;
  for (let i = 0; i < free.length; i++) { let s = 0; for (let k = -15; k <= 15; k++) s += Math.min(free[(i + k + free.length) % free.length], 1500); if (s > bestV) { bestV = s; best = i; } }
  return -180 + best * 2;
}
const nameOf = (id) => { const r = ROOMS.find((x) => x.id === id); return { he: r.he, en: r.en, fr: r.fr }; };
const scenes = present.map((r) => {
  const at = cams[r.id];
  const hotspots = [];
  for (const [to, via] of Object.entries(LINKS[r.id])) {
    if (!cams[to]) continue;
    const y = wrap180(yawTo(at, via || cams[to]));
    hotspots.push({ to, u: Math.round((0.5 + y / 360) * 10000) / 10000, v: 0.68,
      label: { he: 'כניסה אל ' + nameOf(to).he, en: 'To the ' + nameOf(to).en.toLowerCase(), fr: 'Vers : ' + nameOf(to).fr },
      source: `apartments/hatzav/prep.mjs: plan bearing from (${at}) to ${via ? 'the opening at (' + via.map(Math.round) + ')' : 'the ' + to + ' camera (open space)'}` });
  }
  return { id: r.id, name: nameOf(r.id), zone: ZONES[r.zone], asset: assetOf(r), heading: startYaw(r.id), plan: sheet(at[0], at[1]), centreBearingDeg: CENTRE_BEARING, hotspots };
});
writeJson(path.join(APT, 'scenes.json'), {
  $schema: 'tour360/scenes.v1', apartment: 'hatzav',
  coordinateNotes: {
    u_v: 'normalized position on the equirectangular image: u 0→1 left→right (0.5 = image centre = yaw 0 = plan +u); v 0.68 on the floor line',
    plan: `x/y in the pixel space of plan/floorplan.webp = JOB/input/plan-hatzav-colour.png × ${S}; plan px = origin_px + u,v cm × px_per_cm (geometry.json source)`,
    hotspots: 'u from the plan direction camera → opening (or → the target camera in open space); computed by prep.mjs, not calibrated by eye',
    heading: 'source.json headings when set by eye; else toward the area centroid of the camera’s room polygon (geometry.json rooms); else the longest clear look; outside rooms look at the house',
  },
  scenes,
});

/* ── markers.json: every placed piece with alternatives, projected from each camera that sees it ──────────────────────── */
const CATMAP = { sofa: 'sofa', armchair: 'armchair', dining_chair: 'chair', dining_table: 'dining_table', coffee_table: 'coffee_table', pendant: 'lamp', bed: 'bed', rug: 'rug' };
const SPECKEY = { sofa: 'sofa', armchair: 'armchair', chair: 'dining_chair', dining_table: 'dining_table', coffee_table: 'coffee_table', lamp: 'pendant', bed: 'bed', rug: 'rug' };
const hull = (pts) => { const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); const lo = [], up = []; for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); } for (const q of p.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); } return lo.slice(0, -1).concat(up.slice(0, -1)); };
function project(at, pc) {
  // a hung piece (pendant) hangs DOWN from pos.y (checked on the kitchen render 2026-11-18: the shades sit 150–205 cm, not above)
  const cx = pc.pos[0] * 100, cz = pc.pos[2] * 100, y0 = pc.pos[1] * 100 - (pc.hang ? pc.size[1] * 100 : 0), w = pc.size[0] * 100, h = pc.size[1] * 100, dz = pc.size[2] * 100;
  const centreYaw = yawTo(at, [cx, cz]);
  const pts = [];
  for (const sx of [-0.5, 0.5]) for (const sz of [-0.5, 0.5]) for (const sy of [0, 1]) {
    const u = cx + sx * w, v = cz + sz * dz, z = y0 + sy * h;
    const hd = Math.hypot(u - at[0], v - at[1]);
    pts.push([r2(centreYaw + wrap180(yawTo(at, [u, v]) - centreYaw)), r2(Math.atan2(z - EYE, Math.max(hd, 1)) / D)]);
  }
  const out = hull(pts);
  const ys = out.map((q) => q[0]), ps = out.map((q) => q[1]);
  const dist = Math.hypot(cx - at[0], cz - at[1]);
  const mid = [r2(wrap180((Math.min(...ys) + Math.max(...ys)) / 2)), r2((Math.min(...ps) + Math.max(...ps)) / 2)];
  return { outline: out.map((q) => [r2(wrap180(q[0])), q[1]]), yaw: mid[0], pitch: mid[1], span: [r2(Math.max(...ys) - Math.min(...ys)), r2(Math.max(...ps) - Math.min(...ps))], dist };
}
/** the piece is seen when it stands in the camera's room (the public space is one room) and no wall cuts the line to its centre */
function seen(at, pc) {
  const c = [pc.pos[0] * 100, pc.pos[2] * 100];
  if (roomAt(at) !== roomAt(c)) return false;
  const d = [c[0] - at[0], c[1] - at[1]], L = Math.hypot(d[0], d[1]);
  const z = pc.pos[1] * 100 + (pc.hang ? -1 : 1) * pc.size[1] * 100 / 2;
  const hit = wallHit(at, [d[0] / L, d[1] / L], (z - EYE) / L, EYE);
  return !(hit && hit.t < L - 30) && L < cfg.markerMaxDistCm;
}
const markerDoc = { $schema: 'tour360/markers.v1', apartment: 'hatzav', scanned_on: TODAY + 'T00:00:00.000Z', model: 'none — geometric projection of JOB/items/placements.json (apartments/hatzav/prep.mjs, $0)', categories_with_items: [...new Set(Object.values(CATMAP))], scenes: {} };
let nMk = 0;
for (const s of scenes) {
  const at = cams[s.id];
  const groups = new Map();
  for (const pc of placements) {
    const cat = CATMAP[pc.category];
    if (!cat || !seen(at, pc)) continue;
    const key = pc.src + '|' + cat;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(pc);
  }
  const markers = [];
  for (const [key, list] of groups) {
    const cat = key.split('|')[1];
    const pr = list.map((pc) => ({ pc, p: project(at, pc) })).filter((x) => Math.max(...x.p.span) >= cfg.markerMinSpanDeg);
    if (!pr.length) continue;
    const id = `${s.id}-${list[0].src}`;
    if (pr.length === 1) {
      const p = pr[0].p;
      markers.push({ id, category: cat, yaw: p.yaw, pitch: p.pitch, span_deg: p.span, outlines: [p.outline], count: 1, piece: pr[0].pc.id });
    } else {
      const ys = pr.map((x) => x.p.yaw), ps = pr.map((x) => x.p.pitch);
      const y0 = ys[0], yawMean = r2(wrap180(y0 + ys.reduce((a, y) => a + wrap180(y - y0), 0) / ys.length));
      const allY = pr.flatMap((x) => x.p.outline.map((q) => wrap180(q[0] - yawMean))), allP = pr.flatMap((x) => x.p.outline.map((q) => q[1]));
      markers.push({ id: id + '-set', category: cat, yaw: yawMean, pitch: r2(ps.reduce((a, b) => a + b, 0) / ps.length), span_deg: [r2(Math.max(...allY) - Math.min(...allY)), r2(Math.max(...allP) - Math.min(...allP))], outlines: pr.map((x) => x.p.outline), count: pr.length, members: pr.map((x) => x.pc.id) });
    }
  }
  nMk += markers.length;
  markerDoc.scenes[s.id] = { pano_sha256: sha(fs.readFileSync(path.join(balDir, s.asset + '.webp'))), asset: s.asset, heading: s.heading, scanned_on: markerDoc.scanned_on, usd: 0, markers };
}
writeJson(path.join(APT, 'markers.json'), markerDoc);

/* ── the catalog: our own AI-made alternatives (studio photos → JPEG ≤ 1024 px, ≤ 400 KB) ─────────────────────────────── */
const catDir = reset('catalog/photos');
const items = [];
for (const [cat, sk] of Object.entries(SPECKEY)) {
  const group = spec[sk];
  if (!group) continue;
  const ref = placements.find((pc) => pc.src === group.ref) || placements.find((pc) => CATMAP[pc.category] === cat);
  for (const it of group.items) {
    const png = path.join(JOB, 'items', 'studio', it.id + '.png');
    if (!fs.existsSync(png)) { console.warn(`prep: no studio photo for ${it.id} — left out of the catalog`); continue; }
    const out = path.join(catDir, it.id.replace(/_/g, '-') + '.jpg');
    await sharp(png).resize(768, 768, { fit: 'inside' }).flatten({ background: '#ffffff' }).jpeg({ quality: 84, mozjpeg: true }).toFile(out);
    const buf = fs.readFileSync(out);
    items.push({ id: it.id.replace(/_/g, '-').slice(0, 24), source: 'ai-generated', brand: 'Habait AI', name: it.name_en.charAt(0).toUpperCase() + it.name_en.slice(1), name_he: it.name_he, category: cat, colour: it.colour,
      size_cm: ref ? { w: Math.round(ref.size[0] * 100), d: Math.round(ref.size[2] * 100), h: Math.round(ref.size[1] * 100) } : { w: 100, d: 100, h: 100 },
      image: 'photos/' + path.basename(out), view: 'living', description_en: it.desc,
      generated: { model: 'fal-ai/nano-banana-pro/edit (the Hatzav job, 2026-11-17)', on: '2026-11-17', from: 'JOB/items/studio/' + it.id + '.png' }, image_sha256: sha(buf) });
  }
}
writeJson(path.join(APT, 'catalog', 'items.json'), { $schema: 'tour360/catalog.v1', source: { retailer: 'Habait AI — the Hatzav job\'s own items', site: 'local (no product page)', read_on: TODAY, licence: 'made for Habait by AI image models from the developer\'s renders; illustration only, not products for sale' }, items });

/* ── the ruler: depth maps ray-cast from geometry.json (rgb24-be centimetres, radial; walls, openings, floor, ceiling) ─── */
const DW = 1024, DH = 512;
const depthDir = reset('depth');
const depthScenes = {};
for (const s of scenes) {
  const at = cams[s.id];
  const indoor = inside(at);
  const eyeZ = EYE + (indoor ? 0 : geo.heights.deck_top_cm.v);
  const buf = Buffer.alloc(DW * DH * 3);
  for (let col = 0; col < DW; col++) {
    const yaw = ((col + 0.5) / DW - 0.5) * 360;
    const d = [Math.cos(yaw * D), Math.sin(yaw * D)];
    for (let row = 0; row < DH; row++) {
      const pitch = (0.5 - (row + 0.5) / DH) * 180;
      if (Math.abs(pitch) > 89) continue;
      const slope = Math.tan(pitch * D);
      let tPlane = Infinity;
      if (slope < 0) tPlane = (eyeZ - (indoor ? 0 : geo.heights.deck_top_cm.v)) / -slope;
      else if (slope > 0 && indoor) tPlane = (CEIL - eyeZ) / slope;
      const hit = wallHit(at, d, slope, eyeZ);
      let t = Math.min(tPlane, hit && hit.z <= (geo.heights.parapet_top_cm.v) ? hit.t : Infinity);
      if (!Number.isFinite(t) || t > 5000) continue; // the sky, or too far: invalid (0)
      const cm = Math.round(t / Math.cos(pitch * D));
      const i = (row * DW + col) * 3;
      buf[i] = (cm >> 16) & 255; buf[i + 1] = (cm >> 8) & 255; buf[i + 2] = cm & 255;
    }
  }
  const f = s.asset + '.png';
  await sharp(buf, { raw: { width: DW, height: DH, channels: 3 } }).png({ compressionLevel: 9 }).toFile(path.join(depthDir, f));
  depthScenes[s.id] = { file: f };
}
writeJson(path.join(depthDir, 'depth.json'), { encoding: 'rgb24-be', scale: 100, invalid: 0, decode: '(R<<16 | G<<8 | B) / 100 => metres (radial distance from the camera)', frame: 'u = 0.5 + yaw/360 (yaw 0 = the panorama centre = plan +u), v = 0.5 - pitch/180', source: 'apartments/hatzav/prep.mjs: ray-cast in JOB/geometry/geometry.json (walls as boxes, doors open between sill and head, windows stop at the pane, floor at 0, ceiling at ' + CEIL + ' cm indoors). FURNITURE IS NOT IN IT: a point on a sofa measures to the floor or wall behind it', scenes: depthScenes });

/* ── the voice tour's script: a written narration per room (facts from the sales plan and geometry.json only). No voice is made
   ($0 rule: edge-tts is a network service, a recorded voice a paid one); each step carries a silent WAV of its reading time so the
   page's guide advances by itself and shows the text card (the tour's guide falls back to the text when the sound is blocked). ── */
const NARR = {
  living: ['ברוכים הבאים לדגם חצב: בית של 3 חדרים ו־80 מ"ר בהרי זהב, מושב נעמה. ההדמיה ממודל תלת־ממדי לפי תכנית המכר, והריהוט להמחשה בלבד. זה הסלון, חלק מחלל של כ־39 מ"ר עם המטבח ופינת האוכל, ודלת הזזה ברוחב של כ־3 מטרים אל הדק.', 'Welcome to the Hatzav model: a 3-room, 80 m² house in Harei Zahav, Moshav Na\'ama. This is a visualization from a 3D model built to the sales plan; the furniture is for illustration only. This is the living room, part of a space of about 39 m² with the kitchen and the dining area, and a sliding door about 3 metres wide to the deck.'],
  dining: ['פינת האוכל, בין המטבח לסלון. השולחן עומד במקום שבו הוא מסומן בתכנית המכר.', 'The dining area, between the kitchen and the living room. The table stands where the sales plan draws it.'],
  kitchen: ['המטבח: משטח עבודה לאורך הקיר, ומשטח עם כיור מתחת לחלון המטבח.', 'The kitchen: a worktop along the wall, and a run with the sink under the kitchen window.'],
  entrance: ['הכניסה: דלת הכניסה נפתחת ישירות אל החלל המשותף של הסלון, המטבח ופינת האוכל.', 'The entrance: the front door opens straight into the shared space of the living room, kitchen and dining area.'],
  hall: ['המבואה מובילה אל חדר השינה, אל הממ"ד ואל חדר הרחצה.', 'The hall leads to the bedroom, the safe room and the bathroom.'],
  bedroom: ['חדר השינה, כ־12 מ"ר לפי תכנית המכר.', 'The bedroom, about 12 m² on the sales plan.'],
  saferoom: ['הממ"ד, כ־9 מ"ר לפי תכנית המכר, משמש גם כחדר שני.', 'The safe room, about 9 m² on the sales plan, also serves as a second bedroom.'],
  bath: ['חדר הרחצה.', 'The bathroom.'],
  deck: ['הדק, ביציאה מדלת ההזזה של הסלון.', 'The deck, out through the living room\'s sliding door.'],
  garden: ['הגינה שסביב הבית. הצמחייה להמחשה בלבד.', 'The garden around the house. The planting is for illustration only.'],
};
const ORDER = ['living', 'dining', 'kitchen', 'entrance', 'hall', 'bedroom', 'saferoom', 'bath', 'deck', 'garden'];
const guideDir = reset('guide/audio');
card('guide');
const silentWav = (seconds) => { const rate = 4000, n = Math.round(rate * seconds); const b = Buffer.alloc(44 + n, 128); b.write('RIFF', 0); b.writeUInt32LE(36 + n, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34); b.write('data', 36); b.writeUInt32LE(n, 40); return b; };
const guideDoc = { schema: 'habait-tour/guide.v1', made: TODAY + ' by apartments/hatzav/prep.mjs: written narration only (no voice made); facts from the sales plan and geometry.json', he: { name: 'סיור בדגם חצב', steps: [] }, en: { name: 'The Hatzav model tour', steps: [] } };
for (const id of ORDER.filter((r) => cams[r])) {
  const [he, en] = NARR[id];
  const sec = Math.max(5, Math.round(he.length / 14));
  const f = `guide/audio/${id}.wav`;
  fs.writeFileSync(path.join(APT, f), silentWav(sec));
  guideDoc.he.steps.push({ scene: id, text: he, audio: f, seconds: sec });
  guideDoc.en.steps.push({ scene: id, text: en, audio: f, seconds: sec });
}
writeJson(path.join(APT, 'guide', 'guide.json'), guideDoc);

/* ── apartment.json, cameras.json, copy.json ─────────────────────────────────────────────────────────────────────── */
const real = SOURCE !== 'blender';
const apartment = {
  $schema: 'tour360/apartment.v1', id: 'hatzav', status: 'concept',
  title: { he: 'דגם חצב · 3 חדרים · 80 מ"ר · הרי זהב, מושב נעמה (הדמיה)', en: 'Hatzav model · 3 rooms · 80 m² · Harei Zahav, Moshav Na\'ama (concept)', fr: 'Modèle Hatzav · 3 pièces · 80 m² · Harei Zahav, moshav Na\'ama (concept)' },
  project: null,
  projectNote: 'the Hatzav house from the developer\'s sales plan (JOB/input/plan-hatzav-colour.png); geometry of record JOB/geometry/geometry.json, gated by JOB/scripts/05_check_geometry.py; furniture from the developer\'s interior renders, made as 3D items with AI (JOB/items)',
  plan: { image: 'plan/floorplan.webp', imageSize: [SW, SH], viewBox, labelsLanguage: 'he', northSource: 'none: geometry.json says plan-top is called north by name only; no north arrow was measured, so the tour shows no compass' },
  sets: {
    balanced: { dir: 'panos/balanced', width: 2048, height: 1024, format: 'webp', tracked: true },
    thumb: { dir: 'panos/thumb', width: 640, height: 320, format: 'webp', tracked: true },
    ...(real ? {
      full: { dir: '_local/full', width: 4096, height: 2048, format: 'webp', tracked: false, note: 'the realism pass at its native 4096×2048, carried by build-tour --full' },
      original: { dir: 'panos/original', width: 2048, height: 1024, format: 'webp', tracked: true, note: 'the Blender renders the realism pass was made over (one yaw frame); the Original switch shows them' },
    } : {}),
  },
  disclosure: { badgeKey: 'badge', conceptLineKey: 'conceptLine', aiNoteKey: 'aiNote', copyPack: '../../copy/tour360-copy.json + copy.json (this apartment\'s disclosure)', permanent: true },
  fidelity: real
    ? { mode: 'ai-over-cg', note: 'the realism pass is an AI image pass over the Blender renders; RAINBOW\'s fidelity gate (tools/fidelity-gate.mjs) needs a paid depth call and a plan.general.json trace, neither made for Hatzav — build-tour refuses without --ungated-ok, which is Eliran\'s call (root §6)' }
    : { mode: 'cg-render', evidence: 'the panoramas are Blender renders of the plan-true model (JOB/geometry/geometry.json, gate JOB/scripts/05_check_geometry.py, report JOB/qa/QA-REPORT.md); no AI image model drew the room, so the per-picture gate of fidelity.json does not apply' },
  provenance: { panoramas: `${SOURCE}: ${src.note}`, rings: 'geometric projection of JOB/items/placements.json, $0 (no vision scan)', ruler: 'depth ray-cast from geometry.json, $0', catalog: 'JOB/items/catalog-spec.json + JOB/items/studio (our own AI-made items; nothing from RAINBOW\'s catalog)' },
  panoSource: SOURCE, panoramas: panoRows, missingRooms: missing, cameraNotes: camNotes,
  sceneCount: scenes.length, defaultScene: scenes.some((s) => s.id === 'living') ? 'living' : scenes[0].id, intakeDate: TODAY,
};
writeJson(path.join(APT, 'apartment.json'), apartment);
writeJson(path.join(APT, 'cameras.json'), { $schema: 'tour360/cameras.v1', apartment: 'hatzav', note: 'positions in the plan frame (u right, v down, cm; geometry.json); eye ' + EYE + ' cm; living moved to 700,880 (coordinator 2026-11-18: the walk view stood 0.6–0.9 m from the TV unit). The plan block lets build-tour give the page the sheet\'s px per cm.', plan: { crop: 'JOB/input/plan-hatzav-colour.png', pxPerCm: PPC, planScale: S, sheet: 'plan/floorplan.webp' }, eye_cm: EYE, scenes: scenes.map((s) => ({ id: s.id, asset: s.asset, at_uv_cm: cams[s.id], links: Object.keys(LINKS[s.id]).filter((t) => cams[t]) })) });
const copyOut = JSON.parse(JSON.stringify(cfg.copy.common));
Object.assign(copyOut.ui = copyOut.ui || {}, (cfg.copy[SOURCE] && cfg.copy[SOURCE].ui) || {});
if (cfg.copy[SOURCE] && cfg.copy[SOURCE].aiNote) copyOut.aiNote = cfg.copy[SOURCE].aiNote;
writeJson(path.join(APT, 'copy.json'), { _note: 'generated by prep.mjs from source.json `copy` — edit there. build-tour and smoke merge it over copy/tour360-copy.json for this apartment only', ...copyOut });

console.log(`prep hatzav [${SOURCE}]: ${scenes.length} scenes (${scenes.map((s) => s.id).join(' ')})${missing.length ? ' · not rendered yet: ' + missing.join(' ') : ''} · ${scenes.reduce((n, s) => n + s.hotspots.length, 0)} doors · ${nMk} rings · ${items.length} catalog items · ${scenes.length} depth maps`);
for (const n of camNotes) console.log('  camera: ' + n);
