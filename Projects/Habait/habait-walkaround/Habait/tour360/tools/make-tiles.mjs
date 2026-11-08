#!/usr/bin/env node
/* Habait Tour360 — tools/make-tiles.mjs (WALKAROUND-QUALITY-PLAN.md §3.2 + card Q06, D-WQ-15). An apartment's equirects → cube-face
   tiles the viewer streams through the engine's tiles adapter (Photo Sphere Viewer 5.15.1 CubemapTilesAdapter behind
   engine/src/hybrid-adapter.ts):
     apartments/<id>/_local/panos-tiles/<asset>/<face>/<level>/<row>_<col>.webp   + <asset>/tiles.json (the per-asset manifest)
   Faces: left front right back top bottom — PSV's names AND PSV's own face formula (CubemapAdapter.textureCoordsToSphericalCoords,
   flipTopBottom false), so front = yaw 0 = the source's centre column, x to the right, y down. Tiles are 512 px. Three levels: the
   top face size is the smallest 512·2^k at or above the source's own density at a face centre (W/π: 3840 → 2048, 7680 → 4096) and
   the two below halve it (never under 512). The preview the viewer paints first is the six faces at 512 px — level 0's single tiles
   when level 0 is 512, else preview/<face>.webp. The top level is resampled from the equirect (Catmull-Rom by default — a second
   bilinear stage before the GPU's own measurably softened the picture — the seam wrapped; the top and bottom faces supersampled
   ss×ss because the equirect is denser than the face near the poles); the lower levels are Lanczos reductions of the top faces.
   The manifest's noMipmapFrom names the smallest level denser than the source at every point of a face: such a level carries no
   detail finer than the source, so the viewer samples it without mipmaps (trilinear mipmapping blurred a desktop's wide view).
   Source: apartments/<id>/_local/full/<asset>.webp by default (the 3840×1920 set); --src DIR for another set (the 7680 upscale).
   Read-only toward the source. A rerun skips an asset whose source sha256 and parameters are unchanged (--force redoes it).
     timeout 540 node Habait/tour360/tools/make-tiles.mjs <apartment> [--src DIR] [--quality 85] [--ss 2] [--kernel cubic|bilinear]
                                                             [--only <asset>] [--force]
   $0, local; sharp from the Habait app (app-require.mjs). Nothing here is tracked: _local/ is gitignored. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { appRequire } from './app-require.mjs';

const TOOL_VERSION = 2; // 2: Catmull-Rom by default, noMipmapFrom
const TILE = 512;
export const FACES = ['left', 'front', 'right', 'back', 'top', 'bottom'];

/** PSV 5.15.1 CubemapAdapter.textureCoordsToSphericalCoords (flipTopBottom false): the direction of face point (u, v), u and v in
    [-1, 1] (u = 2·(x/F − 0.5), v = 2·(y/F − 0.5)), as the vector whose yaw = atan2(Y, X) and pitch = −asin(Z/|d|). */
export function faceDir(face, u, v) {
  switch (face) {
    case 'front': return [1, u, v];
    case 'right': return [-u, 1, v];
    case 'left': return [u, -1, v];
    case 'back': return [-1, -u, v];
    case 'bottom': return [v, -u, 1];
    case 'top': return [-v, -u, -1];
    default: throw new Error('unknown face ' + face);
  }
}
/** yaw, pitch (radians) of a face point — PSV's yawPitch() */
export function facePointToYawPitch(face, u, v) {
  const [x, y, z] = faceDir(face, u, v);
  const d = Math.sqrt(x * x + y * y + z * z);
  return [Math.atan2(y / d, x / d), -Math.asin(z / d)];
}
/** the top face size for a source width: the smallest 512·2^k at or above W/π (the source's density at a face centre) */
export function topFaceSize(width) {
  const k = Math.max(0, Math.ceil(Math.log2(width / Math.PI / TILE)));
  return TILE * 2 ** k;
}
/** three levels below and at the top size, never under one 512 tile */
export function levelSizes(top) {
  return [top / 4, top / 2, top].filter((f) => f >= TILE);
}
/** the smallest level whose density at a face centre (its lowest, F·π/360 texels a degree) is at or above the source's (W/360):
    such a level holds no detail finer than the source, and the viewer draws it without mipmaps; null when none is */
