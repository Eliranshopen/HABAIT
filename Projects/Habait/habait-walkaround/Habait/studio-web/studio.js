/* Habait Studio — the developer portal page (/studio). Login: Clerk (its browser script from the instance's own Frontend API),
   in Hebrew (@clerk/localizations heIL). Files go straight from the browser to the private store (Supabase Storage since
   2026-11-05): /api/studio-upload only issues a short-lived URL for ONE object, the browser PUTs the file to it (≤ 50 MB). A PDF is also rendered HERE with pdf.js into an overview + overlapping ~250-dpi tiles (the idea of
   Habait/studio/tools/prep_pdf.py), uploaded beside it under files/.pages/<name>/, so the agent reads the small print off tiles.
   The build: job.json (contract in CLAUDE.md, habait-studio/job.v1) — this page queues it, shows its progress, and holds the
   developer's two fidelity approvals (the reading, the trace). No secret is in this file. */
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.4.299/';
const CLERK_HE = 'https://cdn.jsdelivr.net/npm/@clerk/localizations@3.37.10/+esm';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const show = (id) => { for (const s of ['st-boot', 'st-signin', 'st-list', 'st-project']) $(s).hidden = s !== id; };
const kb = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const safeName = (n) => String(n).normalize('NFC').replace(/[^\p{L}\p{N}._ ()-]+/gu, '_').replace(/^\.+/, '').slice(0, 120) || 'file';

let clerk = null;
let current = null;   // { project, files, spec, chat, spent, steps, job, consent }
let poll = null;

async function token() { return clerk?.session ? clerk.session.getToken() : null; }
async function api(path, opts = {}) {
  const t = await token();
  const r = await fetch(path, { ...opts, headers: { 'content-type': 'application/json', ...(t ? { authorization: `Bearer ${t}` } : {}), ...(opts.headers || {}) } });
  let j = null; try { j = await r.json(); } catch { /* empty */ }
  if (r.status === 401) { show('st-signin'); mountSignIn(); }
  return { status: r.status, ...(j || {}) };
}

function loadScript(src, attrs = {}) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = true; s.crossOrigin = 'anonymous'; for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v); s.onload = res; s.onerror = () => rej(new Error(`script ${src}`)); document.head.appendChild(s); });
}

function mountSignIn() {
  const el = $('st-clerk'); if (!clerk || el.dataset.mounted) return;
  el.dataset.mounted = '1';
  clerk.mountSignIn(el, { fallbackRedirectUrl: '/studio/', signUpFallbackRedirectUrl: '/studio/' });
}

// the boot never hangs on «טוען…» (Eliran 2026-11-08, preview: stuck forever in his browser): every network step has a deadline,
// a watchdog covers what is left, and a stall shows a Hebrew error naming the step, with a retry button
const BOOT_STEPS = { config: 'הגדרות השרת', clerk: 'טעינת ההתחברות', load: 'חיבור לחשבון', watchdog: 'טעינת הדף' };
let bootDone = false;
const withTimeout = (p, ms, step) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error(`timeout ${step} ${ms} ms`), { step })), ms))]);
function bootFail(step, why) {
  if (bootDone) return; bootDone = true;
  console.error('studio boot failed', step, why);
  show('st-boot');
  $('st-boot').innerHTML = `<div class="st-boot-err" role="alert"><p><b>הדף לא נטען עד הסוף.</b></p>
    <p class="st-muted st-small">השלב שנתקע: ${esc(BOOT_STEPS[step] || step)}. בדקו את החיבור לאינטרנט, או כבו חוסם פרסומות לאתר הזה, ונסו שוב.</p>
    <button class="hb-btn hb-btn--primary" type="button" id="st-retry">נסו שוב</button></div>`;
  $('st-retry').addEventListener('click', () => location.reload());
}
function bootOk() { bootDone = true; }

async function boot() {
  const t0 = performance.now(); const mark = (s) => console.info(`studio boot · ${s} · ${Math.round(performance.now() - t0)} ms`);
  const watchdog = setTimeout(() => { if (!bootDone && !$('st-boot').hidden) bootFail('watchdog', 'still on the boot screen after 30 s'); }, 30000);
  let step = 'config';
  try {
    const cfg = await withTimeout(fetch('/api/studio-config', { cache: 'no-store' }).then((r) => { if (!r.ok) throw new Error(`studio-config ${r.status}`); return r.json(); }), 10000, step);
    mark('config');
    const pk = cfg?.clerkPublishableKey;
    if (!pk) { bootOk(); clearTimeout(watchdog); $('st-boot').innerHTML = '<p class="st-muted">ההתחברות עוד לא מוגדרת בשרת.</p>'; return; }
    const fapi = atob(pk.split('_')[2] || '').replace(/\$$/, '');
    step = 'clerk';
    const [he] = await Promise.all([
      withTimeout(import(CLERK_HE), 6000, 'he').then((m) => m.heIL).catch(() => undefined),   // the Hebrew strings are optional: never block on them
      withTimeout(loadScript(`https://${fapi}/npm/@clerk/clerk-js@5/dist/clerk.browser.js`, { 'data-clerk-publishable-key': pk }), 20000, step),
    ]);
    mark('clerk script');
    step = 'load';
    clerk = window.Clerk;
    if (!clerk) throw new Error('window.Clerk missing after the script loaded');
    await withTimeout(clerk.load({ localization: he }), 20000, step);
    mark('clerk.load');
  } catch (e) { clearTimeout(watchdog); bootFail(e.step || step, e); return; }
  bootOk(); clearTimeout(watchdog);
  window.addEventListener('hashchange', route);   // always: a visitor who signs in on this page must still move between views
  clerk.addListener(({ user }) => { if (user && !$('st-signin').hidden) route(); });
  if (!clerk.user) { show('st-signin'); mountSignIn(); return; }
  route();
}

function route() {
  if (!clerk?.user) return;
  if (!$('st-user').childElementCount) clerk.mountUserButton($('st-user'));
  const m = /^#p=([A-Za-z0-9_-]{1,64})$/.exec(location.hash);
  if (m) openProject(m[1]); else listProjects();
}

async function listProjects() {
  stopPoll();
  show('st-list');
  const r = await api('/api/studio-projects');
  const ps = r.projects || [];
  $('st-empty').hidden = ps.length > 0;
  // the list comes from one index document (no per-project read): name and date; the steps show inside the project
  $('st-projects').innerHTML = ps.map((p) => `<li><a href="#p=${esc(p.id)}"><strong>${esc(p.name)}</strong><span class="st-muted">${new Date(p.created).toLocaleDateString('he-IL')}</span></a></li>`).join('');
}

$('st-new').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('st-new-name').value.trim(); if (!name) return;
  const r = await api('/api/studio-projects', { method: 'POST', body: JSON.stringify({ name }) });
  if (r.ok) { $('st-new-name').value = ''; history.replaceState(null, '', `#p=${r.project.id}`); openProject(r.project.id); }
});
$('st-back').addEventListener('click', (e) => { e.preventDefault(); location.hash = ''; listProjects(); });

