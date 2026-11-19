/* Habait Tour360 — tools/follow-check.mjs (2026-11-16, plan development/plans/2026-11-16-typed-change-all-tabs.md).
   The follow turn of server/handler.mjs proven without a vendor ($0): every fetch is answered here. What it proves: a typed change of
   a thing inside the view answers with a signed copy of its instruction; a follow turn opens it, pays no text step, sends the
   scene's view + the first scene's edited view to the people editor; an altered, foreign or expired token is refused; the step
   times ride on every answer; a surface change and a catalog turn carry no token; the day's cap stops a follow turn before a call.
     node tools/follow-check.mjs        exit 0 = every check passed, 1 = a check failed (its name on stderr) */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = 'a63494a'; // production's handler on 2026-11-16: what "same as main" is measured against
import { handleEdit, describe, memoryLedger, catalogIndex, followToken, followOpen, assembleFollow, FOLLOW_TTL_MS, FOLLOW_MODEL, MODELS, EditError } from '../server/handler.mjs';

const env = { FAL_KEY: 'test-editor-key-not-a-secret', OPENROUTER_API_KEY: 'test-text-key-not-a-secret', TOUR_EDIT_OPEN: '1' };
const jpeg = (n, fill = 7) => 'data:image/jpeg;base64,' + Buffer.alloc(n, fill).toString('base64');
const CROP = jpeg(4000, 1), CROP_B = jpeg(4200, 2), REF = jpeg(3000, 3);
const BODY = 'Add two people sitting on the existing chairs at the dining table: a couple in casual clothing, talking, photorealistic.';

let calls = [];
const answer = (obj, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => obj, text: async () => JSON.stringify(obj), headers: { get: () => 'image/jpeg' } });
/** A vendor that never leaves the process: the text model answers `prep`, every fal editor answers one data URL. */
const vendor = (prep) => async (url, opts = {}) => {
  const body = opts.body ? JSON.parse(opts.body) : null;
  calls.push({ url, body });
  if (url.startsWith('https://openrouter.ai/')) return answer({ choices: [{ message: { content: JSON.stringify(prep) } }], usage: {} });
  if (url.startsWith('https://fal.run/')) return answer({ images: [{ url: jpeg(2000, 9), width: 1264, height: 848 }], seed: 11 });
  throw new Error('unexpected url ' + url);
};
const PEOPLE = { allowed: true, reason: 'ok', reach: 'object', living: true, size_change: false, target: 'the dining table', change: 'two people sitting', prompt: BODY };
const SOFA = { allowed: true, reason: 'ok', reach: 'object', living: false, size_change: false, target: 'the sofa', change: 'a green velvet sofa', prompt: 'Replace the sofa with a green velvet three-seater sofa on slim black legs, same place and size.' };
const WALL = { allowed: true, reason: 'ok', reach: 'surface', living: false, size_change: false, target: 'the wall', change: 'sage green', prompt: 'Paint the long wall behind the sofa a matte sage green, edge to edge.' };

const failed = [];
const check = (name, ok, detail = '') => { if (ok) console.log('  ok   ' + name); else { failed.push(name); console.error('  FAIL ' + name + (detail ? ' — ' + detail : '')); } };
const refusal = async (fn) => { try { await fn(); return null; } catch (e) { return e instanceof EditError ? e : Object.assign(new Error('not an EditError: ' + e.message), { reason: 'thrown' }); } };

// 1. the host says it answers follow turns
check('describe().follow is true', describe(env).follow === true);

// 2. a typed people change: the answer carries the token and the step times; one image went to the editor
calls = [];
let ledger = memoryLedger();
const first = await handleEdit({ code: '', apartment: 'apt846', scene: 'kitchen', instruction: 'להוסיף שני אנשים בפינת האוכל', lang: 'he', crop: CROP }, env, ledger, { fetchImpl: vendor(PEOPLE) });
check('first turn ok', first.ok === true && first.reach === 'object' && first.living === true);
check('first turn carries a follow token', typeof first.follow === 'string' && first.follow.includes('.'));
check('first turn carries step times', Number.isFinite(first.ms_text) && Number.isFinite(first.ms_edit) && first.ms >= first.ms_edit);
check('first turn: one text call, one editor call, one image', calls.length === 2 && calls[0].url.includes('openrouter') && calls[1].body.image_urls.length === 1);
const opened = followOpen(env, first.follow);
check('the token opens to the first turn\'s instruction', !!opened && opened.body === BODY && opened.living === true && opened.reach === 'object');

