/* Habait developer portal (plan development/plans/2026-11-04-developer-platform.md, P0) — the shared server side of /api/studio-*.
   Files prefixed with "_" are not routes on Vercel; stage_flow.py --studio copies this folder to the deploy's /api.
   - Who: a Clerk session token (Authorization: Bearer …) verified with CLERK_SECRET_KEY; the user id is the Clerk `sub`.
   - Where: the storage adapter _store.mjs — Supabase Storage, private bucket `studio` (since 2026-11-05, the Blob store's
     suspension), or the PRIVATE Vercel Blob store `habait-studio` with STORE=blob — one prefix per developer:
       studio/u/<uid>/p/<pid>/meta.json      name, created, state of each step
       studio/u/<uid>/p/<pid>/files/<name>   the developer's uploads (sales plan PDF, brochure, price list, images)
       studio/u/<uid>/p/<pid>/spec.json      what the agent read from the files (the intake schema of Habait/studio)
       studio/u/<uid>/p/<pid>/chat.json      the conversation with the agent
       studio/u/<uid>/p/<pid>/ledger.json    every paid call, written BEFORE it runs and closed after it (root §7)
       studio/u/<uid>/p/<pid>/files.json     the index of files/ (fork E, 2026-11-05) — read instead of a list()
       studio/u/<uid>/projects.json          the index of the developer's projects — read instead of a list()
       studio/jobs/<jobId>.json              { jobPath } — find a job by id without a list()
   Secrets travel by NAME only (root §8.1): nothing here logs, prints or returns a key.

   BLOB OPERATIONS ARE A QUOTA (2026-11-05: the store was suspended, "limits-exceeded-suspended", at 246 MB / 612 objects — the
   Hobby OPERATIONS quota, not storage). put() and list() are ADVANCED operations, a read with useCache:false is a SIMPLE one.
   So: no list() on a hot path (an index document instead), a page poll reads one document, and every operation is counted
   (OPS, returned as the x-blob-ops header of every response). */
import { verifyToken } from '@clerk/backend';
import { openStore, storeKind } from './_store.mjs';

// the storage adapter (fork G, 2026-11-05): Supabase Storage since the Blob store's suspension, the Blob store with STORE=blob.
// One adapter per warm instance; OPS counts every operation (list/get/put/del/sign); json() reports the delta of the request.
export const OPS = { advanced: 0, simple: 0, put: 0, list: 0, get: 0, del: 0, sign: 0 };
let storeP = null;
export function store() { if (!storeP) storeP = openStore({ ops: OPS }).catch((e) => { storeP = null; throw e; }); return storeP; }
export const STORE_KIND = storeKind();
/** put(path, body, { contentType }) — the old Blob call shape, kept for the callers */
export async function put(pathname, body, opts = {}) { return (await store()).putBytes(pathname, body, opts.contentType || 'application/octet-stream'); }
export function opsMark() { return { ...OPS }; }
export function opsSince(m) { return { advanced: OPS.advanced - m.advanced, simple: OPS.simple - m.simple, put: OPS.put - m.put, list: OPS.list - m.list, get: OPS.get - m.get }; }

export const SOFT_CAP_USD = 10;   // root §7 defaults: stop and tell at the soft cap
export const HARD_CAP_USD = 20;   // never crossed without Eliran's new ruling

export function json(status, body, mark = null) {
  const ops = mark ? opsSince(mark) : null;
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', ...(ops ? { 'x-store-ops': `adv=${ops.advanced};simple=${ops.simple};list=${ops.list};put=${ops.put}` } : {}) },
  });
}

/** The verified Clerk user id, or null. */
export async function userId(request) {
  const h = request.headers.get('authorization') || '';
  const tok = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!tok || !process.env.CLERK_SECRET_KEY) return null;
  try {
    const p = await verifyToken(tok, { secretKey: process.env.CLERK_SECRET_KEY });
    return typeof p?.sub === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(p.sub) ? p.sub : null;
  } catch { return null; }
}

