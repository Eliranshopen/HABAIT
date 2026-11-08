// Card 08 fallback: a build whose GLB has no atlas beside it (the Phase 1 GLB) opens from file:// with no lightmap,
// the Phase 1 live lights, and no page error.
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const F = 'file:///C:/Users/elira/AppData/Local/Temp/claude/76e6db1160dffba0/14c075f3-6b12-4fcf-9ea7-0c64802c7db7/scratchpad/fallback-dist/media/dollhouse.html';
(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const out = [];
  try {
    const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(F, { waitUntil: 'load' });
    await p.waitForFunction(() => window.__dollhouse && window.__dollhouse.loaded, null, { timeout: 90000 });
    const r = await p.evaluate(() => { let hemi = null; window.__dollhouseView.scene.traverse((o) => { if (o.isHemisphereLight) hemi = o.intensity; }); return { lm: window.__dollhouse.lightmap, hemi, tri: window.__dollhouse.triangles }; });
    await p.screenshot({ path: 'C:/RnD/development/tasks/dollhouse-in-tour/logs/frames/fallback_no_atlas_desktop_3d.png' });
    out.push([r.lm === null, `no lightmap in the fallback build (${JSON.stringify(r.lm)})`]);
    out.push([r.hemi === 1.05, `Phase 1 live lights (hemisphere ${r.hemi})`]);
    out.push([errs.length === 0, `no page errors ${errs.join(' | ')}`]);
  } finally { await b.close(); }
  const txt = out.map(([ok, m]) => `${ok ? 'ok  ' : 'FAIL'} ${m}`).join('\n');
  console.log(txt); require('fs').writeFileSync(__dirname + '/check-08-fallback.txt', txt + '\n');
  process.exit(out.every(([ok]) => ok) ? 0 : 1);
})();
