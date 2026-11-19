# 05 — Recommended production architecture (Phase 5)

One sentence: **keep the deterministic plan → Blender → equirect pipeline, render each viewpoint N times with different light only, and blend the two nearest keyframes in the browser by the clock.** It is the reference's mechanism with our fidelity guarantees.

```
sales-plan PDF ─▶ plan.json (trace + fidelity gate) ─▶ build_scene.py ─▶ scene.blend (geometry, furniture, materials: style lock)
                                                                  │
                                    lighting_presets.json ──▶ relight.py ×N (world, sun, lamps, exposure — nothing else)
                                                                  │
                                                     render_pano.py ×N (same camera, seed, res) ─▶ pano_<key>.webp + depth.png
                                                                  │      depth hash identical ⇒ aligned (gate)
                                                    scene.json (nodes, keyframes{hour,src}, views, hotspots)
                                                                  │
                                         browser: WebGL shader, mix(K_i, K_i+1, t(clock)) ─ slider · play · ticks
```

1. **Plan → geometry:** unchanged (`plan.json`, `build_scene.py`, the 1 % fidelity gate). The night look never touches geometry.
2. **Furniture/materials:** unchanged (style lock + add-only rule). Night needs *light fixtures* (cove strips, pendants, under-cabinet LEDs) as décor; they are emitters with an `interior` scale, off by day.
3. **Photoreal lighting:** Cycles + AgX. Per keyframe only the world (Nishita sky / night colour or a licensed dusk HDRI), the sun lamp (azimuth/elevation from the real north arrow and the city's sun path), lamp energy and exposure change. Sun path: compute from latitude + date (e.g. Tel Aviv, equinox) instead of hand values.
4. **Navigable:** per-room equirect nodes, rotation-only (as the reference); hotspots and tabs = node changes and yaw tweens.
5. **Day/Night control:** clock 06–22 → (K_i, K_i+1, t). Preload all keyframes of the current node; keep the hour when changing node. Optional "linear-light" mix and, later, a separate *lamps-only* pass faded independently (fixes the mid-fade double shadow and gives a "lights on/off" switch for free).
6. **Delivery:** static files (webp per keyframe, `scene.json`, one JS file); CDN-cacheable; works in the existing Vercel static deploys. Port path: a `mix` uniform in the PSV/three engine (`tour360/engine`) or the standalone shader.
7. **Desktop + mobile:** WebGL1 shader, textures capped to `MAX_TEXTURE_SIZE`, pointer events (touch drag, pinch), 32 px targets, safe-area insets; verified at 1440 and 390. Memory: 6 keyframes × 8K webp ≈ 6 × 8192×4096×3 B ≈ 600 MB GPU — too much for phones → serve 4096 (≈150 MB) or multires/cube tiles per keyframe on phones, 8192 on desktop.

**Cost per viewpoint** (CPU here): 6 keyframes × 2048² × 16 spp ≈ 27 min, $0. At product quality (8192×4096, 256 spp) on the GPU box: ≈ 6 × 23 min. Cash cost $0; compute is the limit → render keyframes only for hero rooms, or 4 keyframes (morning, noon, sunset, night) instead of 6.

**Rejected:** real-time 3D (cannot match on phones; the reference doesn't use it), Gaussian splats (no relighting), Pixel Streaming (per-viewer GPU cost), AI relight as the base (object drift seen in the reference; only as an AI-badged extra behind a diff gate, Eliran's call).
