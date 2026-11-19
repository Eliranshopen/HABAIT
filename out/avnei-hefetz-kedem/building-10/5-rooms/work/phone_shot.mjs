import { createRequire } from 'module';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json');
const { chromium } = require('playwright-core');
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'] });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage(); const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(process.argv[2], { timeout: 240000 }); await p.waitForFunction(() => window.__walk && window.__walk.ready, null, { timeout: 300000, polling: 1000 });
await p.waitForTimeout(4000); await p.screenshot({ path: process.argv[3] }); console.log(JSON.stringify(errs)); await b.close();
