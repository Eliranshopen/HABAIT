#!/usr/bin/env node
/* Habait Tour360 — tools/consistency-check.mjs (Eliran 2026-11-04: «דבר כזה לא יכול לקרות חייב שיהיה עקביות» — from 03-dining the kitchen
   was a matte white L, from 02-kitchen a stainless kitchen with a curved counter). A fixed element (the kitchen run, the hob, the sink,
   the wardrobe fronts) must be the SAME element from every scene that sees it, and must sit where the plan puts it.
   For one element group (plan.general.json fixtures by id or by room):
     1. every scene whose camera sees the group (no plan wall between the camera and the group's centre, within 12 m) is found;
     2. from each, a perspective view is cut at the group's plan bearing (wide enough for its whole footprint), from the designed set and
        from the CG render of the same camera (the structure reference);
     3. a sheet: one row per scene, designed | CG, with the scene name and bearing → _local/fidelity/consistency__<group>__<hash>.jpg;
     4. --judge: ONE vision call with every designed view (google/gemini-3.7-flash via the chat transport, ledgered before it runs,
        ≈ $0.01): "the same kitchen in every view? where are the hob and the sink?" → JSON. FAIL (exit 1) when it answers not the same,
        or names the hob/sink on a run the plan does not (--expect "hob:long,sink:long").
   usage: node Habait/tour360/tools/consistency-check.mjs apt846 --group kitchen [--set balanced|picks] [--judge] [--expect hob:long/corner,sink:long/middle,tall:far]
          [--scenes 02-kitchen,03-dining,04-living] [--skin <asset>=<file> ...]
   Groups: kitchen = k-counter, k-counter-2, k-tall · wardrobe = w-closet-1, w-closet-2 · any fixture id list "a,b". FAL_KEY by name only. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { appRequire } from './app-require.mjs';
import { fileLedger, loadEnv } from './file-ledger.mjs';
import { loadPano, render } from './pano-geometry.mjs';
import { chatFetch } from '../server/chat-transport.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOUR = path.resolve(HERE, '..');
const REPO = path.resolve(TOUR, '..', '..');
const sharp = appRequire(REPO)('sharp');
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const flags = (n) => args.flatMap((a, i) => (a === n ? [args[i + 1]] : []));
const VALUE = ['--group', '--set', '--expect', '--scenes', '--skin', '--cg-tour', '--tol', '--at', '--recheck'];
const aptId = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && VALUE.includes(args[i - 1])))[0];
const group = flag('--group', 'kitchen');
if (!aptId) { console.error('usage: consistency-check.mjs <apartment> --group kitchen [--set balanced|picks] [--judge] [--expect hob:long/corner,sink:long/middle,tall:far]'); process.exit(2); }
const GROUPS = { kitchen: ['k-counter', 'k-counter-2', 'k-tall'], wardrobe: ['w-closet-1', 'w-closet-2'] };
// --all-groups (2026-11-05): every element group seen from >= 2 cameras, derived from the plan — fixtures clustered by their id prefix
// (k-, l-, d-, bm-, w-, b2-, bg-) plus the terrace railing (the railing panes); each group gets a sheet and a generic judge.
const ALL_GROUPS = (() => {
  const plan0 = JSON.parse(fs.readFileSync(path.join(TOUR, 'apartments', aptId, 'plan.general.json'), 'utf8'));
  // one group per ROOM (project-runner fork F, 2026-11-05: the same rule for every project — a portal plan's fixture ids are the
  // tracer's, not apt846's prefixes). The name is the room id without "r-", the kitchen room is "kitchen"; for apt846 this gives the
  // same groups as the old id-prefix clusters (kitchen, living, dining, bedroom-main, wardrobe, bedroom-2, bath-main, bath-guest).
  const out = {};
  const nameOf = (rid) => { const r = (plan0.rooms || []).find((x) => x.id === rid) || {}; return r.type === 'kitchen' ? 'kitchen' : String(rid).replace(/^r-/, ''); };
  for (const f of plan0.fixtures || []) { if (!f.room_id) continue; const n = nameOf(f.room_id); (out[n] = out[n] || []).push(f.id); }
  if ((plan0.panes || []).some((q) => q.kind === 'railing')) out['terrace-railing'] = ['railing'];
  return out;
})();
const allGroups = args.includes('--all-groups');
// apt846's named groups apply only where the plan carries those ids (Rainbow); any other plan uses its rooms (ALL_GROUPS)
const planIds = new Set(JSON.parse(fs.readFileSync(path.join(TOUR, 'apartments', aptId, 'plan.general.json'), 'utf8')).fixtures?.map((f) => f.id) || []);
const named = GROUPS[group] && GROUPS[group].some((x) => planIds.has(x)) ? GROUPS[group] : null;
const ids = allGroups ? [] : (named || ALL_GROUPS[group] || group.split(','));
const LIST = args.includes('--list');
// R27 never judges photos-only by accident (the coordinator, 2026-11-06): the render of a view is the CG tour's renders/<cam>/pano.webp
// (gitignored) or, when that tour is the apartment's own original set, its TRACKED copy panos/original/<asset>.webp; a view with
// neither is refused below (exit 4, the file named) unless --no-render-context asks for the photos-only judge on purpose
const NO_RENDERS = args.includes('--no-render-context');
function renderFor(camId, asset) {
  const live = path.join(REPO, '360walkaround', 'tours', cgTour, 'renders', camId, 'pano.webp');
  if (fs.existsSync(live)) return live;
  try {
    const A = path.join(TOUR, 'apartments', aptId); const o = JSON.parse(fs.readFileSync(path.join(A, 'apartment.json'), 'utf8')).sets?.original;
    const tracked = o && path.join(A, o.dir || 'panos/original', `${asset}.webp`);
    if (tracked && (o.cg_tour || aptId) === cgTour && fs.existsSync(tracked)) return tracked;
  } catch { /* no apartment.json */ }
  return null;
}   // $0: which scenes see the group(s), as JSON lines; no picture needed, no judge
const setName = flag('--set', 'balanced');
// the structure reference is the FINAL render (2026-11-06, the coordinator): apartment.json sets.original.cg_tour (apt846: apt846-furnished),
// as make-sets and the gate use; the tour named after the apartment held the stale 2026-10-28 draft renders
const cgTour = flag('--cg-tour', (() => { try { return JSON.parse(fs.readFileSync(path.join(TOUR, 'apartments', aptId, 'apartment.json'), 'utf8')).sets?.original?.cg_tour; } catch { return null; } })() || aptId);
const APT = path.join(TOUR, 'apartments', aptId);
const OUTD = path.join(APT, '_local', 'fidelity'); fs.mkdirSync(OUTD, { recursive: true });
const plan = JSON.parse(fs.readFileSync(path.join(APT, 'plan.general.json'), 'utf8'));
const scenes = JSON.parse(fs.readFileSync(path.join(APT, 'scenes.json'), 'utf8')).scenes;
const picks = (() => { try { return JSON.parse(fs.readFileSync(path.join(APT, '_local', 'picks.json'), 'utf8')); } catch { return {}; } })();
const skinOverride = Object.fromEntries(flags('--skin').map((s) => s.split('=')));
const railingFx = ids.includes('railing') ? plan.panes.filter((q) => q.kind === 'railing').map((q) => ({ id: q.id, polygon_cm: q.polygon_cm, kind: 'railing' })) : [];
const fx = plan.fixtures.filter((f) => ids.includes(f.id)).concat(railingFx);
if (!allGroups && !fx.length) { console.error(`no fixtures ${ids.join(',')} in the plan`); process.exit(2); }
const pts = fx.flatMap((f) => f.polygon_cm || [f.centre_cm]);
const centre = [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];

