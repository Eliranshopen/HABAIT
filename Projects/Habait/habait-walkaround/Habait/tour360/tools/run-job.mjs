#!/usr/bin/env node
/* Habait Tour360 — tools/run-job.mjs: the EXECUTOR of the portal's build jobs (contract: Habait/studio-web/CLAUDE.md
   "Job contract — habait-studio/job.v1"; package: ../PROJECT-PACKAGE.md). Fork C of rnd-67, 2026-11-04. Eliran: the portal
   alone must reproduce habait-flow — upload → read → approve → trace approval → build → the result links.

     node Habait/tour360/tools/run-job.mjs --once            one pass over the queue, then exit
     node Habait/tour360/tools/run-job.mjs --watch [--every 30]   keep polling
     node Habait/tour360/tools/run-job.mjs --local <job.json> --files <dir>   DRY RUN: a fake queue entry on disk, no Blob store

   One job, start to finish (every state and field name below is the portal's, never ours):
     queued   → claim: state 'running', the queue pointer deleted; the project's files + spec.json downloaded to out/<pid>/in/
     trace    → auto-trace.mjs (fork B) → trace/plan.json + trace/overlay.png uploaded; state 'waiting',
                needs { type:'trace_approval', overlay, trace, note }  — the developer approves or corrects in the portal
     queued (approved, inputs.trace set) → run-project.mjs apartment…package on the approved trace, WITH the designed look (step skin:
                tools/skin-project.mjs — the Rainbow recipe, every room at fidelity.json's bar, every element seen from 2+ rooms the same,
                the floor finishes; --no-skin = the CG look); fidelity per room = the skin report
     package  → out/<pid>/package/ uploaded under <prefix>package/ ; the public pointer studio/pub/<pid>.json (the files the
                /p/<pid>/ route may serve — api/studio-pub.mjs); result { package, page, tour, fidelity }, links[], state 'done'
     failed   → state 'failed', error, and the stage it fell at (the developer sees the Hebrew log line)
   A correction (corrections[] newer than approvals.trace) sends the trace back: auto-trace runs again with the text as a hint.
   Secrets by NAME only: BLOB_READ_WRITE_TOKEN and FAL_KEY from the process environment; nothing here reads an .env file or prints
   a value. Paid: the auto-trace's vision read (ledgered by auto-trace itself) and scan-pieces (≈ $0.01/scene). */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const TOOLS = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TOOLS, '..');
const REPO = path.resolve(ROOT, '..', '..');
const OUTROOT = path.join(ROOT, 'out');
// THE ENGINE VERSION (fork F, 2026-11-05; Eliran: the portal is autonomous — a job the automatic check sent to review is retried by
// itself when the engine improves): a content hash of the trace tools (auto-trace + its Python legs + trace-check) and of the fidelity
// rule. Stamped on every job that enters review; the sweep requeues a review job ONCE per newer engine version (no git in a sandbox).
const ENGINE = (() => {
  const files = ['auto-trace.mjs', 'trace_check.py', 'trace_score.py', 'dim_chains.py', ...fs.readdirSync(TOOLS).filter((f) => /^auto_.*\.py$/.test(f))]
    .filter((f, i, a) => a.indexOf(f) === i && fs.existsSync(path.join(TOOLS, f))).sort();
  const h = crypto.createHash('sha256');
  for (const f of files) h.update(f).update(fs.readFileSync(path.join(TOOLS, f)).toString('utf8').replace(/\r\n/g, '\n'));
  const rule = path.join(ROOT, 'fidelity.json'); if (fs.existsSync(rule)) h.update('fidelity.json').update(fs.readFileSync(rule).toString('utf8').replace(/\r\n/g, '\n'));
  return { version: h.digest('hex').slice(0, 12), parts: files.length + 1 };
})();
const argv = process.argv.slice(2);
const opt = (k, d = null) => { const i = argv.indexOf(k); return i > 0 || (i === 0 && argv.length > 1) ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d) : d; };
const has = (k) => argv.includes(k);
const LOCAL = opt('--local');
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJsonFile = (p, d) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(d, null, 1) + '\n'); };
const now = () => new Date().toISOString();

