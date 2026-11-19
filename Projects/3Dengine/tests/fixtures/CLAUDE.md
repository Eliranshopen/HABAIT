# tests/fixtures/ — small files the tests feed the engine
<!-- last-updated: 2026-11-18 -->

## What's here
| File | Purpose |
|---|---|
| `sample.pdf` | (1.1) ONE page with a small vector drawing: 300 line segments, 6,910 bytes, written by `make-sample.mjs`, the same bytes every time. The first look finds one candidate in it, so a job can be started for it |
| `make-sample.mjs` | writes `sample.pdf` (`node tests/fixtures/make-sample.mjs`); `samplePdf({ text })` also gives the tests a PDF whose page carries a sentence, to prove no text of a PDF reaches an answer |
| `empty-page.pdf` | a valid one-page PDF with nothing on it (587 bytes; it was `sample.pdf` until 1.1): no candidate, `NO_PLAN_FOUND` |
| `apt846/source.pdf` | the GOLDEN input: the real sales plan of apartment 846 (183,222 bytes, sha256 `0c74ab30…542c0f0a`), a copy of `Projects/Habait/data/sales-plans/israel-canada/rainbow-tel-aviv/unit-846/source.pdf`. One sheet, 8,515 vector paths |
| `not-a-pdf.txt` | plain text: `NOT_A_PDF` |
| `make-expected-trace.mjs` | (1.2) writes `apt846/expected-trace.json` from the folder of a reading that was checked by hand: the status, the counts, every printed-dimension check, the sha256 of the three files that carry the measurement. Never typed by hand; room names are not copied |

## Subfolders
| Folder | Context file | Purpose |
|---|---|---|
| `apt846/` | [`apt846/CLAUDE.md`](apt846/CLAUDE.md) | the golden input of the engine's tests: the sales-plan PDF of apartment 846, (1.2) a saved reading of its drawing with the numbers a reading must reproduce, and (1.3) the same reading with one printed dimension changed by hand, which must fail its check |

## Conventions / gotchas
- **These files are bytes** (`../../.gitattributes`: `-text`): git must not change their line endings, and `tests/unit/intake-wiring.test.mjs` pins their hashes.
- This folder is in `engine.config.json` → `inbox`, so a test may pass these paths as `pdf_path`. A test that needs a large or a changed PDF writes it in a temp inbox, never here.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)
