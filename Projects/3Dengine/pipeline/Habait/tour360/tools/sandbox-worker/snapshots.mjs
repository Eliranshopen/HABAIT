// snapshots.mjs — list the Vercel Sandbox snapshots, and delete ONE by exact id behind --go (rnd-9d, 2026-11-08).
// Dry-run by default (root §5). Never deletes the live worker snapshot (the id in studio/worker/snapshot.json) — pass it with --keep.
// usage (from habait-walkaround, creds via the project env):
//   vercel env run -e production -- node Habait/tour360/tools/sandbox-worker/snapshots.mjs list
//   vercel env run -e production -- node Habait/tour360/tools/sandbox-worker/snapshots.mjs delete <snapshotId> --keep <liveId> [--go]
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const { Snapshot } = await import(pathToFileURL(createRequire(path.join(HERE, 'package.json')).resolve('@vercel/sandbox')).href);
const [cmd, id] = process.argv.slice(2);
const opt = (k) => { const a = process.argv; const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
const GO = process.argv.includes('--go');

async function listAll() {
  const out = []; const pager = await Snapshot.list({});
  for await (const page of pager) { const items = page?.snapshots || page?.json?.snapshots || (Array.isArray(page) ? page : [page]); for (const s of items) out.push(s); }
  return out;
}
const fmt = (s) => `${s.id || s.snapshotId}  ${s.status}  created ${s.createdAt ? new Date(s.createdAt).toISOString() : '?'}  size ${s.sizeBytes ? (s.sizeBytes / 1e9).toFixed(2) + ' GB' : '?'}  source ${s.sourceSandboxId || '?'}`;

if (cmd === 'list') {
  const all = await listAll(); console.log(`${all.length} snapshot(s)`); for (const s of all) console.log(fmt(s));
} else if (cmd === 'delete') {
  const keep = opt('--keep');
  if (!id) { console.error('delete needs a snapshot id'); process.exit(2); }
  if (!keep) { console.error('delete needs --keep <live worker snapshot id>'); process.exit(2); }
  if (id === keep) { console.error('refusing: that is the live worker snapshot'); process.exit(2); }
  const snap = await Snapshot.get({ snapshotId: id });
  console.log('target:', id, 'status', snap.status ?? snap.snapshot?.status ?? '?');
  if (!GO) { console.log('DRY-RUN — add --go to delete'); process.exit(0); }
  await snap.delete(); console.log('deleted', id);
} else if (cmd === 'boot') {
  // boot <snapshotId> --go: start a 2-vCPU VM from the snapshot, check the code and Blender, stop it (≈ 1 min of sandbox time)
  if (!GO) { console.log('DRY-RUN — boot', id, '(add --go)'); process.exit(0); }
  const { Sandbox } = await import(pathToFileURL(createRequire(path.join(HERE, 'package.json')).resolve('@vercel/sandbox')).href);
  const t0 = Date.now();
  const sbx = await Sandbox.create({ source: { type: 'snapshot', snapshotId: id }, resources: { vcpus: 2 }, timeout: 5 * 60000, persistent: false, tags: { role: 'snapshot-boot-check' } });
  try {
    const r = await sbx.runCommand({ cmd: 'bash', args: ['-lc', [
      'cd /vercel/sandbox/hw',
      'node --check Habait/tour360/tools/run-job.mjs && node --check Habait/tour360/tools/run-project.mjs && echo SYNTAX-OK',
      'grep -c "t-view-btn" Habait/tour360/viewer/template.html | sed "s/^/view-menu-refs: /"',
      'grep -c "t-tools-btn" Habait/tour360/viewer/template.html | sed "s/^/tools-menu-refs: /"',
      'grep -c "MUSIC_BPM" Habait/tour360/viewer/tour.js | sed "s/^/music-refs: /"',
      '/vercel/sandbox/blender/blender --version 2>/dev/null | head -1',
    ].join(' && ')] });
    console.log((await r.stdout()).trim()); const err = (await r.stderr()).trim(); if (err) console.log('stderr:', err.slice(0, 400));
    console.log('exit', r.exitCode, '| boot+check', ((Date.now() - t0) / 1000).toFixed(1), 's');
  } finally { try { await sbx.stop(); console.log('stopped'); } catch { /* gone */ } }
} else { console.error('usage: list | delete <id> --keep <liveId> [--go] | boot <id> [--go]'); process.exit(2); }
