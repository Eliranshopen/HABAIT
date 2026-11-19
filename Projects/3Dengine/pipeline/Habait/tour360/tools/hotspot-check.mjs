#!/usr/bin/env node
/* Habait Tour360 — tools/hotspot-check.mjs (R23b, 2026-11-06: Eliran found the LIVE 02-kitchen "כניסה" hotspot on the fridge's face).
   $0, no call. Every room scene's hotspot is looked up in the CG depth of its camera (tools/hotspot-hit.mjs, the same model make-scenes
   places with): floor / opening / glass = ok; a FIXTURE face or a wall = FAIL (exit 1). Rows → apartments/<id>/_local/fidelity/hotspots.json.
   usage: node Habait/tour360/tools/hotspot-check.mjs apt846 [--renders <dir with cp-<cam>/depth.png>] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appRequire } from './app-require.mjs';
import { avoidFor, hitModel, rendersDir } from './hotspot-hit.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOUR = path.resolve(HERE, '..');
const REPO = path.resolve(TOUR, '..', '..');
const sharp = appRequire(REPO)('sharp');
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const id = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--renders');
if (!id) { console.error('usage: hotspot-check.mjs <apartment> [--renders <dir>]'); process.exit(2); }
const APT = path.join(TOUR, 'apartments', id);
const plan = JSON.parse(fs.readFileSync(path.join(APT, 'plan.general.json'), 'utf8'));
const scenes = JSON.parse(fs.readFileSync(path.join(APT, 'scenes.json'), 'utf8')).scenes;
const cgTour = (() => { try { return JSON.parse(fs.readFileSync(path.join(APT, 'apartment.json'), 'utf8')).sets?.original?.cg_tour; } catch { return null; } })() || id;
const RENDERS = rendersDir(REPO, cgTour, flag('--renders'));
if (!RENDERS) { console.error(`hotspot-check: no CG renders with depth.png for ${cgTour}`); process.exit(2); }
const rows = []; let bad = 0, skipped = 0;
for (const s of scenes.filter((x) => !x.exterior)) {
  const cam = plan.camera_points.find((c) => c.id.toLowerCase() === `cp-${s.id}`.toLowerCase());
  const m = cam && await hitModel(sharp, plan, cam, RENDERS, avoidFor(TOUR, s.asset));
  if (!m) { console.log(`${s.id}: no camera or no depth.png — skipped`); skipped++; continue; }
  for (const h of s.hotspots) {
    const r = m.hit(s.centreBearingDeg, h.u, h.v);
    // a hand-placed exterior link (exterior.json backFrom: out over the terrace railing to the building's exterior nodes) is not a door
    // marker and make-scenes does not place it: reported, never failed, unless it sits on a FIXTURE
    if (!r.ok && String(h.source).startsWith('exterior.json') && !r.what.startsWith('FIXTURE')) { r.ok = true; r.what = `exempt: ${r.what} (exterior.json hand-placed link out)`; }
    if (!r.ok) bad++;
    rows.push({ scene: s.id, asset: s.asset, to: h.to, u: h.u, v: h.v, ...r, source: h.source });
    console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${s.id.padEnd(15)} → ${h.to.padEnd(15)} u ${h.u} v ${h.v} · ${r.depth_cm} cm, ${r.height_cm} cm up · ${r.what}`);
  }
}
const out = path.join(APT, '_local', 'fidelity', 'hotspots.json'); fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ $schema: 'tour360/hotspots-check.v1', at: new Date().toISOString(), renders: RENDERS, rows }, null, 1));
console.log(`hotspots: ${rows.length - bad}/${rows.length} on floor / an opening / glass${bad ? `; ${bad} FAIL` : ''}${skipped ? `; ${skipped} scene(s) without depth` : ''} → ${path.relative(APT, out)}`);
process.exit(bad || skipped ? 1 : 0);
