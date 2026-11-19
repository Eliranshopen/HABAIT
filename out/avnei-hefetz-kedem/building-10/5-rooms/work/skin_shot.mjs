import fs from 'node:fs';
import { createRequire } from 'module';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json');
const { chromium } = require('playwright-core');
const cams = JSON.parse(fs.readFileSync('work/realism/cams.json', 'utf8'));
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] });
const p = await (await b.newContext({ viewport: { width: 1536, height: 1024 } })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://127.0.0.1:8896/index.html', { timeout: 240000 }); await p.waitForFunction(() => window.__walk && window.__walk.ready && window.__walk.SKILL, null, { timeout: 300000, polling: 1000 });
await p.addStyleTag({ content: 'body > *:not(canvas){visibility:hidden!important}' });
await p.evaluate(() => window.__walk.daynight.apply(12.5)); await p.waitForTimeout(4000);
for (const n of process.argv.slice(2)) { const v = cams.find((c) => c.name === n);
  await p.evaluate((v) => { const w = window.__walk; w.me.x = v.x; w.me.y = v.y; w.me.yaw = v.yaw; w.me.pitch = v.pitch; w.camera.fov = 68; w.camera.updateProjectionMatrix(); }, v);
  await p.waitForTimeout(1500); await p.screenshot({ path: `qa/gen/skin-walk-${n}.png` }); }
console.log(JSON.stringify(errs)); await b.close();
