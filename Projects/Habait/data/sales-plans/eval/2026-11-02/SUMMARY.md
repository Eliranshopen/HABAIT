# Intake eval, 2026-11-02: Claude Sonnet via `claude -p` (subscription, $0) on unit 846

Ground truth: `israel-canada/rainbow-tel-aviv/unit-846/{meta.json,plan.json}` (10 labelled rooms, 16 printed dimension values, 4 unit fields).
Inputs: the sheet rendered at 150 dpi (3509×2482, `pages/p0-sheet-150dpi.png`) and the apartment crop (1800×2150, `pages/p0-apartment-crop.png`); prompts in `inputs/`.

| run | rooms R/P | type acc | dims recall | room dims ok | unit | edit cost | edit score | conf |
|---|---|---|---|---|---|---|---|---|
| sonnet_full-sheet | 0.6/0.75 | 0.833 | 0.125 | 0/7 | 0/4 | 32.75 | 0.16 | 0.75 |
| sonnet_crop | 0.6/0.75 | 0.833 | 0.125 | 0/7 | 0/4 | 34.25 | 0.122 | 0.75 |

## Reading

- Both runs find the obvious rooms (bedroom, kitchen, a bathroom, a terrace) and invent the rest: "חדר דיור נוסף", "מרפסת שירות", "חדר ילדים", "פרוזדור ארונות". Recall 6/10, with 3–4 of the 6 needing a rename.
- **Zero room dimension pairs correct (0/7).** The two "hits" in dims recall (185, 275 on the full sheet; 185, 140 on the crop) are bare values that coincide; the model attached no correct [w,d] to any room and read the living room as 545×395 (printed 744×530).
- Unit fields 0/4 in both; the full-sheet run reads the unit number as "048".
- Edit score 0.16 / 0.12: correcting this output costs almost as much as typing the meta.json by hand (edit cost 32.75 / 34.25 against 39 from scratch). The crop did not help; it removed the unit/area table and gained nothing in dims.
- The model reports confidence 0.75 in both runs; its confidence is not informative.

Conclusion (same as SUMMARY-he.md 11.1): a mid-tier VLM is not usable for the printed-dimension layer, even cropped. The frontier reading (16/16 dims, all rooms) was done by hand in that session and is not saved as a JSON here; the next run to add is a frontier model's JSON on the same two inputs so the eval has an upper bound.

Files: `sonnet_full-sheet.result.json`, `sonnet_full-sheet.md`, `sonnet_crop.result.json`, `sonnet_crop.md`.
