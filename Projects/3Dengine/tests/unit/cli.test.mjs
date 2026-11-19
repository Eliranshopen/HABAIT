import { test } from 'node:test';
import assert from 'node:assert/strict';
import { main, USAGE, isMain } from '../../engine/cli.mjs';
import { fakeConfig, sink, SECRET } from '../helpers/fakes.mjs';

function io(env = { FAL_KEY: SECRET }) {
  return { stdout: sink(), stderr: sink(), env };
}

const doctorResult = (ready, readyExceptKeys) => ({
  at: 'T', ready, ready_except_keys: readyExceptKeys,
  checks: [{ id: 'node', kind: 'runtime', label: 'Node', ok: readyExceptKeys, detail: 'v24' },
    { id: 'keys', kind: 'keys', label: 'Keys', ok: ready, detail: 'FAL_KEY: present', missing: ready ? [] : ['FAL_KEY'] }],
});

const deps = (over = {}) => ({ loadConfig: () => fakeConfig(), ...over });

test('help and no command', async () => {
  let o = io();
  assert.equal(await main(['help'], o, deps()), 0);
  assert.equal(o.stdout.text, USAGE + '\n');
  o = io();
  assert.equal(await main([], o, deps()), 2);
  assert.match(o.stderr.text, /^usage:/);
});

test('unknown command → usage on stderr, exit 2', async () => {
  const o = io();
  assert.equal(await main(['frobnicate'], o, deps()), 2);
  assert.match(o.stderr.text, /unknown command: frobnicate\nusage:/);
});

test('doctor: exit 0 when ready or ready except keys, 1 otherwise; --json', async () => {
  for (const [ready, rek, code, last] of [[true, true, 0, 'READY'], [false, true, 0, 'READY EXCEPT KEYS (FAL_KEY)'], [false, false, 1, 'NOT READY']]) {
    const o = io();
    assert.equal(await main(['doctor'], o, deps({ runDoctor: async () => doctorResult(ready, rek) })), code);
    assert.ok(o.stdout.text.trim().endsWith(last));
  }
  const o = io();
  assert.equal(await main(['doctor', '--json'], o, deps({ runDoctor: async () => doctorResult(true, true) })), 0);
  assert.equal(JSON.parse(o.stdout.text).ready, true);
});

test('env prints the pointers, never a key', async () => {
  const o = io();
  assert.equal(await main(['env'], o, deps()), 0);
  const lines = o.stdout.text.trim().split('\n');
  assert.equal(lines.length, 11);
  assert.ok(lines.includes('HABAIT_ENV_ROOT=C:/eng'));
  assert.ok(!o.stdout.text.includes(SECRET) && !o.stdout.text.includes('FAL_KEY'));
});

test('setup-env: nothing to do / dry run / --go ok / --go failure', async () => {
  const step = (needed) => ({ id: 'pip', needed, cmd: 'py', args: ['-m', 'pip'], cwd: 'C:/eng' });
  let o = io();
  assert.equal(await main(['setup-env'], o, deps({ planEnv: () => ({ steps: [step(false)] }) })), 0);
  assert.match(o.stdout.text, /nothing to do/);
  o = io();
  let applied = false;
  assert.equal(await main(['setup-env'], o, deps({ planEnv: () => ({ steps: [step(true)] }), applyEnv: () => { applied = true; } })), 0);
  assert.match(o.stdout.text, /^needed pip/m);
  assert.match(o.stdout.text, /dry run/);
  assert.equal(applied, false);
  o = io();
  assert.equal(await main(['setup-env', '--go'], o, deps({ planEnv: () => ({ steps: [step(true)] }),
    applyEnv: () => ({ ok: true, ran: ['pip'] }) })), 0);
  assert.match(o.stdout.text, /done: pip/);
  o = io();
  assert.equal(await main(['setup-env', '--go'], o, deps({ planEnv: () => ({ steps: [step(true)] }),
    applyEnv: () => ({ ok: false, reason: 'pip exited 1: boom' }) })), 1);
  assert.match(o.stderr.text, /setup-env failed: pip exited 1: boom/);
});

