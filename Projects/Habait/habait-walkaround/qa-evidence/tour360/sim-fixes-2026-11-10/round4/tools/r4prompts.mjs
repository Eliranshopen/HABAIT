// round 4 (2026-11-10, Eliran: «דלת הכניסה תהיה בצבע לבן קו אפס ולא חום … אותו דבר מכל לשונית»): the edit lane for the front door in 01-04
// (a colour recolour left ragged brown edges on the near door of 01). Image 1 = the tab's pick, rolled as its skin parks the seam.
// Only the door's region of each answer is taken (r4paste.py); everything else stays the gated pick. $0.
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const sharp = createRequire('C:/RnD/Projects/Habait/tools/appdeps/package.json')('sharp');
const APT = 'C:/RnD/Projects/Habait/habait-walkaround/Habait/tour360/apartments/apt846';
const picks = JSON.parse(fs.readFileSync(APT + '/_local/picks.json', 'utf8'));
const skins = JSON.parse(fs.readFileSync(APT + '/skin-prompts.json', 'utf8'));
const R = APT + '/_local/round4';
const HEAD = `Image 1 is a finished photorealistic 360-degree equirectangular panorama (2:1; its left and right edges meet behind the camera) of a place in a real apartment. Repaint Image 1 as the SAME photograph from the SAME camera: keep the projection, the horizon, every wall, ceiling, column, opening, window, curtain, the floor, the view outside, the light, and every piece of furniture and decoration exactly as Image 1 has them, at the same place and size. The left and right edges of the result must join seamlessly. Change ONLY this: THE APARTMENT'S FRONT DOOR (the one brown / taupe door in the picture, with a small peephole) becomes a WHITE ZERO-LINE DOOR: one plain flush full-height leaf painted exactly the white of the wall around it, set flush in the wall with only a hair-thin shadow gap around the leaf; NO frame, NO architrave, NO portal, NO panel above the leaf, no wood, no brown, no taupe anywhere on or around it — where the door's brown frame or surround was, there is plain white wall. It keeps ONE slim matte black lever handle at hand height and the small black peephole. The door stays exactly where it is, the same width and height. `;
const EXTRA = {
  '01-entrance': 'The door mat on the floor in front of it and the oak console with the vase stay exactly as they are.',
  '02-kitchen': 'The other white doors beside it, the console with the vase and the armchair stay exactly as they are.',
  '03-dining': 'ALSO, one more change: in the hallway behind the kitchen, the tall white unit that carries a LONG vertical black bar handle becomes a plain flush white door leaf with ONE small matte black lever handle at hand height; remove the long bar handle. The console with the vase beside the front door stays exactly as it is.',
  '04-living': 'The console with the vase beside it and the white doors stay exactly as they are.',
};
const out = [];
for (const id of Object.keys(EXTRA)) {
  const e = skins.find((s) => s.id === id); const u = e.roll?.u_edge || 0;
  const src = path.join(APT, '_local/generated', picks[id]); const m = await sharp(src).metadata(); const W = m.width, H = m.height, x0 = Math.round(u * W) % W;
  const f = path.join(R, `${id}__base-rolled.png`);
  if (x0) {
    const A = await sharp(src).extract({ left: x0, top: 0, width: W - x0, height: H }).toBuffer(); const B = await sharp(src).extract({ left: 0, top: 0, width: x0, height: H }).toBuffer();
    await sharp({ create: { width: W, height: H, channels: 3, background: '#000' } }).composite([{ input: A, left: 0, top: 0 }, { input: B, left: W - x0, top: 0 }]).png().toFile(f);
  } else await sharp(src).png().toFile(f);
  out.push({ id: `${id}__door`, scene: id, references: [`_local/round4/${id}__base-rolled.png`], prompt: HEAD + EXTRA[id], ...(x0 ? { roll: { u_edge: u } } : {}), base: picks[id] });
}
fs.writeFileSync(R + '/door-prompts.json', JSON.stringify(out, null, 1));
console.log(out.map((o) => `${o.id} roll ${o.roll?.u_edge || 0} base ${o.base}`).join('\n'));
