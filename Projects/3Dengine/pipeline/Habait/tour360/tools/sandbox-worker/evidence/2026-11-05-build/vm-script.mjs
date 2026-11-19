// fork E: upload a local bash script into a named sandbox and run it, printing its output. usage: node vm-script.mjs <name> <local.sh>
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire('C:/RnD/.wt/sandbox-worker/Projects/Habait/habait-walkaround/Habait/tour360/tools/sandbox-worker/package.json');
const { Sandbox } = await import(pathToFileURL(req.resolve('@vercel/sandbox')).href);
const [name, file] = process.argv.slice(2);
const sbx = await Sandbox.get({ name, resume: false });
if (sbx.status !== 'running') { console.log(`(${name} is ${sbx.status})`); process.exit(0); }
await sbx.writeFiles([{ path: '/vercel/sandbox/run-script.sh', content: fs.readFileSync(file), mode: 0o755 }]);
const c = await sbx.runCommand({ cmd: 'bash', args: ['/vercel/sandbox/run-script.sh'] });
console.log(`exit ${c.exitCode}`); console.log((await c.stdout()).slice(-6000)); const e = await c.stderr(); if (e.trim()) console.log(`--- stderr\n${e.slice(-2500)}`);
