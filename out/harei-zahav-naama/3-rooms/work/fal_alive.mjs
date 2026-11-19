import { loadEnv } from 'file:///C:/RnD/Projects/3Dengine/pipeline/Habait/tour360/tools/file-ledger.mjs';
const env = loadEnv('C:/RnD');
const r = await fetch('https://fal.run/fal-ai/nano-banana-pro/edit', { method: 'POST', headers: { Authorization: `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' }, body: '{}' });
const t = await r.text();
console.log(r.status, /locked|balance/i.test(t) ? 'LOCKED' : 'ALIVE');
