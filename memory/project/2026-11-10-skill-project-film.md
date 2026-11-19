
## 2026-11-10 · main session · skill project-film written from a reference-film teardown
- **Did:** Eliran handed a 70.9 s developer project film (screenshots/WhatsApp Video 2026-11-10 at 12.52.58.mp4) and asked for a full reverse-engineering and a skill that makes such films. Took it apart with ffprobe, 1 fps contact sheets, dense transition frames, scene-cut detection and a spectrogram (22 shots + logo card, hard cuts, two object wipes, 24 caption phrases), and wrote the skill project-film (group V): ten-beat arc, inputs, workflow, caption rules, flags, acceptance, shot recipes R1-R10, storyboard template.
- **Evidence:** `.claude/skills/project-film/SKILL.md`
- **Learned:** The reference breaks three Habait rules (no badge, real place names over generated footage, real buildings erased in the opening morph): the skill raises them as Eliran's calls at the storyboard. Narration is inferred, not verified (no speech-to-text installed). video/ and its toolkit do not exist on disk, so video-division's commands cannot run.
- **Owed / open:** Not hand-proven (root §3): the first film is run by hand. Eliran: name the first project and its assets; rule on the flags in SKILL.md §6. video/ toolkit must exist before any generation. docs/context-map.generated.md gets the three new context files at the next /sync-context.
- **Second reader:** none
