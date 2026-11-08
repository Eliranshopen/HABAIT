#!/usr/bin/env node
/* Habait Tour360 — tools/catalog-probe.mjs (T14b, CATALOG-PLAN.md §5 row 10) — the catalog turn proven without a vendor, then
   probed with one. Zero dependencies. Three modes, from the harness root in Git Bash:

     timeout 300 node Habait/tour360/tools/catalog-probe.mjs --selftest [--golden-against 1b04ba65]
       $0, no network. (a) Requests WITHOUT an item must take exactly the pre-wave path: the text-step request, the editor chosen,
       the assembled prompt and the vendor payload are compared, attempt by attempt, against the handler at the golden commit
       (read with `git show`, imported from a temporary file). (b) A catalog request goes to nb2 with TWO images. (c) A catalog photo
       with one byte changed is refused with `catalog`. (d) A likeness answer is parsed. Prints `selftest: PASS` or the difference.
     timeout 540 node Habait/tour360/tools/catalog-probe.mjs --item <id> --crop <jpg> [--out <dir>] [--lang en]
       PAID (about $0.09 a turn): the handler in-process with the file ledger, the keys by name from the root .env and an unlock
       code made for this run — no server, no port, no secret in any brief. One catalog turn, then the furniture judge and the
       likeness call; a second attempt only when the judge refuses the first (as the page would). Writes crop.jpg, result.jpg and
       record.json into <out>/<id>/ (default qa-evidence/tour360/T14/probe) and refreshes <out>/index.html, a contact sheet that
       LINKS the product photo from catalog/_local/ and never copies it (D-T360-27). The border ring is the page's measure, not this
       tool's (no JPEG decoder here); the judge decides the retry.
     timeout 60 node Habait/tour360/tools/catalog-probe.mjs --report <dir>
       the table from the records and the ledger's settled catalog spend; exit 1 when a record or a result picture is missing. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fileLedger, loadEnv } from './file-ledger.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HARNESS = path.resolve(ROOT, '..', '..');
const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : dflt; };
const has = (name) => process.argv.includes(name);
const CATALOG_FILE = path.join(ROOT, 'catalog', 'items.json');
const LOCAL = path.join(ROOT, 'catalog', '_local');
const readCatalog = () => JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
const dataUrl = (file, mime = 'image/jpeg') => `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/* ────────────────────────────────────────────────────────────────────── selftest */
async function selftest() {
  const golden = arg('--golden-against', '1b04ba65');
  const current = await import(pathToFileURL(path.join(ROOT, 'server', 'handler.mjs')).href);
  const src = execFileSync('git', ['show', `${golden}:Habait/tour360/server/handler.mjs`], { cwd: HARNESS, encoding: 'utf8', maxBuffer: 4 << 20 });
  const tmp = path.join(os.tmpdir(), `tour360-handler-${golden}-${process.pid}.mjs`);
  fs.writeFileSync(tmp, src);
  const old = await import(pathToFileURL(tmp).href);
  // the second golden (T16b): the handler at T14b's build — a catalog turn WITHOUT a piece must still take exactly its path
  const goldenCatalog = arg('--golden-catalog', '974f0c8f');  // T16g moved it from a413f17c: the catalog prompt changed by design (D-CAT-22); the no-item golden stays
  const src2 = execFileSync('git', ['show', `${goldenCatalog}:Habait/tour360/server/handler.mjs`], { cwd: HARNESS, encoding: 'utf8', maxBuffer: 4 << 20 });
  const tmp2 = path.join(os.tmpdir(), `tour360-handler-${goldenCatalog}-${process.pid}.mjs`);
  fs.writeFileSync(tmp2, src2);
  const old2 = await import(pathToFileURL(tmp2).href);
  const env = { FAL_KEY: 'selftest-fal', OPENROUTER_API_KEY: 'selftest-or', TOUR_EDIT_CODE: 'selftest-code-1' };
  const tiny = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64');
  const RESULT = { images: [{ url: tiny, width: 1264, height: 848 }], seed: 7 };

  /** A stubbed fetch: answers the text step with the fixture's JSON and the editor with a tiny image; records every call. */
  const stub = (answer, trace) => async (url, init) => {
    const body = init && init.body ? JSON.parse(init.body) : null;
    trace.push({ url: String(url), body });
    if (String(url).includes('openrouter.ai')) return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(answer) } }], usage: { total_tokens: 1 } }) };
    return { ok: true, status: 200, json: async () => RESULT, text: async () => '' };
  };
  const fixtures = [
    { name: 'cushions', body: { instruction: 'כריות כחולות על הספה', lang: 'he' }, answer: { allowed: true, reason: 'ok', reach: 'object', living: false, size_change: false, target: 'sofa cushions', change: 'blue cushions', prompt: 'Put four blue cushions on the sofa, two at each end, matching the room light and perspective.' } },
    { name: 'four-people', body: { instruction: 'ארבעה אנשים יושבים לאכול ליד שולחן האוכל', lang: 'he' }, answer: { allowed: true, reason: 'ok', reach: 'object', living: true, size_change: false, target: 'dining table', change: 'four people eating', prompt: 'Seat exactly four adults on the existing chairs at the dining table, eating, photorealistic, matching the room lighting, perspective and scale, faces natural and relaxed, not looking at the camera.' } },
    { name: 'green-wall', body: { instruction: 'a dark green wall behind the TV', lang: 'en' }, answer: { allowed: true, reason: 'ok', reach: 'surface', living: false, size_change: false, target: 'the wall behind the TV', change: 'dark green', prompt: 'Paint the wall behind the TV a deep dark green, keeping its texture and the light on it.' } },
    { name: 'bigger-tv', body: { instruction: 'make the TV bigger', lang: 'en' }, answer: { allowed: true, reason: 'ok', reach: 'object', living: false, size_change: true, target: 'the TV', change: 'bigger', prompt: 'Make the television on the wall about one and a half times larger, keeping its position and the wall around it.' } },
    { name: 'wall-removed', body: { instruction: 'תהרסו את הקיר בין הסלון למטבח', lang: 'he' }, answer: { allowed: false, reason: 'structure', reach: 'structure', living: false, size_change: false, target: '', change: '', prompt: '' } },
    { name: 'real-person', body: { instruction: 'bibi and trump sit on the couch', lang: 'en' }, answer: { allowed: false, reason: 'real_person', reach: 'object', living: true, size_change: false, target: '', change: '', prompt: '' } },
  ];
  const strip = (o) => { const c = JSON.parse(JSON.stringify(o)); delete c.ms; return c; };
  const diffs = [];
  for (const f of fixtures) {
    for (const attempt of [1, 2, 3]) {
      if (!f.answer.allowed && attempt > 1) continue;
      const base = { code: env.TOUR_EDIT_CODE, apartment: 'demo-01', scene: 'living', crop: tiny, attempt, ...f.body };
      const tOld = [], tNew = [];
      const rOld = strip(await old.handleEdit(base, env, old.memoryLedger(), { fetchImpl: stub(f.answer, tOld) }));
      const rNew = strip(await current.handleEdit(base, env, current.memoryLedger(), { fetchImpl: stub(f.answer, tNew) }));
      const a = JSON.stringify(tOld), b = JSON.stringify(tNew);
      if (a !== b) diffs.push(`${f.name} attempt ${attempt}: the request trace differs\n  golden: ${a.slice(0, 400)}\n  now:    ${b.slice(0, 400)}`);
      if (JSON.stringify(rOld) !== JSON.stringify(rNew)) diffs.push(`${f.name} attempt ${attempt}: the answer differs\n  golden: ${JSON.stringify(rOld).slice(0, 300)}\n  now:    ${JSON.stringify(rNew).slice(0, 300)}`);
    }
  }
  // (b) a catalog request goes to nb2 with two images; (c) a forged photo is refused with `catalog`
  const doc = fs.existsSync(CATALOG_FILE) ? readCatalog() : null;
  let photo, row;
  if (doc && doc.items.length && fs.existsSync(path.join(LOCAL, doc.items[0].image))) {
    row = doc.items[0]; photo = fs.readFileSync(path.join(LOCAL, row.image));
  } else {
    photo = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    row = { id: 'selftest', name: 'SELFTEST', category: 'sofa', description_en: 'a selftest sofa with no photo on this machine', image_sha256: sha(photo) };
  }
  const catalog = current.catalogIndex({ items: [row] });
  const ref = 'data:image/jpeg;base64,' + photo.toString('base64');
  const answer = { allowed: true, reason: 'ok', reach: 'object', living: false, size_change: false, target: 'the sofa', change: 'replace with ' + row.name, prompt: `Replace the sofa in the first image with the product shown in the second image: ${row.description_en}. Place it exactly where the sofa stands, resting on the floor, at the same scale and perspective, lit like the room.` };
  const trace = [];
  const out = await current.handleEdit({ code: env.TOUR_EDIT_CODE, apartment: 'demo-01', scene: 'living', crop: tiny, instruction: 'replace the sofa with ' + row.name, lang: 'en', item: row.id, reference: ref }, env, current.memoryLedger(), { fetchImpl: stub(answer, trace), catalog });
  const falCall = trace.find((t) => t.url.includes('fal.run'));
  if (!falCall || !falCall.url.endsWith('fal-ai/nano-banana-2/edit')) diffs.push('catalog: the editor is not nb2: ' + (falCall ? falCall.url : 'no editor call'));
  else if (!Array.isArray(falCall.body.image_urls) || falCall.body.image_urls.length !== 2 || falCall.body.image_urls[1] !== ref) diffs.push('catalog: the editor did not get the crop and the product photo');
  if (!out.catalog || out.item !== row.id || out.modelKey !== 'nb2') diffs.push('catalog: the answer does not name the item and nb2');
  if (!/second image/.test(falCall ? falCall.body.prompt : '')) diffs.push('catalog: the prompt does not name the second image');
  // T16g: the weight sentence follows the request and precedes the keep-clause (the weight first re-framed the sofa twice on the laptop)
  if (!falCall || !/the only authority for how the new piece looks/.test(falCall.body.prompt) || falCall.body.prompt.indexOf('only authority') < falCall.body.prompt.indexOf('Replace the') || falCall.body.prompt.indexOf('only authority') > falCall.body.prompt.indexOf('Keep everything else')) diffs.push('catalog: the weight sentence is not between the request and the keep-clause');
  const textCall = trace.find((t) => t.url.includes('openrouter.ai'));
  if (!textCall || !/CATALOG MODE/.test(textCall.body.messages[0].content) || !textCall.body.messages[1].content.includes(row.name)) diffs.push('catalog: the text step did not get the catalog block and the item');
  const forgedBytes = Buffer.from(photo); forgedBytes[forgedBytes.length - 1] ^= 0x01;
  const forged = 'data:image/jpeg;base64,' + forgedBytes.toString('base64');
  let refusal = null;
  try { await current.handleEdit({ code: env.TOUR_EDIT_CODE, apartment: 'demo-01', scene: 'living', crop: tiny, instruction: 'x', lang: 'en', item: row.id, reference: forged }, env, current.memoryLedger(), { fetchImpl: stub(answer, []), catalog }); } catch (e) { refusal = e; }
  if (!refusal || refusal.reason !== 'catalog' || refusal.status !== 400) diffs.push('forged photo: expected 400 catalog, got ' + (refusal ? refusal.status + ' ' + refusal.reason : 'an answer'));
  let unknown = null;
  try { await current.handleEdit({ code: env.TOUR_EDIT_CODE, apartment: 'demo-01', scene: 'living', crop: tiny, instruction: 'x', lang: 'en', item: 'no-such-item', reference: ref }, env, current.memoryLedger(), { fetchImpl: stub(answer, []), catalog }); } catch (e) { unknown = e; }
  if (!unknown || unknown.reason !== 'catalog') diffs.push('unknown item: expected 400 catalog');
  // (c2) T16f: a reference string that decodes to the right bytes but is not the canonical string is either refused or accepted —
  // and when accepted, the vendor gets the CANONICAL photo string, never the client's
  for (const [name, mangled] of [['newlines every 76 chars', ref.replace(/([A-Za-z0-9+/]{76})/g, '$1\n')], ['junk after the padding', ref + '!!!!']]) {
    const t = [];
    let err = null;
    try { await current.handleEdit({ code: env.TOUR_EDIT_CODE, apartment: 'demo-01', scene: 'living', crop: tiny, instruction: 'replace the sofa with ' + row.name, lang: 'en', item: row.id, reference: mangled }, env, current.memoryLedger(), { fetchImpl: stub(answer, t), catalog }); } catch (e) { err = e; }
    if (err) { if (err.reason !== 'catalog') diffs.push(`reference ${name}: expected an answer or 400 catalog, got ${err.status} ${err.reason}`); continue; }
    const fal = t.find((x) => x.url.includes('fal.run'));
    if (!fal || fal.body.image_urls[1] !== ref) diffs.push(`reference ${name}: accepted, but the vendor did not get the canonical photo string`);
  }
  // (d) a likeness answer is parsed
  const like = await current.handleEdit({ op: 'likeness', code: env.TOUR_EDIT_CODE, item: row.id, reference: ref, result: tiny }, env, current.memoryLedger(), { fetchImpl: stub({ found: true, score: 2, why: 'close in shape and colour' }, []), catalog });
  if (!like.ok || like.score !== 2 || like.found !== true) diffs.push('likeness: expected score 2, got ' + JSON.stringify(like));
  // (e) T16b: a catalog request WITHOUT a piece equals the handler at the catalog golden — the trace and the answer. T16g (D-CAT-22) changed
  // the catalog prompt by design, so the system block that carries CATALOG MODE and the assembled prompt are masked; everything else must
  // still be byte-equal (the item line, the reference, the editor, the payload shape, the answer's fields)
  {
    const maskPrompt = (x) => JSON.parse(JSON.stringify(x), (k, v) => (k === 'prompt' || (k === 'content' && typeof v === 'string' && /CATALOG MODE/.test(v))) ? '<prompt>' : v);
    const catBody = { code: env.TOUR_EDIT_CODE, apartment: 'demo-01', scene: 'living', crop: tiny, instruction: 'replace the sofa with ' + row.name, lang: 'en', item: row.id, reference: ref };
    for (const attempt of [1, 2]) {
      const tOld = [], tNew = [];
      const rOld = strip(await old2.handleEdit({ ...catBody, attempt }, env, old2.memoryLedger(), { fetchImpl: stub(answer, tOld), catalog: old2.catalogIndex({ items: [row] }) }));
      const rNew = strip(await current.handleEdit({ ...catBody, attempt }, env, current.memoryLedger(), { fetchImpl: stub(answer, tNew), catalog }));
      if (JSON.stringify(maskPrompt(tOld)) !== JSON.stringify(maskPrompt(tNew))) diffs.push(`catalog without a piece, attempt ${attempt}: the request trace differs from ${goldenCatalog} beyond the prompt text\n  golden: ${JSON.stringify(tOld).slice(0, 400)}\n  now:    ${JSON.stringify(tNew).slice(0, 400)}`);
      if (JSON.stringify(maskPrompt(rOld)) !== JSON.stringify(maskPrompt(rNew))) diffs.push(`catalog without a piece, attempt ${attempt}: the answer differs from ${goldenCatalog} beyond the prompt text\n  golden: ${JSON.stringify(rOld).slice(0, 300)}\n  now:    ${JSON.stringify(rNew).slice(0, 300)}`);
    }
  }
  // (f) T16b: the tapped piece — a good one reaches the text step as one line and rides the answer; four bad ones are refused with `piece`
  {
    const good = { id: 'living-270-1', category: row.category, box: [430, 0, 1000, 950], count: 1 };
    const trace = [];
    const r = await current.handleEdit({ code: env.TOUR_EDIT_CODE, apartment: 'demo-01', scene: 'living', crop: tiny, instruction: 'replace the sofa with ' + row.name, lang: 'en', item: row.id, reference: ref, piece: good }, env, current.memoryLedger(), { fetchImpl: stub(answer, trace), catalog });
    const text = trace.find((t) => t.url.includes('openrouter.ai') && typeof t.body.messages[1].content === 'string');
    if (!text || !/Piece \(tapped by the visitor/.test(text.body.messages[1].content)) diffs.push('piece: the text step did not get the piece line');
    if (!r.piece || r.piece.category !== row.category || r.piece.count !== 1 || r.piece.id !== good.id) diffs.push('piece: the answer does not carry the piece');
    // (f2) T18a: the piece is located on the crop FIRST (one vision call with the crop), the text step follows; the answer carries
    // `piece_seen` (the stub's text answer has no box → found false); a request that carries `piece.seen` makes no second call
    const seenCall = trace.find((t) => t.url.includes('openrouter.ai') && Array.isArray(t.body.messages[1].content));
    if (!seenCall || !/You locate ONE piece/.test(seenCall.body.messages[0].content) || seenCall.body.messages[1].content[1].image_url.url !== tiny) diffs.push('piece seen: no vision call over the crop before the text step');
    else if (trace.indexOf(seenCall) > trace.indexOf(text)) diffs.push('piece seen: the vision call must precede the text step');
    if (!r.piece_seen || r.piece_seen.found !== false) diffs.push('piece seen: the answer should carry piece_seen with found false on a boxless answer, got ' + JSON.stringify(r.piece_seen));
    {
      const carried = { ...good, seen: { found: true, box: [380, 0, 1000, 990], outline: [[380, 0], [380, 990], [1000, 990], [1000, 0]], touches_edge: ['bottom', 'left', 'nonsense'], note: 'carried' } };
      const t2 = [];
      const r2 = await current.handleEdit({ code: env.TOUR_EDIT_CODE, apartment: 'demo-01', scene: 'living', crop: tiny, instruction: 'replace the sofa with ' + row.name, lang: 'en', item: row.id, reference: ref, piece: carried, attempt: 2 }, env, current.memoryLedger(), { fetchImpl: stub(answer, t2), catalog });
      if (t2.filter((t) => t.url.includes('openrouter.ai')).length !== 1) diffs.push('piece seen: a carried answer must not be re-read');
      if (!r2.piece_seen || r2.piece_seen.found !== true || JSON.stringify(r2.piece_seen.box) !== JSON.stringify([380, 0, 1000, 990]) || JSON.stringify(r2.piece_seen.touches_edge) !== JSON.stringify(['bottom', 'left'])) diffs.push('piece seen: the carried answer should come back validated, got ' + JSON.stringify(r2.piece_seen));
      const textCall2 = t2.find((t) => t.url.includes('openrouter.ai'));
      if (!textCall2 || !/in the centre of the photo/.test(textCall2.body.messages[1].content) || !/in the lower centre of the photo/.test(text.body.messages[1].content)) diffs.push('piece seen: the text step should read the location from the fuller box (centre) where the scan box alone read lower centre');
      // the parse: a good answer, a boxless one, a box of no area
      const s1 = await current.pieceSeen(env, tiny, good, row, stub({ found: true, box: [400, 10, 990, 960], outline: [[400, 10], [400, 960], [990, 960]], touches_edge: ['bottom', 'junk'], note: 'n' }, []));
      if (!s1.found || JSON.stringify(s1.box) !== JSON.stringify([400, 10, 990, 960]) || s1.outline.length !== 3 || JSON.stringify(s1.touches_edge) !== JSON.stringify(['bottom']) || s1.usd !== current.PIECE_SEEN_USD) diffs.push('piece seen parse: ' + JSON.stringify(s1));
      const s2 = await current.pieceSeen(env, tiny, good, row, stub({ found: true, box: [500, 500, 500, 500] }, []));
      if (s2.found !== false || s2.box !== null) diffs.push('piece seen parse: a box of no area should read as not found, got ' + JSON.stringify(s2));
      // the two tries (the reviewer's N3): the first answer is no JSON, the second a box — the turn carries tries 2 and the box
      {
        let seenCalls = 0; const t3 = [];
        const flaky = async (url, init) => {
          const body = init && init.body ? JSON.parse(init.body) : null; t3.push({ url: String(url), body });
          if (String(url).includes('openrouter.ai') && body && Array.isArray(body.messages[1].content)) { seenCalls++; return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: seenCalls === 1 ? 'not json at all' : JSON.stringify({ found: true, box: [380, 0, 1000, 990], outline: null, touches_edge: ['bottom'] }) } }], usage: { total_tokens: 1 } }) }; }
          if (String(url).includes('openrouter.ai')) return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(answer) } }], usage: { total_tokens: 1 } }) };
          return { ok: true, status: 200, json: async () => RESULT, text: async () => '' };
        };
        const r3 = await current.handleEdit({ code: env.TOUR_EDIT_CODE, apartment: 'demo-01', scene: 'living', crop: tiny, instruction: 'replace the sofa with ' + row.name, lang: 'en', item: row.id, reference: ref, piece: good }, env, current.memoryLedger(), { fetchImpl: flaky, catalog });
        if (seenCalls !== 2 || !r3.piece_seen || r3.piece_seen.found !== true || r3.piece_seen.tries !== 2 || JSON.stringify(r3.piece_seen.box) !== JSON.stringify([380, 0, 1000, 990])) diffs.push('piece seen retry: expected two calls, found on the second with tries 2, got calls ' + seenCalls + ' ' + JSON.stringify(r3.piece_seen));
      }
    }
    const bad = [
      ['wrong category', { category: row.category === 'sofa' ? 'armchair' : 'sofa', box: [430, 0, 1000, 950], count: 1 }],
      ['box outside 0-1000', { category: row.category, box: [-10, 0, 1200, 950], count: 1 }],
      ['box of no area', { category: row.category, box: [500, 500, 500, 500], count: 1 }],
      ['count 0', { category: row.category, box: [430, 0, 1000, 950], count: 0 }],
    ];
    for (const [name, piece] of bad) {
      let err = null;
      try { await current.handleEdit({ code: env.TOUR_EDIT_CODE, apartment: 'demo-01', scene: 'living', crop: tiny, instruction: 'x', lang: 'en', item: row.id, reference: ref, piece }, env, current.memoryLedger(), { fetchImpl: stub(answer, []), catalog }); } catch (e) { err = e; }
      if (!err || err.status !== 400 || err.reason !== 'piece') diffs.push(`piece ${name}: expected 400 piece, got ${err ? err.status + ' ' + err.reason : 'an answer'}`);
    }
  }
  // (g) T16b: the replace judge — four stubbed answers parse to the right verdict
  {
    const box = [430, 0, 1000, 950];
    const cases = [
      ['gone, present, inside → held', { original_present: false, product_present: true, product_box: [500, 100, 980, 900], count: 1, rest_unchanged: 3, note: 'ok' }, true],
      ['the original still there → not held', { original_present: true, product_present: true, product_box: [500, 100, 980, 900], count: 1, rest_unchanged: 3, note: 'x' }, false],
      ['no product → not held', { original_present: false, product_present: false, product_box: null, count: 0, rest_unchanged: 2, note: 'x' }, false],
      ['the product elsewhere → not held', { original_present: false, product_present: true, product_box: [0, 0, 200, 200], count: 1, rest_unchanged: 3, note: 'x' }, false],
      ['a whole-frame box over a large piece → clipped to its neighbourhood, held (T16f)', { original_present: false, product_present: true, product_box: [0, 0, 1000, 1000], count: 1, rest_unchanged: 2, note: 'x' }, true],
    ];
    for (const [name, ans, held] of cases) {
      const j = await current.handleEdit({ op: 'replace_judge', code: env.TOUR_EDIT_CODE, item: row.id, crop: tiny, result: tiny, box, count: 1 }, env, current.memoryLedger(), { fetchImpl: stub(ans, []), catalog });
      if (!j.ok || j.held !== held) diffs.push(`replace judge ${name}: expected held ${held}, got ${JSON.stringify(j)}`);
    }
    // T16f: the clip — the whole-frame answer comes back as the neighbourhood [288, 0, 1000, 1000] with box_kept 0.712 (the raw box kept
    // beside it); over a small central piece the same answer keeps 0.09 of its area and is refused
    {
      const j = await current.handleEdit({ op: 'replace_judge', code: env.TOUR_EDIT_CODE, item: row.id, crop: tiny, result: tiny, box, count: 1 }, env, current.memoryLedger(), { fetchImpl: stub(cases[4][1], []), catalog });
      if (JSON.stringify(j.product_box) !== JSON.stringify([288, 0, 1000, 1000]) || j.box_kept !== 0.712 || JSON.stringify(j.product_box_raw) !== JSON.stringify([0, 0, 1000, 1000])) diffs.push('replace judge clip: expected the neighbourhood [288, 0, 1000, 1000], box_kept 0.712 and the raw box, got ' + JSON.stringify([j.product_box, j.box_kept, j.product_box_raw]));
      const small = await current.handleEdit({ op: 'replace_judge', code: env.TOUR_EDIT_CODE, item: row.id, crop: tiny, result: tiny, box: [400, 400, 600, 600], count: 1 }, env, current.memoryLedger(), { fetchImpl: stub(cases[4][1], []), catalog });
      if (small.held !== false || small.placed !== false || small.box_kept !== 0.09) diffs.push('replace judge clip: a whole-frame box over a small piece should be refused with box_kept 0.09, got ' + JSON.stringify(small));
    }
    let bad = null;
    try { await current.handleEdit({ op: 'replace_judge', code: env.TOUR_EDIT_CODE, item: row.id, crop: tiny, result: tiny, box: [0, 0, 10, 10], count: 1 }, env, current.memoryLedger(), { fetchImpl: stub(cases[0][1], []), catalog }); } catch (e) { bad = e; }
    if (!bad || bad.reason !== 'piece') diffs.push('replace judge: a box of no area should be refused with piece');
  }
  // (i) T18i: with a code given, the host says configured only for the right one; without a code the keys alone decide (the internal checks)
  {
    const d0 = current.describe(env), d1 = current.describe(env, null, env.TOUR_EDIT_CODE), d2 = current.describe(env, null, 'not-the-code-x');
    if (!d0.configured || !d1.configured || d2.configured !== false || d2.reason !== 'code') diffs.push('lock up front: expected configured true / true / false (code), got ' + JSON.stringify([d0.configured, d1.configured, d2.configured, d2.reason]));
  }
  fs.rmSync(tmp, { force: true });
  fs.rmSync(tmp2, { force: true });
  if (diffs.length) { console.error('selftest: FAIL'); for (const d of diffs) console.error('  ' + d); process.exit(1); }
  console.log(`selftest: PASS — ${fixtures.length} requests without an item equal the handler at ${golden} across attempts 1–3; a catalog turn without a piece equals the handler at ${goldenCatalog} across attempts 1–2 but for the prompt text (D-CAT-22); a catalog turn goes to nb2 with two images; a forged photo and an unknown item are refused with catalog; a tapped piece is located on the crop first (one vision call, a carried answer re-read never, a malformed first answer retried once, the fuller box in the piece line) and reaches the text step, and four bad pieces are refused with piece; a likeness answer parses; five replace-judge answers parse to their verdicts; a mangled reference string is refused or forwarded canonical; a whole-frame product box is clipped to the piece's neighbourhood and refused over a small piece; the lock answers the code up front`);
}

