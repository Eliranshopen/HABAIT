import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { parseLock, normalizeName } from '../../engine/lib/lock.mjs';
import { sha256File } from '../../engine/lib/hash.mjs';
import { run } from '../../engine/lib/run.mjs';
import { readJson, writeJson, appendManifestRow } from '../../engine/lib/json.mjs';
import { listFiles, totalBytes } from '../../engine/lib/files.mjs';
import { toPosix, resolveFrom, isAbsolutePath } from '../../engine/lib/paths.mjs';
import { tempDir, writeFile } from '../helpers/fakes.mjs';

test('normalizeName: lower-case, _ to -', () => {
  assert.equal(normalizeName('Lazy_Loader'), 'lazy-loader');
  assert.equal(normalizeName(' opencv-python '), 'opencv-python');
});

test('parseLock reads name==version, skips comments and blanks', () => {
  const pins = parseLock('# head\n\nnumpy==2.5.4\r\nlazy_loader==0.6  # why\nPyMuPDF==2.0\n');
  assert.deepEqual(pins, [
    { name: 'numpy', dist: 'numpy', version: '2.5.4' },
    { name: 'lazy-loader', dist: 'lazy_loader', version: '0.6' },
    { name: 'pymupdf', dist: 'PyMuPDF', version: '2.0' },
  ]);
});

test('parseLock rejects an unpinned line', () => {
  assert.throws(() => parseLock('numpy>=2\n'), /not a name==version line/);
});

test('the real requirements lock parses as written (20 pins)', () => {
  const pins = parseLock(fs.readFileSync(new URL('../../requirements.lock.txt', import.meta.url), 'utf8'));
  assert.equal(pins.length, 20);
  assert.ok(pins.some((p) => p.name === 'lazy-loader'));
});

test('sha256File streams the hash of a file', async () => {
  const d = tempDir();
  writeFile(`${d}/f.bin`, 'hello');
  assert.equal(await sha256File(`${d}/f.bin`), createHash('sha256').update('hello').digest('hex'));
  await assert.rejects(sha256File(`${d}/nope`), /ENOENT/);
});

test('run returns status, stdout and stderr', () => {
  const r = run(process.execPath, ['-e', 'process.stdout.write("out");process.stderr.write("err");process.exit(3)']);
  assert.deepEqual(r, { status: 3, stdout: 'out', stderr: 'err' });
});

test('run through a shell sends one command string and raises no deprecation warning', () => {
  const r = run('node', ['--version'], { shell: true });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^v\d+\./);
  assert.doesNotMatch(r.stderr, /DEP0190/);
});

test('run reports a spawn error as status -1 with the reason', () => {
  const r = run('definitely-not-a-command-xyz', []);
  assert.equal(r.status, -1);
  assert.match(r.stderr, /ENOENT/);
});

test('run honours the timeout', () => {
  const r = run(process.execPath, ['-e', 'setTimeout(()=>{}, 5000)'], { timeoutMs: 200 });
  assert.equal(r.status, -1);
  assert.match(r.stderr, /ETIMEDOUT/);
});

test('JSON read/write and manifest rows', () => {
  const d = tempDir();
  writeJson(`${d}/a/b.json`, { x: 1 });
  assert.equal(fs.readFileSync(`${d}/a/b.json`, 'utf8'), '{\n  "x": 1\n}\n');
  assert.deepEqual(readJson(`${d}/a/b.json`), { x: 1 });
  writeFile(`${d}/bom.json`, '\uFEFF{"y":2}');
  assert.deepEqual(readJson(`${d}/bom.json`), { y: 2 });
  assert.equal(appendManifestRow(`${d}/m/rows.json`, { n: 1 }), 1);
  assert.equal(appendManifestRow(`${d}/m/rows.json`, { n: 2 }), 2);
  assert.deepEqual(readJson(`${d}/m/rows.json`), [{ n: 1 }, { n: 2 }]);
  assert.throws(() => appendManifestRow(`${d}/a/b.json`, {}), /not a JSON array/);
});

test('listFiles is recursive, sorted, forward slashes; missing folder is empty', () => {
  const d = tempDir();
  writeFile(`${d}/z.txt`, '12');
  writeFile(`${d}/a/b/c.txt`, '345');
  assert.deepEqual(listFiles(d), [`${d}/a/b/c.txt`, `${d}/z.txt`]);
  assert.deepEqual(listFiles(`${d}/missing`), []);
  assert.deepEqual(listFiles(`${d}/z.txt`), []);
  assert.equal(totalBytes(listFiles(d)), 5);
});

test('path helpers', () => {
  assert.equal(toPosix('C:\\a\\b'), 'C:/a/b');
  assert.ok(isAbsolutePath('C:/x') && isAbsolutePath('D:\\x') && !isAbsolutePath('rel/x'));
  assert.equal(resolveFrom('C:/home', 'pipeline/'), 'C:/home/pipeline');
  assert.equal(resolveFrom('C:/home', '.'), 'C:/home');
  assert.equal(resolveFrom('C:/home', 'D:/abs/x'), 'D:/abs/x');
});

