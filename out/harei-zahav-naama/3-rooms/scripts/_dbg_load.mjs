// debug: how heavy one frame is on the phone page (draw calls, triangles, textures, downloaded bytes) ($0)
import { createRequire } from 'node:module';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json');
const { chromium } = require('playwright-core');
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage();
const files = [];
p.on('response', async (r) => { try { const l = +(r.headers()['content-length'] || 0); files.push([r.url().split('/').slice(3).join('/'), l]); } catch {} });
await p.goto(process.argv[2]); await p.waitForFunction(() => window.__walk?.ready, null, { timeout: 120e3 });
await p.waitForTimeout(8000);
const info = await p.evaluate(() => {
  const w = window.__walk, r = w.renderer;
  let tri = 0, calls = 0, meshes = 0, texs = new Set(), big = [];
  const walk = (s) => s.traverse((o) => { if (o.isMesh) { meshes++; const n = o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; tri += n;
    for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'lightMap', 'emissiveMap']) { const t = o.material?.[k]; if (t?.image) texs.add(`${t.image.width}x${t.image.height}`); } } });
  walk(w.scene); const sceneTri = tri; walk(w.overlay);
  r.info.autoReset = true;
  return { pixelRatio: r.getPixelRatio(), canvas: [r.domElement.width, r.domElement.height], meshes, sceneTri: Math.round(sceneTri), overlayTri: Math.round(tri - sceneTri),
    textures: [...texs].reduce((a, k) => (a[k] = (a[k] || 0) + 1, a), {}), gpuMem: r.info.memory, render: r.info.render, overlayKids: w.overlay.children.length };
});
const tot = files.reduce((a, f) => a + f[1], 0);
console.log(JSON.stringify({ ...info, downloadedMB: +(tot / 1e6).toFixed(1), biggest: files.sort((a, c) => c[1] - a[1]).slice(0, 8).map((f) => [f[0].slice(0, 50), +(f[1] / 1e6).toFixed(2)]) }, null, 0));
await b.close();
