// Where a plan PDF may come from (contract §2, §4): only from a folder of `config.inbox`, after `..`
// and symlinks are resolved; it must start with `%PDF-` and be at most 20 MB. A failure carries one
// of the contract's reason codes.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { toPosix } from './lib/paths.mjs';

export const MAX_PDF_BYTES = 20 * 1024 * 1024;
export const PDF_MAGIC = '%PDF-';

export class EngineError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const norm = (p) => {
  const s = toPosix(p).replace(/(.)\/+$/, '$1');
  return process.platform === 'win32' ? s.toLowerCase() : s;
};

// The real path of a folder or file, or null when it does not exist.
function real(p) {
  try {
    return toPosix(fs.realpathSync.native(p));
  } catch {
    return null;
  }
}

export function isInside(child, parent) {
  const c = norm(child);
  const p = norm(parent);
  return c === p || c.startsWith(p.endsWith('/') ? p : `${p}/`);
}

// The allowed folder (real path) that holds `file`, or null.
export function allowedRoot(file, inbox) {
  for (const root of inbox) {
    const r = real(root);
    if (r && isInside(file, r)) return r;
  }
  return null;
}

// Check a pdf_path; returns { path (real, forward slashes), name, bytes } or throws EngineError.
// The answer for an upload that is there and cannot be read right now. Every place that reads the upload uses it.
export const UPLOAD_UNREADABLE = 'the file cannot be read at this moment (another program holds it, or access is denied); ask again';

export function checkPdfPath(pdfPath, config) {
  if (typeof pdfPath !== 'string' || pdfPath.trim() === '') throw new EngineError('PATH_NOT_ALLOWED', 'pdf_path is empty');
  if (pdfPath.includes('\0')) throw new EngineError('PATH_NOT_ALLOWED', 'pdf_path holds a NUL character');
  const resolved = path.resolve(config.home, pdfPath);
  // Not there, or there and not to be resolved (access is denied, another program holds it)? The second is not
  // "no such file": it cannot be read at this moment.
  let r = null;
  let unreadable = false;
  try {
    r = toPosix(fs.realpathSync.native(resolved));
  } catch (e) {
    unreadable = e?.code !== 'ENOENT' && e?.code !== 'ENOTDIR';
  }
  // A path that does not exist is judged by where it points; one that exists, by where it really is.
  const where = r || toPosix(resolved);
  if (!allowedRoot(where, config.inbox)) {
    throw new EngineError('PATH_NOT_ALLOWED', 'pdf_path is outside the allowed upload folders');
  }
  if (!r) throw new EngineError('NOT_A_PDF', unreadable ? UPLOAD_UNREADABLE : 'no such file');
  const st = fs.statSync(r);
  if (!st.isFile()) throw new EngineError('NOT_A_PDF', 'not a file');
  if (st.size > MAX_PDF_BYTES) throw new EngineError('FILE_TOO_LARGE', `the file is ${st.size} bytes; the limit is ${MAX_PDF_BYTES}`);
  const fd = fs.openSync(r, 'r');
  const head = Buffer.alloc(PDF_MAGIC.length);
  try {
    fs.readSync(fd, head, 0, head.length, 0);
  } finally {
    fs.closeSync(fd);
  }
  if (head.toString('latin1') !== PDF_MAGIC) throw new EngineError('NOT_A_PDF', 'the file does not start with %PDF-');
  return { path: r, name: path.basename(resolved), bytes: st.size };
}

export function sha256Buffer(buf) {
  return createHash('sha256').update(buf).digest('hex');
}
