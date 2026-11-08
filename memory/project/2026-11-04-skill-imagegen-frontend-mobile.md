
## 2026-11-04 · main session · Installed skill imagegen-frontend-mobile (Leonxlnx/imagegen-skills)
- **Did:** On Eliran's ask installed imagegen-frontend-mobile with npx skills add -a claude-code --copy -y. The URL he gave (leonxlnx/taste-skill) no longer has it: upstream commit 825e306 (2026-10-19) moved it to Leonxlnx/imagegen-skills, per that repo's README. The classifier blocked the install from the new repo until Eliran said 'תתקין בעצמך'. Scanned the 1,465-line SKILL.md: prose only, no commands, URLs or secret access. Frontmatter-only edit (OWED-018 standard): description of 205 chars, upstream one kept as a YAML comment, allowed-tools Read/Grep/Glob/Write/Edit. Counts 33->34 skills, 19 auto; skills-lock.json now pins 5; register row in docs/skill-taxonomy.md; map row in .claude/skills/CLAUDE.md; generate-cards.py --check 0 missing / 0 stale.
- **Evidence:** `.claude/skills/imagegen-frontend-mobile/CLAUDE.md`
- **Learned:** skills.sh install URLs go stale when an author splits a repo; the old repo's README maps old install names to new repos. A different repo than the one Eliran named needs his explicit word (classifier).
- **Owed / open:** none; it only directs images — any real generation is a paid call under root §7
- **Second reader:** none
