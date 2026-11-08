---
name: video-division
description: "Front door of the Habait Video Division (video/): routes any ask to plan, make or edit a video, reel, film, promo, screen recording, captions, voice-over or AI b-roll for Habait or a listing to its workflow, agent, toolkit command and rule."
when_to_use: "Any request to make, edit, plan, caption, voice, re-cut, render or deliver a video, reel, film, promo, screen recording, motion graphic or AI b-roll for Habait (platform marketing) or for a listing or asset, and any question about the division's budget, disclosure or tools. Read it before any vendor video skill."
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, AskUserQuestion
---

# /video-division — the Video Division's front door

The division lives at `video/` (top level, N-1: it serves listings AND platform marketing). It makes Habait's
videos — mostly screen recordings of the live platform plus animation, effects and scrolling, and listing films
from photos. **Plan of record: `video/DIVISION-PLAN.md`** (it wins on any conflict with this file) · card:
`video/CLAUDE.md` · Eliran's installs: `video/OWNER-PASTE.md`. Operator language toward Eliran: English.

## 1. The four rulings (inherited 2026-10-14, now Eliran's — verbatim from the plan §1)

| ID | The answer | What it binds |
|---|---|---|
| D-VID-1 | «Both, HyperFrames first» | HyperFrames (HeyGen, Apache-2.0) is the default engine; Remotion 4 is the second engine for React-heavy screen-flow edits. Remotion is free only for companies of ≤ 3 people; at 4+ one «Remotion for Creators» seat ($25/month) is bought **before the first real Remotion deliverable** (OWED, Eliran's). |
| D-VID-2 | «$10 soft / $20 hard per video» | Every paid generation (fal.ai, HeyGen, any vendor) is ledgered per project; soft = stop and tell Eliran; hard = never crossed without their new ruling. Setup smoke tests stay under $1 in total. |
| D-VID-3 | «Like the hero films» | No label on atmosphere footage animated from **real** photographs (inherited ruling R-BC-4, 2026-09-22); an on-frame badge (״הדמיה״ / AI, amber) whenever a **property, unit or person** is AI-made or AI-altered. Screen recordings of the real platform carry no label. Not covered by the answer, so open and escalated (OWED-447): an AI **voice**, a **real** unit/property photo animated by AI (badged meanwhile), AI imagery **not** made from a real photo. |
| D-VID-4 | «Official MCP, sign in by OAuth» | HeyGen connects through its official remote MCP (OAuth, no key in `.env`); the CLI (no Windows build) is not installed. Eliran pastes the MCP command (installs are their); the fal.ai MCP is prepared the same way. |

## 2. Route the ask (first matching row)

| The ask | Route | Read |
|---|---|---|
| Platform launch film, feature reel, product demo from the live platform | `video-capture` flows (one per beat) → HyperFrames `product-launch-video` (a promo of habait.ai) or `general-video` (a custom reel or montage of the captured footage) | `video-capture`, then the `hyperframes` router |
| Listing or asset film from photos | `fal-gen.mjs` image-to-video (ledgered, dry first) → HyperFrames `general-video`; the Galia lessons (§3) | `general-video`, `hyperframes-keyframes` |
| Captions on existing footage | `transcribe.py` + a correction pass → `embedded-captions`; hand it the corrected words as its `transcript.json` so it never runs `uvx whisperx` | `embedded-captions` |
| Talking-head recut with designed overlays | `talking-head-recut` (transcript as above) | `talking-head-recut` |
| Motion graphic, logo sting, stat hit, lower-third (short, unnarrated) | `motion-graphics` | `motion-graphics` |
| React-heavy screen-flow edit (component-driven UI replay, data-driven variants) | Remotion: compositions in `video/engines/remotion/src/projects/<slug>/`, rendered with `--public-dir video/projects/<slug>/assets`; check the D-VID-1 licence row first | `remotion-best-practices` |
| Avatar presenter, dubbing, translation | HeyGen MCP — only after Eliran installed it (`OWNER-PASTE.md` §a); a `ledger.mjs reserve` row before every generation; a share link is an outward act | HeyGen's own tool list (`/mcp`) |
| AI voice-over | **Stop and ask Eliran** — an AI voice is open under D-VID-3; once ruled, `fal-gen.mjs --kind tts` | — |
| Music bed, SFX | `fal-gen.mjs --kind music\|sfx` (ledgered), mixed with `hyperframes-audio` | `hyperframes-audio` |
| Landing-page atmosphere loops (hero films) | not the division's first route — `habait-brand-media` owns them | — |
| Anything else (sizzle, montage, title card, deck) | `general-video` (`slideshow` for a navigable deck) | `general-video` |

## 3. The Galia lessons (a 56-s apartment film from 10 owner photos, Shani project, 2026-10-12)

- The owner's photos are read-only originals; work on copies in `assets/`. `listings/*/inputs/` stays read-only (rule 4).
- Chain the moves: start + end frame (Kling 2.5 Turbo Pro `tail_image_url`, MiniMax/Seedance `end_image_url`); a
  continuation starts from the previous clip's last frame. Concept that worked: every cut a doorway.
- Negative prompt carries `cables, hoses, cords, wires, pipes, extra objects appearing`; open every take — a take that
  invents geometry (Galia: a curved balcony that is not there) is trimmed to its honest half or re-rolled, never shipped.
- Bans: no Ken Burns on everything, no whoosh on every cut, no invented furniture, no gradient text, no slideshow drift.
- A unit's photo animated by AI is AI-made footage of a unit → `subject: unit`, `disclosure: badge` (D-VID-3). A
  declutter edit removes things — outside add-only (rule 4): only on Eliran's explicit word, and badged.
- Cost: 13 clips + 8 photo edits + music = $6.24 of $10. The soft cap is a realistic ceiling, not a target.

## 4. Who does what (the main session spawns; sub-agents never spawn)

| Role | Agent | Owns |
|---|---|---|
| Producer (opus) | `video-producer` | BRIEF, SCRIPT, STORYBOARD, engine choice, budget estimate; no Bash — never renders or pays |
| Editor (opus) | `video-editor` | captures, ledgered generation, transcripts, composition, chunked renders, delivery set; never publishes |
| QA gate (sonnet) | `video-qa` | `qa/QA.md` verdict, fresh context, refute-first; never fixes |
| Neighbours | `habait-brand-media` (landing atmosphere) · `video` (dormant Veo listing adapter) · `habait-ux-judge` (creative judgement when the brief asks) · `compliance-warden` (disclosure wording) · `secrets-steward` (credential names) | |

## 5. The lifecycle of one video (`video/projects/<slug>/`)

1. **Scaffold** (main session): `node video/toolkit/bin/new-project.mjs <slug> --title "…" --engine hyperframes --formats reel-9x16,landscape-16x9 --lang he,en`.
2. **Brief** — producer, `video/.claude/skills/video-brief/SKILL.md`: ≤ 4 questions, asked by the main session through AskUserQuestion, recommended option first.
3. **Script** → `SCRIPT.md`.
4. **Storyboard** → `STORYBOARD.md` beat table + the budget estimate + a contact sheet or a 10-s animatic (the editor renders the animatic).
5. ⛔ **Eliran's yes on the storyboard.** Nothing is captured for the cut, generated or paid before it (the inherited rule «a landing round is the mock first»).
6. **Capture / generate** — editor: `video-capture` flows; `fal-gen.mjs` dry, then `--go` inside the estimate.
7. **Compose** in the engine, then **render** in chunks.
8. **QA** — `qa.mjs` + the `video-qa` agent (fresh context) → `qa/QA.md`; `habait-ux-judge` when the brief asks.
9. **Eliran's review** — the render, `QA.md` and the phone copy.
10. **Deliver** — `deliver.mjs` builds the set; any upload or post waits for Eliran's own go.

## 6. The rules (the plan §4 — they bind every actor)

1. **Machine rules first.** Every render, capture, transcription, QA analysis and `npm run check` is heavy: Git Bash, `timeout N` as the first word (renders/captures 540 per chunk, QA 300), foreground, one at a time on the machine. A film longer than ~25 s renders in chunks (`toolkit/bin/render.mjs --chunk k`), one bounded call per chunk, then `concat`.
2. **Money.** No paid call outside `toolkit/bin/fal-gen.mjs` (or a manual `ledger.mjs reserve` row before an MCP generation). Dry-run is the default; `--go` pays. The project's `budget` (default $10/$20, D-VID-2) is enforced.
3. **Disclosure (D-VID-3)** is decided per asset in `manifest.json` (`subject` + `disclosure`): property / unit / person AI-made → the amber badge component is on screen for the whole shot; atmosphere from a real photo → nothing; an AI voice, a REAL unit/property photo animated by AI (badged meanwhile) and AI imagery not made from a real photo → `ask`: nothing ships until they rules (OWED-447) — `qa.mjs --project` fails and `deliver.mjs` refuses while any asset is `ask`. Every disclosure doubt escalates to Eliran — never a sub-decision.
4. **Honesty.** Add-only on real property footage (root `CLAUDE.md` §6): never remove damage, change a view, invent rooms or misstate size; generated media never depicts or is captioned as a real project, address or unit unless it is that unit's own photo animated from itself (that case still carries the badge until Eliran rules, OWED-447 (b)). `listings/*/inputs/` stays read-only.
5. **Outward acts need their own go.** `hyperframes publish|cloud|lambda|cloudrun|feedback|auth`, any `--file-issue`, any upload, any post to a social platform, any HeyGen share link — Eliran's explicit go each time (the wrapper `toolkit/bin/hf.mjs` refuses them without `--outward-go "<their words>"`). The one standing exception: the inputs of a ledgered fal call — `fal-gen.mjs` uploads files from the project's `assets/` (only there; never `listings/`) to fal's storage CDN and prints them as UPLOADS before `--go`; a client/owner/unit photo needs their go even there (`--upload-go "<their words>"`).
6. **Secrets by name only.** `FAL_KEY` is read from the root `.env` by the toolkit (never printed); demo sign-in credentials for captures are read into process memory only.
7. **Hebrew is checked by eye.** Raw ASR is never shipped: `transcript/*.words.json` gets a correction pass, then captions are re-exported (`transcribe.py --from-words`). Captions render as HTML with `dir="rtl"`, Latin and numbers bidi-isolated.
8. **QA before Eliran sees it.** `toolkit/bin/qa.mjs` (specs, loudness, black/frozen frames, contact sheet) + the `video-qa` agent's refute pass; a creative judgement goes to `habait-ux-judge` when the brief asks for one.

Past the soft cap `fal-gen.mjs` exits 3: tell Eliran, and continue only with `--past-soft "<their words>"`. Brand
(`video/brand/tokens.json`) is versioned: Heebo only (N-7), amber only for the badge, text on teal is navy.

## 7. Commands (Git Bash, from `C:/RnD`; tool timeout (N+60)×1000 ms)

```bash
timeout 300 node video/toolkit/bin/doctor.mjs                         # is the stack healthy?
node video/toolkit/bin/ledger.mjs summary --project <slug>            # spend: settled + open reservations
node video/toolkit/bin/fal-gen.mjs --project <slug> --id <call-id> --endpoint <id> --input <json|file> \
  --kind video --subject unit --out assets/<file> --est <usd>         # DRY by default: the plan and the estimate
timeout 540 node video/toolkit/bin/fal-gen.mjs … --go                 # pays: reserve → submit → settle|fail
timeout 540 node video/toolkit/bin/capture.mjs <flow.mjs> --out <dir/name> --fps 60 --dpr 2 --env-file <path>
timeout 540 node video/toolkit/bin/hf.mjs check <comp dir>            # never `npx hyperframes`
timeout 540 node video/toolkit/bin/render.mjs --engine hyperframes --project <slug> --comp <id> --plan
timeout 540 node video/toolkit/bin/render.mjs --engine hyperframes --project <slug> --comp <id> --chunk <k>   # one call per chunk
timeout 540 node video/toolkit/bin/render.mjs --engine hyperframes --project <slug> --comp <id> --concat
timeout 300 node video/toolkit/bin/qa.mjs <file> --format reel-9x16 --project <slug> --sheet 12
timeout 540 node video/toolkit/bin/deliver.mjs <file> --project <slug>
timeout 540 video/toolkit/py/.venv/Scripts/python.exe video/toolkit/py/transcribe.py IN --lang he --out video/projects/<slug>/transcript/<name>
timeout 540 video/toolkit/py/.venv/Scripts/python.exe video/toolkit/py/transcribe.py --from-words <corrected.words.json> --out video/projects/<slug>/transcript/<name>
```
Exit 124 is the bound, not a failure: report the tail, kill leftovers by PID, re-run ONCE smaller (machine rule 2).

## 8. Where the skills live (directory-scoped, N-2)

The 33 vendor skills (21 HyperFrames 0.8.160 + 12 Remotion 4.0.535, copied and pinned in `video/skills-lock.json`,
N-3) and the division's own `video-brief`, `video-capture`, `video-qa` live in **`video/.claude/skills/`**. They load
when a session works inside `video/` (listed as `video:<name>`); otherwise read the file directly —
`video/.claude/skills/<name>/SKILL.md` (the routers: `hyperframes/SKILL.md`, `remotion-best-practices/SKILL.md`).
⚠ The `hyperframes:*` skills in a session's list are Eliran's user-scope plugin at **0.8.96** — stale; use the
division's copies until Eliran updates it (`OWNER-PASTE.md` §c).

**Division overrides of the vendor text** (the vendor skills were written for a different house):
- `npx hyperframes …` → `node video/toolkit/bin/hf.mjs …` (telemetry off, N-6; outward verbs refused, rule 5); a vendor
  "send feedback after the render" step is never run.
- Never `npx hyperframes skills update`, `npx skills add`, `uvx …` or `npx --yes …`: the copies are pinned and installs
  are Eliran's. A missing dependency is reported to the main session, not installed.
- No Studio or preview server left running past a turn (machine rule 4), no desktop-app or Framey offers: Eliran opens
  previews himself (`npm run dev` in a HyperFrames comp, `npm run studio` in `video/engines/remotion`).
- Vendor render → `render.mjs` chunks; vendor transcription → `transcribe.py` + correction; vendor generation (`media-use`
  TTS/music/image, `hyperframes tts`) → `fal-gen.mjs` (rule 2), and any AI voice stops for Eliran first.

## 9. Escalate — always, never a sub-decision

Spend past the soft cap · any disclosure doubt or an AI voice · any outward act · a brand change · the Remotion licence
at 4+ people · generated media that could read as a real project, address or unit · a real person's data on screen.
