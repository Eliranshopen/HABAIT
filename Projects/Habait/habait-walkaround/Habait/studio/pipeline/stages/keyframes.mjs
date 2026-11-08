/* Stage 7 — keyframes: ONE "look" image per shot PER VARIANT (morning / evening), the picture the video model
   repaints the clay with.
   Room shots: a perspective crop of the already-skinned 360° pano at that camera point (same geometry, same
   material board, $0) when the project points at a panos_dir; else the clay first frame stands in.
   Exterior shots: an image-edit call on the clay first frame (fal, paid, gated) with the variant preset's
   prompt — or the clay first frame when spending is off.
   The evening variant re-lights the morning keyframe with the variant's relight prompt (fal image edit, gated);
   without spending it reuses the morning keyframe and lets the video prompt carry the evening.
   Files: renders/keyframes/<variant>/<shot>.png. */
import fs from 'node:fs';
import { pngSize } from './assemble.mjs';
import path from 'node:path';
import { TOOLS, STUDIO, REPO } from '../../lib/env.mjs';

/** cp-bathMain -> bath-main, cp-bedroom2 -> bedroom-2, cp-terraceLiving -> terrace-living */
export function cpSlug(cpId) {
  return String(cpId).replace(/^cp-/, '').replace(/([a-z])([A-Z])/g, '$1-$2').replace(/([a-zA-Z])(\d)/g, '$1-$2').toLowerCase();
}

/** Find the pano file for a camera point in a panos dir: "04-living.webp" matches "living". */
export function findPano(panosDir, cpId) {
  if (!panosDir || !fs.existsSync(panosDir)) return null;
  const slug = cpSlug(cpId);
  const files = fs.readdirSync(panosDir).filter((f) => /\.(webp|png|jpg|jpeg)$/i.test(f));
  const norm = (f) => f.replace(/\.[^.]+$/, '').replace(/^\d+-/, '').toLowerCase();
  let hit = files.find((f) => norm(f) === slug);
  if (!hit) hit = files.find((f) => norm(f).replace(/-/g, '') === slug.replace(/-/g, ''));
  return hit ? path.join(panosDir, hit) : null;
}

export function loadPresets() {
  return JSON.parse(fs.readFileSync(path.join(STUDIO, 'styles', 'presets.json'), 'utf8'));
}
export function presetById(id) {
  const presets = loadPresets().presets;
  return presets.find((p) => p.id === id) || presets.find((p) => p.default_for?.includes('tower')) || presets[0];
}
/** The camera's pitch at a shot's first key, degrees (negative = looking down), so a pano crop matches the clay. */
export function pitchOf(shot) {
  const k = shot?.keys?.[0];
  if (!k) return -2;
  const dz = k.look[2] - k.pos[2], dh = Math.hypot(k.look[0] - k.pos[0], k.look[1] - k.pos[1]);
  return Math.round(((Math.atan2(dz, dh) * 180) / Math.PI) * 100) / 100;
}
export function presetFor(project) { return presetById(project.style); }

/** The image editor for the keyframes. options.keyframes.engine: 'nano' (fal nano-banana-2/edit, $0.08, keeps materials but
    re-imagines furniture and room edges) or 'gpt' (openai/gpt-image-2.5/sunburst/edit, $1.20, 1920x1080: kept the clay's
    layout to the pixel on apt846, walls 0.99 / glazing 1.0 in kf_check, and restyled every piece after the references). */
export function editorFor(project) {
  const gpt = (project.options?.keyframes?.engine || 'nano') === 'gpt';
  return gpt
    ? { id: 'gpt', endpoint: 'openai/gpt-image-2.5/sunburst/edit', usd: 1.2, extra: JSON.stringify({ image_size: { width: 1920, height: 1080 }, quality: 'high' }) }
    : { id: 'nano', endpoint: 'fal-ai/nano-banana-2/edit', usd: 0.08, extra: null };
}