let openSeq = 0;   // the newest read wins: a slow older response never paints over a newer one
async function openProject(id, { quiet = false } = {}) {
  if (!quiet) show('st-project');
  const seq = ++openSeq;
  const r = await api(`/api/studio-projects?id=${encodeURIComponent(id)}`);
  if (seq !== openSeq) return;
  if (!r.ok) { if (!quiet) location.hash = ''; return; }
  current = r;
  render();
  if (jobActive(r.job)) startPoll(id); else stopPoll();
}
// the job poll (fork E 2026-11-05; live status 2026-11-08). The store's quota: a poll reads ONLY job.json (?only=job, one known path,
// never a list()), and a state change triggers one full read. Every state that is not finished is followed — 'waiting' too (Eliran
// 2026-11-08: the card stayed on «ממתין לאישור השרטוט» for hours after the trace was approved; the page stopped polling while a job
// waited, so an approval from another tab or device, or Habait's build approval, never reached it; and the build approval's own
// re-dispatch rides on this poll, see needsDispatch). Cadence: running/queued 8 s → 15 s after 2 min without change → 30 s after 10;
// waiting 15 → 30 → 60 s; Habait's review 60 s. A hidden tab is not polled; it reads at once when it becomes visible again.
const LIVE_STATES = ['queued', 'running', 'waiting', 'review'];
const jobActive = (j) => Boolean(j && LIVE_STATES.includes(j.state));
const jobSig = (j) => (j ? `${j.state}|${j.stage}|${j.percent}|${j.needs?.type || ''}|${(j.log || []).length}|${j.updated || ''}` : '');
function pollEvery(job, idle) {
  if (job?.state === 'review') return 60000;
  if (job?.state === 'waiting') return idle > 600000 ? 60000 : idle > 120000 ? 30000 : 15000;
  return idle > 600000 ? 30000 : idle > 120000 ? 15000 : 8000;
}
let pollSig = '', pollSince = 0, pollPid = null, pollPaused = false;
function schedule(ms) { if (poll) clearTimeout(poll); poll = setTimeout(pollTick, ms); }
function startPoll(id) {
  if (poll && pollPid === id) return;   // already following this project
  stopPoll();
  pollPid = id; pollSince = Date.now(); pollSig = jobSig(current?.job); pollPaused = false;
  schedule(pollEvery(current?.job, 0));
}
async function pollTick() {
  poll = null;
  const id = pollPid;
  if (!id || !current || current.project?.id !== id || location.hash !== `#p=${id}`) return;
  if (document.hidden) { pollPaused = true; return; }   // resumed by visibilitychange
  const seq = openSeq;
  const r = await api(`/api/studio-projects?id=${encodeURIComponent(id)}&only=job`);
  if (pollPid !== id || seq !== openSeq) return;   // the project changed, or a full read started meanwhile (it owns the poll now)
  if (r.ok && r.job) {
    const sig = jobSig(r.job);
    const changed = sig !== pollSig;
    if (changed) { pollSig = sig; pollSince = Date.now(); }
    const changedState = current.job?.state !== r.job.state || current.job?.needs?.type !== r.job.needs?.type;
    if (changed) { current.job = r.job; render(); }
    if (changedState || !jobActive(r.job)) return openProject(id, { quiet: true });   // one full read (steps, trace card), then the rule above
  }
  schedule(pollEvery(current.job, Date.now() - pollSince));
}
function stopPoll() { if (poll) { clearTimeout(poll); poll = null; } pollPid = null; pollPaused = false; }
document.addEventListener('visibilitychange', () => {
  if (document.hidden || !pollPaused || !pollPid) return;
  pollPaused = false; pollSince = Date.now(); schedule(0);
});

/* ---------- the steps: the first three from the project, the rest from the build job ---------- */
// job.stage may be a portal stage or one of the runner's steps (tour360/PROJECT-PACKAGE.md, tools/run-project.mjs); each maps to a portal step
const PHASE = { queued: 'queued', trace: 'trace', trace_approval: 'trace', review: 'trace', trace_check: 'trace', build_approval: 'build',
  platform: 'build', apartment: 'build', cameras: 'build', prompts: 'build', scenes: 'build', furnish: 'build', model: 'build', render: 'build', skin: 'build', sets: 'build', markers: 'build', dollhouse: 'build',
  fidelity: 'fidelity', consistency: 'fidelity', gate: 'fidelity', qa: 'fidelity', casework: 'build',
  build: 'publish', package: 'publish', publish: 'publish', 'publish-local': 'publish', done: 'done' };
const STAGE_HE = { queued: 'בתור', trace: 'שרטוט הדירה מתכנית המכר', trace_check: 'בדיקה אוטומטית של השרטוט מול תכנית המכר', trace_approval: 'השרטוט מוכן וממתין לאישורכם', build_approval: 'השרטוט אושר · הבנייה ממתינה לאישור צוות Habait', review: 'ממשיכים לדייק', platform: 'דף הפרויקט והדירות', apartment: 'נתוני הדירה',
  cameras: 'נקודות הצילום בחדרים', prompts: 'תיאור העיצוב', scenes: 'מפת החדרים והמעברים', furnish: 'ריהוט לפי התכנית', model: 'בניית מודל הדירה', render: 'צילום החדרים מהמודל',
  skin: 'עיצוב החדרים', sets: 'הכנת תמונות הסיור', markers: 'סימון הרהיטים להחלפה', dollhouse: 'מודל תלת-ממד', fidelity: 'בדיקת התאמה לתכנית המכר', consistency: 'בדיקת עקביות בין החדרים',
  build: 'בניית הסיור', package: 'הרכבת חבילת הפרויקט', gate: 'בדיקת ההדמיה מול תכנית המכר', qa: 'בדיקת התצוגה בנייד ובמחשב', casework: 'איתור הכיור והכיריים', publish: 'פרסום', 'publish-local': 'פרסום', done: 'ההדמיה מוכנה' };

/* ---------- ONE status, read by the flow bar AND the agent panel (Eliran 2026-11-08: the panel said «אין שרטוט שממתין לאישור»
   while the card said «ממתין לאישור השרטוט»; then: «עדיף שיהיה סרגל התקדמות בחלק העליון של הפורטל») ----------
   head  the one line both show, word for word (the bar's status line, the panel's status line)
   hint  what the developer does next, and where (the panel only)
   step  the flow step it belongs to (FLOW below), kind: you | habait | running | review | failed | done
   go    the element to scroll to and focus — `label` for the panel's button, `bar` for the bar's action button */
