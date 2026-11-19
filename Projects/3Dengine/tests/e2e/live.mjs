// `node tests/e2e/m0.2.e2e.mjs --live [--dry]` — ONE conversation with the REAL model, on the owner's real setup:
// no fake model, no temp Pi folder, no HOME override, no engine overrides. Pi uses the user's own folder and
// provider login BY ITSELF; this script never reads, lists or prints anything from that folder, and never prints
// the pairing token (it reads it from the HABAIT_BRIDGE_TOKEN_FILE temp file the bridge writes).
// Spend is bounded by a hard brake: > 20 tool activities, > 8 minutes, or an unexpected card → abort, kill, exit 1.
// It never retries and sends no message beyond the first one and the one the approve button sends.
// `--dry` runs only the prerequisites and prints the plan; it starts nothing and spends nothing.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sleep, portFree, startProcess, killTree, pidAlive, httpGet, nodeProcessesMatching, listening, started } from './procs.mjs';

const posix = (p) => p.replace(/\\/g, '/');
const ENGINE_DIR = posix(fileURLToPath(new URL('../..', import.meta.url))).replace(/\/$/, '');
const UI_DIR = posix(process.env.HABAIT_UI_DIR || 'C:/HABAIT-Agent-UI');
const WRAPPER_DIR = posix(process.env.HABAIT_PI_WRAPPER_DIR || 'C:/pi-main/habait');
const LOG_DIR = posix(process.env.E2E_LIVE_LOG_DIR || 'C:/RnD/development/tasks/3dengine/logs/0.2/live');
const LIVE_ENGINE = 'C:/RnD/Projects/3Dengine';
const BRIDGE_PORT = 8787;
const APP_PORT = 4173;
const SERVE_PORT = 8891;
const FIXTURE = `${ENGINE_DIR}/tests/fixtures/sample.pdf`;
const MESSAGE = 'הכינו לי בבקשה הדמיה 360 מהתכנית שהעליתי, דירה 846.';
const MAX_TOOLS = 20;
const MAX_RUN_MS = 8 * 60 * 1000;
const BADGE = 'שחזור הדגמה';
const TOUR_MARKER = 'דירה 846';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ENDED = /העבודה נכשלה|העבודה בוטלה|העבודה נעצרה לבדיקה ידנית/;

class Brake extends Error {
  constructor(kind, message) { super(message); this.kind = kind; }
}

function locatePi() {
  const root = path.join(process.env.APPDATA ?? '', 'npm', 'node_modules', '@earendil-works', 'pi-coding-agent');
  const cli = posix(path.join(root, 'dist', 'bundle', 'cli.js'));
  if (!fs.existsSync(cli)) return null;
  return { cli, version: JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version };
}

function loadPlaywright() {
  for (const pkg of [process.env.PLAYWRIGHT_CORE_FROM, `${ENGINE_DIR}/appdeps/package.json`].filter(Boolean)) {
    try { return createRequire(pkg)('playwright-core'); } catch { /* next */ }
  }
  return null;
}

function newestMtime(dir) {
  let max = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    max = Math.max(max, e.isDirectory() ? newestMtime(p) : fs.statSync(p).mtimeMs);
  }
  return max;
}

/** A request to the bridge with the headers it requires (Host, allowed Origin, the pairing token). */
function bridgeRequest(method, route, token, body) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const req = http.request({ host: '127.0.0.1', port: BRIDGE_PORT, path: route, method,
      headers: { Origin: `http://127.0.0.1:${APP_PORT}`, Authorization: `Bearer ${token}`,
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': data.length } : {}) } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch { /* not json */ }
        resolve({ status: res.statusCode, json });
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => req.destroy(new Error(`${method} ${route} timed out`)));
    if (data) req.write(data);
    req.end();
  });
}

