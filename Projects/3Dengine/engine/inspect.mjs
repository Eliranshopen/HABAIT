// The first look at a plan PDF (contract 1.1 §1, §2): the pipeline's own scanner (auto_pages.py scan) run
// with the engine's Python in isolated mode, its pages.json checked and summed up into pages, kind, one row
// per page and the candidates a job may be for. The answer is cached per PDF hash under
// <runtimeDir>/inspect/<sha256>/ and reused only when it names this PDF, this scanner file and these settings.
// The text of the PDF is data: nothing returned, thrown or logged here carries it, nor the scanner's output.
import fs from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { EngineError, sha256Buffer, UPLOAD_UNREADABLE } from './inbox.mjs';
import { run as realRun } from './lib/run.mjs';
import { sha256FileSync } from './lib/hash.mjs';
import { writeJsonAtomic, RETRY } from './lib/atomic.mjs';
import { sleepSync, pidAlive } from './lib/proc.mjs';
import { ENGINE_VERSION, INSPECT_DEFAULTS } from './config.mjs';

export const INSPECT_SCHEMA_ID = 'habait/inspect.v1';
export const SCAN_TOOL = 'Habait/tour360/tools/auto_pages.py'; // under config.pipelineRoot
export { INSPECT_DEFAULTS };   // the defaults live with the settings loader (engine/config.mjs)
export const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const SHA_PATTERN = /^[0-9a-f]{64}$/;
const CONTENTS = ['vector', 'image', 'empty'];

export const inspectDir = (config, sha256) => `${config.runtimeDir}/inspect/${sha256}`;
export const scannerPath = (config) => `${config.pipelineRoot}/${SCAN_TOOL}`;

const isWhole = (n, min = 0) => Number.isSafeInteger(n) && n >= min;
const isPos = (n) => typeof n === 'number' && Number.isFinite(n) && n > 0;
const isObj = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);

// config.inspect over the defaults; a missing or unusable field takes its default.
export function settingsOf(config) {
  const given = isObj(config?.inspect) ? config.inspect : {};
  const out = {};
  for (const [k, d] of Object.entries(INSPECT_DEFAULTS)) {
    const v = given[k];
    out[k] = k === 'timeoutSeconds' ? (isPos(v) ? v : d) : (isWhole(v, 1) ? v : d);
  }
  return out;
}

// Is the scanner's document what auto_pages.py scan writes? (pages, page_rows, and in every row a page
// number in order, a size, a drawing count and images with a whole xref and a pixel size.)
export function validPagesDoc(doc) {
  if (!isObj(doc) || !isWhole(doc.pages, 1) || !Array.isArray(doc.page_rows)) return false;
  if (doc.page_rows.length !== doc.pages) return false;
  return doc.page_rows.every((r, i) => isObj(r) && r.page === i + 1
    && Array.isArray(r.size_pt) && r.size_pt.length === 2 && r.size_pt.every(isPos)
    && isWhole(r.drawings, 0) && Array.isArray(r.images)
    && r.images.every((im) => isObj(im) && isWhole(im.xref, 0)
      && Array.isArray(im.px) && im.px.length === 2 && im.px.every((n) => isWhole(n, 1))));
}

// The summary (contract §1, §2). PURE: the same document and settings give the same answer, and the
// document is not changed. thumbOf(page, xref) → the absolute path of that image's thumbnail, or null.
export function summarize(pagesDoc, { minSidePx, vectorMinPaths, thumbOf = () => null }) {
  const pages = pagesDoc.pages;
  const kind = pages === 1 ? 'sheet' : 'booklet';
  const isLarge = (im) => Math.min(im.px[0], im.px[1]) >= minSidePx;
  const page_rows = pagesDoc.page_rows.map((r) => {
    const vector_paths = r.drawings;
    const large_images = r.images.filter(isLarge).length;
    const content = vector_paths >= vectorMinPaths ? 'vector' : large_images >= 1 ? 'image' : 'empty';
    return { page: r.page, width_pt: r.size_pt[0], height_pt: r.size_pt[1], vector_paths, images: r.images.length, large_images, content };
  });
  const candidates = [];
  if (kind === 'sheet') {
    const row = page_rows[0];
    if (row.content !== 'empty') {
      candidates.push({ id: 'p1', label: 'עמוד 1', page: 1, source: 'page', vector_paths: row.vector_paths, large_images: row.large_images });
    }
  } else {
    for (const r of pagesDoc.page_rows) {
      let k = 0;
      for (const im of r.images) {
        if (!isLarge(im)) continue;
        k += 1;
        const c = { id: `p${r.page}-x${im.xref}`, label: `עמוד ${r.page} · תמונה ${k}`, page: r.page, source: 'image', px: [im.px[0], im.px[1]] };
        const thumb = thumbOf(r.page, im.xref);
        if (typeof thumb === 'string' && thumb) c.thumb = thumb;
        candidates.push(c);
      }
    }
  }
  return { pages, kind, page_rows, candidates };
}

