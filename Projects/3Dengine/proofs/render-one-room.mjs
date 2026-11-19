#!/usr/bin/env node
// PROOF (milestone 2.1, task 01): the EXISTING build and render chain, unchanged, renders ONE room of a plan inside
// the engine home. It is a proof by hand, kept as a script (root CLAUDE.md §3, §5): nothing here is the engine's
// stage, and this folder is not under the coverage bar of engine/** (a proof that starts Blender cannot be a unit
// test). The stage is written after the contract, on what this proof measures.
//
//   node proofs/render-one-room.mjs --phase <phase> [--id proof21a] [--point cp-living] [--junctions] [--go]
//
//   plan      the reading tool on the golden 846 PDF from the kept fixture reading ($0) -> <work>/trace/plan-1/
//   build     run-project.mjs --steps apartment,casework,cameras,furnish (the whole apartment's scene data)
//   render    run-project.mjs --steps render --render-points <point>   (ONE point; Blender, under the tools' lock)
//   record    <work>/record-<name>.json: every file the tools wrote, its bytes and sha256 (--name a)
//   compare   two records, file by file (--a <file> --b <file>)
//   pixels    two pictures, pixel by pixel (--a <file> --b <file>)
//   clean     removes what this proof put into the pipeline tree for its id (the three names), and nothing else;
//             with --wipe also the work folders behind the junctions (the plan in <work>/trace stays)
//   render takes --res WxH and --samples N (the chain's defaults: 2048x1024, 32)
//
// DRY-RUN unless --go: it prints the folders it would write and the command it would start, and writes nothing.
// The tools write at fixed places INSIDE the pipeline tree: apartments/<id>, tours/<id>, out/<id>. With --junctions
// those three names are directory junctions into <work>, so the files live in <work> (question 4 of the task).
// FREE: the tool gets a fixed word in place of a key and an env root with no keys file; no key name is passed on.
// Nothing of the drawing's text is printed: the tools' output goes to <work>/<phase>.log.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { loadConfig, pipelineEnv, ENGINE_HOME } from '../engine/config.mjs';
import { runTrace, killTree, FREE_RUN_WORD, FREE_RUN_NAME } from '../engine/trace.mjs';
import { sha256FileSync } from '../engine/lib/hash.mjs';
import { pidAlive } from '../engine/lib/proc.mjs';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name, dflt = null) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt;
};
const fwd = (p) => String(p).replace(/\\/g, '/');
const GO = flag('--go');
const PHASE = opt('--phase', 'help');
const ID = opt('--id', 'proof21a');
const POINT = opt('--point', 'cp-living');
if (!/^proof21[a-z0-9]{0,12}$/.test(ID)) {
  console.error('the id of a proof run is proof21<letters or digits>: it names folders this script may remove');
  process.exit(2);
}
if (!/^cp-[A-Za-z0-9]{1,40}$/.test(POINT)) {
  console.error('a render point is cp-<name>');
  process.exit(2);
}

const config = loadConfig();
const PIPE = fwd(config.pipelineRoot);
const WORK = fwd(opt('--work', `${fwd(config.runtimeDir)}/proofs/2.1/${ID}`));
const TOOL = `${PIPE}/Habait/tour360/tools/run-project.mjs`;
// the three places the tools write, by their own fixed layout
const PLACES = {
  apartment: `${PIPE}/Habait/tour360/apartments/${ID}`,
  tour: `${PIPE}/360walkaround/tours/${ID}`,
  out: `${PIPE}/Habait/tour360/out/${ID}`,
};
const FIXTURES = `${fwd(ENGINE_HOME)}/tests/fixtures/apt846`;
const PLAN_DIR = `${WORK}/trace/plan-1`;

const say = (line) => process.stdout.write(`${line}\n`);

function isJunction(p) {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

function listAll(root) {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) out.push(p);
    }
  };
  if (fs.existsSync(root)) walk(root);
  return out.sort();
}