// ───────────────────────────── the store: the private Blob store, or a folder in --local dry runs (same verbs, same paths)
let store;
async function openStore() {
  if (LOCAL) {
    const base = path.resolve(opt('--files') || path.dirname(LOCAL));
    const f = (p) => path.join(base, p.replace(/\//g, path.sep));
    store = {
      kind: `local folder ${base}`,
      list: async (prefix) => { const out = []; const walk = (d, rel) => { if (!fs.existsSync(d)) return; for (const e of fs.readdirSync(d)) { const p = path.join(d, e); const r = rel ? `${rel}/${e}` : e; if (fs.statSync(p).isDirectory()) walk(p, r); else out.push({ pathname: r, size: fs.statSync(p).size }); } }; walk(f(prefix), prefix.replace(/\/$/, '')); return out; },
      getJson: async (p) => (fs.existsSync(f(p)) ? readJson(f(p)) : null),
      getBytes: async (p) => (fs.existsSync(f(p)) ? fs.readFileSync(f(p)) : null),
      putJson: async (p, d) => writeJsonFile(f(p), d),
      putFile: async (p, file) => { fs.mkdirSync(path.dirname(f(p)), { recursive: true }); fs.copyFileSync(file, f(p)); },
      del: async (p) => { try { fs.unlinkSync(f(p)); } catch { /* gone */ } },
    };
    return;
  }
  // the shared storage adapter (fork G, 2026-11-05): Supabase Storage since the Blob store's suspension (SUPABASE_URL +
  // SUPABASE_SERVICE_ROLE_KEY by NAME from the environment), the Blob store with STORE=blob. The same module the portal's functions
  // use, so a job and the page always read the same objects. Every operation is counted in OPS (job.blob_ops, cumulative).
  const { createRequire } = await import('node:module'); const { pathToFileURL } = await import('node:url');
  const { openStore: openShared } = await import(pathToFileURL(path.join(TOOLS, '..', '..', 'studio-web', 'api', '_store.mjs')).href);
  const where = process.env.HABAIT_BLOB_DIR || process.env.HABAIT_APP_DIR || APP_DIR;
  const loadBlob = async () => { try { return await import(pathToFileURL(createRequire(path.join(where, 'package.json')).resolve('@vercel/blob')).href); } catch { return import('@vercel/blob'); } };
  try { store = await openShared({ loadBlob, ops: OPS }); }
  catch (e) { fail(`${e.message} (run it as \`vercel env run -- node run-job.mjs …\` from the linked habait-flow folder; never a file this tool reads)`); }
}
const OPS = { advanced: 0, simple: 0, put: 0, list: 0, get: 0, del: 0, sign: 0 };
// a job's address by id: studio/jobs/<id>.json (the portal writes it at enqueue), else its queue pointer: ONE read, never a list();
// a job older than the index is found by ONE list of studio/u/ and its address written, so it is never listed again
async function findJobPath(id) {
  const ix = await store.getJson(`studio/jobs/${id}.json`); if (ix?.jobPath) return ix.jobPath;
  const q = await store.getJson(`studio/queue/${id}.json`); if (q?.jobPath) return q.jobPath;
  console.warn(`run-job: ${id} has no studio/jobs/ address: one list() of studio/u/ to find it (then indexed)`);
  for (const b of (await store.list('studio/u/')).filter((x) => x.pathname.endsWith('/job.json'))) {
    const j = await store.getJson(b.pathname); if (!j || j.id !== id) continue;
    await store.putJson(`studio/jobs/${id}.json`, { schema: 'habait-studio/job-index.v1', job: id, uid: j.owner, pid: j.project, jobPath: b.pathname });
    return b.pathname;
  }
  return null;
}

function fail(m) { console.error(`run-job: ${m}`); process.exit(1); }
function log(job, line) { job.log = [...(job.log || []), { at: now(), line: String(line).slice(0, 300) }].slice(-200); job.updated = now(); console.log(`  ${job.id} · ${line}`); }
const EXECUTOR = `${os.hostname()}:${process.pid}`;
let OPS_BASE = null;   // the job's count before this process touched it (job.blob_ops is cumulative across sessions)
async function save(job, patch = {}) { if (OPS_BASE) job.blob_ops = { advanced: OPS_BASE.advanced + OPS.advanced + 1, simple: OPS_BASE.simple + OPS.simple, list: OPS_BASE.list + OPS.list, put: OPS_BASE.put + OPS.put + 1 }; Object.assign(job, patch, { updated: now(), heartbeat: now(), executor: EXECUTOR, store_ops: { ...OPS } }); await store.putJson(job._path, stripPrivate(job)); }
const stripPrivate = (j) => Object.fromEntries(Object.entries(j).filter(([k]) => !k.startsWith('_')));
const APP_DIR = process.env.HABAIT_APP_DIR || 'C:/RnD/Projects/Habait/tools/appdeps';   // sharp + playwright-core for the tools (app-require.mjs)
// the sandbox watchdog (fork E, studio-web/api/_dispatch.mjs): a Vercel Sandbox session is killed at its cap and cannot write its
// own failure, so at HABAIT_JOB_DEADLINE_MS (epoch ms, 3 min before the cap) the job in hand goes back to the queue (attempt+1,
// pointer re-added — the portal re-dispatches it on the developer's next page load) and this process exits 75. Outside a sandbox
// the variable is unset and nothing here runs.
let CURRENT = null;
if (process.env.HABAIT_JOB_DEADLINE_MS) {
  const ms = Number(process.env.HABAIT_JOB_DEADLINE_MS) - Date.now();
  setTimeout(async () => {
    try {
      if (CURRENT && CURRENT.state === 'running') {
        CURRENT.attempt = (CURRENT.attempt || 1) + 1;
        log(CURRENT, 'העבודה ארוכה מהצפוי — ממשיכים בסבב נוסף');
        closeSession(CURRENT, `watchdog at stage ${CURRENT.stage}`);
        await save(CURRENT, { state: 'queued' });
        await store.putJson(`studio/queue/${CURRENT.id}.json`, { schema: 'habait-studio/queue.v1', job: CURRENT.id, uid: CURRENT.owner, pid: CURRENT.project, jobPath: CURRENT._path, at: now() });
      }
    } finally { process.exit(75); }
  }, Math.max(ms, 1000)).unref();
}
// a child process, with the job's heartbeat written every 60 s while it runs (a render can take an hour; the sweeper must not
// mistake a long step for a dead executor). `job` is optional (no heartbeat outside a job).
function run(cmd, args, cwd, timeoutS = 1800, job = null) {
  return new Promise((resolve) => {
    const ch = spawn(cmd, args, { cwd, env: { ...process.env, HABAIT_APP_DIR: APP_DIR }, windowsHide: true });
    let out = '';
    ch.stdout.on('data', (d) => { out += d; if (out.length > 32e6) out = out.slice(-16e6); });
    ch.stderr.on('data', (d) => { out += d; if (out.length > 32e6) out = out.slice(-16e6); });
    // the heartbeat every 5 min (was 60 s: one put a minute through a 40-min build = 40 advanced operations); the sweep's stale
    // threshold (50 min in a sandbox, 90 by default) stays far above it
    const beat = job ? setInterval(() => { save(job).catch(() => {}); }, 300000) : null;
    const kill = setTimeout(() => { try { ch.kill(); } catch { /* gone */ } }, timeoutS * 1000);
    ch.on('close', (code, sig) => { clearTimeout(kill); if (beat) clearInterval(beat); resolve({ ok: code === 0, out, status: code ?? sig }); });
    ch.on('error', (e) => { clearTimeout(kill); if (beat) clearInterval(beat); resolve({ ok: false, out: `${out}${e.message}`, status: 'spawn-error' }); });
  });
}

// ───────────────────────────── the sweeper: a job 'running' with no heartbeat for --stale-min minutes (default 90) had its executor
// die (claimed = its queue pointer is gone, so nothing would ever pick it up again). First time: back to 'queued' with the pointer
// re-added (resumable: run-project's steps are idempotent, a render skips the points already done). Second time: 'failed' + reason.
async function sweep() {
  // the engine this executor carries, for the portal (studio/engine.json): a page load can see that a review job is older than the
  // engine and dispatch it (fork E's needsDispatch) — the sweep below already requeued it
  await store.putJson('studio/engine.json', { schema: 'habait-studio/engine.v1', version: ENGINE.version, parts: ENGINE.parts, at: now() });
  const staleMs = Number(opt('--stale-min', '90')) * 60000;
  const jobs = (await store.list('studio/u/')).filter((b) => /\/p\/[A-Za-z0-9_-]+\/job\.json$/.test(b.pathname));   // the ONE list of this boot
  const read = new Map(); const getJob = async (b) => { if (!read.has(b.pathname)) read.set(b.pathname, await store.getJson(b.pathname)); return read.get(b.pathname); };
  let n = 0;
  for (const b of jobs) {
    const job = await getJob(b); if (!job || job.state !== 'running') continue;
    const last = Date.parse(job.heartbeat || job.updated || job.created || 0);
    if (!(Date.now() - last > staleMs)) continue;
    job._path = b.pathname; n += 1;
    const mins = Math.round((Date.now() - last) / 60000);
    if ((job.sweeps || 0) < 1) {
      job.sweeps = (job.sweeps || 0) + 1;
      log(job, `הבנייה נעצרה (אין סימן חיים ${mins} דקות) — חוזרת לתור פעם אחת`);
      await save(job, { state: 'queued' });
      await store.putJson(`studio/queue/${job.id}.json`, { schema: 'habait-studio/queue.v1', job: job.id, uid: job.owner, pid: job.project, jobPath: b.pathname, at: now() });
    } else {
      job.sweeps += 1;
      await toReview(job, new Error(`the executor stopped twice at stage '${job.stage}' (no heartbeat for ${mins} min; executor ${job.executor || '?'})`));
    }
  }
  if (n) console.log(`run-job: swept ${n} stale job(s)`);
  // the autonomy retry: a job in review whose engine stamp is older than this engine goes back to the queue ONCE for this version
  // (the review kept in reviews[], the --requeue contract); the developer sees «המערכת ממשיכה לתקן» and the build continues by itself
  let rq = 0;
  for (const b of jobs) {
    const job = await getJob(b); if (!job || job.state !== 'review') continue;
    if (job.engine?.version === ENGINE.version) continue;
    if ((job.retries || {})[ENGINE.version]) continue;
    job._path = b.pathname;
    if (job.review) job.reviews = [...(job.reviews || []), job.review];
    delete job.review; job.needs = null;
    job.retries = { ...(job.retries || {}), [ENGINE.version]: now() };
    log(job, 'מנוע השרטוט השתפר — המערכת מנסה שוב את השרטוט מול תכנית המכר');
    await save(job, { state: 'queued', stage: 'queued', error: null });
    await store.putJson(`studio/queue/${job.id}.json`, { schema: 'habait-studio/queue.v1', job: job.id, uid: job.owner, pid: job.project, jobPath: b.pathname, at: now() });
    rq += 1;
  }
  if (rq) console.log(`run-job: ${rq} review job(s) requeued for engine ${ENGINE.version}`);
  return n + rq;
}

const lastLines = (t, n = 3) => String(t || '').trim().split(/\r?\n/).slice(-n).join(' | ').slice(0, 300);
// fork B's trace-check.json → the portal's check table (studio-web/CLAUDE.md): needs.check = { verdict, summary, rows:[{ label,
// printed_cm, traced_cm, delta_cm, ok }] }. A dims row's expected/got are side lists in cm; the delta is the largest side difference.
function checkTable(tc) {
  if (!tc) return null;
  const num = (v) => (Array.isArray(v) ? v.map(Number) : Number(v));
  const delta = (a, b) => { a = num(a); b = num(b);
    if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) return Math.round(Math.max(...a.map((x, i) => Math.abs(x - b[i]))) * 10) / 10;
    return Number.isFinite(a) && Number.isFinite(b) ? Math.round(Math.abs(a - b) * 10) / 10 : null; };
  const fmt = (v) => (Array.isArray(v) ? v.join(' × ') : v ?? null);
  const rows = (tc.checks || []).map((c) => ({ label: `${c.name || c.room || ''}${c.name || c.room ? ' · ' : ''}${c.check}`, printed_cm: fmt(c.expected), traced_cm: fmt(c.got), delta_cm: delta(c.expected, c.got), ok: Boolean(c.pass) }));
  const bad = rows.filter((r) => !r.ok).length;
  const verdict = String(tc.status || '').toUpperCase() === 'PASS' && !bad ? 'PASS' : 'FAIL';
  return { verdict, summary: `${rows.length - bad} מתוך ${rows.length} בדיקות עברו${tc.round ? ` (סבב ${tc.round})` : ''}`, rows };
}
// a gate refused (trace-check, the render self-check, the furnish audit, the fidelity gate, the consistency check): the job stops in
// 'review' for Habait's review queue with the mismatches; nothing further runs and nothing reaches the developer as if it passed
// parity row 30 (the coordinator, 2026-11-06): a failure inside a stage never reaches the developer as a traceback. It goes to Habait's
// review (job.review: the step and the technical text, read by Habait only) and the developer reads one Hebrew line; job.error stays
// empty because the portal shows it verbatim (studio.js st-job-err)
const STEP_HE = { trace: 'שרטוט הדירה', apartment: 'הכנת תיקיית הדירה', casework: 'איתור הכיור והכיריים', cameras: 'נקודות הצילום', prompts: 'תיאור העיצוב',
  furnish: 'הריהוט לפי התכנית', render: 'הרינדור', scenes: 'מפת החדרים', sets: 'תמונות הסיור', skin: 'עיצוב החדרים', gate: 'בדיקת ההתאמה', markers: 'סימון הרהיטים',
  build: 'בניית הסיור', package: 'חבילת הפרויקט', qa: 'בדיקת התצוגה בנייד ובמחשב', publish: 'הפרסום' };
async function toReview(job, e, step = job.stage) {
  job.review = { at: now(), stage: 'build', step, error: String(e?.message || e).slice(0, 1500) };
  job.needs = { type: 'habait_review', stage: 'build', step };
  log(job, `הבנייה עצרה בשלב ${STEP_HE[step] || 'הבנייה'} ועברה לבדיקה של צוות Habait. אין צורך לעשות דבר — נעדכן כאן כשהיא ממשיכה.`);
  await save(job, { state: 'review', error: null });
}
async function review(job, at, mismatches) {
  job.review = { at: now(), stage: at, mismatches: (mismatches || []).slice(0, 50) };
  job.needs = { type: 'habait_review', stage: at, count: job.review.mismatches.length, ...(job.check ? { check: job.check } : {}) };
  log(job, 'השרטוט לא עבר עדיין את בדיקת ההתאמה לתכנית המכר. המערכת ממשיכה לתקן.');
  await save(job, { state: 'review', stage: 'review', engine: { version: ENGINE.version, parts: ENGINE.parts, at: now() } });   // the portal shows «ממשיכים לדייק»; the engine stamp lets the sweep retry it when the engine improves
}

// ───────────────────────────── the stages
async function stageDownload(job, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const spec = await store.getJson(job.inputs.spec);
  if (!spec) throw new Error('spec.json is missing from the project (the reading was not saved)');
  writeJsonFile(path.join(dir, 'spec.json'), spec);
  const got = [];
  for (const p of job.inputs.files || []) {
    const b = await store.getBytes(p); if (!b) continue;
    const name = p.split('/').pop(); fs.writeFileSync(path.join(dir, name), b); got.push(name);
  }
  log(job, `הורדו ${got.length} קבצים והקריאה המאושרת`);
  return { spec, files: got };
}

function pickSalesPlan(dir, files) {
  const pdfs = files.filter((f) => /\.pdf$/i.test(f)); const pngs = files.filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
  const f = pdfs[0] || pngs[0];
  return f ? path.join(dir, f) : null;
}

// --no-paid on the command line OR on the job itself (job.no_paid: a $0 test project keeps it through the portal's approve path, which
// dispatches the build with no flags) — no fal / OpenRouter call at all
const noPaid = (job) => has('--no-paid') || job?.no_paid === true;
async function stageTrace(job, dir, correction) {
  const planFile = pickSalesPlan(dir, fs.readdirSync(dir));
  if (!planFile) throw new Error('no sales plan among the uploads (a PDF or an image)');
  const out = path.join(dir, 'trace');
  // the key stays in the LIVE tree's .env: auto-trace loads it itself from --env-root (a worktree has no .env; this tool never reads one)
  const ENV_ROOT = process.env.HABAIT_ENV_ROOT || 'C:/RnD/Projects/Habait/habait-walkaround';
  // fork B's contract (auto-trace.mjs header): trace_check.py + an independent vision judge run INSIDE auto-trace, with up to 3
  // self-correction rounds. EXIT 0 PASS · 5 FAIL (never shown to the developer) · 3 no plan drawing · 4 budget · 1/2 error.
  // Eliran 2026-11-04: the AI verifies fidelity itself — the developer's approval is NOT the check.
  fs.rmSync(out, { recursive: true, force: true });
  const args = [path.join(TOOLS, 'auto-trace.mjs'), planFile, '--out', out, '--id', job.project, '--budget', '1', '--env-root', ENV_ROOT,
    '--spec', path.join(dir, 'spec.json'), '--review-queue', path.join(OUTROOT, '_review-queue.jsonl'),
    // the paid calls' ledger lives OUTSIDE the trace folder (cleared on every run) and accumulates across runs (root §7)
    '--ledger', path.join(OUTROOT, job.project, 'ledger.json')];
  if (job.inputs?.type) args.push('--type', String(job.inputs.type));
  // --no-paid (2026-11-06, Eliran: «כל מה שלא דורש עוד כסף»): the trace makes NO paid call — it needs a saved reading among the uploads
  // (<name>.vlm.json, auto-trace --vlm-file), skips the vision judge (--no-judge, recorded) and books nothing (--budget 0)
  if (noPaid(job)) {
    const vlm = fs.readdirSync(dir).find((f) => /\.vlm\.json$/i.test(f));
    if (!vlm) throw new Error('--no-paid: no saved reading (*.vlm.json) among the uploads, and a fresh reading is a paid call');
    args[args.indexOf('--budget') + 1] = '0';
    args.push('--vlm-file', path.join(dir, vlm), '--no-judge');
  }
  if (correction) log(job, `התיקון שלכם נשמר: «${correction.slice(0, 120)}» — השרטוט רץ שוב`);
  log(job, 'הסוכן משרטט את הדירה מתוך תכנית המכר ובודק אותה מול התכנית');
  const r = await run('node', args, REPO, 1500, job);
  fs.writeFileSync(path.join(dir, 'auto-trace.log'), r.out);
  const index = fs.existsSync(path.join(out, 'index.json')) ? readJson(path.join(out, 'index.json')) : { plans: [] };
  // ONE dwelling may have several plan drawings (a duplex / garden unit: ground floor + first floor). Every floor is checked and
  // shown: the check table carries every floor's rows (labelled by floor), and the dwelling passes only when every floor passes.
  const plans = (index.plans || []).map((p, k) => ({ ...p, k: k + 1, pdir: path.isAbsolute(p.dir) ? p.dir : path.join(out, p.dir) }));
  const P = plans[0] || null;
  const pdir = P ? P.pdir : null;
  const pre = job.inputs.prefix;
  const many = plans.length > 1;
  const upFrom = async (dirp, name, as) => { if (dirp && fs.existsSync(path.join(dirp, name))) await store.putFile(`${pre}trace/${as}`, path.join(dirp, name)); };
  const up = async (name, as = name) => upFrom(pdir, name, as);
  const tables = [];
  for (const p of plans) {
    const sfx = many ? `-${p.k}` : '';
    await upFrom(p.pdir, 'trace-check.json', `trace-check${sfx}.json`); await upFrom(p.pdir, 'report.md', `report${sfx}.md`); await upFrom(p.pdir, 'report.json', `report${sfx}.json`);
    if (many) await upFrom(p.pdir, 'overlay.png', `overlay${sfx}.png`);   // Habait's review sees every floor's overlay
    const tc = fs.existsSync(path.join(p.pdir, 'trace-check.json')) ? readJson(path.join(p.pdir, 'trace-check.json')) : null;
    const t = checkTable(tc);
    tables.push({ p, tc, t: t || { verdict: 'FAIL', summary: 'no trace-check.json', rows: [] } });
  }
  const floor = (p) => p.floor_label || `plan ${p.k}`;
  const allRows = tables.flatMap(({ p, t }) => t.rows.map((row) => ({ ...row, label: many ? `${floor(p)} · ${row.label}` : row.label })));
  const bad = allRows.filter((row) => !row.ok).length;
  const verdict = tables.length && tables.every(({ p, t }) => t.verdict === 'PASS' && String(p.status || 'PASS').toUpperCase() === 'PASS') ? 'PASS' : 'FAIL';
  job.check = tables.length ? { verdict, summary: `${allRows.length - bad} מתוך ${allRows.length} בדיקות עברו${many ? ` · ${plans.length} קומות: ${tables.map(({ p, t }) => `${floor(p)} ${t.verdict}`).join(', ')}` : ''}`, rows: allRows,
    ...(many ? { floors: tables.map(({ p, t }) => ({ floor: floor(p), dwelling: p.dwelling_label || null, verdict: t.verdict, summary: t.summary, overlay: `trace/overlay-${p.k}.png` })) } : {}) } : null;
  if (r.status === 0 && job.check?.verdict !== 'PASS') return review(job, 'trace', [{ what: 'auto-trace exited 0 but its trace-check table is not a PASS', detail: job.check ? job.check.summary : 'no trace-check.json' }]);
  if (r.status === 5) {
    const failures = tables.flatMap(({ p, tc }) => (tc?.failures || (tc?.checks || []).filter((c) => !c.pass)).map((f) => (typeof f === 'object' ? { floor: floor(p), ...f } : { floor: floor(p), what: String(f) })));
    const unread = plans.flatMap((p) => (p.could_not_read || []).map((w) => ({ floor: floor(p), what: 'could not read', detail: String(w).slice(0, 300) })));
    return review(job, 'trace', [...failures, ...unread].length ? [...failures, ...unread] : [{ what: 'trace-check / judge FAIL', detail: lastLines(r.out) }]);
  }
  if (r.status === 3) return review(job, 'trace', [{ what: 'no plan drawing found in the uploads', detail: lastLines(r.out) }]);
  if (r.status === 4) throw new Error(`the auto-trace budget was reached: ${lastLines(r.out)}`);
  if (!r.ok || !pdir || !fs.existsSync(path.join(pdir, 'plan.general.json')) || !fs.existsSync(path.join(pdir, 'overlay.png'))) throw new Error(`auto-trace failed (exit ${r.status}): ${lastLines(r.out)}`);
  const plan = path.join(pdir, 'plan.general.json');
  fs.copyFileSync(plan, path.join(out, 'plan.general.json'));
  if (fs.existsSync(path.join(pdir, 'crop.png'))) fs.copyFileSync(path.join(pdir, 'crop.png'), path.join(out, 'crop.png'));
  await up('plan.general.json', 'plan.json'); await up('overlay.png'); await up('crop.png');
  log(job, 'בדיקת ההתאמה של השרטוט לתכנית המכר עברה');
  const pj = readJson(plan);
  const note = `${pj.rooms?.length ?? 0} חדרים, ${pj.openings?.length ?? 0} פתחים, ${pj.panes?.length ?? 0} חלונות וקירות זכוכית. השרטוט עבר את בדיקת ההתאמה האוטומטית לתכנית המכר; עברו עליו גם אתם.`;
  job.needs = { type: 'trace_approval', overlay: 'trace/overlay.png', trace: 'trace/plan.json', note, check: job.check };
  log(job, 'השרטוט מוכן וממתין לאישורכם מול תכנית המכר');
  await save(job, { state: 'waiting', stage: 'trace_approval', percent: 20 });
}

async function stageBuild(job, dir) {
  const pre = job.inputs.prefix;
  const tracePath = job.inputs.trace || job.approvals?.trace?.trace;
  if (!tracePath) throw new Error('no approved trace on the job');
  const plan = path.join(dir, 'trace', 'plan.general.json');
  const crop = path.join(dir, 'trace', 'crop.png');
  if (!fs.existsSync(plan)) { const b = await store.getBytes(`${pre}${tracePath}`); if (!b) throw new Error('the approved trace is not in the store'); fs.mkdirSync(path.dirname(plan), { recursive: true }); fs.writeFileSync(plan, b); }
  if (!fs.existsSync(crop)) { const b = await store.getBytes(`${pre}trace/crop.png`); if (b) fs.writeFileSync(crop, b); }
  if (!fs.existsSync(crop)) throw new Error('the plan crop (trace/crop.png) is missing: the trace step must upload it');
  const id = job.project;
  const skin = !noPaid(job) && !has('--no-skin');
  const steps = ['apartment', 'casework', 'cameras', 'prompts', 'furnish', 'render', 'scenes', 'sets', ...(skin ? ['skin'] : []), 'gate', ...(noPaid(job) ? [] : ['markers']), 'build', 'package', 'qa'];   // --no-paid: a $0 dry run (no skin, no rings)
  const PCT = { apartment: 25, cameras: 28, prompts: 30, furnish: 35, render: 40, scenes: 55, sets: 58, skin: 60, gate: 82, markers: 85, build: 92, package: 95, qa: 96 };
  const HE = { apartment: 'מכינים את תיקיית הדירה', casework: 'מאתרים בשרטוט את הכיור, הכיריים והארון הגבוה', cameras: 'ממקמים נקודת צילום בכל חדר', prompts: 'כותבים את תיאור החומרים האחיד', furnish: 'מרהטים לפי התכנית', render: 'מרנדרים את החדרים (Blender)', scenes: 'בונים את המעברים בין החדרים', sets: 'מכינים את תמונות הסיור', gate: 'בדיקת התאמה לתכנית המכר', markers: 'מסמנים את הריהוט להחלפה', build: 'בונים את הסיור', package: 'אורזים את חבילת הפרויקט', skin: 'מעצבים כל חדר, בודקים התאמה לתכנית המכר ועקביות בין החדרים, ומתקנים עד שהכל עובר', qa: 'בודקים את דף הפרויקט והסיור בטלפון ובמחשב' };
  const jobFile = path.join(OUTROOT, id, 'job.runner.json');
  for (const s of steps) {
    log(job, HE[s]); await save(job, { state: 'running', stage: s, percent: PCT[s] });
    const args = [path.join(TOOLS, 'run-project.mjs'), id, '--steps', s, '--job', jobFile];
    if (s === 'apartment') args.push('--plan', plan, '--crop', crop, '--spec', path.join(dir, 'spec.json'));
    // --render=WxH@spp (fork E, 2026-11-05): the render setting named per job (the sandbox proof at 2048x1024@16); else --draft; else run-project's defaults
    const renderArg = argv.find((a) => /^--render=\d+x\d+@\d+$/.test(a));
    if (s === 'render' && renderArg) { const [r, smp] = renderArg.slice(9).split('@'); args.push('--res', r, '--samples', smp); }
    else if (s === 'render' && has('--draft')) args.push('--res', '1024x512', '--samples', '16');
    if (s === 'skin') args.push('--skin', '--skin-soft', opt('--skin-soft', '40'), '--skin-hard', opt('--skin-hard', '60'), ...(has('--past-soft') ? ['--past-soft'] : []));   // the proof setting (846: 11 points in ~12 min); production = run-project's defaults
    const r = await run('node', args, REPO, s === 'render' ? 5400 : s === 'skin' ? 16000 : 1800, job);
    fs.appendFileSync(path.join(dir, 'build.log'), `\n===== ${s} =====\n${r.out}`);
    // the responsive gate's screenshots + verdict travel with the job, pass or fail (Eliran 2026-11-05: desktop AND mobile, stored with the job)
    if (s === 'qa') { const qd = path.join(OUTROOT, id, 'qa'); const shots = fs.existsSync(qd) ? fs.readdirSync(qd) : []; for (const f of shots) await store.putFile(`${pre}results/qa/${f}`, path.join(qd, f)); job.qa = { verdict: r.ok ? 'PASS' : 'FAIL', report: 'results/qa/verdict.json', shots: shots.filter((f) => f.endsWith('.png')).map((f) => `results/qa/${f}`) }; }
    if (!r.ok) {
      const renderLog = path.join(OUTROOT, id, 'render.log');
      const gateShaped = s === 'gate' || s === 'qa' || (s === 'skin' && /not every room passes|not packaged/.test(r.out)) || /furnish audit refused/.test(r.out)
        || (s === 'render' && fs.existsSync(renderLog) && /verdict FAIL|hole in the sphere/.test(fs.readFileSync(renderLog, 'utf8')));
      if (gateShaped) return review(job, s, [{ what: `the ${s} self-check refused the build`, detail: lastLines(r.out) }]);
      throw new Error(`${s}: ${lastLines(r.out)}`);
    }
  }
  const pkg = path.join(OUTROOT, id, 'package');
  const manifest = readJson(path.join(pkg, 'package.json'));
  // per room (fork D's build card): one row per scene of the apartment, from the gate step. A CG-only set passes by construction
  // (each panorama IS the render of the approved trace); a skinned set carries the fidelity gate's verdict per scene.
  const gv = String(manifest.steps?.gate?.verdict || 'not run');
  const skinRep = (() => { try { return readJson(path.join(ROOT, 'apartments', id, '_local', 'skin-report.json')); } catch { return null; } })();
  const rooms = readJson(path.join(ROOT, 'apartments', id, 'scenes.json')).scenes.filter((s) => !s.exterior).map((s) => {
    const g = skinRep?.scenes?.[s.asset];
    return { room: s.name?.he || s.id, verdict: g ? (g.verdict === 'PASS' ? 'PASS' : 'FAIL') : (gv.startsWith('PASS') ? 'PASS' : 'PENDING'),
      note: g ? `סטייה ${g.deviation_pct}% (סף ${skinRep.rule.max_deviation_pct}%)` : (gv.startsWith('PASS (CG only') ? 'תמונת המודל של השרטוט המאושר' : gv) };
  });
  const fidelity = { verdict: rooms.every((r) => r.verdict === 'PASS') ? 'PASS' : rooms.some((r) => r.verdict === 'FAIL') ? 'FAIL' : 'PENDING', report: `${pre}package/package.json`, rooms };
  if (fidelity.verdict === 'FAIL') { job.fidelity = fidelity; return review(job, 'fidelity', rooms.filter((r) => r.verdict === 'FAIL').map((r) => ({ what: `${r.room}: fidelity gate FAIL`, detail: r.note }))); }
  // the package → the store (the publisher serves it from there; the local proof serves it from disk)
  log(job, 'מעלים את חבילת הפרויקט'); await save(job, { stage: 'publish', percent: 97 });
  const n = await publishPackage(pkg, pre, id, job.id);
  job.result = { package: `out/${id}/package/`, page: `/p/${id}/`, tour: `/p/${id}/tour/`, fidelity };
  job.links = [{ label: 'דף הפרויקט', href: `/p/${id}/` }, { label: 'סיור 360° בדירה', href: `/p/${id}/tour/` }];
  log(job, `החבילה הועלתה (${n} קבצים). ההדמיה מוכנה: ${fidelity.verdict}`);
  await save(job, { state: 'done', stage: 'done', percent: 100, needs: null, error: null });
}

// the package → the store under the job's private prefix, then the public pointer: the /p/<pid>/ route (studio-web/api/studio-pub.mjs)
// serves ONLY the files listed in studio/pub/<pid>.json, from that prefix. Also the CLI --publish-dir <package> --pid <pid> --prefix <p>.
async function publishPackage(pkg, pre, id, jobId) {
  const files = []; const list = (d, rel) => { for (const e of fs.readdirSync(d)) { const p = path.join(d, e); const r = `${rel}${e}`; if (fs.statSync(p).isDirectory()) list(p, `${r}/`); else files.push([r, p]); } };
  list(pkg, '');
  for (const [r, p] of files) await store.putFile(`${pre}package/${r}`, p);
  // never the edit function's source (tour/api/): /p/<pid>/tour/api/edit is the shared /api/tour-edit
  await store.putJson(`studio/pub/${id}.json`, { schema: 'habait-studio/pub.v1', pid: id, prefix: `${pre}package/`, files: files.map(([r]) => r).filter((f) => /^(tour\/|platform\/projects\.json$|platform\/fixtures\/|platform\/_local\/dist\/)/.test(f) && !/^tour\/api\//.test(f)), job: jobId, at: now() });
  return files.length;
}

// ───────────────────────────── one job
async function handle(entry) {
  const job = await store.getJson(entry.jobPath);
  if (!job) { await store.del(entry._queuePath); return console.log(`  ${entry.job}: no job.json, pointer dropped`); }
  job._path = entry.jobPath;
  if (job.state === 'done' || job.state === 'failed' && !job.corrections?.length) { await store.del(entry._queuePath); return console.log(`  ${job.id}: ${job.state}, pointer dropped`); }
  if (job.state === 'running') return console.log(`  ${job.id}: already running elsewhere`);
  if (job.state === 'review') { await store.del(entry._queuePath); return console.log(`  ${job.id}: in Habait review (${job.review?.stage}), pointer dropped`); }
  if (job.state === 'waiting' && job.needs) return console.log(`  ${job.id}: waiting for the developer (${job.needs.type})`);
  const dir = path.join(OUTROOT, job.project, 'in');
  CURRENT = job;
  // the job's operations = its count from earlier sessions + everything this process did for it (a --job process serves one job;
  // the queue pointer read before the claim included)
  OPS_BASE = { advanced: job.blob_ops?.advanced || 0, simple: job.blob_ops?.simple || 0, list: job.blob_ops?.list || 0, put: job.blob_ops?.put || 0 };
  try {
    await save(job, { state: 'running', error: null }); await store.del(entry._queuePath);   // the claim
    await stageDownload(job, dir);
    const approvedAt = job.approvals?.trace?.at || '';
    const correction = (job.corrections || []).filter((c) => c.at > approvedAt).slice(-1)[0]?.text || null;
    const needsTrace = !job.inputs?.trace || correction;
    if (needsTrace) { await save(job, { stage: 'trace', percent: 10 }); await stageTrace(job, dir, correction); return; }
    await stageBuild(job, dir);
  } catch (e) {
    await toReview(job, e);
  } finally {
    CURRENT = null;
    // in a sandbox (fork E): close the sandbox record on the job — the minutes this session actually ran, for the job's cost line
    if (process.env.HABAIT_STAGE && job.sandbox && !job.sandbox.ended) {
      closeSession(job, `run-job ended (${job.state})`);
      const minutes = Math.round(((job.sandbox.sessions || []).reduce((s, x) => s + (x.minutes || 0), 0) || (Date.now() - Date.parse(job.sandbox.started || Date.now())) / 60000) * 10) / 10;
      await save(job, { sandbox: { ...job.sandbox, ended: now(), minutes } }).catch(() => {});
    }
  }
}
// the session record (fork E): the minutes of THIS sandbox session on job.sandbox.sessions[-1] (a build may take several)
function closeSession(job, how) {
  const s = job.sandbox?.sessions?.[job.sandbox.sessions.length - 1];
  if (!s || s.ended) return;
  s.ended = now(); s.minutes = Math.round((Date.now() - Date.parse(s.started)) / 6000) / 10; s.how = how; s.stage_at_end = job.stage;
}

let lastSweep = 0;
async function pass() {
  // the sweep lists studio/u/ (advanced operations): once per process start, and in --watch at most every 30 min
  if (!opt('--job') && Date.now() - lastSweep > 1800000) { await sweep(); lastSweep = Date.now(); }
  // one named job: its queue pointer by path (ONE read), never a list() of the queue
  if (!LOCAL && opt('--job')) {
    const qp = `studio/queue/${opt('--job')}.json`; const e = await store.getJson(qp);
    console.log(`run-job: --job ${opt('--job')}: ${e?.jobPath ? 'queued' : 'no queue pointer'} (${store.kind})`);
    if (e?.jobPath) await handle({ ...e, _queuePath: qp });
    return;
  }
  const pointers = LOCAL ? [{ ...readJson(LOCAL), _queuePath: path.relative(path.resolve(opt('--files') || path.dirname(LOCAL)), LOCAL).replace(/\\/g, '/') }]
    : opt('--job') ? [await store.getJson(`studio/queue/${opt('--job')}.json`)].filter(Boolean).map((e) => ({ ...e, _queuePath: `studio/queue/${opt('--job')}.json` })).filter((e) => e.jobPath)   // a known path: no list
    : (await Promise.all((await store.list('studio/queue/')).map(async (b) => ({ ...(await store.getJson(b.pathname)), _queuePath: b.pathname })))).filter((e) => e && e.jobPath);
  const only = opt('--job');   // handle ONE named job; every other pointer is left exactly as it is
  const mine = only ? pointers.filter((e) => e.job === only) : pointers;
  console.log(`run-job: ${pointers.length} queued (${store.kind})${only ? ` · --job ${only}: ${mine.length} matched` : ''}`);
  for (const e of mine) await handle(e);
}

await openStore();
// --peek: read-only — list the queue and every job's state; claims nothing, writes nothing (the safe first look at the real store)
if (has('--peek')) {
  const ptrs = await store.list('studio/queue/');
  console.log(`run-job --peek: ${ptrs.length} queue pointer(s) in ${store.kind}`);
  for (const b of ptrs) {
    const e = await store.getJson(b.pathname); const j = e?.jobPath ? await store.getJson(e.jobPath) : null;
    console.log(`  ${e?.job || b.pathname} · project ${e?.pid || '?'} · state ${j?.state || '(no job.json)'} · stage ${j?.stage || '-'} · files ${(j?.inputs?.files || []).length} · trace approved ${Boolean(j?.approvals?.trace)} · spec ${j?.inputs?.spec ? 'yes' : 'no'}`);
  }
  process.exit(0);
}
if (has('--sweep-only')) { await sweep(); process.exit(0); }
// the job.json of an id by KNOWN paths only (the store quota, 2026-11-05): --job-path studio/u/<uid>/p/<pid>/job.json, else the
// queue pointer studio/queue/<id>.json's jobPath. No list() to find a job.
async function jobPathsFor(id) {
  if (opt('--job-path')) return [{ pathname: opt('--job-path') }];
  const jp = await findJobPath(id);   // studio/jobs/<id>.json, else the queue pointer; an old job: one list(), then indexed
  if (jp) return [{ pathname: jp }];
  fail(`${id}: no job address — pass --job-path studio/u/<uid>/p/<pid>/job.json`);
}
// --requeue <jobId>: Habait's action after a review (studio-web contract: "Habait … puts the job back to queued") — the review is
// kept in reviews[] as history, needs cleared, the queue pointer re-added. Nothing else changes.
if (opt('--requeue')) {
  const id = opt('--requeue');
  const jp = await findJobPath(id);
  for (const b of jp ? [{ pathname: jp }] : []) {
    const j = await store.getJson(b.pathname); if (!j || j.id !== id) continue;
    if (!['review', 'failed'].includes(j.state)) fail(`--requeue: ${id} is '${j.state}', not review/failed`);
    j._path = b.pathname;
    if (j.review) j.reviews = [...(j.reviews || []), j.review];
    delete j.review; j.needs = null;
    log(j, 'הבנייה חזרה לתור לבדיקה חוזרת');
    await save(j, { state: 'queued', stage: 'queued', error: null });
    await store.putJson(`studio/queue/${j.id}.json`, { schema: 'habait-studio/queue.v1', job: j.id, uid: j.owner, pid: j.project, jobPath: b.pathname, at: now() });
    console.log(`requeued ${id}`); process.exit(0);
  }
  fail(`--requeue: no job ${id}`);
}
// --publish-dir <package> --pid <pid> --prefix <studio/u/<uid>/p/<pid>/>: the publish step alone (the same publishPackage a job runs),
// for a package built outside a job (the proof); prints the count and the pointer path
if (opt('--publish-dir')) {
  const pid = opt('--pid'); const pre = opt('--prefix');
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(pid || '') || !/^studio\/u\/[A-Za-z0-9_-]{1,64}\/p\/[A-Za-z0-9_-]{1,64}\/$/.test(pre || '')) fail('--publish-dir needs --pid <pid> and --prefix studio/u/<uid>/p/<pid>/');
  const n = await publishPackage(path.resolve(opt('--publish-dir')), pre, pid, 'manual');
  console.log(`published ${n} files under ${pre}package/ · pointer studio/pub/${pid}.json`);
  process.exit(0);
}
// --show <jobId>: read-only — print what the portal reads from that job.json (state, stage, needs, check summary, review, log tail)
if (opt('--show')) {
  const jp = await findJobPath(opt('--show'));
  for (const b of jp ? [{ pathname: jp }] : []) {
    const j = await store.getJson(b.pathname); if (!j || j.id !== opt('--show')) continue;
    const c = j.needs?.check || j.check;
    console.log(JSON.stringify({ id: j.id, project: j.project, state: j.state, stage: j.stage, percent: j.percent, needs: j.needs ? { type: j.needs.type, stage: j.needs.stage, count: j.needs.count } : null,
      check: c ? { verdict: c.verdict, summary: c.summary, floors: c.floors, failing_rows: c.rows.filter((x) => !x.ok).slice(0, 12) } : null,
      review: j.review ? { stage: j.review.stage, mismatches: j.review.mismatches.length, first: j.review.mismatches.slice(0, 6) } : null,
      log: (j.log || []).slice(-6).map((l) => l.line), heartbeat: j.heartbeat, executor: j.executor, blob_ops: j.blob_ops || null }, null, 1));
  }
  process.exit(0);
}
// --watch polls the queue (one list() a pass): every 120 s by default (was 30 s = 120 advanced operations an hour, idle or not)
if (has('--watch')) { const every = Math.max(60, Number(opt('--every', '120'))) * 1000; for (;;) { await pass(); await new Promise((r) => setTimeout(r, every)); } }
else await pass();
