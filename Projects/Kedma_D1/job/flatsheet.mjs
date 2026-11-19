// kedma-d1 QA ($0): one sheet per room — the same straight-line views (as the viewer shows them) out of the designed pick (left)
// and out of the CG render = the plan's geometry (right), one row per yaw. A straight edge of the plan must be straight in both.
// usage (from the pipeline folder): node ../jobs/kedma-d1/flatsheet.mjs <asset> <out.jpg> [--yaws 0,90,180,270] [--pitch -12] [--hfov 100]
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const T = path.resolve('Habait/tour360/tools');
const { appRequire } = await import(pathToFileURL(path.join(T, 'app-require.mjs')).href);
const { loadPano, render } = await import(pathToFileURL(path.join(T, 'pano-geometry.mjs')).href);
const sharp = appRequire(path.resolve('.'))('sharp');
const argv = process.argv.slice(2);
const [asset, out] = argv;
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const yaws = opt('--yaws', '0,90,180,270').split(',').map(Number);
const pitch = Number(opt('--pitch', '-12')), hfov = Number(opt('--hfov', '100'));
const A = 'Habait/tour360/apartments/kedma-d1/_local/';
const picks = JSON.parse(fs.readFileSync(A + 'picks.json', 'utf8'));
const W = 640, H = 426, G = 8;
const panos = [await loadPano(sharp, A + 'generated/' + picks[asset]), await loadPano(sharp, A + 'generated/' + asset + '__cg__0.png')];
const comp = [];
for (let r = 0; r < yaws.length; r++) {
  for (let c = 0; c < 2; c++) {
    const buf = await sharp(render(panos[c], yaws[r], pitch, hfov, W, H), { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();
    comp.push({ input: buf, left: c * (W + G), top: r * (H + G) });
  }
}
await sharp({ create: { width: W * 2 + G, height: yaws.length * (H + G) - G, channels: 3, background: '#ffffff' } }).composite(comp).jpeg({ quality: 88 }).toFile(out);
console.log('wrote', out, 'yaws', yaws.join(','), 'pitch', pitch, 'hfov', hfov);
