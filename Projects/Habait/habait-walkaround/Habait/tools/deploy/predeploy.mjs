#!/usr/bin/env node
/* Habait — tools/deploy/predeploy.mjs: the habait-flow PREDEPLOY gate (Eliran 2026-11-05: «כל דבר שאתה מעדכן חייב להתאים גם לגרסת המובייל
   בנוסף לגרסת הדסקטופ» — «וזה כלל שחייב להיות בלוגיקה בקוד»). Runs tools/qa/responsive-gate.mjs on a STAGE folder (the output of
   Projects/Habait/tools/deploy-vercel/stage_flow.py), served locally with the stage's own vercel.json rewrites, over the site's pages:
     /  ·  /landing.html  ·  /apartment.html  ·  /hold/  ·  /studio/  ·  /tour/?room=<every room of the staged tour>
   at 1440×900 and 390×844. The functions (/api/*) do not run locally, so their 404s are ignored (--ignore-api); every other 4xx fails.
   Exit 0 = PASS (deploy may proceed on Eliran's go), 1 = FAIL (do not deploy: <stage>/PREDEPLOY-FAIL.json lists why), 2 = usage.
   usage: node Habait/tools/deploy/predeploy.mjs <stage dir> [--out <dir>] [--pages /a,/b] [--settle 3500] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const stage = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && ['--out', '--pages', '--settle'].includes(argv[i - 1])));
if (!stage || !fs.existsSync(path.join(stage, 'index.html'))) { console.error('usage: predeploy.mjs <stage dir with index.html> [--out dir]'); process.exit(2); }
const out = path.resolve(opt('--out', path.join(stage, '..', `${path.basename(stage)}.predeploy`)));
fs.rmSync(out, { recursive: true, force: true });

// the tour's rooms, from the staged tour itself (the scene objects carry "id" … "asset":"NN-…")
const rooms = [];
const tourHtml = path.join(stage, 'tour', 'index.html');
if (fs.existsSync(tourHtml)) {
  const t = fs.readFileSync(tourHtml, 'utf8'); const re = /"id":"([A-Za-z0-9]+)"((?:(?!"id":")[\s\S]){0,600}?)"asset":"\d\d-/g; let m;
  while ((m = re.exec(t))) if (!rooms.includes(m[1])) rooms.push(m[1]);
}
const pages = opt('--pages') ? opt('--pages').split(',') : ['/', '/landing.html', '/apartment.html', '/hold/', '/studio/', ...rooms.map((r) => `/tour/?room=${r}`)]
  .filter((p) => fs.existsSync(path.join(stage, p.split('?')[0].replace(/^\//, '') || 'index.html')) || fs.existsSync(path.join(stage, p.split('?')[0].replace(/^\//, ''), 'index.html')));

const { gate, serveStatic } = await import(pathToFileURL(path.join(HERE, '..', 'qa', 'responsive-gate.mjs')).href);
const rw = fs.existsSync(path.join(stage, 'vercel.json')) ? JSON.parse(fs.readFileSync(path.join(stage, 'vercel.json'), 'utf8')).rewrites : null;
const srv = serveStatic(path.resolve(stage), rw); await new Promise((r) => srv.listen(0, '127.0.0.1', r));
let v;
try { v = await gate(`http://127.0.0.1:${srv.address().port}`, pages, out, { ignoreApi: true, settle: Number(opt('--settle', '3500')) }); }
finally { srv.close(); }
const failFile = path.join(stage, 'PREDEPLOY-FAIL.json');
if (v.pass) { fs.rmSync(failFile, { force: true }); console.log(`predeploy: PASS · ${v.pages.length} page×size · ${out}`); process.exit(0); }
fs.writeFileSync(failFile, JSON.stringify({ at: v.at, verdict: path.join(out, 'verdict.json'), failing: v.pages.filter((p) => !p.pass).map((p) => ({ page: p.url, size: p.size, fails: p.fails })) }, null, 1));
console.error(`predeploy: FAIL · ${v.pages.filter((p) => !p.pass).length} of ${v.pages.length} page×size · do not deploy · ${failFile}`);
process.exit(1);
