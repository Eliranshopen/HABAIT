#!/usr/bin/env node
/* Habait Tour360 — build-tour.mjs (T01, board habait-tour360).
   apartments/<id>/ → dist/<id>/ : ONE self-contained index.html (Pannellum + tour CSS/JS + the apartment data inlined) plus the
   media it loads (panos/, thumbs/, plan/, fonts/) and a vercel.json with the noindex header. Zero dependencies, deterministic:
   the same inputs give the same index.html. When the apartment has an edits.json (the prepared changes of PLAN.md §9), its
   patches go to panos/patches/ and the page gets the fields it draws them with.
   With --catalog (T14d, CATALOG-PLAN.md; explicit, off by default) the build also carries the catalog: the check runs first, the
   photos go to dist/<id>/catalog/, the items into the page data and api/catalog.json beside the function. A --catalog build holds
   a retailer's photos — the laptop host only, until PLAN.md OQ-14 is ruled (D-T360-27).
   Usage (from the harness root, Git Bash):  timeout 540 node Habait/tour360/tools/build-tour.mjs demo-01 [--catalog] */
import fs from 'node:fs';
import { appRequire } from './app-require.mjs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const TOOLS = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TOOLS, '..');
const id = process.argv[2];
const catalogAiOnly = process.argv.includes('--catalog=ai'); // plan 2026-11-04-apt-furniture-swap: the AI rows only, no retailer photo leaves the laptop
const withCatalog = process.argv.includes('--catalog') || catalogAiOnly;
const withFull = process.argv.includes('--full'); // T18g (D-CAT-28): the 7K set beside the balanced one, for desktops that can hold it
// board habait-walkaround T17 (D-T360-46, step 1): --engine draws the same page with the walkaround engine (Photo Sphere Viewer behind a
// Pannellum-compatible adapter, Habait/tour360/engine/dist/engine.{js,css}) instead of Pannellum, into the same dist/<id>/
const withEngine = process.argv.includes('--engine');
// WALKAROUND-QUALITY-PLAN.md card Q06: an --engine build carries the apartment's cube tiles when tools/make-tiles.mjs has cut them
// (apartments/<id>/_local/panos-tiles/, untracked) — every scene's, each from the source it names, unchanged since; --no-tiles leaves
// them out. An apartment without tiles builds exactly as before.
const noTiles = process.argv.includes('--no-tiles');
if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id)) {
  console.error('usage: node Habait/tour360/tools/build-tour.mjs <apartment-id> [--catalog]');
  process.exit(2);
}
// board dollhouse-in-tour: --out <dir> / --apartments <dir> (tests build a working-folder viewer into a scratch folder, reading the
// live apartment read-only); without them nothing changes
const argAfter = (k) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? path.resolve(process.argv[i + 1]) : null; };
const APT = path.join(argAfter('--apartments') || path.join(ROOT, 'apartments'), id);
const OUT = argAfter('--out') || path.join(ROOT, 'dist', id); // --engine writes the same folder, so every proof tool of the closed board runs on it unchanged
const ENGINE = path.join(ROOT, 'engine', 'dist');
const VIEWER = path.join(ROOT, 'viewer');

const read = (p) => fs.readFileSync(p, 'utf8');
const readJson = (p) => JSON.parse(read(p));
const fail = (msg) => { console.error('build-tour: ' + msg); process.exit(1); };

if (!fs.existsSync(APT)) fail('no apartment folder ' + path.relative(process.cwd(), APT));
const apartment = readJson(path.join(APT, 'apartment.json'));
const scenesDoc = readJson(path.join(APT, 'scenes.json'));
const copy = readJson(path.join(ROOT, 'copy', 'tour360-copy.json'));
for (const key of ['badge', 'conceptLine', 'aiNote']) {
  for (const l of ['he', 'en', 'fr']) if (!copy[key] || !copy[key][l]) fail(`copy pack is missing ${key}.${l} — the disclosure is structural`);
}

function copyDir(from, to, ext) {
  if (!fs.existsSync(from)) fail('missing ' + path.relative(process.cwd(), from));
  fs.mkdirSync(to, { recursive: true });
  let n = 0;
  for (const f of fs.readdirSync(from).sort()) {
    if (ext && !f.endsWith(ext)) continue;
    fs.copyFileSync(path.join(from, f), path.join(to, f));
    n += 1;
  }
  return n;
}

