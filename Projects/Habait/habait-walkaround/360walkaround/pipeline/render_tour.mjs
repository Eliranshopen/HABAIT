#!/usr/bin/env node
/**
 * render_tour.mjs — the batch render CLI: one command renders a whole apartment, resumably.
 *
 * Board `360-v2` T07 · render-pipeline-engineer · $0 local (RTX A2000 4 GB, ENV.md §1).
 *
 *   node pipeline/render_tour.mjs tours/pilot-karnei --mode draft
 *   node pipeline/render_tour.mjs tours/pilot-karnei --mode final --points cp-living,cp-master
 *   node pipeline/render_tour.mjs tours/pilot-karnei --mode draft --force cp-wc
 *   node pipeline/render_tour.mjs tours/pilot-karnei --top-view-only
 *
 * WHAT IT ORCHESTRATES (it does no rendering itself — Blender does, per ENV.md §2's full path):
 *   1. THE SCENE. `build_scene.py` has no `--skip-if-clean` of its own, so the freshness test lives
 *      here: the built `.blend`'s own report records `inputs.plan_sha256` and the generator scripts'
 *      sha256s, so a scene is CLEAN when those still match the files on disk and the `.blend` exists.
 *      Otherwise it is rebuilt before a single pixel is rendered.
 *   2. THE POINTS. One Blender process per CHUNK of camera points (default: all of them) — T04/T06
 *      measured the scene sync as the fixed cost of a render, and a per-point process re-pays it.
 *      Each point still does its OWN manifest skip check and writes its OWN row inside that process,
 *      so a crash mid-chunk loses at most the point in flight (proven by killing one).
 *   3. THE TOP VIEW + the room-id mask + the registration sidecar (T08's minimap substrate).
 *   4. THE PROOF. Every produced depth map is decoded HERE, through the committed golden decoder
 *      (`fixtures/check-depth-golden.mjs`, imported — not re-implemented), and its nadir pixel is
 *      compared against the camera's own height from plan.json. ⛔ Exit 0 is necessary, not
 *      sufficient (ENV.md §8): every output file is asserted to exist and to decode.
 *
 * ⛔ THE MANIFEST LAW (root CLAUDE.md §5/§7, rail 2): rerun-skip keys on INPUT hashes only, never on
 *    an output hash — an identical re-render produces different bytes (ENV.md §4.3). The key itself
 *    is computed inside `render_pano.py` (one implementation, next to the settings it hashes); this
 *    file only decides WHICH points to offer it and whether `--skip-if-clean` is passed at all.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { readPng, decodeDepth } from "./fixtures/check-depth-golden.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const VERSION = "0.1.0";

/** ENV.md §2: Blender is NOT on PATH — every invocation uses the full path. */
const BLENDER_DEFAULT = "C:/Program Files/Blender Foundation/Blender 4.5/blender.exe";

/** ENV.md §5.1, the settings of record. `final` is the hero setting; `draft` is the batch setting. */
const MODES = {
  draft: { res: "4096x2048", samples: 64, topViewSamples: 64 },
  final: { res: "8192x4096", samples: 256, topViewSamples: 128 },
};

// ───────────────────────────────────────────────────────────────────────── args
const argv = process.argv.slice(2);
/** the flags that CONSUME the next token — everything else is boolean, so a positional is never
 *  swallowed and a value is never mistaken for one. */
