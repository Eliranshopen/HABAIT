import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { acquireHeavy, releaseHeavy, readHeavy } from '../../engine/heavy-lock.mjs';
import { tempDir, writeFile } from '../helpers/fakes.mjs';

test('one holder at a time; a dead holder is stale and taken over; release only by the holder', () => {
  const file = `${tempDir('heavy-')}/.runtime/heavy.lock`;
  const alive = (pid) => pid === 11 || pid === 22;
  assert.equal(readHeavy(file), null);
  assert.deepEqual(acquireHeavy(file, { pid: 11, jobId: 'a', alive, now: () => 't' }), { ok: true, took_over: null });
  assert.deepEqual(readHeavy(file), { pid: 11, job_id: 'a', at: 't', refreshed_at: 't' });
  const busy = acquireHeavy(file, { pid: 22, jobId: 'b', alive });
  assert.equal(busy.ok, false);
  assert.equal(busy.holder.job_id, 'a');
  assert.equal(acquireHeavy(file, { pid: 11, jobId: 'a', alive }).ok, true, 'its own lock again');
  assert.equal(releaseHeavy(file, { pid: 22 }), false);
  assert.ok(fs.existsSync(file));
  assert.equal(releaseHeavy(file, { pid: 11 }), true);
  assert.equal(fs.existsSync(file), false);
  assert.equal(releaseHeavy(file, { pid: 11 }), false, 'nothing to release');
  // stale: the holder's pid is dead
  writeFile(file, JSON.stringify({ pid: 99, job_id: 'dead', at: 't' }));
  const r = acquireHeavy(file, { pid: 22, jobId: 'b', alive });
  assert.equal(r.ok, true);
  assert.equal(r.took_over.job_id, 'dead');
  assert.equal(readHeavy(file).pid, 22);
  // a broken file counts as free
  writeFile(file, '{');
  assert.equal(acquireHeavy(file, { pid: 11, jobId: 'a', alive }).ok, true);
  assert.equal(fs.existsSync(`${file}.guard`), false, 'the guard is released');
  // defaults: this process
  fs.rmSync(file);
  assert.equal(acquireHeavy(file, { jobId: 'self' }).ok, true);
  assert.equal(readHeavy(file).pid, process.pid);
  assert.equal(releaseHeavy(file), true);
});

import { holdsHeavy, refreshHeavy as refreshHeavyR2 } from '../../engine/heavy-lock.mjs';

test('holdsHeavy: yes, no, or not known just now; a refresh that cannot read the lock writes nothing', () => {
  const file = `${tempDir('heavy-')}/.runtime/heavy.lock`;
  assert.equal(holdsHeavy(file, { pid: 11 }), false, 'no lock file');
  acquireHeavy(file, { pid: 11, jobId: 'a', alive: () => true, now: () => 't0' });
  assert.equal(holdsHeavy(file, { pid: 11 }), true);
  assert.equal(holdsHeavy(file, { pid: 22 }), false, 'another holder');
  const busy = () => {
    throw Object.assign(new Error('EBUSY: resource busy'), { code: 'EBUSY' });
  };
  assert.equal(holdsHeavy(file, { pid: 11, readFile: busy }), null, 'unreadable for a moment is not a loss');
  assert.equal(refreshHeavyR2(file, { pid: 11, now: () => 't1', readFile: busy }), null);
  assert.equal(readHeavy(file).refreshed_at, 't0', 'nothing was written');
  assert.equal(refreshHeavyR2(file, { pid: 11, now: () => 't1' }), true);
  assert.equal(readHeavy(file).refreshed_at, 't1');
  assert.equal(refreshHeavyR2(file, { pid: 22, now: () => 't2' }), false, 'not the holder');
  assert.equal(readHeavy(file).refreshed_at, 't1');
  writeFile(file, 'garbage');
  assert.equal(holdsHeavy(file, { pid: 11 }), false, 'a lock that does not parse is anyone\'s to take');
  assert.equal(refreshHeavyR2(file, { pid: 11 }), false);
  fs.rmSync(file);
  assert.equal(refreshHeavyR2(file, { pid: 11 }), false, 'the lock is gone');
});
