// 360walkaround/server/pano.mjs — the LOCAL pad step (CONTRACT §1.2 "PORT-AS-IS", §1.1 R2).
//
// PORTED BYTE-FOR-BYTE from 3D/mvp/server/pano.mjs apart from this header and ONE rename:
// `padToMarblePano` -> `padToPano2x1` (the function is named after the geometry, not after a vendor
// this track does not use; the name appears nowhere in CONTRACT §1, so no amendment is involved —
// recorded as a port note in ../NOTES.md). Every algorithm below is unchanged.
//
// ⛔ The pad is mandatory, not cosmetic: `fal-ai/nano-banana-pro/edit`'s aspect_ratio enum has no
//    2:1 (schema re-read 2026-08-28: auto·21:9·16:9·3:2·4:3·5:4·1:1·4:5·3:4·2:3·9:16), while an
//    equirectangular panorama is "exactly 2:1 width to height" or it is not a panorama. So: generate
//    at 21:9, then land the bytes on EXACTLY 2560x1280 here (CONTRACT §1.1 R2).
//
// ⚠ P-1 measured what that pad COSTS in a viewer: the 15.2 % edge-replicated bars are a radial smear
//    at the poles — the nadir is DEFECTIVE, which is why DS-5's nadir mark is ON by default. The pad is
//    the working recipe, not a good one; D-360-1 may replace it with a true-2:1 generator.
//
// Zero dependencies on purpose: a PNG decoder/encoder + one resampler in ~200 lines beats adding a
// native image dep to a local-only build. Everything here is pure and deterministic, so the pad can be
// re-run from cached vendor bytes forever without re-billing a single cent.
import zlib from "node:zlib";

export const PANO_W = 2560;
export const PANO_H = 1280;

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export class PanoError extends Error {
  constructor(message) {
    super(message);
    this.name = "PanoError";
  }
}

// ── PNG: read the header only (the cheap dims assertion the acceptance test uses) ────────────────
export function measurePng(buf) {
  if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_MAGIC)) throw new PanoError("not a PNG (bad magic)");
  if (buf.subarray(12, 16).toString("ascii") !== "IHDR") throw new PanoError("not a PNG (first chunk is not IHDR)");
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bitDepth: buf[24],
    colorType: buf[25],
    interlace: buf[28],
  };
}

const CHANNELS_BY_COLOR_TYPE = { 0: 1, 2: 3, 4: 2, 6: 4 };

/** Decode a non-interlaced 8-bit PNG (grey / grey+A / RGB / RGBA) to a tightly packed RGB buffer. */
export function decodePng(buf) {
  const head = measurePng(buf);
  if (head.bitDepth !== 8) throw new PanoError(`unsupported PNG bit depth ${head.bitDepth} (only 8 is handled)`);
  if (head.interlace !== 0) throw new PanoError("unsupported interlaced PNG (Adam7)");
  const channels = CHANNELS_BY_COLOR_TYPE[head.colorType];
  if (!channels) throw new PanoError(`unsupported PNG colour type ${head.colorType}`);

  const idat = [];
  let off = 8;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.subarray(off + 4, off + 8).toString("ascii");
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IDAT") idat.push(data);
    if (type === "IEND") break;
    off += 12 + len;
  }
  if (!idat.length) throw new PanoError("PNG carries no IDAT chunk");

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const { width: w, height: h } = head;
  const stride = w * channels;
  if (raw.length < h * (stride + 1)) throw new PanoError("PNG IDAT is shorter than the declared image");

  // Un-filter (PNG filter types 0..4), in place, into a packed <channels> buffer.
  const out = Buffer.alloc(h * stride);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = out.subarray(y * stride, (y + 1) * stride);
    line.copy(cur);
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? cur[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      switch (filter) {
        case 0: break;
        case 1: cur[i] = (cur[i] + a) & 0xff; break;
        case 2: cur[i] = (cur[i] + b) & 0xff; break;
        case 3: cur[i] = (cur[i] + ((a + b) >> 1)) & 0xff; break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          const pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          cur[i] = (cur[i] + pred) & 0xff;
          break;
        }
        default: throw new PanoError(`unknown PNG filter type ${filter} on row ${y}`);
      }
    }
    prev = cur;
  }

  // Normalise to RGB (alpha dropped: an equirectangular pano has no transparency).
  if (channels === 3) return { width: w, height: h, data: out };
  const rgb = Buffer.alloc(w * h * 3);
  for (let i = 0, p = 0; i < w * h; i++) {
    if (channels === 1) {
      rgb[p++] = out[i]; rgb[p++] = out[i]; rgb[p++] = out[i];
    } else if (channels === 2) {
      rgb[p++] = out[i * 2]; rgb[p++] = out[i * 2]; rgb[p++] = out[i * 2];
    } else {
      rgb[p++] = out[i * 4]; rgb[p++] = out[i * 4 + 1]; rgb[p++] = out[i * 4 + 2];
    }
  }
  return { width: w, height: h, data: rgb };
}

