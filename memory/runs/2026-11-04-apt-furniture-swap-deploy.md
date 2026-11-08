
## 2026-11-04 · main session rnd-67 · habait-flow: furniture swap + typed bar live for everyone
- **Did:** On Eliran's go rnd-67 deployed dpl_CUCZCiqcxt73cETiVB77UtU61Zig: 49 rings, 18-item AI catalog, typed bar, open host; FAL_KEY + TOUR_EDIT_OPEN=1 set in Vercel by command. Prod check: typed change turned the rug dark blue in 10 s. Three earlier tries got a fast 502 (cold function); the retry fix is staged as deploy-67-3 and waits for its own go.
- **Evidence:** `docs/governance/SHIP-LEDGER.md`
- **Learned:** On Vercel, functions run only from root api/: stage_flow --edit-api moves the tour function there and rewrites /tour/api/edit. A cold function can answer a fast 502 to a 235 KB POST.
- **Owed / open:** rnd-67: deploy go for the retry fix; paste-leftover fix; desktop bar clutter; chat-transport also became a function (harmless)
- **Second reader:** `habait-deploy-qa`

## 2026-11-04 · main session rnd-67 · Follow-up deploys: retry, phone rings, leftovers
- **Did:** Three more deploys on Eliran's 'מאשר הכל': Ee76 (retry a fast 502 from a cold function), 2862 (the rings can be tapped on phones; the bar folds at <=640px), 6wv1 (the table paste region rises over its decor; the editor continues the rug). Prod: the bed swap on the phone opens 3 beds; the walnut table swap is clean by eye; film + badge regression PASS.
- **Evidence:** `docs/governance/SHIP-LEDGER.md`
- **Learned:** A judge pass is not an eye pass: the leftovers came from the paste region (decor above a table's box), not from the editor. On phones the bottom stack's wrapper ate the taps on the rings. stage_flow.py must be run with --edit-api from now on.
- **Owed / open:** Desktop control clutter; rename api/chat-transport.mjs; IKEA photos; fal console spend limit (Eliran)
- **Second reader:** `habait-deploy-qa`

## 2026-11-04 · main session rnd-67 · UI asks shipped: phone parity, one entry, guide strip
- **Did:** dpl_BJMceg7g: desktop controls on one row; phone guide = compact bottom strip; typed bar always on phones; phone stack one control row; language one cycling button; ui=min shows every feature; the unit card has only «המשיכו אל הדירה». Prod walk through the continue path PASS on phone and desktop.
- **Evidence:** `Projects/Habait/habait-walkaround/qa-evidence/tour360/furniture-swap/prod/prod-continue-flow.json`
- **Learned:** ui=min (the buyer path) hid the look switch and the change button: features must be checked on the path the buyer actually takes, not on /tour/ directly. Two platform browser-test FAILs pre-date this (F20 lead/WhatsApp).
- **Owed / open:** Platform browser test: 2 stale assertions (lead form, WhatsApp) to update; the landing view in terraceLiving faces a wall (F05)
- **Second reader:** `habait-deploy-qa`
