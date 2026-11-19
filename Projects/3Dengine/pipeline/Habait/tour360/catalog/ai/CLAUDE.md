# catalog/ai/ — context file
<!-- last-updated: 2026-11-04 -->

## Purpose
The AI-made catalog items (plan `development/plans/2026-11-04-apt-furniture-swap.md` P2; Eliran 2026-11-04: "Ikea and Fal generators models"). They are generic pieces, not real products: one product photo per row of `../ai-spec.json`, made on fal `nano-banana-2` by `../../tools/catalog-gen.mjs`, ≤ 1024 px and ≤ 400 KB. Unlike the retailer photos in `../_local/`, they are tracked and can go on a public host. The page shows each one with the "הדמיה · AI-generated" words and no price or link.

## Key files
| File | What |
|---|---|
| `ai-*.jpg` | the 18 product photos (sofa 3, armchair 3, coffee table 2, dining table 2, chair 2, bed 3, lamp 2, rug 1) |
| `ledger.json` | each paid call, reserved before it is sent and settled after (cap $3) |

## Gotchas
- Never hand-edit a photo: its SHA-256 is in `../items.json` (`catalog-gen.mjs --rows`), and the edit handler refuses a photo whose bytes do not match.
- A new item = a row in `../ai-spec.json`, then `catalog-gen.mjs --go --only <id>`, then `scan-pieces.mjs apt846 --refinish` if it brings a new category.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)