const VALUED = new Set(["mode", "res", "samples", "points", "force", "chunk", "wrap-pad",
  "blender", "scene", "px-per-m"]);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d = null) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith("--") ? argv[i + 1] : d;
};
const positional = argv.filter((a, i) =>
  !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--") && VALUED.has(argv[i - 1].slice(2))));
const tourArg = positional[0];
if (!tourArg || flag("help")) {
  console.log("usage: node pipeline/render_tour.mjs <tour-dir> [--mode draft|final] [--points a,b]");
  console.log("       [--force <id|all>] [--wrap-pad N] [--chunk N] [--top-view-only] [--no-top-view]");
  console.log("       [--res WxH] [--samples N] [--dry-run] [--blender <path>] [--scene <file.blend>]");
  process.exit(tourArg ? 0 : 2);
}

const REPO = resolve(HERE, "..", "..");
const tourDir = resolve(process.cwd(), tourArg);
const mode = opt("mode", "draft");
if (!MODES[mode]) fail(`--mode must be one of ${Object.keys(MODES).join("|")}`);
const res = opt("res", MODES[mode].res);
const samples = Number(opt("samples", MODES[mode].samples));
const wrapPad = Number(opt("wrap-pad", "512"));   // ENV.md §12 / F-360-118: the measured default
const chunkSize = Number(opt("chunk", "0"));            // 0 = every point in one process
const blender = opt("blender", process.env.BLENDER || BLENDER_DEFAULT);
const sceneName = opt("scene", "scene-full.blend");
const forceArg = opt("force", null);
const dryRun = flag("dry-run");
const noTopView = flag("no-top-view");
const topViewOnly = flag("top-view-only");
const pxPerM = opt("px-per-m", "80");
const [resW, resH] = res.split("x").map(Number);

function fail(msg, code = 2) {
  console.error(`FAIL      ${msg}`);
  process.exit(code);
}
const sha256 = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const nowUtc = () => new Date().toISOString().replace(/\.\d+Z$/, "+00:00");

// ───────────────────────────────────────────────────────────────── tour + plan
const planPath = join(tourDir, "plan.json");
const manifestPath = join(tourDir, "manifest.json");
const blendPath = join(tourDir, sceneName);
const reportPath = join(tourDir, `${sceneName.replace(/\.blend$/, "")}.report.json`);
const rendersDir = join(tourDir, "renders");
const logDir = join(rendersDir, "_logs");
if (!existsSync(planPath)) fail(`no plan.json in ${tourDir}`);
const plan = JSON.parse(readFileSync(planPath, "utf8"));
const allPoints = plan.camera_points.map((p) => p.id);
const wanted = opt("points", null) ? opt("points").split(",").map((s) => s.trim()).filter(Boolean) : allPoints;
for (const id of wanted) if (!allPoints.includes(id)) fail(`camera point '${id}' is not in plan.json`);
const forced = forceArg === "all" ? wanted : forceArg ? forceArg.split(",").map((s) => s.trim()) : [];
for (const id of forced) if (!allPoints.includes(id)) fail(`--force '${id}' is not a camera point`);

mkdirSync(logDir, { recursive: true });

// ───────────────────────────────────────────────────── the Blender invocation
function runBlender(script, scriptArgs, logName) {
  const logFile = join(logDir, logName);
  const args = ["-b", "--factory-startup", "-P", join(HERE, script), "--", ...scriptArgs];
  if (dryRun) {
    console.log(`DRY-RUN   ${blender} ${args.map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ")}`);
    return { code: 0, seconds: 0, log: null, dry: true };
  }
  const t0 = Date.now();
  const r = spawnSync(blender, args, {
    cwd: REPO,
    encoding: "utf8",
    maxBuffer: 1 << 28,
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },   // root rail 7: the console is cp1255
  });
  const seconds = (Date.now() - t0) / 1000;
  const out = `${r.stdout || ""}\n${r.stderr || ""}`;
  writeFileSync(logFile, out);
  // ⭐ what happened THIS run, from the child's own words — a point's sidecar keeps the timing of
  // the render that produced it, so without this a skipped point reports the previous run's seconds
  // and a "100 % skipped" rerun would look identical to a full re-render in the report.
  const skipped = [...out.matchAll(/^SKIP\s+(\S+):/gm)].map((m) => m[1]);
  for (const line of out.split(/\r?\n/)) {
    if (/^(SKIP|OK|FAIL|REPORT|=== |\[render_pano\] (point|render \d|depth  |pano  |top view|room mask|alignment|wrap pad|depth check))/.test(line)) {
      console.log(`          ${line}`);
    }
  }
  // ⛔ ENV.md §8: an uncaught exception under `blender -b -P` still exits 0. The script's own footer
  // converts a crash into exit 1 — and this caller ALSO checks the outputs (below), because a
  // zero exit is necessary, not sufficient.
  return { code: r.status === null ? 1 : r.status, seconds, log: logFile, signal: r.signal || null, skipped };
}

