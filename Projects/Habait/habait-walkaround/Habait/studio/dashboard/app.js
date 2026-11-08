/* Habait Studio dashboard — board platform-ui-ux cards 04, 06, 07 (2026-11-03).
 * Three visible steps + one review, on the shared design system:
 *   הפרויקטים שלי (#/) → פרויקט חדש (#/new, two fields) → project (#/p/<id>):
 *   1 העלאה · מה המערכת הבינה · 2 יצירה · 3 התוצאות (three deliverable cards) · הגדרות מתקדמות (collapsed).
 * UI only, on the EXISTING API of server.mjs: GET /api/env|styles|stages|projects|projects/<id>, POST /api/projects,
 * PATCH /api/projects/<id>, POST|DELETE …/files, POST …/run, POST …/approve-plan, SSE …/events. No new route.
 * A 405 from the API (the read-only fixture) turns on one honest banner; nothing ever fakes a success. */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const state = { projects: [], current: null, stages: [], styles: null, env: null, es: null, data: null, tab: 'morning', fixture: false, pending: [], view: null };

const FRIENDLY = {
  intake: 'קריאת המסמכים', site: 'איתור הבניין והסביבה', plan: 'בניית תכנית הדירה', shots: 'תכנון מסלול הצילום',
  scene: 'בניית הדירה בתלת-ממד', clay: 'צילום ריחוף וחדרים (טיוטה)', keyframes: 'בחירת הלוק לכל סצנה', video: 'הלבשה פוטוריאלית', assemble: 'הרכבת הסרטונים',
};
// stage status on disk → the five timeline states (and the words that always go with the colour)
const TL = { done: ['done', 'הושלם'], running: ['running', 'רץ'], 'needs-review': ['needs-you', 'צריך אותך'], blocked: ['failed', 'נתקע'], skipped: ['waiting', 'דולג'], idle: ['waiting', 'ממתין'] };
const HINTS = [
  [/no LLM backend|ANTHROPIC_API_KEY/, 'אין גישה ל-LLM: צריך Claude Code מותקן ומחובר למנוי (הפקודה claude), או מפתח ANTHROPIC_API_KEY בקובץ .env.'],
  [/spending is off|HABAIT_ALLOW_SPEND/, 'ההוצאה על מודלים כבויה. כדי להלביש פוטוריאליזם: HABAIT_ALLOW_SPEND=1 בקובץ .env (יש תקרה לפרויקט).'],
  [/no files uploaded/, 'העלו קודם את תכנית המכר.'],
  [/no location|set latlon/, 'הכתובת לא זוהתה: כתבו lat,lon בשדה הכתובת או בהגדרות המתקדמות.'],
  [/plan\.json missing|no traced plan/, 'אין עדיין תכנית וקטורית: המערכת צריכה plan.json (טרייסינג) או אישור של טיוטת ה-LLM בהגדרות המתקדמות.'],
  [/Blender not found/, 'Blender לא נמצא. בדקו את BLENDER בקובץ .env.'],
];
const ROLES = { 'sale-plan': 'תכנית מכר', render: 'הדמיה', facade: 'חזית', other: 'אחר' };
const ACCEPT = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'json', 'dxf', 'dwg'];
const MAX_BYTES = 200 * 1024 * 1024;

