// The engine's store of KEPT readings (contract 1.4 §1, §2). A reading is what the vision model read from the
// drawing of a PDF (room labels, fixed elements, printed dimensions): the one part of reading a drawing that
// costs money and that the model does not give twice the same. The engine keeps one per PDF, so the same PDF is
// read by the model once.
//
//   <readingsDir>/<sha256 of the PDF>/reading.json   the reading, byte for byte as the reading tool wrote it
//   <readingsDir>/<sha256 of the PDF>/record.json    whose it is, its hash, the reader that made it, when, the cost,
//                                                    and the day written into the plan traced from it
//   <readingsDir>/<sha256 of the PDF>/superseded/<n>/ a pair that a later reading replaced: never destroyed
//
// Three rules live here:
//   1. A kept reading is used only when its record adds up with the file beside it and names this PDF (the record
//      is checked, never believed), and when the READER that made it is today's: the reading tool and the file
//      that names the model. A new engine version does not make a reading stale; a changed reader does (Eliran,
//      2026-11-18).
//   2. A reading that was paid for is never destroyed: a pair that is replaced is moved aside first.
//   3. Nothing of a reading's text is returned, thrown or logged: statuses, numbers, dates, hashes, paths.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { EngineError } from './inbox.mjs';
import { ENGINE_VERSION } from './config.mjs';
import { toolPath, isInstant, isDate } from './trace.mjs';
import { withFileLock, RETRY } from './lib/atomic.mjs';
import { sleepSync } from './lib/proc.mjs';

export const READING_SCHEMA = 'habait/reading.v1';
export const SOURCES = Object.freeze(['paid', 'imported']);
export const MAX_COST_USD = 1000;

const SHA256_RE = /^[0-9a-f]{64}$/;
const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._/:-]{0,79}$/;       // shaped like a model id: never a sentence
const VERSION_RE = /^\d+\.\d+\.\d+$/;
const SUPERSEDED_RE = /^[1-9]\d{0,8}$/;

const fwd = (p) => String(p).replace(/\\/g, '/');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const isCost = (v) => v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_COST_USD);

// What the store throws for a caller's mistake or for a folder it cannot use. `code`: NOT_A_READING, STORE.
export class ReadingError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ReadingError';
    this.code = code;
  }
}

export const readingDir = (config, pdfSha256) => `${fwd(config.readingsDir)}/${pdfSha256}`;
export const readingFile = (config, pdfSha256) => `${readingDir(config, pdfSha256)}/reading.json`;
export const recordFile = (config, pdfSha256) => `${readingDir(config, pdfSha256)}/record.json`;
export const modelFilePath = (config) => `${fwd(config.pipelineRoot)}/Habait/tour360/server/handler.mjs`;

// Is this parsed JSON a reading? An object with a list of rooms.
export const isReading = (doc) => Boolean(doc) && typeof doc === 'object' && !Array.isArray(doc) && Array.isArray(doc.rooms);

// The reader that makes a reading TODAY (contract 1.4 §2): the sha256 of the reading tool and of the file that
// names the model, read from the disk at every question.
export function readerOf(config, fs_ = fs) {
  try {
    return { tool_sha256: sha(fs_.readFileSync(toolPath(config))), model_file_sha256: sha(fs_.readFileSync(modelFilePath(config))) };
  } catch {
    throw new EngineError('TOOLCHAIN_MISSING', 'the reading tool, or the file that names its model, is not in the pipeline folder');
  }
}

const isReader = (r) => Boolean(r) && typeof r === 'object' && !Array.isArray(r)
  && Object.keys(r).sort().join(',') === 'model_file_sha256,tool_sha256' && SHA256_RE.test(r.tool_sha256) && SHA256_RE.test(r.model_file_sha256);
export const sameReader = (a, b) => isReader(a) && isReader(b) && a.tool_sha256 === b.tool_sha256 && a.model_file_sha256 === b.model_file_sha256;

const RECORD_KEYS = 'cost_usd,engine_version,model,pdf_sha256,plan_date,read_at,reader,reading_bytes,reading_sha256,saved_at,schema,source';

// Is this a record of the contract, for this PDF? Every field, by its type: a record is checked, never believed.
export function isRecord(rec, pdfSha256) {
  return Boolean(rec) && typeof rec === 'object' && !Array.isArray(rec)
    && Object.keys(rec).sort().join(',') === RECORD_KEYS
    && rec.schema === READING_SCHEMA
    && rec.pdf_sha256 === pdfSha256
    && typeof rec.reading_sha256 === 'string' && SHA256_RE.test(rec.reading_sha256)
    && Number.isInteger(rec.reading_bytes) && rec.reading_bytes > 0
    && isReader(rec.reader)
    && isInstant(rec.read_at) && isInstant(rec.saved_at) && isDate(rec.plan_date)
    && SOURCES.includes(rec.source)
    && isCost(rec.cost_usd)
    && (rec.model === null || (typeof rec.model === 'string' && MODEL_RE.test(rec.model)))
    && typeof rec.engine_version === 'string' && VERSION_RE.test(rec.engine_version);
}