const walls = plan.walls.flatMap((w) => w.polygon_cm.map((a, i) => [a, w.polygon_cm[(i + 1) % w.polygon_cm.length]]))
  // a door opening blocks the sight line too (2026-11-05): a peek through a doorway depends on the leaf and is no basis for a verdict
  .concat((plan.openings || []).filter((o) => o.kind !== 'opening' && o.a_cm && o.b_cm).map((o) => [o.a_cm, o.b_cm]));
const cross = (p, q, a, b) => { const d = (q[0] - p[0]) * (b[1] - a[1]) - (q[1] - p[1]) * (b[0] - a[0]); if (Math.abs(d) < 1e-9) return false; const t = ((a[0] - p[0]) * (b[1] - a[1]) - (a[1] - p[1]) * (b[0] - a[0])) / d, s = ((a[0] - p[0]) * (q[1] - p[1]) - (a[1] - p[1]) * (q[0] - p[0])) / d; return t > 0.02 && t < 0.98 && s >= 0 && s <= 1; };
const bearing = (from, to) => (((Math.atan2(to[0] - from[0], -(to[1] - from[1])) * 180 / Math.PI) % 360) + 360) % 360;
const norm = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
// ===== the deterministic checks (2026-11-06, the coordinator after Eliran found 04-living's kitchen with UPPER cabinets, a straight run
// and no stainless while 02/03 show open curved shelves on stainless — the judge passed that group 3/3 — and 02's sink beside the fridge):
// the verdict is CODE over fixed fields, never the judge's free text ("same" and "differences" are kept as notes only).
//   (1) bearings: x in the view → plan bearing (the view's yaw + hfov) within --tol° (2026-11-04, unchanged);
//   (2) the tall column's type (parity row 23) when the checklist does not carry it;
//   (3) SPACING in cm along the run (parity row 31): the hob, the sink and the tall column x → bearing → the ray meets the run's line
//       through that fixture's plan point → the fixture's along-run offset in cm; the gaps (consistency_checklist.spacing.pairs:
//       sink↔tall, hob↔sink) against the plan's own gaps, ±tol_cm; a ray within grazing_deg of the run line is skipped (unstable);
//   (4) the ATTRIBUTE CHECKLIST (parity row 32): per view the judge fills FIXED fields (fidelity.json consistency_checklist.<group>,
//       the kitchen's for any kitchen group, else .default); every field must agree across the views that see it (a number within the
//       field's tol) and match what the DATA expects (plan-derived: uppers from fixture_hints, the tall type from the plan; plus
//       apartments/<id>/consistency-expect.json for the board and Eliran's rulings); ANY mismatch = FAIL; a visible view without the
//       checklist = UNREADABLE (asked again, never regenerated on).
const FID = (() => { try { return JSON.parse(fs.readFileSync(path.join(TOUR, 'fidelity.json'), 'utf8')); } catch { return {}; } })();
const CL = FID.consistency_checklist || {};
const TALL_TYPE = (fx.find((f) => f.kind === 'tall_unit' && f.tall_type) || {}).tall_type || null;
const IS_KITCHEN = fx.some((f) => ['counter', 'tall_unit', 'hob', 'sink', 'island'].includes(f.kind));
const CHECK = CL[group] || (IS_KITCHEN ? CL.kitchen : null) || CL.default || null;
const TOL = Number(flag('--tol', 15));
const AT = {}; let HINTS = {};
try {
  const fp = JSON.parse(fs.readFileSync(path.join(REPO, '360walkaround', 'tours', cgTour, 'plan.json'), 'utf8'));
  HINTS = fp.furnishing?.fixture_hints || {};
  for (const [id, h] of Object.entries(HINTS)) { if (!fx.some((x) => x.id === id)) continue; if (h.hob_at_cm) AT.hob = h.hob_at_cm; if (h.sink_at_cm) AT.sink = h.sink_at_cm; }
  const tall = (fp.fixtures || []).find((f) => f.kind === 'tall_unit' && fx.some((x) => x.id === f.id)); if (tall) AT.tall = tall.centre_cm;
} catch { /* no furnished plan */ }
for (const kv of (flag('--at') || '').split(';').filter(Boolean)) { const [k, v] = kv.split('='); AT[k] = v.split(',').map(Number); }
const EXPECT_FILE = path.join(APT, 'consistency-expect.json');
const EXPECT = (() => {
  const e = {}; const f = CHECK?.fields || {};
  const ups = fx.map((x) => HINTS[x.id]?.uppers).filter((u) => u !== undefined);
  if (f.upper_cabinets && ups.length) e.upper_cabinets = { want: ups.some((u) => u === true || u === 'cabinets') ? ['yes'] : ['no'], source: `the furnished plan's fixture_hints uppers (${ups.join(', ')})` };
  if (f.shelves_open && ups.includes('shelves')) e.shelves_open = { want: ['yes'], source: 'the furnished plan\'s fixture_hints uppers = "shelves"' };
  if (f.tall_type && TALL_TYPE) e.tall_type = { want: [TALL_TYPE === 'pantry' ? 'storage' : TALL_TYPE], source: `the plan's tall_unit tall_type = ${TALL_TYPE} (parity row 23)` };
  try { const file = JSON.parse(fs.readFileSync(EXPECT_FILE, 'utf8'))[group] || {}; for (const [k, v] of Object.entries(file)) if (!k.startsWith('$') && f[k]) e[k] = { want: [].concat(v.want), source: v.source || path.relative(TOUR, EXPECT_FILE) }; } catch { /* no expectations file: plan-derived only */ }
  return e;
})();
// a panel-ready integrated fridge behind the run's own fronts LOOKS like tall storage (row 23 notes): for a fridge, "storage" counts as it
const canon = (field, x) => (field === 'tall_type' && TALL_TYPE === 'fridge' && x === 'storage' ? 'fridge' : x);
const SP = { pairs: [['sink', 'tall'], ['hob', 'sink']], tol_cm: 30, grazing_deg: 20, bearing_noise_deg: 3, ...(CL.spacing || {}) };
const inPoly = (p, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > p[1]) !== (P[j][1] > p[1]) && p[0] < ((P[j][0] - P[i][0]) * (p[1] - P[i][1])) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; };
// the run: the counter that holds the sink (else the first counter); its direction = its polygon's longest edge; origin = the tall column
const RUN = (() => {
  const counters = fx.filter((f) => f.kind === 'counter' && f.polygon_cm);
  const run = counters.find((f) => AT.sink && inPoly(AT.sink, f.polygon_cm)) || counters[0];
  if (!run) return null;
  let best = null; const P = run.polygon_cm;
  for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (!best || L > best.L) best = { L, d: [(b[0] - a[0]) / L, (b[1] - a[1]) / L] }; }
  return { id: run.id, d: best.d, o: AT.tall || run.centre_cm };
})();
const xToBearing = (x, v) => (v.bearing + Math.atan(((x / 1000) - 0.5) * 2 * Math.tan((v.hfov * Math.PI / 180) / 2)) * 180 / Math.PI + 360) % 360;
// the ray from C at bearing b meets the line P + s·d (the run direction through the fixture's plan point): s = the along-run offset in cm
function alongOffset(C, b, P) {
  const r = [Math.sin(b * Math.PI / 180), -Math.cos(b * Math.PI / 180)], d = RUN.d, den = r[0] * d[1] - r[1] * d[0];
  if (Math.abs(den) < Math.sin(SP.grazing_deg * Math.PI / 180)) return { grazing: true };
  const w = [P[0] - C[0], P[1] - C[1]];
  const t = (w[0] * d[1] - w[1] * d[0]) / den, s = (w[0] * r[1] - w[1] * r[0]) / den;
  return t > 0 ? { s } : { behind: true };
}
const planAlong = (P) => (P[0] - RUN.o[0]) * RUN.d[0] + (P[1] - RUN.o[1]) * RUN.d[1];
function checklistCheck(perView, views) {
  const out = { fails: [], missing: [], table: {} };
  if (!CHECK?.fields) return out;
  for (const [field, spec] of Object.entries(CHECK.fields)) {
    const vals = [];
    perView.forEach((p, i) => {
      const v = views[i]; if (!v || p.visible === false) return;
      const c = p.checklist; if (!c || !(field in c)) { out.missing.push(`view ${p.view} (${v.asset}) ${field}`); return; }
      // a field tied to an element (the oven to the hob) is not read in a view that does not see that element (01-entrance sees only the
      // tall column: its "no oven" is not a view of the hob; 2026-11-06)
      if ((spec.requires || []).some((k) => p[k] == null)) return;
      let x = c[field]; if (x === null || x === undefined || x === 'not_visible') return;
      if (spec.type === 'number') { x = Number(x); if (!Number.isFinite(x)) return; }
      else { x = canon(field, String(x).toLowerCase().trim()); if (spec.values && !spec.values.map((s) => canon(field, s)).includes(x)) out.fails.push(`view ${p.view} (${v.asset}) ${field} = "${x}", not one of ${spec.values.join('|')}`); }
      vals.push({ view: p.view, asset: v.asset, x });
    });
    out.table[field] = Object.fromEntries(vals.map((q) => [q.asset, q.x]));
    if (spec.type === 'number') {
      const xs = vals.map((q) => q.x);
      if (xs.length > 1 && Math.max(...xs) - Math.min(...xs) > (spec.tol ?? 0)) out.fails.push(`${field} differs between views: ${vals.map((q) => `${q.asset} ${q.x}`).join(', ')} (±${spec.tol ?? 0})`);
    } else if (new Set(vals.map((q) => q.x)).size > 1) out.fails.push(`${field} differs between views: ${vals.map((q) => `${q.asset} ${q.x}`).join(', ')}`);
    const e = EXPECT[field];
    if (e) for (const q of vals) {
      const ok = spec.type === 'number' ? (q.x >= e.want[0] && q.x <= (e.want[1] ?? e.want[0])) : e.want.map((w) => canon(field, String(w).toLowerCase())).includes(q.x);
      if (!ok) out.fails.push(`${q.asset} ${field} = ${q.x}; the data says ${e.want.join('|')} (${e.source})`);
    }
  }
  return out;
}
// ONE function for the live judge and for --recheck (the cached answers): returns every deterministic finding; mutates perView with the
// computed bearings and along-run offsets so the row shows them
function deterministic(perView, views) {
  const misplaced = [], spacing = { fails: [], rows: [] };
  perView.forEach((p, i) => {
    const v = views[i]; if (!v) return;
    const camP = plan.camera_points.find((c) => c.id === v.cam); if (!camP) return;
    const C = [camP.x, camP.y];
    if (p.checklist?.tall_type && !p.tall_is) p.tall_is = p.checklist.tall_type;
    const seen = {}, slack = {};   // slack = how far a ±bearing_noise_deg misreading of x moves that fixture along the run (far, oblique views move more)
    for (const [key, xk] of [['hob', 'hob_x'], ['sink', 'sink_x'], ['tall', 'tall_x']]) {
      if (!AT[key] || typeof p[xk] !== 'number') continue;
      const got = xToBearing(p[xk], v), want = bearing(C, AT[key]), d = Math.abs(norm(got - want));
      p[`${key}_bearing`] = Math.round(got); p[`${key}_plan_bearing`] = Math.round(want); p[`${key}_off_deg`] = Math.round(d);
      if (d > TOL) misplaced.push(`view ${p.view} (${v.asset}) ${key} at ${Math.round(got)}°, the plan has it at ${Math.round(want)}° (${Math.round(d)}° off)`);
      if (RUN) { const a = alongOffset(C, got, AT[key]); if (a.s !== undefined) { seen[key] = planAlong(AT[key]) + a.s; p[`${key}_along_off_cm`] = Math.round(a.s); const n = SP.bearing_noise_deg || 0, lo = alongOffset(C, got - n, AT[key]), hi = alongOffset(C, got + n, AT[key]); slack[key] = lo.s !== undefined && hi.s !== undefined ? Math.abs(hi.s - lo.s) / 2 : Infinity; } else p[`${key}_along_off_cm`] = a.grazing ? 'grazing' : 'behind'; }
    }
    for (const [a, b] of RUN ? SP.pairs : []) {
      if (seen[a] === undefined || seen[b] === undefined) continue;
      const got = Math.abs(seen[a] - seen[b]), want = Math.abs(planAlong(AT[a]) - planAlong(AT[b])), off = got - want, tol = Math.round(SP.tol_cm + Math.hypot(slack[a] || 0, slack[b] || 0));
      spacing.rows.push({ view: p.view, asset: v.asset, pair: `${a}-${b}`, got_cm: Math.round(got), plan_cm: Math.round(want), off_cm: Math.round(off), tol_cm: tol });
      p[`${a}_${b}_gap_cm`] = Math.round(got);
      if (Math.abs(off) > tol) spacing.fails.push(`view ${p.view} (${v.asset}) ${a}↔${b} ${Math.round(got)} cm along the run, the plan has ${Math.round(want)} cm (${off > 0 ? '+' : ''}${Math.round(off)} cm, ±${tol})`);
    }
    if (!CHECK?.fields?.tall_type) {
      const shown = String(p.tall_is || '').toLowerCase(), wantTall = TALL_TYPE === 'pantry' ? 'storage' : TALL_TYPE;
      const okTall = wantTall === 'fridge' ? ['fridge', 'storage'] : [wantTall];
      if (TALL_TYPE && shown && shown !== 'not_visible' && !okTall.includes(shown)) misplaced.push(`view ${p.view} (${v.asset}) the tall column shows as ${shown}; the drawing makes it the ${wantTall}`);
    }
  });
  return { misplaced, spacing, checklist: checklistCheck(perView, views) };
}
const detVerdict = (judge, det) => (judge.raw || det.checklist.missing.length ? 'UNREADABLE'
  : !CHECK?.fields && !judge.same ? 'FAIL'   // no checklist configured anywhere (an older fidelity.json): the old judge.same decides
  : det.misplaced.length || det.spacing.fails.length || det.checklist.fails.length ? 'FAIL' : 'PASS');
