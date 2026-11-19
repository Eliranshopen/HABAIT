#!/usr/bin/env node
/**
 * spike.mjs — can the project runner's Blender step run in Vercel Sandbox? (rnd-9d, 2026-11-04)
 *
 *   node spike.mjs                       # DRY-RUN (default): the file set, sizes, the cost cap — no network
 *   vercel env run -- node spike.mjs --go   # from a folder linked to habait-flow: boots ONE sandbox
 *
 * What --go does, timing every phase and sampling CPU (/proc/stat) and memory (free -m every 2 s):
 *   1. creates a sandbox (4 vCPU / 8 GB: the plan max, measured in attempt 1), persistent:false
 *   2. apt: the X/GL client libs Blender's Linux build links against, plus `time` and `xz-utils`
 *   3. Blender 4.5.10 LTS official Linux tarball (the laptop's exact version), sha256-verified
 *   4. Python venv: numpy, opencv-python-headless, pymupdf (the runner's other Python steps)
 *   5. uploads the code + apt846 inputs (no secret, no .env — the list is built by rule, below)
 *   6. runs 360walkaround/pipeline/render_tour.mjs on apt846 cp-kitchen at run-job's draft setting
 *      (1024x512 @ 16 spp, run-job.mjs --draft) — that is build_scene.py + render_pano.py
 *   7. downloads the pano, depth, sidecars, logs; stops the sandbox; verifies it is stopped
 *
 * Auth: the SDK reads VERCEL_OIDC_TOKEN from the process env (`vercel env run` injects it, no file).
 * ⛔ This script never forwards process.env into the sandbox, never logs an env value, writes no token.
 * Rails: root CLAUDE.md §5 (dry-run default, --go), §7 (RENDER-LEDGER.md §2 row C1 before boot).
 */
import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, posix, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const HW_CODE = resolve(HERE, "..", "..", "..", "..");                 // .../habait-walkaround (this worktree)
const HW_ASSETS = process.env.HABAIT_ASSETS_ROOT                         // gitignored assets live in main only
  || "C:/RnD/Projects/Habait/habait-walkaround";
const argv = process.argv.slice(2);
const GO = argv.includes("--go");
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const POINT = opt("point", "cp-kitchen");
const RES = opt("res", "1024x512");
const SAMPLES = opt("samples", "16");
const VCPUS = Number(opt("vcpus", "4"));                 // attempt 1: the team refused 8 ("resources.vcpus should be <= 4")
const OUT = resolve(HERE, opt("out", "evidence/2026-11-04-c1"));
const SESSION_CAP_MS = 55 * 60 * 1000;                                   // brief: total runtime <= 60 min
const SANDBOX_TIMEOUT_MS = 45 * 60 * 1000;                               // Hobby's max session; fine on Pro

const BLENDER = {
  version: "4.5.10",
  // attempt 1 (2026-11-04): download.blender.org answered 403 to the sandbox's egress; the official mirrors carry the
  // same file, and the official sha256 below is the gate whichever URL serves it.
  urls: [
    "https://download.blender.org/release/Blender4.5/blender-4.5.10-linux-x64.tar.xz",
    "https://mirrors.ocf.berkeley.edu/blender/release/Blender4.5/blender-4.5.10-linux-x64.tar.xz",
    "https://mirror.clarkson.edu/blender/release/Blender4.5/blender-4.5.10-linux-x64.tar.xz",
    "https://ftp.nluug.nl/pub/graphics/blender/release/Blender4.5/blender-4.5.10-linux-x64.tar.xz",
  ],
  sha256: "198a4248b38899af661aa9241cebd746394eaddbfafbeb53152440de80b118f7",   // blender-4.5.10.sha256
};
const APT = ["libx11-6", "libxi6", "libxxf86vm1", "libxfixes3", "libxrender1", "libxkbcommon0", "libgl1",
  "libegl1", "libsm6", "libice6", "time", "xz-utils"];