export function noMipmapFrom(sizes, sourceWidth) {
  const s = sizes.find((F) => (F * Math.PI) / 360 >= sourceWidth / 360);
  return s === undefined ? null : s;
}

function main() {
  const TOOLS = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.resolve(TOOLS, '..');
  const REPO = path.resolve(ROOT, '..', '..');
  const argv = process.argv.slice(2);
  const id = argv[0];
  const arg = (k, d) => { const i = argv.indexOf(k); return i > 0 ? argv[i + 1] : d; };
  if (!id || id.startsWith('--')) { console.error('usage: make-tiles.mjs <apartment> [--src DIR] [--quality 85] [--ss 2] [--only <asset>] [--force]'); process.exit(2); }
  const quality = Number(arg('--quality', 85));
  const ss = Math.max(1, Math.min(4, Number(arg('--ss', 2))));
  const kernel = arg('--kernel', 'cubic');
  if (!['cubic', 'bilinear'].includes(kernel)) { console.error('make-tiles: --kernel cubic|bilinear'); process.exit(2); }
  const only = arg('--only', null);
  const force = argv.includes('--force');
  const APT = path.join(ROOT, 'apartments', id);
  if (!fs.existsSync(APT)) { console.error('make-tiles: no apartment ' + id); process.exit(2); }
  const SRC = arg('--src', null) ? path.resolve(arg('--src')) : path.join(APT, '_local', 'full');
  const OUT = path.join(APT, '_local', 'panos-tiles');
  if (!fs.existsSync(SRC)) { console.error('make-tiles: no source set at ' + SRC); process.exit(2); }
  const sharp = appRequire(REPO)('sharp');
  const scenes = JSON.parse(fs.readFileSync(path.join(APT, 'scenes.json'), 'utf8')).scenes;
  fs.mkdirSync(OUT, { recursive: true });
  return run({ sharp, scenes, SRC, OUT, APT, quality, ss, kernel, only, force });
}

