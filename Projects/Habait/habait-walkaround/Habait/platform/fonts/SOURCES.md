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