const SAFE = /^[A-Za-z0-9_-]{1,64}$/;
export const isPid = (s) => typeof s === 'string' && SAFE.test(s);
export function pdir(uid, pid) {
  if (!SAFE.test(uid) || !SAFE.test(pid)) throw new Error('bad id');
  return `studio/u/${uid}/p/${pid}/`;
}
export const udir = (uid) => `studio/u/${uid}/p/`;

/** A file name the developer chose, made safe for a blob path (Hebrew letters kept). */
export function safeName(name) {
  const base = String(name || 'file').split(/[\\/]/).pop().normalize('NFC');
  return base.replace(/[^\p{L}\p{N}._ ()-]+/gu, '_').replace(/^\.+/, '').slice(0, 120) || 'file';
}

export async function readBytes(pathname) {
  try {
    const b = await (await store()).getBytes(pathname);
    return b ? { bytes: new Uint8Array(b), contentType: null, size: b.length } : null;
  } catch { return null; }
}
export async function readJson(pathname, fallback = null) {
  const r = await readBytes(pathname);
  if (!r) return fallback;
  try { return JSON.parse(new TextDecoder().decode(r.bytes)); } catch { return fallback; }
}
export async function writeJson(pathname, data) {
  await (await store()).putJson(pathname, data);
}

/** Every object under a prefix — for (re)building an index document ONLY, never on a hot path. */
export async function listAll(prefix) {
  return (await store()).list(prefix);
}

/** The project's files from its index document files.json (one simple read). A project from before the index (or an index the
 *  browser never registered) is listed ONCE and the index written — after that, never a list() for it again. */
export async function files(uid, pid) {
  const idx = await readJson(`${pdir(uid, pid)}files.json`);
  if (idx && Array.isArray(idx.files)) return idx.files;
  return reindexFiles(uid, pid);
}
export async function reindexFiles(uid, pid) {
  const pre = `${pdir(uid, pid)}files/`;
  const all = await listAll(pre);
  const paged = new Set(all.map((b) => b.pathname.slice(pre.length)).filter((n) => /^\.pages\/[^/]+\/index\.json$/.test(n)).map((n) => n.split('/')[1]));
  const out = all.filter((b) => !b.pathname.slice(pre.length).startsWith('.pages/'))
    .map((b) => { const name = b.pathname.slice(pre.length); return { name, bytes: b.size, uploadedAt: b.uploadedAt, pathname: b.pathname, pages: paged.has(name) }; })
    .sort((a, b) => a.name.localeCompare(b.name));
  await writeJson(`${pdir(uid, pid)}files.json`, { schema: 'habait-studio/files.v1', files: out, indexed: new Date().toISOString() });   // one put; never listed again
  return out;
}

/** The developer's project list from studio/u/<uid>/projects.json; built once from a list() when absent. */
export async function projectIndex(uid) {
  const f = `studio/u/${uid}/projects.json`;
  const idx = await readJson(f);
  if (idx && Array.isArray(idx.projects)) return idx.projects;
  const metas = (await listAll(udir(uid))).filter((b) => /\/p\/[A-Za-z0-9_-]+\/meta\.json$/.test(b.pathname));
  const projects = (await Promise.all(metas.map((b) => readJson(b.pathname)))).filter(Boolean).map((p) => ({ id: p.id, name: p.name, created: p.created }));
  await writeJson(f, { schema: 'habait-studio/projects.v1', projects });
  return projects;
}
export async function projectIndexAdd(uid, project) {
  const f = `studio/u/${uid}/projects.json`;
  const cur = (await readJson(f))?.projects || null;
  const list0 = cur || await projectIndex(uid);
  const projects = [{ id: project.id, name: project.name, created: project.created }, ...list0.filter((p) => p.id !== project.id)];
  await writeJson(f, { schema: 'habait-studio/projects.v1', projects });
}

