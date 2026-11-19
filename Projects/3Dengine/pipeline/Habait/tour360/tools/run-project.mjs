#!/usr/bin/env node
/* Habait Tour360 — tools/run-project.mjs: ONE command that runs the 846 recipe for a NEW apartment, with every hand step of 846
   replaced by a rule. Contract: ../PROJECT-PACKAGE.md (the site = a fixed template + one data package per project).
   Session rnd-67, fork C, 2026-11-04 (Eliran: "התוצאה … תשוכפל לכל תכנית מכר שאעלה לפורטל").

     node Habait/tour360/tools/run-project.mjs <id> --plan <plan.general.json> --crop <plan-crop.png> [--spec <spec.json>]
          [--steps apartment,cameras,prompts,furnish,render,scenes,sets,markers,build,package,publish-local] [--skin]
          [--res 2048x1024] [--samples 32] [--port 8890] [--job <job.json>]

   Steps (each writes its outputs, then a row in out/<id>/package/package.json; a rerun skips nothing — every step is idempotent):
     apartment  apartments/<id>/{apartment.json, plan.general.json, material-board.json, _local/plan/plan-crop.png}
     cameras    cameras.json + plan camera_points: one point per room at the deepest interior point clear of the drawn fixtures,
                aimed down the room's longest sightline (open zone edges see through), eye 160 cm; links through the plan's openings
     prompts    prompts.json from ONE style + ONE material block shared by every scene (used only by --skin)
     furnish    360walkaround/pipeline/furnish_from_plan.py → 360walkaround/tours/<id>/plan.json (furniture by rule)
     render     360walkaround/pipeline/render_tour.mjs (Blender Cycles) under the machine's Blender lock C:\RnD\.wt\_blender.lock
     scenes     make-refs.mjs + make-scenes.mjs
     sets       the CG renders → _local/generated/<asset>__cg__0.png → make-sets.mjs --model cg (designed = CG until --skin) + original
     markers    scan-pieces.mjs (paid, ≈ $0.01/scene, ledgered by the tool)
     build      build-tour.mjs <id> --catalog=ai → dist/<id>
     package    out/<id>/package/{tour/, platform/fixtures/<id>/*, platform/projects.json, package.json}
     publish-local  serves the platform template + the package at http://127.0.0.1:<port>/p/<id>/ and /p/<id>/tour/
     skin       (--skin) tools/skin-project.mjs: the designed look by the Rainbow recipe — every scene skinned, fidelity-gated at
                fidelity.json's bar, repaired until it passes, every element seen from 2+ scenes judged the same, the floor finishes
                gated (fork F, 2026-11-05; --skin-soft / --skin-hard USD per job, default 40 / 60)
     gate       a skinned set packages only when skin-report.json says PASS (fidelity AND consistency); a CG set is the structure itself
   No designed (AI) panorama enters a package ungated (Eliran 2026-11-04/05, sales-plan fidelity + consistency). Never opens .env. */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TOOLS = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TOOLS, '..');                 // Habait/tour360
const REPO = path.resolve(ROOT, '..', '..');            // habait-walkaround
const PIPE = path.join(REPO, '360walkaround', 'pipeline');
const PLATFORM = path.join(REPO, 'Habait', 'platform');
const PY = process.env.HABAIT_PY || 'C:/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe';
const LOCK = process.env.HABAIT_BLENDER_LOCK || 'C:/RnD/.wt/_blender.lock';
const APP_DIR = process.env.HABAIT_APP_DIR || 'C:/RnD/Projects/Habait/tools/appdeps';
// the house template data (material board, disclosure keys) IS Rainbow apt846's — one source, read from here only
const HOUSE = path.join(ROOT, 'apartments', 'apt846');   // parity-ok: the house data is Rainbow's, by design (PROJECT-PACKAGE.md parity #4)
process.env.HABAIT_APP_DIR = APP_DIR;   // the in-process steps (sets) load sharp through app-require.mjs too, not only the children
// keys by NAME for the paid children (the gate's depth calls, the skin): the process env, else <HABAIT_ENV_ROOT>/.env read by
// file-ledger's loadEnv (never printed); a worktree has no .env of its own
if (!process.env.FAL_KEY) { const { loadEnv } = await import('./file-ledger.mjs'); const e = loadEnv(process.env.HABAIT_ENV_ROOT || 'C:/RnD/Projects/Habait/habait-walkaround'); if (e.FAL_KEY) process.env.FAL_KEY = e.FAL_KEY; }

