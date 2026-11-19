// fork E: run one bash command in a named sandbox (read-only diagnostics). usage: node vm-exec.mjs <name> <bash…>
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire('C:/RnD/.wt/sandbox-worker/Projects/Habait/habait-walkaround/Habait/tour360/tools/sandbox-worker/package.json');
const { Sandbox } = await import(pathToFileURL(req.resolve('@vercel/sandbox')).href);
const [name, ...rest] = process.argv.slice(2);
const sbx = await Sandbox.get({ name, resume: false });
if (sbx.status !== 'running') { console.log(`(${name} is ${sbx.status})`); process.exit(0); }
const c = await sbx.runCommand({ cmd: 'bash', args: ['-lc', rest.join(' ')] });
console.log((await c.stdout()).slice(-6000)); const e = await c.stderr(); if (e.trim()) console.log(`--- stderr\n${e.slice(-2000)}`);
