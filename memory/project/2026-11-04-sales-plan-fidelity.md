
## 2026-11-04 · main session rnd-67 · Eliran: the simulation must match the sales plan exactly
- **Did:** Eliran ruled: every dimension, detail and element of the simulation must be accurate to the sales plan; a buyer must never see a simulation that differs from it. This strengthens root section 6 (add-only, never alter geometry) into a fidelity requirement.
- **Evidence:** `memory/HOT.md`
- **Learned:** Today's apt846 tour carries the concept line 'הריהוט, הנוף וחלק מהמידות מדומיינים' and was never audited room by room against the sales plan; the typed bar already refuses structure and view changes (handler SCOPE structure:false).
- **Owed / open:** rnd-67: propose a plan-fidelity audit of the 11 rooms (dimensions, windows, doors, fixed kitchen/bath elements vs the sales-plan PDF) and a fidelity gate in the developer platform
- **Second reader:** `habait-deploy-qa`

## 2026-11-04 · fidelity-audit sub-agent (general-purpose, for the main session) · apt846 sales-plan fidelity audit
- **Did:** Audited the 11 apt846 panoramas against the sales-plan PDF (read and judge only, $0). Verdict DEVIATES: 3 S0, 3 S1, 6 S2, 3 Q. The S0s are an extra curved glass wall in the living room, a window over the terrace column face in the main bedroom, and an invented doorway in the dressing nook.
- **Evidence:** `Projects/Habait/research/fidelity-audit-2026-11-04/manifest.json`
- **Learned:** The CG originals sit on the traced plan in every room; all three S0s were introduced by the AI skin pass, so a mechanical gate (traced floor/ceiling lines or CG-vs-pano structure) catches them. Trace errors: hob on the wrong kitchen leg, terrace south passage unmodelled (18.69 vs 26.15 m2), whole terrace roofed (plan: 14.34 m2 covered).
- **Owed / open:** Main session: save REPORT.md from the sub-agent's return text; regenerate 04/07/08 (and 02/03 after the kitchen trace fix); trace fixes F4/F5/F6/F8; Eliran: OQ-G4 roof ruling, conceptLine wording, PDF tracked in git despite rights note.
- **Second reader:** `habait-deploy-qa`

## Eliran's rulings after the audit (2026-11-04, rnd-67)
- **Disclosure line:** replace "חלק מהמידות מדומיינים" with wording that states the measured deviation from the sales plan (exact text: rnd-67 drafts, Eliran approves; it may only claim what the fidelity check proves).
- **Terrace roof:** follow the sales plan (roof only inside "קו קומה מעל", 14.34 m²); supersedes OQ-G4 for apt846.
- **Sales-plan PDF in git:** allowed ("לא אסור … תמחק את החוק הזה כי מותר"); the "never in git" note in `apt846/apartment.json` removed (merge `9039ba2`).
- Audit: `Projects/Habait/research/fidelity-audit-2026-11-04/REPORT.md` (DEVIATES: 3 S0 from the AI skin pass, 3 S1).
- **The AI checks, not the developer (Eliran 2026-11-04 ~17:15: "אני לא יכול שהיזם יאשר ולהסתמך על זה, אני צריך שהסוכן AI מאחורי הקלעים יבדוק התאמה").** Every trace passes an automatic `trace-check` (each printed dimension/area within 2 %, every label one room, every door arc an opening, an independent vision judge with an empty mismatch list) with self-correction; FAIL blocks the build and goes to Habait's review queue, never to the developer. Every designed pano passes the fidelity gate + cross-scene consistency. The developer only sees PASS results.
- **Kitchen uppers (Eliran 2026-11-04 ~18:30: "לך לפי לוח החומרים, מה שהכי תואם לאמת"):** apt846's kitchen upper storage follows `material-board.json` — two slim open shelves — in the CG and in every scene that sees the kitchen (02/03/04), replacing the closed cabinets of batch 1.

