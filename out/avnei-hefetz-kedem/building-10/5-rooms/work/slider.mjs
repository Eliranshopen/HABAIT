import { createRequire } from 'module';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json');
const { chromium } = require('playwright-core');
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const p = await b.newPage({ viewport: { width: 800, height: 600 } });
await p.goto('http://127.0.0.1:8896/index.html'); await p.waitForFunction(() => window.__walk && window.__walk.ready, null, { timeout: 240000, polling: 1000 });
console.log(await p.evaluate(() => {
  const w = window.__walk, o = w.G.openings.find((q) => q.id === 'SD-living-N');
  const lines = ['r=' + o.r.map((v) => v.toFixed(2)) + ' open=' + JSON.stringify(o._open), 'walkOpen=' + JSON.stringify(w.walkOpen.map((r) => r.map((v) => +v.toFixed(2))))];
  const x = o.r[0] + (o._open[0] + o._open[1]) / 2;
  for (let y = o.r[1] - 0.8; y <= o.r[3] + 0.8; y += 0.1) lines.push(`x ${x.toFixed(2)} y ${y.toFixed(2)} ok=${w.ok(x, y)} freeAt=${w.freeAt(x, y)} wall=${w.inWall(x, y)} blk=${w.blockers.some((r) => x > r[0] - 0.12 && x < r[2] + 0.12 && y > r[1] - 0.12 && y < r[3] + 0.12)}`);
  return lines.join('\n');
}));
await b.close();