const PIP = ["numpy", "opencv-python-headless", "pymupdf"];
const PRICE = { cpu_h: 0.128, gb_h: 0.0212, src: "https://vercel.com/docs/sandbox/pricing (Pro, iad1, read 2026-11-04)" };

// ─────────────────────────────────────────────── the file set, by rule (never a directory dump)
function fileSet() {
  const T = "360walkaround/tours/apt846";
  const P = "360walkaround/pipeline";
  const files = [];                                                      // { rel, src }
  const add = (rel, root = HW_CODE) => {
    const src = join(root, rel);
    if (!existsSync(src)) throw new Error(`missing input: ${src}`);
    files.push({ rel, src });
  };
  const walk = (relDir, root) => {
    for (const n of readdirSync(join(root, relDir))) {
      const rel = posix.join(relDir, n);
      if (n === "CLAUDE.md" || n === "__pycache__") continue;
      if (statSync(join(root, rel)).isDirectory()) walk(rel, root); else add(rel, root);
    }
  };
  for (const n of readdirSync(join(HW_CODE, P)))                         // pipeline code: top-level .py / .mjs
    if (/\.(py|mjs)$/.test(n)) add(`${P}/${n}`);
  walk(`${P}/fixtures`, HW_CODE);
  add("360walkaround/catalog/style-habait-modern.json");
  add("360walkaround/catalog/catalog.manifest.json");
  add(`${P}/probe/probe-assets/assets.lock.json`);
  const style = JSON.parse(readFileSync(join(HW_CODE, "360walkaround/catalog/style-habait-modern.json"), "utf8"));
  const modelDirs = new Set(Object.values(style.models).map((m) => posix.dirname(`360walkaround/${m.file}`)));
  for (const d of [...modelDirs].sort()) walk(d, HW_ASSETS);              // a polyhaven .blend needs its textures/
  add(`360walkaround/${style.surfaces.hdri.file}`, HW_ASSETS);           // the locked HDRI only
  walk(`${P}/probe/probe-assets/textures`, HW_ASSETS);
  add(`${T}/plan.json`);
  add(`${T}/manifest.json`);
  add("Habait/tour360/apartments/apt846/material-board.json");
  for (const f of files)
    if (/(^|\/)\.env|secret|token/i.test(f.rel)) throw new Error(`refusing a secret-shaped path: ${f.rel}`);
  return files.map((f) => ({ ...f, bytes: statSync(f.src).size }));
}

const files = fileSet();
const totalBytes = files.reduce((a, f) => a + f.bytes, 0);
const listHash = createHash("sha256").update(files.map((f) => `${f.rel}\t${f.bytes}`).join("\n")).digest("hex");
const worstCase = VCPUS * PRICE.cpu_h + VCPUS * 2 * PRICE.gb_h;          // per hour, CPU at 100 %
console.log(`spike  point=${POINT} ${RES}@${SAMPLES}spp  vcpus=${VCPUS}  files=${files.length} ` +
  `${(totalBytes / 1e6).toFixed(1)} MB  list=${listHash.slice(0, 12)}`);
console.log(`cost cap: <= $${worstCase.toFixed(2)}/h worst case (${PRICE.src}); session cap ${SESSION_CAP_MS / 60000} min`);
if (!GO) {
  console.log("DRY-RUN — nothing created. Add --go (under `vercel env run`) to boot the sandbox.");
  process.exit(0);
}
if (!process.env.VERCEL_OIDC_TOKEN && !process.env.VERCEL_TOKEN) {
  console.error("FAIL no Vercel credential in the process env — run under `vercel env run` from a linked folder");
  process.exit(2);
}

// ─────────────────────────────────────────────────────────────────────────────── the run
const { Sandbox } = await import("@vercel/sandbox");
mkdirSync(join(OUT, "files"), { recursive: true });
const t0 = Date.now();
const phases = [];
const report = { spike: "sandbox-worker C1", started_utc: new Date().toISOString(), point: POINT, res: RES,
  samples: Number(SAMPLES), files: files.length, upload_bytes: totalBytes, file_list_sha256: listHash,
  blender: BLENDER, price: PRICE, phases };
