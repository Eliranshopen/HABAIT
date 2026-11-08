/* Stage 6 — clay: the shots rendered as plain CG ("clay") frames — the MOTION and the GEOMETRY of every
   clip, never its final look. tools/render_shots.py opens scene.blend, appends the tower mass and the
   OSM neighbours from site.json, flies the camera along shots.json and writes PNG frames; ffmpeg packs each
   shot into clay/<shot>/clay.mp4 and keeps first.png (the keyframe seed). Local = CPU here; a GPU box is faster. */
import fs from 'node:fs';
import path from 'node:path';
import { TOOLS } from '../../lib/env.mjs';

export default {
  id: 'clay',
  title_he: 'רנדר clay של ה-shots',
  title_en: 'Clay: render the shots',
  local: true,
  needs(ctx) {
    if (!fs.existsSync(ctx.file('renders', 'scene.blend'))) return 'scene.blend missing';
    if (!ctx.derived('shots.json')) return 'shots.json missing';
    return null;
  },
  isStale(ctx, prior) {
    const shotsAt = fs.statSync(path.join(ctx.paths.derived, 'shots.json')).mtimeMs;
    return !prior.at || shotsAt > Date.parse(prior.at);
  },
  async run(ctx) {
    const o = ctx.project.options?.clay || {};
    const res = o.res || '640x360', samples = o.samples || 16, engine = o.engine || 'CYCLES', fps = o.fps || 24;
    const only = Array.isArray(o.shots) && o.shots.length ? o.shots : null;
    const shots = ctx.derived('shots.json');
    const outRoot = ctx.file('renders', 'clay');
    fs.mkdirSync(outRoot, { recursive: true });
    const args = ['-b', '--factory-startup', '-P', path.join(TOOLS, 'render_shots.py'), '--',
      '--blend', ctx.file('renders', 'scene.blend'), '--shots', path.join(ctx.paths.derived, 'shots.json'),
      '--out', outRoot, '--res', res, '--samples', String(samples), '--engine', engine];
    if (fs.existsSync(path.join(ctx.paths.derived, 'site.json'))) args.push('--site', path.join(ctx.paths.derived, 'site.json'));
    if (fs.existsSync(path.join(ctx.paths.derived, 'plan.json'))) args.push('--plan', path.join(ctx.paths.derived, 'plan.json'));
    const tf = path.join(ctx.paths.derived, 'tower-footprint.json');
    if (fs.existsSync(tf)) args.push('--tower-footprint', tf);
    const sk = path.join(ctx.paths.derived, 'site-key.json');
    if (fs.existsSync(sk)) args.push('--site-key', sk);
    const tm = path.join(ctx.paths.derived, 'tower-mass.obj'); // the sibling session's massing model, when it exists
    if (fs.existsSync(tm)) args.push('--tower-mass', tm);
    if (only) args.push('--shots-only', only.join(','));
    if (o.max_frames) args.push('--max-frames', String(o.max_frames));
    if (o.resume) args.push('--resume'); // a killed run continues: complete frames in renders/clay/<shot> are kept
    const r = await ctx.run(ctx.env.BLENDER, args.map((a) => a.replace(/\\/g, '/')), { timeoutMs: (o.timeout_min || 180) * 60 * 1000 });
    if (r.code !== 0) return { status: 'blocked', note: `render_shots.py exited ${r.code}: ${r.tail.split('\n').filter(Boolean).slice(-2).join(' | ')}` };

    // pack every rendered shot with ffmpeg
    const done = [], failed = [];
    for (const s of shots.shots) {
      if (only && !only.includes(s.id)) continue;
      const dir = path.join(outRoot, s.id);
      const frames = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^frame_\d{4}\.png$/.test(f)).sort() : [];
      if (!frames.length) { failed.push(s.id); continue; }
      fs.copyFileSync(path.join(dir, frames[0]), path.join(dir, 'first.png'));
      const mp4 = path.join(dir, 'clay.mp4');
      const rf = await ctx.run(ctx.env.FFMPEG, ['-nostdin', '-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(dir, 'frame_%04d.png'),
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', mp4]);
      if (rf.code === 0) done.push({ id: s.id, frames: frames.length }); else failed.push(s.id);
    }
    // a partial run (options.clay.shots) keeps the clips rendered earlier for the other shots
    const prior = only ? (ctx.derived('clay.json')?.shots || []).filter((p) => !only.includes(p.id) && fs.existsSync(path.join(outRoot, p.id, 'clay.mp4'))) : [];
    ctx.saveDerived('clay.json', { res, samples, engine, fps, shots: [...prior, ...done], failed, partial: Boolean(only), at: new Date().toISOString() });
    if (!done.length) return { status: 'blocked', note: `no shot rendered (${failed.join(', ')})` };
    return { status: failed.length ? 'needs-review' : 'done', note: `${done.length} clay clips (${res}, ${samples} spp, ${engine})${failed.length ? `; failed: ${failed.join(', ')}` : ''}`, outputs: done.map((d) => `renders/clay/${d.id}/clay.mp4`) };
  },
};
