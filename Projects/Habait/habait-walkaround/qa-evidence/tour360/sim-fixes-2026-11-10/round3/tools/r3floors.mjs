// round 3 (2026-11-10): floor-ONLY finish prompts for the corrected 05-08 (same lane as round 2's r2floors.mjs). The outdoor terrace
// floor stays the pale tile in every finish (as 03/04 already show it through the glass). $0.
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const sharp = createRequire('C:/RnD/Projects/Habait/tools/appdeps/package.json')('sharp');
const APT = 'C:/RnD/Projects/Habait/habait-walkaround/Habait/tour360/apartments/apt846';
const picks = JSON.parse(fs.readFileSync(APT + '/_local/picks.json', 'utf8'));
const skins = JSON.parse(fs.readFileSync(APT + '/skin-prompts.json', 'utf8'));
const FLOORS = Object.fromEntries(JSON.parse(fs.readFileSync(APT + '/videos.json', 'utf8')).floors.map((f) => [f.id, f.words]));
const R = APT + '/_local/round3'; const out = [];
const KEEP = `Return the SAME panorama, identical in everything that is not the indoor floor: the same projection and horizon, every wall, ceiling, column, door and door colour, window, glass, railing, curtain, closet front, every piece of furniture, bed, rug, lamp, plant, picture and decoration, the view outside and the light, each at exactly the same place, size, shape and colour. Add nothing, remove nothing, move nothing.`;
for (const id of ['05-terrace-living', '06-terrace-bedroom', '07-bedroom-main', '08-wardrobe']) {
  const e = skins.find((s) => s.id === id); const u = e.roll?.u_edge || 0; const terrace = /terrace/.test(id);
  const src = path.join(APT, '_local/generated', picks[id]); const m = await sharp(src).metadata(); const W = m.width, H = m.height, x0 = Math.round(u * W) % W;
  const f = path.join(R, `${id}__pick-rolled.png`);
  if (x0) {
    const A = await sharp(src).extract({ left: x0, top: 0, width: W - x0, height: H }).toBuffer(); const B = await sharp(src).extract({ left: 0, top: 0, width: x0, height: H }).toBuffer();
    await sharp({ create: { width: W, height: H, channels: 3, background: '#000' } }).composite([{ input: A, left: 0, top: 0 }, { input: B, left: W - x0, top: 0 }]).png().toFile(f);
  } else await sharp(src).png().toFile(f);
  for (const [fl, words] of Object.entries(FLOORS)) {
    if (!words) continue;
    const change = terrace
      ? `The camera stands on the OUTDOOR terrace: the terrace's own pale tile floor stays exactly as it is. Change ONLY the floor INSIDE the apartment, seen through the glass: indoors the pale tile floor becomes ${words}; one continuous surface under the furniture, meeting the skirting and the sliding-door threshold in a clean line. The rugs stay on top of it.`
      : `Change ONLY the material of the INDOOR FLOOR: the pale tile floor everywhere inside the apartment becomes ${words}; one continuous surface running through the whole space and under the furniture, meeting the skirting, the closet plinths and the door thresholds in a clean straight line, with natural soft shadows and daylight on it. The rugs stay lying on top of the new floor exactly as they are. The terrace floor outside the glass and the tiled floor of a bathroom seen through a doorway stay as they are. No patches of the old tile floor remain anywhere else indoors.`;
    out.push({ id: `${id}__floor-${fl}`, scene: id, floor: fl, references: [`_local/round3/${id}__pick-rolled.png`], ...(x0 ? { roll: { u_edge: u } } : {}), source: picks[id],
      prompt: `Image 1 is a finished photorealistic 360-degree equirectangular panorama (2:1; its left and right edges meet behind the camera) of a place in an apartment. ${KEEP} ${change} The left and right edges of the result join seamlessly.` });
  }
}
fs.writeFileSync(R + '/floor-prompts.json', JSON.stringify(out, null, 1));
console.log(out.map((o) => o.id).join(' '));