// ────────────────────────────────────────────────────── 1. is the scene clean?
function sceneFreshness() {
  // v1.2 (D-WQ-28): plan_general.py decides every general-plan mesh, so it is part of the key too --
  // compared only when the report records it, so a rectilinear scene's freshness is unchanged.
  const scripts = ["build_scene.py", "materials_kit.py", "place_cameras.py", "placement_templates.py",
    "plan_general.py", "general_furnish.py"].map((f) => ({ file: f, sha256: existsSync(join(HERE, f)) ? sha256(join(HERE, f)) : null }));
  const planHash = sha256(planPath);
  // ⭐ T12: the scene is no longer a function of (plan + build_scene.py) alone. The STYLE LOCK picks
  // every model, material and lighting value, and placement_templates.py decides every position, so
  // both are part of the freshness key — otherwise a style release would silently render as the old
  // style from a "clean" scene, which is exactly the failure rail 2 exists to prevent.
  const styleFile = join(HERE, "..", "catalog", "style-habait-modern.json");
  const styleHash = existsSync(styleFile) ? sha256(styleFile) : null;
  const stale = (why) => ({ clean: false, why, planHash, scripts, styleHash });
  if (!existsSync(blendPath)) return stale(`${sceneName} does not exist`);
  if (!existsSync(reportPath)) return stale("no scene report beside the .blend");
  const rep = JSON.parse(readFileSync(reportPath, "utf8"));
  if (rep.inputs?.plan_sha256 !== planHash) return stale("plan.json changed since the scene was built");
  if (rep.generator?.script_sha256 !== scripts[0].sha256)
    return stale("build_scene.py changed since the scene was built");
  if (rep.generator?.placement_templates_sha256 &&
      rep.generator.placement_templates_sha256 !== scripts[3].sha256)
    return stale("placement_templates.py changed since the scene was built");
  if (rep.generator?.materials_kit_sha256 &&
      rep.generator.materials_kit_sha256 !== scripts[1].sha256)
    return stale("materials_kit.py changed since the scene was built");
  if (rep.inputs?.style_sha256 && styleHash && rep.inputs.style_sha256 !== styleHash)
    return stale("the style lock changed since the scene was built");
  if (rep.generator?.plan_general_sha256 && rep.generator.plan_general_sha256 !== scripts[4].sha256)
    return stale("plan_general.py changed since the scene was built");
  // v1.5 (D-WQ-36): general_furnish.py decides every piece of a general plan's furniture and its doors.
  if (rep.generator?.general_furnish_sha256 && rep.generator.general_furnish_sha256 !== scripts[5].sha256)
    return stale("general_furnish.py changed since the scene was built");
  // v1.4 of build_scene.py (OQ-2): the material board's FLOOR WORDS set the tile grid. The report records
  // the path the builder looked at and every board value the floor read (`words`; null = no board there):
  // a board that appeared, vanished or changed those words makes the scene stale, while a prompt edit
  // elsewhere in the board (the dressing, the avoid list) re-keys nothing.
  const mb = rep.inputs?.material_board;
  if (mb?.path) {
    let cur = null;
    try {
      cur = existsSync(resolve(REPO, mb.path)) ? JSON.parse(readFileSync(resolve(REPO, mb.path), "utf8")) : null;
    } catch {
      return stale("the material board does not parse");
    }
    const was = mb.words ?? null;
    const same = !cur === !was && (!cur ||
      (Object.entries(was.room_surfaces).every(([t, k]) => (cur.room_surfaces?.[t] ?? null) === k) &&
       Object.entries(was.surfaces).every(([k, s]) => (cur.surfaces?.[k] ?? null) === s)));
    if (!same) return stale("the floor words of the material board changed since the scene was built");
  }
  const failed = rep.checks_failed ?? 0;
  return {
    clean: true,
    why: "plan.json + the style lock + the material board + the generator scripts hash the same as the scene report",
    planHash, scripts, styleHash, built_utc: rep.generator?.generated_utc,
    checks: `${rep.checks_passed}/${(rep.checks_passed ?? 0) + failed}`,
  };
}

