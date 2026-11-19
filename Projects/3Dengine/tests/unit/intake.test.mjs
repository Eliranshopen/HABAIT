// The intake on a real disk (contract 1.1 §3, §4): a verified, read-only copy of the PDF in the job
// folder, safe to repeat, never over a foreign file; verifyInput says whether it is still that PDF.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { intakePdf, verifyInput, inputFile, INPUT_REL } from '../../engine/stages/intake.mjs';
import { EngineError } from '../../engine/inbox.mjs';
import { tempDir, writeFile, PDF_BYTES } from '../helpers/fakes.mjs';

const ID = 'abcdef0123456789';
const sha = (b) => createHash('sha256').update(b).digest('hex');
const dirs = [];
after(() => {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
});

// A temp home with a source PDF; returns the paths and the source's hash.
function setup(bytes = PDF_BYTES) {
  const home = tempDir('intake-');
  dirs.push(home);
  const src = `${home}/inbox/plan.pdf`;
  writeFile(src, bytes);
  const jobsDir = `${home}/jobs`;
  return { home, src, jobsDir, sha256: sha(Buffer.from(bytes)), target: inputFile(jobsDir, ID), inputDir: `${jobsDir}/${ID}/input` };
}

const temps = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.tmp')) : []);
const isReadOnly = (f) => (fs.statSync(f).mode & 0o222) === 0;
const errOf = (fn) => {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return null;
};

test('the copy has the source bytes and hash, is read-only; the source is untouched', () => {
  const s = setup();
  const r = intakePdf(s.jobsDir, ID, { path: s.src, bytes: PDF_BYTES.length }, s.sha256);
  assert.equal(r.copied, true);
  assert.equal(r.sha256, s.sha256);
  assert.equal(r.bytes, PDF_BYTES.length);
  assert.equal(r.path, s.target);
  assert.ok(r.path.endsWith(`/${ID}/${INPUT_REL}`));
  assert.ok(!r.path.includes('\\'));
  assert.equal(fs.readFileSync(s.target, 'utf8'), PDF_BYTES);
  assert.ok(isReadOnly(s.target));
  assert.throws(() => fs.writeFileSync(s.target, 'x'));
  assert.throws(() => fs.appendFileSync(s.target, 'x'));
  assert.equal(fs.readFileSync(s.target, 'utf8'), PDF_BYTES);
  assert.deepEqual(temps(s.inputDir), []);
  // the source itself: same bytes, still writable
  assert.equal(fs.readFileSync(s.src, 'utf8'), PDF_BYTES);
  assert.equal(isReadOnly(s.src), false);
  fs.appendFileSync(s.src, '');
  assert.deepEqual(verifyInput(s.jobsDir, { job_id: ID, input: { pdf_sha256: s.sha256 } }), { ok: true });
});

test('a second call copies nothing and leaves the file as it is; a lost read-only mark comes back', () => {
  const s = setup();
  const src = { path: s.src, bytes: PDF_BYTES.length };
  intakePdf(s.jobsDir, ID, src, s.sha256);
  const before = fs.statSync(s.target).mtimeMs;
  const r = intakePdf(s.jobsDir, ID, src, s.sha256);
  assert.deepEqual(r, { path: s.target, bytes: PDF_BYTES.length, sha256: s.sha256, copied: false });
  assert.equal(fs.statSync(s.target).mtimeMs, before);
  assert.equal(fs.readFileSync(s.target, 'utf8'), PDF_BYTES);

  fs.chmodSync(s.target, 0o666);
  assert.equal(isReadOnly(s.target), false);
  assert.equal(intakePdf(s.jobsDir, ID, src, s.sha256).copied, false);
  assert.ok(isReadOnly(s.target));
  assert.equal(fs.statSync(s.target).mtimeMs, before);
  assert.deepEqual(temps(s.inputDir), []);
});

test('the source changed after the caller hashed it → NOT_A_PDF, nothing in place, no temp file', () => {
  const s = setup();
  fs.writeFileSync(s.src, `${PDF_BYTES}changed\n`);
  const e = errOf(() => intakePdf(s.jobsDir, ID, { path: s.src, bytes: PDF_BYTES.length }, s.sha256));
  assert.ok(e instanceof EngineError);
  assert.equal(e.code, 'NOT_A_PDF');
  assert.match(e.message, /changed while it was being read/);
  assert.equal(fs.existsSync(s.target), false);
  assert.deepEqual(temps(s.inputDir), []);
});

