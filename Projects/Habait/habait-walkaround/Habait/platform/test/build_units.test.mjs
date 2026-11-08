// Card 26 (D4): build_units.mjs = status / price / note from a sheet -> units.json; geometry never changes.
//   node test/build_units.test.mjs
// $0 and offline: the sheet is a local CSV / JSON fixture (the shipped _local/units-status.csv is the base),
// URL sources go through an injected fetch, and globalThis.fetch is replaced by a stub that throws, so no
// request can leave the machine. Everything is written to a temp dir under os.tmpdir(); the real
// fixtures/rainbow/units.json, Habait/engine/_local/rainbow/units.json and _local/dist are only read.
// 1. cells: status aliases (English + Hebrew), prices (ILS integers), CSV parsing, JSON shapes, note clause.
// 2. the 846 row of the CSV changes -> the engine's units.json copy (box_world x12, Python indent 1, CRLF, ASCII,
//    id "apt846") gets the new status/price/note; deep diff of everything else = 0; only status/price/note lines
//    differ byte-wise; the backup equals the old file.
// 3. a geometry-rich copy (box_world, outline_world, hotspot polygons/frame/visible_frac, segment_fps) next to
//    flow.json + project.json: insert / replace / clear a note, deep diff = 0, validate.mjs on the dir = OK.
// 4. invalid status / price / duplicate / no header -> Hebrew FAIL, exit 1, file bytes unchanged, no backup.
// 5. unknown unit id -> warning, exit 0. JSON (Apps Script) source. URL source via injected fetch (CSV, JSON,
//    unpublished HTML, plain http, network error). --dist, --out, --dry-run, no-op, backup pruning.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const TOOL = join(ROOT, 'build_units.mjs');
const FIXTURE_DIR = join(ROOT, 'fixtures', 'rainbow');
const CSV_FIXTURE = join(ROOT, '_local', 'units-status.csv');
const ENGINE_UNITS = resolve(ROOT, '..', 'engine', '_local', 'rainbow', 'units.json'); // read only, copied
const REAL_DIST = join(ROOT, '_local', 'dist', 'rainbow', '846', 'apartment.json'); // read only, copied
const TMP = mkdtempSync(join(tmpdir(), 'habait-build-units-'));

// no network in this test, ever
globalThis.fetch = () => { throw new Error('network disabled in build_units.test.mjs'); };

const B = await import('../build_units.mjs');
const { validateSchema, unitsSchema, validateProjectDir } = await import('../contracts/validate.mjs');

let passed = 0;
let failures = 0;
const step = async (name, fn) => {
  try { const note = await fn(); passed++; console.log('ok   ' + name + (note ? `  (${note})` : '')); } catch (e) { failures++; console.log('FAIL ' + name + '\n     ' + String(e.stack || e.message || e).split('\n').slice(0, 4).join('\n     ')); }
};

