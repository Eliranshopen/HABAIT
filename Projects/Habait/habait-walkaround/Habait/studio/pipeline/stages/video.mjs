/* Stage 8 — video: clay clip + keyframe → photoreal clip, PER VARIANT (morning / evening), through fal.ai
   render-to-real (default `fal-ai/ltx-2.3-quality/render-to-real`, 3DREAL IC-LoRA: keeps the composition and
   the camera motion of the source render, repaints the look from the first-frame image). Priced per megapixel
   of output (0.0024075 USD/MP, 2026-11-01). Every call is gated by HABAIT_ALLOW_SPEND and the project cap and
   written to the ledger. Without spending the stage records an ESTIMATE and the assemble stage falls back
   to the clay clips, so the whole chain still produces a watchable draft at $0.
   Files: renders/video/<variant>/<shot>.mp4 */
import fs from 'node:fs';
import path from 'node:path';
import { TOOLS } from '../../lib/env.mjs';
import { variantsFor } from './keyframes.mjs';

export const USD_PER_MP = 0.0024075;
const RES = { '480p': [854, 480], '720p': [1280, 720], '1080p': [1920, 1080] };
// the IC-LoRA control budget ("roughly 6s at 720p or 15s at 480p", 422 above it), in 8k+1 frames at 24 fps
export const BUDGET_FRAMES = { '720p': 137, '480p': 353 }; // largest 8k+1 with frames/24 <= 6 s / 15 s

export function estimateUsd(resolution, frames, detailRefine) {
  const [w, h] = RES[resolution] || RES['720p'];
  const mult = detailRefine ? 4 : 1;
  const mp = Math.ceil((w * h * frames * mult) / 1e6);
  return Math.round(mp * USD_PER_MP * 1e4) / 1e4;
}
/** LTX wants 8k+1 frames. */
export function ltxFrames(seconds, fps) { const n = Math.round(seconds * fps); return Math.max(9, Math.ceil((n - 1) / 8) * 8 + 1); }

export function shotLine(s) {
  if (s.kind === 'room') return `This is the ${s.room_name_en || 'room'} of the apartment, seen as a person standing in it would see it.`;
  if (s.kind === 'seam') return 'The camera glides from the terrace through the open glass slider into the living room, one continuous move.';
  return 'Exterior of a residential tower and its surroundings, a slow aerial approach.';
}