test('the bytes read are not the ones that were hashed (injected read) → NOT_A_PDF, nothing written, no temp file', () => {
  const s = setup();
  const written = [];
  const e = errOf(() => intakePdf(s.jobsDir, ID, { path: s.src, bytes: PDF_BYTES.length }, s.sha256, {
    read: () => Buffer.from('%PDF-1.4 other bytes\n', 'latin1'),
    write: (to) => written.push(to),
  }));
  assert.equal(e?.code, 'NOT_A_PDF');
  assert.match(e.message, /changed while it was being read/);
  assert.deepEqual(written, [], 'nothing is written when the bytes are not the ones that were hashed');
  assert.equal(fs.existsSync(s.target), false);
  assert.deepEqual(temps(s.inputDir), []);
});

test('a write that fails half-way leaves no temp file and the failure is passed on; the copy goes to a temp file beside the target', () => {
  const s = setup();
  let wrote = null;
  const write = (to) => {
    wrote = to;
    fs.writeFileSync(to, '%PDF-half');
    throw Object.assign(new Error('disk full'), { code: 'ENOSPC' });
  };
  const e = errOf(() => intakePdf(s.jobsDir, ID, { path: s.src, bytes: 1 }, s.sha256, { write }));
  assert.equal(e?.code, 'ENOSPC');
  assert.ok(wrote.startsWith(`${s.inputDir}/source.pdf.`) && wrote.endsWith('.tmp'), 'it writes to a temp file beside the target');
  assert.equal(fs.existsSync(s.target), false);
  assert.deepEqual(temps(s.inputDir), []);
  // a source that does not exist (the real read)
  const gone = errOf(() => intakePdf(s.jobsDir, ID, { path: `${s.home}/inbox/none.pdf`, bytes: 1 }, s.sha256));
  assert.equal(gone?.code, 'NOT_A_PDF');
  assert.match(gone.message, /the file is gone/);
  assert.deepEqual(temps(s.inputDir), []);
});

test('a foreign input/source.pdf is never overwritten → NOT_A_PDF naming the job', () => {
  const s = setup();
  const foreign = Buffer.from('%PDF-1.7 somebody else\n\x00\xff');
  writeFile(s.target, foreign);
  const e = errOf(() => intakePdf(s.jobsDir, ID, { path: s.src, bytes: PDF_BYTES.length }, s.sha256));
  assert.equal(e?.code, 'NOT_A_PDF');
  assert.ok(e.message.includes(ID), e.message);
  assert.match(e.message, /already holds another file/);
  assert.ok(fs.readFileSync(s.target).equals(foreign), 'the foreign file is byte for byte as it was');
  assert.deepEqual(fs.readdirSync(s.inputDir), ['source.pdf']);
});

test('O-5: a folder at input/source.pdf → NOT_A_PDF naming the job; nothing is overwritten or removed', () => {
  const s = setup();
  fs.mkdirSync(s.target, { recursive: true });
  writeFile(`${s.target}/inside.txt`, 'somebody else');
  const e = errOf(() => intakePdf(s.jobsDir, ID, { path: s.src, bytes: PDF_BYTES.length }, s.sha256));
  assert.ok(e instanceof EngineError, String(e));
  assert.equal(e.code, 'NOT_A_PDF');
  assert.ok(e.message.includes(ID), e.message);
  assert.match(e.message, /already holds something that is not a file as its input \(input\/source\.pdf\); it is never overwritten/);
  assert.ok(!e.message.includes(s.home), 'no local path in the message');
  assert.ok(fs.statSync(s.target).isDirectory());
  assert.equal(fs.readFileSync(`${s.target}/inside.txt`, 'utf8'), 'somebody else');
  assert.deepEqual(fs.readdirSync(s.inputDir), ['source.pdf']);
});

test('O-5: input is a file, not a folder → NOT_A_PDF naming the job; the file is left as it was', () => {
  const s = setup();
  writeFile(s.inputDir, 'not a folder');
  const e = errOf(() => intakePdf(s.jobsDir, ID, { path: s.src, bytes: PDF_BYTES.length }, s.sha256));
  assert.ok(e instanceof EngineError, String(e));
  assert.equal(e.code, 'NOT_A_PDF');
  assert.ok(e.message.includes(ID), e.message);
  assert.match(e.message, /not a folder where its input folder \(input\) belongs; it is never overwritten/);
  assert.ok(!e.message.includes(s.home), 'no local path in the message');
  assert.equal(fs.readFileSync(s.inputDir, 'utf8'), 'not a folder');
  assert.deepEqual(fs.readdirSync(`${s.jobsDir}/${ID}`), ['input']);
});

