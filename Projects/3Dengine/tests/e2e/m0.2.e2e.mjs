// Milestone 0.2 — the END-TO-END test: browser → bridge → Pi (RPC) → a scripted fake model → the engine's
// MCP tools → the stub runner's job files → the bridge → the app's job card. No language model, no
// provider, no network beyond 127.0.0.1, no paid call, and the user's own Pi folder is never used:
// Pi runs on a temp agent folder (PI_CODING_AGENT_DIR) with HOME/USERPROFILE pointed at a temp folder.
//
//   node tests/e2e/m0.2.e2e.mjs        (npm run test:e2e)
//
// Env: HABAIT_UI_DIR (default C:/HABAIT-Agent-UI/.wt/engine-mcp), HABAIT_PI_WRAPPER_DIR (default
// C:/pi-main/habait/.wt/engine-mcp), E2E_LOG_DIR, E2E_BRIDGE_PORT (8787), E2E_APP_PORT (4173),
// ENGINE_STUB_STEP_MS (1000), E2E_KEEP=1 keeps the temp folder. Exit 0 only when every assertion holds.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startFakeModel } from './fake-model.mjs';
import {
  started, sleep, portFree, freePort, startProcess, pidAlive, killTree, waitFor, httpGet, serveStatic,
  nodeProcessesMatching, listening,
} from './procs.mjs';

// `--live [--dry]`: ONE conversation with the REAL model on the owner's real setup (tests/e2e/live.mjs).
if (process.argv.includes('--live')) {
  const { runLive } = await import('./live.mjs');
  process.exit(await runLive({ dry: process.argv.includes('--dry') }));
}

const posix = (p) => p.replace(/\\/g, '/');
const ENGINE_DIR = posix(fileURLToPath(new URL('../..', import.meta.url))).replace(/\/$/, '');
const UI_DIR = posix(process.env.HABAIT_UI_DIR || 'C:/HABAIT-Agent-UI/.wt/engine-mcp');
const WRAPPER_DIR = posix(process.env.HABAIT_PI_WRAPPER_DIR || 'C:/pi-main/habait/.wt/engine-mcp');
// Where the report and the screenshots go. By default a folder in the temp directory, so a plain run never
// rewrites the tracked evidence of a closed milestone; a gate that keeps evidence names the folder itself:
// E2E_LOG_DIR=C:/RnD/development/tasks/3dengine/logs/<milestone>/e2e
const LOG_DIR = posix(process.env.E2E_LOG_DIR || path.join(os.tmpdir(), 'habait-engine-e2e'));
const BRIDGE_PORT = Number(process.env.E2E_BRIDGE_PORT || 8787);
const APP_PORT = Number(process.env.E2E_APP_PORT || 4173); // the bridge's allowed origins: 4173 / 5173 only
const STEP_MS = Number(process.env.ENGINE_STUB_STEP_MS || 1000);
const BASE_CONFIG = JSON.parse(fs.readFileSync(`${ENGINE_DIR}/engine.config.json`, 'utf8'));
const CHROME = process.env.CHROME_PATH || BASE_CONFIG.chrome;
const FIXTURE = `${ENGINE_DIR}/tests/fixtures/sample.pdf`;
const T = 'mcp__habait_engine__';
const TOOLS8 = ['engine_status', 'inspect_plan', 'start_simulation', 'get_job', 'approve_paid_stage', 'get_result', 'cancel_job', 'list_jobs'];
const TOUR_MARKER = 'דירה 846'; // in the <title> of the staged tour page: «סיור 360° · דירה 846 · קומה 16 · …»
const BADGE = 'שחזור הדגמה';

/* ---------- the report ---------- */
const report = { test: 'm0.2.e2e', started_at: new Date().toISOString(), ok: false, step_ms: STEP_MS, dirs: { ENGINE_DIR, UI_DIR, WRAPPER_DIR },
  assertions: [], screenshots: [], overflow: [], console_errors: [], observed_percents: {}, fake_model: [], cleanup: {}, error: null };
