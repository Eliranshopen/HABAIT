## 2026-11-08 · main session · frontend plan for the visualization system
- **Did:** On Eliran's ask ("תעשה גם ל-FRONTEND ממש מא עד ת"), wrote the full frontend plan. It is a recommendation, not a decision. Research: four agents (code map, app architecture, tour/mobile performance, a verification pass of about 38 official checks).
  - **Framework and rendering:** Next.js 16.4 with Cache Components; the poster `<img>` is the LCP and the viewer is client-only.
  - **Tour:** `<habait-tour>` on PSV 5.15.1 + three 0.185, with an API, events and a parity list; tiles up to 4096 on phones.
  - **Data and forms:** react-hook-form + zod; the PDF uploads straight to Supabase Storage; Supabase Realtime for job progress; a react-konva trace editor.
  - **Design and language:** tokens → Tailwind v4 + CSS vars; shadcn RTL; next-intl 4.14.
  - **Quality:** WCAG 2.2 AA; PostHog `cookieless_mode`; Sentry.
  - **Phases:** F0–F7.
  - **Page:** the three plans now share one page with side tabs (overview / Backend / Frontend).
- **Evidence:** `development/plans/2026-11-08-frontend-plan.md`; research plan `development/plans/2026-11-08-frontend-research.md`; page https://claude.ai/artifact/6mZtm2ofVc91JKTQCkb4Wt#frontend.
- **Learned:**
  - **No page-weight measurement exists for any surface.** That makes F0 the first step.
  - **Today's tour assets** (measured):
    - panos are 2048×1024 WebP at 165–284 KB per room;
    - the tour page is 384 KB, with Pannellum 2.5.6 inlined;
    - `dollhouse.html` is 3.03 MB, everything inlined.
  - **Gaps in the tour:** no gyroscope, no error tracking, `posthog_key` empty. Three three.js versions run (0.170, r187, 0.185).
  - **Vercel:** functions have a 4.5 MB body cap.
  - **Next.js:** `updateTag` works in Server Actions only; `ssr:false` only inside Client Components.
  - **OG images:** Satori's RTL is partial (mixed-bidi reordering is unsupported), so the OG image is pre-rendered in the pipeline.
  - **Canvas** is not an LCP candidate.
  - **iOS:** canvas memory crashes near 256 MB.
  - **Legal sources:** gov.il blocks automated fetches, so the accessibility-law and Amendment 13 points rest on secondary sources only.
- **Owed / open:** five open questions, recorded in the plan:
  1. Legal: accessibility thresholds, and cookieless analytics vs a banner.
  2. Whether French stays in the tour.
  3. Whether to keep the tour dark and the platform light.
  4. Physical devices or BrowserStack.
  5. When the embed returns to scope.

  On 2026-11-09, after the session restarted under eliran@habait.ai, both artifact pages reported "not found for this account": `4jgeYwf4…` (backend) and `6mZtm2of…` (tabbed). They were published from the earlier session's account. Whether they were deleted or are only invisible to this account is unverified. The durable copy is `development/plans/2026-11-08-visualization-stack.html`, which shows all three tabs stacked when scripts don't run, e.g. in a phone preview.
- **Second reader:** none. This is planning only, nothing has been decided.
