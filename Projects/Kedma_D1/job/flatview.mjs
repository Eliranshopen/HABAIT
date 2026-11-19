// kedma-d1 QA ($0): the same look out of two panoramas of one camera (the designed picture and the CG render = the plan's geometry),
// as the viewer shows it (a straight-line view), side by side. A straight edge of the plan must be straight in both.
// usage: node flatview.mjs <asset> <yaw> <pitch> <hfov> <out.png> [<designed png>]
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const T = path.resolve('Habait/tour360/tools');
const { appRequire } = await import(pathToFileURL(path.join(T, 'app-require.mjs')).href);
const { loadPano, render } = await import(pathToFileURL(path.join(T, 'pano-geometry.mjs')).href);
const sharp = appRequire(path.resolve('.'))('sharp');
const [asset, yaw, pitch, hfov, out, designed] = process.argv.slice(2);
const A = 'Habait/tour360/apartments/kedma-d1/_local/';
const picks = JSON.parse(fs.readFileSync(A + 'picks.json', 'utf8'));
const W = 900, H = 600; const tiles = [];
for (const f of [designed || (A + 'generated/' + picks[asset]), A + 'generated/' + asset + '__cg__0.png']) {
  const pano = await loadPano(sharp, f);
  tiles.push(await sharp(render(pano, Number(yaw), Number(pitch), Number(hfov), W, H), { raw: { width: W, height: H, channels: 3 } }).png().toBuffer());
}
await sharp({ create: { width: W * 2 + 10, height: H, channels: 3, background: '#ffffff' } }).composite([{ input: tiles[0], left: 0, top: 0 }, { input: tiles[1], left: W + 10, top: 0 }]).jpeg({ quality: 90 }).toFile(out);
console.log('wrote', out);
