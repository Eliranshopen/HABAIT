/* pick_views.mjs: the hero view of each room, chosen by an LLM looking at real candidate frames.
   The depth score (tools/view_pick.py → derived/views.json) proposes; this picks. Depth alone faces a bedroom out
   through its door, or a bathroom at a flush plate; an eye does not.

     node tools/pick_views.mjs <project-id> [--panos <dir>] [--n 6] [--dry]

   For every camera point except the living room (whose heading is fixed by the entry walk), the n best-scoring
   headings at least 30° apart are cropped from the skinned pano at the shot's lens, tiled into one numbered sheet
   per room, and one structured LLM call (Claude subscription CLI, or the API, per lib/llm.mjs) picks one per room.
   Writes points[cp].chosen = { yaw_deg, yaw_rel_deg, source, reason } into derived/views.json; the shots stage
   uses it. $0 on the subscription. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { z } from 'zod/v4';
import { loadEnv, REPO, TOOLS } from '../lib/env.mjs';
import { ProjectStore } from '../lib/projects.mjs';
import { structured, imageInput } from '../lib/llm.mjs';
import { findPano } from '../pipeline/stages/keyframes.mjs';

const env = loadEnv();
const args = process.argv.slice(2);
const id = args[0];
const flag = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const N = Number(flag('--n', 6));
const store = new ProjectStore(env.PROJECTS_DIR);
const P = store.paths(id);
const meta = store.meta(id);
let panos = flag('--panos', meta.options?.panos_dir);
if (panos && !path.isAbsolute(panos)) panos = path.join(REPO, panos);
const views = store.derived(id, 'views.json');
const plan = store.derived(id, 'plan.json');
const shots = store.derived(id, 'shots.json');
if (!views || !plan) { console.error('views.json / plan.json missing (run tools/view_pick.py first)'); process.exit(2); }
const livingRoom = shots?.entry?.living_room;
const outDir = path.join(P.derived, '.cache', 'views');
fs.mkdirSync(outDir, { recursive: true });

const inputs = [];
const roster = [];
for (const [cp, v] of Object.entries(views.points)) {
  const c = plan.camera_points.find((x) => x.id === cp);
  if (!c || c.room_id === livingRoom) continue;
  const pano = findPano(panos, cp);
  if (!pano) continue;
  // n candidates: best scores first, at least 30° apart
  const cands = [];
  for (const r of [...v.scores].sort((a, b) => b.score - a.score)) {
    if (cands.every((q) => Math.abs(((q.yaw_rel_deg - r.yaw_rel_deg + 540) % 360) - 180) >= 30)) cands.push(r);
    if (cands.length === N) break;
  }
  const tiles = [];
  cands.forEach((r, i) => {
    const out = path.join(outDir, `${cp}-${i + 1}.png`);
    spawnSync(env.PYTHON, ['-I', path.join(TOOLS, 'pano_crop.py'), pano, out, '--yaw-rel', String(r.yaw_rel_deg), '--pitch', String(views.pitch_deg ?? -1.4), '--fov-h', String(views.fov_h_deg ?? 73.7), '--width', '480', '--height', '270'], { encoding: 'utf8' });
    tiles.push(out);
  });
  const sheet = path.join(outDir, `${cp}-sheet.jpg`);
  const filt = tiles.map((_, i) => `[${i}:v]drawtext=fontfile='C\\:/Windows/Fonts/arialbd.ttf':text='${i + 1}':fontcolor=yellow:fontsize=44:box=1:boxcolor=black@0.6:boxborderw=8:x=12:y=10[v${i}]`).join(';');
  const layout = tiles.map((_, i) => `${(i % 3) * 480}_${Math.floor(i / 3) * 270}`).join('|');
  spawnSync(env.FFMPEG, ['-nostdin', '-y', '-loglevel', 'error', ...tiles.flatMap((t) => ['-i', t]), '-filter_complex', `${filt};${tiles.map((_, i) => `[v${i}]`).join('')}xstack=inputs=${tiles.length}:layout=${layout}:fill=black`, sheet]);
  const room = plan.rooms.find((r) => r.id === c.room_id) || {};
  roster.push({ cp, room: room.name_en || c.room_id, cands });
  inputs.push(imageInput(sheet, P.dir, `${cp} — ${room.name_en || c.room_id} (${room.name_he || ''}): candidates 1-${cands.length}`));
}
console.log(`${roster.length} rooms, sheets in ${outDir}`);
if (args.includes('--dry')) process.exit(0);

const schema = z.object({
  picks: z.array(z.object({ camera_point: z.string(), choice: z.number().int().min(1).max(N), reason: z.string() })),
});
const system = 'You are a senior real-estate cinematographer choosing the opening frame of a short walk-through clip for each room of a luxury apartment.';
const task = `Each image is one room's contact sheet: numbered candidate frames (1-${N}), all taken from the same standing point at eye height, only the heading differs.
For EVERY room pick the single best opening frame for a real-estate video: it should read instantly as that room (bed for a bedroom, vanity/shower for a bathroom, wardrobe for a dressing room, the view for a terrace), show depth and natural light, and feel inviting.
Avoid: a blank wall or a closed door filling the frame, a toilet as the subject, a frame that is only sky or only the view with nothing of the room, a frame looking out through the room's own doorway into a corridor.
Rooms: ${roster.map((r) => `${r.cp} (${r.room})`).join(', ')}.
Answer with one pick per camera point.`;
const res = await structured({ env, log: (l) => console.log(' ', l), dir: P.dir, inputs, system, task, schema });
if (!res.ok) { console.error('LLM failed:', res.note); process.exit(1); }
for (const p of res.data.picks) {
  const r = roster.find((x) => x.cp === p.camera_point);
  const c = r?.cands[p.choice - 1];
  if (!c) continue;
  views.points[p.camera_point].chosen = { yaw_deg: c.yaw_deg, yaw_rel_deg: c.yaw_rel_deg, source: `llm (${res.backend} ${res.model}) of ${r.cands.length}`, reason: p.reason };
  console.log(`${p.camera_point.padEnd(18)} #${p.choice} yaw ${c.yaw_deg} — ${p.reason.slice(0, 110)}`);
}
views.llm = { at: new Date().toISOString(), backend: res.backend, model: res.model, usd: res.usd || 0 };
store.saveDerived(id, 'views.json', views);
