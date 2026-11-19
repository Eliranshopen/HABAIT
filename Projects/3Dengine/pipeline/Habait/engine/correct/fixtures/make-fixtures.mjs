#!/usr/bin/env node
// make-fixtures.mjs - builds the card 02 test fixtures from the 846 ground truth, and verifies them.
//
//   node Habait/engine/correct/fixtures/make-fixtures.mjs            # (re)write the fixtures
//   node Habait/engine/correct/fixtures/make-fixtures.mjs --verify   # fix the 3 errors via ops, validate
//
// Writes (next to this file):
//   apt846.report.json          report.json in the card 01 format for 360walkaround/tours/apt846/plan.json
//   apt846-3errors.plan.json    the ground truth with three deliberate intake errors
//   apt846-3errors.report.json  the report the intake would print for it (same drawing, its own mismatches)
// Inputs (read only): the ground-truth plan, the printed dimensions of Habait/studio/fixtures/apt846.intake.json
// (16/16, read by Opus at 300 dpi), and the raster Habait/engine/_local/apt846/plan-crop.png.
//
// Raster mapping: the ground truth is in the frame of tour360's plan crop (2.25 px/cm, origin 0,0). The
// engine crop of the same sheet is the same scale shifted by (-167, +297) px (template match, score 1.000
// at four places), so cm -> engine px = [2.25, 0, -167, 0, 2.25, 297].
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import * as core from '../correct.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../../..');
const GT = join(REPO, '360walkaround/tours/apt846/plan.json');
const VALIDATOR = join(REPO, '360walkaround/pipeline/validate-plan.mjs');
const RASTER = { image: '../../_local/apt846/plan-crop.png', cm_to_px: [2.25, 0, -167, 0, 2.25, 297],
  note: 'engine crop = tour360 crop shifted (-167, +297) px, same 2.25 px/cm (template match 1.000)' };

// What the drawing prints per room (studio fixture, 16/16), and the label written in the room.
// printed_scope "part": the printed number measures part of a space whose boundary in plan.json is a
// virtual line placed by hand (plan_meta.virtual_boundaries), so the screen shows it grey, not red.
const DRAWING = {
  'r-entrance': { label_he: 'כניסה' },
  'r-kitchen': { label_he: 'מטבח' },
  'r-dining': { label_he: 'פינת אוכל' },
  'r-living': { label_he: 'חדר דיור', printed: [744, 530], scope: 'part', why: 'open plan: kitchen | dining | living are virtual lines' },
  'r-terrace-living': { label_he: 'מרפסת שמש', why: 'the printed 1213×270 is the whole terrace (two rooms in plan.json)' },
  'r-terrace-bedroom': {},
  'r-bedroom-main': { label_he: 'חדר שינה הורים', printed: [348, 344], scope: 'part', why: 'the wardrobe | bedroom line is virtual' },
  'r-wardrobe': { label_he: 'פינת ארונות', printed: [185, 160], scope: 'part', why: 'the printed 185×160 is the closet niche, not the passage' },
  'r-bath-main': { label_he: 'חדר רחצה הורים', printed: [212, 210] },
  'r-bedroom-2': { label_he: 'חדר שינה', printed: [342, 275] },
  'r-bath-guest': { label_he: 'חדר רחצה כללי', why: 'printed 140 is the shower width; no room size printed' },
};