const argv = process.argv.slice(2);
// --parity (Eliran 2026-11-05: «כל אותם דברים שאנחנו עושים על RAINBOW, הפורטל צריך לדעת לעשות לבד»): the registry in PROJECT-PACKAGE.md
// (```json parity) must hold — every module exists, its call site says what the row says, a row's step is a runner step, and no
// listed code module carries an apt846/Rainbow literal in code unless the line is marked `parity-ok:` (a Rainbow-only path). Exit 1 on any.
if (argv.includes('--parity')) {
  const HAB = path.resolve(ROOT, '..');   // habait-walkaround/Habait
  const md = fs.readFileSync(path.join(ROOT, 'PROJECT-PACKAGE.md'), 'utf8');
  const m = md.match(/```json parity\r?\n([\s\S]*?)\r?\n```/);   // CRLF-safe (git may check the file out either way)
  if (!m) { console.error('parity: no ```json parity block in PROJECT-PACKAGE.md'); process.exit(1); }
  const rows = JSON.parse(m[1]); const STEPS = ['trace', 'apartment', 'casework', 'cameras', 'prompts', 'furnish', 'render', 'scenes', 'sets', 'skin', 'gate', 'markers', 'build', 'package', 'qa'];
  const bad = [];
  for (const r of rows) {
    for (const f of r.modules) if (!fs.existsSync(path.join(HAB, f))) bad.push(`#${r.id} ${r.rule}: module missing ${f}`);
    if (r.step && !STEPS.includes(r.step)) bad.push(`#${r.id} ${r.rule}: step '${r.step}' is not a runner step`);
    const cf = path.join(HAB, r.call.file);
    if (!fs.existsSync(cf) || !fs.readFileSync(cf, 'utf8').includes(r.call.contains)) bad.push(`#${r.id} ${r.rule}: ${r.call.file} does not call «${r.call.contains}»`);
    for (const f of r.modules.filter((x) => /\.(mjs|js|py)$/.test(x))) {
      const fp = path.join(HAB, f); if (!fs.existsSync(fp)) continue;
      fs.readFileSync(fp, 'utf8').replace(/\/\*[\s\S]*?\*\/|"""[\s\S]*?"""/g, (c) => c.replace(/[^\n]/g, ' ')).split(/\r?\n/).forEach((line, i) => {
        const t = line.trim(); if (/^(\/\/|\*|\/\*|#)/.test(t)) return;
        const code = t.replace(/\s\/\/.*$/, '');
        if (/apt846|rainbow/i.test(code) && !/parity-ok:/.test(line)) bad.push(`#${r.id} ${f}:${i + 1} a Rainbow literal in code: ${t.slice(0, 120)}`);
      });
    }
  }
  console.log(`parity: ${rows.length} rows · ${bad.length ? `FAIL (${bad.length})` : 'PASS'}`); for (const b of bad) console.log(`  ${b}`);
  process.exit(bad.length ? 1 : 0);
}
const id = argv[0];
const opt = (k, d = null) => { const i = argv.indexOf(k); return i > 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const has = (k) => argv.includes(k);
if (!id || id.startsWith('--') || !/^[a-z0-9][a-z0-9-]{1,40}$/i.test(id)) {
  console.error('usage: run-project.mjs <id> --plan <plan.general.json> --crop <plan-crop.png> [--spec <spec.json>] [--steps a,b] [--skin]');
  process.exit(2);
}
const ALL = ['trace', 'apartment', 'casework', 'cameras', 'prompts', 'furnish', 'render', 'scenes', 'sets', 'skin', 'gate', 'markers', 'build', 'package', 'qa'];
const steps = (opt('--steps') || ALL.join(',')).split(',').map((s) => s.trim()).filter(Boolean);
for (const s of steps) if (![...ALL, 'publish-local'].includes(s)) fail(`unknown step ${s}`);
const GATE_TOOLS = ['fidelity-gate.mjs', 'consistency-check.mjs'].map((f) => path.join(TOOLS, f));
if (has('--skin') && !GATE_TOOLS.every((f) => fs.existsSync(f))) fail('--skin refused: the fidelity gate and the consistency check are not in this tree');

const APT = path.join(ROOT, 'apartments', id);
const TOUR = path.join(REPO, '360walkaround', 'tours', id);
const OUT = path.join(ROOT, 'out', id);
const PKG = path.join(OUT, 'package');
const JOB = opt('--job', path.join(OUT, 'job.json'));
const res = opt('--res', '2048x1024');
const samples = opt('--samples', '32');

function fail(m) { console.error(`run-project: ${m}`); try { job({ stage: 'failed', log: m }); } catch { /* before init */ } process.exit(1); }
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJson = (p, d) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(d, null, 1) + '\n'); };
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function job(patch) {
  const j = fs.existsSync(JOB) ? readJson(JOB) : { id, stage: 'queued', percent: 0, log: [], links: {} };
  if (patch.log) { j.log = [...(j.log || []), `${new Date().toISOString().slice(11, 19)} ${patch.log}`].slice(-200); delete patch.log; }
  Object.assign(j, patch, { updatedAt: new Date().toISOString() });
  writeJson(JOB, j);
}
function manifestRow(step, row) {
  const f = path.join(PKG, 'package.json');
  const m = fs.existsSync(f) ? readJson(f) : { $schema: 'habait/project-package.v1', id, contract: 'Habait/tour360/PROJECT-PACKAGE.md', steps: {} };
  m.steps[step] = { ...row, at: new Date().toISOString() };
  writeJson(f, m);
}
function run(cmd, args, opts = {}) {
  const t = Date.now();
  const r = spawnSync(cmd, args, { cwd: opts.cwd || REPO, encoding: 'utf8', env: { ...process.env, HABAIT_APP_DIR: APP_DIR, ...(opts.env || {}) }, maxBuffer: 64 * 1024 * 1024, timeout: (opts.timeoutS || 540) * 1000, windowsHide: true, shell: false });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  if (opts.log) fs.writeFileSync(opts.log, out);
  if (r.status !== 0) fail(`${path.basename(String(args[0] || cmd))} exited ${r.status ?? r.signal}: ${out.trim().split('\n').slice(-6).join(' | ').slice(0, 900)}`);
  return { out, s: Math.round((Date.now() - t) / 1000) };
}

// ───────────────────────────── geometry (plan cm, y down, bearings 0 = up, clockwise)
const segs = (loop) => loop.map((p, i) => [p, loop[(i + 1) % loop.length]]);
function inside([x, y], loop) {
  let c = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const [xi, yi] = loop[i]; const [xj, yj] = loop[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function dseg([px, py], [[ax, ay], [bx, by]]) {
  const dx = bx - ax, dy = by - ay; const L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
const dpoly = (p, loop) => Math.min(...segs(loop).map((s) => dseg(p, s)));
function rayHit([px, py], bearing, edges, maxD = 1500) {
  const a = (bearing * Math.PI) / 180; const dx = Math.sin(a), dy = -Math.cos(a);
  let best = maxD;
  for (const [[ax, ay], [bx, by]] of edges) {
    const ex = bx - ax, ey = by - ay; const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((ax - px) * ey - (ay - py) * ex) / den; const u = ((ax - px) * dy - (ay - py) * dx) / den;
    if (t > 1 && u >= 0 && u <= 1 && t < best) best = t;
  }
  return best;
}
const bearing = (from, to) => ((Math.atan2(to[0] - from[0], -(to[1] - from[1])) * 180) / Math.PI + 360) % 360;
const camel = (s) => s.replace(/^r-/, '').replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const FR = { hall: 'Entrée', kitchen: 'Cuisine', dining: 'Salle à manger', living: 'Séjour', bedroom: 'Chambre', master_bedroom: 'Chambre parentale',
  wardrobe: 'Dressing', storage: 'Dressing', bathroom: 'Salle de bain', wc: 'Toilettes', mamad: 'Pièce sécurisée', terrace: 'Terrasse', balcony: 'Terrasse',
  laundry: 'Buanderie', corridor: 'Couloir', other: 'Pièce' };
const zoneOf = (t) => (['terrace', 'balcony'].includes(t) ? 'terrace' : ['bedroom', 'master_bedroom', 'wardrobe', 'storage', 'bathroom', 'wc', 'mamad', 'laundry'].includes(t) ? 'bedrooms' : 'living');

function placeCamera(room, fixtures, openings = []) {
  const loop = room.loop; const xs = loop.map((p) => p[0]); const ys = loop.map((p) => p[1]);
  const fx = fixtures.filter((f) => f.room_id === room.id && Array.isArray(f.polygon_cm) && f.polygon_cm.length > 2);
  const doors = openings.filter((o) => o.kind !== 'opening' && o.a_cm && o.b_cm && (o.rooms || []).includes(room.id) && Number(o.width_cm) > 0);
  const score = (p) => {
    if (!inside(p, loop)) return -1;
    let s = dpoly(p, loop);
    for (const f of fx) { if (inside(p, f.polygon_cm)) return -1; s = Math.min(s, dpoly(p, f.polygon_cm) + 20); }   // a fixture counts 20 cm closer than a wall
    // parity row 37 (2026-11-08, the auto 846: the wardrobe camera stood 38 cm from a door leaf and its marker to the living room landed on
    // the leaf/jamb): a camera stays out of every door's swing — the disc of the door's width around its opening — plus 30 cm
    for (const d of doors) { const dd = dseg(p, [d.a_cm, d.b_cm]); if (dd < d.width_cm) return -1; s = Math.min(s, dd - d.width_cm + 30); }
    return s;
  };
  let best = null; let bs = -1;
  const scan = (x0, x1, y0, y1, st) => { for (let x = x0; x <= x1; x += st) for (let y = y0; y <= y1; y += st) { const s = score([x, y]); if (s > bs) { bs = s; best = [x, y]; } } };
  scan(Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys), 8);
  if (!best) return null;
  scan(best[0] - 8, best[0] + 8, best[1] - 8, best[1] + 8, 1);
  // aim: the longest PHYSICAL sightline — a ray stops at the first wall or glass of the whole plan (an open zone edge has no
  // structure, so an open-plan room looks across the space); the bearing is the middle of the widest run within 5 % of the best
  const ds = []; for (let b = 0; b < 360; b += 1) ds.push(rayHit(best, b, obstacles));
  const far = Math.max(...ds); const ok = ds.map((d) => d >= far * 0.95);
  let runBest = { len: 0, mid: ds.indexOf(far) };
  for (let s = 0; s < 360; s += 1) {
    if (!ok[s] || ok[(s + 359) % 360]) continue;              // a run starts here
    let len = 0; while (len < 360 && ok[(s + len) % 360]) len += 1;
    if (len > runBest.len) runBest = { len, mid: (s + Math.floor((len - 1) / 2)) % 360 };
  }
  if (ok.every(Boolean)) runBest.mid = 0;
  // a room with glass faces its glass (the view — 846's hand cameras did so in every glazed room): the length-weighted mean
  // bearing of the pane edges that lie on this room's own boundary; otherwise the longest sightline above
  let vx = 0, vy = 0, glass = 0;
  for (const [a, b] of (room.is_outdoor ? railEdges : paneEdges)) {   // outdoors: face the railing (the view), not the facade behind
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 5 || dpoly(m, loop) > 35) continue;
    const br = (bearing(best, m) * Math.PI) / 180; vx += Math.sin(br) * L; vy += Math.cos(br) * L; glass += L;
  }
  const yaw = glass >= 80 ? Math.round(((Math.atan2(vx, vy) * 180) / Math.PI + 360) % 360) : runBest.mid;
  return { at: best.map((v) => Math.round(v * 10) / 10), yaw, aim: glass >= 80 ? `glass ${Math.round(glass)} cm` : 'sightline', clear_cm: Math.round(bs), sight_cm: Math.round(far) };
}
let paneEdges = []; let railEdges = [];
let obstacles = [];
function setObstacles(plan) {
  obstacles = [];
  for (const w of plan.walls || []) if (Array.isArray(w.polygon_cm)) obstacles.push(...segs(w.polygon_cm));
  paneEdges = []; railEdges = [];
  for (const p of plan.panes || []) if (Array.isArray(p.polygon_cm)) { obstacles.push(...segs(p.polygon_cm)); (p.kind === 'railing' ? railEdges : paneEdges).push(...segs(p.polygon_cm)); }
  for (const r of plan.rooms || []) { const k = r.edge_kinds || []; obstacles.push(...segs(r.loop).filter((_, i) => k[i] === 'wall')); }
}

// ───────────────────────────── steps
const T = {};
const timed = (name, fn) => { const t = Date.now(); job({ stage: name, log: `${name}: start` }); const r = fn() || {}; T[name] = Math.round((Date.now() - t) / 1000); manifestRow(name, { seconds: T[name], ...r }); job({ log: `${name}: done in ${T[name]} s` }); return r; };

// parity row 27 (the coordinator, 2026-11-06): the runner's trace step = fork B's tools/auto-trace.mjs (T1), one call per job:
// <pdf> -> <OUT>/trace/index.json with one plan-<k>/ per floor; exit 0 PASS · 5 FAIL (queued for Habait, never shown to the developer) ·
// 1 a step failed · 3 no plan drawing · 4 budget. The env carries HABAIT_APP_DIR (sharp + playwright-core) and HABAIT_PY (pymupdf, opencv,
// shapely, skimage, numpy); the keys stay in the live tree's .env, read by NAME by auto-trace itself (--env-root). The plan the apartment
// step uses is the traced one (--floor k picks a floor; default the first) unless --plan names another; its pdf-vectors.json travels with it.
const TRACE_RESULT = path.join(OUT, 'trace-result.json');
function stepTrace() {
  const pdf = opt('--pdf');
  if (!pdf && opt('--plan')) return { skipped: '--plan given: the caller traced it' };
  if (!pdf || !fs.existsSync(pdf)) fail('--pdf <sales-plan.pdf> is required for the trace step');
  const out = path.join(OUT, 'trace'); fs.mkdirSync(out, { recursive: true });
  const ENV_ROOT = process.env.HABAIT_ENV_ROOT || 'C:/RnD/Projects/Habait/habait-walkaround';
  const args = [path.join(TOOLS, 'auto-trace.mjs'), pdf, '--out', out, '--id', id, '--budget', opt('--trace-budget', '1'), '--env-root', ENV_ROOT,
    '--ledger', path.join(OUT, 'ledger-trace.json'), '--review-queue', path.join(OUT, 'review-queue.jsonl')];
  if (opt('--spec')) args.push('--spec', opt('--spec'));
  if (opt('--type')) args.push('--type', opt('--type'));
  if (opt('--vlm-file')) args.push('--vlm-file', opt('--vlm-file'));   // a saved reading ($0: tests, fixtures, a re-run of a job)
  if (has('--no-judge')) args.push('--no-judge');   // the vision judge is a report (T1); $0 runs skip it and say so
  job({ log: 'הסוכן משרטט את הדירה מתוך תכנית המכר ובודק אותה מול התכנית' });
  const r = spawnSync('node', args, { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: Number(opt('--trace-timeout', '1500')) * 1000, windowsHide: true,
    env: { ...process.env, HABAIT_APP_DIR: APP_DIR, HABAIT_PY: PY } });
  const log = `${r.stdout || ''}${r.stderr || ''}`; fs.writeFileSync(path.join(OUT, 'trace.log'), log);
  const tail = log.trim().split(/\r?\n/).slice(-3).join(' | ').slice(0, 400);
  if (r.status === 5) fail('השרטוט לא עבר עדיין את בדיקת ההתאמה לתכנית המכר. המערכת ממשיכה לתקן. (trace-check FAIL, queued for review)');
  if (r.status === 3) fail(`auto-trace found no plan drawing in the PDF: ${tail}`);
  if (r.status === 4) fail(`the auto-trace budget (${opt('--trace-budget', '1')}) was reached: ${tail}`);
  if (r.status !== 0) fail(`auto-trace failed (exit ${r.status ?? r.signal}): ${tail}`);
  const index = readJson(path.join(out, 'index.json'));
  const plans = (index.plans || []).map((p) => ({ ...p, dir: path.isAbsolute(p.dir) ? p.dir : path.join(out, p.dir) }));
  const k = Math.max(1, Number(opt('--floor', '1')));
  const P = plans[k - 1];
  if (!P) fail(`the trace has ${plans.length} floor plan(s); --floor ${k} does not exist`);
  const res = { pdf: path.resolve(pdf), floors: plans.length, floor: k, plan: path.join(P.dir, 'plan.general.json'), crop: path.join(P.dir, 'crop.png'),
    vectors: fs.existsSync(path.join(P.dir, 'pdf-vectors.json')) ? path.join(P.dir, 'pdf-vectors.json') : null, status: P.status, rooms: P.rooms, fixtures: P.fixtures,
    scale_px_per_cm: P.scale_px_per_cm, failures: P.failures || [] };
  for (const f of [res.plan, res.crop]) if (!fs.existsSync(f)) fail(`auto-trace exited 0 but ${f} is missing`);
  writeJson(TRACE_RESULT, res);
  job({ log: `השרטוט עבר את בדיקת ההתאמה: ${res.rooms} חדרים${plans.length > 1 ? ` · ${plans.length} קומות` : ''}` });
  return { floors: plans.length, rooms: res.rooms, fixtures: res.fixtures, scale_px_per_cm: res.scale_px_per_cm };
}
const traced = () => (fs.existsSync(TRACE_RESULT) ? readJson(TRACE_RESULT) : {});

function stepApartment() {
  const planIn = opt('--plan') || traced().plan; const crop = opt('--crop') || traced().crop; const specIn = opt('--spec');
  if (!planIn || !fs.existsSync(planIn)) fail('--plan <plan.general.json> is required (or run the trace step first: --pdf)');
  if (!crop || !fs.existsSync(crop)) fail('--crop <plan-crop.png> is required (the sales-plan crop the trace is drawn on)');
  fs.mkdirSync(path.join(APT, '_local', 'plan'), { recursive: true });
  fs.copyFileSync(crop, path.join(APT, '_local', 'plan', 'plan-crop.png'));
  keepVectors(planIn);
  const plan = readJson(planIn);
  plan.apartment_id = id;
  plan.camera_points = [];   // placed by rule in the next step, never carried over
  // parity row 32 (2026-11-06, the local build proof from the auto-traced 846: 9 of 11 views had an all-black floor under the camera): the
  // scene builder takes a room loop's winding as the floor's facing, and the hand plans wind positive (y down); an auto-traced plan came
  // wound the other way, so its floors faced down. Every room loop is wound positive here, once, before anything builds on it
  let flipped = 0;
  for (const r of plan.rooms || []) {
    const L = r.loop || []; let a = 0;
    for (let i = 0; i < L.length; i++) { const [x1, y1] = L[i], [x2, y2] = L[(i + 1) % L.length]; a += x1 * y2 - x2 * y1; }
    if (a < 0) { r.loop = [...L].reverse(); flipped += 1; }
  }
  if (flipped) console.log(`apartment: ${flipped} room loop(s) re-wound positive (the floor faces up)`);
  // the derived room fields follow the loop (2026-11-07: the trace merged the closet lobby into the wardrobe area and the niche into the
  // guest bath but kept their old bbox/clear dims, and the scene builder's verify refused the mismatch); recomputed here, never trusted
  let redims = 0;
  for (const r of plan.rooms || []) {
    const L = r.loop || []; if (L.length < 3) continue;
    const xs = L.map((p) => p[0]), ys = L.map((p) => p[1]); let a = 0;
    for (let i = 0; i < L.length; i++) { const [x1, y1] = L[i], [x2, y2] = L[(i + 1) % L.length]; a += x1 * y2 - x2 * y1; }
    const bbox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map((v) => Math.round(v * 10) / 10);
    const clear = [Math.round((bbox[2] - bbox[0]) * 10) / 10, Math.round((bbox[3] - bbox[1]) * 10) / 10];
    if (JSON.stringify(r.bbox_cm) !== JSON.stringify(bbox) || JSON.stringify(r.clear_dims_cm) !== JSON.stringify(clear)) redims += 1;
    r.bbox_cm = bbox; r.clear_dims_cm = clear; r.area_m2 = Math.round(Math.abs(a / 2) / 10) / 1000;
  }
  if (redims) console.log(`apartment: ${redims} room(s) had a bbox / clear dims that no longer matched their loop — recomputed`);
  // parity row 32b (2026-11-06, same proof: the floors rendered BLACK — the trace wrote plan_meta.ground_offset_cm 0, so the 400 m
  // terrain plane lay IN the floor plane and won the z-fight): the ground is the unit's floor number × 320 cm below (the hand plan's own
  // assumption, apt846: floor 16 → −5120), from the portal's reading; without a floor number, the builder's default (−300). Never ≥ 0
  const specIn0 = opt('--spec'); const spec0 = specIn0 && fs.existsSync(specIn0) ? readJson(specIn0) : {};
  const fl = Number(spec0.building?.floor_of_unit);
  plan.plan_meta = plan.plan_meta || {};
  if (!(Number(plan.plan_meta.ground_offset_cm) <= -100)) {
    if (Number.isFinite(fl) && fl >= 1) {
      plan.plan_meta.ground_offset_cm = -Math.round(fl * 320); plan.plan_meta.floor_height_cm = Math.round(fl * 320);
      plan.plan_meta.floor_height_note = `floor ${fl} at about 3.2 m floor to floor (an assumption: the sales plan carries no section); the ground sits that far below the unit (run-project)`;
    } else delete plan.plan_meta.ground_offset_cm;
    console.log(`apartment: ground ${plan.plan_meta.ground_offset_cm ?? 'the builder default (−300)'} cm below the floor`);
  }
  writeJson(path.join(APT, 'plan.general.json'), plan);
  const spec = specIn && fs.existsSync(specIn) ? readJson(specIn) : {};
  if (specIn) fs.copyFileSync(specIn, path.join(APT, 'spec.json'));
  // ONE material description per apartment (Eliran: the kitchen must look the same from every room): the house board
  const board = path.join(HOUSE, 'material-board.json');
  if (fs.existsSync(board)) { const b = readJson(board); b.apartment = id; b.note = `the house material board, shared by every scene of ${id}; ${b.note || ''}`.slice(0, 600); writeJson(path.join(APT, 'material-board.json'), b); }
  const u = spec.unit || {}; const proj = spec.project_name || id; const city = spec.city || '';
  const he = `דירה ${u.number || ''}${spec.building?.floor_of_unit ? ` · קומה ${spec.building.floor_of_unit}` : ''} · ${proj}${city ? ` ${city}` : ''} (הדמיה)`.replace(/\s+/g, ' ');
  const en = `Apartment ${u.number || ''}${spec.building?.floor_of_unit ? ` · floor ${spec.building.floor_of_unit}` : ''} · ${proj}${city ? ` ${city}` : ''} (concept)`.replace(/\s+/g, ' ');
  const ref = readJson(path.join(HOUSE, 'apartment.json'));
  const apartment = {
    $schema: 'tour360/apartment.v1', id, status: 'concept',
    title: { he, en, fr: en.replace('Apartment', 'Appartement').replace('floor', 'étage') },
    project: null,
    projectNote: `built by tools/run-project.mjs from the sales-plan trace ${path.basename(planIn)} (sha256 ${sha(planIn).slice(0, 12)}) and the portal's approved reading; the CG look until the gated skin exists`,
    plan: { image: 'plan/floorplan.webp', ...planSheet(plan, path.join(APT, '_local', 'plan', 'plan-crop.png')), labelsLanguage: 'he', northDeg: Number.isFinite(spec.drawing?.north_deg_clockwise_from_up) ? spec.drawing.north_deg_clockwise_from_up : null, northSource: 'the portal reading of the sales plan (spec.json drawing.north_deg_clockwise_from_up)' },
    sets: {
      balanced: { dir: 'panos/balanced', width: 2048, height: 1024, format: 'webp', tracked: true },
      thumb: { dir: 'panos/thumb', width: 640, height: 320, format: 'webp', tracked: true },
      original: { dir: 'panos/original', width: 2048, height: 1024, format: 'webp', tracked: true, note: 'the plain CG render of each camera (360walkaround/tours/<id>/renders/cp-*/pano.webp)' },
    },
    defaultScene: 'living', returnUrl: `../landing.html?project=${id}`,   // the viewer's landing room and the way back (no :8899 literal)
    disclosure: ref.disclosure,
    provenance: { generation: `CG only: Blender Cycles ${res}, ${samples} spp, furniture by rule (furnish_from_plan.py); no AI image in this apartment`, enhancement: 'none' },
  };
  writeJson(path.join(APT, 'apartment.json'), apartment);
  return { plan: path.relative(REPO, planIn), plan_sha256: sha(planIn), rooms: plan.rooms.length, spec: specIn ? path.basename(specIn) : null };
}

// the drawing's CAD vectors (auto-trace's pdf-vectors.json, in the TRACE's frame) and the trace's own plan (its frame and scale) are kept
// beside the apartment so the casework step can read the hob and sink symbols (parity row 18); --vectors / --vectors-plan name them when the
// plan given to --plan is not the trace's own output
function keepVectors(planIn) {
  const vec = opt('--vectors') || (planIn && path.join(path.dirname(planIn), 'pdf-vectors.json'));
  if (!vec || !fs.existsSync(vec)) return false;
  const tp = opt('--vectors-plan') || planIn;
  if (!tp || !fs.existsSync(tp)) fail(`--vectors given without the trace's plan (--vectors-plan <plan.general.json>)`);
  fs.mkdirSync(path.join(APT, '_local', 'plan'), { recursive: true });
  fs.copyFileSync(vec, path.join(APT, '_local', 'plan', 'pdf-vectors.json'));
  fs.copyFileSync(tp, path.join(APT, '_local', 'plan', 'trace-plan.json'));
  return true;
}
// parity row 18 (2026-11-06): the kitchen's hob and sink where the DRAWING has them, and the board's open-shelf wall, into the plan
// (tools/casework_symbols.py → plan.casework_symbols / plan.furnish_cues); the furnisher reads them. No vectors → an explicit note,
// and the furnisher labels its guess as a fallback
function stepCasework() {
  if (opt('--vectors')) keepVectors(opt('--vectors-plan'));
  const vec = path.join(APT, '_local', 'plan', 'pdf-vectors.json'); const tp = path.join(APT, '_local', 'plan', 'trace-plan.json');
  const planFile = path.join(APT, 'plan.general.json');
  // without vectors the tool still types every tall unit (parity row 23: fridge by default when it fits the fridge range) and records
  // that the hob and the sink fall back to the labelled rule
  const hasVec = fs.existsSync(vec) && fs.existsSync(tp);
  const args = ['-I', path.join(TOOLS, 'casework_symbols.py'), '--plan', planFile, ...(hasVec ? ['--vectors', vec, '--trace-plan', tp] : []), '--go'];
  const board = path.join(APT, 'material-board.json'); if (fs.existsSync(board)) args.push('--board', board);
  const p = spawnSync(PY, args, { cwd: REPO, encoding: 'utf8', timeout: 300000, windowsHide: true });
  const out = `${p.stdout || ''}${p.stderr || ''}`; fs.writeFileSync(path.join(OUT, 'casework.log'), out);
  if (p.status !== 0) fail(`casework_symbols exited ${p.status}: ${out.trim().split(/\r?\n/).slice(-3).join(' | ')}`);
  const cw = readJson(planFile).casework_symbols || {};
  const kinds = (cw.symbols || []).map((x) => x.kind);
  job({ log: kinds.length ? `מטבח: ${kinds.includes('hob') ? 'כיריים' : ''}${kinds.length > 1 ? ' ו' : ''}${kinds.includes('sink') ? 'כיור' : ''} במקום שבשרטוט` : 'מטבח: לא נמצאו סמלי כיור וכיריים בשרטוט; ימוקמו לפי כלל ברירת מחדל ויסומנו כך' });
  const he = { fridge: 'מקרר', oven: 'תנורים', pantry: 'ארון אחסון' };
  const tall = (readJson(planFile).fixtures || []).filter((f) => f.tall_type);
  if (tall.length) job({ log: `ארון גבוה במטבח: ${tall.map((f) => he[f.tall_type] || f.tall_type).join(', ')}` });
  return { symbols: kinds.length, registration_cm: cw.registration?.mean_outline_cm ?? null, tall_units: Object.fromEntries(tall.map((f) => [f.id, f.tall_type])) };
}
function stepCameras() {
  const plan = readJson(path.join(APT, 'plan.general.json'));
  const pxPerCm = plan.plan_meta?.scale_px_per_cm || 2.25;
  const crop = path.join(APT, '_local', 'plan', 'plan-crop.png');
  const { width, height } = pngSize(crop);
  const rooms = plan.rooms.filter((r) => (r.area_m2 ?? 99) >= 1.5);
  setObstacles(plan);
  const cams = []; const points = []; let n = 0;
  for (const r of rooms) {
    const c = placeCamera(r, plan.fixtures || [], plan.openings || []);
    if (!c) { console.warn(`cameras: no point fits in ${r.id}`); continue; }
    n += 1; const sid = camel(r.id);
    const look = [c.at[0] + 400 * Math.sin((c.yaw * Math.PI) / 180), c.at[1] - 400 * Math.cos((c.yaw * Math.PI) / 180)];
    cams.push({ id: sid, asset: `${String(n).padStart(2, '0')}-${r.id.replace(/^r-/, '')}`, room: r.id, type: r.type, at: c.at.map((v) => Math.round(v * pxPerCm)), lookAt: look.map((v) => Math.round(v * pxPerCm)), zone: zoneOf(r.type), links: [], _rule: { clear_cm: c.clear_cm, sight_cm: c.sight_cm, yaw_deg: c.yaw, aim: c.aim } });
    points.push({ id: `cp-${sid}`, room_id: r.id, x: c.at[0], y: c.at[1], z: 160, yaw_deg: c.yaw, note: `run-project.mjs rule: deepest point clear of fixtures (${c.clear_cm} cm), longest sightline ${c.sight_cm} cm` });
  }
  const byRoom = new Map(cams.map((c) => [c.room, c]));
  for (const o of plan.openings || []) {
    const [a, b] = o.rooms || []; const A = byRoom.get(a); const B = byRoom.get(b);
    if (!A || !B) continue;
    const via = (o.centre_cm || [(o.a_cm[0] + o.b_cm[0]) / 2, (o.a_cm[1] + o.b_cm[1]) / 2]).map((v) => Math.round(v * pxPerCm));
    if (!A.links.some((l) => l.to === B.id)) A.links.push({ to: B.id, via });
    if (!B.links.some((l) => l.to === A.id)) B.links.push({ to: A.id, via });
  }
  // parity row 31 (2026-11-06, the local build proof from the auto-traced 846: kitchen and dining had no link, so a visitor could not
  // walk into them): an open-plan zone boundary is a passage too. Two rooms whose outlines run together (within 8 cm) for at least
  // 60 cm with no wall or glass pane on that stretch are linked through its middle, the same as an opening of the plan
  // walls AND glass panes close a boundary (a facade between the kitchen and the terrace is glass, not a passage)
  const wallPolys = [...(plan.walls || []), ...(plan.panes || [])].map((w) => w.polygon_cm).filter((p) => p && p.length > 2);
  const inWall = (p) => wallPolys.some((w) => inside(p, w) || dpoly(p, w) < 2);
  for (let i = 0; i < cams.length; i++) for (let j = i + 1; j < cams.length; j++) {
    const A = cams[i], B = cams[j]; if (A.links.some((l) => l.to === B.id)) continue;
    const ra = plan.rooms.find((r) => r.id === A.room), rb = plan.rooms.find((r) => r.id === B.room);
    if (!ra?.loop || !rb?.loop) continue;
    const shared = [];
    for (const [p, q] of segs(ra.loop)) {
      const L = Math.hypot(q[0] - p[0], q[1] - p[1]); const n = Math.max(1, Math.round(L / 10));
      for (let k = 0; k <= n; k++) { const s = [p[0] + ((q[0] - p[0]) * k) / n, p[1] + ((q[1] - p[1]) * k) / n]; if (dpoly(s, rb.loop) <= 8 && !inWall(s)) shared.push(s); }
    }
    if (shared.length * 10 < 60) continue;
    const mid = shared[Math.floor(shared.length / 2)].map((v) => Math.round(v * pxPerCm));
    A.links.push({ to: B.id, via: mid, open_boundary_cm: shared.length * 10 }); B.links.push({ to: A.id, via: mid, open_boundary_cm: shared.length * 10 });
  }
  const names = {}; const zones = {
    living: { he: 'מרחב מגורים', en: 'Living', fr: 'Séjour' }, terrace: { he: 'המרפסת', en: 'The terrace', fr: 'La terrasse' }, bedrooms: { he: 'אגף החדרים', en: 'Bedrooms', fr: 'Chambres' } };
  for (const c of cams) { const r = plan.rooms.find((x) => x.id === c.room); names[c.id] = { he: r.name_he || r.name_en, en: r.name_en || r.name_he, fr: FR[r.type] || r.name_en }; }
  const doc = { $schema: 'tour360/cameras.v1', apartment: id, note: 'written by tools/run-project.mjs (rule, no hand placement): coordinates are plan-crop pixels (= cm × scale_px_per_cm)', plan: { crop: '_local/plan/plan-crop.png', width, height, pxPerCm, planScale: PLAN_SCALE, sheet: 'plan/floorplan.webp' }, refWindowPx: 1700, eye_m: 1.6, names, zones, scenes: cams };
  writeJson(path.join(APT, 'cameras.json'), doc);
  plan.camera_points = points;
  writeJson(path.join(APT, 'plan.general.json'), plan);
  const orphans = cams.filter((c) => !c.links.length).map((c) => c.id);
  if (orphans.length) console.warn(`cameras: no link for ${orphans.join(', ')}`);
  console.log(cams.map((c) => `  ${c.id.padEnd(16)} ${c.asset.padEnd(20)} yaw ${String(c._rule.yaw_deg).padStart(3)}  clear ${c._rule.clear_cm} cm  links ${c.links.map((l) => l.to).join(',')}`).join('\n'));
  return { scenes: cams.length, links: cams.reduce((s, c) => s + c.links.length, 0), orphans };
}
function pngSize(f) { const b = fs.readFileSync(f); return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }; }
// the viewer's plan sheet (tour.js reads plan.viewBox and plan.imageSize; null throws «object null is not iterable»): the sheet is the
// crop × planScale (make-refs.mjs writes it), the viewBox the rooms' bounding box on that sheet with a 40 px margin, clipped
const PLAN_SCALE = 0.4;
function planSheet(plan, crop) {
  const { width, height } = pngSize(crop);
  const W = Math.round(width * PLAN_SCALE); const H = Math.round(height * PLAN_SCALE);
  const k = (plan.plan_meta?.scale_px_per_cm || 2.25) * PLAN_SCALE;
  const pts = plan.rooms.flatMap((r) => r.loop);
  const x0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[0])) * k) - 40); const y0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[1])) * k) - 40);
  const x1 = Math.min(W, Math.ceil(Math.max(...pts.map((p) => p[0])) * k) + 40); const y1 = Math.min(H, Math.ceil(Math.max(...pts.map((p) => p[1])) * k) + 40);
  return { imageSize: [W, H], viewBox: [x0, y0, x1 - x0, y1 - y0] };
}

