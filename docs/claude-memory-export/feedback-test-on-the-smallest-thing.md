---
name: feedback-test-on-the-smallest-thing
description: "Eliran 2026-11-17 — when the goal is to build the engine, test it on the smallest thing that proves the point (one room, not a whole apartment) and do not prove the same code twice; he merged the three render milestones into one"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 40c3c5f2-e1ea-4dd3-baf1-ad71447227fd
  modified: 2026-11-17T07:43:13.987Z
---

Eliran, 2026-11-17, reading the plan page: «באבן דרך 2.1 אתה מדבר על רינדור של דירה 846? למה?», then «השאלה אם רינדור של דירה 846 הוא הכרחי כרגע? זה יגזול ממך זמן ומשאבים כשכל המטרה שלנו היא לבנות כרגע את הENGINE», then «אני מציע לרנדר אולי חדר אחד ולא דירה שלמה בשביל לבדוק את הENGINE». After I explained what the decision changes he answered «כן»: milestones 2.1, 2.2 and 2.3 of the engine plan became one (27 milestones, not 29).

**Why:** the plan proved each capability twice on the same apartment: once by hand ("prove the existing code": one room, then the whole apartment) and once more as the engine's own stage. To him the second full run is time and machine spent on something that does not build the engine.

**How to apply (my reading):**
- While building the engine, a test runs on the smallest input that proves the point: one room to see that a chain works in the engine home, two rooms where the test needs a finished one and an interrupted one. The whole apartment runs only where a milestone's own closing line needs every room (the CG check 3.1, the tour 3.2, the acceptance 7.5), once, through the engine.
- Before starting a stage group, look for a "prove by hand" milestone followed by a "make it a stage" milestone on the same input, and propose the merge myself, with the price of the merge stated. Stage 5 (the AI look: 5.1, 5.2, 5.3) is the next one and there the double run also costs about $7: it is question 8 of the plan's section 10, his to answer when we get there.
- A change to the list of milestones he approved is his decision: recommend, wait for his word, then update the plan, the page and the board in one step.
- When he asks «מה זה ישנה ההחלטה?» / «מה המשמעות?» he wants plain words: what he gains, what he gives up, how likely the loss is, and what stays the same. A four-cell table was not enough; the explanation in sentences was.

Related: [[project-engine-mcp-plan]], [[feedback-status-against-the-plan]], [[feedback-focused-decision-pages]].
