/* A phone copy of each piece's GLB with its textures shrunk (2026-11-18, Eliran: «ההליכה עדיין זזה בתקיעות»): the live link
   loaded 30 pieces of 4–6 MB on phones; most of the weight is 2048–4096 px textures, and decoding them froze the walk.
   No 3D tool needed: the GLB is split (JSON + BIN), every embedded image is resized with sharp (max --tex px, JPEG q82, PNG kept
   when it has alpha), the BIN is rebuilt with 4-byte-aligned buffer views. Geometry is untouched. $0, idempotent (skips a fresh copy).
   Usage: node scripts/26_glb_phone_tex.mjs <glb-dir> [--tex 1024] [--suffix _m]   → <id><suffix>.glb next to each <id>.glb        */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json');
const sharp = require('sharp');

const a = process.argv.slice(2);
const dir = path.resolve(a[0]);
const TEX = +(a.includes('--tex') ? a[a.indexOf('--tex') + 1] : 1024);
const SUF = a.includes('--suffix') ? a[a.indexOf('--suffix') + 1] : '_m';
const pad4 = (n) => (n + 3) & ~3;

async function shrink(src, dst) {
  const buf = fs.readFileSync(src);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB');
  let o = 12, json, bin;
  while (o < buf.length) {
    const len = buf.readUInt32LE(o), type = buf.readUInt32LE(o + 4), data = buf.subarray(o + 8, o + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(data.toString('utf8')); else if (type === 0x004e4942) bin = data;
    o += 8 + len;
  }
  const views = json.bufferViews || [];
  const imgView = new Map();   // bufferView index -> image
  for (const im of json.images || []) if (im.bufferView !== undefined) imgView.set(im.bufferView, im);
  const parts = []; let off = 0;
  for (let i = 0; i < views.length; i++) {
    const v = views[i];
    let data = bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
    const im = imgView.get(i);
    if (im) {
      const s = sharp(data), m = await s.metadata();
      const r = s.resize({ width: TEX, height: TEX, fit: 'inside', withoutEnlargement: true });
      if (m.hasAlpha) { data = await r.png({ compressionLevel: 9 }).toBuffer(); im.mimeType = 'image/png'; }
      else { data = await r.jpeg({ quality: 82, mozjpeg: true }).toBuffer(); im.mimeType = 'image/jpeg'; }
    }
    const start = pad4(off);
    if (start > off) parts.push(Buffer.alloc(start - off));
    parts.push(data); v.byteOffset = start; v.byteLength = data.length; off = start + data.length;
  }
  const newBin = Buffer.concat([...parts, Buffer.alloc(pad4(off) - off)]);
  json.buffers = [{ byteLength: newBin.length }];
  let js = Buffer.from(JSON.stringify(json), 'utf8'); js = Buffer.concat([js, Buffer.alloc(pad4(js.length) - js.length, 0x20)]);
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4);
  const ch = (t, d) => { const h = Buffer.alloc(8); h.writeUInt32LE(d.length, 0); h.writeUInt32LE(t, 4); return Buffer.concat([h, d]); };
  const out = Buffer.concat([head, ch(0x4e4f534a, js), ch(0x004e4942, newBin)]);
  out.writeUInt32LE(out.length, 8);
  fs.writeFileSync(dst, out);
  return [buf.length, out.length];
}

let before = 0, after = 0, n = 0;
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.glb') && !x.endsWith(`${SUF}.glb`))) {
  const src = path.join(dir, f), dst = path.join(dir, f.replace(/\.glb$/, `${SUF}.glb`));
  if (fs.existsSync(dst) && fs.statSync(dst).mtimeMs > fs.statSync(src).mtimeMs) continue;
  try { const [b, c] = await shrink(src, dst); before += b; after += c; n++; }
  catch (e) { console.error('FAIL', f, e.message); process.exitCode = 1; }
}
console.log(JSON.stringify({ made: n, beforeMB: +(before / 1e6).toFixed(1), afterMB: +(after / 1e6).toFixed(1) }));
