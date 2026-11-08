/* Habait Tour360 — tools/image-models.mjs (2026-11-06, parity R30; Eliran: «תבחר מודלים מ-FAL יותר זולים אבל עם תוצאה מושלמת»).
   ONE table of the fal image-edit models the painters may call, with the request body each one takes and its price, so finish-pano,
   close-seam and gen-pano (and the portal runner) choose by KEY and the ledger books the model's own price. Prices: fal's pricing API
   (GET https://api.fal.ai/v1/models/pricing?endpoint_id=..., read 2026-11-06, $0); gpt-image-2.5 bills by tokens ("units"), so its
   rows carry the per-image price this ledger has booked (high, 2048x1024: $0.60) and conservative estimates for medium/low.
   The DEFAULT per task type (finish / repaint / regen) is data in fidelity.json image_models.defaults, set from the bake-off.
     import { MODELS, modelFor } from './image-models.mjs'; const m = modelFor('finish', flagModel); fetch(`https://fal.run/${m.endpoint}`, { body: m.body(...) }) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const img = (png) => `data:image/png;base64,${png.toString('base64')}`;
export const MODELS = {
  'gpt25-high': { endpoint: 'openai/gpt-image-2.5/sunburst/edit', usd: 0.60, price_note: 'tokens; booked 0.60 per 2048x1024 high (this ledger)', body: (p, ims) => ({ prompt: p, image_urls: ims.map(img), image_size: { width: 2048, height: 1024 }, quality: 'high', num_images: 1, output_format: 'png', sync_mode: true }) },
  'gpt25-medium': { endpoint: 'openai/gpt-image-2.5/sunburst/edit', usd: 0.20, price_note: 'tokens; estimate (booked high-side)', body: (p, ims) => ({ prompt: p, image_urls: ims.map(img), image_size: { width: 2048, height: 1024 }, quality: 'medium', num_images: 1, output_format: 'png', sync_mode: true }) },
  'gpt25-low': { endpoint: 'openai/gpt-image-2.5/sunburst/edit', usd: 0.06, price_note: 'tokens; estimate (booked high-side)', body: (p, ims) => ({ prompt: p, image_urls: ims.map(img), image_size: { width: 2048, height: 1024 }, quality: 'low', num_images: 1, output_format: 'png', sync_mode: true }) },
  'nano-banana-2': { endpoint: 'fal-ai/nano-banana-2/edit', usd: 0.08, price_note: 'fal pricing API: 0.08 per image', body: (p, ims) => ({ prompt: p, image_urls: ims.map(img), num_images: 1, output_format: 'png', aspect_ratio: '21:9', sync_mode: true }) },
  'seedream-4.5': { endpoint: 'fal-ai/bytedance/seedream/v4.5/edit', usd: 0.04, price_note: 'fal pricing API: 0.04 per image', body: (p, ims) => ({ prompt: p, image_urls: ims.map(img), image_size: { width: 2048, height: 1024 }, num_images: 1, sync_mode: true }) },
  'flux-2-pro': { endpoint: 'fal-ai/flux-2-pro/edit', usd: 0.13, price_note: 'fal pricing API: 0.03 per processed megapixel (2 MP in + 2 MP out, booked 0.13)', body: (p, ims) => ({ prompt: p, image_urls: ims.map(img), image_size: { width: 2048, height: 1024 }, output_format: 'png', sync_mode: true }) },
};

/** The model for a task type: an explicit key wins, else fidelity.json image_models.defaults[task], else gpt25-high. */
export function modelFor(task, key) {
  let k = key;
  if (!k) { try { k = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fidelity.json'), 'utf8')).image_models?.defaults?.[task]; } catch { /* none */ } }
  k = k || 'gpt25-high';
  if (!MODELS[k]) throw new Error(`unknown image model ${k}: ${Object.keys(MODELS).join(', ')}`);
  return { key: k, ...MODELS[k] };
}