## 2026-11-05 · main session rnd-9d · Eliran's ruling: 2 % is the hard cap, and the line says so
- **Did:** Eliran ruled (2026-11-05 ~12:40, verbatim): «אסור סטייה של 29% — סטייה נורמלית זה גג עד 2% וזה גם צריך להיות מצוין במלל בהדמייה». So: the fidelity gate passes a room only at ≤ 2 % deviation from the sales plan, hard, for every room; a room over 2 % never ships (no "state the measured number" variant — that fork-A line with 29 % for the terrace, commit e7ffd48 in `.wt/fix-846-fidelity`, is reverted); the disclosure line is the fixed approved text «הדמיה על בסיס תכנית המכר. המידות תואמות לתכנית בסטייה של עד 2%. הריהוט והגימורים להמחשה בלבד.» and the build refuses to package while any shipped room is over 2 %, so the line is always true when shown.
- **Evidence:** this entry (chat ruling); fork A's gate.json under `.wt/fix-846-fidelity/.../apt846/_local/fidelity/` (terrace 05/06 at 29 % area, −20 % length; every other room ≤ 2 %).
- **Learned:** the 2 % threshold is the same number trace-check already uses for printed dimensions; it is now also the pano gate's threshold and a runner parameter (stepGate), not a constant buried in the tool.
- **Owed / open:** fork A: 2 % gate + fixed line + regenerate terrace 05/06 after the CG re-render (paid, ~$4–5, budget asked of Eliran — $25 spent); project-runner: read the threshold from the package contract.
- **Second reader:** `habait-deploy-qa` — a deploy of apt846 with any room over 2 % is blocked by the gate, not by judgement.
- **Addendum 2026-11-05 ~12:55 (Eliran, verbatim):** «אל תעצור יש לך אישור — אבל אם יש סטייה מעל 2% אני גם לא רוצה שתבטל את ההדמייה אלא תעשה הכל כדי שהכל יהיה תקין והכל יופיע כמו בתכנית מכר». So a FAIL never drops or hides a room: the gate's FAIL means repair/regenerate until the room is ≤ 2 % (max attempts a parameter, CG as the structure reference); the package refuses only while something still fails. Budget: $10 on top of the spent $25 for apt846 (terrace 05/06, 03 hob, finishes), soft $8.

## 2026-11-05 · main session rnd-9d · Eliran: the portal is autonomous; the uploads are acceptance tests; habait-flow is the session's own responsibility
- **Did:** Eliran ruled (2026-11-05 ~13:00): «מה שקיים בפורטל לא צריך להגיע אלייך לתיקון ידני כי הפורטל צריך להיות עצמאי. התכנית מכר שהעלתי … זה נטו כדי לבדוק שהתוצאה הסופית יוצאת כמו התוצאה הידנית שעשינו עבור … Rainbow. לגבי הסרטון וההדמיות של habait-flow … האחריות כולה שלך שהכל יצא טוב זה לא קשור לפורטל». So: (1) a Habait hand-fix is never the plan for a portal job; the review queue stays only as a safety net that must not fire; (2) the acceptance test of the portal = upload the 846 sales-plan PDF (his project pmw25zqqf4bb478) and the automatic result must equal the hand result for Rainbow apt846 (trace vs the hand plan.json, then the tour); Maale Efraim and other uploads are generalisation tests; (3) the live Rainbow site (film + 360 tour) is the session's responsibility end to end, separate from the portal.
- **Evidence:** this entry (chat ruling); job jmw2b2c8iebab49 (846 PDF through the portal) = FAIL 53/72 at 12:20.
- **Learned:** the success metric is concrete: auto-trace of the 846 PDF matched room by room against the hand plan.json (fork B adds it to trace_rounds).
- **Owed / open:** fork B: auto = hand on 846; fork E: the sandbox worker; fork A: the live Rainbow fixes.
- **Second reader:** `habait-deploy-qa` — a portal release is accepted only when the 846 PDF reproduces the hand result.

## 2026-11-05 · main session rnd-9d · Eliran's advance deploy go for the Rainbow fixes, conditional on consistency
- **Did:** Eliran (2026-11-05 ~13:20): «תעלה מייד רק אחרי שאתה עובד על הכל ומוודא שיש עקביות בתמונות. כמו למשל הבעייה שהייתה עם המטבח … צריך להיות עקביות והכל תקין». This is his own go (root §9) for ONE deploy of the apt846 fixes to habait-flow, valid only when all of these hold: every room PASSes the gate (1% bar) in every look and finish set; cross-scene consistency PASSes for every element seen from more than one scene (kitchen, living, dining, terrace, bedroom, wardrobe, baths, floors); the rings are rescanned; the main session checks the consistency sheets itself before shipping.
- **Evidence:** this entry (chat ruling).
- **Learned:** consistency is a deploy condition next to fidelity: the same object must look the same from every scene that sees it.
- **Owed / open:** fork A finishes and reports; the main session verifies, deploys, writes the SHIP-LEDGER row quoting this go.
- **Second reader:** `habait-deploy-qa`.

## 2026-11-05 · main session rnd-9d · navigator call: a printed dimension is checked between its own extension lines
- **Did:** apt846's main bedroom read +1.22 % against the printed 348×344 because the trace loop includes the terrace-door bay between the columns (393 cm E–W), while the printed 348 is to the column faces. The session ruled (technical convention, not a liability call): the geometry follows the drawing, so the bay stays; the check compares a printed dimension to the span between its own extension lines, never to the whole room loop; a bay or niche is reported separately against the drawing. Fork A encodes it in trace_check/gate, so the portal inherits it.
- **Evidence:** fork A's report 2026-11-05 ~13:35; gate v3d in `.wt/fix-846-fidelity`.
- **Learned:** a "deviation" can be a measurement-convention error, not a geometry error. Always check what the printed line spans.
- **Owed / open:** fork A: encode + re-gate.
- **Second reader:** none.