const FLOW = ['העלאה', 'קריאת התכנית', 'אישור הנתונים', 'שרטוט', 'אישור השרטוט', 'אישור Habait', 'בנייה', 'בדיקה מול תכנית המכר', 'פרסום'];
const STEP_OF_PHASE = { queued: 3, trace: 3, build: 6, fidelity: 7, publish: 8, done: 8 };
const stepOfStage = (stage) => (stage === 'build_approval' ? 5 : stage === 'trace_approval' ? 4 : STEP_OF_PHASE[PHASE[stage] || 'build']);
const GO = { trace: { el: 'st-trace-ok', label: 'מעבר לאישור השרטוט', bar: 'לאישור השרטוט ←' }, spec: { el: 'st-approve', label: 'מעבר לאישור הנתונים', bar: 'לאישור הנתונים ←' },
  build: { el: 'st-build-card', label: 'מעבר לבניית ההדמיה', bar: 'להתחלת הבנייה ←' }, rebuild: { el: 'st-build-card', label: 'מעבר לבנייה מחדש', bar: 'לבנייה מחדש ←' },
  files: { el: 'st-drop', label: 'מעבר לקבצים', bar: 'להעלאת קבצים ←' }, read: { el: 'st-read', label: 'מעבר לקריאת התכנית', bar: 'לקריאת התכנית ←' },
  results: { el: 'st-flow-act', label: 'מעבר לקישורים', bar: '' } };
function jobStatus(c = current) {
  const job = c?.job; const st = c?.project?.steps || {};
  if (!job) {
    if (!c?.files?.length) return { key: 'upload', step: 0, kind: 'you', head: 'הצעד הבא: העלאת תכנית המכר', hint: 'גררו את קובץ ה-PDF לכרטיס «קבצים», או בחרו אותו משם.', go: GO.files };
    if (st.read?.state === 'running') return { key: 'reading', step: 1, kind: 'running', head: 'הסוכן קורא את תכנית המכר', hint: 'הקריאה לוקחת כדקה או שתיים.' };
    if (st.read?.state === 'failed') return { key: 'read_failed', step: 1, kind: 'failed', head: 'הקריאה של תכנית המכר נכשלה', hint: 'נסו שוב בכפתור «הסוכן יקרא את תכנית המכר» בכרטיס «קבצים».', go: GO.read };
    if (!c.spec) return { key: 'read', step: 1, kind: 'you', head: 'הצעד הבא: קריאת תכנית המכר', hint: 'הכפתור «הסוכן יקרא את תכנית המכר» נמצא בכרטיס «קבצים».', go: GO.read };
    if (st.approve?.state !== 'done') return { key: 'approve', step: 2, kind: 'you', head: 'הצעד הבא: אישור הנתונים מול תכנית המכר', hint: 'בדקו את מה שהסוכן קרא, ואשרו בכפתור שבתחתית הכרטיס «מה הסוכן קרא מתכנית המכר».', go: GO.spec };
    return { key: 'build', step: 3, kind: 'you', head: 'הצעד הבא: בניית ההדמיה', hint: 'סמנו את ההסכמה ולחצו «בנו את ההדמיה» בכרטיס «בניית ההדמיה».', go: GO.build };
  }
  const verdict = checkVerdict(job);
  const traceOk = Boolean(job.approvals?.trace);
  // parity row 39: any review raised after the approved trace (a failed build step, or a build check: gate / qa / skin / fidelity) is a
  // BUILD review — never the drawing's «ממשיכים לדייק» card
  const buildReview = job.state === 'review' && Boolean(job.review) && job.review.stage !== 'trace';
  if (job.state === 'done') return { key: 'done', step: 8, kind: 'done', head: 'ההדמיה מוכנה', hint: 'הקישורים לדף הפרויקט ולסיור נמצאים בסרגל ההתקדמות בראש הדף.', go: GO.results };
  if (job.state === 'failed') {
    const s = job.stage || 'build';
    return { key: 'failed', step: stepOfStage(s), kind: 'failed', head: `נעצר: ${STAGE_HE[s] || s}`, hint: 'אפשר לנסות שוב בכפתור «נסו לבנות שוב» בכרטיס «בניית ההדמיה».', go: GO.rebuild };
  }
  if (buildReview) {
    const s = job.review.step || (job.review.stage === 'build' ? job.stage : job.review.stage);
    return { key: 'build_review', step: Math.max(6, stepOfStage(s)), kind: 'review', head: `בבדיקה של צוות Habait · ${STAGE_HE[s] || s}`, hint: 'אין צורך לעשות דבר. נעדכן כאן כשהבנייה תמשיך.' };
  }
  if (job.state === 'review' || (job.needs?.type === 'trace_approval' && verdict !== 'PASS')) {
    return { key: 'trace_review', step: 3, kind: 'review', head: 'ממשיכים לדייק', hint: 'הבדיקה האוטומטית מצאה הבדל בין השרטוט לתכנית המכר. המערכת ממשיכה לתקן לבד; אין צורך לעשות דבר.' };
  }
  if (job.needs?.type === 'trace_approval') {
    return { key: 'trace_approval', step: 4, kind: 'you', head: 'השרטוט מוכן וממתין לאישורכם', hint: 'הכפתור «השרטוט תואם לתכנית המכר: אישור» נמצא בכרטיס «שרטוט הדירה», מתחת לשרטוט.', go: GO.trace };
  }
  if (job.needs?.type === 'build_approval' || job.stage === 'build_approval') {
    return { key: 'build_approval', step: 5, kind: 'habait', head: 'השרטוט אושר · הבנייה ממתינה לאישור צוות Habait', hint: 'אין צורך לעשות דבר. נעדכן כאן כשהבנייה תתחיל.' };
  }
  if (job.state === 'queued') {
    if (traceOk && stageOfJob(job) === 'build') return { key: 'build_queued', step: 6, kind: 'running', head: 'השרטוט אושר · הבנייה בתור', hint: 'הבנייה תתחיל בדקות הקרובות. אפשר לסגור את הדף ולחזור אחר כך.' };
    if (job.stage === 'trace' && (job.corrections || []).length) return { key: 'correction_queued', step: 3, kind: 'running', head: 'התיקון התקבל · השרטוט מתעדכן', hint: 'נציג כאן את השרטוט המתוקן לאישור.' };
    return { key: 'queued', step: 3, kind: 'running', head: 'בתור', hint: 'הבנייה תתחיל בדקות הקרובות. אפשר לסגור את הדף ולחזור אחר כך.' };
  }
  const s = job.stage || 'build';
  return { key: 'running', step: stepOfStage(s), kind: 'running', head: STAGE_HE[s] || s, hint: 'הבנייה רצה בשרת. אפשר לסגור את הדף ולחזור אחר כך; ההתקדמות מתעדכנת כאן.' };
}
// the executor's own rule (api/_dispatch.mjs stageOf): a trace until one is approved, or again after a newer correction; else the build
function stageOfJob(job) {
  const approvedAt = job.approvals?.trace?.at || '';
  return !job.inputs?.trace || (job.corrections || []).some((x) => x.at > approvedAt) ? 'trace' : 'build';
}

