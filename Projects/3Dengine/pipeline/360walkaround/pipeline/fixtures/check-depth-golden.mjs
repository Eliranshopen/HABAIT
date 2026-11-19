#!/usr/bin/env node
// check-depth-golden.mjs — decode the committed depth fixture in the OTHER ecosystem.
//
// CONTRACT §16.5 (C-360-82) asks for "one committed golden fixture both sides test against". The
// Python side is `make-depth-golden.py` (which re-reads its own output through libpng); this file is
// the JS side: a dependency-free PNG reader + the reference decode, so a byte-order or scale drift
// between the Blender packer and the viewer's TypeScript util shows up as a RED test and not as a
// wrong measurement in front of a buyer.
//
//   node pipeline/fixtures/check-depth-golden.mjs              # decode + assert (exit 1 on drift)
//   node pipeline/fixtures/check-depth-golden.mjs --mutant le   # the RED mutant: MUST fail
//   node pipeline/fixtures/check-depth-golden.mjs --mutant x10  # the RED mutant: MUST fail
//   node pipeline/fixtures/check-depth-golden.mjs --png <file>  # stats for any packed depth PNG
//
// ⚠ The decode REFUSES an unknown `depth_encoding`/`depth_scale` (C-360-83) — it never falls back to
// the format it happens to know.

import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const KNOWN_ENCODING = "rgb24-be";
const KNOWN_SCALE = 100;
const INVALID = 0;

/** Minimal PNG reader: 8-bit RGB (colour type 2), all five filter types. Returns {w,h,rgb}. */
export function readPng(buf) {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) if (buf[i] !== sig[i]) throw new Error("not a PNG");
  let off = 8, w = 0, h = 0, depth = 0, colour = 0, idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const tag = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (tag === "IHDR") {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      depth = data[8]; colour = data[9];
      if (data[12] !== 0) throw new Error("interlaced PNG is not supported (and never written)");
    } else if (tag === "IDAT") idat.push(Buffer.from(data));
    else if (tag === "IEND") break;
    off += 12 + len;
  }
  if (depth !== 8 || colour !== 2) throw new Error(`expected 8-bit RGB, got depth=${depth} colour=${colour}`);
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = 3, stride = w * bpp;
  const rgb = Buffer.alloc(h * stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const ft = raw[p++];
    const line = raw.subarray(p, p + stride); p += stride;
    const cur = rgb.subarray(y * stride, (y + 1) * stride);
    const up = y > 0 ? rgb.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = up ? up[x] : 0;
      const c = (up && x >= bpp) ? up[x - bpp] : 0;
      let v = line[x];
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      } else if (ft !== 0) throw new Error(`bad filter type ${ft} on row ${y}`);
      cur[x] = v & 0xff;
    }
  }
  return { w, h, rgb };
}

/** The reference decode. Row 0 is the PNG's TOP scanline. Returns metres, or null for "no surface". */
export function decodeDepth(rgb, w, x, y, { encoding = KNOWN_ENCODING, scale = KNOWN_SCALE } = {}) {
  if (encoding !== KNOWN_ENCODING) throw new Error(`unknown depth_encoding '${encoding}' — refusing`);
  if (scale !== KNOWN_SCALE) throw new Error(`unknown depth_scale '${scale}' — refusing`);
  const i = (y * w + x) * 3;
  const units = (rgb[i] << 16) | (rgb[i + 1] << 8) | rgb[i + 2];
  return units === INVALID ? null : units / scale;
}

function main(argv) {
  const mutant = argv.includes("--mutant") ? argv[argv.indexOf("--mutant") + 1] : null;
  const pngArg = argv.includes("--png") ? argv[argv.indexOf("--png") + 1] : null;

  if (pngArg) {                                   // stats mode for a real render's depth map
    const { w, h, rgb } = readPng(readFileSync(pngArg));
    let min = Infinity, max = -Infinity, invalid = 0;
    for (let i = 0; i < w * h; i++) {
      const u = (rgb[i * 3] << 16) | (rgb[i * 3 + 1] << 8) | rgb[i * 3 + 2];
      if (u === INVALID) { invalid++; continue; }
      const m = u / KNOWN_SCALE;
      if (m < min) min = m;
      if (m > max) max = m;
    }
    console.log(`${pngArg}: ${w}x${h}  valid ${(w * h - invalid).toLocaleString()}  ` +
                `invalid ${invalid.toLocaleString()}  range ${min.toFixed(3)}..${max.toFixed(3)} m`);
    console.log(`  nadir  (centre of the LAST scanline) = ${decodeDepth(rgb, w, w >> 1, h - 1)} m`);
    console.log(`  zenith (centre of the FIRST scanline) = ${decodeDepth(rgb, w, w >> 1, 0)} m`);
    return 0;
  }

  const doc = JSON.parse(readFileSync(join(HERE, "depth-golden-8x4.json"), "utf8"));
  const { w, h, rgb } = readPng(readFileSync(join(HERE, "depth-golden-8x4.png")));
  if (w !== doc.width || h !== doc.height) {
    console.log(`FAIL  fixture is ${w}x${h}, the JSON says ${doc.width}x${doc.height}`);
    return 1;
  }
  // the mutants the contract asks for: each must make this check go RED
  const decode = (x, y) => {
    const i = (y * w + x) * 3;
    if (mutant === "le") {                                            // byte order flipped
      const u = (rgb[i + 2] << 16) | (rgb[i + 1] << 8) | rgb[i];
      return u === INVALID ? null : u / KNOWN_SCALE;
    }
    if (mutant === "x10") {                                           // wrong scale
      const u = (rgb[i] << 16) | (rgb[i + 1] << 8) | rgb[i + 2];
      return u === INVALID ? null : u / 10;
    }
    if (mutant === "flip") return decodeDepth(rgb, w, x, h - 1 - y);  // vertical flip
    if (mutant === "zero") {                                          // 0 treated as a distance
      const i2 = (y * w + x) * 3;
      return ((rgb[i2] << 16) | (rgb[i2 + 1] << 8) | rgb[i2 + 2]) / KNOWN_SCALE;
    }
    return decodeDepth(rgb, w, x, y, { encoding: doc.depth_encoding, scale: doc.depth_scale });
  };

  let bad = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const want = doc.expected_metres[y][x];
      const got = decode(x, y);
      const ok = (want === null) ? (got === null) : (got !== null && Math.abs(got - want) < 1e-9);
      if (!ok) { bad++; if (bad <= 4) console.log(`  (${y},${x}) got ${got} expected ${want}`); }
    }
  }
  // the refusal rule (C-360-83): an unknown encoding must throw, never fall back
  let refused = false;
  try { decodeDepth(rgb, w, 0, 0, { encoding: "rgb24-le", scale: 100 }); }
  catch { refused = true; }

  const label = mutant ? `MUTANT '${mutant}'` : "golden";
  console.log(`${label}: ${w * h - bad}/${w * h} pixels match; unknown-encoding refused: ${refused}`);
  if (mutant) {
    if (bad === 0) { console.log(`FAIL  the ${label} decoded CLEAN — the fixture cannot catch it`); return 1; }
    console.log(`OK    the ${label} went RED on ${bad} pixel(s), as it must`);
    return 0;
  }
  if (bad || !refused) { console.log("FAIL  golden fixture does not decode"); return 1; }
  console.log("OK");
  return 0;
}

// run only as a CLI — `readPng` / `decodeDepth` are importable by the viewer's own suite
if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv.slice(2)));
