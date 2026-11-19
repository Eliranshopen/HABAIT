#!/usr/bin/env python
"""qa_report.py - every gate result of one run -> one qa.html (Hebrew, RTL, one table, green / red). ($0)

Engine gate A6 (board habait-workplan-2026-11-02, card 05). Collects every *.json under <run>/ (recursively) that
carries a "gate" key (plan_gate, facade_gate, or any future gate with gate/pass/score/input). A result whose input lies
under a gates/fixtures/ folder, or whose plan is marked KNOWN-BAD, is a NEGATIVE CONTROL: it is green when it FAILS.
Images: the row links to the input image and to the gate's overlay (file:/// URIs, so the page works from a junction).

Usage: python qa_report.py <run-dir> [--out <run-dir>/qa.html] [--title "..."]
Exit: 0 when every row is green, 1 otherwise, 2 usage.
"""
import argparse
import datetime
import html
import json
import os
import pathlib
import sys

GATE_HE = {"plan_gate": "תכנית: מידות, קירות, שכנים", "facade_gate": "חזית: מסה מוטלת מול הפריים"}


def uri(p):
    try:
        return pathlib.Path(p).resolve().as_uri()
    except Exception:  # noqa: BLE001
        return ""


def is_negative(r):
    inp = (r.get("input") or "").replace("\\", "/")
    return "/gates/fixtures/" in inp or bool(r.get("known_bad"))


def details(r):
    g = r.get("gate")
    if g == "plan_gate":
        bad = [x["id"] for x in r.get("rooms", []) if not x.get("pass")]
        s = f"חדר חלש: {r.get('worst_room')}"
        if bad:
            s += f" · נכשלו: {', '.join(bad)}"
        s += f" · מידות {'חוסמות' if r.get('dims_gating') else 'לידיעה (קווי מידה ידניים, עד report.json של כרטיס 01)'}"
        unc = r.get("unchecked_dims") or []
        if unc:
            s += f" · {len(unc)} מידות לא נבדקות (כוללות/פתח/תת-רכיב)"
        return s
    if g == "facade_gate":
        c = r.get("classes", {})
        p = r.get("peak", {})
        return (f"קו מתאר {c.get('silhouette', {}).get('kept')} · קווי קומות {c.get('slabs', {}).get('kept')} · "
                f"שיא יישור {p.get('margin', 0):+.3f} (הזזה {p.get('at_dx_px')} px) · מצלמה {r.get('camera', {}).get('name')}")
    return ""


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("run")
    ap.add_argument("--out")
    ap.add_argument("--title", default="דוח QA של ריצת מנוע")
    a = ap.parse_args()
    if not os.path.isdir(a.run):
        print(f"qa_report: no such run folder {a.run}", file=sys.stderr)
        return 2
    out = a.out or os.path.join(a.run, "qa.html")
    rows = []
    for p in sorted(pathlib.Path(a.run).rglob("*.json")):
        try:
            r = json.loads(p.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            continue
        if not isinstance(r, dict) or "gate" not in r or "pass" not in r:
            continue
        neg = is_negative(r)
        green = (not r["pass"]) if neg else bool(r["pass"])
        rows.append({"file": str(p), "r": r, "neg": neg, "green": green})
    if not rows:
        print(f"qa_report: no gate results under {a.run}", file=sys.stderr)
        return 2
    rows.sort(key=lambda x: (x["r"].get("gate"), x["neg"], x["r"].get("input", "")))
    n_green = sum(x["green"] for x in rows)
    trs = []
    for x in rows:
        r = x["r"]
        inp = r.get("input", "")
        name = os.path.basename(inp)
        links = [f'<a href="{uri(inp)}">קלט</a>'] if inp else []
        if r.get("overlay"):
            links.append(f'<a href="{uri(r["overlay"])}"><img src="{uri(r["overlay"])}" alt="overlay"></a>')
        links.append(f'<a href="{uri(x["file"])}">JSON</a>')
        verdict = "PASS" if r["pass"] else "FAIL"
        role = "בקרה שלילית (חייב להיכשל)" if x["neg"] else "תוצר"
        trs.append(
            f'<tr class="{"g" if x["green"] else "r"}"><td>{html.escape(GATE_HE.get(r.get("gate"), r.get("gate", "")))}</td>'
            f'<td dir="ltr">{html.escape(name)}</td><td>{role}</td><td dir="ltr">{verdict}</td>'
            f'<td dir="ltr">{r.get("score")}</td><td>{html.escape(details(r))}</td><td>{" ".join(links)}</td></tr>')
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    page = f"""<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>{html.escape(a.title)}</title>
<style>body{{font-family:system-ui,Arial,sans-serif;margin:24px;color:#222}}table{{border-collapse:collapse;width:100%}}
td,th{{border:1px solid #ccc;padding:6px 8px;vertical-align:top;font-size:14px}}th{{background:#f3f3f3}}
tr.g td{{background:#e8f6e8}}tr.r td{{background:#fbe3e3}}img{{max-height:90px;display:block;margin-top:4px}}
.sum{{font-size:18px;margin:8px 0 16px}}.note{{color:#555;font-size:13px;max-width:70em}}</style></head><body>
<h1>{html.escape(a.title)}</h1>
<div class="sum">{n_green}/{len(rows)} ירוקים · תיקייה: <span dir="ltr">{html.escape(os.path.abspath(a.run))}</span> · {now}</div>
<p class="note">ירוק = התוצאה הנכונה: תוצר עבר, או בקרה שלילית (קלט רע שנבנה בכוונה) נכשלה. אדום = תוצר נכשל, או בקרה שלילית שעברה
(ה-gate לא רואה את הפגם). gate בלי בקרה שלילית שנכשלת לא נחשב gate (לקח ה-edge-PSNR של fidelity_gate).</p>
<table><tr><th>gate</th><th>קובץ</th><th>תפקיד</th><th>תוצאה</th><th>ציון</th><th>פירוט</th><th>קישורים</th></tr>
{''.join(trs)}</table></body></html>"""
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        f.write(page)
    print(f"qa_report: {n_green}/{len(rows)} green -> {out}")
    return 0 if n_green == len(rows) else 1


if __name__ == "__main__":
    sys.exit(main())
