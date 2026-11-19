#!/usr/bin/env node
// card 34 (board habait-workplan-2026-11-02): the real flyover segments -> what flow.html?real=1 plays.
//
//   node tools/build_segments.mjs --project rainbow [--dry-run] [--force] [--size 2048x1024] [--crf 20] [--json]
//
// Reads (never writes) the Cycles equirect frames of Habait/flyover/equirect/_local/segments/<seg>/frames/frame_####.png
// (cards 17/18/22), their camera.json and card 19's hotspots.meta.json, the skinned node-b panorama and the living-room
// panorama of the tour (Habait/tour360, habait-98's, read-only) and the legal caption v1
// (C:\RnD\Projects\Habait\data\sales-plans\legal\caption-v1.json). Writes:
//   Habait/platform/_local/segments/<project>/<seg>.mp4       h264 yuv420p bt709, 24 fps, faststart (2048x1024 default)
//   Habait/platform/_local/segments/<project>/<seg>.first.jpg / .last.jpg   poster + freeze frame of every video
//   Habait/platform/_local/segments/<project>/hold-facade.jpg  the hold still
//   Habait/platform/_local/segments/<project>/segments.json    fps, first/last camera yaw+pos, hotspots per frame, junction
//                                                               checks (decoded mp4 vs the neighbour), hand-off, caption
//   Habait/platform/fixtures/<project>/flow.real.json           a flow.v0 chain over those files (flow.html?real=1 loads it)
//
// Driven by what is on disk, not by code: a segment is real when its frames dir holds the frames its camera.json plans
// (contiguous from frame_0001), otherwise the documented fallback of that segment is used. When the Kaggle render of
// enter-846 lands 96 frames in enter-846/frames/, a plain rerun replaces the dissolve fallback by the real frames; outputs
// whose inputs did not change are skipped (signature in segments.json; --force rebuilds).
//
// Fallbacks (T0, card 34):
//   approach   partial render (48 of 192 frames; frames 49-192 and the orbit are not rendered): the frames that exist,
//              then a 1.5 s dissolve (the last 12 frames + 24 held frames) into the hold still. Both frames look at the
//              tower at their centre (u 0.5), so the dissolve is not rolled: the tower stays put on screen.
//   hold       (T0, 2026-11-03 08:00) real when hold-facade/frames holds its 72 frames: a looping clay video at node-b (frames
//              1 and 72 at the rest pose = descend-846 frame 1 within 0.015 m; 0.67 m out at frame 36), same look as the orbit
//              and the descent, so no blend on either side; pills follow card 19's per-frame hotspots. Fallback (frames
//              missing): the skinned node-b panorama of the tour (cards 15/19) as a still, with skin<->clay blends.
//   orbit      real when its frames are complete (optional: skipped otherwise; the approach then dissolves into the hold).
//   descend    real. Blends from the hold only when the looks differ (the skin fallback), rolled to the camera yaw.
// Blends: a junction gets a blend only across a gap (missing frames: dissolve) or a look change (clay / skin / projected
// interior); same-look junctions are cut frame-to-frame (a blend there would drag a held frame over a camera in motion).
//   enter      real when enter-846/frames holds frames 1..96 (habait-98's 1024x512 16 spp draft since 2026-11-03 06:11).
//              First 0.75 s (18 frames) blend from descend-846's last frame (same pose, camera at 0.3 m/s: clay -> projected
//              interior), rolled to the camera yaw; last 0.5 s (12 frames) lock onto the full-resolution living panorama
//              (rolled to the camera yaw; frame 96 is that view already, MAE 0.37/255 at 512x256), so the hand-off is crisp on
//              both sides. T0 (2026-11-03): the enter-scene tail of descend-846 (batch/_local/tail-local, frames 97-120) is
//              NOT used: its facade projection is warped while the camera still moves at ~13 m/s (frames 97-110), and a
//              clay -> projected look change there is a dissolve in motion; the look change at the balcony, with the camera
//              almost stopped, is a registered dissolve instead.
//   enter      (fallback) fewer than 96 frames: synthetic 96 frames on the camera timeline of
//              enter-846/camera.json: the yaw curve (288.7 -> 111.3, +182.6 deg) is applied exactly as an equirect rotation
//              (a pure rotation at a fixed point is lossless for an equirect), the 5.4 m through the slider is a crossfade
//              from descend-846's last frame (outside the balcony) to the living panorama, weighted by path progress.
//              The last frame is the living panorama itself (shift 0), as in the real render (card 20: lock frames 67-96).
// Resolution (T0, 2026-11-03): every segment is scaled to one --size (default 2048x1024, lanczos3) whatever its native size
// (approach/descend 2048x1024, the enter draft 1024x512): the junction blends are computed at full size, so the first frame of a
// segment is the previous segment's last frame at full resolution and any softening happens inside the blend, not at the cut;
// the enter lock ends on the 2048 panorama the tour shows; the viewer keeps one texture size. segments.json records native_size.
//
// Equirect convention (Habait/flyover/equirect/README-he.md): u 0.5 = camera look_dir (yaw_deg_from_plus_y_cw),
// u grows clockwise seen from above. The viewer's yaw is relative to the frame centre, so the world bearing the buyer
// faces = camera yaw + viewer yaw, and consecutive segments that share a pose need no yaw re-base.
// The tour's yaw (Pannellum, ?yaw=) is relative to its panorama centre, which looks at centreBearingDeg (tour.js line ~198):
// tour yaw = viewer yaw + (camera yaw of enter's last frame - centreBearingDeg of the room) = viewer yaw + 0.
import { readFileSync, existsSync, readdirSync, statSync, mkdirSync, renameSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CODE_VERSION = 'build_segments/1.2 (card 34, 2026-11-03: 5 segments, hold loop)';
const HERE = dirname(fileURLToPath(import.meta.url));
export const PLATFORM = resolve(HERE, '..');
export const HABAIT = resolve(PLATFORM, '..');          // .../habait-walkaround/Habait
const ROOT = resolve(HABAIT, '..', '..');               // C:\RnD\Projects\Habait
const SEG_ROOT = join(HABAIT, 'flyover/equirect/_local/segments');
const CAM_ROOT2 = join(HABAIT, 'flyover/hotspots/_local/cameras'); // card 19's restored cameras (the hold's pose)
const CAPTION = join(ROOT, 'data/sales-plans/legal/caption-v1.json');
const FPS = 24;
const BLEND_FRAMES = 12;        // 0.5 s look blend at a junction that shares a pose
const LOCK_FRAMES = 12;         // 0.5 s lock of a real enter onto the hand-off panorama at full resolution
const BRIDGE_HOLD = 24;         // held frames of a dissolve over a gap (missing render)
const GAP_M = 2;                // a junction farther apart than this is a gap, not a look change
const MIN_VISIBLE = 0.25;       // card 19 follow-up: hide units with visible_frac < 0.25 (837/847/857 behind 846)

const t2 = (s) => ({ he: s[0], en: s[1] });
export const SPECS = {
  rainbow: {
    fixture: 'fixtures/rainbow',
    tourApartment: 'apt846',
    unitIds: { apt846: '846' },               // card 19 ids -> platform unit ids (the rest are identical)
    chain: [
      { id: 'approach', kind: 'video', role: 'approach', look: 'clay', dir: 'approach', minFrames: 24,
        title: t2(['מעל שדה דב, אל המגדל', 'Over Sde Dov, towards the tower']) },
      { id: 'orbit', kind: 'video', role: 'orbit', look: 'clay', dir: 'orbit', optional: true, complete: true,
        title: t2(['סביב המגדל', 'Around the tower']) },
      { id: 'hold-facade', kind: 'video', role: 'hold', look: 'clay', dir: 'hold-facade', loop: true, complete: true, stillFallback: 'node-b-tower',
        title: t2(['מול החזית · בחרו דירה', 'At the facade · choose an apartment']) },
      { id: 'descend-846', kind: 'video', role: 'descend', look: 'clay', unit: '846', dir: 'descend-846', complete: true,
        title: t2(['יורדים אל המרפסת של 846', 'Descending to the terrace of 846']) },
      { id: 'enter-846', kind: 'video', role: 'enter', look: 'projected', unit: '846', dir: 'enter-846', complete: true,
        fallback: 'enter-dissolve', handoff: { room: 'living' }, headBlend: 18,
        title: t2(['נכנסים לסלון', 'Into the living room']) },
    ],
  },
};

// ---------------- small helpers ----------------
const readJSON = (p) => JSON.parse(readFileSync(p, 'utf8'));
const wrap180 = (d) => { const r = ((((d + 180) % 360) + 360) % 360) - 180; return r === -180 ? 180 : r; };
const r2 = (x) => Math.round(x * 100) / 100;
const r3 = (x) => Math.round(x * 1000) / 1000;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const smooth = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
const posix = (p) => p.split(sep).join('/');
const rel = (p) => posix(relative(ROOT, p));

function parseArgs(argv) {
  const a = { project: null, dryRun: false, force: false, size: [2048, 1024], crf: 20, json: false, ffmpeg: process.env.FFMPEG || null, segRoot: SEG_ROOT, caption: CAPTION, out: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = () => { if (i + 1 >= argv.length) throw new Error(`${k} needs a value`); return argv[++i]; };
    if (k === '--project') a.project = v();
    else if (k === '--dry-run') a.dryRun = true;
    else if (k === '--force') a.force = true;
    else if (k === '--json') a.json = true;
    else if (k === '--size') { const m = /^(\d+)x(\d+)$/.exec(v()); if (!m || Number(m[1]) !== 2 * Number(m[2])) throw new Error('--size must be WxH with W = 2H'); a.size = [Number(m[1]), Number(m[2])]; }
    else if (k === '--crf') a.crf = Number(v());
    else if (k === '--ffmpeg') a.ffmpeg = v();
    else if (k === '--segments-root') a.segRoot = resolve(v());
    else if (k === '--caption') a.caption = resolve(v());
    else if (k === '--out') a.out = resolve(v());
    else if (k === '-h' || k === '--help') { a.help = true; }
    // card 36: the cinematic part
    else if (k === '--manifest') a.manifest = v();
    else if (k === '--cine-only') a.cineOnly = true;
    else if (k === '--no-cine') a.noCine = true;
    else if (k === '--make-dev-manifest') a.makeDev = true;
    else if (k === '--hold') { a.hold = v(); if (!['arc', 'ring'].includes(a.hold)) throw new Error('--hold arc|ring'); }
    else throw new Error(`unknown argument ${k}`);
  }
  return a;
}

export function findFfmpeg(explicit) {
  const cands = [explicit, 'ffmpeg'];
  const wg = join(process.env.LOCALAPPDATA || 'C:/Users/elira/AppData/Local', 'Microsoft/WinGet/Packages');
  if (existsSync(wg)) {
    for (const d of readdirSync(wg).filter((x) => /^Gyan\.FFmpeg/i.test(x))) {
      const base = join(wg, d);
      for (const sub of readdirSync(base)) { const p = join(base, sub, 'bin', 'ffmpeg.exe'); if (existsSync(p)) cands.push(p); }
    }
  }
  for (const c of cands.filter(Boolean)) {
    const r = spawnSync(c, ['-hide_banner', '-version'], { encoding: 'utf8' });
    if (r.status === 0) return { path: c, version: (/ffmpeg version (\S+)/.exec(r.stdout) || [])[1] || '?' };
  }
  return null;
}

function loadSharp() {
  const tries = [process.env.HABAIT_APP_DIR && join(process.env.HABAIT_APP_DIR, 'noop.js'), join(PLATFORM, 'noop.js'), 'C:/RnD/Projects/Habait/tools/appdeps/noop.js'].filter(Boolean);
  for (const t of tries) { try { return createRequire(t)('sharp'); } catch { /* next */ } }
  throw new Error('sharp not found: export HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps');
}

// ---------------- the plan: what is on disk, segment by segment ----------------
function scanFrames(dir) {
  const fd = join(dir, 'frames');
  if (!existsSync(fd)) return { dir: fd, numbers: [], prefix: 0 };
  const numbers = readdirSync(fd).map((f) => /^frame_(\d{4})\.png$/.exec(f)).filter(Boolean).map((m) => Number(m[1])).sort((a, b) => a - b);
  const set = new Set(numbers);
  let prefix = 0;
  while (set.has(prefix + 1)) prefix++;
  return { dir: fd, numbers, prefix };
}
const frameFile = (fd, n) => join(fd, `frame_${String(n).padStart(4, '0')}.png`);

function pngSize(file) {
  try { const b = readFileSync(file); if (b.toString('ascii', 12, 16) === 'IHDR') return [b.readUInt32BE(16), b.readUInt32BE(20)]; } catch { /* unreadable */ }
  return null;
}

function loadCamera(segRoot, dir) {
  for (const p of [join(segRoot, dir, 'camera.json'), join(CAM_ROOT2, dir, 'camera.json')]) if (existsSync(p)) return { file: p, cam: readJSON(p) };
  return null;
}
const camFrame = (cam, n) => cam?.frames?.find((f) => f.frame === n) || null;

function fillCaption(text, vars) {
  return String(text).replace(/\{([A-Z_]+)\}/g, (m, k) => (vars[k] ? String(vars[k]) : m));
}

function planDateOf(tourDir) {
  // the same source as tools/build_zip.mjs: plan.general.json plan_meta.plan_date, else the date printed in source_file / projectNote
  const pg = join(tourDir, 'plan.general.json'), aj = join(tourDir, 'apartment.json');
  const pm = existsSync(pg) ? (readJSON(pg).plan_meta || {}) : {};
  const apt = existsSync(aj) ? readJSON(aj) : {};
  return pm.plan_date || (/(\d{1,2}\.\d{1,2}\.\d{4})/.exec(`${pm.source_file || ''} ${apt.projectNote || ''}`) || [])[1] || null;
}

export function makePlan(args) {
  const spec = SPECS[args.project];
  if (!spec) throw new Error(`unknown project "${args.project}" (known: ${Object.keys(SPECS).join(', ')})`);
  const fixtureDir = join(PLATFORM, spec.fixture);
  const outDir = args.out || join(PLATFORM, '_local/segments', args.project);
  const project = readJSON(join(fixtureDir, 'project.json'));
  const tourDir = join(HABAIT, 'tour360/apartments', spec.tourApartment);
  const scenesDoc = readJSON(join(tourDir, 'scenes.json'));
  const scenes = scenesDoc.scenes || scenesDoc;
  const sceneById = new Map(scenes.map((s) => [s.id, s]));
  const panoFile = (asset) => join(tourDir, 'panos/balanced', `${asset}.webp`);
  const [W, H] = args.size;
  const unitId = (id) => spec.unitIds[id] || id;
  const notes = [];

  // caption v1 (card 30): short_project / micro / short, {PROJECT} {PLAN_DATE} filled, {UNIT} left for the player
  const cap = readJSON(args.caption);
  const planDate = planDateOf(tourDir);
  if (!planDate) throw new Error(`no plan date for ${spec.tourApartment} (plan.general.json / apartment.json)`);
  const caption = { id: cap.id, status: cap.status, source: rel(args.caption), plan_date: planDate };
  for (const l of ['he', 'en']) {
    const vars = { PROJECT: project.name?.[l] || project.name?.he, PLAN_DATE: planDate };
    caption[l] = { short_project: fillCaption(cap[l].short_project, vars), micro: fillCaption(cap[l].micro, vars), short: fillCaption(cap[l].short, vars) };
  }
  if (project.disclaimer && (project.disclaimer.he !== caption.he.short_project || project.disclaimer.en !== caption.en.short_project)) {
    notes.push('project.json disclaimer differs from caption-v1 short_project (filled): the unit card shows project.json, the flight shows caption-v1');
  }

  const segs = [];
  for (const s of spec.chain) {
    const dir = join(args.segRoot, s.dir);
    const camera = loadCamera(args.segRoot, s.dir);
    const fr = scanFrames(dir);
    const planned = camera?.cam?.frames?.length || 0;
    const item = { spec: s, dir, camera, frames: fr, planned, kind: s.kind, look: s.look || 'clay' };
    const complete = planned > 0 && fr.prefix >= planned;
    if (s.role === 'hold') {
      item.cam1 = camFrame(camera?.cam, 1);
      const meta = join(dir, 'hotspots.meta.json');
      if (existsSync(meta)) {
        const m = readJSON(meta);
        const f0 = m.frames?.[0]?.units || {};
        item.hotspots = {};
        for (const [k, v] of Object.entries(f0)) {
          if (v.visible_frac === undefined && v.yaw === undefined) continue;
          item.hotspots[unitId(k)] = { yaw: r2(v.yaw), pitch: r2(v.pitch), visible_frac: r3(v.visible_frac ?? 0), in_view_hint: !!v.in_view_hint };
        }
        item.hotspotsFile = meta;
      }
    }
    if (s.stillFallback && !complete) {
      item.kind = 'still'; item.look = 'skin';
      const asset = s.stillFallback;
      const file = panoFile(asset);
      if (!existsSync(file)) throw new Error(`hold panorama missing: ${file}`);
      item.source = { type: 'pano', file, frames_found: fr.prefix, frames_planned: planned,
        why: 'hold-facade has ' + fr.prefix + '/' + planned + ' rendered frames: the skinned node-b panorama of the tour (cards 15/19) is the hold (fallback)' };
      segs.push(item);
      continue;
    }
    // video
    if (s.optional && !complete) { item.skip = `${fr.prefix}/${planned || '?'} frames rendered (optional; skipped)`; segs.push(item); continue; }
    if (complete || (!s.complete && fr.prefix >= (s.minFrames || 1))) {
      item.source = { type: 'frames', dir: fr.dir, frames_used: complete ? planned : fr.prefix, frames_planned: planned, partial: !complete, native_size: pngSize(frameFile(fr.dir, 1)) };
    } else if (s.fallback === 'enter-dissolve') {
      item.look = 'synthetic';
      item.source = { type: 'fallback-dissolve', frames_found: fr.numbers.length, frames_planned: planned,
        found: fr.numbers.slice(0, 8), why: `${fr.numbers.length}/${planned} frames on disk (Kaggle render pending): synthetic enter on the camera timeline` };
    } else {
      throw new Error(`segment ${s.id}: ${fr.prefix}/${planned} frames and no fallback`);
    }
    segs.push(item);
  }

  const active = segs.filter((x) => !x.skip);
  // junctions + blends
  for (let i = 0; i < active.length; i++) {
    const a = active[i], b = active[i + 1];
    if (!b) break;
    const aLast = a.kind === 'still' ? a.cam1 : camFrame(a.camera?.cam, a.source.type === 'frames' ? a.source.frames_used : a.planned);
    const bFirst = b.kind === 'still' ? b.cam1 : camFrame(b.camera?.cam, 1);
    const j = { from: a.spec.id, to: b.spec.id };
    if (aLast && bFirst) { j.dpos_m = r3(dist(aLast.pos, bFirst.pos)); j.dyaw_deg = r3(Math.abs(wrap180(aLast.yaw_deg_from_plus_y_cw - bFirst.yaw_deg_from_plus_y_cw))); }
    j.gap = j.dpos_m === undefined || j.dpos_m > GAP_M;
    j.looks = a.look + '->' + b.look;
    const lookChange = a.look !== b.look;
    if (a.kind === 'video' && b.kind === 'still') {
      if (j.gap || lookChange) a.tail = j.gap ? { into: b.spec.id, overlap: BLEND_FRAMES, hold: BRIDGE_HOLD, roll: false, why: `gap ${j.dpos_m ?? '?'} m between ${a.spec.id} frame ${a.source.frames_used ?? '?'} and ${b.spec.id} (frames not rendered): dissolve aligned on the frame centre (both look at the tower)` }
        : { into: b.spec.id, overlap: BLEND_FRAMES, hold: 0, roll: true, why: 'same pose, look blend ' + j.looks };
    } else if (b.source.type === 'frames') {
      if (j.gap || lookChange) b.head = { from: a.spec.id, frames: b.spec.headBlend || BLEND_FRAMES, roll: true, why: j.gap ? `gap ${j.dpos_m} m: dissolve` : 'same pose: look blend ' + j.looks };
    } else if (b.source.type === 'fallback-dissolve') {
      b.head = { from: a.spec.id, frames: 0, roll: true, why: 'the fallback starts on this frame' };
    }
    a.junctionOut = j;
  }

  // the hand-off of the enter segment(s)
  for (const x of active) {
    if (!x.spec.handoff) continue;
    const room = x.spec.handoff.room;
    const sc = sceneById.get(room);
    if (!sc || !Number.isFinite(sc.centreBearingDeg)) throw new Error(`tour scene ${room} has no centreBearingDeg`);
    const last = camFrame(x.camera?.cam, x.planned);
    const lastYaw = last?.yaw_deg_from_plus_y_cw;
    x.handoff = { room, pano: `${sc.asset}.webp`, pano_file: panoFile(sc.asset), bearing_deg: sc.centreBearingDeg,
      last_camera_yaw: r3(lastYaw), tour_yaw_offset_deg: r3(wrap180(lastYaw - sc.centreBearingDeg)),
      tour_params: { scope: 'apartment', ui: 'min', floor: 'parquet', video: '0' },
      tour_yaw_param: "habait-98's tour.js reads ?yaw= in its panorama frame (yaw 0 looks at centreBearingDeg); confirmed by habait-98 2026-11-02" };
    if (x.source.type === 'frames') x.lock = { into: x.handoff.pano, frames: LOCK_FRAMES, why: 'real enter: the last frames lock onto the full-resolution panorama the tour opens on (same pose, rolled to the camera yaw)' };
  }
  const iv = (() => { const s = active[0]; const f = camFrame(s.camera?.cam, 1); const vh = f?.view_hint; return vh ? { yaw: r2((vh.u - 0.5) * 360), pitch: r2((0.5 - vh.v) * 180), from: `${s.spec.id} frame 1 view_hint` } : { yaw: 0, pitch: 0, from: 'default' }; })();
  return { spec, args, fixtureDir, outDir, project, tourDir, caption, segs, active, W, H, notes, initialView: iv, unitId };
}

// ---------------- pixels ----------------
class Px {
  constructor(sharp, W, H) { this.sharp = sharp; this.W = W; this.H = H; this.cache = new Map(); }
  async read(file) {
    if (this.cache.has(file)) return this.cache.get(file);
    const { data, info } = await this.sharp(file).removeAlpha().toColourspace('srgb').resize(this.W, this.H, { fit: 'fill', kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
    if (info.channels !== 3) throw new Error(`${file}: ${info.channels} channels`);
    if (this.cache.size > 6) this.cache.delete(this.cache.keys().next().value);
    this.cache.set(file, data);
    return data;
  }
  // the equirect `img` (centre at bearing `from`) seen from the same point with its centre at bearing `to`
  roll(img, from, to) {
    const W = this.W, H = this.H;
    let s = (wrap180(to - from) / 360) * W;
    if (Math.abs(s) < 1e-3) return img;
    s = ((s % W) + W) % W;
    const i0 = Math.floor(s), f = s - i0, out = Buffer.allocUnsafe(img.length);
    const row = W * 3;
    for (let y = 0; y < H; y++) {
      const o = y * row;
      for (let x = 0; x < W; x++) {
        const xa = (x + i0) % W, xb = (xa + 1) % W, d = o + x * 3, pa = o + xa * 3, pb = o + xb * 3;
        out[d] = img[pa] + (img[pb] - img[pa]) * f + 0.5;
        out[d + 1] = img[pa + 1] + (img[pb + 1] - img[pa + 1]) * f + 0.5;
        out[d + 2] = img[pa + 2] + (img[pb + 2] - img[pa + 2]) * f + 0.5;
      }
    }
    return out;
  }
  blend(a, b, w) {
    if (w <= 0) return a;
    if (w >= 1) return b;
    const out = Buffer.allocUnsafe(a.length);
    for (let i = 0; i < a.length; i++) out[i] = a[i] + (b[i] - a[i]) * w + 0.5;
    return out;
  }
  async jpg(buf, file, q = 86) { await this.sharp(buf, { raw: { width: this.W, height: this.H, channels: 3 } }).jpeg({ quality: q, mozjpeg: true }).toFile(file); }
}

function mae(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; }

// ---------------- the frame list of one video segment (lazy buffers) ----------------
function frameJobs(P, x, px, imgOf) {
  const jobs = [];
  const cam = x.camera?.cam;
  const yawAt = (n) => camFrame(cam, n)?.yaw_deg_from_plus_y_cw;
  if (x.source.type === 'frames') {
    const fd = x.source.dir, N = x.source.frames_used;
    for (let n = 1; n <= N; n++) jobs.push({ src: n, yaw: yawAt(n), get: () => px.read(frameFile(fd, n)) });
    if (x.head && x.head.frames) {
      const fromImg = imgOf(x.head.from, 'last');
      for (let k = 0; k < Math.min(x.head.frames, jobs.length); k++) {
        const j = jobs[k], w = smooth(k / (x.head.frames - 1));
        const base = j.get;
        j.blend = `head ${r2(w)}`;
        j.get = async () => { const f = await fromImg(); return px.blend(px.roll(f.img, f.yaw, j.yaw), await base(), w); };
      }
    }
    if (x.handoff && x.lock) {
      const K = Math.min(x.lock.frames, jobs.length), pano = x.handoff.pano_file, bearing = x.handoff.bearing_deg;
      for (let k = 0; k < K; k++) {
        const j = jobs[jobs.length - K + k], w = smooth((k + 1) / K);
        const base = j.get;
        j.blend = `lock ${r2(w)}`;
        j.get = async () => px.blend(await base(), px.roll(await px.read(pano), bearing, j.yaw), w);
      }
    }
    if (x.tail) {
      const into = imgOf(x.tail.into, 'first');
      const total = x.tail.overlap + x.tail.hold;
      const start = jobs.length - x.tail.overlap;
      const lastGet = jobs[jobs.length - 1].get, lastYaw = jobs[jobs.length - 1].yaw;
      for (let h = 0; h < x.tail.hold; h++) jobs.push({ src: null, held: N, yaw: lastYaw, get: lastGet });
      for (let k = 0; k < total; k++) {
        const j = jobs[start + k], w = smooth((k + 1) / total);
        const base = j.get;
        j.blend = `tail ${r2(w)}`;
        j.get = async () => { const t = await into(); const b = x.tail.roll ? px.roll(t.img, t.yaw, j.yaw) : t.img; return px.blend(await base(), b, w); };
      }
    }
    return jobs;
  }
  // enter fallback: the camera timeline of enter-846/camera.json
  const frames = cam.frames;
  const from = imgOf(x.head.from, 'last');
  const pano = x.handoff.pano_file, bearing = x.handoff.bearing_deg;
  let total = 0;
  const cum = [0];
  for (let i = 1; i < frames.length; i++) { total += dist(frames[i].pos, frames[i - 1].pos); cum.push(total); }
  let unwrapped = frames[0].yaw_deg_from_plus_y_cw;
  const yaws = frames.map((f, i) => { if (i) unwrapped += wrap180(f.yaw_deg_from_plus_y_cw - frames[i - 1].yaw_deg_from_plus_y_cw); return unwrapped; });
  for (let i = 0; i < frames.length; i++) {
    const s = total ? cum[i] / total : 1;
    const w = smooth((s - 0.02) / 0.43); // the dissolve happens while the camera crosses the sill (o-5, frame 33/34 = s 0.28)
    const yaw = yaws[i];
    jobs.push({ src: null, synthetic: true, yaw, w: r3(w), get: async () => {
      const a = await from();
      const b = await px.read(pano);
      return px.blend(px.roll(a.img, a.yaw, yaw), px.roll(b, bearing, yaw), w);
    } });
  }
  return jobs;
}

// ---------------- ffmpeg ----------------
function encoder(ff, out, W, H, crf) {
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-framerate', String(FPS), '-i', '-',
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf),
    '-profile:v', 'high', '-level:v', '4.2', '-g', String(FPS), '-bf', '2', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
    '-movflags', '+faststart', '-an', out];
  const p = spawn(ff, args, { stdio: ['pipe', 'ignore', 'pipe'] });
  let err = '', pipeErr = null;
  p.stderr.on('data', (d) => { err += d; });
  p.stdin.on('error', (e) => { pipeErr = e; });
  const done = new Promise((ok, fail) => p.on('close', (c) => (c === 0 ? ok() : fail(new Error(`ffmpeg exit ${c}: ${err.trim()}`)))));
  return {
    args,
    write: (buf) => new Promise((ok, fail) => { if (pipeErr) return fail(pipeErr); if (!p.stdin.write(buf)) p.stdin.once('drain', ok); else ok(); }),
    end: async () => { p.stdin.end(); await done; },
  };
}

function decodeEnd(ff, file, which, w = 512, h = 256) {
  const vf = `scale=${w}:${h}:flags=area:in_color_matrix=bt709:in_range=tv,format=rgb24`;
  const args = which === 'first' ? ['-hide_banner', '-loglevel', 'error', '-i', file, '-frames:v', '1', '-vf', vf, '-f', 'rawvideo', '-']
    : ['-hide_banner', '-loglevel', 'error', '-sseof', '-0.4', '-i', file, '-vf', vf, '-f', 'rawvideo', '-'];
  const r = spawnSync(ff, args, { maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`decode ${file}: ${r.stderr}`);
  const n = w * h * 3;
  const buf = r.stdout;
  return buf.subarray(buf.length - n);
}

function bestShift(a, b, w = 512, h = 256, maxDeg = 20) {
  // a, b RGB w*h; circular shift of b (deg) that best matches a on the middle band
  let best = { deg: 0, mae: Infinity };
  const step = 360 / w, rows = [Math.floor(h * 0.3), Math.floor(h * 0.7)];
  for (let sp = -Math.round(maxDeg / step); sp <= Math.round(maxDeg / step); sp++) {
    let s = 0, c = 0;
    for (let y = rows[0]; y < rows[1]; y += 2) for (let x = 0; x < w; x += 2) {
      const xb = (((x + sp) % w) + w) % w, ia = (y * w + x) * 3, ib = (y * w + xb) * 3;
      s += Math.abs(a[ia] - b[ib]) + Math.abs(a[ia + 1] - b[ib + 1]) + Math.abs(a[ia + 2] - b[ib + 2]); c += 3;
    }
    if (s / c < best.mae) best = { deg: r2(sp * step), mae: r2(s / c) };
  }
  return best;
}

function signature(P, x, jobsDesc) {
  const h = createHash('sha1');
  h.update(JSON.stringify({ CODE_VERSION, size: [P.W, P.H], crf: P.args.crf, fps: FPS, src: x.source, head: x.head || null, tail: x.tail || null, n: jobsDesc }));
  const files = [];
  if (x.source.type === 'frames') for (let n = 1; n <= x.source.frames_used; n++) files.push(frameFile(x.source.dir, n));
  if (x.source.file) files.push(x.source.file);
  if (x.handoff) files.push(x.handoff.pano_file);
  if (x.camera) files.push(x.camera.file);
  for (const f of files) { const st = statSync(f); h.update(`${f}|${st.size}|${Math.round(st.mtimeMs)}`); }
  return h.digest('hex').slice(0, 16);
}

// ---------------- flow.real.json ----------------
export function flowReal(P) {
  const relOut = (f) => posix(relative(P.fixtureDir, join(P.outDir, f)));
  const segs = P.active.map((x, i) => {
    const s = x.spec, next = P.active[i + 1];
    const seg = { id: s.id, kind: x.kind, role: s.role };
    if (s.unit) seg.unit = s.unit;
    seg.src = relOut(x.kind === 'still' ? `${s.id}.jpg` : `${s.id}.mp4`);
    if (x.kind === 'video') seg.poster = relOut(`${s.id}.first.jpg`);
    seg.duration_s = x.kind === 'still' ? 3 : r3(x.outFrames / FPS);
    if (s.loop) seg.loop = true;
    seg.title = s.title;
    seg.next = s.role === 'hold' ? null : s.role === 'enter' ? 'handoff' : (next && next.spec.role !== 'descend' ? next.spec.id : null);
    return seg;
  });
  const descend = P.active.find((x) => x.spec.role === 'descend'), enter = P.active.find((x) => x.spec.role === 'enter');
  return { $schema: '../../contracts/flow.schema.json', project: P.args.project, start: P.active[0].spec.id,
    defaults: { ...(descend ? { descend: descend.spec.id } : {}), ...(enter ? { enter: enter.spec.id } : {}) }, segments: segs };
}

function outFramesOf(x) {
  if (x.kind === 'still') return 1;
  if (x.source.type === 'frames') return x.source.frames_used + (x.tail ? x.tail.hold : 0);
  return x.planned;
}

// ---------------- describe ----------------
function describe(P, ff) {
  const lines = [`build_segments ${P.args.project}${P.args.dryRun ? ' (dry-run)' : ''} -> ${P.outDir}`,
    `ffmpeg: ${ff ? `${ff.path} (${ff.version})` : 'NOT FOUND (needed to encode; --dry-run only plans)'}   size ${P.W}x${P.H}, ${FPS} fps, h264 crf ${P.args.crf}`];
  for (const x of P.segs) {
    const s = x.spec;
    if (x.skip) { lines.push(`  ${s.id.padEnd(12)} skip   ${x.skip}`); continue; }
    x.outFrames = outFramesOf(x);
    let l = `  ${s.id.padEnd(12)} ${x.kind.padEnd(6)} `;
    if (x.kind === 'still') {
      const shown = Object.values(x.hotspots || {}).filter((h) => h.visible_frac >= MIN_VISIBLE).length;
      l += `source pano ${rel(x.source.file)} (hold-facade frames ${x.source.frames_found}/${x.source.frames_planned}) -> ${s.id}.jpg; hotspots ${Object.keys(x.hotspots || {}).length} units from card 19 frame 1, ${shown} with visible >= ${MIN_VISIBLE}`;
    } else if (x.source.type === 'frames') {
      const ns = x.source.native_size;
      l += `source frames ${x.source.frames_used}/${x.source.frames_planned}${x.source.partial ? ' (PARTIAL)' : ''}${ns ? ` ${ns[0]}x${ns[1]}${ns[0] !== P.W ? ` (scaled to ${P.W}x${P.H})` : ''}` : ''} ${rel(x.source.dir)} -> ${s.id}.mp4 ${x.outFrames} fr ${(x.outFrames / FPS).toFixed(2)} s`;
      if (x.head?.frames) l += `; head blend ${x.head.frames} fr from ${x.head.from}`;
      if (x.lock) l += `; lock ${x.lock.frames} fr onto ${x.lock.into}`;
      if (s.loop) l += '; LOOP (hold), pills from card 19 per frame, ' + Object.values(x.hotspots || {}).filter((h) => h.visible_frac >= MIN_VISIBLE).length + ' units with visible >= ' + MIN_VISIBLE + ' at frame 1';
      if (x.tail) l += `; tail ${x.tail.hold ? 'dissolve' : 'blend'} ${x.tail.overlap + x.tail.hold} fr into ${x.tail.into}${x.tail.hold ? ` (FALLBACK: ${x.tail.why})` : ''}`;
    } else {
      l += `source FALLBACK dissolve (${x.source.why}; found ${x.source.frames_found}: ${x.source.found.join(',')}) ${rel(P.segs.find((y) => y.spec.id === x.head.from).dir)} last frame -> ${x.handoff.pano} on the yaw curve of ${rel(x.camera.file)} -> ${s.id}.mp4 ${x.outFrames} fr ${(x.outFrames / FPS).toFixed(2)} s`;
    }
    if (x.handoff) l += `; handoff room=${x.handoff.room} bearing ${x.handoff.bearing_deg} (camera ${x.handoff.last_camera_yaw}) tour yaw offset ${x.handoff.tour_yaw_offset_deg}`;
    if (x.junctionOut && x.junctionOut.dpos_m !== undefined) { const J = x.junctionOut; const [la, lb] = J.looks.split('->'); l += `; -> ${J.to} dpos ${J.dpos_m} m dyaw ${J.dyaw_deg} deg (${J.looks}, ${J.gap ? 'gap: dissolve' : la === lb ? 'cut' : 'blend'})`; }
    lines.push(l);
  }
  const ids = P.active.map((x) => x.spec.id);
  lines.push(`${ids.length} segments (${ids.join(', ')}); caption v1 ${P.caption.id} (${P.caption.status}), plan date ${P.caption.plan_date}; initial view yaw ${P.initialView.yaw} pitch ${P.initialView.pitch} (${P.initialView.from})`);
  for (const n of P.notes) lines.push(`note: ${n}`);
  return lines;
}

// ---------------- build ----------------
async function build(P, ff) {
  const sharp = loadSharp();
  const px = new Px(sharp, P.W, P.H);
  mkdirSync(P.outDir, { recursive: true });
  const prevFile = join(P.outDir, 'segments.json');
  const prev = existsSync(prevFile) ? readJSON(prevFile) : null;
  const prevById = new Map((prev?.segments || []).map((s) => [s.id, s]));
  const report = [];
  const firstLast = new Map(); // id -> { first: {img, yaw}, last: {img, yaw} } of the OUTPUT frames (full size)
  const byId = new Map(P.active.map((x) => [x.spec.id, x]));
  const imgOf = (id, which) => async () => {
    if (!firstLast.has(id)) {
      const x = byId.get(id);
      if (x.kind === 'still') { const img = await px.read(x.source.file); firstLast.set(id, { first: { img, yaw: x.cam1?.yaw_deg_from_plus_y_cw }, last: { img, yaw: x.cam1?.yaw_deg_from_plus_y_cw } }); }
      else throw new Error(`${id} not built before it is needed`);
    }
    return firstLast.get(id)[which];
  };
  const segOut = [];
  for (const x of P.active) {
    const s = x.spec;
    const o = { id: s.id, kind: x.kind, role: s.role, look: x.look, ...(s.unit ? { unit: s.unit } : {}), title: s.title, source: { ...x.source } };
    for (const k of ['dir', 'file']) if (o.source[k]) o.source[k] = rel(o.source[k]);
    if (x.camera) o.camera_file = rel(x.camera.file);
    // a segment that changed kind (the hold: still <-> loop) leaves no stale output behind
    for (const stale of x.kind === 'still' ? [`${s.id}.mp4`, `${s.id}.first.jpg`, `${s.id}.last.jpg`] : [`${s.id}.jpg`]) rmSync(join(P.outDir, stale), { force: true });
    if (x.kind === 'still') {
      const file = join(P.outDir, `${s.id}.jpg`);
      const img = await px.read(x.source.file);
      await px.jpg(img, file, 90);
      firstLast.set(s.id, { first: { img, yaw: x.cam1?.yaw_deg_from_plus_y_cw }, last: { img, yaw: x.cam1?.yaw_deg_from_plus_y_cw } });
      Object.assign(o, { src: `${s.id}.jpg`, frames: 1, duration_s: 3, loop: !!s.loop,
        camera: x.cam1 ? { yaw: r3(x.cam1.yaw_deg_from_plus_y_cw), pos: x.cam1.pos } : null, hotspots: x.hotspots || {}, hotspots_source: x.hotspotsFile ? rel(x.hotspotsFile) : null });
      report.push(`  ${s.id.padEnd(12)} still  -> ${s.id}.jpg`);
      segOut.push(o);
      continue;
    }
    const jobs = frameJobs(P, x, px, imgOf);
    const sig = signature(P, x, jobs.length);
    const mp4 = join(P.outDir, `${s.id}.mp4`), firstJ = join(P.outDir, `${s.id}.first.jpg`), lastJ = join(P.outDir, `${s.id}.last.jpg`);
    const old = prevById.get(s.id);
    const upToDate = !P.args.force && old?.build?.signature === sig && [mp4, firstJ, lastJ].every(existsSync);
    const t0 = Date.now();
    let firstImg, lastImg;
    if (upToDate) {
      // the jpg is lossy: rebuild the exact first/last frames for the neighbours' blends
      firstImg = await jobs[0].get(); lastImg = await jobs[jobs.length - 1].get();
    } else {
      const tmp = `${mp4}.part.mp4`;
      const enc = encoder(ff.path, tmp, P.W, P.H, P.args.crf);
      for (let k = 0; k < jobs.length; k++) {
        const buf = await jobs[k].get();
        if (k === 0) firstImg = buf;
        if (k === jobs.length - 1) lastImg = buf;
        await enc.write(buf);
      }
      await enc.end();
      rmSync(mp4, { force: true });
      renameSync(tmp, mp4);
      await px.jpg(firstImg, firstJ);
      await px.jpg(lastImg, lastJ);
    }
    firstLast.set(s.id, { first: { img: firstImg, yaw: jobs[0].yaw }, last: { img: lastImg, yaw: jobs[jobs.length - 1].yaw } });
    const cam = x.camera?.cam;
    const camFirst = camFrame(cam, 1), camLast = camFrame(cam, x.source.type === 'frames' ? x.source.frames_used : x.planned);
    Object.assign(o, { src: `${s.id}.mp4`, poster: `${s.id}.first.jpg`, last: `${s.id}.last.jpg`, fps: FPS, frames: jobs.length, duration_s: r3(jobs.length / FPS),
      bytes: statSync(mp4).size,
      camera: { first: camFirst ? { frame: 1, yaw: r3(camFirst.yaw_deg_from_plus_y_cw), pos: camFirst.pos } : null,
        last: camLast ? { frame: camLast.frame, yaw: r3(camLast.yaw_deg_from_plus_y_cw), pos: camLast.pos } : null },
      yaw_first: r3(jobs[0].yaw), yaw_last: r3(jobs[jobs.length - 1].yaw) });
    if (x.head) o.head = x.head;
    if (x.tail) o.tail = x.tail;
    if (x.lock) o.lock = x.lock;
    if (s.loop) { o.loop = true; o.hotspots = x.hotspots || {}; o.hotspots_note = 'frame 1 of card 19 (all units, with visible_frac); hotspots_by_frame follows the loop'; }
    if (x.handoff) { o.handoff = { ...x.handoff, pano_file: rel(x.handoff.pano_file) }; }
    // hotspots per output frame (card 19), only for frames that are real renders
    const hm = join(x.dir, 'hotspots.meta.json');
    if (x.source.type === 'frames' && existsSync(hm)) {
      const m = readJSON(hm);
      const byFrame = new Map((m.frames || []).map((f) => [f.frame, f.units]));
      o.hotspots_source = rel(hm);
      o.hotspots_by_frame = jobs.map((j) => {
        if (!j.src || j.blend) return null;
        const u = byFrame.get(j.src);
        if (!u) return null;
        const out = {};
        for (const [k, v] of Object.entries(u)) if ((v.visible_frac ?? 0) >= MIN_VISIBLE) out[P.unitId(k)] = [r2(v.yaw), r2(v.pitch), r3(v.visible_frac)];
        return out;
      });
    }
    o.build = { signature: sig, skipped: upToDate, seconds: r2((Date.now() - t0) / 1000), ffmpeg: ff.version };
    report.push(`  ${s.id.padEnd(12)} video  ${upToDate ? 'up to date (signature ' + sig + ')' : `encoded ${jobs.length} fr in ${o.build.seconds} s`} -> ${s.id}.mp4 ${(o.bytes / 1e6).toFixed(2)} MB`);
    segOut.push(o);
  }

  // junction checks on the DECODED mp4s (what the browser shows), 512x256
  const small = async (buf) => (await sharp(buf, { raw: { width: P.W, height: P.H, channels: 3 } }).resize(512, 256, { kernel: 'cubic' }).raw().toBuffer());
  const smallFile = async (f) => (await sharp(f).removeAlpha().toColourspace('srgb').resize(512, 256, { fit: 'fill', kernel: 'cubic' }).raw().toBuffer());
  const oById = new Map(segOut.map((o) => [o.id, o]));
  const decoded = new Map();
  const dec = (id, which) => { const k = `${id}|${which}`; if (!decoded.has(k)) decoded.set(k, decodeEnd(ff.path, join(P.outDir, `${id}.mp4`), which)); return decoded.get(k); };
  for (let i = 0; i < P.active.length - 1; i++) {
    const a = P.active[i], b = P.active[i + 1];
    const A = a.kind === 'video' ? dec(a.spec.id, 'last') : await small(firstLast.get(a.spec.id).last.img);
    const B = b.kind === 'video' ? dec(b.spec.id, 'first') : await small(firstLast.get(b.spec.id).first.img);
    const j = { ...(a.junctionOut || { from: a.spec.id, to: b.spec.id }), seam_mae: r2(mae(A, B)), seam_note: 'MAE/255 between the decoded last frame shown and the first frame of the next segment, 512x256' };
    oById.get(a.spec.id).junction = j;
    report.push(`  junction ${a.spec.id} -> ${b.spec.id}: seam MAE ${j.seam_mae}/255${j.dpos_m !== undefined ? `, camera dpos ${j.dpos_m} m dyaw ${j.dyaw_deg} deg${j.gap ? ' (gap: dissolve)' : ''}` : ''}`);
  }
  for (const x of P.active) {
    if (!x.handoff) continue;
    const last = dec(x.spec.id, 'last'), pano = await smallFile(x.handoff.pano_file);
    const b = bestShift(pano, last);
    const o = oById.get(x.spec.id);
    o.handoff.last_frame_vs_pano = { mae: r2(mae(last, pano)), best_shift_deg: b.deg, best_shift_mae: b.mae };
    report.push(`  handoff ${x.spec.id}: last frame vs ${x.handoff.pano} MAE ${o.handoff.last_frame_vs_pano.mae}/255, best shift ${b.deg} deg -> tour room=${x.handoff.room} yaw = viewer yaw + ${x.handoff.tour_yaw_offset_deg} (bearing ${x.handoff.bearing_deg})`);
  }

  const doc = { schema: 'habait-platform/segments.v1', project: P.args.project, generated_at: new Date().toISOString(), generated_by: 'Habait/platform/tools/build_segments.mjs', code: CODE_VERSION, card: 34,
    fps: FPS, size: [P.W, P.H],
    convention: 'u 0.5 = camera look_dir (yaw_deg_from_plus_y_cw); viewer yaw = (u - 0.5) * 360, clockwise; bearing faced = camera yaw + viewer yaw; hotspots [yaw, pitch, visible_frac] in the frame of their segment',
    initial_view: P.initialView, hotspot_min_visible: MIN_VISIBLE, caption: P.caption,
    chain: P.active.map((x) => x.spec.id), skipped: P.segs.filter((x) => x.skip).map((x) => ({ id: x.spec.id, why: x.skip })),
    notes: P.notes, segments: segOut };
  writeFileSync(prevFile, JSON.stringify(doc, null, 1) + '\n');
  return { doc, report };
}

// ---------------- main ----------------
// =====================================================================================================================
// card 36 (2026-11-03): the CINEMATIC flow = flat photoreal clips + a draggable photoreal hold, from card 35's video manifest
// =====================================================================================================================
//   node tools/build_segments.mjs --project rainbow --dry-run            34's plan + the cinematic plan (no writes)
//   node tools/build_segments.mjs --project rainbow --cine-only          builds only the cinematic part
//   node tools/build_segments.mjs --project rainbow --make-dev-manifest  writes the dev manifest (below) from the existing clips
//   flags: --manifest <path|engine|dev> (default = CINE[p].manifest), --no-cine, --hold arc|ring
// Reads ONE manifest (`habait-engine/video.v1`, card 35's contract: segments with role orbit | hold-ring | hold-arc |
// descend-<unit> | enter-<unit>, src / frames / frames_lo / camera (per REAL frame) / loop / rest_frame; paths relative to the
// manifest's folder). Today that path is the dev manifest _local/segments/rainbow-cine/manifest.dev.json, which points at the
// clips that already exist (read-only): habait-ab's orbit (Habait/flyover/orbit/orbit_real.mp4), habait-98's arc/ring frames
// and descent (research/fal-bench-2026-11-02/flyover3d/data/{holdarc,holdring,video/descent-846.mp4}), and the photoreal
// ENTER = frames 201..408 of the same Kling 4.0 full flight the descent was cut from (B-flyover/kling-4-full-flight.mp4,
// frames 95..200 = descent-846.mp4), so descend -> enter is one continuous take ($0). Cameras: the clay camera of that flight
// (studio renders/clay/ext-flight/camera.json, 409 frames = the 409 Kling frames, 1:1) and the orbit's (420 clay frames mapped
// onto the 409 Kling frames proportionally, as habait-98's holdpull did). When card 35 writes the engine's manifest, switch
// with --manifest engine (or change CINE.rainbow.manifest): one path, nothing else changes.
// Writes _local/segments/<p>-cine/ (orbit.mp4 re-encoded for phones: h264 crf 21 faststart, SSIM vs source recorded;
// descend/enter mp4; first/last jpg; hold-<arc|ring>/{jpg,jpg_lo,camera.json}; the hand-off panorama) and
// fixtures/<p>/flow.cine.json (habait-platform/flow.cine.v1), which flow.html plays by default (js/cine.js).
// T0 decisions (card 36):
//   hold = the ARC (±45°, 169 Kling frames, rest = frame 91 = the orbit's end pose), not the ring: the Kling 360 ring failed as a
//          product (no consistent world, does not close, camera off the clay path; memory.md §7, habait-98 3.11) and the live
//          habait-flow defaults to the arc. --hold ring builds the ring as the hold (preview: pills only near its rest frame).
//   hold -> descend: a 0.6 s crossfade. The descent's first frame is the same POSITION as the arc's rest frame (node-b) but looks
//          9° lower (pitch -11 vs -2) and Kling painted it independently; habait-flow fades its clip in over 0.35 s there too.
//   descend -> enter: a cut, frame to frame (consecutive frames of one Kling take; checked as decoded MAE).
//   enter -> tour: the enter ends at the living room's camera point (6.85, -9.35, 1.6) looking at bearing 291.0 = the tour's
//          `living` at yaw 179.7. flow.html crossfades the clip's last frame into the tour's own panorama at that pose and field
//          of view (360 viewer), turns 180° to the windows (yaw 0, card 34's hand-off view; the wall behind the camera carries the
//          tour's dark door) while the field of view eases to the tour's, and reveals the tour iframe on that same view.
//   framing on a portrait phone: cover-fit, cropped around focus_x = the units' centroid projected through the hold's rest camera
//          (one value for every clip so a cut never shifts the crop).
export const CINE = {
  rainbow: {
    // THE path the build reads (relative to Habait/platform): card 35's manifest since it landed (2026-11-03 11:38); the dev
    // manifest over the same clips stays as --manifest dev (it maps the arc 1:1 to its clay and rests on frame 91; card 35 measured
    // the arc frame that continues the orbit = 64.55 and maps the camera through it, which the platform now uses)
    manifest: '../engine/_local/apt846-project/video/manifest.json',
    engineManifest: '../engine/_local/apt846-project/video/manifest.json', // card 35's output; --manifest engine
    devManifest: '_local/segments/rainbow-cine/manifest.dev.json',        // card 36's dev manifest; --manifest dev
    out: '_local/segments/rainbow-cine',
    flow: 'fixtures/rainbow/flow.cine.json',
    boxes: '../engine/_local/rainbow/units.json',                         // card 03's box_world per unit (plan-world metres)
    tourApartment: 'apt846', tourDist: '../tour360/dist/apt846', floor: 'parquet',
    hero: '846', handoffRoom: 'living', handoffViewYaw: 0, handoffTurnS: 3.0,
    unitIds: { apt846: '846' },
    titles: {
      orbit: t2(['סביב המגדל', 'Around the tower']),
      hold: t2(['מול החזית · בחרו דירה', 'At the facade · choose an apartment']),
      descend: t2(['יורדים אל המרפסת של {UNIT}', 'Descending to the terrace of {UNIT}']),
      enter: t2(['נכנסים לסלון', 'Into the living room']),
    },
    dev: {                                                                // --make-dev-manifest sources (read-only)
      orbit: '../flyover/orbit/orbit_real.mp4', orbitCamera: '../flyover/orbit/camera.json',
      flight: '../../../research/fal-bench-2026-11-02/B-flyover/kling-4-full-flight.mp4',
      flightCamera: '../studio/_local/projects/apt846-rainbow-tlv/renders/clay/ext-flight/camera.json',
      descent: '../../../research/fal-bench-2026-11-02/flyover3d/data/video/descent-846.mp4', descentFrom: 95, descentTo: 200,
      enterFrom: 201, enterTo: 408,
      arc: '../../../research/fal-bench-2026-11-02/flyover3d/data/holdarc', ring: '../../../research/fal-bench-2026-11-02/flyover3d/data/holdring',
    },
  },
};
const CINE_ROLES = /^(approach|orbit|hold-ring|hold-arc|descend-[\w-]+|enter-[\w-]+)$/;
const sha16 = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 16);
const fileSha16 = (p) => sha16(readFileSync(p));
const P_ = (p) => resolve(PLATFORM, p);

function probe(ff, file) {
  const fp = ff ? ff.path.replace(/ffmpeg(\.exe)?$/i, (m, e) => `ffprobe${e || ''}`) : 'ffprobe';
  const r = spawnSync(fp, ['-v', 'error', '-select_streams', 'v:0', '-count_packets', '-show_entries', 'stream=width,height,r_frame_rate,nb_read_packets,codec_name:format=duration,size', '-of', 'json', file], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffprobe ${file}: ${r.stderr}`);
  const j = JSON.parse(r.stdout); const s = j.streams[0]; const [a, b] = s.r_frame_rate.split('/').map(Number);
  return { w: s.width, h: s.height, fps: a / b, frames: Number(s.nb_read_packets), duration_s: Number(j.format.duration), bytes: Number(j.format.size), codec: s.codec_name };
}
function ffrun(ff, args, what) {
  const r = spawnSync(ff.path, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`ffmpeg (${what}): ${r.stderr}`);
}
// Blender camera (looks along local -Z, up +Y, no roll) from a position and a look-at point; rows of matrix_world
function camFromLook(pos, look) {
  let f = [look[0] - pos[0], look[1] - pos[1], look[2] - pos[2]]; const n = Math.hypot(...f); f = f.map((v) => v / n);
  let r = [f[1], -f[0], 0]; const rn = Math.hypot(...r); r = r.map((v) => v / rn);
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const m = [[r[0], u[0], -f[0], pos[0]], [r[1], u[1], -f[1], pos[1]], [r[2], u[2], -f[2], pos[2]], [0, 0, 0, 1]];
  return m.map((row) => row.map((v) => Math.round(v * 1e6) / 1e6));
}
const camYaw = (m) => ((Math.atan2(-m[0][2], -m[1][2]) * 180) / Math.PI + 360) % 360;       // bearing of the view, clockwise from +Y
const camPitch = (m) => (Math.asin(Math.max(-1, Math.min(1, -m[2][2]))) * 180) / Math.PI;
const hfovOf = (f) => f.hfov_deg || (f.lens_mm && f.sensor_mm ? (2 * Math.atan(f.sensor_mm / 2 / f.lens_mm) * 180) / Math.PI : 65.5);
function slimCamera(frames, extra) {
  // one row per REAL frame: matrix_world (rows) + the field of view; what js/cine.js needs to project unit boxes
  const f0 = frames[0];
  const hf = hfovOf(f0), res = f0.res || [1280, 720];
  return { schema: 'habait-platform/cine-camera.v1', camera_convention: 'Blender camera: looks along local -Z, up local +Y; matrix_world = camera to world (rows)',
    frame_world: 'plan-world metres (X right, Y up the sheet, Z up; floor 16 at z 0)', hfov_deg: r3(hf), res, n_frames: frames.length, ...extra,
    frames: frames.map((f) => f.matrix_world.slice(0, 3).map((row) => row.map((v) => Math.round(v * 1e5) / 1e5))) };
}
function devCamera(srcFrames, pick, note) {
  // srcFrames: frames with pos/look (studio) or matrix_world (flyover); pick(k) -> source index for real frame k (0-based)
  return { note, frames: pick.map((si, k) => { const s = srcFrames[si]; const m = s.matrix_world || camFromLook(s.pos, s.look);
    return { frame: k + 1, src_frame: s.frame, matrix_world: m, lens_mm: s.lens_mm, sensor_mm: s.sensor_mm, hfov_deg: r3(hfovOf(s)), res: s.res || [1280, 720] }; }) };
}

export function makeDevManifest(project, ff) {
  const C = CINE[project]; if (!C) throw new Error(`no cinematic spec for "${project}"`);
  const D = C.dev, out = P_(C.out), dev = join(out, 'dev');
  mkdirSync(dev, { recursive: true });
  const rd = (p) => readJSON(P_(p));
  const lines = [];
  // orbit: 420 clay frames -> 409 Kling frames, proportional (clay = round(k * 419/408) + 1), as habait-98's holdpull/camera.json
  const oc = rd(D.orbitCamera).frames, op = probe(ff, P_(D.orbit));
  const oPick = Array.from({ length: op.frames }, (_, k) => Math.round((k * (oc.length - 1)) / (op.frames - 1)));
  writeFileSync(join(dev, 'orbit.camera.json'), JSON.stringify({ schema: 'habait-flyover/orbit-camera.v1', fps: 24, n_frames: op.frames,
    ...devCamera(oc, oPick, `Habait/flyover/orbit/camera.json (${oc.length} clay frames) mapped onto the ${op.frames} Kling frames of orbit_real.mp4 proportionally (habait-98's holdpull mapping)`) }));
  // the full Kling flight: its clay camera has one frame per Kling frame (409); descent = 95..200, enter = 201..408 (0-based)
  const fc = rd(D.flightCamera).frames, fp = probe(ff, P_(D.flight));
  if (fc.length !== fp.frames) throw new Error(`flight camera ${fc.length} frames vs clip ${fp.frames}`);
  const dp = probe(ff, P_(D.descent));
  if (dp.frames !== D.descentTo - D.descentFrom + 1) throw new Error(`descent-846.mp4 has ${dp.frames} frames, expected ${D.descentTo - D.descentFrom + 1}`);
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  writeFileSync(join(dev, 'descend-846.camera.json'), JSON.stringify({ schema: 'habait-flyover/flight-camera.v1', fps: 24, n_frames: dp.frames,
    ...devCamera(fc, range(D.descentFrom, D.descentTo), 'studio ext-flight/camera.json frames 96..201 = Kling full flight frames 95..200 (0-based) = descent-846.mp4 (habait-89 cut)') }));
  writeFileSync(join(dev, 'enter-846.camera.json'), JSON.stringify({ schema: 'habait-flyover/flight-camera.v1', fps: 24, n_frames: D.enterTo - D.enterFrom + 1,
    ...devCamera(fc, range(D.enterFrom, D.enterTo), 'studio ext-flight/camera.json frames 202..409 = Kling full flight frames 201..408 (0-based): through the slider into the living room') }));
  const enterMp4 = join(dev, 'enter-846.mp4');
  if (!existsSync(enterMp4)) {
    ffrun(ff, ['-i', P_(D.flight), '-vf', `select='between(n\\,${D.enterFrom}\\,${D.enterTo})',setpts=N/24/TB`, '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
      '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart', '-r', '24', enterMp4], 'enter trim');
  }
  // holds: habait-98's frames, cameras 1:1 with the Kling frames (arc: the first 169 of 181 clay frames; ring: remapped by 98)
  const arcMan = rd(`${D.arc}/manifest.json`), arcCam = rd(`${D.arc}/camera.json`);
  const nArc = Math.min(arcMan.frames, arcCam.frames.length);
  writeFileSync(join(dev, 'hold-arc.camera.json'), JSON.stringify({ schema: 'habait-flyover/hold-arc-camera.v1', fps: 24, n_frames: nArc, centre_frame: arcCam.centre_frame,
    ...devCamera(arcCam.frames, range(0, nArc - 1), 'flyover3d/data/holdarc/camera.json frames 1..169 = the 169 Kling frames of arc_real.mp4 (1:1, habait-98)') }));
  const ringMan = rd(`${D.ring}/manifest.json`), ringCam = rd(`${D.ring}/camera.json`);
  const nRing = Math.min(ringMan.frames, ringCam.frames.length);
  writeFileSync(join(dev, 'hold-ring.camera.json'), JSON.stringify({ schema: 'habait-flyover/hold-arc-camera.v1', fps: 24, n_frames: nRing, centre_frame: ringCam.centre_frame, loop: true,
    ...devCamera(ringCam.frames, range(0, nRing - 1), 'flyover3d/data/holdring/camera.json (remapped by habait-98 by edge correlation)') }));
  const relM = (p) => posix(relative(out, p));
  const ep = probe(ff, enterMp4);
  const man = {
    schema: 'habait-engine/video.v1', project, dev: true,
    note: 'card 36 DEV manifest: card 35\'s contract over the clips that already exist (read-only sources, copies made by tools/build_segments.mjs). Replace with the engine\'s manifest (--manifest engine) once card 35 writes it.',
    generated_by: `tools/build_segments.mjs --make-dev-manifest (${CODE_VERSION}; card 36)`, generated_at: new Date().toISOString(),
    segments: [
      { id: 'orbit', role: 'orbit', kind: 'flat-video', unit: null, src: relM(P_(D.orbit)), fps: 24, n_frames: op.frames, size: [op.w, op.h], duration_s: r3(op.duration_s),
        camera: 'dev/orbit.camera.json', loop: false, rest_frame: null,
        source: { endpoint: 'fal-ai/kling/v4/video-to-video/edit', cost_usd: 3.30, adopted_from: 'Habait/flyover/orbit/orbit_real.mp4', by: 'habait-ab 2026-11-02' } },
      { id: 'hold-arc', role: 'hold-arc', kind: 'frames', unit: null, frames: relM(P_(`${D.arc}/jpg`)), frames_lo: relM(P_(`${D.arc}/jpg_lo`)), pattern: 'frame_%04d.jpg',
        fps: 24, n_frames: nArc, size: [arcMan.width, arcMan.height], size_lo: [arcMan.lo.width, arcMan.lo.height], camera: 'dev/hold-arc.camera.json', loop: false, rest_frame: arcCam.centre_frame,
        source: { endpoint: 'fal-ai/kling/v4/video-to-video/edit', cost_usd: 1.50, adopted_from: 'research/fal-bench-2026-11-02/flyover3d/data/holdarc (arc_real.mp4)', by: 'habait-98 2026-11-03' } },
      { id: 'hold-ring', role: 'hold-ring', kind: 'frames', unit: null, frames: relM(P_(`${D.ring}/jpg`)), frames_lo: relM(P_(`${D.ring}/jpg_lo`)), pattern: 'frame_%04d.jpg',
        fps: 24, n_frames: nRing, size: [ringMan.width, ringMan.height], size_lo: [ringMan.lo.width, ringMan.lo.height], camera: 'dev/hold-ring.camera.json', loop: true, rest_frame: ringCam.centre_frame,
        preview: true, pills_near: ringMan.pills_near ?? 4, preview_why: 'Kling 360 ring failed as a product (habait-98 3.11, memory.md §7): no consistent world, does not close, camera off the clay path',
        source: { endpoint: 'fal-ai/kling/v4/video-to-video/edit', cost_usd: 1.88, adopted_from: 'research/fal-bench-2026-11-02/flyover3d/data/holdring (ring_real.mp4)', by: 'habait-98 2026-11-03' } },
      { id: 'descend-846', role: 'descend-846', kind: 'flat-video', unit: '846', src: relM(P_(D.descent)), fps: 24, n_frames: dp.frames, size: [dp.w, dp.h], duration_s: r3(dp.duration_s),
        camera: 'dev/descend-846.camera.json', loop: false, rest_frame: null,
        source: { endpoint: 'fal-ai/kling/v4/video-to-video/edit', cost_usd: 3.20, adopted_from: 'research/fal-bench-2026-11-02/flyover3d/data/video/descent-846.mp4 = B-flyover/kling-4-full-flight.mp4 frames 95..200', by: 'habait-89 2026-11-02' } },
      { id: 'enter-846', role: 'enter-846', kind: 'flat-video', unit: '846', src: 'dev/enter-846.mp4', fps: 24, n_frames: ep.frames, size: [ep.w, ep.h], duration_s: r3(ep.duration_s),
        camera: 'dev/enter-846.camera.json', loop: false, rest_frame: null,
        source: { endpoint: 'fal-ai/kling/v4/video-to-video/edit', cost_usd: 0, adopted_from: `research/fal-bench-2026-11-02/B-flyover/kling-4-full-flight.mp4 frames ${D.enterFrom}..${D.enterTo} (the same take as descent-846; $3.20 paid on 2.11 for the whole flight)`, by: 'card 36' } },
    ],
  };
  writeFileSync(join(out, 'manifest.dev.json'), JSON.stringify(man, null, 1) + '\n');
  lines.push(`wrote ${posix(relative(PLATFORM, join(out, 'manifest.dev.json')))}: ${man.segments.map((s) => `${s.role} ${s.n_frames} fr`).join(', ')}; dev cameras + dev/enter-846.mp4 (${ep.frames} fr) in ${posix(relative(PLATFORM, dev))}`);
  return lines;
}

function readCineManifest(project, which) {
  const C = CINE[project];
  const path = which === 'engine' ? P_(C.engineManifest) : which === 'dev' ? P_(C.devManifest) : !which ? P_(C.manifest) : resolve(which);
  if (!existsSync(path)) throw new Error(`cinematic manifest not found: ${path}${which === 'dev' ? ' (run --make-dev-manifest)' : ' (card 35 not run yet? --manifest dev uses the dev manifest)'}`);
  const man = readJSON(path); const dir = dirname(path);
  const errors = [], warnings = [];
  if (man.schema !== 'habait-engine/video.v1') errors.push(`schema "${man.schema}" (want habait-engine/video.v1)`);
  if (!Array.isArray(man.segments) || !man.segments.length) errors.push('no segments');
  const abs = (p) => (p ? (/^[A-Za-z]:[\\/]|^\//.test(p) ? p : resolve(dir, p)) : null);
  const segs = (man.segments || []).map((s) => {
    const x = { ...s, srcAbs: abs(s.src), framesAbs: abs(s.frames), framesLoAbs: abs(s.frames_lo), cameraAbs: abs(s.camera), posterAbs: abs(s.poster), lastAbs: abs(s.last) };
    if (!CINE_ROLES.test(s.role || '')) errors.push(`${s.id}: role "${s.role}"`);
    const hold = /^hold-/.test(s.role);
    if (hold) {
      if (!x.framesAbs || !existsSync(x.framesAbs)) errors.push(`${s.id}: frames dir missing (${s.frames})`);
      if (!x.cameraAbs || !existsSync(x.cameraAbs)) errors.push(`${s.id}: camera missing (${s.camera})`);
      if (x.framesLoAbs && !existsSync(x.framesLoAbs)) { warnings.push(`${s.id}: frames_lo missing, hi only`); x.framesLoAbs = null; }
    } else if (!x.srcAbs || !existsSync(x.srcAbs)) errors.push(`${s.id}: src missing (${s.src})`);
    if (!hold && x.cameraAbs && !existsSync(x.cameraAbs)) { warnings.push(`${s.id}: camera ${s.camera} missing (ignored)`); x.cameraAbs = null; }
    return x;
  });
  return { path, dir, man, segs, errors, warnings, sha: existsSync(path) ? fileSha16(path) : null };
}

function loadCam(file, nReal) {
  // a manifest camera: frames[] with matrix_world (+ lens/sensor or hfov); must be per REAL frame (card 35's contract)
  const c = readJSON(file); const fr = c.frames || [];
  return { raw: c, frames: fr, n: fr.length, ok: !nReal || fr.length >= nReal, centre: c.centre_frame || null, loop: !!c.loop };
}
function projectBox(M, hfov, aspect, p) {
  // world point -> normalised frame coords (0..1, 0..1) through a Blender camera; null behind
  const R = [[M[0][0], M[1][0], M[2][0]], [M[0][1], M[1][1], M[2][1]], [M[0][2], M[1][2], M[2][2]]];
  const t = [M[0][3], M[1][3], M[2][3]]; const d = [p[0] - t[0], p[1] - t[1], p[2] - t[2]];
  const x = R[0][0] * d[0] + R[0][1] * d[1] + R[0][2] * d[2], y = R[1][0] * d[0] + R[1][1] * d[1] + R[1][2] * d[2], z = R[2][0] * d[0] + R[2][1] * d[1] + R[2][2] * d[2];
  if (z >= -1e-6) return null;
  const fx = 1 / Math.tan((hfov * Math.PI) / 360);
  return [(x / -z * fx + 1) / 2, (1 - (y / -z) * fx * aspect) / 2];
}

export function planCine(args, ff) {
  const C = CINE[args.project];
  if (!C) return null;
  const M = readCineManifest(args.project, args.manifest);
  const out = P_(C.out), lines = [], errors = [...M.errors], warnings = [...M.warnings];
  const kind = M.man.dev ? 'dev' : 'engine';
  const eng = P_(C.engineManifest);
  let engNote = resolve(M.path) === resolve(eng) ? `card 35's (${M.man.generated_by || '?'}, ${M.man.generated_at || '?'})` : 'engine manifest (card 35): not written yet';
  if (existsSync(eng) && resolve(M.path) !== resolve(eng)) { try { const e = readJSON(eng); engNote = `engine manifest (card 35) EXISTS: ${(e.segments || []).map((s) => s.role).join(', ')} -> switch with --manifest engine`; } catch (e) { engNote = `engine manifest unreadable: ${e.message}`; } }
  lines.push(`cinematic ${args.project}${args.dryRun ? ' (dry-run)' : ''} -> ${posix(relative(PLATFORM, out))}, ${C.flow}`);
  lines.push(`manifest: ${rel(M.path)} (${kind}, ${M.man.schema}, ${M.segs.length} segments, sha ${M.sha}); ${engNote}`);
  const byRole = new Map(M.segs.map((s) => [s.role, s]));
  // the hold: --hold wins, then the manifest's hold_default (card 35), then the arc (T0: the ring is a preview, see the header)
  const holdPref = args.hold === 'ring' ? ['hold-ring', 'hold-arc'] : args.hold === 'arc' ? ['hold-arc', 'hold-ring']
    : M.man.hold_default === 'hold-ring' && !(M.segs.find((s) => s.role === 'hold-ring') || {}).preview ? ['hold-ring', 'hold-arc'] : ['hold-arc', 'hold-ring'];
  const holdSrc = holdPref.map((r) => byRole.get(r)).find(Boolean);
  const orbit = byRole.get('orbit'), approach = byRole.get('approach');
  if (!orbit) errors.push('no orbit segment');
  if (!holdSrc) errors.push('no hold-arc / hold-ring segment');
  const descends = M.segs.filter((s) => /^descend-/.test(s.role));
  if (!descends.length) errors.push('no descend-<unit> segment');
  // units: boxes (card 03) by platform id
  const boxesDoc = readJSON(P_(C.boxes));
  const units = {};
  for (const u of boxesDoc.units || []) { if (!u.box_world) continue; const id = C.unitIds[u.id] || String(u.id).replace(/^apt/, ''); const b = u.box_world;
    units[id] = { box_world: b, centre: [r3((b[0] + b[3]) / 2), r3((b[1] + b[4]) / 2), r3((b[2] + b[5]) / 2)], floor: u.floor }; }
  const platUnits = readJSON(join(PLATFORM, 'fixtures', args.project, 'units.json')).units.map((u) => u.id);
  const noBox = platUnits.filter((id) => !units[id]);
  if (noBox.length) warnings.push(`units without box_world (no pill at the hold): ${noBox.join(', ')}`);
  const hero = units[C.hero];
  const segs = [];
  const add = (s, o) => { segs.push({ m: s, ...o }); };
  if (approach) add(approach, { id: 'approach', role: 'approach', next: 'orbit' });
  if (orbit) add(orbit, { id: 'orbit', role: 'orbit', next: 'hold-facade' });
  if (holdSrc) add(holdSrc, { id: 'hold-facade', role: 'hold', track: holdSrc.role, next: null });
  // the unit = the role's suffix (descend-846), mapped like card 19's ids (card 35 writes unit "apt846" next to role "descend-846")
  const unitOf = (s, prefix) => { const u = s.role.slice(prefix.length) || String(s.unit || ''); return C.unitIds[u] || u.replace(/^apt/, ''); };
  for (const d of descends) { const unit = unitOf(d, 'descend-'); const en = byRole.get(`enter-${unit}`) || M.segs.find((s) => /^enter-/.test(s.role) && unitOf(s, 'enter-') === unit); add(d, { id: `descend-${unit}`, role: 'descend', unit, next: en ? `enter-${unit}` : 'handoff' }); if (en) add(en, { id: `enter-${unit}`, role: 'enter', unit, next: 'handoff' }); }
  // cameras, frames, focus
  let focus = 0.5, focusWhy = 'centre (no hold camera)';
  for (const x of segs) {
    const s = x.m;
    if (x.role === 'hold') {
      const pat = s.pattern || 'frame_%04d.jpg';
      const nOnDisk = existsSync(s.framesAbs) ? readdirSync(s.framesAbs).filter((f) => /^frame_\d{4}\.jpg$/.test(f)).length : 0;
      const cam = loadCam(s.cameraAbs);
      x.N = Math.min(nOnDisk, cam.n, s.n_frames || Infinity);
      if (x.N < 2) errors.push(`${s.id}: ${nOnDisk} frames on disk, camera ${cam.n}`);
      x.rest = Math.min(x.N, Math.max(1, s.rest_frame || cam.centre || Math.ceil(x.N / 2)));
      x.loop = !!(s.loop || cam.loop); x.cam = cam; x.pattern = pat;
      x.loN = s.framesLoAbs ? readdirSync(s.framesLoAbs).filter((f) => /^frame_\d{4}\.jpg$/.test(f)).length : 0;
      const f0 = cam.frames[x.rest - 1]; x.hfov = hfovOf(f0); x.size = s.size || f0.res || [1280, 720]; x.aspect = x.size[0] / x.size[1];
      // the units at the rest pose: where the pills land (normalised), and the crop focus for a portrait phone
      x.atRest = {};
      for (const [id, u] of Object.entries(units)) { const q = projectBox(f0.matrix_world, x.hfov, x.aspect, u.centre); if (q) x.atRest[id] = q.map(r3); }
      const xs = Object.values(x.atRest).map((q) => q[0]).filter((v) => v > 0 && v < 1);
      if (xs.length) { focus = r3(Math.min(0.7, Math.max(0.3, xs.reduce((a, b) => a + b, 0) / xs.length))); focusWhy = `units' centroid through the ${s.role} rest camera (frame ${x.rest})`; }
      if (s.preview) warnings.push(`${s.id} is a PREVIEW track: ${s.preview_why || 'see its manifest'}`);
    } else {
      x.probe = ff ? probe(ff, s.srcAbs) : null;
      x.N = x.probe ? x.probe.frames : s.n_frames;
      if (s.cameraAbs) { x.cam = loadCam(s.cameraAbs); if (x.N && x.cam.n !== x.N) warnings.push(`${s.id}: camera ${x.cam.n} frames vs video ${x.N} (expected per real frame)`); }
      x.size = x.probe ? [x.probe.w, x.probe.h] : s.size || [1280, 720];
      x.duration_s = x.probe ? r3(x.probe.duration_s) : s.duration_s;
    }
  }
  // junction poses (camera) between consecutive segments
  const pose = (x, which) => { if (!x.cam) return null; const i = x.role === 'hold' ? x.rest - 1 : which === 'first' ? 0 : x.cam.n - 1; const m = x.cam.frames[i]?.matrix_world; if (!m) return null; return { pos: [m[0][3], m[1][3], m[2][3]], yaw: camYaw(m), pitch: camPitch(m) }; };
  for (let i = 0; i < segs.length; i++) {
    const a = segs[i], b = segs.find((y) => y.id === a.next) || (a.role === 'hold' ? segs.find((y) => y.role === 'descend') : null);
    if (!b) continue;
    const pa = pose(a, 'last'), pb = pose(b, 'first');
    const j = { to: b.id };
    if (pa && pb) Object.assign(j, { dpos_m: r3(dist(pa.pos, pb.pos)), dyaw_deg: r2(Math.abs(wrap180(pa.yaw - pb.yaw))), dpitch_deg: r2(pb.pitch - pa.pitch) });
    const sameTake = a.m.source?.adopted_from && b.m.source?.adopted_from && /kling-4-full-flight/.test(a.m.source.adopted_from) && /kling-4-full-flight/.test(b.m.source.adopted_from);
    if (a.role === 'orbit' && b.role === 'hold') { j.mode = 'crossfade'; j.seconds = 0.5; j.why = 'the hold\'s rest frame = the orbit\'s end pose (same camera); Kling painted the two takes separately: a 0.5 s fade evens the colour'; }
    else if (a.role === 'hold') { j.mode = 'crossfade'; j.seconds = 0.6; j.why = `the hold eases to its rest frame first; the descent starts at the same position ${j.dpos_m ?? '?'} m but ${j.dpitch_deg ?? '?'}° pitch and an independent Kling take: 0.6 s crossfade (habait-flow: 0.35 s)`; }
    else if (a.role === 'descend' && b.role === 'enter') { j.mode = sameTake || (j.dpos_m !== undefined && j.dpos_m < 0.15) ? 'cut' : 'crossfade'; j.seconds = j.mode === 'cut' ? 0 : 0.5; j.why = sameTake ? 'consecutive frames of one Kling take: cut frame to frame' : 'separate takes: crossfade'; }
    else { j.mode = 'cut'; j.seconds = 0; }
    a.junction = j;
  }
  // hand-off: the last enter (or descent) frame -> the tour room at that pose
  const scenesDoc = readJSON(join(HABAIT, 'tour360/apartments', C.tourApartment, 'scenes.json'));
  const scene = (scenesDoc.scenes || scenesDoc).find((s) => s.id === C.handoffRoom);
  if (!scene || !Number.isFinite(scene.centreBearingDeg)) errors.push(`tour scene ${C.handoffRoom} has no centreBearingDeg`);
  const panoCands = [join(P_(C.tourDist), `panos-${C.floor}`, `${scene?.asset}.webp`), join(P_(C.tourDist), 'panos', `${scene?.asset}.webp`), join(HABAIT, 'tour360/apartments', C.tourApartment, 'panos/balanced', `${scene?.asset}.webp`)];
  const panoSrc = panoCands.find(existsSync);
  if (!panoSrc) errors.push(`hand-off panorama ${scene?.asset}.webp not found`);
  for (const x of segs) {
    if (x.next !== 'handoff') continue;
    const p = pose(x, 'last');
    const camYawLast = p ? p.yaw : null;
    x.handoff = { room: C.handoffRoom, pano: 'handoff-' + C.handoffRoom + '.webp', pano_from: panoSrc ? rel(panoSrc) : null, bearing_deg: scene?.centreBearingDeg,
      last_camera: p ? { yaw: r2(p.yaw), pitch: r2(p.pitch), pos: p.pos.map(r3) } : null,
      start_yaw: camYawLast === null ? 0 : r2(wrap180(camYawLast - scene.centreBearingDeg)), start_pitch: p ? r2(p.pitch) : -2, hfov_deg: x.cam ? r2(hfovOf(x.cam.frames[x.cam.n - 1])) : 65.5,
      view_yaw: C.handoffViewYaw, turn_s: C.handoffTurnS, crossfade_s: x.role === 'enter' ? 0.5 : 0.8,
      tour_params: { scope: 'apartment', ui: 'min', floor: C.floor, video: '0' }, tour_yaw_offset_deg: 0,
      why: x.role === 'enter' ? 'the enter ends at the room\'s camera point: same pose and field of view in the tour\'s own panorama, then a 180° turn to the windows (card 34\'s view)' : 'no enter clip: the descent\'s last frame crossfades into the room (T0 fallback)' };
    if (!p) warnings.push(`${x.id}: no camera, hand-off at yaw 0 after a crossfade`);
    if (x.role === 'descend') warnings.push(`${x.id}: no enter-${x.unit} clip in the manifest: crossfade from the descent straight into the room (fallback)`);
  }
  // describe
  const fmt = (x) => {
    const s = x.m; let l = `  ${x.id.padEnd(12)} ${(x.role === 'hold' ? x.track : s.kind || 'flat-video').padEnd(11)} `;
    if (x.role === 'hold') l += `${x.N} frames ${x.size.join('x')}${x.loN ? ` (+ lo${s.size_lo ? ' ' + s.size_lo.join('x') : ''} ${x.loN})` : ''}, rest frame ${x.rest}${x.loop ? ', loop' : ''}${s.preview ? ', PREVIEW' : ''}, camera ${x.cam.n}/${x.N} -> ${s.role}/; pills from ${Object.keys(x.atRest).length} unit boxes, ${C.hero} at (${(x.atRest[C.hero] || []).join(', ')})`;
    else l += `${x.N ?? '?'} fr ${x.size.join('x')} ${x.duration_s ?? '?'} s, ${rel(s.srcAbs)} -> ${x.id}.mp4${x.role === 'orbit' ? ' (re-encode h264 crf 21 faststart)' : ''} + first/last jpg${x.cam ? `, camera ${x.cam.n}` : ''}`;
    if (x.junction) l += `; -> ${x.junction.to} ${x.junction.mode}${x.junction.seconds ? ` ${x.junction.seconds} s` : ''}${x.junction.dpos_m !== undefined ? ` (dpos ${x.junction.dpos_m} m, dyaw ${x.junction.dyaw_deg}°, dpitch ${x.junction.dpitch_deg}°)` : ''}`;
    if (x.handoff) l += `; hand-off: ${x.handoff.room} at yaw ${x.handoff.start_yaw} pitch ${x.handoff.start_pitch} hfov ${x.handoff.hfov_deg} (camera ${x.handoff.last_camera?.yaw}° - centre ${x.handoff.bearing_deg}°), turn ${x.handoff.turn_s} s to yaw ${x.handoff.view_yaw}, tour ${x.handoff.room}`;
    return l;
  };
  for (const x of segs) lines.push(fmt(x));
  const alt = M.segs.filter((s) => /^hold-/.test(s.role) && s !== holdSrc).map((s) => s.role);
  if (alt.length) lines.push(`  (not built) ${alt.join(', ')}: ${alt.map((r) => (M.segs.find((s) => s.role === r)?.preview ? 'preview, the Kling ring failed as a product' : 'not the hold')).join(', ')} (--hold ring makes it the hold)`);
  lines.push(`framing: focus_x ${focus} (${focusWhy}); hero ${C.hero} box ${hero ? 'yes' : 'MISSING'}`);
  return { C, M, out, segs, units, focus, focusWhy, errors, warnings, lines, holdSrc, panoSrc, scene };
}

function cineFlow(Q, project, caption) {
  const C = Q.C, rel2 = (f) => posix(relative(join(PLATFORM, dirname(C.flow)), join(Q.out, f)));
  const fill = (o, unit) => (o ? { he: o.he.replace('{UNIT}', unit || ''), en: o.en.replace('{UNIT}', unit || '') } : null);
  const segments = Q.segs.map((x) => {
    const base = { id: x.id, role: x.role, ...(x.unit ? { unit: x.unit } : {}), title: fill(C.titles[x.role], x.unit), next: x.next };
    if (x.role === 'hold') {
      const t = x.track;
      return { ...base, kind: 'frames', track: t, dir: rel2(t + '/'), hi: 'jpg', lo: x.loN ? 'jpg_lo' : null, pattern: 'frame_%04d.jpg', frames: x.N, size: x.size, size_lo: x.m.size_lo || null,
        camera: rel2(`${t}/camera.json`), rest_frame: x.rest, loop: x.loop, preview: !!x.m.preview, pills_near: x.m.preview ? (x.m.pills_near ?? 4) : null,
        units_at_rest: x.atRest, junction: x.junction || null };
    }
    return { ...base, kind: 'flat-video', src: rel2(`${x.id}.mp4`), poster: rel2(`${x.id}.first.jpg`), last: rel2(`${x.id}.last.jpg`), fps: 24, frames: x.N, duration_s: x.duration_s, size: x.size,
      camera: x.cam ? rel2(`${x.id}.camera.json`) : null, junction: x.junction || null, ...(x.handoff ? { handoff: { ...x.handoff, pano: rel2(x.handoff.pano) } } : {}) };
  });
  const d = Q.segs.find((x) => x.role === 'descend' && x.unit === Q.C.hero) || Q.segs.find((x) => x.role === 'descend');
  const e = Q.segs.find((x) => x.role === 'enter' && x.unit === Q.C.hero);
  return {
    $comment: 'card 36: the cinematic flight flow.html plays by default (js/cine.js). Written by tools/build_segments.mjs from ONE video manifest (card 35 contract); do not edit by hand.',
    schema: 'habait-platform/flow.cine.v1', project, generated_at: new Date().toISOString(), generated_by: `${CODE_VERSION} + cine (card 36)`,
    manifest: { path: rel(Q.M.path), kind: Q.M.man.dev ? 'dev' : 'engine', sha256_16: Q.M.sha },
    start: Q.segs[0].id, hold: 'hold-facade', focus_x: Q.focus, focus_why: Q.focusWhy,
    defaults: { descend: d ? d.id : null, enter: e ? e.id : null },
    caption, units: Q.units, segments,
  };
}

async function buildCine(Q, ff, project, caption) {
  const out = Q.out; mkdirSync(out, { recursive: true });
  const report = [];
  const sharp = loadSharp();
  const jpgOf = (mp4, which, file) => ffrun(ff, which === 'first' ? ['-i', mp4, '-frames:v', '1', '-q:v', '2', file] : ['-sseof', '-0.3', '-i', mp4, '-update', '1', '-q:v', '2', file], `${which} frame of ${mp4}`);
  const fresh = (dst, src) => existsSync(dst) && statSync(dst).mtimeMs >= statSync(src).mtimeMs && statSync(dst).size > 0;
  for (const x of Q.segs) {
    const s = x.m;
    if (x.role === 'hold') {
      const d = join(out, x.track); mkdirSync(join(d, 'jpg'), { recursive: true }); if (x.loN) mkdirSync(join(d, 'jpg_lo'), { recursive: true });
      let copied = 0;
      for (let i = 1; i <= x.N; i++) {
        const f = `frame_${String(i).padStart(4, '0')}.jpg`;
        for (const [srcDir, sub] of [[s.framesAbs, 'jpg'], x.loN ? [s.framesLoAbs, 'jpg_lo'] : null].filter(Boolean)) {
          const a = join(srcDir, f), b = join(d, sub, f);
          if (!fresh(b, a)) { writeFileSync(b, readFileSync(a)); copied++; }
        }
      }
      writeFileSync(join(d, 'camera.json'), JSON.stringify(slimCamera(x.cam.frames.slice(0, x.N), { rest_frame: x.rest, loop: x.loop, source: rel(s.cameraAbs) })));
      report.push(`  ${x.id}: ${x.track} ${x.N} frames (${copied} files copied, rest ${x.rest}) + camera.json`);
      continue;
    }
    const mp4 = join(out, `${x.id}.mp4`);
    if (!fresh(mp4, s.srcAbs)) {
      if (x.role === 'orbit') ffrun(ff, ['-i', s.srcAbs, '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level:v', '4.0', '-g', '48', '-movflags', '+faststart', mp4], 'orbit encode');
      else ffrun(ff, ['-i', s.srcAbs, '-an', '-c:v', 'copy', '-movflags', '+faststart', mp4], `${x.id} remux`);
    }
    jpgOf(mp4, 'first', join(out, `${x.id}.first.jpg`)); jpgOf(mp4, 'last', join(out, `${x.id}.last.jpg`));
    if (x.cam) writeFileSync(join(out, `${x.id}.camera.json`), JSON.stringify(slimCamera(x.cam.frames, { source: rel(s.cameraAbs) })));
    const pr = probe(ff, mp4);
    let q = '';
    if (x.role === 'orbit') { const r = spawnSync(ff.path, ['-hide_banner', '-i', mp4, '-i', s.srcAbs, '-lavfi', '[0:v][1:v]ssim', '-f', 'null', '-'], { encoding: 'utf8' }); const m = /All:([0-9.]+)/.exec(r.stderr || ''); x.ssim = m ? Number(m[1]) : null; q = `, SSIM vs source ${x.ssim}`; }
    if (pr.frames !== x.N) throw new Error(`${x.id}: ${pr.frames} frames after the copy, ${x.N} in the source`);
    report.push(`  ${x.id}: ${pr.frames} fr ${(pr.bytes / 1e6).toFixed(1)} MB${q}`);
  }
  if (Q.panoSrc) { const dst = join(out, `handoff-${Q.C.handoffRoom}.webp`); writeFileSync(dst, readFileSync(Q.panoSrc)); report.push(`  hand-off panorama ${rel(Q.panoSrc)} -> ${posix(relative(PLATFORM, dst))}`); }
  // junction checks on what the player shows: decoded boundary frames (MAE /255 at 512x288)
  const px = async (file) => (await sharp(file).removeAlpha().resize(512, 288, { fit: 'fill' }).raw().toBuffer());
  const holdX = Q.segs.find((x) => x.role === 'hold');
  const restJpg = holdX ? join(out, holdX.track, 'jpg', `frame_${String(holdX.rest).padStart(4, '0')}.jpg`) : null;
  for (const x of Q.segs) {
    const j = x.junction; if (!j) continue;
    const to = Q.segs.find((y) => y.id === j.to);
    const a = x.role === 'hold' ? restJpg : join(out, `${x.id}.last.jpg`), b = to.role === 'hold' ? restJpg : join(out, `${to.id}.first.jpg`);
    if (existsSync(a) && existsSync(b)) j.seam_mae = r2(mae(await px(a), await px(b)));
    report.push(`  junction ${x.id} -> ${j.to}: ${j.mode}${j.seconds ? ` ${j.seconds} s` : ''}, decoded MAE ${j.seam_mae}/255`);
  }
  const flow = cineFlow(Q, project, caption);
  for (const s of flow.segments) {
    if (!s.handoff || !Q.panoSrc) continue;
    const reg = await registerHandoff(sharp, Q.panoSrc, join(out, `${s.id}.last.jpg`), s.handoff, s.size || [1280, 720]);
    s.handoff.registration = reg;
    report.push(`  hand-off registration ${s.id}: ${reg.applied ? `applied yaw ${reg.dyaw >= 0 ? '+' : ''}${reg.dyaw}°, pitch ${reg.dpitch >= 0 ? '+' : ''}${reg.dpitch}°, fov x${reg.fov_scale}` : 'not applied'} (edge NCC ${reg.edge_ncc} vs ${reg.edge_ncc_at_clay_pose} at the clay pose, ${reg.edge_ncc_15deg_off} 15° off)`);
  }
  const o = flow.segments.find((s) => s.id === 'orbit'); const ox = Q.segs.find((x) => x.id === 'orbit');
  if (o && ox?.ssim) o.encode = { crf: 21, faststart: true, ssim_vs_source: ox.ssim };
  return { report, flow };
}

// the hand-off registration (card 36): Kling follows the clay camera's motion, not its exact pose, so the last frame of the enter
// clip sits a few degrees off the clay camera. Render the tour's panorama as the clip's camera (yaw/pitch/fov around the clay pose)
// and keep the offset whose EDGES best match the clip's last frame (gradient-magnitude NCC; the furniture differs, Kling's vs the
// tour's, the walls/doors/slider are the plan's). Applied only when it clearly beats the clay pose.
async function registerHandoff(sharp, panoFile, lastJpg, ho, size) {
  const W = 256, H = Math.round((W * size[1]) / size[0]);
  const P = await sharp(panoFile).removeAlpha().resize(1024, 512).greyscale().raw().toBuffer();
  const PW = 1024, PH = 512;
  const clip = await sharp(lastJpg).removeAlpha().resize(W, H, { fit: 'fill' }).greyscale().raw().toBuffer();
  const box = [Math.round(W * 0.06), Math.round(H * 0.15), Math.round(W * 0.94), Math.round(H * 0.8)];     // skip the frame's edges and the bottom (foreground furniture)
  // edge magnitude, box-blurred (r 2, twice) so a 1-2 px misfit still overlaps, standardised over the box
  const blur = (a, w, h, r) => { const o = new Float32Array(a.length); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, n = 0; for (let k = -r; k <= r; k++) { const xx = x + k; if (xx >= 0 && xx < w) { s += a[y * w + xx]; n++; } } o[y * w + x] = s / n; } const o2 = new Float32Array(a.length); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, n = 0; for (let k = -r; k <= r; k++) { const yy = y + k; if (yy >= 0 && yy < h) { s += o[yy * w + x]; n++; } } o2[y * w + x] = s / n; } return o2; };
  const edges = (g) => { let m0 = new Float32Array(W * H); for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; m0[i] = Math.hypot(g[i + 1] - g[i - 1], g[i + W] - g[i - W]); } m0 = blur(blur(m0, W, H, 2), W, H, 2);
    const out = []; for (let y = box[1]; y < box[3]; y++) for (let x = box[0]; x < box[2]; x++) out.push(m0[y * W + x]); const m = out.reduce((a, b) => a + b, 0) / out.length; let v = 0; for (const e of out) v += (e - m) ** 2; const sd = Math.sqrt(v / out.length) || 1; return out.map((e) => (e - m) / sd); };
  const ce = edges(clip);
  const hf = (ho.hfov_deg * Math.PI) / 180, t = Math.tan(hf / 2);
  function render(yawDeg, pitchDeg, k) {
    const g = new Float32Array(W * H), y = (yawDeg * Math.PI) / 180, p = (pitchDeg * Math.PI) / 180, tk = t * k, cy = Math.cos(y), sy = Math.sin(y), cp = Math.cos(p), sp = Math.sin(p);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const dx = ((2 * (i + 0.5)) / W - 1) * tk, dyv = (1 - (2 * (j + 0.5)) / H) * tk * (H / W), n = Math.hypot(dx, dyv, 1);
      const ex = dx / n, ey = dyv / n, ez = 1 / n;
      const ey2 = ey * cp + ez * sp, ez2 = -ey * sp + ez * cp;                    // pitch about x, then yaw about up (clockwise = right)
      const X = ex * cy + ez2 * sy, Z = -ex * sy + ez2 * cy;
      const u = (Math.atan2(X, Z) / (2 * Math.PI) + 0.5) * PW, v = (0.5 - Math.asin(Math.max(-1, Math.min(1, ey2))) / Math.PI) * PH;
      const x0 = Math.floor(u), y0 = Math.min(PH - 2, Math.max(0, Math.floor(v))), fx = u - x0, fy = v - y0, xa = ((x0 % PW) + PW) % PW, xb = (xa + 1) % PW;
      g[j * W + i] = (P[y0 * PW + xa] * (1 - fx) + P[y0 * PW + xb] * fx) * (1 - fy) + (P[(y0 + 1) * PW + xa] * (1 - fx) + P[(y0 + 1) * PW + xb] * fx) * fy;
    }
    return g;
  }
  const score = (dy, dp, k) => { const e = edges(render(ho.start_yaw + dy, ho.start_pitch + dp, k)); let s = 0; for (let i = 0; i < e.length; i++) s += e[i] * ce[i]; return s / e.length; };
  const at0 = score(0, 0, 1);
  let best = { s: -1 };
  for (let dy = -8; dy <= 8; dy += 1) for (let dp = -4; dp <= 3; dp += 1) for (const k of [0.9, 1, 1.1, 1.2, 1.3]) { const s = score(dy, dp, k); if (s > best.s) best = { s, dy, dp, k }; }
  const c = best;
  for (let dy = c.dy - 1; dy <= c.dy + 1.001; dy += 0.25) for (let dp = c.dp - 1; dp <= c.dp + 1.001; dp += 0.5) for (let k = c.k - 0.05; k <= c.k + 0.0501; k += 0.025) { const s = score(dy, dp, k); if (s > best.s) best = { s, dy, dp, k }; }
  const control = score(best.dy + 15, best.dp, best.k);
  const use = best.s >= 0.15 && best.s >= 2 * Math.max(at0, 0.01) && best.s >= control + 0.1;
  return { dyaw: use ? r2(best.dy) : 0, dpitch: use ? r2(best.dp) : 0, fov_scale: use ? r3(best.k) : 1, edge_ncc: r3(best.s), edge_ncc_at_clay_pose: r3(at0), edge_ncc_15deg_off: r3(control), applied: use,
    how: 'the tour panorama rendered as the clip camera (yaw/pitch/fov search around the clay pose), gradient-magnitude NCC vs the last frame of the clip' };
}

function cineCaption(project) {
  // the same caption v1 block as segments.json (card 34): {PROJECT} {PLAN_DATE} filled, {UNIT} left for the player
  const C = CINE[project];
  const proj = readJSON(join(PLATFORM, 'fixtures', project, 'project.json'));
  const cap = readJSON(CAPTION);
  const planDate = planDateOf(join(HABAIT, 'tour360/apartments', C.tourApartment));
  const caption = { id: cap.id, status: cap.status, source: rel(CAPTION), plan_date: planDate };
  for (const l of ['he', 'en']) { const vars = { PROJECT: proj.name?.[l] || proj.name?.he, PLAN_DATE: planDate }; caption[l] = { short_project: fillCaption(cap[l].short_project, vars), micro: fillCaption(cap[l].micro, vars), short: fillCaption(cap[l].short, vars) }; }
  return caption;
}

async function runCine(args, ff) {
  const Q = planCine(args, ff);
  if (!Q) return { code: 0, lines: [`cinematic: no spec for ${args.project}`] };
  const lines = [...Q.lines];
  const caption = cineCaption(args.project);
  if (args.dryRun) {
    const flow = cineFlow(Q, args.project, caption);
    lines.push(`flow.cine.json (${CINE[args.project].flow}) would be written: ${flow.segments.length} segments (${flow.segments.map((s) => s.id).join(' > ')}), ${Object.keys(flow.units).length} unit boxes, caption ${caption.id} plan date ${caption.plan_date}; ${Q.errors.length} error(s), ${Q.warnings.length} warning(s)`);
    for (const w of Q.warnings) lines.push(`warning: ${w}`);
    for (const e of Q.errors) lines.push(`ERROR: ${e}`);
    return { code: Q.errors.length ? 1 : 0, lines };
  }
  if (Q.errors.length) return { code: 1, lines: [...lines, ...Q.errors.map((e) => `ERROR: ${e}`), 'flow.cine.json NOT written'] };
  if (!ff) return { code: 3, lines: [...lines, 'ffmpeg not found'] };
  const { report, flow } = await buildCine(Q, ff, args.project, caption);
  lines.push(...report);
  const target = P_(CINE[args.project].flow);
  writeFileSync(target, JSON.stringify(flow, null, 1) + '\n');
  lines.push(`wrote ${CINE[args.project].flow} (${flow.segments.length} segments: ${flow.segments.map((s) => s.id).join(' > ')}) and ${posix(relative(PLATFORM, Q.out))}/`);
  for (const w of Q.warnings) lines.push(`warning: ${w}`);
  return { code: 0, lines };
}

async function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exit(2); }
  if (args.help || !args.project) { console.log('usage: node tools/build_segments.mjs --project <id> [--dry-run] [--force] [--size 2048x1024] [--crf 20] [--json]\n       cinematic (card 36): [--cine-only | --no-cine] [--manifest <path|engine|dev>] [--hold arc|ring] [--make-dev-manifest]'); process.exit(args.help ? 0 : 2); }
  const ff = findFfmpeg(args.ffmpeg);
  if (args.makeDev) {                                        // card 36: the dev manifest over the existing clips
    if (!ff) { console.error('ffmpeg/ffprobe needed for --make-dev-manifest'); process.exit(3); }
    console.log(makeDevManifest(args.project, ff).join('\n'));
    if (!args.cineOnly && !args.dryRun) process.exit(0);
  }
  if (args.cineOnly) {                                       // card 36: only the cinematic part
    const r = await runCine(args, ff);
    console.log(r.lines.join('\n'));
    process.exit(r.code);
  }
  const cine = args.noCine || !CINE[args.project] ? null : () => runCine(args, ff);
  const P = makePlan(args);
  const lines = describe(P, ff);
  const fr = flowReal(P);
  const { validateSchema, flowSchema, crossCheck } = await import('../contracts/validate.mjs');
  const units = readJSON(join(P.fixtureDir, P.project.units || 'units.json'));
  const schemaErr = validateSchema(flowSchema, fr);
  const xc = crossCheck({ units, flow: fr, project: P.project, dir: args.dryRun ? null : P.fixtureDir });
  if (args.dryRun) {
    lines.push(`flow.real.json (${posix(relative(PLATFORM, join(P.fixtureDir, 'flow.real.json')))}) would be written: flow.v0 ${schemaErr.length ? `${schemaErr.length} schema error(s): ${schemaErr.join('; ')}` : 'valid'}, cross-check ${xc.errors.length} error(s), ${xc.warnings.length} warning(s)`);
    if (args.json) console.log(JSON.stringify({ plan: P.active.map((x) => ({ id: x.spec.id, source: x.source, frames: x.outFrames, head: x.head || null, tail: x.tail || null, handoff: x.handoff || null })), flow: fr }, null, 1));
    else console.log(lines.join('\n'));
    let cineCode = 0;
    if (cine) { const r = await cine().catch((e) => ({ code: 1, lines: [`cinematic: ERROR ${e.message}`] })); cineCode = r.code; if (!args.json) console.log(r.lines.join('\n')); }
    process.exit(schemaErr.length || xc.errors.length || cineCode ? 1 : 0);
  }
  if (!ff) { console.error('ffmpeg not found (set FFMPEG or --ffmpeg)'); process.exit(3); }
  console.log(lines.join('\n'));
  const { report } = await build(P, ff);
  console.log(report.join('\n'));
  // flow.real.json last, once every file it points to exists
  const x2 = crossCheck({ units, flow: fr, project: P.project, dir: P.fixtureDir });
  if (schemaErr.length || x2.errors.length) { console.error('flow.real.json NOT written:', [...schemaErr, ...x2.errors].join('; ')); process.exit(1); }
  const target = join(P.fixtureDir, 'flow.real.json');
  writeFileSync(target, JSON.stringify(fr, null, 2) + '\n');
  console.log(`wrote ${posix(relative(PLATFORM, target))} (${fr.segments.length} segments, ${x2.warnings.length} warning(s)) and ${posix(relative(PLATFORM, join(P.outDir, 'segments.json')))}`);
  if (cine) { const r = await cine(); console.log(r.lines.join('\n')); if (r.code) process.exit(r.code); }   // card 36
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
}