// ---------------------------------------------------------------- helpers
class ApiError extends Error { constructor(msg, status) { super(msg); this.status = status; } }
async function api(path, opts = {}) {
  const isForm = opts.body instanceof FormData;
  const r = await fetch(path, { ...opts, headers: opts.body && !isForm ? { 'Content-Type': 'application/json' } : {}, body: isForm ? opts.body : opts.body ? JSON.stringify(opts.body) : undefined });
  if (r.status === 405) setFixture();
  if (!r.ok) { let m = r.statusText; try { m = (await r.json()).error || m; } catch { /* */ } throw new ApiError(m, r.status); }
  return r.json();
}
function setFixture() { state.fixture = true; $('#fixture-banner').hidden = false; }
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
// platform-ui-ux card 04: every duration and cost shown goes through these two; a number inside Hebrew sits in <bdi dir="ltr">.
// fmtDuration: m:ss, h:mm:ss from one hour up, '—' for null/NaN/negative; whole seconds, rounded half-up.
function fmtDuration(sec) {
  const n = Number(sec);
  if (sec == null || sec === '' || !Number.isFinite(n) || n < 0) return '—';
  const t = Math.round(n), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), ss = String(t % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
// fmtCost: $0.00, rounded half-up on the decimal value (12.345 → $12.35, not the binary-float $12.34); '—' for null/NaN.
function fmtCost(usd) {
  const n = Number(usd);
  if (usd == null || usd === '' || !Number.isFinite(n)) return '—';
  return `$${(Math.round(Number(`${n.toFixed(10)}e2`)) / 100).toFixed(2)}`;
}
function fmtBytes(b) { const n = Number(b) || 0; return n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`; }
const bdi = (s) => `<bdi dir="ltr">${esc(s)}</bdi>`;
const costHtml = (usd) => bdi(fmtCost(usd));
const durHtml = (sec) => bdi(fmtDuration(sec));
function parseLatLon(s) { const m = String(s || '').match(/^\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*$/); return m ? { lat: Number(m[1]), lon: Number(m[3]) } : null; }
const extOf = (name) => (/\.([a-z0-9]+)$/i.exec(name || '') || [])[1]?.toLowerCase() || '';
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 4200); }

// ---------------------------------------------------------------- file roles (UI only; kept in the notes field)
// The API has no role per file yet, so the roles ride in project.notes on one machine line: "[roles] {json}".
const ROLE_LINE = /^\[roles\] (\{.*\})\s*$/m;
function rolesFromNotes(notes) { const m = ROLE_LINE.exec(notes || ''); try { return m ? JSON.parse(m[1]) : {}; } catch { return {}; } }
function notesWithoutRoles(notes) { return String(notes || '').replace(ROLE_LINE, '').replace(/\n+$/, ''); }
function notesWithRoles(text, roles) { const clean = notesWithoutRoles(text); return Object.keys(roles).length ? `${clean}${clean ? '\n' : ''}[roles] ${JSON.stringify(roles)}` : clean; }
function suggestRole(name, pages = null) {
  const ext = extOf(name), n = name.toLowerCase();
  if (ext === 'pdf') return /תכנית|תוכנית|מכר|דירה|plan|apt|sale/i.test(name) || (pages != null && pages <= 4) ? 'sale-plan' : 'other';
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return /חזית|facade|elevation|exterior|חוץ/i.test(n) ? 'facade' : 'render';
  if (['json', 'dxf', 'dwg'].includes(ext)) return /plan|תכנית/i.test(n) ? 'sale-plan' : 'other';
  return 'other';
}
async function pdfPages(file) {   // a light page count for the role hint: count "/Type /Page" objects in the first 8 MB
  try { const t = new TextDecoder('latin1').decode(await file.slice(0, 8 * 1048576).arrayBuffer()); const n = (t.match(/\/Type\s*\/Page(?!s)/g) || []).length; return n || null; } catch { return null; }
}

// ---------------------------------------------------------------- env
async function loadEnv() {
  const e = await api('/api/env');
  state.env = e;
  const rows = [
    ['קריאת מסמכים', esc(e.llm === 'ready' ? (e.llm_backend === 'cli' ? 'מוכן · המנוי שלך ב-Claude' : 'מוכן · API') : e.llm === 'mock' ? 'מצב דמו' : 'אין LLM'), e.llm === 'ready'],
    ['פוטוריאליזם', e.fal === 'ready' ? (e.allow_spend ? `מוכן · תקרה ${costHtml(e.cap_usd)}` : 'מוכן · הוצאה כבויה') : 'חסר מפתח fal', e.fal === 'ready' && e.allow_spend],
    ['תלת-ממד', String(e.blender).startsWith('not') ? 'Blender חסר' : 'מוכן', !String(e.blender).startsWith('not')],
  ];
  $('#envbar').innerHTML = `<ul class="envlist">${rows.map(([k, v, ok]) => `<li><span class="hb-chip ${ok ? 'hb-chip--available' : 'hb-chip--reserved'}">${ok ? 'מוכן' : 'חסר'}</span><b>${k}</b><span class="hb-small">${v}</span></li>`).join('')}</ul>`;
  const missing = rows.filter((r) => !r[2]).length;
  $('#env-summary').innerHTML = missing ? `מצב המערכת · <bdi>${missing}</bdi> חסרים` : 'מצב המערכת · מוכן';
}
async function loadStyles() {
  state.styles = await api('/api/styles');
  const opts = state.styles.presets.map((p) => `<option value="${esc(p.id)}">${esc(p.name_he)} · ${esc(p.name_en)}</option>`).join('');
  $('#v-morning').innerHTML = opts; $('#v-evening').innerHTML = opts;
  $('#v-morning').value = state.styles.variants.morning.preset; $('#v-evening').value = state.styles.variants.evening.preset;
}
async function loadStages() {
  state.stages = await api('/api/stages');
  $('#stage-picks').innerHTML = state.stages.map((s) => `<label class="check"><input type="checkbox" value="${esc(s.id)}" checked> ${esc(FRIENDLY[s.id] || s.title_he)}${s.paid ? ' <span class="hb-chip hb-chip--reserved">בתשלום</span>' : ''}</label>`).join('');
}

// ---------------------------------------------------------------- project status (one function, used by the cards and the header)
function projectStatus(st, running) {
  const rows = Object.values(st?.stages || {});
  if (running) return ['hb-chip--info', 'בעבודה'];
  if (rows.some((r) => r.status === 'blocked')) return ['hb-chip--sold', 'נתקע'];
  if (rows.some((r) => r.status === 'needs-review')) return ['hb-chip--reserved', 'צריך אותך'];
  const n = state.stages.length || 9;
  if (rows.filter((r) => ['done', 'skipped'].includes(r.status)).length >= n) return ['hb-chip--available', 'מוכן'];
  if (rows.length) return ['hb-chip--plain', 'בהכנה'];
  return ['hb-chip--plain', 'חדש'];
}
function coverOf(p) {   // the first keyframe still the pipeline wrote (an AI-made image → it carries the disclosure badge)
  const outs = p.state?.stages?.keyframes?.outputs || [];
  const img = outs.find((o) => /\.(png|jpe?g|webp)$/i.test(o));
  return img ? `/projects/${encodeURIComponent(p.id)}/${img.split('/').map(encodeURIComponent).join('/')}` : null;
}

// ---------------------------------------------------------------- view: הפרויקטים שלי
async function showProjects() {
  $('#projects-loading').hidden = false;
  state.projects = await api('/api/projects');
  $('#projects-loading').hidden = true;
  const grid = $('#project-grid');
  $('#projects-empty').hidden = state.projects.length > 0;
  $('#projects-new').hidden = !state.projects.length;
  grid.hidden = !state.projects.length;
  grid.innerHTML = state.projects.map((p) => {
    const [cls, label] = projectStatus(p.state, p.running);
    const cover = coverOf(p);
    const spent = p.state?.ledger_usd;
    return `<li><a class="hb-media-card pcard" href="#/p/${encodeURIComponent(p.id)}">
      <div class="hb-media-card__media" style="--media-ratio: 16 / 9">${cover ? `<img src="${cover}" alt="" loading="lazy"><span class="hb-media-card__badge hb-ai-badge">הדמיה · <bdi>AI-generated</bdi></span>` : `<div class="pcard__ph" aria-hidden="true">${esc((p.name || '?').trim().charAt(0))}</div>`}</div>
      <div class="hb-media-card__body">
        <p class="hb-media-card__title"><bdi>${esc(p.name)}</bdi></p>
        <p class="hb-media-card__meta">${esc([p.address, p.developer].filter(Boolean).join(' · ') || 'בלי כתובת עדיין')}</p>
        <div class="pcard__foot"><span class="hb-chip ${cls}">${label}</span><span class="hb-small">הוצאה עד כה ${spent != null ? costHtml(spent) : costHtml(0)}</span></div>
      </div></a></li>`;
  }).join('');
}

// ---------------------------------------------------------------- view: פרויקט חדש
$('#new-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target, msg = $('#new-msg');
  const body = Object.fromEntries(new FormData(f).entries());
  body.name = (body.name || '').trim();
  $('#name-err').hidden = Boolean(body.name); f.name.setAttribute('aria-invalid', body.name ? 'false' : 'true');
  if (!body.name) { f.name.focus(); return; }
  const ll = parseLatLon(body.address); if (ll) { body.latlon = ll; body.address = ''; }
  msg.hidden = true;
  try {
    const p = await api('/api/projects', { method: 'POST', body });
    f.reset(); location.hash = `#/p/${encodeURIComponent(p.id)}`;
  } catch (err) {
    msg.hidden = false;
    msg.textContent = err.status === 405 ? 'הפרויקט לא נוצר: השרת הזה במצב תצוגה (קריאה בלבד).' : `הפרויקט לא נוצר: ${err.message}`;
  }
});

