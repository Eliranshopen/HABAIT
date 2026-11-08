#!/usr/bin/env node
/* Habait Tour360 — tools/sandbox-worker/build-proof.mjs: the BUILD stage of the project runner in Vercel Sandbox, proved WITHOUT the
   Blob store (fork E, 2026-11-05: the store `habait-studio` was suspended on Hobby's operations quota mid-proof, so the job state
   lives on the sandbox's own persistent disk here, and the session chunking is shown by a deliberately short first session).

     node build-proof.mjs start  --snapshot <id> --plan <plan.general.json> --crop <png> --spec <spec.json> [--cap 20] [--go]
     node build-proof.mjs resume [--cap 44]          the next session: the same sandbox, its disk as it was; phases already done are skipped
     node build-proof.mjs status                     the phase table + the tail of the run log (resumes nothing: reads while it runs)
     node build-proof.mjs fetch                      copy the evidence out (timings, /usr/bin/time, memory, logs, the package summary, qa shots)
     node build-proof.mjs delete                     stop and delete the sandbox (its snapshot storage goes with it)

   Phases (each writes <phase>.done when it exits 0, so a resumed session continues where the last one stopped):
     chrome      Chromium for the qa step if the snapshot lacks it (playwright-core install + its system libs)
     prep        run-project apartment,cameras,prompts,furnish on the approved trace (the hand plan of apt846-auto)
     render2048  render_tour at 2048x1024 @ 16 spp on the first --n2048 points (the per-point time at the full resolution)
     renderRest  render_tour at 1024x512 @ 16 spp on the other points (Hobby: a full 2048 apartment ≈ 4 active CPU-hours of the 5 a month)
     gate        run-project gate: the CG set against the plan, METRIC, $0 (fidelity-gate --cg-only) — its verdict is recorded, not forced
     ship        run-project build,package,qa (no skin, no markers: fal is locked — recorded "skipped: fal locked")
   Run as `vercel env run -e preview -- node build-proof.mjs …` from the linked stage folder (the SDK's OIDC token). No secret enters the
   VM: the build needs none (no fal, no Blob). */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const GO = argv.includes('--go');
