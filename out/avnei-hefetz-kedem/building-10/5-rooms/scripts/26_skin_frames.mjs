// Step 26 ($0) - clean frames of the walk (controls hidden, baked light at noon) at the standpoints of step 25, for the realism pass.
// The same camera numbers go into views for the projection (step 28): pos (three.js), yaw, pitch, fov_v, w, h.
// Usage: node scripts/26_skin_frames.mjs <walk url> <job root>
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json');
const { chromium } = require('playwright-core');
const [url, root] = process.argv.slice(2);
const V = JSON.parse(fs.readFileSync(path.join(root, 'work/realism/views.json'), 'utf8'));
const out = path.join(root, 'work/realism/frames'); fs.mkdirSync(out, { recursive: true });
const W = 1536, H = 1024, FOV = 68;
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: W, height: H } })).newPage(); const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(url, { timeout: 240000 });
await p.waitForFunction(() => window.__walk && window.__walk.ready && window.__walk.SKILL, null, { timeout: 300000, polling: 1000 });
await p.addStyleTag({ content: 'body > *:not(canvas){visibility:hidden!important}' });
await p.evaluate(() => window.__walk.daynight.apply(12.5));
await p.waitForTimeout(4000);
const cams = [];
for (const v of V) {
  const cam = await p.evaluate(([v, fov]) => {
    const w = window.__walk; w.me.x = v.x; w.me.y = v.y; w.me.yaw = v.yaw; w.me.pitch = v.pitch; w.me.dist = 0; w.me.goal = null; w.me.path = null;
    w.camera.fov = fov; w.camera.updateProjectionMatrix();
    return new Promise((ok) => setTimeout(() => { const c = w.camera; ok({ pos: c.position.toArray(), yaw: c.rotation.y, pitch: c.rotation.x }); }, 1200));
  }, [v, FOV]);
  await p.screenshot({ path: path.join(out, v.name + '.png') });
  cams.push({ ...v, ...cam, fov_v: FOV, w: W, h: H });
  console.log('FRAME', v.name);
}
fs.writeFileSync(path.join(root, 'work/realism/cams.json'), JSON.stringify(cams, null, 1));
console.log(JSON.stringify({ frames: cams.length, errs }));
await b.close();
