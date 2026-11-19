// round 3: the parquet set of every room with a wooden floor = floor_planks.py on its floor-only answer (01-08) or on the shipped
// parquet picture (10); the two bathrooms keep their stone tile in the parquet finish (no wood in a shower). Then all three sets of
// 05-08 are written from their floor-only answers. $0.
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process'; import { createRequire } from 'node:module';
const sharp = createRequire('C:/RnD/Projects/Habait/tools/appdeps/package.json')('sharp');
const REPO = 'C:/RnD/Projects/Habait/habait-walkaround', APT = REPO + '/Habait/tour360/apartments/apt846', GEN = APT + '/_local/generated';
const picks = JSON.parse(fs.readFileSync(APT + '/_local/picks.json', 'utf8'));
const plan = JSON.parse(fs.readFileSync(APT + '/plan.general.json', 'utf8'));
const CAM = { '01-entrance': 'cp-entrance', '02-kitchen': 'cp-kitchen', '03-dining': 'cp-dining', '04-living': 'cp-living', '05-terrace-living': 'cp-terraceLiving', '06-terrace-bedroom': 'cp-terraceBedroom', '07-bedroom-main': 'cp-bedroomMain', '08-wardrobe': 'cp-wardrobe', '10-bedroom-2': 'cp-bedroom2' };
const PY = 'C:/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe';
const answerOf = (id, fl) => fs.readdirSync(GEN).find((f) => new RegExp(`^${id}__floor-${fl}__gpt25__s(61|71)__[0-9a-f]{12}\\.png$`).test(f));
const put = async (png, fl, id, meta) => {
  const webp = `${APT}/_local/panos-${fl}/${id}.webp`;
  await sharp(png).resize({ width: 2048, height: 1024, fit: 'fill' }).webp({ quality: 90 }).toFile(webp);
  fs.writeFileSync(webp.replace(/\.webp$/, '.source.json'), JSON.stringify({ ...meta, source: picks[id], at: new Date().toISOString() }, null, 1));
};
for (const [id, cam] of Object.entries(CAM)) {
  const cp = plan.camera_points.find((c) => c.id === cam);
  let answer = answerOf(id, 'parquet');
  if (!answer) {   // 10-bedroom-2: the shipped parquet picture, as a PNG beside the answers
    answer = `${id}__floor-parquet__shipped-before-r3.png`;
    if (!fs.existsSync(path.join(GEN, answer))) await sharp(`${APT}/_local/round3/finish-backup-10.webp`).png().toFile(path.join(GEN, answer));
  }
  const out = path.join(GEN, `${id}__floor-parquet__planks-r3.png`);
  const r = spawnSync(PY, [REPO + '/Habait/tour360/tools/floor_planks.py', path.join(GEN, picks[id]), path.join(GEN, answer), String(cp.yaw_deg), String(cp.z), out, '--delta', '3', '--wood-b', '10'], { encoding: 'utf8' });
  if (r.status !== 0) { console.error(id, r.stderr.slice(-400)); process.exit(1); }
  await put(out, 'parquet', id, { answer, picture: path.basename(out), composite: 'round 3 (2026-11-10): floor_planks.py — the planks laid on the true floor plane (straight, one direction through the apartment, no wrap join), the light from the floor-only gpt25 answer' });
  console.log('parquet', id, r.stdout.trim().slice(-30));
}
for (const id of ['05-terrace-living', '06-terrace-bedroom', '07-bedroom-main', '08-wardrobe']) for (const fl of ['concrete', 'marble']) {
  const answer = answerOf(id, fl);
  await put(path.join(GEN, answer), fl, id, { answer, composite: 'none: round 3 (2026-11-10) — a floor-ONLY gpt25 edit of the corrected pick (_local/round3/floor-prompts.json), used whole' });
  console.log(fl, id, answer);
}
for (const id of ['09-bath-main', '11-bath-guest']) {
  await put(path.join(GEN, picks[id]), 'parquet', id, { answer: picks[id], composite: 'round 3 (2026-11-10): a bathroom keeps its stone tile in the parquet finish (no wooden floor inside a shower) — the pick itself' });
  console.log('parquet', id, '= pick');
}