// ---------------------------------------------------------------- view: project
async function showProject(id) {
  const first = state.current !== id;
  state.current = id;
  if (first) { state.pending = []; $('#adv').open = false; }
  await refresh();
  if (first) { connectEvents(id); loadAgent(); }
}
async function refresh() {
  const d = await api(`/api/projects/${encodeURIComponent(state.current)}`);
  state.data = d;
  $('#p-name').innerHTML = `<bdi>${esc(d.name)}</bdi>`;
  $('#p-sub').textContent = [d.developer, d.address || d.site?.origin?.display_name?.slice(0, 80)].filter(Boolean).join(' · ');
  const [cls, label] = projectStatus(d.state, d.running);
  $('#p-status').className = `hb-chip ${cls}`; $('#p-status').textContent = label;
  $('#p-ledger').innerHTML = `הוצאה עד כה ${costHtml(d.ledger_usd || 0)}`;
  if (document.activeElement !== $('#p-address')) $('#p-address').value = d.address || (d.latlon ? `${d.latlon.lat}, ${d.latlon.lon}` : '');
  if (document.activeElement !== $('#p-notes')) $('#p-notes').value = notesWithoutRoles(d.notes);
  $('#p-latlon').value = d.latlon ? `${d.latlon.lat}, ${d.latlon.lon}` : '';
  $('#p-panos').value = d.options?.panos_dir || '';
  $('#o-variants').value = (d.options?.variants || ['morning', 'evening']).join(',');
  const vs = d.options?.variant_styles || {};
  $('#v-morning').value = vs.morning || state.styles.variants.morning.preset; $('#v-evening').value = vs.evening || state.styles.variants.evening.preset;
  $('#o-res').value = d.options?.clay?.res || '640x360'; $('#o-samples').value = d.options?.clay?.samples || 16; $('#o-engine').value = d.options?.clay?.engine || 'CYCLES';
  $('#o-maxframes').value = d.options?.clay?.max_frames || 0; $('#o-vres').value = d.options?.video?.resolution || '720p'; $('#o-refine').checked = Boolean(d.options?.video?.detail_refine);
  renderFiles(d);
  renderReview(d);
  renderCreate(d);
  renderResults(d);
  renderStepnav(d);
}