/* ────────────────────────────────────────────────────────────────────── the probe */
async function probe() {
  const id = arg('--item', ''), cropFile = arg('--crop', ''), lang = arg('--lang', 'en');
  const outRoot = path.resolve(arg('--out', path.join(HARNESS, 'qa-evidence', 'tour360', 'T14', 'probe')));
  if (!id || !cropFile) { console.error('usage: catalog-probe.mjs --item <id> --crop <jpg> [--out <dir>] [--lang en]'); process.exit(2); }
  const { handleEdit, catalogIndex, describe, EditError } = await import(pathToFileURL(path.join(ROOT, 'server', 'handler.mjs')).href);
  const doc = readCatalog();
  const row = doc.items.find((it) => it.id === id);
  if (!row) { console.error('catalog-probe: no item ' + id); process.exit(2); }
  const catalog = catalogIndex(doc);
  const env = loadEnv(HARNESS);
  env.TOUR_EDIT_CODE = crypto.randomBytes(9).toString('base64url'); // this run's own code; never printed
  if (!describe(env, catalog).configured) { console.error('catalog-probe: FAL_KEY or OPENROUTER_API_KEY is missing from the root .env'); process.exit(1); }
  const ledger = fileLedger(path.join(ROOT, 'apartments', 'demo-01', '_local', 'ledger.json'));
  const out = path.join(outRoot, id);
  fs.mkdirSync(out, { recursive: true });
  const crop = dataUrl(path.resolve(cropFile));
  const reference = dataUrl(path.join(LOCAL, row.image));
  const words = { sofa: 'the sofa', armchair: 'the armchair', coffee_table: 'the coffee table', dining_table: 'the dining table', chair: 'the chairs' };
  const instruction = `replace ${words[row.category] || 'the ' + row.category.replace('_', ' ')} with ${row.name}`;
  const base = { code: env.TOUR_EDIT_CODE, apartment: 'demo-01', scene: row.view === 'dining' ? 'kitchen' : 'living', lang, crop, item: id, reference };
  const record = { id, name: row.name, category: row.category, view: row.view, crop: path.relative(HARNESS, path.resolve(cropFile)), instruction, when: new Date().toISOString(), attempts: [], judge: null, likeness: null, usd: 0, error: null };
  const log = (m) => console.log('  ' + m);
  try {
    let result = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const t0 = Date.now();
      const r = await handleEdit({ ...base, instruction, attempt }, env, ledger, { log, catalog });
      record.usd += r.usd || 0;
      if (!r.ok) { record.attempts.push({ attempt, refused: r.reason, usd: r.usd }); record.error = 'refused: ' + r.reason; break; }
      const j = await handleEdit({ op: 'judge', code: env.TOUR_EDIT_CODE, apartment: 'demo-01', scene: base.scene, crop, result: r.image }, env, ledger, { log, catalog });
      record.usd += j.usd || 0;
      record.attempts.push({ attempt, model: r.model, prompt: r.prompt, target: r.target, held: j.held, iou: j.iou, ratio: j.ratio, object: j.object, usd: r.usd + j.usd, seconds: (Date.now() - t0) / 1000 });
      fs.writeFileSync(path.join(out, `result-${attempt}.jpg`), Buffer.from(r.image.slice(r.image.indexOf(',') + 1), 'base64'));
      result = r; record.judge = { held: j.held, iou: j.iou, ratio: j.ratio, object: j.object };
      if (j.held) break;
      console.log(`  attempt ${attempt}: the judge refused (overlap ${j.iou}, area x${j.ratio}) — ${attempt < 2 ? 'one more' : 'no more attempts'}`);
    }
    if (result) {
      fs.copyFileSync(path.join(out, `result-${record.attempts.length}.jpg`), path.join(out, 'result.jpg'));
      const l = await handleEdit({ op: 'likeness', code: env.TOUR_EDIT_CODE, item: id, reference, result: result.image }, env, ledger, { log, catalog });
      record.usd += l.usd || 0;
      record.likeness = { found: l.found, score: l.score, why: l.why };
    }
  } catch (e) {
    record.error = e instanceof EditError ? `${e.status} ${e.reason}: ${e.message}` : String(e && e.message || e).slice(0, 200);
    console.error('  ' + record.error);
  }
  fs.writeFileSync(path.join(out, 'crop.jpg'), Buffer.from(crop.slice(crop.indexOf(',') + 1), 'base64'));
  record.usd = Math.round(record.usd * 1000) / 1000;
  fs.writeFileSync(path.join(out, 'record.json'), JSON.stringify(record, null, 2) + '\n');
  sheet(outRoot, doc);
  const last = record.attempts[record.attempts.length - 1];
  console.log(`${record.error ? 'FAIL' : 'DONE'} ${id}: ${record.attempts.length} attempt(s)${last && last.held !== undefined ? ` · judge ${last.held ? 'held' : 'NOT held'} (overlap ${last.iou}, area x${last.ratio})` : ''}${record.likeness ? ` · likeness ${record.likeness.score}/3 — ${record.likeness.why}` : ''} · $${record.usd} · ${path.relative(HARNESS, out)}`);
  process.exit(record.error ? 1 : 0);
}

