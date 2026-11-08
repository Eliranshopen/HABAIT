#!/usr/bin/env node
// Builds the apartment sales page + the downloadable pack for one unit (card 23, D1b).
//
//   node tools/build_zip.mjs <project-dir> <unit> [--out <dir>] [--tour-apartment <dir>] [--glb <file>]
//                            [--legal <disclaimer.md|caption.json>] [--platform-root <url>] [--max-mb 25]
//   e.g. node tools/build_zip.mjs fixtures/rainbow 846 --out _local/dist/rainbow/846
//
// Inputs (read only): <project-dir>/{project.json,units.json,<logo>}; the unit's tour folder
// (default ../tour360/apartments/apt<unit>: apartment.json, scenes.json, plan.general.json, panos/balanced, _local/full);
// the dollhouse GLB (default ../engine/_local/apt<unit>/dollhouse/apt<unit>.glb, card 09; picked up automatically when it
// exists, otherwise a clay placeholder is extruded from plan.general.json); the legal caption
// (C:\RnD\Projects\Habait\data\sales-plans\legal\disclaimer-he-en.md, or a caption JSON next to it when one exists).
// Output (<out>): index.html (the standalone page), apartment.json (manifest), assets/ (page code), media/ (panos, stills,
// plan, GLB, dollhouse.html), <unit>.zip (panos, stills, plan, GLB, offline dollhouse HTML, README-he-en.txt). No network.
// sharp comes from HABAIT_APP_DIR (C:/RnD/Projects/Habait/tools/appdeps).
import { readFile, writeFile, mkdir, copyFile, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve, join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLATFORM = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HABAIT = resolve(PLATFORM, '..');
const DEFAULT_LEGAL_DIR = process.env.HABAIT_LEGAL_DIR || 'C:/RnD/Projects/Habait/data/sales-plans/legal';
const STILL_W = 1600;
const STILL_H = 1000;
const STILL_HFOV = 84;

// ---------------- args ----------------
function parseArgs(argv) {
  const pos = [];
  const opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2); const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; opt[k] = v; }
    else pos.push(a);
  }
  return { pos, opt };
}

// ---------------- sharp ----------------
function loadSharp() {
  const dirs = [process.env.HABAIT_APP_DIR, 'C:/RnD/Projects/Habait/tools/appdeps', PLATFORM].filter(Boolean);
  for (const d of dirs) {
    try { return createRequire(join(d, 'package.json'))('sharp'); } catch { /* next */ }
  }
  throw new Error('sharp not found; set HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps');
}

