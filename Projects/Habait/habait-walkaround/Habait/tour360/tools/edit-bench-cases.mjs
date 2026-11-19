/* Habait Tour360 — tools/edit-bench-cases.mjs (2026-11-16, plan development/plans/2026-11-16-typed-change-all-tabs.md §4 B2).
   Writes the three cases of the editor speed bench with the handler's OWN wording, so the bench times every candidate on exactly the
   instruction a visitor's turn sends: (people) two people at the dining table · (object) the dining chairs swapped by words ·
   (follow) the people change repeated from another scene with the first scene's edited view as a second image. $0, no network.
     node tools/edit-bench-cases.mjs [--out tools/bench-inputs/edit-speed/cases.json] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assemble, assembleFollow } from '../server/handler.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const i = process.argv.indexOf('--out');
const OUT = i > 0 && process.argv[i + 1] ? path.resolve(process.argv[i + 1]) : path.join(ROOT, 'tools', 'bench-inputs', 'edit-speed', 'cases.json');

// what the text step answers for the two requests (fixed here, so every model gets the same words)
const PEOPLE = { reach: 'object', living: true, body: 'Add two people sitting on the existing dining chairs at the round dining table: a man and a woman in casual clothing, talking over coffee cups on the table, photorealistic, matching the room\'s lighting, perspective and scale, faces natural and relaxed, not looking at the camera.' };
const CHAIRS = { reach: 'object', living: false, body: 'Replace the dining chairs around the round table with black leather dining chairs on slim black metal legs. Keep the same number of chairs, each at the place and scale of the chair it replaces.' };

const doc = {
  $schema: 'tour360/edit-bench-cases.v1',
  written: new Date().toISOString().slice(0, 10),
  note: 'Prompts are server/handler.mjs assemble() / assembleFollow() of the fixed preparations above. Inputs are 1264x848 JPEG views the page cut from the served apt846 tour (tools/follow-live-check.mjs, 2026-11-16).',
  cases: [
    { id: 'people', kind: 'living', images: ['kitchen-dining.jpg'], prompt: assemble(PEOPLE, 1), current_model: 'nb2-1k' },
    { id: 'object', kind: 'object', images: ['kitchen-dining.jpg'], prompt: assemble(CHAIRS, 1), current_model: 'kontext' },
    // the second image is the people case's own result by the current people editor (run 1), written by the bench before this case
    { id: 'follow', kind: 'follow', images: ['dining-table.jpg'], reference_from: { case: 'people', model: 'nb2-1k', run: 1 }, prompt: assembleFollow(PEOPLE), current_model: 'nb2-1k' },
  ],
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n');
console.log(`edit-bench-cases: ${doc.cases.length} cases → ${path.relative(process.cwd(), OUT)}`);
