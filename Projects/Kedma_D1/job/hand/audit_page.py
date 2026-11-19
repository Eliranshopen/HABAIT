"""kedma-d1 ($0): the page Eliran reads to check the reading of the sales plan - the sheet beside the 3D model, room by room.

usage: python audit_page.py <review/audit dir> [--findings <findings.json>]
Reads audit.json (hand/plan_audit.py) and, when given, a findings file: [{"room": "r-living", "he": "...", "status": "תוקן" | "פתוח"}].
Writes plan-vs-model.html beside the pictures (a local file: the sheet is the developer's material and is not published).
"""
import html
import io
import json
import os
import sys

d = sys.argv[1]
findings = []
if "--findings" in sys.argv:
    findings = json.load(io.open(sys.argv[sys.argv.index("--findings") + 1], encoding="utf-8"))
doc = json.load(io.open(os.path.join(d, "audit.json"), encoding="utf-8"))
HE = {"kitchen_cabinet": "ארון מטבח", "kitchen_sink": "כיור מטבח", "stove": "כיריים", "sofa": "ספה", "armchair": "כורסה", "coffee_table": "שולחן קפה",
      "round_table": "שולחן עגול", "tv_unit": "מזנון טלוויזיה", "tv": "טלוויזיה", "dining_table": "שולחן", "dining_chair": "כיסא", "bed_double": "מיטה",
      "bed_single": "מיטה", "toilet": "אסלה", "bathroom_sink": "כיור רחצה", "mirror": "מראה", "bathtub": "אמבטיה", "bookcase": "מדפים", "plant": "עציץ",
      "rug": "שטיח", "bath_mat": "שטיחון", "kitchen_tall": "ארון גבוה", "closet": "ארון בגדים", "kitchen_shelves": "מדפי מטבח", "shower": "מקלחון",
      "washing_machine": "מכונת כביסה / מייבש", "sun_lounger": "מיטת שיזוף", "bar_stool": "כיסא בר", "pouf": "פוף", "nightstand": "שידת לילה"}
# a printed dimension the model meets in another way, said in words
NOTES = {("r-shower", 298): "המידה המודפסת כוללת קיר סמוי של 13 ס״מ מאחורי האסלה; במודל הוא בנוי כקיר"}
OPEN = {"window": "חלון", "door": "דלת", "sliding_door": "דלת הזזה", "entrance_door": "דלת כניסה", "opening": "מעבר פתוח"}
e = html.escape
rows, sections, n_dim, worst = [], [], 0, 0.0
for r in doc["rooms"]:
    for x in r["dims"] or []:
        n_dim += 1
        worst = max(worst, abs(x["diff_pct"]))
        note = NOTES.get((r["room"], x["printed_cm"]), "")
        ok = abs(x["diff_pct"]) <= 2.0 or abs(x["diff_cm"]) <= 5.0 or bool(note)
        rows.append(f"<tr><td>{e(r['name_he'] or r['room'])}</td><td class=n>{x['printed_cm']}</td><td class=n>{x['model_cm']}</td>"
                    f"<td class=n>{x['diff_cm']:+.1f}</td><td class='n {'ok' if ok else 'bad'}'>{x['diff_pct']:+.1f}%</td><td>{e(note)}</td></tr>")
    counts = {}
    for p in r["pieces"]:
        counts[p["class"]] = counts.get(p["class"], 0) + 1
    pieces = " · ".join(f"{e(HE.get(k, k))}{' ×' + str(v) if v > 1 else ''}" for k, v in counts.items()) or "אין פריטים"
    ops = " · ".join(f"{OPEN.get(o['kind'], o['kind'])} {o['width_cm']} ס״מ" for o in r["openings"]) or "—"
    fs = [f for f in findings if f.get("room") == r["room"]]
    fl = "".join(f"<li><span class='st {'done' if f.get('status') == 'תוקן' else 'open'}'>{e(f.get('status', 'פתוח'))}</span> {e(f['he'])}</li>" for f in fs)
    sections.append(f"<section><h2>{e(r['name_he'] or r['room'])}</h2>"
                    f"<div class=pic><img src='{e(r['picture'])}' alt='תכנית המכר מול המודל: {e(r['name_he'] or r['room'])}' loading=lazy></div>"
                    f"<p><b>במודל:</b> {pieces}</p><p><b>פתחים:</b> {ops}</p>" + (f"<ul class=find>{fl}</ul>" if fl else "") + "</section>")
n_open = sum(1 for f in findings if f.get("status") != "תוקן")
page = f"""<!doctype html><html lang=he dir=rtl><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>תכנית המכר מול המודל · קדמא ד/1</title><style>
:root{{--bg:#f3f4f1;--fg:#1d2320;--mut:#5d6661;--line:#d5d9d3;--ok:#1e6b4f;--bad:#a43a2a;--card:#fff}}
body{{margin:0;background:var(--bg);color:var(--fg);font:17px/1.6 "Heebo","Segoe UI",Arial,sans-serif}}
main{{max-width:1500px;margin:0 auto;padding:28px 20px 60px}}h1{{font-size:32px;margin:0 0 8px}}h2{{font-size:22px;margin:0 0 10px}}
p{{margin:6px 0;max-width:110ch}}.lead{{font-size:19px}}.mut{{color:var(--mut)}}
table{{border-collapse:collapse;background:var(--card);margin:14px 0 30px}}th,td{{padding:7px 14px;border-bottom:1px solid var(--line);text-align:start}}
th{{font-weight:500;color:var(--mut);font-size:14px}}.n{{font-variant-numeric:tabular-nums;direction:ltr;text-align:end}}.ok{{color:var(--ok)}}.bad{{color:var(--bad);font-weight:700}}
section{{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:16px 18px;margin:0 0 22px}}
.pic{{overflow-x:auto}}.pic img{{max-width:100%;height:auto;display:block;border:1px solid var(--line)}}
.find{{margin:10px 0 0;padding-inline-start:20px}}.st{{display:inline-block;font-size:13px;padding:1px 9px;border-radius:999px;margin-inline-end:6px}}
.st.done{{background:#dcefe6;color:var(--ok)}}.st.open{{background:#f6e0db;color:var(--bad)}}
</style></head><body><main>
<h1>תכנית המכר מול המודל התלת־ממדי</h1>
<p class=lead>קדמא עץ אפרים · בניין ד · דירה 1. בכל חדר: משמאל הקטע מתכנית המכר כמו שהוא, מימין רק מה שיש במודל, באותו קנה מידה. ירוק = פריט מהתכנית; כחול = חלון; כתום = דלת או מעבר; צלב אדום = נקודת הצפייה.</p>
<p class=mut>{n_dim} מידות מודפסות נבדקו מול המודל; הסטייה הגדולה ביותר {worst:.1f}%. ממצאים פתוחים: {n_open} מתוך {len(findings)}.</p>
<h2>המידות המודפסות בתכנית מול המודל</h2>
<table><thead><tr><th>חדר</th><th>מודפס (ס״מ)</th><th>במודל (ס״מ)</th><th>הפרש (ס״מ)</th><th>הפרש</th><th>הערה</th></tr></thead><tbody>{''.join(rows)}</tbody></table>
{''.join(sections)}
</main></body></html>"""
out = os.path.join(d, "plan-vs-model.html")
io.open(out, "w", encoding="utf-8", newline="").write(page)
print("wrote", out, "| dimensions", n_dim, "| worst", round(worst, 2), "% | findings", len(findings), "open", n_open)