// 1. clean output (gitignored build dir only)
// the folder's CONTENTS go, not the folder: a static server whose working directory is dist/<id> (Windows locks it) keeps serving
// the rebuilt files
if (fs.existsSync(OUT)) for (const f of fs.readdirSync(OUT)) fs.rmSync(path.join(OUT, f), { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// 2. media
const nPanos = copyDir(path.join(APT, apartment.sets.balanced.dir), path.join(OUT, 'panos'), '.webp');
let nFull = 0;
if (withFull) {
  const full = apartment.sets && apartment.sets.full;
  if (!full || !full.dir || !full.width) fail('--full: apartment.json has no sets.full with a dir and a width');
  const fdir = path.join(APT, full.dir);
  if (!fs.existsSync(fdir)) fail(`--full: no ${full.dir} — copy the full set there first (it is not tracked; apartment.json names the source)`);
  nFull = copyDir(fdir, path.join(OUT, 'panos-full'), '.webp');
  if (nFull !== nPanos) fail(`--full: ${nFull} full panoramas against ${nPanos} balanced — every scene needs both`);
}
const nThumbs = copyDir(path.join(APT, apartment.sets.thumb.dir), path.join(OUT, 'thumbs'), '.webp');
fs.mkdirSync(path.join(OUT, 'plan'), { recursive: true });
fs.copyFileSync(path.join(APT, apartment.plan.image), path.join(OUT, 'plan', path.basename(apartment.plan.image)));
const nFonts = copyDir(path.join(VIEWER, 'fonts'), path.join(OUT, 'fonts'), '.woff2');

// 2b. the prepared changes: only the patches edits.json names, only for scenes that exist
const editsPath = path.join(APT, 'edits.json');
const editsDoc = fs.existsSync(editsPath) ? readJson(editsPath) : null;
const edits = {};
let nPatches = 0;
if (editsDoc) {
  const sceneIds = new Set(scenesDoc.scenes.map((s) => s.id));
  fs.mkdirSync(path.join(OUT, 'panos', 'patches'), { recursive: true });
  for (const [sceneId, list] of Object.entries(editsDoc.scenes || {})) {
    if (!sceneIds.has(sceneId)) fail(`edits.json names an unknown scene "${sceneId}"`);
    edits[sceneId] = list.map((e) => {
      const src = path.join(APT, 'panos', 'patches', e.patch);
      if (!fs.existsSync(src)) fail('missing patch ' + path.relative(process.cwd(), src));
      fs.copyFileSync(src, path.join(OUT, 'panos', 'patches', e.patch));
      nPatches += 1;
      return { id: e.id, order: e.order, label: e.label, patch: e.patch, x: e.x, y: e.y, w: e.w, h: e.h, look: e.look, spanDeg: e.spanDeg };
    });
  }
}

// 2c. the catalog (T14d): only with --catalog, only after its check passes; the photos are reference-only (D-T360-27)
let catalogItems = null;
if (withCatalog) {
  const { checkCatalog, photoPath, isAi } = await import('./catalog-check.mjs');
  const r = checkCatalog({ only: catalogAiOnly ? 'ai' : null });
  if (!r.ok) fail('catalog-check: ' + r.problems.join('; '));
  const doc = readJson(path.join(ROOT, 'catalog', 'items.json'));
  if (catalogAiOnly) doc.items = doc.items.filter(isAi);
  fs.mkdirSync(path.join(OUT, 'catalog'), { recursive: true });
  catalogItems = doc.items.map((it) => {
    const src = photoPath(it);
    if (!fs.existsSync(src)) fail('missing catalog photo ' + it.image);
    fs.mkdirSync(path.dirname(path.join(OUT, 'catalog', it.image)), { recursive: true });
    fs.copyFileSync(src, path.join(OUT, 'catalog', it.image));
    return { id: it.id, name: it.name, name_he: it.name_he || it.name, category: it.category, colour: it.colour, size_cm: it.size_cm, ...(isAi(it) ? { ai: true } : { price: it.price, url: it.url }), image: 'catalog/' + it.image, view: it.view };
  });
  fs.mkdirSync(path.join(OUT, 'api'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'api', 'catalog.json'), JSON.stringify({ $schema: 'tour360/catalog-api.v1', items: doc.items.map((it) => ({ id: it.id, name: it.name, category: it.category, description_en: it.description_en, image_sha256: it.image_sha256 })) }, null, 2) + '\n');
}

// 2d. the markers (T16a, CATALOG-PLAN.md §10.3): only with --catalog; the scan must exist and match every panorama's bytes
let markersByScene = null, nMarkers = 0, nMarkerScenes = 0;
if (withCatalog) {
  const mf = path.join(APT, 'markers.json');
  if (!fs.existsSync(mf)) fail(`no ${path.relative(ROOT, mf)} — run the scan first: timeout 540 node Habait/tour360/tools/scan-pieces.mjs ${id}`);
  const markers = readJson(mf);
  if (markers.$schema !== 'tour360/markers.v1') fail('markers.json has an unknown schema');
  markersByScene = {};
  for (const s of scenesDoc.scenes) {
    const sc = markers.scenes && markers.scenes[s.id];
    if (!sc) fail(`markers.json has no scan of ${s.id} — rerun the scan`);
    const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(APT, 'panos', 'balanced', s.asset + '.webp'))).digest('hex');
    if (sc.pano_sha256 !== hash) fail(`the panorama of ${s.id} changed since its scan — rerun the scan (scan-pieces ${id} --scenes ${s.id} --force)`);
    markersByScene[s.id] = (sc.markers || []).map((m) => ({ id: m.id, category: m.category, yaw: m.yaw, pitch: m.pitch, span_deg: m.span_deg, outlines: m.outlines, count: m.count, ...(m.members ? { members: m.members } : {}), ...(Array.isArray(m.cut_sides) && m.cut_sides.length ? { cut_sides: m.cut_sides } : {}), ...(m.piece ? { piece: m.piece } : {}) })); // cut_sides: T18a, the view sides the piece ran past; piece: T18d, one piece seen from several scenes
    nMarkers += markersByScene[s.id].length;
    if (markersByScene[s.id].length) nMarkerScenes += 1;
  }
}

