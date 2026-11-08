/* The portal's ONE storage adapter (fork G, 2026-11-05) — used by the /api/studio-* functions, the publish route, the job runner
   (tour360/tools/run-job.mjs, in a Vercel Sandbox or on a laptop) and the sandbox worker CLI. Same logical paths everywhere:
   studio/u/<uid>/p/<pid>/…, studio/queue/<job>.json, studio/jobs/<job>.json, studio/pub/<pid>.json, studio/worker/snapshot.json.

   Why: the Vercel Blob store `habait-studio` was SUSPENDED on 2026-11-05 13:40 (Hobby OPERATIONS quota). Eliran chose the free fix:
   Supabase Storage (free plan, Vercel Marketplace resource `habait-studio-store`). The Blob backend stays behind the same interface
   so the portal can switch back after the Blob quota resets (STORE=blob).

   Backend choice: env STORE=supabase|blob; unset → supabase when SUPABASE_URL + a server key are set, else blob.
   Secrets by NAME only (root §8.1): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY), BLOB_READ_WRITE_TOKEN. Nothing
   here logs, prints or returns a key; signed URLs carry a short-lived token for ONE object, never the key.

   Supabase Storage keys accept only a restricted ASCII set, so every path segment outside [A-Za-z0-9._-] (a Hebrew file name, a
   space) is stored as '!' + base64url(utf-8) ('!' survives URL encoding, so signed URLs verify) and decoded back on list: the logical path never changes for the callers.

   Quota-safe rules (forks E/F): never list() to find something — read known paths; list only to (re)build an index document;
   every operation is counted in OPS (list, get, put, del, sign) so a job and a response can report them. */

export const BUCKET = 'studio';
export const MAX_FILE_BYTES = 50 * 1024 * 1024;   // Supabase free plan: 50 MB per file (bucket file_size_limit set to the same)

export function storeKind(env = process.env) {
  const k = String(env.STORE || '').toLowerCase();
  if (k === 'supabase' || k === 'blob') return k;
  return env.SUPABASE_URL && (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY) ? 'supabase' : 'blob';
}
export function storeConfigured(env = process.env) {
  return storeKind(env) === 'supabase' ? Boolean(env.SUPABASE_URL && (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY)) : Boolean(env.BLOB_READ_WRITE_TOKEN);
}

// ───────────────────────────── path segments → storage keys (reversible)
const SAFE_SEG = /^[A-Za-z0-9._-]+$/;
const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
export const encSeg = (s) => (SAFE_SEG.test(s) ? s : `!${b64u(Buffer.from(String(s).normalize('NFC'), 'utf8'))}`);
export const decSeg = (s) => (s.startsWith('!') ? unb64u(s.slice(1)) : s);
export const toKey = (p) => String(p).split('/').map((s, i, a) => (s === '' && i === a.length - 1 ? '' : encSeg(s))).join('/');
export const fromKey = (k) => String(k).split('/').map(decSeg).join('/');

/** open the store: { kind, OPS, getBytes, getJson, stream, putBytes, putJson, putFile, del, list, signUpload, signDownload }.
 *  `loadBlob` (blob backend only) returns the @vercel/blob module — the functions import it, the CLI tools load it from a folder. */
