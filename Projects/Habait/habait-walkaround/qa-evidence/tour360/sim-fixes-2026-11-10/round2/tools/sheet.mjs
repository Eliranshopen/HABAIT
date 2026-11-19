// round 2 source sheets (2026-11-10): rectilinear tiles of the canonical elements, from the base picks. $0.
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
import { loadPano, render } from 'file:///C:/RnD/Projects/Habait/habait-walkaround/Habait/tour360/tools/pano-geometry.mjs';
const sharp = createRequire('C:/RnD/Projects/Habait/tools/appdeps/package.json')('sharp');
const APT = 'C:/RnD/Projects/Habait/habait-walkaround/Habait/tour360/apartments/apt846';
const picks = JSON.parse(fs.readFileSync(APT + '/_local/picks.json', 'utf8'));
const OUT = APT + '/_local/round2'; fs.mkdirSync(OUT, { recursive: true });
const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const VW = 800, VH = 600; const cache = {};
for (const [name, tiles] of Object.entries(cfg)) {
  const parts = [];
  for (let i = 0; i < tiles.length; i++) {
    const [asset, yaw, pitch, hfov] = tiles[i];
    const p = cache[asset] ||= await loadPano(sharp, path.join(APT, '_local/generated', picks[asset]));
    const img = await sharp(render(p, yaw, pitch, hfov, VW, VH), { raw: { width: VW, height: VH, channels: 3 } }).png().toBuffer();
    parts.push({ input: img, left: (i % 2) * (VW + 8), top: Math.floor(i / 2) * (VH + 8) });
  }
  const f = path.join(OUT, name + '.png');
  await sharp({ create: { width: 2 * VW + 8, height: 2 * VH + 8, channels: 3, background: '#fff' } }).composite(parts).png().toFile(f);
  await sharp(f).jpeg({ quality: 85 }).toFile(path.join(process.argv[3], name + '.jpg'));
  console.log(f);
}
