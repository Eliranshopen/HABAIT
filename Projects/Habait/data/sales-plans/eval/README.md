# eval/ — intake model runs against ground truth

Each dated folder holds the raw model outputs (`inputs/`), the exact prompts used, and the scored
results produced by `tools/eval_intake.py`. Nothing here costs money to re-run: scoring is offline.

```
eval/
├── README.md
└── 2026-11-02/
    ├── inputs/
    │   ├── prompt_full-sheet.txt           ← the prompt given to the model (verbatim)
    │   ├── prompt_crop.txt
    │   ├── sonnet_full-sheet.json          ← raw model output (code fences tolerated)
    │   └── sonnet_crop.json
    ├── sonnet_full-sheet.result.json       ← scored
    ├── sonnet_full-sheet.md                ← human-readable report
    ├── sonnet_crop.result.json
    ├── sonnet_crop.md
    └── SUMMARY.md                          ← one table for all runs of that day
```

## Adding a new model run

1. Produce the model's JSON for one unit using the prompt shape in `inputs/prompt_*.txt`
   (`rooms[]`, `printed_dimensions_cm[]`, `openings{}`, `unit{}`, `confidence`, `notes`).
   Rights check first: the unit's `meta.json → rights` must allow sending the drawing to that provider.
2. Save it as `eval/<YYYY-MM-DD>/inputs/<model>_<variant>.json` and the prompt you used as
   `inputs/prompt_<variant>.txt`. Variants so far: `full-sheet` (whole PDF page at 150 dpi),
   `crop` (apartment only, ~1800×2150). Add `288dpi`, `with-hints`, etc. as needed.
3. Score (from `C:\RnD\Projects\Habait\data\sales-plans`):

   ```
   PYTHONIOENCODING=utf-8 C:/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe -I tools/eval_intake.py \
     --unit israel-canada/rainbow-tel-aviv/unit-846 \
     --pred eval/<date>/inputs/<model>_<variant>.json --label <model>_<variant> \
     --out eval/<date> --md eval/<date>
   ```

   Several `--pred/--label` pairs in one call print a comparison table; paste it into `SUMMARY.md`.
4. For a new unit: the unit folder needs `meta.json` (rooms as labelled on the drawing, with
   `printed_dims_cm`, and `drawing.printed_dimensions_cm`) and ideally `plan.json`. The script
   takes the room list from `meta.json` (what a reader can see) and uses `plan.json` only for
   traced clear dims and the opening count.

## What the numbers mean

| field | meaning |
|---|---|
| `rooms.recall / precision` | GT rooms found / predicted rooms that correspond to a real one. Matching is fuzzy: Hebrew/English synonyms (`SYNONYMS` in the script), final-letter and punctuation normalisation, type group, outdoor flag, and a dims match. Threshold 0.55. |
| `rooms.type_accuracy` | among matched rooms, same canonical group (bathroom≠toilet counts as wrong here but costs 0 in edit cost). |
| `rooms.name_exact_rate` | the printed Hebrew label was read verbatim. Low = the model paraphrases ("סלון" for "חדר דיור"). |
| `dims.recall` | printed dimension values (bag match, ±1 cm). Beware coincidences: 2/16 "hits" can be two numbers that happen to exist on any plan (185, 275). |
| `dims.room_dims_correct` | the honest number: GT rooms whose `[w,d]` the model attached correctly within ±3 %. |
| `unit.correct` | unit number (digits only), area, terrace area (±2 %), floor. |
| `edit_cost` | corrections a human must make: add room 2, remove 1, rename 1, retype 1, fix a room's dims 1, add a missing dim value 0.5, delete a wrong value 0.25, fix a unit field 1. `from_scratch` = typing the whole meta by hand. |
| `edit_score` | `1 − edit_cost / from_scratch`. 0 = the model saved no work. Target for a usable intake: ≥ 0.8 (A1 gate: "< 20 min correction per plan"). |

Openings counts are printed but not scored: the trace counts openings between zones (13 for 846),
a reader counts drawn doors; the two are not comparable yet.

## Limitations (v0)

- One unit of ground truth. E1 wants 10 before any number is trusted.
- Fuzzy matching is deliberately generous (a "children's room" matches the main bedroom as "same kind
  of room, needs rename"); the rename shows up in edit cost, not in recall.
- `meta.json` lists 10 labelled rooms; `plan.json` has 11 zones (the terrace is split for the tour).
  Recall is against the 10.
- No geometry scoring yet (polygons/openings in cm). That comes with the tracer eval in lane A.