const checkVerdict = (job) => String(job?.needs?.check?.verdict || job?.check?.verdict || '').toUpperCase();
const fmt = (v) => (v === null || v === undefined || v === '' ? '—' : esc(v));
function checkTable(check) {
  const rows = Array.isArray(check?.rows) ? check.rows : [];
  if (!rows.length) return '';
  return `<table class="st-spec-table st-check"><thead><tr><th>מידה</th><th>בתכנית (ס"מ)</th><th>בשרטוט (ס"מ)</th><th>הפרש</th><th></th></tr></thead><tbody>${rows.map((r) => {
    const ok = r.ok === true || String(r.verdict || '').toUpperCase() === 'PASS';
    const d = r.delta_cm ?? (Number.isFinite(+r.printed_cm) && Number.isFinite(+r.traced_cm) ? Math.round((+r.traced_cm - +r.printed_cm) * 10) / 10 : null);
    return `<tr class="${ok ? 'ok' : 'bad'}"><td>${fmt(r.label || r.room || r.name)}</td><td>${fmt(r.printed_cm)}</td><td>${fmt(r.traced_cm)}</td><td>${fmt(d)}</td><td>${ok ? '✓' : '✗'}</td></tr>`;
  }).join('')}</tbody></table>`;
}

// the flow bar: one row per step of FLOW; done ✓, the current step from jobStatus() (its head is the agent panel's line word for word),
// the rest muted. The action: the developer's turn → a button to the place; done → the result links; Habait's turn, running, review →
// the words only. Repainted by every render(), so the job poll moves it.
const KIND_HE = { you: 'ממתין לכם', habait: 'ממתין לצוות Habait', running: 'בעבודה', review: 'בבדיקה', failed: 'נעצר', done: 'הושלם' };
function resultLinks(job) {
  const res = job?.result || {};
  return [res.page ? { label: 'דף הפרויקט', href: res.page } : null, res.tour ? { label: 'סיור 360° בדירה', href: res.tour } : null, ...(job?.links || [])]
    .filter(Boolean).filter((l) => /^(\/|https:\/\/)/.test(l.href));
}
function renderFlow() {
  const s = jobStatus(); const n = FLOW.length; const all = s.kind === 'done';
  const bar = $('st-flow');
  bar.dataset.kind = s.kind; bar.dataset.status = s.key; bar.dataset.step = String(s.step);
  $('st-flow-steps').innerHTML = FLOW.map((label, i) => {
    const state = all || i < s.step ? 'done' : i === s.step ? 'current' : 'todo';
    const mark = state === 'done' ? '✓' : state === 'current' && s.kind === 'failed' ? '!' : String(i + 1);
    const sr = state === 'done' ? ' · הושלם' : state === 'current' ? ` · ${KIND_HE[s.kind]}` : '';
    return `<li class="${state}"${state === 'current' ? ` data-kind="${s.kind}" aria-current="step"` : ''}><span class="st-flow-dot" aria-hidden="true">${mark}</span><span class="st-flow-label">${esc(label)}<span class="st-sr">${esc(sr)}</span></span></li>`;
  }).join('');
  $('st-flow-name').textContent = all ? 'כל השלבים הושלמו' : FLOW[s.step];
  $('st-flow-count').textContent = all ? `${n} מתוך ${n}` : `שלב ${s.step + 1} מתוך ${n}`;
  $('st-flow-kind').textContent = KIND_HE[s.kind];
  $('st-flow-head').textContent = s.head;
  $('st-flow-line').style.width = `${Math.round(((all ? n : s.step + 0.5) / n) * 100)}%`;
  const act = $('st-flow-act');
  if (all) {
    act.innerHTML = resultLinks(current.job).map((l, i) => `<a class="hb-btn ${i === 0 ? 'hb-btn--primary' : 'hb-btn--secondary'}" href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('');
  } else if ((s.kind === 'you' || s.kind === 'failed') && s.go?.bar && $(s.go.el)) {
    act.innerHTML = `<button class="hb-btn hb-btn--primary" type="button" data-target="${esc(s.go.el)}">${esc(s.go.bar)}</button>`;
  } else act.innerHTML = '';
  act.hidden = !act.childElementCount;
  const err = s.kind === 'failed' ? (current.job?.error || '') : '';
  $('st-flow-err').hidden = !err; $('st-flow-err').textContent = err;
  flowMetrics();
}
$('st-flow-act').addEventListener('click', (e) => { const b = e.target.closest('button[data-target]'); if (b) scrollToTarget(b.dataset.target); });
$('st-flow-toggle').addEventListener('click', () => {
  const open = !$('st-flow').classList.contains('open');
  $('st-flow').classList.toggle('open', open);
  $('st-flow-toggle').setAttribute('aria-expanded', String(open));
});
// scroll to the place where the developer acts (the panel's button and the bar's button): the card into view, the control focused
function scrollToTarget(id) {
  const t = $(id || ''); if (!t) return;
  const card = t.closest('.st-card, .st-flow') || t;
  t.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: t === card ? 'start' : 'center' });   // the control itself, centred (a tall trace card centred hid its button)
  if (t.matches('button, a, input, textarea')) t.focus({ preventScroll: true }); else { card.setAttribute('tabindex', '-1'); card.focus({ preventScroll: true }); }
}
// the sticky offsets: the bar sits under the sticky header; the chat sits under both (scroll-padding keeps a scrolled-to card visible)
function flowMetrics() {
  const root = document.documentElement.style;
  const head = document.querySelector('.st-head')?.offsetHeight || 0;
  const flow = getComputedStyle($('st-flow')).position === 'sticky' && !$('st-project').hidden ? $('st-flow').offsetHeight + 12 : 0;
  root.setProperty('--st-head-h', `${head}px`); root.setProperty('--st-flow-h', `${flow}px`);
  root.scrollPaddingTop = `${head + flow + 8}px`;
}
addEventListener('resize', () => { if (current) flowMetrics(); });

function render() {
  const { project, files, spec, chat, spent } = current;
  $('st-pname').textContent = project.name;
  $('st-spent').textContent = `עלות AI בפרויקט: $${Number(spent || 0).toFixed(2)}`;
  renderFlow();
  $('st-files').innerHTML = files.map((f) => `<li class="${/\.pdf$/i.test(f.name) && !f.pages ? 'sub' : ''}"><span>${esc(f.name)}</span><span>${kb(f.bytes)}${/\.pdf$/i.test(f.name) ? (f.pages ? ' · עמודים מוכנים' : '') : ''}</span></li>`).join('');
  const hasReadable = files.some((f) => /\.(pdf|png|jpe?g|webp)$/i.test(f.name));
  $('st-file').disabled = false;
  $('st-read').disabled = !hasReadable;
  $('st-read').textContent = spec ? 'קריאה מחדש של תכנית המכר' : 'הסוכן יקרא את תכנית המכר';
  $('st-read-note').textContent = hasReadable ? 'הקריאה לוקחת כדקה או שתיים.' : 'העלו את תכנית המכר (PDF) כדי להתחיל.';
  renderSpec(spec);
  renderBuild();
  renderTrace();
  renderAgentStatus();
  // the messages repaint only when the chat itself changed: a poll repaints the status, never wipes a pending «הסוכן חושב…»
  const sig = `${current.project.id}|${chat.length}|${chat[chat.length - 1]?.at || ''}`;
  if (sig !== chatShown) { chatShown = sig; renderChat(chat); }
}
let chatShown = '';

function renderSpec(spec) {
  $('st-spec-card').hidden = !spec;
  if (!spec) return;
  const u = spec.unit || {}; const b = spec.building || {}; const d = spec.drawing || {};
  const other = (u.other_areas || []).map((a) => `${a.label}: ${a.m2} מ"ר`).join(' · ');
  const facts = [['פרויקט', spec.project_name], ['יזם', spec.developer], ['עיר', spec.city], ['כתובת', spec.address], ['בניין', b.name], ['קומה', b.floor_of_unit],
    ['דירה', u.number], ['טיפוס', u.type_mark], ['חדרים', u.rooms_count], ['שטח', u.area_m2 && `${u.area_m2} מ"ר`], ['מרפסת', u.terrace_m2 && `${u.terrace_m2} מ"ר`], ['שטחים נוספים', other],
    ['קנה מידה', d.scale], ['אדריכל', d.architect], ['תאריך', d.date]].filter(([, v]) => v !== null && v !== undefined && v !== '');
  const roomRows = (rooms) => (rooms || []).map((r) => `<tr><td data-l="חדר">${esc(r.name_he)}</td><td data-l="מידות (ס&quot;מ)">${esc((r.printed_dims_cm || []).join(' × ') || '—')}</td><td data-l="מ&quot;ר">${r.area_m2 ?? '—'}</td><td data-l="פתחים">${esc([r.openings, r.glazing].filter(Boolean).join(' · ') || '—')}</td><td data-l="אלמנטים קבועים">${esc(r.fixed_elements || '—')}</td></tr>`).join('');
  const table = (rooms) => `<table class="st-spec-table"><thead><tr><th>חדר</th><th>מידות (ס"מ)</th><th>מ"ר</th><th>פתחים</th><th>אלמנטים קבועים</th></tr></thead><tbody>${roomRows(rooms)}</tbody></table>`;
  const units = (Array.isArray(spec.units) && spec.units.length ? spec.units : [{ ...u, rooms: spec.rooms }])
    .map((x, i) => (i === 0 && !(x.rooms || []).length ? { ...x, rooms: spec.rooms } : x));
  const unitBlock = (x, i) => {
    const head = [x.type_mark && `טיפוס ${x.type_mark}`, x.number && `דירה ${x.number}`, x.rooms_count && `${x.rooms_count} חדרים`, x.area_m2 && `${x.area_m2} מ"ר`, x.terrace_m2 && `מרפסת ${x.terrace_m2} מ"ר`, x.floors && `קומות ${x.floors}`, x.plan_page && `עמוד ${x.plan_page}`].filter(Boolean).join(' · ');
    return `<h3 class="st-unit">${esc(head || `דירה ${i + 1}`)}</h3>${(x.other_areas || []).length ? `<p class="st-muted st-small">${esc((x.other_areas || []).map((a) => `${a.label}: ${a.m2} מ"ר`).join(' · '))}</p>` : ''}${table(x.rooms)}`;
  };
  $('st-spec').innerHTML = `<div class="st-facts">${facts.filter(([k]) => units.length === 1 || !['דירה', 'טיפוס', 'חדרים', 'שטח', 'מרפסת', 'שטחים נוספים'].includes(k)).map(([k, v]) => `<span>${esc(k)}: <b>${esc(v)}</b></span>`).join('')}</div>
    ${units.length > 1 ? `<p class="st-small"><b>${units.length} טיפוסי דירות נקראו</b></p>` : ''}${units.map(unitBlock).join('')}`;
  const un = spec.uncertainties || [];
  $('st-uncert').innerHTML = un.length ? `<b>לבדיקה שלכם (${un.length}):</b><ul>${un.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  const approved = current.project.steps?.approve?.state === 'done';
  $('st-approve').disabled = approved;
  $('st-approve').textContent = approved ? 'הנתונים אושרו ✓' : 'הנתונים תואמים לתכנית המכר: אישור';
}

// the build card holds only the START (consent + «בנו את ההדמיה»): before the first build and after a stop. The progress is the flow
// bar at the top; the log, the per-room check and a technical error are in «פירוט ויומן» under it, collapsed (Eliran 2026-11-08)
function renderBuild() {
  const approved = current.project.steps?.approve?.state === 'done';
  const job = current.job;
  const canStart = approved && (!job || job.state === 'failed');
  $('st-build-card').hidden = !canStart;
  $('st-flow-more').hidden = !job;
  if (canStart) {
    $('st-consent-text').textContent = current.consent?.he || '';
    $('st-build').disabled = !$('st-consent').checked;
    $('st-build').textContent = job?.state === 'failed' ? 'נסו לבנות שוב' : 'בנו את ההדמיה';
  }
  if (!job) return;
  $('st-job-log').innerHTML = (job.log || []).slice(-30).reverse().map((l) => `<li dir="auto">${esc(new Date(l.at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }))} · ${esc(l.line)}</li>`).join('');
  const fid = job.result?.fidelity || job.fidelity || null;
  const rooms = Array.isArray(fid?.rooms) ? fid.rooms : [];
  $('st-job-fid').innerHTML = rooms.length ? `<p class="st-small"><b>בדיקת התאמה לתכנית המכר, לפי חדר${fid.verdict ? `: ${esc(fid.verdict)}` : ''}</b></p><table class="st-spec-table st-check"><thead><tr><th>חדר</th><th>תוצאה</th><th>הערה</th></tr></thead><tbody>${rooms.map((r) => {
    const v = String(r.verdict || r.result || '').toUpperCase(); const ok = v === 'PASS' || r.ok === true;
    return `<tr class="${ok ? 'ok' : 'bad'}"><td>${fmt(r.room || r.name || r.scene)}</td><td>${ok ? '✓ תואם' : v === 'PENDING' ? '…' : '✗ לא תואם'}</td><td>${fmt(r.note)}</td></tr>`;
  }).join('')}</tbody></table>` : '';
  $('st-job-err').hidden = !job.error;
  $('st-job-err').textContent = job.error || '';
}

let traceShown = '';
async function renderTrace() {
  const job = current.job;
  const review = Boolean(job && ((job.state === 'review' && job.review?.stage === 'trace') || (job.needs?.type === 'trace_approval' && checkVerdict(job) !== 'PASS')));
  const need = job?.needs?.type === 'trace_approval' && checkVerdict(job) === 'PASS' ? job.needs : null;
  $('st-trace-card').hidden = !need && !review;
  $('st-trace-review').hidden = !review;
  for (const id of ['st-trace-lead', 'st-trace-img', 'st-trace-note', 'st-trace-ok', 'st-trace-fix']) $(id).hidden = !need;
  const check = job?.needs?.check || job?.check || null;
  $('st-trace-check').innerHTML = need && check ? `<p class="st-small"><b>הבדיקה האוטומטית: ${esc(check.summary || 'כל המידות תואמות לתכנית המכר')}</b></p>${checkTable(check)}` : '';
  if (!need) { traceShown = ''; return; }
  $('st-trace-note').textContent = need.note || '';
  const key = `${current.project.id}:${need.overlay}:${current.job.updated}`;
  if (traceShown === key) return;
  traceShown = key;
  $('st-trace-img').innerHTML = '<p class="st-muted st-small" style="padding:12px">טוען את השרטוט…</p>';
  try {
    const r = await fetch(`/api/studio-file?id=${encodeURIComponent(current.project.id)}&path=${encodeURIComponent(need.overlay)}`, { headers: { authorization: `Bearer ${await token()}` } });
    if (!r.ok) throw new Error(String(r.status));
    const url = URL.createObjectURL(await r.blob());
    $('st-trace-img').innerHTML = `<img alt="שרטוט הדירה מונח על תכנית המכר" src="${url}">`;
  } catch { $('st-trace-img').innerHTML = '<p class="st-muted st-small" style="padding:12px">לא הצלחתי לטעון את השרטוט.</p>'; }
}

$('st-consent').addEventListener('change', () => { $('st-build').disabled = !$('st-consent').checked; });
$('st-build').addEventListener('click', async () => {
  $('st-build').disabled = true;
  const r = await api('/api/studio-projects', { method: 'POST', body: JSON.stringify({ id: current.project.id, build: true, consent: $('st-consent').checked }) });
  await openProject(current.project.id, { quiet: true });   // success or refusal: the card and the agent's status line from a fresh read
  if (!r.ok && !jobActive(current.job)) { note(r.message || 'לא הצלחתי להתחיל את הבנייה'); $('st-build').disabled = !$('st-consent').checked; }
});
// the developer's own approval or correction: the page re-reads the project at once, success OR refusal. A refusal is usually a stale
// page (the trace was approved from another tab or device): the fresh read repaints the card and the agent's status line, and the
// server's words go to the panel only when the fresh state still asks for the developer (never «אין שרטוט שממתין לאישור» beside a card
// that says the opposite — Eliran 2026-11-08)
async function traceAction(body, failText) {
  const pid = current.project.id;
  const btn = $('st-trace-ok'); const send = $('st-trace-fix').querySelector('button[type="submit"]');
  btn.disabled = true; send.disabled = true;
  try {
    const r = await api('/api/studio-projects', { method: 'POST', body: JSON.stringify({ id: pid, ...body }) });
    if (r.ok && r.job && current?.project?.id === pid) { current.job = r.job; render(); }   // paint the server's answer before the re-read
    await openProject(pid, { quiet: true });
    if (!r.ok && current?.job?.needs?.type === 'trace_approval') note(r.message || failText);
    return r.ok;
  } finally { btn.disabled = false; send.disabled = false; }
}
$('st-trace-ok').addEventListener('click', () => traceAction({ approveTrace: true }, 'האישור נכשל'));
$('st-trace-fix').addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = $('st-trace-text').value.trim(); if (!text) return;
  if (await traceAction({ traceCorrection: text }, 'שליחת התיקון נכשלה')) $('st-trace-text').value = '';
});

// the agent panel's status line: jobStatus() — the card's own headline, word for word, plus where to act; never a chat reply
function renderAgentStatus() {
  const s = jobStatus();
  $('st-agent-status').dataset.status = s.key;
  $('st-agent-head').textContent = s.head;
  $('st-agent-hint').textContent = s.hint || '';
  $('st-agent-hint').hidden = !s.hint;
  const go = $('st-agent-go');
  const target = s.go && $(s.go.el);
  go.hidden = !target;
  if (target) { go.textContent = s.go.label; go.dataset.target = s.go.el; }
}
$('st-agent-go').addEventListener('click', () => scrollToTarget($('st-agent-go').dataset.target));

function renderChat(chat) {
  const msgs = chat.length ? chat : [{ role: 'note', content: 'שלום. העלו את תכנית המכר ואני אקרא אותה, אציג לכם את מה שקראתי לאישור, ואלווה אתכם עד הפרסום.' }];
  $('st-msgs').innerHTML = msgs.map((m) => `<div class="st-msg ${m.role === 'user' ? 'user' : m.role === 'note' ? 'note' : 'assistant'}" dir="auto">${esc(m.content)}</div>`).join('');
  $('st-msgs').scrollTop = $('st-msgs').scrollHeight;
}
function note(text) { const d = document.createElement('div'); d.className = 'st-msg note'; d.textContent = text; $('st-msgs').appendChild(d); $('st-msgs').scrollTop = $('st-msgs').scrollHeight; return d; }

/* ---------- uploads (+ the PDF page renders) ---------- */
const MAX_UPLOAD = 50 * 1048576;   // the storage's per-file limit (Supabase free plan); the server refuses larger files too
const TOO_BIG = 'הקובץ גדול מ-50MB. אפשר לפצל אותו לכמה קבצים או לשמור אותו באיכות נמוכה יותר.';
async function put(pathRel, body, onProgress) {
  const size = body.size || 0;
  if (size > MAX_UPLOAD) throw Object.assign(new Error('too_big'), { he: TOO_BIG });
  const type = body.type || 'application/octet-stream';
  const r = await api('/api/studio-upload', { method: 'POST', body: JSON.stringify({ id: current.project.id, rel: pathRel, size, type }) });
  if (!r.ok || !r.url) throw Object.assign(new Error(r.reason || 'upload'), { he: r.message || null });
  await new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open(r.method || 'PUT', r.url);
    for (const [k, v] of Object.entries(r.headers || {})) x.setRequestHeader(k, v);
    x.setRequestHeader('content-type', type);
    x.upload.onprogress = (e) => { if (onProgress && e.lengthComputable) onProgress({ percentage: (e.loaded / e.total) * 100 }); };
    x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(Object.assign(new Error(`upload ${x.status}`), { he: x.status === 413 ? TOO_BIG : null })));
    x.onerror = () => reject(new Error('network'));
    x.send(body);
  });
}

let pdfjs = null;
async function pdfLib() {
  if (pdfjs) return pdfjs;
  pdfjs = await import(`${PDFJS}pdf.min.mjs`);
  try {   // a module worker must be same-origin: a blob: wrapper imports the CDN worker (CORS); else pdf.js falls back to the main thread
    const w = URL.createObjectURL(new Blob([`import "${PDFJS}pdf.worker.min.mjs";`], { type: 'text/javascript' }));
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(w, { type: 'module' });
  } catch { pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS}pdf.worker.min.mjs`; }
  return pdfjs;
}
// a tile stays under TILE_CAP bytes (Eliran 2026-11-05: a 16-page brochure took minutes, tiles up to 685 KB): JPEG 0.82 first; if it is
// still too big, a lower quality at the SAME size (the small print keeps its pixels), and only then a smaller render (never under 160 dpi)
const TILE_CAP = 350 * 1024;
async function renderClip(page, scale, x, y, w, h, { cap = 0, minScale = 0 } = {}) {
  for (let sc = scale; ; sc *= 0.85) {
    const vp = page.getViewport({ scale: sc });
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * sc)); c.height = Math.max(1, Math.round(h * sc));
    await page.render({ canvas: c, viewport: vp, transform: [1, 0, 0, 1, -x * sc, -y * sc], background: '#ffffff' }).promise;
    let blob = null;
    for (const q of cap ? [0.82, 0.74, 0.66] : [0.82]) { blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', q)); if (!cap || blob.size <= cap) break; }
    c.width = 1; c.height = 1;
    if (!cap || blob.size <= cap || sc * 0.85 < minScale) return { blob, scale: sc };
  }
}
// a small pool: at most `n` uploads in flight while the next tile renders
function pool(n) {
  const running = new Set();
  return {
    async add(task) { while (running.size >= n) await Promise.race(running); const p = task().finally(() => running.delete(p)); running.add(p); return p; },
    async drain() { await Promise.all(running); },
  };
}
// the prepare progress (one bar, one plain line): pages and tiles counted only for what is actually made, the time left from the
// measured rate; the tab must stay open while it runs (beforeunload asks the visitor first)
function progressNote(note, title) {
  const el = note(''); el.innerHTML = `<div class="st-prep"><span class="st-prep-line"></span><div class="st-bar"><span></span></div><span class="st-prep-warn">אל תסגרו את הלשונית עד שההכנה מסתיימת.</span></div>`;
  const line = el.querySelector('.st-prep-line'), bar = el.querySelector('.st-bar > span');
  const guard = (e) => { e.preventDefault(); e.returnValue = ''; };
  window.addEventListener('beforeunload', guard);
  const t0 = performance.now();
  const left = (done, total) => {
    if (done < 2) return '';
    const s = ((performance.now() - t0) / 1000 / done) * (total - done);
    return s < 20 ? ' · כמעט מוכן' : s < 60 ? ' · עוד פחות מדקה' : s < 100 ? ' · עוד כדקה' : ` · עוד כ-${Math.round(s / 60)} דקות`;
  };
  return {
    el,
    set(page, pages, done, total) { line.textContent = `${title}: עמוד ${page} מתוך ${pages}${left(done, total)}`; bar.style.width = `${Math.round((done / Math.max(1, total)) * 100)}%`; },
    text(t) { line.textContent = t; },
    done() { window.removeEventListener('beforeunload', guard); el.remove(); },
  };
}
/* files/.pages/<name>/index.json = { pages: N, images: [{ file, kind:'overview'|'tile', page, row, col, dpi, region, side }] }.
   Overviews for every page (≤ 16, long side ≤ 1600 px) are made at upload; tiles (≤ 2000 px, ~250 dpi, ≤ 20 per page) only for the
   pages the survey marks as plans, at read time. The PDF bytes stay in memory for the session; otherwise they are fetched back. */
