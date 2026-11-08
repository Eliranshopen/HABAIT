// Hold idle-glide probe (Eliran 2026-11-04 via rnd-67: "the picture keeps rotating and looks like a freeze" after the clip).
// usage: node glide-probe.cjs <base> <label> <outdir>  — per width (1440, 390): platform link -> /hold/ -> wait for the clip to end
// on its own (no skip) -> 7 screenshots 1 s apart -> mean abs pixel difference between consecutive shots (0 = the picture rests).
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const fs = require('fs'); const { execFileSync } = require('child_process');
const [BASE, LABEL, OUT] = [process.argv[2].replace(/\/$/, ''), process.argv[3], process.argv[4]];
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms, step = 250) { const t0 = Date.now(); for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() - t0 > ms) return null; await sleep(step); } }
(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const rows = [];
  for (const [w, h, mob] of [[1440, 900, false], [390, 844, true]]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, isMobile: mob, hasTouch: mob });
    await p.goto(`${BASE}/?project=rainbow`, { waitUntil: 'domcontentloaded' });
    const href = await until(() => p.evaluate(() => { const a = document.getElementById('heroCta'); return a && !a.hidden && /\/hold\//.test(a.href) ? a.href : null; }), 15000);
    await p.goto(href, { waitUntil: 'domcontentloaded' });
    // the clip ends by itself (no skip): the building button shows only at the hold, after the clip
    const atHold = await until(() => p.evaluate(() => getComputedStyle(document.getElementById('buildingBtn')).display === 'block'), 60000, 300);
    const shots = [];
    for (let i = 0; i < 7; i++) { const f = `${OUT}/${LABEL}-${w}-${i}.png`; await p.screenshot({ path: f }); shots.push(f); await sleep(1000); }
    const diffs = [];
    for (let i = 1; i < shots.length; i++) {
      const out = execFileSync('ffmpeg', ['-v', 'error', '-i', shots[i - 1], '-i', shots[i], '-filter_complex', '[0][1]blend=all_mode=difference,format=gray,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-', '-f', 'null', '-'], { encoding: 'utf8' });
      diffs.push(+(/YAVG=([0-9.]+)/.exec(out) || [0, -1])[1]);
    }
    execFileSync('ffmpeg', ['-v', 'error', '-y', ...shots.flatMap((s) => ['-i', s]), '-filter_complex', `${shots.map((_, i) => `[${i}]scale=${w === 390 ? 160 : 320}:-1[s${i}]`).join(';')};${shots.map((_, i) => `[s${i}]`).join('')}hstack=${shots.length}`, `${OUT}/${LABEL}-${w}-strip.jpg`]);
    rows.push({ label: LABEL, width: w, atHold: !!atHold, diffs: diffs.map((d) => Math.round(d * 100) / 100), maxDiff: Math.max(...diffs) });
    await p.close();
  }
  await b.close();
  console.log(JSON.stringify(rows));
})().catch((e) => { console.error('ERR', e.message); process.exit(2); });
