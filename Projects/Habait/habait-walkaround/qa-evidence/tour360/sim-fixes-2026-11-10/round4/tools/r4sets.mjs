// round 4: write the floor sets of 01-05 from the round-4 pictures (01: fresh floor-only answers, parquet through floor_planks.py;
// 02-05: the round-2/3 floor pictures with the door / lounger polygon pasted). $0.
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process'; import { createRequire } from 'node:module';
const sharp = createRequire('C:/RnD/Projects/Habait/tools/appdeps/package.json')('sharp');
const REPO = 'C:/RnD/Projects/Habait/habait-walkaround', APT = REPO + '/Habait/tour360/apartments/apt846', GEN = APT + '/_local/generated';
const picks = JSON.parse(fs.readFileSync(APT + '/_local/picks.json', 'utf8'));
const put = async (png, fl, id, note) => {
  const webp = `${APT}/_local/panos-${fl}/${id}.webp`;
  fs.mkdirSync(APT + '/_local/round4/finish-backup', { recursive: true }); const bk = `${APT}/_local/round4/finish-backup/${fl}--${id}.webp`; if (!fs.existsSync(bk)) fs.copyFileSync(webp, bk);
  await sharp(path.join(GEN, png)).resize({ width: 2048, height: 1024, fit: 'fill' }).webp({ quality: 90 }).toFile(webp);
  fs.writeFileSync(webp.replace(/\.webp$/, '.source.json'), JSON.stringify({ picture: png, source: picks[id], composite: note, at: new Date().toISOString() }, null, 1));
  console.log(fl, id, png);
};
// 01: parquet = planks on the fresh floor-only answer; concrete / marble = the answers whole
const a01 = (fl) => fs.readdirSync(GEN).find((f) => new RegExp(`^01-entrance__floor-${fl}__gpt25__s81__[0-9a-f]{12}\\.png$`).test(f));
const r = spawnSync('C:/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe', [REPO + '/Habait/tour360/tools/floor_planks.py', path.join(GEN, picks['01-entrance']), path.join(GEN, a01('parquet')), '105.9', '160', path.join(GEN, '01-entrance__floor-parquet__r4.png'), '--delta', '3', '--wood-b', '10'], { encoding: 'utf8' });
if (r.status !== 0) { console.error(r.stderr.slice(-400)); process.exit(1); }
await put('01-entrance__floor-parquet__r4.png', 'parquet', '01-entrance', 'round 4 (2026-11-10): floor_planks.py on a floor-only gpt25 answer of the pick with the white zero-line front door');
for (const fl of ['concrete', 'marble']) await put(a01(fl), fl, '01-entrance', 'round 4 (2026-11-10): a floor-only gpt25 edit of the pick with the white zero-line front door, used whole');
for (const id of ['02-kitchen', '03-dining', '04-living', '05-terrace-living']) for (const fl of ['parquet', 'concrete', 'marble'])
  await put(`${id}__floor-${fl}__r4.png`, fl, id, 'round 4 (2026-11-10): the round-2/3 floor picture with the element polygon of the edit-lane answer pasted (r4paste.py): the white zero-line front door (02-04) / the lounger off the terrace (05)');