/** <out>/index.html — one row per item: the view, the product (linked from catalog/_local/, never copied), the result. */
function sheet(outRoot, doc) {
  const rows = [];
  for (const it of doc.items) {
    const dir = path.join(outRoot, it.id);
    if (!fs.existsSync(path.join(dir, 'record.json'))) continue;
    const rec = JSON.parse(fs.readFileSync(path.join(dir, 'record.json'), 'utf8'));
    const photo = path.relative(outRoot, path.join(LOCAL, it.image)).split(path.sep).join('/');
    const last = rec.attempts[rec.attempts.length - 1] || {};
    rows.push(`<section><h2>${esc(it.name)} <small>${esc(it.category)} · ${esc(it.view)} look · ${rec.attempts.length} attempt(s) · $${rec.usd}</small></h2>
<div class="row"><figure><img src="${it.id}/crop.jpg" alt=""><figcaption>the view</figcaption></figure><figure><img src="${photo}" alt=""><figcaption>the product (linked from catalog/_local/)</figcaption></figure><figure><img src="${it.id}/result.jpg" alt=""><figcaption>the result</figcaption></figure></div>
<p>judge: ${last.held === undefined ? '—' : last.held ? 'held' : 'NOT held'} (overlap ${last.iou ?? '—'}, area ×${last.ratio ?? '—'}, ${esc(last.object || '')}) · likeness: ${rec.likeness ? rec.likeness.score + '/3 — ' + esc(rec.likeness.why) : '—'}${rec.error ? ' · <b>' + esc(rec.error) + '</b>' : ''}</p>
<p class="prompt">${esc(last.prompt || '')}</p></section>`);
  }
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Tour360 catalog probe — T14</title>
<style>body{font:14px/1.5 system-ui,sans-serif;margin:24px;background:#0A1330;color:#fff}h1{font-size:20px}h2{font-size:16px;margin:28px 0 8px}small{font-weight:400;color:#bcd}.row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}figure{margin:0}img{width:100%;height:auto;background:#fff;border-radius:8px}figcaption{color:#bcd;font-size:12px;margin-top:4px}.prompt{color:#9ab;font-size:12px}</style>
<h1>Tour360 — the catalog probe (T14c). The product photos are linked from the ignored folder and are not part of this evidence.</h1>${rows.join('\n')}</html>`;
  fs.writeFileSync(path.join(outRoot, 'index.html'), html);
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ────────────────────────────────────────────────────────────────────── the report */
function report() {
  const dir = path.resolve(arg('--report', ''));
  const doc = readCatalog();
  let bad = 0;
  console.log('item        attempts  judge      overlap  area   likeness  usd     seconds  result');
  for (const it of doc.items) {
    const rec = path.join(dir, it.id, 'record.json');
    if (!fs.existsSync(rec)) { console.log(`${it.id.padEnd(11)} — no record`); bad++; continue; }
    const r = JSON.parse(fs.readFileSync(rec, 'utf8'));
    const last = r.attempts[r.attempts.length - 1] || {};
    const pic = fs.existsSync(path.join(dir, it.id, 'result.jpg'));
    if (!pic || r.error) bad++;
    console.log(`${it.id.padEnd(11)} ${String(r.attempts.length).padEnd(9)} ${(last.held === undefined ? '—' : last.held ? 'held' : 'NOT held').padEnd(10)} ${String(last.iou ?? '—').padEnd(8)} ${String(last.ratio ?? '—').padEnd(6)} ${String(r.likeness ? r.likeness.score + '/3' : '—').padEnd(9)} ${String(r.usd).padEnd(7)} ${String(last.seconds ? last.seconds.toFixed(1) : '—').padEnd(8)} ${pic ? 'result.jpg' : 'MISSING'}${r.error ? ' · ' + r.error : ''}`);
  }
  const ledger = fileLedger(path.join(ROOT, 'apartments', 'demo-01', '_local', 'ledger.json')).load();
  const cat = ledger.rows.filter((row) => row.item);
  const spent = cat.reduce((t, row) => t + (row.settled_usd ?? row.reserved_usd ?? 0), 0);
  const nb2 = cat.filter((row) => row.op === 'live_edit' && row.status === 'settled').map((row) => row.settled_usd);
  console.log(`ledger: ${cat.length} catalog rows, $${spent.toFixed(3)} settled; nb2 turns settled at ${nb2.length ? [...new Set(nb2)].map((v) => '$' + v).join(', ') : '—'} (the plan assumed $0.083 a turn with the text step)`);
  process.exit(bad ? 1 : 0);
}

if (has('--selftest')) await selftest();
else if (has('--report')) report();
else if (has('--item')) await probe();
else { console.error('usage: catalog-probe.mjs --selftest | --item <id> --crop <jpg> | --report <dir>'); process.exit(2); }