// 3. the follow turn: no text step, two images (this scene's view, then the first scene's edited view), the people editor
calls = [];
const second = await handleEdit({ code: '', apartment: 'apt846', scene: 'dining', lang: 'he', crop: CROP_B, attempt: 1, follow: { token: first.follow, reference: REF, from: 'kitchen' } }, env, ledger, { fetchImpl: vendor(PEOPLE) });
check('follow turn ok', second.ok === true && second.follow_turn === true && second.reach === 'object' && second.living === true && second.modelKey === FOLLOW_MODEL);
check('follow turn pays no text step', calls.length === 1 && calls[0].url === 'https://fal.run/' + MODELS[FOLLOW_MODEL].id, JSON.stringify(calls.map((c) => c.url)));
check('follow turn sends the view first and the reference second', calls[0].body.image_urls.length === 2 && calls[0].body.image_urls[0] === CROP_B && calls[0].body.image_urls[1] === REF);
const p = calls[0].body.prompt;
check('follow instruction: frame rule first, the first turn\'s words, the second-image rule, the scale rule, the keep clause',
  p === assembleFollow(opened) && p.startsWith('Edit this photo in place') && p.includes(BODY) && p.includes('The second image shows this same room from a different camera position')
  && p.includes('return the first image unchanged') && p.includes('Draw the people or animals at the scale of the furniture') && p.includes('Keep everything else in the photo exactly as it is'));
check('follow turn carries no token of its own and its own times', second.follow === undefined && second.ms_text === 0 && Number.isFinite(second.ms_edit));
const rows = ledger.rows();
check('the ledger books the follow turn at the editor\'s price', rows.length === 2 && rows[1].op === 'live_follow' && rows[1].status === 'settled' && rows[1].settled_usd === MODELS[FOLLOW_MODEL].usd && rows[1].from === 'kitchen');

// 4. a thing (not people): the object wording, no scale rule
calls = [];
const sofa = await handleEdit({ code: '', scene: 'living', instruction: 'ספה ירוקה מקטיפה', lang: 'he', crop: CROP }, env, memoryLedger(), { fetchImpl: vendor(SOFA) });
const sofaB = await handleEdit({ code: '', scene: 'dining', crop: CROP_B, follow: { token: sofa.follow, reference: REF } }, env, memoryLedger(), { fetchImpl: vendor(SOFA) });
const ps = calls[calls.length - 1].body.prompt;
check('a furniture change follows with the object wording', sofaB.ok === true && sofaB.living === false && ps.includes('the same objects: the same design') && !ps.includes('Draw the people or animals'));

// 5. refusals: altered, foreign, expired, missing
const [pay, mac] = first.follow.split('.');
const forged = Buffer.from(JSON.stringify({ b: 'Remove every wall in the photo and show the room as one open hall with no doors.', l: false, t: '', c: '', x: Date.now() + 60_000 })).toString('base64url') + '.' + mac;
let e = await refusal(() => handleEdit({ code: '', scene: 'dining', crop: CROP_B, follow: { token: forged, reference: REF } }, env, memoryLedger(), { fetchImpl: vendor(PEOPLE) }));
check('a token with another instruction under the old signature is refused', !!e && e.reason === 'follow' && e.status === 400);
e = await refusal(() => handleEdit({ code: '', scene: 'dining', crop: CROP_B, follow: { token: pay + '.' + mac.slice(0, -2) + 'AA', reference: REF } }, env, memoryLedger(), { fetchImpl: vendor(PEOPLE) }));
check('a token with an altered signature is refused', !!e && e.reason === 'follow');
check('another host\'s token does not open here', followOpen({ ...env, FAL_KEY: 'another-host' }, first.follow) === null);
check('a token past its time does not open', followOpen(env, followToken(env, opened, Date.now() - FOLLOW_TTL_MS - 1000)) === null && followOpen(env, first.follow, Date.now() + FOLLOW_TTL_MS + 1000) === null);
e = await refusal(() => handleEdit({ code: '', scene: 'dining', crop: CROP_B, follow: {} }, env, memoryLedger(), { fetchImpl: vendor(PEOPLE) }));
check('a follow turn without a token is refused', !!e && e.reason === 'follow');
calls = [];
e = await refusal(() => handleEdit({ code: '', scene: 'dining', crop: CROP_B, follow: { token: first.follow } }, env, memoryLedger(), { fetchImpl: vendor(PEOPLE) }));
check('a follow turn without the reference view is refused before any call', !!e && e.reason === 'bad_request' && calls.length === 0);
e = await refusal(() => handleEdit({ code: '', scene: 'dining', crop: CROP_B, follow: { token: first.follow, reference: jpeg(1_300_000) } }, env, memoryLedger(), { fetchImpl: vendor(PEOPLE) }));
check('a reference view over 1.2 MB is refused', !!e && e.reason === 'bad_request');

