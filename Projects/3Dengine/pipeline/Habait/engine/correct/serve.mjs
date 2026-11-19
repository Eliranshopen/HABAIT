#!/usr/bin/env node
// serve.mjs - the local server of the intake correction screen (card 02, A2). Zero dependencies, no network.
//
//   node Habait/engine/correct/serve.mjs --plan <plan.json> [--report <report.json>] [--image <plan.png>]
//        [--out <dir>] [--port 8870] [--validator <validate-plan.mjs>] [--selftest]
//
// Defaults: --report = <plan dir>/report.json if it exists; --image = report.raster.image (relative to the
// report) else <plan dir>/plan-crop.png; --out = Habait/engine/correct/_local/<apartment_id>/.
// The input plan is never overwritten. "אשר" writes <out>/plan.json (only if validate-plan passes and no
// field was deleted or reshaped) and <out>/corrections.json (always: every action is training data);
// a failing save writes <out>/plan.draft.json instead of plan.json.
//
// --selftest: starts the server on a free port with a temp --out, loads the session through the API,
// moves one corner, renames a room, deletes and re-adds a door, resizes it, saves through the API,
// re-runs validate-plan on the saved file, checks corrections.json replays to the saved plan.
// Prints "selftest OK" and exits 0, else "selftest FAIL" and exits 1.

import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, mkdtempSync, unlinkSync } from 'node:fs';
import { dirname, resolve, join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import * as core from './correct.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');
const DISCLAIMER = 'C:/RnD/Projects/Habait/data/sales-plans/legal/disclaimer-he-en.md';

// ------------------------------------------------------------------ args --
function parseArgs(argv) {
  const a = { port: 8870, host: '127.0.0.1' };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = () => { const x = argv[++i]; if (x === undefined) usage(`${k} needs a value`); return x; };
    if (k === '--plan') a.plan = v();
    else if (k === '--report') a.report = v();
    else if (k === '--image') a.image = v();
    else if (k === '--out') a.out = v();
    else if (k === '--port') a.port = +v();
    else if (k === '--host') a.host = v();
    else if (k === '--validator') a.validator = v();
    else if (k === '--title') a.title = v();
    else if (k === '--selftest') a.selftest = true;
    else if (k === '-h' || k === '--help') usage();
    else usage(`unknown argument ${k}`);
  }
  if (!a.plan) usage('--plan is required');
  return a;
}
function usage(msg) {
  if (msg) console.error(`serve.mjs: ${msg}`);
  console.error('usage: node serve.mjs --plan <plan.json> [--report <report.json>] [--image <png>] [--out <dir>] [--port N] [--validator <validate-plan.mjs>] [--selftest]');
  process.exit(2);
}

