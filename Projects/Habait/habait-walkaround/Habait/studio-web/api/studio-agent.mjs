/* POST /api/studio-agent — the developer's AI agent for one project (signed in, own project only).
   { id, op: 'read' }               → the agent reads the uploaded sales plan(s) and images and writes spec.json, the same intake
                                      schema as Habait/studio/pipeline/stages/intake.mjs (the 846 pipeline's first stage)
   { id, op: 'chat', message }      → a grounded answer: only from spec.json, the file list and the steps' state
   Every call is a paid fal call: the ledger row is opened BEFORE it runs and closed after it (root §7); the hard cap holds.
   Sales-plan fidelity (Eliran 2026-11-04): the agent reads, it never estimates a measurement; what it cannot read goes to
   `uncertainties`, and the developer must approve the reading before any build step (the `approve` step). */
import { json, put, userId, pdir, isPid, readJson, writeJson, files, falLLM, filesForModel, ledgerOpen, ledgerClose, spent, FAL_MODEL } from './_studio.mjs';

export const config = { maxDuration: 300 };

const SPEC_TEMPLATE = `{
 "developer": string|null, "project_name": string|null, "address": string|null, "city": string|null,
 "building": { "name": string|null, "floors_total": number|null, "floor_of_unit": number|null, "typical_floor_to_floor_cm": number|null,
   "has_floor_key": boolean, "has_site_key": boolean, "site_buildings": [string], "facade_note": string|null },
 "unit": { "number": string|null, "type_mark": string|null, "rooms_count": number|null, "area_m2": number|null, "terrace_m2": number|null,
   "other_areas": [{ "label": string, "m2": number }] },
 "drawing": { "scale": string|null, "date": string|null, "architect": string|null, "north_deg_clockwise_from_up": number|null,
   "north_note": string|null, "printed_dimensions_cm": [number], "is_vector_pdf": boolean|null },
 "rooms": [{ "name_he": string, "name_en": string,
   "type": "living"|"kitchen"|"dining"|"hall"|"bedroom"|"master_bedroom"|"wardrobe"|"bathroom"|"wc"|"mamad"|"terrace"|"balcony"|"laundry"|"storage"|"corridor"|"other",
   "printed_dims_cm": [number]|null, "area_m2": number|null, "is_outdoor": boolean, "glazing": string|null,
   "openings": string|null, "fixed_elements": string|null, "notes": string|null }],
 "units": [{ "type_mark": string|null, "number": string|null, "rooms_count": number|null, "area_m2": number|null, "terrace_m2": number|null,
   "other_areas": [{ "label": string, "m2": number }], "floors": string|null, "plan_file": string|null, "plan_page": number|null,
   "rooms": [ ...the same room objects as above... ] }],
 "openings_summary": string|null,
 "images": [{ "file": string, "kind": "floor_plan"|"floor_key"|"site_plan"|"exterior_render"|"interior_render"|"photo"|"logo"|"text"|"other", "description": string }],
 "style_hints": [string], "uncertainties": [string], "confidence": number
}`;

// the 846 intake stage's own instructions (Habait/studio/pipeline/stages/intake.mjs SYSTEM), plus the fidelity fields
const READ_SYSTEM = `You read Israeli real-estate sales plans (תכנית מכר) and developer marketing material for a visualization pipeline.
Extract ONLY what the documents show or print. Where a value is not present, return null and list it in uncertainties.
Hebrew labels: חדר דיור/סלון = living, מטבח = kitchen, פינת אוכל = dining, כניסה/מבואה = hall, חדר שינה הורים = master_bedroom,
חדר שינה = bedroom, פינת ארונות/חדר ארונות = wardrobe, חדר רחצה = bathroom, שירותים = wc, ממ"ד = mamad, מרפסת שמש/מרפסת = terrace.
Printed dimensions on a plan are centimetres; areas (שטח) are m². The north arrow sits beside the floor key; report its
direction as degrees clockwise from the top of the unit plan. A floor key (מפתח קומה) is the small whole-floor outline with the unit
hatched; a site key (מפתח אתר) shows all buildings with letters. List EVERY labelled space as a room, including כניסה/מבואה (entrance),
מעבר (passage), אוורור is NOT a room. "פתח חילוץ" is a rescue opening (an opening on a balcony/terrace edge), never a room size.
A terrace may print its total area and "חלקה המקורה" = its covered part: put the total in unit.terrace_m2 and the covered part in
unit.other_areas with that label. The apartment area (שטח דירה) and the terrace areas are printed in the title-block table: copy them
exactly as printed. When the images include 300-dpi tiles, every number must be read off a tile, not the overview; if two tiles
disagree, say so in uncertainties. For each room also record its openings (doors, windows, glass
walls, which wall) and its fixed elements (kitchen run and where the hob and sink are, WC, basin, shower or bath, closets) exactly as
drawn: the simulation will be checked against them. Do not invent an address. Measurements must be read, never estimated from pixels.
A brochure may hold SEVERAL apartment types, each with its own plan page: put every type in "units" (type mark, rooms, area, terrace,
the page its plan is on, and its own rooms list); then leave the top-level "rooms" as [] and put only the first type's summary (no rooms)
in "unit" — never repeat a rooms list. A single sales plan = one entry in "units" and its rooms in the top-level "rooms" too.
Keep every "openings", "fixed_elements", "glazing" and "notes" value to ≤ 20 words. Marketing pages (renders, lifestyle photos, text)
are described in "images" in ≤ 12 words each; never read dimensions from a render. The developer reads this in Hebrew ONLY:
every free-text value ("uncertainties", "openings", "fixed_elements", "glazing", "notes", "openings_summary", "style_hints",
"images[].description", "north_note") MUST be written in Hebrew, never in English, even when you think in English; room names_en and
the enum values stay as specified.
Answer with ONE JSON object and nothing else, in exactly this shape:
${SPEC_TEMPLATE}`;