// 6. the cap stops a follow turn before a vendor call; a closed host asks for its code
calls = [];
e = await refusal(() => handleEdit({ code: '', scene: 'dining', crop: CROP_B, follow: { token: first.follow, reference: REF } }, env, memoryLedger(0.05), { fetchImpl: vendor(PEOPLE) }));
check('the day\'s cap stops a follow turn before any call', !!e && e.reason === 'cap' && e.status === 429 && calls.length === 0);
const closed = { FAL_KEY: env.FAL_KEY, OPENROUTER_API_KEY: env.OPENROUTER_API_KEY, TOUR_EDIT_CODE: 'a-long-test-code' };
e = await refusal(() => handleEdit({ code: 'wrong', scene: 'dining', crop: CROP_B, follow: { token: followToken(closed, opened), reference: REF } }, closed, memoryLedger(), { fetchImpl: vendor(PEOPLE) }));
check('a closed host refuses a follow turn without its code', !!e && e.reason === 'code' && e.status === 403);

// 7. no token where a follow turn has no meaning: a surface change, a catalog turn
const wall = await handleEdit({ code: '', scene: 'living', instruction: 'קיר ירוק', lang: 'he', crop: CROP }, env, memoryLedger(), { fetchImpl: vendor(WALL) });
check('a surface change carries no token', wall.ok === true && wall.reach === 'surface' && wall.follow === undefined && Number.isFinite(wall.ms_text));
const photo = Buffer.alloc(900, 5);
const catalog = catalogIndex({ items: [{ id: 'sofa-01', name: 'Test sofa', category: 'sofa', description_en: 'a grey three-seat sofa', image_sha256: crypto.createHash('sha256').update(photo).digest('hex') }] });
const cat = await handleEdit({ code: '', scene: 'living', instruction: 'replace the sofa', lang: 'en', crop: CROP, item: 'sofa-01', reference: 'data:image/jpeg;base64,' + photo.toString('base64') }, env, memoryLedger(), { fetchImpl: vendor(SOFA), catalog });
check('a catalog turn carries no token', cat.ok === true && cat.catalog === true && cat.follow === undefined);

