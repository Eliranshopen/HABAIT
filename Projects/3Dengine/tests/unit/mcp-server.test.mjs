import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { createServer, runStdio, negotiateProtocol, toolSuccess, toolFailure, ERR, SERVER_NAME, PROTOCOL_VERSIONS } from '../../mcp/server.mjs';
import { EngineError } from '../../engine/inbox.mjs';
import { TOOL_NAMES } from '../../mcp/tools.mjs';
import { sink, stubConfig } from '../helpers/fakes.mjs';

const handlers = Object.fromEntries(TOOL_NAMES.map((n) => [n, async () => ({ jobs: [] })]));
handlers.get_job = ({ job_id }) => { throw new EngineError('JOB_NOT_FOUND', `no job ${job_id}`); };
handlers.cancel_job = () => { throw new Error('disk on fire'); };
const logs = [];
const server = createServer({ handlers, version: '9.9.9', log: (m) => logs.push(m) });
const rq = (method, params, id = 1) => server.handleMessage({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) });

test('initialize negotiates the protocol version', async () => {
  for (const v of PROTOCOL_VERSIONS) assert.equal((await rq('initialize', { protocolVersion: v })).result.protocolVersion, v);
  const r = await rq('initialize', { protocolVersion: '1999-01-01' });
  assert.deepEqual(r, { jsonrpc: '2.0', id: 1, result: { protocolVersion: '2025-06-18',
    capabilities: { tools: { listChanged: false } }, serverInfo: { name: SERVER_NAME, version: '9.9.9' } } });
  assert.equal(negotiateProtocol(undefined), '2025-06-18');
  assert.equal((await rq('initialize')).result.protocolVersion, '2025-06-18');
});