let failures = 0;
function check(name, ok, detail = '') {
  report.assertions.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  if (!ok) failures++;
  return !!ok;
}
/** A check whose failure stops the run (the next steps depend on it). */
function must(name, ok, detail) {
  if (!check(name, ok, detail)) throw new Error(`stopped: ${name}${detail ? ` — ${detail}` : ''}`);
}

/* ---------- prerequisites: a missing one is a failure, never a skip ---------- */
function locatePi() {
  const root = path.join(process.env.APPDATA ?? '', 'npm', 'node_modules', '@earendil-works', 'pi-coding-agent');
  const cli = posix(path.join(root, 'dist', 'bundle', 'cli.js'));
  if (!fs.existsSync(cli)) return null;
  return { cli, version: JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version };
}

async function prerequisites() {
  const need = (what, ok) => must(`prerequisite: ${what}`, ok);
  need(`UI worktree has bridge/src/server.mjs (${UI_DIR})`, fs.existsSync(`${UI_DIR}/bridge/src/server.mjs`));
  need('UI app has node_modules/vite', fs.existsSync(`${UI_DIR}/app/node_modules/vite/bin/vite.js`));
  need(`Pi wrapper has install-global.py and both extensions (${WRAPPER_DIR})`, fs.existsSync(`${WRAPPER_DIR}/install-global.py`)
    && fs.existsSync(`${WRAPPER_DIR}/extensions/habait-guard/index.ts`) && fs.existsSync(`${WRAPPER_DIR}/extensions/habait-web/index.ts`));
  const pi = locatePi();
  need('Pi CLI installed (npm -g @earendil-works/pi-coding-agent)', !!pi);
  report.pi_version = pi.version;
  need(`Chrome at ${CHROME}`, fs.existsSync(CHROME));
  need(`staged tour page ${BASE_CONFIG.stub.siteRoot}/tour/index.html`, fs.existsSync(`${BASE_CONFIG.stub.siteRoot}/tour/index.html`));
  need('fixture tests/fixtures/sample.pdf', fs.existsSync(FIXTURE));
  const py = spawnSync('python', ['--version'], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  need('python on PATH (runs the wrapper installer)', py.status === 0);
  for (const p of [BRIDGE_PORT, APP_PORT]) need(`port ${p} is free`, await portFree(p));
  return pi;
}

function loadPlaywright() {
  for (const pkg of [process.env.PLAYWRIGHT_CORE_FROM, `${ENGINE_DIR}/appdeps/package.json`, 'C:/RnD/Projects/3Dengine/appdeps/package.json'].filter(Boolean)) {
    try { return createRequire(pkg)('playwright-core'); } catch { /* next */ }
  }
  return null;
}

/* ---------- the browser checks ---------- */
async function measure(page, label) {
  const m = await page.evaluate(() => {
    const de = document.documentElement;
    const W = de.clientWidth;
    const clipped = (el, r) => {
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const ox = getComputedStyle(a).overflowX;
        if (ox !== 'visible') {
          const ar = a.getBoundingClientRect();
          if (r.right <= ar.right + 1 && r.left >= ar.left - 1) return false; // inside its clipping box: judged by the box
          return true; // cut off by a scroll/clip box: not painted outside the viewport
        }
      }
      return false;
    };
    const offenders = [];
    for (const el of document.body.querySelectorAll('*')) {
      if (el.closest('.sr-only, script, style, template')) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if ((r.left < -1 || r.right > W + 1) && !clipped(el, r)) {
        offenders.push(`<${el.tagName.toLowerCase()} class="${String(el.className).slice(0, 40)}"> ${Math.round(r.left)}…${Math.round(r.right)}`);
      }
    }
    return { scrollWidth: de.scrollWidth, clientWidth: W, bodyScrollWidth: document.body.scrollWidth, offenders: offenders.slice(0, 20) };
  });
  const ok = m.scrollWidth <= m.clientWidth && m.offenders.length === 0;
  report.overflow.push({ state: label, ...m, ok });
  check(`${label}: no horizontal overflow on either side`, ok, `scrollWidth ${m.scrollWidth} / clientWidth ${m.clientWidth}${m.offenders.length ? `; ${m.offenders.join('; ')}` : ''}`);
}

