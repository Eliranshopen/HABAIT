#!/usr/bin/env node
/* Habait Tour360 - make-polish-prompts.mjs (D-WQ-36, the locked polish): one prompt per room for gen-pano's gpt25x lane over the
   FURNISHED CG render (build_scene v1.5, general_furnish.py), where every piece of furniture already stands modelled in Image 1.
   The AI is asked to change surfaces and light only; the material words come from the apartment's material board (D-WQ-22) and
   Image 2 is the finished living room so every room matches its materials (the anchor).
   usage: node tools/make-polish-prompts.mjs <apt> [--renders <dir>] [--anchor <file under apartments/<apt>>] [--out polish-prompts.json]
   Writes apartments/<apt>/<out>; references are relative to apartments/<apt>/. $0. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..', '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const apt = argv.find((a) => !a.startsWith('--') && !argv.includes('--' + a));
if (!apt) { console.error('usage: make-polish-prompts.mjs <apt> [--renders dir] [--anchor file] [--out name]'); process.exit(2); }
const APT = path.join(ROOT, 'apartments', apt);
const renders = path.resolve(opt('--renders', path.join(REPO, '360walkaround', 'tours', `${apt}-furnished`, 'renders')));
const anchor = opt('--anchor', null);
const outName = opt('--out', 'polish-prompts.json');
const board = JSON.parse(fs.readFileSync(path.join(APT, 'material-board.json'), 'utf8'));
const scenes = JSON.parse(fs.readFileSync(path.join(APT, 'scenes.json'), 'utf8')).scenes;

const kindOf = (id) => /terrace/i.test(id) ? 'balcony' : /bath/i.test(id) ? 'bathroom' : /bedroom/i.test(id) ? 'bedroom' : /wardrobe|storage/i.test(id) ? 'storage' : /kitchen|dining/i.test(id) ? 'kitchen' : /entrance|hall/i.test(id) ? 'hall' : /living/i.test(id) ? 'living' : 'other';
const S = board.surfaces;
const roomSurface = (kind) => { const k = board.room_surfaces[kind] || 'walls'; return k === 'FEATURE' ? S.feature : S[k]; };

// --roll-from <file under apartments/<apt>>: the seam parks of make-skin-prompts.mjs --roll auto (its skin-prompts.json carries
// `roll {u_edge, …}` per asset and writes the rolled CG to _local/refs/cg-rolled/<cp>.webp); a rolled entry is generated on the
// rolled CG and gen-pano rolls the answer back by roll.u_edge, so the generative seam sits on the blank wall the chooser picked.
const rollFrom = opt('--roll-from', null);
const rolls = rollFrom ? Object.fromEntries(JSON.parse(fs.readFileSync(path.join(APT, rollFrom), 'utf8')).map((e) => [e.id, e.roll || null])) : {};
const entries = [];
for (const s of scenes) {
  const cg = path.join(renders, `cp-${s.id}`, 'pano.webp');
  if (!fs.existsSync(cg)) { console.log(`${s.asset}: no furnished render yet (${path.relative(REPO, cg)})`); continue; }
  const kind = kindOf(s.id);
  const outdoor = kind === 'balcony' ? ' ' + board.outdoor_line : '';
  const isLiving = s.id === 'living';
  const roll = rolls[s.asset] && rolls[s.asset].u_edge > 0 ? rolls[s.asset] : null;
  const rolled = roll ? path.join(APT, '_local', 'refs', 'cg-rolled', `cp-${s.id}.webp`) : null;
  if (roll && !fs.existsSync(rolled)) { console.error(`${s.asset}: roll given but no rolled CG at ${path.relative(APT, rolled)}`); process.exit(1); }
  const anchorLine = anchor && !isLiving ? ' Image 2 is the finished living room of the SAME apartment, already a photograph: it fixes the materials of this home (the same floor tiles, walls, glazing, oak fronts, counters, ceiling light, daylight and skyline); match it piece for piece.' : '';
  const edges = roll ? 'its left and right edges meet on a plain wall and must continue into each other' : 'its left and right edges meet behind the camera';
  const prompt = `Image 1 is a computer render of the ${s.name.en} (${s.name.he}) of a real apartment: a 360-degree equirectangular panorama (2:1; ${edges}) from a fixed camera, with every wall, opening, door and piece of furniture already modelled at its true place and size.${outdoor}${anchorLine} Re-render Image 1 as a photograph of exactly this view: keep the camera, the projection, every wall, window, door, opening, column, ceiling height and every piece of furniture exactly where it is, exactly the same size and silhouette; do not add, remove, move or resize anything, and keep every floor grout line exactly where it is drawn. Change ONLY the surfaces, materials, textures, light and realism: ${S.floor}; ${S.walls}; ${S.ceiling}; ${roomSurface(kind)}; ${S.doors}; ${S.glazing}; ${board.textiles}. Small dressing, in place, nothing large: ${board.dressing[kind] || board.dressing.other}. ${board.light}. ${board.windows} Photoreal materials, natural shadows and reflections, no text, no people, no watermark. ${board.avoid}`;
  const references = [path.relative(APT, rolled || cg).split(path.sep).join('/')];
  if (anchor && !isLiving) references.push(anchor);
  entries.push({ id: s.asset, scene: s.id, kind, prompt, references, ...(roll ? { roll } : {}) });
}
fs.writeFileSync(path.join(APT, outName), JSON.stringify(entries, null, 1));
console.log(`${entries.length} prompts → apartments/${apt}/${outName}${anchor ? ' (anchor ' + anchor + ')' : ''}`);
