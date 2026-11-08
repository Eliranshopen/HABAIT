# Habait platform shell: UI/UX patterns and principles (raw research B)
Date: 2026-11-03 · Author: UX research sub-agent · Scope: research only, no product change.

Evidence labels: **[fetched]** = I opened the page this session and the rule is from it. **[search]** = seen only in a search-result summary (secondary; treat as opinion). **[unverified]** = from general knowledge or not confirmed; verify before relying. Time budget was bounded, so several requested sources (Smashing, Baymard paid findings, Material 3, Apple HIG, Awwwards pages, Stripe/Vercel writing) were NOT opened; where they would help they are named as "to verify" and carry no claim.

---
## 1. Multi-file upload UX
Rules
1. Always give a click fallback plus a big, always-visible drop zone; drag-and-drop alone fails some assistive-tech users. [fetched] https://design-system.service.gov.uk/components/file-upload/
2. State limits up front (count, size, types) and repeat them in the error: "You can only select up to N files". [fetched] same GOV.UK page.
3. Specific, per-state error copy: wrong type, too big, empty file, password-protected, upload failed "try again". Never a generic "error". [fetched] same page.
4. Ask only for what is critical, and let the user reuse a file already uploaded in the same journey (never ask twice for the same plan). [fetched] same page.
5. Multi-file list = one row per file: name, size, per-file progress, remove/cancel, per-file status. [search] https://blog.filestack.com/upload-file-ui-design-components-states-and-errors/
6. On failure replace the progress bar with an inline "Retry" on that row; retry transient network errors with backoff, stop and explain on 4xx. [search] https://design.visa.com/patterns/file-upload (Visa), techinterview.org chunked-uploader post.
7. Validate by content/MIME, not file name. [search] same Filestack/Visa results.
8. Large files: chunked, resumable upload (tus protocol or S3 multipart) so a dropped phone connection resumes. [unverified: not fetched; tus.io and AWS S3 multipart docs to verify]. Habait inference: DWG/PDF packs can be 100 MB+, so this is mandatory, not optional.
9. Auto-detect role (e.g. "looks like a sales plan") as a suggestion, show it as an editable chip on the row, never lock it. Rationale links to section 3 (AI proposes, human confirms). [Habait inference; no source found that specifically studies file-role auto-detection]
10. Folder upload: `webkitdirectory` on the input, flatten into the same per-file list. [unverified: browser feature known from MDN, not fetched]
11. Mobile: the OS picker (camera roll, Files) is the real path; drag-drop is desktop only. Do not rely on a drop-zone label on phones. [unverified inference]

