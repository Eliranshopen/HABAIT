#!/usr/bin/env node
// Card 26 (D4): light admin. Status / price / note per apartment from a sheet -> units.json (+ optional dist).
//
//   node build_units.mjs --source <csv path | https published-CSV URL | apps-script JSON URL | .json path>
//                        --units <units.json> [--out <path>] [--dist <dir>] [--dry-run]
//
// The sheet has one row per apartment with the columns unit, status, price, note (Hebrew headers
// דירה / סטטוס / מחיר / הערה are accepted too; extra columns are ignored; column order is free).
//   status: available | reserved | sold (also פנוי/פנויה/למכירה, שמור/שמורה, נמכר/נמכרה, and the schema
//           values for-sale / unknown). Written as the units.v0 enum: for-sale | reserved | sold | unknown.
//   price:  integer ILS. "7950000", "7,950,000", "₪7,950,000.00" -> 7950000; 0 or "לפי בקשה" = price on request.
//   note:   free text. An empty cell keeps the current note; "-" clears it.
//   An empty status / price cell keeps the current value.
//
// Guarantees:
//   - ONLY status / price / note change. The file is edited by splicing those three value spans in the
//     original text, so every other byte (box_world, outline_world, hotspots, polygons, key order,
//     indentation, CRLF, escapes) stays exactly as it was. A machine "box_source: ...;" clause at the start
//     of a note (written by Habait/engine stack_units.py) is kept when the sheet replaces the note.
//   - The result is validated with contracts/validate.mjs (units.v0 schema; plus the flow cross-check when
//     a flow.json sits next to the units file) before anything is written.
//   - Any bad cell (unknown status, bad price, duplicate unit, missing header) -> a Hebrew FAIL message,
//     exit 1, nothing is written. An unknown unit id -> a warning, the row is skipped.
//   - The previous file is copied to <file>.bak-<YYYYMMDD-HHMMSS> before it is replaced (atomic rename);
//     the newest 10 backups per file are kept.
//   - --dist <dir>: updates unit.status / unit.price in <dir>/apartment.json (or in every <dir>/*/apartment.json)
//     and nothing else. The ZIP inside the dist is NOT rebuilt (tools/build_zip.mjs does that).
//
// Exit codes: 0 ok (also "nothing to change"), 1 FAIL (file untouched), 2 usage.
// Ids: a sheet id "846" also matches a units.json id "apt846" (Habait/engine uses the apt prefix) when the
// exact id does not exist.
import { readFileSync, writeFileSync, existsSync, statSync, renameSync, copyFileSync, readdirSync, unlinkSync } from 'node:fs';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { validateSchema, unitsSchema, flowSchema, projectSchema, crossCheck } from './contracts/validate.mjs';

export const SCHEMA_STATUSES = unitsSchema.$defs.unit.properties.status.enum; // for-sale, sold, reserved, unknown
const KEEP_BACKUPS = 10;

// ---------- status / price / note cells ----------

const STATUS_ALIASES = {
  'for-sale': ['for-sale', 'for sale', 'forsale', 'available', 'free', 'open', 'פנוי', 'פנויה', 'למכירה', 'זמין', 'זמינה'],
  reserved: ['reserved', 'hold', 'on hold', 'שמור', 'שמורה', 'בשריון', 'משוריין', 'משוריינת'],
  sold: ['sold', 'נמכר', 'נמכרה'],
  unknown: ['unknown', 'לא ידוע'],
};
const STATUS_LOOKUP = new Map();
for (const [canon, list] of Object.entries(STATUS_ALIASES)) for (const a of list) STATUS_LOOKUP.set(a, canon);

