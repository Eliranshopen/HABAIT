
## 2026-11-04 · main session rnd-1f · board hold-building-tour SHIPPED + CLOSED
- **Did:** Button 'הדמיית הבניין והסביבה' on /hold/ (after the orbit clip) opens the tour's project scope (aerial, orbits, tower, descent, rooms) in an overlay at the same URL; X / Esc back; old 846 hand-off unchanged. Files: flyover3d index.html + app.js only. Gate FAIL D1 (sound left silent on a fast close) fixed with fadeGen, re-gate PASS. Copied back on Eliran's 'כן תעלה לאוויר'; one stage from live (vs rnd-23's deploy-prod-6: the 2 files only); the session deployed it itself on his ruling: dpl_3avVrzv8zeGVMjMifW2bYbz9KQsZ 10:59. QA live 80/80 PASS, QA prod 80/80 + paint proof PASS. Cost 0.
- **Evidence:** `development/tasks/hold-building-tour/README.md` · `development/tasks/hold-building-tour/logs/qa-deployed.md`
- **Learned:** qa_chain.cjs is stale since the platform redesign (waits for a.project-card); start checks from #heroCta. Software-GL timing makes the tour auto chain slow on the tablet profile: 90 s wait. A ✕ over an iframe must be checked against the iframe's own controls (5x5 grid sample).
- **Owed / open:** Removing .wt/hold-building-tour is Eliran's act; qa_chain.cjs repair (tools/deploy-vercel) unowned; real iOS Safari untested
- **Second reader:** `habait-deploy-qa`
