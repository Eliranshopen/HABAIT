#!/usr/bin/env node
// Card 25 (D3): the weekly A/B report of the landing page, in Hebrew Markdown.
//   node report_weekly.mjs --from _local/events.jsonl --out _local/reports [--end YYYY-MM-DD] [--days 7]
//                          [--project <id>] [--include-test] [--name <file.md>] [--json]
// Input: the first-party JSONL (tools/events-sink.mjs: one flat record per line) and/or a PostHog export in the same
// vocabulary (JSON array or JSONL of {event, timestamp, distinct_id, properties:{...}}); --from may repeat.
// Per arm (`variant` a|b, set once per tab by landing.html): visit -> unit_enter -> lead_click -> lead_submitted ->
// meeting (meeting_booked / meeting events, when a CRM / the Sheet feeds them back), counted as distinct sessions,
// + raw event counts, the week range, a two-proportion test on visit->lead, and the research's proof threshold.
// Events with test:true (Playwright / webdriver) are left out unless --include-test.
// A missing or empty input still writes the report (zeros) and says so. Exit 0 unless the arguments are wrong.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ARMS = ['a', 'b'];
export const STEPS = [
  { id: 'visit', he: 'ביקור בדף', en: 'visit' },
  { id: 'unit_enter', he: 'כניסה לדירה (unit_enter)', en: 'unit_enter' },
  { id: 'lead_click', he: 'לחיצת ליד (lead_click)', en: 'lead_click' },
  { id: 'lead_submitted', he: 'טופס נשלח (lead_submitted)', en: 'lead_submitted' },
  { id: 'meeting', he: 'פגישה (meeting)', en: 'meeting' },
];
const MEETING_EVENTS = new Set(['meeting_booked', 'meeting']);
// research §6 item 5 (HABAIT-RESEARCH-2026-11-02.md): ~1,000 visits a month -> significance on visit->lead and
// lead->meeting within 6-8 weeks.
export const PROOF = { visitsPerMonth: 1000, weeksMin: 6, weeksMax: 8 };
const perWeek = PROOF.visitsPerMonth * 7 / 30.44;
export const PROOF_VISITS = { min: Math.round(perWeek * PROOF.weeksMin), max: Math.round(perWeek * PROOF.weeksMax) };

// ---------------- input ----------------
// one input item -> the flat record shape of the sink (or null)
export function normalize(item) {
  if (!item || typeof item !== 'object' || typeof item.event !== 'string') return null;
  if (item.properties && typeof item.properties === 'object') { // PostHog export / capture payload
    const p = item.properties;
    return { ...p, event: item.event, ts: item.timestamp || p.ts || item.ts || null, session_id: p.session_id || item.distinct_id || p.distinct_id || null };
  }
  return { ...item, ts: item.ts || item.timestamp || item.received || null };
}

export function parseText(text) {
  const t = String(text || '').trim();
  if (!t) return [];
  if (t.startsWith('[')) {
    try { const a = JSON.parse(t); return Array.isArray(a) ? a.map(normalize).filter(Boolean) : []; } catch { /* fall through to lines */ }
  }
  const out = [];
  for (const line of t.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try { const r = normalize(JSON.parse(line)); if (r) out.push(r); } catch { /* skip a bad line */ }
  }
  return out;
}

export async function readInputs(files) {
  const notes = [];
  const records = [];
  for (const f of files) {
    if (!existsSync(f)) { notes.push({ file: f, state: 'missing', n: 0 }); continue; }
    const recs = parseText(await readFile(f, 'utf8'));
    notes.push({ file: f, state: recs.length ? 'ok' : 'empty', n: recs.length });
    records.push(...recs);
  }
  return { records, notes };
}