async function shot(page, name, locator) {
  const file = `${LOG_DIR}/${name}.png`;
  if (locator) await locator.scrollIntoViewIfNeeded().catch(() => {});
  await page.screenshot({ path: file, fullPage: false });
  report.screenshots.push(file);
}

const readJob = (jobsDir, id) => {
  try { return JSON.parse(fs.readFileSync(`${jobsDir}/${id}/job.json`, 'utf8')); } catch { return null; }
};

/** Upload a PDF in the app and send a Hebrew message; resolves the NEW job card's job id. */
async function startJobInUi(page, pdf, text, knownIds) {
  await page.locator('input[type=file]').setInputFiles(pdf);
  await page.locator('.composer .chip').first().waitFor({ state: 'visible', timeout: 15000 });
  await waitFor('the upload chip to finish', async () => (await page.locator('.composer .chip .ring').count()) === 0
    && (await page.locator('.composer .chip--error').count()) === 0, { timeoutMs: 30000 });
  must(`upload of ${path.basename(pdf)} succeeded`, (await page.locator('.composer .chip--error').count()) === 0);
  await page.locator('#composer-input').fill(text);
  await page.locator('#composer button[type=submit]').click();
  const id = await waitFor('a new job card', async () => {
    const ids = await page.locator('section.jobcard').evaluateAll((els) => els.map((e) => e.id.replace(/^job-/, '')));
    return ids.find((i) => !knownIds.includes(i)) ?? null;
  }, { timeoutMs: 60000 });
  return id;
}

/** Watch a card until its quote shows; returns the percents seen in the browser. */
async function watchUntilQuote(page, card, label) {
  const seen = [];
  const sample = async () => {
    const pct = await card.locator('.badge.tabular').innerText().catch(() => '');
    const n = parseInt(pct, 10);
    if (Number.isFinite(n) && seen[seen.length - 1] !== n) seen.push(n);
  };
  await waitFor(`${label}: the quote`, async () => {
    await sample();
    return (await card.locator('button', { hasText: 'אשרו תקציב עד' }).count()) > 0;
  }, { timeoutMs: 60000, everyMs: 100 });
  // The badge and the button arrive in one render, but they are read here in two steps: when the card
  // changed between the two, the badge read is the old one. Read it once more now that the button is there.
  await sample();
  report.observed_percents[label] = seen;
  return seen;
}

