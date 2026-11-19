import { createRequire } from 'node:module';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json');
const { chromium } = require('playwright-core');
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--enable-webgl', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1536, height: 1024 } })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
await p.goto('http://127.0.0.1:8895/walkaround/?skin=skin_test', { waitUntil: 'load' });
await p.waitForFunction(() => window.__items && [...window.__items.live.values()].every((q) => q.model), null, { timeout: 180000 });
await p.addStyleTag({ content: 'body > *:not(canvas){display:none!important}' });
for (const [n, u, v, yaw, pitch] of [['living', 765, 640, 159, -0.08], ['tvwall', 560, 880, -90, -0.05], ['between', 680, 820, -120, -0.06], ['kitchen', 420, 760, 160, -0.08]]) {
  await p.evaluate(([u, v, yaw, pitch]) => { const w = window.__walk; w.me.x = u / 100; w.me.z = v / 100; w.setYaw(yaw); w.me.pitch = pitch; }, [u, v, yaw, pitch]);
  await p.waitForTimeout(900); await p.screenshot({ path: `qa/upgrade/skin-${n}.png` });
}
console.log('errors', JSON.stringify(errs)); await b.close();