// ---------------------------------------------------------------- 1 · upload
function fileIcon(name) { const e = extOf(name); return e ? e.toUpperCase().slice(0, 4) : 'DIR'; }
function roleSelect(key, role, label) {
  return `<select class="hb-chip-select" data-role-for="${esc(key)}" aria-label="התפקיד של ${esc(label)}" title="הצעה של המערכת; אפשר לשנות. נשמר בשדה ההערות עד שה-API יתמוך בתפקיד.">${Object.entries(ROLES).map(([k, v]) => `<option value="${k}"${k === role ? ' selected' : ''}>${v}</option>`).join('')}</select>`;
}
function renderFiles(d) {
  const roles = rolesFromNotes(d.notes);
  const server = d.files.map((f) => {
    const role = roles[f.name] || suggestRole(f.name);
    const isDir = !extOf(f.name);
    return `<li class="hb-file" data-state="done"><span class="hb-file__icon" aria-hidden="true">${fileIcon(f.name)}</span>
      <span class="hb-file__name">${isDir ? `<bdi>${esc(f.name)}</bdi>` : `<a href="/projects/${encodeURIComponent(d.id)}/intake/${encodeURIComponent(f.name)}" target="_blank" rel="noopener"><bdi>${esc(f.name)}</bdi></a>`}</span>
      ${roleSelect(f.name, role, f.name)}
      <button class="hb-file__remove" type="button" data-remove="${esc(f.name)}" aria-label="הסרת ${esc(f.name)}">×</button>
      <span class="hb-file__meta">${isDir ? 'תיקייה' : bdi(fmtBytes(f.bytes))} · הועלה${roles[f.name] ? '' : ' · תפקיד מוצע'}</span></li>`;
  });
  const pending = state.pending.map((p) => `<li class="hb-file" data-state="${p.status}" data-pending="${p.id}"><span class="hb-file__icon" aria-hidden="true">${fileIcon(p.name)}</span>
      <span class="hb-file__name"><bdi>${esc(p.name)}</bdi></span>
      ${p.status === 'error' ? '<span></span>' : roleSelect(`pending:${p.id}`, p.role, p.name)}
      <button class="hb-file__remove" type="button" data-cancel="${p.id}" aria-label="${p.status === 'uploading' ? 'ביטול ההעלאה של' : 'הסרת'} ${esc(p.name)}">×</button>
      ${p.status === 'uploading' ? `<span class="hb-file__progress" role="progressbar" aria-label="העלאה" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(p.progress)}" style="--p:${p.progress.toFixed(0)}%"><span></span></span>` : ''}
      <span class="hb-file__meta">${bdi(fmtBytes(p.size))} · ${p.status === 'uploading' ? 'מעלה…' : esc(p.msg || '')}${p.retry ? ' <button class="hb-btn hb-btn--ghost hb-btn--sm" type="button" data-retry="' + p.id + '">לנסות שוב</button>' : ''}</span></li>`);
  $('#file-list').innerHTML = server.concat(pending).join('') || '<li class="hb-small files-empty">עוד לא הועלו קבצים. מתחילים בתכנית המכר.</li>';
}
$('#file-list').addEventListener('change', async (e) => {
  const sel = e.target.closest('[data-role-for]'); if (!sel) return;
  const key = sel.dataset.roleFor;
  if (key.startsWith('pending:')) { const p = state.pending.find((x) => `pending:${x.id}` === key); if (p) p.role = sel.value; return; }
  const roles = { ...rolesFromNotes(state.data.notes), [key]: sel.value };
  try { await api(`/api/projects/${encodeURIComponent(state.current)}`, { method: 'PATCH', body: { notes: notesWithRoles($('#p-notes').value, roles) } }); toast('התפקיד נשמר.'); refresh(); }
  catch (err) { toast(err.status === 405 ? 'לא נשמר: מצב תצוגה.' : `לא נשמר: ${err.message}`); }
});
$('#file-list').addEventListener('click', async (e) => {
  const rm = e.target.closest('[data-remove]'), cancel = e.target.closest('[data-cancel]'), retry = e.target.closest('[data-retry]');
  if (rm) {
    if (!confirm(`להסיר את ${rm.dataset.remove}?`)) return;
    try { await api(`/api/projects/${encodeURIComponent(state.current)}/files/${encodeURIComponent(rm.dataset.remove)}`, { method: 'DELETE' }); refresh(); }
    catch (err) { toast(err.status === 405 ? 'הקובץ לא הוסר: מצב תצוגה.' : `הקובץ לא הוסר: ${err.message}`); }
  }
  if (cancel) { const p = state.pending.find((x) => String(x.id) === cancel.dataset.cancel); if (p?.xhr) p.xhr.abort(); state.pending = state.pending.filter((x) => x !== p); renderFiles(state.data); }
  if (retry) { const p = state.pending.find((x) => String(x.id) === retry.dataset.retry); if (p) uploadOne(p); }
});
let pendingSeq = 0;
async function addFiles(list) {
  if (!state.current) return;
  for (const file of list) {
    const ext = extOf(file.name);
    const p = { id: ++pendingSeq, file, name: file.name, size: file.size, progress: 0, status: 'uploading', role: suggestRole(file.name), msg: '', retry: false };
    if (!ACCEPT.includes(ext)) { Object.assign(p, { status: 'error', msg: `סוג קובץ שלא נתמך${ext ? `: ${ext.toUpperCase()}` : ''}. אפשר להעלות PDF, תמונה (JPG, PNG, WEBP) או תכנית (JSON, DXF, DWG).` }); }
    else if (file.size > MAX_BYTES) { Object.assign(p, { status: 'error', msg: `הקובץ גדול מ-${fmtBytes(MAX_BYTES)}.` }); }
    else if (file.size === 0) { Object.assign(p, { status: 'error', msg: 'הקובץ ריק.' }); }
    state.pending.push(p);
    if (p.status === 'uploading') { if (ext === 'pdf') p.role = suggestRole(file.name, await pdfPages(file)); uploadOne(p); }
  }
  renderFiles(state.data);
}
function uploadOne(p) {
  Object.assign(p, { status: 'uploading', progress: 0, msg: '', retry: false });
  const fd = new FormData(); fd.append('files', p.file, p.name);
  const xhr = new XMLHttpRequest(); p.xhr = xhr;
  xhr.open('POST', `/api/projects/${encodeURIComponent(state.current)}/files`);
  xhr.upload.onprogress = (e) => { if (e.lengthComputable) { p.progress = (e.loaded / e.total) * 100; const bar = $(`[data-pending="${p.id}"] .hb-file__progress`); if (bar) { bar.style.setProperty('--p', `${p.progress.toFixed(0)}%`); bar.setAttribute('aria-valuenow', Math.round(p.progress)); } } };
  xhr.onload = async () => {
    if (xhr.status === 405) { setFixture(); Object.assign(p, { status: 'error', msg: 'לא נשמר: השרת הזה במצב תצוגה (קריאה בלבד).' }); return renderFiles(state.data); }
    if (xhr.status < 200 || xhr.status >= 300) { let m = xhr.statusText; try { m = JSON.parse(xhr.responseText).error || m; } catch { /* */ } Object.assign(p, { status: 'error', msg: `ההעלאה נכשלה: ${m}`, retry: true }); return renderFiles(state.data); }
    state.pending = state.pending.filter((x) => x !== p);
    let saved = p.name; try { saved = JSON.parse(xhr.responseText).saved?.[0]?.name || p.name; } catch { /* */ }
    const roles = { ...rolesFromNotes(state.data.notes), [saved]: p.role };
    try { await api(`/api/projects/${encodeURIComponent(state.current)}`, { method: 'PATCH', body: { notes: notesWithRoles($('#p-notes').value, roles) } }); } catch { /* the file is saved; the role stays a suggestion */ }
    refresh();
  };
  xhr.onerror = () => { Object.assign(p, { status: 'error', msg: 'ההעלאה נקטעה (רשת).', retry: true }); renderFiles(state.data); };
  xhr.send(fd);
  renderFiles(state.data);
}
const drop = $('#drop'), fileInput = $('#file-input');
drop.addEventListener('click', () => fileInput.click());
drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.dataset.over = 'true'; });
drop.addEventListener('dragleave', () => { drop.dataset.over = 'false'; });
drop.addEventListener('drop', (e) => { e.preventDefault(); drop.dataset.over = 'false'; addFiles([...e.dataTransfer.files]); });
fileInput.addEventListener('change', () => { addFiles([...fileInput.files]); fileInput.value = ''; });
$('#btn-save-basic').addEventListener('click', async () => {
  try { await saveMeta(); toast('נשמר.'); refresh(); } catch (err) { toast(err.status === 405 ? 'לא נשמר: מצב תצוגה.' : `לא נשמר: ${err.message}`); }
});

// ---------------------------------------------------------------- review: "מה המערכת הבינה"
// Each entry of intake.uncertainties is flagged on the ONE field it names (first rule that matches); nothing else is flagged.
const UNCERTAIN_FIELD = [
  [/floors? (in|of) the building|number of floors/i, 'floors'],
  [/floor-to-floor|ceiling height/i, 'floor_height'],
  [/street address|\baddress\b/i, 'address'],
  [/\bnorth\b/i, 'north'],
  [/site key|tower-|\bR2\b/i, 'building'],
  [/protrud|public domain|area table/i, 'other_areas'],
  [/room areas|bathroom|bedroom|kitchen|\broom|מעבר|railing|dimension/i, 'rooms'],
];
function fieldOf(u) { return (UNCERTAIN_FIELD.find(([re]) => re.test(u)) || [null, 'other'])[1]; }
function renderReview(d) {
  const it = d.intake, box = $('#review');
  if (!it) {
    box.innerHTML = `<div class="hb-empty"><p class="hb-empty__title">המערכת עוד לא קראה את הקבצים</p><p class="hb-empty__text">הקריאה היא השלב הראשון של היצירה. אחריה מופיעים כאן החדרים, השטחים והקומות שהיא הבינה, ורק מה שלא ודאי מסומן לבדיקה.</p></div>`;
    return;
  }
  const unc = Array.isArray(it.uncertainties) ? it.uncertainties : [];
  const byField = {};
  for (const u of unc) (byField[fieldOf(u)] ||= []).push(u);
  const b = it.building || {}, u = it.unit || {}, dr = it.drawing || {};
  const num = (v, suffix = '') => (v == null || v === '' ? '<span class="muted-dash">לא נקרא</span>' : `<bdi>${esc(v)}</bdi>${suffix}`);
  const rows = [
    ['project', 'יזם · פרויקט', `${esc(it.developer || '—')} · ${esc(it.project_name || '—')}${it.city ? ` · ${esc(it.city)}` : ''}`],
    ['address', 'כתובת', it.address ? esc(it.address) : '<span class="muted-dash">לא נקרא</span>'],
    ['building', 'בניין', `${esc(b.name || '—')}${b.site_buildings?.length ? ` <span class="hb-small">· במפת האתר: <bdi>${esc(b.site_buildings.join(', '))}</bdi></span>` : ''}`],
    ['floors', 'קומה', `${num(b.floor_of_unit)} מתוך ${num(b.floors_total)}`],
    ['floor_height', 'גובה קומה', b.typical_floor_to_floor_cm ? `${num(b.typical_floor_to_floor_cm)} ס"מ` : '<span class="muted-dash">לא נקרא</span>'],
    ['unit', 'דירה', `${num(u.number)}${u.type_mark ? ` · דגם <bdi>${esc(u.type_mark)}</bdi>` : ''} · ${num(u.rooms_count)} חדרים`],
    ['area', 'שטח', `${num(u.area_m2)} מ"ר · מרפסת ${num(u.terrace_m2)} מ"ר`],
    ['other_areas', 'שטחים נוספים', (u.other_areas || []).map((a) => `${esc(a.label)} <bdi>${esc(a.m2)}</bdi> מ"ר`).join(' · ') || '—'],
    ['north', 'כיוון צפון', dr.north_deg_clockwise_from_up != null ? `<bdi>${esc(dr.north_deg_clockwise_from_up)}°</bdi> <span class="hb-small">בכיוון השעון מראש התכנית</span>` : dr.north_deg != null ? `<bdi>${esc(dr.north_deg)}°</bdi>` : dr.north_arrow_deg != null ? `<bdi>${esc(dr.north_arrow_deg)}°</bdi>` : (dr.north ? esc(typeof dr.north === 'object' ? JSON.stringify(dr.north) : dr.north) : '<span class="muted-dash">לא נקרא</span>')],
    ['rooms', 'חדרים', `<ul class="roomlist">${(it.rooms || []).map((r) => `<li>${esc(r.name_he)}${r.printed_dims_cm ? ` <bdi dir="ltr">${esc(r.printed_dims_cm.join('×'))}</bdi>` : ''}${r.area_m2 ? ` · <bdi>${esc(r.area_m2)}</bdi> מ"ר` : ''}</li>`).join('')}</ul>`],
    ['images', 'קבצים שנקראו', (() => { const names = [...new Set((it.images || []).map((im) => String(im.file).split(/[\\/]/).pop()))]; return names.length ? `<bdi>${names.length}</bdi> קבצים: ${names.slice(0, 4).map((n) => `<bdi>${esc(n)}</bdi>`).join(' · ')}${names.length > 4 ? ` ועוד <bdi>${names.length - 4}</bdi>` : ''}` : '—'; })()],
  ];
  if (d.site) rows.push(['site', 'מיקום', `${esc(d.site.origin?.display_name || '')} · <bdi>${esc(d.site.buildings)}</bdi> בניינים שכנים ממפת OSM`]);
  rows.push(['source', 'מקור הקריאה', it._meta?.source === 'llm' ? (it._meta.backend === 'cli' ? `Claude דרך המנוי שלך (<bdi>${esc(it._meta.model)}</bdi>)` : `<bdi>${esc(it._meta.model)}</bdi> · ${costHtml(it._meta.usd || 0)}`) : 'נתוני דמו (ללא LLM)']);
  if (byField.other) rows.push(['other', 'פרטים בתכנית שלא נקלטו', '<span class="muted-dash">ראו את ההערה</span>']);
  const conf = Number(it.confidence);
  const draft = d.derived.includes('plan.draft.json') && !d.derived.includes('plan.json');
  box.innerHTML = `
    <div class="review__head">
      <p class="review__conf">רמת הביטחון של הקריאה: <b>${Number.isFinite(conf) ? bdi(conf.toFixed(2)) : '—'}</b></p>
      <p class="hb-small">${unc.length ? `<bdi>${unc.length}</bdi> פרטים לא ודאיים מסומנים <span class="hb-chip hb-chip--reserved">לא ודאי</span> על השדה שלהם. כל השאר נקרא בלי הסתייגות.` : 'אין פרטים לא ודאיים.'}</p>
    </div>
    <dl class="review__list">${rows.map(([key, label, value]) => `
      <div class="review__row${byField[key] ? ' is-flagged' : ''}" data-field="${key}">
        <dt>${label}</dt><dd>${value}${byField[key] ? `<ul class="flags">${byField[key].map((x) => `<li class="flag"><span class="hb-chip hb-chip--reserved">לא ודאי</span> <span class="flag__text" dir="ltr" lang="en">${esc(x)}</span></li>`).join('')}</ul>` : ''}</dd>
      </div>`).join('')}</dl>
    <div class="form__actions">
      <button class="hb-btn hb-btn--secondary" type="button" id="btn-review-ok">${draft ? 'אישור התכנית והמשך ליצירה' : 'אישור והמשך ליצירה'}</button>
      <button class="hb-btn hb-btn--ghost" type="button" id="btn-review-fix">תיקון בהערות</button>
    </div>
    <p class="hb-small">${draft ? 'האישור הופך את טיוטת התכנית של ה-LLM ל-plan.json, הגאומטריה שתיבנה.' : 'התכנית הווקטורית (plan.json) כבר קיימת, כך שאין מה לשלוח לשרת: האישור כאן רק מעביר ליצירה. תיקון כותבים בהערות למערכת.'}</p>`;
  $('#btn-review-ok').addEventListener('click', async () => {
    if (draft) {
      if (!confirm('לאשר את טיוטת ה-LLM כ-plan.json? זו הגאומטריה שתיבנה.')) return;
      try { await api(`/api/projects/${encodeURIComponent(state.current)}/approve-plan`, { method: 'POST' }); await refresh(); }
      catch (err) { toast(err.status === 405 ? 'לא אושר: מצב תצוגה.' : `לא אושר: ${err.message}`); return; }
    }
    goSection('s-create', '#btn-create');
  });
  $('#btn-review-fix').addEventListener('click', () => goSection('s-upload', '#p-notes'));
}

