## 2026-11-08 · main session · backend plan for the visualization system
- **Did:** On Eliran's ask ("תתכנן את ה-Backend"), wrote the full backend plan. Recommendation, not a decision.
  - **Scope (Eliran's answers):** buyers anonymous only, no billing, no developer integrations for now.
  - **Plan:** REST in Next.js; Supabase Postgres with plain-SQL migrations; Vercel Workflow (one run per unit, hooks for approvals and fal webhooks); Python workers (`pipeline-cpu`, `pipeline-gpu`).
  - **AI layer:** one `@habait/ai` package with a model registry and an `ai_ledger` table (unique key: reserve → call → settle).
  - **Models:** fal for image and video; Anthropic and Google direct for vision, judges and the agent.
  - **Geometry by construction:** Blender depth, normal and mask passes, then composite the structural pixels, then the existing fidelity gate.
  - **Storage:** 3 buckets. **Phases:** B0–B8.
- **Evidence:**
  - `development/plans/2026-11-08-backend-plan.md`; page https://claude.ai/artifact/4jgeYwf4Duqcq4Ncds4KJu
  - research plan `development/plans/2026-11-08-backend-integrations-models-research.md`
- **Learned:**
  - **fal billing:** invoice billing (via sales) is never auto-locked, which fixes 403 TOP_UP (fal.ai/docs/model-apis/faq, 2026-11-08). fal has no client idempotency key. Webhooks are ED25519-signed (JWKS), and webhook result payloads expire fast (~1 h, or ~6 min at ≥10 KB). Cost comes from the `X-Fal-Billable-Units` header × the pricing endpoint.
  - **Gateway budgets:** Vercel AI Gateway budgets are a soft cap.
  - **Prices:** Nano Banana 2.1 direct is $0.0336 per 1K image; NB2 on fal is $0.08.
  - **Licences:** the FLUX dev / Kontext dev family is BFL Non-Commercial. Qwen-Image-Edit and FLUX.2 klein 4B are Apache 2.0.
  - **In our code today:** three `falLLM` copies plus `chatFetch`, ledgers kept as files, no webhooks.
- **Owed / open:** six calls for Eliran:
  1. fal invoicing
  2. direct Anthropic and Google accounts
  3. AI Gateway for LLMs
  4. FLUX dev licence
  5. `work` retention, 30 or 90 days
  6. data region (EU default)

  B1 and B5 cost $0 and wait for his go and a board.
- **Second reader:** none (no decision yet).