// 2e. the tiles (card Q06): only with --engine; all scenes or none; a cut whose source changed since is refused, never shipped stale
let tiles = null, nTiles = 0, tileBytes = 0;
const TILES_SRC = path.join(APT, '_local', 'panos-tiles');
if (withEngine && !noTiles && fs.existsSync(TILES_SRC)) {
  const assets = {};
  const missing = [];
  for (const s of scenesDoc.scenes) {
    const mf = path.join(TILES_SRC, s.asset, 'tiles.json');
    if (!fs.existsSync(mf)) { missing.push(s.asset); continue; }
    const m = readJson(mf);
    if (m.$schema !== 'tour360/tiles.v1' || m.tileSize !== 512 || !Array.isArray(m.levels) || !m.levels.length) fail(`${path.relative(ROOT, mf)}: not a tour360/tiles.v1 manifest of 512 px tiles`);
    const src = path.join(APT, m.source.file);
    if (!fs.existsSync(src)) fail(`the tiles of ${s.asset} were cut from ${m.source.file}, which is gone — rerun make-tiles (or build with --no-tiles)`);
    const sha = crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex');
    if (sha !== m.source.sha256) fail(`the tiles of ${s.asset} were cut from an older ${m.source.file} — rerun: timeout 540 node Habait/tour360/tools/make-tiles.mjs ${id} --only ${s.asset}`);
    const out = path.join(OUT, 'panos-tiles', s.asset);
    const copyOne = (rel) => {
      const from = path.join(TILES_SRC, s.asset, rel);
      if (!fs.existsSync(from)) fail(`missing tile ${path.relative(ROOT, from)} — rerun make-tiles ${id} --only ${s.asset} --force`);
      fs.mkdirSync(path.dirname(path.join(out, rel)), { recursive: true });
      fs.copyFileSync(from, path.join(out, rel));
      nTiles += 1;
      tileBytes += fs.statSync(from).size;
    };
    for (const f of m.faces) {
      for (const L of m.levels) for (let r = 0; r < L.nbTiles; r++) for (let c = 0; c < L.nbTiles; c++) copyOne(`${f}/${L.level}/${r}_${c}.webp`);
      if (!fs.existsSync(path.join(out, m.preview.faces[f]))) copyOne(m.preview.faces[f]);
    }
    fs.copyFileSync(mf, path.join(out, 'tiles.json'));
    assets[s.asset] = { levels: m.levels.map((L) => ({ faceSize: L.faceSize, nbTiles: L.nbTiles })), preview: m.preview.faces, ext: m.format || 'webp', noMipmapFrom: m.noMipmapFrom ?? null };
  }
  if (missing.length === scenesDoc.scenes.length) { /* a panos-tiles folder with no cut in it: as without tiles */ }
  else if (missing.length) fail(`tiles for ${scenesDoc.scenes.length - missing.length} of ${scenesDoc.scenes.length} scenes — cut the rest (${missing.join(', ')}) with make-tiles, or build with --no-tiles`);
  else tiles = { dir: 'panos-tiles', tileSize: 512, assets };
  if (!tiles) fs.rmSync(path.join(OUT, 'panos-tiles'), { recursive: true, force: true });
}