const save = () => writeFileSync(join(OUT, "spike-report.json"), `${JSON.stringify(report, null, 2)}\n`);
const log = createWriteStream(join(OUT, "spike.log"));
const say = (s) => { const l = `[${((Date.now() - t0) / 1000).toFixed(1).padStart(7)} s] ${s}`; console.log(l); log.write(`${l}\n`); };

let sbx = null;
const R = "/vercel/sandbox";
async function sh(script, { sudo = false, name = "", tee = false } = {}) {
  const c = await sbx.runCommand({ cmd: "bash", args: ["-lc", script], sudo,
    ...(tee ? { stdout: log, stderr: log } : {}) });
  const out = tee ? "" : await c.stdout();
  const err = tee ? "" : await c.stderr();
  if (name && !tee) writeFileSync(join(OUT, `${name}.txt`), `${out}\n--- stderr ---\n${err}`);
  return { code: c.exitCode, out, err };
}
async function cpuJiffies() {
  const { out } = await sh("head -1 /proc/stat");
  const v = out.trim().split(/\s+/).slice(1).map(Number);              // user nice system idle iowait irq softirq steal
  return { active: v[0] + v[1] + v[2] + v[5] + v[6] + v[7], total: v.slice(0, 8).reduce((a, b) => a + b, 0) };
}
async function phase(name, fn) {
  const a = await cpuJiffies();
  const s = Date.now();
  say(`=== ${name}`);
  let result, error = null;
  try { result = await fn(); } catch (e) { error = String(e?.message || e); }
  const b = await cpuJiffies();
  const row = { name, wall_s: Number(((Date.now() - s) / 1000).toFixed(1)),
    active_vcpu_s: Number(((b.active - a.active) / 100).toFixed(1)), ...(result || {}), ...(error ? { error } : {}) };
  phases.push(row);
  save();
  say(`    ${name}: ${row.wall_s} s wall, ${row.active_vcpu_s} active vCPU-s${error ? `  ERROR ${error}` : ""}`);
  if (error) throw new Error(`${name}: ${error}`);
  return row;
}

const deadline = setTimeout(async () => {
  say("DEADLINE reached — stopping the sandbox");
  try { await sbx?.stop(); } catch {}
  process.exit(3);
}, SESSION_CAP_MS);