// ---------------------------------------------------------------- 2 · create
function estimate(d) {
  const n = (d.shots?.length || 14), variants = (d.options?.variants || ['morning', 'evening']).length;
  const perClip = d.options?.video?.resolution === '1080p' ? 0.6 : d.options?.video?.resolution === '480p' ? 0.12 : 0.27;
  return { usd: n * variants * perClip * (d.options?.video?.detail_refine ? 4 : 1) + (state.env?.llm === 'ready' ? 1.5 : 0), n, variants };
}
// a raw pipeline note shows its numbers formatted: "71.91666666666666s" → "1:12", any other long float → two decimals
function cleanNote(t) { return String(t).replace(/(\d+\.\d{3,})\s?s\b/g, (m, n) => fmtDuration(n)).replace(/\d+\.\d{3,}/g, (n) => Number(n).toFixed(2)); }
function stageRows(st) { return state.stages.map((s) => ({ ...s, ...(st?.stages?.[s.id] || { status: 'idle' }) })); }
function renderCreate(d) {
  const est = estimate(d);
  $('#create-cost').innerHTML = `· כ-${costHtml(est.usd)}`;
  $('#btn-create').disabled = d.running || !d.files.length;
  $('#create-hint').innerHTML = !d.files.length ? 'העלו קודם את תכנית המכר.' : d.running ? 'בעבודה…' : `הערכת עלות למודלים: <bdi>${est.variants}</bdi> גרסאות × <bdi>${est.n}</bdi> סצנות${state.env?.allow_spend ? '' : ' · ההוצאה כבויה, תופק טיוטה (clay) בלבד'}`;
  renderTimeline(d.state, d.running);
}
function renderTimeline(st, running) {
  const rows = stageRows(st);
  $('#timeline').innerHTML = rows.map((r, i) => {
    const [s, word] = TL[r.status] || ['waiting', r.status];
    const hint = (s === 'failed' || s === 'needs-you') ? (HINTS.find(([re]) => re.test(r.note || ''))?.[1] || r.note || '') : '';
    const mark = s === 'done' ? '✓' : s === 'failed' ? '×' : s === 'needs-you' ? '!' : s === 'running' ? '' : `<bdi>${i + 1}</bdi>`;
    return `<li class="hb-step" data-state="${s}" data-stage="${esc(r.id)}"><span class="hb-step__mark" aria-hidden="true">${mark}</span>
      <p class="hb-step__label">${esc(FRIENDLY[r.id] || r.title_he)}</p>
      <span class="hb-step__state">${word}${r.seconds ? ` · ${durHtml(r.seconds)}` : ''}</span>${hint ? `<p class="hb-step__note">${((hint.match(/[\u0590-\u05FF]/g) || []).length > (hint.match(/[A-Za-z]/g) || []).length) ? esc(hint) : `הערת המערכת: <bdi dir="ltr">${esc(cleanNote(hint))}</bdi>`}</p>` : ''}</li>`;
  }).join('');
  const blocked = rows.find((r) => r.status === 'blocked');
  const skipped = rows.find((r) => r.status === 'skipped' && r.id === 'video');
  const b = $('#blocker');
  if (blocked) { const hint = HINTS.find(([re]) => re.test(blocked.note || ''))?.[1]; b.className = 'banner banner--bad'; b.hidden = false; b.innerHTML = `<b>נתקע בשלב "${esc(FRIENDLY[blocked.id])}".</b> ${esc(hint || blocked.note)}`; }
  else if (skipped && !running) { b.className = 'banner banner--warn'; b.hidden = false; b.innerHTML = `<b>הופקה טיוטה (clay) בלבד.</b> ${esc(HINTS[1][1])}`; }
  else b.hidden = true;
  // advanced: every stage with its raw note and time
  $('#stages').innerHTML = `<table class="stagetable"><thead><tr><th>#</th><th>שלב</th><th>מצב</th><th>זמן</th><th>הערה</th></tr></thead><tbody>${rows.map((s, i) => `<tr><td><bdi>${i + 1}</bdi>${s.paid ? ' · <span title="שלב בתשלום">$</span>' : ''}</td><td>${esc(s.title_he)}</td><td>${(TL[s.status] || [0, s.status])[1]}</td><td>${s.seconds ? durHtml(s.seconds) : '—'}</td><td class="stagetable__note"><span dir="auto">${esc(cleanNote(s.note || ''))}</span></td></tr>`).join('')}</tbody></table>`;
  $('#btn-approve-plan').hidden = !(state.data?.derived?.includes('plan.draft.json') && !state.data?.derived?.includes('plan.json'));
}

