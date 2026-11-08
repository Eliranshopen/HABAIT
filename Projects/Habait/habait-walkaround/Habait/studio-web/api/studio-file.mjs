/* GET /api/studio-file?id=<pid>&path=<project-relative path> — streams one PRIVATE object of the signed-in developer's own
   project (the trace overlay to approve, a result preview, a page render) through the storage adapter. Only these folders:
   files/, trace/, results/, out/, debug/. */
import { json, userId, pdir, isPid, store } from './_studio.mjs';
import { guessType } from './_store.mjs';

const OK = /^(files|trace|results|out|debug)\/[^\0]{1,300}$/;

export async function GET(request) {
  const uid = await userId(request);
  if (!uid) return json(401, { ok: false, reason: 'login' });
  const u = new URL(request.url);
  const id = u.searchParams.get('id'); const rel = u.searchParams.get('path') || '';
  if (!isPid(id) || !OK.test(rel) || rel.split('/').some((s) => s === '..' || s === '.' || s === '')) return json(400, { ok: false, reason: 'path' });
  try {
    const r = await (await store()).stream(`${pdir(uid, id)}${rel}`);
    if (!r) return json(404, { ok: false, reason: 'missing' });
    return new Response(r.stream, { status: 200, headers: { 'content-type': r.contentType || guessType(rel), 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' } });
  } catch { return json(404, { ok: false, reason: 'missing' }); }
}