test('ping, tools/list, notifications get no reply, unknown method -32601', async () => {
  assert.deepEqual((await rq('ping', undefined, 'a')).result, {});
  assert.equal((await rq('tools/list')).result.tools.length, 8);
  assert.equal(await server.handleMessage({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  assert.equal(await server.handleMessage({ jsonrpc: '2.0', method: 'nope' }), null, 'even an unknown notification');
  assert.equal((await rq('resources/list')).error.code, ERR.METHOD);
});

test('tools/call: success shape, tool failure is a RESULT, bad name/args -32602, crash -32603', async () => {
  const ok = await rq('tools/call', { name: 'list_jobs', arguments: {} });
  assert.deepEqual(ok.result, { content: [{ type: 'text', text: '{"jobs":[]}' }], structuredContent: { jobs: [] } });
  const noArgs = await rq('tools/call', { name: 'list_jobs' });
  assert.ok(noArgs.result);
  const fail = await rq('tools/call', { name: 'get_job', arguments: { job_id: '0000000000000000' } });
  assert.deepEqual(fail.result, { isError: true, content: [{ type: 'text', text: 'JOB_NOT_FOUND: no job 0000000000000000' }],
    structuredContent: { error: { code: 'JOB_NOT_FOUND', message: 'no job 0000000000000000' } } });
  assert.equal((await rq('tools/call', { name: 'nope', arguments: {} })).error.code, ERR.PARAMS);
  assert.equal((await rq('tools/call', {})).error.code, ERR.PARAMS);
  const bad = await rq('tools/call', { name: 'list_jobs', arguments: { limit: 0, x: 1 } });
  assert.equal(bad.error.code, ERR.PARAMS);
  assert.equal(bad.error.data.errors.length, 2);
  const crash = await rq('tools/call', { name: 'cancel_job', arguments: { job_id: '0000000000000000' } });
  assert.equal(crash.error.code, ERR.INTERNAL);
  assert.match(logs.join('\n'), /disk on fire/);
  assert.equal((await createServer({ handlers: {} }).handleMessage({ jsonrpc: '2.0', id: 2, method: 'tools/call',
    params: { name: 'list_jobs', arguments: {} } })).error.code, ERR.PARAMS, 'a listed tool with no handler');
});

test('QA round 2: an errno error never puts its local path into -32603; a plain Error keeps its message', async () => {
  const PATH = 'C:\\Users\\someone\\AppData\\Local\\Temp\\home\\jobs\\abc\\job.lock';
  const local = [];
  const s = createServer({
    handlers: {
      ...handlers,
      start_simulation: () => { throw Object.assign(new Error(`EEXIST: file already exists, mkdir '${PATH}'`), { code: 'EEXIST' }); },
      approve_paid_stage: async () => { throw Object.assign(new Error(`EPERM: operation not permitted, copyfile '${PATH}'`), { code: 'EPERM' }); },
      cancel_job: () => { throw new Error('job abc: lock busy'); },
      get_result: () => { throw Object.assign(new Error('not a file error'), { code: 'ERR_SOMETHING' }); },
      get_job: () => { throw Object.assign(new Error(`UNKNOWN: unknown error, open '${PATH}'`), { code: 'UNKNOWN' }); },
      list_jobs: () => { throw Object.assign(new Error(`Path is a directory: rm returned EISDIR (is a directory) ${PATH}`), { code: 'ERR_FS_EISDIR' }); },
    },
    log: (m) => local.push(m),
  });
  const call = (name, args) => s.handleMessage({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name, arguments: args } });
  const a = await call('start_simulation', { pdf_path: 'x.pdf' });
  assert.equal(a.error.code, ERR.INTERNAL);
  assert.equal(a.error.message, 'internal error in start_simulation: a file error of the engine (EEXIST)');
  const b = await call('approve_paid_stage', { job_id: '0000000000000000', cap_usd: 1 });
  assert.equal(b.error.message, 'internal error in approve_paid_stage: a file error of the engine (EPERM)');
  for (const r of [a, b]) assert.ok(!JSON.stringify(r).includes('Users') && !JSON.stringify(r).includes('AppData'), JSON.stringify(r));
  assert.ok(local.some((l) => l.includes('EEXIST')), 'the whole error goes to the log (stderr)');
  assert.equal((await call('cancel_job', { job_id: '0000000000000000' })).error.message, 'internal error in cancel_job: job abc: lock busy');
  assert.equal((await call('get_result', { job_id: '0000000000000000' })).error.message, 'internal error in get_result: not a file error');
  // Windows' UNKNOWN and Node's own ERR_FS_ codes are file errors too: their messages hold the path as well.
  assert.equal((await call('get_job', { job_id: '0000000000000000' })).error.message, 'internal error in get_job: a file error of the engine (UNKNOWN)');
  assert.equal((await call('list_jobs', {})).error.message, 'internal error in list_jobs: a file error of the engine (ERR_FS_EISDIR)');
});

test('invalid requests -32600; client responses ignored; parse error -32700 with id null; blank lines ignored', async () => {
  assert.deepEqual(await server.handleMessage([1]), { jsonrpc: '2.0', id: null, error: { code: ERR.INVALID_REQUEST, message: 'invalid request' } });
  assert.equal((await server.handleMessage({ jsonrpc: '1.0', id: 3, method: 'ping' })).id, 3);
  assert.equal((await server.handleMessage({ id: 4 })).error.code, ERR.INVALID_REQUEST);
  assert.equal((await server.handleMessage(null)).id, null);
  assert.equal(await server.handleMessage({ jsonrpc: '2.0', id: 5, result: {} }), null);
  assert.deepEqual(await server.handleLine('{nope'), { jsonrpc: '2.0', id: null, error: { code: ERR.PARSE, message: 'parse error' } });
  assert.equal(await server.handleLine('   '), null);
  assert.equal((await server.handleLine('{"jsonrpc":"2.0","id":7,"method":"ping"}')).id, 7);
});

test('toolSuccess / toolFailure shapes', () => {
  assert.deepEqual(toolSuccess({ a: 1 }), { content: [{ type: 'text', text: '{"a":1}' }], structuredContent: { a: 1 } });
  assert.equal(toolFailure('X', 'y').content[0].text, 'X: y');
});

test('runStdio: one JSON line per answer on stdout, logs on stderr, ends when stdin ends', async () => {
  const stdin = new PassThrough();
  const stdout = sink();
  const stderr = sink();
  let kicked = 0;
  let stopped = 0;
  const engine = { handlers, doctor: { kick: () => kicked++, stop: () => stopped++ } };
  const done = runStdio({ config: stubConfig(), stdin, stdout, stderr, engine });
  stdin.write('{"jsonrpc":"2.0","id":1,"method":"ping"}\n');
  stdin.write('{"jsonrpc":"2.0","method":"notifications/initialized"}\n');
  stdin.write('garbage\n');
  stdin.end('{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_jobs","arguments":{}}}\n');
  assert.equal(await done, 0);
  const lines = stdout.text.trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(lines.length, 3);
  assert.deepEqual(lines.map((l) => l.id).sort(), [1, 2, null].sort());
  assert.match(stderr.text, /\[habait-engine\] stdin closed/);
  assert.equal(kicked, 1);
  assert.equal(stopped, 1);
});

test('runStdio with the default stub engine answers tools/list', async () => {
  const stdin = new PassThrough();
  const stdout = sink();
  const config = stubConfig();
  const done = runStdio({ config, stdin, stdout, stderr: sink(),
    engine: undefined });
  stdin.end('{"jsonrpc":"2.0","id":1,"method":"tools/list"}\n');
  assert.equal(await done, 0);
  assert.equal(JSON.parse(stdout.text).result.tools.length, 8);
});
