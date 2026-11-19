/* Set FAL_KEY on a linked Vercel project, the RAINBOW way (2026-11-10 rainbow-v2-test): the value is read by NAME
   through loadEnv and written to `vercel env add` on stdin; it is never printed, logged or written to disk.
   Eliran 2026-11-18: «זה כן אפשרי שלינק של VERCEL ישתמש בFAL KEY שקיים לנו פה … עשינו את זה בפרויקט של RAINBOW».
   Usage: node scripts/24_vercel_key.mjs <linked-deploy-dir> [--go]   (dry-run without --go)                     */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { loadEnv } from '../../../../../../Projects/3Dengine/pipeline/Habait/tour360/tools/file-ledger.mjs';

const dir = path.resolve(process.argv[2] || '');
const GO = process.argv.includes('--go');
const env = loadEnv('C:/RnD');
if (!env.FAL_KEY) { console.error('FAL_KEY: missing (checked by name)'); process.exit(1); }
console.log('FAL_KEY: present (by name) · project dir', dir);
if (!GO) { console.log('dry-run: would run `vercel env add FAL_KEY production` with the value on stdin'); process.exit(0); }
const run = (args, input) => spawnSync('vercel', args, { cwd: dir, input, encoding: 'utf8', shell: true, timeout: 120e3 });
run(['env', 'rm', 'FAL_KEY', 'production', '--yes']);              // replace an older value if one is there
const r = run(['env', 'add', 'FAL_KEY', 'production'], env.FAL_KEY);
const scrub = (s) => (s || '').split(env.FAL_KEY).join('<hidden>');
if (r.status !== 0) { console.error('vercel env add failed:', scrub(r.stderr).slice(-400)); process.exit(1); }
if (process.argv.includes('--open')) {   // the RAINBOW open host: every visitor may use the typed change (guarded by the handler's IP limit + $5/day cap)
  run(['env', 'rm', 'TOUR_EDIT_OPEN', 'production', '--yes']);
  const o = run(['env', 'add', 'TOUR_EDIT_OPEN', 'production'], '1');
  if (o.status !== 0) { console.error('TOUR_EDIT_OPEN failed'); process.exit(1); }
}
const ls = run(['env', 'ls', 'production']);
console.log(scrub(ls.stdout).split('\n').filter((l) => /FAL_KEY/.test(l)).join('\n') || 'FAL_KEY not listed?');