export function buildReport(plan, extra = {}) {
  const rooms = plan.rooms.map((r) => {
    const d = DRAWING[r.id] || {};
    const measured = core.orientedDims(r.loop);
    const dv = d.printed ? core.deviation(measured, d.printed) : null;
    return {
      room_id: r.id, name_he: r.name_he, name_en: r.name_en, type: r.type,
      label_he: d.label_he || null,
      printed_dims_cm: d.printed || null, printed_scope: d.printed ? (d.scope || 'room') : null,
      measured_dims_cm: dv ? dv.measured : measured, deviation_pct: dv ? dv.pct : null,
      status: !dv ? 'no_print' : d.scope === 'part' ? 'part' : dv.pct <= core.TOL_PCT ? 'ok' : 'bad',
      openings: plan.openings.filter((o) => o.rooms?.includes(r.id)).map((o) => o.id),
      notes_he: d.why || null,
    };
  });
  const withPrint = rooms.filter((r) => r.status === 'ok' || r.status === 'bad');
  const issues = core.computeIssues(plan, { rooms });
  return {
    schema: 'habait.intake-report/0.1',
    apartment_id: plan.apartment_id,
    title_he: 'דירה 846 · Rainbow TLV, קומה 16',
    source: { pdf: 'דירה 846- 16.pdf', unit: '846', project_he: 'Rainbow TLV', plan_date: '15.10.2025', sha256: plan.plan_meta.source_sha256 },
    plan: 'plan.json',
    raster: RASTER,
    summary: {
      rooms_total: plan.rooms.length, rooms_named: plan.rooms.filter((r) => r.name_he).length,
      dims_total: 16, dims_read: 16, dims_checked: withPrint.length,
      dims_within_tol: withPrint.filter((r) => r.status === 'ok').length,
      max_dev_pct: withPrint.length ? Math.max(...withPrint.map((r) => r.deviation_pct)) : null,
      tol_pct: core.TOL_PCT, edit_cost: issues.length,
    },
    rooms,
    openings: plan.openings.map((o) => ({ opening_id: o.id, kind: o.kind, rooms: o.rooms, width_cm: o.width_cm })),
    mismatches: issues.map((x, i) => ({ id: `m-${i + 1}`, kind: x.kind, target: x.target, message_he: x.text })),
    ...extra,
  };
}

// The three deliberate errors (one of each kind the screen fixes):
//   1. a corner of the second bedroom pulled 80 cm out into the facade  -> its size turns red
//   2. the guest bathroom labelled "מחסן" (storage)                     -> the drawing says otherwise
//   3. the main bathroom's door missing                                  -> the bathroom cannot be reached
export const ERRORS = { corner: { room: 'r-bedroom-2', i: null, by: 80 }, label: { room: 'r-bath-guest', preset: 'מחסן' }, door: 'o-9' };
export function breakPlan(gt) {
  const plan = structuredClone(gt);
  const ops = [];
  const r = plan.rooms.find((x) => x.id === ERRORS.corner.room);
  // pick the corner farthest from the room's centre (an outer corner), push it 80 cm further out
  const c = core.interiorPoint(r.loop);
  let i = 0, best = -1;
  r.loop.forEach((p, k) => { const d = Math.hypot(p[0] - c[0], p[1] - c[1]); if (d > best) { best = d; i = k; } });
  const p = r.loop[i], L = Math.hypot(p[0] - c[0], p[1] - c[1]);
  const to = [p[0] + ((p[0] - c[0]) / L) * ERRORS.corner.by, p[1] + ((p[1] - c[1]) / L) * ERRORS.corner.by];
  ops.push(core.opMoveVertex(plan, r.id, i, to)); core.applyOp(plan, ops.at(-1));
  ops.push(core.opSetRoom(plan, ERRORS.label.room, core.ROOM_PRESETS.find((x) => x.he === ERRORS.label.preset))); core.applyOp(plan, ops.at(-1));
  ops.push(core.opDeleteOpening(plan, ERRORS.door)); core.applyOp(plan, ops.at(-1));
  return { plan, ops, corner: { room: r.id, i, from: p, to } };
}

function validate(plan, tag) {
  const f = join(HERE, `.${tag}.tmp.json`);
  writeFileSync(f, JSON.stringify(plan));
  const r = spawnSync(process.execPath, [VALIDATOR, f, '--json'], { encoding: 'utf8' });
  spawnSync(process.execPath, ['-e', `require('fs').unlinkSync(${JSON.stringify(f)})`]);
  const j = JSON.parse(r.stdout);
  return { code: r.status, fails: j.fails };
}

