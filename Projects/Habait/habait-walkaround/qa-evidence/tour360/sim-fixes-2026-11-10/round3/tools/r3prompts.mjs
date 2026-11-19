// round 3 (2026-11-10, Eliran «קודם תתקן את מה שצריך לתקן»): the edit lane for tabs 05-08 — image 1 = the tab's pick (rolled as its skin
// parks the seam), image 2 = the bedroom/terrace element sheet. gen-pano.mjs rolls the answer back. $0.
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const sharp = createRequire('C:/RnD/Projects/Habait/tools/appdeps/package.json')('sharp');
const APT = 'C:/RnD/Projects/Habait/habait-walkaround/Habait/tour360/apartments/apt846';
const picks = JSON.parse(fs.readFileSync(APT + '/_local/picks.json', 'utf8'));
const skins = JSON.parse(fs.readFileSync(APT + '/skin-prompts.json', 'utf8'));
const R = APT + '/_local/round3'; fs.mkdirSync(R, { recursive: true });
const HEAD = (room) => `Image 1 is a finished photorealistic 360-degree equirectangular panorama (2:1; its left and right edges meet behind the camera) of the ${room} of a real apartment. Repaint Image 1 as the SAME photograph from the SAME camera: keep the equirectangular projection, the horizon, every wall, ceiling, column, opening, door, window, glass, railing and curtain, the view outside, the daylight, the floor, and the position, size and shape of every piece of furniture exactly where Image 1 has them. Do not move, add or remove walls, doors or windows. The left and right edges of the result must join seamlessly.
Image 2 is the ELEMENT SHEET of this apartment: four ordinary photographs (tiles) of fixed elements that must look identical from every camera position. It is not a panorama; never draw a sheet, a tile border or a grid.
Image 2: top-left = the main bedroom's bed: a low bed upholstered in beige fabric with an upholstered headboard, white bedding, two white pillows and a chunky cream KNITTED throw across its foot; beside it floating cream nightstands, each with a table lamp with a light ceramic base and a cream shade. top-right = the terrace armchair outside the bedroom: a light wooden frame with woven rattan sides and thick white cushions. bottom-left = the terrace bistro set outside the living room: a small round wooden table with two folding wooden slat chairs, among large pale planters with olive trees. bottom-right = the apartment's framed art: a pale line drawing of a leaf shape on cream paper in a thin black frame.
Wherever one of these elements is visible in Image 1, repaint it to look exactly like its tile (same shape, colour, material), standing where Image 1 has it and at Image 1's size and perspective.
Everything not named here stays exactly as Image 1 shows it. `;
const TABS = {
  '05-terrace-living': ['sun terrace', `In THIS view change only this: the round table with the wooden armchairs that stands on the terrace near the living room's sliding glass door becomes the bistro set of Image 2 bottom-left (the small round wooden table with two folding wooden slat chairs), at the same place. The sun lounger next to the camera, the planters and everything else stay.`],
  '06-terrace-bedroom': ['bedroom terrace', `In THIS view change these: (1) through the glass, inside the bedroom: the bed becomes the upholstered beige bed of Image 2 top-left with the knitted cream throw across its foot (now it is a plain bed on a wooden platform), and the bedside lamp has a light ceramic base and a cream shade (now its base is dark); above the bed the framed drawing of Image 2 bottom-right. (2) The lounge chair standing on the terrace next to the camera becomes the rattan armchair with white cushions of Image 2 top-right. The bistro table with the folding chairs further along the terrace already matches Image 2 bottom-left and stays. (3) Every interior door and wall seen through the glass stays EXACTLY as Image 1 shows it: plain flush WHITE doors with slim black levers, white walls; no wooden door, no grey door, no door frames, no new openings.`],
  '08-wardrobe': ['dressing nook of the main bedroom', `In THIS view change these: (1) the tall closet fronts: every front is one clean flat full-height door whose bottom edge is a straight horizontal line just above the floor on a continuous low plinth; remove the jagged, stepped and torn cuts at the foot of the fronts; the floor meets the plinth in one clean line. (2) The bed in the bedroom becomes the bed of Image 2 top-left: the same upholstered beige bed with the chunky cream KNITTED throw across its foot, and bedside lamps with light ceramic bases. (3) The armchair outside on the terrace is the rattan armchair with white cushions of Image 2 top-right. (4) The framed picture on the bedroom wall is the drawing of Image 2 bottom-right.`],
  '07-bedroom-main': ['main bedroom', `In THIS view change only this: the EMPTY picture frame on the wall above the bed gets the pale leaf line drawing of Image 2 bottom-right inside it (a thin black frame, cream paper, a fine line drawing). Nothing else changes.`],
};
const out = [];
for (const [id, [room, words]] of Object.entries(TABS)) {
  const e = skins.find((s) => s.id === id); const u = e.roll?.u_edge || 0;
  const src = path.join(APT, '_local/generated', picks[id]); const m = await sharp(src).metadata(); const W = m.width, H = m.height, x0 = Math.round(u * W) % W;
  const f = path.join(R, `${id}__base-rolled.png`);
  if (x0) {
    const A = await sharp(src).extract({ left: x0, top: 0, width: W - x0, height: H }).toBuffer(); const B = await sharp(src).extract({ left: 0, top: 0, width: x0, height: H }).toBuffer();
    await sharp({ create: { width: W, height: H, channels: 3, background: '#000' } }).composite([{ input: A, left: 0, top: 0 }, { input: B, left: W - x0, top: 0 }]).png().toFile(f);
  } else await sharp(src).png().toFile(f);
  out.push({ id, scene: id, room, references: [`_local/round3/${id}__base-rolled.png`, '_local/round3/sheet-bedroom-terrace.png'], prompt: HEAD(room) + words, ...(x0 ? { roll: { u_edge: u } } : {}), base: picks[id], size: [W, H] });
}
fs.writeFileSync(R + '/prompts.json', JSON.stringify(out, null, 1));
console.log(out.map((o) => `${o.id} ${o.size} roll ${o.roll?.u_edge || 0} base ${o.base}`).join('\n'));