// 2f. card Q09: the original set — the plain CG renders the designed pictures were skinned from (one yaw frame with them), which
// make-sets v2 writes (untracked) and apartment.json names as sets.original; the page's Original/Designed switch also needs his
// wording in the copy pack (OQ-1). An apartment without sets.original builds exactly as before.
let originalSet = null, nOriginal = 0;
const origSpec = apartment.sets && apartment.sets.original;
if (origSpec && origSpec.dir) {
  const odir = path.join(APT, origSpec.dir);
  if (!fs.existsSync(odir)) fail(`sets.original names ${origSpec.dir}, which is not on this disk — write it with make-sets first, or drop sets.original`);
  for (const s of scenesDoc.scenes) if (!fs.existsSync(path.join(odir, s.asset + '.webp'))) fail(`the original set has no ${s.asset}.webp`);
  nOriginal = copyDir(odir, path.join(OUT, 'panos-original'), '.webp');
  originalSet = { dir: 'panos-original', width: origSpec.width, height: origSpec.height };
}

// 2f. THE FIDELITY RULE (Eliran 2026-11-05: «תעשה הכל כדי שהכל יהיה תקין והכל יופיע כמו בתכנית מכר»; Habait/tour360/fidelity.json).
// The build refuses to package while any shipped interior picture lacks a PASS row in the apartment's gate.json for ITS EXACT BYTES
// (the gate hashes the 2048x1024 PNG re-encoding of the picture; the same chain here) at the rule's max_deviation_pct, and while the
// disclosure line does not carry that number. A failing room is never dropped: the fix loop runs until it passes (fidelity-gate.mjs).
{
  const rule = readJson(path.join(ROOT, 'fidelity.json'));
  const bar = Number(rule.max_deviation_pct);
  if (!(bar > 0)) fail('fidelity.json has no max_deviation_pct');
  if (!String(copy.conceptLine.he || '').includes(`עד ${bar}%`)) fail(`the disclosure line (copy conceptLine.he) must carry the rule's number «עד ${bar}%»; it reads: ${copy.conceptLine.he}`);
  const gateFile = path.join(APT, '_local', 'fidelity', 'gate.json');
  const gate = fs.existsSync(gateFile) ? readJson(gateFile) : { rows: [] };
  const sharpF = appRequire(path.resolve(ROOT, '..', '..'))('sharp');
  const unfit = [];
  // the shipped pictures: the balanced set, and every floor-finish set videos.json names (the switch shows them as the room)
  const shipped = [];
  for (const s of scenesDoc.scenes) {
    if (s.kind === 'exterior' || !/^\d\d-/.test(s.asset)) continue;
    shipped.push({ asset: s.asset, label: s.asset, file: path.join(APT, 'panos', 'balanced', s.asset + '.webp') });
    const vdoc = fs.existsSync(path.join(APT, 'videos.json')) ? readJson(path.join(APT, 'videos.json')) : null;
    for (const f of (vdoc && vdoc.floors) || []) if (f.panos) shipped.push({ asset: s.asset, label: `${s.asset} [${f.id}]`, file: path.join(APT, '_local', f.panos, s.asset + '.webp') });
  }
  for (const s of shipped) {
    const file = s.file;
    if (!fs.existsSync(file)) { unfit.push(`${s.label}: no picture at ${path.relative(APT, file)}`); continue; }
    const png = await sharpF(file).resize({ width: 2048, height: 1024, fit: 'fill' }).removeAlpha().png().toBuffer();
    const hash = crypto.createHash('sha256').update(png).digest('hex').slice(0, 12);
    const rows = (gate.rows || []).filter((r) => r.picture_hash === hash && r.max_deviation_pct === bar);
    // the LATEST row for these bytes at this bar decides (the gate's method moves forward; an older PASS never outranks a newer FAIL)
    const last = rows[rows.length - 1];
    const pass = last && last.verdict === 'PASS' ? last : null;
    if (!pass) { unfit.push(`${s.label}: ${last ? `${last.verdict} ${last.deviation_pct}% (bar ${bar}%, resolves ${last.resolution_pct}%)` : 'no gate row for these bytes at this bar'}`); }
  }
  if (unfit.length) fail(`the fidelity rule (${bar}%) is not met — not packaged. Rooms to fix (the fix loop, never dropped):\n  ` + unfit.join('\n  '));
  console.log(`fidelity: every shipped room has a PASS row at ${bar}% for its exact bytes`);
}