// Does a stored summary have the shape of summarize()'s answer? Only a cheap first check now: readCached
// believes a record when it is exactly the summary rebuilt from the record's own pages.json. Every id, label
// and thumbnail path must still be what summarize() builds (a prefix match let `<dir>/thumb-/../../x` through).
const XREF_OF = /^p([1-9]\d*)-x(0|[1-9]\d*)$/;
const IMAGE_LABEL = /^עמוד ([1-9]\d*) · תמונה [1-9]\d*$/;
function validCandidate(c, pages, dir) {
  if (!isObj(c) || typeof c.id !== 'string' || !ID_PATTERN.test(c.id) || typeof c.label !== 'string') return false;
  if (!isWhole(c.page, 1) || c.page > pages) return false;
  if (c.source === 'page') {
    return c.id === 'p1' && c.page === 1 && c.label === 'עמוד 1' && isWhole(c.vector_paths) && isWhole(c.large_images);
  }
  if (c.source !== 'image') return false;
  const m = XREF_OF.exec(c.id);
  const lab = IMAGE_LABEL.exec(c.label);
  if (!m || Number(m[1]) !== c.page || !Number.isSafeInteger(Number(m[2])) || !lab || Number(lab[1]) !== c.page) return false;
  if (!Array.isArray(c.px) || c.px.length !== 2 || !c.px.every((n) => isWhole(n, 1))) return false;
  return c.thumb === undefined || c.thumb === `${dir}/thumb-p${c.page}-x${m[2]}.jpg`;
}

export function validSummary(s, dir) {
  if (!isObj(s) || !isWhole(s.pages, 1) || !Array.isArray(s.page_rows) || s.page_rows.length !== s.pages) return false;
  if (s.kind !== (s.pages === 1 ? 'sheet' : 'booklet') || !Array.isArray(s.candidates)) return false;
  const rowsOk = s.page_rows.every((r, i) => isObj(r) && r.page === i + 1 && isPos(r.width_pt) && isPos(r.height_pt)
    && isWhole(r.vector_paths) && isWhole(r.images) && isWhole(r.large_images) && r.large_images <= r.images
    && CONTENTS.includes(r.content));
  if (!rowsOk) return false;
  return s.candidates.every((c) => validCandidate(c, s.pages, dir));
}

const thumbName = (page, xref) => `thumb-p${page}-x${xref}.jpg`;

// The summary of <dir>/inspect.json when it is an answer for this PDF, scanner and settings; else null.
// A stored summary is never believed by its shape: it is REBUILT from the scanner's own pages.json that the
// record folder keeps, with the thumbnails that are really there, and reused only when it is exactly that.
// Checking field by field let a key the engine never writes (a thumb on a page candidate, a note), a wrong
// count or an emptied candidate list through, one case at a time. The answer is the rebuilt summary.
function readCached(fs_, dir, { sha256, scannerSha, settings }) {
  let doc;
  let pagesDoc;
  try {
    doc = JSON.parse(fs_.readFileSync(`${dir}/inspect.json`, 'utf8'));
  } catch {
    return null;
  }
  if (!isObj(doc) || doc.schema !== INSPECT_SCHEMA_ID || doc.sha256 !== sha256 || doc.scanner_sha256 !== scannerSha) return null;
  const s = doc.settings;
  if (!isObj(s) || s.minSidePx !== settings.minSidePx || s.vectorMinPaths !== settings.vectorMinPaths) return null;
  if (!validSummary(doc.summary, dir)) return null;   // a cheap first check; what decides is the rebuild below
  try {
    pagesDoc = JSON.parse(fs_.readFileSync(`${dir}/pages.json`, 'utf8'));
  } catch {
    return null;
  }
  if (!validPagesDoc(pagesDoc)) return null;
  const rebuilt = summarize(pagesDoc, {
    minSidePx: settings.minSidePx, vectorMinPaths: settings.vectorMinPaths,
    thumbOf: (page, xref) => (fs_.existsSync(`${dir}/${thumbName(page, xref)}`) ? `${dir}/${thumbName(page, xref)}` : null),
  });
  return isDeepStrictEqual(doc.summary, rebuilt) ? rebuilt : null;
}

let tmpCounter = 0;

const answer = (summary, cached) => ({ pages: summary.pages, kind: summary.kind, page_rows: summary.page_rows, candidates: summary.candidates, cached });