// ---------------------------------------------------------------- 3 · results: three deliverables, in the order of the vision
function resultCard({ key, title, stateName, chip, media, text, extra = '' }) {
  const chips = { empty: ['hb-chip--plain', 'ריק'], progress: ['hb-chip--info', 'בעבודה'], ready: ['hb-chip--available', 'מוכן'], draft: ['hb-chip--reserved', 'טיוטה'] };
  const [cls, word] = chips[stateName];
  return `<article class="hb-result" data-state="${stateName}" data-deliverable="${key}">
    <div class="hb-result__media">${media || ''}</div>
    <div class="hb-result__body"><div class="hb-result__head"><h3 class="hb-result__title">${title}</h3><span class="hb-chip ${cls}">${chip || word}</span></div>
    <p class="hb-result__text">${text}</p>${extra}</div></article>`;
}
function renderResults(d) {
  const out = d.outputs, rows = stageRows(d.state);
  const running = (ids) => d.running && rows.some((r) => ids.includes(r.id) && r.status === 'running');
  const variants = out ? (out.variants || [{ id: 'single', name_he: 'תוצאה', clips: out.clips, master: out.master, photoreal: out.photoreal }]) : [];
  if (variants.length && !variants.find((v) => v.id === state.tab)) state.tab = variants[0].id;
  const v = variants.find((x) => x.id === state.tab);
  const src = (f) => `/projects/${encodeURIComponent(d.id)}/${String(f).split('/').map(encodeURIComponent).join('/')}`;
  const badge = '<span class="hb-media-card__badge hb-ai-badge">הדמיה · <bdi>AI-generated</bdi></span>';
  const sumDur = (cs) => cs.reduce((s, c) => s + (Number(c.duration_s) || 0), 0);
  // (a) the exterior video: the exterior clips this chain renders (approach, facade, entry)
  const ext = v ? v.clips.filter((c) => c.kind === 'exterior') : [];
  const a = ext.length
    ? resultCard({ key: 'exterior', title: 'סרטון החוץ', stateName: ext.every((c) => c.source === 'photoreal') ? 'ready' : 'draft', media: `<video src="${src(ext[0].file)}#t=0.5" controls preload="metadata" muted playsinline aria-label="${esc(ext[0].label)}"></video>${badge}`, text: `<bdi>${ext.filter((c) => c.source === 'photoreal').length}/${ext.length}</bdi> קטעי חוץ פוטוריאליים${ext.some((c) => c.source !== 'photoreal') ? ' · השאר טיוטה (clay)' : ''} · ${durHtml(sumDur(ext))}`, extra: `<ul class="cliplist cliplist--flat">${ext.map((c) => `<li><a href="${src(c.file)}" target="_blank" rel="noopener">${esc(c.label)}</a> <span class="hb-small">${c.source === 'photoreal' ? 'פוטוריאלי' : 'טיוטה'} · ${durHtml(c.duration_s)}</span></li>`).join('')}</ul>` })
    : resultCard({ key: 'exterior', title: 'סרטון החוץ', stateName: running(['clay', 'video', 'assemble']) ? 'progress' : 'empty', media: running(['clay', 'video', 'assemble']) ? '' : 'עוד לא הופק', text: running(['clay', 'video', 'assemble']) ? 'הקטעים מבחוץ בהכנה.' : 'יופיע כאן אחרי היצירה.' });
  // (b) the building with clickable apartments: not produced by this Studio chain — said, not hidden
  const b = resultCard({ key: 'building', title: 'הבניין עם הדירות', stateName: 'empty', chip: 'לא בשרשרת', media: 'עוד לא בשרשרת הזו', text: 'עוד לא בשרשרת הזו: הסטודיו עדיין לא מפיק את הבניין עם הדירות הלחיצות.' });
  // (c) the apartment visualization: the master per variant + the per-room clips, collapsed
  let c;
  if (v && (v.master || v.clips.length)) {
    const rooms = v.clips.filter((x) => x.kind !== 'exterior');
    const tabs = variants.length > 1 ? `<div class="vtabs" role="tablist" aria-label="גרסה">${variants.map((x) => `<button class="vtab" role="tab" type="button" data-v="${esc(x.id)}" aria-selected="${x.id === state.tab}">${esc(x.name_he)}</button>`).join('')}</div>` : '';
    c = resultCard({ key: 'apartment', title: `ההדמיה של הדירה · ${esc(v.name_he)}`, stateName: (v.photoreal ?? 0) >= v.clips.length ? 'ready' : 'draft',
      media: v.master ? `<video src="${src(v.master)}#t=0.5" controls preload="metadata" playsinline aria-label="הסרטון המלא"></video>${badge}` : '',
      text: `<bdi>${v.photoreal ?? 0}/${v.clips.length}</bdi> סצנות פוטוריאליות${(v.photoreal ?? 0) < v.clips.length ? ' · השאר טיוטה' : ''} · ${durHtml(sumDur(v.clips))}${v.master ? ` · <a class="hb-link" href="${src(v.master)}?dl=1">הורדת הסרטון המלא</a>` : ''}`,
      extra: `${tabs}<details class="cliplist-wrap"><summary>הקליפים לפי חדר (<bdi>${rooms.length}</bdi>)</summary><ul class="cliplist">${rooms.map((x) => `<li><a href="${src(x.file)}" target="_blank" rel="noopener">${esc(x.label)}</a><span class="hb-small">${x.source === 'photoreal' ? 'פוטוריאלי' : 'טיוטה'} · ${durHtml(x.duration_s)}</span></li>`).join('')}</ul></details>` });
  } else {
    const prog = running(['keyframes', 'video', 'assemble', 'clay']);
    c = resultCard({ key: 'apartment', title: 'ההדמיה של הדירה', stateName: prog ? 'progress' : 'empty', media: prog ? '' : 'עוד לא הופקה', text: prog ? 'הסרטון והקליפים לפי חדר בהכנה.' : 'יופיע כאן אחרי היצירה: סרטון מלא וקליפ לכל חדר.' });
  }
  $('#results').innerHTML = a + b + c;
  $$('.vtab', $('#results')).forEach((t) => t.addEventListener('click', () => { state.tab = t.dataset.v; renderResults(state.data); $(`.vtab[data-v="${state.tab}"]`)?.focus(); }));
}

