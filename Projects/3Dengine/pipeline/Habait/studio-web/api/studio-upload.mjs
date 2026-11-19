/* POST /api/studio-upload — the browser uploads straight to the private store, past the 4.5 MB function body limit. This route only
   issues a short-lived, ONE-object upload URL (Supabase Storage `createSignedUploadUrl`), after checking the Clerk session and that
   the path is inside the signed-in developer's own project: studio/u/<uid>/p/<pid>/files/<rel>.
   { id: <pid>, rel: <files/-relative path>, size: <bytes>, type: <mime> } → { ok, url, method: 'PUT', headers }
   The browser then PUTs the raw file to `url` with its content-type and `headers`. Files over 50 MB are refused (the free plan's
   per-file limit; the bucket enforces it too). Under STORE=blob the old Blob client-token flow answers instead (handleUpload). */
import { json, userId, pdir, isPid, readJson, uploadRelOk, store, STORE_KIND } from './_studio.mjs';
import { MAX_FILE_BYTES } from './_store.mjs';

const TYPES = ['application/pdf', 'application/json', 'image/png', 'image/jpeg', 'image/webp', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel', 'text/csv', 'application/zip', 'application/octet-stream', 'image/vnd.dwg', 'application/acad', 'image/vnd.dxf', 'application/dxf', ''];

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, reason: 'body' }); }

  if (STORE_KIND === 'blob') {   // the old flow, kept for a switch back (STORE=blob)
    const { handleUpload } = await import('@vercel/blob/client');
    const uid = body?.type === 'blob.generate-client-token' ? await userId(request) : null;
    try {
      const out = await handleUpload({
        request, body,
        onBeforeGenerateToken: async (pathname, clientPayload) => {
          if (!uid) throw new Error('login');
          const pid = String(clientPayload || '');
          if (!isPid(pid) || !(await readJson(`${pdir(uid, pid)}meta.json`))) throw new Error('project');
          const pre = `${pdir(uid, pid)}files/`;
          if (!pathname.startsWith(pre) || !uploadRelOk(pathname.slice(pre.length))) throw new Error('path');
          return { allowedContentTypes: TYPES.filter(Boolean), maximumSizeInBytes: 200 * 1024 * 1024, addRandomSuffix: false, allowOverwrite: true };
        },
      });
      return json(200, out);
    } catch (e) {
      const m = String(e?.message || e);
      return json(m === 'login' ? 401 : 400, { ok: false, reason: ['login', 'project', 'path'].includes(m) ? m : 'upload' });
    }
  }

  const uid = await userId(request);
  if (!uid) return json(401, { ok: false, reason: 'login' });
  const pid = String(body?.id || ''); const rel = String(body?.rel || '');
  if (!isPid(pid)) return json(400, { ok: false, reason: 'project' });
  if (!uploadRelOk(rel)) return json(400, { ok: false, reason: 'path' });
  const size = Number(body?.size) || 0;
  if (size > MAX_FILE_BYTES) return json(413, { ok: false, reason: 'too_big', message: `הקובץ גדול מ-${Math.round(MAX_FILE_BYTES / 1048576)}MB. אפשר לפצל אותו לכמה קבצים או לשמור אותו באיכות נמוכה יותר.` });
  if (body?.type && !TYPES.includes(String(body.type))) return json(400, { ok: false, reason: 'type', message: 'סוג הקובץ לא נתמך' });
  if (!(await readJson(`${pdir(uid, pid)}meta.json`))) return json(404, { ok: false, reason: 'project' });
  try {
    const s = await store();
    const up = await s.signUpload(`${pdir(uid, pid)}files/${rel}`);
    return json(200, { ok: true, ...up });
  } catch { return json(502, { ok: false, reason: 'upload', message: 'ההעלאה לא זמינה כרגע, נסו שוב בעוד רגע' }); }
}