// Look at the PDF at `path` whose hash is `sha256`. → { pages, kind, page_rows, candidates, cached }.
export function inspectPdf(config, { path, sha256 }, deps = {}) {
  const {
    run = realRun, fs: fs_ = fs, hashFile = sha256FileSync, now = () => new Date().toISOString(),
    version = ENGINE_VERSION, log = () => {}, sleep = sleepSync, alive = pidAlive,
    hashBytes = sha256Buffer, writeJson = writeJsonAtomic,
  } = deps;
  if (typeof sha256 !== 'string' || !SHA_PATTERN.test(sha256)) throw new EngineError('NOT_A_PDF', 'the PDF hash is not a sha256');
  if (typeof path !== 'string' || !path) throw new EngineError('NOT_A_PDF', 'no PDF path');
  const settings = settingsOf(config);
  const scanner = scannerPath(config);
  const short = sha256.slice(0, 12);
  if (!config.python || !fs_.existsSync(config.python)) {
    throw new EngineError('TOOLCHAIN_MISSING', `the engine's Python is missing: ${config.python}`);
  }
  if (!fs_.existsSync(scanner)) throw new EngineError('TOOLCHAIN_MISSING', `the scanner is missing: ${scanner}`);
  let scannerSha;
  try {
    scannerSha = hashFile(scanner);
  } catch {
    throw new EngineError('TOOLCHAIN_MISSING', `the scanner cannot be read: ${scanner}`);
  }
  const expect = { sha256, scannerSha, settings: { minSidePx: settings.minSidePx, vectorMinPaths: settings.vectorMinPaths } };
  const dir = inspectDir(config, sha256);

  const hit = readCached(fs_, dir, expect);
  if (hit) {
    log(`inspect ${short}: from the cache`);
    return answer(hit, true);
  }

  // A temp folder of a process that was killed in the middle of a look is nobody's any more: take it away.
  sweepTemps(fs_, `${config.runtimeDir}/inspect`, alive);
  tmpCounter += 1;
  const tmp = `${config.runtimeDir}/inspect/.tmp-${sha256}-${process.pid}-${tmpCounter}`;
  // The look's own folder: the private copy of the PDF beside `out`, and `out` (what the scanner writes)
  // is what becomes the record. The record therefore never holds a copy of the PDF.
  const out = `${tmp}/out`;
  const source = `${tmp}/source.pdf`;
  // Any file error of the engine's own runtime folder (it is a file, it cannot be made or written) is the
  // engine's trouble: TOOLCHAIN_MISSING with no path in it. An EngineError thrown on purpose passes as it is.
  const stored = (fn) => {
    try {
      return fn();
    } catch (e) {
      if (e instanceof EngineError) throw e;
      log(`inspect ${short}: the runtime folder cannot be used (${e.code || 'error'})`);
      throw new EngineError('TOOLCHAIN_MISSING', STORE_FAILED);
    }
  };
  try {
    stored(() => {
      fs_.rmSync(tmp, { recursive: true, force: true });
      fs_.mkdirSync(out, { recursive: true });
    });
    // The upload is read ONCE, and the scanner reads a private copy of exactly those bytes. Hashing the
    // upload before and after the scan cannot see a writer that rewrites it in place with the same bytes:
    // the scanner would read a half-written file while both hashes agree, and the torn look be kept.
    let bytes;
    try {
      bytes = fs_.readFileSync(path);
    } catch (e) {
      // Gone, or there and not readable now (another program holds it, access is denied): both are NOT_A_PDF.
      const gone = e?.code === 'ENOENT';
      log(`inspect ${short}: the file ${gone ? 'went away while it was being read' : `cannot be read (${e?.code || 'error'})`}`);
      throw new EngineError('NOT_A_PDF', gone ? 'the file went away while it was being read' : UPLOAD_UNREADABLE);
    }
    if (hashBytes(bytes) !== sha256) {
      log(`inspect ${short}: the file changed while it was being read`);
      throw new EngineError('NOT_A_PDF', 'the file changed while it was being read');
    }
    stored(() => fs_.writeFileSync(source, bytes));
    bytes = null;   // the copy is on the disk; a large PDF need not stay in memory during the scan
    const args = ['-I', scanner, 'scan', source, out, '--min-side', String(settings.minSidePx)];
    const r = run(config.python, args, { timeoutMs: settings.timeoutSeconds * 1000 });
    if (r.status === -1) {
      if (/ETIMEDOUT/.test(String(r.stderr))) {
        log(`inspect ${short}: timed out after ${settings.timeoutSeconds} s`);
        // The engine cannot tell a very large file from a machine that is busy (a render, another job): the
        // message names both, and a second ask simply scans again.
        throw new EngineError('FILE_TOO_LARGE',
          `the first look did not finish in ${settings.timeoutSeconds} s (a very large file, or this machine is busy); ask again`);
      }
      log(`inspect ${short}: the scanner could not be started`);
      throw new EngineError('TOOLCHAIN_MISSING', `the scanner could not be started with ${config.python}`);
    }
    // The look's own folder went away while the scanner ran (something removed the engine's runtime folder):
    // that is the engine's trouble, not the PDF's, whatever status the scanner ended with.
    if (!fs_.existsSync(out)) {
      log(`inspect ${short}: the runtime folder went away during the scan`);
      throw new EngineError('TOOLCHAIN_MISSING', STORE_FAILED);
    }
    if (r.status !== 0) {
      log(`inspect ${short}: the scanner ended with status ${r.status}`);
      throw new EngineError('NOT_A_PDF', `the scanner could not read the file (status ${r.status})`);
    }
    let doc;
    try {
      doc = JSON.parse(fs_.readFileSync(`${out}/pages.json`, 'utf8'));
    } catch {
      log(`inspect ${short}: no readable pages.json`);
      throw new EngineError('NOT_A_PDF', 'the scanner wrote no readable page list');
    }
    if (!validPagesDoc(doc)) {
      log(`inspect ${short}: pages.json of the wrong shape`);
      throw new EngineError('NOT_A_PDF', 'the scanner wrote a page list of the wrong shape');
    }
    // The scanner read the private copy, whose bytes had the asked hash. The upload itself must still have
    // that hash too: a file that changed (or went away) during the look keeps nothing under its old hash.
    let still = null;
    try {
      still = hashFile(path);
    } catch { /* the file is gone: not the same bytes */ }
    if (still !== sha256) {
      log(`inspect ${short}: the file changed while it was being read`);
      throw new EngineError('NOT_A_PDF', 'the file changed while it was being read');
    }
    const summary = summarize(doc, {
      ...expect.settings,
      thumbOf: (page, xref) => (fs_.existsSync(`${out}/${thumbName(page, xref)}`) ? `${dir}/${thumbName(page, xref)}` : null),
    });
    stored(() => writeJson(`${out}/inspect.json`, {
      schema: INSPECT_SCHEMA_ID, sha256, scanner_sha256: scannerSha, settings: expect.settings,
      engine_version: version, at: now(), summary,
    }));
    const placed = stored(() => place(fs_, out, dir, expect, sleep));
    log(`inspect ${short}: ${summary.pages} page(s), ${summary.kind}, ${summary.candidates.length} candidate(s)`);
    return answer(placed || summary, false);
  } finally {
    try {
      fs_.rmSync(tmp, { recursive: true, force: true });
    } catch { /* best effort; a later look removes nothing of ours */ }
  }
}

