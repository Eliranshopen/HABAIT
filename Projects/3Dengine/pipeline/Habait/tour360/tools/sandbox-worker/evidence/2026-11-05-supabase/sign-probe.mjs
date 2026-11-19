import { openStore } from 'file:///C:/RnD/.wt/studio-supabase/Projects/Habait/habait-walkaround/Habait/studio-web/api/_store.mjs';
const s = await openStore();
for (const p of ['studio/u/forkG-probe/p/probe2/a.json', 'studio/u/forkG-probe/p/probe2/files/דירה.json']) {
  await s.putJson(p, { ok: 1 });
  const dl = await s.signDownload(p, 60);
  const u = new URL(dl);
  const r = await fetch(dl);
  console.log(p.split('/').pop(), u.pathname, r.status, (await r.text()).slice(0, 120));
  await s.del(p);
}