// ---------------------------------------------------------------- step nav (state words, never a percentage)
function renderStepnav(d) {
  const rows = stageRows(d.state);
  const done = rows.filter((r) => ['done', 'skipped'].includes(r.status)).length;
  const intakeRow = rows.find((r) => r.id === 'intake');
  $('[data-sub="upload"]').innerHTML = d.files.length ? `<bdi>${d.files.length}</bdi> קבצים` : 'עוד אין קבצים';
  $$('[data-step="review"] .stepnav__n, #h-review .step-sec__n').forEach((n) => { n.textContent = !d.intake ? '·' : (d.intake.uncertainties?.length ? '!' : '✓'); });
  $('[data-sub="review"]').textContent = d.intake ? `${d.intake.uncertainties?.length || 0} לבדיקה` : intakeRow?.status === 'running' ? 'קורא…' : 'עוד לא נקרא';
  $('[data-sub="create"]').innerHTML = d.running ? 'בעבודה' : done ? `<bdi>${done}</bdi> מתוך <bdi>${rows.length}</bdi> שלבים` : 'עוד לא התחיל';
  const ready = $$('.hb-result[data-state="ready"]', $('#results')).length;
  $('[data-sub="results"]').innerHTML = `<bdi>${ready}</bdi> מתוך <bdi>3</bdi> מוכנים`;
}
function goSection(id, focusSel) {
  const sec = document.getElementById(id); if (!sec) return;
  sec.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  const f = focusSel ? $(focusSel) : sec.querySelector('h2');
  if (f) { if (!f.hasAttribute('tabindex') && !/^(BUTTON|INPUT|SELECT|A|TEXTAREA)$/.test(f.tagName)) f.setAttribute('tabindex', '-1'); f.focus({ preventScroll: true }); }
}
$$('.stepnav a').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); goSection(a.getAttribute('href').slice(1)); }));