function stepPrompts() {
  const cams = readJson(path.join(APT, 'cameras.json'));
  const board = fs.existsSync(path.join(APT, 'material-board.json')) ? readJson(path.join(APT, 'material-board.json')) : {};
  const materials = JSON.stringify(board.materials || board.surfaces || board, null, 0).slice(0, 1500);
  const STYLE = 'Photoreal interior, Tel Aviv contemporary luxury, warm daylight, equirectangular 360 panorama 2:1, seamless left and right edges.';
  const LOCK = 'Keep every wall, window, door, column, kitchen run, closet and fixture exactly where the reference render has it; change surfaces and light only. Never add a window, door, opening, room or wall.';
  const prompts = { $schema: 'tour360/prompts.v1', apartment: id, shared: { style: STYLE, lock: LOCK, materials }, scenes: {} };
  for (const s of cams.scenes) prompts.scenes[s.asset] = { scene: s.id, room_type: s.type, prompt: `${STYLE} Room: ${cams.names[s.id].en}. ${LOCK} The SAME materials in every room of this apartment: ${materials}` };
  writeJson(path.join(APT, 'prompts.json'), prompts);
  return { scenes: cams.scenes.length, shared_material_block: true };
}

function stepFurnish() {
  fs.mkdirSync(TOUR, { recursive: true });
  writeJson(path.join(TOUR, 'plan.base.json'), readJson(path.join(APT, 'plan.general.json')));
  const out = path.join(TOUR, '_furnish');
  const t = Date.now();
  const p = spawnSync(PY, ['-I', path.join(PIPE, 'furnish_from_plan.py'), '--plan', path.join(TOUR, 'plan.base.json'), '--out', out], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 540000, windowsHide: true });
  fs.writeFileSync(path.join(OUT, 'furnish.log'), `${p.stdout || ''}${p.stderr || ''}`);
  const repFile = path.join(out, 'report.json'); const furnished = path.join(out, 'plan.furnished.json');
  const rep = fs.existsSync(repFile) ? readJson(repFile) : null;
  // the audit exits 1 on ANY hit. Policy (project-runner, 2026-11-04): a TEMPLATE piece grazing a wall or glass by ≤ 50 cm² is a
  // furnishing note, not a plan deviation — recorded here and shown to the developer; build_scene's mesh verify() is the authority.
  // A plan fixture hitting a wall means the trace is wrong (sales-plan fidelity) and stays fatal, as does anything else the audit refuses.
  let notes = [];
  if (p.status !== 0) {
    const tail = `${p.stdout || ''}${p.stderr || ''}`.trim().split('\n').slice(-6).join(' | ').slice(0, 600);
    if (!rep || !fs.existsSync(furnished)) fail(`furnish_from_plan exited ${p.status ?? p.signal} without its outputs: ${tail}`);
    const hits = rep.wall_hits || [];
    const benign = hits.every((h) => /^template/.test(String(h.origin)) && (Number(h.wall_cm2) || 0) + (Number(h.pane_cm2) || 0) <= 50);
    const clean = !(rep.openings_blocked || []).length && !(rep.outside_room || []).length && !(rep.size_violations || []).length && (rep.rooms_furnished || []).length >= 1;
    if (!(benign && clean)) fail(`furnish audit refused the plan: ${tail}`);
    notes = hits.map((h) => `${h.id} (${h.origin}) grazes ${h.wall_cm2 ? 'a wall' : 'glass'} by ${Math.round((Number(h.wall_cm2) || 0) + (Number(h.pane_cm2) || 0))} cm²`);
    job({ log: `ריהוט: ${hits.length} פריטי תבנית נוגעים בקיר או בזכוכית (עד ${Math.max(...hits.map((h) => Math.round((Number(h.wall_cm2) || 0) + (Number(h.pane_cm2) || 0))))} סמ"ר); נרשם, הבנייה ממשיכה` });
  }
  fs.copyFileSync(furnished, path.join(TOUR, 'plan.json'));
  return { seconds_tool: Math.round((Date.now() - t) / 1000), report: path.relative(REPO, repFile), rooms_furnished: (rep?.rooms_furnished || []).length, items: rep?.items_total ?? null, audit: p.status === 0 ? 'PASS' : 'PASS-WITH-NOTES', notes };
}

