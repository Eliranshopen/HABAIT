// Card 08b look: the living room close up (the room focus a tap gives), desktop + iPhone 13, for two builds:
// painted (the work-tree dist) and clean (the lightmap-only build). file:// pages, no server.
const { chromium, devices } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const OUT = 'C:/RnD/.wt/apartment-3d/after/phase3';
const builds = { painted: 'file:///C:/RnD/.wt/apartment-3d/files/Projects/Habait/habait-walkaround/Habait/platform/_local/dist/rainbow/846/media/dollhouse.html',
  clean: 'file:///C:/Users/elira/AppData/Local/Temp/claude/76e6db1160dffba0/14c075f3-6b12-4fcf-9ea7-0c64802c7db7/scratchpad/clean-dist/media/dollhouse.html' };
const rooms = (process.argv[2] || 'r-living,r-bedroom-main,r-kitchen').split(',');
(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    for (const [name, url] of Object.entries(builds)) {
      for (const [dev, opts] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['phone', devices['iPhone 13']]]) {
        const p = await (await b.newContext(opts)).newPage();
        await p.goto(url, { waitUntil: 'load' });
        await p.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 90000 });
        for (const r of rooms) {
          await p.evaluate((id) => window.__dollhouseSelect(id), r);
          await p.waitForFunction(() => !window.__dollhouse.animating, null, { timeout: 30000 });
          await p.waitForTimeout(800);
          await p.screenshot({ path: `${OUT}/closeup_${r}_${dev}_${name}.png` });
        }
        await p.close();
      }
    }
  } finally { await b.close(); }
  console.log('done');
})();
