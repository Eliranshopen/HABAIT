import { openStore } from 'file:///C:/RnD/.wt/studio-supabase/Projects/Habait/habait-walkaround/Habait/studio-web/api/_store.mjs';
const [uid, pid] = process.argv.slice(2); const s = await openStore(); const pre = `studio/u/${uid}/p/${pid}/`;
const meta = await s.getJson(`${pre}meta.json`); console.log('meta.steps', JSON.stringify(meta?.steps));
console.log('files', JSON.stringify((await s.getJson(`${pre}files.json`))?.files?.map((f) => [f.name, f.bytes, f.pages])));
console.log('ledger', JSON.stringify(await s.getJson(`${pre}ledger.json`)));
console.log('all', (await s.list(pre)).map((b) => `${b.pathname.slice(pre.length)} ${b.size}`).join(' | '));
