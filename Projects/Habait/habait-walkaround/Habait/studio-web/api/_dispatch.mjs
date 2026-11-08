/* Habait Studio — api/_dispatch.mjs: start a Vercel Sandbox that runs ONE portal job (contract: ../CLAUDE.md
   "Job contract — habait-studio/job.v1"). Fork E of rnd-9d, 2026-11-05; plan development/plans/2026-11-04-sandbox-worker.md.

   The trigger is the portal's own request (build / trace approval / correction): the same POST that queues the job boots a
   sandbox from the worker snapshot and runs `run-job.mjs --once --job <id>` detached, then returns. The executor inside the VM
   writes state/stage/percent/log into job.json exactly as it does on the laptop; this file only records the sandbox on the job.
   No cron: Hobby runs a cron once a day at most, so the retry path is the developer's own page load (needsDispatch) and the
   stale sweep that every sandbox runs first (`--sweep-only --stale-min 50`: a session is capped at 45 min, so a 'running' job
   with no heartbeat for 50 min had its VM killed).

   Two kinds of sandbox (2026-11-05, the build-stage proof):
     trace  one-off (persistent:false), a new name per attempt — a re-run starts clean;
     build  PERSISTENT under one name per job (`job-<id>-build`): a Hobby session is capped at 45 min and a full apartment does
            not render in one, so at cap − 3 min run-job's watchdog puts the job back to 'queued' (the state lives in the store,
            job.json), the session ends, the filesystem is snapshotted, and the next dispatch RESUMES the same sandbox — the renders
            already on its disk are skipped (render_tour --skip-if-clean) and the build continues. Deleted when the job is finished.

   Secrets by NAME only: the store's names (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, or BLOB_READ_WRITE_TOKEN) and FAL_KEY are copied
   from this function's env into the VM's command env (never a
   file, never printed). The SDK authenticates with the deployment's OIDC token — automatic on Vercel, `vercel env run` on the
   laptop. The snapshot (code + python venv + @vercel/blob [+ Blender + assets + Chromium]) is built by
   tools/sandbox-worker/worker.mjs and its id lives in the store at SNAPSHOT_PATH, so a release never touches an env var. */

export const SNAPSHOT_PATH = 'studio/worker/snapshot.json';
export const STAGES = {
  trace: { timeoutMin: 30, vcpus: 2, draft: false, persistent: false },   // auto-trace + trace-check + judge: fal I/O, little CPU
  build: { timeoutMin: 44, vcpus: 4, draft: true, persistent: true },     // apartment … qa; chunked across sessions (Hobby: 45 min each)
};
export const VM = {
  root: '/vercel/sandbox', hw: '/vercel/sandbox/hw', py: '/vercel/sandbox/venv/bin/python', blob: '/vercel/sandbox/blobdeps',
  app: '/vercel/sandbox/appdeps', blender: '/vercel/sandbox/blender/blender', chrome: '/vercel/sandbox/chrome', log: '/vercel/sandbox/job.log',
};
const PRICE = { cpu_h: 0.128, gb_h: 0.0212 };   // Pro rates = the upper bound; Hobby's included hours bill $0 (plan §1)
export const estimateUsd = (vcpus, minutes) => Math.round((vcpus * PRICE.cpu_h + vcpus * 2 * PRICE.gb_h) * (minutes / 60) * 1e4) / 1e4;

/** The VM's environment for ONE session: the runner's path overrides (every Windows default in run-job/run-project/auto-trace/
 *  render_tour/responsive-gate is env-overridable), this session's watchdog deadline and Blender lock (a lock file left by a killed
 *  session must never block the next one on a resumed disk), and the secrets by name. */
