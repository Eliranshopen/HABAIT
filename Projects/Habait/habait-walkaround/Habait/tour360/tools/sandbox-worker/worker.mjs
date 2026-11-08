#!/usr/bin/env node
/* Habait Tour360 — tools/sandbox-worker/worker.mjs: the laptop side of the Vercel Sandbox queue worker (fork E of rnd-9d,
   2026-11-05; plan development/plans/2026-11-04-sandbox-worker.md). The dispatcher itself is Habait/studio-web/api/_dispatch.mjs
   (shared with the portal's functions); this CLI builds the worker snapshot and drives the dispatcher by hand for proofs.

     node worker.mjs build-snapshot [--go] [--with-blender] [--vcpus 2]
         boot a sandbox, install the executor's runtime (python venv: numpy, opencv, pymupdf, shapely, scikit-image; @vercel/blob
         for run-job; the tour360 + pipeline code at this checkout [+ Blender 4.5.10 + the render assets]), snapshot it, and write
         the id to Blob studio/worker/snapshot.json. Dry-run without --go prints the file set and the cost cap.
     node worker.mjs refresh-snapshot [--go]                    a code release: boot from the current snapshot, re-upload the code, snapshot
     node worker.mjs dispatch <jobId> [--stage trace|build]     start a sandbox for one queued job (what the portal does itself)
     node worker.mjs status <jobId>                             print the job's state, sandbox record and log tail (read-only)
     node worker.mjs vm-log <jobId> [path]                      the VM's job.log (or any file) while the sandbox still lives (read-only)
     node worker.mjs test-build-job --plan <plan.general.json> --crop <png> --spec <spec.json> [--timeout-min N] [--flags --no-paid] [--go]
         a project whose trace is already approved, dispatched as a BUILD (persistent sandbox, resumed across sessions)
     node worker.mjs dispatch <jobId> [--stage build] [--timeout-min N] [--flags --no-paid]   (re-)dispatch; a build RESUMES its sandbox
     node worker.mjs vm-run <jobId> [--cap <min>] -- <bash…>    one command in the job's sandbox (resumed if stopped), output printed
     node worker.mjs stop <jobId…>                              stop a finished job's idle VM (what the portal does on the next page load)
     node worker.mjs test-job --pdf <file> --spec <spec.json> [--uid <uid>] [--pid <pid>] [--vlm <saved reading>] [--no-paid] [--go]
         write a test project (files/, spec.json, job.json, queue pointer) under studio/u/<uid>/p/<pid>/ and dispatch its trace

   Run every command as `vercel env run -e preview -- node worker.mjs …` from the linked habait-flow stage folder: the SDK reads
   VERCEL_OIDC_TOKEN and run-job's store reads BLOB_READ_WRITE_TOKEN from the process env, and `-e preview` (or production) is
   where FAL_KEY lives — the default (development) env has no FAL_KEY, so a trace dispatched from the laptop without it fails at
   the first vision call (test job 3, jtmw3euv45, 2026-11-05). On Vercel the function's own env carries both. ⛔ Never forwards process.env into
   the VM (only the names _dispatch.sandboxEnv lists), never logs a value, writes no token. HABAIT_BLOB_DIR must point at a
   folder with node_modules/@vercel/blob (e.g. the deploy stage after `npm i`). */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';
import { dispatch, stopFinished, SNAPSHOT_PATH, VM, estimateUsd } from '../../../studio-web/api/_dispatch.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HW = path.resolve(HERE, '..', '..', '..', '..');                     // habait-walkaround (code)
const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const has = (k) => argv.includes(k);
const GO = has('--go');
const now = () => new Date().toISOString();
const say = (s) => console.log(`[${now().slice(11, 19)}] ${s}`);

