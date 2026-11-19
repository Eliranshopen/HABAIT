// full walk (2026-11-10): every interior tab, 8 directions, the set the visitor sees (parquet), at the viewer's zoom; one sheet per tab
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { loadPano, render } from 'file:///C:/RnD/Projects/Habait/habait-walkaround/Habait/tour360/tools/pano-geometry.mjs';
const sharp = createRequire('C:/RnD/Projects/Habait/tools/appdeps/package.json')('sharp');
const [SET, OUT] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const VW = 800, VH = 520, HFOV = 85, PITCH = -12;
const files = fs.readdirSync(SET).filter((f) => /^\d\d-.*\.webp$/.test(f)).sort();
for (const f of files) {
  const p = await loadPano(sharp, path.join(SET, f));
  const parts = [];
  for (let i = 0; i < 8; i++) {
    const yaw = -180 + i * 45;
    const buf = render(p, yaw, PITCH, HFOV, VW, VH);
    const img = await sharp(buf, { raw: { width: VW, height: VH, channels: 3 } }).png().toBuffer();
    const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${VW}" height="26"><rect width="${VW}" height="26" fill="#000"/><text x="8" y="18" fill="#fff" font-size="15" font-family="Arial">${f.replace('.webp', '')} · yaw ${yaw}</text></svg>`);
    const x = (i % 4) * (VW + 6), y = Math.floor(i / 4) * (VH + 26 + 6);
    parts.push({ input: label, left: x, top: y }, { input: img, left: x, top: y + 26 });
  }
  const out = path.join(OUT, f.replace('.webp', '.jpg'));
  await sharp({ create: { width: 4 * VW + 18, height: 2 * (VH + 26) + 6, channels: 3, background: '#222' } }).composite(parts).jpeg({ quality: 84 }).toFile(out);
  console.log(out);
}
