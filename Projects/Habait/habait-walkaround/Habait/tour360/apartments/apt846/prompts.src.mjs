// apartments/apt846/prompts.src.mjs — the generator's recipe for apartment 846 (Rainbow Tel Aviv, TOWER-RED floor 16, type L), 2026-10-28.
// `node apartments/apt846/prompts.src.mjs` writes prompts.json beside it (tools/gen-pano.mjs reads that). The plan references come
// from tools/make-refs.mjs (cameras.json); the style reference is the approved living-room panorama (_local/refs/style-living.png).
// 2026-11-01 (Eliran): the look revised to the current line - a bulthaup b3 kitchen, zero-line doors, handleless matte-lacquer fronts, no panels, no brown fronts.
// Slava's rulings 2026-10-28: furnished as the sales plan draws it, one Tel Aviv luxury look in every room; windows neutral — bright
// sky and a soft unrecognisable city haze, no landmark, no sea (an invented view of a real unit would misrepresent it).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const USE = 'Use case: photorealistic interior for an interactive 360 apartment tour of a real new-build apartment (floor 16 of a Tel Aviv tower).';
const ASSET = (what) => `Asset type: ONE full-spherical equirectangular panorama of ${what}, 360 degrees horizontally by 180 degrees vertically, exactly 2:1. Not a wide-angle photograph and not a collage.`;
const INPUT_PLAN = 'Image 1 is a top-down architect\'s floor plan (an Israeli sales plan: thick grey walls, Hebrew labels, furniture drawn as dashed outlines, hatching on the terrace); the red dot is the camera and the red arrow is the direction at the CENTRE of the panorama. Use it for the layout, the openings, the furniture positions and the distances only; never draw the plan, its lines, hatching, colours or any text.';
const INPUT_STYLE = 'Image 2 is the approved panorama of this same apartment\'s living room: match its materials, colours, light and photographic style exactly, and do not reproduce its room or its furniture.';
const PROJECTION = 'MANDATORY PROJECTION: horizon exactly halfway up; the top edge is the ceiling directly overhead, the bottom edge is the floor directly below; natural equirectangular curvature of ceiling and floor lines; vertical edges stay vertical and straight walls stay straight, never bowed; the left and right edges of the image join seamlessly because both show the direction straight behind the camera.';
const STYLE = 'Style, one designer look for the whole apartment, the current (2026) high-end Tel Aviv tower line, calm, bright and precise - large-format pale limestone-look porcelain floor tiles (120 by 120 cm, matte, light sand), warm white plastered walls, a micro-cement feature wall in warm greige behind the TV; every interior door is a zero-line door: full-height, frameless, flush with the wall, concealed hinges, no architrave, no panels, painted the wall colour, a slim matte black lever; all cabinetry is handleless with recessed grip channels, matte lacquer in warm white, sand grey or graphite, never wood-grain or brown fronts, never framed or panelled fronts; slim black-framed floor-to-ceiling glazing, matte black and brushed stainless fittings, ivory and sand textiles, linen curtains, slim recessed ceiling spots and a linear LED cove, ceiling 2.9 m, soft bright morning daylight from the glass facade, realistic shadows, realistic domestic proportions, nothing oversized.';
const KITCHEN = 'The kitchen is in the bulthaup b3 style: one long monolithic run of handleless fronts in matte sand-grey lacquer with a continuous recessed horizontal grip channel in brushed aluminium, a very thin (12 mm) brushed stainless-steel worktop with a flush integrated stainless sink and a slim stainless tap, a brushed stainless-steel function-wall splashback carrying one long horizontal rail with a few utensils and two slim open shelves, a flush black induction hob under a slim ceiling-flush extractor, tall units in the same matte lacquer with the fridge and ovens fully integrated behind flush fronts; no visible handles, no framed or panelled fronts, no wood-grain or brown fronts, no stone splashback.';
const WINDOWS = 'Through every window and glass wall: floor 16 of a high-rise — a bright, hazy, slightly overexposed sky and, far below, a soft, out-of-focus, unrecognisable pale city haze; no landmark, no sea, no specific building, no street detail. The terrace railing is frameless clear glass with a slim black handrail.';
const AVOID = 'Avoid: text, labels, watermarks, plan lines, people, pets, mirrored or duplicated rooms, bowed walls where the plan shows straight walls, borders, panels, a fisheye circle, black corners, a visible seam.';