test('bring-assets: dry run, missing in source, --from, --go ok and failure', async () => {
  const entry = (id, state) => ({ id, state, bytes: 2 * 1024 * 1024 });
  let seenFrom;
  const plan = (entries) => async (cfg, { from }) => { seenFrom = from; return { from, entries }; };
  let o = io();
  assert.equal(await main(['bring-assets'], o, deps({ planAssets: plan([entry('a', 'present'), entry('b', 'copy')]) })), 0);
  assert.equal(seenFrom, 'C:/backup/360walkaround');
  assert.match(o.stdout.text, /present 1 · copy 1 \(2\.0 MB\) · missing-in-source 0/);
  assert.match(o.stdout.text, /dry run/);
  o = io();
  assert.equal(await main(['bring-assets', '--from', 'D:/bk'], o, deps({ planAssets: plan([entry('a', 'present')]) })), 0);
  assert.equal(seenFrom, 'D:/bk');
  assert.match(o.stdout.text, /nothing to do/);
  o = io();
  assert.equal(await main(['bring-assets'], o, deps({ planAssets: plan([entry('c', 'missing-in-source')]) })), 1);
  assert.match(o.stdout.text, /missing-in-source c/);
  assert.match(o.stderr.text, /1 entries are missing/);
  o = io();
  assert.equal(await main(['bring-assets', '--go'], o, deps({ planAssets: plan([{ ...entry('b', 'copy'), bytes: 3 * 2 ** 30 }]),
    applyAssets: async () => ({ copied: 1, present: 0, failed: [] }) })), 0);
  assert.match(o.stdout.text, /3\.00 GB/);
  assert.match(o.stdout.text, /copied 1 · present 0 · failed 0/);
  o = io();
  assert.equal(await main(['bring-assets', '--go'], o, deps({ planAssets: plan([entry('b', 'copy')]),
    applyAssets: async () => ({ copied: 0, present: 0, failed: [{ id: 'b', reason: 'sha256 mismatch after copy' }] }) })), 1);
  assert.match(o.stderr.text, /b \(sha256 mismatch after copy\)/);
  o = io();
  assert.equal(await main(['bring-assets', '--from'], o, deps()), 1);
  assert.match(o.stderr.text, /--from needs a value/);
});

test('a config error is reported on stderr with exit 1', async () => {
  const o = io();
  assert.equal(await main(['env'], o, { loadConfig: () => { throw new Error('engine config: missing required field "python"'); } }), 1);
  assert.match(o.stderr.text, /env: engine config: missing required field "python"/);
});

test('main with the real config: env command', async () => {
  const o = io({});
  assert.equal(await main(['env'], o), 0);
  assert.match(o.stdout.text, /^HABAIT_PY=.*\/\.venv\/Scripts\/python\.exe$/m);
});

test('isMain compares the script path with the module url', () => {
  assert.equal(isMain(undefined, import.meta.url), false);
  assert.equal(isMain(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), import.meta.url), true);
  assert.equal(isMain('C:/other.mjs', import.meta.url), false);
});