// What a caller may know of a record: numbers, dates, fixed words, a model id. No text of the reading.
// `date` is the day a plan traced from this reading carries (plan_date): what a later run hands the reading tool.
const summaryOf = (rec) => ({ readAt: rec.read_at, date: rec.plan_date, savedAt: rec.saved_at, source: rec.source,
  costUsd: rec.cost_usd, model: rec.model, engineVersion: rec.engine_version, readingSha256: rec.reading_sha256 });

// A file's bytes; null when it is not there; undefined when something else is there (a folder, a file that cannot be read).
function bytesOf(fs_, file) {
  try {
    return fs_.readFileSync(file);
  } catch (e) {
    return e?.code === 'ENOENT' ? null : undefined;
  }
}

// The pair in a PDF's folder, as it is on the disk, whoever the reader was.
// → { state: 'none' } | { state: 'bad' } | { state: 'pair', record }
function pairOf(config, pdfSha256, fs_) {
  let st;
  try {
    st = fs_.statSync(readingDir(config, pdfSha256));
  } catch (e) {
    return e?.code === 'ENOENT' || e?.code === 'ENOTDIR' ? { state: 'none' } : { state: 'bad' };
  }
  if (!st.isDirectory()) return { state: 'bad' };                   // a file where the folder belongs (the layout of 1.3)
  const recBytes = bytesOf(fs_, recordFile(config, pdfSha256));
  const bytes = bytesOf(fs_, readingFile(config, pdfSha256));
  if (recBytes === null && bytes === null) return { state: 'none' };  // nothing kept (the folder may hold superseded pairs)
  if (!recBytes || !bytes) return { state: 'bad' };                 // one of the two, or something that is not a file
  let record;
  let doc;
  try {
    record = JSON.parse(recBytes.toString('utf8'));
    doc = JSON.parse(bytes.toString('utf8'));
  } catch {
    return { state: 'bad' };
  }
  if (!isRecord(record, pdfSha256) || !isReading(doc)) return { state: 'bad' };
  if (record.reading_bytes !== bytes.length || record.reading_sha256 !== sha(bytes)) return { state: 'bad' };
  return { state: 'pair', record };
}

// The kept reading of a PDF (contract 1.4 §1).
// → { status: 'found', file, record } | { status: 'stale', record } | { status: 'none' } | { status: 'bad' }
// `record` is the summary above. Throws TOOLCHAIN_MISSING when a pair adds up and today's reader cannot be read.
export function findReading(config, pdfSha256, deps = {}) {
  const fs_ = deps.fs || fs;
  if (typeof pdfSha256 !== 'string' || !SHA256_RE.test(pdfSha256)) return { status: 'none' };
  const pair = pairOf(config, pdfSha256, fs_);
  if (pair.state !== 'pair') return { status: pair.state };
  const today = deps.reader || readerOf(config, fs_);
  if (!sameReader(pair.record.reader, today)) return { status: 'stale', record: summaryOf(pair.record) };
  return { status: 'found', file: readingFile(config, pdfSha256), record: summaryOf(pair.record) };
}

// A rename that waits out a passing file error (Windows: a scanner holds the file for a moment).
function renameSure(fs_, from, to, waitMs = 3000) {
  const until = Date.now() + waitMs;
  for (;;) {
    try {
      fs_.renameSync(from, to);
      return;
    } catch (e) {
      if (!RETRY.has(e.code) || Date.now() >= until) throw e;
      sleepSync(5);
    }
  }
}

// What a reading says its own call cost (the reading tool writes it into the reading: `_meta.usd`); null when it
// says nothing that is an amount.
export function readingCost(file, fs_ = fs) {
  try {
    const usd = JSON.parse(fs_.readFileSync(file, 'utf8'))?._meta?.usd;
    return typeof usd === 'number' && isCost(usd) ? usd : null;
  } catch {
    return null;
  }
}

// How many pairs of this PDF were replaced by a later one.
export function supersededCount(config, pdfSha256, fs_ = fs) {
  try {
    return fs_.readdirSync(`${readingDir(config, pdfSha256)}/superseded`).filter((n) => SUPERSEDED_RE.test(n)).length;
  } catch {
    return 0;
  }
}

