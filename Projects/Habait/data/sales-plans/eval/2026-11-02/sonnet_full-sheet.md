# Intake eval: `sonnet_full-sheet`

Ground truth: `israel-canada\rainbow-tel-aviv\unit-846\meta.json` + `israel-canada\rainbow-tel-aviv\unit-846\plan.json`

| metric | value |
|---|---|
| rooms recall / precision / F1 | 0.6 / 0.75 / 0.667 (6 matched of 10 GT, 8 predicted) |
| type accuracy (matched) | 0.833 |
| Hebrew label read verbatim (matched) | 0.5 |
| printed dims recall / precision | 0.125 / 0.222 (2 of 16 GT values; 9 predicted) |
| room [w,d] within 3 % | 0 / 7 |
| unit fields | 0 / 4 |
| edit cost (lower is better) | 32.75 (typing from scratch = 39.0) |
| edit score | 0.16 |
| model's own confidence | 0.75 |

## Room matching

| GT (drawing) | predicted | score | type ok | GT dims | pred dims | dims |
|---|---|---|---|---|---|---|
| חדר שינה | חדר שינה (Bedroom) | 1.0 | yes | [342, 275] | None | missing |
| חדר דיור | חדר דיור (Living room) | 1.0 | yes | [744, 530] | [545, 395] | wrong |
| מטבח | מטבח (Kitchen) | 1.0 | yes | None | None | n/a |
| חדר רחצה הורים | חדר אמבטיה (Bathroom) | 0.869 | yes | [212, 210] | None | missing |
| מרפסת שמש | מרפסת גג (Roof terrace) | 0.838 | yes | [1213, 270] | None | missing |
| חדר רחצה כללי | בית שמוש (Bathroom) | 0.65 | no: toilet | [140, 99] | None | missing |

Missing (must be added): כניסה, פינת אוכל, חדר שינה הורים, פינת ארונות
Invented (must be removed): חדר דיור נוסף, מרפסת שירות

## Printed dimensions

Missed values: [822.0, 744.0, 530.0, 348.0, 344.0, 342.0, 270.0, 212.0, 210.0, 160.0, 140.0, 99.0, 474.0, 1213.0]

## Unit fields

| field | GT | pred | ok |
|---|---|---|---|
| number | 846 | דירה 048 | no |
| area_m2 | 106.72 | None | no |
| terrace_m2 | 26.15 | None | no |
| floor | 16 | None | no |

## Edit-cost breakdown

| item | count |
|---|---|
| rooms_to_add | 4 |
| rooms_to_remove | 2 |
| rooms_to_rename | 3 |
| rooms_to_retype | 0 |
| room_dims_to_fix | 7 |
| dim_values_to_add | 14 |
| dim_values_to_remove | 7 |
| unit_fields_to_fix | 4 |

Openings (informative): {'gt_doors_in_trace': 6, 'pred_doors': 6, 'pred_windows_or_glazing_runs': 8}
