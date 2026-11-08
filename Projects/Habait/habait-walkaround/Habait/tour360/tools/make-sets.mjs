#!/usr/bin/env node
/* Habait Tour360 — tools/make-sets.mjs (apt846, 2026-10-28). The web picture sets of a generated apartment, from the generator's
   answers: for every scene in apartments/<id>/scenes.json, the chosen PNG in _local/generated/ → panos/balanced/<asset>.webp
   (apartment.json sets.balanced width, q92, tracked) · panos/thumb/<asset>.webp (sets.thumb, q80) · <sets.full.dir>/<asset>.webp
   (the native size, q90, untracked) when apartment.json has a full set. The pick: _local/picks.json {asset: file} if present,
   else the newest `<asset>__<model>__*.png` for --model (default gpt25x). Prints every pick so a person can check it.
     node Habait/tour360/tools/make-sets.mjs <apartment> [--model gpt25x] [--only <asset>]
   $0; sharp from the Habait app (app-require.mjs). The PNG answers are never modified.
   v3 (2026-10-29, WALKAROUND-QUALITY-PLAN.md OQ-2): the THUMB is a perspective crop — the room as the visitor first sees it (the
   panorama's centre, 95° across at the thumb's 2:1 shape, a touch below level), cut with tools/pano-geometry.mjs's own maths — not
   the whole equirect squeezed into 640×320, which read as a fisheye in the room strip. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appRequire } from './app-require.mjs';
import { loadPano, render } from './pano-geometry.mjs';
const THUMB_VIEW = { yaw: 0, pitch: -3, hfov: 95 };

const TOOLS = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TOOLS, '..');
const REPO = path.resolve(ROOT, '..', '..');
const sharp = appRequire(REPO)('sharp');

const id = process.argv[2];
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const modelKey = arg('--model', 'gpt25x');
const only = arg('--only', null);
if (!id) { console.error('usage: make-sets.mjs <apartment> [--model gpt25x] [--only <asset>]'); process.exit(2); }
const APT = path.join(ROOT, 'apartments', id);
const apartment = JSON.parse(fs.readFileSync(path.join(APT, 'apartment.json'), 'utf8'));
const scenes = JSON.parse(fs.readFileSync(path.join(APT, 'scenes.json'), 'utf8')).scenes;
const GEN = path.join(APT, '_local', 'generated');
const picksFile = path.join(APT, '_local', 'picks.json');
const picks = fs.existsSync(picksFile) ? JSON.parse(fs.readFileSync(picksFile, 'utf8')) : {};

const pick = (asset) => {
  if (picks[asset]) return path.join(GEN, picks[asset]);
  const c = fs.readdirSync(GEN).filter((f) => f.startsWith(`${asset}__${modelKey}__`) && f.endsWith('.png') && !f.endsWith('.raw.png'))
    .map((f) => ({ f, t: fs.statSync(path.join(GEN, f)).mtimeMs })).sort((a, b) => b.t - a.t);
  return c.length ? path.join(GEN, c[0].f) : null;
};

const sets = apartment.sets;
for (const k of ['balanced', 'thumb']) fs.mkdirSync(path.join(APT, sets[k].dir), { recursive: true });
if (sets.full) fs.mkdirSync(path.join(APT, sets.full.dir), { recursive: true });
let n = 0, missing = [];
for (const s of scenes) {
  if (only && s.asset !== only) continue;
  const src = pick(s.asset);
  if (!src) { missing.push(s.asset); continue; }
  const meta = await sharp(src).metadata();
  if (Math.abs(meta.width / meta.height - 2) > 0.01) { console.error(`${s.asset}: ${meta.width}x${meta.height} is not 2:1`); process.exit(1); }
  const b = await sharp(src).resize({ width: sets.balanced.width, height: sets.balanced.height, fit: 'fill' }).webp({ quality: 92 }).toFile(path.join(APT, sets.balanced.dir, `${s.asset}.webp`));
  const pano = await loadPano(sharp, src);
  const tw = sets.thumb.width, th = sets.thumb.height;
  const t = await sharp(render(pano, THUMB_VIEW.yaw + (Number(s.heading) || 0), THUMB_VIEW.pitch, THUMB_VIEW.hfov, tw, th), { raw: { width: tw, height: th, channels: 3 } }).webp({ quality: 80 }).toFile(path.join(APT, sets.thumb.dir, `${s.asset}.webp`));
  let f = null;
  if (sets.full) f = await sharp(src).resize({ width: sets.full.width, height: sets.full.height, fit: 'fill' }).webp({ quality: 90 }).toFile(path.join(APT, sets.full.dir, `${s.asset}.webp`));
  n++;
  console.log(`${s.asset.padEnd(20)} ← ${path.basename(src)} ${meta.width}x${meta.height} → balanced ${(b.size / 1024).toFixed(0)} KB · thumb ${(t.size / 1024).toFixed(0)} KB${f ? ` · full ${(f.size / 1024).toFixed(0)} KB` : ''}`);
}
// (2026-11-05) a scene without an answer (the exterior nodes) no longer ends the run before the ORIGINAL set below: it did, so the
// originals were never rewritten on a full run and the stale draft renders shipped
if (missing.length) { console.error(`no answer yet for: ${missing.join(', ')}`); if (missing.length === scenes.length) process.exitCode = 1; }
console.log(`make-sets: ${n} of ${scenes.length} scenes written`);
// v2 (card Q09, D-WQ-27): the ORIGINAL set — the plain CG render each designed picture was skinned from, one per scene, from
// the pipeline's renders/<cp-id>/pano.webp (the draft 4096x2048 until Q05's 8K finals replace them), written at the balanced
// size into apartment.json's sets.original.dir so build-tour carries it as panos-original/ and the page shows the switch.
if (sets.original) {
  // the FINAL render folder (2026-11-05, the coordinator): apartment.json sets.original.cg_tour names the tour whose renders the skins and the
  // gate use (apt846: apt846-furnished); the tour named after the apartment held the 2026-10-28 draft pass and shipped stale originals
  const cgTour = arg('--cg-tour', sets.original.cg_tour || id);
  const rdir = arg('--original', path.resolve(REPO, '360walkaround', 'tours', cgTour, 'renders'));
  fs.mkdirSync(path.join(APT, sets.original.dir), { recursive: true });
  let m = 0; const absent = [];
  for (const s of scenes) {
    if (only && s.asset !== only) continue;
    const src = path.join(rdir, `cp-${s.id}`, 'pano.webp');
    if (!fs.existsSync(src)) { absent.push(s.asset); continue; }
    const o = await sharp(src).resize({ width: sets.original.width, height: sets.original.height, fit: 'fill' }).webp({ quality: 92 }).toFile(path.join(APT, sets.original.dir, `${s.asset}.webp`));
    m++; console.log(`${s.asset.padEnd(20)} ← original ${path.relative(REPO, src)} → ${(o.size / 1024).toFixed(0)} KB`);
  }
  if (absent.length) console.error(`no CG render yet for: ${absent.join(', ')}`);
  console.log(`make-sets: original set ${m} of ${scenes.length} written to ${sets.original.dir}`);
}
