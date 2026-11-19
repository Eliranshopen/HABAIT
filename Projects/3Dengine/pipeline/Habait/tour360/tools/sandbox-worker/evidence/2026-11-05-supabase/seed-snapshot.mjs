// fork G: point the Supabase store's studio/worker/snapshot.json at fork E's Blender snapshot record (copied verbatim from its evidence file)
import fs from 'node:fs';
import { openStore } from 'file:///C:/RnD/.wt/studio-supabase/Projects/Habait/habait-walkaround/Habait/studio-web/api/_store.mjs';
const rec = JSON.parse(fs.readFileSync('C:/RnD/.wt/sandbox-worker/Projects/Habait/habait-walkaround/Habait/tour360/tools/sandbox-worker/evidence/2026-11-05-snapshot/snapshot.json', 'utf8'));
const s = await openStore();
await s.putJson('studio/worker/snapshot.json', rec);
const back = await s.getJson('studio/worker/snapshot.json');
console.log(s.kind, back.snapshotId, back.withBlender);