export default {
  id: 'video',
  title_he: 'וידאו פוטוריאלי (render-to-real)',
  title_en: 'Video: render-to-real on fal.ai',
  paid: true,
  needs(ctx) {
    if (!ctx.derived('clay.json')) return 'clay.json missing';
    if (!ctx.derived('keyframes.json')) return 'keyframes.json missing';
    return null;
  },
  async run(ctx) {
    const o = ctx.project.options?.video || {};
    const resolution = o.resolution || '720p', refine = Boolean(o.detail_refine), seeds = Math.max(1, Number(o.seeds) || 1);
    const endpoint = o.endpoint || 'fal-ai/ltx-2.3-quality/render-to-real';
    const shots = ctx.derived('shots.json');
    const clay = ctx.derived('clay.json');
    const picks = ctx.derived('keyframes.json').picks;
    const allVariants = variantsFor(ctx.project);
    const variants = Array.isArray(o.variants) && o.variants.length ? allVariants.filter((v) => o.variants.includes(v.id)) : allVariants;
    const only = Array.isArray(o.shots) && o.shots.length ? o.shots : null; // a partial run: only these shot ids
    const prior = (ctx.derived('video.json')?.rows || []).filter((r) => only && !only.includes(r.id)); // keep the other rows
    const rows = [...prior];
    let estimateTotal = 0, spent = 0, made = 0, skipped = 0;
    for (const v of variants) {
      const outDir = ctx.file('renders', 'video', v.id);
      fs.mkdirSync(outDir, { recursive: true });
      for (const c of clay.shots) {
        if (only && !only.includes(c.id)) continue;
        const s = shots.shots.find((x) => x.id === c.id);
        const key = picks.find((p) => p.id === c.id && p.variant === v.id);
        if (!s || !key) continue;
        const frames = ltxFrames(s.duration_s, clay.fps || 24);
        const cap = BUDGET_FRAMES[resolution];
        if (cap && frames > cap) { rows.push({ id: c.id, variant: v.id, status: 'skipped', reason: `${frames} frames at ${resolution} is over the render-to-real budget (${cap}); shorten the shot or use 480p` }); skipped++; continue; }
        const est = estimateUsd(resolution, frames, refine) * seeds;
        estimateTotal += est;
        const out = path.join(outDir, `${c.id}.mp4`);
        const rel = `renders/video/${v.id}/${c.id}.mp4`;
        if (fs.existsSync(out) && !o.force) { rows.push({ id: c.id, variant: v.id, status: 'exists', file: rel }); made++; continue; }
        const intensity = o.intensity || 'light';
        const gate = ctx.spendGate(est);
        if (gate || !ctx.env.hasFal) { rows.push({ id: c.id, variant: v.id, status: 'skipped', estimate_usd: est, reason: gate || 'FAL_KEY missing' }); skipped++; continue; }
        const prompt = `3DREAL. Make it a detailed photorealistic scene, like real footage filmed by a person walking through the apartment. ${v.preset.prompt_fragment} ${shotLine(s)} Keep every wall, window, door and piece of furniture exactly where the render places it; camera motion exactly as in the source; no cuts.`;
        let best = null;
        for (let seed = 0; seed < seeds; seed++) {
          const seedOut = seeds > 1 ? path.join(outDir, `${c.id}.s${seed}.mp4`) : out;
          const r = await ctx.run(ctx.env.PYTHON, ['-I', path.join(TOOLS, 'fal_video.py'), '--endpoint', endpoint,
            '--video', ctx.file('renders', 'clay', c.id, 'clay.mp4'), '--image', ctx.file(key.file), '--prompt', prompt,
            '--num-frames', String(frames), '--fps', String(clay.fps || 24), '--resolution', resolution, '--intensity', intensity, ...(refine ? ['--detail-refine'] : []), '--seed', String(seed),
            '--out', seedOut, '--allow-spend'], { env: { FAL_KEY: ctx.env.FAL_KEY }, timeoutMs: 20 * 60 * 1000 });
          const perSeed = est / seeds;
          if (r.code === 0 && fs.existsSync(seedOut)) { spent += perSeed; ctx.spend({ stage: 'video', endpoint, usd: perSeed, note: `${c.id} ${v.id} seed ${seed}` }); best = best || seedOut; }
          else ctx.log(`${c.id} [${v.id}] seed ${seed}: fal call failed (exit ${r.code})`);
        }
        if (best) {
          if (best !== out) fs.copyFileSync(best, out);
          const row = { id: c.id, variant: v.id, status: 'done', file: rel, usd: est };
          // post-check: the sibling session's openings-in-time gate (plan openings projected per frame through
          // camera.json, contrast tested on the output); advisory here, the report is kept beside the clip
          const gate = 'C:/RnD/Projects/Habait/tools/bench/openings_gate.py';
          if (fs.existsSync(gate)) {
            const report = path.join(outDir, `${c.id}.gate.json`);
            const g = await ctx.run(ctx.env.PYTHON, ['-X', 'utf8', '-I', gate, '--plan', path.join(ctx.paths.derived, 'plan.json'), '--shot-dir', ctx.file('renders', 'clay', c.id), '--out', out, '--json', report, '--sheet', path.join(outDir, `${c.id}.gate.png`)], { timeoutMs: 10 * 60 * 1000 });
            row.gate = { exit: g.code, report: `renders/video/${v.id}/${c.id}.gate.json`, verdict: g.code === 0 ? 'PASS' : g.code === 1 ? 'FAIL' : 'not judged' };
          }
          rows.push(row); made++;
        }
        else rows.push({ id: c.id, variant: v.id, status: 'failed' });
      }
    }
    ctx.saveDerived('video.json', { endpoint, resolution, detail_refine: refine, seeds, variants: variants.map((v) => v.id), rows, estimate_usd: Math.round(estimateTotal * 100) / 100, spent_usd: Math.round(spent * 100) / 100, at: new Date().toISOString() });
    if (!made && skipped) return { status: 'skipped', note: `dry run: ${skipped} clips (${variants.map((v) => v.name_he).join(' + ')}) would cost ≈ $${estimateTotal.toFixed(2)} at ${resolution}${refine ? ' + detail refine' : ''}; enable HABAIT_ALLOW_SPEND=1 to render`, outputs: [] };
    return { status: skipped ? 'needs-review' : 'done', note: `${made} photoreal clips ($${spent.toFixed(2)})${skipped ? `, ${skipped} skipped (≈ $${estimateTotal.toFixed(2)} total)` : ''}`, outputs: rows.filter((r) => r.file).map((r) => r.file), cost_usd: spent };
  },
};
