#!/usr/bin/env node
/* Habait Tour360 - make-depth-map.mjs (D-WQ-36, the locked polish): the V2 pipeline's packed depth pass (depth.png, rgb24-be
   centimetres, 0 = no surface; render_pano.py's contract) -> an 8-bit control map for a depth-conditioned model (near = white,
   far = black, inverse depth so a room's near furniture keeps its contrast), at the polish lane's size.
   usage: node tools/make-depth-map.mjs <depth.png> <out.png> [--size 2048x1024] [--far-m 30]
   The map carries no secret and no pixels of a photo: it is geometry only. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appRequire } from './app-require.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const sharp = appRequire(REPO)('sharp');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const [inFile, outFile] = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
if (!inFile || !outFile) { console.error('usage: make-depth-map.mjs <depth.png> <out.png> [--size WxH] [--far-m 30]'); process.exit(2); }
const [W, H] = opt('--size', '2048x1024').split('x').map(Number);
const FAR = Number(opt('--far-m', 12)) * 100; // cm — an apartment's longest sightline; 30 m flattened a room to a grey (measured 2026-10-29)

const { data, info } = await sharp(inFile).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const sw = info.width, sh = info.height;
const out = Buffer.alloc(W * H);
// box-sample the source (8192 -> 2048 is 4x4): the nearest valid reading wins inside the box, so thin near edges survive
const bx = sw / W, by = sh / H;
let valid = 0;
for (let y = 0; y < H; y++) {
  const y0 = Math.floor(y * by), y1 = Math.min(sh, Math.floor((y + 1) * by));
  for (let x = 0; x < W; x++) {
    const x0 = Math.floor(x * bx), x1 = Math.min(sw, Math.floor((x + 1) * bx));
    let near = Infinity;
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
      const o = (yy * sw + xx) * 3; const cm = (data[o] << 16) | (data[o + 1] << 8) | data[o + 2];
      if (cm > 0 && cm < near) near = cm;
    }
    if (near === Infinity) { out[y * W + x] = 0; continue; } // sky / no surface
    valid++;
    const d = Math.min(near, FAR);
    // inverse depth, normalised: 50 cm -> 255, FAR -> 0
    const inv = (1 / d - 1 / FAR) / (1 / 50 - 1 / FAR);
    out[y * W + x] = Math.max(0, Math.min(255, Math.round(255 * inv)));
  }
}
await sharp(out, { raw: { width: W, height: H, channels: 1 } }).png().toFile(outFile);
console.log(`${path.basename(outFile)} ${W}x${H}, ${(100 * valid / (W * H)).toFixed(1)}% surface, far ${FAR / 100} m`);
