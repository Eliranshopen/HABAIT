import { createRequire } from 'module';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json');
const { chromium } = require('playwright-core');
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] });
const p = await (await b.newContext({ viewport: { width: 900, height: 700 } })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
for (const [n, q] of [['top', 'top=1&nolid=1'], ['a40', 'a=40&nolid=1']]) { await p.goto(`http://127.0.0.1:8896/gen_view.html?m=user_model&${q}`, { timeout: 240000 }); await p.waitForFunction(() => window.done, null, { timeout: 240000 }); await p.screenshot({ path: `qa/gen/user-${n}.png` }); }
console.log(JSON.stringify(errs)); await b.close();
