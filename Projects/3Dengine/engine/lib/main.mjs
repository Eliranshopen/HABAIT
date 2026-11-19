// "Is this module the script node was started with?" — so a module runs its main only when executed directly.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function isMain(argv1, moduleUrl) {
  if (!argv1) return false;
  const a = path.resolve(argv1);
  const b = fileURLToPath(moduleUrl);
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}
