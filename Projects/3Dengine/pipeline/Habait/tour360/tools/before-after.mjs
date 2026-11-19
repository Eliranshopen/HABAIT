#!/usr/bin/env node
/* Habait Tour360 — tools/before-after.mjs (2026-11-05): one strip per room, the reference set on top and this tree's balanced set
   below, for Eliran's eye. The reference is another checkout's balanced set (the live site's, by default the main checkout).
     node Habait/tour360/tools/before-after.mjs apt846 [--ref <dir with <asset>.webp>] [--out <dir>] [--only a,b]
   Writes <out>/before-after__<asset>.jpg (default apartments/<id>/_local/fidelity/). $0. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appRequire } from './app-require.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOUR = path.resolve(HERE, '..');
const REPO = path.resolve(TOUR, '..', '..');
const sharp = appRequire(REPO)('sharp');
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const aptId = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
if (!aptId) { console.error('usage: before-after.mjs <apartment> [--ref <dir>] [--out <dir>] [--only a,b]'); process.exit(2); }
const APT = path.join(TOUR, 'apartments', aptId);
const REF = path.resolve(flag('--ref', path.join('C:/RnD/Projects/Habait/habait-walkaround/Habait/tour360/apartments', aptId, 'panos', 'balanced')));
const OUT = path.resolve(flag('--out', path.join(APT, '_local', 'fidelity')));
fs.mkdirSync(OUT, { recursive: true });
const only = flag('--only') ? flag('--only').split(',') : null;
const scenes = JSON.parse(fs.readFileSync(path.join(APT, 'scenes.json'), 'utf8')).scenes.filter((s) => s.kind !== 'exterior' && /^\d\d-/.test(s.asset) && (!only || only.includes(s.asset)));
const W = 1400, H = 700;
const label = (t) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="26"><rect width="${W}" height="26" fill="#000"/><text x="8" y="18" fill="#fff" font-size="15" font-family="Arial">${t}</text></svg>`);
for (const s of scenes) {
  const before = path.join(REF, s.asset + '.webp'), after = path.join(APT, 'panos', 'balanced', s.asset + '.webp');
  if (!fs.existsSync(after)) { console.error(`${s.asset}: no balanced picture here`); continue; }
  const parts = [{ input: await sharp(label(`${s.asset} BEFORE (${fs.existsSync(before) ? path.relative(REPO, before) : 'no reference'})`)).png().toBuffer(), left: 0, top: 0 }];
  if (fs.existsSync(before)) parts.push({ input: await sharp(before).resize(W, H).toBuffer(), left: 0, top: 26 });
  parts.push({ input: await sharp(label(`${s.asset} AFTER (this tree)`)).png().toBuffer(), left: 0, top: H + 26 });
  parts.push({ input: await sharp(after).resize(W, H).toBuffer(), left: 0, top: H + 52 });
  const out = path.join(OUT, `before-after__${s.asset}.jpg`);
  await sharp({ create: { width: W, height: 2 * H + 52, channels: 3, background: '#000' } }).composite(parts).jpeg({ quality: 82 }).toFile(out);
  console.log(out);
}