async function withLock(fn) {
  for (;;) {
    try { const fd = fs.openSync(LOCK, 'wx'); fs.writeSync(fd, JSON.stringify({ owner: `run-project ${id}`, pid: process.pid, at: new Date().toISOString() })); fs.closeSync(fd); break; }
    catch (e) { if (e.code !== 'EEXIST') throw e; job({ log: `render: waiting for the Blender lock (${LOCK})` }); await new Promise((r) => setTimeout(r, 30000)); }
  }
  // released on EVERY way out: fail() calls process.exit inside fn, which skips a finally (a stale lock blocked the queue, 2026-11-04)
  const release = () => { try { const o = JSON.parse(fs.readFileSync(LOCK, 'utf8')); if (o.pid === process.pid) fs.unlinkSync(LOCK); } catch { /* gone or not ours */ } };
  process.on('exit', release);
  try { return fn(); } finally { release(); process.removeListener('exit', release); }
}
async function stepRender() {
  // the render reads the furnished plan (tours/<id>/plan.json), written by the furnish step; a cameras-only change (row 37 moved a point)
  // must still reach it — the plan's camera points are carried over here, so render_tour sees the moved point and re-renders it
  const tp = path.join(TOUR, 'plan.json');
  if (fs.existsSync(tp)) {
    const tplan = readJson(tp); const apt = readJson(path.join(APT, 'plan.general.json'));
    if (JSON.stringify(tplan.camera_points) !== JSON.stringify(apt.camera_points)) { tplan.camera_points = apt.camera_points; writeJson(tp, tplan); console.log('render: camera points carried from the plan into the furnished plan'); }
  }
  return withLock(() => {
    const r = run('node', [path.join(PIPE, 'render_tour.mjs'), TOUR, '--mode', 'draft', '--res', res, '--samples', samples, '--no-top-view', ...(opt('--render-points') ? ['--points', opt('--render-points')] : [])], { log: path.join(OUT, 'render.log'), timeoutS: Number(opt('--render-timeout', '7200')) });
    const done = fs.readdirSync(path.join(TOUR, 'renders')).filter((d) => fs.existsSync(path.join(TOUR, 'renders', d, 'pano.webp')));
    return { seconds_tool: r.s, renders: done.length, res, samples };
  });
}