const pdfCache = new Map();
async function openPdf(blob) {
  const lib = await pdfLib();
  return lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
}
async function makeOverviews(doc, name, status) {
  const n = Math.min(doc.numPages, 16);
  const index = { pages: doc.numPages, images: [] };
  const q = pool(4); let done = 0;
  for (let pno = 1; pno <= n; pno++) {
    const page = await doc.getPage(pno);
    const { width: W, height: H } = page.getViewport({ scale: 1 });
    const os = Math.min(150 / 72, 1600 / Math.max(W, H));
    const { blob } = await renderClip(page, os, 0, 0, W, H);
    const file = `page-${pno}.jpg`;
    index.images.push({ file, kind: 'overview', page: pno, dpi: Math.round(os * 72) });
    await q.add(() => put(`.pages/${name}/${file}`, blob).then(() => { done += 1; status(done, n); }));
  }
  await q.drain();
  index.images.sort((a, b) => a.page - b.page);
  await put(`.pages/${name}/index.json`, new Blob([JSON.stringify(index)], { type: 'application/json' }));
  return index;
}
const TILE_MAX = 2000;
/** The tile layout of one page (no rendering): ~250 dpi, ≤ 20 tiles, ≤ 2000 px, 10 % overlap. */
async function tileLayout(doc, pno) {
  const page = await doc.getPage(pno);
  const { width: W, height: H } = page.getViewport({ scale: 1 });
  let dpi = 250; let cols; let rows;
  const fit = () => { const core = TILE_MAX / (dpi / 72) / 1.2; cols = Math.max(1, Math.ceil(W / core)); rows = Math.max(1, Math.ceil(H / core)); };
  fit(); while (cols * rows > 20 && dpi > 120) { dpi -= 25; fit(); }
  const tw = W / cols; const th = H / rows; const ox = tw * 0.1; const oy = th * 0.1; const tiles = [];
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const x0 = Math.max(0, j * tw - ox); const y0 = Math.max(0, i * th - oy);
    const x1 = Math.min(W, (j + 1) * tw + ox); const y1 = Math.min(H, (i + 1) * th + oy);
    let sc = dpi / 72; const side = Math.max(x1 - x0, y1 - y0) * sc; if (side > TILE_MAX) sc *= TILE_MAX / side;
    tiles.push({ i, j, rows, cols, x0, y0, x1, y1, sc });
  }
  return { page, pno, tiles };
}
/** Tiles of the given pages (the plan pages the survey found), rendered in turn and uploaded 4 at a time. `progress(page#, pages, done,
    total)` counts only what is actually made. */
