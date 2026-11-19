#!/usr/bin/env node
/* ADAPTED COPY (2026-11-18) of RAINBOW's Habait/tour360/tools/stage-tour.mjs: assembles the deploy folder of the built tour for its
   own Vercel project, OUTSIDE the harness tree C:/RnD (RAINBOW standing law 3: never a Vercel command inside the tree): a copy of the
   build folder — the page, the media, api/edit (the live change: FAL_KEY, OPENROUTER_API_KEY and TOUR_EDIT_CODE or TOUR_EDIT_OPEN=1
   from the project's environment, by name) and its vercel.json — into <dir>/<project-name>, which the CLI names the project after.
   --no-api strips the function (a view-only link). It runs NO Vercel command and deploys nothing. $0.
     node tools/tour360/stage-tour.mjs <buildDir> <dir>/<project-name> [--no-api] */
import fs from 'node:fs';
import path from 'node:path';

const [, , distArg, outArg] = process.argv;
const noApi = process.argv.includes('--no-api');
if (!distArg || !outArg) { console.error('usage: stage-tour.mjs <buildDir> <dir>/<project-name> [--no-api]'); process.exit(2); }
const DIST = path.resolve(distArg), out = path.resolve(outArg);
if (out.toLowerCase().startsWith(path.resolve('C:/RnD').toLowerCase() + path.sep)) { console.error('refusing to stage inside the harness tree C:/RnD'); process.exit(2); }
if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.error(`${DIST}/index.html missing — build first`); process.exit(1); }
const SKIP = new Set(['qa', 'BASELINE.md', 'build-report.json']); // evidence and notes stay with the build, not on the site
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const copyDir = (from, to) => { fs.mkdirSync(to, { recursive: true }); for (const n of fs.readdirSync(from)) { const f = path.join(from, n), t = path.join(to, n); if (fs.statSync(f).isDirectory()) copyDir(f, t); else fs.copyFileSync(f, t); } };
for (const n of fs.readdirSync(DIST)) {
  if (SKIP.has(n) || (noApi && n === 'api')) continue;
  const f = path.join(DIST, n);
  if (fs.statSync(f).isDirectory()) copyDir(f, path.join(out, n)); else fs.copyFileSync(f, path.join(out, n));
}
const vercel = JSON.parse(fs.readFileSync(path.join(DIST, 'vercel.json'), 'utf8'));
if (noApi) delete vercel.functions;
fs.writeFileSync(path.join(out, 'vercel.json'), JSON.stringify(vercel, null, 2) + '\n');
let files = 0, bytes = 0; const walk = (d) => { for (const n of fs.readdirSync(d)) { const f = path.join(d, n); const s = fs.statSync(f); if (s.isDirectory()) walk(f); else { files++; bytes += s.size; } } }; walk(out);
const hasApi = fs.existsSync(path.join(out, 'api', 'edit.mjs'));
console.log(`staged ${out}: ${files} files, ${(bytes / 1e6).toFixed(1)} MB, api/edit ${hasApi ? 'present' : 'absent'}, functions ${vercel.functions ? Object.keys(vercel.functions).join(',') : 'none'}, headers ${vercel.headers?.length ?? 0}`);
if (hasApi) console.log('the function needs, on the Vercel project (by name, at deploy time, on Eliran\'s go): FAL_KEY, OPENROUTER_API_KEY, and TOUR_EDIT_CODE (>= 8 chars) or TOUR_EDIT_OPEN=1');
