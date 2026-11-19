// dashboard.html (card 24, D2): hot / cold units, floors, rooms (dwell), floor finishes, sources.
// Data: the first-party JSONL (_local/events.jsonl, written by tools/events-sink.mjs) by default; PostHog's query API
// only when the advanced settings hold a project id + personal API key (kept in this browser's localStorage only).
// No external request otherwise. The pure functions (parseJsonl, normalize, aggregate) run in node for the tests.

export const WEIGHTS = { click: 1, enter: 3, dwell_min: 1, tab: 0.5, favorite: 4, lead: 8 };

export function parseJsonl(text) {
  const out = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    try { const r = JSON.parse(t); if (r && typeof r.event === 'string') out.push(r); } catch { /* skip */ }
  }
  return out;
}

// Older pages (card 23/10) log apartment tabs as room_view{tab} and the ZIP as lead_click{channel:'zip'}.
// Since the card-24 wiring apartment.js sends BOTH names (legacy + apartment_tab / zip_download): in a session that has
// the D2 event, the legacy twin is ignored (event 'legacy_twin'), so nothing is counted twice.
export function normalize(r, native = null) {
  const e = { ...r };
  const sid = e.session_id || 'anon';
  if (e.event === 'room_view' && e.tab && !e.room && !e.scene) e.event = native?.tab?.has?.(sid) ? 'legacy_twin' : 'apartment_tab';
  if (e.event === 'room_view' && !e.room && e.scene) e.room = e.scene;
  if (e.event === 'lead_click' && e.channel === 'zip') e.event = native?.zip?.has?.(sid) ? 'legacy_twin' : 'zip_download';
  return e;
}
function nativeSessions(records) {
  const tab = new Set();
  const zip = new Set();
  for (const r of records) {
    if (r.event === 'apartment_tab') tab.add(r.session_id || 'anon');
    if (r.event === 'zip_download') zip.add(r.session_id || 'anon');
  }
  return { tab, zip };
}

export function filterRecords(records, { project, days = 0, tests = false, now = Date.now() } = {}) {
  const since = days > 0 ? now - days * 86400000 : -Infinity;
  return records.filter((r) => (tests || !r.test)
    && (!project || !r.project || r.project === project)
    && (!r.ts || Date.parse(r.ts) >= since));
}

function bump(map, key, init) { if (!map.has(key)) map.set(key, init()); return map.get(key); }

