// Writes the expected table of a reading from the folder of a run that was checked by hand (contract 1.2 §8):
//   node tests/fixtures/make-expected-trace.mjs <run's plan folder> <expected-trace.json> "<where the run came from>"
// The table holds what the closing test of milestone 1.2 must reproduce: the status, the counts, every
// printed-dimension check, and the sha256 of the files that carry the measurement and of the plan. It is never typed by
// hand. Room names (text of the PDF) are not copied; a room is named by the id the tool gave it.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// (1.4) the plan itself joins them: with the date of the reading and the id of the drawing handed to the tool, the
// same reading gives the same bytes of the plan on every day and in every job (contract 1.4 §3).
export const HASHED = ['trace-check.json', 'report.json', 'rooms.json', 'plan.general.json'];
const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

export function expectedTrace(planDir, from) {
  const check = JSON.parse(fs.readFileSync(`${planDir}/trace-check.json`, 'utf8'));
  const report = JSON.parse(fs.readFileSync(`${planDir}/report.json`, 'utf8'));
  const dims = check.checks.filter((c) => c.check === 'dims')
    .map((c) => ({ room: c.room, fixture: c.fixture ?? null, expected: c.expected, got: c.got, pct: c.pct, pass: c.pass }));
  const count = check.checks.find((c) => c.check === 'room_count');
  return {
    schema: 'habait/expected-trace.v1',
    from,
    status: check.status,
    checks: check.n_checks,
    failed: check.n_failed,
    rounds: check.round,
    rooms: report.rooms,
    fixtures: report.fixtures,
    scale_px_per_cm: report.scale_px_per_cm,
    room_count: { expected: count.expected, got: count.got },
    dims,
    max_pct: Math.max(...dims.map((d) => d.pct)),
    sha256: Object.fromEntries(HASHED.map((f) => [f, sha(`${planDir}/${f}`)])),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const [planDir, out, from] = process.argv.slice(2);
  if (!planDir || !out || !from) {
    console.error('usage: node tests/fixtures/make-expected-trace.mjs <run\'s plan folder> <expected-trace.json> "<where the run came from>"');
    process.exit(2);
  }
  fs.writeFileSync(out, `${JSON.stringify(expectedTrace(planDir, from), null, 1)}\n`);
  console.log(`written: ${out}`);
}