async function run({ sharp, scenes, SRC, OUT, APT, quality, ss, kernel, only, force }) {
  const t0 = Date.now();
  let made = 0, skipped = 0, bytesAll = 0;
  for (const s of scenes) {
    if (only && s.asset !== only) continue;
    const src = path.join(SRC, s.asset + '.webp');
    if (!fs.existsSync(src)) { console.error(`make-tiles: no source for ${s.asset} at ${src}`); process.exit(1); }
    const buf = fs.readFileSync(src);
    const sha = crypto.createHash('sha256').update(buf).digest('hex');
    const dir = path.join(OUT, s.asset);
    const manPath = path.join(dir, 'tiles.json');
    const params = { tool: 'make-tiles.mjs', toolVersion: TOOL_VERSION, tileSize: TILE, quality, supersampleTopBottom: ss, kernel };
    if (!force && fs.existsSync(manPath)) {
      const old = JSON.parse(fs.readFileSync(manPath, 'utf8'));
      if (old.source && old.source.sha256 === sha && JSON.stringify(old.params) === JSON.stringify(params) && filesPresent(dir, old)) {
        console.log(`${s.asset.padEnd(20)} unchanged — skipped`); skipped++; bytesAll += old.bytes.total; continue;
      }
    }
    const a0 = Date.now();
    const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height;
    if (W !== 2 * H) { console.error(`make-tiles: ${s.asset} is ${W}×${H}, not 2:1`); process.exit(1); }
    const top = topFaceSize(W);
    const sizes = levelSizes(top);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const levels = sizes.map((faceSize, level) => ({ level, faceSize, nbTiles: faceSize / TILE, pxPerDegFaceCentre: round2((faceSize * Math.PI) / 360), pxPerDegFaceEdge: round2((faceSize * Math.PI) / 180), bytes: 0, files: 0 }));
    const previewFromLevel0 = levels[0].faceSize === TILE;
    const preview = { faceSize: TILE, faces: {}, bytes: 0 };
    for (const face of FACES) {
      const topFace = renderFace(face, top, data, W, H, face === 'top' || face === 'bottom' ? ss : 1, kernel);
      for (const L of levels) {
        const raw = L.faceSize === top ? topFace : await sharp(topFace, { raw: { width: top, height: top, channels: 3 } }).resize(L.faceSize, L.faceSize, { kernel: 'lanczos3' }).raw().toBuffer();
        fs.mkdirSync(path.join(dir, face, String(L.level)), { recursive: true });
        const jobs = [];
        for (let row = 0; row < L.nbTiles; row++) {
          for (let col = 0; col < L.nbTiles; col++) {
            const rel = `${face}/${L.level}/${row}_${col}.webp`;
            jobs.push(sharp(raw, { raw: { width: L.faceSize, height: L.faceSize, channels: 3 } })
              .extract({ left: col * TILE, top: row * TILE, width: TILE, height: TILE })
              .webp({ quality, effort: 4 }).toFile(path.join(dir, rel)).then((r) => { L.bytes += r.size; L.files++; }));
          }
        }
        await Promise.all(jobs);
        if (L.level === 0 && previewFromLevel0) preview.faces[face] = `${face}/0/0_0.webp`;
      }
      if (!previewFromLevel0) {
        fs.mkdirSync(path.join(dir, 'preview'), { recursive: true });
        const r = await sharp(topFace, { raw: { width: top, height: top, channels: 3 } }).resize(TILE, TILE, { kernel: 'lanczos3' }).webp({ quality, effort: 4 }).toFile(path.join(dir, 'preview', face + '.webp'));
        preview.faces[face] = `preview/${face}.webp`;
        preview.bytes += r.size;
      }
    }
    if (previewFromLevel0) preview.bytes = FACES.reduce((n, f) => n + fs.statSync(path.join(dir, preview.faces[f])).size, 0);
    const total = levels.reduce((n, L) => n + L.bytes, 0) + (previewFromLevel0 ? 0 : preview.bytes);
    const manifest = {
      $schema: 'tour360/tiles.v1',
      asset: s.asset,
      source: { file: path.relative(APT, src).split(path.sep).join('/'), width: W, height: H, sha256: sha, pxPerDegEquator: round2(W / 360) },
      projection: 'cube; PSV 5.15.1 CubemapAdapter face names and formula (flipTopBottom false): front = yaw 0 = the source centre column, x right, y down',
      path: '<face>/<level>/<row>_<col>.webp',
      tileSize: TILE,
      format: 'webp',
      faces: FACES,
      levels,
      noMipmapFrom: noMipmapFrom(sizes, W),
      preview,
      params,
      bytes: { total, preview: preview.bytes, byLevel: levels.map((L) => L.bytes) },
      files: levels.reduce((n, L) => n + L.files, 0) + (previewFromLevel0 ? 0 : FACES.length),
    };
    fs.writeFileSync(manPath, JSON.stringify(manifest, null, 1) + '\n');
    bytesAll += total;
    made++;
    console.log(`${s.asset.padEnd(20)} ${W}×${H} → faces ${sizes.join('/')} · ${manifest.files} files · ${kb(total)} (preview ${kb(preview.bytes)}; ${levels.map((L) => `L${L.level} ${kb(L.bytes)}`).join(', ')}) · ${((Date.now() - a0) / 1000).toFixed(1)} s`);
  }
  console.log(`make-tiles: ${made} made, ${skipped} unchanged · ${(bytesAll / 1048576).toFixed(2)} MB of tiles · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

function filesPresent(dir, man) {
  for (const f of man.faces || FACES) {
    for (const L of man.levels) for (let r = 0; r < L.nbTiles; r++) for (let c = 0; c < L.nbTiles; c++) if (!fs.existsSync(path.join(dir, f, String(L.level), `${r}_${c}.webp`))) return false;
    if (!fs.existsSync(path.join(dir, man.preview.faces[f]))) return false;
  }
  return true;
}

/** one cube face, F×F RGB, sampled from the equirect (Catmull-Rom or bilinear; x wraps across the seam, y clamps at the poles;
    n×n samples a pixel) */
export function renderFace(face, F, img, W, H, n = 1, kernel = 'cubic') {
  const out = Buffer.alloc(F * F * 3);
  const acc = new Float64Array(3);
  const inv = 1 / (n * n);
  const TWO_PI = 2 * Math.PI;
  const sample = kernel === 'cubic' ? catmullRom : bilinear;
  for (let y = 0; y < F; y++) {
    for (let x = 0; x < F; x++) {
      acc[0] = acc[1] = acc[2] = 0;
      for (let sy = 0; sy < n; sy++) {
        const v = 2 * ((y + (sy + 0.5) / n) / F - 0.5);
        for (let sx = 0; sx < n; sx++) {
          const u = 2 * ((x + (sx + 0.5) / n) / F - 0.5);
          const [dx, dy, dz] = faceDir(face, u, v);
          const yaw = Math.atan2(dy, dx);
          const pitch = -Math.atan2(dz, Math.sqrt(dx * dx + dy * dy));
          const xe = (0.5 + yaw / TWO_PI) * W - 0.5;
          const ye = (0.5 - pitch / Math.PI) * H - 0.5;
          sample(img, W, H, xe, ye, acc);
        }
      }
      const o = (y * F + x) * 3;
      for (let k = 0; k < 3; k++) { const c = Math.round(acc[k] * inv); out[o + k] = c < 0 ? 0 : c > 255 ? 255 : c; }
    }
  }
  return out;
}
/** Catmull-Rom (a = −0.5) on a 4×4 neighbourhood; x wraps across the seam, y clamps at the poles; may overshoot (clamped by the caller) */
function catmullRom(img, W, H, xe, ye, acc) {
  const x1 = Math.floor(xe), y1 = Math.floor(ye);
  const tx = xe - x1, ty = ye - y1;
  const wx = crWeights(tx), wy = crWeights(ty);
  let r = 0, g = 0, b = 0;
  for (let j = 0; j < 4; j++) {
    let yy = y1 - 1 + j;
    yy = yy < 0 ? 0 : yy > H - 1 ? H - 1 : yy;
    const row = yy * W;
    let rr = 0, gg = 0, bb = 0;
    for (let i = 0; i < 4; i++) {
      const xx = ((((x1 - 1 + i) % W) + W) % W);
      const p = (row + xx) * 3;
      const w = wx[i];
      rr += img[p] * w; gg += img[p + 1] * w; bb += img[p + 2] * w;
    }
    const w = wy[j];
    r += rr * w; g += gg * w; b += bb * w;
  }
  acc[0] += r; acc[1] += g; acc[2] += b;
}
function crWeights(t) {
  const t2 = t * t, t3 = t2 * t;
  return [(-t3 + 2 * t2 - t) / 2, (3 * t3 - 5 * t2 + 2) / 2, (-3 * t3 + 4 * t2 + t) / 2, (t3 - t2) / 2];
}
function bilinear(img, W, H, xe, ye, acc) {
  let x0 = Math.floor(xe), y0 = Math.floor(ye);
  const fx = xe - x0, fy = ye - y0;
  let x1 = x0 + 1, y1 = y0 + 1;
  x0 = ((x0 % W) + W) % W; x1 = ((x1 % W) + W) % W;
  y0 = y0 < 0 ? 0 : y0 > H - 1 ? H - 1 : y0;
  y1 = y1 < 0 ? 0 : y1 > H - 1 ? H - 1 : y1;
  const a = (y0 * W + x0) * 3, b = (y0 * W + x1) * 3, c = (y1 * W + x0) * 3, d = (y1 * W + x1) * 3;
  const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
  acc[0] += img[a] * w00 + img[b] * w10 + img[c] * w01 + img[d] * w11;
  acc[1] += img[a + 1] * w00 + img[b + 1] * w10 + img[c + 1] * w01 + img[d + 1] * w11;
  acc[2] += img[a + 2] * w00 + img[b + 2] * w10 + img[c + 2] * w01 + img[d + 2] * w11;
}
const round2 = (x) => Math.round(x * 100) / 100;
const kb = (b) => (b / 1024).toFixed(0) + ' KB';

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = main();
  if (r && r.catch) r.catch((e) => { console.error('make-tiles: ' + ((e && e.stack) || e)); process.exit(1); });
}
