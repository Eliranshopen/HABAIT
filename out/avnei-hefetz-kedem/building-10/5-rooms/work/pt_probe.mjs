import { createRequire } from 'module';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json');
const { chromium } = require('playwright-core');
const [url, angle] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: [`--use-angle=${angle}`, '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1100, height: 614 } })).newPage(); const errs = [];
p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text().slice(0, 200)); });
await p.goto(url, { waitUntil: 'load' });
await p.waitForFunction(() => window.__walk && window.__walk.ready, null, { timeout: 300000, polling: 1000 });
const gpu = await p.evaluate(() => { const gl = window.__walk.renderer.getContext(); const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; });
const rows = [];
for (let i = 0; i < 12; i++) { await p.waitForTimeout(10000); rows.push(await p.evaluate(() => { const P = window.__walk.PT; return P ? [P.samples, P.pt.isCompiling] : null; })); }
console.log(JSON.stringify({ gpu, rows, errs: errs.slice(0, 6) })); await b.close();