test('job / jobs: human lines and --json; missing job exit 1; job needs an id', async () => {
  const { stubConfig } = await import('../helpers/fakes.mjs');
  const { newJob, writeJob } = await import('../../engine/jobs.mjs');
  const c = stubConfig();
  const d = deps({ loadConfig: () => c });
  let o = io();
  assert.equal(await main(['jobs'], o, d), 0);
  assert.equal(o.stdout.text, 'no jobs\n');
  writeJob(c.jobsDir, newJob({ id: 'abcdef0123456789', mode: 'stub', now: '2026-11-16T18:00:00.000Z',
    input: { pdf_path: 'x', pdf_name: 'plan.pdf', pdf_sha256: 'a'.repeat(64), apartment: 'apt846' } }));
  o = io();
  assert.equal(await main(['jobs'], o, d), 0);
  assert.match(o.stdout.text, /^abcdef0123456789 {2}queued/);
  o = io();
  assert.equal(await main(['jobs', '--json'], o, d), 0);
  assert.equal(JSON.parse(o.stdout.text).jobs.length, 1);
  o = io();
  assert.equal(await main(['job', 'abcdef0123456789'], o, d), 0);
  assert.match(o.stdout.text, /plan\.pdf/);
  o = io();
  assert.equal(await main(['job', 'abcdef0123456789', '--json'], o, d), 0);
  assert.equal(JSON.parse(o.stdout.text).state, 'queued');
  o = io();
  assert.equal(await main(['job', '0000000000000000'], o, d), 1);
  assert.match(o.stderr.text, /not found/);
  o = io();
  assert.equal(await main(['job'], o, d), 1);
  assert.match(o.stderr.text, /job needs a job_id/);
});