const scene = (id, asset, camera, what, body, { anchor = false, kitchen = false } = {}) => ({
  id: asset,
  sceneId: id,
  camera,
  references: anchor ? [`_local/refs/plan-${asset}.png`] : [`_local/refs/plan-${asset}.png`, '_local/refs/style-living.png'],
  prompt: [USE, ASSET(what), anchor ? `Input image: ${INPUT_PLAN}` : `Input images: ${INPUT_PLAN} ${INPUT_STYLE}`, PROJECTION, body.trim(), STYLE, kitchen ? KITCHEN : '', WINDOWS, anchor ? 'This panorama defines the apartment\'s look; every other room will be matched to it.' : '', AVOID].filter(Boolean).join('\n'),
});

export const scenes = [
  scene('living', '04-living', { crop_px: [1542, 2104], centre_bearing_deg: 111.3, eye_m: 1.6, centre: 'the terrace sliding door' }, 'the open-plan living room', `
Camera: standing at eye height 1.6 m in the living area of an open-plan living, dining and kitchen space about 7.4 m along the glass facade and up to 8 m deep, 1.5 m behind and beside the sofa, looking at the terrace door.
CENTRE (straight ahead, 3.5 m): a wide sliding door in the floor-to-ceiling glass wall, open onto the sun terrace: large pale tiles, a lounge chair, planters with olive trees, a frameless glass railing and bright hazy sky; linen curtains on a black track, pooled to one side.
LEFT-AHEAD (about 40 degrees left, 1.4 m): an ivory boucle L-shaped sofa facing the glass, a round travertine coffee table with a few books and a ceramic bowl, a pale wool rug; an ivory armchair near the glass further ahead.
LEFT (60 to 120 degrees left): the glass wall continues to a round light-oak dining table with six sand-linen chairs under a sculptural pendant, and to the curved glass corner of the facade, with the open bulthaup-style kitchen and its thin brushed stainless-steel worktop beyond.
RIGHT (about 100 degrees right): a solid wall with a micro-cement feature surface in warm greige carrying a large wall-mounted TV over a low handleless cabinet in matte sand-grey lacquer, a floor lamp, and further along the zero-line door to the main bedroom (full-height, frameless, flush with the wall, no architrave, painted the wall colour).
BEHIND the camera (both image edges): the open space toward the entrance: an ivory armchair, the kitchen's tall column of handleless matte sand-grey lacquer units far left-behind, and about 7 m away the entrance area with the front door.
`, { anchor: true, kitchen: true }),

  scene('entrance', '01-entrance', { crop_px: [687, 1729], centre_bearing_deg: 105.9, eye_m: 1.6, centre: 'the open living room' }, 'the entrance of the apartment', `
Camera: standing at eye height 1.6 m just inside the apartment's front door, in a compact entrance area about 1.4 m wide that opens straight into the open-plan living space.
CENTRE (straight ahead): the open living room — about 4.5 m ahead the ivory boucle L-shaped sofa seen from its side, a round travertine coffee table, a pale wool rug; beyond them, 7 m ahead, the floor-to-ceiling glass wall with a sliding door onto the sun terrace and bright hazy sky outside.
LEFT-AHEAD (about 30 degrees left, 2.5 m): the end of the kitchen — a tall column of handleless matte sand-grey lacquer units with the fridge and ovens fully integrated behind flush fronts, and beyond it the thin brushed stainless-steel worktop running away along the wall, with the dining table and the curved glass corner far behind it.
LEFT (60 to 110 degrees left, 1.5 m): a short wall with two zero-line doors (full-height, frameless, flush with the wall, concealed hinges, no architrave, painted warm white), a narrow utility door and the guest bathroom door, the bathroom door slightly ajar; a slim wall light between them.
RIGHT-AHEAD (about 45 degrees right): a solid warm-white wall with a low handleless console in matte sand-grey lacquer, a round mirror and a small plant; further along it, the zero-line door into the main bedroom.
BEHIND the camera (both image edges): the apartment's tall front door, flush and frameless in matte graphite, closed, in a warm-white wall, with a slim coat niche with a few black hooks beside it and a recessed light above.
`, { kitchen: true }),

  scene('kitchen', '02-kitchen', { crop_px: [1885, 1198], centre_bearing_deg: 125.5, eye_m: 1.6, centre: 'the dining table and the curved glass' }, 'the open kitchen', `
Camera: standing at eye height 1.6 m in the kitchen aisle of the open-plan space (about 7.4 m along the glass facade and up to 8 m deep), 1 m from the counter.
CENTRE and centre-right (straight ahead, 2.5 m): a round light-oak dining table with six upholstered chairs in sand linen under a sculptural pendant; beyond it, 4 m away, the curved floor-to-ceiling glass wall with the sun terrace and bright hazy sky outside.
LEFT (20 to 90 degrees left): the floor-to-ceiling glazing with slim black frames continues to its rounded far end, the terrace outside with large pale tiles and a planter visible through the glass.
LEFT-BEHIND (about 130 degrees left): the hob end of the kitchen — a flush black induction hob in the thin brushed stainless-steel worktop under a slim ceiling-flush extractor, the brushed stainless-steel function-wall splashback with its long horizontal rail.
RIGHT (60 to 120 degrees right): the open living room — the back of the ivory L-shaped sofa, the coffee table and the glass wall beyond; nearer, the long stainless-steel worktop on handleless matte sand-grey fronts.
BEHIND the camera (both image edges): the long kitchen run along the solid wall: a 12 mm brushed stainless-steel worktop on handleless lower units in matte sand-grey lacquer with a continuous recessed grip channel, a flush integrated stainless sink with a slim stainless tap, a brushed stainless-steel function-wall splashback with one long horizontal rail and two slim open shelves, and at the far right-behind the tall column of fridge and ovens fully integrated behind flush fronts; past it the opening toward the entrance and the second bedroom's zero-line door.
`, { kitchen: true }),

  scene('dining', '03-dining', { crop_px: [2083, 1771], centre_bearing_deg: 56.8, eye_m: 1.6, centre: 'the curved glass wall' }, 'the dining area by the curved glass facade', `
Camera: standing at eye height 1.6 m beside the dining table, 1.2 m from it, near the curved glass facade of the open living, dining and kitchen space.
CENTRE (straight ahead, 2.5 m): the curved floor-to-ceiling glass wall — slim black mullions, the sun terrace outside with large pale tiles, a low planter with olive trees, a frameless glass railing, and a bright hazy sky.
LEFT-AHEAD (about 30 degrees left, 1.2 m): the round light-oak dining table for six with sand-linen chairs under a sculptural pendant, a linen runner and a ceramic bowl.
LEFT (70 to 110 degrees left): the open kitchen: a long run of handleless matte sand-grey lacquer units with a thin brushed stainless-steel worktop and a stainless function-wall splashback along the far wall, a flush hob under a slim ceiling-flush extractor, two slim open stainless shelves, a tall column of integrated appliances behind flush fronts at the far end.
RIGHT (50 to 110 degrees right): the glass wall continues along the living room to a wide sliding door onto the terrace, linen curtains pooled at one end; an ivory armchair by the glass.
BEHIND the camera (both image edges): the living room — the ivory L-shaped sofa and the coffee table 3 m away, the solid wall with the TV panel beyond them, and the entrance area far behind-left.
`, { kitchen: true }),

  scene('terraceLiving', '05-terrace-living', { crop_px: [2800, 2150], centre_bearing_deg: 355.9, eye_m: 1.6, centre: 'along the terrace to its rounded end' }, 'the sun terrace', `
Camera: standing at eye height 1.6 m on the covered sun terrace (2.7 m deep and about 12 m long along the curved glass facade of a 16th-floor apartment), in the middle of its width, outdoors.
CENTRE (straight ahead): the terrace runs 6 m ahead to its rounded far end: large pale porcelain tiles, a low outdoor lounge set in sand-coloured fabric on a black frame, planters with olive trees and grasses, a slim linear light under the pale concrete soffit of the floor above.
LEFT (40 to 120 degrees left): the apartment's floor-to-ceiling glass wall with slim black frames — inside, the dining table and the kitchen are visible; a square structural column clad in warm white stands 1 m to the left against the glass.
RIGHT (40 to 120 degrees right): the terrace's outer edge: a frameless clear glass railing with a slim black handrail; beyond it only a bright hazy sky and, far below, a soft unrecognisable pale city haze.
BEHIND the camera (both image edges): the terrace continuing toward the bedroom end: the living room's open sliding door behind-left with the sofa glimpsed inside, a second lounge chair and a small side table, a second column far behind, and the terrace narrowing into a short passage at the end.
`),

  scene('terraceBedroom', '06-terrace-bedroom', { crop_px: [2250, 3083], centre_bearing_deg: 16.3, eye_m: 1.6, centre: 'along the terrace toward the living room door' }, 'the bedroom end of the sun terrace', `
Camera: standing at eye height 1.6 m at the bedroom end of the covered sun terrace (2.7 m deep, about 12 m long along the glass facade, 16th floor), outdoors, looking along it.
CENTRE (straight ahead): the long terrace stretching 8 m ahead to its rounded far end: large pale porcelain tiles, lounge chairs and planters with olive trees along the glass side, a pale concrete soffit above with a slim linear light.
LEFT (30 to 130 degrees left): the apartment's floor-to-ceiling glass wall with slim black frames — ahead-left the living room's wide sliding door, and behind-left the main bedroom's glazing with sheer linen curtains inside.
RIGHT (40 to 120 degrees right): the frameless glass railing with a slim black handrail; beyond it a bright hazy sky and a soft pale city haze far below, nothing recognisable.
BEHIND the camera (both image edges): a square structural column clad in warm white, a tall planter, and the terrace narrowing into a short passage at its end.
`),

  scene('bedroomMain', '07-bedroom-main', { crop_px: [1420, 3300], centre_bearing_deg: 53.9, eye_m: 1.6, centre: 'the bed and the glass corner' }, 'the main bedroom', `
Camera: standing at eye height 1.6 m in the main bedroom (3.5 by 3.4 m), near its inner corner by the dressing nook, looking across the room.
CENTRE (straight ahead, 2.9 m): a queen-size bed with a tall upholstered headboard in sand boucle against the solid warm-white wall ahead-left, ivory linen bedding, two floating bedside tables in matte sand-grey lacquer with small black sconces, a pale wool rug under it.
AHEAD-RIGHT (about 20 degrees right, 3 m): the room's floor-to-ceiling glass wall with slim black frames and sheer linen curtains, one sliding panel; outside, the covered terrace's pale tiles, a planter and a bright hazy sky.
RIGHT and behind-right (90 to 150 degrees right): the solid end wall with a low handleless dresser in matte sand-grey lacquer, a framed abstract print and a slim floor lamp.
LEFT (70 to 90 degrees left): the zero-line door into the living room, and the open passage into the dressing nook with handleless matte-lacquer wardrobes visible.
BEHIND the camera (both image edges): the inner wall of the bedroom in warm white plaster with a slim linear wall light.
`),

  scene('wardrobe', '08-wardrobe', { crop_px: [979, 2979], centre_bearing_deg: 106.4, eye_m: 1.6, centre: 'the opening into the bedroom' }, 'the dressing nook of the main bedroom', `
Camera: standing at eye height 1.6 m in the dressing nook (1.6 by 1.85 m) between the main bedroom and its bathroom.
CENTRE (straight ahead, 1 m): the open passage into the main bedroom — the bed, the glass wall and daylight visible beyond it.
LEFT and RIGHT (both sides, 0.8 m away): floor-to-ceiling wardrobes with handleless flush fronts in matte sand-grey lacquer, no panels, no frames, one section open showing lit shelves and a hanging rail; a slim LED line in the ceiling, a full-height mirror panel on the right.
BEHIND the camera (both image edges): the zero-line door into the main bathroom, half open, with the vanity and its backlit mirror glimpsed through it.
`),

  scene('bathMain', '09-bath-main', { crop_px: [687, 2917], centre_bearing_deg: 36.8, eye_m: 1.6, centre: 'the vanity' }, 'the main bathroom', `
Camera: standing at eye height 1.6 m in the main bathroom (2.1 by 2.1 m, no window, lit by recessed spots and a backlit mirror).
CENTRE (straight ahead, 1 m): a floating handleless vanity in matte sand-grey lacquer with a pale stone top and an integrated basin, a matte black tap, a wide backlit mirror, large pale stone-look wall tiles.
LEFT (about 70 degrees left): a wall-hung toilet with a concealed cistern and a black flush plate.
RIGHT (about 45 degrees right): the zero-line door into the dressing nook, open, with the wardrobes glimpsed beyond.
BEHIND the camera (both image edges): a built-in bathtub 2.1 m long along the back wall with a matte black rain shower above it and a frameless glass screen, a lit niche in the tiled wall.
`),

  scene('bedroom2', '10-bedroom-2', { crop_px: [1500, 917], centre_bearing_deg: 34.4, eye_m: 1.6, centre: 'the facade window' }, 'the second bedroom', `
Camera: standing at eye height 1.6 m in the second bedroom (3.4 by 2.75 m), near its door, looking toward the window.
CENTRE (straight ahead, 2 m): a wide full-height window on the facade with slim black frames and sheer linen curtains, a bright hazy sky outside.
LEFT-AHEAD (about 50 degrees left, 1.4 m): a double bed with a sand-linen headboard against the left wall, ivory bedding, a small oak bedside table with a lamp, a soft rug.
LEFT-BEHIND (about 120 degrees left): a built-in wardrobe with handleless flush fronts in matte warm-white lacquer, no panels, filling the wall beside the door.
RIGHT (about 90 degrees right): the solid warm-white wall shared with the kitchen, with a small oak desk, a chair and a framed print, a slim wall light.
BEHIND the camera (both image edges): the zero-line door, open, and the corner of the room.
`),

  scene('bathguest', '11-bath-guest', { crop_px: [1042, 1271], centre_bearing_deg: 15.7, eye_m: 1.6, centre: 'the shower' }, 'the guest bathroom', `
Camera: standing at eye height 1.6 m in the guest bathroom (about 1.4 by 2.4 m, no window, lit by recessed spots and a backlit mirror).
CENTRE (straight ahead, 0.8 m): a walk-in shower behind a frameless clear glass screen, large pale stone-look tiles, a matte black rain shower and a lit niche.
LEFT (about 90 degrees left): a wall-hung toilet with a concealed cistern and a slim oak shelf above it.
BEHIND the camera (both image edges): a compact floating handleless vanity in matte sand-grey lacquer with a round basin, a matte black tap and a backlit round mirror behind-left, and the zero-line door, open, behind-right.
`),
];

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = path.join(HERE, 'prompts.json');
  fs.writeFileSync(out, JSON.stringify(scenes, null, 1) + '\n');
  console.log(`${path.relative(process.cwd(), out)}: ${scenes.length} scenes — ` + scenes.map((s) => `${s.id} (${s.prompt.length} chars, ${s.references.length} refs)`).join(' · '));
}