async function makeTiles(doc, name, index, pageNos, progress) {
  const have = new Set(index.images.filter((im) => im.kind === 'tile').map((im) => im.page));
  const todo = [];
  for (const pno of pageNos.filter((x) => !have.has(x) && x >= 1 && x <= doc.numPages)) todo.push(await tileLayout(doc, pno));
  const total = todo.reduce((n, p) => n + p.tiles.length, 0); let done = 0;
  const q = pool(4);
  for (const [k, L] of todo.entries()) {
    for (const t of L.tiles) {
      const { blob, scale } = await renderClip(L.page, t.sc, t.x0, t.y0, t.x1 - t.x0, t.y1 - t.y0, { cap: TILE_CAP, minScale: 160 / 72 });
      const file = `page-${L.pno}-r${t.i + 1}c${t.j + 1}.jpg`;
      index.images.push({ file, kind: 'tile', page: L.pno, row: t.i + 1, col: t.j + 1, dpi: Math.round(scale * 72),
        region: t.i === 0 ? 'top' : t.i === t.rows - 1 ? 'bottom' : 'middle', side: t.j === 0 ? 'left' : t.j === t.cols - 1 ? 'right' : 'centre' });
      await q.add(() => put(`.pages/${name}/${file}`, blob).then(() => { done += 1; progress(k + 1, todo.length, done, total); }));
    }
  }
  await q.drain();
  if (todo.length) await put(`.pages/${name}/index.json`, new Blob([JSON.stringify(index)], { type: 'application/json' }));
  return index;
}
async function pdfBytes(name) {
  if (pdfCache.has(name)) return pdfCache.get(name);
  const r = await fetch(`/api/studio-file?id=${encodeURIComponent(current.project.id)}&path=${encodeURIComponent(`files/${name}`)}`, { headers: { authorization: `Bearer ${await token()}` } });
  if (!r.ok) throw new Error(`file ${r.status}`);
  const b = await r.blob(); pdfCache.set(name, b); return b;
}
async function pdfIndex(name) {
  const r = await fetch(`/api/studio-file?id=${encodeURIComponent(current.project.id)}&path=${encodeURIComponent(`files/.pages/${name}/index.json`)}`, { headers: { authorization: `Bearer ${await token()}` } });
  if (!r.ok) return null;
  const j = await r.json(); return Array.isArray(j) ? { pages: 1, images: j } : j;
}

