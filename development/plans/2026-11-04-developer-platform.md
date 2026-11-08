# Developer platform: a developer uploads files, AI builds the whole simulation, published at a link
<!-- filed: 2026-11-04 · main session rnd-67 · state: DRAFT, waiting for Eliran's 4 calls (§5) · builds on development/plans/2026-11-04-feature-worktrees.md track 1 and Projects/Habait/research/feature-split-2026-11-04/B-platform-track.md (read those, not this summary) -->

## The ask
Eliran, 2026-11-04: "איפה אני רואה את הפלטפורמה בצד של היזם ששם יש לו יכולת להעלות את הקבצים שלו וAI מאחורי הקלעים מייצר את כל מה שיצרנו פה https://habait-flow.vercel.app/ עבור כל פרויקט שהוא יעלו לו קבצים?"

## 1. What exists today (honest)
- **No developer side on the web.** `/studio/` on habait-flow is a 404. The Studio (`Habait/studio`, Node) runs only on the laptop (`127.0.0.1:8820`): uploads, 9 fixed stages, a grounded agent chat through fal ($0.17 spent), per-room videos.
- **Everything at habait-flow was built by hand for ONE project, Rainbow apt 846** (B-platform-track §1 "Done by hand"): the plan trace, `project.json`, the 11 neighbouring units, plot/north/tower mass, the 11 panoramas, the flyover clips, the tour build, the deploy.
- **The engine** (`Habait/engine/cli.py`, Python) has the stages (intake → plan → building → scene → clay → skin → video → export), but skin is not wired and export knows only Rainbow.
- **The gap list is G1–G15** in B-platform-track §2. The biggest items are G1 (one orchestrator), G4 (plan → geometry without a hand trace), G5 (surroundings), G6 (interior skin), G10 (jobs + approvals) and G12 (hosting, login, storage).

## 2. The target, in one line
A developer signs in at `habait-flow.vercel.app/studio` (or its own domain), uploads plans, a brochure and a price list, approves 2–3 checkpoints (the plan, the cost, the publish), and gets `/p/<project>`: the bird's-eye film, the stop at the building, the apartment tour with the furniture swap, all disclosed as הדמיה.

## 3. The hard constraint
**Vercel cannot run the heavy part.** Blender, Python/OpenCV and minute-long fal jobs need a worker with a disk. Today's split:
- **Vercel:** the web (portal UI, auth, the public site, small functions such as `/api/tour-edit`).
- **A worker** (Railway, Modal or a cloud VM): the engine stages, Blender and the fal calls, through a job queue (G10/G12). The worker is the main new cost and the main new risk.

## 4. Phases (each one is a feature worktree, per root §8.7; each ends in a board with QA cards, per §8.9)
| # | Phase | What ships | Closes | Rough size |
|---|---|---|---|---|
| P0 | **Portal shell on habait-flow**, $0 | `/studio` hosted: login (one account per developer), a project list, an upload that stores files (Vercel Blob), and the Studio's agent chat over the uploaded files. No generation yet | G12 part, T1-A start | 1–2 days |
| P1 | **intake-router + project-spec** | Any file in (PDF/DWG/DXF/IFC/XLSX/images) → classified and read → `project.json` with a confirm form → platform fixtures for a NEW project id (a second project page appears at `/p/<id>`) | G2, G3, G9, G1 data model | 3–5 days |
| P2 | **Worker + jobs + one ledger** | A hosted worker runs engine stages from a queue, with progress in the portal, stops for approval ("approve the plan", "approve $X"), resumable, one spend ledger with a hard cap per project | G10, G11, G12 | 3–5 days + hosting call |
| P3 | **plan-to-geometry with the human gate** | The developer approves the traced plan on a correction screen; the gate refuses a bad trace | G4 | 1–2 weeks (the hardest tech) |
| P4 | **Interior: skin-backend + tour generator** | Per apartment type: clay panos → fal skin → seam gates → tour360 build with the rings and catalog; the furniture swap works on every new tour | G6, G8, G14 | 1–2 weeks |
| P5 | **Surroundings + film** | Site stage (geocode/OSM, north, tower mass) → the flyover film per project (track 2's contract) | G5, G7 | 1–2 weeks |
| P6 | **Generic publish** | A legal gate + the developer's consent → the project goes live at its link; the deploy stays Eliran's own go | G13 | 2–3 days |

**A first, visible result** (P0 + P1): a developer uploads files on the web and a second project page appears with its facts and units. The 3D, tour and film come in P3–P5.

## 5. Eliran's calls (before P0)
1. **Hosting for the heavy worker**: Railway (Railway's plugins are already installed here), Modal, or a cloud VM. Cost is roughly $20–60/month idle plus GPU minutes for Blender.
2. **Login**: Clerk (Vercel Marketplace, fastest) or a magic link of our own.
3. **Cost per project**: a hard cap per project, for example $15 with the interior + $25 with the film, and who pays (Habait or the developer).
4. **Legal**: the developer's consent text and the disclosure on generated projects (root §6: his wording).

**Eliran's answers (2026-11-04, rnd-67's session):**
1. **"שרת העבודה ירוץ ב-VERCEL"**: the heavy worker runs on Vercel. A plain Vercel Function cannot run Blender or long Python jobs, so the route to check first is **Vercel Sandbox** (Firecracker microVMs: any binary, long jobs) driven by a Vercel Function or Workflow. The first step of P2 is a spike: does Blender headless + the engine's Python run in a Sandbox, at what cost per minute?
2. **Login**: he did not follow the question. It was explained as "how a developer signs in to his own space". The session's default: **Clerk via the Vercel Marketplace** (email or Google). It stands unless he says otherwise.
3. **Cost**: "אין תקלה לעלות". No per-project cost limit is needed from him now. The §7 ledger and caps still apply per run.
4. **Consent text**: explained as the checkbox a developer ticks before publishing (he holds the rights to the uploaded files; the result is published as הדמיה). The session drafts it; the wording is his (root §6).

**Sales-plan fidelity (Eliran, 2026-11-04, standing): a hard gate in every phase.** P3 (plan-to-geometry) must reproduce the sales plan's dimensions, walls, windows and doors, and refuse a trace that differs. P4 (interior) must check every generated room against that geometry (openings, fixed kitchen and bath elements, room proportions) before it is published. P6 (publish) is blocked until the fidelity report passes. A buyer never sees a simulation that differs from the sales plan → `memory/project/2026-11-04-sales-plan-fidelity.md`.

## 6. Rails
Root §6: add-only, disclosure on every generated image, originals kept. Root §7: every paid call ledgered, with per-project caps. Root §8.7: one worktree per phase. Root §8.9: QA cards. Root §9: every prod deploy needs its own go. Never `/studio` with keys in the browser.
