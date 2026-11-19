// $0: the walk seen from about where Eliran's pictures were taken, controls hidden, written next to each picture
// (work/look/<nn>.jpg) as qa/compare/<nn>.jpg — the look check of the dressing pass (16_look_from_renders.py).
// Camera spots are read off the pictures by eye (plan metres, yaw 0 = north, + turns left): approximate, not measured.
import { createRequire } from 'module';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json');
const { chromium } = require('playwright-core');
const [url, outDir] = process.argv.slice(2);
const V = {
  '01': [6.5, 5.0, 1.2, -0.12, 'living → kitchen'], '02': [4.3, 7.4, 1.45, -0.12, 'kitchen'], '03': [6.4, 8.7, 2.5, -0.12, 'dining'],
  '05': [9.3, 8.75, -0.75, -0.22, 'parents'], '06': [8.45, 9.65, 0.75, -0.3, 'parents shower'], '09': [6.6, 3.7, 2.75, -0.2, 'bedroom 265/380'], '12': [6.75, 10.6, 1.75, -0.12, 'balcony'],
};
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1100, height: 614 } })).newPage(); const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(url, { waitUntil: 'load' });
await p.waitForFunction(() => window.__walk && window.__walk.ready, null, { timeout: 240000, polling: 1000 });
await p.addStyleTag({ content: 'body > *:not(canvas) { visibility:hidden !important; }' });
await p.evaluate(() => window.__walk.daynight && window.__walk.daynight.apply(12.5));
const shots = [];
for (const [k, [x, y, yaw, pitch]] of Object.entries(V)) {
  await p.evaluate(([x, y, yaw, pitch]) => { const w = window.__walk; w.me.x = x; w.me.y = y; w.me.yaw = yaw; w.me.pitch = pitch; w.me.goal = null; w.me.path = null; w.camera.fov = 75; w.camera.updateProjectionMatrix(); }, [x, y, yaw, pitch]);
  await p.waitForTimeout(2500); await p.screenshot({ path: `${outDir}/${k}-walk.png` }); shots.push(k);
}
await b.close(); console.log(JSON.stringify({ shots, errs }));