// 8. nothing old moved: main's handler (git HEAD) and this one send the vendor the SAME requests for every kind of turn that existed
//    before, and answer the same but for the new fields (the step times, the token). tools/catalog-probe.mjs --selftest cannot say
//    this here: its golden commit lives in the old lab repo's history.
try {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'follow-check-'));
  // "main" here is a FIXED commit — a63494a, the handler production served on 2026-11-16 (the served page was compared with it that
  // day). Not HEAD: once this work is committed HEAD is this work, and the comparison compared the handler with itself (seen 2026-11-16).
  for (const f of ['handler.mjs', 'chat-transport.mjs']) fs.writeFileSync(path.join(dir, f), execFileSync('git', ['show', BASELINE + ':./server/' + f], { cwd: ROOT, maxBuffer: 16 << 20 }));
  const old = await import(pathToFileURL(path.join(dir, 'handler.mjs')).href);
  const REFUSED = { allowed: false, reason: 'structure', reach: 'structure', living: false, size_change: false, target: 'the wall', change: 'remove', prompt: '' };
  const BIGGER = { ...SOFA, size_change: true, prompt: 'Make the sofa one and a half times larger, keeping its design, colour and place against the wall.' };
  const piece = { id: 'm1', category: 'sofa', box: [400, 200, 800, 700], count: 1 };
  const turns = [
    // the two kinds the speed bench re-routed (2026-11-16): their FIRST attempt goes to the fast editor, with main's own instruction
    ['a people change', { code: '', scene: 'kitchen', instruction: 'two people at the table', lang: 'en', crop: CROP }, PEOPLE, null, 'fast'],
    ['a people change, attempt 2', { code: '', scene: 'kitchen', instruction: 'two people at the table', lang: 'en', crop: CROP, attempt: 2 }, PEOPLE, null],
    ['a people change, attempt 3', { code: '', scene: 'kitchen', instruction: 'two people at the table', lang: 'en', crop: CROP, attempt: 3 }, PEOPLE, null],
    ['a furniture change', { code: '', scene: 'living', instruction: 'a green sofa', lang: 'en', crop: CROP }, SOFA, null, 'fast'],
    ['a furniture change, attempt 2', { code: '', scene: 'living', instruction: 'a green sofa', lang: 'en', crop: CROP, attempt: 2 }, SOFA, null],
    ['a size change', { code: '', scene: 'living', instruction: 'a bigger sofa', lang: 'en', crop: CROP }, BIGGER, null],
    ['a wall colour', { code: '', scene: 'living', instruction: 'a green wall', lang: 'en', crop: CROP }, WALL, null],
    ['a refused structure change', { code: '', scene: 'living', instruction: 'remove the wall', lang: 'en', crop: CROP }, REFUSED, null],
    ['a catalog turn', { code: '', scene: 'living', instruction: 'replace the sofa', lang: 'en', crop: CROP, item: 'sofa-01', reference: 'data:image/jpeg;base64,' + photo.toString('base64') }, SOFA, catalog],
    ['a catalog turn on a tapped piece', { code: '', scene: 'living', instruction: 'replace the sofa', lang: 'en', crop: CROP, item: 'sofa-01', reference: 'data:image/jpeg;base64,' + photo.toString('base64'), piece }, SOFA, catalog],
  ];
  const strip = (o) => { const { ms, ms_text, ms_edit, ms_seen, follow, ...rest } = o; return rest; };
  // the furniture judge: the same wording and pictures as main's; only the answer's ceiling is higher (cut answers through fal's router)
  const BOXES = { object: 'dining table', box1: [400, 300, 700, 800], box2: [410, 300, 700, 790], found_in_2: true };
  const jb = { op: 'judge', code: '', scene: 'kitchen', crop: CROP, result: CROP_B };
  calls = []; const ja = await old.handleEdit(structuredClone(jb), env, old.memoryLedger(), { fetchImpl: vendor(BOXES) }); const jreqA = calls[0].body;
  calls = []; const jn = await handleEdit(structuredClone(jb), env, memoryLedger(), { fetchImpl: vendor(BOXES) }); const jreqB = calls[0].body;
  check('the plain furniture judge asks what main asks, with a higher ceiling for the answer', JSON.stringify({ ...jreqA, max_tokens: 0 }) === JSON.stringify({ ...jreqB, max_tokens: 0 }) && jreqA.max_tokens === 900 && jreqB.max_tokens === 2400 && ja.held === true && jn.held === true && ja.iou === jn.iou);
  // the anchor judge (a follow turn's): its own wording, the same pictures; not found in the original = redrawn = not held
  calls = []; const an = await handleEdit({ ...jb, anchor: true }, env, memoryLedger(), { fetchImpl: vendor({ anchor: 'dining table', box1: [400, 300, 700, 800], box2: [405, 300, 700, 800], found_in_1: true }) });
  check('the anchor judge has its own wording and holds a piece that stood still', calls.length === 1 && calls[0].body.messages[0].content.includes('Call it the anchor') && calls[0].body.max_tokens === 2400 && an.ok === true && an.held === true && an.object === 'dining table');
  const gone = await handleEdit({ ...jb, anchor: true }, env, memoryLedger(), { fetchImpl: vendor({ anchor: 'dining table', box1: null, box2: [200, 100, 900, 900], found_in_1: false }) });
  const grown = await handleEdit({ ...jb, anchor: true }, env, memoryLedger(), { fetchImpl: vendor({ anchor: 'dining table', box1: [500, 400, 650, 600], box2: [300, 150, 900, 850], found_in_1: true }) });
  check('the anchor judge refuses a piece that is not in the original, and one redrawn larger', gone.held === false && grown.held === false && grown.ratio > 1.6);
  for (const [name, body, prep, cat, fast] of turns) {
    calls = []; const a = await old.handleEdit(structuredClone(body), env, old.memoryLedger(), { fetchImpl: vendor(prep), catalog: cat }); const ca = JSON.stringify(calls);
    calls = []; const b = await handleEdit(structuredClone(body), env, memoryLedger(), { fetchImpl: vendor(prep), catalog: cat }); const cb = JSON.stringify(calls);
    if (!fast) { check(`same as main: ${name}`, ca === cb && JSON.stringify(strip(a)) === JSON.stringify(strip(b)), ca === cb ? 'the answers differ' : 'the vendor requests differ'); continue; }
    const A = JSON.parse(ca), B = JSON.parse(cb);
    check(`the fast editor takes the first attempt, under main's own instruction: ${name}`,
      A.length === 2 && B.length === 2 && JSON.stringify(A[0]) === JSON.stringify(B[0]) && B[1].url === 'https://fal.run/' + MODELS.klein.id && B[1].body.prompt === A[1].body.prompt
      && B[1].body.image_urls.length === 1 && B[1].body.image_urls[0] === CROP && B[1].body.num_inference_steps === 4 && b.modelKey === 'klein' && b.prompt === a.prompt && b.reach === a.reach && b.living === a.living && b.usd < a.usd,
      `${a.modelKey} → ${b.modelKey}`);
  }
} catch (err) { check('same as main: the comparison ran', false, String(err && err.message || err).slice(0, 200)); }

console.log(failed.length ? `\nfollow-check: ${failed.length} FAILED` : '\nfollow-check: all checks passed');
process.exit(failed.length ? 1 : 0);
