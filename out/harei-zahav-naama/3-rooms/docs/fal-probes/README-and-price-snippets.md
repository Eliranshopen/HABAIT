# fal probes, 2026-11-17 ($0, keyless, no login)

Requests made (all public, no key): `GET https://api.fal.ai/v1/models?category=image-to-image&limit=100[&cursor=..]`, `GET https://api.fal.ai/v1/models?q=<term>&limit=50`, `GET https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=<id>`, and fal model pages via fetch.
The listing API rate-limits quickly (HTTP 429 "Rate limit exceeded" after ~25 calls in a minute); calls were then spaced 6 s apart. Error bodies were not kept.

Files here
- `list-image-to-image-p1.json`, `list-i2i-p2.json` : the image-to-image catalogue (page 3 was rate-limited, not retrieved).
- `list-t2i-p1.json` : first 100 text-to-image models (no panorama/360/skybox/equirect hit in names or descriptions).
- `q-*.json` : search results (pano, panorama, 360, equirectangular, skybox, hdri, world, 3d, depth, canny, controlnet, upscale ...). `q-pano*`/`q-skybox`/`q-equirectangular` = empty.
- `schemas/`, `schemas2/` : OpenAPI input schemas. Files containing the 4 characters `null` are DEAD endpoints:
  `fal-ai/hunyuan_world`, `fal-ai/hunyuan_world/image-to-world`, `fal-ai/flux-control-lora-depth/image-to-image`, `fal-ai/sdxl-controlnet-union`
  (their model pages also return 404; `api.fal.ai/v1/models?endpoint_id=fal-ai/hunyuan_world` -> `not_found`).
- `dead-endpoints.txt` is not present (a cleanup command was blocked by the safety check; nothing was deleted).

Price snippets from live model pages, accessed 2026-11-17 (page text; fal's pricing API needs a key and was not called)
| endpoint | page text |
|---|---|
| fal-ai/nano-banana-2/edit | base $0.08/image at 1K; multipliers 0.5K 0.75x, 2K 1.5x ($0.12), 4K 2x ($0.16); high thinking +$0.002; web search +$0.015; up to 14 refs |
| google/nano-banana-2.1/edit | token-billed; 1K $0.044, 2K $0.063, 4K $0.138 (edit, two 1K inputs); each input image ~ +$0.002; 14 refs |
| fal-ai/nano-banana-pro/edit | $0.15 at 1K/2K, 4K double (~$0.30); +$0.015 web search; 14 refs |
| fal-ai/nano-banana/edit | $0.0398 per image |
| google/nano-banana-lite/edit | tokens only ($37.50/M image output), fixed 1K; per-image price not given |
| fal-ai/flux-2-pro/edit | $0.03 first MP of output + $0.015 per extra MP of input AND output (rounded up); 1920x1080 = $0.045; input up to 9 MP, 9 refs |
| fal-ai/flux-2-flex/edit | $0.05/MP, input+output; 1920x1080 = $0.10; 10 refs, 14 MP total input |
| fal-ai/flux-2/edit (dev) | $0.012/MP input+output |
| fal-ai/flux-2/klein/9b/edit | $0.011/MP input+output |
| fal-ai/flux-2-max/edit | $0.07 first MP + $0.03 per extra MP |
| fal-ai/flux-pro/kontext | $0.04/image ; kontext/max $0.08/image |
| fal-ai/qwen-image-edit-2511 (+/lora) | $0.03/MP ; lora variant $0.035/MP |
| bytedance/seedream/v5.5/edit | $0.03 (<= 2.61 MP) / $0.0405 above, + $0.012 per input image; 10 refs |
| blackforestlabs/flux-3/edit-image | $0.048 at 1K (other tiers not shown on the page); 512sq..4k tiers; 10 refs |
| openai/gpt-image-2.6/sunburst/edit | 2048x2048: low .050 med .088 high .107 xhigh .190 max .428; 3840x2160: high .100, max .400; 1920x1072 high .039; refs billed as tokens ~ $0.008 per 1k tokens; max edge 3840, area 8,294,400, aspect <= 3:1 |
| fal-ai/hunyuan-image/v3/instruct/edit | $0.09/MP |
| fal-ai/flux-general/image-to-image | $0.075/MP (controlnet_unions: depth/canny/tile/blur/pose/gray/low-quality) |
| fal-ai/flux-lora-depth | $0.035/MP |
| fal-ai/z-image/turbo/controlnet | $0.0065/MP; preprocess none/canny/depth/pose; control_scale 0-1 |
| speridlabs/iris-z/depth-to-image | <= 1 MP $0.14, larger $0.28; 512/1024 tiers only |
| fal-ai/seedvr/upscale/image | $0.001/MP ; /seamless $0.0025/MP (last checked 2026-11-16) |
| topaz/upscale/image/precision | $0.08 per started 24 MP output, 24-48 MP $0.16, 48-72 MP $0.24; factor <= 4 |
| fal-ai/clarity-upscaler | $0.03/MP |
| clarityai/crystal-upscaler | $0.016/MP output; creativity 0-10; scale 1-200 |
| fal-ai/marigold-v2 | $0.03 per image regardless of size; depth, see-through-depth, normals, albedo |
| fal-ai/image-preprocessors/depth-anything/v2 | page shows "$0 per compute second" and no real price: unverified |

Schema facts (schemas folders): seed exists on nano-banana(-2/-2.1/-pro), flux-2-pro/flex/dev edit, kontext, qwen-2511, clarity, seedvr, z-image controlnet; NOT on seedream-5.5 edit, flux-3 edit, gpt-image-2.6 edit.
Nano Banana family aspect_ratio enums contain no 2:1 (nb2/pro add 4:1 and 8:1 only). flux-3 edit-image enum contains "2:1".
