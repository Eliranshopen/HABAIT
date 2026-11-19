---
name: project-film
description: "Plan and build a 60–75 s developer project film (סרטון פרויקט): site transformation, location map, lifestyle, building, interiors, logo, with Hebrew captions. Use when asked for a project marketing film from renders, drone footage and a sales brief."
when_to_use: "A request for a marketing/launch film of a residential project (a building or complex, not one listing): 'סרטון פרויקט', 'סרטון תדמית', 'סרטון שיווקי לפרויקט', 'a film like the Shimon HaTarsi one', a film from the developer's renders. Not for a single-apartment film from owner photos (video-division §3) or a platform screen recording."
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, AskUserQuestion
---

# /project-film — the developer project film

A recipe learned by taking apart one reference film frame by frame (2026-11-10): a 70.9 s film for a
two-building project in north Tel Aviv. Teardown: `references/reference-teardown.md`; frames:
`references/frames/`; how each shot type is made: `references/shot-recipes.md`; the storyboard
skeleton: `references/storyboard-template.md`.

**This skill gives the structure and the craft. `video-division` gives the rules** (budget D-VID-2,
disclosure D-VID-3, outward acts, machine rules, the producer/editor/QA agents). Read it first; on any
conflict it wins, and root `CLAUDE.md` §6 wins over both.

⚠ **Not hand-proven yet (root §3).** No film has been made with this recipe. The first one is run by the
main session step by step with evidence on disk; only then may an agent run it unattended.
⚠ **The reference is a pattern, never a source.** No frame, sentence, logo or music of it goes into a
Habait film (Eliran, 2026-11-09: inspiration, never a copy).

## 1. What the film is

| Property | The reference | Use |
|---|---|---|
| Length | 70.9 s, 24 fps | 60–75 s |
| Shots | 22 shots + logo card, average 3.2 s, range 0.7–8.7 s | 20–24 shots; nothing static longer than 5 s |
| Cuts | hard cuts everywhere; 2 "pass behind an object" wipes; no dissolves, no whoosh | same |
| Camera | every shot moves slowly: drift, push-in, orbit, crane; never a still | same |
| Text | one caption line at the bottom, a phrase at a time, 24 phrases ≈ 80 words | ≤ 28 characters per phrase |
| Audio | continuous music bed; narration matching the captions is **inferred, not verified** (no transcription was run) | music + captions; a voice is Eliran's call |
| Look | warm daylight, cream/white architecture, greenery, one dusk beat | one grade across all shots |
| Ending | hard cut to black, developer logo centred, 2.1 s | same |

## 2. The arc — ten beats (the storyboard skeleton)

| # | Beat | Share | What is on screen | Caption job |
|---|---|---|---|---|
| 1 | **Transformation hook** | 6 % | drone view of the real site; the old buildings sink away, the plot clears, the project rises (one shot) | the location promise, 2 phrases |
| 2 | **Location map** | 7 % | tilted aerial map, slow push; project pin + 3–5 walking-distance pills | the lifestyle thesis |
| 3 | **Project from the air** | 3 % | the building's roof with the landmark behind it | "steps from home" |
| 4 | **Lifestyle A — nature/calm** | 9 % | park, people, golden light; then the façade for the pay-off line | name 2–3 places, then "part of daily life" |
| 5 | **Lifestyle B — city/energy** | 11 % | 3 shots: promenade, boulevard, culture | "and on the other side…" |
| 6 | **Project reveal** | 15 % | dusk façade with the address as the caption, then day façades, a low-angle balcony shot | address · the facts (buildings, parking) · the architect |
| 7 | **Arrival** | 4 % | the entrance and lobby, people walking out toward the camera | lobby and finishes |
| 8 | **Apartments** | 29 % | living room → object wipe → terrace; apartment; penthouse; a 1.7 s aerial insert; penthouse → object wipe → balcony | apartments, penthouses, the balcony line, then the emotional line |
| 9 | **Close** | 12 % | aerial pull-back over the finished project, then the street-corner façade | the opening line again · the address · "a new project by <developer>" |
| 10 | **Logo card** | 3 % | black, logo centred | none |

Rules that make it work: the opening line returns at the close; the address appears twice (reveal, close);
facts sit only in beat 6; the building is intercut into the lifestyle beats so the place and the project read
as one; interiors get the longest shots; one silent shot (no caption) after the facts lets the film breathe.

## 3. Inputs — ask before planning (a missing one is reported, never invented)

