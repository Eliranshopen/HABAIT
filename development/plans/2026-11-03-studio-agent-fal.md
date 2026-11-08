# Plan: the developer's agent in the Studio, and file reading through a fal LLM
<!-- filed: 2026-11-03 ~22:10 · session rnd-23 · state: DONE 2026-11-03 23:37 — copied back, live tests green, paid check $0.17 (was: APPROVED under Eliran's blanket approval 21:50, "אני רוצה שעד הבוקר אני אקבל מוצר מוגמר אז הכל מאושר לך על זה") -->

**State:** approved under Eliran's blanket approval (recorded in `development/tasks/platform-ui-ux/task-01-eliran-calls.md`). Runs AFTER board platform-ui-ux copies back (card 20), because that board's working folder holds the Studio dashboard files this plan changes.

## Context
- **The chat (21:30):** Eliran asked where "the line to talk with an agent and the place for the developer to upload files" are. The upload exists, in the local Studio (board platform-ui-ux, cards 06–08). The chat was never planned. This plan closes that gap.
- **The model (21:35):** "אני רוצה שהLLM שיהיה מחובר כדי לקרוא את הקבצים של היזם יהיה מודל מFAL".
- **Today:** the Studio reads files with `lib/llm.mjs`. It has two backends: the Anthropic API key, or the `claude` CLI on Eliran's subscription.

## Decisions taken under the blanket approval (navigator mode, logged for Eliran's audit)
1. **The chat lives in the Studio**, on the project page: "שאלו את הסוכן". It answers ONLY from the project's own data (intake, files list, stage states, ledger), per root §6 "grounded agent". It says so in the panel. There is no buyer-side chat in this plan: a public chat needs a hosted server and a key on Vercel, which is a separate decision.
2. **The fal endpoint is `openrouter/router/vision`**, REST `POST https://fal.run/openrouter/router/vision` with `Authorization: Key <FAL_KEY>`.
   - Input: `prompt`, `system_prompt`, `model`, `pdf_urls`, `image_urls` (data URIs), `temperature`, `max_tokens`.
   - Output: `output`, `usage.cost`.
   - The model is set by `HABAIT_FAL_LLM_MODEL`. The default is a current vision-capable model id, picked from OpenRouter's public `/api/v1/models` at build time and logged.
3. **Backend order in `lib/llm.mjs`:**
   - `HABAIT_LLM_BACKEND=fal|api|cli`, when set, wins.
   - Otherwise `fal` when `FAL_KEY` is present AND spending is on (`HABAIT_ALLOW_SPEND=1`), then `api`, then `cli`.
   - The intake keeps its zod schema: JSON in the prompt, answer parsed and validated (as the CLI path does).
4. **Money:**
   - Every fal LLM call is checked against the project cap (`CAP_USD`) BEFORE it runs and ledgered with `usage.cost` after it (`ledger.json`, stage `intake` or `chat`).
   - Per-message chat ceiling: `max_tokens` 1200.
   - Build-night test budget: ≤ $1 in total, default caps $10 soft / $15 hard.
5. **Keys (§8.1):**
   - Nobody reads, prints or copies `FAL_KEY`; it travels by name.
   - The server loads it from the repo `.env` as it does today. A working copy gets the path through a new `HABAIT_DOTENV` setting, never a copied file.
   - `FAL_KEY` is BURNED (OWED-013); rotating it is Eliran's act, and the code needs no change after it.

## Steps
1. **Working folder** `.wt/studio-agent-fal` (after platform-ui-ux card 20). Files:
   - `studio/lib/llm.mjs`, `lib/env.mjs`, `server.mjs`, `pipeline/stages/intake.mjs` (backend label only);
   - `dashboard/index.html`, `dashboard/app.js`, `dashboard/style.css`;
   - a new `studio/lib/chat.mjs`;
   - new tests.
2. **`lib/llm.mjs`, backend `fal`:** same `structured()` contract.
   - PDFs go as `pdf_urls` data URIs (≤ 28 MB total, like the API path) and images as `image_urls` data URIs. Text is inlined.
   - The JSON schema goes in the prompt. The answer is stripped of fences, parsed and zod-checked.
   - Returns `{ ok, data, backend:'fal', model, usd: usage.cost }`.
3. **`lib/chat.mjs` + `POST /api/projects/:id/chat`:**
   - Grounded context: project meta, `intake.json`, the file list, stage states, ledger total. History: `chat.json` in the project folder, the last 12 turns.
   - Reply `{ reply, usd, model }`. Refuses when the backend is not fal/api/cli, or when the cap would be crossed.
   - `GET /api/projects/:id/chat` returns the history.
4. **Dashboard:** a chat panel in the project page between "מה המערכת הבינה" and "יצירה".
   - Messages, an input with a send button (Enter sends), and a "עונה רק מנתוני הפרויקט" note.
   - The cost of each answer via `fmtCost`, an honest error state, and the fixture's 405 handled like the other refusals.
   - On the tokens and components; RTL.
5. **Env screen:** `/api/env` shows the LLM backend as `fal · <model>` when active. No key value anywhere.
6. **Tests:**
   - `studio/test/llm-fal.test.mjs`: request shape against a local mock fal server (no network, $0), parse/validate, ledger row, cap refusal.
   - `chat.test.mjs`: the grounded context contains only project data, the history round-trip, and the cap refusal.
   - The existing `test/run.mjs` stays green.
7. **Live check (paid, ≤ $1):**
   - Run the working-copy server on :8853 with `HABAIT_DOTENV` pointing at the live `.env` and spending on for the run.
   - Do one intake re-read of a throwaway copy of apt846's sales plan, then two chat questions.
   - Ledger rows, costs logged, frames.
8. **Fresh reviewer** (refute-first), then copy-back, run entry, memory.

## Out of scope (named for Eliran)
- The Studio on the public site (needs a host for the server + Blender, sign-in, storage).
- A buyer-side chat.
- The other Studio stages (keyframes/video already use fal).

## Done when
- The intake reads the developer's files through a fal model, with the cost ledgered.
- The developer can chat with a grounded agent in the Studio.
- Tests are green, the paid check is ≤ $1 and logged, the reviewer verdict is filed, and the change is copied back.
