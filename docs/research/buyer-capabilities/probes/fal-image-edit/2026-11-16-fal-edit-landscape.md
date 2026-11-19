# fal image-edit landscape for 2:1 pano skin pass (docs-only, $0, no key)
Date: 2026-11-16. Verdict class: WORKS-WITH-KEY (all candidates need FAL_KEY to run; none was run).
Requests (keyless): GET https://api.fal.ai/v1/models?category=image-to-image&limit=100 (listing + dates);
GET https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=<id> (schemas); fal model pages via fetch.
fal pricing API https://api.fal.ai/v1/models/pricing?endpoint_id=<id> -> "API key authentication required" (BLOCKED keyless); prices below are from model pages.

| endpoint | listing date | refs | size / 2:1 | price (page) |
|---|---|---|---|---|
| openai/gpt-image-2.6/sunburst/edit | 2026-11-04 | 16 | max edge 3840, area 8,294,400, aspect<=3:1, mult of 16 -> 2:1 OK to 3840x1920 | token-billed; high 2048x2048 $0.107, 3840x2160 $0.100; low/med dearer than 2.5 |
| openai/gpt-image-2.6/flare/edit | 2026-11-04 | 16 | same | same table |
| openai/gpt-image-2.5/sunburst/edit (baseline) | 2026-09-08 | 16 | free width/height (max 14142 in schema), table up to 3840x2160 | 1920x1072: low .0044 med .0095 high .039 xhigh .070 max .158; 3840x2160 high .100 xhigh .178 max .400; +~$0.008-0.012 per ref image |
| blackforestlabs/flux-3/edit-image | 2026-10-01 | 10 | aspect_ratio enum includes "2:1"; tiers 768sq..4k (4k = minutes) | $0.048 per 1K image; per-MP, doubled 2026-10-16 (third-party trackers) ; 2k/4k unverified |
| google/nano-banana-2.1/edit | 2026-10-06 | 14 | ratios list has NO 2:1 (21:9, 4:1, 8:1 yes); 1K/2K/4K | 1K .044 / 2K .063 / 4K .138 (2 refs) |
| bytedance/seedream/v5.5/edit | 2026-11-11 | 10 | 0.92-4.62 MP, aspect 1/16..16 -> 2:1 up to ~3040x1520 | $0.03 (<=2.61MP) / $0.0405 + $0.012 per input image |
| minimax/h3-image/edit | 2026-11-10 | 16 | up to 20 MP, aspect 1:3..3:1 | tokens: $1.50/M img in, $3.80/M img out (no per-image) |
| alibaba/qwen-image-3/edit | 2026-07-21 | 3 | pixels up to 2048x2048 | $0.04 1K / $0.075 2K |
| krea/v3/edit | 2026-10-14 | 8 | max 4.22 MP | $0.025/MP incl. refs |
| meta/muse-image/edit | 2026-08-21 | 10 | any "w:h" ratio | unverified |
Structure-locked: fal-ai/z-image/turbo/controlnet (2025-12-07; depth/canny/pose; control_scale; ~$0.0065/MP; 1 control image, text-to-image style, no multi-ref) ; fal-ai/flux-control-lora-depth/image-to-image (2025-02-11; model page 404, price unverified); fal-ai/sdxl-controlnet-union (2024). Nothing newer found in `q=controlnet|depth|structure`.
Upscalers: fal-ai/seedvr/upscale/image ($0.001/MP, factor<=10 or 720p-2160p target); .../seamless (2026-03-23, $0.0025/MP, "retaining seamless tiling", no pano mention); topaz/upscale/image/precision ($0.08 per started 24 MP output, factor<=4, "faithful"); fal-ai/clarity-upscaler ($0.03/MP, generative); fal-ai/recraft/upscale/crisp ($0.004/image, size unverified); clarityai/crystal-upscaler, bria/increase-resolution: not loaded.
Nobody mentions equirect wrap-edge handling.
