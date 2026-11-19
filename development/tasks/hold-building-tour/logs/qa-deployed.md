# Card 07 - QA on the deployed site (habait-flow.vercel.app)
VERDICT: PASS

Date 2026-11-04. Target https://habait-flow.vercel.app only (dpl_3avVrzv8...). Headless Edge via playwright-core, fresh logged-out contexts, deployed URLs only.

## Provenance
Served hold/index.html sha256 starts 5d9cdccb89f5c7c9, hold/app.js 8cf074b880f9cab1: both match the brief.

## 1. check-building.cjs on the alias
`node logs/check-building.cjs https://habait-flow.vercel.app logs/qa-deployed-shots` -> exit 0, 80/80 PASS, 0 FAIL, 4 devices (desktop, pixel7, iphone13, tablet). Tablet C3 (auto chain to tower) passed first run, no re-run needed. Output: logs/qa-deployed-check-run1.txt. Covers: button label/size/rtl/no overlap (B), frame opens in project scope from=hold, aerial, tower, tap 846 -> descent -> room, X on top, Esc, open/close x3 (C/D), old path #tourFrame scope=apartment unchanged (E), Z1 zero page errors, Z2 zero 4xx/5xx.

## 2. Paint proof (/hold/ -> button -> #buildingFrame)
Real network requests after the button click, all 200 image/webp: /tour/panos/node-a-aerial.webp (the aerial panorama), node-o1-orbit, node-o2-orbit, /tour/plan/floorplan.webp, plus thumbs; zero non-200 image responses.
| viewport | scene reached | frame box | canvas | screenshot pixels (64x64 sample) |
|---|---|---|---|---|
| desktop 1440x900 | aerial (then auto-advanced to orbit2) | 1440x900 | present, 1440x900 | 909 colour buckets, luminance mean 115, sd 46 |
| 390x844 touch | aerial (then orbit2) | 390x844 | present, 390x844 | 799 colour buckets, mean 134, sd 49 |
Non-uniform, non-black. Content check: m390_paint.png shows the tower over the sea, X button, Hebrew title (not an error body). 0 page errors, 0 console errors in both.
Evidence: logs/qa-deployed-shots/desktop_paint.png, m390_paint.png, paint-proof.json; script logs/gate-probes/deployed-paint.cjs.

## 3. Regression read (desktop 1440, 9 s each)
/ 200, /tour/ 200, /hold/ 200: 0 page errors, 0 console errors, 0 responses >=400 (favicon/posthog excluded). Output logs/gate-probes/deployed-regression.txt.

## Defects
None.

## Observations
- Not tested: Chrome proper (Edge channel only), habait.ai / app.habait.ai (other projects, out of scope), logged-in surfaces (none on these routes).
- The paint frame was sampled a few seconds after open, so the chain had moved aerial -> orbit2; the aerial pano request and aerial scene were both confirmed.
