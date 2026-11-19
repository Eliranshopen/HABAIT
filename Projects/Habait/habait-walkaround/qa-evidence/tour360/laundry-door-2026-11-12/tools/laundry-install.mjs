// laundry-install.mjs (2026-11-12): the four living pictures with the open laundry niche become the shipped ones — the base pick in
// picks.json, the three floor sets as _local/panos-<set>/04-living.webp (quality 90, as round 4), each old file backed up once. $0.
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const sharp = createRequire('C:/RnD/Projects/Habait/tools/appdeps/package.json')('sharp');
const APT = 'C:/RnD/Projects/Habait/habait-walkaround/Habait/tour360/apartments/apt846', GEN = APT + '/_local/generated', BK = APT + '/_local/laundry/finish-backup';
fs.mkdirSync(BK, { recursive: true });
const picks = JSON.parse(fs.readFileSync(APT + '/_local/picks.json', 'utf8')); const before = picks['04-living'];
picks['04-living'] = '04-living__laundry.png'; fs.writeFileSync(APT + '/_local/picks.json', JSON.stringify(picks, null, 1) + '\n');
console.log('pick', before, '->', picks['04-living']);
for (const fl of ['parquet', 'concrete', 'marble']) {
  const webp = `${APT}/_local/panos-${fl}/04-living.webp`, bk = `${BK}/${fl}--04-living.webp`; if (!fs.existsSync(bk)) fs.copyFileSync(webp, bk);
  const png = `04-living__floor-${fl}__laundry.png`;
  await sharp(path.join(GEN, png)).resize({ width: 2048, height: 1024, fit: 'fill' }).webp({ quality: 90 }).toFile(webp + '.tmp'); fs.renameSync(webp + '.tmp', webp);
  fs.writeFileSync(webp.replace(/\.webp$/, '.source.json'), JSON.stringify({ answer: png, picture: png, source: before, composite: 'Eliran 2026-11-12 «תעשה כמו שזה נראה בתכנית מכר»: the shipped floor picture with the open laundry niche + washing machine polygon of one edit-lane answer pasted (laundry-paste.py)', at: new Date().toISOString() }, null, 1));
  console.log(fl, png);
}