test('atomic writes: no temp file left; a non-retryable rename error removes the temp file; the file mutex; sync hash', async () => {
  const { writeFileAtomic, writeJsonAtomic, withFileLock, lockState } = await import('../../engine/lib/atomic.mjs');
  const { holdLock } = await import('../helpers/fakes.mjs');
  const { sha256FileSync, sha256Text } = await import('../../engine/lib/hash.mjs');
  const d = tempDir();
  writeJsonAtomic(`${d}/x/a.json`, { a: 1 });
  assert.equal(fs.readFileSync(`${d}/x/a.json`, 'utf8'), '{\n  "a": 1\n}\n');
  writeFileAtomic(`${d}/x/a.json`, 'two');
  assert.deepEqual(fs.readdirSync(`${d}/x`), ['a.json']);
  fs.mkdirSync(`${d}/y/b.txt/blocker`, { recursive: true });
  assert.throws(() => writeFileAtomic(`${d}/y/b.txt`, 'z', { retryMs: 30 }));
  assert.deepEqual(fs.readdirSync(`${d}/y`), ['b.txt']);
  assert.equal(withFileLock(`${d}/l/m.lock`, () => 5), 5);
  assert.equal(fs.existsSync(`${d}/l/m.lock`), false);
  withFileLock(`${d}/l/m.lock`, () => {
    assert.throws(() => withFileLock(`${d}/l/m.lock`, () => 1, { waitMs: 20, label: 'mine' }), /mine: lock busy/);
  });
  // (contract 1.4 §11) the lock is a FOLDER with one entry named after its holder; it is there only while it is held
  const lock = `${d}/l/m.lock`;
  withFileLock(lock, () => {
    const s = lockState(lock);
    assert.deepEqual([s.kind, s.pid], ['held', process.pid]);
    assert.match(s.entry, /^h\.\d+\.\d{13}\.[0-9a-f]{6,16}$/);
    assert.ok(Date.now() - s.takenAt < 2000);
  });
  assert.deepEqual(lockState(lock), { kind: 'free' });
  assert.deepEqual(fs.readdirSync(`${d}/l`), [], 'no folder and no temp file is left');
  // a hold left by a killed process (its pid is dead) is taken over at once; a live holder's is not
  holdLock(lock, { pid: 424242 });
  const t0 = Date.now();
  assert.equal(withFileLock(lock, () => 6, { waitMs: 1500, alive: () => false }), 6);
  assert.ok(Date.now() - t0 < 1000, 'no wait for the staleness age');
  assert.equal(fs.existsSync(lock), false);
  holdLock(lock, { pid: 424242 });
  assert.throws(() => withFileLock(lock, () => 1, { waitMs: 30, alive: () => true }), /lock busy/);
  assert.equal(lockState(lock).pid, 424242, 'a live holder keeps its lock');
  fs.rmSync(lock, { recursive: true });
  // a live holder that is silent for longer than staleMs is taken over
  holdLock(lock, { pid: 424242, at: Date.now() - 20000 });
  assert.equal(withFileLock(lock, () => 7, { waitMs: 500, alive: () => true }), 7);
  assert.equal(fs.existsSync(lock), false);
  // A holder that was taken over finds its entry gone when it releases, and touches NOTHING of the lock that
  // stands there then (the lock file of 0.3 was removed by whoever released, whoever held it).
  let innerRan = false;
  withFileLock(lock, () => {
    withFileLock(lock, () => { innerRan = true; }, { waitMs: 500, staleMs: -1 });   // «silent for too long»: taken over
    assert.deepEqual(lockState(lock), { kind: 'free' }, 'the taker released');
    holdLock(lock, { pid: 5 });                                                        // and somebody else holds it now
  });
  assert.equal(innerRan, true);
  assert.deepEqual([lockState(lock).kind, lockState(lock).pid], ['held', 5], 'the first holder\'s release left the new holder\'s lock alone');
  fs.rmSync(lock, { recursive: true });
  // an empty folder (a release that did not finish) does not block
  fs.mkdirSync(lock);
  assert.equal(withFileLock(lock, () => 8, { waitMs: 500 }), 8);
  assert.equal(fs.existsSync(lock), false);
  // a folder that holds something the lock does not know is never emptied by the engine: busy
  fs.mkdirSync(lock);
  fs.writeFileSync(`${lock}/something`, 'x');
  assert.equal(lockState(lock).kind, 'foreign');
  assert.throws(() => withFileLock(lock, () => 1, { waitMs: 30 }), /lock busy/);
  assert.deepEqual(fs.readdirSync(lock), ['something']);
  holdLock(lock, { pid: 7 });                                                            // two things in it: not a lock either
  assert.equal(lockState(lock).kind, 'foreign');
  fs.rmSync(lock, { recursive: true });
  // a lock FILE of the engine before 1.4, by its old rules: a dead pid at once, a live one busy, an empty one waited for
  fs.writeFileSync(lock, '424242');
  assert.deepEqual([lockState(lock).kind, lockState(lock).text], ['file', '424242']);
  assert.equal(withFileLock(lock, () => 9, { waitMs: 500, alive: () => false }), 9);
  assert.equal(fs.existsSync(lock), false);
  fs.writeFileSync(lock, '424242');
  assert.throws(() => withFileLock(lock, () => 1, { waitMs: 30, alive: () => true }), /lock busy/);
  assert.equal(fs.readFileSync(lock, 'utf8'), '424242');
  fs.writeFileSync(lock, '');
  assert.throws(() => withFileLock(lock, () => 1, { waitMs: 30, alive: () => false }), /lock busy/, 'a fresh empty file is waited for');
  fs.rmSync(lock);
  // fn throws: the lock is given back, and the error is the caller's
  assert.throws(() => withFileLock(lock, () => { throw new Error('boom'); }), /boom/);
  assert.deepEqual(fs.readdirSync(`${d}/l`), []);
  fs.writeFileSync(`${d}/l/file`, '');
  assert.throws(() => withFileLock(`${d}/l/file/sub.lock`, () => 1), /ENOTDIR|ENOENT|EEXIST/);
  const big = Buffer.alloc((1 << 20) + 17, 7);
  fs.writeFileSync(`${d}/big.bin`, big);
  assert.equal(sha256FileSync(`${d}/big.bin`), await sha256File(`${d}/big.bin`));
  assert.equal(sha256Text('hello'), createHash('sha256').update('hello').digest('hex'));
});