const printDet = (det, tag = '') => {
  if (det.misplaced.length) console.log(`${tag}misplaced vs the plan (±${TOL}°): ${det.misplaced.join(' | ')}`);
  if (det.spacing.rows.length) console.log(`${tag}spacing along ${RUN?.id} (got/plan ±tol cm): ${det.spacing.rows.map((r) => `${r.asset} ${r.pair} ${r.got_cm}/${r.plan_cm}±${r.tol_cm}`).join(', ')}${det.spacing.fails.length ? ` → FAIL: ${det.spacing.fails.join(' | ')}` : ''}`);
  if (CHECK?.fields) console.log(`${tag}checklist: ${det.checklist.missing.length ? `MISSING ${det.checklist.missing.length} field(s) (e.g. ${det.checklist.missing.slice(0, 3).join(', ')})` : 'complete'}${det.checklist.fails.length ? ` → FAIL: ${det.checklist.fails.join(' | ')}` : ''}`);
};
// --recheck <row,row|last> ($0, no call): the deterministic checks re-applied to CACHED judge answers in consistency.json; prints and
// writes _local/fidelity/recheck__<group>__<stamp>.json (never a consistency.json row: those are judge runs)
if (flag('--recheck')) {
  const doc0 = JSON.parse(fs.readFileSync(path.join(OUTD, 'consistency.json'), 'utf8'));
  const mine = doc0.rows.map((r, i) => [r, i]).filter(([r]) => r.group === group && r.judge?.per_view);
  const want0 = flag('--recheck') === 'last' ? mine.slice(-1).map(([, i]) => i) : flag('--recheck').split(',').map(Number);
  const out = [];
  for (const i of want0) {
    const r = doc0.rows[i]; if (!r || r.group !== group || !r.judge?.per_view) { console.log(`row ${i}: not a ${group} row with an answer`); continue; }
    const vws = r.views.map((v) => { const s = scenes.find((q) => q.asset === v.asset); const cam = s && plan.camera_points.find((c) => c.id.toLowerCase() === `cp-${s.id}`.toLowerCase()); return { asset: v.asset, cam: cam?.id, bearing: v.bearing, hfov: v.hfov }; });
    const pv = JSON.parse(JSON.stringify(r.judge.per_view));
    const det = deterministic(pv, vws); const verdict = detVerdict(r.judge, det);
    console.log(`row ${i} (${r.at}, cached ${r.verdict}): recheck ${verdict}${det.checklist.missing.length ? ' (the cached answer predates the checklist)' : ''}`);
    printDet(det, '  ');
    out.push({ row: i, at: r.at, cached_verdict: r.verdict, recheck_verdict: verdict, pictures: r.views.map((v) => v.picture), misplaced: det.misplaced, spacing: det.spacing, checklist: det.checklist, per_view: pv });
  }
  const f = path.join(OUTD, `recheck__${group}__${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(f, JSON.stringify({ $schema: 'tour360/consistency-recheck.v1', group, run: RUN, expect: EXPECT, spacing_rule: SP, rows: out }, null, 1));
  console.log(`→ ${path.relative(APT, f)}`);
  process.exit(out.some((o) => o.recheck_verdict === 'FAIL') ? 1 : 0);
}

if (allGroups) {
  const { spawnSync } = await import('node:child_process');
  const pass = [], fail = [], skipped = [];
  for (const g of Object.keys(ALL_GROUPS)) {
    const sub = args.filter((a) => a !== '--all-groups' && !(a === '--group' || (args[args.indexOf(a) - 1] === '--group')));
    const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), ...sub, '--group', g], { encoding: 'utf8', env: process.env });
    const out = (r.stdout || '') + (r.stderr || '');
    if (LIST) { const j = out.split(/\r?\n/).find((l) => l.startsWith('{')); if (j) console.log(j); continue; }
    const line = out.trim().split(/\r?\n/).filter(Boolean);
    console.log(`[${g}] ` + line.slice(-2).join(' / '));
    if (r.status === 0) pass.push(g); else if (/nothing to compare|seen from/.test(out)) skipped.push(g); else fail.push(g);
  }
  if (LIST) process.exit(0);
  console.log(`all groups: PASS ${pass.length} [${pass.join(', ')}] · FAIL ${fail.length} [${fail.join(', ')}] · single-camera ${skipped.length} [${skipped.join(', ')}]`);
  process.exit(fail.length ? 1 : 0);
}
const want = flag('--scenes') ? flag('--scenes').split(',') : null;
const views = [];
for (const s of scenes) {
  if (want && !want.includes(s.asset)) continue;
  const cam = plan.camera_points.find((c) => c.id.toLowerCase() === `cp-${s.id}`.toLowerCase());
  if (!cam) continue;
  const C = [cam.x, cam.y];
  const dist = Math.hypot(centre[0] - C[0], centre[1] - C[1]);
  // seen when at least one of the group's points has a clear line (no wall) from the camera
  const seen = pts.some((p) => !walls.some(([a, b]) => cross(C, p, a, b)));
  if (!want && (!seen || dist > 1200)) continue;
  const bs = pts.map((p) => bearing(C, p)); const mid = bearing(C, centre);
  const span = Math.max(...bs.map((b) => Math.abs(norm(b - mid))));
  const hfov = Math.max(70, Math.min(120, 2 * span + 24));
  const yaw = norm(mid - s.centreBearingDeg);
  // --set floor:<id> (2026-11-06): a floor-finish set the visitor can switch to (videos.json floors[].panos → _local/panos-<id>/); Eliran saw
// 04's kitchen wrong only in the finish sets (the default view is the parquet set), so the checklist runs on them too
  const skin = skinOverride[s.asset] ? path.resolve(skinOverride[s.asset]) : setName === 'picks' ? path.join(APT, '_local', 'generated', picks[s.asset] || '') : setName.startsWith('floor:') ? path.join(APT, '_local', `panos-${setName.slice(6)}`, `${s.asset}.webp`) : path.join(APT, 'panos', setName, `${s.asset}.webp`);
  const cg = renderFor(cam.id, s.asset);
  if (!fs.existsSync(skin) && !LIST) { console.error(`${s.asset}: no picture ${skin}`); process.exit(2); }
  views.push({ asset: s.asset, cam: cam.id, dist: Math.round(dist), bearing: Math.round(mid), yaw, hfov, skin, cg: fs.existsSync(cg) ? cg : null });
}
if (LIST) { console.log(JSON.stringify({ group, fixtures: fx.map((f) => f.id), views: views.map((v) => ({ asset: v.asset, dist: v.dist, bearing: v.bearing, hfov: Math.round(v.hfov) })) })); process.exit(0); }
if (views.length < 2) { console.error(`${group}: seen from ${views.length} scene(s); nothing to compare`); process.exit(2); }
const noRender = views.filter((v) => !v.cg);
if (args.includes('--judge') && !NO_RENDERS && noRender.length) {
  for (const v of noRender) console.error(`R27: no render for ${v.asset}: ${path.join(REPO, '360walkaround', 'tours', cgTour, 'renders', v.cam, 'pano.webp')} (and no tracked original); refused — build or fetch the render, or pass --no-render-context on purpose`);
  process.exit(4);
}

const VW = 720, VH = 480;
const cut = async (file, v) => { const p = await loadPano(sharp, file); const buf = render(p, v.yaw, -12, v.hfov, VW, VH); return sharp(buf, { raw: { width: VW, height: VH, channels: 3 } }).jpeg({ quality: 86 }).toBuffer(); };
const label = (t) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${VW}" height="28"><rect width="${VW}" height="28" fill="#000"/><text x="8" y="19" fill="#fff" font-size="15" font-family="Arial">${t}</text></svg>`);
const parts = []; let y = 0; const designed = [], renders = [];
for (const v of views) {
  const a = await cut(v.skin, v); designed.push(a);
  parts.push({ input: await sharp(label(`${v.asset} — designed (${setName}) · plan bearing ${v.bearing}° · ${v.dist} cm`)).png().toBuffer(), left: 0, top: y });
  parts.push({ input: await sharp(label(`${v.asset} — CG (${cgTour}) · the structure reference`)).png().toBuffer(), left: VW + 8, top: y });
  parts.push({ input: a, left: 0, top: y + 28 });
  const r = v.cg ? await cut(v.cg, v) : null; renders.push(r);
  if (r) parts.push({ input: r, left: VW + 8, top: y + 28 });
  y += VH + 28 + 8;
}
const h = crypto.createHash('sha256').update(Buffer.concat(designed)).digest('hex').slice(0, 12);
const sheet = path.join(OUTD, `consistency__${group}__${setName.replace(":", "-")}__${h}.jpg`);
await sharp({ create: { width: VW * 2 + 8, height: y, channels: 3, background: '#222' } }).composite(parts).jpeg({ quality: 84 }).toFile(sheet);
console.log(`${group}: ${views.map((v) => `${v.asset}@${v.bearing}°`).join(', ')} → ${path.relative(APT, sheet)}`);

let verdict = 'SHEET-ONLY', judge = null, misplaced = [], renderContext = null; const runs = [];
if (args.includes('--judge')) {
  const env = loadEnv(REPO);
  if (!env.FAL_KEY && !env.OPENROUTER_API_KEY) { console.error('consistency-check: no FAL_KEY / OPENROUTER_API_KEY by name'); process.exit(2); }
  const MODEL = 'google/gemini-3.7-flash', EST = 0.01;
  const ledger = fileLedger(path.join(APT, '_local', 'ledger.json'));
  // R24 (the coordinator's ruling 2026-11-05): --runs N asks the judge N times; the MAJORITY decides and every run is kept in the row
  const RUNS = Math.max(1, Number(flag('--runs', '1')));
  async function judgeOnce(k) {
  const misplaced = [];
  const row = ledger.reserve({ ts: new Date().toISOString(), op: 'consistency_judge', apartment: aptId, scene: group, model: MODEL, inputs_hash: h, reserved_usd: EST, status: 'reserved' });
  // ONE judge for every project (the coordinator 2026-11-05, parity row 16): the generic words, and for a kitchen the positions of the hob,
  // the sink and the tall column asked in every view and checked against the PLAN's own data (fixture_hints, the tall unit's centre).
  // The L-kitchen words below (apt846's long run / short return) are no longer used: anything Rainbow-specific is per-project data.
  const generic = true;
  const kitchenKinds = fx.some((f) => ['counter', 'tall_unit', 'hob', 'sink', 'island'].includes(f.kind));
  // parity row 23: the tall unit is what the drawing says (plan fixture tall_type); the judge says what each photo shows it as
  const tallType = (fx.find((f) => f.kind === 'tall_unit' && f.tall_type) || {}).tall_type || null;
  const TALL_ASK = tallType && !CHECK?.fields?.tall_type ? ', "tall_is": "fridge|oven|storage|not_visible"' : '';
  // the attribute checklist (parity row 32): fixed fields per view; the CODE compares them (deterministic() above)
  const CHECK_ASK = CHECK?.fields ? ` Every per_view entry ALSO carries "checklist": {${Object.entries(CHECK.fields).map(([k, s]) => `"${k}": ${s.type === 'number' ? 'number|null' : `"${s.values.join('|')}|not_visible"`}`).join(', ')}}. The fields: ${Object.entries(CHECK.fields).map(([k, s]) => `"${k}" = ${s.ask}`).join('; ')}. Fill EVERY field from what THAT photo shows (never from the other photos, never from what such an element usually has); "not_visible" (or null for a number) only when that part cannot be seen in that photo. The code compares these fields between the photos and against the drawing; "same" and "differences" are notes only.` : '';
  const TALL_RULE = tallType ? ' "tall_is" is what the tall column visibly IS in THAT photo: "fridge" (full-height flush doors, a fridge-freezer), "oven" (built-in ovens at eye height), "storage" (plain doors, no appliance), or "not_visible".' : '';
  const sysGeneric = `You check an architectural visualisation for consistency. You get ${views.length} photos of ONE apartment taken from different rooms; each photo looks toward the same ${group} (the element group: ${fx.map((f) => `${f.id} ${f.kind}`).join(', ')}). Return ONLY JSON: {"same": true|false, "differences": ["..."], "per_view": [{"view": 1, "visible": true|false, "material": "...", "colour": "...", "shape": "...", "position_note": "..."${kitchenKinds ? ', "hob_x": number|null, "sink_x": number|null, "tall_x": number|null' : ''}${TALL_ASK}}]}.${TALL_RULE}${kitchenKinds ? ' "hob_x", "sink_x" and "tall_x" are the horizontal centre of the hob, the sink and the tall column in THAT photo, 0 = left edge, 1000 = right edge, null when not visible; they are checked against the plan, so read them carefully.' : ''} "same" is true only if every part of the element that is visible in two or more photos is the same element in each (the same shape, material, colour, size and place against the same walls/glass); furniture dressing that differs (a cushion, a plant, a book) does not count, but a different sofa, a different bed, a different railing, a different floor or a different wall finish does. Photos where the element is not visible are not differences.`;
  const sys = generic ? sysGeneric : `You check an architectural visualisation for consistency. You get ${views.length} photos of ONE apartment taken from different rooms; each photo looks toward the same ${group}. Return ONLY JSON: {"same": true|false, "differences": ["..."], "per_view": [{"view": 1, "fronts": "...", "worktop": "...", "splashback": "...", "hob_on": "long_run|short_return|not_visible", "hob_position": "corner_end|middle|far_end|not_visible", "sink_on": "long_run|short_return|not_visible", "sink_position": "corner_end|middle|far_end|not_visible", "tall_column_at": "corner_end|far_end|not_visible", "hob_x": number|null, "sink_x": number|null, "tall_x": number|null, "short_return_shape": "rectangular|rounded|not_visible"}]}. "hob_x", "sink_x" and "tall_x" are the horizontal centre of the hob, the sink and the tall column in THAT photo, 0 = left edge, 1000 = right edge, null when not visible. "same" is true only if every visible part (front colour and material, worktop material, splashback, appliances, the L shape and where the hob, the sink and the tall column are) is the same in every photo where it is visible. The long run is the long leg of the L against the partition wall; the short return is the short leg toward the facade glass. On the long run, the CORNER end is the end that meets the short return (near the glass); the FAR end is the opposite end, away from the glass. Judge positions by where a thing sits along the run, not by which side of the photo it is on.`;
  // R27 (2026-11-06, the coordinator's ruling): every photo goes with its OWN final render from the same viewpoint, and the judge reports
  // only what the render does not explain. Architecture seen from two places differs (a square corner with a doorway from the entrance,
  // the rounded end from the living room); that is the building, not an inconsistency. Default on when every view has a render
  // (--no-render-context reproduces the earlier photos-only judge); every run is kept with its mode.
  const withRenders = !args.includes('--no-render-context') && renders.every(Boolean);
  renderContext = withRenders;
  const RENDER_RULE = withRenders ? ` Each photo N is followed by RENDER N: the plain computer render of the TRUE building from exactly the same viewpoint (its furniture are grey or wooden placeholder blocks, not the design; its walls, wall ends, corners, doorways, openings and windows are the truth). Architecture that looks different between photos but matches each photo's own render is the same building seen from different places: do NOT report it. Report only differences the renders do not explain: furniture, materials, colours, fixtures, and any architecture where a photo departs from its OWN render. per_view is by photo number.` : '';
  const img = (b) => ({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + b.toString('base64') } });
  const content = withRenders
    ? [{ type: 'text', text: `Photos 1..${views.length}, each followed by its render: ${views.map((v, i) => `${i + 1} = from ${v.asset}`).join('; ')}.` }, ...designed.flatMap((b, i) => [{ type: 'text', text: `Photo ${i + 1}:` }, img(b), { type: 'text', text: `Render ${i + 1} (same viewpoint):` }, img(renders[i])])]
    : [{ type: 'text', text: `Photos 1..${views.length}: ${views.map((v, i) => `${i + 1} = from ${v.asset}`).join('; ')}.` }, ...designed.map(img)];
  // 2026-11-06 (the coordinator): with R27 the prompt carries twice the images and 2 of 3 kitchen answers came back without JSON
  // (max_tokens 2500 cut them); the answer budget is 8000 and the output is pinned to ONE JSON object (response_format + the words below)
  const JSON_ONLY = ' Output ONLY the one JSON object described above: no prose before or after it, no markdown fences, no comments; keep each text field short (under 25 words).';
  let res, j, judge, text = '', usd = 0;
  for (let ask = 1; ask <= 2; ask++) {   // an unreadable answer is asked again once (it is a judge failure, never an inconsistency)
  try {
    res = await chatFetch(env)('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { Authorization: 'Bearer ' + (env.OPENROUTER_API_KEY || ''), 'Content-Type': 'application/json' }, body: JSON.stringify({ model: MODEL, temperature: 0, max_tokens: 8000, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: sys + CHECK_ASK + RENDER_RULE + JSON_ONLY }, { role: 'user', content }] }), signal: AbortSignal.timeout(180000) });
    j = await res.json();
  } catch (e) { ledger.settle(row, EST, { status: 'error-unknown-billing', note: String(e.message).slice(0, 120) }); throw e; }
  usd += Number(j?.usage?.cost) || EST;
  text = j?.choices?.[0]?.message?.content || '';
  if (!res || !res.ok) { judge = { same: false, differences: [`the judge call failed: HTTP ${res && res.status}`], raw: `http-${res && res.status}` }; break; }   // a refused call is UNREADABLE, never a FAIL
  try { const s = text.indexOf('{'), e = text.lastIndexOf('}'); judge = JSON.parse(text.slice(s, e + 1)); } catch { judge = { same: false, differences: ['the judge returned no JSON'], raw: `(unreadable, finish ${j?.choices?.[0]?.finish_reason ?? '?'}) ` + text.slice(0, 300) }; }
  if (!judge.raw) break;
  }
  ledger.settle(row, usd, { status: res && res.ok ? 'ok' : `http-${res && res.status}`, ...(judge.raw ? { note: 'unreadable twice' } : {}) });
  const expect = Object.fromEntries((flag('--expect') || '').split(',').filter(Boolean).map((kv) => kv.split(':')));
  // --expect hob:long/corner,sink:long/middle,tall:far — each value is "<on>[/<position>]"; a view fails when a visible element is not where the plan puts it
  const bad = (p, key, on, pos) => { const e = expect[key]; if (!e) return false; const [eo, ep] = e.split('/'); const vo = p[on], vp = pos ? p[pos] : null; if (!vo || vo === 'not_visible') return false; if (eo && !vo.startsWith(eo)) return true; if (ep && vp && vp !== 'not_visible' && !vp.startsWith(ep)) return true; return false; };
  // the deterministic checks (bearings, the tall type, spacing in cm, the attribute checklist): ONE function, deterministic() above
  const det = deterministic(judge.per_view || [], views); misplaced.push(...det.misplaced);
  const wrongPlace = generic ? [] : (judge.per_view || []).filter((p) => bad(p, 'hob', 'hob_on', 'hob_position') || bad(p, 'sink', 'sink_on', 'sink_position') || (expect.tall && p.tall_column_at && p.tall_column_at !== 'not_visible' && !p.tall_column_at.startsWith(expect.tall)));
  const verdict = wrongPlace.length && !judge.raw ? 'FAIL' : detVerdict(judge, det);   // 2026-11-06: no free-text verdict (judge.same is a note)
  printDet(det);
  console.log(`judge${RUNS > 1 ? ` ${k + 1}/${RUNS}` : ''} (${MODEL}, $${usd.toFixed(4)}): ${verdict} — same: ${judge.same}; ${(judge.differences || []).slice(0, 6).join(' | ')}${wrongPlace.length ? ` | not where the plan puts it: ${wrongPlace.map((p) => `view ${p.view} hob ${p.hob_on}/${p.hob_position} sink ${p.sink_on}/${p.sink_position} tall ${p.tall_column_at}`).join(', ')}` : ''}`);
  return { judge, verdict, misplaced, usd, det };
  }
  for (let k = 0; k < RUNS; k++) runs.push(await judgeOnce(k));
  const readable = runs.filter((r) => r.verdict !== 'UNREADABLE');
  const passes = readable.filter((r) => r.verdict === 'PASS').length;
  verdict = !readable.length ? 'UNREADABLE' : passes * 2 > readable.length ? 'PASS' : 'FAIL';
  const pick = runs.find((r) => r.verdict === verdict) || runs[runs.length - 1];
  judge = pick.judge; misplaced = pick.misplaced;
  if (RUNS > 1) console.log(`judge majority ${passes}/${readable.length} readable (of ${RUNS}): ${verdict} — ${(judge.differences || []).slice(0, 6).join(' | ')}`);
}
const gj = path.join(OUTD, 'consistency.json');
const doc = (() => { try { return JSON.parse(fs.readFileSync(gj, 'utf8')); } catch { return { $schema: 'tour360/consistency.v1', rows: [] }; } })();
doc.rows.push({ at: new Date().toISOString(), group, set: setName, cg_tour: cgTour, render_context: renderContext, misplaced, runs: runs.map((r) => ({ verdict: r.verdict, checklist_fails: r.det?.checklist.fails || [], checklist_missing: r.det?.checklist.missing.length || 0, spacing: r.det?.spacing || null, same: r.judge?.same ?? null, differences: (r.judge?.differences || []).slice(0, 8), ...(r.judge?.raw ? { raw: String(r.judge.raw).slice(0, 200) } : {}), usd: r.usd })), views: views.map(({ asset, bearing, dist, hfov, skin }) => ({ asset, bearing, dist, hfov, picture: path.relative(APT, skin) })), sheet: path.relative(APT, sheet), verdict, judge });
fs.writeFileSync(gj, JSON.stringify(doc, null, 1));
process.exit(verdict === 'FAIL' ? 1 : verdict === 'UNREADABLE' ? 3 : 0);   // 3 = the judge could not be read (ask again; never regenerate on it)