export function aggregate(rawRecords, units = []) {
  const native = nativeSessions(rawRecords);
  const records = rawRecords.map((r) => normalize(r, native)).filter((r) => r.event !== 'legacy_twin');
  const unitInfo = new Map(units.map((u) => [String(u.id), u]));
  const U = new Map();
  const newUnit = () => ({ clicks: 0, enters: 0, dwell_ms: 0, tabs: 0, favorites: 0, zips: 0, leadSessions: new Set(), sessions: new Set() });
  for (const u of units) bump(U, String(u.id), newUnit);
  const sessions = new Set();
  const leadSessions = new Set();
  const enterSessions = new Set();
  const rooms = new Map();
  const finishes = new Map();
  const srcs = new Map();
  let events = 0;

  for (const r of records) {
    events++;
    const sid = r.session_id || 'anon';
    sessions.add(sid);
    const s = bump(srcs, r.src || 'direct', () => ({ sessions: new Set(), enters: 0, leads: new Set() }));
    s.sessions.add(sid);
    const unit = r.unit != null ? String(r.unit) : null;
    const u = unit ? bump(U, unit, newUnit) : null;
    if (u) u.sessions.add(sid);
    switch (r.event) {
      case 'unit_click': if (u) u.clicks++; break;
      case 'unit_enter': if (u) u.enters++; enterSessions.add(sid); s.enters++; break;
      case 'room_view': {
        const d = Number(r.dwell_ms) || 0;
        if (u) u.dwell_ms += d;
        if (r.room) { const x = bump(rooms, r.room, () => ({ views: 0, dwell_ms: 0, timed: 0 })); x.views++; if (d > 0) { x.dwell_ms += d; x.timed++; } }
        break;
      }
      case 'apartment_tab': if (u) u.tabs++; break;
      case 'favorite': if (u) u.favorites += r.on === false ? -1 : 1; break;
      case 'zip_download': if (u) u.zips++; break;
      case 'lead_click': case 'lead_submitted':
        leadSessions.add(sid); s.leads.add(sid);
        if (u) u.leadSessions.add(sid);
        break;
      case 'floor_switch': if (r.finish) { const f = bump(finishes, r.finish, () => ({ switches: 0 })); f.switches++; } break;
      default: break;
    }
  }

  const rows = [...U.entries()].map(([id, x]) => {
    const info = unitInfo.get(id) || {};
    const score = x.clicks * WEIGHTS.click + x.enters * WEIGHTS.enter + (x.dwell_ms / 60000) * WEIGHTS.dwell_min
      + x.tabs * WEIGHTS.tab + Math.max(0, x.favorites) * WEIGHTS.favorite + x.leadSessions.size * WEIGHTS.lead;
    return {
      unit: id, floor: info.floor ?? null, status: info.status || null, rooms: info.rooms ?? null,
      clicks: x.clicks, enters: x.enters, dwell_ms: x.dwell_ms, tabs: x.tabs, favorites: Math.max(0, x.favorites), zips: x.zips,
      leads: x.leadSessions.size, sessions: x.sessions.size, score: Math.round(score * 10) / 10,
    };
  });
  classify(rows);
  rows.sort((a, b) => b.score - a.score || String(a.unit).localeCompare(String(b.unit)));

  const floors = new Map();
  for (const r of rows) {
    if (r.floor == null) continue;
    const f = bump(floors, r.floor, () => ({ floor: r.floor, units: 0, clicks: 0, enters: 0, dwell_ms: 0, leads: 0, score: 0 }));
    f.units++; f.clicks += r.clicks; f.enters += r.enters; f.dwell_ms += r.dwell_ms; f.leads += r.leads; f.score += r.score;
  }

  return {
    totals: {
      events, sessions: sessions.size, enterSessions: enterSessions.size, leadSessions: leadSessions.size,
      conversion: sessions.size ? leadSessions.size / sessions.size : 0,
    },
    units: rows,
    floors: [...floors.values()].map((f) => ({ ...f, score: Math.round(f.score * 10) / 10 })).sort((a, b) => b.floor - a.floor),
    rooms: [...rooms.entries()].map(([room, x]) => ({ room, views: x.views, avg_dwell_ms: x.timed ? Math.round(x.dwell_ms / x.timed) : 0, dwell_ms: x.dwell_ms }))
      .sort((a, b) => b.dwell_ms - a.dwell_ms || b.views - a.views),
    finishes: [...finishes.entries()].map(([finish, x]) => ({ finish, switches: x.switches })).sort((a, b) => b.switches - a.switches),
    sources: [...srcs.entries()].map(([src, x]) => ({ src, sessions: x.sessions.size, enters: x.enters, leads: x.leads.size, conversion: x.sessions.size ? x.leads.size / x.sessions.size : 0 }))
      .sort((a, b) => b.sessions - a.sessions),
  };
}

// hot = top third of the units that had any activity; cold = no activity or bottom third; warm = the rest
export function classify(rows) {
  const active = rows.filter((r) => r.score > 0).sort((a, b) => b.score - a.score);
  const n = active.length;
  const hotN = n ? Math.max(1, Math.round(n / 3)) : 0;
  const coldN = n >= 3 ? Math.round(n / 3) : 0;
  const rank = new Map(active.map((r, i) => [r, i]));
  for (const r of rows) {
    if (!(r.score > 0)) { r.heat = 'cold'; continue; }
    const i = rank.get(r);
    r.heat = i < hotN ? 'hot' : i >= n - coldN ? 'cold' : 'warm';
  }
  return rows;
}

// PostHog query API (HogQL). Only called with a personal API key the user typed into the advanced settings.
export const HOGQL = `select event, timestamp, properties.session_id, properties.project, properties.unit, properties.room,
 properties.scene, properties.floor, properties.finish, properties.src, properties.dwell_ms, properties.tab, properties.channel,
 properties.on, properties.test from events where event in ('unit_click','unit_enter','room_view','floor_switch','favorite',
 'lead_click','lead_submitted','apartment_tab','zip_download') and timestamp > now() - interval 90 day order by timestamp limit 50000`;
const PH_COLS = ['event', 'ts', 'session_id', 'project', 'unit', 'room', 'scene', 'floor', 'finish', 'src', 'dwell_ms', 'tab', 'channel', 'on', 'test'];