/** Tool names in call order, from the bridge's `[tool] <name>` log lines (one per tool_execution_start = one `activity` record). */
const toolsFromLog = (logFile) => (fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '')
  .split(/\r?\n/).map((l) => /\[tool\] (\S+)/.exec(l)?.[1]).filter(Boolean);

/* ---------- prerequisites (step 3): a missing one is a failure with its name, never a skip ---------- */
async function prerequisites(checks) {
  const need = (name, ok, detail = '') => { checks.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  prerequisite: ${name}${detail ? `  — ${detail}` : ''}`); return !!ok; };
  let ok = true;
  const cfgFile = `${UI_DIR}/bridge/config.json`;
  let cfg = null;
  try { cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8')); } catch { /* reported below */ }
  ok = need(`bridge config ${cfgFile} readable`, !!cfg) && ok;
  ok = need(`bridge config pi.cwd = ${LIVE_ENGINE}`, cfg?.pi?.cwd === LIVE_ENGINE, `pi.cwd = ${cfg?.pi?.cwd}`) && ok;
  ok = need('bridge config has engine.jobsDir', typeof cfg?.engine?.jobsDir === 'string', cfg?.engine?.jobsDir ?? '') && ok;
  ok = need('bridge writes its pairing token to HABAIT_BRIDGE_TOKEN_FILE (test tooling)',
    fs.existsSync(`${UI_DIR}/bridge/src/server.mjs`) && fs.readFileSync(`${UI_DIR}/bridge/src/server.mjs`, 'utf8').includes('HABAIT_BRIDGE_TOKEN_FILE')) && ok;
  ok = need(`bridge agentDir has the web extension (${cfg?.agentDir})`, !!cfg && fs.existsSync(`${cfg.agentDir}/extensions/habait-web/index.ts`)) && ok;
  ok = need(`Pi wrapper guard at ${WRAPPER_DIR}`, fs.existsSync(`${WRAPPER_DIR}/extensions/habait-guard/index.ts`)) && ok;
  ok = need('app has node_modules/vite', fs.existsSync(`${UI_DIR}/app/node_modules/vite/bin/vite.js`)) && ok;
  const pi = locatePi();
  ok = need('Pi CLI installed', !!pi, pi ? `Pi ${pi.version}` : '') && ok;
  ok = need(`Chrome at ${CHROME}`, fs.existsSync(CHROME)) && ok;
  ok = need('playwright-core loads (engine appdeps)', !!loadPlaywright()) && ok;
  ok = need('fixture tests/fixtures/sample.pdf', fs.existsSync(FIXTURE)) && ok;
  for (const p of [BRIDGE_PORT, APP_PORT, SERVE_PORT]) ok = need(`port ${p} is free`, await portFree(p)) && ok;
  if (pi) {
    // Pi reads its own folder; the output is checked for one line only and is never printed or saved.
    const r = spawnSync(process.execPath, [pi.cli, 'mcp', 'list'], { cwd: cfg?.pi?.cwd ?? LIVE_ENGINE, encoding: 'utf8', windowsHide: true, timeout: 90000 });
    ok = need('`pi mcp list` shows "habait-engine: connected, 8 tools"', `${r.stdout}`.includes('habait-engine: connected, 8 tools'), r.error ? r.error.message : '') && ok;
  }
  let build = 'not needed';
  if (fs.existsSync(`${UI_DIR}/app/src`)) {
    const dist = `${UI_DIR}/app/dist/index.html`;
    if (!fs.existsSync(dist)) build = 'needed (dist missing)';
    else if (fs.statSync(dist).mtimeMs < newestMtime(`${UI_DIR}/app/src`)) build = 'needed (dist older than src)';
  }
  return { ok, cfg, pi, build };
}

export async function runLive({ dry }) {
  const t0 = Date.now();
  const report = { test: 'm0.2.e2e --live', dry: !!dry, started_at: new Date().toISOString(), ok: false, ui_dir: UI_DIR, wrapper_dir: WRAPPER_DIR,
    prerequisites: [], steps: [], tools: [], tools_source: 'bridge log lines "[tool] <name>": the bridge logs one per tool_execution_start, the same event that writes each `activity` record on the /chat stream (the record itself carries the tool name, but the app drops it)',
    agent_texts: [], final_job: null, cost: 'not exposed: the /chat stream carries run.started, text.delta, activity, job, question, confirmation, status and run.* records only, and the bridge has no usage endpoint; Pi keeps usage in its own session file, which this script must not read',
    screenshots: [], console_errors: [], brake: null, cleanup: {}, error: null };
  const step = (name, ok = true, detail = '') => {
    report.steps.push({ step: name, ok, at: new Date().toISOString(), t_s: Math.round((Date.now() - t0) / 100) / 10, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'}  [${((Date.now() - t0) / 1000).toFixed(1)} s] ${name}${detail ? `  — ${detail}` : ''}`);
    if (!ok) throw new Error(`stopped: ${name}${detail ? ` — ${detail}` : ''}`);
  };

  const pre = await prerequisites(report.prerequisites);
  if (dry) {
    console.log(`\nDRY (nothing started, nothing spent). Prerequisites: ${pre.ok ? 'ALL PASS' : 'FAILED'}. The live run would:`);
    for (const l of [
      `app: ${UI_DIR}/app — build ${pre.build}; serve with vite preview on 127.0.0.1:${APP_PORT}`,
      `bridge: in place, ${UI_DIR}/bridge/src/server.mjs with its own config.json (Pi ${pre.pi?.version ?? '?'}, ${pre.cfg?.pi?.provider}/${pre.cfg?.pi?.model}, cwd ${pre.cfg?.pi?.cwd}); Pi uses the user's own folder and login`,
      'POST /session/new (a fresh conversation, no old history sent to the model)',
      `browser 1440×900: upload sample.pdf + a timestamp comment line (a fresh job), send «${MESSAGE}»`,
      'wait: job card with «שחזור הדגמה» ≤180 s → quote + «אשרו תקציב עד $60» ≤120 s → click → guard card ≤180 s (job file: no approval) → «לאשר» → approval.cap_usd 60 → 100 % + «פתחו את הסיור» ≤180 s → GET link = 200 + 846 tour',
      `brake: > ${MAX_TOOLS} tool activities, > 8 min, or an unexpected card → abort, kill, exit 1; never retries`,
      `evidence: ${LOG_DIR}/live-report.json, screenshots, bridge.log (pairing code removed)`,
    ]) console.log(`  - ${l}`);
    return pre.ok ? 0 : 1;
  }
  if (!pre.ok) { console.error('\nLIVE FAIL: prerequisites'); return 1; }

  fs.mkdirSync(LOG_DIR, { recursive: true });
  const ROOT = posix(fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'habait-live-'))));
  const bridgeLog = `${ROOT}/bridge.log`;
  const tokenFile = `${ROOT}/bridge.token`;
  const jobsDir = pre.cfg.engine.jobsDir;
  const deadline = t0 + MAX_RUN_MS;
  let browser = null; let bridge = null; let preview = null; let token = null; let page = null; let jobId = null;
  const allow = { approvals: 0 };
  let baseOther = 0;

  // The brake, checked on every poll of every wait.
  const brake = async () => {
    const tools = toolsFromLog(bridgeLog);
    if (tools.length > MAX_TOOLS) throw new Brake('tools', `${tools.length} tool activities (> ${MAX_TOOLS})`);
    if (Date.now() > deadline) throw new Brake('time', 'the run passed 8 minutes');
    if (!page) return;
    const found = await page.evaluate(({ approvals, baseOther, ended }) => {
      const vis = (el) => el.getClientRects().length > 0;
      const text = (el) => el.innerText.replace(/\s+/g, ' ').trim().slice(0, 600);
      const q = [...document.querySelectorAll('section.question')].filter(vis);
      if (q.length) return { kind: 'question card', text: text(q[0]) };
      const err = [...document.querySelectorAll('.errcard')].filter(vis);
      if (err.length) return { kind: 'error card', text: text(err[0]) };
      const ap = [...document.querySelectorAll('section.approval')].filter(vis);
      if (ap.length > approvals) return { kind: 'approval card not expected now', text: text(ap[ap.length - 1]) };
      const endedCard = [...document.querySelectorAll('section.jobcard')].find((c) => new RegExp(ended).test(c.innerText));
      if (endedCard) return { kind: 'job card in an end state', text: text(endedCard) };
      const other = [...document.querySelectorAll('section.card:not(.jobcard):not(.approval):not(.question)')].filter(vis);
      if (other.length > baseOther) return { kind: 'other card', text: text(other[other.length - 1]) };
      return null;
    }, { approvals: allow.approvals, baseOther, ended: ENDED.source }).catch(() => null);
    if (found) throw new Brake('card', `${found.kind}: ${found.text}`);
  };
  const until = async (what, fn, timeoutMs, everyMs = 300) => {
    const end = Date.now() + timeoutMs;
    for (;;) {
      await brake();
      const v = await fn();
      if (v) return v;
      if (Date.now() > end) throw new Error(`timed out after ${timeoutMs / 1000} s waiting for: ${what}`);
      await sleep(everyMs);
    }
  };
  const shot = async (name) => {
    if (!page) return;
    const f = `${LOG_DIR}/${name}.png`;
    await page.screenshot({ path: f }).catch(() => {});
    report.screenshots.push(f);
  };
  const readJob = (id) => { try { return JSON.parse(fs.readFileSync(`${jobsDir}/${id}/job.json`, 'utf8')); } catch { return null; } };

  let exit = 1;
  try {
    /* the app */
    if (pre.build !== 'not needed') {
      const b = spawnSync(process.execPath, [`${UI_DIR}/app/node_modules/vite/bin/vite.js`, 'build'], { cwd: `${UI_DIR}/app`, encoding: 'utf8', windowsHide: true, timeout: 300000 });
      step(`app built (${pre.build})`, b.status === 0, b.status === 0 ? '' : (b.stderr || '').slice(-300));
    }
    preview = startProcess('vite-preview', process.execPath, [`${UI_DIR}/app/node_modules/vite/bin/vite.js`, 'preview', '--host', '127.0.0.1', '--port', String(APP_PORT), '--strictPort'],
      { cwd: `${UI_DIR}/app`, env: process.env, logFile: `${ROOT}/preview.log` });
    await until('vite preview', async () => (await httpGet(`http://127.0.0.1:${APP_PORT}/`).catch(() => null))?.status === 200, 60000, 500);
    step(`app served by vite preview on ${APP_PORT}`);

    /* the bridge, in place, with its own config; Pi starts on the user's own setup */
    bridge = startProcess('bridge', process.execPath, [`${UI_DIR}/bridge/src/server.mjs`], { cwd: `${UI_DIR}/bridge`, env: { ...process.env, HABAIT_BRIDGE_TOKEN_FILE: tokenFile }, logFile: bridgeLog });
    const piState = await until('the bridge to start Pi', async () => {
      const t = fs.existsSync(bridgeLog) ? fs.readFileSync(bridgeLog, 'utf8') : '';
      if (/\[pi\] failed to start/.test(t) || bridge.exitCode !== null) return 'failed';
      return /\[pi\] ready/.test(t) ? 'ready' : null;
    }, 90000, 250);
    step('bridge started Pi in RPC mode', piState === 'ready');
    token = fs.readFileSync(tokenFile, 'utf8').trim();
    const fresh = await bridgeRequest('POST', '/session/new', token);
    step('a fresh Pi session (POST /session/new)', fresh.status === 200, `status ${fresh.status}`);

    /* the browser */
    const pw = loadPlaywright();
    browser = await pw.chromium.launch({ executablePath: CHROME, headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'he-IL' });
    await context.addInitScript((t) => { try { sessionStorage.setItem('habait.pi.pairing', t); } catch { /* none */ } }, token);
    page = await context.newPage();
    page.on('console', (m) => { if (m.type() === 'error') report.console_errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', (e) => report.console_errors.push(`pageerror: ${String(e.message).slice(0, 300)}`));
    const paired = page.waitForResponse((r) => r.url().endsWith('/pair'), { timeout: 60000 }).catch((e) => e);
    await page.goto(`http://127.0.0.1:${APP_PORT}/?agent=pi`, { waitUntil: 'domcontentloaded' });
    const pr = await paired;
    step('app paired with the bridge', !(pr instanceof Error) && pr.status() === 200);
    await sleep(800);
    baseOther = await page.locator('section.card:not(.jobcard):not(.approval):not(.question)').count();

    /* one conversation */
    const pdf = `${ROOT}/sample.pdf`;
    fs.writeFileSync(pdf, Buffer.concat([fs.readFileSync(FIXTURE), Buffer.from(`% e2e live run ${new Date().toISOString()}\n`, 'latin1')]));
    await page.locator('input[type=file]').setInputFiles(pdf);
    await until('the upload', async () => (await page.locator('.composer .chip').count()) > 0 && (await page.locator('.composer .chip .ring').count()) === 0, 30000);
    step('PDF uploaded (unique for this run)', (await page.locator('.composer .chip--error').count()) === 0);
    await page.locator('#composer-input').fill(MESSAGE);
    await page.locator('#composer button[type=submit]').click();
    step('message sent', true, MESSAGE);

    jobId = await until('the job card', async () => {
      const id = await page.locator('section.jobcard').first().getAttribute('id').catch(() => null);
      return id ? id.replace(/^job-/, '') : null;
    }, 180000);
    const card = page.locator(`#job-${jobId}`);
    step('job card with «שחזור הדגמה»', (await card.getByText(BADGE, { exact: true }).count()) > 0, jobId);
    await shot('1440-card');

    const approve = card.locator('button', { hasText: 'אשרו תקציב עד' });
    await until('the quote', async () => (await approve.count()) > 0, 120000);
    const label = (await approve.innerText()).replace(/\s+/g, ' ').trim();
    step('quote and «אשרו תקציב עד $60»', label === 'אשרו תקציב עד $60', (await card.locator('.card__sub').first().innerText()).replace(/\s+/g, ' '));
    await until('the model\'s turn to end (button enabled)', () => approve.isEnabled(), 120000, 500);
    await shot('1440-quote');

    allow.approvals = 1;
    await approve.click();
    step('approve button clicked (the one extra message)');
    const ap = page.locator('section.approval').last();
    await until('the guard card', async () => (await page.locator('section.approval').count()) > 0, 180000);
    const before = readJob(jobId);
    const title = (await ap.locator('.card__title').innerText()).trim();
    step('guard card before any approval in the job file', before?.state === 'awaiting_approval' && before?.approval === null,
      `${title}; state ${before?.state}, approval ${JSON.stringify(before?.approval)}`);
    await shot('1440-approval');
    await ap.locator('button', { hasText: 'לאשר' }).click();
    allow.approvals = 0;

    const approval = await until('approval in the job file', () => readJob(jobId)?.approval, 120000, 500);
    step('job file approval.cap_usd = 60', approval.cap_usd === 60, JSON.stringify(approval));
    const open = card.locator('a', { hasText: 'פתחו את הסיור' });
    await until('100 % and «פתחו את הסיור»', async () => (await open.count()) > 0, 180000, 500);
    const pct = (await card.locator('.badge.tabular').innerText()).trim();
    const href = await open.getAttribute('href');
    step('100 % and «פתחו את הסיור»', pct === '100%', `${pct} · ${href}`);
    await shot('1440-done');
    const tour = await httpGet(href);
    const tTitle = /<title>([^<]*)<\/title>/.exec(tour.body)?.[1] ?? '';
    step(`GET of the link = 200 with the 846 tour (<title> holds «${TOUR_MARKER}»)`, tour.status === 200 && tTitle.includes(TOUR_MARKER), `${tour.status} «${tTitle}»`);
    await until('the run to settle', async () => (await page.locator('.cbtn--stop').count()) === 0, 60000, 500).catch(() => {});
    exit = 0;
  } catch (e) {
    if (e instanceof Brake) {
      report.brake = { kind: e.kind, detail: e.message, at_s: Math.round((Date.now() - t0) / 1000) };
      console.error(`BRAKE  ${e.kind}: ${e.message}`);
      await shot('brake');
      if (token) await bridgeRequest('POST', '/abort', token).catch(() => {});
    } else {
      report.error = String(e?.stack || e).slice(0, 1500);
      console.error(`ERROR  ${e?.message || e}`);
      await shot('error');
    }
    exit = 1;
  } finally {
    report.tools = toolsFromLog(bridgeLog);
    if (token && bridge?.exitCode === null) {
      const s = await bridgeRequest('GET', '/session', token).catch(() => null);
      report.agent_texts = (s?.json?.messages ?? []).filter((m) => m.role === 'assistant').map((m) => m.text);
    }
    if (jobId) report.final_job = readJob(jobId);
    const done = {};
    if (browser) { await browser.close().catch(() => {}); done.browser = 'closed'; }
    if (bridge) done.bridge = killTree(bridge.pid); // Pi and its MCP server are its children
    if (preview) done.preview = killTree(preview.pid);
    if (jobId && fs.existsSync(`${jobsDir}/${jobId}/runner.pid`)) done.runner = killTree(Number(fs.readFileSync(`${jobsDir}/${jobId}/runner.pid`, 'utf8')));
    // Port 8891 was free at the start, so a server on it now is the one this run's job started.
    const serveJson = `${LIVE_ENGINE}/.runtime/serve.json`;
    if (!(await portFree(SERVE_PORT)) && fs.existsSync(serveJson)) {
      const pid = JSON.parse(fs.readFileSync(serveJson, 'utf8')).pid;
      done.engine_serve = killTree(pid);
    }
    await sleep(1500);
    const mine = nodeProcessesMatching([ROOT, `${UI_DIR}/bridge/src/server.mjs`, `${UI_DIR}/app/node_modules/vite`]);
    for (const p of mine) done[`leftover ${p.pid}`] = killTree(p.pid);
    const still = listening([BRIDGE_PORT, APP_PORT, SERVE_PORT]);
    report.cleanup = { actions: done, leftovers_killed: mine.map((p) => p.pid), listening_after: still,
      started: started.map((s) => `${s.name} ${s.pid} alive=${pidAlive(s.pid)}`) };
    if (mine.length || still.length) exit = 1;
    if (fs.existsSync(bridgeLog)) fs.writeFileSync(`${LOG_DIR}/bridge.log`, fs.readFileSync(bridgeLog, 'utf8').replace(/PAIRING-CODE:.*$/gm, 'PAIRING-CODE: (removed)'));
    try { fs.rmSync(ROOT, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch { /* reported by its absence */ }
    report.ok = exit === 0;
    report.finished_at = new Date().toISOString();
    report.duration_s = Math.round((Date.now() - t0) / 1000);
    fs.writeFileSync(`${LOG_DIR}/live-report.json`, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`\n${report.ok ? 'LIVE PASS' : 'LIVE FAIL'} in ${report.duration_s} s; tools: ${report.tools.join(', ') || '(none)'}; report ${LOG_DIR}/live-report.json`);
  }
  return exit;
}
