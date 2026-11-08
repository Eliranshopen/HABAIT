// Render the Studio dashboard (developer upload UI) from its files, answering /api/* from the project data on disk.
// Read-only: no server, no POST is honoured (all non-GET answer 405). usage: node cap_studio.cjs <outdir>
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const fs = require('fs'); const path = require('path');
const OUT = process.argv[2];
const S = 'C:/RnD/Projects/Habait/habait-walkaround/Habait/studio';
const PID = 'apt846-rainbow-tlv'; const PD = `${S}/_local/projects/${PID}`;
const rj = (f, d = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const meta = rj(`${PD}/project.json`, {}); const state = rj(`${PD}/state.json`, {}); const ledger = rj(`${PD}/ledger.json`, []);
const files = fs.existsSync(`${PD}/intake`) ? fs.readdirSync(`${PD}/intake`).filter((f) => !f.endsWith('.md')).map((name) => ({ name, size: fs.statSync(`${PD}/intake/${name}`).size })) : [];
const rows = Array.isArray(ledger) ? ledger : (ledger.rows || []);
const summary = { ...meta, id: PID, state, files, ledger: rows, ledger_usd: rows.reduce((a, r) => a + (+r.usd || +r.cost_usd || 0), 0), derived: [], intake: rj(`${PD}/derived/intake.json`), outputs: rj(`${PD}/outputs/tour.json`), running: false };
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ channel: 'msedge', headless: true });
  for (const [sz, opts] of Object.entries({ desk: { viewport: { width: 1440, height: 900 } }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true } })) {
    const p = await b.newPage(opts); const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
    await p.route('http://studio.local/**', (route) => {
      const u = new URL(route.request().url()); const m = route.request().method();
      if (m !== 'GET') return route.fulfill({ status: 405, body: '{}' });
      const j = (o) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
      if (u.pathname === '/api/env') return j({ llm: 'cli', fal: false, blender: 'C:/blender.exe' });
      if (u.pathname === '/api/styles') return j(rj(`${S}/styles/presets.json`, {}));
      if (u.pathname === '/api/stages') return j([]);
      if (u.pathname === '/api/projects') return j([{ ...meta, id: PID, running: false }]);
      if (u.pathname.startsWith('/api/projects/')) return j(summary);
      const f = path.join(`${S}/dashboard`, u.pathname === '/' ? 'index.html' : u.pathname);
      if (fs.existsSync(f)) return route.fulfill({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
      return route.fulfill({ status: 404, body: '' });
    });
    await p.goto('http://studio.local/'); await p.waitForTimeout(1500);
    await p.screenshot({ path: `${OUT}/${sz}_10_studio_empty.png`, fullPage: true });
    const li = await p.$('#project-list li'); if (li) { await li.click(); await p.waitForTimeout(1500); }
    await p.screenshot({ path: `${OUT}/${sz}_11_studio_project.png`, fullPage: true });
    console.log(sz, 'errs', JSON.stringify(errs));
    await p.close();
  }
  await b.close();
})();
