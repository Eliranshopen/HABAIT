#!/usr/bin/env node
/* Habait Tour360 — tools/seam-park/seam.mjs — the equirect seam, measured and shown.
   Rescued 2026-11-01 (board walkaround-production, WP-02) from the 846 round (2026-10-29), where it judged where a skin's
   left and right edges meet (the edge-join test: a whole-frame skin needs it). Same measures as then:
     metric  the mean |diff| (0..255) between column 0 and column W-1 over every row and channel, and the same 8 px inside each
             edge as a baseline of local texture — a join far above its baseline is a visible seam
     strip   a picture of the join: the right 12 % beside the left 12 %, 700 px tall, written as <name>-seam.png into --out
   The panos are the file arguments, or every .png/.webp/.jpg directly inside --tour <dir>. No browser; sharp only. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appRequire } from '../app-require.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..', '..');
const HELP = `seam.mjs — the equirect seam: measure the edge join, or draw it.

usage: node Habait/tour360/tools/seam-park/seam.mjs metric|strip [--tour <dir>] [--apartment <id>] [--out <dir>] [<pano> …]
  metric       print, per pano, the edge-join mean |diff| and the 8 px-inside baseline
  strip        write <name>-seam.png (the right 12 % beside the left 12 %, 700 px tall) into --out
  --tour       a folder of panos: every .png/.webp/.jpg directly inside it (used when no file is given)
  --apartment  an apartment id, a label printed with the results (optional)
  --out        where strip writes (required for strip; created)
  --help       this text
env: HABAIT_APP_DIR where sharp is borrowed from (see ../app-require.mjs)`;

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) { console.log(HELP); process.exit(0); }
const fail = (m) => { console.error(`seam: ${m}\n\n${HELP}`); process.exit(2); };
const VALUED = new Set(['--tour', '--apartment', '--out']);
const opts = {}, files = [];
for (let i = 0; i < argv.length; i++) { if (VALUED.has(argv[i])) opts[argv[i]] = argv[++i]; else files.push(argv[i]); }
const mode = files.shift();
if (mode !== 'metric' && mode !== 'strip') fail('the first argument is metric or strip');
if (!files.length && opts['--tour']) {
  const d = opts['--tour'];
  if (!fs.existsSync(d)) fail(`no folder ${d}`);
  for (const n of fs.readdirSync(d).sort()) if (/\.(png|webp|jpe?g)$/i.test(n)) files.push(path.join(d, n));
}
if (!files.length) fail('no pano given (file arguments, or --tour <dir>)');
const OUT = opts['--out'];
if (mode === 'strip' && !OUT) fail('strip needs --out <dir>');
if (opts['--apartment']) console.log(`apartment ${opts['--apartment']}`);

const sharp = appRequire(REPO)('sharp');
if (OUT) fs.mkdirSync(OUT, { recursive: true });
for (const f of files) {
  const img = sharp(f); const m = await img.metadata(); const W = m.width, H = m.height;
  if (mode === 'metric') {
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    const ch = info.channels; let sum = 0, n = 0;
    for (let y = 0; y < H; y++) { const l = (y * W) * ch, r = (y * W + (W - 1)) * ch; for (let c = 0; c < 3; c++) { sum += Math.abs(data[l + c] - data[r + c]); n++; } }
    // the same metric 8 px inside each edge, as a baseline of local texture
    let sum2 = 0;
    for (let y = 0; y < H; y++) { const l = (y * W + 8) * ch, r = (y * W + (W - 9)) * ch; for (let c = 0; c < 3; c++) sum2 += Math.abs(data[l + c] - data[r + c]); }
    console.log(`${path.basename(f)} ${W}x${H} edge-join mean |diff| ${(sum / n).toFixed(1)}/255  (8px inside: ${(sum2 / n).toFixed(1)})`);
  } else {
    const strip = Math.round(W * 0.12);
    const right = await img.clone().extract({ left: W - strip, top: 0, width: strip, height: H }).toBuffer();
    const left = await img.clone().extract({ left: 0, top: 0, width: strip, height: H }).toBuffer();
    const out = path.join(OUT, path.basename(f).replace(/\.(png|webp|jpe?g)$/i, '') + '-seam.png');
    await sharp({ create: { width: strip * 2, height: H, channels: 3, background: '#000' } }).composite([{ input: right, left: 0, top: 0 }, { input: left, left: strip, top: 0 }]).resize({ height: 700 }).png().toFile(out);
    console.log('seam strip', out);
  }
}
