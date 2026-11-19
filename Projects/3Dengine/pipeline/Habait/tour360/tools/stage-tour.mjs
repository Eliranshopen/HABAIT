#!/usr/bin/env node
/* Habait Tour360 — tools/stage-tour.mjs (apt846, 2026-10-28). Assembles the deploy folder of ONE apartment's tour for its own
   Vercel project, OUTSIDE the harness tree (standing law 3: never a Vercel command inside the tree): a copy of dist/<id>/ — the
   page, the media, api/edit (the typed change behind the unlock code) and its vercel.json — into <dir>/<project-name>, which the
   CLI names the project after. --no-api strips the function (a view-only link, the apartment-37 shape) and the `functions` key.
     node Habait/tour360/tools/stage-tour.mjs <id> <dir>/<project-name> [--no-api]
   Prints the file count and size; refuses a target inside the harness tree. $0. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOLS = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TOOLS, '..');
const REPO = path.resolve(ROOT, '..', '..');
const [, , id, outArg] = process.argv;
const noApi = process.argv.includes('--no-api');
if (!id || !outArg) { console.error('usage: stage-tour.mjs <id> <dir>/<project-name> [--no-api]'); process.exit(2); }
const out = path.resolve(outArg);
if (out.startsWith(path.resolve(REPO) + path.sep)) { console.error('refusing to stage inside the harness tree'); process.exit(2); }
const DIST = path.join(ROOT, 'dist', id);
if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.error(`dist/${id}/index.html missing — run build-tour.mjs ${id} first`); process.exit(1); }

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const copyDir = (from, to) => { fs.mkdirSync(to, { recursive: true }); for (const n of fs.readdirSync(from)) { const f = path.join(from, n), t = path.join(to, n); if (fs.statSync(f).isDirectory()) copyDir(f, t); else fs.copyFileSync(f, t); } };
for (const n of fs.readdirSync(DIST)) {
  if (noApi && n === 'api') continue;
  const f = path.join(DIST, n);
  if (fs.statSync(f).isDirectory()) copyDir(f, path.join(out, n)); else fs.copyFileSync(f, path.join(out, n));
}
const vercel = JSON.parse(fs.readFileSync(path.join(DIST, 'vercel.json'), 'utf8'));
if (noApi) delete vercel.functions;
fs.writeFileSync(path.join(out, 'vercel.json'), JSON.stringify(vercel, null, 2) + '\n');
let files = 0, bytes = 0; const walk = (d) => { for (const n of fs.readdirSync(d)) { const f = path.join(d, n); const s = fs.statSync(f); if (s.isDirectory()) walk(f); else { files++; bytes += s.size; } } }; walk(out);
const hasApi = fs.existsSync(path.join(out, 'api', 'edit.mjs'));
console.log(`staged ${out}: ${id} — ${files} files, ${(bytes / 1e6).toFixed(1)} MB, api/edit ${hasApi ? 'present' : 'absent'}, functions ${vercel.functions ? Object.keys(vercel.functions).join(',') : 'none'}, headers ${vercel.headers?.length ?? 0}`);