// ───────────────────────────── the SDKs: @vercel/sandbox from this folder, @vercel/blob from HABAIT_BLOB_DIR
const { Sandbox } = await import(pathToFileURL(createRequire(path.join(HERE, 'package.json')).resolve('@vercel/sandbox')).href);
// the shared storage adapter (fork G, 2026-11-05): Supabase Storage since the Blob store's suspension, the Blob store with
// STORE=blob — the same module the portal's functions and run-job use; keys come from the process env by NAME (`vercel env run`)
async function openStore() {
  const { openStore: openShared } = await import(pathToFileURL(path.join(HW, 'Habait', 'studio-web', 'api', '_store.mjs')).href);
  const where = process.env.HABAIT_BLOB_DIR;
  const loadBlob = async () => { if (!where) throw new Error('HABAIT_BLOB_DIR must name a folder with node_modules/@vercel/blob'); return import(pathToFileURL(createRequire(path.join(where, 'package.json')).resolve('@vercel/blob')).href); };
  const s = await openShared({ loadBlob });
  return { kind: s.kind, list: s.list, getBytes: s.getBytes, readJson: async (p, fallback = null) => (await s.getJson(p)) ?? fallback, writeJson: s.putJson, putFile: (p, file) => s.putFile(p, file) };
}
const logLine = (job, line) => { job.log = [...(job.log || []), { at: now(), line: String(line).slice(0, 300) }].slice(-200); job.updated = now(); say(`${job.id} · ${line}`); };

// ───────────────────────────── the file set that becomes the snapshot (by rule, never a directory dump)
const SKIP_DIRS = new Set(['node_modules', 'evidence', '__pycache__', 'out', '.git', 'walk', '_local', 'dist', 'test', 'fixtures']);
// secret-shaped names are never uploaded: .env*, keys, credentials, anything 'secret', a file named token(.x) — but not tokens.css
// (the platform's design tokens: the first Blender snapshot dropped it under a bare /token/ rule and every page 404'd on it)
const SECRET_NAME = /(^|\/)\.env|secret|credential|\.pem$|\.key$|(^|\/)token(\.|$)|_token/i;
const SKIP_FILE = (n) => n === 'CLAUDE.md' || /\.(log|pyc)$/.test(n) || SECRET_NAME.test(n);
// the render assets (catalog models, HDRI, textures) are gitignored: a worktree has none, so they come from the live tree
const ASSETS = process.env.HABAIT_ASSETS_ROOT || 'C:/RnD/Projects/Habait/habait-walkaround';
function walk(relDir, files, root = HW, skip = SKIP_DIRS) {
  const abs = path.join(root, relDir);
  if (!fs.existsSync(abs)) return;
  for (const n of fs.readdirSync(abs)) {
    const rel = `${relDir}/${n}`;
    const st = fs.statSync(path.join(root, rel));
    if (st.isDirectory()) { if (!skip.has(n)) walk(rel, files, root, skip); continue; }
    if (SKIP_FILE(n)) continue;
    files.push({ rel, src: path.join(root, rel), bytes: st.size });
  }
}
const one = (rel, files, root = HW) => { const src = path.join(root, rel); if (fs.existsSync(src)) files.push({ rel, src, bytes: fs.statSync(src).size }); };
function fileSet({ withBlender, codeOnly = false }) {
  const files = [];
  // Habait/engine/intake: auto_pages.py imports rasterize.py from there (the second test job, jtmw3elpdu, fell on its absence)
  one('Habait/studio-web/api/_store.mjs', files);   // run-job's storage adapter (fork G)
  for (const d of ['Habait/tour360/tools', 'Habait/tour360/server', 'Habait/tour360/viewer', 'Habait/tour360/catalog', 'Habait/tour360/copy', 'Habait/engine/intake', '360walkaround/pipeline']) walk(d, files);
  for (const n of fs.readdirSync(path.join(HW, '360walkaround/catalog'))) if (n.endsWith('.json')) files.push({ rel: `360walkaround/catalog/${n}`, src: path.join(HW, '360walkaround/catalog', n), bytes: fs.statSync(path.join(HW, '360walkaround/catalog', n)).size });
  if (withBlender) {
    // the BUILD stage (2026-11-05): the house data run-project reads (apartments/apt846's json = the template's material board and
    // disclosure keys), tour360's rule files (fidelity.json, PROJECT-PACKAGE.md's parity registry), the house style, the platform
    // template (build_zip.mjs, landing/apartment pages the qa gate serves; no fixtures), the responsive gate
    for (const n of fs.readdirSync(path.join(HW, 'Habait/tour360/apartments/apt846'))) if (n.endsWith('.json')) one(`Habait/tour360/apartments/apt846/${n}`, files);
    for (const n of fs.readdirSync(path.join(HW, 'Habait/tour360'))) if (/\.(json|md)$/.test(n) && n !== 'CLAUDE.md') one(`Habait/tour360/${n}`, files);
    walk('Habait/tour360/house-style', files);
    walk('Habait/platform', files);
    walk('Habait/tools/qa', files);
    // the legal caption of the apartment page (platform/tools/build_zip.mjs: $HABAIT_LEGAL_DIR) lives outside habait-walkaround
    const LEGAL = process.env.HABAIT_LEGAL_SRC || 'C:/RnD/Projects/Habait/data/sales-plans/legal';
    for (const n of ['caption-v1.json', 'disclaimer-he-en.md']) if (fs.existsSync(path.join(LEGAL, n))) files.push({ rel: `_data/legal/${n}`, src: path.join(LEGAL, n), bytes: fs.statSync(path.join(LEGAL, n)).size });
    // pipeline fixtures (check-depth-golden.mjs runs after every render) — SKIP_DIRS drops 'fixtures' elsewhere
    walk('360walkaround/pipeline/fixtures', files, HW, new Set(['__pycache__']));
    // the render assets the spike uploaded (294 MB): the locked style's models, the HDRI, the probe textures — from the live tree
    if (codeOnly) return files;
    const style = JSON.parse(fs.readFileSync(path.join(HW, '360walkaround/catalog/style-habait-modern.json'), 'utf8'));
    const dirs = new Set(Object.values(style.models).map((m) => path.posix.dirname(`360walkaround/${m.file}`)));
    for (const d of [...dirs].sort()) walk(d, files, ASSETS, new Set(['__pycache__']));
    one(`360walkaround/${style.surfaces.hdri.file}`, files, ASSETS);
    walk('360walkaround/pipeline/probe/probe-assets/textures', files, ASSETS, new Set(['__pycache__']));
    one('360walkaround/pipeline/probe/probe-assets/assets.lock.json', files);
  }
  const seen = new Set(); for (let i = files.length - 1; i >= 0; i--) { if (seen.has(files[i].rel)) files.splice(i, 1); else seen.add(files[i].rel); }
  for (const f of files) if (SECRET_NAME.test(f.rel)) throw new Error(`refusing a secret-shaped path: ${f.rel}`);
  return files;
}