test('serve: --root required; serves until the server closes', async () => {
  let o = io();
  assert.equal(await main(['serve'], o, deps()), 1);
  assert.match(o.stderr.text, /serve needs --root/);
  const { EventEmitter } = await import('node:events');
  const fake = new EventEmitter();
  let args;
  o = io();
  const p = main(['serve', '--root', 'C:/site', '--port', '9001'], o, deps({ startServe: async (a) => { args = a; setTimeout(() => fake.emit('close'), 5); return fake; } }));
  assert.equal(await p, 0);
  assert.deepEqual(args, { root: 'C:/site', host: '127.0.0.1', port: 9001 });
  assert.match(o.stderr.text, /serving C:\/site at http:\/\/127\.0\.0\.1:9001\//);
  assert.equal(o.stdout.text, '');
});

test('mcp: runs the server with the loaded config', async () => {
  let got;
  const o = io();
  assert.equal(await main(['mcp'], o, deps({ loadConfig: () => fakeConfig({ serve: { host: 'h', port: 1 } }), runMcp: async (a) => { got = a; return 0; } })), 0);
  assert.equal(got.config.serve.host, 'h');
});

test('0.3 job: stages with their rows, the ledger, orphans, STALLED; jobs marks STALLED; --json carries runner', async () => {
  const { stubConfig, writeFile } = await import('../helpers/fakes.mjs');
  const { newJob, writeJob, setState } = await import('../../engine/jobs.mjs');
  const { writeManifest } = await import('../../engine/manifest.mjs');
  const { writeLedger } = await import('../../engine/ledger.mjs');
  const c = stubConfig();
  const id = 'abcdef0123456789';
  const j = newJob({ id, mode: 'stub', now: '2026-11-16T18:00:00.000Z',
    input: { pdf_path: 'x', pdf_name: 'plan.pdf', pdf_sha256: 'a'.repeat(64), apartment: 'apt846' } });
  setState(j, 'rendering', '2026-11-16T18:00:00.000Z');
  j.attempts = { tracing: 1, building: 2, rendering: 1 };
  j.waiting_for = 'heavy-lock';
  writeJob(c.jobsDir, j);
  const row = (stage, attempt, extra = {}) => ({ stage, attempt, status: 'done', started_at: 'a', finished_at: 'F', seconds: 0.4,
    inputs_sha256: '1'.repeat(64), outputs: [], cost_usd: 0, runner_pid: 9, ...extra });   // a row the manifest check takes (contract 1.1 §5)
  writeManifest(c.jobsDir, { schema: 'habait/manifest.v1', job_id: id, rows: [row('tracing', 1), row('building', 1, { superseded: true }), row('building', 2)] });
  const lrow = (seq, status, extra) => ({ seq, call_key: 'k'.repeat(64), stage: 'skinning', provider: 'stub', what: 'w', reserved_usd: 0.6,
    reserved_at: 'a', status, settled_usd: null, settled_at: null, answer_sha256: null, attempt: seq, ...extra });
  writeLedger(c.jobsDir, { schema: 'habait/ledger.v1', job_id: id, cap_usd: 60,
    rows: [lrow(1, 'orphaned'), lrow(2, 'settled', { settled_usd: 0.6, settled_at: 'b', answer_sha256: 'h' })] });
  writeFile(`${c.jobsDir}/${id}/runner.pid`, '31337');
  let o = io();
  const dead = deps({ loadConfig: () => c, isRunnerAlive: () => false });
  assert.equal(await main(['job', id], o, dead), 0);
  const t = o.stdout.text;
  assert.match(t, /^abcdef0123456789 {2}rendering .* · STALLED\n/);
  assert.match(t, /runner: not alive - STALLED/);
  assert.match(t, /waiting for: heavy-lock/);
  assert.match(t, /tracing {4}done attempt 1 {2}0\.4 s {2}\$0 {2}F {2}pid 9\n/);
  assert.match(t, /building {3}done attempt 1 .*\(superseded\)/);
  assert.match(t, /rendering {2}started 1x, no row {2}<- now/);
  assert.match(t, /skinning {3}-\n/);
  assert.match(t, /ledger: settled \$0\.6 · held \$0\.6 · 2 row\(s\)/);
  assert.match(t, /ORPHANED #1 skinning attempt 1: \$0\.6 reserved, outcome unknown/);
  o = io();
  assert.equal(await main(['job', id], o, deps({ loadConfig: () => c, isRunnerAlive: () => true })), 0);
  assert.match(o.stdout.text, /runner: alive, pid 31337, heartbeat [\d.]+ s ago/);
  assert.doesNotMatch(o.stdout.text, /STALLED/);
  o = io();
  assert.equal(await main(['job', id, '--json'], o, dead), 0);
  assert.deepEqual(Object.keys(JSON.parse(o.stdout.text).runner), ['alive', 'pid', 'heartbeat_age_s']);
  o = io();
  assert.equal(await main(['jobs'], o, dead), 0);
  assert.match(o.stdout.text, /· STALLED\n$/);
  o = io();
  assert.equal(await main(['jobs', '--json'], o, dead), 0);
  assert.equal(JSON.parse(o.stdout.text).jobs[0].runner.alive, false);
  o = io();
  assert.equal(await main(['ledger', id], o, dead), 0);
  assert.match(o.stdout.text, /#1 orphaned skinning/);
  assert.match(o.stdout.text, /ORPHANED 1/);
  o = io();
  assert.equal(await main(['ledger', id, '--json'], o, dead), 0);
  assert.equal(JSON.parse(o.stdout.text).rows.length, 2);
  for (const cmd of ['ledger', 'resume']) {
    o = io();
    assert.equal(await main([cmd, '0000000000000000'], o, dead), 1);
    assert.match(o.stderr.text, /not found/);
    o = io();
    assert.equal(await main([cmd], o, dead), 1);
    assert.match(o.stderr.text, new RegExp(`${cmd} needs a job_id`));
  }
});

test('0.3 resume: a stalled job gets a runner; a live one does not; a cancelled one is restarted; done stays', async () => {
  const { stubConfig } = await import('../helpers/fakes.mjs');
  const { newJob, writeJob, setState, readJob } = await import('../../engine/jobs.mjs');
  const c = stubConfig();
  const id = 'abcdef0123456789';
  const put = (state) => {
    const j = newJob({ id, mode: 'stub', now: '2026-11-16T18:00:00.000Z',
      input: { pdf_path: 'x', pdf_name: 'plan.pdf', pdf_sha256: 'a'.repeat(64), apartment: 'apt846' } });
    writeJob(c.jobsDir, setState(j, state, j.created_at));
  };
  const spawned = [];
  const d = (alive) => deps({ loadConfig: () => c, isRunnerAlive: () => alive, spawnRunner: (cfg, x) => spawned.push(x) });
  put('building');
  let o = io();
  assert.equal(await main(['resume', id], o, d(false)), 0);
  assert.match(o.stdout.text, /resumed: abcdef0123456789 in "building", a runner was started/);
  o = io();
  assert.equal(await main(['resume', id], o, d(true)), 0);
  assert.match(o.stdout.text, /not resumed: .* is "building" and its runner is alive/);
  put('cancelled');
  o = io();
  assert.equal(await main(['resume', id], o, d(false)), 0);
  assert.match(o.stdout.text, /resumed: .* in "tracing"/);
  assert.equal(readJob(c.jobsDir, id).state, 'tracing');
  put('done');
  o = io();
  assert.equal(await main(['resume', id], o, d(false)), 0);
  assert.equal(o.stdout.text, 'not resumed: abcdef0123456789 is "done"\n');
  assert.equal(spawned.length, 2);
});

// ---- round 7 (QA round 6, O-O): a ledger or a manifest that cannot be read ----
test('job and ledger name the file that cannot be read and exit 1; job --json still prints the job file', async () => {
  const { stubConfig, writeFile } = await import('../helpers/fakes.mjs');
  const { newJob, writeJob } = await import('../../engine/jobs.mjs');
  const c = stubConfig();
  const id = 'abcdef0123456789';
  const j = newJob({ id, mode: 'stub', now: '2026-11-16T18:00:00.000Z',
    input: { pdf_path: 'x', pdf_name: 'plan.pdf', pdf_sha256: 'a'.repeat(64), apartment: 'apt846' } });
  j.cost.spent_usd = 1.8;
  writeJob(c.jobsDir, j);
  const d = deps({ loadConfig: () => c, isRunnerAlive: () => false });
  for (const [file, text] of [['ledger.json', '{ "rows": [ { "seq": 1, "sta'], ['ledger.json', '[]'], ['ledger.json', '{"rows":null}'],
    ['ledger.json', '{"rows":[{}]}'], ['ledger.json', '{"schema":"habait/ledger.v1","job_id":"0123456789abcdef","cap_usd":null,"rows":[]}'],
    ['manifest.json', 'not json'], ['manifest.json', '{"rows":7}']]) {
    writeFile(`${c.jobsDir}/${id}/ledger.json`, '{"schema":"habait/ledger.v1","job_id":"abcdef0123456789","cap_usd":null,"rows":[]}');
    writeFile(`${c.jobsDir}/${id}/manifest.json`, '{"schema":"habait/manifest.v1","job_id":"abcdef0123456789","rows":[]}');
    writeFile(`${c.jobsDir}/${id}/${file}`, text);
    for (const cmd of file === 'ledger.json' ? ['job', 'ledger'] : ['job']) {
      const o = io();
      assert.equal(await main([cmd, id], o, d), 1, `${cmd} with ${file} = ${text}`);
      assert.match(o.stderr.text, new RegExp(`^${cmd}: ledger\\.json or manifest\\.json of job ${id} cannot be read \\(`));
      assert.match(o.stderr.text, /"job abcdef0123456789 --json" still prints the job file/);
      assert.equal(o.stdout.text, '');
    }
    const o = io();
    assert.equal(await main(['job', id, '--json'], o, d), 0);
    assert.equal(JSON.parse(o.stdout.text).job_id, id);
  }
  // with both files whole the human commands work
  writeFile(`${c.jobsDir}/${id}/ledger.json`, '{"schema":"habait/ledger.v1","job_id":"abcdef0123456789","cap_usd":null,"rows":[]}');
  writeFile(`${c.jobsDir}/${id}/manifest.json`, '{"schema":"habait/manifest.v1","job_id":"abcdef0123456789","rows":[]}');
  let o = io();
  assert.equal(await main(['job', id], o, d), 0);
  assert.match(o.stdout.text, /ledger: settled \$0/);
  o = io();
  assert.equal(await main(['ledger', id], o, d), 0);
});