/** "פנוי" / "Available " / "sold" -> the units.v0 enum value, or null when it is not a known status. */
export function normalizeStatus(raw) {
  if (raw === undefined || raw === null) return null;
  const k = String(raw).normalize('NFC').replace(/[֑-ׇ]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
  const canon = STATUS_LOOKUP.get(k) || null;
  return canon && SCHEMA_STATUSES.includes(canon) ? canon : null;
}

/** "₪7,950,000.00" -> 7950000; "לפי בקשה" -> 0; returns {ok, value} or {ok:false}. */
export function parsePrice(raw) {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw >= 0 ? { ok: true, value: Math.round(raw) } : { ok: false };
  const s0 = String(raw ?? '').trim();
  if (/^(לפי בקשה|on request|por)$/i.test(s0)) return { ok: true, value: 0 };
  const s = s0.replace(/₪|ש["״']?ח|nis|ils/gi, '').replace(/[\s,'’‎‏]/g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return { ok: false };
  const v = Math.round(Number(s));
  return Number.isSafeInteger(v) && v >= 0 ? { ok: true, value: v } : { ok: false };
}

/** keeps the machine "box_source: ...;" clause that Habait/engine writes at the start of a note */
export function splitNote(note) {
  const m = /^box_source:[^;]*;\s*/.exec(note || '');
  return m ? { machine: m[0], human: note.slice(m[0].length) } : { machine: '', human: note || '' };
}

// ---------- the sheet ----------

/** RFC 4180 CSV: quotes, "" escapes, commas/newlines inside quotes, CRLF, BOM. Delimiter , (or ; / tab when the header has no comma). */
export function parseCsv(text) {
  text = String(text).replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const delim = firstLine.includes(',') ? ',' : firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ',';
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let line = 1;
  let rowLine = 1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; continue; }
      if (c === '\n') line++;
      field += c;
      continue;
    }
    if (c === '"' && field === '') { quoted = true; continue; }
    if (c === delim) { row.push(field); field = ''; continue; }
    if (c === '\r' && text[i + 1] === '\n') continue;
    if (c === '\n' || c === '\r') { row.push(field); rows.push({ cells: row, line: rowLine }); row = []; field = ''; line++; rowLine = line; continue; }
    field += c;
  }
  if (quoted) throw new SheetError(`מרכאה (") שלא נסגרה בגיליון, החל משורה ${rowLine}.`);
  if (field !== '' || row.length) { row.push(field); rows.push({ cells: row, line: rowLine }); }
  return rows;
}