// 3. the data the page reads (only what it needs)
// 2e. the videos (Habait studio, 2026-11-01): apartments/<id>/videos.json names the flyover intro and a clip per room, per floor
// finish, as files under apartments/<id>/_local/videos/ (untracked, the studio writes them); they go to dist/<id>/videos/. A floor
// with its own panorama set (`panos` dir under _local, the same asset names) goes to dist/<id>/panos-<floor>/ and the page switches
// to it. An apartment without videos.json builds exactly as before.
let videosData = null, floorSets = null, nVideos = 0;
const videosPath = path.join(APT, 'videos.json');
if (fs.existsSync(videosPath)) {
  const vdoc = readJson(videosPath);
  const vdir = path.join(APT, '_local', 'videos');
  fs.mkdirSync(path.join(OUT, 'videos'), { recursive: true });
  const sceneIds = new Set(scenesDoc.scenes.map((s) => s.id));
  const carry = (rel) => {
    const src = path.join(vdir, rel);
    if (!fs.existsSync(src)) fail(`videos.json names ${rel} but _local/videos/${rel} is missing`);
    fs.copyFileSync(src, path.join(OUT, 'videos', path.basename(rel)));
    nVideos += 1;
    return 'videos/' + path.basename(rel);
  };
  const sets = {};
  for (const [fid, set] of Object.entries(vdoc.sets || {})) {
    sets[fid] = { ...(set.intro ? { intro: carry(set.intro) } : {}), rooms: {} };
    for (const [room, rel] of Object.entries(set.rooms || {})) {
      if (!sceneIds.has(room)) fail(`videos.json names an unknown scene "${room}"`);
      sets[fid].rooms[room] = carry(rel);
    }
  }
  const floors = (vdoc.floors || []).filter((f) => sets[f.id]);
  videosData = { floors, defaultFloor: sets[vdoc.defaultFloor] ? vdoc.defaultFloor : (floors[0] ? floors[0].id : Object.keys(sets)[0]), sets, ...(vdoc.land ? { land: vdoc.land } : {}) };
  for (const f of floors) {
    if (!f.panos) continue;
    const pdir = path.join(vdir, '..', f.panos);
    if (!fs.existsSync(pdir)) fail(`videos.json: floor ${f.id} names a panorama set ${f.panos} that does not exist under _local/`);
    const n = copyDir(pdir, path.join(OUT, 'panos-' + f.id), '.webp');
    if (n !== scenesDoc.scenes.length) fail(`floor ${f.id}: ${n} panoramas in ${f.panos}, the tour has ${scenesDoc.scenes.length}`);
    (floorSets = floorSets || {})[f.id] = { dir: 'panos-' + f.id };
  }
}

