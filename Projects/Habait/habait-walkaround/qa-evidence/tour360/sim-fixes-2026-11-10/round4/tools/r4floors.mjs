// round 2 (2026-11-10): floor-ONLY finish prompts for the regenerated 01-04 (finish-pano.mjs's house prompt also repaints doors and
// kitchens — it turned 04's open shelves into wall cabinets and the taupe front door white, so it is not used here). Image 1 = the
// tab's pick, rolled as the skin parks its seam; gen-pano.mjs rolls the answer back. $0.
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const sharp = createRequire('C:/RnD/Projects/Habait/tools/appdeps/package.json')('sharp');
const APT = 'C:/RnD/Projects/Habait/habait-walkaround/Habait/tour360/apartments/apt846';
const picks = JSON.parse(fs.readFileSync(APT + '/_local/picks.json', 'utf8'));
const skins = JSON.parse(fs.readFileSync(APT + '/skin-prompts.json', 'utf8'));
const FLOORS = Object.fromEntries(JSON.parse(fs.readFileSync(APT + '/videos.json', 'utf8')).floors.map((f) => [f.id, f.words]));
const R2 = APT + '/_local/round4'; const out = [];
for (const id of ['01-entrance']) {
  const e = skins.find((s) => s.id === id); const u = e.roll?.u_edge || 0;
  const src = path.join(APT, '_local/generated', picks[id]); const m = await sharp(src).metadata(); const W = m.width, H = m.height, x0 = Math.round(u * W) % W;
  const f = path.join(R2, `${id}__pick-rolled.png`);
  if (x0) {
    const A = await sharp(src).extract({ left: x0, top: 0, width: W - x0, height: H }).toBuffer(); const B = await sharp(src).extract({ left: 0, top: 0, width: x0, height: H }).toBuffer();
    await sharp({ create: { width: W, height: H, channels: 3, background: '#000' } }).composite([{ input: A, left: 0, top: 0 }, { input: B, left: W - x0, top: 0 }]).png().toFile(f);
  } else await sharp(src).png().toFile(f);
  for (const [fl, words] of Object.entries(FLOORS)) {
    if (!words) continue;
    out.push({ id: `${id}__floor-${fl}`, scene: id, floor: fl, references: [`_local/round4/${id}__pick-rolled.png`], ...(x0 ? { roll: { u_edge: u } } : {}), source: picks[id],
      prompt: `Image 1 is a finished photorealistic 360-degree equirectangular panorama (2:1; its left and right edges meet behind the camera) of a room in an apartment. Return the SAME panorama, identical in everything that is not the indoor floor: the same projection and horizon, every wall, ceiling, column, door and door colour (the taupe front door stays taupe, the white doors stay white), window, curtain, the kitchen exactly as it is (its open steel shelves with their objects, splashback, hob, oven, sink, tall column), every piece of furniture, rug, lamp, plant, picture and decoration, the view outside and the light, each at exactly the same place, size, shape and colour. Add nothing, remove nothing, move nothing. Change ONLY the material of the INDOOR FLOOR: the pale tile floor everywhere inside the apartment becomes ${words}; one continuous surface running through the whole space and under the furniture, meeting the skirting, the cabinet plinths and the door thresholds in a clean straight line, with natural soft shadows and daylight on it. The rugs stay lying on top of the new floor exactly as they are. The terrace floor outside the glass stays as it is. No patches of the old tile floor remain anywhere indoors. The left and right edges of the result join seamlessly.` });
  }
}
fs.writeFileSync(R2 + '/floor-prompts.json', JSON.stringify(out, null, 1));
console.log(out.map((o) => o.id).join(' '));
