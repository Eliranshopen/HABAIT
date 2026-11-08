#!/usr/bin/env node
/**
 * rekey-reports.mjs — move a tour's recorded input hashes from CRLF bytes to LF bytes ONCE, with a
 * proof, and check a tour's staleness without rendering.
 *
 * Board `walkaround-production` WP-04 · render-pipeline-engineer · 2026-11-01 · $0, no Blender, no network.
 *
 *   node pipeline/tools/rekey-reports.mjs --rekey tours/apt846-furnished tours/apt846          # plan + proof, writes nothing
 *   node pipeline/tools/rekey-reports.mjs --rekey tours/apt846-furnished tours/apt846 --write  # apply it
 *   node pipeline/tools/rekey-reports.mjs --check tours/apt846-furnished                       # read-only staleness
 *   add --json for the machine-readable record (tours/apt846-furnished/REKEY.md was written from it)
 *
 * WHY. `build_scene.py` records the sha256 of its inputs in `<scene>.report.json`, and `render_pano.py`
 * copies that block plus its OWN sha256 into every point's `input_key` in `manifest.json`. A sha256 of
 * a text file that git may rewrite on checkout is not a checkpoint: the 846 scenes were built in a
 * worktree checked out under `core.autocrlf=true`, so five inputs were recorded as their CRLF bytes and
 * a clone that writes LF saw every scene as stale. `../../.gitattributes` now pins every recorded input
 * to LF; this tool moves the recorded values once, from the CRLF form to the LF form of the SAME content.
 *
 * WHAT IT CHANGES: nothing but 64-hex values, spliced in place (same length, every other byte asserted
 * unchanged):
 *   · a field named in SPEC whose value is the CRLF sha256 of that file's current content → its LF sha256;
 *   · the `input_key` of every manifest row whose `inputs` changed → re-derived exactly as render_pano.py's
 *     make_input_key does: sha256(json.dumps(inputs, sort_keys=True, ensure_ascii=False)).
 * A value that is neither form of the file's CURRENT content (a row rendered from an older version) is
 * HISTORICAL and is left exactly as recorded.
 *
 * WHAT IT REFUSES (exit 1, nothing written):
 *   · a SPEC file whose bytes are neither pure LF nor pure CRLF (a lone CR, or mixed line ends);
 *   · the CRLF sha256 of a SPEC file found in a field SPEC does not name for that file;
 *   · a manifest row whose recorded `input_key` is NOT reproduced from its own recorded `inputs` by the
 *     canonical form below; without that, this tool cannot claim to compute what render_pano.py computes.
 *
 * --check: the no-render staleness check. SCENE: the pipeline's own test, `render_tour.mjs <tour>
 * --dry-run` (its `scene: CLEAN|STALE` line; dry-run starts no Blender). POINTS: the key render_pano.py
 * would compute on a rerun with each row's own recorded settings = sha256 of {point, scene: the report's
 * {generator, inputs} as on disk, settings: the row's, with script_sha256 := sha256(pipeline/render_pano.py
 * as on disk)}; a row is KEY-STALE when that differs from its recorded input_key. render_pano.py
 * (:933-939) also needs the outputs on disk to SKIP; those are media and are reported separately.
 * Exit 0 = scene CLEAN and 0 key-stale rows; 1 otherwise; 2 usage.
 *
 * The track root is the tour's grandparent (`<track>/tours/<id>`), so the check always reads the
 * pipeline that sits beside the tour, in the lab or in an export.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

const VERSION = "0.1.0";
const HEX64 = /^[0-9a-f]{64}$/;

/** Every input hash the pipeline records, by field, with the line that records it. */
const SPEC = [
  { file: "pipeline/build_scene.py", fields: [["generator", "script_sha256"]], by: "build_scene.py:2470" },
  { file: "pipeline/placement_templates.py", fields: [["generator", "placement_templates_sha256"]], by: "build_scene.py:2474" },
  { file: "pipeline/materials_kit.py", fields: [["generator", "materials_kit_sha256"]], by: "build_scene.py:2476" },
  { file: "pipeline/plan_general.py", fields: [["generator", "plan_general_sha256"]], by: "build_scene.py:2572" },
  { file: "pipeline/general_furnish.py", fields: [["generator", "general_furnish_sha256"]], by: "build_scene.py:2575" },
  { file: "catalog/style-habait-modern.json", fields: [["inputs", "style_sha256"], ["style", "file_sha256"]], by: "build_scene.py:2487, 2525" },
  { file: "pipeline/render_pano.py", fields: [["settings", "script_sha256"]], by: "render_pano.py:900 (hashes itself)" },
];

