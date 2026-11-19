// Step 21 - clean frames of the walk (UI hidden) at chosen standpoints, for the realism pass (step 22).
// Usage: node scripts/21_walk_frames.mjs <base url> <out dir> <name:u,v,yawDeg,pitch> ...
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json');
const { chromium } = require('playwright-core');
const [base, out, ...shots] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 1536, height: 1024 } })).newPage();
await page.goto(`${base}/walkaround/?dn=0`, { waitUntil: 'load' });   // the walk's own bake: the skin's reference light (daynight.json skin_key 'base')
await page.waitForFunction(() => window.__walk && window.__walk.ready && window.__items && [...window.__items.live.values()].every((p) => p.model), null, { timeout: 180000 });
await page.addStyleTag({ content: 'body > *:not(canvas){display:none!important}' });
await page.waitForTimeout(1500);
for (const s of shots) {
  const [name, rest] = s.split(':'); const [u, v, yaw, pitch] = rest.split(',').map(Number);
  await page.evaluate(([u, v, yaw, pitch]) => { const w = window.__walk; w.me.x = u / 100; w.me.z = v / 100; w.setYaw(yaw); w.me.pitch = pitch; w.me.dist = 0; }, [u, v, yaw, pitch]);
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(out, name + '.png') });
  console.log('FRAME', name);
}
await browser.close();