// Keep a reading (contract 1.4 §1): the bytes of `readingFile` become the PDF's kept reading, with a record beside it.
// → { kept: true, superseded: n | null, record } | { kept: false, record } (the same bytes by the same reader are there).
// The new pair is written WHOLE, under temp names, before anything the folder held is touched; then the old pair
// is moved into superseded/<n>/, and the new files are renamed into place, the reading first and the record last.
// So a write that fails (a full disk) leaves the old pair where it was. Throws ReadingError for a file that is not a reading and for a folder it
// cannot use; TOOLCHAIN_MISSING when today's reader cannot be read.
export function keepReading(config, { pdfSha256, readingFile: from, source, costUsd = null, planDate = null }, deps = {}) {
  const d = { fs, now: () => new Date().toISOString(), version: ENGINE_VERSION, lockWaitMs: 5000, ...deps };
  if (typeof pdfSha256 !== 'string' || !SHA256_RE.test(pdfSha256)) throw new ReadingError('STORE', 'a reading is kept under the sha256 of its PDF');
  if (!SOURCES.includes(source)) throw new ReadingError('STORE', 'a reading is kept as paid or as imported');
  if (!isCost(costUsd)) throw new ReadingError('STORE', `the cost of a reading is a number from 0 to ${MAX_COST_USD}, or unknown`);
  if (planDate !== null && !isDate(planDate)) throw new ReadingError('STORE', 'the day of the plan must be a real day written YYYY-MM-DD');
  let bytes;
  let doc;
  try {
    bytes = d.fs.readFileSync(from);
    doc = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new ReadingError('NOT_A_READING', 'the file is not a reading: it cannot be read as JSON');
  }
  if (!isReading(doc)) throw new ReadingError('NOT_A_READING', 'the file is not a reading: it has no list of rooms');
  const reader = d.reader || readerOf(config, d.fs);
  const savedAt = d.now();
  const meta = doc._meta && typeof doc._meta === 'object' ? doc._meta : {};
  const record = {
    schema: READING_SCHEMA,
    pdf_sha256: pdfSha256,
    reading_sha256: sha(bytes),
    reading_bytes: bytes.length,
    reader,
    read_at: isInstant(meta.at) ? meta.at : savedAt,             // when the model answered; an import with no date: now
    // The day written into the plan traced from this reading: the caller's (the run that made the reading was
    // handed it), else the day the reading says it was made. Every later run hands the tool this day.
    plan_date: planDate ?? (isInstant(meta.at) ? meta.at : savedAt).slice(0, 10),
    saved_at: savedAt,
    source,
    cost_usd: costUsd,
    model: typeof meta.model === 'string' && MODEL_RE.test(meta.model) ? meta.model : null,
    engine_version: d.version,
  };
  if (!isRecord(record, pdfSha256)) throw new ReadingError('STORE', 'the record of this reading could not be made');
  const dir = readingDir(config, pdfSha256);
  try {
    d.fs.mkdirSync(dir, { recursive: true });
    if (!d.fs.statSync(dir).isDirectory()) throw new Error('not a folder');
  } catch {
    throw new ReadingError('STORE', 'the store holds something that is not a folder where this PDF\'s readings belong; it is never overwritten');
  }
  return withFileLock(`${dir}/store.lock`, () => {
    const have = pairOf(config, pdfSha256, d.fs);
    if (have.state === 'pair' && have.record.reading_sha256 === record.reading_sha256 && sameReader(have.record.reader, reader)) {
      return { kept: false, record: summaryOf(have.record) };
    }
    // The new pair, whole, under temp names: a write that fails here has touched nothing of the old pair.
    const tag = `${process.pid}.${Math.random().toString(16).slice(2, 10)}.tmp`;
    const newReading = `${dir}/reading.json.${tag}`;
    const newRecord = `${dir}/record.json.${tag}`;
    try {
      d.fs.writeFileSync(newReading, bytes);
      d.fs.writeFileSync(newRecord, `${JSON.stringify(record, null, 2)}\n`);
    } catch (e) {
      for (const f of [newReading, newRecord]) d.fs.rmSync(f, { force: true });
      throw e;
    }
    // Whatever is there (a pair, or one file of one) goes aside: a reading that was paid for is never destroyed.
    let superseded = null;
    const old = ['record.json', 'reading.json'].filter((f) => d.fs.existsSync(`${dir}/${f}`));
    if (old.length) {
      const taken = d.fs.existsSync(`${dir}/superseded`) ? d.fs.readdirSync(`${dir}/superseded`).filter((n) => SUPERSEDED_RE.test(n)).map(Number) : [];
      superseded = (taken.length ? Math.max(...taken) : 0) + 1;
      d.fs.mkdirSync(`${dir}/superseded/${superseded}`, { recursive: true });
      for (const f of old) d.fs.renameSync(`${dir}/${f}`, `${dir}/superseded/${superseded}/${f}`);   // the record first: no pair is ever half new
    }
    renameSure(d.fs, newReading, `${dir}/reading.json`);
    renameSure(d.fs, newRecord, `${dir}/record.json`);        // the record last: a pair cut here is `bad`, never `found`
    return { kept: true, superseded, record: summaryOf(record) };
  }, { waitMs: d.lockWaitMs, label: 'the readings store' });
}
