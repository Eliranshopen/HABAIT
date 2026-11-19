## 2026-11-09 · main session · UI/UX skills installed on Eliran's word
- **Did:** on Eliran's word («תוריד את npx skills add https://github.com/vercel-labs/skills --skill find-skills ותתקין סקילים מתאימים של UI UX») installed with `npx skills add … -y --copy`: find-skills (vercel-labs/skills), build-awwwards-quality-sites and cinematic-scroll-storytelling (mengto/skills), landing-page-design (101-skills/superpowers). The CLI wrote `.claude/skills/<name>/`, `.agents/skills/` and skills-lock.json.
- **Evidence:** `npx skills find` results ("landing page design", "web design", "ui ux", "premium landing"). A content review found no install scripts or secrets. landing-page-design uses inference.sh (external, paid) image generation, so it is forbidden in briefs; only its layout and CTA rules are used.
- **Learned:** the `superpowers@landing-page-design` listing appears under many forks; picked the most-installed one. Meng To's skills fit a cinematic real-estate launch page.
- **Owed / open:** register the four skills in docs/skill-taxonomy.md and .claude/skills/CLAUDE.md at the next /sync-context; `.agents/` is install output from the skills CLI.
- **Second reader:** none.

## 2026-11-09 · main session · text and animation skills added (Eliran «תחפש סקילים באינטרנט של טקסט והנפשה»)
- **Did:** `npx skills find` for "text animation", "kinetic typography", "copywriting", "gsap" and "luxury copywriting". Installed (`--copy`): greensock/gsap-skills gsap-scrolltrigger, gsap-plugins and gsap-timeline (the official GreenSock skills, about 80K installs each), coreyhaines31/marketingskills copywriting (249K), and miqdadbadjuber/anti-slop antislop-copywriting (8K). A review found no scripts and no secrets; one grep hit was the word «curl» in prose.
- **Evidence:** the skills CLI output; `.claude/skills/<name>/`.
- **Learned:** Eliran picked direction B (midnight sea and bronze) over the recommended A, and calls plain copy «משעמם». He wants sensory, specific copy with animated type.
- **Owed / open:** register the skills at the next /sync-context.
- **Second reader:** none.

## 2026-11-09 · main session · reverse-engineering skills (Eliran «תחפש סקיל של reengineering ותתקין ותשתמש בו»)
- **Did:** `npx skills find` for "reverse engineer website", "website teardown" and "clone website design". Installed (`--copy`): niazmorshed2007/reanimate (frame-by-frame capture, analyse and verify of a site's motion; it has scripts that may need bun) and jezweb/claude-skills design-system (extracts a DESIGN.md from a site). Skipped firecrawl-website-design-clone because it needs a paid Firecrawl key. The installed reverse-engineer-anything (REA) is also available.
- **Evidence:** the skills CLI output. The review found reanimate's scripts are capture/compare code; one doc line mentions `curl` for downloading reference videos. The design-system Stitch path needs STITCH_API_KEY and is forbidden in briefs.
- **Learned:** Eliran's landing reference is https://rainbowtlv.com/ (the project's own site). The rule is learn and rebuild the patterns, never copy their code, text, logo or media.
- **Owed / open:** register the skills at /sync-context.
- **Second reader:** none.
