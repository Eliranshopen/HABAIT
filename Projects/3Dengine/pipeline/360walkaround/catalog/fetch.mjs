#!/usr/bin/env node
/**
 * fetch.mjs — the CC0 catalog fetcher: `catalog.manifest.json` → `catalog/models/**`, hash-verified.
 *
 * Board `360-v2` T12 · render-pipeline-engineer · $0 (every URL is a free, keyless, CC0 source that
 * T11 licence-verified; this script creates no account, sends no key, and pays nothing).
 *
 *   node 360walkaround/catalog/fetch.mjs --seal        # first fetch: RECORD each row's sha256
 *   node 360walkaround/catalog/fetch.mjs               # later fetches: VERIFY against the record
 *   node 360walkaround/catalog/fetch.mjs --verify-only # no network at all; hash what is on disk
 *   node 360walkaround/catalog/fetch.mjs --no-import-test
 *   node 360walkaround/catalog/fetch.mjs --only kenney-furniture-kit-toilet,polyhaven-...
 *
 * RAIL 4 ("CC0 provenance or it doesn't land"): the binaries are gitignored; this script, the sealed
 * `catalog.manifest.json` (source URL, licence, verification date, sha256 per row) and the generated
 * `fetch.report.json` are the committed truth.
 *
 * THE FOUR PROPERTIES THIS FILE OWES THE BOARD
 *   1. HASH-VERIFIED. `--seal` records `sha256` into the row the FIRST time a file is fetched; every
 *      later run recomputes and compares. A mismatch is a hard failure, never a silent overwrite
 *      (`--reseal` is the deliberate, separate act of accepting a changed upstream file).
 *   2. IMPORT-TESTED. Every fetched model is opened by Blender headless (ONE process for the whole
 *      catalog — a per-asset process would re-pay Blender's boot 57 times). A model that fails to
 *      import, or imports with zero mesh data, is marked `"broken"` IN THE MANIFEST ROW and listed
 *      by id in this script's own summary. ⛔ It is never silently skipped.
 *   3. ONE ZIP, MANY ROWS. Kenney's 45 rows all live inside one 5.1 MB pack zip: it is downloaded
 *      once, its own sha256 checked against the manifest's `sources[].pack_zip_sha256`, and each
 *      row's named `.glb` extracted and hashed individually. (The zip reader is ~70 lines of
 *      central-directory parsing below — this repo adds no dependency for one archive format.)
 *   4. A DEAD URL IS DATA. An HTTP error marks the row `broken` with its status and the run CONTINUES
 *      (sources move; T11 verified liveness on 2026-09-01 and that is a measurement with a date on
 *      it, not a guarantee).
 *
 * ⛔ THE SHARED-FILE RULE (CONTRACT §16.4). `catalog.manifest.json` is SHARED with capability-scout.
 * This script may fill `sha256` and add a `broken` object per row. It EXTENDS, never reshapes: no key
 * is renamed, reordered or removed, and the file is re-serialised with the same 2-space indent and
 * the same (absent) trailing newline it was authored with, so the diff is exactly the new facts.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const VERSION = "1.0.0";

const MANIFEST = join(HERE, "catalog.manifest.json");
const MODELS = join(HERE, "models");
const CACHE = join(HERE, ".cache");          // pack zips; gitignored, re-downloadable, never committed
const REPORT = join(HERE, "fetch.report.json");
const IMPORT_TEST = join(HERE, "import_test.py");
const BLENDER_DEFAULT = "C:/Program Files/Blender Foundation/Blender 4.5/blender.exe";
const UA = "RealEstateTeam-360v2-catalog/1.0 (+board 360-v2 T12; CC0 asset fetch; contact: repo owner)";
const PH_API = "https://api.polyhaven.com";

// ───────────────────────────────────────────────────────────────────────────── args
const argv = process.argv.slice(2);
const has = (n) => argv.includes(`--${n}`);
const opt = (n, d = null) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d;
};
if (has("help")) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0]);
  process.exit(0);
}
const SEAL = has("seal") || has("reseal");
const RESEAL = has("reseal");
const VERIFY_ONLY = has("verify-only");
const NO_IMPORT = has("no-import-test");
const ONLY = opt("only", null) ? new Set(opt("only").split(",").map((s) => s.trim())) : null;
const BLENDER = opt("blender", process.env.BLENDER || BLENDER_DEFAULT);

// ────────────────────────────────────────────────────────────────────── tiny helpers
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const sha256File = (p) => sha256(readFileSync(p));
const human = (n) => `${(n / 1048576).toFixed(2)} MB`;
const rel = (p) => relative(REPO, p).replace(/\\/g, "/");

async function httpGet(url, { json = false, retries = 2 } = {}) {
  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: json ? "application/json" : "*/*" } });
      if (!res.ok) return { ok: false, status: res.status, statusText: res.statusText };
      const buf = Buffer.from(await res.arrayBuffer());
      return { ok: true, status: res.status, buf, json: json ? JSON.parse(buf.toString("utf8")) : null };
    } catch (e) {
      lastErr = e;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  return { ok: false, status: 0, statusText: String(lastErr && lastErr.message ? lastErr.message : lastErr) };
}

