/* GET /p/<pid>/…  (rewritten to /api/studio-pub?pid=<pid>&path=<rel> by vercel.json, stage_flow.py --studio) — the PUBLISHED project
   of a portal job: its project page data and its 360 tour, served read-only from the private Blob store, so a new project needs no
   deploy (project-runner fork F, 2026-11-05; Eliran: «הפורטל צריך להיות עצמאי»).
   - The runner (tools/run-job.mjs) uploads the package under the job's private prefix and writes the public pointer
     studio/pub/<pid>.json = { schema:'habait-studio/pub.v1', pid, prefix, files[] }. Only a path IN that list is served: no listing,
     no other project's files, nothing outside the package.
   - URL → package file: tour/<x> → tour/<x> (tour/ → tour/index.html) · projects.json → platform/projects.json ·
     fixtures/<x> → platform/fixtures/<x> · _local/dist/<x> → platform/_local/dist/<x> (the apartment page + its pack). Everything else under /p/<pid>/ (landing.html, css/, js/ …) is the platform template the
     site already serves (a static rewrite in vercel.json); /p/<pid>/ itself redirects to landing.html?project=<pid>.
   - The tour's typed bar posts to /p/<pid>/tour/api/edit, rewritten to the shared /api/tour-edit.
   Reads go through the storage adapter (_store.mjs: Supabase Storage, or the Blob store with STORE=blob); no secret is read here
   except by the adapter itself. */
import { isPid, store } from './_studio.mjs';

const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json; charset=utf-8',
  webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', woff2: 'font/woff2', mp4: 'video/mp4', glb: 'model/gltf-binary', mp3: 'audio/mpeg', txt: 'text/plain; charset=utf-8' };
const SAFE_REL = /^[A-Za-z0-9_\-./]{0,300}$/;
const cache = new Map();   // pid → { at, ptr }: 10 min per warm instance (a known path, never a list; the store's Hobby quota counts every get)
const page = (status, he) => new Response(`<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="robots" content="noindex"><title>Habait</title><body style="font-family:system-ui;padding:40px">${he}</body></html>`,
  { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' } });

async function pointer(pid) {
  const c = cache.get(pid); if (c && Date.now() - c.at < (c.ptr ? 600000 : 60000)) return c.ptr;
  let ptr = null;
  try {
    const j = await (await store()).getJson(`studio/pub/${pid}.json`);
    if (j && j.pid === pid && typeof j.prefix === 'string' && Array.isArray(j.files)) ptr = { prefix: j.prefix, files: new Set(j.files) };
  } catch { ptr = null; }
  cache.set(pid, { at: Date.now(), ptr });
  return ptr;
}

export async function GET(request) {
  const u = new URL(request.url);
  const pid = u.searchParams.get('pid'); let rel = u.searchParams.get('path') || '';
  if (!isPid(pid) || !SAFE_REL.test(rel) || rel.split('/').some((s) => s === '..' || s === '.')) return page(400, 'כתובת לא תקינה');
  if (rel === '') return Response.redirect(new URL(`/p/${pid}/landing.html?project=${pid}`, u), 302);
  if (rel === 'tour') { const q = new URLSearchParams(u.search); q.delete('pid'); q.delete('path'); const qs = q.toString(); return Response.redirect(new URL(`/p/${pid}/tour/${qs ? `?${qs}` : ''}`, u), 308); }
  const ptr = await pointer(pid);
  if (!ptr) return page(404, 'הפרויקט עדיין לא פורסם');
  if (rel === 'tour/' || rel.endsWith('/')) rel += 'index.html';
  const file = rel === 'projects.json' ? 'platform/projects.json' : rel.startsWith('fixtures/') || rel.startsWith('_local/dist/') ? `platform/${rel}` : rel.startsWith('tour/') ? rel : null;
  if (!file || !ptr.files.has(file)) return page(404, 'לא נמצא');
  try {
    const r = await (await store()).stream(`${ptr.prefix}${file}`);
    if (!r) return page(404, 'לא נמצא');
    const ext = file.split('.').pop().toLowerCase();
    // the CDN answers repeat visits (s-maxage): the store is read once per file, not per visit
    return new Response(r.stream, { status: 200, headers: { 'content-type': TYPES[ext] || r.contentType || 'application/octet-stream', 'cache-control': /^(webp|png|jpe?g|woff2|mp4|glb|zip)$/.test(ext) ? 'public, max-age=600, s-maxage=86400, stale-while-revalidate=86400' : 'public, max-age=60, s-maxage=300, stale-while-revalidate=600', 'x-robots-tag': 'noindex, nofollow' } });
  } catch { return page(404, 'לא נמצא'); }
}
