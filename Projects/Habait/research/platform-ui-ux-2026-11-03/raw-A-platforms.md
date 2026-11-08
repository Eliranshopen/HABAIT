# Platform UI/UX survey, raw notes A (researched 2026-11-03)

Scope: upload-to-render tools (A), developer sales platforms (B), AI generation apps with job/queue UX (C). Method: WebSearch + WebFetch only. Every claim carries its source URL. "Unverified" = I could not confirm from a current first-party source. Several sites returned 403 or connection errors to the fetcher (Midjourney docs, Lovable homepage, Runway help center, Theia, ArchiCGI-only partial) so those are marked.

Honest limits: marketing pages rarely describe screens, so visual-language notes are mostly "unverified". Nothing here is from hands-on use of the apps.

---

## A. AI architecture / real-estate visualization and floor-plan tools

### 1. mnml.ai
- URL: https://www.mnml.ai
- Flow (source: same URL): upload sketch/photo/SketchUp-Revit-Rhino-Blender view (JPG/PNG/WebP, up to 50 MB) -> brief (type: exterior/interior/masterplan/landscape/plan/product; style; time of day, weather, camera, people; up to 10 reference images, each with a role) -> refine (mask a region and describe a change, erase, extend, upscale to 8K; each edit saved as a new image beside the original) -> animate (still to short clip, camera moves like walkthrough, drone, pull back).
- IA: two workspaces, Studio (one image start to finish) and Flow (infinite board, up to four variations beside their source, lineage recorded). Projects hold library, history, search, 30-day trash. Plugins for SketchUp/Revit/Rhino/Grasshopper, assistant connectors, Teams.
- Upload UX: formats and size limit stated; interface itself not described on page (unverified).
- Waiting/progress: not described (unverified). Each render shows its credit cost on the button before spending.
- Results/sharing: share project by invitation; Flow has sticky notes, group frames, live cursors, viewer/editor roles; projects private by default, community feed only if published; states uploads not used to train models.
- Pricing: free credits with no card; paid plans monthly credit allowance; structured data shows $0 to $119 range; page contradicts itself on commercial-use tier.
- Visual language: unverified.
- Copy: price shown on the action button before spend; every edit saved as a new sibling, never overwriting; "brief" as a short typed form (type + style + a few presets) rather than a prompt box; project privacy default stated plainly.
- Avoid: two workspaces (Studio vs Flow) plus plugins plus connectors is the exact complexity the owner dislikes.