// ---------------- legal caption ----------------
// disclaimer-he-en.md: "## 1." = short (video caption / viewer line / still margin), "## 2." = full (landing page, about, ZIP README);
// inside each, a "**עברית**" block and an "**English**" block of "> " lines.
export function parseDisclaimerMd(md) {
  const section = (n) => {
    const m = md.split(/\n(?=## )/).find((s) => s.startsWith(`## ${n}.`));
    if (!m) throw new Error(`disclaimer: section ${n} not found`);
    return m;
  };
  const blocks = (sec) => {
    const out = {};
    const parts = sec.split(/\n\*\*(עברית|English)\*\*\s*\n/);
    for (let i = 1; i < parts.length; i += 2) {
      const key = parts[i] === 'עברית' ? 'he' : 'en';
      const lines = parts[i + 1].split('\n').filter((l) => l.startsWith('>')).map((l) => l.replace(/^>\s?/, '').replace(/\*\*/g, '').trim()).filter(Boolean);
      out[key] = lines.join('\n');
    }
    if (!out.he || !out.en) throw new Error('disclaimer: missing he/en block');
    return out;
  };
  const status = (/\*\*סטטוס:\*\*\s*([^.(]+(?:\([^)]*\))?)/.exec(md) || [])[1]?.trim() || null;
  return { short: blocks(section(1)), full: blocks(section(2)), status };
}

export function fillVars(text, vars) {
  return text.replace(/\{([A-Z_]+)\}/g, (all, k) => (vars[k] !== undefined && vars[k] !== null && vars[k] !== '' ? String(vars[k]) : all));
}

async function loadLegal(file) {
  const dir = file && !file.endsWith('.md') && !file.endsWith('.json') ? file : (file ? dirname(file) : DEFAULT_LEGAL_DIR);
  const candidates = file && (file.endsWith('.md') || file.endsWith('.json')) ? [file]
    : ['caption.json', 'disclaimer-he-en.json', 'disclaimer.json', 'disclaimer-he-en.md'].map((f) => join(dir, f));
  for (const c of candidates) {
    if (!existsSync(c)) continue;
    const txt = await readFile(c, 'utf8');
    if (c.endsWith('.json')) {
      const j = JSON.parse(txt);
      if (j.short?.he && j.full?.he) return { short: j.short, full: j.full, status: j.status || null, source: c };
      continue;
    }
    return { ...parseDisclaimerMd(txt), source: c };
  }
  throw new Error(`legal caption not found (looked in ${dir})`);
}

// ---------------- equirect -> perspective stills ----------------
function bilinear(src, sw, sh, u, v, out, o) {
  let x = u * sw - 0.5;
  let y = v * sh - 0.5;
  if (y < 0) y = 0; else if (y > sh - 1) y = sh - 1;
  const x0 = Math.floor(x); const y0 = Math.floor(y);
  const fx = x - x0; const fy = y - y0;
  const xa = ((x0 % sw) + sw) % sw; const xb = (xa + 1) % sw;
  const ya = y0; const yb = Math.min(y0 + 1, sh - 1);
  for (let c = 0; c < 3; c++) {
    const p00 = src[(ya * sw + xa) * 3 + c]; const p10 = src[(ya * sw + xb) * 3 + c];
    const p01 = src[(yb * sw + xa) * 3 + c]; const p11 = src[(yb * sw + xb) * 3 + c];
    out[o + c] = (p00 * (1 - fx) + p10 * fx) * (1 - fy) + (p01 * (1 - fx) + p11 * fx) * fy;
  }
}

// yaw 0 = the centre of the equirect (u = 0.5), positive to the right; pitch positive up (README "Angles")
export function perspectiveFromEquirect(src, sw, sh, { yawDeg, pitchDeg = 0, hfovDeg = STILL_HFOV, width = STILL_W, height = STILL_H }) {
  const out = new Uint8Array(width * height * 3);
  const tx = Math.tan((hfovDeg * Math.PI) / 360);
  const ty = (tx * height) / width;
  const yaw = (yawDeg * Math.PI) / 180;
  const pit = (pitchDeg * Math.PI) / 180;
  const cp = Math.cos(pit); const sp = Math.sin(pit);
  for (let j = 0; j < height; j++) {
    const y = (1 - (2 * (j + 0.5)) / height) * ty;
    for (let i = 0; i < width; i++) {
      const x = ((2 * (i + 0.5)) / width - 1) * tx;
      const y1 = y * cp + sp; const z1 = -y * sp + cp; // pitch about x
      const lon = yaw + Math.atan2(x, z1);
      const lat = Math.atan2(y1, Math.hypot(x, z1));
      let u = 0.5 + lon / (2 * Math.PI);
      u -= Math.floor(u);
      const v = 0.5 - lat / Math.PI;
      bilinear(src, sw, sh, u, v, out, (j * width + i) * 3);
    }
  }
  return out;
}

// the view with the most detail (edges) in the middle band, a mild preference for the pano's centre (how the skins were framed)
async function pickYaw(sharp, file, hfovDeg = STILL_HFOV) {
  const W = 512; const H = 256;
  const { data } = await sharp(file).resize(W, H, { fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const col = new Float64Array(W);
  for (let y = Math.round(H * 0.3); y < Math.round(H * 0.72); y++) {
    for (let x = 0; x < W; x++) {
      const p = data[y * W + x];
      col[x] += Math.abs(p - data[y * W + ((x + 1) % W)]) + Math.abs(p - data[(y + 1) * W + x]);
    }
  }
  const half = Math.round((W * hfovDeg) / 360 / 2);
  let best = { yaw: 0, score: -1 };
  for (let yaw = -180; yaw < 180; yaw += 15) {
    const c = Math.round((0.5 + yaw / 360) * W);
    let s = 0;
    for (let d = -half; d <= half; d++) s += col[(((c + d) % W) + W) % W];
    s *= 1 + 0.12 * Math.cos((yaw * Math.PI) / 180);
    if (s > best.score) best = { yaw, score: s };
  }
  return best.yaw;
}

const xmlEsc = (s) => String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));

// the short caption as a strip under an image (Hebrew right-aligned inside RLE...PDF so librsvg/pango keeps the RTL order)
function captionSvg(width, he, en) {
  const pad = Math.round(width * 0.012);
  const fit = (txt, max) => Math.max(10, Math.min(max, Math.floor((width - 2 * pad) / (txt.length * 0.5))));
  const fh = fit(he, 19); const fe = fit(en, 17);
  const h = Math.round(fh * 1.5 + fe * 1.5 + pad * 1.4);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}">
<rect width="100%" height="100%" fill="#0b1220"/>
<text x="${width - pad}" y="${Math.round(pad * 0.6 + fh * 1.15)}" font-family="Segoe UI, Arial, sans-serif" font-size="${fh}" fill="#f4f6fb" text-anchor="end">\u202B${xmlEsc(he)}\u202C</text>
<text x="${pad}" y="${Math.round(pad * 0.6 + fh * 1.5 + fe * 1.15)}" font-family="Segoe UI, Arial, sans-serif" font-size="${fe}" fill="#b8c0cf">${xmlEsc(en)}</text>
</svg>`;
  return { svg: Buffer.from(svg), height: h };
}

async function withCaption(sharp, input, width, height, legalShort) {
  const cap = captionSvg(width, legalShort.he, legalShort.en);
  return sharp({ create: { width, height: height + cap.height, channels: 3, background: '#0b1220' } })
    .composite([{ input, top: 0, left: 0 }, { input: cap.svg, top: height, left: 0 }]);
}

// ---------------- placeholder GLB from plan.general.json ----------------
function signedArea(p) { let a = 0; for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i]; const [x2, y2] = p[(i + 1) % p.length]; a += x1 * y2 - x2 * y1; } return a / 2; }
function cleanRing(p) {
  const out = [];
  for (const q of p) { const l = out[out.length - 1]; if (!l || Math.hypot(l[0] - q[0], l[1] - q[1]) > 0.5) out.push(q); }
  if (out.length > 1 && Math.hypot(out[0][0] - out.at(-1)[0], out[0][1] - out.at(-1)[1]) <= 0.5) out.pop();
  return out;
}
export function earclip(pts) {
  const n = pts.length;
  if (n < 3) return [];
  let idx = [...Array(n).keys()];
  if (signedArea(pts) < 0) idx.reverse();
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
  const inTri = (p, a, b, c) => {
    const d1 = cross(a, b, p); const d2 = cross(b, c, p); const d3 = cross(c, a, p);
    return d1 > 0 && d2 > 0 && d3 > 0;
  };
  const tris = [];
  let guard = 0;
  while (idx.length > 3 && guard++ < 10000) {
    let cut = false;
    for (let i = 0; i < idx.length; i++) {
      const a = idx[(i - 1 + idx.length) % idx.length]; const b = idx[i]; const c = idx[(i + 1) % idx.length];
      if (cross(pts[a], pts[b], pts[c]) <= 1e-9) continue;
      let blocked = false;
      for (const j of idx) if (j !== a && j !== b && j !== c && inTri(pts[j], pts[a], pts[b], pts[c])) { blocked = true; break; }
      if (blocked) continue;
      tris.push([a, b, c]); idx.splice(i, 1); cut = true; break;
    }
    if (!cut) { // degenerate (collinear run / self-touching trace): drop the flattest vertex and go on
      let k = 0; let best = Infinity;
      for (let i = 0; i < idx.length; i++) {
        const a = idx[(i - 1 + idx.length) % idx.length]; const b = idx[i]; const c = idx[(i + 1) % idx.length];
        const v = Math.abs(cross(pts[a], pts[b], pts[c]));
        if (v < best) { best = v; k = i; }
      }
      idx.splice(k, 1);
    }
  }
  if (idx.length === 3) tris.push(idx);
  return tris;
}

export function placeholderGlb(plan) {
  const S = 0.01; // cm -> m; plan x right, y down -> three x right, z toward the viewer (no mirror seen from above)
  const groups = { walls: [], floor: [], outdoor: [] };
  const tri = (g, a, b, c) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    if (g !== 'walls' && ny < 0) { [b, c] = [c, b]; nx = -nx; ny = -ny; nz = -nz; } // caps face up
    groups[g].push([a, b, c, [nx, ny, nz]]);
  };
  for (const w of plan.walls || []) {
    const ring = cleanRing(w.polygon_cm || []);
    if (ring.length < 3) continue;
    const h = (w.height_cm || 290) * S;
    for (let i = 0; i < ring.length; i++) {
      const [x1, y1] = ring[i]; const [x2, y2] = ring[(i + 1) % ring.length];
      const a = [x1 * S, 0, y1 * S]; const b = [x2 * S, 0, y2 * S]; const c = [x2 * S, h, y2 * S]; const d = [x1 * S, h, y1 * S];
      tri('walls', a, b, c); tri('walls', a, c, d);
    }
    for (const [i, j, k] of earclip(ring)) tri('walls', [ring[i][0] * S, h, ring[i][1] * S], [ring[j][0] * S, h, ring[j][1] * S], [ring[k][0] * S, h, ring[k][1] * S]);
  }
  for (const r of plan.rooms || []) {
    const ring = cleanRing(r.loop || []);
    if (ring.length < 3) continue;
    const g = r.is_outdoor ? 'outdoor' : 'floor';
    for (const [i, j, k] of earclip(ring)) tri(g, [ring[i][0] * S, 0, ring[i][1] * S], [ring[j][0] * S, 0, ring[j][1] * S], [ring[k][0] * S, 0, ring[k][1] * S]);
  }
  const mats = {
    walls: { name: 'clay-walls', pbrMetallicRoughness: { baseColorFactor: [0.91, 0.89, 0.85, 1], metallicFactor: 0, roughnessFactor: 0.9 }, doubleSided: true },
    floor: { name: 'clay-floor', pbrMetallicRoughness: { baseColorFactor: [0.78, 0.69, 0.56, 1], metallicFactor: 0, roughnessFactor: 0.8 }, doubleSided: true },
    outdoor: { name: 'clay-terrace', pbrMetallicRoughness: { baseColorFactor: [0.6, 0.63, 0.65, 1], metallicFactor: 0, roughnessFactor: 0.9 }, doubleSided: true },
  };
  const json = { asset: { version: '2.0', generator: 'habait platform tools/build_zip.mjs (placeholder clay massing from plan.general.json)' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: 'apartment-placeholder' }], meshes: [{ name: 'apartment', primitives: [] }], materials: [], buffers: [], bufferViews: [], accessors: [] };
  const chunks = [];
  let offset = 0;
  let triangles = 0;
  for (const [g, list] of Object.entries(groups)) {
    if (!list.length) continue;
    triangles += list.length;
    const pos = new Float32Array(list.length * 9); const nor = new Float32Array(list.length * 9);
    const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity];
    list.forEach(([a, b, c, n], t) => {
      [a, b, c].forEach((p, k) => {
        for (let d = 0; d < 3; d++) { pos[t * 9 + k * 3 + d] = p[d]; nor[t * 9 + k * 3 + d] = n[d]; min[d] = Math.min(min[d], p[d]); max[d] = Math.max(max[d], p[d]); }
      });
    });
    const mi = json.materials.push(mats[g]) - 1;
    const addView = (arr) => { const buf = Buffer.from(arr.buffer); chunks.push(buf); json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: buf.length, target: 34962 }); offset += buf.length; return json.bufferViews.length - 1; };
    const pv = addView(pos); const nv = addView(nor);
    const pa = json.accessors.push({ bufferView: pv, componentType: 5126, count: list.length * 3, type: 'VEC3', min, max }) - 1;
    const na = json.accessors.push({ bufferView: nv, componentType: 5126, count: list.length * 3, type: 'VEC3' }) - 1;
    json.meshes[0].primitives.push({ attributes: { POSITION: pa, NORMAL: na }, material: mi });
  }
  const bin = Buffer.concat(chunks);
  json.buffers.push({ byteLength: bin.length });
  let jbuf = Buffer.from(JSON.stringify(json), 'utf8');
  if (jbuf.length % 4) jbuf = Buffer.concat([jbuf, Buffer.alloc(4 - (jbuf.length % 4), 0x20)]);
  const bpad = bin.length % 4 ? Buffer.concat([bin, Buffer.alloc(4 - (bin.length % 4))]) : bin;
  const header = Buffer.alloc(12); header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + jbuf.length + 8 + bpad.length, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(jbuf.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bpad.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  return { glb: Buffer.concat([header, jh, jbuf, bh, bpad]), triangles };
}

// ---------------- the offline dollhouse HTML ----------------
export function glbUsesDraco(glb) {
  try {
    const n = glb.readUInt32LE(12);
    const j = JSON.parse(glb.subarray(20, 20 + n).toString('utf8'));
    return (j.extensionsUsed || []).includes('KHR_draco_mesh_compression');
  } catch { return false; }
}
const b64url = (txt) => `data:text/javascript;base64,${Buffer.from(txt, 'utf8').toString('base64')}`;
// card 09's floor variants (<apt>-<floor>.glb): same BIN chunk, only the interior floor material differs -> its factors
export function floorMaterialOf(glb) {
  const n = glb.readUInt32LE(12);
  const j = JSON.parse(glb.subarray(20, 20 + n).toString('utf8'));
  const m = (j.materials || []).find((x) => /^web_floor_/.test(x.name || '') && !/outdoor|wet/.test(x.name));
  if (!m) return null;
  const p = m.pbrMetallicRoughness || {};
  return { material: m.name, color: (p.baseColorFactor || [1, 1, 1]).slice(0, 3).map((v) => +v.toFixed(5)), roughness: p.roughnessFactor ?? 1, metalness: p.metallicFactor ?? 1 };
}
// Board apartment-3d, card 03: the rooms the dollhouse labels and lets the buyer tap. One entry per plan room:
// Hebrew/English name and area from plan.general.json, the tour scene from its camera_points (cp-<scene> -> room_id),
// and that pano point in plan cm (= GLB metres x 100, the 2.25 px/cm frame minimap.test proves).
export function roomsForDollhouse(plan, scenesJson) {
  const sceneIds = new Set((scenesJson?.scenes || []).filter((s) => !s.exterior).map((s) => s.id));
  return (plan?.rooms || []).map((r) => {
    const cp = (plan.camera_points || []).find((c) => c.room_id === r.id);
    const scene = cp ? cp.id.replace(/^cp-/, '') : null;
    return {
      room_id: r.id, he: r.name_he || r.name_en || r.id, en: r.name_en || r.id,
      area_m2: typeof r.area_m2 === 'number' ? +r.area_m2.toFixed(2) : null, outdoor: !!r.is_outdoor,
      scene: scene && sceneIds.has(scene) ? scene : null, x_cm: cp ? cp.x : null, y_cm: cp ? cp.y : null,
    };
  });
}
const binChunkHash = (glb) => { const n = glb.readUInt32LE(12); return createHash('sha256').update(glb.subarray(20 + n + 8)).digest('hex'); };

// Card 10: the 3D tab. `#defer` in the URL = prepare (GLB + Draco decode) now, mount the WebGL view when the tab is shown
// (the apartment page preloads the hidden tab while the buyer is in the tour). `#lang=en`, `#floor=<id>`, `#preset=top`.
// Messages from the parent page: { type: 'habait:3d-show' }, { type: 'habait:floor', floor }, { type: 'habait:preset', preset }.
async function dollhouseHtml({ glb, title, legal, placeholder, lang = 'he', floors = null, defaultFloor = null, rooms = [], light = null, floorTex = null }) {
  const three = join(PLATFORM, 'node_modules/three');
  const read = (p) => readFile(join(three, p), 'utf8');
  const gltfSrc = (await read('examples/jsm/loaders/GLTFLoader.js')).replace("'../utils/BufferGeometryUtils.js'", "'three/addons/utils/BufferGeometryUtils.js'");
  const imports = {
    three: b64url(await read('build/three.module.min.js')),
    'three/addons/loaders/GLTFLoader.js': b64url(gltfSrc),
    'three/addons/controls/OrbitControls.js': b64url(await read('examples/jsm/controls/OrbitControls.js')),
    'three/addons/utils/BufferGeometryUtils.js': b64url(await read('examples/jsm/utils/BufferGeometryUtils.js')),
    'three/addons/loaders/DRACOLoader.js': b64url(await read('examples/jsm/loaders/DRACOLoader.js')),
    'three/addons/environments/RoomEnvironment.js': b64url(await read('examples/jsm/environments/RoomEnvironment.js')),
    'habait/apartment-3d.js': b64url(await readFile(join(PLATFORM, 'js/apartment-3d.js'), 'utf8')),
    // board transition-rise: the room's depth mesh for the rise / dive (loaded by the viewer only when a move plays)
    'habait/depthmesh.js': b64url(await readFile(join(PLATFORM, 'js/depthmesh.js'), 'utf8')),
  };
  // the glTF-only Draco decoder (wrapper + wasm), inlined only when the GLB needs it (card 09's Blender export does)
  const needsDraco = glbUsesDraco(glb);
  const draco = needsDraco ? {
    wrapper: (await readFile(join(three, 'examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js'))).toString('base64'),
    wasm: (await readFile(join(three, 'examples/jsm/libs/draco/gltf/draco_decoder.wasm'))).toString('base64'),
  } : null;
  const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  const paras = (t) => t.split('\n').map((p) => `<p>${esc(p)}</p>`).join('');
  return `<!doctype html>
<html lang="${lang}" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title.he)} · 3D</title>
<!-- Offline: three.js 0.170.0 + GLTFLoader/OrbitControls/DRACOLoader + the Habait viewer are inlined as data: modules, the GLB (and the Draco decoder when needed) as base64. No network. -->
<style>
/* board apartment-3d card 05: the tour's light, warm palette (cream to warm grey) behind a transparent canvas */
html,body{margin:0;height:100%;background:#efe9e0;color:#1d1a16;font-family:system-ui,'Segoe UI',Arial,sans-serif;overflow:hidden}
body{background:radial-gradient(120% 90% at 50% 38%,#fbf8f3 0%,#f1ebe2 52%,#ddd4c8 100%) fixed}
#v{position:fixed;inset:0;touch-action:none}
.top{position:fixed;top:0;inset-inline:0;display:flex;gap:8px;align-items:center;padding:10px 12px;background:linear-gradient(rgba(251,248,243,.9),transparent);font-weight:700}
.badge{font-size:11px;font-weight:600;padding:3px 8px;border-radius:999px;background:rgba(242,169,0,.18);color:#8a5d00;border:1px solid rgba(242,169,0,.5)}
.cap{position:fixed;inset-inline:0;bottom:0;padding:8px 12px calc(8px + env(safe-area-inset-bottom,0px));font-size:11.5px;line-height:1.4;background:rgba(251,248,243,.86);color:#4a433b;border-top:1px solid rgba(29,26,22,.1);max-height:45vh;overflow:auto}
.cap p{margin:0 0 4px}.cap summary{cursor:pointer;text-decoration:underline}
.err{position:fixed;inset:40% 10% auto;text-align:center}
body.embedded .top{display:none}
#ui{position:fixed;top:44px;inset-inline:0;display:flex;justify-content:center;pointer-events:none}
body.embedded #ui{top:10px}
@media (min-width:900px){#ui{top:8px}} /* card 05: on a wide screen the bar sits on the title row, the model gets the room */
.cap .pill{display:none}
/* board apartment-3d card 04: embedded, the caption is a pill with the legal text's own first sentence; a tap opens the
   full short text (both languages) and the full notice, word for word */
body.embedded .cap{inset-inline-end:auto;inset-inline-start:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));max-width:calc(100% - 20px);padding:4px 11px;border-radius:999px;font-size:11.5px;max-height:none;background:rgba(20,16,10,.62);color:#fff;cursor:pointer;z-index:4}
body.embedded .cap>.pill{display:block;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
body.embedded .cap>p:not(.pill),body.embedded .cap>details{display:none}
body.embedded .cap.open{inset-inline-end:10px;border-radius:14px;padding:10px 12px;max-height:60vh;overflow:auto;background:rgba(20,16,10,.9)}
body.embedded .cap.open>.pill{display:none}body.embedded .cap.open>p:not(.pill),body.embedded .cap.open>details{display:block}
body.embedded .dh-sheet{bottom:calc(44px + env(safe-area-inset-bottom,0px))}
.dh-presets{display:inline-flex;gap:4px;padding:4px;border-radius:999px;background:rgba(29,26,22,.72);backdrop-filter:blur(6px);box-shadow:0 2px 10px rgba(29,26,22,.18);pointer-events:auto}
.dh-presets button{font:inherit;font-size:14px;font-weight:600;color:#f4f6fb;background:transparent;border:0;border-radius:999px;padding:8px 14px;min-height:36px;cursor:pointer}
.dh-presets button[aria-pressed=true]{background:#fbf8f3;color:#1d1a16}
.dh-labels{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.dh-label{position:absolute;left:0;top:0;transform:translate(-50%,-50%);display:inline-flex;align-items:baseline;gap:5px;padding:5px 10px;border-radius:999px;border:0;background:rgba(255,255,255,.92);color:#1d1a16;font:600 13px/1.2 system-ui,'Segoe UI',Arial,sans-serif;white-space:nowrap;box-shadow:0 1px 6px rgba(20,16,10,.22);pointer-events:auto;cursor:pointer;transition:opacity .18s}
.dh-label .a{font-weight:500;font-size:12px;color:#6b6358}
.dh-label[hidden]{display:none}
@media (max-width:520px){.dh-label{font-size:12px;padding:4px 8px;gap:4px}.dh-label .a{font-size:11px}}
.dh-label.mini{font-size:10.5px;padding:2px 6px;gap:3px;box-shadow:0 1px 4px rgba(29,26,22,.14)}.dh-label.mini .a{font-size:10px}.dh-label.bare .a{display:none}
.dh-label.sel{background:#1d1a16;color:#fff}.dh-label.sel .a{color:#d9d2c6}
.dh-sheet{position:absolute;inset-inline:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));max-width:420px;margin-inline:auto;display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;background:rgba(255,255,255,.97);color:#1d1a16;box-shadow:0 6px 24px rgba(20,16,10,.25);font-family:system-ui,'Segoe UI',Arial,sans-serif;z-index:3}
.dh-sheet[hidden]{display:none}
.dh-sheet .t{flex:1;min-width:0}.dh-sheet .t b{display:block;font-size:16px}.dh-sheet .t span{font-size:13px;color:#6b6358}
.dh-sheet .go{font:inherit;font-weight:700;font-size:14px;border:0;border-radius:999px;padding:10px 16px;background:#1d1a16;color:#fff;cursor:pointer;white-space:nowrap}
.dh-sheet .x{font:inherit;font-size:20px;line-height:1;border:0;background:transparent;color:#6b6358;cursor:pointer;padding:4px 6px}
</style>
<script type="importmap">
${JSON.stringify({ imports }, null, 0)}
</script>
</head>
<body>
<div id="v"></div>
<div id="ui"></div>
<div class="top"><span>${esc(title.he)}</span>${placeholder ? '<span class="badge">מודל זמני · placeholder</span>' : ''}</div>
<div class="cap">
  <p class="pill">${esc(String(legal.short.he).split(/(?<=[.!?])\s/)[0])}</p>
  <p>${esc(legal.short.he)}</p>
  <p dir="ltr" lang="en">${esc(legal.short.en)}</p>
  <details><summary>הכיתוב המשפטי המלא · Full legal notice</summary>${paras(legal.full.he)}<div dir="ltr" lang="en">${paras(legal.full.en)}</div></details>
</div>
<script type="application/octet-stream" id="glb">${glb.toString('base64')}</script>
${light ? `<script type="application/octet-stream" id="lightmap">${light.full.toString('base64')}</script>
${light.phone ? `<script type="application/octet-stream" id="lightmap-phone">${light.phone.toString('base64')}</script>\n` : ''}${floorTex ? Object.entries(floorTex.files).map(([id, buf]) => `<script type="application/octet-stream" id="floortex-${id}">${buf.toString('base64')}</script>\n`).join('') + `<script type="application/json" id="floortexinfo">${JSON.stringify({ ids: Object.keys(floorTex.files), tile_m: floorTex.tile_m })}</script>\n` : ''}<script type="application/json" id="lightinfo">${JSON.stringify({ scale: light.scale, px: light.px })}</script>
` : ''}${draco ? `<script type="application/octet-stream" id="draco-wrapper">${draco.wrapper}</script>
<script type="application/octet-stream" id="draco-wasm">${draco.wasm}</script>` : ''}
<script type="application/json" id="floors">${JSON.stringify({ floors, default: defaultFloor })}</script>
<script type="application/json" id="rooms">${JSON.stringify(rooms).replace(/</g, '\\u003c')}</script>
<script>if (window.self !== window.top) document.body.classList.add('embedded');
document.querySelector('.cap').addEventListener('click', (e) => { if (e.target.tagName !== 'SUMMARY') e.currentTarget.classList.toggle('open'); });</script>
<script type="module">
import { mountDollhouse, prepareDollhouse, base64ToArrayBuffer } from 'habait/apartment-3d.js';
window.__dollhouse = { loaded: false, prepared: false };
const opt = new URLSearchParams(location.hash.slice(1));
const F = JSON.parse(document.getElementById('floors').textContent || '{}');
const ROOMS = JSON.parse(document.getElementById('rooms')?.textContent || '[]');
const embedded = window.self !== window.top;
const want = { floor: opt.get('floor') || F.default || null, preset: opt.get('preset') || '3d', show: !opt.has('defer') };
let view = null;
let mounting = null;
let insetsLast = { top: 0, bottom: 0 };
let hideGen = 0;
const shown = () => window.innerWidth > 0 && window.innerHeight > 0;
// messages from the apartment page (same window parent only)
window.addEventListener('message', (e) => {
  if (e.source !== window.parent || !e.data || typeof e.data !== 'object') return;
  const d = e.data;
  if (d.type === 'habait:3d-show') { want.show = true; go(); }
  // board transition-rise (gate D1): the tour closed its 3D layer -> a dive in flight is dropped, its enter-room never posted
  if (d.type === 'habait:3d-hide') hideGen++;
  if (d.type === 'habait:floor' && typeof d.floor === 'string') { want.floor = d.floor; if (view) view.setFloor(d.floor); }
  if (d.type === 'habait:preset' && typeof d.preset === 'string') { want.preset = d.preset; if (view) view.setPreset(d.preset); }
  // board transition-rise: the tour's scenes (pano, depth, bearing0, heading per scene; eye; its opening hfov) and the rise
  if (d.type === 'habait:scenes' && d.scenes && typeof d.scenes === 'object') want.scenes = d;
  if (d.type === 'habait:rise' && typeof d.scene === 'string') { want.rise = d; doRise(); }
  // board dollhouse-in-tour: the 360 tour says where the buyer stands and looks -> the room's camera point + the view cone
  if (d.type === 'habait:you-are-here' && typeof d.scene === 'string') { want.here = { scene: d.scene, bearing: +d.bearing || 0, fov: +d.fov || 90 }; applyHere(); }
});
window.addEventListener('resize', () => { if (shown() && opt.has('defer')) { want.show = true; go(); } });
// tell the page we listen now (messages sent while this document was still parsing are lost); it answers with the floor
if (window.parent !== window) window.parent.postMessage({ type: 'habait:3d-ready' }, '*');
// board dollhouse-in-tour (gate D1): Esc inside the 3D with no room selected asks the page around it to close its 3D layer (the
// tour's; the apartment page ignores it). With a room selected, Esc first closes that room's sheet (apartment-3d.js); this
// listener is registered before the viewer's, so it still sees the selection on that first press.
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && window.parent !== window && !(view && view.stats.selected)) window.parent.postMessage({ type: 'habait:escape' }, '*'); });
// board transition-rise: the move's spec for a scene (its camera point from ROOMS, its pano + depth from the tour)
function specFor(sceneId, view3) {
  const sc = want.scenes && want.scenes.scenes && want.scenes.scenes[sceneId];
  const r = ROOMS.find((x) => x.scene === sceneId && Number.isFinite(x.x_cm) && Number.isFinite(x.y_cm));
  if (!sc || !r || !sc.pano || !sc.depth || !Number.isFinite(sc.bearing0)) return null;
  return { pano: sc.pano, depth: sc.depth, x_cm: r.x_cm, y_cm: r.y_cm, eye: want.scenes.eye || 1.6, bearing0: sc.bearing0, ...view3 };
}
function doRise() {
  if (!view || !want.rise) return;
  const d = want.rise; want.rise = null;
  const spec = specFor(d.scene, { yaw: +d.yaw || 0, pitch: Number.isFinite(+d.pitch) ? +d.pitch : -2, hfov: +d.hfov || 100 });
  const ready = () => window.parent.postMessage({ type: 'habait:rise-ready', scene: d.scene }, '*');
  if (!spec) { ready(); return; }
  view.rise(spec, { onFirstFrame: ready }).then((r) => window.parent.postMessage({ type: 'habait:rise-done', result: r }, '*')).catch(() => ready());
}
let hereScene = null;
function applyHere() {
  if (!view || !want.here) return;
  const r = ROOMS.find((x) => x.scene === want.here.scene && Number.isFinite(x.x_cm) && Number.isFinite(x.y_cm));
  view.setHere(r ? { x_cm: r.x_cm, y_cm: r.y_cm, bearingDeg: want.here.bearing, fovDeg: want.here.fov, room_id: r.room_id } : null);
  // the buyer arrived in the room the sheet offers (the tour went there): the "view in 360" sheet for it is noise -> close it.
  // Only the tour sends you-are-here; the apartment page's 3D tab keeps its selection across its 360 trip (card 04).
  if (r && want.here.scene !== hereScene) {
    hereScene = want.here.scene;
    if (view.stats.selected === r.room_id) view.select(null);
  }
}
let prepared = null;
async function go() {
  if (!prepared || !want.show || mounting) return;
  mounting = mountDollhouse(document.getElementById('v'), {
    prepared, ui: document.getElementById('ui'), lang: opt.get('lang') === 'en' ? 'en' : 'he',
    floors: F.floors, floor: want.floor, preset: want.preset, rooms: ROOMS, touchScroll: embedded,
    // card 05: the model is framed between the preset bar and the caption, never under them
    insets: () => {
      const bar = document.querySelector('.dh-presets');
      const cap = document.querySelector('.cap');
      const top = bar ? bar.getBoundingClientRect().bottom + 6 : 0;
      const bottom = cap && !cap.classList.contains('open') ? Math.max(0, window.innerHeight - cap.getBoundingClientRect().top) + 6 : (insetsLast.bottom || 0);
      insetsLast = { top, bottom };
      return insetsLast;
    },
    // the 360 tour lives on the apartment page, so "view in 360" exists only when embedded there
    // (board dollhouse-in-tour: also inside the 360 tour's 3D layer)
    // board transition-rise: inside the tour (it sent its scenes) the camera first dives into that room's opening view
    onEnterRoom: embedded ? async (r) => {
      const sc = want.scenes && want.scenes.scenes && want.scenes.scenes[r.scene];
      const spec = sc ? specFor(r.scene, { yaw: +sc.heading || 0, pitch: -2, hfov: +want.scenes.hfov || 100 }) : null;
      let dove = false;
      const gen = hideGen;
      // the hand-off never waits on the move: 5 s at most (a slow load, a superseded move), then the plain switch
      if (spec && view) { try { const r2 = await Promise.race([view.dive(spec), new Promise((ok) => setTimeout(() => ok(null), 5000))]); dove = !!(r2 && view.stats.held); } catch (e) { /* the plain switch */ } }
      if (gen !== hideGen) return; // the layer was closed during the dive (gate D1)
      window.parent.postMessage({ type: 'habait:enter-room', scene: r.scene, room_id: r.room_id, dove }, '*');
    } : null,
  });
  try {
    view = await mounting;
    window.__dollhouse = view.stats;
    window.__dollhouseView = view;
    window.__dollhouseSelect = (id) => view.select(id);
    window.__dollhouseSpecFor = specFor; // tests: the move's spec for a scene + view
    applyHere();
    doRise();
  } catch (e) {
    console.error(e);
    window.__dollhouse = { loaded: false, error: String(e && e.message || e) };
  }
}
try {
  const b64 = (id) => document.getElementById(id)?.textContent;
  const draco = b64('draco-wasm') ? { wrapper: new TextDecoder().decode(base64ToArrayBuffer(b64('draco-wrapper'))), wasm: base64ToArrayBuffer(b64('draco-wasm')) } : null;
  // board apartment-3d card 08: the baked light (light.webp, a phone copy below 1.5 DPR or <= 4 GB), when inlined
  const LI = JSON.parse(document.getElementById('lightinfo')?.textContent || 'null');
  const lowEnd = (window.devicePixelRatio || 1) < 1.5 || (navigator.deviceMemory && navigator.deviceMemory <= 4);
  const lmId = lowEnd && b64('lightmap-phone') ? 'lightmap-phone' : 'lightmap';
  const lightmap = LI && b64(lmId) ? base64ToArrayBuffer(b64(lmId)) : null;
  // board apartment-3d card 08b: the floors' real finish from the tour's panoramas, one small tile per finish
  const FT = JSON.parse(document.getElementById('floortexinfo')?.textContent || 'null');
  const floorTextures = FT ? Object.fromEntries(FT.ids.map((id) => [id, base64ToArrayBuffer(b64('floortex-' + id))])) : null;
  prepared = await prepareDollhouse({ glb: base64ToArrayBuffer(b64('glb')), draco, lightmap, lightScale: LI && LI.scale, floorTextures, floorTileM: FT && FT.tile_m, floorDefault: want.floor });
  window.__dollhouse = { loaded: false, prepared: true, prepare_ms: prepared.prepare_ms };
  if (!want.show && shown() && document.visibilityState === 'visible' && window.self === window.top) want.show = true;
  await go();
} catch (e) {
  console.error(e);
  window.__dollhouse = { loaded: false, error: String(e && e.message || e) };
  const p = document.createElement('p'); p.className = 'err'; p.textContent = 'WebGL / 3D: ' + window.__dollhouse.error; document.body.appendChild(p);
}
</script>
</body>
</html>
`;
}

// ---------------- main ----------------
const pickL = (o, l) => (o == null ? '' : typeof o === 'string' ? o : o[l] || o.en || o.he || '');
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const today = () => new Date().toISOString().slice(0, 10);

export async function build({ projectDir, unitId, out, tourApartment, glbPath, legalPath, platformRoot = 'http://127.0.0.1:8850/', maxMb = 25, log = console.log }) {
  const t0 = Date.now();
  const sharp = loadSharp();
  const project = JSON.parse(await readFile(join(projectDir, 'project.json'), 'utf8'));
  const unitsDoc = JSON.parse(await readFile(join(projectDir, project.units || 'units.json'), 'utf8'));
  const unit = unitsDoc.units.find((u) => String(u.id) === String(unitId));
  if (!unit) throw new Error(`unit ${unitId} not in ${project.units || 'units.json'}`);
  const aptId = `apt${unit.id}`;
  const tourDir = tourApartment || join(HABAIT, 'tour360/apartments', aptId);
  const glbDefault = join(HABAIT, 'engine/_local', aptId, 'dollhouse', `${aptId}.glb`);
  const glbSrc = glbPath || glbDefault;

  await mkdir(out, { recursive: true });
  for (const d of ['media', 'assets']) await rm(join(out, d), { recursive: true, force: true });
  for (const d of ['media/panos', 'media/stills', 'assets/js/vendor', 'assets/css']) await mkdir(join(out, d), { recursive: true });

  // tour folder (optional pieces: a unit without a tour still gets a page)
  const readJ = async (p) => (existsSync(p) ? JSON.parse(await readFile(p, 'utf8')) : null);
  const aptJson = await readJ(join(tourDir, 'apartment.json'));
  const scenesJson = await readJ(join(tourDir, 'scenes.json'));
  const plan = await readJ(join(tourDir, 'plan.general.json'));
  const pm = plan?.plan_meta || {};
  const planDate = pm.plan_date || (/(\d{1,2}\.\d{1,2}\.\d{4})/.exec(`${pm.source_file || ''} ${aptJson?.projectNote || ''}`) || [])[1] || null;
  const architect = pm.architect || (/\(([A-Z][\w&.\- ]*Architects)/.exec(aptJson?.projectNote || '') || [])[1] || null;

  // legal caption, variables filled per language
  const legalSrc = await loadLegal(legalPath);
  const version = `0.1.${today().replace(/-/g, '')}`;
  const vars = (l) => ({
    DEVELOPER: pickL(project.developer, l), PROJECT: pickL(project.name, l), UNIT: unit.id, PLAN_DATE: planDate,
    ARCHITECT: architect, GEN_DATE: today(), VERSION: version,
  });
  const legal = {
    short: { he: fillVars(legalSrc.short.he, vars('he')), en: fillVars(legalSrc.short.en, vars('en')) },
    full: { he: fillVars(legalSrc.full.he, vars('he')), en: fillVars(legalSrc.full.en, vars('en')) },
    status: legalSrc.status ? `${legalSrc.status}, ממתין לחוות דעת עו״ד / pending legal review` : null,
    source: legalSrc.source.replace(/\\/g, '/'),
  };
  const zipFilesList = [];
  const addZip = (name, data) => zipFilesList.push({ name, data });

  // panoramas (balanced set, the apartment's own scenes only: the apartment layer has no exterior nodes)
  const interior = (scenesJson?.scenes || []).filter((s) => !s.exterior);
  const holdId = ((scenesJson?.scenes || []).find((s) => s.exterior && s.hold) || {}).id || null; // the tour's "building, pick an apartment" node
  const balancedDir = join(tourDir, aptJson?.sets?.balanced?.dir || 'panos/balanced');
  const fullDir = join(tourDir, aptJson?.sets?.full?.dir || '_local/full');
  const panos = [];
  const stills = [];
  for (const s of interior) {
    const file = join(balancedDir, `${s.asset}.webp`);
    if (!existsSync(file)) { log(`warn  no balanced pano for ${s.id} (${s.asset})`); continue; }
    const buf = await readFile(file);
    await writeFile(join(out, 'media/panos', `${s.asset}.webp`), buf);
    addZip(`panos/${s.asset}.webp`, buf);
    panos.push({ id: s.id, name: s.name, src: `media/panos/${s.asset}.webp` });
    // still: a rectilinear crop from the best source (the 3840 master when present), short caption burned under it
    const srcFile = existsSync(join(fullDir, `${s.asset}.webp`)) ? join(fullDir, `${s.asset}.webp`) : file;
    const yaw = await pickYaw(sharp, srcFile);
    const { data, info } = await sharp(srcFile).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const px = perspectiveFromEquirect(data, info.width, info.height, { yawDeg: yaw, pitchDeg: -4 });
    const view = await sharp(Buffer.from(px.buffer), { raw: { width: STILL_W, height: STILL_H, channels: 3 } }).png().toBuffer();
    let img = await withCaption(sharp, view, STILL_W, STILL_H, legal.short);
    const exifText = `${legal.short.en} | plan ${planDate || '-'} | AI-assisted`;
    try { img = img.withExif({ IFD0: { ImageDescription: exifText.replace(/[^\x20-\x7e]/g, ''), Copyright: 'Habait (illustration only)' } }); } catch { /* older sharp */ }
    const jpg = await img.jpeg({ quality: 84, mozjpeg: true }).toBuffer();
    await writeFile(join(out, 'media/stills', `${s.asset}.jpg`), jpg);
    addZip(`stills/${s.asset}.jpg`, jpg);
    stills.push({ id: s.id, name: s.name, src: `media/stills/${s.asset}.jpg`, yaw, source: basename(dirname(srcFile)) });
  }

  // plan: the traced sales-plan crop as PNG, caption strip under it
  let planOut = null;
  const planImg = aptJson?.plan?.image ? join(tourDir, aptJson.plan.image) : null;
  if (planImg && existsSync(planImg)) {
    const meta = await sharp(planImg).metadata();
    const flat = await sharp(planImg).flatten({ background: '#ffffff' }).png().toBuffer();
    const png = await (await withCaption(sharp, flat, meta.width, meta.height, legal.short)).png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer();
    await writeFile(join(out, 'media/plan.png'), png);
    addZip(`plan/plan-${unit.id}.png`, png);
    planOut = { src: 'media/plan.png', width: meta.width, height: meta.height, date: planDate, architect, source_sha256: pm.source_sha256 || null, source: pm.source_file || null };
  } else log('warn  no plan image');

  // GLB: card 09's dollhouse when it exists, else the clay placeholder from the traced plan.
  // Card 10: card 09's floor variants (<apt>-<floor>.glb, neutral furniture colours) win over the first export when present;
  // the tour's floors (videos.json floors / defaultFloor) name them. The variants must share one BIN chunk (geometry).
  const videosJson = await readJ(join(tourDir, 'videos.json'));
  const tourFloors = (videosJson?.floors || []).map((f) => ({ id: f.id, name: f.name }));
  const dollDir = dirname(glbDefault);
  const variants = {};
  for (const f of tourFloors) { const p = join(dollDir, `${aptId}-${f.id}.glb`); if (existsSync(p)) variants[f.id] = p; }
  const defaultFloor = (videosJson?.defaultFloor && variants[videosJson.defaultFloor]) ? videosJson.defaultFloor : Object.keys(variants)[0] || null;
  let floors = null;
  let floorNote = null;
  if (defaultFloor) {
    floors = {};
    const hashes = new Set();
    for (const [id, p] of Object.entries(variants)) {
      const b = await readFile(p);
      hashes.add(binChunkHash(b));
      const fm = floorMaterialOf(b);
      if (fm) floors[id] = { ...fm, name: tourFloors.find((f) => f.id === id)?.name || id, glb: basename(p) };
    }
    if (hashes.size !== 1) { log(`warn  floor GLBs differ in geometry (${hashes.size} BIN chunks): floor switch disabled`); floors = null; }
    else floorNote = `${Object.keys(floors).length} floor GLBs, one BIN chunk: the switch applies each GLB's floor material`;
  }
  const glbPick = glbPath || (defaultFloor && variants[defaultFloor]) || glbDefault;
  let glb; let glbInfo;
  if (existsSync(glbPick)) {
    glb = await readFile(glbPick);
    glbInfo = { placeholder: false, source: glbPick.replace(/\\/g, '/'), floors: floors && glbPick !== glbPath ? floors : null, default_floor: floors ? defaultFloor : null, floor_note: floorNote };
  } else if (plan) {
    const ph = placeholderGlb(plan);
    glb = ph.glb;
    glbInfo = { placeholder: true, source: `placeholder: walls + floors extruded from ${aptId}/plan.general.json (card 09 GLB not found at ${glbDefault.replace(/\\/g, '/')})`, triangles: ph.triangles };
  }
  let glbOut = null;
  if (glb) {
    const name = `${aptId}.glb`;
    await writeFile(join(out, 'media', name), glb);
    addZip(`3d/${name}`, glb);
    const title = { he: `דירה ${unit.id} · ${pickL(project.name, 'he')}`, en: `Apartment ${unit.id} · ${pickL(project.name, 'en')}` };
    const rooms = glbInfo.placeholder ? [] : roomsForDollhouse(plan, scenesJson);
    // board apartment-3d card 08: the baked light beside the picked GLB (export_dollhouse --bake-light) is inlined when the
    // GLB carries the UVs it was baked on; without it nothing changes (the Phase 1 look)
    let light = null;
    const lightP = join(dirname(glbInfo.placeholder ? glbDefault : glbPick), 'light.webp');
    if (!glbInfo.placeholder && existsSync(lightP)) {
      const hasUv = glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8').includes('TEXCOORD_0');
      const rep = await readJ(join(dirname(lightP), 'report.json'));
      const scale = rep?.bake?.scale;
      if (!hasUv || !scale) log(`warn  ${basename(lightP)} found but ${!hasUv ? 'the GLB has no UVs' : 'report.json has no bake.scale'}: baked light skipped`);
      else {
        const phoneP = join(dirname(lightP), 'light-1024.webp');
        // the 1024 phone copy rides along only while both atlases stay inside the card's page budget (base64 <= 450 KB)
        const full = await readFile(lightP);
        const phone = existsSync(phoneP) ? await readFile(phoneP) : null;
        const fits = phone && ((full.length + phone.length) * 4) / 3 <= 450 * 1024;
        light = { full, phone: fits ? phone : null, phone_available: !!phone, scale, px: rep.bake.res };
        glbInfo.light = { src: basename(lightP), bytes: light.full.length, phone_bytes: light.phone ? light.phone.length : 0, scale };
      }
    }
    // card 08b: floor-<finish>.webp + floor-textures.json beside the GLB (floor_textures.py): the floors' real finish,
    // taken from the tour's panoramas; only with the baked light (the textures are de-lit)
    let floorTex = null;
    const ftJson = await readJ(join(dirname(glbInfo.placeholder ? glbDefault : glbPick), 'floor-textures.json'));
    if (light && ftJson && ftJson.finishes) {
      const ids = Object.keys(glbInfo.floors || {}).filter((id) => ftJson.finishes[id] && existsSync(join(dirname(glbPick), ftJson.finishes[id].file)));
      if (ids.length) {
        floorTex = { tile_m: ftJson.tile_m, files: {} };
        for (const id of ids) floorTex.files[id] = await readFile(join(dirname(glbPick), ftJson.finishes[id].file));
        glbInfo.floor_textures = Object.fromEntries(ids.map((id) => [id, floorTex.files[id].length]));
      }
    }
    const html = await dollhouseHtml({ glb, title, legal, placeholder: glbInfo.placeholder, floors: glbInfo.floors || null, defaultFloor: glbInfo.default_floor || null, rooms, light, floorTex });
    glbInfo.rooms = rooms.length;
    await writeFile(join(out, 'media/dollhouse.html'), html);
    addZip('3d/dollhouse.html', html);
    glbOut = { src: `media/${name}`, html: 'media/dollhouse.html', bytes: glb.length, sha256: sha256(glb), ...glbInfo };
  }

  // Card 10: the minimap. card 09's top.png (plan-up ortho view) -> a small cut, + plan cm -> pixel for every interior scene
  // (cameras.json px / pxPerCm = plan.general.json cm = GLB metres x 100). The top camera comes from report.json `top`, or,
  // when a later export overwrote it (apt846: the marble run wrote top: null), from the GLB bounds with the exporter's
  // own formula; either way it is checked against the alpha bbox of top.png (<= 4 px) before it is used.
  let minimapOut = null;
  const topPng = join(dollDir, 'top.png');
  const camerasJson = await readJ(join(tourDir, 'cameras.json'));
  if (glb && !glbInfo.placeholder && existsSync(topPng) && camerasJson && scenesJson) {
    const mm = await import('../js/minimap.js');
    const report = await readJ(join(dollDir, 'report.json'));
    const { data: px, info } = await sharp(topPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let u0 = info.width; let v0 = info.height; let u1 = -1; let v1 = -1;
    for (let v = 0; v < info.height; v++) for (let u = 0; u < info.width; u++) if (px[(v * info.width + u) * info.channels + 3] > 8) { if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v; }
    const bounds = mm.glbBounds(mm.glbJson(glb));
    let map = mm.topMapFromReport(report?.top);
    let source = 'report.json top';
    const fromBounds = mm.topMapFromBounds(bounds, { W: info.width, H: info.height });
    if (!map) { map = fromBounds; source = 'GLB bounds + export_dollhouse.py render_top formula (report.json top is null)'; }
    else if (['cx', 'cy', 's'].every((k) => Math.abs(map[k] - fromBounds[k]) < 1e-3)) {
      // export_dollhouse.py rounds report.json `top` to 4 decimals; the GLB formula is exact. When the two agree to a
      // millimetre, keep the exact one so manifest `top` matches the GLB bounds (card 10, 2026-11-02 fix after M1).
      map = fromBounds; source = 'GLB bounds (report.json top agrees to <1e-3 m, exact value kept)';
    }
    const [pu0, pv0] = mm.planCmToTopPx(bounds.min[0] * 100, bounds.min[2] * 100, map);
    const [pu1, pv1] = mm.planCmToTopPx(bounds.max[0] * 100, bounds.max[2] * 100, map);
    const dev = Math.max(Math.abs(pu0 - u0), Math.abs(pu1 - (u1 + 1)), Math.abs(pv0 - v0), Math.abs(pv1 - (v1 + 1)));
    if (dev > 4) log(`warn  minimap: top.png alpha bbox is ${dev.toFixed(1)} px off the GLB bounds: minimap skipped`);
    else {
      const margin = 24;
      const x0 = Math.max(0, u0 - margin); const y0 = Math.max(0, v0 - margin);
      const cw = Math.min(info.width, u1 + 1 + margin) - x0; const ch = Math.min(info.height, v1 + 1 + margin) - y0;
      const k = Math.min(1, 640 / Math.max(cw, ch));
      const ow = Math.round(cw * k); const oh = Math.round(ch * k);
      const webp = await sharp(topPng).extract({ left: x0, top: y0, width: cw, height: ch }).resize(ow, oh).webp({ quality: 82, alphaQuality: 90 }).toBuffer();
      await writeFile(join(out, 'media/top.webp'), webp);
      minimapOut = mm.buildMinimapData({
        cameras: camerasJson, scenes: scenesJson, map, crop: { x0, y0, k: ow / cw }, img: 'media/top.webp', size: [ow, oh],
        source: { top: source, alpha_check_px: +dev.toFixed(2), cameras: `cameras.json at / ${camerasJson.plan?.pxPerCm || 2.25} = plan cm` },
      });
      minimapOut.bytes = webp.length;
    }
  }

  // logo (white-label)
  let logo = null;
  if (project.brand?.logo && existsSync(join(projectDir, project.brand.logo))) {
    logo = `media/${basename(project.brand.logo)}`;
    await copyFile(join(projectDir, project.brand.logo), join(out, logo));
  }

  const projectOut = {
    id: project.id, name: project.name, tagline: project.tagline, developer: project.developer,
    brand: { ...(project.brand || {}), logo }, leads: { whatsapp_number: project.leads?.whatsapp_number || '', agent: project.leads?.agent || null, email: project.leads?.email || null },
    exterior: project.exterior || null, fixture: !!project.fixture, currency: unitsDoc.currency || 'ILS',
  };
  // card 24: the analytics block reaches the standalone page (apartment.js -> initAnalytics({ config: P.analytics }));
  // allowlisted keys only, empty values dropped. No posthog_key = the page never loads the PostHog adapter.
  const ANALYTICS_KEYS = ['posthog_key', 'posthog_host', 'posthog_transport', 'whatsapp_viewed_line', 'lead_secret'];
  const analyticsOut = Object.fromEntries(ANALYTICS_KEYS.filter((k) => project.analytics?.[k] !== undefined && project.analytics[k] !== '' && project.analytics[k] !== null).map((k) => [k, project.analytics[k]]));
  if (Object.keys(analyticsOut).length) projectOut.analytics = analyticsOut;
  const posthogOn = typeof analyticsOut.posthog_key === 'string' && /^phc_/.test(analyticsOut.posthog_key);
  // the manifest the page reads (paths relative to <out>)
  const manifest = {
    schema: 'habait.apartment-page.v0',
    generated: new Date().toISOString(), version,
    project: projectOut,
    unit: { ...unit, currency: unitsDoc.currency || 'ILS', hotspots: undefined, segments: undefined },
    tour: { url: unit.tour_url || null, scope: 'apartment', rooms: interior.length, hold: holdId },
    back: { url: (await import('../js/apartment.js')).backToBuildingUrl({ ...project, id: project.id }, { platformRoot, hold: holdId }) },
    plan: planOut, panos, stills, glb: glbOut, minimap: minimapOut, legal,
    zip: null,
  };

  // README for the pack (full disclaimer + plan date + plan hash)
  const L = (k, he, en) => `${he} / ${en}: ${k ?? '-'}`;
  const readme = [
    `${pickL(project.name, 'he')} · דירה ${unit.id}    |    ${pickL(project.name, 'en')} · apartment ${unit.id}`,
    '='.repeat(72),
    L(unit.floor, 'קומה', 'Floor'), L(unit.rooms, 'חדרים', 'Rooms'), L(unit.area_m2, 'שטח מ״ר', 'Area m²'), L(unit.outdoor_m2, 'מרפסת מ״ר', 'Outdoor m²'),
    L(unit.type, 'טיפוס', 'Type'), L(planDate, 'תאריך תכנית המכר', 'Sales-plan date'), L(architect, 'אדריכל', 'Architect'),
    L(pm.source_sha256, 'sha256 של התכנית ששימשה', 'sha256 of the plan used'), L(today(), 'הופק', 'Produced'), L(version, 'גרסה', 'Version'),
    '',
    'תוכן / Contents:',
    '  panos/      פנורמות 360 (equirect 2:1, balanced) / 360 panoramas',
    '  stills/     תמונות מתוך הפנורמות, עם הכיתוב / stills cropped from the panoramas, captioned',
    '  plan/       תכנית הדירה (PNG) / the apartment plan',
    `  3d/         ${glbOut?.placeholder ? 'מודל זמני (placeholder) / temporary model' : 'בית בובות / dollhouse'}: ${aptId}.glb + dollhouse.html (נפתח בלי אינטרנט / opens offline)`,
    '',
    '-'.repeat(72),
    legal.full.he,
    '',
    '-'.repeat(72),
    legal.full.en,
    '',
    legal.status ? `סטטוס הכיתוב / Notice status: ${legal.status}` : '',
    '',
  ].join('\r\n');
  addZip('README-he-en.txt', '\ufeff' + readme);
  addZip('unit.json', JSON.stringify({ project: projectOut.id, project_name: project.name, unit: manifest.unit, plan: planOut, glb: glbOut && { ...glbOut, src: `3d/${aptId}.glb`, html: '3d/dollhouse.html' }, legal_status: legal.status, generated: manifest.generated, version }, null, 2));

  // the ZIP
  const { zipFiles } = await import('../js/zip.js');
  const zipName = `${unit.id}.zip`;
  const zipBytes = await zipFiles(zipFilesList, { comment: `Habait · ${project.id} · ${unit.id} · ${version}` });
  await writeFile(join(out, zipName), zipBytes);
  const mb = zipBytes.length / 1048576;
  manifest.zip = { src: zipName, name: `${project.id}-${unit.id}.zip`, bytes: zipBytes.length, files: zipFilesList.length, sha256: sha256(zipBytes) };
  await writeFile(join(out, 'apartment.json'), JSON.stringify(manifest, null, 2));

  // the standalone page: apartment.html with its code under assets/ and the manifest baked in
  let page = await readFile(join(PLATFORM, 'apartment.html'), 'utf8');
  page = page.replaceAll('href="css/', 'href="assets/css/').replaceAll('href="fonts/', 'href="assets/fonts/').replace('src="js/apartment.js"', 'src="assets/js/apartment.js"')
    .replace('<!--HABAIT_APT_CONFIG-->', '<script>window.__HABAIT_APT = { manifest: "apartment.json" };</script>');
  await writeFile(join(out, 'index.html'), page);
  const jsFiles = ['apartment.js', 'i18n.js', 'analytics.js', 'lead.js', 'config.js', 'zip.js', 'minimap.js', 'vendor/jszip-3.10.2.min.js'];
  // card 24 (T2 review defect 2): the PostHog adapter + the vendored SDK ship only when a key is configured
  if (posthogOn) jsFiles.push('posthog-adapter.js', 'vendor/posthog-js-1.444.2.module.slim.no-external.js', 'vendor/posthog-js-1.444.2.LICENSE.txt');
  for (const f of jsFiles) await copyFile(join(PLATFORM, 'js', f), join(out, 'assets/js', f));
  for (const f of ['style.css', 'apartment.css']) await copyFile(join(PLATFORM, 'css', f), join(out, 'assets/css', f));
  // platform-ui-ux (rnd-23, 2026-11-03): style.css @imports tokens.css, the page links components.css, and tokens.css loads
  // ../fonts/*.woff2 -> ship them beside the page (assets/css, assets/fonts) when they exist, with the fonts' OFL licences
  for (const f of ['tokens.css', 'components.css']) if (existsSync(join(PLATFORM, 'css', f))) await copyFile(join(PLATFORM, 'css', f), join(out, 'assets/css', f));
  const fontsDir = join(PLATFORM, 'fonts');
  if (existsSync(fontsDir)) {
    const fonts = (await readdir(fontsDir)).filter((f) => /\.woff2$|^OFL.*\.txt$/i.test(f));
    if (fonts.length) await mkdir(join(out, 'assets/fonts'), { recursive: true });
    for (const f of fonts) await copyFile(join(fontsDir, f), join(out, 'assets/fonts', f));
  }
  // the copies are the CURRENT sources (a stale pre-D2 analytics.js once leaked $current_url + a persistent id in key mode)
  for (const f of jsFiles) {
    const [a, b] = await Promise.all([readFile(join(PLATFORM, 'js', f)), readFile(join(out, 'assets/js', f))]);
    if (sha256(a) !== sha256(b)) throw new Error(`assets/js/${f} differs from js/${f} after copy`);
  }
  if (!posthogOn) for (const f of ['posthog-adapter.js', 'vendor/posthog-js-1.444.2.module.slim.no-external.js']) await rm(join(out, 'assets/js', f), { force: true });
  // (ז) the operator-only pieces never ship: dashboard.html / js/dashboard.js / anything under _local / the events file
  const forbidden = (p) => /(^|[\\/])(dashboard\.(html|js|css)|events[^\\/]*\.jsonl|_local)([\\/]|$)/i.test(p);
  const walk = async (dir, rel = '') => {
    const { readdir } = await import('node:fs/promises');
    const found = [];
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (forbidden(r)) found.push(r);
      if (e.isDirectory()) found.push(...await walk(join(dir, e.name), r));
    }
    return found;
  };
  const leaked = [...(await walk(out)), ...zipFilesList.map((z) => z.name).filter(forbidden)];
  if (leaked.length) throw new Error(`operator-only files in the dist/ZIP: ${leaked.join(', ')}`);
  log(`analytics: ${posthogOn ? 'PostHog key configured -> posthog-adapter.js + vendored SDK copied' : 'no PostHog key -> local only, adapter not shipped'}; assets/js/analytics.js sha256 ${sha256(await readFile(join(out, 'assets/js/analytics.js'))).slice(0, 12)} = js/analytics.js`);

  log(`panos ${panos.length}, stills ${stills.length}, plan ${planOut ? 'yes' : 'no'}, glb ${glbOut ? (glbOut.placeholder ? 'placeholder' : 'card-09') : 'none'} (${glbOut ? (glbOut.bytes / 1024).toFixed(0) + ' KB' : '-'})`
    + `${glbOut?.floors ? `, floors ${Object.keys(glbOut.floors).join('/')} (default ${glbOut.default_floor})` : ''}`
    + `, minimap ${minimapOut ? `${minimapOut.w}x${minimapOut.h} ${(minimapOut.bytes / 1024).toFixed(0)} KB, ${Object.keys(minimapOut.points).length} scenes` : 'no'}`);
  log(`zip: ${zipFilesList.length} files, ${mb.toFixed(2)} MB (<=${maxMb}) -> ${join(out, zipName).replace(/\\/g, '/')}`);
  log(`page: ${join(out, 'index.html').replace(/\\/g, '/')}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  if (mb > maxMb) throw new Error(`zip is ${mb.toFixed(2)} MB, over the ${maxMb} MB cap`);
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { pos, opt } = parseArgs(process.argv.slice(2));
  if (pos.length < 2) {
    console.error('usage: node tools/build_zip.mjs <project-dir> <unit> [--out <dir>] [--tour-apartment <dir>] [--glb <file>] [--legal <md|json>] [--platform-root <url>] [--max-mb 25]');
    process.exit(2);
  }
  const projectDir = resolve(pos[0]);
  build({
    projectDir, unitId: pos[1],
    out: resolve(opt.out || join('_local/dist', basename(projectDir), pos[1])),
    tourApartment: opt['tour-apartment'] ? resolve(opt['tour-apartment']) : undefined,
    glbPath: opt.glb ? resolve(opt.glb) : undefined,
    legalPath: opt.legal ? resolve(opt.legal) : undefined,
    platformRoot: opt['platform-root'] || undefined,
    maxMb: opt['max-mb'] ? Number(opt['max-mb']) : 25,
  }).catch((e) => { console.error('FAIL', e.message); process.exit(1); });
}