// ───────────────────────────────────────────────────────── a minimal ZIP reader (no deps)
/**
 * Read a ZIP archive's central directory and return `{ name -> Buffer }` for the requested names.
 * Stored (method 0) and deflate (method 8) only — the two a normal asset pack uses; anything else,
 * or a ZIP64 size marker, throws rather than returning a wrong byte.
 */
function unzipSelected(zipBuf, wantedNames) {
  const want = new Set(wantedNames);
  const out = new Map();
  // End Of Central Directory: scan backwards (the comment field is variable-length).
  let eocd = -1;
  for (let i = zipBuf.length - 22; i >= 0 && i > zipBuf.length - 22 - 65536; i--) {
    if (zipBuf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("not a zip: no end-of-central-directory record");
  const entries = zipBuf.readUInt16LE(eocd + 10);
  let p = zipBuf.readUInt32LE(eocd + 16);
  if (p === 0xffffffff) throw new Error("ZIP64 archive — this reader is deliberately not that general");
  for (let n = 0; n < entries; n++) {
    if (zipBuf.readUInt32LE(p) !== 0x02014b50) throw new Error(`central directory entry ${n} has a bad signature`);
    const method = zipBuf.readUInt16LE(p + 10);
    const compSize = zipBuf.readUInt32LE(p + 20);
    const rawSize = zipBuf.readUInt32LE(p + 24);
    const nameLen = zipBuf.readUInt16LE(p + 28);
    const extraLen = zipBuf.readUInt16LE(p + 30);
    const commentLen = zipBuf.readUInt16LE(p + 32);
    const localOff = zipBuf.readUInt32LE(p + 42);
    const name = zipBuf.toString("utf8", p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (!want.has(name)) continue;
    if (compSize === 0xffffffff || rawSize === 0xffffffff || localOff === 0xffffffff)
      throw new Error(`ZIP64 sizes on ${name} — refusing to guess`);
    if (zipBuf.readUInt32LE(localOff) !== 0x04034b50) throw new Error(`bad local header for ${name}`);
    const lNameLen = zipBuf.readUInt16LE(localOff + 26);
    const lExtraLen = zipBuf.readUInt16LE(localOff + 28);
    const start = localOff + 30 + lNameLen + lExtraLen;
    const data = zipBuf.subarray(start, start + compSize);
    let plain;
    if (method === 0) plain = Buffer.from(data);
    else if (method === 8) plain = inflateRawSync(data);
    else throw new Error(`${name}: unsupported compression method ${method}`);
    if (plain.length !== rawSize) throw new Error(`${name}: inflated ${plain.length} B, header says ${rawSize} B`);
    out.set(name, plain);
  }
  return out;
}

/** Every name in the archive (used to report an `archive_path` that no longer exists). */
function zipNames(zipBuf) {
  let eocd = -1;
  for (let i = zipBuf.length - 22; i >= 0 && i > zipBuf.length - 22 - 65536; i--) {
    if (zipBuf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return [];
  const entries = zipBuf.readUInt16LE(eocd + 10);
  let p = zipBuf.readUInt32LE(eocd + 16);
  const names = [];
  for (let n = 0; n < entries; n++) {
    const nameLen = zipBuf.readUInt16LE(p + 28);
    const extraLen = zipBuf.readUInt16LE(p + 30);
    const commentLen = zipBuf.readUInt16LE(p + 32);
    names.push(zipBuf.toString("utf8", p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return names;
}

// ─────────────────────────────────────────────────────────────────────────── manifest
if (!existsSync(MANIFEST)) { console.error(`FAIL      no manifest at ${rel(MANIFEST)}`); process.exit(2); }
const manifestRaw = readFileSync(MANIFEST, "utf8");
const manifest = JSON.parse(manifestRaw);
const sources = new Map(manifest.sources.map((s) => [s.id, s]));
const rows = manifest.assets.filter((a) => !ONLY || ONLY.has(a.id));

console.log(`fetch.mjs v${VERSION}  ${rows.length}/${manifest.assets.length} row(s)  ` +
  `${SEAL ? (RESEAL ? "RESEAL" : "SEAL") : VERIFY_ONLY ? "VERIFY-ONLY (no network)" : "VERIFY"}  ` +
  `import-test=${NO_IMPORT ? "off" : "on"}`);
console.log(`          manifest ${rel(MANIFEST)}  (${manifest.assets.length} rows, style "${manifest.style}")`);

mkdirSync(MODELS, { recursive: true });
mkdirSync(CACHE, { recursive: true });

// ───────────────────────────────────────────────────── the per-row destination convention
/** One directory per row id — so a row's files are self-contained and a re-fetch is a directory op. */
const rowDir = (row) => join(MODELS, row.id);
function primaryName(row) {
  if (row.archive_path) return row.archive_path.split("/").pop();
  const tail = row.direct_download_url.split("/").pop().split("?")[0];
  return decodeURIComponent(tail);
}

// ─────────────────────────────────────────────────────────────── pack zips (Kenney, …)
const packCache = new Map();  // source_id -> { buf, sha256, bytes, names }
async function ensurePack(sourceId) {
  if (packCache.has(sourceId)) return packCache.get(sourceId);
  const src = sources.get(sourceId);
  const url = src.pack_direct_zip_url;
  const dest = join(CACHE, `${sourceId}.zip`);
  let buf = null;
  if (existsSync(dest)) {
    buf = readFileSync(dest);
    if (src.pack_zip_sha256 && sha256(buf) !== src.pack_zip_sha256) {
      console.log(`          pack ${sourceId}: cached zip hash mismatch — refetching`);
      buf = null;
    }
  }
  if (!buf) {
    if (VERIFY_ONLY) { packCache.set(sourceId, { error: "pack zip not cached and --verify-only" }); return packCache.get(sourceId); }
    console.log(`  GET     pack ${sourceId}  ${url}`);
    const r = await httpGet(url);
    if (!r.ok) { packCache.set(sourceId, { error: `HTTP ${r.status} ${r.statusText || ""}`.trim() }); return packCache.get(sourceId); }
    buf = r.buf;
    writeFileSync(dest, buf);
  }
  const digest = sha256(buf);
  const record = {
    buf, sha256: digest, bytes: buf.length, names: zipNames(buf),
    manifest_sha256: src.pack_zip_sha256 || null,
    sha256_matches_manifest: src.pack_zip_sha256 ? digest === src.pack_zip_sha256 : null,
  };
  console.log(`          pack ${sourceId}: ${human(buf.length)}, ${record.names.length} entries, ` +
    `sha256 ${digest.slice(0, 16)}…  manifest-match=${record.sha256_matches_manifest}`);
  packCache.set(sourceId, record);
  return record;
}

// ──────────────────────────────────────────────────── Poly Haven: the .blend + its textures
const phFiles = new Map();
async function polyhavenFiles(slug) {
  if (phFiles.has(slug)) return phFiles.get(slug);
  const r = await httpGet(`${PH_API}/files/${slug}`, { json: true });
  const v = r.ok ? r.json : { __error: `HTTP ${r.status} ${r.statusText || ""}`.trim() };
  phFiles.set(slug, v);
  return v;
}

// ────────────────────────────────────────────────────────────────────────── the fetch loop
const results = [];
let bytesTotal = 0;
let downloadedBytes = 0;

for (const row of rows) {
  const dir = rowDir(row);
  const name = primaryName(row);
  const dest = join(dir, name);
  const res = {
    id: row.id, source_id: row.source_id, format: row.format,
    file: rel(dest), bytes: null, sha256: null, extra_files: [],
    action: null, broken: null,
  };

  try {
    if (row.source_id === "kenney-furniture-kit" || row.archive_path) {
      // ── one pack zip, many rows ──────────────────────────────────────────────────────
      const pack = await ensurePack(row.source_id);
      if (pack.error) throw new Error(`pack unavailable: ${pack.error}`);
      if (!existsSync(dest)) {
        const got = unzipSelected(pack.buf, [row.archive_path]);
        const data = got.get(row.archive_path);
        if (!data) {
          const near = pack.names.filter((n) => n.endsWith(`/${name}`)).slice(0, 3);
          throw new Error(`archive_path '${row.archive_path}' is not in the pack` +
            (near.length ? ` (did the layout move? saw: ${near.join(", ")})` : ""));
        }
        mkdirSync(dir, { recursive: true });
        writeFileSync(dest, data);
        downloadedBytes += data.length;
        res.action = "extracted";
      } else {
        res.action = "cached";
      }
      res.pack = { source_id: row.source_id, sha256: pack.sha256, bytes: pack.bytes,
        sha256_matches_manifest: pack.sha256_matches_manifest };
    } else if (row.source_id === "polyhaven") {
      // ── a .blend plus the texture files it references as //textures/… ─────────────────
      const slug = row.id.replace(/^polyhaven-/, "");
      let plan = [[name, row.direct_download_url]];
      let apiUrl = null;
      if (!VERIFY_ONLY) {
        const files = await polyhavenFiles(slug);
        if (files.__error) {
          console.log(`  WARN    ${row.id}: /files/${slug} ${files.__error} — falling back to the ` +
            `manifest URL alone (textures may be missing)`);
        } else {
          const node = files?.blend?.["2k"]?.blend;
          if (!node) throw new Error(`the Poly Haven API has no blend/2k/blend entry for ${slug}`);
          apiUrl = node.url;
          plan = [[name, node.url], ...Object.entries(node.include || {}).sort(([a], [b]) => (a < b ? -1 : 1))
            .map(([relPath, inc]) => [relPath, inc.url])];
        }
      }
      res.api_url_matches_manifest = apiUrl ? apiUrl === row.direct_download_url : null;
      for (const [relPath, url] of plan) {
        const p = join(dir, relPath.replace(/\//g, "\\"));
        if (!existsSync(p)) {
          if (VERIFY_ONLY) throw new Error(`missing on disk: ${relPath}`);
          const r = await httpGet(url);
          if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText || ""} on ${url}`.trim());
          mkdirSync(dirname(p), { recursive: true });
          writeFileSync(p, r.buf);
          downloadedBytes += r.buf.length;
        }
        if (relPath !== name) res.extra_files.push({ file: rel(p), bytes: statSync(p).size, sha256: sha256File(p) });
      }
      res.action = existsSync(dest) ? "fetched" : "missing";
    } else {
      // ── a plain single-file download (Quaternius via poly.pizza) ──────────────────────
      if (!existsSync(dest)) {
        if (VERIFY_ONLY) throw new Error("missing on disk and --verify-only");
        const r = await httpGet(row.direct_download_url);
        if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText || ""}`.trim());
        mkdirSync(dir, { recursive: true });
        writeFileSync(dest, r.buf);
        downloadedBytes += r.buf.length;
        res.action = "downloaded";
      } else {
        res.action = "cached";
      }
    }

    if (!existsSync(dest)) throw new Error(`no file at ${rel(dest)} after fetch`);
    res.bytes = statSync(dest).size;
    res.sha256 = sha256File(dest);
    bytesTotal += res.bytes + res.extra_files.reduce((a, f) => a + f.bytes, 0);
  } catch (e) {
    res.broken = { stage: "fetch", error: String(e.message || e) };
    console.log(`  BROKEN  ${row.id}: ${res.broken.error}`);
  }
  results.push(res);
  if (!res.broken) {
    const extra = res.extra_files.length ? ` +${res.extra_files.length} tex` : "";
    console.log(`  ${res.action.padEnd(10)} ${row.id.padEnd(46)} ${String(res.bytes).padStart(10)} B` +
      `${extra}  sha256:${res.sha256.slice(0, 12)}…`);
  }
}

// ───────────────────────────────────────────────────────── hash seal / hash verification
const hashProblems = [];
for (const res of results) {
  const row = manifest.assets.find((a) => a.id === res.id);
  if (res.broken) continue;
  if (row.sha256 && !RESEAL) {
    if (row.sha256 !== res.sha256) {
      hashProblems.push(`${res.id}: recorded ${row.sha256.slice(0, 16)}… but the file on disk is ${res.sha256.slice(0, 16)}…`);
      res.hash_state = "MISMATCH";
    } else res.hash_state = "verified";
  } else if (SEAL) {
    row.sha256 = res.sha256;
    res.hash_state = row.sha256 && RESEAL ? "resealed" : "sealed";
  } else {
    hashProblems.push(`${res.id}: no sha256 recorded in the manifest — run once with --seal`);
    res.hash_state = "UNSEALED";
  }
}

// ─────────────────────────────────────────────────────────── the Blender import test
let importResults = new Map();
let importMeta = null;
const importable = results.filter((r) => !r.broken);
if (!NO_IMPORT && importable.length) {
  if (!existsSync(BLENDER)) {
    console.log(`  WARN    Blender not found at ${BLENDER} — import test SKIPPED (pass --blender <path>)`);
  } else {
    const jobFile = join(CACHE, "import-test-job.json");
    const outFile = join(CACHE, "import-test-out.json");
    writeFileSync(jobFile, JSON.stringify({
      assets: importable.map((r) => {
        const row = manifest.assets.find((a) => a.id === r.id);
        return { id: r.id, path: join(REPO, r.file.replace(/\//g, "\\")), format: row.format, source_id: r.source_id };
      }),
    }, null, 2));
    console.log(`\n=== import test: ${importable.length} model(s) in ONE Blender process ===`);
    const t0 = Date.now();
    const p = spawnSync(BLENDER, ["-b", "--factory-startup", "-P", IMPORT_TEST, "--", "--job", jobFile, "--out", outFile], {
      cwd: REPO, encoding: "utf8", maxBuffer: 1 << 28,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });
    const secs = (Date.now() - t0) / 1000;
    const logFile = join(CACHE, "import-test.log");
    writeFileSync(logFile, `${p.stdout || ""}\n${p.stderr || ""}`);
    if (!existsSync(outFile)) {
      console.error(`FAIL      the import test produced no ${rel(outFile)} (exit ${p.status}) — see ${rel(logFile)}`);
      process.exit(1);
    }
    const out = JSON.parse(readFileSync(outFile, "utf8"));
    importMeta = { seconds: Number(secs.toFixed(1)), blender: out.blender, exit: p.status, log: rel(logFile) };
    importResults = new Map(out.assets.map((a) => [a.id, a]));
    console.log(`          ${out.assets.filter((a) => a.ok).length}/${out.assets.length} imported OK in ${secs.toFixed(1)} s ` +
      `(Blender ${out.blender})`);
  }
}

for (const res of results) {
  const t = importResults.get(res.id);
  if (!t) continue;
  res.import = t;
  if (!t.ok && !res.broken) {
    res.broken = { stage: "import", error: t.error || "imported with no mesh data" };
    console.log(`  BROKEN  ${res.id}: import — ${res.broken.error}`);
  }
}

// ────────────────────────────────────────────── seal `broken` into the shared manifest rows
let brokenCount = 0;
for (const res of results) {
  const row = manifest.assets.find((a) => a.id === res.id);
  if (res.broken) {
    brokenCount++;
    if (SEAL) row.broken = { ...res.broken, detected: new Date().toISOString().slice(0, 10), by: "fetch.mjs T12" };
  } else if (SEAL && row.broken) {
    delete row.broken;   // it fetched and imported this time — the old failure is history
  }
}

if (SEAL) {
  // ⛔ same indent, same (absent) trailing newline as the authored file: the diff is the new facts only
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2), "utf8");
  console.log(`\n          sealed ${rel(MANIFEST)} (sha256 filled${brokenCount ? ` + ${brokenCount} broken row(s)` : ""})`);
}

// ──────────────────────────────────────────────────────────────────────── the report
const report = {
  generator: { script: "catalog/fetch.mjs", version: VERSION, node: process.version,
    generated_utc: new Date().toISOString().replace(/\.\d+Z$/, "+00:00"),
    mode: SEAL ? (RESEAL ? "reseal" : "seal") : VERIFY_ONLY ? "verify-only" : "verify" },
  manifest: { file: rel(MANIFEST), rows: manifest.assets.length, fetched_rows: results.length,
    sha256_after: sha256(Buffer.from(readFileSync(MANIFEST))) },
  totals: {
    bytes_on_disk: bytesTotal, bytes_downloaded_this_run: downloadedBytes,
    files: results.reduce((a, r) => a + (r.bytes ? 1 : 0) + r.extra_files.length, 0),
    ok: results.filter((r) => !r.broken).length, broken: brokenCount,
  },
  packs: [...packCache.entries()].map(([id, p]) => ({ source_id: id, error: p.error || null,
    sha256: p.sha256 || null, bytes: p.bytes || null, entries: p.names ? p.names.length : null,
    sha256_matches_manifest: p.sha256_matches_manifest ?? null })),
  import_test: importMeta,
  assets: results.map((r) => ({ ...r, pack: r.pack ? { ...r.pack } : undefined })),
};
writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, "utf8");

// ─────────────────────────────────────────────────────────────────────────── the verdict
console.log(`\n${"=".repeat(96)}`);
console.log(`fetched   ${report.totals.ok}/${results.length} rows OK · ${report.totals.files} files · ` +
  `${human(bytesTotal)} on disk · ${human(downloadedBytes)} downloaded this run`);
if (brokenCount) {
  console.log(`BROKEN    ${brokenCount} row(s):`);
  for (const r of results.filter((x) => x.broken)) console.log(`            ${r.id}  [${r.broken.stage}] ${r.broken.error}`);
}
for (const p of hashProblems) console.log(`HASH      ${p}`);
console.log(`report    ${rel(REPORT)}`);
if (hashProblems.length) { console.log("FAIL      hash verification failed"); process.exit(1); }
console.log(brokenCount ? `OK (with ${brokenCount} broken row(s) recorded)` : "OK");
process.exit(0);
