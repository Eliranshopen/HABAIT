#!/usr/bin/env node
/* Habait Tour360 — smoke.mjs (T01, board habait-tour360) — the ONE eval for a built tour. Exits 1 on any failure.
   Checks: the data parses and links resolve · every asset exists in the apartment AND in dist · every panorama is exactly 2:1
   (read from its WebP header) · the built page carries the three permanent disclosure elements and the copy ×3 locales ·
   nothing off-site is referenced · the size budget · the noindex header · the prepared changes (edits.json): every patch
   exists, is the size it claims, sits inside its panorama, and the page carries the change panel and its copy ×3.
   With --catalog (T14d/T14e) it also checks the catalog build: the photos in dist hashed as items.json says, api/catalog.json,
   the inlined rows; without the flag it asserts a plain build carries none of it. The catalog copy keys are checked always.
   A tiled build (WALKAROUND-QUALITY-PLAN.md Q06, tools/make-tiles.mjs) is checked tile by tile: every scene's cube listed in the page
   data, its manifest in dist, every tile and preview face a 512×512 WebP, the source unchanged since the cut; tiles have their own
   budget (8 MB a scene) outside the page's.
   Usage (from the harness root, Git Bash):  timeout 300 node Habait/tour360/tools/smoke.mjs demo-01 [--catalog] */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const id = process.argv[2];
const withCatalog = process.argv.includes('--catalog');
if (!id || id.startsWith('--')) { console.error('usage: node Habait/tour360/tools/smoke.mjs <apartment-id> [--catalog]'); process.exit(2); }
const APT = path.join(ROOT, 'apartments', id);
const OUT = path.join(ROOT, 'dist', id);
const LANGS = ['he', 'en', 'fr'];
const withFull = process.argv.includes('--full'); // T18g: a --full build carries the 7K set (about 150 MB) beside the balanced one
const MAX_DIST_BYTES = (withFull ? 180 : 12) * 1024 * 1024;

const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); return ok; };
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