test('stale temp files of dead processes do not stop the intake and are cleared; a live one is kept', () => {
  const s = setup();
  fs.mkdirSync(s.inputDir, { recursive: true });
  const ownStale = `${s.inputDir}/source.pdf.${process.pid}.tmp`;
  const dead = `${s.inputDir}/source.pdf.2147480000.tmp`;
  const live = `${s.inputDir}/source.pdf.${process.ppid}.tmp`;
  for (const f of [ownStale, dead, live]) fs.writeFileSync(f, 'half a copy');
  const r = intakePdf(s.jobsDir, ID, { path: s.src, bytes: PDF_BYTES.length }, s.sha256);
  assert.equal(r.copied, true);
  assert.equal(fs.readFileSync(s.target, 'utf8'), PDF_BYTES);
  assert.deepEqual(fs.readdirSync(s.inputDir).sort(), ['source.pdf', `source.pdf.${process.ppid}.tmp`].sort());
});

test('D-3: a folder at the intake\'s own temp name → NOT_A_PDF naming the job; the folder is never removed', () => {
  const s = setup();
  const own = `${s.inputDir}/source.pdf.${process.pid}.tmp`;
  fs.mkdirSync(own, { recursive: true });
  writeFile(`${own}/inside.txt`, 'somebody else');
  const e = errOf(() => intakePdf(s.jobsDir, ID, { path: s.src, bytes: PDF_BYTES.length }, s.sha256));
  assert.ok(e instanceof EngineError, String(e));
  assert.equal(e.code, 'NOT_A_PDF');
  assert.ok(e.message.includes(ID), e.message);
  assert.match(e.message, /not a file at the intake's temp name \(input\/source\.pdf\.\d+\.tmp\); it is never removed/);
  assert.ok(!e.message.includes(s.home), 'no local path in the message');
  assert.ok(fs.statSync(own).isDirectory());
  assert.equal(fs.readFileSync(`${own}/inside.txt`, 'utf8'), 'somebody else');
  assert.equal(fs.existsSync(s.target), false);
  // a FOLDER at a dead process's temp name is not ours to remove either; the intake goes on beside it
  const s2 = setup();
  const dead = `${s2.inputDir}/source.pdf.2147480000.tmp`;
  fs.mkdirSync(dead, { recursive: true });
  writeFile(`${dead}/inside.txt`, 'x');
  assert.equal(intakePdf(s2.jobsDir, ID, { path: s2.src, bytes: 1 }, s2.sha256, { alive: () => false }).copied, true);
  assert.equal(fs.readFileSync(`${dead}/inside.txt`, 'utf8'), 'x');
});

test('an injected liveness check decides which left-over temp files go', () => {
  const s = setup();
  fs.mkdirSync(s.inputDir, { recursive: true });
  fs.writeFileSync(`${s.inputDir}/source.pdf.12345.tmp`, 'x');
  fs.writeFileSync(`${s.inputDir}/notes.txt`, 'not ours');
  intakePdf(s.jobsDir, ID, { path: s.src, bytes: 1 }, s.sha256, { alive: () => false });
  assert.deepEqual(fs.readdirSync(s.inputDir).sort(), ['notes.txt', 'source.pdf']);
});

test('verifyInput: ok, missing, changed by hand, absent or malformed hash; it writes nothing', () => {
  const s = setup();
  intakePdf(s.jobsDir, ID, { path: s.src, bytes: PDF_BYTES.length }, s.sha256);
  const job = { job_id: ID, input: { pdf_sha256: s.sha256 } };
  const list = () => fs.readdirSync(`${s.jobsDir}/${ID}`, { recursive: true }).sort();
  const before = list();
  const mtime = fs.statSync(s.target).mtimeMs;
  assert.deepEqual(verifyInput(s.jobsDir, job), { ok: true });
  assert.deepEqual(verifyInput(s.jobsDir, { job_id: ID }), { ok: false, why: 'changed' });
  assert.deepEqual(verifyInput(s.jobsDir, { job_id: ID, input: {} }), { ok: false, why: 'changed' });
  assert.deepEqual(verifyInput(s.jobsDir, { job_id: ID, input: { pdf_sha256: 'abc' } }), { ok: false, why: 'changed' });
  assert.deepEqual(verifyInput(s.jobsDir, { job_id: ID, input: { pdf_sha256: s.sha256.toUpperCase() } }), { ok: false, why: 'changed' });
  assert.deepEqual(list(), before);
  assert.equal(fs.statSync(s.target).mtimeMs, mtime);
  assert.ok(isReadOnly(s.target), 'the check did not touch the mark');

  // changed by hand: the mark taken off, one byte changed
  fs.chmodSync(s.target, 0o666);
  const b = fs.readFileSync(s.target);
  b[b.length - 2] ^= 1;
  fs.writeFileSync(s.target, b);
  assert.deepEqual(verifyInput(s.jobsDir, job), { ok: false, why: 'changed' });

  fs.rmSync(s.target);
  assert.deepEqual(verifyInput(s.jobsDir, job), { ok: false, why: 'missing' });
  // a folder where the file should be is not the input either
  fs.mkdirSync(s.target);
  assert.deepEqual(verifyInput(s.jobsDir, job), { ok: false, why: 'missing' });
  // no job folder at all
  assert.deepEqual(verifyInput(s.jobsDir, { job_id: 'ffffffffffffffff', input: { pdf_sha256: s.sha256 } }), { ok: false, why: 'missing' });
});

test('a job folder holding the read-only copy can be removed', () => {
  const s = setup();
  intakePdf(s.jobsDir, ID, { path: s.src, bytes: PDF_BYTES.length }, s.sha256);
  assert.ok(isReadOnly(s.target));
  fs.rmSync(`${s.jobsDir}/${ID}`, { recursive: true, force: true });
  assert.equal(fs.existsSync(`${s.jobsDir}/${ID}`), false);
});

test('a few MB PDF is copied and verified', () => {
  const big = Buffer.alloc(5 * 1024 * 1024 + 123);
  for (let i = 0; i < big.length; i++) big[i] = (i * 2654435761) >>> 24;
  big.write('%PDF-1.7\n', 0);
  const s = setup(big);
  const r = intakePdf(s.jobsDir, ID, { path: s.src, bytes: big.length }, s.sha256);
  assert.equal(r.copied, true);
  assert.equal(r.bytes, big.length);
  assert.ok(fs.readFileSync(s.target).equals(big));
  assert.deepEqual(verifyInput(s.jobsDir, { job_id: ID, input: { pdf_sha256: s.sha256 } }), { ok: true });
});

// QA round 3, D-1, and round 4, D-1: every read of the upload answers NOT_A_PDF when it fails, the intake's included.
// The intake reads the upload in one step and writes the job's copy in another, so it never has to guess whose
// failure it was (round 4: an upload that had become a FOLDER was blamed on the job folder).
test('QA rounds 3 and 4: the intake\'s read of the upload fails → NOT_A_PDF (held, a folder, gone); a failed write of the copy is the job folder\'s', () => {
  const UNREADABLE = 'the file cannot be read at this moment (another program holds it, or access is denied); ask again';
  // Another program holds the upload.
  {
    const s = setup();
    const busy = Object.assign(new Error('EBUSY: resource busy or locked, open'), { code: 'EBUSY' });
    const e = errOf(() => intakePdf(s.jobsDir, ID, { path: s.src }, s.sha256, { read: () => { throw busy; } }));
    assert.ok(e instanceof EngineError, String(e));
    assert.equal(e.code, 'NOT_A_PDF');
    assert.equal(e.message, UNREADABLE);
    assert.equal(fs.existsSync(s.target), false, 'nothing was put in place');
    assert.deepEqual(temps(s.inputDir), [], 'no temp file left');
  }
  // The upload became a folder after it was hashed (real files; the fourth reviewer's case).
  {
    const s = setup();
    fs.rmSync(s.src);
    fs.mkdirSync(s.src);
    const e = errOf(() => intakePdf(s.jobsDir, ID, { path: s.src }, s.sha256));
    assert.ok(e instanceof EngineError, String(e));
    assert.equal(e.code, 'NOT_A_PDF');
    assert.equal(e.message, UNREADABLE);
    assert.ok(fs.statSync(s.src).isDirectory(), 'the folder is left as it is');
    assert.equal(fs.existsSync(s.target), false);
    assert.deepEqual(temps(s.inputDir), []);
  }
  // The upload went away after it was hashed.
  {
    const s = setup();
    fs.rmSync(s.src);
    const e = errOf(() => intakePdf(s.jobsDir, ID, { path: s.src }, s.sha256));
    assert.equal(e?.code, 'NOT_A_PDF');
    assert.equal(e.message, 'the file is gone');
  }
  // The job folder is the trouble (the disk is full): the error leaves as it is, and the tool turns it into its
  // answer for the job folder.
  {
    const s = setup();
    const full = Object.assign(new Error('ENOSPC: no space left on device, write'), { code: 'ENOSPC' });
    const e = errOf(() => intakePdf(s.jobsDir, ID, { path: s.src }, s.sha256, { write: () => { throw full; } }));
    assert.equal(e, full);
    assert.equal(fs.existsSync(s.target), false);
    assert.deepEqual(temps(s.inputDir), []);
  }
});
