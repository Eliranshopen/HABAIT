// Node smoke test: schemas + fixture cross-checks, the Range server, and the pure lead/analytics helpers.
//   node test/smoke.mjs
import assert from 'node:assert/strict';
import { validateProjectDir, validateSchema, unitsSchema, flowSchema } from '../contracts/validate.mjs';
import { start, ROOT } from '../serve.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log('ok   ' + name); }
  catch (e) { failures++; console.log('FAIL ' + name + '\n     ' + (e.stack || e).toString().split('\n').slice(0, 3).join('\n     ')); }
}

await test('fixture rainbow validates', () => {
  const r = validateProjectDir(join(ROOT, 'fixtures/rainbow'));
  assert.deepEqual(r.errors, []);
  assert.ok(r.units.units.length >= 10, 'at least 10 units');
  assert.ok(r.units.units.some((u) => u.id === '846'));
  assert.ok(r.flow.segments.some((s) => s.id === 'hold-facade' && s.role === 'hold'));
});

await test('schema rejects a bad status / missing field / unknown next', () => {
  const units = JSON.parse(readFileSync(join(ROOT, 'fixtures/rainbow/units.json'), 'utf8'));
  units.units[0].status = 'maybe';
  const e1 = validateSchema(unitsSchema, units);
  assert.ok(e1.some((e) => e.includes('status')), e1.join('; '));
  delete units.units[1].price;
  assert.ok(validateSchema(unitsSchema, units).some((e) => e.includes('missing required "price"')));
  const flow = JSON.parse(readFileSync(join(ROOT, 'fixtures/rainbow/flow.json'), 'utf8'));
  flow.segments[0].kind = 'gif';
  assert.ok(validateSchema(flowSchema, flow).some((e) => e.includes('kind')));
});

await test('cross-check catches a dangling reference', async () => {
  const { crossCheck } = await import('../contracts/validate.mjs');
  const units = JSON.parse(readFileSync(join(ROOT, 'fixtures/rainbow/units.json'), 'utf8'));
  const flow = JSON.parse(readFileSync(join(ROOT, 'fixtures/rainbow/flow.json'), 'utf8'));
  flow.segments[0].next = 'nowhere';
  units.units[0].hotspots[0].segment = 'ghost';
  const r = crossCheck({ units, flow, project: null, dir: null });
  assert.ok(r.errors.some((e) => e.includes('nowhere')));
  assert.ok(r.errors.some((e) => e.includes('ghost')));
});

await test('lead: WhatsApp link pattern', async () => {
  const { buildWhatsAppLink, validateLead } = await import('../js/lead.js');
  const url = buildWhatsAppLink({ number: '+972-50-000-0000', project: 'rainbow', unit: '846', session: 'abc' });
  assert.equal(url, 'https://wa.me/972500000000?text=' + encodeURIComponent('rainbow|846|abc'));
  assert.deepEqual(validateLead({ name: 'Dana', phone: '0501234567', consent: true }), []);
  assert.deepEqual(validateLead({ name: 'D', phone: '12', consent: false }), ['name', 'phone', 'consent']);
});

await test('lead: submit with no webhook is a stub; with webhook POSTs JSON', async () => {
  const { submitLead } = await import('../js/lead.js');
  const r0 = await submitLead({ webhookUrl: '', data: { unit: '846' } });
  assert.equal(r0.stubbed, true);
  let got = null;
  const r1 = await submitLead({ webhookUrl: 'https://script.google.com/macros/s/X/exec', data: { unit: '846', project: 'rainbow' }, fetchImpl: async (u, o) => { got = { u, o }; return { type: 'opaque', status: 0 }; } });
  assert.equal(r1.ok, true);
  assert.equal(got.o.method, 'POST');
  assert.equal(JSON.parse(got.o.body).unit, '846');
});

await test('analytics: capture without a key logs and buffers', async () => {
  const a = await import('../js/analytics.js');
  a.initAnalytics({ debug: false, base: { project: 'rainbow' } });
  const p = a.capture('unit_click', { unit: '846' });
  assert.equal(p.event, 'unit_click');
  assert.equal(p.properties.project, 'rainbow');
  assert.ok(p.properties.session_id);
  a.capture('unit_enter', { unit: '846' });
  assert.deepEqual(a.unitsViewed(), ['846']);
  for (const e of ['unit_hover', 'unit_click', 'unit_enter', 'lead_click', 'lead_submitted', 'tour_handoff', 'apartment_tab', 'zip_download', 'room_view', 'floor_switch', 'favorite']) assert.ok(a.EVENTS.includes(e), e);
  assert.equal(a.EVENTS.length, 14); // card 24: room_view / floor_switch / favorite folded in
});