### 2. Rendair AI
- URL: https://rendair.ai
- Flow: five steps: clear input (sketch, floor plan, elevation, 3D model, photo, text) -> explore several low-res variations -> pick and refine (materials, time of day, weather) -> upscale once at end -> organize and share. Source: https://rendair.ai/faq/from-concept-to-client-what-rendair-ai-can-do-end-to-end
- IA: per-project folders of renders, earlier versions kept in Assets, Boards for grouping and inviting team/client to view. Same source.
- Upload: max 16 MB (FAQ, updated Feb 2026, per https://www.blog.rendair.ai/?p=3144 search summary). Older home page had Create / Edit / 4K Upscale sections with an "image strength" slider (0-100); Jan 2026 guide shows a chat tool where you upload a base sketch and ask in plain language. Interface has changed between versions; verify before copying specifics (search result summary of https://www.blog.rendair.ai/?p=3144, https://rendair.ai/blog/how-to-make-the-sketch-to-render-video).
- Waiting: not documented (unverified). Credit rule: failed generations are refunded automatically; low-res exploration is cheap, upscale once (FAQ above).
- Sharing: board with invite for team or client; download finals.
- Pricing: not on the FAQ page (unverified).
- Copy: draft-then-final resolution ladder (cheap low-res first, expensive upscale once) as a pattern for our pipeline stages; automatic refund on failure.
- Avoid: UI churn (Create/Edit/Upscale to Chat/Boards) shows what happens when generation controls are exposed as many sliders.

### 3. Veras (EvolveLAB)
- URL: https://www.evolvelab.io/veras
- Flow: runs as plugin in Revit/SketchUp/Rhino/Archicad/Vectorworks/Forma, or in a web browser where you upload an image/sketch and use image-to-image tools. Controls: Geometry Override slider (low = faithful to your model), Render Selection (re-render an area with new prompt), Render Same Seed (consistency across iterations). Source: same URL.
- Pricing: Named license $59/mo monthly or $29/mo billed yearly ($348); floating $51/mo billed annually ($612); student $149/yr; trial 30 renders / 15 days; 25+ seats contact sales. Same URL.
- Waiting, sharing, visual style: not described (unverified).
- Copy: one single "how faithful to geometry" control, named in user terms; keeping the same seed so that iteration does not re-roll the building.
- Avoid: plugin-first distribution; our users are sales offices, not BIM operators.

### 4. Virtual Staging AI
- URL: https://www.virtualstagingai.app
- Flow: 3 steps: upload photo (furnished or empty) -> AI processing (page says about 10-15 s) -> download staged image. CTA "Upload image for free", "No sign up / No credit card". Source: same URL.
- Results: before/after pairs as main proof device; unlimited regenerations claimed; 50+ styles; "leaves room layout untouched"; MLS-compliance claim (marketing, unverified).
- Pricing: from $16/mo for six staged images; free upload exists, free-tier limits unspecified.
- Copy: first CTA is the upload itself, before signup; before/after as the hero proof. Relevant to Habait's add-only/disclosure rule (CLAUDE.md section 6).
- Avoid: marketing statistics on buyer interest are unsourced.

### 5. RoomSketcher
- URL: https://roomsketcher.com
- Flow: create (AI Convert from existing plan, draw, or order a plan) -> edit (changes update instantly in 2D and 3D) -> generate visuals (2D/3D plans, Live 3D walkthrough, 360 views, AI renders). Source: same URL.
- Upload: AI Convert turns PDF/image/scan into an editable project in under five seconds, detecting walls/doors/windows; first conversion free (same URL, vendor claim).
- Pricing: Free (2 projects, 1 AI Convert), Pro, Team; prices not on page.
- Sharing: page describes download/print/export; no share-link feature described (unverified).
- Copy: "convert, then correct" (AI makes an editable draft, human fixes it).
- Avoid: it is an editor first; the user must learn a CAD-like tool.

### 6. Planner 5D (floor-plan recognition)
- URL: https://support.planner5d.com/en/articles/14434484-how-to-upload-a-floor-plan
- Upload UX (strong reference for our plan upload): My spaces -> Import a Plan; for multi-page PDFs you pick only plan pages, skip elevations, assign each page to a floor, Continue. Accepted JPG/PNG/PDF/DWG/DXF/BMP/TIFF; screenshots allowed under 8192x8192. Pre-upload advice: flat high-contrast birds-eye plans, one floor per image, include dimensions; renders and elevations cannot be recreated; only basic furniture recognised. Paid plans only.
- Waiting: "10 minutes to 24 hours" with an email when ready; a "Previous task in progress" message when queued behind an earlier upload (same URL). The B2B page claims 1-3 minutes plus designer review and a REST API with polling (https://tool.planner5d.com/b2b-floor-plan-recognition); the two timings conflict, treat both as vendor claims.
- Copy: per-page role assignment for multi-page PDFs (plan / elevation / skip) is exactly our "file-type recognition" need; email notification when long jobs finish; explicit queue-position message.
- Avoid: a 24-hour worst-case with no ETA; paywalling upload.

### 7. Cedreo
- URL: https://www.cedreo.com
- Flow: draw plans (site, floor, sections, elevations) -> 3D model auto-generated with auto camera and sun, AI render styles -> assemble client presentation "without leaving Cedreo". Pricing not on page; no video output described. Source: same URL.
- Copy: output is a ready client presentation, not loose files. Avoid: draw-first model.

### 8. Floor-plan-to-video generators (Dreamina/Seedance, TensorPix, HeyGen, Luma, Getfloorplan)
- URLs: https://dreamina.capcut.com/seedance/floor-plan-to-video , https://tensorpix.ai/blog/2d-to-3d-floor-plan-video-ai , https://www.heygen.com/video/floor-plan-video-maker , https://lumalabs.ai/use-case/ai-real-estate-property-video-generator , via the search at (summary of results). All vendor pages; accuracy claims unverified.
- Pattern: upload a plan, write a prompt (style, lighting, camera), choose duration/aspect/resolution, Generate, export (Dreamina FAQ per search summary). TensorPix advises labelling rooms and measurements on the plan first (search summary). Getfloorplan targets developers, plans to 3D/renders/360 tours (search summary).
- Caveat from search: no independent review of whether these preserve plan dimensions.
- Note: Luma's own page I fetched (https://lumalabs.ai/use-case/ai-real-estate-property-video-generator) did NOT describe a real-estate video flow; only sketch-to-render and architectural visualization use cases. The search snippet and the page disagree, so treat Luma real-estate video as unverified.
- Avoid: prompt-box-for-everything; none of these gives a clickable unit picker or per-unit status.

---

## B. Developer sales / marketing platforms

### 9. Unit Atlas
- URL: https://unitatlas.com
- Flow: explore masterplans, buildings, floors and units with live prices and availability; interactive plot overview with colour-coded building status; apartment detail panel with floor plan, room breakdown, 3D render preview. Units available/reserved/sold, updated by staff in an admin panel and reflected publicly immediately. Per-unit enquiry capture feeds a built-in CRM with scoring. Subscription. Setup done by vendor from your floor plans, pricing, availability. Source: same URL and https://peerpush.com/p/unit-atlas (search result).
- Not described: exact screens, lead form fields, reservation flow (unverified).
- Copy: plot -> building -> floor -> unit drill-down with a colour-coded status legend; one enquiry button per unit.
- Avoid: vendor-does-setup model (we automate that); a built-in CRM is scope Habait should not start with.

### 10. ArchiCGI interactive platform / Unit Finder
- URL: https://archicgi.com/interactive-real-estate-platform/
- Buyers filter by price, size, floor, bedrooms, availability, then pick the unit on the map; each unit opens floor plan, view from the window, 360 interior. Team marks available/reserved/sold in an admin panel, live immediately. One-click "book a viewing" goes to CRM. Analytics over 36 points in the tour. From $5,700 one-time including 3 years hosting; about three weeks from brief to live; brief = site plans, floor plans, elevations, unit list with prices. Source: same URL (vendor claims).
- Copy: the brief list is almost identical to Habait's upload set, so our upload step can name those four inputs; "view from the window" on the unit page.
- Avoid: three-week human turnaround is the thing Habait replaces.

### 11. Other unit-selector vendors (agency services and templates)
- Render Vision https://render-vision.com/services/3d-apartment-viewer-services/ and Maverick Frame https://maverickframe.com/services/interactive-apartment-selector/ are agency services for 20+ unit projects; WordPress plugin "Interactive Real Estate" with custom statuses (sold, reserved); Framer "Floor Plan Selector" template filters by availability, bedrooms, price, size and shares a direct link to a unit (https://www.framer.com/marketplace/components/floor-plan-selector/). A 2026 cost benchmark puts a unit configurator at about 3,500 EUR initial development (https://kolonell.com/en/blog/construction-property-developer-website-cost-2026). All via search summaries; vendor claims.
- Copy: direct shareable link per unit.

### 12. Matterport
- URL: https://matterport.com
- Homepage nav: Solutions, Products, Pricing, Resources, What's New; property marketing offers 3D tours, floor plans, photos; CTAs "Start Free" and "Contact Sales". Tour sharing, space-page layout, lead capture not described on the homepage; prices not shown. Visual: simple line icons, illustrations, black logo. Source: same URL. Everything about the tour viewer UI is unverified here.

### 13. Giraffe360
- URL: https://www.giraffe360.com
- Flow: upload own photos into Content Studio, or use a photographer or guided self-capture (visual, 360, LiDAR) -> deliverables: photos, videos/reels, branded social/email/flyers, property websites, 360 tours, 2D/3D floor plans. A property website gathers all media in one place "where buyers can explore the listing and enquire". AI tools: stage rooms, blue sky/twilight, drone-style shots, object removal. Pricing not shown (demo). Source: same URL.
- Copy: single share page that bundles every output for the buyer; one capture/upload feeds all deliverables.
- Avoid: a long list of deliverable types on the front page; we ship three.

### 14. Archilogic
- URL: https://www.archilogic.com
- Floor Plan SDK embeds interactive floor plans via JS/TS (load floor by ID with token, find spaces by category, zoom to space with animation); GraphQL API; MCP server; browser editing with versioning, diff, rollback. Nav: Product, Pricing, Partners, Integrations, Developers, Resources, Log in; CTA "Request Demo". Page mentions no unit picker for sales; it is office/space management (unverified for developers). Source: same URL.
- Copy: embeddable component plus API for the developer's own website.

### 15. Madlan new projects (Israel)
- URLs: https://www.madlan.co.il/developer/mgad (example developer page, via search). Search confirmed a "פרויקטים חדשים" tab in the main menu and per-developer pages listing new projects by city. I could not verify project-page layout, unit availability display or lead flow. Unverified; needs a manual visit (an Israeli first-party review of Madlan, Yad2 new-projects and 3-4 developer sites is an open gap).
- Theia Interactive (https://www.theiainteractive.com) and Envisio did not yield usable pages: Theia fetch failed (connection refused); envisio.com is a public-sector planning product unrelated to real estate, so it is excluded.

---

## C. AI generation apps with job/queue UX

### 16. Luma Dream Machine / Luma Agents
- URL: https://lumalabs.ai/dream-machine
- Brainstorm Mode (no media generated) vs Create Mode; agent chooses the model, or user picks; parallel generations; Boards = infinite zoomable workspace with sticky notes, frames, link sharing, email invite, Viewer/Editor roles. Pricing Plus $30/mo (10,000 credits), Pro $90 (40,000), Ultra $300 (150,000); credits expire each cycle; failed-generation credits returned automatically; optional spending limit that pauses rather than overcharges. Progress display: page does not describe it (unverified). Source: same URL.
- Copy: spending cap that pauses; refund on failure stated in plain words.

### 17. Krea
- URL: https://www.krea.ai
- Top "Create" menu in three groups (Create / Edit & enhance / Build & customize); two entry points "Open Krea" and "Krea Agent"; 64+ models; asset manager; Nodes for chaining. Plans Free ($0, 100 units/day), Basic $9, Pro $35, Max $105, Business $200, Enterprise; unit-based compute. Source: same URL.
- Avoid: tool-menu breadth (the opposite of 3 steps).

### 18. Lovable
- URLs: https://docs.lovable.dev/features/projects/chat (fetched); homepage returned 403.
- Chat on the left, live preview right (reviews, per search summary of https://skillscouter.com/lovable-review/). Build / Chat / Plan modes. Progress shown as activity cards (file edits, commands, tests), a Details timeline, a "Working for" / "Worked for" timer and "Credits used" counter; Bookmark in history saves a version; Preview a past message without reverting. Publishing shows a progress bar for a security scan then a checklist (URL, visibility, metadata) (secondary source: https://marcandrews.com/how-to-build-an-app-with-lovable-uk-beginner-guide-2026/, via search summary).
- Copy: timer + cost counter during work, human-readable steps instead of a spinner, preview of a past result without reverting, publish as a short checklist.

### 19. Midjourney (web)
- URLs: https://docs.midjourney.com/docs/explore-page (search result; direct fetch of the overview returned 403).
- Official docs: Create (watch images and videos render live), Explore (community gallery), Organize (search/filter/sort, folders per third-party guide), Edit, Moodboards. Queue status and sharing: no official source found (unverified).
- Copy: "see it render live" as the progress display; three-verb IA. Avoid: public-by-default community feed (our content is pre-sale, confidential).

### 20. Higgsfield
- URL: https://higgsfield.ai/creator-hub/help-center/tools/what-are-higgsfield-apps
- Studio layout: projects sidebar, floating prompt dock, generations feed; apps get a subdomain link, can be listed in Explore or kept unlisted. In-progress display not documented (unverified). Third-party reviews mention queueing under load and throttled "unlimited" promos (https://hackceleration.com/higgsfield-review/, anecdotal).
- Avoid: throttled "unlimited" promises.

### 21. Runway, Kling, Pika (low confidence)
- Runway https://runway.com : homepage did not describe the app screens, progress, library or pricing (fetched). Search found only API behavior (asynchronous task with status polling) and a third-party note on asset storage; no official queue-UI source. Unverified.
- Kling: only third-party material; API is asynchronous with renders taking "several minutes depending on queue depth", free tier has slower queues; community hub for browse/clone/remix (https://aiindigo.com/blog/kling-ai-review-the-state-of-generative-video-in-2026 via search). Web UI unverified.
- Pika: no current review; a 2026 "Generative UI" experiment exists (https://experiment.pika.art/blog/pika-experiments) but is unrelated to job UX. Unverified.

Not researched (no source retrieved): Visoid, ArchiVinci, LookX, PromeAI, Spacely AI, Collov AI, REimagine Home, D5 Render AI (fetch returned a page request error), Coohom, Floorplanner, Pure Digital, Prop VR, Realync, Juniper Square-like portals, Yad2 new projects.

---

## Synthesis: 10 recurring patterns

1. **Entry = the upload itself, before signup or settings.** Virtual Staging AI ("Upload image for free", no card), Planner 5D (Import a Plan), mnml Start, RoomSketcher AI Convert. Sources above.
2. **A short brief, not a prompt wall.** mnml (type + style + a few presets + reference roles), Dreamina/TensorPix (duration, aspect, style), Veras (one fidelity slider). For Habait: pre-fill from the files; ask almost nothing.
3. **Credits shown before the click and refunded on failure.** mnml (cost on the button), Luma (auto-refund, spend limit that pauses), Rendair (auto-refund, cheap draft then one upscale).
4. **Draft low-res first, finalize once.** Rendair, mnml (variations then upscale to 8K). Maps to our fly-around preview then full render (inference, not documented for us).
5. **Edits create siblings, not overwrites.** mnml (each edit a new image beside the original, lineage), Rendair (earlier versions stay in Assets), Lovable (Bookmark in history, preview a past message).
6. **Progress as named steps with elapsed time and cost, not a bare spinner.** Lovable (activity cards, Working for, Credits used, Details timeline), Midjourney (images render live on Create). Weakly documented elsewhere; most others unverified.
7. **Long jobs leave the page: queue message plus email.** Planner 5D ("Previous task in progress", email when ready). Async APIs (Runway, Kling, Planner 5D B2B polling) confirm jobs run minutes to hours.
8. **Upload guidance and file roles up front.** Planner 5D (pages marked plan/elevation/skip, accepted formats, dimension and contrast advice, "renders and elevations can't be recreated"), ArchiCGI (brief list: site plans, floor plans, elevations, unit list with prices).
9. **Status-coloured unit hierarchy with per-unit page, enquiry, direct link.** Unit Atlas, ArchiCGI, Framer selector, WordPress plugin: plot -> building -> floor -> unit; available/reserved/sold edited by staff in an admin.
10. **One shareable result page that bundles everything, private by default.** Giraffe360 property website, mnml (private unless published), Luma/mnml boards with Viewer/Editor roles by link or email, Higgsfield unlisted option.

## Gaps none of them fill (Habait could own)

- Upload of developer files to the whole result chain (exterior fly-around + clickable unit picker + 360 inside) with no human setup: unit-picker vendors need weeks and a vendor; render apps stop at stills or clips; none seen does both.
- A buyer page in Hebrew RTL; none of the sources documents RTL support (unverified, absence of evidence).
- Honest disclosure built into results (AI badge, "demo replay" labelling): staging tools make compliance claims, none shows a structural badge in what I could read.
- A 3-step shell where "advanced" is the only place for settings: the render tools expose workspaces, modes, plugins and boards; the sales platforms expose admin panels and CRMs.
- Status truth between generation and sales: unit status live-edited by the sales office and reflected on the shared page, inside the same product as the render pipeline (no source combines them).
- Israeli market specifics (Madlan/Yad2 new-project pages, local developer sites): not verified in this pass.
