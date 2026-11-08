/* Habait Studio — the one test run: node test/run.mjs  (zero deps, exits 1 on any failure) */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ProjectStore, slugify } from '../lib/projects.mjs';
import { planShots, mainFacadeNormal, centroid, toWorld } from '../pipeline/stages/shots.mjs';
import { cpSlug, findPano, loadPresets } from '../pipeline/stages/keyframes.mjs';
import { estimateUsd, ltxFrames } from '../pipeline/stages/video.mjs';
import { buildingsFromOverpass, toLocal } from '../pipeline/stages/site.mjs';
import { IntakeSchema } from '../pipeline/stages/intake.mjs';
import { STAGE_IDS } from '../pipeline/index.mjs';
import { readDotenv, STUDIO, REPO } from '../lib/env.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log(`  ok   ${name}`); } catch (e) { fail++; console.log(`  FAIL ${name}: ${e.message}`); } }
function eq(a, b, msg = '') { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); }
function near(a, b, tol, msg = '') { if (Math.abs(a - b) > tol) throw new Error(`${msg} ${a} !~ ${b}`); }

console.log('habait-studio tests');
t('stage order is fixed', () => eq(STAGE_IDS, ['intake', 'site', 'plan', 'shots', 'scene', 'clay', 'keyframes', 'video', 'assemble']));
t('slugify keeps hebrew and ascii', () => { eq(slugify('Rainbow TLV · דירה 846'), 'rainbow-tlv-דירה-846'); eq(slugify(''), 'project'); });
t('dotenv parses quotes and comments', () => {
  const f = path.join(os.tmpdir(), `hs-${process.pid}.env`); fs.writeFileSync(f, '# c\nA=1\nB="two words"\nC=\'x\'\n'); const d = readDotenv(f); fs.unlinkSync(f); eq(d, { A: '1', B: 'two words', C: 'x' });
});
t('project store round trip', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hs-store-'));
  const s = new ProjectStore(root);
  const p = s.create({ name: 'Test · בדיקה', address: 'x' });
  eq(s.list().length, 1); eq(s.meta(p.id).style, 'tlv-golden-hour');
  s.addFile(p.id, 'a.txt', Buffer.from('hi')); eq(s.files(p.id)[0].name, 'a.txt');
  s.setStage(p.id, 'intake', { status: 'done' }); eq(s.state(p.id).stages.intake.status, 'done');
  s.spend(p.id, { usd: 0.25 }); s.spend(p.id, { usd: 0.5 }); near(s.ledgerTotal(p.id), 0.75, 1e-9);
  s.saveMeta(p.id, { options: { panos_dir: 'p' } }); eq(s.meta(p.id).options.panos_dir, 'p'); eq(s.meta(p.id).options.clay.res, '640x360');
  fs.rmSync(root, { recursive: true, force: true });
});
t('centroid and world frame', () => { eq(centroid([[0, 0], [100, 0], [100, 100], [0, 100]]), [50, 50]); eq(toWorld([100, 200], 160), [1, -2, 1.6]); });
t('facade normal points outward', () => {
  const plan = { panes: [{ kind: 'facade', polygon_cm: [[0, 1000], [1000, 1000], [1000, 1010], [0, 1010]] }] };
  const n = mainFacadeNormal(plan, [500, 500]); near(n[0], 0, 1e-6); near(n[1], 1, 1e-6, 'normal +y (down the plan)');
});
t('shots from a toy plan', () => {
  const plan = { plan_meta: { ceiling_height_cm: 290, ground_offset_cm: -5120 }, rooms: [{ id: 'r1', type: 'living', is_outdoor: false, loop: [[0, 0], [800, 0], [800, 600], [0, 600]] }, { id: 'r2', type: 'balcony', is_outdoor: true, loop: [[0, 600], [800, 600], [800, 900], [0, 900]] }],
    walls: [{ kind: 'exterior', polygon_cm: [[0, 0], [800, 0], [800, 20], [0, 20]] }], panes: [{ kind: 'facade', polygon_cm: [[0, 590], [800, 590], [800, 600], [0, 600]] }],
    openings: [{ id: 'o-7', kind: 'door', rooms: ['r1', 'r2'], centre_cm: [400, 595], width_cm: 120 }], camera_points: [{ id: 'cp-living', room_id: 'r1', x: 400, y: 300, z: 160, yaw_deg: 180 }] };
  const s = planShots(plan, null, { fps: 24 });
  eq(s.shots.map((x) => x.id), ['ext-approach', 'ext-facade', 'ext-enter', 'room-living', 'ext-flight']);
  const fl = s.shots[4]; eq(fl.kind, 'flight'); eq(fl.frames, 409); eq(fl.keys.length, 409); eq(fl.easing, 'linear');
  eq(fl.keys[0].pos, s.shots[0].keys[0].pos, 'the flight starts where the approach starts'); eq(fl.keys.at(-1).pos, s.shots[3].keys[0].pos, 'the flight lands on the living hero view');
  for (const [a, b] of fl.segments) if ((b - a) % 8 !== 0 || b - a + 1 > 137) throw new Error(`flight segment ${a}-${b}`);
  eq(s.entry.id, 'o-7'); eq(s.shots[2].hide, ['o-7']); eq(s.ground_offset_cm, -5120);
  const first = s.shots[0].keys[0].pos; if (!(first[1] < -20)) throw new Error(`approach should start far out past the facade: ${first}`);
  near(s.shots[3].keys[0].pos[2], 1.6, 1e-9, 'room eye height');
  // the living room looks from its door (o-7 at y=595) toward its centre (y=300): up the plan, so yaw 0
  // the living room looks within 40° of its arrival line (door o-7 → centre is yaw 0); the pano crop turns by yaw_rel
  if (Math.abs(((s.shots[3].yaw_deg + 540) % 360) - 180) > 40) throw new Error(`living yaw ${s.shots[3].yaw_deg} strays > 40° from the arrival line`);
  near(((s.shots[3].yaw_deg - 180 - s.shots[3].yaw_rel_deg + 720) % 360), 0, 1e-6, 'yaw_rel = yaw - pano yaw');
  eq(s.shots[2].keys[2].pos, s.shots[3].keys[0].pos, 'the seam ends where the living shot starts');
  eq(s.shots[1].keys.at(-1).pos, s.shots[2].keys[0].pos, 'the facade arc ends where the entry walk starts'); eq(s.shots[0].keys.at(-1).pos, s.shots[1].keys[0].pos, 'the approach ends where the arc starts');
  near(s.shots[3].keys[0].pos[0], 4, 1e-9, 'room shot starts ON the camera point'); near(s.shots[3].keys[0].pos[1], -3, 1e-9);
  near(s.shots[2].keys[0].pos[1], -(595 + 300 - 40) / 100 + 0, 0.6, 'the walk starts out on the balcony, square to the door');
});
t('shots on the real 846 plan', () => {
  const file = path.join(REPO, 'Habait', 'tour360', 'apartments', 'apt846', 'plan.general.json');
  if (!fs.existsSync(file)) return;
  const plan = JSON.parse(fs.readFileSync(file, 'utf8'));
  const s = planShots(plan, null, {});
  eq(s.shots.length, 4 + plan.camera_points.length); eq(s.entry?.id, 'o-5', 'the living room slider, not the bedroom door'); eq(s.entry?.kind, 'terrace-opening');
  if (!s.shots.find((x) => x.id === 'room-living')) throw new Error('no room-living');
});
t('cp slug and pano match', () => {
  eq(cpSlug('cp-bathMain'), 'bath-main'); eq(cpSlug('cp-bedroom2'), 'bedroom-2'); eq(cpSlug('cp-terraceLiving'), 'terrace-living'); eq(cpSlug('cp-bathguest'), 'bathguest');
  const dir = path.join(REPO, 'Habait', 'tour360', 'apartments', 'apt846', 'panos', 'balanced');
  if (fs.existsSync(dir)) { if (!/04-living\.webp$/.test(findPano(dir, 'cp-living'))) throw new Error('living pano'); if (!/11-bath-guest\.webp$/.test(findPano(dir, 'cp-bathguest') || '')) throw new Error('bathguest pano'); }
});
t('every shot is 8k+1 frames within the 720p budget', () => {
  const plan = JSON.parse(fs.readFileSync(path.join(REPO, 'Habait', 'tour360', 'apartments', 'apt846', 'plan.general.json'), 'utf8'));
  for (const s of planShots(plan, null, {}).shots) { if (s.kind === 'flight') continue; const n = Math.round(s.duration_s * 24); if ((n - 1) % 8 !== 0 || n > 137 || ltxFrames(s.duration_s, 24) !== n) throw new Error(`${s.id}: ${n} frames`); }
});
t('video pricing', () => { near(estimateUsd('720p', 121, false), 0.2696, 0.001); eq(ltxFrames(5, 24), 121); eq(ltxFrames(7, 24), 169); });
t('overpass → local metres', () => {
  const local = toLocal(32.11, 34.78);
  const r = buildingsFromOverpass([{ type: 'way', id: 1, tags: { building: 'apartments', 'building:levels': '9' }, geometry: [{ lat: 32.11, lon: 34.78 }, { lat: 32.1101, lon: 34.78 }, { lat: 32.1101, lon: 34.7801 }] },
    { type: 'way', id: 2, tags: { natural: 'coastline' }, geometry: [{ lat: 32.11, lon: 34.77 }] }], local);
  eq(r.buildings.length, 1); near(r.buildings[0].height_m, 27.9, 0.01); eq(r.coast.length, 1); near(r.buildings[0].footprint_m[1][1], 11.12, 0.2, 'one 0.0001° step north ≈ 11 m');
});
t('presets are well-formed', () => {
  const p = loadPresets(); if (p.presets.length < 6) throw new Error('too few'); const ids = new Set(p.presets.map((x) => x.id)); if (!ids.has(p.defaults.tower_exterior)) throw new Error('default missing');
  for (const x of p.presets) for (const k of ['id', 'name_he', 'name_en', 'prompt_fragment', 'fov_mm', 'camera']) if (!(k in x)) throw new Error(`${x.id} lacks ${k}`);
});
t('fixture matches IntakeSchema', () => { const fx = JSON.parse(fs.readFileSync(path.join(STUDIO, 'fixtures', 'apt846.intake.json'), 'utf8')); const r = IntakeSchema.safeParse(fx); if (!r.success) throw new Error(JSON.stringify(r.error.issues[0])); });

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