// --------------------------------------------------------------- session --
function pngSize(file) {
  const b = readFileSync(file);
  if (b.readUInt32BE(0) !== 0x89504e47 || b.toString('ascii', 12, 16) !== 'IHDR') throw new Error(`${file} is not a PNG`);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

function shortCaption(report, plan) {
  // The short Hebrew line of the standard disclaimer (section 1), variables from the report.
  try {
    const md = readFileSync(DISCLAIMER, 'utf8');
    const sec = md.split(/^## /m).find((s) => s.startsWith('1.'));
    const he = sec.split('**עברית**')[1].split('\n').find((l) => l.startsWith('> ')).slice(2).trim();
    const src = report?.source || {};
    return he.replace('{UNIT}', src.unit || plan.apartment_id).replace('{PROJECT}', src.project_he || src.project || '—')
      .replace('{PLAN_DATE}', src.plan_date || plan.plan_meta?.trace_date || '—');
  } catch { return 'הדמיה להמחשה בלבד. המסמכים המחייבים הם המפרט והתכניות החתומים.'; }
}

export function loadSession(args) {
  const planPath = resolve(args.plan);
  if (!existsSync(planPath)) throw new Error(`plan not found: ${planPath}`);
  const planBuf = readFileSync(planPath);
  const plan = JSON.parse(planBuf.toString('utf8'));
  let reportPath = args.report ? resolve(args.report) : join(dirname(planPath), 'report.json');
  if (!existsSync(reportPath)) { if (args.report) throw new Error(`report not found: ${reportPath}`); reportPath = null; }
  const report = reportPath ? JSON.parse(readFileSync(reportPath, 'utf8')) : null;
  let imagePath = args.image ? resolve(args.image)
    : report?.raster?.image ? resolve(dirname(reportPath), report.raster.image)
    : join(dirname(planPath), 'plan-crop.png');
  if (!existsSync(imagePath)) throw new Error(`plan image not found: ${imagePath} (pass --image)`);
  const out = resolve(args.out || join(HERE, '_local', plan.apartment_id || 'plan'));
  const validator = resolve(args.validator || join(REPO, '360walkaround/pipeline/validate-plan.mjs'));
  if (!existsSync(validator)) throw new Error(`validator not found: ${validator}`);
  return {
    planPath, reportPath, imagePath, out, validator, plan, report,
    plan_sha256: sha256(planBuf), image: pngSize(imagePath),
    title_he: args.title || report?.title_he || null, caption_he: shortCaption(report, plan),
  };
}

// ------------------------------------------------------------ validation --
export function runValidator(validator, file) {
  const r = spawnSync(process.execPath, [validator, file, '--json'], { encoding: 'utf8' });
  let j = null;
  try { j = JSON.parse(r.stdout); } catch { /* not JSON */ }
  return { code: r.status, ok: r.status === 0, fails: j?.fails || (r.status === 0 ? [] : [String(r.stderr || r.stdout).trim()]), warns: j?.warns || [] };
}
// Validator messages -> Hebrew for Eliran (the raw text stays under "פרטים").
function problemsHe(fails, shape, plan) {
  const nm = (id) => plan.rooms.find((r) => r.id === id)?.name_he || id;
  const out = [];
  for (const f of fails) {
    let m;
    if ((m = /rooms (\S+) and (\S+) overlap by ([\d.]+) m2/.exec(f))) out.push({ room: m[1], text: `"${nm(m[1])}" ו"${nm(m[2])}" נכנסים זה בזה (${m[3]} מ"ר). צריך להזיז פינה.` });
    else if ((m = /rooms\[([^\]]+)\]: loop self-intersects/.exec(f))) out.push({ room: m[1], text: `הצורה של "${nm(m[1])}" חוצה את עצמה. צריך להזיז פינה בחזרה.` });
    else if ((m = /rooms\[([^\]]+)\]: loop must be positively oriented/.exec(f))) out.push({ room: m[1], text: `הצורה של "${nm(m[1])}" התהפכה. צריך להזיז פינה בחזרה.` });
    else if ((m = /rooms\[([^\]]+)\]: the bbox .* printed/.exec(f))) out.push({ room: m[1], text: `המידות של "${nm(m[1])}" רחוקות מהשרטוט ביותר מ-5%.` });
    else if ((m = /openings\[([^\]]+)\]/.exec(f))) {
      const o = plan.openings.find((x) => x.id === m[1]);
      out.push({ room: o?.rooms?.find((x) => x !== 'outside') || '', text: `יש בעיה בפתח (${core.OPENING_KINDS[o?.kind]?.he || 'פתח'}) של "${nm(o?.rooms?.[0])}". אפשר למחוק ולהוסיף מחדש.` });
    } else if ((m = /camera_points\[[^\]]+\]: .* not inside (\S+)/.exec(f))) out.push({ room: m[1], text: `החדר "${nm(m[1])}" קטן מדי אחרי התיקון.` });
    else out.push({ room: '', text: 'בדיקה אוטומטית נכשלה (פרטים למטה).' });
  }
  if (shape.length) out.push({ room: '', text: 'תקלה פנימית בשמירה (שדה נמחק). לא נשמר; לדווח למפתח.' });
  return out;
}

export function save(session, body) {
  const plan = body.plan;
  const corrections = Array.isArray(body.corrections) ? body.corrections : [];
  const bad = corrections.filter((c) => !core.OP_TYPES.includes(c?.type) || typeof c.target !== 'string' || !c.t);
  const auto = core.finalizePlan(session.plan, plan);
  const shape = core.shapeDiff(session.plan, plan);
  if (bad.length) shape.push(`${bad.length} corrections without type/target/t`);
  mkdirSync(session.out, { recursive: true });
  const check = join(session.out, '.plan.check.json');
  writeFileSync(check, JSON.stringify(plan, null, 1));
  const v = runValidator(session.validator, check);
  unlinkSync(check);
  const ok = v.ok && !shape.length;
  const files = [];
  const all = [...corrections, ...auto];
  const wr = (name, data) => { const f = join(session.out, name); writeFileSync(f, typeof data === 'string' ? data : JSON.stringify(data, null, 1) + '\n'); files.push(f); };
  wr('corrections.json', all);
  if (ok) { wr('plan.json', plan); const d = join(session.out, 'plan.draft.json'); if (existsSync(d)) unlinkSync(d); }
  else wr('plan.draft.json', plan);
  wr('session.json', {
    input_plan: session.planPath, input_plan_sha256: session.plan_sha256, report: session.reportPath, image: session.imagePath,
    saved_at: new Date().toISOString(), elapsed_s: body.elapsed_s ?? null, ok,
    corrections: all.length, live_corrections: all.filter((c) => !c.undone).length,
    issues_left: core.computeIssues(plan, session.report).map((x) => x.text),
    validator: { ok: v.ok, fails: v.fails.length, warns: v.warns.length }, shape_problems: shape,
  });
  return { ok, files, fails: v.fails, warns: v.warns, shape, auto, problems_he: ok ? [] : problemsHe(v.fails, shape, plan) };
}