/** The tour fixture's material board (Habait/tour360/apartments/<fixture>/material-board.json): the look the skinned panos were
    made from, so the keyframes say the same words the panos were painted with. Null when the project has no fixture. */
export function boardFor(project) {
  const fx = project.options?.fixture;
  if (!fx) return null;
  const f = path.join(REPO, 'Habait', 'tour360', 'apartments', fx, 'material-board.json');
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; }
}

/** The repaint prompt for a room with photo references of the same apartment: the clay owns the geometry, the references own
    the materials AND the furniture style (each plain clay piece becomes a designer piece of the same size at the same place).
    lockPrompt() keeps the clay's own furniture; this one restyles it, which is what a furnished tour look needs. */
export function lookPrompt(nRefs, roomEn, board, presetFragment, overrides = {}) {
  const refList = Array.from({ length: nRefs }, (_, i) => i + 2).join(', ');
  // options.keyframes.surfaces overrides the board's words per surface (Eliran 2026-11-01: a seamless floor with no grout
  // lines, zero-line doors, no skirting), and `extra` adds a sentence
  const s = { ...(board?.surfaces || {}), ...(overrides.surfaces || {}) };
  const words = ['floor', 'walls', 'ceiling', 'feature', 'doors', 'kitchen', 'glazing'].map((k) => s[k]).filter(Boolean)
    .map((t) => String(t).split(' — ')[0].split(' (the floor')[0]).join('; ');
  return `Image 1 is a plain computer render (a clay render) of the ${roomEn || 'room'} of a new apartment. Re-render it as a ` +
    `photograph taken from exactly the same camera: the same position, angle, lens and crop, every wall, ceiling, floor plane, door, ` +
    `window frame and glass pane at exactly the same pixel position, nothing added, removed or moved. ` +
    (nRefs ? `Images ${refList} are photographs of the SAME apartment, already furnished in its final design: copy their materials, ` +
      `furniture style, colours, light and mood exactly, never their framing. ` : '') +
    (words ? `The materials: ${words}. ` : '') + (overrides.extra ? `${overrides.extra} ` : '') +
    `Every plain furniture piece of image 1 becomes a designer piece of the same size at the same place, in the style of the ` +
    `reference photos, keeping the floor layout of image 1. ${presetFragment} Photoreal, sharp, natural colours. No people, no text, no logos, no watermark.`;
}

/** The variants a project renders: [{ id, name_he, preset, relight_prompt }], from options.variants (default both). */
export function variantsFor(project) {
  const all = loadPresets().variants || {};
  const wanted = Array.isArray(project.options?.variants) && project.options.variants.length ? project.options.variants : Object.keys(all);
  const styles = project.options?.variant_styles || {};
  return wanted.filter((v) => all[v]).map((v) => ({ id: v, ...all[v], preset: presetById(styles[v] || all[v].preset) }));
}

/** The image-edit prompt that keeps the clay's composition to the pixel and only swaps its grey materials. Describing
    the scene instead ("a terrace, a sliding door") made the editor re-imagine it (kf_check: 8.5° off, invented deck). */
export function lockPrompt(nRefs, presetFragment) {
  return `Keep image 1 exactly as it is framed: the same camera position, angle, lens and crop, every edge at the same ` +
    `pixel position, nothing added, removed, moved, resized or re-arranged (the same furniture pieces in the same places, ` +
    `the same doors, walls, window frames and ceiling lights). Only replace the flat grey materials of image 1 with real ` +
    `ones so it looks like a photograph` +
    (nRefs ? `: take the floor, wall, wood, metal and fabric finishes and the colour of the light from images ${Array.from({ length: nRefs }, (_, i) => i + 2).join(' and ')}, ` +
      `which are photos of the same apartment` : '') +
    `. ${presetFragment} No people, no text, no logos.`;
}

