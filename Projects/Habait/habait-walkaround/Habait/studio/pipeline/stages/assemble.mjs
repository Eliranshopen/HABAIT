/* Stage 9 — assemble: the deliverables, PER VARIANT. outputs/<variant>/clips/<shot>.mp4 (the photoreal clip
   when it exists, else the clay clip, so a $0 run still yields a watchable draft), outputs/<variant>/master.mp4
   (exterior → seam → rooms in tour order, a bilingual title per room burned in), and outputs/tour.json. */
import fs from 'node:fs';
import path from 'node:path';
import { variantsFor } from './keyframes.mjs';

/** Width and height of a PNG from its header (no decoder needed). */
export function pngSize(file) {
  try { const b = fs.readFileSync(file).subarray(0, 24); if (b.toString('ascii', 1, 4) !== 'PNG') return null; return [b.readUInt32BE(16), b.readUInt32BE(20)]; } catch { return null; }
}
/** render-to-real PADS to its own size (960x540 in -> 960x576 out, black bars), it does not stretch: scale up to
    cover the clay frame and centre-crop back to it. A no-op on clay clips. */
export function fitTo([w, h]) { return `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1`; }

function ffText(s) { return String(s).replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'").replace(/%/g, '\\%'); }

export default {
  id: 'assemble',
  title_he: 'הרכבה: קליפים לפי חדר + master',
  title_en: 'Assemble: per-room clips + master',
  local: true,
  cacheable: false,
  needs(ctx) { return ctx.derived('clay.json') ? null : 'clay.json missing'; },
  async run(ctx) {
    const shots = ctx.derived('shots.json');
    const clay = ctx.derived('clay.json');
    const video = ctx.derived('video.json');
    const variants = variantsFor(ctx.project);
    const font = fs.existsSync('C:/Windows/Fonts/arial.ttf') ? 'C\\:/Windows/Fonts/arial.ttf' : null;
    const result = { schema: 'habait-studio/tour.v2', project: ctx.project.id, variants: [], at: new Date().toISOString() };
    let total = 0, photoreal = 0;
    for (const v of variants) {
      // the FIRST row per shot wins: the picked clip (no seed) is unshifted to the top, the seed rows follow
      const videoFiles = {};
      for (const r of (video?.rows || []).filter((x) => x.file && x.variant === v.id && x.status !== 'failed')) if (!videoFiles[r.id]) videoFiles[r.id] = r.file;
      const vdir = path.join(ctx.paths.outputs, v.id);
      const clipsDir = path.join(vdir, 'clips');
      fs.mkdirSync(clipsDir, { recursive: true });
      const list = [];
      for (const s of shots.shots) {
        if (!clay.shots.find((c) => c.id === s.id)) continue;
        const src = videoFiles[s.id] ? ctx.file(videoFiles[s.id]) : ctx.file('renders', 'clay', s.id, 'clay.mp4');
        if (!fs.existsSync(src)) continue;
        const dst = path.join(clipsDir, `${s.id}.mp4`);
        const label = s.kind === 'room' ? `${s.room_name_he || ''} · ${s.room_name_en || ''}` : s.kind === 'seam' ? 'כניסה · Entry' : 'חזית · Exterior';
        const size = pngSize(ctx.file('renders', 'clay', s.id, 'first.png')) || String(ctx.project.options?.clay?.res || '1280x720').split('x').map(Number);
        const fit = fitTo(size);
        const vf = font ? `${fit},drawtext=fontfile='${font}':text='${ffText(label)}':fontcolor=white:fontsize=h/18:box=1:boxcolor=black@0.35:boxborderw=12:x=w-tw-24:y=h-th-24:enable='lt(t,2.5)'` : null;
        const base = ['-nostdin', '-y', '-loglevel', 'error', '-i', src];
        const tail = ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-r', String(clay.fps || 24), '-an', dst];
        let r = await ctx.run(ctx.env.FFMPEG, [...base, '-vf', vf || fit, ...tail]);
        if (r.code !== 0 && vf) r = await ctx.run(ctx.env.FFMPEG, [...base, '-vf', fit, ...tail]);
        if (fs.existsSync(dst)) list.push({ id: s.id, kind: s.kind, label, room_id: s.room_id || null, camera_point: s.camera_point || null, duration_s: s.duration_s, source: videoFiles[s.id] ? 'photoreal' : 'clay', file: `outputs/${v.id}/clips/${s.id}.mp4` });
      }
      if (!list.length) continue;
      const concat = path.join(vdir, 'concat.txt');
      fs.writeFileSync(concat, list.map((c) => `file '${ctx.file(c.file).replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
      const master = path.join(vdir, 'master.mp4');
      const r = await ctx.run(ctx.env.FFMPEG, ['-nostdin', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', concat, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', master]);
      const pr = list.filter((c) => c.source === 'photoreal').length;
      total += list.length; photoreal += pr;
      result.variants.push({ id: v.id, name_he: v.name_he, name_en: v.name_en, preset: v.preset.id, clips: list, master: r.code === 0 && fs.existsSync(master) ? `outputs/${v.id}/master.mp4` : null, photoreal: pr });
    }
    if (!result.variants.length) return { status: 'blocked', note: 'no clip to assemble' };
    fs.writeFileSync(path.join(ctx.paths.outputs, 'tour.json'), JSON.stringify(result, null, 2));
    const draft = photoreal < total;
    return { status: draft ? 'needs-review' : 'done', note: `${result.variants.map((v) => `${v.name_he}: ${v.clips.length} clips`).join(', ')} (${photoreal}/${total} photoreal)${draft ? ' — a DRAFT (clay) until the video stage runs with spending on' : ''}`, outputs: result.variants.flatMap((v) => [v.master, ...v.clips.map((c) => c.file)]).filter(Boolean) };
  },
};