const data = {
  id,
  apartment: {
    id: apartment.id,
    status: apartment.status,
    project: apartment.project,
    title: apartment.title,
    defaultScene: apartment.defaultScene,
    plan: { image: apartment.plan.image, imageSize: apartment.plan.imageSize, viewBox: apartment.plan.viewBox,
      ...(Number.isFinite(apartment.plan.northDeg) ? { northDeg: apartment.plan.northDeg } : {}) }, // card Q09: the compass
  },
  scenes: scenesDoc.scenes.map((s) => ({
    id: s.id, name: s.name, zone: s.zone, asset: s.asset, plan: s.plan, heading: s.heading, hotspots: s.hotspots,
    // card Q08: the plan bearing the panorama's yaw 0 looks at, so a door can arrive facing the direction of travel
    ...(Number.isFinite(s.centreBearingDeg) ? { centreBearingDeg: s.centreBearingDeg } : {}),
    ...(s.exterior ? { exterior: true } : {}), // an exterior 360 node (the flyover chain, 2026-11-02): no plan pin, no look toggle
    ...(s.autoNext ? { autoNext: s.autoNext, autoDwellMs: s.autoDwellMs, ...(Number.isFinite(s.autoYaw) ? { autoYaw: s.autoYaw } : {}) } : {}), ...(s.hold ? { hold: true } : {}), // the automatic passages and the hold node
    ...(markersByScene ? { markers: markersByScene[s.id] || [] } : {}),
  })),
  copy: { badge: copy.badge, conceptLine: copy.conceptLine, aiNote: copy.aiNote, ui: copy.ui },
  panoWidth: apartment.sets.balanced.width,
  ...(withFull ? { fullSet: { dir: 'panos-full', width: apartment.sets.full.width, height: apartment.sets.full.height } } : {}), // T18g
  edits,
  ...(catalogItems ? { catalog: catalogItems } : {}),
  ...(tiles ? { tiles } : {}), // card Q06
  ...(originalSet ? { originalSet } : {}), // card Q09
  ...(videosData ? { videos: videosData } : {}), // Habait studio: the flyover intro + room clips per floor finish
  ...(floorSets ? { floorSets } : {}),
};
// the ruler (2026-11-03, Eliran: "למדוד מרחקים של כל דבר … שהמידות יהיו בהתאם לתכנית מכר"): per-scene equirect depth maps rendered from the
// plan-true furnished scene (360walkaround render_pano.py, rgb24-be centimetres, radial) in the panorama's own yaw frame → dist/depth/
if (fs.existsSync(path.join(APT, 'depth', 'depth.json'))) {
  const dj = JSON.parse(read(path.join(APT, 'depth', 'depth.json')));
  fs.mkdirSync(path.join(OUT, 'depth'), { recursive: true });
  const sc = {};
  for (const [sid, d] of Object.entries(dj.scenes)) { fs.copyFileSync(path.join(APT, 'depth', d.file), path.join(OUT, 'depth', d.file)); sc[sid] = d.file; }
  data.depth = { dir: 'depth', encoding: dj.encoding, scale: dj.scale, invalid: dj.invalid, scenes: sc };
}
// "מצב סיור" (2026-11-03): the guided tour's narration (apartments/<id>/guide/guide.json + audio) → dist/guide, data.guide
if (fs.existsSync(path.join(APT, 'guide', 'guide.json'))) {
  const gj = JSON.parse(read(path.join(APT, 'guide', 'guide.json')));
  for (const L of ['he', 'en', 'fr']) if (gj[L] && gj[L].steps) { fs.mkdirSync(path.join(OUT, 'guide', L), { recursive: true }); for (const st of gj[L].steps) { for (const k of ['audio', 'video']) { if (!st[k]) continue; const f = path.join(APT, st[k]); if (fs.existsSync(f)) fs.copyFileSync(f, path.join(OUT, st[k])); } } }
  data.guide = Object.fromEntries(['he', 'en', 'fr'].filter((L) => gj[L]).map((L) => [L, { name: gj[L].name, steps: gj[L].steps }]));
}
// board dollhouse-in-tour (2026-11-03): the apartment's 3D dollhouse (the platform's build_zip output for this unit,
// Habait/platform/_local/dist/<project>/<unit>/media/dollhouse.html: self-contained, offline) beside the tour -> dist/<id>/3d/,
// data.dollhouse; the tour's 3D button opens it. Exactly one match or none (then no button); --dollhouse <file> overrides.
{
  const unit = id.replace(/^apt/, '');
  // 2026-11-06 (Eliran: the 3D button was gone): platform/_local is gitignored, so a build in a .wt/ git worktree found no dollhouse and
  // silently shipped the tour without its 3D view (rounds aaed3d1..94e4ed7). The main checkout's copy is the fallback, and a build that
  // ships without one says so loudly.
  const local = path.join(ROOT, '..', 'platform', '_local', 'dist');
  const wt = path.resolve(local).match(/^(.*)[\\/]\.wt[\\/][^\\/]+[\\/](.*)$/);
  const pdist = [local, wt ? path.join(wt[1], wt[2]) : null].filter(Boolean).find((d) => fs.existsSync(d)) || local;
  const hits = argAfter('--dollhouse') ? [argAfter('--dollhouse')] : (fs.existsSync(pdist) ? fs.readdirSync(pdist).map((p) => path.join(pdist, p, unit, 'media', 'dollhouse.html')).filter((p) => fs.existsSync(p)) : []);
  if (!hits.length) console.warn(`build-tour: WARNING - no dollhouse for unit ${unit} (looked in ${pdist}): this tour ships WITHOUT its 3D view`);
  if (hits.length === 1 && fs.existsSync(hits[0])) {
    fs.mkdirSync(path.join(OUT, '3d'), { recursive: true });
    fs.copyFileSync(hits[0], path.join(OUT, '3d', 'dollhouse.html'));
    data.dollhouse = '3d/dollhouse.html';
  } else if (hits.length > 1) console.warn(`build-tour: ${hits.length} dollhouse files for unit ${unit}, none taken: pass --dollhouse <file>`);
}
const dataJson = JSON.stringify(data).replace(/</g, '\\u003c');