async function uploadFiles(list) {
  if (!current) return;
  const pid = current.project.id;
  for (const file of list) {
    const name = safeName(file.name);
    const li = document.createElement('li'); li.className = 'up'; li.innerHTML = `<span>${esc(name)}</span><span>0%</span>`; $('st-files').appendChild(li);
    try {
      await put(name, file, (e) => { li.lastElementChild.textContent = `${Math.round(e.percentage)}%`; });
      li.lastElementChild.textContent = '✓';
      if (/\.pdf$/i.test(name)) {
        pdfCache.set(name, file);
        const idx = await makeOverviews(await openPdf(file), name, (d, n) => { li.lastElementChild.textContent = `עמודים ${d} מתוך ${n}`; });
        li.lastElementChild.textContent = `✓ · ${idx.images.length} עמודים`;
      }
    } catch (e) {
      li.lastElementChild.textContent = 'נכשל'; console.warn('upload', e);
      if (e?.he) note(e.he);
    }
  }
  await api('/api/studio-projects', { method: 'POST', body: JSON.stringify({ id: pid, filesChanged: true }) });   // the files index, once per batch
  openProject(pid);
}
$('st-file').addEventListener('change', (e) => { uploadFiles([...e.target.files]); e.target.value = ''; });
const drop = $('st-drop');
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); uploadFiles([...e.dataTransfer.files]); });

