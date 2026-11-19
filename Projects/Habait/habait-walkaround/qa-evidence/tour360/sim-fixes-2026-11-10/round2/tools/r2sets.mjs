// round 2: the floor-only answers become the finish sets (panos-<floor>/<asset>.webp + .source.json). $0.
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const sharp = createRequire('C:/RnD/Projects/Habait/tools/appdeps/package.json')('sharp');
const APT = 'C:/RnD/Projects/Habait/habait-walkaround/Habait/tour360/apartments/apt846', GEN = APT + '/_local/generated';
const picks = JSON.parse(fs.readFileSync(APT + '/_local/picks.json', 'utf8'));
const WALK = process.argv[2];
for (const fl of ['parquet', 'concrete', 'marble']) for (const id of ['01-entrance', '02-kitchen', '03-dining', '04-living']) {
  const answer = fs.readdirSync(GEN).find((f) => f.startsWith(`${id}__floor-${fl}__gpt25__s61__`) && /__[0-9a-f]{12}\.png$/.test(f));
  const webp = `${APT}/_local/panos-${fl}/${id}.webp`;
  await sharp(path.join(GEN, answer)).resize({ width: 2048, height: 1024, fit: 'fill' }).webp({ quality: 90 }).toFile(webp);
  fs.writeFileSync(webp.replace(/\.webp$/, '.source.json'), JSON.stringify({ answer, source: picks[id], composite: 'none: round 2 (2026-11-10, Eliran «מאושר») — a floor-ONLY gpt25 edit of the regenerated pick (_local/round2/floor-prompts.json), used whole; backup of the earlier set in _local/round2/finish-backup/', at: new Date().toISOString() }, null, 1));
  fs.mkdirSync(`${WALK}/${fl}`, { recursive: true }); fs.copyFileSync(webp, `${WALK}/${fl}/${id}.webp`);
  console.log(fl, id, answer);
}