// 4. the page
const inlineJs = (src) => src.replace(/<\/script/gi, '<\\/script');
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
let html = read(path.join(VIEWER, 'template.html'));
if (withEngine) {
  if (!fs.existsSync(path.join(ENGINE, 'engine.js'))) fail('no engine bundle — run: timeout 540 npm --prefix Habait/tour360/engine run build');
  // the engine is one cacheable file beside the page, not inlined (674 KB); its CSS takes Pannellum's slot
  if (!html.includes('<script>/*__PANNELLUM_JS__*/</script>')) fail('template lost its Pannellum script tag');
  // board habait-walkaround T19d (re-check F-1): the first room's panorama starts downloading BEFORE the engine runs (680 KB of
  // script delayed tour.js's request by ~50 ms on the laptop, ~150 ms live) — the same request PSV makes later (fetch, same-origin,
  // credentials same-origin), so it is served from this preload; skipped when the page picks its picture set at load (--full)
  const preloadFirst = tiles
    // card Q06: a tiled build paints the first room from its six preview faces — those start downloading before the engine runs
    // (PSV fetches a cube's faces the same way it fetches a panorama: fetch, same-origin credentials), on every screen
    ? '<script>(function(){try{var d=JSON.parse(document.getElementById(\'tour-data\').textContent);'
      + 'var q=new URLSearchParams(location.search),by={};d.scenes.forEach(function(s){by[s.id]=s;});'
      + 'var s=by[q.get(\'room\')]||by[d.apartment.defaultScene]||d.scenes[0];var t=d.tiles.assets[s.asset];'
      + 'for(var f in t.preview){var l=document.createElement(\'link\');l.rel=\'preload\';l.as=\'fetch\';l.crossOrigin=\'anonymous\';'
      + 'l.href=d.tiles.dir+\'/\'+s.asset+\'/\'+t.preview[f];document.head.appendChild(l);}}catch(e){}})();</script>'
    : '<script>(function(){try{var d=JSON.parse(document.getElementById(\'tour-data\').textContent);if(d.fullSet)return;'
    + 'var q=new URLSearchParams(location.search),by={};d.scenes.forEach(function(s){by[s.id]=s;});'
    + 'var s=by[q.get(\'room\')]||by[d.apartment.defaultScene]||d.scenes[0];var l=document.createElement(\'link\');'
    + 'l.rel=\'preload\';l.as=\'fetch\';l.crossOrigin=\'anonymous\';l.href=\'panos/\'+s.asset+\'.webp\';document.head.appendChild(l);}catch(e){}})();</script>';
  html = html.split('<script>/*__PANNELLUM_JS__*/</script>').join(preloadFirst + '\n<script src="engine.js"></script>');
}
const parts = [
  ['/*__PANNELLUM_CSS__*/', withEngine ? read(path.join(ENGINE, 'engine.css')) : read(path.join(VIEWER, 'vendor', 'pannellum-2.5.6.css'))],
  ['/*__TOUR_CSS__*/', read(path.join(VIEWER, 'tour.css'))],
  ...(withEngine ? [] : [['/*__PANNELLUM_JS__*/', inlineJs(read(path.join(VIEWER, 'vendor', 'pannellum-2.5.6.js')))]]),
  ['/*__TOUR_JS__*/', inlineJs(read(path.join(VIEWER, 'tour.js')))],
  ['/*__EDIT_LIVE_JS__*/', inlineJs(read(path.join(VIEWER, 'edit-live.js')))],
  ['__TOUR_DATA__', dataJson],
  ['__TITLE__', escapeHtml(copy.ui.title.he + ' · ' + apartment.title.he)],
];
for (const [token, value] of parts) {
  if (!html.includes(token)) fail('template lost its placeholder ' + token);
  html = html.split(token).join(value);
}
fs.writeFileSync(path.join(OUT, 'index.html'), html);
if (withEngine) fs.copyFileSync(path.join(ENGINE, 'engine.js'), path.join(OUT, 'engine.js'));