const BLENDER = {
  version: '4.5.10',
  urls: ['https://mirrors.ocf.berkeley.edu/blender/release/Blender4.5/blender-4.5.10-linux-x64.tar.xz', 'https://mirror.clarkson.edu/blender/release/Blender4.5/blender-4.5.10-linux-x64.tar.xz',
    'https://ftp.nluug.nl/pub/graphics/blender/release/Blender4.5/blender-4.5.10-linux-x64.tar.xz', 'https://download.blender.org/release/Blender4.5/blender-4.5.10-linux-x64.tar.xz'],
  sha256: '198a4248b38899af661aa9241cebd746394eaddbfafbeb53152440de80b118f7',
};
const APT = ['libx11-6', 'libxi6', 'libxxf86vm1', 'libxfixes3', 'libxrender1', 'libxkbcommon0', 'libgl1', 'libegl1', 'libsm6', 'libice6', 'time', 'xz-utils'];
const PIP = ['numpy', 'opencv-python-headless', 'pymupdf', 'shapely', 'scikit-image'];

async function sh(sbx, script, { sudo = false } = {}) {
  const c = await sbx.runCommand({ cmd: 'bash', args: ['-lc', script], sudo });
  return { code: c.exitCode, out: await c.stdout(), err: await c.stderr() };
}
const must = (r, what) => { if (r.code !== 0) throw new Error(`${what}: exit ${r.code}: ${(r.err || r.out).slice(-500)}`); return r; };

