// The clean-up the tests share (tests/helpers/cleanup.mjs): stop what a temp home left running, then remove it.
// The last test is the real case QA round 8 of milestone 0.3 saw: two static servers started at the same
// moment, the record names the one that lost, and the one that won keeps the temp home from being removed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tempDir, writeFile } from '../helpers/fakes.mjs';
import { pidAlive } from '../../engine/lib/proc.mjs';
import { isListening } from '../../engine/serve.mjs';
import { stopPids, processesOf, stopServers, removeHome, RM } from '../helpers/cleanup.mjs';

const CLI = fileURLToPath(new URL('../../engine/cli.mjs', import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A small world of fake processes: `live` is the set of pids that are alive; a kill removes one.
function world(pids, { immortal = [] } = {}) {
  const live = new Set(pids);
  const killed = [];
  return {
    live, killed,
    alive: (p) => live.has(p),
    kill: (p) => {
      killed.push(p);
      if (!immortal.includes(p)) live.delete(p);
    },
  };
}

test('stopPids kills the live pids once each, never this process, and names the ones that stay', async () => {
  const w = world([11, 12, 13, process.pid], { immortal: [13] });
  const left = await stopPids([11, 11, 12, 13, 14, process.pid, 0, -5, NaN, '11'], { alive: w.alive, kill: w.kill, waitMs: 120 });
  assert.deepEqual(w.killed, [11, 12, 13], 'live pids, once each; not the dead 14, not this process, no junk');
  assert.deepEqual(left, [13]);
  assert.ok(w.live.has(process.pid));
});

test('stopPids survives a kill that throws (the process ended by itself in the meantime)', async () => {
  const live = new Set([21]);
  const left = await stopPids([21], { alive: (p) => live.has(p), waitMs: 200, kill: () => {
    live.delete(21);
    throw new Error('ESRCH');
  } });
  assert.deepEqual(left, []);
});

test('processesOf asks only on Windows and only for a folder name that is safe to put in the question', () => {
  let asked = 0;
  const run = () => {
    asked += 1;
    return { status: 0, stdout: '' };
  };
  assert.deepEqual(processesOf('C:/t/m02-home-AbC123', { run, platform: 'linux' }), []);
  assert.deepEqual(processesOf("C:/t/a' ; rm x", { run, platform: 'win32' }), []);
  assert.deepEqual(processesOf('C:/t/short', { run, platform: 'win32' }), []);
  assert.equal(asked, 0);
});

test('processesOf reads one pid per line, drops junk and this process, and answers [] when the question fails', () => {
  const calls = [];
  const run = (cmd, args, opts) => {
    calls.push({ cmd, args, opts });
    return { status: 0, stdout: `101\r\n  202 \r\n\r\nnot-a-pid\r\n${process.pid}\r\n0\r\n` };
  };
  assert.deepEqual(processesOf('C:/t/m02-home-AbC123', { run, platform: 'win32' }), [101, 202]);
  assert.equal(calls[0].cmd, 'powershell');
  const script = Buffer.from(calls[0].args.at(-1), 'base64').toString('utf16le');
  assert.match(script, /Name='node\.exe'/);
  assert.match(script, /\*m02-home-AbC123\*/, 'the question names the folder, not its whole path');
  assert.ok(calls[0].opts.timeout > 0, 'the question has a timeout');
  assert.deepEqual(processesOf('C:/t/m02-home-AbC123', { run: () => ({ status: 1, stdout: '55\n' }), platform: 'win32' }), []);
  assert.deepEqual(processesOf('C:/t/m02-home-AbC123', { run: () => ({ status: null, stdout: null }), platform: 'win32' }), []);
});

test('stopServers: the record names the live server — it is stopped, and nobody else is looked for', async () => {
  const w = world([31]);
  let found = 0;
  const stopped = await stopServers('C:/t/home-aaaaaaaa', 5001, { alive: w.alive, kill: w.kill, waitMs: 200,
    readFile: () => JSON.stringify({ pid: 31, port: 5001 }), listening: async () => w.live.has(31),
    find: () => {
      found += 1;
      return [];
    } });
  assert.deepEqual(stopped, [31]);
  assert.equal(found, 0);
});

test('stopServers: the record names a server that lost the start — the one that answers the port is found by the home', async () => {
  const w = world([42, 77]);   // 41 (the record) is dead; 42 is the server of this home; 77 is a stranger
  const asked = [];
  const stopped = await stopServers('C:/t/home-bbbbbbbb', 5002, { alive: w.alive, kill: w.kill, waitMs: 200,
    readFile: () => JSON.stringify({ pid: 41, port: 5002 }), listening: async () => w.live.has(42),
    find: (home) => {
      asked.push(home);
      return [42, 43];   // 43 ended by itself: not alive, not killed
    } });
  assert.deepEqual(stopped, [42]);
  assert.deepEqual(w.killed, [42]);
  assert.deepEqual(asked, ['C:/t/home-bbbbbbbb']);
  assert.ok(w.live.has(77), 'a process that is not of this home is never touched');
});

test('stopServers: a stranger answers the port and nothing of ours is alive — nothing is killed', async () => {
  const w = world([77]);
  const stopped = await stopServers('C:/t/home-cccccccc', 5003, { alive: w.alive, kill: w.kill, waitMs: 200,
    readFile: () => {
      throw Object.assign(new Error('no file'), { code: 'ENOENT' });
    }, listening: async () => true, find: () => [] });
  assert.deepEqual(stopped, []);
  assert.deepEqual(w.killed, []);
});

test('stopServers: no record and a silent port — nothing is asked', async () => {
  let found = 0;
  const stopped = await stopServers('C:/t/home-dddddddd', 5004, { alive: () => false, kill: () => {}, waitMs: 200,
    readFile: () => 'not json', listening: async () => false, find: () => {
      found += 1;
      return [];
    } });
  assert.deepEqual(stopped, []);
  assert.equal(found, 0);
});

test('stopServers gives up after its rounds on a server that will not die', async () => {
  const w = world([51], { immortal: [51] });
  const stopped = await stopServers('C:/t/home-eeeeeeee', 5005, { alive: w.alive, kill: w.kill, waitMs: 60, rounds: 3,
    readFile: () => JSON.stringify({ pid: 51 }), listening: async () => true, find: () => [] });
  assert.deepEqual(stopped, [51]);
  assert.equal(w.killed.length, 3, 'one kill per round, then it stops');
});

test('removeHome: a refused removal — whoever still names the home is stopped, and it is tried again', async () => {
  const w = world([61]);
  const tries = [];
  await removeHome('C:/t/home-ffffffff', 5006, { alive: w.alive, kill: w.kill, waitMs: 200,
    readFile: () => {
      throw new Error('no record');
    }, listening: async () => false, find: () => [61],
    rm: (h) => {
      tries.push(h);
      if (w.live.has(61)) throw Object.assign(new Error('EPERM: operation not permitted, rmdir'), { code: 'EPERM' });
    } });
  assert.deepEqual(tries, ['C:/t/home-ffffffff', 'C:/t/home-ffffffff']);
  assert.deepEqual(w.killed, [61]);
});

test('removeHome: a removal that is refused every time throws the refusal after its passes', async () => {
  let tries = 0;
  await assert.rejects(removeHome('C:/t/home-gggggggg', 5007, { passes: 3, alive: () => false, kill: () => {}, waitMs: 50,
    readFile: () => '{}', listening: async () => false, find: () => [],
    rm: () => {
      tries += 1;
      throw Object.assign(new Error(`EBUSY try ${tries}`), { code: 'EBUSY' });
    } }), /EBUSY try 3/);
  assert.equal(tries, 3);
});

test('the removal settings keep one pass short (fs.rmSync waits retryDelay x 1, 2, 3 ... between tries)', () => {
  const worstMs = RM.retryDelay * (RM.maxRetries * (RM.maxRetries + 1)) / 2;
  assert.ok(worstMs >= 5000, 'longer than the 5 s readiness check a server process can leave behind');
  assert.ok(worstMs <= 8000, 'and never minutes');
});

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
}

// REAL processes. Two static servers of one temp home are started for the same port; the second cannot bind
// and exits; the record names the SECOND, as ensureServe leaves it when both starts happen at one moment.
test('REAL: two servers started at once, the record names the one that lost — the home is still removed', { skip: process.platform !== 'win32' }, async () => {
  const home = tempDir('cleanup-home-');
  writeFile(`${home}/site/index.html`, '<!doctype html><title>cleanup</title>\n');
  const port = await freePort();
  assert.notEqual(port, 8891);
  const start = () => spawn(process.execPath, [CLI, 'serve', '--root', `${home}/site`, '--port', String(port), '--host', '127.0.0.1'],
    { cwd: home, stdio: 'ignore', windowsHide: true, detached: true });
  const winner = start();
  const pids = [winner.pid];
  try {
    for (let i = 0; i < 100 && !(await isListening('127.0.0.1', port, 200)); i++) await sleep(50);
    assert.ok(await isListening('127.0.0.1', port, 500), 'the first server listens');
    const loser = start();
    pids.push(loser.pid);
    await Promise.race([new Promise((r) => loser.once('exit', r)), new Promise((r) => setTimeout(r, 20000).unref())]);
    assert.ok(!pidAlive(loser.pid), 'the second server could not bind and ended');
    assert.ok(pidAlive(winner.pid), 'the first is still the server');
    const record = () => writeFile(`${home}/.runtime/serve.json`, JSON.stringify({ root: `${home}/site`, host: '127.0.0.1', port, pid: loser.pid }));
    record();

    // What the old clean-up did: kill the pid of the record (already dead), then remove. It is refused.
    assert.throws(() => fs.rmSync(home, { recursive: true, force: true }), 'Windows refuses while the unnamed server lives in the home');
    assert.ok(fs.existsSync(home), 'the home is still there');
    assert.ok(pidAlive(winner.pid) && await isListening('127.0.0.1', port, 500), 'and so is its server');
    assert.ok(processesOf(home).includes(winner.pid), 'the server is found by the name of its home');
    record();   // the refused removal took the files it could; the record is put back as it was

    await removeHome(home, port);
    assert.ok(!pidAlive(winner.pid), 'the server the record did not name is gone');
    assert.ok(!fs.existsSync(home), 'and the temp home is removed');
    assert.equal(await isListening('127.0.0.1', port, 300), false);
  } finally {
    for (const p of pids) {
      if (pidAlive(p)) {
        try {
          process.kill(p);
        } catch { /* gone */ }
      }
    }
    if (fs.existsSync(home)) {
      for (let i = 0; i < 50 && pids.some((p) => pidAlive(p)); i++) await sleep(40);
      fs.rmSync(home, RM);
    }
  }
});
