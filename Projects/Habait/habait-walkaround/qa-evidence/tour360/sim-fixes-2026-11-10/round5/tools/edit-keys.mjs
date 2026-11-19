// 2026-11-10 (Eliran: «איפה השורת טקסט חופשי … למה לא החזרת את זה?»): the tour's free-text edit needs its keys on the host. This sets the
// NAMES FAL_KEY, OPENROUTER_API_KEY and TOUR_EDIT_OPEN=1 on the Vercel project the stage folder is linked to (rainbow-v2-test), as
// habait-flow has them. Values are read by name with the tools' own loader and go to `vercel env add` on stdin; nothing is printed.
// usage: node edit-keys.mjs <stage dir linked to the Vercel project>
import { spawnSync } from 'node:child_process';
import { loadEnv } from 'file:///C:/RnD/Projects/Habait/habait-walkaround/Habait/tour360/tools/file-ledger.mjs';
const env = loadEnv('C:/RnD/Projects/Habait/habait-walkaround'); const cwd = process.argv[2];
for (const [name, value] of [['FAL_KEY', env.FAL_KEY], ['OPENROUTER_API_KEY', env.OPENROUTER_API_KEY], ['TOUR_EDIT_OPEN', '1']]) {
  if (!value) { console.log(name, 'MISSING locally — not set'); continue; }
  spawnSync('npx', ['--yes', 'vercel', 'env', 'rm', name, 'production', '--yes'], { cwd, shell: true, encoding: 'utf8' });
  const r = spawnSync('npx', ['--yes', 'vercel', 'env', 'add', name, 'production'], { cwd, shell: true, input: value, encoding: 'utf8' });
  console.log(name, r.status === 0 ? 'set' : 'FAILED ' + String(r.stderr || '').replace(value, '***').split('\n').filter((l) => /error/i.test(l)).join(' ').slice(0, 160));
}
