# fonts/ — sources (board platform-ui-ux, card 05, fetched 2026-11-03)

Self-hosted; no runtime call to Google Fonts. Licence: SIL Open Font License 1.1 (`OFL-Heebo.txt`, `OFL-FrankRuhlLibre.txt`, each the package's own LICENSE file). Fetched with curl from jsDelivr (npm packages by Fontsource), $0, no npm install.

| File | Bytes | URL | sha256 |
|---|---|---|---|
| `frank-ruhl-libre-hebrew-500-normal.woff2` | 6624 | https://cdn.jsdelivr.net/npm/@fontsource/frank-ruhl-libre@5.3.0/files/frank-ruhl-libre-hebrew-500-normal.woff2 | `4a453ca787a3817f86b9b89dfd9aba66b3180ec5fb900f125047d65832354530` |
| `frank-ruhl-libre-hebrew-700-normal.woff2` | 6864 | https://cdn.jsdelivr.net/npm/@fontsource/frank-ruhl-libre@5.3.0/files/frank-ruhl-libre-hebrew-700-normal.woff2 | `51189306f07fdb3ede7c51193b76be170e175c1808bbc4d94e26e714b424ea83` |
| `frank-ruhl-libre-latin-500-normal.woff2` | 15012 | https://cdn.jsdelivr.net/npm/@fontsource/frank-ruhl-libre@5.3.0/files/frank-ruhl-libre-latin-500-normal.woff2 | `4beaeeb42ab87bd5d008e833ba5f6d95a6eed587ba52e63851fa8ae8c24525e5` |
| `frank-ruhl-libre-latin-700-normal.woff2` | 15488 | https://cdn.jsdelivr.net/npm/@fontsource/frank-ruhl-libre@5.3.0/files/frank-ruhl-libre-latin-700-normal.woff2 | `5acad89af9e7ae0f88fabb94cc6b4ac37eb7a008ae7f3507be2506cf02d6ab9c` |
| `heebo-hebrew-wght-normal.woff2` | 12036 | https://cdn.jsdelivr.net/npm/@fontsource-variable/heebo@5.3.0/files/heebo-hebrew-wght-normal.woff2 | `f1f7cfaef59431c7b391df81fb05520273303840bbe917213a2ab9f41b839675` |
| `heebo-latin-ext-wght-normal.woff2` | 14748 | https://cdn.jsdelivr.net/npm/@fontsource-variable/heebo@5.3.0/files/heebo-latin-ext-wght-normal.woff2 | `dd3af41d4eac7f8b09b12d8d4a4bbf7ae13b0ff812560722d1a1d7c2077e02ea` |
| `heebo-latin-wght-normal.woff2` | 30116 | https://cdn.jsdelivr.net/npm/@fontsource-variable/heebo@5.3.0/files/heebo-latin-wght-normal.woff2 | `50dae2e12dae22c920388023e35aaebcd1e1d27bbe915c83d64210377e083e60` |
| `OFL-FrankRuhlLibre.txt` | 4397 | https://cdn.jsdelivr.net/npm/@fontsource/frank-ruhl-libre@5.3.0/LICENSE | `7eb9208b0f057da5220ebe784da4683f950a73be271f074d8bdfb6eac0ef4463` |
| `OFL-Heebo.txt` | 4379 | https://cdn.jsdelivr.net/npm/@fontsource-variable/heebo@5.3.0/LICENSE | `50ac3e340fcd4822b2904413d14b457e02392f0bef38cd790e88da82014be44f` |

Heebo: the variable face (axis wght 100–900, font version 3.100; the same face as `Habait/tour360/viewer/fonts/heebo-*.woff2`, whose source was not recorded, so this copy was fetched with a URL). Frank Ruhl Libre: static 500 and 700.

First paint for a Hebrew page needs `heebo-hebrew` + `heebo-latin` (digits, Latin names) + `frank-ruhl-libre-hebrew-700` (headings) = 49016 bytes (budget 120 KB). Every other file loads only when its unicode-range or weight is used.

## Round 9 of the Rainbow landing (2026-11-09): the landing's own faces
**Relocated 2026-11-09 (round 10):** these files now live in `../tools/_unused/fonts-r9/`; the landing uses Heebo + Frank Ruhl Libre again.
Free replacements, with full Hebrew glyphs, for the reference site's commercial Optima and Rag Sans (`qa-evidence/platform/rainbow-landing-2026-11-08/r9-reference/DESIGN.md`). Fetched with curl from jsDelivr (Fontsource), $0. Declared in `../css/rainbow-landing.css` (the landing only, not tokens.css). Bellefair: static 400. Assistant: variable, wght 200–800. First paint on the landing preloads `bellefair-hebrew` + `assistant-hebrew` (14 064 bytes).

| File | Bytes | URL | sha256 |
|---|---|---|---|
| `assistant-hebrew-wght-normal.woff2` | 7312 | https://cdn.jsdelivr.net/npm/@fontsource-variable/assistant@5.3.0/files/assistant-hebrew-wght-normal.woff2 | `f9805e7a16e108bcf6701e6a623fcf560bff3f28522fa94d310e833b3bd60400` |
| `assistant-latin-ext-wght-normal.woff2` | 11132 | https://cdn.jsdelivr.net/npm/@fontsource-variable/assistant@5.3.0/files/assistant-latin-ext-wght-normal.woff2 | `5e2544c15529ea4e9d1e9a8b074cab8013bc0c144b0fd9af9259eae94131a52c` |
| `assistant-latin-wght-normal.woff2` | 22096 | https://cdn.jsdelivr.net/npm/@fontsource-variable/assistant@5.3.0/files/assistant-latin-wght-normal.woff2 | `26b77cc3179a17ab4cf970985d5e51f06c472abcc6415f9bff6651e9285f21c2` |
| `bellefair-hebrew-400-normal.woff2` | 6752 | https://cdn.jsdelivr.net/npm/@fontsource/bellefair@5.3.0/files/bellefair-hebrew-400-normal.woff2 | `4050efdac53f4596afd7f029631f59a890861f1dba55fcd7432966b2178fd0a6` |
| `bellefair-latin-400-normal.woff2` | 16536 | https://cdn.jsdelivr.net/npm/@fontsource/bellefair@5.3.0/files/bellefair-latin-400-normal.woff2 | `8ab33f207ba2d9ff4a6437c0298643dbd2012e7c7eb776f260b303e5b2b1cdd9` |
| `OFL-Assistant.txt` | 4612 | https://cdn.jsdelivr.net/npm/@fontsource-variable/assistant@5.3.0/LICENSE | `ecb04f53902c0169b0c462c57899fbfc145c665beffef9535419594938fa8d31` |
| `OFL-Bellefair.txt` | 4388 | https://cdn.jsdelivr.net/npm/@fontsource/bellefair@5.3.0/LICENSE | `b6205cabf6868f1240b2378a33d4e83a489b65b1033ef902448f58acd615739f` |
