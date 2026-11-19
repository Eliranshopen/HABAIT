/* Habait Tour360 — tools/restage-viewer.mjs (2026-11-16, plan development/plans/2026-11-16-typed-change-all-tabs.md §6 P3).
   A new deploy stage from the LAST deployed one when a full build is not possible (the tour's local media is not on this disk):
   the last stage is copied whole, and only the code of the typed change goes in — the two viewer scripts inlined in
   tour/index.html, the plan scale in its tour-data (what tools/build-tour.mjs now writes), and the handler in api/_handler.mjs.
   It refuses unless the last stage's own viewer and handler ARE the baseline this checkout was built on (git a63494a, production's
   code on 2026-11-16) but for the one line the stage step rewrites (the tour's return link), which is carried over as the stage has it.
   Script contract (root CLAUDE.md §5): dry by default — says what it would change and writes nothing; --go copies and patches;
   a manifest <to>.restage.json records every changed file with its hash before and after. No paid call, no deploy.
     node tools/restage-viewer.mjs --from <last stage dir> --to <new stage dir> [--go]
   exit 0 ok · 1 the last stage is not what this checkout was built on, or --to exists · 2 usage */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = 'a63494a';
const arg = (name) => { const eq = process.argv.find((a) => a.startsWith('--' + name + '=')); if (eq) return eq.slice(name.length + 3); const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : null; };
const FROM = arg('from'), TO = arg('to'), GO = process.argv.includes('--go');
const fail = (code, msg) => { console.error('restage-viewer: ' + msg); process.exit(code); };
if (!FROM || !TO) fail(2, 'usage: node tools/restage-viewer.mjs --from <last stage dir> --to <new stage dir> [--go]');
if (!fs.existsSync(path.join(FROM, 'tour', 'index.html'))) fail(2, 'no tour/index.html in ' + FROM);
if (fs.existsSync(TO)) fail(1, 'the new stage folder already exists: ' + TO);

const lf = (s) => s.replace(/\r\n/g, '\n');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const base = (rel) => lf(execFileSync('git', ['show', BASELINE + ':./' + rel], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 }));
const mine = (rel) => lf(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const apart = (a, b) => { const A = a.split('\n'), B = b.split('\n'), sa = new Set(A), sb = new Set(B); return { onlyA: A.filter((l) => !sb.has(l)), onlyB: B.filter((l) => !sa.has(l)) }; };
function inlineOf(html, marker) {
  const re = /<script>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) if (m[1].includes(marker)) return { index: m.index, length: m[0].length, src: m[1].replace(/<\\\/script/gi, '</script') };
  fail(1, 'the stage page has no inline script with: ' + marker);
}
const inl = (src) => '<script>' + src.replace(/<\/script/gi, '<\\/script') + '</script>';

/* ── read the last stage and check it is the baseline ── */
const pageFile = path.join(FROM, 'tour', 'index.html');
const html0 = fs.readFileSync(pageFile, 'utf8');
const RETURN = "  const returnUrl = scope === 'apartment' ?"; // the one line of tour.js the stage step rewrites
const t0 = inlineOf(html0, 'Habait Tour360 — tour.js (T01');
const dT = apart(lf(t0.src), base('viewer/tour.js'));
if (!(dT.onlyA.length <= 1 && dT.onlyB.length <= 1 && dT.onlyA.every((l) => l.startsWith(RETURN)) && dT.onlyB.every((l) => l.startsWith(RETURN)))) fail(1, `the stage's tour.js is not the baseline ${BASELINE} (${dT.onlyA.length + dT.onlyB.length} lines apart beyond the return link): merge by hand`);
const e0 = inlineOf(html0, 'Habait Tour360 — edit-live.js (T09/T10');
const dE = apart(lf(e0.src), base('viewer/edit-live.js'));
if (dE.onlyA.length || dE.onlyB.length) fail(1, `the stage's edit-live.js is not the baseline ${BASELINE}: merge by hand`);
const API = [['_handler.mjs', 'server/handler.mjs', true], ['chat-transport.mjs', 'server/chat-transport.mjs', false], ['tour-edit.mjs', 'server/vercel-edit.mjs', false]];
for (const [f, rel] of API) {
  const p = path.join(FROM, 'api', f);
  if (!fs.existsSync(p)) fail(1, 'the stage has no api/' + f);
  const d = apart(lf(fs.readFileSync(p, 'utf8')), base(rel));
  if (d.onlyA.length || d.onlyB.length) fail(1, `the stage's api/${f} is not the baseline ${BASELINE}:${rel}: merge by hand`);
}
for (const [f, rel, changes] of API) if (!changes && mine(rel) !== base(rel)) fail(1, `${rel} changed in this checkout but the restage does not carry it`);

