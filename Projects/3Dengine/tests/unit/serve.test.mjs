import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { startServe, resolveRequest, contentType, isListening, ensureServe, localUrl, serveFile } from '../../engine/serve.mjs';
import { tempDir, writeFile, stubConfig } from '../helpers/fakes.mjs';

const root = tempDir('site-');
writeFile(`${root}/index.html`, '<p>home</p>');
writeFile(`${root}/tour/index.html`, '<p>tour</p>');
writeFile(`${root}/a b/c.json`, '{"x":1}');
writeFile(`${root}/data.bin`, 'xx');
fs.mkdirSync(`${root}/empty`);
writeFile(`${tempDir('secret-')}/secret.txt`, 'secret');

const server = await startServe({ root, host: '127.0.0.1', port: 0 });
const port = server.address().port;
after(() => new Promise((r) => server.close(r)));

function req(method, p) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, method, path: p }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (d) => { body += d; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    r.on('error', reject);
    r.end();
  });
}

test('GET a file, a folder index, an encoded path; content types', async () => {
  let r = await req('GET', '/tour/?scope=apartment&room=x');
  assert.equal(r.status, 200);
  assert.equal(r.body, '<p>tour</p>');
  assert.equal(r.headers['content-type'], 'text/html; charset=utf-8');
  r = await req('GET', '/');
  assert.equal(r.body, '<p>home</p>');
  r = await req('GET', '/a%20b/c.json');
  assert.equal(r.status, 200);
  assert.equal(r.headers['content-type'], 'application/json; charset=utf-8');
  r = await req('GET', '/data.bin');
  assert.equal(r.headers['content-type'], 'application/octet-stream');
});

test('HEAD has headers and no body; other methods → 405', async () => {
  let r = await req('HEAD', '/tour/');
  assert.equal(r.status, 200);
  assert.equal(r.headers['content-length'], String('<p>tour</p>'.length));
  assert.equal(r.body, '');
  r = await req('POST', '/tour/');
  assert.equal(r.status, 405);
  assert.equal(r.headers.allow, 'GET, HEAD');
  r = await req('HEAD', '/missing');
  assert.equal(r.status, 404);
  assert.equal(r.body, '');
});

test('a folder without slash redirects (query kept); no listing; missing → 404', async () => {
  let r = await req('GET', '/tour?scope=apartment');
  assert.equal(r.status, 301);
  assert.equal(r.headers.location, '/tour/?scope=apartment');
  r = await req('GET', '/empty/');
  assert.equal(r.status, 404);
  r = await req('GET', '/nope.html');
  assert.equal(r.status, 404);
});

test('no path outside the root: traversal, encoded traversal, bad encoding, NUL', async () => {
  assert.equal((await req('GET', '/..%2f..%2fsecret.txt')).status, 403);
  assert.equal((await req('GET', '/%E0%A4%A')).status, 400);
  assert.equal((await req('GET', '/a%00b')).status, 400);
  assert.equal(resolveRequest(root, '/../../x').status, 403);
  assert.equal(resolveRequest(root, 'tour/').status, 200);
});

test('a link inside the root that leads outside → 403 (a directory junction: no privilege needed)', async () => {
  const outside = tempDir('out-');
  writeFile(`${outside}/s.txt`, 's');
  fs.symlinkSync(outside, `${root}/linked`, 'junction');
  assert.equal(resolveRequest(root, '/linked/s.txt').status, 403);
  assert.equal((await req('GET', '/linked/s.txt')).status, 403);
});

test('contentType by extension; startServe refuses a missing root', async () => {
  assert.equal(contentType('x/Y.PNG'), 'image/png');
  assert.equal(contentType('x/y'), 'application/octet-stream');
  await assert.rejects(startServe({ root: `${root}/nope`, port: 0 }), /not a folder/);
  await assert.rejects(startServe({ root, host: '127.0.0.1', port }), /EADDRINUSE/);
});

test('isListening, localUrl, serveFile', async () => {
  assert.equal(await isListening('127.0.0.1', port), true);
  const c = stubConfig({ serve: { host: '127.0.0.1', port: 5 } });
  assert.equal(localUrl(c), 'http://127.0.0.1:5/tour/?scope=apartment');
  assert.equal(serveFile(c), `${c.runtimeDir}/serve.json`);
});

test('ensureServe: already listening → nothing started', async () => {
  const c = stubConfig({ serve: { host: '127.0.0.1', port } });
  const r = await ensureServe(c, { spawn: () => assert.fail('must not spawn') });
  assert.deepEqual(r, { started: false, listening: true });
});

test('ensureServe: nothing listening → spawns detached cli serve, records serve.json, waits until it listens', async () => {
  const probe = await startServe({ root, host: '127.0.0.1', port: 0 });
  const freePort = probe.address().port;
  await new Promise((r) => probe.close(r));
  const c = stubConfig({ serve: { host: '127.0.0.1', port: freePort } });
  let spawned;
  let late;
  const r = await ensureServe(c, {
    spawn: (script, args, opts) => {
      spawned = { script, args, opts };
      // stands in for the detached process: starts listening a moment later
      setTimeout(async () => { late = await startServe({ root, host: '127.0.0.1', port: freePort }); }, 30);
      return 4242;
    },
  });
  try {
    assert.deepEqual(r, { started: true, listening: true, pid: 4242 });
    assert.match(spawned.script.replace(/\\/g, '/'), /engine\/cli\.mjs$/);
    assert.deepEqual(spawned.args, ['serve', '--root', c.stub.siteRoot, '--port', String(freePort), '--host', '127.0.0.1']);
    assert.equal(spawned.opts.logFile, `${c.runtimeDir}/serve.log`);
    const rec = JSON.parse(fs.readFileSync(serveFile(c), 'utf8'));
    assert.equal(rec.pid, 4242);
    assert.equal(rec.root, c.stub.siteRoot);
  } finally {
    await new Promise((res) => late.close(res));
  }
});

test('ensureServe: a server that never comes up → listening false after waitMs', async () => {
  const probe = await startServe({ root, host: '127.0.0.1', port: 0 });
  const freePort = probe.address().port;
  await new Promise((r) => probe.close(r));
  const c = stubConfig({ serve: { host: '127.0.0.1', port: freePort } });
  const r = await ensureServe(c, { spawn: () => 1, waitMs: 100 });
  assert.deepEqual(r, { started: true, listening: false, pid: 1 });
});
