#!/usr/bin/env node
/* auto-trace.mjs — a developer's sales plan → plan.general.json (846's trace schema) with no hand drawing.
   Plan development/plans/2026-11-04-developer-platform.md P3 (Eliran 2026-11-04: the habait-flow result for ANY uploaded plan).
   A callable step of the portal's job executor (studio-web, fork C): input the uploaded PDF (+ spec.json), output one folder per
   plan drawing with plan.general.json, overlay.png (the image the developer approves) and report.json/.md (what could not be read).

   CONTRACT
     node auto-trace.mjs <input.pdf|crop.png> --out <dir> [options]
       --spec <spec.json>       the portal's reading of the sales plan (studio-agent op:'read'); its room names and printed dims are
                                hints to the vision reading (a label it must find)
       --type <text>            brochure: which dwelling type to trace, matched against the plan page's text / reading
                                (e.g. "158" or "5 חדרים"); default: the first page that carries floor plans
       --id <apartment-id>      default apt-new          --budget <usd>    cap for this run's vision calls (default 1)
       --ledger <ledger.json>   where the paid calls are booked BEFORE they run (default <out>/ledger.json; root §7)
       --env-root <dir>         the folder whose .env holds FAL_KEY / OPENROUTER_API_KEY, read by name (default: this repo root)
       --px-per-cm <n>          a known scale (a 1:50 sheet at 288 dpi = 2.2677); otherwise the scale is FITTED from the printed
                                room dimensions the reading found (brochures print no scale)
       --seeds <seeds.json>     skip the vision reading (tests); --vlm-file <vlm.json> reuse a reading
       --gt <plan.general.json> score against a hand trace in the same frame (tests) [--map a=b,...]
       --rounds <n>             self-correction rounds (default 3)   --review-queue <file.jsonl>   where a FAIL is queued for Habait
       --no-judge               skip the vision judge (recorded)     --judge-runs <n>   judge runs per plan (default 3; 2-of-3 agreement)
       --vector-walls           a CAD-exported PDF: walls/windows/doors from its layers (auto_walls_pdf.py); experimental, off
       --dry                    book nothing, call nothing; print what would run
     OUTPUT  <out>/index.json  { plans: [{ dir, page, floor_label, dwelling_label, plan, overlay, report, rooms, could_not_read }] }
             <out>/plan-<k>/   crop.png · plan-grey.png · vlm.json · seeds.json · barrier.png · split.png · lines.json ·
                               plan.general.json · overlay.png · report.json · report.md · trace.log
     EXIT    0 PASS · 5 FAIL (trace-check found failures; the judge is a REPORT until stable (round 18): blocks the build, appended to --review-queue; the
             developer never sees a FAIL trace) · 1 a step failed · 2 usage · 3 no plan drawing found · 4 budget reached
     CHECK   trace_check.py (hard thresholds: printed dims within max(2 %, 5 cm), labels <-> rooms, door arcs -> openings,
             entrance, windows, wet-room fixtures) + an independent vision judge; on FAIL the tool re-seeds rooms from their
             printed rectangles and re-cuts the open space, up to --rounds (default 3); trace-check.json beside the overlay

   STEPS per plan drawing
     pages   a PDF: auto_pages.py scans every page (text, embedded images); a one-page sheet is rendered and auto-cropped;
             a brochure's large images go through ONE vision call that says which are floor plans (floor, dwelling type)
     prep    auto_prep.py: colour gate (lawn/planting → free, blue windows → glazing lines) → the greyscale the tracer reads
     read    ONE vision call (the tour's own TEXT_MODEL through fal/OpenRouter): room labels with boxes and printed dims,
             fixed elements with boxes, the scale denominator if printed; ledgered before it runs
     mask    trace-plan.mjs: walls = grey fill, glazing = double strokes, door leaves, automatic door gaps
     split   auto_split.py: geodesic Voronoi from the room labels → the open-plan zone boundaries (846 drew these by hand)
     trace   trace-plan.mjs: rooms, walls, openings, panes, cameras
     final   auto_finalize.py: cameras at the pole of inaccessibility, fixtures aligned to the walls, the scale fit, the
             approval overlay, the report
   Secrets by name only (root §8.1): nothing here prints a key. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { appRequire } from './app-require.mjs';
import { fileLedger, loadEnv } from './file-ledger.mjs';
import { chatFetch, hasChat, OPENROUTER_CHAT } from '../server/chat-transport.mjs';
import { TEXT_MODEL } from '../server/handler.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const REPO = path.resolve(ROOT, '..', '..');
const sharp = appRequire(REPO)('sharp');
const PY = process.env.HABAIT_PY || 'C:/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe';
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const input = process.argv[2];
const OUT = path.resolve(arg('--out') || 'auto-trace-out');
const ID = arg('--id', 'apt-new');
const DPI = 288;
const dry = process.argv.includes('--dry');
const t0 = Date.now();
const log = (m) => console.log(`[auto-trace ${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);
if (!input || !fs.existsSync(input)) { console.error('auto-trace: usage: auto-trace.mjs <plan.pdf|crop.png> --out <dir> [options]'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
function run(cmd, args, label) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', cwd: REPO, env: { ...process.env, HABAIT_APP_DIR: process.env.HABAIT_APP_DIR || 'C:/RnD/Projects/Habait/tools/appdeps', PYTHONIOENCODING: 'utf-8' }, maxBuffer: 64 << 20 });
  if (r.status !== 0) { console.error(`auto-trace: ${label} failed (${r.status})\n${(r.stderr || '').slice(-1500)}\n${(r.stdout || '').slice(-800)}`); process.exit(1); }
  return r.stdout || '';
}
const slug = (s) => String(s || 'room').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'room';
const spec = arg('--spec') ? JSON.parse(fs.readFileSync(arg('--spec'), 'utf8')) : null;

// --- the vision call (one per use), ledgered before it runs
const env = loadEnv(arg('--env-root') || REPO);
const ledger = fileLedger(arg('--ledger') || path.join(OUT, 'ledger.json'));
const budget = Number(arg('--budget', '1'));
async function vision(label, system, userText, images, est = 0.02, maxTokens = 9000) {
  if (!hasChat(env)) { console.error('auto-trace: no FAL_KEY / OPENROUTER_API_KEY in the environment or the .env (--env-root)'); process.exit(1); }
  if (ledger.total() + est > budget) { console.error(`auto-trace: budget $${budget} reached ($${ledger.total().toFixed(3)} booked)`); process.exit(4); }
  if (dry) { log(`dry: would call ${TEXT_MODEL} for ${label} with ${images.length} image(s) (≈ $${est})`); return null; }
  const row = ledger.reserve({ ts: new Date().toISOString(), op: `auto-trace-${label}`, apartment: ID, model: TEXT_MODEL, images: images.length, reserved_usd: est, settled_usd: null, status: 'reserved' });
  const content = [{ type: 'text', text: userText }];
  for (const jpg of images) content.push({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + jpg.toString('base64') } });
  const res = await chatFetch(env)(OPENROUTER_CHAT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: TEXT_MODEL, temperature: 0, max_tokens: maxTokens, usage: { include: true }, messages: [{ role: 'system', content: system }, { role: 'user', content }] }) });
  const j = await res.json().catch(() => null);
  const usd = res.ok ? (Number(j?.usage?.cost) || est) : 0;          // a refused call is not billed
  ledger.settle(row, usd, { status: res.ok ? 'done' : `http ${res.status}` });
  if (!res.ok || !j?.choices?.[0]?.message?.content) {
    const why = `the ${label} call failed (HTTP ${res.status}${j?.detail ? `: ${String(typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail)).slice(0, 120)}` : ''})`;
    if (label === 'judge') { log(why); return { _error: why }; }   // no judge = no PASS; the plan is recorded FAIL, the run goes on
    console.error(`auto-trace: ${why}`); process.exit(1);
  }
  const txt = j.choices[0].message.content.replace(/```(json)?/g, '');
  let out; try { out = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1)); } catch {
    try { fs.writeFileSync(path.join(OUT, `${label}-not-json-${Date.now()}.txt`), `finish_reason: ${j.choices[0].finish_reason}\n\n${txt}`); } catch { /* the record is best effort */ }   // (round 19) a paid answer is never lost
    if (label === 'judge') {   // (round 17) a judge answer that is not JSON: recorded, the plan stays FAIL, the run goes on
      const why = `the judge answer was not JSON ($${usd.toFixed(4)} billed): ${txt.slice(0, 160).replace(/\s+/g, ' ')}`;
      log(why); return { _error: why };
    }
    console.error(`auto-trace: the ${label} answer was not JSON`); process.exit(1);
  }
  out._meta = { model: TEXT_MODEL, usd, at: new Date().toISOString(), label };
  log(`${label}: $${usd.toFixed(4)}`);
  return out;
}
const thumbJpg = (file, width) => sharp(file).resize({ width, withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();

// --- 1. the plan drawings: a PNG, a one-page sheet, or a brochure
const plans = [];   // { k, crop, page, floor_label, dwelling_label, page_text }
if (!/\.pdf$/i.test(input)) {
  plans.push({ k: 1, crop: path.resolve(input), page: null, floor_label: null, dwelling_label: null, page_text: '' });
} else {
  const PG = path.join(OUT, 'pages');
  run(PY, ['-I', path.join(HERE, 'auto_pages.py'), 'scan', path.resolve(input), PG], 'pages');
  const doc = JSON.parse(fs.readFileSync(path.join(PG, 'pages.json'), 'utf8'));
  if (doc.sheet) {
    run(PY, ['-I', path.join(HERE, 'auto_pages.py'), 'raster', path.resolve(input), path.join(OUT, 'plan-1'), '--dpi', String(DPI)], 'raster');
    plans.push({ k: 1, crop: path.join(OUT, 'plan-1', 'crop.png'), page: 1, floor_label: null, dwelling_label: null, page_text: doc.page_rows[0].text });
  } else {
    // candidates: large embedded images on pages whose text mentions rooms / m² / a floor / a model
    const re = /חדר|מ"ר|מ״ר|מ'ר|דגם|קומ|m²|sqm|rooms?/i;
    const cands = [];
    for (const p of doc.page_rows) for (const im of p.images) if (im.large && im.thumb && (re.test(p.text) || p.images.filter((x) => x.large).length === 1)) cands.push({ page: p.page, xref: im.xref, px: im.px, thumb: im.thumb, text: p.text.replace(/\s+/g, ' ').slice(0, 300) });
    if (!cands.length) { console.error('auto-trace: no plan drawing found in the brochure (no large image on a page that mentions rooms)'); process.exit(3); }
    const take = cands.slice(0, 12);
    const sys = `You look at images taken from a real-estate marketing brochure (Israeli). For EACH image, in order, say whether it is an apartment / house FLOOR PLAN drawing (a top-down plan with walls and rooms; not a photo, a render, a site map or a facade). Return ONE JSON object: {"images": [{"index": number, "is_floor_plan": boolean, "floor_label": string|null, "dwelling_label": string|null, "rooms_count": number|null, "area_m2": number|null, "note": string|null}]}. floor_label is the floor printed by the plan (e.g. "קומת קרקע", "קומה א'"); dwelling_label the model/type name printed on the page; rooms_count and area_m2 from the page text given with the image. Read, never guess.`;
    const txt = take.map((c, i) => `image ${i + 1}: page ${c.page}, page text: "${c.text}"`).join('\n');
    const cached = fs.existsSync(path.join(PG, 'classify.json')) ? JSON.parse(fs.readFileSync(path.join(PG, 'classify.json'), 'utf8')) : null;
    const cls = cached?.answer?._meta && JSON.stringify(cached.candidates) === JSON.stringify(take) ? (log('pages: reused the cached answer ($0)'), cached.answer) : await vision('pages', sys, txt, await Promise.all(take.map((c) => thumbJpg(c.thumb, 640))), 0.03, 3000);
    fs.writeFileSync(path.join(PG, 'classify.json'), JSON.stringify({ candidates: take, answer: cls }, null, 1));
    if (!cls) process.exit(0);
    const found = (cls.images || []).filter((x) => x.is_floor_plan && take[x.index - 1]).map((x) => ({ ...x, ...take[x.index - 1] }));
    if (!found.length) { console.error('auto-trace: the brochure has no page the model reads as a floor plan'); process.exit(3); }
    const want = arg('--type');
    const key = (f) => `${f.dwelling_label || ''} ${f.rooms_count || ''} ${f.area_m2 || ''} ${f.text}`;
    let chosen = want ? found.filter((f) => key(f).includes(want)) : [];
    if (!chosen.length) { if (want) log(`type "${want}" not found; taking the first page with floor plans`); const pg = found[0].page; chosen = found.filter((f) => f.page === pg); }
    chosen.forEach((f, i) => {
      const dir = path.join(OUT, `plan-${i + 1}`); fs.mkdirSync(dir, { recursive: true });
      run(PY, ['-I', path.join(HERE, 'auto_pages.py'), 'extract', path.resolve(input), String(f.xref), path.join(dir, 'crop.png')], 'extract');
      plans.push({ k: i + 1, crop: path.join(dir, 'crop.png'), page: f.page, floor_label: f.floor_label, dwelling_label: f.dwelling_label, rooms_count: f.rooms_count, area_m2: f.area_m2, page_text: f.text });
    });
    log(`brochure: ${found.length} floor plan(s) found, ${chosen.length} chosen (${chosen.map((f) => `p${f.page} ${f.floor_label || ''}`).join(', ')})`);
  }
}

// --- 2..7 per plan drawing
const ROOM_TYPE = { entrance: 'hall', hall: 'hall', corridor: 'hall', stairs: 'hall', dining: 'hall', living: 'living', kitchen: 'kitchen', bedroom: 'bedroom', master_bedroom: 'bedroom',
  bathroom: 'bathroom', wc: 'bathroom', toilet: 'bathroom', wardrobe: 'storage', storage: 'storage', laundry: 'storage', terrace: 'balcony', balcony: 'balcony', patio: 'balcony', mamad: 'safe_room', safe_room: 'safe_room', other: 'other' };
const OUTDOOR_NAME = /מרפסת|חצר|פטיו|מעבר צר|גינה/;   // (round 18) + גינה: a private garden is traced as an outdoor area   // outdoor rooms by their printed name: they stay outside the envelope
const NOT_A_ROOM = /אוורור|פיר|שאכט|מגרש|גג(?!ון)/;   // (round 18) a private courtyard / garden is an outdoor room now, not dropped
const READ_SYSTEM = `You read an Israeli apartment / house sales plan drawing (תכנית מכר or a brochure plan). Return ONE JSON object, nothing else:
{"scale_denominator": number|null,
 "rooms": [{"name_he": string, "name_en": string, "type": "entrance"|"living"|"kitchen"|"dining"|"bedroom"|"master_bedroom"|"bathroom"|"wc"|"wardrobe"|"storage"|"laundry"|"terrace"|"balcony"|"patio"|"mamad"|"corridor"|"stairs"|"other", "is_outdoor": boolean, "label_box_2d": [ymin, xmin, ymax, xmax], "room_box_2d": [ymin, xmin, ymax, xmax], "dims_cm": [number, number]|null}],
 "fixtures": [{"kind": "counter"|"tall_unit"|"hob"|"sink"|"island"|"wardrobe"|"shower"|"bathtub"|"wc"|"vanity"|"washer", "label": string, "box_2d": [ymin, xmin, ymax, xmax]}],
 "printed_dims_cm": [number]}
Rules: one entry per printed room label (the Hebrew name written inside a room). label_box_2d is the box of that LABEL TEXT; room_box_2d the box of the room's floor area; both normalised 0-1000 to this image, y first. dims_cm: the two dimensions printed with that label (e.g. "310/485" or "3.10x4.85" → [310, 485], in cm), else null. Open-plan spaces that carry separate labels (kitchen, dining corner, living room, entrance) are separate rooms. A terrace, balcony or patio is is_outdoor true. Ventilation shafts, the garden and the plot are not rooms. Fixtures: the drawn built-in elements only (kitchen counter runs, tall units, the hob, the sink, an island, closets, shower trays, bathtubs, WCs, basins/vanities, a washing-machine niche), never loose furniture. Read, never guess: if a label is unreadable, skip it.`;
const index = { input: path.resolve(input), id: ID, model: TEXT_MODEL, plans: [] };
for (const P of plans) {
  // every output stays inside --out: an input PNG elsewhere is copied in, never written beside (an input folder may be live media)
  const inOut = path.resolve(P.crop).startsWith(OUT + path.sep) && path.dirname(path.resolve(P.crop)) !== OUT;
  const dir = inOut ? path.dirname(path.resolve(P.crop)) : path.join(OUT, `plan-${P.k}`);
  fs.mkdirSync(dir, { recursive: true });
  const CROP = path.join(dir, 'crop.png');
  if (path.resolve(P.crop) !== path.resolve(CROP)) fs.copyFileSync(P.crop, CROP);
  const meta = await sharp(CROP).metadata();
  const W0 = meta.width, H0 = meta.height;
  log(`plan ${P.k}: ${W0}×${H0}${P.page ? ` (page ${P.page}${P.floor_label ? `, ${P.floor_label}` : ''})` : ''}`);
  // prep
  const GREY = path.join(dir, 'plan-grey.png');
  log(run(PY, ['-I', path.join(HERE, 'auto_prep.py'), CROP, GREY], 'prep').trim());
  // (2026-11-05) a CAD-exported PDF keeps its layers: walls, windows and doors come from the vectors, exactly (raster prep is the fallback)
  // OFF by default (2026-11-05): on 846 the vector walls lost two rooms and turned rectangles off-axis; opt in with --vector-walls
  if (/\.pdf$/i.test(input) && fs.existsSync(path.join(dir, 'raster.json'))) {
    const rv = spawnSync(PY, ['-I', path.join(HERE, 'auto_walls_pdf.py'), path.resolve(input), String(P.page || 1), path.join(dir, 'raster.json'), String(DPI), dir].concat(process.argv.includes('--vector-walls') ? [] : ['--dims-only']), { encoding: 'utf8', cwd: REPO, env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, maxBuffer: 64 << 20 });
    if (rv.status === 0) log(rv.stdout.trim());
    else if (rv.status === 2) log(`vectors: ${rv.stdout.trim()} (raster prep kept)`);
    else { console.error(`auto-trace: auto_walls_pdf failed (${rv.status})\n${(rv.stderr || '').slice(-800)}`); process.exit(1); }
  }
  // read
  let seeds, vlm;
  if (arg('--seeds')) { seeds = JSON.parse(fs.readFileSync(arg('--seeds'), 'utf8')); vlm = { rooms: [], fixtures: [], source: 'given seeds' }; }
  else {
    if (arg('--vlm-file')) vlm = JSON.parse(fs.readFileSync(arg('--vlm-file'), 'utf8'));
    else {
      const hints = [];
      if (spec?.rooms?.length) hints.push(`The developer's reading of this sales plan lists these rooms — find each label: ${spec.rooms.map((r) => `${r.name_he}${r.printed_dims_cm?.length ? ` (${r.printed_dims_cm.join('×')})` : ''}`).join(', ')}.`);
      if (P.floor_label) hints.push(`This drawing is the ${P.floor_label} of a ${P.rooms_count ? `${P.rooms_count}-room` : ''} ${P.area_m2 ? `${P.area_m2} m²` : ''} dwelling${P.dwelling_label ? ` ("${P.dwelling_label}")` : ''}.`);
      const cachedRead = fs.existsSync(path.join(dir, 'vlm.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'vlm.json'), 'utf8')) : null;
      vlm = cachedRead?._meta?.label === 'read' ? (log('read: reused the cached answer ($0)'), cachedRead) : await vision('read', READ_SYSTEM, `${hints.join(' ')}\nThe plan drawing:`, [await thumbJpg(CROP, 2048)], 0.02);
      if (!vlm) continue;
    }
    const box = (b) => [b[1] / 1000 * W0, b[0] / 1000 * H0, b[3] / 1000 * W0, b[2] / 1000 * H0];
    for (const f of vlm.fixtures || []) if (Array.isArray(f.box_2d) && f.box_2d.length === 4) f.box_px = box(f.box_2d);
    const used = new Set();
    seeds = (vlm.rooms || []).filter((r) => Array.isArray(r.label_box_2d || r.box_2d) && !NOT_A_ROOM.test(r.name_he || '') && !['plot'].includes(r.type)).map((r) => {
      let id = `r-${slug(r.name_en)}`; let n = 2; while (used.has(id)) id = `r-${slug(r.name_en)}-${n++}`; used.add(id);
      const b = box(r.label_box_2d || r.box_2d); const rb = Array.isArray(r.room_box_2d) ? box(r.room_box_2d) : null;
      const dims = Array.isArray(r.dims_cm) && r.dims_cm.length === 2 && r.dims_cm.every((v) => Number(v) > 0) ? r.dims_cm.map(Number) : null;
      return { id: id.replace(/^r-/, ''), room_id: id, name_he: r.name_he, name_en: r.name_en, type: ROOM_TYPE[r.type] || 'other', vlm_type: r.type, is_outdoor: ['terrace', 'balcony', 'patio', 'garden', 'yard', 'courtyard'].includes(r.type) || OUTDOOR_NAME.test(r.name_he || ''), at_px: [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], room_box_px: rb, dims_cm: dims };
    });
  }
  // printed dims from the portal's reading of the sales plan (spec.json): a room the drawing reading gave no dims takes the spec's, by exact name
  if (spec?.rooms?.length) for (const s of seeds) { if (s.dims_cm) continue; const r = spec.rooms.filter((x) => (x.name_he || '').trim() === (s.name_he || '').trim()); const d = r.length === 1 ? (r[0].printed_dims_cm || r[0].dims_cm) : null; if (Array.isArray(d) && d.length === 2 && d.every((v) => Number(v) > 0)) { s.dims_cm = d.map(Number); s.dims_source = 'spec'; } }
  fs.writeFileSync(path.join(dir, 'vlm.json'), JSON.stringify(vlm, null, 1));
  fs.writeFileSync(path.join(dir, 'seeds.json'), JSON.stringify(seeds, null, 1));
  if (!seeds.length) { console.error(`auto-trace: plan ${P.k}: no room labels were read`); process.exit(1); }
  // scale: given, printed, or a first guess from the reading's room boxes vs their printed dims (fitted after the trace)
  let PPC = Number(arg('--px-per-cm')) || 0; let basis = 'given';
  // (round 11) a CAD PDF: the printed dimension lines give the scale exactly (they outrank a read or guessed scale)
  if (!PPC && fs.existsSync(path.join(dir, 'pdf-vectors.json'))) {
    const printed = [...seeds.flatMap((s) => s.dims_cm || []), ...((vlm.printed_dims_cm || []).map(Number)), ...((spec?.rooms || []).flatMap((r) => (r.printed_dims_cm || r.dims_cm || []).map(Number)))].filter((v) => v > 0);
    const fs_ = spawnSync(PY, ['-I', path.join(HERE, 'dim_chains.py'), 'fit-scale', path.join(dir, 'pdf-vectors.json'), printed.join(','), String(+(DPI / 2.54 / 50).toFixed(4))], { encoding: 'utf8', cwd: REPO });
    try { const f = JSON.parse((fs_.stdout || '').trim().split('\n').pop()); if (f.ppc) { PPC = +f.ppc.toFixed(4); basis = `printed dimension lines: ${f.n} printed values measured tick to tick (${f.values.join(', ')})`; } } catch { /* fall through */ }
  }
  if (!PPC && Number(vlm.scale_denominator) > 0) { PPC = +(DPI / 2.54 / Number(vlm.scale_denominator)).toFixed(4); basis = `printed 1:${vlm.scale_denominator} at ${DPI} dpi`; }
  if (!PPC) {
    const g = seeds.filter((s) => s.dims_cm && s.room_box_px).map((s) => { const bw = s.room_box_px[2] - s.room_box_px[0], bh = s.room_box_px[3] - s.room_box_px[1]; return Math.max(bw, bh) / Math.max(...s.dims_cm); }).sort((a, b) => a - b);
    PPC = g.length ? +g[Math.floor(g.length / 2)].toFixed(4) : +(W0 / 1500).toFixed(4);
    basis = g.length ? `guessed from ${g.length} room boxes vs printed dims, then fitted` : 'no printed dims: assumed 15 m across the drawing (UNVERIFIED)';
  }
  log(`scale ${PPC} px/cm (${basis}); ${seeds.length} seeds, ${(vlm.fixtures || []).length} fixtures read`);
  // mask → split → trace
  const camsJson = path.join(dir, 'cameras.json');
  fs.writeFileSync(camsJson, JSON.stringify({ $schema: 'tour360/cameras.v1', apartment: ID, note: 'auto-trace: one camera per room label; refined by auto_finalize', plan: { crop: CROP, width: W0, height: H0, pxPerCm: PPC }, scenes: seeds.map((s) => ({ id: s.id, at: s.at_px, lookAt: [s.at_px[0] + 100, s.at_px[1]] })) }, null, 1));
  const bathBoxes = seeds.filter((s) => s.type === 'bathroom').map((s) => [s.at_px[0] / PPC - 150, s.at_px[1] / PPC - 150, s.at_px[0] / PPC + 150, s.at_px[1] / PPC + 150]);
  // (T27, 2026-11-06) the ground plane sits BELOW the floor, never in it (fork F: ground_offset 0 put the ground in the floor
  //    plane and it rendered black over 9 of 11 floors): the unit's floor number (the spec's building.floor_of_unit, else the
  //    page's floor label) x the floor-to-floor height (the spec's, else 320 cm); unknown or the ground floor -> -300 cm
  const floorNo = (() => {
    const fu = Number(spec?.building?.floor_of_unit);
    if (Number.isFinite(fu)) return fu;
    const fl = (P.floor_label || '').trim();
    if (!fl) return null;
    if (/קרקע|ground/i.test(fl)) return 0;
    const dg = fl.match(/(\d+)/); if (dg) return Number(dg[1]);
    const HEB = { 'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9 };
    const m = fl.match(/קומה\s+([א-ט])['׳]?/); return m ? HEB[m[1]] : null;
  })();
  const ftf = Number(spec?.building?.typical_floor_to_floor_cm) > 0 ? Number(spec.building.typical_floor_to_floor_cm) : 320;
  const groundOffset = floorNo && floorNo > 0 ? -floorNo * ftf : -300;
  const groundNote = floorNo && floorNo > 0 ? `ground ${-groundOffset} cm below the floor: floor ${floorNo} x ${ftf} cm` : `ground 300 cm below the floor (floor ${floorNo === 0 ? '0 (ground floor)' : 'unknown'}; never in the floor plane)`;
  const base = {
    open_radius_px: 5, simplify_cm: 3, door_dilate_px: 5, cut_px: 8, near_wall_px: 16, dimension_min_cm: 100, straight_density_max: 4.5, opening_min_cm: 60,
    apartment_id: ID, cameras_json: camsJson, eye_cm: 160, ceiling_height_cm: 290, floor_height_cm: 0, floor_height_note: 'unknown: the sales plan has no section', ground_offset_cm: groundOffset, ground_offset_note: groundNote,
    roofed_outdoor: false, fixtures: [], source_file: `${path.basename(input)}${P.page ? ` page ${P.page}` : ''}${P.floor_label ? ` (${P.floor_label})` : ''}`, trace_date: new Date().toISOString().slice(0, 10), scale_basis: `${PPC} px/cm: ${basis}`,
    rights_state: 'developer-uploaded', rights_note: 'uploaded by the developer through the Habait Studio portal',
    assumptions: ['ceiling 290 cm, door heads 215 cm (no section on the sales plan)', 'outdoor rooms unroofed unless the plan shows a floor-above line (follow the sales plan)', 'open-plan zone boundaries: auto-trace geodesic split between the printed room labels'],
    stroke_ignore_boxes: bathBoxes, double_ignore_boxes: bathBoxes,
    cameras: seeds.map((s) => ({ id: s.id, room_id: s.room_id, name_he: s.name_he, name_en: s.name_en, type: s.type, is_outdoor: !!s.is_outdoor, at_cm: [s.at_px[0] / PPC, s.at_px[1] / PPC], links: seeds.filter((o) => o.id !== s.id).map((o) => o.id), hull: s.type === 'bathroom' || undefined, printed_dims_cm: s.dims_cm || undefined })),
  };
  fs.writeFileSync(path.join(dir, 'config-mask.json'), JSON.stringify({ ...base, dump_barrier_png: path.join(dir, 'barrier.png'), dump_barrier_only: true }, null, 1));
  run('node', [path.join(HERE, 'trace-plan.mjs'), GREY, String(PPC), path.join(dir, 'config-mask.json'), path.join(dir, 'mask-trace.json'), path.join(dir, 'mask-trace.png')], 'mask');
  // split → trace → finalize → CHECK, with self-correction rounds (Eliran 2026-11-04: the AI checks the trace, not the developer)
  const PLAN = path.join(dir, 'plan.general.json');
  const seeds0 = JSON.parse(JSON.stringify(seeds));
  const force = new Set();
  const ROUNDS = Number(arg('--rounds', '3'));
  let chk = null, lastFail = null;
  for (let round = 1; round <= ROUNDS; round++) {
    const sd = seeds0.map((s) => ({ ...s, force_rect: force.has(s.id) || undefined }));
    fs.writeFileSync(path.join(dir, 'seeds.json'), JSON.stringify(sd, null, 1));
    const so = run(PY, ['-I', path.join(HERE, 'auto_split.py'), path.join(dir, 'barrier.png'), path.join(dir, 'seeds.json'), String(PPC), path.join(dir, 'lines.json'), path.join(dir, 'split.png')], 'split');
    for (const l of so.trim().split('\n')) log(`r${round} ${l.trim()}`);
    // the split may move a label inside the walls and add a hall: the cameras follow seeds.json
    seeds = JSON.parse(fs.readFileSync(path.join(dir, 'seeds.json'), 'utf8'));
    base.cameras = seeds.map((s) => ({ id: s.id, room_id: s.room_id, name_he: s.name_he, name_en: s.name_en, type: s.type, is_outdoor: !!s.is_outdoor, at_cm: [s.at_px[0] / PPC, s.at_px[1] / PPC], links: seeds.filter((o) => o.id !== s.id).map((o) => o.id), hull: s.type === 'bathroom' || undefined, printed_dims_cm: s.dims_cm || undefined }));
    fs.writeFileSync(camsJson, JSON.stringify({ $schema: 'tour360/cameras.v1', apartment: ID, note: 'auto-trace: one camera per room label; refined by auto_finalize', plan: { crop: CROP, width: W0, height: H0, pxPerCm: PPC }, scenes: seeds.map((s) => ({ id: s.id, at: s.at_px, lookAt: [s.at_px[0] + 100, s.at_px[1]] })) }, null, 1));
    fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ ...base, lines: JSON.parse(fs.readFileSync(path.join(dir, 'lines.json'), 'utf8')), fallback_labels_png: path.join(dir, 'labels.png'), export_plan: PLAN, walls_extracted: path.join(dir, 'walls.json'), walls_recompute: true }, null, 1));   // walls_recompute: never a stale walls.json from another scale
    const to = run('node', [path.join(HERE, 'trace-plan.mjs'), GREY, String(PPC), path.join(dir, 'config.json'), path.join(dir, 'trace.json'), path.join(dir, 'trace-debug.png')], 'trace');
    fs.writeFileSync(path.join(dir, 'trace.log'), to);
    for (const l of to.split('\n').filter((l) => /^ROOM .*(LEAK|seed on|geodesic)|^PLAN/.test(l))) log(`r${round} ${l}`);
    log(`r${round} ${run(PY, ['-I', path.join(HERE, 'auto_rooms.py'), dir, String(PPC)], 'rooms').trim()}`);   // round 4: orthogonal rooms from the printed rectangles
    const fo = run(PY, ['-I', path.join(HERE, 'auto_finalize.py'), PLAN, path.join(dir, 'vlm.json'), path.join(dir, 'seeds.json'), path.join(dir, 'barrier.png'), String(PPC), CROP, path.join(dir, 'overlay.png')].concat(basis.startsWith('given') || basis.startsWith('printed') ? [] : ['--fit-dims']), 'finalize');
    log(`r${round} ${fo.trim()}`);
    log(`r${round} ${run(PY, ['-I', path.join(HERE, 'trace_check.py'), dir], 'check').trim()}`);
    chk = JSON.parse(fs.readFileSync(path.join(dir, 'trace-check.json'), 'utf8'));
    chk.round = round;
    if (chk.status === 'PASS') break;
    const fails = JSON.stringify(chk.failures.map((f) => [f.check, f.room, f.arc, f.window]));
    const more = chk.corrections.force_rect.filter((id) => !force.has(id));
    if (!more.length || fails === lastFail) { log(`r${round} no further correction applies`); break; }
    more.forEach((id) => force.add(id));
    log(`r${round} correcting: re-seed ${more.join(', ')} from their printed rectangles, re-cut the open space`);
    lastFail = fails;
  }
  // the independent judge: a different prompt from the reader, plan + overlay side by side; its list must be empty
  const JUDGE = `You audit an automatic floor-plan trace. Image 1 is the original sales-plan drawing. Image 2 is the same drawing with the trace on top: each traced room is a coloured area with a numbered white disc (its area in m² under it), green lines are openings (doors / open passages), blue bars are windows, red boxes are fixed elements. Compare them and list EVERY mismatch: a traced room whose coloured area does not follow that room's walls (spills into a neighbour or misses part of the room), a room on the drawing with no traced area, a traced area that is not a room, an open space split in the wrong place, a door on the drawing with no green line, a window missing. Return ONE JSON object: {"mismatches": [{"room": string|null, "issue": string}]}. An empty list only if the trace matches the drawing everywhere.`;
  // (round 18) the judge runs JUDGE_RUNS times (default 3); a mismatch counts only when >= 2 runs agree on it (same room, same
  //    kind of issue). Until it is stable the judge is a REPORT, not a gate: the status is the mechanical trace_check's.
  const JUDGE_RUNS = Number(arg('--judge-runs', 3)) || 3;
  const normMm = (l) => (Array.isArray(l) ? l : []).map((m) => (m && typeof m === 'object' && !Array.isArray(m)) ? m : { room: null, issue: Array.isArray(m) ? m.join(' — ') : String(m) });
  const KINDS = [['door', /door|דלת|entrance|כניסה/i], ['window', /window|חלון|glaz/i], ['fixture', /fixture|red box|counter|sink|hob|closet|wardrobe/i],
    ['stairs', /stair|מדרג/i], ['split', /split|divid|separat|merged|artificial/i], ['spill', /spill|extend|beyond|covers|into|overlap/i],
    ['missing', /missing|not traced|no traced|absent|omit/i], ['opening', /opening|green line|passage/i]];
  const kindOf = (t) => (KINDS.find(([, re]) => re.test(t)) || ['other'])[0];
  const roomKey = (r) => String(r ?? '').replace(/[^0-9A-Za-z֐-׿]+/g, ' ').trim().replace(/^(room|חדר)\s+/i, '').split(' ').find((w) => /\d/.test(w)) || String(r ?? '').trim() || '-';
  const runs = [];
  if (!process.argv.includes('--no-judge')) {
    for (let i = 0; i < JUDGE_RUNS; i++) {
      const jr = await vision('judge', JUDGE, 'Image 1: the plan. Image 2: the trace.', [await thumbJpg(CROP, 1400), await thumbJpg(path.join(dir, 'overlay.png'), 1400)], 0.02, 3000);
      if (jr && !jr._error) jr.mismatches = normMm(jr.mismatches);
      runs.push(jr);
    }
  }
  const okRuns = runs.filter((r) => r && !r._error);
  const tally = new Map();
  okRuns.forEach((r, i) => { const seen = new Set(); for (const m of r.mismatches || []) { const k = `${roomKey(m.room)}|${kindOf(m.issue + ' ' + (m.room || ''))}`; if (seen.has(k)) continue; seen.add(k); if (!tally.has(k)) tally.set(k, { key: k, runs: [], examples: [] }); tally.get(k).runs.push(i + 1); tally.get(k).examples.push(m); } });
  const all = [...tally.values()];
  const agreed = all.filter((t) => t.runs.length >= 2);
  chk.judge = process.argv.includes('--no-judge') ? { unavailable: 'judge skipped (--no-judge)', mismatches: [] }
    : okRuns.length < 2 ? { unavailable: `only ${okRuns.length} of ${JUDGE_RUNS} judge runs answered`, runs: runs.map((r) => r?._error || (r?.mismatches || []).length), mismatches: [] }
    : { model: TEXT_MODEL, role: 'report (not a gate until stable)', runs: okRuns.length, per_run: okRuns.map((r) => r.mismatches),
        agreed_2of3: agreed.map((t) => ({ key: t.key, runs: t.runs, issue: t.examples[0].issue, room: t.examples[0].room })),
        mismatches: agreed.map((t) => t.examples[0]),
        agreement_rate: all.length ? +(agreed.length / all.length).toFixed(2) : 1, usd: +okRuns.reduce((a, r) => a + (r._meta?.usd || 0), 0).toFixed(5) };
  // status = the mechanical check (the judge is reported beside it)
  const jud = { mismatches: chk.judge.mismatches || [] };
  fs.writeFileSync(path.join(dir, 'trace-check.json'), JSON.stringify(chk, null, 1));
  log(`plan ${P.k}: ${chk.status} after ${chk.round} round(s) — ${chk.n_failed} mechanical failure(s), judge ${jud ? (jud.mismatches || []).length : '?'} mismatch(es)`);
  if (arg('--gt')) console.log(run(PY, ['-I', path.join(HERE, 'trace_score.py'), PLAN, arg('--gt'), path.join(dir, 'score.json')].concat(arg('--map') ? ['--map', arg('--map')] : []), 'score'));
  const rep = JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf8'));
  index.plans.push({ dir, page: P.page, floor_label: P.floor_label, dwelling_label: P.dwelling_label, status: chk.status, rounds: chk.round, plan: PLAN, overlay: path.join(dir, 'overlay.png'), report: path.join(dir, 'report.json'), trace_check: path.join(dir, 'trace-check.json'),
    rooms: rep.rooms, fixtures: rep.fixtures, scale_px_per_cm: rep.scale_px_per_cm, failures: chk.failures.map((f) => ({ check: f.check, room: f.room || null, name: f.name || null, expected: f.expected, got: f.got })), judge_mismatches: chk.judge?.mismatches || [], could_not_read: rep.could_not_read });
}
index.spent_usd = ledger.total();
index.status = index.plans.length && index.plans.every((p) => p.status === 'PASS') ? 'PASS' : 'FAIL';
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 1));
log(`done: ${index.status} — ${index.plans.map((p) => `${path.basename(p.dir)} ${p.status}`).join(', ')}; $${index.spent_usd.toFixed(4)} → ${path.join(OUT, 'index.json')}`);
if (index.status !== 'PASS') {
  // FAIL blocks the build and goes to Habait's review queue, never to the developer
  const q = arg('--review-queue');
  if (q) fs.appendFileSync(q, JSON.stringify({ at: new Date().toISOString(), id: ID, input: index.input, index: path.join(OUT, 'index.json'), failed: index.plans.filter((p) => p.status !== 'PASS').map((p) => p.dir) }) + '\n');
  process.exit(5);
}