| Input | Needed for | If missing |
|---|---|---|
| Exterior renders (≥ 4 angles, one dusk), interior renders (≥ 4), lobby render | beats 3, 6, 7, 8, 9 | stop: the film cannot invent the building |
| Real drone photo or clip of the site and neighbourhood | beats 1, 9 | drop beat 1's morph; open on the map |
| Address, plot outline, 3–5 real nearby places with walking minutes | beat 2 | measure the minutes on a map; never guess |
| Facts: buildings, floors, parking, architect, developer | beat 6, 9 | leave the phrase out |
| Developer logo (vector or large PNG) | beat 10 | stop |
| The sales plan / spec for anything shown inside an apartment | fidelity (HOT: sales-plan fidelity) | interiors only from the developer's own renders |

## 4. The workflow (lifecycle of `video-division` §5, with this film's content)

1. **Check the ground.** `video/` and its toolkit (`video/toolkit/bin/*.mjs`) must exist. If they do not,
   say so by name and stop before any generation: planning (steps 2–4) can still be done.
2. **Brief** — ≤ 4 questions through AskUserQuestion: the project and its assets folder, the format
   (16:9 master + 9:16 and 1:1 crops — recipe R10), voice or captions only, the budget.
3. **Script** — write the caption phrases first (§5 below), ≈ 80 words, then time them: one phrase per
   2–4 s. `SCRIPT.md`.
4. **Storyboard** — copy `references/storyboard-template.md` to `STORYBOARD.md`, one row per shot:
   source asset, shot recipe, camera move, seconds, caption, `subject` + `disclosure`, estimated cost.
   A plan → `development/plans/YYYY-MM-DD-<slug>.md` (root §8.8).
5. ⛔ **Eliran's yes on the storyboard** — with the §6 flags answered. Nothing paid before it.
6. **Generate** shot by shot from `references/shot-recipes.md`: dry-run, ledger row, `--go` inside the
   estimate; open every take; a take that changes the building's geometry is re-rolled, never shipped.
7. **Compose** — hard cuts on the caption boundaries; captions and map pills as HTML (`dir="rtl"`); the
   badge component; the logo card; music bed. Render in chunks (machine rules).
8. **QA** — `qa.mjs` + `video-qa` in a fresh context; check every row of §7. Then Eliran's review.

## 5. Caption and script rules

- A phrase is 2–5 words, ≤ 28 characters, one line. The reference broke this three times and the text ran
  off both edges of the frame — the single visible defect of the film.
- Phrases chain with commas into long sentences across cuts ("X, Y, / and Z"); the comma stays on screen.
- Order of ideas: where → what life is like → what is around (name real places) → the address → the facts
  → the architect → what is inside → one emotional line that refuses to describe → where again → the
  address → the developer.
- Style: white, regular weight, soft dark shadow, centred, baseline ≈ 92 % of frame height, no box, no
  animation; swap on the cut or mid-shot, never fade. Font: Heebo (division brand, N-7).
- Hebrew: plural-imperative house style where a call to action exists; numbers and the address range
  bidi-isolated (`hebrew-rtl-best-practices`); proofread by eye.

## 6. Flags — Eliran's calls, raised at the storyboard, never decided here

| Flag | Why | Until ruled |
|---|---|---|
| The transformation hook erases real buildings from real footage | root §6 add-only on real property footage; the reference does exactly this | propose it with the alternative (map-first opening); build only on his word; badged |
| AI lifestyle shots captioned with real place names | root §6: generated atmosphere is never captioned as a real project, address or place; the reference names the park and the port over generated footage | use real footage of the named place, or keep the caption generic |
| No badge in the reference | every AI-made or AI-altered image of a property, unit or person carries «הדמיה · AI-generated» for the whole shot (D-VID-3) | badge on every such shot |
| AI narration | open under D-VID-3 | captions only |
| 20+ generated clips against $10 soft / $20 hard | D-VID-2; the dry-run total decides, not a guess | stop at the soft cap and tell him |
| The developer's name, logo and the architect's name on screen | third-party brand, outward-facing | his go, per film |

## 7. Acceptance — the film is not done until every row holds

- [ ] 60–75 s; 20–24 shots; no shot frozen; no black frame except the logo card.
- [ ] Every caption fits inside the frame at every delivered ratio (16:9, 9:16, 1:1), with a 5 % margin.
- [ ] The opening line returns at the close; the address shows twice; the logo card ends it.
- [ ] Every building shot matches its source render: storeys, balconies, openings, façade pattern counted.
- [ ] Every interior matches the sales plan (fidelity is a hard gate).
- [ ] Every AI-made property/unit/person shot carries the badge for its whole length; `manifest.json` has a
      `subject` + `disclosure` per asset and none is `ask`.
- [ ] Walking minutes on the map are measured, with the source in the manifest.
- [ ] Spend inside the estimate; ledger rows settled.
- [ ] `qa/QA.md` verdict PASS or PASS-WITH-NOTES from `video-qa`.
