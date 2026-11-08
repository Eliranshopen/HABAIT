/* Stage 5 — scene: plan.json → renders/scene.blend through the repo's own deterministic builder
   (360walkaround/pipeline/build_scene.py: walls, openings, panes, furniture, HDRI, sun, terrain). Nothing
   studio-specific is added here; the tower mass and the neighbours are appended at render time (clay stage),
   so the .blend stays byte-compatible with the 360 tour pipeline. */
import fs from 'node:fs';
import path from 'node:path';
import { PIPELINE } from '../../lib/env.mjs';

export default {
  id: 'scene',
  title_he: 'סצנת Blender מהתכנית',
  title_en: 'Scene: Blender build from the plan',
  local: true,
  needs(ctx) {
    if (!ctx.derived('plan.json')) return 'plan.json missing';
    if (!fs.existsSync(ctx.env.BLENDER)) return `Blender not found at ${ctx.env.BLENDER} (set BLENDER in .env)`;
    return null;
  },
  isStale(ctx, prior) {
    const blend = ctx.file('renders', 'scene.blend');
    if (!fs.existsSync(blend)) return true;
    const planAt = fs.statSync(path.join(ctx.paths.derived, 'plan.json')).mtimeMs;
    return planAt > fs.statSync(blend).mtimeMs;
  },
  async run(ctx) {
    const plan = path.join(ctx.paths.derived, 'plan.json');
    const out = ctx.file('renders', 'scene.blend');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const extra = ctx.project.options?.scene?.args || [];
    const r = await ctx.run(ctx.env.BLENDER, ['-b', '--factory-startup', '-P', path.join(PIPELINE, 'build_scene.py'), '--',
      plan.replace(/\\/g, '/'), '--out', out.replace(/\\/g, '/'), ...extra], { cwd: PIPELINE, timeoutMs: 40 * 60 * 1000 });
    if (r.code !== 0) return { status: 'blocked', note: `build_scene.py exited ${r.code}: ${r.tail.split('\n').filter(Boolean).slice(-3).join(' | ')}` };
    if (!fs.existsSync(out)) return { status: 'blocked', note: 'build_scene.py exited 0 but wrote no scene.blend' };
    const report = fs.existsSync(`${out}.report.json`) ? JSON.parse(fs.readFileSync(`${out}.report.json`, 'utf8')) : null;
    return { status: 'done', note: `scene.blend built in ${r.seconds.toFixed(0)}s${report?.checks ? `; checks ${JSON.stringify(report.checks).slice(0, 80)}` : ''}`, outputs: ['renders/scene.blend'] };
  },
};
