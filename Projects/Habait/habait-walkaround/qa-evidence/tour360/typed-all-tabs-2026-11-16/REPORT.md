# A typed change in every tab that sees the spot — P1 evidence ($0)
<!-- last-updated: 2026-11-16 -->

Plan: `C:\RnD\development\plans\2026-11-16-typed-change-all-tabs.md` · worktree `typed-change-all-tabs` · asked by Eliran 2026-11-16.

## What was run
| Check | Command (from `Habait/tour360/`) | Result |
|---|---|---|
| The handler's follow turn, no vendor | `node tools/follow-check.mjs` | 33/33: token signed and opened, no text step, two images in order, altered / foreign / expired token refused, cap and code hold, surface and catalog turns carry no token, **nine kinds of old turn send the vendor the same requests as main's handler** |
| The page, desktop | `node tools/follow-live-check.mjs --room kitchen --look=-14,-5,80 --expect dining,living --size 1440x900` | 18/18, record `1440x900-record.json` |
| The page, phone | same with `--size 390x844` | 18/18, record `390x844-record.json` |
| The speed bench, dry | `python tools/edit_bench.py --out <dir>` | 58 calls planned, books $2.35; refuses without `FAL_KEY` (exit 3) and over the cap (exit 1); the frame metric reads 0.00 on a held view and 0.54 on a re-framed one |

## What the page check is
A local copy of the served tour (`https://habait-flow.vercel.app/tour/`, fetched by GET, apt846) with this worktree's `viewer/tour.js` and `viewer/edit-live.js` swapped in and the plan scale the new build line writes (0.9 px/cm). The served `edit-live.js` equals main's byte for byte; the served `tour.js` differs from main's by one line (the return link the stage step rewrites). `api/edit` never left the page: a stub drew two plain figures on every view it was sent. No vendor, no key, no ledger row.

## What it showed (kitchen, looking at the dining table)
- The spot: 2.22 m from the kitchen camera, placed on the plan at (10.53 m, 6.36 m).
- The page aimed **dining** (2.07 m away, a 100° view) and **living** (4.78 m, 60°) and no other room. Both cut views show the dining table (`*-crop-dining-follow.jpg`, `*-crop-living-follow.jpg`).
- The two follow turns left within 1 ms of each other, each with the first turn's token, the kitchen's edited view as a 73 KB JPEG, and no words of its own.
- Each landed on its own room's stack, linked to the kitchen change; entering dining and living showed the changed picture (`*-3-entered-*.jpg`); undo in the kitchen cleared all three rooms.
- A room that came back unchanged was reported `not_in_view` and got nothing; a room the cap refused was reported and named on screen («בסלון השינוי לא הוחל», `390x844-4-refused-note.jpg`); the kitchen change stood.
- With a stub that answers in 1.2 s, both other rooms were done about 2.1 s after the first picture.

## What it does NOT show
- What a real editor draws from a second image: whether the same people appear, how alike, at what scale. That is the paid proof (plan §6 P2).
- Any real timing. The step times (`ms_text`, `ms_edit`) are now returned by the handler; nothing real has been measured.
- A full tour build: `tools/build-tour.mjs` was not run (the local media is not on this disk); its new line is covered only by `node --check` and by the page check patching the same value in.
- The engine's arrival-maths test (`engine/test/run.mjs`): `engine/node_modules` is not installed in this worktree; the block it evaluates was not touched.

## Known limits of v1
- Only changes of a thing inside the view (furniture, décor, people, pets). A wall or floor colour, the light and the view outside stay in their tab.
- A terrace does not receive a change made inside (its depth map stops at the glass); wardrobe has no depth map and is never aimed.
- The depth maps are from the 2026-11-03 camera spots (kitchen moved about 49 cm, entrance 20 cm): the aim can be several degrees off; the views are wide for that reason.
- At most 3 other rooms per change, nearest first.

---

# P2 — the paid runs (2026-11-16, on Eliran's «כן» to up to $5)
Booked **$3.76** in all (high side): the bench $2.48 of its $3 cap; the cross-tab proof $1.28 of its $2 cap (four end-to-end runs $1.20, the judge tests $0.09). Ledgers: `bench/ledger.json`, `real*/real-ledger.json`, `judge-anchor-test.json`, `judge-near-check.json`. The key was read by name from the root keys file; fal's router carried the text step and the judges (no OpenRouter key on this machine).

## 1. The editor speed bench — `bench/REPORT.md`, the pictures `bench/sheet-*.jpg`
52 calls, ten configs, two runs each, on the 1264×848 view the page cuts (the kitchen looking at the dining table).

| Case | Today | Fastest that held the frame | Notes |
|---|---|---|---|
| people at the table | `nb2-1k` 12.6 s | **`klein-9b` 3.8 s (3.3×)**, two people as asked on 2/2 | `klein-4b` drew three people once; `flux2-flash` and `flux2-turbo` drew three and moved the frame; `flux2-pro` re-framed 2/2; `seedream5-lite` right but 41–47 s; `grok` right, 10 s |
| chairs swapped by words | `kontext` 9.0 s | **`klein-9b` 4.1 s (2.2×)** | the ring reads 0.13–0.17 for every model here: the chairs reach the border of the view |
| a follow turn (a second image) | `nb2-1k` 15.6 s, held 1/2 | only `nb2` (1K and 0.5K) kept the first image's view, 1 of 2 each | `klein`, `flux2-turbo`, `grok` answered the SECOND image's view (0/2): never for a follow turn |