// ---------------- window ----------------
const DAY = 86400000;
export function weekWindow(end, days = 7) {
  const e = end ? new Date(`${end}T00:00:00Z`) : new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
  if (Number.isNaN(e.getTime())) throw new Error(`bad --end date: ${end}`);
  const endMs = e.getTime() + DAY; // exclusive
  const startMs = endMs - days * DAY;
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
  return { startMs, endMs, start: iso(startMs), end: iso(endMs - DAY), days };
}

// ---------------- the funnel ----------------
const isLead = (r) => r.event === 'lead_submitted' || (r.event === 'lead_click' && r.channel === 'whatsapp');

// records -> per-arm sessions/steps/raw counts. A session's arm = the first valid `variant` among its events (by time);
// every event of that session counts for that arm, even one sent without the field.
export function computeFunnel(records, { startMs = -Infinity, endMs = Infinity, includeTest = false, project = null } = {}) {
  const stats = { excludedTest: 0, outOfWindow: 0, otherProject: 0, used: 0, noVariantSessions: 0, meetingsSeen: false };
  const bySession = new Map();
  for (const r of records) {
    if (r.test === true && !includeTest) { stats.excludedTest++; continue; }
    if (project && r.project && r.project !== project) { stats.otherProject++; continue; }
    const ms = Date.parse(r.ts);
    if (!Number.isFinite(ms) || ms < startMs || ms >= endMs) { stats.outOfWindow++; continue; }
    const sid = r.session_id || 'unknown';
    if (!bySession.has(sid)) bySession.set(sid, []);
    bySession.get(sid).push({ ...r, _ms: ms });
    stats.used++;
    if (MEETING_EVENTS.has(r.event)) stats.meetingsSeen = true;
  }
  const arms = {};
  for (const a of ARMS) arms[a] = { sessions: 0, steps: Object.fromEntries(STEPS.map((s) => [s.id, 0])), leads: 0, raw: {}, channels: {}, src: {} };
  for (const [, evs] of bySession) {
    evs.sort((x, y) => x._ms - y._ms);
    const v = (evs.find((e) => e.variant === 'a' || e.variant === 'b') || {}).variant;
    if (!v) { stats.noVariantSessions++; continue; }
    const A = arms[v];
    A.sessions++;
    A.steps.visit++;
    const has = (fn) => evs.some(fn);
    if (has((e) => e.event === 'unit_enter')) A.steps.unit_enter++;
    if (has((e) => e.event === 'lead_click' && e.channel !== 'zip')) A.steps.lead_click++;
    if (has((e) => e.event === 'lead_submitted')) A.steps.lead_submitted++;
    if (has((e) => MEETING_EVENTS.has(e.event))) A.steps.meeting++;
    if (has(isLead)) A.leads++;
    const src = (evs.find((e) => e.src) || {}).src || 'direct';
    A.src[src] = (A.src[src] || 0) + 1;
    for (const e of evs) {
      A.raw[e.event] = (A.raw[e.event] || 0) + 1;
      if (e.event === 'lead_click' || e.event === 'lead_submitted') A.channels[e.channel || '-'] = (A.channels[e.channel || '-'] || 0) + 1;
    }
  }
  return { arms, stats, sessions: bySession.size };
}