function buildScene() {
  console.log(`\n=== scene build ${"=".repeat(46)}`);
  const r = runBlender("build_scene.py", [
    relative(REPO, planPath).replace(/\\/g, "/"), "--out", relative(REPO, blendPath).replace(/\\/g, "/"),
  ], "build_scene.log");
  if (r.code !== 0) fail(`build_scene.py exited ${r.code} — see ${r.log}`, 1);
  if (!dryRun && !existsSync(blendPath)) fail(`build_scene.py exited 0 but wrote no ${sceneName}`, 1);
  console.log(`          scene built in ${r.seconds.toFixed(1)} s`);
  return r;
}

// ───────────────────────────────────────────────────────── 2. the point batches
function renderChunk(ids, skipClean) {
  const a = [
    "--blend", relative(REPO, blendPath).replace(/\\/g, "/"),
    "--plan", relative(REPO, planPath).replace(/\\/g, "/"),
    "--points", ids.join(","),
    "--out-root", relative(REPO, rendersDir).replace(/\\/g, "/"),
    "--manifest", relative(REPO, manifestPath).replace(/\\/g, "/"),
    "--res", res, "--samples", String(samples), "--wrap-pad", String(wrapPad),
    "--pano-name", "pano.webp", "--depth-name", "depth.png",
    "--depth-check", "--check-mode", "report",
  ];
  if (skipClean) a.push("--skip-if-clean");
  return runBlender("render_pano.py", a, `render-${ids[0]}-x${ids.length}.log`);
}

function renderTopView() {
  const a = [
    "--blend", relative(REPO, blendPath).replace(/\\/g, "/"),
    "--plan", relative(REPO, planPath).replace(/\\/g, "/"),
    "--out-root", relative(REPO, rendersDir).replace(/\\/g, "/"),
    "--manifest", relative(REPO, manifestPath).replace(/\\/g, "/"),
    "--top-view-only", "--top-view-px-per-m", pxPerM,
    "--top-view-samples", String(MODES[mode].topViewSamples),
    "--res", res, "--samples", String(samples),
  ];
  if (!forced.length && forceArg !== "all") a.push("--skip-if-clean");
  return runBlender("render_pano.py", a, "render-topview.log");
}

