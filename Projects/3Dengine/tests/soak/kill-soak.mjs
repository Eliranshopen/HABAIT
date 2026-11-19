// Randomised kill soak (milestone 0.3, round 2): REAL detached runners on a TEMP engine home (short stub step,
// fast heartbeat), hard-killed at random moments (the three test hooks make some kills land between
// reserve / cache / settle), resumed with start_simulation, with the invariants checked after EVERY kill and
// every resume. Stops at the first violation and dumps job.json / manifest.json / ledger.json (and the
// sends.logs) into a folder named in the output.
// A second phase (--freezes N, on its own temp home with runner.staleSeconds 1) does not kill: the first runner
// BLOCKS its thread at a random point (test hook ENGINE_TEST_FREEZE_MS), looks dead while it is alive, and is
// replaced; the soak wakes it at once, a little later, or after the job is done. The job must finish with every
// call sent once (twice only when the first runner already had its answer: the late answer of contract §10
// rule 10, and then both rows are in the ledger), and the replaced runner must write nothing more. One takeover
// in three also KILLS the second runner at a random moment and lets a third finish: no reservation may be left open.
// Usage: node tests/soak/kill-soak.mjs [--kills N] [--freezes N] [--seed S]
//        (default 150 kills, 0 freezes; NOT part of npm test)
import fs from 'node:fs';
import os from 'node:os';
import { pidAlive } from '../../engine/lib/proc.mjs';
import { STAGES } from '../../engine/jobs.mjs';
import { mkEnv, sleep, readText, HOOK_VARS, frozenThenReplaced, toDone, wakeAndLeave, gone, lockFree } from './lib.mjs';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? Number(process.argv[i + 1]) : dflt;
};
const KILLS = arg('kills', 150);
const FREEZES = arg('freezes', 0);
let seed = arg('seed', Date.now() % 2147483647) || 1;
const rnd = () => {   // small deterministic generator, so a failing run can be repeated with --seed
  seed = (seed * 48271) % 2147483647;
  return seed / 2147483647;
};
const between = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const PAID = ['skinning', 'gating', 'finishing'];

const stats = { kills: 0, jobs: 0, orphaned: 0, recovered: 0, retries: 0, longestResumeMs: 0, takeovers: 0, neverSent: 0, late: 0, wokeBeforeDone: 0, kills2: 0, aimed: 0, violations: 0 };
let E;
let dumpDir = null;

class Violation extends Error {}

function dump(id, why) {
  dumpDir = `${os.tmpdir().replace(/\\/g, '/')}/kill-soak-violation-${Date.now()}`;
  fs.mkdirSync(dumpDir, { recursive: true });
  for (const f of ['job.json', 'manifest.json', 'ledger.json', 'runner.log']) {
    try {
      fs.copyFileSync(E.jobPath(id, f), `${dumpDir}/${f}`);
    } catch { /* may not exist */ }
  }
  for (const s of PAID) {
    try {
      fs.copyFileSync(E.jobPath(id, `stages/${s}/sends.log`), `${dumpDir}/sends-${s}.log`);
    } catch { /* none */ }
  }
  fs.writeFileSync(`${dumpDir}/WHY.txt`, `${why}\nseed ${process.argv.includes('--seed') ? arg('seed') : 'random'}\n`);
}

