#!/usr/bin/env node
/* Habait Tour360 — tools/seam-park/manual-rolls.mjs — park the equirect seam BY HAND for rooms the automatic chooser could not place.
   Rescued 2026-11-01 (board walkaround-production, WP-02) from the 846 round (2026-10-29, D-WQ-36), where it parked the sun
   terrace's seam on the column and the guest bath's on the wall between the shower and the door. Same convention as
   ../make-skin-prompts.mjs: the rolled pano's column 0 is the original column u_edge * W. The rolls are data now (--rolls; 846's
   two are rolls-apt846.json beside this file), and nothing names a machine path.
   Writes, per roll: a `roll` object into <apartment>/skin-prompts.json (the entry with that id) and the rolled CG pano
   <out>/<cp>.webp from <tour>/renders/<cp>/pano.webp. --dry writes nothing. sharp only (borrowed by ../app-require.mjs). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appRequire } from '../app-require.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..', '..');
const HELP = `manual-rolls.mjs — park the equirect seam by hand for named rooms; write the roll and the rolled CG pano.

usage: node Habait/tour360/tools/seam-park/manual-rolls.mjs --tour <dir|id> --apartment <id|dir> --rolls <file.json> [--out <dir>] [--dry]
  --tour       the CG tour: a folder, or an id under 360walkaround/tours/ (e.g. apt846-furnished); its renders/<cp>/pano.webp are rolled
  --apartment  an apartment id under Habait/tour360/apartments/, or its folder; its skin-prompts.json receives the roll entries
  --rolls      a JSON map { "<skin id>": { "cp": "<CG point>", "u_edge": 0..1, "nearest": "<what the seam sits on>" } }
               (keys starting with _ are ignored); apartment 846's two hand parks: tools/seam-park/rolls-apt846.json
  --out        where the rolled CG panos go (default <apartment>/_local/refs/cg-rolled)
  --dry        print what would change; write nothing
  --help       this text
env: HABAIT_APP_DIR where sharp is borrowed from (see ../app-require.mjs)`;

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) { console.log(HELP); process.exit(0); }
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d; };
const fail = (m) => { console.error(`manual-rolls: ${m}\n\n${HELP}`); process.exit(2); };
const dirOr = (v, ...under) => (fs.existsSync(v) && fs.statSync(v).isDirectory() ? path.resolve(v) : path.join(REPO, ...under, v));

const tourArg = opt('--tour'), aptArg = opt('--apartment'), rollsArg = opt('--rolls');
if (!tourArg) fail('--tour is required');
if (!aptArg) fail('--apartment is required');
if (!rollsArg || !fs.existsSync(rollsArg)) fail('--rolls <file.json> is required and must exist');
const DRY = argv.includes('--dry');
const R = path.join(dirOr(tourArg, '360walkaround', 'tours'), 'renders');
const APT = dirOr(aptArg, 'Habait', 'tour360', 'apartments');
const OUT = opt('--out', path.join(APT, '_local', 'refs', 'cg-rolled'));
const f = path.join(APT, 'skin-prompts.json');
if (!fs.existsSync(f)) fail(`no skin-prompts.json at ${f}`);
if (!fs.existsSync(R)) fail(`no renders/ at ${R}`);
const manual = Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(rollsArg, 'utf8'))).filter(([k]) => !k.startsWith('_')));
for (const [id, m] of Object.entries(manual)) {
  if (!m || typeof m.cp !== 'string' || !(m.u_edge >= 0 && m.u_edge < 1)) fail(`bad roll ${id}: needs cp and 0 <= u_edge < 1`);
}

const sharp = appRequire(REPO)('sharp');
const a = JSON.parse(fs.readFileSync(f, 'utf8'));
if (!DRY) fs.mkdirSync(OUT, { recursive: true });
for (const [id, m] of Object.entries(manual)) {
  const e = a.find((x) => x.id === id);
  if (!e) throw new Error('no entry ' + id + ' in skin-prompts.json');
  e.roll = { bearing_deg: null, rel_deg: null, clear_deg: null, nearest: m.nearest, u_edge: m.u_edge, manual: true };
  const src = path.join(R, m.cp, 'pano.webp'), dst = path.join(OUT, `${m.cp}.webp`);
  const md = await sharp(src).metadata(); const Wd = md.width, H = md.height, x0 = Math.round(m.u_edge * Wd) % Wd;
  if (DRY) { console.log(`${id}: would roll ${m.cp} by ${x0} px (u_edge ${m.u_edge}) → ${dst}`); continue; }
  const L = await sharp(src).extract({ left: x0, top: 0, width: Wd - x0, height: H }).toBuffer();
  const Rr = await sharp(src).extract({ left: 0, top: 0, width: x0, height: H }).toBuffer();
  await sharp({ create: { width: Wd, height: H, channels: 3, background: '#000' } }).composite([{ input: L, left: 0, top: 0 }, { input: Rr, left: Wd - x0, top: 0 }]).webp({ quality: 95 }).toFile(dst);
  console.log(`${id}: rolled by ${x0} px (u_edge ${m.u_edge}) → ${dst}`);
}
if (DRY) console.log(`(dry) ${f} not written`);
else { fs.writeFileSync(f, JSON.stringify(a, null, 1)); console.log('wrote', f); }
