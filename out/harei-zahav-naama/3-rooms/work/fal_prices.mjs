import { loadEnv } from 'file:///C:/RnD/Projects/3Dengine/pipeline/Habait/tour360/tools/file-ledger.mjs';
const env = loadEnv('C:/RnD');
const ids = ['fal-ai/hunyuan-3d/v3.1/pro/image-to-3d', 'fal-ai/hyper3d/rodin/v2.5', 'tripo3d/h3.1/image-to-3d', 'tripo3d/h3.1/multiview-to-3d', 'meshy/v7.1/image-to-3d', 'meshy/v7.1/multi-image-to-3d', 'hitem3d/hi3d/v3.0/image-to-3d', 'hitem3d/hi3d/v3.0/multi-view-to-3d', 'fal-ai/trellis-2', 'tripo3d/p2/image-to-3d'];
const q = ids.map((i) => 'endpoint_id=' + encodeURIComponent(i)).join('&');
const r = await fetch('https://api.fal.ai/v1/models/pricing?' + q, { headers: { Authorization: `Key ${env.FAL_KEY}` } });
const t = await r.text();
console.log(r.status, t.slice(0, 3000));
