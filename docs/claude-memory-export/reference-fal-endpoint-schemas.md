---
name: reference-fal-endpoint-schemas
description: "fal publishes every endpoint's input fields without a key — the URL to check a model id and its request body before writing a call"
metadata:
  node_type: memory
  type: reference
  originSessionId: 1637a6da-e282-40ec-b653-0b72a459bc37
  modified: 2026-11-16T13:36:00.232Z
---

`https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=<endpoint id>` answers 200 with the endpoint's OpenAPI document (the `…Input` schema lists every field, its enums and defaults) and 404 for an id that does not exist. No key, $0. Used 2026-11-16 to verify the ten edit configs of `Habait/tour360/tools/edit_bench.py` (FLUX.2 klein 9b/4b, flash, turbo, pro; Seedream 5 lite; Grok Imagine; Nano Banana 2 at 0.5K/1K; Kontext).

Prices are NOT there: fal's pricing API (`https://api.fal.ai/v1/models/pricing?endpoint_id=…`) needs the key; fal's own guides (`fal.ai/learn/tools/…`) list prices but no measured seconds per model — speed has to be measured on our own crops.

Related: [[project-engine-mcp-plan]] (the two provider keys were not on the machine on 2026-11-16).