// ── PNG: encode RGB, adaptive per-row filtering (keeps a 2560x1280 photo small enough to ride in a
//    data-URI request body; the same reason a JPEG dep is not needed) ──────────────────────────────
function crc32(buf) {
  if (typeof zlib.crc32 === "function") return zlib.crc32(buf) >>> 0;
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

export function encodePng({ width, height, data }) {
  if (data.length !== width * height * 3) throw new PanoError("encodePng: data length != w*h*3");
  const stride = width * 3;
  const raw = Buffer.alloc(height * (stride + 1));
  const cand = [Buffer.alloc(stride), Buffer.alloc(stride), Buffer.alloc(stride), Buffer.alloc(stride), Buffer.alloc(stride)];
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const cur = data.subarray(y * stride, (y + 1) * stride);
    let best = 0;
    let bestScore = Infinity;
    for (let f = 0; f < 5; f++) {
      const dst = cand[f];
      let score = 0;
      for (let i = 0; i < stride; i++) {
        const a = i >= 3 ? cur[i - 3] : 0;
        const b = prev[i];
        const c = i >= 3 ? prev[i - 3] : 0;
        let v;
        if (f === 0) v = cur[i];
        else if (f === 1) v = cur[i] - a;
        else if (f === 2) v = cur[i] - b;
        else if (f === 3) v = cur[i] - ((a + b) >> 1);
        else {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          v = cur[i] - (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
        }
        dst[i] = v & 0xff;
        const s = dst[i] < 128 ? dst[i] : 256 - dst[i]; // minimum-sum-of-absolute-differences heuristic
        score += s;
      }
      if (score < bestScore) { bestScore = score; best = f; }
    }
    raw[y * (stride + 1)] = best;
    cand[best].copy(raw, y * (stride + 1) + 1);
    prev = cur;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB
  return Buffer.concat([
    PNG_MAGIC,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── resample: triangle kernel with support widened on downscale (box-like) ───────────────────────
function buildWeights(srcSize, dstSize) {
  const ratio = srcSize / dstSize;
  const support = Math.max(1, ratio);
  const rows = [];
  for (let i = 0; i < dstSize; i++) {
    const centre = (i + 0.5) * ratio;
    const lo = Math.max(0, Math.floor(centre - support));
    const hi = Math.min(srcSize - 1, Math.ceil(centre + support));
    const idx = [];
    const wts = [];
    let sum = 0;
    for (let s = lo; s <= hi; s++) {
      const w = Math.max(0, 1 - Math.abs(s + 0.5 - centre) / support);
      if (w <= 0) continue;
      idx.push(s);
      wts.push(w);
      sum += w;
    }
    if (!sum) { idx.push(Math.min(srcSize - 1, Math.max(0, Math.round(centre - 0.5)))); wts.push(1); sum = 1; }
    for (let k = 0; k < wts.length; k++) wts[k] /= sum;
    rows.push({ idx, wts });
  }
  return rows;
}

/** Resample an RGB buffer to dw x dh. Deterministic; identical input gives identical bytes. */
export function resizeRgb({ width, height, data }, dw, dh) {
  if (width === dw && height === dh) return { width: dw, height: dh, data: Buffer.from(data) };
  const hW = buildWeights(width, dw);
  const tmp = Buffer.alloc(dw * height * 3);
  for (let y = 0; y < height; y++) {
    const srow = y * width * 3;
    const drow = y * dw * 3;
    for (let x = 0; x < dw; x++) {
      const { idx, wts } = hW[x];
      let r = 0, g = 0, b = 0;
      for (let k = 0; k < idx.length; k++) {
        const o = srow + idx[k] * 3;
        r += data[o] * wts[k];
        g += data[o + 1] * wts[k];
        b += data[o + 2] * wts[k];
      }
      const o = drow + x * 3;
      tmp[o] = Math.max(0, Math.min(255, Math.round(r)));
      tmp[o + 1] = Math.max(0, Math.min(255, Math.round(g)));
      tmp[o + 2] = Math.max(0, Math.min(255, Math.round(b)));
    }
  }
  const vW = buildWeights(height, dh);
  const out = Buffer.alloc(dw * dh * 3);
  for (let y = 0; y < dh; y++) {
    const { idx, wts } = vW[y];
    const drow = y * dw * 3;
    for (let x = 0; x < dw; x++) {
      let r = 0, g = 0, b = 0;
      for (let k = 0; k < idx.length; k++) {
        const o = idx[k] * dw * 3 + x * 3;
        r += tmp[o] * wts[k];
        g += tmp[o + 1] * wts[k];
        b += tmp[o + 2] * wts[k];
      }
      const o = drow + x * 3;
      out[o] = Math.max(0, Math.min(255, Math.round(r)));
      out[o + 1] = Math.max(0, Math.min(255, Math.round(g)));
      out[o + 2] = Math.max(0, Math.min(255, Math.round(b)));
    }
  }
  return { width: dw, height: dh, data: out };
}

/**
 * Letterbox an image onto EXACTLY targetW x targetH without cropping any generated pixel.
 *
 * padMode (recorded choice, ported):
 *   "edge"  — DEFAULT. The top and bottom rows are replicated into the bars. For an equirectangular
 *             pano the bars ARE the zenith and nadir, so black bars would hand the viewer a black
 *             ceiling and a black floor. Replication gives a plausible continuation instead — ⚠ and
 *             P-1 measured that "plausible" is a radial smear at the nadir (DS-5 patches the pole).
 *   "black" — the literal reading of "letterbox". Kept, parameterised and tested, so a later task can
 *             flip it without touching this module.
 */
export function letterbox({ width, height, data }, { targetW = PANO_W, targetH = PANO_H, padMode = "edge" } = {}) {
  if (padMode !== "edge" && padMode !== "black") throw new PanoError(`unknown padMode ${padMode}`);
  const scale = Math.min(targetW / width, targetH / height);
  const sw = Math.max(1, Math.min(targetW, Math.round(width * scale)));
  const sh = Math.max(1, Math.min(targetH, Math.round(height * scale)));
  const scaled = resizeRgb({ width, height, data }, sw, sh);
  const padTop = Math.floor((targetH - sh) / 2);
  const padLeft = Math.floor((targetW - sw) / 2);
  const out = Buffer.alloc(targetW * targetH * 3); // "black" is the zero fill

  for (let y = 0; y < targetH; y++) {
    const srcY = padMode === "edge" ? Math.max(0, Math.min(sh - 1, y - padTop)) : y - padTop;
    if (srcY < 0 || srcY >= sh) continue; // black bar row
    for (let x = 0; x < targetW; x++) {
      const srcX = padMode === "edge" ? Math.max(0, Math.min(sw - 1, x - padLeft)) : x - padLeft;
      if (srcX < 0 || srcX >= sw) continue;
      const so = (srcY * sw + srcX) * 3;
      const dofs = (y * targetW + x) * 3;
      out[dofs] = scaled.data[so];
      out[dofs + 1] = scaled.data[so + 1];
      out[dofs + 2] = scaled.data[so + 2];
    }
  }
  return {
    width: targetW,
    height: targetH,
    data: out,
    meta: {
      source: { w: width, h: height },
      scaled: { w: sw, h: sh },
      pad: { top: padTop, bottom: targetH - sh - padTop, left: padLeft, right: targetW - sw - padLeft },
      pad_mode: padMode,
    },
  };
}

/**
 * The post-condition, as a NAMED and independently testable function rather than an inline `if`.
 *
 * ⭐ Why it is exported: the first falsification pass mutated this comparison inline and the suite
 * stayed GREEN — nothing could drive the branch, because letterbox() returns its target dims by
 * construction, so the only way to reach the check is a regression in encodePng()/measurePng(). An
 * assertion no test can make fire is decoration. Named, it takes a wrong-sized PNG directly and the
 * mutation goes red like every other guard on this board.
 */
export function assertPanoDims(pngBuf, targetW = PANO_W, targetH = PANO_H) {
  const measured = measurePng(pngBuf);
  if (measured.width !== targetW || measured.height !== targetH)
    throw new PanoError(`pad produced ${measured.width}x${measured.height}, expected ${targetW}x${targetH}`);
  return measured;
}

/** The whole local step: vendor bytes (PNG) -> a 2:1 2560x1280 PNG + the measurements that prove it. */
export function padToPano2x1(pngBuf, { targetW = PANO_W, targetH = PANO_H, padMode = "edge" } = {}) {
  const src = decodePng(pngBuf);
  const box = letterbox(src, { targetW, targetH, padMode });
  const png = encodePng({ width: box.width, height: box.height, data: box.data });
  const measured = assertPanoDims(png, targetW, targetH);
  return { png, width: measured.width, height: measured.height, meta: box.meta };
}