export function sandboxEnv(stage, deadlineMs, env = process.env) {
  const out = {
    HABAIT_PY: VM.py, HABAIT_BLOB_DIR: VM.blob, HABAIT_APP_DIR: VM.app, HABAIT_ENV_ROOT: VM.hw, BLENDER: VM.blender, CHROME: VM.chrome, HABAIT_LEGAL_DIR: `${VM.hw}/_data/legal`,
    HABAIT_BLENDER_LOCK: `/tmp/blender-${deadlineMs}.lock`, HABAIT_JOB_DEADLINE_MS: String(deadlineMs), HABAIT_STAGE: stage, PYTHONIOENCODING: 'utf-8',
  };
  // the storage adapter's names (fork G, 2026-11-05: Supabase Storage since the Blob suspension; STORE picks the backend)
  for (const k of ['STORE', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY', 'BLOB_READ_WRITE_TOKEN', 'FAL_KEY', 'OPENROUTER_API_KEY']) if (env[k]) out[k] = env[k];
  return out;
}

/** The one command a session runs: the stale sweep, then this job only (`flags`: run-job's own, e.g. --no-paid). Output appends
 *  to VM.log, which survives a resumed build sandbox. */
export function jobCommand(jobId, stage, flags = []) {
  const rj = 'Habait/tour360/tools/run-job.mjs';
  const named = flags.some((f) => f.startsWith('--render='));   // a named render setting replaces the stage's draft
  const extra = [...(STAGES[stage].draft && !named ? ['--draft'] : []), ...flags].filter((f) => /^--[a-z-]+(=\d+x\d+@\d+)?$/.test(f)).map((f) => ` ${f}`).join('');
  return `cd ${VM.hw} && echo "=== session $(date -u +%FT%TZ)" >> ${VM.log}; node ${rj} --sweep-only --stale-min 50 >> ${VM.log} 2>&1; node ${rj} --once --job ${jobId}${extra} >> ${VM.log} 2>&1; echo "EXIT=$?" >> ${VM.log}`;
}

/** Which stage a queued job needs next — the executor's own rule (run-job.mjs handle()): a trace until one is approved, or
 *  again after a correction newer than the approval; otherwise the build. */
export function stageOf(job) {
  const approvedAt = job.approvals?.trace?.at || '';
  const correction = (job.corrections || []).some((c) => c.at > approvedAt);
  return !job.inputs?.trace || correction ? 'trace' : 'build';
}

/** A finished job's sandbox idles until its session cap (`sudo poweroff` inside the VM does not end the session — probed
 *  2026-11-05), and idle sandboxes count against the plan's concurrency (10 on Hobby). So the next page load of the project, or
 *  the next dispatch, stops it; a persistent build sandbox of a FINISHED job is deleted (no snapshot storage left behind).
 *  Returns true when a stop was sent. */
export async function stopFinished(job, jobPathname, { store, Sandbox = null }) {
  const sb = job?.sandbox;
  if (!sb?.name || sb.stopped || ['running', 'queued'].includes(job.state)) return false;
  const SB = Sandbox || (await import('@vercel/sandbox')).Sandbox;
  try {
    const s = await SB.get({ name: sb.name, resume: false });
    await s.stop();
    if (sb.persistent && ['done', 'failed', 'review'].includes(job.state)) await s.delete().catch(() => {});
  } catch { /* already gone (timed out) */ }
  job.sandbox = { ...sb, stopped: new Date().toISOString() };
  await store.writeJson(jobPathname, job);
  return true;
}

/** A queued job with no sandbox, or whose last sandbox session is over (the watchdog or a kill put it back), is re-dispatched. */
export function needsDispatch(job, nowMs = Date.now()) {
  if (!job || job.state !== 'queued') return false;
  if (!job.sandbox) return true;
  return nowMs - Date.parse(job.sandbox.started || 0) > (job.sandbox.timeoutMin || 45) * 60000;
}

/**
 * Boot (or, for a build, resume) a sandbox for `job` and start its stage, detached. `store` = { readJson(path), writeJson(path,
 * data) } over the private Blob store (the function's _studio.mjs, or the worker CLI's adapter); `Sandbox` is injected by the CLI
 * (its own node_modules) and imported here on Vercel. `timeoutMin` overrides the stage's session cap (a proof forces a chunk with
 * it); `flags` go to run-job. Returns the sandbox record written onto the job; every session is appended to job.sandbox.sessions.
 */
export async function dispatch(job, jobPathname, { stage, store, Sandbox = null, env = process.env, log = () => {}, timeoutMin = null, flags = [] }) {
  const S = STAGES[stage];
  if (!S) throw new Error(`unknown stage ${stage}`);
  const snap = await store.readJson(SNAPSHOT_PATH);
  if (!snap?.snapshotId) throw new Error(`no worker snapshot at ${SNAPSHOT_PATH} (tools/sandbox-worker/worker.mjs build-snapshot --go)`);
  if (stage === 'build' && !snap.withBlender) throw new Error('the worker snapshot carries no Blender (build-snapshot --with-blender --go)');
  const SB = Sandbox || (await import('@vercel/sandbox')).Sandbox;
  const cap = Math.min(Number(timeoutMin || S.timeoutMin), 45);
  const attempt = (job.dispatches || 0) + 1;
  const started = Date.now();
  const deadline = started + Math.max(cap - 3, 1) * 60000;   // the watchdog in run-job fires 3 min before the session cap
  const vmEnv = sandboxEnv(stage, deadline, env);
  const prev = job.sandbox;
  let sbx; let resumed = false;
  const name = S.persistent ? `job-${job.id}-build` : `job-${job.id}-${attempt}`;   // a build keeps ONE disk across its sessions
  if (prev?.name && !prev.stopped && prev.name !== name) { try { const s = await SB.get({ name: prev.name, resume: false }); await s.stop(); } catch { /* gone */ } }   // the previous attempt never idles on
  if (S.persistent) {
    try { sbx = await SB.get({ name, resume: false }); resumed = true; } catch { sbx = null; }
    if (sbx) { try { if (sbx.status === 'running') await sbx.stop(); } catch { /* not running */ } await sbx.update({ timeout: cap * 60000 }); }
  }
  if (!sbx) {
    sbx = await SB.create({
      name, source: { type: 'snapshot', snapshotId: snap.snapshotId }, resources: { vcpus: S.vcpus }, timeout: cap * 60000,
      persistent: S.persistent, ...(S.persistent ? { keepLastSnapshots: { count: 1 } } : {}), env: vmEnv, tags: { role: 'job', job: job.id, stage },
    });
  }
  // the record is written BEFORE the command starts: the VM's run-job claims the job within seconds and must read it, never be
  // overwritten by a late dispatcher write (a 'running' job turned back to 'queued')
  job.dispatches = attempt;
  const sessions = [...(prev?.name === name ? prev.sessions || [] : []), { n: attempt, started: new Date(started).toISOString(), cap_min: cap, resumed }];
  job.sandbox = {
    id: sbx.sandboxId || sbx.id || null, name, stage, vcpus: S.vcpus, timeoutMin: cap, persistent: S.persistent, started: new Date(started).toISOString(),
    snapshot: snap.snapshotId, estUsd: estimateUsd(S.vcpus, cap), ended: null, minutes: null, sessions,
  };
  log(job, `הבנייה הופעלה בשרת (${stage === 'trace' ? 'שרטוט ובדיקה' : 'בנייה'}, ניסיון ${attempt}${resumed ? ', ממשיכה מהסבב הקודם' : ''})`);
  await store.writeJson(jobPathname, job);
  await sbx.runCommand({ cmd: 'bash', args: ['-lc', jobCommand(job.id, stage, flags)], env: vmEnv, detached: true });   // a resume boots the session here
  return job.sandbox;
}
