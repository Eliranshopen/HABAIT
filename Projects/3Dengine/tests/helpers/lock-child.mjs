// TEST ONLY. One SHORT-LIVED process that takes a lock once and exits at once (tests/unit/lock-race.test.mjs).
// A holder that releases and is dead a moment later is what the lock of milestone 0.3 could not stand.
//   node lock-child.mjs hold <dir>
//        takes <dir>/x.lock, creates <dir>/inside with the `wx` flag (already there = two holders at one moment),
//        waits 25 ms, removes it. Prints: ok | TWO-HOLDERS | busy | error <code>
//        With a third word `ready` it first writes <dir>/sig/ready.<pid>: the test knows it is up and about to wait.
//        A fourth word is its staleMs (after how long it takes a LIVE holder's hold for stale).
//   node lock-child.mjs hold-and-die <dir>
//        takes <dir>/x.lock, writes <dir>/sig/holder-in, waits until <dir>/sig/die is there, and then ENDS WHILE IT
//        HOLDS (process.exit inside the body: nothing is given back), as a killed process does.
//        With a third word `stay` it does not die: it leaves its body and releases, late. Prints: released
//   node lock-child.mjs keep <home> <sha256 of a PDF> <reading file> <cost>
//        keeps the reading in the store of <home> (its readings folder and its stand-in reader files).
//        Prints: kept <n of the superseded pair, or -> | same | error <code or message>
import fs from 'node:fs';
import { withFileLock } from '../../engine/lib/atomic.mjs';
import { keepReading } from '../../engine/readings.mjs';

const [, , mode, a, b, c, d] = process.argv;
let out;
if (mode === 'hold-and-die') {
  withFileLock(`${a}/x.lock`, () => {
    fs.writeFileSync(`${a}/sig/holder-in`, String(process.pid));
    while (!fs.existsSync(`${a}/sig/die`)) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2);
    if (b !== 'stay') process.exit(0);
  }, { waitMs: 60000 });
  out = b === 'stay' ? 'released' : 'error the holder did not die';
} else if (mode === 'hold') {
  out = 'ok';
  if (b === 'ready') fs.writeFileSync(`${a}/sig/ready.${process.pid}`, '');
  try {
    withFileLock(`${a}/x.lock`, () => {
      try {
        fs.writeFileSync(`${a}/inside`, String(process.pid), { flag: 'wx' });
      } catch {
        out = 'TWO-HOLDERS';
        return;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
      fs.rmSync(`${a}/inside`, { force: true });
    }, { waitMs: 60000, ...(c ? { staleMs: Number(c) } : {}) });
  } catch (e) {
    out = / lock busy$/.test(String(e.message)) ? 'busy' : `error ${e.code || e.message}`;
  }
} else if (mode === 'keep') {
  const config = { readingsDir: `${a}/.runtime/readings`, pipelineRoot: `${a}/pipeline` };
  try {
    const k = keepReading(config, { pdfSha256: b, readingFile: c, source: 'paid', costUsd: Number(d) }, { lockWaitMs: 60000 });
    out = k.kept ? `kept ${k.superseded ?? '-'}` : 'same';
  } catch (e) {
    out = `error ${e.code || e.message}`;
  }
} else {
  out = 'error usage';
}
process.stdout.write(out);