export function postHogRows(json) {
  const rows = Array.isArray(json?.results) ? json.results : [];
  return rows.map((row) => {
    const r = {};
    PH_COLS.forEach((k, i) => {
      let v = row[i];
      if (v === null || v === undefined || v === '') return;
      if (k === 'dwell_ms') v = Number(v);
      if (k === 'on' || k === 'test') v = v === true || v === 'true';
      if (k === 'ts') v = typeof v === 'string' ? v : new Date(v).toISOString();
      r[k] = v;
    });
    return r;
  }).filter((r) => r.event);
}

export async function fetchPostHog({ host = 'https://us.posthog.com', projectId, key, fetchImpl = fetch }) {
  const res = await fetchImpl(`${host.replace(/\/$/, '')}/api/projects/${encodeURIComponent(projectId)}/query/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query: HOGQL } }),
  });
  if (!res.ok) throw new Error(`PostHog HTTP ${res.status}`);
  return postHogRows(await res.json());
}

// ------------------------------------------------------------------ UI ------------------------------------------------------------------
const STR = {
  he: {
    title: 'דירות חמות וקרות', loading: 'טוען…', units: 'דירות', hot: 'חם', warm: 'פושר', cold: 'קר',
    empty: 'אין עדיין אירועים. פתחו את הפלואו או את דף הדירה, ואז רעננו.', floors: 'קומות', rooms: 'חדרים: זמן צפייה',
    finishes: 'רצפות', sources: 'מקורות (src)', advanced: 'הגדרות מתקדמות', project: 'פרויקט', days: 'תקופה',
    d7: '7 ימים', d30: '30 ימים', dall: 'הכול', tests: 'לכלול אירועי בדיקה (Playwright)', file: 'קובץ אירועים (JSONL)',
    ph: 'PostHog (רק אחרי שנפתח חשבון)', phHint: 'המפתח נשמר רק בדפדפן הזה (localStorage), לא בקובץ. ריק = קוראים מהקובץ המקומי בלבד.',
    apply: 'טעינה', legal: 'הדמיות Habait הן להמחשה בלבד; המסמכים המחייבים הם המפרט והתכניות החתומים (טיוטת כיתוב v0, ממתין לעו״ד). הדשבורד פנימי ואינו מוצג לרוכשים.',
    k_sessions: 'ביקורים', k_enters: 'נכנסו לדירה', k_leads: 'לידים', k_conv: 'המרה', k_events: 'אירועים',
    c_unit: 'דירה', c_floor: 'קומה', c_status: 'סטטוס', c_heat: 'חום', c_clicks: 'לחיצות', c_enters: 'כניסות', c_dwell: 'זמן צפייה',
    c_tabs: 'לשוניות', c_fav: 'מועדפים', c_zip: 'ZIP', c_leads: 'לידים', c_score: 'ציון', c_units: 'דירות', c_room: 'חדר', c_views: 'צפיות',
    c_avg: 'ממוצע', c_total: 'סה"כ', c_finish: 'רצפה', c_switch: 'מעברים', c_src: 'מקור', c_sessions: 'ביקורים', c_conv: 'המרה',
    st_for: 'למכירה', st_res: 'שמורה', st_sold: 'נמכרה', sub_file: 'מקור: {f} · {n} אירועים', sub_ph: 'מקור: PostHog · {n} אירועים',
    sub_err: 'לא נטען: {e}', none: '—', parquet: 'פרקט', concrete: 'בטון', marble: 'שיש',
  },
  en: {
    title: 'Hot and cold units', loading: 'Loading…', units: 'Units', hot: 'Hot', warm: 'Warm', cold: 'Cold',
    empty: 'No events yet. Open the flow or an apartment page, then refresh.', floors: 'Floors', rooms: 'Rooms: dwell time',
    finishes: 'Floor finishes', sources: 'Sources (src)', advanced: 'Advanced settings', project: 'Project', days: 'Period',
    d7: '7 days', d30: '30 days', dall: 'All', tests: 'Include test events (Playwright)', file: 'Events file (JSONL)',
    ph: 'PostHog (once the account exists)', phHint: 'The key stays in this browser (localStorage), never in a file. Empty = local file only.',
    apply: 'Load', legal: 'Habait visualizations are illustrations only; the binding documents are the signed specification and plans (caption draft v0, pending legal review). Internal dashboard, not shown to buyers.',
    k_sessions: 'Sessions', k_enters: 'Entered a unit', k_leads: 'Leads', k_conv: 'Conversion', k_events: 'Events',
    c_unit: 'Unit', c_floor: 'Floor', c_status: 'Status', c_heat: 'Heat', c_clicks: 'Clicks', c_enters: 'Entries', c_dwell: 'Dwell',
    c_tabs: 'Tabs', c_fav: 'Favorites', c_zip: 'ZIP', c_leads: 'Leads', c_score: 'Score', c_units: 'Units', c_room: 'Room', c_views: 'Views',
    c_avg: 'Average', c_total: 'Total', c_finish: 'Finish', c_switch: 'Switches', c_src: 'Source', c_sessions: 'Sessions', c_conv: 'Conversion',
    st_for: 'For sale', st_res: 'Reserved', st_sold: 'Sold', sub_file: 'Source: {f} · {n} events', sub_ph: 'Source: PostHog · {n} events',
    sub_err: 'Not loaded: {e}', none: '—', parquet: 'Parquet', concrete: 'Concrete', marble: 'Marble',
  },
};

function fmtDwell(ms) {
  if (!ms) return '0';
  if (ms < 10000) return `${(ms / 1000).toFixed(1)}s`;
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
const pct = (x) => `${Math.round(x * 1000) / 10}%`;
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// only same-origin relative paths for the JSONL file
export function safeFilePath(p) {
  const s = String(p || '').trim();
  return /^[\w./-]+\.jsonl$/.test(s) && !s.includes('..') && !s.startsWith('/') ? s : '_local/events.jsonl';
}

async function main() {
  const params = new URLSearchParams(location.search);
  let lang = params.get('lang') === 'en' ? 'en' : (localStorage.getItem('habait.dash.lang') || 'he');
  const $ = (id) => document.getElementById(id);
  const t = (k, vars = {}) => (STR[lang][k] ?? k).replace(/\{(\w+)\}/g, (_, v) => vars[v] ?? '');
  const S = { data: null, sub: '', projects: [], units: [] };

  const store = { get: (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } }, set: (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { /* */ } } };
  $('fileInp').value = safeFilePath(params.get('file') || store.get('habait.dash.file') || '_local/events.jsonl');
  $('testsChk').checked = params.get('tests') === '1';
  $('phHost').value = store.get('habait.dash.ph_host');
  $('phProject').value = store.get('habait.dash.ph_project');
  $('phKey').value = store.get('habait.dash.ph_key');

  try {
    const pj = await (await fetch('projects.json', { cache: 'no-cache' })).json();
    S.projects = pj.projects || [];
  } catch { S.projects = []; }
  $('projectSel').innerHTML = S.projects.map((p) => `<option value="${esc(p.id)}">${esc(p.id)}</option>`).join('');
  if (params.get('project')) $('projectSel').value = params.get('project');

  function applyLang() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
    $('langBtn').textContent = lang === 'he' ? 'EN' : 'עב';
    for (const el of document.querySelectorAll('[data-t]')) el.textContent = t(el.dataset.t);
  }

  function table(el, cols, rows) {
    el.innerHTML = `<thead><tr>${cols.map((c) => `<th scope="col">${esc(t(c.h))}</th>`).join('')}</tr></thead>`
      + `<tbody>${rows.map((r) => `<tr${r.heat ? ` data-heat="${r.heat}" data-unit="${esc(r.unit)}"` : ''}>${cols.map((c) => `<td${c.num ? ' class="num"' : ''}>${c.f(r)}</td>`).join('')}</tr>`).join('')}</tbody>`;
  }

  function render() {
    applyLang();
    $('sub').textContent = S.sub;
    const d = S.data;
    if (!d) return;
    const T = d.totals;
    $('kpis').innerHTML = [
      ['k_sessions', T.sessions], ['k_enters', T.enterSessions], ['k_leads', T.leadSessions], ['k_conv', pct(T.conversion)],
    ].map(([k, v]) => `<div class="kpi"><div class="kpi-v">${esc(v)}</div><div class="kpi-l">${esc(t(k))}</div></div>`).join('');
    $('empty').hidden = T.events > 0;
    const status = (s) => ({ 'for-sale': t('st_for'), reserved: t('st_res'), sold: t('st_sold') }[s] || s || t('none'));
    table($('unitsTable'), [
      { h: 'c_unit', f: (r) => `<b>${esc(r.unit)}</b>` },
      { h: 'c_heat', f: (r) => `<span class="heat ${r.heat}">${esc(t(r.heat))}</span>` },
      { h: 'c_floor', num: 1, f: (r) => esc(r.floor ?? t('none')) },
      { h: 'c_status', f: (r) => `<span class="st st-${esc(r.status)}">${esc(status(r.status))}</span>` },
      { h: 'c_clicks', num: 1, f: (r) => r.clicks },
      { h: 'c_enters', num: 1, f: (r) => r.enters },
      { h: 'c_dwell', num: 1, f: (r) => fmtDwell(r.dwell_ms) },
      { h: 'c_fav', num: 1, f: (r) => r.favorites },
      { h: 'c_leads', num: 1, f: (r) => r.leads },
      { h: 'c_score', num: 1, f: (r) => r.score },
    ], d.units);
    table($('floorsTable'), [
      { h: 'c_floor', f: (r) => `<b>${esc(r.floor)}</b>` }, { h: 'c_units', num: 1, f: (r) => r.units },
      { h: 'c_clicks', num: 1, f: (r) => r.clicks }, { h: 'c_enters', num: 1, f: (r) => r.enters },
      { h: 'c_dwell', num: 1, f: (r) => fmtDwell(r.dwell_ms) }, { h: 'c_leads', num: 1, f: (r) => r.leads },
    ], d.floors);
    table($('roomsTable'), [
      { h: 'c_room', f: (r) => esc(r.room) }, { h: 'c_views', num: 1, f: (r) => r.views },
      { h: 'c_avg', num: 1, f: (r) => fmtDwell(r.avg_dwell_ms) }, { h: 'c_total', num: 1, f: (r) => fmtDwell(r.dwell_ms) },
    ], d.rooms);
    table($('finishTable'), [
      { h: 'c_finish', f: (r) => esc(STR[lang][r.finish] || r.finish) }, { h: 'c_switch', num: 1, f: (r) => r.switches },
    ], d.finishes);
    table($('srcTable'), [
      { h: 'c_src', f: (r) => `<span dir="ltr">${esc(r.src)}</span>` }, { h: 'c_sessions', num: 1, f: (r) => r.sessions },
      { h: 'c_enters', num: 1, f: (r) => r.enters }, { h: 'c_leads', num: 1, f: (r) => r.leads }, { h: 'c_conv', num: 1, f: (r) => pct(r.conversion) },
    ], d.sources);
  }

  async function load() {
    const project = $('projectSel').value || S.projects[0]?.id || null;
    const entry = S.projects.find((p) => p.id === project);
    S.units = [];
    if (entry) {
      try { S.units = (await (await fetch(`${entry.dir.replace(/\/$/, '')}/units.json`, { cache: 'no-cache' })).json()).units || []; } catch { S.units = []; }
    }
    const opts = { project, days: Number($('daysSel').value) || 0, tests: $('testsChk').checked };
    const ph = { host: $('phHost').value.trim() || 'https://us.posthog.com', projectId: $('phProject').value.trim(), key: $('phKey').value.trim() };
    let records = [];
    try {
      if (ph.projectId && ph.key) {
        records = await fetchPostHog(ph);
        S.sub = t('sub_ph', { n: records.length });
      } else {
        const f = safeFilePath($('fileInp').value);
        const res = await fetch(f, { cache: 'no-cache' });
        records = res.ok ? parseJsonl(await res.text()) : [];
        S.sub = t('sub_file', { f: `⁦${f}⁩`, n: records.length }); // LTR isolate: the path stays readable in RTL
      }
    } catch (e) {
      S.sub = t('sub_err', { e: e.message || e });
    }
    S.data = aggregate(filterRecords(records, opts), S.units);
    window.__dash = S;
    render();
  }

  $('langBtn').addEventListener('click', () => { lang = lang === 'he' ? 'en' : 'he'; store.set('habait.dash.lang', lang); render(); });
  $('advForm').addEventListener('submit', (e) => {
    e.preventDefault();
    store.set('habait.dash.file', safeFilePath($('fileInp').value));
    store.set('habait.dash.ph_host', $('phHost').value.trim());
    store.set('habait.dash.ph_project', $('phProject').value.trim());
    store.set('habait.dash.ph_key', $('phKey').value.trim());
    load();
  });
  applyLang();
  await load();
}

if (typeof document !== 'undefined' && document.getElementById('unitsTable')) main();
