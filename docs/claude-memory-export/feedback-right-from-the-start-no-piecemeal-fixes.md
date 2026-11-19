---
name: feedback-right-from-the-start-no-piecemeal-fixes
description: "Eliran 2026-11-17 on the Kedma D/1 tour: a simulation must feel like a real apartment; check it against the sales plan before any picture; ask him questions; never drip money on one fix after another"
metadata:
  node_type: memory
  type: feedback
  originSessionId: d7be4180-9a6b-4af4-ae2c-b5816c2cda5a
  modified: 2026-11-17T07:02:45.262Z
---

Eliran, 2026-11-17, after looking at the rebuilt Kedma D/1 tour (his words): «מי שרואה את ההדמייה ירגיש כאילו הוא רואה דירה אמיתית אז תשאל אותי שאלות אם צריך כדי שנדייק דברים. המטרה שלי היא שנצליח להגיע לתוצאה האופטימלית בלי כל פעם להוציא עוד כסף על תיקונים אלא שנעבוד על הכל כמו שצריך מהתחלה» and «אתה חייב לעבור על תכנית המכר ולהתאים את הכיוונים והפרופורציות כמו שצריך».

What he had just found, each with a screenshot, after I had reported the tour as fixed: the kitchen island still crooked, the view still like a fish eye, furniture and doors blurred, the passage to the rooms missing, the corridor arrows on the wrong doors. He was right on every one; the pipeline's 1 % fidelity gate and my own flat-view checks had passed all of it.

**Why:** I fixed symptoms in the pictures (16 paid calls that day) while the causes were upstream: the 3D model itself differed from the sales plan (an island rotated 28° by a furnish rule), whole-panorama AI pictures are not geometry-true (doors drawn 7–8° off, an invented wall where an opening shows the next room), and the apartment was generated at half of Rainbow's resolution. Each round cost him money and a look, and the next look found more.

**How to apply (the last two points are my reading of his words):**
- Before any picture is generated for a simulation, check the 3D model against the sales-plan sheet fixture by fixture and room by room: an overlay on the sheet, the CG seen from above, every door and fixed fixture; do not rely on the fidelity gate for this, it compares walls.
- Judge a tour the way he does: open it in a real browser, look around and down in every room, follow every arrow, look through every opening into the next room. A passing gate is not a look.
- When a look finds one defect, look for its cause upstream and for the same defect everywhere before spending; propose one complete, costed pass instead of a fix per complaint.
- Ask him when something only he can decide affects realism or cost (furniture as drawn or free, finishes, budget, a pilot room); he asked for questions.
- Report what was not checked as plainly as what was; "fixed" means seen by me at his framing.

See [[rule-sales-plan-fidelity]], [[feedback-realism-over-diagram-look]], [[feedback-focused-decision-pages]], [[project-kedma-d1-simulation]].
