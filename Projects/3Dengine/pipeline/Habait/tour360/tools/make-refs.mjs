#!/usr/bin/env node
/* Habait Tour360 — tools/make-refs.mjs (apt846, 2026-10-28). The generator's plan references for a NEW apartment, from one
   camera table: apartments/<id>/cameras.json (scenes with `at` and `lookAt` in the plan crop's pixel space) → for every scene a
   square crop of the plan centred on the camera with a red dot (the camera) and a red arrow (the direction at the CENTRE of the
   panorama), written to apartments/<id>/_local/refs/plan-<asset>.png — the apartment-37 recipe (2026-10-15), now a tool.
   Also writes apartments/<id>/plan/floorplan.webp (the viewer's plan sheet = the crop scaled by cameras.plan.planScale).
     node Habait/tour360/tools/make-refs.mjs <apartment> [--only <sceneId>] [--no-sheet]
   $0; sharp is borrowed from the Habait app (app-require.mjs). Originals are never modified. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appRequire } from './app-require.mjs';

const TOOLS = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TOOLS, '..');
const REPO = path.resolve(ROOT, '..', '..');
const sharp = appRequire(REPO)('sharp');

const id = process.argv[2];
const only = (() => { const i = process.argv.indexOf('--only'); return i > 0 ? process.argv[i + 1] : null; })();
if (!id) { console.error('usage: make-refs.mjs <apartment> [--only <sceneId>] [--no-sheet]'); process.exit(2); }
const APT = path.join(ROOT, 'apartments', id);
const cams = JSON.parse(fs.readFileSync(path.join(APT, 'cameras.json'), 'utf8'));
const planFile = path.resolve(APT, cams.plan.crop);
const meta = await sharp(planFile).metadata();
if (meta.width !== cams.plan.width || meta.height !== cams.plan.height) { console.error(`plan crop is ${meta.width}x${meta.height}, cameras.json says ${cams.plan.width}x${cams.plan.height}`); process.exit(1); }
const WIN = cams.refWindowPx || 1600;
const OUT = path.join(APT, '_local', 'refs');
fs.mkdirSync(OUT, { recursive: true });

export const bearingDeg = (from, to) => ((Math.atan2(to[0] - from[0], -(to[1] - from[1])) * 180) / Math.PI + 360) % 360; // 0 = up, clockwise

for (const s of cams.scenes) {
  if (only && s.id !== only) continue;
  const [ax, ay] = s.at;
  const left = Math.max(0, Math.min(meta.width - WIN, Math.round(ax - WIN / 2)));
  const top = Math.max(0, Math.min(meta.height - WIN, Math.round(ay - WIN / 2)));
  const w = Math.min(WIN, meta.width - left), h = Math.min(WIN, meta.height - top);
  const cx = ax - left, cy = ay - top;
  const b = bearingDeg(s.at, s.lookAt);
  const L = Math.round(WIN * 0.17);
  const rad = (b * Math.PI) / 180;
  const tx = cx + Math.sin(rad) * L, ty = cy - Math.cos(rad) * L;
  // arrow head
  const hx1 = tx - Math.sin(rad - 0.45) * 60, hy1 = ty + Math.cos(rad - 0.45) * 60;
  const hx2 = tx - Math.sin(rad + 0.45) * 60, hy2 = ty + Math.cos(rad + 0.45) * 60;
  const label = `CAMERA ${cams.eye_m || 1.6} m — arrow = view centre`;
  const lx = Math.min(w - 40, Math.max(40, cx)), ly = cy > 160 ? cy - 70 : cy + 110;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <line x1="${cx}" y1="${cy}" x2="${tx}" y2="${ty}" stroke="#e01b24" stroke-width="16" stroke-linecap="round"/>
  <polygon points="${tx},${ty} ${hx1},${hy1} ${hx2},${hy2}" fill="#e01b24"/>
  <circle cx="${cx}" cy="${cy}" r="28" fill="#e01b24" stroke="#ffffff" stroke-width="6"/>
  <text x="${lx}" y="${ly}" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="bold" fill="#e01b24" text-anchor="middle" stroke="#ffffff" stroke-width="8" paint-order="stroke">${label}</text>
</svg>`;
  const out = path.join(OUT, `plan-${s.asset}.png`);
  await sharp(planFile).extract({ left, top, width: w, height: h }).composite([{ input: Buffer.from(svg), left: 0, top: 0 }]).png().toFile(out);
  console.log(`${s.id}: ref ${path.relative(ROOT, out)} ${w}x${h}, camera at (${ax},${ay}) bearing ${b.toFixed(1)}°`);
}

if (!process.argv.includes('--no-sheet') && !only) {
  const sheet = path.join(APT, cams.plan.sheet);
  fs.mkdirSync(path.dirname(sheet), { recursive: true });
  const sw = Math.round(meta.width * cams.plan.planScale);
  const r = await sharp(planFile).resize({ width: sw }).webp({ quality: 86 }).toFile(sheet);
  console.log(`plan sheet ${path.relative(ROOT, sheet)} ${r.width}x${r.height} (${(r.size / 1024).toFixed(0)} KB)`);
}