const gt = JSON.parse(readFileSync(GT, 'utf8'));
if (process.argv.includes('--verify')) {
  const broken = JSON.parse(readFileSync(join(HERE, 'apt846-3errors.plan.json'), 'utf8'));
  const rep = JSON.parse(readFileSync(join(HERE, 'apt846-3errors.report.json'), 'utf8'));
  const before = core.computeIssues(broken, rep);
  console.log(`3errors: ${before.length} issues before: ${before.map((x) => x.kind + ':' + x.target).join(', ')}`);
  // the fix, as Eliran would do it: drag the corner back onto the drawing's corner (snap), pick the name, tap the wall
  const plan = structuredClone(broken), ops = [];
  const { room, i, from } = rep.deliberate_errors.corner;
  const snapped = core.snapPoint(plan, [from[0] + 4, from[1] - 3], 12, { roomId: room, i });
  ops.push(core.opMoveVertex(plan, room, i, snapped.p)); core.applyOp(plan, ops.at(-1));
  ops.push(core.opSetRoom(plan, 'r-bath-guest', core.ROOM_PRESETS.find((x) => x.he === 'חדר רחצה כללי'))); core.applyOp(plan, ops.at(-1));
  const door = core.placeOpening(plan, gt.openings.find((o) => o.id === 'o-9').centre_cm, 'door');
  ops.push(core.opAddOpening(plan, door)); core.applyOp(plan, ops.at(-1));
  core.finalizePlan(broken, plan);
  const after = core.computeIssues(plan, rep);
  const v = validate(plan, 'fixed');
  console.log(`fix ops: ${ops.map((o) => o.type).join(', ')}; corner snapped (${snapped.kind}) to ${snapped.p} (truth ${from}); door ${door.id} ${door.rooms.join('|')} ${door.width_cm} cm`);
  console.log(`3errors: ${after.length} issues after: ${after.map((x) => x.kind + ':' + x.target).join(', ') || 'none'}; validate-plan exit ${v.code}`);
  const gtIssues = core.computeIssues(gt, JSON.parse(readFileSync(join(HERE, 'apt846.report.json'), 'utf8')));
  const ok = v.code === 0 && after.length === gtIssues.length && before.length === gtIssues.length + 3;
  console.log(ok ? 'verify OK' : 'verify FAIL'); process.exit(ok ? 0 : 1);
} else {
  const rep = buildReport(gt);
  writeFileSync(join(HERE, 'apt846.report.json'), JSON.stringify(rep, null, 1) + '\n');
  const { plan, ops, corner } = breakPlan(gt);
  const b = buildReport(plan, { deliberate_errors: { corner, label: ERRORS.label, door: ERRORS.door, ops } });
  // the intake reads the drawing, not the plan: the labels stay those of the drawing
  b.title_he = 'דירה 846 · ניסוי שלוש שגיאות';
  writeFileSync(join(HERE, 'apt846-3errors.plan.json'), JSON.stringify(plan, null, 1) + '\n');
  writeFileSync(join(HERE, 'apt846-3errors.report.json'), JSON.stringify(b, null, 1) + '\n');
  const v1 = validate(gt, 'gt'), v2 = validate(plan, 'broken');
  console.log(`apt846.report.json: ${rep.rooms.length} rooms, ${rep.mismatches.length} mismatches, max_dev ${rep.summary.max_dev_pct}% (${rep.summary.dims_within_tol}/${rep.summary.dims_checked} within ${core.TOL_PCT}%)`);
  console.log(`apt846-3errors: corner ${corner.room}/loop/${corner.i} ${corner.from} -> ${corner.to.map((v) => v.toFixed(1))}; ${b.mismatches.length} mismatches; validate gt exit ${v1.code}, broken exit ${v2.code} ${v2.fails.slice(0, 2).join(' | ')}`);
}