// ─────────────────────────────────────────────────────────────────────────── args
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d; };
const sceneName = opt("scene", "scene-full.blend");
const tours = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--scene").map((t) => resolve(process.cwd(), t));
const mode = flag("rekey") ? "rekey" : flag("check") ? "check" : null;
if (!mode || !tours.length || flag("help")) {
  console.log("usage: node pipeline/tools/rekey-reports.mjs (--rekey [--write] | --check) <tour-dir>... [--scene <file.blend>] [--json]");
  process.exit(mode && tours.length ? 0 : 2);
}
const asJson = flag("json");
const write = flag("write");
const log = (s) => { if (!asJson) console.log(s); };

const sha = (b) => createHash("sha256").update(b).digest("hex");
const short = (h) => (h ? `${h.slice(0, 12)}…` : String(h));
class Refusal extends Error {}
const refuse = (m) => { throw new Refusal(m); };

// ─────────────────────────────────────── JSON that keeps every number literal as written
// render_pano.py keys on json.dumps(src, sort_keys=True, ensure_ascii=False); a float written `1.0` must
// come back as `1.0`, so numbers stay raw text and strings remember their byte span.
function parseRaw(text) {
  let i = 0;
  const STR = /"(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"/y;
  const NUM = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
  const LIT = /true|false|null/y;
  const ws = () => { while (i < text.length && " \t\n\r".includes(text[i])) i++; };
  const bad = (m) => refuse(`JSON: ${m} at offset ${i}`);
  const tok = (re) => { re.lastIndex = i; const m = re.exec(text); if (!m) return null; i = re.lastIndex; return m[0]; };
  const str = () => { const start = i; const raw = tok(STR); if (raw === null) bad("expected a string"); return { t: "s", v: JSON.parse(raw), start }; };
  function value() {
    ws();
    if (text[i] === "{") {
      i++; const entries = []; const seen = new Set(); ws();
      if (text[i] === "}") { i++; return { t: "o", entries }; }
      for (;;) {
        ws(); const k = str(); ws();
        if (text[i] !== ":") bad("expected ':'"); i++;
        if (seen.has(k.v)) bad(`duplicate key '${k.v}'`); seen.add(k.v);
        entries.push([k.v, value()]); ws();
        if (text[i] === ",") { i++; continue; }
        if (text[i] === "}") { i++; return { t: "o", entries }; }
        bad("expected ',' or '}'");
      }
    }
    if (text[i] === "[") {
      i++; const items = []; ws();
      if (text[i] === "]") { i++; return { t: "a", items }; }
      for (;;) {
        items.push(value()); ws();
        if (text[i] === ",") { i++; continue; }
        if (text[i] === "]") { i++; return { t: "a", items }; }
        bad("expected ',' or ']'");
      }
    }
    if (text[i] === '"') return str();
    const n = tok(NUM); if (n !== null) return { t: "n", raw: n };
    const l = tok(LIT); if (l !== null) return { t: "l", raw: l };
    return bad("unexpected token");
  }
  const root = value(); ws();
  if (i !== text.length) bad("trailing data");
  return root;
}
/** Python's sorted() on str keys = code-point order. */
const byCodePoint = (a, b) => {
  const A = [...a], B = [...b];
  for (let k = 0; k < Math.min(A.length, B.length); k++) { const d = A[k].codePointAt(0) - B[k].codePointAt(0); if (d) return d; }
  return A.length - B.length;
};
/** = json.dumps(x, sort_keys=True, ensure_ascii=False): separators ', ' and ': ', numbers as written. */
function canon(node) {
  if (node.t === "o") return `{${[...node.entries].sort((p, q) => byCodePoint(p[0], q[0])).map(([k, v]) => `${JSON.stringify(k)}: ${canon(v)}`).join(", ")}}`;
  if (node.t === "a") return `[${node.items.map(canon).join(", ")}]`;
  if (node.t === "s") return JSON.stringify(node.v);
  return node.raw;
}
const get = (node, path) => path.reduce((n, k) => (n?.t === "o" ? n.entries.find(([key]) => key === k)?.[1] : n?.t === "a" ? n.items[k] : undefined), node);
const obj = (entries) => ({ t: "o", entries });
const withEntry = (o, key, v) => obj(o.entries.map(([k, x]) => [k, k === key ? v : x]));
function* stringLeaves(node, path = []) {
  if (node.t === "o") for (const [k, v] of node.entries) yield* stringLeaves(v, [...path, k]);
  else if (node.t === "a") for (let j = 0; j < node.items.length; j++) yield* stringLeaves(node.items[j], [...path, j]);
  else if (node.t === "s") yield { path, node };
}
/** Every object holding a string `input_key` beside an object `inputs` = one rerun-skip row. */
function* keyedRows(node, path = []) {
  if (node.t === "o") {
    const key = get(node, ["input_key"]), inputs = get(node, ["inputs"]);
    if (key?.t === "s" && inputs?.t === "o") yield { path, key, inputs };
    for (const [k, v] of node.entries) yield* keyedRows(v, [...path, k]);
  } else if (node.t === "a") for (let j = 0; j < node.items.length; j++) yield* keyedRows(node.items[j], [...path, j]);
}
const dotted = (path) => path.map((k) => (typeof k === "number" ? `[${k}]` : `.${k}`)).join("").replace(/^\./, "");
const tailIs = (path, suffix) => suffix.length <= path.length && suffix.every((s, j) => path[path.length - suffix.length + j] === s);
/** Leaf paths where two parsed trees differ (key order ignored, number literals compared as written). */
function diffPaths(a, b, cap = 8, path = [], out = []) {
  if (out.length >= cap) return out;
  if (!a || !b || a.t !== b.t) { out.push(dotted(path)); return out; }
  if (a.t === "o") {
    for (const k of new Set([...a.entries.map((e) => e[0]), ...b.entries.map((e) => e[0])])) diffPaths(get(a, [k]), get(b, [k]), cap, [...path, k], out);
  } else if (a.t === "a") {
    if (a.items.length !== b.items.length) out.push(dotted(path));
    else a.items.forEach((x, j) => diffPaths(x, b.items[j], cap, [...path, j], out));
  } else if ((a.t === "s" ? a.v : a.raw) !== (b.t === "s" ? b.v : b.raw)) out.push(dotted(path));
  return out;
}