export default {
  id: 'keyframes',
  title_he: 'פריימי-מפתח (הלוק של כל shot)',
  title_en: 'Keyframes: one look image per shot and variant',
  paid: true,
  needs(ctx) {
    if (!ctx.derived('shots.json')) return 'shots.json missing';
    if (!ctx.derived('clay.json')) return 'clay.json missing (render the clay first)';
    return null;
  },
  async run(ctx) {
    const shots = ctx.derived('shots.json');
    const clay = ctx.derived('clay.json');
    const intake = ctx.derived('intake.json') || {};
    const rendered = new Set(clay.shots.map((s) => s.id));
    const [w0, h0] = (clay.res || '640x360').split('x').map(Number);
    let panosDir = ctx.project.options?.panos_dir || null;
    if (panosDir && !path.isAbsolute(panosDir)) panosDir = path.join(REPO, panosDir);
    const variants = variantsFor(ctx.project);
    const lookHints = (intake.style_hints || []).slice(0, 6).join('; ');
    // the seam's anchor view: the camera point in the entry's outdoor room, turned toward the entry centre
    let seamView = null;
    const plan = ctx.derived('plan.json');
    if (shots.entry?.outdoor_room && plan) {
      const cp = (plan.camera_points || []).find((c) => c.room_id === shots.entry.outdoor_room);
      if (cp) {
        const [ex, ey] = shots.entry.centre_cm;
        const bearing = ((Math.atan2(ex - cp.x, -(ey - cp.y)) * 180) / Math.PI + 360) % 360; // plan bearing: 0 = up, clockwise
        const yawRel = ((bearing - (cp.yaw_deg || 0) + 540) % 360) - 180;
        seamView = { cp, yawRel };
        ctx.log(`seam view: ${cp.id} turned ${yawRel.toFixed(1)}° toward ${shots.entry.id}`);
      }
    }
    // a partial run (options.keyframes.shots): only these shots, the other shots' picks are kept
    const only = Array.isArray(ctx.project.options?.keyframes?.shots) && ctx.project.options.keyframes.shots.length ? ctx.project.options.keyframes.shots : null;
    const picks = only ? (ctx.derived('keyframes.json')?.picks || []).filter((p) => !only.includes(p.id)) : [];
    let spent = 0;
    const editor = editorFor(ctx.project);
    const board = boardFor(ctx.project);
    const edit = async (src, out, prompt, note, refs = []) => {
      const est = editor.usd;
      const gate = ctx.spendGate(est);
      if (gate || !ctx.env.hasFal) return gate || 'FAL_KEY missing';
      // the keyframe must be EXACTLY the clay size (the editor picks its own size unless told; the video gate
      // refuses an aspect mismatch above 1 %)
      const size = pngSize(src);
      const fitArgs = size ? [...(editor.extra ? [] : ['--aspect-ratio', size[0] / size[1] > 1.7 ? '16:9' : 'auto']), '--fit', `${size[0]}x${size[1]}`] : [];
      const extraArgs = editor.extra ? ['--extra', editor.extra] : [];
      const r = await ctx.run(ctx.env.PYTHON, ['-I', path.join(TOOLS, 'fal_image.py'), '--endpoint', editor.endpoint, '--image', src, '--out', out, '--prompt', prompt, ...refs.flatMap((r) => ['--reference', r]), ...fitArgs, ...extraArgs, '--allow-spend'], { env: { FAL_KEY: ctx.env.FAL_KEY } });
      if (r.code === 0 && fs.existsSync(out)) { ctx.spend({ stage: 'keyframes', endpoint: editor.endpoint, usd: est, note: `${note} (${editor.id})` }); spent += est; return null; }
      return 'fal edit failed';
    };

    for (const s of shots.shots) {
      if (!rendered.has(s.id)) continue;
      if (only && !only.includes(s.id)) continue;
      const first = ctx.file('renders', 'clay', s.id, 'first.png');
      const [w, h] = pngSize(first) || [w0, h0]; // every shot at its own clay size (they differ: exterior / seam / smoke)
      const fovH = (2 * Math.atan(18 / (s.fov_mm || 24)) * 180) / Math.PI; // 36 mm sensor width
      const crop = async (cpId, yawRel, out, pitch) => {
        const pano = findPano(panosDir, cpId);
        if (!pano) return null;
        const r = await ctx.run(ctx.env.PYTHON, ['-I', path.join(TOOLS, 'pano_crop.py'), pano, out, '--yaw-rel', Number(yawRel).toFixed(1), '--pitch', String(pitch), '--fov-h', fovH.toFixed(1), '--width', String(w), '--height', String(h)]);
        return r.code === 0 && fs.existsSync(out) ? pano : null;
      };
      let morningFile = null;
      for (const v of variants) {
        const outDir = ctx.file('renders', 'keyframes', v.id);
        fs.mkdirSync(outDir, { recursive: true });
        const out = path.join(outDir, `${s.id}.png`);
        let source = 'clay-first-frame', note = '';
        if (v.id !== 'morning' && morningFile && v.relight_prompt) {
          const err = await edit(morningFile, out, v.relight_prompt, `${s.id} ${v.id} relight`);
          if (!err) source = 'relight-of-morning'; else { note = err; fs.copyFileSync(morningFile, out); source = 'morning-reused'; }
        } else if (s.kind === 'seam' && !s.from_camera_point) {
          // the walk starts out on the terrace, square to the slider, not on a pano point: the clay first frame is
          // repainted (fal edit, gated) with the skinned panos of the two rooms it joins as material references —
          // the terrace looking at the slider, and the living room's own first frame (the seam's last frame)
          const refs = [];
          const livingShot = shots.shots.find((x) => x.kind === 'room' && x.room_id === shots.entry?.living_room);
          const wanted = [seamView ? [seamView.cp.id, seamView.yawRel, -3] : null, livingShot ? [livingShot.camera_point, livingShot.yaw_rel_deg || 0, pitchOf(livingShot)] : null].filter(Boolean);
          for (let i = 0; i < wanted.length; i++) {
            const refOut = path.join(outDir, `_ref-${s.id}-${i + 1}.png`);
            if (await crop(wanted[i][0], wanted[i][1], refOut, wanted[i][2])) refs.push(refOut);
          }
          // with the gpt editor the living room's pano is turned left and right as well, so the sofa, dining and TV wall
          // all have a photo to copy (the terrace crop alone shows a slice of the room)
          if (editor.id === 'gpt' && livingShot && findPano(panosDir, livingShot.camera_point)) {
            for (const d of [-70, 70]) {
              const refOut = path.join(outDir, `_ref-${s.id}-yaw${d}.png`);
              if (await crop(livingShot.camera_point, (livingShot.yaw_rel_deg || 0) + d, refOut, pitchOf(livingShot))) refs.push(refOut);
            }
          }
          const prompt = editor.id === 'gpt' ? lookPrompt(refs.length, 'living room seen from its terrace through the open slider', board, v.preset.prompt_fragment, ctx.project.options?.keyframes || {}) : lockPrompt(refs.length, v.preset.prompt_fragment);
          const err = await edit(first, out, prompt, `${s.id} ${v.id} seam repaint`, refs);
          if (!err) source = `fal-image-edit+${refs.length}-pano-refs`;
          else if (seamView && (await crop(seamView.cp.id, seamView.yawRel, out, -3))) { source = 'pano-crop:terrace (approximate: the walk starts off the pano point)'; note = err; }
          else note = err;
        } else if (s.kind === 'room' && s.room_id === shots.entry?.living_room && fs.existsSync(ctx.file('renders', 'video', v.id, 'ext-enter.mp4'))) {
          // the seam ends EXACTLY on this shot's first frame: its photoreal last frame is the keyframe ($0, the look
          // carries over the join, nothing jumps)
          const fit = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1`;
          const r = await ctx.run(ctx.env.FFMPEG, ['-nostdin', '-y', '-loglevel', 'error', '-sseof', '-0.1', '-i', ctx.file('renders', 'video', v.id, 'ext-enter.mp4'), '-frames:v', '1', '-vf', fit, '-update', '1', out]);
          if (r.code === 0 && fs.existsSync(out)) source = 'seam-last-frame (renders/video/' + v.id + '/ext-enter.mp4)'; else note = 'could not read the last frame of the seam';
        } else if (s.kind === 'room' || (s.kind === 'seam' && seamView)) {
          // a room: the skinned pano at its own camera point, forward (yaw-rel 0)
          // the seam: the skinned pano of the OUTDOOR room next to the entry, turned toward the entry (the shot
          // starts on the terrace looking through the slider into the living room)
          const cpId = s.kind === 'room' ? s.camera_point : seamView.cp.id;
          const yawRel = s.kind === 'room' ? (s.yaw_rel_deg || 0) : seamView.yawRel;
          if (findPano(panosDir, cpId)) {
            const pano = await crop(cpId, yawRel, out, s.kind === 'seam' ? -3 : pitchOf(s));
            if (pano) source = `pano-crop:${path.basename(pano)}${s.kind === 'seam' ? ` @${yawRel.toFixed(0)}°` : ''}`; else note = 'pano crop failed; clay used';
            // the skinned pano's furniture is the image model's restyle, not the clay's: as a keyframe it would make
            // the video model morph the furniture. With spending on, the clay first frame is repainted with the pano
            // crop as the material reference (geometry from the clay, look from the pano); the crop stays as the ref.
            if (pano && s.kind === 'room' && ctx.env.ALLOW_SPEND) {
              const ref = path.join(outDir, `_ref-${s.id}.png`);
              fs.copyFileSync(out, ref);
              const refs = [ref];
              if (editor.id === 'gpt') { // the same pano turned left and right: the whole room's furniture as references
                for (const d of [-70, 70]) {
                  const refOut = path.join(outDir, `_ref-${s.id}-yaw${d}.png`);
                  if (await crop(cpId, yawRel + d, refOut, pitchOf(s))) refs.push(refOut);
                }
              }
              const prompt = editor.id === 'gpt' ? lookPrompt(refs.length, s.room_name_en, board, v.preset.prompt_fragment, ctx.project.options?.keyframes || {}) : lockPrompt(1, v.preset.prompt_fragment);
              const err = await edit(first, out, prompt, `${s.id} ${v.id} room repaint`, refs);
              if (!err) source = `fal-image-edit+pano-ref:${path.basename(pano)}`; else note = `${err}; the pano crop stays`;
            }
          } else note = panosDir ? 'no pano for this camera point' : 'no panos_dir set';
        } else {
          const prompt = `${v.preset.prompt_fragment} ${lookHints ? 'Developer look: ' + lookHints + '. ' : ''}Keep every building edge, window and railing exactly where image 1 draws it; repaint surfaces and sky only.`;
          const err = await edit(first, out, prompt, `${s.id} ${v.id} exterior`);
          if (!err) source = 'fal-image-edit'; else note = err;
        }
        if (source === 'clay-first-frame') fs.copyFileSync(first, out);
        if (v.id === 'morning' || !morningFile) morningFile = out;
        picks.push({ id: s.id, variant: v.id, file: `renders/keyframes/${v.id}/${s.id}.png`, source, note });
        ctx.log(`${s.id} [${v.id}]: ${source}${note ? ' (' + note + ')' : ''}`);
      }
    }
    ctx.saveDerived('keyframes.json', { variants: variants.map((v) => ({ id: v.id, preset: v.preset.id })), picks, at: new Date().toISOString() });
    const fromPano = picks.filter((p) => p.source.startsWith('pano')).length;
    const clayOnly = picks.filter((p) => p.source === 'clay-first-frame' || p.source === 'morning-reused').length;
    return { status: clayOnly ? 'needs-review' : 'done', note: `${picks.length} keyframes for ${variants.map((v) => v.name_he).join(' + ')}: ${fromPano} from skinned panos, ${picks.length - fromPano - clayOnly} generated, ${clayOnly} plain/reused`, outputs: picks.map((p) => p.file), cost_usd: spent };
  },
};