// ───────────────────────────── build-snapshot
async function buildSnapshot() {
  const withBlender = has('--with-blender');
  const vcpus = Number(opt('--vcpus', '2'));
  const files = fileSet({ withBlender });
  const bytes = files.reduce((a, f) => a + f.bytes, 0);
  const listHash = createHash('sha256').update(files.map((f) => `${f.rel}\t${f.bytes}`).join('\n')).digest('hex');
  let head = 'unknown'; try { head = execSync('git rev-parse --short HEAD', { cwd: HW, encoding: 'utf8' }).trim(); } catch { /* no git */ }
  const key = `${head}+${listHash.slice(0, 12)}+py${PIP.length}${withBlender ? `+blender${BLENDER.version}` : ''}`;
  say(`snapshot key ${key} · ${files.length} files · ${(bytes / 1e6).toFixed(1)} MB · blender ${withBlender} · session cap 40 min on ${vcpus} vCPU (<= $${estimateUsd(vcpus, 40)} at Pro rates)`);
  if (!GO) { console.log('DRY-RUN — nothing created. Add --go (under `vercel env run`).'); return; }
  if (!process.env.VERCEL_OIDC_TOKEN && !process.env.VERCEL_TOKEN) throw new Error('no Vercel credential in the process env (run under `vercel env run`)');
  const store = await openStore();
  const evid = path.join(HERE, 'evidence', `${now().slice(0, 10)}-snapshot`);
  fs.mkdirSync(evid, { recursive: true });
  const t0 = Date.now();
  const phases = [];
  const phase = async (name, fn) => { const s = Date.now(); const r = await fn(); phases.push({ name, s: Number(((Date.now() - s) / 1000).toFixed(1)) }); say(`${name}: ${((Date.now() - s) / 1000).toFixed(1)} s`); return r; };
  const sbx = await Sandbox.create({ resources: { vcpus }, timeout: 40 * 60000, persistent: false, tags: { role: 'snapshot-build' } });
  say(`sandbox ${sbx.sandboxId || sbx.id || '?'} booted`);
  let snapshotId = null;
  try {
    // @vercel/blob for run-job's store; appdeps = the laptop's tools/appdeps (sharp for auto-trace's crops, playwright-core for the
    // proof tools — app-require.mjs resolves $HABAIT_APP_DIR by the presence of node_modules/playwright-core). No Chromium download:
    // the trace stage never opens a browser; the build stage's paint proof is out of this snapshot's scope.
    await phase('tooling', async () => must(await sh(sbx, `node --version && python3 --version && mkdir -p ${VM.hw} ${VM.blob} ${VM.app} && cd ${VM.blob} && npm init -y >/dev/null && npm i --silent @vercel/blob@2.8.2 && node -e "require('@vercel/blob'); console.log('blob ok')" && cd ${VM.app} && npm init -y >/dev/null && npm i --silent sharp@0.34.4 playwright-core@1.56.1 && node -e "require('sharp'); require('playwright-core'); console.log('appdeps ok')"`), 'tooling'));
    await phase('python-venv', async () => must(await sh(sbx, `python3 -m venv ${VM.root}/venv && ${VM.root}/venv/bin/pip install -q ${PIP.join(' ')} && ${VM.py} -c "import numpy, cv2, pymupdf, shapely, skimage; print('py deps ok')"`), 'pip'));
    if (withBlender) {
      await phase('apt', async () => must(await sh(sbx, `apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends ${APT.join(' ')}`, { sudo: true }), 'apt'));
      await phase('blender', async () => {
        let ok = false;
        for (const url of BLENDER.urls) { const r = await sh(sbx, `curl -fsSL -o ${VM.root}/blender.tar.xz ${url} && echo "${BLENDER.sha256}  ${VM.root}/blender.tar.xz" | sha256sum -c -`); if (r.code === 0) { ok = true; break; } }
        if (!ok) throw new Error('no mirror served the verified Blender tarball');
        must(await sh(sbx, `mkdir -p ${VM.root}/blender && tar -xJf ${VM.root}/blender.tar.xz -C ${VM.root}/blender --strip-components=1 && rm ${VM.root}/blender.tar.xz && ${VM.blender} -b --factory-startup --version | head -1`), 'blender extract');
      });
    }
    await phase('upload', async () => {
      const dirs = [...new Set(files.map((f) => path.posix.dirname(`${VM.hw}/${f.rel}`)))];
      for (let i = 0; i < dirs.length; i += 200) must(await sh(sbx, `mkdir -p ${dirs.slice(i, i + 200).map((d) => `'${d}'`).join(' ')}`), 'mkdir');
      let batch = [], size = 0;
      const flush = async () => { if (!batch.length) return; await sbx.writeFiles(batch); batch = []; size = 0; };
      let sent = 0;   // the bytes actually read and sent (a file edited after the listing failed the first Blender snapshot's count)
      for (const f of files) { const content = fs.readFileSync(f.src); sent += content.length; batch.push({ path: `${VM.hw}/${f.rel}`, content }); size += content.length; if (size > 24e6) await flush(); }
      await flush();
      const c = must(await sh(sbx, `find ${VM.hw} -type f | wc -l; du -sb ${VM.hw} | cut -f1`), 'count');
      const [n, b] = c.out.trim().split('\n').map(Number);
      if (n !== files.length || b !== sent) throw new Error(`upload mismatch: ${n} files / ${b} B in the VM vs ${files.length} / ${sent}`);
    });
    // the smoke: auto-trace's module graph loads in the VM (sharp via appdeps, the server's chat transport, file-ledger) and the
    // python trace modules import — the two things the first test job (2026-11-05, jtmw3ecekt) fell on
    if (withBlender) {
      // Chromium for the qa step (Habait/tools/qa/responsive-gate.mjs reads $CHROME): playwright-core's own build + its system libs.
      // Playwright 1.56 refuses the sandbox's Ubuntu 26.04 ("does not support chromium on ubuntu26.04-x64"); the 24.04 build runs
      // there (proved 2026-11-05 in the build proof: deps + download + a headless page in 42 s) — hence the platform override
      await phase('chromium-deps', async () => must(await sh(sbx, `export PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 && cd ${VM.app} && node node_modules/playwright-core/cli.js install-deps chromium >/dev/null && echo deps ok`, { sudo: true }), 'chromium deps'));
      await phase('chromium', async () => must(await sh(sbx, `export PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 && cd ${VM.app} && node node_modules/playwright-core/cli.js install chromium >/dev/null && ln -sf "$(PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 node -e "console.log(require('playwright-core').chromium.executablePath())")" ${VM.chrome} && ${VM.chrome} --headless=new --no-sandbox --dump-dom about:blank >/dev/null 2>&1; echo chrome-exit $?`, { sudo: false }), 'chromium'));
      // the platform's own dependency (three.js: build_zip.mjs's dollhouse) — the build proof's package step fell on its absence
      await phase('platform-npm', async () => must(await sh(sbx, `cd ${VM.hw}/Habait/platform && npm install --omit=dev --no-audit --no-fund --silent && ls node_modules/three/examples/jsm/loaders/GLTFLoader.js`), 'platform npm'));
      await phase('blender-smoke', async () => must(await sh(sbx, `${VM.blender} -b --factory-startup --version | head -1 && ls ${VM.hw}/360walkaround/catalog | head -3`), 'blender smoke'));
    }
    await phase('smoke', async () => must(await sh(sbx, `cd ${VM.hw} && HABAIT_APP_DIR=${VM.app} HABAIT_PY=${VM.py} node Habait/tour360/tools/auto-trace.mjs 2>&1 | head -3; ${VM.py} -c "import sys; sys.path.insert(0,'Habait/tour360/tools'); sys.path.insert(0,'Habait/engine/intake'); import auto_pages, auto_split, auto_doors, trace_check, rasterize; print('trace modules import ok')"`), 'smoke'));
    const snap = await phase('snapshot', async () => sbx.snapshot());
    snapshotId = snap?.snapshotId || snap?.id || String(snap);
  } catch (e) {
    try { await sbx.stop(); } catch { /* gone */ }
    throw e;
  }
  const rec = { schema: 'habait-studio/worker-snapshot.v1', snapshotId, key, head, listHash, files: files.length, bytes, withBlender, chrome: withBlender ? VM.chrome : null, pip: PIP, blender: withBlender ? BLENDER.version : null, built: now(), seconds: Number(((Date.now() - t0) / 1000).toFixed(1)), phases, vcpus };
  fs.writeFileSync(path.join(evid, 'snapshot.json'), `${JSON.stringify(rec, null, 2)}\n`);
  await store.writeJson(SNAPSHOT_PATH, rec);
  say(`snapshot ${snapshotId} written to ${SNAPSHOT_PATH} and ${path.relative(HERE, evid)}/snapshot.json (${rec.seconds} s)`);
}

