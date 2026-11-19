---
name: feedback-focused-decision-pages
description: "Pages/documents for Eliran must be focused: one diagram + short decision cards (choice · why · trade-off); ONE page per plan whose closed state fits about a screen, with the tools named inside each milestone; long parts folded"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 61dc3a39-ab22-4695-a2aa-21adf5739acc
  modified: 2026-11-17T10:42:46.275Z
---

When presenting research or architecture to Eliran as a page, lead with the decision.
- Each section: a one-line thesis, ONE representative diagram, then short cards: "בחרתי X · למה (one sentence) · על חשבון (one line)".
- A short "what was rejected and why" list is welcome.
- Long tables, sources, budgets and phases go in the MD file and are linked at the bottom.

Eliran, 2026-11-08, on the tabbed stack page: "3 הלשוניות מכילות מלא מידע ומאבדים את זה מי שקורא... יותר ממוקד וברור לקורא מה הבחירה שלך ומה ההסבר... תרשים מייצג... לא מעייף וקריא". Earlier the same day he couldn't find the actual choice in a dense page ("לא מצליח להבין מה התשתית שבחרת").

**2026-11-16 — the HTML file IS the plan he reads.** He ended a plan request with «בסוף אני רוצה לקבל קובץ HTML». I delivered a Markdown plan plus a short HTML summary, led the reply with both, and read "HTML file" as a requirement of the product being planned. He answered «לא היית אמור לשלוח לי קובץ HTML עם התכנית?» after clicking the file link, which opened the HTML as source code in VS Code.
- When he asks for a plan and an HTML file, the HTML holds the whole plan: decision first, the long parts folded (`<details>`), nothing essential left behind a "see the MD". The Markdown is the record for sessions (root §8.8), mentioned last.
- Hand it over rendered, and so that he cannot miss it: open it in a NEW Chrome window (`Start-Process chrome.exe -ArgumentList '--new-window','"file:///C:/…html"'`), show the file in Explorer (`explorer.exe /select,"<path>"`), and write the full absolute path in the reply. A plain `Start-Process <path>` landed as a background tab in his existing Chrome window and he asked «זה לא נפתח לי איפה הקובץ?» (2026-11-16). A file link in the chat opens as code in the editor.
- My interpretation, not his words: when a request mixes a product description with a line about the deliverable's format, take the format line as being about what I hand him, and say so in one line instead of designing the product around it.
- **A link he can open (2026-11-16):** after I gave him the file path with a note that the chat link opens the code, he wrote «שלח לי קישור». What worked: publishing the page as a private Artifact page and sending the `https://claude.ai/artifact/…` address (his 2026-11-08 plan pages were handed over the same way). So when a page for him is ready, publish it and lead the hand-over with that link; keep the file path second. A page published this way must be written in the Artifact page format and republished after every edit ([[project-engine-mcp-plan]] has the details for the engine plan).

**2026-11-17 — ONE page per plan, and the tools named inside the milestones.** He asked which library the engine uses to read the PDF and said he could not understand the architecture from the plan page. I answered with a second, companion page (the engine's stations, each with its tools). His reply: «אבל זה בדיוק מה שאני מחפש שיופיע בMILESTONES פה [the plan page] שאני אבין איזה יכולות או כלים אתה משתמש ואני רוצה שתאחד הכל למסך אחד ותסדר אותו שלא יהיה עמוס במידע».
- No companion pages. A new explanation goes INTO the plan page, at the place it belongs: here, inside each stage and each milestone.
- Every stage and every milestone names the tools and capabilities it uses (library, program, AI model), with one sentence on what each is; paid AI models are marked apart from free local tools.
- The closed page is an overview of about one screen: a row per stage (what it does · tools · state of its milestones · cost). Detail opens on a click; the rest of the plan is an index of folds at the end.
- What I built from it: `C:\RnD\development\plans\2026-11-16-pdf-to-360-engine-mcp.html` (rows are `details.stage`; the build script lived in the session scratch folder, so later changes are edits of the page itself). The companion page became a file that forwards to it.
- My interpretation, not his words: «מסך אחד» = one page whose closed state fits roughly one screen, not "no scrolling at all". He has not confirmed that reading.
- **Say what every OUTPUT physically is (same day, three messages in a row).** I had written a stage's output as «תכנית מדודה: חדרים, קירות, חלונות, דלתות ומידות». He asked: «מה זה אומר תכנית זה קובץ JASON? זה תכנית PYTHIN תסביר לי … שזה יהיה ברור במסמך גם». A noun like "plan", "report" or "gate" tells him nothing. For every stage write: the output, the kind of file it is in plain words (a JSON file = a text file of data, not a program; an image; an HTML page that opens in a browser), the files by name with one sentence each, and ONE real example with real numbers (for the engine: the living room of apartment 846 as it is written in `plan.general.json`). Tools (Python, Node.js, Blender) are named as the things that make and read the files, apart from the files themselves. And whatever I explain to him in the chat goes into the page in the same turn: he asked for that twice.

**Why:** Dense pages hide the decision. He reads for "what did you choose and why", not for completeness.

**How to apply:** Start every page with the answer. Keep it to one diagram per section. Colour must carry meaning, for example by language or plane. Push completeness into the linked MD. Related: [[feedback-research-phase-no-asks]], [[feedback-delegated-harness-calls]].