// Start a tool, its output into a log; stop the whole tree at the time limit. → { code, seconds, timedOut }
function start(cmd, args, { env, cwd, logFile, timeoutMs }) {
  return new Promise((resolve) => {
    const fd = fs.openSync(logFile, 'w');
    const t0 = Date.now();
    const child = spawn(cmd, args, { env, cwd, stdio: ['ignore', fd, fd], windowsHide: true });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child.pid);
    }, timeoutMs);
    child.on('exit', (code) => {
      clearTimeout(timer);
      fs.closeSync(fd);
      resolve({ code, seconds: Math.round((Date.now() - t0) / 100) / 10, timedOut, pid: child.pid });
    });
  });
}

function toolEnv() {
  const noKeys = `${WORK}/no-keys`;
  fs.mkdirSync(noKeys, { recursive: true });
  const env = { ...process.env, ...pipelineEnv(config), HABAIT_ENV_ROOT: noKeys, PYTHONIOENCODING: 'utf-8' };
  for (const name of config.keys || []) delete env[name];
  env[FREE_RUN_NAME] = FREE_RUN_WORD;
  return env;
}

// The tools' own lock: a file. This proof only LOOKS at it, and removes it in one case: it names a pid this
// script started and that is dead (a run this script stopped at its time limit).
function lockLine() {
  try {
    const j = JSON.parse(fs.readFileSync(config.blenderLock, 'utf8'));
    return `held: owner ${String(j.owner).slice(0, 40)}, pid ${j.pid} (${pidAlive(j.pid) ? 'alive' : 'DEAD'})`;
  } catch (e) {
    return e.code === 'ENOENT' ? 'free' : `unreadable (${e.code || 'not JSON'})`;
  }
}
function removeOwnDeadLock(pid) {
  try {
    const j = JSON.parse(fs.readFileSync(config.blenderLock, 'utf8'));
    if (j.pid === pid && !pidAlive(pid)) {
      fs.unlinkSync(config.blenderLock);
      say(`the Blender lock named the run this script stopped (pid ${pid}, dead): removed`);
    }
  } catch { /* free, or another holder's: not touched */ }
}

async function runTool(steps, extra, timeoutMs) {
  const args = [TOOL, ID, '--plan', `${PLAN_DIR}/plan.general.json`, '--crop', `${PLAN_DIR}/crop.png`, '--steps', steps, ...extra];
  say(`command: node run-project.mjs ${ID} --plan <work>/trace/plan-1/plan.general.json --crop <work>/trace/plan-1/crop.png --steps ${steps} ${extra.join(' ')}`);
  say(`writes : ${Object.values(PLACES).join(' · ')}${flag('--junctions') ? '  (junctions into <work>)' : ''}`);
  say(`log    : ${WORK}/${PHASE}.log`);
  say(`Blender lock before: ${lockLine()}`);
  if (!GO) return say('dry run: nothing started (add --go)');
  for (const f of ['plan.general.json', 'crop.png']) {
    if (!fs.existsSync(`${PLAN_DIR}/${f}`)) throw new Error(`no ${f} in <work>/trace/plan-1: run --phase plan first`);
  }
  if (flag('--junctions')) {
    for (const [name, link] of Object.entries(PLACES)) {
      if (fs.existsSync(link)) continue;
      fs.mkdirSync(`${WORK}/${name}`, { recursive: true });
      fs.mkdirSync(path.dirname(link), { recursive: true });
      fs.symlinkSync(`${WORK}/${name}`, link, 'junction');
    }
  }
  const r = await start(process.execPath, args, { env: toolEnv(), cwd: PIPE, logFile: `${WORK}/${PHASE}.log`, timeoutMs });
  if (r.timedOut) removeOwnDeadLock(r.pid);
  say(`exit ${r.code}${r.timedOut ? ' (STOPPED at the time limit)' : ''} in ${r.seconds} s`);
  say(`Blender lock after : ${lockLine()}`);
  try {
    const pkg = JSON.parse(fs.readFileSync(`${PLACES.out}/package/package.json`, 'utf8'));
    for (const [step, row] of Object.entries(pkg.steps || {})) say(`  step ${step}: ${row.ok === false ? 'FAILED' : 'ok'}${row.seconds !== undefined ? `, ${row.seconds} s` : ''}`);
  } catch { /* the tool's own step table is not there */ }
  process.exitCode = r.code === 0 ? 0 : 1;
}