/** The read: overviews of every PDF page (made at upload, or now) → for a multi-page file the agent sorts the pages → tiles of the
    plan pages only → the reading. Each paid step is one call; the page shows which step runs. */
const READ_KINDS = new Set(['unit_plan', 'floor_plan', 'site_plan', 'price_list']);
async function prepareRead(status, prog) {
  const pdfs = current.files.filter((x) => /\.pdf$/i.test(x.name));
  const docs = new Map();
  for (const f of pdfs) {
    let idx = f.pages ? await pdfIndex(f.name) : null;
    if (!idx) { status(`מכין את עמודי ${f.name}…`); const doc = await openPdf(await pdfBytes(f.name)); docs.set(f.name, doc); idx = await makeOverviews(doc, f.name, (d, n) => prog ? prog.set(d, n, d, n) : status(`עמודי ${f.name}: ${d} מתוך ${n}`)); }
    f.index = idx;
  }
  const multi = pdfs.some((f) => (f.index?.pages || 1) > 1);
  let survey = null;
  if (multi) {
    status('הסוכן ממיין את העמודים: תכניות, הדמיות, טקסט…');
    const r = await api('/api/studio-agent', { method: 'POST', body: JSON.stringify({ id: current.project.id, op: 'survey' }) });
    if (!r.ok) throw new Error(r.message || 'survey');
    survey = r.survey;
  }
  for (const f of pdfs) {
    const want = survey ? survey.pages.filter((p) => p.file === f.name && READ_KINDS.has(p.kind)).map((p) => p.page) : [1];
    if (!want.length) continue;
    const doc = docs.get(f.name) || await openPdf(await pdfBytes(f.name));
    await makeTiles(doc, f.name, f.index, want.slice(0, 8), (pg, pgs, done, total) => (prog ? prog.set(pg, pgs, done, total) : status(`עמוד ${pg} מתוך ${pgs}`)));
  }
  return survey;
}

$('st-read').addEventListener('click', async () => {
  const btn = $('st-read'); btn.disabled = true;
  const prog = progressNote(note, 'מכין את עמודי התכנית לקריאה');
  prog.text('מכין את תכנית המכר לקריאה…');
  try { await prepareRead((t) => prog.text(t), prog); } catch (e) { console.warn('prepare', e); prog.done(); note(`ההכנה נכשלה: ${e.message || e}`); btn.disabled = false; return; }
  prog.done();
  const n = note('הסוכן קורא את תכנית המכר…');
  n.textContent = 'הסוכן קורא את תכנית המכר…';
  const r = await api('/api/studio-agent', { method: 'POST', body: JSON.stringify({ id: current.project.id, op: 'read' }) });
  n.remove();
  if (!r.ok) { note(r.message || 'הקריאה נכשלה'); btn.disabled = false; return; }
  openProject(current.project.id);
});
$('st-approve').addEventListener('click', async () => {
  const r = await api('/api/studio-projects', { method: 'POST', body: JSON.stringify({ id: current.project.id, approveSpec: true }) });
  if (r.ok) openProject(current.project.id);
});
$('st-ask').addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = $('st-q').value.trim(); if (!q || !current) return;
  $('st-q').value = '';
  const u = document.createElement('div'); u.className = 'st-msg user'; u.dir = 'auto'; u.textContent = q; $('st-msgs').appendChild(u);
  const n = note('הסוכן חושב…');
  const r = await api('/api/studio-agent', { method: 'POST', body: JSON.stringify({ id: current.project.id, op: 'chat', message: q }) });
  n.remove();
  if (!r.ok) { note(r.message || 'הסוכן לא ענה'); return; }
  current.chat = r.chat; current.spent = r.spent; renderChat(r.chat);
  $('st-spent').textContent = `עלות AI בפרויקט: $${Number(r.spent || 0).toFixed(2)}`;
});

boot().catch((e) => { bootDone = false; bootFail('watchdog', e); });