// ──────────────────────────────────────────────────── the two forms of one text file
function lineEndingForms(abs) {
  const bytes = readFileSync(abs);
  let nl = 0, cr = 0, pairs = 0;
  for (let k = 0; k < bytes.length; k++) {
    if (bytes[k] === 10) nl++;
    else if (bytes[k] === 13) { cr++; if (bytes[k + 1] === 10) pairs++; }
  }
  const onDisk = cr === 0 ? "LF" : cr === pairs && pairs === nl ? "CRLF" : null;
  if (!onDisk) refuse(`${abs}: mixed line endings (${nl} LF, ${cr} CR, ${pairs} CRLF pairs), no single CRLF<->LF pair to prove`);
  const latin = (b) => b.toString("latin1");
  const lf = onDisk === "LF" ? bytes : Buffer.from(latin(bytes).replace(/\r\n/g, "\n"), "latin1");
  const crlf = onDisk === "CRLF" ? bytes : Buffer.from(latin(bytes).replace(/\n/g, "\r\n"), "latin1");
  const proof = {
    lf_has_no_cr: !lf.includes(13),
    crlf_is_lf_with_cr_before_every_lf: Buffer.from(latin(lf).replace(/\n/g, "\r\n"), "latin1").equals(crlf),
    lf_is_crlf_without_its_crs: Buffer.from(latin(crlf).replace(/\r\n/g, "\n"), "latin1").equals(lf),
    crs: crlf.length - lf.length,
  };
  if (!proof.lf_has_no_cr || !proof.crlf_is_lf_with_cr_before_every_lf || !proof.lf_is_crlf_without_its_crs)
    refuse(`${abs}: the CRLF and LF forms do not differ only by CR (${JSON.stringify(proof)})`);
  return { onDisk, bytesOnDisk: bytes.length, lfBytes: lf.length, crlfBytes: crlf.length, lfSha: sha(lf), crlfSha: sha(crlf), lf, proof };
}
function headBlob(abs) {
  try {
    return execFileSync("git", ["-C", dirname(abs), "cat-file", "blob", `HEAD:./${basename(abs)}`],
      { maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] });
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────── --rekey
function specsFor(tourDir, track) {
  const specs = SPEC.map((s) => ({ ...s, abs: join(track, s.file) }));
  specs.push({ file: relative(track, join(tourDir, "plan.json")).replace(/\\/g, "/"), abs: join(tourDir, "plan.json"),
    fields: [["inputs", "plan_sha256"], ["plan_source", "sha256"]], by: "build_scene.py:2484 (pinned since T08)" });
  const rep = join(tourDir, sceneName.replace(/\.blend$/, ".report.json"));
  const mb = existsSync(rep) ? get(parseRaw(readFileSync(rep, "utf8")), ["inputs", "material_board", "path"]) : null;
  if (mb?.t === "s") specs.push({ file: mb.v, abs: resolve(track, "..", mb.v), fields: [["material_board", "sha256"]],
    by: "build_scene.py:391 (outside this track: not pinnable from its .gitattributes)" });
  return specs;
}

function rekeyFile(jsonAbs, specs) {
  const original = readFileSync(jsonAbs);
  const text = original.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(original)) refuse(`${jsonAbs}: not clean UTF-8 - a text round trip would change bytes`);
  const root = parseRaw(text);
  const edits = [], notes = [];
  const oldToSpec = new Map(specs.filter((s) => s.forms && s.forms.crlfSha !== s.forms.lfSha).map((s) => [s.forms.crlfSha, s]));
  for (const { path, node } of stringLeaves(root)) {
    if (!HEX64.test(node.v)) continue;
    const owner = specs.find((s) => s.fields.some((f) => tailIs(path, f)));
    if (owner && owner.forms) {
      if (node.v === owner.forms.crlfSha) edits.push({ at: node.start + 1, path: dotted(path), file: owner.file, old: node.v, new: owner.forms.lfSha });
      else notes.push({ path: dotted(path), file: owner.file, value: node.v,
        status: node.v === owner.forms.lfSha ? "LF already" : "historical - not this file's current content, left as recorded" });
    } else if (oldToSpec.has(node.v)) refuse(`${jsonAbs}: ${dotted(path)} holds the CRLF sha256 of ${oldToSpec.get(node.v).file} in a field SPEC does not name for it`);
  }
  // every keyed row must reproduce its OWN recorded key before any key is re-derived
  const rows = [...keyedRows(root)];
  for (const r of rows) {
    const self = sha(canon(r.inputs));
    if (self !== r.key.v) refuse(`${jsonAbs}: ${dotted(r.path)} - sha256(canonical inputs) ${short(self)} != recorded input_key ${short(r.key.v)}; the canonical form is unproven, nothing written`);
  }
  const splice = (t, list) => { let out = t; for (const e of list) out = out.slice(0, e.at) + e.new + out.slice(e.at + 64); return out; };
  const text1 = splice(text, edits);
  const root1 = parseRaw(text1);
  const keyEdits = [];
  for (const r1 of keyedRows(root1)) {
    const was = get(root, [...r1.path, "input_key"]).v;
    const now = sha(canon(r1.inputs));
    if (now !== was) keyEdits.push({ at: r1.key.start + 1, path: dotted([...r1.path, "input_key"]), old: was, new: now, row: dotted(r1.path) });
  }
  const text2 = splice(text1, keyEdits);
  // the assertions: same length, and every changed character inside a planned 64-hex span
  const all = [...edits, ...keyEdits];
  if (text2.length !== text.length) refuse(`${jsonAbs}: length changed`);
  for (let k = 0; k < text.length; k++)
    if (text[k] !== text2[k] && !all.some((e) => k >= e.at && k < e.at + 64)) refuse(`${jsonAbs}: offset ${k} changed outside a planned hash`);
  const changed = diffPaths(root, parseRaw(text2), Infinity);
  const planned = new Set(all.map((e) => e.path));
  const unplanned = changed.filter((p) => !planned.has(p));
  if (unplanned.length || changed.length !== planned.size) refuse(`${jsonAbs}: the re-parsed file differs at ${unplanned.length ? unplanned.slice(0, 3) : `${changed.length} paths for ${planned.size} planned`}`);
  const out = Buffer.from(text2, "utf8");
  return { file: jsonAbs, rows: rows.length, rows_self_consistent: rows.length, edits, keyEdits, notes,
    sha256_before: sha(original), sha256_after: sha(out), bytes: original.length, out, changed: text2 !== text };
}