async function main() {
  if (GO) fs.mkdirSync(WORK, { recursive: true });
  if (PHASE === 'plan') {
    say(`reading tool, from the kept fixture reading ($0) -> ${WORK}/trace`);
    if (!GO) return say('dry run: nothing started (add --go)');
    fs.rmSync(`${WORK}/trace`, { recursive: true, force: true });
    const t0 = Date.now();
    const r = await runTrace(config, { pdf: `${FIXTURES}/source.pdf`, outDir: `${WORK}/trace`, id: ID, vlmFile: `${FIXTURES}/saved-reading.json`, traceDate: '2026-11-06', judge: false });
    say(`outcome ${r.outcome}, paid ${r.paid}, ${Math.round((Date.now() - t0) / 1000)} s; rooms ${r.result?.plans?.[0]?.rooms ?? '?'}`);
    for (const f of ['plan.general.json', 'crop.png', 'pdf-vectors.json']) {
      const p = `${PLAN_DIR}/${f}`;
      say(`  ${f}: ${fs.existsSync(p) ? `${fs.statSync(p).size} bytes, sha256 ${sha256FileSync(p).slice(0, 16)}` : 'NOT WRITTEN'}`);
    }
    process.exitCode = r.outcome === 'PASS' ? 0 : 1;
    return;
  }
  if (PHASE === 'build') return runTool('apartment,casework,cameras,furnish', [], 500000);
  if (PHASE === 'render') {
    const extra = ['--render-points', POINT];
    if (/^\d{2,5}x\d{2,5}$/.test(opt('--res', ''))) extra.push('--res', opt('--res'));           // the chain's default: 2048x1024
    if (/^\d{1,4}$/.test(opt('--samples', ''))) extra.push('--samples', opt('--samples'));        // the chain's default: 32
    return runTool('render', extra, 520000);
  }
  if (PHASE === 'record') {
    const name = opt('--name', 'a');
    const rows = [];
    for (const [place, root] of [...Object.entries(PLACES), ['trace', PLAN_DIR]]) {
      for (const f of listAll(root)) rows.push({ place, file: f.slice(root.length + 1), bytes: fs.statSync(f).size, sha256: sha256FileSync(f) });
    }
    const side = `${PLACES.tour}/renders/${POINT}/pano.render.json`;
    let render = null;
    if (fs.existsSync(side)) {
      const j = JSON.parse(fs.readFileSync(side, 'utf8'));
      render = { backend: j.render?.backend, samples: j.render?.samples, seed: j.render?.seed, timings_s: j.timings_s, depth_packed_sha256: j.depth_stats?.packed_data_sha256, input_key: j.input_key };
    }
    const rec = { id: ID, point: POINT, junctions: Object.values(PLACES).map(isJunction), files: rows.length, rows, render };
    say(`${rows.length} files; junctions: ${rec.junctions.join(', ')}; render: ${render ? `${render.backend}, ${render.samples} spp, ${render.timings_s?.render_wall_clock ?? '?'} s` : 'none'}`);
    if (!GO) return say('dry run: nothing written (add --go)');
    fs.writeFileSync(`${WORK}/record-${name}.json`, `${JSON.stringify(rec, null, 1)}\n`);
    return say(`written: ${WORK}/record-${name}.json`);
  }
  if (PHASE === 'compare') {
    const a = JSON.parse(fs.readFileSync(opt('--a'), 'utf8'));
    const b = JSON.parse(fs.readFileSync(opt('--b'), 'utf8'));
    const key = (r) => `${r.place}/${r.file}`;
    const bm = new Map(b.rows.map((r) => [key(r), r]));
    const same = [];
    const diff = [];
    const only = [];
    for (const r of a.rows) {
      const o = bm.get(key(r));
      if (!o) only.push(`only in a: ${key(r)}`);
      else (o.sha256 === r.sha256 ? same : diff).push(`${key(r)}${o.sha256 === r.sha256 ? '' : `  (${r.bytes} / ${o.bytes} bytes)`}`);
      bm.delete(key(r));
    }
    for (const k of bm.keys()) only.push(`only in b: ${k}`);
    say(`the SAME bytes in both runs: ${same.length}`);
    for (const s of same) say(`  = ${s}`);
    say(`DIFFERENT bytes: ${diff.length}`);
    for (const s of diff) say(`  x ${s}`);
    say(`in one run only: ${only.length}`);
    for (const s of only) say(`  ? ${s}`);
    say(`depth, packed pixels: ${a.render?.depth_packed_sha256 === b.render?.depth_packed_sha256 ? 'the same' : 'DIFFERENT'} · input key: ${a.render?.input_key === b.render?.input_key ? 'the same' : 'DIFFERENT'}`);
    return;
  }
  if (PHASE === 'pixels') {
    const sharp = createRequire(`${fwd(config.appDepsDir)}/`)('sharp');
    const raw = async (f) => sharp(f).raw().toBuffer({ resolveWithObject: true });
    const [a, b] = [await raw(opt('--a')), await raw(opt('--b'))];
    if (a.info.width !== b.info.width || a.info.height !== b.info.height || a.info.channels !== b.info.channels) return say('the two pictures have different sizes');
    let differ = 0;
    let max = 0;
    let sum = 0;
    const hist = [0, 0, 0, 0];           // 1, 2, 3 to 4, 5 and more
    for (let i = 0; i < a.data.length; i++) {
      const d = Math.abs(a.data[i] - b.data[i]);
      if (d) {
        differ += 1;
        sum += d;
        if (d > max) max = d;
        hist[d === 1 ? 0 : d === 2 ? 1 : d <= 4 ? 2 : 3] += 1;
      }
    }
    say(`${a.info.width}x${a.info.height}, ${a.info.channels} channels: ${differ} of ${a.data.length} values differ (${(100 * differ / a.data.length).toFixed(4)} %); largest difference ${max} of 255; mean of all ${(sum / a.data.length).toFixed(5)}`);
    return say(`  by 1: ${hist[0]} · by 2: ${hist[1]} · by 3 or 4: ${hist[2]} · by 5 or more: ${hist[3]}`);
  }
  if (PHASE === 'clean') {
    for (const [name, link] of Object.entries(PLACES)) {
      const what = !fs.existsSync(link) && !isJunction(link) ? 'not there' : isJunction(link) ? 'a junction: the link is removed, its target stays' : 'a folder: removed with what is in it';
      say(`${name}: ${link}: ${what}`);
      if (!GO || what === 'not there') continue;
      if (isJunction(link)) fs.rmdirSync(link);
      else fs.rmSync(link, { recursive: true, force: true });
    }
    if (flag('--wipe')) {
      for (const name of Object.keys(PLACES)) {
        say(`${name}: ${WORK}/${name}: the work folder behind the junction${GO ? ', removed' : ''}`);
        if (GO) fs.rmSync(`${WORK}/${name}`, { recursive: true, force: true });
      }
    }
    return say(GO ? 'cleaned' : 'dry run: nothing removed (add --go)');
  }
  say('phases: plan, build, render, record, compare, pixels, clean (see the head of this file); dry-run unless --go');
}

main().catch((e) => {
  console.error(`proof failed: ${e.code || ''} ${String(e.message).slice(0, 300)}`);
  process.exit(1);
});
