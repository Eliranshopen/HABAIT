
## 2026-11-04 · main session rnd-1f · Eliran: after his go, the session runs the deploy itself
- **Did:** Eliran, 2026-11-04 (board hold-building-tour): 'אני לא רוצה ששום בדיקת בטיחות תעצור אותך תריץ אתה'. The main session ran the habait-flow prod deploy itself (dpl_3avVrzv8zeGVMjMifW2bYbz9KQsZ, 10:59), linking by copying the project link folder from the previous stage instead of a link step that writes a keys file. Each deploy still needs its own go (root section 9 unchanged).
- **Evidence:** `development/tasks/hold-building-tour/README.md`
- **Learned:** Copying the project link folder (orgId, projectId, projectName) from the last stage avoids the link step and its keys file.
- **Owed / open:** Root CLAUDE.md 8.2 still says hand the command to Eliran; rewording it is Eliran's call
- **Second reader:** `habait-deploy-qa`

## 2026-11-04 · main session rnd-1f · Deploy ruling written into the rules
- **Did:** On Eliran's 'כן' the deploy ruling went into root CLAUDE.md 8.2 (deploys run by the main session after his own go; deletes still handed to him) and the Classifier law row of docs INHERITED-DECISIONS.
- **Evidence:** `CLAUDE.md` · `docs/INHERITED-DECISIONS.md`
- **Learned:** none
- **Owed / open:** none
- **Second reader:** none

## 2026-11-04 · main session rnd-1f · Deploy procedure (the root 8.2 pointer target)
- **Did:** Procedure after Eliran's go for that deploy: (1) ask every session that touches the project; one stage from live, one deploy. (2) stage_flow.py into a NEW folder. (3) diff the new stage against the last deployed stage by sha256 (cmpstage.py; skips dot-files); only the expected files may differ. (4) a fresh QA on the stage. (5) copy the link folder's project.json from the last stage (orgId, projectId, projectName); no link step, so no keys file is written. (6) npx vercel@65.9.0 deploy --prod --yes --scope eliran-5390. (7) inspect the deployment, hash the served files against the stage, then deployed-site QA.
- **Evidence:** `development/tasks/hold-building-tour/README.md`
- **Learned:** none
- **Owed / open:** none
- **Second reader:** none

## 2026-11-05 · fork F (rnd-9d) · the predeploy gate (desktop + mobile, in code)
- **Did:** Eliran: «כל דבר שאתה מעדכן חייב להתאים גם לגרסת המובייל בנוסף לגרסת הדסקטופ» — «וזה כלל שחייב להיות בלוגיקה בקוד». A step is added between (2) stage and the deploy: `stage_flow.py` now ends by running `Habait/tools/deploy/predeploy.mjs <stage>` (tracked, in habait-walkaround) = `Habait/tools/qa/responsive-gate.mjs` on the stage served locally with its vercel.json rewrites, over /, /landing.html, /apartment.html, /hold/, /studio/ and /tour/?room=<every room>, at 1440×900 and 390×844. FAIL (page error, 4xx other than /api, overflow on either side, a target < 44 px, a control over > 15% of the panorama) → stage_flow exits 1 and the stage carries PREDEPLOY-FAIL.json: **do not deploy it**. Until the gate is merged into the live tree, pass `--gate-root <worktree>/Projects/Habait/habait-walkaround`; without it stage_flow prints «PREDEPLOY GATE: NOT RUN» (never a silent pass).
- **Evidence:** `.wt/project-runner` commit ef02ade; baseline run on the live stage — see `memory/runs/2026-11-05-project-runner-fork-f.md`.
- **Learned:** the same gate runs in the project runner (step qa) before a portal project is published.
- **Owed / open:** the baseline's failures are findings for the coordinator (fixes, not a weaker gate).
- **Second reader:** `habait-deploy-qa` — every habait-flow deploy now starts from a PASS of this gate.