// ─────────────────────────────────── 3. the proof: decode every depth map here
function checkPointOutputs(id) {
  const dir = join(rendersDir, id);
  const pano = join(dir, "pano.webp");
  const depth = join(dir, "depth.png");
  const sidecar = join(dir, "pano.render.json");
  const problems = [];
  for (const [what, p] of [["pano", pano], ["depth", depth], ["sidecar", sidecar]])
    if (!existsSync(p)) problems.push(`${what} missing: ${relative(tourDir, p)}`);
  if (problems.length) return { id, ok: false, problems };

  const side = JSON.parse(readFileSync(sidecar, "utf8"));
  const { w, h, rgb } = readPng(readFileSync(depth));
  if (w !== resW || h !== resH) problems.push(`depth is ${w}x${h}, expected ${resW}x${resH}`);
  // ⭐ the decode REFUSES an unknown encoding (C-360-83) — pass the sidecar's OWN recorded values,
  // never the constants this file happens to know.
  const enc = { encoding: side.depth_encoding, scale: side.depth_scale };
  const nadir = decodeDepth(rgb, w, w >> 1, h - 1, enc);   // last scanline = straight down
  const zenith = decodeDepth(rgb, w, w >> 1, 0, enc);      // first scanline = straight up
  const pt = plan.camera_points.find((p) => p.id === id);
  const camZ = pt.z / 100;
  const ceiling = plan.plan_meta.ceiling_height_cm / 100;
  if (nadir === null) problems.push("the nadir pixel decodes as INVALID (no floor under the camera?)");
  else if (Math.abs(nadir - camZ) > 0.05)
    problems.push(`nadir ${nadir.toFixed(3)} m != camera height ${camZ.toFixed(3)} m (±5 cm)`);
  // ⭐ the zenith pixel is the hole test the colour pano cannot make: a uniformly-lit ceiling is
  // legitimately constant (T07 measured two of them at a clipped 255), but a HOLE has no surface at
  // all and decodes as INVALID. The DISTANCE is only reported — a pendant over the camera reads
  // short and that is correct, so it must not be a bar.
  // v1.2 (OQ-G4): an UNROOFED outdoor point looks at the sky by design; a roofed one keeps the bar.
  const room = (plan.rooms || []).find((r) => r.id === pt.room_id);
  const openSky = !!(room && room.is_outdoor && !room.roofed);
  if (zenith === null && !openSky) problems.push("the zenith pixel decodes as INVALID — a hole above the camera");
  let invalid = 0;
  for (let i = 0; i < w * h; i++)
    if (((rgb[i * 3] << 16) | (rgb[i * 3 + 1] << 8) | rgb[i * 3 + 2]) === 0) invalid++;
  const validFrac = 1 - invalid / (w * h);
  if (validFrac < 0.5) problems.push(`only ${(validFrac * 100).toFixed(1)}% of the depth map is valid`);
  return {
    id, ok: problems.length === 0, problems,
    depth: { w, h, nadir_m: nadir, camera_z_m: camZ, nadir_error_cm: nadir === null ? null : Number(((nadir - camZ) * 100).toFixed(2)),
      zenith_m: zenith, expected_zenith_m: Number((ceiling - camZ).toFixed(3)), open_sky: openSky,
      valid_fraction: Number(validFrac.toFixed(6)), invalid_pixels: invalid },
    pano_bytes: statSync(pano).size, depth_bytes: statSync(depth).size,
    seconds: side.timings_s?.render_wall_clock?.slice(-1)[0] ?? null,
    device_peak_mb: side.memory?.device_peak_mb ?? null,
    depth_checks_failed: (side.depth_checks || []).filter((c) => !c.pass).length,
    depth_check_worst_cm: side.depth_check_worst_cm ?? null,
    input_key: side.input_key,
  };
}

function checkTopViewOutputs() {
  const reg = join(rendersDir, "topview.registration.json");
  const problems = [];
  for (const f of ["topview.png", "topview-roomids.png", "topview.registration.json"])
    if (!existsSync(join(rendersDir, f))) problems.push(`top view output missing: ${f}`);
  if (problems.length) return { ok: false, problems };
  const r = JSON.parse(readFileSync(reg, "utf8"));
  if (!r.alignment?.aligned)
    problems.push(`the room-id mask does not align with the render: best shift ${JSON.stringify(r.alignment?.best_shift)}`);
  const mask = readPng(readFileSync(join(rendersDir, "topview-roomids.png")));
  const view = readPng(readFileSync(join(rendersDir, "topview.png")));
  if (mask.w !== view.w || mask.h !== view.h)
    problems.push(`mask ${mask.w}x${mask.h} != top view ${view.w}x${view.h}`);
  // the mask must be FLAT: every pixel is either the background or exactly one room's colour
  const legend = new Map(r.rooms.map((x) => [x.rgb.join(","), x.room_id]));
  const seen = new Map();
  for (let i = 0; i < mask.w * mask.h; i++) {
    const k = `${mask.rgb[i * 3]},${mask.rgb[i * 3 + 1]},${mask.rgb[i * 3 + 2]}`;
    seen.set(k, (seen.get(k) || 0) + 1);
  }
  const strays = [...seen.keys()].filter((k) => k !== "0,0,0" && !legend.has(k));
  if (strays.length) problems.push(`the mask carries ${strays.length} colour(s) no room owns (anti-aliasing?): ${strays.slice(0, 4)}`);
  return {
    ok: problems.length === 0, problems,
    size: [view.w, view.h], colours_in_mask: seen.size, rooms: r.rooms.length,
    alignment: r.alignment?.best_shift, zero_shift_iou: r.alignment?.zero_shift_iou,
    cm_per_px: r.cm_per_px, plan_cm: r.plan_cm,
  };
}

