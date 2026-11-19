// $0: open the walkthrough in headless Chrome and save its own scene as scene/apartment-walk.glb
import fs from 'node:fs';
import { createRequire } from 'module';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json');
const { chromium } = require('playwright-core');
const [url, out] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const p = await b.newPage({ viewport: { width: 800, height: 600 } });
await p.goto(url); await p.waitForFunction(() => window.__walk && window.__walk.ready, null, { timeout: 240000, polling: 1000 });
await p.waitForTimeout(5000);
const b64 = await p.evaluate(() => window.__walk.exportGLB());
fs.writeFileSync(out, Buffer.from(b64, 'base64')); console.log('GLB', out, fs.statSync(out).size);
await b.close();
