#!/usr/bin/env node
/* Habait Tour360 — tools/skin-project.mjs (project-runner, fork F, 2026-11-05). The designed look of a NEW apartment with no human step:
   the same recipe that made Rainbow apt846 (fix-846-fidelity, 2026-11-04/05), run by rule for every scene, gated, and repaired until it
   passes. Eliran 2026-11-05: «הפורטל צריך להיות עצמאי» and «אם יש סטייה … תעשה הכל כדי שהכל יהיה תקין והכל יופיע כמו בתכנית מכר».

   First, $0: the sight-line map — every room with fixtures is one element group; consistency-check.mjs --all-groups --list (one group per room with fixtures + the railing) names the scenes that see
   it within --see-cm (700 cm); the camera inside the room is the group's HOME. Per scene, in this order: the anchor room (living) first,
   then the homes the most other scenes see, then the rest —
     1. make-skin-prompts.mjs --roll auto       the prompt from the house material board + the plan (openings, fixtures by bearing); image 1 =
                                                the CG render of this camera, image 2 = the anchor's final, image 3 = the house style
                                                (house-style/style-living.png); a scene that sees another room's elements gets that
                                                room's passed picture too (nearest 3), with the words "EXACTLY as in Image n"
     2. gen-pano.mjs <scene> gpt25              GPT Image 2.5 at 2048×1024 (booked $0.60), the Rainbow lane
     3. close-seam.mjs --lite                   only when the wrap seam steps (> max(6, 2.5 × the neighbours' step)), kept only if it helps
     4. fidelity-gate.mjs --set picks           the per-room deviation against the plan at fidelity.json's bar
     5. the fix loop (fidelity.json fix_loop)   FAIL / STALE → regenerate with the next seed; from attempt 3, CG-guided band repairs at
                                                the flagged bearings; up to max_attempts. A deviation the trace or the CG itself carries
                                                (UNRESOLVED, dims, cg_vs_plan) is NOT a skin problem: the scene stops and says so.
   Then, for the whole apartment:
     6. consistency-check.mjs --group <g> --judge       for EVERY group seen from 2+ scenes (kitchen with its hob/sink judge, every other
                                                         room generic): the judge's list must be empty; a FAIL regenerates the non-home
                                                         viewers (up to 2 rounds); any FAIL left = the project is not packaged
     7. make-sets.mjs                                    the web sets from the picks, then the gate again on the balanced set (the build
                                                         checks the exact bytes it ships)
     8. finish-pano.mjs per scene × floor                parquet / concrete / marble (videos.json), each gated, retried with --attempt
   No room is ever dropped: a scene that does not pass keeps the run's exit code non-zero and build-tour refuses to package.

   Money (root §7): every paid call is reserved in apartments/<id>/_local/ledger.json by the tool BEFORE it is sent (the tools' own
   reserve/settle); this runner checks the job's spend against --soft / --hard BEFORE each call and mirrors every new row into the job's
   ledger (out/<id>/ledger.json, op skin.*). At --soft it stops with exit 4 (a checkpoint: re-run to continue — every answer is cached by
   its inputs hash, a re-run never re-bills); --hard is never crossed (exit 3).
   Keys by NAME only: FAL_KEY from the process environment, or from <--env-root>/.env read by file-ledger's loadEnv; never printed.

   usage: node Habait/tour360/tools/skin-project.mjs <apartment> [--scenes a,b] [--soft 40] [--hard 60] [--max-attempts N]
          [--floors parquet,concrete,marble | --no-floors] [--model gpt25] [--anchor living] [--env-root <dir>] [--dry]
   exit 0 = every scene (and finish) PASSES, 1 = something still fails after the loop (report in _local/skin-report.json),
        2 = usage / missing input, 3 = the hard cap would be crossed, 4 = the soft checkpoint reached */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fileLedger, loadEnv } from './file-ledger.mjs';
import { modelFor } from './image-models.mjs';

const TOOLS = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TOOLS, '..');            // Habait/tour360
const REPO = path.resolve(ROOT, '..', '..');       // habait-walkaround
const argv = process.argv.slice(2);
const VALUE = ['--scenes', '--context', '--soft', '--hard', '--max-attempts', '--floors', '--model', '--anchor', '--env-root'];
const id = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && VALUE.includes(argv[i - 1])))[0];
const opt = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const has = (k) => argv.includes(k);
if (!id) { console.error('usage: skin-project.mjs <apartment> [--scenes a,b] [--soft 40] [--hard 60] [--max-attempts N] [--floors a,b|--no-floors] [--dry]'); process.exit(2); }

const APT = path.join(ROOT, 'apartments', id);
const OUT = path.join(ROOT, 'out', id);
const LOCAL = path.join(APT, '_local');
const GEN = path.join(LOCAL, 'generated');
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJson = (p, d) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(d, null, 1) + '\n'); };
for (const f of ['plan.general.json', 'scenes.json', 'cameras.json', 'material-board.json']) if (!fs.existsSync(path.join(APT, f))) { console.error(`skin-project: ${id} has no ${f}`); process.exit(2); }
const RULE = readJson(path.join(ROOT, 'fidelity.json'));
const MAX_ATTEMPTS = Number(opt('--max-attempts', RULE.max_attempts || 3));
const SOFT = Number(opt('--soft', '40')), HARD = Number(opt('--hard', '60'));
const MODEL = opt('--model', 'gpt25');
const DRY = has('--dry');
const plan = readJson(path.join(APT, 'plan.general.json'));
const scenesDoc = readJson(path.join(APT, 'scenes.json'));
const cams = readJson(path.join(APT, 'cameras.json'));
const interiorAssets = scenesDoc.scenes.filter((s) => s.kind !== 'exterior' && !s.exterior && /^\d\d-/.test(s.asset));
const want = opt('--scenes') ? opt('--scenes').split(',') : interiorAssets.map((s) => s.asset);
// --context a,b (with --scenes): scenes that JOIN the consistency judge with their kept, passed picks but are never regenerated or
// repainted in this run (re-skin one home and judge it against the rooms that see it, without touching them)
const CONTEXT = opt('--context') ? opt('--context').split(',').filter((a) => !want.includes(a)) : [];

