#!/usr/bin/env node
/* Habait Tour360 — tools/walk/live-vs-served.mjs — the served-vs-live frame check: the same door at the same moment (before /
   arrived / look back) filmed by walk-all.mjs on a local server and on the live link, compared frame by frame.
   Rescued 2026-11-01 (board walkaround-production, WP-02) from the 846 round (2026-10-29); same measure as then: both frames
   resized to 272x227, greyscale, the mean absolute difference (MAD, 0..255) per pair; a pair over --threshold (default 12) is
   listed. Writes _live-vs-served.json (every pair, sorted worst first) into --out. No browser; sharp only. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appRequire } from '../app-require.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..', '..');
const HELP = `live-vs-served.mjs — compare two walk-all.mjs runs of the same doors (a local server against the live link).

usage: node Habait/tour360/tools/walk/live-vs-served.mjs --tour <dir> [--apartment <id>] [--out <dir>] [--served <dir>] [--live <dir>] [--threshold 12]
  --tour       an evidence folder holding walks-served/ and walks-live/ (two walk-all.mjs outputs)
  --served     the served walk folder (overrides <tour>/walks-served)
  --live       the live walk folder (overrides <tour>/walks-live)
  --apartment  the apartment id, recorded in the result (optional)
  --out        where _live-vs-served.json is written (default: the live folder, as before)
  --threshold  the MAD (0..255) above which a pair counts as different (default 12)
  --help       this text
env: HABAIT_APP_DIR where sharp is borrowed from (see ../app-require.mjs)`;

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) { console.log(HELP); process.exit(0); }
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d; };
const fail = (m) => { console.error(`live-vs-served: ${m}\n\n${HELP}`); process.exit(2); };

const E = opt('--tour');
const A = opt('--served', E && path.join(E, 'walks-served'));
const B = opt('--live', E && path.join(E, 'walks-live'));
if (!A || !B) fail('give --tour <dir> (holding walks-served/ and walks-live/), or both --served and --live');
for (const d of [A, B]) if (!fs.existsSync(d)) fail(`no folder ${d}`);
const OUT = opt('--out', B);
const threshold = Number(opt('--threshold', 12));

const sharp = appRequire(REPO)('sharp');
const names = fs.readdirSync(B).filter((f) => /-(0-before|2-arrived|3-lookback)\.jpg$/.test(f));
const rows = [];
for (const n of names) {
  if (!fs.existsSync(path.join(A, n))) { rows.push({ n, note: 'no served twin' }); continue; }
  const [a, b] = await Promise.all([A, B].map((d) => sharp(path.join(d, n)).resize(272, 227, { fit: 'fill' }).grayscale().raw().toBuffer()));
  let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  rows.push({ n, mad: +(s / a.length).toFixed(2) });
}
rows.sort((x, y) => (y.mad ?? 999) - (x.mad ?? 999));
const mads = rows.filter((r) => r.mad != null).map((r) => r.mad);
if (!mads.length) fail('no frame pairs found (are these walk-all.mjs folders?)');
console.log(`pairs ${mads.length}; mean MAD ${(mads.reduce((p, c) => p + c, 0) / mads.length).toFixed(2)}; max ${mads[0]}; >${threshold}: ${mads.filter((m) => m > threshold).length}`);
console.log(rows.slice(0, 8).map((r) => `${r.n} ${r.mad ?? r.note}`).join('\n'));
fs.mkdirSync(OUT, { recursive: true });
const file = path.join(OUT, '_live-vs-served.json');
fs.writeFileSync(file, JSON.stringify({ measured: new Date().toISOString(), apartment: opt('--apartment', null), served: A, live: B, threshold, pairs: rows }, null, 1));
console.log('wrote', file);
