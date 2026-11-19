// round 5 (2026-11-10, Eliran: «שלא יהיה פאנלים בין הקירות לרצפה»): one edit per SHIPPED picture (base pick + three floor sets) that removes
// the skirting board; r5band.py then takes only the wall-foot band of each answer. Inputs are PNG copies of what ships today. $0.
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const sharp = createRequire('C:/RnD/Projects/Habait/tools/appdeps/package.json')('sharp');
const APT = 'C:/RnD/Projects/Habait/habait-walkaround/Habait/tour360/apartments/apt846';
const picks = JSON.parse(fs.readFileSync(APT + '/_local/picks.json', 'utf8'));
const R = APT + '/_local/round5'; fs.mkdirSync(R + '/in', { recursive: true });
const TABS = ['01-entrance', '02-kitchen', '03-dining', '04-living', '07-bedroom-main', '08-wardrobe', '10-bedroom-2', '06-terrace-bedroom'];
const PROMPT = `Image 1 is a finished photorealistic 360-degree equirectangular panorama (2:1; its left and right edges meet behind the camera) of a room in a real apartment. Return the SAME panorama, identical in everything: the same projection and horizon, every wall, ceiling, column, opening, door, window, curtain, the floor and its material, every piece of furniture, rug, lamp, plant, picture and decoration, the view outside and the light, each at exactly the same place, size, shape and colour. Change ONLY this: REMOVE EVERY SKIRTING BOARD (baseboard). Along the foot of every wall, column, door frame and closet front there is now NO skirting board, no baseboard, no white strip, no moulding and no plinth line: the plain wall surface runs straight down and meets the floor directly in one clean, sharp line, with only a fine natural contact shadow. Where a skirting board was, paint the same wall surface as just above it, down to the floor. The floor itself, its colour and its pattern do not change. The left and right edges of the result join seamlessly.`;
const out = [];
for (const id of TABS) for (const set of ['base', 'parquet', 'concrete', 'marble']) {
  const f = `${R}/in/${id}__${set}.png`;
  if (set === 'base') await sharp(path.join(APT, '_local/generated', picks[id])).png().toFile(f);
  else await sharp(`${APT}/_local/panos-${set}/${id}.webp`).png().toFile(f);
  out.push({ id: `${id}__${set}`, scene: id, set, references: [`_local/round5/in/${id}__${set}.png`], prompt: PROMPT });
}
fs.writeFileSync(R + '/prompts.json', JSON.stringify(out, null, 1));
fs.copyFileSync(APT + '/_local/picks.json', R + '/picks.before-round5.json');
console.log(out.length, 'entries');
