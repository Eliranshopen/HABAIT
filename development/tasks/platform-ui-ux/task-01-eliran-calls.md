# Task 01 — Eliran's calls
**Agent:** main session → Eliran · **Ruling tier:** T1 · **Burst:** 1 · **Depends on:** —
Nothing on this board runs before (a). Ask everything in **one** AskUserQuestion, recommended option first, default stated so silence still moves.

## The calls
- **(a) Approve the plan and its five defaults** (plan §"The five defaults"): the Studio is local only; both themes are built and Eliran picks at Gate 1 (light until then); Heebo + Frank Ruhl Libre self-hosted (OFL, $0); chrome over the visualization gets tokens only; the legal wording is unchanged, shown as a one-line summary + "לנוסח המלא". **Default:** approved as written.
- **(b) The apartment-3d hold** (README Key state). `.wt/apartment-3d/manifest.json` holds all 235 platform files, so `wt.py` refuses every platform path until that board closes.
  - **Wait (recommended, default):** session 1 runs cards 01–08 (Studio, `stage_flow.py`, tokens, style guide); session 2 starts at card 09 once apartment-3d's manifest is `closed`. Nothing about another board changes.
  - **Release:** rnd-fd (apartment-3d's session) removes from its manifest the 224 paths it never changed, so this board can open them now. It is rnd-fd's act on its own record, not ours, and its card 10 copy-back must still come before our cards 13–16 touch `style.css`/`apartment.*`.
- **(c) Installs in the working copy** (root §9 spirit; plan "Eliran decides" 2).
  - `npm ci` in `.wt\platform-ui-ux\files\Projects\Habait\habait-walkaround\Habait\studio` for card 08 (the plan's ask; Studio needs `zod`).
  - and, only if card 09 shows the platform tests cannot run on `HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps`, `npm ci` in the working copy's `Habait/platform` (one package, `three`, as apartment-3d did).
  - **Default:** no go yet. Card 08 waits, and session 1 ends at card 07.
- **(d) Information, not a question:** the three navigator calls in README Key state (Studio before Gate 1; `habait-ux-judge` for Phase 4.4; the font load split in two). Eliran may overrule any of them.

## Answers (2026-11-03, new session, one AskUserQuestion; Eliran's own selections)
- **(a)** "Approve as written (Recommended)" → plan and its five defaults approved; board `EXECUTING`.
- **(b)** "Wait (Recommended)" → session 1 runs cards 02–07; cards 09+ start once `.wt/apartment-3d` shows `closed`. No release asked of rnd-fd.
- **(c)** "No go yet (Recommended)" → no `npm ci`; card 08 waits; session 1 ends at card 07.
- **(d)** the three navigator calls were not overruled.
- **(b) changed, 2026-11-03 later the same session:** Eliran: "כן" to "לבקש מהסשן של apartment-3d לשחרר את 224 הקבצים שהוא לא שינה" → **release requested**. Message sent to rnd-fd (msg 0b48d97f) naming the paths cards 09–15 need. It is rnd-fd's act on its own manifest; this board waits for its reply and never routes around the refusal. rnd-fd released 37 paths at 17:14.
- **(c) changed, 2026-11-03 ~17:35:** Eliran: "תעשה מה שצריך בשביל להגיע לתוצאה ושנתקדם" → read as the `npm ci` go for card 08, in the **working copy's** Studio only. It is not a go for an install in the live tree (OWED-023 stays his), for copy-back (card 20) or for any deploy (root §9).
- **Gate 1 theme:** the same words are read as "the default if silent": **light**, applied after the reviewer's PASS. Eliran can switch to dark with one word.
- **Blanket approval, 2026-11-03 ~21:50.** Eliran, verbatim: "אני רוצה שעד הבוקר אני אקבל מוצר מוגמר אז הכל מאושר לך על זה".
  - Read as approved:
    - Gate 2 (the legal-summary display; the wording is unchanged);
    - the copy-back at card 20 after the gates pass;
    - Vercel preview deploys;
    - a new plan for the developer agent chat + reading files through a fal LLM, with paid calls under the default caps ($10 soft / $15 hard) and ledgered.
  - NOT read as approved:
    - a production deploy (root §9: each prod deploy needs its OWN explicit go). It is prepared for a one-word morning go.
    - reading, printing or rotating any key (§8.1). FAL_KEY is burned (OWED-013), and rotating it is Eliran's act.

## Files
- modifies: this card (the answers), `README.md` (State, Key state), `development/tasks/CLAUDE.md` (board row State), `development/plans/2026-11-03-platform-ui-ux.md` and `development/plans/CLAUDE.md` (state line)

## Acceptance
- Each answer is written here with its time and Eliran's own words.
- On (a) "go": the board State becomes `EXECUTING` in the README and in the board table, and the plan's state line says approved.
- If (b) = release, the README Key state names the time rnd-fd confirmed it and the paths released.

## Standing rails (inherited verbatim from the board README — root `CLAUDE.md` §0)
1. **Bounded read-first:** `memory/HOT.md`, then the LAST ~150 lines of your own `memory/agents/<name>.md` (plus its archive-index block). ⛔ Never read `memory/INDEX.md` whole — grep it.
2. **Write last, once:** ONE entry (`memory/_TEMPLATE.md`) into the layer that owns the fact, plus ONE ≤ 400-char pointer line under that layer's existing `memory/INDEX.md` header. ⛔ Never add a header.
3. **Second reader:** name which OTHER actor must know this; append ONE pointer line into their `memory/agents/<name>.md`, or say "none".
4. **An action is not done until its memory is written.**
5. ⛔ **The live files under `C:\RnD\Projects\Habait\habait-walkaround\` and `C:\RnD\Projects\Habait\tools\deploy-vercel\` are read-only to every card until card 20.** Every write goes into `C:\RnD\.wt\platform-ui-ux\files\<path relative to C:\RnD>`, into `.wt\platform-ui-ux\tools\` (dev scaffolding that is never copied back) or into this board folder. Memory rows are the only live writes (root §8.7).
6. ⛔ **No git anywhere** (Eliran, 2026-11-03). `CHANGES.md` in the working folder is the diff.
7. ⚠ **Machine resource rules** (root `CLAUDE.md` §12): every test, build, server, browser or install runs as `timeout N <cmd>`, one heavy run at a time, in the foreground; kill what you start by PID. This board's ports: **:8852** (platform preview) and **:8853** (Studio, fixture or real). Never :8850, :8851 or :8820 (other sessions).
8. ⛔ **$0 board:** no paid call, no paid Studio stage, no Blender, Kling or fal. `npm ci` runs only on Eliran's go (card 01c). Deploying is a separate explicit go from Eliran (root §9).
9. ⛔ **Out of scope, never edited:** `/hold/` (flyover3d), `/tour/` (tour360), every clip and render, `js/apartment-3d.js`, `tools/build_zip.mjs`, the behaviour of `flow.js`, `viewer360.js` and `cine.js`, and the Studio server, pipeline and API. Legal and accessibility **wording** is Eliran's (§6). Every AI image keeps its "הדמיה · AI-generated" badge.
10. ⛔ **A path held by another open working folder is never copied in.** `wt.py` refuses it; never route around the refusal (no plain copy, no manifest edit, no second folder). Wait, or take Eliran's ruling (card 01b).
