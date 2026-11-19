---
name: feedback-deploy-run-it-yourself
description: "After Eliran's own go for a prod deploy, the session runs it itself; don't stop at a safety-check block and hand him the command"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 85df1459-ec23-42d3-9605-6e5d8c9f9665
  modified: 2026-11-04T09:14:50.927Z
---

Eliran, 2026-11-04: "תריץ חופשי ללא עצירה בגלל בטיחות" (and earlier the same day to another session: "אני לא רוצה ששום בדיקת בטיחות תעצור אותך תריץ אתה"). Root `CLAUDE.md` §8.2 was reworded the same day: deploys are run by the main session after his go; deletes are still handed to him.

**Why:** he got tired of copy-pasting `!` deploy commands after he had already said go.

**How to apply:** every prod deploy still needs its own explicit go (root §9). Once given, stage from live right before, copy `.vercel/project.json` from the last stage (no link step, no keys file), deploy, then verify live (curl + playwright site_check) and add the SHIP-LEDGER row. If the classifier blocks, re-run the same command once (never split or disguise it); if blocked again, hand him the command. See [[reference-habait-sites]].

**2026-11-11 mistake:** a stage that FAILED the predeploy gate was deployed to the test link because `vercel deploy` sat after a `( stage; echo )` group in one chain. Deploy only inside an `if` that tests the stage's exit code and the `PREDEPLOY GATE: PASS` line (a failed predeploy gate = stop, fix, restage).
