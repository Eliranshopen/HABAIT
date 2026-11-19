/* Step 31 - draws every swap ring's outline (tour360 apartments/hatzav/markers.json) and every door marker (scenes.json) over its
   balanced panorama, so the eye can check that a ring sits on its piece and a door arrow on its door ($0).
   Usage: node scripts/31_tour360_marker_overlay.mjs <apartment dir> <out dir> */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const sharp = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json')('sharp');
const APT = path.resolve(process.argv[2]);
const OUT = path.resolve(process.argv[3]);
fs.mkdirSync(OUT, { recursive: true });
const mk = JSON.parse(fs.readFileSync(path.join(APT, 'markers.json'), 'utf8'));
const sc = JSON.parse(fs.readFileSync(path.join(APT, 'scenes.json'), 'utf8')).scenes;
const W = 2048, H = 1024;
const X = (yaw) => ((0.5 + yaw / 360) % 1 + 1) % 1 * W, Y = (pitch) => (0.5 - pitch / 180) * H;
const hsPitch = (v) => -12 - Math.min(5, (v - 0.6) * 35) - Math.max(0, (v - 0.6 - 5 / 35) * 180);
for (const s of sc) {
  const m = (mk.scenes[s.id] || {}).markers || [];
  let g = '';
  for (const r of m) {
    for (const o of r.outlines) g += `<polygon points="${o.map((q) => X(q[0]).toFixed(1) + ',' + Y(q[1]).toFixed(1)).join(' ')}" fill="none" stroke="#ffcc00" stroke-width="3"/>`;
    g += `<circle cx="${X(r.yaw)}" cy="${Y(r.pitch)}" r="12" fill="none" stroke="#ff3355" stroke-width="4"/><text x="${X(r.yaw) + 16}" y="${Y(r.pitch) - 8}" font-size="22" fill="#ff3355" font-family="Arial">${r.category}</text>`;
  }
  for (const h of s.hotspots) g += `<circle cx="${h.u * W}" cy="${Y(hsPitch(h.v))}" r="16" fill="#00c2ff" opacity="0.8"/><text x="${h.u * W + 20}" y="${Y(hsPitch(h.v)) + 8}" font-size="22" fill="#00c2ff" font-family="Arial">→ ${h.to}</text>`;
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${g}</svg>`);
  await sharp(path.join(APT, 'panos', 'balanced', s.asset + '.webp')).composite([{ input: svg }]).jpeg({ quality: 80 }).toFile(path.join(OUT, `overlay-${s.id}.jpg`));
  console.log(`overlay-${s.id}.jpg: ${m.length} rings, ${s.hotspots.length} doors`);
}
