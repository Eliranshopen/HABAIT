/* Habait Studio — pipeline/index.mjs: the fixed order of stages and the runner.
   Each stage is a module { id, title_he, title_en, needs(ctx) -> string|null, run(ctx) -> result }.
   result = { status: 'done'|'needs-review'|'blocked'|'skipped', note, outputs?: string[], cost_usd?: number }.
   The runner stops at the first 'blocked' stage (its reason is in state.json) and otherwise walks on. */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import intake from './stages/intake.mjs';
import site from './stages/site.mjs';
import plan from './stages/plan.mjs';
import shots from './stages/shots.mjs';
import scene from './stages/scene.mjs';
import clay from './stages/clay.mjs';
import keyframes from './stages/keyframes.mjs';
import video from './stages/video.mjs';
import assemble from './stages/assemble.mjs';

export const STAGES = [intake, site, plan, shots, scene, clay, keyframes, video, assemble];
export const STAGE_IDS = STAGES.map((s) => s.id);

/** Run a child process, streaming its lines to ctx.log; resolves { code, seconds }. */
export function runProcess(ctx, cmd, args, { cwd, timeoutMs = 30 * 60 * 1000, env } = {}) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    ctx.log(`$ ${path.basename(cmd)} ${args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' ')}`);
    const child = spawn(cmd, args, { cwd, env: { ...process.env, PYTHONIOENCODING: 'utf-8', ...(env || {}) }, windowsHide: true });
    let tail = '';
    const onData = (buf) => {
      const text = buf.toString('utf8');
      tail = (tail + text).slice(-4000);
      for (const line of text.split(/\r?\n/)) if (line.trim()) ctx.log(`  ${line.trimEnd()}`);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    const timer = setTimeout(() => { ctx.log(`  ! timeout after ${timeoutMs / 1000}s, killing`); child.kill(); }, timeoutMs);
    child.on('error', (e) => { clearTimeout(timer); ctx.log(`  ! spawn error: ${e.message}`); resolve({ code: -1, seconds: (Date.now() - t0) / 1000, tail }); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, seconds: (Date.now() - t0) / 1000, tail }); });
  });
}

export function makeContext(store, id, env, emit) {
  const project = store.meta(id);
  const paths = store.paths(id);
  const ctx = {
    store, id, env, project, paths, stage: null,
    repo: env.REPO,
    log(line) { emit({ type: 'log', stage: ctx.stage, line: String(line), at: Date.now() }); },
    emit,
    derived(name) { return store.derived(id, name); },
    saveDerived(name, data) { store.saveDerived(id, name, data); return path.join(paths.derived, name); },
    file(...p) { return path.join(paths.dir, ...p); },
    rel(p) { return path.relative(paths.dir, p).replace(/\\/g, '/'); },
    ledgerTotal() { return store.ledgerTotal(id); },
    /** Returns null when a paid call may proceed, else the reason it may not. */
    spendGate(usd) {
      if (!env.ALLOW_SPEND) return 'spending is off (HABAIT_ALLOW_SPEND=1 to allow)';
      const total = store.ledgerTotal(id);
      if (total + usd > env.CAP_USD) return `cap: ${total.toFixed(2)} + ${usd.toFixed(2)} > ${env.CAP_USD} USD`;
      return null;
    },
    spend(row) { return store.spend(id, row); },
    run: (cmd, args, opts) => runProcess(ctx, cmd, args, opts),
  };
  return ctx;
}

export async function runPipeline(store, id, { stages, env, emit = () => {}, force = false }) {
  const wanted = (stages && stages.length ? stages : STAGE_IDS).filter((s) => STAGE_IDS.includes(s));
  const ctx = makeContext(store, id, env, emit);
  store.setRunning(id, true);
  emit({ type: 'run', status: 'started', stages: wanted });
  const results = {};
  try {
    for (const stage of STAGES) {
      if (!wanted.includes(stage.id)) continue;
      ctx.stage = stage.id;
      ctx.project = store.meta(id);
      const prior = store.state(id).stages[stage.id];
      if (!force && prior && prior.status === 'done' && stage.cacheable !== false && !stage.isStale?.(ctx, prior)) {
        ctx.log(`${stage.id}: already done (${prior.at}); --force to redo`);
        results[stage.id] = { ...prior, status: 'done', cached: true };
        emit({ type: 'stage', stage: stage.id, status: 'done', note: prior.note, cached: true });
        continue;
      }
      const missing = stage.needs ? stage.needs(ctx) : null;
      if (missing) {
        const r = { status: 'blocked', note: missing };
        store.setStage(id, stage.id, r); results[stage.id] = r;
        emit({ type: 'stage', stage: stage.id, ...r });
        ctx.log(`${stage.id}: blocked — ${missing}`);
        break;
      }
      store.setStage(id, stage.id, { status: 'running', note: '' });
      emit({ type: 'stage', stage: stage.id, status: 'running' });
      const t0 = Date.now();
      let r;
      try { r = await stage.run(ctx); } catch (e) { r = { status: 'blocked', note: `error: ${e.message}` }; ctx.log(`${stage.id}: ${e.stack || e.message}`); }
      r.seconds = Math.round((Date.now() - t0) / 10) / 100;
      store.setStage(id, stage.id, r); results[stage.id] = r;
      emit({ type: 'stage', stage: stage.id, ...r });
      ctx.log(`${stage.id}: ${r.status}${r.note ? ' — ' + r.note : ''} (${r.seconds}s)`);
      if (r.status === 'blocked') break;
      if (r.status === 'needs-review' && stage.haltOnReview) { ctx.log(`${stage.id}: waiting for your review before the next stage`); break; }
    }
  } finally {
    store.setRunning(id, false);
    emit({ type: 'run', status: 'finished', results });
  }
  return results;
}

export function describeStages() {
  return STAGES.map((s) => ({ id: s.id, title_he: s.title_he, title_en: s.title_en, paid: Boolean(s.paid), local: Boolean(s.local) }));
}

export { fs };