// ───────────────────────────── refresh-snapshot: a CODE release in about a minute — boot from the current snapshot, re-upload the code
// (the same file set minus the 294 MB of render assets), snapshot again, point studio/worker/snapshot.json at it
async function refreshSnapshot() {
  const store = await openStore();
  const cur = await store.readJson(SNAPSHOT_PATH);
  if (!cur?.snapshotId) throw new Error('no current snapshot to refresh (build-snapshot first)');
  const files = fileSet({ withBlender: cur.withBlender, codeOnly: true });
  const bytes = files.reduce((a, f) => a + f.bytes, 0);
  let head = 'unknown'; try { head = execSync('git rev-parse --short HEAD', { cwd: HW, encoding: 'utf8' }).trim(); } catch { /* no git */ }
  say(`refresh ${cur.snapshotId} with ${files.length} code files · ${(bytes / 1e6).toFixed(1)} MB at ${head}`);
  if (!GO) { console.log('DRY-RUN — add --go'); return; }
  const t0 = Date.now();
  const sbx = await Sandbox.create({ source: { type: 'snapshot', snapshotId: cur.snapshotId }, resources: { vcpus: 2 }, timeout: 15 * 60000, persistent: false, tags: { role: 'snapshot-refresh' } });
  try {
    const dirs = [...new Set(files.map((f) => path.posix.dirname(`${VM.hw}/${f.rel}`)))];
    for (let i = 0; i < dirs.length; i += 200) must(await sh(sbx, `mkdir -p ${dirs.slice(i, i + 200).map((d) => `'${d}'`).join(' ')}`), 'mkdir');
    let batch = [], size = 0; const flush = async () => { if (!batch.length) return; await sbx.writeFiles(batch); batch = []; size = 0; };
    for (const f of files) { batch.push({ path: `${VM.hw}/${f.rel}`, content: fs.readFileSync(f.src) }); size += f.bytes; if (size > 24e6) await flush(); }
    await flush();
    must(await sh(sbx, `cd ${VM.hw} && node --check Habait/tour360/tools/run-job.mjs && node --check Habait/tour360/tools/run-project.mjs && echo code ok`), 'smoke');
  } catch (e) { try { await sbx.stop(); } catch { /* gone */ } throw e; }
  const snap = await sbx.snapshot();
  const rec = { ...cur, snapshotId: snap?.snapshotId || snap?.id || String(snap), refreshed_from: cur.snapshotId, head, code_files: files.length, refreshed: now(), refresh_seconds: Number(((Date.now() - t0) / 1000).toFixed(1)) };
  await store.writeJson(SNAPSHOT_PATH, rec);
  const evid = path.join(HERE, 'evidence', `${now().slice(0, 10)}-snapshot`); fs.mkdirSync(evid, { recursive: true });
  fs.writeFileSync(path.join(evid, 'snapshot-refresh.json'), `${JSON.stringify(rec, null, 2)}
`);
  say(`snapshot ${rec.snapshotId} (refreshed in ${rec.refresh_seconds} s) written to ${SNAPSHOT_PATH}`);
}