const HEADER_ALIASES = {
  unit: ['unit', 'unit id', 'id', 'apartment', 'apt', 'דירה', 'מספר דירה', 'מס דירה', 'יחידה'],
  status: ['status', 'סטטוס', 'מצב'],
  price: ['price', 'price ils', 'מחיר', 'מחיר בשקלים'],
  note: ['note', 'notes', 'הערה', 'הערות'],
};
function headerKey(cell) {
  const k = String(cell).replace(/^﻿/, '').replace(/\(.*?\)|₪|"|״/g, ' ').trim().toLowerCase().replace(/[\s._-]+/g, ' ').trim();
  for (const [key, list] of Object.entries(HEADER_ALIASES)) if (list.includes(k)) return key;
  return null;
}

export class SheetError extends Error {}

/** a table (array of {cells, line}) -> [{unit, status, price, note, line}] with raw cell strings ('' = empty) */
export function rowsFromTable(table) {
  const nonEmpty = table.filter((r) => r.cells.some((c) => String(c).trim() !== '') && !String(r.cells[0]).trim().startsWith('#'));
  if (!nonEmpty.length) throw new SheetError('הגיליון ריק: אין שורת כותרת ואין שורות.');
  const colsOf = (r) => {
    const cols = {};
    r.cells.forEach((c, i) => { const k = headerKey(c); if (k && cols[k] === undefined) cols[k] = i; });
    return cols.unit !== undefined && (cols.status !== undefined || cols.price !== undefined || cols.note !== undefined) ? cols : null;
  };
  const h = nonEmpty.slice(0, 5).findIndex((r) => colsOf(r)); // a title row above the header is fine
  if (h < 0) {
    throw new SheetError(`בשורה הראשונה של הגיליון חייבות להיות העמודות unit, status, price, note (או דירה, סטטוס, מחיר, הערה). נמצא: ${nonEmpty[0].cells.map((c) => JSON.stringify(String(c))).join(', ')}.`);
  }
  const cols = colsOf(nonEmpty[h]);
  const body = nonEmpty.slice(h + 1);
  const cell = (r, k) => (cols[k] === undefined ? '' : String(r.cells[cols[k]] ?? '').trim());
  return body.map((r) => ({ unit: cell(r, 'unit'), status: cell(r, 'status'), price: cell(r, 'price'), note: cell(r, 'note'), line: r.line }));
}

/** Apps Script / JSON shapes: [{unit,...}] | {rows:[...]} | {units:[...]} | {values:[[header...],[...]]} */
export function rowsFromJson(doc) {
  if (doc && doc.ok === false) throw new SheetError(`ה-Apps Script החזיר שגיאה: ${JSON.stringify(doc.error ?? doc)}.`);
  const values = Array.isArray(doc?.values) ? doc.values : Array.isArray(doc) && Array.isArray(doc[0]) ? doc : null;
  if (values) return rowsFromTable(values.map((cells, i) => ({ cells: cells.map((c) => (c === null || c === undefined ? '' : String(c))), line: i + 1 })));
  const list = Array.isArray(doc) ? doc : Array.isArray(doc?.rows) ? doc.rows : Array.isArray(doc?.units) ? doc.units : null;
  if (!list) throw new SheetError('ה-JSON לא בצורה מוכרת: צריך מערך של {unit, status, price, note}, או {rows: [...]}, או {values: [[כותרות], [שורה], ...]}.');
  return list.map((o, i) => {
    const get = (k) => {
      for (const [key, v] of Object.entries(o || {})) if (headerKey(key) === k) return v === null || v === undefined ? '' : typeof v === 'number' ? v : String(v).trim();
      return '';
    };
    const u = get('unit');
    return { unit: typeof u === 'number' ? String(u) : u, status: String(get('status')), price: get('price'), note: String(get('note')), line: i + 2 };
  });
}

const isUrl = (s) => /^https?:\/\//i.test(s);

/** reads the source (local file or URL) -> {rows, kind, label}. fetchImpl is injectable for tests (no network there). */
export async function loadSource(source, { fetchImpl = globalThis.fetch, timeoutMs = 20000 } = {}) {
  let text;
  let kind;
  if (isUrl(source)) {
    const u = new URL(source);
    if (u.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(u.hostname)) throw new SheetError(`רק קישורי https מותרים (קיבלתי ${u.protocol}).`);
    let res;
    try {
      res = await fetchImpl(source, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs), headers: { accept: 'text/csv, application/json;q=0.9, */*;q=0.1' } });
    } catch (e) {
      throw new SheetError(`לא הצלחתי למשוך את הגיליון מ-${source} (${e?.message || e}).`);
    }
    if (!res.ok) throw new SheetError(`הגיליון החזיר HTTP ${res.status} מ-${source}. בודקים שהגיליון מפורסם ושהקישור מלא.`);
    text = await res.text();
    const ct = String(res.headers?.get?.('content-type') || '').toLowerCase();
    const head = text.trimStart().slice(0, 200).toLowerCase();
    if (ct.includes('text/html') || head.startsWith('<!doctype') || head.startsWith('<html')) {
      throw new SheetError('הקישור החזיר דף HTML ולא CSV או JSON. כנראה הגיליון לא פורסם: "קובץ ← שיתוף ← פרסום באינטרנט", בפורמט CSV.');
    }
    kind = ct.includes('json') || /^[[{]/.test(text.trimStart()) ? 'json' : 'csv';
  } else {
    const p = resolve(source);
    if (!existsSync(p) || !statSync(p).isFile()) throw new SheetError(`קובץ המקור לא נמצא: ${source}`);
    text = readFileSync(p, 'utf8');
    kind = /\.json$/i.test(p) ? 'json' : 'csv';
  }
  if (kind === 'json') {
    let doc;
    try { doc = JSON.parse(text.replace(/^﻿/, '')); } catch (e) { throw new SheetError(`ה-JSON של המקור לא תקין (${e.message}).`); }
    return { rows: rowsFromJson(doc), kind, label: source };
  }
  return { rows: rowsFromTable(parseCsv(text)), kind, label: source };
}

// ---------- span-preserving JSON edits ----------

/** a JSON text -> a span tree: {type, start, end, members:[{key,keyStart,keyEnd,value}] | items:[...]} */
export function scanJson(text) {
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  const n = text.length;
  const fail = (m) => { throw new Error(`JSON scan: ${m} at offset ${i}`); };
  const ws = () => { while (i < n) { const c = text.charCodeAt(i); if (c === 32 || c === 9 || c === 10 || c === 13) i++; else break; } };
  const str = () => {
    const s = i;
    if (text[i] !== '"') fail('expected a string');
    for (i++; i < n; i++) {
      if (text[i] === '\\') { i++; continue; }
      if (text[i] === '"') { i++; return { start: s, end: i }; }
    }
    return fail('unterminated string');
  };
  const scalar = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/y;
  const val = () => {
    ws();
    const s = i;
    if (text[i] === '{') {
      i++; ws();
      const members = [];
      if (text[i] === '}') { i++; return { type: 'object', start: s, end: i, members }; }
      for (;;) {
        ws();
        const k = str();
        ws();
        if (text[i] !== ':') fail("expected ':'");
        i++;
        const value = val();
        members.push({ key: JSON.parse(text.slice(k.start, k.end)), keyStart: k.start, keyEnd: k.end, value });
        ws();
        if (text[i] === ',') { i++; continue; }
        if (text[i] === '}') { i++; return { type: 'object', start: s, end: i, members }; }
        fail("expected ',' or '}'");
      }
    }
    if (text[i] === '[') {
      i++; ws();
      const items = [];
      if (text[i] === ']') { i++; return { type: 'array', start: s, end: i, items }; }
      for (;;) {
        items.push(val());
        ws();
        if (text[i] === ',') { i++; continue; }
        if (text[i] === ']') { i++; return { type: 'array', start: s, end: i, items }; }
        fail("expected ',' or ']'");
      }
    }
    if (text[i] === '"') return { type: 'string', ...str() };
    scalar.lastIndex = i;
    const m = scalar.exec(text);
    if (!m) fail('unexpected token');
    i += m[0].length;
    return { type: 'scalar', start: s, end: i };
  };
  const root = val();
  ws();
  if (i !== n) fail('trailing data');
  return root;
}

const member = (obj, key) => obj?.members?.find((m) => m.key === key);

/** JSON.stringify that keeps a pure-ASCII file pure ASCII (\u escapes, like Python's ensure_ascii) */
function enc(value, ascii) {
  const s = JSON.stringify(value);
  return ascii ? s.replace(/[\u007f-￿]/g, (ch) => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0')) : s;
}

/** edits for setting / inserting / removing one member of a scanned object */
function memberEdit(text, obj, key, value, ascii) {
  const m = member(obj, key);
  if (value === undefined) {
    if (!m) return null;
    const idx = obj.members.indexOf(m);
    if (idx > 0) return { start: obj.members[idx - 1].value.end, end: m.value.end, text: '' };
    if (obj.members.length > 1) return { start: m.keyStart, end: obj.members[1].keyStart, text: '' };
    return { start: obj.start + 1, end: obj.end - 1, text: '' };
  }
  if (m) return { start: m.value.start, end: m.value.end, text: enc(value, ascii) };
  const last = obj.members[obj.members.length - 1];
  if (!last) return { start: obj.start + 1, end: obj.start + 1, text: `${enc(key, ascii)}: ${enc(value, ascii)}` };
  const prev = obj.members[obj.members.length - 2];
  const sep = prev ? text.slice(prev.value.end, last.keyStart) : ',' + text.slice(obj.start + 1, last.keyStart);
  const colon = text.slice(last.keyEnd, last.value.start);
  return { start: last.value.end, end: last.value.end, text: `${sep}${enc(key, ascii)}${colon}${enc(value, ascii)}` };
}

function applyEdits(text, edits) {
  let out = text;
  for (const e of [...edits].sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return out;
}

const parseText = (text) => JSON.parse(text.replace(/^﻿/, ''));

// ---------- merge ----------

const normId = (id) => String(id).trim().toLowerCase().replace(/^apt[-_]?/, '');
const cleanUnitCell = (v) => String(v ?? '').trim().replace(/^(\d+)\.0+$/, '$1');

/**
 * Validates the sheet rows and merges them into a units document.
 * Returns {errors[], warnings[], changes[], doc (merged), updates: Map(unitIndex -> {status?, price?, note?|null})}.
 */
export function mergeRows(unitsDoc, rows) {
  const errors = [];
  const warnings = [];
  const changes = [];
  const updates = new Map();
  const units = unitsDoc.units || [];
  const byId = new Map(units.map((u, i) => [String(u.id), i]));
  const byNorm = new Map();
  units.forEach((u, i) => { const k = normId(u.id); byNorm.set(k, byNorm.has(k) ? -1 : i); });
  const seen = new Map();
  const where = (r) => `בשורה ${r.line}${r.unit ? ` (דירה ${r.unit})` : ''}`;
  const parsed = [];
  for (const r of rows) {
    const unit = cleanUnitCell(r.unit);
    r.unit = unit;
    const statusRaw = String(r.status ?? '').trim();
    const priceRaw = typeof r.price === 'number' ? r.price : String(r.price ?? '').trim();
    const noteRaw = String(r.note ?? '').trim();
    if (!unit) {
      if (statusRaw || priceRaw !== '' || noteRaw) errors.push(`שורה ${r.line} בלי מספר דירה (בעמודה unit).`);
      continue;
    }
    if (seen.has(unit)) { errors.push(`דירה ${unit} מופיעה פעמיים בגיליון (שורות ${seen.get(unit)} ו-${r.line}). משאירים שורה אחת לכל דירה.`); continue; }
    seen.set(unit, r.line);
    const p = { row: r, unit };
    if (statusRaw) {
      const s = normalizeStatus(statusRaw);
      if (!s) errors.push(`סטטוס לא מוכר "${statusRaw}" ${where(r)}. מותר: פנוי / שמור / נמכר, או available / reserved / sold.`);
      else p.status = s;
    }
    if (priceRaw !== '') {
      const pr = parsePrice(priceRaw);
      if (!pr.ok) errors.push(`מחיר לא תקין "${priceRaw}" ${where(r)}. מחיר בשקלים, מספר שלם (למשל 7950000 או 7,950,000), או 0 = מחיר לפי בקשה.`);
      else p.price = pr.value;
    }
    if (noteRaw) p.note = noteRaw === '-' ? null : noteRaw;
    parsed.push(p);
  }
  if (parsed.some((p) => p.price !== undefined) && unitsDoc.currency && unitsDoc.currency !== 'ILS') {
    errors.push(`המחירים בגיליון בשקלים (ILS), אבל units.json במטבע ${unitsDoc.currency}.`);
  }
  const doc = structuredClone(unitsDoc);
  const touched = new Set();
  for (const p of parsed) {
    let idx = byId.get(p.unit);
    if (idx === undefined) {
      const k = byNorm.get(normId(p.unit));
      if (k !== undefined && k >= 0) idx = k;
    }
    if (idx === undefined) { warnings.push(`דירה ${p.unit} (שורה ${p.row.line}) לא קיימת ב-units.json; דילגתי עליה.`); continue; }
    touched.add(idx);
    const u = doc.units[idx];
    const label = u.id === p.unit ? u.id : `${p.unit} → ${u.id}`;
    const up = {};
    if (p.status !== undefined && p.status !== u.status) { changes.push(`${label}: סטטוס ${u.status} → ${p.status}`); up.status = p.status; u.status = p.status; }
    if (p.price !== undefined && p.price !== u.price) { changes.push(`${label}: מחיר ${fmt(u.price)} → ${fmt(p.price)}`); up.price = p.price; u.price = p.price; }
    if (p.note !== undefined) {
      const { machine, human } = splitNote(u.note);
      const next = p.note === null ? (machine || undefined) : machine + p.note;
      if (next !== u.note && !(p.note === null && human === '')) {
        changes.push(`${label}: הערה ${JSON.stringify(human || '')} → ${JSON.stringify(p.note === null ? '' : p.note)}`);
        up.note = next === undefined ? null : next;
        if (next === undefined) delete u.note; else u.note = next;
      }
    }
    if (Object.keys(up).length) updates.set(idx, { ...(updates.get(idx) || {}), ...up });
  }
  const untouched = units.length - touched.size;
  return { errors, warnings, changes, doc, updates, untouched };
}

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-US') : String(n));

/** the merged units text: the original text with only status / price / note spans replaced */
export function spliceUnitsText(text, updates) {
  const ascii = !/[^\x00-\x7f]/.test(text);
  const root = scanJson(text);
  const arr = member(root, 'units')?.value;
  if (!arr || arr.type !== 'array') throw new Error('units.json has no "units" array');
  const edits = [];
  for (const [idx, up] of updates) {
    const obj = arr.items[idx];
    for (const key of ['status', 'price', 'note']) {
      if (!(key in up)) continue;
      const e = memberEdit(text, obj, key, up[key] === null ? undefined : up[key], ascii);
      if (e) edits.push(e);
    }
  }
  return applyEdits(text, edits);
}

/** the validation the platform uses: units.v0 schema, plus validate.mjs's cross-check when flow.json sits next to it */
export function validateUnitsDoc(doc, dir) {
  const errors = validateSchema(unitsSchema, doc).map((e) => `units.json ${e}`);
  let checked = 'units.v0 schema';
  const flowPath = dir && join(dir, 'flow.json');
  if (!errors.length && flowPath && existsSync(flowPath)) {
    try {
      const flow = parseText(readFileSync(flowPath, 'utf8'));
      const projectPath = join(dir, 'project.json');
      const project = existsSync(projectPath) ? parseText(readFileSync(projectPath, 'utf8')) : null;
      const schemaErrors = [
        ...validateSchema(flowSchema, flow).map((e) => `flow.json ${e}`),
        ...(project ? validateSchema(projectSchema, project).map((e) => `project.json ${e}`) : []),
      ];
      errors.push(...schemaErrors);
      if (!schemaErrors.length) errors.push(...crossCheck({ units: doc, flow, project, dir }).errors);
      checked = 'units.v0 schema + flow cross-check (validate.mjs)';
    } catch (e) {
      errors.push(`flow.json: ${e.message}`);
    }
  }
  return { errors, checked };
}

// ---------- dist ----------

function distTargets(dir) {
  const d = resolve(dir);
  if (!existsSync(d) || !statSync(d).isDirectory()) throw new SheetError(`תיקיית ה-dist לא נמצאה: ${dir}`);
  if (existsSync(join(d, 'apartment.json'))) return [join(d, 'apartment.json')];
  const list = readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => join(d, e.name, 'apartment.json')).filter((p) => existsSync(p));
  if (!list.length) throw new SheetError(`אין apartment.json ב-${dir} (וגם לא בתיקיות שמתחתיה).`);
  return list;
}

/** plans the dist edits: only unit.status and unit.price of each apartment.json that has a matching unit */
export function planDist(dir, mergedDoc) {
  const plans = [];
  for (const file of distTargets(dir)) {
    const text = readFileSync(file, 'utf8');
    let doc;
    try { doc = parseText(text); } catch (e) { throw new SheetError(`${file} אינו JSON תקין (${e.message}).`); }
    const id = doc?.unit?.id;
    if (id === undefined) throw new SheetError(`${file}: אין בלוק unit עם id.`);
    const u = mergedDoc.units.find((x) => String(x.id) === String(id)) || mergedDoc.units.find((x) => normId(x.id) === normId(id));
    if (!u) { plans.push({ file, id, skipped: `דירה ${id} לא נמצאה ב-units.json` }); continue; }
    const root = scanJson(text);
    const unitObj = member(root, 'unit').value;
    const ascii = !/[^\x00-\x7f]/.test(text);
    const edits = [];
    const changes = [];
    const want = structuredClone(doc);
    for (const key of ['status', 'price']) {
      if (u[key] === undefined || doc.unit[key] === u[key]) continue;
      edits.push(memberEdit(text, unitObj, key, u[key], ascii));
      changes.push(`${id}: ${key} ${key === 'price' ? fmt(doc.unit[key]) : doc.unit[key]} → ${key === 'price' ? fmt(u[key]) : u[key]}`);
      want.unit[key] = u[key];
    }
    const next = applyEdits(text, edits);
    if (!isDeepStrictEqual(parseText(next), want)) throw new Error(`internal: dist splice mismatch in ${file}`);
    plans.push({ file, id, text: next, changed: next !== text, changes });
  }
  return plans;
}

// ---------- writing ----------

const pad = (n) => String(n).padStart(2, '0');
const stamp = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

function backupFile(file, now) {
  let b = `${file}.bak-${stamp(now)}`;
  for (let k = 2; existsSync(b); k++) b = `${file}.bak-${stamp(now)}-${k}`;
  copyFileSync(file, b);
  const re = new RegExp(`^${basename(file).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.bak-\\d{8}-\\d{6}(-\\d+)?$`);
  const old = readdirSync(dirname(file)).filter((f) => re.test(f)).sort();
  for (const f of old.slice(0, Math.max(0, old.length - KEEP_BACKUPS))) { try { unlinkSync(join(dirname(file), f)); } catch { /* keep going */ } }
  return b;
}

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
function atomicWrite(file, text) {
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, text, 'utf8');
  for (let k = 0; ; k++) {
    try { renameSync(tmp, file); return; } catch (e) {
      if (k < 4 && ['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) { sleep(150); continue; }
      writeFileSync(file, text, 'utf8');
      try { unlinkSync(tmp); } catch { /* ignore */ }
      return;
    }
  }
}

// ---------- the build ----------

/**
 * Runs the whole merge. Never throws for data problems: returns {code, lines[], errors[], warnings[], changes[], backup, out}.
 * code 0 = ok, 1 = FAIL (nothing written), 2 = usage.
 */
export async function buildUnits({ source, units, out, dist, dryRun = false, fetchImpl, now = new Date() } = {}) {
  const lines = [];
  const res = { code: 0, lines, errors: [], warnings: [], changes: [], distChanges: [], backup: null, out: null };
  const fail = (msgs) => {
    res.code = 1;
    res.errors.push(...[].concat(msgs));
    const target = out ? resolve(out) : units ? resolve(units) : '';
    lines.push(...res.errors.map((m) => `FAIL: ${m}`), `units.json לא השתנה${target ? ` (${target})` : ''}${dist ? '; גם ה-dist לא השתנה' : ''}.`);
    return res;
  };
  if (!source || !units) {
    res.code = 2;
    lines.push('שימוש: node build_units.mjs --source <קובץ CSV | קישור CSV מפורסם | קישור JSON של Apps Script> --units <units.json> [--out <נתיב>] [--dist <תיקייה>] [--dry-run]');
    return res;
  }
  const unitsPath = resolve(units);
  const outPath = out ? resolve(out) : unitsPath;
  res.out = outPath;
  if (!existsSync(unitsPath)) return fail(`units.json לא נמצא: ${units}`);

  let sheet;
  try { sheet = await loadSource(source, { fetchImpl }); } catch (e) { return fail(e instanceof SheetError ? e.message : `קריאת המקור נכשלה: ${e.message}`); }
  lines.push(`מקור: ${sheet.label} (${sheet.kind.toUpperCase()}, ${sheet.rows.filter((r) => r.unit).length} שורות)`);

  const text = readFileSync(unitsPath, 'utf8');
  let doc;
  try { doc = parseText(text); } catch (e) { return fail(`units.json אינו JSON תקין (${e.message}).`); }
  if (!Array.isArray(doc?.units)) return fail('ב-units.json אין מערך units.');

  const m = mergeRows(doc, sheet.rows);
  res.warnings.push(...m.warnings);
  res.changes.push(...m.changes);
  if (m.errors.length) { lines.push(...m.warnings.map((w) => `אזהרה: ${w}`)); return fail(m.errors); }

  const v = validateUnitsDoc(m.doc, dirname(unitsPath));
  if (v.errors.length) {
    const before = validateUnitsDoc(doc, dirname(unitsPath)).errors.length;
    return fail([`units.json אחרי המיזוג לא עובר ולידציה (${v.checked})${before ? '; הקובץ לא היה תקין גם לפני המיזוג' : ''}:`, ...v.errors.slice(0, 12).map((e) => `  ${e}`)]);
  }

  let nextText;
  try {
    nextText = spliceUnitsText(text, m.updates);
    if (!isDeepStrictEqual(parseText(nextText), m.doc)) throw new Error('splice result differs from the merged document');
  } catch (e) {
    return fail(`תקלה פנימית בעריכת units.json (${e.message}).`);
  }

  let distPlans = [];
  if (dist) {
    try { distPlans = planDist(dist, m.doc); } catch (e) { return fail(e instanceof SheetError ? e.message : `תקלה בעדכון ה-dist (${e.message}).`); }
    for (const p of distPlans) { if (p.skipped) res.warnings.push(`dist ${p.file}: ${p.skipped}; לא עודכן.`); else res.distChanges.push(...p.changes); }
  }

  for (const c of m.changes) lines.push(`  ${c}`);
  for (const c of res.distChanges) lines.push(`  dist ${c}`);
  for (const w of res.warnings) lines.push(`אזהרה: ${w}`);
  if (m.untouched) lines.push(`${m.untouched} דירות בלי שורה בגיליון: לא השתנו.`);

  const unitsChanged = nextText !== text || outPath !== unitsPath;
  const distToWrite = distPlans.filter((p) => p.changed);
  if (dryRun) {
    lines.push(`DRY-RUN: ${m.changes.length} שינויים ב-units.json, ${res.distChanges.length} ב-dist; לא נכתב כלום. ולידציה עברה (${v.checked}).`);
    return res;
  }
  if (unitsChanged) {
    if (existsSync(outPath)) res.backup = backupFile(outPath, now);
    atomicWrite(outPath, nextText);
  }
  for (const p of distToWrite) atomicWrite(p.file, p.text);
  lines.push(
    unitsChanged
      ? `OK: ${outPath} עודכן (${m.changes.length} שינויים)${res.backup ? `, גיבוי: ${basename(res.backup)}` : ''}. ולידציה עברה (${v.checked}, ${m.doc.units.length} דירות).`
      : `OK: אין שינוי ב-units.json (הגיליון זהה לקובץ). ולידציה עברה (${v.checked}, ${m.doc.units.length} דירות).`,
  );
  if (dist) lines.push(distToWrite.length ? `OK: dist עודכן (${distToWrite.map((p) => p.file).join(', ')}); ה-ZIP שבתוכו לא נבנה מחדש.` : 'dist: אין שינוי.');
  return res;
}

// ---------- CLI ----------

export function parseArgs(argv) {
  const a = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const take = () => { const v = argv[++i]; if (v === undefined || v.startsWith('--')) throw new Error(`${k} needs a value`); return v; };
    if (k === '--source') a.source = take();
    else if (k === '--units') a.units = take();
    else if (k === '--out') a.out = take();
    else if (k === '--dist') a.dist = take();
    else if (k === '--dry-run') a.dryRun = true;
    else if (k === '-h' || k === '--help') a.help = true;
    else throw new Error(`unknown argument ${k}`);
  }
  return a;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let args;
  try { args = parseArgs(process.argv.slice(2)); } catch (e) { args = { help: true, err: e.message }; }
  if (args.help) {
    if (args.err) console.error(args.err);
    console.error('שימוש: node build_units.mjs --source <קובץ CSV | קישור CSV מפורסם | קישור JSON של Apps Script> --units <units.json> [--out <נתיב>] [--dist <תיקייה>] [--dry-run]');
    process.exit(2);
  }
  const r = await buildUnits(args);
  for (const l of r.lines) (l.startsWith('FAIL') || r.code ? console.error : console.log)(l);
  process.exit(r.code);
}