function rekey() {
  const result = { tool: "pipeline/tools/rekey-reports.mjs", version: VERSION, mode: "rekey", write, files: [], tours: [] };
  const seen = new Map();
  const plans = [];
  for (const tourDir of tours) {
    const track = resolve(tourDir, "..", "..");
    if (!existsSync(join(track, "pipeline", "render_pano.py"))) refuse(`${tourDir}: no pipeline/render_pano.py two levels up - not a <track>/tours/<id> folder`);
    const specs = specsFor(tourDir, track);
    for (const s of specs) {
      if (!existsSync(s.abs)) { s.forms = null; continue; }
      if (!seen.has(s.abs)) {
        const f = lineEndingForms(s.abs);
        const blob = headBlob(s.abs);
        seen.set(s.abs, f);
        result.files.push({ file: s.file, recorded_by: s.by, on_disk: f.onDisk, bytes_on_disk: f.bytesOnDisk, lf_bytes: f.lfBytes,
          crlf_bytes: f.crlfBytes, crs: f.proof.crs, crlf_sha256: f.crlfSha, lf_sha256: f.lfSha, proof: f.proof,
          head_blob_sha256: blob ? sha(blob) : null, head_blob_is_the_lf_form: blob ? blob.equals(f.lf) : null });
      }
      s.forms = seen.get(s.abs);
    }
    const files = [join(tourDir, sceneName.replace(/\.blend$/, ".report.json")), join(tourDir, "manifest.json")].filter(existsSync);
    plans.push({ tourDir, track, done: files.map((f) => rekeyFile(f, specs)) });
  }
  // nothing is written until every file of every tour has passed every assertion
  for (const p of plans) {
    const t = { tour: p.tourDir, files: [] };
    for (const d of p.done) {
      if (write && d.changed) {
        writeFileSync(d.file, d.out);
        if (sha(readFileSync(d.file)) !== d.sha256_after) refuse(`${d.file}: the written bytes do not hash as planned`);
      }
      t.files.push({ file: relative(p.track, d.file).replace(/\\/g, "/"), bytes: d.bytes, sha256_before: d.sha256_before,
        sha256_after: d.sha256_after, keyed_rows: d.rows, rows_self_consistent: d.rows_self_consistent,
        field_edits: d.edits.map(({ path, file, old, new: nw }) => ({ path, file, old, new: nw })),
        input_key_edits: d.keyEdits.map(({ row, old, new: nw }) => ({ row, old, new: nw })),
        left_as_recorded: d.notes, written: write && d.changed });
    }
    result.tours.push(t);
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────── --check
function check() {
  const result = { tool: "pipeline/tools/rekey-reports.mjs", version: VERSION, mode: "check", tours: [] };
  for (const tourDir of tours) {
    const track = resolve(tourDir, "..", "..");
    const renderTour = join(track, "pipeline", "render_tour.mjs");
    const renderPano = join(track, "pipeline", "render_pano.py");
    if (!existsSync(renderTour) || !existsSync(renderPano)) refuse(`${tourDir}: no pipeline/ two levels up`);
    const rt = spawnSync(process.execPath, [renderTour, tourDir, "--dry-run", "--scene", sceneName], { cwd: track, encoding: "utf8", timeout: 240_000 });
    const m = /scene: (CLEAN|STALE) — (.*)$/m.exec(rt.stdout || "");
    const scene = { exit: rt.status, state: m ? m[1] : "UNKNOWN", why: m ? m[2] : `${rt.stdout || ""}${rt.stderr || ""}`.trim().slice(-300) };
    const rep = parseRaw(readFileSync(join(tourDir, sceneName.replace(/\.blend$/, ".report.json")), "utf8"));
    const man = parseRaw(readFileSync(join(tourDir, "manifest.json"), "utf8"));
    const sceneMeta = obj([["generator", get(rep, ["generator"]) ?? obj([])], ["inputs", get(rep, ["inputs"]) ?? obj([])]]);
    const panoSha = sha(readFileSync(renderPano));
    const points = [];
    for (const r of keyedRows(man)) {
      const settings = get(r.inputs, ["settings"]);
      const src = obj([["point", get(r.inputs, ["point"])], ["scene", sceneMeta],
        ["settings", withEntry(settings, "script_sha256", { t: "s", v: panoSha })]]);
      const keyNow = sha(canon(src));
      const why = [];
      if (sha(canon(r.inputs)) !== r.key.v) why.push("the row's own inputs do not hash to its input_key");
      const sd = diffPaths(get(r.inputs, ["scene"]), sceneMeta);
      if (sd.length) why.push(`the scene differs from the report at ${sd.join(", ")}`);
      const rec = get(settings, ["script_sha256"])?.v;
      if (rec !== panoSha) why.push(`render_pano.py recorded ${short(rec)}, on disk ${short(panoSha)}`);
      const dir = get(r.inputs, ["point"]) && get(man, [...r.path, "dir"])?.v;
      const outs = ["pano", "depth"].map((o) => get(man, [...r.path, "outputs", o, "file"])?.v).filter(Boolean);
      const present = !!dir && outs.length > 0 && outs.every((f) => existsSync(join(tourDir, dir, f)));
      points.push({ row: dotted(r.path), key_clean: keyNow === r.key.v, recorded: r.key.v, now: keyNow, why, outputs_present: present });
    }
    const stale = points.filter((p) => !p.key_clean);
    const t = { tour: tourDir, scene, render_pano_sha256: panoSha, points: points.length, key_clean: points.length - stale.length,
      key_stale: stale.length, key_stale_rows: stale.map((p) => p.row), outputs_present: points.filter((p) => p.outputs_present).length,
      would_rerender_on_next_run: scene.state === "CLEAN" ? stale.length : points.length, detail: points };
    result.tours.push(t);
    log(`${relative(process.cwd(), tourDir).replace(/\\/g, "/") || "."}: scene ${scene.state} — ${scene.why}`);
    for (const p of points) log(`  ${p.key_clean ? "CLEAN" : "STALE"}  ${p.row.padEnd(26)} key ${short(p.recorded)}${p.key_clean ? "" : ` now ${short(p.now)}`}` +
      `  outputs ${p.outputs_present ? "present" : "absent"}${p.why.length ? `  (${p.why.join("; ")})` : ""}`);
    log(`  => ${t.key_stale} key-stale of ${t.points} · scene ${scene.state} · outputs present ${t.outputs_present}/${t.points} · ` +
      `a rerun would re-render ${t.would_rerender_on_next_run} for a key reason`);
  }
  return result;
}

// ──────────────────────────────────────────────────────────────────────── main
try {
  const r = mode === "rekey" ? rekey() : check();
  if (mode === "rekey" && !asJson) {
    log(`rekey-reports.mjs v${VERSION}  mode=rekey  write=${write ? "YES" : "no (dry)"}`);
    for (const f of r.files)
      log(`  ${f.file.padEnd(52)} on disk ${f.on_disk.padEnd(4)} ${String(f.crs).padStart(5)} line ends  CRLF ${short(f.crlf_sha256)} -> LF ${short(f.lf_sha256)}  ` +
        `proof ${f.proof.lf_has_no_cr && f.proof.crlf_is_lf_with_cr_before_every_lf && f.proof.lf_is_crlf_without_its_crs ? "OK" : "FAIL"}` +
        `  HEAD blob = LF form: ${f.head_blob_is_the_lf_form}`);
    for (const t of r.tours) for (const f of t.files)
      log(`  ${f.file}: ${f.field_edits.length} field(s) re-keyed, ${f.input_key_edits.length} input_key(s) re-derived ` +
        `(${f.rows_self_consistent}/${f.keyed_rows} rows reproduce their own key), ${f.left_as_recorded.filter((n) => n.status.startsWith("historical")).length} historical value(s) left` +
        `${f.written ? "  WRITTEN" : ""}`);
  }
  if (asJson) console.log(JSON.stringify(r, (k, v) => (k === "out" || k === "lf" ? undefined : v), 2));
  if (mode === "check") process.exit(r.tours.every((t) => t.scene.state === "CLEAN" && t.key_stale === 0) ? 0 : 1);
  process.exit(0);
} catch (e) {
  if (e instanceof Refusal) { console.error(`REFUSED   ${e.message}`); process.exit(1); }
  throw e;
}
