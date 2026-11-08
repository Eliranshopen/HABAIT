# catalog/ — the items a visitor can put in the room instead of words (CATALOG-PLAN.md, T14)

**What is here.** `items.json` (tracked): one row per item — id, brand, name, article, category, colour, size, price with its
read-on date, the product page, the photo's file name and its SHA-256, the view it is proven in, and one English sentence the
text step uses. `_local/<id>.jpg` (**gitignored, never committed, never on a public host until CATALOG-PLAN.md OQ-C1 is
ruled**): the product photo, the product alone on white, ≤ 1024 px on the long side, ≤ 400 KB — the second image the people
editor gets beside the visitor's view.

**The licence line.** The prototype's photos are IKEA Israel's, read one page each by hand on the date in `source.read_on`,
reference-only on this laptop (his ruling of 2026-10-07, «Laptop host first»). IKEA's terms require permission for third-party
use of its product content; nothing here is a licence. A build with `--catalog` copies the photos into `dist/<id>/catalog/` —
that build is for the laptop host only until he rules otherwise.

**Adding an item.** Save the photo as `_local/<id>.jpg`, add its row to `items.json` (copy a row; `category` and `view` are
closed lists — see `tools/catalog-check.mjs`), then:

```
timeout 300 node Habait/tour360/tools/catalog-check.mjs --write     # verifies every row and photo, records the hash
timeout 300 node Habait/tour360/tools/catalog-check.mjs             # the plain check, exit 1 on any miss
```

The hash is what the handler trusts (D-CAT-9): a request whose reference image does not hash to a catalog row is refused with
`catalog`, so a visitor with the unlock code cannot have the tour copy an arbitrary picture into the room. A changed price is a
stale row with an honest date, not a bug; prices are never scraped.
