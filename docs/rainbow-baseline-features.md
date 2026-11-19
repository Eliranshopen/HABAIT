<!-- 2026-11-17 · main session · root CLAUDE.md §8.10 -->
# RAINBOW baseline — the feature checklist every project starts from

Rule: root `CLAUDE.md` §8.10 (Eliran, 2026-11-17). Source: the RAINBOW tour (apt846, Rainbow Tel Aviv) in
`Projects/Habait/habait-walkaround/Habait/tour360/` — `viewer/tour.js`, `viewer/edit-live.js`, `server/handler.mjs`,
copy in `copy/tour360-copy.json`. Surveyed 2026-11-17 (read-only).

**Take the interface and the features, never RAINBOW's furniture, items or catalog pictures** (Eliran, 2026-11-17) — alternatives come from the project's own model or CC0 sources.

Every project's QA checks this list row by row: **built** / **built differently (why)** / **left out (why)**. Nothing is dropped silently.
"Paid" = a fal / OpenRouter call through `/api/edit` in RAINBOW; in a 3D walkaround most of these can be done at $0 by changing the model itself.

| # | Feature | RAINBOW (360) | Paid there? | Hebrew UI |
|---|---|---|---|---|
| 1 | Swap circles on furniture → catalog of alternatives, item card (photo, name, price) | `markers.json`, `makeMarker` tour.js:171, `openPick` edit-live.js:61, `catalog/items.json` | yes (nano-banana-2 edit, ~$0.09–0.18) | «לחצו על רהיט כדי להחליף אותו», «בחרו פריט במקום {target}» |
| 2 | Free-text design line (300 chars), scope rules (no structure changes) | `#t-change-bar`, handler.mjs:724-790 | yes (gemini parse + flux/kontext edit; $5/day cap) | «תארו שינוי בחדר, למשל: ספה אפורה כהה…», «החלה» |
| 3 | Undo · show original/changes · reset · list of my changes | `undoLive`, `toggleOriginal`, `#t-change` | no | «ביטול השינוי האחרון», «הצגת המקור», «איפוס השינויים» |
| 4 | "שינוי שלכם" tag on a changed view + permanent «הדמיה» badge + AI note | tour.js | no | «שינוי שלכם», «הדמיה» |
| 5 | Finish set: floor parquet / concrete / marble | `setFloor` tour.js:1184 | no (pre-rendered sets) | «ריצוף», «פרקט / בטון / שיש» |
| 6 | Designed / original look | `setLook` :489 | no | «מעוצב / מקור» |
| 7 | Prepared examples | `toggleEdit` :823 | no | «דוגמאות מוכנות» |
| 8 | Room navigation: floor arrows, room strip, ‹ › | :272-283, :346-360 | no | «כניסה אל {room}», «רשימת החדרים» |
| 9 | Click-to-move, arrow keys | :2316-2494 | no | «קדימה / אחורה…» |
| 10 | Floor-plan sheet with position + view cone + compass | :285-330 | no | «תוכנית הדירה» |
| 11 | 3D dollhouse | `openDh` :1422 | no | «תלת-ממד» |
| 12 | View-modes menu | :972-1003 | no | «סגנונות צפייה» |
| 13 | Measure (two points) | :1523-1618 | no | «מדידה», «לחצו על שתי נקודות…» |
| 14 | Voice tour | :1620-1683, `guide/guide.json` + audio | no (recorded audio) | «סיור קולי» |
| 15 | Button walkthrough (coach) | :1684-2260 | no | «הסבר על הכפתורים», «דלג» |
| 16 | Camera: zoom in/out, auto-rotate, reset view, full screen | :1099-1116 | no | «הגדלה / הקטנה / סיבוב איטי / איפוס תצוגה / מסך מלא» |
| 17 | Tap to hide controls (phone) | :2262-2315 | no | «להסתרת הכפתורים לחצו על המסך» |
| 18 | Language he / en / fr | `setLang` :682 | no | «עב / EN / FR» |
| 19 | Intro passage, back to building | `autoArm` :648 | no | «חזרה לבניין» |
| 20 | Room / intro video | :1118-1270 | no | «סרטון החדר» |
| 21 | Shareable URL (room, lang, look, floor, yaw, change) | `syncUrl` :614 | no | — |

Not in RAINBOW (so not baseline): day/night, share button, favourites, price summary, before/after slider.

Paid features in a new project still follow §7 and Eliran's 2026-11-17 ruling «אני אספק את התמונות» — without his go, build the $0 form and say so.
