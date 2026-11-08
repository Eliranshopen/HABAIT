You are reading an Israeli apartment sales plan (תכנית מכר) for a real-estate visualization pipeline. Read BOTH images with the Read tool, then answer with ONE strict JSON object and nothing else (no prose, no markdown fences).

Image 1 (the apartment drawing, cropped): {CROP_PNG}
Image 2 (the whole sheet, small: title block, areas table, floor key, site key, notes): {SHEET_PNG}
Images 3-6 (zoomed quadrants of Image 1, for reading the small numbers; they overlap): 
{TILES}
Read every image. Use the quadrants to verify each dimension number digit by digit (a 99 is not a 299, a 474 is not a 471); report a number only after you have seen it in a quadrant.

Read Image 1 at full attention first. Hebrew text on the drawing may be mirrored or rotated; dimension strings are numbers in cm printed along dimension lines (e.g. 342, 275, 1213). Room labels are Hebrew words inside rooms (חדר דיור, מטבח, פינת אוכל, חדר שינה, חדר שינה הורים, חדר רחצה, פינת ארונות, מרפסת שמש, ממ"ד, כניסה, מעבר צר, אוורור ...). The sheet's areas table (Image 2) lists the unit area (שטח דירה), terrace (שטח מרפסת), covered part (חלקה המקורה), etc.

Rules:
- Report ONLY what is printed. Never estimate a dimension that is not printed; printed_dims_cm is null when the room has no printed pair.
- printed_dims_cm is [w, d] exactly as printed next to that room; put extra printed numbers that belong to the room into `extra_printed_cm`.
- `printed_dimensions_cm` is the complete flat list of every dimension number printed on the drawing (integers, cm), including the ones along the outside (overall lengths) and terrace/passage dims. Do not include areas (m²), scale, dates, unit numbers, or note numbers such as "H=180".
- `label_center_frac` is the position of the room's PRINTED label text inside Image 1 as fractions [x, y] of the image width and height (0..1, origin top-left). Be as accurate as you can; it is used to assign traced polygons to names. If the room has no printed label (an unlabelled entrance hall, a corridor), set it to null and say so in notes; never invent a position.
- The unit's floor is the number after קומה in the title block (Image 2); read it digit by digit.
- `type` is one of: living, kitchen, dining, bedroom, master_bedroom, safe_room, bathroom, toilet, hall, corridor, balcony, service_balcony, storage, wardrobe, shaft, passage, other.
- A space with no walls of its own (dining corner inside the living, wardrobe niche) is still a room row if it has a label.
- Notes written on the drawing (e.g. קורה דקורטיבית, קו קומה מעל, מעבר צר, גבול מגרש, H=180) go into `drawing_notes` verbatim with a short English gloss.
- Give `confidence` 0..1 for the whole reading and per-room `confidence` where you are unsure.

JSON shape (fill every key; use null when unknown):
{
  "unit": {"number": "", "floor": null, "type_mark": "", "rooms_count": null, "area_m2": null, "terrace_m2": null,
           "other_areas": [{"label": "", "m2": null}], "building": "", "project": "", "developer": "", "architect": "",
           "scale": "", "date": "", "north_arrow_deg_clockwise_from_up": null},
  "rooms": [{"name_he": "", "name_en": "", "type": "", "is_outdoor": false, "printed_dims_cm": [0, 0],
             "extra_printed_cm": [], "label_center_frac": [0.0, 0.0], "glazing": "none|window|facade|railing",
             "notes": "", "confidence": 1.0}],
  "printed_dimensions_cm": [],
  "openings_summary": "",
  "drawing_notes": [{"he": "", "en": ""}],
  "title_block_text": {"floor_line": "", "unit_line": "", "type_line": ""},
  "sheet_notes": [{"he": "", "en": ""}],
  "confidence": 0.0,
  "uncertainties": [""]
}