const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const readJ = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
const run = (...args) => {
  const r = spawnSync(process.execPath, [TOOL, ...args], { cwd: ROOT, encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
};
const backups = (file) => readdirSync(dirname(file)).filter((f) => f.startsWith(`${file.split(/[\\/]/).pop()}.bak-`));
const dir = (name) => { const d = join(TMP, name); mkdirSync(d, { recursive: true }); return d; };
const csvFixture = () => readFileSync(CSV_FIXTURE, 'utf8');
/** the shipped CSV with one unit's row replaced */
const csvWith = (unit, row) => {
  const lines = csvFixture().split(/\r?\n/);
  const i = lines.findIndex((l) => l.replace(/^﻿/, '').startsWith(`${unit},`));
  assert.ok(i > 0, `row ${unit} in ${CSV_FIXTURE}`);
  lines[i] = row;
  return lines.join('\r\n');
};

// everything but status / price / note, key order included
const stripMerge = (doc) => { const d = structuredClone(doc); for (const u of d.units) { delete u.status; delete u.price; delete u.note; } return d; };
function deepDiff(a, b, path = '$', out = []) {
  if (Array.isArray(a) !== Array.isArray(b) || typeof a !== typeof b || (a === null) !== (b === null)) { out.push(path); return out; }
  if (a && typeof a === 'object') {
    if (Array.isArray(a) && a.length !== b.length) out.push(`${path}.length`);
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!(k in a) || !(k in b)) out.push(`${path}.${k}`);
      else deepDiff(a[k], b[k], `${path}.${k}`, out);
    }
    return out;
  }
  if (!Object.is(a, b)) out.push(path);
  return out;
}
function assertGeometryKept(before, after) {
  const d = deepDiff(stripMerge(before), stripMerge(after));
  assert.deepEqual(d, [], `fields other than status/price/note changed: ${d.slice(0, 5).join(', ')}`);
  assert.equal(JSON.stringify(stripMerge(after)), JSON.stringify(stripMerge(before)), 'key order kept');
}
/** line-level byte check for same-line-count edits: every differing line is a status / price / note line */
function changedLines(beforeText, afterText, keys = ['status', 'price', 'note']) {
  const a = beforeText.split('\n');
  const b = afterText.split('\n');
  assert.equal(b.length, a.length, 'same number of lines');
  const re = new RegExp(`^\\s*"(${keys.join('|')})"\\s*:`);
  const diff = a.map((l, i) => [l, b[i], i + 1]).filter(([x, y]) => x !== y);
  for (const [, y, n] of diff) assert.match(y, re, `line ${n} changed but is not ${keys.join('/')}: ${y.slice(0, 80)}`);
  return diff.length;
}

// a geometry-rich project dir: the fixture + box_world, outline_world, hotspot polygons, segment_fps; flow.json and
// project.json next to it (with empty placeholder media so validate.mjs's cross-check can run in the temp dir)
function makeGeoProject(name) {
  const d = dir(name);
  const units = readJ(join(FIXTURE_DIR, 'units.json'));
  units.segment_fps = { 'hold-facade': 24 };
  units.price_note += ' · מחירי דמה'; // a UTF-8 file (the engine copy in section 2 covers the pure-ASCII one)
  units.units.forEach((u, i) => {
    u.box_world = [0.738 + i, -16.031 - i, (u.floor - 16) * 3.2, 14.431 + i, -0.378 - i, (u.floor - 16) * 3.2 + 2.9];
    u.outline_world = { polygon: [[0.7 + i, -16], [14.4 + i, -16], [14.4 + i, -0.4], [0.7 + i, -0.4], [0.7 + i, -8.123456789]], z0: u.box_world[2], z1: u.box_world[5], source: 'test-synthetic' };
    for (const h of u.hotspots) {
      h.frame = 1;
      h.visible_frac = 0.4375;
      h.in_view_hint = true;
      h.polygon = [[h.yaw_deg - 2, h.pitch_deg - 1], [h.yaw_deg + 2, h.pitch_deg - 1], [h.yaw_deg, h.pitch_deg + 1.5]];
      h.polygons = [h.polygon, [[179, 1], [180, 1], [179.5, 2]]];
    }
  });
  assert.deepEqual(validateSchema(unitsSchema, units), [], 'the synthetic geometry-rich units.json is itself valid');
  writeFileSync(join(d, 'units.json'), JSON.stringify(units, null, 2) + '\n');
  for (const f of ['flow.json', 'project.json']) copyFileSync(join(FIXTURE_DIR, f), join(d, f));
  for (const s of readJ(join(d, 'flow.json')).segments) {
    for (const p of [s.src, s.poster].filter(Boolean)) { mkdirSync(dirname(join(d, p)), { recursive: true }); if (!existsSync(join(d, p))) writeFileSync(join(d, p), ''); }
  }
  return d;
}

let bboxPhrase = false; // 846 status updated + every box_world identical (engine copy, or the geometry-rich copy)
let invalidPhrase = false;
let bboxCount = 0;