fal's own prices (read with the key, `edit_bench.py --prices`): kontext $0.04 and nb2 $0.08 an image; seedream5-lite $0.035, grok $0.02; klein-9b $0.011 and klein-4b $0.010 a megapixel; flash $0.005, turbo $0.008, flux2-pro $0.03 a processed megapixel.

**Decision taken in the branch:** `klein-9b` takes the FIRST attempt of a change of a thing inside the view (`FAST_EDITOR` in `server/handler.mjs`; `null` restores the old routing); a refused answer goes on to `nb2`, then `kontext`, as before. Follow turns stay on `nb2-1k`. A resize, a wall, the light and the view outside keep their editors (not measured).

## 2. The cross-tab proof with real editors — one typed change from the kitchen: «להוסיף זוג שיושב ליד שולחן האוכל ושותה קפה»
| Run (folder) | First editor | Request → first picture | Of which | Other tabs | Booked |
|---|---|---|---|---|---|
| `real/` | nb2 | **33.3 s** | text 5.1 · editor 18.4 · judge 9.1 | living 20 s, dining 38 s (second attempt) — both landed, both right | $0.331 |
| `real-fast/` | klein | **16.0 s** | text 4.5 · editor 3.5 · judge 7.4 | dining 20 s right; living 23 s **wrong: the couple and the table three times too large** | $0.210 |
| `real-fast-2/` | klein, judge answer cut → nb2 | 37.2 s | text 4.9 · klein 3.5 · judge unreadable · nb2 14.1 | neither landed: living refused by a size rule that was wrong (the answer was right), dining rightly refused (table redrawn) | $0.449 |
| `real-final/` (the code as committed) | klein | **16.6 s** | text 4.3 · editor 3.6 · judge 8.2 | living 11.5 s, dining 19.3 s — both landed, both right; all done 19.9 s after the first picture | $0.206 |

- **The same people do appear in the other tabs**: same clothes, hair and build in every run that landed (`*/real-1440x900-3-entered-*.jpg`, `real-final/sheet-three-tabs.jpg`). Their seats are not geometrically the same seats seen from another side: the editor repeats the composition.
- **Where the wait is** (first picture, big change): the judge 7–9 s, the text step 4–5 s, the editor 3.5 s with klein (14–18 s with nb2). A small change skips the judge.
- **What went wrong on the way and what was done:**
  - Of the nine real follow answers before the last run, three were re-framed (the border ring refuses those; a second attempt is sent) and **two of the six whose border held had the dining table itself redrawn** (once three times too large, once smaller and moved). The plain furniture judge HELD the first — the largest piece in that view is the sofa in the foreground.
  - No pixel measure tells the two from the four right ones: ring, changed share, height against the plan, edges kept all overlap (`scripts/follow_metrics.py`, $0). A height rule built on the first bad sample refused a right answer in the next run and was removed.
  - A judge given the changed region's box picked the sofa again or answered unreadably; removed.
  - **The anchor judge** — "box the piece the added thing is AT, in the answer first, then in the original" — read all six right on two runs each: 12 of 12 (`judge-anchor-test.json`). Follow turns now use it for every answer that changed more than a tenth of the view.
  - Judge answers were cut at 900 tokens through fal's router (3 of about 12): the ceiling is now 2400 for both judges.
- **Still true:** a tab whose two attempts are both refused does not get the change, and the page says so («ב… השינוי לא הוחל»). Four runs, one view, one request: the rates above are small samples.
- **Not done:** merge, a full `build-tour` run (the local media is not on this disk), the test link, production.

## 3. Eliran's own example — an OBJECT, from another room (2026-11-16, later)
Eliran: every generation, not only people — «רמקולים ליד הטלוויזיה», seen from the living tab and from the dining tab. Typed in the living tab, looking at the TV: «להוסיף שני רמקולים עומדים על הרצפה משני צידי הטלוויזיה».

| Run (folder) | What happened | Booked |
|---|---|---|
| `real-speakers/` | **INVALID — my mistake.** The check's option parser ignored `--look=…`, so the view was the sofa, not the TV; the editor had no TV to stand speakers beside. It did expose a real fault: the page aimed the MAIN BEDROOM (behind the TV wall) and the editor was paid twice for it before the anchor judge refused both. | $0.366 |
| `real-speakers-tv/` | The view on the TV. First picture 19.3 s (text 4.3 s; the fast editor took 14 s this once, 3.5 s every other time). The page aimed **dining, entrance, kitchen** — the three other tabs of the open living space — and all three took the change on the first attempt (ring 0, changed share 0.02–0.06, no judge needed): two floor speakers beside the TV in each, at a believable size (`sheet-speakers-four-tabs.jpg`). All done 17.7 s after the first picture. | $0.278 |

- **Fixed after the invalid run:** (1) the parser takes `--name=value`; (2) the follow stays inside the same part of the apartment (`scenes.json` `zone`: the open living space, the bedrooms, the terrace). The TV wall is the main bedroom's wall too, the spot on it lies 18 cm behind the bedroom's side, and the depth test (which must forgive a chair in the way) let the bedroom through. With the zone rule the same view aims dining, entrance, kitchen (free check, the four cut views all show the TV wall).
- **Booked in all: $4.40 of the $5 approved** (the bench $2.48; the proof and its tests $1.93 of its $2 cap).
- **Still not covered:** a change of a surface (a wall's colour, the floor, the light) and of the view outside stay in their tab; a terrace does not receive a change made inside; a tab in another part of the apartment (a bedroom seeing the living room through an open door) is not aimed.