export async function openStore({ env = process.env, loadBlob = null, ops = null } = {}) {
  const OPS = ops || { list: 0, get: 0, put: 0, del: 0, sign: 0, advanced: 0, simple: 0 };
  const kind = storeKind(env);
  const json = (b) => { if (!b) return null; try { return JSON.parse(Buffer.from(b).toString('utf8')); } catch { return null; } };

  if (kind === 'supabase') {
    const base = `${String(env.SUPABASE_URL || '').replace(/\/$/, '')}/storage/v1`;
    const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
    if (!env.SUPABASE_URL || !key) throw new Error('storage: SUPABASE_URL and a server key are not in the environment');
    const H = (extra = {}) => ({ apikey: key, Authorization: `Bearer ${key}`, ...extra });
    const objUrl = (p) => `${base}/object/${BUCKET}/${toKey(p).split('/').map(encodeURIComponent).join('/')}`;
    let bucketReady = false;
    async function ensureBucket() {
      if (bucketReady) return;
      const r = await fetch(`${base}/bucket/${BUCKET}`, { headers: H() });
      if (r.ok) { bucketReady = true; return; }
      const c = await fetch(`${base}/bucket`, { method: 'POST', headers: H({ 'content-type': 'application/json' }), body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false, file_size_limit: MAX_FILE_BYTES }) });
      if (!c.ok && c.status !== 409 && !/already exists/i.test(await c.text().catch(() => ''))) throw new Error(`storage: bucket ${BUCKET} could not be created (HTTP ${c.status})`);
      bucketReady = true;
    }
    async function getRes(p) {
      OPS.get++; OPS.simple++;
      const r = await fetch(objUrl(p).replace('/object/', '/object/authenticated/'), { headers: H() });
      if (r.status === 400 || r.status === 404) return null;   // Storage answers a missing object with 400 {statusCode:"404"}
      if (!r.ok) throw new Error(`storage: get HTTP ${r.status}`);
      return r;
    }
    const store = {
      kind: `supabase storage (private bucket ${BUCKET})`, backend: 'supabase', OPS, ensureBucket,
      async getBytes(p) { try { const r = await getRes(p); return r ? Buffer.from(await r.arrayBuffer()) : null; } catch { return null; } },
      async getJson(p) { return json(await store.getBytes(p)); },
      async stream(p) { try { const r = await getRes(p); return r ? { stream: r.body, contentType: r.headers.get('content-type') || null, size: Number(r.headers.get('content-length')) || null } : null; } catch { return null; } },
      async putBytes(p, body, contentType = 'application/octet-stream') {
        await ensureBucket(); OPS.put++; OPS.advanced++;
        const r = await fetch(objUrl(p), { method: 'POST', headers: H({ 'content-type': contentType, 'x-upsert': 'true', 'cache-control': 'max-age=0' }), body });
        if (!r.ok) throw new Error(`storage: put HTTP ${r.status}`);
        return { pathname: p };
      },
      async putJson(p, d) { return store.putBytes(p, JSON.stringify(d, null, 1), 'application/json'); },
      async putFile(p, file, contentType) { const fs = await import('node:fs'); return store.putBytes(p, fs.readFileSync(file), contentType || guessType(file)); },
      async del(p) { OPS.del++; OPS.advanced++; await fetch(`${base}/object/${BUCKET}`, { method: 'DELETE', headers: H({ 'content-type': 'application/json' }), body: JSON.stringify({ prefixes: [toKey(p)] }) }).catch(() => {}); },
      /** every object under a logical prefix (recursive): [{ pathname, size, uploadedAt }] — for (re)building an index ONLY */
      async list(prefix) {
        await ensureBucket();
        const out = [];
        const walk = async (dirKey) => {
          for (let offset = 0; ; offset += 1000) {
            OPS.list++; OPS.advanced++;
            const r = await fetch(`${base}/object/list/${BUCKET}`, { method: 'POST', headers: H({ 'content-type': 'application/json' }), body: JSON.stringify({ prefix: dirKey, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }) });
            if (!r.ok) throw new Error(`storage: list HTTP ${r.status}`);
            const rows = await r.json();
            for (const e of rows) {
              const k = dirKey ? `${dirKey}/${e.name}` : e.name;
              if (e.id === null || e.id === undefined) await walk(k);   // a folder
              else out.push({ pathname: fromKey(k), size: Number(e.metadata?.size) || 0, uploadedAt: e.created_at || e.updated_at || null });
            }
            if (rows.length < 1000) break;
          }
        };
        const pk = toKey(String(prefix).replace(/\/$/, ''));
        await walk(pk);
        return out;
      },
      /** a one-object, short-lived upload URL (PUT the raw body with its content-type) — for the browser */
      async signUpload(p) {
        await ensureBucket(); OPS.sign++;
        const r = await fetch(`${base}/object/upload/sign/${BUCKET}/${toKey(p).split('/').map(encodeURIComponent).join('/')}`, { method: 'POST', headers: H({ 'x-upsert': 'true' }) });
        if (!r.ok) throw new Error(`storage: sign upload HTTP ${r.status}`);
        const j = await r.json();
        return { url: `${base}${j.url}`, method: 'PUT', headers: { 'x-upsert': 'true' } };
      },
      /** a one-object, short-lived download URL */
      async signDownload(p, expiresIn = 600) {
        OPS.sign++;
        const r = await fetch(`${base}/object/sign/${BUCKET}/${toKey(p).split('/').map(encodeURIComponent).join('/')}`, { method: 'POST', headers: H({ 'content-type': 'application/json' }), body: JSON.stringify({ expiresIn }) });
        if (!r.ok) return null;
        const j = await r.json();
        return j.signedURL ? `${base}${j.signedURL}` : null;
      },
    };
    return store;
  }

  // ───────────────────────────── the Vercel Blob backend (the store before 2026-11-05; switch back with STORE=blob)
  if (!env.BLOB_READ_WRITE_TOKEN) throw new Error('storage: BLOB_READ_WRITE_TOKEN is not in the environment');
  const blob = loadBlob ? await loadBlob() : await import('@vercel/blob');
  const PRIV = { access: 'private' };
  async function getRes(p) { OPS.get++; OPS.simple++; const r = await blob.get(p, { ...PRIV, useCache: false }); return r && r.statusCode === 200 && r.stream ? r : null; }
  const store = {
    kind: 'vercel blob (private store)', backend: 'blob', OPS, ensureBucket: async () => {},
    async getBytes(p) { try { const r = await getRes(p); return r ? Buffer.from(await new Response(r.stream).arrayBuffer()) : null; } catch { return null; } },
    async getJson(p) { return json(await store.getBytes(p)); },
    async stream(p) { try { const r = await getRes(p); return r ? { stream: r.stream, contentType: r.blob.contentType || null, size: r.blob.size || null } : null; } catch { return null; } },
    async putBytes(p, body, contentType = 'application/octet-stream') { OPS.put++; OPS.advanced++; return blob.put(p, body, { ...PRIV, allowOverwrite: true, addRandomSuffix: false, contentType }); },
    async putJson(p, d) { return store.putBytes(p, JSON.stringify(d, null, 1), 'application/json'); },
    async putFile(p, file, contentType) { const fs = await import('node:fs'); return store.putBytes(p, fs.readFileSync(file), contentType || guessType(file)); },
    async del(p) { OPS.del++; OPS.advanced++; return blob.del(p).catch(() => {}); },
    async list(prefix) { const out = []; let cursor; do { OPS.list++; OPS.advanced++; const r = await blob.list({ prefix, cursor, limit: 1000 }); out.push(...r.blobs.map((b) => ({ pathname: b.pathname, size: b.size, uploadedAt: b.uploadedAt }))); cursor = r.hasMore ? r.cursor : undefined; } while (cursor); return out; },
    async signUpload() { throw new Error('storage: the Blob backend uploads through /api/studio-upload client tokens, not signed URLs'); },
    async signDownload() { return null; },
  };
  return store;
}

const TYPES = { pdf: 'application/pdf', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml',
  html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', txt: 'text/plain; charset=utf-8',
  md: 'text/markdown; charset=utf-8', woff2: 'font/woff2', mp4: 'video/mp4', glb: 'model/gltf-binary', mp3: 'audio/mpeg', csv: 'text/csv', zip: 'application/zip' };
export function guessType(name) { return TYPES[String(name).toLowerCase().split('.').pop()] || 'application/octet-stream'; }
