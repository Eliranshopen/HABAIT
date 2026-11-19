// Step 20 - the room strip's thumbnails, taken from the walk itself (headless Chrome, UI hidden): walkaround/thumbs/<view>.png
// (20_room_thumbs then python resizes to .jpg). Usage: node scripts/20_room_thumbs.mjs <base url> <job dir>
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json');
const { chromium } = require('playwright-core');

const [base, job] = process.argv.slice(2);
const out = path.join(job, 'walkaround', 'thumbs');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 640, height: 380 } })).newPage();
await page.goto(`${base}/walkaround/`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__walk && window.__walk.ready && window.__items && [...window.__items.live.values()].every((p) => p.model), null, { timeout: 180000 });
await page.addStyleTag({ content: 'body > *:not(canvas){display:none!important}' });
await page.waitForTimeout(1500);
for (const v of Object.keys(await page.evaluate(() => window.__walk.grid.views))) {
  await page.evaluate((v) => { const w = window.__walk; const [u, vv, yaw] = w.grid.views[v]; w.me.x = u / 100; w.me.z = vv / 100; w.setYaw(yaw); w.me.pitch = -0.05; }, v);
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(out, v + '.png') });
}
await browser.close();
console.log('THUMBS OK', fs.readdirSync(out));
