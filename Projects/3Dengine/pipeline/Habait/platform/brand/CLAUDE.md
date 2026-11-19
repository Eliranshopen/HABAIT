# brand/ — context file
<!-- last-updated: 2026-11-09 -->

## Purpose
The Habait brand. `habait-logo.svg` is Eliran's original vector (2026-11-09, verbatim: the HABAIT thin-line wordmark, the roof line and the Hebrew tagline «הבית של כל הבתים»; all fills #051F6E). Every other file is derived by `../tools/make_brand.py`, with rows in `manifest.json`:
- colour swaps: navy #051F6E for light grounds, white and sand #EDE3D3 for dark grounds;
- `habait-wordmark-*`: no tagline;
- `-small`: a same-colour hairline stroke for 24–36 px headers;
- `habait-mark.svg`: the favicon, the H plus the roof;
- `habait-touch-180.png`: the apple-touch-icon.

The optimised navy renders pixel-identical to the original (`test/brand-diff.check.mjs`).

## Gotchas
- No vector «HOME IS HABAIT» exists (only a raster). The EN pages use the wordmark without a tagline and never typeset one.
- Never edit `habait-logo.svg`. Change `make_brand.py` and re-run it.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Rule: root `CLAUDE.md` §8.6
