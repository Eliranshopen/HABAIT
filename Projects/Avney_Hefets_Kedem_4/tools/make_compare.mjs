// make_compare.mjs - his pictures beside the walk, room by room (2026-11-18, Eliran: «לינק של השוואה בין התמונות שאני סיפקתי לך לתמונות שאתה תייצר»).
// Shoots the walk (chrome hidden, 1376x768 = his pictures' aspect) at each room, writes gallery/compare.html.  $0, local.
// usage: node tools/make_compare.mjs <walk_site_dir> <gallery_dir> [port] [label]
import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'; import { execFileSync } from 'node:child_process';
const require = createRequire('C:/RnD/Projects/3Dengine/appdeps/package.json'); const { chromium } = require('playwright-core');
const [site, gal, portArg, label = 'ההליכה כרגע'] = process.argv.slice(2); const PORT = Number(portArg) || 8950;
const PICS = 'C:/RnD/Projects/Avney_Hefets_Kedem_4/בניין 1 קומה א דירה 7';
const ROOMS = [['01 סלון', 'living'], ['02 מטבח', 'kitchen'], ['03 פינת אוכל', 'dining'], ['04 מסדרון', 'corridor'], ['05 חדר שינה הורים', 'master'], ['06 מקלחת הורים', 'ensuite'], ['07 חדר שינה ממד', 'mamad'], ['08 חדר רחצה', 'bath'], ['09 חדר שינה 335-270', 'bedroom'], ['10 מרפסת', 'balcony']];
fs.mkdirSync(path.join(gal, 'cmp'), { recursive: true });
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2' };
const server = http.createServer((q, r) => { const f = path.resolve(site, '.' + decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404).end(); return; } r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); r.end(b); }); });
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const rows = [];
try {
  for (const [name, at] of ROOMS) {
    const src = fs.existsSync(path.join(PICS, `בניין 1 קומה א דירה 7 - ${name}.png`)) ? path.join(PICS, `בניין 1 קומה א דירה 7 - ${name}.png`) : `C:/RnD/Projects/Avney_Hefets_Kedem_4/בניין 1 קומה א דירה 7 - ${name}.png`;
    const his = path.join(gal, 'cmp', `${at}_his.jpg`), ours = path.join(gal, 'cmp', `${at}_ours.jpg`);
    execFileSync('python', ['-I', '-c', "import sys;from PIL import Image;im=Image.open(sys.argv[1]).convert('RGB');im.thumbnail((1376,1376));im.save(sys.argv[2],quality=84)", src, his]);
    const p = await (await b.newContext({ viewport: { width: 1376, height: 768 } })).newPage();
    await p.goto(`http://127.0.0.1:${PORT}/index.html?at=${at}&shot=1`); await p.waitForFunction(() => window.__walk3d && window.__walk3d.ready, null, { timeout: 180000 }); await p.waitForTimeout(1500);
    await p.screenshot({ path: ours, type: 'jpeg', quality: 84 }); await p.context().close();
    rows.push({ name: name.replace(/^\d+ /, ''), at });
    console.log('room', at);
  }
} finally { await b.close(); server.close(); }
const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>השוואה · אבני חפץ קדם דירה 7</title>
<style>body{margin:0;background:#1a1713;color:#f9f6f3;font:15px/1.4 Heebo,system-ui,sans-serif;padding:16px} h1{font-size:22px;margin:4px 0} p.s{color:rgba(249,246,243,.7);margin:0 0 14px}
.r{margin:0 0 22px} .r h2{font-size:17px;margin:0 0 8px;color:#eea927} .two{display:grid;grid-template-columns:1fr 1fr;gap:10px} figure{margin:0} img{width:100%;border-radius:10px;display:block} figcaption{font-size:12px;color:rgba(249,246,243,.7);margin-top:4px}
.badge{background:#eea927;color:#1a1713;border-radius:99px;padding:2px 10px;font-size:12px;font-weight:700} @media(max-width:760px){.two{grid-template-columns:1fr}}</style></head><body>
<h1>התמונות שלך מול ההליכה <span class="badge">הדמיה</span></h1><p class="s">מימין התמונה שסיפקת, משמאל ${label} מאותו חדר (מנקודת העמידה בחדר, לא באותה זווית בדיוק). נוצר ${new Date().toLocaleString('he-IL')}.</p>
${rows.map((r) => `<section class="r"><h2>${r.name}</h2><div class="two"><figure><img src="cmp/${r.at}_his.jpg" alt=""><figcaption>התמונה שלך</figcaption></figure><figure><img src="cmp/${r.at}_ours.jpg" alt=""><figcaption>${label}</figcaption></figure></div></section>`).join('')}
</body></html>`;
fs.writeFileSync(path.join(gal, 'compare.html'), html); console.log('COMPARE_OK', rows.length);