// Remove the temp folders (`.tmp-<sha256>-<pid>-<n>`) whose process no longer runs. Best effort.
const TEMP_DIR = /^\.tmp-[0-9a-f]{64}-(\d+)-\d+$/;
function sweepTemps(fs_, root, alive) {
  let names = [];
  try {
    names = fs_.readdirSync(root);
  } catch {
    return;
  }
  for (const name of names) {
    const m = TEMP_DIR.exec(name);
    if (!m || Number(m[1]) === process.pid || alive(Number(m[1]))) continue;
    try {
      fs_.rmSync(`${root}/${name}`, { recursive: true, force: true });
    } catch { /* another look may be removing it at the same moment */ }
  }
}

// Put the finished temp folder in place as `dir`. When another process put a valid answer there first,
// that answer is returned (and the temp folder is removed by the caller); a stale folder is replaced.
// Returns the summary to use instead of ours, or null when ours is now in place.
// A look that cannot be stored is the engine's own trouble (its runtime folder), not the PDF's.
const STORE_FAILED = "the first look could not be stored in the engine's runtime folder";
function place(fs_, tmp, dir, expect, sleep) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      fs_.renameSync(tmp, dir);
      return null;
    } catch (e) {
      const there = fs_.existsSync(dir);
      if (there) {
        const theirs = readCached(fs_, dir, expect);
        if (theirs) return theirs;
        fs_.rmSync(dir, { recursive: true, force: true });
      } else if (!RETRY.has(e.code)) {
        throw new EngineError('TOOLCHAIN_MISSING', STORE_FAILED);
      }
      if (attempt >= 20) throw new EngineError('TOOLCHAIN_MISSING', STORE_FAILED);
      sleep(Math.min(50, 5 * (attempt + 1)));
    }
  }
}
