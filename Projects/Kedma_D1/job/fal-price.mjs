// kedma-d1 ($0): what fal itself says a model costs, from its pricing API, so an estimate does not rest on this ledger's booked
// guesses alone. The key is read by name by the pipeline's loader and is never printed; only the endpoint id is sent.
// usage (from the pipeline folder): node ../jobs/kedma-d1/fal-price.mjs <endpoint id> [<endpoint id> ...]
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const T = path.resolve('Habait/tour360/tools');
const { loadEnv } = await import(pathToFileURL(path.join(T, 'file-ledger.mjs')).href);
const env = loadEnv('C:/RnD');
if (!env.FAL_KEY) { console.error('FAL_KEY missing (read by name)'); process.exit(1); }
for (const id of process.argv.slice(2)) {
  try {
    const r = await fetch('https://api.fal.ai/v1/models/pricing?endpoint_id=' + encodeURIComponent(id), { headers: { Authorization: 'Key ' + env.FAL_KEY }, signal: AbortSignal.timeout(30000) });
    const t = await r.text();
    console.log(id + ' -> http ' + r.status + ' ' + t.slice(0, 700));
  } catch (e) { console.log(id + ' -> failed: ' + String(e).slice(0, 160)); }
}