/** Where a developer upload may go, relative to files/: the file itself, or the page renders the browser made of a PDF
    (pdf.js, an overview + overlapping ~250-dpi tiles, the same idea as Habait/studio/tools/prep_pdf.py). */
export function uploadRelOk(rel) {
  if (/^[^/.][^/]{0,129}$/.test(rel)) return true;
  return /^\.pages\/[^/.][^/]{0,129}\/(page-\d{1,2}(-r\d{1,2}c\d{1,2})?\.jpg|index\.json)$/.test(rel);
}

/** The ledger (root §7): open a row BEFORE a paid call, close it after. Returns the open row's id. */
export async function ledgerOpen(uid, pid, { step, endpoint, estUsd, note }) {
  const f = `${pdir(uid, pid)}ledger.json`;
  const rows = await readJson(f, []);
  const total = rows.reduce((s, r) => s + (Number(r.usd ?? r.estUsd) || 0), 0);
  if (total + estUsd > HARD_CAP_USD) return { ok: false, total, reason: 'hard_cap' };
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  rows.push({ id, at: new Date().toISOString(), step, endpoint, estUsd, usd: null, state: 'open', note });
  await writeJson(f, rows);
  return { ok: true, id, total, soft: total + estUsd > SOFT_CAP_USD };
}
export async function ledgerClose(uid, pid, id, { usd, state = 'done', note }) {
  const f = `${pdir(uid, pid)}ledger.json`;
  const rows = await readJson(f, []);
  const r = rows.find((x) => x.id === id);
  if (r) { r.usd = Math.round((Number(usd) || 0) * 1e4) / 1e4; r.state = state; if (note) r.note = `${r.note || ''} · ${note}`.slice(0, 300); r.closedAt = new Date().toISOString(); }
  await writeJson(f, rows);
}
export async function spent(uid, pid) {
  const rows = await readJson(`${pdir(uid, pid)}ledger.json`, []);
  return Math.round(rows.reduce((s, r) => s + (Number(r.usd ?? r.estUsd) || 0), 0) * 100) / 100;
}

/** One call to a language model on fal (`openrouter/router/vision`), the same endpoint as Habait/studio/lib/fal-llm.mjs. */
export const FAL_MODEL = 'anthropic/claude-sonnet-5.5';
export async function falLLM({ system, prompt, pdfs = [], images = [], maxTokens = 1500, temperature = 0.2 }) {
  const key = process.env.FAL_KEY;
  if (!key) return { ok: false, usd: 0, note: 'FAL_KEY missing' };
  const body = { model: FAL_MODEL, prompt, system_prompt: system, temperature, max_tokens: maxTokens, reasoning: true };
  if (pdfs.length) body.pdf_urls = pdfs;
  if (images.length) body.image_urls = images;
  let r;
  try {
    r = await fetch(`${(process.env.HABAIT_FAL_BASE || 'https://fal.run').replace(/\/$/, '')}/openrouter/router/vision`, {
      method: 'POST', headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(280_000),
    });
  } catch (e) { return { ok: false, usd: 0, note: `fal request failed: ${String(e.message).slice(0, 120)}` }; }
  const text = await r.text();
  let j = null; try { j = JSON.parse(text); } catch { /* not JSON */ }
  if (!r.ok) return { ok: false, usd: 0, note: `fal HTTP ${r.status}` };
  if (!j || typeof j.output !== 'string') return { ok: false, usd: Number(j?.usage?.cost) || 0, note: 'fal answered without text' };
  return { ok: true, text: j.output, usd: Number(j.usage?.cost) || 0, usage: j.usage || null };
}

/** The developer's PDFs and images as data URIs for the model, inside a total budget (the fal body limit). A PDF with page
    renders goes in as its overview + tiles (images, in order, each with a note), plus the PDF itself when it is small. */
