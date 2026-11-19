import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pidAlive, spawnDetached, sleepSync } from '../../engine/lib/proc.mjs';
import { isMain } from '../../engine/lib/main.mjs';
import { tempDir, writeFile } from '../helpers/fakes.mjs';

test('pidAlive: this process yes; junk and a finished process no', async () => {
  assert.equal(pidAlive(process.pid), true);
  for (const p of [0, -1, 'x', null, 1.5]) assert.equal(pidAlive(p), false);
  const dir = tempDir('proc-');
  writeFile(`${dir}/quick.mjs`, 'console.log("out"); console.error("err");\n');
  const pid = spawnDetached(`${dir}/quick.mjs`, [], { logFile: `${dir}/logs/quick.log` });
  assert.ok(pid > 0);
  for (let i = 0; i < 100 && pidAlive(pid); i++) await new Promise((r) => setTimeout(r, 30));
  assert.equal(pidAlive(pid), false);
  const log = fs.readFileSync(`${dir}/logs/quick.log`, 'utf8');
  assert.match(log, /out/);
  assert.match(log, /err/);
});

test('sleepSync blocks about as long as asked; negative is no wait', () => {
  const t = Date.now();
  sleepSync(20);
  assert.ok(Date.now() - t >= 15);
  sleepSync(-5);
});

test('isMain', () => {
  assert.equal(isMain(undefined, import.meta.url), false);
  assert.equal(isMain('C:/other.mjs', import.meta.url), false);
});