await test('picker: module loads in node and exports createPicker', async () => {
  const m = await import('../js/picker.js');
  assert.equal(typeof m.createPicker, 'function');
  assert.deepEqual(m.STATUSES, ['for-sale', 'reserved', 'sold', 'unknown']);
  assert.ok(m.PICKER_STR.he['picker.title'] && m.PICKER_STR.en['picker.aptPage']);
  assert.throws(() => m.createPicker({}), /container is required/);
});

const server = await start(0, '127.0.0.1');
const base = `http://127.0.0.1:${server.address().port}`;

await test('server: index, flow, three.js module, json', async () => {
  for (const p of ['/', '/index.html', '/flow.html', '/projects.json', '/fixtures/rainbow/flow.json', '/node_modules/three/build/three.module.js', '/js/flow.js', '/js/picker.js', '/css/style.css']) {
    const r = await fetch(base + p);
    assert.equal(r.status, 200, p);
  }
  assert.match((await fetch(base + '/js/flow.js')).headers.get('content-type'), /javascript/);
  assert.match((await fetch(base + '/fixtures/rainbow/approach.mp4', { method: 'HEAD' })).headers.get('content-type'), /video\/mp4/);
});

await test('server: CORS * on .js/.css/.json (habait-89 imports js/picker.js from another origin)', async () => {
  for (const p of ['/js/picker.js', '/js/i18n.js', '/js/analytics.js', '/js/lead.js', '/css/style.css', '/fixtures/rainbow/units.json', '/fixtures/rainbow/project.json']) {
    const r = await fetch(base + p, { headers: { Origin: 'http://127.0.0.1:8899' } });
    assert.equal(r.status, 200, p);
    assert.equal(r.headers.get('access-control-allow-origin'), '*', p);
  }
  assert.match((await fetch(base + '/js/picker.js')).headers.get('content-type'), /javascript/);
});

await test('server: Range -> 206 with Content-Range', async () => {
  const head = await fetch(base + '/fixtures/rainbow/approach.mp4', { method: 'HEAD' });
  const size = Number(head.headers.get('content-length'));
  assert.ok(size > 100000);
  assert.equal(head.headers.get('accept-ranges'), 'bytes');
  const r = await fetch(base + '/fixtures/rainbow/approach.mp4', { headers: { Range: 'bytes=100-199' } });
  assert.equal(r.status, 206);
  assert.equal(r.headers.get('content-range'), `bytes 100-199/${size}`);
  assert.equal((await r.arrayBuffer()).byteLength, 100);
  const tail = await fetch(base + '/fixtures/rainbow/approach.mp4', { headers: { Range: 'bytes=-50' } });
  assert.equal(tail.status, 206);
  assert.equal(tail.headers.get('content-range'), `bytes ${size - 50}-${size - 1}/${size}`);
  const open = await fetch(base + '/fixtures/rainbow/approach.mp4', { headers: { Range: `bytes=${size - 10}-` } });
  assert.equal(open.status, 206);
  assert.equal((await open.arrayBuffer()).byteLength, 10);
  const bad = await fetch(base + '/fixtures/rainbow/approach.mp4', { headers: { Range: `bytes=${size + 5}-` } });
  assert.equal(bad.status, 416);
});

await test('server: 404 and traversal', async () => {
  assert.equal((await fetch(base + '/nope.txt')).status, 404);
  const r = await fetch(base + '/..%2F..%2Fpackage.json');
  assert.ok([400, 404].includes(r.status), String(r.status));
  assert.equal((await fetch(base + '/', { method: 'POST' })).status, 405);
});

await test('server: events sink mounted (card 24): announced, Origin required, empty batch writes nothing', async () => {
  assert.match((await fetch(base + '/flow.html')).headers.get('server-timing') || '', /habait-sink;desc="\/api\/events"/);
  assert.equal((await fetch(base + '/api/events', { method: 'POST', body: '[]' })).status, 403); // no Origin (curl-like)
  const ok = await fetch(base + '/api/events', { method: 'POST', headers: { Origin: base }, body: '[]' });
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get('x-habait-events'), '0');
  assert.equal((await fetch(base + '/api/events')).status, 405);
});

server.close();
console.log(failures ? `\n${failures} failure(s)` : '\nall green');
process.exit(failures ? 1 : 0);
