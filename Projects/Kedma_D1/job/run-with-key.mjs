// kedma-d1: start one pipeline tool with FAL_KEY in its environment, the way skin-project.mjs starts its children.
// The key is read BY NAME from the keys file under the given root by the pipeline's own loader (file-ledger.mjs loadEnv); it is never printed or stored.
// usage: node run-with-key.mjs <env-root> <tool.mjs> [args...]
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [root, tool, ...args] = process.argv.slice(2);
const { loadEnv } = await import(pathToFileURL(path.join(path.dirname(path.resolve(tool)), 'file-ledger.mjs')).href);
const e = loadEnv(root);
if (!e.FAL_KEY) { console.error('run-with-key: FAL_KEY not found by name under ' + root); process.exit(1); }
const r = spawnSync('node', [tool, ...args], { stdio: 'inherit', env: { ...process.env, FAL_KEY: e.FAL_KEY, ...(e.OPENROUTER_API_KEY ? { OPENROUTER_API_KEY: e.OPENROUTER_API_KEY } : {}) } });
process.exit(r.status ?? 1);