const EVID = path.join(HERE, 'evidence', '2026-11-05-build');
const STATE = path.join(EVID, 'proof-state.json');
const say = (s) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${s}`);
const { Sandbox } = await import(pathToFileURL(createRequire(path.join(HERE, 'package.json')).resolve('@vercel/sandbox')).href);
fs.mkdirSync(EVID, { recursive: true });
const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {};
const saveState = () => fs.writeFileSync(STATE, `${JSON.stringify(state, null, 1)}\n`);

const R = '/vercel/sandbox', P = `${R}/proof`, ID = 'pbuild846';
const ENV = {
  HABAIT_PY: `${R}/venv/bin/python`, HABAIT_APP_DIR: `${R}/appdeps`, HABAIT_ENV_ROOT: `${R}/hw`, BLENDER: `${R}/blender/blender`, CHROME: `${R}/chrome`,
  PYTHONIOENCODING: 'utf-8', TOUR_EDIT_OPEN: '0', HABAIT_LEGAL_DIR: `${R}/hw/_data/legal`,
};
const SCRIPT = String.raw`#!/bin/bash
# the build-stage proof, one session; every phase is skipped when its .done marker exists (a resumed session continues)
set -u
R=/vercel/sandbox; P=$R/proof; ID=${ID}; N2048=$(cat $P/n2048 2>/dev/null || echo 3)
mkdir -p $P; cd $R/hw
export HABAIT_BLENDER_LOCK=/tmp/blender-$(date +%s).lock
echo "=== session $(date -u +%FT%TZ) nproc=$(nproc) mem=$(free -m | awk '/Mem:/{print $2}')MB" >> $P/run.log
( while true; do echo "$(date +%s) $(free -m | awk '/Mem:/{print $3}') $(cut -d' ' -f1 /proc/loadavg)" >> $P/mem.log; sleep 5; done ) &
MEMPID=$!
phase() {
  local name=$1; shift
  if [ -f $P/$name.done ]; then echo "skip $name (done)" >> $P/run.log; return 0; fi
  local s=$(date +%s); echo "--- $name start $(date -u +%T)" >> $P/run.log
  "$@" >> $P/$name.log 2>&1; local rc=$?
  local e=$(date +%s); printf '%s\t%s\t%s\t%s\n' "$name" "$((e-s))" "$rc" "$(date -u +%FT%TZ)" >> $P/timings.tsv
  echo "--- $name exit $rc in $((e-s)) s" >> $P/run.log
  [ $rc -eq 0 ] && touch $P/$name.done
  return $rc
}
chrome_install() {
  if [ -x "$CHROME" ] && "$CHROME" --headless=new --no-sandbox --dump-dom about:blank >/dev/null 2>&1; then echo "chrome ok (snapshot)"; return 0; fi
  export PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64   # Playwright 1.56 refuses Ubuntu 26.04; its 24.04 build runs here
  cd $R/appdeps && sudo env PATH=$PATH PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 node node_modules/playwright-core/cli.js install-deps chromium && node node_modules/playwright-core/cli.js install chromium \
    && ln -sf "$(node -e "console.log(require('playwright-core').chromium.executablePath())")" $CHROME && "$CHROME" --headless=new --no-sandbox --dump-dom about:blank >/dev/null && echo "chrome installed"
  local rc=$?; cd $R/hw; return $rc
}
points() { node -e "const c=require('$R/hw/Habait/tour360/apartments/$ID/cameras.json'); const ids=(c.scenes||[]).map(s=>'cp-'+s.id); console.log(process.argv[1]==='head'?ids.slice(0,$N2048).join(','):ids.slice($N2048).join(','))" "$1"; }
phase chrome chrome_install || echo "chrome failed: qa will fail" >> $P/run.log
phase prep node Habait/tour360/tools/run-project.mjs $ID --plan $R/in/plan.json --crop $R/in/crop.png --spec $R/in/spec.json --steps apartment,cameras,prompts,furnish || { echo "prep failed" >> $P/run.log; kill $MEMPID; exit 1; }
phase render2048 /usr/bin/time -v -o $P/time-render2048.txt node 360walkaround/pipeline/render_tour.mjs 360walkaround/tours/$ID --mode draft --res 2048x1024 --samples 16 --points "$(points head)" --no-top-view --blender $BLENDER || { kill $MEMPID; exit 1; }
phase renderRest /usr/bin/time -v -o $P/time-renderRest.txt node 360walkaround/pipeline/render_tour.mjs 360walkaround/tours/$ID --mode draft --res 1024x512 --samples 16 --points "$(points tail)" --no-top-view --blender $BLENDER || { kill $MEMPID; exit 1; }
phase scenes node Habait/tour360/tools/run-project.mjs $ID --steps scenes,sets || { kill $MEMPID; exit 1; }
phase gate node Habait/tour360/tools/run-project.mjs $ID --steps gate
phase ship node Habait/tour360/tools/run-project.mjs $ID --steps build,package,qa
echo "=== ALL PHASES RUN $(date -u +%FT%TZ)" >> $P/run.log
kill $MEMPID
`;

async function sh(sbx, script, opts = {}) { const c = await sbx.runCommand({ cmd: 'bash', args: ['-lc', script], env: ENV, ...opts }); return { code: c.exitCode, out: await c.stdout(), err: await c.stderr() }; }
async function get() { if (!state.name) throw new Error('no proof sandbox yet (start)'); return Sandbox.get({ name: state.name, resume: false }); }

if (cmd === 'start') {
  const snap = opt('--snapshot'); const plan = opt('--plan'); const crop = opt('--crop'); const spec = opt('--spec'); const cap = Number(opt('--cap', '20'));
  if (!snap || !plan || !crop || !spec) throw new Error('--snapshot --plan --crop --spec required');
  say(`start: snapshot ${snap}, session 1 capped at ${cap} min (4 vCPU / 8 GB, persistent)`);
  if (!GO) { console.log('DRY-RUN — add --go'); process.exit(0); }
  const name = `proof-build-${Date.now().toString(36)}`;
  const sbx = await Sandbox.create({ name, source: { type: 'snapshot', snapshotId: snap }, resources: { vcpus: 4 }, timeout: cap * 60000, persistent: true, keepLastSnapshots: { count: 1 }, tags: { role: 'build-proof' } });
  Object.assign(state, { name, snapshot: snap, created: new Date().toISOString(), sessions: [{ n: 1, started: new Date().toISOString(), cap_min: cap }] }); saveState();
  await sbx.writeFiles([
    { path: `${R}/in/plan.json`, content: fs.readFileSync(plan) }, { path: `${R}/in/crop.png`, content: fs.readFileSync(crop) },
    { path: `${R}/in/spec.json`, content: fs.readFileSync(spec) }, { path: `${R}/proof.sh`, content: Buffer.from(SCRIPT), mode: 0o755 },
    { path: `${P}/n2048`, content: Buffer.from(opt('--n2048', '3')) },
  ]);
  await sbx.runCommand({ cmd: 'bash', args: ['-lc', `bash ${R}/proof.sh`], env: ENV, detached: true });
  say(`sandbox ${name} running proof.sh (detached)`);
} else if (cmd === 'resume') {
  const cap = Number(opt('--cap', '44'));
  const sbx = await get();
  await sbx.update({ timeout: cap * 60000 });
  state.sessions.push({ n: state.sessions.length + 1, started: new Date().toISOString(), cap_min: cap }); saveState();
  await sbx.runCommand({ cmd: 'bash', args: ['-lc', `bash ${R}/proof.sh`], env: ENV, detached: true });   // resumes the session, the disk as it was
  say(`session ${state.sessions.length} of ${state.name} started (cap ${cap} min)`);
} else if (cmd === 'status') {
  const sbx = await get();
  say(`sandbox ${state.name}: status ${sbx.status}`);
  if (sbx.status !== 'running') { console.log('(not running — `resume` boots the next session; `fetch` resumes to read)'); process.exit(0); }
  const r = await sh(sbx, `cat ${P}/timings.tsv 2>/dev/null; echo ---; tail -12 ${P}/run.log; echo ---; ls ${R}/hw/360walkaround/tours/${ID}/renders 2>/dev/null | tr '\\n' ' '; echo; for f in ${R}/hw/360walkaround/tours/${ID}/renders/cp-*/pano.webp; do [ -f "$f" ] && echo "$(stat -c %y "$f" | cut -c12-19) $(basename $(dirname $f))"; done | sort | tail -12`);
  console.log(r.out);
} else if (cmd === 'fetch') {
  const sbx = await get();
  const tar = await sh(sbx, `cd ${P} && cp -f ${R}/hw/Habait/tour360/out/${ID}/package/package.json ${P}/package.manifest.json 2>/dev/null; cp -f ${R}/hw/Habait/tour360/apartments/${ID}/_local/fidelity/gate.json ${P}/gate.json 2>/dev/null; cp -f ${R}/hw/360walkaround/tours/${ID}/renders/_render-tour.report.json ${P}/render-tour.report.json 2>/dev/null;
    mkdir -p ${P}/renders; for d in ${R}/hw/360walkaround/tours/${ID}/renders/cp-*; do n=$(basename $d); cp -f $d/pano.render.json ${P}/renders/$n.render.json 2>/dev/null; cp -f $d/pano.webp ${P}/renders/$n.webp 2>/dev/null; done;
    mkdir -p ${P}/qa; cp -f ${R}/hw/Habait/tour360/out/${ID}/qa/* ${P}/qa/ 2>/dev/null; du -sh ${R}/hw/Habait/tour360/out/${ID}/package 2>/dev/null > ${P}/package.size; find ${R}/hw/Habait/tour360/out/${ID}/package -type f 2>/dev/null | wc -l >> ${P}/package.size;
    tar -czf ${R}/proof.tgz -C ${R} proof && ls -la ${R}/proof.tgz`);
  console.log(tar.out.trim(), tar.err.slice(-300));
  const buf = await sbx.readFileToBuffer({ path: `${R}/proof.tgz` });
  if (!buf) throw new Error('no proof.tgz');
  fs.writeFileSync(path.join(EVID, 'proof.tgz'), buf);
  say(`proof.tgz (${(buf.length / 1e6).toFixed(1)} MB) → ${path.relative(HERE, EVID)}`);
} else if (cmd === 'delete') {
  const sbx = await get();
  try { await sbx.stop(); } catch { /* stopped */ }
  await sbx.delete(); state.deleted = new Date().toISOString(); saveState(); say(`deleted ${state.name}`);
} else { console.error('usage: build-proof.mjs start|resume|status|fetch|delete (see the header)'); process.exit(2); }