// ---------------------------------------------------------------- the developer's agent (plan studio-agent-fal)
// the model may answer in light Markdown: escape first, then **bold** and "- " list lines only (nothing else is interpreted)
function mdLite(text) {
  const lines = esc(text).split('\n');
  let html = '', inList = false;
  for (const raw of lines) {
    const line = raw.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    const li = /^\s*[-•]\s+(.*)$/.exec(line);
    if (li) { if (!inList) { html += '<ul class="agent__ul">'; inList = true; } html += `<li>${li[1]}</li>`; continue; }
    if (inList) { html += '</ul>'; inList = false; }
    html += line.trim() ? `<p class="agent__p">${line}</p>` : '';
  }
  return html + (inList ? '</ul>' : '');
}
function renderAgent(messages) {
  const log = $('#agent-log');
  log.innerHTML = (messages || []).map((m) => `<li class="agent__msg agent__msg--${m.role === 'user' ? 'user' : 'bot'}"><span class="agent__who">${m.role === 'user' ? 'אתם' : 'הסוכן'}</span><div class="agent__text" dir="auto">${m.role === 'user' ? esc(m.content).replace(/\n/g, '<br>') : mdLite(m.content)}</div>${m.role !== 'user' && m.usd ? `<span class="hb-small agent__cost">${costHtml(m.usd)}</span>` : ''}</li>`).join('')
    || '<li class="hb-small agent__empty">עוד לא נשאלה שאלה. אפשר לשאול על החדרים, השטחים, הקבצים או מה עוד חסר.</li>';
  log.scrollTop = log.scrollHeight;
}
async function loadAgent() {
  try { renderAgent((await api(`/api/projects/${encodeURIComponent(state.current)}/chat`)).messages); } catch { renderAgent([]); }
}
$('#agent-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = $('#agent-input'), btn = $('#agent-send'), err = $('#agent-err');
  const message = input.value.trim(); if (!message) return;
  btn.disabled = true; btn.textContent = 'הסוכן חושב…'; err.hidden = true;
  const pending = [...$$('#agent-log .agent__msg')].length;
  $('#agent-log').insertAdjacentHTML('beforeend', `<li class="agent__msg agent__msg--user agent__msg--pending"><span class="agent__who">אתם</span><div class="agent__text" dir="auto">${esc(message)}</div></li>`);
  try {
    const r = await fetch(`/api/projects/${encodeURIComponent(state.current)}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) });
    if (r.status === 405) setFixture();
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { err.hidden = false; err.textContent = r.status === 405 ? 'לא נשלח: השרת הזה במצב תצוגה (קריאה בלבד).' : (j.error || `שגיאה ${r.status}`); renderAgent(j.messages || null); if (!j.messages) $$('#agent-log .agent__msg--pending').forEach((x) => x.remove()); }
    else { input.value = ''; renderAgent(j.messages); refresh(); }
  } catch (ex) { err.hidden = false; err.textContent = `לא נשלח: ${ex.message}`; $$('#agent-log .agent__msg--pending').forEach((x) => x.remove()); }
  btn.disabled = false; btn.textContent = 'שליחה'; void pending;
});
$('#agent-input').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#agent-form').requestSubmit(); } });

// ---------------------------------------------------------------- events, save, run
function connectEvents(id) {
  if (state.es) state.es.close();
  const log = $('#log'); log.textContent = '';
  const es = new EventSource(`/api/projects/${encodeURIComponent(id)}/events`);
  es.onmessage = (m) => {
    const ev = JSON.parse(m.data);
    if (ev.type === 'log') { log.textContent += `${new Date(ev.at).toLocaleTimeString('he-IL')} [${ev.stage || '-'}] ${ev.line}\n`; log.scrollTop = log.scrollHeight; }
    else if (ev.type === 'stage') { const st = state.data?.state || { stages: {} }; st.stages[ev.stage] = { ...(st.stages[ev.stage] || {}), ...ev }; renderTimeline(st, true); }
    else if (ev.type === 'run' || ev.type === 'state') { if (ev.status === 'finished' || ev.type === 'state') refresh(); }
  };
  state.es = es;
}
async function saveMeta() {
  const ll = parseLatLon($('#p-latlon').value) || parseLatLon($('#p-address').value);
  const address = parseLatLon($('#p-address').value) ? '' : $('#p-address').value;
  await api(`/api/projects/${encodeURIComponent(state.current)}`, { method: 'PATCH', body: { address, notes: notesWithRoles($('#p-notes').value, rolesFromNotes(state.data?.notes)), latlon: ll,
    options: { panos_dir: $('#p-panos').value || null, variants: $('#o-variants').value.split(','), variant_styles: { morning: $('#v-morning').value, evening: $('#v-evening').value },
      clay: { res: $('#o-res').value, samples: Number($('#o-samples').value), engine: $('#o-engine').value, fps: 24, max_frames: Number($('#o-maxframes').value) || 0 },
      video: { resolution: $('#o-vres').value, detail_refine: $('#o-refine').checked, seeds: 1 } } } });
}
async function run(stages) {
  try { await saveMeta(); await api(`/api/projects/${encodeURIComponent(state.current)}/run`, { method: 'POST', body: { stages, force: $('#force').checked } }); toast('היצירה התחילה. אפשר לסגור את הדף.'); }
  catch (e) { toast(e.status === 405 ? 'לא הורץ: השרת הזה במצב תצוגה (קריאה בלבד).' : `לא הורץ: ${e.message}`); }
  refresh();
}
$('#btn-create').addEventListener('click', () => run(null));
$('#btn-run-sel').addEventListener('click', () => run($$('#stage-picks input:checked').map((i) => i.value)));
$('#btn-save-meta').addEventListener('click', async () => { try { await saveMeta(); toast('ההגדרות נשמרו.'); refresh(); } catch (e) { toast(e.status === 405 ? 'לא נשמר: מצב תצוגה.' : `לא נשמר: ${e.message}`); } });
$('#btn-approve-plan').addEventListener('click', async () => { if (confirm('לאשר את טיוטת ה-LLM כ-plan.json? זו הגאומטריה שתיבנה.')) { try { await api(`/api/projects/${encodeURIComponent(state.current)}/approve-plan`, { method: 'POST' }); refresh(); } catch (e) { toast(e.status === 405 ? 'לא אושר: מצב תצוגה.' : `לא אושר: ${e.message}`); } } });

// ---------------------------------------------------------------- router: #/ · #/new · #/p/<id> (old links #<id> still open the project)
function route() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h === 'main' || h.startsWith('s-')) return;   // in-page anchors
  let view = 'projects', id = null;
  if (h === '/new') view = 'new';
  else if (h.startsWith('/p/')) { view = 'project'; id = h.slice(3); }
  else if (h && h !== '/' && !h.startsWith('/')) { view = 'project'; id = h; }
  // Phase 4 A2: a view is shown only once its data is rendered (the project page jumped 0.19 CLS while it filled in)
  for (const v of ['projects', 'new', 'project']) if (v !== view) $(`#view-${v}`).hidden = true;
  if (view === 'new') $('#view-new').hidden = false;
  $('[data-nav="projects"]').toggleAttribute('aria-current', view === 'projects');
  if (view !== 'project' && state.es) { state.es.close(); state.es = null; state.current = null; }
  const changed = state.view !== `${view}:${id}`; state.view = `${view}:${id}`;
  const done = view === 'projects' ? showProjects() : view === 'project' ? showProject(id) : Promise.resolve();
  done.then(() => {
    $(`#view-${view}`).hidden = false;
    if (!changed) return;
    window.scrollTo(0, 0);
    const h1 = $(`#view-${view} h1`); if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
    if (view === 'new') $('#new-form [name=name]').focus();
  }).catch((e) => { $(`#view-${view}`).hidden = false; toast(`שגיאה: ${e.message}`); });
}
window.addEventListener('hashchange', route);
(async () => { try { await Promise.all([loadEnv(), loadStyles(), loadStages()]); } catch (e) { toast(`השרת לא ענה: ${e.message}`); } route(); })();
