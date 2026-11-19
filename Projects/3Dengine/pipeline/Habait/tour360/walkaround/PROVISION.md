# PROVISION — what the project `habait-walkaround` needs, by name

Board `habait-walkaround` T02 · plan `Habait/tour360/WALKAROUND-PLAN.md` v0.4 §3, §7 · his rulings D-T360-38 (its own project),
D-T360-39 ($20 hard), D-T360-40 (the view open, changes by code, $5 a day), **D-T360-41 (Neon Postgres for jobs and the ledger)**.

⛔ **Names only.** No value of any secret appears in this file, in git, in chat, in memory or in a report. Console acts are
Slava's; an agent sets an env var only on his ask, with `vercel env add <NAME> production` reading the value on standard input,
from the staged scratchpad folder — never from the harness tree (standing law 3) and never displayed (the D-T360-23 precedent).

## 1. The project

| What | Value | Who / when |
|---|---|---|
| Vercel project | `habait-walkaround` under team `slavas-projects-bc553f3f` → `https://habait-walkaround.vercel.app` | created by the first deploy, T09 (the lab), on his deploy go |
| Deployment protection | the production alias public; per-deployment URLs behind Vercel Authentication (the team default) | as created |
| Headers | `X-Robots-Tag: noindex, nofollow` · `X-Content-Type-Options: nosniff` · `Referrer-Policy: strict-origin-when-cross-origin` — in `walkaround/vercel.json` | T17 |

## 2. Stores (his console acts, after T09 creates the project)

| Store | Console path | Env it creates (names) | Used by |
|---|---|---|---|
| **Neon Postgres** (D-T360-41) | Project `habait-walkaround` → Storage → Create Database → Neon (free plan) → connect to Production + Preview | `DATABASE_URL` (+ the integration's companions, e.g. `DATABASE_URL_UNPOOLED`, `PG*`) | job rows + persisted events (T20), the hosted ledger with reserve-and-settle in one transaction (T24), the kill row |
| **Vercel Blob** | Project → Storage → Create → Blob → connect | `BLOB_READ_WRITE_TOKEN` | patches (T23), versions (T30), ready-made looks (T29), swatches (T27) |

On the laptop the same SQL runs on an embedded Postgres (PGlite — T20 decides, T0) and Blob writes go to a local folder under
`apartments/<id>/_local/`, so no development step ever needs the production store's credentials.

## 3. Environment variables (Production)

| Name | Secret? | Value comes from | Set by · when |
|---|---|---|---|
| `FAL_KEY` | yes | the root `.env` (the same account; its balance is the real cap) | `vercel env add` on stdin on his ask · before T36 |
| `OPENROUTER_API_KEY` | yes | the root `.env` (topped up by 2026-10-10 after the 402s of 2026-10-09) | `vercel env add` on stdin on his ask · before T36 |
| `WALK_EDIT_CODE` | yes | **he picks it** and sets it in the console, so he knows it without anyone sending it; the laptop uses its own dev value in the root `.env` | Slava · before T36 |
| `WALK_SHARE_SECRET` | yes | fresh random bytes, generated into stdin, never displayed | `vercel env add` on stdin on his ask · before T36 |
| `WALK_DAY_CAP_USD` | no | `5` (D-T360-40) | at T36 |
| `WALK_TOTAL_CAP_USD` | no | what remains of the board's $20 at deploy time (D-T360-39) | at T36 |
| `WALK_KILL` | no | unset = off; `1` stops every paid call at once | his console, any time |
| `DATABASE_URL` · `BLOB_READ_WRITE_TOKEN` | yes | created by the store integrations (§2) | his console acts |

`TOUR_EDIT_CODE`, `FAL_KEY` and `OPENROUTER_API_KEY` on the OLD project `habait-tour-design` are untouched here — their fate
is T39 (OWED-432). The rows by name: `docs/governance/SECRETS-LEDGER.md` (T03, `secrets-steward`).

## 4. Canaries (before any paid run)

| Vendor | Call | Result |
|---|---|---|
| fal | one ≤ $0.01 call through the board ledger | pending — run after T01 releases the ledger (one writer) |
| OpenRouter | one short text call | pending — same |

## 5. The order

T09 deploys the lab and creates the project → he connects Neon and Blob (§2) and sets `WALK_EDIT_CODE` → W3 is built and
tested on the laptop against PGlite → T36: the remaining env on his ask, then the deploy on his go.