// two-proportion z-test (pooled), two-sided p
function erf(x) { // Abramowitz-Stegun 7.1.26
  const s = Math.sign(x); x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
export function twoProportion(x1, n1, x2, n2) {
  if (!n1 || !n2) return null;
  const p = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  if (!se) return { z: 0, p: 1 };
  const z = (x2 / n2 - x1 / n1) / se;
  return { z, p: 1 - erf(Math.abs(z) / Math.SQRT2) };
}

// ---------------- Markdown ----------------
const pct = (x, n) => (n ? `${(100 * x / n).toFixed(1)}%` : '—');
const fmt = (n) => Number(n).toLocaleString('en-US');

export function renderMarkdown({ week, funnel, cumulative, notes, includeTest, generated, project }) {
  const { arms, stats } = funnel;
  const A = arms.a, B = arms.b;
  const L = [];
  L.push(`# דוח שבועי: דף נחיתה A/B${project ? ` · ${project}` : ''}`);
  L.push('');
  L.push(`**השבוע:** ${week.start} עד ${week.end} (${week.days} ימים, UTC) · **הופק:** ${generated}`);
  L.push('');
  L.push('**A** = הדמיות סטטיות + טופס · **B** = טיסת 360 (flow) + אותו טופס. ההקצאה: `?v=a|b` בקישור, אחרת hash של session_id (50/50). ספירה = סשנים (לשונית דפדפן) ייחודיים.');
  L.push('');
  const empty = !stats.used;
  const srcLine = notes.map((n) => `\`${n.file.replace(/\\/g, '/')}\` (${n.state === 'missing' ? 'לא קיים' : n.state === 'empty' ? 'ריק' : `${fmt(n.n)} שורות`})`).join(', ');
  L.push(`**מקור:** ${srcLine || '—'}`);
  if (empty) {
    L.push('');
    L.push(`> **אין אירועים בשבוע הזה${notes.every((n) => n.state !== 'ok') ? ' (קובץ האירועים לא קיים או ריק)' : ''}: כל המספרים למטה 0.** ${stats.excludedTest ? `${fmt(stats.excludedTest)} אירועי בדיקה (test:true) הוצאו. ` : ''}${stats.outOfWindow ? `${fmt(stats.outOfWindow)} אירועים מחוץ לשבוע. ` : ''}`);
  }
  L.push('');
  L.push('## משפך לכל וריאנט');
  L.push('');
  L.push('| שלב | A | % מביקורים (A) | B | % מביקורים (B) |');
  L.push('|---|---:|---:|---:|---:|');
  for (const s of STEPS) {
    const na = s.id === 'unit_enter' && A.steps.unit_enter === 0 ? '0 (אין סיור ב-A)' : fmt(A.steps[s.id]);
    const meetingNA = s.id === 'meeting' && !stats.meetingsSeen;
    L.push(`| ${s.he} | ${meetingNA ? '— (אין נתוני פגישות)' : na} | ${meetingNA ? '—' : pct(A.steps[s.id], A.steps.visit)} | ${meetingNA ? '— (אין נתוני פגישות)' : fmt(B.steps[s.id])} | ${meetingNA ? '—' : pct(B.steps[s.id], B.steps.visit)} |`);
  }
  L.push(`| **ליד** (טופס נשלח או לחיצת וואטסאפ) | **${fmt(A.leads)}** | **${pct(A.leads, A.steps.visit)}** | **${fmt(B.leads)}** | **${pct(B.leads, B.steps.visit)}** |`);
  L.push('');
  L.push(`- **ביקור → ליד:** A ${pct(A.leads, A.steps.visit)} · B ${pct(B.leads, B.steps.visit)}${A.leads && B.leads && A.steps.visit && B.steps.visit ? ` · יחס B/A ×${((B.leads / B.steps.visit) / (A.leads / A.steps.visit)).toFixed(2)}` : ''}`);
  L.push(`- **ליד → פגישה:** ${stats.meetingsSeen ? `A ${pct(A.steps.meeting, A.leads)} · B ${pct(B.steps.meeting, B.leads)}` : 'אין עדיין נתוני פגישות (אירוע `meeting_booked` מה-Sheet / CRM; עד אז השורה ריקה)'}`);
  const test = twoProportion(A.leads, A.steps.visit, B.leads, B.steps.visit);
  L.push(`- **מבחן (ביקור→ליד, שני פרופורציות):** ${test ? `z = ${test.z.toFixed(2)}, p = ${test.p < 0.001 ? '<0.001' : test.p.toFixed(3)} → ${test.p < 0.05 ? 'הבדל מובהק (p<0.05)' : 'לא מובהק'}` : 'אין מספיק נתונים'}${A.steps.visit + B.steps.visit < PROOF_VISITS.min ? ' · המדגם קטן מהסף למטה, אל תסיקו מסקנות' : ''}`);
  L.push('');
  L.push('## סף הוכחה (מהמחקר)');
  L.push('');
  L.push(`לפי המחקר (חלק א §6 פריט 5): פרויקט אחד עם **~${fmt(PROOF.visitsPerMonth)} ביקורים בחודש** נותן תוך **${PROOF.weeksMin}–${PROOF.weeksMax} שבועות** מובהקות על ביקור→ליד ועל ליד→פגישה (על סגירות צריך 2–3 פרויקטים ו-6+ חודשים). כלומר בערך **${fmt(PROOF_VISITS.min)}–${fmt(PROOF_VISITS.max)} ביקורים בסך הכול** (~${fmt(Math.round(PROOF_VISITS.min / 2))}–${fmt(Math.round(PROOF_VISITS.max / 2))} לכל וריאנט).`);
  L.push('');
  const cv = cumulative.arms.a.steps.visit + cumulative.arms.b.steps.visit;
  L.push(`- **מצטבר עד ${week.end}:** ${fmt(cv)} ביקורים (A ${fmt(cumulative.arms.a.steps.visit)} · B ${fmt(cumulative.arms.b.steps.visit)}), ${pct(cv, PROOF_VISITS.min)} מהסף התחתון${cumulative.firstDay ? `, מאז ${cumulative.firstDay} (${cumulative.weeks.toFixed(1)} שבועות)` : ''}.`);
  L.push(`- **השבוע:** ${fmt(A.steps.visit + B.steps.visit)} ביקורים; הקצב הנדרש ≈ ${fmt(Math.round(perWeek))} בשבוע.`);
  L.push('');
  L.push('## מספרים גולמיים (אירועים לפי וריאנט)');
  L.push('');
  const evNames = [...new Set([...Object.keys(A.raw), ...Object.keys(B.raw)])].sort();
  L.push('| אירוע | A | B |');
  L.push('|---|---:|---:|');
  if (!evNames.length) L.push('| — | 0 | 0 |');
  for (const e of evNames) L.push(`| \`${e}\` | ${fmt(A.raw[e] || 0)} | ${fmt(B.raw[e] || 0)} |`);
  L.push('');
  const chNames = [...new Set([...Object.keys(A.channels), ...Object.keys(B.channels)])].sort();
  if (chNames.length) {
    L.push(`**ערוצי ליד (lead_click + lead_submitted):** ${chNames.map((c) => `${c}: A ${fmt(A.channels[c] || 0)} / B ${fmt(B.channels[c] || 0)}`).join(' · ')}`);
    L.push('');
  }
  const srcNames = [...new Set([...Object.keys(A.src), ...Object.keys(B.src)])].sort();
  if (srcNames.length) {
    L.push(`**מקורות (src, ביקורים):** ${srcNames.map((s) => `${s}: A ${fmt(A.src[s] || 0)} / B ${fmt(B.src[s] || 0)}`).join(' · ')}`);
    L.push('');
  }
  L.push('## הערות');
  L.push('');
  L.push(`- אירועים שנכנסו לחישוב: ${fmt(stats.used)} · אירועי בדיקה (test:true) ${includeTest ? 'נכללו' : `שהוצאו: ${fmt(stats.excludedTest)}`} · מחוץ לשבוע: ${fmt(stats.outOfWindow)}${stats.otherProject ? ` · פרויקט אחר: ${fmt(stats.otherProject)}` : ''} · סשנים בלי וריאנט (לא עברו בדף הנחיתה, לא בניסוי): ${fmt(stats.noVariantSessions)}.`);
  L.push('- ביקור = סשן שקיבל וריאנט (רק `landing.html` רושם וריאנט; כל האירועים הבאים באותה לשונית, גם מתוך הטיסה ומדף הדירה, נושאים אותו). `lead_click` בערוץ `zip` (הורדת ZIP בדף הדירה) לא נספר כליד.');
  L.push('- הסשן הוא לשונית: אותו אדם בשתי לשוניות = שני סשנים, ואולי בשני וריאנטים. בקמפיין משתמשים בשני קישורים (`?v=a`, `?v=b`) כדי שהחלוקה תהיה לפי קישור.');
  L.push('- הקובץ הזה פנימי (`_local/reports`), לא לפרסום.');
  L.push('');
  return L.join('\n');
}

export async function buildReport({ from = [], out, end, days = 7, includeTest = false, project = null, name = null, now = new Date() } = {}) {
  const { records, notes } = await readInputs(from);
  const week = weekWindow(end, days);
  const funnel = computeFunnel(records, { startMs: week.startMs, endMs: week.endMs, includeTest, project });
  const cum = computeFunnel(records, { endMs: week.endMs, includeTest, project });
  const firstMs = records.filter((r) => (includeTest || r.test !== true) && (r.variant === 'a' || r.variant === 'b')).map((r) => Date.parse(r.ts)).filter((ms) => Number.isFinite(ms) && ms < week.endMs).sort((a, b) => a - b)[0];
  const cumulative = { arms: cum.arms, firstDay: firstMs ? new Date(firstMs).toISOString().slice(0, 10) : null, weeks: firstMs ? (week.endMs - firstMs) / (7 * DAY) : 0 };
  const md = renderMarkdown({ week, funnel, cumulative, notes, includeTest, generated: now.toISOString().replace(/\.\d+Z$/, 'Z'), project });
  let file = null;
  if (out) {
    await mkdir(out, { recursive: true });
    file = join(out, name || `weekly-${week.end}.md`);
    await writeFile(file, md, 'utf8');
  }
  return { file, md, week, funnel, cumulative, notes };
}

function parseArgs(argv) {
  const o = { from: [], days: 7 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => { const v = argv[++i]; if (v === undefined) throw new Error(`${a} needs a value`); return v; };
    if (a === '--from') o.from.push(val());
    else if (a === '--out') o.out = val();
    else if (a === '--end') o.end = val();
    else if (a === '--days') o.days = Number(val());
    else if (a === '--project') o.project = val();
    else if (a === '--name') o.name = val();
    else if (a === '--include-test') o.includeTest = true;
    else if (a === '--json') o.json = true;
    else if (a === '-h' || a === '--help') o.help = true;
    else throw new Error(`unknown argument ${a}`);
  }
  if (!o.help && !o.from.length) throw new Error('--from <events.jsonl> is required');
  if (!Number.isInteger(o.days) || o.days < 1 || o.days > 366) throw new Error('--days must be 1..366');
  return o;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let o;
  try { o = parseArgs(process.argv.slice(2)); } catch (e) { console.error(`report_weekly: ${e.message}`); process.exit(2); }
  if (o.help) { console.log('node report_weekly.mjs --from <events.jsonl|posthog.json> [--from ...] --out <dir> [--end YYYY-MM-DD] [--days 7] [--project id] [--include-test] [--name f.md] [--json]'); process.exit(0); }
  try {
    const r = await buildReport({ ...o, out: o.out || null });
    const a = r.funnel.arms.a, b = r.funnel.arms.b;
    if (o.json) console.log(JSON.stringify({ file: r.file, week: { start: r.week.start, end: r.week.end }, arms: r.funnel.arms, stats: r.funnel.stats }, null, 1));
    else {
      if (!o.out) console.log(r.md);
      console.log(`report ${r.week.start}..${r.week.end}: A visits=${a.steps.visit} leads=${a.leads} | B visits=${b.steps.visit} leads=${b.leads} | used=${r.funnel.stats.used} test-excluded=${r.funnel.stats.excludedTest}${r.file ? ` -> ${r.file.replace(/\\/g, '/')}` : ''}`);
    }
  } catch (e) {
    console.error(`report_weekly: ${e.message}`);
    process.exit(1);
  }
}
