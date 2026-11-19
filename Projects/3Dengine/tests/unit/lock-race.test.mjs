// The file mutex between SHORT-LIVED processes (contract 1.4 §11), with REAL processes: each child takes the lock
// once and exits at once. The lock of milestone 0.3 let two of them hold it at the same moment in about a third of
// such runs (the review of 1.4, D-1): a taker judged «the holder is dead» from text read a moment before, moved the
// lock aside, and the lock it moved was already another, live process's. Then: the store of kept readings under
// the same storm, because a record of a reading that was paid for must never be lost.
// And the second review of 1.4 (its D-1): a holder that DIES while several takers wait. The first form of the new
// lock handed a dead holder's entry over by renaming it, and a rename is not exclusive on its source: four waiting
// takers were all told the rename worked, and ran together (overlap in 10 of 10 of the reviewer's runs).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findReading, readingDir, modelFilePath, supersededCount, isRecord } from '../../engine/readings.mjs';
import { toolPath } from '../../engine/trace.mjs';
import { lockState } from '../../engine/lib/atomic.mjs';
import { tempDir, writeFile } from '../helpers/fakes.mjs';

const CHILD = fileURLToPath(new URL('../helpers/lock-child.mjs', import.meta.url));
const SHA = 'c'.repeat(64);
const PROCESSES = 8;
const homes = [];
after(() => {
  for (const h of homes) fs.rmSync(h, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
});

// Start `args.length` children at the same moment; → what each printed.
const storm = (args) => Promise.all(args.map((a) => new Promise((resolve) => {
  let out = '';
  const c = spawn(process.execPath, [CHILD, ...a], { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
  c.stdout.on('data', (d) => { out += d; });
  c.on('exit', () => resolve(out.trim()));
})));

test('eight short-lived processes on one lock: never two holders at the same moment, nobody left out, nothing left behind', { timeout: 240000 }, async () => {
  const RUNS = 8;
  const seen = [];
  for (let r = 0; r < RUNS; r++) {
    const dir = tempDir('lockrace-').replace(/\\/g, '/');
    homes.push(dir);
    const res = await storm(Array.from({ length: PROCESSES }, () => ['hold', dir]));
    seen.push(...res);
    assert.deepEqual(res.filter((x) => x !== 'ok'), [], `run ${r + 1}: every process held the lock alone and gave it back`);
    assert.deepEqual(lockState(`${dir}/x.lock`), { kind: 'free' }, `run ${r + 1}: the lock is free at the end`);
    assert.deepEqual(fs.readdirSync(dir), [], `run ${r + 1}: no lock folder, no temp file and no marker is left`);
  }
  assert.equal(seen.length, RUNS * PROCESSES);
});

const waitFor = async (what, ms = 20000) => {
  const until = Date.now() + ms;
  while (!what()) {
    if (Date.now() > until) throw new Error('waited too long');
    await new Promise((r) => setTimeout(r, 5));
  }
};

test('a holder dies while eight takers wait: they take the lock one after another, never two at the same moment', { timeout: 240000 }, async () => {
  const RUNS = 6;
  for (let r = 0; r < RUNS; r++) {
    const dir = tempDir('lockdie-').replace(/\\/g, '/');
    homes.push(dir);
    fs.mkdirSync(`${dir}/sig`);
    const holder = storm([['hold-and-die', dir]]);
    await waitFor(() => fs.existsSync(`${dir}/sig/holder-in`));
    const held = lockState(`${dir}/x.lock`);
    assert.equal(held.kind, 'held', `run ${r + 1}: the holder is in`);
    const takers = storm(Array.from({ length: PROCESSES }, () => ['hold', dir, 'ready']));
    await waitFor(() => fs.readdirSync(`${dir}/sig`).filter((n) => n.startsWith('ready.')).length === PROCESSES);
    await new Promise((res) => setTimeout(res, 150));          // every taker is inside its wait now, looking every 5 ms
    assert.deepEqual(lockState(`${dir}/x.lock`), held, `run ${r + 1}: a live holder keeps its lock while eight wait`);
    fs.writeFileSync(`${dir}/sig/die`, '');                    // the holder ends while it holds: nothing is given back
    assert.deepEqual(await holder, [''], `run ${r + 1}: the holder ended inside its hold`);
    const res = await takers;
    assert.deepEqual(res.filter((x) => x !== 'ok'), [], `run ${r + 1}: every taker held the lock alone: ${res.join(' | ')}`);
    assert.deepEqual(lockState(`${dir}/x.lock`), { kind: 'free' }, `run ${r + 1}: the lock is free at the end`);
    assert.deepEqual(fs.readdirSync(dir), ['sig'], `run ${r + 1}: no lock folder, no temp file and no marker is left`);
  }
});

test('a LIVE holder that holds for longer than staleMs loses its hold to eight waiting takers, one after another; its late release touches nothing', { timeout: 240000 }, async () => {
  const RUNS = 4;
  for (let r = 0; r < RUNS; r++) {
    const dir = tempDir('lockold-').replace(/\\/g, '/');
    homes.push(dir);
    fs.mkdirSync(`${dir}/sig`);
    const holder = storm([['hold-and-die', dir, 'stay']]);
    await waitFor(() => fs.existsSync(`${dir}/sig/holder-in`));
    // eight takers for whom a hold is stale after 1.5 s: all are waiting when the holder's hold grows that old
    const res = await storm(Array.from({ length: PROCESSES }, () => ['hold', dir, 'ready', '1500']));
    assert.deepEqual(res.filter((x) => x !== 'ok'), [], `run ${r + 1}: every taker held the lock alone: ${res.join(' | ')}`);
    assert.deepEqual(lockState(`${dir}/x.lock`), { kind: 'free' }, `run ${r + 1}: free after the takers, while the first holder is still in its body`);
    fs.writeFileSync(`${dir}/sig/die`, '');                    // the first holder wakes and releases, late
    assert.deepEqual(await holder, ['released'], `run ${r + 1}: its release found its entry gone and said nothing`);
    assert.deepEqual(lockState(`${dir}/x.lock`), { kind: 'free' });
    assert.deepEqual(fs.readdirSync(dir), ['sig'], `run ${r + 1}: no lock folder, no temp file and no marker is left`);
  }
});

test('eight processes keep eight readings of one PDF at the same moment: every keep is recorded, and no record of a kept reading is lost', { timeout: 240000 }, async () => {
  const RUNS = 4;
  for (let r = 0; r < RUNS; r++) {
    const home = tempDir('keeprace-').replace(/\\/g, '/');
    homes.push(home);
    const config = { readingsDir: `${home}/.runtime/readings`, pipelineRoot: `${home}/pipeline` };
    writeFile(toolPath(config), '// the reading tool\n');
    writeFile(modelFilePath(config), "export const TEXT_MODEL = 'm';\n");
    const args = [];
    for (let i = 0; i < PROCESSES; i++) {
      const f = `${home}/in/reading-${i}.json`;
      writeFile(f, JSON.stringify({ rooms: [{ n: i }], _meta: { model: 'm', usd: 0.01 * (i + 1), at: '2026-11-06T10:09:31.897Z', label: 'read' } }));
      args.push(['keep', home, SHA, f, String(0.01 * (i + 1))]);
    }
    const res = await storm(args);
    // every keep succeeded: one found nothing before it, each of the others moved exactly one earlier pair aside
    assert.deepEqual(res.filter((x) => !/^kept (-|\d+)$/.test(x)), [], `run ${r + 1}: ${res.join(' | ')}`);
    assert.deepEqual(res.map((x) => x.slice(5)).sort(), ['-', '1', '2', '3', '4', '5', '6', '7'], `run ${r + 1}: the keeps ran one after another`);
    // the pair that stands is found and adds up
    const found = findReading(config, SHA);
    assert.equal(found.status, 'found', `run ${r + 1}`);
    assert.equal(supersededCount(config, SHA), PROCESSES - 1);
    // and every earlier pair is whole: its reading AND its record, which names that reading's own cost
    const dir = readingDir(config, SHA);
    const costs = [found.record.costUsd];
    for (let n = 1; n < PROCESSES; n++) {
      assert.deepEqual(fs.readdirSync(`${dir}/superseded/${n}`).sort(), ['reading.json', 'record.json'], `run ${r + 1}, superseded/${n}`);
      const rec = JSON.parse(fs.readFileSync(`${dir}/superseded/${n}/record.json`, 'utf8'));
      assert.equal(isRecord(rec, SHA), true);
      const reading = JSON.parse(fs.readFileSync(`${dir}/superseded/${n}/reading.json`, 'utf8'));
      assert.equal(rec.cost_usd, reading._meta.usd, 'the record is that reading\'s own');
      costs.push(rec.cost_usd);
    }
    assert.deepEqual(costs.map((c) => Math.round(c * 100)).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8], `run ${r + 1}: eight readings, eight records, none lost and none twice`);
    assert.deepEqual(fs.readdirSync(dir).sort(), ['reading.json', 'record.json', 'superseded'], 'no lock and no temp file is left');
  }
});
