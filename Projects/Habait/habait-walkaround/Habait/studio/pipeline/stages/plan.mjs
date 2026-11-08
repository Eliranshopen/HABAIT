/* Stage 3 — plan: the traced vector plan (plan.json, SCHEMA.md, centimetres) is the geometry's single source of
   truth. Today the accepted inputs are (a) a traced plan the user uploads (plan.json / plan.general.json / *.plan.json)
   — validated by the repo's own validator — or (b) a VLM DRAFT from the LLM, written to plan.draft.json and
   held for review (D-WQ-16: hand trace now, importers later). A draft never becomes plan.json by itself. */
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod/v4';
import { PIPELINE } from '../../lib/env.mjs';
import { structured, listInputs } from '../../lib/llm.mjs';

const DraftSchema = z.object({
  scale_px_per_cm: z.number().nullable(),
  ceiling_height_cm: z.number(),
  rooms: z.array(z.object({
    id: z.string(), name_he: z.string(), name_en: z.string(),
    type: z.string(), is_outdoor: z.boolean(),
    bbox_cm: z.array(z.number()).length(4).describe('[x0,y0,x1,y1] in cm, origin = the plan\'s outer NW corner, +y down'),
    printed_dims_cm: z.array(z.number()).nullable(),
  })),
  openings: z.array(z.object({
    kind: z.enum(['door', 'entrance_door', 'opening', 'window']),
    rooms: z.array(z.string()).describe('room ids on each side; the outside is "outside"'),
    centre_cm: z.array(z.number()).length(2), width_cm: z.number(),
  })),
  facade_sides: z.array(z.enum(['N', 'E', 'S', 'W'])).describe('which sides of the unit are glass facade (plan frame: N = up)'),
  notes: z.array(z.string()),
});

function findUploadedPlan(dir) {
  const files = fs.readdirSync(dir);
  const pick = files.find((f) => /^plan(\.general)?\.json$/i.test(f)) || files.find((f) => /\.plan\.json$/i.test(f));
  return pick ? path.join(dir, pick) : null;
}

export default {
  id: 'plan',
  title_he: 'התכנית הווקטורית (plan.json)',
  title_en: 'Plan: the traced vector plan',
  haltOnReview: true,
  needs(ctx) { return ctx.store.files(ctx.id).length ? null : 'no files uploaded'; },
  async run(ctx) {
    const uploaded = findUploadedPlan(ctx.paths.intake);
    const target = path.join(ctx.paths.derived, 'plan.json');
    if (uploaded) {
      const plan = JSON.parse(fs.readFileSync(uploaded, 'utf8'));
      const general = plan.geometry === 'general' || plan.plan_meta?.geometry === 'general';
      const validator = path.join(PIPELINE, general ? 'validate-plan-general.mjs' : 'validate-plan.mjs');
      fs.copyFileSync(uploaded, target);
      const r = await ctx.run(process.execPath, [validator, target, '--quiet']);
      if (r.code === 2) return { status: 'blocked', note: `validator usage/parse error (exit 2) on ${path.basename(uploaded)}` };
      if (r.code === 1) return { status: 'blocked', note: `${path.basename(uploaded)} FAILS ${path.basename(validator)} — see the log` };
      const n = { rooms: plan.rooms?.length, walls: plan.walls?.length, openings: plan.openings?.length, panes: plan.panes?.length, cams: plan.camera_points?.length };
      return { status: 'done', note: `${path.basename(uploaded)} validated: ${n.rooms} rooms, ${n.walls} walls, ${n.openings} openings, ${n.panes ?? 0} panes, ${n.cams} camera points`, outputs: ['derived/plan.json'] };
    }
    if (fs.existsSync(target)) return { status: 'done', note: 'plan.json already in derived/ (approved earlier)', outputs: ['derived/plan.json'] };

    // no traced plan: ask the LLM for a DRAFT (rooms as boxes, openings, facade sides) and hold it for review
    if (!ctx.env.hasLLM) return { status: 'needs-review', note: 'no traced plan.json uploaded and no LLM backend for a draft: trace the plan (tools/trace-plan.mjs) or upload plan.json' };
    const inputs = listInputs(ctx.paths.intake, ctx.paths.dir).filter((f) => f.kind !== 'text');
    const r = await structured({ env: ctx.env, log: ctx.log, dir: ctx.paths.dir, inputs, schema: DraftSchema,
      system: 'You are a floor-plan tracer. Read the sales plan and return a schematic draft. Use printed dimensions; never guess a size from pixels without them.',
      task: 'Draft the unit plan as room boxes in centimetres (origin = outer NW corner of the unit, +y down), using the PRINTED dimensions to set the scale. Mark every door/opening and which sides are glass facade. This is a draft for a human tracer.' });
    ctx.spend({ stage: 'plan', endpoint: `${r.backend}:${r.model || '-'}`, usd: Math.round((r.usd || 0) * 1e4) / 1e4, note: 'plan draft' });
    if (!r.ok) return { status: 'blocked', note: `draft failed: ${r.note}`, cost_usd: r.usd || 0 };
    ctx.saveDerived('plan.draft.json', { ...r.data, _meta: { source: 'llm-draft', backend: r.backend, model: r.model, at: new Date().toISOString() } });
    return { status: 'needs-review', note: `LLM draft written (${r.data.rooms.length} rooms) — a human trace to plan.json is still required (D-WQ-16)`, outputs: ['derived/plan.draft.json'], cost_usd: r.usd || 0 };
  },
};