// 4b. the live edit function (T09): api/edit.mjs + its handler; it answers 503 until the host carries the keys
fs.mkdirSync(path.join(OUT, 'api'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'server', 'handler.mjs'), path.join(OUT, 'api', '_handler.mjs'));
fs.copyFileSync(path.join(ROOT, 'server', 'chat-transport.mjs'), path.join(OUT, 'api', 'chat-transport.mjs')); // plan 2026-11-04-apt-furniture-swap: _handler imports it
fs.copyFileSync(path.join(ROOT, 'server', 'vercel-edit.mjs'), path.join(OUT, 'api', 'edit.mjs'));

// 5. hosting headers (Vercel static): noindex everywhere, a one-day cache on the media; the function's time ceiling
const vercel = {
  functions: { 'api/edit.mjs': { maxDuration: 300 } },
  headers: [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    },
    { source: tiles || originalSet ? `/(panos|panos-full|${tiles ? 'panos-tiles|' : ''}${originalSet ? 'panos-original|' : ''}thumbs|plan|fonts|catalog)/(.*)` : '/(panos|panos-full|thumbs|plan|fonts|catalog)/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate, s-maxage=86400' }] }, // the browser revalidates (a 304 per file), the edge keeps a day and is purged by every deploy — 2026-10-29: a day-old browser copy of unversioned tiles showed him the previous deploy after a redeploy
    { source: '/api/(.*)', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
  ],
};
fs.writeFileSync(path.join(OUT, 'vercel.json'), JSON.stringify(vercel, null, 2) + '\n');

// 6. report
let bytes = 0;
const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); const st = fs.statSync(p); if (st.isDirectory()) walk(p); else bytes += st.size; } };
walk(OUT);
const pageKb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`build-tour: ${id} → ${path.relative(process.cwd(), OUT)} · index.html ${pageKb} KB · ${data.scenes.length} scenes · ${nPanos} panos${withFull ? ' + ' + nFull + ' full' : ''}${tiles ? ` · tiles ${nTiles} (${(tileBytes / 1048576).toFixed(1)} MB)` : ''}${originalSet ? ` · ${nOriginal} original` : ''} · ${nPatches} patches · ${nThumbs} thumbs · ${nFonts} fonts · catalog ${catalogItems ? catalogItems.length + ' items' : 'none'} · markers ${markersByScene ? nMarkers + ' in ' + nMarkerScenes + ' scenes' : 'none'} · total ${(bytes / 1048576).toFixed(2)} MB`);