try {
  const created = Date.now();
  for (const v of [...new Set([VCPUS, 4])]) {
    try {
      sbx = await Sandbox.create({ resources: { vcpus: v }, timeout: SANDBOX_TIMEOUT_MS, persistent: false,
        tags: { purpose: "sandbox-worker-spike" } });
      report.vcpus = v;
      break;
    } catch (e) {
      say(`create with ${v} vCPU refused: ${String(e?.message || e).slice(0, 300)}`);
      if (v === 4) throw e;
    }
  }
  report.sandbox = { name: sbx.name, create_s: Number(((Date.now() - created) / 1000).toFixed(1)),
    timeout_ms: SANDBOX_TIMEOUT_MS, memory_gb: report.vcpus * 2, persistent: false };
  say(`created sandbox ${sbx.name} (${report.vcpus} vCPU) in ${report.sandbox.create_s} s`);
  save();

  await phase("sysinfo", async () => {
    const r = await sh("nproc; free -m; df -h /vercel/sandbox | tail -1; . /etc/os-release; echo $PRETTY_NAME; " +
      "uname -r; python3 --version; node --version; lscpu | grep -E 'Model name|^CPU\\(s\\)'; " +
      "echo user=$(id -un) uid=$(id -u) home=$HOME pwd=$(pwd); df -h / | tail -1", { name: "sysinfo" });
    return { info: r.out.trim().split("\n") };
  });
  // attempt 2 (2026-11-04): /vercel/sandbox does NOT exist in this image under SDK 3.8 ("df: No such file or
  // directory"; every curl -o there failed "ERROR on write"). Create it and hand it to the default user.
  await phase("prep_workdir", async () => {
    const who = (await sh("echo $(id -u):$(id -g)")).out.trim();
    const r = await sh(`mkdir -p ${R} && chown ${who} ${R} && ls -ld ${R}`, { sudo: true, name: "prep-workdir" });
    if (r.code !== 0) throw new Error(`mkdir ${R} exit ${r.code}: ${r.err.slice(-300)}`);
    const w = await sh(`touch ${R}/.w && rm ${R}/.w && echo writable`);
    if (!w.out.includes("writable")) throw new Error(`${R} is not writable by the default user`);
    return { owner: who };
  });
  // the memory sampler: one line every 2 s for the whole session
  await sbx.runCommand({ cmd: "bash", args: ["-c", `while true; do echo "$(date +%s) $(free -m | awk '/Mem:/{print $2, $3}')" >> ${R}/mem.log; sleep 2; done`], detached: true });

  await phase("apt", async () => {
    const r = await sh(`apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends ${APT.join(" ")}`,
      { sudo: true, name: "apt" });
    if (r.code !== 0) throw new Error(`apt exit ${r.code}: ${r.err.slice(-400)}`);
  });
  await phase("blender_download", async () => {
    const tries = [];
    for (const url of BLENDER.urls) {
      const s = Date.now();
      const r = await sh(`curl -fsSL -o ${R}/blender.tar.xz ${url} && echo "${BLENDER.sha256}  ${R}/blender.tar.xz" | sha256sum -c -`, { name: "blender-download" });
      tries.push({ url, exit: r.code, s: Number(((Date.now() - s) / 1000).toFixed(1)), err: r.err.trim().slice(-160) });
      if (r.code === 0) return { sha256_ok: true, url, tries };
    }
    throw new Error(`no mirror served the verified tarball: ${JSON.stringify(tries)}`);
  });
  await phase("blender_extract", async () => {
    const r = await sh(`mkdir -p ${R}/blender && tar -xJf ${R}/blender.tar.xz -C ${R}/blender --strip-components=1 && rm ${R}/blender.tar.xz && ` +
      `(ldd ${R}/blender/blender | grep 'not found' || true) && ${R}/blender/blender -b --factory-startup --version | head -3`, { name: "blender-extract" });
    if (r.code !== 0) throw new Error(`extract exit ${r.code}: ${r.err.slice(-300)}`);
    return { version_lines: r.out.trim().split("\n") };
  });
  await phase("python_venv", async () => {
    const r = await sh(`python3 -m venv ${R}/venv && ${R}/venv/bin/pip install -q ${PIP.join(" ")} && ` +
      `${R}/venv/bin/python -c "import numpy, cv2, pymupdf; print('numpy', numpy.__version__, 'cv2', cv2.__version__, 'pymupdf', pymupdf.__version__)"`, { name: "python-venv" });
    if (r.code !== 0) throw new Error(`pip exit ${r.code}: ${r.err.slice(-400)}`);
    return { versions: r.out.trim() };
  });
  await phase("upload", async () => {
    const dirs = [...new Set(files.map((f) => posix.dirname(`${R}/hw/${f.rel}`)))];
    await sh(`mkdir -p ${dirs.map((d) => `'${d}'`).join(" ")}`);
    let batch = [], size = 0, batches = 0;
    const flush = async () => { if (!batch.length) return; await sbx.writeFiles(batch); batches++; batch = []; size = 0; };
    for (const f of files) {
      batch.push({ path: `${R}/hw/${f.rel}`, content: readFileSync(f.src) });
      size += f.bytes;
      if (size > 24e6) await flush();
    }
    await flush();
    const c = await sh(`find ${R}/hw -type f | wc -l; du -sb ${R}/hw | cut -f1`);
    const [n, b] = c.out.trim().split("\n").map(Number);
    if (n !== files.length || b !== totalBytes) throw new Error(`upload mismatch: ${n} files / ${b} B in the sandbox`);
    return { batches, mb: Number((totalBytes / 1e6).toFixed(1)), mbit_s: null };
  });
  const render = await phase("render", async () => {
    const r = await sh(`cd ${R}/hw && /usr/bin/time -v -o ${R}/time-render.txt node 360walkaround/pipeline/render_tour.mjs ` +
      `360walkaround/tours/apt846 --mode draft --res ${RES} --samples ${SAMPLES} --points ${POINT} --force ${POINT} ` +
      `--no-top-view --blender ${R}/blender/blender; rc=$?; echo "EXIT=$rc"; exit $rc`, { tee: true });
    return { exit_code: r.code };
  });

  // ── collect the evidence
  const want = [
    [`hw/360walkaround/tours/apt846/renders/${POINT}/pano.webp`, "pano.webp"],
    [`hw/360walkaround/tours/apt846/renders/${POINT}/depth.png`, "depth.png"],
    [`hw/360walkaround/tours/apt846/renders/${POINT}/pano.render.json`, "pano.render.json"],
    ["hw/360walkaround/tours/apt846/renders/_render-tour.report.json", "_render-tour.report.json"],
    ["hw/360walkaround/tours/apt846/renders/_logs/build_scene.log", "build_scene.log"],
    [`hw/360walkaround/tours/apt846/renders/_logs/render-${POINT}-x1.log`, `render-${POINT}-x1.log`],
    ["hw/360walkaround/tours/apt846/scene-full.report.json", "scene-full.report.json"],
    ["time-render.txt", "time-render.txt"],
    ["mem.log", "mem.log"],
  ];
  report.outputs = {};
  for (const [src, dst] of want) {
    const buf = await sbx.readFileToBuffer({ path: `${R}/${src}` });
    if (!buf) { report.outputs[dst] = null; continue; }
    writeFileSync(join(OUT, "files", dst), buf);
    report.outputs[dst] = { bytes: buf.length, sha256: createHash("sha256").update(buf).digest("hex") };
  }
  const tr = await sbx.readFileToBuffer({ path: `${R}/hw/360walkaround/tours/apt846/renders/_render-tour.report.json` });
  if (tr) {
    const j = JSON.parse(tr.toString("utf8"));
    report.render_tour = { verdict: j.verdict, runs: j.runs, point_checks: j.point_checks, scene_why: j.scene?.why };
  }
  report.render_exit = render.exit_code;
} catch (e) {
  report.error = String(e?.stack || e);
  say(`ERROR ${report.error}`);
} finally {
  clearTimeout(deadline);
  report.session_wall_s = Number(((Date.now() - t0) / 1000).toFixed(1));
  if (sbx) {
    try { await sbx.stop(); say("stop() returned"); } catch (e) { say(`stop() error: ${e?.message || e}`); }
    for (let i = 0; i < 12; i++) {                                       // poll up to ~60 s for "stopped"
      try {
        const again = await Sandbox.get({ name: sbx.name, resume: false });
        report.sandbox.status_after_stop = again.status;
        say(`status after stop (poll ${i + 1}): ${again.status}`);
        if (["stopped", "failed", "aborted"].includes(again.status)) break;
      } catch (e) { report.sandbox.status_after_stop = `get failed: ${String(e?.message || e).slice(0, 200)}`; say(report.sandbox.status_after_stop); break; }
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  // the bill, from the measured phases (Active CPU = /proc/stat active jiffies; memory = provisioned x wall)
  const vcpuS = phases.reduce((a, p) => a + (p.active_vcpu_s || 0), 0);
  const memGbH = (report.vcpus || VCPUS) * 2 * (report.session_wall_s / 3600);
  report.cost_estimate_usd = { active_vcpu_h: Number((vcpuS / 3600).toFixed(4)), provisioned_gb_h: Number(memGbH.toFixed(3)),
    cpu: Number(((vcpuS / 3600) * PRICE.cpu_h).toFixed(4)), memory: Number((memGbH * PRICE.gb_h).toFixed(4)),
    total: Number(((vcpuS / 3600) * PRICE.cpu_h + memGbH * PRICE.gb_h).toFixed(4)), basis: PRICE.src };
  report.finished_utc = new Date().toISOString();
  save();
  say(`done in ${report.session_wall_s} s; est. $${report.cost_estimate_usd.total}`);
  log.end();
}
