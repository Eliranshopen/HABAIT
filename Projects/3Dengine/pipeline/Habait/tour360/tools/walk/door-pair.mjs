#!/usr/bin/env node
/* Habait Tour360 — tools/walk/door-pair.mjs — the door-match sheet: does walking through a door land in the same apartment?
   Rescued 2026-11-01 (board walkaround-production, WP-02) from the 2026-10-29 cross-room proof behind D-WQ-36 (every walk landed
   in a different apartment: per-room skins over grey CG masses). Same maths and layout as then; the tour, the apartment, the pairs
   and the output are parameters now, and nothing names a machine path.
   For each pair a→b, two rows of four 800x560 views (pitch -6°, hfov 75°), cut from the equirects by ../pano-geometry.mjs:
     row 1: [CG a, skin a] looking at the door to b · [CG b, skin b] as you arrive in b from a (the door to a, turned 180°)
     row 2: [CG b, skin b] looking at the door to a · [CG a, skin a] as you arrive back in a
   The door yaw is the hotspot's u on the full equirect ((u - 0.5) * 360). CG = <tour>/renders/cp-<scene>/pano.webp; the skin is the
   apartment's picked generated pano (or the file you name). No browser; sharp only (borrowed by ../app-require.mjs). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appRequire } from '../app-require.mjs';
import { render } from '../pano-geometry.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..', '..');
const HELP = `door-pair.mjs — the door-match sheet: the CG and the skin, both ways through each named door.

usage: node Habait/tour360/tools/walk/door-pair.mjs --tour <dir|id> --apartment <id|dir> --out <dir> --pair <a>:<b>[:<fileA>:<fileB>] [--pair …] [--name <file>.jpg]
  --tour       the CG tour: a folder, or an id under 360walkaround/tours/ (e.g. apt846-furnished); its renders/cp-<scene>/pano.webp are the CG
  --apartment  an apartment id under Habait/tour360/apartments/, or its folder: scenes.json gives the door yaws, _local/generated/ the skins
  --pair       two scene ids a:b (repeatable). Without files the skins are the PICKS: skin-prompts.json maps the scene to its id and
               _local/picks.json names the file. a:b:fileA:fileB names two files in _local/generated/ instead.
  --out        the output folder (created)
  --name       the sheet's file name (default door-pair-<a>-<b>[_<c>-<d>…].jpg)
  --help       this text
env: HABAIT_APP_DIR where sharp is borrowed from (see ../app-require.mjs)`;

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) { console.log(HELP); process.exit(0); }
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d; };
const fail = (m) => { console.error(`door-pair: ${m}\n\n${HELP}`); process.exit(2); };
const dirOr = (v, ...under) => (fs.existsSync(v) && fs.statSync(v).isDirectory() ? path.resolve(v) : path.join(REPO, ...under, v));

const tourArg = opt('--tour'), aptArg = opt('--apartment'), OUT = opt('--out');
const pairArgs = argv.flatMap((a, i) => (a === '--pair' && i + 1 < argv.length ? [argv[i + 1]] : []));
if (!tourArg) fail('--tour is required');
if (!aptArg) fail('--apartment is required');
if (!OUT) fail('--out is required');
if (!pairArgs.length) fail('at least one --pair a:b is required');
const TOUR = dirOr(tourArg, '360walkaround', 'tours');
const APT = dirOr(aptArg, 'Habait', 'tour360', 'apartments');
const G = path.join(APT, '_local', 'generated');
const CG = path.join(TOUR, 'renders');
for (const [p, what] of [[path.join(APT, 'scenes.json'), 'scenes.json'], [G, '_local/generated/'], [CG, 'renders/']]) if (!fs.existsSync(p)) fail(`no ${what} at ${p}`);

const scenes = JSON.parse(fs.readFileSync(path.join(APT, 'scenes.json'), 'utf8')).scenes;
const pickFor = (scene) => {
  const prompts = JSON.parse(fs.readFileSync(path.join(APT, 'skin-prompts.json'), 'utf8'));
  const e = prompts.find((x) => x.scene === scene);
  if (!e) throw new Error(`no skin-prompts.json entry for scene ${scene}`);
  const picks = JSON.parse(fs.readFileSync(path.join(APT, '_local', 'picks.json'), 'utf8'));
  if (!picks[e.id]) throw new Error(`no pick for ${e.id} in _local/picks.json`);
  return picks[e.id];
};
const pairs = pairArgs.map((s) => {
  const [a, b, fa, fb] = s.split(':');
  if (!a || !b || (fa && !fb)) fail(`bad --pair ${s} (a:b or a:b:fileA:fileB)`);
  for (const id of [a, b]) if (!scenes.some((x) => x.id === id)) fail(`no scene ${id} in scenes.json`);
  return [a, b, fa || pickFor(a), fb || pickFor(b)];
});
const yawTo = (from, to) => {
  const h = scenes.find((s) => s.id === from).hotspots.find((x) => x.to === to);
  if (!h) throw new Error(`no door ${from}>${to} in scenes.json`);
  return (h.u - 0.5) * 360;
};

const sharp = appRequire(REPO)('sharp');
async function load(f) { const { data, info } = await sharp(f).resize({ width: 3840, height: 1920, fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, W: info.width, H: info.height }; }
async function view(p, yaw, pitch, hfov) { const w = 800, h = 560; return sharp(render(p, yaw, pitch, hfov, w, h), { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 86 }).toBuffer(); }

fs.mkdirSync(OUT, { recursive: true });
const tiles = []; let top = 0;
for (const [a, b, fa, fb] of pairs) {
  const A = await load(path.join(G, fa)), B = await load(path.join(G, fb));
  const CA = await load(path.join(CG, `cp-${a}`, 'pano.webp')), CB = await load(path.join(CG, `cp-${b}`, 'pano.webp'));
  const ya = yawTo(a, b), yb = yawTo(b, a);
  const row = [[CA, ya], [A, ya], [CB, yb + 180], [B, yb + 180]], row2 = [[CB, yb], [B, yb], [CA, ya + 180], [A, ya + 180]];
  for (const r of [row, row2]) { let left = 0; for (const [p, y] of r) { tiles.push({ input: await view(p, y, -6, 75), left, top }); left += 800; } top += 560; }
  console.log(`${a}>${b}: CG cp-${a}, cp-${b} · skins ${fa}, ${fb}`);
}
const name = opt('--name', `door-pair-${pairs.map(([a, b]) => `${a}-${b}`).join('_')}.jpg`);
const file = path.join(OUT, name);
await sharp({ create: { width: 3200, height: top, channels: 3, background: '#000' } }).composite(tiles).jpeg({ quality: 82 }).toFile(file);
console.log('sheet', file);
