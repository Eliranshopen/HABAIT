---
name: feedback-fal-403-ask-the-vendor-first
description: A 403 from a deployed fal-backed function says nothing about its cause — ask fal directly with the same key before blaming a key or a deploy; the balance can run out mid-session
metadata:
  node_type: memory
  type: feedback
  originSessionId: 1637a6da-e282-40ec-b653-0b72a459bc37
  modified: 2026-11-18T06:24:48.753Z
---

On 2026-11-16 the test link's edit function answered `text step HTTP 403` after a deploy. I told Eliran the test project held an old key and had him approve replacing it; the canary failed again. Only then did I ask fal from this machine with the same key: «User is locked. Reason: Exhausted balance». The account had run dry between my last local paid call and the canary — my own approved runs that day ($4.40) used up what was left — and production's typed change (`habait-flow`) was down for the same reason.

**Why:** the hosted wrapper hides the vendor's text; a lock is on the fal ACCOUNT, so every key on every host answers 403; fal's balance is not readable through the API used here, so nothing warns before the last dollar. (This is my own reading of what went wrong; Eliran did not phrase a rule.)

**How to apply:**
- On any fal 401/403, first run a direct probe from this machine with the keys file's key (a text call through `server/chat-transport.mjs`, or an editor endpoint with an empty body) and read fal's own message. Only then name a cause.
- Before a paid batch, say plainly that the account's balance is unknown and that spending it can take the live site's typed change down; after a paid batch, re-probe before the next step that depends on fal.
- A paid canary after a deploy is still right — it is what caught this.
- **The free check of fal's credit (worked out 2026-11-18, when Eliran said «יש קרדיט בFAL אם אתה צריך תבדוק»):** two requests with the keys file's key, loaded by NAME through the pipeline's own `loadEnv(<folder>)` in a small script that masks the key in everything it prints. (1) `GET https://api.fal.ai/v1/account/billing?expand=credits` with `Authorization: Key <key>` returns `credits.current_balance` — but the key in the keys file is NOT allowed to read billing (HTTP 403 «This API key is not permitted to perform this action»); only a key made with the BILLING, READONLY or FULL preset can. So the AMOUNT is readable only in fal's dashboard, or with such a key. (2) A model call with an EMPTY body (`POST https://fal.run/fal-ai/image-preprocessors/depth-anything/v2`, body `{}`) is refused before it runs and bills nothing: HTTP 422 «Field required» = the account answers, not locked; HTTP 403 «User is locked» = no credit. Tell him which of the two I could and could not see.
- **A 401 is not always a key or a balance either:** on 2026-11-18 the engine's reading tool got HTTP 401 from OpenRouter because it sent no Authorization header at all (a code defect that showed only once a second key was in the keys file). Read what the request carries before naming a key or a balance.

Related: [[reference-keys-file]], [[feedback-keys-and-paid-calls]], [[reference-habait-sites]].