function stepScenes() {
  run('node', [path.join(TOOLS, 'make-refs.mjs'), id], { log: path.join(OUT, 'refs.log') });
  const r = run('node', [path.join(TOOLS, 'make-scenes.mjs'), id], { log: path.join(OUT, 'scenes.log') });
  // parity row 28 (fork A's R23b, taken from main aaed3d1): no hotspot marker on a fixture face or a wall — make-scenes places them off
  // the fixtures in the CG depth, hotspot-check verifies every one ($0); run() fails the job on its exit 1
  const h = run('node', [path.join(TOOLS, 'hotspot-check.mjs'), id], { log: path.join(OUT, 'hotspots.log') });
  return { out: r.out.trim().split('\n')[0], hotspots: h.out.trim().split('\n').slice(-1)[0] };
}

async function stepSets() {
  const { appRequire } = await import('./app-require.mjs');
  const sharp = appRequire(REPO)('sharp');
  const scenes = readJson(path.join(APT, 'scenes.json')).scenes.filter((s) => !s.exterior);
  const GEN = path.join(APT, '_local', 'generated'); fs.mkdirSync(GEN, { recursive: true });
  // a re-run never throws away a designed pick (skin): only scenes without one get their CG render (fork F, 2026-11-05)
  const prev = fs.existsSync(path.join(APT, '_local', 'picks.json')) ? readJson(path.join(APT, '_local', 'picks.json')) : {};
  const picks = {};
  for (const s of scenes) {
    const src = path.join(TOUR, 'renders', `cp-${s.id}`, 'pano.webp');
    if (!fs.existsSync(src)) fail(`no CG render for ${s.id} (${path.relative(REPO, src)})`);
    if (prev[s.asset] && !/__cg__/.test(prev[s.asset]) && fs.existsSync(path.join(GEN, prev[s.asset])) && !has('--reset-skin')) { picks[s.asset] = prev[s.asset]; continue; }
    const f = `${s.asset}__cg__0.png`; await sharp(src).png().toFile(path.join(GEN, f)); picks[s.asset] = f;
  }
  writeJson(path.join(APT, '_local', 'picks.json'), picks);
  run('node', [path.join(TOOLS, 'make-sets.mjs'), id, '--model', 'cg'], { log: path.join(OUT, 'sets.log') });
  return { scenes: scenes.length, designed: 'CG (no --skin)' };
}

