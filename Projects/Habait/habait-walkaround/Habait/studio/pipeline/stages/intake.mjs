/* Stage 1 — intake: the LLM reads EVERYTHING the user uploaded (sales plan PDFs, renders, photos, notes)
   and returns one structured intake.json (zod-validated). Nothing here draws a wall: the geometry stays the
   plan stage's job (D-WQ-10). Backends in lib/llm.mjs: the API key, or Eliran's Claude subscription via the
   Claude Code CLI; mock mode (HABAIT_MOCK_LLM=1, or no backend + a fixture) answers from fixtures/ at $0. */
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod/v4';
import { STUDIO, TOOLS } from '../../lib/env.mjs';
import { structured, listInputs, imageInput, backendFor } from '../../lib/llm.mjs';

const ROOM_TYPES = ['living', 'kitchen', 'dining', 'hall', 'bedroom', 'master_bedroom', 'wardrobe', 'bathroom', 'wc',
  'mamad', 'terrace', 'balcony', 'laundry', 'storage', 'corridor', 'other'];

export const IntakeSchema = z.object({
  developer: z.string().nullable(),
  project_name: z.string().nullable(),
  address: z.string().nullable().describe('street address or neighbourhood as printed or inferable; null if absent'),
  city: z.string().nullable(),
  building: z.object({
    name: z.string().nullable().describe('e.g. TOWER-RED'),
    floors_total: z.number().nullable(),
    floor_of_unit: z.number().nullable(),
    typical_floor_to_floor_cm: z.number().nullable(),
    has_floor_key: z.boolean().describe('a small key drawing of the whole floor with the unit hatched'),
    has_site_key: z.boolean().describe('a small key drawing of the whole site with several buildings'),
    site_buildings: z.array(z.string()).describe('labels of buildings in the site key, e.g. ["R","Y","G"]'),
    facade_note: z.string().nullable(),
  }),
  unit: z.object({
    number: z.string().nullable(),
    type_mark: z.string().nullable(),
    rooms_count: z.number().nullable(),
    area_m2: z.number().nullable(),
    terrace_m2: z.number().nullable(),
    other_areas: z.array(z.object({ label: z.string(), m2: z.number() })),
  }),
  drawing: z.object({
    scale: z.string().nullable(),
    date: z.string().nullable(),
    architect: z.string().nullable(),
    north_deg_clockwise_from_up: z.number().nullable().describe('direction of the north arrow, degrees clockwise from the top of the unit plan'),
    north_note: z.string().nullable(),
    printed_dimensions_cm: z.array(z.number()),
    is_vector_pdf: z.boolean().nullable(),
  }),
  rooms: z.array(z.object({
    name_he: z.string(), name_en: z.string(),
    type: z.enum(ROOM_TYPES),
    printed_dims_cm: z.array(z.number()).nullable(),
    area_m2: z.number().nullable(),
    is_outdoor: z.boolean(),
    glazing: z.string().nullable().describe('what glass this room has: facade, window, railing, none'),
    notes: z.string().nullable(),
  })),
  openings_summary: z.string().nullable(),
  images: z.array(z.object({
    file: z.string(),
    kind: z.enum(['floor_plan', 'floor_key', 'site_plan', 'exterior_render', 'interior_render', 'photo', 'logo', 'text', 'other']),
    description: z.string(),
    useful_for: z.array(z.string()).describe('which pipeline stages can use it: tower_mass, facade_look, interior_look, site_context, plan_trace'),
  })),
  style_hints: z.array(z.string()).describe('materials, palette and mood visible in the developer renders'),
  uncertainties: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export const SYSTEM = `You read Israeli real-estate sales plans (תכנית מכר) and developer marketing material for a visualization pipeline.
Extract ONLY what the documents show or print. Where a value is not present, return null and list it in uncertainties.
Hebrew labels: חדר דיור/סלון = living, מטבח = kitchen, פינת אוכל = dining, כניסה/מבואה = hall, חדר שינה הורים = master_bedroom,
חדר שינה = bedroom, פינת ארונות/חדר ארונות = wardrobe, חדר רחצה = bathroom, שירותים = wc, ממ"ד = mamad, מרפסת שמש/מרפסת = terrace.
Printed dimensions on a plan are centimetres; areas (שטח) are m². The north arrow sits beside the floor key; report its
direction as degrees clockwise from the top of the unit plan. "קו בניין" / "גבול מגרש" lines mark the plot. A floor key
(מפתח קומה) is the small whole-floor outline with the unit hatched; a site key (מפתח אתר) shows all buildings with letters.
For each uploaded image say what it is and which pipeline stage can use it. Do not invent an address: if only the project
and city are known, put the city in city and leave address null. Measurements must be read, never estimated from pixels.`;

export default {
  id: 'intake',
  title_he: 'קריאת המסמכים (LLM)',
  title_en: 'Intake: the LLM reads every upload',
  paid: true,
  needs(ctx) {
    const files = ctx.store.files(ctx.id);
    if (!files.length) return 'no files uploaded yet: add the sales plan PDF (and any developer images)';
    if (!ctx.env.hasLLM && !ctx.project.options?.fixture) return 'no LLM backend: set ANTHROPIC_API_KEY in the root .env, or install Claude Code (claude on PATH), or set options.fixture for mock mode';
    return null;
  },
  async run(ctx) {
    const { env, project } = ctx;
    const fx = project.options?.fixture;
    if (!env.hasLLM) {
      const file = fx ? path.join(STUDIO, 'fixtures', `${fx}.intake.json`) : null;
      if (!file || !fs.existsSync(file)) return { status: 'blocked', note: `mock mode needs a fixture (options.fixture); none at ${file}` };
      const parsed = IntakeSchema.safeParse(JSON.parse(fs.readFileSync(file, 'utf8')));
      if (!parsed.success) return { status: 'blocked', note: `fixture does not match IntakeSchema: ${parsed.error.issues[0]?.path.join('.')}` };
      ctx.saveDerived('intake.json', { ...parsed.data, _meta: { source: 'mock-fixture', fixture: fx, at: new Date().toISOString() } });
      ctx.log(`intake from fixture ${fx} (no LLM backend)`);
      return { status: 'done', note: `mock: fixture ${fx}`, outputs: ['derived/intake.json'], cost_usd: 0 };
    }

    const cwd = ctx.paths.dir;
    const inputs = listInputs(ctx.paths.intake, cwd);
    if (!inputs.length) return { status: 'blocked', note: 'no readable files (pdf / png / jpg / webp / txt)' };
    // a sales plan is a raster page: render it whole + as 300-dpi tiles so the small print is legible to the model
    const extra = [];
    for (const f of inputs.filter((x) => x.kind === 'pdf')) {
      const outDir = path.join(ctx.paths.derived, '.cache', 'pdf', path.basename(f.name, '.pdf').replace(/[^\w֐-׿-]+/g, '_'));
      const idx = path.join(outDir, 'index.json');
      if (!fs.existsSync(idx)) { const r = await ctx.run(env.PYTHON, ['-I', path.join(TOOLS, 'prep_pdf.py'), f.full, outDir]); if (r.code !== 0) { ctx.log(`prep_pdf failed for ${f.name}; the PDF goes in as is`); continue; } }
      for (const im of JSON.parse(fs.readFileSync(idx, 'utf8'))) {
        const note = im.kind === 'overview' ? `whole page ${im.page} of "${f.name}" at low resolution: layout, keys, north arrow` : `page ${im.page} of "${f.name}", ${im.region}-${im.side} tile at 300 dpi: read numbers and labels here`;
        extra.push(imageInput(im.file, cwd, note));
      }
    }
    inputs.push(...extra);
    if (extra.length) ctx.log(`${extra.length} page renders/tiles prepared for the PDF(s)`);
    const prepImage = async (file) => {
      const st = fs.statSync(file);
      if (st.size < 3_500_000) return file;
      const out = path.join(ctx.paths.derived, '.cache', `${path.basename(file)}.prep.jpg`);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      if (!fs.existsSync(out)) { const r = await ctx.run(env.PYTHON, ['-I', path.join(TOOLS, 'prep_image.py'), file, out, '--max', '2000']); if (r.code !== 0) return null; }
      return out;
    };
    const task = `Project name given by the user: ${project.name || '-'}; address given by the user: ${project.address || '-'}; notes: ${project.notes || '-'}.\nRead all the files and fill the schema. Every number (areas in the title-block table, printed room dimensions, the date, the scale, floor and unit numbers) must be read off a 300-dpi tile, not the overview; if two tiles disagree, say so in uncertainties. Report the number of floors only if printed; otherwise null.`;
    // plan studio-agent-fal: a read through fal is paid — the project cap is checked BEFORE the call (estimate $0.50)
    if (backendFor(env) === 'fal') { const gate = ctx.spendGate(0.5); if (gate) return { status: 'blocked', note: `fal LLM: ${gate}`, cost_usd: 0 }; }
    const r = await structured({ env, log: ctx.log, dir: cwd, inputs, system: SYSTEM, task, schema: IntakeSchema, prepImage, allowFal: true });
    if (r.usd || r.backend) ctx.spend({ stage: 'intake', endpoint: `${r.backend}:${r.model || '-'}`, usd: Math.round((r.usd || 0) * 1e4) / 1e4, note: r.note || '' });
    if (!r.ok) {
      if (r.raw) fs.writeFileSync(ctx.file('derived', 'intake.raw.txt'), r.raw);
      return { status: 'blocked', note: `${r.note}${r.raw ? ' (raw saved to derived/intake.raw.txt)' : ''}`, cost_usd: r.usd || 0 };
    }
    const data = r.data;
    ctx.saveDerived('intake.json', { ...data, _meta: { source: 'llm', backend: r.backend, model: r.model, files: inputs.map((f) => f.name), usage: r.usage, usd: r.usd || 0, note: r.note, at: new Date().toISOString() } });
    const status = data.confidence >= 0.6 ? 'done' : 'needs-review';
    return { status, note: `${r.backend === 'cli' ? 'Claude (subscription)' : r.model}: ${data.rooms.length} rooms, ${data.images.length} files read, confidence ${data.confidence}; ${data.uncertainties.length} open points`, outputs: ['derived/intake.json'], cost_usd: r.usd || 0 };
  },
};
