"""kedma-d1: the terrace is open to the sky (2026-11-17, read off the sheet with Eliran's remark on the developer's renders).

The sheet marks «קו מרפסת מעל» - the line of the balcony above - as a dashed rectangle of about 0.9 x 1.7 m in the terrace's north-west
corner only. On 2026-11-16 the room was set `roofed: true` (my assumption, never checked): the 3D model put a deck over the whole
terrace and the picture showed a covered balcony. The engine roofs an outdoor room as a whole or not at all, so the room is unroofed;
the small corner the upper balcony covers is not modelled (noted here, not hidden).

usage: python fix_balcony_1117.py <plan.general.json> [<another plan> ...]      idempotent
"""
import io
import json
import sys

for p in sys.argv[1:]:
    raw = io.open(p, encoding="utf-8", newline="").read()
    plan = json.loads(raw)
    r = next(x for x in plan["rooms"] if x["id"] == "r-balcony")
    was = r.get("roofed")
    r["roofed"] = False
    r["note"] = ("open to the sky: the sheet's «קו מרפסת מעל» marks only a 0.9 x 1.7 m corner (north-west) under the balcony above; "
                 "not modelled (hand/fix_balcony_1117.py, 2026-11-17)")
    s = json.dumps(plan, ensure_ascii=False, indent=1) + "\n"
    io.open(p, "w", encoding="utf-8", newline="").write(s.replace("\n", "\r\n") if "\r\n" in raw else s)
    print(p, "roofed", was, "->", r["roofed"])