// Hebrew-only guard (Eliran 2026-11-05: the uncertainty notes reached him in English). Every developer-facing free-text string that is
// mostly Latin letters is collected and translated in ONE cheap call (ledgered first); names_en, enums and file names are left alone.
const FREE = new Set(['uncertainties', 'openings', 'fixed_elements', 'glazing', 'notes', 'openings_summary', 'style_hints', 'description', 'north_note', 'label']);
const latin = (t) => { const s = String(t || ''); const L = (s.match(/[A-Za-z]/g) || []).length, H = (s.match(/[\u0590-\u05FF]/g) || []).length; return L >= 6 && L > H * 2; };
async function hebrewOnly(spec, uid, id) {
  const refs = [];
  const walk = (o, key) => {
    if (Array.isArray(o)) { o.forEach((v, i) => (typeof v === 'string' ? FREE.has(key) && latin(v) && refs.push([o, i]) : walk(v, key))); return; }
    if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (k === '_meta') continue; if (typeof v === 'string') { if (FREE.has(k) && latin(v)) refs.push([o, k]); } else walk(v, k); }
  };
  walk(spec, '');
  if (!refs.length) return 0;
  const led = await ledgerOpen(uid, id, { step: 'translate', endpoint: `fal:openrouter/router/vision:${FAL_MODEL}`, estUsd: 0.02, note: `${refs.length} English strings → Hebrew` });
  const r = await falLLM({ system: 'Translate each string to natural, short Israeli Hebrew for a real-estate developer. Keep numbers, units and dimensions exactly. Answer with ONE JSON array of strings, same order, same length, nothing else.', prompt: JSON.stringify(refs.map(([o, k]) => o[k])), maxTokens: 3000, temperature: 0 });
  await ledgerClose(uid, id, led.id, { usd: r.usd, state: r.ok ? 'done' : 'failed', note: r.ok ? `${refs.length} strings` : r.note });
  let out = null; try { const t = String(r.text || ''); out = JSON.parse(t.slice(t.indexOf('['), t.lastIndexOf(']') + 1)); } catch { out = null; }
  if (!Array.isArray(out) || out.length !== refs.length) return 0;
  refs.forEach(([o, k], i) => { if (typeof out[i] === 'string' && out[i].trim()) o[k] = out[i].trim(); });
  return refs.length;
}

// pass 1 for a multi-page file: which pages carry plans (cheap, overviews only); pass 2 reads tiles of those pages only
const SURVEY_SYSTEM = `You sort the pages of an Israeli real-estate brochure or sales-plan set for a visualization pipeline. For EVERY page image
say what it is. Kinds: "unit_plan" (an apartment floor plan with room labels and dimensions, the only kind we read closely),
"floor_plan" (a whole-floor plan), "site_plan", "price_list", "spec_text" (מפרט, technical specification), "render" (exterior or
interior visualization), "photo", "cover", "text", "other". For a unit_plan give the apartment type/rooms/area if printed.
Answer with ONE JSON object and nothing else: { "pages": [{ "file": string, "page": number, "kind": string, "note": string }] }`;

const CHAT_SYSTEM = `You are the Habait Studio agent for one real-estate project. The developer uploads the sales plan (תכנית מכר) and
other files; Habait turns them into a buyer-facing site: the project page with its units, the building film, and a 360° apartment tour
with furniture swap and a typed change bar — every image marked הדמיה. You answer the developer about THIS project and guide the next step.
Rules:
- Answer ONLY from the PROJECT DATA below. If it is not there, say so plainly and say which file or step would tell.
- Never invent rooms, areas, prices, dates, names or legal wording. Quote numbers exactly as they appear.
- The simulation must match the sales plan exactly. Point out every uncertainty in the reading that could make it differ, and ask the
  developer to confirm or correct it.
- The steps: upload → read the sales plan → the developer approves the reading → build → fidelity check against the sales plan → publish.
  Say which step is next and what the developer must do.
- Reply in the language of the question (Hebrew by default), short and concrete. No marketing language.`;

