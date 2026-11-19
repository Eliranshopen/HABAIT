#!/usr/bin/env node
/* Habait — tools/approve-build.mjs: Habait's admin switch for ONE project's paid build (the build lock, parity row 41; Eliran
   2026-11-08: «כן, ועם נעילת בנייה»). The portal never writes this flag: it lives outside the developer's prefix, at
   studio/approvals/<uid>/<pid>.json { build_approved, by, at, history[] }, read by studio-web/api/_dispatch.mjs before any build
   dispatch. Approving also puts a build that waits for Habait (job.needs.type 'build_approval') back in the queue; the developer's
   next page load (or `worker.mjs dispatch <job> --stage build`) boots it.
   Dry-run by default (prints what it would write); --go writes. Idempotent: approving an approved project only adds nothing.
   Run it where the store's keys are, by NAME: `vercel env run -e production -- node tools/approve-build.mjs …` (or -e preview).
   usage: node tools/approve-build.mjs <uid> <pid> [--by <name>] [--revoke] [--go]
          node tools/approve-build.mjs --show <uid> <pid>
   exit 0 ok · 1 failure (reason on stderr) · 2 usage. No secret is read into a file or printed. $0. */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const API = path.resolve(HERE, '..', '..', 'studio-web', 'api');
const argv = process.argv.slice(2);
const opt = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const has = (k) => argv.includes(k);
const pos = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--by'].includes(argv[i - 1])));
const [uid, pid] = pos;
const SAFE = /^[A-Za-z0-9_-]{1,64}$/;
if (!uid || !pid || !SAFE.test(uid) || !SAFE.test(pid)) { console.error('usage: approve-build.mjs <uid> <pid> [--by <name>] [--revoke] [--go] | --show <uid> <pid>'); process.exit(2); }

const { openStore } = await import(pathToFileURL(path.join(API, '_store.mjs')).href);
const { approvalPath, BUILD_WAIT_HE } = await import(pathToFileURL(path.join(API, '_dispatch.mjs')).href);
const store = await openStore({});
const now = new Date().toISOString();
const ap = approvalPath(uid, pid);
const base = `studio/u/${uid}/p/${pid}/`;
const cur = await store.getJson(ap);
const meta = await store.getJson(`${base}meta.json`);
const job = await store.getJson(`${base}job.json`);
const show = { approval: ap, build_approved: cur?.build_approved === true, by: cur?.by || null, at: cur?.at || null, project: meta ? meta.name : null,
  job: job ? { id: job.id, state: job.state, stage: job.stage, needs: job.needs?.type || null } : null };
if (has('--show')) { console.log(JSON.stringify(show, null, 1)); process.exit(0); }
if (!meta) { console.error(`approve-build: no project ${base}meta.json`); process.exit(1); }

const revoke = has('--revoke');
const by = String(opt('--by', 'habait')).slice(0, 80);
const entry = { action: revoke ? 'revoke' : 'approve', by, at: now };
const next = { schema: 'habait-studio/build-approval.v1', uid, pid, build_approved: !revoke, by, at: now, history: [...(cur?.history || []), entry].slice(-50) };
const requeue = !revoke && job && job.state === 'waiting' && job.needs?.type === 'build_approval';
console.log(`${revoke ? 'REVOKE' : 'APPROVE'} the paid build of "${meta.name}" (${uid}/${pid}) by ${by}`);
console.log(`  ${ap}: build_approved ${show.build_approved} → ${!revoke}`);
if (requeue) console.log(`  job ${job.id}: waiting for Habait → queued (the developer's next page load boots the build, or: worker.mjs dispatch ${job.id} --stage build)`);
if (!has('--go')) { console.log('DRY-RUN — add --go'); process.exit(0); }

await store.putJson(ap, next);
if (requeue) {
  job.state = 'queued'; job.stage = 'queued'; job.needs = null;
  job.log = [...(job.log || []), { at: now, line: 'צוות Habait אישר את הבנייה — היא נכנסת לתור' }].slice(-200);
  job.updated = now;
  await store.putJson(`${base}job.json`, job);
  await store.putJson(`studio/queue/${job.id}.json`, { schema: 'habait-studio/queue.v1', job: job.id, uid, pid, jobPath: `${base}job.json`, at: now });
}
const back = await store.getJson(ap);
if (back?.build_approved !== !revoke) { console.error('approve-build: the flag did not read back (a stale read? run --show in a minute)'); process.exit(1); }
console.log(`written · ${revoke ? `the build is locked again; a new build shows «${BUILD_WAIT_HE}»` : 'the build may run'}`);