function parsed(id, f) {
  let text;
  try {
    text = readText(E.jobPath(id, f));
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw new Violation(`${f} could not be read: ${e.code || e.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Violation(`${f} does not parse: ${e.message} (${text.length} bytes)`);
  }
}

// The structural invariants (they hold at every instant, a runner alive or not).
function check(id, where) {
  // The sends are counted BEFORE the ledger is read. A call is marked in the ledger and then sent (contract 0.3
  // §12.2), so every send counted here has its mark in a ledger that is read afterwards. In the other order a live
  // runner can mark and send between the two reads, and the check reports a send with no mark although the disk
  // never held one (seen once, at the gate of milestone 1.3: the mark was written 3 ms before the send).
  const sentBefore = Object.fromEntries(PAID.map((s) => [s, E.sends(id, s)]));
  const job = parsed(id, 'job.json');
  const man = parsed(id, 'manifest.json');
  const led = parsed(id, 'ledger.json');
  if (!job) throw new Violation(`${where}: job.json missing`);
  if (led) {
    // One settled row per call. The only second one allowed is a LATE answer (contract §10 rule 10): a
    // call that was already sent when its runner was replaced, recorded with late: true.
    const settled = new Map();
    for (const r of led.rows) {
      if (r.status !== 'settled' || r.late === true) continue;
      settled.set(r.call_key, (settled.get(r.call_key) || 0) + 1);
    }
    for (const [k, n] of settled) if (n > 1) throw new Violation(`${where}: call_key ${k.slice(0, 12)} has ${n} settled rows that are not late`);
    for (const s of PAID) {
      const sent = sentBefore[s];
      const mine = led.rows.filter((r) => r.stage === s);
      // A send beyond the first needs a row whose outcome was not known: orphaned, late, or still in flight.
      const unknown = mine.filter((r) => r.status === 'orphaned' || r.late === true || (r.status === 'reserved' && r.sending_at)).length;
      if (sent > 1 + unknown) throw new Violation(`${where}: ${s} sent ${sent} times with only ${unknown} orphaned, late or in-flight row(s)`);
      // Every send was marked first (contract §12.2): no more sends than rows marked as sending.
      const marked = mine.filter((r) => r.sending_at).length;
      if (sent > marked) throw new Violation(`${where}: ${s} sent ${sent} times, only ${marked} row(s) marked as sending`);
    }
    for (const r of led.rows) {
      if (r.status === 'orphaned' && !r.sending_at) throw new Violation(`${where}: seq ${r.seq} is orphaned although it was never marked as sending`);
      if (r.status === 'failed' && Number(r.settled_usd) !== 0) throw new Violation(`${where}: failed seq ${r.seq} has settled_usd ${r.settled_usd}`);
      if (r.not_sent === true && r.status !== 'failed') throw new Violation(`${where}: seq ${r.seq} is not_sent and ${r.status}`);
    }
    if (job.state === 'done') {
      const open = led.rows.filter((r) => r.status === 'reserved');
      if (open.length) throw new Violation(`${where}: done with ${open.length} reservation(s) still open (seq ${open.map((r) => r.seq).join(', ')})`);
    }
  }
  if (man) {
    for (const s of STAGES) {
      const valid = man.rows.filter((r) => r.stage === s && r.status === 'done' && !r.superseded).length;
      if (valid > 1) throw new Violation(`${where}: stage ${s} has ${valid} valid done rows`);
    }
  }
  if (job.state === 'failed') throw new Violation(`${where}: the job failed: ${JSON.stringify(job.reason)}`);
  return { job, man, led };
}

const settledSum = (led) => Math.round((led?.rows || []).filter((r) => r.status === 'settled')
  .reduce((n, r) => n + (Number(r.settled_usd) || 0), 0) * 1e6) / 1e6;

// After a resume: spent_usd equals the settled sum once the runner has had a moment (polled up to 3 s).
async function checkSpent(id, where) {
  const until = Date.now() + 3000;
  let last;
  for (;;) {
    const job = parsed(id, 'job.json');
    const led = parsed(id, 'ledger.json');
    last = `spent_usd ${job.cost.spent_usd}, settled sum ${settledSum(led)}`;
    if (job.cost.spent_usd === settledSum(led)) return;
    if (Date.now() > until) throw new Violation(`${where}: ${last} after 3 s`);
    await sleep(25);
  }
}

// Hooks (0 to 400 ms; 0 = off) go into the environment of the NEXT spawned runner only.
function withHooks(fn) {
  const hook = rnd() < 0.55 ? HOOK_VARS[between(0, 2)] : null;
  if (hook) process.env[hook] = String(between(1, 400));
  try {
    return fn();
  } finally {
    if (hook) delete process.env[hook];
  }
}

// start_simulation (the resume), retried for up to 3 s when "lock busy"; counts retries and the wait.
async function resume(pdf, where) {
  const t0 = Date.now();
  for (let tries = 0; ; tries++) {
    try {
      const r = withHooks(() => E.h.start_simulation({ pdf_path: pdf }));
      const ms = Date.now() - t0;
      stats.longestResumeMs = Math.max(stats.longestResumeMs, ms);
      return r;
    } catch (e) {
      if (!/lock busy/i.test(e.message)) throw new Violation(`${where}: resume failed: ${e.message}`);
      stats.retries++;
      if (Date.now() - t0 > 3000) throw new Violation(`${where}: "lock busy" for more than 3 s (${tries + 1} tries)`);
      await sleep(40);
    }
  }
}

const alive = (id) => E.h.get_job({ job_id: id }).job.runner.alive === true;

async function runJob(n) {
  const name = `soak-${n}.pdf`;
  const note = `soak job ${n}`;
  const pdf = E.pdf(name, note);
  const started = withHooks(() => E.h.start_simulation({ pdf_path: pdf }));
  const id = started.job_id;
  let killsHere = 0;
  const tag = (s) => `job ${n} (${id}) ${s}`;
  for (;;) {
    let { job } = check(id, tag('loop'));
    if (job.state === 'done') break;
    if (job.state === 'awaiting_approval' && !job.approval) {
      try {
        E.h.approve_paid_stage({ job_id: id, cap_usd: 60 });
      } catch (e) {
        if (!/lock busy|NOT_AWAITING/i.test(`${e.code} ${e.message}`)) throw new Violation(tag(`approve failed: ${e.message}`));
      }
    }
    await sleep(between(15, 700));
    ({ job } = check(id, tag('before kill')));
    if (job.state === 'done') break;
    if (killsHere < 30 && alive(id) && stats.kills < KILLS + 40) {
      const pid = E.runnerPid(id);
      if (pid && pidAlive(pid)) {
        try {
          process.kill(pid);
        } catch { /* gone */ }
        const until = Date.now() + 5000;
        while (pidAlive(pid) && Date.now() < until) await sleep(5);
        if (pidAlive(pid)) throw new Violation(tag(`pid ${pid} did not die`));
        stats.kills++;
        killsHere++;
        if (stats.kills % 25 === 0) console.log(`  ${stats.kills} kills, ${stats.jobs} jobs done, ${stats.retries} resume retries`);
        check(id, tag(`after kill ${stats.kills}`));
        // a kill after which the job has just reached done needs no resume
        if (parsed(id, 'job.json').state === 'done') break;
      }
    }
    // resume when no runner is alive (a runner that exited by itself counts too)
    if (!alive(id) && parsed(id, 'job.json').state !== 'done') {
      await resume(pdf, tag('resume'));
      check(id, tag(`after resume ${stats.kills}`));
      await checkSpent(id, tag(`after resume ${stats.kills}`));
    }
  }
  // The end of a job.
  const { job, man, led } = check(id, tag('done'));
  await checkSpent(id, tag('done'));
  for (const s of STAGES) {
    const valid = man.rows.filter((r) => r.stage === s && r.status === 'done' && !r.superseded).length;
    if (valid !== 1) throw new Violation(tag(`done with ${valid} valid rows for ${s}`));
  }
  if (man.rows.length !== STAGES.length) throw new Violation(tag(`done with ${man.rows.length} manifest rows`));
  const settledCount = led.rows.filter((r) => r.status === 'settled').length;
  if (settledCount !== PAID.length) throw new Violation(tag(`done with ${settledCount} settled rows (expected ${PAID.length})`));
  const res = await E.h.get_result({ job_id: id });
  const http = await fetch(res.local_url);
  if (http.status !== 200) throw new Violation(tag(`the local link answered ${http.status}`));
  stats.jobs++;
  stats.orphaned += led.rows.filter((r) => r.status === 'orphaned').length;
  stats.recovered += led.rows.filter((r) => r.recovered === true).length;
  return id;
}

const POINTS = [...STAGES, ...PAID.map((s) => `${s}:reserved`), ...PAID.map((s) => `${s}:sent`)];
const WHEN = ['at once', 'a little later', 'after done'];

// One takeover: the first runner blocks its thread at a random point, looks dead, is replaced. The soak wakes
// it at a random moment. The job must finish with every call sent ONCE (twice only for a late answer), and
// the replaced runner must leave by itself having written nothing more.
async function runFrozen(n) {
  const point = POINTS[between(0, POINTS.length - 1)];
  const when = WHEN[between(0, 2)];
  const tag = (s) => `takeover ${n} (blocked at ${point}, woken ${when}) ${s}`;
  let r;
  let doneFirst;
  try {
    r = await frozenThenReplaced(E, { name: `freeze-${n}.pdf`, point });
    check(r.id, tag('after the takeover'));
    if (when === 'a little later') await sleep(between(30, 1500));
    if (when !== 'after done') r.wake();
    await toDone(E, r.id);
    check(r.id, tag('at done'));
    await wakeAndLeave(E, r);
    await gone(E, r.newPid, 'the second runner, after done');
    await lockFree(E, r.id);
    doneFirst = /stopped: done[\s\S]*stopped: superseded/.test(E.log(r.id));
  } catch (e) {
    throw e instanceof Violation ? e : new Violation(tag(e.message));
  }
  const { man, led } = check(r.id, tag('done'));
  await checkSpent(r.id, tag('done'));
  for (const s of STAGES) {
    const valid = man.rows.filter((x) => x.stage === s && x.status === 'done' && !x.superseded).length;
    if (valid !== 1) throw new Violation(tag(`done with ${valid} valid rows for ${s}`));
  }
  if (man.rows.length !== STAGES.length) throw new Violation(tag(`done with ${man.rows.length} manifest rows`));
  // The replaced runner wrote the rows of the stages BEFORE the one it was blocked in, and no other.
  const at = STAGES.indexOf(r.stage);
  for (const row of man.rows) {
    const mustBeOld = STAGES.indexOf(row.stage) < at;
    if ((row.runner_pid === r.oldPid) !== mustBeOld) throw new Violation(tag(`the row of ${row.stage} was written by pid ${row.runner_pid}`));
  }
  // A late answer is possible only at "<stage>:sent", and only when the second runner made the call before
  // the first one woke. Then that call was sent twice and has two settled rows, one of them late.
  const late = led.rows.filter((x) => x.late === true);
  if (late.length > (point.endsWith(':sent') ? 1 : 0)) throw new Violation(tag(`${late.length} late row(s)`));
  if (late.some((x) => x.stage !== r.stage || x.status !== 'settled')) throw new Violation(tag('a late row of another stage, or not settled'));
  for (const s of PAID) {
    const sent = E.sends(r.id, s);
    const want = 1 + late.filter((x) => x.stage === s).length;
    if (sent !== want) throw new Violation(tag(`${s} was sent ${sent} times (expected ${want})`));
  }
  const settled = led.rows.filter((x) => x.status === 'settled').length;
  if (settled !== PAID.length + late.length) throw new Violation(tag(`done with ${settled} settled rows and ${late.length} late`));
  const open = led.rows.filter((x) => x.status === 'orphaned' || x.status === 'reserved').length;
  if (open) throw new Violation(tag(`${open} reservation(s) left with an unknown outcome`));
  const neverSent = led.rows.filter((x) => x.status === 'failed' && x.not_sent === true).length;
  const expected = point.endsWith(':reserved') ? 1 : 0;
  if (neverSent !== expected || led.rows.length !== PAID.length + late.length + expected) {
    throw new Violation(tag(`${led.rows.length} ledger rows, ${neverSent} closed as never sent (expected ${PAID.length + late.length + expected} and ${expected})`));
  }
  if (!E.log(r.id).includes(`runner ${r.oldPid} stopped: superseded`)) throw new Violation(tag('the replaced runner did not stop as superseded'));
  if (fs.existsSync(E.jobPath(r.id, 'runner.pid'))) throw new Violation(tag('runner.pid was left behind'));
  stats.takeovers++;
  stats.neverSent += neverSent;
  stats.late += late.length;
  if (!doneFirst) stats.wokeBeforeDone++;
  if (stats.takeovers % 5 === 0) console.log(`  ${stats.takeovers} takeovers, ${stats.wokeBeforeDone} of them woke while the job was still running`);
}

const ORDER = ['wake, kill', 'kill, wake', 'kill, resume, wake'];

// A takeover in which the SECOND runner is killed as well (one of the three pause hooks makes some of the
// kills land between its reserve, its send, its cache write and its settle), the first runner is woken at a
// random place in that order, and a third runner finishes the job. Whatever the order: the job reaches done
// with one valid row per stage, NO reservation left open, every send marked and explained, `spent_usd` equal
// to the settled sum, and the first runner gone by itself as superseded. (QA round 3, defect D1.)
async function runFrozenKill2(n) {
  const point = POINTS[between(0, POINTS.length - 1)];
  const hook = HOOK_VARS[between(0, 2)];
  const order = ORDER[between(0, 2)];
  const tag = (s) => `takeover ${n} (blocked at ${point}; second runner with ${hook.replace('ENGINE_TEST_PAUSE_', '').replace('_MS', '')}; ${order}) ${s}`;
  let r;
  try {
    r = await frozenThenReplaced(E, { name: `freeze-${n}.pdf`, point, secondEnv: { [hook]: between(200, 900) } });
    check(r.id, tag('after the takeover'));
    if (order === 'wake, kill') r.wake();
    if (between(0, 1) === 0) {
      // Aim: wait (at most 3 s) until the second runner is INSIDE its pause, so the kill lands between its
      // reserve and its send, its cache write and its settle, or its settle and its manifest row.
      const paused = `runner ${r.newPid} test hook: pausing`;
      const until = Date.now() + 3000;
      while (!E.log(r.id).includes(paused) && Date.now() < until) {
        const j = parsed(r.id, 'job.json');
        if (j.state === 'done') break;
        if (j.state === 'awaiting_approval' && !j.approval) E.approve(r.id);
        await sleep(10);
      }
      if (E.log(r.id).includes(paused)) stats.aimed++;
    } else {
      await sleep(between(0, 1300));
    }
    const pid2 = E.runnerPid(r.id);
    if (pid2 === r.newPid && pidAlive(pid2) && parsed(r.id, 'job.json').state !== 'done') {
      try {
        process.kill(pid2);
      } catch { /* gone */ }
      await gone(E, pid2, 'the second runner, killed');
      stats.kills2++;
      check(r.id, tag('after the kill of the second runner'));
    }
    if (order === 'kill, wake') await wakeAndLeave(E, r);
    // a third runner (and a fourth, if it is ever needed) until the job is done
    const until = Date.now() + 60000;
    for (;;) {
      const j = parsed(r.id, 'job.json');
      if (j.state === 'done') break;
      if (j.state === 'awaiting_approval' && !j.approval) E.approve(r.id);
      else if (!alive(r.id)) {
        await resume(r.pdf, tag('resume'));
        check(r.id, tag('after the resume'));
        // give the new runner the time to claim the job before asking again (a second resume in that
        // moment only starts a runner that leaves as busy)
        const claimed = Date.now() + 3000;
        while (!alive(r.id) && parsed(r.id, 'job.json').state !== 'done' && Date.now() < claimed) await sleep(20);
      }
      if (Date.now() > until) throw new Violation(tag(`not done after 60 s (state ${j.state})`));
      await sleep(40);
    }
    check(r.id, tag('at done'));
    await wakeAndLeave(E, r);
    // No LIVE runner may remain for a job that is done. (A runner that was KILLED could not give its pid
    // file back: a runner.pid that names a dead process is what a hard kill leaves, and blocks nobody.)
    await E.waitFor('no live runner for the done job', () => {
      const p = E.runnerPid(r.id);
      return !p || !pidAlive(p);
    }, 8000, 20);
    await lockFree(E, r.id);
  } catch (e) {
    throw e instanceof Violation ? e : new Violation(tag(e.message));
  }
  const { man, led } = check(r.id, tag('done'));
  await checkSpent(r.id, tag('done'));
  for (const s of STAGES) {
    const valid = man.rows.filter((x) => x.stage === s && x.status === 'done' && !x.superseded).length;
    if (valid !== 1) throw new Violation(tag(`done with ${valid} valid rows for ${s}`));
  }
  for (const s of PAID) {
    if (E.sends(r.id, s) < 1) throw new Violation(tag(`${s} was never sent`));
    if (!led.rows.some((x) => x.stage === s && x.status === 'settled')) throw new Violation(tag(`${s} has no settled row`));
  }
  if (!E.log(r.id).includes(`runner ${r.oldPid} stopped: superseded`)) throw new Violation(tag('the replaced runner did not stop as superseded'));
  stats.takeovers++;
  stats.orphaned += led.rows.filter((x) => x.status === 'orphaned').length;
  stats.neverSent += led.rows.filter((x) => x.status === 'failed' && x.not_sent === true).length;
  stats.late += led.rows.filter((x) => x.late === true).length;
  if (stats.takeovers % 5 === 0) console.log(`  ${stats.takeovers} takeovers, ${stats.kills2} second runners killed`);
}

const summary = () => `SOAK kills=${stats.kills} jobs_finished=${stats.jobs} orphaned_rows=${stats.orphaned} recovered_rows=${stats.recovered} ` +
  `resume_retries=${stats.retries} longest_resume_ms=${stats.longestResumeMs} takeovers=${stats.takeovers} ` +
  `second_runner_kills=${stats.kills2} (${stats.aimed} inside a pause) never_sent_rows=${stats.neverSent} late_rows=${stats.late} woke_before_done=${stats.wokeBeforeDone} violations=${stats.violations}`;

async function main() {
  const envs = [];
  let n = 0;
  try {
    if (KILLS > 0) {
      E = await mkEnv({ prefix: 'killsoak-', callUsd: 0.6, stepMs: 150, heartbeat: 0.05 });
      envs.push(E);
      console.log(`kill soak: temp home ${E.home}, port ${E.port}, target ${KILLS} kills`);
      while (stats.kills < KILLS) {
        n++;
        await runJob(n);
      }
    }
    if (FREEZES > 0) {
      E = await mkEnv({ prefix: 'freezesoak-', callUsd: 0.6, stepMs: 300, heartbeat: 0.05, staleSeconds: 1 });
      envs.push(E);
      console.log(`freeze soak: temp home ${E.home}, port ${E.port}, target ${FREEZES} takeovers`);
      // one takeover in three also kills the second runner
      for (let k = 1; k <= FREEZES; k++) await (between(0, 2) === 0 ? runFrozenKill2(k) : runFrozen(k));
    }
  } catch (e) {
    if (!(e instanceof Violation)) {
      stats.violations++;
      console.log(`UNEXPECTED ERROR: ${e.stack || e.message}`);
    } else {
      stats.violations++;
      console.log(`VIOLATION: ${e.message}`);
    }
    // the job being worked on is the newest one in the jobs folder
    const ids = fs.existsSync(E.config.jobsDir) ? fs.readdirSync(E.config.jobsDir) : [];
    const newest = ids.map((d) => ({ d, t: fs.statSync(E.jobPath(d, '.')).mtimeMs })).sort((a, b) => b.t - a.t)[0];
    if (newest) {
      dump(newest.d, e.message);
      console.log(`files dumped into ${dumpDir}`);
    }
  } finally {
    for (const X of envs) await X.cleanup();
  }
  const leftover = envs.flatMap((X) => X.leftover || []);
  console.log(summary());
  console.log(leftover.length ? `LEFTOVER pids ${leftover.join(',')}` : 'clean-up: no process of the soak remains');
  process.exit(stats.violations || leftover.length ? 1 : 0);
}

await main();