/* ---------- main ---------- */
async function main() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const pi = await prerequisites();
  const pw = loadPlaywright();
  must('prerequisite: playwright-core loads (appdeps)', !!pw);

  // Temp layout (real path, so the engine's inbox check sees the same spelling the bridge writes).
  const ROOT = posix(fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'habait-e2e-'))));
  report.temp_root = ROOT;
  const D = {
    agent: `${ROOT}/pi-agent`, home: `${ROOT}/home`, piCwd: `${ROOT}/pi-cwd`, bridge: `${ROOT}/bridge`, web: `${ROOT}/web-agent`,
    engineHome: `${ROOT}/engine-home`, jobs: `${ROOT}/jobs`, dist: `${ROOT}/app-dist`, logs: `${ROOT}/logs`,
  };
  for (const d of Object.values(D)) fs.mkdirSync(d, { recursive: true });
  const uploads = `${D.bridge}/workspace/uploads`;
  fs.mkdirSync(uploads, { recursive: true });
  const SERVE_PORT = await freePort([8891, BRIDGE_PORT, APP_PORT]);
  report.ports = { bridge: BRIDGE_PORT, app: APP_PORT, engine_serve: SERVE_PORT };

  let browser = null; let fake = null; let app = null; let bridge = null;
  try {
    /* 1. the bridge, copied as it is into the temp folder (its sessions/, state/, workspace/ live beside it) */
    fs.mkdirSync(`${D.bridge}/src`, { recursive: true });
    for (const f of fs.readdirSync(`${UI_DIR}/bridge/src`)) if (f.endsWith('.mjs')) fs.copyFileSync(`${UI_DIR}/bridge/src/${f}`, `${D.bridge}/src/${f}`);
    fs.copyFileSync(`${UI_DIR}/bridge/package.json`, `${D.bridge}/package.json`);
    const uiCfg = JSON.parse(fs.readFileSync(`${UI_DIR}/bridge/config.json`, 'utf8'));
    fs.writeFileSync(`${D.bridge}/config.json`, JSON.stringify({ ...uiCfg, port: BRIDGE_PORT, agentDir: D.web,
      pi: { provider: 'fake', model: 'm', cwd: D.piCwd }, engine: { home: D.engineHome, jobsDir: D.jobs } }, null, 2));
    // The web extension, copied fresh from the wrapper (the bridge loads <agentDir>/extensions/habait-web and keeps its memory vault in <agentDir>/memory).
    fs.cpSync(`${WRAPPER_DIR}/extensions/habait-web`, `${D.web}/extensions/habait-web`, { recursive: true });

    /* 2. the engine on a temp home: the real code, a temp jobs folder, the bridge copy's uploads as the inbox */
    // The first look is real since milestone 1.1: the temp home is pointed at the real home's Python and pipeline.
    const real = (p) => (/^([A-Za-z]:)?[\\/]/.test(p) ? p : `${ENGINE_DIR}/${p}`);
    fs.writeFileSync(`${D.engineHome}/engine.config.json`, JSON.stringify({ ...BASE_CONFIG, python: real(BASE_CONFIG.python),
      pipelineRoot: real(BASE_CONFIG.pipelineRoot), inbox: [uploads], jobsDir: D.jobs, runtimeDir: `${D.engineHome}/.runtime` }, null, 2));
    const engineEnv = { ENGINE_HOME: D.engineHome, ENGINE_JOBS_DIR: D.jobs, ENGINE_SERVE_PORT: String(SERVE_PORT), ENGINE_STUB_STEP_MS: String(STEP_MS) };

    /* 3. the fake model */
    fake = await startFakeModel(0);
    report.ports.fake_model = fake.port;

    /* 4. the Pi agent folder: the wrapper's own installer, then the fake provider and the engine entry pointed at this worktree */
    const inst = spawnSync('python', ['-I', '-X', 'utf8', `${WRAPPER_DIR}/install-global.py`, '--agent-dir', D.agent],
      { encoding: 'utf8', windowsHide: true, timeout: 60000, env: { ...process.env, HOME: D.home, USERPROFILE: D.home } });
    fs.writeFileSync(`${D.logs}/installer.log`, `${inst.stdout}\n${inst.stderr}`);
    must('the wrapper installer ran on the temp agent folder', inst.status === 0, (inst.stderr || '').trim().split('\n').pop());
    const settings = JSON.parse(fs.readFileSync(`${D.agent}/settings.json`, 'utf8'));
    check('installer: habait-guard registered in settings.json', (settings.extensions ?? []).some((e) => posix(e) === `${WRAPPER_DIR}/extensions/habait-guard`));
    const mcp = JSON.parse(fs.readFileSync(`${D.agent}/mcp.json`, 'utf8'));
    const entry = mcp.mcpServers?.['habait-engine'];
    check('installer: habait-engine registered in mcp.json with exposure "direct"', entry?.exposure === 'direct', JSON.stringify(entry?.args));
    mcp.mcpServers['habait-engine'] = { ...entry, command: process.execPath, args: [`${ENGINE_DIR}/mcp/server.mjs`], cwd: ENGINE_DIR, env: engineEnv };
    fs.writeFileSync(`${D.agent}/mcp.json`, JSON.stringify(mcp, null, 2));
    fs.writeFileSync(`${D.agent}/models.json`, JSON.stringify({ providers: { fake: { baseUrl: `http://127.0.0.1:${fake.port}/v1`,
      api: 'openai-completions', apiKey: 'x', models: [{ id: 'm', input: ['text', 'image'] }] } } }, null, 2));

    // One environment for Pi and everything below it: no provider keys, the temp agent folder, a temp home.
    const env = { ...process.env };
    for (const k of Object.keys(env)) if (/(_API_KEY|_TOKEN|_SECRET|^FAL_KEY)$/i.test(k)) delete env[k];
    Object.assign(env, engineEnv, { PI_CODING_AGENT_DIR: D.agent, HOME: D.home, USERPROFILE: D.home, PI_OFFLINE: '1',
      PI_SKIP_VERSION_CHECK: '1', PI_TELEMETRY: '0', HABAIT_BRIDGE_TOKEN_FILE: `${ROOT}/bridge.token` });

    /* 5. Pi lists the eight engine tools (no model involved) */
    const list = spawnSync(process.execPath, [pi.cli, 'mcp', 'list'], { cwd: D.piCwd, env, encoding: 'utf8', windowsHide: true, timeout: 90000 });
    const listOut = `${list.stdout}\n${list.stderr}`;
    fs.writeFileSync(`${LOG_DIR}/pi-mcp-list.txt`, listOut);
    const missing = TOOLS8.filter((t) => !listOut.includes(t));
    check('`pi mcp list` (temp agent folder) shows habait-engine connected with its eight tools', list.status === 0 && listOut.includes('habait-engine') && missing.length === 0,
      `exit ${list.status}${missing.length ? `; missing ${missing.join(', ')}` : ''}`);

    /* 6. the app, built for this bridge port, served on an allowed origin */
    const build = spawnSync(process.execPath, [`${UI_DIR}/app/node_modules/vite/bin/vite.js`, 'build', '--outDir', D.dist, '--emptyOutDir', '--logLevel', 'warn'],
      { cwd: `${UI_DIR}/app`, env: { ...process.env, VITE_PI_BRIDGE_URL: `http://127.0.0.1:${BRIDGE_PORT}` }, encoding: 'utf8', windowsHide: true, timeout: 300000 });
    fs.writeFileSync(`${D.logs}/vite-build.log`, `${build.stdout}\n${build.stderr}`);
    must('the app builds (vite build into the temp folder)', build.status === 0 && fs.existsSync(`${D.dist}/index.html`),
      build.status === 0 ? '' : (build.stderr || '').slice(-300));
    app = await serveStatic(D.dist, APP_PORT);

    /* 7. the bridge (it starts Pi in RPC mode) */
    const bridgeLog = `${D.logs}/bridge.log`;
    bridge = startProcess('bridge', process.execPath, [`${D.bridge}/src/server.mjs`], { cwd: D.bridge, env, logFile: bridgeLog });
    const piReady = await waitFor('the bridge to start Pi', () => {
      const t = fs.existsSync(bridgeLog) ? fs.readFileSync(bridgeLog, 'utf8') : '';
      if (/\[pi\] failed to start/.test(t) || bridge.exitCode !== null) return 'failed';
      return /\[pi\] ready/.test(t) ? 'ready' : null;
    }, { timeoutMs: 90000, everyMs: 250 });
    must('the bridge started Pi 1.5.2 in RPC mode on the fake model', piReady === 'ready', `see ${bridgeLog}`);
    const token = fs.readFileSync(`${ROOT}/bridge.token`, 'utf8').trim();

    /* 8. the browser */
    browser = await pw.chromium.launch({ executablePath: CHROME, headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'he-IL' });
    await context.addInitScript((t) => { try { sessionStorage.setItem('habait.pi.pairing', t); } catch { /* none */ } }, token);
    const page = await context.newPage();
    page.on('console', (m) => { if (m.type() === 'error') report.console_errors.push({ text: m.text().slice(0, 300), at: page.viewportSize()?.width }); });
    page.on('pageerror', (e) => report.console_errors.push({ text: `pageerror: ${String(e.message).slice(0, 300)}`, at: page.viewportSize()?.width }));
    const paired = page.waitForResponse((r) => r.url().endsWith('/pair'), { timeout: 60000 }).catch((e) => e);
    await page.goto(`http://127.0.0.1:${APP_PORT}/?agent=pi`, { waitUntil: 'domcontentloaded' });
    const pairRes = await paired;
    must('the app paired with the bridge (POST /pair 200)', !(pairRes instanceof Error) && pairRes.status() === 200,
      pairRes instanceof Error ? pairRes.message : `status ${pairRes.status()}`);
    await sleep(500);

    /* ===== Run A at 1440×900: upload → quote → guard card → «לאשר» → done → the tour link ===== */
    const idA = await startJobInUi(page, FIXTURE, 'שלום, אפשר בבקשה הדמיה לדירה בתכנית שצירפתי?', []);
    report.job_a = idA;
    const cardA = page.locator(`#job-${idA}`);
    check('A: the job card appears with the badge «שחזור הדגמה»', (await cardA.getByText(BADGE, { exact: true }).count()) > 0);
    const seenA = await watchUntilQuote(page, cardA, 'A@1440');
    check('A: the card\'s percent advanced through intermediate steps before the quote', seenA.length >= 3 && seenA[seenA.length - 1] === 55
      && seenA.every((v, i) => i === 0 || v > seenA[i - 1]), `seen ${seenA.join(' → ')}`);
    const jobA = readJob(D.jobs, idA);
    check('A: job file is awaiting_approval with the quote, no approval', jobA?.state === 'awaiting_approval' && jobA?.quote?.estimate_usd === 48 && jobA?.approval === null);
    const quoteText = (await cardA.locator('.card__sub').first().innerText()).replace(/\s+/g, ' ');
    check('A: the quote line reads «הערכת עלות: $48 · טווח $40–$60 · 11 חדרים»', quoteText.includes('הערכת עלות: $48') && quoteText.includes('$40–$60') && quoteText.includes('11 חדרים'), quoteText);
    const approveA = cardA.locator('button', { hasText: 'אשרו תקציב עד' });
    check('A: the button «אשרו תקציב עד $60» shows', (await approveA.innerText()).replace(/\s+/g, ' ').trim() === 'אשרו תקציב עד $60');
    await waitFor('A: the first run to end (button enabled)', () => approveA.isEnabled(), { timeoutMs: 30000 });
    await measure(page, '1440 quote');
    await shot(page, '1440-quote', cardA);

    await approveA.click();
    const apA = page.locator('section.approval').last();
    await apA.waitFor({ state: 'visible', timeout: 60000 });
    const jobAatCard = readJob(D.jobs, idA);
    check('A: the guard card appears BEFORE the job leaves awaiting_approval (job file: no approval yet)',
      jobAatCard?.state === 'awaiting_approval' && jobAatCard?.approval === null, `state ${jobAatCard?.state}, approval ${JSON.stringify(jobAatCard?.approval)}`);
    const apTitle = (await apA.locator('.card__title').innerText()).trim();
    check('A: guard card title «שלב בתשלום: אישור תקציב לעבודה <job_id>»', apTitle === `שלב בתשלום: אישור תקציב לעבודה ${idA}`, apTitle);
    const capLine = (await apA.locator('.approval__cap').innerText()).replace(/\s+/g, ' ').trim();
    check('A: guard card shows «תקרת התקציב: $60»', capLine === 'תקרת התקציב: $60', capLine);
    await measure(page, '1440 approval');
    await shot(page, '1440-approval', apA);
    await apA.locator('button', { hasText: 'לאשר' }).click();

    const approvedA = await waitFor('A: approval in the job file', () => readJob(D.jobs, idA)?.approval, { timeoutMs: 30000 });
    check('A: «לאשר» → the job file gets approval { cap_usd: 60 }', approvedA.cap_usd === 60);
    const openTour = cardA.locator('a', { hasText: 'פתחו את הסיור' });
    await openTour.waitFor({ state: 'visible', timeout: 90000 });
    const pctDone = (await cardA.locator('.badge.tabular').innerText()).trim();
    const jobAdone = readJob(D.jobs, idA);
    check('A: the card ran to 100 % and the job file is done', pctDone === '100%' && jobAdone?.state === 'done' && jobAdone?.percent === 100, `${pctDone}, ${jobAdone?.state}`);
    const href = await openTour.getAttribute('href');
    check(`A: «פתחו את הסיור» carries a loopback link on the test port (not 8891)`, new RegExp(`^http://127\\.0\\.0\\.1:${SERVE_PORT}/tour/`).test(href ?? '') && href === jobAdone?.result?.local_url, href);
    const tour = await httpGet(href);
    const title = /<title>([^<]*)<\/title>/.exec(tour.body)?.[1] ?? '';
    check(`A: GET of the link answers 200 with the 846 tour page (<title> holds «${TOUR_MARKER}»)`, tour.status === 200 && title.includes(TOUR_MARKER), `${tour.status}, «${title}»`);
    await measure(page, '1440 done');
    await shot(page, '1440-done', cardA);

    /* ===== 390×844: the done card, then Run B (the money gate's «לחסום») ===== */
    await page.setViewportSize({ width: 390, height: 844 });
    await sleep(400);
    await measure(page, '390 done');
    await shot(page, '390-done', cardA);

    const pdfB = `${ROOT}/plan-b.pdf`;
    fs.writeFileSync(pdfB, Buffer.concat([fs.readFileSync(FIXTURE), Buffer.from('% e2e: a second plan, so its hash differs\n', 'latin1')]));
    const idB = await startJobInUi(page, pdfB, 'ועכשיו הדמיה לתכנית השנייה, בבקשה.', [idA]);
    report.job_b = idB;
    check('B: a second, separate job (another id)', idB !== idA, idB);
    const cardB = page.locator(`#job-${idB}`);
    check('B: the job card carries the badge «שחזור הדגמה»', (await cardB.getByText(BADGE, { exact: true }).count()) > 0);
    const seenB = await watchUntilQuote(page, cardB, 'B@390');
    check('B: the card advanced to the quote', seenB[seenB.length - 1] === 55, `seen ${seenB.join(' → ')}`);
    const approveB = cardB.locator('button', { hasText: 'אשרו תקציב עד' });
    await waitFor('B: the first run to end (button enabled)', () => approveB.isEnabled(), { timeoutMs: 30000 });
    await measure(page, '390 quote');
    await shot(page, '390-quote', cardB);
    await approveB.click();
    const apB = page.locator('section.approval').last();
    await apB.waitFor({ state: 'visible', timeout: 60000 });
    const apTitleB = (await apB.locator('.card__title').innerText()).trim();
    check('B: the guard card asks for job B', apTitleB === `שלב בתשלום: אישור תקציב לעבודה ${idB}`, apTitleB);
    check('B: job file has no approval while the card waits', readJob(D.jobs, idB)?.approval === null);
    await measure(page, '390 approval');
    await shot(page, '390-approval', apB);
    await apB.locator('button', { hasText: 'לחסום' }).click();
    await waitFor('B: the blocked card', async () => (await page.locator('.qdone', { hasText: 'נחסם' }).count()) > 0, { timeoutMs: 30000 });
    await waitFor('B: the run to end', () => approveB.isEnabled().catch(() => false), { timeoutMs: 30000 }).catch(() => {});
    await sleep(STEP_MS * 3); // longer than three runner steps: had an approval been written, the runner would have moved on
    const jobB = readJob(D.jobs, idB);
    check('B: «לחסום» → the job file never got an approval and stays awaiting_approval', jobB?.approval === null && jobB?.state === 'awaiting_approval' && jobB?.cost?.cap_usd === null,
      `state ${jobB?.state}, approval ${JSON.stringify(jobB?.approval)}`);
    await measure(page, '390 blocked');
    await shot(page, '390-blocked', cardB);

    /* the scripted model saw the tools by name and was driven exactly as written */
    report.fake_model = fake.requests;
    const calls = fake.requests.filter((r) => r.decision.tool).map((r) => r.decision.tool.slice(T.length));
    check('the fake model was offered the eight engine tools by name (exposure direct)', fake.requests.some((r) => TOOLS8.every((t) => r.engine_tools.includes(`${T}${t}`))));
    check('the tool calls were inspect → start → approve (A), inspect → start → approve (B)',
      JSON.stringify(calls) === JSON.stringify(['inspect_plan', 'start_simulation', 'approve_paid_stage', 'inspect_plan', 'start_simulation', 'approve_paid_stage']), calls.join(', '));
    const approves = fake.requests.filter((r) => r.decision.tool === `${T}approve_paid_stage`).map((r) => r.decision.args);
    check('approve_paid_stage got the job id and cap_usd 60 parsed from the button\'s message', approves.length === 2 && approves[0].job_id === idA && approves[1].job_id === idB && approves.every((a) => a.cap_usd === 60));
    check('no console errors in the page', report.console_errors.length === 0, report.console_errors.map((e) => e.text).join(' | '));
    // The bridge log (the pairing line removed) for the record.
    report.bridge_log = `${LOG_DIR}/bridge.log`;
    fs.writeFileSync(report.bridge_log, fs.readFileSync(bridgeLog, 'utf8').replace(/PAIRING-CODE:.*$/gm, 'PAIRING-CODE: (removed)'));
  } finally {
    /* cleanup: every process this test caused, by pid with its children */
    const done = {};
    if (browser) { await browser.close().catch(() => {}); done.browser = 'closed'; }
    if (bridge) done.bridge = killTree(bridge.pid); // Pi and the MCP server are its children
    if (fs.existsSync(D.jobs)) {
      for (const d of fs.readdirSync(D.jobs)) {
        const f = `${D.jobs}/${d}/runner.pid`;
        if (fs.existsSync(f)) done[`runner ${d}`] = killTree(Number(fs.readFileSync(f, 'utf8')));
      }
    }
    const serveJson = `${D.engineHome}/.runtime/serve.json`;
    if (fs.existsSync(serveJson)) done.engine_serve = killTree(JSON.parse(fs.readFileSync(serveJson, 'utf8')).pid);
    if (fake) { await fake.close(); done.fake_model = 'closed'; }
    if (app) { await app.close(); done.app_server = 'closed'; }
    await sleep(1500);
    const mine = [...nodeProcessesMatching([ROOT, `${ENGINE_DIR}/mcp/`, `${ENGINE_DIR}/engine/`])];
    for (const p of mine) done[`leftover ${p.pid}`] = killTree(p.pid);
    if (mine.length) await sleep(1000);
    const after = nodeProcessesMatching([ROOT, `${ENGINE_DIR}/mcp/`, `${ENGINE_DIR}/engine/`]);
    const ports = [BRIDGE_PORT, APP_PORT, report.ports?.engine_serve, report.ports?.fake_model].filter(Boolean);
    const still = listening(ports);
    report.cleanup = { actions: done, leftovers_found: mine.map((p) => `${p.pid} ${p.name}`), processes_after: after.map((p) => `${p.pid} ${p.name}`),
      listening_after: still, started: started.map((s) => `${s.name} ${s.pid} alive=${pidAlive(s.pid)}`) };
    check('cleanup: no process of this test remains (bridge, Pi, MCP server, runners, static server)', after.length === 0 && mine.length === 0,
      mine.length ? `had to kill ${mine.map((p) => p.pid).join(', ')}` : '');
    check(`cleanup: ports ${ports.join(', ')} are free (netstat)`, still.length === 0, still.join(' | '));
    if (!process.env.E2E_KEEP) {
      try { fs.rmSync(ROOT, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); report.cleanup.temp = 'removed'; } catch (e) { report.cleanup.temp = `not removed: ${e.message}`; }
    } else report.cleanup.temp = `kept: ${ROOT}`;
  }
}

process.on('unhandledRejection', (e) => { console.error(`(unhandled rejection, ignored) ${e?.message || e}`); });
try {
  await main();
} catch (e) {
  report.error = String(e?.stack || e).slice(0, 2000);
  console.error(`ERROR  ${e?.message || e}`);
  failures++;
}
report.ok = failures === 0;
report.finished_at = new Date().toISOString();
const passed = report.assertions.filter((a) => a.ok).length;
report.summary = `${passed}/${report.assertions.length} assertions passed${report.error ? '; stopped by an error' : ''}`;
try {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.writeFileSync(`${LOG_DIR}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
} catch { /* report dir unwritable: the console has it */ }
console.log(`\n${report.ok ? 'E2E PASS' : 'E2E FAIL'}: ${report.summary}. Report: ${LOG_DIR}/report.json`);
process.exit(report.ok ? 0 : 1);