try {
  // ---------------- 1. cells ----------------
  await step('status aliases: English + Hebrew -> the units.v0 enum; anything else -> null', () => {
    const want = {
      available: 'for-sale', Available: 'for-sale', ' AVAILABLE ': 'for-sale', 'for-sale': 'for-sale', 'for sale': 'for-sale',
      'פנוי': 'for-sale', 'פנויה': 'for-sale', 'למכירה': 'for-sale', 'פָּנוּי': 'for-sale',
      reserved: 'reserved', 'שמור': 'reserved', 'שמורה': 'reserved',
      sold: 'sold', Sold: 'sold', 'נמכר': 'sold', 'נמכרה': 'sold', unknown: 'unknown',
    };
    for (const [k, v] of Object.entries(want)) assert.equal(B.normalizeStatus(k), v, k);
    for (const bad of ['maybe', 'sold out', 'פנוי?', '', 'x', '1']) assert.equal(B.normalizeStatus(bad), null, bad);
    assert.deepEqual([...B.SCHEMA_STATUSES].sort(), ['for-sale', 'reserved', 'sold', 'unknown'], 'the schema enum is the existing one (no schema change)');
    return `${Object.keys(want).length} aliases`;
  });
  await step('prices: integer ILS from sheet formats; bad values rejected', () => {
    const ok = { '7950000': 7950000, '7,950,000': 7950000, '₪7,950,000.00': 7950000, '7 950 000': 7950000, "7'950'000": 7950000, '8100000 ש"ח': 8100000, '0': 0, 'לפי בקשה': 0, '7950000.6': 7950001 };
    for (const [k, v] of Object.entries(ok)) assert.deepEqual(B.parsePrice(k), { ok: true, value: v }, k);
    assert.deepEqual(B.parsePrice(7950000), { ok: true, value: 7950000 });
    for (const bad of ['abc', '-5', '7.95M', '1e6', '₪', '']) assert.equal(B.parsePrice(bad).ok, false, bad);
    return `${Object.keys(ok).length} formats`;
  });
  await step('CSV: BOM, CRLF, quotes, commas/newlines inside quotes, Hebrew headers, title row, extra columns', () => {
    const t = B.parseCsv('﻿a,"b,c","d ""q"""\r\n1,"two\nlines",3\r\n');
    assert.deepEqual(t.map((r) => r.cells), [['a', 'b,c', 'd "q"'], ['1', 'two\nlines', '3']]);
    const rows = B.rowsFromTable(B.parseCsv('סטטוס דירות Rainbow\n\nמחיר (₪),דירה,עדכון אחרון,סטטוס,הערות\n"7,950,000",846,1.11,נמכרה,"שלום, עולם"\n# comment,,,,\n'));
    assert.deepEqual(rows.map(({ unit, status, price, note }) => ({ unit, status, price, note })), [{ unit: '846', status: 'נמכרה', price: '7,950,000', note: 'שלום, עולם' }]);
    assert.throws(() => B.rowsFromTable(B.parseCsv('foo,bar\n1,2\n')), /unit, status, price, note/);
    assert.throws(() => B.parseCsv('unit,status\n846,"open'), /מרכאה/);
    return 'title row skipped, columns by name';
  });
  await step('JSON (Apps Script) shapes: rows[], values[][], bare array; ok:false is an error', () => {
    const want = [{ unit: '846', status: 'sold', price: 8100000, note: '' }];
    const pick = (rs) => rs.map(({ unit, status, price, note }) => ({ unit, status, price, note }));
    assert.deepEqual(pick(B.rowsFromJson({ ok: true, rows: [{ unit: 846, status: 'sold', price: 8100000 }] })), want);
    assert.deepEqual(pick(B.rowsFromJson([{ 'דירה': '846', 'סטטוס': 'sold', 'מחיר': 8100000 }])), want);
    assert.deepEqual(pick(B.rowsFromJson({ ok: true, values: [['unit', 'status', 'price', 'note'], [846, 'sold', 8100000, '']] })).map((r) => ({ ...r, price: Number(r.price) })), want);
    assert.throws(() => B.rowsFromJson({ ok: false, error: 'bad' }), /Apps Script/);
    assert.throws(() => B.rowsFromJson({ hello: 1 }), /JSON/);
  });
  await step('note: the machine "box_source: ...;" clause is recognised', () => {
    assert.deepEqual(B.splitNote('box_source: stacked-approx (a, b: c); price 0 = on request'), { machine: 'box_source: stacked-approx (a, b: c); ', human: 'price 0 = on request' });
    assert.deepEqual(B.splitNote('just a note'), { machine: '', human: 'just a note' });
    assert.deepEqual(B.splitNote(undefined), { machine: '', human: '' });
  });

  // ---------------- 2. the 846 row changes -> the engine units.json (copy) ----------------
  await step('the shipped CSV fixture parses: 12 rows, Hebrew statuses, in sync with fixtures/rainbow/units.json', async () => {
    const { rows } = await B.loadSource(CSV_FIXTURE);
    assert.equal(rows.length, 12);
    const fx = readJ(join(FIXTURE_DIR, 'units.json'));
    for (const r of rows) {
      const u = fx.units.find((x) => x.id === r.unit);
      assert.ok(u, `unit ${r.unit} exists in the fixture`);
      assert.equal(B.normalizeStatus(r.status), u.status, `status of ${r.unit}`);
      assert.equal(B.parsePrice(r.price).value, u.price, `price of ${r.unit}`);
    }
    return rows.map((r) => r.status).filter((s, i, a) => a.indexOf(s) === i).join('/');
  });

  const eng = dir('engine');
  const engUnits = join(eng, 'units.json');
  const engSource = existsSync(ENGINE_UNITS) ? ENGINE_UNITS : null;
  await step('846 row changed in the CSV -> engine units.json copy: status/price/note updated, geometry byte-for-byte', () => {
    if (!engSource) return 'SKIPPED: Habait/engine/_local/rainbow/units.json not on this machine (section 3 covers geometry)';
    copyFileSync(engSource, engUnits);
    const beforeText = readFileSync(engUnits, 'utf8');
    const before = JSON.parse(beforeText);
    const csv = join(eng, 'status.csv');
    writeFileSync(csv, csvWith('846', '846,נמכר,"₪8,100,000",נמכרה ביום הפתיחה'));
    const r = run('--source', csv, '--units', engUnits);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /846 → apt846: סטטוס for-sale → sold/);
    const afterText = readFileSync(engUnits, 'utf8');
    const after = JSON.parse(afterText);
    const u = after.units.find((x) => x.id === 'apt846');
    assert.equal(u.status, 'sold');
    assert.equal(u.price, 8100000);
    assert.equal(u.note, 'נמכרה ביום הפתיחה');
    assertGeometryKept(before, after);
    bboxCount = after.units.filter((x, i) => Array.isArray(x.box_world) && JSON.stringify(x.box_world) === JSON.stringify(before.units[i].box_world)).length;
    assert.equal(bboxCount, before.units.filter((x) => x.box_world).length, 'every box_world identical');
    const nLines = changedLines(beforeText, afterText);
    assert.equal(nLines, 3, 'exactly 3 lines differ (status, price, note of apt846)');
    assert.ok(!/[^\x00-\x7f]/.test(afterText), 'an ASCII file stays ASCII (Hebrew note as \\u escapes)');
    assert.equal(afterText.includes('\r\n'), beforeText.includes('\r\n'), 'line endings kept');
    assert.deepEqual(validateSchema(unitsSchema, after), [], 'units.v0 schema');
    const bk = backups(engUnits);
    assert.equal(bk.length, 1, 'one backup');
    assert.equal(sha(join(eng, bk[0])), sha(engSource), 'the backup equals the previous file');
    // other units of the engine file had the same status/price as the fixture CSV: nothing else changed
    for (const x of after.units) if (x.id !== 'apt846') assert.deepEqual(x, before.units.find((y) => y.id === x.id), `unit ${x.id} untouched`);
    bboxPhrase = true;
    return `box_world ${bboxCount}/${after.units.length} identical, ${nLines} lines differ, backup ${bk[0]}`;
  });
  await step('a sheet note keeps the machine box_source clause of a stacked unit', () => {
    if (!engSource) return 'SKIPPED (no engine file)';
    const before = readJ(engUnits);
    const csv = join(eng, 'note.csv');
    writeFileSync(csv, 'unit,status,price,note\n845,,,"חזית צפונית, קומה 16"\n');
    const r = run('--source', csv, '--units', engUnits);
    assert.equal(r.code, 0, r.out);
    const after = readJ(engUnits);
    const u = after.units.find((x) => x.id === '845');
    const was = before.units.find((x) => x.id === '845');
    assert.ok(u.note.startsWith(B.splitNote(was.note).machine) && B.splitNote(was.note).machine.length > 10, 'clause kept');
    assert.ok(u.note.endsWith('חזית צפונית, קומה 16'));
    assert.equal(u.status, was.status, 'empty status cell keeps the status');
    assert.equal(u.price, was.price, 'empty price cell keeps the price');
    assertGeometryKept(before, after);
  });

  // ---------------- 3. geometry-rich copy + flow cross-check ----------------
  const geo = makeGeoProject('geo');
  const geoUnits = join(geo, 'units.json');
  await step('geometry-rich units.json (box_world, outline_world, polygons): replace + insert + clear a note, deep diff 0, validate.mjs OK', () => {
    const beforeText = readFileSync(geoUnits, 'utf8');
    const before = JSON.parse(beforeText);
    const csv = join(geo, 's.csv');
    let text = csvWith('846', '846,שמור,7990000,-');
    text = text.replace(/^845,.*$/m, '845,נמכר,6200000,נמכרה בטלפון');
    text = text.replace(/^876,.*$/m, '876,פנוי,לפי בקשה,');
    writeFileSync(csv, text);
    const r = run('--source', csv, '--units', geoUnits);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /flow cross-check/);
    const after = readJ(geoUnits);
    const u846 = after.units.find((x) => x.id === '846');
    assert.equal(u846.status, 'reserved');
    assert.equal(u846.price, 7990000);
    assert.ok(!('note' in u846), '"-" cleared the note');
    assert.equal(after.units.find((x) => x.id === '845').note, 'נמכרה בטלפון', 'note inserted where there was none');
    assert.equal(after.units.find((x) => x.id === '876').price, 0);
    assertGeometryKept(before, after);
    for (const [i, x] of after.units.entries()) {
      assert.deepEqual(x.outline_world, before.units[i].outline_world);
      assert.deepEqual(x.hotspots, before.units[i].hotspots);
    }
    const v = validateProjectDir(geo);
    assert.deepEqual(v.errors, [], 'validate.mjs on the project dir');
    const afterText = readFileSync(geoUnits, 'utf8');
    assert.ok(afterText.includes('"note": "נמכרה בטלפון"'), 'a UTF-8 file keeps raw UTF-8');
    bboxPhrase = true;
    const polys = after.units.reduce((n, x) => n + x.hotspots.reduce((m, h) => m + h.polygons.length, 0), 0);
    return `${after.units.length} outlines + ${polys} polygons identical; validate.mjs ${v.units.units.length} units, ${v.flow.segments.length} segments, 0 errors`;
  });

  // ---------------- 4. failures leave the file untouched ----------------
  await step('invalid status -> Hebrew FAIL, exit 1, units.json bytes unchanged, no backup', () => {
    const before = sha(geoUnits);
    const nb = backups(geoUnits).length;
    const csv = join(geo, 'bad-status.csv');
    writeFileSync(csv, csvWith('846', '846,maybe-later,7950000,'));
    const r = run('--source', csv, '--units', geoUnits);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /FAIL: סטטוס לא מוכר "maybe-later" בשורה 2 \(דירה 846\)\. מותר: פנוי \/ שמור \/ נמכר/);
    assert.match(r.out, /units\.json לא השתנה/);
    assert.equal(sha(geoUnits), before, 'file untouched');
    assert.equal(backups(geoUnits).length, nb, 'no backup written');
    invalidPhrase = true;
    return r.out.split('\n').find((l) => l.startsWith('FAIL'));
  });
  await step('all bad cells are reported at once (status + price), nothing written', () => {
    const before = sha(geoUnits);
    const csv = join(geo, 'bad-two.csv');
    writeFileSync(csv, csvWith('846', '846,פנוי?,שבעה מיליון,').replace(/^845,.*$/m, '845,נמכר,-5,'));
    const r = run('--source', csv, '--units', geoUnits);
    assert.equal(r.code, 1, r.out);
    assert.equal((r.out.match(/^FAIL:/gm) || []).length, 3, r.out);
    assert.match(r.out, /מחיר לא תקין "שבעה מיליון"/);
    assert.match(r.out, /מחיר לא תקין "-5"/);
    assert.equal(sha(geoUnits), before);
  });
  await step('duplicate unit row / no header / missing source -> FAIL exit 1; no --units -> usage exit 2', () => {
    const before = sha(geoUnits);
    const dup = join(geo, 'dup.csv');
    writeFileSync(dup, 'unit,status\n846,sold\n846,reserved\n');
    let r = run('--source', dup, '--units', geoUnits);
    assert.equal(r.code, 1); assert.match(r.out, /דירה 846 מופיעה פעמיים בגיליון \(שורות 2 ו-3\)/);
    const nohead = join(geo, 'nohead.csv');
    writeFileSync(nohead, '846,sold\n');
    r = run('--source', nohead, '--units', geoUnits);
    assert.equal(r.code, 1); assert.match(r.out, /חייבות להיות העמודות unit, status, price, note/);
    r = run('--source', join(geo, 'nope.csv'), '--units', geoUnits);
    assert.equal(r.code, 1); assert.match(r.out, /קובץ המקור לא נמצא/);
    r = run('--source', dup);
    assert.equal(r.code, 2); assert.match(r.out, /שימוש:/);
    assert.equal(sha(geoUnits), before);
  });
  await step('an invalid units.json (fails the schema before the merge) is refused, not written', () => {
    const d = dir('invalid');
    const doc = readJ(join(FIXTURE_DIR, 'units.json'));
    doc.units[1].rooms = 0;
    writeFileSync(join(d, 'units.json'), JSON.stringify(doc, null, 2));
    const before = sha(join(d, 'units.json'));
    const r = run('--source', CSV_FIXTURE, '--units', join(d, 'units.json'));
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /לא עובר ולידציה.*הקובץ לא היה תקין גם לפני המיזוג/);
    assert.equal(sha(join(d, 'units.json')), before);
  });

  // ---------------- 5. warnings, sources, dist, out, dry-run, no-op, backups ----------------
  await step('unknown unit id in the sheet -> warning, exit 0, the other rows applied', () => {
    const csv = join(geo, 'unknown.csv');
    writeFileSync(csv, 'unit,status,price,note\n999,נמכר,1000000,\n856,שמור,,\n');
    const r = run('--source', csv, '--units', geoUnits);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /אזהרה: דירה 999 \(שורה 2\) לא קיימת ב-units\.json; דילגתי עליה/);
    assert.equal(readJ(geoUnits).units.find((x) => x.id === '856').status, 'reserved');
  });
  await step('Apps Script JSON source (local .json mock) -> applied', () => {
    const j = join(geo, 'sheet.json');
    writeFileSync(j, JSON.stringify({ ok: true, values: [['unit', 'status', 'price', 'note'], ['856', 'available', '8,050,000', '']] }));
    const r = run('--source', j, '--units', geoUnits);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /\(JSON, 1 שורות\)/);
    assert.equal(readJ(geoUnits).units.find((x) => x.id === '856').status, 'for-sale');
  });
  await step('URL sources through an injected fetch (no network): published CSV, Apps Script JSON, unpublished HTML, http, network error', async () => {
    const calls = [];
    const fake = (body, type, status = 200) => async (url) => {
      calls.push(url);
      return { ok: status < 400, status, headers: { get: (h) => (h.toLowerCase() === 'content-type' ? type : null) }, text: async () => body };
    };
    const pub = 'https://docs.google.com/spreadsheets/d/e/2PACX-test/pub?gid=0&single=true&output=csv';
    let r = await B.buildUnits({ source: pub, units: geoUnits, dryRun: true, fetchImpl: fake('unit,status,price,note\r\n846,נמכר,8000000,\r\n', 'text/csv; charset=utf-8') });
    assert.equal(r.code, 0, r.lines.join('\n'));
    assert.ok(r.changes.some((c) => /846: סטטוס reserved → sold/.test(c)), r.changes.join('; '));
    const exec = 'https://script.google.com/macros/s/AKfy-test/exec?units=1';
    r = await B.buildUnits({ source: exec, units: geoUnits, dryRun: true, fetchImpl: fake(JSON.stringify({ ok: true, rows: [{ unit: '846', status: 'פנוי', price: 7950000 }] }), 'application/json') });
    assert.equal(r.code, 0, r.lines.join('\n'));
    assert.ok(r.changes.some((c) => /846: סטטוס reserved → for-sale/.test(c)));
    r = await B.buildUnits({ source: pub, units: geoUnits, fetchImpl: fake('<!DOCTYPE html><html>sign in</html>', 'text/html') });
    assert.equal(r.code, 1); assert.match(r.lines.join('\n'), /הגיליון לא פורסם/);
    r = await B.buildUnits({ source: 'http://example.com/x.csv', units: geoUnits, fetchImpl: fake('', 'text/csv') });
    assert.equal(r.code, 1); assert.match(r.lines.join('\n'), /רק קישורי https/);
    r = await B.buildUnits({ source: pub, units: geoUnits, fetchImpl: async () => { throw new Error('ENOTFOUND'); } });
    assert.equal(r.code, 1); assert.match(r.lines.join('\n'), /לא הצלחתי למשוך את הגיליון/);
    r = await B.buildUnits({ source: pub, units: geoUnits, fetchImpl: fake('nope', 'text/plain', 404) });
    assert.equal(r.code, 1); assert.match(r.lines.join('\n'), /HTTP 404/);
    assert.equal(calls.length, 4, 'only the injected fetch was called');
    return 'dry-run; 0 real requests';
  });
  await step('--dist: apartment.json gets unit.status + unit.price only (note, legal, everything else unchanged)', () => {
    const dd = dir('dist');
    const apt = join(dd, '846', 'apartment.json');
    mkdirSync(dirname(apt), { recursive: true });
    if (existsSync(REAL_DIST)) copyFileSync(REAL_DIST, apt);
    else writeFileSync(apt, JSON.stringify({ schema: 'habait.apartment-page.v0', unit: { ...readJ(join(FIXTURE_DIR, 'units.json')).units[0], currency: 'ILS' }, legal: { status: 'DRAFT v0' } }, null, 2));
    const beforeText = readFileSync(apt, 'utf8');
    const before = JSON.parse(beforeText);
    const csv = join(geo, 'dist.csv');
    writeFileSync(csv, 'unit,status,price,note\n846,נמכר,8250000,הערה שלא נכנסת ל-dist\n');
    const r = run('--source', csv, '--units', geoUnits, '--dist', dd);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /OK: dist עודכן/);
    const afterText = readFileSync(apt, 'utf8');
    const after = JSON.parse(afterText);
    assert.equal(after.unit.status, 'sold');
    assert.equal(after.unit.price, 8250000);
    const strip = (d) => { const c = structuredClone(d); delete c.unit.status; delete c.unit.price; return c; };
    assert.deepEqual(deepDiff(strip(before), strip(after)), [], 'nothing else in apartment.json changed');
    assert.equal(after.unit.note, before.unit.note, 'unit.note is not a dist field');
    const n = changedLines(beforeText, afterText, ['status', 'price']);
    assert.ok(n <= 2 && n >= 1);
    assert.equal(readdirSync(dirname(apt)).length, 1, 'no backup / temp file left in the dist folder');
    return `${existsSync(REAL_DIST) ? 'copy of _local/dist/rainbow/846' : 'synthetic'}; ${n} lines differ`;
  });
  await step('no-op: the shipped CSV against a fixture copy -> exit 0, "אין שינוי", no backup, bytes unchanged', () => {
    const d = dir('noop');
    copyFileSync(join(FIXTURE_DIR, 'units.json'), join(d, 'units.json'));
    const before = sha(join(d, 'units.json'));
    const r = run('--source', CSV_FIXTURE, '--units', join(d, 'units.json'));
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /אין שינוי ב-units\.json/);
    assert.equal(sha(join(d, 'units.json')), before);
    assert.equal(backups(join(d, 'units.json')).length, 0);
  });
  await step('--out writes elsewhere (input untouched); --dry-run writes nothing', () => {
    const d = dir('out');
    copyFileSync(join(FIXTURE_DIR, 'units.json'), join(d, 'units.json'));
    const before = sha(join(d, 'units.json'));
    const csv = join(d, 's.csv');
    writeFileSync(csv, csvWith('846', '846,sold,,'));
    let r = run('--source', csv, '--units', join(d, 'units.json'), '--dry-run');
    assert.equal(r.code, 0, r.out); assert.match(r.out, /DRY-RUN: 1 שינויים/);
    assert.equal(sha(join(d, 'units.json')), before);
    r = run('--source', csv, '--units', join(d, 'units.json'), '--out', join(d, 'next.json'));
    assert.equal(r.code, 0, r.out);
    assert.equal(sha(join(d, 'units.json')), before, 'input untouched');
    assert.equal(readJ(join(d, 'next.json')).units[0].status, 'sold');
    assertGeometryKept(readJ(join(d, 'units.json')), readJ(join(d, 'next.json')));
  });
  await step('backups: one per write, named <file>.bak-<YYYYMMDD-HHMMSS>, the newest 10 kept', async () => {
    const d = dir('bak');
    const f = join(d, 'units.json');
    copyFileSync(join(FIXTURE_DIR, 'units.json'), f);
    const csvA = join(d, 'a.csv');
    const csvB = join(d, 'b.csv');
    writeFileSync(csvA, 'unit,status\n846,sold\n');
    writeFileSync(csvB, 'unit,status\n846,available\n');
    for (let k = 0; k < 13; k++) {
      const r = await B.buildUnits({ source: k % 2 ? csvB : csvA, units: f, now: new Date(2026, 10, 2, 18, 0, k) });
      assert.equal(r.code, 0, r.lines.join('\n'));
      assert.match(r.backup, /units\.json\.bak-20261102-1800\d\d$/);
    }
    const list = backups(f).sort();
    assert.equal(list.length, 10);
    assert.equal(list[0], 'units.json.bak-20261102-180003', 'the oldest 3 pruned');
    return `${list.length} kept`;
  });
} catch (e) {
  failures++;
  console.log('FAIL test harness\n     ' + String(e.stack || e).split('\n').slice(0, 4).join('\n     '));
} finally {
  if (!process.env.KEEP_BUILD_UNITS_TMP) rmSync(TMP, { recursive: true, force: true });
}

console.log(`build_units test: ${passed}/${passed + failures} ok${failures ? `, ${failures} FAILED` : ''}${process.env.KEEP_BUILD_UNITS_TMP ? `  (tmp: ${TMP})` : ''}`);
if (!failures && bboxPhrase && invalidPhrase) console.log('846 status updated; bbox unchanged; invalid status rejected');
else if (!failures) console.log(`incomplete: bbox ${bboxPhrase ? 'ok' : 'missing'}, invalid status ${invalidPhrase ? 'ok' : 'missing'}`);
process.exit(failures || !bboxPhrase || !invalidPhrase ? 1 : 0);
