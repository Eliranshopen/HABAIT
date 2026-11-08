/* Habait Tour360 — app-require.mjs (board habait-walkaround T18). The proof tools borrow playwright-core from the Habait app's
   node_modules. A git worktree of the harness has no `Habait/MVP/app/` (it is its own repo, gitignored), so this resolves the app
   in this tree first, then $HABAIT_APP_DIR, then the main checkout on this machine. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const MAIN_CHECKOUT_APP = 'D:/AgentTeams/RealEstateTeam/Habait/MVP/app';

export function appRequire(repoRoot) {
  for (const dir of [path.join(repoRoot, 'Habait', 'MVP', 'app'), process.env.HABAIT_APP_DIR, MAIN_CHECKOUT_APP]) {
    if (dir && fs.existsSync(path.join(dir, 'node_modules', 'playwright-core'))) return createRequire(path.join(dir, 'package.json'));
  }
  throw new Error('app-require: no Habait/MVP/app with node_modules/playwright-core (set HABAIT_APP_DIR)');
}