// the designed look (fork F, 2026-11-05): tools/skin-project.mjs runs the Rainbow recipe for every scene — skin, fidelity gate at
// fidelity.json's bar, the fix loop, cross-scene consistency for every element seen from 2+ scenes, the floor finishes — and writes
// _local/skin-report.json. Without --skin the step does nothing (the package ships the CG look, which is the structure itself).
// R27 judges every view beside its own render: the renders are gitignored, so the runner makes sure they are there before the skin
// (the coordinator, 2026-11-06: never a silent photos-only judge). A missing render with no tracked original copy → the render step
// builds them (Blender lock); still missing → the run stops and names the files
async function ensureRenders() {
  const scenes = readJson(path.join(APT, 'scenes.json')).scenes.filter((s) => !s.exterior);
  const ap = readJson(path.join(APT, 'apartment.json')); const o = ap.sets?.original || {}; const cgTour = o.cg_tour || id;
  const missing = () => scenes.filter((s) => {
    const live = path.join(REPO, '360walkaround', 'tours', cgTour, 'renders', `cp-${s.id}`, 'pano.webp');
    const tracked = path.join(APT, o.dir || 'panos/original', `${s.asset}.webp`);
    return !fs.existsSync(live) && !fs.existsSync(tracked);
  });
  let m = missing(); if (!m.length) return 0;
  if (cgTour !== id) fail(`R27: no render for ${m.map((s) => s.asset).join(', ')} in the CG tour ${cgTour} (not this apartment's own tour): fetch them before the skin`);
  job({ log: `R27: ${m.length} רינדורים חסרים — בונים אותם` });
  await stepRender();
  m = missing(); if (m.length) fail(`R27: the render step left ${m.map((s) => s.asset).join(', ')} without a render`);
  return scenes.length;
}
async function stepSkin() {
  if (!has('--skin')) return { skipped: 'no --skin: the CG look' };
  const built = await ensureRenders();
  const args = [path.join(TOOLS, 'skin-project.mjs'), id, '--soft', opt('--skin-soft', '40'), '--hard', opt('--skin-hard', '60'),
    '--env-root', process.env.HABAIT_ENV_ROOT || 'C:/RnD/Projects/Habait/habait-walkaround', ...(has('--past-soft') ? ['--past-soft'] : [])];
  const t = Date.now();
  const r = spawnSync('node', args, { cwd: REPO, encoding: 'utf8', env: { ...process.env, HABAIT_APP_DIR: APP_DIR }, maxBuffer: 64 * 1024 * 1024, timeout: Number(opt('--skin-timeout', '14400')) * 1000, windowsHide: true });
  fs.writeFileSync(path.join(OUT, 'skin.run.log'), `${r.stdout || ''}${r.stderr || ''}`);
  const rep = fs.existsSync(path.join(APT, '_local', 'skin-report.json')) ? readJson(path.join(APT, '_local', 'skin-report.json')) : null;
  const sum = rep ? { verdict: rep.verdict, spend_usd: rep.spend_usd, scenes: Object.fromEntries(Object.entries(rep.scenes).map(([k, v]) => [k, `${v.verdict} ${v.deviation_pct ?? ''}`.trim()])), consistency: Object.fromEntries(Object.entries(rep.consistency || {}).map(([k, v]) => [k, v.verdict])) } : null;
  if (r.status === 4) fail(`skin: the soft checkpoint ($${opt('--skin-soft', '40')}) — re-run the skin step with --past-soft to continue (cached answers cost $0). ${JSON.stringify(sum)}`);
  if (r.status === 3) fail(`skin: the hard cap ($${opt('--skin-hard', '60')}) would be crossed. ${JSON.stringify(sum)}`);
  if (r.status !== 0) fail(`skin: not every room passes the fidelity rule and the consistency check after the fix loop — not packaged. ${JSON.stringify(sum)}`);
  apartmentProvenance(rep);
  return { seconds_tool: Math.round((Date.now() - t) / 1000), ...sum };
}
function apartmentProvenance(rep) {
  const f = path.join(APT, 'apartment.json'); const a = readJson(f); const rule = readJson(path.join(ROOT, 'fidelity.json'));
  a.provenance = { generation: `openai/gpt-image-2.5/sunburst/edit via fal (the gpt25 lane of tools/gen-pano.mjs), 2048×1024, quality high; image 1 = the Blender CG render of each camera on the approved trace, the house material board and style (Habait/tour360/house-style); tools/skin-project.mjs, report _local/skin-report.json (spend $${rep.spend_usd})`,
    enhancement: 'none: WebP from the PNG answers by tools/make-sets.mjs (balanced 2048×1024, thumb 640×320)',
    geometryNote: `walls, openings and furniture positions follow the sales plan; materials and fittings are illustrative; every shipped room passes the fidelity gate at ${rule.max_deviation_pct}% (Habait/tour360/fidelity.json) and every element seen from more than one room is judged the same, or the build refuses to package` };
  writeJson(f, a);
}
// the gate: a skinned set packages only when the skin report says PASS (every room at the fidelity bar, every consistency group the
// same, every finish gated); build-tour then re-checks every shipped picture's exact bytes against gate.json. A CG-only set
// (designed = the CG render of the same camera) is the structure itself.
function stepGate() {
  const picks = fs.existsSync(path.join(APT, '_local', 'picks.json')) ? readJson(path.join(APT, '_local', 'picks.json')) : {};
  const skinned = Object.values(picks).filter((f) => !/__cg__/.test(f));
  if (!skinned.length) {
    // CG only: every designed panorama IS the CG render of its camera. build-tour still wants a gate row for every shipped picture's
    // exact bytes (fidelity.json), so the CG set is gated too (≈ $0.01 a room; it measures the CG against the plan, cg_pct)
    // --cg-only (fork E, 2026-11-05): the metric checks alone (Blender's depth in cm vs the plan's ray-cast, the trace vs the printed
    // dimensions) — the depth model would only compare each CG picture with itself; $0, so a CG build never needs fal
    const g = spawnSync('node', [GATE_TOOLS[0], id, '--set', 'balanced', '--cg-only'], { cwd: REPO, encoding: 'utf8', env: { ...process.env, HABAIT_APP_DIR: APP_DIR }, timeout: 1800000 });
    fs.writeFileSync(path.join(OUT, 'gate.log'), `${g.stdout || ''}${g.stderr || ''}`);
    if (g.status !== 0) fail(`gate: the CG set does not pass the fidelity rule (exit ${g.status}) — the trace or the render deviates from the plan; see apartments/${id}/_local/fidelity/gate.json`);
    return { verdict: 'PASS (CG only: the CG set gated against the plan, metric, $0)', skinned: 0 };
  }
  const repF = path.join(APT, '_local', 'skin-report.json');
  if (!fs.existsSync(repF)) fail(`gate: ${skinned.length} designed (AI) panoramas but no skin report — refusing to package them`);
  const rep = readJson(repF);
  const bad = [...Object.entries(rep.scenes).filter(([, v]) => v.verdict !== 'PASS').map(([k, v]) => `${k} ${v.verdict} ${v.deviation_pct ?? ''}%`),
    ...Object.entries(rep.consistency || {}).filter(([, v]) => v.verdict === 'FAIL').map(([k]) => `consistency ${k} FAIL`),
    ...Object.entries(rep.finishes || {}).flatMap(([a, fl]) => Object.entries(fl).filter(([, v]) => v.verdict !== 'PASS').map(([f, v]) => `${a} [${f}] ${v.verdict}`))];
  if (rep.verdict !== 'PASS' || bad.length) fail(`gate: not packaged — ${bad.join('; ') || rep.verdict}`);
  return { verdict: 'PASS', skinned: skinned.length, scenes: Object.fromEntries(Object.entries(rep.scenes).map(([k, v]) => [k, v.deviation_pct])), consistency: Object.fromEntries(Object.entries(rep.consistency || {}).map(([k, v]) => [k, v.verdict])), spend_usd: rep.spend_usd };
}

