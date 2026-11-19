// fork E: put the two files the snapshot lacked (tokens.css, the legal caption) into the build-proof VM, then re-time package + qa
// with the VM-local raised bar (DIAGNOSTIC ONLY; the real gate verdict stays FAIL). usage: node diag-ship2.mjs <sandbox name>
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire('C:/RnD/.wt/sandbox-worker/Projects/Habait/habait-walkaround/Habait/tour360/tools/sandbox-worker/package.json');
const { Sandbox } = await import(pathToFileURL(req.resolve('@vercel/sandbox')).href);
const name = process.argv[2];
const sbx = await Sandbox.get({ name, resume: false });
if (sbx.status !== 'running') { console.log(`(${name} is ${sbx.status})`); process.exit(0); }
const HW = 'C:/RnD/.wt/sandbox-worker/Projects/Habait/habait-walkaround';
const L = 'C:/RnD/Projects/Habait/data/sales-plans/legal';
await sbx.writeFiles([
  { path: '/vercel/sandbox/hw/Habait/platform/css/tokens.css', content: fs.readFileSync(`${HW}/Habait/platform/css/tokens.css`) },
  { path: '/vercel/sandbox/hw/_data/legal/caption-v1.json', content: fs.readFileSync(`${L}/caption-v1.json`) },
  { path: '/vercel/sandbox/hw/_data/legal/disclaimer-he-en.md', content: fs.readFileSync(`${L}/disclaimer-he-en.md`) },
  { path: '/vercel/sandbox/run-script.sh', content: Buffer.from(fs.readFileSync(new URL('./diag-ship.sh', import.meta.url), 'utf8')
    .replace("for st in gate build package qa; do", "export HABAIT_LEGAL_DIR=$R/hw/_data/legal\nfor st in gate build package qa; do")), mode: 0o755 },
]);
const c = await sbx.runCommand({ cmd: 'bash', args: ['/vercel/sandbox/run-script.sh'] });
console.log(`exit ${c.exitCode}`); console.log((await c.stdout()).slice(-6000)); const e = await c.stderr(); if (e.trim()) console.log(`--- stderr\n${e.slice(-2500)}`);