/** Width and height from a WebP header (VP8X, VP8L lossless or VP8 lossy); null when the file is not a WebP. */
function webpSize(buf) {
  if (buf.length < 30 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const fourcc = buf.toString('ascii', 12, 16);
  if (fourcc === 'VP8X') return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
  if (fourcc === 'VP8L') {
    if (buf[20] !== 0x2f) return null;
    const b = buf.readUInt32LE(21);
    return { w: (b & 0x3fff) + 1, h: ((b >>> 14) & 0x3fff) + 1 };
  }
  if (fourcc === 'VP8 ') {
    if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return null;
    return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
  }
  return null;
}

// 1. data
let apartment, scenesDoc, copy;
try {
  apartment = readJson(path.join(APT, 'apartment.json'));
  scenesDoc = readJson(path.join(APT, 'scenes.json'));
  copy = readJson(path.join(ROOT, 'copy', 'tour360-copy.json'));
} catch (e) {
  console.error('smoke: FAIL — data does not parse: ' + e.message);
  process.exit(1);
}
const scenes = scenesDoc.scenes || [];
const ids = new Set(scenes.map((s) => s.id));
check(scenes.length > 0, 'no scenes');
check(ids.size === scenes.length, 'scene ids are not unique');
check(ids.has(apartment.defaultScene), `defaultScene "${apartment.defaultScene}" is not a scene`);
let hotspots = 0;
const in01 = (x) => x === null || (typeof x === 'number' && x >= 0 && x <= 1);
for (const s of scenes) {
  check(LANGS.every((l) => s.name && s.name[l]), `${s.id}: name missing a language`);
  check(LANGS.every((l) => s.zone && s.zone[l]), `${s.id}: zone missing a language`);
  check(typeof s.heading === 'number', `${s.id}: heading is not a number`);
  check(in01(s.initialU ?? null), `${s.id}: initialU out of [0,1]`);
  // an exterior node (the project layer, 2026-11-02) has no position on the apartment plan; every room still must
  check(s.exterior === true || (s.plan && typeof s.plan.x === 'number' && typeof s.plan.y === 'number'), `${s.id}: plan x/y missing`);
  for (const h of s.hotspots || []) {
    hotspots += 1;
    check(ids.has(h.to), `${s.id} → ${h.to}: unknown target`);
    check(h.to !== s.id, `${s.id}: links to itself`);
    check(in01(h.u) && in01(h.v), `${s.id} → ${h.to}: u/v out of [0,1]`);
  }
}

// 2 + 3. assets in the apartment and in dist; panoramas exactly 2:1
const balancedDir = path.join(APT, apartment.sets.balanced.dir);
const thumbDir = path.join(APT, apartment.sets.thumb.dir);
let panos2to1 = 0;
for (const s of scenes) {
  const file = s.asset + '.webp';
  const src = path.join(balancedDir, file);
  if (check(fs.existsSync(src), `${s.id}: missing ${path.relative(ROOT, src)}`)) {
    const dim = webpSize(fs.readFileSync(src));
    if (check(dim !== null, `${s.id}: ${file} is not a readable WebP`) && check(dim.w === 2 * dim.h, `${s.id}: ${file} is ${dim.w}×${dim.h}, not 2:1`)) panos2to1 += 1;
  }
  check(fs.existsSync(path.join(thumbDir, file)), `${s.id}: missing thumbnail ${file}`);
  check(fs.existsSync(path.join(OUT, 'panos', file)), `${s.id}: ${file} not in dist/panos`);
  check(fs.existsSync(path.join(OUT, 'thumbs', file)), `${s.id}: ${file} not in dist/thumbs`);
}
check(fs.existsSync(path.join(APT, apartment.plan.image)), 'plan image missing in the apartment');
check(fs.existsSync(path.join(OUT, 'plan', path.basename(apartment.plan.image))), 'plan image missing in dist');

// 3b. the prepared changes (PLAN.md §9)
const CHANGE_KEYS = ['changeOpen', 'changeTitle', 'changeHint', 'changeExamples', 'changeSoon', 'changeScope', 'changeApplying', 'changeShowOriginal', 'changeShowChanges', 'changeReset', 'changeFailed',
  'changeType', 'changeApply', 'changeApplyingLive', 'changeApplyingSlow', 'changeRefusedScope', 'changeRefusedRealPerson', 'changeRefusedUnsafe', 'changeRefusedUnclear', 'changeCapReached', 'changeNoDiff', 'changeRetrying', 'changeReframed', 'changeLocked', 'changeUndo', 'changeLiveTag'];
const editsPath = path.join(APT, 'edits.json');
const editsDoc = fs.existsSync(editsPath) ? readJson(editsPath) : null;
let nEdits = 0;
if (editsDoc) {
  const PW = apartment.sets.balanced.width;
  const PH = apartment.sets.balanced.height;
  for (const key of CHANGE_KEYS) check(LANGS.every((l) => copy.ui[key] && copy.ui[key][l]), `copy pack lacks ui.${key} in a language`);
  for (const [sceneId, list] of Object.entries(editsDoc.scenes || {})) {
    check(ids.has(sceneId), `edits.json: unknown scene "${sceneId}"`);
    check(new Set(list.map((e) => e.id)).size === list.length, `${sceneId}: edit ids are not unique`);
    check(new Set(list.map((e) => e.order)).size === list.length, `${sceneId}: edit orders are not unique`);
    for (const e of list) {
      nEdits += 1;
      const tag = `${sceneId}/${e.id}`;
      check(/^[a-z0-9][a-z0-9-]*$/.test(e.id), `${tag}: the id must be lower-case letters, digits and dashes (it becomes part of a scene key)`);
      check(LANGS.every((l) => e.label && e.label[l]), `${tag}: label missing a language`);
      check([e.x, e.y, e.w, e.h].every(Number.isInteger) && e.x >= 0 && e.y >= 0 && e.w > 0 && e.h > 0 && e.x + e.w <= PW && e.y + e.h <= PH, `${tag}: the patch box leaves the ${PW}×${PH} panorama`);
      check(e.look && in01(e.look.u) && in01(e.look.v), `${tag}: look u/v out of [0,1]`);
      check(e.provenance && e.provenance.endpoint && e.provenance.prompt, `${tag}: no provenance (endpoint + prompt)`);
      const src = path.join(APT, 'panos', 'patches', e.patch);
      if (check(fs.existsSync(src), `${tag}: missing ${path.relative(ROOT, src)}`)) {
        const dim = webpSize(fs.readFileSync(src));
        check(dim !== null && dim.w === e.w && dim.h === e.h, `${tag}: ${e.patch} is ${dim ? dim.w + '×' + dim.h : 'unreadable'}, edits.json says ${e.w}×${e.h}`);
      }
      check(fs.existsSync(path.join(OUT, 'panos', 'patches', e.patch)), `${tag}: ${e.patch} not in dist/panos/patches`);
    }
  }
}

// 3c. the catalog (T14d/T14e): the copy keys always; with --catalog the photos, api/catalog.json and the rows; without, none of it
const CATALOG_KEYS = ['catalogTitle', 'catalogReplaceWith', 'catalogSee', 'catalogPriceAsOf', 'catalogNote', 'changeRefusedCatalog',
  'catalogTargetSofa', 'catalogTargetArmchair', 'catalogTargetCoffeeTable', 'catalogTargetDiningTable', 'catalogTargetChair',
  'catalogHint', 'catalogMarker', 'catalogChip']; // the last three: T16d (the tap mode's hint, the marker's name, the chip)
for (const key of CATALOG_KEYS) check(LANGS.every((l) => copy.ui[key] && copy.ui[key][l]), `copy pack lacks ui.${key} in a language`);
let nCatalog = 0, nMarkers = 0, nMarkerScenes = 0;
if (withCatalog) {
  const doc = readJson(path.join(ROOT, 'catalog', 'items.json'));
  for (const it of doc.items) {
    nCatalog += 1;
    const f = path.join(OUT, 'catalog', it.image);
    if (check(fs.existsSync(f), `catalog photo ${it.image} not in dist/catalog`)) check(crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex') === it.image_sha256, `dist/catalog/${it.image} does not hash as items.json says`);
  }
  const api = path.join(OUT, 'api', 'catalog.json');
  if (check(fs.existsSync(api), 'dist api/catalog.json missing')) {
    const a = readJson(api);
    check(Array.isArray(a.items) && a.items.length === nCatalog && a.items.every((x) => /^[a-f0-9]{64}$/.test(x.image_sha256) && x.description_en && x.category), 'api/catalog.json rows are incomplete');
  }
} else {
  check(!fs.existsSync(path.join(OUT, 'catalog')), 'a plain build must carry no dist/catalog');
  check(!fs.existsSync(path.join(OUT, 'api', 'catalog.json')), 'a plain build must carry no api/catalog.json');
}

// 4. the built page carries the disclosure
const pagePath = path.join(OUT, 'index.html');
let disclosureOk = 0;
if (check(fs.existsSync(pagePath), 'dist index.html missing — run build-tour.mjs first')) {
  const html = fs.readFileSync(pagePath, 'utf8');
  for (const elId of ['tour-badge', 'tour-concept', 'tour-ai-note']) {
    const re = new RegExp(`<[a-z]+[^>]*\\bid="${elId}"[^>]*>`, 'i');
    const tag = (html.match(re) || [''])[0];
    if (check(tag !== '', `page has no #${elId}`) && check(/data-permanent="true"/.test(tag), `#${elId} is not data-permanent="true"`)) disclosureOk += 1;
  }
  const m = html.match(/<script type="application\/json" id="tour-data">([\s\S]*?)<\/script>/);
  if (check(m !== null, 'page has no #tour-data')) {
    const data = JSON.parse(m[1]);
    for (const key of ['badge', 'conceptLine', 'aiNote']) {
      for (const l of LANGS) {
        check(data.copy && data.copy[key] && data.copy[key][l] === copy[key][l], `embedded copy ${key}.${l} differs from the copy pack`);
      }
    }
    check(data.scenes.length === scenes.length, 'embedded scene count differs');
    if (editsDoc) {
      const embedded = Object.values(data.edits || {}).reduce((n, l) => n + l.length, 0);
      check(embedded === nEdits, `embedded edits ${embedded} differ from edits.json ${nEdits}`);
      check(data.panoWidth === apartment.sets.balanced.width, 'embedded panoWidth differs from the balanced set');
      for (const elId of ['t-actions', 't-change-btn', 't-compare', 't-change', 't-change-list', 't-change-input', 't-change-note', 't-change-reset', 't-catalog-bar', 't-item-card', 't-pick', 't-pick-chip', 't-pick-close', 't-mk-hint']) {
        check(new RegExp(`\\bid="${elId}"`).test(html), `page has no #${elId}`);
      }
      check(!/\bid="t-catalog"/.test(html), 'the change sheet still carries the catalog strip (T16c: the catalog lives behind a ring only)');
    }
    if (withCatalog) check(Array.isArray(data.catalog) && data.catalog.length === nCatalog && data.catalog.every((x) => x.id && x.name && x.price && x.url && fs.existsSync(path.join(OUT, x.image))), 'embedded catalog rows differ from items.json or a photo is missing');
    else check(data.catalog === undefined, 'a plain build must embed no catalog');
    // 4b. the markers (T16a): with --catalog every scene carries its list, each marker a direction, a catalog category, outlines; a set its members
    if (withCatalog) {
      const mf = path.join(APT, 'markers.json');
      if (check(fs.existsSync(mf), 'markers.json missing — run scan-pieces first')) {
        const cats = new Set(readJson(path.join(ROOT, 'catalog', 'items.json')).items.map((x) => x.category));
        for (const s of data.scenes) {
          if (!check(Array.isArray(s.markers), `embedded scene ${s.id} carries no markers array`)) continue;
          if (s.markers.length) nMarkerScenes += 1;
          for (const mk of s.markers) {
            nMarkers += 1;
            check(Number.isFinite(mk.yaw) && Number.isFinite(mk.pitch) && Math.abs(mk.pitch) <= 90, `marker ${mk.id} has no finite direction`);
            check(cats.has(mk.category), `marker ${mk.id}: category ${mk.category} has no catalog item`);
            check(Array.isArray(mk.outlines) && mk.outlines.length >= 1 && mk.outlines.every((o) => Array.isArray(o) && o.length >= 3 && o.every((q) => Array.isArray(q) && q.length === 2 && q.every(Number.isFinite))), `marker ${mk.id} has no outline`);
            if (mk.count > 1 || mk.members) check(Array.isArray(mk.members) && mk.members.length >= 2 && mk.count === mk.members.length && mk.outlines.length === mk.members.length, `set ${mk.id} is not two members or more with their outlines`);
          }
        }
      }
    } else check(data.scenes.every((s) => s.markers === undefined), 'a plain build must embed no markers');
  }
  // 5. self-contained: no off-site src/href in the markup, no off-site url() in the styles
  const markup = html.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '');
  const offsite = [];
  for (const mm of markup.matchAll(/\b(?:src|href)\s*=\s*["']([^"']*)["']/gi)) if (/^(?:https?:)?\/\//i.test(mm[1].trim())) offsite.push(mm[1]);
  const styles = (html.match(/<style\b[\s\S]*?<\/style>/gi) || []).join('\n');
  for (const mm of styles.matchAll(/url\(\s*['"]?([^'")]+)/gi)) if (/^(?:https?:)?\/\//i.test(mm[1].trim())) offsite.push(mm[1]);
  // board habait-walkaround T17: an --engine build loads ONE same-origin script, engine.js, which must sit beside the page; any
  // other <script src> (a CDN, a second file) still fails
  const scriptSrcs = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']*)["']/gi)].map((m) => m[1]);
  const engineOk = scriptSrcs.length === 1 && scriptSrcs[0] === 'engine.js' && fs.existsSync(path.join(OUT, 'engine.js'));
  check(scriptSrcs.length === 0 || engineOk, 'an external <script src> is present: ' + scriptSrcs.join(', '));
  check(offsite.length === 0, 'off-site references: ' + offsite.slice(0, 3).join(', '));
  check(!/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?!\d)/i.test(html), 'the viewport disables zoom');
  check(/<meta name="robots" content="noindex, nofollow">/.test(html), 'the page lacks the robots noindex meta');
}

// 5b. the live edit function rides every build (T09): present, importing its handler, bounded, with no key in it
const fnPath = path.join(OUT, 'api', 'edit.mjs');
if (check(fs.existsSync(fnPath), 'dist api/edit.mjs missing') && check(fs.existsSync(path.join(OUT, 'api', '_handler.mjs')), 'dist api/_handler.mjs missing')) {
  const fn = fs.readFileSync(fnPath, 'utf8') + fs.readFileSync(path.join(OUT, 'api', '_handler.mjs'), 'utf8');
  check(/from '\.\/_handler\.mjs'/.test(fn), 'api/edit.mjs does not import ./_handler.mjs');
  check(/maxDuration:\s*300/.test(fn), 'api/edit.mjs has no maxDuration 300');
  check(!/(fal_[a-z0-9-]{10,}|sk-or-v1-[a-z0-9]{10,}|Key [A-Za-z0-9_:-]{20,})/i.test(fn), 'a key-shaped string sits in the function source');
  check(/TOUR_EDIT_CODE/.test(fn) && /timingSafeEqual/.test(fn), 'the unlock-code check is missing');
}
if (fs.existsSync(pagePath)) {
  const html = fs.readFileSync(pagePath, 'utf8');
  check(/id="t-change-apply"/.test(html) && /id="t-change-input"[^>]*\bdisabled\b/.test(html), 'the typed field must ship disabled with its apply button');
  check(/id="t-change-bar"[^>]*\bhidden\b/.test(html) && /id="t-bar-input"/.test(html) && /id="t-undo"[^>]*\bhidden\b/.test(html), 'the main-screen bar and the undo pill must ship hidden');
  check(/sessionStorage\.getItem\('tour360-edit-key'\)/.test(html), 'the live script is not inlined');
}

// 5c. the tiles (WALKAROUND-QUALITY-PLAN.md card Q06): a tiled build carries every scene's cube — each listed in the page data,
// its manifest beside it, every tile and preview face a 512×512 WebP, cut from the source the apartment still has; a plain build
// carries none. The tiles have their own budget (8 MB a scene: a 7680 cut is about 5), outside the page's.
const TILES_DIR = path.join(OUT, 'panos-tiles');
let nTileFiles = 0, tileBytes = 0, nTiledScenes = 0;
{
  const tdm0 = fs.existsSync(pagePath) ? fs.readFileSync(pagePath, 'utf8').match(/<script type="application\/json" id="tour-data">([\s\S]*?)<\/script>/) : null;
  const td0 = tdm0 ? JSON.parse(tdm0[1]) : {};
  if (td0.tiles) {
    check(td0.tiles.dir === 'panos-tiles' && td0.tiles.tileSize === 512 && td0.tiles.assets, 'the page data names no 512 px tile set in panos-tiles');
    check(/<script src="engine\.js">/.test(fs.readFileSync(pagePath, 'utf8')), 'tiles ride only an --engine build (Pannellum cannot draw them)');
    for (const s of scenes) {
      const a = td0.tiles.assets && td0.tiles.assets[s.asset];
      if (!check(a && Array.isArray(a.levels) && a.levels.length && a.preview, `${s.id}: the page data carries no tiles for ${s.asset}`)) continue;
      const mf = path.join(TILES_DIR, s.asset, 'tiles.json');
      if (!check(fs.existsSync(mf), `${s.id}: dist has no panos-tiles/${s.asset}/tiles.json`)) continue;
      const m = readJson(mf);
      check(JSON.stringify(m.levels.map((L) => [L.faceSize, L.nbTiles])) === JSON.stringify(a.levels.map((L) => [L.faceSize, L.nbTiles])), `${s.id}: the page's levels differ from the manifest's`);
      check((a.noMipmapFrom ?? null) === (m.noMipmapFrom ?? null), `${s.id}: the page's noMipmapFrom differs from the manifest's`);
      const src = path.join(APT, m.source.file);
      check(fs.existsSync(src) && crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex') === m.source.sha256, `${s.id}: the tiles were cut from a source that changed or is gone (${m.source.file})`);
      let bad = 0;
      const tileOk = (rel) => {
        const f = path.join(TILES_DIR, s.asset, rel);
        if (!fs.existsSync(f)) { bad++; return; }
        const buf = fs.readFileSync(f);
        const dim = webpSize(buf);
        // the header alone survives a truncated copy (mutate.mjs smoke-bad-tile proved it): the RIFF length must be the file's
        if (!dim || dim.w !== 512 || dim.h !== 512 || buf.readUInt32LE(4) + 8 !== buf.length) bad++;
        nTileFiles++; tileBytes += buf.length;
      };
      for (const f of m.faces) {
        for (const L of m.levels) {
          check(L.faceSize === L.nbTiles * 512 && (L.nbTiles & (L.nbTiles - 1)) === 0 && L.nbTiles <= 16, `${s.id}: level ${L.level} is not a power-of-two grid of 512 px tiles`);
          for (let r = 0; r < L.nbTiles; r++) for (let c = 0; c < L.nbTiles; c++) tileOk(`${f}/${L.level}/${r}_${c}.webp`);
        }
        if (!/^[a-z]+\/0\/0_0\.webp$/.test(m.preview.faces[f])) tileOk(m.preview.faces[f]);
        check(a.preview[f] === m.preview.faces[f], `${s.id}: the page's preview face ${f} differs from the manifest's`);
      }
      check(bad === 0, `${s.id}: ${bad} tile file(s) missing or not 512×512 WebP`);
      nTiledScenes++;
    }
    check(tileBytes > 0 && tileBytes <= scenes.length * 8 * 1048576, `the tiles are ${(tileBytes / 1048576).toFixed(1)} MB (budget ${scenes.length * 8} MB)`);
  } else {
    check(!fs.existsSync(TILES_DIR), 'a build without tiles in its page data carries a panos-tiles folder');
  }
  // card Q09: the original set (the plain CG renders) — every scene's picture 2:1 in dist when the page names it; none otherwise.
  // The compass: a north angle, when the apartment carries one, is a bearing in [0, 360)
  const ODIR = path.join(OUT, 'panos-original');
  if (td0.originalSet) {
    let ok = 0;
    for (const s of scenes) {
      const f = path.join(ODIR, s.asset + '.webp');
      const dim = fs.existsSync(f) ? webpSize(fs.readFileSync(f)) : null;
      if (check(dim && dim.w === 2 * dim.h, `${s.id}: panos-original/${s.asset}.webp is missing or not 2:1`)) ok++;
    }
    check(td0.originalSet.dir === 'panos-original' && ok === scenes.length, 'the original set is incomplete');
  } else {
    check(!fs.existsSync(ODIR), 'a build without an original set in its page data carries a panos-original folder');
  }
  if (td0.apartment && td0.apartment.plan && td0.apartment.plan.northDeg !== undefined) check(Number.isFinite(td0.apartment.plan.northDeg) && td0.apartment.plan.northDeg >= 0 && td0.apartment.plan.northDeg < 360, 'plan.northDeg is not a bearing in [0, 360)');
}

// 6. size budget + the noindex header
let bytes = 0;
const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (p === TILES_DIR) continue; const st = fs.statSync(p); if (st.isDirectory()) walk(p); else bytes += st.size; } };
if (fs.existsSync(OUT)) walk(OUT);
// the 12 MB budget was written for the apartment's own panoramas; each exterior node (2026-11-02) adds a balanced 2048 webp,
// its clay "original" and a thumb, about 2.2 MB measured on apt846 → 2.5 MB a node on top
const exteriorCount = scenes.filter((s) => s.exterior === true).length;
const maxDistBytes = MAX_DIST_BYTES + exteriorCount * 2.5 * 1048576;
check(bytes > 0 && bytes <= maxDistBytes, `dist is ${(bytes / 1048576).toFixed(2)} MB without the tiles (budget ${(maxDistBytes / 1048576).toFixed(1)} MB: ${MAX_DIST_BYTES / 1048576} + ${exteriorCount} exterior nodes × 2.5)`);
// T18g: a --full build carries one full panorama per scene and tells the page; a plain build carries none of it
const fullDir = path.join(OUT, 'panos-full');
const nFull = fs.existsSync(fullDir) ? fs.readdirSync(fullDir).filter((f) => f.endsWith('.webp')).length : 0;
const tdm = fs.readFileSync(pagePath, 'utf8').match(/<script type="application\/json" id="tour-data">([\s\S]*?)<\/script>/); const tdata = tdm ? JSON.parse(tdm[1]) : {};
check(withFull ? nFull === scenes.length && tdata.fullSet && tdata.fullSet.dir === 'panos-full' && tdata.fullSet.width > tdata.panoWidth : nFull === 0 && !tdata.fullSet, withFull ? `the full set: ${nFull} of ${scenes.length} panoramas, fullSet ${JSON.stringify(tdata.fullSet || null)}` : `a plain build carries the full set (${nFull} files)`);
const vercelPath = path.join(OUT, 'vercel.json');
if (check(fs.existsSync(vercelPath), 'dist vercel.json missing')) {
  const v = readJson(vercelPath);
  const all = (v.headers || []).flatMap((h) => h.headers || []);
  check(all.some((h) => h.key === 'X-Robots-Tag' && /noindex/.test(h.value)), 'vercel.json lacks the X-Robots-Tag noindex header');
  check(v.functions && v.functions['api/edit.mjs'] && v.functions['api/edit.mjs'].maxDuration === 300, 'vercel.json lacks the function ceiling for api/edit.mjs');
}

const summary = `${scenes.length} scenes · ${hotspots} hotspots · ${panos2to1}/${scenes.length} panoramas 2:1 · disclosure ${disclosureOk}/3 elements ×${LANGS.length} locales · ${nEdits} prepared changes · catalog ${withCatalog ? nCatalog + ' items' : 'none'} · markers ${withCatalog ? nMarkers + ' in ' + nMarkerScenes + ' scenes' : 'none'} · dist ${(bytes / 1048576).toFixed(2)} MB${withFull ? ' · full set ' + nFull : ''} · tiles ${nTiledScenes ? `${nTiledScenes}/${scenes.length} scenes, ${nTileFiles} files 512×512, ${(tileBytes / 1048576).toFixed(1)} MB` : 'none'}`;
if (failures.length) {
  console.error(`smoke ${id}: FAIL (${failures.length}) — ${summary}`);
  for (const f of failures) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log(`smoke ${id}: PASS — ${summary}`);