// ---------------------------------------------------------------- server --
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' };
export function makeServer(session) {
  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const send = (code, type, data) => { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' }); res.end(data); };
    const json = (code, obj) => send(code, 'application/json; charset=utf-8', JSON.stringify(obj));
    try {
      if (req.method === 'GET' && ['/', '/index.html', '/correct.js', '/correct.css'].includes(url.pathname)) {
        const f = join(HERE, url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
        return send(200, MIME[extname(f)], readFileSync(f));
      }
      if (req.method === 'GET' && url.pathname === '/plan-image') return send(200, 'image/png', readFileSync(session.imagePath));
      if (req.method === 'GET' && url.pathname === '/api/session') {
        const rel = (p) => (p ? relative(process.cwd(), p) || p : null);
        return json(200, {
          plan: session.plan, report: session.report, image: session.image, plan_sha256: session.plan_sha256,
          title_he: session.title_he, caption_he: session.caption_he,
          paths: { plan: rel(session.planPath), report: rel(session.reportPath), image: rel(session.imagePath), out: rel(session.out) },
        });
      }
      if (req.method === 'POST' && url.pathname === '/api/save') {
        let raw = ''; for await (const c of req) raw += c;
        return json(200, save(session, JSON.parse(raw)));
      }
      send(404, 'text/plain', 'not found');
    } catch (e) { json(500, { ok: false, error: String(e.message || e), problems_he: [{ text: 'שגיאה בשרת: ' + e.message }] }); }
  });
}