function stepMarkers() {
  const envRoot = process.env.HABAIT_ENV_ROOT || 'C:/RnD/Projects/Habait/habait-walkaround';   // the key by name, from the live tree's .env
  const dry = run('node', [path.join(TOOLS, 'scan-pieces.mjs'), id, '--dry', '--env-root', envRoot], { log: path.join(OUT, 'markers-dry.log'), timeoutS: 900 });   // root §7: dry first
  const r = run('node', [path.join(TOOLS, 'scan-pieces.mjs'), id, '--budget', opt('--markers-budget', '0.25'), '--env-root', envRoot], { log: path.join(OUT, 'markers.log'), timeoutS: 900 });
  const m = readJson(path.join(APT, 'markers.json'));
  const n = Object.values(m.scenes || m).reduce((s, v) => s + (Array.isArray(v?.markers) ? v.markers.length : Array.isArray(v) ? v.length : 0), 0);
  return { seconds_tool: r.s, markers: n, tail: r.out.trim().split('\n').slice(-2).join(' | ').slice(0, 300) };
}

function stepBuild() {
  // the rings and the catalog need markers.json (a paid scan); without it (a --no-paid dry run, or the scan unavailable) the tour
  // builds without them and the manifest says so — never a silent difference
  const rings = fs.existsSync(path.join(APT, 'markers.json'));
  const r = run('node', [path.join(TOOLS, 'build-tour.mjs'), id, ...(rings ? ['--catalog=ai'] : [])], { log: path.join(OUT, 'build.log') });
  return { line: r.out.trim().split('\n').filter((l) => l.startsWith('build-tour'))[0] || '', rings_and_catalog: rings };
}

async function stepPackage() {
  const dist = path.join(ROOT, 'dist', id);
  if (!fs.existsSync(path.join(dist, 'index.html'))) fail('no dist — run the build step');
  fs.rmSync(path.join(PKG, 'tour'), { recursive: true, force: true });
  fs.cpSync(dist, path.join(PKG, 'tour'), { recursive: true });
  const spec = fs.existsSync(path.join(APT, 'spec.json')) ? readJson(path.join(APT, 'spec.json')) : {};
  const scenes = readJson(path.join(APT, 'scenes.json')).scenes.filter((s) => !s.exterior);
  const first = (scenes.find((s) => s.id === 'living') || scenes[0]).id;
  const u = spec.unit || {};
  const F = path.join(PKG, 'platform', 'fixtures', id);
  const name = spec.project_name || id;
  // the landing hero (project.json cover): the landing room as the visitor first sees it — a 1600×900 perspective view cut from its
  // balanced panorama with make-sets' own maths (yaw 0 = the camera's aim, a touch below level). Same pixels as the tour, no new image.
  fs.mkdirSync(F, { recursive: true });
  let cover = null;
  try {
    const { appRequire } = await import('./app-require.mjs'); const { loadPano, render } = await import('./pano-geometry.mjs');
    const sharp = appRequire(REPO)('sharp');
    const s0 = scenes.find((s) => s.id === first);
    const pano = await loadPano(sharp, path.join(APT, 'panos', 'balanced', `${s0.asset}.webp`));
    await sharp(render(pano, 0, -3, 90, 1600, 900), { raw: { width: 1600, height: 900, channels: 3 } }).webp({ quality: 86 }).toFile(path.join(F, 'cover.webp'));
    cover = 'cover.webp';
  } catch (e) { console.warn(`package: no cover still (${String(e.message).slice(0, 120)})`); }
  writeJson(path.join(F, 'project.json'), {
    ...(cover ? { cover } : {}),
    id, name: { he: name, en: name }, tagline: { he: [spec.city, 'הדמיה'].filter(Boolean).join(' · '), en: [spec.city, 'concept'].filter(Boolean).join(' · ') },
    developer: { he: spec.developer || '', en: spec.developer || '' }, brand: { primary: '#0f5c8f', accent: '#f2a900', background: '#0b1220' },
    flow: 'flow.json', units: 'units.json', film: false, exterior: null,   // no film yet: the template routes every film entry to the landing page
    leads: { whatsapp_number: '' }, analytics: { posthog_key: '' },
    disclaimer: (() => { const pct = readJson(path.join(ROOT, 'fidelity.json')).max_deviation_pct; const skinned = Object.values(fs.existsSync(path.join(APT, '_local', 'picks.json')) ? readJson(path.join(APT, '_local', 'picks.json')) : {}).some((f) => !/__cg__/.test(f));
      return skinned ? { he: `הדמיה על בסיס תכנית המכר. המידות תואמות לתכנית בסטייה של עד ${pct}%. הריהוט והגימורים להמחשה בלבד.`, en: `A visualization based on the sales plan. Dimensions match the plan within ${pct}%. Furniture and finishes are illustrative.` }
        : { he: 'הדמיה לפי תכנית המכר. הריהוט והגימורים להמחשה בלבד.', en: 'A visualization from the sales plan. Furniture and finishes are illustrative.' }; })(),
    fixture: false, fixture_note: 'written by tools/run-project.mjs from the approved spec.json',
  });
  writeJson(path.join(F, 'units.json'), { $schema: '../../contracts/units.schema.json', project: id, currency: 'ILS', price_note: 'no price list uploaded yet', units: [{
    id: String(u.number || id), floor: spec.building?.floor_of_unit ?? null, type: u.type_mark ?? null, rooms: u.rooms_count ?? null, area_m2: u.area_m2 ?? null, outdoor_m2: u.terrace_m2 ?? null,
    price: null, status: 'for-sale', tour_url: `tour/?scope=apartment&room=${first}`, note: 'from the portal reading of the sales plan' }] });
  writeJson(path.join(F, 'flow.json'), { $schema: '../../contracts/flow.schema.json', project: id, start: null, defaults: {}, segments: [] });
  // no cinematic flight yet: an explicit empty flow.cine.json (the landing then shows arm A without a 404 — the responsive gate fails on any 4xx)
  writeJson(path.join(F, 'flow.cine.json'), { project: id, start: null, segments: [], note: 'no building film for this project yet (PROJECT-PACKAGE.md: the film needs inputs a sales plan does not have)' });
  writeJson(path.join(PKG, 'platform', 'projects.json'), { projects: [{ id, dir: `fixtures/${id}` }] });
  // the apartment page + its pack, as Rainbow's (Habait/platform/tools/build_zip.mjs: stills cut from the panoramas, the plan, the
  // dollhouse, the legal caption): the landing's gallery reads _local/dist/<id>/<unit>/apartment.json (parity registry row "apartment page")
  const unitId = String(u.number || id);
  fs.rmSync(path.join(PKG, 'platform', '_local'), { recursive: true, force: true });
  run('node', [path.join(PLATFORM, 'tools', 'build_zip.mjs'), F, unitId, '--out', path.join(PKG, 'platform', '_local', 'dist', id, unitId), '--tour-apartment', APT], { log: path.join(OUT, 'apartment-page.log'), cwd: PLATFORM });
  const files = []; const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else files.push(p); } }; walk(PKG);
  const mb = files.reduce((s, f) => s + fs.statSync(f).size, 0) / 1048576;
  return { files: files.length, mb: Math.round(mb * 10) / 10, landing_room: first };
}

