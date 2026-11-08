// plan studio-agent-fal: the fal backend of lib/llm.mjs and the developer chat, against a LOCAL mock of fal ($0, no network).
//   node test/llm-fal.test.mjs
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod/v4';
import { structured, backendFor } from '../lib/llm.mjs';
import { falLLM, FAL_LLM_ENDPOINT } from '../lib/fal-llm.mjs';
import { ProjectStore } from '../lib/projects.mjs';
import { ask, history, context } from '../lib/chat.mjs';

let failures = 0;
async function test(name, fn) {
  try { const note = await fn(); console.log('ok   ' + name + (note ? `  (${note})` : '')); }
  catch (e) { failures++; console.log('FAIL ' + name + '\n     ' + String(e.stack || e).split('\n').slice(0, 3).join('\n     ')); }
}

// the mock fal: records every request; answers by the prompt
const seen = [];
let answer = (body) => ({ output: '{"rooms": 3, "name": "דירה 846"}', usage: { cost: 0.0123, prompt_tokens: 900, completion_tokens: 40, total_tokens: 940 } });
const server = http.createServer((req, res) => {
  let b = ''; req.on('data', (c) => { b += c; });
  req.on('end', () => {
    const body = JSON.parse(b || '{}'); seen.push({ url: req.url, auth: req.headers.authorization, body });
    const a = answer(body); res.writeHead(a.status || 200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(a));
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
process.env.HABAIT_FAL_BASE = BASE;
const KEY = 'test-key-not-a-secret';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'habait-fal-'));
const pdf = path.join(tmp, 'plan.pdf'); fs.writeFileSync(pdf, '%PDF-1.4\n%%EOF\n');
const png = path.join(tmp, 'r.png'); fs.writeFileSync(png, Buffer.from('89504e470d0a1a0a', 'hex'));

await test('backendFor: fal when FAL_KEY + spending on; an explicit HABAIT_LLM_BACKEND wins; mock first', () => {
  assert.equal(backendFor({ FAL_KEY: 'x', ALLOW_SPEND: true }), 'fal');
  assert.equal(backendFor({ FAL_KEY: 'x', ALLOW_SPEND: false, ANTHROPIC_API_KEY: 'y' }), 'api');
  assert.equal(backendFor({ FAL_KEY: 'x', ALLOW_SPEND: true, LLM_BACKEND: 'cli' }), 'cli');
  assert.equal(backendFor({ MOCK_LLM: true, FAL_KEY: 'x', ALLOW_SPEND: true }), 'mock');
});

await test('falLLM: POST <base>/openrouter/router/vision, Key auth, pdf + image as data URIs, usage.cost read', async () => {
  seen.length = 0;
  const r = await falLLM({ key: KEY, model: 'm/x', system: 'S', prompt: 'P', pdfs: [pdf], images: [{ file: png, mediaType: 'image/png' }], maxTokens: 100 });
  assert.equal(r.ok, true); assert.equal(r.usd, 0.0123);
  const q = seen[0];
  assert.equal(q.url, `/${FAL_LLM_ENDPOINT}`); assert.equal(q.auth, `Key ${KEY}`);
  assert.equal(q.body.model, 'm/x'); assert.equal(q.body.system_prompt, 'S'); assert.equal(q.body.max_tokens, 100);
  assert.ok(q.body.pdf_urls[0].startsWith('data:application/pdf;base64,')); assert.ok(q.body.image_urls[0].startsWith('data:image/png;base64,'));
  return `${JSON.stringify(Object.keys(q.body))}`;
});

await test('falLLM: no key → refused before any request; HTTP error → ok:false with the status', async () => {
  seen.length = 0;
  assert.equal((await falLLM({ key: '', prompt: 'P' })).ok, false); assert.equal(seen.length, 0);
  answer = () => ({ status: 402, detail: 'payment required' });
  const r = await falLLM({ key: KEY, prompt: 'P' }); assert.equal(r.ok, false); assert.match(r.note, /HTTP 402/);
  answer = (body) => ({ output: '{"rooms": 3, "name": "דירה 846"}', usage: { cost: 0.0123 } });
});

await test('structured() on fal: schema in the prompt, the answer zod-checked, usd returned', async () => {
  seen.length = 0;
  const schema = z.object({ rooms: z.number(), name: z.string() });
  const r = await structured({ env: { FAL_KEY: KEY, ALLOW_SPEND: true, FAL_LLM_MODEL: 'm/x' }, dir: tmp, inputs: [{ name: 'plan.pdf', full: pdf, kind: 'pdf' }], system: 'SYS', task: 'Read it.', schema, allowFal: true });
  assert.equal(r.ok, true, r.note); assert.equal(r.backend, 'fal'); assert.deepEqual(r.data, { rooms: 3, name: 'דירה 846' }); assert.equal(r.usd, 0.0123);
  assert.match(seen[0].body.prompt, /JSON Schema/); assert.match(seen[0].body.prompt, /"rooms"/);
  answer = () => ({ output: 'not json at all', usage: { cost: 0.01 } });
  const bad = await structured({ env: { FAL_KEY: KEY, ALLOW_SPEND: true }, dir: tmp, inputs: [], system: 'S', task: 'T', schema, allowFal: true });
  assert.equal(bad.ok, false); assert.match(bad.note, /not a JSON object/);
  answer = () => ({ output: '{"rooms": "three"}', usage: { cost: 0.01 } });
  const wrong = await structured({ env: { FAL_KEY: KEY, ALLOW_SPEND: true }, dir: tmp, inputs: [], system: 'S', task: 'T', schema, allowFal: true });
  assert.equal(wrong.ok, false); assert.match(wrong.note, /does not match the schema/);
});

await test('review 2a: fal only for a caller that bills it (allowFal) and only with spending on — else no fal request', async () => {
  seen.length = 0;
  const schema = z.object({ rooms: z.number(), name: z.string() });
  const a = await structured({ env: { FAL_KEY: KEY, ALLOW_SPEND: true }, dir: tmp, inputs: [], system: 'S', task: 'T', schema });
  const b = await structured({ env: { FAL_KEY: KEY, ALLOW_SPEND: false, LLM_BACKEND: 'fal' }, dir: tmp, inputs: [], system: 'S', task: 'T', schema, allowFal: true });
  assert.equal(seen.length, 0, 'no request reached fal');
  assert.notEqual(a.backend, 'fal'); assert.notEqual(b.backend, 'fal');
  return `fell back to ${a.backend} / ${b.backend}`;
});

// ---- the developer chat
const store = new ProjectStore(path.join(tmp, 'projects'));
const p = store.create({ name: 'chat-test', address: 'רחוב בדיקה 1', notes: 'הערה\n[roles] {"plan.pdf":"sale-plan"}' });
store.addFile(p.id, 'plan.pdf', Buffer.from('%PDF-1.4'));
store.saveDerived(p.id, 'intake.json', { unit: { number: '846', rooms_count: 3, area_m2: 106.72 }, uncertainties: ['floors not printed'], confidence: 0.82 });

await test('chat context = this project only: name, files with roles, the intake JSON, no role machine line', () => {
  const c = context(store, p.id);
  assert.match(c, /chat-test/); assert.match(c, /plan\.pdf .*role: sale-plan/); assert.match(c, /106\.72/); assert.match(c, /floors not printed/);
  assert.doesNotMatch(c, /\[roles\]/);
});

await test('chat refuses without spending on / over the cap; nothing is called, nothing ledgered', async () => {
  seen.length = 0;
  const off = await ask({ env: { FAL_KEY: KEY, ALLOW_SPEND: false, CAP_USD: 10 }, store, id: p.id, question: 'כמה חדרים?' });
  assert.equal(off.ok, false); assert.match(off.error, /HABAIT_ALLOW_SPEND/);
  store.spend(p.id, { stage: 'test', usd: 9.99, note: 'fill the cap' });
  const cap = await ask({ env: { FAL_KEY: KEY, ALLOW_SPEND: true, CAP_USD: 10 }, store, id: p.id, question: 'כמה חדרים?' });
  assert.equal(cap.ok, false); assert.match(cap.error, /תקרת/);
  assert.equal(seen.length, 0); assert.equal(history(store, p.id).length, 0);
});

await test('chat on fal: grounded system prompt, reply saved to chat.json, cost ledgered as stage chat', async () => {
  const q = new ProjectStore(path.join(tmp, 'projects2')); const id = q.create({ name: 'chat-2' }).id;
  q.saveDerived(id, 'intake.json', { unit: { rooms_count: 3 } });
  seen.length = 0; answer = () => ({ output: 'לפי התכנית יש 3 חדרים.', usage: { cost: 0.004, total_tokens: 500 } });
  const r = await ask({ env: { FAL_KEY: KEY, ALLOW_SPEND: true, CAP_USD: 10, FAL_LLM_MODEL: 'm/x' }, store: q, id, question: 'כמה חדרים?' });
  assert.equal(r.ok, true, r.error); assert.equal(r.reply, 'לפי התכנית יש 3 חדרים.');
  assert.match(seen[0].body.system_prompt, /ONLY from the PROJECT DATA/); assert.match(seen[0].body.system_prompt, /"rooms_count": 3/);
  assert.equal(seen[0].body.max_tokens, 1200);
  assert.equal(history(q, id).length, 2);
  const led = q.ledger(id); assert.equal(led.at(-1).stage, 'chat'); assert.equal(led.at(-1).usd, 0.004);
  // the second turn carries the first
  await ask({ env: { FAL_KEY: KEY, ALLOW_SPEND: true, CAP_USD: 10 }, store: q, id, question: 'ומה השטח?' });
  assert.match(seen[1].body.prompt, /כמה חדרים\?/); assert.equal(history(q, id).length, 4);
});

await test('review 2b: a second paid question while one is under way is refused (no cap race)', async () => {
  const q = new ProjectStore(path.join(tmp, 'projects3')); const id = q.create({ name: 'chat-3' }).id;
  let release; const gate = new Promise((r) => { release = r; });
  const slow = http.createServer((req, res) => { req.resume(); req.on('end', async () => { await gate; res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ output: 'תשובה', usage: { cost: 0.01 } })); }); });
  await new Promise((r) => slow.listen(0, '127.0.0.1', r));
  process.env.HABAIT_FAL_BASE = `http://127.0.0.1:${slow.address().port}`;
  const env = { FAL_KEY: KEY, ALLOW_SPEND: true, CAP_USD: 10 };
  const first = ask({ env, store: q, id, question: 'א' });
  await new Promise((r) => setTimeout(r, 50));
  const second = await ask({ env, store: q, id, question: 'ב' });
  release(); const one = await first; slow.close(); process.env.HABAIT_FAL_BASE = BASE;
  assert.equal(second.ok, false); assert.match(second.error, /עדיין עונה/);
  assert.equal(one.ok, true); assert.equal(q.ledger(id).filter((r) => r.stage === 'chat').length, 1);
});

server.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures ? `${failures} failed` : 'all passed');
process.exit(failures ? 1 : 0);