// -------------------------------------------------------------- selftest --
async function selftest(args) {
  const tmp = mkdtempSync(join(tmpdir(), 'habait-correct-'));
  const session = loadSession({ ...args, out: tmp });
  const server = makeServer(session);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  let fails = 0;
  const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails++; };
  try {
    const s = await (await fetch(`${base}/api/session`)).json();
    ok(s.plan?.rooms?.length > 0, `session loads: ${s.plan.apartment_id}, ${s.plan.rooms.length} rooms, ${s.plan.openings.length} openings, report ${s.report ? s.report.rooms?.length + ' rooms' : 'none'}, image ${s.image.width}x${s.image.height}`);
    const html = await (await fetch(`${base}/`)).text();
    const js = await (await fetch(`${base}/correct.js`)).text();
    const css = await (await fetch(`${base}/correct.css`)).text();
    const img = await fetch(`${base}/plan-image`);
    ok(html.includes('dir="rtl"') && html.includes('lang="he"'), 'index.html is Hebrew RTL');
    const ext = [html, js, css].join('\n').match(/(?:src|href)\s*=\s*["'](?:https?:)?\/\/[^"']+|@import\s+url\(\s*["']?https?:|fetch\(\s*["']https?:/g);
    ok(!ext, `no network dependency (external refs: ${ext ? ext.join(', ') : 0})`);
    ok(img.status === 200 && (await img.arrayBuffer()).byteLength > 1000, 'plan image served');
    const A = core.rasterAffine(s.report?.raster, s.plan);
    const inImg = s.plan.rooms.flatMap((r) => r.loop).every(([x, y]) => { const px = A[0] * x + A[1] * y + A[2], py = A[3] * x + A[4] * y + A[5]; return px >= 0 && py >= 0 && px <= s.image.width && py <= s.image.height; });
    ok(inImg, `every room corner maps inside the image (cm->px ${A.map((v) => +v.toFixed(3)).join(',')})`);

    // the edits, built by the same functions the UI uses
    const plan = structuredClone(s.plan);
    const ops = [];
    const doOp = (op) => { core.applyOp(plan, op); ops.push(op); };
    const room = plan.rooms.find((r) => r.loop.length >= 4) ;
    const v0 = room.loop[0];
    const snapped = core.snapPoint(plan, [v0[0] + 1.5, v0[1] + 1.5], 5, { roomId: room.id, i: 0 });
    doOp(core.opMoveVertex(plan, room.id, 0, [v0[0] + 1.5, v0[1] + 1.5]));
    ok(true, `move corner ${room.id}/loop/0 (${v0}) -> (${plan.rooms.find((r) => r.id === room.id).loop[0]}); snap candidate ${snapped.kind || 'none'}`);
    const preset = core.ROOM_PRESETS.find((p) => p.type === room.type && p.he !== room.name_he) || core.ROOM_PRESETS[0];
    doOp(core.opSetRoom(plan, room.id, preset));
    const door = plan.openings.find((o) => o.kind === 'door' && !o.rooms.includes('outside'));
    if (door) {
      doOp(core.opDeleteOpening(plan, door.id));
      const again = core.placeOpening(plan, door.centre_cm, 'door');
      ok(!!again && again.rooms.slice().sort().join() === door.rooms.slice().sort().join(),
        `delete door ${door.id} (${door.rooms.join('|')}), re-add by tapping its wall -> ${again?.id} ${again?.kind} ${again?.rooms.join('|')} width ${again?.width_cm}`);
      if (again) { doOp(core.opAddOpening(plan, again)); doOp(core.opSetOpening(plan, again.id, { width: 80 })); }
    }
    const before = core.computeIssues(s.plan, s.report).length, after = core.computeIssues(plan, s.report).length;
    ok(true, `live checks: ${before} before, ${after} after the edits`);

    const r = await (await fetch(`${base}/api/save`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plan, corrections: ops, elapsed_s: 0 }) })).json();
    ok(r.ok, `save through the API: ok=${r.ok}, validator fails ${r.fails?.length}, warns ${r.warns?.length}, shape problems ${r.shape?.length}${r.ok ? '' : ' :: ' + [...(r.fails || []), ...(r.shape || [])].slice(0, 3).join(' | ')}`);
    const outPlan = join(tmp, 'plan.json'), outCorr = join(tmp, 'corrections.json');
    ok(existsSync(outPlan) && existsSync(outCorr), 'plan.json + corrections.json written to --out');
    const v = runValidator(session.validator, outPlan);
    ok(v.ok, `validate-plan on the saved plan.json: exit ${v.code}, ${v.fails.length} fail, ${v.warns.length} warn`);
    const saved = JSON.parse(readFileSync(outPlan, 'utf8'));
    const corr = JSON.parse(readFileSync(outCorr, 'utf8'));
    ok(corr.length === ops.length + (r.auto?.length || 0) && corr.every((c) => c.type && c.target && 't' in c && 'before' in c && 'after' in c),
      `corrections.json: ${corr.length} entries [${corr.map((c) => c.type).join(', ')}], each {type,target,before,after,t}`);
    const shape = core.shapeDiff(s.plan, saved);
    ok(!shape.length, `schema integrity: no field deleted or reshaped (${shape.length} problems)`);
    // replay: original + corrections == saved; saved - corrections (reverse) == original
    const replay = structuredClone(s.plan); for (const c of corr) if (!c.undone) core.applyOp(replay, c);
    core.finalizePlan(s.plan, replay);
    ok(JSON.stringify(replay.rooms) === JSON.stringify(saved.rooms) && JSON.stringify(replay.openings) === JSON.stringify(saved.openings),
      'replaying corrections.json on the input reproduces the saved rooms + openings');
    const back = structuredClone(saved); for (const c of [...corr].reverse()) if (!c.undone) core.applyOp(back, c, -1);
    ok(JSON.stringify(back.rooms.map((x) => [x.id, x.loop, x.name_he, x.type])) === JSON.stringify(s.plan.rooms.map((x) => [x.id, x.loop, x.name_he, x.type]))
      && JSON.stringify(back.openings.map((o) => o.id)) === JSON.stringify(s.plan.openings.map((o) => o.id)),
      'undoing corrections.json in reverse restores the input');
    ok(sha256(readFileSync(session.planPath)) === session.plan_sha256, 'input plan untouched (sha256 unchanged)');
  } catch (e) { fails++; console.log(`FAIL exception: ${e.stack || e}`); }
  server.close();
  rmSync(tmp, { recursive: true, force: true });
  console.log(fails ? `selftest FAIL (${fails})` : 'selftest OK');
  process.exit(fails ? 1 : 0);
}

// ------------------------------------------------------------------ main --
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  if (args.selftest) await selftest(args);
  else {
    let session;
    try { session = loadSession(args); } catch (e) { console.error(`serve.mjs: ${e.message}`); process.exit(2); }
    makeServer(session).listen(args.port, args.host, () => {
      console.log(`תיקון תכנית: http://${args.host}:${args.port}/`);
      console.log(`  plan   ${session.planPath}\n  report ${session.reportPath || '-'}\n  image  ${session.imagePath}\n  out    ${session.out}`);
    });
  }
}