// ───────────────────────────── dispatch / status / vm-log / test-job
// a job by id: its address studio/jobs/<id>.json, else its queue pointer — ONE read (was a list() of studio/u/ + a read of every
// job.json, every status poll: part of what suspended the store on 2026-11-05). No list() fallback here: run-job --show indexes old jobs.
async function findJob(store, id) {
  for (const p of [`studio/jobs/${id}.json`, `studio/queue/${id}.json`]) {
    const ix = await store.readJson(p);
    if (ix?.jobPath) { const j = await store.readJson(ix.jobPath); if (j?.id === id) return { job: j, pathname: ix.jobPath }; }
  }
  throw new Error(`no job ${id} (no studio/jobs/ address — run-job --show ${id} indexes an old job once)`);
}
async function cmdDispatch() {
  const store = await openStore();
  const { job, pathname } = await findJob(store, argv[1]);
  const stage = opt('--stage') || (await import('../../../studio-web/api/_dispatch.mjs')).stageOf(job);
  if (job.state !== 'queued') throw new Error(`job ${job.id} is '${job.state}', not queued`);
  const flags = [...(opt('--flags') || '').split(',').filter(Boolean), ...(has('--no-paid') ? ['--no-paid'] : [])];
  const rec = await dispatch(job, pathname, { stage, store, Sandbox, log: logLine, timeoutMin: opt('--timeout-min'), flags });
  console.log(JSON.stringify(rec, null, 1));
}
// test-build-job: a project whose trace is ALREADY approved (the build stage's proof) — the plan, its crop and the spec from disk;
// dispatched as a build (a persistent sandbox). --flags --no-paid when fal is unavailable (no skin, no rings).
async function cmdTestBuildJob() {
  const plan = opt('--plan'); const crop = opt('--crop'); const spec = opt('--spec');
  if (!plan || !crop || !spec) throw new Error('--plan <plan.general.json> --crop <plan-crop.png> --spec <spec.json> required');
  const uid = opt('--uid', 'forke-test'); const pid = opt('--pid', `pb${Date.now().toString(36)}`);
  const base = `studio/u/${uid}/p/${pid}/`;
  const id = `jb${Date.now().toString(36)}`;
  const at = now();
  const job = {
    schema: 'habait-studio/job.v1', id, project: pid, owner: uid, name: `sandbox-worker build test ${pid}`, state: 'queued', stage: 'queued', percent: 20, created: at, updated: at,
    inputs: { prefix: base, spec: `${base}spec.json`, files: [], pages: `${base}files/.pages/`, trace: 'trace/plan.json' },
    consent: { version: 'test', text: 'fork E build-stage test job', at, by: uid, accepted: true }, needs: null,
    approvals: { spec: { state: 'done', at }, trace: { at, by: uid, trace: 'trace/plan.json', note: 'the hand plan of apt846-auto (fork F proof apartment) — a test, not a developer approval' } },
    corrections: [], result: null, links: [], log: [], error: null,
  };
  logLine(job, 'בדיקת שלב הבנייה בשרת: שרטוט מאושר (תכנית היד של apt846-auto)');
  say(`test build job ${id} · project ${pid} · ${base}`);
  if (!GO) { console.log('DRY-RUN — add --go to write the project to the store and dispatch its build'); return; }
  const store = await openStore();
  await store.putFile(`${base}trace/plan.json`, plan);
  await store.putFile(`${base}trace/crop.png`, crop);
  await store.writeJson(`${base}spec.json`, JSON.parse(fs.readFileSync(spec, 'utf8')));
  await store.writeJson(`${base}meta.json`, { id: pid, name: job.name, created: at, steps: { upload: { state: 'done' }, read: { state: 'done' }, approve: { state: 'done', at }, build: { state: 'running', at, job: id }, trace: { state: 'done', at } } });
  await store.writeJson(`${base}job.json`, job);
  await store.writeJson(`studio/queue/${id}.json`, { schema: 'habait-studio/queue.v1', job: id, uid, pid, jobPath: `${base}job.json`, at });
  await store.writeJson(`studio/jobs/${id}.json`, { schema: 'habait-studio/job-index.v1', job: id, uid, pid, jobPath: `${base}job.json` });
  const flags = [...(opt('--flags') || '').split(',').filter(Boolean), ...(has('--no-paid') ? ['--no-paid'] : [])];
  const rec = await dispatch(job, `${base}job.json`, { stage: 'build', store, Sandbox, log: logLine, timeoutMin: opt('--timeout-min'), flags });
  console.log(JSON.stringify({ job: id, project: pid, sandbox: rec }, null, 1));
}
// vm-run <jobId> [--cap <min>] -- <bash>: one command in the job's sandbox (resumed if stopped), its output printed — the timing probes
async function cmdVmRun() {
  const store = await openStore();
  const { job } = await findJob(store, argv[1]);
  if (!job.sandbox?.name) throw new Error('no sandbox on the job');
  const sbx = await Sandbox.get({ name: job.sandbox.name, resume: false });
  if (opt('--cap')) await sbx.update({ timeout: Number(opt('--cap')) * 60000 });
  const script = argv.slice(argv.indexOf('--') + 1).join(' ');
  const t = Date.now();
  const c = await sbx.runCommand({ cmd: 'bash', args: ['-lc', script] });
  console.log(`exit ${c.exitCode} · ${((Date.now() - t) / 1000).toFixed(1)} s`);
  console.log((await c.stdout()).slice(-8000)); const e = await c.stderr(); if (e.trim()) console.log(`--- stderr
${e.slice(-3000)}`);
}
async function cmdStatus() {
  const store = await openStore();
  const { job } = await findJob(store, argv[1]);
  console.log(JSON.stringify({ id: job.id, project: job.project, state: job.state, stage: job.stage, percent: job.percent, needs: job.needs ? { type: job.needs.type, stage: job.needs.stage, verdict: job.needs.check?.verdict, summary: job.needs.check?.summary } : null,
    review: job.review ? { stage: job.review.stage, mismatches: job.review.mismatches?.length } : null, sandbox: job.sandbox || null, dispatches: job.dispatches || 0, heartbeat: job.heartbeat, executor: job.executor, error: job.error, log: (job.log || []).slice(-8).map((l) => (typeof l === 'string' ? l : `${String(l?.at || '').slice(11, 19)} ${l?.line ?? ''}`)) }, null, 1));
}
async function cmdVmLog() {
  const store = await openStore();
  const { job } = await findJob(store, argv[1]);
  if (!job.sandbox?.name) throw new Error('no sandbox on the job');
  const sbx = await Sandbox.get({ name: job.sandbox.name });
  const buf = await sbx.readFileToBuffer({ path: argv[2] || VM.log });   // vm-log <jobId> [absolute path in the VM]
  console.log(buf ? buf.toString('utf8').slice(-6000) : '(no job.log yet)');
}
async function cmdTestJob() {
  const pdf = opt('--pdf'); const spec = opt('--spec');
  if (!pdf || !spec) throw new Error('--pdf <file> --spec <spec.json> required');
  const uid = opt('--uid', 'forke-test'); const pid = opt('--pid', `pt${Date.now().toString(36)}`);
  const base = `studio/u/${uid}/p/${pid}/`;
  const id = `jt${Date.now().toString(36)}`;
  const job = {
    schema: 'habait-studio/job.v1', id, project: pid, owner: uid, name: `sandbox-worker test ${pid}`, state: 'queued', stage: 'queued', percent: 0, created: now(), updated: now(),
    inputs: { prefix: base, spec: `${base}spec.json`, files: [`${base}files/${path.basename(pdf)}`, ...(opt('--vlm') ? [`${base}files/saved-reading.vlm.json`] : [])], pages: `${base}files/.pages/`, trace: null },
    ...(has('--no-paid') ? { no_paid: true } : {}),   // a $0 test project: run-job makes no paid call in any stage
    consent: { version: 'test', text: 'fork E test job', at: now(), by: uid, accepted: true }, needs: null, approvals: { spec: { state: 'done', at: now() }, trace: null }, corrections: [], result: null, links: [], log: [], error: null,
  };
  logLine(job, 'נכנס לתור הבנייה (בדיקת שרת העבודות)');
  say(`test job ${id} · project ${pid} · ${base}`);
  if (!GO) { console.log('DRY-RUN — add --go to write the project to the store and dispatch its trace'); return; }
  const store = await openStore();
  await store.putFile(`${base}files/${path.basename(pdf)}`, pdf);
  // --vlm <file> (2026-11-06): a saved reading for a $0 trace (run-job --no-paid passes it to auto-trace --vlm-file)
  if (opt('--vlm')) await store.putFile(`${base}files/saved-reading.vlm.json`, opt('--vlm'));
  await store.writeJson(`${base}spec.json`, JSON.parse(fs.readFileSync(spec, 'utf8')));
  await store.writeJson(`${base}meta.json`, { id: pid, name: job.name, created: now(), steps: { upload: { state: 'done' }, read: { state: 'done' }, approve: { state: 'done', at: now() }, build: { state: 'running', at: now(), job: id } } });
  await store.writeJson(`${base}job.json`, job);
  await store.writeJson(`studio/queue/${id}.json`, { schema: 'habait-studio/queue.v1', job: id, uid, pid, jobPath: `${base}job.json`, at: now() });
  await store.writeJson(`studio/jobs/${id}.json`, { schema: 'habait-studio/job-index.v1', job: id, uid, pid, jobPath: `${base}job.json` });
  const rec = await dispatch(job, `${base}job.json`, { stage: 'trace', store, Sandbox, log: logLine, timeoutMin: opt('--timeout-min'), flags: [...(opt('--flags') || '').split(',').filter(Boolean), ...(has('--no-paid') ? ['--no-paid'] : [])] });   // --no-paid as its own word (opt() skips a value that starts with --)
  console.log(JSON.stringify({ job: id, project: pid, sandbox: rec }, null, 1));
}