// ── keys by name: the children read FAL_KEY from the process env (no worktree has a .env of its own). OPENROUTER_API_KEY is NOT passed:
// the judges then go through fal's router (chat-transport.mjs), the one account this machine keeps funded.
if (!process.env.FAL_KEY) { const e = loadEnv(opt('--env-root', process.env.HABAIT_ENV_ROOT || 'C:/RnD/Projects/Habait/habait-walkaround')); if (e.FAL_KEY) process.env.FAL_KEY = e.FAL_KEY; }
if (!process.env.FAL_KEY && !DRY) { console.error('skin-project: FAL_KEY missing (by name: the environment or <env-root>/.env)'); process.exit(2); }
const childEnv = { ...process.env }; delete childEnv.OPENROUTER_API_KEY;

// ── the money: the apartment ledger (the tools reserve there before every call) and the job's spend window
const ledger = fileLedger(path.join(LOCAL, 'ledger.json'));
const T0 = ledger.total();
const jobLedgerFile = path.join(OUT, 'ledger.json');
let mirrored = ledger.load().rows.length;
const spent = () => +(ledger.total() - T0).toFixed(4);
const capAbs = () => +(T0 + HARD).toFixed(2);   // the absolute --cap every tool refuses past
function mirror(tag) {
  const rows = ledger.load().rows; const fresh = rows.slice(mirrored); mirrored = rows.length;
  if (!fresh.length) return;
  const j = fs.existsSync(jobLedgerFile) ? readJson(jobLedgerFile) : { $schema: 'tour360/ledger.v1', note: 'the job ledger; skin.* rows mirror the apartment ledger, where each call was reserved before it was sent', rows: [] };
  for (const r of fresh) j.rows.push({ seq: j.rows.length + 1, ts: r.at || r.ts, op: `skin.${r.op || tag}`, apartment: id, scene: r.scene, model: r.model, inputs_hash: r.inputs_hash, reserved_usd: r.reserved_usd, settled_usd: r.settled_usd ?? null, status: r.status, source: 'apartments/<id>/_local/ledger.json' });
  writeJson(jobLedgerFile, j);
}
function budget(booked, what) {
  if (spent() + booked > HARD) { stopReport(3, `hard cap: ${what} (booked $${booked}) would take the job's spend $${spent()} past $${HARD}`); }
  if (spent() + booked > SOFT && !has('--past-soft')) { stopReport(4, `soft checkpoint: the job has spent $${spent()} of the $${SOFT} soft cap; ${what} not sent. Re-run with --past-soft to continue (cached answers cost $0)`); }
}