function parseObject(text) {
  const s = String(text || ''); const a = s.indexOf('{'); const b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}

export async function POST(request) {
  const uid = await userId(request);
  if (!uid) return json(401, { ok: false, reason: 'login' });
  let body = {};
  try { body = await request.json(); } catch { return json(400, { ok: false, reason: 'body' }); }
  const id = body.id;
  if (!isPid(id)) return json(400, { ok: false, reason: 'id' });
  const base = pdir(uid, id);
  const project = await readJson(`${base}meta.json`);
  if (!project) return json(404, { ok: false, reason: 'missing' });

  // pass 1 of a multi-page file: sort the pages from their overviews, so the tiles (pass 2) are made and read for plan pages only
  if (body.op === 'survey') {
    const prev = body.force ? null : await readJson(`${base}survey.json`);
    const fl = await files(uid, id);
    if (prev && fl.every((f) => !f.pages || prev.pages.some((p) => p.file === f.name))) return json(200, { ok: true, survey: prev, cached: true, spent: await spent(uid, id) });
    const m = await filesForModel(uid, id, { overviewsOnly: true });
    if (!m.images.length) return json(409, { ok: false, reason: 'no_pages', message: 'אין עדיין תמונות עמוד לסקירה' });
    const led = await ledgerOpen(uid, id, { step: 'survey', endpoint: `fal:openrouter/router/vision:${FAL_MODEL}`, estUsd: 0.2, note: `survey ${m.images.length} page overviews` });
    if (!led.ok) return json(402, { ok: false, reason: 'cap', message: `תקרת ההוצאה של הפרויקט ($${led.total.toFixed(2)})` });
    const prompt = ['The page images, in order:', ...m.notes, 'Sort every page and return the JSON.'].join('\n');
    const r = await falLLM({ system: SURVEY_SYSTEM, prompt, images: m.images, maxTokens: 3000, temperature: 0 });
    await ledgerClose(uid, id, led.id, { usd: r.usd, state: r.ok ? 'done' : 'failed', note: r.ok ? `${r.usage?.total_tokens || 0} tokens` : r.note });
    const out = r.ok ? parseObject(r.text) : null;
    if (!out || !Array.isArray(out.pages)) return json(502, { ok: false, reason: 'survey_failed', message: 'סקירת העמודים נכשלה, נסו שוב' });
    const survey = { pages: out.pages.map((p) => ({ file: String(p.file || ''), page: Number(p.page) || 0, kind: String(p.kind || 'other'), note: String(p.note || '').slice(0, 200) })), _meta: { model: FAL_MODEL, usd: r.usd, at: new Date().toISOString() } };
    await writeJson(`${base}survey.json`, survey);
    return json(200, { ok: true, survey, spent: await spent(uid, id) });
  }

  if (body.op === 'read') {
    const survey = await readJson(`${base}survey.json`);
    const READ_KINDS = new Set(['unit_plan', 'floor_plan', 'site_plan', 'price_list']);
    const pages = survey ? new Set(survey.pages.filter((p) => READ_KINDS.has(p.kind)).map((p) => `${p.file}#${p.page}`)) : null;
    const m = await filesForModel(uid, id, { pages: pages && pages.size ? pages : null });
    if (!m.pdfs.length && !m.images.length) return json(409, { ok: false, reason: 'no_files', message: 'אין עדיין קובץ PDF או תמונה לקריאה: העלו את תכנית המכר' });
    const led = await ledgerOpen(uid, id, { step: 'read', endpoint: `fal:openrouter/router/vision:${FAL_MODEL}`, estUsd: 0.6, note: `read ${m.used.join(', ').slice(0, 200)} (${m.images.length} images)` });
    if (!led.ok) return json(402, { ok: false, reason: 'cap', message: `תקרת ההוצאה של הפרויקט ($${led.total.toFixed(2)})` });
    project.steps = { ...(project.steps || {}), read: { state: 'running', at: new Date().toISOString() } };
    await writeJson(`${base}meta.json`, project);
    const sorted = survey ? ['The pages were sorted first (page: kind — note):', ...survey.pages.map((p) => `- ${p.file} p.${p.page}: ${p.kind} — ${p.note}`)] : [];
    const prompt = [`Files: ${m.used.join(', ')}.`, ...sorted, 'The images, in order:', ...(m.notes.length ? m.notes : ['(none)']), 'Read everything and return the JSON.'].join('\n');
    // reasoning shares the output budget: a brochure with three plan pages answers ~18k chars, so leave ample room
    const r = await falLLM({ system: READ_SYSTEM, prompt, pdfs: m.pdfs, images: m.images, maxTokens: 32000, temperature: 0 });
    await ledgerClose(uid, id, led.id, { usd: r.usd, state: r.ok ? 'done' : 'failed', note: r.ok ? `${r.usage?.total_tokens || 0} tokens` : r.note });
    const spec = r.ok ? parseObject(r.text) : null;
    if (spec && (!Array.isArray(spec.rooms) || !spec.rooms.length) && Array.isArray(spec.units) && spec.units[0]?.rooms) spec.rooms = spec.units[0].rooms;
    if (!spec || !Array.isArray(spec.rooms)) {
      const why = r.ok ? `the answer was not the JSON shape (${String(r.text || '').length} chars)` : r.note;
      console.error('[studio-agent] read failed:', why);
      if (r.ok) await put(`${base}debug/read-raw.txt`, String(r.text || ''), { contentType: 'text/plain; charset=utf-8' });
      project.steps.read = { state: 'failed', at: new Date().toISOString(), note: why };
      await writeJson(`${base}meta.json`, project);
      return json(502, { ok: false, reason: 'read_failed', message: 'הקריאה נכשלה, נסו שוב' });
    }
    await hebrewOnly(spec, uid, id);   // the product is Hebrew-first: any English the model still wrote is translated before anyone sees it
    if (!Array.isArray(spec.units) || !spec.units.length) spec.units = [{ ...(spec.unit || {}), rooms: spec.rooms }];
    if (spec.units.length === 1 && !(spec.units[0].rooms || []).length) spec.units[0].rooms = spec.rooms;
    spec._meta = { files: m.used, images: m.images.length, pages: pages ? [...pages] : null, skipped: m.skipped, model: FAL_MODEL, usd: r.usd, at: new Date().toISOString() };
    await writeJson(`${base}spec.json`, spec);
    project.steps.read = { state: 'done', at: spec._meta.at };
    if (project.steps.approve) delete project.steps.approve;   // a new reading needs a new approval
    await writeJson(`${base}meta.json`, project);
    return json(200, { ok: true, spec, project, spent: await spent(uid, id) });
  }

  if (body.op === 'chat') {
    const q = String(body.message || '').trim().slice(0, 2000);
    if (!q) return json(400, { ok: false, reason: 'empty' });
    const [chat, spec, fl] = await Promise.all([readJson(`${base}chat.json`, []), readJson(`${base}spec.json`), files(uid, id)]);
    const data = [
      `PROJECT: ${project.name}`,
      `UPLOADED FILES:\n${fl.map((f) => `- ${f.name} (${Math.round(f.bytes / 1024)} KB)`).join('\n') || '(none)'}`,
      `WHAT THE AGENT READ FROM THE FILES (JSON):\n${spec ? JSON.stringify({ ...spec, _meta: undefined }).slice(0, 30000) : '(the sales plan has not been read yet)'}`,
      `STEPS: ${JSON.stringify(project.steps || {})}`,
    ].join('\n\n');
    const turns = chat.slice(-12).map((t) => `${t.role === 'user' ? 'DEVELOPER' : 'AGENT'}: ${t.content}`).join('\n\n');
    const led = await ledgerOpen(uid, id, { step: 'chat', endpoint: `fal:openrouter/router/vision:${FAL_MODEL}`, estUsd: 0.05, note: 'chat answer' });
    if (!led.ok) return json(402, { ok: false, reason: 'cap', message: `תקרת ההוצאה של הפרויקט ($${led.total.toFixed(2)})` });
    const r = await falLLM({ system: `${CHAT_SYSTEM}\n\n=== PROJECT DATA ===\n${data}\n=== END ===`, prompt: `${turns ? `${turns}\n\n` : ''}DEVELOPER: ${q}\nAGENT:`, maxTokens: 1200 });
    await ledgerClose(uid, id, led.id, { usd: r.usd, state: r.ok ? 'done' : 'failed', note: r.ok ? `${r.usage?.total_tokens || 0} tokens` : r.note });
    if (!r.ok) return json(502, { ok: false, reason: 'agent', message: 'הסוכן לא ענה, נסו שוב' });
    const now = new Date().toISOString();
    const rows = [...chat, { role: 'user', content: q, at: now }, { role: 'assistant', content: r.text.trim(), at: new Date().toISOString() }].slice(-200);
    await writeJson(`${base}chat.json`, rows);
    return json(200, { ok: true, reply: r.text.trim(), chat: rows, spent: await spent(uid, id) });
  }
  return json(400, { ok: false, reason: 'op' });
}
