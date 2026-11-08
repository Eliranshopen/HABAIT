// fix-disclosure-badge: the tour in the buyer flow (ui=min) must show the badge, concept, AI note and the tools column.
// Starts serve-dist from the WORKTREE on :8871, shoots desktop + phone, measures, kills the server.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const WT = 'C:/RnD/.wt/fix-disclosure-badge/Projects/Habait/habait-walkaround';
const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const require = createRequire(path.join(process.env.HABAIT_APP_DIR, 'node_modules', 'x.js'));
const { chromium } = require('playwright-core');
const chrome = process.env.CHROME_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);

const srv = spawn(process.execPath, [path.join(WT, 'Habait/tour360/tools/serve-dist.mjs'), 'apt846', '--port', '8871'], { stdio: 'ignore' });
const result = { server_pid: srv.pid, runs: [] };
try {
  await new Promise((r) => setTimeout(r, 1500));
  const browser = await chromium.launch({ executablePath: chrome, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const url = 'http://127.0.0.1:8871/?scope=apartment&room=terraceLiving&floor=parquet&video=0&from=flight&ui=min&lang=he';
  for (const [name, vp, mobile] of [['desktop', { width: 1440, height: 900 }, false], ['phone', { width: 390, height: 844 }, true]]) {
    const ctx = await browser.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile, locale: 'he-IL' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(url, { waitUntil: 'load', timeout: 90000 });
    await page.waitForTimeout(6000);
    const m = await page.evaluate(() => {
      const ids = ['tour-badge', 't-tools', 'tour-ai-note', 'tour-concept', 't-title', 't-lang'];
      const o = { uiMin: document.documentElement.classList.contains('ui-min') };
      for (const id of ids) {
        const el = document.getElementById(id) || document.querySelector('.' + id);
        if (!el) { o[id] = null; continue; }
        const cs = getComputedStyle(el), r = el.getBoundingClientRect();
        o[id] = { display: cs.display, visible: cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0,
          box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], text: (el.textContent || '').trim().slice(0, 60) };
      }
      o.hScroll = document.documentElement.scrollWidth > innerWidth;
      return o;
    });
    await page.screenshot({ path: path.join(OUT, `tour-uimin-${name}.png`) });
    result.runs.push({ name, url, measure: m, errors });
    await ctx.close();
  }
  await browser.close();
} finally {
  srv.kill();
}
writeFileSync(path.join(OUT, 'tour-check.json'), JSON.stringify(result, null, 1));
console.log(JSON.stringify(result, null, 1));