/* ── what goes in ── */
let tourJs = mine('viewer/tour.js');
if (dT.onlyA.length) { // the stage's own return link line, carried over
  const lines = tourJs.split('\n'), i = lines.findIndex((l) => l.startsWith(RETURN));
  if (i < 0 || lines.filter((l) => l.startsWith(RETURN)).length !== 1) fail(1, 'this checkout\'s tour.js has no single return-link line to carry the stage\'s over');
  lines[i] = dT.onlyA[0];
  tourJs = lines.join('\n');
}
const dm = /<script type="application\/json" id="tour-data">([\s\S]*?)<\/script>/.exec(html0);
if (!dm) fail(1, 'the stage page has no tour-data');
const data = JSON.parse(dm[1]);
const cam = JSON.parse(fs.readFileSync(path.join(ROOT, 'apartments', data.id, 'cameras.json'), 'utf8'));
const pxPerCm = Math.round(cam.plan.pxPerCm * cam.plan.planScale * 10000) / 10000; // tools/build-tour.mjs's own line
data.apartment.plan.pxPerCm = pxPerCm;
// later spans first, so the earlier offsets stay true
let html = html0;
const spans = [
  { ...inlineOf(html0, 'Habait Tour360 — edit-live.js (T09/T10'), put: inl(mine('viewer/edit-live.js')) },
  { ...inlineOf(html0, 'Habait Tour360 — tour.js (T01'), put: inl(tourJs) },
  { index: dm.index, length: dm[0].length, put: '<script type="application/json" id="tour-data">' + JSON.stringify(data).replace(/</g, '\\u003c') + '</script>' },
].sort((a, b) => b.index - a.index);
for (const s of spans) html = html.slice(0, s.index) + s.put + html.slice(s.index + s.length);
const handler = mine('server/handler.mjs');
const changed = [
  { file: 'tour/index.html', before: sha(html0), after: sha(html), what: `viewer/tour.js + viewer/edit-live.js of this checkout (the stage's return link kept), apartment.plan.pxPerCm = ${pxPerCm}` },
  { file: 'api/_handler.mjs', before: sha(fs.readFileSync(path.join(FROM, 'api', '_handler.mjs'))), after: sha(handler), what: 'server/handler.mjs of this checkout' },
];
const head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const dirty = execFileSync('git', ['status', '--porcelain', '--', 'viewer', 'server'], { cwd: ROOT, encoding: 'utf8' }).trim();
console.log(`restage-viewer: ${path.basename(FROM)} → ${path.basename(TO)} · baseline ${BASELINE} confirmed in the last stage · this checkout ${head}${dirty ? ' + UNCOMMITTED changes in viewer/ or server/' : ''}`);
for (const c of changed) console.log(`  ${c.file}: ${c.before.slice(0, 12)} → ${c.after.slice(0, 12)} · ${c.what}`);
if (dirty) fail(1, 'commit viewer/ and server/ first: a stage must be a commit');
if (!GO) { console.log('restage-viewer: dry run — nothing copied. Add --go.'); process.exit(0); }

fs.cpSync(FROM, TO, { recursive: true });
fs.writeFileSync(path.join(TO, 'tour', 'index.html'), html);
fs.writeFileSync(path.join(TO, 'api', '_handler.mjs'), handler);
let files = 0;
const walk = (d) => { for (const n of fs.readdirSync(d, { withFileTypes: true })) { if (n.isDirectory()) walk(path.join(d, n.name)); else files++; } };
walk(TO);
fs.writeFileSync(TO.replace(/[\\/]+$/, '') + '.restage.json', JSON.stringify({ $schema: 'tour360/restage.v1', when: new Date().toISOString(), from: path.resolve(FROM), to: path.resolve(TO), baseline: BASELINE, checkout: head, files, changed, cost_usd: 0 }, null, 2) + '\n');
console.log(`restage-viewer: ${files} files in ${TO}; 2 changed; manifest ${path.basename(TO)}.restage.json`);