Examples: GOV.UK file upload component (https://design-system.service.gov.uk/components/file-upload/); Visa Product Design System file-upload pattern (https://design.visa.com/patterns/file-upload). Consumer-grade references like Dropbox/Google Drive/WeTransfer: [unverified, not opened].

---
## 2. Long-running AI job UX (minutes to hours)
Rules
1. Time thresholds: under 1 s needs no feedback; over 10 s needs feedback saying when it will finish; use percent-done for >10 s, spinner is the last resort. [fetched] https://www.nngroup.com/articles/response-times-3-important-limits/
2. Anything beyond about 30 s runs in the background with a visible progress panel; the user is free to leave. [search] https://tianpan.co/blog/2026-05-05-non-blocking-ai-async-ux-patterns-agents (practitioner blog, one author; threshold is a rough rule).
3. Staged pipeline = vertical step list, 3 to 7 steps, header + overall bar + per-step state + per-step elapsed time. [search] https://skillselion.com/skills/shipshitdev/library/ai-loading-ux (guide summary). For Habait: Read files, Understand plan, Needs your check, Build exterior video, Build apartments, Build 360 tour. States: waiting / running / needs you / done / failed.
4. Emit discrete, human-readable events ("Reading 3 documents...") rather than a fake percentage; Perplexity and Cursor are cited as doing this. [search] tianpan.co link above.
5. ETA honesty: no established ETA pattern was found; show a range ("usually 20 to 40 min") or the current step "Step 3 of 6", and only show a percentage where it can be computed. [search] https://claudeissues.com/issue/11036-feature-request-real-time-streaming-progress-updates-for-long-running-agent-task
6. Return a job id at once and subscribe (SSE/WebSocket) or poll; notify on completion or when a decision is needed (email / WhatsApp). [search] tianpan.co and fast.io/resources/ai-agent-long-running-tasks/. WhatsApp Business template-message rules and opt-in: [unverified, verify with Meta docs]; in Israel WhatsApp is the dominant channel [unverified, widely stated, no source opened].
7. Always offer cancel; it is the most overlooked async problem. Ask explicit confirmation before irreversible or paid actions. [search] tianpan.co.
8. Partial results: show each deliverable the moment it finishes (exterior video first, then apartments, then tours) with its own card state, not one all-or-nothing "done". [Habait inference; consistent with the staged-list pattern in rule 3]
9. Failure: per-step failure with plain cause, a one-tap Retry for that step only, and "contact us" with the job id; do not reset the whole project. [Habait inference; Visa retry-inline pattern is the nearest source]
10. Cost transparency: show cost/credits before "Generate" and the running total after; Habait rules require this anyway (root CLAUDE.md section 7). No external study fetched. [unverified]

Examples: Perplexity and Cursor progress events [search, not opened]; Claude Code feature request for step N of M [search].

---
## 3. Human-in-the-loop review ("AI read this, please confirm")
Rules
1. Put the source document beside the extracted fields with the region highlighted; confidence alone can mislead (a 0.97 value read from the wrong column), so highlight the exact source cell on hover/focus. [search] https://www.nutrient.io/blog/document-extraction-confidence-scores/ and https://docsumo.com/blog/human-in-the-loop-systems (vendor material).
2. Route by confidence: auto-accept high, flag borderline, force review on low. For Habait: only the flagged rows demand attention; the rest are pre-accepted. [search] https://velt.dev/blog/designing-human-in-the-loop-workflows-ai-products
3. Per-field confidence badge, color plus text/icon (never color alone, see section 8). [search] craftedbydaniel.com streaming-extraction post.
4. The human edit always wins and is stored as the truth; offer "Accept all flagged-as-fine" bulk action but keep "review N uncertain" as the primary button. [search] same sources; bulk-accept is Habait inference.
5. Show the model's value next to the corrected value so reviewers see their own patterns. [search] velt.dev link.
6. Review is a step in the step list ("Needs your check, 4 items"), reachable from the notification, resumable, and never blocks leaving. [Habait inference tied to section 2]
7. Units and room names are the likely review items for Habait (room names, dimensions, which file is which): show the plan crop with a box around the label read. [Habait inference]

Examples: Docsumo and Rapid Automation "Verify me" side-by-side review (https://docs.rapidautomation.ai/docs/aistudio/blocks/general/verify-me) [search]; ChartExtract-UI open source [search].

---
## 4. Wizard vs dashboard; progressive disclosure; empty states
Rules
1. Use a wizard for novice users and rare processes (setup, configuration); avoid it for tasks repeated often. Project creation is rare per project and the owner wants 3 steps, so a wizard fits; the project list afterwards is a dashboard. [fetched] https://www.nngroup.com/articles/wizards/
2. Show all steps as a list with the current one highlighted; short step labels; completed steps clearly marked. [fetched] same.
3. Label buttons with the next step's name ("Continue to Generate"), not "Next". [fetched] same.
4. Let users exit midway, save and resume; each step self-sufficient; help beside fields, not over them. [fetched] same.
5. Prefill from previous choices (next project inherits developer name, logo, language). [fetched] same.
6. Progressive disclosure: show the few most important options, put specialist settings behind a clearly visible, clearly labeled trigger ("Advanced"); stay at two levels, since three or more get users lost. [fetched] https://www.nngroup.com/articles/progressive-disclosure/
7. Base the primary/advanced split on usage data, not taste. Day one: a guess; instrument it. [fetched] same.
8. Avoid staged disclosure where users must move back and forth between steps; keep that work on one screen. [fetched] same. Implication: Generate and Review can be one screen when review is needed.
9. Empty states: say what is happening (never "no items" while loading), teach in context, give a direct path (a button). [fetched] https://www.nngroup.com/articles/empty-state-interface-design/
10. Project list: cards with a thumbnail from the render, status chip (Generating / Needs you / Ready), and one primary action per state. [Habait inference; no source fetched]

Examples: Trimble Modus wizard (https://modus.trimble.com/components/web/wizard), PatternFly wizard guidelines (https://www.patternfly.org/components/wizard/design-guidelines) [search only]. Product examples (Vercel "new project", Linear onboarding): [unverified, not opened]. Linear published its redesign rationale: https://linear.app/blog/how-we-redesigned-the-linear-ui [search only].

---
## 5. Buyer showcase pages (mobile first)
Rules
1. Media first: the first screen is the exterior video/poster, then the apartment picker. Quiet-luxury editorial layout (large photography, whitespace) is cited as the 2026 direction; cinematic hero video is also called standard, so the sources conflict. Use video as the hero but keep it single and restrained. [search] https://redefineweb.com/blog/real-estate-website-design-trends-for-2025/ , https://wpresidence.net/best-luxury-real-estate-websites-in-2026/ (agency opinion).
2. Reserve space for every image/video: width/height attributes or `aspect-ratio`, so nothing jumps on load. [fetched] https://web.dev/articles/optimize-cls
3. Show structure while loading (skeleton, blurred poster, then crossfade), no full-page loading screen between steps. Perceived-performance rationale: under 1 s keeps flow, 10 s is the attention limit. [fetched] https://www.nngroup.com/articles/response-times-3-important-limits/ (the skeleton/blur-up technique itself is [unverified], no source opened)
4. Sticky bottom CTA on mobile ("Register interest" / WhatsApp / call); at least one CTA above the fold, repeated after key content; touch target at least 44 x 44 CSS px. [search] https://ecommerceguide.com/patterns/sticky-atc/ , https://conversionsciences.com/mobile-call-to-action-buttons-best-guidelines-for-placement-copy-design/2/ (practitioner opinion, not Baymard; Baymard's detailed mobile findings are paywalled and were not read). 44 px is WCAG 2.1 SC 2.5.5, level AAA. [fetched] https://www.w3.org/WAI/WCAG21/Understanding/target-size.html
5. Unit availability picker: tap on the building image to select a unit and a list/filter alternative (floor, rooms, price, status) for accessibility; status shown by color plus label. [Habait inference; consistent with section 8]
6. Apartment page: 360 tour as a card opening full screen, plan, key facts (rooms, מ"ר, floor, price), then lead form; one apartment = one shareable URL. [Habait inference]
7. Lead form: minimum fields (name, phone, optional message); phone-first because the market uses WhatsApp [unverified]. Use `inputmode="tel"` and `autocomplete` attributes [unverified, standard HTML].
8. Trust signals: developer name and logo, the AI-disclosure badge "הדמיה · AI-generated" (required by root CLAUDE.md section 6), last-updated status date, and the accessibility statement link. No external trust-signal study fetched.
9. Mobile-native feel (100vh bug, tap highlight, notch safe areas): see the installed `mobile-native` skill. Not a web source; [unverified as research].

Examples: Awwwards real-estate collection https://www.awwwards.com/websites/real-estate/ [search, not opened]; ERA luxury real estate by Vide Infra (agency claims Awwwards Site of the Day; unverified) https://videinfra.com/luxury-real-estate-website-design. I did not open any specific Israeli developer site; naming one would be an invention, so none is named.

---
## 6. Hebrew RTL product design
Rules
1. Set `dir="rtl"` and `lang="he"` on `<html>`; `lang` does not set direction. [fetched] https://www.w3.org/International/questions/qa-html-dir
2. Use `dir="auto"` for user-entered/unknown-direction fields; wrap inserted fragments in `<bdi>` so a Latin project name does not scramble neighbors. [fetched] same.
3. Auto-detection can misfire on mostly-English paragraphs; avoid relying on it for mixed text. [fetched] same.
4. Use CSS logical properties everywhere (`margin-inline-start`, `padding-inline-end`, `text-align: start`); flex and grid flip automatically. [fetched] https://rtlstyling.com/posts/rtl-styling/
5. Mirror directional icons (arrows, chevrons, breadcrumb, back); do not mirror media-playback icons or symmetrical icons; for physical-transform icons use `[dir="rtl"]` and `scaleX(-1)`. [fetched] same.
6. Numbers, prices, units: render a price like `₪1,250,000` and an area like `95 מ"ר` as isolated runs (`<bdi>` or `unicode-bidi: isolate`) so the shekel sign and the quote in מ"ר do not jump. Use one numeral system (0-9). Numeral rule [fetched] rtlstyling.com; bidi isolation for prices/units: [unverified beyond the bdi rule above]. The installed `hebrew-rtl-best-practices` skill covers Israeli formats (dot dates, Sunday week start) but is not an external source.
7. Hebrew has no capitals or italics; use weight and size for hierarchy, and avoid letter-spacing on Hebrew (breaks letter joins visually). [unverified typographic convention]
8. Test with real Hebrew copy at 130 to 160 % longer than English labels in some strings [unverified]; and keep the first-visible-step order right-to-left (step 1 on the right).

Typefaces (free, Google Fonts / OFL 1.1; free to self-host for commercial use)
- Heebo: SIL OFL 1.1. https://www.fontsquirrel.com/fonts/heebo [search]. Clean UI sans, Roboto-based, many weights. Safe body/UI default.
- Rubik: OFL 1.1, 2015 Hebrew revision, slightly rounded, friendlier than premium. [search] https://rightfontapp.com/family/rubik
- Assistant: license not confirmed in this session [unverified]; it is on Google Fonts and widely used on Israeli sites.
- Noto Sans / Noto Serif Hebrew: OFL 1.1, full weights, variable. [search] https://fontsource.org/fonts/noto-serif-hebrew/about
- Frank Ruhl Libre: OFL, open version of classic Frank Rühl; the best free premium-editorial serif for headings. [search] https://www.serbyte.net/fonts/frank-ruhl-libre
- Suez One, Secular One, Karantina: free Google Fonts display faces [unverified, license and metrics not checked]; loud, not suited to a premium shell beyond a single accent.
Commercial Israeli foundries
- AlefAlefAlef (the multilingual catalog) and Fontimonim (its Hebrew-only headline line, fewer weights, about 2 vs up to 5). [search] https://alefalefalef.co.il/en/more/license/
- Web-font license [fetched] same URL section 4.2: covers one website in one domain including sub-domains, cannot move to another domain, capped by monthly page views per the agreement (number not stated); price varies per font. For Habait (habait.ai, www, app) this needs the foundry to confirm sub-domain coverage and a page-view tier for buyer pages. Also a limit of four fonts combined per project was noted [search].
- Hafontia: a 2010 mailing-list mention says CC-BY-NC (non-commercial); current status unknown. Do not use without checking. [search, weak] https://mailman.cs.huji.ac.il/pipermail/linux-il/2010-February/004015.html
Pairing suggestion [Habait opinion, not sourced]: Frank Ruhl Libre (headings, sparing) + Heebo (UI/body); Latin side: the Latin glyphs of Heebo already match; if a Latin serif is wanted pair with a transitional serif of similar x-height. Set `font-family` Hebrew first, check that the Latin fallback does not change line height.
Examples: no shipped RTL product was opened. Monday.com, Wix and Fiverr localize in Hebrew [unverified; not opened].

---
## 7. Premium visual language 2025 to 2026
Rules
1. Photography/render carries the page; fix media quality before decoration. [search] https://wpresidence.net/best-luxury-real-estate-websites-in-2026/ (opinion)
2. Editorial feel: generous whitespace, large type, restrained palette, one accent. [search] https://www.element8.ae/blogs/real-estate-website-design-trends (agency opinion)
3. Motion restraint: heavy animation is called a weakness; use few, slow, meaningful transitions. [search] https://www.magier.com/blog/best-real-estate-website-design-examples
4. Performance is part of premium: sub-2 s loads recommended. [search] redefineweb.com link in section 5 (their 3 to 6x conversion claim is unsupported; ignore it).
5. Use perceptually uniform color (LCH) for theme generation, one neutral ramp, accent used sparingly; Linear generates light/dark themes this way. [search] https://linear.app/blog/how-we-redesigned-the-linear-ui
6. Dark vs light: the developer workspace can offer both; the buyer showcase should default to light for daylight phone viewing and use a dark immersive mode only inside the tour/video viewer. [Habait opinion; no study]
7. Type scale: 5 to 6 sizes, one display, one text; line-height about 1.5 for Hebrew body [unverified].
8. A shared design-token set (color, spacing, radius, type) for developer shell and buyer pages so both feel one brand. [Habait inference]
Examples: Linear (https://linear.app/blog/how-we-redesigned-the-linear-ui, https://linear.app/now/behind-the-latest-design-refresh) [search only, pages not read]. Vercel Geist, Stripe design writing: not found/opened in this session. Awwwards real-estate list: https://www.awwwards.com/websites/real-estate/ [search, not opened].

---
## 8. Accessibility and Israeli requirements
Rules
1. Israeli Standard IS 5568 is a web accessibility standard at level AA. Sources disagree on the WCAG basis: most say WCAG 2.0 AA; IS 5568:2020 is said to align with WCAG 2.1; the legal duty is the Service Accessibility Regulations (2013) which incorporate IS 5568 Part 1. Plan to WCAG 2.1 AA (superset). [search, secondary] https://regulations.clym.io/israeli-standard-5568-is-5568 , https://koto.co.il/en/accessibility , https://www.wawsome.com/blog/israel-digital-accessibility-law-is-5568-guide. Primary legal text not read: unverified; confirm with Israeli counsel (this is a legal point, Eliran's call per CLAUDE.md section 6).
2. Publish an accessibility statement (current status, planned fixes, a feedback channel, a coordinator where required); passing an automated audit alone is not enough. [search] wawsome.com and clym.io above.
3. Exemptions by revenue are reported inconsistently (one source says under NIS 100,000 average annual income); do not rely on them. [search, unverified]
4. Touch targets at least 44 x 44 CSS px for primary actions (AAA in WCAG 2.1). [fetched] https://www.w3.org/WAI/WCAG21/Understanding/target-size.html
5. Respect `prefers-reduced-motion`: remove decorative motion (parallax, background video, reveals), keep feedback/loading motion; JS animations need a change listener. [fetched] https://web.dev/articles/prefers-reduced-motion . For the fly-around hero video: do not autoplay under reduce; show poster plus play button.
6. Status never by color alone (unit available/sold, confidence flags): pair color with text or icon. [WCAG 1.4.1; unverified here, not fetched]
7. Contrast 4.5:1 for body text, 3:1 for large text and UI components; visible keyboard focus; whole flow keyboard-usable, including the upload zone fallback button. [WCAG AA; unverified here, not fetched]
8. 360 and video viewers need keyboard controls, captions/labels, and a non-motion alternative (static plan and photo gallery). [Habait inference]
9. Screen-reader: announce job progress changes with a polite live region (`aria-live="polite"`) and not on every percent tick. [unverified standard ARIA practice]
10. Hebrew screen-reader testing (NVDA/JAWS/VoiceOver he-IL) before launch. [unverified, recommendation]

---
## Ranked: the 15 principles most relevant to Habait's shell
1. Three visible steps only (Upload, Generate, Results); everything else behind one labeled "Advanced" at two levels max (sec 4, NN/g progressive disclosure).
2. Wizard for project creation (rare, novice task), then a simple project list as home (sec 4, NN/g wizards).
3. Upload accepts anything, shows per-file rows, detects role as an editable suggestion, with resumable chunked upload (sec 1).
4. Specific error copy and per-row Retry; never lose the other files (sec 1, GOV.UK, Visa).
5. After "Generate" the user may leave: background job, staged step list with states, notification by email/WhatsApp when done or when needed (sec 2).
6. Honest time: steps and ranges, percentages only if real, current step "3 of 6" (sec 2; NN/g 10 s rule).
7. Deliver partial results as they finish, each deliverable its own card (sec 2).
8. AI-proposes, human-confirms: source crop beside extracted value, flag only uncertain items, bulk accept the rest, human edit wins (sec 3).
9. Buyer pages are media-first on a phone: hero video, unit picker, sticky CTA, 44 px targets (sec 5).
10. No layout shift and no loading screens between steps: reserved aspect ratios, skeletons, blur-up posters (sec 5, web.dev).
11. Build RTL as the default: `dir="rtl"`, logical properties only, `<bdi>` isolation for prices/units/Latin names, mirror only directional icons (sec 6).
12. One free premium type pair to start (Frank Ruhl Libre + Heebo, OFL); commercial Israeli faces only after the web-font license (domains, page views) is confirmed (sec 6).
13. Quiet-luxury visual language: photography/render does the work, whitespace, one accent, restrained motion (sec 7).
14. Disclosure badge and trust signals are structural on every buyer view (root CLAUDE.md section 6; sec 5).
15. Accessibility by design to WCAG 2.1 AA / IS 5568, accessibility statement published, reduced-motion respected, no color-only status (sec 8).

## Audit checklist (tick per current screen)
- [ ] Home shows at most 3 primary steps; no screen presents more than one primary button.
- [ ] Every other option sits under "Advanced", one level deep.
- [ ] Step list visible; current step highlighted; buttons named after the next step.
- [ ] User can exit midway and resume; nothing lost.
- [ ] Empty states say what, teach, and give a button; no "no items" while loading.
- [ ] Upload: visible drop zone plus click button; limits shown before upload.
- [ ] Each file row: name, size, progress, role chip (editable), remove, retry.
- [ ] Errors are specific per case (type, size, empty, failed) and recoverable per file.
- [ ] Large uploads resume after a dropped connection; works from a phone picker.
- [ ] Long job: runs in background; user can close the tab; notification path exists.
- [ ] Step list shows waiting / running / needs you / done / failed with elapsed time.
- [ ] ETA is a range or a step count, never a fake percentage.
- [ ] Cancel exists; cost shown before and after the paid step.
- [ ] Partial results appear as soon as each deliverable is ready.
- [ ] Failure names the step, the cause and a retry for that step.
- [ ] Review screen: source crop beside value; only low-confidence items flagged; bulk accept.
- [ ] Confidence uses color plus text/icon.
- [ ] Buyer page: media first, one hero video, unit picker with list alternative.
- [ ] Sticky CTA on phone; lead form at most 3 fields; targets at least 44 px.
- [ ] Every image/video has reserved aspect ratio; no layout shift; no full-page loaders.
- [ ] Disclosure badge "הדמיה · AI-generated" on every generated image/video.
- [ ] `<html dir="rtl" lang="he">`; no `left`/`right` in CSS (logical properties only).
- [ ] Prices (₪), areas (מ"ר), phones and Latin names are bidi-isolated and render correctly.
- [ ] Only directional icons mirror; play icons and symmetric icons do not.
- [ ] Fonts: license on file (OFL or foundry web license covering our domains and traffic).
- [ ] Contrast 4.5:1 text / 3:1 UI; visible focus; full keyboard path.
- [ ] `prefers-reduced-motion` honored; hero video does not autoplay under reduce.
- [ ] Status never conveyed by color alone (available/sold, confidence).
- [ ] Progress changes announced via polite live region.
- [ ] Accessibility statement and contact channel published and linked in footer.
- [ ] 360/video viewers have keyboard controls and a static fallback.
- [ ] Tested on a real phone and with a Hebrew screen reader.

## Gaps owed (not verified in this pass)
Smashing/Baymard upload and form findings; Material 3 and Apple HIG pages; primary text of the Israeli regulation; Assistant font license; Hafontia current terms; any named luxury-developer or Awwwards site opened and judged; tus/S3 multipart docs; WhatsApp Business notification rules; Stripe/Vercel writing.