try {
  if (cmd === 'build-snapshot') await buildSnapshot();
  else if (cmd === 'refresh-snapshot') await refreshSnapshot();
  else if (cmd === 'dispatch') await cmdDispatch();
  else if (cmd === 'status') await cmdStatus();
  else if (cmd === 'vm-log') await cmdVmLog();
  else if (cmd === 'test-job') await cmdTestJob();
  else if (cmd === 'test-build-job') await cmdTestBuildJob();
  else if (cmd === 'vm-run') await cmdVmRun();
  else if (cmd === 'stop') { const store = await openStore(); for (const id of argv.slice(1)) { const { job, pathname } = await findJob(store, id); console.log(id, (await stopFinished(job, pathname, { store, Sandbox })) ? 'stop sent' : `nothing to stop (${job.state}${job.sandbox?.stopped ? ', already stopped' : ''})`); } }   // stop <jobId…>: a finished job's idle VM
  else { console.error('usage: worker.mjs build-snapshot|dispatch|status|vm-log|test-job … (see the header)'); process.exit(2); }
} catch (e) { console.error(`worker: ${String(e?.message || e).replace(/vercel_blob_rw_[A-Za-z0-9_]+|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_.-]+|sb_secret_[A-Za-z0-9_-]+/g, '[token]').slice(0, 800)}`); process.exit(1); }
