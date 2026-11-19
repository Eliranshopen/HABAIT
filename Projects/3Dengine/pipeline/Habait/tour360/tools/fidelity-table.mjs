#!/usr/bin/env node
/* Habait Tour360 — tools/fidelity-table.mjs (2026-11-05): the gate's latest verdict per shipped picture, as a table for Eliran.
   Reads apartments/<id>/_local/fidelity/gate.json and, for every shipped picture (the balanced set and every floor-finish set
   videos.json names), the LATEST row for the picture's exact bytes at the rule's bar (the same hash build-tour.mjs checks).
     node Habait/tour360/tools/fidelity-table.mjs apt846 [--md]
   Columns: room · set · verdict · deviation % · of which: skin findings / CG vs trace (p90 cm) / trace vs sheet % · resolves % · evidence. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { appRequire } from './app-require.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOUR = path.resolve(HERE, '..');
const REPO = path.resolve(TOUR, '..', '..');
const sharp = appRequire(REPO)('sharp');
const aptId = process.argv[2];
if (!aptId) { console.error('usage: fidelity-table.mjs <apartment> [--md]'); process.exit(2); }
const md = process.argv.includes('--md');
const APT = path.join(TOUR, 'apartments', aptId);
const rule = JSON.parse(fs.readFileSync(path.join(TOUR, 'fidelity.json'), 'utf8'));
const bar = Number(rule.max_deviation_pct);
const gate = fs.existsSync(path.join(APT, '_local', 'fidelity', 'gate.json')) ? JSON.parse(fs.readFileSync(path.join(APT, '_local', 'fidelity', 'gate.json'), 'utf8')) : { rows: [] };
const scenes = JSON.parse(fs.readFileSync(path.join(APT, 'scenes.json'), 'utf8')).scenes.filter((s) => s.kind !== 'exterior' && /^\d\d-/.test(s.asset));
const vdoc = fs.existsSync(path.join(APT, 'videos.json')) ? JSON.parse(fs.readFileSync(path.join(APT, 'videos.json'), 'utf8')) : null;
const sets = [{ id: 'balanced', dir: path.join(APT, 'panos', 'balanced') }].concat(((vdoc && vdoc.floors) || []).filter((f) => f.panos).map((f) => ({ id: f.id, dir: path.join(APT, '_local', f.panos) })));
const rows = [];
for (const s of scenes) for (const set of sets) {
  const file = path.join(set.dir, s.asset + '.webp');
  if (!fs.existsSync(file)) { rows.push({ asset: s.asset, set: set.id, verdict: 'MISSING' }); continue; }
  const png = await sharp(file).resize({ width: 2048, height: 1024, fit: 'fill' }).removeAlpha().png().toBuffer();
  const hash = crypto.createHash('sha256').update(png).digest('hex').slice(0, 12);
  const r = (gate.rows || []).filter((x) => x.picture_hash === hash && x.max_deviation_pct === bar).pop();
  rows.push(r ? { asset: s.asset, set: set.id, verdict: r.verdict, deviation: r.deviation_pct, skin: r.findings && r.findings.length ? Math.max(...r.findings.map((f) => f.width_cm || 0)) : 0, cg: r.cg_vs_plan && r.cg_vs_plan.p90_cm != null ? r.cg_vs_plan.p90_cm : null, sheet: r.dims && r.dims.linear_pct != null ? r.dims.linear_pct : (r.dims && r.dims.length_cm ? r.dims.length_cm.pct : null), resolves: r.resolution_pct, evidence: r.evidence } : { asset: s.asset, set: set.id, verdict: 'NO ROW' });
}
const f2 = (v) => (v == null ? '—' : Number(v).toFixed(2));
if (md) {
  console.log(`| room | set | verdict | deviation % (bar ${bar}) | skin finding cm | CG vs trace p90 cm | trace vs sheet % | resolves % | evidence |`);
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) console.log(`| ${r.asset} | ${r.set} | ${r.verdict} | ${f2(r.deviation)} | ${r.skin == null ? '—' : r.skin} | ${f2(r.cg)} | ${f2(r.sheet)} | ${f2(r.resolves)} | ${r.evidence || ''} |`);
} else {
  for (const r of rows) console.log(`${r.asset.padEnd(20)} ${r.set.padEnd(9)} ${String(r.verdict).padEnd(11)} dev ${f2(r.deviation).padStart(6)}%  skin ${String(r.skin ?? '—').padStart(6)} cm  cg p90 ${f2(r.cg).padStart(6)} cm  sheet ${f2(r.sheet).padStart(6)}%  resolves ${f2(r.resolves)}%`);
}
const bad = rows.filter((r) => r.verdict !== 'PASS');
console.log(`${rows.length} pictures · PASS ${rows.length - bad.length} · not passing ${bad.length}${bad.length ? ': ' + bad.map((r) => `${r.asset}[${r.set}] ${r.verdict}`).join(', ') : ''}`);
process.exit(bad.length ? 1 : 0);
