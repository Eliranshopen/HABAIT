p = "scripts/05_check_geometry.py"
s = open(p, encoding="utf-8").read()
old = 'bad = far_model + far_sheet > 400 or res["dimensions_over_2pct"] or abs(gross - 80) > 0.8'
new = '''wall_px = int(((sheet > 0) & keep).sum())
far_pct = round((far_model + far_sheet) / wall_px * 100, 2)
print(f"wall pixels on the sheet {wall_px}; further than 2 cm from the model or the sheet: {far_pct} % (bar 1 %)")
res["wall_px_sheet"] = wall_px
res["wall_beyond_2cm_pct"] = far_pct
(qa / "geometry-check.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
bad = far_pct > 1.0 or res["dimensions_over_1pct"] or abs(gross - 80) > 0.8 or problems'''
assert old in s
open(p, "w", encoding="utf-8", newline="\n").write(s.replace(old, new))