export async function filesForModel(uid, pid, { budget = 24_000_000, overviewsOnly = false, pages = null } = {}) {
  const pdfs = [], images = [], used = [], skipped = [], notes = [];
  let n = 0;
  const base = `${pdir(uid, pid)}files/`;
  for (const f of await files(uid, pid)) {
    if (f.pages && /\.pdf$/i.test(f.name)) {
      const raw = await readJson(`${base}.pages/${f.name}/index.json`, []);
      const idx = (Array.isArray(raw) ? raw : (raw.images || []))
        .filter((im) => (overviewsOnly ? im.kind === 'overview' : true))
        .filter((im) => (im.kind === 'tile' && pages ? pages.has(`${f.name}#${im.page}`) : true));
      const got = await Promise.all(idx.map((im) => readBytes(`${base}.pages/${f.name}/${im.file}`)));
      let added = 0;
      idx.forEach((im, k) => {
        const b = got[k];
        if (!b || n + b.size > budget) { if (b) skipped.push(`${f.name} ${im.file} (over the size budget)`); return; }
        n += b.size; added++;
        images.push(`data:image/jpeg;base64,${Buffer.from(b.bytes).toString('base64')}`);
        notes.push(im.kind === 'overview'
          ? `image ${images.length}: the whole page ${im.page} of "${f.name}" at low resolution — layout, keys, north arrow`
          : `image ${images.length}: page ${im.page} of "${f.name}", tile row ${im.row} col ${im.col} (${im.region}-${im.side}) at ~${im.dpi} dpi — read numbers and labels here`);
      });
      if (added) used.push(`${f.name} (${added} page renders)`);
      if (!overviewsOnly && f.bytes <= 4_000_000 && n + f.bytes <= budget) {
        const b = await readBytes(f.pathname);
        if (b) { n += f.bytes; pdfs.push(`data:application/pdf;base64,${Buffer.from(b.bytes).toString('base64')}`); }
      }
      continue;
    }
    const ext = f.name.toLowerCase().split('.').pop();
    const kind = ext === 'pdf' ? 'pdf' : ['png', 'jpg', 'jpeg', 'webp'].includes(ext) ? 'image' : null;
    if (!kind) { skipped.push(`${f.name} (type not read yet)`); continue; }
    if (n + f.bytes > budget) { skipped.push(`${f.name} (over the size budget)`); continue; }
    const b = await readBytes(f.pathname);
    if (!b) { skipped.push(`${f.name} (unreadable)`); continue; }
    n += f.bytes;
    const mt = kind === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const uri = `data:${mt};base64,${Buffer.from(b.bytes).toString('base64')}`;
    (kind === 'pdf' ? pdfs : images).push(uri);
    if (kind === 'image') notes.push(`image ${images.length}: the uploaded file "${f.name}"`);
    used.push(f.name);
  }
  return { pdfs, images, used, skipped, notes };
}

/* ---------- the build job (contract: Habait/studio-web/CLAUDE.md "Job contract", schema habait-studio/job.v1) ---------- */
export const jobPath = (uid, pid) => `${pdir(uid, pid)}job.json`;
export const queuePath = (jobId) => `studio/queue/${jobId}.json`;
export function logLine(job, line) { job.log = [...(job.log || []), { at: new Date().toISOString(), line: String(line).slice(0, 300) }].slice(-200); job.updated = new Date().toISOString(); }
export const jobIndexPath = (jobId) => `studio/jobs/${jobId}.json`;
export async function enqueue(uid, pid, job) {
  await writeJson(jobPath(uid, pid), job);
  await writeJson(queuePath(job.id), { schema: 'habait-studio/queue.v1', job: job.id, uid, pid, jobPath: jobPath(uid, pid), at: new Date().toISOString() });
  // the job's permanent address (fork E): a tool finds a job by id with ONE read, never a list() of studio/u/ — written at the first
  // enqueue only (build); a trace approval or a correction re-enqueues the same job and its address is already there
  if (!job.approvals?.trace && !(job.corrections || []).length) await writeJson(jobIndexPath(job.id), { schema: 'habait-studio/job-index.v1', job: job.id, uid, pid, jobPath: jobPath(uid, pid) });
}