// ───────────────────────────────────────────────────────────────────── the run
const started = nowUtc();
const t0 = Date.now();
console.log(`render_tour.mjs v${VERSION}  tour=${relative(REPO, tourDir).replace(/\\/g, "/")}  mode=${mode} ` +
  `${res}@${samples}spp  wrap-pad=${wrapPad}  points=${topViewOnly ? 0 : wanted.length}` +
  `${forced.length ? `  force=[${forced}]` : ""}${dryRun ? "  DRY-RUN" : ""}`);

// the golden decoder must itself be honest before it is used as a proof
const gold = spawnSync(process.execPath, [join(HERE, "fixtures", "check-depth-golden.mjs")], { encoding: "utf8" });
if (gold.status !== 0) fail(`the golden depth fixture does not decode — ${gold.stdout}${gold.stderr}`, 1);
console.log(`          golden depth fixture: ${gold.stdout.trim().split("\n").slice(-2).join(" | ")}`);

const fresh = sceneFreshness();
console.log(`          scene: ${fresh.clean ? "CLEAN" : "STALE"} — ${fresh.why}` +
  (fresh.clean ? ` (built ${fresh.built_utc}, checks ${fresh.checks})` : ""));
if (!fresh.clean) buildScene();

const chunks = [];
if (!topViewOnly) {
  const todo = wanted;
  const n = chunkSize > 0 ? chunkSize : todo.length;
  for (let i = 0; i < todo.length; i += n) chunks.push(todo.slice(i, i + n));
}

const runs = [];
for (const [i, ids] of chunks.entries()) {
  const forcedHere = ids.filter((id) => forced.includes(id));
  console.log(`\n=== chunk ${i + 1}/${chunks.length}: ${ids.length} point(s)${forcedHere.length ? ` (forcing ${forcedHere})` : ""} ${"=".repeat(20)}`);
  // a forced point is rendered by a chunk WITHOUT --skip-if-clean; the rest keep the skip
  const skipIds = ids.filter((id) => !forced.includes(id));
  if (skipIds.length) runs.push({ ids: skipIds, skip: true, ...renderChunk(skipIds, true) });
  if (forcedHere.length) runs.push({ ids: forcedHere, skip: false, ...renderChunk(forcedHere, false) });
}

let topView = null;
// v1.2 (D-WQ-28): render_pano.py's --top-view reads walls[].rect_cm (bounds + the registration check), so a
// GENERAL plan skips it with a reason instead of crashing; the polygon version is a Q02 follow-up.
const generalPlan = plan.geometry === "general" || plan.plan_meta?.geometry === "general";
if (generalPlan && !noTopView && !dryRun)
  console.log("\n          top view SKIPPED - a general plan (render_pano.py --top-view reads rect walls)");
if (!noTopView && !dryRun && !generalPlan) {
  console.log(`\n=== top view ${"=".repeat(48)}`);
  const r = renderTopView();
  topView = { ...r, ...checkTopViewOutputs() };
}

// ── the assertions: exit 0 is necessary, not sufficient ─────────────────────
const skippedThisRun = new Set(runs.flatMap((r) => r.skipped || []));
const checks = dryRun || topViewOnly
  ? []
  : wanted.map((id) => ({ ...checkPointOutputs(id), skipped_this_run: skippedThisRun.has(id) }));
const badRuns = runs.filter((r) => r.code !== 0);
const badPoints = checks.filter((c) => !c.ok);
const seconds = (Date.now() - t0) / 1000;