// the package served as habait-flow serves it at /p/<id>/ (the template from Habait/platform, the package's data and tour, the typed bar
// through the package's own edit function) — publish-local and the qa step use the SAME server
function packageServer() {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg' };
  const send = (res, f) => { res.writeHead(200, { 'content-type': types[path.extname(f).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(f).pipe(res); };
  const pre = `/p/${id}/`;
  // the typed bar and the catalog swap locally: the SAME function the package ships to Vercel (tour/api/edit.mjs + _handler.mjs),
  // behind a Node shim for Vercel's req.body / res.status().json(). Keys by NAME from the live tree's .env (never printed); an open
  // host like production (TOUR_EDIT_OPEN=1) unless the caller set it. A GET costs nothing; every POST is a paid turn of the handler.
  let editFn = null;
  const edit = async (req, res) => {
    if (!editFn) {
      const { loadEnv } = await import('./file-ledger.mjs');
      const env = loadEnv(process.env.HABAIT_ENV_ROOT || 'C:/RnD/Projects/Habait/habait-walkaround');
      for (const k of ['FAL_KEY', 'OPENROUTER_API_KEY', 'TOUR_EDIT_CODE']) if (env[k] && !process.env[k]) process.env[k] = env[k];
      if (process.env.TOUR_EDIT_OPEN === undefined) process.env.TOUR_EDIT_OPEN = '1';
      editFn = (await import(pathToFileURL(path.join(PKG, 'tour', 'api', 'edit.mjs')).href)).default;
    }
    let body = ''; for await (const c of req) body += c;
    req.body = body ? (() => { try { return JSON.parse(body); } catch { return body; } })() : {};
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => { if (!res.getHeader('content-type')) res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); };
    try { await editFn(req, res); } catch (e) { if (!res.headersSent) { res.statusCode = 500; res.end(JSON.stringify({ ok: false, reason: 'error' })); } }
  };
  return http.createServer((req, res) => {
    let u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (u === `${pre}tour/api/edit`) { if (!fs.existsSync(path.join(PKG, 'tour', 'api', 'edit.mjs'))) { res.writeHead(404); return res.end('no edit function in this package'); } return void edit(req, res); }
    if (u === `/p/${id}`) { res.writeHead(302, { location: pre }); return res.end(); }
    if (!u.startsWith(pre)) { res.writeHead(404); return res.end('not found'); }
    let rel = u.slice(pre.length);
    const cands = [];
    if (rel.startsWith('tour/') || rel === 'tour') { rel = rel.replace(/^tour\/?/, ''); cands.push(path.join(PKG, 'tour', rel || 'index.html')); if (!path.extname(rel)) cands.push(path.join(PKG, 'tour', rel, 'index.html')); }
    else if (rel === 'projects.json' || rel.startsWith('fixtures/') || rel.startsWith('_local/dist/')) cands.push(path.join(PKG, 'platform', rel));
    else { cands.push(path.join(PLATFORM, rel || 'index.html')); if (!path.extname(rel)) cands.push(path.join(PLATFORM, rel, 'index.html')); }
    const f = cands.find((c) => c.startsWith(PKG) || c.startsWith(PLATFORM) ? fs.existsSync(c) && fs.statSync(c).isFile() : false);
    if (!f) { res.writeHead(404); return res.end('not found'); }
    send(res, f);
  });
}
function publishLocal() {
  const port = Number(opt('--port', '8890')); const pre = `/p/${id}/`;
  packageServer().listen(port, '127.0.0.1', () => {
    console.log(`publish-local: http://127.0.0.1:${port}${pre}  (project page)   http://127.0.0.1:${port}${pre}tour/  (the tour)`);
    job({ stage: 'published-local', percent: 100, links: { project: `http://127.0.0.1:${port}${pre}landing.html?project=${id}`, tour: `http://127.0.0.1:${port}${pre}tour/` } });
  });
}

// the responsive gate (Eliran 2026-11-05: «כל דבר … חייב להתאים גם לגרסת המובייל בנוסף לגרסת הדסקטופ» — «וזה כלל שחייב להיות בלוגיקה
// בקוד»): Habait/tools/qa/responsive-gate.mjs over the packaged project page and the tour, at 1440×900 and 390×844, served exactly as
// /p/<id>/ will be. A project that fails is NOT published (run-job sends it to review, like a fidelity FAIL). Screenshots + verdict in
// out/<id>/qa/ (run-job uploads them with the job). $0.
async function stepQa() {
  const { gate } = await import(pathToFileURL(path.join(REPO, 'Habait', 'tools', 'qa', 'responsive-gate.mjs')).href);
  const scenes = readJson(path.join(APT, 'scenes.json')).scenes.filter((s) => !s.exterior);
  const first = (scenes.find((s) => s.id === 'living') || scenes[0]).id;
  const srv = packageServer(); await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`; const pre = `/p/${id}/`;
  const dir = path.join(OUT, 'qa'); fs.rmSync(dir, { recursive: true, force: true });
  let v;
  try { v = await gate(base, [`${pre}landing.html?project=${id}`, `${pre}tour/?room=${first}`], dir, { ignoreApi: true, settle: Number(opt('--qa-settle', '5000')) }); }
  finally { srv.close(); }
  const bad = v.pages.filter((p) => !p.pass).map((p) => `${p.size} ${p.url.replace(pre, '')}: ${p.fails.slice(0, 3).join(' | ')}`);
  if (!v.pass) fail(`qa: the responsive gate failed — not published. ${bad.join(' ;; ')}`);
  return { verdict: 'PASS', pages: v.pages.map((p) => `${p.size} ${p.url.replace(pre, '')}`), screenshots: v.pages.map((p) => `qa/${p.screenshot}`) };
}

// ───────────────────────────── main
const ORDER = { trace: stepTrace, apartment: stepApartment, casework: stepCasework, cameras: stepCameras, prompts: stepPrompts, furnish: stepFurnish, render: stepRender, scenes: stepScenes, sets: stepSets, skin: stepSkin, gate: stepGate, markers: stepMarkers, build: stepBuild, package: stepPackage, qa: stepQa };
fs.mkdirSync(OUT, { recursive: true });
job({ stage: 'started', percent: 0, log: `steps: ${steps.join(',')}` });
const work = steps.filter((s) => s !== 'publish-local');
for (const [i, s] of work.entries()) {
  const t = Date.now(); job({ stage: s, percent: Math.round((i / work.length) * 100), log: `${s}: start` });
  const r = (await ORDER[s]()) || {};
  T[s] = Math.round((Date.now() - t) / 1000); manifestRow(s, { seconds: T[s], ...r });
  job({ log: `${s}: done in ${T[s]} s` });
  console.log(`run-project ${id}: ${s} done in ${T[s]} s`);
}
if (work.length) job({ stage: 'done', percent: 100, log: `timings ${JSON.stringify(T)}` });
if (steps.includes('publish-local')) publishLocal();
