// round 5: install the no-skirting answers — base answers become the picks, floor answers become the sets (whole pictures). $0.
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const sharp = createRequire('C:/RnD/Projects/Habait/tools/appdeps/package.json')('sharp');
const APT = 'C:/RnD/Projects/Habait/habait-walkaround/Habait/tour360/apartments/apt846', GEN = APT + '/_local/generated';
const pf = APT + '/_local/picks.json'; const picks = JSON.parse(fs.readFileSync(pf, 'utf8'));
const TABS = ['01-entrance', '02-kitchen', '03-dining', '04-living', '06-terrace-bedroom', '07-bedroom-main', '08-wardrobe', '10-bedroom-2'];
const ans = (id, set) => fs.readdirSync(GEN).find((f) => new RegExp(`^${id}__${set}__gpt25-medium__s91__[0-9a-f]{12}\\.png$`).test(f));
fs.mkdirSync(APT + '/_local/round5/finish-backup', { recursive: true });
for (const id of TABS) {
  const before = picks[id]; picks[id] = ans(id, 'base');
  for (const fl of ['parquet', 'concrete', 'marble']) {
    const webp = `${APT}/_local/panos-${fl}/${id}.webp`; const bk = `${APT}/_local/round5/finish-backup/${fl}--${id}.webp`; if (!fs.existsSync(bk)) fs.copyFileSync(webp, bk);
    const a = ans(id, fl);
    await sharp(path.join(GEN, a)).resize({ width: 2048, height: 1024, fit: 'fill' }).webp({ quality: 90 }).toFile(webp);
    fs.writeFileSync(webp.replace(/\.webp$/, '.source.json'), JSON.stringify({ answer: a, picture: a, source: picks[id], pick_before_round5: before, composite: 'none: round 5 (2026-11-10, Eliran: no skirting boards) — a gpt25-medium edit of the shipped floor picture that removes the skirting, used whole (_local/round5/prompts.json)', at: new Date().toISOString() }, null, 1));
  }
  console.log(id, picks[id]);
}
fs.writeFileSync(pf, JSON.stringify(picks, null, 1) + '\n');