// ── running a tool
function tool(name, args, { timeoutS = 600 } = {}) {
  const r = spawnSync('node', [path.join(TOOLS, name), ...args], { cwd: REPO, encoding: 'utf8', env: childEnv, maxBuffer: 64 * 1024 * 1024, timeout: timeoutS * 1000, windowsHide: true });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  fs.appendFileSync(path.join(OUT, 'skin.log'), `\n$ ${name} ${args.join(' ')}\n${out}`);
  mirror(name);
  if (/HTTP 40[13]\b|User is locked|TOP_UP/.test(out)) { const why = (out.match(/User is locked[^"\n]*|HTTP 40[13][^\n]*/) || ['HTTP 401/403'])[0].slice(0, 120);
    stopReport(5, `the vendor refused a call (${why}) in ${name}: the run stops; re-run after the account is unlocked (cached answers cost $0)`); }
  return { status: r.status, out };
}
const lastLine = (out, re) => { const m = out.split('\n').map((l) => l.match(re)).filter(Boolean); return m.length ? m[m.length - 1] : null; };

// ── state
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(GEN, { recursive: true });
const picksFile = path.join(LOCAL, 'picks.json');
const readPicks = () => (fs.existsSync(picksFile) ? readJson(picksFile) : {});
const setPick = (asset, file) => { const p = readPicks(); p[asset] = file; writeJson(picksFile, p); };
const report = { $schema: 'tour360/skin-report.v1', apartment: id, started: new Date().toISOString(), rule: { max_deviation_pct: RULE.max_deviation_pct, max_attempts: MAX_ATTEMPTS }, model: MODEL, caps: { soft: SOFT, hard: HARD }, scenes: {}, consistency: null, finishes: {}, spend_usd: 0, verdict: null };
// a --scenes run re-skins only those scenes: every other scene keeps its row (and its finishes) from the last report, so the report stays
// the whole apartment's record (2026-11-06, fork F: a kitchen re-skin must not erase the other ten rooms)
if (opt('--scenes')) {
  try {
    const prev = readJson(path.join(LOCAL, 'skin-report.json'));
    for (const [a, row] of Object.entries(prev.scenes || {})) if (!want.includes(a)) report.scenes[a] = { ...row, kept_from: prev.started };
    for (const [k, row] of Object.entries(prev.finishes || {})) if (!want.some((a) => k.startsWith(a))) report.finishes[k] = row;
    report.previous = { started: prev.started, consistency: prev.consistency, spend_usd: prev.spend_usd };
  } catch { /* no previous report */ }
}
function save() { report.spend_usd = spent(); writeJson(path.join(LOCAL, 'skin-report.json'), report); writeJson(path.join(OUT, 'skin-report.json'), report); }
function stopReport(code, why) { report.verdict = code === 3 ? 'HARD-CAP' : code === 4 ? 'SOFT-CHECKPOINT' : code === 5 ? 'VENDOR-REFUSED' : code === 6 ? 'NO-RENDER' : report.verdict; report.stopped = why; save(); console.error(`skin-project: ${why}`); process.exit(code); }

// ── the house style (image 3) and the floor finishes (videos.json), from the template — never per-project words
const styleRef = path.join(LOCAL, 'refs', 'style-living.png');
if (!fs.existsSync(styleRef)) { fs.mkdirSync(path.dirname(styleRef), { recursive: true }); fs.copyFileSync(path.join(ROOT, 'house-style', 'style-living.png'), styleRef); }
const videosFile = path.join(APT, 'videos.json');
if (!fs.existsSync(videosFile)) {
  const ref = readJson(path.join(ROOT, 'apartments', 'apt846', 'videos.json'));   // parity-ok: the house floor finishes are Rainbow's (parity #5)
  writeJson(videosFile, { $schema: 'tour360/videos.v1', note: `written by tools/skin-project.mjs: the house floor finishes (no video), ${new Date().toISOString().slice(0, 10)}`, floors: ref.floors, defaultFloor: ref.defaultFloor, sets: Object.fromEntries(ref.floors.map((f) => [f.id, { rooms: {} }])) });
}
const FLOORS = has('--no-floors') ? [] : (opt('--floors') ? opt('--floors').split(',') : readJson(videosFile).floors.map((f) => f.id));

// ── the sight-line map ($0): which scenes see which room's elements (consistency-check.mjs --list, the same sight-line code the judge
// uses — one code path). Every room with fixtures is one group; the kitchen keeps its own judge (hob / sink / tall column by the plan).
// The group's HOME scene is the camera inside that room; every other scene that sees the group gets the home's passed picture as a
// reference, so the element is painted once and copied (Eliran 2026-11-05: consistency «זה כלל שצריך להיות גם בתוצאות מהפורטל»).
const SEE_CM = Number(opt('--see-cm', '700'));   // farther than this a piece is a few pixels: not a reference, not judged
const camOf = (asset) => cams.scenes.find((s) => s.asset === asset);
const roomOf = (asset) => { const c = plan.camera_points.find((p) => p.id.toLowerCase() === `cp-${camOf(asset)?.id}`.toLowerCase()); return c ? plan.rooms.find((r) => r.id === c.room_id) : null; };
const anchorCam = opt('--anchor') || (cams.scenes.find((s) => s.id === 'living') || cams.scenes.find((s) => s.type === 'living') || cams.scenes[0]).id;
const anchorAsset = cams.scenes.find((s) => s.id === anchorCam)?.asset;
// the groups are consistency-check.mjs's own (--all-groups: one per room with fixtures, named by the room, plus the terrace railing —
// the same groups fork A judges on Rainbow), listed for $0 with --list
const groupRoomName = (rid) => { const r = plan.rooms.find((x) => x.id === rid) || {}; return r.type === 'kitchen' ? 'kitchen' : String(rid).replace(/^r-/, ''); };
const groups = [];
{
  const r = tool('consistency-check.mjs', [id, '--all-groups', '--list']);
  for (const l of r.out.split(/\r?\n/).filter((x) => x.startsWith('{'))) {
    let j = null; try { j = JSON.parse(l); } catch { continue; }
    const near = j.views.filter((v) => v.dist <= SEE_CM && (want.includes(v.asset) || CONTEXT.includes(v.asset)));
    if (!near.some((v) => want.includes(v.asset))) continue;   // a group no re-skinned scene sees is not judged in this run
    const homeScene = cams.scenes.find((s) => { const rm = roomOf(s.asset); return rm && groupRoomName(rm.id) === j.group; });
    const room = homeScene ? roomOf(homeScene.asset) : null;
    if (near.length >= 2) groups.push({ group: j.group, room: room?.id || null, name: room?.name_en || j.group.replace(/-/g, ' '), home: homeScene?.asset || null, viewers: near.map((v) => v.asset), dist: Object.fromEntries(near.map((v) => [v.asset, v.dist])), bearing: Object.fromEntries(near.map((v) => [v.asset, v.bearing])), hfov: Object.fromEntries(near.map((v) => [v.asset, v.hfov])) });
  }
}
report.sight_lines = groups.map(({ group, home, viewers }) => ({ group, home, viewers }));
// the order: the anchor, then the scenes whose elements the most other scenes see (their passed pictures become references), then the rest
const homeRank = (a) => groups.filter((g) => g.home === a).reduce((n, g) => n + g.viewers.length, 0);
const order = [anchorAsset, ...[...want].sort((x, y) => homeRank(y) - homeRank(x))].filter((a, i, arr) => a && want.includes(a) && arr.indexOf(a) === i);
const finalOf = (camId) => path.join(LOCAL, 'skins', `${camId}__final.png`);
const passedPick = (asset) => { const s = report.scenes[asset]; return s && s.verdict === 'PASS' && s.pick ? path.join(GEN, s.pick) : null; };

function prompts(asset) {
  const r = tool('make-skin-prompts.mjs', [id, '--roll', 'auto', '--anchor', anchorCam]);
  if (r.status !== 0) { report.scenes[asset].error = `make-skin-prompts exited ${r.status}`; return false; }
  const f = path.join(APT, 'skin-prompts.json'); const sp = readJson(f);
  const e = sp.find((x) => x.id === asset);
  if (e) {
    // the home pictures of every group this scene sees from outside (nearest first, at most 3 — the model takes 4–6 images well)
    const refs = groups.filter((g) => g.viewers.includes(asset) && g.home && g.home !== asset && passedPick(g.home))
      .sort((x, y) => x.dist[asset] - y.dist[asset]).slice(0, 3);
    const lines = [];
    for (const g of refs) {
      const rel = path.relative(APT, passedPick(g.home)).split(path.sep).join('/');
      if (!e.references.includes(rel)) e.references.push(rel);
      const n = e.references.indexOf(rel) + 1;
      lines.push(g.group === 'kitchen'
        ? `The kitchen in this view is EXACTLY the kitchen of Image ${n}: the same fronts, worktop, splashback, shelves, hob, sink and tall column, at the same place.`
        : `Every piece of the ${g.name.toLowerCase()} visible in this view is EXACTLY as in Image ${n}: the same pieces, materials, colours, shapes and places, and the same floor.`);
    }
    if (lines.length) e.prompt += ' ' + lines.join(' ');
    e.consistency_refs = refs.map((g) => g.group);
  }
  writeJson(f, sp);
  return true;
}
function generate(asset, seed) {
  budget(MODEL === 'gpt25' ? 0.6 : 2.4, `${asset} skin seed ${seed}`);
  const r = tool('gen-pano.mjs', [id, asset, MODEL, '--prompts', 'skin-prompts.json', '--seed', String(seed), '--cap', String(capAbs()), ...(DRY ? ['--dry'] : [])]);
  if (r.status === 3) stopReport(3, `gen-pano refused ${asset}: the hard cap`);
  if (DRY) { const c = lastLine(r.out, /^(cache hit \(\$0\)): (\S+)/); const b = lastLine(r.out, /booked \$([\d.]+)/); return { dry: true, cached: !!c, booked: b ? Number(b[1]) : null, refs: (readJson(path.join(APT, 'skin-prompts.json')).find((e) => e.id === asset) || {}).references }; }
  const m = lastLine(r.out, /^(?:ok|cache hit \(\$0\)|finished from the saved raw answer, no call): (\S+)/);
  if (r.status !== 0 || !m) return null;
  const file = path.basename(m[1]); setPick(asset, file); return file;
}
// parity row 24 (the coordinator, 2026-11-06): a band repair whose v3 cut is still visible (fidelity.json band_edge: structure or line
// step over the limit) is re-composited from the SAME saved answer at a wider cut search (80, then 140 px) before it counts as failed —
// $0, no call (close-seam --raw); the entrance's living band went from structure 8.0 to 0.86 this way. The repaired picture's parent
// (its sidecar) is the base again for each re-composite.
// parity row 26: the earlier finish's floor on the current pick (fork A's floor_composite.py --whole, byte-identical), gated; $0 apart from the gate
function floorComposite(a, fl, same = false) {
  if (!same && !has('--floor-composite')) return null;
  const setFile = path.join(LOCAL, `panos-${fl}`, `${a}.webp`);
  const pick = readPicks()[a]; if (!pick || !fs.existsSync(setFile)) return null;
  const srcRec = setFile.replace(/\.webp$/, '.source.json');
  const prevRec = fs.existsSync(srcRec) ? readJson(srcRec) : null;
  if (prevRec && prevRec.source === pick && !same) return null;   // the finish already sits on this pick (same: the fix loop's fallback for that finish)
  // only where the new pick GREW from the finish's source (band repairs on it: the .seam.json parent chain): a regenerated picture has its
  // own furniture and counter footprints, and the earlier floor leaves patches where they moved (apt846-auto 02/03, 2026-11-06, by eye)
  const chain = []; for (let p = pick, n = 0; p && n < 12; n++) { chain.push(p); const sc = path.join(GEN, p.replace(/\.png$/, '.seam.json')); p = fs.existsSync(sc) ? readJson(sc).parent : null; }
  if (!prevRec || !prevRec.source || !chain.includes(prevRec.source)) return { mode: 'floor-composite', verdict: 'SKIPPED', why: `the pick ${pick} did not grow from the earlier finish's source (${prevRec?.source || 'unrecorded'}): a fresh finish` };
  const cam = camOf(a); const camId = `cp-${cam.id}`; const ap = readJson(path.join(APT, 'apartment.json')); const cgTour = ap.sets?.original?.cg_tour || id;
  const depth = path.join(REPO, '360walkaround', 'tours', cgTour, 'renders', camId, 'depth.png');
  const cp = plan.camera_points.find((c) => c.id === camId);
  if (!fs.existsSync(depth) || !cp || !Number.isFinite(cp.z)) return { mode: 'floor-composite', verdict: 'SKIPPED', why: 'no CG depth or camera height' };
  const prevWebp = setFile.replace(/\.webp$/, same ? `.answer-${pick.slice(0, -4)}.webp` : `.before-${pick.slice(0, -4)}.webp`);
  if (same || !fs.existsSync(prevWebp)) fs.copyFileSync(setFile, prevWebp);   // the earlier finish (same: this attempt's answer), kept beside the set
  const tmpFinish = path.join(LOCAL, `panos-${fl}`, `${a}.prev-finish.png`);
  const py = process.env.HABAIT_PY || 'C:/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe';
  const out = path.join(GEN, `${a}__floorcomp-${fl}__${pick.replace(/\.png$/, '').split('__').pop()}.png`);
  // the finish at the pick's size, then the composite
  const sz = spawnSync('node', ['-e', `const s=require(process.argv[1]);(async()=>{const m=await s(process.argv[2]).metadata();await s(process.argv[3]).resize(m.width,m.height,{fit:'fill'}).png().toFile(process.argv[4])})()`,
    path.join(process.env.HABAIT_APP_DIR || 'C:/RnD/Projects/Habait/tools/appdeps', 'node_modules', 'sharp'), path.join(GEN, pick), prevWebp, tmpFinish], { encoding: 'utf8', windowsHide: true });
  if (sz.status !== 0) return { mode: 'floor-composite', verdict: 'ERROR', why: `resize: ${(sz.stderr || '').slice(0, 160)}` };
  const r = spawnSync(py, ['-I', path.join(TOOLS, 'floor_composite.py'), path.join(GEN, pick), tmpFinish, depth, String(cp.z), out, '--whole'], { encoding: 'utf8', windowsHide: true, timeout: 300000, env: { ...process.env, FLOOR_SLACK: String(RULE.finish_composite?.slack ?? 50) } });   // fork A: slack 30-70 (at 140 wall and threshold edges came in as white blocks)
  fs.appendFileSync(path.join(OUT, 'skin.log'), `\n$ floor_composite.py ${a} ${fl} --whole\n${r.stdout || ''}${r.stderr || ''}`);
  if (r.status !== 0 || !fs.existsSync(out)) return { mode: 'floor-composite', verdict: 'ERROR', why: (r.stderr || '').slice(-200) };
  const mk = spawnSync('node', ['-e', `require(process.argv[1])(process.argv[2]).webp({quality:90}).toFile(process.argv[3]).then(()=>0)`,
    path.join(process.env.HABAIT_APP_DIR || 'C:/RnD/Projects/Habait/tools/appdeps', 'node_modules', 'sharp'), out, setFile], { encoding: 'utf8', windowsHide: true });
  if (mk.status !== 0) return { mode: 'floor-composite', verdict: 'ERROR', why: 'webp' };
  const g = gate(a, ['--skin', setFile]);   // without a source record the gate judges the band chain of the current pick: the composite changes only the floor
  // the eye crops (legs, thresholds): the floor band of the composite beside the earlier finish, for the audit
  const crops = path.join(LOCAL, 'fidelity', `${a}__floorcomp-${fl}__eye.jpg`);
  spawnSync('node', ['-e', `const s=require(process.argv[1]);(async()=>{const m=await s(process.argv[2]).metadata();const t=Math.round(m.height*0.55),h=m.height-t;const a=await s(process.argv[2]).extract({left:0,top:t,width:m.width,height:h}).resize({width:1400}).toBuffer();const b0=await s(process.argv[3]).resize(m.width,m.height,{fit:'fill'}).toBuffer();const b=await s(b0).extract({left:0,top:t,width:m.width,height:h}).resize({width:1400}).toBuffer();const ma=await s(a).metadata();await s({create:{width:1400,height:ma.height*2+8,channels:3,background:'#222'}}).composite([{input:a,left:0,top:0},{input:b,left:0,top:ma.height+8}]).jpeg({quality:84}).toFile(process.argv[4])})()`,
    path.join(process.env.HABAIT_APP_DIR || 'C:/RnD/Projects/Habait/tools/appdeps', 'node_modules', 'sharp'), setFile, prevWebp, crops], { encoding: 'utf8', windowsHide: true });
  if (g.verdict === 'PASS') writeJson(srcRec, { answer: pick, source: pick, mode: 'floor-composite --whole', composite: path.basename(out), floor_from: path.basename(prevWebp) });
  else fs.copyFileSync(prevWebp, setFile);   // the earlier finish goes back until a paid finish replaces it
  return { mode: 'floor-composite', verdict: g.verdict, deviation_pct: g.deviation_pct, band_edge: g.band_edge?.verdict ?? null, eye_crops: path.relative(APT, crops), composite: path.basename(out) };
}

function seamTool(asset, args) {
  const r = tool('close-seam.mjs', args);
  if (r.status !== 0 || !args.includes('--pick')) return r;
  const lim = RULE.band_edge || {}; const maxS = Number(lim.max_structure ?? 5), maxL = Number(lim.max_line_step_px ?? 4);
  const over = (sc) => (sc?.cuts || []).some((c) => c.structure > maxS || (c.line_step_px ?? 0) >= maxL);
  const pick = readPicks()[asset]; if (!/__seam3__/.test(pick || '')) return r;
  const side = path.join(GEN, pick.replace(/\.png$/, '.seam.json')); if (!fs.existsSync(side)) return r;
  let sc = readJson(side); if (!over(sc)) return r;
  const raw = path.join(GEN, pick.replace('__seam3__', '__seam__').replace(/\.png$/, '.raw.png')); if (!fs.existsSync(raw)) return r;
  for (const cs of [80, 140]) {
    setPick(asset, sc.parent);
    const rr = tool('close-seam.mjs', [...args.filter((x, i) => x !== '--cut-search' && args[i - 1] !== '--cut-search'), '--raw', raw, '--cut-search', String(cs)]);
    if (rr.status !== 0) { setPick(asset, pick); continue; }
    sc = readJson(side);
    console.log(`${asset}: re-composite at cut search ${cs} px: ${JSON.stringify((sc.cuts || []).map((c) => [c.structure, c.line_step_px]))}`);
    if (!over(sc)) return rr;
  }
  return r;   // still over: the gate (band-lineage) fails it and the loop moves on
}
function seam(asset) {
  const d = tool('close-seam.mjs', [id, asset, '--lite', '--dry', '--cap', String(capAbs())]);
  const m = lastLine(d.out, /seam step before ([\d.]+) \(neighbours ([\d.]+)\)/);
  if (!m) return { skipped: 'no measure' };
  const wrap = Number(m[1]), base = Number(m[2]);
  if (wrap <= Math.max(6, 2.5 * base)) return { wrap, base, closed: false };
  if (DRY) return { wrap, base, closed: 'dry' };
  budget(0.6, `${asset} seam close`);
  const before = readPicks()[asset];
  const r = seamTool(asset, [id, asset, '--lite', '--pick', '--cap', String(capAbs())]);
  const a = lastLine(r.out, /the seam step ([\d.]+) → ([\d.]+)/);
  if (r.status !== 0 || !a) { setPick(asset, before); return { wrap, base, closed: false, error: `close-seam exited ${r.status}` }; }
  if (Number(a[2]) >= Number(a[1])) { setPick(asset, before); return { wrap, base, closed: false, tried: `${a[1]} → ${a[2]} (worse, kept the original)` }; }
  return { wrap, base, closed: true, after: Number(a[2]) };
}
function gate(asset, args = ['--set', 'picks']) {
  if (DRY) { tool('fidelity-gate.mjs', [id, '--scenes', asset, ...args, '--dry']); return { verdict: 'DRY' }; }
  budget(0.03, `${asset} gate`);
  const t0 = new Date().toISOString();
  const r = tool('fidelity-gate.mjs', [id, '--scenes', asset, ...args], { timeoutS: 900 });
  const g = readJson(path.join(LOCAL, 'fidelity', 'gate.json'));
  const row = [...g.rows].reverse().find((x) => x.asset === asset && String(x.at) >= t0);   // this call's row only
  if (r.status === 2 || !row) return { verdict: 'ERROR', note: r.out.trim().split('\n').slice(-2).join(' | ').slice(0, 300) };
  return row;
}
// a deviation the skin cannot fix: the trace or the CG itself (fidelity.json fix_loop step 4)
// a FAIL with no depth finding is the trace's — unless the picture failed on its own band edge (R25) or a ref repair's scale (R28): that is
// the skin's, and the loop regenerates (2026-11-06, fork F: apt846-auto 01/05 stopped after one attempt, wrongly sent to the trace)
const skinEdge = (row) => row?.band_edge?.verdict === 'FAIL';
const traceSide = (row) => row.verdict === 'UNRESOLVED' || (!(row.findings || []).length && row.verdict === 'FAIL' && !skinEdge(row));
function bandRepair(asset, row, k) {
  const scene = scenesDoc.scenes.find((s) => s.asset === asset); const cb = scene.centreBearingDeg ?? 0;
  const worst = [...(row.findings || [])].sort((a, b) => b.width_cm - a.width_cm)[0];
  if (!worst) return false;
  const rel = ((worst.at_bearing - cb + 540) % 360) - 180; const u = +((0.5 + rel / 360 + 1) % 1).toFixed(4);
  const band = Math.max(12, Math.min(60, Math.round(worst.deg + 10)));
  budget(0.6, `${asset} band repair ${k}`);
  const extra = worst.direction.startsWith('farther')
    ? 'Inside the band follow Image 2 (the CG render of this camera) exactly: where Image 2 shows a solid wall there is a solid painted wall, never glass, a window, a doorway or an opening; glass only where Image 2 shows glass. Keep the finishes, light and furniture style of Image 1.'
    : 'Inside the band follow Image 2 (the CG render of this camera) exactly: the room continues as far as Image 2 shows it, with no added wall, end, partition or furniture closing it off. Keep the finishes, light and furniture style of Image 1.';
  const r = seamTool(asset, [id, asset, '--lite', '--pick', '--u', String(u), '--band-deg', String(band), '--extra', extra, '--cap', String(capAbs())]);
  return r.status === 0;
}

// ── 1–5: every scene through the fix loop
for (const asset of order) {
  const cam = camOf(asset); if (!cam) { report.scenes[asset] = { verdict: 'ERROR', error: 'no camera' }; continue; }
  report.scenes[asset] = { camera: cam.id, attempts: [] }; save();
  const S = report.scenes[asset];
  let row = null;
  // --keep-picks (2026-11-06, fork F): a scene whose current pick still passes the gate is kept, not regenerated — the run goes straight
  // to the consistency step, where a FAIL repairs it from the home (the cheap path when only a seen element is wrong)
  if (has('--keep-picks') && readPicks()[asset] && fs.existsSync(path.join(GEN, readPicks()[asset]))) {
    const kept = gate(asset);
    S.attempts.push({ attempt: 'kept', gate: { verdict: kept.verdict, deviation_pct: kept.deviation_pct }, pick: readPicks()[asset] });
    if (kept.verdict === 'PASS') { S.verdict = 'PASS'; S.deviation_pct = kept.deviation_pct; S.pick = readPicks()[asset]; save(); console.log(`${asset}: kept (${kept.deviation_pct}%)`); continue; }
  }
  for (let k = 1; k <= MAX_ATTEMPTS; k++) {
    const att = { attempt: k };
    if (k === 1 || row?.verdict === 'STALE' || k === 2 || skinEdge(row)) {
      if (!prompts(asset)) break;
      const file = generate(asset, 6 + k);   // seed 7 first (the Rainbow seed), then 8, 9 …
      if (!file) { att.error = 'gen-pano produced no answer'; S.attempts.push(att); break; }
      if (file.dry) { att.dry = file; S.attempts.push(att); row = { verdict: 'DRY' }; break; }
      att.generated = file; att.seam = seam(asset);
    } else {
      att.band_repair = bandRepair(asset, row, k);
      if (!att.band_repair) { att.error = 'no band to repair'; S.attempts.push(att); break; }
    }
    row = gate(asset);
    att.gate = { mirror_exempted: (row.mirror_findings || []).map((f) => ({ bearing: `${f.bearing_from}-${f.bearing_to}°`, crop: f.crop })), verdict: row.verdict, deviation_pct: row.deviation_pct, resolution_pct: row.resolution_pct, findings: (row.findings || []).length, cg_pct: row.cg_vs_plan?.pct ?? null, dims: row.dims || null, evidence: row.evidence };
    att.pick = readPicks()[asset]; S.attempts.push(att); save();
    console.log(`${asset} attempt ${k}: ${row.verdict} ${row.deviation_pct ?? ''}%`);
    if (row.verdict === 'PASS' || row.verdict === 'DRY') break;
    if (row.verdict !== 'STALE' && traceSide(row)) { S.trace_side = `the deviation is in the trace or the CG, not the skin (${row.verdict}; dims ${JSON.stringify(row.dims || {})}; cg ${row.cg_vs_plan?.pct ?? '–'}%): fix the trace and re-render`; break; }
  }
  S.verdict = row ? row.verdict : 'ERROR'; S.deviation_pct = row?.deviation_pct ?? null; S.pick = readPicks()[asset];
  if (S.verdict === 'PASS' || S.verdict === 'DRY') {
    fs.mkdirSync(path.join(LOCAL, 'skins'), { recursive: true });
    if (!DRY && asset === anchorAsset) fs.copyFileSync(path.join(GEN, S.pick), finalOf(cam.id));   // image 2 of every other scene (make-skin-prompts)
  }
  save();
}

// ── 6: every element seen from more than one scene is the same element (the judge's list must be empty). The judge runs 3 times and
// the majority decides (R24); an unreadable answer is asked again, never regenerated on. After the first FAIL the other viewers get a
// REF REPAIR: a band at the group's bearing repainted with the home's passed picture as the reference (close-seam --ref, R10) — the
// element is copied from where it was painted once; only if that still fails are they regenerated. A changed scene that no longer
// passes the fidelity gate is put back.
const passed = () => order.filter((a) => ['PASS', 'DRY'].includes(report.scenes[a]?.verdict));
report.consistency = has('--no-consistency') ? { ...(report.previous?.consistency || {}) } : {};   // a finishes-only pass keeps the last verdicts: never a silent PASS
const uOf = (asset, bearingDeg) => { const sc = scenesDoc.scenes.find((s) => s.asset === asset); const rel = ((bearingDeg - (sc?.centreBearingDeg ?? 0) + 540) % 360) - 180; return +((0.5 + rel / 360 + 1) % 1).toFixed(4); };
function tryChange(a, label, change) {
  const keep = readPicks()[a];
  const ok = change(); if (!ok) { setPick(a, keep); return; }
  const gt = gate(a);
  report.scenes[a].attempts.push({ attempt: label, gate: { verdict: gt.verdict, deviation_pct: gt.deviation_pct }, pick: readPicks()[a] });
  if (gt.verdict === 'PASS') report.scenes[a].pick = readPicks()[a]; else setPick(a, keep);
  save();
}
for (const g of DRY || has('--no-consistency') ? [] : groups) {   // --no-consistency: a finishes-only pass over kept picks
  const C = report.consistency[g.group] = { home: g.home, rounds: [] };
  let fails = 0, reasks = 0;
  for (let round = 1; round <= 6; round++) {
    const viewers = g.viewers.filter((a) => passed().includes(a) || (CONTEXT.includes(a) && report.scenes[a]?.verdict === 'PASS'));
    if (viewers.length < 2) { C.verdict = 'NOT-COMPARABLE'; C.note = `${viewers.length} passed viewer(s)`; break; }
    budget(0.06, `${g.group} consistency judge x3`);
    const c = tool('consistency-check.mjs', [id, '--group', g.group, '--set', 'picks', '--judge', '--runs', '3', '--scenes', viewers.join(',')], { timeoutS: 1200 });
    const line = lastLine(c.out, /^judge majority .*?: (PASS|FAIL|UNREADABLE) — (.*)$/) || lastLine(c.out, /^judge .*?: (PASS|FAIL|UNREADABLE) — (.*)$/);
    // R27: a view without its render is refused by the judge (exit 4); the run stops and names it, never a silent photos-only verdict
    if (c.status === 4) stopReport(6, `the consistency judge has no render for a view of ${g.group}: ${(c.out.match(/R27: no render for [^\r\n]*/) || [''])[0].slice(0, 300)}`);
    const verdict = c.status === 0 ? 'PASS' : c.status === 2 ? 'NOT-COMPARABLE' : c.status === 3 ? 'UNREADABLE' : 'FAIL';
    C.rounds.push({ round, viewers, verdict, note: line ? line[2].slice(0, 500) : c.out.trim().split('\n').slice(-1)[0] }); C.verdict = verdict; save();
    if (verdict === 'UNREADABLE') { if (++reasks <= 2) continue; C.verdict = 'FAIL'; C.note = 'the judge could not be read three times'; break; }
    if (verdict !== 'FAIL') break;
    // the HOME first (2026-11-06, fork F: apt846-auto's 02-kitchen swapped the hob and the sink and passed the depth gate): when the
    // judge's plan-position check puts a fixture of the home's own view in the wrong place, the home is regenerated (new seed, gated)
    // before any other viewer is repainted from it — a wrong home would be copied everywhere. At most 3 home regenerations per group.
    const homeMis = (() => { try { const d = readJson(path.join(LOCAL, 'fidelity', 'consistency.json')); const row = [...d.rows].reverse().find((x) => x.group === g.group); return (row?.misplaced || []).filter((m) => m.includes(`(${g.home})`)); } catch { return []; } })();
    if (g.home && homeMis.length && (C.home_regens || 0) < 3) {
      C.home_regens = (C.home_regens || 0) + 1;
      C.rounds[C.rounds.length - 1].home_misplaced = homeMis;
      budget(0.7, `${g.home} home regeneration (${g.group}: ${homeMis.length} fixture(s) off the plan)`);
      tryChange(g.home, `consistency-${g.group}-home-regen`, () => { prompts(g.home); const f = generate(g.home, 30 + C.home_regens); if (!f) return false; seam(g.home); return true; });
      save(); continue;
    }
    fails += 1; if (fails > 2) break;
    const home = g.home && passedPick(g.home);
    if (!viewers.some((x) => x !== g.home && want.includes(x))) { C.note = `the home has no fixture off the plan; the other viewers (${viewers.filter((x) => x !== g.home).join(', ')}) are context in this run and are not repainted`; break; }
    for (const a of viewers.filter((x) => x !== g.home && want.includes(x))) {
      if (fails === 1 && home) {
        // the ref repair: the band where this scene sees the group, the home's picture as the last image
        const bearing = g.bearing?.[a]; const width = Math.max(30, Math.min(120, (g.hfov?.[a] || 70)));
        if (bearing == null) continue;
        budget(0.61, `${a} ref repair (${g.group})`);
        tryChange(a, `consistency-${g.group}-ref`, () => seamTool(a, [id, a, '--lite', '--pick', '--u', String(uOf(a, bearing)), '--band-deg', String(width), '--ref', home,
          '--extra', `Inside the band the ${g.name.toLowerCase()}'s furniture and fixtures are EXACTLY those of the last image: the same pieces, shapes, materials and colours; their places follow Image 2.`, '--cap', String(capAbs())]).status === 0);
      } else {
        tryChange(a, `consistency-${g.group}-regen`, () => { prompts(a); const f = generate(a, 20 + round); if (!f) return false; seam(a); return true; });
      }
    }
  }
}
const consistencyOk = Object.values(report.consistency).every((c) => c.verdict !== 'FAIL');

// ── 7: the web sets from the picks, then the gate on the exact bytes the build ships
if (!DRY) {
  const ms = tool('make-sets.mjs', [id]);
  report.sets = ms.status === 0 ? 'ok' : `make-sets exited ${ms.status}`;
  for (const a of passed()) { const g = gate(a, ['--set', 'balanced']); report.scenes[a].balanced = { verdict: g.verdict, deviation_pct: g.deviation_pct, mirror_exempted: (g.mirror_findings || []).map((f) => ({ bearing: `${f.bearing_from}-${f.bearing_to}°`, crop: f.crop })) }; if (g.verdict !== 'PASS') report.scenes[a].verdict = `BALANCED-${g.verdict}`; }
  save();
}

// ── 8: the floor finishes of every passing scene, each gated, retried
for (const a of DRY ? [] : passed()) {
  report.finishes[a] = {};
  for (const fl of FLOORS) {
    const F = report.finishes[a][fl] = { attempts: [] };
    // parity row 26 (the coordinator, 2026-11-06): a re-skinned scene whose camera is unchanged keeps its earlier finish's FLOOR — fork A's
    // floor_composite.py --whole puts that floor on the new pick ($0) — and only a composite that fails the gate goes to a paid finish.
    // The eye crops of the floor band (furniture legs, door thresholds) are saved for the audit beside the gate row.
    const comp = floorComposite(a, fl);
    if (comp) { F.attempts.push(comp); F.verdict = comp.verdict; save(); if (comp.verdict === 'PASS') continue; }
    for (let k = 1; k <= MAX_ATTEMPTS; k++) {
      budget(modelFor('finish').usd + 0.02, `${a} ${fl} finish ${k}`);   // the finish model's own price (R30) plus its gate
      const r = tool('finish-pano.mjs', [id, a, fl, '--cap', String(capAbs()), ...(k > 1 ? ['--seed', String(6 + k)] : [])]);   // fork A's --seed: a fresh answer under its own hash
      if (r.status === 3) stopReport(3, `finish-pano refused ${a} ${fl}: the hard cap`);
      if (r.status !== 0) { F.attempts.push({ k, error: `finish-pano exited ${r.status}` }); break; }
      const g = gate(a, ['--skin', path.join(LOCAL, `panos-${fl}`, `${a}.webp`)]);
      F.attempts.push({ k, verdict: g.verdict, deviation_pct: g.deviation_pct, findings: (g.findings || []).length });
      F.verdict = g.verdict; save();
      // fork A 2026-11-06: nano-banana-2 passes some floors directly and fails others (02 concrete/marble 16.90 %), and a direct finish that
      // passes can still change a door or casework near the floor (Rainbow's entrance front door, 1 % gate PASS). So the finish's FLOOR on its
      // own source (row 26: the pick is that source) is what ships whenever it passes; the direct answer only when the composite cannot
      // --no-finish-composite: a scene whose composites showed seams by eye (a plinth stub, a broken counter end) takes direct answers only
      const fc = has('--no-finish-composite') ? null : floorComposite(a, fl, true); if (fc) { F.attempts.push(fc); if (fc.verdict === 'PASS') { F.verdict = 'PASS'; F.shipped = 'floor-composite'; save(); break; } }
      if (g.verdict === 'PASS') { F.verdict = 'PASS'; F.shipped = 'direct'; F.note = 'the floor-only composite did not pass: the direct answer ships — check it by eye for doors and casework'; save(); break; }
    }
  }
}

const allScenes = order.every((a) => ['PASS', 'DRY'].includes(report.scenes[a]?.verdict));
const allFinishes = Object.values(report.finishes).every((fs_) => Object.values(fs_).every((f) => f.verdict === 'PASS'));
report.verdict = DRY ? 'DRY' : allScenes && allFinishes && consistencyOk ? 'PASS' : 'FAIL';
report.finished = new Date().toISOString(); save();
console.log(`skin-project ${id}: ${report.verdict} · ${order.length} scenes · spend $${spent().toFixed(2)} (soft $${SOFT}, hard $${HARD}) · report ${path.relative(REPO, path.join(LOCAL, 'skin-report.json'))}`);
process.exit(report.verdict === 'PASS' || report.verdict === 'DRY' ? 0 : 1);