const report = {
  generator: { script: "pipeline/render_tour.mjs", version: VERSION, started_utc: started,
    finished_utc: nowUtc(), seconds: Number(seconds.toFixed(2)) },
  settings: { mode, resolution: [resW, resH], samples, wrap_pad: wrapPad, scene: sceneName,
    chunk: chunkSize || (chunks[0]?.length ?? 0), blender, px_per_m: Number(pxPerM) },
  scene: fresh,
  points_requested: wanted,
  forced,
  runs: runs.map((r) => ({ points: r.ids, skip_if_clean: r.skip, exit: r.code,
    seconds: Number(r.seconds.toFixed(2)), skipped: r.skipped || [],
    rendered: r.ids.filter((i) => !(r.skipped || []).includes(i)),
    log: relative(tourDir, r.log || "").replace(/\\/g, "/") })),
  skipped_this_run: [...skippedThisRun],
  rendered_this_run: wanted.filter((i) => !skippedThisRun.has(i)),
  point_checks: checks,
  top_view: topView && { exit: topView.code, seconds: Number(topView.seconds.toFixed(2)), ok: topView.ok,
    problems: topView.problems, size: topView.size, rooms: topView.rooms,
    colours_in_mask: topView.colours_in_mask, alignment: topView.alignment,
    zero_shift_iou: topView.zero_shift_iou, cm_per_px: topView.cm_per_px, plan_cm: topView.plan_cm },
  cost_usd: 0.0,
  machine: "local — RTX A2000 Laptop 4 GB (ENV.md §1); $0, see pipeline/RENDER-LEDGER.md",
  verdict: badRuns.length === 0 && badPoints.length === 0 && (!topView || topView.ok) ? "PASS" : "FAIL",
};

if (!dryRun) {
  writeFileSync(join(rendersDir, "_render-tour.report.json"), `${JSON.stringify(report, null, 2)}\n`);
  // the batch row in the manifest — the per-point rows are render_pano.py's own
  const man = JSON.parse(readFileSync(manifestPath, "utf8"));
  man.batches = [...(man.batches || []), {
    tool: "pipeline/render_tour.mjs", version: VERSION, finished_utc: report.generator.finished_utc,
    mode, resolution: [resW, resH], samples, wrap_pad: wrapPad,
    points: wanted, seconds: report.generator.seconds, verdict: report.verdict, cost_usd: 0.0,
  }].slice(-10);
  writeFileSync(manifestPath, `${JSON.stringify(man, null, 2)}\n`);
}

console.log(`\n=== summary ${"=".repeat(49)}`);
for (const c of checks) {
  const s = c.skipped_this_run ? "SKIPPED" : c.seconds ? `${c.seconds.toFixed(1)} s` : "?";
  console.log(`  ${c.ok ? "OK  " : "FAIL"} ${c.id.padEnd(16)} ${String(s).padStart(10)}  ` +
    `nadir ${c.depth?.nadir_m ?? "?"} m (${c.depth?.nadir_error_cm ?? "?"} cm)  ` +
    `valid ${((c.depth?.valid_fraction ?? 0) * 100).toFixed(2)}%  ` +
    `${c.pano_bytes ? `${(c.pano_bytes / 1024).toFixed(0)} KB` : ""}` +
    `${c.problems?.length ? `  ${c.problems.join("; ")}` : ""}`);
}
if (topView) console.log(`  ${topView.ok ? "OK  " : "FAIL"} ${"topview".padEnd(16)} ${topView.seconds.toFixed(1)} s`.padEnd(40) +
  `  ${topView.size?.join("x")}  ${topView.rooms} rooms  shift ${JSON.stringify(topView.alignment)}  IoU ${topView.zero_shift_iou}` +
  `${topView.problems?.length ? `  ${topView.problems.join("; ")}` : ""}`);
console.log(`  total ${seconds.toFixed(1)} s · ${report.rendered_this_run.length} rendered, ` +
  `${report.skipped_this_run.length} skipped · $0.00 · verdict ${report.verdict}`);
if (report.verdict !== "PASS") {
  for (const r of badRuns) console.error(`FAIL      blender exited ${r.code} for [${r.ids}] — see ${r.log}`);
  for (const c of badPoints) console.error(`FAIL      ${c.id}: ${c.problems.join("; ")}`);
  process.exit(1);
}
console.log("OK");
