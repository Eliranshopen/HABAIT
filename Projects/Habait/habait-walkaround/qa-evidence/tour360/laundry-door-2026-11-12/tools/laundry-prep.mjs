// laundry-prep.mjs (2026-11-12, Eliran: «תעשה כמו שזה נראה בתכנית מכר»): one edit per SHIPPED picture (base pick + three floor sets) of the
// tabs that see the laundry niche: the door on the niche goes, the niche is OPEN with a washing machine in it, as the sales plan draws it
// (circle in a square, no door line, no swing). A paste tool then takes ONLY the niche's region of each answer onto the shipped picture.
// Inputs are PNG copies of what ships today. $0 (no call here). Run from habait-walkaround with HABAIT_APP_DIR set.
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const sharp = createRequire('C:/RnD/Projects/Habait/tools/appdeps/package.json')('sharp');
const APT = 'C:/RnD/Projects/Habait/habait-walkaround/Habait/tour360/apartments/apt846';
const picks = JSON.parse(fs.readFileSync(APT + '/_local/picks.json', 'utf8'));
const R = APT + '/_local/laundry'; fs.mkdirSync(R + '/in', { recursive: true });
const HEAD = `Image 1 is a finished photorealistic 360-degree equirectangular panorama (2:1; its left and right edges meet behind the camera) of a room in a real apartment. Return the SAME panorama, identical in everything: the same projection and horizon, every wall, ceiling, column, opening, door, window, curtain, the floor and its material, every piece of furniture, rug, lamp, plant, picture and decoration, the view outside and the light, each at exactly the same place, size, shape and colour. There are no skirting boards anywhere and none may appear. Change ONLY this one thing: `;
const NICHE = `the open laundry niche has NO door: where Image 1 shows that tall white flush door with a black lever, there is now an OPEN recess in the wall of exactly the door's width and height, about 60 cm deep, with plain wall-coloured plaster on its back and side walls and the same floor running into it. Inside it, standing on the floor and filling its width, a white front-loading washing machine: a plain white cabinet about 85 cm high with a round glass door ringed in light grey and a slim control panel with one dial along its top front edge. Above the machine the recess is empty plain plaster up to its top. No door, no leaf, no frame, no curtain, no shelf, no cabinet front and no lever anywhere on or in the niche. Do not move, widen or shift the niche; every wall and edge around it stays exactly where it is.`;
const WHERE = {
  '04-living': 'TOWARD THE ENTRANCE, beyond the armchair: of the two white doors on either side of the white wall pillar, the one to the LEFT of the pillar (a tall white flush door with a black lever) closes the laundry niche — ',
  '02-kitchen': 'ACROSS THE LIVING ROOM toward the entrance: on the white wall beside the white pillar, the tall white flush door with a black lever, the nearer of the white doors there, closes the laundry niche — ',
};
const KEEP = {
  '04-living': ' The other white door, to the RIGHT of the pillar (the electrical cabinet), the pillar itself, the console with the vase, the framed print and the front door stay exactly as they are.',
  '02-kitchen': ' The front door, the other white doors and the console with the vase stay exactly as they are.',
};
const out = [];
for (const id of Object.keys(WHERE)) for (const set of ['base', 'parquet', 'concrete', 'marble']) {
  const f = `${R}/in/${id}__${set}.png`;
  if (set === 'base') await sharp(path.join(APT, '_local/generated', picks[id])).png().toFile(f);
  else await sharp(`${APT}/_local/panos-${set}/${id}.webp`).png().toFile(f);
  out.push({ id: `${id}__${set}`, scene: id, set, references: [`_local/laundry/in/${id}__${set}.png`], prompt: HEAD + WHERE[id] + NICHE + KEEP[id] });
}
fs.writeFileSync(R + '/prompts.json', JSON.stringify(out, null, 1));
fs.copyFileSync(APT + '/_local/picks.json', R + '/picks.before-laundry.json');
console.log(out.length, 'entries');
