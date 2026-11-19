import { createRequire } from 'module';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json');
const { chromium } = require('playwright-core');
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] });
const p = await (await b.newContext({ viewport: { width: 800, height: 450 } })).newPage();
await p.goto(process.argv[2]); await p.waitForFunction(() => window.__walk && window.__walk.ready, null, { timeout: 240000, polling: 1000 });
const r = await p.evaluate(async () => {
  const THREE = await import('three'); const w = window.__walk; const out = {};
  const rc = new THREE.Raycaster();
  for (const [k, from, dir] of [['bedA->W window', [5.75, 1.5, -1.1], [-1, 0, 0]], ['bedA->ceiling', [5.75, 1.5, -2.0], [0, 1, 0]], ['parents->ceiling', [10, 1.5, -9.5], [0, 1, 0]]]) {
    rc.set(new THREE.Vector3(...from), new THREE.Vector3(...dir)); rc.far = 6;
    out[k] = rc.intersectObjects(w.scene.children, true).slice(0, 5).map((h) => [h.object.name, h.object.material && h.object.material.name, +h.distance.toFixed(2), h.object.visible]);
  }
  return out;
});
console.log(JSON.stringify(r, null, 1)); await b.close();
