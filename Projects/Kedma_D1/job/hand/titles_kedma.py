"""kedma-d1 ($0): the apartment's names, read from the sheet's own title block (type C1 · floor 1 · apartment 1 · 5 rooms ·
134 m2 · balcony 22 m2) and from the source folder's name, written where the runner's spec would have put them (no portal
reading exists for a hand trace): apartments/kedma-d1/spec.json (the package step reads it) and apartment.json's title and
provenance. The developer's name is left EMPTY: showing it is Eliran's wording call. Idempotent."""
import json, sys
from pathlib import Path
apt = Path(sys.argv[1])
spec = {"$note": "hand-written from the sheet's title block by jobs/kedma-d1/hand/titles_kedma.py; not a portal reading",
        "project_name": "קדמא · בניין ד", "city": "עץ אפרים", "developer": "",
        "unit": {"number": "1", "type_mark": "C1", "rooms_count": 5, "area_m2": 134, "terrace_m2": 22},
        "building": {"floor_of_unit": 1}}
(apt / "spec.json").write_text(json.dumps(spec, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
a = json.loads((apt / "apartment.json").read_text(encoding="utf-8"))
a["title"] = {"he": "דירה 1 · בניין ד · קומה א׳ · קדמא עץ אפרים (הדמיה)", "en": "Apartment 1 · building D · floor 1 · Kedma, Etz Efraim (concept)",
              "fr": "Appartement 1 · bâtiment D · étage 1 · Kedma, Etz Efraim (concept)"}
a["provenance"] = {"generation": "the sales plan traced by hand, built in Blender (Cycles 2048x1024, 16 spp, furniture by rule) and skinned by openai/gpt-image-2.5 through fal.ai; "
                                 "every room picture is AI-generated and passed the sales-plan fidelity gate at 1 % (2026-11-16)", "enhancement": "none"}
a["projectNote"] = "built by tools/run-project.mjs steps from the hand trace jobs/kedma-d1/hand/plan.final.json; the designed look by tools/skin-project.mjs, 13 scenes gated"
(apt / "apartment.json").write_text(json.dumps(a, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"); print("titles written")
