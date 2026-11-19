import { createRequire } from 'module';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json');
const { chromium } = require('playwright-core');
const [m, out] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] });
const p = await (await b.newContext({ viewport: { width: 500, height: 400 } })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
for (const a of [20, 120, 220]) { await p.goto(`http://127.0.0.1:8896/gen_view.html?m=${m}&a=${a}`, { timeout: 180000, waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => window.done, null, { timeout: 180000 }); await p.screenshot({ path: `${out}/${m}-${a}.png` }); }
console.log(JSON.stringify(errs)); await b.close();
